// Deterministic source/SDK-attribute evidence only. This test never runs a
// browser, performs native layout, paints glyphs, builds a HAP or uses a VM.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const visual = await import('../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
const projection = await import('../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');
const metricsExports = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { findReaderTheme } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const demo = readFileSync(new URL('../docs/ui-design/shared-download/demo.html', import.meta.url));
assert.equal(visual.SHARED_DOWNLOAD_DEMO_SHA256, createHash('sha256').update(demo).digest('hex'),
  'the generated visual contract belongs to the exact current approved demo');
assert.ok(visual.DOWNLOAD_VISUAL && typeof visual.DOWNLOAD_VISUAL === 'object');
const manifest = JSON.parse(readFileSync(new URL('../docs/ui-design/shared-download/visual-spec.json', import.meta.url), 'utf8'));
assert.equal(manifest.sourceSha256, visual.SHARED_DOWNLOAD_DEMO_SHA256);
const storageDemo = readFileSync(new URL('../docs/ui-design/shared-download/storage-demo.html', import.meta.url));
assert.equal(manifest.storageSource, 'storage-demo.html');
assert.equal(manifest.storageSourceSha256, createHash('sha256').update(storageDemo).digest('hex'),
  'storage v2 numeric/geometry attributes belong to its exact approved source');
for (const [field, receipt] of Object.entries(manifest.storageProvenance)) {
  assert.equal(receipt.source, manifest.storageSource); assert.equal(receipt.sourceSha256, manifest.storageSourceSha256);
  assert.deepEqual(manifest.provenance[field], receipt, `storage field ${field} retains its separate source provenance`);
}

assert.deepEqual({ ...visual.DOWNLOAD_VISUAL }, manifest.fields,
  'all emitted native values equal the actual CSSOM extraction manifest');
for (const field of Object.keys(manifest.fields)) assert.ok(manifest.provenance[field],
  `generated field ${field} has an authored/inherited/derived demo origin`);

// These are approved demo expectations, not a second CSS parser/renderer.
// A source hash mismatch rejects a changed demo until its real generator runs.
const palette = {
  day: { paper: '#FFF8F4EC', surface: '#FFFFFCF8', ink: '#FF1F1B17', muted: '#FF756F69',
    line: '#FFE7E0D5', soft: '#FFF0ECE3', green: '#FF1F3528', greenInk: '#FFFFFCF8',
    softGreen: '#FFE8EDDF', danger: '#FFA53D32', scrim: '#57000000', shadow: '#12000000' },
  night: { paper: '#FF1C1E1A', surface: '#FF282C25', ink: '#FFEAE7DE', muted: '#FFABA99F',
    line: '#FF3B4036', soft: '#FF30342D', green: '#FFB9CEB1', greenInk: '#FF1C1E1A',
    softGreen: '#FF333F2D', danger: '#FFEFB4A8', scrim: '#80000000', shadow: '#32000000' },
};
const argb = color => {
  assert.equal(typeof color, 'string', 'ArkUI receives a concrete palette color');
  return color.length === 7 ? '#FF' + color.slice(1).toUpperCase() : color.toUpperCase();
};
for (const scheme of ['day', 'night']) for (const [role, expected] of Object.entries(palette[scheme]))
  assert.equal(argb(visual.downloadVisualColor(role, scheme)), expected, `demo ${scheme}.${role}`);
const overlayPalette = {
  day: { underlayColor: '#FFA3A19B', contentColor: '#FF14110F', tone: 'dark' },
  night: { underlayColor: '#FF0E0F0D', contentColor: '#FF75736F', tone: 'light' },
};
for (const scheme of ['day', 'night']) for (const sheetVisible of [false, true]) {
  const style = visual.downloadOverlayChromeStyle(scheme, sheetVisible);
  assert.equal(argb(style.underlayColor), overlayPalette[scheme].underlayColor);
  assert.equal(argb(style.contentColor), overlayPalette[scheme].contentColor);
  assert.equal(style.tone, overlayPalette[scheme].tone);
  assert.equal(argb(style.navigationUnderlayColor), sheetVisible ? palette[scheme].surface : overlayPalette[scheme].underlayColor);
  assert.equal(argb(style.navigationContentColor), sheetVisible ? palette[scheme].ink : overlayPalette[scheme].contentColor);
}

const doubleOverlayPalette = {
  day: { underlayColor: '#FF6B6A66', contentColor: '#FF0D0B09', tone: 'dark' },
  night: { underlayColor: '#FF070706', contentColor: '#FF3A3937', tone: 'light' },
};
for (const role of ['overlayChromeDouble', 'overlayChromeDoubleInk'])
  assert.ok(manifest.palettes[role].provenance.includes(manifest.storageSourceSha256),
    'double scrim colors retain their exact approved storage v2 Canvas receipt');
for (const scheme of ['day', 'night']) {
  const style = visual.downloadOverlayChromeStyle(scheme, false, 2), expected = doubleOverlayPalette[scheme];
  assert.equal(argb(style.underlayColor), expected.underlayColor);
  assert.equal(argb(style.contentColor), expected.contentColor); assert.equal(style.tone, expected.tone);
  assert.equal(argb(style.navigationUnderlayColor), expected.underlayColor);
  assert.equal(argb(style.navigationContentColor), expected.contentColor);
  assert.equal(argb(visual.downloadVisualColor('overlayChromeDouble', scheme)), expected.underlayColor);
  assert.equal(argb(visual.downloadVisualColor('overlayChromeDoubleInk', scheme)), expected.contentColor);
}

assert.deepEqual({ ...visual.sharedDownloadContentInsets(0, 0) }, { left: 18, right: 18 });
assert.deepEqual({ ...visual.sharedDownloadContentInsets(24, 7) }, { left: 24, right: 18 },
  'a safe edge replaces the base inset instead of being added twice');
assert.equal(visual.sharedDownloadSheetMaxHeight(800, 28, 18), 656);
assert.equal(visual.sharedDownloadSheetMaxHeight(400, 150, 150), 100,
  'the 82% demo cap must also fit actual top/bottom occlusion');
assert.deepEqual({ ...visual.sharedDownloadTextScale(13, 21, 1) }, { fontSize: 13, lineHeight: 21 });
assert.deepEqual({ ...visual.sharedDownloadTextScale(13, 21, 2) }, { fontSize: 26, lineHeight: 42 });
assert.deepEqual({ ...visual.sharedDownloadTextScale(13, 21, NaN) }, { fontSize: 13, lineHeight: 21 });

const source = readFileSync(new URL('../entry/src/main/ets/features/downloads/SharedDownloadPage.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(sdk + '/node_modules/typescript');
const tree = ts.createSourceFile('SharedDownloadPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
const page = tree.statements.find(node => node.name?.getText(tree) === 'SharedDownloadPage');
assert.ok(page, 'the actual production component is the probe input');
const methods = [...page.members.filter(node => ts.isMethodDeclaration(node)).map(node => node.name.getText(tree)),
  'readerWindowMetricsRevision', 'books', 'storageSummary', 'loading', 'appThemeScheme', 'sheet', 'confirmation', 'presentationIdentity', 'detailKey'];
const frameSource = tree.statements.find(node => node.name?.getText(tree) === 'SharedDownloadIdleFrame');
assert.ok(frameSource, 'the production idle-frame adapter is retained');
const frameBody = ts.transpileModule(frameSource.getText(tree), {
  compilerOptions: { target: ts.ScriptTarget.ES2021 },
}).outputText;
const SharedDownloadIdleFrame = new Function('FrameCallback', frameBody + '\nreturn SharedDownloadIdleFrame;')(class {});
const coordinatorSource = readFileSync(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url), 'utf8');
const coordinatorTree = ts.createSourceFile('ReaderWindowCoordinator.ts', coordinatorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const chromeClass = coordinatorTree.statements.find(node => node.name?.getText(coordinatorTree) === 'ReaderWindowChromeStyle');
assert.ok(chromeClass, 'the real window-chrome DTO is the platform-boundary input');
const chromeClassBody = ts.transpileModule(chromeClass.getText(coordinatorTree).replace(/^export\s+/, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2021 },
}).outputText;
const ReaderWindowChromeStyle = new Function('findReaderTheme', chromeClassBody + '\nreturn ReaderWindowChromeStyle;')(findReaderTheme);

// Use the shared SDK helper's real native-attribute channels, including the
// platform Rect/Checkbox/Radio boundaries. No layout engine is reproduced here.
const enumValue = name => new Proxy({}, { get: (_target, key) => `${name}.${String(key)}` });
let windowMetrics = Object.assign(metricsExports.createDefaultReaderWindowMetrics(), {
  windowRect: { left: 0, top: 0, width: 366, height: 809 },
  systemInsets: { top: 28, right: 0, bottom: 0, left: 0 },
  cutoutInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  navigationInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  statusBarHeight: 28, navigationIndicatorHeight: 0, keyboardHeight: 0, systemFontScale: 1,
});
let platformFontScale = 1;
const fontReceipts = [], scheduledFrames = [];
const chromeRequests = [];
// These are platform modifier/measurement receipts. The port records the
// production API calls; it does not estimate widths from character counts.
class NativeModifierPort {
  constructor(resource) { this.resource = resource; this.values = {}; this.calls = []; }
}
for (const method of ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'halfLeading', 'fontColor'])
  NativeModifierPort.prototype[method] = function (...args) {
    this.calls.push({ method, args }); this.values[method] = args.length === 1 ? args[0] : args; return this;
  };
class TextModifierPort extends NativeModifierPort {}
class SymbolGlyphModifierPort extends NativeModifierPort {}
const measurements = [], convertedWidths = [];
let measuredWidths = new Map();
const measureText = options => {
  measurements.push({ ...options });
  return measuredWidths.get(options.textContent) ?? 150;
};
const propertyRuntime = createArkUIPropertyRuntimeProbe();
const probeDependencies = {
  ...visual, ...projection, ...metricsExports,
  ...propertyRuntime.sdk,
  SharedDownloadIdleFrame, ReaderWindowChromeStyle, TextModifier: TextModifierPort, SymbolGlyphModifier: SymbolGlyphModifierPort,
  ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  prepareSharedDownloadFonts: () => new Promise((resolve, reject) => fontReceipts.push({ resolve, reject })),
  ReaderWindowCoordinator: { metrics: () => windowMetrics,
    requestOverlayChrome: style => chromeRequests.push({ owner: 'overlay', style }),
    requestAppChrome: () => chromeRequests.push({ owner: 'app' }) },
  ButtonType: enumValue('ButtonType'), ImageFit: enumValue('ImageFit'), InputType: enumValue('InputType'),
  WordBreak: enumValue('WordBreak'), ScrollAlign: enumValue('ScrollAlign'), ControlSize: enumValue('ControlSize'),
  uiContext: { getHostContext: () => ({ config: { fontSizeScale: platformFontScale } }),
    postFrameCallback: frame => scheduledFrames.push(frame), getMeasureUtils: () => ({ measureText }),
    px2vp: value => { convertedWidths.push(value); return value / 3; } },
};
const probeHooks = propertyRuntime.hooks;
const probe = createReaderBuilderProbe(source, methods, probeDependencies, probeHooks);
const book = {
  ...projection.createDownloadBookView({ sourceId: 'source-one', bookId: 'book-one', title: '晚唐浮生',
    author: '孤独麦客', sourceName: '示例书源', contentKind: 'text', addedAt: 1, coverUrl: 'fixture://cover' }),
  downloadedChapters: 20, totalChapters: 100, state: 'downloading', stateLabel: '下载中',
  progressPercent: 20, bytes: 2048, projectionStatus: 'ready',
};
const another = {
  ...projection.createDownloadBookView({ sourceId: 'source-two', bookId: 'book-two', title: '漫画示例',
    author: '作者', sourceName: '另一书源', contentKind: 'manga', addedAt: 2 }),
  downloadedChapters: 1, totalChapters: 2, state: 'downloaded', stateLabel: '已下载',
  progressPercent: 50, projectionStatus: 'ready',
};
function owner(scheme = 'day', changes = {}, Component = probe.Component) {
  const result = new Component(undefined, {});
  Object.assign(result, { appThemeScheme: scheme, books: [book, another], storageSummary: {}, loading: false, error: '', pendingMessage: '',
    query: '', bookType: 'all', stateFilter: 'all', sourceFilter: 'all', sortField: 'recent', sortDirection: 'desc',
    detailKey: '', managing: false, selectedBookKeys: [], selectedChapterIndices: [], sheet: '',
    actionBookKeys: [], actionChapterIndices: [], confirmation: '', rangeChoice: 'all', rangeStart: '', rangeEnd: '',
    rangeBookKey: '', readingDescription: '', readingIdentity: '', cacheLimitMb: 2048, cleanupAfterDays: 7,
    mounted: true, mountedIdentity: 'visual-test', presentationIdentity: 'visual-test', fontsReady: false, fontsFailed: false,
    fontPreparationGeneration: 0, presentationGeneration: 0, overlayChromeClaimed: false, overlayChromeRequestGeneration: 0,
    readerWindowMetricsRevision: 0,
    initialViewState: { query: '', type: 'all', state: 'all', sourceId: 'all', sort: 'recent', direction: 'desc' },
    readingBookTitle: '', readingChapterTitle: '', listOffset: 0, pageHeight: 0, headerMeasuredHeight: 52, dockMeasuredHeight: 63,
    sheetTitleMeasuredHeight: 48, sheetFooterMeasuredHeight: 76, dialogActionsMeasuredHeight: 44, bookCopyHeights: new Map(), bookContentHeights: new Map(),
    listScroller: { scrollTo() {}, currentOffset: () => ({ yOffset: 0 }) },
    chapterScroller: { scrollTo() {}, scrollToIndex() {} }, onBack() {}, onRefresh() {}, onOpenBook() {},
    onIntent() {}, onReadTarget() {}, onViewStateChanged() {}, onTemporaryBackBridge() {}, ...changes });
  return result;
}
const records = result => [...result.nodes.values(), ...[...result.children.values()].flatMap(child => records(child))];
const label = node => node.type === 'Text' ? node.create : node.createWithLabel?.[0];
const find = (result, predicate, message) => {
  const match = records(result).find(predicate);
  assert.ok(match, message);
  return match;
};
const text = (result, value) => find(result, node => label(node) === value, `rendered SDK actor ${value}`);
const colorIs = (result, property, role) => find(result, node => typeof node[property] === 'string' &&
  argb(node[property]) === palette[result.appThemeScheme][role], `production ${property} consumes demo ${role}`);

for (const scheme of ['day', 'night']) {
  const header = owner(scheme); header.topBar();
  const heading = text(header, '下载管理');
  assert.equal(heading.fontSize, 18); assert.equal(heading.lineHeight, 26);
  const headerBox = find(header, node => node.constraintSize?.minHeight === 52 && node.borderRadius === 18,
    'demo 52px minimum/18px radius top bar');
  colorIs(header, 'backgroundColor', 'surface');
  headerBox.onAreaChange({ height: 52 }, { height: 70 });
  assert.equal(header.contentTop(), 96, 'actual enlarged header measurement moves content instead of clipping it');

  const search = owner(scheme); search.searchField();
  const field = find(search, node => node.type === 'TextInput', 'real production search input');
  assert.equal(field.create.placeholder, '搜索书名、作者、书源');
  assert.equal(field.fontSize, 13); assert.equal(field.lineHeight, 21);
  find(search, node => node.borderRadius === 13 && node.constraintSize?.minHeight === 44,
    'demo search minimum height and radius');
  colorIs(search, 'backgroundColor', 'surface');

  const tabs = owner(scheme, { bookType: 'manga' }); tabs.typeTab('manga', '漫画');
  const tab = text(tabs, '漫画');
  const tabButton = find(tabs, node => node.type === 'Button' && node.constraintSize?.minHeight === 36 &&
    node.borderRadius === 10, 'real tab event actor keeps approved size/radius');
  assert.equal(tab.fontSize, 13); assert.equal(tab.lineHeight, 21);
  assert.equal(argb(tab.fontColor), palette[scheme].green);
  assert.equal(argb(tabButton.backgroundColor), palette[scheme].surface);

  const controls = owner(scheme); controls.listControls();
  text(controls, '2 / 2 本书');
  assert.equal(argb(text(controls, '筛选').fontColor), palette[scheme].ink,
    'the filter label uses the demo neutral ink rather than an accent');
  assert.equal(argb(text(controls, '最近阅读').fontColor), palette[scheme].ink,
    'the sort criterion uses the same demo neutral ink');
  const filteredControls = owner(scheme, { bookType: 'manga' }); filteredControls.listControls();
  text(filteredControls, '1 / 2 本书');
  const searchActor = find(controls, node => node.type === 'TextInput', 'list controls retain their real search field');
  assert.ok(searchActor.id < text(controls, '全部').id, 'search precedes the three type tabs in the real actor tree');
  find(controls, node => node.type === 'Row' && node.create?.space === 4 && node.padding === 4 &&
    node.borderRadius === 13, 'demo tabs keep the approved four-pixel grid gap and padding');
  find(controls, node => node.type === 'Row' && node.create?.space === 12 && node.constraintSize?.minHeight === 39,
    'tools row keeps the approved gap and minimum line box');

  const row = owner(scheme); row.bookRow(() => book, false);
  const title = text(row, book.title), metadata = text(row, row.authorSource(book));
  assert.equal(title.fontSize, 16); assert.equal(title.lineHeight, 24);
  assert.equal(title.layoutWeight, undefined, 'the title span hugs its text so the arrow is adjacent');
  assert.equal(title.flexShrink, 1, 'long titles can shrink and wrap inside the available button');
  find(row, node => node.type === 'Flex' && node.create?.justifyContent === 'FlexAlign.Start',
    'book-title follows authored flex alignment rather than filling the text span');
  find(row, node => node.type === 'Image' && node.create === row.visualIcon('chevron') && node.width === 13 &&
    node.flexShrink === 0 && node.margin?.left === 4, 'the arrow retains its authored size and adjacent gap');
  assert.ok(title.maxLines === undefined || title.maxLines > 1, 'long approved book titles may wrap');
  assert.ok(metadata.maxLines === undefined || metadata.maxLines > 1, 'long author/source metadata may wrap');
  find(row, node => node.type === 'Column' && node.layoutWeight === 1 && node.constraintSize?.minHeight === 80 &&
    node.height === undefined, 'book-copy uses an 80px minimum instead of an 80px clipping height');
  find(row, node => node.type === 'Progress' && node.height === 3, 'actual bottom progress actor is 3px');
  find(row, node => node.type === 'Image' && node.create === book.coverUrl && node.width === 54,
    'approved cover width remains 54px');
  colorIs(row, 'color', 'green');

  const status = owner(scheme); status.statusButton(() => book);
  find(status, node => node.type === 'Button' && node.width === 78 && node.constraintSize?.minHeight === 28 && node.borderRadius === 7,
    'status/action remains the exact 78 by 28 demo control');
  assert.equal(argb(text(status, '下载中').fontColor), palette[scheme].green);
  colorIs(status, 'backgroundColor', 'soft');
  const failed = owner(scheme); failed.statusButton(() => ({ ...book, stateLabel: '下载失败' }));
  assert.equal(argb(text(failed, '下载失败').fontColor), palette[scheme].danger);
  const deletion = owner(scheme); deletion.menuAction(() => '删除本地内容', true, () => true, () => {});
  assert.equal(argb(text(deletion, '删除本地内容').fontColor), palette[scheme].danger);

  const storage = owner(scheme); storage.storageDock();
  find(storage, node => node.type === 'Row' && node.borderRadius === 18 && node.padding?.left === 14 &&
    node.padding?.right === 14 && node.padding?.top === 11 && node.padding?.bottom === 11,
    'storage dock consumes demo box padding/radius');
  colorIs(storage, 'backgroundColor', 'surface');

  const selection = owner(scheme, { managing: true }); selection.selectionDock();
  find(selection, node => node.type === 'Column' && node.padding === 12 && node.borderRadius === 18,
    'selection dock consumes demo box padding/radius');
  colorIs(selection, 'backgroundColor', 'surface');

  const sheet = owner(scheme, { sheet: 'filter' }); sheet.sheetOverlay();
  find(sheet, node => node.type === 'Rect' && node.width === 42 && node.height === 5 && node.radius === 4 &&
    argb(node.fill) === palette[scheme].line, 'handle shape and color are demo-owned');
  const scroll = find(sheet, node => node.type === 'Scroll', 'actual sheet body scroll actor');
  assert.equal(scroll.constraintSize.maxHeight, sheet.sheetBodyMaxHeight());
  assert.equal(scroll.scrollBar, 'BarState.Auto', 'overflow can expose the native platform scrollbar');
  assert.equal(sheet.sheetBodyMaxHeight(), sheet.sheetMaxHeight() - 17 - 48 - 77,
    'body cap deducts actual handle, title and footer from the demo outer bound');
  assert.equal(typeof scroll.constraintSize.maxHeight, 'number', 'no independent 58% body cap');
  find(sheet, node => node.type === 'Column' && node.constraintSize?.maxHeight === sheet.sheetMaxHeight(),
    'outer sheet consumes actual viewport/safe-area bound');
  colorIs(sheet, 'fill', 'scrim');
  assert.equal(text(sheet, '筛选').lineHeight, 26);
  for (const result of [header, controls, row, status, deletion, selection, sheet])
    for (const button of records(result).filter(node => node.type === 'Button')) {
      const creation = result.attributeCalls.find(call => call.id === button.id && call.property === 'createWithChild');
      assert.equal(creation?.args[0]?.type, 'ButtonType.Normal',
        'the actual SDK Button creation explicitly rejects the platform capsule default');
    }
}

const filter = owner('day', { selectedBookKeys: [book.key] }); filter.filterSheet();
const selects = records(filter).filter(node => node.type === 'Select');
assert.equal(selects.length, 2, 'the approved filter uses two selects, not an expanded list of all sources');
assert.deepEqual(selects[0].create.map(item => item.value), ['全部状态', '下载中', '已下载', '未下载']);
assert.deepEqual(selects[1].create.map(item => item.value), ['全部书源', '示例书源', '另一书源']);
selects[0].onSelect(1); assert.equal(filter.stateFilter, 'downloading');
selects[1].onSelect(2); assert.equal(filter.sourceFilter, 'source-two');
assert.deepEqual(filter.selectedBookKeys, [], 'real filter callbacks retire previous selections');

function assertSelectModifiers(select, scheme, quick = false, expectedHeight = quick ? 28 : 31) {
  if (select.readerInline === true) return;
  const role = quick ? readerTypographyRoles.TYPE_DOWNLOAD_QUICK_SELECT : readerTypographyRoles.TYPE_DOWNLOAD_BODY;
  const textStyle = select.textModifier;
  assert.ok(textStyle instanceof TextModifierPort, 'Select receives the production TextModifier instance');
  assert.deepEqual(textStyle.values, { fontFamily: role.fontFamily, fontWeight: 400,
    fontSize: quick ? 11 : 13, lineHeight: quick ? 18 : 21, halfLeading: true,
    fontColor: visual.downloadVisualColor(quick ? 'muted' : 'ink', scheme) });
  assert.equal(select.font.size, quick ? 11 : 13);
  assert.equal(select.font.family, role.fontFamily); assert.equal(select.font.weight, 400);
  assert.ok(select.arrowModifier instanceof SymbolGlyphModifierPort);
  assert.equal(select.arrowModifier.resource, 'sys.symbol.chevron_down');
  assert.equal(select.arrowModifier.values.fontSize, '12vp', 'the arrow keeps a fixed viewport size when the system scales text');
  assert.deepEqual(select.arrowModifier.values.fontColor.map(argb), [palette[scheme][quick ? 'muted' : 'ink']]);
  assert.equal(select.controlSize, 'ControlSize.SMALL');
  assert.equal(select.space, 8, 'the system glyph sits in the authored twenty-pixel arrow slot');
  assert.equal(select.height, expectedHeight);
}
for (const select of selects) assertSelectModifiers(select, 'day');
for (const scheme of ['day', 'night']) {
  const settingsSelects = owner(scheme); settingsSelects.settingsSheet();
  const settingsActors = records(settingsSelects).filter(node => node.type === 'Select');
  assert.equal(settingsActors.length, 2);
  for (const select of settingsActors) {
    assertSelectModifiers(select, scheme);
    assert.equal(select.width, 88, 'the approved storage v2 closed controls have a fixed ordinary-window width');
  }
  const quickSelect = owner(scheme, { managing: true }); quickSelect.chapterToolbar(() => book);
  const quickActor = find(quickSelect, node => node.type === 'Select', 'the actual inline chapter quick-select');
  assertSelectModifiers(quickActor, scheme, true);
  assert.equal(argb(text(quickSelect, '章节内容').fontColor), palette[scheme].muted,
    'chapter-toolbar title inherits the demo muted foreground');
  const rangeSelect = owner(scheme, { actionBookKeys: [book.key, another.key], rangeBookKey: book.key }); rangeSelect.rangeSheet();
  const rangeActor = find(rangeSelect, node => node.type === 'Select', 'the existing multi-book range selector');
  assertSelectModifiers(rangeActor, scheme, false, 39);
  assert.equal(rangeActor.width, '100%', 'the existing range-book control retains its full body width');
}

// The actual MeasureUtils API owns font metrics and scaling. Distinct chosen
// receipts prove current-value/option coverage, px->vp conversion and caps
// without reimplementing a text-measurement or character-count algorithm.
const measurementMetrics = windowMetrics;
const measurementOwner = owner();
measuredWidths = new Map([['当前值很长', 420], ['短', 42], ['选项甲', 90], ['选项乙', 300],
  ['下载状态', 180], ['章节内容', 240], ['快速选择', 90], ['当前章节', 120], ['从当前往后', 270], ['全部章节', 150]]);
let measurementStart = measurements.length, conversionStart = convertedWidths.length;
assert.equal(measurementOwner.selectClosedWidth('当前值很长', ['选项甲', '选项乙'], 500, '下载状态'), 170);
let measured = measurements.slice(measurementStart);
assert.deepEqual(measured.map(call => call.textContent), ['当前值很长', '选项甲', '选项乙', '下载状态']);
for (const call of measured) assert.deepEqual({ fontSize: call.fontSize, fontFamily: call.fontFamily, fontWeight: call.fontWeight },
  { fontSize: 13, fontFamily: readerTypographyRoles.TYPE_DOWNLOAD_BODY.fontFamily, fontWeight: 400 });
assert.deepEqual(convertedWidths.slice(conversionStart), [180, 420], 'native pixel receipts are converted exactly once at the platform boundary');
assert.equal(measurementOwner.selectClosedWidth('短', ['选项甲', '选项乙'], 500, '下载状态'), 130,
  'the longest option remains measured when the current selection is short');
assert.equal(measurementOwner.selectClosedWidth('当前值很长', ['选项甲', '选项乙'], 130, '下载状态'), 130,
  'settings controls honor their actual authored maximum');
measurementStart = measurements.length;
assert.equal(measurementOwner.selectClosedWidth('快速选择', ['快速选择', '当前章节', '从当前往后', '全部章节'],
  145, '章节内容', true), 120);
measured = measurements.slice(measurementStart);
assert.deepEqual(measured.map(call => call.textContent), ['快速选择', '快速选择', '当前章节', '从当前往后', '全部章节', '章节内容']);
for (const call of measured.slice(0, -1)) assert.deepEqual({ fontSize: call.fontSize, fontFamily: call.fontFamily, fontWeight: call.fontWeight },
  { fontSize: 11, fontFamily: readerTypographyRoles.TYPE_DOWNLOAD_QUICK_SELECT.fontFamily, fontWeight: 400 });
assert.deepEqual({ fontSize: measured.at(-1).fontSize, fontFamily: measured.at(-1).fontFamily, fontWeight: measured.at(-1).fontWeight },
  { fontSize: 16, fontFamily: readerTypographyRoles.TYPE_DOWNLOAD_BOOK_TITLE.fontFamily, fontWeight: 700 });
windowMetrics = { ...measurementMetrics, windowRect: { ...measurementMetrics.windowRect, width: 140 } };
assert.equal(measurementOwner.selectClosedWidth('当前值很长', ['选项甲', '选项乙'], 130, '下载状态'), 34,
  'the remaining row width deducts the real label measurement and authored sides/gap');
windowMetrics = { ...measurementMetrics, systemFontScale: 2 };
measurementStart = measurements.length;
measurementOwner.selectClosedWidth('快速选择', ['从当前往后'], 145, '章节内容', true);
assert.deepEqual(measurements.slice(measurementStart).map(call => call.fontSize), [11, 11, 16],
  'MeasureUtils receives original fp sizes even when the system scales fonts');
const scaledSelect = owner(); scaledSelect.filterSheet();
for (const select of records(scaledSelect).filter(node => node.type === 'Select')) assertSelectModifiers(select, 'day', false, 52);
const scaledQuick = owner('day', { managing: true }); scaledQuick.chapterToolbar(() => book);
assertSelectModifiers(find(scaledQuick, node => node.type === 'Select', 'large-font quick-select'), 'day', true, 46);
windowMetrics = measurementMetrics; measuredWidths = new Map();

const longBook = { ...book, key: 'long-book', title: '超长书名用来检查真实标题不会被限制为单行'.repeat(3),
  author: '很长的作者名称'.repeat(4), sourceLabel: '很长的书源名称'.repeat(4) };
const longRow = owner('day', { books: [longBook] }); longRow.bookRow(() => longBook, false);
const copy = find(longRow, node => node.type === 'Column' && node.layoutWeight === 1 &&
  node.constraintSize?.minHeight === 80 && typeof node.onAreaChange === 'function',
  'book content owns the real measurement callback');
copy.onAreaChange({ height: 80 }, { height: 137 });
assert.equal(longRow.bookHeight(longBook.key), 137, 'a measured multiline book expands its cover');
longRow.replay();
assert.equal(find(longRow, node => node.type === 'Image' && node.create === longBook.coverUrl,
  'actual long-book cover').height, 137, 'the retained cover callback consumes current content height');
const measuredMap = longRow.bookCopyHeights;
copy.onAreaChange({ height: 137 }, { height: 137 });
assert.equal(longRow.bookCopyHeights, measuredMap, 'an unchanged receipt does not publish a new height Map');
copy.onAreaChange({ height: 137 }, { height: 80 });
assert.equal(longRow.bookHeight(longBook.key), 80, 'a shorter measured row can shrink the previous cover');
longRow.replay();
assert.equal(find(longRow, node => node.type === 'Image' && node.create === longBook.coverUrl,
  'actual shorter cover').height, 80, 'cover synchronization does not preserve an earlier tall maximum');
const content = find(longRow, node => node.type === 'Column' && node.layoutWeight === undefined &&
  typeof node.onAreaChange === 'function', 'the natural text-content measurement actor');
content.onAreaChange({ height: 70 }, { height: 134 });
assert.equal(longRow.bookProgressSpacer(longBook.key), 0);
const contentMap = longRow.bookContentHeights;
content.onAreaChange({ height: 134 }, { height: 134 });
assert.equal(longRow.bookContentHeights, contentMap, 'unchanged natural content height does not republish');
content.onAreaChange({ height: 134 }, { height: 70 });
assert.equal(longRow.bookProgressSpacer(longBook.key), 7, 'the min-height spacer recovers after content shrinks');

// Font I/O is the isolated boundary; the page's real promise callbacks and
// retirement methods decide whether a receipt may publish readiness.
const microtasks = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const acceptedScrolls = [];
const activeFonts = owner('day', { listScroller: { scrollTo: value => acceptedScrolls.push(value),
  currentOffset: () => ({ yOffset: 0 }) } }); activeFonts.prepareFonts();
assert.equal(activeFonts.fontsReady, false, 'a pending receipt cannot admit the native text surface');
fontReceipts.at(-1).resolve(true); await microtasks();
assert.equal(activeFonts.fontsReady, true, 'the current checked receipt admits the production surface');
assert.equal(activeFonts.fontsFailed, false);
const frameCount = scheduledFrames.length;
const admittedFrame = scheduledFrames.at(-1);
activeFonts.aboutToDisappear(); admittedFrame.onIdle();
assert.deepEqual(acceptedScrolls, [], 'an admitted-but-later-retired frame cannot restore a stale list');
const pendingScrolls = [];
const pendingAppear = owner('day', { listScroller: { scrollTo: value => pendingScrolls.push(value),
  currentOffset: () => ({ yOffset: 0 }) } });
const beforePending = scheduledFrames.length;
pendingAppear.aboutToAppear();
for (const frame of scheduledFrames.slice(beforePending)) frame.onIdle();
assert.deepEqual(pendingScrolls, [], 'font-pending appearance never scrolls an unmounted List');
assert.equal(scheduledFrames.length, beforePending, 'appearance waits for actual font admission before scheduling restore');
pendingAppear.aboutToDisappear(); fontReceipts.at(-1).resolve(true); await microtasks();
const retiredFonts = owner(); retiredFonts.prepareFonts();
const retiredReceipt = fontReceipts.at(-1);
retiredFonts.aboutToDisappear(); retiredReceipt.resolve(true); await microtasks();
assert.equal(retiredFonts.fontsReady, false, 'a late successful receipt cannot publish after actual retirement');
assert.equal(retiredFonts.fontsFailed, false);
assert.equal(scheduledFrames.length, frameCount, 'retired receipt cannot enqueue scroll restoration');
const retiredFailure = owner(); retiredFailure.prepareFonts();
const failedReceipt = fontReceipts.at(-1);
retiredFailure.aboutToDisappear(); failedReceipt.reject(new Error('font platform boundary')); await microtasks();
assert.equal(retiredFailure.fontsFailed, false, 'a late font rejection cannot publish an error after retirement');
const remountedFonts = owner(); remountedFonts.prepareFonts();
const oldMountReceipt = fontReceipts.at(-1);
remountedFonts.aboutToDisappear(); remountedFonts.aboutToAppear();
fontReceipts.at(-1).resolve(true); await microtasks();
assert.equal(remountedFonts.fontsReady, true);
oldMountReceipt.resolve(false); await microtasks();
assert.equal(remountedFonts.fontsReady, true, 'an old mount cannot undo a newer receipt with the same presentation identity');
assert.equal(remountedFonts.fontsFailed, false);

// Reuse the production helpers against changing platform data. Attribute
// checks deliberately do not pretend that a native layout pass took place.
const geometry = owner();
assert.equal(geometry.headerTop(), 10, 'Index owns the actual status-bar inset; the local frame adds only the demo gap');
assert.equal(geometry.contentTop(), 78);
assert.equal(geometry.headerTop() + windowMetrics.systemInsets.top, 38, 'the full-window top matches demo without a second safe inset');
assert.equal(geometry.contentTop() + windowMetrics.systemInsets.top, 106);
assert.equal(geometry.fontScale(), 1);
platformFontScale = 2; windowMetrics.systemFontScale = 2; assert.equal(geometry.fontScale(), 2);
platformFontScale = NaN; windowMetrics.systemFontScale = NaN; assert.equal(geometry.fontScale(), 1);
platformFontScale = 1; windowMetrics.systemFontScale = 1;
const originalSheetMax = geometry.sheetMaxHeight();
const originalWindowMetrics = windowMetrics;
windowMetrics = { ...windowMetrics, windowRect: { ...windowMetrics.windowRect, height: 400 },
  systemInsets: { top: 150, right: 30, bottom: 150, left: 26 }, statusBarHeight: 150 };
geometry.sheet = 'filter';
assert.equal(geometry.sheetMaxHeight(), 205, 'outer bound consumes the actual remaining Index content frame');
assert.ok(geometry.sheetMaxHeight() < originalSheetMax);
assert.equal(geometry.sheetBodyMaxHeight(), 0, 'occluding bottom area is reserved by the footer before content scroll sizing');
assert.ok(geometry.leftInset() >= 26 && geometry.rightInset() >= 30,
  'production horizontal geometry consumes changed platform safe edges');
assert.equal(geometry.sheetChromeOverflow(), true);
const shortSheet = owner('day', { sheet: 'filter' }); shortSheet.sheetOverlay();
const shortScrolls = records(shortSheet).filter(node => node.type === 'Scroll');
assert.equal(shortScrolls.length, 1, 'short sheets scroll the entire document without a nested zero-height body');
assert.equal(shortScrolls[0].constraintSize.maxHeight, shortSheet.sheetMaxHeight());
assert.equal(records(shortSheet).filter(node => node.type === 'Select').length, 2);
text(shortSheet, '筛选'); text(shortSheet, '完成');
const compactMain = owner('day', { fontsReady: true });
assert.equal(compactMain.mainChromeOverflow(), true); compactMain.initialRender();
// The SDK emits lazy ListItem creation callbacks. Admit those actual callbacks
// before inspecting the compact document, as the existing bookshelf probes do.
for (const node of records(compactMain))
  if (node.type === 'ListItem' && Array.isArray(node.create) && typeof node.create[0] === 'function') node.create[0]();
const compactList = find(compactMain, node => node.type === 'List', 'real compact document List');
assert.equal(compactList.scrollBar, 'BarState.Auto', 'demo thin/auto overflow is not forcibly hidden');
assert.deepEqual(compactList.padding, { top: 0, bottom: 0 }, 'short page does not reserve impossible floating-bar padding');
assert.equal(records(compactMain).filter(node => label(node) === '下载管理').length, 1,
  'the header exists once in the scroll document');
assert.ok(!records(compactMain).some(node => node.position?.y === compactMain.headerTop()),
  'compact page does not render a duplicate floating header');
find(compactMain, node => node.type === 'Row' && node.borderRadius === 18 && node.padding?.left === 14,
  'the normal storage dock remains present in the compact scroll document');

const shortDialog = owner('day', { confirmation: 'deleteLocal', pageHeight: 100, actionBookKeys: [book.key] });
assert.equal(shortDialog.dialogChromeOverflow(), true);
shortDialog.confirmationOverlay();
const dialogScrolls = records(shortDialog).filter(node => node.type === 'Scroll');
assert.equal(dialogScrolls.length, 1, 'short confirmation scrolls text and both actions together');
assert.equal(dialogScrolls[0].constraintSize.maxHeight, 100);
assert.equal(shortDialog.dialogOuterPaddingY(), 0, 'only vertical outer padding yields in an extreme short window');
text(shortDialog, '删除本地内容？（1本书）'); text(shortDialog, '取消'); text(shortDialog, '删除内容');
const normalDialog = owner('day', { confirmation: 'cancel', pageHeight: 800 });
assert.equal(normalDialog.dialogChromeOverflow(), false);
assert.equal(normalDialog.dialogOuterPaddingY(), 24, 'ordinary windows retain approved dialog outer padding');
assert.equal(normalDialog.dialogBodyMaxHeight(), 668);
normalDialog.confirmationOverlay();
assert.equal(records(normalDialog).filter(node => node.type === 'Scroll').length, 1);
find(normalDialog, node => node.type === 'Scroll' && node.constraintSize?.maxHeight === 668,
  'normal confirmation keeps only its body scrollable');

// Execute the SDK's actual StorageLink getter/property implementation and dirty
// callback delivery. Changing only the coordinator snapshot cannot refresh a
// retained observer; the page must consume its revision inside those callbacks.
windowMetrics = originalWindowMetrics;
const reactivePage = owner('day', { fontsReady: true, pageHeight: 800 });
reactivePage.initialRender(); reactivePage.searchField();
const safeFrame = find(reactivePage, node => node.type === 'Column' && node.position?.y === 10 && node.padding?.left === 16,
  'normal floating header consumes the reactive safe frame');
const reactiveInput = find(reactivePage, node => node.type === 'TextInput' && node.height === 42,
  'baseline editable search line box');
const dependentIds = propertyRuntime.dependencies.get(reactivePage)?.get('readerWindowMetricsRevision');
assert.ok(dependentIds?.size > 0, 'SDK render observers subscribe to the actual StorageLink getter');
const observerCount = reactivePage.observers.length;
windowMetrics = { ...originalWindowMetrics, systemFontScale: 2,
  systemInsets: { ...originalWindowMetrics.systemInsets, left: 32, right: 26 } };
reactivePage.readerWindowMetricsRevision += 1;
propertyRuntime.flush();
assert.equal(safeFrame.padding.left, 32); assert.equal(safeFrame.padding.right, 26);
assert.equal(reactiveInput.height, 60, 'retained input geometry follows the changed system font scale');
assert.equal(reactivePage.observers.length, observerCount, 'metric changes update retained attributes without remounting the document');
windowMetrics = originalWindowMetrics;

const completeChapter = { key: JSON.stringify([book.sourceId, book.bookId, 0]), sourceId: book.sourceId, bookId: book.bookId, index: 0,
  title: '第一章', chapterId: 'chapter:0', navigable: true, localComplete: true,
  stateLabel: '已下载', queueState: 'cached', cachedBytes: 100 };
for (const scheme of ['day', 'night']) {
  const chapterRow = owner(scheme); chapterRow.chapterRow(() => book, () => completeChapter);
  text(chapterRow, '正文已保存 · 已下载');
  find(chapterRow, node => node.type === 'Row' && node.create?.space === 2, 'chapter actions share the authored independent tail');
  find(chapterRow, node => node.type === 'Button' && node.width === 30 && node.height === 44,
    'chapter more has its own dimensions instead of using the book slot');
  const running = owner(scheme); running.chapterRow(() => book, () => ({ ...completeChapter, localComplete: false,
    stateLabel: '下载中', queueState: 'inProgress' }));
  assert.equal(argb(text(running, '第一章').fontColor), palette[scheme].green);
  text(running, '正在获取正文 · 下载中');
  const queued = owner(scheme); queued.chapterRow(() => book, () => ({ ...completeChapter, localComplete: false,
    stateLabel: '下载中', queueState: 'queued' }));
  assert.equal(argb(text(queued, '第一章').fontColor), palette[scheme].ink, 'queued is not the active download title');
  const secondaryFailure = owner(scheme); secondaryFailure.bookRow(() => ({ ...book, stateLabel: '下载失败' }), true);
  assert.equal(argb(text(secondaryFailure, '下载失败').fontColor), palette[scheme].danger);
}
// Storage v2 consumes verified structured values. The protected portion of
// automatic storage is visible but must not become an executable candidate.
const storageMiB = 1024 * 1024, storageGiB = storageMiB * 1024;
const storageSummaryFixture = { totalBytes: 3 * storageGiB, retainedBytes: storageGiB,
  automaticBytes: 2 * storageGiB, cleanableBytes: 512 * storageMiB, availableBytes: 8 * storageGiB };
for (const scheme of ['day', 'night']) {
  const storageSettings = owner(scheme, { storageSummary: { ...storageSummaryFixture } });
  storageSettings.settingsSheet(); storageSettings.clearStorageButton();
  for (const title of ['已下载内容', '保留下载', '长期保留，仅手动删除', '自动保存',
    '阅读时保存，按设置自动清理', '设备可用空间', '自动保存设置', '空间上限', '多久未阅读后清理'])
    text(storageSettings, title);
  const total = text(storageSettings, '3.0 GB'), retained = text(storageSettings, '1.0 GB');
  const automatic = text(storageSettings, '2.0 GB'), available = text(storageSettings, '8.0 GB');
  assert.equal(total.fontSize, 22); assert.equal(total.lineHeight, 30); assert.equal(total.fontWeight, 500);
  for (const actor of [retained, automatic]) {
    assert.equal(actor.fontSize, 14); assert.equal(actor.lineHeight, 22); assert.equal(actor.fontWeight, 500);
  }
  for (const caption of ['长期保留，仅手动删除', '阅读时保存，按设置自动清理', '自动保存设置']) {
    const actor = text(storageSettings, caption);
    assert.equal(actor.fontSize, 11); assert.equal(actor.lineHeight, 18);
    assert.equal(argb(actor.fontColor), palette[scheme].muted);
  }
  find(storageSettings, node => node.type === 'Flex' && node.create?.alignItems === 'ItemAlign.Baseline',
    'the total summary follows the authored baseline alignment');
  for (const numeric of [total, retained, automatic, available]) assert.equal(numeric.fontFeature, '"tnum" 1',
    'numeric slots request the original tabular figure feature without promising native raster identity');
  assert.equal(argb(total.fontColor), palette[scheme].ink);
  assert.equal(argb(available.fontColor), palette[scheme].muted);
  const clearButton = find(storageSettings, node => node.type === 'Button', 'actual v2 storage cleanup action');
  const cleanupVisual = find(storageSettings, node => node.type === 'Row' && node.accessibilityLevel === 'no-hide-descendants',
    'authored cleanup pixels remain outside the real disabled Button render layer');
  const cleanupText = text(storageSettings, '清理自动保存 · 512 MB');
  assert.equal(clearButton.width, 'LayoutPolicy.matchParent'); assert.equal(clearButton.height, 'LayoutPolicy.matchParent');
  assert.equal(clearButton.enabled, true); assert.equal(clearButton.backgroundColor, 'Color.Transparent');
  assert.equal(clearButton.accessibilityText, '清理自动保存 · 512 MB');
  assert.equal(cleanupVisual.width, '100%'); assert.equal(cleanupVisual.opacity, 1);
  assert.equal(cleanupVisual.hitTestBehavior, 'HitTestMode.None');
  assert.equal(cleanupVisual.renderGroup, true, 'CSS opacity blends the complete authored button as one group');
  assert.equal(cleanupVisual.constraintSize.minHeight, 44);
  assert.equal(argb(cleanupVisual.backgroundColor), palette[scheme].green);
  assert.equal(argb(cleanupText.fontColor), palette[scheme].greenInk);
  assert.ok(!label(cleanupText).includes('2.0 GB'), 'in-use automatic bytes do not inflate the cleanup label');
  const valueActors = [total, retained, automatic, available];
  const retainedIds = valueActors.map(actor => actor.id);
  storageSettings.storageSummary = {}; propertyRuntime.flush();
  assert.deepEqual(valueActors.map(label), ['', '', '', ''], 'unknown capacity keeps the existing four numeric slots blank');
  assert.deepEqual(valueActors.map(actor => storageSettings.nodes.get(actor.id)?.id), retainedIds,
    'fresh summary publications update retained rows without replacing them');
  assert.ok(valueActors.every(actor => actor.constraintSize?.minHeight > 0), 'missing values keep their line boxes');
  const summaryRow = find(storageSettings, node => node.type === 'Flex', 'retained total summary owner');
  assert.equal(summaryRow.create.alignItems, 'ItemAlign.Start');
  assert.equal(summaryRow.constraintSize.minHeight, visual.DOWNLOAD_VISUAL.storageUnknownSummaryMinHeight);
  assert.equal(text(storageSettings, '已下载内容').margin.top, visual.DOWNLOAD_VISUAL.storageUnknownSummaryLabelTop);
  assert.equal(visual.DOWNLOAD_VISUAL.storageUnknownSummaryMinHeight, 35);
  assert.equal(visual.DOWNLOAD_VISUAL.storageUnknownSummaryLabelTop, 14);
  assert.equal(clearButton.enabled, false);
  assert.equal(clearButton.backgroundColor, 'Color.Transparent');
  assert.equal(clearButton.accessibilityText, '清理自动保存');
  assert.equal(argb(cleanupVisual.backgroundColor), palette[scheme].soft);
  assert.equal(cleanupVisual.opacity, 0.5, 'disabled pixels follow the approved computed CSS opacity once, without ButtonPattern alpha');
  assert.equal(manifest.storageProvenance.storageActionDisabledOpacity.measured, 0.5,
    'the real full cascade, not the lower-specificity opacity declaration, owns disabled appearance');
  assert.equal(argb(cleanupText.fontColor), palette[scheme].muted);
  storageSettings.storageSummary = { totalBytes: 0, retainedBytes: 0, automaticBytes: 0, cleanableBytes: 0, availableBytes: 0 };
  propertyRuntime.flush();
  assert.deepEqual(valueActors.map(label), ['0 MB', '0 MB', '0 MB', '0 MB'], 'proven zero values remain visible');
  assert.equal(summaryRow.create.alignItems, 'ItemAlign.Baseline');
  assert.equal(text(storageSettings, '已下载内容').margin.top, 0);
  assert.equal(clearButton.enabled, false, 'a zero-candidate cleanup is disabled');
  storageSettings.storageSummary = { ...storageSummaryFixture }; propertyRuntime.flush();
  assert.deepEqual(valueActors.map(label), ['3.0 GB', '1.0 GB', '2.0 GB', '8.0 GB']);
  assert.equal(clearButton.enabled, true);
  assert.equal(cleanupVisual.opacity, 1, 'known executable candidates restore the authored enabled opacity');
  assert.equal(argb(cleanupVisual.backgroundColor), palette[scheme].green);
  assert.equal(clearButton.accessibilityText, '清理自动保存 · 512 MB');
}
const liveCleanupDialog = owner('day', { storageSummary: { ...storageSummaryFixture },
  sheet: 'settings', confirmation: 'cleanup' });
liveCleanupDialog.confirmationOverlay();
const liveCleanupLabel = text(liveCleanupDialog, '清理 512 MB');
const liveCleanupConfirm = records(liveCleanupDialog).filter(node => node.type === 'Button').at(-1);
assert.equal(liveCleanupConfirm.enabled, true);
liveCleanupDialog.storageSummary = { ...storageSummaryFixture, cleanableBytes: 0 }; propertyRuntime.flush();
assert.equal(label(liveCleanupLabel), '清理 0 MB', 'retained confirmation text consumes the latest candidate value');
assert.equal(liveCleanupConfirm.enabled, false, 'a candidate refresh disables an already-open confirmation');
const storageBeforeCompact = windowMetrics;
windowMetrics = { ...windowMetrics, windowRect: { ...windowMetrics.windowRect, width: 140, height: 120 }, systemFontScale: 2 };
const compactStorage = owner('day', { sheet: 'settings', storageSummary: { ...storageSummaryFixture }, pageHeight: 120 });
compactStorage.sheetOverlay();
assert.equal(compactStorage.sheetChromeOverflow(), true);
assert.equal(records(compactStorage).filter(node => node.type === 'Scroll').length, 1,
  'a short storage sheet scrolls title, summary, settings and cleanup together');
text(compactStorage, '已下载内容'); text(compactStorage, '清理自动保存 · 512 MB');
for (const select of records(compactStorage).filter(node => node.type === 'Select')) {
  assertSelectModifiers(select, 'day', false, 52);
  assert.ok(select.width <= 104 && select.width >= 0, 'closed settings remain within the actual narrow sheet body');
}
windowMetrics = storageBeforeCompact;
const managedStatus = owner('day', { managing: true }); managedStatus.statusButton(() => book);
const managedButton = find(managedStatus, node => node.type === 'Button', 'actual managed status control');
assert.equal(managedButton.enabled, false); assert.equal(managedButton.opacity, 0.5);
managedButton.onClick(); assert.equal(managedStatus.sheet, ''); assert.deepEqual(managedStatus.actionBookKeys, []);
const chapterConfirmation = owner('day', { confirmation: 'deleteLocal', actionBookKeys: [book.key], actionChapterIndices: [0, 1] });
chapterConfirmation.confirmationOverlay();
text(chapterConfirmation, '确认删除内容 · 2章？');
text(chapterConfirmation, '仅删除所选章节的本地内容，并取消这些章节的剩余下载。书架和阅读记录保留。');

// Mount the SDK's deferred ListItem bodies once. ForEach's existing native
// boundary retains each stable key; property updates only deliver dirty SDK
// observers. No data revision is appended to a row's identity.
function admitListItems(result) {
  const admitted = new Set();
  let pending;
  do {
    pending = records(result).filter(node => node.type === 'ListItem' && !admitted.has(node.id) &&
      Array.isArray(node.create) && typeof node.create[0] === 'function');
    for (const node of pending) { admitted.add(node.id); node.create[0](); }
  } while (pending.length > 0);
}
const countActor = result => find(result, node => node.type === 'Text' && node.layoutWeight === 1 &&
  node.fontSize === 11 && typeof node.onClick === 'function', 'the retained download-count actor');
windowMetrics = originalWindowMetrics;
const unloadedBook = projection.createDownloadBookView(book.shelfBook);
const readyWithoutToc = projection.projectDownloadBookAvailability(unloadedBook, [], undefined, 0);
const openedBooks = [], restoredOffsets = [];
const retainedScroller = { scrollTo: value => restoredOffsets.push(value), currentOffset: () => ({ yOffset: 87 }) };
const retainedBooks = owner('day', { books: [unloadedBook], fontsReady: true, listScroller: retainedScroller,
  onOpenBook: value => openedBooks.push(value) });
retainedBooks.bookPage(); admitListItems(retainedBooks);
const retainedList = find(retainedBooks, node => node.type === 'List', 'the retained native List');
const retainedTitle = text(retainedBooks, book.title), retainedAuthor = text(retainedBooks, retainedBooks.authorSource(book));
const retainedCount = countActor(retainedBooks);
const retainedProgress = find(retainedBooks, node => node.type === 'Progress', 'the retained native progress actor');
const initialListItems = records(retainedBooks).filter(node => node.type === 'ListItem').map(node => node.id);
assert.equal(label(retainedCount), '');
assert.equal(retainedProgress.visibility, 'Visibility.Hidden');
const bookDependencies = propertyRuntime.dependencies.get(retainedBooks)?.get('books');
assert.ok(bookDependencies?.has(retainedCount.id) && bookDependencies.has(retainedProgress.id),
  'the actual Prop getter is read inside both retained value observers');
for (const nextBook of [readyWithoutToc, { ...unloadedBook, projectionStatus: 'unavailable', projectionError: '读取失败' },
  { ...readyWithoutToc, author: '新作者' }]) {
  retainedBooks.books = [nextBook];
  propertyRuntime.flush();
  assert.equal(label(retainedCount), retainedBooks.downloadCount(nextBook, false));
  assert.equal(retainedProgress.create.value, nextBook.progressPercent ?? 0);
  assert.equal(retainedProgress.visibility, nextBook.progressPercent === undefined ? 'Visibility.Hidden' : 'Visibility.Visible');
  assert.equal(retainedBooks.nodes.get(retainedTitle.id), retainedTitle);
  assert.equal(retainedBooks.nodes.get(retainedAuthor.id), retainedAuthor);
  assert.equal(label(retainedAuthor), retainedBooks.authorSource(nextBook));
  assert.deepEqual(records(retainedBooks).filter(node => node.type === 'ListItem').map(node => node.id), initialListItems,
    'same-key replacement keeps the native row identities');
  assert.equal(retainedList.create.scroller, retainedScroller);
  assert.equal(retainedBooks.listScroller, retainedScroller);
  assert.deepEqual(restoredOffsets, [], 'metadata replacement does not restore or reset scroll');
}
const currentBookEvent = retainedAuthor.onClick;
currentBookEvent();
assert.equal(openedBooks.at(-1).author, '新作者', 'the retained event resolves the newest DTO');
retainedBooks.detailKey = '';
const openedCount = openedBooks.length;
retainedBooks.books = []; currentBookEvent();
assert.equal(openedBooks.length, openedCount, 'a removed row cannot deliver a late event');
retainedBooks.books = [readyWithoutToc]; propertyRuntime.flush();
retainedBooks.aboutToDisappear(); currentBookEvent();
assert.equal(openedBooks.length, openedCount, 'retirement fences a retained book callback');
retainedBooks.aboutToAppear(); currentBookEvent();
assert.equal(openedBooks.length, openedCount, 'same-identity remount does not revive an earlier generation callback');
retainedBooks.aboutToDisappear();

// A separate already-present status branch covers non-zero progress changes.
// Native branch removal is outside this probe; its existing boundary is not
// expanded to disguise that limitation.
const progressScroller = { scrollTo: value => restoredOffsets.push(value), currentOffset: () => ({ yOffset: 87 }) };
const progressPage = owner('day', { books: [book], fontsReady: true, listScroller: progressScroller });
progressPage.bookPage(); admitListItems(progressPage);
const progressCount = countActor(progressPage);
const progressValue = find(progressPage, node => node.type === 'Progress', 'the existing non-zero progress actor');
const progressRowIds = records(progressPage).filter(node => node.type === 'ListItem').map(node => node.id);
const progressList = find(progressPage, node => node.type === 'List', 'the existing progress List');
progressPage.books = [{ ...book, downloadedChapters: 77, progressPercent: 77 }]; propertyRuntime.flush();
assert.equal(label(progressCount), '已下载 77 / 100 章');
assert.equal(progressValue.create.value, 77);
assert.equal(progressPage.nodes.get(progressValue.id), progressValue);
assert.deepEqual(records(progressPage).filter(node => node.type === 'ListItem').map(node => node.id), progressRowIds);
assert.equal(progressList.create.scroller, progressScroller);
assert.deepEqual(restoredOffsets, []);

const readTargets = [];
const chapterBook = { ...book, totalChapters: 1, chapters: [{ ...completeChapter, localComplete: false,
  stateLabel: '下载中', queueState: 'inProgress', cachedBytes: 0 }] };
const retainedChapterScroller = { scrollTo() {}, scrollToIndex() {} };
const retainedChapters = owner('day', { books: [chapterBook], fontsReady: true,
  chapterScroller: retainedChapterScroller, onReadTarget: value => readTargets.push(value) });
retainedChapters.chapterPage(retainedChapters.bookGetter(chapterBook)); admitListItems(retainedChapters);
const chapterList = find(retainedChapters, node => node.type === 'List', 'the retained chapter List');
const chapterTitle = text(retainedChapters, '第一章');
const chapterDetail = text(retainedChapters, '正在获取正文 · 下载中');
const chapterActionLabel = text(retainedChapters, '暂停');
const chapterItemIds = records(retainedChapters).filter(node => node.type === 'ListItem').map(node => node.id);
retainedChapters.books = [{ ...chapterBook, chapters: [completeChapter] }]; propertyRuntime.flush();
assert.equal(label(chapterDetail), '正文已保存 · 已下载');
assert.equal(label(chapterActionLabel), '阅读');
assert.equal(argb(chapterTitle.fontColor), palette.day.ink);
assert.equal(retainedChapters.nodes.get(chapterTitle.id), chapterTitle);
assert.equal(retainedChapters.nodes.get(chapterDetail.id), chapterDetail);
assert.deepEqual(records(retainedChapters).filter(node => node.type === 'ListItem').map(node => node.id), chapterItemIds);
assert.equal(chapterList.create.scroller, retainedChapterScroller);
const currentChapterEvent = chapterTitle.onClick;
currentChapterEvent(); assert.equal(readTargets.at(-1).chapterId, completeChapter.chapterId);
assert.equal(readTargets.at(-1).route, 'novelReader'); assert.equal(readTargets.at(-1).wired, true);
const targetCount = readTargets.length;
retainedChapters.books = [{ ...chapterBook, chapters: [] }]; propertyRuntime.flush(); currentChapterEvent();
assert.equal(readTargets.length, targetCount, 'a removed chapter cannot dispatch a stale reading target');
retainedChapters.books = [{ ...chapterBook, chapters: [completeChapter] }]; propertyRuntime.flush();
retainedChapters.aboutToDisappear(); currentChapterEvent();
assert.equal(readTargets.length, targetCount);
retainedChapters.aboutToAppear(); currentChapterEvent();
assert.equal(readTargets.length, targetCount, 'a same-key chapter callback remains fenced after remount');
retainedChapters.aboutToDisappear();

// Negative control lowers the actual component after replacing only the
// repaired getter with the previous frozen-snapshot behavior. It is not a
// second renderer or a mirror of the production lookup implementation.
const getterMember = page.members.find(member => member.name?.getText(tree) === 'bookGetter');
assert.ok(getterMember);
const staleSource = source.replace(getterMember.getText(tree),
  'private bookGetter(snapshot: DownloadBookView): () => DownloadBookView { return (): DownloadBookView => snapshot; }');
assert.notEqual(staleSource, source);
const staleProbe = createReaderBuilderProbe(staleSource, methods, probeDependencies, probeHooks);
const stalePage = owner('day', { books: [unloadedBook], fontsReady: true }, staleProbe.Component);
stalePage.bookPage(); admitListItems(stalePage);
const staleCount = countActor(stalePage);
stalePage.books = [readyWithoutToc]; propertyRuntime.flush();
assert.equal(label(staleCount), '', 'the old stable-key snapshot remains stale under actual Prop delivery');
assert.throws(() => assert.equal(label(staleCount), stalePage.downloadCount(readyWithoutToc, false)),
  assert.AssertionError, 'the original bug fails the same retained-actor expectation');

// The native List is unbound during the synchronous detailKey Watch before
// returning from chapters. Exercise the actual SDK setter/Watch and preserve
// the last known offset until the existing post-frame restore is eligible.
for (const currentOffset of [() => undefined, () => ({ yOffset: Number.NaN }), () => { throw new Error('native controller unbound'); }]) {
  const states = [], positions = [];
  const returning = owner('day', { detailKey: book.key, listOffset: 73, fontsReady: true,
    listScroller: { currentOffset, scrollTo: value => positions.push(value) }, onViewStateChanged: value => states.push(value) });
  assert.equal(typeof returning.watches.get('detailKey'), 'function');
  assert.equal(returning.consumeBack(), true);
  assert.equal(returning.detailKey, ''); assert.equal(returning.listOffset, 73);
  assert.equal(states.at(-1).listScroll, 73);
  scheduledFrames.at(-1).onIdle();
  assert.deepEqual(positions.at(-1), { xOffset: 0, yOffset: 73 });
  returning.aboutToDisappear();
}
const finitePosition = owner('day', { listOffset: 73, listScroller: { currentOffset: () => ({ yOffset: 126 }) } });
finitePosition.publishViewState(); assert.equal(finitePosition.listOffset, 126);
const unsafeScrollerSource = source.replace('this.captureListOffset();\n    this.onViewStateChanged',
  'this.listOffset = this.listScroller.currentOffset().yOffset;\n    this.onViewStateChanged');
assert.notEqual(unsafeScrollerSource, source);
const unsafeScroller = createReaderBuilderProbe(unsafeScrollerSource, methods, probeDependencies, probeHooks);
const unsafeReturning = owner('day', { detailKey: book.key, listScroller: { currentOffset: () => undefined } }, unsafeScroller.Component);
assert.throws(() => unsafeReturning.consumeBack(), TypeError, 'the original synchronous Watch dereference is rejected');

// System chrome is an asynchronous platform boundary. The production Watch,
// lifecycle and generation code coalesces overlay transitions before writing.
await microtasks();
const chrome = owner('day'); chrome.aboutToAppear(); await microtasks();
const chromeStart = chromeRequests.length;
chrome.sheet = 'book-actions'; await microtasks();
assert.equal(chromeRequests.length, chromeStart + 1);
assert.equal(chromeRequests.at(-1).owner, 'overlay');
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), overlayPalette.day.underlayColor);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), palette.day.surface);
const confirmationStart = chromeRequests.length;
chrome.sheet = ''; chrome.confirmation = 'deleteLocal'; await microtasks();
assert.equal(chromeRequests.length, confirmationStart + 1, 'sheet-to-dialog produces one final system-bar write');
assert.equal(chromeRequests.at(-1).owner, 'overlay', 'no intermediate App chrome flashes during the overlay transition');
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), overlayPalette.day.underlayColor);
chrome.appThemeScheme = 'night'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), overlayPalette.night.underlayColor);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), overlayPalette.night.contentColor);
chrome.sheet = 'settings'; chrome.confirmation = 'cleanup'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), doubleOverlayPalette.night.underlayColor);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), doubleOverlayPalette.night.contentColor);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), doubleOverlayPalette.night.underlayColor);
chrome.appThemeScheme = 'day'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), doubleOverlayPalette.day.underlayColor);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), doubleOverlayPalette.day.contentColor);
chrome.confirmation = ''; await microtasks();
assert.equal(chromeRequests.at(-1).owner, 'overlay', 'cancel retains the same storage sheet with its single scrim');
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), overlayPalette.day.underlayColor);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), palette.day.surface);
chrome.sheet = ''; await microtasks();
assert.equal(chromeRequests.at(-1).owner, 'app', 'closing the final overlay restores normal App chrome');
chrome.sheet = 'filter'; await microtasks();
const retiredChromeStart = chromeRequests.length;
chrome.appThemeScheme = 'day'; chrome.aboutToDisappear(); await microtasks();
assert.equal(chromeRequests.length, retiredChromeStart + 1);
assert.equal(chromeRequests.at(-1).owner, 'app', 'retirement restores App chrome and rejects the queued overlay update');
const afterRetirement = chromeRequests.length;
chrome.sheet = 'sort'; chrome.confirmation = 'cancel'; chrome.appThemeScheme = 'night'; await microtasks();
assert.equal(chromeRequests.length, afterRetirement, 'retired Watch callbacks cannot overwrite another surface');
const replacedChrome = owner('day'); replacedChrome.aboutToAppear(); replacedChrome.sheet = 'filter'; await microtasks();
const replacedStart = chromeRequests.length;
replacedChrome.appThemeScheme = 'night'; replacedChrome.presentationIdentity = 'next-presentation'; await microtasks();
assert.equal(chromeRequests.length, replacedStart + 1);
assert.equal(chromeRequests.at(-1).owner, 'app', 'identity replacement restores chrome and rejects the old queued request');

console.log('PASS shared-download visual contract: exact demo SHA/CSS, real SDK actors and Prop/Watch delivery, stable-key new DTO updates, retained rows/scroll, snapshot negative control, retired/removed events, Normal Button creation, overlay chrome coalescing and existing geometry/font guards. Evidence excludes native layout, pixels, gestures, HAP and device acceptance; the probe does not model native branch removal.');
