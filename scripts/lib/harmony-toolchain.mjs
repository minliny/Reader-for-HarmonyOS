import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, delimiter, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { sdkSetting, normalizeSdkRoot, ENVIRONMENT_CONTRACT } from './development-environment.mjs';

export { ENVIRONMENT_CONTRACT };

const definitions = {
  node: { env: ['READER_NODE', 'NODE'], commands: ['node'], studio: ['tools/node/bin/node', 'tools/node/node.exe'] },
  hvigorw: { env: ['HVIGORW'], commands: ['hvigorw'], studio: ['tools/hvigor/bin/hvigorw.js', 'tools/hvigor/bin/hvigorw'] },
  ohpm: { env: ['OHPM'], commands: ['ohpm'], studio: ['tools/ohpm/bin/pm-cli.js', 'tools/ohpm/bin/ohpm'] },
  hdc: { env: ['HDC'], commands: ['hdc'], sdk: ['toolchains/hdc'] },
  etsLoader: { env: ['READER_ETS_LOADER_ROOT'], sdk: ['ets/build-tools/ets-loader'], directory: true },
  hvigorPlugin: { env: ['READER_HVIGOR_PLUGIN_PACKAGE'], studio: ['tools/hvigor/hvigor-ohos-plugin/package.json'] },
  signTool: { env: ['HAP_SIGN_TOOL'], sdk: ['toolchains/lib/hap-sign-tool.jar'] },
  objcopy: { env: ['NATIVE_STRIP_TOOL'], commands: ['llvm-objcopy'], sdk: ['native/llvm/bin/llvm-objcopy'] },
  java: { env: ['JAVA'], commands: ['java'], studio: ['jbr/Contents/Home/bin/java', 'jbr/bin/java'] },
  openssl: { env: ['OPENSSL'], commands: ['openssl'] },
  unzip: { env: ['UNZIP'], commands: ['unzip'] },
};

function present(path, directory = false) {
  try { return directory ? statSync(path).isDirectory() : statSync(path).isFile(); } catch { return false; }
}

function executableCandidates(path, platform) {
  if (platform !== 'win32' || /\.(?:exe|cmd|bat|[cm]?js)$/i.test(path)) return [path];
  return [`${path}.exe`, `${path}.cmd`, `${path}.bat`, path];
}

function searchCommand(command, env, platform, cwd) {
  if (isAbsolute(command) || /[/\\]/.test(command)) {
    return executableCandidates(resolve(cwd, command), platform).find(path => present(path));
  }
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH');
  const separator = platform === 'win32' ? ';' : delimiter;
  for (const entry of (env[pathKey] || '').split(separator).filter(Boolean)) {
    const found = executableCandidates(join(entry.replace(/^"|"$/g, ''), command), platform).find(path => present(path));
    if (found) return resolve(found);
  }
}

function studioRoots(env, platform, cwd) {
  const explicit = env.READER_DEVECO_HOME || env.DEVECO_HOME;
  if (explicit) return [resolve(cwd, explicit)].flatMap(root => platform === 'darwin' ? [join(root, 'Contents'), root] : [root]);
  if (platform === 'darwin') return ['/Applications/DevEco-Studio.app/Contents', join(homedir(), 'Applications/DevEco-Studio.app/Contents')]; // reader-portability-allow fixed-install-root -- Official macOS discovery candidate after explicit configuration; PATH remains supported; no fixed installation required.
  if (platform === 'win32') return [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean)
    .flatMap(root => [join(root, 'Huawei/DevEco Studio'), join(root, 'Huawei/DevEcoStudio'), join(root, 'DevEco Studio')]);
  return ['/opt/DevEcoStudio', '/opt/DevEco-Studio', '/opt/deveco-studio', join(homedir(), 'DevEcoStudio'), join(homedir(), 'deveco-studio')];
}

function propertiesSdk(cwd) {
  const file = join(cwd, 'local.properties');
  if (!existsSync(file)) return undefined;
  const values = [...readFileSync(file, 'utf8').matchAll(/^\s*(?:sdk\.dir|hwsdk\.dir)\s*=\s*(.*?)\s*$/gm)];
  return values[0]?.[1].replace(/\\([\\:= ])/g, '$1');
}

/** Resolve a non-secret tool path. Explicit settings fail closed instead of falling back. */
export function resolveHarmonyTool(name, options = {}) {
  const { env = process.env, platform = process.platform, cwd = process.cwd(), required = true } = options;
  const roots = studioRoots(env, platform, cwd);
  if (name === 'devecoHome') {
    const result = roots.find(root => present(root, true));
    if (result || !required) return result;
    throw new Error('DevEco Studio was not found; set READER_DEVECO_HOME to its installation directory.');
  }
  if (name === 'sdkHome') {
    const setting = sdkSetting(env)?.value || propertiesSdk(cwd);
    const sdkRoots = setting ? [resolve(cwd, setting)] : roots.map(root => join(root, 'sdk'));
    for (const root of sdkRoots) { const found = normalizeSdkRoot(root); if (found) return realpathSync(found); }
    if (required || setting) throw new Error('HarmonyOS SDK was not found; set READER_HARMONY_SDK_HOME (SDK root or openharmony directory).');
    return undefined;
  }
  const definition = definitions[name];
  if (!definition) throw new Error(`Unknown HarmonyOS tool: ${name}`);
  const key = definition.env.find(key => env[key]);
  if (key) {
    const value = env[key];
    const found = definition.directory || name === 'signTool' || name === 'hvigorPlugin'
      ? (present(resolve(cwd, value), definition.directory) ? resolve(cwd, value) : undefined)
      : searchCommand(value, env, platform, cwd);
    if (found) return found;
    throw new Error(`${key} does not identify an available ${name}; fix the explicit setting.`);
  }
  if (name === 'java' && env.JAVA_HOME) {
    const found = executableCandidates(join(env.JAVA_HOME, 'bin/java'), platform).find(path => present(path));
    if (found) return found;
    throw new Error('JAVA_HOME does not contain a Java executable.');
  }
  if (name === 'node' && env.NODE_HOME) {
    for (const entry of ['bin/node', 'node']) {
      const found = executableCandidates(join(env.NODE_HOME, entry), platform).find(path => present(path));
      if (found) return found;
    }
    throw new Error('NODE_HOME does not contain a Node executable.');
  }
  for (const root of roots) for (const entry of definition.studio || []) {
    const found = executableCandidates(join(root, entry), platform).find(path => present(path, definition.directory));
    if (found) return found;
  }
  if (definition.sdk) {
    const sdk = resolveHarmonyTool('sdkHome', { ...options, required: false });
    if (sdk) for (const entry of definition.sdk) {
      const found = executableCandidates(join(sdk, entry), platform).find(path => present(path, definition.directory));
      if (found) return found;
    }
  }
  for (const command of definition.commands || []) {
    const found = searchCommand(command, env, platform, cwd);
    if (found) return found;
  }
  // DevEco's plugin can also be installed in the project's npm dependency tree.
  if (name === 'hvigorPlugin') {
    const candidate = join(cwd, 'node_modules/@ohos/hvigor-ohos-plugin/package.json');
    if (present(candidate)) return candidate;
  }
  if (!required) return undefined;
  throw new Error(`${name} was not found; set ${definition.env[0]} or configure READER_DEVECO_HOME / READER_HARMONY_SDK_HOME, or install it on PATH.`);
}

/** Avoid POSIX launcher assumptions; execute Node CLIs directly on every host. */
export function windowsBatchCommand(binary, args) {
  // Values are quoted individually. Quoting the whole argv string alone loses
  // executable/path boundaries for installations under Program Files.
  if ([binary, ...args].some(value => /[\r\n"%!?^&|<>]/.test(value))) {
    throw new Error('Windows batch launcher arguments contain unsupported shell syntax; use the tool Node .js entry point instead.');
  }
  // A forwarded Node/.exe argv uses the Windows C-runtime backslash rule:
  // double terminal backslashes so they cannot escape the closing quote.
  return [binary, ...args].map(value => `"${value.replace(/(\\+)$/, '$1$1')}"`).join(' ');
}

export function portableSpawnSync(binary, args, options = {}) {
  if (/\.[cm]?js$/i.test(binary)) {
    const node = resolveHarmonyTool('node', { env: options.env || process.env, cwd: options.cwd || process.cwd(), required: false }) || process.execPath;
    return spawnSync(node, [binary, ...args], options);
  }
  // Windows cannot CreateProcess a .cmd/.bat launcher. The official wrappers
  // are command files; Node's Windows shell quoting is used only for them.
  if (process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(binary)) {
    // These wrappers receive build flags and filesystem paths, never shell
    // fragments. Reject expansion/control syntax before asking cmd.exe to
    // interpret a launcher; spaces and parentheses in Program Files paths work.
    return spawnSync(windowsBatchCommand(binary, args), [], { ...options, shell: true });
  }
  return spawnSync(binary, args, options);
}
