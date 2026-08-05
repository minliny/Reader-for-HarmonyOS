import {
  LocalReadingFlowGateway,
  type LocalReadingAnchor,
  type LocalReadingChapter,
  type LocalReadingLayout,
  type LocalReadingProgressUpdate,
  type LocalReadingProgressState,
  type LocalReadingTocEntry,
} from './LocalReadingFlowGateway';
import { ReadingSurface, ReadingSurfacePageFragment } from './ReadingSurface';
import {
  ReadingSurfaceLayoutMap,
  type ReadingSurfaceLineMetric,
} from './ReadingSurfaceLayoutMap';

/**
 * The only progress datum emitted by the immersive reader. Its offset is a
 * Unicode-scalar index accepted by Reader Core, never an ArkUI UTF-16 index.
 */
export class LocalReadingCommit {
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string | undefined;

  constructor(
    bookId: string,
    chapterIndex: number,
    chapterOffset: number,
    chapterProgress: number,
    locationRevision: string | undefined,
  ) {
    this.bookId = bookId;
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
  }
}

/**
 * Chapter-level paragraph boundaries.  These remain deliberately tiny: a
 * long EPUB is indexed once, but no paragraph text, local map, or ArkUI
 * controller is retained until its current first-page batch is measured.
 */
class ParagraphRange {
  id: string;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;

  constructor(
    id: string,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
  ) {
    this.id = id;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
  }
}

/**
 * The only paragraph representation ever mounted in the hidden ArkUI tree.
 * It is discarded after the line metrics have been copied into first-page
 * fragments, keeping real long chapters bounded by the batch limits below.
 */
class MeasurementParagraph {
  id: string;
  rangeIndex: number;
  text: string;
  chapterStartScalar: number;
  layoutMap: ReadingSurfaceLayoutMap;
  controller: TextController;
  isParagraphStart: boolean;
  /** True only when this bounded text ends before its semantic paragraph. */
  isRangeTruncated: boolean;

  constructor(
    id: string,
    rangeIndex: number,
    text: string,
    chapterStartScalar: number,
    layoutMap: ReadingSurfaceLayoutMap,
    controller: TextController,
    isParagraphStart: boolean,
    isRangeTruncated: boolean,
  ) {
    this.id = id;
    this.rangeIndex = rangeIndex;
    this.text = text;
    this.chapterStartScalar = chapterStartScalar;
    this.layoutMap = layoutMap;
    this.controller = controller;
    this.isParagraphStart = isParagraphStart;
    this.isRangeTruncated = isRangeTruncated;
  }
}

class MeasuredReadingLine {
  lineIndex: number;
  startUtf16: number;
  endUtf16: number;
  startScalar: number;
  endScalar: number;
  height: number;

  constructor(
    lineIndex: number,
    startUtf16: number,
    endUtf16: number,
    startScalar: number,
    endScalar: number,
    height: number,
  ) {
    this.lineIndex = lineIndex;
    this.startUtf16 = startUtf16;
    this.endUtf16 = endUtf16;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.height = height;
  }
}

class PhysicalReadingPage {
  fragments: ReadingSurfacePageFragment[];
  startScalar: number;
  endScalar: number;

  constructor(fragments: ReadingSurfacePageFragment[], startScalar: number, endScalar: number) {
    this.fragments = fragments;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
  }
}

class CoreReadingAnchor implements LocalReadingAnchor {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
  }
}

class CoreReadingProgressUpdate implements LocalReadingProgressUpdate {
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string | undefined;

  constructor(chapterIndex: number, chapterOffset: number, chapterProgress: number, locationRevision: string) {
    this.chapterIndex = chapterIndex;
    this.chapterOffset = chapterOffset;
    this.chapterProgress = chapterProgress;
    this.locationRevision = locationRevision;
  }
}

class CoreReadingLayout implements LocalReadingLayout {
  viewportWidth: number;
  viewportHeight: number;
  fontScale: number;
  lineHeight: number;

  constructor(
    viewportWidth: number,
    viewportHeight: number,
    fontScale: number,
    lineHeight: number,
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.fontScale = fontScale;
    this.lineHeight = lineHeight;
  }
}

class ArkUILineMetric implements ReadingSurfaceLineMetric {
  startIndex: number;
  endIndex: number;
  height: number;
  topHeight: number;
  width: number;
  baseline: number;

  constructor(metric: LineMetrics) {
    this.startIndex = metric.startIndex;
    this.endIndex = metric.endIndex;
    this.height = metric.height;
    this.topHeight = metric.topHeight;
    this.width = metric.width;
    this.baseline = metric.baseline;
  }
}

type ReadingPhase = 'loading' | 'measuring' | 'ready' | 'failed';

const FIGMA_PHONE_WIDTH = 390;
const FIGMA_PHONE_HEIGHT = 844;
const FIGMA_TABLET_WIDTH = 760;
const FIGMA_TABLET_HEIGHT = 960;
const FIGMA_PHONE_TOP_INSET = 72;
const FIGMA_PHONE_BOTTOM_INSET = 47.99;
const FIGMA_TABLET_TOP_INSET = 92.44;
const FIGMA_TABLET_BOTTOM_INSET = 56.44;
const FIGMA_PHONE_HORIZONTAL_INSET = 32;
const FIGMA_TABLET_HORIZONTAL_INSET = 44.44;
const FIGMA_TITLE_LINE_HEIGHT = 28.75;
const FIGMA_TITLE_TO_BODY_SPACE = 18;
const FIGMA_PARAGRAPH_SPACE = 15.8;
const FIGMA_BODY_LINE_HEIGHT = 35.28;
const UNICODE_PROBE = 'A😀B';
/** Engineering ceiling only; it has no visual meaning or design authority. */
const MAX_MEASUREMENT_BATCH_PARAGRAPHS = 8;
const MAX_MEASUREMENT_BATCH_UTF16 = 12 * 1024;
/** No source-approved loading state exists, so a missing layout must fail closed. */
const MEASUREMENT_LAYOUT_TIMEOUT_MS = 6000;

/**
 * Feature-local immersive reading implementation for an imported local book.
 *
 * It deliberately has no page-turn or scroll-page behavior. Instead it lays
 * out one static physical ReadingSurface page at a time from Core materialized
 * content. The next page is only selected by a persisted Core scalar anchor
 * or a caller-supplied chapter selection; navigation/controls stay outside
 * this component so they can use their own Figma-specified static states.
 *
 * Figma source:
 * - `15 · Reader 2` Phone ReadingSurface `1023:18355` (390 × 844)
 * - `15 · Reader 2` TabletExpanded `1023:18371` (760 × 960)
 */
@Component
export struct LocalReadingExperience {
  @Prop bookId: string;
  @Prop @Watch('onRequestedChapterChanged') requestedChapterIndex: number | undefined = undefined;
  @Prop isTablet: boolean;
  /**
   * The host owns the system Back event. It receives this guarded request
   * function and must invoke it instead of changing the route directly.
   * `onExit` below is then called only after the current anchor commit has
   * settled (or there was no materialized page to commit).
   */
  onExitRequestHandler: (requestExit: () => void) => void =
    (_requestExit: () => void): void => {};
  onExit: () => void = (): void => {};
  /**
   * The parent may expose the static Figma ReadingSurface only after this
   * first real page has been measured and written to Core.  This is a route
   * readiness signal, not a new visual loading/error state.
  */
  onReadingReady: () => void = (): void => {};
  onReadingCommitted: (commit: LocalReadingCommit) => void = (_commit: LocalReadingCommit): void => {};
  /**
   * Reports only the already materialized Core chapter identity to a
   * Figma-specified overlay such as Full Directory. It does not change the
   * page, create a second reading model, or write progress.
   */
  onChapterMaterialized: (chapterIndex: number, chapterTitle: string) => void =
    (_chapterIndex: number, _chapterTitle: string): void => {};

  @State private phase: ReadingPhase = 'loading';
  @State private chapterTitle: string = '';
  @State private visibleFragments: ReadingSurfacePageFragment[] = [];
  @State private viewportWidth: number = 0;
  @State private viewportHeight: number = 0;
  /** Forces a fresh hidden measurement tree without recreating controllers in build. */
  @State private measurementEpoch: number = 0;
  /** Logged for diagnostics only; there is no Figma error surface to invent here. */
  @State private failureCode: string = '';

  private readonly gateway: LocalReadingFlowGateway = new LocalReadingFlowGateway();
  private readonly unicodeProbeController: TextController = new TextController();
  private readonly paragraphRanges: ParagraphRange[] = [];
  private readonly measurementBatch: MeasurementParagraph[] = [];
  private chapterLayoutMap: ReadingSurfaceLayoutMap | undefined = undefined;
  private visiblePage: PhysicalReadingPage | undefined = undefined;
  private pendingPageFragments: ReadingSurfacePageFragment[] = [];
  private pendingPageStartScalar: number = -1;
  private pendingPageEndScalar: number = -1;
  private pendingPageHeight: number = 0;
  private nextRangeIndex: number = 0;
  private firstRangeStartScalar: number = 0;
  private batchProcessing: boolean = false;
  private measurementDeadlineTimer: number = -1;
  private chapter: LocalReadingChapter | undefined = undefined;
  private restoredProgress: LocalReadingProgressState | undefined = undefined;
  private tocEntries: LocalReadingTocEntry[] = [];
  private desiredChapterOffset: number = 0;
  private desiredChapterProgress: number = 0;
  private measurementGeneration: number = 0;
  /** Covers pagination, resolveLocation, and the initial progress write. */
  private measurementCompleting: boolean = false;
  /** A real Area change arrived while the preceding Core write was in flight. */
  private remeasurePending: boolean = false;
  private commitInFlight: boolean = false;
  private unicodeProbeVerifiedGeneration: number = -1;
  private didLayoutListener: (() => void) | undefined = undefined;
  /** Invalidates every continuation captured by a prior mounted instance. */
  private lifecycleToken: number = 0;
  /** Bumped per directory chapter selection so stale loads cannot win. */
  private chapterSelectionToken: number = 0;
  private mounted: boolean = false;
  private exitRequested: boolean = false;
  private exitDelivered: boolean = false;

  aboutToAppear(): void {
    this.lifecycleToken += 1;
    const lifecycleToken = this.lifecycleToken;
    this.mounted = true;
    this.exitRequested = false;
    this.exitDelivered = false;
    this.commitInFlight = false;
    this.measurementCompleting = false;
    this.remeasurePending = false;
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
    this.didLayoutListener = (): void => this.captureMeasurementAfterLayout();
    this.getUIContext().getUIObserver().on('didLayout', this.didLayoutListener);
    this.onExitRequestHandler((): void => this.requestExit());
    void this.loadInitialChapter(lifecycleToken);
  }

  aboutToDisappear(): void {
    // Do not begin a second, fire-and-forget write after the host has already
    // unmounted us. Normal exit is serialized through requestExit() instead.
    this.mounted = false;
    this.lifecycleToken += 1;
    this.cancelMeasurementDeadline();
    if (this.didLayoutListener !== undefined) {
      this.getUIContext().getUIObserver().off('didLayout', this.didLayoutListener);
      this.didLayoutListener = undefined;
    }
    // Clear the host-held closure so an old reader instance cannot be asked
    // to exit after it has been removed from the route.
    this.onExitRequestHandler((): void => {});
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The Figma-derived PaperLayer is intentionally present for every
      // lifecycle phase. There is no source-approved loading/error state to
      // invent, but an empty Stack must never become a white reading page.
      ReadingSurface({
        chapterTitle: this.chapterTitle,
        // On a real viewport reflow keep the previously committed page
        // visible until its replacement has been measured and stored.  The
        // initial entry is held behind Detail by Index, so this never invents
        // a Figma loading screen or exposes a title-only paper surface.
        pageFragments: this.visibleFragments,
        isTablet: this.isTablet,
      });
      if (this.phase === 'measuring' && this.measurementEpoch > 0) {
        this.hiddenMeasurementTree();
      }
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const lifecycleToken = this.lifecycleToken;
      if (!this.isSessionActive(lifecycleToken)) {
        return;
      }
      const width = this.numericAreaLength(newValue.width);
      const height = this.numericAreaLength(newValue.height);
      if (width <= 0 || height <= 0 ||
        (Math.abs(width - this.viewportWidth) < 0.01 && Math.abs(height - this.viewportHeight) < 0.01)) {
        return;
      }
      this.viewportWidth = width;
      this.viewportHeight = height;
      if (this.chapter !== undefined) {
        // The hidden Text layout and its initial Core write are one atomic
        // generation. Starting another one here would race two writes against
        // the same Core snapshot revision.
        if (this.measurementCompleting) {
          this.remeasurePending = true;
          return;
        }
        this.beginMeasurement(lifecycleToken);
      }
    });
  }

  @Builder
  private hiddenMeasurementTree() {
    // Opacity keeps the actual Text nodes in the layout pass. `Visibility.None`
    // would make TextController's LayoutManager unavailable and a timer would
    // race layout; UIObserver.didLayout below is therefore the only read point.
    Column() {
      Text(UNICODE_PROBE, { controller: this.unicodeProbeController })
        .width(this.measurementTextWidth())
        .fontFamily('ReaderNotoSerifSCRegular')
        .fontWeight(FontWeight.Regular)
        .fontSize(18)
        .lineHeight(FIGMA_BODY_LINE_HEIGHT)
        .fontColor('#2B241D');

      ForEach(this.measurementBatch, (paragraph: MeasurementParagraph) => {
        Text(paragraph.text, { controller: paragraph.controller })
          .width(this.measurementTextWidth())
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Regular)
          .fontSize(18)
          .lineHeight(FIGMA_BODY_LINE_HEIGHT)
          .fontColor('#2B241D')
          .textIndent(paragraph.isParagraphStart ? 36 : 0);
      }, (paragraph: MeasurementParagraph): string => `${this.measurementEpoch}:${paragraph.id}`);
    }
    .width(this.measurementTextWidth())
    .opacity(0)
    .position({ x: this.horizontalInset(), y: this.topInset() });
  }

  private async loadInitialChapter(lifecycleToken: number): Promise<void> {
    try {
      const initialLoad = await Promise.all([
        this.gateway.loadToc(this.bookId),
        this.gateway.loadProgress(this.bookId),
      ]);
      if (!this.isSessionActive(lifecycleToken)) {
        return;
      }
      const toc = initialLoad[0];
      const progress = initialLoad[1];
      this.tocEntries = toc.entries;
      const requested = this.normalizedRequestedChapter();
      const restored = progress.kind === 'restored' ? progress.progress : undefined;
      const target = requested === undefined ? restored?.chapterIndex : requested;
      const chapterIndex = this.requireKnownChapter(target);
      this.restoredProgress = progress;
      await this.openChapter(chapterIndex, true, lifecycleToken);
    } catch (error) {
      this.fail(error as Error, lifecycleToken);
    }
  }

  /**
   * R-LOCAL-TOC-01: Full Directory emits a chapter selection while this same
   * reader instance stays mounted behind the overlay. The prop changes here,
   * so reload that chapter instead of only ever honoring the first mount.
   */
  private onRequestedChapterChanged(): void {
    const requested = this.requestedChapterIndex;
    if (requested === undefined || !this.mounted) {
      return;
    }
    if (this.chapter !== undefined && this.chapter.chapterIndex === requested) {
      return;
    }
    const lifecycleToken = this.lifecycleToken;
    // Bump the selection token so a slower, earlier chapter load can never
    // overwrite a later selection when several rows are tapped in a row.
    this.chapterSelectionToken += 1;
    const selectionToken = this.chapterSelectionToken;
    // Fully reset the in-flight measurement of the previously selected
    // chapter. The old chapter's async submit may have already set
    // measurementCompleting=true; if we leave it, the new chapter's
    // beginMeasurement only queues remeasurePending and never measures again
    // (blank / stale surface). Clearing the batch also stops a stale tree's
    // didLayout from being consumed as the current generation's measurement.
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.batchProcessing = false;
    this.measurementBatch.length = 0;
    this.paragraphRanges.length = 0;
    this.pendingPageFragments.length = 0;
    this.pendingPageStartScalar = -1;
    this.pendingPageEndScalar = -1;
    this.visiblePage = undefined;
    this.visibleFragments = [];
    this.phase = 'loading';
    this.cancelMeasurementDeadline();
    // A manual directory selection is not a restore; start the chapter at its
    // natural first scalar.
    this.restoredProgress = undefined;
    void this.openChapter(requested, false, lifecycleToken, selectionToken);
  }

  private async openChapter(
    chapterIndex: number,
    isInitial: boolean,
    lifecycleToken: number,
    selectionToken: number = 0,
  ): Promise<void> {
    try {
      if (!isInitial && this.tocEntries.length > 0) {
        this.requireKnownChapter(chapterIndex);
      }
      const chapter = await this.gateway.loadChapter(this.bookId, chapterIndex);
      if (!this.isSessionActive(lifecycleToken) || selectionToken !== this.chapterSelectionToken) {
        return;
      }
      this.chapter = chapter;
      this.chapterTitle = chapter.chapterTitle;
      this.onChapterMaterialized(chapter.chapterIndex, chapter.chapterTitle);
      this.configureRestoredAnchor(chapter, isInitial);
      // Never lay out against the Phone/Tablet fallback constants. If Area
      // has already arrived, start once now; otherwise the first real Area
      // callback below owns the initial measurement generation.
      if (this.hasMeasuredViewport()) {
        this.beginMeasurement(lifecycleToken);
      }
    } catch (error) {
      // A stale selection (or unmounted session) must not fail the current
      // reading flow; only a current request's error is surfaced.
      if (!this.isSessionActive(lifecycleToken) || selectionToken !== this.chapterSelectionToken) {
        return;
      }
      this.fail(error as Error, lifecycleToken);
    }
  }

  private configureRestoredAnchor(chapter: LocalReadingChapter, isInitial: boolean): void {
    const chapterMap = new ReadingSurfaceLayoutMap(chapter.content);
    if (chapterMap.scalarCount() === 0) {
      throw new Error('READING_CONTENT_EMPTY');
    }
    this.chapterLayoutMap = chapterMap;
    const restored = isInitial && this.restoredProgress?.kind === 'restored' &&
      this.restoredProgress.progress.chapterIndex === chapter.chapterIndex ? this.restoredProgress.progress : undefined;
    if (restored === undefined) {
      this.desiredChapterOffset = 0;
      this.desiredChapterProgress = 0;
      return;
    }
    const scalarCount = chapterMap.scalarCount();
    const offset = restored.chapterOffset <= scalarCount ? restored.chapterOffset :
      Math.round(restored.chapterProgress * scalarCount);
    this.desiredChapterOffset = Math.max(0, Math.min(scalarCount - 1, offset));
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
  }

  private beginMeasurement(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    if (!this.hasMeasuredViewport()) {
      return;
    }
    if (this.measurementCompleting) {
      this.remeasurePending = true;
      return;
    }
    const chapter = this.chapter;
    if (chapter === undefined) {
      return;
    }
    try {
      this.paragraphRanges.length = 0;
      this.measurementBatch.length = 0;
      this.collectParagraphRanges(chapter.content);
      if (this.paragraphRanges.length === 0) {
        throw new Error('READING_CONTENT_EMPTY');
      }
      const map = this.requireChapterLayoutMap();
      const scalarCount = map.scalarCount();
      // A Core offset at EOF is legal storage data but cannot materialize a
      // visible glyph.  Clamp only the presentation anchor to the final
      // scalar; the next successful commit normalizes Core to that real page
      // start rather than leaving a permanently empty reader surface.
      const firstRange = this.paragraphRanges[0];
      const lastRange = this.paragraphRanges[this.paragraphRanges.length - 1];
      const firstRenderableScalar = firstRange.startScalar;
      const lastRenderableScalar = lastRange.endScalar - 1;
      this.desiredChapterOffset = Math.max(firstRenderableScalar, Math.min(
        lastRenderableScalar,
        this.desiredChapterOffset,
      ));
      this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
      this.nextRangeIndex = this.rangeIndexForOffset(this.desiredChapterOffset);
      this.firstRangeStartScalar = this.desiredChapterOffset;
      this.resetPendingPage();
      const hasCommittedPage = this.visiblePage !== undefined && this.phase === 'ready';
      if (!hasCommittedPage) {
        this.visiblePage = undefined;
        this.visibleFragments = [];
      }
      this.measurementGeneration += 1;
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.phase = 'measuring';
      if (!this.prepareNextMeasurementBatch()) {
        throw new Error('PAGINATION_NO_MEASUREMENT_BATCH');
      }
      // Controllers are intentionally recreated only for the bounded batch.
      // Bumping the epoch unmounts any predecessor before this new batch
      // becomes the sole hidden layout tree.
      this.measurementEpoch += 1;
      this.armMeasurementDeadline(this.measurementGeneration, lifecycleToken);
    } catch (error) {
      this.fail(error as Error, lifecycleToken);
    }
  }

  private captureMeasurementAfterLayout(): void {
    const lifecycleToken = this.lifecycleToken;
    if (!this.isSessionActive(lifecycleToken) || this.phase !== 'measuring' ||
      this.measurementCompleting || this.batchProcessing) {
      return;
    }
    if (!this.hasValidUnicodeProbe(lifecycleToken) || !this.allBatchParagraphsHaveLayout()) {
      return;
    }
    const generation = this.measurementGeneration;
    this.batchProcessing = true;
    this.consumeMeasuredBatch(generation, lifecycleToken);
  }

  private consumeMeasuredBatch(generation: number, lifecycleToken: number): void {
    try {
      if (!this.isSessionActive(lifecycleToken) || generation !== this.measurementGeneration ||
        this.phase !== 'measuring') {
        return;
      }
      const lineCapacity = this.bodyCapacity();
      if (!Number.isFinite(lineCapacity) || lineCapacity <= 0) {
        throw new Error('PAGINATION_SURFACE_HEIGHT_INVALID');
      }
      for (const paragraph of this.measurementBatch) {
        const lines = this.measuredLines(paragraph);
        for (const line of lines) {
          const isParagraphStart = paragraph.isParagraphStart && line.lineIndex === 0;
          const paragraphSpace = isParagraphStart && this.pendingPageFragments.length > 0 ?
            FIGMA_PARAGRAPH_SPACE : 0;
          if (this.pendingPageFragments.length > 0 &&
            this.pendingPageHeight + paragraphSpace + line.height > lineCapacity) {
            this.beginFirstPageCommit(generation, lifecycleToken);
            return;
          }
          if (this.pendingPageFragments.length === 0) {
            this.pendingPageStartScalar = line.startScalar;
          }
          this.pendingPageHeight += paragraphSpace + line.height;
          this.pendingPageEndScalar = line.endScalar;
          this.pendingPageFragments.push(new ReadingSurfacePageFragment(
            `${paragraph.id}:${line.startScalar}-${line.endScalar}`,
            this.presentationLineText(paragraph.text.substring(line.startUtf16, line.endUtf16)),
            isParagraphStart,
          ));
        }
        if (paragraph.isRangeTruncated) {
          // We reached the arbitrary, invisible prefix boundary before a
          // physical page was full. Joining the remaining text in a separate
          // node can alter this last line's wrapping, so do not claim a
          // correct first-page anchor from it.
          throw new Error('READING_LONG_PARAGRAPH_BATCH_UNVERIFIED');
        }
      }
      // All controller-derived data from this batch has now been copied into
      // plain fragments.  Release it before moving to the next bounded batch.
      this.measurementBatch.length = 0;
      if (this.prepareNextMeasurementBatch()) {
        this.batchProcessing = false;
        this.measurementEpoch += 1;
        return;
      }
      this.beginFirstPageCommit(generation, lifecycleToken);
    } catch (error) {
      if (generation === this.measurementGeneration) {
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  private hasValidUnicodeProbe(lifecycleToken: number): boolean {
    let manager: LayoutManager;
    let lineCount: number;
    try {
      manager = this.unicodeProbeController.getLayoutManager();
      lineCount = manager.getLineCount();
    } catch (_) {
      // Layout can still be pending when the global didLayout fires for another
      // branch. The deadline turns a permanently unavailable manager into a
      // logged fail-closed exit rather than a title-only reading surface.
      return false;
    }
    if (lineCount === 0) {
      return false;
    }
    try {
      if (lineCount !== 1) {
        throw new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED');
      }
      const metric = manager.getLineMetrics(0);
      const map = new ReadingSurfaceLayoutMap(UNICODE_PROBE);
      const line = map.linesFromArkUI([this.toLineMetric(metric)])[0];
      if (metric.startIndex !== 0 || metric.endIndex !== map.utf16Length() ||
        map.utf16Length() !== 4 || map.scalarCount() !== 3 ||
        line.startScalar !== 0 || line.endScalar !== 3) {
        throw new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED');
      }
      if (this.unicodeProbeVerifiedGeneration !== this.measurementGeneration) {
        this.unicodeProbeVerifiedGeneration = this.measurementGeneration;
        console.info('LocalReadingExperience UTF-16 probe passed: A😀B = 4 UTF-16 / 3 Unicode scalars');
      }
      return true;
    } catch (_) {
      // Metrics exist, so this is not a layout-pending signal.  In particular,
      // a UTF-16 line boundary that splits a surrogate must never be retried
      // until the hidden page silently waits forever.
      this.fail(new Error('PAGINATION_INDEX_UNIT_UNSUPPORTED'), lifecycleToken);
      return false;
    }
  }

  private allBatchParagraphsHaveLayout(): boolean {
    try {
      if (this.measurementBatch.length === 0) {
        return false;
      }
      for (const paragraph of this.measurementBatch) {
        if (paragraph.controller.getLayoutManager().getLineCount() <= 0) {
          return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  private measuredLines(paragraph: MeasurementParagraph): MeasuredReadingLine[] {
    const manager = paragraph.controller.getLayoutManager();
    const lineCount = manager.getLineCount();
    if (lineCount <= 0) {
      throw new Error('PAGINATION_MEASUREMENT_PENDING');
    }
    const metrics: ReadingSurfaceLineMetric[] = [];
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      metrics.push(this.toLineMetric(manager.getLineMetrics(lineIndex)));
    }
    const scalarLines = paragraph.layoutMap.linesFromArkUI(metrics);
    const result: MeasuredReadingLine[] = [];
    for (let lineIndex = 0; lineIndex < scalarLines.length; lineIndex += 1) {
      const local = scalarLines[lineIndex];
      if (local.endScalar <= local.startScalar || local.height <= 0) {
        continue;
      }
      result.push(new MeasuredReadingLine(
        lineIndex,
        paragraph.layoutMap.utf16ForScalar(local.startScalar),
        paragraph.layoutMap.utf16ForScalar(local.endScalar),
        paragraph.chapterStartScalar + local.startScalar,
        paragraph.chapterStartScalar + local.endScalar,
        local.height,
      ));
    }
    if (result.length === 0) {
      throw new Error('PAGINATION_LINE_GEOMETRY_INVALID');
    }
    return result;
  }

  private toLineMetric(metric: LineMetrics): ArkUILineMetric {
    return new ArkUILineMetric(metric);
  }

  private beginFirstPageCommit(generation: number, lifecycleToken: number): void {
    if (this.pendingPageFragments.length === 0 || this.pendingPageStartScalar < 0 ||
      this.pendingPageEndScalar < this.pendingPageStartScalar) {
      this.fail(new Error('PAGINATION_NO_PHYSICAL_PAGE'), lifecycleToken);
      return;
    }
    const page = new PhysicalReadingPage(
      [...this.pendingPageFragments],
      this.pendingPageStartScalar,
      this.pendingPageEndScalar,
    );
    this.measurementBatch.length = 0;
    this.batchProcessing = false;
    this.measurementCompleting = true;
    this.cancelMeasurementDeadline();
    // Unmount the hidden controller tree while Core resolves and stores the
    // actual visible scalar anchor.  No subsequent batch exists in memory.
    this.measurementEpoch += 1;
    void this.completeFirstPage(page, generation, lifecycleToken);
  }

  private async completeFirstPage(
    visiblePage: PhysicalReadingPage,
    generation: number,
    lifecycleToken: number,
  ): Promise<void> {
    try {
      if (!this.isSessionActive(lifecycleToken) || generation !== this.measurementGeneration ||
        this.phase !== 'measuring') {
        return;
      }
      const chapter = this.requireChapter();
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      const visibleProgress = scalarCount === 0 ? 0 : visiblePage.startScalar / scalarCount;
      const resolved = await this.gateway.resolveLocation(
        this.bookId,
        chapter.chapterTitle,
        new CoreReadingAnchor(chapter.chapterIndex, visiblePage.startScalar, visibleProgress),
        this.coreLayout(),
      );
      if (!this.isSessionActive(lifecycleToken) || generation !== this.measurementGeneration ||
        this.phase !== 'measuring') {
        return;
      }
      // Persistence precedes visibility: a process stop once the static page
      // is shown always has a Core-owned scalar anchor to restore from.
      const stored = await this.gateway.updateProgress(this.bookId, new CoreReadingProgressUpdate(
        resolved.chapterIndex,
        resolved.chapterOffset,
        resolved.chapterProgress,
        resolved.locationRevision,
      ));
      if (!this.isSessionActive(lifecycleToken) || generation !== this.measurementGeneration ||
        this.phase !== 'measuring') {
        return;
      }
      if (stored.chapterIndex !== chapter.chapterIndex || stored.chapterOffset !== visiblePage.startScalar) {
        throw new Error('READING_INITIAL_PROGRESS_ANCHOR_MISMATCH');
      }
      this.desiredChapterOffset = visiblePage.startScalar;
      this.desiredChapterProgress = visibleProgress;
      this.visiblePage = visiblePage;
      this.visibleFragments = visiblePage.fragments;
      this.phase = 'ready';
      this.measurementCompleting = false;
      this.onReadingReady();
      this.onReadingCommitted(new LocalReadingCommit(
        this.bookId,
        stored.chapterIndex,
        stored.chapterOffset,
        stored.chapterProgress,
        stored.locationRevision,
      ));
      this.resumeDeferredMeasurement(lifecycleToken);
    } catch (error) {
      if (generation === this.measurementGeneration) {
        this.fail(error as Error, lifecycleToken);
      }
    }
  }

  /**
   * The only normal exit path. The host invokes the registered request
   * closure; this component serializes Core persistence before it gives route
   * ownership back through `onExit`.
   */
  private requestExit(): void {
    const lifecycleToken = this.lifecycleToken;
    if (!this.isSessionActive(lifecycleToken) || this.exitRequested) {
      return;
    }
    this.exitRequested = true;
    void this.finishExit(lifecycleToken);
  }

  private async finishExit(lifecycleToken: number): Promise<void> {
    try {
      // A loading/measuring failure has no materialized physical page, so this
      // is deliberately a no-op commit that still completes before exit.
      await this.commitVisiblePage(lifecycleToken);
    } finally {
      if (!this.isMountedToken(lifecycleToken) || this.exitDelivered) {
        return;
      }
      this.exitDelivered = true;
      this.onExit();
    }
  }

  private async commitVisiblePage(lifecycleToken: number): Promise<void> {
    if (!this.isMountedToken(lifecycleToken) || this.phase !== 'ready' || this.commitInFlight ||
      this.chapter === undefined || this.visiblePage === undefined) {
      return;
    }
    const page = this.visiblePage;
    this.commitInFlight = true;
    try {
      const chapter = this.chapter;
      const scalarCount = this.requireChapterLayoutMap().scalarCount();
      const chapterProgress = scalarCount === 0 ? 0 : page.startScalar / scalarCount;
      const resolved = await this.gateway.resolveLocation(
        this.bookId,
        chapter.chapterTitle,
        new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, chapterProgress),
        this.coreLayout(),
      );
      if (!this.isMountedToken(lifecycleToken)) {
        return;
      }
      const stored = await this.gateway.updateProgress(this.bookId, new CoreReadingProgressUpdate(
        resolved.chapterIndex,
        resolved.chapterOffset,
        resolved.chapterProgress,
        resolved.locationRevision,
      ));
      if (!this.isMountedToken(lifecycleToken)) {
        return;
      }
      this.onReadingCommitted(new LocalReadingCommit(
        this.bookId,
        stored.chapterIndex,
        stored.chapterOffset,
        stored.chapterProgress,
        stored.locationRevision,
      ));
    } catch (error) {
      // The visible static reading page remains valid. Persistence failures are
      // logged rather than replaced by an unapproved visual state.
      console.error(`LocalReadingExperience progress commit failed: ${this.errorMessage(error as Error)}`);
    } finally {
      if (this.isMountedToken(lifecycleToken)) {
        this.commitInFlight = false;
      }
    }
  }

  private coreLayout(): CoreReadingLayout {
    // Core's contract is a uint32 viewport snapshot. ArkUI areas may be
    // fractional vp values, so retain the fractional value for measurement
    // and round only at this Core protocol boundary.
    return new CoreReadingLayout(
      Math.max(1, Math.round(this.effectiveViewportWidth())),
      Math.max(1, Math.round(this.effectiveViewportHeight())),
      // This initial Figma-constrained surface uses the supplied 1× type scale.
      // A user-selected typography scale is intentionally not invented here.
      1,
      FIGMA_BODY_LINE_HEIGHT,
    );
  }

  private collectParagraphRanges(content: string): void {
    const chapterMap = this.requireChapterLayoutMap();
    let start = 0;
    const paragraphDivider = /(?:\r\n|\n|\r)[\t ]*(?:\r\n|\n|\r)(?:[\t ]*(?:\r\n|\n|\r))*/g;
    let match = paragraphDivider.exec(content);
    while (match !== null) {
      this.appendParagraphRange(start, match.index, chapterMap);
      start = match.index + match[0].length;
      match = paragraphDivider.exec(content);
    }
    this.appendParagraphRange(start, content.length, chapterMap);
  }

  private appendParagraphRange(
    startUtf16: number,
    endUtf16: number,
    chapterMap: ReadingSurfaceLayoutMap,
  ): void {
    if (endUtf16 <= startUtf16) {
      return;
    }
    const index = this.paragraphRanges.length;
    this.paragraphRanges.push(new ParagraphRange(
      `paragraph-${index}-${startUtf16}`,
      startUtf16,
      endUtf16,
      chapterMap.scalarForUtf16(startUtf16),
      chapterMap.scalarForUtf16(endUtf16),
    ));
  }

  /**
   * Materialize no more than one bounded group of paragraphs.  A large single
   * paragraph receives a bounded prefix, never a hidden whole-paragraph
   * controller.  It is accepted only if that prefix itself determines the
   * first physical page before its last line; otherwise we fail closed rather
   * than assuming that a separately wrapped suffix would join correctly.
   */
  private prepareNextMeasurementBatch(): boolean {
    const chapter = this.requireChapter();
    const chapterMap = this.requireChapterLayoutMap();
    this.measurementBatch.length = 0;
    let totalUtf16 = 0;
    while (this.nextRangeIndex < this.paragraphRanges.length &&
      this.measurementBatch.length < MAX_MEASUREMENT_BATCH_PARAGRAPHS) {
      const range = this.paragraphRanges[this.nextRangeIndex];
      const startScalar = Math.max(range.startScalar, this.firstRangeStartScalar);
      if (startScalar >= range.endScalar) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      const startUtf16 = chapterMap.utf16ForScalar(startScalar);
      const utf16Length = range.endUtf16 - startUtf16;
      if (utf16Length <= 0) {
        this.nextRangeIndex += 1;
        this.firstRangeStartScalar = 0;
        continue;
      }
      if (this.measurementBatch.length > 0 && totalUtf16 + utf16Length > MAX_MEASUREMENT_BATCH_UTF16) {
        break;
      }
      const endUtf16 = utf16Length > MAX_MEASUREMENT_BATCH_UTF16 ?
        this.boundedUtf16End(startUtf16, range.endUtf16, chapterMap) : range.endUtf16;
      const endScalar = chapterMap.scalarForUtf16(endUtf16);
      const isRangeTruncated = endScalar < range.endScalar;
      const text = chapter.content.substring(startUtf16, endUtf16);
      this.measurementBatch.push(new MeasurementParagraph(
        `${range.id}:${startScalar}`,
        this.nextRangeIndex,
        text,
        startScalar,
        new ReadingSurfaceLayoutMap(text),
        new TextController(),
        startScalar === range.startScalar,
        isRangeTruncated,
      ));
      totalUtf16 += endUtf16 - startUtf16;
      if (isRangeTruncated) {
        // Do not put a suffix in a second Text node: if the prefix cannot
        // settle this first page, its final wrapped line is not proven to be
        // equivalent to a continuous ArkUI paragraph.
        this.firstRangeStartScalar = endScalar;
        break;
      }
      this.nextRangeIndex += 1;
      this.firstRangeStartScalar = 0;
    }
    return this.measurementBatch.length > 0;
  }

  private boundedUtf16End(
    startUtf16: number,
    rangeEndUtf16: number,
    chapterMap: ReadingSurfaceLayoutMap,
  ): number {
    let candidate = Math.min(rangeEndUtf16, startUtf16 + MAX_MEASUREMENT_BATCH_UTF16);
    while (candidate > startUtf16) {
      try {
        chapterMap.scalarForUtf16(candidate);
        return candidate;
      } catch (_) {
        // The cap may fall between a surrogate pair. Back up to the nearest
        // true Unicode scalar boundary; this loop is normally one step.
        candidate -= 1;
      }
    }
    throw new Error('READING_LONG_PARAGRAPH_BATCH_UNVERIFIED');
  }

  private rangeIndexForOffset(offset: number): number {
    for (let index = 0; index < this.paragraphRanges.length; index += 1) {
      if (offset < this.paragraphRanges[index].endScalar) {
        return index;
      }
    }
    // The call site clamps EOF to a real scalar.  Keep this defensive branch
    // for a malformed paragraph split rather than reading past the array.
    return Math.max(0, this.paragraphRanges.length - 1);
  }

  private resetPendingPage(): void {
    this.pendingPageFragments = [];
    this.pendingPageStartScalar = -1;
    this.pendingPageEndScalar = -1;
    this.pendingPageHeight = 0;
  }

  private requireChapterLayoutMap(): ReadingSurfaceLayoutMap {
    if (this.chapterLayoutMap === undefined) {
      throw new Error('READING_LAYOUT_MAP_NOT_READY');
    }
    return this.chapterLayoutMap;
  }

  /**
   * A TextController line range can include the hard newline that ended that
   * line. The visible surface renders every already-measured line as its own
   * Text node, so retaining that terminal delimiter would create an extra
   * blank line. The Core string and scalar map remain untouched.
   */
  private presentationLineText(text: string): string {
    if (text.endsWith('\r\n')) {
      return text.substring(0, text.length - 2);
    }
    if (text.endsWith('\n') || text.endsWith('\r')) {
      return text.substring(0, text.length - 1);
    }
    return text;
  }

  private requireKnownChapter(requested: number | undefined): number {
    if (this.tocEntries.length === 0) {
      throw new Error('LOCAL_TOC_EMPTY');
    }
    if (requested === undefined) {
      return this.tocEntries[0].index;
    }
    for (const entry of this.tocEntries) {
      if (entry.index === requested) {
        return requested;
      }
    }
    throw new Error('LOCAL_TOC_CHAPTER_NOT_FOUND');
  }

  private normalizedRequestedChapter(): number | undefined {
    const value = this.requestedChapterIndex;
    if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
      return undefined;
    }
    return value;
  }

  private requireChapter(): LocalReadingChapter {
    if (this.chapter === undefined) {
      throw new Error('READING_CHAPTER_NOT_LOADED');
    }
    return this.chapter;
  }

  private bodyCapacity(): number {
    return this.effectiveViewportHeight() - this.topInset() - this.bottomInset() -
      FIGMA_TITLE_LINE_HEIGHT - FIGMA_TITLE_TO_BODY_SPACE;
  }

  private measurementTextWidth(): number {
    return Math.max(1, this.effectiveViewportWidth() - this.horizontalInset() * 2);
  }

  private effectiveViewportWidth(): number {
    return this.viewportWidth > 0 ? this.viewportWidth :
      (this.isTablet ? FIGMA_TABLET_WIDTH : FIGMA_PHONE_WIDTH);
  }

  private hasMeasuredViewport(): boolean {
    return this.viewportWidth > 0 && this.viewportHeight > 0;
  }

  private resumeDeferredMeasurement(lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken) || !this.remeasurePending) {
      return;
    }
    this.remeasurePending = false;
    this.beginMeasurement(lifecycleToken);
  }

  private armMeasurementDeadline(generation: number, lifecycleToken: number): void {
    this.cancelMeasurementDeadline();
    this.measurementDeadlineTimer = setTimeout((): void => {
      if (!this.isSessionActive(lifecycleToken) || generation !== this.measurementGeneration ||
        this.phase !== 'measuring' || this.measurementCompleting) {
        return;
      }
      this.fail(new Error('PAGINATION_LAYOUT_METRICS_UNAVAILABLE'), lifecycleToken);
    }, MEASUREMENT_LAYOUT_TIMEOUT_MS);
  }

  private cancelMeasurementDeadline(): void {
    if (this.measurementDeadlineTimer < 0) {
      return;
    }
    clearTimeout(this.measurementDeadlineTimer);
    this.measurementDeadlineTimer = -1;
  }

  private effectiveViewportHeight(): number {
    return this.viewportHeight > 0 ? this.viewportHeight :
      (this.isTablet ? FIGMA_TABLET_HEIGHT : FIGMA_PHONE_HEIGHT);
  }

  private topInset(): number {
    return this.isTablet ? FIGMA_TABLET_TOP_INSET : FIGMA_PHONE_TOP_INSET;
  }

  private bottomInset(): number {
    return this.isTablet ? FIGMA_TABLET_BOTTOM_INSET : FIGMA_PHONE_BOTTOM_INSET;
  }

  private horizontalInset(): number {
    return this.isTablet ? FIGMA_TABLET_HORIZONTAL_INSET : FIGMA_PHONE_HORIZONTAL_INSET;
  }

  private normalizedProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  private numericAreaLength(value: Length): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isMountedToken(lifecycleToken: number): boolean {
    return this.mounted && lifecycleToken === this.lifecycleToken;
  }

  private isSessionActive(lifecycleToken: number): boolean {
    return this.isMountedToken(lifecycleToken) && !this.exitRequested;
  }

  private fail(error: Error, lifecycleToken: number): void {
    if (!this.isSessionActive(lifecycleToken)) {
      return;
    }
    this.failureCode = this.errorMessage(error);
    this.cancelMeasurementDeadline();
    this.phase = 'failed';
    this.measurementCompleting = false;
    this.remeasurePending = false;
    this.measurementGeneration += 1;
    console.error(`LocalReadingExperience failed: ${this.failureCode}`);
    // Figma has no admitted error surface. Leave via the same serialized exit
    // path instead of retaining a blank/failed page.
    this.requestExit();
  }

  private errorMessage(error: Error): string {
    return error.message;
  }
}
