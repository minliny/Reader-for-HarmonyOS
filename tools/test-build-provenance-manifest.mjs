import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coreBuildSnapshot } from '../../Reader-Core-Native/scripts/build-input-snapshot.mjs';

// Real LLVM ELF/strip and ZIP operations exercise the production generator.
// This small unsigned ZIP is not an installable Reader or signing evidence.
const sdk = process.env.OHOS_SDK_HOME || '/Applications/DevEco-Studio.app/Contents/sdk/default';
const llvm = join(sdk, 'openharmony/native/llvm/bin');
const clang = join(llvm, 'clang'), strip = join(llvm, 'llvm-objcopy'), readelf = join(llvm, 'llvm-readelf');
for (const tool of [clang, strip, readelf]) assert.ok(existsSync(tool), `required Native test tool missing: ${tool}`);
const root = mkdtempSync(join(tmpdir(), 'reader-native-provenance-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const commit = repo => {
  git(repo, 'init', '-q'); git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Reader Test', '-c', 'user.email=reader@example.invalid', 'commit', '-qm', 'fixture');
};
try {
  const core = join(root, 'core'), host = join(root, 'host'), vendor = join(host, 'vendor');
  for (const path of [core, host, vendor, join(core, 'crates'), join(core, 'protocol')]) mkdirSync(path, { recursive: true });
  writeFileSync(join(core, 'Cargo.lock'), '# fixed test inputs\n');
  writeFileSync(join(core, 'crates/input.rs'), 'pub const INPUT: u8 = 1;\n');
  const protocolFiles = ['reader-command.schema.json', 'reader-event.schema.json', 'reader-runtime-config.schema.json'];
  for (const name of protocolFiles) json(join(core, 'protocol', name), { name });
  commit(core);
  writeFileSync(join(vendor, 'Index.ts'), 'export const version = 1;\n');
  mkdirSync(join(host, 'src')); mkdirSync(join(host, 'tools'));
  writeFileSync(join(host, 'src/App.ets'), 'export const appVersion = 1;\n');
  writeFileSync(join(host, 'tools/controller.mjs'), 'export const gateVersion = 1;\n');
  writeFileSync(join(host, '.gitignore'), '.reader-artifacts/\n.reader-local/\n');
  const compile = (name, value) => {
    const input = join(root, `${name}.c`), output = join(root, `${name}.so`);
    writeFileSync(input, `__attribute__((visibility("default"))) int reader_probe(void) { return ${value}; }\n`);
    execFileSync(clang, ['--target=aarch64-linux-gnu', '-fuse-ld=lld', '-nostdlib', '-shared', '-g',
      '-Wl,--build-id=none', input, '-o', output]);
    assert.match(execFileSync(readelf, ['-h', output], { encoding: 'utf8' }), /Machine:\s+AArch64/);
    return output;
  };
  const native = compile('current', 42), stale = compile('stale', 7), app = join(host, 'native.so');
  copyFileSync(native, app); commit(host);
  const transform = (input, name, flag) => {
    const output = join(root, `${name}.so`); copyFileSync(input, output); execFileSync(strip, [flag, output]); return output;
  };
  const packaged = transform(native, 'strip-all', '--strip-all');
  const stalePackaged = transform(stale, 'stale-strip-all', '--strip-all');
  const wrongTransform = transform(native, 'strip-debug', '--strip-debug');
  assert.notEqual(hash(readFileSync(packaged)), hash(readFileSync(native)), 'real strip must change the debug ELF');
  assert.notEqual(hash(readFileSync(packaged)), hash(readFileSync(wrongTransform)), 'wrong strip fixture must differ');
  const embeddedPath = 'libs/arm64-v8a/libreader_core_napi.so';
  const archive = (name, input) => {
    const directory = join(root, `zip-${name}`), hap = join(root, `${name}.hap`);
    const entry = input ? embeddedPath : 'unrelated.txt';
    mkdirSync(dirname(join(directory, entry)), { recursive: true });
    if (input) copyFileSync(input, join(directory, entry)); else writeFileSync(join(directory, entry), 'missing native');
    execFileSync('zip', ['-q', hap, entry], { cwd: directory }); return hap;
  };
  const goodHap = archive('good', packaged);
  const snapshot = join(root, 'inputs.json'), identity = join(root, 'identity.json');
  json(snapshot, coreBuildSnapshot(core));
  const protocolHash = createHash('sha256');
  for (const name of protocolFiles) {
    protocolHash.update(`protocol/${name}`); protocolHash.update(Buffer.from([0]));
    protocolHash.update(readFileSync(join(core, 'protocol', name))); protocolHash.update(Buffer.from([0]));
  }
  const gitCommit = git(core, 'rev-parse', 'HEAD'), cargoLockSha256 = hash(readFileSync(join(core, 'Cargo.lock')));
  const protocolSha256 = protocolHash.digest('hex');
  const canonicalIdentity = `reader-core-build-identity-v1\ngitCommit=${gitCommit}\ngitDirty=false\ncargoLockSha256=${cargoLockSha256}\nprotocolSha256=${protocolSha256}\nrustProfile=release\n`;
  json(identity, { schemaVersion: 1, buildId: hash(canonicalIdentity), gitCommit, gitDirty: false,
    cargoLockSha256, protocolSha256, rustProfile: 'release' });
  const packageManifest = join(root, 'package.sha256'), evidence = join(root, 'build.txt');
  const record = (path, label) => { const bytes = readFileSync(path); return `${hash(bytes)}  ${bytes.length}  ${label}`; };
  const writePair = () => {
    writeFileSync(packageManifest, record(native, embeddedPath) + '\n' + record(join(vendor, 'Index.ts'), 'Index.ts') + '\n');
    writeFileSync(evidence, Object.entries({ artifact_sha256: hash(readFileSync(native)), artifact_bytes: String(readFileSync(native).length),
      core_build_identity_sha256: hash(readFileSync(identity)), core_input_snapshot_sha256: hash(readFileSync(snapshot)),
      package_manifest_sha256: hash(readFileSync(packageManifest)), sdk_smoke: 'pass' }).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
  };
  writePair();
  const output = join(root, 'result.json');
  const common = [fileURLToPath(new URL('./generate-build-provenance-manifest.mjs', import.meta.url)), '--allow-dirty',
    '--core-repo', core, '--harmony-repo', host, '--core-identity', identity, '--core-input-snapshot', snapshot,
    '--napi-manifest', packageManifest, '--native-so', native, '--app-native-so', app, '--harmony-vendor', vendor,
    '--core-build-evidence', evidence, '--native-strip-tool', strip];
  const run = (hap = goodHap, destination = output, harmony = host) => {
    const args = [...common]; args[args.indexOf('--harmony-repo') + 1] = harmony;
    const result = spawnSync(process.execPath, [...args, '--hap', hap, '--output', destination], { encoding: 'utf8', timeout: 30000 });
    assert.ifError(result.error); return result;
  };
  const inputsUnchanged = before => {
    for (const [path, bytes] of before) assert.deepEqual(readFileSync(path), bytes, `generator changed input ${path}`);
  };
  const coreSource = join(core, 'crates/input.rs');
  const inputPaths = [native, app, identity, snapshot, packageManifest, evidence, goodHap, strip, join(vendor, 'Index.ts'),
    coreSource, join(core, 'Cargo.lock'), join(host, 'src/App.ets'), join(host, 'tools/controller.mjs'),
    ...protocolFiles.map(name => join(core, 'protocol', name))];
  const capturedInputs = () => inputPaths.map(path => [path, readFileSync(path)]);
  const positive = run(); assert.equal(positive.status, 0, positive.stderr);
  const value = JSON.parse(readFileSync(output));
  assert.equal(value.hap.path, 'good.hap');
  assert.equal(value.hap.embeddedNative.sha256, hash(readFileSync(packaged)));
  assert.equal(value.harmony.nativePackaging.output.sha256, hash(readFileSync(packaged)));
  assert.deepEqual(value.harmony.nativePackaging.arguments, ['--strip-all']);
  // Every argv file is a static input. Never open special nodes: a bounded
  // child invocation must reject them, rather than blocking on FIFO reads.
  const staticInputOptions = ['--native-so', '--app-native-so', '--core-identity', '--napi-manifest',
    '--core-build-evidence', '--core-input-snapshot', '--hap', '--native-strip-tool'];
  const staticInputsBefore = capturedInputs(), staticPreviousJson = readFileSync(output);
  for (const [index, option] of staticInputOptions.entries()) {
    const fifo = join(root, `static-input-${index}.fifo`), link = join(root, `static-input-${index}.link`);
    execFileSync('mkfifo', [fifo]); assert.equal(lstatSync(fifo).isFIFO(), true);
    symlinkSync(native, link);
    for (const path of [fifo, link]) {
      const argv = [...common, '--hap', goodHap, '--output', output];
      argv[argv.indexOf(option) + 1] = path;
      const started = Date.now();
      const result = spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL' });
      if (result.error) console.log(JSON.stringify({ staticInputProbe: option, nodeType: path === fifo ? 'fifo' : 'symlink',
        elapsedMs: Date.now() - started, error: result.error.code, status: result.status, signal: result.signal }));
      inputsUnchanged(staticInputsBefore);
      assert.deepEqual(readFileSync(output), staticPreviousJson, 'invalid file types must preserve the old manifest');
      assert.equal(lstatSync(fifo).isFIFO(), true, 'FIFO must not be replaced or consumed');
      assert.ifError(result.error); assert.notEqual(result.status, 0, option);
      assert.match(result.stderr, /must be a regular file/, option);
      if (option === '--native-so' && path === fifo) {
        const preflightArgv = [...common, '--preflight', '--output', output];
        preflightArgv[preflightArgv.indexOf(option) + 1] = path;
        const preflightReject = spawnSync(process.execPath, preflightArgv,
          { encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL' });
        assert.ifError(preflightReject.error); assert.notEqual(preflightReject.status, 0);
        assert.match(preflightReject.stderr, /must be a regular file/);
        inputsUnchanged(staticInputsBefore); assert.deepEqual(readFileSync(output), staticPreviousJson);
      }
    }
    rmSync(fifo); rmSync(link);
  }
  const vendorFifo = join(vendor, 'special.fifo'); execFileSync('mkfifo', [vendorFifo]);
  const vendorReject = run(); assert.notEqual(vendorReject.status, 0);
  assert.match(vendorReject.stderr, /vendored SDK must contain only regular files and directories/);
  assert.deepEqual(readFileSync(output), staticPreviousJson); inputsUnchanged(staticInputsBefore);
  assert.equal(lstatSync(vendorFifo).isFIFO(), true); rmSync(vendorFifo);
  assert.equal(run().status, 0, 'restored ordinary static inputs must pass');
  const reject = (hap, message) => {
    const before = readFileSync(output), originalInputs = capturedInputs();
    const result = run(hap); assert.notEqual(result.status, 0); assert.match(result.stderr, message);
    assert.deepEqual(readFileSync(output), before, 'failed validation must preserve the previous complete manifest');
    inputsUnchanged(originalInputs);
    assert.equal(readdirSync(root).some(name => name.startsWith('.reader-provenance-')), false, 'no staging leftovers');
  };
  const staleHap = archive('stale', stalePackaged);
  reject(staleHap, /HAP embedded NAPI does not match/);
  const absentOutput = join(root, 'absent-output.json');
  assert.notEqual(run(staleHap, absentOutput).status, 0);
  assert.equal(existsSync(absentOutput), false, 'rejected input must not publish a new manifest');
  reject(archive('unstripped', native), /HAP embedded NAPI does not match/);
  reject(archive('wrong-strip', wrongTransform), /HAP embedded NAPI does not match/);
  reject(archive('missing-native', undefined), /HAP does not contain/);
  const originalIdentity = readFileSync(identity), originalCoreSource = readFileSync(coreSource);
  const staleIdentity = JSON.parse(originalIdentity); staleIdentity.gitCommit = '0'.repeat(40);
  json(identity, staleIdentity); writePair();
  reject(goodHap, /Core build identity does not match/);
  writeFileSync(identity, originalIdentity); writePair();
  const dirtyIdentity = JSON.parse(originalIdentity); dirtyIdentity.gitDirty = true;
  json(identity, dirtyIdentity); writeFileSync(coreSource, 'pub const INPUT: u8 = 2;\n'); writePair();
  reject(goodHap, /Core build inputs changed/);
  writeFileSync(coreSource, originalCoreSource); writeFileSync(identity, originalIdentity); writePair();
  assert.equal(run().status, 0, 'restored commit/content identity must pass before subsequent artifact cases');
  const savedNative = readFileSync(native), savedApp = readFileSync(app);
  writeFileSync(native, 'not an ELF'); writeFileSync(app, 'not an ELF'); writePair();
  reject(archive('invalid-elf', native), /strip-all|file format|not recognized|not a valid object/i);
  writeFileSync(native, savedNative); writeFileSync(app, savedApp); writePair();
  assert.equal(run().status, 0, 'a good pair must pass after all corrupt fixtures are restored');

  const hostWorktree = join(root, 'host-worktree');
  git(host, 'worktree', 'add', '--quiet', '--detach', hostWorktree, 'HEAD');
  const sourceOutputTargets = [
    [join(core, 'Cargo.lock'), host], [coreSource, host], [join(host, 'src/App.ets'), host],
    [join(host, 'tools/controller.mjs'), host], [join(core, '.git/HEAD'), host], [join(core, '.git/index'), host],
    [join(host, '.git/HEAD'), hostWorktree], [join(hostWorktree, '.git'), hostWorktree],
    [join(core, '.git', git(core, 'symbolic-ref', 'HEAD')), host],
  ];
  const sourceRejections = [];
  const sourceInputsBefore = capturedInputs();
  for (const [destination, harmony] of sourceOutputTargets) {
    const original = readFileSync(destination), previousJson = readFileSync(output);
    const result = run(goodHap, destination, harmony);
    const modified = !readFileSync(destination).equals(original);
    sourceRejections.push({ target: relative(root, destination), status: result.status, modified,
      correctError: /output must not replace.*input/.test(result.stderr) });
    // Keep even a before-fix negative run confined to reversible temp inputs.
    if (modified) writeFileSync(destination, original);
    assert.deepEqual(readFileSync(output), previousJson);
  }
  if (sourceRejections.some(row => row.status === 0 || row.modified || !row.correctError)) {
    console.log(JSON.stringify({ sourceOutputRejections: sourceRejections }, null, 2));
  }
  for (const row of sourceRejections) {
    assert.notEqual(row.status, 0, row.target); assert.equal(row.modified, false, row.target); assert.equal(row.correctError, true, row.target);
  }
  inputsUnchanged(sourceInputsBefore);
  assert.equal(run().status, 0, 'source/metadata output rejection must preserve the good pair');

  const sourceAlias = join(root, 'source-output-alias'); symlinkSync(coreSource, sourceAlias);
  const sourceAliasResult = run(goodHap, sourceAlias); assert.notEqual(sourceAliasResult.status, 0);
  assert.match(sourceAliasResult.stderr, /output must not replace.*input/); inputsUnchanged(sourceInputsBefore);
  const absentRef = join(core, '.git/refs/heads/not-created/new-ref');
  const absentRefResult = run(goodHap, absentRef); assert.notEqual(absentRefResult.status, 0);
  assert.match(absentRefResult.stderr, /output must not replace.*input/);
  assert.equal(existsSync(dirname(absentRef)), false, 'output must not create Git metadata directories');

  const originalInputs = capturedInputs();
  const outputAlias = join(root, 'output-alias'); symlinkSync(native, outputAlias);
  for (const destination of [native, app, identity, snapshot, packageManifest, evidence, goodHap,
    outputAlias, join(vendor, 'Index.ts'), join(vendor, 'new-manifest.json')]) {
    const overwrite = run(goodHap, destination); assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /output must not replace.*input/); inputsUnchanged(originalInputs);
  }
  assert.equal(existsSync(join(vendor, 'new-manifest.json')), false);
  const directoryAlias = join(root, 'sdk-alias'); symlinkSync(vendor, directoryAlias);
  const deepOutput = join(directoryAlias, 'deep/not-created/new-output.json');
  const escapedPublish = run(goodHap, deepOutput); assert.notEqual(escapedPublish.status, 0);
  assert.match(escapedPublish.stderr, /output must not replace.*input/);
  assert.equal(existsSync(join(vendor, 'deep')), false, 'a distant linked ancestor must not create SDK directories');
  inputsUnchanged(originalInputs);
  const directoryOutput = join(root, 'directory-output'); mkdirSync(directoryOutput);
  const sentinel = join(directoryOutput, 'preserve'); writeFileSync(sentinel, 'previous evidence');
  const blockedPublish = run(goodHap, directoryOutput); assert.notEqual(blockedPublish.status, 0);
  assert.equal(readFileSync(sentinel, 'utf8'), 'previous evidence');
  inputsUnchanged(originalInputs);
  assert.equal(readdirSync(root).some(name => name.startsWith('.reader-provenance-')), false);
  assert.equal(run().status, 0, 'positive manifest replacement remains valid and complete');
  for (const allowed of [join(host, '.reader-artifacts/run/provenance.json'), join(host, '.reader-local/run/preflight.json')]) {
    const result = run(goodHap, allowed); assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(allowed)).hap.embeddedNative.sha256, hash(readFileSync(packaged)));
  }
  assert.equal(git(host, 'status', '--porcelain'), '', 'allowed artifact output must preserve source identity');
  console.log('PASS build provenance: real AArch64 ELF/LLVM strip/ZIP, static FIFO/link rejection before reads, stale Core identity/content and stale/missing/wrong-strip/invalid-ELF rejection, atomic input-preserving publication');
} finally { rmSync(root, { recursive: true, force: true }); }
