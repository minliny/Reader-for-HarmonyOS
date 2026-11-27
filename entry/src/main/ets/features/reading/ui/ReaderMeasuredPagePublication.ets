import { hilog } from '@kit.PerformanceAnalysisKit';
import { canonicalMeasuredPageRequest } from './ReaderMeasuredPagePipeline';
import { readingChapterLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import type { ReadingChapterWindow } from '../application/ReadingChapterWindow';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import type { ReaderReadingChapterAcquisitionHost } from './ReaderReadingChapterAcquisitionHost';
import type { ReaderReadingChapterPresentationHost } from './ReaderReadingChapterPresentationHost';
import type { ReaderReadingMeasurementAdmissionHost } from './ReaderReadingMeasurementAdmissionHost';
import { type ReaderChapterRangeAcquisition } from './ReaderReadingChapterAcquisitionHost';
import { type ReadingPhase } from '../application/ReadingExperienceRenderSnapshots';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ParagraphRange } from '../application/ReadingMeasurementFacts';
import { ReaderMaterializedChapterContext, PreviousChapterMeasurement } from '../presentation/ReaderPagePresentationModels';
import { admitMeasuredPageEnd, planForwardMeasuredImage, planReverseMeasuredImage, type ReaderMeasuredParagraphResult } from './ReaderMeasuredPagePipeline';
import { ReaderPhysicalPaginationOwner } from './ReaderPhysicalPaginationOwner';
import { MeasurementParagraph, PhysicalReadingPage } from './ReadingMeasurementModels';
import { ReaderNativeParagraphResources } from './ReaderNativeParagraph';
import { ReaderReadingMeasurementNative, ReaderForwardParagraphMeasurement, ReaderReadingMeasurementSurface, ReaderReverseParagraphMeasurement } from './ReaderReadingMeasurementNative';
import { ReaderMeasurementRun, type ReaderUnicodeMeasurement } from '../application/ReaderMeasurementRun';
import { ReadingMeasurementCoordinator, type ReadingMeasurementContent, type ReadingMeasurementDocument } from '../application/ReadingMeasurementCoordinator';
import { ReadingSurfacePageFragment } from './ReadingSurface';
import { ReadingSurfaceLayoutMap, type ReadingDocumentRange } from '../application/ReadingSurfaceLayoutMap';
import { ReadingPaginationPrefix, type ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import { type ReadingSessionChapter, type ReadingSessionImage } from '../application/ReadingChapterWindow';
import { collectReadingParagraphUtf16Ranges, readingParagraphBoundaryMode } from '../application/ReadingParagraphProjection';
import { lastMeasurableParagraphScalar, projectRetainedReadingParagraphWindow, type ReadingChapterMeasurementProjection, type ReadingMeasurementStart } from '../application/ReadingChapterMeasurementPreparation';
import { copyReaderAppearanceSnapshot, type ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import { readerAppearanceLineHeight } from './ReaderAppearanceRenderStyle';
import { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

export interface ReaderMeasureView {
  readonly lifecycle: () => number;
  readonly sourceId: () => string;
  readonly bookId: () => string;
  readonly bookKind: () => string | undefined;
  readonly sessionActive: (lifecycle: number) => boolean;
  readonly selectionActive: (lifecycle: number, selection: number) => boolean;
  readonly selectionCurrent: (selection: number) => boolean;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly hasMeasuredViewport: () => boolean;
  readonly context: () => UIContext;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly continuous: () => boolean;
  readonly phase: () => ReadingPhase;
  readonly visibleFragments: () => ReadingSurfacePageFragment[];
  readonly currentPaginationKey: () => ReadingPaginationKey;
  readonly layoutSignature: () => string;
  readonly lastVisibleScalar: (content: string, map: ReadingSurfaceLayoutMap) => number;
  readonly preparationPending: () => boolean;
  readonly noPendingSelection: () => boolean;
}

export interface ReaderMeasureImages {
  readonly forParagraph: (paragraph: MeasurementParagraph) => ReadingSessionImage | undefined;
  readonly scaledHeight: (image: ReadingSessionImage, capacity: number) => number;
  readonly resolvePending: (image: ReadingSessionImage, generation: number, selection: number, lifecycle: number) => void;
  readonly indexChapter: (chapter: ReadingSessionChapter) => void;
}

export interface ReaderMeasureEffects {
  readonly publishPhase: (phase: ReadingPhase) => void;
  readonly clearVisibleFragments: () => void;
  readonly hideChapterTitle: () => void;
  readonly invalidateHiddenMeasurementTree: () => void;
  readonly ensureReadyDeadline: (lifecycle: number, selection: number) => void;
  readonly armCompletionDeadline: () => void;
  readonly retainNativeParagraphResources: () => void;
  readonly expandParagraphWindow: (request: ReaderChapterRangeAcquisition) => void;
  readonly admitVisibleChapter: (chapter: ReadingSessionChapter) => void;
  readonly completePreparedPageTurn: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number) => void;
  readonly completeFirstPage: (page: PhysicalReadingPage, generation: number, selection: number, lifecycle: number) => Promise<void>;
  readonly recordFirstLayout: (lifecycle: number) => void;
  readonly fail: (error: Error, lifecycle: number) => void;
}

/** Identity of the resident page, shared by ordinary presentation, durable
 * first-page publication and turn promotion. Speculative measurements never
 * acquire this lease. */
interface ReaderResidentMeasuredPage {
  readonly page: PhysicalReadingPage | undefined;
  readonly selection: number;
}

export interface ReaderFirstPageSurfacePublication {
  readonly publishBody: (page: PhysicalReadingPage) => void;
  readonly clearLoadingTarget: () => void;
  readonly continuous: () => boolean;
  readonly presentContinuous: (page: PhysicalReadingPage) => void;
  readonly finishRetained: (lifecycle: number, selection: number) => void;
  readonly releaseUnretainedImages: () => void;
}

/** Couples the speculative reverse lane only to the owners needed to apply,
 * abandon, or recover its exact predecessor boundary. */
export interface ReaderReversePagePorts {
  readonly window: ReadingChapterWindow;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly settlement: () => ReaderPageTurnSettlementHost;
  readonly input: () => ReaderPageTurnInputHost;
  readonly acquisition: () => ReaderReadingChapterAcquisitionHost;
  readonly chapterPresentation: () => ReaderReadingChapterPresentationHost;
  readonly firstPage: () => ReaderReadingMeasurementAdmissionHost;
  readonly mounted: () => boolean;
  readonly selection: () => number;
  readonly nextSelection: () => number;
  readonly knownChapter: (chapter: number) => boolean;
  readonly adjacentChapter: (chapter: number, step: number) => number | undefined;
  readonly canTurn: () => boolean;
  readonly retainWindow: () => void;
  readonly admitNeighbourVersion: (chapter: number, version: string) => void;
  readonly publishTurnRevision: () => void;
  readonly resolvePageImages: (chapter: ReadingSessionChapter, fragments: ReadingSurfacePageFragment[]) => void;
  readonly releaseImages: () => void;
  readonly resumeAutomatic: () => void;
  readonly resumeSpeech: () => void;
  readonly scheduleTexture: () => void;
  readonly clearRestoredProgress: () => void;
}

export class ReaderMeasuredPagePublication {
  readonly physicalPagination: ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment> =
    new ReaderPhysicalPaginationOwner<ReadingSurfacePageFragment>();
  chapterLayoutMap: ReadingSurfaceLayoutMap | undefined = undefined;
  materializedContentVersion: string = '';
  batchProcessing: boolean = false;
  chapter: ReadingSessionChapter | undefined = undefined;
  previousChapterMeasurement: PreviousChapterMeasurement | undefined = undefined;
  canonicalModeAnchor: number = -1;
  desiredChapterOffset: number = 0;
  desiredChapterProgress: number = 0;
  measurementCompleting: boolean = false;
  readonly measurementRun: ReaderMeasurementRun = new ReaderMeasurementRun({
    set: (delay: number, callback: () => void): number => setTimeout(callback, delay),
    clear: (handle: number): void => clearTimeout(handle),
  });
  readonly nativeParagraphResources: ReaderNativeParagraphResources = new ReaderNativeParagraphResources();
  readonly measurementCoordinator: ReadingMeasurementCoordinator = new ReadingMeasurementCoordinator(this.measurementRun);
  materializedChapterSelectionToken: number = -1;
  adjacentMeasurementContext: ReaderMaterializedChapterContext | undefined = undefined;
  readonly nativeMeasurement: ReaderReadingMeasurementNative;
  private readonly view: ReaderMeasureView;
  private readonly effects: ReaderMeasureEffects;
  private readonly images: ReaderMeasureImages;

  private readonly reverse: ReaderReversePagePorts;

  constructor(view: ReaderMeasureView, effects: ReaderMeasureEffects, images: ReaderMeasureImages, reverse: ReaderReversePagePorts) {
    this.reverse = reverse;
    this.view = view;
    this.effects = effects;
    this.images = images;
    const surface = new ReaderReadingMeasurementSurface(view.context, view.appearance, view.layout);
    this.nativeMeasurement = new ReaderReadingMeasurementNative(surface, this.nativeParagraphResources, this.measurementRun);
  }

  beginCanonicalModeMeasurement(anchor: number): void {
    const key = this.view.currentPaginationKey();
    const target = Math.max(this.nativeMeasurement.chapterRanges[0].startScalar, Math.min(this.lastMeasurableScalar(), anchor));
    const request = canonicalMeasuredPageRequest(this.physicalPagination.index, key,
      (): ReadingPaginationPrefix | undefined => this.physicalPagination.draft,
      (): number => this.nativeMeasurement.chapterRanges[0].startScalar, target);
    this.canonicalModeAnchor = request.unresolvedAnchor;
    this.desiredChapterOffset = request.offset;
    this.desiredChapterProgress = this.requireChapterLayoutMap().scalarCount() === 0 ? 0 :
      this.desiredChapterOffset / this.requireChapterLayoutMap().scalarCount();
    this.beginMeasurement(this.view.lifecycle());
  }

  private continueCanonicalModeMeasurement(page: PhysicalReadingPage, lifecycleToken: number): boolean {
    if (this.canonicalModeAnchor < 0) return false;
    if (page.endScalar <= this.canonicalModeAnchor && page.endScalar <= this.lastMeasurableScalar()) {
      this.desiredChapterOffset = page.endScalar;
      this.desiredChapterProgress = page.endScalar / this.requireChapterLayoutMap().scalarCount();
      this.measurementCompleting = false;
      this.beginMeasurement(lifecycleToken);
      return true;
    }
    // Intermediate head-prefix pages never publish or persist progress.
    this.canonicalModeAnchor = -1;
    return false;
  }

  private continuePreviousChapterMeasurement(
    measuredPage: PhysicalReadingPage,
    generation: number,
    selectionToken: number,
    lifecycleToken: number,
  ): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
    if (this.requireMeasurementChapter().chapterIndex !== pending.targetChapterIndex ||
      measuredPage.endScalar !== pending.endScalar) {
      this.recoverPreviousChapterMeasurement(new Error('PREVIOUS_PAGE_BOUNDARY_MISMATCH'), lifecycleToken); return;
    }
    if (pending.prepareOnly) {
      this.completePreviousChapterPreparation(pending, measuredPage); return;
    }
    this.previousChapterMeasurement = undefined;
    this.effects.armCompletionDeadline();
    void this.effects.completeFirstPage(measuredPage, generation, selectionToken, lifecycleToken);
  }

  private continuePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    previousChapterIndex: number,
  ): void {
    const origin = pending.origin;
    const targetChapter = this.reverse.window.get(previousChapterIndex);
    if (origin !== undefined && targetChapter === undefined &&
      pending.pageTurnGeneration === this.reverse.preparation().generation) {
      this.reverse.acquisition().requestPageTurnChapter('previous', previousChapterIndex);
      this.finishPreviousPagePreparationDiscovery();
      return;
    }
    if (origin === undefined || targetChapter === undefined ||
      pending.pageTurnGeneration !== this.reverse.preparation().generation) {
      this.recoverPreviousChapterMeasurement(
        new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_UNAVAILABLE'),
        this.view.lifecycle(),
      );
      return;
    }
    const targetMap = readingChapterLayoutMap(targetChapter);
    if (targetMap.scalarCount() === 0) {
      this.recoverPreviousChapterMeasurement(
        new Error('PREVIOUS_PAGE_PREPARATION_CHAPTER_EMPTY'),
        this.view.lifecycle(),
      );
      return;
    }
    this.reverse.admitNeighbourVersion(targetChapter.chapterIndex, targetChapter.contentVersion);
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      pending.originalChapterIndex,
      pending.originalChapterOffset,
      previousChapterIndex,
      true,
      origin,
      pending.pageTurnGeneration,
    );
    this.measurementCompleting = false;
    this.adjacentMeasurementContext = new ReaderMaterializedChapterContext(
      targetChapter,
      targetMap,
      targetChapter.contentVersion,
      [],
      undefined,
      0,
      0,
      -1,
    );
    this.beginMeasurement(this.view.lifecycle());
  }

  private completePreviousChapterPreparation(
    pending: PreviousChapterMeasurement,
    measuredPage: PhysicalReadingPage,
  ): void {
    const origin = pending.origin;
    if (origin === undefined) return;
    const targetContext = this.captureMeasurementChapterContext();
    const key = this.measurementPaginationKey();
    const prepared = new PreparedReaderPageTurn(
      'previous',
      measuredPage,
      targetContext,
      key,
      pending.originalChapterIndex,
      pending.originalChapterOffset,
      pending.pageTurnGeneration,
    );
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.physicalPagination.index.finishMeasurement();
    this.finishAdjacentMeasurementContext();
    this.effects.publishPhase('ready');
    if (pending.pageTurnGeneration === this.reverse.preparation().generation) {
      this.reverse.settlement().pageTurn.setNeighbour('previous', prepared);
      this.reverse.publishTurnRevision();
      this.reverse.resolvePageImages(targetContext.chapter, measuredPage.fragments);
    }
    this.reverse.releaseImages();
    this.reverse.input().drain();
    this.reverse.resumeAutomatic();
    this.reverse.resumeSpeech();
    this.reverse.preparation().resumeAfterTextureFrame();
  }

  private finishPreviousPagePreparationDiscovery(): void {
    this.previousChapterMeasurement = undefined;
    this.measurementCompleting = false;
    this.physicalPagination.index.finishMeasurement();
    this.finishAdjacentMeasurementContext();
    this.effects.publishPhase(this.page === undefined ? 'loading' : 'ready');
    this.reverse.releaseImages();
    this.reverse.input().drain();
    this.reverse.preparation().resumeAfterTextureFrame();
  }

  requireChapterLayoutMap(): ReadingSurfaceLayoutMap {
    if (this.chapterLayoutMap === undefined) {
      throw new Error('READING_LAYOUT_MAP_NOT_READY');
    }
    return this.chapterLayoutMap;
  }

  requireChapter(): ReadingSessionChapter {
    if (this.chapter === undefined) {
      throw new Error('READING_CHAPTER_NOT_LOADED');
    }
    return this.chapter;
  }

  isChapterFirstPageStart(startScalar: number): boolean {
    return (this.chapter?.documentRange?.startScalar ?? 0) === 0 &&
      this.nativeMeasurement.chapterRanges.length > 0 && startScalar === this.nativeMeasurement.chapterRanges[0].startScalar;
  }

  captureMaterializedChapterContext(): ReaderMaterializedChapterContext {
    const chapter = this.requireChapter();
    return new ReaderMaterializedChapterContext(
      chapter,
      this.requireChapterLayoutMap(),
      this.materializedContentVersion,
      this.copyParagraphRanges(this.nativeMeasurement.chapterRanges),
      this.physicalPagination.draft,
      this.desiredChapterOffset,
      this.desiredChapterProgress,
      this.physicalPagination.requestedAnchor,
    );
  }

  restoreMaterializedChapterContext(
    context: ReaderMaterializedChapterContext,
    admitWindowCurrent: boolean,
  ): void {
    this.chapter = context.chapter;
    this.images.indexChapter(context.chapter);
    this.chapterLayoutMap = context.layoutMap;
    this.materializedContentVersion = context.contentVersion;
    this.nativeMeasurement.chapterRanges.splice(0, this.nativeMeasurement.chapterRanges.length, ...this.copyParagraphRanges(context.paragraphRanges));
    this.physicalPagination.draft = context.paginationDraft;
    this.desiredChapterOffset = context.desiredChapterOffset;
    this.desiredChapterProgress = context.desiredChapterProgress;
    this.physicalPagination.requestedAnchor = context.measurementRequestedAnchorScalar;
    this.materializedChapterSelectionToken = this.reverse.selection();
    if (admitWindowCurrent) {
      this.effects.admitVisibleChapter(context.chapter);
    } else {
      this.reverse.window.admitNeighbour(context.chapter);
    }
    this.reverse.retainWindow();
  }

  finishAdjacentMeasurementContext(): void {
    const lane = this.adjacentMeasurementContext;
    if (lane !== undefined && lane.chapter.chapterIndex === this.chapter?.chapterIndex && lane.paginationDraft !== undefined &&
      lane.paginationDraft.matches(this.view.currentPaginationKey())) this.physicalPagination.draft = lane.paginationDraft;
    this.adjacentMeasurementContext = undefined;
  }

  startPreviousPagePreparationDiscovery(): boolean {
    const page = this.page;
    const chapter = this.chapter;
    if (!this.reverse.mounted() || page === undefined || chapter === undefined ||
      this.previousChapterMeasurement !== undefined || this.reverse.preparation().pending !== undefined ||
      this.nativeMeasurement.chapterRanges.length === 0 || !this.reverse.canTurn()) {
      return false;
    }
    const head = this.nativeMeasurement.chapterRanges[0].startScalar;
    const previousChapter = this.reverse.adjacentChapter(chapter.chapterIndex, -1);
    if (this.requireChapterLayoutMap().residentStart() === 0 && page.startScalar <= head) {
      if (previousChapter === undefined) return false;
      if (this.reverse.window.get(previousChapter) === undefined) {
        this.reverse.acquisition().requestPageTurnChapter('previous', previousChapter); return true;
      }
      const pending = new PreviousChapterMeasurement(chapter.chapterIndex, page.startScalar,
        chapter.chapterIndex, true, this.captureMaterializedChapterContext(), this.reverse.preparation().generation);
      this.continuePreviousChapterPreparation(pending, previousChapter);
      return this.view.phase() === 'measuring';
    }
    const origin = this.captureMaterializedChapterContext();
    this.adjacentMeasurementContext = this.captureMaterializedChapterContext();
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapter.chapterIndex,
      page.startScalar,
      chapter.chapterIndex,
      true,
      origin,
      this.reverse.preparation().generation,
    );
    this.setMeasuringOffset(page.startScalar);
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.setMeasuringProgress(scalarCount === 0 ? 0 : this.measuringOffset() / scalarCount);
    this.beginMeasurement(this.view.lifecycle());
    return this.view.phase() === 'measuring';
  }

  startPreviousChapterMeasurement(
    previousChapterIndex: number,
    originalChapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (!this.reverse.mounted() || this.previousChapterMeasurement !== undefined ||
      !this.reverse.knownChapter(previousChapterIndex)) {
      return false;
    }
    const lifecycleToken = this.view.lifecycle();
    const selectionToken = this.reverse.nextSelection();
    this.reverse.chapterPresentation().beginRetainedChapterPresentation(previousChapterIndex, lifecycleToken, selectionToken);
    this.reverse.acquisition().resetForChapterSelection(true);
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      originalChapterIndex,
      originalChapterOffset,
      previousChapterIndex,
    );
    this.reverse.firstPage().markOrdinaryPageMeasurement(previousChapterIndex, this.reverse.selection(), this.view.lifecycle());
    this.reverse.clearRestoredProgress();
    // The current committed page remains visible, so the per-page measurement
    // deadline is sufficient; do not arm the first-entry blank-screen deadline.
    void this.reverse.acquisition().openChapter(previousChapterIndex, false, lifecycleToken, selectionToken, Number.MAX_SAFE_INTEGER);
    return true;
  }

  startCurrentChapterPredecessorMeasurement(
    chapterIndex: number,
    originalChapterOffset: number,
  ): boolean {
    if (!this.reverse.mounted() || this.previousChapterMeasurement !== undefined ||
      this.chapter === undefined || this.chapter.chapterIndex !== chapterIndex ||
      this.nativeMeasurement.chapterRanges.length === 0) {
      return false;
    }
    this.previousChapterMeasurement = new PreviousChapterMeasurement(
      chapterIndex,
      originalChapterOffset,
      chapterIndex,
    );
    this.reverse.firstPage().markOrdinaryPageMeasurement(chapterIndex, this.reverse.selection(), this.view.lifecycle());
    this.desiredChapterOffset = originalChapterOffset;
    const scalarCount = this.requireChapterLayoutMap().scalarCount();
    this.desiredChapterProgress = scalarCount === 0 ? 0 : this.desiredChapterOffset / scalarCount;
    this.beginMeasurement(this.view.lifecycle());
    return true;
  }

  recoverPreviousChapterMeasurement(error: Error, lifecycleToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || !this.view.sessionActive(lifecycleToken)) {
      return;
    }
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience previous chapter measurement failed: ${error.message}`);
    if (pending.prepareOnly) {
      this.previousChapterMeasurement = undefined;
      this.physicalPagination.index.invalidateMeasurement();
      this.measurementCompleting = false;
      this.batchProcessing = false;
      this.nativeMeasurement.clear();
      this.nativeMeasurement.clearBatch();
      this.resetPendingPage();
      this.measurementRun.cancelDeadline();
      this.effects.invalidateHiddenMeasurementTree();
      this.adjacentMeasurementContext = undefined;
      this.effects.publishPhase(this.page === undefined ? 'loading' : 'ready');
      this.reverse.settlement().pageTurn.reachBoundary('previous');
      this.reverse.preparation().remove('previous');
      this.reverse.publishTurnRevision();
      this.reverse.releaseImages();
      this.reverse.scheduleTexture();
      return;
    }
    this.previousChapterMeasurement = undefined;
    const selectionToken = this.reverse.nextSelection();
    this.reverse.chapterPresentation().beginRetainedChapterPresentation(pending.originalChapterIndex, lifecycleToken, selectionToken);
    this.reverse.acquisition().resetForChapterSelection(true);
    this.reverse.clearRestoredProgress();
    // Re-establish the materialized owner behind the unchanged visible page.
    // Its previously committed Core anchor remains valid throughout recovery.
    void this.reverse.acquisition().openChapter(
      pending.originalChapterIndex,
      false,
      lifecycleToken,
      selectionToken,
      pending.originalChapterOffset,
    );
  }

  private resident: ReaderResidentMeasuredPage = { page: undefined, selection: -1 };

  get page(): PhysicalReadingPage | undefined { return this.resident.page; }
  get selection(): number { return this.resident.selection; }

  owns(page: PhysicalReadingPage, selection: number): boolean {
    return this.resident.page === page && this.resident.selection === selection;
  }

  admit(page: PhysicalReadingPage, selection: number): void {
    this.resident = { page, selection };
  }

  clearPage(): void {
    this.resident = { page: undefined, selection: this.resident.selection };
  }

  publishFirstPage(page: PhysicalReadingPage, lifecycle: number, selection: number,
    surface: ReaderFirstPageSurfacePublication): void {
    this.admit(page, selection);
    surface.publishBody(page);
    surface.clearLoadingTarget();
    if (surface.continuous()) surface.presentContinuous(page);
    surface.finishRetained(lifecycle, selection);
    surface.releaseUnretainedImages();
  }

  currentMeasurementGeneration(): number { return this.physicalPagination.index.measurementGeneration(); }

  currentMeasurementSelection(): number { return this.physicalPagination.index.measurementSelection(); }

  measureNativeTextBatch(): void {
    this.nativeMeasurement.beginBatch((): boolean => this.measurementIncludesChapterTitle(),
      (): string => this.requireMeasurementChapter().chapterTitle);
  }

  beginMeasurement(lifecycleToken: number): void {
    this.measurementCoordinator.begin({
      isActive: (): boolean => this.view.sessionActive(lifecycleToken),
      hasViewport: (): boolean => this.view.hasMeasuredViewport(),
      isCompleting: (): boolean => this.measurementCompleting,
      defer: (): void => { this.measurementCoordinator.deferMeasurement(); },
      captureContent: (): ReadingMeasurementContent | undefined => {
        const chapter = this.measuringChapter();
        const selectionToken = this.materializedChapterSelectionToken;
        if (chapter === undefined || !this.view.selectionCurrent(selectionToken)) return undefined;
        return {
          prepare: (): void => {
            this.effects.retainNativeParagraphResources();
            this.nativeMeasurement.clear();
            this.nativeMeasurement.clearBatch();
            if (this.measuringRanges().length === 0) this.collectParagraphRanges(chapter.content);
          },
          hasParagraphs: (): boolean => this.measuringRanges().length > 0,
          hasPreviousPage: (): boolean => this.previousChapterMeasurement !== undefined,
          document: (): ReadingMeasurementDocument => ({ offset: this.measuringOffset(), content: chapter.content,
            map: this.requireMeasurementLayoutMap(), ranges: this.measuringRanges() }),
          measurePrevious: (): void => this.beginReversePageMeasurement(lifecycleToken, selectionToken),
          expand: (direction: 'before' | 'after'): void => {
            this.physicalPagination.index.beginMeasurement(selectionToken);
            this.effects.publishPhase('measuring');
            this.expandMeasurementParagraphWindow(direction, this.currentMeasurementGeneration(), selectionToken, lifecycleToken);
          },
          measureForward: (start: ReadingMeasurementStart): void => this.beginForwardMeasurement(start, selectionToken, lifecycleToken),
        };
      },
      retry: (error: Error): boolean => this.retryNativeTextLayout(error, lifecycleToken),
      fail: (error: Error): void => this.effects.fail(error, lifecycleToken),
    });
  }

  beginForwardMeasurement(start: ReadingMeasurementStart, selectionToken: number, lifecycleToken: number): void {
    this.setMeasuringOffset(start.offset);
    this.setMeasuringProgress(start.progress);
    this.setMeasuringRequestedAnchor(start.offset);
    this.nativeMeasurement.resetTitle();
    this.measurementRun.beginForwardGates();
    this.nativeMeasurement.startForward(this.measuringRanges(), this.measuringOffset());
    this.resetPendingPage();
    // Leave the old measured page mounted behind Full Directory until the
    // admitted replacement can publish its title and body together.
    if (this.page === undefined || this.view.visibleFragments().length === 0) {
      this.clearPage();
      this.effects.clearVisibleFragments();
      this.effects.hideChapterTitle();
      this.effects.ensureReadyDeadline(lifecycleToken, selectionToken);
    }
    this.physicalPagination.index.beginMeasurement(selectionToken);
    this.measurementRun.beginNativeLayout();
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.effects.publishPhase('measuring');
    if (!this.prepareNextMeasurementBatch()) throw new Error('PAGINATION_NO_MEASUREMENT_BATCH');
    this.effects.invalidateHiddenMeasurementTree();
    this.armMeasurementDeadline(this.currentMeasurementGeneration(), selectionToken, lifecycleToken);
    this.measureNativeTextBatch();
    this.captureMeasurementAfterLayout();
  }

  retryNativeTextLayout(error: Error, lifecycleToken: number): boolean {
    return this.measurementRun.retryLayout(error, (): boolean => this.view.sessionActive(lifecycleToken),
      (): (() => boolean) => {
        const generation = this.currentMeasurementGeneration();
        const selection = this.currentMeasurementSelection();
        return (): boolean => this.isMeasurementCurrent(generation, selection, lifecycleToken);
      }, (): void => this.beginMeasurement(lifecycleToken));
  }

  captureMeasurementAfterLayout(): void {
    const lifecycleToken = this.view.lifecycle();
    const generation = this.currentMeasurementGeneration();
    const selectionToken = this.currentMeasurementSelection();
    this.measurementCoordinator.captureLayout({
      isCurrent: (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) &&
        !this.measurementCompleting && !this.batchProcessing,
      readUnicode: (): ReaderUnicodeMeasurement => this.nativeMeasurement.readUnicode(),
      captureTitle: (): boolean => this.captureChapterTitleMeasurementAfterLayout(lifecycleToken),
      hasBatch: (): boolean => this.nativeMeasurement.hasBatch,
      consumeBatch: (): void => {
        this.batchProcessing = true;
        this.consumeMeasuredBatch(generation, selectionToken, lifecycleToken);
      },
      trace: (message: string): void => console.info(message),
      fail: (error: Error): void => this.effects.fail(error, lifecycleToken),
    });
  }

  reportMeasurementGatePending(probeOk: boolean, titleOk: boolean, batchOk: boolean): void {
    const message = this.measurementRun.pendingDiagnostic(probeOk, titleOk, batchOk);
    if (message !== undefined) console.info(message);
  }

  consumeMeasuredBatch(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        return;
      }
      if (this.previousChapterMeasurement !== undefined) {
        this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken);
        return;
      }
      const result = this.nativeMeasurement.advanceBatch(this.physicalPagination,
        (): number | undefined => this.measuredPageEndLimit(),
        (paragraph: MeasurementParagraph, batchIndex: number, knownEnd: number | undefined): ReaderMeasuredParagraphResult => {
          const image = this.images.forParagraph(paragraph);
          return image === undefined ? this.consumeForwardMeasuredText(paragraph, batchIndex, knownEnd) :
            this.consumeForwardMeasuredImage(image, batchIndex, generation, selectionToken, lifecycleToken);
        }, (): boolean => this.prepareNextMeasurementBatch());
      if (result === 'waiting') return;
      if (result === 'next-batch') {
        this.batchProcessing = false;
        this.effects.invalidateHiddenMeasurementTree();
        this.measureNativeTextBatch();
        this.captureMeasurementAfterLayout();
        return;
      }
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
        if (this.retryNativeTextLayout(error as Error, lifecycleToken)) return;
        this.effects.fail(error as Error, lifecycleToken);
      }
    }
  }

  consumeForwardMeasuredImage(bodyImage: ReadingSessionImage, batchIndex: number,
    generation: number, selectionToken: number, lifecycleToken: number): ReaderMeasuredParagraphResult {
    const plan = planForwardMeasuredImage(bodyImage, this.physicalPagination, {
      capacity: (_: number): number => this.pendingPageBodyCapacity(),
      lineHeight: (): number => readerAppearanceLineHeight(this.view.appearance()),
      paragraphSpacing: (): number => this.view.appearance().paragraphSpacing,
      scaledHeight: (capacity: number): number => this.images.scaledHeight(bodyImage, capacity),
    });
    if (plan.result === 'page-ready') return 'page-ready';
    if (plan.result === 'waiting') {
      // Leave only the image and unconsumed suffix for the decode resume.
      this.nativeMeasurement.retainBatchSuffix(batchIndex);
      this.images.resolvePending(bodyImage, generation, selectionToken, lifecycleToken);
      return 'waiting';
    }
    this.physicalPagination.appendFragment(
      this.measuredImageFragment(this.requireMeasurementChapter().chapterIndex, bodyImage, plan.height),
      bodyImage.startScalar, bodyImage.endScalar, plan.height, true, this.view.appearance().paragraphSpacing);
    return 'continue';
  }

  measuredImageFragment(chapterIndex: number, image: ReadingSessionImage, height: number): ReadingSurfacePageFragment {
    return new ReadingSurfacePageFragment(
      `chapter-${chapterIndex}:image:${image.startScalar}-${image.endScalar}`, '', true, image.startScalar, image.endScalar,
      image.state === 'ready' ? image.pixelMap : undefined, height,
      image.state === 'ready' ? image.fileUri : undefined, height, image.imageWidthBasisPoints);
  }

  consumeForwardMeasuredText(paragraph: MeasurementParagraph, batchIndex: number,
    knownEnd: number | undefined): ReaderMeasuredParagraphResult {
    const measurement = new ReaderForwardParagraphMeasurement(knownEnd,
      (): number => this.requireMeasurementChapter().chapterIndex, (): number => this.pendingPageBodyCapacity(),
      (): boolean => this.previousChapterMeasurement !== undefined,
      (): boolean => this.view.continuous());
    const result = this.nativeMeasurement.packForward(paragraph, batchIndex, this.physicalPagination, measurement);
    if (result === 'waiting') {
      // Preserve admitted fragments while the next controller becomes ready.
      this.nativeMeasurement.retainBatchSuffix(batchIndex);
      this.batchProcessing = false;
      this.reportMeasurementGatePending(true, true, false);
    }
    return result;
  }

  hasValidUnicodeProbe(lifecycleToken: number): boolean {
    return this.measurementRun.validateUnicode((): ReaderUnicodeMeasurement => this.nativeMeasurement.readUnicode(),
      (error: Error): void => this.effects.fail(error, lifecycleToken), (message: string): void => console.info(message));
  }

  measurementIncludesChapterTitle(): boolean {
    const chapter = this.measuringChapter();
    return chapter !== undefined && chapter.chapterTitle.length > 0 &&
      this.isMeasurementChapterFirstPageStart(this.measuringRequestedAnchor());
  }

  captureChapterTitleMeasurementAfterLayout(lifecycleToken: number): boolean {
    return this.nativeMeasurement.captureTitle(this.measurementIncludesChapterTitle(),
      (): string => this.requireMeasurementChapter().chapterTitle,
      (error: Error): void => this.effects.fail(error, lifecycleToken));
  }

  beginReversePageMeasurement(lifecycleToken: number, selectionToken: number): void {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined) return;
    const map = this.requireMeasurementLayoutMap();
    if (pending.endScalar < 0) pending.endScalar = this.measurementCoordinator.reverseEnd(pending, map,
      this.measuringDraft(), (): ReadingPaginationKey => this.measurementPaginationKey());
    this.resetPendingPage();
    this.physicalPagination.endScalar = pending.endScalar;
    this.setMeasuringRequestedAnchor(pending.endScalar);
    this.nativeMeasurement.resetTitle();
    pending.nextRangeIndex = this.nativeMeasurement.previousRangeIndex(this.measuringRanges(), pending.endScalar);
    this.physicalPagination.index.beginMeasurement(selectionToken);
    this.measurementCompleting = false;
    this.batchProcessing = false;
    this.effects.publishPhase('measuring');
    this.effects.invalidateHiddenMeasurementTree();
    const generation = this.currentMeasurementGeneration();
    this.armMeasurementDeadline(generation, selectionToken, lifecycleToken);
    const expansion = this.measurementCoordinator.reverseExpansion(map, pending.endScalar, pending.nextRangeIndex);
    if (expansion !== undefined) {
      this.expandMeasurementParagraphWindow(expansion, generation, selectionToken, lifecycleToken);
      return;
    }
    if (!this.preparePreviousMeasurementParagraph()) throw new Error('PAGINATION_NO_PREVIOUS_PAGE');
    this.measureNativeTextBatch();
    this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken);
  }

  preparePreviousMeasurementParagraph(): boolean {
    const pending = this.previousChapterMeasurement;
    if (pending === undefined || pending.nextRangeIndex < 0) return false;
    const next = this.nativeMeasurement.preparePrevious(this.requireMeasurementChapter().content,
      this.measuringRanges(), pending.nextRangeIndex);
    if (next === undefined) return false;
    pending.nextRangeIndex = next;
    return true;
  }

  reversePageCapacityAt(startScalar: number): number {
    if (!this.isMeasurementChapterFirstPageStart(startScalar)) return this.view.layout().bodyHeightAfterTitle(0);
    const requested = this.measuringRequestedAnchor();
    this.setMeasuringRequestedAnchor(startScalar);
    try {
      this.nativeMeasurement.measureTitle((): boolean => this.measurementIncludesChapterTitle(),
        (): string => this.requireMeasurementChapter().chapterTitle);
      if (!this.captureChapterTitleMeasurementAfterLayout(this.view.lifecycle()))
        throw new Error('PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE');
      return this.view.layout().bodyHeightAfterTitle(this.nativeMeasurement.titleHeight());
    } finally { this.setMeasuringRequestedAnchor(requested); }
  }

  consumeReversePageParagraph(generation: number, selectionToken: number, lifecycleToken: number): void {
    try {
      if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) return;
      const pending = this.previousChapterMeasurement;
      const paragraph = this.nativeMeasurement.firstParagraph;
      if (pending === undefined || paragraph === undefined) return;
      if (!this.hasValidUnicodeProbe(lifecycleToken)) return;
      const image = this.images.forParagraph(paragraph);
      let full = false;
      if (image !== undefined) {
        const plan = planReverseMeasuredImage(image, pending.endScalar, this.physicalPagination, {
          capacity: (start: number): number => this.reversePageCapacityAt(start),
          lineHeight: (): number => readerAppearanceLineHeight(this.view.appearance()),
          paragraphSpacing: (): number => this.view.appearance().paragraphSpacing,
          scaledHeight: (capacity: number): number => this.images.scaledHeight(image, capacity),
        });
        if (plan.result === 'waiting') {
          this.images.resolvePending(image, generation, selectionToken, lifecycleToken); return;
        }
        full = plan.result === 'page-ready';
        if (plan.result === 'admitted') {
          this.physicalPagination.prependFragments([this.measuredImageFragment(pending.targetChapterIndex, image, plan.height)],
            image.startScalar, plan.height, this.view.appearance().paragraphSpacing);
        }
      } else {
        const measurement = new ReaderReverseParagraphMeasurement(pending.targetChapterIndex, pending.endScalar,
          (startScalar: number): number => this.reversePageCapacityAt(startScalar));
        full = this.nativeMeasurement.packReverse(paragraph, this.physicalPagination, measurement);
      }
      this.nativeMeasurement.clear(); this.nativeMeasurement.clearBatch();
      if (!full && this.preparePreviousMeasurementParagraph()) {
        this.consumeReversePageParagraph(generation, selectionToken, lifecycleToken); return;
      }
      if (!full && this.requireMeasurementLayoutMap().residentStart() > 0) {
        this.expandMeasurementParagraphWindow('before', generation, selectionToken, lifecycleToken); return;
      }
      if (this.physicalPagination.fragments.length === 0) throw new Error('PAGINATION_NO_PREVIOUS_PAGE');
      this.setMeasuringOffset(this.physicalPagination.startScalar);
      this.setMeasuringRequestedAnchor(this.physicalPagination.startScalar);
      this.beginFirstPageCommit(generation, selectionToken, lifecycleToken);
    } catch (error) {
      if (this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) this.effects.fail(error as Error, lifecycleToken);
    }
  }

  measuredPageEndLimit(): number | undefined {
    const draft = this.measuringDraft();
    const key = this.measurementPaginationKey();
    const request = this.measuringRequestedAnchor();
    if (draft !== undefined && draft.matches(key)) {
      const observed = draft.observationForRequest(request) ?? draft.observationForPageStart(request);
      if (observed !== undefined) return observed.endScalarExclusive;
    }
    const indexed = this.physicalPagination.index.findContainingPage(key, request);
    return indexed?.startScalar === request ? indexed.endScalarExclusive : undefined;
  }

  retainMeasuredParagraphWindow(page: PhysicalReadingPage): void {
    const chapter = this.requireMeasurementChapter();
    if (chapter.documentRange === undefined || this.canonicalModeAnchor >= 0) return;
    const retained = projectRetainedReadingParagraphWindow(chapter, this.measuringRanges(),
      page.startScalar, page.endScalar, (): ReadingSurfaceLayoutMap => this.requireMeasurementLayoutMap());
    if (retained !== undefined) {
      this.admitMeasurementParagraphWindow(retained.chapter, retained, this.adjacentMeasurementContext);
    }
  }

  admitMeasurementParagraphWindow(chapter: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection,
    lane: ReaderMaterializedChapterContext | undefined): void {
    if (lane === undefined) {
      this.chapter = chapter; this.chapterLayoutMap = projection.map; this.nativeMeasurement.chapterRanges = projection.ranges;
      this.effects.admitVisibleChapter(chapter); this.images.indexChapter(chapter);
    } else {
      lane.chapter = chapter; lane.layoutMap = projection.map; lane.paragraphRanges = projection.ranges;
    }
  }

  expandMeasurementParagraphWindow(direction: 'before' | 'after',
    generation: number, selectionToken: number, lifecycleToken: number): void {
    const chapter = this.requireMeasurementChapter();
    const lane = this.adjacentMeasurementContext;
    const pending = this.previousChapterMeasurement;
    this.effects.expandParagraphWindow({
      chapter, lifecycleToken, selectionToken, direction,
      current: (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) &&
        this.measuringChapter() === chapter && this.adjacentMeasurementContext === lane &&
        this.previousChapterMeasurement === pending,
      retireWorkingMeasurement: (): void => {
        this.measurementRun.cancelDeadline();
        this.nativeMeasurement.clear();
        this.nativeMeasurement.clearBatch();
        this.batchProcessing = false;
      },
      admit: (expanded: ReadingSessionChapter, projection: ReadingChapterMeasurementProjection): void => {
        this.admitMeasurementParagraphWindow(expanded, projection, lane);
        this.measurementCompleting = false;
        this.beginMeasurement(lifecycleToken);
      },
      mayReopenVisibleChapter: (): boolean => lane === undefined && pending === undefined && this.view.noPendingSelection(),
      offset: (): number => this.measuringOffset(),
      recover: (error, failedChapter, current, recovery): Promise<void> =>
        this.measurementRun.recoverWindow(error, failedChapter, current, recovery),
    });
  }

  retireWorkingSelection(): void {
    this.previousChapterMeasurement = undefined;
    this.physicalPagination.index.invalidateMeasurement();
    this.materializedChapterSelectionToken = -1;
    this.measurementCompleting = false;
    this.measurementCoordinator.clearDeferredRequest();
    this.batchProcessing = false;
    this.nativeMeasurement.clear();
    this.nativeMeasurement.clearBatch();
    this.nativeMeasurement.chapterRanges.length = 0;
  }

  retireMaterializedSelection(): void {
    this.resetPendingPage();
    this.nativeMeasurement.resetBatchCursor();
    this.chapter = undefined;
    this.chapterLayoutMap = undefined;
    this.materializedContentVersion = '';
    this.desiredChapterOffset = 0;
    this.desiredChapterProgress = 0;
    this.resetPaginationDraft();
  }

  beginFirstPageCommit(generation: number, selectionToken: number, lifecycleToken: number): void {
    if (!this.isMeasurementCurrent(generation, selectionToken, lifecycleToken)) {
      return;
    }
    const admission = admitMeasuredPageEnd(this.physicalPagination, {
      residentRange: (): ReadingDocumentRange | undefined => this.measuringChapter()?.documentRange,
      isReverse: (): boolean => this.previousChapterMeasurement !== undefined,
      knownEnd: (): number | undefined => this.measuredPageEndLimit(),
      gapText: (start: number, end: number): string => this.requireMeasurementLayoutMap().sliceByScalar(start, end),
      lastMeasurable: (): number => this.lastMeasurableScalar(),
    });
    if (admission === 'empty') {
      this.effects.fail(new Error('PAGINATION_NO_PHYSICAL_PAGE'), lifecycleToken);
      return;
    }
    if (admission === 'expand-after') {
      this.expandMeasurementParagraphWindow('after', generation, selectionToken, lifecycleToken);
      return;
    }
    const measuredTitle = this.nativeMeasurement.title();
    if (measuredTitle !== undefined && this.measurementIncludesChapterTitle() && this.physicalPagination.fragments.length > 0) {
      this.physicalPagination.fragments[0].nativeTitle = measuredTitle;
    }
    const page = new PhysicalReadingPage(
      [...this.physicalPagination.fragments],
      this.physicalPagination.startScalar,
      this.physicalPagination.endScalar,
      this.physicalPagination.height,
      this.pendingPageBodyCapacity(),
      copyReaderAppearanceSnapshot(this.view.appearance()),
    );
    this.observeMeasuredPhysicalPage(page);
    this.retainMeasuredParagraphWindow(page);
    this.nativeMeasurement.clear();
    this.nativeMeasurement.clearBatch();
    this.batchProcessing = false;
    this.measurementCompleting = true;
    this.measurementRun.cancelDeadline();
    // Unmount the hidden controller tree while Core resolves and stores the
    // actual visible scalar anchor.  No subsequent batch exists in memory.
    this.effects.invalidateHiddenMeasurementTree();
    if (this.view.preparationPending()) {
      this.effects.completePreparedPageTurn(page, generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.previousChapterMeasurement !== undefined) {
      this.continuePreviousChapterMeasurement(page, generation, selectionToken, lifecycleToken);
      return;
    }
    if (this.continueCanonicalModeMeasurement(page, lifecycleToken)) return;
    this.effects.recordFirstLayout(lifecycleToken);
    this.effects.armCompletionDeadline();
    void this.effects.completeFirstPage(page, generation, selectionToken, lifecycleToken);
  }

  observeMeasuredPhysicalPage(page: PhysicalReadingPage): void {
    if (this.measuringRanges().length === 0 || this.measuringRequestedAnchor() < 0) {
      this.resetMeasurementPaginationDraft();
      return;
    }
    const chapter = this.requireMeasurementChapter();
    const map = this.requireMeasurementLayoutMap();
    const ranges = this.measuringRanges();
    const result = this.physicalPagination.observe(page, {
      key: this.measurementPaginationKey(), requestedAnchor: this.measuringRequestedAnchor(),
      chapterStartRequest: ranges.length === 0 ? undefined : ranges[0].startScalar,
      draft: this.measuringDraft(), previousChapterMeasurement: this.previousChapterMeasurement !== undefined,
      lastVisibleScalar: this.view.lastVisibleScalar(chapter.content, map), contentScalarLength: map.scalarCount(),
      partialDocument: chapter.documentRange !== undefined,
    });
    this.setMeasuringDraft(result.draft);
    if (result.completed) this.setMeasuringRequestedAnchor(-1);
  }

  resetPaginationDraft(): void {
    this.physicalPagination.resetDraft();
  }

  collectParagraphRanges(content: string): void {
    const chapterMap = this.requireMeasurementLayoutMap();
    const ranges = collectReadingParagraphUtf16Ranges(
      content,
      readingParagraphBoundaryMode(this.view.sourceId(), this.view.bookKind()),
    );
    for (const range of ranges) {
      this.appendParagraphRange(range.startUtf16, range.endUtf16, chapterMap);
    }
  }

  appendParagraphRange(
    startUtf16: number,
    endUtf16: number,
    chapterMap: ReadingSurfaceLayoutMap,
  ): void {
    if (endUtf16 <= startUtf16) {
      return;
    }
    // A separator followed only by trailing whitespace is not a measurable
    // paragraph. Keeping it would allow an EOF restore to start a physical
    // page from an empty line.
    const content = this.requireMeasurementChapter().content;
    if (content.substring(startUtf16, endUtf16).trim().length === 0) {
      return;
    }
    const index = this.measuringRanges().length;
    this.measuringRanges().push(new ParagraphRange(
      `paragraph-${index}-${startUtf16}`,
      startUtf16,
      endUtf16,
      chapterMap.scalarForUtf16(startUtf16),
      chapterMap.scalarForUtf16(endUtf16),
    ));
  }

  prepareNextMeasurementBatch(): boolean {
    const chapter = this.requireMeasurementChapter();
    this.requireMeasurementLayoutMap();
    return this.nativeMeasurement.prepareForward(chapter.content, this.measuringRanges());
  }

  lastMeasurableScalar(): number {
    return lastMeasurableParagraphScalar(this.requireMeasurementChapter().content,
      this.requireMeasurementLayoutMap(), this.measuringRanges());
  }

  resetPendingPage(): void {
    this.physicalPagination.resetPage();
  }

  pendingPageBodyCapacity(): number {
    const pageStartScalar = this.physicalPagination.startScalar >= 0 ?
      this.physicalPagination.startScalar : this.measuringRequestedAnchor();
    if (!this.measurementIncludesChapterTitle() || !this.isMeasurementChapterFirstPageStart(pageStartScalar)) {
      return this.view.layout().bodyHeightAfterTitle(0);
    }
    if (!Number.isFinite(this.nativeMeasurement.titleHeight()) || this.nativeMeasurement.titleHeight() <= 0) {
      throw new Error('PAGINATION_CHAPTER_TITLE_MEASUREMENT_INVALID');
    }
    return this.view.layout().bodyHeightAfterTitle(this.nativeMeasurement.titleHeight());
  }

  resumeDeferredMeasurement(lifecycleToken: number): void {
    this.measurementCoordinator.resumeDeferred(this.view.sessionActive(lifecycleToken),
      (): void => this.resetPaginationDraft(), (): void => this.beginMeasurement(lifecycleToken));
  }

  armMeasurementDeadline(generation: number, selectionToken: number, lifecycleToken: number): void {
    this.measurementRun.armDeadline(
      (): boolean => this.isMeasurementCurrent(generation, selectionToken, lifecycleToken) && !this.measurementCompleting,
      (error: Error): void => this.effects.fail(error, lifecycleToken));
  }

  measuringChapter(): ReadingSessionChapter | undefined {
    return this.adjacentMeasurementContext === undefined ? this.chapter : this.adjacentMeasurementContext.chapter;
  }

  measuringLayoutMap(): ReadingSurfaceLayoutMap | undefined {
    return this.adjacentMeasurementContext === undefined ? this.chapterLayoutMap : this.adjacentMeasurementContext.layoutMap;
  }

  measuringRanges(): ParagraphRange[] {
    return this.adjacentMeasurementContext === undefined ? this.nativeMeasurement.chapterRanges : this.adjacentMeasurementContext.paragraphRanges;
  }

  measuringDraft(): ReadingPaginationPrefix | undefined {
    return this.adjacentMeasurementContext === undefined ? this.physicalPagination.draft : this.adjacentMeasurementContext.paginationDraft;
  }

  setMeasuringDraft(value: ReadingPaginationPrefix | undefined): void {
    if (this.adjacentMeasurementContext === undefined) this.physicalPagination.draft = value;
    else this.adjacentMeasurementContext.paginationDraft = value;
  }

  measuringOffset(): number {
    return this.adjacentMeasurementContext === undefined ? this.desiredChapterOffset : this.adjacentMeasurementContext.desiredChapterOffset;
  }

  setMeasuringOffset(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.desiredChapterOffset = value;
    else this.adjacentMeasurementContext.desiredChapterOffset = value;
  }

  measuringProgress(): number {
    return this.adjacentMeasurementContext === undefined ? this.desiredChapterProgress : this.adjacentMeasurementContext.desiredChapterProgress;
  }

  setMeasuringProgress(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.desiredChapterProgress = value;
    else this.adjacentMeasurementContext.desiredChapterProgress = value;
  }

  measuringRequestedAnchor(): number {
    return this.adjacentMeasurementContext === undefined ? this.physicalPagination.requestedAnchor : this.adjacentMeasurementContext.measurementRequestedAnchorScalar;
  }

  setMeasuringRequestedAnchor(value: number): void {
    if (this.adjacentMeasurementContext === undefined) this.physicalPagination.requestedAnchor = value;
    else this.adjacentMeasurementContext.measurementRequestedAnchorScalar = value;
  }

  requireMeasurementChapter(): ReadingSessionChapter {
    const chapter = this.measuringChapter();
    if (chapter === undefined) throw new Error('READING_CHAPTER_NOT_LOADED');
    return chapter;
  }

  requireMeasurementLayoutMap(): ReadingSurfaceLayoutMap {
    const map = this.measuringLayoutMap();
    if (map === undefined) throw new Error('READING_LAYOUT_MAP_NOT_READY');
    return map;
  }

  measurementPaginationKey(): ReadingPaginationKey {
    const lane = this.adjacentMeasurementContext;
    if (lane === undefined) return this.view.currentPaginationKey();
    return { sourceId: this.view.sourceId(), bookId: this.view.bookId(), chapterIndex: lane.chapter.chapterIndex,
      contentVersion: lane.contentVersion, layoutSignature: this.view.layoutSignature() };
  }

  resetMeasurementPaginationDraft(): void {
    this.setMeasuringDraft(undefined);
    this.setMeasuringRequestedAnchor(-1);
  }

  isMeasurementChapterFirstPageStart(start: number): boolean {
    return (this.measuringChapter?.()?.documentRange?.startScalar ?? 0) === 0 &&
      this.measuringRanges().length > 0 && start === this.measuringRanges()[0].startScalar;
  }

  captureMeasurementChapterContext(): ReaderMaterializedChapterContext {
    return this.adjacentMeasurementContext ?? this.captureMaterializedChapterContext();
  }

  copyParagraphRanges(ranges: ParagraphRange[]): ParagraphRange[] {
    return ranges.map((range: ParagraphRange): ParagraphRange => new ParagraphRange(
      range.id,
      range.startUtf16,
      range.endUtf16,
      range.startScalar,
      range.endScalar,
    ));
  }

  isMeasurementCurrent(generation: number, selectionToken: number, lifecycleToken: number): boolean {
    return this.view.sessionActive(lifecycleToken) && this.physicalPagination.index.isMeasurementCurrent(generation, selectionToken) && this.view.selectionCurrent(selectionToken) &&
      this.materializedChapterSelectionToken === selectionToken && this.view.phase() === 'measuring';
  }
}
