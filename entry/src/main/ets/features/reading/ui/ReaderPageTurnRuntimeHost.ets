import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderProgressProducerHost } from '../application/ReaderProgressProducerHost';
import { readerPageTransitionUsesPreparedPages, readerPageTurnStyle, type ReaderPageTurnStyle,
  type ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import { lastVisibleReadingScalar } from '../application/ReadingChapterOpening';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingExitProgressCoordinator, ReadingProgressIdentity } from '../application/ReadingExitProgressCoordinator';
import type { CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import type { ReaderPreparedNeighbourOwner, ReadingPageTurnCoordinator } from '../application/ReadingPageTurnCoordinator';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import type { ReaderPreparedPageSettlement } from '../application/ReaderPreparedPageSettlement';
import type { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { LocalReadingProgress } from '../application/LocalReadingFlowGateway';
import type { ReaderDeferredChapterSelection } from '../presentation/ReaderChapterSelectionOwner';
import type { ReaderAutomaticPageStart, ReaderMaterializedChapterContext,
  PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import { stopBookTurnMotion } from './BookTurnMotionState';
import type { BookTurnNativeEvent, BookTurnPresentationSession } from './BookTurnPresentationSession';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import type { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAutoPageState } from './ReaderAutoPageState';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import { cancelReaderPagePan, createReaderPageGestureState,
  type ReaderPageGesturePhase, type ReaderPageTurnDirection } from './ReaderPageGestureState';
import { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import { ReaderPageTurnNativeHost, ReaderPageTurnTextureGate, ReaderPageTurnTextureGeometry } from './ReaderPageTurnNativeHost';
import { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import { ReaderPageTurnSettlementHost, type ReaderPageTurnDeferredEffects,
  type ReaderSettledPageOrigin } from './ReaderPageTurnSettlementHost';
import type { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReaderAdjacentPageEvidence, ReaderPageTurnTarget } from './ReaderPhysicalPaginationOwner';
import type { ReadingPageTurnRenderSnapshot, ReadingPageTurnRenderUpdate, ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import { readerBookTurnRuntimeSpec, type ReaderBookTurnRuntimeSpec } from './ReaderRenderStageSpec';
import type { ReaderSessionCapsuleSnapshot } from './ReaderSessionCapsuleModel';
import type { ReaderPageTurnOrigin, ReaderTtsFollowLease } from './ReaderTtsPageFollow';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';

export interface ReaderPageTurnRuntimeScene {
  readonly lifecycle: () => number;
  readonly selection: () => number;
  readonly mounted: () => boolean;
  readonly isMountedToken: (lifecycle: number) => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly exiting: () => boolean;
  readonly foreground: () => boolean;
  readonly identity: () => ReadingProgressIdentity;
  readonly phase: () => 'loading' | 'measuring' | 'ready' | 'failed';
  readonly interactionEnabled: () => boolean;
  readonly controlVisible: () => boolean;
  readonly controlObscured: () => boolean;
  readonly interactionBlocked: () => boolean;
  readonly windowPolicyPending: () => boolean;
  readonly speechFollowCurrent: (lease: ReaderTtsFollowLease) => boolean;
}

export interface ReaderPageTurnRuntimeDocument {
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly currentChapter: () => number;
  readonly currentPaginationKey: () => ReadingPaginationKey;
  readonly paginationKey: (chapter: number) => ReadingPaginationKey | undefined;
  readonly paginationLayoutSignature: () => string;
  readonly knownContentVersion: (chapter: number) => string | undefined;
  readonly adjacentChapter: (chapter: number, step: number) => number | undefined;
  readonly catalogPending: () => boolean;
  readonly catalogInFlight: () => boolean;
  readonly chapterPosition: (chapter: number) => number | undefined;
  readonly catalogCount: () => number | undefined;
  readonly hydrateCatalog: () => Promise<void>;
  readonly measureCommittedPage: (offset: number) => void;
  readonly openChapter: (chapter: number, offset: number) => boolean;
  readonly requestChapter: (direction: ReaderPageTurnDirection, chapter: number) => void;
  readonly admitContentVersion: (chapter: number, version: string) => void;
}

export interface ReaderPageTurnRuntimeRender {
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly publish: (update: ReadingPageTurnRenderUpdate) => void;
  readonly settings: () => ReaderSettingsSnapshot;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly viewportWidth: () => number;
  readonly viewportHeight: () => number;
  readonly reduceMotion: () => boolean;
  readonly context: () => UIContext;
  readonly currentPage: () => ReaderPageTurnRenderPage;
  readonly preparedPage: (direction: ReaderPageTurnDirection) => ReaderPageTurnRenderPage | undefined;
  readonly captureCapsule: () => ReaderSessionCapsuleSnapshot | undefined;
  readonly continuousSurface: () => ReaderReadingSurfaceHost;
  readonly launchRenderWorkBlocked: () => boolean;
  readonly publishChapter: (showTitle: boolean, title: string) => void;
  readonly publishPhase: (phase: 'loading' | 'ready') => void;
}

export interface ReaderPageTurnRuntimeProgress {
  readonly gateway: () => ReadingSessionFlowGateway;
  readonly exitProgress: () => ReadingExitProgressCoordinator;
  readonly producers: () => ReaderProgressProducerHost;
  readonly layout: () => CoreReadingLayout;
  readonly canPresentOrdinaryPage: (chapter: ReadingSessionChapter) => boolean;
  readonly visiblePageCurrent: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number) => boolean;
  readonly admit: (stored: LocalReadingProgress) => void;
  readonly retireOrdinaryMeasurement: () => void;
}

export interface ReaderPageTurnRuntimeEffects {
  readonly automatic: () => Readonly<ReaderAutoPageState>;
  readonly autoPage: () => ReaderAutoPageCoordinator;
  readonly bookmark: () => ReaderBookmarkInteractionHost;
  readonly observeChapterTransition: (chapterIndex: number) => void;
  readonly resumeAutomaticTurn: () => void;
  readonly resumeSpeechFollow: () => void;
  readonly invalidateSpeechFollow: () => void;
  readonly speechFollowFailed: (lease: ReaderTtsFollowLease) => void;
  readonly openControl: () => void;
  readonly flushDeferredChrome: () => void;
  readonly prefetchInteraction: (manual: boolean) => void;
  readonly releaseImages: () => void;
  readonly resolveImages: (chapter: ReadingSessionChapter, page: PhysicalReadingPage) => void;
  readonly settlePresentationRecovery: () => void;
  readonly notifyReadingReady: (chapter: ReadingSessionChapter, page: PhysicalReadingPage,
    selection: number, lifecycle: number) => boolean;
  readonly prefetchNextChapter: (chapter: ReadingSessionChapter, lifecycle: number, selection: number) => void;
  readonly automaticPageCommitted: () => void;
  readonly armAutomaticTimer: () => void;
}

/** One mounted reader's input, destination, native frame and preparation lanes.
 * These owners survive view re-evaluation and keep independent ACK and progress identities. */
export class ReaderPageTurnRuntimeHost {
  readonly settlement: ReaderPageTurnSettlementHost;
  readonly input: ReaderPageTurnInputHost;
  readonly presentation: ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly preparation: ReaderPageTurnPreparationHost;
  private readonly chapters: ReadingChapterWindow;
  private readonly scene: ReaderPageTurnRuntimeScene;
  private readonly document: ReaderPageTurnRuntimeDocument;
  private readonly render: ReaderPageTurnRuntimeRender;
  private readonly progress: ReaderPageTurnRuntimeProgress;
  private readonly effects: ReaderPageTurnRuntimeEffects;
  private readonly neighbourOwner: ReaderPreparedNeighbourOwner;
  private pendingAutomaticStart: ReaderAutomaticPageStart | undefined = undefined;
  private perfStartedAtMs: number = 0;
  private perfStyle: string = '';
  private perfPath: string = '';
  private perfDirection: string = '';

  constructor(componentId: string, chapters: ReadingChapterWindow, scene: ReaderPageTurnRuntimeScene,
    document: ReaderPageTurnRuntimeDocument, render: ReaderPageTurnRuntimeRender, progress: ReaderPageTurnRuntimeProgress,
    effects: ReaderPageTurnRuntimeEffects, deferred: ReaderPageTurnDeferredEffects) {
    this.chapters = chapters;
    this.scene = scene;
    this.document = document;
    this.render = render;
    this.progress = progress;
    this.effects = effects;
    this.neighbourOwner = {
      mounted: scene.mounted,
      generation: (): number => this.preparation.generation,
      visibleChapter: (): number | undefined => document.measured().chapter?.chapterIndex,
      visiblePageStart: (): number | undefined => document.measured().page?.startScalar,
      sourceId: (): string => scene.identity().sourceId,
      bookId: (): string => scene.identity().bookId,
      layoutSignature: document.paginationLayoutSignature,
      contentVersion: document.knownContentVersion,
    };
    this.settlement = this.createSettlement(deferred);
    this.input = this.createInput();
    this.presentation = this.createPresentation(componentId);
    this.preparation = this.createPreparation();
  }

  get pageTurn(): ReadingPageTurnCoordinator<ReaderReadingLayoutSnapshot, ReaderPageTurnRenderPage, PreparedReaderPageTurn,
    ReaderDeferredChapterSelection, ReaderAppearanceSnapshot, ReaderSettingsSnapshot> {
    return this.settlement.pageTurn;
  }

  get prepared(): ReaderPreparedPageSettlement<PreparedReaderPageTurn> { return this.settlement.prepared; }
  get automaticStart(): ReaderAutomaticPageStart | undefined { return this.pendingAutomaticStart; }

  clearAutomaticStart(): void { this.pendingAutomaticStart = undefined; }

  usesBookTurnSimulation(): boolean { return this.nativeMode().simulationActive; }
  shouldMountBookTurnSurface(): boolean { return this.nativeMode().mountSurface; }

  effectivePageTurnStyle(): ReaderPageTurnStyle {
    const selected = readerPageTurnStyle(this.render.settings());
    return this.render.reduceMotion() || (selected === 'simulation' && this.render.projection().bookTurnRuntimeFailed) ?
      'none' : selected;
  }

  usesNoAnimationPageTurnRuntime(): boolean { return this.effectivePageTurnStyle() === 'none'; }

  inputPhase(): ReaderPageGesturePhase {
    return this.pageTurn.phase(this.render.projection().pageTurnSettlementActive, this.pageTurn.gesture.phase);
  }

  tapOnlyInput(): boolean {
    return this.scene.windowPolicyPending() || this.render.projection().pageTurnSettlementActive || this.prepared.prepared !== undefined;
  }

  canTurnPage(): boolean {
    const measured = this.document.measured();
    return this.scene.mounted() && !this.scene.exiting() && !this.scene.windowPolicyPending() &&
      !this.scene.controlVisible() && this.scene.phase() === 'ready' &&
      !measured.measurementCompleting && this.preparation.pending === undefined &&
      this.prepared.prepared === undefined && !this.progress.exitProgress().writeActive && measured.page !== undefined &&
      measured.chapter !== undefined && measured.selection === this.scene.selection() &&
      measured.materializedChapterSelectionToken === this.scene.selection();
  }

  invalidate(restorePreparation: boolean, preserveRapidPageTarget: boolean = false, preserveTtsFollow: boolean = false): void {
    const measured = this.document.measured();
    this.progress.retireOrdinaryMeasurement();
    measured.retirePreviousLayoutPreparation();
    if (!preserveTtsFollow) this.effects.invalidateSpeechFollow();
    this.pendingAutomaticStart = undefined;
    this.settlement.clearOrigin();
    measured.canonicalModeAnchor = -1;
    this.pageTurn.cancelSlide();
    measured.adjacentMeasurementContext = undefined;
    this.render.publish({ pageTurnInputRevision: this.render.projection().pageTurnInputRevision + 1 });
    this.pageTurn.clearProjection();
    this.finishPerformance('invalidated');
    this.effects.bookmark().invalidatePageTurn();
    const discovery = measured.previousChapterMeasurement?.prepareOnly ? measured.previousChapterMeasurement : undefined;
    const preparation = this.preparation.invalidate((): void => {
      this.pageTurn.generation += 1;
      this.presentation.surfaceGeneration += 1;
      this.render.publish({ bookTurnSurfaceOpacity: 0 });
    }, (): void => {
      if (discovery !== undefined) measured.previousChapterMeasurement = undefined;
    });
    if (!preserveRapidPageTarget) this.pageTurn.cancelRapid();
    this.pageTurn.releaseDeferredPointer();
    this.effects.autoPage().cancelPendingTurn();
    this.pageTurn.clearNeighbours();
    this.prepared.discardDestination();
    this.pageTurn.animationFinished = false;
    this.prepared.clearResult();
    this.settlement.clearLayout();
    this.render.publish({ pageTurnSettlementActive: false });
    this.presentation.phase = 'idle';
    this.presentation.staticFallbackPending = false;
    this.prepared.cancelDeadline();
    this.render.publish({ pageTurnPresentationWidth: 0 });
    this.render.publish({ pageTurnOffsetX: 0 });
    this.render.publish({ pageTurnDirection: { value: undefined } });
    this.pageTurn.gesture = createReaderPageGestureState();
    this.render.publish({ pageTurnInputOwned: false });
    this.input.clearCapsule();
    this.prepared.releaseCommit();
    this.presentation.motion = undefined;
    this.presentation.awaitingSlots = false;
    this.effects.bookmark().clearPageTurnPreview();
    this.presentation.texture.invalidate(true);
    this.presentation.session.clearCapturedTextures();
    this.presentation.texture.releaseContent();
    this.presentation.session.releasePendingSnapshot();
    this.advanceRenderRevision();

    if (preparation !== undefined || discovery !== undefined) {
      this.interruptAdjacentMeasurement(false);
      const origin = preparation?.origin ?? discovery?.origin;
      if (restorePreparation && this.scene.mounted() && origin !== undefined) {
        measured.restoreMaterializedChapterContext(origin, false);
        this.render.publishPhase(measured.page === undefined ? 'loading' : 'ready');
      }
    }
    this.effects.releaseImages();
  }

  releaseRecoveryInput(): void {
    this.render.publish({ bookTurnRuntimeFailed: true });
    this.progress.exitProgress().invalidateWrite();
    // Keep the admitted origin while the Core receipt is still unknown.
    this.invalidate(true);
    this.settlement.resumeDeferred();
  }

  rollbackForDeferredMutation(): void {
    if (this.pageTurn.gesture.owner === 'bookmark') {
      this.input.retirePointer();
      return;
    }
    const phase = this.inputPhase();
    if (phase === 'settling') {
      this.rollbackUncommittedBookTurnSettlement();
      return;
    }
    if (phase !== 'tracking' && phase !== 'dragging') return;
    const cancelled = cancelReaderPagePan(this.pageTurn.gesture);
    if (cancelled !== this.pageTurn.gesture) this.input.gestureChanged(cancelled);
  }

  rollbackUncommittedBookTurnSettlement(): boolean {
    if (!this.usesBookTurnSimulation() || this.prepared.prepared === undefined ||
      this.pageTurn.animationFinished || this.prepared.commitStarted) return false;
    const generation = this.pageTurn.generation;
    this.prepared.discardDestination();
    this.prepared.clearResult();
    this.effects.autoPage().retryTurn(this.effects.automatic().generation);
    if (!this.presentation.session.settle(generation, false)) this.presentation.fail();
    return true;
  }

  retireForReduceMotion(): void {
    if (!this.scene.mounted() || (!this.render.projection().pageTurnSettlementActive && this.presentation.motion === undefined &&
      !this.pageTurn.hasSlide())) return;
    const generation = this.presentation.motion?.generation ?? this.pageTurn.generation;
    this.pageTurn.generation = generation;
    this.presentation.surfaceGeneration = generation;
    this.pageTurn.cancelSlide();
    this.pendingAutomaticStart = undefined;
    this.presentation.texture.invalidate(true);
    this.render.publish({ bookTurnSurfaceOpacity: 0 });
    if (this.presentation.motion !== undefined) stopBookTurnMotion(this.presentation.motion);
    this.presentation.motion = undefined;
    this.presentation.awaitingSlots = false;
    this.presentation.session.clearCapturedTextures();
    this.presentation.session.releaseTerminalFrame(generation);
    this.presentation.session.clearSurface(generation);
    if (this.pageTurn.animationFinished && this.prepared.commitStarted) {
      // A dispatched Core write retains its original decision and generation.
      if (this.prepared.prepared !== undefined) {
        if (this.prepared.commitFinished) this.settlement.join(generation);
      } else if (this.prepared.commitFinished && this.prepared.commitSucceeded) {
        this.presentation.staticFallbackPending = true;
        this.advanceRenderRevision();
        if (!this.presentation.completeStaticFallback(generation)) this.presentation.armDeadline(generation);
      }
      return;
    }
    this.prepared.discardDestination();
    this.prepared.releaseCommit();
    this.prepared.clearResult();
    this.settlement.finishRollback(generation);
  }

  cancelAutomaticPageStart(origin?: ReaderPageTurnOrigin): void {
    const start = this.pendingAutomaticStart;
    if (start === undefined || start.started || (origin !== undefined && start.origin !== origin)) return;
    this.pendingAutomaticStart = undefined;
    if (!this.render.projection().pageTurnSettlementActive || start.generation !== this.pageTurn.generation ||
      this.prepared.commitStarted) return;
    this.prepared.discardDestination();
    if (start.origin === 'autoTimer') this.effects.autoPage().retryTurn(start.autoGeneration);
    this.settlement.rollback(true);
  }

  beginPerformance(direction: ReaderPageTurnDirection, path: string): void {
    if (this.perfStartedAtMs > 0) return;
    this.perfStartedAtMs = readerMotionNowMs();
    this.perfStyle = this.effectivePageTurnStyle();
    this.perfPath = path;
    this.perfDirection = direction;
  }

  finishPerformance(outcome: string): void {
    if (this.perfStartedAtMs <= 0) return;
    const completedAtMs = readerMotionNowMs();
    const totalMs = Math.max(0, completedAtMs - this.perfStartedAtMs);
    const automatic = this.pendingAutomaticStart;
    hilog.info(0x5244, 'Reader',
      'PAGETURN_PERF style=%{public}s path=%{public}s dir=%{public}s outcome=%{public}s totalMs=%{public}d startedAtMs=%{public}d completedAtMs=%{public}d',
      this.perfStyle, this.perfPath, this.perfDirection, outcome, totalMs, this.perfStartedAtMs, completedAtMs);
    if (automatic !== undefined) hilog.info(0x5244, 'Reader',
      'PAGETURN_AUTO generation=%{public}d origin=%{public}s bufferEventAtMs=%{public}d showRequestedAtMs=%{public}d startAckAtMs=%{public}d completedAtMs=%{public}d',
      automatic.generation, automatic.origin, automatic.bufferEventReceivedAtMs, automatic.showRequestedAtMs,
      automatic.startedAtMs, completedAtMs);
    this.perfStartedAtMs = 0;
    this.perfStyle = '';
    this.perfPath = '';
    this.perfDirection = '';
  }

  private nativeMode(): ReaderBookTurnRuntimeSpec {
    const settings = this.render.settings();
    return readerBookTurnRuntimeSpec(settings.navigationMode, settings.pageTransition,
      this.render.reduceMotion(), this.render.projection().bookTurnRuntimeFailed);
  }

  private isAutomaticPageStartCurrent(start: ReaderAutomaticPageStart): boolean {
    if (this.pendingAutomaticStart !== start || !this.scene.mounted() || !this.scene.foreground() || this.scene.exiting() ||
      start.lifecycleToken !== this.scene.lifecycle() || start.generation !== this.pageTurn.generation ||
      start.generation !== this.presentation.surfaceGeneration || !this.render.projection().pageTurnSettlementActive ||
      this.presentation.phase !== 'settling' || this.prepared.prepared === undefined || this.scene.controlVisible() ||
      this.scene.controlObscured() || this.scene.interactionBlocked() || this.input.pointerId >= 0) return false;
    if (start.origin === 'ttsFollow') return start.ttsOwner !== undefined && this.scene.speechFollowCurrent(start.ttsOwner);
    const automatic = this.effects.automatic();
    return automatic.status === 'running' && automatic.generation === start.autoGeneration;
  }

  private admitAutomaticPageStart(event: BookTurnNativeEvent): void {
    const start = this.pendingAutomaticStart;
    if (start === undefined || start.started || start.scheduled || event.generation !== start.generation) return;
    if (!this.isAutomaticPageStartCurrent(start) || !Number.isSafeInteger(event.detail) || event.detail <= 0) {
      this.cancelAutomaticPageStart();
      return;
    }
    start.surfaceToken = event.detail;
    start.bufferEventReceivedAtMs = readerMotionNowMs();
    // Native submitted the buffer. Wait for the ArkUI frame before accepting the timeline.
    start.showRequestedAtMs = readerMotionNowMs();
    start.scheduled = true;
    try {
      this.render.context().postFrameCallback(new ReaderUIFrameCallback((): void => {
        if (this.pendingAutomaticStart !== start || start.started) return;
        if (!this.isAutomaticPageStartCurrent(start)) { this.cancelAutomaticPageStart(); return; }
        if (!this.presentation.session.startAutomaticTimeline(start.generation, start.surfaceToken)) {
          this.cancelAutomaticPageStart();
          return;
        }
        start.started = true;
        start.startedAtMs = readerMotionNowMs();
      }));
    } catch (_) { this.cancelAutomaticPageStart(); }
  }

  private advanceRenderRevision(): void {
    this.render.publish({ pageTurnRenderRevision: this.render.projection().pageTurnRenderRevision + 1 });
  }

  private drainInputAndResume(): void {
    this.input.drain();
    this.effects.resumeAutomaticTurn();
    this.effects.resumeSpeechFollow();
  }

  private interruptAdjacentMeasurement(clearDeferredRequest: boolean): void {
    const measured = this.document.measured();
    measured.physicalPagination.index.invalidateMeasurement();
    measured.measurementCompleting = false;
    if (clearDeferredRequest) measured.measurementCoordinator.clearDeferredRequest();
    measured.batchProcessing = false;
    measured.nativeMeasurement.clear();
    measured.nativeMeasurement.clearBatch();
    measured.resetPendingPage();
    measured.measurementRun.cancelDeadline();
    this.render.publish({ measurementEpoch: this.render.projection().measurementEpoch + 1 });
  }

  private adjacentEvidence(page: PhysicalReadingPage, chapter: ReadingSessionChapter): ReaderAdjacentPageEvidence {
    return {
      chapterIndex: chapter.chapterIndex, startScalar: page.startScalar, endScalar: page.endScalar,
      window: this.chapters,
      currentKey: this.document.currentPaginationKey,
      chapterKey: this.document.paginationKey,
      lastVisibleScalar: (): number => lastVisibleReadingScalar(chapter.content, this.document.measured().requireChapterLayoutMap()),
    };
  }

  private publishDestination(prepared: PreparedReaderPageTurn): void {
    const measured = this.document.measured();
    const context = prepared.context;
    measured.restoreMaterializedChapterContext(context, true);
    measured.admit(prepared.page, this.scene.selection());
    this.render.publish({ visibleFragments: prepared.page.fragments });
    measured.desiredChapterOffset = prepared.page.startScalar;
    measured.desiredChapterProgress = context.layoutMap.scalarCount() === 0 ? 0 :
      prepared.page.startScalar / context.layoutMap.scalarCount();
    this.render.publishChapter(measured.isChapterFirstPageStart(prepared.page.startScalar), context.chapter.chapterTitle);
    this.render.publishPhase('ready');
    this.effects.releaseImages();
    this.preparation.schedule();
  }

  private afterDestination(prepared: PreparedReaderPageTurn, selection: number, lifecycle: number): void {
    const chapter = prepared.context.chapter;
    if (!this.effects.notifyReadingReady(chapter, prepared.page, selection, lifecycle)) return;
    this.effects.prefetchNextChapter(chapter, lifecycle, selection);
    this.effects.automaticPageCommitted();
  }

  private createSettlement(deferred: ReaderPageTurnDeferredEffects): ReaderPageTurnSettlementHost {
    const scene = this.scene;
    const document = this.document;
    const render = this.render;
    const progress = this.progress;
    const effects = this.effects;
    return new ReaderPageTurnSettlementHost({
      lifecycle: scene.lifecycle,
      selection: scene.selection,
      mounted: scene.mounted,
      isMountedToken: scene.isMountedToken,
      exiting: scene.exiting,
      bookId: (): string => scene.identity().bookId,
      currentChapter: document.currentChapter,
      layout: render.layout,
      viewportWidth: render.viewportWidth,
      simulation: (): boolean => this.usesBookTurnSimulation(),
      noAnimation: (): boolean => this.usesNoAnimationPageTurnRuntime(),
      context: render.context,
      presentation: (): ReaderPageTurnPresentation<PreparedReaderPageTurn> => this.presentation,
      projection: render.projection,
      publish: render.publish,
      preparedIsFresh: (prepared: PreparedReaderPageTurn): boolean => this.input.preparedIsFresh(prepared),
      neighbourGeneration: (): number => this.preparation.generation,
      captureOrigin: (): ReaderSettledPageOrigin => ({
        context: document.measured().captureMaterializedChapterContext(), page: document.measured().page as PhysicalReadingPage,
        key: document.currentPaginationKey(),
      }),
      publishDestination: (prepared: PreparedReaderPageTurn): void => this.publishDestination(prepared),
      afterDestination: (prepared: PreparedReaderPageTurn, selection: number, lifecycle: number): void =>
        this.afterDestination(prepared, selection, lifecycle),
    }, {
      gateway: progress.gateway,
      exitProgress: progress.exitProgress,
      producers: progress.producers,
      identity: scene.identity,
      layout: progress.layout,
      canPresentOrdinaryPage: progress.canPresentOrdinaryPage,
      visiblePageCurrent: progress.visiblePageCurrent,
      admit: progress.admit,
      releaseUnknownInput: (): void => this.releaseRecoveryInput(),
      errorMessage: (error: Error): string => error.message,
    }, {
      observeChapterTransition: effects.observeChapterTransition,
      beginPerformance: (direction: ReaderPageTurnDirection): void => this.beginPerformance(direction, 'prepared'),
      finishPerformance: (result: 'rollback' | 'committed'): void => this.finishPerformance(result),
      automaticGeneration: (): number => effects.automatic().generation,
      publishAutomaticStart: (start: ReaderAutomaticPageStart | undefined): void => { this.pendingAutomaticStart = start; },
      retryAutomaticTurn: (): void => effects.autoPage().retryTurn(effects.automatic().generation),
      clearBookmarkPreview: (): void => effects.bookmark().clearPageTurnPreview(),
      speechFollowFailed: effects.speechFollowFailed,
      flushDeferredChrome: effects.flushDeferredChrome,
      retryRapid: (): void => this.input.retryRapid(),
      drainRapid: (): void => { this.input.drain(); },
      resumeAutomaticTurn: effects.resumeAutomaticTurn,
      resumeSpeechFollow: effects.resumeSpeechFollow,
      drainPreparation: (): void => this.preparation.drain(),
      rearmAutomaticAfterRollback: (): void => {
        if (scene.active(scene.lifecycle()) && effects.automatic().status === 'running' &&
          !effects.automatic().awaitingPageCommit) effects.armAutomaticTimer();
      },
    }, deferred);
  }

  private createInput(): ReaderPageTurnInputHost {
    const scene = this.scene;
    const document = this.document;
    const render = this.render;
    const effects = this.effects;
    return new ReaderPageTurnInputHost(this.settlement, {
      mounted: scene.mounted,
      lifecycle: scene.lifecycle,
      exiting: scene.exiting,
      foreground: scene.foreground,
      interactionEnabled: scene.interactionEnabled,
      controlVisible: scene.controlVisible,
      automaticSurfaceBlocked: (): boolean => !scene.foreground() || scene.exiting() ||
        scene.controlVisible() || scene.controlObscured() || scene.interactionBlocked(),
      progressInFlight: (): boolean => this.progress.exitProgress().writeActive || this.progress.producers().continuousInFlight,
      canTurn: (): boolean => this.canTurnPage(),
      inputPhase: (): ReaderPageGesturePhase => this.inputPhase(),
      noAnimation: (): boolean => this.usesNoAnimationPageTurnRuntime(),
      simulation: (): boolean => this.usesBookTurnSimulation(),
      settings: render.settings,
      viewportWidth: render.viewportWidth,
      speechFollowCurrent: scene.speechFollowCurrent,
    }, {
      projection: render.projection,
      publish: render.publish,
      layout: render.layout,
      currentPage: render.currentPage,
      preparedPage: render.preparedPage,
      captureCapsule: render.captureCapsule,
      native: (): ReaderPageTurnPresentation<PreparedReaderPageTurn> => this.presentation,
      continuousSurface: render.continuousSurface,
    }, {
      measured: document.measured,
      preparation: (): ReaderPageTurnPreparationHost => this.preparation,
      neighbourOwner: (): ReaderPreparedNeighbourOwner => this.neighbourOwner,
      currentPaginationKey: document.currentPaginationKey,
      paginationKey: document.paginationKey,
      adjacentEvidence: (page: PhysicalReadingPage, chapter: ReadingSessionChapter): ReaderAdjacentPageEvidence =>
        this.adjacentEvidence(page, chapter),
      adjacentChapter: document.adjacentChapter,
      catalogPending: document.catalogPending,
      catalogInFlight: document.catalogInFlight,
      chapterPosition: document.chapterPosition,
      catalogCount: document.catalogCount,
      hydrateCatalog: document.hydrateCatalog,
      requireLayoutMap: (): ReadingSurfaceLayoutMap => document.measured().requireChapterLayoutMap(),
      lastVisible: lastVisibleReadingScalar,
      measureCommittedPage: document.measureCommittedPage,
      discoverPredecessor: (chapter: number, origin: number): boolean =>
        document.measured().startCurrentChapterPredecessorMeasurement(chapter, origin),
      startPreviousChapter: (chapter: number, originChapter: number, offset: number): boolean =>
        document.measured().startPreviousChapterMeasurement(chapter, originChapter, offset),
      openChapter: document.openChapter,
    }, {
      invalidateSpeechFollow: effects.invalidateSpeechFollow,
      cancelAutomaticStart: (): void => this.cancelAutomaticPageStart(),
      cancelPendingAutomaticTurn: (): void => effects.autoPage().cancelPendingTurn(),
      resumeAutomaticTurn: effects.resumeAutomaticTurn,
      resumeSpeechFollow: effects.resumeSpeechFollow,
      openControl: effects.openControl,
      rollbackForDeferredMutation: (): void => this.rollbackForDeferredMutation(),
      finishInterruptedBookmark: (): void => {
        effects.bookmark().interruptPageTurnGesture();
        this.pageTurn.clearProjection();
        this.pageTurn.gesture = createReaderPageGestureState();
        render.publish({ pageTurnInputOwned: false });
        this.presentation.phase = 'idle';
        effects.flushDeferredChrome();
        this.settlement.resumeDeferred();
      },
      flushDeferredChrome: effects.flushDeferredChrome,
      prefetchInteraction: effects.prefetchInteraction,
      beginPerformance: (direction: ReaderPageTurnDirection, path: 'gesture' | 'direct'): void => this.beginPerformance(direction, path),
      finishPerformance: (result: string): void => this.finishPerformance(result),
    });
  }

  private createPresentation(componentId: string): ReaderPageTurnPresentation<PreparedReaderPageTurn> {
    const scene = this.scene;
    const render = this.render;
    return new ReaderPageTurnPresentation<PreparedReaderPageTurn>(componentId, this.pageTurn, this.prepared,
      (session: BookTurnPresentationSession): ReaderPageTurnNativeHost => new ReaderPageTurnNativeHost(
        session,
        render.context,
        (): ReaderPageTurnTextureGate => new ReaderPageTurnTextureGate(
          scene.mounted(), render.launchRenderWorkBlocked(), this.usesBookTurnSimulation(), scene.controlVisible(),
          render.projection().bookTurnRuntimeFailed, scene.exiting(), scene.phase() === 'ready',
          this.preparation.pending !== undefined, this.inputPhase(), this.preparation.generation, this.presentation.scheduledRevision),
        (): ReaderPageTurnTextureGeometry =>
          new ReaderPageTurnTextureGeometry(render.viewportWidth(), render.viewportHeight(), render.projection().pageTurnCurrentSlot),
        render.layout,
        render.appearance,
        render.currentPage,
        render.preparedPage,
        (): void => {
          // Release the completed user intent through the admitted static path.
          this.presentation.fail();
          this.input.drain();
        },
      ), {
        mounted: scene.mounted,
        exiting: scene.exiting,
        lifecycle: scene.lifecycle,
        surfaceMounted: (): boolean => this.shouldMountBookTurnSurface(),
        simulation: (): boolean => this.usesBookTurnSimulation(),
        inputPhase: (): ReaderPageGesturePhase => this.inputPhase(),
        viewportWidth: render.viewportWidth,
        viewportHeight: render.viewportHeight,
        reduceMotion: render.reduceMotion,
        textureIdentity: (): string => render.currentPage().textureIdentity,
        projection: render.projection,
        publish: render.publish,
        context: render.context,
        errorMessage: (error: Error): string => error.message,
      }, {
        textureReady: (): void => this.drainInputAndResume(),
        framePresented: (event: BookTurnNativeEvent): void => this.admitAutomaticPageStart(event),
        finishCommit: (generation: number): void => this.settlement.join(generation),
        finishRollback: (generation: number): void => this.settlement.finishRollback(generation),
        finishSuccessfulPresentation: (generation: number): void => this.settlement.finishPresentation(generation),
        automaticStartPending: (): boolean => this.pendingAutomaticStart !== undefined && !this.pendingAutomaticStart.started,
        clearAutomaticStart: (): void => this.clearAutomaticStart(),
        cancelAutomaticStart: (): void => this.cancelAutomaticPageStart(),
        animateRollback: (): void => this.settlement.rollback(),
        onPresentationReady: this.effects.settlePresentationRecovery,
        handoffPendingProgress: (): void => this.progress.gateway().handoffPendingProgress(),
        releaseRecoveryInput: (): void => this.releaseRecoveryInput(),
      });
  }

  private createPreparation(): ReaderPageTurnPreparationHost {
    const scene = this.scene;
    const document = this.document;
    const render = this.render;
    const effects = this.effects;
    return new ReaderPageTurnPreparationHost({
      mounted: scene.mounted,
      active: scene.active,
      selection: scene.selection,
      requiresPrepared: (): boolean => readerPageTransitionUsesPreparedPages(render.settings()),
      renderWorkBlocked: render.launchRenderWorkBlocked,
      turnWorkBlocked: (): boolean => document.measured().preparingPreviousLayout ||
        this.prepared.prepared !== undefined || this.pageTurn.gesture.phase !== 'idle',
      canTurn: (): boolean => this.canTurnPage(),
      heldPointerCanPrepare: (): boolean => this.input.pointerId >= 0 && !render.projection().pageTurnSettlementActive,
      releaseProjectionForHeldPreparation: (): void => {
        this.pageTurn.gesture = createReaderPageGestureState();
        render.publish({ pageTurnInputOwned: false });
        this.pageTurn.clearProjection();
      },
      uiContext: render.context,
      texture: (): ReaderPageTurnNativeHost => this.presentation.texture,
    }, {
      visiblePage: (): PhysicalReadingPage | undefined => document.measured().page,
      chapter: (): ReadingSessionChapter | undefined => document.measured().chapter,
      chapterWindow: this.chapters,
      captureOrigin: (): ReaderMaterializedChapterContext => document.measured().captureMaterializedChapterContext(),
      adjacentTarget: (direction: ReaderPageTurnDirection, page: PhysicalReadingPage, chapter: ReadingSessionChapter):
        ReaderPageTurnTarget | undefined => document.measured().physicalPagination.adjacentTarget(direction, this.adjacentEvidence(page, chapter)),
      isUnknownCatalogEdge: (index: number, direction: ReaderPageTurnDirection): boolean => this.input.isUnknownCatalogEdge(index, direction),
      requestCatalog: (): void => this.input.requestCatalog(),
      requestChapter: document.requestChapter,
      discoverPrevious: (): boolean => this.input.knownBoundary('previous') === undefined && document.measured().startPreviousPagePreparationDiscovery(),
      admitContentVersion: document.admitContentVersion,
    }, {
      active: (): boolean => document.measured().adjacentMeasurementContext !== undefined,
      begin: (context: ReaderMaterializedChapterContext): boolean => {
        const measured = document.measured();
        measured.adjacentMeasurementContext = context;
        measured.beginMeasurement(scene.lifecycle());
        return scene.phase() === 'measuring';
      },
      clearContext: (): void => { document.measured().adjacentMeasurementContext = undefined; },
      finishContext: (): void => document.measured().finishAdjacentMeasurementContext(),
      retirePreviousDiscovery: (): void => {
        const measured = document.measured();
        if (measured.previousChapterMeasurement?.prepareOnly) measured.previousChapterMeasurement = undefined;
        measured.retirePreviousLayoutPreparation();
      },
      interrupt: (clearDeferredRequest: boolean): void => this.interruptAdjacentMeasurement(clearDeferredRequest),
      current: (generation: number, selection: number, lifecycle: number): boolean =>
        document.measured().isMeasurementCurrent(generation, selection, lifecycle),
      capture: (): ReaderMaterializedChapterContext => document.measured().captureMeasurementChapterContext(),
      key: (): ReadingPaginationKey => document.measured().measurementPaginationKey(),
      finish: (): void => {
        const measured = document.measured();
        measured.measurementCompleting = false;
        measured.physicalPagination.index.finishMeasurement();
      },
    }, {
      prepared: (direction: ReaderPageTurnDirection): boolean => this.input.prepared(direction) !== undefined,
      clearNeighbours: (): void => this.pageTurn.clearNeighbours(),
      setNeighbour: (prepared: PreparedReaderPageTurn): void => this.pageTurn.setNeighbour(prepared.direction, prepared),
      phase: render.publishPhase,
      advanceRevision: (): void => this.advanceRenderRevision(),
      releaseImages: effects.releaseImages,
      complete: (chapter: ReadingSessionChapter, page: PhysicalReadingPage): void => {
        effects.resolveImages(chapter, page);
        effects.releaseImages();
        this.drainInputAndResume();
      },
    });
  }
}
