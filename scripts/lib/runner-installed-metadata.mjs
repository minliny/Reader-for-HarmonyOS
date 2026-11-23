import { createHash } from 'node:crypto';

const readerBundle = 'io.reader.minliny';
const runnerModule = 'entry_test';
const featureModuleType = 2; // HarmonyOS BundleManager.ModuleType.FEATURE
const bundlePattern = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u;
const lookupUnavailable = 'error: failed to get information and the parameters may be wrong.';
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const nonemptyString = value => typeof value === 'string' && value.trim().length > 0;
const sha256 = value => createHash('sha256').update(value).digest('hex');

function inventoryConfirmsAbsence(output, bundleName) {
  const [user, ...bundles] = output.trim().split(/\r?\n/u).map(line => line.trim());
  return /^ID: [0-9]+:$/u.test(user) && bundles.length > 0 &&
    bundles.every(bundle => bundlePattern.test(bundle)) && !bundles.includes(bundleName);
}

function parseModules(data, bundleName) {
  // The bm dump CLI emits hapModuleInfos, the native records with bundle and type.
  const modules = data.hapModuleInfos;
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error('Installed Runner metadata lacks native module records');
  }
  const known = new Map();
  for (const mod of modules) {
    if (mod?.bundleName !== bundleName || !nonemptyString(mod.moduleName) ||
        (mod.name !== undefined && mod.name !== mod.moduleName) ||
        ![1, featureModuleType, 3].includes(mod.moduleType) || known.has(mod.moduleName)) {
      throw new Error('Installed Runner metadata has an invalid or ambiguous module record');
    }
    known.set(mod.moduleName, mod);
  }
  for (const summary of [data.hapModuleNames, data.moduleNames]) {
    if (summary === undefined) continue;
    if (!Array.isArray(summary) || summary.length !== known.size ||
        new Set(summary).size !== known.size || !summary.every(name => known.has(name))) {
      throw new Error('Installed Runner metadata has contradictory module membership');
    }
  }
  const runner = known.get(runnerModule);
  if (!runner) return '';
  if (runner.moduleType !== featureModuleType || runner.versionCode !== data.versionCode) {
    throw new Error('Installed Runner metadata does not prove the current entry_test feature');
  }
  return runnerModule;
}

/** Project a successful scoped bm dump without exposing raw signing identities. */
export function parseRunnerInstalledMetadata(output, bundleName, bundleListOutput = '') {
  if (typeof bundleName !== 'string' || bundleName.length > 128 ||
      !bundlePattern.test(bundleName) || bundleName === readerBundle) {
    throw new Error('A valid independent Runner bundle is required');
  }
  if (typeof output !== 'string' || typeof bundleListOutput !== 'string') {
    throw new Error('Installed Runner metadata is unavailable; absence is not established');
  }
  const response = output.trim();
  const explicitAbsence = response === `error: bundle [${bundleName}] not found` ||
    response === `error: bundle [${bundleName}] not found.`;
  if ((explicitAbsence && !bundleListOutput.trim()) ||
      ((explicitAbsence || response === lookupUnavailable) &&
        inventoryConfirmsAbsence(bundleListOutput, bundleName))) {
    return { bundlePresent: false, bundleName };
  }

  const lineBreak = response.indexOf('\n');
  if (lineBreak < 0 || response.slice(0, lineBreak).replace(/\r$/u, '') !== `${bundleName}:`) {
    throw new Error('Installed Runner metadata is unavailable; absence is not established');
  }
  let data;
  try {
    data = JSON.parse(response.slice(lineBreak + 1));
  } catch {
    throw new Error('Installed Runner metadata is malformed');
  }
  const app = data?.applicationInfo;
  if (data?.name !== bundleName || app?.bundleName !== bundleName ||
      (data.bundleName !== undefined && data.bundleName !== bundleName)) {
    throw new Error('Installed Runner metadata has an unexpected bundle identity');
  }
  if (!nonemptyString(data.appId) || !nonemptyString(data.appIdentifier) ||
      typeof app.appProvisionType !== 'string' || !/^(debug|release)$/iu.test(app.appProvisionType)) {
    throw new Error('Installed Runner signing metadata is incomplete');
  }
  const { versionName, versionCode, updateTime } = data;
  if (typeof versionName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/u.test(versionName) ||
      !positiveInteger(versionCode) || !positiveInteger(updateTime) || !positiveInteger(app.uid)) {
    throw new Error('Installed Runner version or installation metadata is incomplete');
  }
  return {
    bundlePresent: true,
    bundleName,
    moduleName: parseModules(data, bundleName),
    appProvisionType: app.appProvisionType.toLowerCase(),
    appIdSha256: sha256(data.appId),
    appIdentifierSha256: sha256(data.appIdentifier),
    versionName,
    versionCode,
    updateTime,
    uid: app.uid,
  };
}

/** Use the same public identity for deployment and the near-action probe. */
export function publicRunnerInstalledMetadata(installed) {
  if (installed?.bundlePresent !== true || installed.moduleName !== runnerModule) {
    throw new Error('The exact independent Runner installation is unavailable');
  }
  const {
    bundleName, moduleName, appProvisionType, appIdSha256, appIdentifierSha256,
    versionName, versionCode, updateTime,
  } = installed;
  return {
    bundleName, moduleName, appProvisionType, appIdSha256, appIdentifierSha256,
    versionName, versionCode, updateTime,
  };
}
