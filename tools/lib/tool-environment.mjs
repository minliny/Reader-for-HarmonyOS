/** Host paths used by probes are discovered by the same resolver as packaging. */
import { existsSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveHarmonyTool } from '../../scripts/lib/harmony-toolchain.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const localFilePath = fileURLToPath;
export const localFileUrl = pathToFileURL;
export const resolveEtsLoaderRoot = (options = {}) => resolveHarmonyTool('etsLoader', { cwd: repositoryRoot, ...options });
export const resolveOpenHarmonySdkRoot = (options = {}) => resolve(resolveEtsLoaderRoot(options), '../../..');
export const virtualFilePath = name => join(tmpdir(), name).replaceAll('\\', '/');
export const resolveHostTool = (name, options = {}) => resolveHarmonyTool(name, { cwd: repositoryRoot, ...options });
export function coreCliPath(coreRoot = resolve(repositoryRoot, '../Reader-Core-Native'), { env = process.env, platform = process.platform } = {}) {
  if (env.READER_CORE_CLI) return resolve(env.READER_CORE_CLI);
  return resolve(coreRoot, env.CARGO_TARGET_DIR || 'target', 'debug', platform === 'win32' ? 'reader-cli.exe' : 'reader-cli');
}
export const temporaryOutput = prefix => mkdtempSync(join(tmpdir(), prefix));

function existingFile(candidates, description) {
  const found = candidates.find(value => value && existsSync(value) && statSync(value).isFile());
  if (!found) throw new Error(`${description} unavailable. Configure its explicit environment override or install the host SDK component.`);
  return found;
}
export function resolveArkFrontend({ env = process.env, platform = process.platform, ...options } = {}) {
  if (env.READER_ES2ABC) return existingFile([resolve(env.READER_ES2ABC)], 'READER_ES2ABC');
  const loader = resolveEtsLoaderRoot({ env, platform, ...options });
  const host = { darwin: 'mac', linux: 'linux', win32: 'win' }[platform];
  if (!host) throw new Error(`Ark bytecode probe does not support host ${platform}; configure READER_ES2ABC.`);
  const name = platform === 'win32' ? 'es2abc.exe' : 'es2abc';
  return existingFile([join(loader, 'bin/ark', `build-${host}`, 'bin', name),
    join(loader, 'bin/ark', host, name), join(loader, 'bin', name)], 'Ark bytecode frontend (READER_ES2ABC)');
}
export function resolveArkUIRuntime({ env = process.env, platform = process.platform, ...options } = {}) {
  if (env.READER_ARKUI_PREVIEW_RUNTIME) return existingFile([resolve(env.READER_ARKUI_PREVIEW_RUNTIME)], 'READER_ARKUI_PREVIEW_RUNTIME');
  const root = resolveOpenHarmonySdkRoot({ env, platform, ...options });
  const name = { darwin: 'libace_compatible.dylib', linux: 'libace_compatible.so', win32: 'libace_compatible.dll' }[platform];
  if (!name) throw new Error(`ArkUI runtime probe does not support host ${platform}; configure READER_ARKUI_PREVIEW_RUNTIME.`);
  return existingFile([join(root, 'previewer/common/bin', name), join(root, 'previewer/common/lib', name),
    ...(platform === 'win32' ? [join(root, 'previewer/common/bin/ace_compatible.dll')] : [])],
  'ArkUI preview runtime (READER_ARKUI_PREVIEW_RUNTIME)');
}

/** Resolve installed packages; an override points to the package or an anchor file. */
export function requireToolPackage(name, override, { env = process.env } = {}) {
  const req = createRequire(import.meta.url);
  if (override) {
    const target = resolve(override);
    if (!existsSync(target)) throw new Error(`${name} module override does not exist: ${target}`);
    return createRequire(statSync(target).isDirectory() ? join(target, 'package.json') : target)(name);
  }
  const repo = repositoryRoot;
  const paths = [repo, dirname(repo), join(dirname(repo), 'Reader-UI'),
    ...(env.READER_NODE_MODULES ? [dirname(resolve(env.READER_NODE_MODULES))] : [])];
  try { return req(req.resolve(name, { paths })); }
  catch (error) { throw new Error(`Install ${name} in the workspace or set its module override. ${error.message}`); }
}
