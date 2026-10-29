import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"definition": {"description": "demo/storage输入SHA→当前generated字段/provenance一致性，不代表设计用户批准/设备接受", "resources": []}, "native-bindings": {"description": "实际SDK header测量delta/长书名信息不固定高/cover同步/语义色/Normal Button", "resources": []}, "inline-filter": {"description": "实际InlineSelect→ReaderSelect→真实popup Panel→ChoiceRow→两filter及清selection", "resources": []}, "inline-settings": {"description": "实际shared select popup choices更新空间上限/天数与dirty draft", "resources": []}, "inline-quick": {"description": "实际shared quick popup choice经真实page handler", "resources": []}, "inline-range": {"description": "实际shared range book popup保选中复合书identity", "resources": []}, "select-measurement": {"description": "当前shared face与实际measureText px→vp恰一次/最长option/cap/currentchrome", "resources": []}, "area-receipts": {"description": "实际10类Area numeric/vp接纳与每源点Number退化反例、保留List/Scroll", "resources": []}, "font-receipts": {"description": "实际字体pending/ready/retired/remount callbacks与scroll排队归属", "resources": []}, "short-layout": {"description": "实际窄短/大字体sheet/dialog完整document单Scroll且预算内", "resources": []}, "reactive-metrics": {"description": "实际StorageLink订阅驱动保留header safe边和input scale更新", "resources": []}, "storage-publication": {"description": "实际数值slot未知/零/已知保留身份与打开确认的最新candidate禁用", "resources": []}, "retained-dto": {"description": "实际book/chapter同key DTO更新/row与scroll保留/移除退役callback及frozen getter反例", "resources": []}, "management-scroll": {"description": "实际管理模式双frame/dock顺序、用户/过滤/字体/窗口/书identity取消及unbound offset", "resources": []}, "overlay-chrome": {"description": "实际Watch微任务归并overlay→dialog/double→App、scheme/retire/presentation fencing", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { createHash } = await import('node:crypto');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');

// Deterministic source/SDK-attribute evidence only. This test never runs a
// browser, performs native layout, paints glyphs, builds a HAP or uses a VM.

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
const surfaceResolvers = await import('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts');
const horizontalGeometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { ReaderMeasurementStore } = await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
const { ReaderTransientFeedback } = await import('../entry/src/main/ets/features/common/ReaderTransientFeedback.ts');
const { findReaderTheme, readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const manifest=JSON.parse(readFileSync(new URL('../docs/ui-design/shared-download/visual-spec.json',import.meta.url),'utf8'));
if(selectedCase==='definition'){
 const demo=readFileSync(new URL('../docs/ui-design/shared-download/demo.html',import.meta.url)),storage=readFileSync(new URL('../docs/ui-design/shared-download/storage-demo.html',import.meta.url));
 assert.equal(visual.SHARED_DOWNLOAD_DEMO_SHA256,createHash('sha256').update(demo).digest('hex'));assert.equal(manifest.sourceSha256,visual.SHARED_DOWNLOAD_DEMO_SHA256);assert.equal(manifest.storageSourceSha256,createHash('sha256').update(storage).digest('hex'));assert.deepEqual({...visual.DOWNLOAD_VISUAL},manifest.fields);for(const field of Object.keys(manifest.fields))assert.ok(manifest.provenance[field]);for(const [field,receipt]of Object.entries(manifest.storageProvenance)){assert.equal(receipt.sourceSha256,manifest.storageSourceSha256);assert.deepEqual(manifest.provenance[field],receipt);}return;
}
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
const palette=Object.fromEntries(['day','night'].map(scheme=>[scheme,Object.fromEntries(Object.entries(manifest.palettes).filter(([,v])=>v[scheme]).map(([role,v])=>[role,'#'+[Math.round(v[scheme].a*255),v[scheme].r,v[scheme].g,v[scheme].b].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()]))]));
const argb=color=>{assert.equal(typeof color,'string');return color.length===7?'#FF'+color.slice(1).toUpperCase():color.toUpperCase();};
const source = readFileSync(new URL('../entry/src/main/ets/features/downloads/SharedDownloadPage.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const tree = ts.createSourceFile('SharedDownloadPage.ets', source, ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const page = tree.statements.find(node => node.name?.getText(tree) === 'SharedDownloadPage');
assert.ok(page, 'the actual production component is the probe input');
const methods = [...page.members.filter(node => ts.isMethodDeclaration(node)).map(node => node.name.getText(tree)),
  'readerWindowMetricsRevision', 'books', 'storageSummary', 'loading', 'appThemeScheme', 'sheet', 'confirmation', 'presentationIdentity', 'detailKey',
  'query', 'bookType', 'stateFilter', 'sourceFilter', 'sortField', 'sortDirection'];
// These production initializers own native measurement and sheet-exit
// admission. Retain them rather than replacing them with fixture defaults.
methods.push('measurements', 'measurementRevision', 'reduceMotion', 'sheetWasVisible',
  'sheetMaskReady', 'sheetExitPending', 'sheetAnimationGeneration', 'transientFeedback',
  'storageDockSurfaceWidth', 'storageDockSurfaceHeight', 'selectionDockSurfaceWidth', 'selectionDockSurfaceHeight');
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
const { readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
const surfaces = readerSurfaceSpecsForProbe(new Proxy({}, { get: (_target, name) => windowMetrics[name] }));
// Controlled native ColorMetrics receipts bind actual role inputs and blend
// order. These RGB identifiers are not a second alpha-compositing engine and
// do not claim platform pixel values. The production helper formats receipts.
const nativeBlendReceipts = new Map(), nativeBlendCalls = [];
function nativeBlendReceipt(base, scrim) {
  const key = `${argb(base)}|${argb(scrim)}`;
  if (!nativeBlendReceipts.has(key)) {
    const id = nativeBlendReceipts.size + 1;
    const channels = { red: id, green: id + 64, blue: id + 128 };
    const output = '#FF' + [channels.red, channels.green, channels.blue].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    nativeBlendReceipts.set(key, { ...channels, output });
  }
  return nativeBlendReceipts.get(key).output;
}
const currentChromePalette = Object.fromEntries(['day', 'night'].map(scheme => {
  const pagePaper = readerAppColor('TOK_PAPER', scheme), pageInk = visual.downloadVisualColor('ink', scheme);
  const scrim = readerAppColor('app.scrim.warmModal', scheme);
  const action = surfaces.resolveDrawerSpec('reader-action-sheet');
  const actionScrim = readerAppColor(action.scrimRole, scheme);
  const sheetPaper = readerAppColor('app.surface.menuSolid', scheme);
  const paper = nativeBlendReceipt(pagePaper, scrim), ink = nativeBlendReceipt(pageInk, scrim);
  return [scheme, { pagePaper, pageInk, scrim, paper, ink,
    actionScrim, actionPaper: nativeBlendReceipt(pagePaper, actionScrim), actionInk: nativeBlendReceipt(pageInk, actionScrim),
    actionSurface: readerAppColor(action.surfaceRole, scheme), actionSurfaceInk: readerAppColor(action.inkRole, scheme),
    sheetPaper, sheetInk: pageInk,
    doublePaper: nativeBlendReceipt(paper, scrim), doubleInk: nativeBlendReceipt(ink, scrim),
    confirmationOnSheet: nativeBlendReceipt(sheetPaper, scrim), confirmationOnSheetInk: nativeBlendReceipt(pageInk, scrim),
  }];
}));
const nativeColorMetrics = { resourceColor: value => ({ value: argb(value), blendColor(overlay) {
  const key = `${this.value}|${overlay.value}`;
  assert.ok(nativeBlendReceipts.has(key), `finite ColorMetrics input pair: ${key}`);
  nativeBlendCalls.push([this.value, overlay.value]);
  return nativeBlendReceipts.get(key);
} }) };
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerScrimmedOpaqueColor } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/features/common/ReaderScrimColor.ets', import.meta.url), 'utf8'),
  'ReaderScrimColor.ets', { ColorMetrics: nativeColorMetrics }, ['readerScrimmedOpaqueColor']);
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
const measurements = [], sizeMeasurements = [], convertedWidths = [];
let measuredWidths = new Map();
const measureText = options => {
  measurements.push({ ...options });
  return measuredWidths.get(options.textContent) ?? 150;
};
const measureTextSize = options => {
  sizeMeasurements.push({ ...options });
  // Explicit native receipt for static material probes, independent of text.
  return { width: 150, height: 63 };
};
const propertyRuntime = createArkUIPropertyRuntimeProbe();
const probeDependencies = {
  ...visual, ...projection, ...metricsExports, ...surfaceResolvers, ...surfaces, ReaderMeasurementStore, ReaderTransientFeedback,
  readerAppColor, readerScrimmedOpaqueColor,
  ...propertyRuntime.sdk,
  SharedDownloadIdleFrame, ReaderWindowChromeStyle, TextModifier: TextModifierPort, SymbolGlyphModifier: SymbolGlyphModifierPort,
  ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  prepareSharedDownloadFonts: () => new Promise((resolve, reject) => fontReceipts.push({ resolve, reject })),
  ReaderWindowCoordinator: { metrics: () => windowMetrics,
    requestOverlayChrome: style => chromeRequests.push({ owner: 'overlay', style }),
    requestAppChrome: () => chromeRequests.push({ owner: 'app' }) },
  ButtonType: enumValue('ButtonType'), ImageFit: enumValue('ImageFit'), InputType: enumValue('InputType'),
  WordBreak: enumValue('WordBreak'), ScrollAlign: enumValue('ScrollAlign'), ControlSize: enumValue('ControlSize'),
  TouchType: enumValue('TouchType'),
  // This case observes static material attributes with reduceMotion enabled;
  // it passes the native identity recipe through without simulating frames.
  TransitionEffect: { IDENTITY: 'TransitionEffect.IDENTITY' },
  uiContext: {getFont:()=>({}),animateTo(_options,action){action();},getHostContext: () => ({ config: { fontSizeScale: platformFontScale } }),
    postFrameCallback: frame => scheduledFrames.push(frame), getMeasureUtils: () => ({ measureText, measureTextSize }),
    px2vp: value => { convertedWidths.push(value); return value / 3; } },
};
const {inlineSelectSdk}=await import('./lib/reader-inline-select-sdk-probe.mjs');const inline=inlineSelectSdk({properties:propertyRuntime,uiContext:probeDependencies.uiContext,
  dependencies:{...surfaces,ReaderWindowCoordinator:probeDependencies.ReaderWindowCoordinator}});Object.assign(probeDependencies,inline.dependencies);const probeHooks={...propertyRuntime.hooks,...inline.hooks};
// Register the shipping dialog and its real DTO with the same property
// runtime before lowering its parent. The selected cases do not click dialog
// actions or claim native confirmation layout/press dispatch.
const dialogSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderDialogSurface.ets', import.meta.url), 'utf8');
require(sdk + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderDialogSurface',
  new Set([...dialogSource.matchAll(/@BuilderParam\s+(\w+)\s*:/g)].map(match => match[1])));
const { DialogActionView } = pureModuleProbe(dialogSource.slice(0, dialogSource.indexOf('@Component')),
  'ReaderDialogActionView.ets', {}, ['DialogActionView']);
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { ReaderActionAccessibility } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionAccessibility.ets', import.meta.url), 'utf8'),
  'ReaderActionAccessibility.ets', { AccessibilityRoleType: enumValue('AccessibilityRoleType') }, ['ReaderActionAccessibility']);
probeHooks.childSources = { ...probeHooks.childSources, ReaderDialogSurface: dialogSource };
// Register the shipping Prop contract while observing its parent inputs only.
// Canvas layout/rasterization is verified by the isolated native P0, not this
// SDK-attribute fixture.
const raisedSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderRaisedSurface.ets',import.meta.url),'utf8');
class RaisedSurfaceInputs {
  constructor(owner,params,_storage,id) { Object.assign(this,{owner,params,id});this.nodes=new Map();this.children=new Map(); }
  updateStateVars(params) { Object.assign(this.params,params); }
}
probeHooks.childSources.ReaderRaisedSurface=raisedSource;
probeDependencies.ReaderRaisedSurface=RaisedSurfaceInputs;
probeDependencies.DialogActionView = DialogActionView;
probeDependencies.ReaderDialogSurface = createReaderBuilderProbe(dialogSource, boundedMembers(dialogSource),
  { ...probeDependencies, ...horizontalGeometry, ...readerTypographyRoles, ReaderActionAccessibility }, probeHooks).Component;
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

const microtasks=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};const originalWindowMetrics=windowMetrics;
const completeChapter = { key: JSON.stringify([book.sourceId, book.bookId, 0]), sourceId: book.sourceId, bookId: book.bookId, index: 0,
  title: '第一章', chapterId: 'chapter:0', navigable: true, localComplete: true,
  stateLabel: '已下载', queueState: 'cached', cachedBytes: 100 };
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
  node.fontSize===readerTypographyRoles.TYPE_DOWNLOAD_META.fontSizeFp && typeof node.onClick === 'function', 'the retained download-count actor');

if(selectedCase==='native-bindings'){
for(const scheme of ['day','night']){
 const header=owner(scheme);header.topBar();const heading=text(header,'下载管理');assert.ok(heading.fontSize>0&&heading.lineHeight>0);const headerBox=find(header,n=>n.constraintSize?.minHeight===visual.DOWNLOAD_VISUAL.headerHeight&&n.onAreaChange,'actual header');const before=header.contentTop();headerBox.onAreaChange({}, {height:visual.DOWNLOAD_VISUAL.headerHeight+18});assert.equal(header.contentTop(),before+18);
 assert.equal(argb(headerBox.backgroundColor),argb(readerAppColor('TOK_SURFACE_SOLID',scheme)));
 assert.equal(argb(headerBox.border.color),argb(readerAppColor('app.border.control',scheme)));
 assert.deepEqual(headerBox.shadow,surfaces.readerSurfaceElevation('fixed',scheme),'reserved header is fixed without lift');
 const field=owner(scheme);field.searchField();const fieldBox=find(field,n=>n.type==='Row'&&n.borderRadius===visual.DOWNLOAD_VISUAL.searchRadius,'actual input surface');
 assert.equal(argb(fieldBox.backgroundColor),argb(readerAppColor('TOK_FIELD_SURFACE',scheme)));
 assert.equal(argb(fieldBox.border.color),argb(readerAppColor('app.border.searchField',scheme)));
 for(const method of ['storageDock','selectionDock']){
  const dock=owner(scheme,{managing:method==='selectionDock'});dock[method]();
  const box=find(dock,n=>n.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&n.onAreaChange,'actual floating dock');
  assert.equal(argb(box.backgroundColor),argb(readerAppColor('app.surface.dock',scheme)));
  assert.equal(argb(box.border.color),argb(readerAppColor('app.navigation.floatingBorder',scheme)));
  assert.equal(box.clip,false,'floating dock does not clip its own shadow');
  assert.equal(box.shadow,undefined,'dock material does not duplicate the shared raised painter');
  const wrapper=find(dock,n=>n.type==='Stack'&&n.width==='100%'&&n.clip===false,'unclipped shadow host');
  assert.equal(wrapper.padding,undefined);assert.equal(wrapper.height,undefined,'the painted dock still determines natural wrapper height');
  const raised=[...dock.children.values()].filter(child=>child instanceof RaisedSurfaceInputs);
  assert.equal(raised.length,1,'each dock owns one shared raised painter');
  assert.equal(raised[0].params.cornerRadius,visual.DOWNLOAD_VISUAL.dockRadius);
  assert.equal(raised[0].params.scheme,scheme);
  box.onAreaChange({}, {width:'326vp',height:'91vp'});propertyRuntime.flush();
  assert.deepEqual({...raised[0].params},{surfaceWidth:326,surfaceHeight:91,
    cornerRadius:visual.DOWNLOAD_VISUAL.dockRadius,scheme},'actual vp surface receipts reach the retained painter unchanged');
  assert.equal(dock.measurements.read('download:dock'),91,'the same dock receipt still owns existing content avoidance');
 }
 const panel=owner(scheme,{sheet:'filter',reduceMotion:true});panel.sheetOverlay();
 const panelBox=find(panel,n=>n.type==='Column'&&n.borderRadius?.topLeft===visual.DOWNLOAD_VISUAL.sheetRadius,'actual modal sheet');
 assert.equal(argb(panelBox.backgroundColor),argb(readerAppColor('app.surface.menuSolid',scheme)));
 assert.equal(argb(panelBox.border.color),argb(readerAppColor('app.border.modalHighlight',scheme)));
 assert.deepEqual(panelBox.shadow,surfaces.readerSurfaceElevation('sheet',scheme));
 const mask=find(panel,n=>n.type==='Rect'&&n.fill,'actual modal mask');
 assert.equal(argb(mask.fill),argb(readerAppColor('app.scrim.warmModal',scheme)));
 const row=owner(scheme);row.bookRow(()=>book,false);const title=text(row,book.title),meta=text(row,row.authorSource(book));assert.ok(title.maxLines===undefined||title.maxLines>1);assert.ok(meta.maxLines===undefined||meta.maxLines>1);const image=find(row,n=>n.type==='Image'&&n.create===book.coverUrl,'actual cover'),copy=find(row,n=>n.type==='Column'&&n.layoutWeight===1&&n.onAreaChange,'measured book copy');assert.equal(copy.height,undefined);const old=image.height;copy.onAreaChange({}, {height:old+57});row.replay();assert.equal(image.height,old+57);
 const status=owner(scheme);status.statusButton(()=>book);assert.equal(argb(text(status,'下载中').fontColor),argb(visual.downloadVisualColor('green',scheme)));const failed=owner(scheme);failed.statusButton(()=>({...book,stateLabel:'下载失败'}));assert.equal(argb(text(failed,'重试').fontColor),argb(visual.downloadVisualColor('danger',scheme)));
 assert.match(find(failed,n=>n.type==='Button'&&typeof n.accessibilityText==='string','failure action keeps its state semantics').accessibilityText,/下载失败.*重试/);
 for(const result of [header,row,status,failed])for(const button of records(result).filter(n=>n.type==='Button')){const creation=result.attributeCalls.find(a=>a.id===button.id&&a.property==='createWithChild');assert.equal(creation?.args[0]?.type,'ButtonType.Normal');}
}
}
const actors=result=>inline.walk(result).filter(a=>a instanceof inline.dependencies.ReaderInlineSelect);
if(selectedCase==='inline-filter'){const f=owner('day',{selectedBookKeys:[book.key]});f.filterSheet();const a=actors(f);assert.equal(a.length,2);assert.deepEqual(Array.from(a[0].options),f.stateChoices().map(c=>c.label));assert.deepEqual(Array.from(a[1].options),f.sourceChoices().map(c=>c.label));inline.choose(a[0],'下载中');assert.equal(f.stateFilter,'downloading');inline.choose(a[1],'另一书源');assert.equal(f.sourceFilter,'source-two');assert.deepEqual(Array.from(f.selectedBookKeys),[]);}
if(selectedCase==='inline-settings'){const f=owner();f.settingsSheet();const a=actors(f);assert.equal(a.length,2);const next=f.limitChoices()[0],days=f.dayChoices().at(-1);inline.choose(a[0],projection.formatDownloadStorageBytes(next*1024*1024));assert.equal(f.cacheLimitMb,next);inline.choose(a[1],days+' 天');assert.equal(f.cleanupAfterDays,days);assert.equal(f.storagePolicyDraftChanged,true);}
if(selectedCase==='inline-quick'){const f=owner('day',{managing:true});f.chapterToolbar(()=>book);const a=actors(f);assert.equal(a.length,1);assert.deepEqual(Array.from(a[0].options),['快速选择','当前章节','从当前往后','全部章节']);inline.choose(a[0],'全部章节');assert.ok(f.selectedChapterIndices.length>=0,'actual quick action reached page; empty fixture catalog stays empty');}
if(selectedCase==='inline-range'){const f=owner('day',{actionBookKeys:[book.key,another.key],rangeBookKey:book.key});f.rangeSheet();const a=actors(f);assert.equal(a.length,1);inline.choose(a[0],a[0].options[1]);assert.equal(f.rangeBookKey,another.key);}

if(selectedCase==='select-measurement'){
const f=owner(),original=windowMetrics;windowMetrics={...windowMetrics,windowRect:{...windowMetrics.windowRect,width:1000}};measuredWidths=new Map([['current',420],['short',42],['option',300],['label',180]]);let start=measurements.length,converted=convertedWidths.length;const width=f.selectClosedWidth('current',['option'],500,'label');assert.deepEqual(measurements.slice(start).map(c=>c.textContent),['current','option','label']);assert.deepEqual(convertedWidths.slice(converted),[180,420]);for(const call of measurements.slice(start,-1)){assert.equal(call.fontSize,readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontSizeFp);assert.equal(call.fontFamily,readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontFamily);}const child=new inline.dependencies.ReaderSelect(undefined,{value:'current',options:['option'],controlWidth:0});assert.equal(width,Math.ceil(420/3)+child.resolvedChrome());assert.equal(f.selectClosedWidth('current',['option'],130,'label'),130);assert.equal(f.selectClosedWidth('short',['option'],500,'label'),Math.ceil(300/3)+child.resolvedChrome());windowMetrics={...windowMetrics,windowRect:{...windowMetrics.windowRect,width:100}};assert.ok(f.selectClosedWidth('current',['option'],500,'label')>=0);windowMetrics={...original,systemFontScale:2};start=measurements.length;f.selectClosedWidth('current',['option'],500,'label');assert.equal(measurements[start].fontSize,readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontSizeFp);windowMetrics=original;measuredWidths=new Map();

}
if(selectedCase==='area-receipts'){
function checkDownloadArea(candidate = source) {
  const Component = candidate === source ? probe.Component : createReaderBuilderProbe(candidate, methods, probeDependencies, probeHooks).Component;
  for (const unit of [false, true]) {
    const length = value => unit ? `${value}vp` : value;
    const page = owner('day', { fontsReady: true }, Component); page.initialRender();
    const list = find(page, node => node.type === 'List', 'actual download list before Area measurements');
    const scroller = page.listScroller;
    const host = [...page.nodes.values()].find(node => node.type === '__Common__' && typeof node.onAreaChange === 'function');
    assert.ok(host, 'the actual public download host owns its viewport Area callback');
    host.onAreaChange({}, { height: length(720) });
    assert.equal(page.pageHeight, 720, 'download Area viewport accepts numeric and vp receipts');
    const header = find(page, node => node.constraintSize?.minHeight===visual.DOWNLOAD_VISUAL.headerHeight && typeof node.onAreaChange === 'function', 'actual header measurement');
    header.onAreaChange({}, { height: length(70) });
    assert.equal(page.headerMeasuredHeight, 70, 'download Area header accepts numeric and vp receipts');
    const storage = find(page, node => node.type === 'Row' && node.constraintSize === undefined && node.borderRadius === visual.DOWNLOAD_VISUAL.dockRadius && typeof node.onAreaChange === 'function', 'actual storage dock measurement');
    storage.onAreaChange({}, { height: length(111) });
    assert.equal(page.dockMeasuredHeight, 111, 'download Area storage dock accepts numeric and vp receipts');
    page.replay(); propertyRuntime.flush();
    assert.equal(page.nodes.get(list.id), list, 'download Area measurements retain the native book List');
    assert.equal(list.create.scroller, scroller); assert.equal(page.listScroller, scroller);
    assert.equal(list.padding.top, page.contentTop()); assert.equal(list.padding.bottom, page.contentBottom(visual.DOWNLOAD_VISUAL.contentBottom));

    const selection = owner('day', { managing: true }, Component); selection.selectionDock();
    const selectedDock = find(selection, node => node.type === 'Column' && node.borderRadius === visual.DOWNLOAD_VISUAL.dockRadius && typeof node.onAreaChange === 'function', 'actual selection dock measurement');
    selectedDock.onAreaChange({}, { height: length(123) });
    assert.equal(selection.dockMeasuredHeight, 123, 'download Area selection dock accepts numeric and vp receipts');
    const row = owner('day', {}, Component); row.bookRow(() => book, false);
    const copy = find(row, node => node.type === 'Column' && node.layoutWeight === 1 && typeof node.onAreaChange === 'function', 'actual book copy measurement');
    copy.onAreaChange({}, { height: length(137) });
    assert.equal(row.bookCopyHeights.get(book.key), 137, 'download Area book copy accepts numeric and vp receipts');
    const content = find(row, node => node.type === 'Column' && node.layoutWeight === undefined && typeof node.onAreaChange === 'function', 'actual natural book text measurement');
    content.onAreaChange({}, { height: length(134) });
    assert.equal(row.bookContentHeights.get(book.key), 134, 'download Area book content accepts numeric and vp receipts');

    for (const sheet of ['settings', 'filter']) {
      const panel = owner('day', { sheet, pageHeight: 720 }, Component); panel.sheetContent(false);
      const scroll = find(panel, node => node.type === 'Scroll', 'actual panel body Scroll');
      const title = find(panel, node => node.type === 'Row' && node.constraintSize?.minHeight === visual.DOWNLOAD_VISUAL.sheetTitleHeight && typeof node.onAreaChange === 'function', 'actual sheet title measurement');
      title.onAreaChange({}, { height: length(83) });
      assert.equal(panel.sheetTitleMeasuredHeight, 83, 'download Area sheet title accepts numeric and vp receipts');
      const footer = find(panel, node => node.type === 'Row' && node.constraintSize === undefined && typeof node.onAreaChange === 'function', 'actual sheet footer measurement');
      footer.onAreaChange({}, { height: length(115) });
      assert.equal(panel.sheetFooterMeasuredHeight, 115, `download Area ${sheet} footer accepts numeric and vp receipts`);
      panel.replay(); propertyRuntime.flush();
      assert.equal(panel.nodes.get(scroll.id), scroll, 'sheet Area receipts retain the native body Scroll');
      assert.equal(scroll.constraintSize.maxHeight, panel.sheetBodyMaxHeight());
    }
    const dialog = owner('day', { confirmation: 'cancel', pageHeight: 720 }, Component); dialog.confirmationContent(false);
    const actions = find(dialog, node => node.type === 'Row' && typeof node.onAreaChange === 'function', 'actual confirmation action measurement');
    actions.onAreaChange({}, { height: length(91) });
    assert.equal(dialog.dialogActionsMeasuredHeight, 91, 'download Area confirmation actions accept numeric and vp receipts');
  }
}
checkDownloadArea();
const areaConversions = [];
function collectAreaConversions(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'readerPageAreaLength') areaConversions.push(node);
  ts.forEachChild(node, collectAreaConversions);
}
collectAreaConversions(page);
assert.ok(areaConversions.length>0,'current Area callback sites present');
for (const conversion of areaConversions) {
  const changed = source.slice(0, conversion.expression.getStart(tree)) + 'Number' + source.slice(conversion.expression.end);
  assert.notEqual(changed, source);
  assert.throws(() => checkDownloadArea(changed), /download Area .*accepts? numeric and vp receipts/,
    'each individual legacy Number(Area) conversion fails the same real SDK receipt contract');
}


}
if(selectedCase==='font-receipts'){
// Font I/O is the isolated boundary; the page's real promise callbacks and
// retirement methods decide whether a receipt may publish readiness.

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


}
if(selectedCase==='short-layout'){
const original=windowMetrics;for(const [width,height,scale]of[[140,120,2],[366,809,1]]){windowMetrics={...original,windowRect:{left:0,top:0,width,height},systemFontScale:scale};const f=owner('day',{sheet:'filter',pageHeight:height});assert.ok(f.sheetMaxHeight()>=0&&f.sheetMaxHeight()<=height);f.sheetOverlay();const scrolls=records(f).filter(n=>n.type==='Scroll');assert.equal(scrolls.length,1);assert.ok(scrolls[0].constraintSize.maxHeight<=height);text(f,'筛选');text(f,'完成');const d=owner('day',{confirmation:'deleteLocal',pageHeight:height,actionBookKeys:[book.key]});d.confirmationOverlay();assert.equal(records(d).filter(n=>n.type==='Scroll').length,1);text(d,'取消');text(d,'删除内容');}windowMetrics=original;

}
if(selectedCase==='reactive-metrics'){
// Execute the SDK's actual StorageLink getter/property implementation and dirty
// callback delivery. Changing only the coordinator snapshot cannot refresh a
// retained observer; the page must consume its revision inside those callbacks.

const reactivePage = owner('day', { fontsReady: true, pageHeight: 800 });
reactivePage.initialRender(); reactivePage.searchField();
const downloadFrame = [...reactivePage.children.values()].find(child => child.params?.variant === 'download');
assert.ok(downloadFrame?.nodes, 'downloads mounts the actual public SDK page frame');
const safeFrame = [...downloadFrame.nodes.values()].find(node => node.type==='Column'&&node.zIndex>0);
assert.ok(safeFrame, 'normal floating header consumes the actual shared header slot');
assert.equal(safeFrame.margin.top,reactivePage.headerTop());
assert.deepEqual(safeFrame.padding,{left:reactivePage.leftInset(),right:reactivePage.rightInset()});
const reactiveInput = find(reactivePage, node => node.type==='TextInput',
  'baseline editable search line box');
const baselineInputHeight=reactiveInput.height;
const dependentIds = propertyRuntime.dependencies.get(reactivePage)?.get('readerWindowMetricsRevision');
assert.ok(dependentIds?.size > 0, 'SDK render observers subscribe to the actual StorageLink getter');
const observerCount = reactivePage.observers.length;
windowMetrics = { ...originalWindowMetrics, systemFontScale: 2,
  systemInsets: { ...originalWindowMetrics.systemInsets, left: 32, right: 26 } };
reactivePage.readerWindowMetricsRevision += 1;
propertyRuntime.flush();
assert.equal(safeFrame.padding.left, 32); assert.equal(safeFrame.padding.right, 26);
assert.ok(reactiveInput.height>baselineInputHeight,'retained native input grows with scale');
assert.equal(reactivePage.observers.length, observerCount, 'metric changes update retained attributes without remounting the document');



}
if(selectedCase==='storage-publication'){
const MiB=1024*1024,GiB=MiB*1024,summary={totalBytes:3*GiB,retainedBytes:GiB,automaticBytes:2*GiB,cleanableBytes:512*MiB,availableBytes:8*GiB};const f=owner('day',{storageSummary:summary});f.settingsSheet();f.clearStorageButton();const values=['3.0 GB','1.0 GB','2.0 GB','8.0 GB'].map(v=>text(f,v)),ids=values.map(n=>n.id);const button=find(f,n=>n.type==='Button','actual cleanup');assert.equal(button.enabled,true);assert.equal(button.accessibilityText,'清理自动保存 · 512 MB');f.storageSummary={};propertyRuntime.flush();assert.deepEqual(values.map(label),['','','','']);assert.deepEqual(values.map(n=>f.nodes.get(n.id).id),ids);assert.equal(button.enabled,false);f.storageSummary={totalBytes:0,retainedBytes:0,automaticBytes:0,cleanableBytes:0,availableBytes:0};propertyRuntime.flush();assert.deepEqual(values.map(label),['0 MB','0 MB','0 MB','0 MB']);assert.equal(button.enabled,false);f.storageSummary=summary;propertyRuntime.flush();assert.deepEqual(values.map(label),['3.0 GB','1.0 GB','2.0 GB','8.0 GB']);assert.equal(button.enabled,true);const d=owner('day',{storageSummary:summary,sheet:'settings',confirmation:'cleanup'});d.confirmationOverlay();const confirm=records(d).filter(n=>n.type==='Button').at(-1),caption=text(d,'清理 512 MB');assert.equal(confirm.enabled,true);d.storageSummary={...summary,cleanableBytes:0};propertyRuntime.flush();assert.equal(label(caption),'清理 0 MB');assert.equal(confirm.enabled,false);

}
if(selectedCase==='retained-dto'){
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


}
if(selectedCase==='management-scroll'){
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

// Execute the real component methods and native List touch closures. Layout
// itself is a platform boundary: model only its offset/area/frame receipts.
function modeOwner(detail = false, changes = {}, Component = probe.Component) {
  const positions = [];
  const scroller = { currentOffset: () => ({ yOffset: 143 }), scrollTo: value => positions.push(value) };
  return { positions, page: owner('day', { fontsReady: true, detailKey: detail ? book.key : '',
    listScroller: scroller, chapterScroller: scroller, chapterOffset: 0, ...changes }, Component) };
}
for (const detail of [false, true]) {
  for (const measuredBeforeFrame of [false, true]) {
    const { page: selection, positions } = modeOwner(detail);
    if (detail) {
      selection.selectionDock();
      records(selection).filter(node => node.type === 'Button').at(0).onClick();
    } else {
      selection.topBar();
      records(selection).filter(node => node.type === 'Button').at(-1).onClick();
    }
    assert.equal(selection.managing, true);
    const first = scheduledFrames.at(-1);
    if (measuredBeforeFrame) selection.recordDockHeight(112);
    first.onIdle();
    if (!measuredBeforeFrame) { selection.recordDockHeight(112); scheduledFrames.at(-1).onIdle(); }
    assert.deepEqual(positions, Array.from({ length: measuredBeforeFrame ? 1 : 2 }, () => ({ xOffset: 0, yOffset: 143 })),
      'management entry preserves the pre-layout viewport across either dock/frame order');
    assert.equal(selection.managingScrollAnchor, undefined);
    const frameCount = scheduledFrames.length;
    selection.recordDockHeight(140);
    assert.equal(scheduledFrames.length, frameCount, 'completed mode restoration cannot be resurrected by later layout');
    selection.setManaging(false);
    assert.equal(selection.managing, false);
    selection.recordDockHeight(63); scheduledFrames.at(-1).onIdle();
    assert.deepEqual(positions.at(-1), { xOffset: 0, yOffset: 143 }, 'leaving management preserves the same viewport too');
    selection.aboutToDisappear();
  }
}
for (const detail of [false, true]) for (const touchBeforeFrame of [false, true]) {
  const { page: selection, positions } = modeOwner(detail);
  selection.enterManaging(); const first = scheduledFrames.at(-1);
  if (!touchBeforeFrame) first.onIdle();
  if (detail) selection.chapterPage(selection.bookGetter(book)); else selection.bookPage();
  const list = find(selection, node => node.type === 'List', 'native List observes a new touch');
  list.onTouch({ type: 'TouchType.Down' });
  first.onIdle();
  const frameCount = scheduledFrames.length; selection.recordDockHeight(112);
  assert.equal(scheduledFrames.length, frameCount, 'new user input cancels both pending layout restores');
  assert.equal(positions.length, touchBeforeFrame ? 0 : 1);
  selection.aboutToDisappear();
}
for (const detail of [false, true]) {
  let nativeOffset = 143;
  const positions = [];
  const scroller = { currentOffset: () => ({ yOffset: nativeOffset }), scrollTo: value => positions.push(value) };
  const { page: selection } = modeOwner(detail, { listScroller: scroller, chapterScroller: scroller });
  const start = scheduledFrames.length;
  selection.enterManaging();
  nativeOffset = 0; // Native layout can temporarily clamp before post-frame.
  selection.setManaging(false); selection.enterManaging();
  selection.recordDockHeight(112);
  for (const frame of scheduledFrames.slice(start)) frame.onIdle();
  assert.deepEqual(positions, [{ xOffset: 0, yOffset: 143 }],
    'rapid mode toggles reuse the live transition anchor instead of a transient clamp');
  selection.aboutToDisappear();
}
for (const [field, value] of [['query', 'new query'], ['bookType', 'manga'], ['stateFilter', 'downloaded'],
  ['sourceFilter', 'source-two'], ['sortField', 'size'], ['sortDirection', 'asc']]) {
  const { page: selection, positions } = modeOwner();
  selection.enterManaging(); const first = scheduledFrames.at(-1);
  selection[field] = value; propertyRuntime.flush();
  first.onIdle(); selection.recordDockHeight(112);
  assert.deepEqual(positions, [], `${field} changes cancel obsolete mode restoration without a List touch`);
  selection.aboutToDisappear();
}
const keyboardMode = modeOwner();
keyboardMode.page.enterManaging(); const keyboardFrame = scheduledFrames.at(-1);
keyboardMode.page.searchField();
find(keyboardMode.page, node => node.type === 'TextInput', 'real keyboard input actor').onChange('new query');
keyboardFrame.onIdle(); keyboardMode.page.recordDockHeight(112);
assert.deepEqual(keyboardMode.positions, [{ xOffset: 0, yOffset: 0 }],
  'a keyboard query resets results once and cannot be overwritten by an old mode anchor');
keyboardMode.page.aboutToDisappear();
for (const mutate of [
  page => { page.mounted = false; },
  page => { page.fontsReady = false; },
  page => { page.fontPreparationGeneration++; },
  page => { page.presentationGeneration++; },
  page => { page.presentationIdentity = 'replacement'; },
  page => { page.readerWindowMetricsRevision++; },
  page => { page.detailKey = another.key; },
  page => { page.books = []; },
]) {
  const { page: selection, positions } = modeOwner(true);
  selection.enterManaging(); const first = scheduledFrames.at(-1);
  mutate(selection); first.onIdle(); selection.recordDockHeight(112);
  assert.deepEqual(positions, [], 'retired/font/window/book identities cannot restore an obsolete viewport');
  assert.equal(selection.managingScrollAnchor, undefined);
}
for (const currentOffset of [() => undefined, () => ({ yOffset: NaN }), () => { throw Error('unbound'); }]) {
  const { page: selection, positions } = modeOwner(true, { chapterScroller: { currentOffset, scrollTo: () => assert.fail('unproven offset') } });
  const frameCount = scheduledFrames.length; selection.enterManaging();
  assert.equal(selection.managing, true, 'unbound Scroller must not disable the management action');
  assert.equal(scheduledFrames.length, frameCount, 'unbound Scroller must not manufacture a zero anchor');
  assert.deepEqual(positions, []);
}
const removedAnchorSource = source.replace('this.managingScrollRestore = anchor;', 'this.managingScrollRestore = undefined;');
assert.notEqual(removedAnchorSource, source);
const removedAnchorProbe = createReaderBuilderProbe(removedAnchorSource, methods, probeDependencies, probeHooks);
const negativeMode = modeOwner(false, {}, removedAnchorProbe.Component);
negativeMode.page.enterManaging();
assert.throws(() => assert.ok(negativeMode.page.managingScrollRestore), assert.AssertionError,
  'the old missing management restoration fails the same production expectation');
const unsafeScrollerSource = source.replace('this.captureListOffset();\n    this.onViewStateChanged',
  'this.listOffset = this.listScroller.currentOffset().yOffset;\n    this.onViewStateChanged');
assert.notEqual(unsafeScrollerSource, source);
const unsafeScroller = createReaderBuilderProbe(unsafeScrollerSource, methods, probeDependencies, probeHooks);
const unsafeReturning = owner('day', { detailKey: book.key, listScroller: { currentOffset: () => undefined } }, unsafeScroller.Component);
assert.throws(() => unsafeReturning.consumeBack(), TypeError, 'the original synchronous Watch dereference is rejected');


}
if(selectedCase==='overlay-chrome'){
// System chrome is an asynchronous platform boundary. The production Watch,
// lifecycle and generation code coalesces overlay transitions before writing.
await microtasks();
const chrome = owner('day'); chrome.aboutToAppear(); await microtasks();
let nativeStart = nativeBlendCalls.length;
chrome.sheet = 'filter'; await microtasks();
assert.equal(chromeRequests.at(-1).owner, 'overlay');
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.day.paper);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), argb(currentChromePalette.day.sheetPaper));
assert.deepEqual(nativeBlendCalls.slice(nativeStart), [
  [argb(currentChromePalette.day.pagePaper), argb(currentChromePalette.day.scrim)],
  [argb(currentChromePalette.day.pageInk), argb(currentChromePalette.day.scrim)],
], 'ordinary sheet chrome consumes one actual modal mask over page paper and ink');
const chromeStart = chromeRequests.length;
nativeStart = nativeBlendCalls.length;
chrome.sheet = 'book-actions'; await microtasks();
assert.equal(chromeRequests.length, chromeStart + 1);
assert.equal(chromeRequests.at(-1).owner, 'overlay');
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.day.actionPaper);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), currentChromePalette.day.actionInk);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), argb(currentChromePalette.day.actionSurface));
assert.equal(argb(chromeRequests.at(-1).style.navigationContentColor), argb(currentChromePalette.day.actionSurfaceInk));
assert.deepEqual(nativeBlendCalls.slice(nativeStart), [
  [argb(currentChromePalette.day.pagePaper), argb(currentChromePalette.day.actionScrim)],
  [argb(currentChromePalette.day.pageInk), argb(currentChromePalette.day.actionScrim)],
], 'operations sheet chrome consumes its actual public drawer mask');
const confirmationStart = chromeRequests.length;
chrome.sheet = ''; chrome.confirmation = 'deleteLocal'; await microtasks();
assert.equal(chromeRequests.length, confirmationStart + 1, 'sheet-to-dialog produces one final system-bar write');
assert.equal(chromeRequests.at(-1).owner, 'overlay', 'no intermediate App chrome flashes during the overlay transition');
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), currentChromePalette.day.paper);
chrome.appThemeScheme = 'night'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.night.paper);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), currentChromePalette.night.ink);
nativeStart = nativeBlendCalls.length;
chrome.sheet = 'settings'; chrome.confirmation = 'cleanup'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.night.doublePaper);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), currentChromePalette.night.doubleInk);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), currentChromePalette.night.confirmationOnSheet);
assert.equal(argb(chromeRequests.at(-1).style.navigationContentColor), currentChromePalette.night.confirmationOnSheetInk);
assert.notEqual(currentChromePalette.night.confirmationOnSheet, currentChromePalette.night.doublePaper,
  'navigation is the opaque sheet plus confirmation, not the doubly-masked page');
assert.deepEqual(nativeBlendCalls.slice(nativeStart), [
  [argb(currentChromePalette.night.pagePaper), argb(currentChromePalette.night.scrim)],
  [argb(currentChromePalette.night.pageInk), argb(currentChromePalette.night.scrim)],
  [currentChromePalette.night.paper, argb(currentChromePalette.night.scrim)],
  [currentChromePalette.night.ink, argb(currentChromePalette.night.scrim)],
  [argb(currentChromePalette.night.sheetPaper), argb(currentChromePalette.night.scrim)],
  [argb(currentChromePalette.night.sheetInk), argb(currentChromePalette.night.scrim)],
], 'nested confirmation keeps the independent status-band and sheet-band owners');
chrome.appThemeScheme = 'day'; await microtasks();
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.day.doublePaper);
assert.equal(argb(chromeRequests.at(-1).style.contentColor), currentChromePalette.day.doubleInk);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), currentChromePalette.day.confirmationOnSheet);
chrome.confirmation = ''; await microtasks();
assert.equal(chromeRequests.at(-1).owner, 'overlay', 'cancel retains the same storage sheet with its single scrim');
assert.equal(argb(chromeRequests.at(-1).style.underlayColor), currentChromePalette.day.paper);
assert.equal(argb(chromeRequests.at(-1).style.navigationUnderlayColor), argb(currentChromePalette.day.sheetPaper));
const exitingGeneration = chrome.sheetAnimationGeneration, beforeExit = chromeRequests.length;
chrome.sheet = ''; await microtasks();
assert.equal(chromeRequests.length, beforeExit, 'an animated sheet retains its band until the native exit receipt');
chrome.onSheetExitFinished(exitingGeneration); await microtasks();
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


}

}
