// Only the approved list-header implementation: collapsible fixed filters,
// one session List, prefix notices, selection identity and scroll ownership.
// Standalone issue-local entry; no old probe/test module or device is executed.
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

const [{ compileTailConsumer, tailControls }, { boundedMembers }, { createArkUIPropertyRuntimeProbe },
  { readerFoundationTokens }, { readerTypographyRoles }, { resolveEtsLoaderRoot, virtualFilePath },
  { SearchPublication }, { SearchViewState }, { SearchResultProjection }, { searchBookSnapshot }, author, media, intro,
  { foundationControls, foundationSpecs, buttonSource }, readerFonts, geometry, metrics, floating] = await Promise.all([
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
  import('../../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts'),
  import('../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts'),
  import('../../../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts'),
]);

const productionSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const snapshotHelperSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchBookSnapshot.ts', import.meta.url), 'utf8');
const source = productionSource;
const viewStateSource = readFileSync(new URL('../../../entry/src/main/ets/features/search/SearchViewState.ts', import.meta.url), 'utf8');
const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const parse = text => ts.createSourceFile(virtualFilePath('SearchListHeader.ets'), text,
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
Object.assign(readerTypographyRoles, { ReaderTextStyle });
const controls = tailControls({ foundation, roles: { ReaderTextStyle } });
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
const dependencies = { ...controls.dependencies, ...foundation.dependencies, ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles, ...messageRoles,
  SynchedPropertyNesedObjectPU: properties.sdk.SynchedPropertyNestedObjectPU,
  ...author, ...media, ...intro, ...geometry, ...metrics, ...floating, SearchLayoutFrame, SearchBookGroup, SearchResultDataSource,
  SearchPublication, SearchViewState, SearchResultProjection, searchBookSnapshot, TouchType, SourceType, ScrollSource,
  SEARCH_LOCAL_SCOPE: '本地', SEARCH_ONLINE_SCOPE: '在线', registerReaderFonts() {},
  Edge: { Top: 'top' }, ScrollAlign: { START: 'start' }, Scroller: class {},
  ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: fontScale }) },
  Curve: { EaseInOut: 'Curve.EaseInOut' },
  // Native access-recording boundary used by the actual deferred ListItem
  // callback; the real SDK property observers remain the dependency owner.
  ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  // Realize the finite fixture's rows through the actual SDK-generated lazy
  // item Builder. Membership/removal, pointer dispatch and paint remain native.
  LazyForEach: { create(_id, owner, data, item, key) { mountFiniteLazy(owner, data, item, key); }, pop() {} },
};
require(sdk + '/lib/validate_ui_syntax.js').observedClassCollection.add('SearchBookGroup');
const hooks = { ...controls.hooks, ...foundation.hooks, ...properties.hooks, childSources: { ...controls.hooks.childSources, ReaderButton: buttonSource, ReaderPageState: pageStateSource, SearchResultCard: cardSource },
  mountChildren: true, lifecycleChildren: true, allowEmptyBranchAdmission: true };
// Native registration/removal is a finite port here, not a paint/layout
// implementation. The unmodified SDK chooses branches and child generators;
// retain/retire only their emitted node/observer/child registrations.
const activeNativeObservers = [], nativeBranchRecords = new WeakMap(), retiredObservers = new WeakMap();
const enterPropertyObserver = hooks.onObserverEnter, exitPropertyObserver = hooks.onObserverExit;
hooks.onObserverEnter = (owner, id) => {
  installNativeBranches(owner); activeNativeObservers.push({ owner, id }); enterPropertyObserver?.(owner, id);
};
hooks.onObserverExit = (owner, id) => { try { exitPropertyObserver?.(owner, id); } finally { activeNativeObservers.pop(); } };
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
// Whole current Page is lowered to preserve its real Builder call graph;
// only the four issue-local behaviors below are invoked/asserted. Compilation
// is not execution of another test suite or production network/business work.
const pageMembers = boundedMembers(source, 'SearchPage');
for (const name of ['searchHeader', 'filterProgressRow', 'toggleSearchFilters',
  'mainSearchNotices', 'stateContent', 'resultsContent', 'ownsPageQuery', 'ownsList'])
  assert.ok(pageMembers.includes(name), 'final production method ' + name);
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
  page = compileTailConsumer(source, pageMembers,
    { ...dependencies, SearchResultCard: card.Component }, hooks);
} finally { sdkCompiler.processComponentClass = actualProcessComponentClass; }
const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);
const textInputs = owner => nodes(owner).filter(node => ['Text', 'Span'].includes(node.type) && typeof node.create === 'string').map(node => node.create);
const lazyRecords = new WeakMap(), realizedItems = new WeakSet(), nativeBranchTransitions = [];
function difference(after, before) { return new Set([...after].filter(value => !before.has(value))); }
function retireRegistration(owner, record) {
  const retired = retiredObservers.get(owner);
  for (const id of record.children) {
    const child = owner.children.get(id); if (!child) continue;
    for (const nested of walk(child).reverse()) nested.aboutToDisappear?.();
    owner.children.delete(id);
  }
  for (const id of record.nodes) {
    const node = owner.nodes.get(id); node?.onDisAppear?.(); owner.nodes.delete(id); retired?.add(id);
  }
}
function captureRegistration(owner, generate) {
  const beforeNodes = new Set(owner.nodes.keys()), beforeChildren = new Set(owner.children.keys());
  generate();
  return { nodes: difference(new Set(owner.nodes.keys()), beforeNodes), children: difference(new Set(owner.children.keys()), beforeChildren) };
}
function installNativeBranches(owner) {
  if (nativeBranchRecords.has(owner)) return;
  const branches = new Map(); nativeBranchRecords.set(owner, branches);
  const retired = new Set(); retiredObservers.set(owner, retired);
  const replay = owner.replayOnly;
  owner.replayOnly = function(ids) {
    // A preceding branch observer may retire a later observer in this same
    // dirty delivery batch. Check native registration immediately per id.
    for (const id of ids) if (!retired.has(id)) replay.call(this, [id]);
  };
  owner.ifElseBranchUpdateFunction = function(branch, generate) {
    const active = activeNativeObservers.at(-1);
    assert.equal(active?.owner, this, 'native If registration belongs to actual SDK observer owner');
    const previous = branches.get(active.id);
    if (previous?.branch === branch) return;
    if (previous) { nativeBranchTransitions.push({ id: active.id, before: previous.branch, after: branch }); retireRegistration(this, previous); }
    const record = captureRegistration(this, generate); record.branch = branch; branches.set(active.id, record);
  };
}
function mountFiniteLazy(owner, data, item, key) {
  if (lazyRecords.has(data)) return;
  const rows = new Map();
  const reconcile = () => {
    const current = new Map();
    for (let index = 0; index < data.totalCount(); index++) {
      const value = data.getData(index); const identity = key ? key(value, index) : String(index); current.set(identity, { value, index });
    }
    for (const [identity, record] of rows) if (!current.has(identity)) { retireRegistration(owner, record); rows.delete(identity); }
    for (const [identity, entry] of current) if (!rows.has(identity)) rows.set(identity, captureRegistration(owner, () => item(entry.value, entry.index)));
  };
  lazyRecords.set(data, { owner, reconcile }); data.registerDataChangeListener({ onDatasetChange: reconcile }); reconcile();
}
function realizeDeferred(owner, context) {
  for (const current of walk(owner)) for (const [id, node] of [...current.nodes.entries()]) {
    if (node.type !== 'ListItem' || realizedItems.has(node)) continue;
    const render = Array.isArray(node.create) ? node.create[0] : node.create;
    if (typeof render !== 'function') continue;
    realizedItems.add(node);
    const created = captureRegistration(current, () => render(id, true));
    for (const record of nativeBranchRecords.get(current)?.values() ?? []) if (record.nodes.has(id)) {
      for (const value of created.nodes) record.nodes.add(value);
      for (const value of created.children) record.children.add(value);
    }
  }
  for (const current of walk(owner)) current.getUIContext = () => context;
}
const passed = [];
function scenario(name, run) { run(); passed.push(name); console.log('PASS ' + name); }
const operation = (generation = 1, retry = true, active = true) => ({ generation, canRetry: retry, canCancel: active });
function book(id, patch = {}) { return { sourceId: 'source-' + id, sourceName: '书源 ' + id, bookId: id, groupKey: id,
  title: '目标书 ' + id, author: '作者', category: 'novel', searchRequestId: 'query-one', intro: '原简介',
  admittedOrder: id === 'a' ? 0 : 1, coverUrl: 'https://fixture.invalid/' + id + '.jpg', ...patch }; }
const result = (books, patch = {}) => ({ kind: 'results', keyword: '目标书', results: books, searching: true,
  completedSourceCount: 76, totalSourceCount: 120, failedSourceCount: 0, skippedSourceCount: 0, operation: operation(), ...patch });
const notices = { localSearchFailed: true, localFailureMessage: '读取超时，请重试', failedSourceCount: 8, skippedSourceCount: 7 };
const presentation = (kind, books, patch = {}) => kind === 'results' ? result(books, patch) :
  { kind, keyword: '目标书', searchedSourceCount: 120, operation: operation(1, true, kind === 'loading'), ...patch };
function fixture({ kind = 'results', patch = {}, books = [book('a'), book('b')], width = 390, scale = 1,
  expanded = false, start = false, viewState, mode = 'session' } = {}) {
  fontScale = scale;
  const frames = [], scrollCalls = [], rectCalls = [], warmups = [], selected = [], retries = [], datasetCalls = [], animations = [], measureCalls = [], outboundCalls = [];
  const native = { y: start ? 0 : 137, measurable: true, rects: new Map([[0, { y: 0, height: 38 }],
    [1, { y: 180, height: 150 }], [2, { y: 330, height: 150 }]]) };
  const owner = new page.Component(undefined, { isTablet: width === 736, reduceMotion: true });
  const context = { getFont: () => ({}), postFrameCallback: frame => frames.push(frame),
    animateTo(options, action) { animations.push(options); action(); }, px2vp: value => value / 2,
    getMeasureUtils: () => ({ measureTextSize(input) { measureCalls.push(input); return { width: 100, height: 36 * scale }; } }) };
  owner.getUIContext = () => context; owner.contentFrame = () => ({ width, left: 0, right: 0 }); owner.searchBottomInset = () => 24;
  owner.resultScroller = {
    currentOffset: () => ({ yOffset: native.y }),
    getItemRect(index) { rectCalls.push(index); if (!native.measurable || !native.rects.has(index)) throw new Error('native row not measured'); return { ...native.rects.get(index) }; },
    scrollToIndex(index, ...args) { scrollCalls.push(['index', index, ...args]); if (index === 0) {
      native.y = 0; native.rects.set(0, { y: owner.searchContentStartInset(), height: 38 }); } },
    scrollBy(x, y) { scrollCalls.push(['by', x, y]); native.y += y;
      for (const [index, rect] of native.rects) native.rects.set(index, { ...rect, y: rect.y - y }); },
    scrollTo(value) { scrollCalls.push(['to', value]); native.y = value.yOffset; },
    scrollEdge(value) { scrollCalls.push(['edge', value]); },
  };
  if (viewState) owner.viewState = viewState; else owner.viewState.reset('目标书');
  owner.viewState.filtersExpanded = expanded;
  if (!viewState) { owner.viewState.anchorAtStart = start; owner.viewState.anchorKey = start ? '' : 'online:a';
    owner.viewState.anchorItemY = start ? 0 : 180; owner.viewState.anchorOffset = start ? 0 : 137; }
  owner.onVisibleGroups = groups => warmups.push(groups); owner.onSelectResult = (...args) => selected.push(args);
  owner.onSearch = (...args) => outboundCalls.push(['search', ...args]); owner.onStop = () => outboundCalls.push(['stop']);
  owner.onRetry = () => retries.push({ query: owner.viewState.revision, generation: owner.operation()?.generation });
  owner.publication.publish(presentation(kind, books, patch)); owner.aboutToAppear();
  owner.resultDataSource.registerDataChangeListener({ onDatasetChange: values => datasetCalls.push(values) });
  if (mode === 'header') owner.searchHeader(); else if (mode === 'full') owner.initialRender(); else owner.stateContent();
  realizeDeferred(owner, context);
  const list = nodes(owner).find(node => node.type === 'List');
  const nextFrame = () => { const frame = frames.shift(); assert.ok(frame, 'production frame pending'); frame.onIdle(16); };
  const drain = (limit = 12) => { let count = 0; while (frames.length) { assert.ok(count++ < limit, 'bounded production frames'); nextFrame(); } return count; };
  if (list) { list.onAppear(); drain(); }
  function flush() { properties.flush(child => walk(owner).includes(child)); realizeDeferred(owner, context); }
  function publish(nextKind = 'results', nextPatch = {}, nextBooks = books) {
    owner.publication.publish(presentation(nextKind, nextBooks, nextPatch)); owner.publicationRevision++;
  }
  const cards = () => walk(owner).filter(child => child instanceof card.Component);
  const initialScrollCalls = scrollCalls.slice();
  scrollCalls.length = 0; rectCalls.length = 0; datasetCalls.length = 0; warmups.length = 0;
  return { owner, context, list, frames, scrollCalls, rectCalls, warmups, selected, retries, datasetCalls, animations,
    measureCalls, native, books, cards, publish, flush, drain, nextFrame, initialScrollCalls, outboundCalls };
}
function toggleNode(f) { const node = nodes(f.owner).find(node => /^(展开|收起)筛选$/.test(node.accessibilityText ?? '') && typeof node.onClick === 'function');
  assert.ok(node, 'actual native filter toggle exists'); return node; }
function nativeCardRow(child) { const node = nodes(child).find(node => typeof node.onTouch === 'function' && typeof node.onClick === 'function'); assert.ok(node); return node; }
function click(child) { const node = nodes(child).find(node => typeof node.onClick === 'function'); assert.ok(node); node.onClick(); }

scenario('real filter toggle changes natural header/inset identity; stale receipts reject and body facts never enter the fixed panel', () => {
  for (const [width, scale] of [[390, 1], [320, 2], [320, 3.2]]) {
    const f = fixture({ mode: 'header', width, scale, patch: notices });
    const closedHeight = f.owner.searchHeaderHeight(), closedKey = f.owner.searchHeaderMeasurementKey();
    const labels = textInputs(f.owner);
    assert.ok(labels.includes('筛选')); assert.ok(!labels.includes('找到 ') && !labels.includes('搜索中'));
    assert.ok(!labels.some(value => /本地检索：|个书源搜索失败|近期不可用书源/.test(value)));
    assert.ok(!nodes(f.owner).some(node => node.type === 'Scroll'), 'collapsed fixed panel has no local progress Scroll');
    assert.ok(!labels.includes('来源') && !labels.includes('内容类型'), 'collapsed options have no native registrations');
    assert.equal(toggleNode(f).constraintSize.minHeight, 44);
    toggleNode(f).onClick(); f.flush();
    assert.equal(f.owner.filtersExpanded, true); assert.equal(f.owner.viewState.filtersExpanded, true);
    assert.ok(f.owner.searchHeaderHeight() > closedHeight); const openKey = f.owner.searchHeaderMeasurementKey(); assert.notEqual(openKey, closedKey);
    assert.ok(textInputs(f.owner).includes('来源') && textInputs(f.owner).includes('内容类型'));
    f.owner.acceptSearchHeaderHeight(closedHeight, closedKey);
    assert.equal(f.owner.fixedHeaderHeight, 0, 'old collapsed measurement cannot cover expanded filters');
    const measuredOpen = f.owner.searchHeaderHeight() + 2;
    f.owner.acceptSearchHeaderHeight(measuredOpen, openKey); assert.equal(f.owner.searchContentStartInset(), measuredOpen);
    toggleNode(f).onClick(); f.flush();
    assert.equal(f.owner.filtersExpanded, false); assert.equal(f.owner.viewState.filtersExpanded, false);
    assert.ok(!textInputs(f.owner).includes('来源') && !textInputs(f.owner).includes('内容类型'));
    f.owner.acceptSearchHeaderHeight(measuredOpen, openKey); assert.equal(f.owner.searchContentStartInset(), closedHeight);
    const before = f.owner.searchHeaderHeight();
    f.publish('results', { ...notices, completedSourceCount: 119, failedSourceCount: 88 }); f.flush();
    assert.equal(f.owner.searchHeaderHeight(), before, 'count/status/notice publication does not add fixed header rows');
    assert.ok(nodes(f.owner).filter(node => node.type === 'Text').some(node => String(node.create).includes('119/120')));
    assert.ok(nodes(f.owner).filter(node => node.type === 'Text' && /个书源/.test(String(node.create))).every(node =>
      node.height === undefined && node.maxLines === undefined && node.textOverflow === undefined), 'fixed progress row uses natural text, not clipping');
  }
});

scenario('loading/results/stopped/empty/error share one actual SDK List and permanent summary/notice prefix', () => {
  const f = fixture({ kind: 'loading', books: [], start: true }); const list = f.list;
  assert.ok(list); assert.equal(nodes(f.owner).filter(node => node.type === 'List').length, 1);
  const sharedScroller = f.owner.resultScroller;
  assert.ok(f.initialScrollCalls.some(call => call[0] === 'index' && call[1] === 0 && call[2] === false && call[3] === 'start'),
    'fresh query positions semantic native prefix START');
  const states = [
    ['results', { ...notices }, [book('a'), book('b')]],
    ['results', { ...notices, searching: false, stopped: true, operation: { ...operation(1, true, false), fact: 'cancelled' } }, [book('a'), book('b')]],
    ['empty', notices, []], ['error', notices, []],
  ];
  for (const [kind, patch, books] of states) {
    f.publish(kind, patch, books); f.flush(); f.drain();
    const lists = nodes(f.owner).filter(node => node.type === 'List'); assert.equal(lists.length, 1); assert.equal(lists[0], list);
    assert.equal(f.owner.resultScroller, sharedScroller); assert.equal(nodes(f.owner).filter(node => node.type === 'Scroll').length, 0);
    const items = [...f.owner.nodes.values()].filter(node => node.type === 'ListItem'); assert.equal(items[0].id, 'search-main-notices');
    const labels = textInputs(f.owner); assert.ok(labels.includes('找到 '));
    assert.ok(labels.includes('8 个书源搜索失败。') && labels.includes('已跳过 7 个近期不可用书源。'));
    assert.equal(labels.filter(value => value.includes('本地检索：')).length, 1, 'no duplicated error/detail message');
    assert.ok(!labels.includes(f.owner.searchProgressText()), 'the exact fixed progress line is not rendered again in the result header');
    assert.equal(walk(f.owner).filter(child => child.specId === 'search-retry-progress').length, 3);
  }
  assert.equal(f.scrollCalls.filter(call => call[0] === 'index' && call[1] === 0).length, 0, 'first-positioned query does not repeatedly return to top on publications');
});

scenario('filter height changes preserve measured book position; same scope is inert and type selection still resets once', () => {
  const f = fixture({ mode: 'full', expanded: false, books: [book('a'), book('b', { category: 'comic' })] });
  f.native.rects.set(1, { y: 60, height: 150 }); f.list.onScrollIndex(1, 2);
  const closed = f.owner.searchContentStartInset(), initialRevision = f.owner.viewState.revision;
  toggleNode(f).onClick(); f.flush(); const expanded = f.owner.searchHeaderHeight(), delta = expanded - closed;
  f.native.rects.set(1, { y: 60 + delta, height: 150 });
  const scaffold = walk(f.owner).find(child => child.variant === 'search' || child.params?.variant === 'search'); assert.ok(scaffold);
  const accept = scaffold.onHeaderHeightChange ?? scaffold.params.onHeaderHeightChange;
  accept(expanded, f.owner.searchHeaderMeasurementKey()); f.drain();
  assert.equal(f.owner.viewState.anchorKey, 'online:a'); assert.deepEqual(f.scrollCalls, [], 'native inset shift preserves measured relative position without a forced jump');
  toggleNode(f).onClick(); f.flush(); const collapsed = f.owner.searchHeaderHeight();
  f.native.rects.set(1, { y: 68, height: 150 });
  accept(collapsed, f.owner.searchHeaderMeasurementKey()); assert.equal(f.drain(), 1);
  assert.deepEqual(f.scrollCalls, [['by', 0, 8]], 'only an actual measured displacement is corrected once');
  f.scrollCalls.length = 0; f.owner.selectGroup(f.owner.selectedGroupName); f.drain();
  assert.deepEqual(f.scrollCalls, []); assert.equal(f.owner.viewState.anchorKey, 'online:a');
  f.owner.selectContentType('漫画'); f.flush(); f.drain();
  assert.equal(f.owner.viewState.revision, initialRevision); assert.equal(f.owner.viewState.contentType, '漫画');
  assert.deepEqual(f.outboundCalls, [], 'changing current content type filters admitted results without dispatching a new search');
  assert.equal(f.owner.visibleGroups.length, 1); assert.equal(f.owner.visibleGroups[0].book.bookId, 'b');
  assert.ok(f.scrollCalls.some(call => call[0] === 'index' && call[1] === 0), 'type change is not swallowed by the same selected scope');
});

scenario('pressed book identity survives publication; old page/query native scroll, IME, filter and stop callbacks cannot mutate the new owner', () => {
  const f = fixture(); const row = f.cards()[0], nativeRow = nativeCardRow(row); const displayed = row.displayBook();
  nativeRow.onTouch({ type: TouchType.Down }); f.list.onTouch({ type: TouchType.Down });
  f.publish('results', {}, [book('a', { bookId: 'replacement', sourceId: 'new-source' }), book('b')]); f.flush();
  assert.equal(f.owner.resultsDeferred, true);
  nativeRow.onTouch({ type: TouchType.Up }); f.list.onTouch({ type: TouchType.Up }); nativeRow.onClick({ source: SourceType.TouchScreen });
  assert.equal(f.selected.length, 1); assert.equal(f.selected[0][0].bookId, displayed.bookId); assert.equal(f.selected[0][0].sourceId, displayed.sourceId);
  f.drain(); f.flush(); assert.equal(f.owner.resultDataSource.getData(0).book.bookId, 'replacement');
  for (const boundary of ['query', 'page']) {
    const old = fixture({ mode: 'full', expanded: true }); const state = old.owner.viewState;
    const field = walk(old.owner).find(child => child.variant === 'bookPanel'); assert.ok(field);
    const input = nodes(field).find(node => node.type === 'TextInput'); assert.ok(input?.onChange && input?.onSubmit);
    const oldToggle = toggleNode(old).onClick;
    const optionActions = walk(old.owner).filter(child => child.specId === 'search-scope').map(child => () => click(child));
    const searchButton = walk(old.owner).find(child => String(child.specId).startsWith('search-field-')); assert.ok(searchButton);
    if (boundary === 'page') old.owner.aboutToDisappear();
    state.reset('新查询');
    const warmupsAfterRetirement = old.warmups.slice();
    const snapshot = { key: state.anchorKey, offset: state.anchorOffset, index: state.anchorIndex, atStart: state.anchorAtStart,
      neighbors: state.anchorNeighbors.slice(), revision: state.revision, keyword: state.keywordDraft, scope: state.category, type: state.contentType, filters: state.filtersExpanded };
    old.native.y = 377; old.list.onScroll(); old.list.onScrollIndex(2, 2); old.list.onAreaChange(); old.list.onScrollStop();
    input.onChange('旧输入'); input.onSubmit('Enter'); oldToggle(); for (const action of optionActions) action(); click(searchButton);
    old.owner.submitSearch(); old.owner.saveScrollAnchor(); old.drain();
    assert.deepEqual({ key: state.anchorKey, offset: state.anchorOffset, index: state.anchorIndex, atStart: state.anchorAtStart,
      neighbors: state.anchorNeighbors.slice(), revision: state.revision, keyword: state.keywordDraft, scope: state.category, type: state.contentType, filters: state.filtersExpanded }, snapshot,
      'retired ' + boundary + ' cannot write a reset ViewState or restart a query');
    assert.deepEqual(old.scrollCalls, []); assert.deepEqual(old.warmups, warmupsAfterRetirement);
    assert.deepEqual(old.outboundCalls, [], 'old native Stop/IME cannot dispatch current business intents');
  }
  const reset = new SearchViewState(); reset.filtersExpanded = true; reset.anchorAtStart = false; reset.anchorOffset = 99; reset.reset('新书');
  assert.equal(reset.filtersExpanded, false); assert.equal(reset.anchorAtStart, true); assert.equal(reset.anchorOffset, 0);
});

console.log(JSON.stringify({ result: 'PASS', cases: passed.length, passed,
  productionSha256: createHash('sha256').update(productionSource).digest('hex'),
  actualLoweredSourceSha256: createHash('sha256').update(source).digest('hex'),
  viewStateSha256: createHash('sha256').update(viewStateSource).digest('hex'),
  snapshotHelperSha256: createHash('sha256').update(snapshotHelperSource).digest('hex'), retainedWarnings,
  nativeBranchTransitionCount: nativeBranchTransitions.length,
  evidence: 'actual current SDK lowering/property observers/shared control native callbacks; finite native If/Lazy/deferred registrations and explicit geometry/measurement/frame ports',
  notProven: 'native pixels/fonts/layout/animation/scroll physics, full native node lifecycle, HAP or device/user acceptance' }));
