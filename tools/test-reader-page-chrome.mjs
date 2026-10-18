import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as windowMetrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as readingGeometry from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import {
  ReaderPageChromeMeasurements,
  READER_PAGE_CHROME_BOOKMARK_SIZE,
  resolveReaderPageChromeLayout,
} from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
import { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } from './lib/reader-page-chrome-measurement-probe.mjs';
import {
  ReaderPageOrdinal,
  formatReaderPageOrdinal,
  formatReaderPageProgress,
} from '../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts';
import { ReaderReadingLayoutSnapshot } from
  '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';

function layout(width, height, widthClass = 'compact', safeRight = 0, safeBottom = 0, safeTop = 0) {
  return new ReaderReadingLayoutSnapshot(
    widthClass,
    width,
    height,
    72,
    32,
    48,
    32,
    1,
    safeTop,
    safeRight,
    safeBottom,
    0,
    safeRight,
    safeBottom,
  );
}

const hidden = resolveReaderPageChromeLayout(layout(390, 844),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 53, 14.4));
assert.equal(hidden.footerRight, 365);
assert.equal(hidden.footerTop, 797);
assert.equal(hidden.bottomEndX, 312,
  'the content-measured 53vp ordinal must reproduce the Figma phone Golden without a fixed x');

const autoPage = resolveReaderPageChromeLayout(layout(390, 844),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 53, 14.4,
    true, 96, 24));
assert.equal(autoPage.footerRight, 365);
assert.equal(autoPage.sessionX, 269);
assert.equal(autoPage.bottomEndX, 211,
  'the page ordinal must move by measured capsule footprint plus the Figma gap');

const tablet = resolveReaderPageChromeLayout(layout(760, 832, 'expanded'),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 53, 14.4,
    true, 96, 24));
assert.equal(tablet.footerRight, 735);
assert.equal(tablet.sessionX, 639);
assert.equal(tablet.bottomEndX, 581);

const longerOrdinal = resolveReaderPageChromeLayout(layout(390, 844),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 22, 14.4, 120, 14.4,
    true, 96, 24));
assert.equal(longerOrdinal.sessionX, 269);
assert.equal(longerOrdinal.bottomEndX, 144,
  'long localized/page-count text expands left while the capsule remains right-anchored');
const longChapter = resolveReaderPageChromeLayout(layout(390, 844),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 500, 14.4, 30, 14.4));
assert.ok(longChapter.bottomEndMaxWidth >= 30,
  'the right-hand percentage keeps a status slot even when the chapter title is long');
assert.ok(longChapter.bottomStartMaxWidth < 500,
  'a long chapter title is constrained to the remaining left footer width');

const safeArea = resolveReaderPageChromeLayout(layout(365.71, 780, 'compact', 40, 34),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 30, 14.4, 80, 14.4,
    true, 110, 24));
assert.equal(safeArea.footerRight, 325.71);
assert.ok(safeArea.sessionX >= 25);
assert.ok(safeArea.bottomEndX >= safeArea.bottomStartX);
assert.ok(safeArea.footerTop + 24 <= 780 - 34);

const visibleStatusBar = resolveReaderPageChromeLayout(layout(365.71, 780, 'compact', 0, 0, 40),
  new ReaderPageChromeMeasurements(120, 14.4, 30, 14.4, 30, 14.4, 80, 14.4));
assert.equal(visibleStatusBar.topStartY, 48,
  'page-owned top metadata must start below the live status-bar edge, not on the clipping boundary');
assert.equal(visibleStatusBar.topEndY, 48,
  'book title and clock must share the same safe top track');
assert.ok(visibleStatusBar.topStartY + 14.4 < 72,
  'the safe top row must remain above the compact reading body track');

assert.equal(formatReaderPageProgress(37.6), '38%');
assert.equal(formatReaderPageOrdinal(new ReaderPageOrdinal(0, 7)), '第 1 / 7 页');
assert.equal(formatReaderPageOrdinal(new ReaderPageOrdinal(8)), '第 9 页');

// Exercise the production measurement method: a page update used to measure
// all four strings again for every geometry expression (over 40 SDK calls).
const chromeSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPageChrome.ets', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
// Exercise the actual SDK-emitted Text position attributes, rather than only
// the layout helper. The visible and hidden avoid-area samples retain the
// same real status rectangle; neither cutout setting may introduce a new lane.
const statusContext = {
  px2vp: value => value / 3, fp2px: value => value * 3, px2fp: value => value / 3,
  getHostContext: () => ({ resourceManager: { getNumber: () => 48 } }),
  getMeasureUtils: () => ({ measureTextSize: ({ textContent }) =>
    ({ width: textContent.length * 21, height: 60 }) }),
};
const statusChrome = createReaderBuilderProbe(chromeSource,
  ['build', 'chromeLayout', 'textMeasure', 'topTextStyle', 'footerExitX', 'footerExitY', 'metaColor'],
  { ReaderPageChromeMeasurements, READER_PAGE_CHROME_BOOKMARK_SIZE, resolveReaderPageChromeLayout,
    measureReaderPageChromeText, readerPageChromeTopTextStyle }).owner;
Object.assign(statusChrome, {
  topStartText: '实际书名', topEndText: '12:30', bottomStartText: '', bottomEndText: '',
  topInfoSuppressed: false, topTranslateY: 0, incomingOpacity: 1,
  footerOpacity: 1, footerTranslateX: 0, sessionExitProgress: 0,
  sessionVisible: false, sessionWidth: 0, sessionHeight: 0,
  sessionOverlayActive: false, isSessionOverlay: false,
  textMeasureCache: new Map(), appearance: { activeTheme: 'paper' },
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
  assert.equal(title.position.y, expectedY, 'SDK title centres in the measured status band');
  assert.equal(time.position.y, expectedY, 'SDK clock shares that same status-band position');
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
      assertStatusTextPositions(page, statusTop + Math.min(Math.max(0, statusHeight - 20),
        Math.max(0, statusHeight - 20) / 2 + 4));
      statusCases++;
    }
  }
}
// The top information row owns the measured status-bar origin. A visible
// SYSTEM inset must not become a second vertical offset for the row.
const geometrySource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts', import.meta.url), 'utf8');
assert.match(geometrySource, /const informationTop = Number\.isFinite\(metrics\.statusBarRect\.top\)/);
const regressionMetrics = new windowMetrics.ReaderWindowMetricsSnapshot();
Object.assign(regressionMetrics, { ready: true, revision: 999,
  statusBarHeight: 48, statusBarRect: new windowMetrics.ReaderRectVp(0, 3, 390, 48) });
assertStatusTextPositions(readingGeometry.resolveReaderReadingLayout(390, 844, false, regressionMetrics, false), 21);
// Exercise the SDK Text consumer with a body lane enlarged by a cutout and
// large-font clearance. Those independent budgets must no longer move the
// ordinary 20vp information labels out of the actual status-bar track.
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
    assertStatusTextPositions(page, top + Math.min(Math.max(0, statusHeight - 20),
      Math.max(0, statusHeight - 20) / 2 + 4));
    statusCases++;
  }
}
console.log(`page chrome ${statusCases} actual SDK Text coordinate cases and no-double-offset status origin contract: PASS`);

const measureSource = chromeSource.slice(chromeSource.indexOf('  private textMeasure('),
  chromeSource.indexOf('  private metaColor('));
const ChromeMeasure = new Function('measureReaderPageChromeText', 'readerPageChromeTopTextStyle', `${stripTypeScriptTypes(`class ChromeMeasure { ${measureSource} }`)}; return ChromeMeasure;`)(measureReaderPageChromeText, readerPageChromeTopTextStyle);
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

// Native texture reuse must include every page-owned chrome input. Otherwise
// idle clock changes paint in ArkUI but the next curl revives an old minute.
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const ChromeOwner = productionMotionMethods(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
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
  'enabling immersive status hiding cannot reuse a texture with the information row suppressed');
clockOwner.readerSettingsSnapshot.hideStatusBar = false;
assert.equal(identity(chrome), statusVisibleIdentity, 'restoring visible status restores the same presentation identity');
clockOwner.admitPageChromeClock('12:30');
assert.equal(clockOwner.refreshes, 0, 'unchanged minute does not recapture');
clockOwner.admitPageChromeClock('12:31');
assert.equal(clockOwner.pageTurnRenderRevision, 5);
assert.equal(clockOwner.refreshes, 1, 'new minute schedules the existing idle-only texture path');
console.log('page chrome/native snapshot invalidation: PASS');

const LayoutChrome = productionMotionMethods(
  new URL('../entry/src/main/ets/features/reading/ReaderPageChrome.ets', import.meta.url), ['chromeLayout', 'topTextStyle'],
  { TYPE_READER_IMMERSIVE_TIME: style, TYPE_READER_IMMERSIVE_PROGRESS: style,
    TYPE_READER_IMMERSIVE_PAGE_ORDINAL: style, ReaderPageChromeMeasurements, resolveReaderPageChromeLayout,
    READER_PAGE_CHROME_BOOKMARK_SIZE, readerPageChromeTopTextStyle });
let layoutMeasures = 0;
const layoutChrome = Object.assign(new LayoutChrome(), { ...chrome, layout: layout(390, 844),
  topStartText: 'Book', topEndText: '12:30', bottomStartText: '第 325 章', bottomEndText: '38%',
  textMeasure() { layoutMeasures++; return { width: 30, height: 14.4 }; },
  getUIContext: owner.getUIContext });
const geometry = layoutChrome.chromeLayout();
for (let frame = 0; frame < 100; frame++) assert.equal(layoutChrome.chromeLayout(), geometry);
assert.equal(layoutMeasures, 4, 'geometry reads reuse the complete immutable layout');
layoutChrome.layout.pageChromeVisualSafeTop = 40;
assert.equal(layoutChrome.chromeLayout().topEndY, 48 + (24 - 14.4) / 2,
  'clock centres in the same 24vp bookmark lane below the safe top');
assert.equal(layoutMeasures, 8, 'in-place safe area changes invalidate geometry');
layoutChrome.sessionVisible = true; layoutChrome.sessionWidth = 80; layoutChrome.sessionHeight = 24;
assert.notEqual(layoutChrome.chromeLayout().bottomEndX, geometry.bottomEndX);
console.log('page chrome complete layout reuse and safe-area/session invalidation: PASS');

assert.match(experienceSource, /const chapterTitle = this\.pageChromeChapterTitle\(chapterIndex\);/,
  'page chrome resolves the current chapter from the page-owned anchor');
assert.match(experienceSource, /chapterTitle\.length > 0 \? chapterTitle : '—',[\s\S]*formatReaderPageProgress\(/,
  'the footer contract is chapter title on the left and full-reading percentage on the right');
assert.match(experienceSource, /continuousPageChromeSnapshot\(this\.continuousRenderRevision, ''\)\.bottomEndText/,
  'continuous scrolling refreshes the right-hand percentage slot');

const CaptureOwner = productionMotionMethods(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['sessionLaunchRenderWorkBlocked', 'performBookTurnTextureRefresh', 'onBookTurnArkUIFramePresented'],
  { BOOK_TURN_TEXTURE_CURRENT: 1, BOOK_TURN_TEXTURE_PREVIOUS: 0, BOOK_TURN_TEXTURE_NEXT: 2 });
const snapshots = [], captures = Object.assign(new CaptureOwner(), {
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
assert.equal(snapshots.length, 3); assert.ok(snapshots.every(s => s[1] === '12:31'));
captures.onBookTurnArkUIFramePresented(20);
assert.equal(captures.refreshes, 1, 'duplicate acknowledgment never creates a capture loop');
console.log('mounted slot revision delivery gates current/adjacent chrome capture: PASS');

// A second offscreen Chrome instance reuses exact typography metrics.
assert.match(chromeSource, /private textMeasureCache: Map<string, Size> = readerPageChromeTextMeasurements/);
const peer = Object.assign(new ChromeMeasure(), {textMeasureCache: owner.textMeasureCache,
  layout: owner.layout, getUIContext: owner.getUIContext});
owner.textMeasure('Shared book title', style); const beforePeer = measurements;
assert.equal(peer.textMeasure('Shared book title', style).width, owner.textMeasure('Shared book title', style).width);
assert.equal(measurements, beforePeer);
for (let page=0; page<80; page++) {
  peer.textMeasure('Shared book title', style);
  peer.textMeasure(`Fresh ${page}`, style);
}
const beforeRetained = measurements; peer.textMeasure('Shared book title', style);
assert.equal(measurements, beforeRetained, 'LRU retains repeated book/clock labels instead of clearing every page');
assert.ok(peer.textMeasureCache.size <= 64);

// Execute all cache combinations: only real snapshot work yields. A cached
// current/requested pair must not wait for two empty frame callbacks.
for (const preferred of ['next', 'previous']) for (let mask=0; mask<8; mask++) {
  const identities = ['previous-31', 'current-31', 'next-31'];
  const cached = identities.map((id, slot) => mask & (1 << slot) ? id : '');
  const work = [], sequence = [];
  captures.preferredPageTextureDirection = preferred;
  captures.bookTurnCapturedIdentity = slot => cached[slot];
  captures.captureBookTurnTexture = async (slot, page) => {
    if (cached[slot] !== page.textureIdentity) { work.push(slot); sequence.push(`capture${slot}`); cached[slot] = page.textureIdentity; }
    return true;
  };
  captures.yieldPageTextureFrame = async () => { sequence.push('yield'); };
  await captures.performBookTurnTextureRefresh(7);
  const order = preferred === 'next' ? [1,2,0] : [1,0,2];
  const expected = order.filter(slot => !(mask & (1 << slot)));
  assert.deepEqual(work, expected);
  assert.deepEqual(sequence, expected.flatMap((slot, i) => i ? ['yield', `capture${slot}`] : [`capture${slot}`]));
}
console.log('production texture refresh cache matrix: no idle frame waits; requested direction first; expensive captures remain spread: PASS');
