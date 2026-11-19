#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadCase, planCase } from './lib/cases.mjs';
import { requireEvidence } from './lib/evidence.mjs';

async function main() {
  const options = {
    case: {type:'string'}, 'dry-run': {type:'boolean'}, platform: {type:'string'},
    replay: {type:'string'}, 'expected-root': {type:'string'}, manifest: {type:'string'},
    deployment: {type:'string'}, hdc: {type:'string'}, server: {type:'string'}, target: {type:'string'},
    'output-dir': {type:'string'}, fixture: {type:'string'}, 'vm-log': {type:'string'},
  };
  const {values, tokens} = parseArgs({options, tokens:true, strict:true, allowPositionals:false});
  requireEvidence(tokens.length === new Set(tokens.map(token => token.name)).size &&
    !tokens.some(token => token.kind !== 'option' || token.value?.startsWith('--')),
  'Repeated or invalid CLI option');
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
  requireEvidence(Object.keys(values).every(key => required.includes(key) || key === 'vm-log') && required.every(key => values[key]) &&
    ['127.0.0.1:8710','192.168.1.10:8710'].includes(values.server) &&
    /^[A-Za-z0-9._:\[\]-]{1,256}$/.test(values.target) && !values.target.startsWith('-'),
  'Live collection requires the case, exact local or remote server and target, signed manifest/deployment and public fixture (plus the current log for a VM)');
  const { collectHarmony } = await import('./collectors/harmonyos/run.mjs');
  const outcome = await collectHarmony({
    manifest:resolve(values.manifest), deployment:resolve(values.deployment), hdc:resolve(values.hdc), server:values.server,
    target:values.target, outputDir:resolve(values['output-dir']), fixture:resolve(values.fixture), vmLog:values['vm-log'] ? resolve(values['vm-log']) : undefined,
  }, contract);
  return sealReceipt(outcome, contract);
}

try {
  const result = await main();
  console.log(JSON.stringify(result, null, 2));
  if (result.receipt && result.receipt.execution !== 'PASS') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({execution:'INCOMPLETE', reason:error.message}));
  process.exitCode = 1;
}
