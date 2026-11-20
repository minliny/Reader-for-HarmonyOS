// Only new main-scroll notices, prefix index mapping and progress budget cases.
// No prior Card/list/header suite, build, network or device is executed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const [{ compileTailConsumer }, { boundedMembers }, { createArkUIPropertyRuntimeProbe },
  { readerFoundationTokens }, { readerTypographyRoles }, { resolveEtsLoaderRoot, virtualFilePath },
  { SearchPublication }, { SearchViewState }, { SearchResultProjection }, { searchBookSnapshot }, author, media, intro,
  { foundationControls, foundationSpecs, buttonSource }, readerFonts] = await Promise.all([
  import('../../lib/foundation-tail-consumer-probe.mjs'), import('../../lib/bounded-surface-sdk-probe.mjs'),
  import('../../lib/arkui-property-runtime-probe.mjs'), import('../../lib/reader-foundation-control-probe.mjs'),
  import('../../lib/reader-typography-probe.mjs'), import('../../lib/tool-environment.mjs'),
  import('../../../entry/src/main/ets/features/search/SearchPublication.ts'),
  import('../../../entry/src/main/ets/features/search/SearchViewState.ts'),
  import('../../../entry/src/main/ets/features/search/SearchResultProjection.ts'),
  import('../../../entry/src/main/ets/features/search/SearchBookSnapshot.ts'),
  import('../../../entry/src/main/ets/features/common/BookAuthorMetadata.ts'),
  import('../../../entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
  import('../../../entry/src/main/ets/features/common/BookIntroText.ts'),
  import('../../lib/reader-foundation-control-probe.mjs'),
  import('../../../entry/src/main/ets/features/common/ReaderFontFamilies.ts'),
]);

const productionSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const snapshotHelperSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchBookSnapshot.ts', import.meta.url), 'utf8');
const source = productionSource;
const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const parse = text => ts.createSourceFile(virtualFilePath('SearchCardVisibility.ets'), text,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, require(sdk + '/lib/ets_checker.js').compilerOptions);
const tree = parse(source);
assert.deepEqual(tree.parseDiagnostics, [], 'current production ETS parses');
const declaration = name => {
  const found = tree.statements.find(node => node.name?.getText(tree) === name);
  assert.ok(found, 'actual production declaration ' + name);
  return found;
};
const frameSource = declaration('SearchLayoutFrame').getText(tree);
const SearchLayoutFrame = new Function('FrameCallback', `${stripTypeScriptTypes(frameSource)};return SearchLayoutFrame;`)(class {});
const classDependencies = { ...author, ...media,
  DataOperationType: { ADD: 'add', DELETE: 'delete', CHANGE: 'change', RELOAD: 'reload', MOVE: 'move' } };
const classes = ['SearchBookGroup', 'SearchResultDataSource'].map(name =>
  declaration(name).getText(tree).replace(/^@Observed\s*/, '')).join('\n');
const { SearchBookGroup: RawSearchBookGroup, SearchResultDataSource } = new Function(...Object.keys(classDependencies),
  `${stripTypeScriptTypes(classes)};return {SearchBookGroup,SearchResultDataSource};`)(...Object.values(classDependencies));
const cardSource = source.slice(source.lastIndexOf('@Component', declaration('SearchResultCard').getStart(tree)));
let fontScale = 1;
const typographySource = readFileSync(new URL('../../../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const textClass = typographySource.slice(typographySource.indexOf('export class ReaderTextStyle'),
  typographySource.indexOf('\nexport class ReaderInheritedTextStyle'));
const ReaderTextStyle = new Function(`${stripTypeScriptTypes(textClass).replace(/^export /gm, '')};return ReaderTextStyle;`)();
const foundation = foundationControls({ specs: foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle }),
  windowMetrics: () => ({ systemFontScale: fontScale }) });
const properties = foundation.properties;
const messageSource = readFileSync(new URL('../../../entry/src/main/ets/features/common/ReaderMessageStyle.ets', import.meta.url), 'utf8');
const messageDeps = { ReaderTextStyle, ...readerFonts };
const messageNames = [...messageSource.matchAll(/export const (\w+)/g)].map(match => match[1]);
const messageRoles = new Function(...Object.keys(messageDeps), `${stripTypeScriptTypes(messageSource).replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '')};return{${messageNames.join(',')}};`)(...Object.values(messageDeps));
const pageStateSource = readFileSync(new URL('../../../entry/src/main/ets/features/common/ReaderPageState.ets', import.meta.url), 'utf8');
// @Observed's business class is unchanged above. Use the actual SDK observer
// proxy at the decorator boundary so its real @ObjectLink property accepts it.
class SearchBookGroup extends RawSearchBookGroup {
  constructor(...args) { super(...args); return properties.sdk.ObservedObject.createNew(this, undefined); }
}
const TouchType = { Down: 'down', Up: 'up', Move: 'move', Cancel: 'cancel' };
const SourceType = { TouchScreen: 'touch', Keyboard: 'keyboard', Unknown: 'unknown' };
const ScrollSource = Object.fromEntries(['DRAG', 'FLING', 'OTHER_USER_INPUT', 'SCROLL_BAR',
  'SCROLL_BAR_FLING', 'SCROLLER', 'ANIMATION'].map(value => [value, value]));
const dependencies = { ...foundation.dependencies, ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...messageRoles,
  SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU,
  ...author, ...media, ...intro, SearchLayoutFrame, SearchBookGroup, SearchResultDataSource,
  SearchPublication, SearchViewState, SearchResultProjection, searchBookSnapshot, TouchType, SourceType, ScrollSource,
  SEARCH_LOCAL_SCOPE: '本地', SEARCH_ONLINE_SCOPE: '在线', registerReaderFonts() {},
  Edge: { Top: 'top' }, ScrollAlign: { START: 'start' }, Scroller: class {},
  ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: fontScale }) },
  // Native access-recording boundary used by the actual deferred ListItem
  // callback; the real SDK property observers remain the dependency owner.
  ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  // Realize the finite fixture's rows through the actual SDK-generated lazy
  // item Builder. Membership/removal, pointer dispatch and paint remain native.
  LazyForEach: { create(_id, _owner, data, item) {
    for (let index = 0; index < data.totalCount(); index++) item(data.getData(index), index);
  }, pop() {} },
};
require(sdk + '/lib/validate_ui_syntax.js').observedClassCollection.add('SearchBookGroup');
const hooks = { ...foundation.hooks, ...properties.hooks, childSources: { ReaderButton: buttonSource, ReaderPageState: pageStateSource, SearchResultCard: cardSource },
  mountChildren: true, lifecycleChildren: true, allowEmptyBranchAdmission: true };
require(sdk + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderPageState', new Set(['leading', 'actionContent']));
const pageState = compileTailConsumer(pageStateSource, boundedMembers(pageStateSource, 'ReaderPageState'), dependencies, hooks);
dependencies.ReaderPageState = pageState.Component;
const card = compileTailConsumer(cardSource, boundedMembers(cardSource, 'SearchResultCard'), dependencies, hooks);
// The shared focused helper registers @Prop child metadata only. The actual
// SDK frontend also collects @ObjectLink before lowering its parent, and
// createUpdateStateVarsOfChildByElmtId selects both collections. Reproduce
// that frontend prepass from this exact child AST, without editing the helper,
// a production field, or any runtime parent/child update payload.
const objectLinks = new Set(declaration('SearchResultCard').members.filter(ts.isPropertyDeclaration)
  .filter(member => ts.getAllDecorators(member).some(decorator =>
    (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression).getText(tree) === 'ObjectLink'))
  .map(member => member.name.getText(tree)));
require(sdk + '/lib/validate_ui_syntax.js').objectLinkCollection.set('SearchResultCard', objectLinks);
require(sdk + '/lib/utils.js').storedFileInfo.overallObjectLinkCollection.set('SearchResultCard', objectLinks);
const propertyNames = declaration('SearchPage').members.filter(ts.isPropertyDeclaration).map(node => node.name.getText(tree));
const methods = ['acceptPublication', 'aboutToAppear', 'aboutToDisappear', 'publishVisibleGroups',
  'refreshVisibleResults', 'groupResults', 'scheduleDeferredResults', 'onListTouch', 'onListScrollStop',
  'saveScrollAnchor', 'onResultScrollIndex', 'rememberAnchorNeighbors', 'cancelScrollRestoreForUser',
  'restoreMeasuredAnchor', 'scheduleScrollRestore', 'resultGroupKey', 'normalizedBookKey', 'scopeEntries',
  'resultsContent', 'searchContentStartInset', 'searchHeaderHeight', 'hasSearchSession', 'searchSummaryHeight',
  'searchSummaryStacked', 'searchFilterHeight', 'searchStatsHeight', 'searchBarHeight', 'searchFontScale',
  'searchHeaderLayoutKey', 'onListWillScroll', 'onCardDisplayFactsChange', 'operation', 'retryOperation',
  'captureSearchNoticeFacts', 'displayedSearchNoticeFacts', 'acceptResultNoticeFacts', 'hasSearchNotice',
  'hasDisplayedSearchNotice', 'hasAnySearchNotice', 'searchNoticeText', 'searchNoticeActionEnabled', 'searchNoticeActionKey', 'searchProgressRetryHandler',
  'resultStats', 'searchProgressLine', 'searchProgressDetails', 'searchProgressNotice', 'mainSearchNotices',
  'resultNativeIndex', 'searchProgressText', 'searchStopped', 'isSweeping', 'partialSearchFailure',
  'emptyContent', 'errorContent', 'emptyStateActions', 'searchErrorActions', 'searchFailureTitle',
  'searchFailureMessage', 'isStoppedEmpty', 'filteredEmptyMessage', 'primaryPill', 'secondaryPill', 'suggestion', 'searchStateIllustration'];
// A normal build retains warnings, while the shared selected-member helper
// requires an empty diagnostics array. Record and permit only this exact
// existing shorthand/ObjectLink WARN at the compiler diagnostics port; the
// actual SDK compiler receives the unchanged production source. Every other
// diagnostic is forwarded to the helper and remains a hard failure.
const sdkCompiler = require(sdk + '/lib/process_component_class.js');
const actualProcessComponentClass = sdkCompiler.processComponentClass;
const retainedWarnings = [];
let page;
try {
  sdkCompiler.processComponentClass = (node, context, diagnostics, ...rest) => {
    const actualDiagnostics = [];
    const lowered = actualProcessComponentClass(node, context, actualDiagnostics, ...rest);
    for (const item of actualDiagnostics) {
      if (item.type === 'WARN' && item.message === "The 'regular' property 'group' cannot be assigned to the '@ObjectLink' property 'group'.")
        retainedWarnings.push(item);
      else diagnostics.push(item);
    }
    return lowered;
  };
  page = compileTailConsumer(source, [...propertyNames, ...methods],
    { ...dependencies, SearchResultCard: card.Component }, hooks);
} finally { sdkCompiler.processComponentClass = actualProcessComponentClass; }
const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);
const texts = owner => nodes(owner).filter(node => node.type === 'Text' && typeof node.create === 'string').map(node => node.create);
const retryChildren = owner => walk(owner).filter(child => child.specId === 'search-retry-progress');
const buttonClick = child => {
  const node = [...child.nodes.values()].find(value => typeof value.onClick === 'function');
  assert.ok(node, 'actual ReaderButton emitted a native click handler');
  return node.onClick;
};
const passed = [];
function scenario(name, run) { run(); passed.push(name); console.log('PASS ' + name); }
function book(id, patch = {}) {
  return { sourceId: 'source-' + id, sourceName: '书源 ' + id, bookId: id, groupKey: id,
    title: '目标书 ' + id, author: '作者', category: 'novel', searchRequestId: 'query-one',
    admittedOrder: id === 'a' ? 0 : id === 'b' ? 1 : 2, intro: '原简介', ...patch };
}
const operation = (generation = 1, canRetry = true, active = true) => ({ generation, canRetry, canCancel: active });
const result = (books, patch = {}) => ({ kind: 'results', keyword: '目标书', results: books,
  searching: true, completedSourceCount: 1, totalSourceCount: 120, failedSourceCount: 0,
  skippedSourceCount: 0, operation: operation(), ...patch });
const allNotices = { localSearchFailed: true, localFailureMessage: '读取超时，请重试', sourceListFailed: true,
  sourceListFailureMessage: '连接暂时不可用，请稍后重试', failedSourceCount: 8, skippedSourceCount: 7 };
function fixture({ books = [book('a'), book('b')], patch = {}, kind = 'results', width = 390,
  scale = 1, mode = 'results', measuredVp = 54.25 } = {}) {
  fontScale = scale;
  const frames = [], scrollCalls = [], rectCalls = [], datasets = [], warmups = [], measureCalls = [], retries = [];
  const native = { y: 20, measurable: true,
    rects: new Map([[0, { y: 150, height: 0 }], [1, { y: 180, height: 150 }], [2, { y: 330, height: 150 }]]),
    measureAvailable: true, measuredVp };
  const scroller = {
    currentOffset: () => ({ yOffset: native.y }),
    getItemRect(index) { rectCalls.push(index); if (!native.measurable || !native.rects.has(index)) throw new Error('native row not measured'); return { ...native.rects.get(index) }; },
    scrollBy(x, y) { scrollCalls.push(['by', x, y]); native.y += y;
      for (const [index, rect] of native.rects) native.rects.set(index, { ...rect, y: rect.y - y }); },
    scrollToIndex(...args) { scrollCalls.push(['index', ...args]); },
    scrollTo(value) { scrollCalls.push(['to', value]); native.y = value.yOffset; },
    scrollEdge(value) { scrollCalls.push(['edge', value]); },
  };
  const context = { getFont: () => ({}), postFrameCallback: frame => frames.push(frame),
    px2vp: value => value / 2,
    getMeasureUtils: () => ({ measureTextSize(input) { measureCalls.push({ ...input });
      if (!native.measureAvailable) throw new Error('native measurement not yet available');
      return { width: 100, height: native.measuredVp * 2 }; } }) };
  const owner = new page.Component(undefined, { isTablet: width === 736, reduceMotion: true });
  owner.getUIContext = () => context;
  owner.contentFrame = () => ({ width, left: 0, right: 0 });
  owner.searchBottomInset = () => 24;
  owner.resultScroller = scroller;
  owner.onVisibleGroups = groups => warmups.push(groups);
  owner.onRetry = () => retries.push({ query: owner.viewState.revision, generation: owner.operation()?.generation });
  owner.viewState.reset('目标书');
  owner.viewState.anchorKey = 'online:a'; owner.viewState.anchorItemY = 180;
  const presentation = kind === 'results' ? result(books, patch) : {
    kind, keyword: '目标书', searchedSourceCount: 120, operation: operation(), ...patch };
  owner.publication.publish(presentation);
  owner.aboutToAppear();
  owner.resultDataSource.registerDataChangeListener({ onDatasetChange(changes) { datasets.push(changes); } });
  let list;
  if (mode === 'results') {
    owner.resultsContent();
    // The SDK lowers a non-Lazy ListItem into a native deferred deep-render
    // callback. The generic recorder retains that callback without realizing
    // it; consume only this finite fixture's actual emitted callbacks here.
    // Do not replace the production Builder, child props or SDK output.
    for (const [id, node] of [...owner.nodes.entries()]) if (node.type === 'ListItem') {
      const render = Array.isArray(node.create) ? node.create[0] : node.create;
      if (typeof render === 'function') render(id, true);
    }
    list = nodes(owner).find(node => node.type === 'List');
  }
  else if (mode === 'stats') owner.resultStats();
  else if (mode === 'main') owner.mainSearchNotices();
  else if (mode === 'empty') owner.emptyContent('目标书', 120);
  else if (mode === 'error') owner.errorContent(120);
  for (const child of walk(owner)) child.getUIContext = () => context;
  const nextFrame = () => { const frame = frames.shift(); assert.ok(frame, 'production frame pending'); frame.onIdle(16); };
  const drain = (limit = 8) => { let count = 0; while (frames.length) { assert.ok(count++ < limit, 'frame work bounded'); nextFrame(); } return count; };
  if (list) { list.onAppear(); drain(); }
  const flush = () => properties.flush(child => walk(owner).includes(child));
  const publish = (nextPatch = {}, nextBooks = books) => {
    owner.publication.publish(result(nextBooks, nextPatch)); owner.publicationRevision++;
  };
  scrollCalls.length = 0; rectCalls.length = 0; datasets.length = 0; warmups.length = 0;
  return { owner, list, native, frames, scrollCalls, rectCalls, datasets, warmups, measureCalls, retries,
    context, books, flush, publish, nextFrame, drain };
}

scenario('fixed header progress uses real native measurement inputs/cache; counts and notices cannot change its height', () => {
  for (const [width, scale] of [[390, 1], [320, 2], [320, 3.2]]) {
    const f = fixture({ mode: 'stats', width, scale });
    const expected = 4 + Math.ceil(Math.max(36 * scale, f.native.measuredVp));
    assert.equal(f.owner.searchStatsHeight(), expected);
    assert.equal(f.measureCalls.length, 4, 'four real bounded production templates measured once');
    assert.ok(f.measureCalls.some(input => input.textContent.includes('9007199254740991/9007199254740991')));
    for (const input of f.measureCalls) {
      assert.equal(input.constraintWidth, `${width - 32}vp`);
      assert.equal(input.fontSize, '12fp'); assert.equal(input.lineHeight, '18fp');
      assert.equal(input.fontFamily, 'ReaderNotoSansSC'); assert.equal(input.fontWeight, 'FontWeight.Regular');
    }
    assert.ok(!nodes(f.owner).some(node => node.type === 'Scroll'), 'actual fixed progress Builder has no nested Scroll');
    assert.equal(retryChildren(f.owner).length, 0, 'notices and retry controls are absent from the header progress Builder');
    const header = f.owner.searchHeaderHeight();
    for (const patch of [allNotices, { completedSourceCount: Number.MAX_SAFE_INTEGER, totalSourceCount: Number.MAX_SAFE_INTEGER },
      { searching: false, stopped: true, operation: { ...operation(), fact: 'cancelled', canCancel: false } }]) {
      f.publish(patch); f.flush();
      assert.equal(f.owner.searchStatsHeight(), expected);
      assert.equal(f.owner.searchHeaderHeight(), header);
      assert.equal(f.measureCalls.length, 4, 'publication text/counters do not repeat native measurement');
      assert.ok(!f.owner.searchProgressText().includes('已返回'), 'duplicated result count removed from progress');
    }
    f.owner.readerWindowMetricsRevision++; f.owner.searchStatsHeight(); assert.equal(f.measureCalls.length, 8);
    f.owner.contentFrame = () => ({ width: width + 10 }); f.owner.searchStatsHeight(); assert.equal(f.measureCalls.length, 12);
    fontScale = scale + .1; f.owner.searchStatsHeight(); assert.equal(f.measureCalls.length, 16);
  }
  const f = fixture({ mode: 'none' }); f.native.measureAvailable = false;
  const fallback = f.owner.searchStatsHeight(); assert.ok(fallback >= 40);
  assert.ok(f.owner.progressHeightLayoutKey.length > 0, 'valid conservative fallback is cached for this geometry key');
  const failedCalls = f.measureCalls.length;
  f.native.measureAvailable = true; f.native.measuredVp = 70;
  assert.equal(f.owner.searchStatsHeight(), fallback, 'native measurement recovery cannot resize the same geometry key');
  assert.equal(f.measureCalls.length, failedCalls);
  f.owner.readerWindowMetricsRevision++;
  assert.equal(f.owner.searchStatsHeight(), 74); assert.equal(f.measureCalls.length, failedCalls + 4);
  fontScale = 1.1; f.owner.searchStatsHeight(); assert.equal(f.measureCalls.length, failedCalls + 8);
});

scenario('permanent native prefix is first and zero-padding when empty; notices naturally wrap in main list and terminal main Scroll', () => {
  for (const patch of [{}, allNotices]) {
    const f = fixture({ patch });
    const items = [...f.owner.nodes.values()].filter(node => node.type === 'ListItem');
    assert.equal(items[0].id, 'search-main-notices');
    assert.equal(items.length, 3, 'prefix plus two book rows, independent of notice presence');
    assert.equal(f.owner.resultDataSource.totalCount(), 2, 'DataSource contains book-local items only');
    const prefixColumn = [...f.owner.nodes.values()].find(node => node.type === 'Column' &&
      node.padding?.left === 16 && node.padding?.right === 16 && node.border?.width?.bottom !== undefined);
    assert.ok(prefixColumn, 'actual mainSearchNotices column carries its native rail/padding/border attributes: ' +
      JSON.stringify([...f.owner.nodes.values()].map(node => ({ type: node.type, id: node.id, padding: node.padding, border: node.border }))));
    assert.equal(prefixColumn.type, 'Column'); assert.equal(prefixColumn.height, undefined);
    assert.equal(prefixColumn.padding.top, patch === allNotices ? 4 : 0);
    assert.equal(prefixColumn.padding.bottom, patch === allNotices ? 8 : 0);
    assert.equal(prefixColumn.border.width.bottom, patch === allNotices ? dependencies.TOK_BORDER_W : 0);
    assert.ok(!nodes(f.owner).some(node => node.type === 'Scroll'), 'results use one native List without a nested notice Scroll');
    assert.equal(retryChildren(f.owner).length, patch === allNotices ? 3 : 0);
  }
  for (const scale of [1, 2, 3.2]) for (const mode of ['main', 'empty', 'error']) {
    const f = fixture({ mode, kind: mode === 'empty' ? 'empty' : mode === 'error' ? 'error' : 'results', patch: allNotices, width: 320, scale });
    assert.equal(nodes(f.owner).filter(node => node.type === 'Scroll').length, mode === 'main' ? 0 : 1,
      'only terminal page main Scroll contains the notices');
    const labels = texts(f.owner);
    assert.equal(labels.filter(value => value.includes('本地检索：')).length, 1, 'partial facts are not duplicated as a long action or page error message');
    assert.ok(labels.includes('8 个书源搜索失败。') && labels.includes('已跳过 7 个近期不可用书源。'));
    for (const node of nodes(f.owner).filter(node => node.type === 'Text' && typeof node.create === 'string' &&
      /本地检索：|个书源搜索失败|近期不可用书源/.test(node.create))) {
      assert.equal(node.maxLines, undefined); assert.equal(node.textOverflow, undefined);
      assert.equal(node.height, undefined); assert.equal(node.maxFontScale, scale);
    }
    const targets = [...f.owner.nodes.values()].filter(node => node.type === '__Common__' && node.constraintSize?.minWidth === 44 && node.constraintSize?.minHeight === 44);
    assert.equal(targets.length, 3, 'each notice has a native layout target at least 44vp');
    assert.equal(retryChildren(f.owner).length, 3);
    if (mode !== 'main') {
      const own = [...f.owner.nodes.values()]; assert.equal(own[0].type, 'Scroll');
      const ordered = foundation.orderedNodes(f.owner);
      const firstNotice = ordered.findIndex(node => node.type === 'Text' && String(node.create).includes('本地检索：'));
      const pageTitle = ordered.findIndex(node => node.type === 'Text' && node.create ===
        (mode === 'empty' ? '没有找到相关书籍' : '本地检索未完成'));
      assert.ok(firstNotice >= 0 && pageTitle > firstNotice, 'actual notice Text creation precedes the terminal state title');
    }
  }
  const empty = fixture({ books: [] });
  assert.equal([...empty.owner.nodes.values()].filter(node => node.type === 'ListItem').length, 2,
    'filtered-empty state is a ListItem after the permanent prefix');
  assert.equal(empty.owner.resultDataSource.totalCount(), 0);
});

scenario('native indices map books by plus one; prefix-only clears warmup and stores offset without stale neighbor fallback', () => {
  const f = fixture({ books: [book('a'), book('b'), book('local', { sourceId: 'local' })] });
  f.list.onScrollIndex(1, 2);
  assert.equal(f.owner.viewState.anchorIndex, 0); assert.equal(f.owner.viewState.anchorKey, 'online:a');
  assert.equal(f.rectCalls.at(-1), 1); assert.deepEqual(f.owner.warmupGroups.map(group => group[0].bookId), ['a', 'b']);
  f.list.onScrollIndex(2, 3);
  assert.equal(f.owner.viewState.anchorIndex, 1); assert.equal(f.owner.viewState.anchorKey, 'online:b');
  assert.equal(f.rectCalls.at(-1), 2); assert.deepEqual(f.owner.warmupGroups.map(group => group[0].bookId), ['b']);
  f.owner.rememberAnchorNeighbors(); assert.ok(f.owner.viewState.anchorNeighbors.includes('online:a'));
  f.native.y = 27; f.rectCalls.length = 0; f.list.onScrollIndex(0, 0);
  assert.equal(f.owner.viewState.anchorKey, ''); assert.deepEqual(f.owner.viewState.anchorNeighbors, []);
  assert.equal(f.owner.viewState.anchorOffset, 27); assert.deepEqual(f.owner.warmupGroups, []); assert.deepEqual(f.rectCalls, []);
  f.owner.viewState.anchorNeighbors = ['online:a']; f.owner.restoreKey = ''; f.owner.restoreOffset = 27;
  f.native.y = 31; f.owner.restoreCancelled = false; f.owner.scheduleScrollRestore(); f.drain();
  assert.deepEqual(f.scrollCalls, [['to', { xOffset: 0, yOffset: 27 }]], 'empty-key offset restore never resolves stale book neighbors');
  f.scrollCalls.length = 0; f.list.onScrollIndex(0, 1);
  assert.deepEqual(f.owner.warmupGroups.map(group => group[0].bookId), ['a']); assert.equal(f.owner.viewState.anchorKey, '');
  f.native.y = 0; f.list.onScrollIndex(1, 2); assert.equal(f.owner.viewState.anchorKey, '', 'top offset also owns the viewport');
  f.native.y = 20; f.list.onScrollIndex(2, 2);
  f.owner.restoreKey = 'online:b'; f.owner.restoreItemY = 180; f.owner.restoreCancelled = false;
  f.native.measurable = false; f.owner.scheduleScrollRestore();
  assert.equal(f.drain(), 3, 'unmeasured anchor has at most three restoration frames');
  assert.deepEqual(f.scrollCalls, [['index', 2, false, 'start']], 'one realization uses native bookIndex+1');
  assert.equal(f.owner.scrollRestored, true);
  const d = fixture(); d.publish({}, [...d.books, book('c')]);
  assert.ok(d.datasets.flat().some(item => item.type === 'add' && item.index === 2), 'DataSource dataset change keeps local book index without prefix offset');
});

scenario('touch and inertia retain latest notice snapshot; idle admission causes one actual displacement check and no scroll for unchanged geometry', () => {
  for (const inertia of [false, true]) {
    const f = fixture({ patch: allNotices }); f.list.onScrollIndex(1, 2);
    const previous = f.owner.resultNoticeFacts; const beforeText = texts(f.owner);
    f.list.onTouch({ type: TouchType.Down });
    if (inertia) f.list.onWillScroll(12, 'scroll', ScrollSource.FLING);
    f.publish({ ...allNotices, failedSourceCount: 9 }); f.flush();
    f.publish({ ...allNotices, failedSourceCount: 10 }); f.flush();
    assert.equal(f.owner.resultNoticeFacts, previous); assert.deepEqual(texts(f.owner), beforeText);
    assert.equal(f.owner.searchNoticeText('failed'), '8 个书源搜索失败。');
    f.list.onTouch({ type: TouchType.Up });
    assert.equal(f.owner.resultNoticeFacts, previous, 'Up does not publish synchronously');
    if (inertia) { assert.equal(f.frames.length, 0); f.list.onScrollStop(); }
    assert.equal(f.frames.length, 1); f.nextFrame(); f.flush();
    assert.equal(f.owner.searchNoticeText('failed'), '10 个书源搜索失败。');
    assert.equal(f.frames.length, 1, 'one geometry check follows latest notice admission');
    f.native.rects.set(1, { y: 196, height: 150 });
    assert.equal(f.drain(), 1); assert.deepEqual(f.scrollCalls, [['by', 0, 16]]);
    f.scrollCalls.length = 0;
    f.publish({ ...allNotices, failedSourceCount: 11 }); f.flush();
    assert.equal(f.drain(), 1); assert.deepEqual(f.scrollCalls, [], 'text changes with unchanged measured y do not scroll');
    f.publish({ ...allNotices, failedSourceCount: 11, operation: operation(2, false) }); f.flush();
    assert.equal(f.frames.length, 0, 'generation/admission-only update has no geometry work');
  }
  for (const retire of ['query', 'page']) {
    const f = fixture({ patch: allNotices }); f.list.onTouch({ type: TouchType.Down });
    f.publish({ ...allNotices, failedSourceCount: 99 }); f.list.onTouch({ type: TouchType.Cancel });
    const oldFacts = f.owner.resultNoticeFacts;
    if (retire === 'query') f.owner.viewState.reset('新关键词'); else f.owner.aboutToDisappear();
    f.drain(); assert.notEqual(f.owner.resultNoticeFacts?.failed, 99); assert.deepEqual(f.scrollCalls, []);
    if (retire === 'query') assert.equal(f.owner.resultNoticeFacts, oldFacts);
  }
});

scenario('real retry click preserves admission, rejects replaced generation/query/page, and updates disabled state while notice text is frozen', () => {
  const f = fixture({ patch: allNotices });
  const [partial, failed, skipped] = retryChildren(f.owner);
  for (const child of [partial, failed, skipped]) buttonClick(child)();
  assert.equal(f.retries.length, 3);
  f.list.onTouch({ type: TouchType.Down });
  f.publish({ ...allNotices, operation: operation(1, false) }); f.flush();
  assert.equal(retryChildren(f.owner).length, 3, 'same-generation permission update retains existing button instances');
  assert.equal(partial.actionEnabled, false); assert.equal(failed.actionEnabled, false); assert.equal(skipped.actionEnabled, true);
  assert.equal(nodes(partial).find(node => typeof node.onClick === 'function').enabled, false, 'native disabled appearance tracks live permission');
  buttonClick(partial)(); buttonClick(failed)(); buttonClick(skipped)(); assert.equal(f.retries.length, 4);
  const staleCallbacks = [partial.onAction, failed.onAction, skipped.onAction];
  f.publish({ ...allNotices, operation: operation(2, true) }); f.flush();
  for (const child of [partial, failed, skipped]) { assert.equal(child.actionEnabled, false); buttonClick(child)(); }
  for (const action of staleCallbacks) action(); assert.equal(f.retries.length, 4, 'old displayed generation cannot retry a new operation');
  f.list.onTouch({ type: TouchType.Cancel }); f.drain(); f.flush();
  const fresh = retryChildren(f.owner).filter(child => ![partial, failed, skipped].includes(child));
  assert.equal(fresh.length, 3, 'actual SDK ForEach keyed generation admits three new ReaderButton instances');
  const currentKeys = [...f.owner.keys.values()].filter(value => value instanceof Set);
  for (const kind of ['partial', 'failed', 'skipped']) assert.ok(currentKeys.some(keys => keys.has(f.owner.searchNoticeActionKey(kind))),
    'actual SDK ForEach consumed the production current ' + kind + ' identity key');
  for (const action of staleCallbacks) action(); assert.equal(f.retries.length, 4, 'old callbacks remain invalid after the new identity is admitted');
  for (const child of fresh) { assert.equal(child.actionEnabled, true); buttonClick(child)(); }
  if (f.retries.length !== 7) {
    const start = page.output.indexOf('search-retry-progress');
    const childStart = foundation.button.output.indexOf('updateStateVars(');
    writeFileSync(new URL('./search-main-notices-retry-lowering-20261021.json', import.meta.url), JSON.stringify({
      sourceSha256: createHash('sha256').update(productionSource).digest('hex'),
      displayedGeneration: f.owner.displayedSearchNoticeFacts().operationGeneration,
      currentGeneration: f.owner.operation()?.generation,
      buttons: [partial, failed, skipped].map((child, index) => ({ actionEnabled: child.actionEnabled,
        onActionSameAsGenerationOne: child.onAction === staleCallbacks[index] })),
      actualChildUpdatePayloads: properties.updates.filter(update => [partial, failed, skipped].includes(update.child))
        .map(update => ({ keys: Object.keys(update.params), actionEnabled: update.params.actionEnabled })),
      loweredParentRetryExcerpt: page.output.slice(Math.max(0, start - 400), start + 1800),
      loweredReaderButtonUpdate: foundation.button.output.slice(childStart, childStart + 1100),
      productionNoticeBuilder: declaration('SearchPage').members.find(member => member.name?.getText(tree) === 'searchProgressNotice').getText(tree),
      fact: 'Real child enabled after idle but current native click did not call onRetry. No callback or Prop was manually assigned.',
    }, null, 2) + '\n');
  }
  assert.equal(f.retries.length, 7);
  f.list.onTouch({ type: TouchType.Down });
  f.publish({ ...allNotices, skippedSourceCount: 0, operation: operation(2, true) }); f.flush();
  const currentSkipped = fresh[2];
  assert.equal(currentSkipped.actionEnabled, false); buttonClick(currentSkipped)(); assert.equal(f.retries.length, 7, 'skipped requires its current flag');
  for (const retire of ['query', 'page']) {
    const r = fixture({ patch: allNotices }); const children = retryChildren(r.owner); const actions = children.map(child => child.onAction);
    if (retire === 'query') r.owner.viewState.reset('另一个查询'); else r.owner.aboutToDisappear();
    for (const child of children) buttonClick(child)(); for (const action of actions) action();
    assert.equal(r.retries.length, 0, 'retained native and direct action callbacks reject retired ' + retire);
  }
});

console.log(JSON.stringify({ result: 'PASS', cases: passed.length, passed,
  productionSha256: createHash('sha256').update(productionSource).digest('hex'),
  loweredSourceSha256: createHash('sha256').update(source).digest('hex'),
  snapshotHelperSha256: createHash('sha256').update(snapshotHelperSource).digest('hex'), retainedWarnings,
  propertyRuntime: properties.source,
  evidence: 'only new main-scroll notices/prefix/measurement/retry scenarios; actual SDK-lowered production methods and ReaderButton native click; native geometry and text-measurement inputs are explicit ports',
  notProven: 'native font shaping/wrapping/pixels, native Scroll/List layout/removal/physics, device interaction or user acceptance' }));
