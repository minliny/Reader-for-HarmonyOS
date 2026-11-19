#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { caseIds, loadCase } from './lib/cases.mjs';
import { requireEvidence } from './lib/evidence.mjs';
import { replayReceipt } from './lib/receipt.mjs';

try {
  const { values, tokens } = parseArgs({ options: {
    search: {type:'string'}, 'search-root': {type:'string'},
    reading: {type:'string'}, 'reading-root': {type:'string'},
  }, tokens:true, strict:true, allowPositionals:false });
  requireEvidence(tokens.length === 4 && new Set(tokens.map(token => token.name)).size === 4 &&
    ['search','reading'].every(key => values[key] && /^[0-9a-f]{64}$/.test(values[`${key}-root`] ?? '')),
  'Coverage requires both receipt paths and their separate handoff SHA-256 values');
  const runs = ['search','reading'].map((key, index) => replayReceipt({
    receiptPath:values[key], expectedRoot:values[`${key}-root`], contract:loadCase(caseIds[index]),
  }));
  const receipts = runs.map(run => run.receipt);
  requireEvidence(receipts[0].candidate.identity.targetRef === receipts[1].candidate.identity.targetRef &&
    receipts[0].runId !== receipts[1].runId, 'Phase 0 handoff must bind two distinct runs on the same target');
  const complete = receipts.every(receipt => receipt.observations === 'COMPLETE');
  const pass = receipts.every(receipt => receipt.execution === 'PASS');
  console.log(JSON.stringify({
    observationStatus:complete ? 'COMPLETE' : 'INCOMPLETE',
    capabilities:receipts[0].capabilities,
    cases:runs.map(({receipt, rootSha256}) => ({
      ...receipt.coverage[receipt.caseId], case:receipt.caseId, caseVersion:receipt.caseVersion, runId:receipt.runId, rootSha256,
      candidate:receipt.candidate.identity, execution:receipt.execution, behavior:receipt.behavior, diagnostics:receipt.diagnostics, measurement:receipt.measurement,
    })),
  }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({execution:'INCOMPLETE', reason:error.message}));
  process.exitCode = 1;
}
