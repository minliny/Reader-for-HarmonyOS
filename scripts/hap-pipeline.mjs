#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { prepareAppIdentity } from './lib/app-build-context.mjs';
import { build, option, requiredOption, resolveCoreProfile, resolveHarmonyAbi, retentionLimit, runNativePreflightWorker,
  syncNative, syncSigning } from './hap-pipeline/build-and-sign.mjs';
import { LOCAL_HDC_SERVER, REMOTE_VM_HDC_SERVER, inspectDeployment, installDeployment, verifyManifest, verifyManifestWithInspector,
  withDeploymentHdcSession } from './hap-pipeline/deploy-and-verify.mjs';
import { DEFAULT_ARTIFACT_ROOT, applyHapRetention, planHapRetention, withArtifactLock, withHapRunLock } from './hap-pipeline/locks-and-retention.mjs';
import { APP_CONTENT_INPUTS, REPO_ROOT, fail } from './hap-pipeline/workspace-fingerprint.mjs';

export {
  sourceSnapshot,
  controllerSnapshot,
  workspaceContractSnapshot,
  assertResolvedCorePackage,
  assertSnapshotUnchanged,
  snapshotDescriptor,
} from './hap-pipeline/workspace-fingerprint.mjs';
export {
  planHapRetention,
  withHapRunLock,
  applyHapRetention,
  latestPublishedSignedHap,
  latestHapInstallReceipt,
} from './hap-pipeline/locks-and-retention.mjs';
export {
  resolveHarmonyAbi,
  isCleanArkTsCompileFailure,
  run,
  prepareDuringNativePreflight,
  hapMainlineSources,
  copySourceSandbox,
  profileIdentity,
  inspectHap,
  composeSigningProfile,
  resolveSigningMode,
  prepareIdeSigningProfile,
  assertIdeSigningUnchanged,
  prepareIdeAppBuildIdentity,
  verifyIdeSignedHap,
  freezeSigningMaterial,
  findBuiltHaps,
  nativeInputPaths,
  requireAcceptanceInputs,
  prepareIdeNativeInputs,
  ideNativeBuildEnvironment,
  ideNativeInputState,
  preflightIdeNative,
} from './hap-pipeline/build-and-sign.mjs';
export {
  runTargetHdc,
  withDeploymentHdcSession,
  resolveHdcServer,
  hdcRouteEvidence,
  plannedSignedCoreFingerprint,
  verifyContractEvidence,
  verifyAbiEvidence,
  verifyAppIdentityEvidence,
  verifyManifest,
  parseBundleMetadata,
  deploymentSigningRoute,
  deploymentRoute,
  assertHdcPreflight,
  observeInstalledHapIdentity,
  storageTransitionCandidate,
  assertInstalledAppVersion,
  assertInstalledDeploymentIdentity,
  installDeployment,
} from './hap-pipeline/deploy-and-verify.mjs';

function parseOptions(argv) {
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (options.has(key)) fail(`duplicate argument: ${key}`, 2);
    if (key === '--live-sources' || key === '--no-launch' || key === '--apply' || key === '--incremental') {
      options.set(key, true);
      continue;
    }
    if (!key.startsWith('--') || index + 1 >= argv.length || argv[index + 1].startsWith('--')) fail(`invalid argument: ${key}`, 2);
    options.set(key, argv[index + 1]);
    index += 1;
  }
  return options;
}

function usage() {
  console.error(`Usage:
  node scripts/hap-pipeline.mjs identity [--channel DEV] [--abi arm64-v8a|x86_64] [--build-mode debug|release]
  node scripts/hap-pipeline.mjs build [--class iteration|acceptance] [--incremental] [--channel DEV|RC|REL] [--abi arm64-v8a|x86_64] [--core-profile release|smoke] [--signing auto|local|unsigned] [--live-source-ids <exact IDs> --rationale <necessity>] [--keep-runs 10] [--core-gate-receipt <receipt.json>]
  node scripts/hap-pipeline.mjs prune [--artifact-root <directory>] [--keep-runs 10] [--apply]
  node scripts/hap-pipeline.mjs sync-signing [--profile <private-local-profile.json5>]
  node scripts/hap-pipeline.mjs sync-native [--abi arm64-v8a|x86_64] [--core-profile release|smoke] [sync-core alias]
  node scripts/hap-pipeline.mjs verify --manifest <manifest.json>
  node scripts/hap-pipeline.mjs inspect --manifest <manifest.json> --artifact signed --target <exact> <route flags>
  node scripts/hap-pipeline.mjs install --manifest <manifest.json> --artifact signed --target <exact> <route flags> [--no-launch]

Deployment routes:
  Remote VM   --target-kind vm --vm-location remote
              Server ${REMOTE_VM_HDC_SERVER}. Use a matching signed HAP (x86_64 for this remote VM) and live guest readiness.
              Omit --vm-log for guest-only readiness. A supplied current log is also validated.
  Local VM    --target-kind vm --vm-location local --vm-log <current-emulator.log>
              Server ${LOCAL_HDC_SERVER}. Use the confirmed current local instance log.
  Physical    --target-kind physical
              Server ${LOCAL_HDC_SERVER}. Requires a separately connected physical target.

Discover the exact target on the selected server with reader-hdc-lease.mjs list targets -v.
The server endpoint and target ID are distinct, even when the remote server lists its target as a loopback address.
Emulator.log and a snapshot companion qemu.log are startup/readiness evidence. Frame timing comes from the UI collector.`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  const options = parseOptions(process.argv.slice(3));
  if (command !== 'build' && options.has('--incremental')) fail('--incremental applies only to build', 2);
  if (command === 'identity') {
    const session = prepareAppIdentity(REPO_ROOT, APP_CONTENT_INPUTS, {
      abi: resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI)),
      channel: option(options, '--channel', process.env.READER_APP_CHANNEL),
      buildMode: option(options, '--build-mode', 'debug'),
    });
    console.log(JSON.stringify({ status: 'PLAN_ONLY', expectedVersion: session.expectedVersion,
      buildIdentityInputs: session.contentSnapshot.buildIdentityInputs, fileCount: session.contentSnapshot.files.length }));
  }
  else if (command === 'build') await build(options, verifyManifestWithInspector);
  else if (command === 'sync-signing') syncSigning(options);
  else if (command === 'sync-native' || command === 'sync-core') {
    for (const key of options.keys()) if (!['--abi', '--core-profile'].includes(key)) fail(`unknown sync-native argument: ${key}`, 2);
    const abi = resolveHarmonyAbi(option(options, '--abi', process.env.READER_HARMONY_ABI));
    const profile = resolveCoreProfile(option(options, '--core-profile', process.env.READER_HARMONY_CORE_PROFILE));
    withArtifactLock(env => syncNative({ ...env, READER_HARMONY_ABI: abi, READER_HARMONY_CORE_PROFILE: profile }));
  }
  else if (command === 'verify') {
    const verified = verifyManifest(requiredOption(options, '--manifest'));
    console.log(JSON.stringify({
      status: 'PASS',
      runId: verified.manifest.runId,
      appBuildId: verified.manifest.expectedVersion?.appBuildId,
      appIdentity: verified.manifest.expectedVersion ? 'PASS' : 'LEGACY_NOT_PRESENT',
      incremental: verified.manifest.incremental,
      contractsScope: verified.manifest.gates?.contracts?.scope,
      harmonyContracts: verified.manifest.gates?.harmonyContracts,
      selectedStatus: verified.manifest.gates?.contracts?.selectedStatus,
      fullSuite: verified.manifest.gates?.contracts?.fullSuite,
      artifacts: verified.artifacts.map(({ kind, path, sha256, signature }) => ({
        kind, path, sha256, signature,
      })),
    }));
  } else if (command === 'inspect') await withDeploymentHdcSession(options, () => inspectDeployment(options));
  else if (command === 'install') await withDeploymentHdcSession(options, () => withHapRunLock(dirname(resolve(requiredOption(options, '--manifest'))),
    () => installDeployment(options)), { preflight: true });
  else if (command === 'prune') {
    const plan = planHapRetention(resolve(option(options, '--artifact-root', DEFAULT_ARTIFACT_ROOT)), retentionLimit(options));
    console.log(JSON.stringify(options.get('--apply') === true ? applyHapRetention(plan) : plan, null, 2));
  }
  else {
    usage();
    fail(`unknown command: ${command}`, 2);
  }
}

if (!isMainThread && workerData?.hapNativePreflight) {
  parentPort.postMessage(runNativePreflightWorker(workerData.hapNativePreflight));
} else if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  }
}
