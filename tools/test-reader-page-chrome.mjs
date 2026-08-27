import assert from 'node:assert/strict';
import {
  ReaderPageChromeMeasurements,
  resolveReaderPageChromeLayout,
} from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
import {
  ReaderPageChromeSnapshot,
  ReaderPageOrdinal,
  formatReaderPageOrdinal,
  formatReaderPageProgress,
  readerComposedPageTextureKey,
  readerPageBodyRasterKey,
  readerPageChromeCacheKey,
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

const pageA = new ReaderPageChromeSnapshot('书名', '10:30', '38%', '第 1 / 7 页', false);
const pageB = new ReaderPageChromeSnapshot('书名', '10:31', '42%', '第 2 / 7 页', true, 96, 24);
const keyA = readerPageChromeCacheKey('page-a', pageA, 'paper', '390x844');
const keyB = readerPageChromeCacheKey('page-b', pageB, 'paper', '390x844');
assert.notEqual(keyA, keyB, 'page-specific values and session footprint must invalidate chrome only');
assert.notEqual(
  readerComposedPageTextureKey('same-body', keyA),
  readerComposedPageTextureKey('same-body', keyB),
  'composed texture identity must include the independently cacheable chrome raster');
assert.notEqual(
  readerPageBodyRasterKey('page-a', 'rev-1', '390x844', 'paper-18'),
  readerPageBodyRasterKey('page-a', 'rev-2', '390x844', 'paper-18'),
  'content revision must invalidate the body raster even when the page anchor is unchanged');

console.log('reader page chrome dynamic layout and cache identity: PASS');
