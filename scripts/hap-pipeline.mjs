#!/usr/bin/env node

import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { withHapZip } from './lib/hap-zip-reader.mjs';
import { canOverlapHapSignature, startHapSignatureProcess } from './lib/hap-signature-process.mjs';
import { regularInputSnapshot, sameIdentity, snapshotFileRecords as snapshottedFiles,
  startRegularInputSnapshots, captureSealedInputSnapshot } from './lib/regular-input-snapshot.mjs';
import { generateBuildProvenance } from '../tools/generate-build-provenance-manifest.mjs';
import { createRequire } from 'node:module';
import {
  chmodSync,
  constants,
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
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool } from './lib/harmony-toolchain.mjs';
import { assertPrivateFilePermissions } from './lib/private-file.cjs';
import { performance } from 'node:perf_hooks';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { readSigningAuthority, assertSigningMaterialAuthority, assertSigningCertificateAuthority } from '../tools/reader-signing-authority.mjs';
import { assertBuildTools } from '../tools/reader-build-tools.mjs';
import { contentSnapshot, coreBuildSnapshot } from '../../Reader-Core/scripts/build-input-snapshot.mjs';
import { acquireBuildLease, acquireBuildWorkspace } from '../../Reader-Core/scripts/lib/build-resource-lock.mjs';
import { assertWorkspaceLayout } from '../../Reader-Core/scripts/lib/development-environment.mjs';
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, publishCoreGate, verifyPublishedCoreGate,
  publishVerifiedHapRun, readinessQueryOutput, targetReadiness } from './lib/hap-delivery-evidence.mjs';
import { embeddedStorageCompatibility, storageUpdateRoute } from './lib/hap-storage-admission.mjs';
import { publishStorageDeliveryContract, verifyStorageDeliveryContract, storageBootstrapIdentityBytes, STORAGE_BOOTSTRAP_RESOURCE } from './lib/storage-delivery-contract.mjs';
import { collectStorageAdmission, installedStorageIdentity, storageAdmissionAllowed, revalidateStorageAdmission,
  recordInstalledStorageCandidate, releaseStorageAdmission } from './lib/storage-deployment-admission.mjs';
import { collectStorageDeviceEvidence } from './lib/storage-device-evidence.mjs';
import { hapStageReceipt } from './lib/hap-stage-receipt.mjs';
import { APP_IDENTITY_SCHEMA, APP_RELEASE_LEDGER, createAppBuildIdentity, packagedAppVersion, assertAppVersion, installedAppIdentity } from './lib/app-build-identity.mjs';
import { prepareAppIdentity, assertAppIdentityUnchanged, verifyAppContentEvidence } from './lib/app-build-context.mjs';
import { selectBundledSources } from '../tools/verify-bundled-test-book-sources-live.mjs';
import { archivedContractSelection, HISTORICAL_CONTRACT_TIMEOUT_MS } from './lib/archived-hap-contract-selection.mjs';
import { canonicalServerKey, withHdcCommandSession, hdcDirectEnvironment, parseTargetState } from '../tools/reader-hdc-lease.mjs';
import { assertCleanMainline, latestSignedRun } from './lib/hap-mainline-provenance.mjs';

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

/** One explicit ABI follows the Native package through build and verification. */
export function resolveHarmonyAbi(value = 'arm64-v8a') {
  if (value !== 'arm64-v8a' && value !== 'x86_64') fail(`unsupported Harmony ABI: ${value}`, 2);
  return value;
}
const BUILD_INPUTS = [
  'AppScope',
  APP_RELEASE_LEDGER,
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
const DEPENDENCY_INPUTS = BUILD_INPUTS.filter(path => /(?:^|\/)oh-package(?:-lock)?\.json5$/.test(path) ||
  path === 'entry/vendor/core-harmony');
// Identity-generation/build code is an effective input, but the ledger's
// assigned version fields are deliberately outside the app content domain.
const APP_CONTENT_INPUTS = [...BUILD_INPUTS, 'scripts/hap-pipeline.mjs',
  'scripts/lib/app-build-identity.mjs', 'scripts/lib/app-build-context.mjs', 'scripts/lib/harmony-toolchain.mjs'];
const HARMONY_GATE_INPUTS = [
  'scripts/test-host.mjs',
  'scripts/reader-ts-module-loader.mjs',
  'scripts/vm-journeys.mjs',
  'scripts/check-hap-provenance.mjs',
  'tests',
  'scripts/lib',
  'scripts/hap-pipeline.mjs',
  'tools',
];
const LIVE_SOURCE_TIMEOUT_MS = 110_000;
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
let activeBuildTimings;

function measureBuildStep(label, action) {
  const timing = activeBuildTimings;
  if (!timing) return action();
  const parent = timing.parent;
  const key = parent ? `${parent}.${label}` : label;
  const started = performance.now();
  timing.parent = key;
  try {
    return action();
  } finally {
    timing.parent = parent;
    timing.steps.set(key, (timing.steps.get(key) ?? 0) + performance.now() - started);
  }
}

function buildTimingBreakdown() {
  return Object.fromEntries([...activeBuildTimings.steps].map(([key, milliseconds]) =>
    [key, Math.round(milliseconds * 100) / 100]));
}

function recordBuildElapsed(label, started) {
  const steps = activeBuildTimings?.steps;
  if (steps) steps.set(label, (steps.get(label) ?? 0) + performance.now() - started);
}

function finishBuildAttempt(error) {
  if (activeBuildTimings) activeBuildAttempt.report.timingBreakdownMs = buildTimingBreakdown();
  activeBuildAttempt.finish(error);
}

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

// The worker runs the existing synchronous command and reports the child's
// duration independently of synchronous probes on the main thread.
export async function prepareDuringNativePreflight(args, prepare, onNativeTiming) {
  const worker = new Worker(new URL(import.meta.url), { workerData: { hapNativePreflight: args } });
  const native = new Promise((resolveResult, reject) => {
    let result;
    let workerError;
    worker.once('message', message => { result = message; });
    worker.once('error', error => { workerError = error; });
    worker.once('exit', code => {
      if (workerError || code !== 0 || !result) {
        reject(workerError ?? new Error('Native preflight worker exited without a result (' + code + ')'));
      } else resolveResult(result);
    });
  });
  const [verification, prepared] = await Promise.allSettled([native, Promise.resolve().then(prepare)]);
  if (verification.status === 'rejected') throw verification.reason;
  const { milliseconds, error } = verification.value;
  onNativeTiming?.(milliseconds);
  if (error) throw Object.assign(new Error(error.message), error);
  if (prepared.status === 'rejected') throw prepared.reason;
  return prepared.value;
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

function parseOptions(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (options.has(key)) fail(`duplicate argument: ${key}`, 2);
    if (key === '--live-sources' || key === '--no-launch' || key === '--apply' || key === '--incremental') {
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
  const deployed = new Map();
  const protectedRuns = new Set();
  if (!existsSync(root)) return { root, keepRuns, reserve, retained: [], remove: [], bytes: 0 };
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail('retention root must be a real directory');
  const pinsPath = resolve(root, 'retention-pins.json');
  const pins = existsSync(pinsPath) ? retentionJson(pinsPath) : { runIds: [] };
  if (!Array.isArray(pins.runIds) || pins.runIds.some(id => typeof id !== 'string' || basename(id) !== id || id.startsWith('.')))
    fail('invalid retention-pins.json runIds');
  for (const id of pins.runIds) protectedRuns.add(id);
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || name === 'retention-pins.json') continue;
    const directory = resolve(root, name);
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`unrecognized artifact-root entry: ${name}`);
    const manifest = retentionJson(resolve(directory, 'manifest.json'));
    if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' || manifest.runId !== name ||
        !Array.isArray(manifest.artifacts) || !Number.isFinite(Date.parse(manifest.finishedAt)))
      fail(`invalid retention manifest: ${name}`);
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
        protectedRuns.add(name);
      }
      if (!/^deploy-.*\.json$/.test(entry)) continue;
      const receipt = retentionJson(resolve(directory, entry));
      if (receipt.name !== 'reader-harmonyos-deployment-receipt' || receipt.runId !== name ||
          receipt.install !== 'PASS' || !Number.isFinite(Date.parse(receipt.completedAt)) ||
          typeof receipt.targetRef !== 'string' || !['vm', 'physical'].includes(receipt.targetKind))
        fail(`invalid deployment receipt: ${name}/${entry}`);
      const target = `${receipt.targetKind}:${receipt.targetRef}`;
      const history = deployed.get(target) ?? [];
      history.push({ runId: name, time: Date.parse(receipt.completedAt) });
      deployed.set(target, history);
    }
    runs.push({ runId: name, time: Date.parse(manifest.finishedAt), files });
  }
  // The two newest distinct successful deployments per target are the current
  // and rollback candidates. A receipt is historical evidence, not live state.
  for (const history of deployed.values()) {
    const ids = [...new Set(history.sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId)).map(row => row.runId))];
    for (const id of ids.slice(0, 2)) protectedRuns.add(id);
  }
  for (const id of pins.runIds) {
    if (!runs.some(run => run.runId === id && run.files.length > 0)) fail(`pinned recovery package is missing: ${id}`);
  }
  const available = runs.filter(run => run.files.length > 0);
  const latestCandidate = [...available].sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId))[0];
  if (latestCandidate) protectedRuns.add(latestCandidate.runId);
  const protectedAvailable = available.filter(run => protectedRuns.has(run.runId));
  if (protectedAvailable.length + reserve > keepRuns)
    fail(`HAP retention budget ${keepRuns} cannot fit ${protectedAvailable.length} protected runs plus ${reserve} new run; review pins/deployment recovery or raise --keep-runs`);
  const retained = new Set(protectedAvailable.map(run => run.runId));
  for (const run of available.sort((a, b) => b.time - a.time || b.runId.localeCompare(a.runId))) {
    if (retained.size < keepRuns - reserve) retained.add(run.runId);
  }
  const remove = available.filter(run => !retained.has(run.runId));
  return { root, keepRuns, reserve, retained: [...retained], remove,
    bytes: remove.reduce((sum, run) => sum + run.files.reduce((total, file) => total + file.bytes, 0), 0) };
}

/** Lock immutable runs, rather than an unrelated workspace's entire build. */
export function withHapRunLock(directory, action) {
  const canonical = realpathSync(directory);
  const lock = join(LOCK_ROOT,
    `reader-harmony-hap-run-${sha256Bytes(canonical)}.lock`);
  acquireLock(lock, { pid: process.pid, directory: canonical,
    startedAt: new Date().toISOString(), protocol: 'hap-run-lock-v1' }, false);
  try { return action(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

function withHapRunLocks(directories, action, index = 0) {
  return index === directories.length ? action() :
    withHapRunLock(directories[index], () => withHapRunLocks(directories, action, index + 1));
}

/** Recheck the inventory and every byte under the same locks used by install. */
export function applyHapRetention(plan) {
  const directories = plan.remove.map(run => resolve(plan.root, run.runId)).sort();
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
  for (const run of current.remove) {
    for (const file of run.files) rmSync(file.path);
    writeJson(resolve(current.root, run.runId, 'retention-receipt.json'), {
      schemaVersion: 1, name: 'reader-hap-retention-receipt', runId: run.runId,
      removedAt: new Date().toISOString(), keepRuns: current.keepRuns,
      artifacts: run.files.map(file => ({ path: basename(file.path), sha256: file.sha256, bytes: file.bytes })),
      packageAvailable: false, manifestAndEvidencePreserved: true,
    });
  }
  return { removedRuns: current.remove.map(run => run.runId), removedBytes: current.bytes };
}

function withArtifactLock(action) {
  const lease = acquireBuildLease();
  try { return action(lease.env); } finally { lease.release(); }
}

function gitRecord(repo, includeMain = false) {
  const commit = capture('git', ['-C', repo, 'rev-parse', 'HEAD']);
  const statusText = capture('git', [
    '-C', repo, 'status', '--porcelain=v1', '--untracked-files=normal',
  ]);
  return {
    repo,
    commit,
    ...(includeMain ? { mainCommit: capture('git', ['-C', repo, 'rev-parse', 'refs/heads/main']) } : {}),
    dirty: statusText.length > 0,
    status: statusText.length > 0 ? statusText.split('\n') : [],
  };
}

export function hapMainlineSources() {
  const sources = Object.fromEntries([['harmony', REPO_ROOT], ['core', CORE_ROOT]].map(([name, repo]) => {
    const source = gitRecord(repo, true);
    const branches = capture('git', ['-C', repo, 'for-each-ref', '--no-merged', 'refs/heads/main',
      '--format=%(refname:short) %(objectname)', 'refs/heads']);
    return [name, { ...source, unmerged: branches ? branches.split('\n') : [] }];
  }));
  const { core } = sources;
  if (!core.dirty && core.commit === core.mainCommit) {
    const snapshot = coreBuildSnapshot(CORE_ROOT);
    if (snapshot.gitIdentity.gitCommit !== core.commit || snapshot.gitIdentity.gitDirty) {
      fail('Core main changed while reading its build inputs');
    }
    core.inputFingerprint = snapshot.fingerprint;
    const pin = JSON.parse(readFileSync(resolve(REPO_ROOT, 'scripts/core-dependency.json'), 'utf8'));
    if (/^[a-f0-9]{40}$/.test(pin.coreCommit ?? '') && pin.coreInputFingerprint === core.inputFingerprint &&
        run('git', ['-C', CORE_ROOT, 'merge-base', '--is-ancestor', pin.coreCommit, core.mainCommit],
          { allowFailure: true }).status === 0) core.equivalentPin = pin.coreCommit;
  }
  return sources;
}

/** Read published metadata only. Live use obtains the fingerprint from the inspected HAP. */
export function plannedSignedCoreFingerprint(selection) {
  const artifact = selection.manifest.artifacts.find(item => item.kind === 'signed');
  return verifyStorageDeliveryContract(dirname(selection.path), artifact, selection.manifest.source?.vendoredCoreNapi)
    ?.coreInputFingerprint;
}

export function latestPublishedSignedHap(abi, root = DEFAULT_ARTIFACT_ROOT) {
  const directory = resolve(root);
  if (!existsSync(directory)) return undefined;
  if (!lstatSync(directory).isDirectory()) fail('artifact root must be a real directory');
  const candidates = readdirSync(directory).filter(name => !name.startsWith('.') && name !== 'retention-pins.json').map(name => {
    const run = resolve(directory, name);
    if (!lstatSync(run).isDirectory()) fail(`invalid published run directory: ${name}`);
    const manifest = retentionJson(resolve(run, 'manifest.json'));
    if (manifest.schemaVersion !== 2 || manifest.name !== 'reader-harmonyos-hap-run' || manifest.runId !== name ||
        !Array.isArray(manifest.artifacts) || !Number.isFinite(Date.parse(manifest.finishedAt))) fail(`invalid published HAP manifest: ${name}`);
    return manifest;
  });
  const selected = latestSignedRun(candidates, abi);
  return selected ? { path: resolve(directory, selected.runId, 'manifest.json'), manifest: selected } : undefined;
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

export function assertResolvedCorePackage(sandboxRepo, expectedVendor) {
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
  const vendor = expectedVendor ?? contentSnapshot(resolve(sandboxRepo, 'entry/vendor/core-harmony'), ['.']);
  const resolvedPackage = contentSnapshot(installed, ['.']);
  if ([...vendor.files, ...resolvedPackage.files].some(file => file.type !== 'file')) {
    fail('resolved Core package must contain regular files, not unbound symlink targets');
  }
  assertSnapshotUnchanged(vendor, resolvedPackage, 'resolved Core package');
}

function snapshotSubset(snapshot, inputs, prefix = '') {
  const files = snapshot.files.filter(file => inputs.some(input => file.path === input || file.path.startsWith(`${input}${sep}`)))
    .map(file => prefix ? { ...file, path: file.path.slice(prefix.length + 1) } : file);
  return snapshottedFiles(files, prefix ? ['.'] : inputs);
}

function appContentRecords(source, controller) {
  return new Map([source, controller].flatMap(snapshot =>
    snapshot.files.map(record => [record.path.split(sep).join('/'), record])));
}

export function assertSnapshotUnchanged(before, after, label) {
  if (before.fingerprint !== after.fingerprint) {
    fail(`${label} changed during the HAP build: ${before.fingerprint} -> ${after.fingerprint}`);
  }
}

function assertGitRecordUnchanged(before, after, label) {
  if (before.commit !== after.commit || before.mainCommit !== after.mainCommit || before.dirty !== after.dirty ||
      JSON.stringify(before.status) !== JSON.stringify(after.status)) {
    fail(`${label} Git identity changed during the HAP build`);
  }
}

function writeSandboxFile(path, bytes, mode) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat?.isFile() && (stat.mode & 0o777) === mode && readFileSync(path).equals(bytes)) return;
  if (stat && !stat.isFile()) rmSync(path, { recursive: true });
  writeFileSync(path, bytes, { mode });
  chmodSync(path, mode);
}

export function copySourceSandbox(source, destination, sandboxRoot = tmpdir(), {
  before = sourceSnapshot(source), incremental = false, overrides = new Map(), omitted = [],
} = {}) {
  source = resolve(source);
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
  const existingDestination = existsSync(destination);
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
    '.reader-app-build.json',
    '.reader-pipeline-session.json',
  ];
  // Node's filesystem API preserves the same filtered sandbox without a
  // platform-specific rsync executable. Preserve excluded local outputs while
  // removing stale included entries, matching the former --delete contract.
  const excluded = path => {
    const local = relative(source, path).split(sep).join('/');
    return excludes.some(entry => entry.includes('/') ? local === entry || local.startsWith(`${entry}/`)
      : local.split('/').includes(entry));
  };
  const omit = local => omitted.some(entry => local === entry || local.startsWith(`${entry}${sep}`));
  const skipCopy = path => {
    const local = relative(source, path);
    return excluded(path) || omit(local) || overrides.has(local);
  };
  const copyOptions = { recursive: true, force: true, mode: constants.COPYFILE_FICLONE,
    preserveTimestamps: true, verbatimSymlinks: true, filter: path => !skipCopy(path) };
  const inputs = new Map(before.files.map(file => [file.path, file]));
  // These proofs belong to this copy only. Everything recopied, overridden,
  // or changed since its comparison is hashed during the verification walk.
  const validatedDigests = incremental && existingDestination ? new Map() : undefined;
  const syncDirectory = (origin, target) => {
    for (const name of readdirSync(target)) {
      const input = resolve(origin, name);
      if (!skipCopy(input) && !lstatSync(input, { throwIfNoEntry: false })) rmSync(resolve(target, name), { recursive: true });
    }
    for (const name of readdirSync(origin)) {
      const input = resolve(origin, name);
      if (skipCopy(input)) continue;
      const output = resolve(target, name);
      const originStat = lstatSync(input, { bigint: true });
      const targetStat = lstatSync(output, { bigint: true, throwIfNoEntry: false });
      if (originStat.isDirectory() && targetStat?.isDirectory()) {
        syncDirectory(input, output);
        continue;
      }
      if (originStat.isSymbolicLink() && targetStat?.isSymbolicLink() && readlinkSync(input) === readlinkSync(output)) continue;
      if (originStat.isFile() && targetStat?.isFile() && originStat.size === targetStat.size &&
          (originStat.mode & 0o777n) === (targetStat.mode & 0o777n)) {
        const sourceRecord = inputs.get(relative(source, input));
        const expected = sourceRecord?.sha256 ?? sha256Bytes(readFileSync(input));
        const sha256 = sha256Bytes(readFileSync(output));
        if (expected === sha256) {
          if (validatedDigests && sourceRecord) {
            const after = lstatSync(output, { bigint: true, throwIfNoEntry: false });
            if (sameIdentity(targetStat, after)) validatedDigests.set(output, { stat: after, sha256 });
          }
          continue;
        }
      }
      if (targetStat && (!originStat.isFile() || !targetStat.isFile())) rmSync(output, { recursive: true });
      cpSync(input, output, copyOptions);
    }
  };
  if (incremental || existingDestination) syncDirectory(source, destination);
  else cpSync(source, destination, copyOptions);
  for (const path of omitted) rmSync(resolve(destination, path), { recursive: true, force: true });
  for (const [path, { bytes, mode }] of overrides) writeSandboxFile(resolve(destination, path), bytes, mode);
  const files = before.files.filter(file => !omit(file.path)).map(file => {
    const override = overrides.get(file.path);
    return override ? { ...file, mode: override.mode, bytes: override.bytes.length, sha256: sha256Bytes(override.bytes) } : file;
  });
  const expected = snapshottedFiles(files, BUILD_INPUTS);
  assertSnapshotUnchanged(expected, measureBuildStep('verifyCopiedInputs', () =>
    regularInputSnapshot(destination, BUILD_INPUTS, 'Host build inputs', validatedDigests)),
    'copied sandbox inputs');
  return expected;
}

function acquireHapBuildWorkspace(abi, incremental) {
  if (!incremental) {
    return acquireBuildWorkspace({ create: () => mkdtempSync(join(tmpdir(), 'reader-hap-build-')),
      remove: path => rmSync(path, { recursive: true, force: true }) });
  }
  const lease = acquireBuildLease();
  const local = resolve(REPO_ROOT, '.reader-local');
  const caches = resolve(local, 'hap-incremental');
  const path = resolve(caches, abi);
  const lock = resolve(path, '.build-lock');
  try {
    for (const directory of [local, caches, path]) {
      if (!lstatSync(directory, { throwIfNoEntry: false })) mkdirSync(directory, { mode: 0o700 });
      const stat = lstatSync(directory);
      if (!stat.isDirectory() || (directory !== local && ((stat.mode & 0o077) !== 0 ||
          (process.getuid && stat.uid !== process.getuid())))) {
        fail('incremental HAP cache requires private, owner-controlled directories');
      }
    }
    const owner = { pid: process.pid, startedAt: new Date().toISOString(), protocol: 'hap-incremental-lock-v1' };
    try { acquireLock(lock, owner, false); }
    catch (error) {
      let previous;
      try { previous = JSON.parse(readFileSync(resolve(lock, 'owner.json'), 'utf8')); } catch { throw error; }
      if (previous.protocol !== owner.protocol || !Number.isInteger(previous.pid) || previous.pid < 1 || processExists(previous.pid)) throw error;
      // Serialize stale-owner recovery even for callers configured with
      // different resource lock roots or sharing an inherited build lease.
      const recovery = `${lock}.recovery`;
      acquireLock(recovery, owner, false);
      try { acquireLock(lock, owner); } finally { rmSync(recovery, { recursive: true }); }
    }
    return { path, env: lease.env, release() {
      try { rmSync(lock, { recursive: true }); } finally { lease.release(); }
    } };
  } catch (error) { lease.release(); throw error; }
}

function resolveSandboxDependencies(sandboxRoot, sandboxRepo, sourceBefore, incremental) {
  const dependencies = snapshotSubset(sourceBefore, DEPENDENCY_INPUTS);
  const vendor = snapshotSubset(dependencies, ['entry/vendor/core-harmony'], 'entry/vendor/core-harmony');
  const ohpm = resolveHarmonyTool('ohpm', { cwd: REPO_ROOT });
  const cacheStamp = resolve(sandboxRoot, 'ohpm-inputs.sha256');
  const cacheKey = Buffer.from(sha256Bytes(JSON.stringify([dependencies.fingerprint, ohpm, fileRecord(ohpm).sha256])));
  const stat = lstatSync(cacheStamp, { throwIfNoEntry: false });
  if (incremental && stat?.isFile() && readFileSync(cacheStamp).equals(cacheKey)) {
    try {
      measureBuildStep('verifyCachedCorePackage', () => assertResolvedCorePackage(sandboxRepo, vendor));
      console.log(JSON.stringify({ stage: 'ohpmInstall', status: 'REUSED' }));
      return vendor;
    } catch { /* Retry dependency resolution when cached bytes or links no longer match. */ }
  }
  if (incremental) {
    rmSync(cacheStamp, { force: true });
    for (const modules of ['oh_modules', 'entry/oh_modules']) rmSync(resolve(sandboxRepo, modules), { recursive: true, force: true });
  }
  measureBuildStep('ohpm', () => run(ohpm, ['install', '--no-link', '--cache', resolve(sandboxRoot, 'ohpm-cache')], {
    cwd: resolve(sandboxRepo, 'entry'), stdio: 'inherit',
  }));
  measureBuildStep('verifyDependencyInputs', () => assertSnapshotUnchanged(dependencies,
    regularInputSnapshot(sandboxRepo, DEPENDENCY_INPUTS, 'Sandbox dependency inputs'), 'dependency manifests and vendor SDK'));
  measureBuildStep('verifyInstalledCorePackage', () => assertResolvedCorePackage(sandboxRepo, vendor));
  if (incremental) writeSandboxFile(cacheStamp, cacheKey, 0o600);
  return vendor;
}

function incrementalDaemonToken(sandboxRoot, configuration, stopExistingDaemon) {
  const path = resolve(sandboxRoot, 'daemon-session.json');
  const configurationSha256 = sha256Bytes(JSON.stringify(configuration));
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && !stat.isFile()) fail('incremental daemon state must be a regular private file');
  let previous;
  if (stat) {
    assertPrivateFilePermissions(path);
    try { previous = JSON.parse(readFileSync(path, 'utf8')); } catch { /* Restart a daemon with incomplete state. */ }
  }
  // Hvigor refreshes an allowlist of environment variables between requests.
  // Its inherited token must stay stable while this private daemon is alive;
  // the build marker still binds each invocation's profile and app identity.
  if (previous?.configurationSha256 === configurationSha256 && /^[0-9a-f-]{36}$/.test(previous.token)) return previous.token;
  stopExistingDaemon();
  const token = randomUUID();
  writeSandboxFile(path, Buffer.from(JSON.stringify({ configurationSha256, token })), 0o600);
  return token;
}

function readWrapperTools(buildClass, incremental, beforeCopy = false) {
  const sharedHvigorTools = resolve(process.env.HVIGOR_SHARED_TOOLS || resolve(homedir(), '.hvigor/wrapper/tools'));
  if (!existsSync(sharedHvigorTools)) fail('prepared Hvigor wrapper tools are missing: ' + sharedHvigorTools);

  // The version check follows the two pnpm paths. Seal their resolved files
  // as well as the wrapper tree's own link entries until the result is used.
  const pnpmInputs = beforeCopy ? ['node_modules/pnpm/package.json', 'node_modules/pnpm/bin/pnpm.cjs'].map(file => {
    const path = resolve(sharedHvigorTools, file);
    const target = existsSync(path) ? realpathSync(path) : undefined;
    const proof = target && captureSealedInputSnapshot(dirname(target), [basename(target)], 'Prepared pnpm input');
    return { path, target, proof };
  }) : [];
  const packageManager = measureBuildStep('toolchain.packageManager', () =>
    assertBuildTools(sharedHvigorTools, { profile: buildClass === 'acceptance' ? 'release' : 'development' }));
  // Preserve the old handling of a linked tools root by capturing its
  // fingerprint at the normal point, close to materialization.
  const proof = beforeCopy && incremental && lstatSync(sharedHvigorTools).isDirectory()
    ? measureBuildStep('toolchain.snapshot', () =>
      captureSealedInputSnapshot(sharedHvigorTools, ['.'], 'Shared Hvigor wrapper tools', { allowLinks: true }))
    : undefined;
  return { sharedHvigorTools, packageManager, sourceTools: proof?.snapshot,
    assertUnchanged() {
      for (const { path, target, proof } of pnpmInputs) {
        if (!target || !existsSync(path) || realpathSync(path) !== target) fail('Prepared pnpm inputs changed after version verification');
        proof.assertUnchanged();
      }
      proof?.assertUnchanged();
    },
  };
}

function prepareHvigorWrapperTools(shared, destination, fingerprint, sourceTools, stopExistingDaemon) {
  const copyOptions = { recursive: true, mode: constants.COPYFILE_FICLONE, preserveTimestamps: true, verbatimSymlinks: true };
  if (fingerprint === undefined) {
    mkdirSync(destination, { recursive: true });
    cpSync(shared, destination, copyOptions);
    return;
  }
  const parent = dirname(destination);
  const stamp = resolve(parent, 'tools-inputs.sha256');
  const preparedPnpm = resolve(destination, 'node_modules/pnpm/package.json');
  const expected = Buffer.from(fingerprint);
  const installed = lstatSync(destination, { throwIfNoEntry: false });
  if (installed && !installed.isDirectory()) fail('incremental Hvigor tools must be a real private directory');
  if (installed && lstatSync(stamp, { throwIfNoEntry: false })?.isFile() && readFileSync(stamp).equals(expected) &&
      lstatSync(preparedPnpm, { throwIfNoEntry: false })?.isFile() &&
      fileRecord(preparedPnpm).sha256 === fileRecord(resolve(shared, 'node_modules/pnpm/package.json')).sha256) {
    return;
  }
  stopExistingDaemon();
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, '.tools-'));
  const next = resolve(staging, 'next');
  const previous = resolve(staging, 'previous');
  try {
    cpSync(shared, next, copyOptions);
    // CopyFile may apply the caller's umask, even for a CoW clone.
    const umask = process.umask();
    for (const file of sourceTools.files) {
      if (file.type === 'file' && (file.mode & umask) !== 0) chmodSync(resolve(next, file.path), file.mode);
    }
    assertSnapshotUnchanged(sourceTools, contentSnapshot(next, ['.']), 'prepared Hvigor wrapper tools');
    if (installed) renameSync(destination, previous);
    try { renameSync(next, destination); }
    catch (error) {
      if (installed) renameSync(previous, destination);
      throw error;
    }
    writeSandboxFile(stamp, expected, 0o600);
  } finally { rmSync(staging, { recursive: true, force: true }); }
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

function signatureArguments(hapPath, verifyRoot) {
  const signTool = resolveHarmonyTool('signTool');
  return ['-jar', signTool, 'verify-app', '-inFile', hapPath,
    '-outCertChain', resolve(verifyRoot, 'cert-chain.cer'), '-outProfile', resolve(verifyRoot, 'profile.p7b')];
}

function verifiedSignatureResult(result, verifyRoot) {
  if (result.commandError) fail(`HAP signature verifier process failed (${result.commandError})`);
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status === 0 && output.includes('verify-app success') &&
      output.includes('verify codesign success') && output.includes('Digest verify result: true')) {
    const profile = output.match(/profile type is:\s*([^\s]+)/i)?.[1]?.toLowerCase() ?? 'unknown';
    const identity = measureBuildStep('signerProfile', () => verifiedProfileIdentity(resolve(verifyRoot, 'profile.p7b')));
    assertSigningCertificateAuthority(identity.certificateSha256);
    return { status: 'signed', verified: true, profileType: profile, ...identity };
  }
  if (/signature not found|No Hap Signing Block/i.test(output)) {
    return { status: 'unsigned', verified: false, profileType: 'none' };
  }
  fail('HAP signature verification failed');
}

function verifySignature(hapPath) {
  const java = resolveHarmonyTool('java');
  const verifyRoot = mkdtempSync(join(tmpdir(), 'reader-hap-signature-'));
  try {
    const args = signatureArguments(hapPath, verifyRoot);
    const result = measureBuildStep('signTool', () => run(java, args, { allowFailure: true }));
    return verifiedSignatureResult(result, verifyRoot);
  } finally {
    rmSync(verifyRoot, { recursive: true, force: true });
  }
}

export function inspectHap(hapPath, kind, publicPath = basename(hapPath), requiredResources, abi = 'arm64-v8a', expectedVersion) {
  return inspectHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion).artifact;
}

const bundledSourceEntry = 'resources/rawfile/reader-tested-book-source-collection.json';
const storageBootstrapEntry = `resources/rawfile/${STORAGE_BOOTSTRAP_RESOURCE}`;

function inspectHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources) {
  let signature;
  const archive = readHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources, () => {
    signature = verifySignature(hapPath);
    checkExpectedSignature(hapPath, kind, signature);
  });
  return archive.seal(signature);
}

function checkExpectedSignature(hapPath, kind, signature) {
  if (kind === 'signed' && signature.status !== 'signed') fail(`${hapPath} is not signed`);
  if (kind === 'unsigned' && signature.status !== 'unsigned') fail(`${hapPath} is not unsigned`);
}

/** Build-only path. One JVM may run while the already opened ZIP is inspected. */
async function inspectBuiltHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources) {
  const java = resolveHarmonyTool('java');
  if (!canOverlapHapSignature(java)) return measureBuildStep('inspectHap.synchronousSigner', () =>
    inspectHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources));
  const verifyRoot = mkdtempSync(join(tmpdir(), 'reader-hap-signature-'));
  let task;
  try {
    const args = signatureArguments(hapPath, verifyRoot);
    const archive = measureBuildStep('inspectHap.archive', () => readHapForSeal(
      hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources, () => {
        task = startHapSignatureProcess(java, args, REPO_ROOT);
      }));
    const waiting = performance.now();
    const result = await task.result;
    recordBuildElapsed('inspectHap.signToolWait', waiting);
    archive.assertUnchanged(hapPath);
    const signature = measureBuildStep('inspectHap.signatureResult', () => verifiedSignatureResult(result, verifyRoot));
    checkExpectedSignature(hapPath, kind, signature);
    return archive.seal(signature);
  } finally {
    try { await task?.stop(); }
    finally { rmSync(verifyRoot, { recursive: true, force: true }); }
  }
}

function readHapForSeal(hapPath, kind, publicPath, requiredResources, abi, expectedVersion, expectedBundledSources, admitSignature) {
  if (abi !== 'arm64-v8a' && abi !== 'x86_64') fail(`unsupported HAP inspection ABI: ${abi}`);
  return withHapZip(hapPath, zip => {
    const record = (path, bytes) => ({ path, bytes: bytes.length, sha256: sha256Bytes(bytes) });
    const appVersion = measureBuildStep('moduleJson', () =>
      packagedAppVersion(JSON.parse(zip.read('module.json').toString('utf8')), { required: expectedVersion !== undefined }));
    if (expectedVersion) assertAppVersion(expectedVersion, appVersion, 'HAP');
    const nativeEntries = zip.names.filter(name => name.startsWith('libs/')).sort();
    const expectedNativeEntries = EXPECTED_NATIVE_ENTRIES.map(name => name.replace('arm64-v8a', abi));
    if (JSON.stringify(nativeEntries) !== JSON.stringify(expectedNativeEntries)) {
      fail(`unexpected native archive layout in ${hapPath}: ${JSON.stringify(nativeEntries)}`);
    }
    const hapRecord = measureBuildStep('hapDigest', () => zip.fileRecord(publicPath));
    admitSignature();
    zip.assertUnchanged();
    let embeddedBootstrap;
    if (requiredResources) measureBuildStep('requiredResources', () =>
      verifyRequiredHapResources(requiredResources, zip.names, (entry) => {
        const bytes = zip.read(entry);
        if (entry === storageBootstrapEntry) embeddedBootstrap = record(entry, bytes);
        return bytes;
      }));
    if (expectedBundledSources) measureBuildStep('bundledSources', () => {
      const bundled = record(bundledSourceEntry, zip.read(bundledSourceEntry));
      if (bundled.bytes !== expectedBundledSources.bytes || bundled.sha256 !== expectedBundledSources.sha256) {
        fail(`${hapPath} bundled source bytes differ from the current build input`);
      }
    });
    const nativePath = `libs/${abi}/libreader_core_napi.so`;
    const { embeddedNative, compatibility } = measureBuildStep('embeddedNative', () => {
      const bytes = zip.read(nativePath);
      return { embeddedNative: record(nativePath, bytes), compatibility: embeddedStorageCompatibility(bytes) };
    });
    const assertUnchanged = candidate => {
      if (candidate !== hapPath) fail('HAP does not match the inspected staging path');
      zip.assertUnchanged();
    };
    return {
      assertUnchanged,
      seal(signature) {
        assertUnchanged(hapPath);
        if (expectedBundledSources) {
          console.log(`${hapPath}: bundled source byte identity PASS (${expectedBundledSources.bytes} bytes); source behavior NOT_RUN`);
        }
        return {
          artifact: { kind, ...hapRecord, signature, appVersion, nativeEntries,
            embeddedCoreNapi: { ...embeddedNative, storageCompatibility: compatibility },
            ...(requiredResources ? { requiredResources } : {}) },
          inspectedHap: { hapRecord, embeddedNative, embeddedBootstrap }, assertUnchanged,
        };
      },
    };
  });
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

function parseBuildProfile(path, expected) {
  // Use the JSON5 parser bundled with the official build tools, including
  // DevEco's comments/trailing commas; never echo parser excerpts of secrets.
  const plugin = resolveHarmonyTool('hvigorPlugin', { cwd: REPO_ROOT });
  const bytes = readFileSync(path);
  if (expected && sha256Bytes(bytes) !== expected.sha256) fail('source build profile changed after its snapshot');
  try { return createRequire(plugin)('json5').parse(bytes.toString('utf8')); }
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

export function prepareIdeAppBuildIdentity({ buildMode, product }, env = process.env) {
  const abi = resolveHarmonyAbi(env.READER_HARMONY_ABI);
  return prepareAppIdentity(REPO_ROOT, APP_CONTENT_INPUTS, { abi, buildMode, product, env });
}

export function verifyIdeSignedHap(path, session, env = process.env) {
  const lease = acquireBuildLease(env);
  try {
    assertIdeSigningUnchanged(session);
    if (!session.appIdentity) fail('DevEco app identity was not configured before packaging');
    assertAppIdentityUnchanged(session.appIdentity, env);
    const artifact = inspectHap(path, 'signed', basename(path), requiredHapResources(REPO_ROOT), resolveHarmonyAbi(env.READER_HARMONY_ABI), session.appIdentity.expectedVersion);
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

export function findBuiltHaps(outputDir, signingMode, buildClass) {
  const names = readdirSync(outputDir).filter((name) => name.endsWith('.hap')).sort();
  const allowed = ['entry-default-signed.hap', 'entry-default-unsigned.hap'];
  if (names.some((name) => !allowed.includes(name))) {
    fail(`isolated output contains non-canonical HAPs: ${names.join(', ')}`);
  }
  if (signingMode === 'local' && !names.includes('entry-default-signed.hap')) {
    fail('local signing was requested but the signed HAP was not produced');
  }
  if (buildClass === 'iteration' && signingMode === 'local') return ['entry-default-signed.hap'];
  if (!names.includes('entry-default-unsigned.hap')) fail('isolated build did not produce the unsigned HAP');
  if (signingMode === 'unsigned' && names.includes('entry-default-signed.hap')) fail('unsigned build unexpectedly produced a signed HAP');
  return names;
}

function resolveCoreProfile(profile = 'release') {
  if (!['release', 'smoke'].includes(profile)) fail('--core-profile must be release or smoke', 2);
  return profile;
}

export function nativeInputPaths(coreRoot = CORE_ROOT, env = process.env) {
  // Cargo resolves relative target directories from the Core producer's cwd,
  // not from the Harmony checkout or the pipeline invocation directory.
  const abi = resolveHarmonyAbi(env.READER_HARMONY_ABI);
  const profile = resolveCoreProfile(env.READER_HARMONY_CORE_PROFILE);
  const base = resolve(coreRoot, env.CARGO_TARGET_DIR || 'target', 'harmony-napi', abi, ...(profile === 'smoke' ? ['smoke'] : []));
  return {
    identity: resolve(base, 'core-build-identity.json'),
    inputSnapshot: resolve(base, 'core-input-snapshot.json'),
    packageManifest: resolve(base, 'harmony-package-manifest.sha256'),
    buildEvidence: resolve(base, 'harmony-napi-build-evidence.txt'),
    nativeSo: resolve(base, 'package/libs', abi, 'libreader_core_napi.so'),
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
  const abi = resolveHarmonyAbi(env.READER_HARMONY_ABI);
  const inputs = requireAcceptanceInputs(CORE_ROOT, env);
  return [
    '--abi', abi, '--core-repo', CORE_ROOT, '--harmony-repo', REPO_ROOT,
    '--rust-profile', resolveCoreProfile(env.READER_HARMONY_CORE_PROFILE),
    '--core-identity', inputs.identity, '--core-input-snapshot', inputs.inputSnapshot,
    '--napi-manifest', inputs.packageManifest, '--native-so', inputs.nativeSo,
    '--app-native-so', resolve(REPO_ROOT, 'entry/libs', abi, 'libreader_core_napi.so'),
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
  const abi = resolveHarmonyAbi(env.READER_HARMONY_ABI);
  const profile = resolveCoreProfile(env.READER_HARMONY_CORE_PROFILE);
  const declaredAbis = parseBuildProfile(resolve(REPO_ROOT, 'entry/build-profile.json5')).buildOption?.externalNativeOptions?.abiFilters;
  if (!Array.isArray(declaredAbis) || declaredAbis.length !== 1 || declaredAbis[0] !== abi) {
    fail('IDE Native ABI must match the single entry build-profile ABI; isolated builds select --abi explicitly.');
  }
  const lease = acquireBuildLease(env);
  const buildEnv = ideNativeBuildEnvironment(lease.env);
  try {
    return prepareIdeNativeInputs({
      check() {
        const state = ideNativeInputState(Object.values(nativeInputPaths(CORE_ROOT, buildEnv)),
          resolve(REPO_ROOT, 'entry/libs', abi, 'libreader_core_napi.so'), resolve(REPO_ROOT, 'entry/vendor/core-harmony'));
        if (state === 'rebuild') throw Object.assign(new Error('Reader DevEco Native package is missing'), { code: 'READER_IDE_NATIVE_PACKAGE_MISSING' });
        if (state === 'synchronize') {
          throw Object.assign(new Error('Reader DevEco Native/SDK inputs are missing'), { code: 'READER_IDE_NATIVE_HOST_MISSING' });
        }
        return checkNativeInputs(buildEnv);
      },
      rebuild() {
        console.log('Reader DevEco: Core Native inputs changed; rebuilding the current local Core/SDK package.');
        run('bash', [resolve(CORE_ROOT, 'scripts/build-harmony-napi.sh'), '--abi', abi, '--profile', profile], {
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
  const abi = resolveHarmonyAbi(env.READER_HARMONY_ABI);
  const inputs = requireAcceptanceInputs(CORE_ROOT, env);
  const packageRoot = resolve(dirname(inputs.packageManifest), 'package');
  const localRoot = resolve(REPO_ROOT, '.reader-local/native-sync');
  for (const path of [localRoot, resolve(REPO_ROOT, 'entry/vendor'), resolve(REPO_ROOT, 'entry/libs', abi), resolve(REPO_ROOT, 'entry/src/main/resources/rawfile')]) {
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
  const native = resolve(REPO_ROOT, 'entry/libs', abi, 'libreader_core_napi.so');
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
    console.log(JSON.stringify({ status: 'PASS', operation: 'sync-native', abi,
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

function generateAcceptanceProvenance(runDir, hap, hvigorVersion, buildCommand, buildClass, evidence, sdk, env) {
  const stripTool = resolveHarmonyTool('objcopy');
  const output = resolve(runDir, `${buildClass}-${basename(hap, '.hap')}-provenance.json`);
  const { manifest } = generateBuildProvenance([
    ...nativeProvenanceArguments(env),
    ...(buildClass === 'iteration' ? ['--allow-dirty'] : []),
    '--hap', hap,
    '--output', output,
    '--native-strip-tool', stripTool,
    '--build-command', buildCommand,
    '--hvigor-version', hvigorVersion,
    '--sdk-version', `HarmonyOS ${sdk.version} (API ${sdk.apiVersion})`,
  ], { inspectedHap: { ...evidence.inspectedHap, assertUnchanged: evidence.assertUnchanged },
    buildClass, cacheStrippedNative: buildClass === 'iteration' });
  return { path: basename(output), manifest };
}

function admittedHvigorVersion(hvigorw, cwd, env, cache, fingerprint) {
  if (fingerprint && lstatSync(cache, { throwIfNoEntry: false })?.isFile()) {
    assertPrivateFilePermissions(cache);
    try {
      const saved = JSON.parse(readFileSync(cache, 'utf8'));
      if (saved.fingerprint === fingerprint && typeof saved.version === 'string' && saved.version.length > 0) {
        return saved.version;
      }
    } catch { /* Recover a locally interrupted version cache write. */ }
  }
  const version = capture(hvigorw, ['--version'], { cwd, env });
  if (fingerprint) writeSandboxFile(cache, Buffer.from(JSON.stringify({ fingerprint, version })), 0o600);
  return version;
}

function validateBuildOptions(options, root = REPO_ROOT) {
  const allowed = ['--class', '--channel', '--abi', '--core-profile', '--incremental', '--signing', '--live-sources', '--live-source-ids', '--keep-runs', '--artifact-root', '--contracts-scope', '--core-gate-receipt', '--rationale'];
  for (const key of options.keys()) if (!allowed.includes(key)) fail(`unknown build argument: ${key}`, 2);
  if (options.has('--channel') && !['DEV', 'RC', 'REL'].includes(requiredOption(options, '--channel'))) fail('--channel must be DEV, RC or REL', 2);
  resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI));
  const buildClass = option(options, '--class', 'iteration');
  if (!['iteration', 'acceptance'].includes(buildClass)) fail('--class must be iteration or acceptance', 2);
  if (buildClass === 'acceptance' && options.has('--incremental')) fail('--incremental is only supported for --class iteration', 2);
  const coreProfile = resolveCoreProfile(option(options, '--core-profile', process.env.READER_HARMONY_CORE_PROFILE));
  if (buildClass === 'acceptance' && coreProfile !== 'release') fail('acceptance requires the Core release Rust profile', 2);
  if (options.get('--live-sources') === true) fail('--live-sources no longer starts the whole collection. Use --live-source-ids with exact IDs and --rationale, or run the explicit all-source tool plan separately.', 2);
  if (options.has('--live-source-ids') && !option(options, '--rationale', '').trim()) fail('Selected live sources require --rationale.', 2);
  if (options.has('--live-source-ids')) selectBundledSources(JSON.parse(readFileSync(resolve(root, 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'), 'utf8')), requiredOption(options, '--live-source-ids').split(','));
  if (option(options, '--contracts-scope', 'none') !== 'none') {
    fail('Embedded contract runs have retired. Run scripts/test-host.mjs or scripts/vm-journeys.mjs directly.', 2);
  }
}

async function build(options) {
  validateBuildOptions(options);
  const buildStarted = performance.now();
  const acceptance = option(options, '--class', 'iteration') === 'acceptance';
  if (acceptance) assertCleanMainline(gitRecord(REPO_ROOT, true), gitRecord(CORE_ROOT, true));
  activeBuildAttempt = hapStageReceipt(resolve(REPO_ROOT, '.reader-artifacts/hap-attempts'), {});
  if (process.env.READER_HAP_TIMINGS === '1') activeBuildTimings = { parent: '', steps: new Map() };
  let beforeSnapshot;
  try {
    const harmony = measureBuildStep('gitHarmonyBefore', () => gitRecord(REPO_ROOT, acceptance));
    const core = measureBuildStep('gitCoreBefore', () => gitRecord(CORE_ROOT, acceptance));
    if (acceptance) assertCleanMainline(harmony, core);
    beforeSnapshot = startRegularInputSnapshots([{ repo: REPO_ROOT, inputs: BUILD_INPUTS, label: 'Host build inputs' }]);
    const coreBuildInputs = measureBuildStep('coreBuildInputs', () => coreBuildSnapshot(CORE_ROOT));
    const controller = measureBuildStep('controllerBefore', () => controllerSnapshot());
    const [source] = await beforeSnapshot.result;
    activeBuildTimings?.steps.set('sourceBefore', beforeSnapshot.timingsMs()[0]);
    beforeSnapshot.assertUnchanged();
    const inputs = {
      harmony, core, coreBuildInputs, source, controller,
    };
    measureBuildStep('bindAttemptInputs', () => activeBuildAttempt.bindInputs(inputs));
    await buildImpl(options, inputs, buildStarted);
    finishBuildAttempt();
  } catch (error) {
    finishBuildAttempt(error);
    error.message = activeBuildAttempt.redact(error.message);
    throw error;
  } finally {
    await beforeSnapshot?.stop();
    activeBuildAttempt = undefined;
    activeBuildTimings = undefined;
  }
}

async function buildImpl(options, inputs, buildStarted) {
  assertWorkspaceLayout(WORKSPACE_ROOT);
  const buildClass = option(options, '--class', 'iteration');
  const abi = resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI));
  const coreProfile = resolveCoreProfile(option(options, '--core-profile', process.env.READER_HARMONY_CORE_PROFILE));
  const incremental = options.get('--incremental') === true;
  const nativeEnvironment = { ...process.env, READER_HARMONY_ABI: abi, READER_HARMONY_CORE_PROFILE: coreProfile };
  const { harmony: sourceGitBefore, core: coreGitBefore, source: sourceBefore, controller: harmonyGateBefore } = inputs;
  const sourceRecord = name => sourceBefore.files.find(file => file.path === name.split('/').join(sep));
  const requestedSigning = option(options, '--signing', 'auto');
  if (!['auto', 'local', 'unsigned'].includes(requestedSigning)) {
    fail('--signing must be auto, local, or unsigned', 2);
  }
  if (requestedSigning !== 'unsigned') readSigningAuthority();
  const localProfile = resolve(process.env.READER_HARMONY_SIGNING_PROFILE || DEFAULT_SIGNING_PROFILE);
  const signingMode = resolveSigningMode(requestedSigning, existsSync(localProfile));
  if (buildClass === 'acceptance' && signingMode !== 'local') fail('acceptance build requires the local signed debug profile');
  if (signingMode === 'local' && !existsSync(localProfile)) {
    fail(`local signing profile is missing: ${localProfile}`);
  }
  let signingProfile;
  let signingBefore;
  if (signingMode === 'local') {
    validateLocalSigningProfile(localProfile);
    signingProfile = composeSigningProfile(parseBuildProfile(resolve(REPO_ROOT, 'build-profile.json5'), sourceRecord('build-profile.json5')),
      parseBuildProfile(localProfile));
    for (const config of signingProfile.app?.signingConfigs ?? []) activeBuildAttempt?.protect(config.material);
    measureBuildStep('signingAdmission', () => assertSigningMaterialAuthority(signingProfile, verifiedProfileIdentity));
    signingBefore = { configuration: fileRecord(localProfile, 'local-signing-config'),
      material: measureBuildStep('signingMaterialBefore', () => signingMaterialSnapshot(signingProfile)) };
  }

  const coreGateFile = option(options, '--core-gate-receipt', process.env.READER_CORE_GATE_RECEIPT);
  if (buildClass === 'acceptance' && coreGateFile) currentCoreGate(coreGateFile, CORE_ROOT);
  const precomputedRecords = appContentRecords(sourceBefore, harmonyGateBefore);
  const requiredResources = measureBuildStep('requiredResourcesBefore', () =>
    requiredHapResources(REPO_ROOT, { precomputedRecords }));

  const buildLease = measureBuildStep('buildWorkspace', () => acquireHapBuildWorkspace(abi, incremental));
  const sandboxRoot = buildLease.path;
  const sandboxRepo = resolve(sandboxRoot, 'Reader-for-HarmonyOS');
  const pipelineMarker = resolve(sandboxRepo, '.reader-pipeline-session.json');
  const incompleteBuild = resolve(sandboxRoot, 'build-in-progress');
  let markerWritten = false;
  let unpublishedRunDir = null;
  let afterSnapshots;
  try {
    const readAppIdentity = () => measureBuildStep('appIdentity', () => prepareAppIdentity(REPO_ROOT, APP_CONTENT_INPUTS, { abi,
      channel: option(options, '--channel', process.env.READER_APP_CHANNEL), buildClass, signed: signingMode === 'local',
      precomputedRecords }));
    const readWorkspaceContract = () => measureBuildStep('workspaceContractBefore', () => workspaceContractSnapshot());
    const nativeArgs = measureBuildStep('nativePreflightArguments', () => [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...nativeProvenanceArguments(nativeEnvironment), '--preflight', '--output', resolve(sandboxRoot, 'native-preflight.json'),
      ...(buildClass === 'iteration' ? ['--allow-dirty'] : []),
    ]);
    let prepared;
    if (buildClass === 'iteration' && !options.has('--live-source-ids')) {
      prepared = await prepareDuringNativePreflight(nativeArgs, () => ({
        workspaceContract: readWorkspaceContract(),
        appIdentity: readAppIdentity(),
        wrapperTools: readWrapperTools(buildClass, incremental, true),
      }), milliseconds => activeBuildTimings?.steps.set('nativePreflight', milliseconds));
      measureBuildStep('toolchain.verifyPreparedInputs', () => prepared.wrapperTools.assertUnchanged());
    } else {
      measureBuildStep('nativePreflight', () => run(process.execPath, nativeArgs));
    }
    const artifactRoot = resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT));
    const keepRuns = retentionLimit(options);
    const retention = measureBuildStep('retention', () => applyHapRetention(planHapRetention(artifactRoot, keepRuns, 1)));
    console.log(JSON.stringify({ stage: 'artifactRetention', keepRuns, ...retention }));
    const contractPolicy = JSON.parse(readFileSync(resolve(REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT), 'utf8'));
    if (contractPolicy.schemaVersion !== 2 || contractPolicy.name !== 'reader-harmony-contract-evidence-policy' ||
        contractPolicy.contractsReceiptRequired !== 'when-executed' || contractPolicy.defaultScope !== 'none' ||
        !controllerRequiresContractEvidence(harmonyGateBefore)) {
      fail('current HAP controller requires the contract evidence policy');
    }
    const workspaceContractBefore = prepared?.workspaceContract ?? readWorkspaceContract();
    const contractToolchainBefore = contentSnapshot(WORKSPACE_ROOT, []);
    console.log(JSON.stringify({ stage: 'harmonyContracts', status: 'NOT_RUN', scope: 'none', fullSuite: 'NOT_RUN' }));
    if (options.has('--live-source-ids')) {
      const liveStarted = performance.now();
      console.log(JSON.stringify({ stage: 'liveBookSources', event: 'start', deadlineMs: LIVE_SOURCE_TIMEOUT_MS }));
      try {
        run(process.execPath, ['tools/verify-bundled-test-book-sources-live.mjs', '--source-ids', requiredOption(options, '--live-source-ids'), '--rationale', requiredOption(options, '--rationale')], {
          cwd: REPO_ROOT, stdio: 'inherit', env: buildLease.env, timeoutMs: LIVE_SOURCE_TIMEOUT_MS,
        });
        console.log(JSON.stringify({ stage: 'liveBookSources', event: 'end', status: 'PASS', milliseconds: Math.ceil(performance.now() - liveStarted) }));
      } catch (error) {
        console.log(JSON.stringify({ stage: 'liveBookSources', event: 'end', status: 'FAIL', milliseconds: Math.ceil(performance.now() - liveStarted) }));
        throw error;
      }
    }

    const appIdentity = prepared?.appIdentity ?? readAppIdentity();
    console.log(JSON.stringify({ stage: 'appBuildIdentity', ...appIdentity.expectedVersion }));
    const hvigorw = resolveHarmonyTool('hvigorw', { cwd: REPO_ROOT });
    const hvigorUserHome = resolve(sandboxRoot, 'hvigor-user-home');
    let existingDaemon = incremental && existsSync(hvigorUserHome);
    const stopSandboxDaemon = () => {
      if (!existingDaemon) return;
      if (!lstatSync(sandboxRepo).isDirectory()) fail('incremental HAP cache requires a real sandbox project');
      run(hvigorw, ['--stop-daemon'], { cwd: sandboxRepo, stdio: 'inherit', env: { ...buildLease.env, HVIGOR_USER_HOME: hvigorUserHome } });
      existingDaemon = false;
    };
    if (incremental && lstatSync(incompleteBuild, { throwIfNoEntry: false })) {
      if (!lstatSync(sandboxRepo).isDirectory() || !lstatSync(resolve(sandboxRepo, 'entry')).isDirectory()) {
        fail('incremental HAP cache recovery requires real build directories');
      }
      stopSandboxDaemon();
      for (const output of ['.hvigor', 'entry/.cxx', 'entry/build']) rmSync(resolve(sandboxRepo, output), { recursive: true, force: true });
    }
    const moduleProfilePath = resolve(sandboxRepo, 'entry/build-profile.json5');
    const moduleProfile = parseBuildProfile(resolve(REPO_ROOT, 'entry/build-profile.json5'), sourceRecord('entry/build-profile.json5'));
    if (!moduleProfile.buildOption?.externalNativeOptions) fail('entry Native build options are missing');
    moduleProfile.buildOption.externalNativeOptions.abiFilters = [abi];
    const overrides = new Map([['entry/build-profile.json5', { bytes: Buffer.from(JSON.stringify(moduleProfile, null, 2) + '\n'),
      mode: sourceRecord('entry/build-profile.json5').mode }]]);
    if (signingMode === 'local') {
      overrides.set('build-profile.json5', { bytes: Buffer.from(JSON.stringify(signingProfile, null, 2) + '\n'), mode: 0o600 });
    }
    const sandboxBefore = measureBuildStep('copySourceSandbox', () =>
      copySourceSandbox(REPO_ROOT, sandboxRepo, sandboxRoot, { before: sourceBefore, incremental,
        overrides, omitted: [join('entry', 'libs', abi === 'arm64-v8a' ? 'x86_64' : 'arm64-v8a')] }));
    const effectiveModuleProfile = fileRecord(moduleProfilePath, 'module-build-profile.json');
    const effectiveProfile = fileRecord(resolve(sandboxRepo, 'build-profile.json5'), 'build-profile.json5');
    const identityInputPath = resolve(sandboxRepo, '.reader-app-build.json');
    writeSandboxFile(identityInputPath, Buffer.from(JSON.stringify(appIdentity.expectedVersion, null, 2) + '\n'), 0o644);
    const expectedVendor = measureBuildStep('dependencies', () =>
      resolveSandboxDependencies(sandboxRoot, sandboxRepo, sourceBefore, incremental));

    const buildArgs = [
      'assembleHap', '--mode', 'module',
      '-p', 'product=default', '-p', 'module=entry@default', '-p', 'buildMode=debug',
      ...(incremental ? ['--parallel', '--incremental', '--daemon'] : ['--no-daemon', '--no-incremental']),
    ];
    const buildCommand = `${hvigorw} ${buildArgs.join(' ')}`;
    const startedAt = new Date().toISOString();
    const wrapperTools = prepared?.wrapperTools ?? readWrapperTools(buildClass, incremental);
    const { sharedHvigorTools, packageManager } = wrapperTools;
    if (prepared) measureBuildStep('toolchain.verifyPreparedInputs', () => wrapperTools.assertUnchanged());
    const sourceTools = wrapperTools.sourceTools ?? (incremental ? measureBuildStep('toolchain.snapshot', () =>
      contentSnapshot(sharedHvigorTools, ['.'])) : undefined);
    const wrapperToolFingerprint = incremental ? sha256Bytes(JSON.stringify({
      sharedHvigorTools, hvigorw, wrapper: fileRecord(hvigorw).sha256, packageManager, tools: sourceTools.fingerprint,
      project: snapshotSubset(sourceBefore, ['hvigor', 'hvigor-config.json5']).fingerprint,
    })) : undefined;
    const isolatedHvigorTools = resolve(hvigorUserHome, 'wrapper/tools');
    measureBuildStep('toolchain.prepare', () =>
      prepareHvigorWrapperTools(sharedHvigorTools, isolatedHvigorTools, wrapperToolFingerprint, sourceTools, stopSandboxDaemon));
    const signingKey = Buffer.from(sha256Bytes(JSON.stringify([signingMode, signingBefore, effectiveProfile.sha256])));
    const pipelineToken = incremental ? incrementalDaemonToken(sandboxRoot, {
      abi, coreProfile, signing: signingKey.toString(), wrapperToolFingerprint,
      sdkHome: resolveHarmonyTool('sdkHome', { cwd: REPO_ROOT }), toolchain: appIdentity.contentSnapshot.buildIdentityInputs.toolchain,
      jobs: buildLease.env.READER_BUILD_JOBS, cargo: buildLease.env.CARGO_BUILD_JOBS,
      cmake: buildLease.env.CMAKE_BUILD_PARALLEL_LEVEL, lowPriority: buildLease.env.READER_BUILD_LOW_PRIORITY === '1',
    }, stopSandboxDaemon) : randomUUID();
    activeBuildAttempt?.protect(pipelineToken);
    writeSandboxFile(pipelineMarker, Buffer.from(JSON.stringify({
      token: pipelineToken, profileSha256: effectiveProfile.sha256, appIdentitySha256: fileRecord(identityInputPath).sha256,
    })), 0o600);
    markerWritten = true;
    const buildEnvironment = {
      ...buildLease.env,
      READER_HARMONY_ABI: abi,
      READER_HARMONY_CORE_PROFILE: coreProfile,
      HVIGOR_USER_HOME: hvigorUserHome,
      npm_config_cache: resolve(sandboxRoot, 'npm-cache'),
      READER_HAP_PIPELINE_ROOT: sandboxRepo,
      READER_HAP_PIPELINE_TOKEN: pipelineToken,
    };
    const outputDir = resolve(sandboxRepo, 'entry/build/default/outputs/default');
    const signingStamp = resolve(sandboxRoot, 'signing-input.sha256');
    if (incremental) {
      const stamp = lstatSync(signingStamp, { throwIfNoEntry: false });
      if (!stamp?.isFile() || !readFileSync(signingStamp).equals(signingKey)) {
        rmSync(resolve(outputDir, 'entry-default-signed.hap'), { force: true });
      }
      writeSandboxFile(incompleteBuild, Buffer.from(`${process.pid}\n`), 0o600);
    }
    const versionFingerprint = wrapperToolFingerprint && !process.env.HVIGORW
      ? sha256Bytes(JSON.stringify([wrapperToolFingerprint, appIdentity.contentSnapshot.buildIdentityInputs.toolchain]))
      : undefined;
    const hvigorVersion = measureBuildStep('hvigorVersion', () =>
      admittedHvigorVersion(hvigorw, sandboxRepo, buildEnvironment, resolve(sandboxRoot, 'hvigor-version.json'), versionFingerprint));
    const hvigorStarted = performance.now();
    run(hvigorw, buildArgs, {
      cwd: sandboxRepo,
      stdio: 'inherit',
      env: buildEnvironment,
    });
    const hvigorFinished = performance.now();
    const finishedAt = new Date().toISOString();
    afterSnapshots = measureBuildStep('startSourceSnapshotsAfter', () => startRegularInputSnapshots([
      { repo: sandboxRepo, inputs: BUILD_INPUTS, label: 'Isolated build inputs' },
      { repo: REPO_ROOT, inputs: BUILD_INPUTS, label: 'Host build inputs' },
    ]));
    if (signingMode === 'local') {
      const signingAfter = { configuration: fileRecord(localProfile, 'local-signing-config'),
        material: measureBuildStep('signingMaterialAfter', () => signingMaterialSnapshot(signingProfile)) };
      if (JSON.stringify(signingBefore) !== JSON.stringify(signingAfter)) {
        fail('signing configuration or material changed during build; sync the local profile before rebuilding');
      }
    }

    const builtNames = findBuiltHaps(outputDir, signingMode, buildClass);
    const runId = `${timestampId()}-${sourceGitBefore.commit.slice(0, 8)}-${sourceBefore.fingerprint.slice(0, 8)}`;
    const publishedRunDir = resolve(artifactRoot, runId);
    const runDir = resolve(artifactRoot, `.staging-${runId}-${process.pid}`);
    if (existsSync(publishedRunDir) || existsSync(runDir)) {
      fail(`artifact run already exists: ${publishedRunDir}`);
    }
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    unpublishedRunDir = runDir;

    const artifactPaths = measureBuildStep('copyArtifacts', () => builtNames.map(name => {
      const destination = resolve(runDir, name);
      copyFileSync(resolve(outputDir, name), destination, constants.COPYFILE_FICLONE);
      return destination;
    }));
    const expectedBundledSources = sourceRecord(`entry/src/main/${bundledSourceEntry}`);
    if (!expectedBundledSources) fail('bundled source input is missing from the build snapshot');
    const inspected = new Map();
    for (const path of artifactPaths) {
      const started = performance.now();
      try {
        inspected.set(path, await inspectBuiltHapForSeal(path,
          basename(path).endsWith('-signed.hap') ? 'signed' : 'unsigned', basename(path),
          requiredResources, abi, appIdentity.expectedVersion, expectedBundledSources));
      } finally { recordBuildElapsed('inspectHap', started); }
    }
    const artifacts = [...inspected.values()].map(evidence => evidence.artifact);
    if (buildClass === 'acceptance' && !artifacts.some((artifact) => artifact.kind === 'signed')) {
      fail('acceptance build did not produce a signed artifact');
    }

    const waitingForSnapshots = performance.now();
    const [sandboxAfter, sourceAfter] = await afterSnapshots.result;
    activeBuildTimings?.steps.set('awaitSourceSnapshotsAfter', performance.now() - waitingForSnapshots);
    const [sandboxSnapshotMs, sourceSnapshotMs] = afterSnapshots.timingsMs();
    activeBuildTimings?.steps.set('sandboxAfter', sandboxSnapshotMs);
    activeBuildTimings?.steps.set('sourceAfter', sourceSnapshotMs);
    assertSnapshotUnchanged(sandboxBefore, sandboxAfter, 'isolated build inputs');
    assertSnapshotUnchanged(sourceBefore, sourceAfter, 'source worktree build inputs');
    measureBuildStep('resolvedDependenciesAfter', () => assertResolvedCorePackage(sandboxRepo, expectedVendor));
    const controllerAfter = measureBuildStep('controllerAfter', () => controllerSnapshot());
    assertSnapshotUnchanged(harmonyGateBefore, controllerAfter, 'Harmony build controller and gate inputs');
    measureBuildStep('appIdentityAfter', () => assertAppIdentityUnchanged(appIdentity, nativeEnvironment,
      { precomputedRecords: appContentRecords(sourceAfter, controllerAfter) }));
    assertSnapshotUnchanged(workspaceContractBefore, measureBuildStep('workspaceContractAfter', () => workspaceContractSnapshot()),
      'workspace HAP contract and skill inputs');
    const acceptance = buildClass === 'acceptance';
    assertGitRecordUnchanged(sourceGitBefore, measureBuildStep('gitHarmonyAfter', () => gitRecord(REPO_ROOT, acceptance)), 'Harmony source worktree');
    assertGitRecordUnchanged(coreGitBefore, measureBuildStep('gitCoreAfter', () => gitRecord(CORE_ROOT, acceptance)), 'Core source worktree');

    writeJson(resolve(runDir, 'app-content-snapshot.json'), appIdentity.contentSnapshot);
    writeJson(resolve(runDir, 'app-release-ledger.json'), appIdentity.ledger);
    writeJson(resolve(runDir, 'source-snapshot.json'), sourceBefore);
    copyFileSync(moduleProfilePath, resolve(runDir, effectiveModuleProfile.path), constants.COPYFILE_FICLONE);
    writeJson(resolve(runDir, 'controller-snapshot.json'), harmonyGateBefore);
    writeJson(resolve(runDir, 'workspace-contract-snapshot.json'), workspaceContractBefore);
    writeJson(resolve(runDir, 'contract-toolchain-snapshot.json'), contractToolchainBefore);
    const contracts = publishUnrunContractEvidence(runDir);
    let acceptanceProvenance = null;
    const nativeProvenance = [];
    for (const [artifactPath, evidence] of inspected) {
      const { artifact } = evidence;
      const { path: provenance, manifest: provenanceManifest } = measureBuildStep('provenance', () => generateAcceptanceProvenance(
        runDir,
        artifactPath,
        hvigorVersion,
        buildCommand,
        buildClass,
        evidence,
        appIdentity.contentSnapshot.buildIdentityInputs.toolchain.sdk.ets,
        nativeEnvironment,
      ));
      nativeProvenance.push(provenance);
      artifact.storageContract = measureBuildStep('storageDelivery', () =>
        publishStorageDeliveryContract(runDir, artifact, provenanceManifest));
      if (buildClass === 'acceptance' && artifact.kind === 'signed') acceptanceProvenance = provenance;
    }
    const vendoredNapiPath = `entry/libs/${abi}/libreader_core_napi.so`;
    const { bytes, sha256 } = sourceRecord(vendoredNapiPath);
    const vendoredNapi = { path: vendoredNapiPath, bytes, sha256 };
    const manifest = {
      schemaVersion: 2,
      deliveryEvidenceVersion: 1,
      storageEvidenceVersion: 1,
      appIdentitySchema: APP_IDENTITY_SCHEMA,
      expectedVersion: appIdentity.expectedVersion,
      appContentInputs: fileRecord(resolve(runDir, 'app-content-snapshot.json'), 'app-content-snapshot.json'),
      appReleaseLedger: fileRecord(resolve(runDir, 'app-release-ledger.json'), 'app-release-ledger.json'),
      name: 'reader-harmonyos-hap-run',
      abi,
      effectiveModuleProfile,
      nativeProvenance,
      nativeProvenanceInputs: nativeProvenance.map(path => fileRecord(resolve(runDir, path), path)),
      runId,
      buildClass,
      incremental,
      coreProfile,
      acceptanceEligible: false,
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
        harmonyContracts: 'NOT_RUN',
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
        nonIncrementalBuild: incremental ? 'NOT_RUN' : 'PASS',
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
    measureBuildStep('writeManifest', () => writeJson(manifestPath, manifest));
    measureBuildStep('sealVerify', () => verifyManifestWithInspector(manifestPath, (candidate, kind, name, resources, actualAbi, version) => {
      const evidence = inspected.get(candidate);
      if (!evidence || evidence.artifact.kind !== kind || evidence.artifact.path !== name || actualAbi !== abi ||
          JSON.stringify(resources) !== JSON.stringify(evidence.artifact.requiredResources)) {
        fail('staging manifest disagrees with the verified HAP');
      }
      evidence.assertUnchanged(candidate);
      assertAppVersion(version, evidence.artifact.appVersion, 'HAP');
      return { ...evidence.artifact };
    }));
    if (incremental) writeSandboxFile(signingStamp, signingKey, 0o600);
    const recoveryMarkerCleanupError = measureBuildStep('publish', () => publishVerifiedHapRun(runDir, publishedRunDir, () => {
      afterSnapshots.assertUnchanged();
      for (const [artifactPath, evidence] of inspected) evidence.assertUnchanged(artifactPath);
    }, incremental ? incompleteBuild : undefined));
    unpublishedRunDir = null;
    if (recoveryMarkerCleanupError) {
      console.warn(`Published HAP run ${runId}. The recovery marker remains at ${incompleteBuild}. ` +
        `The next incremental build requires cache recovery. ${recoveryMarkerCleanupError.message}`);
    }
    console.log(JSON.stringify({
      status: 'PASS',
      runId,
      appBuildId: appIdentity.expectedVersion.appBuildId,
      expectedVersion: appIdentity.expectedVersion,
      buildClass,
      incremental,
      timingsMs: { pre: Math.round(hvigorStarted - buildStarted), hvigor: Math.round(hvigorFinished - hvigorStarted),
        post: Math.round(performance.now() - hvigorFinished) },
      ...(activeBuildTimings ? { timingBreakdownMs: buildTimingBreakdown() } : {}),
      contractsScope: contracts.scope,
      harmonyContracts: manifest.gates.harmonyContracts,
      selectedStatus: contracts.selectedStatus,
      fullSuite: contracts.fullSuite,
      manifest: resolve(publishedRunDir, 'manifest.json'),
      artifacts: artifacts.map(({ kind, path, sha256, signature }) => ({ kind, path, sha256, signature })),
    }));
  } finally {
    try {
      await afterSnapshots?.stop();
      if (unpublishedRunDir !== null) rmSync(unpublishedRunDir, { recursive: true, force: true });
      if (markerWritten) rmSync(pipelineMarker, { force: true });
    } finally { buildLease.release(); }
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

function publishUnrunContractEvidence(runDir) {
  const inventory = readdirSync(resolve(REPO_ROOT, 'tools')).filter(name => /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  mkdirSync(resolve(runDir, 'contracts'), { recursive: true });
  const path = resolve(runDir, 'contracts/policy.json');
  copyFileSync(resolve(REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT), path);
  return { scope: 'none', selectedStatus: 'NOT_RUN', fullSuite: 'NOT_RUN', selected: [], omitted: inventory,
    inventoryCount: inventory.length, policy: fileRecord(path, 'contracts/policy.json') };
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

function verifyManifestWithInspector(path, inspector) {
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

export function latestHapInstallReceipt(directory, { targetKind, targetRef }) {
  if (!['vm', 'physical'].includes(targetKind) || !/^[a-f0-9]{12}$/.test(targetRef)) fail('invalid deployment receipt target');
  const prefix = `deploy-${targetKind}-${targetRef}-`;
  const receipts = readdirSync(directory).filter(file => file.startsWith(prefix) && file.endsWith('.json')).map(file => {
    const receipt = retentionJson(resolve(directory, file));
    if (!Number.isFinite(Date.parse(receipt.completedAt))) fail(`invalid receipt completion time: ${file}`);
    return { file, receipt };
  }).sort((left, right) => Date.parse(right.receipt.completedAt) - Date.parse(left.receipt.completedAt));
  if (receipts.length > 1 && Date.parse(receipts[0].receipt.completedAt) === Date.parse(receipts[1].receipt.completedAt)) {
    fail('ambiguous latest deployment receipt');
  }
  return receipts[0];
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
  for (const path of ['scripts/hap-pipeline.mjs', 'scripts/lib/hap-storage-admission.mjs']) {
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

function inspectDeployment(options) {
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

function usage() {
  console.error(`Usage:
  node scripts/hap-pipeline.mjs identity [--channel DEV] [--abi arm64-v8a|x86_64] [--build-mode debug|release]
  node scripts/hap-pipeline.mjs build [--class iteration|acceptance] [--incremental] [--channel DEV|RC|REL] [--abi arm64-v8a|x86_64] [--core-profile release|smoke] [--signing auto|local|unsigned] [--live-source-ids <exact IDs> --rationale <necessity>] [--keep-runs 10] [--core-gate-receipt <receipt.json>]
  node scripts/hap-pipeline.mjs prune [--artifact-root <directory>] [--keep-runs 10] [--apply]
  node scripts/hap-pipeline.mjs sync-signing [--profile <private-local-profile.json5>]
  node scripts/hap-pipeline.mjs sync-native [--abi arm64-v8a|x86_64] [--core-profile release|smoke] [sync-core alias]
  node scripts/hap-pipeline.mjs verify --manifest <manifest.json>
  node scripts/hap-pipeline.mjs inspect --manifest <manifest.json> --artifact signed --target <exact> <route flags>
  node scripts/hap-pipeline.mjs install --manifest <manifest.json> --artifact signed --target <exact> <route flags> [--no-launch]

Deployment routes:
  Remote VM   --target-kind vm --vm-location remote
              Server ${REMOTE_VM_HDC_SERVER}. Use a matching signed HAP (x86_64 for this remote VM) and live guest readiness.
              Omit --vm-log for guest-only readiness. A supplied current log is also validated.
  Local VM    --target-kind vm --vm-location local --vm-log <current-emulator.log>
              Server ${LOCAL_HDC_SERVER}. Use the confirmed current local instance log.
  Physical    --target-kind physical
              Server ${LOCAL_HDC_SERVER}. Requires a separately connected physical target.

Discover the exact target on the selected server with reader-hdc-lease.mjs list targets -v.
The server endpoint and target ID are distinct, even when the remote server lists its target as a loopback address.
Emulator.log and a snapshot companion qemu.log are startup/readiness evidence. Frame timing comes from the UI collector.`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  const options = parseOptions(process.argv.slice(3));
  if (command !== 'build' && options.has('--incremental')) fail('--incremental applies only to build', 2);
  if (command === 'identity') {
    const session = prepareAppIdentity(REPO_ROOT, APP_CONTENT_INPUTS, {
      abi: resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI)),
      channel: option(options, '--channel', process.env.READER_APP_CHANNEL),
      buildMode: option(options, '--build-mode', 'debug'),
    });
    console.log(JSON.stringify({ status: 'PLAN_ONLY', expectedVersion: session.expectedVersion,
      buildIdentityInputs: session.contentSnapshot.buildIdentityInputs, fileCount: session.contentSnapshot.files.length }));
  }
  else if (command === 'build') await build(options);
  else if (command === 'sync-signing') syncSigning(options);
  else if (command === 'sync-native' || command === 'sync-core') {
    for (const key of options.keys()) if (!['--abi', '--core-profile'].includes(key)) fail(`unknown sync-native argument: ${key}`, 2);
    const abi = resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI));
    const profile = resolveCoreProfile(option(options, '--core-profile', process.env.READER_HARMONY_CORE_PROFILE));
    withArtifactLock(env => syncNative({ ...env, READER_HARMONY_ABI: abi, READER_HARMONY_CORE_PROFILE: profile }));
  }
  else if (command === 'verify') {
    const verified = verifyManifest(requiredOption(options, '--manifest'));
    console.log(JSON.stringify({
      status: 'PASS',
      runId: verified.manifest.runId,
      appBuildId: verified.manifest.expectedVersion?.appBuildId,
      appIdentity: verified.manifest.expectedVersion ? 'PASS' : 'LEGACY_NOT_PRESENT',
      incremental: verified.manifest.incremental,
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
    () => installDeployment(options)), { preflight: true });
  else if (command === 'prune') {
    const plan = planHapRetention(resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT)), retentionLimit(options));
    console.log(JSON.stringify(options.get('--apply') === true ? applyHapRetention(plan) : plan, null, 2));
  }
  else {
    usage();
    fail(`unknown command: ${command}`, 2);
  }
}

if (!isMainThread && workerData?.hapNativePreflight) {
  const started = performance.now();
  let failure;
  try {
    run(process.execPath, workerData.hapNativePreflight);
  } catch (error) {
    failure = { name: error.name, message: error.message, code: error.code, exitCode: error.exitCode };
  }
  parentPort.postMessage({ milliseconds: performance.now() - started, error: failure });
} else if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  }
}
