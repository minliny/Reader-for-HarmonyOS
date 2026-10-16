#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateReceipt } from '../../Reader-Core-Native/scripts/lib/gate-receipt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.length > 2) {
  console.error('Usage: node scripts/check-local.mjs\nHAP builds: node scripts/hap-pipeline.mjs build --class iteration');
  process.exitCode = 2;
} else {
  const gate = createGateReceipt({ kind: 'harmony-development', root, output: process.env.READER_HARMONY_GATE_RECEIPT,
    expectedStages: ['theme', 'contracts'] });
  for (const args of [['tools/generate-theme-registry.mjs', '--check'], ['tools/run-contract-tests.mjs', '--full']]) {
    gate.stage(args[0].includes('theme') ? 'theme' : 'contracts', process.execPath, args);
  }
  gate.finish();
  console.log(JSON.stringify({ status: 'PASS', receipt: gate.file }));
}
