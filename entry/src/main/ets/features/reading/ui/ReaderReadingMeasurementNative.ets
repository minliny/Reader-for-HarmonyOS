import type { UIContext } from '@ohos.arkui.UIContext';
import { i18n } from '@kit.LocalizationKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerHarmonyCapabilities } from '../../../app/HarmonyCapabilityProbe';
import { readerRegisteredFontFamily } from '../../../ui/foundation/ReaderFonts';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { ParagraphRange, type MeasuredReadingLine } from '../application/ReadingMeasurementFacts';
import { collectForwardMeasuredLines, collectReverseMeasuredLines } from '../application/ReadingMeasuredLineTraversal';
import { ReadingSurfaceLayoutMap, type ReadingSurfaceLineMetric } from '../application/ReadingSurfaceLayoutMap';
import { READER_MEASUREMENT_UNICODE_PROBE, ReaderMeasurementRun,
  type ReaderTitleMeasurement, type ReaderUnicodeMeasurement } from '../application/ReaderMeasurementRun';
import { readerAppearanceLineHeight, readerAppearanceParagraphIndent, readerAppearanceSnapshotFontFamily,
  readerAppearanceThemeStyle, readerAppearanceUsesJustify } from './ReaderAppearanceRenderStyle';
import { ArkUILineMetric } from './ReaderArkUILineMetric';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReaderNativeParagraphResources, type ReaderNativeParagraphRecipe, readerNativeParagraphKey } from './ReaderNativeParagraph';
import { ReaderNativeTextMeasurement, READER_CHAPTER_TITLE_FONT_SIZE_FP, type ReaderNativeTextStyle } from './ReaderNativeTextMeasurement';
import { ReaderNativeTextWindow, readerNativeParagraphHeight } from './ReaderNativeTextWindow';
import { MeasurementParagraph } from './ReadingMeasurementModels';
import { admitForwardMeasuredLines, advanceMeasuredReadingBatch, selectReverseMeasuredLines,
  type ReaderMeasuredBatchResult, type ReaderMeasuredParagraphResult } from './ReaderMeasuredPagePipeline';
import { ReaderParagraphLayoutOwner } from './ReaderParagraphLayoutOwner';
import type { ReaderPhysicalPaginationOwner } from './ReaderPhysicalPaginationOwner';
import { ReadingSurfacePageFragment } from './ReadingSurface';

// These limits bound allocation. One original paragraph stays whole so native
// shaping retains its bidi and grapheme context across an interior anchor.
const MAX_MEASUREMENT_BATCH_PARAGRAPHS = 8;
const MAX_MEASUREMENT_BATCH_UTF16 = 12 * 1024;

export class ReaderReadingMeasurementSurface {
  readonly context: () => UIContext;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly layout: () => ReaderReadingLayoutSnapshot;

  constructor(context: () => UIContext, appearance: () => ReaderAppearanceSnapshot, layout: () => ReaderReadingLayoutSnapshot) {
    this.context = context;
    this.appearance = appearance;
    this.layout = layout;
  }
}

export class ReaderForwardParagraphMeasurement {
  readonly knownEnd: number | undefined;
  readonly chapterIndex: () => number;
  readonly bodyCapacity: () => number;
  readonly enumeratePredecessor: () => boolean;
  readonly continuous: () => boolean;

  constructor(knownEnd: number | undefined, chapterIndex: () => number, bodyCapacity: () => number,
    enumeratePredecessor: () => boolean, continuous: () => boolean) {
    this.knownEnd = knownEnd;
    this.chapterIndex = chapterIndex;
    this.bodyCapacity = bodyCapacity;
    this.enumeratePredecessor = enumeratePredecessor;
    this.continuous = continuous;
  }
}

export class ReaderReverseParagraphMeasurement {
  readonly chapterIndex: number;
  readonly endScalar: number;
  readonly capacityAt: (start: number) => number;

  constructor(chapterIndex: number, endScalar: number, capacityAt: (start: number) => number) {
    this.chapterIndex = chapterIndex;
    this.endScalar = endScalar;
    this.capacityAt = capacityAt;
  }
}

function nativeBodyPunctuationOverflow(): boolean {
  if (!readerHarmonyCapabilities().api26) return false;
  try {
    const preferred = i18n.System.getAppPreferredLanguage();
    const language = preferred.length === 0 || preferred === 'default' ? i18n.System.getSystemLanguage() : preferred;
    const locale = new Intl.Locale(language).maximize();
    return locale.language === 'zh' && locale.script === 'Hans';
  } catch (_) {
    return false;
  }
}

/** Owns bounded native text nodes until the accepted paragraph or title takes
 * the exact node and controller for rendering. Clearing a trial allocation
 * must not dispose a resource already transferred to the visible page. */
export class ReaderReadingMeasurementNative {
  readonly punctuationOverflow: boolean = nativeBodyPunctuationOverflow();
  private readonly unicodeProbe: TextController = new TextController();
  private titleController: TextController = new TextController();
  private titleRecipe: ReaderNativeParagraphRecipe | undefined = undefined;
  private measuredTitleHeight: number = 0;
  private readonly nodes: ReaderNativeTextMeasurement = new ReaderNativeTextMeasurement();
  private readonly paragraphs: ReaderParagraphLayoutOwner<ParagraphRange, MeasurementParagraph> =
    new ReaderParagraphLayoutOwner<ParagraphRange, MeasurementParagraph>();
  private readonly surface: ReaderReadingMeasurementSurface;
  private readonly resources: ReaderNativeParagraphResources;
  private readonly run: ReaderMeasurementRun;

  constructor(surface: ReaderReadingMeasurementSurface, resources: ReaderNativeParagraphResources, run: ReaderMeasurementRun) {
    this.surface = surface;
    this.resources = resources;
    this.run = run;
  }

  clear(): void { this.nodes.clear(); }

  get chapterRanges(): ParagraphRange[] { return this.paragraphs.ranges; }
  set chapterRanges(ranges: ParagraphRange[]) { this.paragraphs.ranges = ranges; }

  get hasBatch(): boolean { return this.paragraphs.batch.length > 0; }
  get firstParagraph(): MeasurementParagraph | undefined { return this.paragraphs.batch[0]; }

  clearBatch(): void { this.paragraphs.batch.length = 0; }

  retainBatchSuffix(index: number): void {
    if (index > 0) this.paragraphs.batch.splice(0, index);
  }

  resetBatchCursor(): void {
    this.paragraphs.nextRangeIndex = 0;
    this.paragraphs.firstRangeStartScalar = 0;
  }

  startForward(ranges: ParagraphRange[], offset: number): void {
    this.paragraphs.nextRangeIndex = this.paragraphs.rangeIndexForOffset(ranges, offset);
    this.paragraphs.firstRangeStartScalar = offset;
  }

  previousRangeIndex(ranges: ParagraphRange[], endScalar: number): number {
    return this.paragraphs.previousRangeIndex(ranges, endScalar);
  }

  prepareForward(content: string, ranges: ParagraphRange[]): boolean {
    return this.paragraphs.prepareBatch(content, ranges, MAX_MEASUREMENT_BATCH_PARAGRAPHS, MAX_MEASUREMENT_BATCH_UTF16,
      (): void => this.clear(),
      (range: ParagraphRange, index: number, text: string, requestedStart: number): MeasurementParagraph =>
        new MeasurementParagraph(`${range.id}:${requestedStart}`, index, text, range.startScalar,
          new ReadingSurfaceLayoutMap(text), new TextController(), true, requestedStart));
  }

  preparePrevious(content: string, ranges: ParagraphRange[], index: number): number | undefined {
    return this.paragraphs.preparePrevious(content, ranges, index, (): void => this.clear(),
      (range: ParagraphRange, rangeIndex: number, text: string, requested: number): MeasurementParagraph =>
        new MeasurementParagraph(range.id, rangeIndex, text, range.startScalar,
          new ReadingSurfaceLayoutMap(text), new TextController(), true, requested));
  }

  advanceBatch(page: ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment>,
    knownEnd: () => number | undefined,
    consume: (paragraph: MeasurementParagraph, index: number, end: number | undefined) => ReaderMeasuredParagraphResult,
    prepareNext: () => boolean): ReaderMeasuredBatchResult {
    return advanceMeasuredReadingBatch(this.paragraphs.batch, page, {
      paragraphStart: (paragraph: MeasurementParagraph): number => paragraph.chapterStartScalar,
      knownEnd,
      consumeParagraph: consume,
      releaseMeasurement: (): void => this.clear(),
      prepareNextBatch: prepareNext,
    });
  }

  resetTitle(): void {
    this.titleRecipe = undefined;
    this.titleController = new TextController();
    this.measuredTitleHeight = 0;
  }

  title(): ReaderNativeParagraphRecipe | undefined { return this.titleRecipe; }

  titleHeight(): number { return this.measuredTitleHeight; }

  beginBatch(titleRequired: () => boolean, title: () => string): void {
    this.clear();
    const style = this.bodyStyle();
    if (this.run.requiresUnicodeProbe()) {
      this.nodes.measure(this.surface.context(), READER_MEASUREMENT_UNICODE_PROBE, this.unicodeProbe, style);
    }
    this.measureTitle(titleRequired, title);
    // Shape the paragraph lazily when page admission reaches it.
    for (const paragraph of this.paragraphs.batch) paragraph.nativeMeasured = false;
  }

  readUnicode(): ReaderUnicodeMeasurement {
    const manager = this.unicodeProbe.getLayoutManager();
    return { count: manager.getLineCount(), readLine: (): ArkUILineMetric => this.lineMetric(manager.getLineMetrics(0)) };
  }

  measureTitle(required: () => boolean, title: () => string): void {
    if (!required() || this.titleRecipe !== undefined) return;
    this.nodes.measure(this.surface.context(), title(), this.titleController, this.titleStyle());
  }

  captureTitle(required: boolean, title: () => string,
    fail: (error: Error) => void): boolean {
    if (!required) {
      this.measuredTitleHeight = 0;
      this.run.clearTitle();
      return true;
    }
    if (this.titleRecipe !== undefined) return true;
    return this.run.captureTitle((): ReaderTitleMeasurement => {
      const manager = this.titleController.getLayoutManager();
      const count = manager.getLineCount();
      return { count, admit: (): void => this.admitTitle(manager, count, title) };
    }, fail);
  }

  private admitTitle(manager: LayoutManager, lineCount: number, title: () => string): void {
    const context = this.surface.context();
    const heightVp = context.px2vp(readerNativeParagraphHeight(manager, 0, lineCount - 1));
    if (!Number.isFinite(heightVp) || heightVp <= 0) throw new Error('PAGINATION_CHAPTER_TITLE_GEOMETRY_INVALID');
    const recipe: ReaderNativeParagraphRecipe = {
      key: readerNativeParagraphKey(), text: title(), startScalar: 0,
      firstLine: 0, lastLine: lineCount - 1, style: this.titleStyle(),
    };
    const window = new ReaderNativeTextWindow(context, this.nodes.take(this.titleController),
      this.titleController, context.vp2px(this.surface.layout().bodyWidth()), 0, lineCount - 1);
    this.resources.set(recipe.key, window);
    this.titleRecipe = recipe;
    this.measuredTitleHeight = heightVp;
  }

  private measureParagraph(paragraph: MeasurementParagraph): void {
    if (paragraph.nativeMeasured) return;
    this.nodes.measure(this.surface.context(), this.paragraphText(paragraph), paragraph.controller,
      this.bodyStyle(paragraph.isParagraphStart));
    // A transferred node is still a measured paragraph.
    paragraph.nativeMeasured = true;
  }

  private paragraphText(paragraph: MeasurementParagraph): string {
    // Host owns the intrinsic image height. The placeholder's text geometry
    // is never used for that image block.
    return paragraph.text === '\uFFFC' ? 'A' : paragraph.text;
  }

  private transferParagraph(paragraph: MeasurementParagraph, key: string, start: number, end?: number): void {
    const window = new ReaderNativeTextWindow(this.surface.context(), this.nodes.take(paragraph.controller),
      paragraph.controller, this.surface.context().vp2px(this.surface.layout().bodyWidth()), start, end);
    this.resources.set(key, window, paragraph.layoutMap);
  }

  private lineMetric(metric: LineMetrics): ArkUILineMetric {
    const context = this.surface.context();
    // Native text reports px, while the page's admitted capacity is in vp.
    return new ArkUILineMetric(metric, context.px2vp(metric.height), context.px2vp(metric.topHeight),
      context.px2vp(metric.width), context.px2vp(metric.baseline));
  }

  private titleStyle(): ReaderNativeTextStyle {
    return {
      widthVp: this.surface.layout().bodyWidth(),
      color: readerAppearanceThemeStyle(this.surface.appearance().activeTheme).ink,
      fontFamily: readerRegisteredFontFamily(this.surface.context().getFont(),
        readerAppearanceSnapshotFontFamily(this.surface.appearance())), fontWeight: FontWeight.Bold,
      fontSize: READER_CHAPTER_TITLE_FONT_SIZE_FP, lineHeight: this.surface.layout().titleLineHeightFp,
      letterSpacing: 0, alignment: TextAlign.Center, breakAll: true,
    };
  }

  private bodyStyle(paragraphStart?: boolean): ReaderNativeTextStyle {
    const style: ReaderNativeTextStyle = {
      widthVp: this.surface.layout().bodyWidth(), fontFamily: readerAppearanceSnapshotFontFamily(this.surface.appearance()),
      fontSize: this.surface.appearance().fontSize, fontWeight: FontWeight.Regular,
      lineHeight: readerAppearanceLineHeight(this.surface.appearance()), letterSpacing: this.surface.appearance().letterSpacing,
      color: readerAppearanceThemeStyle(this.surface.appearance().activeTheme).ink,
      alignment: readerAppearanceUsesJustify(this.surface.appearance().alignment) ? TextAlign.JUSTIFY : TextAlign.Start,
      breakAll: false, bookBody: true, punctuationOverflow: this.punctuationOverflow,
    };
    if (paragraphStart !== undefined) {
      style.indentVp = paragraphStart ? this.surface.context().px2vp(this.surface.context().fp2px(
        readerAppearanceParagraphIndent(this.surface.appearance().fontSize, this.surface.appearance().indent))) : 0;
    }
    return style;
  }

  packForward(paragraph: MeasurementParagraph, paragraphIndex: number,
    page: ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment>, host: ReaderForwardParagraphMeasurement): ReaderMeasuredParagraphResult {
    this.measureParagraph(paragraph);
    if (!this.run.paragraphHasLayout(paragraphIndex, (): number => paragraph.controller.getLayoutManager().getLineCount())) {
      return 'waiting';
    }
    const lines = this.measuredLines(paragraph, host.bodyCapacity, host.enumeratePredecessor);
    let nativeRecipe: ReaderNativeParagraphRecipe | undefined;
    let transferred: boolean = false;
    return admitForwardMeasuredLines(lines, page, {
      knownEnd: host.knownEnd,
      isParagraphStart: paragraph.isParagraphStart,
      capacity: (): number => host.bodyCapacity(),
      paragraphSpacing: (): number => this.surface.appearance().paragraphSpacing,
      spanHeight: (firstLine: number, lastLine: number): number => this.surface.context().px2vp(
        readerNativeParagraphHeight(paragraph.controller.getLayoutManager(), firstLine, lastLine)),
      appendLine: (line: MeasuredReadingLine, admittedLineHeight: number, isParagraphStart: boolean, firstNativeLine: boolean): void => {
        if (nativeRecipe === undefined) {
          nativeRecipe = { key: readerNativeParagraphKey(), text: paragraph.text,
            startScalar: paragraph.chapterStartScalar, firstLine: line.lineIndex, lastLine: line.lineIndex,
            style: this.bodyStyle(paragraph.isParagraphStart) };
          if (!transferred) {
            this.transferParagraph(paragraph, nativeRecipe.key,
              host.continuous() ? 0 : line.lineIndex,
              host.continuous() ? undefined : lines[lines.length - 1].lineIndex);
            transferred = true;
          }
        }
        nativeRecipe.lastLine = line.lineIndex;
        // ReadingSurface uses this id as its ArkUI ForEach identity. A
        // paragraph starts at zero in every chapter, so the local paragraph
        // id alone would let a new chapter reuse an old visible Text child.
        // Bind the fragment to the Core-returned chapter identity; this is
        // presentation identity only and never changes the scalar anchor.
        const fragment = new ReadingSurfacePageFragment(
          `chapter-${host.chapterIndex()}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
          this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)),
          isParagraphStart,
          line.startScalar,
          line.endScalar,
          undefined,
          0,
          undefined,
          admittedLineHeight,
        );
        fragment.nativeParagraph = nativeRecipe;
        fragment.nativeParagraphFirst = firstNativeLine;
        page.appendFragment(fragment, line.startScalar, line.endScalar,
          admittedLineHeight, isParagraphStart, this.surface.appearance().paragraphSpacing);
      },
    });
  }

  packReverse(paragraph: MeasurementParagraph, page: ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment>,
    host: ReaderReverseParagraphMeasurement): boolean {
    this.measureParagraph(paragraph);
    const lines = this.measuredReverseLines(paragraph, host.endScalar);
    const result = selectReverseMeasuredLines(lines, page,
      (firstLine: number, lastLine: number): number => this.surface.context().px2vp(
        readerNativeParagraphHeight(paragraph.controller.getLayoutManager(), firstLine, lastLine)),
      (startScalar: number): number => host.capacityAt(startScalar),
      (): number => this.surface.appearance().paragraphSpacing);
    const selected = result.lines;
    const height = result.height;
    if (selected.length > 0) {
      const recipe: ReaderNativeParagraphRecipe = {
        key: readerNativeParagraphKey(), text: paragraph.text, startScalar: paragraph.chapterStartScalar,
        firstLine: selected[0].lineIndex, lastLine: selected[selected.length - 1].lineIndex,
        style: this.bodyStyle(true),
      };
      const fragments: ReadingSurfacePageFragment[] = [];
      let previousHeight = 0;
      for (const line of selected) {
        const currentHeight = this.surface.context().px2vp(readerNativeParagraphHeight(
          paragraph.controller.getLayoutManager(), recipe.firstLine, line.lineIndex));
        const fragment = new ReadingSurfacePageFragment(
          `chapter-${host.chapterIndex}:${paragraph.id}:${line.startScalar}-${line.endScalar}`,
          this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)), line.lineIndex === 0,
          line.startScalar, line.endScalar, undefined, 0, undefined, currentHeight - previousHeight);
        fragment.nativeParagraph = recipe; fragment.nativeParagraphFirst = fragments.length === 0;
        fragments.push(fragment); previousHeight = currentHeight;
      }
      this.transferParagraph(paragraph, recipe.key, recipe.firstLine, recipe.lastLine);
      page.prependFragments(fragments, selected[0].startScalar,
        height, this.surface.appearance().paragraphSpacing);
    }
    return result.full;
  }

  private measuredLines(paragraph: MeasurementParagraph, bodyCapacity: () => number,
    enumeratePredecessor: () => boolean): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const lineCount = manager.getLineCount();
    if (lineCount <= 0) {
      throw new Error('PAGINATION_MEASUREMENT_PENDING');
    }
    const measurementText = this.paragraphText(paragraph);
    const measurementMap = measurementText === paragraph.text ? paragraph.layoutMap :
      new ReadingSurfaceLayoutMap(measurementText);
    const requestedLocal = Math.max(0, (paragraph.requestedStartScalar ?? paragraph.chapterStartScalar) - paragraph.chapterStartScalar);
    const requestedUtf16 = measurementMap.utf16ForScalar(requestedLocal);
    return collectForwardMeasuredLines(measurementMap, paragraph.chapterStartScalar, lineCount, requestedUtf16, {
      lineEndUtf16: (index: number): number => manager.getLineMetrics(index).endIndex,
      readLine: (index: number): ArkUILineMetric => this.lineMetric(manager.getLineMetrics(index)),
      // The predecessor's background catalog pass deliberately enumerates all pages.
      exceedsCapacity: (first: number, last: number): boolean => !enumeratePredecessor() &&
        this.surface.context().px2vp(readerNativeParagraphHeight(manager, first, last)) > bodyCapacity(),
      reportOverlap: (index: number, metric: ReadingSurfaceLineMetric, previousEnd: number): void => {
        hilog.error(0x5244, 'Reader',
          'Pagination overlap line=%{public}d start=%{public}d end=%{public}d previousEnd=%{public}d',
          index, metric.startIndex, metric.endIndex, previousEnd);
      },
      reportEmpty: (firstLine: number): void => {
        const last = manager.getLineMetrics(lineCount - 1);
        hilog.error(0x5244, 'Reader',
          'Pagination empty lines=%{public}d first=%{public}d request=%{public}d length=%{public}d lastStart=%{public}d lastEnd=%{public}d lastHeight=%{public}f',
          lineCount, firstLine, requestedUtf16, measurementText.length, last.startIndex, last.endIndex, last.height);
      },
    });
  }

  private measuredReverseLines(paragraph: MeasurementParagraph, endScalar: number): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const map = paragraph.layoutMap;
    const endUtf16 = map.utf16ForScalar(Math.max(0,
      Math.min(map.scalarCount(), endScalar - paragraph.chapterStartScalar)));
    return collectReverseMeasuredLines(map, paragraph.chapterStartScalar, manager.getLineCount(), endUtf16, {
      lineEndUtf16: (index: number): number => manager.getLineMetrics(index).endIndex,
      readLine: (index: number): ArkUILineMetric => this.lineMetric(manager.getLineMetrics(index)),
      exceedsCapacity: (first: number, last: number): boolean =>
        this.surface.context().px2vp(readerNativeParagraphHeight(manager, first, last)) >
        this.surface.layout().bodyHeightAfterTitle(0),
    });
  }

  private presentationLineText(text: string): string {
    if (text.endsWith('\r\n')) {
      return text.substring(0, text.length - 2);
    }
    if (text.endsWith('\n') || text.endsWith('\r')) {
      return text.substring(0, text.length - 1);
    }
    return text;
  }

}
