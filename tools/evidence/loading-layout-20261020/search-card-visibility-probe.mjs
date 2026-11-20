// Added Card/display/key/user-scroll cases only. No previous list/header probe,
// default gate, build, network, native renderer or device is executed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  { SearchPublication }, { SearchViewState }, { SearchResultProjection }, { searchBookSnapshot }, author, media, intro] = await Promise.all([
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
const properties = createArkUIPropertyRuntimeProbe();
// @Observed's business class is unchanged above. Use the actual SDK observer
// proxy at the decorator boundary so its real @ObjectLink property accepts it.
class SearchBookGroup extends RawSearchBookGroup {
  constructor(...args) { super(...args); return properties.sdk.ObservedObject.createNew(this, undefined); }
}
const TouchType = { Down: 'down', Up: 'up', Move: 'move', Cancel: 'cancel' };
const SourceType = { TouchScreen: 'touch', Keyboard: 'keyboard', Unknown: 'unknown' };
const ScrollSource = Object.fromEntries(['DRAG', 'FLING', 'OTHER_USER_INPUT', 'SCROLL_BAR',
  'SCROLL_BAR_FLING', 'SCROLLER', 'ANIMATION'].map(value => [value, value]));
const dependencies = { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles,
  SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU,
  ...author, ...media, ...intro, SearchLayoutFrame, SearchBookGroup, SearchResultDataSource,
  SearchPublication, SearchViewState, SearchResultProjection, searchBookSnapshot, TouchType, SourceType, ScrollSource,
  SEARCH_LOCAL_SCOPE: '本地', SEARCH_ONLINE_SCOPE: '在线', registerReaderFonts() {},
  Edge: { Top: 'top' }, ScrollAlign: { START: 'start' }, Scroller: class {},
  ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
  // Realize the finite fixture's rows through the actual SDK-generated lazy
  // item Builder. Membership/removal, pointer dispatch and paint remain native.
  LazyForEach: { create(_id, _owner, data, item) {
    for (let index = 0; index < data.totalCount(); index++) item(data.getData(index), index);
  }, pop() {} },
};
require(sdk + '/lib/validate_ui_syntax.js').observedClassCollection.add('SearchBookGroup');
const hooks = { ...properties.hooks, childSources: { SearchResultCard: cardSource },
  mountChildren: true, lifecycleChildren: true, allowEmptyBranchAdmission: true };
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
  'searchHeaderLayoutKey', 'onListWillScroll', 'onCardDisplayFactsChange'];
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
if (process.argv[2] === '--inspect-binding') {
  const syntax = require(sdk + '/lib/validate_ui_syntax.js');
  console.log(JSON.stringify({ status: 'NOT_RUN', diagnostic: 'SDK child binding metadata',
    schema: Object.fromEntries(Object.keys(syntax).filter(key => /collection/i.test(key) && syntax[key] instanceof Map)
      .map(key => [key, syntax[key].get('SearchResultCard') instanceof Set ? [...syntax[key].get('SearchResultCard')] : syntax[key].get('SearchResultCard')])),
    childUpdates: page.output.split('\n').filter(line => /updateStateVarsOfChildByElmtId/.test(line)) }));
  process.exit(0);
}
const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);

function book(id, patch = {}) {
  return { sourceId: 'source-' + id, sourceName: '书源 ' + id, bookId: id, groupKey: id,
    title: id === 'a' ? '目标书' : '其他书 ' + id, author: '作者', category: 'novel',
    coverUrl: 'https://fixture.invalid/' + id + '.jpg', intro: '原简介', latestChapterTitle: '第一章',
    admittedOrder: id === 'a' ? 0 : 1,
    searchRequestId: 'query-one', ...patch };
}
const result = (books, completed = 1, delta) => ({ kind: 'results', keyword: '目标书', results: books,
  searching: true, completedSourceCount: completed, totalSourceCount: 120, failedSourceCount: 0,
  skippedSourceCount: 0, delta, operation: { canCancel: true, canRetry: false } });

function fixture(initial = [book('a'), book('b')]) {
  const frames = [], scrollCalls = [], datasetCalls = [], selected = [], visible = [];
  const native = { y: 0, rects: new Map([[0, { y: 227, height: 150 }], [1, { y: 377, height: 150 }]]) };
  const scroller = {
    currentOffset: () => ({ yOffset: native.y }),
    getItemRect(index) {
      const rect = native.rects.get(index);
      if (!rect) throw new Error('native fixture row not realized');
      return { ...rect };
    },
    scrollBy(x, y) {
      scrollCalls.push(['by', x, y]); native.y += y;
      for (const [index, rect] of native.rects) native.rects.set(index, { ...rect, y: rect.y - y });
    },
    scrollToIndex(...args) { scrollCalls.push(['index', ...args]); },
    scrollTo(value) { scrollCalls.push(['to', value]); native.y = value.yOffset; },
    scrollEdge(value) { scrollCalls.push(['edge', value]); native.y = 0; },
  };
  const context = { getFont: () => ({}), postFrameCallback: frame => frames.push(frame) };
  const owner = new page.Component(undefined, { isTablet: false, reduceMotion: true });
  owner.getUIContext = () => context;
  owner.contentFrame = () => ({ width: 390, left: 0, right: 0 });
  owner.searchBottomInset = () => 24;
  owner.resultScroller = scroller;
  owner.onSelectResult = (...value) => selected.push(value);
  owner.onVisibleGroups = groups => visible.push(groups);
  owner.viewState.reset('目标书');
  owner.viewState.anchorKey = 'online:a'; owner.viewState.anchorItemY = 227;
  owner.publication.publish(result(initial));
  owner.aboutToAppear();
  owner.resultDataSource.registerDataChangeListener({ onDatasetChange: changes => datasetCalls.push(changes) });
  owner.resultsContent();
  const list = nodes(owner).find(node => node.type === 'List');
  assert.ok(list && typeof list.onTouch === 'function' && typeof list.onScrollStop === 'function');
  for (const child of owner.children.values()) if (child instanceof card.Component) child.getUIContext = () => context;
  list.onAppear();
  function nextFrame() {
    const frame = frames.shift();
    assert.ok(frame, 'an actual production frame callback is pending');
    frame.onIdle(16);
  }
  function drain(limit = 12) {
    let ran = 0;
    while (frames.length) { assert.ok(ran++ < limit, 'production frame work is bounded'); nextFrame(); }
    return ran;
  }
  drain();
  const cards = [...owner.children.values()].filter(child => child instanceof card.Component);
  const row = cards.find(child => child.group.book.groupKey === 'a');
  assert.ok(row, 'actual retained SearchResultCard is mounted for fixture a');
  assert.equal(row.viewState, owner.viewState, 'card receives the shared query owner without @Prop cloning');
  const physicalRow = nodes(row).find(node => typeof node.onTouch === 'function' && typeof node.onClick === 'function');
  assert.ok(physicalRow, 'actual production row has native touch/click handlers');
  scrollCalls.length = 0; datasetCalls.length = 0;
  const publish = (books, completed = 2, delta) => {
    owner.publication.publish(result(books, completed, delta));
    owner.publicationRevision++;
  };
  const visibility = () => {
    const value = physicalRow.onVisibleAreaChange;
    assert.ok(Array.isArray(value) && typeof value[1] === 'function', 'SDK native visibility handler');
    return value[1];
  };
  const text = () => nodes(row).filter(node => node.type === 'Text' && typeof node.create === 'string').map(node => node.create);
  const flush = () => properties.flush(current => walk(owner).includes(current));
  return { owner, row, list, physicalRow, frames, selected, scrollCalls, datasetCalls,
    native, publish, nextFrame, drain, initial, visibility, text, flush };
}

let cases = 0;
function scenario(name, run) { run(); cases++; console.log('PASS ' + name); }

scenario('visible metadata and tags stay on one displayed book; touch and accessibility selection use that displayed identity', () => {
  const f = fixture();
  f.visibility()(true, 1);
  const baseline = f.text();
  const next = book('a', { bookId: 'enriched-book', sourceId: 'better-source', sourceName: '补全书源名称',
    intro: '更长的补全简介。'.repeat(24), latestChapterTitle: '新增章节信息', author: '作者' });
  f.publish([next, f.initial[1]]); f.flush();
  assert.equal(f.row.group.book.bookId, 'enriched-book', 'real retained Group has the new candidate');
  assert.equal(f.row.displayBook().bookId, 'a', 'visible display remains the old identity');
  assert.deepEqual(f.text(), baseline, 'native text inputs/label branches are unchanged while visible');
  assert.equal(f.row.displaySourceCount(), 1); assert.equal(f.row.displayInBookshelf(), false);
  f.physicalRow.onTouch({ type: TouchType.Down });
  f.physicalRow.onTouch({ type: TouchType.Up });
  f.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected.at(-1)[0].bookId, 'a');
  f.physicalRow.onClick({ source: SourceType.Unknown });
  assert.equal(f.selected.at(-1)[0].bookId, 'a', 'no-Down click also reads the displayed identity');
  f.drain();
  assert.deepEqual(f.scrollCalls, [], 'unchanged measured anchor has no geometry correction');
});

scenario('idle offscreen metadata is admitted before one real geometry measurement, with zero scroll for unchanged geometry', () => {
  const f = fixture(); f.visibility()(true, 1);
  f.publish([book('a', { intro: '已补全简介', latestChapterTitle: '第二章', sourceName: '已补全书源' }), f.initial[1]]);
  f.flush(); f.drain(); f.scrollCalls.length = 0;
  assert.equal(f.row.displayBook().intro, '原简介');
  f.visibility()(false, 0); f.flush();
  assert.equal(f.row.displayBook().intro, '已补全简介');
  assert.equal(f.row.displayBook().latestChapterTitle, '第二章');
  assert.equal(f.frames.length, 1, 'one owner geometry measurement is scheduled');
  assert.equal(f.drain(), 1);
  assert.deepEqual(f.scrollCalls, []);

  f.visibility()(true, 1);
  f.publish([book('a', { intro: '下一次变更简介', latestChapterTitle: '第三章' }), f.initial[1]]);
  f.flush(); f.drain();
  f.visibility()(false, 0); f.flush();
  f.native.rects.set(0, { y: 242, height: 150 });
  assert.equal(f.drain(), 1);
  assert.deepEqual(f.scrollCalls, [['by', 0, 15]], 'only measured displacement is corrected once');
});

scenario('busy offscreen pending metadata is released by actual List Stop -> parent State -> child Prop Watch without another publication', () => {
  const f = fixture(); f.visibility()(true, 1);
  f.publish([book('a', { intro: '等待idle的简介' }), f.initial[1]]); f.flush(); f.drain();
  f.list.onWillScroll(12, 'scroll', ScrollSource.OTHER_USER_INPUT);
  f.visibility()(false, 0); f.flush();
  assert.equal(f.row.displayBook().intro, '原简介', 'busy offscreen remains stable');
  const idleBefore = f.row.displayIdleRevision;
  const updatesBefore = properties.updates.length;
  f.list.onScrollStop();
  assert.equal(f.owner.displayIdleRevision, idleBefore + 1, 'actual List handler advances parent State');
  f.flush();
  assert.equal(f.row.displayIdleRevision, idleBefore + 1, 'actual SDK parent binding resets child Prop');
  assert.ok(properties.updates.slice(updatesBefore).some(update => update.child === f.row &&
    update.params.displayIdleRevision === idleBefore + 1), 'SDK emitted child update payload contains the idle revision');
  assert.equal(f.row.displayBook().intro, '等待idle的简介', 'the Prop Watch admits pending metadata without more network/data');
  assert.equal(f.frames.length, 1); f.drain();
  assert.deepEqual(f.scrollCalls, []);

  f.visibility()(true, 1);
  f.publish([book('a', { intro: '新Down仍应暂缓' }), f.initial[1]]); f.flush(); f.drain();
  f.list.onWillScroll(12, 'scroll', ScrollSource.FLING);
  f.visibility()(false, 0); f.flush();
  f.list.onScrollStop(); f.list.onTouch({ type: TouchType.Down }); f.flush();
  assert.equal(f.row.displayBook().intro, '等待idle的简介', 'new Down blocks an already dirty idle Prop delivery');
  f.list.onTouch({ type: TouchType.Cancel }); f.flush();
  assert.equal(f.row.displayBook().intro, '新Down仍应暂缓', 'actual Cancel-to-idle revision retries the same pending display');
  f.drain();
});

scenario('visible tags stay stable, then source-count and shelf facts update when idle offscreen', () => {
  const f = fixture(); f.visibility()(true, 1);
  const before = f.text();
  const group = f.row.group;
  group.sourceCount = 4; group.inBookshelf = true;
  f.flush();
  assert.equal(f.row.displaySourceCount(), 1); assert.equal(f.row.displayInBookshelf(), false);
  assert.deepEqual(f.text(), before);
  f.visibility()(false, 0); f.flush();
  assert.equal(f.row.displaySourceCount(), 4); assert.equal(f.row.displayInBookshelf(), true);
  assert.ok(f.text().includes('已发现 4 个书源'));
  assert.ok(f.text().includes('已在书架'));
  assert.equal(f.frames.length, 1); f.drain();
});

scenario('query Prop/ObjectLink may arrive in either order; source request identity prevents a visible stale snapshot from sticking', () => {
  for (const order of ['prop-first', 'link-first']) {
    const f = fixture(); f.visibility()(true, 1);
    const oldVisibility = f.visibility();
    f.owner.viewState.reset('下一查询');
    const nextRevision = f.owner.viewState.revision;
    const next = book('a', { bookId: 'new-query', searchRequestId: 'query-two', intro: '新查询简介' });
    const nativePropDelivery = () => f.row.updateStateVars({ group: f.row.group, queryRevision: nextRevision,
      displayIdleRevision: f.row.displayIdleRevision, isTablet: false, cardWidth: 390 });
    const nativeLinkDelivery = () => f.owner.resultDataSource.replace([
      new SearchBookGroup(next, 1, false), f.owner.resultDataSource.getData(1)]);
    if (order === 'prop-first') { nativePropDelivery(); nativeLinkDelivery(); }
    else { nativeLinkDelivery(); nativePropDelivery(); }
    f.flush();
    assert.equal(f.row.displayBook().bookId, 'new-query', order + ': new query retires visible old metadata');
    assert.equal(f.row.displayedFacts.queryRevision, nextRevision);
    const currentVisibility = f.visibility(); currentVisibility(true, 1);
    oldVisibility(false, 0);
    assert.equal(f.row.displayVisible, true, 'old-query visibility callback is rejected');
    f.row.group.book = { ...next, intro: '同query代表源的后续补全', sourceId: 'other-source' };
    f.flush();
    assert.equal(f.row.displayBook().intro, '新查询简介', 'same request metadata remains pinned while visible');
    f.drain();
  }
});

scenario('retired visibility callbacks cannot alter a remounted row or emit display-change geometry work', () => {
  const f = fixture(); f.visibility()(true, 1);
  const retiredVisibility = f.visibility();
  f.row.aboutToDisappear();
  f.row.group.book = { ...f.row.group.book, intro: '退场期间更新' }; f.flush();
  assert.equal(f.row.displayedFacts, undefined);
  assert.equal(f.frames.length, 0);
  retiredVisibility(false, 0);
  assert.equal(f.row.displayedFacts, undefined);
  f.row.aboutToAppear(); f.flush();
  // The recording helper does not model native removal/remount. Recreate the
  // native nodes through the actual SDK initial render and use that new
  // registration, rather than calling a retired node as if it were current.
  f.row.initialRender();
  const remountedRow = nodes(f.row).filter(node => typeof node.onTouch === 'function' && typeof node.onClick === 'function').at(-1);
  remountedRow.onVisibleAreaChange[1](true, 1);
  assert.equal(f.row.displayBook().intro, '退场期间更新');
  retiredVisibility(false, 0);
  assert.equal(f.row.displayVisible, true, 'old-mount callback cannot unpin current mount');
  f.drain();
});

scenario('author proof/version identity is equal in Page key, real DataSource key and real Projection', () => {
  const f = fixture();
  const decorated = book('proof', { groupKey: undefined, title: '同书', author: '@作者', sourceRuleVersion: 'v1',
    authorIdentity: { schemaVersion: 1, sourceVersion: 'v1', field: 'search', raw: '@作者', label: '作者', rule: 'author-nickname-at-v1' } });
  const normal = book('proof-other', { groupKey: undefined, sourceId: 'second-source', title: '同书', author: '作者',
    sourceRuleVersion: 'v1', admittedOrder: 2 });
  const projection = new SearchResultProjection(), state = new SearchViewState(); state.reset('同书');
  const update = projection.update([decorated, normal], [], '同书', state);
  assert.equal(update.orderedKeys.length, 1, 'valid source-bound proof groups the same title/author');
  const group = new SearchBookGroup(decorated, 1, false);
  const data = new SearchResultDataSource();
  assert.equal(f.owner.resultGroupKey(decorated), data.key(group));
  assert.equal(f.owner.resultGroupKey(decorated), update.orderedKeys[0]);
  const stale = { ...decorated, sourceRuleVersion: 'v2' };
  assert.notEqual(f.owner.resultGroupKey(stale), f.owner.resultGroupKey(normal), 'stale proof does not authorize the normalized author');
  assert.equal(f.owner.resultGroupKey(stale), data.key(new SearchBookGroup(stale, 1, false)));
  f.drain();
});

scenario('all native user scroll sources freeze list publication and cancel old correction; SCROLLER/ANIMATION and zero deltas do not', () => {
  for (const source of ['DRAG', 'FLING', 'OTHER_USER_INPUT', 'SCROLL_BAR', 'SCROLL_BAR_FLING']) {
    const f = fixture(); f.owner.restoreCancelled = false; f.owner.scheduleScrollRestore();
    f.list.onWillScroll(10, 'scroll', ScrollSource[source]);
    assert.equal(f.owner.userScrolling, true, source);
    assert.equal(f.owner.restoreCancelled, true, source + ' cancels pending correction');
    f.publish([book('a', { intro: 'user-source pending' }), f.initial[1]]);
    assert.equal(f.owner.resultsDeferred, true, source + ' defers actual publication');
    f.drain(); assert.deepEqual(f.scrollCalls, [], 'invalidated native correction is inert');
    f.list.onScrollStop(); f.flush(); f.drain();
  }
  for (const source of ['SCROLLER', 'ANIMATION']) {
    const f = fixture(); f.owner.restoreCancelled = false;
    f.list.onWillScroll(10, 'scroll', ScrollSource[source]);
    assert.equal(f.owner.userScrolling, false, source + ' is programmatic');
    assert.equal(f.owner.restoreCancelled, false);
    f.publish([book('a', { intro: 'programmatic accepts' }), f.initial[1]]); f.flush();
    assert.equal(f.owner.resultsDeferred, false);
    f.drain();
  }
  for (const offset of [0, NaN, Infinity, .001]) {
    const f = fixture(); f.owner.restoreCancelled = false;
    f.list.onWillScroll(offset, 'scroll', ScrollSource.DRAG);
    assert.equal(f.owner.userScrolling, false);
    assert.equal(f.owner.restoreCancelled, false);
    f.drain();
  }
});

console.log(JSON.stringify({ result: 'PASS', cases,
  productionSha256: createHash('sha256').update(productionSource).digest('hex'),
  snapshotHelperSha256: createHash('sha256').update(snapshotHelperSource).digest('hex'),
  loweredSourceSha256: createHash('sha256').update(source).digest('hex'), retainedWarnings,
  evidence: 'only added production SDK Card/visibility/query/key/user-scroll scenarios; real parent State -> SDK child Prop/Watch idle delivery; real Group/Projection/DataSource and native callback inputs',
  notProven: 'native paint/layout/pointer timing, measured visual row height, native lazy removal, device or user acceptance' }));

