import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "sdk-public-slots": {
    "description": "Current public Builder slots and actual native overlay collision negative; installed SDK",
    "resources": []
  },
  "header-paint-owner": {
    "description": "Actual retained HeaderHost policy/paint/clip/measurement with bad policy and omitted-paint counterexamples",
    "resources": []
  },
  "scaffold-slots": {
    "description": "Actual Scaffold slots, common layer order and measurement callbacks; no route-wide scan",
    "resources": []
  },
  "footer-safe-lane": {
    "description": "Actual retained bounded footer viewport/safe lane and omitted clip/paint negatives",
    "resources": []
  },
  "standard-page-layout": {
    "description": "Actual shared frame text/manga safe-area facts and measured standard page delegation",
    "resources": []
  },
  "framework-route-coverage": {
    "description": "Explicit full current route/branch architecture inventory with missing host/route/quiet-notice negatives; no product full test",
    "resources": []
  },
  "directory-layout-succession": {
    "description": "Explicit controlled full-directory baseline succession and bad callback/layout mutations",
    "resources": []
  },
  "sync-cold-layout": {
    "description": "Actual SDK cold/ready sync branch and explicit controlled baseline mutation",
    "resources": []
  }
};

async function case_sdk_public_slots() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { verifyReaderPageFrameworkCoverage } = await import('./lib/reader-page-framework-coverage.mjs');
const { readerPageBuilderSlots } = await import('./lib/reader-page-builder-slots.mjs');
const { verifyFullDirectoryLayoutSuccession } = await import('./lib/reader-full-directory-layout-successor.mjs');
const { verifyIndexSyncColdLayoutSuccession } = await import('./lib/index-sync-cold-layout-successor.mjs');
const { sharedProducerShape } = await import('./lib/architecture-shared-producer-contract.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
for (const [name, file, slots] of [
  ['ReaderPageScaffold', 'ui/layout/ReaderPageScaffold.ets', ['content', 'header', 'footer', 'overlayContent']],
  ['ReaderStandardPage', 'ui/layout/ReaderStandardPage.ets', ['content', 'nativeListItems', 'header', 'footer', 'overlayContent', 'boundedOverlayContent']],
  ['MainTabShell', 'features/shell/MainTabShell.ets', ['content', 'header', 'overlayContent', 'boundedOverlayContent', 'scrollOverlayContent']],
]) {
  const source = readFileSync(`entry/src/main/ets/${file}`, 'utf8');
  assert.deepEqual([...readerPageBuilderSlots(source, name)], slots, `${name}: all original public slots retain their actual declarations`);
  const collision = source.replaceAll('overlayContent', 'overlay');
  assert.notEqual(collision, source);
  assert.throws(() => readerPageBuilderSlots(collision, name), /collides.*native CustomComponent/,
    `${name}: the focused SDK gate must reject the compiler-only native overlay collision`);
}

}

const layoutSource = name => readFileSync(new URL(
  `../entry/src/main/ets/ui/layout/${name}.ets`, import.meta.url), 'utf8');
const emptyResponseRegion = { x: 0, y: 0, width: 0, height: 0 };
const fullResponseRegion = { x: 0, y: 0, width: '100%', height: '100%' };

async function currentPageLayoutProbe(windowMetrics, overrides = {}) {
  const [
    { createReaderBuilderProbe }, { createArkUIPropertyRuntimeProbe }, { boundedMembers },
    { actualReaderPageLayout }, { pureModuleProbe }, { actualReaderPostLayoutFrame }, { readerEditingSdk },
  ] = await Promise.all([
    import('./lib/reader-control-builder-probe.mjs'), import('./lib/arkui-property-runtime-probe.mjs'),
    import('./lib/bounded-surface-sdk-probe.mjs'), import('./lib/reader-page-shell-runtime-probe.mjs'),
    import('./lib/ets-pure-module-probe.mjs'), import('./lib/reader-post-layout-frame-probe.mjs'),
    import('./lib/reader-editing-sdk-probe.mjs'),
  ]);
  const layout = actualReaderPageLayout();
  const properties = createArkUIPropertyRuntimeProbe();
  const { ReaderNativeSlotMeasurement } = pureModuleProbe(layoutSource('ReaderNativeSlotMeasurement'),
    'ReaderNativeSlotMeasurement.ets', { ReaderPostLayoutFrame: actualReaderPostLayoutFrame(),
      readerMeasureSurfaceRect: () => undefined }, ['ReaderNativeSlotMeasurement']);
  const childSources = Object.fromEntries(['ReaderFixedHeaderHost', 'ReaderPageScrollHost', 'ReaderPageScaffold']
    .map(name => [name, layoutSource(name)]));
  const dependencies = { ...properties.sdk, ...layout, ...readerEditingSdk(), ...windowMetrics,
    ReaderNativeSlotMeasurement, ...overrides };
  const hooks = { ...properties.hooks, childSources, mountChildren: true };
  function actual(name, source = layoutSource(name), initialParams = {}) {
    return createReaderBuilderProbe(source, boundedMembers(source), dependencies, { ...hooks, initialParams });
  }
  for (const [name, source] of Object.entries(childSources)) dependencies[name] = actual(name, source).Component;
  return { actual, layout, properties, pureModuleProbe };
}

function pageProbes(owner) {
  return [owner, ...[...owner.children.values()].flatMap(pageProbes)];
}

async function case_header_paint_owner() {
  const { default: assert } = await import('node:assert/strict');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const appearance = (fixture, backgroundColor, transparent) => fixture.layout.readerFrameStyle({
    backgroundColor, headerBackground: backgroundColor, headerTransparent: transparent,
    footerBackground: backgroundColor,
  }).header;

  async function proof(scheme, overrides) {
    const fixture = await currentPageLayoutProbe({}, overrides);
    const opaque = readerAppColor('TOK_SURFACE_SOLID', scheme);
    const alternate = readerAppColor('TOK_PRIMARY_DARK', scheme);
    const heights = [];
    let mounted = 0;
    const { owner } = fixture.actual('ReaderFixedHeaderHost', undefined, {
      style: appearance(fixture, opaque, false), measurementKey: 1, content: () => mounted++,
      onHeightChange: (height, key) => heights.push([height, key]),
    });
    owner.initialRender();
    const node = [...owner.nodes.values()].find(value => value.type === 'Column');
    assert.equal(mounted, 1, 'the real header slot mounts once');
    assert.equal(node.width, '100%');
    assert.equal(node.zIndex, 10, 'the measured header paints above the body');
    assert.equal(node.backgroundColor, opaque, 'genuine native mask paints the supplied surface');
    assert.equal(node.clip, true);
    assert.equal(node.hitTestBehavior, 'HitTestMode.Default');
    assert.deepEqual(node.responseRegion, fullResponseRegion);
    const firstArea = node.onAreaChange;
    for (const height of [88, '95vp', -1, 'invalid']) firstArea({}, { height });
    assert.deepEqual(heights, [[88, 1], [95, 1]], 'malformed/negative measured sizes are rejected');
    owner.style = appearance(fixture, alternate, true);
    owner.measurementKey = 2;
    fixture.properties.flush();
    assert.equal(node.backgroundColor, '#00000000');
    assert.equal(node.clip, false, 'a floating header retains the bounded actor shadow');
    assert.equal(node.hitTestBehavior, 'HitTestMode.Default', 'a descendant hit still stops lower siblings');
    assert.deepEqual(node.responseRegion, emptyResponseRegion, 'the unpainted header has no response region of its own');
    firstArea({}, { height: 200 });
    node.onAreaChange({}, { height: 70 });
    assert.deepEqual(heights, [[88, 1], [95, 1], [70, 2]], 'outgoing measurement generation cannot reserve current page clearance');
    owner.style = appearance(fixture, alternate, false);
    fixture.properties.flush();
    assert.equal(node.backgroundColor, alternate, 'a new feature-resolved surface reaches the retained native carrier');
    assert.equal(node.clip, true);
    assert.deepEqual(node.responseRegion, fullResponseRegion);
    return fixture;
  }

  const fixture = await proof('day');
  await proof('night');
  const attributes = layoutSource('ReaderPageNativeAttributes');
  const omittedPaint = attributes.replace(
    'instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor).zIndex(10);',
    'instance.clip(this.style.clip).zIndex(10);');
  assert.notEqual(omittedPaint, attributes);
  const modifier = fixture.pureModuleProbe(omittedPaint, 'ReaderPageNativeAttributes.ets', {},
    ['ReaderHeaderFrameModifier']);
  await assert.rejects(() => proof('day', modifier), /genuine native mask/);
}

async function case_scaffold_slots() {
  const { default: assert } = await import('node:assert/strict');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const fixture = await currentPageLayoutProbe({});
  for (const clip of [false, true]) {
    const slots = [], headerHeights = [], footerHeights = [];
    const background = readerAppColor('app.window.background', 'day');
    const frameStyle = fixture.layout.readerFrameStyle({ backgroundColor: background, clip,
      headerBackground: background, footerBackground: background, footerSolid: clip });
    const geometry = { frameInsetLeft: 13, frameInsetRight: 17,
      header: { insetLeft: 0, insetRight: 0, top: 6 },
      footer: { insetLeft: 0, insetRight: 0, bottom: 28, surface: clip ? 'solid' : 'transparent' },
      content: { nativeEndInset: clip ? 82 : 0 } };
    const { owner } = fixture.actual('ReaderPageScaffold', undefined, { frameStyle, geometry, headerMeasurementKey: 7, footerMeasurementKey: 8,
      content: () => slots.push('body'), header: () => slots.push('header'), footer: () => slots.push('footer'),
      overlayContent: () => slots.push('overlay'), onHeaderHeightChange: (height, key) => headerHeights.push([height, key]),
      onFooterHeightChange: (height, key) => footerHeights.push([height, key]) });
    owner.initialRender();
    assert.deepEqual(slots, ['body', 'header', 'footer', 'overlay'], 'actual finite host delegates every slot exactly once');
    const nodes = [...owner.nodes.values()];
    const root = nodes.find(node => node.type === 'Stack' && node.padding?.left === 13 && node.padding?.right === 17);
    assert.deepEqual(root.padding, { left: 13, right: 17 }, 'measured safe/rail offsets go through the common frame');
    assert.equal(root.clip, clip);
    const layers = nodes.filter(node => [10, 20, 30].includes(node.zIndex));
    assert.deepEqual(layers.map(node => node.zIndex), [10, 20, 30], 'header, footer and overlay have one shared ordering');
    assert.deepEqual(layers.map(node => node.hitTestBehavior),
      ['HitTestMode.Default', 'HitTestMode.Default', 'HitTestMode.Transparent']);
    assert.deepEqual(layers[0].responseRegion, emptyResponseRegion, 'header gutters have no response region');
    const footerLane = layers[1];
    assert.deepEqual(footerLane.responseRegion, clip ? fullResponseRegion : emptyResponseRegion);
    assert.equal(footerLane.layoutGravity, 'LocalizedAlignment.BOTTOM');
    assert.equal(footerLane.height, undefined, 'the slot sizes to its measured content');
    assert.deepEqual(footerLane.padding, { bottom: clip ? 28 : 0 });
    assert.deepEqual(footerLane.margin, { bottom: clip ? 0 : 28 });
    const body = nodes.find(node => node.type === 'Stack' && node.zIndex === 0 && node !== root);
    assert.equal(body.height, clip ? 'calc(100% - 82vp)' : '100%');
    assert.equal(body.clip, clip);
    assert.deepEqual(layers[0].margin, { top: 6 });
    const header = pageProbes(owner).flatMap(actor => [...actor.nodes.values()])
      .find(node => node.type === 'Column' && node.onAreaChange && node.zIndex === 10);
    header.onAreaChange({}, { height: 97 });
    const footer = nodes.find(node => node.type === 'Column' && node.onAreaChange);
    assert.equal(header.hitTestBehavior, 'HitTestMode.Default', 'the painted header admits its child actions');
    assert.equal(footer.hitTestBehavior, 'HitTestMode.Default', 'the measurement carrier preserves sibling ordering');
    assert.deepEqual(footer.responseRegion, emptyResponseRegion);
    for (const carrier of [layers[0], footerLane, header, footer]) {
      assert.equal(carrier.onTouch, undefined, 'a layout carrier registers no touch handler');
      assert.equal(carrier.onClick, undefined);
    }
    footer.onAreaChange({}, { height: 54 });
    assert.deepEqual(headerHeights, [[97, 7]], 'the receipt contains slot height, without charging the scaffold top margin again');
    assert.deepEqual(footerHeights, [[54, 8]]);
  }
}

async function case_footer_safe_lane() {
  const { default: assert } = await import('node:assert/strict');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const fixture = await currentPageLayoutProbe({});
  const scaffoldSource = layoutSource('ReaderPageScaffold');

  function frameStyle(layout, backgroundColor, footerSolid = false) {
    return layout.readerFrameStyle({ backgroundColor, headerBackground: backgroundColor,
      footerBackground: backgroundColor, footerSolid });
  }

  function footerGeometry(layout, surface) {
    const input = new layout.ReaderPageGeometryInput();
    Object.assign(input, { viewportWidth: 393, viewportHeight: 852, footerHeight: 56, footerBottom: 42,
      footerInsetLeft: 20, footerInsetRight: 20, footerSurface: surface });
    return layout.resolveReaderPageGeometry(input);
  }

  function footerProof(layoutFixture, scheme = 'day', source = scaffoldSource) {
    const { layout, properties } = layoutFixture;
    const paper = readerAppColor('TOK_PAPER', scheme);
    const heights = [];
    let mounts = 0;
    const { owner } = layoutFixture.actual('ReaderPageScaffold', source, {
      headerVisible: false, frameStyle: frameStyle(layout, paper, true), geometry: footerGeometry(layout, 'solid'),
      footerMeasurementKey: 7, content: () => mounts++, footer: () => {},
      onFooterHeightChange: (height, key) => heights.push([height, key]),
    });
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    const viewport = nodes.find(node => node.type === 'Stack' && node.height === 'calc(100% - 98vp)');
    assert.ok(viewport, 'the public frame owns a bounded native content viewport above the fixed dock');
    assert.equal(viewport.clip, true, 'rows cannot paint or receive input below that viewport');
    const backing = nodes.find(node => node.type === 'Column' && node.zIndex === 20);
    assert.equal(backing.width, '100%', 'paper covers both card gutters');
    assert.equal(backing.backgroundColor, paper, 'the fixed lane paints its resolved paper color');
    assert.equal(backing.clip, true);
    assert.equal(backing.hitTestBehavior, 'HitTestMode.Default');
    assert.deepEqual(backing.responseRegion, fullResponseRegion);
    assert.deepEqual(backing.padding, { bottom: 42 }, 'the paper lane includes the complete bottom safe area');
    assert.deepEqual(backing.margin, { bottom: 0 });
    const measurement = nodes.find(node => node.type === 'Column' && node.onAreaChange);
    assert.deepEqual(measurement.padding, { left: 20, right: 20 });
    measurement.onAreaChange({}, { height: '54vp' });
    assert.deepEqual(heights, [[54, 7]], 'dock measurement excludes the already reserved bottom safe lane');

    owner.frameStyle = frameStyle(layout, paper);
    owner.geometry = footerGeometry(layout, 'transparent');
    properties.flush();
    assert.equal(backing.backgroundColor, '#00000000');
    assert.equal(backing.clip, false);
    assert.equal(backing.hitTestBehavior, 'HitTestMode.Default', 'a dock child hit still stops lower siblings');
    assert.deepEqual(backing.responseRegion, emptyResponseRegion, 'the transparent dock leaves gutters to the viewport');
    assert.deepEqual(backing.padding, { bottom: 0 });
    assert.deepEqual(backing.margin, { bottom: 42 });
    assert.equal(viewport.height, '100%');
    assert.equal(viewport.clip, false);
    assert.equal(mounts, 1, 'footer style and inset updates retain the body actor');
  }

  footerProof(fixture);
  footerProof(fixture, 'night');
  const noViewportClip = scaffoldSource.replace('.clip(this.geometry.content.nativeEndInset > 0)', '.clip(false)');
  assert.notEqual(noViewportClip, scaffoldSource);
  assert.throws(() => footerProof(fixture, 'day', noViewportClip), /rows cannot paint/);
  const noSafeLane = scaffoldSource.replace("bottom: this.footerSurfaceValue() === 'solid' ? this.geometry.footer.bottom : 0", 'bottom: 0');
  assert.notEqual(noSafeLane, scaffoldSource);
  assert.throws(() => footerProof(fixture, 'day', noSafeLane), /complete bottom safe area/);
  const mode = ".hitTestBehavior(HitTestMode.Default)\n        .responseRegion(readerLayoutCarrierResponseRegion(this.footerSurfaceValue() === 'solid'))";
  const noSiblingFence = scaffoldSource.replace(mode, mode.replace('HitTestMode.Default',
    "this.footerSurfaceValue() === 'solid' ? HitTestMode.Default : HitTestMode.None"));
  assert.notEqual(noSiblingFence, scaffoldSource);
  assert.throws(() => footerProof(fixture, 'day', noSiblingFence), /dock child hit still stops lower siblings/);
  const noEmptyGutter = scaffoldSource.replace(mode, mode.replace("this.footerSurfaceValue() === 'solid'", 'true'));
  assert.notEqual(noEmptyGutter, scaffoldSource);
  assert.throws(() => footerProof(fixture, 'day', noEmptyGutter), /transparent dock leaves gutters/);
  const attributes = layoutSource('ReaderPageNativeAttributes');
  const noFooterPaint = attributes.replace('instance.clip(this.style.clip).backgroundColor(this.style.backgroundColor);',
    'instance.clip(this.style.clip);');
  assert.notEqual(noFooterPaint, attributes);
  const modifier = fixture.pureModuleProbe(noFooterPaint, 'ReaderPageNativeAttributes.ets', {}, ['ReaderFooterFrameModifier']);
  const unpaintedFixture = await currentPageLayoutProbe({}, modifier);
  assert.throws(() => footerProof(unpaintedFixture), /fixed lane paints/);

  const { layout, properties } = fixture;
  assert.throws(() => layout.readerStandardPageSpec('private99'), /Unknown|unknown/);
  assert.throws(() => layout.readerPageInitialHeaderHeight('private99'), /Unknown|unknown/);
  const windowPaper = readerAppColor('app.window.background', 'day');
  let mounts = 0;
  const { owner } = fixture.actual('ReaderPageScaffold', undefined, { headerVisible: false,
    frameStyle: frameStyle(layout, windowPaper), geometry: layout.readerEmptyPageGeometry(), content: () => mounts++ });
  owner.initialRender();
  const root = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.padding);
  assert.equal(root.backgroundColor, windowPaper, 'the first frame uses the supplied window paper');
  owner.frameStyle = frameStyle(layout, '#FF314159');
  properties.flush();
  assert.equal(root.backgroundColor, '#FF314159', 'updated window paper reaches the retained reading frame');
  owner.pageVisible = false;
  properties.flush();
  assert.equal(root.opacity, 0);
  assert.equal(root.hitTestBehavior, 'HitTestMode.Transparent');
  owner.pageVisible = true;
  properties.flush();
  assert.equal(root.opacity, 1);
  assert.equal(root.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(mounts, 1, 'paper and visibility updates preserve the persistent reader actor');
}

async function case_standard_page_layout() {
  const { default: assert } = await import('node:assert/strict');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const windowMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const metrics = windowMetrics.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393;
  metrics.windowRect.height = 852;
  metrics.systemInsets.top = 32;
  metrics.cutoutInsets.top = 40;
  metrics.systemInsets.left = 24;
  metrics.cutoutInsets.right = 30;
  const fixture = await currentPageLayoutProbe(windowMetrics, { readerWindowMetrics: () => metrics, readerAppColor });

  const variants = ['management', 'settings', 'rssManagement', 'rssEditor', 'rssFeed', 'rssDetail', 'tools',
    'sync', 'sourceManagement', 'settingsHome', 'settingsGeneral'];
  for (const variant of variants) {
    let bodyMounted = 0;
    const { owner } = fixture.actual('ReaderStandardPage', undefined, { variant, content: () => bodyMounted++ });
    owner.aboutToAppear();
    owner.initialRender();
    const actors = pageProbes(owner);
    const body = [...owner.nodes.values()].find(node => node.type === 'Column' && node.padding?.left === 24);
    const scroll = actors.find(actor => actor.layout !== undefined && [...actor.nodes.values()].some(node => node.type === 'Scroll'));
    assert.ok(body && scroll, 'actual StandardPage delegates its body and insets to the shared Scroll host');
    const padding = [...scroll.nodes.values()].find(node => node.type === 'Column' && node.padding);
    assert.deepEqual([body.padding.left, body.padding.right, padding.padding.top], [24, 30, 66],
      'conventional content obeys visual safe sides without charging the system top twice');
    assert.equal(bodyMounted, 1);
    const header = actors.find(actor => actor.style !== undefined && actor.nativeMeasurement !== undefined);
    assert.ok(header, 'actual StandardPage → Scaffold → HeaderHost child delegation');
    const measured = [...header.nodes.values()].find(node => node.onAreaChange);
    measured.onAreaChange({}, { height: '93vp' });
    fixture.properties.flush();
    assert.equal(padding.padding.top, 101, 'measured expanded header updates actual Scroll clearance');
    assert.equal(bodyMounted, 1, 'a measured chrome update retains the native content slot');
    measured.onAreaChange({}, { height: -1 });
    fixture.properties.flush();
    assert.equal(padding.padding.top, 101);

    const outer = [...owner.nodes.values()].find(node => node.type === '__Common__' && node.onAreaChange);
    assert.ok(outer, 'the real component keeps its own viewport callback');
    const oldHeaderArea = measured.onAreaChange;
    outer.onAreaChange({}, { width: '365vp', height: '852vp', globalPosition: { x: 0, y: 0 } });
    fixture.properties.flush();
    assert.equal(owner.viewportWidth, 365, 'native vp area strings preserve the narrow-host measurement');
    assert.equal(owner.geometry.content.frame.width, 311, 'layout uses measured host width');
    const currentTop = padding.padding.top;
    oldHeaderArea({}, { height: '185vp' });
    fixture.properties.flush();
    assert.equal(padding.padding.top, currentTop, 'retired viewport receipt cannot move current content');
    assert.equal(bodyMounted, 1);
  }
}

async function case_framework_route_coverage() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { verifyReaderPageFrameworkCoverage } = await import('./lib/reader-page-framework-coverage.mjs');
const { readerPageBuilderSlots } = await import('./lib/reader-page-builder-slots.mjs');
const { verifyFullDirectoryLayoutSuccession } = await import('./lib/reader-full-directory-layout-successor.mjs');
const { verifyIndexSyncColdLayoutSuccession } = await import('./lib/index-sync-cold-layout-successor.mjs');
const { sharedProducerShape } = await import('./lib/architecture-shared-producer-contract.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const coverageContract = JSON.parse(readFileSync('tools/fixtures/reader-page-framework-coverage.json', 'utf8'));
const coverage = verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract);
assert.ok(coverage.routes>0);
const source = file => readFileSync(`entry/src/main/ets/${file}`, 'utf8');
const indexSource = source('pages/Index.ets');
for (const [name, before, after] of [
  ['extra naked text catalog sibling', 'ReaderFullDirectory({', "Column() { Text('unregistered text catalog'); }\n        ReaderFullDirectory({"],
  ['extra unknown text catalog actor', 'ReaderFullDirectory({', 'UnregisteredCatalogPage({});\n        ReaderFullDirectory({'],
  ['retained reading naked sibling', 'if (this.readingEntry.sessionActive && this.readingEntry.book !== undefined) {', "if (this.readingEntry.sessionActive && this.readingEntry.book !== undefined) {\n        Text('unregistered retained reader');"],
  ['new side page outside primary chain', 'if (this.readingEntry.sessionActive && this.readingEntry.book !== undefined) {', "if (this.privateCatalogVisible) { Text('unregistered side page'); }\n      if (this.readingEntry.sessionActive && this.readingEntry.book !== undefined) {"],
  ['manga preview naked sibling', 'if (this.mangaSourceSwitchSelection !== undefined) {\n      BookDirectoryPage({', "if (this.mangaSourceSwitchSelection !== undefined) {\n      Text('unregistered manga preview');\n      BookDirectoryPage({"],
  ['cold sync returns to private body', "ReaderPageScaffold({ variant: 'standard', content: (): void => { this.syncPreparingContent(); } });", 'this.syncPreparingContent();'],
]) {
  const changed = indexSource.replace(before, after); assert.notEqual(changed, indexSource, name + ': actual mutation target');
  assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract, file => file === 'pages/Index.ets' ? changed : source(file)),
    /category\/common-host|actual registration|registered page\/window actor/, name + ': retaining a sibling common frame cannot hide this bare branch');
}
for (const [name, before, after] of [
  ['quiet feedback cannot claim full screen', ".align(Alignment.Top).zIndex(220).hitTestBehavior(HitTestMode.Transparent)", ".height('100%').align(Alignment.Top).zIndex(220).hitTestBehavior(HitTestMode.Transparent)"],
  ['quiet feedback cannot mask page input', ".align(Alignment.Top).zIndex(220).hitTestBehavior(HitTestMode.Transparent)", ".align(Alignment.Top).zIndex(220).hitTestBehavior(HitTestMode.Block)"],
  ['quiet feedback cannot drop route admission', 'this.readingEntry.recoveryNoticeVisible()', 'this.readingEntry.recoveryNotice.visible'],
]) {
  const changed = indexSource.replace(before, after); assert.notEqual(changed, indexSource, name);
  assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
    file => file === 'pages/Index.ets' ? changed : source(file)), /quiet feedback/, name);
}
const readerSource=source('features/reading/ui/ReaderShell.ets');
const detachedKind=readerSource.replace('readingContentKind: this.contentKind',"readingContentKind: 'text'");assert.notEqual(detachedKind,readerSource);
assert.throws(()=>verifyReaderPageFrameworkCoverage(process.cwd(),coverageContract,file=>file==='features/reading/ui/ReaderShell.ets'?detachedKind:source(file)),/exact page\/runtime fact/);
const missingHostFile = 'features/bookshelf/ui/BookshelfManagementPage.ets';
const original = source(missingHostFile);
const missingHost = original.replace('ReaderStandardPage({', 'PrivatePageHost({');
assert.notEqual(missingHost, original);
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === missingHostFile ? missingHost : source(file)), /category\/common-host binding removed/,
  'a local page reverting to a private host fails reverse coverage');
const bareUiSlot = original.replace('this.pageHeader();', "PageBackBar({ title: '管理' });");
assert.notEqual(bareUiSlot, original);
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === missingHostFile ? bareUiSlot : source(file)), /bare UI component inside shared BuilderParam/,
  'component calls inside ordinary lambdas cannot pretend to be SDK-emitted native Builder slots');
const extraRoute = source('pages/Index.ets').replace("type ReaderRoute = 'bookshelf'", "type ReaderRoute = 'privateUnregisteredPage' | 'bookshelf'");
assert.throws(() => verifyReaderPageFrameworkCoverage(process.cwd(), coverageContract,
  file => file === 'pages/Index.ets' ? extraRoute : source(file)), /every actual route requires exactly one/,
  'new routes cannot bypass category registration');

}

async function case_directory_layout_succession() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { verifyReaderPageFrameworkCoverage } = await import('./lib/reader-page-framework-coverage.mjs');
const { readerPageBuilderSlots } = await import('./lib/reader-page-builder-slots.mjs');
const { verifyFullDirectoryLayoutSuccession } = await import('./lib/reader-full-directory-layout-successor.mjs');
const { verifyIndexSyncColdLayoutSuccession } = await import('./lib/index-sync-cold-layout-successor.mjs');
const { sharedProducerShape } = await import('./lib/architecture-shared-producer-contract.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const readWorkspace=file=>readFileSync(file,'utf8');const architectureBaseline=JSON.parse(readWorkspace('tools/architecture-consumer-baseline.json'));
const fullFile = 'entry/src/main/ets/features/reading/ui/ReaderFullDirectory.ets', fullSource = readWorkspace(fullFile);
verifyFullDirectoryLayoutSuccession(architectureBaseline, readWorkspace, sharedProducerShape);
for (const [before, after] of [
  ['header: (): void => { this.topBar(); }', 'header: (): void => {}'],
  ['content: (): void => { this.directoryContent(); }', 'content: (): void => {}'],
  ['overlayContent: (): void => { this.directoryOverlay(); }', 'overlayContent: (): void => { this.offlineBookMenu(); }'],
  ['Column() { this.recoveryContent(); }', 'Column() {}'],
  ['Column() { this.recoveryContent(); }', 'Column() { this.recoveryContent(); this.unregisteredPendingMessage(); }'],
  ['onReconcileBookmarks: this.onReconcileBookmarks', 'onReconcileBookmarks: this.onContinueBookmarks'],
  ['.zIndex(8).hitTestBehavior(HitTestMode.Transparent)', '.height(999).zIndex(8).hitTestBehavior(HitTestMode.Block)'],
  ['.height(this.panelViewportHeight())', '.height(Math.max(0, this.panelViewportHeight() - 100))'],
  ["allowUnanchoredBrowse: this.catalogContext === 'detail'", 'allowUnanchoredBrowse: false'],
  ['.opacity(this.shouldAnimatePanel() ? this.panelProgress : 1)\n      .clip(true)', '.opacity(this.shouldAnimatePanel() ? this.panelProgress : 1)\n      .clip(false)'],
  ['.fontSize(TYPE_READER_DIRECTORY_BOOK_TITLE.fontSizeFp)', '.fontSize(99)'],
  ["if (this.catalogContext === 'detail') return 18;", "if (this.catalogContext === 'detail') return Math.max(18, readerVisualSafeTop(ReaderWindowCoordinator.metrics()));"],
  ['return Math.max(18, readerVisualSafeTop(ReaderWindowCoordinator.metrics()));', 'return 18;'],
  ['if (this.readerWindowMetricsRevision < 0) return 18;', 'if (false) return 18;'],
]) {
  const changed = fullSource.replace(before, after); assert.notEqual(changed, fullSource);
  assert.throws(() => verifyFullDirectoryLayoutSuccession(architectureBaseline, file => file === fullFile ? changed : readWorkspace(file), sharedProducerShape));
}

}

async function case_sync_cold_layout() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { verifyReaderPageFrameworkCoverage } = await import('./lib/reader-page-framework-coverage.mjs');
const { readerPageBuilderSlots } = await import('./lib/reader-page-builder-slots.mjs');
const { verifyFullDirectoryLayoutSuccession } = await import('./lib/reader-full-directory-layout-successor.mjs');
const { verifyIndexSyncColdLayoutSuccession } = await import('./lib/index-sync-cold-layout-successor.mjs');
const { sharedProducerShape } = await import('./lib/architecture-shared-producer-contract.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const read = name => readFileSync(`entry/src/main/ets/ui/layout/${name}.ets`, 'utf8');
const policySource = readFileSync(readerPageShellSourceUrl, 'utf8');
const flatten = owner => [...owner.nodes.values(), ...[...owner.children.values()].flatMap(flatten)];
const findChild = (owner, predicate) => {
  for (const child of owner.children.values()) { if (predicate(child)) return child; const nested = findChild(child, predicate); if (nested) return nested; }
};
function actual(name, dependencies = {}, hooks = {}, source = read(name)) {
  const properties = createArkUIPropertyRuntimeProbe();
  return { ...createReaderBuilderProbe(source, boundedMembers(source), { ...properties.sdk, ...dependencies },
    { ...properties.hooks, ...hooks }), properties };
}

const source=file=>readFileSync(`entry/src/main/ets/${file}`,'utf8');const indexSource=source('pages/Index.ets');const readWorkspace=file=>readFileSync(file,'utf8');const architectureBaseline=JSON.parse(readWorkspace('tools/architecture-consumer-baseline.json'));
verifyIndexSyncColdLayoutSuccession(architectureBaseline, readWorkspace);
for (const [before, after] of [
  ['content: (): void => { this.syncPreparingContent(); }', 'content: (): void => {}'],
  ["Text('正在读取安全配置…');", "Text('正在读取安全配置…').fontSize(99);"],
  ["}.width('100%').height('100%').justifyContent(FlexAlign.Center);", "}.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor('#FF010203');"],
]) {
  const changed = indexSource.replace(before, after); assert.notEqual(changed, indexSource);
  assert.throws(() => verifyIndexSyncColdLayoutSuccession(architectureBaseline, file => file === 'entry/src/main/ets/pages/Index.ets' ? changed : readWorkspace(file)));
}
for (const ready of [false, true]) {
  const properties = createArkUIPropertyRuntimeProbe();
  class OtherActor { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); this.nodes = new Map(); this.children = new Map(); } }
  const components = { BookshelfMultiSelectPage: 'features/bookshelf/ui/BookshelfMultiSelectPage.ets', ReaderShell: 'features/reading/ui/ReaderShell.ets',
    SyncPage: 'features/sync/ui/SyncPage.ets', ReaderJourneyRecoveryNotices: 'app/composition/ReaderJourneyRecoveryNotices.ets', ReaderLayoutDebugOverlay: 'app/composition/ReaderLayoutDebugOverlay.ets', ArkWebExecutionHost: 'ui/platform/ArkWebExecutionHost.ets' };
  const metrics = createDefaultReaderWindowMetrics();
  const { owner } = createReaderBuilderProbe(indexSource, ['build', 'syncContent', 'syncSurface', 'syncPreparingContent', 'readerOwnsWindowEdges', 'mangaOwnsWindowEdges', 'appContentTopInset'],
    { ...properties.sdk, ...Object.fromEntries(Object.keys(components).map(name => [name, OtherActor])),
      ReaderWindowCoordinator: { metrics: () => metrics }, readerContentSafeTop, isReaderProductSurfaceEnabled: () => true, deviceInfo: { deviceType: 'phone' } },
    { ...properties.hooks, mountChildren: true, childSources: Object.fromEntries(Object.entries(components).map(([name, file]) => [name, source(file)])) });
  Object.assign(owner, { route: 'sync', syncSnapshotReady: ready, syncSnapshot: {}, navigationGeneration: 7,
    detailShelfAdmissionMount: 3, syncPresentationIdentity: 'sync-window', getSyncOrchestrator: () => ({}),
    readingSessionActive: false, jsonImportVisible: false, appThemeScheme: 'day', readerWindowMetricsRevision: 0 });
  owner.initialRender();
  const descendants = actor => [actor, ...[...(actor.children?.values() ?? [])].flatMap(descendants)];
  const actors = descendants(owner);
  if (ready) {
    const sync = actors.find(actor => actor.params?.snapshot === owner.syncSnapshot);
    assert.ok(sync, 'actual ready branch still mounts the original SyncPage with its current snapshot');
    assert.equal(actors.filter(actor => actor.variant === 'standard').length, 0, 'cold frame cannot cover the ready branch');
  } else {
    const frame = actors.find(actor => actor.variant === 'standard'); assert.ok(frame, 'actual cold branch owns its own common frame');
    const label = flatten(owner).find(node => node.type === 'Text' && node.create === '正在读取安全配置…'); assert.ok(label);
    const column = [...owner.nodes.values()].find(node => node.type === 'Column' && node.justifyContent === 'FlexAlign.Center');
    assert.deepEqual([column.width, column.height], ['100%', '100%']);
    assert.equal(column.backgroundColor, undefined); assert.equal(label.fontSize, undefined, 'original native AUTO survives the real cold slot');
    const root = [...frame.nodes.values()].find(node => node.type === 'Stack' && node.padding);
    for (const scheme of ['day', 'night']) { frame.appThemeScheme = scheme; properties.flush(); assert.equal(root.backgroundColor, readerAppColor('TOK_PAPER', scheme)); }
  }
}

}

const implementations = {'sdk-public-slots':case_sdk_public_slots,'header-paint-owner':case_header_paint_owner,'scaffold-slots':case_scaffold_slots,'footer-safe-lane':case_footer_safe_lane,'standard-page-layout':case_standard_page_layout,'framework-route-coverage':case_framework_route_coverage,'directory-layout-succession':case_directory_layout_succession,'sync-cold-layout':case_sync_cold_layout};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
