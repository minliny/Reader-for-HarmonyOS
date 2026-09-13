#!/usr/bin/env node

import { createHash, randomUUID, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const WORKSPACE_ROOT = resolve(REPO_ROOT, '..');
const CORE_ROOT = resolve(WORKSPACE_ROOT, 'Reader-Core-Native');
const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, '.reader-artifacts/hap');
const DEFAULT_SIGNING_PROFILE = resolve(REPO_ROOT, '.reader-local/signing/build-profile.json5');
const DEFAULT_HVIGORW = '/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw';
const DEFAULT_HDC = '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc';
const DEFAULT_SIGN_TOOL =
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/lib/hap-sign-tool.jar';
const DEFAULT_STRIP_TOOL =
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/native/llvm/bin/llvm-objcopy';
const HDC_LEASE_SCRIPT = resolve(REPO_ROOT, 'tools/reader-hdc-lease.mjs');
const HDC_SERVER = process.env.READER_HDC_SERVER_KEY ?? '::ffff:127.0.0.1:8710';
const BUNDLE_NAME = 'io.reader.harmonyos';
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
  'scripts/hap-pipeline.mjs',
  'tools',
];
const WORKSPACE_CONTRACT_INPUTS = [
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

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: options.encoding !== undefined ? options.encoding : 'utf8',
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    stdio: options.stdio ?? 'pipe',
    env: options.env ?? process.env,
  });
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
    if (key === '--live-sources' || key === '--no-launch') {
      options.set(key, true);
      continue;
    }
    if (!key.startsWith('--') || index + 1 >= argv.length) fail(`invalid argument: ${key}`, 2);
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

function visitBuildInput(root, absolute, records) {
  const stat = lstatSync(absolute);
  const relativePath = relative(root, absolute);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(absolute);
    records.push({ path: relativePath, type: 'symlink', target, sha256: sha256Bytes(target) });
    return;
  }
  if (stat.isDirectory()) {
    for (const name of readdirSync(absolute).sort()) {
      visitBuildInput(root, resolve(absolute, name), records);
    }
    return;
  }
  if (!stat.isFile()) return;
  const bytes = readFileSync(absolute);
  records.push({
    path: relativePath,
    type: 'file',
    mode: stat.mode & 0o777,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
  });
}

function contentSnapshot(root, inputs) {
  const records = [];
  for (const input of inputs) {
    const absolute = resolve(root, input);
    if (existsSync(absolute)) visitBuildInput(root, absolute, records);
  }
  records.sort((left, right) => left.path.localeCompare(right.path));
  const hash = createHash('sha256');
  for (const record of records) {
    hash.update(JSON.stringify(record));
    hash.update('\n');
  }
  return {
    schemaVersion: 1,
    inputs,
    fileCount: records.length,
    fingerprint: hash.digest('hex'),
    files: records,
  };
}

export function sourceSnapshot(repo = REPO_ROOT) {
  return contentSnapshot(repo, BUILD_INPUTS);
}

function assertSnapshotUnchanged(before, after, label) {
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

function copySourceSandbox(source, destination) {
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
    'evidence',
  ];
  const args = ['-a', '--delete'];
  for (const excluded of excludes) args.push(`--exclude=${excluded}`);
  args.push(`${source}/`, `${destination}/`);
  run('rsync', args);
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
    const result = run('/usr/bin/openssl', ['cms', '-verify', '-noverify', '-inform', 'DER', '-in', profilePath],
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
  const java = process.env.JAVA || '/usr/bin/java';
  const signTool = process.env.HAP_SIGN_TOOL || DEFAULT_SIGN_TOOL;
  if (!existsSync(java) || !existsSync(signTool)) fail('HarmonyOS HAP signing verifier is unavailable');
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
      return { status: 'signed', verified: true, profileType: profile,
        ...verifiedProfileIdentity(resolve(verifyRoot, 'profile.p7b')) };
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
  return capture('unzip', ['-Z1', hapPath]).split('\n').filter(Boolean);
}

function archiveEntryRecord(hapPath, entryPath) {
  const result = run('unzip', ['-p', hapPath, entryPath], { encoding: null });
  const bytes = result.stdout;
  if (!Buffer.isBuffer(bytes)) fail(`unable to read ${entryPath} from ${hapPath}`);
  return { path: entryPath, bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

function inspectHap(hapPath, kind, publicPath = basename(hapPath)) {
  const nativeEntries = archiveNames(hapPath).filter((name) => name.startsWith('libs/')).sort();
  if (JSON.stringify(nativeEntries) !== JSON.stringify(EXPECTED_NATIVE_ENTRIES)) {
    fail(`unexpected native archive layout in ${hapPath}: ${JSON.stringify(nativeEntries)}`);
  }
  const signature = verifySignature(hapPath);
  if (kind === 'signed' && signature.status !== 'signed') fail(`${hapPath} is not signed`);
  if (kind === 'unsigned' && signature.status !== 'unsigned') fail(`${hapPath} is not unsigned`);
  return {
    kind,
    ...fileRecord(hapPath, publicPath),
    signature,
    nativeEntries,
    embeddedCoreNapi: archiveEntryRecord(hapPath, 'libs/arm64-v8a/libreader_core_napi.so'),
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

function acquireLock(lockDir, owner) {
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
  const stat = statSync(path);
  if (!stat.isFile()) fail(`local signing profile is not a file: ${path}`);
  if ((stat.mode & 0o077) !== 0) {
    fail(`local signing profile permissions must exclude group/other access: ${path}`);
  }
  const relativePath = relative(REPO_ROOT, path);
  if (relativePath !== '..' && !relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    const tracked = run('git', ['-C', REPO_ROOT, 'ls-files', '--error-unmatch', '--', relativePath], {
      allowFailure: true,
    });
    if (tracked.status === 0) fail(`local signing profile must not be tracked by Git: ${path}`);
  }
}

function parseBuildProfile(path) {
  // Use the JSON5 parser bundled with the official build tools, including
  // DevEco's comments/trailing commas; never echo parser excerpts of secrets.
  const plugin = '/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor-ohos-plugin/package.json';
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

function requireAcceptanceInputs() {
  const base = resolve(CORE_ROOT, 'target/harmony-napi/arm64-v8a');
  const inputs = {
    identity: resolve(base, 'core-build-identity.json'),
    packageManifest: resolve(base, 'harmony-package-manifest.sha256'),
    buildEvidence: resolve(base, 'harmony-napi-build-evidence.txt'),
    nativeSo: resolve(base, 'package/libs/arm64-v8a/libreader_core_napi.so'),
  };
  for (const [label, path] of Object.entries(inputs)) {
    if (!existsSync(path)) fail(`acceptance input missing (${label}): ${path}`);
  }
  return inputs;
}

function generateAcceptanceProvenance(runDir, signedHap, hvigorVersion, buildCommand) {
  const inputs = requireAcceptanceInputs();
  const generator = resolve(REPO_ROOT, 'tools/generate-build-provenance-manifest.mjs');
  const stripTool = process.env.NATIVE_STRIP_TOOL || DEFAULT_STRIP_TOOL;
  if (!existsSync(stripTool)) fail(`native strip tool is missing: ${stripTool}`);
  const output = resolve(runDir, 'acceptance-provenance.json');
  run(process.execPath, [
    generator,
    '--core-repo', CORE_ROOT,
    '--harmony-repo', REPO_ROOT,
    '--core-identity', inputs.identity,
    '--napi-manifest', inputs.packageManifest,
    '--native-so', inputs.nativeSo,
    '--app-native-so', resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
    '--harmony-vendor', resolve(REPO_ROOT, 'entry/vendor/core-harmony'),
    '--hap', signedHap,
    '--output', output,
    '--core-build-evidence', inputs.buildEvidence,
    '--native-strip-tool', stripTool,
    '--build-command', buildCommand,
    '--hvigor-version', hvigorVersion,
    '--sdk-version', 'HarmonyOS 6.1.0(23)',
  ]);
  return basename(output);
}

function build(options) {
  const buildClass = option(options, '--class', 'iteration');
  if (!['iteration', 'acceptance'].includes(buildClass)) fail('--class must be iteration or acceptance', 2);
  const requestedSigning = option(options, '--signing', 'auto');
  if (!['auto', 'local', 'unsigned'].includes(requestedSigning)) {
    fail('--signing must be auto, local, or unsigned', 2);
  }
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
    signingBefore = { configuration: fileRecord(localProfile, 'local-signing-config'),
      material: signingMaterialSnapshot(signingProfile) };
  }

  const harmonyGit = gitRecord(REPO_ROOT);
  const coreGit = gitRecord(CORE_ROOT);
  requireCleanAcceptance(buildClass, harmonyGit, coreGit, signingMode);

  const lockDir = '/private/tmp/reader-harmony-hap-build.lock';
  acquireLock(lockDir, {
    pid: process.pid,
    repo: REPO_ROOT,
    startedAt: new Date().toISOString(),
  });

  const sandboxRoot = mkdtempSync(join(tmpdir(), 'reader-hap-build-'));
  let unpublishedRunDir = null;
  try {
    const harmonyGateBefore = contentSnapshot(REPO_ROOT, HARMONY_GATE_INPUTS);
    const workspaceContractBefore = contentSnapshot(WORKSPACE_ROOT, WORKSPACE_CONTRACT_INPUTS);
    run(process.execPath, [resolve(WORKSPACE_ROOT, 'scripts/check-hap-build-system.mjs')], {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
    });
    run(resolve(REPO_ROOT, 'scripts/check-local.sh'), [], { cwd: REPO_ROOT, stdio: 'inherit' });
    if (options.get('--live-sources') === true) {
      run(process.execPath, ['tools/verify-bundled-test-book-sources-live.mjs'], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
    }

    const sourceBefore = sourceSnapshot(REPO_ROOT);
    const sourceGitBefore = gitRecord(REPO_ROOT);
    const coreGitBefore = gitRecord(CORE_ROOT);
    if (sourceGitBefore.commit !== harmonyGit.commit || coreGitBefore.commit !== coreGit.commit) {
      fail('repository HEAD changed before the build snapshot was captured');
    }

    const sandboxRepo = resolve(sandboxRoot, 'Reader-for-HarmonyOS');
    copySourceSandbox(REPO_ROOT, sandboxRepo);
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

    const hvigorw = process.env.HVIGORW || DEFAULT_HVIGORW;
    if (!existsSync(hvigorw)) fail(`Hvigor is missing: ${hvigorw}`);
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
    const isolatedHvigorTools = resolve(hvigorUserHome, 'wrapper/tools');
    mkdirSync(isolatedHvigorTools, { recursive: true });
    run('rsync', ['-a', `${sharedHvigorTools}/`, `${isolatedHvigorTools}/`]);
    const buildEnvironment = {
      ...process.env,
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
    const sourceAfter = sourceSnapshot(REPO_ROOT);
    assertSnapshotUnchanged(sourceBefore, sourceAfter, 'source worktree build inputs');
    assertSnapshotUnchanged(
      harmonyGateBefore,
      contentSnapshot(REPO_ROOT, HARMONY_GATE_INPUTS),
      'Harmony build controller and gate inputs',
    );
    assertSnapshotUnchanged(
      workspaceContractBefore,
      contentSnapshot(WORKSPACE_ROOT, WORKSPACE_CONTRACT_INPUTS),
      'workspace HAP contract and skill inputs',
    );
    assertGitRecordUnchanged(sourceGitBefore, gitRecord(REPO_ROOT), 'Harmony source worktree');
    assertGitRecordUnchanged(coreGitBefore, gitRecord(CORE_ROOT), 'Core source worktree');

    const outputDir = resolve(sandboxRepo, 'entry/build/default/outputs/default');
    const builtNames = findBuiltHaps(outputDir, signingMode);
    const runId = `${timestampId()}-${sourceGitBefore.commit.slice(0, 8)}-${sourceBefore.fingerprint.slice(0, 8)}`;
    const artifactRoot = resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT));
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
    ));
    if (buildClass === 'acceptance' && !artifacts.some((artifact) => artifact.kind === 'signed')) {
      fail('acceptance build did not produce a signed artifact');
    }

    writeJson(resolve(runDir, 'source-snapshot.json'), sourceBefore);
    writeJson(resolve(runDir, 'controller-snapshot.json'), harmonyGateBefore);
    writeJson(resolve(runDir, 'workspace-contract-snapshot.json'), workspaceContractBefore);
    const hvigorVersion = capture(hvigorw, ['--version'], {
      cwd: sandboxRepo,
      env: buildEnvironment,
    });
    let acceptanceProvenance = null;
    if (buildClass === 'acceptance') {
      const signed = artifacts.find((artifact) => artifact.kind === 'signed');
      acceptanceProvenance = generateAcceptanceProvenance(
        runDir,
        resolve(runDir, signed.path),
        hvigorVersion,
        buildCommand,
      );
    }
    const vendoredNapi = fileRecord(
      resolve(REPO_ROOT, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
      'entry/libs/arm64-v8a/libreader_core_napi.so',
    );
    const manifest = {
      schemaVersion: 2,
      name: 'reader-harmonyos-hap-run',
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
        harmonyContracts: 'PASS',
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
      manifest: resolve(publishedRunDir, 'manifest.json'),
      artifacts: artifacts.map(({ kind, path, sha256, signature }) => ({ kind, path, sha256, signature })),
    }));
  } finally {
    if (unpublishedRunDir !== null) {
      rmSync(unpublishedRunDir, { recursive: true, force: true });
    }
    rmSync(sandboxRoot, { recursive: true, force: true });
    rmSync(lockDir, { recursive: true, force: true });
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
    const current = inspectHap(artifactPath, artifact.kind, artifact.path);
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
  if (/^error: bundle \[io\.reader\.harmonyos\] not found\.?$/i.test(output.trim()) ||
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
  const path = process.env.HDC || DEFAULT_HDC;
  if (!existsSync(path)) fail(`HDC is missing: ${path}`);
  return path;
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
  }, null, 2));
  if (!resolved.route.allowed) process.exitCode = 3;
}

function installDeployment(options) {
  const target = requiredOption(options, '--target');
  const targetKind = requiredOption(options, '--target-kind');
  const targetRef = targetReference(target);
  const lockDir = `/private/tmp/reader-harmony-target-${targetRef}.lock`;
  acquireLock(lockDir, {
    pid: process.pid,
    targetKind,
    targetRef,
    startedAt: new Date().toISOString(),
  });
  try {
    const resolved = resolveDeployment(options);
    if (!resolved.route.allowed) fail(`deployment stopped: ${resolved.route.reason}`, 3);
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
    console.log(JSON.stringify({ status: 'PASS', receipt: receiptPath, dataPreserved: true }));
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function usage() {
  console.error(`Usage:
  node scripts/hap-pipeline.mjs build [--class iteration|acceptance] [--signing auto|local|unsigned] [--live-sources]
  node scripts/hap-pipeline.mjs sync-signing [--profile <private-local-profile.json5>]
  node scripts/hap-pipeline.mjs verify --manifest <manifest.json>
  node scripts/hap-pipeline.mjs inspect --manifest <manifest.json> --artifact signed|unsigned --target <exact> --target-kind vm|physical
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
  else if (command === 'verify') {
    const verified = verifyManifest(requiredOption(options, '--manifest'));
    console.log(JSON.stringify({
      status: 'PASS',
      runId: verified.manifest.runId,
      artifacts: verified.artifacts.map(({ kind, path, sha256, signature }) => ({
        kind, path, sha256, signature,
      })),
    }));
  } else if (command === 'inspect') inspectDeployment(options);
  else if (command === 'install') installDeployment(options);
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
