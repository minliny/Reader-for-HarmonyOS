import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export function contractTests(root, tier) {
  assert.ok(['source', 'full'].includes(tier));
  const manifest = JSON.parse(readFileSync(resolve(root, 'tools/contract-test-tiers.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  const discovered = readdirSync(resolve(root, 'tools')).filter(name =>
    /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  const declared = [...manifest.source, ...manifest.integration];
  assert.equal(new Set(declared).size, declared.length, 'duplicate test classification');
  assert.deepEqual([...declared].sort(), discovered, 'every discovered test must be classified');
  const selected = tier === 'source' ? manifest.source : discovered;
  assert.ok(selected.length > 0, 'empty test tier is not PASS');
  return { selected, integrationCount: manifest.integration.length };
}

export function runContracts(root, tier) {
  const { selected, integrationCount } = contractTests(root, tier);
  for (const name of selected) {
    const result = spawnSync(process.execPath, [resolve(root, 'tools', name)], {
      cwd: root, stdio: 'inherit', timeout: 300_000,
    });
    if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.error?.code ?? result.status ?? result.signal})`);
  }
  console.log(`Host ${tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.ok(['--source', '--full'].includes(process.argv[2]) && process.argv.length === 3,
    'Usage: node tools/run-contract-tests.mjs --source|--full');
  runContracts(resolve(dirname(fileURLToPath(import.meta.url)), '..'), process.argv[2].slice(2));
}
