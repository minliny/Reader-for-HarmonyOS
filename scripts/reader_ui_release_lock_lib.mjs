import assert from 'node:assert/strict';

export const READER_UI_CONSUMER_LOCK_PATH = 'READER_UI_CONSUMER.json';
export const READER_UI_PACKAGE_LOCK_PATH = 'entry/oh-package-lock.json5';
export const READER_UI_RUNTIME_PACKAGE_NAME = 'reader_ui_runtime';
export const READER_UI_RELEASE_BUMP_PATHS = Object.freeze([
  READER_UI_CONSUMER_LOCK_PATH,
  READER_UI_PACKAGE_LOCK_PATH,
]);

const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*)))*)?$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function plainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function canonicalSemver(value, label) {
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value)) {
    throw new Error(`${label} must be canonical semantic versioning without build metadata`);
  }
  return value;
}

function sha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function sourceSha(value, label) {
  if (typeof value !== 'string' || !SOURCE_SHA_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase 40- or 64-character Git object id`);
  }
  return value;
}

function runtimePackages(packageLock) {
  const checked = plainObject(packageLock, 'HarmonyOS package lock');
  const packages = plainObject(checked.packages, 'HarmonyOS package lock packages');
  const matches = Object.entries(packages)
    .filter(([, value]) => value?.name === READER_UI_RUNTIME_PACKAGE_NAME);
  if (matches.length !== 1) {
    throw new Error(`HarmonyOS package lock must contain exactly one ${READER_UI_RUNTIME_PACKAGE_NAME}`);
  }
  return matches;
}

export function readerUiRuntimePackageVersion(packageLock) {
  const [[, runtimePackage]] = runtimePackages(packageLock);
  return canonicalSemver(runtimePackage.version, `${READER_UI_RUNTIME_PACKAGE_NAME} version`);
}

export function assertVerifiedHarmonyReleaseMatchesConsumer(verifiedValue, consumerValue) {
  const verified = plainObject(verifiedValue, 'verified Reader UI release');
  const consumer = plainObject(consumerValue, 'Reader UI consumer lock');
  if (verified.host !== 'harmonyos') throw new Error('verified Reader UI release must target harmonyos');
  if (verified.hostRepository !== 'minliny/Reader-for-HarmonyOS') {
    throw new Error('verified Reader UI release targets the wrong host repository');
  }
  canonicalSemver(verified.readerUiVersion, 'verified Reader UI version');
  if (verified.tag !== `v${verified.readerUiVersion}`) {
    throw new Error('verified Reader UI tag does not match its version');
  }
  sourceSha(verified.sourceSha, 'verified Reader UI source SHA');
  sha256(verified.manifestSha256, 'verified Reader UI manifest SHA-256');
  sha256(verified.targetConfigSha256, 'verified Reader UI target config SHA-256');
  sha256(verified.runtimeActionsSha256, 'verified Reader UI runtime actions SHA-256');
  if (verified.releaseId !== `${verified.sourceSha}:${verified.manifestSha256}`) {
    throw new Error('verified Reader UI releaseId is not bound to source and manifest');
  }
  if (consumer.host !== 'harmonyos') throw new Error('Reader UI consumer lock must target harmonyos');
  assert.equal(consumer.readerUiVersion, verified.readerUiVersion,
    'consumer version must match the verified Reader UI release');
  assert.equal(consumer.hostRequestSchemaVersion, verified.hostRequestSchemaVersion,
    'consumer HostRequest schema must match the verified Reader UI release');
  assert.equal(consumer.runtimeActionsSchemaVersion, verified.runtimeActionsSchemaVersion,
    'consumer runtime schema must match the verified Reader UI release');
  assert.equal(consumer.runtimeActionsSha256, verified.runtimeActionsSha256,
    'consumer runtime hash must match the verified Reader UI release');
  const identity = plainObject(consumer.releaseIdentity, 'Reader UI consumer release identity');
  assert.deepEqual(identity, {
    releaseId: verified.releaseId,
    sourceSha: verified.sourceSha,
    manifestSha256: verified.manifestSha256,
    targetConfigSha256: verified.targetConfigSha256,
  }, 'consumer release identity must exactly match the verified Reader UI release');
  return { verified, consumer };
}

export function updateReaderUiRuntimePackageVersion(packageLockValue, versionValue) {
  const version = canonicalSemver(versionValue, 'Reader UI package version');
  const packageLock = structuredClone(plainObject(packageLockValue, 'HarmonyOS package lock'));
  const [[key, runtimePackage]] = runtimePackages(packageLock);
  packageLock.packages[key] = { ...runtimePackage, version };
  return packageLock;
}

export function assertReaderUiReleaseLocksSynchronized(consumerValue, packageLockValue) {
  const consumer = plainObject(consumerValue, 'Reader UI consumer lock');
  const consumerVersion = canonicalSemver(consumer.readerUiVersion, 'Reader UI consumer version');
  const packageVersion = readerUiRuntimePackageVersion(packageLockValue);
  assert.equal(packageVersion, consumerVersion,
    'HarmonyOS reader_ui_runtime package lock must match READER_UI_CONSUMER.json');
  return consumerVersion;
}

export function assertReaderUiPackageLockVersionUpdate(beforeValue, afterValue, versionValue) {
  const expected = updateReaderUiRuntimePackageVersion(beforeValue, versionValue);
  assert.deepEqual(afterValue, expected,
    `HarmonyOS package lock update may only set ${READER_UI_RUNTIME_PACKAGE_NAME}.version`);
  return expected;
}

export function assertExactReaderUiReleaseBumpPaths(pathsValue, label = 'Reader UI release bump') {
  if (!Array.isArray(pathsValue)) throw new Error(`${label} paths must be an array`);
  const paths = [...pathsValue];
  if (paths.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`${label} paths must be non-empty strings`);
  }
  if (new Set(paths).size !== paths.length) throw new Error(`${label} paths must be unique`);
  const actual = paths.sort();
  const expected = [...READER_UI_RELEASE_BUMP_PATHS].sort();
  assert.deepEqual(actual, expected,
    `${label} must contain exactly ${expected.join(', ')}`);
  return actual;
}
