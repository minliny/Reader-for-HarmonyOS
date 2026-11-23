#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { portableSpawnSync, resolveHarmonyTool, windowsBatchCommand } from './lib/harmony-toolchain.mjs';
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
  const pipeline = readFileSync(join(repository, 'scripts/hap-pipeline.mjs'), 'utf8');
  assert.equal(/\/Applications\/|\/usr\/bin\/|run\('rsync'/.test(pipeline.replace(/^#!.*\n/, '')), false);
  console.log('HarmonyOS toolchain portability: PASS (configured paths, Windows extensions, SDK layout, Node CLI, private ACL policy).');
} finally { rmSync(root, { recursive: true, force: true }); }
