import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { registerReaderTypeScriptImports } from './lib/reader-typescript-imports.mjs';
const definitions={"definition": {"description": "demo/storage输入SHA→当前generated字段/provenance一致性，不代表设计用户批准/设备接受", "resources": []}, "native-bindings": {"description": "实际SDK header测量delta/长书名信息不固定高/cover同步/语义色/Normal Button", "resources": []}, "inline-filter": {"description": "实际InlineSelect→ReaderSelect→真实popup Panel→ChoiceRow→两filter及清selection", "resources": []}, "inline-settings": {"description": "实际shared select popup choices更新空间上限/天数与dirty draft", "resources": []}, "inline-quick": {"description": "实际shared quick popup choice经真实page handler", "resources": []}, "inline-range": {"description": "实际shared range book popup保选中复合书identity", "resources": []}, "select-measurement": {"description": "实际选中值与行标题测量/px→vp恰一次/关闭触发器预算", "resources": []}, "area-receipts": {"description": "实际10类Area numeric/vp接纳与每源点Number退化反例、保留List/Scroll", "resources": []}, "font-receipts": {"description": "实际字体pending/ready/retired/remount callbacks与scroll排队归属", "resources": []}, "short-layout": {"description": "实际窄短/大字体sheet/dialog完整document单Scroll且预算内", "resources": []}, "reactive-metrics": {"description": "实际StorageLink订阅驱动保留header safe边和input scale更新", "resources": []}, "storage-publication": {"description": "实际数值slot未知/零/已知保留身份与打开确认的最新candidate禁用", "resources": []}, "retained-dto": {"description": "实际book/chapter同key DTO更新/row与scroll保留/移除退役callback及frozen getter反例", "resources": []}, "management-scroll": {"description": "实际管理模式双frame/dock顺序、用户/过滤/字体/窗口/书identity取消及unbound offset", "resources": []}, "overlay-chrome": {"description": "实际Watch微任务归并overlay→dialog/double→App、scheme/retire/presentation fencing", "resources": []}};
definitions['area-receipts'].description = 'Current viewport/header/dock/book/sheet/dialog/operations Area numeric/vp receipts and each real Number regression; retained List/Scroll ports, not native layout';
definitions['reactive-metrics'].description = 'Actual StorageLink dependencies and retained header/input SDK attribute observers; keyed factories separate, no whole-tree native retirement proof';
definitions['inline-settings'].description = 'Actual shared InlineSelect sends configureStorage through existing intent, keeps sheet open, sends current pair, suppresses duplicate/invalid/retired sheet and presentation callbacks';
const selected = selectContractCases(definitions);
if (selected.length) {
  const resolution = registerReaderTypeScriptImports();
  try {
    for (const id of selected) {
      await runSelectedCase(id);
      recordContractCasePass(id);
    }
  } finally {
    resolution.deregister();
  }
}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { createHash } = await import('node:crypto');
const { readFileSync } = await import('node:fs');

// Deterministic source/SDK-attribute evidence only. This test never runs a
// browser, performs native layout, paints glyphs, builds a HAP or uses a VM.

const visual = await import('../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
const projection = await import('../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');
const metricsExports = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const surfaceResolvers = await import('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts');
const horizontalGeometry = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const pageGeometry = await import('../entry/src/main/ets/features/common/ReaderPageGeometry.ts');
const pageFrame = await import('../entry/src/main/ets/features/common/ReaderFrameStyle.ts');
const scrollLayout = await import('../entry/src/main/ets/features/common/ReaderScrollLayout.ts');
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
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { root: sdk, require, ts, options } = installedEtsCompiler();
const tree = ts.createSourceFile('SharedDownloadPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const page = tree.statements.find(node => node.name?.getText(tree) === 'SharedDownloadPage');
assert.ok(page, 'the actual production component is the probe input');
const methods = [...page.members.filter(node => ts.isMethodDeclaration(node)).map(node => node.name.getText(tree)),
  'readerWindowMetricsRevision', 'books', 'storageSummary', 'loading', 'appThemeScheme', 'sheet', 'confirmation', 'presentationIdentity', 'detailKey',
  'query', 'bookType', 'stateFilter', 'sourceFilter', 'sortField', 'sortDirection'];
// These production initializers own native measurement and sheet-exit
// admission. Retain them rather than replacing them with fixture defaults.
methods.push('chapterScrollRestoreEpoch','chapterScrollRestorePending','chapterScrollRestoreScheduled','listScrollRestoreEpoch','listScrollRestorePending','measurements', 'measurementRevision', 'pageWidth', 'pageHeight', 'reduceMotion', 'sheetWasVisible',
  'sheetMaskReady', 'sheetExitPending', 'sheetAnimationGeneration', 'transientFeedback',
  'storageDockSurfaceWidth', 'storageDockSurfaceHeight', 'selectionDockSurfaceWidth', 'selectionDockSurfaceHeight',
  'operationsHeaderMeasuredHeight', 'bookOperationsBodyMeasuredHeight');
const frameSource = tree.statements.find(node => node.name?.getText(tree) === 'SharedDownloadIdleFrame');
assert.ok(frameSource, 'the production idle-frame adapter is retained');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { SharedDownloadIdleFrame } = pureModuleProbe(frameSource.getText(tree), 'SharedDownloadIdleFrame.ets',
  { FrameCallback: class {} }, ['SharedDownloadIdleFrame']);
const coordinatorSource = readFileSync(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url), 'utf8');
const coordinatorTree = ts.createSourceFile('ReaderWindowCoordinator.ts', coordinatorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const chromeClass = coordinatorTree.statements.find(node => node.name?.getText(coordinatorTree) === 'ReaderWindowChromeStyle');
assert.ok(chromeClass, 'the real window-chrome DTO is the platform-boundary input');
const { ReaderWindowChromeStyle } = pureModuleProbe(chromeClass.getText(coordinatorTree), 'ReaderWindowChromeStyle.ts',
  { findReaderTheme }, ['ReaderWindowChromeStyle']);

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
const { readerScrimmedOpaqueColor } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/features/common/ReaderScrimColor.ets', import.meta.url), 'utf8'),
  'ReaderScrimColor.ets', { ColorMetrics: nativeColorMetrics }, ['readerScrimmedOpaqueColor']);
const { readerActionIcon } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionIconResources.ets',import.meta.url),'utf8'),
  'ReaderActionIconResources.ets', {$r:value=>value}, ['readerActionIcon']);
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
  ...visual, ...projection, ...metricsExports, ...surfaceResolvers, ...surfaces, ...pageGeometry, ...pageFrame, ...scrollLayout,
  ReaderMeasurementStore, ReaderTransientFeedback,
  readerAppColor, readerScrimmedOpaqueColor, readerActionIcon,
  ...propertyRuntime.sdk,
  SharedDownloadIdleFrame, ReaderWindowChromeStyle, TextModifier: TextModifierPort, SymbolGlyphModifier: SymbolGlyphModifierPort,
  ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
  prepareSharedDownloadFonts: () => new Promise((resolve, reject) => fontReceipts.push({ resolve, reject })),
  ReaderWindowCoordinator: { metrics: () => windowMetrics,
    requestOverlayChrome: style => chromeRequests.push({ owner: 'overlay', style }),
    requestAppChrome: () => chromeRequests.push({ owner: 'app' }) },
  ButtonType: enumValue('ButtonType'), ImageFit: enumValue('ImageFit'), InputType: enumValue('InputType'),
  WordBreak: enumValue('WordBreak'), ScrollAlign: enumValue('ScrollAlign'), ControlSize: enumValue('ControlSize'),
  TouchType: enumValue('TouchType'), AccessibilityRoleType: enumValue('AccessibilityRoleType'),
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
const { ReaderActionAccessibility, readerActionTouchRegion } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionAccessibility.ets', import.meta.url), 'utf8'),
  'ReaderActionAccessibility.ets', { AccessibilityRoleType: enumValue('AccessibilityRoleType') }, ['ReaderActionAccessibility','readerActionTouchRegion']);
// The legacy bounded-surface fixture predates the action-menu's real scale
// imports. Compose these two actual children locally with their shipping
// dependencies; do not replace their content or relax the common runtime.
const actionMenuSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionMenuSurface.ets',import.meta.url),'utf8');
const actionSheetSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderActionSheetContent.ets',import.meta.url),'utf8');
const { ReaderMenuActionView }=pureModuleProbe(actionMenuSource.slice(0,actionMenuSource.indexOf('@Component')),
  'ReaderMenuActionView.ets',{},['ReaderMenuActionView']);
const { ReaderActionSheetAction }=pureModuleProbe(actionSheetSource.slice(0,actionSheetSource.indexOf('@Component')),
  'ReaderActionSheetAction.ets',{ReaderMenuActionView},['ReaderActionSheetAction']);
Object.assign(probeDependencies,{ReaderActionAccessibility,readerActionTouchRegion,ReaderMenuActionView,ReaderActionSheetAction});
probeHooks.childSources={...probeHooks.childSources,ReaderActionMenuSurface:actionMenuSource,ReaderActionSheetContent:actionSheetSource};
probeDependencies.ReaderActionMenuSurface=createReaderBuilderProbe(actionMenuSource,boundedMembers(actionMenuSource),
  {...probeDependencies,...readerTypographyRoles},probeHooks).Component;
probeDependencies.ReaderActionSheetContent=createReaderBuilderProbe(actionSheetSource,boundedMembers(actionSheetSource),
  probeDependencies,probeHooks).Component;
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
// This case verifies the parent's actual SDK initializer and captured action;
// common PageState/recovery target rendering has separate existing evidence.
if (selectedCase === 'inline-filter') {
  probeHooks.childSources.ReaderPageState = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderPageState.ets',import.meta.url),'utf8');
  probeDependencies.ReaderPageState = RaisedSurfaceInputs;
}
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
    readingBookTitle: '', readingChapterTitle: '', listOffset: 0, pageHeight: 0,
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

if(selectedCase==='area-receipts'){
// The native port records leaf calls, not parent layout. Check the actual ETS
// ListItem ownership separately, then mount those same SDK deferred bodies.
for (const name of ['bookPage', 'chapterPage']) {
  const builder = page.members.find(member => member.name?.getText(tree) === name);
  const headers = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'this.compactHeader') headers.push(node);
    ts.forEachChild(node, visit);
  };
  visit(builder); assert.equal(headers.length, 1, `${name}: one header call`);
  let inListItem = false, inList = false;
  for (let node = headers[0].parent; node && node !== builder; node = node.parent) {
    assert.equal(ts.isIfStatement(node), false, `${name}: ordinary list header is unconditional`);
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression) {
      inListItem ||= node.expression.getText(tree) === 'ListItem';
      inList ||= node.expression.getText(tree) === 'List';
    }
  }
  assert.ok(inListItem && inList, `${name}: header is inside the actual ListItem/List syntax`);
  const firstItem = [];
  const items = node => { if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression?.getText(tree) === 'ListItem') firstItem.push(node); ts.forEachChild(node, items); };
  items(builder);
  assert.ok(firstItem[0].getText(tree).includes('this.compactHeader()'), `${name}: header owns the first source ListItem`);
}
const chapter = index => ({ ...completeChapter, key: JSON.stringify([book.sourceId, book.bookId, index]),
  index, chapterId: `chapter:${index}`, title: `第${index+1}章` });
const catalog = { ...book, shelfBook: { ...book.shelfBook, readingPosition: { chapterIndex: 1 } },
  chapters: [chapter(0), chapter(1), chapter(2)], totalChapters: 3 };
const samples = [];
for (const width of [320,366]) for (const scale of [1,1.3,1.6,2]) for (const height of [80,844])
for (const detail of [false,true]) for (const managing of [false,true]) {
  windowMetrics = { ...originalWindowMetrics, windowRect: { left:0, top:0, width, height }, systemFontScale:scale };
  platformFontScale = scale;
  const layout = owner('day', { books:[catalog,another], fontsReady:true, managing,
    detailKey:detail?catalog.key:'', pageHeight:height });
  assert.equal(layout.fontScale(), scale, 'actual feature helper reads the controlled window scale');
  layout.initialRender(); admitListItems(layout);
  const frame = [...layout.children.values()].find(child => child.params?.headerVisible === false);
  assert.ok(frame, 'actual scaffold receives headerVisible=false, with no empty fixed-header host');
  assert.equal(records(layout).filter(node => label(node) === (detail?'章节下载':'下载管理')).length, 1,
    'one real header is rendered, including both browse/management and short-window cases');
  assert.equal(records(layout).filter(node => node.type === 'List').length, 1, 'one active main List');
  const paintedDocks = records(layout).filter(node => node.type === (detail||managing?'Column':'Row') &&
    node.constraintSize === undefined && node.borderRadius === visual.DOWNLOAD_VISUAL.dockRadius && typeof node.onAreaChange === 'function');
  assert.equal(paintedDocks.length, 1, 'one actual dock drawing host across list/fixed placement: '+
    JSON.stringify({width,scale,height,detail,managing,nodes:paintedDocks.map(node=>({type:node.type,id:node.id,padding:node.padding}))}));
  const fixed = managing && height === 844;
  assert.equal(layout.fixedSelectionDockVisible(), fixed, 'ordinary browse flows; viable management fixes; tiny windows flow');
  const geometry = layout.pageGeometry(), nativeList = records(layout).find(node => node.type === 'List');
  assert.deepEqual([geometry.header.top,geometry.header.height,geometry.content.startInset],[0,0,0],
    'inline header never creates a phantom fixed-header avoidance band');
  assert.equal(nativeList.contentStartOffset, 0);
  if (fixed) {
    assert.equal(geometry.chromeMode,'overlay');
    assert.ok(geometry.content.endInset >= geometry.footer.height + geometry.footer.bottom,
      'fixed selection dock has bottom avoidance owned once by the shared geometry');
    assert.ok(height - geometry.content.endInset >= layout.selectionDockMinimumContentHeight(),
      'fixed mode reserves an actual minimum task-content budget');
  } else {
    assert.equal(geometry.chromeMode,'inline');
    assert.equal(geometry.content.endInset,0,'inflow footer does not leave a second fixed-footer gap');
    assert.equal(geometry.footer.height,0,'no ghost fixed footer geometry');
  }
  assert.equal(nativeList.contentEndOffset,geometry.content.endInset);
  samples.push({width,fontScale:scale,height,context:detail?'chapters':'books',managing,
    fixedSelectionDock:fixed,startInset:geometry.content.startInset,endInset:geometry.content.endInset});
  layout.aboutToDisappear();
}
// Locate-current always counts the inline header, book summary and toolbar,
// independently of management/fixed-footer placement.
windowMetrics = originalWindowMetrics; platformFontScale = 1;
for (const managing of [false,true]) {
  const positions = [];
  const locating = owner('day',{books:[catalog],fontsReady:true,managing,detailKey:catalog.key,
    chapterScroller:{scrollToIndex:(...args)=>positions.push(args),currentOffset:()=>({yOffset:40}),scrollTo(){}}});
  locating.locateCurrent();
  assert.deepEqual(positions[0],[4,true,'ScrollAlign.CENTER'],'three leading ListItems plus current chapter ordinal');
  locating.aboutToDisappear();
}
for (const detail of [false,true]) for (const stale of [false,true]) {
  const finishing = owner('day',{books:[catalog],fontsReady:true,managing:true,
    detailKey:detail?catalog.key:'',selectedBookKeys:[],selectedChapterIndices:[]});
  finishing.selectionDock();
  const complete = find(finishing,node=>node.type==='Button'&&node.accessibilityText==='完成批量管理','management can finish from its current operation dock');
  assert.ok(complete.constraintSize.minHeight>=44&&complete.constraintSize.minWidth>=44,
    'completion authors a real minimum touch frame, even without a selection');
  assert.ok(records(finishing).some(node=>node.type==='Flex'&&node.create?.wrap==='FlexWrap.Wrap'),
    'summary/completion can wrap instead of forcing a narrow fixed row');
  if(stale) finishing.presentationGeneration++;
  complete.onClick();
  assert.equal(finishing.managing,stale,'current completion exits, retired presentation callback cannot exit a later management session');
  finishing.aboutToDisappear();
}
const epochDock = owner('day',{fontsReady:true,managing:true});epochDock.selectionDock();
const oldCompletion=find(epochDock,node=>node.type==='Button'&&node.accessibilityText==='完成批量管理','current epoch completion').onClick;
const epochFactory=find(epochDock,node=>node.type==='ForEach','actual dock-key factory');
assert.ok(propertyRuntime.dependencies.get(epochDock)?.get('readerWindowMetricsRevision')?.has(epochFactory.id),
  'the real key factory subscribes to current window snapshots');
epochDock.presentationGeneration++;
// Run only the real current-key factory. The finite SDK port cannot remove
// retired native If subtrees, so replaying those old children would claim a
// renderer capability it does not provide. Their saved callbacks stay tested.
epochDock.replayOnly(new Set([epochFactory.id]));
const newCompletion=[...epochDock.nodes.values()].filter(node=>node.type==='Button'&&node.accessibilityText==='完成批量管理').at(-1).onClick;
assert.notEqual(newCompletion,oldCompletion,'actual keyed SDK observer produces current-epoch actions on the retained page actor');
oldCompletion();assert.equal(epochDock.managing,true,'old epoch action is rejected');
newCompletion();assert.equal(epochDock.managing,false,'fresh epoch action remains usable instead of capturing an outer retired generation');
epochDock.aboutToDisappear();
// Keep the old real native Area closure while its UI context retires. No
// generic native If-removal/reconciliation is simulated by this port.
const measuring = owner('day',{fontsReady:true});
measuring.storageDock();
const oldStorageArea = find(measuring,node=>node.type==='Row'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange,'old inflow storage receipt').onAreaChange;
oldStorageArea({}, {width:'306vp',height:'83vp'});
assert.equal(measuring.resolvedDockHeight(),83);
const oldKey = measuring.dockMeasurementKey();
measuring.setManaging(true); measuring.selectionDock();
assert.notEqual(measuring.dockMeasurementKey(),oldKey,'content mode has a different measurement identity');
const selectionArea = records(measuring).filter(node=>node.type==='Column'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange).at(-1).onAreaChange;
selectionArea({}, {width:'306vp',height:'137vp'});
assert.equal(measuring.resolvedDockHeight(),137);
measuring.selectedBookKeys=[book.key];
assert.equal(measuring.resolvedDockHeight(),137,
  'same-context label/count changes retain the last real geometry when native Area stays the same');
selectionArea({}, {width:'306vp',height:'153vp'});
assert.equal(measuring.resolvedDockHeight(),153,
  'the retained current native node still accepts a real height change after its selection label changes');
const anchor = measuring.managingScrollAnchor;
oldStorageArea({}, {width:'306vp',height:'999vp'});
assert.equal(measuring.resolvedDockHeight(),153,'late old inflow storage cannot overwrite current fixed selection budget');
assert.equal(measuring.managingScrollAnchor,anchor,'old Area cannot retire or requeue the current viewport anchor');
const currentKey = measuring.dockMeasurementKey();
windowMetrics = { ...originalWindowMetrics,windowRect:{...originalWindowMetrics.windowRect,height:300} };
assert.equal(measuring.dockMeasurementKey(),currentKey,'height-only placement change keeps same-content width/font measurement');
windowMetrics = { ...originalWindowMetrics,windowRect:{...originalWindowMetrics.windowRect,width:320},systemFontScale:2 };
assert.notEqual(measuring.dockMeasurementKey(),currentKey,'new width/font needs a new measurement');
const fallback = measuring.resolvedDockHeight(); selectionArea({}, {width:'306vp',height:'777vp'});
assert.equal(measuring.resolvedDockHeight(),fallback,'old width/font receipt is rejected');
windowMetrics = originalWindowMetrics;
measuring.aboutToDisappear();
const stored = owner('day',{fontsReady:true}); stored.storageDock();
const retainedStorageArea = find(stored,node=>node.type==='Row'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange,
  'retained ordinary capacity dock').onAreaChange;
retainedStorageArea({}, {width:'306vp',height:'83vp'});
const storedKey = stored.dockMeasurementKey();
stored.storageSummary={totalBytes:4096};
stored.books=[book,{...another,bytes:1024}];
assert.equal(stored.dockMeasurementKey(),storedKey,'capacity/unknown display facts do not retire the native geometry owner');
assert.equal(stored.resolvedDockHeight(),83,'same-context display update without Area retains real geometry');
retainedStorageArea({}, {width:'306vp',height:'97vp'});
assert.equal(stored.resolvedDockHeight(),97,'retained native Area accepts changed capacity text height');
stored.aboutToDisappear();
const liveDock = owner('day',{fontsReady:true,managing:true}); liveDock.selectionDock();
const beforeWidthDock = find(liveDock,node=>node.type==='Column'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange,
  'initial retained selection drawing host');
const beforeWidthArea = beforeWidthDock.onAreaChange;
beforeWidthArea({}, {width:'306vp',height:'131vp'});
windowMetrics={...originalWindowMetrics,windowRect:{...originalWindowMetrics.windowRect,width:320},systemFontScale:2};
const liveFactory=find(liveDock,node=>node.type==='ForEach','actual retained width/font key factory');
assert.ok(propertyRuntime.dependencies.get(liveDock)?.get('readerWindowMetricsRevision')?.has(liveFactory.id));
liveDock.replayOnly(new Set([liveFactory.id]));
const afterWidthDock = [...liveDock.nodes.values()].filter(node=>node.type==='Column'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange).at(-1);
assert.ok(afterWidthDock&&afterWidthDock.onAreaChange!==beforeWidthArea,
  'actual current width/font observer installs a fresh keyed drawing-host receipt');
const widthFallback=liveDock.resolvedDockHeight();
beforeWidthArea({}, {width:'306vp',height:'999vp'});
assert.equal(liveDock.resolvedDockHeight(),widthFallback,'retired width/font host cannot overwrite the new budget');
afterWidthDock.onAreaChange({}, {width:'260vp',height:'197vp'});
assert.equal(liveDock.resolvedDockHeight(),197,'fresh keyed SDK host accepts its actual initial Area');
liveDock.aboutToDisappear();windowMetrics=originalWindowMetrics;

// Exiting management restores once without waiting for the far-away ordinary
// footer. A later wheel/key offset must not be overwritten by its delayed Area.
let offset = 143; const restored = [];
const exiting = owner('day',{fontsReady:true,managing:true,listScroller:{currentOffset:()=>({yOffset:offset}),
  scrollTo:value=>restored.push(value)}});
exiting.setManaging(false);
scheduledFrames.at(-1).onIdle();
assert.equal(exiting.managingScrollAnchor,undefined,'ordinary list exit retires its anchor after the first frame');
offset = 219;
const restoreCount = restored.length;
exiting.storageDock();
const lateNormal = find(exiting,node=>node.type==='Row'&&node.borderRadius===visual.DOWNLOAD_VISUAL.dockRadius&&node.onAreaChange,'late ordinary footer');
lateNormal.onAreaChange({}, {width:'306vp',height:'111vp'});
for(const frame of scheduledFrames.slice(-2)) frame.onIdle();
assert.equal(restored.length,restoreCount,'late ordinary footer cannot pull wheel/key navigation to the old offset');
exiting.aboutToDisappear();
for (const measuredWidth of [originalWindowMetrics.windowRect.width,320]) {
  const positions=[];
  const resizing=owner('day',{fontsReady:true,pageHeight:844,listScroller:{currentOffset:()=>({yOffset:143}),
    scrollTo:value=>positions.push(value)}});
  resizing.initialRender();admitListItems(resizing);
  const host=[...resizing.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange);
  assert.ok(host,'actual scaffold viewport Area callback');
  resizing.enterManaging();const pending=scheduledFrames.at(-1);
  const globalRevision=resizing.readerWindowMetricsRevision;
  host.onAreaChange({}, {width:`${measuredWidth}vp`,height:'844vp'});
  assert.equal(resizing.readerWindowMetricsRevision,globalRevision,'local page width can change without a global metrics revision');
  pending.onIdle();
  if(measuredWidth===originalWindowMetrics.windowRect.width) {
    assert.deepEqual(positions,[{xOffset:0,yOffset:143}],
      'initial 0-to-same-resolved-width measurement does not cancel a valid viewport restore');
  } else {
    assert.deepEqual(positions,[],'actual viewport width change retires the pending old-width restore');
    resizing.recordDockHeight(149);
    assert.deepEqual(positions,[],'new-width dock Area cannot resurrect a retired viewport anchor');
    assert.equal(resizing.managingScrollAnchor,undefined);
  }
  resizing.aboutToDisappear();
}
console.log(JSON.stringify({contexts:samples.length,widths:[320,366],fontScales:[1,1.3,1.6,2],
  boundary:'Actual controlled-window helpers/SDK attributes and finite Area/offset receipts; no native glyph/layout/hit/focus or reconciliation proof.',samples}));
}

if(selectedCase==='native-bindings'){
for(const scheme of ['day','night']){
 const header=owner(scheme);header.topBar();const heading=text(header,'下载管理');assert.ok(heading.fontSize>0&&heading.lineHeight>0);const headerBox=find(header,n=>n.constraintSize?.minHeight===visual.DOWNLOAD_VISUAL.headerHeight&&n.onAreaChange,'actual header');const before=header.contentTop();headerBox.onAreaChange({}, {height:visual.DOWNLOAD_VISUAL.headerHeight+18});assert.equal(header.contentTop(),before+18);
 assert.equal(argb(headerBox.backgroundColor),argb(readerAppColor('TOK_SURFACE_SOLID',scheme)));
 assert.equal(argb(headerBox.border.color),argb(readerAppColor('app.border.control',scheme)));
 assert.deepEqual(headerBox.shadow,surfaces.readerSurfaceElevation('fixed',scheme),'header keeps its existing material; list ownership is checked separately');
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
  assert.equal(dock.resolvedDockHeight(),91,'the current-context dock receipt owns content avoidance');
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
if(selectedCase==='inline-settings'){
const intents=[],f=owner('day',{sheet:'settings',sheetAnimationGeneration:4,sheetExitPending:false,onIntent:value=>intents.push(value)});f.settingsSheet();const a=actors(f);assert.equal(a.length,2);const next=f.limitChoices()[0],days=f.dayChoices().at(-1);
inline.choose(a[0],projection.formatDownloadStorageBytes(next*1024*1024));assert.equal(f.cacheLimitMb,next);assert.equal(f.sheet,'settings');
assert.deepEqual(intents[0],{action:'configureStorage',scope:'storage',books:[],cacheLimitMb:next,cleanupAfterDays:7});
inline.choose(a[1],days+' 天');assert.equal(f.cleanupAfterDays,days);assert.equal(f.storagePolicyDraftChanged,true);assert.equal(intents.length,2);assert.equal(intents[1].cacheLimitMb,next);assert.equal(intents[1].cleanupAfterDays,days);
const capacity=a[0].onSelect,valid=f.limitChoices().length-1,before=intents.length,validLabel=projection.formatDownloadStorageBytes(f.limitChoices()[valid]*1024*1024);
for(const kind of ['sheet','sheet-generation','exit','presentation','unmounted']){const saved={sheet:f.sheet,sheetAnimationGeneration:f.sheetAnimationGeneration,sheetExitPending:f.sheetExitPending,presentationGeneration:f.presentationGeneration,mounted:f.mounted};if(kind==='sheet')f.sheet='sort';if(kind==='sheet-generation')f.sheetAnimationGeneration++;if(kind==='exit')f.sheetExitPending=true;if(kind==='presentation')f.presentationGeneration++;if(kind==='unmounted')f.mounted=false;capacity(valid,validLabel);assert.equal(intents.length,before,`settings callback refuses ${kind}`);Object.assign(f,saved);}
capacity(-1,'invalid');capacity(f.limitIndex(),projection.formatDownloadStorageBytes(f.cacheLimitMb*1024*1024));assert.equal(intents.length,before,'invalid or unchanged choices do not write');
f.cacheLimitMb=600;const customIndex=f.limitIndex(),oldCustom=projection.formatDownloadStorageBytes(600*1024*1024);f.cacheLimitMb=700;capacity(customIndex,oldCustom);assert.equal(intents.length,before,'a replaced custom policy option cannot reinterpret an old index');
}
if(selectedCase==='inline-filter'){
const scrolls=[],published=[],f=owner('day',{query:'missing',bookType:'manga',stateFilter:'failed',sourceFilter:'missing-source',sortField:'title',sortDirection:'asc',selectedBookKeys:[book.key],listOffset:88,listScroller:{scrollTo:value=>scrolls.push(value)},onViewStateChanged:value=>published.push(value)});
f.bookPage();admitListItems(f);const empty=[...f.children.values()].find(c=>c.params?.title==='没有匹配的书籍');assert.ok(empty);assert.equal(empty.params.actionLabel,'清除筛选');const reset=empty.params.onAction;reset();assert.deepEqual([f.query,f.bookType,f.stateFilter,f.sourceFilter],['','all','all','all']);assert.deepEqual([f.sortField,f.sortDirection],['title','asc']);assert.deepEqual(Array.from(f.selectedBookKeys),[]);assert.equal(f.listOffset,0);assert.deepEqual(scrolls.at(-1),{xOffset:0,yOffset:0});assert.equal(f.visibleBooks().length,2);assert.ok(published.length>0);
f.query='retired';f.presentationGeneration++;reset();assert.equal(f.query,'retired','old empty-state callback cannot clear a successor');
const none=owner('day',{books:[]});none.bookPage();admitListItems(none);assert.equal([...none.children.values()].find(c=>c.params?.title==='书架为空')?.params.actionLabel,'','genuine empty library has no meaningless filter reset');
}
if(selectedCase==='native-bindings'){
for(const width of [320,366])for(const scale of [1,1.3,1.6,2]){
windowMetrics={...originalWindowMetrics,windowRect:{...originalWindowMetrics.windowRect,width},systemFontScale:scale};
const tab=owner();tab.typeTab('all','全部书籍');const tabButton=find(tab,n=>n.type==='Button','actual tab');assert.ok(tabButton.constraintSize.minHeight>=44&&tabButton.constraintSize.minWidth>=44);
const f=owner('day',{fontsReady:true});f.bookRow(()=>book,false);const title=find(f,n=>n.type==='Button'&&n.accessibilityText===`${book.title}，打开章节`,'book title target');assert.ok(title.constraintSize.minHeight>=44);for(const value of [f.authorSource(book),f.downloadCount(book,false)]){const t=text(f,value);assert.ok(t.constraintSize.minHeight>=44&&t.constraintSize.minWidth>=44);assert.equal(t.accessibilityRole,'AccessibilityRoleType.BUTTON');}
const selecting=owner('day',{managing:true});selecting.bookRow(()=>book,false);const check=find(selecting,n=>n.type==='Checkbox','book checkbox');assert.equal(check.width,17);assert.equal(check.responseRegion.width,44);assert.equal(check.responseRegion.height,44);assert.ok(records(selecting).some(n=>n.type==='Stack'&&n.width===44&&n.height===44),'checkbox response is hosted in authored 44 slot');
const secondary=owner();secondary.bookRow(()=>book,true);assert.equal(text(secondary,secondary.authorSource(book)).accessibilityRole,'AccessibilityRoleType.TEXT','inert chapter-context metadata does not become a button');
const full={...book,chapters:[completeChapter]},chap=owner('day',{books:[full],detailKey:full.key,managing:true,fontsReady:true});chap.chapterRow(()=>full,()=>completeChapter);const ct=text(chap,completeChapter.title);assert.ok(ct.constraintSize.minHeight>=44);assert.equal(ct.accessibilityRole,'AccessibilityRoleType.TEXT','management chapter title is not a read action');const cc=find(chap,n=>n.type==='Checkbox','chapter checkbox');assert.equal(cc.responseRegion.width,44);assert.equal(cc.responseRegion.height,44);const browseChapter=owner('day',{books:[full],detailKey:full.key});browseChapter.chapterRow(()=>full,()=>completeChapter);assert.equal(text(browseChapter,completeChapter.title).accessibilityRole,'AccessibilityRoleType.BUTTON');
const group={...completeChapter,navigable:false,title:'卷一'};chap.chapterGroup(()=>full,()=>group);const groupButton=find(chap,n=>n.type==='Button'&&n.accessibilityText==='选择卷一中的全部章节','group action');assert.ok(groupButton.constraintSize.minHeight>=44);assert.ok(chap.selectionDockMinimumContentHeight()>=44+visual.DOWNLOAD_VISUAL.sourceLineHeight*scale+visual.DOWNLOAD_VISUAL.chapterPaddingY*2);
const choice=owner();choice.choiceRow('当前条件',()=>true,()=>{});const radio=find(choice,n=>n.type==='Radio','visual radio');assert.equal(radio.onChange,undefined,'outer Button is the sole selection callback');assert.equal(radio.hitTestBehavior,'HitTestMode.None');
}
windowMetrics=originalWindowMetrics;
console.log('8 width/scale contexts; tabs, text actions, checkbox slots, chapter group and single-owner option targets; native hit dispatch NOT_RUN');
}
if(selectedCase==='inline-quick'){const f=owner('day',{managing:true});f.chapterToolbar(()=>book);const a=actors(f);assert.equal(a.length,1);assert.deepEqual(Array.from(a[0].options),['快速选择','当前章节','从当前往后','全部章节']);inline.choose(a[0],'全部章节');assert.ok(f.selectedChapterIndices.length>=0,'actual quick action reached page; empty fixture catalog stays empty');}
if(selectedCase==='inline-range'){const f=owner('day',{actionBookKeys:[book.key,another.key],rangeBookKey:book.key});f.rangeSheet();const a=actors(f);assert.equal(a.length,1);inline.choose(a[0],a[0].options[1]);assert.equal(f.rangeBookKey,another.key);}

if (selectedCase === 'select-measurement') {
  const page = owner();
  try {
    windowMetrics = { ...originalWindowMetrics, windowRect: { ...originalWindowMetrics.windowRect, width: 1000 } };
    measuredWidths = new Map([['current', 420], ['short', 42], ['option', 300], ['label', 180]]);
    const start = measurements.length, converted = convertedWidths.length;
    const width = page.selectClosedWidth('current', ['option'], 500, 'label');
    assert.deepEqual(measurements.slice(start).map(call => call.textContent), ['current', 'label']);
    assert.deepEqual(convertedWidths.slice(converted), [180, 420], 'label and selected value cross the pixel boundary once');
    assert.equal(measurements[start].fontSize, readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontSizeFp);
    assert.equal(measurements[start].fontFamily, readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontFamily);
    const child = new inline.dependencies.ReaderSelect(undefined, { value: 'current', options: ['option'], controlWidth: 0 });
    assert.equal(width, Math.ceil(420 / 3) + child.resolvedChrome());
    assert.equal(page.selectClosedWidth('current', ['option'], 130, 'label'), 130);
    const short = page.selectClosedWidth('short', ['option'], 500, 'label');
    assert.equal(short, Math.ceil(42 / 3) + child.resolvedChrome());
    assert.equal(page.selectClosedWidth('short', [], 500, 'label'), short, 'popup options do not widen the closed trigger');
    windowMetrics = { ...windowMetrics, windowRect: { ...windowMetrics.windowRect, width: 100 } };
    assert.ok(page.selectClosedWidth('current', ['option'], 500, 'label') >= 0);
    windowMetrics = { ...originalWindowMetrics, systemFontScale: 2 };
    const scaledStart = measurements.length;
    page.selectClosedWidth('current', ['option'], 500, 'label');
    assert.equal(measurements[scaledStart].fontSize, readerTypographyRoles.TYPE_SELECT_DEFAULT_VALUE.fontSizeFp);
  } finally {
    windowMetrics = originalWindowMetrics;
    measuredWidths = new Map();
  }
}
if(selectedCase==='area-receipts'){
function checkDownloadArea(candidate = source) {
  const Component = candidate === source ? probe.Component : createReaderBuilderProbe(candidate, methods, probeDependencies, probeHooks).Component;
  for (const unit of [false, true]) {
    const length = value => unit ? `${value}vp` : value;
    const page = owner('day', { fontsReady: true }, Component); page.initialRender(); admitListItems(page);
    const list = find(page, node => node.type === 'List', 'actual download list before Area measurements');
    const scroller = page.listScroller;
    const host = [...page.nodes.values()].find(node => node.type === '__Common__' && typeof node.onAreaChange === 'function');
    assert.ok(host, 'the actual public download host owns its viewport Area callback');
    host.onAreaChange({}, { width:length(366),height: length(720) });
    assert.equal(page.pageHeight, 720, 'download Area viewport accepts numeric and vp receipts');
    assert.equal(page.pageWidth,366,'download Area raw viewport width accepts numeric and vp receipts');
    assert.equal(page.pageViewportWidth(),366,'download Area viewport width accepts numeric and vp receipts');
    const header = find(page, node => node.constraintSize?.minHeight===visual.DOWNLOAD_VISUAL.headerHeight && typeof node.onAreaChange === 'function', 'actual header measurement');
    header.onAreaChange({}, { height: length(70) });
    assert.equal(page.resolvedHeaderHeight(), 70, 'download Area header accepts numeric and vp receipts');
    const storage = find(page, node => node.type === 'Row' && node.constraintSize === undefined && node.borderRadius === visual.DOWNLOAD_VISUAL.dockRadius && typeof node.onAreaChange === 'function', 'actual storage dock measurement');
    storage.onAreaChange({}, { width:length(306),height: length(111) });
    assert.equal(page.resolvedDockHeight(), 111, 'download Area storage dock accepts numeric and vp receipts');
    assert.equal(page.storageDockSurfaceWidth,306,'download Area storage width accepts numeric and vp receipts');
    // Re-deliver the actual native List observer. Other branches can
    // legitimately remount at a new viewport; this port has no removal model.
    page.replayOnly([list.id]);
    assert.equal(page.nodes.get(list.id), list, 'download Area measurements retain the native book List');
    assert.equal(list.create.scroller, scroller); assert.equal(page.listScroller, scroller);
    assert.equal(list.contentStartOffset,0);assert.equal(list.contentEndOffset,0,
      'ordinary inflow header/footer need no fixed viewport avoidance');

    const selection = owner('day', { managing: true }, Component); selection.selectionDock();
    const selectedDock = find(selection, node => node.type === 'Column' && node.borderRadius === visual.DOWNLOAD_VISUAL.dockRadius && typeof node.onAreaChange === 'function', 'actual selection dock measurement');
    selectedDock.onAreaChange({}, { width:length(306),height: length(123) });
    assert.equal(selection.resolvedDockHeight(), 123, 'download Area selection dock accepts numeric and vp receipts');
    assert.equal(selection.selectionDockSurfaceWidth,306,'download Area selection width accepts numeric and vp receipts');
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
      panel.replayOnly([scroll.id]);
      assert.equal(panel.nodes.get(scroll.id), scroll, 'sheet Area receipts retain the native body Scroll');
      assert.equal(scroll.constraintSize.maxHeight, panel.sheetBodyMaxHeight());
    }
    const dialog = owner('day', { confirmation: 'cancel', pageHeight: 720, actionBookKeys:[book.key] }, Component); dialog.confirmationOverlay();
    const dialogActor=[...dialog.children.values()].find(child=>child.measureActionsHeight===true);
    assert.ok(dialogActor,'actual shared dialog owns actions measurement');
    const actions = find(dialogActor, node => node.type === 'Row' && typeof node.onAreaChange === 'function', 'actual confirmation action measurement');
    actions.onAreaChange({}, { height: length(91) });
    assert.equal(dialog.dialogActionsMeasuredHeight, 91, 'download Area confirmation actions accept numeric and vp receipts');
    const chapters=owner('day',{fontsReady:true},Component);chapters.chapterPage(()=>({...book,chapters:[completeChapter]}));
    const chapterViewport=find(chapters,node=>node.type==='List'&&node.onAreaChange,'actual chapter viewport');
    chapterViewport.onAreaChange({}, {height:length(318)});
    assert.equal(chapters.chapterLayoutReady,true,'download Area chapter viewport accepts numeric and vp receipts');
    const operations=owner('day',{sheet:'book-actions',pageHeight:720,actionBookKeys:[book.key]},Component);
    operations.operationsHeader();
    const operationsHeader=[...operations.nodes.values()].find(node=>node.type==='Column'&&node.onAreaChange);
    assert.ok(operationsHeader,'actual operations header owns its Area');
    operationsHeader.onAreaChange({}, {height:length(81)});
    assert.equal(operations.operationsHeaderMeasuredHeight,81,'download Area operations header accepts numeric and vp receipts');
    operations.operationsBody();
    const operationsBody=[...operations.nodes.values()].filter(node=>node.type==='Column'&&node.onAreaChange).at(-1);
    operationsBody.onAreaChange({}, {height:length(149)});
    assert.equal(operations.bookOperationsBodyMeasuredHeight,149,'download Area operations body accepts numeric and vp receipts');
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
console.log(JSON.stringify({areaConversions:areaConversions.length,numericAndVp:true,
  boundary:'Actual production Area adapters and shared SDK children; negative source mutations, not native geometry or pointer evidence.'}));


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
const original=windowMetrics;for(const [width,height,scale]of[[140,120,2],[366,809,1]]){windowMetrics={...original,windowRect:{left:0,top:0,width,height},systemFontScale:scale};const f=owner('day',{sheet:'filter',pageHeight:height,reduceMotion:true});assert.ok(f.sheetMaxHeight()>=0&&f.sheetMaxHeight()<=height);f.sheetOverlay();const scrolls=records(f).filter(n=>n.type==='Scroll');assert.equal(scrolls.length,1);assert.ok(scrolls[0].constraintSize.maxHeight<=height);text(f,'筛选');text(f,'完成');const d=owner('day',{confirmation:'deleteLocal',pageHeight:height,actionBookKeys:[book.key]});d.confirmationOverlay();assert.equal(records(d).filter(n=>n.type==='Scroll').length,1);text(d,'取消');text(d,'删除内容');}windowMetrics=original;

}
if(selectedCase==='reactive-metrics'){
// Execute the SDK's actual StorageLink getters/dependency recording and the
// retained header/input attribute observers. The dock's keyed factory is
// checked above; this finite port cannot deliver native retirement/removal of
// every old-key If subtree and does not claim whole-tree dirty scheduling.

const reactivePage = owner('day', { fontsReady: true, pageHeight: 800 });
reactivePage.initialRender(); admitListItems(reactivePage);
const downloadFrame = [...reactivePage.children.values()].find(child => child.params?.headerVisible === false);
assert.ok(downloadFrame?.nodes, 'downloads mounts the actual scaffold with its fixed header disabled');
const safeFrame = find(reactivePage,node=>node.type==='Column'&&node.padding?.top===reactivePage.headerTop()&&
  node.padding?.left===reactivePage.leftInset()&&node.padding?.right===reactivePage.rightInset(),
  'ordinary list header consumes the current safe horizontal frame');
assert.equal(safeFrame.padding.top,reactivePage.headerTop());
const reactiveInput = find(reactivePage, node => node.type==='TextInput',
  'baseline editable search line box');
const baselineInputHeight=reactiveInput.height;
const dependentIds = propertyRuntime.dependencies.get(reactivePage)?.get('readerWindowMetricsRevision');
assert.ok(dependentIds?.size > 0, 'SDK render observers subscribe to the actual StorageLink getter');
assert.ok(dependentIds.has(safeFrame.id)&&dependentIds.has(reactiveInput.id),
  'the actual header and input native observers each consume the revision');
const observerCount = reactivePage.observers.length;
windowMetrics = { ...originalWindowMetrics, systemFontScale: 2,
  systemInsets: { ...originalWindowMetrics.systemInsets, left: 32, right: 26 } };
reactivePage.readerWindowMetricsRevision += 1;
reactivePage.replayOnly(new Set([safeFrame.id,reactiveInput.id]));
assert.equal(safeFrame.padding.left, 32); assert.equal(safeFrame.padding.right, 26);
assert.ok(reactiveInput.height>baselineInputHeight,'retained native input grows with scale');
assert.equal(reactivePage.observers.length, observerCount, 'metric changes update retained attributes without remounting the document');



}
if (selectedCase === 'storage-publication') {
  const MiB = 1024 * 1024, GiB = MiB * 1024;
  const summary = { totalBytes: 3 * GiB, retainedBytes: GiB, automaticBytes: 2 * GiB,
    cleanableBytes: 512 * MiB, availableBytes: 8 * GiB };
  const page = owner('day', { storageSummary: summary });
  page.settingsSheet();
  page.clearStorageButton();
  const values = ['3.0 GB', '1.0 GB', '2.0 GB', '8.0 GB'].map(value => text(page, value));
  const ids = values.map(node => node.id);
  const clear = find(page, node => node.type === 'Button', 'actual cleanup');
  assert.equal(clear.enabled, true);
  assert.equal(clear.accessibilityText, '清理自动保存 · 512 MB');
  page.storageSummary = {};
  propertyRuntime.flush();
  assert.deepEqual(values.map(label), ['', '', '', '']);
  assert.deepEqual(values.map(node => page.nodes.get(node.id).id), ids);
  assert.equal(clear.enabled, false);
  page.storageSummary = { totalBytes: 0, retainedBytes: 0, automaticBytes: 0, cleanableBytes: 0, availableBytes: 0 };
  propertyRuntime.flush();
  assert.deepEqual(values.map(label), ['0 MB', '0 MB', '0 MB', '0 MB']);
  assert.equal(clear.enabled, false);
  page.storageSummary = summary;
  propertyRuntime.flush();
  assert.deepEqual(values.map(label), ['3.0 GB', '1.0 GB', '2.0 GB', '8.0 GB']);
  assert.equal(clear.enabled, true);

  const intents = [];
  const dialog = owner('day', { storageSummary: summary, sheet: 'settings',
    confirmation: 'cleanup', onIntent: intent => intents.push(intent) });
  dialog.confirmationOverlay();
  const confirm = records(dialog).filter(node => node.type === 'Button').at(-1);
  assert.equal(confirm.enabled, true);
  assert.ok(text(dialog, '清理 512 MB'));
  dialog.storageSummary = { ...summary, cleanableBytes: 0 };
  propertyRuntime.flush();
  // The shared dialog keys action carriers by admitted label and state.
  // The probe preserves the old callback as an explicit negative control.
  const currentConfirm = records(dialog).filter(node => node.type === 'Button').at(-1);
  assert.notEqual(currentConfirm, confirm);
  assert.ok(text(dialog, '清理 0 MB'));
  assert.equal(currentConfirm.enabled, false);
  confirm.onClick();
  currentConfirm.onClick();
  assert.deepEqual(intents, [], 'both old and current callbacks refuse the unavailable cleanup');
  assert.equal(dialog.confirmation, 'cleanup');
}

if(selectedCase==='retained-dto'){
// Replay actual Prop-dependent keyed-list and retained native observers. The
// SDK port can capture these without pretending to remove old If subtrees.
function deliverRetainedBookObservers(owner) {
  const observers = propertyRuntime.dependencies.get(owner)?.get('books');
  assert.ok(observers?.size, 'the original SDK observers subscribe to books');
  owner.replayOnly([...observers].filter(id => ['List', 'ForEach', 'Text', 'Progress', 'Button'].includes(owner.nodes.get(id)?.type)));
}
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
  deliverRetainedBookObservers(retainedBooks);
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
retainedBooks.books = [readyWithoutToc]; deliverRetainedBookObservers(retainedBooks);
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
progressPage.books = [{ ...book, downloadedChapters: 77, progressPercent: 77 }]; deliverRetainedBookObservers(progressPage);
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
retainedChapters.books = [{ ...chapterBook, chapters: [completeChapter] }]; deliverRetainedBookObservers(retainedChapters);
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
retainedChapters.books = [{ ...chapterBook, chapters: [] }]; currentChapterEvent();
assert.equal(readTargets.length, targetCount, 'a removed chapter cannot dispatch a stale reading target');
retainedChapters.books = [{ ...chapterBook, chapters: [completeChapter] }]; deliverRetainedBookObservers(retainedChapters);
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
stalePage.books = [readyWithoutToc]; deliverRetainedBookObservers(stalePage);
assert.equal(label(staleCount), '', 'the old stable-key snapshot remains stale under actual Prop delivery');
assert.throws(() => assert.equal(label(staleCount), stalePage.downloadCount(readyWithoutToc, false)),
  assert.AssertionError, 'the original bug fails the same retained-actor expectation');


}


if(selectedCase==='native-bindings'){
 const samples=[];
 for(const width of [320,366,720])for(const scale of [1,1.3,1.6,2,3.2]){
  windowMetrics={...originalWindowMetrics,windowRect:{left:0,top:0,width,height:844},systemFontScale:scale};platformFontScale=scale;
  const current=owner('day',{fontsReady:true,pageWidth:width});current.listTools();const ns=records(current);
  const direction=find(current,n=>n.type==='Button'&&String(n.accessibilityText).includes('切换为'),'real sort direction carrier');
  const label=find(current,n=>n.type==='Button'&&n.accessibilityText==='选择排序字段','sort field carrier');
  const filter=find(current,n=>n.type==='Button'&&n.accessibilityText==='筛选书籍','filter carrier');
  for(const n of [direction,label,filter]){assert.ok(n.width>=44);assert.ok(n.constraintSize.minHeight>=44);assert.equal(n.responseRegion,undefined,'native44 slots do not overlap through response expansion');assert.equal(n.height,undefined,'font growth remains minimum not cap');}
  const pair=ns.find(n=>n.type==='Row'&&n.width===current.listSortWidth()&&n.constraintSize?.minHeight);assert.ok(pair,'actual sort parent pays real child widths plus gap');
  assert.equal(pair.width,direction.width+visual.DOWNLOAD_VISUAL.sortPairGap+label.width);
  assert.ok(pair.constraintSize.minHeight>=Math.max(direction.constraintSize.minHeight,label.constraintSize.minHeight));
  assert.ok(ns.some(n=>n.type==='Stack'&&n.width===visual.DOWNLOAD_VISUAL.sortWidth&&n.height===visual.DOWNLOAD_VISUAL.sortWidth),'old24 paint slot centered inside44 action');
  assert.ok(ns.some(n=>n.type==='Image'&&n.width===visual.DOWNLOAD_VISUAL.sortIconSize),'original glyph size retained');
  const count=ns.find(n=>n.type==='Text'&&String(n.create).includes('本书'));assert.ok(count);
  const available=current.listToolsAvailableWidth();
  if(current.listToolsInline())assert.ok(direction.width+visual.DOWNLOAD_VISUAL.sortPairGap+label.width+filter.width+count.width+visual.DOWNLOAD_VISUAL.listToolsGap*3<=available,'single row pays controls,count,gaps');
  else {assert.ok(ns.some(n=>n.type==='Flex'),'tight parent wraps controls');assert.ok(pair.width+visual.DOWNLOAD_VISUAL.listToolsGap<=available);assert.ok(filter.width+visual.DOWNLOAD_VISUAL.listToolsGap<=available);assert.ok(count.width<=available);}
  const copy=ns.filter(n=>n.type==='Text'&&[current.filterLabel(),current.sortLabel()].includes(n.create));for(const n of copy)assert.equal(n.maxFontScale,scale);
  samples.push({width,scale,form:current.listToolsInline()?'inline':'wrapped',available,directionWidth:direction.width,fieldWidth:label.width,parentWidth:pair.width,minHeight:pair.constraintSize.minHeight});current.aboutToDisappear();
 }
 windowMetrics=originalWindowMetrics;platformFontScale=1;
 const before=source.replace('}.width(DOWNLOAD_VISUAL.touchTarget).constraintSize({ minHeight: this.listToolControlHeight() })',"}.width(DOWNLOAD_VISUAL.sortWidth).responseRegion({x:-10,y:0,width:44,height:44}).constraintSize({ minHeight: this.listToolControlHeight() })");assert.notEqual(before,source);
 const bad=createReaderBuilderProbe(before,methods,probeDependencies,probeHooks);const old=owner('day',{fontsReady:true},bad.Component);old.listSortControls();
 const d=find(old,n=>n.type==='Button'&&String(n.accessibilityText).includes('切换为'),'old direction');const l=find(old,n=>n.type==='Button'&&n.accessibilityText==='选择排序字段','old field');
 const overlap=d.responseRegion.x+d.responseRegion.width-(d.width+visual.DOWNLOAD_VISUAL.sortPairGap);assert.equal(overlap,7);assert.throws(()=>assert.ok(overlap<=0),assert.AssertionError,'former7vp overlap fails same geometry invariant');old.aboutToDisappear();
 console.log(JSON.stringify({samples,boundary:'actual SDK carriers and numeric parent constraints; no native hit or font rendering proof'}));
}
if(selectedCase==='management-scroll'){
 const catalog={...book,shelfBook:{...book.shelfBook,readingPosition:{chapterIndex:0}},chapters:[completeChapter]};
 function queued(Component=probe.Component){const commands=[];const page=owner('day',{books:[catalog],detailKey:catalog.key,fontsReady:true,chapterLayoutReady:true,chapterOffset:730,chapterScrollRestorePending:true,
  chapterScroller:{currentOffset:()=>({yOffset:99}),scrollTo:v=>commands.push(['offset',v]),scrollToIndex:(...args)=>commands.push(['index',...args])}},Component);page.restoreChapterOffset();const frame=scheduledFrames.at(-1);assert.equal(page.chapterScrollRestoreScheduled,true);return{page,frame,commands};}
 const normal=queued();normal.frame.onIdle();normal.frame.onIdle();assert.deepEqual(normal.commands,[['offset',{xOffset:0,yOffset:730}]],'normal captured chapter restore exactly once');normal.page.aboutToDisappear();
 const current=queued();current.page.selectionDock();const dockNodes=records(current.page),labelIndex=dockNodes.findIndex(n=>n.type==='Text'&&n.create==='定位当前');assert.ok(labelIndex>=0,'actual dock locator text');const dockLocate=dockNodes.slice(0,labelIndex).filter(n=>n.type==='Button').at(-1);assert.equal(typeof dockLocate?.onClick,'function','actual enclosing SDK Button');dockLocate.onClick();
 assert.deepEqual(current.commands,[['index',3,true,'ScrollAlign.CENTER']],'locator retains current chapter ordinal plus three inline ListItems');assert.equal(current.page.chapterScrollRestorePending,false);current.frame.onIdle();current.frame.onIdle();assert.deepEqual(current.commands,[['index',3,true,'ScrollAlign.CENTER']],'queued idle cannot pull dock positioning back');current.page.aboutToDisappear();
 for(const intent of ['filter','touch','management','open-book','back','presentation','retire']){
  const q=queued();if(intent==='filter')q.page.query='new';if(intent==='touch')q.page.onListTouch({type:'TouchType.Down'});if(intent==='management')q.page.setManaging(true);if(intent==='open-book')q.page.openBook(catalog);if(intent==='back')q.page.consumeBack();if(intent==='presentation')q.page.presentationIdentity='replacement';if(intent==='retire')q.page.aboutToDisappear();propertyRuntime.flush();q.frame.onIdle();assert.deepEqual(q.commands,[],intent+' retires the old chapter request');assert.equal(q.page.chapterScrollRestorePending,false);q.page.aboutToDisappear();
 }
 const removed=source.replace('    this.cancelChapterScrollRestore();\n    this.cancelManagingScroll();\n    this.chapterScroller.scrollToIndex','    this.cancelManagingScroll();\n    this.chapterScroller.scrollToIndex');assert.notEqual(removed,source);const bad=createReaderBuilderProbe(removed,methods,probeDependencies,probeHooks),old=queued(bad.Component);old.page.locateCurrent();old.frame.onIdle();assert.ok(old.commands.some(c=>c[0]==='offset'),'negative recreates old pullback');assert.throws(()=>assert.equal(old.commands.length,1),assert.AssertionError,'missing locator cancel is detected');old.page.aboutToDisappear();
 console.log(JSON.stringify({dockLocate:'PASS',normalRestore:'ONCE',explicitIntentBoundaries:7,negative:'old chapter pullback reproduced',boundary:'actual SDK dock callback and recorded scroller only'}));
}

if(selectedCase==='management-scroll'){
 const position={xOffset:0,yOffset:73};
 function queued(Component=probe.Component,extra={}){
  const writes=[];const value=owner('day',{fontsReady:true,listOffset:73,
   listScroller:{currentOffset:()=>undefined,scrollTo:v=>writes.push(v)},...extra},Component);
  value.restoreListOffset();const frame=scheduledFrames.at(-1);assert.ok(value.listScrollRestorePending);return{value,frame,writes};
 }
 const stable=queued();const pending=stable.value.listScrollRestorePending;
 stable.value.pageWidth=windowMetrics.windowRect.width;stable.value.pageHeight=stable.value.availableHeight();propertyRuntime.flush();
 assert.equal(stable.value.listScrollRestorePending,pending,'first measurement with unchanged resolved viewport is not a geometry change');
 stable.frame.onIdle();stable.frame.onIdle();assert.deepEqual(stable.writes,[position],'normal idle frame restores captured offset exactly once');
 assert.equal(stable.value.listScrollRestorePending,undefined);stable.value.aboutToDisappear();
 const touching=queued();touching.value.bookPage();find(touching.value,n=>n.type==='List','real ordinary List').onTouch({type:'TouchType.Down'});
 touching.frame.onIdle();assert.deepEqual(touching.writes,[],'real touch retires ordinary restore');assert.equal(touching.value.listScrollRestorePending,undefined);touching.value.aboutToDisappear();
 for(const [field,value]of [['query','new query'],['bookType','manga'],['stateFilter','downloaded'],['sourceFilter','new-source'],['sortField','size'],['sortDirection','asc']]){
  const q=queued();const original=q.value[field];q.value[field]=value;propertyRuntime.flush();q.value[field]=original;propertyRuntime.flush();q.frame.onIdle();
  assert.deepEqual(q.writes,[],field+' owns the viewport even if changed back before idle');assert.equal(q.value.listScrollRestorePending,undefined);q.value.aboutToDisappear();
 }
 const keyboard=queued();keyboard.value.searchField();find(keyboard.value,n=>n.type==='TextInput','real query actor').onChange('');keyboard.frame.onIdle();assert.deepEqual(keyboard.writes,[{xOffset:0,yOffset:0}],'same-value keyboard event explicitly resets once and cannot be pulled back');keyboard.value.aboutToDisappear();
 const cleared=queued();cleared.value.clearFilters();cleared.frame.onIdle();assert.deepEqual(cleared.writes,[{xOffset:0,yOffset:0}],'same-value clear-all cannot be pulled back');cleared.value.aboutToDisappear();
 for(const kind of ['new-opening','generation','font-generation','fonts-not-ready','font-prepare','window-revision','viewport-width','viewport-height','system-font','detail','management','unmounted','disappear-remount']){
  const q=queued(),savedMetrics=windowMetrics;
  if(kind==='new-opening'){q.value.presentationIdentity='replacement';q.value.presentationIdentity='visual-test';}
  if(kind==='generation')q.value.presentationGeneration++;
  if(kind==='font-generation')q.value.fontPreparationGeneration++;
  if(kind==='fonts-not-ready')q.value.fontsReady=false;
  if(kind==='font-prepare')q.value.prepareFonts();
  if(kind==='window-revision')q.value.readerWindowMetricsRevision++;
  if(kind==='viewport-width'){q.value.pageWidth=320;q.value.pageWidth=366;}
  if(kind==='viewport-height'){q.value.pageHeight=500;q.value.pageHeight=0;}
  if(kind==='system-font')windowMetrics={...windowMetrics,systemFontScale:2};
  if(kind==='detail')q.value.openBook(book);
  if(kind==='management')q.value.setManaging(true);
  if(kind==='unmounted')q.value.mounted=false;
  if(kind==='disappear-remount'){q.value.aboutToDisappear();q.value.aboutToAppear();}
  propertyRuntime.flush();q.frame.onIdle();q.frame.onIdle();assert.deepEqual(q.writes,[],kind+' rejects obsolete normal-list frame');
  assert.equal(q.value.listScrollRestorePending,undefined,kind+' retires pending restore');q.value.aboutToDisappear();windowMetrics=savedMetrics;
 }
 const latest=queued();latest.value.listOffset=119;latest.value.restoreListOffset();const newFrame=scheduledFrames.at(-1);latest.frame.onIdle();assert.deepEqual(latest.writes,[]);newFrame.onIdle();latest.frame.onIdle();newFrame.onIdle();assert.deepEqual(latest.writes,[{xOffset:0,yOffset:119}],'only latest explicit request restores once');latest.value.aboutToDisappear();
 const detached=queued(probe.Component,{listScroller:{currentOffset:()=>undefined,scrollTo(){throw Error('detached native List');}}});
 const scheduled=scheduledFrames.length;assert.doesNotThrow(()=>detached.frame.onIdle());detached.frame.onIdle();assert.equal(detached.value.listScrollRestorePending,undefined);assert.equal(scheduledFrames.length,scheduled,'spent unbound frame cannot retry or queue repeated pullbacks');detached.value.aboutToDisappear();
 // The former missing touch cancel must fail this exact SDK callback scenario.
 const oldTouch=source.replace("if (event.type === TouchType.Down) {\n      this.cancelListScrollRestore();", "if (event.type === TouchType.Down) {");assert.notEqual(oldTouch,source);
 const bad=createReaderBuilderProbe(oldTouch,methods,probeDependencies,probeHooks),negative=queued(bad.Component);negative.value.onListTouch({type:'TouchType.Down'});negative.frame.onIdle();assert.throws(()=>assert.deepEqual(negative.writes,[]),assert.AssertionError,'negative missing cancellation is caught');negative.value.aboutToDisappear();
 console.log(JSON.stringify({ordinaryRestore:'PASS',filterWatchFields:6,retirementBoundaries:13,stableFrameCount:1,negative:'missing touch cancellation detected',boundary:'SDK callbacks and recorded native scroller port; no device scroll evidence'}));
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
const publishMethod=page.members.find(member=>member.name?.getText(tree)==='publishViewState');
const capturedOffsetCalls=[];
const collectCapture=node=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)==='this.captureListOffset')capturedOffsetCalls.push(node);ts.forEachChild(node,collectCapture);};
collectCapture(publishMethod);assert.equal(capturedOffsetCalls.length,1,'current publish method captures the bound native offset once');
const capture= capturedOffsetCalls[0];
const unsafeScrollerSource = source.slice(0,capture.getStart(tree))+
  '(this.listOffset = this.listScroller.currentOffset().yOffset)'+source.slice(capture.end);
assert.ok(unsafeScrollerSource!==source,'the real current capture call is mutated, not a historical string pattern');
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
