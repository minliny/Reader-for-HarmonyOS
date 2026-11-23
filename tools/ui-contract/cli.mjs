#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadCase, planCase } from './lib/cases.mjs';
import { EvidenceError, requireEvidence } from './lib/evidence.mjs';

async function main() {
  const options = {
    help: {type:'boolean'}, case: {type:'string'}, 'dry-run': {type:'boolean'}, platform: {type:'string'},
    replay: {type:'string'}, 'expected-root': {type:'string'}, manifest: {type:'string'},
    deployment: {type:'string'}, hdc: {type:'string'}, server: {type:'string'}, target: {type:'string'},
    'output-dir': {type:'string'}, fixture: {type:'string'}, 'vm-log': {type:'string'},
    'guest-scheduling-trace': {type:'boolean'},
    'runner-mode': {type:'string'}, 'runner-manifest': {type:'string'}, 'runner-install-evidence': {type:'string'},
    'runner-deployment-sha256': {type:'string'}, 'runner-qualification': {type:'string'}, 'runner-qualification-sha256': {type:'string'},
  };
  const {values, tokens} = parseArgs({options, tokens:true, strict:true, allowPositionals:false});
  requireEvidence(tokens.length === new Set(tokens.map(token => token.name)).size &&
    !tokens.some(token => token.kind !== 'option' || token.value?.startsWith('--')),
  'Repeated or invalid CLI option');
  if (values.help) {
    requireEvidence(tokens.length === 1, 'Run --help by itself');
    const { remoteUiCaseIds } = await import('./collectors/harmonyos/records.mjs');
    return {
      usage: [
        'node tools/ui-contract/cli.mjs --case <id> --dry-run [--platform <name>]',
        'node tools/ui-contract/cli.mjs --case <id> --manifest <path> --deployment <path> --hdc <path> --server <endpoint> --target <exact-target> --fixture <path> --output-dir <path> [--vm-log <path>]',
        'node tools/ui-contract/cli.mjs --case <id> --replay <receipt> --expected-root <sha256>',
      ],
      remoteVm: {
        server: '192.168.1.10:8710',
        target: 'Use the exact loopback target discovered on the remote HDC server.',
        cases: remoteUiCaseIds,
        deployment: 'Use the verified x86_64 preserve-data deployment receipt with guest-only readiness from hap-pipeline.mjs install --target-kind vm --vm-location remote.',
        fixture: 'Use a current isolated public fixture for the same target. The empty-shelf scope keeps test data separate from the ordinary Reader instance.',
        scope: 'Case admission applies to formal UI receipts. HAP deployment uses hap-pipeline.mjs.',
      },
      vmLog: 'Supply --vm-log for current local VM readiness. Remote guest-only collection and physical device collection omit it. Frame timing comes from native samples.',
    };
  }
  const contract = loadCase(values.case);
  if (values['dry-run']) {
    requireEvidence(Object.keys(values).every(key => ['case','dry-run','platform'].includes(key)), 'Invalid dry-run arguments');
    return planCase(contract, values.platform ?? 'harmonyos');
  }
  const { replayReceipt, sealReceipt } = await import('./lib/receipt.mjs');
  if (values.replay) {
    requireEvidence(Object.keys(values).every(key => ['case','replay','expected-root'].includes(key)) &&
      /^[0-9a-f]{64}$/.test(values['expected-root'] ?? ''), 'Offline replay requires a separate, expected SHA-256 root');
    return replayReceipt({receiptPath:values.replay, expectedRoot:values['expected-root'], contract});
  }
  const required = ['case','manifest','deployment','hdc','server','target','output-dir','fixture'];
  requireEvidence(Object.keys(values).every(key => required.includes(key) || key === 'vm-log' ||
    key === 'guest-scheduling-trace' || key.startsWith('runner-')) &&
    required.every(key => values[key]) &&
    ['127.0.0.1:8710','192.168.1.10:8710'].includes(values.server) &&
    /^[A-Za-z0-9._:\[\]-]{1,256}$/.test(values.target) && !values.target.startsWith('-'),
  'Live collection requires the case, exact HDC server and target, signed manifest/deployment, and current public fixture');
  const { collectHarmony } = await import('./collectors/harmonyos/run.mjs');
  const optionalPath = name => values[name] ? resolve(values[name]) : undefined;
  const collectOptions = {
    manifest:resolve(values.manifest), deployment:resolve(values.deployment), hdc:resolve(values.hdc), server:values.server,
    target:values.target, outputDir:resolve(values['output-dir']), fixture:resolve(values.fixture), vmLog:optionalPath('vm-log'),
    guestSchedulingTrace:values['guest-scheduling-trace'],
    runnerMode:values['runner-mode'],runnerManifest:optionalPath('runner-manifest'),runnerInstallEvidence:optionalPath('runner-install-evidence'),
    runnerDeploymentSha:values['runner-deployment-sha256'],runnerQualification:optionalPath('runner-qualification'),
    runnerQualificationSha:values['runner-qualification-sha256'],
  };
  const outcome = await collectHarmony(collectOptions, contract);
  if (collectOptions.runnerMode === 'qualify') {
    const {sealRunnerQualification} = await import('./collectors/harmonyos/runner-collection-admission.mjs');
    const qualification = sealRunnerQualification(outcome,contract);
    if (qualification) return qualification;
  }
  const result = sealReceipt(outcome, contract);
  return outcome.guestSchedulingTrace ? {...result, guestSchedulingTrace:outcome.guestSchedulingTrace} : result;
}

try {
  const result = await main();
  console.log(JSON.stringify(result, null, 2));
  if ((result.receipt && result.receipt.execution !== 'PASS') ||
    (result.guestSchedulingTrace && (result.guestSchedulingTrace.status !== 'COVERED' ||
      result.guestSchedulingTrace.cleanup !== 'PASS'))) process.exitCode = 1;
} catch (error) {
  const incomplete = error instanceof EvidenceError;
  console.error(JSON.stringify({execution:incomplete ? 'INCOMPLETE' : 'ERROR', reason:error.message}));
  process.exitCode = incomplete ? 1 : 2;
}
