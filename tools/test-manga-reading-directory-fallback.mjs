import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import { readerDirectoryAccessibilityText } from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600 } from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { ReaderDirectoryNavigationGateway, openReaderDirectoryNavigation } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';

const path = fileURLToPath(new URL('../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets', import.meta.url));
const source = readFileSync(path, 'utf8');
const timers = [];
const deps = { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600, projectReaderDirectoryEntries, sameReaderDirectoryData, snapshotReaderDirectoryData,
  readerDirectoryAccessibilityText, LengthMetrics: { vp: value => ({ value }) }, ScrollAlign: { START: 'start', CENTER: 'center' },
  setTimeout(action) { timers.push(action); } };
const methods = ['aboutToAppear', 'aboutToDisappear', 'identity', 'admitEntries', 'publishProjection',
  'preparePresentation', 'rowPresentation', 'groupSpacing', 'groupExpanded', 'rowFontFamily', 'onIdentityChanged', 'onEntriesChanged', 'onViewInputsChanged', 'onLocateCurrent', 'requestScroll',
  'onFirstLayout', 'onUserScrollIntent', 'selectEntry'];
const Directory = productionMotionMethods(path, methods, deps);
const entries = Object.freeze(Array.from({ length: 681 }, (_, ordinal) => Object.freeze({
  index: ordinal * 2 + 1, title: `第${ordinal + 1}话`, navigable: ordinal !== 10, downloadState: 'unknown',
})));
function flush() { while (timers.length > 0) timers.shift()(); }
function fixture(initialEntries = entries) {
  const selected = [], scrolled = [];
  const owner = Object.assign(new Directory(), { sourceId: 'tencent', bookId: '531040', entries: initialEntries,
    query: '', ascending: true, currentChapterIndex: entries[679].index, locateCurrentRevision: 1,
    mangaScheme: 'day', rowHeight: 58, mangaCatalogDisplay: false, mangaCatalogNarrow: false, currentOpenInset: 50,
    projectedEntries: [], admittedEntries: [], admittedIdentity: '', mounted: false,
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
  owner.selectEntry(hierarchy[2], owner.identity());
  assert.deepEqual(owner.collapsedGroups, [17]);
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 11, 17, 29, 41, 53, 67, 79, 83]);
  owner.selectEntry(hierarchy[0], owner.identity());
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 41, 53, 67, 79, 83]);
  assert.deepEqual(selected, [], 'an explicit group is a fold action and never a chapter target');
  owner.selectEntry(hierarchy[3], owner.identity());
  assert.deepEqual(selected, [], 'a collapsed child loses selection authority');
  owner.selectEntry(hierarchy[0], owner.identity());
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 11, 17, 29, 41, 53, 67, 79, 83],
    'reopening an outer group retains its nested group preference');
  owner.query = '第2'; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [23], 'search sees a hidden canonical target');
  assert.equal(owner.rowPresentation(hierarchy[3]).parentTitle, '子组甲');
  assert.equal(owner.rowPresentation(hierarchy[0]).readableDescendantCount, 3, 'fold and query do not truncate full-tree counts');
  owner.selectEntry(owner.projectedEntries[0], owner.identity()); assert.deepEqual(selected, [23]);
  owner.query = ''; owner.onViewInputsChanged(); flush();
  owner.selectEntry(hierarchy[0], owner.identity());
  owner.ascending = false; owner.onViewInputsChanged(); flush();
  assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [83, 79, 67, 53, 41, 7], 'descending order preserves canonical indexes');
  owner.onLocateCurrent(); flush();
  assert.deepEqual(owner.collapsedGroups, [], 'locate expands exactly the current target ancestors');
  assert.deepEqual(scrolled.at(-1), [6, true, 'start', { extraOffset: { value: -12 } }]);
  owner.selectEntry(hierarchy[4], owner.identity()); assert.deepEqual(selected, [23, 29]);
  owner.selectEntry(hierarchy[7], owner.identity());
  owner.selectEntry(hierarchy[9], owner.identity());
  assert.deepEqual(owner.collapsedGroups, [], 'disabled rows without explicit children cannot manufacture groups');
  assert.deepEqual(selected, [23, 29]);
  owner.onViewInputsChanged();
  owner.selectEntry(hierarchy[0], owner.identity());
  const before = scrolled.length; flush();
  assert.equal(scrolled.length, before, 'fold cancels pending automatic scroll work');
  assert.deepEqual(hierarchy.map(entry => entry.index), [7, 11, 17, 23, 29, 41, 53, 67, 79, 83]);
  owner.aboutToDisappear(); flush();
}
{
  const { owner, selected } = fixture(hierarchy);
  owner.aboutToAppear(); flush();
  owner.selectEntry(hierarchy[0], owner.identity());
  const originalIdentity = owner.identity();
  const expandedCatalog = [...hierarchy.slice(0, 4), { index: 27, title: '新增话', level: 3, navigable: true }, ...hierarchy.slice(4)];
  owner.entries = expandedCatalog;
  owner.selectEntry(hierarchy[0], originalIdentity);
  assert.deepEqual(owner.collapsedGroups, [7], 'a callback cannot fold before changed catalog data is admitted');
  owner.onEntriesChanged();
  assert.deepEqual(owner.collapsedGroups, [7], 'an unchanged admitted group can retain its display preference');
  assert.equal(owner.rowPresentation(hierarchy[0]).readableDescendantCount, 4);
  owner.entries = expandedCatalog.map(entry => entry.index === 7 ? { ...entry, title: '不同组甲' } : entry);
  owner.onEntriesChanged();
  assert.deepEqual(owner.collapsedGroups, [], 'changed exact group identity clears an old collapse preference');
  owner.selectEntry(hierarchy[0], originalIdentity);
  assert.deepEqual(owner.collapsedGroups, [], 'an old equal-index row cannot fold the renamed group');
  owner.selectEntry(owner.projectedEntries[0], owner.identity());
  assert.deepEqual(owner.collapsedGroups, [7]);
  owner.sourceId = 'different-source'; owner.onIdentityChanged();
  assert.deepEqual(owner.collapsedGroups, [], 'collapse state belongs to one source/book');
  owner.selectEntry(owner.projectedEntries[0], originalIdentity);
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
  assert.deepEqual(scrolled.at(-1), [679, false, 'start', { extraOffset: { value: -50 } }], 'locate uses visible rank of the original chapter index');
  owner.onLocateCurrent(); flush();
  assert.deepEqual(scrolled.at(-1), [679, true, 'start', { extraOffset: { value: -12 } }],
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
  assert.deepEqual(scrolled.at(-1), [679, false, 'start', { extraOffset: { value: -50 } }]);
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

// Exercise the actual SDK Builder: the shared lazy list receives all 681 rows,
// late data updates the retained child, and natural manga titles stay untruncated.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const listSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryList.ets', import.meta.url), 'utf8');
syntax.componentCollection.customComponents.add('ReaderDirectoryList');
syntax.propCollection.set('ReaderDirectoryList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const builderNames = ['build', 'row', 'mangaColor', 'rowPresentation', 'groupSpacing', 'groupExpanded', 'rowFontFamily'];
const built = createReaderBuilderProbe(source, builderNames, { ...deps, ReaderDirectoryList: Child });
const fixtureState = fixture(); fixtureState.owner.aboutToAppear(); flush();
Object.assign(built.owner, fixtureState.owner);
for (const method of methods) built.owner[method] = Directory.prototype[method].bind(built.owner);
built.owner.initialRender();
const list = [...built.owner.children.values()][0];
assert.equal(list.params.entries.length, 681);
assert.equal(list.params.naturalRowHeight, true);
assert.equal(list.params.rowHeight, 58);
assert.equal(list.params.listPaddingBottom, 14, 'natural-height native List owns the demo internal bottom spacing');
assert.ok(![...built.owner.nodes.values()].some(node => node.border?.width?.top === 1), 'viewport has no stationary top border');
const firstList = list;
built.owner.query = '第681'; built.owner.onViewInputsChanged(); flush(); built.owner.replay();
assert.equal([...built.owner.children.values()][0], firstList, 'query keeps the shared native List owner');
assert.deepEqual(list.params.entries.map(entry => entry.index), [1361]);
list.params.rowBuilder({ item: list.params.entries[0], index: 0 });
const row = [...built.owner.nodes.values()].find(node => node.onClick && node.accessibilityText === '打开章节：第681话');
assert.ok(row);
row.onClick();
assert.equal(fixtureState.selected.at(-1), 1361);
const title = [...built.owner.nodes.values()].find(node => node.type === 'Text' && node.create === '第681话');
assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22); assert.equal(title.maxLines, undefined);
built.owner.aboutToDisappear(); flush();
for (const scheme of ['day', 'night'])
for (const navigable of [false, true])
for (const current of [false, true]) {
  const { owner } = createReaderBuilderProbe(source, builderNames.filter(name => name !== 'build'), deps);
  Object.assign(owner, { mangaScheme: scheme, rowHeight: 58, mangaCatalogDisplay: false, mangaCatalogNarrow: false, currentChapterIndex: current ? 5 : -1, query: '', presentation: new Map(), collapsedGroups: [], projectedEntries: [] });
  owner.row({ index: 5, title: '长章节标题不截断', level: 2, navigable }, 'test');
  const nodes = [...owner.nodes.values()];
  const row = nodes.find(node => node.type === 'Row');
  const title = nodes.find(node => node.type === 'Text');
  const active = navigable && current;
  assert.equal(row.constraintSize.minHeight, 58);
  assert.equal(row.padding.left, 26);
  assert.equal(row.border.width.bottom, 1); assert.equal(row.borderRadius, undefined);
  assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22); assert.equal(title.maxLines, undefined);
  assert.equal(title.fontWeight, 400);
  assert.equal(title.fontFamily, active ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  assert.equal(title.fontColor, active ? (scheme === 'night' ? '#B9CEB1' : '#425D45') :
    !navigable ? (scheme === 'night' ? '#ABA99F' : '#756F69') : (scheme === 'night' ? '#EAE7DE' : '#1F1B17'));
  assert.equal(row.backgroundColor, active ? (scheme === 'night' ? '#303C2D' : '#E8EDE2') :
    'Color.Transparent');
  assert.equal(nodes.some(node => node.type === 'Image'), navigable && !current);
}
for (const scheme of ['day', 'night']) {
  const { owner } = createReaderBuilderProbe(source, builderNames, { ...deps, ReaderDirectoryList: Child });
  let clears = 0;
  Object.assign(owner, { mangaScheme: scheme, rowHeight: 58, mangaCatalogDisplay: false, mangaCatalogNarrow: false, query: '没有此章节', projectedEntries: [], admittedEntries: entries, presentation: new Map(), collapsedGroups: [],
    onClearSearch: () => clears++ });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  assert.ok(nodes.some(node => node.type === 'Text' && node.create === '没有匹配的章节'));
  const empty = nodes.find(node => node.type === 'Column');
  assert.equal(empty.create.space, 8); assert.equal(empty.constraintSize.minHeight, 164);
  assert.deepEqual(empty.padding, { left: 12, right: 12, top: 36, bottom: 36 });
  assert.deepEqual(empty.border,{width:{top:1},color:scheme==='night'?'#3B4036':'#E7E0D5'},'empty popup retains directory-tree top line');
  assert.equal(nodes.find(node => node.type === 'Text' && node.create === '没有匹配的章节').fontSize, 12);
  const clear = nodes.find(node => node.type === 'Text' && node.create === '清除搜索');
  assert.equal(clear.fontColor, scheme === 'night' ? '#B9CEB1' : '#425D45');
  assert.equal(clear.height, 36);
  clear.onClick(); assert.equal(clears, 1);
}

// Use the installed SDK compiler and its real @State proxy classes. These
// assertions cover retained native attribute requests, not rendered frames.
function checkRetainedGroupFold(candidate, scheme = 'day') {
  const properties = createArkUIPropertyRuntimeProbe();
  const names = [...new Set([...methods, ...builderNames, 'presentation', 'collapsedGroups', 'projectedEntries', 'rowHeight', 'mangaCatalogDisplay', 'mangaCatalogNarrow', 'currentChapterIndex', 'query'])];
  const { owner } = createReaderBuilderProbe(candidate, names,
    { ...deps, ...properties.sdk, ReaderDirectoryList: Child }, properties.hooks);
  const state = fixture(hierarchy);
  Object.assign(owner, state.owner, { mangaScheme: scheme });
  owner.aboutToAppear(); flush(); owner.initialRender();
  const list = [...owner.children.values()][0];
  list.params.rowBuilder({ item: list.params.entries[0], index: 0 });
  const group = [...owner.nodes.values()].find(node => node.type === 'Row');
  const arrow = [...owner.nodes.values()].find(node => node.type === 'Image');
  const count = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '3 个可读条目');
  assert.equal(group.enabled, true, 'a proved canonical group admits its fold action');
  assert.equal(group.constraintSize.minHeight, 48);
  assert.equal(group.backgroundColor, scheme === 'night' ? '#30342D' : '#F0ECE3');
  assert.ok(count, 'the expanded group count comes from the full catalog');
  assert.equal(arrow.create, scheme === 'night' ? 'app.media.manga_sheet_chevron_down_theme_night' : 'app.media.manga_sheet_chevron_down');
  assert.equal(arrow.width, 16); assert.equal(arrow.height, 16);
  assert.deepEqual(arrow.rotate, { angle: 0 });
  assert.deepEqual(arrow.animation, { duration: 180, curve: 'ease' });
  const actorCount = owner.observers.length;
  group.onClick(); properties.flush();
  assert.equal([...owner.children.values()][0], list, 'fold updates the retained shared List owner');
  assert.deepEqual(list.params.entries.map(entry => entry.index), [7, 41, 53, 67, 79, 83]);
  assert.deepEqual(arrow.rotate, { angle: -90 }, 'observed collapse updates the retained arrow actor');
  assert.equal(group.accessibilityText, '组甲，分组，已折叠');
  assert.equal(count.create, '3 个可读条目', 'collapse never substitutes a visible-row count');
  assert.deepEqual(state.selected, [], 'group callback cannot target its canonical chapter index');
  assert.equal(owner.observers.length, actorCount, 'fold keeps the existing group actors');
  group.onClick(); properties.flush();
  assert.deepEqual(arrow.rotate, { angle: 0 });
  assert.equal(group.accessibilityText, '组甲，分组，已展开');
  assert.equal(list.params.entries.length, hierarchy.length);
  owner.aboutToDisappear(); group.onClick(); properties.flush();
  assert.deepEqual(Array.from(owner.collapsedGroups), [], 'an unmounted group callback cannot change display state');
  return properties.source;
}
function checkRetainedVariants(candidate) {
  const properties = createArkUIPropertyRuntimeProbe();
  const names = [...new Set([...methods,...builderNames,'presentation','collapsedGroups','projectedEntries','rowHeight',
    'mangaCatalogDisplay','mangaCatalogNarrow','currentChapterIndex','query'])];
  const {owner}=createReaderBuilderProbe(candidate,names,{...deps,...properties.sdk,ReaderDirectoryList:Child},properties.hooks);
  const state=fixture(hierarchy);Object.assign(owner,state.owner,{currentChapterIndex:11});
  owner.aboutToAppear();flush();owner.initialRender();
  const list=[...owner.children.values()][0];
  list.params.rowBuilder({item:list.params.entries[0],index:0});
  list.params.rowBuilder({item:list.params.entries[1],index:1});
  const nodes=[...owner.nodes.values()],group=nodes.find(node=>node.type==='Row'&&node.accessibilityText?.startsWith('组甲，'));
  const target=nodes.find(node=>node.type==='Row'&&node.accessibilityText===readerDirectoryAccessibilityText(hierarchy[1]));
  const title=nodes.find(node=>node.type==='Text'&&node.create==='第1话'),badge=nodes.find(node=>node.type==='Text'&&node.create==='正在读');
  const groupSpan=nodes.find(node=>node.type==='Flex'),count=nodes.find(node=>node.type==='Text'&&node.create==='3 个可读条目');
  const actorIds=[...owner.nodes.keys()],observers=[...owner.observers];
  assert.equal(title.fontFamily,READER_FONT_NOTO_SANS_SC_UI_550);assert.equal(title.fontWeight,400);
  owner.currentChapterIndex=-1;properties.flush();assert.equal(title.fontFamily,READER_FONT_NOTO_SANS_SC_UI_REGULAR,'retained current face returns to regular');
  owner.currentChapterIndex=11;properties.flush();assert.equal(title.fontFamily,READER_FONT_NOTO_SANS_SC_UI_550);
  for(const [catalog,narrow,height,size,line,left,right,gap,badgeSize,groupHeight,paddingBottom] of [
    [false,false,58,13,22,26,10,12,10,48,14],
    [false,false,50,13,22,26,10,12,10,48,14],
    [true,false,50,12,20,28,15,12,9,44,18],
    [true,true,50,11,20,20,10,5,8,44,18],
    [false,false,58,13,22,26,10,12,10,48,14]]) {
    owner.mangaCatalogDisplay=catalog;owner.mangaCatalogNarrow=narrow;owner.rowHeight=height;properties.flush();
    assert.equal(target.constraintSize.minHeight,catalog?48:height,'retained variant min-height');
    assert.equal(title.fontSize,size);assert.equal(title.lineHeight,line);
    assert.deepEqual(target.padding,{left,right,top:catalog?11:14,bottom:catalog?11:14});
    assert.equal(target.create.space,gap);assert.equal(badge.fontSize,badgeSize);
    assert.equal(group.constraintSize.minHeight,groupHeight);
    assert.deepEqual(group.padding,{left:catalog?15:12,right:catalog?15:12,top:catalog?10:11,bottom:catalog?10:11});
    assert.equal(group.border.width.top,catalog?0:1,'only popup has a content-first top border');
    assert.equal(list.params.listPaddingBottom,paddingBottom,'catalog has exactly 18vp scroll tail');
    assert.equal(groupSpan.create.direction,narrow?'FlexDirection.Column':'FlexDirection.Row');
    assert.deepEqual(count.margin,{left:narrow?0:9,top:narrow?1:0});
    assert.deepEqual([...owner.nodes.keys()],actorIds);assert.deepEqual(owner.observers,observers);
  }
  owner.query='第1';owner.onViewInputsChanged();flush();properties.flush();
  assert.equal(target.padding.left,10,'search targets are flat, regardless of admitted depth');
  assert.equal(target.border.width.top,1,'the content-first top border follows actual filtered rank');
  assert.equal(group.border.width.top,0);
  owner.query='';owner.onViewInputsChanged();flush();properties.flush();
  assert.equal(target.padding.left,26);assert.equal(group.border.width.top,1);
  owner.aboutToDisappear();flush();
}
checkRetainedVariants(source);
const plainCatalog = source.replace('@Prop mangaCatalogDisplay:', 'mangaCatalogDisplay:');
assert.notEqual(plainCatalog,source);assert.throws(()=>checkRetainedVariants(plainCatalog),/retained variant min-height/,'plain field loses retained variant scheduling');
const capturedCurrent = source.replace('entry.navigable !== false && entry.index === this.currentChapterIndex ? TYPE_MANGA_DIRECTORY_CURRENT_TITLE.fontFamily', 'true ? TYPE_MANGA_DIRECTORY_CURRENT_TITLE.fontFamily');
assert.notEqual(capturedCurrent,source);assert.throws(()=>checkRetainedVariants(capturedCurrent),/retained current face/,'baked550 cannot remain on a former current row');
const indentSearch = source.replace('this.query.trim().length > 0 ? 10 : 10 +', 'false ? 10 : 10 +');
assert.notEqual(indentSearch,source);assert.throws(()=>checkRetainedVariants(indentSearch),/search targets are flat/);
const wideOpening=fixture();wideOpening.owner.currentOpenInset=7;wideOpening.owner.aboutToAppear();wideOpening.owner.onFirstLayout();flush();
assert.deepEqual(wideOpening.scrolled.at(-1),[679,false,'start',{extraOffset:{value:-7}}],'wide opening is 83vp header + 7vp inset');
wideOpening.owner.onLocateCurrent();flush();assert.deepEqual(wideOpening.scrolled.at(-1),[679,true,'start',{extraOffset:{value:-12}}],'explicit locate remains 12vp');
wideOpening.owner.aboutToDisappear();flush();
const propertyEvidence = checkRetainedGroupFold(source);
checkRetainedGroupFold(source, 'night');
const plainCollapsed = source.replace('@State private collapsedGroups:', 'private collapsedGroups:');
assert.notEqual(plainCollapsed, source);
assert.throws(() => checkRetainedGroupFold(plainCollapsed), /observed collapse updates/,
  'negative control detects lost @State scheduling on the retained arrow');
const noRotationAnimation = source.replace('.animation({ duration: 180, curve: \'ease\' })', '');
assert.notEqual(noRotationAnimation, source);
assert.throws(() => checkRetainedGroupFold(noRotationAnimation), /deep-equal/,
  'negative control detects omission of the native 180ms group-arrow transition');
const disabledGroup = source.replace('.enabled(this.rowPresentation(entry)?.group === true || entry.navigable !== false)',
  '.enabled(entry.navigable !== false)');
assert.notEqual(disabledGroup, source);
assert.throws(() => checkRetainedGroupFold(disabledGroup), /proved canonical group/);
console.log('PASS actual manga reading flat fallback: v2 unavailable→681 rows, nested explicit folds, unchanged canonical targets, unknown/stale guards, full-catalog search/count, retained SDK List/arrow and 400↔550 face, phone58/wide50/catalog48/group44/narrow, content-first top line/empty/catalog tail, wide7/locate12 and regression controls');
console.log(JSON.stringify(propertyEvidence));
