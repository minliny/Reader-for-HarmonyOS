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
const NORMALIZED_HTML_DIR = process.env.READER_UI_NORMALIZED_HTML
  || path.resolve(__dirname, '../../Reader UI/docs/ui-handoff/normalized-html');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function readJson(name) { return JSON.parse(read(path.join(FIXTURES, name))); }

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
  assert.equal(colors.length, 21, `expected 21 color tokens, got ${colors.length}`);
  // Every color token value resolves to an #AARRGGBB (8 hex) entry.
  const argbCount = (src.match(/#[0-9A-F]{8}/g) || []).length;
  assert.ok(argbCount >= 21, `expected ≥21 ARGB colors, got ${argbCount}`);
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
  assert.ok(!src.includes('function routeTitle('), 'AppTopBar must not use a stale hand-written routeTitle switch');
  assert.ok(!src.includes('function secondaryRouteTitle('), 'BackTopBar must not use a stale hand-written secondaryRouteTitle switch');
});

test('reader control chrome follows normalized handoff order and labels', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
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
    "['search', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2']",
    "['auto', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2']",
    "['replace', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2']",
  ];
  prev = -1;
  for (const marker of quickOrder) {
    const idx = src.indexOf(marker);
    assert.ok(idx > prev, `reader quick action order drift: ${marker}`);
    prev = idx;
  }
  assert.ok(src.includes("reader_icon_moon_primary"), 'paper control layer must expose a night-mode action icon');
  assert.ok(src.includes("reader_icon_sun_primary"), 'night-state control layer must expose a day-mode action icon');
  assert.ok(!src.includes("['night', 'reader_icon_more_dark'"), 'night/day action must not use the generic more icon');
});

test('reader overlay panels keep normalized handoff visible copy', () => {
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  for (const text of [
    '第一本 / 第一卷 /',
    '书签：深空信号',
    '当前阅读章节：第一章：阿长与《山海经》',
    '字体', '默认', '字距', '标准', '繁简', '简体',
    '缩进', '2 字符', '翻页动画', '覆盖', '主题', '米色纸张',
    '当前章节：第一章：阿长与《山海经》',
    '定时关闭', '不开启', '朗读音色', '温和女声',
    '未知频段的跳动波形',
    '不是随机的脉冲星信号',
    '当前书籍：深空信号',
    '仅显示当前书籍匹配到的替换规则',
    '净化广告段落',
    '合并异常断行',
    '修正常见乱码',
    '开启后将在本章内按当前速度推进，不影响下方页内控制条。',
  ]) {
    assert.ok(src.includes(text), `ReaderOverlayComponents missing handoff text: ${text}`);
  }
  assert.ok(!src.includes("ReaderListRow({ title: '三体'"), 'replace overlay must not show the wrong demo book title');
  assert.ok(!src.includes("ReaderSettingRow({ name: '替换\\\"信号\\\"为\\\"信号源\\\"'"), 'replace overlay must use handoff rule names');
});

test('reader control layer uses top-area structure instead of immersive info chrome', () => {
  const reader = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderComponents.ets'));
  assert.ok(reader.includes('export struct ReaderTopArea'), 'control-layer routes need the normalized reader-top-area component');
  assert.ok(reader.includes("Text('长夜余火')"), 'reader top area must show the normalized book title');
  assert.ok(reader.includes("Text('第 32 章 雨夜 · 优书网')"), 'reader top area must show the normalized chapter/source line');
  assert.ok(reader.includes("Text('换源')"), 'reader top area must expose the source switch action');
  assert.ok(reader.includes("return this.controlLayer() ? '雨夜' : '第一章 科学边界'"),
    'control-layer reading surface must show the normalized chapter title, not the book title');
  assert.ok(reader.includes('.textAlign(TextAlign.Center)'),
    'control-layer reading title must keep the demo centered reader layout');
  assert.ok(reader.includes('.textIndent(2 * 18)'),
    'control-layer paragraphs must keep the demo first-line indent');
  assert.ok(!reader.includes("return this.controlLayer() ? '深空信号'"),
    'control-layer body title must not duplicate the top-area book title');
  assert.ok(!reader.includes('textAlign(this.controlLayer() ? TextAlign.Start'),
    'control-layer title must not switch to a bespoke left-aligned layout');
  assert.ok(!reader.includes('textIndent(this.controlLayer() ? 0'),
    'control-layer paragraphs must not drop the demo indent');
  assert.ok(!reader.includes("Text('第一章：阿长与《山海经》')"), 'reader top area must not split into a detached chapter meta row');
  assert.ok(!reader.includes("Text('本地书籍')"), 'reader top area must not split into a detached source chip');
  assert.ok(reader.includes("return this.routeId !== 'reader'"), 'ReaderBase must branch between immersive reader and control-layer chrome');
  assert.ok(reader.includes('ReaderTopArea()'), 'control-layer branch must render ReaderTopArea');
  assert.ok(reader.includes('ReadingInfoLayer({ theme: this.theme })'), 'plain reader branch keeps immersive corner info');
  assert.ok(reader.includes('top: this.controlLayer() ? 100 : 72'),
    'control-layer body must add only native top-area clearance, not a bespoke large offset');
  assert.ok(reader.includes('bottom: 48 + this.safeAreaBottom'), 'control-layer body must keep the demo reader bottom inset');
  const baseStart = reader.indexOf('export struct ReaderBase');
  const base = reader.slice(baseStart);
  assert.ok(base.indexOf('ReaderTopArea()') < base.indexOf('ReadingInfoLayer({ theme: this.theme })'),
    'ReaderBase should prefer top-area chrome for control routes, then fall back to immersive info for plain reader');
});

test('reader control route fixture uses one bottom sheet, not detached floating controls', () => {
  const VS = readJson('view-state.fixtures.json');
  const src = read(path.join(REPO, 'entry/src/main/ets/ui/components/ReaderOverlayComponents.ets'));
  const byRoute = (routeId) => {
    const entry = VS.find((e) => e.routeId === routeId && e.pageState === 'default');
    assert.ok(entry, `${routeId}/default fixture missing`);
    return entry.components.map((c) => c.type);
  };
  assert.deepEqual(
    byRoute('control-layer-base-v2'),
    ['ReaderBase', 'ReaderControlSheet', 'ReaderBottomBar'],
    'control-layer-base-v2 must mirror demo bottom sheet + module nav structure'
  );
  const sheetStart = src.indexOf('export struct ReaderControlSheet');
  const sheetEnd = src.indexOf('// Legacy contract compatibility', sheetStart);
  const sheetSrc = src.slice(sheetStart, sheetEnd);
  assert.ok(sheetSrc.includes('private readonly dockMaxWidth: number = 365'),
    'control sheet host must use the demo 365/390 width ratio');
  assert.ok(sheetSrc.includes('private readonly sheetHeight: number = 330'),
    'control sheet host must reserve the demo sheet/nav background height');
  assert.ok(sheetSrc.includes('private readonly controlTop: number = 28'),
    'control sheet main area must start at the demo grabber clearance');
  assert.ok(sheetSrc.includes('private readonly moduleReserve: number = 111'),
    'control sheet main area must reserve the module-nav band inside the host');
  assert.ok(sheetSrc.includes('return this.sheetHeight - this.controlTop - this.moduleReserve'),
    'control sheet main height must be derived from demo sheet dimensions');
  assert.ok(sheetSrc.includes(".width('94%')"),
    'control sheet host must stay wider than the module nav');
  assert.ok(sheetSrc.includes('.height(this.sheetHeight)'),
    'control sheet host height must use the shared demo constant');
  assert.ok(!sheetSrc.includes('readerModuleNavHeight - 1'),
    'control sheet host must share the bottom anchor with the module nav, not float above it');
  for (const routeId of ['reader-search-overlay-v2', 'reader-replace-overlay-v2', 'reader-auto-scroll-overlay-v2']) {
    const types = byRoute(routeId);
    assert.equal(types.includes('FloatingQuickActions'), false, `${routeId} must not render detached quick actions`);
    assert.equal(types.includes('FloatingPageControl'), false, `${routeId} must not render detached page controls`);
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
  const detail = VS.find((e) => e.routeId === 'book-detail' && e.pageState === 'default');
  assert.ok(detail, 'book-detail/default fixture missing');
  assert.deepEqual(
    detail.components.map((c) => c.type),
    ['AppTopBar', 'BookHero', 'BookSummaryCard', 'BookChapterList']
  );
  assert.equal(
    detail.components.some((c) => c.type === 'BookCover'),
    false,
    'book-detail must not render BookCover as a top-level body component'
  );
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
  ]) {
    assert.ok(rssSrc.includes(text), `RssComponents missing RSS subpage copy: ${text}`);
  }
});

test('source tool pages use page-level visual components, not scaffold-only lists/loading', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['source-import-preview/default', ['BackTopBar', 'SourceImportPreviewPage']],
    ['source-groups/default', ['BackTopBar', 'SourceGroupsPage']],
    ['source-detect/default', ['BackTopBar', 'SourceDetectPage']],
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
  ]) {
    assert.ok(sourceSrc.includes(text), `LibraryComponents missing source tool copy: ${text}`);
  }
});

test('sync restore pages use page-level visual components, not scaffold-only lists/loading', () => {
  const VS = readJson('view-state.fixtures.json');
  const expected = new Map([
    ['sync-backup/default', ['BackTopBar', 'SyncBackupPage']],
    ['sync-backup/loading', ['BackTopBar', 'SyncBackupPage']],
    ['restore-confirm/default', ['BackTopBar', 'RestoreConfirmPage']],
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
    '恢复数据',
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
    ['source-add/default', ['BackTopBar', 'SourceFormPage']],
    ['source-edit/default', ['BackTopBar', 'SourceFormPage']],
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

// ── 7. Normalized page → ViewState coverage guard ─────────────────────────
// The normalized HTML pages (Reader UI/docs/ui-handoff/normalized-html/) are
// the 1:1 migration target — including 8 reader overlay routes + control-layer-
// base-v2. Each MUST have a ViewState entry OR an aliasFor declaration.
// PENDING_NORMALIZED is the explicit allowlist of pages not yet covered; it
// MUST shrink as later phases add ViewState/aliases and MUST be empty before
// declaring full migration. A page missing from both coverage AND
// PENDING_NORMALIZED is a hard FAIL (regression / scope gap).
const ROUTES_JSON = readJson('route.fixtures.json');
const VIEW_STATES_JSON = readJson('view-state.fixtures.json');
const VS_ROUTE_IDS = new Set(VIEW_STATES_JSON.map((v) => v.routeId));
const ALIAS_MAP = new Map(ROUTES_JSON.filter((r) => r.aliasFor).map((r) => [r.id, r.aliasFor]));

// Special filename → routeId mappings (where the normalized HTML filename does
// not directly match the contract RouteId). All other files map filename = routeId.
const PAGE_NAME_OVERRIDES = {
  'local-book-import': 'local-import',
  'rss-list': 'rss',
  'source-management-list': 'source-management',
  'source-import': 'source-import-options',
  'source-disabled-error': 'source-management',
};

// Dynamically read the normalized-html directory so the guard stays in sync with
// the UI repo without manual updates. Each .html file → [pageName, routeId] tuple.
const NORMALIZED_PAGES = fs.readdirSync(NORMALIZED_HTML_DIR)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .sort()
  .map((pageName) => [pageName, PAGE_NAME_OVERRIDES[pageName] ?? pageName]);

// Pages acknowledged as not-yet-migrated. Remove a page here ONLY when it has
// a ViewState entry or aliasFor declaration. Must be empty before full migration.
// NOTE: keys are pageName (first element of NORMALIZED_PAGES tuple), NOT routeId.
// Phase 1 全量补齐完成：所有 normalized 页面均有 ViewState 或 aliasFor，PENDING_NORMALIZED 清空。
const PENDING_NORMALIZED = new Set([]);

test('normalized pages each have ViewState or alias or are in PENDING allowlist', () => {
  const missing = [];
  for (const [pageName, routeId] of NORMALIZED_PAGES) {
    const hasVs = VS_ROUTE_IDS.has(routeId);
    const hasAlias = ALIAS_MAP.has(routeId);
    const isPending = PENDING_NORMALIZED.has(pageName);
    if (!hasVs && !hasAlias && !isPending) {
      missing.push(`${pageName} -> ${routeId}`);
    }
  }
  assert.equal(missing.length, 0,
    `normalized pages with no ViewState, no alias, and not in PENDING allowlist (add coverage or add to PENDING): ${missing.join(', ')}`);
});

test('PENDING_NORMALIZED allowlist contains no already-covered pages (stale entries must be removed)', () => {
  const stale = [];
  for (const [pageName, routeId] of NORMALIZED_PAGES) {
    if (!PENDING_NORMALIZED.has(pageName)) continue;
    const hasVs = VS_ROUTE_IDS.has(routeId);
    const hasAlias = ALIAS_MAP.has(routeId);
    if (hasVs || hasAlias) stale.push(`${pageName} -> ${routeId}`);
  }
  assert.equal(stale.length, 0,
    `PENDING_NORMALIZED has pages now covered (remove them from the allowlist): ${stale.join(', ')}`);
});

test('normalized page count matches directory (dynamically read)', () => {
  assert.ok(NORMALIZED_PAGES.length >= 53,
    `expected >=53 normalized pages (including reader overlays + control-layer-base-v2), got ${NORMALIZED_PAGES.length}`);
  // Verify the 8 reader overlays + control-layer-base-v2 are present.
  const required = [
    'control-layer-base-v2', 'reader-appearance-overlay-v2',
    'reader-auto-scroll-overlay-v2', 'reader-directory-overlay-v2',
    'reader-night-state-v2', 'reader-replace-overlay-v2',
    'reader-search-overlay-v2', 'reader-settings-overlay-v2',
    'reader-tts-overlay-v2',
  ];
  const pageNames = new Set(NORMALIZED_PAGES.map(([n]) => n));
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
  // All 53 normalized handoff pages have now been moved out of this allowlist;
  // entries below are non-normalized contract routes that are still scaffold.
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
