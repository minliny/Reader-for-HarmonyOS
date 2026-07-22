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
function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}
const FIXTURES = process.env.READER_UI_CONTRACTS
  || firstExisting([
    path.resolve(REPO, '../Reader-UI/contracts/fixtures'),
    path.resolve(__dirname, '../../Reader-UI/contracts/fixtures'),
  ]);
const FRONTEND_DEMO = process.env.READER_UI_FRONTEND_DEMO
  || firstExisting([
    path.resolve(REPO, '../Reader-UI/frontend-demo-optimized'),
    path.resolve(REPO, '../Reader-UI/frontend-demo'),
  ]);
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
const MOTIONS = readJson('motion.fixtures.json');

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

test('RouteTable registry exactly matches all 260 canonical RouteIds', () => {
  const schema = JSON.parse(read(path.resolve(FIXTURES, '..', 'route.schema.json')));
  const canonical = schema.properties.id.enum;
  const allBlock = routeSrc.match(/static readonly ALL: RouteId\[\] = \[([\s\S]*?)\n  \];/);
  assert.ok(allBlock, 'RouteTable.ALL not found');
  const generated = [...allBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.equal(canonical.length, 260, `canonical RouteId count drifted: ${canonical.length}`);
  assert.deepEqual(generated, canonical, 'RouteTable.ALL membership/order differs from canonical schema');
  assert.equal(new Set(generated).size, 260, 'RouteTable.ALL contains duplicate RouteIds');
  for (const routeId of canonical) {
    assert.ok(routeSrc.includes(`case '${routeId}': return`), `RouteTable missing explicit shell/title case for ${routeId}`);
  }
  assert.ok(routeSrc.includes('default: return null;'), 'unknown routes must be rejected, not sent to a catch-all shell');

  const viewStateSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  const directViewStateIds = new Set([...viewStateSrc.matchAll(/"routeId": "([^"]+)"/g)].map((match) => match[1]));
  const aliasByRoute = new Map(ROUTES.filter((route) => route.aliasFor).map((route) => [route.id, route.aliasFor]));
  for (const routeId of canonical) {
    let current = routeId;
    let resolved = directViewStateIds.has(current);
    for (let depth = 0; !resolved && depth < 5; depth++) {
      const next = aliasByRoute.get(current);
      if (!next || next === current) break;
      current = next;
      resolved = directViewStateIds.has(current);
    }
    assert.ok(resolved, `canonical route ${routeId} has no direct or aliased ViewState`);
  }
});

test('all 35 legacy 2.5 fallback routes now have direct canonical ViewState coverage', () => {
  const viewStateSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  const registrySrc = read(path.join(REPO, 'entry/src/main/ets/ui/router/ReaderContract25RouteRegistry.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/Contract25RouteComponents.ets'));
  const canonicalViewStates = readJson('view-state.fixtures.json');
  const definedIds = [...registrySrc.matchAll(/unavailableRouteDefinition\('([^']+)'/g)].map((match) => match[1]);
  assert.equal(definedIds.length, 35, `expected 35 historical Reader UI 2.5 fallback routes, got ${definedIds.length}`);
  assert.equal(new Set(definedIds).size, 35, 'historical 2.5 fallback registry contains duplicate definitions');
  for (const routeId of definedIds) {
    const direct = canonicalViewStates.find((entry) => entry.routeId === routeId);
    assert.ok(direct, `canonical ViewState fixture missing formerly synthetic route ${routeId}`);
    assert.ok(viewStateSrc.includes(`"routeId": "${routeId}"`), `ViewStateTable missing ${routeId}`);
    assert.ok(registrySrc.includes(`'${routeId}'`), `native renderer registry missing ${routeId}`);
  }
  assert.ok(viewStateSrc.includes('contractRouteId?: string;'),
    'legacy Contract25RoutePage fallback must retain its explicit route identity type');
  for (const marker of [
    'Contract25RouteRendererKind.ReaderWorkspaceState',
    'Contract25RouteRendererKind.ReaderReplacementState',
    'Contract25RouteRendererKind.SourceSwitchState',
    'Contract25RouteRendererKind.ReaderContentState',
    'Contract25RouteRendererKind.LocalImportState',
    'Contract25RouteAvailability.LegacyUnavailable',
    '功能暂不可用',
    '尚未接入可执行的 HarmonyOS 业务流程',
    'ReaderBase()',
  ]) {
    assert.ok(registrySrc.includes(marker) || rendererSrc.includes(marker), `2.5 native renderer missing ${marker}`);
  }
  assert.ok(!registrySrc.includes('routeAction('), 'unconnected 2.5 routes must not retain fake action definitions');
  assert.ok(!rendererSrc.includes('Contract25RouteActionButton'), 'unconnected 2.5 routes must not render action buttons');
  assert.ok(!rendererSrc.includes("ReaderUiStore.dispatch({ type: 'route-replace'"),
    'unconnected 2.5 routes must not route-replace as a fake workflow result');
  assert.ok(!rendererSrc.includes('definition.actions'), 'unconnected 2.5 routes must render one explicit unavailable state');
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

test('all 95 generated MotionSpecs have derived serial metadata and valid policy/literal references', () => {
  const specSrc = read(path.join(GEN, 'MotionSpecTable.ets'));
  const serialRegistrySrc = read(path.join(REPO, 'entry/src/main/ets/ui/motion/MotionSerialMetadataRegistry.ets'));
  const resolverSrc = read(path.join(REPO, 'entry/src/main/ets/ui/motion/ReaderMotionResolver.ets'));
  const routeRendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/router/RouteRenderer.ets'));
  const generatedIds = [...specSrc.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
  const canonicalIds = MOTIONS.map((motion) => motion.id);
  assert.equal(canonicalIds.length, 95, `canonical MotionSpec count drifted: ${canonicalIds.length}`);
  assert.deepEqual(generatedIds, canonicalIds, 'generated MotionSpec membership/order drifted');
  assert.equal(new Set(generatedIds).size, 95, 'generated MotionSpecs contain duplicate ids');
  assert.ok(serialRegistrySrc.includes('MotionSpecRegistry.all()'), 'serial metadata must derive from generated registry');
  assert.ok(!serialRegistrySrc.includes('switch ('), 'serial metadata must not use a hand-written MotionId switch');
  assert.ok(!serialRegistrySrc.includes('default:'), 'serial metadata must not use catch-all records');
  for (const policy of POLICIES.filter((item) => item && item.id)) {
    assert.ok(generatedIds.includes(policy.motionId), `motion policy ${policy.id} references missing spec ${policy.motionId}`);
  }
  assert.ok(resolverSrc.includes('static resolveSpec(req: MotionRequest): MotionSpec | undefined'));
  assert.ok(resolverSrc.includes('MotionSpecRegistry.byId(p.motionId)'));
  assert.ok(resolverSrc.includes('if (!ReaderMotionResolver.hasExplicitMatch(p)) continue;'),
    'resolver must ignore empty-match catch-all policies');
  assert.ok(routeRendererSrc.includes('ReaderMotionResolver.resolveSpec(op)'));
  assert.ok(routeRendererSrc.includes('MotionAdapter.applySpec(motionSpec'));
  assert.ok(!routeRendererSrc.includes("resolveOr(op, 'app.route.replace')"), 'route motion must not use hand-written fallback id');

  const mainRoot = path.join(REPO, 'entry/src/main/ets');
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.ets') && !full.includes('/contract/generated/')) files.push(full);
    }
  };
  visit(mainRoot);
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/MotionAdapter\.apply\(\s*'([^']+)'/g)) {
      assert.ok(generatedIds.includes(match[1]), `${path.relative(REPO, file)} uses unknown MotionSpec ${match[1]}`);
    }
  }
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
    '阅读缓存预取',
    'ReaderQuickPanelShell',
    'ReaderQuickPanel',
    '本地已加载段落',
    'Core 阅读缓存 command',
    'Core search.content',
    '搜索当前书籍的已缓存正文',
    'Core 全文已接入',
    '雨容称呼',
    '旧称统一',
    '标点清理',
    '广告过滤',
    '停止自动翻页',
    '上一章',
    '自动翻页',
    '下一章',
    '翻页速度',
    'intervalSeconds',
    '连续',
    '单页',
  ]) {
    assert.ok(src.includes(text), `ReaderOverlayComponents missing live demo overlay text: ${text}`);
  }
  const quickDirectory = src.slice(
    src.indexOf('export struct ReaderDirectoryPanel'),
    src.indexOf('export struct ReaderAppearancePanel')
  );
  const fullDirectory = src.slice(
    src.indexOf('export struct ReaderFullDirectoryPage'),
    src.indexOf('export struct ReaderFullTtsPage')
  );
  const quickDirectoryRow = src.slice(
    src.indexOf('struct ReaderTocLiveRow'),
    src.indexOf('struct ReaderLiveStepperRow')
  );
  const fullDirectoryRow = src.slice(
    src.indexOf('struct ReaderFullTocRow'),
    src.indexOf('export struct ReaderFullDirectoryPage')
  );
  for (const directory of [quickDirectory, fullDirectory]) {
    assert.ok(directory.includes("@StorageProp('reader.chapterToc')"),
      'reader directory must bind the Core-backed chapter TOC');
    assert.ok(directory.includes("type: 'set-toc-mode'"),
      'reader directory tabs must use reducer-backed directory/bookmark state');
    assert.ok(!directory.includes('已缓存'),
      'reader directory must not claim a static cached-chapter result');
  }
  assert.ok(!quickDirectory.includes('tocRows'),
    'quick reader directory must not retain fixture chapter rows');
  assert.ok(!fullDirectory.includes('private rows: Array<[string, string, string, boolean]>'),
    'full reader directory must not retain fixture chapter rows');
  for (const row of [quickDirectoryRow, fullDirectoryRow]) {
    assert.ok(row.includes("type: 'chapter-load'"),
      'reader directory chapter rows must dispatch the selected real chapter');
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
  ]) {
    assert.equal(src.includes(oldText), false, `ReaderOverlayComponents must not keep obsolete quick-panel copy: ${oldText}`);
  }
  assert.ok(!src.includes("ReaderListRow({ title: '三体'"), 'replace overlay must not show the wrong demo book title');
  assert.ok(!src.includes("ReaderSettingRow({ name: '替换\\\"信号\\\"为\\\"信号源\\\"'"), 'replace overlay must use live demo rule names');
});

test('bookmarks, search history, and single-book grouping stay Core-backed', () => {
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const overlay = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const contract = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));
  const structure = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const marker of [
    'async bookmarkList(', 'async bookmarkCreate(', 'async bookmarkDelete(',
    'async searchHistoryList(', 'async searchHistoryAdd(', 'async bookshelfGroupAssign(',
    "'bookmark.list'", "'bookmark.create'", "'bookmark.delete'",
    "'search.history.list'", "'search.history.add'", "'bookshelf.group.assign'",
  ]) {
    assert.ok(runtime.includes(marker), `CoreRuntime missing typed Core vertical ${marker}`);
  }
  for (const marker of [
    'mapCoreBookmarks', 'loadBookmarksForCurrentBook', 'bookmark.operation',
    'Core Bookmark V1 intentionally filters by (bookName, bookAuthor)',
    'loadSearchHistory', 'clearConfirmedSearchHistory', 'searchHistoryAdd', 'assignBookshelfGroup',
  ]) {
    const present = marker === 'bookmark.operation'
      ? effects.includes('bookmark-operation-failed')
      : effects.includes(marker);
    assert.ok(present, `ReaderEffects missing Core-backed vertical marker ${marker}`);
  }
  for (const directory of [
    overlay.slice(overlay.indexOf('export struct ReaderDirectoryPanel'), overlay.indexOf('export struct ReaderAppearancePanel')),
    overlay.slice(overlay.indexOf('export struct ReaderFullDirectoryPage'), overlay.indexOf('export struct ReaderFullTtsPage')),
  ]) {
    assert.ok(directory.includes("@StorageProp('reader.bookmarks')"),
      'reader bookmark tabs must bind the Core bookmark projection');
    assert.ok(directory.includes('ReaderBookmarkLiveRow'),
      'reader bookmark tabs must render the Core-backed bookmark row');
  }
  assert.ok(overlay.includes("type: 'bookmark-open'") &&
    overlay.includes("type: 'bookmark-delete-request'") &&
    overlay.includes("type: 'bookmark-delete-confirm'"),
  'reader bookmark rows must expose real jump plus live-target confirmed delete actions');
  assert.ok(overlay.includes("type: 'bookmark-create'"),
    'reader control sheet must expose a Core-backed add-bookmark action');
  assert.ok(contract.includes("@StorageProp('reader.searchHistory')") &&
    contract.includes("type: 'search-history-clear-request'") &&
    contract.includes("type: 'search-history-clear-confirm'"),
  'book search must bind Core history and clear only after live confirmation');
  for (const fixtureKeyword of ["'三体'", "'刘慈欣'", "'球状闪电'"]) {
    assert.equal(contract.includes(`private history: string[] = [${fixtureKeyword}`), false,
      'book search must not retain fixture history keywords');
  }
  assert.ok(structure.includes('bookshelf.group.assign') && structure.includes("type: 'book-group-assign'"),
    'group management must expose Core-backed single-book assignment');
  assert.equal(structure.includes('当前 Core 未提供独立的书籍分组归属修改命令'), false,
    'group management must not claim the now-connected Core command is unavailable');
});

test('reader cache and body search stay within the connected Core capability boundary', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const cache = src.slice(
    src.indexOf('export struct ReaderBookCachePage'),
    src.indexOf('export struct ReaderDebugInfoPage')
  );
  const debug = src.slice(
    src.indexOf('export struct ReaderDebugInfoPage'),
    src.indexOf('export struct ReaderSearchPanel')
  );
  const search = src.slice(
    src.indexOf('export struct ReaderSearchPanel'),
    src.indexOf('export struct ReaderReplacePanel')
  );
  const settings = src.slice(
    src.indexOf('export struct ReaderSettingsPanel'),
    src.indexOf('struct ReaderFullPanelShell')
  );

  assert.ok(cache.includes("@StorageProp('reader.currentBook') currentBook: BookDetail | null = null"),
    'cache view must gate content on the selected Core book');
  assert.ok(cache.includes("@StorageProp('reader.chapterContent') chapterContent: string[] = []"),
    'cache view may consume only loaded Core chapter content');
  assert.ok(cache.includes("@StorageProp('reader.currentChapterTitle') currentChapterTitle: string = ''"),
    'cache view must label data with the current Core chapter');
  assert.ok(search.includes("@StorageProp('reader.currentBook') currentBook: BookDetail | null = null"),
    'body search must scope requests to the selected Core book');
  assert.ok(search.includes("@StorageProp('reader.contentSearchResults') contentSearchResults: CoreContentSearchResult[] = []"),
    'body search must render the Core search.content projection rather than local snippets');
  assert.ok(search.includes("@StorageProp('reader.contentSearchLoading') contentSearchLoading: boolean = false"),
    'body search must expose a dedicated Core loading state');
  assert.ok(cache.includes('Core 阅读缓存 command 未接入') && cache.includes('操作已禁用'),
    'cache page must declare the unavailable Core cache command and disable all cache operations');
  assert.ok(cache.includes('仅内存片段，不等同于磁盘缓存') && cache.includes('ReaderLoadedParagraphRow'),
    'cache page may show only current in-memory content, never infer disk cache state');
  assert.ok(!cache.includes('cacheRows') && !cache.includes('ReaderCacheListRow'),
    'cache page must not retain fixture chapter cache rows');
  assert.ok(search.includes("type: 'content-search-submit'") && search.includes('contentSearchResultIndex: i') &&
    src.includes("type: 'content-search-result-open'"),
    'body search must dispatch Core-backed search and scoped result-open events');
  assert.ok(search.includes('Core search.content 只查询当前书源、当前书籍的已缓存章节') &&
    search.includes("ReaderQuickPillButton({ label: 'Core 全文已接入', disabled: true })"),
    'body search must declare the exact Core cache scope instead of a fake local search');
  assert.ok(!search.includes('private localMatches(): string[]') && !search.includes('仅搜索当前已加载章节片段'),
    'body search must not retain the old current-paragraph fallback');
  assert.ok(!search.includes('Core 正文全文搜索 command 未接入'),
    'body search must not claim the connected Core command is unavailable');
  assert.ok(settings.includes("title: '阅读缓存预取'") && settings.includes('disabled: true'),
    'reader settings must not expose an enabled cache-prefetch toggle before Core support exists');
  for (const fixture of [
    '第 32 章 雨夜',
    '雨夜的风格外冷 · 当前结果 1/2',
    '雨夜之后，远处灯塔亮起 · 结果 2/2',
    '32/128',
    '128 MB',
    '已下载到本地',
    '尚未缓存',
    '前序章节已缓存',
    '优书网 · 128ms',
  ]) {
    assert.equal(src.includes(fixture), false,
      `reader cache/search/debug UI must not retain fabricated state: ${fixture}`);
  }
  assert.ok(debug.includes('private diagnostics(): Array<[string, string, string, string]>') &&
    debug.includes("['正文搜索', 'search.content'"),
    'debug view must derive full-text-search status from the Core projection');
});

test('reader body search wrapper preserves the Core cache boundary', () => {
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  assert.ok(runtime.includes('async searchContent(keyword: string, sourceId: string, bookId: string'),
    'Harmony bridge must expose a typed search.content wrapper');
  assert.ok(runtime.includes("params['sourceId'] = sourceId") && runtime.includes("params['bookId'] = bookId") &&
    runtime.includes("this.runtime.request('search.content'"),
    'search.content wrapper must require current sourceId + bookId scope');
  assert.ok(effects.includes('mapContentSearchResults(data, sourceId, book.bookId)') &&
    effects.includes('result.sourceId !== sourceId || result.bookId !== book.bookId'),
    'effect layer must reject late/cross-book Core result projections');
  assert.ok(effects.includes('findTocPositionByCoreIndex') && effects.includes('persistContentSearchAnchor'),
    'result opening must resolve the Core TOC and persist the Core chapterOffset anchor');
  assert.ok(effects.includes('contentSearchJumpSequence') && effects.includes('enqueueReadingProgress(snapshot)'),
    'content-search target progress must enter the same serialized queue as ordinary reader anchors');
  assert.ok(effects.includes('bookOpenSequence: sequence') && effects.includes('loadStoredSourceToc(book, sourceId, sequence)'),
    'content-search jumps must carry a book-open transaction through TOC and chapter loading');
  assert.ok(effects.includes('isCurrentChapterLoad(book.bookId, sourceId, coreChapterIndex, chapterUrl)') &&
    effects.includes("isCurrentChapterLoad(book.bookId, 'local', entry.index, entry.chapterId)"),
  'late local and remote chapter callbacks must be rejected after a newer chapter load starts');
});

test('reader control layer uses live demo top overlay and reading copy', () => {
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  assert.ok(reader.includes('export struct ReaderTopArea'), 'control-layer routes need the live demo reader-top component');
  assert.ok(reader.includes("@StorageProp('reader.currentBook') currentBook: BookDetail | null = null"),
    'reader top area must render the selected Core book instead of a fixed demo title');
  assert.ok(reader.includes('private bookTitle(): string') && reader.includes("return '未选择书籍';"),
    'reader top area must expose an honest no-selection state instead of a demo title');
  assert.ok(reader.includes('private bookMeta(): string') && reader.includes('return `${chapter} · ${source}`;'),
    'reader top area must expose a live chapter and source line');
  assert.ok(reader.includes("Text('换源')"), 'reader top area must expose the live demo source-switch action');
  assert.ok(reader.includes("id: 'source-switch'"), 'reader top source switch must push the live demo source-switch route');
  assert.ok(reader.includes('private hasReadableContent(): boolean'),
    'reading surface must gate body rendering on selected Core content');
  assert.ok(reader.includes('return this.currentBook === null ? [] : this.chapterContent;'),
    'reading surface must never substitute fixture prose when no book is selected');
  assert.ok(reader.includes('尚未选择书籍') && reader.includes('Core 未返回本章正文。'),
    'reading surface must expose truthful no-book and empty-content states');
  for (const fixtureMarker of ['fallbackParagraphs', '雨声在窗外连成一片', "return '雨夜'", '长夜余火', '第 32 章 雨夜', '优书网']) {
    assert.equal(reader.includes(fixtureMarker), false,
      `reader surface must not retain fabricated fallback content: ${fixtureMarker}`);
  }
  assert.ok(reader.includes('.borderRadius(DemoAliasTokens.radiusXl)'), 'reader top area must be one floating rounded live-demo bar');
  assert.ok(reader.includes('.textAlign(TextAlign.Center)'),
    'reader title must stay centered like live demo');
  const textFlowStart = reader.indexOf('export struct ReadingTextFlow');
  const textFlowEnd = reader.indexOf('// .fd-ir-info-layer');
  const textFlow = reader.slice(textFlowStart, textFlowEnd);
  for (const storageKey of [
    "@StorageProp('reader.typography.fontSize')",
    "@StorageProp('reader.typography.lineHeight')",
    "@StorageProp('reader.typography.paragraphGap')",
    "@StorageProp('reader.typography.letterSpacing')",
    "@StorageProp('reader.typography.fontFamily')",
    "@StorageProp('reader.pageSpace.topMargin')",
    "@StorageProp('reader.pageSpace.sideMargin')",
    "@StorageProp('reader.pageSpace.paragraphIndent')",
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
  assert.ok(reader.includes('private horizontalPages(): ReaderPageModel[]'),
    'horizontal page-turn mode must render page-sized bodies instead of one vertical flow');
  assert.ok(reader.includes('private measuredParagraphHeight(text: string): number'),
    'horizontal reader mode must measure page capacity with ArkUI text metrics');
  assert.ok(reader.includes('getMeasureUtils().measureTextSize({'),
    'horizontal reader mode must use the native text engine instead of a stale line-height ratio');
  assert.ok(!reader.includes('this.paragraphLineHeight() * 0.88'),
    'reader pagination must not restore the obsolete 0.88 line-height correction');
  assert.ok(reader.includes('this.textLayerHeight()'),
    'horizontal reader mode must use the configured text frame height when paginating');
  assert.ok(!textFlow.includes('const pageSize = 2'),
    'horizontal reader mode must not use the old fixed two-paragraph pages');
  assert.ok(reader.includes('private verticalReading(): boolean'),
    'vertical reading mode must keep a dedicated scroll-flow branch');
  assert.ok(reader.includes('ForEach([this.currentPageIndex()]') &&
    reader.includes('this.ReaderParagraphs(this.horizontalPageData[pageIndex]?.fragments ?? [], pageIndex)'),
    'horizontal reader mode must render one current-page subtree keyed by page index');
  assert.ok(!textFlow.includes('.padding({ right: pageIndex ==='),
    'horizontal pages must not consume a second right gutter inside the page width');
  assert.ok(reader.includes('return this.interactionDebugVisible ? 0.42 : 0;'),
    'normal reader hotzones must be fully transparent');
  assert.ok(reader.includes('top: this.textTopInset()'),
    'reader text top inset must be route-stable instead of control-layer-specific');
  assert.ok(reader.includes('left: this.textLeftInset()'),
    'reader text left inset must be route-stable instead of control-layer-specific');
  assert.ok(reader.includes('right: this.textRightInset()'),
    'reader text right inset must stay explicit and independently verifiable');
  const textRightInsetStart = textFlow.indexOf('private textRightInset(): number');
  const textRightInsetEnd = textFlow.indexOf('  private textBottomInset(): number', textRightInsetStart);
  const textRightInset = textFlow.slice(textRightInsetStart, textRightInsetEnd);
  assert.ok(textRightInset.includes('return Math.max(designInset, this.safeAreaEnd + designInset);'),
    'tablet reading text must retain its normal bilateral design edge');
  assert.ok(!textRightInset.includes('wideControlDock()') && !textRightInset.includes('return Math.max(400,'),
    'tablet ControlDock must remain a floating overlay and never reserve a 400vp full-height text column');
  const frozenTabletWidth = 760;
  const frozenTabletDesignInset = 44;
  const frozenTabletTextWidth = frozenTabletWidth - frozenTabletDesignInset * 2;
  assert.equal(frozenTabletTextWidth, 672,
    'frozen Reader 2 tablet baseline retains a full-width 672vp text frame before its independent floating dock overlays it');
  assert.ok(reader.includes('bottom: this.textBottomInset()'),
    'reader text bottom inset must not reserve bottom sheet space');
  assert.ok(reader.includes('return Math.max(baseTop, this.safeAreaTop + SpacingTokens.lg)'),
    'reader top inset must use safe area as a floor instead of adding two margins');
  assert.ok(reader.includes('return Math.max(SpacingTokens.xl, this.safeAreaBottom + SpacingTokens.lg)'),
    'reader bottom inset must preserve the demo 48vp floor without additive drift');
  assert.ok(!textFlow.includes('reader.pageSpace.bottomMargin'),
    'reader page space must not expose a bottom-margin control absent from the current demo');
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
  assert.ok(reader.includes('ReadingInfoLayer()'), 'immersive reader branch keeps corner info');
  assert.ok(reader.includes("route-push', id: 'reader'"),
    'center tap hot zone must open the live demo reader control route');
  assert.ok(reader.includes('@StorageProp(InteractionDebugAdapter.K_VISIBLE)'),
    'immersive tap zones must support development-mode visualization');
  assert.ok(reader.includes("this.zoneLabel('ControlLayerHotzone')"),
    'development mode must label the center reader control hot zone with the live demo data-dev-region name');
  assert.ok(reader.includes("type: 'reader-page-next'"),
    'the right reader hot zone must advance reducer-backed pagination');
  assert.ok(reader.includes("Text(this.pageLabel())"),
    'the immersive footer must show reducer-backed page index/count instead of a hard-coded total');
  assert.ok(!reader.includes('.hitTestBehavior(HitTestMode.Block)'),
    'TapZones parent must not block child hot-zone clicks');
  assert.ok(reader.includes('.zIndex(ZIndexTokens.dialog)'),
    'immersive tap zones must sit above the reading text layer');
  const entryAbility = read(path.join(REPO, 'entry/src/main/ets/entryability/EntryAbility.ets'));
  assert.ok(entryAbility.includes('InteractionDebugAdapter.K_VISIBLE'),
    'EntryAbility must seed the development interaction visualization flag');
  assert.ok(entryAbility.includes("params['interactionDebug'] === 'true'"),
    'development interaction visualization must be opt-in for production-like test packages');
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
    'paragraphIndent: number',
    'readerPageIndex: number',
    'readerPageCount: number',
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
    "K_PARAGRAPH_INDENT: string = 'reader.pageSpace.paragraphIndent'",
    "K_READER_PAGE_INDEX: string = 'reader.pageIndex'",
    "K_READER_PAGE_COUNT: string = 'reader.pageCount'",
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

test('reader reflow and resume preserve Core scalar anchors instead of page zero', () => {
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const reducer = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const library = read(path.join(REPO, 'entry/src/main/ets/ui/shells/LibraryShell.ets'));
  const contract = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));

  assert.ok(reader.includes('captureLiveReflowAnchor') && reader.includes('applyLiveReflowAnchor') &&
    reader.includes('applyVisualAnchorRestore'),
  'font, viewport, and pagination reflow must restore the current scalar anchor before any initial canonical anchor');
  assert.ok(reader.includes('scalarBoundaryBefore') && reader.includes('firstScalarEnd'),
    'horizontal pagination must not split UTF-16 surrogate pairs and drift Core Unicode-scalar offsets');
  for (const method of ['setPaginationMode', 'setReaderRenderMetric', 'setReaderFontFamily', 'resetReaderRenderSettings']) {
    const start = reducer.indexOf(`static ${method}`);
    const end = reducer.indexOf('\n  static ', start + 1);
    const body = reducer.slice(start, end < 0 ? reducer.length : end);
    assert.ok(!body.includes('next.readerChapterOffset = 0') && !body.includes('next.readerChapterProgress = 0'),
      `${method} must reflow from the current Core anchor rather than reset reading position`);
  }
  assert.ok(effects.includes('readingProgressGet(bookId, sourceId)') &&
    effects.includes('bookOpenRequestSequence') && effects.includes('bookOpenSequence: sequence'),
  'shelf reopening must use source-scoped Core progress and reject stale detail/TOC/body responses');
  assert.ok(!library.includes('chapterToc[0]') && !contract.includes('chapterListUrl });'),
    'continue-reading controls must not treat a TOC endpoint or first visible row as a resume location');
  assert.ok(!contract.includes('fixtureChapters') && !contract.includes('科学边界') &&
    !contract.includes('叶文洁在雷达峰'),
  'book detail preview must not render fixture chapters or a fixture introduction when Core has no data');
  assert.ok(reader.includes('contentIdentity: ReaderContentIdentity') &&
    reader.includes('reportReadingAnchor(page.contentIdentity') &&
    reader.includes('reportReadingAnchor(selected.contentIdentity'),
  'rendered horizontal and vertical fragments must retain their own chapter identity for late ArkUI callbacks');
  assert.ok(reducer.includes('activeReaderContentIdentity') &&
    reducer.includes('bookId !== active.bookId') && reducer.includes('chapterIndex !== active.chapterIndex'),
  'reducer must reject a stale anchor that does not match the active rendered body');
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
    '缓存能力',
    '当前已加载正文',
    'Core 阅读缓存 command',
    'search.content',
    '调试信息',
    '渲染状态',
    '调试日志',
    '命令可用性',
  ]) {
    assert.ok(overlaySrc.includes(marker), `ReaderOverlayComponents missing full/utility marker ${marker}`);
  }
});

test('reader controls bind Core or Host capabilities and mark missing controls unavailable', () => {
  const overlay = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const fullTts = overlay.slice(
    overlay.indexOf('export struct ReaderFullTtsPage'),
    overlay.indexOf('export struct ReaderFullAppearancePage')
  );
  const fullSettings = overlay.slice(
    overlay.indexOf('export struct ReaderFullSettingsPage'),
    overlay.indexOf('struct ReaderUtilitySummaryCard')
  );
  const controlSheet = overlay.slice(
    overlay.indexOf('export struct ReaderControlSheet'),
    overlay.indexOf('// ── Control bottom bar')
  );

  for (const marker of [
    "@StorageProp('reader.ttsSession.playback')",
    "type: 'tts-prev'",
    "type: 'tts-toggle'",
    "type: 'tts-next'",
    "choiceKey: 'ttsRate'",
    'TextReader Host 未提供程序化速率',
    'Host 未提供映射',
    'Core 仅当前章节',
    'Core/Host 未接入',
    'disabled: true',
  ]) {
    assert.ok(fullTts.includes(marker), `full TTS must keep truthful capability marker ${marker}`);
  }
  for (const marker of [
    "@StorageProp('reader.readerToggles.keepScreenOn')",
    "@StorageProp('reader.readerToggles.statusInfo')",
    "@StorageProp('reader.readerToggles.hapticFeedback')",
    "choiceKey: 'tapMode'",
    '未接入按键监听',
    '未接入方向 Host',
    '当前 Reader Pager 未接入',
  ]) {
    assert.ok(fullSettings.includes(marker), `full settings must bind or disable ${marker}`);
  }
  assert.ok(controlSheet.includes("type: 'chapter-next'"), 'control sheet next chapter must dispatch a real effect');
  assert.ok(controlSheet.includes("type: 'chapter-progress-seek'"), 'control sheet progress must dispatch Core-backed seek');
  assert.ok(overlay.includes('struct ReaderBrightnessRail'), 'reader shell/quick/module must share a bound brightness rail');
  assert.ok(overlay.includes("type: 'set-brightness'"), 'brightness rail must dispatch reducer state');
  assert.ok(effects.includes('setWindowBrightness'), 'set-brightness must reach the Harmony window');
  assert.ok(effects.includes('applyKeepScreenOn'), 'keep-screen-on must reach the ScreenHostAdapter');
  assert.ok(effects.includes('maybeVibrateForReaderInteraction'), 'haptic setting must reach DeviceHostAdapter');
  assert.ok(effects.includes('revertReaderBrightness'), 'brightness failures must restore the visible slider state');
  assert.ok(effects.includes('revertReaderToggle'), 'system-bar failures must restore the visible toggle state');
  assert.ok(effects.includes("beforeTick.autoPageMode === 'single'"),
    'single auto-page mode must be consumed by the active timer');
  assert.ok(effects.includes("type: 'auto-page-toggle'"),
    'single auto-page mode must stop the active timer after one advance');
  assert.ok(reader.includes("@StorageProp('reader.readerSettingOptions.tapMode')"),
    'tap-mode setting must have a reader-surface consumer');
});

test('reader body selection uses ArkUI native text selection and real action paths', () => {
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  const toolbar = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderSelectionToolbar.ets'));
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  assert.ok(reader.includes('.copyOption(CopyOptions.InApp)'),
    'reader paragraphs must opt into ArkUI native text selection');
  assert.ok(reader.includes('.bindSelectionMenu(TextSpanType.TEXT, this.NativeSelectionMenu, TextResponseType.LONG_PRESS)'),
    'reader paragraphs must bind the native long-press selection menu');
  assert.ok(reader.includes('.onTextSelectionChange((selectionStart: number, selectionEnd: number)'),
    'reader selection text must come from ArkUI selection offsets');
  assert.ok(reader.includes(".hitTestBehavior(HitTestMode.Transparent)"),
    'tap hot zones must not mask native long-press selection');
  assert.ok(toolbar.includes("Text('高亮（未接入）')") && toolbar.includes("Text('笔记（未接入）')"),
    'unimplemented Core highlight/note capability must be explicit and disabled');
  assert.ok(toolbar.includes('.enabled(false)'),
    'unimplemented selection actions must not remain clickable');
  assert.ok(effects.includes('getClipboardAdapter().copy({ text: selectedText })'),
    'copy must use the Clipboard Host adapter');
  assert.ok(effects.includes("{ type: 'route-push', id: 'content-search' }") &&
    effects.includes("{ type: 'content-search-submit', query: keyword }"),
    'search must enter the existing Core-backed content-search flow');
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
  assert.ok(entryAbility.includes("params['interactionDebug'] === 'true'"),
    'development mode should be off by default and enableable with interactionDebug=true');
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
  const effectsSrc = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const reducerSrc = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
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
    'SourceSwitchPhoneActions()',
    "Text('换源')",
    "Text('请选择一个书源')",
    "@StorageProp('reader.availableSources')",
    "Text('确认换源')",
    "Text('取消')",
    "type: 'source-switch-confirm'",
  ]) {
    assert.ok(componentSrc.includes(marker), `SourceSwitchFlowComponents missing live flow marker: ${marker}`);
  }
  assert.ok(!componentSrc.includes('按延迟排序') && !componentSrc.includes('待测速'),
    'SourceSwitchFlowComponents must not claim latency ordering or unmeasured source speed');
  assert.ok(!componentSrc.includes("type: 'source-select-all'"),
    'SourceSwitchFlowComponents must not expose a multi-source select-all action for a single-source Core flow');
  assert.ok(effectsSrc.includes('runtime.changeBookSource') && effectsSrc.includes('selectSourceSwitchCandidate'),
    'source switch must use the selected persisted source and reject ambiguous Core candidates');
  assert.ok(effectsSrc.includes('runtime.readingProgressGet') && effectsSrc.includes('runtime.readingProgressUpdate'),
    'source switch must transfer the best available Core reading position to the final source');
  assert.ok(effectsSrc.includes('runtime.bookshelfAdd') && effectsSrc.includes('runtime.bookshelfRemove'),
    'source switch must persist the target shelf entry before replacing the old source key');
  const remoteShelfOpen = effectsSrc.slice(
    effectsSrc.indexOf('static openBookshelfBook'), effectsSrc.indexOf('private static localBookDetail'),
  );
  assert.ok(remoteShelfOpen.includes('runBookDetailFromPersistedSource(bookId, true, sourceId, sequence)') &&
    !remoteShelfOpen.includes('loadSourceSwitchCandidate'),
  'remote bookshelf reopen must restore its own persisted source progress, not enter the source-switch transaction');
  assert.ok(effectsSrc.includes('readPersistedReadingProgress') && effectsSrc.includes('persistedProgressTocPosition'),
    'remote reopen must resolve its exact Core progress row before choosing a TOC chapter');
  assert.ok(effectsSrc.includes('parseSourceSwitchCanonicalLocation') &&
    effectsSrc.includes('canonicalLocation.locationRevision'),
  'source switch must persist and publish Core canonicalLocation.locationRevision, never resolverVersion');
  assert.ok(effectsSrc.includes('sourceSwitchChapterTarget') && effectsSrc.includes('chapterTarget.matched ? progress'),
    'an unmatched source-switch TOC fallback must reset the old chapter anchor instead of applying it to another body');
  assert.ok(effectsSrc.includes('requireCurrentSourceSwitch(sequence)') &&
    effectsSrc.includes('cancelled source-switch target cleanup failed'),
  'cancelling an in-flight source switch must stop before old shelf removal and clean up a newly added target when possible');
  assert.ok(!effectsSrc.includes('const candidate = rawCandidates[0]'),
    'source switch must not silently use the first Core candidate from an ambiguous result');
  assert.ok(reducerSrc.includes("case 'source-switch-completed'") && reducerSrc.includes('beginSourceSwitch(state)'),
    'source switch route must remain open until the Core-backed replacement transaction completes');
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

test('bookshelf renders Core books or explicit loading and empty states', () => {
  const VS = readJson('view-state.fixtures.json');
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  const bookshelf = VS.find((e) => e.routeId === 'bookshelf' && e.pageState === 'default');
  assert.ok(bookshelf, 'bookshelf/default fixture missing');
  const continueCard = bookshelf.components.find((c) => c.type === 'ContinueReadingCard');
  assert.ok(continueCard, 'bookshelf route must retain the continue-reading placement');
  const shelf = bookshelf.components.find((c) => c.type === 'BookshelfShelfSection');
  const grid = shelf?.children.find((c) => c.type === 'BookGrid');
  const cards = grid?.children.filter((c) => c.type === 'BookCard') || [];
  assert.ok(cards.length > 0, 'bookshelf fixture must retain the demo card geometry input');
  for (const marker of [
    "@StorageProp('reader.bookshelfBooks')",
    "@StorageProp('reader.bookshelfLoaded')",
    "@StorageProp('reader.continueReadingBook')",
    "@StorageProp('reader.continueReadingLoaded')",
    "@StorageProp('reader.continueReadingError')",
    'BookshelfLoadingState()',
    'BookshelfEmptyState({ group: this.bookshelfGroup })',
    '正在从 Core 核验上次阅读位置。',
    '暂无可继续阅读的书籍',
    "type: 'bookshelf-book-open'",
  ]) {
    assert.ok(src.includes(marker), `BookshelfComponents missing Core-backed state marker ${marker}`);
  }
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  for (const marker of ['loadContinueReading()', "params['hasReadingProgress'] = true", 'readingProgressGet(candidate.bookId, candidate.sourceId)']) {
    assert.ok(effects.includes(marker), `continue-reading must use exact Core progress verification: ${marker}`);
  }
  assert.equal(src.includes('this.coreBooks[0]'), false,
    'continue-reading must not project the first current shelf row as reading progress');
  for (const fixtureMarker of ['private demoBooks:', 'useDemoFallback', 'bk-demo-', 'title: \'长夜余火\'']) {
    assert.equal(src.includes(fixtureMarker), false,
      `bookshelf must not fabricate fixture cards: ${fixtureMarker}`);
  }
});

test('protected source covers use Core descriptors, binary cache files, and the live cover-column setting', () => {
  const bookshelf = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  const detail = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookDetailComponents.ets'));
  const discover = read(path.join(REPO, 'entry/src/main/ets/ui/components/DiscoverComponents.ets'));
  const cover = read(path.join(REPO, 'entry/src/main/ets/ui/components/SourceCoverImage.ets'));
  const cache = read(path.join(REPO, 'entry/src/main/ets/host/adapters/SourceImageCache.ets'));
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const http = read(path.join(REPO, 'entry/src/main/ets/host/adapters/HttpHostAdapter.ets'));

  for (const src of [bookshelf, detail, discover]) {
    assert.ok(src.includes('SourceCoverImage'), 'every production shelf/detail/discover cover surface must use SourceCoverImage');
    assert.equal(src.includes('Image(this.coverUrl)'), false,
      'production cover surfaces must not hand a raw remote coverUrl to Image');
  }
  for (const marker of [
    "@StorageProp('reader.coverColumns')",
    'private columnsTemplate()',
    '.columnsTemplate(this.columnsTemplate())',
  ]) {
    assert.ok(bookshelf.includes(marker), `BookGrid must consume the real coverColumns setting: ${marker}`);
  }
  for (const marker of [
    'requestEpoch',
    'sourceImageRequest(this.sourceId, this.coverUrl)',
    'cache.beginLoad(descriptor.request)',
    'this.activeLoad.cancel()',
    'retry with the raw remote URL',
  ]) {
    assert.ok(cover.includes(marker), `SourceCoverImage missing protected-load guard: ${marker}`);
  }
  for (const marker of [
    "'source.imageRequest'",
    "params['sourceId']",
    "params['imageUrl']",
    'usePlatformCookieJar: true',
    'sourceImageCache',
  ]) {
    assert.ok(runtime.includes(marker), `CoreRuntime missing source.imageRequest host wrapper marker: ${marker}`);
  }
  const wrapper = runtime.slice(runtime.indexOf('async sourceImageRequest'), runtime.indexOf('/**\n   * Replay a source.check'));
  assert.equal(wrapper.includes("params['source']"), false,
    'source.imageRequest wrapper must not allow UI inline source payloads');
  for (const marker of [
    'requestInStream',
    "'headersReceive'",
    "'dataReceive'",
    "'dataEnd'",
    'SOURCE_IMAGE_MAX_BYTES',
    'SOURCE_IMAGE_CACHE_TTL_MILLIS',
    "reader-covers-v1",
    'cryptoFramework.createMd(\'SHA256\')',
    'fs.renameSync',
    'discardPart',
    'activePart.has(key)',
    'inFlight',
    'SharedSourceImageLoad',
    'file://',
  ]) {
    assert.ok(cache.includes(marker), `SourceImageCache missing binary/cache safety marker: ${marker}`);
  }
  for (const marker of ['mergeRequestHeader', 'mergeCookieHeader', 'toLowerCase()', 'usePlatformCookieJar']) {
    assert.ok(http.includes(marker), `HttpHostAdapter missing case-insensitive protected-header merge: ${marker}`);
  }
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

test('bookshelf management pages avoid fake batch fixed actions', () => {
  const shellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/LibraryShell.ets'));
  const structuralSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  assert.ok(!shellSrc.includes("this.routeId === 'book-batch-management'"),
    'Core has no batch selection mutation, so LibraryShell must not render a fake batch action bar');
  for (const text of ['移动分组', '删除所选', '新建分组']) {
    assert.ok(!shellSrc.includes(text), `LibraryShell must not retain dead batch action ${text}`);
  }
  assert.ok(shellSrc.includes("this.routeId === 'group-management'"), 'LibraryShell must gate group actions by route');
  assert.ok(shellSrc.includes("LibraryFixedActionButton({ label: '完成' })"),
    'the Core-backed group page may keep only its real completion action');
  assert.ok(shellSrc.includes('renderBottomActionBar()'), 'LibraryShell fixed actions must be rendered as a bottom action bar');
  assert.ok(shellSrc.includes('private actionBarHeight(): number'), 'LibraryShell bottom action bar must own its real safe-area height');
  assert.ok(!shellSrc.includes('renderBottomActionHost'), 'LibraryShell must not use the obsolete full-screen action host');
  assert.ok(!shellSrc.includes('.hitTestBehavior(HitTestMode.Transparent)'), 'LibraryShell fixed actions must not sit inside a full-screen transparent hit-test layer');
  assert.ok(structuralSrc.includes('批量操作未接入'), 'batch page must clearly expose the Core capability boundary');
  assert.ok(structuralSrc.includes('BookGroupCreateForm'), 'group creation must remain in the real Core-backed form');
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

test('ViewStateTable preserves nested props and context as lossless JSON values', () => {
  const vsTableSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  assert.ok(vsTableSrc.includes('export type ViewStateJSONValue = object | string | number | boolean | null;'));
  assert.ok(vsTableSrc.includes('context: Record<string, ViewStateJSONValue>;'));
  assert.ok(vsTableSrc.includes('uiEventPayload?: ViewStateJSONValue;'));
  assert.equal(vsTableSrc.includes('uiEventPayload?: string;'), false,
    'nested canonical payload must never be coerced to a string');
  assert.ok(vsTableSrc.includes('"context": {\n      "bookId": "bk-001"'),
    'generated table must retain canonical nested context');
  assert.ok(vsTableSrc.includes('"uiEventPayload": {'),
    'generated table must retain canonical nested payload objects');
  assert.ok(vsTableSrc.includes('static readonly ENTRIES: ViewStateEntry[] = JSON.parse(`'),
    'ArkTS embedding must parse typed canonical JSON instead of emitting untyped nested literals');
  assert.ok(vsTableSrc.includes("'raw-source-mutation'?: string;"),
    'non-identifier canonical prop names must be quoted in the ArkTS interface');
  assert.equal(vsTableSrc.includes('  raw-source-mutation?:'), false,
    'non-identifier canonical prop names must never generate invalid ArkTS syntax');
});

test('ScreenGraph registry is wired as Shadow and unknown renderer types fail closed visibly', () => {
  const routeRendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/router/RouteRenderer.ets'));
  const viewRendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const shadowSrc = read(path.join(REPO, 'entry/src/main/ets/ui/router/ReaderUIScreenGraphShadowRegistry.ets'));
  assert.ok(shadowSrc.includes("Shadow = 'Shadow'"), 'ScreenGraph consumer must remain Shadow');
  assert.ok(routeRendererSrc.includes('ReaderUIScreenGraphShadowRegistry.observeRoute('),
    'RouteRenderer must execute the generated registry lookup');
  assert.ok(viewRendererSrc.includes('ReaderUIScreenGraphShadowRegistry.observeViewState('),
    'ViewStateRenderer must execute component-tree parity lookup');
  assert.ok(routeRendererSrc.includes('UnknownRouteContractDrift'), 'unknown RouteId must fail closed visibly');
  assert.ok(viewRendererSrc.includes('Reader UI 组件契约漂移'), 'unknown ComponentType must fail closed visibly');
  assert.equal(viewRendererSrc.includes("} else {\n      Empty()\n    }"), false,
    'unknown ComponentType must not silently render Empty');
  assert.equal(shadowSrc.includes('Authoritative'), true,
    'source comment must keep the promotion boundary explicit');
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
  const hero = detailSrc.slice(
    detailSrc.indexOf('export struct BookHero'),
    detailSrc.indexOf('export struct BookSummaryCard')
  );
  for (const marker of [
    "@StorageProp('reader.currentBook')",
    '未选择书籍',
    '请从书架、搜索或发现结果打开一本书。',
    'currentBook.coverUrl',
    'Core 未返回本书简介。',
    '更换书源',
  ]) {
    assert.ok(detailSrc.includes(marker), `book-detail missing Core-backed state marker ${marker}`);
  }
  for (const fixtureMarker of ['长夜余火', '爱潜水的乌贼', '第 32 章 雨夜', '128.4 万', '悬疑 · 推理', '优书网', 'bookshelf_cover_long_night']) {
    assert.equal(hero.includes(fixtureMarker), false,
      `book-detail hero must not retain fabricated fallback content: ${fixtureMarker}`);
  }
  const chapterList = detailSrc.slice(detailSrc.indexOf('export struct BookChapterList'));
  assert.ok(chapterList.includes("@StorageProp('reader.chapterToc')"),
    'book-detail preview must bind the Core-backed chapter TOC');
  assert.ok(chapterList.includes("type: 'chapter-load'"),
    'book-detail preview rows must dispatch the selected real chapter');
  assert.ok(chapterList.includes('暂无从 Core 返回的章节目录'),
    'book-detail preview must expose a truthful empty state');
  assert.ok(!chapterList.includes('private chapters:'),
    'book-detail preview must not retain fixture chapters');
  assert.ok(detailSrc.includes("id: 'source-switch'"), 'book-detail source action must push the live demo source-switch route');
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
  const reducerSrc = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
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
  for (const src of [detailSrc, contractSrc, shellSrc]) {
    assert.ok(src.includes("route-push', id: 'immersive-reading'"),
      'reader entry actions must route to immersive-reading before opening the control layer');
  }
  assert.ok(bookshelfSrc.includes('readerEntry: true') &&
    bookshelfSrc.includes("coreBook.sourceId === 'local' ? 'local' : 'remote'"),
  'bookshelf continue must mark the one real book.open alias and preserve remote/local sourceKind');
  assert.ok(reducerSrc.includes("ReaderReducer.push(state, 'immersive-reading')"),
    'marked bookshelf reader entry must enter immersive-reading in the same native reducer pass');
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

test('discover source management exposes only Core-backed or explicitly unavailable actions', () => {
  const discoverSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/DiscoverComponents.ets'));
  const settingsShellSrc = read(path.join(REPO, 'entry/src/main/ets/ui/shells/SettingsShell.ets'));
  for (const marker of [
    "type: 'discover-source-cycle'",
    "id: 'source-management'",
    '发现源批量启停不可用',
    '当前 Core/Host 未提供书源批量启停命令',
  ]) {
    assert.ok(discoverSrc.includes(marker), `DiscoverComponents missing Core/unavailable source-management marker: ${marker}`);
  }
  assert.equal(discoverSrc.includes("id: 'discover-source-bulk'"), false,
    'DiscoverSourceBar must not route into the obsolete fixture bulk-enable page');
  assert.equal(settingsShellSrc.includes("this.routeId === 'discover-source-bulk'"), false,
    'SettingsShell must not render fake bulk enable/disable controls');
});

test('discover source login/rule routes are explicitly unavailable, never fake workflows', () => {
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
    '书源登录流程不可用',
    '发现规则编辑与测试不可用',
    '未暴露书源登录态协商能力',
    '未接入规则编辑或调试写入能力',
  ]) {
    assert.ok(discoverSrc.includes(text), `DiscoverComponents missing unavailable-state copy: ${text}`);
  }
  for (const fixtureText of [
    '轻小说文库',
    '打开网页登录',
    '保存登录信息',
    '测试入口',
    '解析到 18 本书',
  ]) {
    assert.equal(discoverSrc.includes(fixtureText), false,
      `DiscoverComponents must not retain fake source login/rule content: ${fixtureText}`);
  }
});

test('discover main tab is sourced only from persisted Core source.explore data', () => {
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const state = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiState.ets'));
  const components = read(path.join(REPO, 'entry/src/main/ets/ui/components/DiscoverComponents.ets'));
  const topBar = read(path.join(REPO, 'entry/src/main/ets/ui/components/SharedComponents.ets'));
  for (const marker of [
    'sourceList(true)',
    'sourceExploreKinds',
    'sourceExplore(source.sourceId',
    'enabledExplore === true',
    'discover-data-loaded',
    'mapDiscoverKinds',
    'mapDiscoverBooks',
  ]) {
    assert.ok(effects.includes(marker) || runtime.includes(marker),
      `Discover effects/runtime missing persisted-Core marker: ${marker}`);
  }
  for (const marker of [
    'CoreDiscoverKind',
    'CoreDiscoverBook',
    'discoverSourceId',
    'discoverKindUrl',
    'discoverBooks',
  ]) {
    assert.ok(state.includes(marker), `Discover state missing ${marker}`);
  }
  for (const marker of [
    "type: 'book-detail-load', bookId: this.bookUrl, sourceId: this.sourceId",
    "type: 'discover-kind-select', discoverKindUrl: kind.url",
    "type: 'discover-refresh'",
  ]) {
    assert.ok(components.includes(marker), `Discover UI missing live Core action: ${marker}`);
  }
  assert.ok(topBar.includes("ReaderUiStore.dispatch({ type: 'discover-refresh' })"),
    'Discover top-bar action must refresh Core data rather than open a fixture sort route');
  for (const fixtureText of ['默认书源', "'排行榜'", "['三体'", '球状闪电']) {
    assert.equal(components.includes(fixtureText), false,
      `Discover main tab must not retain fixed demo data: ${fixtureText}`);
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
    'RssCoreFilterControls',
    '正在刷新启用订阅源…',
    'Web({ src: this.normalizedUrl(), controller: this.controller })',
    'registerController(RSS_ORIGINAL_WEB_PROFILE, this.controller)',
    'unregisterController(RSS_ORIGINAL_WEB_PROFILE)',
    'RSS 收藏分组未接入',
    '当前 Core 无 RSS 订阅源分组契约',
    '当前 Core 无 RSS 批量导入契约',
    '当前 Core 无 RSS 规则订阅',
    '前往订阅管理',
  ]) {
    assert.ok(rssSrc.includes(text), `RssComponents missing truthful RSS subpage copy: ${text}`);
  }
  assert.equal(rssSrc.includes('当前 Host 未注册可用 WebView 控制器，原文打开已禁用。'), false,
    'RSS original must not retain the obsolete unregistered-WebView placeholder');
  for (const fixtureText of [
    '正在刷新启用订阅源和分类入口',
    'Reader UI 前端输入件更新说明',
    'github.com/minliny/Reader-UI/releases/latest',
    '技术文章',
    '开源项目',
    '选择导入方式',
    '调试规则',
    '保存排序',
  ]) {
    assert.equal(rssSrc.includes(fixtureText), false,
      `RssComponents must not retain fabricated RSS subpage content: ${fixtureText}`);
  }
});

test('rss-starred fails closed instead of projecting all Core articles as favorites', () => {
  const tableSrc = read(path.join(GEN, 'ViewStateTable.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const rssSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/RssComponents.ets'));
  const starredStart = tableSrc.indexOf('"routeId": "rss-starred"');
  const starredEnd = tableSrc.indexOf('"routeId": "rss-original-browser"', starredStart);
  const starredEntry = tableSrc.slice(starredStart, starredEnd);

  assert.ok(starredStart >= 0 && starredEnd > starredStart,
    'rss-starred must retain a generated route body to protect at runtime');
  assert.ok(starredEntry.includes('"type": "RssArticleSection"'),
    'the current Reader UI fixture is the all-items-shaped input guarded by the native renderer');
  assert.ok(rendererSrc.includes("if (this.routeId !== 'rss-starred') return components;"),
    'ViewStateRenderer must scope the favorite capability fence to rss-starred');
  assert.ok(rendererSrc.includes("component.type === 'RssArticleSection'"),
    'ViewStateRenderer must replace the all-items body instead of rendering it as favorites');
  assert.ok(rendererSrc.includes("type: 'RssFavoritesUnavailablePage'"),
    'ViewStateRenderer must resolve rss-starred to the truthful page component');
  assert.ok(rendererSrc.includes("component.type === 'RssFavoritesUnavailablePage'"),
    'truthful RSS favorites component must be renderable after route resolution');
  assert.ok(rssSrc.includes('export struct RssFavoritesUnavailablePage'),
    'RSS favorites must have a dedicated unavailable page');
  assert.ok(rssSrc.includes('RSS 收藏未接入') && rssSrc.includes('当前 Core 无 RSS 收藏契约'),
    'RSS favorites unavailable page must explain the missing Core capability');
});

test('SearchInputBox synchronizes submitted query without replacing an active draft', () => {
  const components = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));
  const start = components.indexOf('export struct SearchInputBox');
  const end = components.indexOf('export struct ScopeSelector', start);
  const searchInput = components.slice(start, end);

  assert.ok(searchInput.includes("@Prop @Watch('syncQueryFromProp') query: string = '';"),
    'SearchInputBox must observe external submitted-query updates');
  assert.ok(searchInput.includes('aboutToAppear(): void') && searchInput.includes('this.syncQueryFromProp();'),
    'SearchInputBox must initialize from a passed query when the route appears');
  assert.ok(searchInput.includes('if (this.isEditing) return;'),
    'SearchInputBox must not overwrite an active native input draft');
  assert.ok(searchInput.includes('this.query === this.lastSynchronizedQuery && this.hasLocalDraft'),
    'SearchInputBox must retain an unsubmitted draft after focus is released');
  assert.ok(searchInput.includes('.onFocus(() => { this.isEditing = true; })'),
    'SearchInputBox must mark the draft active on focus');
  assert.ok(searchInput.includes('.onBlur(() => {') && searchInput.includes('this.isEditing = false;'),
    'SearchInputBox must resume external-query synchronization after blur');
  assert.ok(searchInput.includes('TextInput({ text: this.queryText, placeholder: this.placeholder })'),
    'SearchInputBox must render the synchronized local text value');
});

test('rss item selection projects Core fields into a truthful detail page', () => {
  const rssSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/RssComponents.ets'));
  const detailSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  const projectionSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/RssSelectionProjection.ets'));
  const rendererSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const effectsSrc = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const stateSrc = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiState.ets'));

  assert.ok(rssSrc.includes('RssSelectionProjection.write(a);'),
    'clicking a Core RSS row must write the UI-owned selected-item projection before routing');
  assert.ok(rssSrc.includes("type: 'rss-item-open'"),
    'clicking a Core RSS row must retain the Core read-confirmation action');
  for (const marker of [
    'K_TITLE',
    'K_DESCRIPTION',
    'K_AUTHOR',
    'K_DATE',
    'K_LINK',
    'K_SUBSCRIPTION_ID',
    'item.title',
    'item.description',
    'item.author',
    'item.pubDate',
    'item.link',
    'item.subscriptionId',
  ]) {
    assert.ok(projectionSrc.includes(marker), `RSS selection projection missing Core field ${marker}`);
  }
  for (const marker of [
    '@StorageProp(RssSelectionProjection.K_TITLE)',
    '@StorageProp(RssSelectionProjection.K_DESCRIPTION)',
    '@StorageProp(RssSelectionProjection.K_AUTHOR)',
    '@StorageProp(RssSelectionProjection.K_DATE)',
    '@StorageProp(RssSelectionProjection.K_LINK)',
    '@StorageProp(RssSelectionProjection.K_SUBSCRIPTION_ID)',
    '未选择 RSS 条目',
    'Core 未提供原文链接。',
    '在应用内打开原文',
    'isSafeRssOriginalUrl(this.selectedLink)',
    "id: 'rss-original'",
  ]) {
    assert.ok(detailSrc.includes(marker), `RssDetailPage missing truthful selected-item marker ${marker}`);
  }
  const detailPage = detailSrc.slice(detailSrc.indexOf('export struct RssDetailPage'), detailSrc.indexOf('export struct RssEmptyState'));
  assert.equal(detailPage.includes('深空信号'), false,
    'RssDetailPage must not use a fixed demo article when no Core item is selected');
  assert.ok(rendererSrc.includes("} else if (component.type === 'RssDetailPage') {\n      RssDetailPage()"),
    'ViewStateRenderer must not pass a fixture title into the Core-selected detail page');
  assert.ok(rssSrc.includes('getWebViewAdapter'),
    'RSS original must register its real ArkUI controller with the Host adapter');
  assert.ok(rssSrc.includes('Web({ src: this.normalizedUrl(), controller: this.controller })'),
    'RSS original must use an in-app ArkUI Web page rather than an external-browser placeholder');
  assert.ok(rssSrc.includes('isSafeRssOriginalUrl'),
    'RSS original must validate the Core link before constructing Web');
  assert.ok(rssSrc.includes('unregisterController(RSS_ORIGINAL_WEB_PROFILE)'),
    'RSS original must unregister the controller on route disappearance');
  assert.ok(stateSrc.includes('read: boolean;'),
    'RSS item state must retain the Core read projection');
  assert.ok(effectsSrc.includes("params['unreadOnly'] = unreadOnly;"),
    'RSS all/unread controls must issue the matching Core request filter');
  assert.equal(effectsSrc.includes("params['limit'] = 50"), false,
    'RSS all-items must not truncate Core cache rows to a fixed visual limit');
  assert.ok(effectsSrc.includes("read: booleans['read'] === true"),
    'RSS item mapping must preserve Core read state for the all-items view');
});

test('source tool routes render Core-backed results or explicit unavailable states', () => {
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
    ['source-test-result/default', ['BackTopBar', 'SourceTestResultPage']],
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
    "@StorageProp('reader.sourceCheckResult')",
    'CoreSourceCheckResult',
    'Core L1–L5 真实诊断结果',
    'L1 · 书源存在性',
    'Core 未返回诊断结果',
    '重新运行真实诊断',
    "type: 'source-debug-run'",
    '真实书源调测',
    'L4/L5 多页会明确标为有限回放',
    '不会展示或缓存 Host 响应正文',
    '书源批量启停未接入',
    '书源规则编辑未接入',
    'Core source.delete',
    '不会展示演示书源、固定成功状态、伪造请求日志',
  ]) {
    assert.ok(sourceSrc.includes(text), `LibraryComponents missing Core-backed source tool marker: ${text}`);
  }
  for (const staleFixture of [
    '5 项检测 · 4 项通过 · 1 项失败',
    '笔趣阁 · 第 128 章 风雨夜',
    '正在调测正文模块',
    '搜索模块调测',
    '正文模块日志',
    '解析 1280 章',
    '已选 3 个',
    '搜索书源名称或域名',
  ]) {
    assert.equal(sourceSrc.includes(staleFixture), false,
      `LibraryComponents must not retain static source diagnostic fixture: ${staleFixture}`);
  }

  const sourceEffects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const sourceRuntime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  assert.ok(sourceEffects.includes('runtime.sourceCheckRun('),
    'SourceDetect must execute Core source.check.run rather than a local or replayed diagnostic');
  assert.ok(sourceEffects.includes('if (!source.enabled)'),
    'SourceDetect must fail closed before diagnosing a disabled persisted source');
  assert.ok(sourceEffects.includes('validateFullSourceCheckRunResult'),
    'SourceDetect must fail closed when Core does not return a complete L1-L5 verdict');
  assert.equal(sourceEffects.includes("type: 'source-check-unavailable'"), false,
    'SourceDetect must no longer fall back to a missing-Host unavailable state');
  const sourceCheckRunStart = sourceRuntime.indexOf('async sourceCheckRun(');
  assert.ok(sourceCheckRunStart >= 0, 'CoreRuntime must expose a source.check.run wrapper');
  const sourceCheckRunEnd = sourceRuntime.indexOf('\n  /**', sourceCheckRunStart + 1);
  const sourceCheckRun = sourceRuntime.slice(sourceCheckRunStart,
    sourceCheckRunEnd >= 0 ? sourceCheckRunEnd : sourceRuntime.length);
  assert.ok(sourceCheckRun.includes("'source.check.run'"),
    'source.check.run wrapper must use the Core diagnostic command');
  assert.equal(sourceCheckRun.includes('responses'), false,
    'source.check.run wrapper must not accept replay response bodies');
  assert.ok(sourceRuntime.includes('SourceDebugTranscriptRecorder') &&
    sourceRuntime.includes('sourceDebugRecordersByTraceAndSource') &&
    sourceRuntime.includes('async sourceDebugRun(') &&
    sourceRuntime.includes("this.runtime.request('source.debug'"),
  'SourceDebug must attach a private trace/source recorder to the real source.check.run Host path and replay only through Core');
  assert.ok(sourceRuntime.includes('ReaderCoreRuntime.waitForResult()') &&
    sourceRuntime.includes('the sole native-event consumer'),
  'SourceDebug must preserve the request waiter as the only Core result consumer');
  assert.ok(sourceEffects.includes('runtime.sourceDebugRun(') &&
    sourceEffects.includes('mapSourceDebugResult') &&
    sourceEffects.includes('sourceDebugRequestSequence'),
  'SourceDebug UI effect must use the isolated Core transaction projection and reject stale runs');
  assert.ok(sourceEffects.includes('validateFullSourceCheckRunResult(rawCheck)') &&
    sourceEffects.includes('调测日志仅重放已收集响应，不代表书源可用'),
  'SourceDebug must not interpret a partial replay as a source availability success');

  const structuralSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    "@StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = []",
    "@StorageProp('reader.selectedSourceId') selectedSourceId: string = ''",
    "type: 'source-detail-open'",
    "type: 'source-export'",
    "type: 'source-delete-request'",
    '运行真实调测',
    "id: 'source-debug'",
    '粘贴一个 Legado BookSource JSON 对象或对象数组。',
    "type: 'source-package-import-json'",
    "type: 'source-package-import-url'",
    "type: 'source-package-import-clipboard'",
    '从 URL 下载并导入',
    'Core 尚未定义的连通性检测或启停操作。',
    'SourceDetectPage()',
  ]) {
    assert.ok(structuralSrc.includes(text), `StructuralPageComponents missing live source detail/import copy: ${text}`);
  }

  const importEffects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const importRuntime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const importState = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiState.ets'));
  const importResultPage = read(path.join(REPO, 'entry/src/main/ets/ui/components/LibraryComponents.ets'));
  for (const marker of [
    'runtime.sourceImport(bookSource)',
    "this.runtime.request('source.import'",
    'CoreRuntime.get().sourceList(false)',
    "type: 'source-package-import-result'",
    "resultFields['imported'] === true",
    'sourceImportImported: number',
    'sourceImportSkipped: number',
    'sourceImportFailed: number',
    "@StorageProp('reader.sourceImportImported')",
    "@StorageProp('reader.sourceImportFailed')",
    'Core 返回的逐项统计',
  ]) {
    const present = importEffects.includes(marker) || importRuntime.includes(marker) ||
      importState.includes(marker) || importResultPage.includes(marker);
    assert.ok(present, `Core-backed source import is missing ${marker}`);
  }
  assert.ok(importEffects.includes("if (resultFields['imported'] === true)"),
    'source package import must only count Core-confirmed imports as successful');
  assert.ok(importEffects.includes('skipped += 1'),
    'source package import must expose non-imported/malformed entries as skipped rather than faking success');
  assert.ok(importState.includes('sourceImportEpoch: number') &&
    importEffects.includes('claimSourcePackageImport') && importEffects.includes('isCurrentSourcePackageImport'),
  'source package import must bind every Core write to a visible-route epoch claim');
  assert.ok(importEffects.indexOf("type: 'source-package-import-result'") <
    importEffects.indexOf("type: 'route-push', id: 'source-import-preview'"),
  'source package import must record the Core result before navigating to its preview');
  assert.equal(structuralSrc.includes("StructureCard({ title: this.title, message: '搜索、目录、正文规则均正常。'"), false,
    'source-detail must not regress to the old one-card placeholder');
  assert.equal(structuralSrc.includes("StatePanel({ title: '导入书源'"), false,
    'source-import-options must not regress to the old StatePanel placeholder');
});

test('normal remote reading uses only persisted Core source IDs', () => {
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const searchPanel = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));
  const remoteStart = effects.indexOf('// ── Search');
  const remoteEnd = effects.indexOf('// ── HTTP helper');
  const remotePath = effects.slice(remoteStart, remoteEnd);
  assert.ok(remoteStart >= 0 && remoteEnd > remoteStart,
    'ReaderEffects must retain a bounded normal remote-reading section');
  for (const marker of [
    'bookSearchFromSource',
    'bookDetailFromSource',
    'bookTocFromSource',
    'chapterContentFromSource',
    'sourceList(true)',
    '没有已启用的 Core 书源',
  ]) {
    assert.ok(remotePath.includes(marker) || runtime.includes(marker),
      `normal remote path must retain persisted-Core marker ${marker}`);
  }
  assert.equal(remotePath.includes('BookSourceRegistry'), false,
    'normal remote path must not import a yodu/demo source fallback');
  assert.equal(remotePath.includes('httpGet('), false,
    'normal remote path must not bypass Core with UI-owned direct HTTP');
  assert.ok(searchPanel.includes("sourceId: r.sourceId ?? ''"),
    'a Core search row must carry its sourceId into book.detail');
});

test('local book import preserves raw bytes and projects Core-detected encoding', () => {
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const state = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiState.ets'));
  const reducer = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
  const store = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderUiStore.ets'));
  const fixture = read(path.join(REPO, 'entry/src/main/ets/ui/fixtures/DemoUiState.ets'));
  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  const importStart = effects.indexOf('static runLocalImport(');
  const importEnd = effects.indexOf('// Detect import format from file extension.', importStart);
  const importPath = effects.slice(importStart, importEnd);
  const pageStart = structural.indexOf('export struct LocalBookImportPage');
  const pageEnd = structural.indexOf('export struct ReadingSettingsEntryPage', pageStart);
  const localImportPage = structural.slice(pageStart, pageEnd);

  assert.ok(importStart >= 0 && importEnd > importStart,
    'ReaderEffects must retain a bounded local-import effect');
  assert.ok(importPath.includes('options.bytesBase64 = base64Helper.encodeToStringSync(bytes);'),
    'local import must pass original bytes to Core for every format');
  assert.equal(importPath.includes('TextDecoder.create'), false,
    'local import must not pre-decode TXT as UTF-8 before Core can detect GBK/GB18030/UTF-16');
  assert.equal(importPath.includes('options.text ='), false,
    'local import must not send a lossy host-decoded text payload');
  assert.ok(importPath.includes('ReaderEffects.pendingLocalBookOptions = options'),
    'confirmed import must reuse exactly the raw-byte options parsed by Core');
  assert.ok(importPath.includes("importEncoding: parsedEncoding"),
    'local import preview must dispatch the encoding returned by Core');
  for (const marker of [
    'importPreviewEncoding: string',
    'importEncoding?: string',
    "K_IMPORT_PREVIEW_ENCODING = 'reader.importPreviewEncoding'",
    'next.importPreviewEncoding = encoding',
    'next.importPreviewEncoding = \'\'',
    'importPreviewEncoding: \'\'',
    "@StorageProp('reader.importPreviewEncoding')",
    'GBK/GB18030（自动识别）',
    'UTF-16LE',
    'UTF-16BE',
  ]) {
    const present = state.includes(marker) || reducer.includes(marker) || store.includes(marker) ||
      fixture.includes(marker) || localImportPage.includes(marker);
    assert.ok(present, `local import encoding projection is missing ${marker}`);
  }
  assert.equal(localImportPage.includes("Text('UTF-8')"), false,
    'local import page must not hardcode UTF-8 instead of Core-detected encoding');
});

test('source-management uses live list-management structure, not old tool hub', () => {
  const VS = readJson('view-state.fixtures.json');
  const entry = VS.find((e) => e.routeId === 'source-management' && e.pageState === 'default');
  assert.ok(entry, 'source-management/default fixture missing');
  assert.deepEqual(entry.components.map((c) => c.type), ['BackTopBar', 'SourceManagementPage'],
    'source-management/default must use the source management page-level component');

  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  for (const text of [
    "@StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = []",
    "@StorageProp('reader.sourcesLoaded') sourcesLoaded: boolean = false",
    '正在读取 Core 书源…',
    '暂无书源，请使用右下角“新增书源”导入',
    "type: 'source-management-refresh'",
    "type: 'source-export'",
    "type: 'source-delete-request'",
  ]) {
    assert.ok(structural.includes(text), `SourceManagementPage missing live source-management copy: ${text}`);
  }
  for (const fixtureSource of ['起点中文网', '笔趣阁', '本地导入源', '纵横中文网']) {
    assert.equal(structural.includes(`title: '${fixtureSource}'`), false,
      `SourceManagementPage must not fabricate fixture source ${fixtureSource}`);
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
    'Core 数据备份',
    '本机 Core 数据备份',
    '创建本机备份',
    '从备份文件恢复',
    '确认原子恢复 Core 数据',
    '恢复范围',
    '开始原子恢复',
    'Core 正在原子恢复',
    '没有可选择的伪冲突项',
    'Core 数据恢复完成',
    'Core 与 Host 返回的事务结果',
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

test('legacy search, book-more, and about pages render only live state or explicit unavailable states', () => {
  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  const renderer = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const searchHome = structural.slice(
    structural.indexOf('export struct SearchHomePage'),
    structural.indexOf('export struct SearchResultsPage')
  );
  const searchResults = structural.slice(
    structural.indexOf('export struct SearchResultsPage'),
    structural.indexOf('export struct SearchStatePage')
  );
  const bookMore = structural.slice(
    structural.indexOf('export struct BookMoreMenuPage'),
    structural.indexOf('struct BookGroupCreateForm')
  );
  const aboutVersion = structural.slice(
    structural.indexOf('export struct AboutVersionPage'),
    structural.indexOf('export struct AboutFeedbackPage')
  );
  const aboutFeedback = structural.slice(
    structural.indexOf('export struct AboutFeedbackPage'),
    structural.indexOf('export struct LocalBookImportPage')
  );
  const restoreResult = structural.slice(
    structural.indexOf('export struct RestoreResultPage'),
    structural.indexOf('export struct GlobalSettingsPage')
  );
  const syncProgress = structural.slice(
    structural.indexOf('export struct SyncProgressPage'),
    structural.indexOf('export struct RemoteWebDavBooksPage')
  );

  for (const component of [searchHome, searchResults]) {
    assert.ok(component.includes("@StorageProp('reader.searchResults')"),
      'legacy search pages must bind the reducer-backed Core search projection');
    assert.ok(component.includes('SearchInputBox('),
      'legacy search pages must expose the existing reducer-backed search input');
  }
  for (const marker of [
    'SearchResultEntry',
    "type: 'book-detail-load', bookId: result.bookId, sourceId: result.sourceId ?? ''",
    '暂无搜索结果',
    'Core 未提供作者或书源信息。',
  ]) {
    assert.ok(searchResults.includes(marker), `legacy search results missing real-data marker ${marker}`);
  }
  for (const fixtureText of ['深空信号', '可加入书架', 'private results:']) {
    assert.equal(searchHome.includes(fixtureText) || searchResults.includes(fixtureText), false,
      `legacy search pages must not retain fixture result data: ${fixtureText}`);
  }

  for (const marker of [
    "@StorageProp('reader.currentBook')",
    '未选择书籍',
    "type: 'book-action', bookAction: 'delete'",
    '当前书籍缺少可用于移出书架的 Core 书源标识。',
  ]) {
    assert.ok(bookMore.includes(marker), `BookMoreMenuPage missing truthful action/state marker ${marker}`);
  }
  for (const fixtureText of ['深空信号', '本地书籍', '下载 / 缓存', '重新扫描', '移动分组', 'private actions:']) {
    assert.equal(bookMore.includes(fixtureText), false,
      `BookMoreMenuPage must not retain fabricated book menu entry: ${fixtureText}`);
  }

  assert.ok(aboutVersion.includes('版本信息未接入') && aboutVersion.includes('不能显示固定版本号'),
    'AboutVersionPage must not claim a fixture package version');
  assert.ok(aboutFeedback.includes('关于与反馈未接入') && aboutFeedback.includes('不显示“已是最新”或可点击的伪链接'),
    'AboutFeedbackPage must not claim unowned update or feedback capabilities');
  assert.equal(aboutVersion.includes('Reader for Android'), false,
    'AboutVersionPage must not retain a fixed foreign platform name');
  assert.equal(aboutFeedback.includes("detail: '已是最新'"), false,
    'AboutFeedbackPage must not retain a fabricated update result');

  assert.ok(restoreResult.includes("@StorageProp('reader.coreBackupStatus')") &&
    restoreResult.includes("@StorageProp('reader.coreBackupMessage')") &&
    restoreResult.includes("this.status === 'success' ? 'Core 数据恢复完成'") &&
    restoreResult.includes('Core 与 Host 返回的事务结果'),
    'RestoreResultPage must show only the actual Core/Host restore transaction projection');
  assert.ok(syncProgress.includes('同步状态未接入') && syncProgress.includes('不能显示固定书籍、百分比或同步成功'),
    'SyncProgressPage must not fabricate a book-level sync result');
  assert.equal(restoreResult.includes("chip: '成功'"), false,
    'RestoreResultPage must not retain fixed successful-result rows');
  assert.equal(syncProgress.includes('深空信号'), false,
    'SyncProgressPage must not retain a fixed synced book');

  for (const marker of [
    "} else if (component.type === 'SearchResultsPage') {\n      SearchResultsPage()",
    "} else if (component.type === 'BookMoreMenuPage') {\n      BookMoreMenuPage()",
    "} else if (component.type === 'AboutVersionPage') {\n      AboutVersionPage()",
  ]) {
    assert.ok(renderer.includes(marker), `ViewStateRenderer must not inject fixture data into ${marker}`);
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
    '跨设备进度同步未接入',
  ]) {
    assert.ok(settingsSrc.includes(text), `SettingsComponents missing page-level copy/wiring: ${text}`);
  }

  const bookshelfSrc = read(path.join(REPO, 'entry/src/main/ets/ui/components/BookshelfComponents.ets'));
  for (const text of ['BookshelfFilterPopover', '分组', '最近阅读', '全部（Core 未提供状态筛选）']) {
    assert.ok(bookshelfSrc.includes(text), `BookshelfComponents missing sort-filter popover copy: ${text}`);
  }
  assert.equal(bookshelfSrc.includes("value: 'progress'"), false,
    'sort-filter must not offer a fake progress sort when Core exposes only last-read time');

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
    '批量操作未接入',
    '书籍归属',
    'https://example.com',
  ]) {
    assert.ok(structural.includes(text), `StructuralPageComponents missing handoff text: ${text}`);
  }
  const tocPreview = structural.slice(
    structural.indexOf('export struct BookTocPreviewPage'),
    structural.indexOf('export struct BookshelfEmptyPage')
  );
  const directory = structural.slice(
    structural.indexOf('export struct BookDirectoryPage'),
    structural.indexOf('export struct SourceManagementPage')
  );
  for (const component of [tocPreview, directory]) {
    assert.ok(component.includes("@StorageProp('reader.chapterToc')"),
      'structural directory pages must bind the Core-backed chapter TOC');
    assert.ok(component.includes("type: 'chapter-load'"),
      'structural directory rows must dispatch the selected real chapter');
    assert.ok(component.includes('暂无从 Core 返回的章节目录'),
      'structural directory pages must expose a truthful empty state');
  }
  assert.ok(!tocPreview.includes('第6章：深空信号'),
    'TOC preview must not retain fixture chapter rows');
  assert.ok(!directory.includes('第 34 章 旧地图'),
    'book directory must not retain fixture chapter rows');
  assert.ok(
    structural.includes('constraintSize({ minHeight: 640 })'),
    'StatePanel must match .reader-state-page min-height 640'
  );
});

// ── 7. Live demo route → ViewState coverage guard ──────────────────────────
// Reader-UI/frontend-demo is the route/rendering source. Every route rendered
// by render-runtime.js must have a ViewState entry OR an aliasFor declaration.
// PENDING_LIVE_DEMO_ROUTES is the explicit allowlist of routes not yet covered;
// it MUST be empty before declaring full migration. A route missing from both
// coverage AND PENDING_LIVE_DEMO_ROUTES is a hard FAIL (regression / scope gap).
const ROUTES_JSON = readJson('route.fixtures.json');
const VIEW_STATES_JSON = readJson('view-state.fixtures.json');
const VS_ROUTE_IDS = new Set(VIEW_STATES_JSON.map((v) => v.routeId));
const ALIAS_MAP = new Map(ROUTES_JSON.filter((r) => r.aliasFor).map((r) => [r.id, r.aliasFor]));
// Reader UI 2.5 additions are direct generated ViewStates rather than rows in
// the older JSON fixture. They are covered only when the exact unavailable
// registry entry exists; this is not a blanket exemption.
const CONTRACT25_ROUTE_IDS = new Set(
  [...read(path.join(REPO, 'entry/src/main/ets/ui/router/ReaderContract25RouteRegistry.ets'))
    .matchAll(/unavailableRouteDefinition\('([^']+)'/g)]
    .map((match) => match[1]),
);
const LIVE_DEMO_ROUTES = liveDemoRouteTuples();

// Routes acknowledged as not-yet-migrated. Remove a route here ONLY when it has
// a ViewState entry or aliasFor declaration. Must be empty before full migration.
const PENDING_LIVE_DEMO_ROUTES = new Set([]);

test('live demo routes each have ViewState or alias or are in PENDING allowlist', () => {
  const missing = [];
  for (const [pageName, routeId] of LIVE_DEMO_ROUTES) {
    const hasVs = VS_ROUTE_IDS.has(routeId);
    const hasAlias = ALIAS_MAP.has(routeId);
    const hasContract25 = CONTRACT25_ROUTE_IDS.has(routeId);
    const isPending = PENDING_LIVE_DEMO_ROUTES.has(routeId);
    if (!hasVs && !hasAlias && !hasContract25 && !isPending) {
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
  // R16 direct import state variants intentionally use canonical state
  // primitives. Registry availability is not pixel-completion evidence.
  'import-format-unsupported', 'import-empty-file', 'import-parsing',
  'import-partial-success', 'import-result-detail',
  // Reader UI 3.0 publishes this list surface as an explicit planned,
  // fail-closed structure rather than a production-complete bespoke page.
  'chapter-reviews',
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

test('destructive source, shelf, group, cache, restore, bookmark, history, RSS, and replacement paths require a live target plus confirmation', () => {
  const effects = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderEffects.ets'));
  const reducer = read(path.join(REPO, 'entry/src/main/ets/ui/store/ReaderReducer.ets'));
  const sourcePage = read(path.join(REPO, 'entry/src/main/ets/ui/components/LibraryComponents.ets'));
  const structural = read(path.join(REPO, 'entry/src/main/ets/ui/components/StructuralPageComponents.ets'));
  const overlay = read(path.join(REPO, 'entry/src/main/ets/ui/slots/OverlayHost.ets'));
  const renderer = read(path.join(REPO, 'entry/src/main/ets/ui/components/ViewStateRenderer.ets'));
  const replacePanel = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const contract = read(path.join(REPO, 'entry/src/main/ets/ui/components/ContractComponents.ets'));
  const settings = read(path.join(REPO, 'entry/src/main/ets/ui/components/SettingsComponents.ets'));

  for (const marker of [
    "case 'source-delete-request'", 'requestSourceDelete', "case 'source-delete-confirm'",
    'confirmSourceDelete', 'deleteConfirmedSource', 'rejectUnconfirmedSourceDelete',
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `source delete confirmation fence missing ${marker}`);
  }
  assert.ok(sourcePage.includes("type: 'source-delete-confirm'"),
    'SourceDeleteConfirmPage must be the only page that grants the Core source delete');
  assert.ok(structural.includes("type: 'source-delete-request'"),
    'normal source rows must request a confirmation route instead of deleting directly');
  assert.equal(structural.includes("type: 'source-delete', sourceId:"), false,
    'normal source UI must not dispatch raw source-delete');
  assert.ok(effects.includes("case 'source-delete':\n        ReaderEffects.rejectUnconfirmedSourceDelete();"),
    'legacy raw source-delete must fail closed rather than reaching Core');

  assert.equal(overlay.includes("bookAction: 'delete'"), false,
    'shelf top-more must not delete a stale reader.currentBook');
  for (const marker of [
    "pendingBookshelfRemovalSourceId", "pendingBookshelfRemovalBookId",
    "type: 'bookshelf-remove-confirm'", 'Core bookshelf.remove',
  ]) {
    assert.ok(overlay.includes(marker), `shelf confirmation overlay missing ${marker}`);
  }
  assert.ok(effects.includes('removeConfirmedBookshelfBook') &&
    effects.includes('BOOKSHELF_REMOVE_CONFIRM_REQUIRED'),
    'bookshelf Core mutation must validate the exact visible confirmation target');

  for (const marker of [
    "case 'book-group-delete-request'", "case 'book-group-delete-confirm'",
    'requestBookGroupDelete', 'confirmBookGroupDelete',
    'pendingBookGroupDeleteId', 'deleteConfirmedBookGroup',
    'refreshBookGroupsAfterDeleteFailure', "fields['deleted'] !== true",
    "type: 'book-group-delete-cancel'", "type: 'book-group-delete-confirm'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || structural.includes(marker),
      `book-group delete confirmation fence missing ${marker}`);
  }
  assert.ok(structural.includes('确认删除“${this.group.groupName}”？') &&
    structural.includes("type: 'book-group-delete-request'"),
    'book-group row must visibly bind a live target before displaying confirmation');
  assert.equal(structural.includes("type: 'book-group-delete', bookGroupId:"), false,
    'book-group row must not dispatch the raw delete event');
  assert.ok(reducer.includes("case 'book-group-delete':\n        return ReaderReducer.setBookGroupsError"),
    'raw book-group-delete must fail closed in the reducer');
  for (const marker of [
    "case 'book-group-clear-request'", "case 'book-group-clear-confirm'",
    'requestBookGroupClear', 'confirmBookGroupClear', 'clearConfirmedBookshelfGroup',
    'pendingBookGroupClearSourceId', "type: 'book-group-clear-cancel'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || structural.includes(marker),
      `book-group clear confirmation fence missing ${marker}`);
  }
  assert.equal(structural.includes("this.assign('')"), false,
    'group clear UI must not dispatch the direct empty-group mutation');
  for (const marker of [
    'requestBookGroupUpdate', 'hasLiveBookGroup', 'isBookGroupManagementRoute',
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `book-group update must bind a current management row: missing ${marker}`);
  }

  for (const marker of [
    "case 'bookmark-delete-request'", "case 'bookmark-delete-confirm'",
    'requestBookmarkDelete', 'confirmBookmarkDelete', 'deleteConfirmedBookmark',
    'pendingBookmarkDeleteTime', 'refreshBookmarksAfterDeleteFailure',
    "type: 'bookmark-delete-cancel'", "type: 'bookmark-delete-confirm'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || structural.includes(marker) || replacePanel.includes(marker),
      `bookmark delete confirmation fence missing ${marker}`);
  }
  assert.equal(structural.includes("type: 'bookmark-delete', bookmarkTime:"), false,
    'directory bookmark row must not dispatch raw bookmark-delete');
  assert.equal(replacePanel.includes("type: 'bookmark-delete', bookmarkTime:"), false,
    'reader bookmark row must not dispatch raw bookmark-delete');
  assert.ok(effects.includes("case 'bookmark-delete':\n        ReaderEffects.rejectUnconfirmedBookmarkDelete();"),
    'raw bookmark-delete must fail closed rather than reaching Core');

  for (const marker of [
    "case 'search-history-clear-request'", "case 'search-history-clear-confirm'",
    'requestSearchHistoryClear', 'confirmSearchHistoryClear', 'clearConfirmedSearchHistory',
    'pendingSearchHistoryClear', 'refreshSearchHistoryAfterClearFailure',
    "type: 'search-history-clear-cancel'", "type: 'search-history-clear-confirm'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || contract.includes(marker),
      `search-history clear confirmation fence missing ${marker}`);
  }
  assert.equal(contract.includes("type: 'search-history-clear'"), false,
    'history clear UI must not dispatch the raw Core mutation');
  assert.ok(effects.includes("case 'search-history-clear':\n        ReaderEffects.rejectUnconfirmedSearchHistoryClear();"),
    'raw search-history-clear must fail closed rather than reaching Core');

  for (const marker of [
    "case 'cache-clear-confirm'", 'requestCacheClear', 'confirmCacheClear',
    'clearConfirmedSessionCache', "type: 'cache-clear-cancel'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || settings.includes(marker),
      `cache clear confirmation fence missing ${marker}`);
  }
  assert.equal(effects.includes("if (settingsKey === 'cache-clear') {\n      try"), false,
    'settings-action must not clear cache before its confirmation event');

  for (const marker of [
    "case 'core-restore-apply-request'", "case 'core-restore-apply-confirm'",
    'requestCoreRestoreApply', 'confirmCoreRestoreApply',
    'hasConfirmedPreparedCoreRestore', 'pendingCoreRestoreConfirmationChecksum',
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || structural.includes(marker),
      `Core restore confirmation fence missing ${marker}`);
  }
  assert.ok(effects.includes("case 'core-backup-apply':\n        ReaderEffects.rejectUnconfirmedCoreRestoreApply();"),
    'raw core-backup-apply must fail closed rather than applying storage directly');

  for (const marker of [
    'sourceSwitchEpoch', 'resetSourceSwitchScopeInPlace', 'SOURCE_SWITCH_ROUTE_REQUIRED',
    'sourceSwitchStateEpoch', "state.routeId !== 'source-switch' || !state.loading",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `source switch route/epoch fence missing ${marker}`);
  }

  assert.ok(structural.includes("type: 'rss-subscription-delete-request'"),
    'RSS row delete must open a confirmation route first');
  assert.ok(structural.includes('export struct RssSubscriptionDeleteConfirmPage') &&
    structural.includes("type: 'rss-subscription-delete-confirm'"),
    'RSS delete-confirm route must render a live-target confirm action');
  assert.ok(renderer.includes("this.routeId === 'rss-source-delete-confirm'") &&
    renderer.includes('RssSubscriptionDeleteConfirmPage'),
    'RSS delete-confirm alias must not render the management screen as a fake confirmation');
  const rawRssDeleteCase = effects.match(
    /case 'rss-subscription-delete':([\s\S]*?)break;/,
  )?.[1] ?? '';
  assert.ok(rawRssDeleteCase.includes('ReaderEffects.rejectUnconfirmedRssSubscriptionDelete();') &&
    effects.includes('deleteConfirmedRssSubscription'),
    'raw RSS delete must fail closed and only the confirm event may call Core');
  for (const marker of [
    'requestRssSubscriptionUpdate', 'hasLiveRssSubscription', 'requestRssItemRead',
    'hasLiveUnreadRssItem',
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `RSS update/read must bind a live route item: missing ${marker}`);
  }

  for (const marker of [
    "case 'replace-rule-delete-request'", "case 'replace-rule-delete-confirm'",
    'requestReplaceRuleDelete', 'confirmReplaceRuleDelete',
    'deleteConfirmedReplaceRule', 'REPLACE_RULE_DELETE_NOT_APPLIED',
    "@StorageProp('reader.pendingReplaceRuleDeleteId')",
    "type: 'replace-rule-delete-cancel'", "type: 'replace-rule-delete-confirm'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker) || replacePanel.includes(marker),
      `replace-rule delete confirmation fence missing ${marker}`);
  }
  assert.equal(replacePanel.includes("type: 'replace-rule-delete', replaceRuleId: rule.id"), false,
    'replace-rule row must not dispatch a raw Core delete');
  assert.ok(effects.includes("case 'replace-rule-delete':\n        ReaderEffects.rejectUnconfirmedReplaceRuleDelete();"),
    'raw replace-rule delete must fail closed rather than reaching Core');
  for (const marker of [
    'canMutatePersistentReplaceRule', 'REPLACE_RULE_UPDATE_TARGET_REQUIRED',
    'rejectInvalidReplaceRuleMutation', 'hasCurrentPersistentReplaceRule(id)',
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `replace-rule update fence missing ${marker}`);
  }
  for (const marker of [
    'requestWebdavSave', "state.routeId !== 'webdav-config'", "state.webdavSaveStatus !== 'saving'",
  ]) {
    assert.ok(reducer.includes(marker) || effects.includes(marker),
      `WebDAV save route/state fence missing ${marker}`);
  }
});

// ── Reader UI HostRequest 1.2.0 exact-set / fail-closed gate ─────────────
test('HostRequestTable exactly mirrors the canonical 58-type schema', () => {
  const schema = JSON.parse(read(path.resolve(FIXTURES, '..', 'host-request.schema.json')));
  const canonical = schema.properties.type.enum;
  const generated = read(path.join(GEN, 'HostRequestTable.ets'));
  const allBlock = generated.match(/static readonly ALL: HostRequestType\[\] = \[([\s\S]*?)\n  \];/);
  assert.ok(allBlock, 'HostRequestTable.ALL not found');
  const actual = [...allBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.equal(canonical.length, 58, `canonical HostRequest count drifted: ${canonical.length}`);
  assert.equal(new Set(canonical).size, 58, 'canonical HostRequest contains duplicates');
  assert.deepEqual(actual, canonical, 'generated HostRequest membership/order drifted');
  assert.ok(generated.includes("SCHEMA_VERSION: string = '1.2.0'"), 'generated schema version is not 1.2.0');
});

test('Harmony dispatcher, platform executor, adapter manifest and proof tier explicitly cover 58/58', () => {
  const schema = JSON.parse(read(path.resolve(FIXTURES, '..', 'host-request.schema.json')));
  const canonical = schema.properties.type.enum;
  const dispatcher = read(path.join(REPO, 'entry/src/main/ets/host/ReaderUiHostDispatcher.ets'));
  const platform = read(path.join(REPO, 'entry/src/main/ets/host/HarmonyReaderUiHostPlatform.ets'));
  const manifest = read(path.join(REPO, 'entry/src/main/ets/host/ReaderUiHostCapabilityManifest.ets'));
  const validateBlock = dispatcher.slice(
    dispatcher.indexOf('  private validate('),
    dispatcher.indexOf('  private validateCookieSet('),
  );
  const executeBlock = platform.slice(
    platform.indexOf('  async execute('),
    platform.indexOf('  private cookieFromFlatPayload('),
  );
  const adapterBlock = manifest.slice(
    manifest.indexOf('  private static adapterFor('),
    manifest.indexOf('  private static tierFor('),
  );
  const tierBlock = manifest.slice(
    manifest.indexOf('  private static tierFor('),
    manifest.indexOf('  private static requiresContext('),
  );
  for (const type of canonical) {
    assert.ok(validateBlock.includes(`case '${type}'`), `dispatcher DTO validator missing ${type}`);
    assert.ok(executeBlock.includes(`case '${type}'`), `Harmony executor missing ${type}`);
    assert.ok(adapterBlock.includes(`case '${type}'`), `Host manifest adapter missing ${type}`);
    assert.ok(tierBlock.includes(`case '${type}'`), `Host manifest proof tier missing ${type}`);
  }
  assert.ok(dispatcher.includes("throw new ReaderUiHostFailure('UNKNOWN_CAPABILITY'"),
    'unknown HostRequest must fail closed');
  assert.ok(executeBlock.includes("throw new ReaderUiHostFailure('CONTRACT_DRIFT'"),
    'platform default must fail instead of returning synthetic success');
  assert.equal(executeBlock.includes('default: return'), false,
    'platform executor must not have a catch-all return');
});

test('the historical Core manifest stays separate from Reader UI 55', () => {
  const legacy = read(path.join(REPO, 'entry/src/main/ets/host/HostCapabilityManifest.ets'));
  const runtime = read(path.join(REPO, 'entry/src/main/ets/bridge/CoreRuntime.ets'));
  const legacyCapabilities = [...legacy.matchAll(/capability: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(legacyCapabilities.length, 43, 'legacy mixed manifest must remain exactly 43 entries');
  assert.equal(new Set(legacyCapabilities).size, 43, 'legacy mixed manifest must not contain duplicates');
  assert.ok(runtime.includes('readerUiHostManifest') && runtime.includes('[ReaderUiHostManifest]'),
    'CoreRuntime must expose and broadcast the independent Reader UI manifest');
  assert.ok(runtime.includes('dispatchReaderUiHostRequest'),
    'CoreRuntime must expose the exact Reader UI dispatcher seam');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
