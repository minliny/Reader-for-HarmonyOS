import assert from 'node:assert/strict';

export const HISTORICAL_CONTRACT_TIMEOUT_MS = 110_000;

function scopePolicy(catalog, scope) {
  const policy = catalog.scopePolicies?.[scope];
  if (policy === undefined) {
    assert.notEqual(scope, 'search-return-runtime', 'the archived route scope requires a policy');
    return { timeoutMs: HISTORICAL_CONTRACT_TIMEOUT_MS, failFast: false };
  }
  const maximum = scope === 'search-return-runtime' ? 180_000 : 600_000;
  assert.ok(Number.isInteger(policy.timeoutMs) && policy.timeoutMs > 0 && policy.timeoutMs <= maximum,
    'invalid archived scope deadline');
  assert.equal(typeof policy.failFast, 'boolean');
  if (scope === 'search-return-runtime') assert.equal(policy.failFast, true);
  assert.ok(Array.isArray(policy.layers) && policy.layers.length > 0, 'archived scope layers are missing');
  assert.equal(new Set(policy.layers.map(layer => layer.id)).size, policy.layers.length);
  for (const layer of policy.layers) {
    assert.match(layer.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(Array.isArray(layer.tests) && layer.tests.length > 0);
    assert.ok(typeof layer.proves === 'string' && layer.proves.trim() &&
      typeof layer.doesNotProve === 'string' && layer.doesNotProve.trim());
  }
  const members = policy.layers.flatMap(layer => layer.tests);
  assert.deepEqual([...members].sort(), [...catalog.scopes[scope]].sort());
  return policy;
}

// The archived selection file is hashed by the original controller snapshot.
// Only its declared tests can enter the archived result inventory. A controller
// could also have contained retired files outside that selection file.
export function archivedContractSelection(catalog, discovered, scope) {
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(Array.isArray(catalog.source) && Array.isArray(catalog.integration) && Array.isArray(catalog.pending ?? []));
  const inventory = [...catalog.source, ...catalog.integration].sort();
  const classified = [...inventory, ...(catalog.pending ?? [])];
  const snapshotFiles = new Set(discovered);
  assert.equal(new Set(classified).size, classified.length, 'duplicate archived contract classification');
  assert.ok(classified.every(name => /^test-[^/\\]+\.mjs$/.test(name) && snapshotFiles.has(name)),
    'archived contract must belong to the original controller');
  for (const [name, tests] of Object.entries(catalog.scopes ?? {})) {
    assert.match(name, /^[a-z][a-z0-9-]+$/);
    assert.ok(Array.isArray(tests) && tests.length > 0 && new Set(tests).size === tests.length &&
      tests.every(test => inventory.includes(test)), 'invalid archived scope selection');
    scopePolicy(catalog, name);
  }
  assert.ok(Object.keys(catalog.scopePolicies ?? {}).every(name => Object.hasOwn(catalog.scopes ?? {}, name)));
  for (const [name, cases] of Object.entries(catalog.scopeCases ?? {})) {
    assert.ok(Object.hasOwn(catalog.scopes ?? {}, name) && cases && typeof cases === 'object' && !Array.isArray(cases));
    assert.ok(Object.entries(cases).every(([test, ids]) => catalog.scopes[name].includes(test) &&
      Array.isArray(ids) && ids.length > 0 && new Set(ids).size === ids.length &&
      ids.every(id => typeof id === 'string' && id.length > 0)));
  }
  if (scope !== undefined) assert.ok(Object.hasOwn(catalog.scopes ?? {}, scope), 'unknown archived contract scope');
  const policy = scope === undefined ? null : scopePolicy(catalog, scope);
  const selected = scope === 'search-return-runtime' ? policy.layers.flatMap(layer => layer.tests) :
    scope === undefined ? inventory : [...catalog.scopes[scope]].sort();
  assert.ok(selected.length > 0, 'empty archived selection');
  return { selected, omitted: inventory.filter(test => !selected.includes(test)), inventory, scopePolicy: policy };
}
