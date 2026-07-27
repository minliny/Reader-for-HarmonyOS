// gen_contracts.mjs — generate ArkTS contract bindings + color.json from Reader UI Contract fixtures.
// Idempotent: re-run produces identical output. Safe to re-run whenever contracts change.
//
// Source (read-only): ../Reader-UI/contracts plus fixtures. The historical
// `Reader UI` checkout name remains accepted for local compatibility.
//   (override with READER_UI_CONTRACTS env var pointing at the fixtures dir)
// Output:
//   entry/src/main/ets/contract/generated/{ColorTokens,DimensionTokens,TextConstraintTokens,TypeTokens,MotionTokens,ShadowTokens,RouteTable,MotionSpecTable,MotionPolicyTable}.ets
//   entry/src/main/resources/base/element/color.json
//   entry/src/main/resources/dark/element/color.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ── Locate contracts fixtures dir ──────────────────────────────────────────
function resolveContractsDir() {
  const candidates = [
    process.env.READER_UI_CONTRACTS,
    path.resolve(__dirname, '../../Reader-UI/contracts/fixtures'),
    path.resolve(REPO_ROOT, '../Reader-UI/contracts/fixtures'),
    path.resolve(__dirname, '../../Reader UI/contracts/fixtures'),
    path.resolve(REPO_ROOT, '../Reader UI/contracts/fixtures'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'token.fixtures.json'))) return c;
  }
  console.error('ERROR: could not locate Reader UI contract fixtures dir.');
  console.error('Set READER_UI_CONTRACTS=<path-to>/Reader UI/contracts/fixtures');
  process.exit(1);
}
const CONTRACTS_DIR = resolveContractsDir();
const OUT_ETS = path.resolve(REPO_ROOT, 'entry/src/main/ets/contract/generated');
const OUT_READER_UI_ETS = path.resolve(REPO_ROOT, 'entry/src/main/ets/contract/reader_ui');
const OUT_RES_BASE = path.resolve(REPO_ROOT, 'entry/src/main/resources/base/element');
const OUT_RES_DARK = path.resolve(REPO_ROOT, 'entry/src/main/resources/dark/element');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, name), 'utf8'));
}
const TOKENS = readJson('token.fixtures.json');
const ROUTE_FIXTURES = readJson('route.fixtures.json');
const ROUTE_RECONSTRUCTION_QUARANTINE = readJson('route-reconstruction-quarantine.fixtures.json');
const MOTIONS = readJson('motion.fixtures.json');
const POLICIES = readJson('motion-policy.fixtures.json');
const VIEW_STATE_FIXTURES = readJson('view-state.fixtures.json');
const HOST_REQUEST_SCHEMA = JSON.parse(
  fs.readFileSync(path.resolve(CONTRACTS_DIR, '..', 'host-request.schema.json'), 'utf8')
);
const HOST_REQUEST_TYPES = HOST_REQUEST_SCHEMA.properties.type.enum;
if (HOST_REQUEST_TYPES.length !== 58 || new Set(HOST_REQUEST_TYPES).size !== 58) {
  throw new Error(
    `Reader UI HostRequest 1.2.0 must contain exactly 58 unique types; got ${HOST_REQUEST_TYPES.length}`
  );
}

// Route membership comes from the canonical schema, not the lagging route
// fixture. Reader UI 3.0 currently publishes 260 RouteIds while the
// historical route fixture still carries the original 200 shell records.
// frontend-demo-optimized/route-contract.js supplies the canonical title/shell
// metadata for the expanded set. Any future schema route without metadata is
// a generation error: the host must never silently send it to a catch-all
// shell or render an empty page.
const ROUTE_SCHEMA = JSON.parse(fs.readFileSync(path.resolve(CONTRACTS_DIR, '..', 'route.schema.json'), 'utf8'));
const CANONICAL_ROUTE_IDS = ROUTE_SCHEMA.properties.id.enum;

function activeQuarantinedRouteIds(document) {
  if (document === null || Array.isArray(document) || typeof document !== 'object' ||
    (document.status !== 'active' && document.status !== 'released') || !Array.isArray(document.entries)) {
    throw new Error('Reader UI route reconstruction quarantine is invalid');
  }
  if (document.status === 'released') return new Set();
  const ids = new Set();
  for (const [index, entry] of document.entries.entries()) {
    if (entry === null || Array.isArray(entry) || typeof entry !== 'object' ||
      typeof entry.recordId !== 'string' || !Array.isArray(entry.routeIds) || entry.blocksPromotion !== true) {
      throw new Error(`Reader UI route reconstruction quarantine entry ${index + 1} is invalid`);
    }
    for (const routeId of entry.routeIds) {
      if (typeof routeId !== 'string' || !CANONICAL_ROUTE_IDS.includes(routeId)) {
        throw new Error(`Reader UI route reconstruction quarantine references unknown RouteId: ${String(routeId)}`);
      }
      if (ids.has(routeId)) {
        throw new Error(`Reader UI route reconstruction quarantine duplicates RouteId: ${routeId}`);
      }
      ids.add(routeId);
    }
  }
  return ids;
}

// This set is generated from Reader-UI source data. It is the explicit A3
// route extraction: legacy reading routes remain published RouteIds but are
// omitted from native RouteTable and ViewStateTable until a new source
// conversion releases them. Do not recreate this list in a Harmony renderer.
const QUARANTINED_ROUTE_IDS = activeQuarantinedRouteIds(ROUTE_RECONSTRUCTION_QUARANTINE);

function readCanonicalDemoRoutes() {
  const readerUiRoot = path.resolve(CONTRACTS_DIR, '..', '..');
  const candidates = [
    path.join(readerUiRoot, 'frontend-demo-optimized', 'route-contract.js'),
    path.join(readerUiRoot, 'frontend-demo-next', 'route-contract.js'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const window = {};
    vm.runInNewContext(fs.readFileSync(candidate, 'utf8'), { window }, { filename: candidate });
    const contract = window.ReaderFrontendDemoDraftRouteContract;
    if (contract && contract.routes) return contract.routes;
  }
  throw new Error('Could not load Reader UI frontend-demo route-contract.js');
}

const DEMO_ROUTES = readCanonicalDemoRoutes();
// frontend-demo-next renders reader-replace-page but its current route-contract
// object omits that single schema record. Keep this narrowly explicit until
// the central metadata is corrected; exact-set validation below prevents this
// from growing into a fallback table.
const ROUTE_METADATA_OVERRIDES = {
  'reader-replace-page': {
    title: '内容替换规则管理（Reader Replace Page）',
    shell: 'ReaderShell',
  },
};
const ROUTE_FIXTURE_BY_ID = new Map(ROUTE_FIXTURES.map((route) => [route.id, route]));
const ROUTE_METADATA_IDS = new Set([...Object.keys(DEMO_ROUTES), ...Object.keys(ROUTE_METADATA_OVERRIDES)]);
const missingRouteMetadata = CANONICAL_ROUTE_IDS.filter((id) => !ROUTE_METADATA_IDS.has(id));
const staleRouteMetadata = [...ROUTE_METADATA_IDS].filter((id) => !CANONICAL_ROUTE_IDS.includes(id));
if (missingRouteMetadata.length > 0 || staleRouteMetadata.length > 0) {
  throw new Error(`Route metadata must exactly cover canonical schema; missing=${missingRouteMetadata.join(',')} stale=${staleRouteMetadata.join(',')}`);
}
const ROUTES = CANONICAL_ROUTE_IDS.map((id) => {
  const fixture = ROUTE_FIXTURE_BY_ID.get(id) || {};
  const metadata = ROUTE_METADATA_OVERRIDES[id] || DEMO_ROUTES[id];
  return { ...fixture, id, title: metadata.title, shell: metadata.shell };
});
const ACTIVE_ROUTES = ROUTES.filter((route) => !QUARANTINED_ROUTE_IDS.has(route.id));

const CONTRACT_25_ROUTE_IDS = ACTIVE_ROUTES
  .filter((route) => !ROUTE_FIXTURE_BY_ID.has(route.id))
  .map((route) => route.id);
if (CONTRACT_25_ROUTE_IDS.length !== 0 && CONTRACT_25_ROUTE_IDS.length !== 35) {
  throw new Error(`Expected the legacy 35 Reader UI 2.5 route additions or a fully expanded fixture, found ${CONTRACT_25_ROUTE_IDS.length}`);
}
const CONTRACT_25_VIEW_STATES = CONTRACT_25_ROUTE_IDS.map((id) => {
  const route = ACTIVE_ROUTES.find((candidate) => candidate.id === id);
  return {
    routeId: id,
    pageState: 'default',
    components: [
      { type: 'BackTopBar', id: `${id}-top`, props: { title: route.title }, children: [] },
      { type: 'Contract25RoutePage', id: `${id}-page`, props: { contractRouteId: id }, children: [] },
    ],
  };
});
const VIEW_STATES = [...VIEW_STATE_FIXTURES, ...CONTRACT_25_VIEW_STATES]
  .filter((entry) => !QUARANTINED_ROUTE_IDS.has(entry.routeId));

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
ensureDir(OUT_ETS);
ensureDir(OUT_RES_BASE);
ensureDir(OUT_RES_DARK);

const HEADER = '// GENERATED by scripts/gen_contracts.mjs — DO NOT EDIT BY HAND.\n// Source: Reader UI/contracts/fixtures/*.json (read-only contract).\n// Re-run `npm run gen:contracts` after any contract change.\n';

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

// Convert a token name suffix to camelCase: "paper-bright" -> "paperBright"
function camel(suffix) {
  return suffix.split('-').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function stripPrefix(name, prefix) {
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}

// Parse a token value into ARGB #AARRGGBB (ArkUI color.json byte order).
function toArgb(value) {
  const v = value.trim();
  const hexMatch = v.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) return '#FF' + hexMatch[1].toUpperCase();
  const hex8Match = v.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8Match) return '#' + hex8Match[1].toUpperCase();
  const rgbaMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    const aa = Math.round(a * 255);
    const h = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return '#' + h(aa) + h(r) + h(g) + h(b);
  }
  throw new Error(`Cannot parse color value: ${value}`);
}

// Parse "Npx" / "Nms" / "N" -> number (strips px or ms unit)
function toPxNumber(value) {
  const m = value.match(/^(-?[0-9.]+)\s*(?:px|ms)?$/);
  if (m) return Number(m[1]);
  const n = Number(value);
  if (!Number.isNaN(n)) return n;
  throw new Error(`Cannot parse numeric token value: ${value}`);
}

// snake_case name for color.json: --fd-ds-color-paper -> reader_ds_color_paper
function snakeArg(name) {
  return name.replace(/^--/, '').replace(/-/g, '_');
}

// ── Token partitioning ────────────────────────────────────────────────────
const byCat = (cat) => TOKENS.filter((t) => t.category === cat && t.deprecated !== true);
const COLORS = byCat('color');
const SPACING = byCat('spacing');
const SIZE = byCat('size');
const RADIUS = byCat('radius');
const ELEVATION = byCat('elevation');
const ZINDEX = byCat('z-index');
const TEXT_CONSTRAINT = byCat('text-constraint');
const TYPE = byCat('type');
const FONT = byCat('font');
const MOTION_DUR = byCat('motion-duration');
const MOTION_EASE = byCat('motion-easing');
const SHADOW = byCat('shadow');

// ── ColorTokens.ets ───────────────────────────────────────────────────────
function genColorTokens() {
  const lines = COLORS.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-color-');
    return `  static readonly ${camel(suffix)}: string = '${toArgb(t.value)}';`;
  });
  return `${HEADER}\nexport class ColorTokens {\n${lines.join('\n')}\n}\n`;
}

// ── color.json (base + dark) ──────────────────────────────────────────────
function genColorJson() {
  const paperArgb = toArgb(COLORS.find((c) => c.name === '--fd-ds-color-paper').value);
  const entries = [
    { name: 'start_window_background', value: paperArgb },
    ...COLORS.map((t) => ({ name: snakeArg(t.name), value: toArgb(t.value) })),
  ];
  // dark = base in Phase 1 (contract has no dark variants yet)
  const body = JSON.stringify({ color: entries }, null, 2) + '\n';
  return { base: body, dark: body };
}

// ── DimensionTokens.ets ───────────────────────────────────────────────────
function genClassFor(category, prefix, valueFn) {
  const lines = category.map((t) => {
    const suffix = stripPrefix(t.name, prefix);
    return `  static readonly ${camel(suffix)}: number = ${valueFn(t.value)};`;
  });
  return lines.join('\n');
}
function genDimensionTokens() {
  const spacing = genClassFor(SPACING, '--fd-ds-space-', toPxNumber);
  const size = genClassFor(SIZE, '--fd-ds-size-', toPxNumber);
  const radius = genClassFor(RADIUS, '--fd-ds-radius-', toPxNumber);
  const elevation = genClassFor(ELEVATION, '--fd-ds-elevation-', toPxNumber);
  const zindex = genClassFor(ZINDEX, '--fd-ds-z-', toPxNumber);
  return `${HEADER}\nexport class SpacingTokens {\n${spacing}\n}\n\nexport class SizeTokens {\n${size}\n}\n\nexport class RadiusTokens {\n${radius}\n}\n\nexport class ElevationTokens {\n${elevation}\n}\n\nexport class ZIndexTokens {\n${zindex}\n}\n`;
}

// ── TextConstraintTokens.ets ──────────────────────────────────────────────
function genTextConstraintTokens() {
  const lines = TEXT_CONSTRAINT.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-text-');
    const v = t.value.trim();
    if (/^\d+$/.test(v)) return `  static readonly ${camel(suffix)}: number = ${v};`;
    return `  static readonly ${camel(suffix)}: string = '${esc(v)}';`;
  });
  return `${HEADER}\nexport class TextConstraintTokens {\n${lines.join('\n')}\n}\n`;
}

// ── TypeTokens.ets ────────────────────────────────────────────────────────
function genTypeTokens() {
  const typeLines = TYPE.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-type-');
    return `  static readonly ${camel(suffix)}: number = ${toPxNumber(t.value)};`;
  });
  // Font tokens: read every category==='font' entry from the contract fixtures.
  // Use platforms.arkts when present (HarmonyOS-specific family stack); fall back
  // to the raw contract value otherwise. Field name = camelCase suffix after
  // stripping --fd-ds-font- (e.g. sans / serif / kai / fangsong / mono).
  const fontLines = FONT.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-font-');
    const v = (t.platforms && t.platforms.arkts) ? t.platforms.arkts : t.value;
    return `  static readonly ${camel(suffix)}: string = '${esc(v)}';`;
  });
  return `${HEADER}\nexport class TypeTokens {\n${typeLines.join('\n')}\n}\n\nexport class FontTokens {\n${fontLines.join('\n')}\n}\n`;
}

// ── MotionTokens.ets ─────────────────────────────────────────────────────
function genMotionTokens() {
  const durLines = MOTION_DUR.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-motion-duration-');
    return `  static readonly ${camel(suffix)}: number = ${toPxNumber(t.value)};`;
  });
  const easeLines = MOTION_EASE.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-motion-easing-');
    return `  static readonly ${camel(suffix)}: string = '${esc(t.value)}';`;
  });
  return `${HEADER}\nexport class MotionDurationTokens {\n${durLines.join('\n')}\n}\n\nexport class MotionEasingTokens {\n${easeLines.join('\n')}\n}\n`;
}

// ── ShadowTokens.ets ──────────────────────────────────────────────────────
function genShadowTokens() {
  const lines = SHADOW.map((t) => {
    const suffix = stripPrefix(t.name, '--fd-ds-shadow-');
    return `  static readonly ${camel(suffix)}: string = '${esc(t.value)}';`;
  });
  return `${HEADER}\nexport class ShadowTokens {\n${lines.join('\n')}\n}\n`;
}

// ── TokenRegistry.ets (full name→value registry for coverage tests) ───────
function genTokenRegistry() {
  const cats = [...new Set(TOKENS.map((t) => t.category))];
  const catUnion = cats.map((c) => `'${c}'`).join(' | ');
  // Include platforms.arkts (when present) so HarmonyOS-specific values
  // (font family stacks, icon $r() refs as strings) are reachable alongside
  // the cross-platform `value`. Optional field keeps the interface backward
  // compatible with code that only reads `value`.
  const entries = TOKENS.map((t) => {
    const arkts = t.platforms && t.platforms.arkts ? `, arkts: '${esc(t.platforms.arkts)}'` : '';
    return `    { name: '${esc(t.name)}', category: '${esc(t.category)}', value: '${esc(t.value)}'${arkts} }`;
  });
  return `${HEADER}\nexport type TokenCategory = ${catUnion};\nexport interface TokenEntry { name: string; category: TokenCategory; value: string; arkts?: string; }\n\nexport class TokenRegistry {\n  static readonly ALL: TokenEntry[] = [\n${entries.join(',\n')}\n  ];\n\n  static byName(name: string): TokenEntry | undefined {\n    for (const t of TokenRegistry.ALL) {\n      if (t.name === name) return t;\n    }\n    return undefined;\n  }\n\n  static byCategory(category: TokenCategory): TokenEntry[] {\n    return TokenRegistry.ALL.filter((t) => t.category === category);\n  }\n}\n`;
}

// ── RouteTable.ets ────────────────────────────────────────────────────────
function genRouteTable() {
  const ids = ACTIVE_ROUTES.map((r) => r.id);
  const idUnion = ids.map((i) => `'${i}'`).join(' | ');
  const shells = [...new Set(ACTIVE_ROUTES.map((r) => r.shell))];
  const shellUnion = shells.map((s) => `'${s}'`).join(' | ');
  const shellCases = ACTIVE_ROUTES.map((r) => `      case '${r.id}': return '${r.shell}';`).join('\n');
  const titleCases = ACTIVE_ROUTES.map((r) => `      case '${r.id}': return '${esc(r.title)}';`).join('\n');
  const mainTabCases = ACTIVE_ROUTES.filter((r) => r.mainTab).map((r) => `      case '${r.id}': return '${r.mainTab}';`).join('\n');
  // aliasFor: a route may declare aliasFor to reuse another route's ViewState
  // (e.g. discover-home aliases discover). aliasOf resolves one hop; the
  // ViewStateTable.componentsFor loop follows the chain (depth-capped).
  // An active route must never resolve through a quarantined historical
  // target. Returning null forces the generated ViewStateTable to emit no
  // body, instead of reactivating a removed Reader overlay by alias.
  const aliasCases = ACTIVE_ROUTES.filter((r) => r.aliasFor && !QUARANTINED_ROUTE_IDS.has(r.aliasFor))
    .map((r) => `      case '${r.id}': return '${r.aliasFor}';`).join('\n');
  const aliasMethod = aliasCases
    ? `\n  static aliasOf(id: string): string | null {\n    switch (id) {\n${aliasCases}\n      default: return null;\n    }\n  }`
    : '\n  static aliasOf(id: string): string | null { return null; }';
  const allIds = ids.map((id) => `    '${id}'`).join(',\n');
  return `${HEADER}\nexport type RouteId = ${idUnion};\nexport type ShellId = ${shellUnion};\n\nexport class RouteTable {\n  static readonly ALL: RouteId[] = [\n${allIds}\n  ];\n\n  static has(id: string): boolean {\n    return RouteTable.ALL.indexOf(id as RouteId) >= 0;\n  }\n\n  static shellOf(id: string): ShellId | null {\n    switch (id) {\n${shellCases}\n      default: return null;\n    }\n  }\n\n  static titleOf(id: string): string | null {\n    switch (id) {\n${titleCases}\n      default: return null;\n    }\n  }\n\n  static mainTabOf(id: string): string | null {\n    switch (id) {\n${mainTabCases}\n      default: return null;\n    }\n  }${aliasMethod}\n}\n`;
}

// ── HostRequestTable.ets ─────────────────────────────────────────────────
// Host identity is generated from the canonical 1.2.0 schema. Native Host
// adapters consume this table directly; they never maintain a second list of
// wire names that can silently drift from Reader UI.
function genHostRequestTable() {
  const typeUnion = HOST_REQUEST_TYPES.map((type) => `'${esc(type)}'`).join(' | ');
  const all = HOST_REQUEST_TYPES.map((type) => `    '${esc(type)}'`).join(',\n');
  return `${HEADER}
export type HostRequestType = ${typeUnion};
export type HostRequestInitiator = 'core' | 'reducer';

export class HostRequestTable {
  static readonly SCHEMA_VERSION: string = '1.2.0';
  static readonly ALL: HostRequestType[] = [
${all}
  ];

  static has(type: string): boolean {
    return HostRequestTable.ALL.indexOf(type as HostRequestType) >= 0;
  }
}
`;
}

// ── ViewStateTable.ets ────────────────────────────────────────────────────
function normalizeComponent(c) {
  return {
    type: c.type,
    id: c.id || '',
    props: c.props || {},
    children: (c.children || []).map(normalizeComponent),
    // ViewState 1.2 carries explicit target bindings. Preserve the canonical
    // tuple losslessly so host-composite adapters can consume action metadata
    // without recursively rendering the component's declarative children.
    bindings: (c.bindings || []).map((binding) => ({
      target: binding.target,
      event: binding.event,
      payload: binding.payload || {},
      trigger: binding.trigger,
    })),
  };
}

// Collect every prop key used across all view-state components, mapped to its
// ArkTS type. Drives the generated ViewStateProps interface so new fixture
// props (e.g. viewMode) flow through without hand-editing the generator.
//
// BASELINE_PROPS covers props the renderer reads even when no fixture sets
// them (e.g. ProgressBar.progress defaults to 0.42 inside ViewStateRenderer;
// DemoButton.destructive is read for every Button). Without these, removing the
// only fixture that sets a prop would drop it from ViewStateProps and break the
// renderer's unconditional read.
const BASELINE_PROPS = {
  label: 'string',
  progress: 'number',
  destructive: 'boolean',
  sources: 'number',
  unread: 'number',
  // Kept even after the 35 Reader UI 2.5 routes moved from the historical
  // Contract25RoutePage scaffold to direct canonical ViewState fixtures. The
  // defensive renderer remains compilable for older fixture snapshots.
  contractRouteId: 'string',
};

function viewStatePropType(value) {
  if (value === null || Array.isArray(value) || typeof value === 'object') {
    return 'ViewStateJSONValue';
  }
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function collectPropTypes(viewStates) {
  const types = new Map(Object.entries(BASELINE_PROPS));
  const visit = (c) => {
    const props = c.props || {};
    for (const k of Object.keys(props)) {
      const v = props[k];
      let t = viewStatePropType(v);
      // Conflicting primitive/structured types must retain both shapes. A
      // JSON value is the lossless widening; coercing to string would discard
      // canonical nested payloads and make ArkTS consumers reconstruct data.
      if (types.has(k) && types.get(k) !== t) t = 'ViewStateJSONValue';
      types.set(k, t);
    }
    (c.children || []).forEach(visit);
  };
  viewStates.forEach((v) => (v.components || []).forEach(visit));
  return types;
}

function arktsTemplateLiteral(value) {
  return '`' + value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${') + '`';
}

function genViewStateTable() {
  const entries = VIEW_STATES.map((v) => ({
    routeId: v.routeId,
    pageState: v.pageState,
    context: v.context || {},
    components: (v.components || []).map(normalizeComponent),
  }));
  const propTypes = collectPropTypes(VIEW_STATES);
  const propLines = [...propTypes.keys()].sort().map((k) => {
    const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${esc(k)}'`;
    return `  ${key}?: ${propTypes.get(k)};`;
  });
  const propsIface = `export interface ViewStateProps {\n${propLines.join('\n')}\n}`;
  // ArkTS rejects deeply nested untyped object literals even when the outer
  // array has an interface annotation. Parse the canonical JSON as a typed
  // value instead: props/context remain objects, arrays, numbers, booleans and
  // null at runtime (they are not stringified payload fields).
  const body = arktsTemplateLiteral(JSON.stringify(entries, null, 2));
  return `${HEADER}
import { RouteId, RouteTable } from './RouteTable';

export type ViewStateJSONValue = object | string | number | boolean | null;

${propsIface}

export interface ViewStateExplicitBinding {
  target: string;
  event: string;
  payload: Record<string, ViewStateJSONValue>;
  trigger: string;
}

export interface ViewStateComponent {
  type: string;
  id: string;
  props: ViewStateProps;
  children: ViewStateComponent[];
  bindings: ViewStateExplicitBinding[];
}

export interface ViewStateEntry {
  routeId: RouteId;
  pageState: string;
  context: Record<string, ViewStateJSONValue>;
  components: ViewStateComponent[];
}

export class ViewStateTable {
  static readonly ENTRIES: ViewStateEntry[] = JSON.parse(${body}) as ViewStateEntry[];

  // Resolve components for (routeId, pageState). Falls back to:
  //   1. same-route 'default' pageState entry
  //   2. RouteTable.aliasOf(routeId) -> that route's (pageState, then default)
  //   3. empty array (caller renders nothing)
  // Alias chain depth capped at 4 to guard against accidental cycles.
  static componentsFor(routeId: string, pageState: string): ViewStateComponent[] {
    let current: string = routeId;
    for (let depth = 0; depth < 5; depth++) {
      let fallback: ViewStateComponent[] = [];
      for (const entry of ViewStateTable.ENTRIES) {
        if (entry.routeId !== current) continue;
        if (entry.pageState === pageState) return entry.components;
        if (entry.pageState === 'default' || fallback.length === 0) {
          fallback = entry.components;
        }
      }
      if (fallback.length > 0) return fallback;
      const next: string | null = RouteTable.aliasOf(current);
      if (next === null || next === current) break;
      current = next;
    }
    return [];
  }

  static contextFor(routeId: string, pageState: string): Record<string, ViewStateJSONValue> {
    let current: string = routeId;
    for (let depth = 0; depth < 5; depth++) {
      let fallback: Record<string, ViewStateJSONValue> | undefined = undefined;
      for (const entry of ViewStateTable.ENTRIES) {
        if (entry.routeId !== current) continue;
        if (entry.pageState === pageState) return entry.context;
        if (entry.pageState === 'default' || fallback === undefined) fallback = entry.context;
      }
      if (fallback !== undefined) return fallback;
      const next: string | null = RouteTable.aliasOf(current);
      if (next === null || next === current) break;
      current = next;
    }
    return {};
  }

  static bodyComponentsFor(routeId: string, pageState: string): ViewStateComponent[] {
    return ViewStateTable.componentsFor(routeId, pageState).filter((component: ViewStateComponent) =>
      component.type !== 'AppTopBar' && component.type !== 'BackTopBar' && component.type !== 'BottomNav');
  }
}
`;
}

// ── MotionSpecTable.ets ──────────────────────────────────────────────────
function genMotionSpecTable() {
  const iface = `export interface MotionSpecTokens { durationToken: string; easingToken: string; }\nexport interface MotionSpec {\n  id: string;\n  durationMs: number;\n  easing: string;\n  implementationKind: string;\n  containerRole: string;\n  operation: string;\n  visualPattern: string;\n  interruptPolicy: string;\n  reducedMotionPolicy: string;\n  tokens: MotionSpecTokens;\n  guardRules: string[];\n  trigger?: string[];\n  from?: string[];\n  to?: string[];\n  interrupt?: string[];\n  finalState?: string;\n  cleanup?: string[];\n  deprecated?: boolean;\n}`;
  const specs = MOTIONS.map((m) => {
    const gr = (m.guardRules || []).map((g) => `'${esc(g)}'`).join(', ');
    const optional = [];
    for (const field of ['trigger', 'from', 'to', 'interrupt', 'cleanup']) {
      if (Array.isArray(m[field])) {
        optional.push(`${field}: [${m[field].map((value) => `'${esc(value)}'`).join(', ')}]`);
      }
    }
    if (typeof m.finalState === 'string') optional.push(`finalState: '${esc(m.finalState)}'`);
    if (m.deprecated === true) optional.push('deprecated: true');
    const optionalSuffix = optional.length > 0 ? `, ${optional.join(', ')}` : '';
    return `    { id: '${esc(m.id)}', durationMs: ${m.durationMs}, easing: '${esc(m.easing)}', implementationKind: '${esc(m.implementationKind)}', containerRole: '${esc(m.containerRole)}', operation: '${esc(m.operation)}', visualPattern: '${esc(m.visualPattern)}', interruptPolicy: '${esc(m.interruptPolicy)}', reducedMotionPolicy: '${esc(m.reducedMotionPolicy)}', tokens: { durationToken: '${esc(m.tokens.durationToken)}', easingToken: '${esc(m.tokens.easingToken)}' }, guardRules: [${gr}]${optionalSuffix} }`;
  });
  return `${HEADER}\n${iface}\n\nexport class MotionSpecTable {\n  static readonly SPECS: MotionSpec[] = [\n${specs.join(',\n')}\n  ];\n\n  static byId(id: string): MotionSpec | undefined {\n    for (const s of MotionSpecTable.SPECS) {\n      if (s.id === id) return s;\n    }\n    return undefined;\n  }\n}\n`;
}

// ── DemoAliasTokens.ets (demo --fd-* aliases not in contract) ─────────────
// Ported from frontend-demo/styles/00-foundation.css. These capture demo-specific
// values (surface tint, on-primary, radius lg/xl) that have no 1:1 --fd-ds-*
// contract token, so 1:1 demo ports can reference them by name.
function genDemoAliasTokens() {
  const hdr = '// GENERATED by scripts/gen_contracts.mjs — DO NOT EDIT BY HAND.\n// Source: ../Reader UI/frontend-demo/styles/00-foundation.css (--fd-* aliases).\n// NOT contract tokens; demo-specific values needed for 1:1 demo-port fidelity.\n';
  return `${hdr}
export class DemoAliasTokens {
  // Colors (demo --fd-surface / --fd-on-primary; the rest alias --fd-ds-*)
  static readonly surface: string = '#E6FFFCF8';    // rgba(255,252,248,0.9)
  static readonly onPrimary: string = '#FFFFFAF4'; // #fffaf4
  // Shadow colors (demo --fd-soft-shadow / --fd-shadow as rgba; ArkUI shadow takes a color)
  static readonly shadowSoftColor: string = '#1A594632';      // rgba(89,70,50,0.10)
  static readonly shadowElevatedColor: string = '#29594632';   // rgba(89,70,50,0.16)
  // Radius scale (demo --fd-radius-xs/sm/md/lg/xl/pill)
  static readonly radiusXs: number = 4;
  static readonly radiusSm: number = 6;
  static readonly radiusMd: number = 8;
  static readonly radiusLg: number = 12;
  static readonly radiusXl: number = 24;
  static readonly radiusPill: number = 999;
}
`;
}

// ── MotionPolicyTable.ets ─────────────────────────────────────────────────
function genMotionPolicyTable() {
  const real = POLICIES.filter((p) => p && p.id && p.priority !== undefined && p.match && p.motionId);
  const specificity = (policy) => Object.values(policy.match).filter((value) => value !== undefined).length;
  real.sort((a, b) => (b.priority - a.priority) || (specificity(b) - specificity(a)));
  const iface = `export interface MotionPolicyMatch {\n  fromRoute?: string;\n  toRoute?: string;\n  fromShell?: string;\n  toShell?: string;\n  operation?: string;\n  containerRole?: string;\n  sourceRole?: string;\n  targetRole?: string;\n  reducedMotion?: boolean;\n}\nexport interface MotionPolicy {\n  id: string;\n  priority: number;\n  match: MotionPolicyMatch;\n  motionId: string;\n}`;
  const policies = real.map((p) => {
    const m = p.match;
    const parts = [];
    if (m.fromRoute !== undefined) parts.push(`fromRoute: '${esc(m.fromRoute)}'`);
    if (m.toRoute !== undefined) parts.push(`toRoute: '${esc(m.toRoute)}'`);
    if (m.fromShell !== undefined) parts.push(`fromShell: '${esc(m.fromShell)}'`);
    if (m.toShell !== undefined) parts.push(`toShell: '${esc(m.toShell)}'`);
    if (m.operation !== undefined) parts.push(`operation: '${esc(m.operation)}'`);
    if (m.containerRole !== undefined) parts.push(`containerRole: '${esc(m.containerRole)}'`);
    if (m.sourceRole !== undefined) parts.push(`sourceRole: '${esc(m.sourceRole)}'`);
    if (m.targetRole !== undefined) parts.push(`targetRole: '${esc(m.targetRole)}'`);
    if (m.reducedMotion !== undefined) parts.push(`reducedMotion: ${m.reducedMotion}`);
    return `    { id: '${esc(p.id)}', priority: ${p.priority}, match: { ${parts.join(', ')} }, motionId: '${esc(p.motionId)}' }`;
  });
  return `${HEADER}\n${iface}\n\nexport class MotionPolicyTable {\n  static readonly POLICIES: MotionPolicy[] = [\n${policies.join(',\n')}\n  ];\n}\n`;
}

// ── Write all ─────────────────────────────────────────────────────────────
function writeEts(name, content) {
  fs.writeFileSync(path.join(OUT_ETS, name), content);
  console.log(`  wrote entry/src/main/ets/contract/generated/${name}`);
}

function syncReaderUiGenerated(name) {
  const source = path.resolve(CONTRACTS_DIR, '..', '..', 'generated', 'arkts', name);
  if (!fs.existsSync(source)) {
    throw new Error(`missing canonical Reader UI ArkTS artifact: ${source}`);
  }
  fs.copyFileSync(source, path.join(OUT_READER_UI_ETS, name));
  console.log(`  synced entry/src/main/ets/contract/reader_ui/${name}`);
}
const colorJson = genColorJson();

writeEts('ColorTokens.ets', genColorTokens());
writeEts('DimensionTokens.ets', genDimensionTokens());
writeEts('TextConstraintTokens.ets', genTextConstraintTokens());
writeEts('TypeTokens.ets', genTypeTokens());
writeEts('MotionTokens.ets', genMotionTokens());
writeEts('ShadowTokens.ets', genShadowTokens());
writeEts('TokenRegistry.ets', genTokenRegistry());
writeEts('RouteTable.ets', genRouteTable());
writeEts('HostRequestTable.ets', genHostRequestTable());
writeEts('ViewStateTable.ets', genViewStateTable());
writeEts('MotionSpecTable.ets', genMotionSpecTable());
writeEts('MotionPolicyTable.ets', genMotionPolicyTable());
writeEts('DemoAliasTokens.ets', genDemoAliasTokens());
for (const name of ['Route.ets', 'RouteReconstructionQuarantine.ets', 'ViewState.ets', 'UiEvent.ets', 'UiState.ets', 'ScreenGraph.ets', 'Appearance.ets', 'VisualAdmission.ets']) {
  syncReaderUiGenerated(name);
}

fs.writeFileSync(path.join(OUT_RES_BASE, 'color.json'), colorJson.base);
console.log('  wrote entry/src/main/resources/base/element/color.json');
fs.writeFileSync(path.join(OUT_RES_DARK, 'color.json'), colorJson.dark);
console.log('  wrote entry/src/main/resources/dark/element/color.json');

console.log(`\nDone. Contracts: ${CONTRACTS_DIR}`);
console.log(`Tokens: ${TOKENS.length} | Routes: ${ACTIVE_ROUTES.length}/${ROUTES.length} active (quarantined=${QUARANTINED_ROUTE_IDS.size}) | ViewStates: ${VIEW_STATES.length} | Motions: ${MOTIONS.length} | Policies: ${POLICIES.filter((p) => p && p.id).length} | HostRequests: ${HOST_REQUEST_TYPES.length}`);
