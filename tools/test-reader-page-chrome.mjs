import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "footer-geometry": {
    "description": "Actual chrome geometry with relational no-overlap/anchoring oracle and display formatting; no historical coordinate golden",
    "resources": []
  },
  "status-sdk-track": {
    "description": "Actual SDK labels stay below a reserved status track across hide/show, orientation/cutout/scale; fake measure port",
    "resources": []
  },
  "measurement-cache": {
    "description": "Actual AST textMeasure cache, density/font invalidation and shared LRU; fake SDK measurements",
    "resources": []
  },
  "clock-texture-identity": {
    "description": "Actual LRE texture identity and minute invalidation; fake capture scheduling",
    "resources": []
  },
  "layout-cache": {
    "description": "Actual chrome layout cache invalidates safe area/session footprint",
    "resources": []
  },
  "mounted-slot-capture": {
    "description": "Actual LRE revision ACK and texture refresh cache matrix; fake snapshot/frame ports, no native compositor",
    "resources": []
  }
};

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const chromeFile = new URL('ReaderPageChrome.ets', reading);
const experienceFile = new URL('LocalReadingExperience.ets', reading);

async function loadLayoutGeometry() {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const windowMetrics = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
  const { readerWidthClassWithHint } = await import('../entry/src/main/ets/features/common/ReaderWidthClass.ts');
  return pureModuleProbe(readFileSync(new URL('ReaderLayoutGeometry.ts', reading), 'utf8'),
    'ReaderLayoutGeometry.ets', { ...windowMetrics, readerWidthClassWithHint },
    ['ReaderReadingLayoutSnapshot', 'resolveReaderReadingLayout', 'READER_PAGE_CHROME_TOP_ROW_PADDING_VP']);
}

async function layout(width, height, widthClass = 'compact', safeRight = 0, safeBottom = 0) {
  const { ReaderReadingLayoutSnapshot } = await loadLayoutGeometry();
  return new ReaderReadingLayoutSnapshot(widthClass, width, height, 72, 32, 48, 32, 1,
    0, safeRight, safeBottom, 0, safeRight, safeBottom);
}

async function case_footer_geometry() {
  const { ReaderPageChromeMeasurements, resolveReaderPageChromeLayout } =
    await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
  const { ReaderPageOrdinal, formatReaderPageOrdinal, formatReaderPageProgress } =
    await import('../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts');
  for (const [width, height, safeRight, safeBottom] of [[390, 844, 0, 0], [760, 832, 0, 0], [365.71, 780, 40, 34]]) {
    const page = await layout(width, height, width > 600 ? 'expanded' : 'compact', safeRight, safeBottom);
    const plain = resolveReaderPageChromeLayout(page, new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 53, 14.4));
    const active = resolveReaderPageChromeLayout(page,
      new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 53, 14.4, true, 96, 24));
    assert.ok(plain.footerRight <= width - safeRight);
    assert.ok(plain.footerTop + 24 <= height - safeBottom);
    assert.equal(active.footerRight, plain.footerRight);
    assert.ok(active.sessionX < active.footerRight);
    assert.ok(active.bottomEndX + 53 <= active.sessionX, 'ordinal never intersects the active capsule');
    const longer = resolveReaderPageChromeLayout(page,
      new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 120, 14.4, true, 96, 24));
    assert.equal(longer.sessionX, active.sessionX);
    assert.ok(longer.bottomEndX < active.bottomEndX);
  }
  assert.equal(formatReaderPageProgress(37.6), '38%');
  assert.equal(formatReaderPageOrdinal(new ReaderPageOrdinal(0, 7)), '第 1 / 7 页');
  assert.equal(formatReaderPageOrdinal(new ReaderPageOrdinal(8)), '第 9 页');
}

async function case_status_sdk_track() {
  const { createEtsBuilderProbe } = await import('./lib/ets-builder-probe.mjs');
  const { readerThemeDefinition } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const windowMetrics = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
  const readingGeometry = await loadLayoutGeometry();
  const { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout } =
    await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
  const { chromeTypography, measureReaderPageChromeText, readerPageChromeTopTextStyle } =
    await import('./lib/reader-page-chrome-measurement-probe.mjs');
  // Exercise the actual SDK-emitted Text position attributes, rather than only
  // the layout helper. The visible and hidden avoid-area samples retain the
  // same real status rectangle; hiding glyphs cannot move the information row.
  const statusContext = {
    px2vp: value => value / 3, fp2px: value => value * 3, px2fp: value => value / 3,
    getHostContext: () => ({ resourceManager: { getNumber: () => 48 } }),
    getMeasureUtils: () => ({ measureTextSize: ({ textContent }) =>
      ({ width: textContent.length * 21, height: 60 }) }),
  };
  const statusChrome = createEtsBuilderProbe(readFileSync(chromeFile, 'utf8'),
    ['build', 'chromeLayout', 'textMeasure', 'topTextStyle', 'footerExitX', 'footerExitY', 'metaColor'],
    { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout,
      ...chromeTypography, measureReaderPageChromeText, readerPageChromeTopTextStyle, readerThemeDefinition },
    { componentName: 'ReaderPageChrome' }).owner;
  Object.assign(statusChrome, {
    topStartText: '实际书名', topEndText: '12:30', bottomStartText: '', bottomEndText: '',
    topInfoSuppressed: false, topTranslateY: 0, incomingOpacity: 1,
    footerOpacity: 1, footerTranslateX: 0, sessionExitProgress: 0,
    sessionVisible: false, sessionWidth: 0, sessionHeight: 0,
    sessionOverlayActive: false, isSessionOverlay: false,
    bookmarkMode: 'hidden', textMeasureCache: new Map(), appearance: { activeTheme: 'paper' },
    getUIContext: () => statusContext,
  });
  let renderedStatusChrome = false, statusCases = 0;
  function assertStatusTextPositions(page, expectedY) {
    statusChrome.layout = page;
    if (renderedStatusChrome) statusChrome.replay();
    else { statusChrome.initialRender(); renderedStatusChrome = true; }
    const nodes = [...statusChrome.nodes.values()].filter(node => node.type === 'Text');
    const title = nodes.find(node => node.create === '实际书名');
    const time = nodes.find(node => node.create === '12:30');
    assert.ok(title && time, 'actual SDK creates both ordinary immersive top labels');
    assert.equal(title.position.y, expectedY, 'SDK title uses the independent information lane');
    assert.equal(time.position.y, expectedY, 'SDK clock shares the information lane');
    assert.ok(title.position.y >= page.pageChromeStatusMetrics.statusBarRect.top +
      page.pageChromeStatusMetrics.statusBarRect.height, 'information is below the reserved native band');
    assert.ok(title.position.x >= 25 && time.position.x + 35 <= page.viewportWidth - 25,
      'application labels retain their authored horizontal breathing room');
    assert.equal(title.lineHeight, undefined, 'the actual Text retains platform AUTO line height');
    assert.ok(title.position.y + 20 + 8 <= page.contentTop, 'the body clears the complete measured information line');
  }
  for (const [width, height] of [[390, 844], [844, 390], [760, 960], [960, 760]]) {
    for (const statusHeight of [24, 40, 137 / 3, 140 / 3]) for (const statusTop of [0, 3]) {
      for (const extended of [false, true]) for (const systemTop of [0, statusHeight]) {
        const metrics = new windowMetrics.ReaderWindowMetricsSnapshot();
        Object.assign(metrics, { ready: true, revision: statusCases + 1,
          windowRect: new windowMetrics.ReaderRectVp(0, 0, width, height),
          systemInsets: new windowMetrics.ReaderInsetsVp(0, systemTop),
          statusBarHeight: statusHeight,
          statusBarRect: new windowMetrics.ReaderRectVp(0, statusTop, width, statusHeight) });
        const page = readingGeometry.resolveReaderReadingLayout(width, height, width >= 600, metrics, extended);
        assertStatusTextPositions(page, statusTop + statusHeight + Math.min(Math.max(0, statusHeight - 20),
          Math.max(0, statusHeight - 20) / 2 + 4));
        statusCases++;
      }
    }
  }
  // The information row stays below the measured status region. Visible SYSTEM
  // inset and hidden avoid-area samples must yield exactly the same position.
  const regressionMetrics = new windowMetrics.ReaderWindowMetricsSnapshot();
  Object.assign(regressionMetrics, { ready: true, revision: 999,
    statusBarHeight: 48, statusBarRect: new windowMetrics.ReaderRectVp(0, 3, 390, 48) });
  assertStatusTextPositions(readingGeometry.resolveReaderReadingLayout(390, 844, false, regressionMetrics, false), 69);
  // Exercise the SDK Text consumer with a body lane enlarged by a cutout and
  // large-font clearance. Those independent budgets must no longer move the
  // ordinary information labels into the native status-bar track.
  for (const statusHeight of [18, 24, 39, 60]) for (const top of [0, 3]) {
    for (const extended of [false, true]) for (const visible of [false, true]) {
      const metrics = new windowMetrics.ReaderWindowMetricsSnapshot();
      Object.assign(metrics, { ready: true, revision: 2000 + statusCases,
        windowRect: new windowMetrics.ReaderRectVp(0, 0, 390, 844),
        systemInsets: new windowMetrics.ReaderInsetsVp(0, visible ? statusHeight : 0),
        cutoutInsets: new windowMetrics.ReaderInsetsVp(0, statusHeight + 70),
        statusBarHeight: statusHeight,
        statusBarRect: new windowMetrics.ReaderRectVp(0, top, 390, statusHeight) });
      const page = readingGeometry.resolveReaderReadingLayout(390, 844, false, metrics, extended, undefined, 60);
      const informationHeight = Math.max(statusHeight, 60 + readingGeometry.READER_PAGE_CHROME_TOP_ROW_PADDING_VP * 2);
      assertStatusTextPositions(page, Math.max(top + statusHeight, statusHeight + 70) +
        Math.min(Math.max(0, informationHeight - 20), Math.max(0, informationHeight - 20) / 2 + 4));
      statusCases++;
    }
  }
  console.log(`page chrome ${statusCases} actual SDK Text cases: separate information lane invariant across status hide/show: PASS`);
}

async function case_measurement_cache() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { measureReaderPageChromeText } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
  const ChromeMeasure = selectedProductionMethods(chromeFile, 'ReaderPageChrome',
    ['textMeasure'], { measureReaderPageChromeText });
  let measurements = 0;
  let density = 3;
  let fontScale = 1;
  const owner = Object.assign(new ChromeMeasure(), {
    textMeasureCache: new Map(), layout: { systemFontScale: 1 },
    getUIContext: () => ({
      px2vp: value => value / density,
      fp2px: value => value * density * fontScale,
      getMeasureUtils: () => ({ measureText: ({ textContent, fontSize }) => {
        measurements++;
        return textContent.length * fontSize * density * fontScale;
      } }),
    }),
  });
  const style = { fontFamily: 'Test', fontWeight: 400, fontSizeFp: 12, lineHeightFp: 14.4 };
  for (let geometryRead = 0; geometryRead < 15; geometryRead++) {
    for (const text of ['Book', '12:30', '9%', '第 2 页']) owner.textMeasure(text, style);
  }
  assert.equal(measurements, 4, 'repeated geometry reads perform one SDK measurement per distinct label');
  assert.equal(owner.textMeasure('Book', style).width, 48);
  owner.textMeasure('12:31', style);
  assert.equal(measurements, 5, 'clock changes invalidate only that label');
  density = 4;
  owner.textMeasure('Book', style);
  assert.equal(measurements, 6, 'display density changes cannot reuse stale pixel measurements');
  fontScale = 1.5;
  owner.layout.systemFontScale = 1.5;
  assert.equal(owner.textMeasure('Book', style).width, 72);
  assert.equal(owner.textMeasure('Book', style).height, 21.6);
  assert.equal(measurements, 7, 'font scale changes invalidate the measurement');
  owner.textMeasure('Book', { ...style, fontFamily: 'Other' });
  assert.equal(measurements, 8, 'font family changes invalidate the measurement');
  for (let page = 0; page < 100; page++) owner.textMeasure(`第 ${page} 页`, style);
  assert.ok(owner.textMeasureCache.size <= 64, 'long sessions retain a bounded measurement cache');

  console.log('reader page chrome dynamic layout: PASS');
  // A second offscreen Chrome instance reuses exact typography metrics.
  const peer = Object.assign(new ChromeMeasure(), {
    textMeasureCache: owner.textMeasureCache, layout: owner.layout, getUIContext: owner.getUIContext,
  });
  owner.textMeasure('Shared book title', style);
  const beforePeer = measurements;
  assert.equal(peer.textMeasure('Shared book title', style).width, owner.textMeasure('Shared book title', style).width);
  assert.equal(measurements, beforePeer);
  for (let page = 0; page < 80; page++) {
    peer.textMeasure('Shared book title', style);
    peer.textMeasure(`Fresh ${page}`, style);
  }
  const beforeRetained = measurements;
  peer.textMeasure('Shared book title', style);
  assert.equal(measurements, beforeRetained, 'LRU retains repeated book/clock labels instead of clearing every page');
  assert.ok(peer.textMeasureCache.size <= 64);
}

async function case_clock_texture_identity() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const ChromeOwner = selectedProductionMethods(experienceFile, 'ReadingExperience',
    ['bookTurnTextureIdentity', 'admitPageChromeClock']);
  const clockOwner = Object.assign(new ChromeOwner(), {
    sourceId: 'local', bookId: 'test', appearanceSnapshot: { activeTheme: 'paper' },
    readerSettingsSnapshot: { hideStatusBar: false },
    pageChromeClockText: '12:30', pageTurnRenderRevision: 4, refreshes: 0,
    scheduleBookTurnTextureRefresh() { this.refreshes++; },
  });
  const chrome = { topStartText: 'Book', topEndText: '12:30', bottomStartText: '第 325 章',
    bottomEndText: '38%', sessionVisible: false, sessionWidth: 0, sessionHeight: 0 };
  const identity = data => clockOwner.bookTurnTextureIdentity(1, 100, 'v1', 'layout', 0, data);
  assert.notEqual(identity(chrome), identity({ ...chrome, topEndText: '12:31' }));
  assert.notEqual(identity(chrome), identity({ ...chrome, sessionVisible: true, sessionWidth: 80, sessionHeight: 24 }));
  const statusVisibleIdentity = identity(chrome);
  clockOwner.readerSettingsSnapshot.hideStatusBar = true;
  assert.notEqual(identity(chrome), statusVisibleIdentity,
    'a texture key captured with visible system status cannot be reused after hiding it');
  clockOwner.readerSettingsSnapshot.hideStatusBar = false;
  assert.equal(identity(chrome), statusVisibleIdentity, 'restoring visible status restores the same presentation identity');
  clockOwner.admitPageChromeClock('12:30');
  assert.equal(clockOwner.refreshes, 0, 'unchanged minute does not recapture');
  clockOwner.admitPageChromeClock('12:31');
  assert.equal(clockOwner.pageTurnRenderRevision, 5);
  assert.equal(clockOwner.refreshes, 1, 'new minute schedules the existing idle-only texture path');
}

async function case_layout_cache() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout } =
    await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
  const { chromeTypography, readerPageChromeTopTextStyle } =
    await import('./lib/reader-page-chrome-measurement-probe.mjs');
  const LayoutChrome = selectedProductionMethods(chromeFile, 'ReaderPageChrome', ['chromeLayout', 'topTextStyle'],
    { ...chromeTypography, ReaderPageChromeMeasurements, resolveReaderPageChromeLayout,
      READER_PAGE_CHROME_BOOKMARK_SIZE, readerPageChromeTopTextStyle });
  let layoutMeasures = 0;
  const layoutChrome = Object.assign(new LayoutChrome(), {
    sessionVisible: false, sessionWidth: 0, sessionHeight: 0, layout: await layout(390, 844),
    topStartText: 'Book', topEndText: '12:30', bottomStartText: '第 325 章', bottomEndText: '38%',
    textMeasure() { layoutMeasures++; return { width: 30, height: 14.4 }; },
    getUIContext: () => ({ px2vp: value => value, fp2px: value => value }),
  });
  const geometry = layoutChrome.chromeLayout();
  for (let frame = 0; frame < 100; frame++) assert.equal(layoutChrome.chromeLayout(), geometry);
  assert.equal(layoutMeasures, 4, 'geometry reads reuse the complete immutable layout');
  layoutChrome.layout.pageChromeVisualSafeTop = 40;
  assert.equal(layoutChrome.chromeLayout().topEndY, 48 + (24 - 14.4) / 2,
    'clock centres in the same 24vp bookmark lane below the safe top');
  assert.equal(layoutMeasures, 8, 'in-place safe area changes invalidate geometry');
  Object.assign(layoutChrome, { sessionVisible: true, sessionWidth: 80, sessionHeight: 24 });
  assert.notEqual(layoutChrome.chromeLayout().bottomEndX, geometry.bottomEndX);
  console.log('page chrome complete layout reuse and safe-area/session invalidation: PASS');
}

async function case_mounted_slot_capture() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const CaptureOwner = selectedProductionMethods(experienceFile, 'ReadingExperience',
    ['sessionLaunchRenderWorkBlocked', 'performBookTurnTextureRefresh', 'onBookTurnArkUIFramePresented'],
    { BOOK_TURN_TEXTURE_CURRENT: 1, BOOK_TURN_TEXTURE_PREVIOUS: 0, BOOK_TURN_TEXTURE_NEXT: 2 });
  const snapshots = [];
  const captures = Object.assign(new CaptureOwner(), {
    mounted: true, exitRequested: false, phase: 'ready', bookTurnTextureCaptureGeneration: 7,
    pageTurnRenderRevision: 20, bookTurnArkUIContentRevision: 19,
    usesBookTurnSimulation: () => true, controlVisible: () => false,
    bookTurnSession: { isReady: () => true }, pageTurnInputPhase: () => 'idle',
    currentPageTurnRenderPage: () => ({ renderRevision: 20, chromeTopEndText: '12:31', textureIdentity: 'current-31' }),
    preparedPageTurnRenderPage: direction => ({ renderRevision: 20, chromeTopEndText: '12:31', textureIdentity: direction + '-31' }),
    bookTurnCapturedIdentity: () => '',
    captureBookTurnTexture: async (slot, page) => { snapshots.push([slot, page.chromeTopEndText]); return true; },
    yieldPageTextureFrame: async () => {}, scheduleBookTurnTextureRefresh() { this.refreshes = (this.refreshes ?? 0) + 1; },
  });
  await captures.performBookTurnTextureRefresh(7);
  assert.deepEqual(snapshots, [], 'new identity cannot label old mounted-slot pixels before revision delivery');
  captures.onBookTurnArkUIFramePresented(19);
  assert.equal(captures.refreshes, undefined, 'obsolete slot callback cannot authorize current capture');
  captures.onBookTurnArkUIFramePresented(20);
  assert.equal(captures.refreshes, 1, 'actual current slot revision resumes the idle capture lane');
  await captures.performBookTurnTextureRefresh(7);
  assert.equal(snapshots.length, 3);
  assert.ok(snapshots.every(snapshot => snapshot[1] === '12:31'));
  captures.onBookTurnArkUIFramePresented(20);
  assert.equal(captures.refreshes, 1, 'duplicate acknowledgment never creates a capture loop');
  // Execute all cache combinations: only real snapshot work yields. A cached
  // current/requested pair must not wait for two empty frame callbacks.
  for (const preferred of ['next', 'previous']) for (let mask = 0; mask < 8; mask++) {
    const identities = ['previous-31', 'current-31', 'next-31'];
    const cached = identities.map((id, slot) => mask & (1 << slot) ? id : '');
    const work = [];
    const sequence = [];
    captures.preferredPageTextureDirection = preferred;
    captures.bookTurnCapturedIdentity = slot => cached[slot];
    captures.captureBookTurnTexture = async (slot, page) => {
      if (cached[slot] !== page.textureIdentity) {
        work.push(slot);
        sequence.push(`capture${slot}`);
        cached[slot] = page.textureIdentity;
      }
      return true;
    };
    captures.yieldPageTextureFrame = async () => { sequence.push('yield'); };
    await captures.performBookTurnTextureRefresh(7);
    const order = preferred === 'next' ? [1, 2, 0] : [1, 0, 2];
    const expected = order.filter(slot => !(mask & (1 << slot)));
    assert.deepEqual(work, expected);
    assert.deepEqual(sequence, expected.flatMap((slot, i) => i ? ['yield', `capture${slot}`] : [`capture${slot}`]));
  }
  console.log('production texture refresh cache matrix: no idle frame waits; requested direction first; expensive captures remain spread: PASS');
}

const implementations = {
  'footer-geometry': case_footer_geometry,
  'status-sdk-track': case_status_sdk_track,
  'measurement-cache': case_measurement_cache,
  'clock-texture-identity': case_clock_texture_identity,
  'layout-cache': case_layout_cache,
  'mounted-slot-capture': case_mounted_slot_capture,
};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
