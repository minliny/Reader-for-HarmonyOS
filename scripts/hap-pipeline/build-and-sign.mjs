import { randomUUID, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { chmodSync, constants, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { stripVTControlCharacters } from 'node:util';
import { Worker } from 'node:worker_threads';
import { contentSnapshot, coreBuildSnapshot } from '../../../Reader-Core/scripts/build-input-snapshot.mjs';
import { acquireBuildLease } from '../../../Reader-Core/scripts/lib/build-resource-lock.mjs';
import { assertWorkspaceLayout } from '../../../Reader-Core/scripts/lib/development-environment.mjs';
import { generateBuildProvenance } from '../../tools/generate-build-provenance-manifest.mjs';
import { readSigningAuthority, assertSigningMaterialAuthority,
  assertSigningCertificateAuthority } from '../../tools/reader-signing-authority.mjs';
import { assertBuildTools } from '../../tools/reader-build-tools.mjs';
import { selectBundledSources } from '../../tools/verify-bundled-test-book-sources-live.mjs';
import { withHapZip } from '../lib/hap-zip-reader.mjs';
import { canOverlapHapSignature, startHapSignatureProcess } from '../lib/hap-signature-process.mjs';
import { regularInputSnapshot, sameIdentity, snapshotFileRecords as snapshottedFiles,
  startRegularInputSnapshots, captureSealedInputSnapshot } from '../lib/regular-input-snapshot.mjs';
import { portableSpawnSync, resolveHarmonyTool } from '../lib/harmony-toolchain.mjs';
import { assertPrivateFilePermissions } from '../lib/private-file.cjs';
import { requiredHapResources, verifyRequiredHapResources, currentCoreGate, publishCoreGate,
  publishVerifiedHapRun } from '../lib/hap-delivery-evidence.mjs';
import { embeddedStorageCompatibility } from '../lib/hap-storage-admission.mjs';
import { publishStorageDeliveryContract, storageBootstrapIdentityBytes,
  STORAGE_BOOTSTRAP_RESOURCE } from '../lib/storage-delivery-contract.mjs';
import { hapStageReceipt } from '../lib/hap-stage-receipt.mjs';
import { APP_IDENTITY_SCHEMA, packagedAppVersion, assertAppVersion } from '../lib/app-build-identity.mjs';
import { prepareAppIdentity, assertAppIdentityUnchanged } from '../lib/app-build-context.mjs';
import { assertCleanMainline } from '../lib/hap-mainline-provenance.mjs';
import { DEFAULT_ARTIFACT_ROOT, DEFAULT_RETAIN_RUNS, acquireHapBuildWorkspace, applyHapRetention,
  planHapRetention, timestampId, writeJson } from './locks-and-retention.mjs';
import { HAP_PIPELINE_ENTRY, REPO_ROOT, WORKSPACE_ROOT, CORE_ROOT, BUILD_INPUTS, DEPENDENCY_INPUTS,
  APP_CONTENT_INPUTS, CONTRACT_EVIDENCE_POLICY_INPUT, appContentRecords, assertGitRecordUnchanged,
  assertResolvedCorePackage, assertSnapshotUnchanged, controllerRequiresContractEvidence, controllerSnapshot,
  fail, fileRecord, sha256Bytes, snapshotDescriptor, snapshotSubset, sourceSnapshot, workspaceContractSnapshot } from './workspace-fingerprint.mjs';

const DEFAULT_SIGNING_PROFILE = resolve(REPO_ROOT, '.reader-local/signing/build-profile.json5');

export const BUNDLE_NAME = 'io.reader.minliny';
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

/** Return true only when Hvigor exited cleanly from an ArkTS compile error without daemon or native/packaging failure. */
export function isCleanArkTsCompileFailure(result) {
  if (!result || result.error !== undefined || (result.signal !== null && result.signal !== undefined)) return false;
  if (!Number.isInteger(result.status) || result.status === 0) return false;
  const output = stripVTControlCharacters(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (!/> hvigor ERROR: Failed :entry:default@CompileArkTS\b/.test(output)) return false;
  if (!/COMPILE RESULT:FAIL\s*\{ERROR:\d+/.test(output)) return false;
  if (/Server has disconnected|ABORT_WORK|Failed :entry:default@(?:BuildNative|ConfigureCmake|PackageHap|SignHap|ProcessLibs|DoNativeStrip)/i.test(output)) {
    return false;
  }
  return true;
}

const LIVE_SOURCE_TIMEOUT_MS = 110_000;

let activeBuildAttempt;
let activeBuildTimings;

export function measureBuildStep(label, action) {
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
  const worker = new Worker(HAP_PIPELINE_ENTRY, { workerData: { hapNativePreflight: args } });
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

export function runNativePreflightWorker(args) {
  const started = performance.now();
  let failure;
  try {
    run(process.execPath, args);
  } catch (error) {
    failure = { name: error.name, message: error.message, code: error.code, exitCode: error.exitCode };
  }
  return { milliseconds: performance.now() - started, error: failure };
}

function capture(binary, args, options = {}) {
  const result = run(binary, args, options);
  return typeof result.stdout === 'string' ? result.stdout.trim() : result.stdout;
}

export function option(options, key, fallback = undefined) {
  const value = options.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function requiredOption(options, key) {
  const value = option(options, key);
  if (value === undefined || value.length === 0) fail(`missing ${key}`, 2);
  return value;
}

export function retentionLimit(options) {
  const value = option(options, '--keep-runs', process.env.READER_HAP_KEEP_RUNS ?? String(DEFAULT_RETAIN_RUNS));
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 100) fail('--keep-runs must be 1..100', 2);
  return Number(value);
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
    '.github',
    '.pytest_cache',
    '.worktrees',
    'build',
    'docs',
    'entry/build',
    'entry/.cxx',
    'node_modules',
    'oh_modules',
    'evidence',
    'tests',
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

export function syncSigning(options) {
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

export function resolveCoreProfile(profile = 'release') {
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
export function syncNative(env = process.env) {
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

export async function build(options, verifyManifestWithInspector) {
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
    await buildImpl(options, inputs, buildStarted, verifyManifestWithInspector);
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

async function buildImpl(options, inputs, buildStarted, verifyManifestWithInspector) {
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
  let preserveIncrementalCache = false;
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
    const hvigorResult = run(hvigorw, buildArgs, {
      cwd: sandboxRepo,
      stdio: 'inherit',
      env: buildEnvironment,
      allowFailure: incremental,
    });
    if (hvigorResult.status !== 0) {
      if (incremental && isCleanArkTsCompileFailure(hvigorResult)) {
        for (const name of ['entry-default-signed.hap', 'entry-default-unsigned.hap']) {
          rmSync(resolve(outputDir, name), { force: true });
        }
        preserveIncrementalCache = true;
      }
      const stderr = typeof hvigorResult.stderr === 'string' ? hvigorResult.stderr.trim() : '';
      const stdout = typeof hvigorResult.stdout === 'string' ? hvigorResult.stdout.trim() : '';
      fail(`${hvigorw} failed (${hvigorResult.status}): ${stderr || stdout || '<no output>'}`);
    }
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
    measureBuildStep('resolvedDependenciesAfter', () => assertResolvedCorePackage(sandboxRepo, expectedVendor));
    if (incremental) preserveIncrementalCache = true;
    assertSnapshotUnchanged(sourceBefore, sourceAfter, 'source worktree build inputs');
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
    preserveIncrementalCache = false;
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
      if (incremental && preserveIncrementalCache) {
        try { rmSync(incompleteBuild, { force: true }); }
        catch { /* Retain recovery marker so the next incremental build cleans the cache. */ }
      }
    } finally { buildLease.release(); }
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
