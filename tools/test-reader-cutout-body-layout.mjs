import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { measureReaderPageChromeText, readerPageChromeTopTextStyle } from './lib/reader-page-chrome-measurement-probe.mjs';
import { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import { createReadingPaginationLayoutSignature } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import { ReaderPageChromeMeasurements, resolveReaderPageChromeLayout } from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });

function metrics(width, height, statusHeight, systemTop = statusHeight, cutoutTop = 0, statusTop = 0, fontScale = 1) {
  return new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), new ReaderRectVp(0, 0, width, height),
    new ReaderInsetsVp(0, systemTop), new ReaderInsetsVp(0, cutoutTop), new ReaderInsetsVp(), new ReaderInsetsVp(),
    new ReaderInsetsVp(), 3, fontScale, 1, true, statusHeight, new ReaderRectVp(0, statusTop, width, statusHeight));
}

const forms = [[390, 844, false], [844, 390, false], [760, 960, true], [960, 760, true], [540, 700, true]];
let cases = 0;
for (const [width, height, tablet] of forms) for (const statusHeight of [24, 40, 137 / 3, 140 / 3]) {
  for (const statusTop of [0, 3]) for (const scale of [1, 1.5, 2]) {
    const visible = metrics(width, height, statusHeight, statusHeight, 0, statusTop, scale);
    const off = geometry.resolveReaderReadingLayout(width, height, tablet, visible, false);
    const onBeforeHide = geometry.resolveReaderReadingLayout(width, height, tablet, visible, true);
    const hidden = metrics(width, height, statusHeight, 0, 0, statusTop, scale);
    const onAfterHide = geometry.resolveReaderReadingLayout(width, height, tablet, hidden, true);
    const offBeforeReveal = geometry.resolveReaderReadingLayout(width, height, tablet, hidden, false);
    const offAfterReveal = geometry.resolveReaderReadingLayout(width, height, tablet, visible, false);
    for (const page of [off, onBeforeHide, onAfterHide, offBeforeReveal, offAfterReveal]) {
      assert.deepEqual([page.viewportWidth, page.viewportHeight], [width, height],
        'the entire window remains the page in both extension and system-bar states');
    }
    assert.equal(off.contentTop, statusTop + statusHeight * 2 + 8, 'visible status and information lanes set the body top without an authored floor');
    assert.equal(onBeforeHide.contentTop, statusTop + statusHeight + 8, 'extending uses one information lane and the existing 8vp text gap');
    assert.equal(onAfterHide.contentTop, onBeforeHide.contentTop, 'late system avoid-area hide must not shift the body again');
    assert.equal(offBeforeReveal.contentTop, offAfterReveal.contentTop, 'late system avoid-area reveal must not shift the body again');
    assert.ok(Math.abs(off.contentTop - onBeforeHide.contentTop - statusHeight) < 1e-8);
    assert.ok(Math.abs(onBeforeHide.bodyHeight(false) - off.bodyHeight(false) - statusHeight) < 1e-8);
    assert.equal(off.contentLeft, onBeforeHide.contentLeft);
    assert.equal(off.contentBottom, onBeforeHide.contentBottom);
    const controlVisible = geometry.resolveReaderControlLayout(width, height, tablet, visible);
    const controlHidden = geometry.resolveReaderControlLayout(width, height, tablet, hidden);
    assert.equal(controlVisible.topBarTop, controlHidden.topBarTop, 'retained status geometry keeps control invocation stable');
    cases++;
  }
}

for (const [width, height, tablet] of forms) for (const statusHeight of [24, 40]) for (const extended of [false, true]) {
  const cutoutBottom = statusHeight * 2 + 30;
  const inset = metrics(width, height, statusHeight, 0, cutoutBottom);
  assert.equal(geometry.resolveReaderReadingLayout(width, height, tablet, inset, extended).contentTop, cutoutBottom,
    'body text always clears a taller physical cutout, including extended reading');
  // TYPE_CUTOUT supplies a rectangle as well as an inset. A floating cutout's
  // height alone is insufficient when its top is not the window origin.
  const rect = metrics(width, height, statusHeight, 0, statusHeight);
  rect.statusBarCutoutRect = new ReaderRectVp(width / 2 - 30, 30, 60, statusHeight * 2);
  assert.equal(geometry.resolveReaderReadingLayout(width, height, tablet, rect, extended).contentTop, cutoutBottom);
  cases++;
}

// Native AUTO line measurement may exceed the status lane at a larger font
// scale or when a fallback glyph needs a taller line. Compose the actual
// chrome and body layouts using that same measurement, without clipping it.
for (const [width, height, tablet] of forms) for (const statusHeight of [24, 40]) {
  for (const measuredHeight of [40, 60]) for (const extended of [false, true]) {
    const visible = metrics(width, height, statusHeight);
    const hidden = metrics(width, height, statusHeight, 0);
    const layout = geometry.resolveReaderReadingLayout(width, height, tablet, visible, extended, undefined, measuredHeight);
    const afterChromeChange = geometry.resolveReaderReadingLayout(width, height, tablet, hidden, extended, undefined, measuredHeight);
    const chrome = resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(150, measuredHeight,
      60, measuredHeight, 0, 0, 0, 0, false, 0, 0, 24, 24));
    assert.equal(layout.pageChromeTopRegionHeight, statusHeight, 'the platform status band is not replaced by a text measurement');
    assert.equal(layout.contentTop, (extended ? 0 : statusHeight) + Math.max(statusHeight, measuredHeight) + 8);
    assert.ok(chrome.topStartY + measuredHeight + 8 <= layout.contentTop,
      'measured large top text keeps its complete height and an 8vp gap before body text');
    assert.ok(chrome.topEndY + measuredHeight + 8 <= layout.contentTop);
    assert.equal(afterChromeChange.contentTop, layout.contentTop, 'controls/system-bar visibility cannot move a measured top-text budget');
    assert.equal(afterChromeChange.bodyHeight(false), layout.bodyHeight(false));
    cases++;
  }
}

for (const invalidHeight of [NaN, Infinity, -1]) {
  const current = metrics(390, 844, 24);
  const original = geometry.resolveReaderReadingLayout(390, 844, false, current, true);
  const invalid = geometry.resolveReaderReadingLayout(390, 844, false, current, true, undefined, invalidHeight);
  assert.equal(invalid.contentTop, original.contentTop, 'invalid optional measurement cannot corrupt the pagination budget');
}

// Unknown metrics and a current landscape/split window with no top status
// region retain the existing authored fallback, never a portrait lane.
for (const [width, height, tablet] of forms) for (const ready of [false, true]) for (const extended of [false, true]) {
  const current = metrics(width, height, 0, 0);
  current.ready = ready;
  const layout = geometry.resolveReaderReadingLayout(width, height, tablet, current, extended);
  assert.equal(layout.contentTop, width >= 600 ? 92.44 : 72);
  assert.equal(layout.pageChromeTopRegionHeight, 0);
  assert.equal(layout.pageChromeVisualSafeTop, 0);
  assert.ok(layout.bodyHeight(true) > 0);
  cases++;
}

// Execute the actual reader cache, layout signature and reflow methods. The
// unchanged owner must distinguish the two geometry budgets and ignore a
// later chrome-only inset update, while preserving the current scalar anchor.
let currentMetrics = metrics(390, 844, 24);
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const Reader = productionMotionMethods(file, ['readingLayout', 'effectiveViewportWidth', 'effectiveViewportHeight',
  'windowMetricsLayoutKey', 'paginationLayoutSignature', 'reflowAfterWindowGeometryChange'], {
  ...geometry, ReaderWindowCoordinator: { metrics: () => currentMetrics }, createReadingPaginationLayoutSignature,
  measureReaderPageChromeText, readerPageChromeTopTextStyle,
  readerRegisteredFontFamily: (_font, family) => family, readerAppearanceSnapshotFontFamily: () => 'test-font', FIGMA_BODY_FONT_WEIGHT: 'Regular',
  readerAppearanceFontScale: () => 1, readerAppearanceLineHeight: () => 1.5,
  readerAppearanceParagraphIndent: () => 0, READING_WRITING_MODE: 'horizontal-tb',
});
const invalidated = [], measured = [];
const context = {
  px2vp: value => value / 3, px2fp: value => value / 3, fp2px: value => value * 3,
  getHostContext: () => ({ resourceManager: { getNumber: () => 48 } }),
  getMeasureUtils: () => ({ measureTextSize: ({ textContent }) => ({ width: textContent.length * 24, height: 120 }) }),
};
const reader = Object.assign(new Reader(), { viewportWidth: 390, viewportHeight: 844, isTablet: false,
  bookTitle: '实际正文预算', pageChromeClockText: '12:30', getUIContext: () => context,
  readerSettingsSnapshot: { extendIntoCutout: false }, pageTurnFrozenRevision: -1, pageTurnRenderRevision: 1,
  sourceId: 'source', bookId: 'book', lifecycleToken: 7, phase: 'ready', desiredChapterOffset: 123,
  appearanceSnapshot: { fontSize: 20, paragraphSpacing: 8, indent: 0, letterSpacing: 0, alignment: 'start' },
  pageTurnInputPhase: () => 'idle', invalidatePageTurnRuntime: () => {}, resetPaginationDraft: () => {},
  applyWindowChrome: () => {}, hasCurrentMaterializedChapter: () => true,
  paginationIndex: { invalidateBook: (...identity) => invalidated.push(identity) },
  beginMeasurement: token => measured.push(token),
});
const before = reader.readingLayout(), signatureBefore = reader.paginationLayoutSignature();
assert.equal(before.contentTop, 72, 'actual owner passes measured 40vp text above the 24vp status lane to body geometry');
reader.lastWindowMetricsLayoutKey = reader.windowMetricsLayoutKey();
reader.readerSettingsSnapshot.extendIntoCutout = true;
reader.reflowAfterWindowGeometryChange();
assert.notEqual(reader.readingLayout(), before, 'the actual layout cache includes the cutout preference');
assert.equal(reader.readingLayout().contentTop, 48, 'actual owner preserves the whole measured row when extended');
assert.notEqual(reader.paginationLayoutSignature(), signatureBefore, 'the existing pagination signature includes the corrected top inset');
assert.deepEqual(invalidated, [['source', 'book']]);
assert.deepEqual(measured, [7]);
assert.equal(reader.desiredChapterOffset, 123, 'reflow keeps the semantic location instead of substituting an old page number');
const extendedSignature = reader.paginationLayoutSignature();
currentMetrics = metrics(390, 844, 24, 0); currentMetrics.revision = 2;
reader.reflowAfterWindowGeometryChange();
assert.equal(reader.paginationLayoutSignature(), extendedSignature);
assert.equal(measured.length, 1, 'system hide callback with unchanged body budget does not remeasure again');
reader.readerSettingsSnapshot.extendIntoCutout = false;
reader.reflowAfterWindowGeometryChange();
assert.equal(reader.paginationLayoutSignature(), signatureBefore);
assert.equal(measured.length, 2);
currentMetrics = metrics(390, 844, 24, 24); currentMetrics.revision = 3;
reader.reflowAfterWindowGeometryChange();
assert.equal(measured.length, 2, 'system reveal callback with unchanged body budget does not remeasure again');

console.log(`PASS PH114 ${cases} production geometry cases and actual reader cache/signature/reflow: body follows measured information lanes, clears cutouts, survives chrome timing and preserves its scalar anchor. No device pixel claim.`);
