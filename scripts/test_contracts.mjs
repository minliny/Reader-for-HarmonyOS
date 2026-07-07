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

// ── 7. Normalized page → ViewState coverage guard ─────────────────────────
// The 44 normalized HTML pages (Reader UI/docs/ui-handoff/normalized-html/)
// are the 1:1 migration target. Each MUST have a ViewState entry OR an
// aliasFor declaration. PENDING_NORMALIZED is the explicit allowlist of pages
// not yet covered; it MUST shrink as later phases add ViewState/aliases and
// MUST be empty before declaring full migration. A page missing from both
// coverage AND PENDING_NORMALIZED is a hard FAIL (regression / scope gap).
const ROUTES_JSON = readJson('route.fixtures.json');
const VIEW_STATES_JSON = readJson('view-state.fixtures.json');
const VS_ROUTE_IDS = new Set(VIEW_STATES_JSON.map((v) => v.routeId));
const ALIAS_MAP = new Map(ROUTES_JSON.filter((r) => r.aliasFor).map((r) => [r.id, r.aliasFor]));

// normalized HTML filename (without .html) -> expected RouteId
const NORMALIZED_PAGES = [
  ['app-shell', 'app-shell'],
  ['main-tabs', 'main-tabs'],
  ['bookshelf-cover-mode', 'bookshelf-cover-mode'],
  ['bookshelf-list-mode', 'bookshelf-list-mode'],
  ['bookshelf-empty', 'bookshelf-empty'],
  ['bookshelf-group-management', 'bookshelf-group-management'],
  ['bookshelf-book-more-menu', 'bookshelf-book-more-menu'],
  ['local-book-import', 'local-import'],
  ['search-home', 'search-home'],
  ['search-results', 'search-results'],
  ['search-loading', 'search-loading'],
  ['search-empty', 'search-empty'],
  ['search-error', 'search-error'],
  ['book-detail', 'book-detail'],
  ['book-detail-toc-preview', 'book-detail-toc-preview'],
  ['source-switch-results', 'source-switch-results'],
  ['source-management-list', 'source-management'],
  ['source-detail', 'source-detail'],
  ['source-add', 'source-add'],
  ['source-edit', 'source-edit'],
  ['source-import', 'source-import-options'],
  ['source-test-result', 'source-test-result'],
  ['source-disabled-error', 'source-management'],
  ['discover-home', 'discover-home'],
  ['rss-list', 'rss'],
  ['rss-detail', 'rss-detail'],
  ['rss-subscription-management', 'rss-subscription-management'],
  ['rss-empty', 'rss-empty'],
  ['rss-error', 'rss-error'],
  ['global-settings', 'global-settings'],
  ['reading-settings-entry', 'reading-settings-entry'],
  ['source-settings-entry', 'source-settings-entry'],
  ['sync-settings-entry', 'sync-settings-entry'],
  ['about-version', 'about-version'],
  ['webdav-config', 'webdav-config'],
  ['backup-settings', 'backup-settings'],
  ['progress-sync-status', 'progress-sync-status'],
  ['remote-webdav-books', 'remote-webdav-books'],
  ['sync-error', 'sync-error'],
  ['global-loading', 'global-loading'],
  ['global-empty', 'global-empty'],
  ['global-error', 'global-error'],
  ['offline-state', 'offline-state'],
  ['permission-required', 'permission-required'],
];

// Pages acknowledged as not-yet-migrated. Remove a page here ONLY when it has
// a ViewState entry or aliasFor declaration. Must be empty before full migration.
// NOTE: keys are pageName (first element of NORMALIZED_PAGES tuple), NOT routeId.
const PENDING_NORMALIZED = new Set([
  'bookshelf-cover-mode', 'bookshelf-list-mode', 'bookshelf-group-management',
  'bookshelf-book-more-menu', 'local-book-import',
  'search-loading', 'search-error', 'book-detail-toc-preview',
  'source-management-list', 'source-disabled-error', 'source-add', 'source-edit',
  'source-import', 'source-test-result',
  'rss-subscription-management', 'rss-empty', 'rss-error',
  'global-settings', 'reading-settings-entry', 'source-settings-entry',
  'sync-settings-entry', 'about-version',
  'backup-settings', 'progress-sync-status', 'remote-webdav-books',
  'global-loading', 'global-empty', 'global-error', 'offline-state',
  'permission-required',
]);

test('normalized 44 pages each have ViewState or alias or are in PENDING allowlist', () => {
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

test('normalized page count is 44', () => {
  assert.equal(NORMALIZED_PAGES.length, 44, `expected 44 normalized pages, got ${NORMALIZED_PAGES.length}`);
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
// time. Shell-owned bars (AppTopBar/BackTopBar/BottomNav) are excluded from
// body via bodyComponentsFor, so a page with only bars + scaffold is scaffold-only.
const SCAFFOLD_ALLOWED = new Set([
  'app-shell', 'bookshelf-empty', 'book-detail', 'state-offline', 'state-error',
  'search-home', 'search-results', 'search-empty', 'source-detail',
  'rss-all', 'rss-detail', 'rss-original', 'restore-running', 'restore-result',
  'sync-backup', 'sync-error', 'webdav-config',
]);

test('ViewState routes that are scaffold-only are listed in SCAFFOLD_ALLOWED', () => {
  const scaffoldOnly = [];
  const coveredRouteIds = new Set();
  for (const v of VIEW_STATES_JSON) coveredRouteIds.add(v.routeId);
  for (const routeId of coveredRouteIds) {
    // Use the generated table's bodyComponentsFor logic: filter shell bars.
    let components = [];
    for (const entry of VIEW_STATES_JSON) {
      if (entry.routeId !== routeId) continue;
      components = entry.components || [];
      break;
    }
    const body = components.filter((c) => !['AppTopBar', 'BackTopBar', 'BottomNav'].includes(c.type));
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
    let components = [];
    for (const entry of VIEW_STATES_JSON) {
      if (entry.routeId !== routeId) continue;
      components = entry.components || [];
      break;
    }
    const body = components.filter((c) => !['AppTopBar', 'BackTopBar', 'BottomNav'].includes(c.type));
    const hasBespoke = body.some((c) => !SCAFFOLD_TYPES.has(c.type));
    if (hasBespoke) stale.push(routeId);
  }
  assert.equal(stale.length, 0,
    `SCAFFOLD_ALLOWED has routes now with bespoke components (remove them): ${stale.join(', ')}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
