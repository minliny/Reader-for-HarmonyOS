#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool, windowsBatchCommand } from './lib/harmony-toolchain.mjs';
import { privateWindowsAcl } from './lib/private-file.cjs';
import { findBuiltHaps, nativeInputPaths, requireAcceptanceInputs } from './hap-pipeline.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'reader-toolchain-portability-')));
const put = (path, bytes = '') => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); return path; };
const env = { PATH: '', READER_DEVECO_HOME: join(root, 'Studio With Spaces') };
const scripts = dirname(fileURLToPath(import.meta.url));
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
  const nodeCli = put(join(root, 'echo.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)))');
  assert.deepEqual(JSON.parse(portableSpawnSync(nodeCli, ['path with spaces', 'a&b'], { encoding: 'utf8' }).stdout), ['path with spaces', 'a&b']);
  const devEcoBuild = (...args) => portableSpawnSync(process.execPath, [join(scripts, 'deveco-build.mjs'), ...args], {
    env: { ...process.env, READER_NODE: process.execPath, HVIGORW: nodeCli }, encoding: 'utf8',
  });
  const receivedHvigorArgs = (...args) => {
    const result = devEcoBuild(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const debugModule = ['--mode', 'module', '-p', 'module=entry@default', '-p', 'product=default',
    '-p', 'requiredDeviceType=phone', '-p', 'buildMode=debug'];
  const incrementalFlags = ['--analyze=normal', '--parallel', '--incremental', '--daemon'];
  assert.deepEqual(receivedHvigorArgs('--compile-only'), [...debugModule, 'default@CompileArkTS', ...incrementalFlags]);
  assert.deepEqual(receivedHvigorArgs(), [...debugModule, 'assembleHap', ...incrementalFlags]);
  assert.deepEqual(receivedHvigorArgs('tasks', '--no-daemon'), ['tasks', '--no-daemon']);
  const mixedTasks = devEcoBuild('--compile-only', 'assembleHap');
  assert.equal(mixedTasks.status, 1);
  assert.equal(mixedTasks.stdout, '');
  assert.match(mixedTasks.stderr, /--compile-only must be used on its own/);
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
  assert.equal(nativeInputPaths(core, { CARGO_TARGET_DIR: external, READER_HARMONY_CORE_PROFILE: 'smoke' }).identity,
    join(external, 'harmony-napi/arm64-v8a/smoke/core-build-identity.json'));
  assert.throws(() => requireAcceptanceInputs(core, { CARGO_TARGET_DIR: external }), /acceptance input missing/);
  for (const path of Object.values(redirected)) put(path, 'current external output');
  assert.deepEqual(requireAcceptanceInputs(core, { CARGO_TARGET_DIR: external }), redirected);
  assert.equal(nativeInputPaths(core, { CARGO_TARGET_DIR: '../relative-cache' }).identity,
    join(root, 'relative-cache/harmony-napi/arm64-v8a/core-build-identity.json'));
  const pipelineEntry = join(scripts, 'hap-pipeline.mjs');
  const invalidAcceptance = (...args) => portableSpawnSync(process.execPath,
    [pipelineEntry, 'build', '--class', 'acceptance', ...args], {
      env: { ...process.env, READER_HARMONY_ABI: 'arm64-v8a', READER_HARMONY_CORE_PROFILE: 'release' }, encoding: 'utf8',
    });
  const incrementalAcceptance = invalidAcceptance('--incremental');
  assert.equal(incrementalAcceptance.status, 2);
  assert.match(incrementalAcceptance.stderr, /--incremental.*--class iteration/);
  const smokeAcceptance = invalidAcceptance('--core-profile', 'smoke');
  assert.equal(smokeAcceptance.status, 2);
  assert.match(smokeAcceptance.stderr, /acceptance.*release|release.*acceptance/i);
  const leanAcceptance = invalidAcceptance('--lean-fonts');
  assert.equal(leanAcceptance.status, 2);
  assert.match(leanAcceptance.stderr, /--lean-fonts.*--class iteration/);
  const leanRc = portableSpawnSync(process.execPath,
    [pipelineEntry, 'build', '--class', 'iteration', '--channel', 'RC', '--lean-fonts'], {
      env: { ...process.env, READER_HARMONY_ABI: 'arm64-v8a', READER_HARMONY_CORE_PROFILE: 'release' }, encoding: 'utf8',
    });
  assert.equal(leanRc.status, 2);
  assert.match(leanRc.stderr, /--lean-fonts.*DEV/);
  const hapOutputs = join(root, 'hap-outputs');
  put(join(hapOutputs, 'entry-default-signed.hap'));
  put(join(hapOutputs, 'entry-default-unsigned.hap'));
  assert.deepEqual(findBuiltHaps(hapOutputs, 'local', 'iteration'), ['entry-default-signed.hap']);
  assert.deepEqual(findBuiltHaps(hapOutputs, 'local', 'acceptance'), ['entry-default-signed.hap', 'entry-default-unsigned.hap']);
  rmSync(join(hapOutputs, 'entry-default-unsigned.hap'));
  assert.deepEqual(findBuiltHaps(hapOutputs, 'local', 'iteration'), ['entry-default-signed.hap']);
  assert.throws(() => findBuiltHaps(hapOutputs, 'local', 'acceptance'), /did not produce the unsigned HAP/);
  const pipelineSources = [pipelineEntry, ...[
    'locks-and-retention', 'workspace-fingerprint', 'build-and-sign', 'deploy-and-verify',
  ].map(name => join(scripts, 'hap-pipeline', `${name}.mjs`))];
  for (const path of pipelineSources) {
    const source = readFileSync(path, 'utf8').replace(/^#!.*\n/, '');
    assert.doesNotMatch(source, /\/Applications\/|\/usr\/bin\/|run\('rsync'/, path);
  }
  const smokeScript = join(scripts, 'dev-harmony-smoke.mjs');
  const dryDefault = portableSpawnSync(process.execPath, [smokeScript, '--dry-run'], { encoding: 'utf8' });
  assert.equal(dryDefault.status, 0, dryDefault.stderr);
  const dryDefaultPlan = JSON.parse(dryDefault.stdout);
  assert.equal(dryDefaultPlan.status, 'DRY_RUN');
  assert.equal(dryDefaultPlan.abi, 'arm64-v8a');
  assert.deepEqual(dryDefaultPlan.steps.map(step => step.name), ['core-smoke-native', 'sync-native', 'hap-iteration-incremental']);
  assert.ok(dryDefaultPlan.steps[0].args.includes('smoke'));
  assert.ok(dryDefaultPlan.steps[2].args.includes('--incremental'));
  const drySkipped = portableSpawnSync(process.execPath, [smokeScript, '--abi', 'x86_64', '--skip-core', '--timings', '--dry-run'], { encoding: 'utf8' });
  assert.equal(drySkipped.status, 0, drySkipped.stderr);
  const drySkippedPlan = JSON.parse(drySkipped.stdout);
  assert.equal(drySkippedPlan.abi, 'x86_64');
  assert.deepEqual(drySkippedPlan.steps.map(step => step.name), ['hap-iteration-incremental']);
  assert.equal(drySkippedPlan.steps[0].env?.READER_HAP_TIMINGS, '1');
  const dryLean = portableSpawnSync(process.execPath, [smokeScript, '--skip-core', '--lean-fonts', '--dry-run'], { encoding: 'utf8' });
  assert.equal(dryLean.status, 0, dryLean.stderr);
  assert.ok(JSON.parse(dryLean.stdout).steps[0].args.includes('--lean-fonts'));
  const invalidSmoke = portableSpawnSync(process.execPath, [smokeScript, '--unknown-flag'], { encoding: 'utf8' });
  assert.equal(invalidSmoke.status, 2);
  console.log('HarmonyOS toolchain portability: PASS (tool discovery, CLI routing, private ACL policy, acceptance arguments).');
} finally { rmSync(root, { recursive: true, force: true }); }
