#!/usr/bin/env node

import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertHarmonySdkEnvironment, harmonyBuildEnvironment, portableSpawnSync, resolveHarmonyTool } from './lib/harmony-toolchain.mjs';
import { assertPrivateFilePermissions } from './lib/private-file.cjs';
import { performance } from 'node:perf_hooks';
import { readSigningAuthority, assertSigningMaterialAuthority, assertSigningCertificateAuthority } from '../tools/reader-signing-authority.mjs';
import { assertBuildTools } from '../tools/reader-build-tools.mjs';
import { contentSnapshot, coreBuildSnapshot } from '../../Reader-Core/scripts/build-input-snapshot.mjs';
import { acquireBuildLease, acquireBuildWorkspace } from '../../Reader-Core/scripts/lib/build-resource-lock.mjs';
import { assertWorkspaceLayout } from '../../Reader-Core/scripts/lib/development-environment.mjs';
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, publishCoreGate, verifyPublishedCoreGate, targetReadiness } from './lib/hap-delivery-evidence.mjs';
import { hapStageReceipt } from './lib/hap-stage-receipt.mjs';
import { selectBundledSources } from '../tools/verify-bundled-test-book-sources-live.mjs';
import { contractTests, contractSelection, explicitContractTests, contractCaseSelection, MAX_CONTRACT_TIMEOUT_MS } from '../tools/run-contract-tests.mjs';
import { readContractView } from '../tools/lib/contract-registry.mjs';
import { canonicalServerKey, withHdcCommandSession, hdcDirectEnvironment } from '../tools/reader-hdc-lease.mjs';
import { publishStorageDeliveryContract, verifyStorageDeliveryContract, storageBootstrapIdentityBytes, STORAGE_BOOTSTRAP_RESOURCE } from './lib/storage-delivery-contract.mjs';
import { collectStorageAdmission, installedStorageIdentity, storageAdmissionAllowed, revalidateStorageAdmission,
  recordInstalledStorageCandidate, releaseStorageAdmission } from './lib/storage-deployment-admission.mjs';
import { collectStorageDeviceEvidence } from './lib/storage-device-evidence.mjs';
import { resetVmReaderData } from './lib/hap-vm-reset.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const WORKSPACE_ROOT = resolve(REPO_ROOT, '..');
const CORE_ROOT = resolve(WORKSPACE_ROOT, 'Reader-Core');
const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, '.reader-artifacts/hap');
const DEFAULT_RETAIN_RUNS = 10;
const LOCK_ROOT = resolve(process.env.READER_LOCK_DIR || tmpdir());
const DEFAULT_SIGNING_PROFILE = resolve(REPO_ROOT, '.reader-local/signing/build-profile.json5');
const HDC_LEASE_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-lease.mjs');
const HDC_PREFLIGHT_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-preflight.mjs');
const LOCAL_HDC_SERVER = '127.0.0.1:8710';
const REMOTE_VM_HDC_SERVER = '192.168.1.10:8710';
const BUNDLE_NAME = 'io.reader.minliny';
const EXPECTED_NATIVE_ENTRIES = [
  'libs/arm64-v8a/libc++_shared.so',
  'libs/arm64-v8a/libreader_bookturn_napi.so',
  'libs/arm64-v8a/libreader_core_napi.so',
];
const BUILD_INPUTS = [
  'AppScope',
  'entry/src',
  'entry/libs',
  'entry/vendor/core-harmony',
  'build-profile.json5',
  'entry/build-profile.json5',
  'hvigor-config.json5',
  'hvigor',
  'hvigorfile.ts',
  'oh-package.json5',
  'oh-package-lock.json5',
  'entry/hvigorfile.ts',
  'entry/oh-package.json5',
  'entry/oh-package-lock.json5',
];
const HARMONY_GATE_INPUTS = [
  'scripts/check-local.sh',
  'scripts/check-local.mjs',
  'scripts/lib',
  'scripts/hap-pipeline.mjs',
  'tools',
];
const CONTRACT_EVIDENCE_POLICY_INPUT = 'tools/hap-contract-evidence-policy.json';
const WORKSPACE_CONTRACT_INPUTS = [
  'Reader-Core/governance/workspace',
  'Reader-Core/scripts/sync-workspace.mjs',
  'Reader-Core/scripts/validate-workspace.py',
  'Reader-Core/scripts/lib',
  'Reader-Core/scripts/check-local.mjs',
  'README.md',
  'ARCHITECTURE.md',
  'HAP_BUILD_SYSTEM.md',
  'scripts/check-development.sh',
  'scripts/check-hap-build-system.mjs',
  '.agents/skills/reader-harmonyos-hap-pipeline',
  '.agents/skills/reader-cross-platform-delivery',
];

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fileRecord(path, publicPath = basename(path)) {
  const bytes = readFileSync(path);
  return {
    path: publicPath,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

let activeBuildAttempt;

export function run(binary, args, options = {}) {
  const started = performance.now();
  // Only commands whose diagnostics were already public/inherited are logged.
  // ZIP bytes and signer/CMS inspection may contain private material.
  const stage = options.stdio === 'inherit' ? activeBuildAttempt?.begin(binary, args) : undefined;
  const result = portableSpawnSync(binary, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: options.encoding !== undefined ? options.encoding : 'utf8',
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    stdio: activeBuildAttempt && options.stdio === 'inherit' ? 'pipe' : options.stdio ?? 'pipe',
    env: options.env ?? process.env,
    timeout: options.timeoutMs,
    killSignal: 'SIGKILL',
  });
  if (stage) {
    activeBuildAttempt.end(stage, result, Math.ceil(performance.now() - started));
    if (options.stdio === 'inherit') process.stdout.write(activeBuildAttempt.redact(`${result.stdout ?? ''}${result.stderr ?? ''}`));
  }
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    fail(`${binary} failed (${result.status}): ${stderr || stdout || '<no output>'}`);
  }
  return result;
}

function capture(binary, args, options = {}) {
  const result = run(binary, args, options);
  return typeof result.stdout === 'string' ? result.stdout.trim() : result.stdout;
}

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

async function withDeploymentHdcSession(options, action) {
  const targetKind = requiredOption(options, '--target-kind');
  const route = resolveHdcServer({ targetKind, vmLocation: option(options, '--vm-location'), configuredServer: process.env.READER_HDC_SERVER_KEY });
  return withHdcCommandSession({ hdc: hdcBinary(), target: requiredOption(options, '--target'), serverKey: route.serverKey }, session => {
    if (activeHdcSession) fail('nested HDC deployment session');
    activeHdcSession = session;
    try { return action(); } finally { activeHdcSession = undefined; }
  });
}

/** The location is explicit; an exact device target alone cannot identify its server. */
export function resolveHdcServer({ targetKind, vmLocation, configuredServer }) {
  if (!['vm', 'physical'].includes(targetKind)) throw new Error('invalid target kind for HDC routing');
  if (vmLocation !== undefined && (targetKind !== 'vm' || !['local', 'remote'].includes(vmLocation))) {
    throw new Error('--vm-location must be local or remote and applies only to a VM');
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
    throw new Error('configured HDC server conflicts with the selected device location');
  }
  return { serverKey, ...(location === undefined ? {} : { vmLocation: location }) };
}

export function hdcRouteEvidence(route) {
  return { hdcServer: route.serverKey, ...(route.vmLocation === undefined ? {} : { vmLocation: route.vmLocation }) };
}

function parseOptions(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (options.has(key)) fail(`duplicate argument: ${key}`, 2);
    if (key === '--live-sources' || key === '--no-launch' || key === '--apply') {
      options.set(key, true);
      continue;
    }
    if (!key.startsWith('--') || index + 1 >= argv.length || argv[index + 1].startsWith('--')) fail(`invalid argument: ${key}`, 2);
    options.set(key, argv[index + 1]);
    index += 1;
  }
  return options;
}

function option(options, key, fallback = undefined) {
  const value = options.get(key);
  return typeof value === 'string' ? value : fallback;
}

function requiredOption(options, key) {
  const value = option(options, key);
  if (value === undefined || value.length === 0) fail(`missing ${key}`, 2);
  return value;
}

function retentionLimit(options) {
  const value = option(options, '--keep-runs', process.env.READER_HAP_KEEP_RUNS ?? String(DEFAULT_RETAIN_RUNS));
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 100) fail('--keep-runs must be 1..100', 2);
  return Number(value);
}

function regularFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`retention refuses non-regular file: ${path}`);
  return stat;
}

function retentionJson(path) {
  if (regularFile(path).size > 16 * 1024 * 1024) fail(`retention metadata exceeds budget: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Pure inventory/decision; only manifest-owned HAP files can be selected. */
export function planHapRetention(root, keepRuns = DEFAULT_RETAIN_RUNS, reserve = 0) {
  root = resolve(root);
  if (!Number.isInteger(keepRuns) || keepRuns < 1 || keepRuns > 100 || ![0, 1].includes(reserve))
    fail('invalid HAP retention budget');
  const runs = [];
  const protectedRuns = new Map();
  const staleInstallMarkers = [];
  if (!existsSync(root)) return { root, keepRuns, reserve, retained: [], protected: [], staleInstallMarkers: [], remove: [], bytes: 0 };
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail('retention root must be a real directory');
  const pinsPath = resolve(root, 'retention-pins.json');
  const pins = existsSync(pinsPath) ? retentionJson(pinsPath) : { runIds: [] };
  if (!Array.isArray(pins.runIds) || pins.runIds.some(id => typeof id !== 'string' || basename(id) !== id || id.startsWith('.')))
    fail('invalid retention-pins.json runIds');
  for (const id of pins.runIds) protectedRuns.set(id, ['explicit-pin']);
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || name === 'retention-pins.json') continue;
    const directory = resolve(root, name);
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`unrecognized artifact-root entry: ${name}`);
    const manifest = retentionJson(resolve(directory, 'manifest.json'));
    if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' || manifest.runId !== name ||
        !Array.isArray(manifest.artifacts) || !Number.isFinite(Date.parse(manifest.finishedAt)))
      fail(`invalid retention manifest: ${name}`);
    const active = activeHapRun(directory);
    if (active) protectedRuns.set(name, [...(protectedRuns.get(name) ?? []), 'active-run']);
    const files = [];
    const names = new Set();
    for (const artifact of manifest.artifacts) {
      if (!/^entry-default-(signed|unsigned)\.hap$/.test(artifact.path) || names.has(artifact.path) ||
          !/^[a-f0-9]{64}$/.test(artifact.sha256)) fail(`invalid retention artifact: ${name}`);
      names.add(artifact.path);
      const path = resolve(directory, artifact.path);
      if (existsSync(path)) files.push({ path, bytes: regularFile(path).size, sha256: artifact.sha256 });
    }
    // Unknown packages must be resolved by the owner rather than silently ignored.
    for (const entry of readdirSync(directory)) {
      if (entry.endsWith('.hap') && !names.has(entry)) fail(`unowned HAP in run: ${name}/${entry}`);
      if (/^retention-install-.*\.json$/.test(entry)) {
        const pin = retentionJson(resolve(directory, entry));
        if (pin.name !== 'reader-hap-install-protection' || pin.runId !== name)
          fail(`invalid incomplete-install protection: ${name}/${entry}`);
        if (!active) staleInstallMarkers.push({ runId: name, file: entry,
          sha256: sha256Bytes(readFileSync(resolve(directory, entry))) });
      }
    }
    runs.push({ runId: name, time: Date.parse(manifest.finishedAt), files });
  }
  for (const id of pins.runIds) {
    if (!runs.some(run => run.runId === id && run.files.length > 0)) fail(`pinned recovery package is missing: ${id}`);
  }
  const available = runs.filter(run => run.files.length > 0);
  const protectedAvailable = available.filter(run => protectedRuns.has(run.runId));
  const protectedDetails = protectedAvailable.map(run => ({ runId: run.runId,
    reasons: protectedRuns.get(run.runId), bytes: run.files.reduce((sum, file) => sum + file.bytes, 0) }));
  if (protectedAvailable.length + reserve > keepRuns)
    fail(`HAP retention budget ${keepRuns} cannot fit ${protectedAvailable.length} protected runs plus ${reserve} new run; ` +
      `release ${protectedAvailable.length + reserve - keepRuns} slot(s): ${JSON.stringify(protectedDetails)}`);
  const retained = new Set(protectedAvailable.map(run => run.runId));
  for (const run of available.sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId))) {
    if (retained.size < keepRuns - reserve) retained.add(run.runId);
  }
  const remove = available.filter(run => !retained.has(run.runId));
  return { root, keepRuns, reserve, retained: [...retained], protected: protectedDetails, staleInstallMarkers, remove,
    bytes: remove.reduce((sum, run) => sum + run.files.reduce((total, file) => total + file.bytes, 0), 0) };
}

function hapRunLockPath(directory) {
  return join(LOCK_ROOT, `reader-harmony-hap-run-${sha256Bytes(realpathSync(directory))}.lock`);
}

function activeHapRun(directory) {
  const lock = hapRunLockPath(directory);
  if (!existsSync(lock)) return false;
  if (!lstatSync(lock).isDirectory() || lstatSync(lock).isSymbolicLink()) fail(`invalid run lock: ${lock}`);
  const owner = retentionJson(join(lock, 'owner.json'));
  // Our deletion locks do not turn the revalidated plan into a different plan.
  if (owner.pid === process.pid && owner.purpose === 'retention') return false;
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) fail(`invalid run lock owner: ${lock}`);
  return processExists(owner.pid);
}

/** Lock immutable runs before verification/install or deletion. */
export function withHapRunLock(directory, action, purpose = 'operation', publicationLocked = false) {
  const canonical = realpathSync(directory);
  const lock = hapRunLockPath(canonical);
  // All run-lock acquisition/reclamation is serialized by the artifact root.
  // A proven dead PID may now be reclaimed without two contenders deleting
  // each other's replacement. Missing/unknown/live owners still refuse.
  const acquire = () => acquireLock(lock, { pid: process.pid, directory: canonical, purpose,
    startedAt: new Date().toISOString(), protocol: 'hap-run-lock-v2' }, true);
  if (publicationLocked) acquire();
  else withHapPublicationLock(dirname(canonical), acquire);
  try { return action(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

function withHapPublicationLock(root, action) {
  if (existsSync(root) && (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()))
    fail('retention root must be a real directory');
  mkdirSync(root, { recursive: true });
  const canonical = realpathSync(root);
  const lock = join(LOCK_ROOT, `reader-harmony-hap-publication-${sha256Bytes(canonical)}.lock`);
  acquireLock(lock, { pid: process.pid, directory: canonical,
    startedAt: new Date().toISOString(), protocol: 'hap-publication-lock-v1' }, false);
  try { return action(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

function withHapRunLocks(directories, action, index = 0) {
  return index === directories.length ? action() :
    withHapRunLock(directories[index], () => withHapRunLocks(directories, action, index + 1), 'retention', true);
}

/** Recheck the inventory and every byte under the same locks used by install. */
export function applyHapRetention(plan) {
  return withHapPublicationLock(plan.root, () => applyHapRetentionUnderPublicationLock(plan));
}

function applyHapRetentionUnderPublicationLock(plan) {
  const directories = [...new Set([...plan.remove.map(run => run.runId),
    ...plan.staleInstallMarkers.map(marker => marker.runId)])].map(id => resolve(plan.root, id)).sort();
  return withHapRunLocks(directories, () => applyLockedHapRetention(plan));
}

function applyLockedHapRetention(plan) {
  // Verify every candidate before deleting any file. Never trust arbitrary paths
  // passed back by a caller or a stale dry-run plan.
  const current = planHapRetention(plan.root, plan.keepRuns, plan.reserve);
  if (JSON.stringify(current) !== JSON.stringify(plan)) fail('HAP retention inventory changed; retry planning');
  for (const run of current.remove) for (const file of run.files) {
    if (sha256Bytes(readFileSync(file.path)) !== file.sha256) fail(`retention artifact hash changed: ${file.path}`);
  }
  for (const marker of current.staleInstallMarkers) {
    const directory = resolve(current.root, marker.runId);
    const original = resolve(directory, marker.file);
    const archived = `resolved-${marker.file.slice(0, -5)}-${randomUUID()}.json`;
    renameSync(original, resolve(directory, archived));
    writeJson(resolve(directory, `${archived}.resolution.json`), {
      name: 'reader-hap-install-protection-resolution', runId: marker.runId,
      originalFile: marker.file, archivedFile: archived, sha256: marker.sha256,
      resolvedAt: new Date().toISOString(), reason: 'no-active-run-owner', installOutcome: 'UNKNOWN',
    });
  }
  for (const run of current.remove) {
    for (const file of run.files) rmSync(file.path);
    writeJson(resolve(current.root, run.runId, 'retention-receipt.json'), {
      schemaVersion: 1, name: 'reader-hap-retention-receipt', runId: run.runId,
      removedAt: new Date().toISOString(), keepRuns: current.keepRuns,
      artifacts: run.files.map(file => ({ path: basename(file.path), sha256: file.sha256, bytes: file.bytes })),
      packageAvailable: false, manifestAndEvidencePreserved: true,
    });
  }
  return { removedRuns: current.remove.map(run => run.runId), removedBytes: current.bytes,
    resolvedInstallMarkers: current.staleInstallMarkers.map(marker => ({ runId: marker.runId, file: marker.file })) };
}

/** Called only after complete package verification; no cleanup during compilation. */
export function publishRetainedHapRun(staging, destination, keepRuns) {
  const root = dirname(resolve(destination));
  if (dirname(resolve(staging)) !== root || !basename(staging).startsWith('.staging-'))
    fail('publication requires a staging sibling');
  return withHapPublicationLock(root, () => {
    if (!lstatSync(staging).isDirectory() || lstatSync(staging).isSymbolicLink())
      fail('publication staging must be a real directory');
    if (existsSync(destination)) fail(`artifact run already exists: ${destination}`);
    const candidate = retentionJson(join(staging, 'manifest.json'));
    if (candidate.runId !== basename(destination) || candidate.schemaVersion !== 2 ||
      candidate.name !== 'reader-harmonyos-hap-run' || !Number.isFinite(Date.parse(candidate.finishedAt)) ||
      !Array.isArray(candidate.artifacts) || !candidate.artifacts.length ||
      new Set(candidate.artifacts.map(artifact => artifact.path)).size !== candidate.artifacts.length)
      fail('invalid publication candidate');
    for (const artifact of candidate.artifacts) {
      if (!/^entry-default-(signed|unsigned)\.hap$/.test(artifact.path)) fail('invalid publication artifact');
      const file = join(staging, artifact.path); regularFile(file);
      if (sha256Bytes(readFileSync(file)) !== artifact.sha256) fail('publication artifact hash changed');
    }
    const retention = applyHapRetentionUnderPublicationLock(planHapRetention(root, keepRuns, 1));
    renameSync(staging, destination);
    return retention;
  });
}

function withArtifactLock(action) {
  const lease = acquireBuildLease();
  try { return action(lease.env); } finally { lease.release(); }
}

function gitRecord(repo) {
  const commit = capture('git', ['-C', repo, 'rev-parse', 'HEAD']);
  const statusText = capture('git', [
    '-C', repo, 'status', '--porcelain=v1', '--untracked-files=normal',
  ]);
  return {
    repo,
    commit,
    dirty: statusText.length > 0,
    status: statusText.length > 0 ? statusText.split('\n') : [],
  };
}


function regularInputSnapshot(repo, inputs, label) {
  repo = resolve(repo);
  // Reject links before hashing/copying so a clean
  // tracked link cannot leave the real build input outside this snapshot.
  // contentSnapshot omits special nodes; inspect their types before any reads
  // so FIFOs, sockets and devices cannot be copied as unbound build inputs.
  const assertRegularInput = path => {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) fail(`${label} must not contain symbolic links`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) assertRegularInput(resolve(path, name));
    } else if (!stat.isFile()) {
      fail(`${label} must contain only regular files and directories`);
    }
  };
  for (const input of inputs) {
    for (let path = resolve(repo, input); ; path = dirname(path)) {
      const stat = lstatSync(path, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink()) fail(`${label} must not contain symbolic links`);
      if (path === repo) break;
    }
    assertRegularInput(resolve(repo, input));
  }
  const snapshot = contentSnapshot(repo, inputs);
  if (snapshot.files.some(file => file.type !== 'file')) {
    fail(`${label} must not contain symbolic links`);
  }
  return snapshot;
}

export function sourceSnapshot(repo = REPO_ROOT) {
  return regularInputSnapshot(repo, BUILD_INPUTS, 'Host build inputs');
}

export function controllerSnapshot(repo = REPO_ROOT) {
  return regularInputSnapshot(repo, HARMONY_GATE_INPUTS, 'Host controller inputs');
}

export function workspaceContractSnapshot(workspace = WORKSPACE_ROOT) {
  return regularInputSnapshot(workspace, WORKSPACE_CONTRACT_INPUTS, 'Workspace contract inputs');
}

export function contractToolchainLoaders(env = process.env) {
  const defaults = { ...env }; delete defaults.READER_ETS_LOADER_ROOT;
  return [...new Set([resolveHarmonyTool('etsLoader', { cwd: REPO_ROOT, env: defaults }),
    resolveHarmonyTool('etsLoader', { cwd: REPO_ROOT, env })].map(path => realpathSync(resolve(path))))];
}

export function contractToolchainSnapshot(loaderInputs) {
  // Some probes use the installed SDK directly; others honour a loader override.
  // Bind both implementations rather than claiming the default SDK ran them all.
  const loaders = [...new Set((loaderInputs ?? contractToolchainLoaders()).filter(Boolean).map(path => realpathSync(resolve(path))))];
  const inputs = [realpathSync(process.execPath)];
  for (const loader of loaders) {
    for (const name of ['main.js', 'package.json', 'lib', 'declarations', 'node_modules/typescript']) {
      const path = resolve(loader, name);
      if (!existsSync(path)) fail(`contract SDK input is missing: ${path}`);
    }
    // Checker/lowering also loads main.js, JSON/config files and sibling npm
    // packages. Bind the entire installed loader dependency tree, not a list
    // of entry modules that could miss a transitive require.
    inputs.push(loader);
    for (const name of ['api', 'component']) {
      const path = resolve(loader, '../..', name);
      if (existsSync(path)) inputs.push(path);
    }
  }
  // SDKs and Node can be on different Windows volumes. Snapshot each volume
  // independently rather than treating '/' and path.slice(1) as universal.
  const files = [...new Set(inputs)].flatMap(path => {
    const root = parse(path).root;
    return regularInputSnapshot(root, [relative(root, path)], 'Contract toolchain inputs').files
      .map(file => ({ ...file, path: resolve(root, file.path) }));
  }).sort((a, b) => a.path.localeCompare(b.path));
  return { schemaVersion: 1, inputs: [...new Set(inputs)], fileCount: files.length,
    fingerprint: sha256Bytes(files.map(file => `${JSON.stringify(file)}\n`).join('')), files };
}

export function assertResolvedCorePackage(sandboxRepo) {
  const modules = realpathSync(resolve(sandboxRepo, 'entry/oh_modules'));
  const installed = realpathSync(resolve(modules, '@reader/core-harmony'));
  // In a full Hvigor project OHPM hoists local packages to root/oh_modules;
  // standalone entry fixtures use entry/oh_modules. Both are freshly created
  // in this build sandbox, and neither may resolve into another checkout.
  const roots = [modules];
  const hoisted = resolve(sandboxRepo, 'oh_modules');
  if (existsSync(hoisted)) roots.push(realpathSync(hoisted));
  const sandbox = realpathSync(sandboxRepo);
  for (const root of roots) {
    const within = relative(sandbox, root);
    if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
      fail('resolved Core package escapes the isolated dependency directory');
    }
  }
  const contained = roots.some(root => {
    const within = relative(root, installed);
    return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within);
  });
  if (!contained) {
    fail('resolved Core package escapes the isolated dependency directory');
  }
  const vendor = contentSnapshot(resolve(sandboxRepo, 'entry/vendor/core-harmony'), ['.']);
  const resolvedPackage = contentSnapshot(installed, ['.']);
  if ([...vendor.files, ...resolvedPackage.files].some(file => file.type !== 'file')) {
    fail('resolved Core package must contain regular files, not unbound symlink targets');
  }
  assertSnapshotUnchanged(vendor, resolvedPackage, 'resolved Core package');
}

export function assertSnapshotUnchanged(before, after, label) {
  if (before.fingerprint !== after.fingerprint) {
    fail(`${label} changed during the HAP build: ${before.fingerprint} -> ${after.fingerprint}`);
  }
}

function assertGitRecordUnchanged(before, after, label) {
  if (before.commit !== after.commit || before.dirty !== after.dirty ||
      JSON.stringify(before.status) !== JSON.stringify(after.status)) {
    fail(`${label} Git identity changed during the HAP build`);
  }
}

export function copySourceSandbox(source, destination, sandboxRoot = tmpdir()) {
  const before = sourceSnapshot(source);
  destination = resolve(destination);
  sandboxRoot = resolve(sandboxRoot);
  const within = relative(sandboxRoot, destination);
  if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within)) {
    fail('sandbox destination must be inside its temporary root');
  }
  // Validate before copying can write through a destination link. The
  // caller owns sandboxRoot (fresh mkdtemp in builds); tmpdir's platform alias
  // is a trusted boundary rather than an arbitrary destination parent.
  for (let path = destination; path !== sandboxRoot; path = dirname(path)) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      fail('sandbox destination must contain real directories, not symbolic links');
    }
  }
  mkdirSync(destination, { recursive: true });
  const excludes = [
    '.git',
    '.reader-artifacts',
    '.reader-local',
    '.hvigor',
    '.idea',
    '.appanalyzer',
    '.claude',
    'build',
    'entry/build',
    'entry/.cxx',
    'node_modules',
    'oh_modules',
    'evidence',
  ];
  // Node's filesystem API preserves the same filtered sandbox without a
  // platform-specific rsync executable. Preserve excluded local outputs while
  // removing stale included entries, matching the former --delete contract.
  const excluded = path => {
    const local = relative(source, path).split(sep).join('/');
    return excludes.some(entry => entry.includes('/') ? local === entry || local.startsWith(`${entry}/`)
      : local.split('/').includes(entry));
  };
  const prune = (origin, target) => {
    if (excluded(origin)) return;
    const targetStat = lstatSync(target);
    const originStat = lstatSync(origin, { throwIfNoEntry: false });
    if (targetStat.isDirectory() && !targetStat.isSymbolicLink()) {
      for (const name of readdirSync(target)) prune(resolve(origin, name), resolve(target, name));
      if (!originStat?.isDirectory() && readdirSync(target).length === 0) rmSync(target, { recursive: true });
    } else if (!originStat || originStat.isDirectory() || targetStat.isSymbolicLink()) {
      rmSync(target, { force: true });
    }
  };
  for (const name of readdirSync(destination)) prune(resolve(source, name), resolve(destination, name));
  cpSync(source, destination, { recursive: true, force: true, preserveTimestamps: true, verbatimSymlinks: true,
    filter: path => !excluded(path) });
  assertSnapshotUnchanged(before, sourceSnapshot(source), 'source inputs during sandbox copy');
  assertSnapshotUnchanged(before, sourceSnapshot(destination), 'copied sandbox inputs');
}

// BMS appId uses i2d_PublicKey bytes, not SubjectPublicKeyInfo DER.
// See security_appverify GetPublickeyBase64 and BMS SetProvisionId.
export function profileIdentity(profile) {
  const info = profile['bundle-info'];
  if (info?.['bundle-name'] !== BUNDLE_NAME) fail('verified Profile bundle identity mismatch');
  const certificate = info['distribution-certificate'] || info['development-certificate'];
  if (typeof certificate !== 'string' || !certificate) fail('verified Profile has no application certificate');
  const cert = new X509Certificate(certificate);
  const key = cert.publicKey;
  let publicBytes;
  if (key.asymmetricKeyType === 'ec') {
    const jwk = key.export({ format: 'jwk' });
    publicBytes = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  } else if (key.asymmetricKeyType === 'rsa') {
    publicBytes = key.export({ type: 'pkcs1', format: 'der' });
  } else {
    fail('unsupported application certificate public key type');
  }
  const appIdentifier = info['app-identifier'];
  return {
    appIdSha256: sha256Bytes(`${BUNDLE_NAME}_${publicBytes.toString('base64')}`),
    appIdentifierSha256: typeof appIdentifier === 'string' && appIdentifier ? sha256Bytes(appIdentifier) : '',
    certificateSha256: sha256Bytes(cert.raw),
  };
}

function verifiedProfileIdentity(profilePath) {
  const bytes = readFileSync(profilePath);
  let decoded;
  if (bytes.toString('utf8').trimStart().startsWith('{')) {
    decoded = bytes.toString('utf8');
  } else {
    // The HAP verifier has already authenticated the embedded Profile. Decode
    // its CMS content without logging the certificate or other material.
    const result = run(resolveHarmonyTool('openssl'), ['cms', '-verify', '-noverify', '-inform', 'DER', '-in', profilePath],
      { allowFailure: true });
    if (result.status !== 0) fail('verified Profile identity could not be decoded');
    decoded = result.stdout;
  }
  try {
    return profileIdentity(JSON.parse(decoded));
  } catch {
    fail('verified Profile application identity is invalid');
  }
}

function verifySignature(hapPath) {
  const java = resolveHarmonyTool('java');
  const signTool = resolveHarmonyTool('signTool');
  const verifyRoot = mkdtempSync(join(tmpdir(), 'reader-hap-signature-'));
  try {
    const result = run(java, [
      '-jar', signTool, 'verify-app',
      '-inFile', hapPath,
      '-outCertChain', resolve(verifyRoot, 'cert-chain.cer'),
      '-outProfile', resolve(verifyRoot, 'profile.p7b'),
    ], { allowFailure: true });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (result.status === 0 && output.includes('verify-app success') &&
        output.includes('verify codesign success') && output.includes('Digest verify result: true')) {
      const profile = output.match(/profile type is:\s*([^\s]+)/i)?.[1]?.toLowerCase() ?? 'unknown';
      const identity = verifiedProfileIdentity(resolve(verifyRoot, 'profile.p7b'));
      assertSigningCertificateAuthority(identity.certificateSha256);
      return { status: 'signed', verified: true, profileType: profile, ...identity };
    }
    if (/signature not found|No Hap Signing Block/i.test(output)) {
      return { status: 'unsigned', verified: false, profileType: 'none' };
    }
    fail('HAP signature verification failed');
  } finally {
    rmSync(verifyRoot, { recursive: true, force: true });
  }
}

function archiveNames(hapPath) {
  return capture(resolveHarmonyTool('unzip'), ['-Z1', hapPath]).split(/\r?\n/).filter(Boolean);
}

function archiveEntryRecord(hapPath, entryPath) {
  const result = run(resolveHarmonyTool('unzip'), ['-p', hapPath, entryPath], { encoding: null });
  const bytes = result.stdout;
  if (!Buffer.isBuffer(bytes)) fail(`unable to read ${entryPath} from ${hapPath}`);
  return { path: entryPath, bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

export function inspectHap(hapPath, kind, publicPath = basename(hapPath), requiredResources) {
  const names = archiveNames(hapPath);
  const nativeEntries = names.filter((name) => name.startsWith('libs/')).sort();
  if (JSON.stringify(nativeEntries) !== JSON.stringify(EXPECTED_NATIVE_ENTRIES)) {
    fail(`unexpected native archive layout in ${hapPath}: ${JSON.stringify(nativeEntries)}`);
  }
  const signature = verifySignature(hapPath);
  if (kind === 'signed' && signature.status !== 'signed') fail(`${hapPath} is not signed`);
  if (kind === 'unsigned' && signature.status !== 'unsigned') fail(`${hapPath} is not unsigned`);
  if (requiredResources) verifyRequiredHapResources(requiredResources, names,
    entry => run(resolveHarmonyTool('unzip'), ['-p', hapPath, entry], { encoding: null }).stdout);
  return {
    kind,
    ...fileRecord(hapPath, publicPath),
    signature,
    nativeEntries,
    embeddedCoreNapi: archiveEntryRecord(hapPath, 'libs/arm64-v8a/libreader_core_napi.so'),
    ...(requiredResources ? { requiredResources } : {}),
  };
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
}

function acquireLock(lockDir, owner, reclaimStale = true) {
  mkdirSync(dirname(lockDir), { recursive: true });
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const ownerPath = resolve(lockDir, 'owner.json');
    let previous = null;
    try {
      previous = JSON.parse(readFileSync(ownerPath, 'utf8'));
    } catch (_) {
      fail(`lock exists without a readable owner: ${lockDir}`);
    }
    if (!Number.isInteger(previous.pid) || processExists(previous.pid)) {
      fail(`lock is busy: ${lockDir}`);
    }
    // Concurrent run/target users cannot safely delete a dead owner's lock:
    // a second contender could remove the first contender's replacement.
    if (!reclaimStale) fail(`stale lock requires coordinated recovery: ${lockDir}`);
    rmSync(lockDir, { recursive: true, force: true });
    mkdirSync(lockDir);
  }
  writeJson(resolve(lockDir, 'owner.json'), owner);
}

function requireCleanAcceptance(buildClass, harmonyGit, coreGit, signingMode) {
  if (buildClass !== 'acceptance') return;
  if (harmonyGit.dirty || coreGit.dirty) fail('acceptance build requires clean Harmony and Core worktrees');
  if (signingMode === 'unsigned') fail('acceptance build requires the local signed debug profile');
}

function validateLocalSigningProfile(path) {
  assertPrivateFilePermissions(path);
  const relativePath = relative(REPO_ROOT, path);
  if (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)) {
    const tracked = run('git', ['-C', REPO_ROOT, 'ls-files', '--error-unmatch', '--', relativePath], {
      allowFailure: true,
    });
    if (tracked.status === 0) fail(`local signing profile must not be tracked by Git: ${path}`);
  }
}

function parseBuildProfile(path) {
  // Use the JSON5 parser bundled with the official build tools, including
  // DevEco's comments/trailing commas; never echo parser excerpts of secrets.
  const plugin = resolveHarmonyTool('hvigorPlugin', { cwd: REPO_ROOT });
  try { return createRequire(plugin)('json5').parse(readFileSync(path, 'utf8')); }
  catch { fail('signing build profile could not be parsed; no secret content was logged'); }
}

export function composeSigningProfile(baseline, local) {
  const products = local?.app?.products;
  const defaults = Array.isArray(products) ? products.filter(item => item.name === 'default') : [];
  const name = defaults.length === 1 ? defaults[0].signingConfig : undefined;
  const configs = local?.app?.signingConfigs;
  const matches = Array.isArray(configs) ? configs.filter(item => item.name === name) : [];
  if (typeof name !== 'string' || !name || matches.length !== 1) {
    fail('default product must explicitly reference exactly one local signing configuration');
  }
  const material = matches[0].material;
  for (const field of ['certpath', 'profile', 'storeFile', 'keyAlias', 'keyPassword', 'storePassword']) {
    if (typeof material?.[field] !== 'string' || !material[field]) fail('local signing material is incomplete');
  }
  const result = structuredClone(baseline);
  const target = result?.app?.products?.filter(item => item.name === 'default');
  if (!target || target.length !== 1) fail('baseline must contain exactly one default product');
  // Local credentials must not silently replace current SDK, ABI or build options.
  result.app.signingConfigs = [structuredClone(matches[0])];
  target[0].signingConfig = name;
  return result;
}

export function resolveSigningMode(requested, profileExists) {
  if (requested === 'unsigned') return 'unsigned';
  if (!profileExists) fail('local signing profile is missing; automatic builds never fall back to unsigned');
  return 'local';
}

// DevEco development builds use the same private signer admission as the
// isolated pipeline. Credentials stay in memory; the tracked profile is never
// rewritten and IDE builds do not claim full-contract/acceptance evidence.
export function prepareIdeSigningProfile(baseline) {
  const localProfile = resolve(process.env.READER_HARMONY_SIGNING_PROFILE || DEFAULT_SIGNING_PROFILE);
  validateLocalSigningProfile(localProfile);
  const profile = composeSigningProfile(baseline, parseBuildProfile(localProfile));
  assertSigningMaterialAuthority(profile, verifiedProfileIdentity);
  const snapshot = { configuration: fileRecord(localProfile, 'local-signing-config'),
    material: signingMaterialSnapshot(profile) };
  return { profile, localProfile, snapshot };
}

export function assertIdeSigningUnchanged(session) {
  const actual = { configuration: fileRecord(session.localProfile, 'local-signing-config'),
    material: signingMaterialSnapshot(session.profile) };
  if (JSON.stringify(actual) !== JSON.stringify(session.snapshot)) {
    fail('Private signing inputs changed during the DevEco build; rebuild with the current signer.');
  }
}

export function verifyIdeSignedHap(path, session, env = process.env) {
  const lease = acquireBuildLease(env);
  try {
    assertIdeSigningUnchanged(session);
    const artifact = inspectHap(path, 'signed', basename(path), requiredHapResources(REPO_ROOT));
    if (artifact.signature.status !== 'signed' || artifact.signature.verified !== true) {
      fail('DevEco build did not produce a verified signed HAP.');
    }
    // Verification must never refresh Native after packaging: a late source
    // change or stale Hvigor output must fail against the actual embedded SO.
    checkNativeInputs(lease.env, path);
    return artifact;
  } finally { lease.release(); }
}

function passwordMaterialTree(directory, destination) {
  const records = [];
  function visit(path, output, label) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('linked password material');
    if (stat.isDirectory()) {
      if (output) mkdirSync(output, { recursive: true, mode: 0o700 });
      for (const name of readdirSync(path).filter(name => name !== '.DS_Store').sort()) {
        visit(resolve(path, name), output ? resolve(output, name) : undefined, `${label}/${name}`);
      }
    } else if (stat.isFile()) {
      const bytes = readFileSync(path);
      records.push({ label, bytes: bytes.length, sha256: sha256Bytes(bytes) });
      if (output) writeFileSync(output, bytes, { mode: 0o600, flag: 'wx' });
    } else throw new Error('invalid password material');
  }
  visit(directory, destination, '');
  if (!records.length) throw new Error('empty password material');
  return { fileCount: records.length, bytes: records.reduce((sum, item) => sum + item.bytes, 0),
    sha256: sha256Bytes(JSON.stringify(records)) };
}

function signingMaterialSnapshot(profile) {
  const material = profile.app.signingConfigs[0].material;
  const records = {};
  for (const field of ['certpath', 'profile', 'storeFile']) {
    try {
      if (!lstatSync(material[field]).isFile()) fail('invalid material');
      records[field] = fileRecord(material[field], field);
    } catch { fail('signing material must reference readable regular files; paths were not logged'); }
  }
  try { records.passwordMaterial = passwordMaterialTree(resolve(dirname(material.storeFile), 'material')); }
  catch { fail('encrypted signing passwords require the matching private material directory beside the keystore'); }
  return records;
}

export function freezeSigningMaterial(profile, directory) {
  const result = structuredClone(profile);
  const material = result.app.signingConfigs[0].material;
  const before = signingMaterialSnapshot(result);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const frozen = mkdtempSync(join(directory, 'material-'));
  try {
    passwordMaterialTree(resolve(dirname(material.storeFile), 'material'), resolve(frozen, 'material'));
    for (const field of ['certpath', 'profile', 'storeFile']) {
      const destination = resolve(frozen, { certpath: 'certificate.cer', profile: 'profile.p7b', storeFile: 'keystore.p12' }[field]);
      copyFileSync(material[field], destination);
      chmodSync(destination, 0o600);
      if (fileRecord(destination, field).sha256 !== before[field].sha256) fail('signing material changed while being copied');
      material[field] = destination;
    }
    if (JSON.stringify(signingMaterialSnapshot(result)) !== JSON.stringify(before)) fail('signing material changed while being copied');
    return result;
  } catch {
    rmSync(frozen, { recursive: true, force: true });
    fail('could not freeze signing material; the active local profile was not changed');
  }
}

function syncSigning(options) {
  const source = resolve(option(options, '--profile', process.env.READER_HARMONY_SIGNING_PROFILE || DEFAULT_SIGNING_PROFILE));
  const destination = resolve(process.env.READER_HARMONY_SIGNING_PROFILE || DEFAULT_SIGNING_PROFILE);
  validateLocalSigningProfile(source);
  if (existsSync(destination)) validateLocalSigningProfile(destination);
  const before = fileRecord(source, 'signing-config').sha256;
  const composed = composeSigningProfile(parseBuildProfile(resolve(REPO_ROOT, 'build-profile.json5')), parseBuildProfile(source));
  assertSigningMaterialAuthority(composed, verifiedProfileIdentity);
  // Keep an independent copy, so a later DevEco auto-generation cannot replace
  // the keystore underneath this configuration's matching password fields.
  const frozen = freezeSigningMaterial(composed, resolve(dirname(destination), 'materials'));
  if (before !== fileRecord(source, 'signing-config').sha256) fail('signing configuration changed during synchronization');
  const staged = `${destination}.${randomUUID()}.tmp`;
  try {
    writeFileSync(staged, JSON.stringify(frozen, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(staged, destination);
  } finally { if (existsSync(staged)) rmSync(staged); }
  console.log(JSON.stringify({ status: 'PASS', action: 'local-signing-material-frozen',
    configurationSha256: fileRecord(destination, 'signing-config').sha256,
    material: signingMaterialSnapshot(frozen), privateKeyChanged: false, buildVerification: 'REQUIRED' }));
}

function findBuiltHaps(outputDir, signingMode) {
  const names = readdirSync(outputDir).filter((name) => name.endsWith('.hap')).sort();
  const allowed = ['entry-default-signed.hap', 'entry-default-unsigned.hap'];
  if (names.some((name) => !allowed.includes(name))) {
    fail(`isolated output contains non-canonical HAPs: ${names.join(', ')}`);
  }
  if (!names.includes('entry-default-unsigned.hap')) fail('isolated build did not produce the unsigned HAP');
  if (signingMode === 'local' && !names.includes('entry-default-signed.hap')) {
    fail('local signing was requested but the signed HAP was not produced');
  }
  return names;
}

export function nativeInputPaths(coreRoot = CORE_ROOT, env = process.env) {
  // Cargo resolves relative target directories from the Core producer's cwd,
  // not from the Harmony checkout or the pipeline invocation directory.
  const base = resolve(coreRoot, env.CARGO_TARGET_DIR || 'target', 'harmony-napi/arm64-v8a');
  return {
    identity: resolve(base, 'core-build-identity.json'),
    inputSnapshot: resolve(base, 'core-input-snapshot.json'),
    packageManifest: resolve(base, 'harmony-package-manifest.sha256'),
    buildEvidence: resolve(base, 'harmony-napi-build-evidence.txt'),
    nativeSo: resolve(base, 'package/libs/arm64-v8a/libreader_core_napi.so'),
    storageContract: resolve(base, 'package/storage-contract.v1.json'),
  };
}

export function requireAcceptanceInputs(coreRoot = CORE_ROOT, env = process.env) {
  const inputs = nativeInputPaths(coreRoot, env);
  for (const [label, path] of Object.entries(inputs)) {
    if (!existsSync(path)) fail(`acceptance input missing (${label}): ${path}`);
  }
  return inputs;
}

function nativeProvenanceArguments(env = process.env) {
  const inputs = requireAcceptanceInputs(CORE_ROOT, env);
  return [
    '--core-repo', CORE_ROOT, '--harmony-repo', REPO_ROOT,
    '--core-identity', inputs.identity, '--core-input-snapshot', inputs.inputSnapshot,
    '--napi-manifest', inputs.packageManifest, '--native-so', inputs.nativeSo,
    '--app-native-so', resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
    '--harmony-vendor', resolve(REPO_ROOT, 'entry/vendor/core-harmony'),
    '--storage-bootstrap-identity', resolve(REPO_ROOT, 'entry/src/main/resources/rawfile', STORAGE_BOOTSTRAP_RESOURCE),
    '--core-build-evidence', inputs.buildEvidence,
  ];
}

function checkNativeInputs(env, hap) {
  const directory = mkdtempSync(join(tmpdir(), 'reader-ide-native-'));
  try {
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...nativeProvenanceArguments(env), '--allow-dirty',
      ...(hap ? ['--hap', hap, '--native-strip-tool', resolveHarmonyTool('objcopy', { env })] : ['--preflight']),
      '--output', resolve(directory, 'preflight.json')], { env });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function prepareIdeNativeInputs({ check, rebuild, synchronize }) {
  try { return check(); } catch (error) {
    const diagnostic = error instanceof Error ? error.message : '';
    const rebuildRequired = error?.code === 'READER_IDE_NATIVE_PACKAGE_MISSING' ||
      /(?:^|\n)Error: (?:Core build identity does not match the Core worktree used for the manifest|Core build inputs changed; rebuild the Native\/SDK package)(?:\r?\n|$)/.test(diagnostic);
    const syncRequired = error?.code === 'READER_IDE_NATIVE_HOST_MISSING' ||
      /(?:^|\n)Error: Harmony (?:app native input does not match the NAPI package native library|vendored SDK does not match the NAPI package manifest)(?:\r?\n|$)/.test(diagnostic);
    // Corruption, skipped smoke, unsafe file types and unknown errors remain
    // hard failures. Only explicit missing/stale generated inputs are repaired.
    if (!rebuildRequired && !syncRequired) throw error;
    if (rebuildRequired) rebuild();
    synchronize();
    return check();
  }
}

export function ideNativeBuildEnvironment(env = process.env) {
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') || 'PATH';
  const search = (env[pathKey] || '').split(delimiter).filter(Boolean);
  // GUI applications need not inherit a login shell. Respect its configured
  // commands first, then the standard Cargo/Bun user installation locations.
  for (const path of [dirname(process.execPath),
    resolve(env.CARGO_HOME || join(homedir(), '.cargo'), 'bin'),
    resolve(env.BUN_INSTALL || join(homedir(), '.bun'), 'bin')]) {
    if (!search.includes(path)) search.push(path);
  }
  return { ...env, [pathKey]: search.join(delimiter), READER_NODE: env.READER_NODE || env.NODE || process.execPath };
}

export function assertIdeSdkEnvironment(env = process.env) {
  assertHarmonySdkEnvironment({ env, cwd: REPO_ROOT });
}

export function ideNativeInputState(corePaths, appNativePath, sdkPath) {
  let missing = false;
  for (const path of corePaths) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isFile()) fail('Native build input must be a regular file; refusing automatic refresh');
    if (!stat) missing = true;
  }
  const hostNative = lstatSync(appNativePath, { throwIfNoEntry: false });
  const hostSdk = lstatSync(sdkPath, { throwIfNoEntry: false });
  if ((hostNative && !hostNative.isFile()) || (hostSdk && !hostSdk.isDirectory())) {
    fail('Host Native/SDK inputs must be a regular file and real directory; refusing automatic refresh');
  }
  return missing ? 'rebuild' : (!hostNative || !hostSdk ? 'synchronize' : 'current');
}

export function preflightIdeNative(env = process.env) {
  assertWorkspaceLayout(WORKSPACE_ROOT);
  const lease = acquireBuildLease(env);
  const buildEnv = ideNativeBuildEnvironment(lease.env);
  try {
    return prepareIdeNativeInputs({
      check() {
        const state = ideNativeInputState(Object.values(nativeInputPaths(CORE_ROOT, buildEnv)),
          resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'), resolve(REPO_ROOT, 'entry/vendor/core-harmony'));
        if (state === 'rebuild') throw Object.assign(new Error('Reader DevEco Native package is missing'), { code: 'READER_IDE_NATIVE_PACKAGE_MISSING' });
        if (state === 'synchronize' || !existsSync(resolve(REPO_ROOT, 'entry/src/main/resources/rawfile', STORAGE_BOOTSTRAP_RESOURCE))) {
          throw Object.assign(new Error('Reader DevEco Native/SDK inputs are missing'), { code: 'READER_IDE_NATIVE_HOST_MISSING' });
        }
        return checkNativeInputs(buildEnv);
      },
      rebuild() {
        console.log('Reader DevEco: Core Native inputs changed; rebuilding the current local Core/SDK package.');
        run(buildEnv.READER_BASH || 'bash', [resolve(CORE_ROOT, 'scripts/build-harmony-napi.sh')], {
          cwd: CORE_ROOT, stdio: 'inherit', env: { ...buildEnv, READER_NATIVE_BUILD_LOCKED: '1' },
        });
      },
      synchronize() { syncNative(buildEnv); },
    });
  } finally { lease.release(); }
}

// Synchronize local build inputs through the same provenance checker used by
// HAP builds. Never download a binary or silently accept an older package.
function syncNative(env = process.env) {
  const inputs = requireAcceptanceInputs(CORE_ROOT, env);
  const packageRoot = resolve(dirname(inputs.packageManifest), 'package');
  const localRoot = resolve(REPO_ROOT, '.reader-local/native-sync');
  for (const path of [localRoot, resolve(REPO_ROOT, 'entry/vendor'), resolve(REPO_ROOT, 'entry/libs/arm64-v8a'), resolve(REPO_ROOT, 'entry/src/main/resources/rawfile')]) {
    for (let parent = path; parent !== REPO_ROOT; parent = dirname(parent)) {
      const stat = lstatSync(parent, { throwIfNoEntry: false });
      if (stat && !stat.isDirectory()) fail('Native synchronization parents must be real directories');
    }
  }
  mkdirSync(localRoot, { recursive: true });
  const stage = mkdtempSync(join(localRoot, 'sync-'));
  const stagedSdk = join(stage, 'sdk');
  const stagedNative = join(stage, 'libreader_core_napi.so');
  const stagedBootstrap = join(stage, STORAGE_BOOTSTRAP_RESOURCE);
  const sdk = resolve(REPO_ROOT, 'entry/vendor/core-harmony');
  const native = resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so');
  const bootstrap = resolve(REPO_ROOT, 'entry/src/main/resources/rawfile', STORAGE_BOOTSTRAP_RESOURCE);
  const sdkBackup = join(stage, 'previous-sdk');
  const nativeBackup = join(stage, 'previous-native.so');
  const bootstrapBackup = join(stage, 'previous-storage-bootstrap.json');
  let sdkMoved = false, nativeMoved = false, sdkInstalled = false, nativeInstalled = false, bootstrapMoved = false, bootstrapInstalled = false;
  try {
    if (!lstatSync(inputs.nativeSo).isFile()) fail('Native package must contain a regular SO');
    cpSync(packageRoot, stagedSdk, { recursive: true,
      filter: path => relative(packageRoot, path).split(sep)[0] !== 'libs' });
    copyFileSync(inputs.nativeSo, stagedNative);
    writeFileSync(stagedBootstrap, storageBootstrapIdentityBytes(JSON.parse(readFileSync(inputs.storageContract, 'utf8'))), { flag: 'wx', mode: 0o644 });
    const args = nativeProvenanceArguments(env);
    args[args.indexOf('--app-native-so') + 1] = stagedNative;
    args[args.indexOf('--harmony-vendor') + 1] = stagedSdk;
    args[args.indexOf('--storage-bootstrap-identity') + 1] = stagedBootstrap;
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...args, '--preflight', '--allow-dirty', '--output', join(stage, 'preflight.json')], { env });
    // The package contains SDK source/data, not executable tools. Some local
    // build filesystems add executable bits; do not propagate those into Git.
    for (const path of readdirSync(stagedSdk, { recursive: true })) {
      const entry = join(stagedSdk, path);
      if (lstatSync(entry).isFile()) chmodSync(entry, 0o644);
    }
    chmodSync(stagedNative, 0o644);
    // All source/package validation precedes mutation. Existing inputs are
    // retained privately, and a failed replacement restores both inputs.
    mkdirSync(dirname(native), { recursive: true });
    mkdirSync(dirname(sdk), { recursive: true });
    mkdirSync(dirname(bootstrap), { recursive: true });
    if (existsSync(sdk)) { renameSync(sdk, sdkBackup); sdkMoved = true; }
    if (existsSync(native)) { renameSync(native, nativeBackup); nativeMoved = true; }
    if (existsSync(bootstrap)) {
      if (!lstatSync(bootstrap).isFile()) fail('storage bootstrap expectation must be a regular file');
      renameSync(bootstrap, bootstrapBackup); bootstrapMoved = true;
    }
    renameSync(stagedSdk, sdk); sdkInstalled = true;
    renameSync(stagedNative, native); nativeInstalled = true;
    renameSync(stagedBootstrap, bootstrap); bootstrapInstalled = true;
    console.log(JSON.stringify({ status: 'PASS', operation: 'sync-native',
      nativeSha256: fileRecord(native).sha256, recovery: stage }));
  } catch (error) {
    if (bootstrapInstalled) rmSync(bootstrap);
    if (nativeInstalled) rmSync(native);
    if (sdkInstalled) rmSync(sdk, { recursive: true });
    if (nativeMoved) renameSync(nativeBackup, native);
    if (sdkMoved) renameSync(sdkBackup, sdk);
    if (bootstrapMoved) renameSync(bootstrapBackup, bootstrap);
    throw error;
  }
}

function generateAcceptanceProvenance(runDir, signedHap, hvigorVersion, buildCommand, buildClass) {
  const generator = resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs');
  const stripTool = resolveHarmonyTool('objcopy');
  const output = resolve(runDir, `${buildClass}-${basename(signedHap, '.hap')}-provenance.json`);
  run(process.execPath, [
    generator,
    ...nativeProvenanceArguments(),
    ...(buildClass === 'iteration' ? ['--allow-dirty'] : []),
    '--hap', signedHap,
    '--output', output,
    '--native-strip-tool', stripTool,
    '--build-command', buildCommand,
    '--hvigor-version', hvigorVersion,
    '--sdk-version', 'HarmonyOS 6.1.0(23)',
  ]);
  return basename(output);
}

export function buildContractScope(options, root = REPO_ROOT) {
  const allowed = ['--class', '--signing', '--live-sources', '--live-source-ids', '--keep-runs', '--artifact-root', '--contracts-scope', '--core-gate-receipt', '--rationale'];
  for (const key of options.keys()) if (!allowed.includes(key)) fail(`unknown build argument: ${key}`, 2);
  const buildClass = option(options, '--class', 'iteration');
  if (!['iteration', 'acceptance'].includes(buildClass)) fail('--class must be iteration or acceptance', 2);
  if (options.get('--live-sources') === true) fail('--live-sources no longer starts the whole collection. Use --live-source-ids with exact IDs and --rationale, or run the explicit all-source tool plan separately.', 2);
  if (options.has('--live-source-ids') && !option(options, '--rationale', '').trim()) fail('Selected live sources require --rationale.', 2);
  if (options.has('--live-source-ids')) selectBundledSources(JSON.parse(readFileSync(resolve(root, 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'), 'utf8')), requiredOption(options, '--live-source-ids').split(','));
  const requested = option(options, '--contracts-scope', 'none');
  if (!['none', 'full', 'manga-image-cache', 'search-return-runtime'].includes(requested)) {
    fail('--contracts-scope must be none, full, manga-image-cache, or search-return-runtime', 2);
  }
  const scope = requested === 'full' ? undefined : requested;
  if (scope !== 'none') {
    if (!option(options, '--rationale', '').trim()) fail('Contract execution requires --rationale after reviewing the necessary test items; full additionally requires an explicit user request.', 2);
    const selection = contractTests(root, 'full', scope);
    // Selection admission reads literal nested imports before any build lease
    // or dispatcher starts; invalid scope metadata must not leave a resource hold.
    explicitContractTests(root, selection.selected);
  }
  return scope;
}

export function remainingContractBudget(started, reserveMs = 0, deadlineMs = MAX_CONTRACT_TIMEOUT_MS) {
  const remaining = Math.floor(deadlineMs - (performance.now() - started) - reserveMs);
  if (remaining <= 0) fail('scope total deadline exceeded');
  return remaining;
}

export function admitBuildContractChecks(options, root = REPO_ROOT) {
  const scope=buildContractScope(options);
  if(scope!=='none') {
    const selection=contractTests(root,'full',scope);
    try { contractCaseSelection(root,selection.selected,{}); }
    catch(error) { throw new Error(`${error.message}. Use exact gate-index case IDs independently; HAP builds use --contracts-scope none. No build has started.`); }
  }
  return scope;
}
function build(options) {
  admitBuildContractChecks(options); // Reject unsupported broad selections before snapshots, signing or build work.
  activeBuildAttempt = hapStageReceipt(resolve(REPO_ROOT, '.reader-artifacts/hap-attempts'), {});
  try {
    activeBuildAttempt.bindInputs({ harmony: gitRecord(REPO_ROOT), core: gitRecord(CORE_ROOT), coreBuildInputs: coreBuildSnapshot(CORE_ROOT), source: sourceSnapshot(), controller: controllerSnapshot() });
    buildImpl(options); activeBuildAttempt.finish();
  }
  catch (error) { activeBuildAttempt.finish(error); error.message = activeBuildAttempt.redact(error.message); throw error; }
  finally { activeBuildAttempt = undefined; }
}

function buildImpl(options) {
  assertWorkspaceLayout(WORKSPACE_ROOT);
  const contractsScope = buildContractScope(options);
  const buildClass = option(options, '--class', 'iteration');
  if (!['iteration', 'acceptance'].includes(buildClass)) fail('--class must be iteration or acceptance', 2);
  const requestedSigning = option(options, '--signing', 'auto');
  if (!['auto', 'local', 'unsigned'].includes(requestedSigning)) {
    fail('--signing must be auto, local, or unsigned', 2);
  }
  if (requestedSigning !== 'unsigned') readSigningAuthority();
  const localProfile = resolve(process.env.READER_HARMONY_SIGNING_PROFILE || DEFAULT_SIGNING_PROFILE);
  const signingMode = resolveSigningMode(requestedSigning, existsSync(localProfile));
  if (signingMode === 'local' && !existsSync(localProfile)) {
    fail(`local signing profile is missing: ${localProfile}`);
  }
  let signingProfile;
  let signingBefore;
  if (signingMode === 'local') {
    validateLocalSigningProfile(localProfile);
    signingProfile = composeSigningProfile(parseBuildProfile(resolve(REPO_ROOT, 'build-profile.json5')),
      parseBuildProfile(localProfile));
    for (const config of signingProfile.app?.signingConfigs ?? []) activeBuildAttempt?.protect(config.material);
    assertSigningMaterialAuthority(signingProfile, verifiedProfileIdentity);
    signingBefore = { configuration: fileRecord(localProfile, 'local-signing-config'),
      material: signingMaterialSnapshot(signingProfile) };
  }

  const harmonyGit = gitRecord(REPO_ROOT);
  const coreGit = gitRecord(CORE_ROOT);
  requireCleanAcceptance(buildClass, harmonyGit, coreGit, signingMode);
  const coreGateFile = option(options, '--core-gate-receipt', process.env.READER_CORE_GATE_RECEIPT);
  if (buildClass === 'acceptance' && coreGateFile) currentCoreGate(coreGateFile, CORE_ROOT);
  const requiredResources = requiredHapResources(REPO_ROOT);

  const buildLease = acquireBuildWorkspace({ create: () => mkdtempSync(join(tmpdir(), 'reader-hap-build-')), remove: path => rmSync(path, { recursive: true, force: true }) });
  const sandboxRoot = buildLease.path;
  let unpublishedRunDir = null;
  let contractGateState = null;
  let contractsDispatched = false;
  try {
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...nativeProvenanceArguments(), '--preflight', '--output', resolve(sandboxRoot, 'native-preflight.json'),
      ...(buildClass === 'iteration' ? ['--allow-dirty'] : []),
    ]);
    const artifactRoot = resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT));
    const keepRuns = retentionLimit(options);
    // Retention runs only after the candidate passes compilation/signing/verification.
    const harmonyGateBefore = controllerSnapshot();
    const contractPolicy = JSON.parse(readFileSync(resolve(REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT), 'utf8'));
    if (contractPolicy.schemaVersion !== 2 || contractPolicy.name !== 'reader-harmony-contract-evidence-policy' ||
        contractPolicy.contractsReceiptRequired !== 'when-executed' || contractPolicy.defaultScope !== 'none' ||
        !controllerRequiresContractEvidence(harmonyGateBefore)) {
      fail('current HAP controller requires the contract evidence policy');
    }
    const workspaceContractBefore = workspaceContractSnapshot();
    const contractToolchainBefore = contractsScope === 'none' ? contentSnapshot(WORKSPACE_ROOT, []) : contractToolchainSnapshot();
    const sourceBefore = sourceSnapshot(REPO_ROOT);
    const sourceGitBefore = gitRecord(REPO_ROOT);
    const coreGitBefore = gitRecord(CORE_ROOT);
    if (sourceGitBefore.commit !== harmonyGit.commit || coreGitBefore.commit !== coreGit.commit) {
      fail('repository HEAD changed before the build snapshot was captured');
    }
    const contractsResultPath = resolve(sandboxRoot, 'contracts-results.json');
    let contractResults;
    if (contractsScope !== 'none') {
      const contractScopeBudget = contractTests(REPO_ROOT, 'full', contractsScope).scopePolicy?.timeoutMs;
      contractGateState = { started: performance.now(), scope: contractsScope ?? 'full' };
      const contractBudget = (reserveMs = 0) => remainingContractBudget(contractGateState.started, reserveMs, contractScopeBudget);
      console.log(JSON.stringify({ stage: 'harmonyContracts', event: 'start', scope: contractGateState.scope,
        rationale: option(options, '--rationale'), deadlineMs: contractScopeBudget ?? null, startedAt: new Date().toISOString() }));
      const contractEnvironment = { ...buildLease.env, READER_CONTRACT_RESULTS_FILE: contractsResultPath,
        READER_CONTRACT_TEST_TIMEOUT_MS: String(MAX_CONTRACT_TIMEOUT_MS) };
      if (contractsScope !== undefined) contractEnvironment.READER_CONTRACT_SCOPE_TIMEOUT_MS = String(contractBudget(2_000));
      contractsDispatched = true;
      run(process.execPath, ['tools/run-contract-tests.mjs', ...(contractsScope === undefined ? ['--full'] : ['--scope', contractsScope]),
        '--rationale', option(options, '--rationale')],
        { cwd: REPO_ROOT, stdio: 'inherit', env: contractEnvironment,
          timeoutMs: contractsScope === undefined ? undefined : contractBudget() });
      contractResults = JSON.parse(readFileSync(contractsResultPath, 'utf8'));
      assertSnapshotUnchanged(sourceBefore, sourceSnapshot(REPO_ROOT), 'source inputs during contracts');
      assertSnapshotUnchanged(harmonyGateBefore, controllerSnapshot(), 'Harmony controller inputs during contracts');
      assertSnapshotUnchanged(workspaceContractBefore, workspaceContractSnapshot(), 'workspace inputs during contracts');
      assertSnapshotUnchanged(contractToolchainBefore, contractToolchainSnapshot(), 'contract toolchain inputs during contracts');
      assertGitRecordUnchanged(sourceGitBefore, gitRecord(REPO_ROOT), 'Harmony source during contracts');
      assertGitRecordUnchanged(coreGitBefore, gitRecord(CORE_ROOT), 'Core source during contracts');
      contractResults.pipelineGateMilliseconds = Math.ceil(performance.now() - contractGateState.started);
      checkContractResults(contractResults, contractTests(REPO_ROOT, 'full', contractsScope), contractsScope);
      console.log(JSON.stringify({ stage: 'harmonyContracts', event: 'end', scope: contractGateState.scope,
        status: contractsScope === undefined ? 'PASS' : 'PARTIAL', selectedStatus: 'PASS',
        fullSuite: contractsScope === undefined ? 'PASS' : 'NOT_RUN', milliseconds: contractResults.pipelineGateMilliseconds }));
      contractGateState = null;
    } else {
      console.log(JSON.stringify({ stage: 'harmonyContracts', status: 'NOT_RUN', scope: 'none', fullSuite: 'NOT_RUN' }));
    }
    if (options.has('--live-source-ids')) {
      const liveStarted = performance.now();
      console.log(JSON.stringify({ stage: 'liveBookSources', event: 'start', deadlineMs: MAX_CONTRACT_TIMEOUT_MS }));
      try {
        run(process.execPath, ['tools/verify-bundled-test-book-sources-live.mjs', '--source-ids', requiredOption(options, '--live-source-ids'), '--rationale', requiredOption(options, '--rationale')], {
          cwd: REPO_ROOT, stdio: 'inherit', env: buildLease.env, timeoutMs: MAX_CONTRACT_TIMEOUT_MS,
        });
        console.log(JSON.stringify({ stage: 'liveBookSources', event: 'end', status: 'PASS', milliseconds: Math.ceil(performance.now() - liveStarted) }));
      } catch (error) {
        console.log(JSON.stringify({ stage: 'liveBookSources', event: 'end', status: 'FAIL', milliseconds: Math.ceil(performance.now() - liveStarted) }));
        throw error;
      }
    }

    const sandboxRepo = resolve(sandboxRoot, 'Reader-for-HarmonyOS');
    copySourceSandbox(REPO_ROOT, sandboxRepo, sandboxRoot);
    if (signingMode === 'local') {
      writeFileSync(resolve(sandboxRepo, 'build-profile.json5'), JSON.stringify(signingProfile, null, 2) + '\n');
      chmodSync(resolve(sandboxRepo, 'build-profile.json5'), 0o600);
    }
    const effectiveProfile = fileRecord(resolve(sandboxRepo, 'build-profile.json5'), 'build-profile.json5');
    const pipelineToken = randomUUID();
    writeFileSync(resolve(sandboxRepo, '.reader-pipeline-session.json'), JSON.stringify({
      token: pipelineToken, profileSha256: effectiveProfile.sha256,
    }), { mode: 0o600 });
    const sandboxBefore = sourceSnapshot(sandboxRepo);

    // Fresh worktrees have no generated oh_modules. Resolve the declared local
    // Core package inside this sandbox rather than inheriting a developer's
    // links (which may point into another checkout or contain stale SDK bytes).
    const ohpm = resolveHarmonyTool('ohpm', { cwd: REPO_ROOT });
    run(ohpm, ['install', '--no-link', '--cache', resolve(sandboxRoot, 'ohpm-cache')], {
      cwd: resolve(sandboxRepo, 'entry'),
      stdio: 'inherit',
    });
    assertSnapshotUnchanged(sandboxBefore, sourceSnapshot(sandboxRepo), 'dependency manifests and source inputs');
    assertResolvedCorePackage(sandboxRepo);

    const hvigorw = resolveHarmonyTool('hvigorw', { cwd: REPO_ROOT });
    const buildArgs = [
      'assembleHap', '--mode', 'module',
      '-p', 'product=default', '-p', 'module=entry@default', '-p', 'buildMode=debug',
      '--no-daemon', '--no-incremental',
    ];
    const buildCommand = `${hvigorw} ${buildArgs.join(' ')}`;
    const startedAt = new Date().toISOString();
    const hvigorUserHome = resolve(sandboxRoot, 'hvigor-user-home');
    const sharedHvigorTools = resolve(
      process.env.HVIGOR_SHARED_TOOLS || resolve(homedir(), '.hvigor/wrapper/tools'),
    );
    if (!existsSync(sharedHvigorTools)) {
      fail(`prepared Hvigor wrapper tools are missing: ${sharedHvigorTools}`);
    }
    const packageManager = assertBuildTools(sharedHvigorTools, { profile: buildClass === 'acceptance' ? 'release' : 'development' });
    const isolatedHvigorTools = resolve(hvigorUserHome, 'wrapper/tools');
    mkdirSync(isolatedHvigorTools, { recursive: true });
    cpSync(sharedHvigorTools, isolatedHvigorTools, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
    const buildEnvironment = {
      ...harmonyBuildEnvironment({ env: buildLease.env, cwd: REPO_ROOT }),
      HVIGOR_USER_HOME: hvigorUserHome,
      npm_config_cache: resolve(sandboxRoot, 'npm-cache'),
      READER_HAP_PIPELINE_ROOT: sandboxRepo,
      READER_HAP_PIPELINE_TOKEN: pipelineToken,
    };
    run(hvigorw, buildArgs, {
      cwd: sandboxRepo,
      stdio: 'inherit',
      env: buildEnvironment,
    });
    const finishedAt = new Date().toISOString();
    if (signingMode === 'local') {
      const signingAfter = { configuration: fileRecord(localProfile, 'local-signing-config'),
        material: signingMaterialSnapshot(signingProfile) };
      if (JSON.stringify(signingBefore) !== JSON.stringify(signingAfter)) {
        fail('signing configuration or material changed during build; sync the local profile before rebuilding');
      }
    }

    const sandboxAfter = sourceSnapshot(sandboxRepo);
    assertSnapshotUnchanged(sandboxBefore, sandboxAfter, 'isolated build inputs');
    assertResolvedCorePackage(sandboxRepo);
    const sourceAfter = sourceSnapshot(REPO_ROOT);
    assertSnapshotUnchanged(sourceBefore, sourceAfter, 'source worktree build inputs');
    assertSnapshotUnchanged(
      harmonyGateBefore,
      controllerSnapshot(),
      'Harmony build controller and gate inputs',
    );
    assertSnapshotUnchanged(
      workspaceContractBefore,
      workspaceContractSnapshot(),
      'workspace HAP contract and skill inputs',
    );
    assertGitRecordUnchanged(sourceGitBefore, gitRecord(REPO_ROOT), 'Harmony source worktree');
    assertGitRecordUnchanged(coreGitBefore, gitRecord(CORE_ROOT), 'Core source worktree');
    if (contractsScope !== 'none') assertSnapshotUnchanged(contractToolchainBefore, contractToolchainSnapshot(), 'contract toolchain inputs');

    const outputDir = resolve(sandboxRepo, 'entry/build/default/outputs/default');
    const builtNames = findBuiltHaps(outputDir, signingMode);
    const runId = `${timestampId()}-${sourceGitBefore.commit.slice(0, 8)}-${sourceBefore.fingerprint.slice(0, 8)}`;
    const publishedRunDir = resolve(artifactRoot, runId);
    const runDir = resolve(artifactRoot, `.staging-${runId}-${process.pid}`);
    if (existsSync(publishedRunDir) || existsSync(runDir)) {
      fail(`artifact run already exists: ${publishedRunDir}`);
    }
    mkdirSync(runDir, { recursive: true });
    unpublishedRunDir = runDir;

    const artifactPaths = [];
    for (const name of builtNames) {
      const destination = resolve(runDir, name);
      copyFileSync(resolve(outputDir, name), destination);
      artifactPaths.push(destination);
    }
    run(process.execPath, [
      resolve(REPO_ROOT, 'tools/verify-bundled-test-book-source-haps.mjs'),
      ...artifactPaths,
    ], { cwd: REPO_ROOT, stdio: 'inherit' });

    const artifacts = artifactPaths.map((path) => inspectHap(
      path,
      basename(path).endsWith('-signed.hap') ? 'signed' : 'unsigned',
      basename(path),
      requiredResources,
    ));
    if (buildClass === 'acceptance' && !artifacts.some((artifact) => artifact.kind === 'signed')) {
      fail('acceptance build did not produce a signed artifact');
    }

    writeJson(resolve(runDir, 'source-snapshot.json'), sourceBefore);
    writeJson(resolve(runDir, 'controller-snapshot.json'), harmonyGateBefore);
    writeJson(resolve(runDir, 'workspace-contract-snapshot.json'), workspaceContractBefore);
    writeJson(resolve(runDir, 'contract-toolchain-snapshot.json'), contractToolchainBefore);
    const contracts = contractsScope === 'none' ? publishUnrunContractEvidence(runDir) : publishContractEvidence(runDir, contractResults, contractsScope, {
      source: snapshotDescriptor(sourceBefore, 'source-snapshot.json'),
      controller: snapshotDescriptor(harmonyGateBefore, 'controller-snapshot.json'),
      workspace: snapshotDescriptor(workspaceContractBefore, 'workspace-contract-snapshot.json'),
      toolchain: snapshotDescriptor(contractToolchainBefore, 'contract-toolchain-snapshot.json'),
    });
    const hvigorVersion = capture(hvigorw, ['--version'], {
      cwd: sandboxRepo,
      env: buildEnvironment,
    });
    let acceptanceProvenance = null;
    const nativeProvenance = [];
    for (const artifact of artifacts) {
      const provenance = generateAcceptanceProvenance(
        runDir,
        resolve(runDir, artifact.path),
        hvigorVersion,
        buildCommand,
        buildClass,
      );
      nativeProvenance.push(provenance);
      artifact.storageContract = publishStorageDeliveryContract(runDir, artifact,
        JSON.parse(readFileSync(resolve(runDir, provenance), 'utf8')));
      if (buildClass === 'acceptance' && artifact.kind === 'signed') acceptanceProvenance = provenance;
    }
    const vendoredNapi = fileRecord(
      resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
      'entry/libs/arm64-v8a/libreader_core_napi.so',
    );
    const manifest = {
      schemaVersion: 2,
      deliveryEvidenceVersion: 1,
      storageEvidenceVersion: 1,
      name: 'reader-harmonyos-hap-run',
      nativeProvenance,
      runId,
      buildClass,
      acceptanceEligible: buildClass === 'acceptance' && contractsScope === undefined && Boolean(coreGateFile),
      startedAt,
      finishedAt,
      source: {
        harmony: sourceGitBefore,
        core: coreGitBefore,
        buildInputs: {
          fingerprint: sourceBefore.fingerprint,
          fileCount: sourceBefore.fileCount,
          snapshot: 'source-snapshot.json',
        },
        effectiveBuildProfile: {
          mode: signingMode,
          bytes: effectiveProfile.bytes,
          sha256: effectiveProfile.sha256,
          secretMaterialArchived: false,
        },
        vendoredCoreNapi: vendoredNapi,
      },
      gates: {
        coreDevelopment: buildClass === 'acceptance' && coreGateFile ? publishCoreGate(coreGateFile, runDir, CORE_ROOT) : { status: 'NOT_RUN' },
        requiredResourceBytes: 'PASS',
        harmonyContracts: contractsScope === 'none' ? 'NOT_RUN' : contractsScope === undefined ? 'PASS' : 'PARTIAL',
        contracts,
        contractToolchainInputs: snapshotDescriptor(contractToolchainBefore, 'contract-toolchain-snapshot.json'),
        controllerInputs: {
          fingerprint: harmonyGateBefore.fingerprint,
          fileCount: harmonyGateBefore.fileCount,
          snapshot: 'controller-snapshot.json',
        },
        workspaceContractInputs: {
          fingerprint: workspaceContractBefore.fingerprint,
          fileCount: workspaceContractBefore.fileCount,
          snapshot: 'workspace-contract-snapshot.json',
        },
        liveBookSources: options.has('--live-source-ids') ? 'PASS' : 'NOT_RUN',
        selectedLiveBookSourceIds: options.has('--live-source-ids') ? requiredOption(options, '--live-source-ids').split(',') : [],
        fullLiveBookSourceCollection: 'NOT_RUN',
        liveBookSourceEvidence: {
          transport: 'reader-cli/ureq',
          scope: 'Core CLI L1-L5 diagnostic',
          harmonyHostEquivalent: false,
          harmonyHostJourney: 'OPEN',
        },
        arktsTypeCheck: 'PASS',
        nonIncrementalBuild: 'PASS',
        bundledSourceBytes: 'PASS',
      },
      toolchain: {
        packageManager,
        hvigorw,
        hvigorVersion,
        buildCommand,
      },
      artifacts,
      acceptanceProvenance,
      evidenceBoundary: {
        packageBuild: 'PASS',
        vmInstall: 'OPEN',
        physicalInstall: 'OPEN',
        featureInteraction: 'OPEN',
        userAcceptance: 'OPEN',
      },
    };
    const manifestPath = resolve(runDir, 'manifest.json');
    writeJson(manifestPath, manifest);
    verifyManifest(manifestPath);
    const retention = publishRetainedHapRun(runDir, publishedRunDir, keepRuns);
    unpublishedRunDir = null;
    console.log(JSON.stringify({ stage: 'artifactRetention', keepRuns, ...retention }));
    console.log(JSON.stringify({
      status: 'PASS',
      runId,
      buildClass,
      contractsScope: contracts.scope,
      harmonyContracts: manifest.gates.harmonyContracts,
      selectedStatus: contracts.selectedStatus,
      fullSuite: contracts.fullSuite,
      manifest: resolve(publishedRunDir, 'manifest.json'),
      artifacts: artifacts.map(({ kind, path, sha256, signature }) => ({ kind, path, sha256, signature })),
    }));
  } finally {
    if (contractGateState !== null) console.log(JSON.stringify({ stage: 'harmonyContracts', event: 'end',
      scope: contractGateState.scope, status: 'FAIL', milliseconds: Math.ceil(performance.now() - contractGateState.started) }));
    try {
      if (unpublishedRunDir !== null) rmSync(unpublishedRunDir, { recursive: true, force: true });
    } finally { releaseContractBuildWorkspace(buildLease, resolve(sandboxRoot, 'contracts-results.json'), { dispatched: contractsDispatched }); }
  }
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

export function snapshotDescriptor(snapshot, name) {
  return { fingerprint: snapshot.fingerprint, fileCount: snapshot.fileCount, snapshot: name };
}

// A nested dispatcher cannot release its canonical parent's lease. Preserve
// that owner's lock and private sandbox if any owned process group is still
// live; an error must not admit the next build on top of surviving compilers.
export function releaseContractBuildWorkspace(lease, resultsPath, { dispatched = false } = {}) {
  if (dispatched && !existsSync(resultsPath)) {
    console.error(JSON.stringify({ stage: 'contractResourceHold', status: 'BLOCKED', results: resultsPath,
      reason: 'Dispatcher started without a final settlement receipt; build lease and sandbox retained' }));
    return false;
  }
  if (existsSync(resultsPath)) {
    const report = JSON.parse(readFileSync(resultsPath, 'utf8'));
    if (report.treeSettled === false || report.treeRecoveryBlocked === true) {
      console.error(JSON.stringify({ stage: 'contractResourceHold', status: 'BLOCKED', results: resultsPath,
        reason: 'Owned contract process groups have not settled; build lease and sandbox retained' }));
      return false;
    }
  }
  lease.release();
  return true;
}

function checkContractResults(report, selection, scope) {
  const scopeBudget = selection.scopePolicy?.timeoutMs ?? MAX_CONTRACT_TIMEOUT_MS;
  if (selection.scopePolicy?.layers && (report.failFast !== selection.scopePolicy.failFast || report.failureStopped !== false ||
      report.selectedStatus !== 'PASS' || report.harmonyContracts !== 'PARTIAL' || report.fullSuite !== 'NOT_RUN' || report.acceptanceEligible !== false ||
      JSON.stringify(report.evidenceLayers) !== JSON.stringify(selection.scopePolicy.layers))) fail('contract evidence scope policy is inconsistent');
  if (report.schemaVersion !== 1 || report.name !== 'reader-harmony-contract-results' || report.tier !== 'full' ||
      report.scope !== (scope ?? 'full') || !Number.isInteger(report.workers) || report.workers < 1 || report.workers > 4 ||
      !Number.isInteger(report.timeoutMs) || report.timeoutMs <= 0 || report.timeoutMs > MAX_CONTRACT_TIMEOUT_MS ||
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

function publishUnrunContractEvidence(runDir) {
  const inventory = readdirSync(resolve(REPO_ROOT, 'tools')).filter(name => /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  mkdirSync(resolve(runDir, 'contracts'), { recursive: true });
  const path = resolve(runDir, 'contracts/policy.json');
  copyFileSync(resolve(REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT), path);
  return { scope: 'none', selectedStatus: 'NOT_RUN', fullSuite: 'NOT_RUN', selected: [], omitted: inventory,
    inventoryCount: inventory.length, policy: fileRecord(path, 'contracts/policy.json') };
}

export function publishContractEvidence(runDir, report, scope, inputs, root = REPO_ROOT) {
  const selection = contractTests(root, 'full', scope);
  checkContractResults(report, selection, scope);
  const directory = resolve(runDir, 'contracts');
  mkdirSync(resolve(directory, 'logs'), { recursive: true });
  const selectionPath = resolve(directory, 'selection.json');
  const descriptorPath = resolve(root, 'tools/contract-test-tiers.json');
  const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'));
  let selectionInputs;
  if (descriptor.schemaVersion === 2) {
    // The schema-2 descriptor is pointer metadata for the registry. Publish the
    // materialized schema-1 tier view that contractSelection consumes, and bind
    // both source files so verification can prove which inputs were selected.
    const registryPath = resolve(root, 'tools', descriptor.registry);
    writeFileSync(selectionPath, `${JSON.stringify(readContractView(root, 'tiers'), null, 2)}\n`,
      { encoding: 'utf8', mode: 0o644 });
    selectionInputs = { descriptor: fileRecord(descriptorPath, 'tools/contract-test-tiers.json'),
      registry: fileRecord(registryPath, `tools/${descriptor.registry}`) };
  } else {
    copyFileSync(descriptorPath, selectionPath);
  }
  const results = report.results.map(row => {
    if (!lstatSync(row.log).isFile()) fail('contract log must be a regular file');
    const name = `contracts/logs/${row.name}.log`, path = resolve(runDir, name);
    copyFileSync(row.log, path);
    return { name: row.name, status: row.status, signal: row.signal, error: row.error ?? null,
      timedOut: row.timedOut, scopeTimedOut: row.scopeTimedOut, termination: row.termination, milliseconds: row.milliseconds,
      wallMilliseconds: row.wallMilliseconds,
      ...(row.treeSettled !== undefined ? { treeSettled: row.treeSettled, processGroupId: row.processGroupId,
        orphanDescendants: row.orphanDescendants, ownedProcessGroups: row.ownedProcessGroups,
        treeCapability: row.treeCapability, directChildSettled: row.directChildSettled } : {}), log: fileRecord(path, name) };
  });
  const receiptPath = resolve(directory, 'results.json');
  writeJson(receiptPath, { ...report, inputs, selection: fileRecord(selectionPath, 'contracts/selection.json'),
    ...(selectionInputs === undefined ? {} : { selectionInputs }), results });
  return { scope: scope ?? 'full', selectedStatus: 'PASS', fullSuite: scope === undefined ? 'PASS' : 'NOT_RUN',
    selected: selection.selected, omitted: selection.omitted, inventoryCount: selection.inventory.length,
    evidence: fileRecord(receiptPath, 'contracts/results.json') };
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
  if (report.selectionInputs === undefined) {
    if (!selectionRecord || selectionRecord.sha256 !== report.selection.sha256 || selectionRecord.bytes !== report.selection.bytes) {
      fail('contract selection does not match the tested controller snapshot');
    }
  } else {
    for (const [key, path] of [['descriptor', 'tools/contract-test-tiers.json'], ['registry', 'tools/contract-registry.json']]) {
      const expected = controller.files.find(file => file.path === path);
      const published = report.selectionInputs[key];
      if (!expected || published?.path !== path || expected.sha256 !== published.sha256 ||
          expected.bytes !== published.bytes) fail('contract selection inputs do not match the tested controller snapshot');
    }
    if (JSON.parse(readFileSync(selectionPath, 'utf8')).schemaVersion !== 1) {
      fail('contract selection must publish the materialized tier view');
    }
  }
  const discovered = controller.files.map(file => file.path).filter(path => /^tools\/test-.*\.mjs$/.test(path) &&
    !path.slice(6).includes('/') && !/-server\.mjs$/.test(path)).map(path => path.slice(6)).sort();
  const selection = contractSelection(JSON.parse(readFileSync(selectionPath, 'utf8')), discovered, 'full', scope);
  checkContractResults(report, selection, scope);
  if (contracts.inventoryCount !== selection.inventory.length || JSON.stringify(contracts.selected) !== JSON.stringify(selection.selected) ||
      JSON.stringify(contracts.omitted) !== JSON.stringify(selection.omitted)) fail('manifest contract selection mismatch');
  for (const row of report.results) verifiedContractFile(directory, row.log, `contracts/logs/${row.name}.log`);
}

function controllerRequiresContractEvidence(controller) {
  const policies = controller.files.filter(file => file.path === CONTRACT_EVIDENCE_POLICY_INPUT);
  if (policies.length === 0) {
    if (!controller.files.some(file => file.path === 'scripts/hap-pipeline.mjs' && file.type === 'file')) {
      fail('legacy contract controller identity is missing');
    }
    return false;
  }
  if (policies.length !== 1 || policies[0].type !== 'file' || !/^[0-9a-f]{64}$/.test(policies[0].sha256 ?? '') ||
      !Number.isInteger(policies[0].bytes) || policies[0].bytes <= 0) fail('contract controller policy identity is invalid');
  return true;
}

function verifySnapshotIdentity(directory, descriptor, expectedName, label) {
  if (descriptor?.snapshot !== expectedName) fail(`${label} snapshot path is invalid`);
  const snapshot = JSON.parse(readFileSync(resolve(directory, expectedName), 'utf8'));
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.files)) {
    fail(`${label} snapshot schema is invalid`);
  }
  const snapshotHash = createHash('sha256');
  for (const record of snapshot.files) {
    snapshotHash.update(JSON.stringify(record));
    snapshotHash.update('\n');
  }
  const computedFingerprint = snapshotHash.digest('hex');
  if (computedFingerprint !== snapshot.fingerprint ||
      snapshot.fingerprint !== descriptor.fingerprint ||
      snapshot.files.length !== descriptor.fileCount) {
    fail(`${label} snapshot identity mismatch`);
  }
  return snapshot;
}

function verifyManifest(path) {
  const loaded = loadManifest(path);
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
    if (loaded.manifest.gates.coreDevelopment?.status === 'NOT_RUN' && loaded.manifest.acceptanceEligible !== false) {
      fail('Unrun Core tests cannot claim acceptance eligibility.');
    }
    if (loaded.manifest.buildClass === 'acceptance' && loaded.manifest.gates.coreDevelopment?.status !== 'NOT_RUN') {
      const coreReceipt = verifyPublishedCoreGate(loaded.directory, loaded.manifest.gates.coreDevelopment);
      if (coreReceipt.inputs.gitCommit !== loaded.manifest.source.core.commit) fail('Core gate and acceptance source commit differ');
    }
  }
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
    const current = inspectHap(artifactPath, artifact.kind, artifact.path, artifact.requiredResources);
    if (current.sha256 !== artifact.sha256 || current.bytes !== artifact.bytes ||
        current.embeddedCoreNapi.sha256 !== artifact.embeddedCoreNapi.sha256) {
      fail(`manifest artifact identity mismatch: ${artifactPath}`);
    }
    if (loaded.manifest.storageEvidenceVersion === 1 && !artifact.storageContract) fail('Current manifest requires storage capability binding');
    current.storageContract = artifact.storageContract;
    current.storageCapability = verifyStorageDeliveryContract(loaded.directory, current, loaded.manifest.source.vendoredCoreNapi);
    verified.push(current);
  }
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
    appSignType: app.appSignType,
    appProvisionType: app.appProvisionType.toLowerCase(),
    cpuAbi: app.cpuAbi,
    appIdSha256: identityHash(data.appId),
    appIdentifierSha256: identityHash(data.appIdentifier),
  };
}

export function signingDeploymentRoute({ targetKind, installed, artifact }) {
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

export function deploymentRoute({ targetKind, installed, artifact, storageAdmission }) {
  const signing = signingDeploymentRoute({ targetKind, installed, artifact });
  if (!signing.allowed) return signing;
  if (!storageAdmissionAllowed(storageAdmission, { targetKind, installed, artifact })) {
    return { allowed: false, reason: 'verified-live-storage-admission-required', signing };
  }
  return { allowed: true, reason: 'signing-and-storage-admitted', preservesData: true, signing };
}

function hdcBinary() {
  return resolveHarmonyTool('hdc', { cwd: REPO_ROOT });
}

function targetReference(target) {
  return sha256Bytes(target).slice(0, 12);
}

function assertTargetConnected(hdc, target, serverKey) {
  const output = runTargetHdc(hdc, target, serverKey, ['list', 'targets', '-v']).stdout?.trim() ?? '';
  const match = output.split('\n').find((line) => line.split(/\s+/)[0] === target);
  if (match === undefined || !/Connected/i.test(match)) fail('the exact HDC target is not connected');
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

function installedMetadata(hdc, target, serverKey) {
  const result = runTargetHdc(hdc, target, serverKey, ['-t', target, 'shell', `bm dump -n ${BUNDLE_NAME}`], { allowFailure: true });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // Harmony's generic lookup error also covers missing bundles. Require a
  // successful, structurally valid inventory before admitting a new install.
  if (result.status === 0 && output.trim() === BUNDLE_LOOKUP_UNAVAILABLE) {
    const listing = runTargetHdc(hdc, target, serverKey, ['-t', target, 'shell', 'bm dump -a'], { allowFailure: true });
    if (listing.status === 0 && !listing.stderr?.trim()) {
      return parseBundleMetadata(output, listing.stdout ?? '');
    }
  }
  return parseBundleMetadata(output);
}

function resolveDeployment(options, mode = 'inspect') {
  const manifestPath = requiredOption(options, '--manifest');
  const artifactKind = requiredOption(options, '--artifact');
  if (!['signed', 'unsigned'].includes(artifactKind)) fail('--artifact must be signed or unsigned', 2);
  const target = requiredOption(options, '--target');
  const targetKind = requiredOption(options, '--target-kind');
  if (!['vm', 'physical'].includes(targetKind)) fail('--target-kind must be vm or physical', 2);
  const dataPolicy = option(options, '--data-policy', 'preserve');
  if (!['preserve', 'reset'].includes(dataPolicy)) fail('--data-policy must be preserve or reset', 2);
  if (dataPolicy === 'reset' && (mode !== 'install' || targetKind !== 'vm')) {
    fail('--data-policy reset is an explicit destructive VM install operation', 2);
  }
  const hdcRoute = resolveHdcServer({ targetKind, vmLocation: option(options, '--vm-location'),
    configuredServer: process.env.READER_HDC_SERVER_KEY });
  const verified = verifyManifest(manifestPath);
  const artifact = verified.artifacts.find((candidate) => candidate.kind === artifactKind);
  if (artifact === undefined) fail(`manifest does not contain a ${artifactKind} artifact`);
  const artifactPath = resolve(verified.directory, artifact.path);
  const hdc = hdcBinary();
  if (mode === 'install') assertHdcPreflight(hdc, target, hdcRoute.serverKey);
  assertTargetConnected(hdc, target, hdcRoute.serverKey);
  const readiness = targetReadiness({ targetKind, vmLog: option(options, '--vm-log'),
    query: command => runTargetHdc(hdc, target, hdcRoute.serverKey, ['-t', target, 'shell', command],
      { timeoutMs: 10_000, maxBuffer: 1024 * 1024 }).stdout?.trim() ?? '' });
  const installed = installedMetadata(hdc, target, hdcRoute.serverKey);
  const signing = signingDeploymentRoute({ targetKind, installed, artifact });
  let storageAdmission;
  let storageError;
  if (signing.allowed && dataPolicy === 'preserve') {
    try {
      storageAdmission = collectStorageAdmission({ mode, target, targetKind, serverKey: hdcRoute.serverKey,
        bundleName: BUNDLE_NAME, bootIdSha256: readiness.bootIdSha256, initialReadiness: readiness, installed,
        installedIdentitySha256: installedStorageIdentity(installed), candidate: artifact.storageCapability,
        runDirectory: verified.directory,
        query: (command, settings = {}) => runTargetHdc(hdc, target, hdcRoute.serverKey,
          ['-t', target, 'shell', command], settings),
        runHdc: (args, settings = {}) => runTargetHdc(hdc, target, hdcRoute.serverKey, args, settings),
        observeInstalled: () => installedMetadata(hdc, target, hdcRoute.serverKey),
        observeReadiness: () => targetReadiness({ targetKind, vmLog: option(options, '--vm-log'),
          query: command => runTargetHdc(hdc, target, hdcRoute.serverKey, ['-t', target, 'shell', command],
            { timeoutMs: 10_000, maxBuffer: 1024 * 1024 }).stdout?.trim() ?? '' }),
      }, collectStorageDeviceEvidence);
    } catch (error) { storageError = error.message; }
  }
  const route = dataPolicy === 'reset' ?
    (!signing.allowed ? signing : installed.bundlePresent && installed.bundleName === BUNDLE_NAME ?
      { allowed: true, reason: 'explicit-vm-reader-data-reset', preservesData: false, signing } :
      { allowed: false, reason: 'reset-requires-an-installed-reader-bundle' }) :
    deploymentRoute({ targetKind, installed, artifact, storageAdmission });
  return {
    verified,
    artifact,
    artifactPath,
    hdc,
    target,
    targetKind,
    dataPolicy,
    hdcRoute,
    targetRef: targetReference(target),
    installed,
    route,
    signing,
    storageAdmission,
    storageError,
    readiness,
  };
}

function inspectDeployment(options) {
  const resolved = resolveDeployment(options);
  try {
  console.log(JSON.stringify({
    status: resolved.signing.allowed && resolved.storageAdmission?.status === 'OBSERVED' ? 'OBSERVED' : 'STOP',
    runId: resolved.verified.manifest.runId,
    targetKind: resolved.targetKind,
    ...hdcRouteEvidence(resolved.hdcRoute),
    targetRef: resolved.targetRef,
    artifact: {
      kind: resolved.artifact.kind,
      sha256: resolved.artifact.sha256,
      signature: resolved.artifact.signature,
    },
    installed: resolved.installed,
    route: resolved.route,
    signing: resolved.signing,
    storageAdmission: resolved.storageAdmission ?? { status: 'STOP', reason: resolved.storageError ?? 'not-collected' },
    readiness: resolved.readiness,
  }, null, 2));
  if (!resolved.storageAdmission) process.exitCode = 3;
  } finally { releaseStorageAdmission(resolved.storageAdmission); }
}

function installDeployment(options) {
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
  let installProtection;
  let installOutcome = 'UNKNOWN';
  let storageAdmission;
  try {
    const resolved = resolveDeployment(options, 'install');
    storageAdmission = resolved.storageAdmission;
    if (!resolved.route.allowed) fail(`deployment stopped: ${resolved.storageError ?? resolved.route.reason}`, 3);
    // The run lock protects bytes for this operation. The marker is evidence,
    // not a permanent pin if installation fails or the process terminates.
    installProtection = resolve(resolved.verified.directory,
      `retention-install-${resolved.targetKind}-${resolved.targetRef}.json`);
    writeJson(installProtection, { name: 'reader-hap-install-protection',
      runId: resolved.verified.manifest.runId, pid: process.pid, startedAt: new Date().toISOString() });
    const currentArtifact = fileRecord(resolved.artifactPath);
    if (currentArtifact.sha256 !== resolved.artifact.sha256 || currentArtifact.bytes !== resolved.artifact.bytes) fail('candidate HAP changed after storage admission', 3);
    let dataReset;
    let dataResetReceipt;
    let dataRecheck;
    if (resolved.dataPolicy === 'reset') {
      dataResetReceipt = resolve(resolved.verified.directory, `data-reset-vm-${resolved.targetRef}-${timestampId()}.json`);
      const resetRecord = { name: 'reader-vm-data-reset-receipt', status: 'IN_PROGRESS', dataPolicy: 'reset',
        runId: resolved.verified.manifest.runId, targetRef: resolved.targetRef, ...hdcRouteEvidence(resolved.hdcRoute),
        bundleName: BUNDLE_NAME, artifactSha256: resolved.artifact.sha256, preInstall: resolved.installed,
        controllerSha256: fileRecord(SCRIPT_PATH).sha256,
        resetHelperSha256: fileRecord(resolve(REPO_ROOT, 'scripts/lib/hap-vm-reset.mjs')).sha256,
        startedAt: new Date().toISOString() };
      writeJson(dataResetReceipt, resetRecord);
      try {
        dataReset = resetVmReaderData({ targetKind: resolved.targetKind, installed: resolved.installed,
          artifact: resolved.artifact, readiness: resolved.readiness,
          observeReadiness: () => targetReadiness({ targetKind: resolved.targetKind, vmLog: option(options, '--vm-log'),
            query: command => runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey,
              ['-t', resolved.target, 'shell', command], { timeoutMs: 10000, maxBuffer: 1024 * 1024 }).stdout?.trim() ?? '' }),
          observeInstalled: () => installedMetadata(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey),
          query: command => {
            resetRecord.uninstallAttempted = true;
            writeJson(dataResetReceipt, resetRecord);
            const result = runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey,
              ['-t', resolved.target, 'shell', command], { timeoutMs: 30000, allowFailure: true });
            resetRecord.uninstallResult = { command, status: result.status, stdout: result.stdout, stderr: result.stderr };
            writeJson(dataResetReceipt, resetRecord);
            return result;
          },
        });
        Object.assign(resetRecord, { status: 'PASS', result: dataReset, completedAt: new Date().toISOString() });
        writeJson(dataResetReceipt, resetRecord);
      } catch (error) {
        Object.assign(resetRecord, { status: 'STOP', error: error.message, completedAt: new Date().toISOString() });
        writeJson(dataResetReceipt, resetRecord);
        throw error;
      }
      const afterResetArtifact = fileRecord(resolved.artifactPath);
      if (afterResetArtifact.sha256 !== resolved.artifact.sha256 || afterResetArtifact.bytes !== resolved.artifact.bytes) {
        fail('candidate HAP changed after explicit data reset; stopped before install', 3);
      }
      dataRecheck = { status: 'NOT_APPLICABLE', reason: 'explicit-user-authorized-vm-data-reset' };
    } else dataRecheck = revalidateStorageAdmission(storageAdmission);
    const install = runTargetHdc(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey, [
      '-t', resolved.target, 'install', ...(resolved.dataPolicy === 'preserve' ? ['-r'] : []), resolved.artifactPath,
    ], { allowFailure: true });
    const installOutput = `${install.stdout ?? ''}\n${install.stderr ?? ''}`;
    if (install.status !== 0 || !installOutput.includes('install bundle successfully')) {
      const dataState = resolved.dataPolicy === 'reset' ? 'Reader data was explicitly reset' : 'data was preserved';
      if (installOutput.includes('9568332')) fail(`9568332 install sign info inconsistent; ${dataState}`, 3);
      if (installOutput.includes('9568320')) fail(`9568320 no signature file; ${dataState}`, 3);
      fail(`HAP install failed (${dataState}): ${installOutput.trim()}`, 3);
    }
    installOutcome = 'PASS';
    const postInstall = installedMetadata(resolved.hdc, resolved.target, resolved.hdcRoute.serverKey);
    const installedRoute = signingDeploymentRoute({ targetKind: resolved.targetKind,
      installed: postInstall, artifact: resolved.artifact });
    if (!postInstall.bundlePresent || !installedRoute.allowed) {
      fail('HAP was installed but its reported signing identity does not match; stopped before launch without uninstalling', 3);
    }
    const storageCandidateBinding = resolved.dataPolicy === 'reset' ? null :
      recordInstalledStorageCandidate(storageAdmission, postInstall);
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
      targetKind: resolved.targetKind,
      ...hdcRouteEvidence(resolved.hdcRoute),
      targetRef: resolved.targetRef,
      artifact: {
        kind: resolved.artifact.kind,
        sha256: resolved.artifact.sha256,
        signature: resolved.artifact.signature,
      },
      dataPolicy: resolved.dataPolicy,
      ...(dataReset ? { dataReset, dataResetReceipt } : {}),
      storageAdmission: resolved.dataPolicy === 'reset' ?
        { status: 'NOT_APPLICABLE', reason: 'explicit-user-authorized-vm-data-reset' } : storageAdmission,
      dataRecheck,
      storageCandidateBinding,
      readiness: resolved.readiness,
      install: 'PASS',
      launch,
      preInstall: resolved.installed,
      postInstall,
      completedAt: new Date().toISOString(),
      evidenceBoundary: {
        installAndLaunch: launch === 'PASS' ? 'PASS' : 'OPEN',
        runtimeReady: 'OPEN',
        originalUserOperation: 'OPEN',
        featureInteraction: 'OPEN',
        userAcceptance: 'OPEN',
      },
    };
    const receiptPath = resolve(
      resolved.verified.directory,
      `deploy-${resolved.targetKind}-${resolved.targetRef}-${timestampId()}.json`,
    );
    writeJson(receiptPath, receipt);
    console.log(JSON.stringify({ status: 'PASS', receipt: receiptPath, dataPreserved: resolved.dataPolicy === 'preserve' }));
  } finally {
    try {
      releaseStorageAdmission(storageAdmission);
      if (installProtection && existsSync(installProtection)) {
        const archived = resolve(dirname(installProtection), `resolved-${basename(installProtection, '.json')}-${randomUUID()}.json`);
        renameSync(installProtection, archived);
        writeJson(`${archived}.resolution.json`, { name: 'reader-hap-install-protection-resolution',
          resolvedAt: new Date().toISOString(), reason: 'install-operation-ended', installOutcome });
      }
    } finally { rmSync(lockDir, { recursive: true, force: true }); }
  }
}

function usage() {
  console.error(`Usage:
  node scripts/hap-pipeline.mjs build [--class iteration|acceptance] [--contracts-scope none|full|manga-image-cache|search-return-runtime] [--rationale <reviewed-item-reasons>] [--signing auto|local|unsigned] [--live-source-ids <exact IDs> --rationale <necessity>] [--keep-runs 10] [--core-gate-receipt <receipt.json>]
  node scripts/hap-pipeline.mjs prune [--artifact-root <directory>] [--keep-runs 10] [--apply]
  node scripts/hap-pipeline.mjs sync-signing [--profile <private-local-profile.json5>]
  node scripts/hap-pipeline.mjs sync-native [sync-core alias]
  node scripts/hap-pipeline.mjs verify --manifest <manifest.json>
  node scripts/hap-pipeline.mjs inspect --manifest <manifest.json> --artifact signed|unsigned --target <exact> --target-kind vm|physical [--vm-location local|remote] [--vm-log <current-emulator.log>]
  node scripts/hap-pipeline.mjs install --manifest <manifest.json> --artifact signed|unsigned --target <exact> --target-kind vm|physical [--vm-location local|remote] [--vm-log <current-emulator.log>] [--no-launch] [--data-policy preserve|reset]`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  const options = parseOptions(process.argv.slice(3));
  if (command === 'build') build(options);
  else if (command === 'sync-signing') syncSigning(options);
  else if (command === 'sync-native' || command === 'sync-core') withArtifactLock(syncNative);
  else if (command === 'verify') {
    const verified = verifyManifest(requiredOption(options, '--manifest'));
    console.log(JSON.stringify({
      status: 'PASS',
      runId: verified.manifest.runId,
      contractsScope: verified.manifest.gates?.contracts?.scope,
      harmonyContracts: verified.manifest.gates?.harmonyContracts,
      selectedStatus: verified.manifest.gates?.contracts?.selectedStatus,
      fullSuite: verified.manifest.gates?.contracts?.fullSuite,
      artifacts: verified.artifacts.map(({ kind, path, sha256, signature }) => ({
        kind, path, sha256, signature,
      })),
    }));
  } else if (command === 'inspect') await withDeploymentHdcSession(options, () => inspectDeployment(options));
  else if (command === 'install') await withDeploymentHdcSession(options, () => withHapRunLock(dirname(resolve(requiredOption(options, '--manifest'))),
    () => installDeployment(options)));
  else if (command === 'prune') {
    const plan = planHapRetention(resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT)), retentionLimit(options));
    console.log(JSON.stringify(options.get('--apply') === true ? applyHapRetention(plan) : plan, null, 2));
  }
  else {
    usage();
    fail(`unknown command: ${command}`, 2);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  }
}
