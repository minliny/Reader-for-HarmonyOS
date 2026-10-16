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
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool } from './lib/harmony-toolchain.mjs';
import { assertPrivateFilePermissions } from './lib/private-file.cjs';
import { performance } from 'node:perf_hooks';
import { readSigningAuthority, assertSigningMaterialAuthority, assertSigningCertificateAuthority } from '../tools/reader-signing-authority.mjs';
import { assertBuildTools } from '../tools/reader-build-tools.mjs';
import { contentSnapshot, coreBuildSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';
import { acquireBuildWorkspace } from '../../Reader-Core-Native/scripts/lib/build-resource-lock.mjs';
import { assertWorkspaceLayout } from '../../Reader-Core-Native/scripts/lib/development-environment.mjs';
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, publishCoreGate, verifyPublishedCoreGate, targetReadiness } from './lib/hap-delivery-evidence.mjs';
import { hapStageReceipt } from './lib/hap-stage-receipt.mjs';
import { contractTests, contractSelection, MAX_CONTRACT_TIMEOUT_MS } from '../tools/run-contract-tests.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const WORKSPACE_ROOT = resolve(REPO_ROOT, '..');
const CORE_ROOT = resolve(WORKSPACE_ROOT, 'Reader-Core-Native');
const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, '.reader-artifacts/hap');
const DEFAULT_RETAIN_RUNS = 10;
const LOCK_ROOT = resolve(process.env.READER_LOCK_DIR || tmpdir());
const ARTIFACT_LOCK = join(LOCK_ROOT, 'reader-harmony-hap-build.lock');
const DEFAULT_SIGNING_PROFILE = resolve(REPO_ROOT, '.reader-local/signing/build-profile.json5');
const HDC_LEASE_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-lease.mjs');
const HDC_SERVER = process.env.READER_HDC_SERVER_KEY ?? '::ffff:127.0.0.1:8710';
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
  'Reader-Core-Native/governance/workspace',
  'Reader-Core-Native/scripts/sync-workspace.mjs',
  'Reader-Core-Native/scripts/validate-workspace.py',
  'Reader-Core-Native/scripts/lib',
  'Reader-Core-Native/scripts/check-local.mjs',
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
function runTargetHdc(hdc, target, args, options = {}) {
  const leaseArgs = [HDC_LEASE_SCRIPT, '--target', target, '--hdc', hdc,
    '--server-key', HDC_SERVER,
    ...(options.waitMs === undefined ? [] : ['--wait-ms', String(options.waitMs)]), '--', '-s', HDC_SERVER, ...args];
  return run(process.execPath, leaseArgs, options);
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
  acquireLock(ARTIFACT_LOCK, { pid: process.pid, repo: REPO_ROOT, startedAt: new Date().toISOString() });
  try { return action(); } finally { rmSync(ARTIFACT_LOCK, { recursive: true, force: true }); }
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

function inspectHap(hapPath, kind, publicPath = basename(hapPath), requiredResources) {
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

export function verifyIdeSignedHap(path, session) {
  assertIdeSigningUnchanged(session);
  const artifact = inspectHap(path, 'signed', basename(path), requiredHapResources(REPO_ROOT));
  if (artifact.signature.status !== 'signed' || artifact.signature.verified !== true) {
    fail('DevEco build did not produce a verified signed HAP.');
  }
  return artifact;
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
  };
}

export function requireAcceptanceInputs(coreRoot = CORE_ROOT, env = process.env) {
  const inputs = nativeInputPaths(coreRoot, env);
  for (const [label, path] of Object.entries(inputs)) {
    if (!existsSync(path)) fail(`acceptance input missing (${label}): ${path}`);
  }
  return inputs;
}

function nativeProvenanceArguments() {
  const inputs = requireAcceptanceInputs();
  return [
    '--core-repo', CORE_ROOT, '--harmony-repo', REPO_ROOT,
    '--core-identity', inputs.identity, '--core-input-snapshot', inputs.inputSnapshot,
    '--napi-manifest', inputs.packageManifest, '--native-so', inputs.nativeSo,
    '--app-native-so', resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
    '--harmony-vendor', resolve(REPO_ROOT, 'entry/vendor/core-harmony'),
    '--core-build-evidence', inputs.buildEvidence,
  ];
}

export function preflightIdeNative() {
  assertWorkspaceLayout(WORKSPACE_ROOT);
  const directory = mkdtempSync(join(tmpdir(), 'reader-ide-native-'));
  try {
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...nativeProvenanceArguments(), '--preflight', '--allow-dirty',
      '--output', resolve(directory, 'preflight.json')]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

// Synchronize local build inputs through the same provenance checker used by
// HAP builds. Never download a binary or silently accept an older package.
function syncNative() {
  const inputs = requireAcceptanceInputs();
  const packageRoot = resolve(dirname(inputs.packageManifest), 'package');
  const localRoot = resolve(REPO_ROOT, '.reader-local/native-sync');
  for (const path of [localRoot, resolve(REPO_ROOT, 'entry/vendor'), resolve(REPO_ROOT, 'entry/libs/arm64-v8a')]) {
    for (let parent = path; parent !== REPO_ROOT; parent = dirname(parent)) {
      const stat = lstatSync(parent, { throwIfNoEntry: false });
      if (stat && !stat.isDirectory()) fail('Native synchronization parents must be real directories');
    }
  }
  mkdirSync(localRoot, { recursive: true });
  const stage = mkdtempSync(join(localRoot, 'sync-'));
  const stagedSdk = join(stage, 'sdk');
  const stagedNative = join(stage, 'libreader_core_napi.so');
  const sdk = resolve(REPO_ROOT, 'entry/vendor/core-harmony');
  const native = resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so');
  const sdkBackup = join(stage, 'previous-sdk');
  const nativeBackup = join(stage, 'previous-native.so');
  let sdkMoved = false, nativeMoved = false, sdkInstalled = false, nativeInstalled = false;
  try {
    if (!lstatSync(inputs.nativeSo).isFile()) fail('Native package must contain a regular SO');
    cpSync(packageRoot, stagedSdk, { recursive: true,
      filter: path => relative(packageRoot, path).split(sep)[0] !== 'libs' });
    copyFileSync(inputs.nativeSo, stagedNative);
    const args = nativeProvenanceArguments();
    args[args.indexOf('--app-native-so') + 1] = stagedNative;
    args[args.indexOf('--harmony-vendor') + 1] = stagedSdk;
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...args, '--preflight', '--allow-dirty', '--output', join(stage, 'preflight.json')]);
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
    if (existsSync(sdk)) { renameSync(sdk, sdkBackup); sdkMoved = true; }
    if (existsSync(native)) { renameSync(native, nativeBackup); nativeMoved = true; }
    renameSync(stagedSdk, sdk); sdkInstalled = true;
    renameSync(stagedNative, native); nativeInstalled = true;
    console.log(JSON.stringify({ status: 'PASS', operation: 'sync-native',
      nativeSha256: fileRecord(native).sha256, recovery: stage }));
  } catch (error) {
    if (nativeInstalled) rmSync(native);
    if (sdkInstalled) rmSync(sdk, { recursive: true });
    if (nativeMoved) renameSync(nativeBackup, native);
    if (sdkMoved) renameSync(sdkBackup, sdk);
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
  const allowed = ['--class', '--signing', '--live-sources', '--keep-runs', '--artifact-root', '--contracts-scope', '--core-gate-receipt'];
  for (const key of options.keys()) if (!allowed.includes(key)) fail(`unknown build argument: ${key}`, 2);
  const buildClass = option(options, '--class', 'iteration');
  if (!['iteration', 'acceptance'].includes(buildClass)) fail('--class must be iteration or acceptance', 2);
  const scope = options.has('--contracts-scope') ? requiredOption(options, '--contracts-scope') : undefined;
  if (scope !== undefined && (buildClass !== 'iteration' || scope !== 'manga-image-cache')) {
    fail('--contracts-scope manga-image-cache is only supported for iteration builds', 2);
  }
  contractTests(root, 'full', scope);
  return scope;
}

export function remainingContractBudget(started, reserveMs = 0) {
  const remaining = Math.floor(MAX_CONTRACT_TIMEOUT_MS - (performance.now() - started) - reserveMs);
  if (remaining <= 0) fail('scope total deadline exceeded');
  return remaining;
}

function build(options) {
  buildContractScope(options); // Invalid CLI arguments are not build attempts.
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
  if (buildClass === 'acceptance') currentCoreGate(coreGateFile, CORE_ROOT);
  const requiredResources = requiredHapResources(REPO_ROOT);

  const buildLease = acquireBuildWorkspace({ create: () => mkdtempSync(join(tmpdir(), 'reader-hap-build-')), remove: path => rmSync(path, { recursive: true, force: true }) });
  const sandboxRoot = buildLease.path;
  let unpublishedRunDir = null;
  let contractGateState = null;
  try {
    run(process.execPath, [resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      ...nativeProvenanceArguments(), '--preflight', '--output', resolve(sandboxRoot, 'native-preflight.json'),
      ...(buildClass === 'iteration' ? ['--allow-dirty'] : []),
    ]);
    const artifactRoot = resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT));
    const keepRuns = retentionLimit(options);
    const retention = applyHapRetention(planHapRetention(artifactRoot, keepRuns, 1));
    console.log(JSON.stringify({ stage: 'artifactRetention', keepRuns, ...retention }));
    const harmonyGateBefore = controllerSnapshot();
    const contractPolicy = JSON.parse(readFileSync(resolve(REPO_ROOT, CONTRACT_EVIDENCE_POLICY_INPUT), 'utf8'));
    if (contractPolicy.schemaVersion !== 1 || contractPolicy.name !== 'reader-harmony-contract-evidence-policy' ||
        contractPolicy.contractsReceiptRequired !== true || !controllerRequiresContractEvidence(harmonyGateBefore)) {
      fail('current HAP controller requires the contract evidence policy');
    }
    const workspaceContractBefore = workspaceContractSnapshot();
    const contractToolchainBefore = contractToolchainSnapshot();
    const sourceBefore = sourceSnapshot(REPO_ROOT);
    const sourceGitBefore = gitRecord(REPO_ROOT);
    const coreGitBefore = gitRecord(CORE_ROOT);
    if (sourceGitBefore.commit !== harmonyGit.commit || coreGitBefore.commit !== coreGit.commit) {
      fail('repository HEAD changed before the build snapshot was captured');
    }
    contractGateState = { started: performance.now(), scope: contractsScope ?? 'full' };
    console.log(JSON.stringify({ stage: 'harmonyContracts', event: 'start', scope: contractGateState.scope,
      deadlineMs: contractsScope === undefined ? null : MAX_CONTRACT_TIMEOUT_MS, startedAt: new Date().toISOString() }));
    run(process.execPath, [resolve(WORKSPACE_ROOT, 'scripts/check-hap-build-system.mjs')], {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
      timeoutMs: contractsScope === undefined ? undefined : remainingContractBudget(contractGateState.started),
    });
    const contractsResultPath = resolve(sandboxRoot, 'contracts-results.json');
    const contractEnvironment = { ...process.env, READER_CONTRACT_RESULTS_FILE: contractsResultPath,
      READER_CONTRACT_TEST_TIMEOUT_MS: String(MAX_CONTRACT_TIMEOUT_MS) };
    if (contractsScope === undefined) {
      run(process.execPath, [resolve(REPO_ROOT, 'scripts/check-local.mjs')], { cwd: REPO_ROOT, stdio: 'inherit', env: contractEnvironment });
    } else {
      run(process.execPath, ['tools/generate-theme-registry.mjs', '--check'], { cwd: REPO_ROOT, stdio: 'inherit',
        timeoutMs: remainingContractBudget(contractGateState.started) });
      // Leave time for TERM/KILL cleanup and the input fences within the same
      // pipeline budget. The standalone scoped CLI still starts with 110s.
      contractEnvironment.READER_CONTRACT_SCOPE_TIMEOUT_MS = String(remainingContractBudget(contractGateState.started, 2_000));
      run(process.execPath, ['tools/run-contract-tests.mjs', '--scope', contractsScope],
        { cwd: REPO_ROOT, stdio: 'inherit', env: contractEnvironment,
          timeoutMs: remainingContractBudget(contractGateState.started) });
    }
    const contractResults = JSON.parse(readFileSync(contractsResultPath, 'utf8'));
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
    if (options.get('--live-sources') === true) {
      const liveStarted = performance.now();
      console.log(JSON.stringify({ stage: 'liveBookSources', event: 'start', deadlineMs: MAX_CONTRACT_TIMEOUT_MS }));
      try {
        run(process.execPath, ['tools/verify-bundled-test-book-sources-live.mjs'], {
          cwd: REPO_ROOT, stdio: 'inherit', timeoutMs: MAX_CONTRACT_TIMEOUT_MS,
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
    const packageManager = assertBuildTools(sharedHvigorTools);
    const isolatedHvigorTools = resolve(hvigorUserHome, 'wrapper/tools');
    mkdirSync(isolatedHvigorTools, { recursive: true });
    cpSync(sharedHvigorTools, isolatedHvigorTools, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
    const buildEnvironment = {
      ...buildLease.env,
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
    assertSnapshotUnchanged(contractToolchainBefore, contractToolchainSnapshot(), 'contract toolchain inputs');

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
    const contracts = publishContractEvidence(runDir, contractResults, contractsScope, {
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
      if (buildClass === 'acceptance' && artifact.kind === 'signed') acceptanceProvenance = provenance;
    }
    const vendoredNapi = fileRecord(
      resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
      'entry/libs/arm64-v8a/libreader_core_napi.so',
    );
    const manifest = {
      schemaVersion: 2,
      deliveryEvidenceVersion: 1,
      name: 'reader-harmonyos-hap-run',
      nativeProvenance,
      runId,
      buildClass,
      acceptanceEligible: buildClass === 'acceptance',
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
        coreDevelopment: buildClass === 'acceptance' ? publishCoreGate(coreGateFile, runDir, CORE_ROOT) : { status: 'NOT_RUN' },
        requiredResourceBytes: 'PASS',
        harmonyContracts: contractsScope === undefined ? 'PASS' : 'PARTIAL',
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
        liveBookSources: options.get('--live-sources') === true ? 'PASS' : 'NOT_RUN',
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
    renameSync(runDir, publishedRunDir);
    unpublishedRunDir = null;
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
  if (report.schemaVersion !== 1 || report.name !== 'reader-harmony-contract-results' || report.tier !== 'full' ||
      report.scope !== (scope ?? 'full') || !Number.isInteger(report.workers) || report.workers < 1 || report.workers > 4 ||
      !Number.isInteger(report.timeoutMs) || report.timeoutMs <= 0 || report.timeoutMs > MAX_CONTRACT_TIMEOUT_MS ||
      !Number.isInteger(report.killGraceMs) || report.killGraceMs <= 0 || report.killGraceMs > 1_000) {
    fail('contract evidence execution policy is invalid');
  }
  if (report.scopeExpired !== false || !Array.isArray(report.unrun) || report.unrun.length !== 0 ||
      !Number.isInteger(report.millisecondsTotal) || report.millisecondsTotal < 0 ||
      !Number.isInteger(report.pipelineGateMilliseconds) || report.pipelineGateMilliseconds < report.millisecondsTotal ||
      (scope === undefined ? report.scopeTimeoutMs !== null :
        !Number.isInteger(report.scopeTimeoutMs) || report.scopeTimeoutMs <= 0 || report.scopeTimeoutMs > MAX_CONTRACT_TIMEOUT_MS ||
        report.millisecondsTotal > report.scopeTimeoutMs || report.pipelineGateMilliseconds > MAX_CONTRACT_TIMEOUT_MS)) {
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
    if (row.status !== 0 || row.signal !== null || row.error != null || row.timedOut !== false || row.scopeTimedOut !== false ||
        !Array.isArray(row.termination) || row.termination.length !== 0 ||
        !Number.isInteger(row.milliseconds) || row.milliseconds < 0 || row.milliseconds > report.millisecondsTotal || !Number.isFinite(row.wallMilliseconds)) {
      fail(`contract evidence contains an unsuccessful result: ${row.name}`);
    }
  }
}

export function publishContractEvidence(runDir, report, scope, inputs, root = REPO_ROOT) {
  const selection = contractTests(root, 'full', scope);
  checkContractResults(report, selection, scope);
  const directory = resolve(runDir, 'contracts');
  mkdirSync(resolve(directory, 'logs'), { recursive: true });
  const selectionPath = resolve(directory, 'selection.json');
  copyFileSync(resolve(root, 'tools/contract-test-tiers.json'), selectionPath);
  const results = report.results.map(row => {
    if (!lstatSync(row.log).isFile()) fail('contract log must be a regular file');
    const name = `contracts/logs/${row.name}.log`, path = resolve(runDir, name);
    copyFileSync(row.log, path);
    return { name: row.name, status: row.status, signal: row.signal, error: row.error ?? null,
      timedOut: row.timedOut, scopeTimedOut: row.scopeTimedOut, termination: row.termination, milliseconds: row.milliseconds,
      wallMilliseconds: row.wallMilliseconds, log: fileRecord(path, name) };
  });
  const receiptPath = resolve(directory, 'results.json');
  writeJson(receiptPath, { ...report, inputs, selection: fileRecord(selectionPath, 'contracts/selection.json'), results });
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
  if (contracts === undefined) {
    // Pre-policy v2 controllers produced full receipts with no detailed test
    // ledger. Preserve that format only when its actual snapshot proves it.
    if (receiptRequired || manifest.gates?.harmonyContracts !== 'PASS' || manifest.gates?.contractToolchainInputs !== undefined) {
      fail('scoped contract evidence is missing');
    }
    return;
  }
  if (!receiptRequired) fail('contract receipt is not bound to its controller policy');
  if (!['full', 'manga-image-cache'].includes(contracts.scope) ||
      !['iteration', 'acceptance'].includes(manifest.buildClass) || manifest.acceptanceEligible !== (manifest.buildClass === 'acceptance')) {
    fail('contract evidence build class is inconsistent');
  }
  const scope = contracts.scope === 'full' ? undefined : contracts.scope;
  if (scope !== undefined && (scope !== 'manga-image-cache' || manifest.buildClass !== 'iteration' || manifest.acceptanceEligible !== false)) {
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
    if (loaded.manifest.buildClass === 'acceptance') {
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

export function deploymentRoute({ targetKind, installed, artifact }) {
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

function hdcBinary() {
  return resolveHarmonyTool('hdc', { cwd: REPO_ROOT });
}

function targetReference(target) {
  return sha256Bytes(target).slice(0, 12);
}

function assertTargetConnected(hdc, target) {
  const output = runTargetHdc(hdc, target, ['list', 'targets', '-v']).stdout?.trim() ?? '';
  const match = output.split('\n').find((line) => line.split(/\s+/)[0] === target);
  if (match === undefined || !/Connected/i.test(match)) fail('the exact HDC target is not connected');
}

function installedMetadata(hdc, target) {
  const result = runTargetHdc(hdc, target, ['-t', target, 'shell', `bm dump -n ${BUNDLE_NAME}`], { allowFailure: true });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  // Harmony's generic lookup error also covers missing bundles. Require a
  // successful, structurally valid inventory before admitting a new install.
  if (result.status === 0 && output.trim() === BUNDLE_LOOKUP_UNAVAILABLE) {
    const listing = runTargetHdc(hdc, target, ['-t', target, 'shell', 'bm dump -a'], { allowFailure: true });
    if (listing.status === 0 && !listing.stderr?.trim()) {
      return parseBundleMetadata(output, listing.stdout ?? '');
    }
  }
  return parseBundleMetadata(output);
}

function resolveDeployment(options) {
  const manifestPath = requiredOption(options, '--manifest');
  const artifactKind = requiredOption(options, '--artifact');
  if (!['signed', 'unsigned'].includes(artifactKind)) fail('--artifact must be signed or unsigned', 2);
  const target = requiredOption(options, '--target');
  const targetKind = requiredOption(options, '--target-kind');
  if (!['vm', 'physical'].includes(targetKind)) fail('--target-kind must be vm or physical', 2);
  const verified = verifyManifest(manifestPath);
  const artifact = verified.artifacts.find((candidate) => candidate.kind === artifactKind);
  if (artifact === undefined) fail(`manifest does not contain a ${artifactKind} artifact`);
  const artifactPath = resolve(verified.directory, artifact.path);
  const hdc = hdcBinary();
  assertTargetConnected(hdc, target);
  const readiness = targetReadiness({ targetKind, vmLog: option(options, '--vm-log'),
    query: command => capture(process.execPath, [HDC_LEASE_SCRIPT, '--target', target, '--hdc', hdc,
      '--server-key', HDC_SERVER, '--', '-s', HDC_SERVER, '-t', target, 'shell', command], { timeoutMs: 10_000, maxBuffer: 1024 * 1024 }) });
  const installed = installedMetadata(hdc, target);
  const route = deploymentRoute({ targetKind, installed, artifact });
  return {
    verified,
    artifact,
    artifactPath,
    hdc,
    target,
    targetKind,
    targetRef: targetReference(target),
    installed,
    route,
    readiness,
  };
}

function inspectDeployment(options) {
  const resolved = resolveDeployment(options);
  console.log(JSON.stringify({
    status: resolved.route.allowed ? 'PASS' : 'STOP',
    runId: resolved.verified.manifest.runId,
    targetKind: resolved.targetKind,
    targetRef: resolved.targetRef,
    artifact: {
      kind: resolved.artifact.kind,
      sha256: resolved.artifact.sha256,
      signature: resolved.artifact.signature,
    },
    installed: resolved.installed,
    route: resolved.route,
    readiness: resolved.readiness,
  }, null, 2));
  if (!resolved.route.allowed) process.exitCode = 3;
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
  try {
    const resolved = resolveDeployment(options);
    if (!resolved.route.allowed) fail(`deployment stopped: ${resolved.route.reason}`, 3);
    // A successful install followed by a failed launch must still protect the
    // package. Keep this marker across errors/crashes until a full receipt exists.
    const installProtection = resolve(resolved.verified.directory,
      `retention-install-${resolved.targetKind}-${resolved.targetRef}.json`);
    writeJson(installProtection, { name: 'reader-hap-install-protection',
      runId: resolved.verified.manifest.runId, startedAt: new Date().toISOString() });
    const install = runTargetHdc(resolved.hdc, resolved.target, [
      '-t', resolved.target, 'install', '-r', resolved.artifactPath,
    ], { allowFailure: true });
    const installOutput = `${install.stdout ?? ''}\n${install.stderr ?? ''}`;
    if (install.status !== 0 || !installOutput.includes('install bundle successfully')) {
      if (installOutput.includes('9568332')) fail('9568332 install sign info inconsistent; data was preserved', 3);
      if (installOutput.includes('9568320')) fail('9568320 no signature file; data was preserved', 3);
      fail(`HAP install failed while preserving data: ${installOutput.trim()}`, 3);
    }
    const postInstall = installedMetadata(resolved.hdc, resolved.target);
    const installedRoute = deploymentRoute({ targetKind: resolved.targetKind,
      installed: postInstall, artifact: resolved.artifact });
    if (!postInstall.bundlePresent || !installedRoute.allowed) {
      fail('HAP was installed but its reported signing identity does not match; stopped before launch without uninstalling', 3);
    }
    let launch = 'NOT_RUN';
    if (options.get('--no-launch') !== true) {
      const start = runTargetHdc(resolved.hdc, resolved.target, [
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
      targetRef: resolved.targetRef,
      artifact: {
        kind: resolved.artifact.kind,
        sha256: resolved.artifact.sha256,
        signature: resolved.artifact.signature,
      },
      dataPolicy: 'preserve',
      readiness: resolved.readiness,
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
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function usage() {
  console.error(`Usage:
  node scripts/hap-pipeline.mjs build [--class iteration|acceptance] [--contracts-scope manga-image-cache] [--signing auto|local|unsigned] [--live-sources] [--keep-runs 10] [--core-gate-receipt <receipt.json>]
  node scripts/hap-pipeline.mjs prune [--artifact-root <directory>] [--keep-runs 10] [--apply]
  node scripts/hap-pipeline.mjs sync-signing [--profile <private-local-profile.json5>]
  node scripts/hap-pipeline.mjs sync-native [sync-core alias]
  node scripts/hap-pipeline.mjs verify --manifest <manifest.json>
  node scripts/hap-pipeline.mjs inspect --manifest <manifest.json> --artifact signed|unsigned --target <exact> --target-kind vm|physical [--vm-log <current-emulator.log>]
  node scripts/hap-pipeline.mjs install --manifest <manifest.json> --artifact signed|unsigned --target <exact> --target-kind vm|physical [--no-launch]`);
}

function main() {
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
  } else if (command === 'inspect') inspectDeployment(options);
  else if (command === 'install') withHapRunLock(dirname(resolve(requiredOption(options, '--manifest'))),
    () => installDeployment(options));
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
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  }
}
