// Generated from Reader-Core/scripts/lib/development-environment.mjs; run sync-workspace.mjs --write.
import { existsSync, readFileSync, realpathSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ENVIRONMENT_CONTRACT = 'reader-development-environment-v1';
export const SDK_KEYS = ['READER_HARMONY_SDK_HOME', 'HARMONY_SDK_HOME', 'DEVECO_SDK_HOME', 'OHOS_SDK_HOME'];
export function sdkSetting(env = process.env) {
  const key = SDK_KEYS.find(key => env[key]);
  return key ? { key, value: env[key] } : undefined;
}
const directory = path => { try { return statSync(path).isDirectory(); } catch { return false; } };
export function sdkCandidates(root) {
  const candidates = [root, join(root, 'openharmony'), join(root, 'default/openharmony')];
  if (directory(root)) for (const name of readdirSync(root).filter(name =>
    /^(?:\d+(?:\.\d+)*|HarmonyOS-\d[\w.()+-]*)$/.test(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
    candidates.push(join(root, name), join(root, name, 'openharmony'));
  }
  return candidates;
}
export function normalizeSdkRoot(root) {
  return sdkCandidates(root).find(path => directory(join(path, 'ets')) && directory(join(path, 'toolchains')));
}
/** Packaging needs the official Harmony SDK container, not just ETS tools. */
export function harmonySdkContainerRoot(root) {
  const selected = normalizeSdkRoot(root);
  if (!selected) return undefined;
  const sdkRoot = realpathSync(selected), packageRoot = dirname(sdkRoot);
  const descriptor = join(packageRoot, 'sdk-pkg.json');
  if (!existsSync(descriptor)) return undefined;
  let metadata;
  try { metadata = JSON.parse(readFileSync(descriptor, 'utf8')); }
  catch { throw new Error('The selected Harmony SDK has an invalid sdk-pkg.json'); }
  if (!/^HarmonyOS-\d[\w.()+-]*$/.test(metadata?.data?.path || '') ||
      !directory(join(packageRoot, 'openharmony')) || realpathSync(join(packageRoot, 'openharmony')) !== sdkRoot) {
    throw new Error('The selected Harmony SDK does not match its sdk-pkg.json package');
  }
  return { sdkRoot, packageRoot, containerRoot: dirname(packageRoot) };
}
export function nativeSdkRoot(env = process.env, cwd = process.cwd()) {
  const setting = sdkSetting(env);
  const native = root => [root, ...sdkCandidates(root).map(path => join(path, 'native'))].find(path =>
    existsSync(join(path, 'build/cmake/ohos.toolchain.cmake')) && directory(join(path, 'llvm/bin')) && directory(join(path, 'sysroot')));
  const configured = setting && native(resolve(cwd, setting.value));
  if (setting && !configured) throw new Error(`${setting.key} does not contain the Harmony native SDK`);
  if (env.OHOS_NATIVE_HOME) {
    const explicit = native(resolve(cwd, env.OHOS_NATIVE_HOME));
    if (!explicit) throw new Error('OHOS_NATIVE_HOME does not contain the Harmony native SDK');
    if (configured && realpathSync(explicit) !== realpathSync(configured)) throw new Error('OHOS_NATIVE_HOME and the configured Harmony SDK identify different inputs');
    return realpathSync(explicit);
  }
  if (configured) return realpathSync(configured);
  throw new Error(`Set ${SDK_KEYS.join(', ')} or OHOS_NATIVE_HOME to the host-compatible SDK`);
}
export function assertWorkspaceLayout(root, env = process.env, { requireUI = false } = {}) {
  const result = {};
  const repositories = [['Reader-Core','READER_CORE_ROOT'], ['Reader-for-HarmonyOS','READER_HARMONY_ROOT']];
  if (requireUI) repositories.push(['Reader-UI','READER_UI_ROOT']);
  for (const [name, key] of repositories) {
    const adjacent = join(root, name), selected = resolve(root, env[key] || name);
    if (!directory(adjacent) || !directory(selected)) throw new Error(`Missing ${name} in the adjacent Reader workspace layout`);
    if (realpathSync(selected) !== realpathSync(adjacent)) throw new Error(`${key} must identify the adjacent ${name}; full development/HAP gates do not support split repository layouts`);
    result[name] = realpathSync(selected);
  }
  return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv[2] !== 'native-root') throw new Error('Usage: development-environment.mjs native-root');
  console.log(nativeSdkRoot());
}
