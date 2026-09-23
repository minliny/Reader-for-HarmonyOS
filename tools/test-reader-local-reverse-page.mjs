import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingSurfaceLayoutMap, readingChapterLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { ReadingPaginationIndex, ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import { ReadingEntryHandoff, estimateRetainedRemoteSessionBytes } from '../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

// Execute production page assembly against explicit native metric receipts.
// These fixtures prove admission/ownership, not platform shaping or pixels.
const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const text = readFileSync(source, 'utf8');
function declaration(name, next) {
  return new Function('ReadingSurfaceLayoutMap', stripTypeScriptTypes(text.slice(text.indexOf(`class ${name} {`), text.indexOf(next, text.indexOf(`class ${name} {`)))) + `; return ${name};`)(ReadingSurfaceLayoutMap);
}
const MeasurementParagraph = declaration('MeasurementParagraph', 'class MeasuredReadingLine');
const MeasuredReadingLine = declaration('MeasuredReadingLine', 'class PhysicalReadingPage');
const PhysicalReadingPage = declaration('PhysicalReadingPage', '/** Immutable display inputs');
const PreviousChapterMeasurement = declaration('PreviousChapterMeasurement', 'class CoreReadingAnchor');
const ParagraphRange = declaration('ParagraphRange', 'class MeasurementParagraph');
const nativeSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextWindow.ets', import.meta.url), 'utf8');
const heightSource = nativeSource.slice(nativeSource.indexOf('export function readerNativeParagraphHeight'), nativeSource.indexOf('/** A viewport'));
const height = new Function('graphicsText', stripTypeScriptTypes(heightSource).replace('export ', '') + ';return readerNativeParagraphHeight;')({ RectWidthStyle: { TIGHT: 0 }, RectHeightStyle: { TIGHT: 0 } });
class Controller { getLayoutManager() { return this.manager; } }
class Fragment {
  constructor(id, text, isParagraphStart, startScalar, endScalar, imageSource, imageHeight, fileUri, measuredHeight) {
    Object.assign(this, { id, text, isParagraphStart, startScalar, endScalar, imageSource, imageHeight, fileUri, measuredHeight });
  }
}
class NativeWindow {
  constructor(...args) {
    this.args = args;
    if (args[1]?.ownershipFixture) assert.equal(args[1].disposed, false,
      'transferred native node must still be alive when its visible owner receives it');
  }
}
let serial = 0;
const methods = ['beginReversePageMeasurement', 'preparePreviousMeasurementParagraph', 'consumeReversePageParagraph',
  'measuredReverseLines', 'reversePageCapacityAt', 'measureNativeParagraph', 'measuredPageEndLimit',
  'beginFirstPageCommit', 'continuePreviousChapterMeasurement', 'observeMeasuredPhysicalPage',
  'resetPendingPage', 'pendingPageBodyCapacity', 'measuredLines', 'consumeMeasuredBatch', 'paragraphHasLayout',
  'scaledReadingImageHeight', 'retainMeasuredParagraphWindow', 'measureNativeTextBatch',
  'measureNativeChapterTitle', 'captureChapterTitleMeasurementAfterLayout'];
const ownerDependencies = {
  ...style, ReadingSurfaceLayoutMap, readingChapterLayoutMap, ReadingPaginationPrefix, ParagraphRange, MeasurementParagraph, MeasuredReadingLine,
  PhysicalReadingPage, TextController: Controller, ReadingSurfacePageFragment: Fragment,
  ReaderNativeTextWindow: NativeWindow, readerNativeParagraphHeight: height, readerNativeParagraphKey: () => `p${++serial}`,
  FontWeight: { Regular: 400 }, TextAlign: { JUSTIFY: 'justify', Start: 'start', Center: 'center' },
  TYPE_READER_CHAPTER_TITLE: { fontFamily: 'system', fontWeight: 500, fontSizeFp: 24 },
  copyReaderAppearanceSnapshot: value => ({ ...value }),
};
const Owner = productionMotionMethods(source, methods, ownerDependencies);

function metricManager(lines) {
  let top = 0, end = 0;
  const metrics = lines.map(([chars, h, ink = 0]) => {
    const value = { startIndex: end, endIndex: end + chars, topHeight: top, height: h, width: 100, baseline: top + h - 2, ink };
    end += chars; top += h; return value;
  });
  return { getLineCount: () => metrics.length, getLineMetrics: i => metrics[i],
    getRectsForRange: ({ start, end }) => metrics.filter(m => m.startIndex >= start && m.endIndex <= end)
      .map(m => ({ rect: { top: m.topHeight - m.ink, bottom: m.topHeight + m.height + m.ink } })) };
}

function create(paragraphs, endScalar, { capacity = 25, gap = 3, titleHeight = 0, residentStart = 0, total, currentChapter = 2, targetChapter = 2, ownerClass = Owner } = {}) {
  const content = paragraphs.map(p => p.text).join('\n');
  const count = [...content].length;
  const range = residentStart > 0 || total !== undefined ? { startScalar: residentStart, endScalar: residentStart + count, totalScalars: total ?? residentStart + count } : undefined;
  const chapter = { sourceId: 's', bookId: 'b', chapterIndex: targetChapter, chapterTitle: '章', content, documentRange: range, images: [], contentVersion: 'body' };
  const map = new ReadingSurfaceLayoutMap(content, range);
  let utf16 = 0;
  const ranges = paragraphs.map((p, i) => { const start = utf16; utf16 += p.text.length + 1; return {
    id: `r${i}`, startUtf16: start, endUtf16: utf16 - 1,
    startScalar: map.scalarForUtf16(start), endScalar: map.scalarForUtf16(utf16 - 1),
  }; });
  const key = { sourceId: 's', bookId: 'b', chapterIndex: targetChapter, layoutSignature: 'layout', contentVersion: 'body' };
  const lease = new ReadingPaginationIndex();
  const o = Object.assign(new ownerClass(), {
    chapter, key, map, ranges, chapterLayoutMap: map, paragraphRanges: ranges, lifecycleToken: 1, pendingPageFragments: [], measurementBatch: [], measurementEpoch: 0,
    previousChapterMeasurement: new PreviousChapterMeasurement(currentChapter, endScalar, targetChapter),
    paginationIndex: lease, phase: 'ready', measured: [], resources: [],
    readerSettingsSnapshot: { navigationMode: 'paged' },
    appearanceSnapshot: { paragraphSpacing: gap, fontSize: 20, lineHeight: 1.5, indent: 'none', activeTheme: 'paper' },
    getUIContext: () => ({ px2vp: x => x, vp2px: x => x, fp2px: x => x }),
    measurementTextWidth: () => 100, readingLayout: () => ({ bodyHeightAfterTitle: h => capacity - h }),
    currentMeasurementGeneration: () => lease.measurementGeneration(),
    isMeasurementCurrent: (g, s, l) => l === 1 && lease.isMeasurementCurrent(g, s),
    requireMeasurementChapter() { return this.chapter; }, measuringChapter() { return this.chapter; },
    requireMeasurementLayoutMap() { return this.chapterLayoutMap; }, measuringRanges() { return this.paragraphRanges; },
    chapterWindow: { setCurrent() {} }, rebuildChapterImageIndexes() {},
    measurementPaginationKey: () => key, measuringDraft() { return this.draft; }, setMeasuringDraft(v) { this.draft = v; },
    setMeasuringRequestedAnchor(v) { this.request = v; }, measuringRequestedAnchor() { return this.request; },
    setMeasuringOffset(v) { this.offset = v; }, setMeasuringProgress() {},
    isMeasurementChapterFirstPageStart: start => residentStart === 0 && start === ranges[0].startScalar,
    measurementIncludesChapterTitle() { return this.isMeasurementChapterFirstPageStart(this.request); },
    measureNativeTextBatch() {}, measureNativeChapterTitle() {}, hasValidUnicodeProbe: () => true,
    captureChapterTitleMeasurementAfterLayout() { this.measuredChapterTitleHeightVp = titleHeight || 0.001; this.measuredNativeTitle = { text: '章' }; return true; },
    readingImageForParagraph: () => undefined, toLineMetric: m => m,
    measurementNodeText: p => p.text,
    presentationLineText: t => t.replace(/\r?\n$/, ''),
    armMeasurementDeadline() {}, cancelMeasurementDeadline() {}, armFirstPageCompletionDeadline() {},
    continueCanonicalModeMeasurement: () => false, traceInitialReadingPhase() {},
    prepareNextMeasurementBatch: () => false,
    completeFirstPage(page) { this.result = page; this.phase = 'ready'; },
    lastMeasurableScalar: () => map.residentEnd() - 1,
    lastVisibleScalar: () => map.scalarCount() - 1,
    resetMeasurementPaginationDraft() { this.draft = undefined; },
    samePaginationKey: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    fail(e) { throw e; }, recoverPreviousChapterMeasurement(e) { throw e; },
    expandMeasurementParagraphWindow(direction) { this.expansion = direction; },
    nativeTextMeasurement: { clear() {}, take: c => c, measure(_context, value, controller) {
      o.measured.push(value); const p = paragraphs.find(p => p.text === value); assert.ok(p, 'only original paragraphs shaped');
      controller.manager = metricManager(p.lines);
    } },
    nativeParagraphResources: { set(key, window, map) { o.resources.push({ key, window, map }); } },
  });
  return o;
}

{
  const o = create([{ text: '远前文', lines: [[3, 90]] }, { text: '甲乙丙丁', lines: [[1, 9], [1, 9], [1, 9], [1, 9]] },
    { text: '后文', lines: [[1, 9], [1, 9]] }], 8);
  o.draft = new ReadingPaginationPrefix(o.key, { requestScalar: 8, startScalar: 8, endScalarExclusive: 11 });
  o.beginReversePageMeasurement(1, 4);
  assert.deepEqual(o.measured, ['甲乙丙丁'], 'deep previous page never shapes unrelated chapter prefix');
  assert.equal(o.result.startScalar, 6); assert.equal(o.result.endScalar, 8);
  assert.equal(o.result.fragments.map(f => f.text).join(''), '丙丁');
  assert.equal(o.draft.nextRequestForPageStart(6), 8);
  assert.equal(o.draft.isCanonicalPrefixForChapterStart(0), false);
  assert.deepEqual(o.resources[0].window.args.slice(-2), [2, 3]);
  assert.equal(o.result.contentHeight, 18);
}
{
  const o = create([{ text: '头', lines: [[1, 9]] }, { text: 'é😀אב', lines: [[2, 8, 2], [2, 11], [2, 7]] }], 8, { capacity: 23, currentChapter: 3, targetChapter: 2 });
  o.beginReversePageMeasurement(1, 4);
  assert.deepEqual(o.measured, ['é😀אב'], 'cross-chapter page begins at actual chapter tail');
  assert.equal(o.result.fragments.map(f => f.text).join(''), '😀אב');
  assert.equal(o.result.endScalar, o.map.scalarCount());
  assert.equal(o.result.contentHeight, 18, 'actual nonuniform native line heights determine fit');
}
{
  const o = create([{ text: '一', lines: [[1, 10]] }, { text: '二', lines: [[1, 10]] }, { text: '三', lines: [[1, 10]] }], 5,
    { capacity: 25, gap: 7, currentChapter: 3, targetChapter: 2 });
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.result.fragments.map(f => f.text).join(''), '三', 'paragraph gap participates in reverse admission');
  assert.deepEqual(o.measured, ['三', '二']);
}
{
  const o = create([{ text: '一二三', lines: [[1, 10], [1, 10], [1, 10]] }], 3,
    { capacity: 32, titleHeight: 15, currentChapter: 3, targetChapter: 2 });
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.result.fragments.map(f => f.text).join(''), '二三', 'chapter title is admitted only with its first real line');
  assert.equal(o.result.fragments[0].nativeTitle, undefined);
}
{
  const o = create([{ text: '一二', lines: [[1, 10], [1, 10]] }], 2,
    { capacity: 40, titleHeight: 15, currentChapter: 3, targetChapter: 2 });
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.result.fragments[0].nativeTitle.text, '章');
  assert.equal(o.result.bodyCapacity, 25, 'head page reserves the actual title geometry');
}
{
  const o = create([{ text: '一二三四五六', lines: [[1, 5], [1, 5], [1, 5], [1, 5], [1, 5], [1, 5]] }], 12,
    { residentStart: 10, total: 30, capacity: 25 });
  o.previousChapterMeasurement = undefined;
  o.draft = new ReadingPaginationPrefix(o.key, { requestScalar: 10, startScalar: 10, endScalarExclusive: 12 });
  o.draft.admit({ requestScalar: 12, startScalar: 12, endScalarExclusive: 16 });
  o.setMeasuringRequestedAnchor(10); o.resetPendingPage();
  o.paginationIndex.beginMeasurement(4);
  o.measurementBatch = [new MeasurementParagraph('known', 0, o.chapter.content, 10,
    new ReadingSurfaceLayoutMap(o.chapter.content), new Controller(), true, 10)];
  o.consumeMeasuredBatch(o.currentMeasurementGeneration(), 4, 1);
  assert.equal(o.result.endScalar, 12, 'forward rematerialization cannot fill past an observed reverse-page seam');
  assert.equal(o.result.fragments.map(f => f.text).join(''), '一二');
  assert.equal(o.draft.nextRequestForPageStart(10), 12, 'next returns the original observed successor');
  assert.equal(o.expansion, undefined, 'known page does not wait for unneeded suffix');
}
{
  const o = create([{ text: '前', lines: [[1, 10]] }, { text: '\uFFFC', lines: [] }, { text: '后', lines: [[1, 10]] }], 4,
    { capacity: 30 });
  o.readingImageForParagraph = p => p.text === '\uFFFC' ? { state: 'ready', startScalar: 2, endScalar: 3,
    intrinsicWidth: 100, intrinsicHeight: 25, pixelMap: 'image', fileUri: 'local-image' } : undefined;
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.result.fragments.length, 1);
  assert.equal(o.result.fragments[0].imageSource, 'image');
  assert.equal(o.result.startScalar, 2); assert.equal(o.result.endScalar, 4, 'blank separator remains in the exact request seam');
  assert.equal(o.result.contentHeight, 25);
}
{
  const o = create([{ text: '一二', lines: [[1, 10], [1, 10]] }], 20,
    { residentStart: 10, total: 20, capacity: 25 });
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.expansion, 'after'); assert.equal(o.result, undefined, 'a resident end cannot impersonate chapter EOF');
}
{
  const o = create([{ text: '一二', lines: [[1, 10], [1, 10]] }], 11, { residentStart: 10, total: 20, capacity: 25 });
  o.beginReversePageMeasurement(1, 4);
  assert.equal(o.expansion, 'before'); assert.equal(o.result, undefined, 'partial window start cannot impersonate chapter head');
}
{
  const o = create([{ text: '一二三', lines: [[1, 10], [1, 10], [1, 10]] }], 2);
  o.paginationIndex.beginMeasurement(4); const generation = o.currentMeasurementGeneration();
  o.paginationIndex.invalidateMeasurement();
  o.consumeReversePageParagraph(generation, 4, 1);
  assert.deepEqual(o.measured, []); assert.equal(o.result, undefined, 'stale measurement cannot shape/publish');
}
{
  const o = create(Array.from({ length: 30 }, (_, i) => ({ text: `原段${i}😀`, lines: [[6, 10]] })), 100,
    { residentStart: 100, total: 1000 });
  const page = { startScalar: o.ranges[14].startScalar, endScalar: o.ranges[15].endScalar };
  o.retainMeasuredParagraphWindow(page);
  assert.equal(o.chapter.documentRange.startScalar, o.ranges[13].startScalar);
  assert.equal(o.chapter.documentRange.endScalar, o.ranges[16].endScalar);
  assert.equal(o.chapter.documentRange.totalScalars, 1000);
  assert.equal(o.paragraphRanges.length, 4, 'long navigation retains the current page and original paragraph neighbours');
  for (const range of o.paragraphRanges) {
    assert.equal(o.chapter.content.substring(range.startUtf16, range.endUtf16), o.chapterLayoutMap.sliceByScalar(range.startScalar, range.endScalar));
  }
}
{
  const o = create([{ text: '一二', lines: [[1, 10], [1, 10]] }], 11, { residentStart: 10, total: 30 });
  o.previousChapterMeasurement = undefined;
  o.draft = new ReadingPaginationPrefix(o.key, { requestScalar: 10, startScalar: 10, endScalarExclusive: 20 });
  o.request = 10; o.paginationIndex.beginMeasurement(4);
  o.pendingPageFragments = [{ text: '一二' }]; o.pendingPageStartScalar = 10; o.pendingPageEndScalar = 12;
  o.beginFirstPageCommit(o.currentMeasurementGeneration(), 4, 1);
  assert.equal(o.expansion, 'after'); assert.equal(o.result, undefined, 'known end outside resident data fetches context instead of shortening the page');
}
{
  const Nav = productionMotionMethods(source, ['turnPreviousPage', 'turnNextPage', 'knownPageTurnBoundary'], {});
  const key = { sourceId: 's', bookId: 'b', chapterIndex: 0, layoutSignature: 'layout', contentVersion: 'body' };
  const index = new ReadingPaginationIndex();
  index.recordChapter({ key, contentScalarLength: 500, pageStartScalars: [0, 100, 200, 300, 400] });
  const map = new ReadingSurfaceLayoutMap('文'.repeat(500));
  const o = Object.assign(new Nav(), { chapter: { chapterIndex: 0, content: '文'.repeat(500) },
    visiblePage: { startScalar: 50, endScalar: 150 }, paginationIndex: index, paragraphRanges: [{ startScalar: 0 }],
    currentPaginationKey: () => key, requireChapterLayoutMap: () => map, canTurnPage: () => true,
    adjacentChapterIndex: () => undefined, isUnknownCatalogEdge: () => false, lastVisibleScalar: () => 499,
    startCurrentChapterPredecessorMeasurement(_chapter, offset) { this.reverseFrom = offset; return true; },
    measureCommittedPageAt(offset) { this.target = offset; } });
  assert.equal(o.knownPageTurnBoundary('previous'), undefined, 'containing canonical page zero is not proof that a restored local page is chapter head');
  assert.equal(o.turnPreviousPage().kind, 'started'); assert.equal(o.reverseFrom, 50);
  o.paginationDraft = new ReadingPaginationPrefix(key, { requestScalar: 52, startScalar: 50, endScalarExclusive: 150 });
  assert.ok(o.paginationDraft.admit({ requestScalar: 10, startScalar: 10, endScalarExclusive: 50 }));
  o.turnPreviousPage(); assert.equal(o.target, 10, 'local exact predecessor wins over containing canonical manifest');
  o.visiblePage = { startScalar: 10, endScalar: 50 }; o.turnNextPage();
  assert.equal(o.target, 52, 'previous then next reuses the original request, even when shaping started before it');
  o.visiblePage = { startScalar: 0, endScalar: 50 }; o.paginationDraft = undefined;
  o.adjacentChapterIndex = () => 9;
  o.turnToPreviousChapter = chapter => { o.previousChapter = chapter; return true; };
  o.turnPreviousPage();
  assert.equal(o.previousChapter, 9, 'actual chapter head crosses to previous EOF even without canonical page facts');
}

// Native node allocation is the platform boundary; measure/clear/take below
// execute the complete production owner with its actual node/controller lists.
const ownershipSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextMeasurement.ets', import.meta.url), 'utf8');
const ownershipClass = stripTypeScriptTypes(ownershipSource.replace(/^import.*$/gm, '').replace(/^export /gm, ''));
function nativeOwnershipFixture(paragraphs, endScalar, options = {}) {
  const o = create(paragraphs, endScalar, options);
  delete o.measureNativeTextBatch;
  delete o.measureNativeChapterTitle;
  delete o.captureChapterTitleMeasurementAfterLayout;
  o.unicodeProbeVerified = true;
  const capacity = options.capacity ?? 25, titleHeight = options.titleHeight ?? 15;
  o.readingLayout = () => ({ bodyHeightAfterTitle: h => capacity - h, titleLineHeightFp: titleHeight });
  const nodes = [];
  const typeNode = { createNode() {
    const node = { ownershipFixture: true, disposed: false, measured: false,
      initialize(value, { controller }) { this.text = value; this.controller = controller; },
      measure() {
        assert.equal(this.disposed, false);
        const receipt = this.text === o.chapter.chapterTitle ? [[this.text.length, titleHeight]] :
          paragraphs.find(paragraph => paragraph.text === this.text)?.lines;
        assert.ok(receipt, 'native receipt must be supplied for the exact original text');
        this.controller.manager = metricManager(receipt);
        this.measured = true;
      },
      layout() { assert.equal(this.measured, true); },
      dispose() { this.disposed = true; },
    };
    node.attribute = Object.fromEntries(['width', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing',
      'fontColor', 'textAlign', 'wordBreak', 'textIndent', 'direction', 'lineSpacing']
      .map(name => [name, () => node.attribute]));
    nodes.push(node);
    return node;
  } };
  const NativeMeasurement = new Function('typeNode', 'LengthMetrics', 'WordBreak',
    `${ownershipClass}; return ReaderNativeTextMeasurement;`)(typeNode, { vp: value => value }, { BREAK_ALL: 'all' });
  o.nativeTextMeasurement = new NativeMeasurement();
  return { o, nodes };
}

for (const firstLineFits of [true, false]) {
  const paragraphs = [{ text: firstLineFits ? '一二' : '一二三',
    lines: firstLineFits ? [[1, 10], [1, 10]] : [[1, 10], [1, 10], [1, 10]] }];
  const f = nativeOwnershipFixture(paragraphs, paragraphs[0].text.length, {
    capacity: firstLineFits ? 40 : 32, titleHeight: 15, currentChapter: 3, targetChapter: 2,
  });
  f.o.beginReversePageMeasurement(1, 4);
  const bodyNodes = f.nodes.filter(node => node.text === paragraphs[0].text);
  const titleNodes = f.nodes.filter(node => node.text === '章');
  assert.equal(bodyNodes.length, 1, 'title capacity cannot recreate the body paragraph');
  assert.equal(titleNodes.length, 1);
  assert.equal(bodyNodes[0].disposed, false, 'the body survives title measurement and transfers exactly once');
  const bodyResource = f.o.resources.find(resource => resource.window.args[1] === bodyNodes[0]);
  assert.ok(bodyResource, 'the displayed native window owns the original measured body node');
  assert.throws(() => f.o.nativeTextMeasurement.take(bodyNodes[0].controller), /NATIVE_TEXT_OWNERSHIP_MISSING/,
    'the adapter no longer owns the transferred node');
  f.o.nativeTextMeasurement.clear();
  assert.equal(bodyNodes[0].disposed, false, 'clearing untaken measurement nodes cannot dispose the display-owned body');
  assert.equal(f.o.result.fragments.map(fragment => fragment.text).join(''), firstLineFits ? '一二' : '二三');
  assert.equal(f.o.result.fragments[0].nativeTitle?.text, firstLineFits ? '章' : undefined);
}

{
  const paragraphs = [{ text: '一二', lines: [[1, 10], [1, 10]] }];
  const f = nativeOwnershipFixture(paragraphs, 2, { capacity: 40, titleHeight: 15, currentChapter: 3, targetChapter: 2 });
  f.o.beginReversePageMeasurement(1, 4);
  const title = f.o.measuredNativeTitle;
  const paragraph = new MeasurementParagraph('repeat', 0, '一二', 0,
    new ReadingSurfaceLayoutMap('一二'), new Controller(), true, 0);
  f.o.measurementBatch = [paragraph];
  f.o.measureNativeParagraph(paragraph);
  const bodyNode = f.nodes.at(-1), nodeCount = f.nodes.length;
  assert.equal(f.o.reversePageCapacityAt(0), 25);
  assert.equal(f.o.measuredNativeTitle, title);
  assert.equal(f.nodes.length, nodeCount, 'an already retained title does not allocate another native node');
  assert.equal(bodyNode.disposed, false, 'reusing a measured title does not clear a new body node');
  assert.equal(f.o.nativeTextMeasurement.take(paragraph.controller), bodyNode);
}

// Restore only the old production call to prove this fixture detects the
// disposal bug. The actual adapter is unchanged, so take must reject the body
// controller removed by measureNativeTextBatch.clear().
{
  const reverse = text.match(/  private reversePageCapacityAt\([\s\S]*?\n  \}/)?.[0];
  assert.ok(reverse?.includes('this.measureNativeChapterTitle();'));
  const oldCall = reverse.replace('this.measureNativeChapterTitle();', 'this.measureNativeTextBatch();');
  const directory = mkdtempSync(join(tmpdir(), 'reader-reverse-title-owner-'));
  try {
    const mutant = join(directory, 'LocalReadingExperience.ets');
    writeFileSync(mutant, text.replace(reverse, oldCall));
    const OldOwner = productionMotionMethods(mutant, methods, ownerDependencies);
    const f = nativeOwnershipFixture([{ text: '一二', lines: [[1, 10], [1, 10]] }], 2, {
      capacity: 40, titleHeight: 15, currentChapter: 3, targetChapter: 2, ownerClass: OldOwner,
    });
    assert.throws(() => f.o.beginReversePageMeasurement(1, 4), /NATIVE_TEXT_OWNERSHIP_MISSING/);
    assert.equal(f.nodes.find(node => node.text === '一二').disposed, true,
      'the negative control exposes the body disposal caused by the old batch call');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
console.log('PASS reverse title ownership: real native measurement clear/take, head fit/reject, retained title and old-call negative control');
console.log('PASS production reverse page: deep/tail bounded native metrics, Unicode, title/gaps, exact adjacency, partial edges and cancellation');

// The regression requires the combined lifecycle: a measured current page is
// retained, restored into a new reader, then both neighbours are prepared.
// Use the real retain/restore/queue and page assembly methods; only native line
// receipts and unrelated platform services are supplied by the fixture.
const ReaderMaterializedChapterContext = declaration('ReaderMaterializedChapterContext', '/** Confirmed, text-only');
const ReaderRetainedPresentation = declaration('ReaderRetainedPresentation', 'const readingEntryHandoffs');
const scheduled = [];
let activeHandoff;
const runtime = { optionalReadingEntryMemoryEnabled: () => true,
  readingEntryPreparations: () => ({ captureValidity: () => () => true, setPaused() {} }) };
const HandoffOwner = productionMotionMethods(source, [...methods, 'retainConfirmedEntryPresentation',
  'restoreRetainedReadingPresentation', 'captureMaterializedChapterContext', 'restoreMaterializedChapterContext',
  'copyParagraphRanges', 'currentPaginationKey', 'samePaginationKey', 'schedulePageTurnPreparation'], {
  ...ownerDependencies, ReaderMaterializedChapterContext, ReaderRetainedPresentation, estimateRetainedRemoteSessionBytes,
  ReaderRuntimeOwner: { current: () => runtime }, ReaderWindowCoordinator: { metrics: () => ({ densityPixels: 3 }) },
  readingEntryHandoff: () => activeHandoff, readerPageTransitionUsesPreparedPages: () => true,
  setTimeout: callback => { scheduled.push(callback); return scheduled.length; },
});
function handoffReader(paragraphs, residentStart, total, direction) {
  const o = create(paragraphs, residentStart + 9, { residentStart, total, ownerClass: HandoffOwner });
  o.previousChapterMeasurement = undefined;
  Object.assign(o, {
    sourceId: 's', bookId: 'b', materializedContentVersion: 'body', chapterSelectionToken: 4,
    hasMeasuredViewport: () => true, readerSettingsLoaded: true,
    paginationLayoutSignature: () => 'layout', requireChapter() { return this.chapter; },
    requireChapterLayoutMap() { return this.chapterLayoutMap; }, retainCurrentChapterWindow() {},
    sessionGateway: { hasPendingSourceSwitch: () => false, remoteSession: () => undefined },
    tocEntries: [{ index: 2, title: '章' }], pageTurnGeneration: 0, pageTurnRenderRevision: 0,
    preferredPageTextureDirection: direction,
    isSelectionActive(life, selection) { return life === 1 && selection === this.chapterSelectionToken; },
    admitTocEntries(entries) { this.tocEntries = entries; }, readingTocEntries() { return this.tocEntries; },
    chapterWindow: { configure() {}, setCurrent() {} },
    publishMeasuredFirstPage(page) { this.visiblePage = page; this.visibleFragments = page.fragments; },
    admitCommittedProgress(progress) { this.lastCommittedProgress = progress; this.progressAdmissions = (this.progressAdmissions ?? 0) + 1; },
    configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {}, beginReadingRecordClock() {},
    onDirectoryProjectionChanged() {}, notifyControlSelectionReadingReady() {},
    measuringDraft() { return this.paginationDraft; }, setMeasuringDraft(value) { this.paginationDraft = value; },
    resetMeasurementPaginationDraft() { this.paginationDraft = undefined; this.measurementRequestedAnchorScalar = -1; },
    setMeasuringRequestedAnchor(value) { this.measurementRequestedAnchorScalar = value; },
    measuringRequestedAnchor() { return this.measurementRequestedAnchorScalar; },
    measurementIncludesChapterTitle() { return this.isMeasurementChapterFirstPageStart(this.measuringRequestedAnchor()); },
  });
  return o;
}
function forwardPage(o, requested) {
  const rangeIndex = o.paragraphRanges.findIndex(range => range.startScalar <= requested && range.endScalar > requested);
  const range = o.paragraphRanges[rangeIndex];
  const value = o.chapter.content.substring(range.startUtf16, range.endUtf16);
  o.previousChapterMeasurement = undefined;
  o.setMeasuringRequestedAnchor(requested); o.resetPendingPage(); o.batchProcessing = false;
  if (o.measurementIncludesChapterTitle()) o.captureChapterTitleMeasurementAfterLayout(1);
  o.paginationIndex.beginMeasurement(4);
  o.measurementBatch = [new MeasurementParagraph(range.id, rangeIndex, value, range.startScalar,
    new ReadingSurfaceLayoutMap(value), new Controller(), true, requested)];
  o.consumeMeasuredBatch(o.currentMeasurementGeneration(), 4, 1);
  assert.ok(o.result, 'actual forward page assembly publishes a physical page');
  return o.result;
}
for (const residentStart of [0, 100]) for (const direction of ['next', 'previous']) for (const withinLine of [0, 1]) for (const crlf of [false, true]) {
  const paragraphs = [{ text: crlf ? '远前文\r' : '远前文', lines: [[crlf ? 4 : 3, 90]] },
    { text: crlf ? '甲乙丙丁\r' : '甲乙丙丁', lines: [[1, 9], [1, 9], [1, 9], [crlf ? 2 : 1, 9]] },
    { text: '后文😀续文末文结尾', lines: [[2, 9], [3, 9], [2, 9], [2, 9], [1, 9]] }];
  const total = residentStart === 0 ? undefined : 500;
  const producer = handoffReader(paragraphs, residentStart, total, direction);
  const currentStart = producer.paragraphRanges[2].startScalar;
  const page = forwardPage(producer, currentStart + withinLine);
  assert.equal(page.startScalar, currentStart);
  assert.equal(page.paginationObservation.requestScalar, currentStart + withinLine);
  producer.visiblePage = page;
  producer.lastCommittedProgress = { sourceId: 's', bookId: 'b', chapterIndex: 2,
    chapterOffset: page.startScalar, chapterProgress: .4 };
  // Neighbour work before exit must not replace the current page's receipt.
  forwardPage(producer, page.endScalar);
  activeHandoff = new ReadingEntryHandoff();
  producer.retainConfirmedEntryPresentation();
  const snapshot = activeHandoff.current('s', 'b');
  assert.ok(snapshot);
  assert.deepEqual(snapshot.context.paginationDraft.pageStartScalars(), [page.startScalar], 'handoff retains exactly one observation');
  assert.equal(snapshot.context.measurementRequestedAnchorScalar, currentStart + withinLine, 'request is never inferred from rendered start');
  const consumer = handoffReader(paragraphs, residentStart, total, direction);
  consumer.phase = 'loading'; consumer.entryPresentationProvider = () => snapshot;
  let prepared = 0;
  consumer.drainPageTurnPreparationQueue = () => {
    while (consumer.pageTurnPreparationQueue.length > 0) {
      const next = consumer.pageTurnPreparationQueue.shift();
      if (next === 'next') forwardPage(consumer, page.endScalar);
      else {
        consumer.previousChapterMeasurement = new PreviousChapterMeasurement(2, page.startScalar, 2);
        consumer.beginReversePageMeasurement(1, 4);
        assert.equal(consumer.result.endScalar, page.startScalar);
      }
      prepared++;
    }
  };
  assert.equal(consumer.restoreRetainedReadingPresentation(1), true);
  assert.equal(consumer.visiblePage, page, 'body is already submitted before background preparation runs');
  assert.equal(prepared, 0);
  scheduled.shift()();
  assert.equal(prepared, 2);
  const previousRequest = consumer.paginationDraft.previousRequestForPageStart(page.startScalar);
  assert.equal(consumer.paginationDraft.nextRequestForPageStart(previousRequest), currentStart + withinLine,
    'previous then next returns the exact original request, including an anchor inside a shaped line');
  assert.deepEqual(snapshot.context.paginationDraft.pageStartScalars(), [page.startScalar], 'restored neighbour work cannot grow the retained snapshot');
  assert.deepEqual(page.paginationObservation, { requestScalar: currentStart + withinLine,
    startScalar: page.startScalar, endScalarExclusive: page.endScalar });
  assert.equal(consumer.lastCommittedProgress, producer.lastCommittedProgress);
  assert.equal(consumer.progressAdmissions, 1, 'speculative neighbours do not change committed progress');
  assert.equal(consumer.visiblePage, page, 'speculative neighbours cannot replace the visible page');
}
// Completing the canonical chapter drops the run. Its last real page must
// still retain an exact request receipt rather than falling back to guessing.
{
  const o = handoffReader([{ text: '一二', lines: [[1, 9], [1, 9]] }], 0, undefined, 'next');
  const page = forwardPage(o, 0);
  assert.equal(o.paginationDraft, undefined);
  assert.deepEqual(page.paginationObservation, { requestScalar: 0, startScalar: 0, endScalarExclusive: 2 });
  o.visiblePage = page; o.lastCommittedProgress = { chapterIndex: 2, chapterOffset: 0, chapterProgress: 0 };
  activeHandoff = new ReadingEntryHandoff(); o.retainConfirmedEntryPresentation();
  const snapshot = activeHandoff.current('s', 'b');
  assert.deepEqual(snapshot.context.paginationDraft.pageStartScalars(), [0]);
  const consumer = handoffReader([{ text: '一二', lines: [[1, 9], [1, 9]] }], 0, undefined, 'next');
  consumer.phase = 'loading'; consumer.entryPresentationProvider = () => snapshot;
  consumer.drainPageTurnPreparationQueue = () => assert.fail('cancelled queue must not prepare a page');
  assert.equal(consumer.restoreRetainedReadingPresentation(1), true);
  consumer.pageTurnGeneration++;
  scheduled.shift()();
  assert.equal(consumer.visiblePage, page);
}
console.log('PASS retained page integration: real measurement/retain/restore/queued neighbours, both orders, partial windows, CRLF/Emoji and mid-line request, canonical completion, cancellation, constant-size ownership and unchanged progress');
