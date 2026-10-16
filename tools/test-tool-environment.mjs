import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolveEtsLoaderRoot, resolveOpenHarmonySdkRoot, resolveArkFrontend, resolveArkUIRuntime,
  localFilePath, localFileUrl, virtualFilePath, requireToolPackage, coreCliPath } from './lib/tool-environment.mjs';

const directory = mkdtempSync(join(tmpdir(), 'reader-tools-environment-'));
try {
  const sdk = join(directory, 'SDK with spaces 中文#', 'openharmony');
  const loader = join(sdk, 'ets/build-tools/ets-loader'); mkdirSync(loader, { recursive: true });
  const env = { READER_ETS_LOADER_ROOT: loader };
  assert.equal(resolveEtsLoaderRoot({ env }), loader);
  assert.equal(resolveOpenHarmonySdkRoot({ env }), sdk);
  assert.equal(coreCliPath(directory, { env: {}, platform: 'win32' }), join(directory, 'target/debug/reader-cli.exe'));
  assert.equal(coreCliPath(directory, { env: { CARGO_TARGET_DIR: 'custom target' }, platform: 'linux' }), join(directory, 'custom target/debug/reader-cli'));
  assert.equal(coreCliPath(directory, { env: { READER_CORE_CLI: join(directory, 'explicit cli') } }), join(directory, 'explicit cli'));
  assert.throws(() => resolveEtsLoaderRoot({ env: { READER_ETS_LOADER_ROOT: join(directory, 'missing') } }), /not found|does not exist|unavailable|available|invalid/i);
  assert.equal(localFilePath(pathToFileURL(join(directory, 'space 中文#%.ets'))), join(directory, 'space 中文#%.ets'));
  assert.equal(localFileUrl(join(directory, 'space 中文#%.ets')).href, pathToFileURL(join(directory, 'space 中文#%.ets')).href);
  assert.equal(localFilePath(new URL('file:///C:/SDK%20space/%E4%B8%AD%E6%96%87.ets'), { windows: true }), 'C:\\SDK space\\中文.ets');
  assert.equal(virtualFilePath('Probe.ets'), join(tmpdir(), 'Probe.ets').replaceAll('\\', '/'));
  for (const [platform, host, executable, runtime] of [
    ['darwin', 'mac', 'es2abc', 'libace_compatible.dylib'],
    ['linux', 'linux', 'es2abc', 'libace_compatible.so'],
    ['win32', 'win', 'es2abc.exe', 'libace_compatible.dll'],
  ]) {
    const frontend = join(loader, 'bin/ark', `build-${host}`, 'bin', executable);
    mkdirSync(join(frontend, '..'), { recursive: true }); writeFileSync(frontend, 'probe');
    const library = join(sdk, 'previewer/common/bin', runtime);
    mkdirSync(join(library, '..'), { recursive: true }); writeFileSync(library, 'probe');
    assert.equal(resolveArkFrontend({ env, platform }), frontend);
    assert.equal(resolveArkUIRuntime({ env, platform }), library);
  }
  assert.throws(() => resolveArkFrontend({ env, platform: 'unsupported' }), /does not support/);
  assert.throws(() => resolveArkUIRuntime({ env: { ...env, READER_ARKUI_PREVIEW_RUNTIME: join(directory, 'missing') } }), /unavailable/);
  const dependencies = join(directory, 'dependency anchor', 'node_modules/reader-tool-fixture');
  mkdirSync(dependencies, { recursive: true });
  writeFileSync(join(dependencies, 'package.json'), JSON.stringify({ name: 'reader-tool-fixture', main: 'index.cjs' }));
  writeFileSync(join(dependencies, 'index.cjs'), 'module.exports = { actual: true };');
  assert.deepEqual(requireToolPackage('reader-tool-fixture', dependencies), { actual: true });
  assert.throws(() => requireToolPackage('reader-tool-fixture', join(directory, 'missing')), /does not exist/);

  // Historical evidence/fixtures keep captured paths; executable maintenance
  // code must use the discovery seam rather than an author's machine path.
  const forbidden = new RegExp('/' + '(?:Users/|Applications/|private/tmp|opt/homebrew|Library/Developer)');
  const visit = base => readdirSync(base, { withFileTypes: true }).flatMap(entry => {
    const name = join(base, entry.name);
    if (entry.isDirectory()) return ['evidence', 'fixtures'].includes(entry.name) ? [] : visit(name);
    return /\.(?:mjs|cjs|js|py|sh)$/.test(name) ? [name] : [];
  });
  for (const file of visit(resolve(import.meta.dirname))) {
    assert.equal(forbidden.test(readFileSync(file, 'utf8')), false, `host path must be discovered: ${file}`);
  }
  console.log('PASS SDK/tool environment: explicit overrides, macOS/Linux/Windows candidate selection, Unicode/spaces URL paths, package anchors, executable-path audit. Host simulations are not native Windows/Linux execution.');
} finally { rmSync(directory, { recursive: true, force: true }); }
