import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

// One focused production-model entry. No app build, network, device or other
// suite is started by this file.
const selectedCases = selectContractCases({ 'group-projection-retirement': { description: 'Actual group/filter/variant projection, disabled/deleted/version cache partition boundaries and ordinary Card press retirement with explicit ports', resources: [] } });
for (const id of selectedCases) {
const resolution = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context); throw error; }
} });
try {
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { SearchViewState } = await import('../entry/src/main/ets/features/search/SearchViewState.ts');
const { SearchSourceGroupDirectory, SearchResultFilter, ALL_SEARCH_SOURCE_GROUP, searchSourceGroupKey } =
  await import('../entry/src/main/ets/features/search/SearchSourceGroups.ts');
const { SearchResultProjection } = await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
const { SearchBookProjection } = await import('../entry/src/main/ets/features/search/SearchBookProjection.ts');
const { searchBookSnapshot } = await import('../entry/src/main/ets/features/search/SearchBookSnapshot.ts');

const catalog = { version: 1, revision: 1,
  groups: [{ groupId: 'g-a', name: '甲组' }, { groupId: 'g-b', name: '常用书源' }, { groupId: 'g-empty', name: '空组' }, { groupId: 'g-named-all', name: '全部分组' }],
  memberships: [{ sourceId: 'a', groupId: 'g-a', locallyAssigned: true }, { sourceId: 'b', groupId: 'g-b', locallyAssigned: true },
    { sourceId: 'disabled', groupId: 'g-b', locallyAssigned: true }, { sourceId: 'raw', groupId: '', locallyAssigned: false }] };
const directory = new SearchSourceGroupDirectory(catalog);
assert.equal(directory.options[0].count, 4, 'complete catalog counts include disabled sources');
assert.equal(directory.options.find(row => row.key === 'group:g-empty').count, 0, 'empty groups remain selectable');
assert.equal(directory.options.find(row => row.key === 'group:g-named-all').label, '全部分组（同名分组）');
assert.equal(directory.matches('unknown', { kind: 'ungrouped', groupId: '', name: '未分组' }), false, 'unknown is not ungrouped');
assert.equal(directory.matching('常用')[0].key, 'group:g-b');
const selected = directory.selectionFor('group:g-b');
const renamed = new SearchSourceGroupDirectory({ ...catalog, revision: 2, groups: catalog.groups.map(group => group.groupId === 'g-b' ? { ...group, name: '已改名' } : group) });
assert.equal(renamed.label(selected), '已改名');
assert.equal(renamed.matches('b', selected), true, 'renaming a stable ID retains membership');
const deleted = new SearchSourceGroupDirectory({ ...catalog, revision: 3, groups: catalog.groups.filter(group => group.groupId !== 'g-b') });
assert.equal(deleted.valid(selected), false);
assert.equal(deleted.matches('b', selected), false, 'deleted selection fails closed');

const view = new SearchViewState();
view.reset('重生'); const query = view.revision;
assert.equal(view.selectSourceGroup(selected), true);
view.selectOrigin('本地');
assert.equal(searchSourceGroupKey(view.sourceGroup), 'all', 'local and group clear in one owner action');
assert.equal(view.selectSourceGroup(selected), false, 'local origin cannot admit a group');
assert.equal(view.revision, query, 'filtering does not create another query');
view.prepareSourceManagementReturn('groups');
assert.equal(view.consumeSourceManagementReturn(), 'groups');
assert.equal(view.consumeSourceManagementReturn(), undefined, 'return intent is consumed once');
view.prepareSourceManagementReturn('groups'); view.reset('新查询');
assert.equal(view.consumeSourceManagementReturn(), undefined, 'new query retires old navigation intent');

const book = (sourceId, bookId, admittedOrder) => ({ sourceId, bookId, title: '重生', author: '作者',
  category: 'novel', groupKey: 'same-work', sourceRuleVersion: 'v1', admittedOrder });
const a = book('a', 'a-book', 0), b = book('b', 'b-book', 1), secondB = book('b', 'b-alias', 2), stopped = book('disabled', 'd-book', 3);
const unknown = book('unknown', 'u-book', 4), raw = { ...book('raw', 'raw-book', 5), groupKey: 'raw-work' };
const local = { ...book('local', 'local-book', 6), category: undefined };
const input = [a, b, secondB, stopped, unknown, raw, local];
const rawSnapshot = JSON.stringify(input);
const projection = new SearchResultProjection();
view.clearResultFilters();
const filter = (origin, content, selection, dir = directory) => new SearchResultFilter(origin, content, selection, dir, view.filterRevision);
const all = projection.update(input, [], '重生', view, undefined, true, filter('全部', '全部类型', ALL_SEARCH_SOURCE_GROUP));
assert.equal(all.rows.get('online:same-work').variants.length, 5);
view.selectOrigin('在线'); view.selectSourceGroup(selected);
const onlyGroup = projection.update(input, [], '重生', view, undefined, true, filter('在线', '小说', selected));
const row = onlyGroup.rows.get('online:same-work');
assert.deepEqual(row.variants, [b, secondB, stopped], 'filter each variant before projecting the group');
assert.equal(row.book, b, 'representative belongs to the selected subset');
assert.deepEqual(row.sourceIds, ['b', 'disabled'], 'source discovery count is deduplicated within subset');
assert.equal(onlyGroup.rows.size, 1);
view.advanceFilterRevision();
assert.equal(projection.update(input, [], '重生', view, undefined, true, filter('在线', '小说', selected, deleted)).rows.size, 0);
view.clearResultFilters();
const restored = projection.update(input, [], '重生', view, undefined, true, filter('全部', '全部类型', ALL_SEARCH_SOURCE_GROUP));
assert.equal(restored.rows.get('online:same-work').variants.length, 5, 'clearing a group restores original variants without another publication');
const ungrouped = { kind: 'ungrouped', groupId: '', name: '未分组' };
view.selectSourceGroup(ungrouped);
const rawOnly = projection.update(input, [], '重生', view, undefined, true, filter('全部', '全部类型', ungrouped));
assert.deepEqual([...rawOnly.rows.values()].flatMap(row => row.variants), [raw]);
assert.equal(JSON.stringify(input), rawSnapshot, 'original query DTOs remain unchanged');

// Exercise the actual cache projection at the disabled/deleted/version boundary.
const cache = new SearchBookProjection(); const stoppedMap = new Map([['disabled\0d-book', stopped]]);
let requests = 0;
const disabledPatch = await cache.refresh(stoppedMap, { reset: true, identities: [] },
  [{ sourceId: 'disabled', name: '已停用源', enabled: false, category: 'novel', sourceVersion: 'v2' }],
  async () => { requests++; throw new Error('disabled source must not request cache enrichment'); }, () => true);
assert.equal(requests, 0); assert.deepEqual(disabledPatch.removedKeys, []);
const removedPatch = await cache.refresh(stoppedMap, { reset: true, identities: [] }, [], async () => { throw new Error('deleted source must not issue cache RPC'); }, () => true);
assert.deepEqual(removedPatch.removedKeys, ['disabled\0d-book']);
const changedVersion = await new SearchBookProjection().refresh(stoppedMap, { reset: true, identities: [] },
  [{ sourceId: 'disabled', name: '更新源', enabled: true, category: 'novel', sourceVersion: 'v2' }],
  async () => ({ complete: true, snapshotRevision: '1', books: [], missing: [], sourceVersions: [{ sourceId: 'disabled', enabled: true, sourceVersion: 'v1' }] }), () => true);
assert.deepEqual(changedVersion.upserted, [], 'stale enabled-source version cannot publish');
assert.equal(changedVersion.retryIdentities.length, 1);

// Actual ordinary card methods, with only platform frame/touch adapters stubbed.
const Card = selectedProductionMethods(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'SearchResultCard',
  ['captureDisplayFacts', 'acceptDisplayFacts', 'displayBook', 'captureSelection', 'onCardTouch', 'selectResult'], {
    searchBookSnapshot, TouchType: { Down: 0, Up: 1, Cancel: 2 }, SourceType: { TouchScreen: 0, Mouse: 1 },
    SearchLayoutFrame: class { constructor(action) { this.action = action; } onFrame() { this.action(); } },
  });
const card = new Card(); const clicks = []; const frames = [];
Object.assign(card, { mounted: true, queryRevision: view.revision, displayRevision: view.filterRevision, viewState: view,
  group: { book: b, variants: [b, stopped], sourceCount: 2, inBookshelf: false, coverUrl: '', displayRevision: view.filterRevision },
  displayVisible: true, visibilityEpoch: 0, selectionEpoch: 0, canRefreshDisplay: () => true,
  onDisplayFactsChange() {}, onSelectResult: (...args) => clicks.push(args), getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }) });
card.acceptDisplayFacts(); card.onCardTouch(0);
view.advanceFilterRevision(); card.displayRevision = view.filterRevision;
card.acceptDisplayFacts();
assert.equal(card.displayedFacts.book.sourceId, 'b', 'Prop-first callback cannot capture an outgoing row as the new filter');
card.group = { ...card.group, book: a, variants: [a], displayRevision: view.filterRevision };
card.acceptDisplayFacts(); card.selectResult(0);
assert.equal(clicks.length, 0, 'filter change retires an old native press instead of selecting the new row');
card.selectResult(1);
assert.equal(clicks.length, 1); assert.equal(clicks[0][0].sourceId, 'a'); assert.deepEqual(clicks[0][1].map(item => item.sourceId), ['a']);
const Panel = selectedProductionMethods(new URL('../entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets', import.meta.url), 'ReaderSearchFilterPanel', ['acceptsAction']);
const panel = new Panel(); Object.assign(panel, { mounted: true, expanded: true, actionIdentity: 'filter:2' });
assert.equal(panel.acceptsAction('filter:1'), false); assert.equal(panel.acceptsAction('filter:2'), true);
console.log('PASS search source-group projection: directory / stable identity / local / variants / disabled / retired press');

recordContractCasePass(id);
} finally { resolution.deregister(); }
}
