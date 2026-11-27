import { assertAppVersion, validateAppBuildIdentity } from './app-build-identity.mjs';

const commitHash = /^[0-9a-f]{40}$/;
const sha256 = /^[0-9a-f]{64}$/;
const newestFirst = field => (left, right) => Date.parse(right[field]) - Date.parse(left[field]);
const records = (harmony, core) => [['Harmony', harmony], ['Core', core]];

export function assertCleanMainline(harmony, core) {
  for (const [label, source] of records(harmony, core)) {
    if (source?.dirty !== false) throw new Error(`acceptance requires a clean ${label} worktree`);
    if (!commitHash.test(source.commit) || source.commit !== source.mainCommit) {
      throw new Error(`acceptance requires ${label} HEAD at refs/heads/main`);
    }
  }
}

export function latestSignedRun(candidates, abi) {
  const runs = candidates.filter(candidate => (candidate.abi ?? 'arm64-v8a') === abi &&
    candidate.artifacts.some(artifact => artifact.kind === 'signed')).sort(newestFirst('finishedAt'));
  if (runs.length > 1 && Date.parse(runs[0].finishedAt) === Date.parse(runs[1].finishedAt)) {
    throw new Error(`ambiguous latest signed HAP for ${abi}`);
  }
  return runs[0];
}

function sourceRecordedClean(source) {
  return source?.dirty === false && commitHash.test(source.commit) &&
    (source.mainCommit === undefined || source.mainCommit === source.commit);
}

export function mainlineSourceMatch(source, current, coreInputFingerprint) {
  const harmony = sourceRecordedClean(source?.harmony) && source.harmony.commit === current.harmony.mainCommit;
  let core = 'unmatched';
  const inputConflict = coreInputFingerprint !== undefined && current.core.inputFingerprint !== undefined &&
    coreInputFingerprint !== current.core.inputFingerprint;
  if (sourceRecordedClean(source?.core) && !inputConflict) {
    if (source.core.commit === current.core.mainCommit) core = 'exact-commit';
    else if (source.core.commit === current.core.equivalentPin && sha256.test(coreInputFingerprint ?? '') &&
        coreInputFingerprint === current.core.inputFingerprint) core = 'pinned-input-fingerprint';
  }
  return { harmony, core };
}

export function assertMainlineHap(verified, current, abi) {
  assertCleanMainline(current.harmony, current.core);
  const { manifest } = verified;
  if ((manifest.abi ?? 'arm64-v8a') !== abi) throw new Error('latest HAP ABI mismatch');
  const artifact = verified.artifacts.find(item => item.kind === 'signed');
  if (!artifact || !sha256.test(artifact.sha256) || artifact.signature?.status !== 'signed' ||
      artifact.signature.verified !== true) throw new Error('latest HAP lacks a verified signature');
  const sourceMatch = mainlineSourceMatch(manifest.source, current, artifact.storageCapability?.coreInputFingerprint);
  if (!sourceMatch.harmony) throw new Error('latest HAP source does not match clean Harmony main');
  if (sourceMatch.core === 'unmatched') throw new Error('latest HAP source does not match clean Core main');
  validateAppBuildIdentity(manifest.expectedVersion);
  return artifact;
}

export function assertInstallReceipt({ receipt, manifest, artifact, observed }) {
  if (receipt?.schemaVersion !== 1 || receipt.name !== 'reader-harmonyos-deployment-receipt' ||
      receipt.runId !== manifest.runId || receipt.install !== 'PASS' || receipt.dataPolicy !== 'preserve' ||
      receipt.appVersionCheck !== 'PASS' || receipt.targetKind !== observed.targetKind ||
      receipt.targetRef !== observed.targetRef || receipt.hdcServer !== observed.hdcServer ||
      receipt.vmLocation !== observed.vmLocation || receipt.artifact?.kind !== 'signed' ||
      receipt.artifact.sha256 !== artifact.sha256 || receipt.artifact.signature?.status !== 'signed' ||
      receipt.artifact.signature.verified !== true ||
      !Number.isFinite(Date.parse(receipt.completedAt))) throw new Error('deployment receipt does not bind this target and signed HAP');
  for (const field of ['certificateSha256', 'profileType', 'appIdSha256', 'appIdentifierSha256']) {
    if (receipt.artifact.signature[field] !== artifact.signature[field]) {
      throw new Error(`deployment receipt signing identity differs: ${field}`);
    }
  }
  assertAppVersion(manifest.expectedVersion, receipt.expectedVersion, 'Deployment receipt');
  const live = observed.installed;
  const recorded = receipt.postInstall;
  if (!live?.bundlePresent || !recorded?.bundlePresent || !Number.isSafeInteger(live.updateTime) || live.updateTime <= 0 ||
      !Number.isSafeInteger(live.uid) || live.uid <= 0 ||
      ![live.appIdSha256, live.appIdentifierSha256].some(digest => sha256.test(digest))) {
    throw new Error('live installed bundle identity is incomplete');
  }
  for (const field of ['bundleName', 'uid', 'updateTime', 'cpuAbi', 'appSignType', 'appProvisionType',
    'appIdSha256', 'appIdentifierSha256', 'versionName', 'versionCode']) {
    if (live[field] !== recorded[field]) throw new Error(`installed bundle differs from deployment receipt: ${field}`);
  }
  assertAppVersion(manifest.expectedVersion, recorded.appVersion, 'Receipt installed bundle');
  assertAppVersion(manifest.expectedVersion, live.appVersion, 'Live installed bundle');
}
