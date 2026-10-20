#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateReceipt, digest } from '../../Reader-Core/scripts/lib/gate-receipt.mjs';
import { readFileSync } from 'node:fs';
import { contractTests, explicitContractTests, contractInventory } from '../tools/run-contract-tests.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function localContractPlan(args, repository = root) {
  const usage = 'Usage: node scripts/check-local.mjs [--list|--theme|--full|--contracts-scope <name>|--tests <comma-separated names>] [--cases file.mjs#case,...] [--rationale <item-specific reason>]\nNo arguments lists checks without running them. HAP builds: node scripts/hap-pipeline.mjs build --class iteration';
  if (args.length === 0 || args.length === 1 && args[0] === '--list') return { list: true };
  const rationaleIndex = args.indexOf('--rationale');
  if (rationaleIndex < 0 || rationaleIndex !== args.length - 2 || !args[rationaleIndex + 1]?.trim()) throw new Error('An item-specific necessity rationale is required before running checks.\n' + usage);
  const rationale = args[rationaleIndex + 1];
  args = args.slice(0, rationaleIndex);
  if (args.length === 1 && args[0] === '--theme') return { theme: true, rationale, args: ['tools/generate-theme-registry.mjs', '--check'] };
  if (args.length === 1 && args[0] === '--full') {
    return { rationale, selection: contractTests(repository, 'full'), args: ['tools/run-contract-tests.mjs', '--full', '--rationale', rationale] };
  }
  let cases;
  if (args.length === 4 && args[0] === '--tests' && args[2] === '--cases' && args[3]?.trim()) { cases=args[3];args=args.slice(0,2); }
  if (args.length !== 2 || !['--contracts-scope', '--tests'].includes(args[0]) || !args[1] || args[1].startsWith('--')) throw new Error(usage);
  if (args[0] === '--tests') {
    const tests = args[1].split(',');
    return { scope: 'custom', rationale, selection: explicitContractTests(repository, tests), args: ['tools/run-contract-tests.mjs', '--tests', args[1], ...(cases ? ['--cases',cases] : []), '--rationale', rationale] };
  }
  const scope = args[1], selection = contractTests(repository, 'full', scope);
  return { scope, rationale, selection, args: ['tools/run-contract-tests.mjs', '--scope', scope, '--rationale', rationale] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let plan;
  try { plan = localContractPlan(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
  if (plan?.list) {
    const { manifest, discovered } = contractInventory(root);
    console.log(JSON.stringify({ status: 'NOT_RUN', harmonyContracts: 'NOT_RUN', fullSuite: 'NOT_RUN', acceptanceEligible: false,
      availableTests: discovered, availableScopes: Object.keys(manifest.scopes ?? {}),
      theme: 'explicit --theme only', selection: 'Use --tests, --contracts-scope, or explicit --full after item-specific necessity review.' }));
  } else if (plan) {
    const gate = createGateReceipt({ kind: plan.theme ? 'harmony-theme' : plan.scope === undefined ? 'harmony-development' : 'harmony-development-scoped', root, output: process.env.READER_HARMONY_GATE_RECEIPT,
      expectedStages: [plan.theme ? 'theme' : 'contracts'] });
    gate.report.rationale = plan.rationale;
    if (plan.scope !== undefined) Object.assign(gate.report, { harmonyContracts: 'PARTIAL', contracts: {
      scope: plan.scope, fullSuite: 'NOT_RUN', selected: plan.selection.selected, omitted: plan.selection.omitted,
      evidenceLayers: plan.selection.scopePolicy?.layers ?? [], scopeTimeoutMs: plan.selection.scopePolicy?.timeoutMs ?? null,
    }, acceptanceEligible: false });
    const resultsFile = process.env.READER_CONTRACT_RESULTS_FILE ?? resolve(dirname(gate.file), 'contracts-results.json');
    gate.stage(plan.theme ? 'theme' : 'contracts', process.execPath, plan.args,
      plan.scope === undefined ? {} : { env: { ...process.env, READER_CONTRACT_RESULTS_FILE: resultsFile } });
    if (plan.scope !== undefined) {
      const bytes = readFileSync(resultsFile);
      gate.report.contracts.execution = { path: resultsFile, bytes: bytes.length, sha256: digest(bytes) };
    }
    gate.finish();
    console.log(JSON.stringify({ status: plan.scope === undefined ? 'PASS' : 'PARTIAL', selectedStatus: 'PASS',
      harmonyContracts: plan.theme ? 'NOT_RUN' : plan.scope === undefined ? 'PASS' : 'PARTIAL',
      fullSuite: !plan.theme && plan.scope === undefined ? 'PASS' : 'NOT_RUN', acceptanceEligible: false, receipt: gate.file }));
  }
}
