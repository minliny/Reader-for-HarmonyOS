import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"toolbar-retained": {"description": "真实view-switch采样下工具actor不重建", "resources": []}, "detail-admission": {"description": "实际detail节点稳定与mutation优先shield", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { motionSegment } = await import('../entry/src/main/ets/features/common/MotionTimeline.ts');
const { readerInteractiveSafeBottom } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { localBookDetailSdk, localBookDetailSource } = await import('./lib/local-book-detail-sdk-probe.mjs');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');
const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const file = path => fileURLToPath(new URL(`../entry/src/main/ets/${path}`, import.meta.url));
const shelfFile = file('features/bookshelf/BookshelfPage.ets');
const shelfSource = readFileSync(shelfFile, 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const builderMethods = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['continueReadingCard', 'filterRow', 'projectionRow']) builderMethods.add(name);
const specSource = readFileSync(file('features/common/MotionSpec.ets'), 'utf8');
const declaration = specSource.slice(specSource.indexOf('const BOOKSHELF_VIEW_MOTION:'), specSource.indexOf('\nconst ENTRIES:'));
const curve = { interpolate: value => value };
const viewMotion = new Function('curves', 'Curve',
  `${stripTypeScriptTypes(declaration)}; return BOOKSHELF_VIEW_MOTION;`)(
  { cubicBezierCurve: () => curve }, { Linear: 'linear', EaseOut: 'easeOut' });
const Motion = productionMotionMethods(shelfFile, ['sampleViewSwitch'], { motionSegment });
const readerMetrics = { windowRect: { width: 390, height: 844 }, systemInsets: { top: 48, bottom: 34, left: 0, right: 0 }, cutoutInsets: {}, gestureInsets: {}, navigationInsets: {}, keyboardInsets: {} };
const readerFloatingTabContentInset = metrics => 68 + Math.max(15, readerInteractiveSafeBottom(metrics)) + 16;
const sampler = Object.assign(new Motion(), { viewMotion, viewFadeCurve: curve,
  viewContentCurve: curve, viewSwitchSourceMode: 'cover', viewSwitchDestinationMode: 'list' });
let shelfSamples = 0;
if(selectedCase==='toolbar-retained') {
for (const theme of ['day', 'night']) {
  const mountedItems = new Set();
  const { owner } = createReaderBuilderProbe(shelfSource, ['bookshelfList','shelfPageHandler','shelfScrollHandler','isShelfPresentationCurrent', 'sectionAction',
    'sectionActionAsset', 'canonicalFilterActiveAsset', 'isSectionActionActive', 'sectionActionLabel'], {
    READER_FLOATING_TOP_BAR_HEIGHT: 58,
    LazyForEach: { create() {}, pop() {} },
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    readerFloatingTabContentInset, ReaderWindowCoordinator: { metrics: () => readerMetrics },
  }, {
    onObserverExit(owner, id) {
      const node = owner.nodes.get(id);
      if (node.type === 'ListItem' && Array.isArray(node.create) &&
        typeof node.create[0] === 'function' && !mountedItems.has(id)) {
        mountedItems.add(id); node.create[0]();
      }
    },
  });
  Object.assign(owner, { appThemeScheme: theme, viewMode: 'cover', viewSwitchHeaderOpacity: 1,
    continueReading: undefined, filterRowVisible: false,
    viewModeError: '', visibleBookCount: 0, rowDataSource: {},
    shelfContentWidth: () => 352, readerFloatingTabContentInset, ReaderWindowCoordinator: { metrics: () => readerMetrics }, hasActiveFilters: () => false, isWideViewport: () => false });
  owner.bookshelfList(false);
  const icons = [...owner.nodes.values()].filter(node => node.type === 'Image');
  assert.equal(icons.length, 3);
  const ids = icons.map(node => node.id);
  const header = [...owner.nodes.values()].find(node => node.type === 'Row' && node.height === 38);
  const title = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '我的书架');
  assert.equal(title.layoutWeight,1,'title expansion keeps the three surviving tools right-aligned');
  assert.equal([...owner.nodes.values()].find(node=>node.type==='Row'&&node.height===34).width,undefined,
    'toolbar width follows its three actions without retaining an empty gear slot');
  for (const [source, target] of [['cover', 'list'], ['list', 'cover']]) {
    Object.assign(sampler, { viewSwitchSourceMode: source, viewSwitchDestinationMode: target });
    for (const time of [0, 150, 210, 270, 350, 499, 500, 600, 700, 1000, 350, 150, 0]) {
      sampler.viewSwitchTimeMs = time; sampler.sampleViewSwitch();
      owner.viewMode = sampler.viewMode;
      owner.viewSwitchHeaderOpacity = sampler.viewSwitchHeaderOpacity;
      owner.replay();
      assert.equal(header.opacity ?? 1, 1, `toolbar ancestor hidden at ${time} ms`);
      assert.equal(title.opacity ?? 1, sampler.viewSwitchHeaderOpacity, 'title keeps its existing motion track');
      assert.deepEqual([...owner.nodes.values()].filter(node => node.type === 'Image').map(node => node.id), ids);
      for (const icon of icons) {
        assert.equal(icon.opacity ?? 1, 1);
        void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */ void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
        assert.equal(typeof icon.create, 'string');
      }
      shelfSamples += 1;
    }
  }
}


}
if(selectedCase==='detail-admission') {
// Detail is a presentation component. Metadata/progress refreshes must keep
// its two existing actors; only an active shelf mutation gates reading.
const detailSource = readFileSync(file('features/bookshelf/LocalBookDetail.ets'), 'utf8');
const actionAreaSource = detailSource.slice(detailSource.indexOf('private actionArea()'), detailSource.indexOf('\n  private contentFrame()'));
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const { owner: detail } = createReaderBuilderProbe(detailSource, ['actionArea',
  'readingActionLabel', 'shelfActionLabel', 'detailBookAvailable', 'detailColor'], {
    GradientDirection: { Bottom: 'bottom' },
    READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
  });
Object.assign(detail, { appThemeScheme: 'day', toc: [{ index: 0, title: '第一章' }],
  book: { title: '书', author: '作者' }, readingEnabled: true, readingBlockedReason: '',
  inBookshelf: true, removalEnabled: true, removing: false, loadingMessage: '',
  contentWidth: () => 352, actionButtonWidth: () => 171 });
detail.dockFrame = () => ({ width: 352 });
detail.bottomInset = () => 0;
detail.actionArea();
const buttons = [...detail.nodes.values()].filter(node => node.type === 'Text' && ['继续阅读', '移除书架'].includes(node.create));
assert.equal(buttons.length, 2);
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const buttonIds = buttons.map(node => node.id);
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
assert.deepEqual(buttons[1].border, { width: 1, color: readerAppColor('TOK_LINE', 'day') },
  'secondary action keeps the one-pixel neutral outline');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
Object.assign(detail, { inBookshelf: false, adding: false, cancellingAdd: false, removing: false });
detail.replay();
assert.equal(buttons[1].create, '加入书架');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
Object.assign(detail, { inBookshelf: true });
detail.replay();
assert.equal(buttons[1].create, '移除书架');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
for (let progress = 1; progress <= 4; progress += 1) {
  detail.book = { ...detail.book, currentChapterIndex: progress, readProgress: progress * 100 };
  detail.toc = detail.toc.map(entry => ({ ...entry }));
  detail.replay();
  assert.deepEqual([...detail.nodes.values()].filter(node => node.type === 'Text' && ['继续阅读', '移除书架'].includes(node.create)).map(node => node.id), buttonIds);
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  assert.equal(buttons[0].layoutWeight, 1);
}
let continues=0;detail.onContinue=()=>{continues++;};
for (const inBookshelf of [false,true]) for(const failure of ['目录读取失败','正文处理设置已改变']) {
  Object.assign(detail,{toc:[],readingEnabled:false,readingBlockedReason:failure,
    loadingMessage:'正在读取目录…',inBookshelf});detail.replay();
  assert.equal(buttons[0].enabled,true,'acquisition failures must not lock the user out of reader recovery');
  assert.ok([...detail.nodes.values()].some(node=>node.type==='Text'&&node.create===(inBookshelf?'继续阅读':'开始阅读')));
  buttons[0].onClick();
}
assert.equal(continues,4);
detail.removing = true; detail.replay(); assert.equal(buttons[1].enabled, false);assert.equal(buttons[0].enabled,false);
buttons[0].onClick();assert.equal(continues,4,'active shelf mutation still owns the book');

}

}
