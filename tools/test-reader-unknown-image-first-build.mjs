import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingSurfaceLayoutMap, readingChapterLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { ReadingPaginationIndex, ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import { collectReadingParagraphUtf16Ranges, readingParagraphBoundaryMode } from '../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

// Like local-reverse-page and measurement-prefix, run the real production
// owner against explicit native line receipts. No shaping, first paint, Core
// progress persistence or platform pixel success is claimed by this test.
const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const text = readFileSync(source, 'utf8');
function declaration(name, next) {
  const start = text.indexOf(`class ${name} `);
  assert.ok(start >= 0, name);
  return new Function('ReadingSurfaceLayoutMap', stripTypeScriptTypes(text.slice(start, text.indexOf(next, start))) + `;return ${name};`)(ReadingSurfaceLayoutMap);
}
const ParagraphRange = declaration('ParagraphRange', '/**');
const MeasurementParagraph = declaration('MeasurementParagraph', 'class MeasuredReadingLine');
const MeasuredReadingLine = declaration('MeasuredReadingLine', 'class PhysicalReadingPage');
const PhysicalReadingPage = declaration('PhysicalReadingPage', 'interface DeferredReadingImagePixels');
const PreviousChapterMeasurement = declaration('PreviousChapterMeasurement', 'class CoreReadingAnchor');
const ArkUILineMetric = declaration('ArkUILineMetric', 'type ReadingPhase');
const nativeText = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextWindow.ets', import.meta.url), 'utf8');
const heightText = nativeText.slice(nativeText.indexOf('export function readerNativeParagraphHeight'), nativeText.indexOf('/** A viewport'));
const readerNativeParagraphHeight = new Function('graphicsText', stripTypeScriptTypes(heightText).replace('export ', '') + ';return readerNativeParagraphHeight;')({ RectWidthStyle: { TIGHT: 0 }, RectHeightStyle: { TIGHT: 0 } });
class TextController { getLayoutManager() { assert.ok(this.manager, 'only measured controllers expose geometry'); return this.manager; } }
class Fragment {
  constructor(id, text, isParagraphStart, startScalar, endScalar, imageSource, imageHeight, fileUri, layoutHeight, imageWidthBasisPoints) {
    Object.assign(this, { id, text, isParagraphStart, startScalar, endScalar, imageSource, imageHeight, fileUri, layoutHeight, imageWidthBasisPoints });
  }
}
class NativeWindow { constructor(...args) { this.args = args; } }
let serial = 0;
const methods = [
  'beginMeasurement', 'captureMeasurementAfterLayout', 'consumeMeasuredBatch',
  'collectParagraphRanges', 'appendParagraphRange', 'prepareNextMeasurementBatch', 'rangeIndexForOffset',
  'measureNativeTextBatch', 'measureNativeChapterTitle', 'measureNativeParagraph', 'measurementNodeText',
  'captureChapterTitleMeasurementAfterLayout', 'measurementIncludesChapterTitle', 'paragraphHasLayout',
  'measuredLines', 'toLineMetric', 'measuredPageEndLimit', 'readingImageForParagraph', 'resolvePendingReadingImage',
  'scaledReadingImageHeight', 'resetPendingPage', 'pendingPageBodyCapacity', 'beginFirstPageCommit',
  'observeMeasuredPhysicalPage', 'retainMeasuredParagraphWindow', 'lastMeasurableScalar', 'lastVisibleScalar',
  'presentationLineText', 'currentMeasurementGeneration', 'currentMeasurementSelection',
  'measuringChapter', 'measuringLayoutMap', 'measuringRanges', 'measuringDraft', 'setMeasuringDraft',
  'measuringOffset', 'setMeasuringOffset', 'setMeasuringProgress', 'measuringRequestedAnchor', 'setMeasuringRequestedAnchor',
  'requireMeasurementChapter', 'requireMeasurementLayoutMap', 'resetMeasurementPaginationDraft',
  'isMeasurementChapterFirstPageStart', 'samePaginationKey',
  'beginReversePageMeasurement', 'preparePreviousMeasurementParagraph', 'consumeReversePageParagraph',
  'measuredReverseLines', 'reversePageCapacityAt', 'continuePreviousChapterMeasurement',
];
const Owner = productionMotionMethods(source, methods, {
  ...style, ReadingSurfaceLayoutMap, readingChapterLayoutMap, ReadingPaginationPrefix,
  ParagraphRange, MeasurementParagraph, MeasuredReadingLine, PhysicalReadingPage, PreviousChapterMeasurement, ArkUILineMetric,
  collectReadingParagraphUtf16Ranges, readingParagraphBoundaryMode, TextController,
  ReadingSurfacePageFragment: Fragment, ReaderNativeTextWindow: NativeWindow,
  readerNativeParagraphHeight, readerNativeParagraphKey: () => `fixture-${++serial}`,
  FontWeight: { Regular: 400 }, TextAlign: { JUSTIFY: 'justify', Start: 'start', Center: 'center' },
  TYPE_READER_CHAPTER_TITLE: { fontFamily: 'system', fontWeight: 500, fontSizeFp: 24 },
  copyReaderAppearanceSnapshot: value => ({ ...value }),
  MAX_MEASUREMENT_BATCH_PARAGRAPHS: 8, MAX_MEASUREMENT_BATCH_UTF16: 12 * 1024,
});
const bookId = 'local:' + 'a'.repeat(64);
const imageSource = `reader-local-epub://${Buffer.from(bookId).toString('base64url')}/${Buffer.from('OPS/image.png').toString('base64url')}`;

function metricManager(receipts, text) {
  let utf16 = 0, top = 0;
  const lines = receipts.map(([count, height]) => {
    const metric = { startIndex: utf16, endIndex: utf16 + count, topHeight: top, height, width: 100, baseline: top + height - 2 };
    utf16 += count; top += height; return metric;
  });
  assert.equal(utf16, text.length, 'explicit line receipts cover the complete original paragraph');
  return { getLineCount: () => lines.length, getLineMetrics: i => lines[i], getRectsForRange: () => [] };
}
function fixture(paragraphs, { capacity = 25, offset = 0, gap = 0, known = false, imageState = 'pending' } = {}) {
  const content = paragraphs.map(p => p.text).join('\n\n');
  const map = new ReadingSurfaceLayoutMap(content);
  const images = [];
  for (let scalar = 0; scalar < map.scalarCount(); scalar++) if (map.sliceByScalar(scalar, scalar + 1) === '\uFFFC') images.push({
    source: imageSource, startScalar: scalar, endScalar: scalar + 1, state: imageState,
    intrinsicWidth: known ? 100 : 0, intrinsicHeight: known ? 10 : 0,
    fileUri: '', pixelMap: undefined, revision: 'pending',
  });
  const chapter = { sourceId: 'local', bookId, chapterIndex: 2, chapterTitle: '章', content, images, contentVersion: 'body' };
  const key = { sourceId: 'local', bookId, chapterIndex: 2, contentVersion: 'body', layoutSignature: `width100-height${capacity}` };
  const requests = [], measured = [], completions = [], resources = [];
  const gateway = { resolveReadingImage(chapter, image, isCurrent) {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ chapter, image, isCurrent, resolve, reject }); return promise;
  } };
  const o = Object.assign(new Owner(), {
    sourceId: 'local', bookId, bookKind: 'epub', chapter, chapterLayoutMap: map,
    paragraphRanges: [], measurementBatch: [], pendingPageFragments: [], visibleFragments: [],
    lifecycleToken: 1, chapterSelectionToken: 1, materializedChapterSelectionToken: 1,
    desiredChapterOffset: offset, desiredChapterProgress: 0, measurementRequestedAnchorScalar: -1,
    phase: 'loading', measurementEpoch: 0, unicodeProbeVerified: true, canonicalModeAnchor: -1,
    paginationIndex: new ReadingPaginationIndex(), measurementCompleting: false, batchProcessing: false,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    appearanceSnapshot: { paragraphSpacing: gap, fontSize: 20, lineHeight: 1.5, lineHeightMultiplier: 1.5, indent: 'none', activeTheme: 'paper' },
    getUIContext: () => ({ px2vp: x => x, vp2px: x => x, fp2px: x => x }),
    readingLayout: () => ({ bodyHeightAfterTitle: height => capacity - height, titleLineHeightFp: 5 }),
    measurementTextWidth: () => 100, measurementPaginationKey: () => key,
    isSessionActive: lifecycle => lifecycle === 1,
    hasMeasuredViewport: () => true, isSelectionCurrent: selection => selection === 1,
    isMeasurementCurrent: (generation, selection, lifecycle) => lifecycle === 1 && o.paginationIndex.isMeasurementCurrent(generation, selection),
    hasValidUnicodeProbe: () => true,
    retainNativeParagraphResources() {}, ensureFirstPageReadyDeadline() {}, armMeasurementDeadline() {},
    cancelMeasurementDeadline() {}, armFirstPageCompletionDeadline() {}, traceInitialReadingPhase() {},
    continueCanonicalModeMeasurement: () => false,
    expandMeasurementParagraphWindow: () => assert.fail('all original paragraphs are already resident'),
    reportMeasurementGatePending: () => assert.fail('controlled text metrics must be available synchronously'),
    fail(error) { throw error; }, recoverPreviousChapterMeasurement(error) { throw error; },
    activeGateway: () => gateway,
    // Boundary after the actual physical page is assembled/observed. An
    // unresolved image must never reach here (and therefore cannot start the
    // completeFirstPage-owned progress/presentation work). This is not a fake
    // Core receipt and the test never claims durable progress success.
    completeFirstPage(page) { completions.push(page); o.visiblePage = page; o.visibleFragments = page.fragments; o.phase = 'ready'; },
    nativeTextMeasurement: { clear() {}, take: controller => controller,
      measure(_context, value, controller) {
        measured.push(value);
        const receipts = value === '章' ? [[1, 5]] : paragraphs.find(p => p.text === value)?.lines;
        assert.ok(receipts, 'only title and explicitly supplied original text may be shaped');
        assert.notEqual(value, '\uFFFC', 'image geometry cannot come from shaping a placeholder');
        controller.manager = metricManager(receipts, value);
      } },
    nativeParagraphResources: { set(...args) { resources.push(args); } },
  });
  return { o, chapter, requests, measured, completions, resources };
}
const txt = (text, lines) => ({ text, lines });
const image = () => ({ text: '\uFFFC', lines: [] });
const begin = f => f.o.beginMeasurement(1);
const assertDeferred = (f, message) => {
  assert.equal(f.o.phase, 'measuring', message);
  assert.equal(f.o.visiblePage, undefined, 'no readable page is invented');
  assert.equal(f.completions.length, 0, 'no page-completion/progress boundary is reached');
  assert.equal(f.requests.length, 1, 'the actual resolver requests only the encountered image');
  assert.equal(f.requests[0].isCurrent(), true);
  assert.equal(f.o.pendingPageFragments.some(fragment => fragment.imageHeight > 0), false,
    'no unknown image is assigned a guessed height');
};

// A paragraph exactly fills the first body viewport. The next image is in
// the same bounded batch/window, but it cannot contribute to that page.
{
  const f = fixture([txt('甲乙', [[1, 10], [1, 10]]), image(), txt('后续', [[2, 10]])]);
  begin(f);
  assert.equal(f.o.phase, 'ready'); assert.equal(f.completions.length, 1);
  assert.equal(f.requests.length, 0, 'next-page dimensions must not delay the full text page');
  assert.deepEqual(f.measured, ['章', '甲乙'], 'unneeded suffix is never shaped');
  assert.equal(f.o.visiblePage.contentHeight, 20); assert.equal(f.o.visiblePage.bodyCapacity, 20);
  assert.equal(f.o.visiblePage.endScalar, 2, 'unread image and separator are not consumed');
  assert.equal(f.o.visibleFragments.map(fragment => fragment.text).join(''), '甲乙');
  assert.equal(f.chapter.images[0].state, 'pending');
}
// Fractional remaining space below the renderer's real minimum also proves
// exclusion. No estimated intrinsic aspect ratio is used to make that choice.
{
  const f = fixture([txt('甲乙', [[1, 10], [1, 9.5]]), image()]);
  begin(f); assert.equal(f.completions.length, 1); assert.equal(f.requests.length, 0);
  assert.equal(f.o.visiblePage.contentHeight, 19.5);
}
for (const paragraphs of [[image()], [txt('甲', [[1, 10]]), image(), txt('后', [[1, 10]])]]) {
  const f = fixture(paragraphs); begin(f); assertDeferred(f, 'pure-image/current-page unknown geometry stays deferred');
  assert.equal(f.requests[0].image, f.chapter.images[0]);
  assert.equal(f.o.pendingPageHeight, paragraphs.length === 1 ? 0 : 10);
}
// Exactly 1vp remains: the minimum alone cannot prove overflow, so the real
// dimensions are still mandatory. This prevents a too-broad text-only fast path.
{
  const f = fixture([txt('甲乙', [[1, 10], [1, 9]]), image()]);
  begin(f); assertDeferred(f, 'an image that may fit must resolve before page publication');
}
// A saved anchor after an unknown image shapes only its containing original
// paragraph; preceding images cannot force a chapter-head measurement pass.
{
  const f = fixture([image(), txt('远处', [[2, 50]]), txt('目标😀正文', [[2, 10], [2, 10], [2, 10]])], { offset: 7 });
  begin(f); assert.equal(f.completions.length, 1); assert.equal(f.requests.length, 0);
  assert.deepEqual(f.measured, ['目标😀正文']);
  assert.equal(f.o.visiblePage.startScalar, 7); assert.equal(f.o.visiblePage.endScalar, 10);
  assert.equal(f.o.visibleFragments.map(fragment => fragment.text).join(''), '目标😀');
  assert.equal(f.o.visiblePage.contentHeight, 20);
  assert.equal(f.o.visiblePage.paginationObservation.requestScalar, 7);
}
// Reverse navigation still resolves a genuinely encountered unknown image.
{
  const f = fixture([txt('前', [[1, 10]]), image(), txt('后', [[1, 10]])]);
  f.o.previousChapterMeasurement = new PreviousChapterMeasurement(2, 6, 2);
  begin(f); assertDeferred(f, 'reverse image cannot be inferred from a forward text page');
  assert.equal(f.requests[0].image.startScalar, 3);
  assert.equal(f.o.pendingPageHeight, 0);
}
for (const imageState of ['pending', 'failed']) {
  const f = fixture([image(), txt('正文', [[2, 10]])], { known: true, imageState });
  begin(f); assert.equal(f.completions.length, 1); assert.equal(f.requests.length, 0);
  assert.equal(f.o.visiblePage.contentHeight, 20);
  assert.equal(f.o.visibleFragments[0].imageHeight, 10);
  assert.equal(f.o.visibleFragments[0].fileUri, undefined);
  assert.equal(f.o.visibleFragments[0].imageSource, undefined);
  assert.equal(f.o.visibleFragments.map(fragment => fragment.text).join(''), '正文');
  assert.deepEqual(f.measured, ['章', '正文'], 'known geometry never shapes image glyphs or waits for pixels');
}
console.log('PASS unknown-image first-build: actual begin/capture/consume/physical-page chain; full-page suffix exclusion, in-page/pure-image deferral without guessed height or completion, deep Unicode saved anchor, real reverse resolver and known pending/failed geometry. Controlled metrics only; no native paint or durable-progress claim.');
