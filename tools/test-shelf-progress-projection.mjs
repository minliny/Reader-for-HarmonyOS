import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"progress-boundaries": {"description": "实际生产进度finite/clamp/零态与Grid/List当前显示", "resources": []}, "formatter-propagation": {"description": "真实formatter变动传播两consumer和Grid variant隔离/旧负例", "resources": []}, "retained-list": {"description": "实际Page→List Props保label/Progress/More identity", "resources": []},
  'source-metadata': { description: '实际 SDK 书架副行仅在 API 24+ 中段省略公开书源名称', resources: [] }};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { virtualFilePath } = await import('./lib/tool-environment.mjs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts');
const { MangaBookPresentation } = await import('../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts');
const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');


// Actual installed SDK compiler/property methods/native attribute calls. No
// Core transport, write receipt, geometry renderer or replacement presenter.
const read = file => readFileSync(new URL('../entry/src/main/ets/features/bookshelf/' + file, import.meta.url), 'utf8');
const pageSource = read('ui/BookshelfPage.ets');
const listSource = read('ui/ShelfBookListDetails.ets');
const projectionSource = read('presentation/ShelfBookPresentation.ts');
const frozenGrid = readFileSync(new URL('./fixtures/design/shelf-progress-grid-baseline.ets', import.meta.url), 'utf8');
const { ts, options } = installedEtsCompiler();
const parse = text => ts.createSourceFile(virtualFilePath('ShelfProgress.ets'), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const gridSource = read('ui/BookshelfGridSpec.ets');
const geometry = pureModuleProbe(gridSource, 'BookshelfGridSpec.ets',
  { ...readerFoundationTokens, ...readerTypographyRoles, ...fonts },
  ['bookshelfGridFrame', 'bookshelfCoverHeight', 'bookshelfListCardWidth', 'bookshelfListTextFrame', 'BookshelfListTextBudget',
    'BOOKSHELF_GRID_TEXT_GAP', 'BOOKSHELF_GRID_TITLE_LINES', ...Array.from(gridSource.matchAll(/^export const (BOOKSHELF_LIST_\w+) =/gm), m => m[1])]);
const listTree = parse(listSource);
const listConstants = listTree.statements.filter(ts.isVariableStatement).map(node => node.getText(listTree));
const listConstantNames = listTree.statements.filter(ts.isVariableStatement)
  .flatMap(node => [...node.declarationList.declarations].map(declaration => declaration.name.getText(listTree)));
const listDependencies = { ...geometry, ...fonts, EllipsisMode: { END: 'EllipsisMode.END', MULTILINE_CENTER: 'EllipsisMode.MULTILINE_CENTER' },
  readerHarmonyApi24: () => false, deviceInfo: { distributionOSApiVersion: 60100, sdkApiVersion: 23 },
  ...new Function(`${listConstants.join('\n')}; return {${listConstantNames.join(',')}};`)() };
const listMembers = boundedMembers(listSource);
function projection(text) {
  return new Function('MangaBookPresentation', stripTypeScriptTypes(text).replace(/^import .*;$/gm, '').replace(/^export /gm, '') + ';return ShelfBookPresentation;')(MangaBookPresentation);
}
const positiveRule = projectionSource.replace('Math.floor(value)', 'Math.ceil(value)');
const gridOnlyRule = projectionSource.replace("variant === 'grid-caption' ? '' : '未读'", "variant === 'grid-caption' ? '网格零态探针' : '未读'");
assert.notEqual(positiveRule, projectionSource); assert.notEqual(gridOnlyRule, projectionSource);
let writes = 0;
const forbiddenTransport = { request() { writes++; assert.fail('display must never dispatch'); } };
const textNodes = owner => [...owner.nodes.values()].filter(n => n.type === 'Text');
// Select the unchanged production geometry once. Parsing the full Page inside
// each member predicate used to reparse it hundreds of times per Grid owner.
// The SDK still transforms the original selected methods for every new owner;
// no native nodes, property runtime, Component or callback are shared here.
const geometryMethods = ['shelfBookCardWidth', 'bookCardWidth', 'bookCardHeight'];
const pageTree = parse(pageSource);
const pageDeclaration = pageTree.statements.find(ts.isStructDeclaration);
const geometryMethodSource = geometryMethods.map(name => {
  const member = pageDeclaration.members.find(m => m.name?.getText(pageTree) === name);
  assert.ok(member, 'actual production geometry method ' + name);
  return member.getText(pageTree);
}).join('\n');
const frozenGridWithGeometry = frozenGrid.replace(/build\(\) \{ Column\(\) \{\} \}/,
  geometryMethodSource + '\nbuild() { Column() {} }');
function grid(text, Projection, book) {
  const old = text === frozenGrid;
  const names = ['projectionGridDetails', 'gridProgressLabel', 'gridBookCardHeight',
    old ? 'shelfProgressText' : 'projectionDetailsOpacity'];
  // Geometry remains the actual production methods/constants. Only the
  // window's resolved content width is a controlled Phone/Tablet input.
  const selected = old ? frozenGridWithGeometry : pageSource;
  const { owner } = createReaderBuilderProbe(selected, [...names, ...geometryMethods], { ...geometry, ...readerFoundationTokens,
    ShelfBookPresentation: Projection, runtime: forbiddenTransport });
  Object.assign(owner, { appThemeScheme: 'day', viewMode: 'cover', viewSwitchGridContentOpacity: 1,
    shelfContentWidth: wide => wide ? 650 : 326 });
  owner.projectionGridDetails(book, false);
  return owner;
}
function list(Projection, book, distributionOSApiVersion = 60100) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(listSource, listMembers,
    { ...properties.sdk, ...listDependencies, ShelfBookPresentation: Projection, runtime: forbiddenTransport,
      readerHarmonyApi24: () => distributionOSApiVersion >= 60101,
      deviceInfo: { distributionOSApiVersion, sdkApiVersion: distributionOSApiVersion >= 60101 ? 24 : 23 } },
    { ...properties.hooks, initialParams: { book } });
  owner.initialRender();
  return owner;
}
const row = progress => Object.freeze({ sourceId: 'online', bookId: 'progress-book', title: '原书名', author: '原作者', addedAt: 1,
  sourceName: '原书源', lastChapter: '原最新章', ...(progress === undefined ? {} : { readProgress: progress }) });
if (selectedCase === 'source-metadata') {
  const sourceName = '首尾均应保留的公开书源名称'.repeat(5);
  const book = { ...row(3499), sourceName };
  const baseline = textNodes(list(ShelfBookPresentation, book, 60100));
  assert.equal(baseline.find(node => node.create === '最新 原最新章').ellipsisMode, 'EllipsisMode.END');
  assert.ok(baseline.every(node => !node.create.includes(sourceName)));
  for (const version of [60101, 260000]) {
    const current = textNodes(list(ShelfBookPresentation, book, version));
    const metadata = current.find(node => node.create === `最新 原最新章 · ${sourceName}`);
    assert.ok(metadata);
    assert.equal(metadata.ellipsisMode, 'EllipsisMode.MULTILINE_CENTER');
    assert.equal(metadata.maxLines, 1);
    assert.equal(metadata.height, baseline.find(node => node.create === '最新 原最新章').height);
    assert.equal(current.find(node => node.create === book.title).ellipsisMode, 'EllipsisMode.END');
  }
}
const cases = [
  [undefined, 0, '未读', ''], [0, 0, '未读', ''], [1, .01, '已读 <1%', '已读 <1%'],
  [99, .99, '已读 <1%', '已读 <1%'], [100, 1, '已读 1%', '已读 1%'],
  [1234, 12.34, '已读 12%', '已读 12%'], [10000, 100, '已读 100%', '已读 100%'],
  [10100, 100, '已读 100%', '已读 100%'], [-1, 0, '未读', ''],
  [NaN, 0, '未读', ''], [Infinity, 0, '未读', ''], [-Infinity, 0, '未读', ''],
];
if(selectedCase==='progress-boundaries') {
for (const [input, percent, label, caption] of cases) {
  const book = row(input);
  assert.equal(ShelfBookPresentation.progressPercent(book), percent);
  assert.equal(ShelfBookPresentation.progress(book), label);
  assert.equal(ShelfBookPresentation.progress(book, 'grid-caption'), caption);
  const g = grid(pageSource, ShelfBookPresentation, book), l = list(ShelfBookPresentation, book);
  assert.deepEqual(textNodes(g).map(n => n.create), ['原书名', '原作者', ...(caption ? [caption] : [])]);
  assert.ok(textNodes(l).some(n => n.create === label.replace(/^已读 /, '')));
  assert.equal([...l.nodes.values()].find(n => n.type === 'Progress').create.value, percent);
  const unreadHeight = g.gridBookCardHeight(row(0), false);
  assert.equal(g.gridBookCardHeight(book, false)>unreadHeight,Boolean(caption),
    'actual Grid visibility and its measured height consume the same variant');
  assert.equal(book.readProgress, input, 'display keeps the original Core-owned fact');
}
const online = { ...row(3499), title: '长书名'.repeat(40), author: '长作者'.repeat(40),
  currentChapterTitle: `  ${'长当前章'.repeat(40)}  `, lastChapter: `  ${'长最新章'.repeat(40)}  `, unreadCount: 7 };
const onlineTexts = textNodes(list(ShelfBookPresentation, online));
assert.deepEqual(onlineTexts.map(node => node.create), [online.title, online.author, '更新 7 章',
  `读至 ${online.currentChapterTitle.trim()}`, `最新 ${online.lastChapter.trim()}`, '34%']);
for (const node of onlineTexts) assert.equal(node.maxLines, 1);
for (const node of onlineTexts.slice(0, 2)) {
  assert.equal(node.layoutWeight, 1);
  assert.equal(node.constraintSize.minWidth, 0);
  assert.equal(node.ellipsisMode, 'EllipsisMode.END');
}
assert.deepEqual(textNodes(list(ShelfBookPresentation,
  { ...row(0), sourceId: 'local', kind: 'epub', chapterCount: 7 })).map(node => node.create),
['原书名', '原作者', '本地', '尚未阅读', '本地 EPUB · 共 7 章', '未读']);
assert.deepEqual(textNodes(list(ShelfBookPresentation, { ...row(0), lastChapter: '  暂无最新章节  ' }))
  .map(node => node.create), ['原书名', '原作者', '尚未阅读', '未读']);
const localPosition = { ...row(undefined), sourceId: 'local', kind: 'txt',
  readingPosition: { chapterIndex: 0, chapterOffset: 0, updatedAt: 1 } };
assert.deepEqual(textNodes(list(ShelfBookPresentation, localPosition)).map(node => node.create),
  ['原书名', '原作者', '本地', '阅读中', '本地 TXT', '*%']);
assert.equal(textNodes(list(ShelfBookPresentation, { ...localPosition, readProgress: 0 })).at(-1).create, '0%');
}
// One real shared-spec edit reaches both actual consumers; a named variant
// edit reaches only its Grid consumer. Mutations are isolated in this test.
if(selectedCase==='formatter-propagation'){
const shared = projection(positiveRule), gridVariant = projection(gridOnlyRule);
assert.equal(textNodes(grid(pageSource, shared, row(1234))).at(-1).create, '已读 13%');
assert.ok(textNodes(list(shared, row(1234))).some(n => n.create === '13%'));
assert.equal(textNodes(grid(pageSource, gridVariant, row(0))).at(-1).create, '网格零态探针');
assert.ok(textNodes(list(gridVariant, row(0))).some(n => n.create === '未读'));
const old = grid(frozenGrid, shared, row(1234));
assert.equal(textNodes(old).at(-1).create, '已读 12%', 'old duplicate formatter is a real non-propagation negative control');
assert.equal(textNodes(grid(frozenGrid, ShelfBookPresentation, row(Infinity))).at(-1).create, '已读 Infinity%',
  'frozen old implementation actually reproduces the nonfinite divergence');
}
// Mount the actual List component through the actual BookshelfPage call and
// run real SDK one-way Prop updates. Keep the already-mounted child/nodes.
if(selectedCase==='retained-list'){
  const properties = createArkUIPropertyRuntimeProbe();
  const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
  const icons = iconButtonControls({ properties });
  const deps = { ...icons.dependencies, ...listDependencies, ...readerFoundationTokens, ShelfBookPresentation,
    runtime: forbiddenTransport };
  const child = createReaderBuilderProbe(listSource, listMembers, deps, icons.hooks);
  const names = ['projectionListDetails', 'projectionListDetailsWidth', 'projectionDetailsOpacity', 'listCoverWidth',
    'listCoverHeight', 'listTextBudget', 'listTextFrame', 'listContentHeight', 'bookActionFocusKey',
    'bookActionPresentationHandler', 'isShelfPresentationCurrent', 'presentBookActionSheet', 'currentVisibleBook',
    'projectedBooks', 'restoreBookActionFocus', 'restoreDetailReturnFocus'];
  const focusFrame = pageTree.statements.find(node => ts.isClassDeclaration(node) &&
    node.name?.text === 'BookshelfBookActionFocusFrame');
  const BookshelfBookActionFocusFrame = new Function('FrameCallback',
    `${stripTypeScriptTypes(focusFrame.getText(pageTree))}; return BookshelfBookActionFocusFrame;`)(class {});
  const focusRequests = [];
  const callbacks = [];
  const uiContext = { postFrameCallback: frame => callbacks.push(frame),
    getFocusController: () => ({ requestFocus: id => focusRequests.push(id) }),
    getFrameNodeById: id => id === more.id ? more : null };
  const parent = createReaderBuilderProbe(pageSource, names, { ...deps, ShelfBookListDetails: child.Component,
    BookshelfBookActionFocusFrame, uiContext },
  { ...icons.hooks, childSources: { ...icons.hooks.childSources, ShelfBookListDetails: listSource } });
  const book = { ...row(1), unreadCount: 7 };
  Object.assign(parent.owner, { appThemeScheme: 'day', viewMode: 'list', viewSwitchListContentOpacity: 1,
    shelfContentWidth: () => 326, mounted: true, navigationGeneration: 7, books: [book], actionSheetRevision: 0,
    bookActionFocusRevision: 0, viewportRestored: true, viewportRestoreGeneration: 1,
    isCurrentShelfInput: navigation => navigation === 7 });
  parent.owner.projectionListDetails(book, false);
  const actualChild = [...parent.owner.children.values()][0];
  const label = textNodes(actualChild).find(n => n.create === '<1%');
  const badge = textNodes(actualChild).find(n => n.create === '更新 7 章');
  const bar = [...actualChild.nodes.values()].find(n => n.type === 'Progress');
  const moreActor = [...actualChild.children.values()].find(actor => actor instanceof icons.icon.Component);
  const more = icons.nodes(moreActor).find(node => node.type === 'Button' && node.onClick);
  assert.deepEqual([more.width, more.height, more.responseRegion], [20, 20, { x: -12, y: -12, width: 44, height: 44 }]);
  const moreIcon = icons.nodes(moreActor).find(node => node.type === 'Image');
  assert.deepEqual([moreIcon.width, moreIcon.height], [18, 18]);
  assert.equal(moreActor.focusId, parent.owner.bookActionFocusKey(book, true));
  assert.equal(more.accessibilityText, `${book.title}更多操作`);
  assert.equal(more.id, moreActor.focusId);
  assert.ok(label && badge); assert.equal(bar.create.value, .01); assert.equal(actualChild.book.bookId, book.bookId);
  book.readProgress = 8765; book.unreadCount = 8; parent.owner.replay(); properties.flush();
  assert.equal(textNodes(actualChild).find(n => n.create === '87%'), label, 'Prop update retains the original label actor');
  assert.equal(textNodes(actualChild).find(n => n.create === '更新 8 章'), badge, 'Prop update retains the original badge actor');
  assert.equal([...actualChild.nodes.values()].find(n => n.type === 'Progress'), bar);
  assert.equal(bar.create.value, 87.65); assert.equal([...parent.owner.children.values()][0], actualChild);
  more.onClick(); assert.equal(parent.owner.actionBook, book, 'current More callback retains original entity');
  assert.equal(parent.owner.actionSheetFocusTarget, more.id);
  parent.owner.actionBook = undefined;
  parent.owner.detailReturnFocus = { sourceId: book.sourceId, bookId: book.bookId, listMore: true };
  parent.owner.restoreDetailReturnFocus(1);
  callbacks.shift().onFrame(0);
  assert.deepEqual(focusRequests, [more.id], 'return requests focus on the retained list button');
  parent.owner.viewMode = 'cover'; parent.owner.replay(); properties.flush();
  assert.equal(more.enabled, false, 'retained list More is disabled while covers own input');
  more.onClick(); assert.equal(parent.owner.actionBook, undefined);
  parent.owner.viewMode = 'list'; parent.owner.replay(); properties.flush();
  assert.equal(more.enabled, true);
  parent.owner.navigationGeneration = 8; more.onClick();
  assert.equal(parent.owner.actionBook, undefined, 'old physical callback cannot borrow a new navigation');
  parent.owner.navigationGeneration = 7; parent.owner.mounted = false; more.onClick();
  assert.equal(parent.owner.actionBook, undefined, 'retired page callback remains rejected');
}
assert.equal(writes, 0);

console.log(`PASS shelf progress ${selectedCase}: actual SDK callbacks and attributes, zero writes.`);

}
