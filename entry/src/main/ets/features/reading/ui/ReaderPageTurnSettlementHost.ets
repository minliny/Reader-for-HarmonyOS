import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import { CoreReadingAnchor, type CoreReadingLayout } from '../application/ReadingMeasurementFacts';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import { ReadingPageTurnCoordinator, type ReaderPageTurnSlideHost } from '../application/ReadingPageTurnCoordinator';
import type { ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import { type ReadingExitProgressCoordinator, type ReadingProgressIdentity } from '../application/ReadingExitProgressCoordinator';
import type { LocalReadingProgress } from '../application/LocalReadingFlowGateway';
import { persistReaderMeasuredProgress } from '../application/ReaderFirstPageAdmission';
import { ReaderPreparedPageSettlement, type ReaderPageTurnOriginReceipt, type ReaderPageTurnProgressGateway,
  type ReaderPageTurnProgressTarget } from '../application/ReaderPreparedPageSettlement';
import type { ReaderProgressProducerHost } from '../application/ReaderProgressProducerHost';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import type { ReaderDeferredChapterSelection } from '../presentation/ReaderChapterSelectionOwner';
import { PreparedReaderPageTurn, type ReaderAutomaticPageStart,
  type ReaderMaterializedChapterContext } from '../presentation/ReaderPagePresentationModels';
import { BOOK_TURN_PROFILE_AUTOMATIC, BOOK_TURN_PROFILE_MANUAL, BOOK_TURN_PROFILE_RAPID } from './BookTurnPresentationSession';
import { bookTurnInput, stopBookTurnMotion } from './BookTurnMotionState';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import type { ReaderDeferredControlMinimum } from './ReaderControlMinimumState';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { completeReaderPageGestureSettlement, type ReaderPageTurnDirection } from './ReaderPageGestureState';
import type { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import type { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReadingPageTurnRenderSnapshot, ReadingPageTurnRenderUpdate } from './ReaderReadingSurfaceHost';
import type { ReaderPageTurnOrigin, ReaderTtsFollowLease } from './ReaderTtsPageFollow';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

export interface ReaderSettledPageOrigin {
  readonly context: ReaderMaterializedChapterContext;
  readonly page: PhysicalReadingPage;
  readonly key: ReadingPaginationKey;
}

export interface ReaderPageTurnSettlementView {
  readonly lifecycle: () => number;
  readonly selection: () => number;
  readonly mounted: () => boolean;
  readonly isMountedToken: (lifecycle: number) => boolean;
  readonly exiting: () => boolean;
  readonly bookId: () => string;
  readonly currentChapter: () => number;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly viewportWidth: () => number;
  readonly simulation: () => boolean;
  readonly noAnimation: () => boolean;
  readonly context: () => UIContext;
  readonly presentation: () => ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly publish: (update: ReadingPageTurnRenderUpdate) => void;
  readonly preparedIsFresh: (prepared: PreparedReaderPageTurn) => boolean;
  readonly neighbourGeneration: () => number;
  readonly captureOrigin: () => ReaderSettledPageOrigin;
  readonly publishDestination: (prepared: PreparedReaderPageTurn) => void;
  readonly afterDestination: (prepared: PreparedReaderPageTurn, selection: number, lifecycle: number) => void;
}

export interface ReaderPageTurnSettlementProgress {
  readonly gateway: () => ReadingSessionFlowGateway;
  readonly exitProgress: () => ReadingExitProgressCoordinator;
  readonly producers: () => ReaderProgressProducerHost;
  readonly identity: () => ReadingProgressIdentity;
  readonly layout: () => CoreReadingLayout;
  readonly canPresentOrdinaryPage: (chapter: ReadingSessionChapter) => boolean;
  readonly visiblePageCurrent: (page: PhysicalReadingPage, chapter: ReadingSessionChapter, selection: number, lifecycle: number) => boolean;
  readonly admit: (stored: LocalReadingProgress) => void;
  readonly releaseUnknownInput: () => void;
  readonly errorMessage: (error: Error) => string;
}

export interface ReaderPageTurnSettlementEffects {
  readonly observeChapterTransition: (chapterIndex: number) => void;
  readonly beginPerformance: (direction: ReaderPageTurnDirection) => void;
  readonly finishPerformance: (result: 'rollback' | 'committed') => void;
  readonly automaticGeneration: () => number;
  readonly publishAutomaticStart: (start: ReaderAutomaticPageStart | undefined) => void;
  readonly retryAutomaticTurn: () => void;
  readonly clearBookmarkPreview: () => void;
  readonly speechFollowFailed: (lease: ReaderTtsFollowLease) => void;
  readonly flushDeferredChrome: () => void;
  readonly retryRapid: () => void;
  readonly drainRapid: () => void;
  readonly resumeAutomaticTurn: () => void;
  readonly resumeSpeechFollow: () => void;
  readonly drainPreparation: () => void;
  readonly rearmAutomaticAfterRollback: () => void;
}

export interface ReaderPageTurnDeferredEffects {
  readonly controlMinimum: () => ReaderDeferredControlMinimum | undefined;
  readonly clearControlMinimum: () => void;
  readonly admitControlMinimum: (minimum: ReaderDeferredControlMinimum) => void;
  readonly exit: () => void;
  readonly requestedChapterChanged: () => void;
  readonly selectChapter: (selection: ReaderDeferredChapterSelection) => void;
  readonly reloadReplacement: (lifecycle: number, bookId: string) => void;
  readonly reloadProjection: (lifecycle: number, chapterIndex: number) => void;
  readonly appearance: (snapshot: ReaderAppearanceSnapshot) => void;
  readonly viewport: (width: number, height: number, lifecycle: number) => void;
  readonly reflowWindow: () => void;
  readonly windowSettings: (settings: ReaderSettingsSnapshot) => void;
}

/** Holds the presentation-time layout and the actual prepared destination
 * until the visual endpoint joins the Core receipt. Native slot admission
 * and the mounted measured page each keep their own ownership. */
export class ReaderPageTurnSettlementHost {
  readonly prepared: ReaderPreparedPageSettlement<PreparedReaderPageTurn>;
  readonly pageTurn: ReadingPageTurnCoordinator<ReaderReadingLayoutSnapshot, ReaderPageTurnRenderPage, PreparedReaderPageTurn,
    ReaderDeferredChapterSelection, ReaderAppearanceSnapshot, ReaderSettingsSnapshot>;
  private readonly view: ReaderPageTurnSettlementView;
  private readonly progress: ReaderPageTurnSettlementProgress;
  private readonly effects: ReaderPageTurnSettlementEffects;
  private readonly deferred: ReaderPageTurnDeferredEffects;
  private readonly slideHost: ReaderPageTurnSlideHost;
  private origin: ReaderPageTurnOrigin = 'manual';
  private followLease: ReaderTtsFollowLease | undefined = undefined;
  private frozenLayout: ReaderReadingLayoutSnapshot | undefined = undefined;

  constructor(view: ReaderPageTurnSettlementView, progress: ReaderPageTurnSettlementProgress,
    effects: ReaderPageTurnSettlementEffects, deferred: ReaderPageTurnDeferredEffects) {
    this.view = view;
    this.progress = progress;
    this.effects = effects;
    this.deferred = deferred;
    this.prepared = new ReaderPreparedPageSettlement<PreparedReaderPageTurn>({
      current: (prepared: PreparedReaderPageTurn, lifecycle: number, generation: number): boolean =>
        this.commitCurrent(prepared, lifecycle, generation),
      canPresent: (prepared: PreparedReaderPageTurn): boolean => this.progress.canPresentOrdinaryPage(prepared.context.chapter),
      persistPresented: (prepared: PreparedReaderPageTurn, lifecycle: number): Promise<void> =>
        this.persistPresented(prepared, lifecycle),
      write: (prepared: PreparedReaderPageTurn, current: () => boolean): Promise<LocalReadingProgress> =>
        this.writePrepared(prepared, current),
      acquireWrite: (lifecycle: number): (() => void) =>
        this.progress.exitProgress().acquireWrite((): boolean => this.view.isMountedToken(lifecycle)),
      gateway: (): ReaderPageTurnProgressGateway => this.progress.gateway(),
      bookId: (): string => this.view.bookId(),
      position: (prepared: PreparedReaderPageTurn): ReaderPageTurnProgressTarget => ({
        chapterIndex: prepared.context.chapter.chapterIndex, chapterOffset: prepared.page.startScalar,
        bodyVersion: prepared.context.chapter.bodyVersion, processingVersion: prepared.context.chapter.processingVersion,
      }),
      origin: (): ReaderPageTurnOriginReceipt | undefined => this.progress.exitProgress().committed,
      releaseUnknownInput: (): void => this.progress.releaseUnknownInput(),
      finish: (generation: number, presented?: boolean): void => this.join(generation, presented),
      reportFailure: (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience prepared page commit failed: ${this.progress.errorMessage(error)}`),
    }, {
      set: (delay: number, callback: () => void): number => setTimeout(callback, delay),
      clear: (handle: number): void => clearTimeout(handle),
    });
    this.pageTurn = new ReadingPageTurnCoordinator<
      ReaderReadingLayoutSnapshot, ReaderPageTurnRenderPage, PreparedReaderPageTurn,
      ReaderDeferredChapterSelection, ReaderAppearanceSnapshot, ReaderSettingsSnapshot>(this.prepared);
    this.slideHost = {
      mounted: (): boolean => this.view.mounted(),
      generation: (): number => this.pageTurn.generation,
      now: (): number => readerMotionNowMs(),
      publishOffset: (offset: number): void => this.view.publish({ pageTurnOffsetX: offset }),
      postFrame: (callback: () => void): void =>
        this.view.context().postFrameCallback(new ReaderUIFrameCallback(callback)),
      finished: (generation: number): void => {
        if (this.pageTurn.finishSlide(generation, this.view.lifecycle()) === 'rollback') this.finishRollback(generation);
      },
    };
  }

  get layout(): ReaderReadingLayoutSnapshot | undefined { return this.frozenLayout; }

  clearOrigin(): void {
    this.origin = 'manual';
    this.followLease = undefined;
  }

  clearLayout(): void { this.frozenLayout = undefined; }

  start(direction: ReaderPageTurnDirection, prepared: PreparedReaderPageTurn,
    origin: ReaderPageTurnOrigin = 'manual', ttsOwner?: ReaderTtsFollowLease): boolean {
    if (!this.pageTurn.canStagePrepared(this.view.preparedIsFresh(prepared), this.view.viewportWidth())) return false;
    const chapterIndex = prepared.context.chapter.chapterIndex;
    if (chapterIndex !== this.view.currentChapter()) this.effects.observeChapterTransition(chapterIndex);
    const presentation = this.view.presentation();
    presentation.texture.invalidate(true);
    const lifecycle = this.view.lifecycle();
    const simulation = this.view.simulation();
    const noAnimation = this.view.noAnimation();
    const generation = simulation && presentation.motion !== undefined ? presentation.motion.generation : this.pageTurn.generation + 1;
    this.effects.beginPerformance(direction);
    this.frozenLayout = this.view.layout();
    this.pageTurn.generation = generation;
    presentation.surfaceGeneration = generation;
    // A native frame from a previous programmatic turn can still be resident.
    this.view.publish({ bookTurnSurfaceOpacity: simulation ?
      (presentation.motion !== undefined ? this.view.projection().bookTurnSurfaceOpacity : 0) : 1 });
    this.view.publish({ pageTurnSettlementActive: true });
    this.origin = origin;
    this.followLease = ttsOwner;
    const automatic: ReaderAutomaticPageStart | undefined =
      simulation && presentation.motion === undefined && origin !== 'manual' ? {
        generation, lifecycleToken: lifecycle, origin, autoGeneration: this.effects.automaticGeneration(),
        ttsOwner, surfaceToken: 0, scheduled: false, started: false,
        bufferEventReceivedAtMs: 0, showRequestedAtMs: 0, startedAtMs: 0,
      } : undefined;
    this.effects.publishAutomaticStart(automatic);
    presentation.phase = 'settling';
    this.view.publish({ pageTurnPresentationWidth: this.view.viewportWidth() });
    this.prepared.stage(prepared);
    this.pageTurn.animationFinished = noAnimation && !simulation;
    this.view.publish({ pageTurnDirection: { value: direction } });
    this.view.publish({ pageTurnInputOwned: true });
    presentation.armDeadline(generation);

    const targetOffset = direction === 'next' ? -this.view.viewportWidth() : this.view.viewportWidth();
    if (simulation) {
      const started = presentation.motion !== undefined ?
        presentation.session.endGesture(bookTurnInput(presentation.motion), true) :
        presentation.session.startProgrammatic(generation, direction, origin !== 'manual' ?
          BOOK_TURN_PROFILE_AUTOMATIC : (Math.abs(this.pageTurn.pendingDelta) > 1 ?
            BOOK_TURN_PROFILE_RAPID : BOOK_TURN_PROFILE_MANUAL));
      if (presentation.motion !== undefined) stopBookTurnMotion(presentation.motion);
      if (!started) {
        this.view.publish({ bookTurnRuntimeFailed: true });
        this.prepared.discardDestination();
        this.rollback();
        return true;
      }
    } else if (noAnimation) {
      this.view.publish({ pageTurnOffsetX: targetOffset });
      this.pageTurn.beginPersistence(prepared, lifecycle, generation);
    } else {
      this.startSlide(targetOffset, generation);
    }
    return true;
  }

  private async persistPresented(prepared: PreparedReaderPageTurn, lifecycle: number): Promise<void> {
    const chapter = prepared.context.chapter;
    const page = prepared.page;
    const selection = this.view.selection();
    const scalarCount = prepared.context.layoutMap.scalarCount();
    const current = (): boolean => this.progress.visiblePageCurrent(page, chapter, selection, lifecycle);
    const intent = this.progress.exitProgress().intent(chapter,
      new CoreReadingAnchor(chapter.chapterIndex, page.startScalar, scalarCount === 0 ? 0 : page.startScalar / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.progress.layout(),
      this.progress.identity, this.progress.gateway, current, current, this.progress.admit);
    try {
      await this.progress.producers().persistPresented(intent, 'READING_PAGE_TURN_PROGRESS_ANCHOR_MISMATCH');
      // A delivered receipt cannot promote/rewind a page or change a texture lease.
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience presented page save pending: ${this.progress.errorMessage(error as Error)}`);
    }
  }

  private writePrepared(prepared: PreparedReaderPageTurn, current: () => boolean): Promise<LocalReadingProgress> {
    const chapter = prepared.context.chapter;
    const scalarCount = prepared.context.layoutMap.scalarCount();
    const offset = prepared.page.startScalar;
    return persistReaderMeasuredProgress(this.progress.gateway, this.view.bookId(), chapter.chapterTitle,
      new CoreReadingAnchor(chapter.chapterIndex, offset, scalarCount === 0 ? 0 : offset / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.progress.layout(), current);
  }

  private commitCurrent(prepared: PreparedReaderPageTurn, lifecycle: number, generation: number): boolean {
    return this.view.isMountedToken(lifecycle) && !this.view.exiting() && generation === this.pageTurn.generation &&
      this.prepared.prepared === prepared && this.view.preparedIsFresh(prepared);
  }

  join(generation: number, presentedPersistence: boolean = false): void {
    const join = this.pageTurn.joinPersistence(generation, presentedPersistence,
      (prepared: PreparedReaderPageTurn): boolean => this.view.preparedIsFresh(prepared));
    if (join.action === 'rollback') {
      this.effects.retryAutomaticTurn();
      this.rollback();
      return;
    }
    if (join.action !== 'promote') return;
    const prepared = join.prepared;
    this.promote(prepared, join.stored);
    this.prepared.discardDestination();
    this.pageTurn.gesture = completeReaderPageGestureSettlement(this.pageTurn.gesture);
    if (this.view.simulation()) {
      const presentation = this.view.presentation();
      presentation.awaitingSlots = true;
      // Presentation owns the terminal display buffer beyond the Core ACK.
      presentation.session.retainTerminalFrame(generation);
      presentation.session.commitSlots(generation, prepared.direction);
      presentation.armDeadline(generation);
      return;
    }
    this.view.publish({ pageTurnInputOwned: false });
    // Keep the translated endpoint through the ArkUI scheduling callback.
    this.view.context().postFrameCallback(new ReaderUIFrameCallback((): void => this.finishPresentation(generation)));
  }

  private promote(prepared: PreparedReaderPageTurn, stored?: LocalReadingProgress): void {
    const lifecycle = this.view.lifecycle();
    const selection = this.view.selection();
    this.pageTurn.clearProjection();
    const origin = this.view.captureOrigin();
    this.view.publishDestination(prepared);
    const reverseDirection: ReaderPageTurnDirection = prepared.direction === 'next' ? 'previous' : 'next';
    const reverse = new PreparedReaderPageTurn(reverseDirection, origin.page, origin.context, origin.key,
      prepared.context.chapter.chapterIndex, prepared.page.startScalar, this.view.neighbourGeneration());
    this.pageTurn.setNeighbour(reverseDirection, reverse);
    this.view.presentation().phase = 'logicalPromoted';
    // The adjacent physical slot retains its subtree when it becomes current.
    this.view.publish({ pageTurnCurrentSlot: this.view.projection().pageTurnCurrentSlot === 'a' ? 'b' : 'a' });
    this.view.publish({ pageTurnRenderRevision: this.view.projection().pageTurnRenderRevision + 1 });
    if (stored !== undefined) this.progress.admit(stored);
    this.view.afterDestination(prepared, selection, lifecycle);
  }

  rollback(preserveGeneration: boolean = false): void {
    if (this.prepared.prepared !== undefined) return;
    if (this.frozenLayout === undefined) this.frozenLayout = this.view.layout();
    const presentation = this.view.presentation();
    this.view.publish({ pageTurnSettlementActive: true });
    presentation.phase = 'rollback';
    this.view.publish({ pageTurnInputOwned: true });
    this.prepared.releaseCommit();
    if (this.view.projection().pageTurnPresentationWidth <= 0) {
      this.view.publish({ pageTurnPresentationWidth: this.view.viewportWidth() });
    }
    const simulation = this.view.simulation();
    const generation = preserveGeneration ? this.pageTurn.generation :
      (simulation && presentation.motion !== undefined ? presentation.motion.generation : this.pageTurn.generation + 1);
    this.effects.publishAutomaticStart(undefined);
    this.pageTurn.generation = generation;
    presentation.surfaceGeneration = generation;
    // Hold the terminal buffer until the first valid frame of this generation.
    this.view.publish({ bookTurnSurfaceOpacity: simulation ?
      (presentation.motion !== undefined ? this.view.projection().bookTurnSurfaceOpacity : 0) : 1 });
    this.pageTurn.animationFinished = false;
    presentation.armDeadline(generation);
    if (simulation) {
      const inputActive = presentation.motion?.active === true;
      if (presentation.motion !== undefined) stopBookTurnMotion(presentation.motion);
      if (!(presentation.motion !== undefined && inputActive ?
        presentation.session.endGesture(bookTurnInput(presentation.motion), false) :
        presentation.session.settle(generation, false))) {
        this.view.publish({ bookTurnRuntimeFailed: true });
        this.finishRollback(generation);
      }
      return;
    }
    if (this.view.projection().pageTurnOffsetX === 0 || this.view.noAnimation()) {
      this.finishRollback(generation);
      return;
    }
    this.startSlide(0, generation);
  }

  private startSlide(targetOffset: number, generation: number): void {
    const projection = this.view.projection();
    this.pageTurn.startSlide(targetOffset, generation, {
      offset: projection.pageTurnOffsetX, width: projection.pageTurnPresentationWidth,
      velocity: this.pageTurn.gesture.velocityX, gestureUndecided: this.pageTurn.gesture.owner === 'undecided',
    }, this.slideHost);
  }

  finishRollback(generation: number): void {
    if (generation !== this.pageTurn.generation) return;
    if (this.origin === 'ttsFollow' && this.followLease !== undefined) this.effects.speechFollowFailed(this.followLease);
    this.pageTurn.clearProjection();
    this.effects.finishPerformance('rollback');
    this.effects.publishAutomaticStart(undefined);
    this.clearOrigin();
    this.prepared.cancelDeadline();
    this.pageTurn.animationFinished = true;
    this.view.publish({ pageTurnOffsetX: 0 });
    this.view.publish({ pageTurnDirection: { value: undefined } });
    this.pageTurn.gesture = completeReaderPageGestureSettlement(this.pageTurn.gesture);
    const presentation = this.view.presentation();
    if (this.view.simulation() && presentation.phase !== 'released' &&
      presentation.session.retainedTerminalGeneration() === generation) {
      if (this.view.mounted() && !this.view.exiting() && this.view.simulation() &&
        generation === this.pageTurn.generation && generation === presentation.surfaceGeneration) {
        presentation.armDeadline(generation);
        presentation.scheduleSurfaceRelease(generation);
      }
      return;
    }
    this.view.publish({ pageTurnInputOwned: false });
    this.view.publish({ pageTurnSettlementActive: false });
    this.clearLayout();
    this.view.publish({ pageTurnPresentationWidth: 0 });
    this.prepared.releaseCommit();
    presentation.motion = undefined;
    presentation.awaitingSlots = false;
    this.effects.clearBookmarkPreview();
    presentation.recoverIfIdle();
    this.effects.flushDeferredChrome();
    this.effects.retryRapid();
    this.resumeAndDrain();
    this.effects.rearmAutomaticAfterRollback();
    if (!this.view.simulation()) presentation.phase = 'idle';
    // TERMINAL_RELEASED refreshes the texture after ArkUI restored the page.
  }

  finishPresentation(generation: number): void {
    if (generation !== this.pageTurn.generation) return;
    this.effects.finishPerformance('committed');
    this.effects.publishAutomaticStart(undefined);
    this.clearOrigin();
    this.view.publish({ pageTurnOffsetX: 0 });
    this.view.publish({ pageTurnDirection: { value: undefined } });
    this.prepared.releaseCommit();
    this.view.publish({ pageTurnSettlementActive: false });
    this.prepared.cancelDeadline();
    this.clearLayout();
    this.view.publish({ pageTurnPresentationWidth: 0 });
    const presentation = this.view.presentation();
    presentation.motion = undefined;
    this.view.publish({ pageTurnInputOwned: false });
    presentation.awaitingSlots = false;
    presentation.recoverIfIdle();
    this.effects.flushDeferredChrome();
    this.pageTurn.completeRapid();
    this.resumeAndDrain();
    if (!this.view.simulation()) presentation.phase = 'idle';
  }

  private resumeAndDrain(): void {
    this.resumeDeferred();
    this.effects.drainRapid();
    this.effects.resumeAutomaticTurn();
    this.effects.resumeSpeechFollow();
    this.effects.drainPreparation();
  }

  resumeDeferred(): void {
    const work = this.pageTurn.takeDeferredWork(this.view.projection().pageTurnSettlementActive, this.view.mounted());
    if (work === undefined) return;
    const minimum = this.deferred.controlMinimum();
    this.deferred.clearControlMinimum();
    if (work.exit) {
      this.deferred.exit();
      return;
    }
    const lifecycle = this.view.lifecycle();
    switch (this.pageTurn.deferredChapterAction(work)) {
      case 'requested':
        this.deferred.requestedChapterChanged();
        break;
      case 'selected':
        if (work.selection !== undefined) this.deferred.selectChapter(work.selection);
        break;
      case 'replace':
        this.deferred.reloadReplacement(lifecycle, this.view.bookId());
        break;
      case 'projection':
        this.deferred.reloadProjection(lifecycle, work.projectionChapter);
        break;
    }
    if (work.appearance !== undefined) this.deferred.appearance(work.appearance);
    if (work.viewport !== undefined && work.viewport.width > 0 && work.viewport.height > 0) {
      this.deferred.viewport(work.viewport.width, work.viewport.height, lifecycle);
    }
    if (work.windowReflow) this.deferred.reflowWindow();
    if (work.windowSettings !== undefined) this.deferred.windowSettings(work.windowSettings);
    if (minimum !== undefined) this.deferred.admitControlMinimum(minimum);
  }

  clearDeferred(): void {
    this.pageTurn.clearDeferredWork();
    this.deferred.clearControlMinimum();
  }
}
