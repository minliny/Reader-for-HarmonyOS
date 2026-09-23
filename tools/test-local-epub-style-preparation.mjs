import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const hash = 'a'.repeat(64), bookId = `local:${hash}`;
const root = '/private/app/files/reader-import/books';
let existing = new Set(), accesses = [], afterAccess;
const Registry = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url),
  ['retainedLocalBookSourcePath', 'requireLocalBookHash', 'localBookAssetDirectory'],
  { fileIo: { async access(path) { accesses.push(path); afterAccess?.(); return existing.has(path); } } });
const registry = Object.assign(new Registry(), { context: { filesDir: '/private/app/files' } });
existing.add(`${root}/${hash}.source`);
assert.equal(await registry.retainedLocalBookSourcePath(bookId, () => true), `${root}/${hash}.source`);
assert.equal(accesses.length, 1);
existing = new Set([`${root}/${hash}.epub`]); accesses = [];
assert.equal(await registry.retainedLocalBookSourcePath(bookId, () => true), `${root}/${hash}.epub`);
assert.deepEqual(accesses, [`${root}/${hash}.source`, `${root}/${hash}.epub`]);
existing.clear();
assert.equal(await registry.retainedLocalBookSourcePath(bookId, () => true), undefined);
accesses = [];
for (const invalid of ['../escape', 'local:../../escape', 'local:legacy', `local:${'A'.repeat(64)}`])
  assert.equal(await registry.retainedLocalBookSourcePath(invalid, () => true), undefined);
assert.deepEqual(accesses, [], 'legacy/invalid identity never grants arbitrary file access');
let current = true; afterAccess = () => { current = false; };
existing.add(`${root}/${hash}.source`);
assert.equal(await registry.retainedLocalBookSourcePath(bookId, () => current), undefined);
afterAccess = undefined;

const calls = [], paths = [];
const runtime = { supportsCoreCapability: () => true,
  async retainedLocalBookSourcePath(id, current) { assert.ok(current()); paths.push(id); return `${root}/${hash}.source`; },
  bookAcquisitions: () => ({ async request(method, params, options, priority) {
    assert.ok(options.canDispatch()); assert.equal(options.shouldCancel(), false);
    calls.push({ method, params, priority });
    return { data: { kind: 'ready', reason: 'alreadyPrepared', sourceId: params.sourceId, bookId: params.bookId,
      chapterIndex: 3 + params.neighborOffset } };
  } }) };
const seeds = [{ sourceId: 'local', bookId }, { sourceId: 'remote', bookId: 'remote-book' }];
const prep = new ReadingEntryPreparation(runtime);
await prep.preparePersistedShelf('shelf-1', async () => seeds, () => true);
assert.equal(calls.length, 14);
assert.deepEqual(paths, [bookId], 'only one local current-target preparation may inspect the retained source');
assert.deepEqual(calls.filter(c => c.params.localSourcePath !== undefined).map(c => [c.params.sourceId, c.params.neighborOffset, c.priority]),
  [['local', 0, 'background']]);
await prep.preparePersistedShelf('shelf-1', async () => { throw Error('must not scan again'); }, () => true);
assert.equal(paths.length, 1);
prep.close();

const legacy = new ReadingEntryPreparation({ ...runtime,
  supportsCoreCapability: capability => capability === 'reading.entry.prepare.v1',
  async retainedLocalBookSourcePath() { throw Error('old Core must never receive parser-upgrade work'); } });
await legacy.preparePersistedShelf('legacy', async () => seeds, () => true);
assert.equal(calls.slice(14).some(c => c.params.localSourcePath !== undefined), false);
legacy.close();

// A book-open/pause arriving during async file availability must prevent dispatch.
let paused;
const cancelled = new ReadingEntryPreparation({ ...runtime,
  async retainedLocalBookSourcePath(_id, current) { paused.setPaused(true); assert.equal(current(), false); return `${root}/${hash}.source`; } });
paused = cancelled; const before = calls.length;
await cancelled.preparePersistedShelf('cancelled', async () => seeds, () => true);
assert.equal(calls.length, before);
cancelled.close();
console.log('PASS private immutable archive lookup, legacy compatibility, local-only idle preparation and foreground cancellation; no foreground source parsing');

// A committed Core repair may lose its response to cancellation. Optional
// presentation fences must still expire; pending position evidence must not.
for (const lostReply of [false, true]) {
  let oldView, duringView, contentProof, otherView, count = 0;
  let repairing;
  const instance = new ReadingEntryPreparation({ supportsCoreCapability: () => true,
    retainedLocalBookSourcePath: async () => `${root}/${hash}.source`,
    bookAcquisitions: () => ({ async request(_method, params) {
      count++;
      if (params.localSourcePath !== undefined) {
        duringView = instance.captureValidity('local', bookId);
        if (lostReply) throw Error('reply cancelled after atomic publication');
      }
      return { data: { kind: 'ready', reason: 'alreadyPrepared', sourceId: params.sourceId,
        bookId: params.bookId, chapterIndex: 3 + params.neighborOffset, imagePresentationChanged: true } };
    } }) });
  oldView = instance.captureValidity('local', bookId);
  contentProof = instance.captureContentValidity('local', bookId);
  otherView = instance.captureValidity('local', 'another-book');
  repairing = instance.preparePersistedShelf('repair', async () => [{ sourceId: 'local', bookId }], () => true);
  if (lostReply) await assert.rejects(repairing, /reply cancelled/); else await repairing;
  assert.equal(oldView(), false); assert.equal(duringView(), false);
  assert.equal(contentProof(), true); assert.equal(otherView(), true);
  assert.equal(count, 7, 'presentation invalidation never aborts or self-repeats the shelf pass');
  if (!lostReply) {
    await instance.preparePersistedShelf('repair', async () => { throw Error('completed pass rescanned'); }, () => true);
    assert.equal(count, 7);
  }
  instance.close();
}
console.log('PASS book-scoped presentation invalidation including lost reply; position proofs, other books and completed shelf pass preserved');
