import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runContracts, contractTests } from './run-contract-tests.mjs';

contractTests(fileURLToPath(new URL('..', import.meta.url)), 'full');

const root = mkdtempSync(join(tmpdir(), 'reader-contract-gate-'));
try {
  mkdirSync(join(root, 'tools'));
  const manifest = { schemaVersion: 1, source: ['test-pass.mjs'], integration: ['test-fail.mjs'] };
  const save = () => writeFileSync(join(root, 'tools/contract-test-tiers.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'tools/test-pass.mjs'), 'process.exit(0)');
  writeFileSync(join(root, 'tools/test-fail.mjs'), 'process.exit(7)');
  save();
  runContracts(root, 'source');
  assert.throws(() => runContracts(root, 'full'), /test-fail.mjs failed \(7\)/);
  writeFileSync(join(root, 'tools/test-new.mjs'), 'process.exit(0)');
  assert.throws(() => runContracts(root, 'source'), /every discovered test must be classified/);
  rmSync(join(root, 'tools/test-new.mjs'));
  manifest.source.push('test-fail.mjs'); save();
  assert.throws(() => runContracts(root, 'source'), /duplicate test classification/);
  manifest.source = []; manifest.integration = ['test-pass.mjs', 'test-fail.mjs']; save();
  assert.throws(() => runContracts(root, 'source'), /empty test tier/);
  console.log('PASS: failed, unclassified, duplicate and empty test tiers cannot report success');
} finally { rmSync(root, { recursive: true, force: true }); }
