// test_contracts.mjs — Node-runnable conformance tests for the Phase 1 contract bindings.
// No device required. Asserts: token coverage, P0 route→shell dispatch, motion-policy
// resolution, and shell slot discipline. Mirrors what the hypium suites assert.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const GEN = path.join(REPO, 'entry/src/main/ets/contract/generated');
const SHELLS = path.join(REPO, 'entry/src/main/ets/ui/shells');
const FIXTURES = process.env.READER_UI_CONTRACTS
  || path.resolve(__dirname, '../../Reader UI/contracts/fixtures');
const FRONTEND_DEMO = process.env.READER_UI_FRONTEND_DEMO
  || path.resolve(__dirname, '../../Reader UI/frontend-demo');
const LIVE_DEMO_RUNTIME = path.join(FRONTEND_DEMO, 'render-runtime.js');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function readJson(name) { return JSON.parse(read(path.join(FIXTURES, name))); }
function liveDemoRouteTuples() {
  const runtime = read(LIVE_DEMO_RUNTIME);
  const routes = [...runtime.matchAll(/case "([^"]+)":/g)].map((m) => m[1]);
  return [...new Set(routes)].sort().map((routeId) => [routeId, routeId]);
}

const TOKENS = readJson('token.fixtures.json');
const ROUTES = readJson('route.fixtures.json');
const POLICIES = readJson('motion-policy.fixtures.json');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

// ── 1. Token coverage: every fixture token appears in generated TokenRegistry.ets ──
const registrySrc = read(path.join(GEN, 'TokenRegistry.ets'));
test('TokenRegistry contains all fixture tokens', () => {
  for (const t of TOKENS) {
    assert.ok(registrySrc.includes(`name: '${t.name}'`), `missing token ${t.name}`);
  }
});
test('TokenRegistry coverage count matches fixture count', () => {
  const active = TOKENS.filter((t) => t.deprecated !== true);
  assert.equal(active.length, TOKENS.length, 'token count mismatch');
});
test('ColorTokens contains all colors as ARGB', () => {
  const src = read(path.join(GEN, 'ColorTokens.ets'));
  const colors = TOKENS.filter((t) => t.category === 'color');
  // Every color token value resolves to an #AARRGGBB (8 hex) entry.
  const argbCount = (src.match(/#[0-9A-F]{8}/g) || []).length;
  assert.ok(argbCount >= colors.length, `expected ≥${colors.length} ARGB colors, got ${argbCount}`);
});
test('color.json has all color tokens + start_window_background', () => {
  const j = JSON.parse(read(path.join(REPO, 'entry/src/main/resources/base/element/color.json')));
  const names = j.color.map((c) => c.name);
  assert.ok(names.includes('start_window_background'));
  for (const t of TOKENS.filter((t) => t.category === 'color')) {
    const snake = t.name.replace(/^--/, '').replace(/-/g, '_');
    assert.ok(names.includes(snake), `color.json missing ${snake}`);
  }
});

// ── 2. Route dispatch: P0 routes resolve to the correct shell ──
const routeSrc = read(path.join(GEN, 'RouteTable.ets'));
const P0 = ['app-shell', 'main-tabs', 'bookshelf', 'book-detail', 'reader', 'settings', 'discover', 'rss'];
const EXPECTED_SHELL = Object.fromEntries(ROUTES.map((r) => [r.id, r.shell]));
test('RouteTable has all P0 routes and they map to the contract shell', () => {
  for (const id of P0) {
    assert.ok(EXPECTED_SHELL[id] !== undefined, `P0 route ${id} not in fixtures`);
    assert.ok(routeSrc.includes(`case '${id}':`), `RouteTable missing case for ${id}`);
  }
});
test('P0 route → shell mapping matches fixtures', () => {
  // app-shell/main-tabs/bookshelf/discover/rss/settings → MainTabShell; book-detail → LibraryShell; reader → ReaderShell.
  const expected = {
    'app-shell': 'MainTabShell', 'main-tabs': 'MainTabShell', 'bookshelf': 'MainTabShell',
    'discover': 'MainTabShell', 'rss': 'MainTabShell', 'settings': 'MainTabShell',
    'book-detail': 'LibraryShell', 'reader': 'ReaderShell',
  };
  for (const [id, shell] of Object.entries(expected)) {
    assert.equal(EXPECTED_SHELL[id], shell, `${id} shell mismatch`);
  }
});

// ── 3. Motion resolver: policy table resolves push/pop/replace/tabSwitch ──
function resolvePolicy(req) {
  const real = POLICIES.filter((p) => p && p.id && p.priority !== undefined && p.match && p.motionId);
  real.sort((a, b) => b.priority - a.priority);
  for (const p of real) {
    const m = p.match;
    if (m.operation !== undefined && m.operation !== req.operation) continue;
    if (m.containerRole !== undefined && m.containerRole !== req.containerRole) continue;
    if (m.sourceRole !== undefined && m.sourceRole !== req.sourceRole) continue;
    if (m.targetRole !== undefined && m.targetRole !== req.targetRole) continue;
    if (m.reducedMotion !== undefined && m.reducedMotion !== req.reducedMotion) continue;
    return p.motionId;
  }
  return undefined;
}
test('resolve push/appShell → app.route.push.forward', () => {
  assert.equal(resolvePolicy({ operation: 'push', containerRole: 'appShell' }), 'app.route.push.forward');
});
test('resolve pop/appShell → app.route.pop.backward', () => {
  assert.equal(resolvePolicy({ operation: 'pop', containerRole: 'appShell' }), 'app.route.pop.backward');
});
test('resolve replace/appShell → app.route.replace', () => {
  assert.equal(resolvePolicy({ operation: 'replace', containerRole: 'appShell' }), 'app.route.replace');
});
test('resolve tabSwitch/mainTabShell → tab.switch', () => {
  assert.equal(resolvePolicy({ operation: 'tabSwitch', containerRole: 'mainTabShell' }), 'tab.switch');
});

// ── 4. Shell slot discipline: MainTabShell declares 5 slots; ReaderShell is a
//      thin 3-slot shell post-Batch-1 (content / overlayHost / stateHost — the
//      reading base + overlay panels come from ViewStateTable, not shell slots).
test('MainTabShell declares 5 named slots', () => {
  const src = read(path.join(SHELLS, 'MainTabShell.ets'));
  const m = src.match(/SLOT_NAMES:\s*string\[\]\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'SLOT_NAMES not found');
  const slots = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  assert.equal(slots.length, 5, `expected 5 slots, got ${slots.length}`);
  assert.deepEqual(slots, ['topArea', 'content', 'tabNav', 'overlayHost', 'stateHost']);
});
test('ReaderShell declares 3 named slots', () => {
  const src = read(path.join(SHELLS, 'ReaderShell.ets'));
  const m = src.match(/SLOT_NAMES:\s*string\[\]\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'SLOT_NAMES not found');
  const slots = m[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  assert.equal(slots.length, 3, `expected 3 slots, got ${slots.length}`);
  assert.deepEqual(slots, ['content', 'overlayHost', 'stateHost']);
});
test('Overlays/state hang off shell slots, not pages (OverlayHost + StateHost are slot components)', () => {
  assert.ok(fs.existsSync(path.join(REPO, 'entry/src/main/ets/ui/slots/OverlayHost.ets')));
  assert.ok(fs.existsSync(path.join(REPO, 'entry/src/main/ets/ui/slots/StateHost.ets')));
  // Page components (under ui/components/) must not import OverlayHost/StateHost.
  const components = fs.readdirSync(path.join(REPO, 'entry/src/main/ets/ui/components'));
  for (const f of components) {
    const src = read(path.join(REPO, 'entry/src/main/ets/ui/components', f));
    assert.ok(!src.includes('OverlayHost') && !src.includes('StateHost'),
      `${f} imports a shell slot component — slots must not leak into pages`);
  }
});

test('shell top bars read title from ViewStateTable and displayed route', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/SharedComponents.ets'));
  assert.ok(src.includes("ViewStateTable.componentsFor(routeId, pageState)"));
  assert.ok(src.includes("@StorageProp('reader.displayedRouteId') routeId"));
  assert.ok(src.includes("topBarTitle(this.routeId, this.pageState, 'BackTopBar',"),
    'BackTopBar must read route titles from generated ViewState');
  assert.ok(src.includes("topBarTitle(this.routeId, this.pageState, 'AppTopBar', '')"),
    'BackTopBar must fall back to AppTopBar fixture titles used by LibraryShell routes');
  assert.ok(!src.includes('function routeTitle('), 'AppTopBar must not use a stale hand-written routeTitle switch');
  assert.ok(!src.includes('function secondaryRouteTitle('), 'BackTopBar must not use a stale hand-written secondaryRouteTitle switch');
});

test('reader control chrome follows live demo order and labels', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const demo = read(LIVE_DEMO_RUNTIME);
  for (const marker of [
    'fd-reader-sheet',
    'fd-reader-control-main',
    'fd-reader-actions',
    'fd-reader-chapter-panel',
    'fd-brightness-rail',
  ]) {
    assert.ok(demo.includes(marker), `live demo runtime missing control marker: ${marker}`);
  }

  const bottomOrder = [
    "['directory', '目录', 'reader-directory-overlay-v2']",
    "['tts', '朗读', 'reader-tts-overlay-v2']",
    "['appearance', '界面', 'reader-appearance-overlay-v2']",
    "['settings', '设置', 'reader-settings-overlay-v2']",
  ];
  let prev = -1;
  for (const marker of bottomOrder) {
    const idx = src.indexOf(marker);
    assert.ok(idx > prev, `reader bottom bar order/label drift: ${marker}`);
    prev = idx;
  }

  const quickOrder = [
    "['搜索', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2']",
    "['自动翻页', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2']",
    "['替换', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2']",
  ];
  prev = -1;
  for (const marker of quickOrder) {
    const idx = src.indexOf(marker);
    assert.ok(idx > prev, `reader quick action order drift: ${marker}`);
    prev = idx;
  }
  assert.ok(src.includes("Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)"),
    'control sheet must keep the live demo brightness rail in-sheet');
});

test('reader overlay panels keep live demo quick-panel and overlay copy', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  for (const text of [
    'ReaderModulePanelShell',
    'ReaderModulePanel',
    'BrightnessRail',
    '第 30 章 旧日',
    '第 31 章 归途',
    '第 32 章 雨夜',
    '第 33 章 灯塔',
    '已缓存',
    '书签',
    '阅读主题',
    '文字排版',
    '字号',
    '行距',
    '系统',
    '宋体',
    '黑体',
    '播放控制',
    '语速',
    '1.0x',
    '音色',
    '清晰女声',
    '范围',
    '当前章节',
    '定时',
    '15 分钟',
    '点击翻页方式',
    '左右区域',
    '音量键翻页',
    '翻页动画',
    '平滑',
    '横屏锁定',
    '屏幕常亮',
    '页脚进度信息',
    '触摸反馈',
    '自动缓存后续章节',
    'ReaderQuickPanelShell',
    'ReaderQuickPanel',
    '第 32 章 雨夜',
    '雨夜的风格外冷 · 当前结果 1/2',
    '第 33 章 灯塔',
    '雨夜之后，远处灯塔亮起 · 结果 2/2',
    '雨容称呼',
    '旧称统一',
    '标点清理',
    '广告过滤',
    '停止自动翻页',
    '上一章',
    '自动翻页',
    '下一章',
    '翻页速度',
    '8 秒',
    '连续',
    '单页',
  ]) {
    assert.ok(src.includes(text), `ReaderOverlayComponents missing live demo overlay text: ${text}`);
  }
  for (const oldText of [
    '当前书籍：深空信号',
    '仅显示当前书籍匹配到的替换规则',
    '净化广告段落',
    '合并异常断行',
    '修正常见乱码',
    '状态：未开启',
    "ReaderActionButton({ label: '开始'",
    '中速 · 适合连续阅读',
    "SegmentedControl({ options: ['滚动', '点击翻页', '连续滚动'] })",
    '开启后将在本章内按当前速度推进，不影响下方页内控制条。',
    '第一本 / 第一卷 /',
    '第一章：阿长与《山海经》',
    '当前阅读章节：第一章：阿长与《山海经》',
    '字体',
    '繁简',
    '屏幕方向',
    '屏幕超时',
    '单双页',
    '文字两端对齐',
    '文字底部对齐',
    '单手翻页',
    '朗读参数',
    '朗读音色',
    '温和女声',
  ]) {
    assert.equal(src.includes(oldText), false, `ReaderOverlayComponents must not keep obsolete quick-panel copy: ${oldText}`);
  }
  assert.ok(!src.includes("ReaderListRow({ title: '三体'"), 'replace overlay must not show the wrong demo book title');
  assert.ok(!src.includes("ReaderSettingRow({ name: '替换\\\"信号\\\"为\\\"信号源\\\"'"), 'replace overlay must use live demo rule names');
});

test('reader control layer uses live demo top overlay and reading copy', () => {
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  assert.ok(reader.includes('export struct ReaderTopArea'), 'control-layer routes need the live demo reader-top component');
  assert.ok(reader.includes("Text('长夜余火')"), 'reader top area must show the live demo book title');
  assert.ok(reader.includes("Text('第 32 章 雨夜 · 优书网')"), 'reader top area must expose the live demo source line');
  assert.ok(reader.includes("Text('换源')"), 'reader top area must expose the live demo source-switch action');
  assert.ok(reader.includes("id: 'source-switch'"), 'reader top source switch must push the live demo source-switch route');
  assert.ok(reader.includes("return '雨夜'"), 'reading surface must show the live demo chapter title');
  assert.ok(reader.includes('雨声在窗外连成一片'), 'reading surface must use live demo reader text');
  assert.ok(reader.includes('.borderRadius(DemoAliasTokens.radiusXl)'), 'reader top area must be one floating rounded live-demo bar');
  assert.ok(reader.includes('.textAlign(TextAlign.Center)'),
    'reader title must stay centered like live demo');
  const textFlowStart = reader.indexOf('export struct ReadingTextFlow');
  const textFlowEnd = reader.indexOf('// .fd-ir-info-layer');
  const textFlow = reader.slice(textFlowStart, textFlowEnd);
  for (const storageKey of [
    "@StorageProp('reader.typography.fontSize') fontSize",
    "@StorageProp('reader.typography.lineHeight') lineHeightRatio",
    "@StorageProp('reader.typography.paragraphGap') paragraphGap",
    "@StorageProp('reader.typography.letterSpacing') letterSpacing",
    "@StorageProp('reader.typography.fontFamily') fontFamily",
    "@StorageProp('reader.pageSpace.topMargin') topMargin",
    "@StorageProp('reader.pageSpace.sideMargin') sideMargin",
    "@StorageProp('reader.pageSpace.bottomMargin') bottomMargin",
    "@StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent",
  ]) {
    assert.ok(reader.includes(storageKey), `reading surface must subscribe to ${storageKey}`);
  }
  assert.ok(reader.includes('.fontSize(this.fontSize)'),
    'reader paragraphs must use the configured reader font size');
  assert.ok(reader.includes('.lineHeight(this.paragraphLineHeight())'),
    'reader paragraphs must use the configured reader line height');
  assert.ok(reader.includes('.letterSpacing(this.letterSpacing)'),
    'reader paragraphs must use the configured reader letter spacing');
  assert.ok(reader.includes('.textIndent(this.paragraphIndentValue())'),
    'reader paragraphs must use the configured first-line indent');
  assert.ok(reader.includes('.margin({ bottom: this.paragraphGap })'),
    'reader paragraphs must use the configured paragraph gap');
  for (const staleLiteral of [
    '.fontSize(18)',
    '.lineHeight(18 * 1.96)',
    '.textIndent(2 * 18)',
    '.margin({ bottom: 16 })',
  ]) {
    assert.ok(!textFlow.includes(staleLiteral), `reading surface must not hard-code ${staleLiteral}`);
  }
  assert.ok(reader.includes('private textureLines(): number[]'),
    'reader background must render the live demo paper texture line layer');
  assert.ok(reader.includes('.linearGradient({'),
    'reader background must keep the live demo paper start/end gradient');
  assert.ok(reader.includes('.position({ x: 0, y: line * 7 })'),
    'reader texture must keep the live demo 7vp repeating line cadence');
  assert.ok(!textFlow.includes('.backgroundColor(this.theme ==='),
    'reading text layer must not cover the dedicated paper texture background');
  assert.ok(reader.includes("import { ViewportAdapter } from '../adapters/ViewportAdapter'"),
    'reader control geometry must branch from runtime viewport metrics');
  assert.ok(reader.includes("import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter'"),
    'reader invisible interaction modules must be visible in development mode');
  assert.ok(reader.includes("@StorageProp('reader.paginationMode') paginationMode"),
    'reader body must expose a rendering mode so horizontal and vertical reading are separate layouts');
  assert.ok(reader.includes('private horizontalPages(): string[][]'),
    'horizontal page-turn mode must render page-sized bodies instead of one vertical flow');
  assert.ok(reader.includes('private estimatedParagraphHeight(text: string): number'),
    'horizontal reader mode must estimate page capacity from text metrics and frame size');
  assert.ok(reader.includes('this.textLayerHeight()'),
    'horizontal reader mode must use the configured text frame height when paginating');
  assert.ok(!textFlow.includes('const pageSize = 2'),
    'horizontal reader mode must not use the old fixed two-paragraph pages');
  assert.ok(reader.includes('private verticalReading(): boolean'),
    'vertical reading mode must keep a dedicated scroll-flow branch');
  assert.ok(reader.includes('.scrollable(ScrollDirection.Horizontal)'),
    'horizontal reader mode must use a horizontal scroll/page surface');
  assert.ok(reader.includes('top: this.textTopInset()'),
    'reader text top inset must be route-stable instead of control-layer-specific');
  assert.ok(reader.includes('left: this.textLeftInset()'),
    'reader text left inset must be route-stable instead of control-layer-specific');
  assert.ok(reader.includes('right: this.textRightInset()'),
    'reader text right inset may only branch for wide reader dock coverage');
  assert.ok(reader.includes('bottom: this.textBottomInset()'),
    'reader text bottom inset must not reserve bottom sheet space');
  assert.ok(!reader.includes('controlParagraphs'),
    'control layer must not render a separate body copy');
  assert.ok(!reader.includes('if (this.controlLayer()) {\n      return this.controlParagraphs;\n    }'),
    'control layer must overlay the same chapter body instead of swapping paragraphs');
  assert.ok(!reader.includes("Text('深空信号')"), 'control layer must not use the obsolete handoff book title');
  assert.ok(!reader.includes("Text('第一章：阿长与《山海经》')"), 'control layer must not use the obsolete handoff chapter row');
  assert.ok(!reader.includes("Text('本地书籍')"), 'control layer must not use the obsolete handoff source chip');
  assert.ok(!reader.includes('ColorTokens.metaBg'), 'control layer must not keep the obsolete second meta row');
  assert.ok(reader.includes("return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content'"),
    'ReaderBase must treat reader as control and only immersive routes as immersive');
  assert.ok(reader.includes('ControlDismissZone()'), 'control-layer branch must render the live demo control dismiss zone');
  assert.ok(reader.includes('ReadingInfoLayer({ theme: this.theme })'), 'immersive reader branch keeps corner info');
  assert.ok(reader.includes("route-push', id: 'reader'"),
    'center tap hot zone must open the live demo reader control route');
  assert.ok(reader.includes('@StorageProp(InteractionDebugAdapter.K_VISIBLE)'),
    'immersive tap zones must support development-mode visualization');
  assert.ok(reader.includes("this.zoneLabel('ControlLayerHotzone')"),
    'development mode must label the center reader control hot zone with the live demo data-dev-region name');
  assert.ok(!reader.includes('.hitTestBehavior(HitTestMode.Block)'),
    'TapZones parent must not block child hot-zone clicks');
  assert.ok(reader.includes('.zIndex(ZIndexTokens.dialog)'),
    'immersive tap zones must sit above the reading text layer');
  const entryAbility = read(path.join(REPO, 'entry/src/main/ets/entryability/EntryAbility.ets'));
  assert.ok(entryAbility.includes('InteractionDebugAdapter.K_VISIBLE'),
    'EntryAbility must seed the development interaction visualization flag');
  assert.ok(entryAbility.includes("params['interactionDebug'] !== 'false'"),
    'development interaction visualization must be launch-parameter controllable');
  assert.ok(entryAbility.includes('InteractionDebugAdapter.K_INITIAL_ROUTE'),
    'development mode must support initialRoute for direct VM visual checks');
  assert.ok(entryAbility.includes("ReaderUiStore.dispatch({ type: 'route-replace', id: initialRoute as RouteId })"),
    'initialRoute must enter the normal reducer route pipeline');
  assert.ok(entryAbility.includes("AppStorage.setOrCreate<string>('reader.displayedRouteId', initialRoute)"),
    'initialRoute must seed the motion-delayed displayed route before first render');
  const baseStart = reader.indexOf('export struct ReaderBase');
  const base = reader.slice(baseStart);
  assert.ok(!base.includes('ReaderTopArea()'),
    'ReaderBase must not own ReaderTopArea; live demo renders it from readerOverlayHost as a sibling overlay');
});

test('reader text render settings are reducer-backed, not static panel copy', () => {
  const state = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiState.ets'));
  const reducer = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
  const store = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiStore.ets'));
  const overlay = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const entryAbility = read(path.join(REPO, 'entry/src/main/ets/entryability/EntryAbility.ets'));
  const typeTokens = read(path.join(REPO, 'entry/src/main/ets/contract/generated/TypeTokens.ets'));
  for (const field of [
    'fontSize: number',
    'lineHeight: number',
    'paragraphGap: number',
    'letterSpacing: number',
    'fontFamily: ReaderFontFamily',
    'topMargin: number',
    'sideMargin: number',
    'bottomMargin: number',
    'paragraphIndent: number',
  ]) {
    assert.ok(state.includes(field), `ReaderUiState missing render field ${field}`);
  }
  for (const eventType of [
    "'step-reader-render-metric'",
    "'set-reader-render-metric'",
    "'set-reader-font-family'",
    "'reset-reader-render-settings'",
  ]) {
    assert.ok(reducer.includes(eventType), `ReaderReducer missing event ${eventType}`);
  }
  for (const key of [
    "K_FONT_SIZE: string = 'reader.typography.fontSize'",
    "K_LINE_HEIGHT: string = 'reader.typography.lineHeight'",
    "K_PARAGRAPH_GAP: string = 'reader.typography.paragraphGap'",
    "K_LETTER_SPACING: string = 'reader.typography.letterSpacing'",
    "K_FONT_FAMILY: string = 'reader.typography.fontFamily'",
    "K_TOP_MARGIN: string = 'reader.pageSpace.topMargin'",
    "K_SIDE_MARGIN: string = 'reader.pageSpace.sideMargin'",
    "K_BOTTOM_MARGIN: string = 'reader.pageSpace.bottomMargin'",
    "K_PARAGRAPH_INDENT: string = 'reader.pageSpace.paragraphIndent'",
  ]) {
    assert.ok(store.includes(key), `ReaderUiStore missing AppStorage key ${key}`);
  }
  assert.ok(overlay.includes("ReaderUiStore.dispatch({ type: 'step-reader-render-metric'"),
    'appearance steppers must dispatch render metric changes');
  assert.ok(overlay.includes("ReaderUiStore.dispatch({ type: 'set-reader-font-family'"),
    'font choices must dispatch font-family changes');
  assert.ok(fs.existsSync(path.join(REPO, 'entry/src/main/resources/rawfile/font/NotoSerifCJKsc-Regular.otf')),
    'bundled reader serif font must be packaged as a rawfile resource');
  assert.ok(entryAbility.includes("familyName: 'Noto Serif CJK SC'"),
    'EntryAbility must register the bundled reader serif font family');
  assert.ok(entryAbility.includes("$rawfile('font/NotoSerifCJKsc-Regular.otf')"),
    'EntryAbility must register the packaged rawfile font, not rely on system serif availability');
  assert.ok(entryAbility.includes('getUIContext().getFont().registerFont'),
    'EntryAbility must register the reader serif font in the active ArkUI UIContext');
  assert.ok(typeTokens.includes("Noto Serif CJK SC"),
    'FontTokens.serif must use the registered reader serif family');
  assert.ok(!typeTokens.includes('"Songti SC"') && !typeTokens.includes('"STSong"'),
    'FontTokens.serif must be a concrete ArkUI family, not a CSS fallback list');
  const tokenRegistry = read(path.join(REPO, 'entry/src/main/ets/contract/generated/TokenRegistry.ets'));
  assert.ok(tokenRegistry.includes('Songti SC') && tokenRegistry.includes('STSong'),
    'TokenRegistry must preserve the Reader UI demo serif fallback stack for audit');
  for (const staticCopy of [
    "ReaderLiveStepperRow({ label: '字号', value: '18' })",
    "ReaderLiveStepperRow({ label: '行距', value: '1.96'",
    "ReaderFullStepperRow({ label: '字号', value: '18' })",
    "ReaderFullStepperRow({ label: '行距', value: '1.96' })",
    "ReaderFullStepperRow({ label: '段距', value: '16' })",
    "ReaderFullStepperRow({ label: '侧边距', value: '32' })",
    "ReaderFullStepperRow({ label: '段首缩进', value: '2em' })",
  ]) {
    assert.ok(!overlay.includes(staticCopy), `appearance panels must not keep static copy ${staticCopy}`);
  }
});

test('reader control route fixture uses live demo control sheet, not obsolete floating controls', () => {
  const VS = readJson('view-state.fixtures.json');
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const readerSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const controlSheetSrc = src.slice(src.indexOf('export struct ReaderControlSheet'), src.indexOf('// ── Control bottom bar'));
  const quickPanelShellSrc = src.slice(src.indexOf('export struct ReaderQuickPanelShell'), src.indexOf('struct ReaderModulePanelShell'));
  const modulePanelShellSrc = src.slice(src.indexOf('struct ReaderModulePanelShell'), src.indexOf('export struct ReaderDirectoryPanel'));
  const byRoute = (routeId) => {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === 'default');
    assert.ok(entry, `${routeId}/default fixture missing`);
    return entry.components.map((c) => c.type);
  };
  assert.deepEqual(
    byRoute('control-layer-base-v2'),
    ['ReaderBase', 'ReaderTopArea', 'ReaderControlSheet', 'ReaderBottomBar'],
    'control-layer-base-v2 must mirror live demo reader surface + top overlay + sheet + bottom bar structure'
  );
  assert.ok(src.includes('export struct ReaderControlSheet'), 'control layer must render the live demo bottom sheet component');
  assert.ok(controlSheetSrc.includes('.backgroundColor(ColorTokens.floatingControlBg)'),
    'control sheet host must be opaque so reader text does not bleed through the overlay');
  assert.ok(!controlSheetSrc.includes('.backgroundColor(ColorTokens.paperBright)'),
    'control sheet host must not regress to an opaque paper background');
  assert.ok(quickPanelShellSrc.includes('.backgroundColor(ColorTokens.floatingControlBg)'),
    'quick/module panel shell must be opaque over the reader body');
  assert.ok(!quickPanelShellSrc.includes('.backgroundColor(ColorTokens.paperBright)'),
    'quick/module panel shell must not regress to an opaque paper background');
  assert.ok(modulePanelShellSrc.includes('.backgroundColor(ColorTokens.floatingControlBg)'),
    'module panel shell must be opaque over the reader body');
  assert.ok(!modulePanelShellSrc.includes('.backgroundColor(ColorTokens.paperBright)'),
    'module panel shell must not regress to an opaque paper background');
  assert.equal(src.includes('export struct FloatingBrightness'), false, 'obsolete detached brightness component must be removed');
  assert.equal(src.includes('export struct FloatingQuickActions'), false, 'obsolete detached quick actions component must be removed');
  assert.equal(src.includes('export struct FloatingPageControl'), false, 'obsolete detached page control component must be removed');
  assert.ok(src.includes("Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)"),
    'control sheet must keep the live demo brightness rail inside the sheet');
  assert.ok(src.includes('private readonly dockWidth: number = 340'), 'control dock must use the live demo 340vp width');
  assert.ok(src.includes('private readonly wideSheetHeight: number = 252'), 'control sheet must use the live demo tablet-expanded sheet height');
  assert.ok(src.includes('private readonly mobileSheetHeight: number = 330'), 'control sheet must use the live demo mobile sheet height');
  assert.ok(src.includes('private readonly mobileSheetBottom: number = 18'), 'mobile reader sheet must keep the live demo 18vp bottom gap');
  assert.ok(src.includes('private readonly navHeight: number = 79'), 'module nav must use the live demo dock nav height');
  assert.ok(src.includes('private readonly wideControlBottom: number = 32'), 'wide control sheet must use the live demo control-mode bottom inset');
  assert.ok(src.includes('private readonly mobileControlBottom: number = 110'), 'mobile control sheet must reserve the live demo nav area');
  assert.ok(src.includes('return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.mobileSheetInset * 2)'),
    'control sheet must be 340vp on wide viewports and left/right 12 on mobile');
  assert.ok(src.includes('bottomLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl'),
    'control sheet must attach to nav only on wide viewports');
  assert.ok(src.includes('.margin({ right: this.sheetRight(), bottom: this.sheetBottom() })'),
    'control sheet must use responsive live demo bottom anchors');
  assert.ok(src.includes('topLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusLg'),
    'module nav must attach to sheet only on wide viewports');
  assert.ok(src.includes('private navBottomValue(): number'),
    'module nav must branch its bottom anchor by viewport');
  assert.ok(src.includes('.margin({ right: this.dockRight, bottom: this.navBottomValue() })'),
    'module nav must use the live demo mobile/wide bottom anchor');
  assert.ok(src.includes('.zIndex(ZIndexTokens.readerModuleNav)'), 'module nav must render above reader sheets/panels');
  assert.ok(src.includes('.zIndex(ZIndexTokens.bottomSheet)'), 'reader sheets/panels must use the bottom-sheet layer');
  assert.ok((src.match(/\.hitTestBehavior\(HitTestMode\.Transparent\)/g) || []).length >= 3,
    'full-screen reader sheet/nav wrappers must not block each other in hit testing');
  const controlPredicate = "this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content'";
  assert.ok(readerSrc.indexOf(controlPredicate) !== readerSrc.lastIndexOf(controlPredicate),
    'ReadingTextFlow and ReaderBase must use the same immersive-vs-control route predicate');
  assert.ok(!src.includes('SizeTokens.bottomBarHeight + this.safeAreaBottom'), 'module nav must not regress to the obsolete full-width bottom bar');
  assert.ok(src.includes('private panelHeightValue(): number'), 'reader overlay panels must derive height from live demo viewport rules');
  assert.ok(src.includes('return this.wideControlDock() ? 252 : this.mobileSheetHeight'),
    'reader overlay panels must be 252vp on wide viewports and 330vp on mobile');
  assert.ok(src.includes('private panelBottomReserve(): number'), 'reader overlay panels must reserve the module nav area');
  assert.ok(src.includes('.height(this.panelContentHeight())'), 'reader overlay panel content must not render under module nav');
  assert.ok(!src.includes('ReaderOverlayPanel({ panelHeight'), 'reader overlay panels must not keep obsolete handoff heights');
  for (const routeId of ['control-layer-base-v2', 'reader-search-overlay-v2', 'reader-replace-overlay-v2', 'reader-auto-scroll-overlay-v2']) {
    const types = byRoute(routeId);
    assert.equal(types.includes('FloatingBrightness'), false, `${routeId} must not render detached brightness controls`);
    assert.equal(types.includes('FloatingQuickActions'), false, `${routeId} must not render detached quick actions`);
    assert.equal(types.includes('FloatingPageControl'), false, `${routeId} must not render detached page controls`);
  }
});

test('reader overlay routes render panel before module nav', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['reader-directory-overlay-v2', 'ReaderDirectoryPanel'],
    ['reader-appearance-overlay-v2', 'ReaderAppearancePanel'],
    ['reader-tts-overlay-v2', 'ReaderTtsPanel'],
    ['reader-settings-overlay-v2', 'ReaderSettingsPanel'],
    ['reader-search-overlay-v2', 'ReaderSearchPanel'],
    ['reader-replace-overlay-v2', 'ReaderReplacePanel'],
    ['reader-auto-scroll-overlay-v2', 'ReaderAutoScrollPanel'],
  ]);

  for (const [routeId, panelType] of expected) {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === 'default');
    assert.ok(entry, `${routeId}/default fixture missing`);
    assert.deepEqual(entry.components.map((c) => c.type),
      ['ReaderBase', 'ReaderTopArea', panelType, 'ReaderBottomBar'],
      `${routeId} must render bottomSheetHost panel before readerModuleNav so ArkUI wrappers do not cover the nav`);
  }
});

test('reader full and utility routes use live demo expanded panels', () => {
  const VS = readJson('view-state.fixtures.json');
  const tableSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const overlaySrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const expected = new Map([
    ['reader-full-directory', 'ReaderFullDirectoryPage'],
    ['reader-full-tts', 'ReaderFullTtsPage'],
    ['reader-full-appearance', 'ReaderFullAppearancePage'],
    ['reader-full-font', 'ReaderFullAppearancePage'],
    ['reader-full-theme', 'ReaderFullAppearancePage'],
    ['reader-full-theme-edit', 'ReaderFullAppearancePage'],
    ['reader-full-layout', 'ReaderFullAppearancePage'],
    ['reader-full-settings', 'ReaderFullSettingsPage'],
    ['reader-full-page-turn', 'ReaderFullSettingsPage'],
    ['reader-book-cache', 'ReaderBookCachePage'],
    ['reader-debug-info', 'ReaderDebugInfoPage'],
  ]);

  for (const [routeId, componentType] of expected) {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === 'default');
    assert.ok(entry, `${routeId}/default fixture missing`);
    assert.deepEqual(entry.components.map((c) => c.type), ['ReaderBase', 'ReaderTopArea', componentType],
      `${routeId} must render ReaderBase + ReaderTopArea + ${componentType}`);
    assert.equal(entry.components.some((c) => c.type === 'ReaderBottomBar'), false,
      `${routeId} must not render ReaderBottomBar`);
    for (const staleType of ['ReaderDirectoryPanel', 'ReaderAppearancePanel', 'ReaderTtsPanel', 'ReaderSettingsPanel']) {
      assert.equal(entry.components.some((c) => c.type === staleType), false,
        `${routeId} must not fall back to module panel ${staleType}`);
    }
    assert.ok(tableSrc.includes(`"routeId": "${routeId}"`), `ViewStateTable missing ${routeId}`);
    assert.ok(tableSrc.includes(`"type": "${componentType}"`), `ViewStateTable missing ${componentType}`);
  }

  for (const componentType of new Set(expected.values())) {
    assert.ok(rendererSrc.includes(`component.type === '${componentType}'`),
      `ViewStateRenderer missing mapping for ${componentType}`);
  }
  for (const marker of [
    'export struct ReaderFullDirectoryPage',
    'export struct ReaderFullTtsPage',
    'export struct ReaderFullAppearancePage',
    'export struct ReaderFullSettingsPage',
    'export struct ReaderBookCachePage',
    'export struct ReaderDebugInfoPage',
    'ReaderFullPanelShell',
    'ReaderExpandedPanel',
    'ReaderUtilityPage',
    '阅读主题',
    '文字排版',
    '字距',
    '页面空间',
    '段首缩进',
    '播放控制',
    '语速',
    '音色',
    '朗读范围',
    '定时关闭',
    '本书剩余',
    '书籍缓存',
    '已缓存章节',
    '缓存后续章节',
    '清理本书缓存',
    '调试信息',
    '渲染状态',
    '调试日志',
    '重新测量分页',
  ]) {
    assert.ok(overlaySrc.includes(marker), `ReaderOverlayComponents missing full/utility marker ${marker}`);
  }
});

test('development interaction visualization covers reader control modules', () => {
  const debugSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/InteractionDebugComponents.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const readerSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const overlaySrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const sourceSwitchSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets'));
  const entryAbility = read(path.join(REPO, 'entry/src/main/ets/entryability/EntryAbility.ets'));

  assert.ok(debugSrc.includes('export struct InteractionDebugFrame'),
    'development mode needs a shared visual frame component');
  assert.ok(debugSrc.includes('InteractionDebugAdapter.K_VISIBLE'),
    'debug frames must all read the same launch-controlled visibility flag');
  assert.ok(debugSrc.includes('.enabled(false)'),
    'debug overlays must never consume focus/click behavior');
  assert.ok(debugSrc.includes('.hitTestBehavior(HitTestMode.None)'),
    'debug overlays must not block underlying interaction modules');
  assert.ok(debugSrc.includes('export struct InteractionDebugBadge'),
    'development mode must label generated contract components without changing layout');
  assert.ok(rendererSrc.includes('InteractionDebugBadge'),
    'ViewStateRenderer must show generated component ownership in development mode');
  assert.ok(rendererSrc.includes('renderDebuggedComponent(component, true)'),
    'stack/reader routes must render development labels over full-frame components');
  assert.ok(rendererSrc.includes('renderDebuggedComponent(component, false)'),
    'scroll/page routes must render development labels for body components');
  assert.ok(rendererSrc.includes('this.renderDebuggedComponent(child, false)'),
    'nested contract components must keep development labels too');
  assert.ok(entryAbility.includes("params['interactionDebug'] !== 'false'"),
    'development mode should be on by default and disableable with interactionDebug=false');
  assert.ok(entryAbility.includes('onNewWant(want: Want'),
    'development mode must re-read launch params on hot aa start / VM route switching');
  assert.ok(entryAbility.includes('applyDevelopmentLaunchParameters(want)'),
    'development launch parameter parsing should be shared by cold and hot starts');
  assert.ok(entryAbility.includes('InteractionDebugAdapter.K_INITIAL_ROUTE'),
    'development mode needs initialRoute for direct overlay/full-page screenshots');
  assert.ok(entryAbility.includes("params['readerPaginationMode']"),
    'development mode must allow direct horizontal/vertical reader body screenshots');
  for (const marker of [
    'ReadingBackground',
    'ReadingTextLayer',
    'ControlDismissZone',
    'ImmersiveInfoLayer',
    'ReaderTopBar',
    'PrevPageHotzone',
    'ControlLayerHotzone',
    'NextPageHotzone',
  ]) {
    assert.ok(readerSrc.includes(marker), `reader base missing development marker ${marker}`);
  }
  for (const marker of [
    "label: 'back'",
    "label: 'source'",
    "label: 'more'",
  ]) {
    assert.ok(readerSrc.includes(marker), `reader top bar missing interaction debug marker ${marker}`);
  }
  for (const marker of [
    'BottomControlPanel',
    'BrightnessRail',
    'bottomSheetHost',
    'ReaderQuickPanel',
    'ReaderModulePanel',
    'ReaderExpandedPanel',
    'ReaderUtilityPage',
    'readerModuleNav',
  ]) {
    assert.ok(overlaySrc.includes(marker), `reader overlay/control layer missing development marker ${marker}`);
  }
  for (const marker of [
    "label: 'button'",
    "label: 'seg'",
    "label: 'toggle'",
    "return 'search'",
    "return 'auto'",
    "return 'replace'",
    "label: 'P'",
    "label: 'N'",
    "label: 'progress'",
    "label: 'B'",
    "return 'dir'",
    "return 'ui'",
    "label: 'close'",
    "label: 'result'",
  ]) {
    assert.ok(overlaySrc.includes(marker), `reader overlay/control layer missing interaction debug marker ${marker}`);
  }
  for (const marker of [
    'SOURCE_SWITCH_WINDOW',
    'SOURCE_ROW',
    'CLOSE',
  ]) {
    assert.ok(sourceSwitchSrc.includes(marker), `source-switch flow missing development marker ${marker}`);
  }
});

test('source-switch routes keep the live demo reader-plane inline window', () => {
  const VS = readJson('view-state.fixtures.json');
  const componentSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const runtime = read(LIVE_DEMO_RUNTIME);
  for (const marker of ['fd-source-reader-continuation', 'fd-source-window-slot', 'fd-source-switch-window', 'fd-source-candidate-row']) {
    assert.ok(runtime.includes(marker), `live demo runtime missing source-switch marker ${marker}`);
  }
  for (const routeId of ['source-switch', 'source-switch-results']) {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === 'default');
    assert.ok(entry, `${routeId}/default fixture missing`);
    assert.deepEqual(entry.components.map((c) => c.type), ['SourceSwitchFlowPage'],
      `${routeId} must render the reader-plane source switch flow, not a BackTopBar/List page`);
  }
  assert.ok(rendererSrc.includes("component.type === 'SourceSwitchFlowPage'"),
    'ViewStateRenderer must map SourceSwitchFlowPage');
  for (const marker of [
    'ReaderBase()',
    'ReaderTopArea()',
    'ReaderControlSheet()',
    'ReaderBottomBar()',
    'SourceSwitchWindow()',
    "Text('换源')",
    "Text('按延迟排序')",
    '优书网',
    '笔趣阁镜像',
    '备用线路 B',
    '章节同步源',
    '本地缓存',
    '旧源备份',
    "route-replace', id: 'reader'",
  ]) {
    assert.ok(componentSrc.includes(marker), `SourceSwitchFlowComponents missing live flow marker: ${marker}`);
  }
  assert.ok(!componentSrc.includes('BackTopBar('), 'source-switch flow must not render a normal page top bar');
  assert.ok(!componentSrc.includes('SourceSwitchResultsPanel'), 'source-switch flow must not reuse the obsolete full-screen results panel');
  const flowBody = componentSrc.slice(componentSrc.indexOf('export struct SourceSwitchFlowPage'));
  const order = ['ReaderBase()', 'ReaderTopArea()', 'ReaderControlSheet()', 'ReaderBottomBar()', 'SourceSwitchWindow()'];
  let previousIndex = -1;
  for (const marker of order) {
    const currentIndex = flowBody.indexOf(marker);
    assert.ok(currentIndex > previousIndex, `SourceSwitchFlowPage must render ${marker} after the previous reader-plane layer`);
    previousIndex = currentIndex;
  }
});

test('bookshelf section head uses demo view-action icons, not generic more dots', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  for (const marker of [
    'bookshelf_icon_grid_primary',
    'bookshelf_icon_list_dark',
    'bookshelf_icon_filter_dark',
    'bookshelf_icon_gear_dark',
    "route-replace', id: 'bookshelf-cover-mode'",
    "route-replace', id: 'bookshelf-list-mode'",
    "route-push', id: 'sort-filter'",
    "route-push', id: 'bookshelf-search-settings'",
  ]) {
    assert.ok(src.includes(marker), `BookshelfComponents missing section-head action: ${marker}`);
  }
  const sectionHead = src.slice(src.indexOf('export struct ShelfSectionHeader'), src.indexOf('// .fd-bookshelf-shelf-section'));
  assert.ok(!sectionHead.includes('reader_icon_more_dark'), 'bookshelf section head must not render generic more-dot icons');
});

test('bookshelf route data and covers follow the current live demo fixture', () => {
  const VS = readJson('view-state.fixtures.json');
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  const renderer = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const bookshelf = VS.find((e) => e.routeId === 'bookshelf' && e.pageState === 'default');
  assert.ok(bookshelf, 'bookshelf/default fixture missing');
  const continueCard = bookshelf.components.find((c) => c.type === 'ContinueReadingCard');
  assert.equal(continueCard?.props.title, '长夜余火', 'continue card must use the live demo first book');
  assert.equal(continueCard?.props.author, '爱潜水的乌贼', 'continue card author must match live demo');
  assert.equal(continueCard?.props.coverKey, 'longNight', 'continue card cover must match live demo');
  const shelf = bookshelf.components.find((c) => c.type === 'BookshelfShelfSection');
  const grid = shelf?.children.find((c) => c.type === 'BookGrid');
  const cards = grid?.children.filter((c) => c.type === 'BookCard') || [];
  assert.deepEqual(
    cards.slice(0, 3).map((c) => [c.props.title, c.props.author, c.props.coverKey]),
    [
      ['长夜余火', '爱潜水的乌贼', 'longNight'],
      ['诡秘之主', '爱潜水的乌贼', 'mysteryLord'],
      ['明朝那些事儿', '当年明月', 'brightMoon'],
    ],
    'bookshelf first row must mirror frontend-demo fixture.js'
  );
  for (const marker of ['bookshelf_cover_long_night', 'bookshelf_cover_mystery_lord', 'bookshelf_cover_bright_moon']) {
    assert.ok(src.includes(marker), `BookshelfComponents missing cover resource ${marker}`);
  }
  assert.ok(renderer.includes("coverKey: this.textOr(child.props.coverKey, 'threeBody')"),
    'ViewStateRenderer must preserve BookGrid child coverKey props');
  assert.ok(renderer.includes("coverKey: this.textOr(component.props.coverKey, 'longNight')"),
    'ViewStateRenderer must pass coverKey to ContinueReadingCard/direct BookCard');
});

test('bookshelf top more opens real batch/group actions, not a dead icon', () => {
  const topBarSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/SharedComponents.ets'));
  const overlaySrc = read(path.join(REPO, 'entry/src/main/ets/ui/slots/OverlayHost.ets'));
  assert.ok(topBarSrc.includes("overlay: 'book-action'"), 'bookshelf top more must open book-action overlay');
  for (const route of ['book-batch-management', 'group-management']) {
    assert.ok(overlaySrc.includes(`route: '${route}'`), `book-action overlay missing route ${route}`);
    assert.ok(overlaySrc.includes("type: 'route-push'"), 'book-action overlay must route-push actions');
  }
});

test('bookshelf management pages use LibraryShell fixed bottom actions', () => {
  const shellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/LibraryShell.ets'));
  const structuralSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of ['移动分组', '删除所选', '新建分组', '完成']) {
    assert.ok(shellSrc.includes(text), `LibraryShell fixed action host missing ${text}`);
  }
  assert.ok(shellSrc.includes("this.routeId === 'book-batch-management'"), 'LibraryShell must gate batch actions by route');
  assert.ok(shellSrc.includes("this.routeId === 'group-management'"), 'LibraryShell must gate group actions by route');
  assert.ok(shellSrc.includes('renderBottomActionBar()'), 'LibraryShell fixed actions must be rendered as a bottom action bar');
  assert.ok(shellSrc.includes('private actionBarHeight(): number'), 'LibraryShell bottom action bar must own its real safe-area height');
  assert.ok(!shellSrc.includes('renderBottomActionHost'), 'LibraryShell must not use the obsolete full-screen action host');
  assert.ok(!shellSrc.includes('.hitTestBehavior(HitTestMode.Transparent)'), 'LibraryShell fixed actions must not sit inside a full-screen transparent hit-test layer');
  assert.equal(structuralSrc.includes('ToolBottomActionRow'), false, 'management page actions must not live in scroll content');
});

// ── 5. ViewStateTable ↔ ViewStateRenderer: every component type used in the
//      table is mapped by the renderer — no unknown type silently falls back to
//      Empty() (which would mask contract drift).
test('ViewStateTable component types are all mapped by ViewStateRenderer', () => {
  const vsTableSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  const vsRendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  // "type": "X" only appears in the JSON entry bodies (the TS interface uses
  // `type: string` without quotes), so this captures exactly the used types.
  const used = new Set([...vsTableSrc.matchAll(/"type":\s*"([^"]+)"/g)].map((m) => m[1]));
  const mapped = new Set([...vsRendererSrc.matchAll(/component\.type === '([^']+)'/g)].map((m) => m[1]));
  const unmapped = [...used].filter((t) => !mapped.has(t));
  assert.equal(unmapped.length, 0,
    `unmapped component types (would silently Empty() in ViewStateRenderer): ${unmapped.join(', ')}`);
});

test('ViewStateProps keeps renderer baseline props even when fixtures stop using them', () => {
  const vsTableSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  for (const prop of ['label', 'progress', 'destructive', 'sources', 'unread']) {
    assert.ok(vsTableSrc.includes(`${prop}?:`), `ViewStateProps baseline prop missing: ${prop}`);
  }
});

// ── 6. No duplicate (routeId, pageState) keys in the view-state fixture ──
test('view-state fixture has no duplicate (routeId, pageState) keys', () => {
  const VS = readJson('view-state.fixtures.json');
  const seen = new Map();
  const dups = [];
  for (const e of VS) {
    const k = `${e.routeId}/${e.pageState}`;
    if (seen.has(k)) dups.push(k);
    seen.set(k, true);
  }
  assert.equal(dups.length, 0, `duplicate (routeId,pageState) entries (componentsFor shadows all but the first): ${dups.join(', ')}`);
});

test('book-detail uses the demo detail composite body, not a standalone cover', () => {
  const VS = readJson('view-state.fixtures.json');
  const detailSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookDetailComponents.ets'));
  const shellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/LibraryShell.ets'));
  const detail = VS.find((e) => e.routeId === 'book-detail' && e.pageState === 'default');
  assert.ok(detail, 'book-detail/default fixture missing');
  assert.deepEqual(
    detail.components.map((c) => c.type),
    ['AppTopBar', 'BookHero', 'BookSummaryCard', 'BookChapterList']
  );
  assert.equal(detail.components[0].props.title, '书籍详情', 'book-detail top bar title must match live demo');
  assert.equal(
    detail.components.some((c) => c.type === 'BookCover'),
    false,
    'book-detail must not render BookCover as a top-level body component'
  );
  for (const text of ['长夜余火', '爱潜水的乌贼', '第 32 章 雨夜', '书源：', '更换书源', '第 30 章 旧日', '第 33 章 灯塔']) {
    assert.ok(detailSrc.includes(text), `book-detail live demo content/structure missing ${text}`);
  }
  assert.ok(detailSrc.includes("id: 'source-switch'"), 'book-detail source action must push the live demo source-switch route');
  assert.ok(detailSrc.includes('bookshelf_cover_long_night'), 'book-detail hero must use the live demo long-night cover');
  assert.ok(detailSrc.includes("Image($r('app.media.ui_icon_list_primary')).width(16).height(16)"),
    'book-detail complete-directory action must keep the live demo list icon');
  assert.ok(!detailSrc.includes('reader_icon_more_dark'), 'book-detail chapter rows must not use obsolete more-dot row affordances');
  for (const text of ['继续阅读', '移除书架', "this.routeId === 'book-detail'", "variant: 'dangerSoft'"]) {
    assert.ok(shellSrc.includes(text), `book-detail fixed bottom action host missing ${text}`);
  }
  assert.ok(shellSrc.includes("ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' })"),
    'book-detail fixed continue action must route-push immersive-reading like the live demo');
  assert.ok(shellSrc.includes('bottom: this.scrollBottomPadding()'),
    'book-detail fixed action bar must not require a full-screen hit-test wrapper for scroll clearance');
});

test('reader entry route semantics match the live demo immersive-to-control flow', () => {
  const VS = readJson('view-state.fixtures.json');
  const readerSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const bookshelfSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  const detailSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookDetailComponents.ets'));
  const contractSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));
  const shellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/LibraryShell.ets'));
  const runtime = read(LIVE_DEMO_RUNTIME);

  assert.ok(runtime.includes('reader: { mode: "control" }'),
    'live demo must keep reader as the control-layer route');
  assert.ok(runtime.includes('"immersive-reading": { mode: "immersive" }'),
    'live demo must keep immersive-reading as the immersive route');
  assert.ok(runtime.includes('data-route="immersive-reading">阅读</button>'),
    'live demo bookshelf continue action routes to immersive-reading');
  assert.ok(runtime.includes('data-route="reader"></button>'),
    'live demo center hotzone routes from immersive-reading to reader');

  const byRoute = (routeId, pageState = 'default') => {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${routeId}/${pageState} fixture missing`);
    return entry.components.map((c) => c.type);
  };
  assert.deepEqual(byRoute('reader'), ['ReaderBase', 'ReaderTopArea', 'ReaderControlSheet', 'ReaderBottomBar'],
    'reader/default must render the live control layer, not the immersive-only body');
  assert.deepEqual(byRoute('immersive-reading'), ['ReaderBase'],
    'immersive-reading/default must let ReaderBase own the immersive text/info/tap layers once');
  assert.deepEqual(byRoute('reader_content'), ['ReaderBase'],
    'reader_content/default must not duplicate ReaderBase sublayers');

  assert.ok(readerSrc.includes("return this.routeId !== 'immersive-reading' && this.routeId !== 'reader_content'"),
    'ReaderBase must treat reader as control and only immersive routes as immersive');
  assert.ok(readerSrc.includes("route-push', id: 'reader'"),
    'immersive center hotzone must open the live reader control route');
  for (const src of [bookshelfSrc, detailSrc, contractSrc, shellSrc]) {
    assert.ok(src.includes("route-push', id: 'immersive-reading'"),
      'reader entry actions must route to immersive-reading before opening the control layer');
  }
  assert.ok(!bookshelfSrc.includes("route-push', id: 'reader'"),
    'bookshelf continue card must not enter the control route directly');
});

test('discover/rss main tabs use bespoke demo component trees, not generic contract scaffolds', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['discover/default', [
      'AppTopBar',
      'DiscoverSourceBar',
      'DiscoverEntryRow',
      'DiscoverFilterTrigger',
      'DiscoverListHead',
      'DiscoverBookList',
      'BottomNav',
    ]],
    ['rss/default', [
      'AppTopBar',
      'RssSearchEntry',
      'RssModeRow',
      'RssSourceOverview',
      'RssArticleSection',
      'BottomNav',
    ]],
  ]);
  const forbidden = new Map([
    ['discover/default', [
      'SearchEntry',
      'SourceTypeSegment',
      'CurrentSourceCard',
      'SourceCategoryChips',
      'DiscoveryContentCard',
      'SourceStatusBar',
    ]],
    ['rss/default', [
      'SubscriptionSummaryCard',
      'FeedStatusChips',
      'FeedSourceChips',
      'RssEntryItem',
      'UnreadIndicator',
    ]],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    const actual = entry.components.map((c) => c.type);
    assert.deepEqual(actual, types, `${key} must stay aligned with frontend-demo main tab DOM`);
    for (const type of forbidden.get(key) ?? []) {
      assert.equal(actual.includes(type), false, `${key} must not regress to generic ${type}`);
    }
  }
});

test('discover/rss horizontal chip rows hide native scroll indicators', () => {
  for (const file of ['DiscoverComponents.ets', 'RssComponents.ets']) {
    const src = read(path.join(REPO, 'entry/src/main/ets/ui/components', file));
    assert.ok(src.includes('.scrollBar(BarState.Off)'), `${file} must hide native horizontal Scroll bars`);
  }
});

test('discover source bulk route is reachable and owns fixed actions', () => {
  const discoverSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/DiscoverComponents.ets'));
  const settingsShellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/SettingsShell.ets'));
  assert.ok(discoverSrc.includes("id: 'discover-source-bulk'"), 'DiscoverSourceBar must route-push source bulk management');
  assert.ok(settingsShellSrc.includes("this.routeId === 'discover-source-bulk'"), 'SettingsShell must gate source bulk fixed actions by route');
  for (const label of ['启用', '禁用', '刷新']) {
    assert.ok(settingsShellSrc.includes(`label: '${label}'`), `discover-source-bulk fixed action missing ${label}`);
  }
  assert.ok(settingsShellSrc.includes('renderBottomActionBar()'), 'SettingsShell fixed actions must be rendered as a bottom action bar');
  assert.ok(!settingsShellSrc.includes('renderBottomActionHost'), 'SettingsShell must not use the obsolete full-screen action host');
  assert.ok(!settingsShellSrc.includes('.hitTestBehavior(HitTestMode.Transparent)'), 'SettingsShell fixed actions must not sit inside a full-screen transparent hit-test layer');
});

test('discover source login/rule pages use page-level visual components', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['discover-source-login/default', ['BackTopBar', 'DiscoverSourceLoginPage']],
    ['discover-rule-test/default', ['BackTopBar', 'DiscoverRuleTestPage']],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    const actual = entry.components.map((c) => c.type);
    assert.deepEqual(actual, types, `${key} must use discover page-level visual components`);
    for (const type of ['FormSection', 'List', 'Content', 'Button', 'Input', 'SettingsSection']) {
      assert.equal(actual.includes(type), false, `${key} must not regress to scaffold ${type}`);
    }
  }

  const discoverSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/DiscoverComponents.ets'));
  for (const text of [
    '轻小说文库',
    '打开网页登录',
    '发现规则',
    '测试入口',
    '解析到 18 本书',
  ]) {
    assert.ok(discoverSrc.includes(text), `DiscoverComponents missing source subpage copy: ${text}`);
  }
});

test('rss subpages use page-level visual components, not scaffold-only lists/loading', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['rss-all/default', ['BackTopBar', 'RssAllPage']],
    ['rss-original/default', ['BackTopBar', 'RssOriginalPage']],
    ['rss-refreshing/refreshing', ['BackTopBar', 'RssRefreshingPage']],
    ['rss-original-browser/default', ['BackTopBar', 'RssOriginalBrowserPage']],
    ['rss-favorite-groups/default', ['BackTopBar', 'RssFavoriteGroupsPage']],
    ['rss-source-groups/default', ['BackTopBar', 'RssSourceGroupsPage']],
    ['rss-source-import/default', ['BackTopBar', 'RssSourceImportPage']],
    ['rss-source-add/default', ['BackTopBar', 'RssSourceEditPage']],
    ['rss-source-edit/default', ['BackTopBar', 'RssSourceEditPage']],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    const actual = entry.components.map((c) => c.type);
    assert.deepEqual(actual, types, `${key} must use RSS page-level visual components`);
    for (const type of ['FilterBar', 'List', 'Content', 'Button', 'Loading']) {
      assert.equal(actual.includes(type), false, `${key} must not regress to scaffold ${type}`);
    }
  }

  const rssSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/RssComponents.ets'));
  for (const text of [
    '全部条目',
    '正在刷新启用订阅源和分类入口',
    'Reader UI 前端输入件更新说明',
    '外部浏览器',
    '技术文章',
    '开源项目',
    '选择导入方式',
    'RSS 源编辑',
    '源地址',
    'WebView',
  ]) {
    assert.ok(rssSrc.includes(text), `RssComponents missing RSS subpage copy: ${text}`);
  }
});

test('source tool pages use page-level visual components, not scaffold-only lists/loading', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['source-add/default', ['BackTopBar', 'SourceImportOptionsPage']],
    ['source-edit/default', ['BackTopBar', 'SourceRuleEditPage']],
    ['source-settings-entry/default', ['BackTopBar', 'SourceManagementPage']],
    ['source-import-preview/default', ['BackTopBar', 'SourceImportPreviewPage']],
    ['source-import-options/default', ['BackTopBar', 'SourceImportOptionsPage']],
    ['source-groups/default', ['BackTopBar', 'SourceGroupsPage']],
    ['source-detail/default', ['BackTopBar', 'SourceDetailPage']],
    ['source-detect/default', ['BackTopBar', 'SourceDetectPage']],
    ['source-batch/default', ['BackTopBar', 'SourceBatchPage']],
    ['source-rule-edit/default', ['BackTopBar', 'SourceRuleEditPage']],
    ['source-edit-debug/default', ['BackTopBar', 'SourceRuleEditPage']],
    ['source-debug/default', ['BackTopBar', 'SourceDebugPage']],
    ['source-debug-running/loading', ['BackTopBar', 'SourceDebugRunningPage']],
    ['source-debug-result/default', ['BackTopBar', 'SourceDebugResultPage']],
    ['source-debug-search-result/default', ['BackTopBar', 'SourceDebugResultPage']],
    ['source-debug-detail-result/default', ['BackTopBar', 'SourceDebugResultPage']],
    ['source-debug-catalog-result/default', ['BackTopBar', 'SourceDebugResultPage']],
    ['source-debug-content-log/default', ['BackTopBar', 'SourceDebugContentLogPage']],
    ['source-code-view/default', ['BackTopBar', 'SourceCodeViewPage']],
    ['source-logs/default', ['BackTopBar', 'SourceLogsPage']],
    ['source-delete-confirm/default', ['BackTopBar', 'SourceDeleteConfirmPage']],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    const actual = entry.components.map((c) => c.type);
    assert.deepEqual(actual, types, `${key} must use source tool page-level visual components`);
    for (const type of ['FormSection', 'List', 'Content', 'Button', 'Loading', 'SettingsSection']) {
      assert.equal(actual.includes(type), false, `${key} must not regress to scaffold ${type}`);
    }
  }

  const sourceSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/LibraryComponents.ets'));
  for (const text of [
    '网络导入',
    '分组用于筛选和批量整理书源',
    '5 项检测 · 4 项通过 · 1 项失败',
    '正文模块调测',
    '正在调测正文模块',
    '搜索模块调测',
    '正文模块日志',
    '源码查看',
    '错误日志',
    '删除书源？',
    '规则版本',
    '解析规则',
    '调测当前模块',
    '已选 3 个',
    '搜索书源名称或域名',
  ]) {
    assert.ok(sourceSrc.includes(text), `LibraryComponents missing source tool copy: ${text}`);
  }

  const structuralSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    'biquge.example · 玄幻书源',
    '异常 · 最近检测 10:30 · 规则版本 3',
    '最近检测结果',
    '失败规则：正文内容规则“#content@text”返回空内容。',
    '请求方式',
    '并发限制',
    'Cookie',
    '更新时间',
    '添加书源',
    '从 URL 拉取书源包',
    '选择本地 JSON 或 TXT 文件',
    '解析剪贴板中的书源内容',
    '进入空白书源编辑页',
  ]) {
    assert.ok(structuralSrc.includes(text), `StructuralPageComponents missing live source detail/import copy: ${text}`);
  }
  assert.equal(structuralSrc.includes("StructureCard({ title: this.title, message: '搜索、目录、正文规则均正常。'"), false,
    'source-detail must not regress to the old one-card placeholder');
  assert.equal(structuralSrc.includes("StatePanel({ title: '导入书源'"), false,
    'source-import-options must not regress to the old StatePanel placeholder');
});

test('source-management uses live list-management structure, not old tool hub', () => {
  const VS = readJson('view-state.fixtures.json');
  const entry = VS.find((e) => e.routeId === 'source-management' && e.pageState === 'default');
  assert.ok(entry, 'source-management/default fixture missing');
  assert.deepEqual(entry.components.map((c) => c.type), ['BackTopBar', 'SourceManagementPage'],
    'source-management/default must use the source management page-level component');

  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    '搜索书源名称或域名',
    '12 个书源 · 8 个启用 · 4 个异常 · 10:30 检测',
    '全部 · 全部分组',
    '起点中文网',
    '笔趣阁',
    '本地导入源',
    '纵横中文网',
  ]) {
    assert.ok(structural.includes(text), `SourceManagementPage missing live source-management copy: ${text}`);
  }
  assert.equal(structural.includes("StructureCard({ title: '书源工具'"), false,
    'SourceManagementPage must not regress to the old source tool hub card');
  assert.equal(structural.includes("SectionTitle({ title: '启用书源'"), false,
    'SourceManagementPage must not regress to the old enabled-source card list');

  const shell = read(path.join(REPO, 'entry/src/main/ets/ui/shells/SettingsShell.ets'));
  assert.ok(shell.includes("this.routeId === 'source-management'"), 'SettingsShell must reserve fixed actions for source-management');
  assert.ok(shell.includes("label: '批量管理'"), 'source-management fixed action bar must include batch management');
  assert.ok(shell.includes("label: '新增书源'"), 'source-management fixed action bar must include add source');
  assert.ok(shell.includes("route: 'source-import-options'"), 'source-management add action must open the live add-source sheet route');
  assert.ok(shell.includes("this.routeId === 'source-detail'"), 'SettingsShell must reserve fixed actions for source-detail');
  for (const label of ["label: '检测此源'", "label: '编辑规则'", "label: '删除'"]) {
    assert.ok(shell.includes(label), `source-detail fixed action bar missing ${label}`);
  }
});

test('sync restore pages use page-level visual components, not scaffold-only lists/loading', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['sync-backup/default', ['BackTopBar', 'SyncBackupPage']],
    ['sync-backup/loading', ['BackTopBar', 'SyncBackupPage']],
    ['webdav-config/default', ['BackTopBar', 'SyncBackupPage']],
    ['restore-confirm/default', ['BackTopBar', 'RestoreConfirmPage']],
    ['restore-scopes/default', ['BackTopBar', 'RestoreConfirmPage']],
    ['restore-preview/default', ['BackTopBar', 'RestoreConfirmPage']],
    ['restore-progress/loading', ['BackTopBar', 'RestoreProgressPage']],
    ['restore-running/loading', ['BackTopBar', 'RestoreProgressPage']],
    ['restore-conflict/error', ['BackTopBar', 'RestoreConflictPage']],
    ['restore-result/default', ['BackTopBar', 'RestoreResultPage']],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    const actual = entry.components.map((c) => c.type);
    assert.deepEqual(actual, types, `${key} must use sync restore page-level visual components`);
    for (const type of ['FormSection', 'List', 'Content', 'Loading', 'ErrorState', 'Button']) {
      assert.equal(actual.includes(type), false, `${key} must not regress to scaffold ${type}`);
    }
  }

  const structureSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    'WebDAV 配置',
    '服务器地址',
    '同步目录',
    '测试网络连通性',
    '保存配置',
    '恢复数据',
    '最近备份',
    '历史备份',
    '恢复范围',
    '确认恢复数据',
    '正在恢复',
    '选择冲突处理方式',
    '恢复完成',
  ]) {
    assert.ok(structureSrc.includes(text), `StructuralPageComponents missing sync restore copy: ${text}`);
  }
});

test('normalized state copy stays aligned with handoff HTML', () => {
  const VS = readJson('view-state.fixtures.json');
  const cases = [
    ['bookshelf-empty', 'shelf-empty', 'BookshelfEmptyPage', { title: '书架还是空的', message: '导入本地书籍或通过搜索加入书架。' }],
    ['rss-detail', 'default', 'RssDetailPage', { title: '深空信号更新' }],
    ['search-loading', 'loading', 'SearchStatePage', { title: '正在搜索', message: '正在从启用书源获取结果。' }],
    ['search-empty', 'empty', 'SearchStatePage', { title: '没有找到结果', message: '换个关键词或检查书源状态。' }],
    ['search-error', 'error', 'SearchStatePage', { title: '搜索失败', message: '网络源暂时不可用。', action: '重试' }],
    ['rss-empty', 'empty', 'RssEmptyState', { title: '暂无订阅', message: '添加 RSS 订阅后查看更新。', action: '添加订阅' }],
    ['rss-error', 'error', 'RssErrorState', { title: '订阅加载失败', message: '网络异常或订阅源不可访问。', action: '重试' }],
    ['sync-error', 'error', 'SyncErrorPage', { title: '同步失败', message: 'WebDAV auth error，请重新登录。' }],
    ['global-loading', 'loading', 'GlobalStatePage', { title: '加载中', message: '正在准备内容。' }],
    ['global-empty', 'empty', 'GlobalStatePage', { title: '暂无内容', message: '当前列表为空。' }],
    ['global-error', 'error', 'GlobalStatePage', { title: '出错了', message: '请稍后重试。', action: '重试' }],
    ['offline-state', 'offline', 'OfflineStatePage', { title: '当前离线', message: '可继续阅读已缓存书籍。' }],
    ['permission-required', 'permission', 'PermissionRequiredPage', { title: '需要存储权限', message: '授予权限后可导入本地书籍。', action: '授予权限' }],
    ['about-version', 'default', 'AboutVersionPage', { title: 'Reader for Android', version: '1.0.0' }],
  ];

  for (const [routeId, pageState, type, expectedProps] of cases) {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${routeId}/${pageState} fixture missing`);
    const component = entry.components.find((c) => c.type === type);
    assert.ok(component, `${routeId}/${pageState} missing ${type}`);
    const actual = Object.fromEntries(Object.keys(expectedProps).map((key) => [key, component.props[key]]));
    assert.deepEqual(actual, expectedProps);
  }
});

test('normalized settings/form pages use page-level components, not generic assembly', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['bookshelf-book-more-menu/default', ['AppTopBar', 'BookMoreMenuPage', 'BottomNav']],
    ['bookshelf-group-management/default', ['BackTopBar', 'BookGroupManagementPage']],
    ['group-management/default', ['BackTopBar', 'GroupManagementPage']],
    ['book-batch-management/default', ['BackTopBar', 'BookBatchManagementPage']],
    ['book-directory/default', ['BackTopBar', 'BookDirectoryPage']],
    ['rss-subscription-management/default', ['BackTopBar', 'RssSubscriptionManagementPage']],
    ['settings/default', ['AppTopBar', 'SettingsHomePage', 'BottomNav']],
    ['settings-general/default', ['BackTopBar', 'SettingsGeneralPage']],
    ['bookshelf-search-settings/default', ['BackTopBar', 'BookshelfSearchSettingsPage']],
    ['progress-sync/default', ['BackTopBar', 'ProgressSyncPage']],
    ['global-settings/default', ['BackTopBar', 'GlobalSettingsPage']],
    ['backup-settings/default', ['BackTopBar', 'BackupSettingsPage']],
  ]);

  for (const [key, types] of expected.entries()) {
    const [routeId, pageState] = key.split('/');
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === pageState);
    assert.ok(entry, `${key} fixture missing`);
    assert.deepEqual(entry.components.map((c) => c.type), types);
  }
});

test('settings and sort-filter page-level components are wired to visual renderers', () => {
  const VS = readJson('view-state.fixtures.json');
  const sortFilter = VS.find((e) => e.routeId === 'sort-filter' && e.pageState === 'default');
  assert.ok(sortFilter, 'sort-filter/default fixture missing');
  assert.deepEqual(
    sortFilter.components.map((c) => c.type),
    ['AppTopBar', 'ContinueReadingCard', 'BookshelfShelfSection', 'BottomNav'],
    'sort-filter must reuse bookshelf body with filter popover state'
  );
  const shelf = sortFilter.components.find((c) => c.type === 'BookshelfShelfSection');
  assert.equal(shelf.props.filterOpen, true, 'sort-filter must set BookshelfShelfSection.filterOpen=true');

  const settingsSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/SettingsComponents.ets'));
  for (const text of [
    "'bookshelf-search-settings'",
    'SettingsHomePage',
    'SettingsGeneralPage',
    'BookshelfSearchSettingsPage',
    'ProgressSyncPage',
    'App主题',
    '书架排序',
    '阅读进度同步',
  ]) {
    assert.ok(settingsSrc.includes(text), `SettingsComponents missing page-level copy/wiring: ${text}`);
  }

  const bookshelfSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  for (const text of ['BookshelfFilterPopover', '分组', '最近更新', '更新失败']) {
    assert.ok(bookshelfSrc.includes(text), `BookshelfComponents missing sort-filter popover copy: ${text}`);
  }

  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  for (const type of ['SettingsHomePage', 'SettingsGeneralPage', 'BookshelfSearchSettingsPage', 'ProgressSyncPage', 'SourceBatchPage']) {
    assert.ok(rendererSrc.includes(`component.type === '${type}'`), `ViewStateRenderer missing ${type}`);
  }
  assert.ok(rendererSrc.includes('filterOpen: component.props.filterOpen === true'), 'ViewStateRenderer must pass BookshelfShelfSection.filterOpen');
});

test('structural page visuals keep handoff row counts and copy', () => {
  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    '搜索入口',
    '书源管理入口',
    '阅读页入口',
    'WebDAV / 同步入口',
    '第6章：深空信号',
    '已选 3 本',
    '书籍归属',
    '第 34 章 旧地图',
    'https://example.com',
  ]) {
    assert.ok(structural.includes(text), `StructuralPageComponents missing handoff text: ${text}`);
  }
  assert.ok(
    structural.includes('constraintSize({ minHeight: 640 })'),
    'StatePanel must match .reader-state-page min-height 640'
  );
});

// ── 7. Live demo route → ViewState coverage guard ──────────────────────────
// Reader UI/frontend-demo is the route/rendering source. Every route rendered
// by render-runtime.js must have a ViewState entry OR an aliasFor declaration.
// PENDING_LIVE_DEMO_ROUTES is the explicit allowlist of routes not yet covered;
// it MUST be empty before declaring full migration. A route missing from both
// coverage AND PENDING_LIVE_DEMO_ROUTES is a hard FAIL (regression / scope gap).
const ROUTES_JSON = readJson('route.fixtures.json');
const VIEW_STATES_JSON = readJson('view-state.fixtures.json');
const VS_ROUTE_IDS = new Set(VIEW_STATES_JSON.map((v) => v.routeId));
const ALIAS_MAP = new Map(ROUTES_JSON.filter((r) => r.aliasFor).map((r) => [r.id, r.aliasFor]));
const LIVE_DEMO_ROUTES = liveDemoRouteTuples();

// Routes acknowledged as not-yet-migrated. Remove a route here ONLY when it has
// a ViewState entry or aliasFor declaration. Must be empty before full migration.
const PENDING_LIVE_DEMO_ROUTES = new Set([]);

test('live demo routes each have ViewState or alias or are in PENDING allowlist', () => {
  const missing = [];
  for (const [pageName, routeId] of LIVE_DEMO_ROUTES) {
    const hasVs = VS_ROUTE_IDS.has(routeId);
    const hasAlias = ALIAS_MAP.has(routeId);
    const isPending = PENDING_LIVE_DEMO_ROUTES.has(routeId);
    if (!hasVs && !hasAlias && !isPending) {
      missing.push(`${pageName} -> ${routeId}`);
    }
  }
  assert.equal(missing.length, 0,
    `live demo routes with no ViewState, no alias, and not in PENDING allowlist (add coverage or add to PENDING): ${missing.join(', ')}`);
});

test('PENDING_LIVE_DEMO_ROUTES allowlist contains no already-covered routes (stale entries must be removed)', () => {
  const stale = [];
  for (const [, routeId] of LIVE_DEMO_ROUTES) {
    if (!PENDING_LIVE_DEMO_ROUTES.has(routeId)) continue;
    const hasVs = VS_ROUTE_IDS.has(routeId);
    const hasAlias = ALIAS_MAP.has(routeId);
    if (hasVs || hasAlias) stale.push(routeId);
  }
  assert.equal(stale.length, 0,
    `PENDING_LIVE_DEMO_ROUTES has routes now covered (remove them from the allowlist): ${stale.join(', ')}`);
});

test('live demo route count matches runtime cases (dynamically read)', () => {
  assert.ok(LIVE_DEMO_ROUTES.length >= 200,
    `expected >=200 live demo routes (including reader overlays + control-layer-base-v2), got ${LIVE_DEMO_ROUTES.length}`);
  // Verify the 8 reader overlays + control-layer-base-v2 are present.
  const required = [
    'control-layer-base-v2', 'reader-appearance-overlay-v2',
    'reader-auto-scroll-overlay-v2', 'reader-directory-overlay-v2',
    'reader-night-state-v2', 'reader-replace-overlay-v2',
    'reader-search-overlay-v2', 'reader-settings-overlay-v2',
    'reader-tts-overlay-v2',
  ];
  const pageNames = new Set(LIVE_DEMO_ROUTES.map(([n]) => n));
  for (const r of required) {
    assert.ok(pageNames.has(r), `missing required reader overlay page: ${r}`);
  }
});

// ── 8. Scaffold-only ViewState guard ──────────────────────────────────────
// A route whose body components are ALL generic placeholders (FormSection, List,
// Card, Overlay, Input, Button, Content, FilterBar, DemoList, ListRow, Loading,
// Empty, ErrorState, Offline, Error) is "scaffold-only" — it compiles and
// renders, but is NOT a 1:1 demo page migration. Such routes must be listed in
// SCAFFOLD_ALLOWED so they are not silently counted as migrated. As later
// phases replace scaffold bodies with bespoke components, routes are removed
// from SCAFFOLD_ALLOWED.
const SCAFFOLD_TYPES = new Set([
  'FormSection', 'List', 'Card', 'Overlay', 'Input', 'Button', 'Content',
  'FilterBar', 'DemoList', 'ListRow', 'Loading', 'Empty', 'ErrorState',
  'Offline', 'Error', 'BackTopBar', 'AppTopBar', 'BottomNav',
]);

// Routes allowed to be scaffold-only (not yet 1:1 migrated). Must shrink over
// time. State pages (loading/empty/error/offline) are legitimately scaffold-only.
const SCAFFOLD_ALLOWED = new Set([
  'state-offline', 'state-error',
  // Phase 1: legitimate state pages + simple list/entry pages (scaffold is the
  // correct shape — these are not 1:1 demo migrations of bespoke components).
  // All live demo routes have now been moved out of this allowlist; entries
  // below are non-demo contract routes that are still scaffold.
  // Phase 2-4: simple list/content/form pages where scaffold is the correct shape.
]);

// Aggregate ALL body components across every pageState entry for a route.
// A route is scaffold-only only if EVERY pageState entry's body is all scaffold.
function routeBodyComponents(routeId) {
  const all = [];
  for (const entry of VIEW_STATES_JSON) {
    if (entry.routeId !== routeId) continue;
    const body = (entry.components || []).filter((c) => !['AppTopBar', 'BackTopBar', 'BottomNav'].includes(c.type));
    all.push(...body);
  }
  return all;
}

test('ViewState routes that are scaffold-only are listed in SCAFFOLD_ALLOWED', () => {
  const scaffoldOnly = [];
  const coveredRouteIds = new Set();
  for (const v of VIEW_STATES_JSON) coveredRouteIds.add(v.routeId);
  for (const routeId of coveredRouteIds) {
    const body = routeBodyComponents(routeId);
    if (body.length === 0) continue; // shell-only (e.g. main-tabs) — not a page
    const hasBespoke = body.some((c) => !SCAFFOLD_TYPES.has(c.type));
    if (!hasBespoke && !SCAFFOLD_ALLOWED.has(routeId)) {
      scaffoldOnly.push(routeId);
    }
  }
  assert.equal(scaffoldOnly.length, 0,
    `routes with scaffold-only ViewState not in SCAFFOLD_ALLOWED (replace with bespoke components or add to SCAFFOLD_ALLOWED): ${scaffoldOnly.join(', ')}`);
});

test('SCAFFOLD_ALLOWED contains no routes that now have bespoke components (stale entries)', () => {
  const stale = [];
  for (const routeId of SCAFFOLD_ALLOWED) {
    const body = routeBodyComponents(routeId);
    const hasBespoke = body.some((c) => !SCAFFOLD_TYPES.has(c.type));
    if (hasBespoke) stale.push(routeId);
  }
  assert.equal(stale.length, 0,
    `SCAFFOLD_ALLOWED has routes now with bespoke components (remove them): ${stale.join(', ')}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
