import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { resolveHarmonyTool, portableSpawnSync } from './harmony-toolchain.mjs';
import { APP_RELEASE_LEDGER, appContentSnapshot, createAppBuildIdentity, canonicalAppJson, appContentHash, assertAppVersion, validateReleaseLedgerAdvance } from './app-build-identity.mjs';

export function appIdentityParser(root, env = process.env) {
  const plugin = resolveHarmonyTool('hvigorPlugin', { cwd: root, env });
  return createRequire(plugin)('json5').parse;
}
function commandVersion(binary, args, env) {
  const result = portableSpawnSync(binary, args, { env, encoding: 'utf8', timeout: 10_000 });
  if (result.error || result.status !== 0) throw new Error('App identity cannot determine a selected toolchain version');
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split(/\r?\n/)[0];
}
export function appBuildToolchain(root, env = process.env) {
  const sdk = resolveHarmonyTool('sdkHome', { cwd: root, env });
  const plugin = resolveHarmonyTool('hvigorPlugin', { cwd: root, env });
  const pluginRoot = dirname(plugin);
  const corePackage = resolve(pluginRoot, '../hvigor/package.json');
  if (!existsSync(corePackage)) throw new Error('Selected Hvigor core package identity is unavailable');
  const compiler = resolve(sdk, 'native/llvm/bin', process.platform === 'win32' ? 'clang.exe' : 'clang');
  const components = {};
  for (const component of ['ets', 'native', 'toolchains']) {
    const value = JSON.parse(readFileSync(resolve(sdk, component, 'oh-uni-package.json'), 'utf8'));
    components[component] = { apiVersion: value.apiVersion, version: value.version, releaseType: value.releaseType };
  }
  return { sdk: components,
    hvigor: JSON.parse(readFileSync(corePackage, 'utf8')).version,
    hvigorPlugin: JSON.parse(readFileSync(plugin, 'utf8')).version,
    node: commandVersion(resolveHarmonyTool('node', { cwd: root, env }), ['--version'], env),
    nativeCompiler: commandVersion(compiler, ['--version'], env),
    java: commandVersion(resolveHarmonyTool('java', { cwd: root, env }), ['-version'], env) };
}

function committedReleaseLedger(root, parseJson5, env) {
  const readCommitted = (path, optional = false) => {
    const listing = portableSpawnSync('git', ['-C', root, 'ls-tree', 'HEAD', '--', path], { env, encoding: 'utf8' });
    if (listing.error || listing.status !== 0) throw new Error('Committed app version baseline is unavailable');
    if (!listing.stdout.trim() && optional) return undefined;
    const result = portableSpawnSync('git', ['-C', root, 'show', `HEAD:${path}`], { env, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error('Committed app version baseline is unavailable');
    return result.stdout;
  };
  const previous = readCommitted(APP_RELEASE_LEDGER, true);
  if (previous !== undefined) return JSON.parse(previous);
  const app = parseJson5(readCommitted('AppScope/app.json5')).app;
  return { schemaVersion: 1, productVersion: app.versionName, versionCode: app.versionCode,
    developmentChannel: 'DEV', releases: [] };
}

export function prepareAppIdentity(root, inputs, { abi, buildMode = 'debug', product = 'default', channel,
  buildClass = 'iteration', signed = true, env = process.env } = {}) {
  if (product !== 'default' || !['debug', 'release'].includes(buildMode)) throw new Error('Unsupported app identity product/build mode');
  const parseJson5 = appIdentityParser(root, env);
  const ledger = JSON.parse(readFileSync(resolve(root, APP_RELEASE_LEDGER), 'utf8'));
  validateReleaseLedgerAdvance(ledger, committedReleaseLedger(root, parseJson5, env));
  const files = appContentSnapshot(root, inputs, { abi, parseJson5 });
  const buildIdentityInputs = { abi, buildMode, product, toolchain: appBuildToolchain(root, env) };
  const expectedVersion = createAppBuildIdentity({ files, buildIdentityInputs, ledger,
    channel: channel ?? env.READER_APP_CHANNEL ?? ledger.developmentChannel, buildClass, signed });
  return { expectedVersion, contentSnapshot: { schema: expectedVersion.schema, appContentHash: expectedVersion.appContentHash,
    buildIdentityInputs, files }, ledger, root, inputs, abi, buildMode, product, buildClass, signed };
}

export function assertAppIdentityUnchanged(session, env = process.env) {
  const current = prepareAppIdentity(session.root, session.inputs, { ...session, channel: session.expectedVersion.channel, env });
  if (session.expectedVersion.appContentHash !== current.expectedVersion.appContentHash) {
    const before = new Map(session.contentSnapshot.files.map(file => [file.path, file.sha256]));
    const after = new Map(current.contentSnapshot.files.map(file => [file.path, file.sha256]));
    const changedFiles = [...new Set([...before.keys(), ...after.keys()])].filter(path => before.get(path) !== after.get(path));
    throw new Error('App build inputs changed during compilation: ' + JSON.stringify({ changedFiles,
      buildConfigurationChanged: canonicalAppJson(session.contentSnapshot.buildIdentityInputs) !== canonicalAppJson(current.contentSnapshot.buildIdentityInputs) }));
  }
  assertAppVersion(session.expectedVersion, current.expectedVersion, 'Build inputs');
  if (canonicalAppJson(session.ledger) !== canonicalAppJson(current.ledger)) throw new Error('App release ledger changed during the build');
}

export function verifyAppContentEvidence(snapshot, expected) {
  if (snapshot?.schema !== expected.schema || snapshot.appContentHash !== expected.appContentHash ||
    appContentHash(snapshot.files, snapshot.buildIdentityInputs) !== expected.appContentHash) {
    throw new Error('App content snapshot does not reproduce the expected app identity');
  }
}
