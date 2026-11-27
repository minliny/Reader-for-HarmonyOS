#!/usr/bin/env node

import {
  assertInstalledDeploymentIdentity, hapMainlineSources, latestHapInstallReceipt, latestPublishedSignedHap,
  observeInstalledHapIdentity, plannedSignedCoreFingerprint, resolveHarmonyAbi, verifyManifest,
} from './hap-pipeline.mjs';
import { assertCleanMainline, assertInstallReceipt, assertMainlineHap, mainlineSourceMatch } from './lib/hap-mainline-provenance.mjs';

const usage = `Usage:
  node scripts/check-hap-provenance.mjs --plan [--artifact-root <directory>] [--vm-abi x86_64|arm64-v8a]
  node scripts/check-hap-provenance.mjs --vm-target <exact> --physical-target <exact>
    [--vm-location remote|local] [--vm-log <current emulator log>] [--vm-abi x86_64|arm64-v8a]
    [--artifact-root <directory>]

The command verifies the newest published signed HAP for each required ABI.
Core can match the current main commit or its configured ancestor Pin with
the same verified build-input fingerprint. Both Git commits are reported.
Live mode reads Bundle Manager through an exact-target HDC lease and binds each
observation to the corresponding preserve-data install receipt.
Plan mode only reports the planned candidates and unmerged local branches.`;

function parse(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--plan', '--vm-target', '--physical-target', '--vm-location', '--vm-log', '--vm-abi', '--artifact-root'].includes(key) ||
        Object.hasOwn(options, key)) throw new Error(`unsupported or duplicate option: ${key}`);
    if (key === '--plan') options[key] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`missing value: ${key}`);
      options[key] = value;
    }
  }
  const location = options['--vm-location'] ?? 'remote';
  if (!['local', 'remote'].includes(location)) throw new Error('--vm-location must be remote or local');
  if (options['--plan']) {
    if (options['--vm-target'] || options['--physical-target'] || options['--vm-log']) {
      throw new Error('--plan cannot be combined with live targets or a VM log');
    }
  } else {
    if (!options['--vm-target'] || !options['--physical-target']) throw new Error('Specify both exact targets or use --plan');
    if (location === 'local' && !options['--vm-log']) throw new Error('--vm-location local requires --vm-log');
  }
  return { ...options, location, vmAbi: resolveHarmonyAbi(options['--vm-abi'] ?? 'x86_64') };
}

function sourceSummary(source) {
  return { head: source.commit, main: source.mainCommit, dirty: source.dirty,
    unmerged: source.unmerged, unmergedStatus: source.unmerged.length > 0 ? 'FOUND' : 'CLEAR',
    inputFingerprint: source.inputFingerprint, equivalentPin: source.equivalentPin };
}

function candidateSourceSummary(manifest, sources, coreInputFingerprint) {
  const match = mainlineSourceMatch(manifest.source, sources, coreInputFingerprint);
  return { harmonyCommit: manifest.source?.harmony?.commit, coreCommit: manifest.source?.core?.commit,
    coreMainCommit: sources.core.mainCommit, coreInputFingerprint, coreSourceMatch: match.core,
    sourceMatchesMain: match.harmony && match.core !== 'unmatched' };
}

async function verifyTarget(kind, abi, options, sources, verifiedByAbi) {
  let path;
  let candidate;
  let targetRef;
  const target = options[`--${kind}-target`];
  try {
    const selection = latestPublishedSignedHap(abi, options['--artifact-root']);
    path = selection?.path;
    if (options['--plan']) {
      const { manifest } = selection ?? {};
      const candidate = manifest ? { runId: manifest.runId, appBuildId: manifest.expectedVersion?.appBuildId,
        ...candidateSourceSummary(manifest, sources, plannedSignedCoreFingerprint(selection)) } : undefined;
      return { status: 'NOT_RUN', abi, manifest: path ?? null, candidate };
    }
    if (!path) throw new Error(`no published signed HAP for ${abi}`);
    const verified = verifiedByAbi.get(abi) ?? verifyManifest(path);
    if (verified.path !== path) throw new Error('latest published signed HAP changed during verification');
    verifiedByAbi.set(abi, verified);
    const artifact = assertMainlineHap(verified, sources, abi);
    const { manifest } = verified;
    candidate = { runId: manifest.runId, path, sha256: artifact.sha256, appBuildId: manifest.expectedVersion.appBuildId,
      ...candidateSourceSummary(manifest, sources, artifact.storageCapability?.coreInputFingerprint) };
    const hdc = new Map([['--target-kind', kind], ['--target', target]]);
    if (kind === 'vm') {
      hdc.set('--vm-location', options.location);
      if (options['--vm-log']) hdc.set('--vm-log', options['--vm-log']);
    }
    const observed = await observeInstalledHapIdentity(hdc);
    targetRef = observed.targetRef;
    const deployed = latestHapInstallReceipt(verified.directory, observed);
    assertInstallReceipt({ receipt: deployed?.receipt, manifest, artifact, observed });
    assertInstalledDeploymentIdentity({ before: deployed.receipt.preInstall ?? {}, after: observed.installed,
      artifact, candidateAbi: abi, expectedVersion: manifest.expectedVersion, targetKind: kind });
    return { status: 'PASS', abi, candidate, targetRef, hdcServer: observed.hdcServer,
      vmLocation: observed.vmLocation, deploymentReceipt: deployed.file, installed: observed.installed, readiness: observed.readiness };
  } catch (error) {
    const reason = target ? String(error.message).replaceAll(target, '[target]') : String(error.message);
    return { status: 'FAIL', abi, manifest: path, candidate, targetRef, reason };
  }
}

async function main(args) {
  if (args.length === 0 || (args.length === 1 && ['-h', '--help'].includes(args[0]))) {
    console.log(usage);
    return;
  }
  const options = parse(args);
  const sources = hapMainlineSources();
  const report = { schemaVersion: 1, name: 'reader-harmonyos-mainline-provenance', startedAt: new Date().toISOString(),
    harmony: sourceSummary(sources.harmony), core: sourceSummary(sources.core) };
  let mainlineError;
  try { assertCleanMainline(sources.harmony, sources.core); }
  catch (error) { mainlineError = error.message; }
  if (mainlineError) report.mainlineError = mainlineError;
  if (!mainlineError || options['--plan']) {
    const verifiedByAbi = new Map();
    report.vm = await verifyTarget('vm', options.vmAbi, options, sources, verifiedByAbi);
    report.physical = await verifyTarget('physical', 'arm64-v8a', options, sources, verifiedByAbi);
  } else {
    report.vm = { status: 'NOT_RUN', reason: mainlineError };
    report.physical = { status: 'NOT_RUN', reason: mainlineError };
  }
  if (report.vm.status === 'PASS' && report.physical.status === 'PASS') {
    const current = hapMainlineSources();
    try {
      assertCleanMainline(current.harmony, current.core);
      if (current.harmony.commit !== sources.harmony.commit || current.core.commit !== sources.core.commit) {
        throw new Error('mainline changed during verification');
      }
      if (current.core.inputFingerprint !== sources.core.inputFingerprint || current.core.equivalentPin !== sources.core.equivalentPin) {
        throw new Error('Core build input identity changed during verification');
      }
      for (const result of [report.vm, report.physical]) {
        if (latestPublishedSignedHap(result.abi, options['--artifact-root'])?.path !== result.candidate.path) {
          throw new Error('published candidate changed during verification');
        }
      }
    } catch (error) { report.mainlineError = error.message; }
  }
  report.status = options['--plan'] ? 'NOT_RUN' :
    (!report.mainlineError && report.vm.status === 'PASS' && report.physical.status === 'PASS' ? 'PASS' : 'FAIL');
  report.completedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'FAIL') process.exitCode = 1;
}

try { await main(process.argv.slice(2)); }
catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
