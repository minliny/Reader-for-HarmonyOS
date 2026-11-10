import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export const APP_IDENTITY_SCHEMA = 'reader-app-build-v1';
export const APP_IDENTITY_METADATA = 'reader.appBuildIdentity';
export const APP_RELEASE_LEDGER = 'config/app-release-ledger.json';
const HEX = /^[0-9a-f]{64}$/;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const CHANNELS = ['DEV', 'RC', 'REL'];
const compare = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };

/** Fixed ordering, independent of locale, property insertion order and host paths. */
export function canonicalAppJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalAppJson).join(',') + ']';
  requireValue(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype,
    'App identity inputs must be plain JSON values');
  return '{' + Object.keys(value).sort(compare).map(key => JSON.stringify(key) + ':' + canonicalAppJson(value[key])).join(',') + '}';
}

export function effectiveIdentityApp(appJson) {
  const result = structuredClone(appJson);
  for (const field of ['versionName', 'versionCode', 'buildVersion', 'appBuildId', 'appContentHash', 'contentId']) delete result.app?.[field];
  return result;
}

export function effectiveIdentityModule(moduleJson) {
  const result = structuredClone(moduleJson);
  if (Array.isArray(result.module?.metadata)) {
    result.module.metadata = result.module.metadata.filter(item => item.name !== APP_IDENTITY_METADATA);
    if (!result.module.metadata.length) delete result.module.metadata;
  }
  return result;
}

export function effectiveIdentityProfile(profile) {
  const result = structuredClone(profile);
  delete result.app?.signingConfigs;
  for (const product of result.app?.products ?? []) {
    for (const field of ['signingConfig', 'versionName', 'versionCode', 'buildVersion']) delete product[field];
  }
  return result;
}

/** Ordinary content is hashed byte-for-byte. Only parsed build configurations
 * are canonicalized: their whitespace/CRLF cannot change the effective config.
 * No blanket text conversion, binary conversion, mode bits or absolute paths. */
export function appContentSnapshot(root, inputs, { abi, parseJson5 = JSON.parse } = {}) {
  requireValue(['arm64-v8a', 'x86_64'].includes(abi), 'App content identity requires one explicit ABI');
  root = resolve(root);
  const records = new Map();
  const visit = absolute => {
    const path = relative(root, absolute).split(sep).join('/');
    requireValue(path && !path.startsWith('../') && !isAbsolute(path), 'App identity input escapes its checkout');
    if (path === APP_RELEASE_LEDGER || /^entry\/libs\/(?:arm64-v8a|x86_64)(?:\/|$)/.test(path) &&
        !path.startsWith(`entry/libs/${abi}/`) && path !== `entry/libs/${abi}`) return;
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat && ['hvigor-config.json5', 'oh-package-lock.json5'].includes(path)) return;
    requireValue(stat, `App identity input is missing: ${path}`);
    requireValue(!stat.isSymbolicLink(), `App identity cannot follow symbolic links: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(absolute).sort(compare)) visit(resolve(absolute, name));
      return;
    }
    requireValue(stat.isFile(), `App identity requires a regular file: ${path}`);
    let bytes = readFileSync(absolute), encoding = 'bytes';
    const configFiles = new Set(['AppScope/app.json5', 'build-profile.json5', 'entry/build-profile.json5',
      'hvigor-config.json5', 'entry/src/main/module.json5', 'oh-package.json5', 'oh-package-lock.json5',
      'entry/oh-package.json5', 'entry/oh-package-lock.json5']);
    if (configFiles.has(path)) {
      let value = parseJson5(bytes.toString('utf8'));
      if (path === 'AppScope/app.json5') value = effectiveIdentityApp(value);
      if (path === 'build-profile.json5') value = effectiveIdentityProfile(value);
      if (path === 'entry/src/main/module.json5') value = effectiveIdentityModule(value);
      if (path === 'entry/build-profile.json5' && value.buildOption?.externalNativeOptions) {
        value.buildOption.externalNativeOptions.abiFilters = [abi];
      }
      bytes = Buffer.from(canonicalAppJson(value) + '\n');
      encoding = 'canonical-json-lf';
    }
    records.set(path, { path, encoding, bytes: bytes.length, sha256: digest(bytes) });
  };
  for (const input of inputs) {
    const absolute = resolve(root, input);
    const local = relative(root, absolute);
    requireValue(local && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local), 'Invalid app identity input root');
    // Reject linked parent directories as well as the leaf itself.
    for (let parent = absolute; parent !== root; parent = resolve(parent, '..')) {
      requireValue(!lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink(), 'App identity input has a symbolic-link parent');
    }
    visit(absolute);
  }
  return [...records.values()].sort((a, b) => compare(a.path, b.path));
}

export function appContentHash(files, buildIdentityInputs) {
  requireValue(Array.isArray(files) && files.length > 0, 'App content snapshot is empty');
  requireValue(buildIdentityInputs && ['arm64-v8a', 'x86_64'].includes(buildIdentityInputs.abi) &&
    ['debug', 'release'].includes(buildIdentityInputs.buildMode) && buildIdentityInputs.product === 'default', 'App identity ABI/product/build mode is missing');
  const tools = buildIdentityInputs.toolchain;
  requireValue(tools && ['hvigor', 'hvigorPlugin', 'node', 'nativeCompiler', 'java'].every(key => typeof tools[key] === 'string' && tools[key]) &&
    ['ets', 'native', 'toolchains'].every(key => typeof tools.sdk?.[key]?.version === 'string' && tools.sdk[key].version &&
      typeof tools.sdk[key].apiVersion === 'string' && tools.sdk[key].apiVersion), 'App identity toolchain versions are incomplete');
  let previous = '';
  for (const file of files) {
    requireValue(file.path && !file.path.includes('\\') && !file.path.startsWith('/') && !file.path.split('/').some(x => x === '..') &&
      compare(previous, file.path) < 0 && HEX.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes >= 0 &&
      ['bytes', 'canonical-json-lf'].includes(file.encoding), 'Invalid or unordered app content record');
    previous = file.path;
  }
  return digest(canonicalAppJson({ schema: APP_IDENTITY_SCHEMA, buildIdentityInputs, files }));
}

export function validateReleaseLedger(ledger) {
  requireValue(ledger?.schemaVersion === 1 && VERSION.test(ledger.productVersion) && ledger.productVersion.length <= 127, 'Invalid app release ledger/version');
  const validCode = value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
  requireValue(validCode(ledger.versionCode) && ledger.developmentChannel === 'DEV' && Array.isArray(ledger.releases),
    'App release ledger must declare its code and DEV channel');
  let previous = -1;
  const ids = new Set();
  for (const release of ledger.releases) {
    requireValue(VERSION.test(release.versionName) && ['RC', 'REL'].includes(release.channel) && HEX.test(release.appContentHash) &&
      release.appBuildId === `${release.versionName}.${release.channel}.${release.appContentHash.slice(0, 12)}` &&
      validCode(release.versionCode) && release.versionCode > previous && release.versionCode <= ledger.versionCode &&
      !ids.has(release.appBuildId), 'Release ledger has a duplicate, regressing or malformed assignment');
    ids.add(release.appBuildId); previous = release.versionCode;
  }
  return ledger;
}

/** Released assignments are append-only; a checkout cannot silently recycle codes. */
export function validateReleaseLedgerAdvance(ledger, previous) {
  validateReleaseLedger(ledger); validateReleaseLedger(previous);
  requireValue(ledger.versionCode >= previous.versionCode, 'App versionCode regresses below the committed ledger/baseline');
  requireValue(ledger.releases.length >= previous.releases.length &&
    canonicalAppJson(ledger.releases.slice(0, previous.releases.length)) === canonicalAppJson(previous.releases),
    'Committed release assignments must remain unchanged');
  requireValue(ledger.releases.slice(previous.releases.length).every(item => item.versionCode > previous.versionCode),
    'New release assignments must advance the committed versionCode');
}

export function createAppBuildIdentity({ files, buildIdentityInputs, ledger, channel, buildClass, signed }) {
  validateReleaseLedger(ledger);
  requireValue(CHANNELS.includes(channel), 'App channel must be explicit: DEV, RC or REL');
  requireValue(['iteration', 'acceptance'].includes(buildClass), 'Invalid app build class');
  requireValue(channel === 'DEV' || buildClass === 'acceptance' && signed === true, 'RC/REL require a clean signed acceptance build');
  const hash = appContentHash(files, buildIdentityInputs);
  const appBuildId = `${ledger.productVersion}.${channel}.${hash.slice(0, 12)}`;
  const release = ledger.releases.find(item => item.appBuildId === appBuildId);
  requireValue(!release || release.appContentHash === hash, 'App content short-hash collision in release ledger');
  requireValue(channel === 'DEV' || release, 'RC/REL identity must have an explicit versionCode assignment in the release ledger');
  return { schema: APP_IDENTITY_SCHEMA, versionName: ledger.productVersion,
    versionCode: release?.versionCode ?? ledger.versionCode, channel, contentId: hash.slice(0, 12),
    appContentHash: hash, appBuildId };
}

export function validateAppBuildIdentity(value) {
  requireValue(value?.schema === APP_IDENTITY_SCHEMA && VERSION.test(value.versionName) &&
    Number.isSafeInteger(value.versionCode) && value.versionCode >= 0 && value.versionCode <= 2147483647 &&
    CHANNELS.includes(value.channel) && HEX.test(value.appContentHash) && value.contentId === value.appContentHash.slice(0, 12) &&
    value.appBuildId === `${value.versionName}.${value.channel}.${value.contentId}`, 'Malformed app build identity');
  return value;
}

export function injectAppIdentity(appJson, moduleJson, identity) {
  validateAppBuildIdentity(identity);
  const app = structuredClone(appJson), module = effectiveIdentityModule(moduleJson);
  app.app.versionName = identity.versionName; app.app.versionCode = identity.versionCode;
  module.module.metadata = [...(module.module.metadata ?? []), { name: APP_IDENTITY_METADATA, value: canonicalAppJson(identity) }];
  return { app, module };
}

export function packagedAppVersion(moduleJson, { required = false } = {}) {
  const app = moduleJson?.app;
  requireValue(app && typeof app.versionName === 'string' && Number.isSafeInteger(app.versionCode), 'HAP version metadata is missing');
  const entries = (moduleJson.module?.metadata ?? []).filter(item => item.name === APP_IDENTITY_METADATA);
  requireValue(entries.length <= 1 && (!required || entries.length === 1), 'HAP app identity metadata is missing or duplicated');
  let identity;
  if (entries.length) {
    try { identity = validateAppBuildIdentity(JSON.parse(entries[0].value)); }
    catch { throw new Error('HAP app identity metadata is malformed'); }
    requireValue(app.versionName === identity.versionName && app.versionCode === identity.versionCode,
      'HAP system version and app identity disagree');
  }
  return { versionName: app.versionName, versionCode: app.versionCode, ...(identity ? { ...identity } : {}) };
}

export function assertAppVersion(expected, actual, label = 'App') {
  validateAppBuildIdentity(expected);
  validateAppBuildIdentity(actual);
  for (const key of ['schema', 'versionName', 'versionCode', 'channel', 'contentId', 'appContentHash', 'appBuildId']) {
    requireValue(expected[key] === actual[key], `${label} ${key} does not match the expected app version`);
  }
}

export function installedAppIdentity(data) {
  const modules = data.hapModulesInfo ?? data.hapModuleInfos ?? data.hapModuleInfo ?? [];
  const entries = (Array.isArray(modules) ? modules : []).flatMap(module => module.metadata ?? [])
    .filter(item => item.name === APP_IDENTITY_METADATA);
  requireValue(entries.length <= 1, 'Installed app identity is duplicated');
  if (!entries.length) return undefined;
  let value;
  try { value = validateAppBuildIdentity(JSON.parse(entries[0].value)); }
  catch { throw new Error('Installed app identity is malformed'); }
  requireValue(value.versionName === data.versionName && value.versionCode === data.versionCode, 'Installed system version and app identity disagree');
  return value;
}
