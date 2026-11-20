// Explicit issue-local production SDK evidence. No previous header probe,
// default gate, build, network, native renderer or device is executed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';

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
  { SearchPublication }, { SearchViewState }, { SearchResultProjection }, author, media, intro] = await Promise.all([
  import('../../lib/foundation-tail-consumer-probe.mjs'), import('../../lib/bounded-surface-sdk-probe.mjs'),
  import('../../lib/arkui-property-runtime-probe.mjs'), import('../../lib/reader-foundation-control-probe.mjs'),
  import('../../lib/reader-typography-probe.mjs'), import('../../lib/tool-environment.mjs'),
  import('../../../entry/src/main/ets/features/search/SearchPublication.ts'),
  import('../../../entry/src/main/ets/features/search/SearchViewState.ts'),
  import('../../../entry/src/main/ets/features/search/SearchResultProjection.ts'),
  import('../../../entry/src/main/ets/features/common/BookAuthorMetadata.ts'),
  import('../../../entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
  import('../../../entry/src/main/ets/features/common/BookIntroText.ts'),
]);

const productionSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
let source = productionSource;
const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const parse = text => ts.createSourceFile(virtualFilePath('SearchListStability.ets'), text,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, require(sdk + '/lib/ets_checker.js').compilerOptions);
const mode = process.argv[2] ?? 'current';
assert.ok(['current', '--negative-click', '--negative-scroll'].includes(mode), 'explicit supported issue-local mode');
if (mode !== 'current') {
  // Read the actual prior production implementation. Only the named behavior
  // is substituted in memory; current fields, helpers and fixture stay intact.
  const oldSource = execFileSync('git', ['show', '6b1bd7534b61a8ebfac10150fd308eae8430606e:entry/src/main/ets/features/search/SearchPage.ets'],
    { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' });
  const oldTree = parse(oldSource), currentTree = parse(source);
  const member = (parsed, component, name) => {
    const owner = parsed.statements.find(node => node.name?.getText(parsed) === component);
    const found = owner?.members.find(node => node.name?.getText(parsed) === name);
    assert.ok(found, `actual ${component}.${name} for negative control`);
    return found;
  };
  let current, replacement;
  if (mode === '--negative-scroll') {
    current = member(currentTree, 'SearchPage', 'scheduleScrollRestore');
    replacement = member(oldTree, 'SearchPage', 'scheduleScrollRestore').getText(oldTree);
  } else {
    current = member(currentTree, 'SearchResultCard', 'selectResult');
    const build = member(oldTree, 'SearchResultCard', 'build');
    let handler;
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'onClick' && node.arguments[0] && ts.isArrowFunction(node.arguments[0]))
        handler = node.arguments[0];
      ts.forEachChild(node, visit);
    };
    visit(build);
    assert.ok(handler && !ts.isBlock(handler.body), 'actual old click is the live group-reading callback');
    replacement = `private selectResult(_source: SourceType): void { ${handler.body.getText(oldTree)}; }`;
  }
  source = source.slice(0, current.getStart(currentTree)) + replacement + source.slice(current.end);
}
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
const dependencies = { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles,
  SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU,
  ...author, ...media, ...intro, SearchLayoutFrame, SearchBookGroup, SearchResultDataSource,
  SearchPublication, SearchViewState, SearchResultProjection, TouchType, SourceType,
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
  mountChildren: true, lifecycleChildren: true };
const card = compileTailConsumer(cardSource, boundedMembers(cardSource, 'SearchResultCard'), dependencies, hooks);
const propertyNames = declaration('SearchPage').members.filter(ts.isPropertyDeclaration).map(node => node.name.getText(tree));
const methods = ['acceptPublication', 'aboutToAppear', 'aboutToDisappear', 'publishVisibleGroups',
  'refreshVisibleResults', 'groupResults', 'scheduleDeferredResults', 'onListTouch', 'onListScrollStop',
  'saveScrollAnchor', 'onResultScrollIndex', 'rememberAnchorNeighbors', 'cancelScrollRestoreForUser',
  'restoreMeasuredAnchor', 'scheduleScrollRestore', 'resultGroupKey', 'normalizedBookKey', 'scopeEntries',
  'resultsContent', 'searchContentStartInset', 'searchHeaderHeight', 'hasSearchSession', 'searchSummaryHeight',
  'searchSummaryStacked', 'searchFilterHeight', 'searchStatsHeight', 'searchBarHeight', 'searchFontScale',
  'searchHeaderLayoutKey'];
const page = compileTailConsumer(source, [...propertyNames, ...methods],
  { ...dependencies, SearchResultCard: card.Component }, hooks);
const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);

function book(id, patch = {}) {
  return { sourceId: 'source-' + id, sourceName: '书源 ' + id, bookId: id, groupKey: id,
    title: id === 'a' ? '目标书' : '其他书 ' + id, author: '作者', category: 'novel',
    coverUrl: 'https://fixture.invalid/' + id + '.jpg', intro: '原简介', admittedOrder: id === 'a' ? 0 : 1,
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
  return { owner, row, list, physicalRow, frames, selected, scrollCalls, datasetCalls,
    native, publish, nextFrame, drain, initial };
}

let cases = 0;
function scenario(name, run) { run(); cases++; console.log('PASS ' + name); }

scenario('Down defers all list publications while progress advances; Up/Click keeps pressed identity; latest result is accepted after dispatch', () => {
  const f = fixture();
  f.physicalRow.onTouch({ type: TouchType.Down }); f.list.onTouch({ type: TouchType.Down });
  const pressed = f.row.group.book;
  const newer = book('a', { bookId: 'a-next', sourceId: 'source-next', intro: '更新简介' });
  f.publish([newer, f.initial[1]], 30);
  const latest = { ...newer, intro: '最终简介' };
  f.publish([latest, f.initial[1], book('c')], 90);
  assert.equal(f.owner.presentation.completedSourceCount, 90, 'progress fact is current during touch');
  assert.equal(f.owner.resultsDeferred, true);
  assert.equal(f.row.group.book, pressed, 'retained native row is unchanged while finger owns it');
  assert.equal(f.owner.resultDataSource.totalCount(), 2);
  assert.equal(f.frames.length, 0);
  f.physicalRow.onTouch({ type: TouchType.Up }); f.list.onTouch({ type: TouchType.Up });
  assert.equal(f.owner.resultDataSource.totalCount(), 2, 'Up does not replace rows inside the event');
  f.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected.length, 1);
  assert.equal(f.selected[0][0].sourceId, pressed.sourceId);
  assert.equal(f.selected[0][0].bookId, pressed.bookId);
  assert.equal(f.selected[0][1][0].bookId, pressed.bookId);
  assert.equal(f.selected[0][2], pressed.coverUrl);
  f.drain();
  assert.equal(f.owner.resultDataSource.totalCount(), 3, 'only latest full publication is accepted');
  assert.equal(f.owner.resultDataSource.getData(0).book.intro, '最终简介');
  assert.equal(f.owner.resultsDeferred, false);
});

scenario('pressed card selection is immutable even if its retained group changes between Down and Click', () => {
  const f = fixture();
  f.physicalRow.onTouch({ type: TouchType.Down });
  const before = f.row.group.book;
  const next = book('a', { sourceId: 'new-source', bookId: 'new-book', coverUrl: 'https://fixture.invalid/new.jpg' });
  f.owner.resultDataSource.replace([new SearchBookGroup(next, 1, false), f.owner.resultDataSource.getData(1)]);
  assert.equal(f.row.group.book.bookId, 'new-book', 'real datasource updates its retained group');
  f.physicalRow.onTouch({ type: TouchType.Up });
  f.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected[0][0].bookId, before.bookId);
  assert.equal(f.selected[0][0].sourceId, before.sourceId);
  assert.equal(f.selected[0][2], before.coverUrl);
  f.drain();
});

scenario('Cancel retires touch selection and drains latest pending publication; keyboard/unknown click selects current group', () => {
  const f = fixture();
  f.physicalRow.onTouch({ type: TouchType.Down }); f.list.onTouch({ type: TouchType.Down });
  f.publish([book('a', { bookId: 'current-book' }), f.initial[1]]);
  f.physicalRow.onTouch({ type: TouchType.Cancel }); f.list.onTouch({ type: TouchType.Cancel });
  f.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected.length, 0, 'cancelled touchscreen click cannot fall back to a new occupant');
  f.drain();
  f.physicalRow.onClick({ source: SourceType.Keyboard });
  assert.equal(f.selected.at(-1)[0].bookId, 'current-book');
  f.physicalRow.onClick({ source: SourceType.Unknown });
  assert.equal(f.selected.at(-1)[0].bookId, 'current-book');
});

scenario('drag/inertial scroll retains the latest publication until ScrollStop and invalidates an older release frame', () => {
  const f = fixture();
  f.list.onTouch({ type: TouchType.Down }); f.list.onScrollStart();
  f.publish([book('a', { intro: '拖动期间' }), f.initial[1]], 40);
  f.list.onTouch({ type: TouchType.Up });
  assert.equal(f.frames.length, 0, 'touch release during inertial scroll does not schedule a flush');
  assert.equal(f.owner.resultsDeferred, true);
  f.list.onScrollStop();
  assert.equal(f.frames.length, 1);
  f.list.onTouch({ type: TouchType.Down });
  f.nextFrame();
  assert.equal(f.owner.resultsDeferred, true, 'old ScrollStop frame cannot commit during a new press');
  f.list.onTouch({ type: TouchType.Cancel }); f.drain();
  assert.equal(f.owner.resultDataSource.getData(0).book.intro, '拖动期间');
});

scenario('retire and new query reject old release frames and pressed selections', () => {
  const f = fixture();
  f.physicalRow.onTouch({ type: TouchType.Down }); f.list.onTouch({ type: TouchType.Down });
  f.publish([book('a', { intro: '过期' }), f.initial[1]]);
  f.physicalRow.onTouch({ type: TouchType.Up }); f.list.onTouch({ type: TouchType.Up });
  f.row.aboutToDisappear(); f.owner.aboutToDisappear();
  f.drain();
  assert.equal(f.owner.resultsDeferred, false);
  assert.equal(f.owner.userInteracting, false); assert.equal(f.owner.userScrolling, false);
  f.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected.length, 0);
  assert.equal(f.owner.resultDataSource.getData(0).book.intro, '原简介');

  const q = fixture();
  q.physicalRow.onTouch({ type: TouchType.Down }); q.list.onTouch({ type: TouchType.Down });
  q.publish([book('a', { intro: '旧查询待接纳' }), q.initial[1]]);
  q.physicalRow.onTouch({ type: TouchType.Up }); q.list.onTouch({ type: TouchType.Up });
  q.owner.viewState.reset('新查询');
  q.publish([book('a', { intro: '新查询结果', searchRequestId: 'query-two' })]);
  q.physicalRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(q.selected.length, 0, 'old pressed query identity is rejected');
  q.drain();
  assert.equal(q.owner.resultDataSource.totalCount(), 1);
  assert.equal(q.owner.resultDataSource.getData(0).book.intro, '新查询结果');
  assert.equal(q.owner.resultsDeferred, false);
});

scenario('metadata without geometry change performs zero scroll; realized displacement performs one scrollBy', () => {
  const f = fixture();
  f.publish([book('a', { sourceName: '仅标签更新' }), f.initial[1]]);
  assert.equal(f.frames.length, 1);
  const metadataFrames = f.drain();
  assert.deepEqual(f.scrollCalls, [], 'unchanged measured anchor has no scrollToIndex or scrollBy');
  assert.equal(metadataFrames, 1, 'realized metadata restoration needs only one measurement frame');
  assert.deepEqual(f.datasetCalls, [], 'metadata does not invalidate LazyForEach membership');
  f.publish([book('a', { intro: '引起其他行几何变化的metadata' }), f.initial[1]]);
  f.native.rects.set(0, { y: 251, height: 150 });
  assert.equal(f.drain(), 1);
  assert.deepEqual(f.scrollCalls, [['by', 0, 24]], 'only actual measured displacement causes one correction');
});

scenario('unrealized anchor uses one realization request and bounded measurement retries; stale callbacks are inert', () => {
  const f = fixture();
  f.native.rects.delete(0);
  f.owner.restoreCancelled = false; f.owner.scheduleScrollRestore();
  const frames = f.drain();
  assert.equal(frames, 3);
  assert.equal(f.scrollCalls.filter(call => call[0] === 'index').length, 1);
  assert.equal(f.scrollCalls.filter(call => call[0] === 'by').length, 0);
  assert.equal(f.frames.length, 0);
  assert.equal(f.owner.scrollRestored, true, 'unmeasurable anchor does not permanently suppress scroll-index tracking');
  f.list.onScrollIndex(1, 1);
  assert.equal(f.owner.viewState.anchorKey, 'online:b', 'subsequent actual scroll-index event captures a new anchor');
  assert.equal(f.owner.viewState.anchorIndex, 1);

  const g = fixture();
  g.owner.restoreCancelled = false; g.owner.scheduleScrollRestore();
  g.list.onTouch({ type: TouchType.Down });
  g.drain();
  assert.deepEqual(g.scrollCalls, [], 'native touch invalidates old restoration frame');
  const p = fixture();
  p.owner.restoreCancelled = false; p.owner.scheduleScrollRestore();
  p.owner.aboutToDisappear(); p.drain();
  assert.deepEqual(p.scrollCalls, [], 'retired page invalidates old restoration frame');
});

console.log(JSON.stringify({ result: 'PASS', cases,
  mode, productionSha256: createHash('sha256').update(productionSource).digest('hex'),
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  evidence: 'actual SDK-lowered production methods/handlers; actual publication/projection/data-source classes; explicit frame, lazy-realization and Scroller geometry ports',
  notProven: 'native pointer ordering, layout/paint frames, observed-object rendering, pixels, device interaction or user acceptance' }));
