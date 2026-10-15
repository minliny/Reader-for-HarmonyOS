import * as directoryState from '../entry/src/main/ets/features/manga/MangaDirectoryState.ts';
import { mangaDirectoryDisplay } from '../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries, mangaDirectoryIsGroup } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import assert from 'node:assert/strict';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryColor } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import { readerDirectoryAccessibilityText } from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600 } from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { ReaderDirectoryNavigationGateway, openReaderDirectoryNavigation } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { mangaDirectoryEntryRows, mangaDirectoryLabel, mangaDirectoryNearbyEntries } from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { mangaDirectoryEntryRowSdk, mangaDirectoryEntryRowSource } from './lib/manga-directory-entry-row-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';

const path = fileURLToPath(new URL('../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets', import.meta.url));
const source = readFileSync(path, 'utf8');
const timers = [];
const deps = { ...directoryState, mangaDirectoryDisplay, visual, mangaDirectoryScale, mangaDirectoryColor, ReaderWindowCoordinator: {metrics: () => ({systemFontScale: 1})}, mangaDirectoryPresentation, mangaDirectoryVisibleEntries, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600, projectReaderDirectoryEntries, sameReaderDirectoryData, snapshotReaderDirectoryData,
  mangaDirectoryEntryRows, mangaDirectoryLabel, mangaDirectoryNearbyEntries,
  readerDirectoryAccessibilityText, LengthMetrics: { vp: value => ({ value }) }, ScrollAlign: { START: 'start', CENTER: 'center' },
  setTimeout(action) { timers.push(action); } };
const methods = ['aboutToAppear', 'aboutToDisappear', 'identity', 'admitEntries', 'publishProjection',
  'preparePresentation', 'rowPresentation', 'prepareLayout', 'fontScale', 'onViewportChanged', 'layoutEntryRows', 'layoutRow', 'showContext',
  'onLayoutInputsChanged', 'onCurrentChapterChanged', 'expandCurrentAncestors', 'onIdentityChanged', 'onEntriesChanged', 'onViewInputsChanged', 'onLocateCurrent', 'requestScroll', 'activeScroller',
  'onFirstLayout', 'onListFirstLayout', 'onListUserScroll', 'onUserScrollIntent', 'selectEntry', 'toggleBranch', 'downloadEntry'];
const Directory = productionMotionMethods(path, methods, deps);
const entries = Object.freeze(Array.from({ length: 681 }, (_, ordinal) => Object.freeze({
  index: ordinal * 2 + 1, title: `第${ordinal + 1}话`, navigable: ordinal !== 10, downloadState: 'unknown',
})));
function flush() { while (timers.length > 0) timers.shift()(); }
function fixture(initialEntries = entries) {
  const selected = [], scrolled = [];
  const owner = Object.assign(new Directory(), { sourceId: 'tencent', bookId: '531040', entries: initialEntries,
    query: '', ascending: true, currentChapterIndex: entries[679].index, locateCurrentRevision: 1,
    mangaScheme: 'day', rowHeight: 58, mangaCatalogDisplay: true, mangaCatalogNarrow: false, currentOpenInset: 50,
    projectedEntries: [], layoutRows: [], viewportWidth: 400, admittedEntries: [], admittedIdentity: '', mounted: false,
    listReady: false, scrollGeneration: 0, pendingScroll: undefined, presentation: new Map(), collapsedGroups: [],
    listScroller: { scrollToIndex: (...args) => scrolled.push(args) },
    onSelectChapter: index => selected.push(index), onOpenFullDirectory() {} });
  return { owner, selected, scrolled };
}

const hierarchy = Object.freeze([
  { index: 7, title: '组甲', level: 1, navigable: false },
  { index: 11, title: '第1话', level: 2, navigable: true },
  { index: 17, title: '子组甲', level: 2, navigable: false },
  { index: 23, title: '第2话', level: 3, navigable: true },
  { index: 29, title: '第3话', level: 2, navigable: true },
  { index: 41, title: '组乙', level: 1, navigable: false },
  { index: 53, title: '第4话', level: 2, navigable: true },
  { index: 67, title: '没有层级的禁用卷字', navigable: false },
  { index: 79, title: '未知父节点的章节', level: 2, navigable: true },
  { index: 83, title: '只有卷字没有子节点', level: 1, navigable: false },
].map(entry => Object.freeze(entry)));
{
  const { owner, selected, scrolled } = fixture(hierarchy);
  owner.currentChapterIndex = 23;
  owner.aboutToAppear(); owner.onFirstLayout(); flush();
  assert.equal(owner.rowPresentation(hierarchy[0]).readableDescendantCount, 3);
  assert.deepEqual(owner.rowPresentation(hierarchy[3]).ancestorGroupIndexes, [7, 17]);
  owner.toggleBranch(owner.projectedEntries.find(row => row.index === hierarchy[2].index), owner.identity());
  assert.deepEqual(owner.collapsedGroups, [17]);
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 11, 17, 29, 41, 53, 67, 79, 83]);
  owner.toggleBranch(hierarchy[0], owner.identity());
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 41, 53, 67, 79, 83]);
  assert.deepEqual(selected, [], 'an explicit group is a fold action and never a chapter target');
  owner.selectEntry(hierarchy[3], owner.identity());
  assert.deepEqual(selected, [], 'a collapsed child loses selection authority');
  owner.toggleBranch(hierarchy[0], owner.identity());
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 11, 17, 29, 41, 53, 67, 79, 83],
    'reopening an outer group retains its nested group preference');
  owner.query = '第2'; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [23], 'search sees a hidden canonical target');
  assert.equal(owner.rowPresentation(hierarchy[3]).parentTitle, '子组甲');
  assert.equal(owner.rowPresentation(hierarchy[0]).readableDescendantCount, 3, 'fold and query do not truncate full-tree counts');
  owner.selectEntry(owner.projectedEntries[0], owner.identity()); assert.deepEqual(selected, [23]);
  owner.query = ''; owner.onViewInputsChanged(); flush();
  owner.toggleBranch(hierarchy[0], owner.identity());
  owner.ascending = false; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [83, 79, 67, 53, 41, 7], 'descending order preserves canonical indexes');
  owner.onLocateCurrent(); flush();
  assert.deepEqual(owner.collapsedGroups, [], 'locate expands exactly the current target ancestors');
  assert.deepEqual(scrolled.at(-1), [6, true, 'start', { extraOffset: { value: -12 } }]);
  owner.selectEntry(owner.projectedEntries.find(row => row.index === hierarchy[4].index), owner.identity()); assert.deepEqual(selected, [23, 29]);
  owner.selectEntry(hierarchy[7], owner.identity());
  owner.selectEntry(hierarchy[9], owner.identity());
  assert.deepEqual(owner.collapsedGroups, [], 'disabled rows without explicit children cannot manufacture groups');
  assert.deepEqual(selected, [23, 29]);
  owner.onViewInputsChanged();
  owner.toggleBranch(hierarchy[0], owner.identity());
  const before = scrolled.length; flush();
  assert.equal(scrolled.length, before, 'fold cancels pending automatic scroll work');
  assert.deepEqual(hierarchy.map(entry => entry.index), [7, 11, 17, 23, 29, 41, 53, 67, 79, 83]);
  owner.aboutToDisappear(); flush();
}
{
  const { owner, selected } = fixture(hierarchy);
  owner.aboutToAppear(); flush();
  owner.toggleBranch(hierarchy[0], owner.identity());
  const originalIdentity = owner.identity();
  const expandedCatalog = [...hierarchy.slice(0, 4), { index: 27, title: '新增话', level: 3, navigable: true }, ...hierarchy.slice(4)];
  owner.entries = expandedCatalog;
  owner.toggleBranch(hierarchy[0], originalIdentity);
  assert.deepEqual(owner.collapsedGroups, [7], 'a callback cannot fold before changed catalog data is admitted');
  owner.onEntriesChanged();
  assert.deepEqual(owner.collapsedGroups, [7], 'an unchanged admitted group can retain its display preference');
  assert.equal(owner.rowPresentation(hierarchy[0]).readableDescendantCount, 4);
  owner.entries = expandedCatalog.map(entry => entry.index === 7 ? { ...entry, title: '不同组甲' } : entry);
  owner.onEntriesChanged();
  assert.deepEqual(owner.collapsedGroups, [], 'changed exact group identity clears an old collapse preference');
  owner.toggleBranch(hierarchy[0], originalIdentity);
  assert.deepEqual(owner.collapsedGroups, [], 'an old equal-index row cannot fold the renamed group');
  owner.toggleBranch(owner.projectedEntries[0], owner.identity());
  assert.deepEqual(owner.collapsedGroups, [7]);
  owner.sourceId = 'different-source'; owner.onIdentityChanged();
  assert.deepEqual(owner.collapsedGroups, [], 'collapse state belongs to one source/book');
  owner.toggleBranch(owner.projectedEntries[0], originalIdentity);
  assert.deepEqual(owner.collapsedGroups, []);
  owner.entries = [{ index: 7, title: '不是分组', level: 1, navigable: true }]; owner.onEntriesChanged();
  owner.selectEntry(owner.projectedEntries[0], owner.identity());
  assert.deepEqual(selected, [7], 'a reused canonical index is admitted by its current target facts');
  owner.aboutToDisappear(); flush();
}

// A real v2 miss is a flat-list admission, not proof that the canonical TOC is missing.
const requests = [];
const gateway = new ReaderDirectoryNavigationGateway({
  supportsCoreCapability: capability => capability === 'reading.directory.view.v2',
  request: async (method, params) => {
    requests.push({ method, params });
    return { data: { status: 'unavailable', reason: 'navigationMissingOrStale' } };
  },
});
assert.equal(await openReaderDirectoryNavigation(gateway, { sourceId: 'tencent', bookId: '531040' }, () => true), undefined);
assert.equal(requests[0].method, 'reading.directory.view.open.v2');
{
  const { owner, selected, scrolled } = fixture();
  owner.aboutToAppear(); flush();
  assert.equal(owner.projectedEntries.length, 681);
  assert.deepEqual(scrolled, [], 'a timer is not evidence that the native List has mounted');
  owner.onFirstLayout(); flush();
  assert.deepEqual(scrolled.at(-1), [171, false, 'start', { extraOffset: { value: -50 } }], 'locate uses visible rank of the original chapter index');
  owner.onLocateCurrent(); flush();
  assert.deepEqual(scrolled.at(-1), [171, true, 'start', { extraOffset: { value: -12 } }],
    'explicit manga locate uses the demo smooth top inset without replacing chapter identity');
  owner.selectEntry(owner.projectedEntries[679], owner.identity());
  assert.deepEqual(selected, [1359], 'flat selection preserves the exact sparse Core index');
  owner.selectEntry(owner.projectedEntries[10], owner.identity());
  assert.deepEqual(selected, [1359], 'a disabled canonical row never becomes a chapter target');
  const oldRow = owner.projectedEntries[0];
  owner.query = ' 第68 '; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [135, 1359, 1361]);
  owner.selectEntry(oldRow, owner.identity());
  assert.deepEqual(selected, [1359], 'callbacks from filtered-out rows lose target authority');
  owner.ascending = false; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [1361, 1359, 135]);
  assert.equal(entries[0].index, 1, 'search and sort never mutate the canonical TOC');
  owner.query = 'not found'; owner.onViewInputsChanged(); flush();
  assert.equal(owner.projectedEntries.length, 0);
  owner.query = ''; owner.onViewInputsChanged();
  owner.onLocateCurrent(); owner.onUserScrollIntent();
  const before = scrolled.length; flush();
  assert.equal(scrolled.length, before, 'user scroll cancels delayed locate');
  owner.onLocateCurrent(); owner.aboutToDisappear(); flush();
  assert.equal(scrolled.length, before, 'unmounted directories reject delayed scroll work');
}
{
  const { owner, selected, scrolled } = fixture([]);
  owner.aboutToAppear(); owner.onFirstLayout(); flush();
  assert.equal(owner.projectedEntries.length, 0);
  owner.entries = entries; owner.onEntriesChanged(); flush();
  assert.equal(owner.projectedEntries.length, 681, 'late canonical TOC replaces the empty fallback');
  assert.deepEqual(scrolled.at(-1), [171, false, 'start', { extraOffset: { value: -50 } }]);
  const original = owner.projectedEntries[0], oldIdentity = owner.identity();
  owner.entries = [{ ...original, title: 'new catalog title' }];
  owner.selectEntry(original, oldIdentity);
  assert.deepEqual(selected, [], 'changed Host data rejects stale callbacks before the Watch admits it');
  owner.onEntriesChanged();
  owner.selectEntry(original, oldIdentity);
  assert.deepEqual(selected, [], 'equal indexes do not preserve old catalog row authority');
  owner.selectEntry(owner.projectedEntries[0], oldIdentity);
  assert.deepEqual(selected, [1]);
  owner.sourceId = 'other-source'; owner.onIdentityChanged();
  owner.selectEntry(original, oldIdentity);
  assert.deepEqual(selected, [1], 'old source callbacks cannot select an equal-index row');
  owner.aboutToDisappear(); flush();
}

// Compile the shared production child as well as the owning fallback. The
// native List seam retains its actual params/callbacks without simulating layout.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const listSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryList.ets', import.meta.url), 'utf8');
syntax.componentCollection.customComponents.add('ReaderDirectoryList');
syntax.propCollection.set('ReaderDirectoryList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const builderNames = ['build', 'row', 'mangaColor', 'emptyState', 'emptyActionLabel'];
const stateNames = ['presentation', 'collapsedGroups', 'projectedEntries', 'layoutRows', 'viewportWidth',
  'rowHeight', 'mangaCatalogDisplay', 'mangaCatalogNarrow', 'currentChapterIndex', 'query'];
function parentProbe(candidate = source, childCandidate = mangaDirectoryEntryRowSource) {
  const shared = mangaDirectoryEntryRowSdk({ source: childCandidate, dependencies: { ...deps, ReaderDirectoryList: Child } });
  const built = createReaderBuilderProbe(candidate, [...new Set([...methods, ...builderNames, ...stateNames])], shared.deps, shared.hooks);
  return { ...built, shared };
}
function sharedRow(owner) { return [...owner.children.values()].find(child => child.nodes); }
function nativeList(owner) { return [...owner.children.values()].find(child => child.params); }
{
  const { owner, shared } = parentProbe();
  const state = fixture(); Object.assign(owner, state.owner);
  owner.aboutToAppear(); flush(); owner.initialRender();
  const list = nativeList(owner);
  assert.equal(list.params.entries.length, 172, 'recognized numeric chapter labels use compact rows without dropping canonical chapters');
  assert.deepEqual(owner.layoutRows.flatMap(row => row.entries.map(entry => entry.index)), entries.map(entry => entry.index), 'all 681 canonical targets remain present');
  assert.equal(list.params.naturalRowHeight, true); assert.equal(list.params.rowHeight, 44);
  assert.equal(list.params.listPaddingBottom, 18, 'full catalog owns its 18vp native scroll tail');
  assert.ok(!shared.nodes(owner).some(node => node.border?.width?.top === 1), 'viewport has no stationary top border');
  owner.query = '第681'; owner.onViewInputsChanged(); flush(); shared.properties.flush();
  assert.equal(nativeList(owner), list, 'query retains the native List owner');
  assert.deepEqual(list.params.entries.map(entry => entry.index), [1361]);
  list.params.rowBuilder({ item: list.params.entries[0], index: 0 });
  const nodes = shared.nodes(owner);
  const action = nodes.find(node => node.onClick && node.accessibilityText === '第681话，打开章节');
  assert.ok(action); action.onClick(); assert.equal(state.selected.at(-1), 1361);
  const title = nodes.find(node => node.type === 'Text' && node.create === '第681话');
  assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22); assert.equal(title.maxLines, undefined);
  owner.aboutToDisappear(); flush();
}
for (const scheme of ['day', 'night'])
for (const navigable of [false, true, undefined])
for (const current of [false, true]) {
  const shared = mangaDirectoryEntryRowSdk();
  const entry = { index: 5, title: '长章节标题不截断', level: 2, navigable, downloadState: 'unknown' };
  const presentation = mangaDirectoryPresentation([entry]);
  const owner = new shared.deps.MangaDirectoryEntryRow(undefined, {
    row: mangaDirectoryEntryRows([entry], presentation)[0], presentation, scheme,
    currentChapterIndex: current ? 5 : -1, query: '', branchControlsEnabled: true,
  }, undefined, -1);
  owner.initialRender();
  const nodes = shared.nodes(owner), row = nodes.find(node => node.type === 'Row'), title = nodes.find(node => node.type === 'Text');
  const active = navigable !== false && current;
  assert.equal(row.constraintSize.minHeight, 58); assert.equal(row.padding.left, 26);
  assert.equal(row.border.width.bottom, 1); assert.equal(row.borderRadius, undefined);
  assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22); assert.equal(title.maxLines, undefined);
  assert.deepEqual(title.fontWeight, [active ? 550 : 400, {enableVariableFontWeight: true}]);
  assert.equal(title.fontFamily, active ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  assert.equal(title.fontColor, active ? (scheme === 'night' ? '#B9CEB1' : '#425D45') :
    (scheme === 'night' ? '#EAE7DE' : '#1F1B17'));
  assert.equal(row.opacity, navigable === false ? .36 : 1);
  assert.equal(row.backgroundColor, active ? (scheme === 'night' ? '#303C2D' : '#E8EDE2') : 'Color.Transparent');
  assert.equal(nodes.some(node => node.type === 'Image'), navigable === true && !current);
  if (navigable === undefined) assert.ok(nodes.some(node => node.type === 'Text' && node.create === '状态待确认'));
}
// Mount the unchanged shared List, its actual data source and the owner's
// deferred empty slot. Native scheduling/layout is never reconstructed.
const ts = require(`${sdk}/node_modules/typescript`);
const listTree = ts.createSourceFile('/tmp/FallbackNativeList.ets', listSource, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const dataSourceDeclaration = listTree.statements.find(node => node.name?.getText(listTree) === 'DirectoryListDataSource');
const DirectoryListDataSource = new Function('sameReaderDirectoryData', 'snapshotReaderDirectoryData',
  `${stripTypeScriptTypes(dataSourceDeclaration.getText(listTree))}; return DirectoryListDataSource;`)
  (sameReaderDirectoryData, snapshotReaderDirectoryData);
class ChildrenMainSize { constructor(size) { this.childDefaultSize = size; } }
function actualListProbe(candidate = source, scale = 1, listCandidate = listSource) {
  const shared = mangaDirectoryEntryRowSdk({ dependencies: { ...deps, DirectoryListDataSource, ChildrenMainSize,
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: scale }) } } });
  const hooks = { ...shared.hooks, childSources: { ...shared.hooks.childSources, ReaderDirectoryList: listCandidate } };
  const ActualList = createReaderBuilderProbe(listCandidate, boundedMembers(listCandidate), shared.deps, hooks).Component;
  shared.deps.ReaderDirectoryList = class extends ActualList {
    constructor(owner, params, storage, id) { super(owner, params, storage, id); this.params = params; }
    updateStateVars(params) { super.updateStateVars(params); Object.assign(this.params, params); }
  };
  const built = createReaderBuilderProbe(candidate,
    [...new Set([...methods, ...builderNames, ...stateNames, 'windowMetricsRevision'])], shared.deps, hooks);
  const list = () => [...built.owner.children.values()].find(child => child.nodes &&
    [...child.nodes.values()].some(node => node.type === 'List'));
  const viewport = () => [...list().nodes.values()].find(node => node.type === 'List');
  return { ...built, shared, list, viewport };
}
function checkExternalScroller(candidate = source) {
  const probe = actualListProbe(candidate), { owner, shared } = probe;
  const state = fixture(); const externalScrolls = [], external = { scrollToIndex: (...args) => externalScrolls.push(args) };
  let firstLayouts = 0, userScrolls = 0;
  Object.assign(owner, state.owner, { scroller: external, onListFirstLayout: () => firstLayouts++, onListUserScroll: () => userScrolls++ });
  owner.aboutToAppear(); flush(); owner.initialRender();
  const list = probe.list(), viewport = probe.viewport();
  assert.equal(list.scroller, external, 'Full tools and actual fallback List use the supplied native Scroller');
  assert.equal(viewport.create.scroller, external);
  viewport.onAreaChange({}, { width: 393, height: 220 }); shared.properties.flush(); flush();
  assert.equal(firstLayouts, 1, 'the actual first native layout notifies Full interaction readiness');
  assert.equal(externalScrolls.at(-1)[0], 171, 'initial current position also uses the supplied Scroller');
  assert.deepEqual(state.scrolled, [], 'the private default does not receive external viewport commands');
  viewport.onAreaChange({}, { width: 390, height: 220 }); shared.properties.flush(); flush();
  assert.equal(firstLayouts, 1, 'ordinary viewport resize never repeats first-layout admission');
  owner.pendingScroll = 'current'; viewport.onWillStartDragging(); shared.properties.flush(); flush();
  assert.equal(userScrolls, 1, 'actual native List drag notifies the existing outer interaction shield');
  assert.equal(owner.pendingScroll, undefined, 'the same drag cancels pending internal positioning');
  owner.aboutToDisappear(); flush();
}
checkExternalScroller();
for (const [name, candidate, failure] of [
  ['lost external scroll owner', source.replace('return this.scroller ?? this.listScroller;', 'return this.listScroller;'), /supplied native Scroller/],
  ['lost user scroll callback', source.replace('    this.onListUserScroll();', ''), /outer interaction shield/],
  ['lost interaction ready callback', source.replace('    this.onListFirstLayout();', ''), /notifies Full interaction readiness/],
]) {
  assert.notEqual(candidate, source, name); assert.throws(() => checkExternalScroller(candidate), failure, name);
}

function checkEmpty(candidate = source, listCandidate = listSource, exhaustive = true) {
  for (const scheme of exhaustive ? ['day', 'night'] : ['night'])
  for (const scale of exhaustive ? [1, 3.2] : [3.2])
  for (const catalog of exhaustive ? [false, true] : [false]) {
    const probe = actualListProbe(candidate, scale, listCandidate), { owner, shared } = probe;
    let clears = 0;
    const state = fixture(); Object.assign(owner, state.owner, { mangaScheme: scheme, mangaCatalogDisplay: catalog,
      query: '没有此章节', windowMetricsRevision: 0, onClearSearch: () => clears++ });
    owner.aboutToAppear(); flush(); owner.initialRender();
    assert.equal([...owner.nodes.values()].some(node => node.type === 'Text'), false,
      'empty text is mounted only by the native scroll-content slot, never a stationary overlay');
    const list = probe.list(), viewport = probe.viewport();
    assert.equal(list.scroller, owner.listScroller); assert.equal(viewport.create.scroller, owner.listScroller);
    assert.equal(viewport.contentStartOffset, 0); assert.equal(viewport.contentEndOffset, catalog ? 18 : 14);
    const item = [...list.nodes.values()].find(node => node.type === 'ListItem');
    assert.ok(item, 'empty fallback has the actual shared deferred ListItem');
    assert.equal(typeof item.create[0], 'function'); item.create[0](item.id, true);
    const nodes = [...owner.nodes.values()], empty = nodes.find(node => node.type === 'Column');
    const message = nodes.find(node => node.type === 'Text' && node.create === '没有匹配的章节');
    assert.ok(message); assert.deepEqual([message.fontSize, message.lineHeight, message.halfLeading], [12, 18, true]);
    assert.equal(message.maxFontScale, scale); assert.equal(message.textAlign, 'TextAlign.Center');
    assert.equal(message.fontColor, mangaDirectoryColor('muted', scheme));
    assert.deepEqual(empty.create, { space: 8 }); assert.deepEqual(empty.constraintSize, { minHeight: 164 });
    assert.deepEqual(empty.padding, { left: 12, right: 12, top: 36, bottom: 36 });
    assert.deepEqual(empty.border, { width: { top: 1 }, color: mangaDirectoryColor('line', scheme) });
    const label = nodes.find(node => node.type === 'Text' && node.create === '清除搜索');
    assert.deepEqual([label.fontSize, label.lineHeight, label.maxFontScale], [12, 18, scale]);
    const clear = nodes.find(node => node.accessibilityText === '清除目录搜索');
    assert.equal(clear.height, undefined, 'enlarged clear action has a natural line box');
    assert.deepEqual(clear.constraintSize, { minHeight: 36 });
    assert.equal(clear.opacity, 1); assert.equal(clear.focusable, true);
    assert.deepEqual(clear.focusBox, { strokeWidth: { value: 2 }, strokeColor: { color: mangaDirectoryColor('accent', scheme) },
      margin: { value: 3 } }, 'actual action consumes the same platform focus/press palette');
    clear.onClick(); assert.equal(clears, 1);
    viewport.onAreaChange({}, { width: 353, height: 200 }); shared.properties.flush();
    assert.equal(probe.list(), list); assert.equal(probe.viewport(), viewport, 'the empty viewport remains the native scroll owner');
    owner.aboutToDisappear(); flush();
  }
}
checkEmpty();
for (const [label, candidate, listCandidate, failure] of [
  ['lost shared slot', source, listSource.replace('this.naturalRowHeight && this.entries.length === 0', 'false'), /actual shared deferred ListItem/],
  ['lost clear port', source.replace('.onClick((): void => this.onClearSearch())', '.onClick((): void => {})'), listSource, /strictly equal/],
  ['fixed clear height', source.replace('.constraintSize({ minHeight: visual.quietEmptyClearHeight })', '.height(visual.quietEmptyClearHeight)'), listSource, /natural line box/],
  ['missing clear feedback', source.replaceAll('.attributeModifier(new MangaDirectoryPressFeedback(true, true, this.mangaScheme))', ''), listSource, /strictly equal/],
]) {
  assert.ok(candidate !== source || listCandidate !== listSource, label);
  assert.throws(() => checkEmpty(candidate, listCandidate, false), failure, `reject ${label}`);
}
{
  const probe = actualListProbe(), { owner } = probe; let opens = 0;
  Object.assign(owner, fixture([]).owner, { onOpenFullDirectory: () => opens++ });
  owner.aboutToAppear(); flush(); owner.initialRender();
  const item = [...probe.list().nodes.values()].find(node => node.type === 'ListItem'); item.create[0](item.id, true);
  const action = [...owner.nodes.values()].find(node => node.type === 'Button');
  assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === '打开完整目录'));
  assert.equal(action.height, undefined); assert.deepEqual(action.constraintSize, { minHeight: 44 });
  action.onClick(); assert.equal(opens, 1, 'no-data fallback keeps the existing full-directory business action');
  const list = probe.list(); owner.entries = entries; owner.onEntriesChanged(); probe.shared.properties.flush();
  assert.equal(probe.list(), list); assert.equal(list.entries.length, 172, 'late canonical data keeps the same native List with compact display rows');
  owner.aboutToDisappear(); flush();
}
const responsiveParts = [{ index: 7, title: '41 上', navigable: true },
  { index: 19, title: '41 中', navigable: true }, { index: 31, title: '41 下', navigable: true }];
function checkViewport(candidate = source) {
  for (const [initial, next, expected] of [[580, 1000, [3]], [1000, 580, [1, 1, 1]], [0, 353, [1, 1, 1]]]) {
    const probe = actualListProbe(candidate, 3.2), { owner } = probe;
    Object.assign(owner, fixture(responsiveParts).owner, { viewportWidth: initial, windowMetricsRevision: 0 });
    owner.aboutToAppear(); flush(); owner.initialRender();
    const list = probe.list(), viewport = probe.viewport(); list.layoutReady = true;
    owner.scrollGeneration = 37; owner.pendingScroll = 'current';
    const identity = owner.admittedIdentity, projection = owner.projectedEntries;
    viewport.onAreaChange({}, { width: next, height: 200 }); probe.shared.properties.flush();
    assert.deepEqual(owner.layoutRows.map(row => row.columns), expected, 'actual SDK width callback refreshes same-side and first-positive columns');
    assert.equal(owner.admittedIdentity, identity); assert.equal(owner.projectedEntries, projection);
    assert.deepEqual(owner.layoutRows.flatMap(row => row.entries.map(entry => entry.index)), [7, 19, 31]);
    assert.equal(probe.list(), list); assert.equal(probe.viewport(), viewport); assert.equal(list.scroller, owner.listScroller);
    assert.equal(owner.scrollGeneration, 37); assert.equal(owner.pendingScroll, 'current');
    const rows = owner.layoutRows;
    viewport.onAreaChange({}, { width: next + .05, height: 250 }); probe.shared.properties.flush();
    assert.equal(owner.layoutRows, rows, 'subpixel jitter and height-only changes do not republish row geometry');
    for (const invalid of [0, -1, NaN, Infinity]) list.params.onViewportChanged(invalid, 250);
    assert.equal(owner.layoutRows, rows); assert.equal(owner.viewportWidth, next);
    owner.aboutToDisappear(); flush();
  }
}
checkViewport();
const staleWidth = source.replace('if (!this.mounted || !Number.isFinite(width) || width <= 0 || Math.abs(width - this.viewportWidth) <= 0.1) return;\n    this.viewportWidth = width;\n    this.prepareLayout();',
  'const wasNarrow = this.viewportWidth > 0 && this.viewportWidth <= 340;\n    this.viewportWidth = width;\n    if (wasNarrow !== (width > 0 && width <= 340)) this.prepareLayout();');
assert.notEqual(staleWidth, source);
assert.throws(() => checkViewport(staleWidth), /refreshes same-side/, 'old breakpoint-only update fails the real native callback matrix');

// Retained SDK-emitted parent/child Prop delivery updates the arrow in place.
function checkRetainedGroupFold(candidate = source, childCandidate = mangaDirectoryEntryRowSource, scheme = 'day') {
  const { owner, shared } = parentProbe(candidate, childCandidate);
  const state = fixture(hierarchy); Object.assign(owner, state.owner, { mangaScheme: scheme, currentChapterIndex: 23 });
  owner.aboutToAppear(); flush(); owner.initialRender();
  const list = nativeList(owner); list.params.rowBuilder({ item: list.params.entries[0], index: 0 });
  const child = sharedRow(owner), nodes = shared.nodes(child);
  const group = nodes.find(node => node.type === 'Row'), action = nodes.find(node => node.type === 'Row' && node.onClick);
  const arrow = nodes.find(node => node.type === 'Image'), disclosure = nodes.find(node => node.type === 'Stack' && node.onClick);
  const count = nodes.find(node => node.type === 'Text' && node.create === '3 个可读条目');
  assert.equal(action.enabled, true, 'a proved canonical group admits its fold action');
  assert.equal(group.constraintSize.minHeight, 48); assert.equal(group.backgroundColor, scheme === 'night' ? '#30342D' : '#F0ECE3');
  assert.ok(count, 'expanded count comes from the full admitted catalog');
  assert.equal(arrow.create, scheme === 'night' ? 'app.media.manga_sheet_chevron_down_theme_night' : 'app.media.manga_sheet_chevron_down');
  assert.equal(arrow.width, 16); assert.equal(arrow.height, 16);
  assert.deepEqual(arrow.rotate, { angle: 0 }); assert.deepEqual(arrow.animation, { duration: 180, curve: 'ease' });
  const actorCount = child.observers.length;
  action.onClick(); shared.properties.flush();
  assert.equal(nativeList(owner), list); assert.equal(sharedRow(owner), child, 'fold retains the SDK shared row child');
  assert.deepEqual(list.params.entries.map(entry => entry.index), [7, 41, 53, 67, 79, 83]);
  assert.deepEqual(arrow.rotate, { angle: -90 }, 'observed collapse updates the retained arrow actor');
  assert.equal(action.accessibilityText, '组甲，分组，已折叠');
  assert.equal(count.create, '3 个可读条目'); assert.deepEqual(state.selected, []);
  assert.equal(child.observers.length, actorCount, 'fold retains every existing group actor');
  disclosure.onClick(); shared.properties.flush();
  assert.deepEqual(arrow.rotate, { angle: 0 }); assert.equal(action.accessibilityText, '组甲，分组，已展开');
  assert.equal(list.params.entries.length, hierarchy.length);
  owner.aboutToDisappear(); action.onClick(); shared.properties.flush();
  assert.deepEqual(Array.from(owner.collapsedGroups), [], 'unmounted child callback cannot change owner state');
  return shared.properties.source;
}
function checkRetainedNamed(candidate = mangaDirectoryEntryRowSource) {
  const shared = mangaDirectoryEntryRowSdk({ source: candidate });
  const entry = { index: 11, title: '起始章节', level: 2, navigable: true, downloadState: 'unknown' };
  const presentation = mangaDirectoryPresentation([entry]);
  const owner = new shared.deps.MangaDirectoryEntryRow(undefined, { row: mangaDirectoryEntryRows([entry], presentation)[0],
    presentation, scheme: 'day', currentChapterIndex: 11 }, undefined, -1);
  owner.initialRender();
  const nodes = shared.nodes(owner), row = nodes.find(node => node.type === 'Row'), title = nodes.find(node => node.type === 'Text' && node.create === '起始章节');
  const actors = [...owner.observers];
  assert.equal(title.fontFamily, READER_FONT_NOTO_SANS_SC_UI_550); assert.deepEqual(title.fontWeight, [550, {enableVariableFontWeight: true}]);
  owner.currentChapterIndex = -1; shared.properties.flush();
  assert.equal(title.fontFamily, READER_FONT_NOTO_SANS_SC_UI_REGULAR, 'retained current face returns to regular');
  owner.currentChapterIndex = 11; shared.properties.flush(); assert.equal(title.fontFamily, READER_FONT_NOTO_SANS_SC_UI_550);
  owner.query = '第1'; shared.properties.flush(); assert.equal(row.padding.left, 10, 'search targets use a flat inset');
  owner.query = ''; shared.properties.flush(); assert.equal(row.padding.left, 26);
  assert.deepEqual(owner.observers, actors, 'current/search changes keep the same named actors');
}
function checkRetainedCatalog(candidate = source) {
  const { owner, shared } = parentProbe(candidate);
  const state = fixture(hierarchy); Object.assign(owner, state.owner, { currentChapterIndex: 23 });
  owner.aboutToAppear(); flush(); owner.initialRender();
  const list = nativeList(owner); list.params.rowBuilder({ item: list.params.entries[1], index: 1 });
  const child = sharedRow(owner); assert.equal(child.branchControlsEnabled, true);
  owner.mangaCatalogDisplay = false; shared.properties.flush(); flush();
  assert.equal(child.branchControlsEnabled, false, 'retained catalog Prop changes child branch policy');
  assert.equal(list.params.listPaddingBottom, 14);
  owner.mangaCatalogDisplay = true; shared.properties.flush(); flush();
  assert.equal(child.branchControlsEnabled, true); assert.equal(list.params.listPaddingBottom, 18);
  owner.aboutToDisappear(); flush();
}
checkRetainedNamed(); checkRetainedCatalog();
const plainCurrent = mangaDirectoryEntryRowSource.replace('@Prop currentChapterIndex:', 'currentChapterIndex:');
assert.notEqual(plainCurrent, mangaDirectoryEntryRowSource);
assert.throws(() => checkRetainedNamed(plainCurrent), /retained current face/, 'negative control detects lost child Prop scheduling');
const capturedCurrent = mangaDirectoryEntryRowSource.replaceAll('this.current(entry) ? READER_FONT_NOTO_SANS_SC_UI_550', 'true ? READER_FONT_NOTO_SANS_SC_UI_550');
assert.notEqual(capturedCurrent, mangaDirectoryEntryRowSource);
assert.throws(() => checkRetainedNamed(capturedCurrent), /retained current face/, 'a baked 550 face cannot remain on a former current target');
const indentSearch = mangaDirectoryEntryRowSource.replace('this.query.trim().length > 0 || this.showContext', 'false || this.showContext');
assert.notEqual(indentSearch, mangaDirectoryEntryRowSource); assert.throws(() => checkRetainedNamed(indentSearch), /search targets use a flat inset/);
const plainCatalog = source.replace("@Prop @Watch('onLayoutInputsChanged') mangaCatalogDisplay:", 'mangaCatalogDisplay:');
assert.notEqual(plainCatalog, source); assert.throws(() => checkRetainedCatalog(plainCatalog), /retained catalog Prop/);
const propertyEvidence = checkRetainedGroupFold(); checkRetainedGroupFold(source, mangaDirectoryEntryRowSource, 'night');
const plainCollapsed = mangaDirectoryEntryRowSource.replace('@Prop collapsedBranches:', 'collapsedBranches:');
assert.notEqual(plainCollapsed, mangaDirectoryEntryRowSource);
assert.throws(() => checkRetainedGroupFold(source, plainCollapsed), /observed collapse updates/, 'negative control detects lost fold Prop delivery to the retained shared child');
const noRotationAnimation = mangaDirectoryEntryRowSource.replace(".animation({ duration: MANGA_DIRECTORY_VISUAL.foldDuration, curve: 'ease' })", '');
assert.notEqual(noRotationAnimation, mangaDirectoryEntryRowSource);
assert.throws(() => checkRetainedGroupFold(source, noRotationAnimation), /deep-equal/, 'negative control detects omitted native arrow animation');
const disabledGroup = mangaDirectoryEntryRowSource.replace('.enabled(this.interactionEnabled && (this.facts(entry)?.group === true ? this.branchControlsEnabled && this.query.trim().length === 0 : this.liveEntry(entry) !== undefined && this.liveEntry(entry)?.navigable !== false))', '.enabled(this.interactionEnabled && entry.navigable !== false)');
assert.notEqual(disabledGroup, mangaDirectoryEntryRowSource);
assert.throws(() => checkRetainedGroupFold(source, disabledGroup), /proved canonical group/);
{
  const { owner, selected, scrolled } = fixture(); Object.assign(owner, { mangaCatalogDisplay: false, currentChapterIndex: entries[345].index });
  owner.aboutToAppear(); owner.onFirstLayout(); flush();
  assert.equal(owner.projectedEntries.length, entries.filter(entry => entry.navigable !== false).length, 'Quick exposes the complete canonical catalog within its compact viewport');
  assert.equal(owner.projectedEntries[344].index, entries[345].index); assert.equal(scrolled.at(-1)[0], 86);
  owner.selectEntry(owner.projectedEntries[344], owner.identity()); assert.deepEqual(selected, [entries[345].index]);
  owner.query = '第681'; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [1361], 'quick search still sees the complete canonical catalog');
  owner.query = ''; owner.onViewInputsChanged(); owner.onLocateCurrent(); flush(); assert.equal(owner.projectedEntries.length, entries.filter(entry => entry.navigable !== false).length);
  owner.aboutToDisappear(); flush();
}
{
  const numeric = entries.map((entry, ordinal) => ({ ...entry, title: String(ordinal + 1) }));
  const { owner, selected, scrolled } = fixture(numeric);
  Object.assign(owner, { mangaCatalogDisplay: false, currentChapterIndex: numeric[345].index });
  owner.aboutToAppear(); owner.onFirstLayout(); flush();
  assert.equal(owner.projectedEntries.length, numeric.filter(entry => entry.navigable !== false).length, 'Quick numeric rows retain the entire admitted catalog');
  assert.equal(owner.projectedEntries[344].index, numeric[345].index);
  assert.equal(owner.layoutRows.length, Math.ceil(numeric.filter(entry => entry.navigable !== false).length / 4)); assert.equal(scrolled.at(-1)[0], 86, 'locate maps the current canonical index into the full numeric grid');
  owner.selectEntry(owner.projectedEntries[344], owner.identity()); assert.deepEqual(selected, [numeric[345].index]);
  owner.aboutToDisappear(); flush();
}
{
  const parts = Array.from({ length: 21 }, (_, ordinal) => ({ index: 900 + ordinal * 17,
    title: `${Math.floor(ordinal / 3) + 1} ${['上', '中', '下'][ordinal % 3]}`, level: 2,
    navigable: true, downloadState: 'unknown' }));
  const { owner } = fixture(parts); Object.assign(owner, { mangaCatalogDisplay: false, currentChapterIndex: parts[9].index });
  owner.aboutToAppear(); flush();
  assert.equal(owner.projectedEntries[0].title, '1 上', 'Quick keeps the beginning of the complete canonical parts catalog');
  assert.equal(owner.projectedEntries.at(-1).title, '7 下', 'Quick keeps the end of the complete canonical parts catalog');
  assert.equal(owner.projectedEntries.length, parts.length, 'Quick never truncates a parts catalog to nearby targets');
  assert.ok(owner.layoutRows.every(row => row.kind === 'parts' && row.columns === 3));
  assert.ok(owner.layoutRows.every(row => row.entries.length === 3 && row.entries.map(entry => entry.title.replace(/ [上中下]$/, '')).every(title => title === row.entries[0].title.replace(/ 上$/, ''))), 'Quick keeps all three parts of a source group in one native row');
  owner.aboutToDisappear(); flush();
}
const wideOpening = fixture(); wideOpening.owner.currentOpenInset = 7; wideOpening.owner.aboutToAppear(); wideOpening.owner.onFirstLayout(); flush();
assert.deepEqual(wideOpening.scrolled.at(-1), [171, false, 'start', { extraOffset: { value: -7 } }]);
wideOpening.owner.onLocateCurrent(); flush(); assert.deepEqual(wideOpening.scrolled.at(-1), [171, true, 'start', { extraOffset: { value: -12 } }]);
wideOpening.owner.aboutToDisappear(); flush();
console.log('PASS manga fallback: v2 miss/full681/Quick full canonical named/numeric/parts, explicit folds/parents, sparse targets, complete search/count, stale guards, actual SDK shared rows and retained State/Prop/arrow/font, compact demo heights and negative controls');
console.log(JSON.stringify(propertyEvidence));


function checkFallbackWidthClass(candidate = source) {
  const { owner, shared } = parentProbe(candidate);
  const numeric = [{ index: 7, title: '01', navigable: true }, { index: 19, title: '02', navigable: true },
    { index: 31, title: '03', navigable: true }, { index: 43, title: '04', navigable: true }];
  Object.assign(owner, fixture(numeric).owner, { mangaCatalogNarrow: undefined, viewportWidth: 329.7, windowMetricsRevision: 0 });
  owner.aboutToAppear(); flush(); owner.row(owner.layoutEntryRows()[0], owner.identity());
  assert.equal(owner.layoutRows[0].columns, 3, 'undefined generic fallback keeps its native measured-width class');
  const identity = owner.admittedIdentity, scroller = owner.listScroller, projection = owner.projectedEntries;
  owner.updateStateVars({ mangaCatalogNarrow: false }); shared.properties.flush();
  assert.equal(owner.layoutRows[0].columns, 4, 'explicit365.7vp parent wide class preserves four columns inside329.7vp content');
  owner.updateStateVars({ mangaCatalogNarrow: true }); shared.properties.flush();
  assert.equal(owner.layoutRows[0].columns, 3, 'retained fallback respects the newly narrow320vp parent');
  owner.updateStateVars({ mangaCatalogNarrow: false }); owner.onViewportChanged(72); shared.properties.flush();
  assert.equal(owner.layoutRows[0].columns, 1, 'real72vp available content still constrains the explicit wide fallback');
  assert.equal(owner.admittedIdentity, identity); assert.equal(owner.listScroller, scroller); assert.equal(owner.projectedEntries, projection);
  assert.deepEqual(owner.layoutRows.flatMap(row => row.entries.map(entry => entry.index)), [7, 19, 31, 43]);
  owner.aboutToDisappear(); flush();
}
checkFallbackWidthClass();
const falseFallbackClass = source.replace('this.mangaCatalogNarrow !== undefined ? this.mangaCatalogNarrow : (this.viewportWidth > 0 && this.viewportWidth <= visual.narrowWidth)',
  'this.mangaCatalogNarrow || (this.viewportWidth > 0 && this.viewportWidth <= visual.narrowWidth)');
assert.notEqual(falseFallbackClass, source);
assert.throws(() => checkFallbackWidthClass(falseFallbackClass), assert.AssertionError, 'reject fallback explicit false loss');
console.log('PASS actual fallback optional parent width Prop and same-owner class/content reflow; original OR negative rejected');
