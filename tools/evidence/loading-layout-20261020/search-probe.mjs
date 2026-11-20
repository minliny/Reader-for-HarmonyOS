// Explicit issue-local production SDK evidence; no default gate or device I/O.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
const { tailControls, compileTailConsumer } = await import('../../lib/foundation-tail-consumer-probe.mjs');
const { foundationControls } = await import('../../lib/reader-foundation-control-probe.mjs');
const source = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
let scale = 1;
const windowMetrics = () => ({ systemFontScale: scale });
const foundation = foundationControls({ windowMetrics });
const controls = tailControls({ foundation });
const methods = ['build', 'searchHeader', 'searchHeaderHeight', 'searchHeaderLayoutKey',
  'searchHeaderMeasurementKey', 'searchStatsHeight', 'searchContentStartInset', 'searchFontScale',
  'searchFilterHeight', 'searchBarHeight', 'resultStats', 'operation', 'retryOperation', 'isSweeping',
  'partialSearchFailure', 'resultsContent'];
const probe = compileTailConsumer(source, methods, {
  ...controls.dependencies, ReaderWindowCoordinator: { metrics: windowMetrics },
}, controls.hooks);
const owner = probe.owner;
let retries = 0;
const result = overrides => ({ kind: 'results', keyword: '原关键词', results: [], searching: true,
  completedSourceCount: 0, totalSourceCount: 120, failedSourceCount: 0, skippedSourceCount: 0,
  operation: { canCancel: true, canRetry: false }, ...overrides });
Object.assign(owner, { appThemeScheme: 'day', isTablet: false, readerWindowMetricsRevision: 1,
  fixedHeaderHeight: 0, fixedHeaderLayoutKey: '', visibleGroups: [], reduceMotion: false,
  contentFrame: () => ({ width: 320, left: 0, right: 0 }), presentation: { kind: 'loading' },
  stateContent() {}, searchBar() {}, groupScopeRow() {}, contentTypeRow() {}, groupNames: () => ['本地', '在线'],
  searchActivity() {}, onRetry: () => retries++, searchBottomInset: () => 24,
  resultDataSource: { totalCount: () => 0 }, resultScroller: {}, filteredEmptyMessage: () => '',
});
owner.initialRender();
const scaffold = [...owner.children.values()].find(child => child.params?.variant === 'search' || child.variant === 'search');
assert.ok(scaffold, 'production SearchPage mounts the actual public Scaffold');
// The callback comes from the SDK-lowered production parent, not a test copy.
const onHeight = scaffold.onHeaderHeightChange ?? scaffold.params.onHeaderHeightChange;
const loadingKey = owner.searchHeaderMeasurementKey();
assert.equal(scaffold.headerMeasurementKey ?? scaffold.params.headerMeasurementKey, loadingKey);
owner.presentation = result({});
const currentKey = owner.searchHeaderMeasurementKey();
assert.notEqual(loadingKey, currentKey);
const fallback = owner.searchContentStartInset();
onHeight(52, loadingKey);
assert.equal(owner.fixedHeaderHeight, 0, 'late loading height cannot become a results receipt');
assert.equal(owner.searchContentStartInset(), fallback, 'late loading cannot move the result list');
onHeight(fallback + 3, currentKey);
assert.equal(owner.searchContentStartInset(), fallback + 3, 'current real header measurement remains authoritative');
owner.readerWindowMetricsRevision++;
const resizedKey = owner.searchHeaderMeasurementKey();
const afterResize = owner.searchContentStartInset();
onHeight(52, currentKey);
assert.equal(owner.searchContentStartInset(), afterResize, 'old-width receipt cannot overwrite resized fallback');
onHeight(afterResize, resizedKey);
assert.equal(owner.fixedHeaderLayoutKey, owner.searchHeaderLayoutKey());
const reset = () => { owner.fixedHeaderHeight = 0; owner.fixedHeaderLayoutKey = ''; };
for (const width of [320, 390, 736]) for (const fontScale of [1, 1.3, 2, 3.2]) {
  scale = fontScale;
  owner.isTablet = width === 736;
  owner.readerWindowMetricsRevision++;
  owner.contentFrame = () => ({ width, left: 0, right: 0 });
  reset();
  let baseline;
  for (const facts of [
    {},
    { completedSourceCount: 99, failedSourceCount: 8, skippedSourceCount: 7 },
    { completedSourceCount: 120, searching: false, operation: { canCancel: false, canRetry: true } },
    { completedSourceCount: 100, searching: false, stopped: true, failedSourceCount: 12,
      skippedSourceCount: 7, localSearchFailed: true, localFailureMessage: '原本地失败原因'.repeat(20),
      operation: { canCancel: false, canRetry: true, fact: 'cancelled' } },
  ]) {
    owner.presentation = result(facts);
    owner.visibleGroups = Array.from({ length: 1000 });
    owner.resultStats();
    controls.flush(owner);
    const stats = controls.nodes(owner).filter(node => node.type === 'Scroll' && node.scrollable === 'ScrollDirection.Horizontal').at(-1);
    assert.ok(stats, 'actual statistics retain all existing text in one horizontal native Scroll');
    assert.equal(stats.height, 12 + 20 * fontScale);
    assert.equal(stats.onAreaChange, undefined, 'streaming statistics cannot issue a second geometry write');
    assert.equal(stats.scrollBar, 'BarState.Off');
    const inset = owner.searchContentStartInset();
    baseline ??= inset;
    assert.equal(inset, baseline, 'streaming counts, progress, failures and stopped state keep the same list start');
    owner.resultsContent();
    const list = controls.nodes(owner).filter(node => node.type === 'List').at(-1);
    assert.equal(list.contentStartOffset, inset, 'actual retained native List consumes the stable header inset');
    assert.equal(list.height, '100%');
    assert.equal(list.maintainVisibleContentPosition, true);
    const retry = [...owner.children.values()].filter(child => child.specId === 'search-retry-status').at(-1);
    if (facts.localSearchFailed) {
      assert.ok(retry, 'existing partial failure retry remains available without clipping its status into another row');
      const before = retries;
      retry.onAction();
      assert.equal(retries, before + 1, 'existing retry delegates to the same business callback');
    }
  }
  owner.presentation = { kind: 'initial' };
  owner.searchHeader();
  assert.equal(owner.searchHeaderHeight(), owner.searchBarHeight(), 'initial has no new empty filter rows');
  owner.presentation = { kind: 'loading' };
  assert.equal(owner.searchHeaderHeight(), owner.searchBarHeight(), 'loading has no new empty filter rows');
}
for (const invalid of [NaN, Infinity, 0, -1]) {
  scale = invalid;
  assert.equal(owner.searchFontScale(), 1);
  assert.equal(owner.searchStatsHeight(), 32);
}
console.log('PASS issue-local SearchPage production SDK: stale loading/window receipts rejected; original streaming statuses/retry retained in a stable one-line lane; native List inset and font adaptation verified. Native pixels remain separate.');
