// Explicit, issue-local SDK evidence. No default gate, HAP, network or device I/O.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
const { createReaderBuilderProbe } = await import('../../lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('../../lib/arkui-property-runtime-probe.mjs');
const { readerFoundationTokens } = await import('../../lib/reader-foundation-control-probe.mjs');
const { installedEtsCompiler } = await import('../../lib/ets-compiler-runtime.mjs');
const { pureModuleProbe } = await import('../../lib/ets-pure-module-probe.mjs');
const { readerAppColor } = await import('../../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { createDefaultReaderWindowMetrics, readerVisualSafeTop, readerVisualSafeBottom } =
  await import('../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const root = new URL('../../../', import.meta.url);
const inputs = ['entry/src/main/ets/features/search/SearchPage.ets',
  'entry/src/main/ets/features/common/ReaderPageScaffold.ets',
  'entry/src/main/ets/features/common/ReaderFixedHeaderHost.ets',
  'entry/src/main/ets/features/common/ReaderPageShell.ts'];
const source = readFileSync(new URL(inputs[0], root), 'utf8');
const methods = ['build', 'searchHeader', 'hasSearchSession', 'searchOuterInset',
  'searchHeaderHeight', 'searchHeaderLayoutKey', 'searchHeaderMeasurementKey',
  'acceptSearchHeaderHeight', 'searchContentStartInset', 'searchFontScale',
  'searchFilterHeight', 'searchFilterMaxHeight', 'searchBarHeight', 'searchStatsHeight',
  'searchResultWidth', 'searchActionWidth', 'searchControlHeight'];
// Only the two unchanged geometry helpers are needed; do not initialize all
// historical button/field specs or their unrelated typography constructors.
const controlSource = readFileSync(new URL('entry/src/main/ets/features/common/ReaderControlSpecs.ets', root), 'utf8');
const { ts, options } = installedEtsCompiler();
const controlTree = ts.createSourceFile('SearchControls.ets', controlSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.deepEqual(controlTree.parseDiagnostics, []);
const geometryNames = ['readerSearchActionWidth', 'readerSearchControlHeight'];
const geometrySource = controlTree.statements.filter(node => geometryNames.includes(node.name?.getText(controlTree)))
  .map(node => node.getText(controlTree)).join('\n');
const specs = pureModuleProbe(geometrySource, 'SearchControls.ets', {}, geometryNames);
const checks = [];
const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];

function mount(definition, { scheme, kind, expanded, tablet = false }) {
  const properties = createArkUIPropertyRuntimeProbe();
  // The native AppStorage theme is the only storage seam. Real SDK primitive
  // properties and actual production child constructors still execute.
  class ThemeProperty extends properties.sdk.ObservedPropertySimplePU {
    constructor(value, owner, name) { super(name === 'appThemeScheme' ? scheme : value, owner, name); }
  }
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = tablet ? 736 : 390;
  metrics.windowRect.height = 844;
  metrics.systemFontScale = 1;
  const probe = createReaderBuilderProbe(definition, methods, {
    ...properties.sdk, ObservedPropertySimplePU: ThemeProperty, ...readerFoundationTokens,
    ...specs, readerVisualSafeTop, readerVisualSafeBottom,
    ReaderWindowCoordinator: { metrics: () => metrics },
  }, { ...properties.hooks, mountChildren: true });
  const owner = probe.owner;
  const slotCalls = { content: 0, input: 0, progress: 0, scope: 0, type: 0 };
  Object.assign(owner, { appThemeScheme: scheme, isTablet: tablet, readerWindowMetricsRevision: 7,
    presentation: { kind }, filtersExpanded: expanded, fixedHeaderHeight: 0, fixedHeaderLayoutKey: '',
    progressHeight: 0, progressHeightLayoutKey: '', headerAnchorPending: false,
    viewState: { anchorAtStart: false },
    contentFrame: () => ({ width: metrics.windowRect.width, left: 0, right: 0 }),
    ownsPageQuery: () => true, ownsList: () => false,
    // Existing business/list and control contents are outside the painted
    // ancestor/card geometry. No assertion claims their native layout.
    stateContent: () => slotCalls.content++, searchBar: () => slotCalls.input++,
    filterProgressRow: () => slotCalls.progress++, groupScopeRow: () => slotCalls.scope++,
    contentTypeRow: () => slotCalls.type++,
  });
  owner.initialRender();
  const scaffold = [...owner.children.values()].find(child => child.params?.variant === 'search');
  assert.ok(scaffold, 'actual SearchPage build mounts its production scaffold');
  const header = [...scaffold.children.values()].find(child => typeof child.areaChangeHandler === 'function');
  assert.ok(header, 'actual scaffold mounts the production fixed header host');
  return { owner, scaffold, header, slotCalls, properties, metrics };
}

function inspect(testCase, mounted) {
  const { owner, scaffold, header, slotCalls } = mounted;
  assert.equal(scaffold.headerKind, 'floating', 'search connects to the transparent floating host');
  assert.equal(header.kind, 'floating', 'scaffold forwards the same production header kind');
  const host = [...header.nodes.values()].find(node => typeof node.onAreaChange === 'function');
  assert.ok(host, 'actual header owns the native area callback');
  assert.equal(host.backgroundColor, 'Color.Transparent', 'outer full-width header cannot paint a second paper rectangle');
  assert.equal(host.clip, false, 'positioning host does not impose a second rectangular clipping edge');
  const cardColor = readerAppColor('app.search.panelSurface', testCase.scheme);
  const cards = walk(owner).flatMap(component => [...component.nodes.values()])
    .filter(node => node.backgroundColor === cardColor);
  assert.equal(cards.length, 1, 'one actual bounded card owns the search panel surface');
  const card = cards[0];
  assert.equal(card.border?.color, readerAppColor('app.search.panelBorder', testCase.scheme));
  assert.equal(card.border?.width, readerFoundationTokens.TOK_BORDER_W);
  assert.equal(card.borderRadius, 13);
  assert.equal(card.clip, true, 'content clips to the same rounded node that owns its border');
  assert.equal(card.shadow, undefined, 'this search card has no second external painted edge');
  const outer = walk(owner).flatMap(component => [...component.nodes.values()]).find(node =>
    node.padding?.bottom === 6 && node.padding?.left === (testCase.tablet ? 20 : 16));
  assert.ok(outer, 'original external side/bottom spacing remains on its transparent wrapper');
  assert.equal(outer.backgroundColor, undefined);
  assert.deepEqual(slotCalls, { content: 1, input: 1, progress: testCase.kind === 'results' ? 1 : 0,
    scope: testCase.kind === 'results' && testCase.expanded ? 1 : 0,
    type: testCase.kind === 'results' && testCase.expanded ? 1 : 0 });

  const key = owner.searchHeaderMeasurementKey();
  assert.equal(header.measurementKey, key, 'real measurement identity crosses both shared parents');
  const oldCallback = host.onAreaChange;
  oldCallback({}, { height: '123vp' });
  assert.equal(owner.fixedHeaderHeight, 123, 'actual native callback still reaches the original page acceptance');
  assert.equal(owner.searchContentStartInset(), 123, 'accepted native height remains the list clearance');
  owner.readerWindowMetricsRevision++;
  oldCallback({}, { height: '234vp' });
  assert.equal(owner.fixedHeaderHeight, 123, 'a prior window/header receipt cannot move the current list');
  header.measurementKey = owner.searchHeaderMeasurementKey();
  const currentCallback = header.areaChangeHandler(header.measurementKey);
  currentCallback({}, { height: 124 });
  assert.equal(owner.fixedHeaderHeight, 124, 'new current receipt still travels through the unchanged callback chain');
  oldCallback({}, { height: 999 });
  assert.equal(owner.fixedHeaderHeight, 124, 'host itself retires its old captured callback');
  for (const invalid of [NaN, -1, Infinity, 'bad']) currentCallback({}, { height: invalid });
  assert.equal(owner.fixedHeaderHeight, 124);
  return { ...testCase, hostBackground: host.backgroundColor, cardBackground: card.backgroundColor,
    border: card.border, cardRadius: card.borderRadius, cardClip: card.clip, preservedHeightCallback: true };
}

for (const scheme of ['day', 'night']) for (const kind of ['initial', 'results'])
  for (const expanded of [false, true]) for (const tablet of [false, true]) {
    const testCase = { scheme, kind, expanded, tablet };
    checks.push(inspect(testCase, mount(source, testCase)));
  }

// Restore only the old production host selection in memory. If the probe
// inspected the inner card alone, this known faulty ancestor would pass.
const baseline = source.replace("variant: 'search', headerKind: 'floating'", "variant: 'search', headerKind: 'search'");
assert.notEqual(baseline, source, 'negative control changes precisely the former host wiring');
const baselineCase = { scheme: 'day', kind: 'results', expanded: false };
const old = mount(baseline, baselineCase);
const oldHost = [...old.header.nodes.values()].find(node => typeof node.onAreaChange === 'function');
assert.equal(oldHost.backgroundColor, readerAppColor('TOK_PAPER', 'day'), 'old real modifier reproduces the full-width solid paper');
assert.throws(() => inspect(baselineCase, old), assert.AssertionError);

const result = { result: 'PASS', evidence: 'SDK-lowered production builders and real page-policy property emission; no native layout or pixel acceptance',
  inputs: Object.fromEntries(inputs.map(path => [path, createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')])),
  checks, negativeControl: { rejected: true, oldHostBackground: oldHost.backgroundColor } };
writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(`PASS ${checks.length} search header surface cases; actual ancestor paint, same-node card edge and height callback chain; old solid-host control rejected. Native pixels remain unverified.`);
