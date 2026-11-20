// Explicit issue-local production-method evidence. No default gate or SDK/device I/O.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const baseline = process.argv.includes('--baseline');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const projectionUrl = new URL('../../../entry/src/main/ets/features/search/SearchResultProjection.ts', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  },
  load(url, context, next) {
    if (baseline && url === projectionUrl) {
      const source = execFileSync('git', ['show', '6b1bd7534b61a8ebfac10150fd308eae8430606e:entry/src/main/ets/features/search/SearchResultProjection.ts'],
        { cwd: root, encoding: 'utf8' });
      return { format: 'module', source: stripTypeScriptTypes(source), shortCircuit: true };
    }
    return next(url, context);
  },
});
const { SearchResultProjection } = await import(projectionUrl);
const { SearchViewState } = await import('../../../entry/src/main/ets/features/search/SearchViewState.ts');
const identity = book => `${book.sourceId}\u0000${book.bookId}`;
const book = (id, title, groupKey = id, admittedOrder = 0, extra = {}) => ({
  sourceId: id, sourceName: id, bookId: '/' + id, title, author: '作者', groupKey,
  category: 'novel', admittedOrder, sourceRuleVersion: 'rules-v1',
  bookSourceUrl: 'https://example.invalid/' + id, detailUrl: '/' + id,
  searchRequestId: 'query-one', variables: [], ...extra,
});
const names = update => update.orderedKeys.map(key => update.rows.get(key).book.groupKey);
const ids = update => [...update.rows.values()].flatMap(row => row.variants.map(identity)).sort();
const assertLiveOrder = update => {
  assert.equal(new Set(update.orderedKeys).size, update.orderedKeys.length, 'displayed groups never duplicate');
  assert.deepEqual(new Set(update.orderedKeys), new Set(update.rows.keys()), 'displayed keys contain exactly live groups');
};
const shelf = [];
const state = new SearchViewState(); state.reset('目标');
const projection = new SearchResultProjection();
const a = book('a', '目标', 'a', 2);
const b = book('b', '目标外传', 'b', 0);
const c = book('c', '别的作品', 'c', 1);
let results = [b, c, a];
let update = projection.update(results, shelf, '目标', state);
assert.deepEqual(names(update), ['a', 'b', 'c'], 'first visible batch retains the existing relevance ordering');
assertLiveOrder(update);

const late = book('late', '目标', 'late', 3);
results = [...results, late];
update = projection.update(results, shelf, '目标', state);
assert.deepEqual(names(update), ['a', 'b', 'c', 'late'], 'late exact match must append instead of displacing already displayed books');
console.log('PASS stable append after the initially ranked batch');

const exactC = book('c-better', '目标', 'c', 4);
results = [...results, exactC];
update = projection.update(results, shelf, '目标', state);
assert.deepEqual(names(update), ['a', 'b', 'c', 'late'], 'improving an existing group score does not move that group');
assert.equal(update.rows.get('online:c').book, exactC, 'representative-source selection still accepts better relevance');
assert.equal(update.orderChanged, false, 'metadata and representative changes do not issue a structural reorder');
const at = Date.now();
const readableC = book('c-readable', '目标', 'c', 5, { acquisition: {
  schemaVersion: 2, sourceVersion: 'rules-v1', verificationCurrent: true,
  catalogCount: 10, catalogAt: at, readableAt: at,
} });
results = [...results, readableC];
update = projection.update(results, shelf, '目标', state);
assert.equal(update.rows.get('online:c').book, readableC, 'existing candidate evidence policy still selects the readable source');
assert.deepEqual(names(update), ['a', 'b', 'c', 'late']);
assertLiveOrder(update);
console.log('PASS representative and acquisition enrichment preserve positions and candidate policy');

const before = update.orderedKeys;
update = projection.update(results, shelf, '目标', state);
assert.equal(update.orderedKeys, before, 'unchanged publication retains its sequence object');
assert.equal(update.orderChanged, false);
assert.equal(update.changedKeys.size, 0);
const remount = new SearchResultProjection().update(results, shelf, '目标', state);
assert.deepEqual(names(remount), ['a', 'b', 'c', 'late'], 'Detail return rebuilds the same query-owned displayed sequence');
assert.deepEqual(ids(remount), results.map(identity).sort());
console.log('PASS unchanged publication and Detail remount');

results = results.filter(value => value !== b);
update = projection.update(results, shelf, '目标', state);
assert.deepEqual(names(update), ['a', 'c', 'late'], 'genuine removal does not re-sort the remaining groups');
assertLiveOrder(update);
assert.deepEqual(new Set(state.displayedOrderFor('目标')), new Set(update.rows.keys()), 'removed keys do not accumulate in query display state');
const missingRevision = book('missed', '目标', 'missed', 6);
results = [...results, missingRevision].reverse();
update = projection.update(results, shelf, '目标', state, { baseRevision: 100, revision: 101, reset: false,
  upserted: [missingRevision], removedKeys: [] });
assert.deepEqual(names(update), ['a', 'c', 'late', 'missed'], 'missed-delta snapshot fallback retains displayed order');
assert.deepEqual(ids(update), results.map(identity).sort());
console.log('PASS removal and missed-delta reconstruction');

const mergeState = new SearchViewState(); mergeState.reset('书');
const merging = new SearchResultProjection();
const left = book('left', '书甲', 'left', 0);
const middle = book('middle', '书乙', 'middle', 1);
const right = book('right', '书丙', 'right', 2);
update = merging.update([left, middle, right], shelf, '书', mergeState);
const canonicalLeft = { ...left, groupKey: 'canonical' };
update = merging.update([canonicalLeft, middle, right], shelf, '书', mergeState);
assert.deepEqual(names(update), ['canonical', 'middle', 'right'], 'a genuine replacement key inherits the removed row position');
assert.equal(mergeState.resolveKey('online:left'), 'online:canonical');
const canonicalRight = { ...right, groupKey: 'canonical' };
update = merging.update([canonicalLeft, middle, canonicalRight], shelf, '书', mergeState);
assert.deepEqual(names(update), ['canonical', 'middle'], 'merge does not duplicate or move the already displayed target');
assert.equal(update.rows.get('online:canonical').variants.length, 2);
assert.equal(mergeState.resolveKey('online:right'), 'online:canonical');
const splitRight = { ...canonicalRight, groupKey: 'split-right' };
update = merging.update([canonicalLeft, middle, splitRight], shelf, '书', mergeState);
assert.deepEqual(names(update), ['canonical', 'middle', 'split-right'], 'a genuine split appends its new row without merging unrelated works');
assertLiveOrder(update);
assert.deepEqual(ids(update), [canonicalLeft, middle, splitRight].map(identity).sort());
update = merging.update([middle, splitRight], shelf, '书', mergeState);
assert.deepEqual(names(update), ['middle', 'split-right']);
assert.equal(mergeState.displayedOrderFor('书').includes('online:canonical'), false);
console.log('PASS genuine replacement, merge, split and deletion preserve all live identities and redirects');

const mediaState = new SearchViewState(); mediaState.reset('同名');
const mediaProjection = new SearchResultProjection();
const novel = book('novel', '同名', undefined, 0); delete novel.groupKey;
const comic = book('comic', '同名', undefined, 1, { category: 'comic' }); delete comic.groupKey;
const local = book('local', '同名', undefined, 2); delete local.groupKey;
update = mediaProjection.update([novel, comic, local], shelf, '同名', mediaState);
assert.equal(update.rows.size, 3, 'novel, comic and local identities retain their existing boundaries');
const mediaOrder = update.orderedKeys.slice();
update = mediaProjection.update([novel, comic, local], [{ ...novel, sourceId: 'saved', contentKind: 'text' }], '同名', mediaState);
assert.deepEqual(update.orderedKeys, mediaOrder);
assert.equal([...update.rows.values()].find(row => row.book === novel).inBookshelf, true);
assert.equal([...update.rows.values()].find(row => row.book === comic).inBookshelf, false);
console.log('PASS existing media and shelf grouping boundaries');

state.reset('目标');
update = new SearchResultProjection().update(results, shelf, '目标', state);
assert.equal(names(update)[0], 'c', 'an explicit fresh query may rank its initial batch again');
state.reset('别的作品');
update = projection.update(results, shelf, '别的作品', state);
assert.equal(update.rows.get(update.orderedKeys[0]).book.title, '别的作品', 'different query acquires its own initial relevance order');
assertLiveOrder(update);
console.log('PASS query reset discards prior displayed sequence');
console.log('PASS issue-local production SearchResultProjection stability; native pixels and pointer identity remain separate.');
