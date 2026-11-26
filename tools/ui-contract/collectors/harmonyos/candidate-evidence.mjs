import { assertAppVersion } from '../../../../scripts/lib/app-build-identity.mjs';
import { requireEvidence, sha256 } from '../../../lib/native-ui-evidence.mjs';

export const remoteVmServer = '192.168.1.10:8710';

function validateInstalledMetadata(installed, subject) {
  const digestFields = ['appIdSha256', 'appIdentifierSha256'];
  requireEvidence(installed?.bundlePresent === true && installed.bundleName === 'io.reader.minliny' &&
    digestFields.every(key => typeof installed[key] === 'string' && /^[0-9a-f]{64}$/u.test(installed[key])) &&
    Number.isSafeInteger(installed.updateTime) && installed.updateTime > 0 &&
    ['arm64-v8a', 'x86_64'].includes(installed.cpuAbi) && ['debug', 'release'].includes(installed.appProvisionType),
  `${subject} is missing complete bundle, signing, ABI, or update identity`);
}

export function assertInstalled(identityRecord, candidate) {
  const installed = identityRecord.installed;
  validateInstalledMetadata(candidate.postInstall, 'Deployment');
  validateInstalledMetadata(installed, 'Current installed candidate');
  assertAppVersion(candidate.expectedVersion, installed.appVersion, 'Live candidate');
  for (const field of ['appIdSha256','appIdentifierSha256','updateTime','cpuAbi','appProvisionType']) {
    requireEvidence(installed[field] === candidate.postInstall[field], `Installed candidate ${field} changed after deployment`);
  }
}

function digestPresent(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

// The delivery and probe gates validate each observation's time series.
// Compare their boot witnesses without assuming a shared host clock origin.
function guestBootStart(readiness) {
  const witness = readiness.vmGuestBootWitness;
  const first = witness?.samples?.[0];
  if (witness?.version !== 1 || !Array.isArray(witness.samples) || witness.samples.length !== 2 ||
    !Number.isSafeInteger(first?.bootStart) || first.bootStart <= 0 || !digestPresent(witness.milestonesSha256) ||
    !witness.samples.every(sample => Number.isSafeInteger(sample?.bootStart) &&
      Math.abs(sample.bootStart - first.bootStart) <= 1000 && Array.isArray(sample.milestones) &&
      sample.milestones.length > 0 && sha256(JSON.stringify(sample.milestones)) === witness.milestonesSha256) ||
    sha256(JSON.stringify([first.bootStart, first.milestones])) !== readiness.bootIdSha256) return undefined;
  return first.bootStart;
}

function remoteGuestReady(readiness) {
  return readiness?.status === 'PASS' && readiness.bootCompleted === true && readiness.sceneBoardStable === true &&
    readiness.evidenceScope === 'guest-only' && readiness.emulatorLog?.status === 'NOT_PROVIDED' &&
    digestPresent(readiness.bootIdSha256) && digestPresent(readiness.sceneBoardPidSha256) &&
    Number.isFinite(readiness.observationMs) && readiness.observationMs >= 2000 && readiness.observationMs <= 10_000 &&
    (readiness.bootIdentitySource === 'kernel-boot-id' && readiness.uptimeSource === 'procfs' ||
      readiness.bootIdentitySource === 'vm-guest-boot-milestones-v1' && readiness.uptimeSource === 'toybox-sysinfo' &&
      guestBootStart(readiness) !== undefined);
}

export function assertRemoteVmReadiness(readiness, candidate) {
  const deployed = candidate.remoteGuestReadiness;
  requireEvidence(candidate.targetKind === 'vm' &&
    candidate.hdcServer === remoteVmServer && candidate.postInstall?.cpuAbi === 'x86_64' &&
    readiness?.event === 'readiness' && readiness.vmLocation === 'remote' && readiness.exactConnected === true &&
    readiness.targetRef === candidate.targetRef && readiness.hdcServer === candidate.hdcServer && readiness.targetKind === 'vm' &&
    remoteGuestReady(deployed) && remoteGuestReady(readiness), 'Unverified exact remote VM or guest-only readiness');
  const sameBoot = readiness.bootIdentitySource === 'kernel-boot-id' ?
    readiness.bootIdSha256 === deployed.bootIdSha256 :
    readiness.vmGuestBootWitness.milestonesSha256 === deployed.vmGuestBootWitness?.milestonesSha256 &&
      Math.abs(guestBootStart(readiness) - guestBootStart(deployed)) <= 1000;
  requireEvidence(sameBoot && readiness.bootIdentitySource === deployed.bootIdentitySource &&
    readiness.sceneBoardPidSha256 === deployed.sceneBoardPidSha256,
  'Remote VM boot or SceneBoard changed since the preserve-data deployment');
}
