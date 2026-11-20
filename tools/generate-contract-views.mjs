import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_VIEWS, CONTRACT_VIEW_FILES, normalizeContractRegistry, normalizeCatalogIdentities, normalizeResourceReviewIdentities, contractView } from './lib/contract-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'tools/contract-registry.json');
const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ['--migrate', '--normalize-identities', '--normalize-resource-reviews', '--write', '--check'].includes(mode),
  'Usage: generate-contract-views.mjs --migrate (once) | --normalize-identities | --normalize-resource-reviews | --write | --check');
const bytes = value => JSON.stringify(value, null, 2) + '\n';
if (mode === '--migrate') {
  assert.ok(!existsSync(file), 'Existing canonical registry cannot be replaced by legacy views');
  const previous = Object.fromEntries(CONTRACT_VIEWS.map(view => [view,
    JSON.parse(readFileSync(resolve(root, 'tools', CONTRACT_VIEW_FILES[view]), 'utf8'))]));
  const registry = normalizeContractRegistry(previous);
  // Compare every reviewed fact before publishing any view. No current-source
  // fingerprint or qualification is inferred by this storage-only migration.
  for (const view of CONTRACT_VIEWS) assert.deepEqual(contractView(registry, view), previous[view], `${view}: lossless migration`);
  writeFileSync(file, bytes(registry), { flag: 'wx' });
}
const registry = JSON.parse(readFileSync(file, 'utf8'));
if (mode === '--normalize-identities' && registry.schemaVersion === 1) {
  const normalized = normalizeCatalogIdentities(registry);
  writeFileSync(file, bytes(normalized));
  Object.assign(registry, normalized);
}
if (mode === '--normalize-resource-reviews') {
  const normalized = normalizeResourceReviewIdentities(registry);
  writeFileSync(file, bytes(normalized)); Object.assign(registry, normalized);
}
for (const view of CONTRACT_VIEWS) {
  contractView(registry, view); // Validate references before publishing descriptors.
  const target = resolve(root, 'tools', CONTRACT_VIEW_FILES[view]);
  const expected = bytes({ schemaVersion: 2, registry: 'contract-registry.json', view });
  if (mode === '--check') assert.equal(readFileSync(target, 'utf8'), expected, `${view}: stale generated descriptor`);
  else if (readFileSync(target, 'utf8') !== expected) writeFileSync(target, expected);
}
console.log(`Contract views ${mode}: canonical reviewed facts, no tests or SDK loaded`);
