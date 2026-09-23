import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const calls = [];
let enabled = true, version = 'v1';
let resolveOld;
const owner = new BookAcquisitionCoordinator(async (method, params) => {
  calls.push({ method, params });
  if (method === 'source.delete') { enabled = false; return { data: {} }; }
  if (method === 'source.update') { version = 'v2'; return { data: {} }; }
  assert.equal(method, 'source.list');
  assert.equal(typeof params.sourceId, 'string', 'cold open must never request all source rules');
  const row = { sourceId: params.sourceId, enabled, sourceVersion: version };
  if (params.sourceId === 'race' && version === 'v1') await new Promise(resolve => { resolveOld = resolve; });
  return { data: { sources: enabled ? [row] : [] } };
}, name => name === 'source.list.byId.v1');
assert.deepEqual(await Promise.all([owner.currentSourceVersion('s1'), owner.currentSourceVersion('s1')]), ['v1', 'v1']);
assert.equal(calls.length, 1, 'same-identity lookups share one RPC');
await owner.currentSourceVersion('s2');
assert.equal(calls.length, 2, 'a partial result must not mark the whole registry loaded');
const pending = owner.currentSourceVersion('race');
await new Promise(resolve => setImmediate(resolve));
await owner.request('source.update', { sourceId: 'race' });
resolveOld();
assert.equal(await pending, 'v2', 'a response overtaken by a mutation cannot resurrect the old rule version');
await owner.request('source.delete', { sourceIds: ['s1'] });
assert.equal(await owner.currentSourceVersion('s1'), undefined);
const count = calls.length;
assert.equal(await owner.currentSourceVersion('s1'), undefined);
assert.equal(calls.length, count, 'known missing identities do not trigger repeated full lists');
owner.close();
let fallback;
const oldCore = new BookAcquisitionCoordinator(async (_method, params) => {
  fallback = params;
  return { data: { sources: [{ sourceId: 'legacy', enabled: true, sourceVersion: 'old' }] } };
});
assert.equal(await oldCore.currentSourceVersion('legacy'), 'old');
assert.deepEqual(fallback, {}, 'old Core retains the supported full-list contract');
oldCore.close();
console.log('Scoped source admission: single identity, sharing, invalidation race, missing source and old-Core fallback PASS');
for (const data of [{}, { sources: [{ sourceId: 'other' }] }]) {
  const malformed = new BookAcquisitionCoordinator(async () => ({ data }), () => true);
  await assert.rejects(malformed.currentSourceVersion('wanted'), /different source identity/);
  malformed.close();
}
