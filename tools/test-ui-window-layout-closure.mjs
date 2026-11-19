import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  'standard-page-generation': {
    description: 'Actual StandardPage methods and real page geometry reject stale reads/receipts across layout generations and unmount; no native rendering',
    resources: [],
  },
  'standard-page-same-area': { description: 'Same-box geometry changes retain slot facts; actual native slot hosts re-read new requests without Area and retire old frames.', resources: [] },
  'direct-page-same-area': { description: 'Actual detail/manga owners retain same-shape header and footer facts, independently renew real dependencies, and use finite current native supplementation.', resources: [] },
  'window-environment': {
    description: 'Actual readonly environment/coordinator binding shares the current snapshot; finite fake platform I/O, no window or device',
    resources: [],
  },
};

for (const id of selectContractCases(CONTRACT_CASES)) {
  if (id === 'standard-page-generation') await standardPageGeneration();
  else if (id === 'standard-page-same-area') await standardPageSameArea();
  else if (id === 'direct-page-same-area') await directPageSameArea();
  else await windowEnvironment();
  recordContractCasePass(id);
}

async function standardPageGeneration() {
  const { default: assert } = await import('node:assert/strict');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { APP_HEADER_BAR_HEIGHT } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
  const layout = actualReaderPageLayout();
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393;
  metrics.windowRect.height = 852;
  metrics.ready = true;
  const Owner = selectedProductionMethods(new URL(
    '../entry/src/main/ets/ui/layout/ReaderStandardPage.ets', import.meta.url), 'ReaderStandardPage', [
    'aboutToAppear', 'aboutToDisappear', 'onLayoutInputsChanged', 'recordMeasurement',
    'headerHeight', 'footerHeight', 'refreshGeometry',
  ], { ...layout, readerInteractiveSafeLeft, readerInteractiveSafeRight, APP_HEADER_BAR_HEIGHT, readerWindowMetrics: () => metrics,
    ReaderWindowCoordinator: { metrics: () => metrics } });
  const owner = Object.assign(new Owner(), {
    mounted: false, measurementKey: 0, footerMeasurementKey: 0, headerInputs: '', footerInputs: '', geometryRevision: 0, viewportWidth: 393, viewportHeight: 852,
    variant: 'settingsHome', contentLeadingRail: 0, contentEndInset: -1,
    measurements: new layout.ReaderMeasurementStore(), geometry: new layout.ReaderPageGeometry(),
  });
  owner.aboutToAppear();
  const firstKey = owner.measurementKey;
  owner.recordMeasurement('standard:header', 93, firstKey);
  owner.recordMeasurement('standard:footer', 84, firstKey);
  assert.equal(owner.headerHeight(), 93);
  assert.equal(owner.footerHeight(), 84);
  assert.equal(owner.geometry.content.startInset, 93 + layout.READER_STANDARD_PAGE_CONTENT_GAP);

  owner.viewportWidth = 320;
  owner.viewportHeight = 700;
  owner.onLayoutInputsChanged();
  const resizedKey = owner.measurementKey;
  assert.notEqual(resizedKey, firstKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a resized layout cannot read the preceding header measurement');
  assert.equal(owner.footerHeight(), 0, 'a resized layout cannot read the preceding footer measurement');
  assert.equal(owner.geometry.content.startInset, APP_HEADER_BAR_HEIGHT + layout.READER_STANDARD_PAGE_CONTENT_GAP);
  assert.ok(owner.geometry.content.frame.width <= 320, 'actual local viewport bounds the new geometry');
  const resizedGeometry = owner.geometry;
  owner.recordMeasurement('standard:header', 500, firstKey);
  owner.recordMeasurement('standard:footer', 500, firstKey);
  assert.equal(owner.geometry, resizedGeometry, 'old native callbacks cannot publish geometry for a new layout');
  owner.recordMeasurement('standard:header', 76, resizedKey);
  owner.recordMeasurement('standard:footer', 64, resizedKey);
  assert.equal(owner.headerHeight(), 76);
  assert.equal(owner.footerHeight(), 64);
  assert.equal(owner.geometry.content.startInset, 76 + layout.READER_STANDARD_PAGE_CONTENT_GAP);

  metrics.systemFontScale = 1.5;
  metrics.revision += 1;
  owner.onLayoutInputsChanged();
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a font/environment revision also invalidates current measurements');
  assert.equal(owner.footerHeight(), 0);
  owner.recordMeasurement('standard:header', 110, owner.measurementKey);
  owner.recordMeasurement('standard:footer', 96, owner.measurementKey);
  assert.equal(owner.headerHeight(), 110);
  assert.equal(owner.footerHeight(), 96);

  owner.contentLeadingRail = 88;
  owner.contentEndInset = 24;
  owner.onLayoutInputsChanged();
  const railKey = owner.measurementKey;
  owner.recordMeasurement('standard:footer', 160, owner.footerMeasurementKey);
  assert.equal(owner.footerHeight(), 0, 'a rail cannot charge a simultaneous bottom navigation height');
  assert.equal(owner.geometry.content.endInset, 24, 'the explicit rail end budget reaches actual geometry');

  owner.contentLeadingRail = 0;
  owner.contentEndInset = -1;
  owner.onLayoutInputsChanged();
  assert.equal(owner.footerHeight(), 0, 'returning to a bottom bar cannot revive the rail generation receipt');
  const mountedKey = owner.measurementKey;
  owner.aboutToDisappear();
  const retiredGeometry = owner.geometry;
  owner.recordMeasurement('standard:header', 700, mountedKey);
  assert.equal(owner.geometry, retiredGeometry, 'unmounted callbacks are inert');
  owner.aboutToAppear();
  assert.ok(owner.measurementKey > mountedKey, 'a remount owns a fresh monotonic measurement generation');
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT);
  assert.equal(owner.footerHeight(), 0);
  owner.recordMeasurement('standard:header', 700, mountedKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a callback from the retired mounting remains stale after remount');
  owner.recordMeasurement('standard:header', Number.NaN, owner.measurementKey);
  owner.recordMeasurement('standard:header', -1, owner.measurementKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'invalid measurements never enter the current budget');
  owner.recordMeasurement('standard:header', 81, owner.measurementKey);
  assert.equal(owner.headerHeight(), 81, 'a valid current callback still converges');
}

async function standardPageSameArea() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const safe = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const rect = await import('../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts');
  const { APP_HEADER_BAR_HEIGHT } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const layout = actualReaderPageLayout(), metrics = safe.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393; metrics.windowRect.height = 852; metrics.ready = true;
  const Owner = selectedProductionMethods(new URL('ui/layout/ReaderStandardPage.ets', root), 'ReaderStandardPage',
    ['aboutToAppear', 'aboutToDisappear', 'onLayoutInputsChanged', 'recordMeasurement', 'headerHeight', 'footerHeight', 'refreshGeometry'],
    { ...layout, readerInteractiveSafeLeft, readerInteractiveSafeRight, APP_HEADER_BAR_HEIGHT, readerWindowMetrics: () => metrics });
  const owner = Object.assign(new Owner(), { mounted: false, measurementKey: 0, footerMeasurementKey: 0,
    headerInputs: '', footerInputs: '', geometryRevision: 0, viewportWidth: 393, viewportHeight: 852,
    variant: 'settingsHome', contentLeadingRail: 0, contentEndInset: -1, measurements: new layout.ReaderMeasurementStore() });
  owner.aboutToAppear();
  owner.recordMeasurement('standard:header', 93, owner.measurementKey);
  owner.recordMeasurement('standard:footer', 84, owner.footerMeasurementKey);
  const headerKey = owner.measurementKey, footerKey = owner.footerMeasurementKey;
  for (const height of [700, 360, 852]) {
    owner.viewportHeight = height; metrics.windowRect.height = height;
    metrics.keyboardInsets.bottom = height === 360 ? 180 : 0; metrics.revision += 1;
    owner.onLayoutInputsChanged();
    assert.equal(owner.measurementKey, headerKey, 'height/IME/revision preserve the same native header box');
    assert.equal(owner.headerHeight(), 93);
    assert.equal(owner.geometry.content.startInset, 101, 'no Area event is supplied during height-only changes');
  }
  owner.contentLeadingRail = 88; owner.onLayoutInputsChanged();
  assert.equal(owner.measurementKey, headerKey, 'rail transition does not retire the independent header');
  assert.ok(owner.footerMeasurementKey > footerKey);
  assert.equal(owner.footerHeight(), 0);
  owner.contentLeadingRail = 0; owner.onLayoutInputsChanged();
  owner.recordMeasurement('standard:footer', 500, footerKey);
  assert.equal(owner.footerHeight(), 0, 'rail return cannot revive an old footer receipt');

  const frames = [], receipts = [];
  let nativeHeight = 93, available = true;
  const context = { postFrameCallback: frame => frames.push(frame), px2vp: x => x / 2,
    getFrameNodeById: () => available ? { getPositionToWindowWithTransform: () => ({ x: 0, y: 0 }) } : null,
    getComponentUtils: () => ({ getRectangleById: () => ({ scale: { x: 1, y: 1 }, rotate: { angle: 0 }, size: { width: 786, height: nativeHeight * 2 } }) }) };
  const measurement = pureModuleProbe(read('ui/layout/ReaderSurfaceRectMeasurement.ets'), 'ReaderSurfaceRectMeasurement.ets', rect, ['readerMeasureSurfaceRect']);
  const slots = pureModuleProbe(read('ui/layout/ReaderNativeSlotMeasurement.ets'), 'ReaderNativeSlotMeasurement.ets',
    { FrameCallback: class {}, ...measurement , ReaderPostLayoutFrame: actualReaderPostLayoutFrame()}, ['ReaderNativeSlotMeasurement']);
  const properties = createArkUIPropertyRuntimeProbe();
  const source = read('ui/layout/ReaderFixedHeaderHost.ets');
  const probe = createReaderBuilderProbe(source, boundedMembers(source), { ...properties.sdk, ...layout, ...slots,
    HitTestMode: { Transparent: 'transparent' }, uiContext: context }, properties.hooks);
  const host = new probe.Component(undefined, { style: { clip: false, backgroundColor: '#fff' }, measurementKey: headerKey,
    content() {}, onHeightChange: (height, key) => { receipts.push([height, key]); owner.recordMeasurement('standard:header', height, key); } });
  host.initialRender();
  const native = [...host.nodes.values()].find(node => node.id === host.nativeMeasurement.id);
  assert.ok(native, 'normal header build attaches the native measurement identity');
  native.onAppear(); frames.shift().onIdle(1000000);
  assert.deepEqual(receipts.at(-1), [93, headerKey]);
  owner.viewportWidth = 320; owner.onLayoutInputsChanged();
  host.measurementKey = owner.measurementKey; properties.flush();
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT);
  frames.shift().onIdle(1000000);
  assert.equal(owner.headerHeight(), 93, 'a new request accepts the same native height without any Area event');
  const staleArea = host.areaChangeHandler(host.measurementKey);
  host.measurementKey += 1; properties.flush(); const oldFrame = frames.shift();
  host.measurementKey += 1; properties.flush();
  const count = receipts.length;
  oldFrame.onIdle(1000000); staleArea({}, { height: 999 });
  assert.equal(receipts.length, count, 'retired request frames and Area callbacks cannot publish');
  frames.shift().onIdle(1000000);
  nativeHeight = 0; host.measurementKey += 1; properties.flush(); frames.shift().onIdle(1000000);
  assert.equal(receipts.length, count + 1, 'zero-size query has a finite empty result');
  available = false; host.measurementKey += 1; properties.flush(); frames.shift().onIdle(1000000);
  assert.equal(receipts.length, count + 1, 'missing native node has a finite empty result');
  available = true; nativeHeight = 100; host.measurementKey += 1; properties.flush();
  native.onDisAppear(); frames.shift().onIdle(1000000);
  assert.equal(receipts.length, count + 1, 'unmount rejects a deferred native read');
  native.onAppear(); frames.shift().onIdle(1000000);
  assert.equal(receipts.at(-1)[0], 100, 'remounted native slot can produce a fresh fact');

  const footerSource = read('ui/layout/ReaderPageScaffold.ets');
  const enumPort = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
  const footerProbe = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), {
    ...properties.sdk, ...layout, ...slots, ReaderFixedHeaderHost: probe.Component, uiContext: context,
    SafeAreaType: enumPort('SafeAreaType'), SafeAreaEdge: enumPort('SafeAreaEdge'),
    LayoutSafeAreaType: enumPort('LayoutSafeAreaType'), LayoutSafeAreaEdge: enumPort('LayoutSafeAreaEdge'),
  }, { ...properties.hooks, childSources: { ReaderFixedHeaderHost: source } });
  const footerReceipts = [];
  const scaffold = new footerProbe.Component(undefined, { headerVisible: false, geometry: owner.geometry,
    frameStyle: layout.readerFrameStyle({ backgroundColor: '#fff' }), footerMeasurementKey: 1,
    content() {}, footer() {}, overlayContent() {}, onFooterHeightChange: (height, key) => footerReceipts.push([height, key]) });
  scaffold.initialRender();
  const footerNode = [...scaffold.nodes.values()].find(node => node.id === scaffold.footerMeasurement.id);
  assert.ok(footerNode, 'normal Scaffold build attaches the footer measurement producer');
  footerNode.onAppear(); frames.shift().onIdle(1000000);
  scaffold.footerMeasurementKey = 2; properties.flush(); frames.shift().onIdle(1000000);
  assert.deepEqual(footerReceipts, [[100, 1], [100, 2]], 'footer also acknowledges a same-height new request without Area');
  footerNode.onDisAppear();

  for (const [path, component, prefix] of [
    ['features/source/ui/SourceManagementPage.ets', 'SourceManagementPage', 'source'],
    ['features/bookshelf/ui/BookshelfMultiSelectPage.ets', 'BookshelfMultiSelectPage', 'selection'],
  ]) {
    const DirectOwner = selectedProductionMethods(new URL(path, root), component, ['onGeometryInputsChanged', 'recordMeasurement'],
      { ...safe, ReaderWindowCoordinator: { metrics: () => metrics } });
    const direct = Object.assign(new DirectOwner(), { mounted: true, measurementKey: 0, footerMeasurementKey: 0, headerInputs: '', footerInputs: '',
      viewportWidth: 320, liveWidth: () => 320, bottomInset: () => 16, footerFallbackHeight: () => 80,
      geometry: new layout.ReaderPageGeometry(), refreshGeometry() {}, measurements: new layout.ReaderMeasurementStore() });
    direct.onGeometryInputsChanged();
    direct.recordMeasurement(`${prefix}:header`, 93, direct.measurementKey);
    direct.recordMeasurement(`${prefix}:footer`, 80, direct.footerMeasurementKey);
    const previousKey = direct.measurementKey;
    metrics.windowRect.height -= 40; metrics.revision += 1; direct.onGeometryInputsChanged();
    assert.equal(direct.measurementKey, previousKey, `${component} retains the same header shape across height-only changes`);
    assert.equal(direct.measurements.readForGeneration(`${prefix}:header`, direct.measurementKey), 93);
    metrics.systemFontScale += .1; direct.onGeometryInputsChanged();
    direct.recordMeasurement(`${prefix}:header`, 999, previousKey);
    assert.equal(direct.measurements.readForGeneration(`${prefix}:header`, direct.measurementKey, 58), 58,
      `${component} rejects the previous font generation`);
  }
}

async function directPageSameArea() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { selectedProductionMethods, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const safe = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const rect = await import('../entry/src/main/ets/ui/layout/ReaderSurfaceRect.ts');
  const manga = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const layout = actualReaderPageLayout(), metrics = safe.createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393; metrics.windowRect.height = 852; metrics.ready = true;
  const detailPath = new URL('features/reading/ui/LocalBookDetail.ets', root);
  const constants = selectedProductionValues(detailPath,
    ['DETAIL_DOCK_HEIGHT', 'DETAIL_DOCK_BOTTOM_GAP', 'DETAIL_DOCK_CONTENT_GAP']);
  const Detail = selectedProductionMethods(detailPath, 'LocalBookDetail',
    ['invalidateFrame', 'recordFrameHeight', 'refreshGeometry', 'detailKindConfirmed',
      'readingActionLabel', 'shelfActionLabel', 'detailBookAvailable'],
    { ...layout, ...safe, ...constants, ...manga, visual: manga.MANGA_DIRECTORY_VISUAL,
      ReaderWindowCoordinator: { metrics: () => metrics }, TOK_CONTENT_MAX_W_TABLET: 720 });
  const detail = Object.assign(new Detail(), { mounted: true, book: { sourceId: 'local', bookId: 'a', contentKind: 'text' },
    mangaFontsReady: false, inBookshelf: true, measurementKey: 0, footerMeasurementKey: 0, geometryRevision: 0,
    headerInputs: '', footerInputs: '', viewportWidth: 393, viewportHeight: 852,
    liveWidth() { return this.viewportWidth; }, safeLeft: () => 0, safeRight: () => 0,
    headerSpec: { headerTop: top => top + 8, barHeight: 58, contentGap: 8 },
    dockFrame: frame => frame, measurements: new layout.ReaderMeasurementStore() });
  detail.invalidateFrame();
  detail.recordFrameHeight('detail:header', 93, detail.measurementKey);
  detail.recordFrameHeight('detail:dock', 90, detail.footerMeasurementKey);
  const detailHeaderKey = detail.measurementKey, detailFooterKey = detail.footerMeasurementKey;
  for (const height of [700, 360, 852]) {
    detail.viewportHeight = height; metrics.windowRect.height = height;
    metrics.keyboardInsets.bottom = height === 360 ? 180 : 0; metrics.revision += 1;
    detail.invalidateFrame();
    assert.equal(detail.measurementKey, detailHeaderKey);
    assert.equal(detail.footerMeasurementKey, detailFooterKey);
    assert.equal(detail.geometry.header.height, 93);
    assert.equal(detail.geometry.footer.height, 90);
    assert.equal(detail.geometry.content.startInset, detail.geometry.header.top + 101);
  }
  detail.book = { ...detail.book, contentKind: 'manga' };
  detail.mangaFontScale = () => 1;
  detail.invalidateFrame();
  detail.recordFrameHeight('detail:header', 100, detail.measurementKey);
  const mangaHeaderKey = detail.measurementKey, preparingFooterKey = detail.footerMeasurementKey;
  detail.mangaFontsReady = true; detail.invalidateFrame();
  assert.ok(detail.measurementKey > mangaHeaderKey, 'actual font readiness renews the header request');
  assert.ok(detail.footerMeasurementKey > preparingFooterKey);
  const readyHeaderKey = detail.measurementKey, readyFooterKey = detail.footerMeasurementKey;
  detail.inBookshelf = false; detail.invalidateFrame();
  assert.equal(detail.measurementKey, readyHeaderKey, 'action label changes retire the footer independently');
  assert.ok(detail.footerMeasurementKey > readyFooterKey);
  detail.recordFrameHeight('detail:dock', 999, preparingFooterKey);
  assert.notEqual(detail.geometry.footer.height, 999);
  detail.viewportWidth = 320; detail.invalidateFrame();
  detail.recordFrameHeight('detail:header', 999, mangaHeaderKey);
  assert.notEqual(detail.geometry.header.height, 999, 'old actual width receipts remain rejected');
  detail.book = { ...detail.book, bookId: 'b' }; detail.invalidateFrame();
  detail.recordFrameHeight('detail:header', 999, detailHeaderKey);
  assert.notEqual(detail.geometry.header.height, 999, 'old book callbacks remain rejected');
  const retiredDetailGeometry = detail.geometry; detail.mounted = false;
  detail.recordFrameHeight('detail:dock', 999, detail.footerMeasurementKey);
  detail.invalidateFrame(); assert.equal(detail.geometry, retiredDetailGeometry);

  const Discover = selectedProductionMethods(new URL('features/discover/ui/DiscoverPage.ets', root),
    'DiscoverPage', ['onGeometryInputsChanged', 'recordHeaderHeight'], { ReaderWindowCoordinator: { metrics: () => metrics } });
  const discover = Object.assign(new Discover(), { mounted: true, measurementKey: 0, measurementRevision: 0,
    headerInputs: '', expandedLayout: false, measurements: new layout.ReaderMeasurementStore() });
  discover.onGeometryInputsChanged(); discover.recordHeaderHeight(93, discover.measurementKey);
  const discoverKey = discover.measurementKey;
  metrics.windowRect.height = 360; metrics.revision += 1; discover.onGeometryInputsChanged();
  assert.equal(discover.measurementKey, discoverKey, 'retained Discover also preserves same-box header facts');
  metrics.systemFontScale += .1; discover.onGeometryInputsChanged(); discover.recordHeaderHeight(999, discoverKey);
  assert.equal(discover.measurements.readForGeneration('discover:header', discover.measurementKey, 58), 58);

  const frames = [];
  let nativeHeight = 88;
  const context = { postFrameCallback: frame => frames.push(frame), px2vp: value => value / 2,
    getFrameNodeById: () => ({ getPositionToWindowWithTransform: () => ({ x: 0, y: 0 }) }),
    getComponentUtils: () => ({ getRectangleById: () => ({ scale: { x: 1, y: 1 }, rotate: { angle: 0 },
      size: { width: 640, height: nativeHeight * 2 } }) }) };
  const measurement = pureModuleProbe(read('ui/layout/ReaderSurfaceRectMeasurement.ets'), 'ReaderSurfaceRectMeasurement.ets',
    rect, ['readerMeasureSurfaceRect']);
  const { ReaderNativeSlotMeasurement } = pureModuleProbe(read('ui/layout/ReaderNativeSlotMeasurement.ets'),
    'ReaderNativeSlotMeasurement.ets', { FrameCallback: class {}, ...measurement , ReaderPostLayoutFrame: actualReaderPostLayoutFrame()}, ['ReaderNativeSlotMeasurement']);
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const properties = createArkUIPropertyRuntimeProbe();
  const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
  const directorySource = read('features/reading/ui/BookDirectoryPage.ets');
  class ChildPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  const nativeOwner = createReaderBuilderProbe(directorySource, ['mangaToolbar', 'mangaToolbarHeight', 'mangaCurrentFooter',
    'mangaHeightHandler', 'recordMangaHeight', 'toolsMeasurement', 'flowToolsMeasurement', 'treeToolsMeasurement',
    'footerMeasurement', 'flowFooterMeasurement', 'treeFooterMeasurement', 'mangaMeasurementKey'],
    { ...properties.sdk, ...fonts, ReaderNativeSlotMeasurement, ReaderDirectoryToolbar: ChildPort, MangaDirectoryCurrentFooter: ChildPort,
      uiContext: context, readerPageAreaLength: layout.readerPageAreaLength },
    { ...properties.hooks, childSources: {
      ReaderDirectoryToolbar: read('features/reading/ui/ReaderDirectoryToolbar.ets'),
      MangaDirectoryCurrentFooter: read('features/manga/ui/MangaDirectoryCurrentFooter.ets') } }).owner;
  Object.assign(nativeOwner, { mounted: true, mangaMeasurementKey: 1, mangaToolsHeight: 175, mangaFooterMeasured: 0,
    geometry: { content: { frame: { width: 284, left: 18 }, startInset: 240 } },
    appThemeScheme: 'day', bookTitle: '漫画', admittedIdentity: 'current', searchDraft: '', ascending: true, mangaScrollOffset: 0,
    mangaFontScale: () => 1, mangaSummaryLabel: () => '2 个可读条目', mangaFlowFooter: () => false,
    mangaCurrentTitle: () => '第一章', mangaCurrentPosition: () => '1 / 10 页', mangaFooterFrame: () => ({ width: 284 }),
    refreshGeometry() {} });
  nativeOwner.mangaToolbar('current'); nativeOwner.mangaCurrentFooter();
  for (const [measurementOwner, slot] of [[nativeOwner.toolsMeasurement, 'tools'], [nativeOwner.footerMeasurement, 'footer']]) {
    const native = [...nativeOwner.nodes.values()].find(node => node.id === measurementOwner.id);
    assert.ok(native?.onAppear && native?.onDisAppear, 'normal manga SDK builder attaches the current native ' + slot + ' producer');
    native.onAppear(); frames.shift().onIdle(1000000);
    assert.equal(slot === 'tools' ? nativeOwner.mangaToolsHeight : nativeOwner.mangaFooterMeasured, 88);
    measurementOwner.request(1); native.onDisAppear();
    const pending = frames.shift(); nativeHeight = 999; pending.onIdle(1000000);
    assert.equal(slot === 'tools' ? nativeOwner.mangaToolsHeight : nativeOwner.mangaFooterMeasured, 88);
    nativeHeight = 88;
  }
  nativeOwner.mangaToolbar('current', true, nativeOwner.flowToolsMeasurement);
  const fixedTools = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.toolsMeasurement.id);
  const flowTools = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.flowToolsMeasurement.id);
  fixedTools.onAppear(); const retiredToolsFrame = frames.shift();
  flowTools.onAppear(); const currentToolsFrame = frames.shift();
  fixedTools.onDisAppear(); nativeHeight = 105;
  retiredToolsFrame.onIdle(1000000); assert.equal(nativeOwner.mangaToolsHeight, 88);
  currentToolsFrame.onIdle(1000000); assert.equal(nativeOwner.mangaToolsHeight, 105,
    'old overlay disappearance cannot retire the current native toolbar in List content');
  flowTools.onDisAppear(); nativeHeight = 88;
  nativeOwner.mangaToolbar('current', true, nativeOwner.treeToolsMeasurement, nativeOwner.treeFooterMeasurement);
  const treeTools = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.treeToolsMeasurement.id);
  flowTools.onAppear(); const retiredFlatToolsFrame = frames.shift();
  treeTools.onAppear(); const currentTreeToolsFrame = frames.shift();
  flowTools.onDisAppear(); nativeHeight = 123;
  retiredFlatToolsFrame.onIdle(1000000); assert.equal(nativeOwner.mangaToolsHeight, 105);
  currentTreeToolsFrame.onIdle(1000000); assert.equal(nativeOwner.mangaToolsHeight, 123,
    'retired fallback cannot cancel the current semantic Grid toolbar producer');
  treeTools.onDisAppear(); nativeHeight = 88;
  nativeOwner.mangaCurrentFooter(nativeOwner.flowFooterMeasurement);
  const flowFooter = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.flowFooterMeasurement.id);
  assert.ok(flowFooter?.onAppear && flowFooter?.onDisAppear);
  const fixedFooter = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.footerMeasurement.id);
  fixedFooter.onAppear(); const retiredFixedFrame = frames.shift();
  flowFooter.onAppear(); const currentFlowFrame = frames.shift();
  fixedFooter.onDisAppear(); nativeHeight = 105;
  retiredFixedFrame.onIdle(1000000); assert.equal(nativeOwner.mangaFooterMeasured, 88);
  currentFlowFrame.onIdle(1000000); assert.equal(nativeOwner.mangaFooterMeasured, 105,
    'old fixed-footer disappearance cannot retire the distinct current in-flow native producer');
  flowFooter.onDisAppear(); nativeHeight = 88;
  nativeOwner.mangaCurrentFooter(nativeOwner.treeFooterMeasurement);
  const treeFooter = [...nativeOwner.nodes.values()].find(node => node.id === nativeOwner.treeFooterMeasurement.id);
  flowFooter.onAppear(); const retiredFlatFooterFrame = frames.shift();
  treeFooter.onAppear(); const currentTreeFooterFrame = frames.shift();
  flowFooter.onDisAppear(); nativeHeight = 123;
  retiredFlatFooterFrame.onIdle(1000000); assert.equal(nativeOwner.mangaFooterMeasured, 105);
  currentTreeFooterFrame.onIdle(1000000); assert.equal(nativeOwner.mangaFooterMeasured, 123,
    'retired fallback cannot cancel the current semantic Grid footer producer');
  treeFooter.onDisAppear(); nativeHeight = 88;
  const Directory = selectedProductionMethods(new URL('features/reading/ui/BookDirectoryPage.ets', root), 'BookDirectoryPage',
    ['invalidateFrame', 'recordHeaderHeight', 'recordMangaHeight', 'mangaHeightHandler', 'onMangaMetricsChanged',
      'onMangaPositionChanged', 'onMangaContentChanged', 'identity'], { readerWindowMetrics: () => metrics, readerPageAreaLength: layout.readerPageAreaLength });
  const directory = Object.assign(new Directory(), { mounted: true, sourceId: 'local', bookId: 'manga-a', bookTitle: 'A',
    viewportWidth: 320, mangaFontsReady: true, measurementKey: 0, mangaMeasurementKey: 0,
    headerInputs: '', mangaInputs: '', mangaFooterMeasured: 0, mangaToolsHeight: 175,
    toolsMeasurement: new ReaderNativeSlotMeasurement(), flowToolsMeasurement: new ReaderNativeSlotMeasurement(),
    treeToolsMeasurement: new ReaderNativeSlotMeasurement(), treeFooterMeasurement: new ReaderNativeSlotMeasurement(),
    footerMeasurement: new ReaderNativeSlotMeasurement(),
    flowFooterMeasurement: new ReaderNativeSlotMeasurement(),
    measurements: new layout.ReaderMeasurementStore(), headerFrame: () => ({ left: 8, right: 8 }),
    mangaFooterFrame: () => ({ width: 284 }), mangaSummaryLabel: () => '2 个可读条目',
    mangaCurrentTitle: () => '第一章', mangaCurrentPosition() { return this.position ?? '1 / 10 页'; },
    refreshGeometry() {}, prepareMangaLayout() {} });
  directory.invalidateFrame();
  directory.recordHeaderHeight('bookDirectory:mangaHeader', 93, directory.measurementKey);
  directory.recordMangaHeight('footer', 88, directory.mangaMeasurementKey);
  const directoryKey = directory.measurementKey, contentKey = directory.mangaMeasurementKey;
  for (const height of [360, 700, 852]) {
    metrics.windowRect.height = height; metrics.revision += 1;
    metrics.keyboardInsets.bottom = height === 360 ? 180 : 0;
    directory.onMangaMetricsChanged();
    assert.equal(directory.measurementKey, directoryKey);
    assert.equal(directory.mangaMeasurementKey, contentKey);
    assert.equal(directory.mangaFooterMeasured, 88, 'unrelated window revision keeps the current footer fact');
    assert.equal(directory.measurements.readForGeneration('bookDirectory:mangaHeader', directoryKey), 93);
  }
  directory.footerMeasurement.mount(context, contentKey,
    (height, key) => directory.recordMangaHeight('footer', height, key));
  frames.shift().onIdle(1000000);
  const oldFooterArea = directory.mangaHeightHandler('footer', contentKey);
  directory.position = '2 / 10 页'; directory.onMangaPositionChanged();
  assert.equal(directory.measurementKey, directoryKey, 'footer position leaves the independent header intact');
  assert.equal(directory.mangaFooterMeasured, 0);
  oldFooterArea({}, { height: 999 }); assert.equal(directory.mangaFooterMeasured, 0);
  frames.shift().onIdle(1000000);
  assert.equal(directory.mangaFooterMeasured, 88, 'same native footer height is renewed without an Area event');
  metrics.systemFontScale = 2; directory.onMangaMetricsChanged();
  directory.recordHeaderHeight('bookDirectory:mangaHeader', 999, directoryKey);
  assert.equal(directory.measurements.readForGeneration('bookDirectory:mangaHeader', directory.measurementKey, 58), 58);
  const deferred = frames.shift(); directory.bookId = 'manga-b'; directory.invalidateFrame();
  deferred.onIdle(1000000); assert.equal(directory.mangaFooterMeasured, 0);
  nativeHeight = 100; frames.shift().onIdle(1000000); assert.equal(directory.mangaFooterMeasured, 100);
  directory.position = '3 / 10 页'; directory.onMangaPositionChanged();
  directory.mounted = false; directory.footerMeasurement.unmount();
  frames.shift().onIdle(1000000); assert.equal(directory.mangaFooterMeasured, 0, 'retired native footer cannot publish');
}

async function windowEnvironment() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync, readdirSync } = await import('node:fs');
  const { posix: path } = await import('node:path');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { readerWindowEnvironmentForProbe } = await import('./lib/reader-window-environment-probe.mjs');
  const metrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { findReaderTheme } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { ReaderBrightnessWriter } = await import('../entry/src/main/ets/app/ReaderBrightnessWriter.ts');
  const { ts, options } = installedEtsCompiler();
  const base = new URL('../entry/src/main/ets/', import.meta.url);
  const environment = readerWindowEnvironmentForProbe();
  assert.equal(environment.readerWindowMetrics().ready, false, 'an isolated UI has explicit unready defaults before composition');
  const emitActual = (file, dependencies) => {
    const output = ts.transpileModule(readFileSync(new URL(file, base), 'utf8'), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    });
    assert.deepEqual(output.diagnostics, [], 'actual module SDK emit: ' + file);
    const exports = {};
    new Function('exports', 'require', output.outputText)(exports, name => {
      assert.ok(Object.hasOwn(dependencies, name), 'explicit finite platform/module dependency: ' + name);
      return dependencies[name];
    });
    return exports;
  };
  const status = emitActual('app/ReaderStatusBarMeasurement.ts', { '../ui/foundation/ReaderWindowMetrics': metrics });
  const displayInfo = { id: 1, rotation: 0, densityPixels: 2, scaledDensity: 3 };
  const windowKit = {
    Orientation: { UNSPECIFIED: 0, PORTRAIT: 1, LANDSCAPE: 2, AUTO_ROTATION_UNSPECIFIED: 3 },
    AvoidAreaType: { TYPE_SYSTEM: 0, TYPE_CUTOUT: 1, TYPE_SYSTEM_GESTURE: 2, TYPE_NAVIGATION_INDICATOR: 3, TYPE_KEYBOARD: 4 },
  };
  const { ReaderWindowCoordinator: owner } = emitActual('app/ReaderWindowCoordinator.ts', {
    '@kit.ArkUI': { display: { getDefaultDisplaySync: () => displayInfo }, window: windowKit },
    '@kit.PerformanceAnalysisKit': { hilog: { info() {}, warn() {} } },
    '@kit.BasicServicesKit': { deviceInfo: { deviceType: 'phone' } },
    './ReaderBrightnessWriter': { ReaderBrightnessWriter }, './ReaderStatusBarMeasurement': status,
    '../ui/platform/ReaderNativeAlertWindow': { ReaderNativeAlertWindow: {} },
    '../platform/ReaderDocumentPickerActivity': { ReaderDocumentPickerActivity: {} },
    '../ui/foundation/ReaderThemeRegistry': { findReaderTheme },
    '../ui/foundation/ReaderWindowMetrics': metrics,
    '../ui/foundation/ReaderWindowEnvironment': environment,
  });
  assert.equal(environment.readerWindowMetrics(), owner.metrics(), 'the actual composition binds the original owner snapshot');
  assert.throws(() => environment.bindReaderWindowMetricsSource(() => metrics.createDefaultReaderWindowMetrics()),
    /already has an owner/, 'a second source cannot steal the environment');

  const zero = { left: 0, top: 0, width: 0, height: 0 };
  let rect = { left: 0, top: 0, width: 786, height: 1704 };
  owner.mainWindow = {
    getWindowProperties: () => ({ windowRect: rect }),
    getWindowAvoidArea: type => ({ leftRect: zero, rightRect: zero, bottomRect: zero,
      topRect: type === 0 ? { left: 0, top: 0, width: rect.width, height: 80 } : zero }),
  };
  const previousStorage = globalThis.AppStorage;
  const writes = [];
  globalThis.AppStorage = { setOrCreate: (key, value) => writes.push([key, value]) };
  try {
    owner.refreshMetrics();
    const first = environment.readerWindowMetrics();
    assert.equal(first, owner.metrics());
    assert.equal(first.windowRect.width, 393);
    assert.equal(first.systemFontScale, 1.5);
    assert.equal(first.ready, true);
    assert.deepEqual(writes, [['readerWindowMetricsRevision', first.revision]], 'only the original coordinator publishes metrics revisions');
    for (let read = 0; read < 20; read++) assert.equal(environment.readerWindowMetrics(), first);
    owner.refreshMetrics();
    assert.equal(writes.length, 1, 'UI reads and unchanged platform facts publish no competing revision');
    rect = { ...rect, width: 640 };
    displayInfo.scaledDensity = 4;
    owner.refreshMetrics();
    const second = environment.readerWindowMetrics();
    assert.notEqual(second, first, 'the port does not cache an obsolete snapshot');
    assert.equal(second, owner.metrics());
    assert.equal(second.windowRect.width, 320);
    assert.equal(second.systemFontScale, 2);
    assert.equal(second.revision, first.revision + 1);
    assert.equal(writes.length, 2);
  } finally {
    owner.mainWindow = undefined;
    if (previousStorage === undefined) delete globalThis.AppStorage;
    else globalThis.AppStorage = previousStorage;
  }

  let consumers = 0;
  for (const relative of readdirSync(new URL('ui/', base), { recursive: true })) {
    if (!/\.(ets|ts)$/.test(relative)) continue;
    const file = 'ui/' + relative.replaceAll('\\', '/');
    const text = readFileSync(new URL(file, base), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      file.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    assert.deepEqual(tree.parseDiagnostics, [], 'current shared UI parses: ' + file);
    for (const statement of tree.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
      const name = statement.moduleSpecifier.text;
      if (name.startsWith('.')) {
        const target = path.normalize(path.join(path.dirname(file), name));
        assert.ok(!target.startsWith('app/'), 'shared UI cannot import/re-export an app owner: ' + file);
        if (target.endsWith('/ReaderWindowEnvironment')) {
          consumers++;
          assert.ok(!statement.getText(tree).includes('bindReaderWindowMetricsSource'), 'UI consumes the read side of the port: ' + file);
        }
      }
    }
  }
  assert.ok(consumers > 0, 'the readonly port has actual shared UI consumers');
}
