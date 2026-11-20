#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assertHarmonySdkEnvironment, harmonyBuildEnvironment, portableSpawnSync, resolveHarmonyTool, windowsBatchCommand } from './lib/harmony-toolchain.mjs';
import { privateWindowsAcl } from './lib/private-file.cjs';
import { nativeInputPaths, requireAcceptanceInputs } from './hap-pipeline.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'reader-toolchain-portability-')));
const put = (path, bytes = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); return path; };
const env = { PATH: '', READER_DEVECO_HOME: join(root, 'Studio With Spaces') };
try {
  const sdk = join(env.READER_DEVECO_HOME, 'sdk/default/openharmony');
  mkdirSync(join(sdk, 'ets/build-tools/ets-loader'), { recursive: true });
  const hdc = put(join(sdk, 'toolchains/hdc.exe'));
  const cli = put(join(env.READER_DEVECO_HOME, 'tools/hvigor/bin/hvigorw.js'));
  const ohpm = put(join(env.READER_DEVECO_HOME, 'tools/ohpm/bin/ohpm.bat'));
  assert.equal(resolveHarmonyTool('sdkHome', { env, platform: 'win32' }), sdk);
  assert.equal(resolveHarmonyTool('hdc', { env, platform: 'win32' }), hdc);
  assert.equal(resolveHarmonyTool('hvigorw', { env, platform: 'win32' }), cli);
  assert.equal(resolveHarmonyTool('ohpm', { env, platform: 'win32' }), ohpm);
  assert.equal(resolveHarmonyTool('etsLoader', { env, platform: 'linux' }), join(sdk, 'ets/build-tools/ets-loader'));
  const explicit = put(join(root, 'explicit/hdc.exe'));
  assert.equal(resolveHarmonyTool('hdc', { env: { ...env, HDC: explicit }, platform: 'win32' }), explicit);
  assert.throws(() => resolveHarmonyTool('hdc', { env: { ...env, HDC: join(root, 'missing') }, required: false }), /explicit setting/);
  assert.throws(() => resolveHarmonyTool('sdkHome', { env: { PATH: '', READER_HARMONY_SDK_HOME: join(root, 'missing') } }), /READER_HARMONY_SDK_HOME/);
  const bin = join(root, 'path bin');
  put(join(bin, 'hdc.exe'));
  assert.equal(resolveHarmonyTool('hdc', { env: { PATH: `${bin};${root}` }, platform: 'win32' }), join(bin, 'hdc.exe'));
  const project = join(root, 'project');
  put(join(project, 'local.properties'), `sdk.dir=${join(env.READER_DEVECO_HOME, 'sdk').replaceAll('\\', '\\\\')}\n`);
  assert.equal(resolveHarmonyTool('sdkHome', { env: { PATH: '' }, cwd: project }), sdk);
  assert.doesNotThrow(() => assertHarmonySdkEnvironment({ env, platform: 'win32' }),
    'an IDE without explicit SDK aliases retains official default discovery; no new environment variable is mandatory');
  assert.doesNotThrow(() => assertHarmonySdkEnvironment({ env: { PATH: '' }, cwd: project }),
    'the explicit-override check must not replace official IDE defaults with a local.properties guess');
  const selectedEnv = { ...env, READER_HARMONY_SDK_HOME: sdk, DEVECO_SDK_HOME: join(root, 'stale SDK') };
  const selectedBefore = structuredClone(selectedEnv);
  assert.throws(() => harmonyBuildEnvironment({ env: selectedEnv, platform: 'win32' }), /HarmonyOS SDK container/);
  put(join(sdk, '../sdk-pkg.json'), JSON.stringify({ meta: { version: '1.0.0' }, data: {
    path: 'HarmonyOS-6.1.1', platformVersion: '6.1.1', apiVersion: '24', version: '6.1.1.125', stage: 'Release',
  } }));
  const buildEnv = harmonyBuildEnvironment({ env: selectedEnv, platform: 'win32' });
  assert.deepEqual(selectedEnv, selectedBefore, 'build environment must preserve the caller');
  assert.equal(buildEnv.DEVECO_SDK_HOME, join(env.READER_DEVECO_HOME, 'sdk'));
  assert.equal(resolveHarmonyTool('sdkHome', { env: buildEnv, platform: 'win32' }), sdk);
  assert.equal(resolveHarmonyTool('sdkHome', { env: { DEVECO_SDK_HOME: buildEnv.DEVECO_SDK_HOME } }), sdk,
    'the official plugin SDK setting must identify the same selected SDK');
  assert.doesNotThrow(() => assertHarmonySdkEnvironment({ env: buildEnv, platform: 'win32' }));
  assert.throws(() => assertHarmonySdkEnvironment({ env: selectedEnv, platform: 'win32' }), /IDE SDK environment differs/);
  const versionedSdk = join(buildEnv.DEVECO_SDK_HOME, 'HarmonyOS-6.1.0/openharmony');
  mkdirSync(join(versionedSdk, 'ets'), { recursive: true });
  mkdirSync(join(versionedSdk, 'toolchains'), { recursive: true });
  put(join(versionedSdk, '../sdk-pkg.json'), JSON.stringify({ meta: { version: '1.0.0' }, data: {
    path: 'HarmonyOS-6.1.0', platformVersion: '6.1.0', apiVersion: '23', version: '6.1.0.100', stage: 'Release',
  } }));
  const multiVersionEnv = { ...buildEnv, READER_HARMONY_SDK_HOME: versionedSdk };
  assert.notEqual(resolveHarmonyTool('sdkHome', { env: multiVersionEnv }),
    resolveHarmonyTool('sdkHome', { env: { DEVECO_SDK_HOME: buildEnv.DEVECO_SDK_HOME } }));
  assert.doesNotThrow(() => assertHarmonySdkEnvironment({ env: multiVersionEnv }),
    'container admission must allow an explicit SDK version beside a different default; official compileSdkVersion chooses the build package');
  const nodeCli = put(join(root, 'echo.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)))');
  assert.deepEqual(JSON.parse(portableSpawnSync(nodeCli, ['path with spaces', 'a&b'], { encoding: 'utf8' }).stdout), ['path with spaces', 'a&b']);
  assert.equal(windowsBatchCommand('C:\\Program Files (x86)\\ohpm.cmd', ['--cache', 'D:\\build cache', '']),
    '"C:\\Program Files (x86)\\ohpm.cmd" "--cache" "D:\\build cache" ""');
  assert.throws(() => windowsBatchCommand('ohpm.cmd', ['name & command']), /shell syntax/);
  assert.throws(() => windowsBatchCommand('ohpm.cmd', ['%SECRET%']), /shell syntax/);
  assert.equal(windowsBatchCommand('ohpm.cmd', ['D:\\build cache\\']), '"ohpm.cmd" "D:\\build cache\\\\"');
  const sid = 'S-1-5-21-111-222-333-1001';
  assert.equal(privateWindowsAcl(`D:PAI(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;${sid})`, sid), true);
  assert.equal(privateWindowsAcl(`D:\\private\\profile.json\r\nD:PAI(A;;FA;;;SY)(A;;FA;;;${sid})\r\n`, sid), true);
  assert.equal(privateWindowsAcl('D:(A;;FR;;;WD)', sid), false);
  assert.equal(privateWindowsAcl('D:(A;;FR;;;AU)', sid), false);
  assert.equal(privateWindowsAcl(`D:(OA;;FA;;;${sid})`, sid), false);
  assert.equal(privateWindowsAcl('', sid), false);
  const core = join(root, 'core');
  const oldInputs = nativeInputPaths(core, {});
  for (const path of Object.values(oldInputs)) put(path, 'stale default output');
  const external = join(root, 'external cargo outputs');
  const redirected = nativeInputPaths(core, { CARGO_TARGET_DIR: external });
  assert.equal(redirected.identity, join(external, 'harmony-napi/arm64-v8a/core-build-identity.json'));
  assert.throws(() => requireAcceptanceInputs(core, { CARGO_TARGET_DIR: external }), /acceptance input missing/);
  for (const path of Object.values(redirected)) put(path, 'current external output');
  assert.deepEqual(requireAcceptanceInputs(core, { CARGO_TARGET_DIR: external }), redirected);
  assert.equal(nativeInputPaths(core, { CARGO_TARGET_DIR: '../relative-cache' }).identity,
    join(root, 'relative-cache/harmony-napi/arm64-v8a/core-build-identity.json'));
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { configureIdeSigning } = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
  const beforeSigning = new Error('fixture stops before private signer access');
  const context = { getBuildProfileOpt() { throw beforeSigning; } };
  await assert.rejects(configureIdeSigning(context, repository, selectedEnv), /IDE SDK environment differs/,
    'an IDE SDK mismatch must stop before private signing profile access');
  await assert.rejects(configureIdeSigning(context, repository, buildEnv), error => error === beforeSigning,
    'a matching IDE SDK can reach the existing signing admission without changing the environment');
  await assert.rejects(configureIdeSigning(context, repository, multiVersionEnv), error => error === beforeSigning,
    'a matching multiversion container must reach signing admission without a new SDK version-selection algorithm');
  const fakeHvigor = put(join(root, 'fake Hvigor.mjs'),
    'console.log(JSON.stringify({ sdk: process.env.DEVECO_SDK_HOME, cwd: process.cwd(), args: process.argv.slice(2) }))');
  const build = spawnSync(process.execPath, [join(repository, 'scripts/deveco-build.mjs'), 'fixture-task'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ...selectedEnv, READER_NODE: process.execPath, HVIGORW: fakeHvigor },
  });
  assert.equal(build.status, 0, build.stderr);
  assert.deepEqual(JSON.parse(build.stdout), { sdk: buildEnv.DEVECO_SDK_HOME, cwd: repository, args: ['fixture-task'] },
    'the real DevEco entry must forward the selected SDK to its tool from any working directory');
  const pipeline = readFileSync(join(repository, 'scripts/hap-pipeline.mjs'), 'utf8');
  assert.equal(/\/Applications\/|\/usr\/bin\/|run\('rsync'/.test(pipeline.replace(/^#!.*\n/, '')), false);
  console.log('HarmonyOS toolchain portability: PASS (configured paths, Windows extensions, SDK layout and build forwarding, Node CLI, private ACL policy).');
} finally { rmSync(root, { recursive: true, force: true }); }
