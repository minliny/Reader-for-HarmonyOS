// Explicit issue-local SDK evidence for the approved compact search header.
// No default gate, business suite, build, network or device I/O.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const { tailControls, compileTailConsumer } = await import('../../lib/foundation-tail-consumer-probe.mjs');
const { foundationControls, foundationSpecs } = await import('../../lib/reader-foundation-control-probe.mjs');
const { readerTypographyRoles } = await import('../../lib/reader-typography-probe.mjs');
const source = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
let scale = 1;
const windowMetrics = () => ({ systemFontScale: scale });
// The finite new search-scope specification constructs its real text role.
// Older helpers accept explicit role bindings, so supply the real production
// class here without modifying a shared helper or inventing a role fixture.
const typographySource = readFileSync(new URL('../../../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const classSource = typographySource.slice(typographySource.indexOf('export class ReaderTextStyle'),
  typographySource.indexOf('\nexport class ReaderInheritedTextStyle'));
const ReaderTextStyle = new Function(`${stripTypeScriptTypes(classSource).replace(/^export /gm, '')}; return ReaderTextStyle;`)();
// compileIconButtonSpecs has no explicit dependency argument and evaluates the
// same finite spec module through its exported role object. Bind the real class
// in this process only; no helper file, role value or production source changes.
Object.assign(readerTypographyRoles, { ReaderTextStyle });
const controls = tailControls({ foundation: foundationControls({ windowMetrics,
  specs: foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle }) }) });

// These are actual production members, selected explicitly rather than a copy
// of the layout implementation. Final pure text helpers are listed below once
// the production source is ready; no source-regex substitute is executed.
const methods = [
  'build', 'searchHeader', 'searchBar', 'searchActionLeading', 'resultSummary',
  'groupScopeRow', 'groupScopeChip', 'contentTypeRow', 'contentTypeChip',
  'resultStats', 'searchProgressDetails', 'searchProgressLine', 'searchProgressNotice',
  'hasSearchSession', 'searchSummaryHeight', 'searchSummaryStacked', 'searchHeaderHeight', 'searchStatsHeight',
  'searchFilterHeight', 'searchFilterLabelWidth', 'searchBarHeight',
  'searchHeaderLayoutKey', 'searchHeaderMeasurementKey', 'searchContentStartInset',
  'searchFontScale', 'operation', 'retryOperation', 'isSweeping', 'canSubmit',
  'submitSearch', 'partialSearchFailure', 'resultsContent', 'searchStopped',
  'searchStatusLabel', 'searchProgressText', 'hasSearchNotice', 'searchNoticeText',
];
const probe = compileTailConsumer(source, methods, {
  ...controls.dependencies, ReaderWindowCoordinator: { metrics: windowMetrics },
}, controls.hooks);

const operation = (active = false, canRetry = false, fact) => ({ canCancel: active, canRetry, fact });
const result = overrides => ({ kind: 'results', keyword: '原关键词', results: [], searching: true,
  completedSourceCount: 76, totalSourceCount: 120, failedSourceCount: 0,
  skippedSourceCount: 0, operation: operation(true), ...overrides });
const presentations = () => [
  { kind: 'loading', keyword: '原关键词', operation: operation(true) },
  result({}),
  result({ searching: false, completedSourceCount: 120, operation: operation() }),
  result({ searching: false, stopped: true, operation: operation(false, true, 'cancelled') }),
  { kind: 'empty', keyword: '原关键词', searchedSourceCount: 120, operation: operation() },
  { kind: 'empty', keyword: '原关键词', searchedSourceCount: 76, stopped: true,
    operation: operation(false, true, 'cancelled') },
  { kind: 'error', keyword: '原关键词', searchedSourceCount: 120, failedSourceCount: 8,
    localSearchFailed: true, localFailureMessage: '原本地失败原因'.repeat(30),
    operation: operation(false, true) },
];

function fixture(presentation, { width = 390, tablet = false, count = 128 } = {}) {
  const owner = new probe.Component(undefined, {});
  const calls = { stop: 0, retry: 0, search: 0, reset: 0, scopes: [], types: [] };
  Object.assign(owner, {
    appThemeScheme: 'day', isTablet: tablet, readerWindowMetricsRevision: 1,
    fixedHeaderHeight: 0, fixedHeaderLayoutKey: '', reduceMotion: false,
    presentation, visibleGroups: Array.from({ length: count }), keyword: '原关键词',
    spinnerRunKey: 1, focusInputOnAppear: false, selectedGroupName: '全部', selectedContentType: '全部类型',
    contentFrame: () => ({ width, left: 0, right: 0 }),
    groupNames: () => ['本地', '在线'], scopeSourceIds: () => undefined,
    selectGroup: value => calls.scopes.push(value), selectContentType: value => calls.types.push(value),
    viewState: { reset: () => calls.reset++, keywordDraft: '原关键词' },
    stateContent() {}, searchActivity() {}, onBack() {},
    onStop: () => calls.stop++, onRetry: () => calls.retry++, onSearch: () => calls.search++,
    searchBottomInset: () => 24, resultDataSource: { totalCount: () => 0 }, resultScroller: {},
    filteredEmptyMessage: () => '',
  });
  return { owner, calls };
}

const nodes = owner => controls.nodes(owner);
const text = owner => nodes(owner).filter(node => node.type === 'Text').map(node => node.create).filter(value => typeof value === 'string');
const children = owner => [...owner.children.values()];
const scaffold = owner => children(owner).find(child => (child.variant ?? child.params?.variant) === 'search');
const prop = (child, key) => child[key] ?? child.params?.[key];

// Geometry is exercised on a single actual owner across state changes. Trees
// are instead rendered with fresh owners: the recording port deliberately
// does not pretend to implement ArkUI branch removal or native scheduling.
for (const width of [320, 390, 736]) for (const fontScale of [1, 1.3, 2, 3.2]) {
  scale = fontScale;
  const { owner } = fixture(presentations()[0], { width, tablet: width === 736 });
  let baseline, measurementKey, layoutKey;
  for (const presentation of presentations()) {
    owner.presentation = presentation;
    assert.equal(owner.hasSearchSession(), true, 'all active and terminal search states keep the search-session structure');
    const inset = owner.searchContentStartInset();
    baseline ??= inset;
    measurementKey ??= owner.searchHeaderMeasurementKey();
    layoutKey ??= owner.searchHeaderLayoutKey();
    assert.equal(inset, baseline, 'first book, subsequent counts, stopped, empty and error keep the same List start');
    assert.equal(owner.searchHeaderMeasurementKey(), measurementKey, 'streaming facts do not invalidate same-geometry receipts');
    assert.equal(owner.searchHeaderLayoutKey(), layoutKey, 'layout identity excludes progress/result facts');
  }
  for (const presentation of [{ kind: 'initial', history: [] }, { kind: 'sourceRequired' }, { kind: 'sourceLoadError' }]) {
    owner.presentation = presentation;
    assert.equal(owner.hasSearchSession(), false);
    assert.equal(owner.searchHeaderHeight(), owner.searchBarHeight(), 'entry and source setup states have no empty session rows');
    assert.ok(owner.searchContentStartInset() < baseline);
  }

  for (const presentation of presentations()) {
    const { owner: current } = fixture(presentation, { width, tablet: width === 736 });
    current.searchHeader();
    const labels = text(current);
    assert.ok(labels.includes('来源') && labels.includes('内容类型'), 'both original filter rows are present before/after first result');
    assert.ok(!labels.some(label => label.includes('展开') || label.includes('收起')), 'approved header has no disclosure control');
    if (presentation.kind === 'loading')
      assert.ok(!labels.some(label => label.includes('0/0')), 'unknown first-book totals are not presented as a fabricated denominator');
    const progress = nodes(current).filter(node => node.type === 'Scroll' && node.scrollable === 'ScrollDirection.Vertical');
    assert.equal(progress.length, 1, 'progress is one native vertical Scroll');
    assert.equal(progress[0].height, current.searchStatsHeight(), 'progress viewport follows actual production two-line budget');
    assert.equal(progress[0].onAreaChange, undefined, 'streaming progress has no independent geometry write');
    for (const node of nodes(current).filter(node => node.type === 'Text' && typeof node.create === 'string' &&
      (node.create.includes('个书源') || node.create.includes('原本地失败原因')))) {
      assert.equal(node.maxLines, undefined, 'progress facts retain full native wrapping');
      assert.equal(node.textOverflow, undefined, 'progress facts do not ellipsize');
    }
  }

  const { owner: listOwner } = fixture(result({}), { width, tablet: width === 736 });
  listOwner.resultsContent();
  const list = nodes(listOwner).find(node => node.type === 'List');
  assert.equal(list.contentStartOffset, listOwner.searchContentStartInset(), 'actual native List consumes production header inset');
  assert.equal(list.height, '100%');
  assert.equal(list.maintainVisibleContentPosition, true);
}

scale = 1;
{
  const { owner } = fixture({ kind: 'initial', history: [] });
  owner.initialRender();
  const shell = scaffold(owner);
  assert.ok(shell, 'production SearchPage mounts the actual shared Scaffold');
  const onHeight = prop(shell, 'onHeaderHeightChange');
  const oldKey = owner.searchHeaderMeasurementKey();
  owner.presentation = result({});
  const activeKey = owner.searchHeaderMeasurementKey();
  assert.notEqual(oldKey, activeKey);
  const fallback = owner.searchContentStartInset();
  onHeight(52, oldKey);
  assert.equal(owner.fixedHeaderHeight, 0, 'late entry-state measurement cannot collapse an active header');
  assert.equal(owner.searchContentStartInset(), fallback);
  onHeight(fallback + 3, activeKey);
  assert.equal(owner.searchContentStartInset(), fallback + 3);
  owner.presentation = { kind: 'empty', keyword: '原关键词', searchedSourceCount: 120 };
  assert.equal(owner.searchContentStartInset(), fallback + 3, 'terminal states retain the accepted same-structure height');
  owner.readerWindowMetricsRevision++;
  const resizedFallback = owner.searchContentStartInset();
  onHeight(52, activeKey);
  assert.equal(owner.searchContentStartInset(), resizedFallback, 'old-window receipt cannot overwrite new-window fallback');
  onHeight(resizedFallback, owner.searchHeaderMeasurementKey());
  assert.equal(owner.fixedHeaderLayoutKey, owner.searchHeaderLayoutKey());
}

{
  const { owner, calls } = fixture(result({}));
  owner.searchBar();
  const action = children(owner).find(child => prop(child, 'specId') === 'search-field-phone');
  assert.ok(action);
  prop(action, 'onAction')();
  assert.equal(calls.stop, 1, 'active original search action delegates to onStop');
  owner.presentation = result({ searching: false, operation: operation() });
  prop(action, 'onAction')();
  assert.equal(calls.search, 1, 'retained action reads current state and delegates to original submit flow');
  assert.equal(calls.reset, 1);
}

{
  const { owner, calls } = fixture(result({ searching: false, failedSourceCount: 8,
    localSearchFailed: true, localFailureMessage: '原本地失败原因'.repeat(30),
    skippedSourceCount: 7, operation: operation(false, true) }));
  owner.resultStats();
  const retries = children(owner).filter(child => String(prop(child, 'specId')).startsWith('search-retry'));
  assert.ok(retries.length > 0, 'short retry controls remain separate from full failure facts');
  prop(retries[0], 'onAction')();
  assert.equal(calls.retry, 1, 'retry delegates to original business callback');
  owner.presentation = result({ operation: operation(true, false) });
  prop(retries[0], 'onAction')();
  assert.equal(calls.retry, 1, 'retained retry rechecks current operation admission');
}

for (const invalid of [NaN, Infinity, 0, -1]) {
  scale = invalid;
  const { owner } = fixture(result({}));
  assert.equal(owner.searchFontScale(), 1);
  assert.ok(Number.isFinite(owner.searchContentStartInset()));
}

console.log('PASS compact SearchPage production SDK: active-search structure/inset stable across first book, streaming and terminal facts; stale entry/window receipts rejected; native progress wraps in fixed vertical viewport; original stop/retry callbacks retained. Native layout/pixels/touch and device acceptance remain separate.');
