import { existsSync, lstatSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { canonicalServerKey, withHdcCommandSession, hdcDirectEnvironment, parseTargetState } from '../../tools/reader-hdc-lease.mjs';
import { resolveHarmonyTool } from '../lib/harmony-toolchain.mjs';
import { verifyPublishedCoreGate, readinessQueryOutput, targetReadiness } from '../lib/hap-delivery-evidence.mjs';
import { storageUpdateRoute } from '../lib/hap-storage-admission.mjs';
import { verifyStorageDeliveryContract } from '../lib/storage-delivery-contract.mjs';
import { collectStorageAdmission, installedStorageIdentity, storageAdmissionAllowed, revalidateStorageAdmission,
  recordInstalledStorageCandidate, releaseStorageAdmission } from '../lib/storage-deployment-admission.mjs';
import { collectStorageDeviceEvidence } from '../lib/storage-device-evidence.mjs';
import { APP_IDENTITY_SCHEMA, assertAppVersion, createAppBuildIdentity, installedAppIdentity } from '../lib/app-build-identity.mjs';
import { verifyAppContentEvidence } from '../lib/app-build-context.mjs';
import { archivedContractSelection, HISTORICAL_CONTRACT_TIMEOUT_MS } from '../lib/archived-hap-contract-selection.mjs';
import { assertCleanMainline } from '../lib/hap-mainline-provenance.mjs';
import { BUNDLE_NAME, inspectHap, measureBuildStep, option, requiredOption, resolveCoreProfile, resolveHarmonyAbi, run } from './build-and-sign.mjs';
import { LOCK_ROOT, acquireLock, timestampId, writeJson } from './locks-and-retention.mjs';
import { HAP_PIPELINE_INPUTS, REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT,
  controllerRequiresContractEvidence, fail, fileRecord, sha256Bytes, verifySnapshotIdentity } from './workspace-fingerprint.mjs';

const HDC_LEASE_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-lease.mjs');
const HDC_PREFLIGHT_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-preflight.mjs');
export const LOCAL_HDC_SERVER = '127.0.0.1:8710';
export const REMOTE_VM_HDC_SERVER = '192.168.1.10:8710';

// Device operations share one cross-process target lease.  Keeping this at
// the command boundary covers inspect/install/launch without changing the
// existing signing and preserve-data gates.  The lease wrapper never starts,
// kills, or rediscovers HDC; it only serializes the already-authorized argv.
let activeHdcSession;
export function runTargetHdc(hdc, target, serverKey, args, options = {}, runner = run) {
  if (activeHdcSession) {
    if (activeHdcSession.hdc !== hdc || activeHdcSession.target !== target || activeHdcSession.serverKey !== serverKey) fail('HDC deployment session identity mismatch');
    return activeHdcSession.runSync(['-s', serverKey, ...args], options);
  }
  const leaseArgs = [HDC_LEASE_SCRIPT, '--target', target, '--hdc', hdc,
    '--server-key', serverKey,
    ...(options.waitMs === undefined ? [] : ['--wait-ms', String(options.waitMs)]),
    ...(options.timeoutMs === undefined ? [] : ['--timeout-ms', String(options.timeoutMs)]), '--', '-s', serverKey, ...args];
  return runner(process.execPath, leaseArgs, { ...options, env: hdcDirectEnvironment(options.env),
    timeoutMs: options.timeoutMs === undefined ? undefined : (options.waitMs ?? 30000) + options.timeoutMs + 2000 });
}

export async function withDeploymentHdcSession(options, action, { preflight = false } = {}) {
  if (activeHdcSession) fail('nested HDC deployment session');
  const targetKind = requiredOption(options, '--target-kind');
  const route = resolveHdcServer({ targetKind, vmLocation: option(options, '--vm-location'), configuredServer: process.env.READER_HDC_SERVER_KEY });
  const hdc = hdcBinary();
  const target = requiredOption(options, '--target');
  // The read-only preflight acquires the server lease for its own commands.
  // Complete it before opening the bounded deployment session on that server.
  if (preflight) assertHdcPreflight(hdc, target, route.serverKey);
  return withHdcCommandSession({ hdc, target, serverKey: route.serverKey }, async session => {
    if (activeHdcSession) fail('nested HDC deployment session');
    activeHdcSession = session;
    try { return await action(session); } finally { activeHdcSession = undefined; }
  });
}

/** The location is explicit; an exact device target alone cannot identify its server. */
export function resolveHdcServer({ targetKind, vmLocation, configuredServer }) {
  if (!['vm', 'physical'].includes(targetKind)) throw new Error('invalid target kind for HDC routing');
  if (vmLocation !== undefined && (targetKind !== 'vm' || !['local', 'remote'].includes(vmLocation))) {
    throw new Error('--vm-location must be local or remote and applies only to a VM. Choose --target-kind vm --vm-location remote for remote VM deployment.');
  }
  let configured;
  if (configuredServer !== undefined) {
    configured = canonicalServerKey(configuredServer);
    if (![LOCAL_HDC_SERVER, REMOTE_VM_HDC_SERVER].includes(configured)) {
      throw new Error('unsupported HDC server for the selected device location');
    }
  }
  const location = targetKind === 'physical' ? undefined :
    (vmLocation ?? (configured === REMOTE_VM_HDC_SERVER ? 'remote' : 'local'));
  const serverKey = location === 'remote' ? REMOTE_VM_HDC_SERVER : LOCAL_HDC_SERVER;
  if (configured !== undefined && configured !== serverKey) {
    const selection = targetKind === 'physical' ? '--target-kind physical' : `--target-kind vm --vm-location ${location}`;
    throw new Error(`READER_HDC_SERVER_KEY=${configured} conflicts with ${selection} (${serverKey}). ` +
      'Use the flags for the authorized target and unset or correct READER_HDC_SERVER_KEY.');
  }
  return { serverKey, ...(location === undefined ? {} : { vmLocation: location }) };
}

export function hdcRouteEvidence(route) {
  return { hdcServer: route.serverKey, ...(route.vmLocation === undefined ? {} : { vmLocation: route.vmLocation }) };
}

/** Read published metadata only. Live use obtains the fingerprint from the inspected HAP. */
export function plannedSignedCoreFingerprint(selection) {
  const artifact = selection.manifest.artifacts.find(item => item.kind === 'signed');
  return verifyStorageDeliveryContract(dirname(selection.path), artifact, selection.manifest.source?.vendoredCoreNapi)
    ?.coreInputFingerprint;
}

function loadManifest(path) {
  const absolute = resolve(path);
  const manifest = JSON.parse(readFileSync(absolute, 'utf8'));
  if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' ||
      !Array.isArray(manifest.artifacts)) {
    fail(`invalid HAP run manifest: ${absolute}`);
  }
  return { manifest, path: absolute, directory: dirname(absolute) };
}

function checkContractResults(report, selection, scope) {
  const scopeBudget = selection.scopePolicy?.timeoutMs ?? HISTORICAL_CONTRACT_TIMEOUT_MS;
  if (selection.scopePolicy?.layers && (report.failFast !== selection.scopePolicy.failFast || report.failureStopped !== false ||
      report.selectedStatus !== 'PASS' || report.harmonyContracts !== 'PARTIAL' || report.fullSuite !== 'NOT_RUN' || report.acceptanceEligible !== false ||
      JSON.stringify(report.evidenceLayers) !== JSON.stringify(selection.scopePolicy.layers))) fail('contract evidence scope policy is inconsistent');
  if (report.schemaVersion !== 1 || report.name !== 'reader-harmony-contract-results' || report.tier !== 'full' ||
      report.scope !== (scope ?? 'full') || !Number.isInteger(report.workers) || report.workers < 1 || report.workers > 4 ||
      !Number.isInteger(report.timeoutMs) || report.timeoutMs <= 0 || report.timeoutMs > HISTORICAL_CONTRACT_TIMEOUT_MS ||
      !Number.isInteger(report.killGraceMs) || report.killGraceMs <= 0 || report.killGraceMs > 1_000) {
    fail('contract evidence execution policy is invalid');
  }
  if (report.cancelled === true || report.treeSettled === false || report.treeRecoveryBlocked === true ||
      report.scopeExpired !== false || !Array.isArray(report.unrun) || report.unrun.length !== 0 ||
      !Number.isInteger(report.millisecondsTotal) || report.millisecondsTotal < 0 ||
      !Number.isInteger(report.pipelineGateMilliseconds) || report.pipelineGateMilliseconds < report.millisecondsTotal ||
      (scope === undefined ? report.scopeTimeoutMs !== null :
        !Number.isInteger(report.scopeTimeoutMs) || report.scopeTimeoutMs <= 0 || report.scopeTimeoutMs > scopeBudget ||
        report.millisecondsTotal > report.scopeTimeoutMs || report.pipelineGateMilliseconds > scopeBudget)) {
    fail('contract evidence total deadline or settlement is invalid');
  }
  for (const key of ['selected', 'omitted', 'inventory']) {
    if (JSON.stringify(report[key]) !== JSON.stringify(selection[key])) fail(`contract evidence ${key} mismatch`);
  }
  if (!Array.isArray(report.results) ||
      JSON.stringify(report.results.map(row => row.name)) !== JSON.stringify(selection.selected)) {
    fail('contract evidence must contain every selected result exactly once');
  }
  for (const row of report.results) {
    if (row.treeSettled === false || row.status !== 0 || row.signal !== null || row.error != null || row.timedOut !== false || row.scopeTimedOut !== false ||
        !Array.isArray(row.termination) || row.termination.length !== 0 ||
        !Number.isInteger(row.milliseconds) || row.milliseconds < 0 || row.milliseconds > report.millisecondsTotal || !Number.isFinite(row.wallMilliseconds)) {
      fail(`contract evidence contains an unsuccessful result: ${row.name}`);
    }
  }
}

function verifiedContractFile(directory, record, expectedName) {
  if (record?.path !== expectedName || !Number.isInteger(record.bytes) || record.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(record.sha256 ?? '')) fail('contract evidence file identity is invalid');
  const path = resolve(directory, expectedName);
  for (let current = path; current !== resolve(directory); current = dirname(current)) {
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail('contract evidence must not contain symbolic links');
  }
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) fail('contract evidence file is missing or non-regular');
  const actual = fileRecord(path, expectedName);
  if (actual.bytes !== record.bytes || actual.sha256 !== record.sha256) fail('contract evidence file identity mismatch');
  return path;
}

export function verifyContractEvidence(directory, manifest) {
  // Decide the evidence format from the immutable controller snapshot, never
  // from removable status/receipt fields in the outer manifest. The descriptor
  // is required even for legacy runs so deleting it cannot bypass this check.
  const controller = verifySnapshotIdentity(directory, manifest.gates?.controllerInputs,
    'controller-snapshot.json', 'contract controller');
  const receiptRequired = controllerRequiresContractEvidence(controller);
  const contracts = manifest.gates?.contracts;
  if (contracts?.scope === 'none') {
    const policyRecord = controller.files.find(file => file.path === CONTRACT_EVIDENCE_POLICY_INPUT);
    const policyPath = verifiedContractFile(directory, contracts.policy, 'contracts/policy.json');
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    const inventory = controller.files.map(file => file.path).filter(path => /^tools\/test-[^/]+\.mjs$/.test(path) && !/-server\.mjs$/.test(path)).map(path => path.slice(6)).sort();
    if (!policyRecord || policyRecord.sha256 !== contracts.policy.sha256 || policyRecord.bytes !== contracts.policy.bytes ||
        policy.schemaVersion !== 2 || policy.name !== 'reader-harmony-contract-evidence-policy' ||
        policy.defaultScope !== 'none' || policy.contractsReceiptRequired !== 'when-executed' ||
        !['iteration', 'acceptance'].includes(manifest.buildClass) || manifest.acceptanceEligible !== false ||
        manifest.gates.harmonyContracts !== 'NOT_RUN' || contracts.selectedStatus !== 'NOT_RUN' || contracts.fullSuite !== 'NOT_RUN' ||
        !Array.isArray(contracts.selected) || contracts.selected.length !== 0 || contracts.evidence !== undefined ||
        JSON.stringify(contracts.omitted) !== JSON.stringify(inventory) || contracts.inventoryCount !== inventory.length) {
      fail('Unrun contracts must be bound to the explicit-only controller policy and cannot claim PASS or acceptance.');
    }
    const unusedToolchain = verifySnapshotIdentity(directory, manifest.gates.contractToolchainInputs,
      'contract-toolchain-snapshot.json', 'unused contract toolchain');
    if (unusedToolchain.files.length !== 0) fail('Unrun contracts cannot claim executed contract toolchain inputs.');
    return;
  }
  if (contracts === undefined) {
    // Pre-policy v2 controllers produced full receipts with no detailed test
    // ledger. Preserve that format only when its actual snapshot proves it.
    if (receiptRequired || manifest.gates?.harmonyContracts !== 'PASS' || manifest.gates?.contractToolchainInputs !== undefined) {
      fail('scoped contract evidence is missing');
    }
    return;
  }
  if (!receiptRequired) fail('contract receipt is not bound to its controller policy');
  if (!['full', 'manga-image-cache', 'search-return-runtime'].includes(contracts.scope) ||
      !['iteration', 'acceptance'].includes(manifest.buildClass) ||
      manifest.acceptanceEligible !== (manifest.buildClass === 'acceptance' && contracts.scope === 'full' && manifest.gates.coreDevelopment?.status === 'PASS')) {
    fail('contract evidence build class is inconsistent');
  }
  const scope = contracts.scope === 'full' ? undefined : contracts.scope;
  if (scope !== undefined && manifest.acceptanceEligible !== false) {
    fail('scoped contracts cannot be acceptance evidence');
  }
  if (contracts.selectedStatus !== 'PASS' || contracts.fullSuite !== (scope === undefined ? 'PASS' : 'NOT_RUN') ||
      manifest.gates.harmonyContracts !== (scope === undefined ? 'PASS' : 'PARTIAL')) fail('contract evidence status is inconsistent');
  const report = JSON.parse(readFileSync(verifiedContractFile(directory, contracts.evidence, 'contracts/results.json'), 'utf8'));
  const inputs = { source: manifest.source?.buildInputs, controller: manifest.gates.controllerInputs,
    workspace: manifest.gates.workspaceContractInputs, toolchain: manifest.gates.contractToolchainInputs };
  if (JSON.stringify(report.inputs) !== JSON.stringify(inputs)) fail('contract evidence input identity mismatch');
  for (const [key, name] of Object.entries({ source: 'source-snapshot.json', controller: 'controller-snapshot.json',
    workspace: 'workspace-contract-snapshot.json', toolchain: 'contract-toolchain-snapshot.json' })) {
    verifySnapshotIdentity(directory, inputs[key], name, `contract ${key}`);
  }
  const selectionRecord = controller.files.find(file => file.path === 'tools/contract-test-tiers.json');
  const selectionPath = verifiedContractFile(directory, report.selection, 'contracts/selection.json');
  if (!selectionRecord || selectionRecord.sha256 !== report.selection.sha256 || selectionRecord.bytes !== report.selection.bytes) {
    fail('contract selection does not match the tested controller snapshot');
  }
  const discovered = controller.files.map(file => file.path).filter(path => /^tools\/test-.*\.mjs$/.test(path) &&
    !path.slice(6).includes('/') && !/-server\.mjs$/.test(path)).map(path => path.slice(6)).sort();
  const selection = archivedContractSelection(JSON.parse(readFileSync(selectionPath, 'utf8')), discovered, scope);
  checkContractResults(report, selection, scope);
  if (contracts.inventoryCount !== selection.inventory.length || JSON.stringify(contracts.selected) !== JSON.stringify(selection.selected) ||
      JSON.stringify(contracts.omitted) !== JSON.stringify(selection.omitted)) fail('manifest contract selection mismatch');
  for (const row of report.results) verifiedContractFile(directory, row.log, `contracts/logs/${row.name}.log`);
}

/** New ABI-aware runs bind the actual module profile and Native provenance.
 * Old manifests remain arm64-only and retain their original evidence format. */
export function verifyAbiEvidence(directory, manifest, artifacts) {
  if (manifest.abi === undefined) return;
  const abi = resolveHarmonyAbi(manifest.abi);
  if (!['iteration', 'acceptance'].includes(manifest.buildClass)) fail('ABI run has an invalid build class');
  const profile = manifest.effectiveModuleProfile;
  if (profile?.path !== 'module-build-profile.json') fail('ABI run is missing its effective module profile');
  const profilePath = resolve(directory, profile.path);
  const profileRecord = fileRecord(profilePath, profile.path);
  if (profileRecord.sha256 !== profile.sha256 || profileRecord.bytes !== profile.bytes) fail('effective module profile identity mismatch');
  // The isolated controller serializes this published profile as strict JSON.
  const filters = JSON.parse(readFileSync(profilePath, 'utf8')).buildOption?.externalNativeOptions?.abiFilters;
  if (!Array.isArray(filters) || filters.length !== 1 || filters[0] !== abi) fail('effective module profile ABI differs from the immutable run');
  const inputs = manifest.nativeProvenanceInputs;
  if (!Array.isArray(inputs) || inputs.length !== artifacts.length ||
      !Array.isArray(manifest.nativeProvenance) || manifest.nativeProvenance.length !== artifacts.length) {
    fail('ABI run is missing complete Native provenance inputs');
  }
  const expectedNative = manifest.source?.vendoredCoreNapi;
  if (expectedNative?.path !== `entry/libs/${abi}/libreader_core_napi.so`) fail('ABI run Native source path is inconsistent');
  for (const artifact of artifacts) {
    const name = `${manifest.buildClass}-${basename(artifact.path, '.hap')}-provenance.json`;
    const records = inputs.filter(record => record.path === name);
    if (records.length !== 1 || !manifest.nativeProvenance.includes(name)) fail('ABI artifact provenance selection is inconsistent');
    const path = resolve(directory, name);
    const actual = fileRecord(path, name);
    if (actual.sha256 !== records[0].sha256 || actual.bytes !== records[0].bytes) fail('Native provenance identity mismatch');
    const provenance = JSON.parse(readFileSync(path, 'utf8'));
    const rustProfile = provenance.core?.buildIdentity?.rustProfile;
    if (manifest.coreProfile !== undefined && rustProfile !== manifest.coreProfile) fail('Native provenance Rust profile mismatch');
    if (manifest.buildClass === 'acceptance' && (manifest.incremental !== undefined || rustProfile !== undefined) && rustProfile !== 'release') {
      fail('acceptance requires the Core release Rust profile');
    }
    if (provenance.name !== 'reader-harmonyos-build-provenance' || provenance.abi !== abi ||
        provenance.core?.buildEvidence?.values?.ohos_arch !== abi ||
        provenance.core?.buildEvidence?.values?.target !== (abi === 'arm64-v8a' ? 'aarch64-unknown-linux-ohos' : 'x86_64-unknown-linux-ohos') ||
        provenance.hap?.path !== artifact.path || provenance.hap?.sha256 !== artifact.sha256 ||
        provenance.hap?.embeddedNative?.path !== `libs/${abi}/libreader_core_napi.so` ||
        provenance.hap?.embeddedNative?.sha256 !== artifact.embeddedCoreNapi.sha256 ||
        provenance.napi?.nativeInput?.sha256 !== expectedNative.sha256) {
      fail('Native provenance does not bind the selected ABI and artifact');
    }
  }
}

export function verifyAppIdentityEvidence(directory, manifest) {
  const controllerFile = resolve(directory, 'controller-snapshot.json');
  const requiresIdentity = existsSync(controllerFile) && JSON.parse(readFileSync(controllerFile, 'utf8')).files.some(
    file => file.path.replaceAll('\\', '/') === 'scripts/lib/app-build-identity.mjs');
  if (!requiresIdentity && manifest.appIdentitySchema === undefined && manifest.expectedVersion === undefined) return 'LEGACY_NOT_PRESENT';
  if (manifest.appIdentitySchema !== APP_IDENTITY_SCHEMA || !manifest.expectedVersion) fail('Current app identity evidence is missing or unsupported');
  const snapshot = JSON.parse(readFileSync(verifiedContractFile(directory, manifest.appContentInputs, 'app-content-snapshot.json'), 'utf8'));
  const ledger = JSON.parse(readFileSync(verifiedContractFile(directory, manifest.appReleaseLedger, 'app-release-ledger.json'), 'utf8'));
  verifyAppContentEvidence(snapshot, manifest.expectedVersion);
  if (snapshot.buildIdentityInputs.abi !== manifest.abi) fail('App identity and HAP ABI disagree');
  const expected = createAppBuildIdentity({ files: snapshot.files, buildIdentityInputs: snapshot.buildIdentityInputs,
    ledger, channel: manifest.expectedVersion.channel, buildClass: manifest.buildClass,
    signed: manifest.artifacts?.some(artifact => artifact.kind === 'signed') });
  assertAppVersion(expected, manifest.expectedVersion, 'Manifest');
  if (expected.channel !== 'DEV' && (manifest.source?.harmony?.dirty !== false || manifest.source?.core?.dirty !== false)) {
    fail('RC/REL app identity requires clean recorded Harmony/Core inputs');
  }
  return 'PASS';
}

export function verifyManifest(path) {
  return verifyManifestWithInspector(path, inspectHap);
}

export function verifyManifestWithInspector(path, inspector) {
  const loaded = loadManifest(path);
  const { manifest } = loaded;
  if (manifest.buildClass === 'acceptance' &&
      (manifest.source?.harmony?.mainCommit !== undefined || manifest.source?.core?.mainCommit !== undefined)) {
    assertCleanMainline(manifest.source.harmony, manifest.source.core);
  }
  const incrementalCommand = /(?:^|\s)--incremental(?:\s|$)/.test(manifest.toolchain?.buildCommand ?? '');
  if (manifest.incremental !== undefined || incrementalCommand) {
    if (typeof manifest.incremental !== 'boolean' || manifest.incremental !== incrementalCommand ||
        manifest.gates?.nonIncrementalBuild !== (manifest.incremental ? 'NOT_RUN' : 'PASS') ||
        (manifest.incremental && (manifest.buildClass !== 'iteration' || manifest.acceptanceEligible !== false))) {
      fail('manifest incremental build evidence is inconsistent');
    }
    resolveCoreProfile(manifest.coreProfile);
    if (!Object.hasOwn(manifest, 'coreProfile')) fail('manifest is missing its Core Rust profile');
    const signingMode = manifest.source?.effectiveBuildProfile?.mode;
    const kinds = manifest.artifacts.map(artifact => artifact.kind).sort();
    const expectedKinds = manifest.buildClass === 'acceptance' ? ['signed', 'unsigned'] : [signingMode === 'local' ? 'signed' : 'unsigned'];
    if (!['local', 'unsigned'].includes(signingMode) || (manifest.buildClass === 'acceptance' && signingMode !== 'local') ||
        JSON.stringify(kinds) !== JSON.stringify(expectedKinds)) fail('manifest build class and artifact selection disagree');
  }
  // Historical runs omitted ABI and were exclusively arm64. Never infer it
  // from mutable environment or choose another architecture after publishing.
  const abi = resolveHarmonyAbi(loaded.manifest.abi ?? 'arm64-v8a');
  verifySnapshotIdentity(
    loaded.directory,
    loaded.manifest.source?.buildInputs,
    'source-snapshot.json',
    'source',
  );
  if (loaded.manifest.gates?.controllerInputs !== undefined ||
      loaded.manifest.gates?.workspaceContractInputs !== undefined) {
    verifySnapshotIdentity(
      loaded.directory,
      loaded.manifest.gates?.controllerInputs,
      'controller-snapshot.json',
      'controller',
    );
    verifySnapshotIdentity(
      loaded.directory,
      loaded.manifest.gates?.workspaceContractInputs,
      'workspace-contract-snapshot.json',
      'workspace contract',
    );
  }
  verifyContractEvidence(loaded.directory, loaded.manifest);
  const controllerFile = resolve(loaded.directory, 'controller-snapshot.json');
  const deliveryController = existsSync(controllerFile) && JSON.parse(readFileSync(controllerFile, 'utf8')).files.some(
    file => file.path === 'scripts/lib/hap-delivery-evidence.mjs');
  if (deliveryController && loaded.manifest.deliveryEvidenceVersion !== 1) fail('Current controller requires delivery evidence version 1');
  if (loaded.manifest.deliveryEvidenceVersion === 1) {
    if (loaded.manifest.gates.requiredResourceBytes !== 'PASS') fail('Required resource evidence is missing');
    const resourceProfile = loaded.manifest.requiredResourceProfile ?? 'full';
    if (resourceProfile !== 'full' && resourceProfile !== 'lean-iteration') {
      fail(`Unsupported requiredResourceProfile: ${resourceProfile}`);
    }
    if (resourceProfile === 'lean-iteration' && (
      loaded.manifest.buildClass !== 'iteration' ||
      loaded.manifest.acceptanceEligible !== false ||
      ['RC', 'REL'].includes(loaded.manifest.expectedVersion?.channel)
    )) {
      fail('Lean-font HAPs are only valid for DEV iteration builds');
    }
    if (loaded.manifest.gates.coreDevelopment?.status === 'NOT_RUN' && loaded.manifest.acceptanceEligible !== false) {
      fail('Unrun Core tests cannot claim acceptance eligibility.');
    }
    if (loaded.manifest.buildClass === 'acceptance' && loaded.manifest.gates.coreDevelopment?.status !== 'NOT_RUN') {
      const coreReceipt = verifyPublishedCoreGate(loaded.directory, loaded.manifest.gates.coreDevelopment);
      if (coreReceipt.inputs.gitCommit !== loaded.manifest.source.core.commit) fail('Core gate and acceptance source commit differ');
    }
  }
  verifyAppIdentityEvidence(loaded.directory, loaded.manifest);
  const seenKinds = new Set();
  const verified = [];
  for (const artifact of loaded.manifest.artifacts) {
    const expectedName = artifact.kind === 'signed' ? 'entry-default-signed.hap' :
      artifact.kind === 'unsigned' ? 'entry-default-unsigned.hap' : null;
    if (expectedName === null || artifact.path !== expectedName || seenKinds.has(artifact.kind)) {
      fail('manifest artifact identity is invalid');
    }
    seenKinds.add(artifact.kind);
    const artifactPath = resolve(loaded.directory, artifact.path);
    if (!existsSync(artifactPath)) fail(`manifest artifact is missing: ${artifactPath}`);
    if (loaded.manifest.deliveryEvidenceVersion === 1 && !artifact.requiredResources?.length) fail('Required HAP resource inventory is missing');
    const current = measureBuildStep('inspectHap', () =>
      inspector(artifactPath, artifact.kind, artifact.path, artifact.requiredResources, abi, loaded.manifest.expectedVersion));
    if (current.sha256 !== artifact.sha256 || current.bytes !== artifact.bytes ||
        current.embeddedCoreNapi.sha256 !== artifact.embeddedCoreNapi.sha256) {
      fail(`manifest artifact identity mismatch: ${artifactPath}`);
    }
    if (loaded.manifest.storageEvidenceVersion === 1 && !artifact.storageContract) fail('Current manifest requires storage capability binding');
    current.storageContract = artifact.storageContract;
    current.storageCapability = verifyStorageDeliveryContract(loaded.directory, current, loaded.manifest.source.vendoredCoreNapi);
    verified.push(current);
  }
  if (loaded.manifest.expectedVersion && ['RC', 'REL'].includes(loaded.manifest.expectedVersion.channel) &&
      !verified.some(artifact => artifact.kind === 'signed')) fail('RC/REL has no signed artifact');
  verifyAbiEvidence(loaded.directory, loaded.manifest, verified);
  return { ...loaded, artifacts: verified };
}

const BUNDLE_LOOKUP_UNAVAILABLE = 'error: failed to get information and the parameters may be wrong.';

function bundleListConfirmsAbsence(output) {
  const lines = output.trim().split(/\r?\n/).map(line => line.trim());
  if (!/^ID: [0-9]+:$/.test(lines[0] ?? '')) return false;
  const bundles = lines.filter(line => !/^ID: [0-9]+:$/.test(line));
  return bundles.length > 0 &&
    bundles.every(line => /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(line)) &&
    !bundles.includes(BUNDLE_NAME);
}

export function parseBundleMetadata(output, bundleListOutput = '') {
  if (/^error: bundle \[io\.reader\.minliny\] not found\.?$/i.test(output.trim()) ||
      (output.trim() === BUNDLE_LOOKUP_UNAVAILABLE && bundleListConfirmsAbsence(bundleListOutput))) {
    return { bundlePresent: false, bundleName: '' };
  }
  let data;
  try {
    data = JSON.parse(output.slice(output.indexOf('{')));
  } catch {
    fail('installed bundle metadata is unavailable; absence is not established');
  }
  const app = data.applicationInfo;
  if (data.name !== BUNDLE_NAME && data.bundleName !== BUNDLE_NAME && app?.bundleName !== BUNDLE_NAME) {
    fail('installed bundle metadata has an unexpected identity');
  }
  if (!app || typeof app.appProvisionType !== 'string') fail('installed bundle signing metadata is incomplete');
  const identityHash = value => typeof value === 'string' && value ? sha256Bytes(value) : '';
  return {
    bundlePresent: true,
    bundleName: BUNDLE_NAME,
    versionName: data.versionName,
    versionCode: data.versionCode,
    ...(installedAppIdentity(data) ? { appVersion: installedAppIdentity(data) } : {}),
    appSignType: app.appSignType,
    appProvisionType: app.appProvisionType.toLowerCase(),
    cpuAbi: app.cpuAbi,
    appIdSha256: identityHash(data.appId),
    appIdentifierSha256: identityHash(data.appIdentifier),
    ...(Number.isSafeInteger(app.uid) && app.uid > 0 ? { uid: app.uid } : {}),
    ...(Number.isSafeInteger(data.updateTime) && data.updateTime > 0 ? { updateTime: data.updateTime } : {}),
  };
}

export function deploymentSigningRoute({ targetKind, installed, artifact }) {
  if (!['vm', 'physical'].includes(targetKind)) return { allowed: false, reason: 'invalid-target-kind' };
  if (targetKind === 'physical' && artifact.signature.status !== 'signed') {
    return { allowed: false, reason: 'physical-device-requires-signed-hap' };
  }
  if (!installed.bundlePresent) {
    if (artifact.signature.status === 'signed' && artifact.signature.verified === true) {
      return { allowed: true, reason: 'bundle-absent-install-candidate', preservesData: true };
    }
    return { allowed: false, reason: 'artifact-not-admitted' };
  }
  if (artifact.signature.status !== 'signed') {
    return { allowed: false, reason: 'installed-bundle-rejects-unsigned-preserve-data-route' };
  }
  if (artifact.signature.verified !== true) return { allowed: false, reason: 'signature-not-verified' };
  if (!installed.appProvisionType || artifact.signature.profileType === 'unknown' ||
      installed.appProvisionType !== artifact.signature.profileType) {
    return { allowed: false, reason: 'provision-lineage-unresolved' };
  }
  const matches = name => Boolean(installed[name]) && installed[name] === artifact.signature[name];
  if (!matches('appIdSha256') && !matches('appIdentifierSha256')) {
    return { allowed: false, reason: 'application-signing-identity-unresolved-or-mismatched' };
  }
  return { allowed: true, reason: 'matching-identity-signed-update-candidate', preservesData: true };
}

export function deploymentRoute({ targetKind, installed, artifact, storageEvidence, candidateAbi }) {
  const signature = deploymentSigningRoute({ targetKind, installed, artifact });
  if (!signature.allowed || !installed.bundlePresent) return signature;
  if (!['x86_64', 'arm64-v8a'].includes(candidateAbi)) return { allowed: false, reason: 'candidate-abi-unresolved' };
  if (installed.cpuAbi !== candidateAbi) return { allowed: false, reason: 'target-candidate-abi-unresolved-or-mismatched' };
  if (!Number.isSafeInteger(installed.uid) || installed.uid <= 0) return { allowed: false, reason: 'installed-uid-unresolved' };
  const storage = storageUpdateRoute({ ...(storageEvidence ?? {}),
    candidateNativeSha256: artifact.embeddedCoreNapi?.sha256, candidateHapSha256: artifact.sha256 });
  return storage.allowed ? { ...signature, reason: storage.reason } : storage;
}

function hdcBinary() {
  return resolveHarmonyTool('hdc', { cwd: REPO_ROOT });
}

function targetReference(target) {
  return sha256Bytes(target).slice(0, 12);
}

function assertTargetConnected(hdc, target, serverKey) {
  const output = runTargetHdc(hdc, target, serverKey, ['list', 'targets', '-v']).stdout ?? '';
  const state = parseTargetState(output, target);
  if (state !== 'connected') {
    fail(`The exact HDC target is not connected on server ${serverKey} (state: ${state}). Refresh the target on that server with reader-hdc-lease.mjs list targets -v.`);
  }
}

// Read-only readiness gate before a real install. It reports and stops only:
// it never starts, kills, retargets, changes ports or rewrites proxies, and
// every HDC call inside the preflight still routes through the lease wrapper.
// The preflight adds the attribution layer assertTargetConnected lacks (server
// reachability, listener ownership, stale foreground ledger) so a failure is
// pinned to the right layer instead of "target not connected". Set
// READER_HDC_PREFLIGHT=off for a deliberate one-off bypass.
export function assertHdcPreflight(hdc, target, serverKey, runner = run) {
  if (process.env.READER_HDC_PREFLIGHT === 'off') return;
  const result = runner(process.execPath, [HDC_PREFLIGHT_SCRIPT,
    '--hdc', hdc, '--target', target, '--server-key', serverKey, '--json'],
    { allowFailure: true, timeoutMs: 120_000 });
  if (result.status === 0) return;
  let report;
  try { report = JSON.parse(result.stdout); } catch { report = undefined; }
  const notable = (report?.steps ?? []).filter((step) => step.severity === 'block' || step.severity === 'warn');
  const detail = notable.length
    ? notable.map((step) => `${step.id}: ${step.detail}`).join('; ')
    : `${result.stderr ?? result.stdout ?? `exit ${result.status}`}`.trim();
  const next = report?.next?.length ? ` Next: ${report.next.join(' | ')}` : '';
  fail(`HDC preflight ${report?.result ?? 'FAILED'} before install: ${detail}.${next}`, 3);
}

function installedMetadata(hdc, target, serverKey, settings = {}) {
  const result = runTargetHdc(hdc, target, serverKey, ['-t', target, 'shell', `bm dump -n ${BUNDLE_NAME}`], { ...settings, allowFailure: true });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // Harmony's generic lookup error also covers missing bundles. Require a
  // successful, structurally valid inventory before admitting a new install.
  if (result.status === 0 && output.trim() === BUNDLE_LOOKUP_UNAVAILABLE) {
    const listing = runTargetHdc(hdc, target, serverKey, ['-t', target, 'shell', 'bm dump -a'], { ...settings, allowFailure: true });
    if (listing.status === 0 && !listing.stderr?.trim()) {
      return parseBundleMetadata(output, listing.stdout ?? '');
    }
  }
  return parseBundleMetadata(output);
}

export async function observeInstalledHapIdentity(options) {
  const targetKind = requiredOption(options, '--target-kind');
  const target = requiredOption(options, '--target');
  const route = resolveHdcServer({ targetKind, vmLocation: option(options, '--vm-location'),
    configuredServer: process.env.READER_HDC_SERVER_KEY });
  const vmLog = option(options, '--vm-log');
  if (route.vmLocation === 'local' && !vmLog) fail('Local VM verification requires its current emulator log (--vm-log)', 2);
  return withDeploymentHdcSession(options, () => {
    const hdc = hdcBinary();
    const settings = { timeoutMs: 10000, maxBuffer: 1024 * 1024 };
    assertTargetConnected(hdc, target, route.serverKey);
    const readiness = targetReadiness({ targetKind, targetEndpoint: target, vmLog, query: command =>
      readinessQueryOutput(command, runTargetHdc(hdc, target, route.serverKey, ['-t', target, 'shell', command],
        { ...settings, allowFailure: true })) });
    return { targetKind, targetRef: targetReference(target), ...hdcRouteEvidence(route), readiness,
      installed: installedMetadata(hdc, target, route.serverKey, settings) };
  }, { preflight: true });
}

export function storageTransitionCandidate(verified, artifact) {
  const matches = [];
  for (const record of verified.manifest.nativeProvenanceInputs ?? []) {
    const path = resolve(verified.directory, record.path), current = fileRecord(path, record.path);
    if (current.sha256 !== record.sha256 || current.bytes !== record.bytes) fail('Native provenance changed before storage transition');
    const provenance = JSON.parse(readFileSync(path, 'utf8'));
    if (provenance.hap?.sha256 === artifact.sha256 && provenance.abi === verified.manifest.abi) matches.push(provenance);
  }
  if (matches.length !== 1) fail('storage transition requires exactly one matching native provenance');
  const provenance = matches[0], identity = provenance.core?.buildIdentity;
  if (identity?.schemaVersion !== 1 || !identity.storageCompatibility ||
      JSON.stringify(identity.storageCompatibility) !== JSON.stringify(artifact.embeddedCoreNapi.storageCompatibility)) {
    fail('candidate storage declaration and compiled Core provenance disagree');
  }
  // A new proof cannot upgrade an old controller's package contract.
  const controller = JSON.parse(readFileSync(resolve(verified.directory, 'controller-snapshot.json'), 'utf8'));
  for (const path of [...HAP_PIPELINE_INPUTS, 'scripts/lib/hap-storage-admission.mjs']) {
    const recorded = controller.files.find(file => file.path === path), current = fileRecord(resolve(REPO_ROOT, path), path);
    if (!recorded || recorded.sha256 !== current.sha256 || recorded.bytes !== current.bytes) fail('storage transition controller is not the candidate controller');
  }
  return { runId: verified.manifest.runId, manifestSha256: fileRecord(verified.path).sha256,
    hapSha256: artifact.sha256, nativeSha256: artifact.embeddedCoreNapi.sha256, abi: verified.manifest.abi,
    coreBuildId: identity.buildId, coreInputFingerprint: provenance.core.buildInputFingerprint,
    protocolSha256: identity.protocolSha256, storageCompatibility: identity.storageCompatibility,
    controllerFingerprint: verified.manifest.gates.controllerInputs.fingerprint,
    coreInputSnapshotSha256: provenance.core.buildInputSnapshot.sha256,
    coreInputSnapshotBytes: provenance.core.buildInputSnapshot.bytes };
}

function resolveDeployment(options, mode = 'inspect') {
  if (options.has('--storage-transition')) fail('Deployment requires live storage admission using the matching Inspector', 3);
  const target = requiredOption(options, '--target');
  const targetKind = requiredOption(options, '--target-kind');
  const artifactKind = requiredOption(options, '--artifact');
  if (!['vm', 'physical'].includes(targetKind)) fail('--target-kind must be vm or physical', 2);
  if (artifactKind !== 'signed') fail('Preserve-data deployment requires a signed artifact', 2);
  const hdcRoute = resolveHdcServer({ targetKind, vmLocation: option(options, '--vm-location'),
    configuredServer: process.env.READER_HDC_SERVER_KEY });
  const vmLog = options.has('--vm-log') ? requiredOption(options, '--vm-log') : undefined;
  if (hdcRoute.vmLocation === 'local' && !vmLog) {
    fail('Local VM deployment requires the current instance emulator log (--vm-log). ' +
      'For a remote VM, select --target-kind vm --vm-location remote to use guest-only readiness when host logs are unavailable.', 2);
  }
  const verified = verifyManifest(requiredOption(options, '--manifest'));
  const candidateAbi = verified.manifest.abi ?? 'arm64-v8a';
  const artifact = verified.artifacts.find(candidate => candidate.kind === artifactKind);
  if (!artifact?.storageCapability) fail('Deployment candidate has no verified storage capability companion', 3);
  const artifactPath = resolve(verified.directory, artifact.path);
  const hdc = hdcBinary();
  assertTargetConnected(hdc, target, hdcRoute.serverKey);
  const runHdc = (args, settings = {}) => runTargetHdc(hdc, target, hdcRoute.serverKey, args, settings);
  const query = (command, settings = {}) => runHdc(['-t', target, 'shell', command], settings);
  const observeReadiness = () => targetReadiness({ targetKind, targetEndpoint: target, vmLog,
    query: command => readinessQueryOutput(command,
      query(command, { timeoutMs: 10000, maxBuffer: 1024 * 1024, allowFailure: true })) });
  const observeInstalled = () => installedMetadata(hdc, target, hdcRoute.serverKey);
  const readiness = observeReadiness();
  const installed = observeInstalled();
  let route = deploymentSigningRoute({ targetKind, installed, artifact });
  if (route.allowed && installed.bundlePresent) {
    if (!Number.isSafeInteger(installed.uid) || installed.uid <= 0 || installed.cpuAbi !== candidateAbi) {
      route = { allowed: false, reason: 'installed-abi-or-uid-does-not-match-candidate' };
    } else if (verified.manifest.expectedVersion &&
        (!Number.isSafeInteger(installed.versionCode) || installed.versionCode > verified.manifest.expectedVersion.versionCode)) {
      route = { allowed: false, reason: 'app-version-code-would-regress-or-is-unavailable' };
    }
  }
  let storageAdmission;
  if (route.allowed) {
    try {
      storageAdmission = collectStorageAdmission({ mode, target, targetKind, serverKey: hdcRoute.serverKey,
        bundleName: BUNDLE_NAME, bootIdSha256: readiness.bootIdSha256, initialReadiness: readiness, installed,
        installedIdentitySha256: installedStorageIdentity(installed), candidate: artifact.storageCapability,
        runDirectory: verified.directory, query, runHdc, observeInstalled, observeReadiness,
      }, collectStorageDeviceEvidence);
      if (mode === 'install' && !storageAdmissionAllowed(storageAdmission, { targetKind, installed, artifact })) {
        route = { allowed: false, reason: 'live-storage-admission-does-not-match-the-candidate' };
      } else if (storageAdmission.migration) {
        route = { allowed: false, reason: 'application-storage-migration-requires-separate-scope' };
      }
    } catch (error) {
      route = { allowed: false, reason: error.message };
    }
  }
  return { verified, artifact, artifactPath, candidateAbi, hdc, hdcRoute, target, targetKind,
    targetRef: targetReference(target), installed, route, readiness, storageAdmission };
}

export function inspectDeployment(options) {
  const resolved = resolveDeployment(options);
  try {
    const observed = resolved.storageAdmission?.status === 'OBSERVED';
    console.log(JSON.stringify({
      status: observed ? 'OBSERVED' : 'STOP',
      runId: resolved.verified.manifest.runId,
      targetKind: resolved.targetKind,
      ...hdcRouteEvidence(resolved.hdcRoute),
      targetRef: resolved.targetRef,
      artifact: { kind: resolved.artifact.kind, sha256: resolved.artifact.sha256, signature: resolved.artifact.signature },
      installed: resolved.installed,
      route: resolved.route,
      readiness: resolved.readiness,
      storageAdmission: resolved.storageAdmission ?? { status: 'STOP', reason: resolved.route.reason },
    }, null, 2));
    if (!observed) process.exitCode = 3;
  } finally {
    releaseStorageAdmission(resolved.storageAdmission);
  }
}

export function assertInstalledAppVersion(expected, installed) {
  if (!installed.bundlePresent || installed.versionName !== expected.versionName || installed.versionCode !== expected.versionCode) {
    fail('Installed system version does not match the manifest; stopped before launch without uninstalling');
  }
  assertAppVersion(expected, installed.appVersion, 'Installed bundle');
}

/** Run after replacement and before any launch, including --no-launch installs. */
export function assertInstalledDeploymentIdentity({ before, after, artifact, candidateAbi, expectedVersion, targetKind }) {
  const signature = deploymentSigningRoute({ targetKind, installed: after, artifact });
  if (!after.bundlePresent || !signature.allowed) fail('installed signing identity mismatch; stopped before launch without uninstalling', 3);
  if (!Number.isSafeInteger(after.uid) || after.uid <= 0 || (before.bundlePresent &&
      (!Number.isSafeInteger(before.uid) || before.uid <= 0 || after.uid !== before.uid))) {
    fail('installed UID is unavailable or was not preserved; stopped before launch without uninstalling', 3);
  }
  if (!['x86_64', 'arm64-v8a'].includes(candidateAbi) || after.cpuAbi !== candidateAbi) {
    fail('installed ABI is unavailable or mismatched; stopped before launch without uninstalling', 3);
  }
  if (expectedVersion) assertInstalledAppVersion(expectedVersion, after);
}

export function installDeployment(options) {
  const target = requiredOption(options, '--target');
  const targetKind = requiredOption(options, '--target-kind');
  const targetRef = targetReference(target);
  const lockDir = join(LOCK_ROOT, `reader-harmony-target-${targetRef}.lock`);
  acquireLock(lockDir, {
    pid: process.pid,
    targetKind,
    targetRef,
    startedAt: new Date().toISOString(),
  }, false);
  let storageAdmission;
  try {
    const resolved = resolveDeployment(options, 'install');
    storageAdmission = resolved.storageAdmission;
    if (!resolved.route.allowed) fail(`deployment stopped: ${resolved.route.reason}`, 3);
    // A successful install followed by a failed launch must still protect the
    // package. Keep this marker across errors/crashes until a full receipt exists.
    const installProtection = resolve(resolved.verified.directory,
      `retention-install-${resolved.targetKind}-${resolved.targetRef}.json`);
    writeJson(installProtection, { name: 'reader-hap-install-protection',
      runId: resolved.verified.manifest.runId, startedAt: new Date().toISOString() });
    const currentArtifact = fileRecord(resolved.artifactPath);
    if (currentArtifact.sha256 !== resolved.artifact.sha256 || currentArtifact.bytes !== resolved.artifact.bytes) {
      fail('candidate HAP changed after storage admission', 3);
    }
    const dataRecheck = revalidateStorageAdmission(storageAdmission);
    const install = runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey, [
      '-t', resolved.target, 'install', '-r', resolved.artifactPath,
    ], { allowFailure: true });
    const installOutput = `${install.stdout ?? ''}\n${install.stderr ?? ''}`;
    if (install.status !== 0 || !installOutput.includes('install bundle successfully')) {
      if (installOutput.includes('9568332')) fail('9568332 install sign info inconsistent; data was preserved', 3);
      if (installOutput.includes('9568320')) fail('9568320 no signature file; data was preserved', 3);
      fail(`HAP install failed while preserving data: ${installOutput.trim()}`, 3);
    }
    const postInstall = installedMetadata(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey);
    assertInstalledDeploymentIdentity({ before: resolved.installed, after: postInstall,
      artifact: resolved.artifact, candidateAbi: resolved.candidateAbi,
      expectedVersion: resolved.verified.manifest.expectedVersion, targetKind: resolved.targetKind });
    const storageCandidateBinding = recordInstalledStorageCandidate(storageAdmission, postInstall);
    let launch = 'NOT_RUN';
    if (options.get('--no-launch') !== true) {
      const start = runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey, [
        '-t', resolved.target, 'shell',
        `aa start -a EntryAbility -b ${BUNDLE_NAME} -m entry`,
      ], { allowFailure: true });
      const startOutput = `${start.stdout ?? ''}\n${start.stderr ?? ''}`;
      if (start.status !== 0 || !/start ability successfully/i.test(startOutput)) {
        fail(`HAP installed but launch failed: ${startOutput.trim()}`, 3);
      }
      launch = 'PASS';
    }
    const receipt = {
      schemaVersion: 1,
      name: 'reader-harmonyos-deployment-receipt',
      runId: resolved.verified.manifest.runId,
      ...(resolved.verified.manifest.expectedVersion ? { expectedVersion: resolved.verified.manifest.expectedVersion, appVersionCheck: 'PASS' } : { appVersionCheck: 'LEGACY_NOT_PRESENT' }),
      targetKind: resolved.targetKind,
      ...hdcRouteEvidence(resolved.hdcRoute),
      targetRef: resolved.targetRef,
      artifact: {
        kind: resolved.artifact.kind,
        sha256: resolved.artifact.sha256,
        signature: resolved.artifact.signature,
      },
      dataPolicy: 'preserve',
      readiness: resolved.readiness,
      storageAdmission,
      dataRecheck,
      storageCandidateBinding,
      install: 'PASS',
      launch,
      preInstall: resolved.installed,
      postInstall,
      completedAt: new Date().toISOString(),
      evidenceBoundary: {
        installAndLaunch: launch === 'PASS' ? 'PASS' : 'OPEN',
        featureInteraction: 'OPEN',
        userAcceptance: 'OPEN',
      },
    };
    const receiptPath = resolve(
      resolved.verified.directory,
      `deploy-${resolved.targetKind}-${resolved.targetRef}-${timestampId()}.json`,
    );
    writeJson(receiptPath, receipt);
    rmSync(installProtection);
    console.log(JSON.stringify({ status: 'PASS', receipt: receiptPath, dataPreserved: true }));
  } finally {
    releaseStorageAdmission(storageAdmission);
    rmSync(lockDir, { recursive: true, force: true });
  }
}
