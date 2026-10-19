#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateReceipt, digest } from '../../Reader-Core/scripts/lib/gate-receipt.mjs';
import { readFileSync } from 'node:fs';
import { contractTests } from '../tools/run-contract-tests.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function localContractPlan(args, repository = root) {
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--contracts-scope' || !args[1] || args[1].startsWith('--'))) {
    throw new Error('Usage: node scripts/check-local.mjs [--contracts-scope <name>]\nHAP builds: node scripts/hap-pipeline.mjs build --class iteration');
  }
  const scope = args.length === 0 ? undefined : args[1];
  const selection = contractTests(repository, 'full', scope);
  return { scope, selection, args: scope === undefined ? ['tools/run-contract-tests.mjs', '--full'] : ['tools/run-contract-tests.mjs', '--scope', scope] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let plan;
  try { plan = localContractPlan(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
  if (plan) {
    const gate = createGateReceipt({ kind: plan.scope === undefined ? 'harmony-development' : 'harmony-development-scoped', root, output: process.env.READER_HARMONY_GATE_RECEIPT,
      expectedStages: ['theme', 'contracts'] });
    if (plan.scope !== undefined) Object.assign(gate.report, { harmonyContracts: 'PARTIAL', contracts: {
      scope: plan.scope, fullSuite: 'NOT_RUN', selected: plan.selection.selected, omitted: plan.selection.omitted,
      evidenceLayers: plan.selection.scopePolicy.layers ?? [], scopeTimeoutMs: plan.selection.scopePolicy.timeoutMs,
    }, acceptanceEligible: false });
    const resultsFile = process.env.READER_CONTRACT_RESULTS_FILE ?? resolve(dirname(gate.file), 'contracts-results.json');
    for (const args of [['tools/generate-theme-registry.mjs', '--check'], plan.args]) {
      gate.stage(args[0].includes('theme') ? 'theme' : 'contracts', process.execPath, args,
        plan.scope === undefined || args[0].includes('theme') ? {} : { env: { ...process.env, READER_CONTRACT_RESULTS_FILE: resultsFile } });
    }
    if (plan.scope !== undefined) {
      const bytes = readFileSync(resultsFile);
      gate.report.contracts.execution = { path: resultsFile, bytes: bytes.length, sha256: digest(bytes) };
    }
    gate.finish();
    console.log(JSON.stringify({ status: plan.scope === undefined ? 'PASS' : 'PARTIAL', selectedStatus: 'PASS',
      fullSuite: plan.scope === undefined ? 'PASS' : 'NOT_RUN', acceptanceEligible: false, receipt: gate.file }));
  }
}
