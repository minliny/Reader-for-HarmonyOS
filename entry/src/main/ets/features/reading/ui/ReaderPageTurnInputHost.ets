import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import type { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import type { ReaderFrozenPageTurnProjection, ReaderPageTurnGestureRenderer, ReaderPreparedNeighbourOwner,
  ReaderRapidPageTurnHost } from '../application/ReadingPageTurnCoordinator';
import { readerPageTransitionUsesPreparedPages, type ReaderSettingsSnapshot } from '../application/ReaderSettingsState';
import type { PreparedReaderPageTurn } from '../presentation/ReaderPagePresentationModels';
import {
  BOOK_TURN_TEXTURE_CURRENT, BOOK_TURN_TEXTURE_NEXT, BOOK_TURN_TEXTURE_PREVIOUS,
} from './BookTurnPresentationSession';
import { beginBookTurnMotion, bookTurnInput, updateBookTurnMotionInPlace } from './BookTurnMotionState';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { abandonReaderPageGestureTracking, completeReaderPageGestureSettlement, resumeReaderPagePan, type ReaderPageGestureState,
  type ReaderPageTapIntent, type ReaderPageTurnDirection, type ReaderPageTurnOutcome } from './ReaderPageGestureState';
import type { ReaderPageTurnPresentation } from './ReaderPageTurnPresentation';
import type { ReaderPageTurnPreparationHost } from './ReaderPageTurnPreparationHost';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import type { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import type { ReaderAdjacentPageEvidence } from './ReaderPhysicalPaginationOwner';
import type { ReadingPageTurnRenderSnapshot, ReadingPageTurnRenderUpdate, ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import type { ReaderSessionCapsuleSnapshot } from './ReaderSessionCapsuleModel';
import type { ReaderPageTurnOrigin, ReaderTtsFollowLease } from './ReaderTtsPageFollow';

export interface ReaderPageTurnInputScene {
  readonly mounted: () => boolean;
  readonly lifecycle: () => number;
  readonly exiting: () => boolean;
  readonly foreground: () => boolean;
  readonly interactionEnabled: () => boolean;
  readonly controlVisible: () => boolean;
  readonly automaticSurfaceBlocked: () => boolean;
  readonly progressInFlight: () => boolean;
  readonly canTurn: () => boolean;
  readonly inputPhase: () => 'idle' | 'tracking' | 'dragging' | 'settling';
  readonly noAnimation: () => boolean;
  readonly simulation: () => boolean;
  readonly settings: () => ReaderSettingsSnapshot;
  readonly viewportWidth: () => number;
  readonly speechFollowCurrent: (lease: ReaderTtsFollowLease) => boolean;
}

export interface ReaderPageTurnInputRender {
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly publish: (update: ReadingPageTurnRenderUpdate) => void;
  readonly layout: () => ReaderReadingLayoutSnapshot;
  readonly currentPage: () => ReaderPageTurnRenderPage;
  readonly preparedPage: (direction: ReaderPageTurnDirection) => ReaderPageTurnRenderPage | undefined;
  readonly captureCapsule: () => ReaderSessionCapsuleSnapshot | undefined;
  readonly native: () => ReaderPageTurnPresentation<PreparedReaderPageTurn>;
  readonly continuousSurface: () => ReaderReadingSurfaceHost;
}

export interface ReaderPageTurnInputDocument {
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly preparation: () => ReaderPageTurnPreparationHost;
  readonly neighbourOwner: () => ReaderPreparedNeighbourOwner;
  readonly currentPaginationKey: () => ReadingPaginationKey;
  readonly paginationKey: (chapter: number) => ReadingPaginationKey | undefined;
  readonly adjacentEvidence: (page: PhysicalReadingPage, chapter: ReadingSessionChapter) => ReaderAdjacentPageEvidence;
  readonly adjacentChapter: (chapter: number, step: number) => number | undefined;
  readonly catalogPending: () => boolean;
  readonly catalogInFlight: () => boolean;
  readonly chapterPosition: (chapter: number) => number | undefined;
  readonly catalogCount: () => number | undefined;
  readonly hydrateCatalog: () => Promise<void>;
  readonly requireLayoutMap: () => ReadingSurfaceLayoutMap;
  readonly lastVisible: (text: string, map: ReadingSurfaceLayoutMap) => number;
  readonly measureCommittedPage: (offset: number) => void;
  readonly discoverPredecessor: (chapter: number, origin: number) => boolean;
  readonly startPreviousChapter: (chapter: number, originChapter: number, originOffset: number) => boolean;
  readonly openChapter: (chapter: number, offset: number) => boolean;
}

export interface ReaderPageTurnInputEffects {
  readonly invalidateSpeechFollow: () => void;
  readonly cancelAutomaticStart: () => void;
  readonly cancelPendingAutomaticTurn: () => void;
  readonly resumeAutomaticTurn: () => void;
  readonly resumeSpeechFollow: () => void;
  readonly openControl: () => void;
  readonly rollbackForDeferredMutation: () => void;
  readonly finishInterruptedBookmark: () => void;
  readonly flushDeferredChrome: () => void;
  readonly prefetchInteraction: (manual: boolean) => void;
  readonly beginPerformance: (direction: ReaderPageTurnDirection, path: 'gesture' | 'direct') => void;
  readonly finishPerformance: (result: string) => void;
}

/** Owns a held physical pointer segment and its frozen page/capsule. The
 * application coordinator remains the authority for gesture decisions and
 * rapid direction. This host connects those decisions to mounted surfaces. */
export class ReaderPageTurnInputHost {
  private readonly settlement: ReaderPageTurnSettlementHost;
  private readonly scene: ReaderPageTurnInputScene;
  private readonly render: ReaderPageTurnInputRender;
  private readonly document: ReaderPageTurnInputDocument;
  private readonly effects: ReaderPageTurnInputEffects;
  private readonly rapid: ReaderRapidPageTurnHost;
  private readonly gestureRenderer: ReaderPageTurnGestureRenderer;
  private heldPointer: number = -1;
  private epoch: number = 0;
  private startedSerial: number = 0;
  private frozenCapsule: ReaderSessionCapsuleSnapshot | undefined = undefined;

  constructor(settlement: ReaderPageTurnSettlementHost, scene: ReaderPageTurnInputScene, render: ReaderPageTurnInputRender,
    document: ReaderPageTurnInputDocument, effects: ReaderPageTurnInputEffects) {
    this.settlement = settlement;
    this.scene = scene;
    this.render = render;
    this.document = document;
    this.effects = effects;
    this.gestureRenderer = {
      simulation: (): boolean => this.scene.simulation(),
      slide: (): boolean => this.requiresPreparedPage() && !this.scene.noAnimation(),
    };
    this.rapid = {
      invalidateSpeechFollow: (): void => this.effects.invalidateSpeechFollow(),
      lifecycleActive: (): boolean => this.scene.mounted() && !this.scene.exiting(),
      interactionEnabled: (): boolean => this.scene.interactionEnabled(),
      controlVisible: (): boolean => this.scene.controlVisible(),
      directBoundary: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome | undefined =>
        this.continuous() || !this.scene.canTurn() ? undefined : this.knownBoundary(direction),
      finishDirectGesture: (): void => this.finishDirect(),
      pointerHeld: (): boolean => this.heldPointer >= 0,
      workInFlight: (): boolean => this.render.projection().pageTurnSettlementActive ||
        this.settlement.prepared.prepared !== undefined || this.document.preparation().pending !== undefined ||
        this.scene.progressInFlight(),
      openControl: (): void => this.effects.openControl(),
      canTurnPage: (): boolean => this.scene.canTurn(),
      continuous: (): boolean => this.continuous(),
      requiresPreparedPage: (): boolean => this.requiresPreparedPage() && !this.scene.noAnimation(),
      prepared: (direction: ReaderPageTurnDirection): boolean => this.prepared(direction) !== undefined,
      prepare: (direction: ReaderPageTurnDirection): void => this.document.preparation().enqueue(direction),
      prioritize: (direction: ReaderPageTurnDirection): void => {
        this.render.native().texture.preferredDirection = direction;
        this.document.preparation().promoteQueued(direction);
      },
      perform: (direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => this.perform(direction),
      recordStarted: (): void => { this.startedSerial += 1; },
    };
  }

  get pointerId(): number { return this.heldPointer; }
  get pointerEpoch(): number { return this.epoch; }
  get transactionSerial(): number { return this.startedSerial; }
  get capsule(): ReaderSessionCapsuleSnapshot | undefined { return this.frozenCapsule; }

  private continuous(): boolean { return this.scene.settings().navigationMode === 'continuous'; }
  private requiresPreparedPage(): boolean { return readerPageTransitionUsesPreparedPages(this.scene.settings()); }

  acquirePointer(pointerId: number): boolean {
    if (this.heldPointer >= 0 || this.render.projection().textSelectionActive || !this.scene.interactionEnabled()) return false;
    const gesture = this.settlement.pageTurn.gesture;
    if (gesture.owner === 'bookmark' && gesture.phase === 'settling') return false;
    this.heldPointer = pointerId;
    this.effects.invalidateSpeechFollow();
    this.effects.cancelAutomaticStart();
    this.epoch += 1;
    return true;
  }

  releasePointer(pointerId: number): void {
    if (this.heldPointer !== pointerId) return;
    this.heldPointer = -1;
    this.schedulePointerCompletion();
  }

  private schedulePointerCompletion(): void {
    const epoch = this.epoch;
    const lifecycle = this.scene.lifecycle();
    // The UP/CANCEL callback must finish publishing its intent first.
    setTimeout((): void => {
      if (!this.scene.mounted() || lifecycle !== this.scene.lifecycle() || epoch !== this.epoch || this.heldPointer >= 0) return;
      this.drain();
      this.effects.resumeAutomaticTurn();
      this.effects.resumeSpeechFollow();
      this.document.preparation().drain();
    }, 0);
  }

  retirePointer(): void {
    const phase = this.scene.inputPhase();
    const turn = this.settlement.pageTurn;
    const bookmark = turn.gesture.owner === 'bookmark';
    if (this.heldPointer < 0 && !turn.deferredPointerReserved && !bookmark && phase !== 'tracking' && phase !== 'dragging') return;
    this.render.publish({ pageTurnInputRevision: this.render.projection().pageTurnInputRevision + 1 });
    this.heldPointer = -1;
    this.epoch += 1;
    turn.releaseDeferredPointer();
    if (bookmark) {
      this.effects.finishInterruptedBookmark();
      if (this.scene.foreground() && !this.scene.exiting()) this.schedulePointerCompletion();
    } else if (phase === 'tracking' && this.render.projection().textSelectionActive) {
      this.gestureChanged(abandonReaderPageGestureTracking(turn.gesture));
    } else if (phase === 'tracking' || phase === 'dragging') {
      this.effects.rollbackForDeferredMutation();
    }
  }

  clearCapsule(): void {
    this.render.publish({ pageTurnSessionCapsuleFrozen: false });
    this.frozenCapsule = undefined;
  }

  preparedIsFresh(prepared: PreparedReaderPageTurn): boolean {
    return this.settlement.pageTurn.freshPrepared(prepared, this.document.neighbourOwner());
  }

  prepared(direction: ReaderPageTurnDirection): PreparedReaderPageTurn | undefined {
    return this.settlement.pageTurn.preparedPageTurn(direction, this.heldPointer >= 0, this.document.neighbourOwner());
  }

  canStart(direction: ReaderPageTurnDirection): boolean {
    // A ready neighbour wins over unrelated speculative layout immediately.
    if (this.document.measured().adjacentMeasurementContext !== undefined && this.prepared(direction) !== undefined) {
      this.document.preparation().suspend();
    }
    if (!this.scene.canTurn()) return false;
    if (!this.requiresPreparedPage() || this.scene.noAnimation()) return true;
    const prepared = this.prepared(direction);
    if (prepared === undefined) return false;
    const turn = this.settlement.pageTurn;
    if (!this.scene.simulation()) {
      turn.admitPrepared(prepared);
      return true;
    }
    const native = this.render.native();
    if (this.render.projection().bookTurnRuntimeFailed ||
      (native.motion !== undefined && native.motion.direction !== direction)) return false;
    const current = this.render.currentPage();
    const adjacent = this.render.preparedPage(direction);
    const ready = adjacent !== undefined &&
      native.session.capturedIdentity(BOOK_TURN_TEXTURE_CURRENT) === current.textureIdentity &&
      native.session.capturedIdentity(direction === 'next' ? BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS) === adjacent.textureIdentity &&
      native.session.canStart(direction);
    if (ready) turn.admitPrepared(prepared);
    return ready;
  }

  private freeze(): void {
    this.settlement.pageTurn.freeze((): ReaderFrozenPageTurnProjection<ReaderReadingLayoutSnapshot, ReaderPageTurnRenderPage> => {
      const layout = this.render.layout();
      const current = this.render.currentPage();
      const previous = this.render.preparedPage('previous');
      const next = this.render.preparedPage('next');
      return { layout, current, previous, next, revision: this.render.projection().pageTurnRenderRevision };
    });
  }

  regrab(width: number, height: number, x: number, y: number, time: number,
    requestedDirection: ReaderPageTurnDirection): ReaderPageGestureState | undefined {
    // A same-direction drag asks for another page; reversing can catch this one.
    const direction = this.render.projection().pageTurnDirection;
    const turn = this.settlement.pageTurn;
    if (requestedDirection === direction || direction === undefined ||
      !turn.canRegrab(this.render.projection().pageTurnSettlementActive, direction)) return undefined;
    let offset = this.render.projection().pageTurnOffsetX;
    const native = this.render.native();
    if (this.scene.simulation()) {
      const motion = beginBookTurnMotion(turn.generation + 1, direction, false, width, height, x, y, x, y, time);
      const frame = native.session.regrab(bookTurnInput(motion), turn.generation);
      if (frame === undefined) return undefined;
      offset = frame.edgeX - (direction === 'next' ? width : 0);
      native.motion = motion;
      native.surfaceGeneration = motion.generation;
    } else if (!turn.hasSlide()) {
      return undefined;
    } else {
      const liveOffset = turn.slidePosition(time);
      if (liveOffset !== undefined) offset = liveOffset;
    }
    turn.cancelSlide();
    if (!this.scene.simulation()) this.settlement.cancelSlideAnimation(offset);
    this.settlement.prepared.cancelDeadline();
    turn.generation += 1;
    this.render.publish({ pageTurnSettlementActive: false });
    this.settlement.prepared.discardDestination();
    this.settlement.prepared.clearResult();
    // Only the replaced intent retires. Queued requests remain behind the pointer.
    turn.completeRapid(direction);
    native.phase = 'tracking';
    return resumeReaderPagePan(direction, offset, width, height, x, y, time);
  }

  gestureChanged(state: ReaderPageGestureState): void {
    const turn = this.settlement.pageTurn;
    const previousPhase = turn.gesture.phase;
    const gestureActive = state.phase === 'tracking' || state.phase === 'dragging';
    if (gestureActive && turn.frozen(this.render.projection().pageTurnRenderRevision) === undefined) this.freeze();
    if (state.phase === 'idle') turn.clearProjection();
    if (!this.render.projection().pageTurnSessionCapsuleFrozen && gestureActive) {
      this.frozenCapsule = this.render.captureCapsule();
      this.render.publish({ pageTurnSessionCapsuleFrozen: true });
    }
    turn.gesture = state;
    const native = this.render.native();
    const phase = turn.gesturePresentationPhase(state.phase, state.settleTarget === 'rollback',
      this.render.projection().pageTurnSettlementActive);
    if (phase !== undefined) native.phase = phase;
    if (state.phase === 'dragging' && state.direction !== undefined) this.effects.beginPerformance(state.direction, 'gesture');
    const ownsInput = state.phase !== 'idle';
    if (this.render.projection().pageTurnInputOwned !== ownsInput) this.render.publish({ pageTurnInputOwned: ownsInput });
    const action = turn.gestureAction(state, this.gestureRenderer);
    if (action === 'simulation') {
      if (previousPhase === 'idle' && state.phase !== 'idle') {
        // A stale dispatched snapshot may finish, but cannot upload a first frame for this gesture.
        native.texture.invalidate(true);
      }
      this.updateNativeGesture(state);
      return;
    }
    if (action === 'direct') {
      this.render.publish({ pageTurnDirection: { value: undefined } });
      this.render.publish({ pageTurnOffsetX: 0 });
      if (state.phase === 'settling' && state.settleTarget === 'rollback') {
        turn.gesture = completeReaderPageGestureSettlement(state);
        this.render.publish({ pageTurnInputOwned: false });
        native.phase = 'idle';
      }
      if (turn.gesture.phase === 'idle') this.effects.flushDeferredChrome();
      return;
    }
    if (action === 'slideDrag' && state.direction !== undefined) {
      if (this.prepared(state.direction) !== undefined) {
        this.render.publish({ pageTurnDirection: { value: state.direction } });
        this.render.publish({ pageTurnOffsetX: this.clampOffset(state.direction, state.currentOffsetX) });
      } else {
        this.queueMissingDragDirection(state.direction);
        this.render.publish({ pageTurnDirection: { value: undefined } });
        this.render.publish({ pageTurnOffsetX: 0 });
      }
      return;
    }
    if (action === 'rollback') {
      this.settlement.rollback();
      return;
    }
    if (action === 'reset') {
      this.render.publish({ pageTurnDirection: { value: undefined } });
      this.render.publish({ pageTurnOffsetX: 0 });
      this.effects.flushDeferredChrome();
      this.drainIdlePreparation(state);
    }
  }

  private updateNativeGesture(state: ReaderPageGestureState): void {
    this.render.publish({ pageTurnOffsetX: 0 });
    const native = this.render.native();
    if (state.phase === 'dragging' && state.direction !== undefined && state.owner === 'horizontalPage') {
      if (this.prepared(state.direction) === undefined) {
        this.queueMissingDragDirection(state.direction);
        return;
      }
      this.render.publish({ pageTurnDirection: { value: state.direction } });
      if (native.motion === undefined) {
        native.motion = beginBookTurnMotion(this.settlement.pageTurn.generation + 1, state.direction, false,
          state.viewportWidth, state.viewportHeight, state.startLocalX, state.startLocalY,
          state.currentLocalX, state.currentLocalY, state.eventTimeMs);
        native.surfaceGeneration = native.motion.generation;
        // The first successful native frame reveals the surface.
        this.render.publish({ bookTurnSurfaceOpacity: 0 });
      } else {
        updateBookTurnMotionInPlace(native.motion, state.currentLocalX, state.currentLocalY, state.eventTimeMs);
      }
      if (!native.session.updateInput(bookTurnInput(native.motion))) native.fail();
      return;
    }
    if (state.phase === 'settling' && state.settleTarget === 'rollback') {
      this.settlement.rollback();
      return;
    }
    if (state.phase === 'tracking' || state.phase === 'idle') {
      this.render.publish({ pageTurnDirection: { value: undefined } });
      native.motion = undefined;
      this.effects.flushDeferredChrome();
      this.drainIdlePreparation(state);
    }
  }

  private clampOffset(direction: ReaderPageTurnDirection, offset: number): number {
    const width = Math.max(0, this.scene.viewportWidth());
    return direction === 'next' ? Math.max(-width, Math.min(0, offset)) : Math.min(width, Math.max(0, offset));
  }

  private queueMissingDragDirection(direction: ReaderPageTurnDirection): void {
    const preparation = this.document.preparation();
    // Drain's gesture guard leaves speculative measurement until input retires.
    if (!preparation.contains(direction)) {
      hilog.info(0x5244, 'Reader', 'DRAGFOLLOW gate-miss dir=%{public}s queued=true', direction);
    }
    preparation.enqueue(direction);
  }

  private drainIdlePreparation(state: ReaderPageGestureState): void {
    if (state.phase === 'idle' && this.document.preparation().hasQueued()) this.document.preparation().drain();
  }

  request(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome {
    return this.settlement.pageTurn.request(direction, this.rapid);
  }

  retryRapid(): void {
    this.settlement.pageTurn.retryRapid((): void => {
      console.error('ReadingExperience rapid page turn stopped after repeated single-page failures');
    });
  }

  drain(): ReaderPageTurnOutcome {
    return this.settlement.pageTurn.drain(this.rapid);
  }

  reserveDeferred(): boolean {
    this.effects.cancelPendingAutomaticTurn();
    return this.settlement.pageTurn.reserveDeferredPointer();
  }

  resolveDeferred(intent: ReaderPageTapIntent | undefined): void {
    const turn = this.settlement.pageTurn;
    if (!turn.deferredPointerReserved) return;
    turn.releaseDeferredPointer();
    if (intent === 'control') {
      turn.requestControl();
      this.drain();
    } else if (intent !== undefined) {
      this.request(intent);
    } else {
      this.drain();
    }
  }

  /** Shared mounted entry for manual input, automatic paging and speech follow. */
  perform(direction: ReaderPageTurnDirection, origin: ReaderPageTurnOrigin = 'manual',
    ttsOwner?: ReaderTtsFollowLease): ReaderPageTurnOutcome {
    const turn = this.settlement.pageTurn;
    if (origin === 'manual' && !this.scene.interactionEnabled()) return { kind: 'blocked', reason: 'overlay' };
    if (origin !== 'manual' && (!this.scene.mounted() || this.scene.automaticSurfaceBlocked() ||
      turn.deferredPointerReserved || this.render.projection().pageTurnSettlementActive ||
      this.settlement.prepared.prepared !== undefined || this.scene.progressInFlight() || turn.hasRapidWork())) return { kind: 'busy' };
    if (origin === 'ttsFollow' && (ttsOwner === undefined || !this.scene.speechFollowCurrent(ttsOwner))) {
      return { kind: 'blocked', reason: 'lifecycle' };
    }
    if (this.heldPointer >= 0) return { kind: 'busy' };
    this.effects.prefetchInteraction(origin === 'manual');
    if (this.continuous()) return this.render.continuousSurface().performContinuousPageTurn(direction);
    if (!this.scene.canTurn()) {
      this.effects.finishPerformance('busy');
      this.finishDirect();
      return { kind: 'busy' };
    }
    const prepared = this.requiresPreparedPage() ? this.prepared(direction) : undefined;
    if (this.scene.simulation() && prepared === undefined) {
      const boundary = this.knownBoundary(direction);
      if (boundary !== undefined) {
        this.effects.finishPerformance('boundary');
        this.finishDirect();
        return boundary;
      }
    }
    if (this.scene.simulation() && (prepared === undefined || !this.canStart(direction))) {
      this.document.preparation().enqueue(direction);
      this.render.native().texture.schedule();
      return { kind: 'preparing' };
    }
    if (prepared !== undefined && this.settlement.start(direction, prepared, origin, ttsOwner)) return { kind: 'started' };
    const result = direction === 'previous' ? this.turnPrevious() : this.turnNext();
    if (result.kind === 'started') this.effects.beginPerformance(direction, 'direct');
    else this.effects.finishPerformance(result.kind);
    this.finishDirect();
    return result;
  }

  finishDirect(): void {
    const turn = this.settlement.pageTurn;
    if (turn.gesture.phase !== 'settling') return;
    if (this.render.projection().pageTurnOffsetX !== 0) {
      this.settlement.rollback();
      return;
    }
    this.render.publish({ pageTurnDirection: { value: undefined } });
    turn.gesture = completeReaderPageGestureSettlement(turn.gesture);
    this.render.publish({ pageTurnInputOwned: false });
    turn.clearProjection();
    this.effects.flushDeferredChrome();
    this.document.preparation().drain();
  }

  isUnknownCatalogEdge(chapterIndex: number, direction: ReaderPageTurnDirection): boolean {
    if (!this.document.catalogPending() ||
      this.document.adjacentChapter(chapterIndex, direction === 'next' ? 1 : -1) !== undefined) return false;
    const position = this.document.chapterPosition(chapterIndex);
    const count = this.document.catalogCount();
    return position === undefined || count === undefined || (direction === 'next' ? position + 1 < count : position > 0);
  }

  requestCatalog(): void {
    if (this.document.catalogInFlight()) return;
    void this.document.hydrateCatalog().catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', 'Reading turn catalog: %{private}s', errorMessageOf(error));
    });
  }

  /** A boundary must be proven by the admitted materialized page and catalog. */
  knownBoundary(direction: ReaderPageTurnDirection): ReaderPageTurnOutcome | undefined {
    const measured = this.document.measured();
    const page = measured.page;
    const chapter = measured.chapter;
    if (page === undefined || chapter === undefined || chapter.documentRange !== undefined) return undefined;
    if (this.isUnknownCatalogEdge(chapter.chapterIndex, direction)) return undefined;
    const edge = measured.physicalPagination.knownBoundary(direction, this.document.adjacentEvidence(page, chapter),
      (): number | undefined => measured.nativeMeasurement.chapterRanges[0]?.startScalar);
    return edge === undefined ? undefined : { kind: 'boundary', edge };
  }

  private turnNext(): ReaderPageTurnOutcome {
    if (!this.scene.canTurn()) return { kind: 'busy' };
    const measured = this.document.measured();
    const page = measured.page as PhysicalReadingPage;
    const chapter = measured.chapter as ReadingSessionChapter;
    const draft = measured.physicalPagination.draft;
    const nextOffset = draft?.matches(this.document.currentPaginationKey()) === true ?
      draft.nextRequestForPageStart(page.startScalar) ?? page.endScalar : page.endScalar;
    const lastVisible = this.document.lastVisible(chapter.content, this.document.requireLayoutMap());
    if (nextOffset <= lastVisible) {
      this.document.measureCommittedPage(nextOffset);
      return { kind: 'started' };
    }
    const nextChapter = this.document.adjacentChapter(chapter.chapterIndex, 1);
    if (nextChapter === undefined) {
      if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'next')) {
        this.requestCatalog();
        return { kind: 'preparing' };
      }
      return { kind: 'boundary', edge: 'end' };
    }
    return this.document.openChapter(nextChapter, 0) ? { kind: 'started' } : { kind: 'busy' };
  }

  private turnPrevious(): ReaderPageTurnOutcome {
    if (!this.scene.canTurn()) return { kind: 'busy' };
    const measured = this.document.measured();
    const page = measured.page as PhysicalReadingPage;
    const chapter = measured.chapter as ReadingSessionChapter;
    const key = this.document.currentPaginationKey();
    const previousChapter = this.document.adjacentChapter(chapter.chapterIndex, -1);
    const pagination = measured.physicalPagination;
    const indexed = pagination.index.findContainingPage(key, page.startScalar);
    const containing = indexed?.startScalar === page.startScalar && indexed.endScalarExclusive === page.endScalar ? indexed : undefined;
    const measuredPrevious = pagination.draft?.matches(key) === true ?
      pagination.draft.previousRequestForPageStart(page.startScalar) : undefined;
    if (measuredPrevious !== undefined) {
      this.document.measureCommittedPage(measuredPrevious);
      return { kind: 'started' };
    }
    if (containing === undefined) {
      const prefix = pagination.draft;
      const previousRequest = prefix !== undefined && prefix.matches(key) ? prefix.previousRequestForPageStart(page.startScalar) : undefined;
      if (previousRequest !== undefined) {
        this.document.measureCommittedPage(previousRequest);
        return { kind: 'started' };
      }
      if (previousChapter !== undefined && this.document.requireLayoutMap().residentStart() === 0 &&
        measured.nativeMeasurement.chapterRanges.length > 0 && page.startScalar <= measured.nativeMeasurement.chapterRanges[0].startScalar) {
        return this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, page.startScalar) ? { kind: 'started' } : { kind: 'busy' };
      }
      if (previousChapter === undefined && this.document.requireLayoutMap().residentStart() === 0 &&
        measured.nativeMeasurement.chapterRanges.length > 0 && page.startScalar <= measured.nativeMeasurement.chapterRanges[0].startScalar) {
        if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
          this.requestCatalog();
          return { kind: 'preparing' };
        }
        return { kind: 'boundary', edge: 'start' };
      }
      // A deep restore may need reverse measurement at this exact page start.
      return this.document.discoverPredecessor(chapter.chapterIndex, page.startScalar) ? { kind: 'started' } : { kind: 'busy' };
    }
    if (containing.pageIndex === 0 && previousChapter !== undefined && this.document.paginationKey(previousChapter) === undefined) {
      return this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, page.startScalar) ? { kind: 'started' } : { kind: 'busy' };
    }
    if (containing.pageIndex === 0 && previousChapter === undefined) {
      if (this.isUnknownCatalogEdge(chapter.chapterIndex, 'previous')) {
        this.requestCatalog();
        return { kind: 'preparing' };
      }
      return { kind: 'boundary', edge: 'start' };
    }
    const previousKey = containing.pageIndex === 0 && previousChapter !== undefined ?
      this.document.paginationKey(previousChapter) as ReadingPaginationKey : null;
    const previous = pagination.index.findPreviousPage(key, page.startScalar, previousKey);
    if (previous.kind === 'manifestRequired' && previousChapter !== undefined && previous.key.chapterIndex === previousChapter) {
      return this.turnToPreviousChapter(previousChapter, chapter.chapterIndex, page.startScalar) ? { kind: 'started' } : { kind: 'busy' };
    }
    if (previous.kind !== 'page') return previousChapter === undefined ? { kind: 'boundary', edge: 'start' } : { kind: 'busy' };
    if (previous.page.key.chapterIndex === chapter.chapterIndex) {
      this.document.measureCommittedPage(previous.page.startScalar);
      return { kind: 'started' };
    }
    return this.document.openChapter(previous.page.key.chapterIndex, previous.page.startScalar) ?
      { kind: 'started' } : { kind: 'busy' };
  }

  turnToPreviousChapter(chapter: number, originChapter: number, originOffset: number): boolean {
    if (this.continuous()) return this.document.openChapter(chapter, Number.MAX_SAFE_INTEGER);
    const key = this.document.paginationKey(chapter);
    if (key !== undefined) {
      const last = this.document.measured().physicalPagination.index.findLastPage(key);
      if (last !== undefined) return this.document.openChapter(chapter, last.startScalar);
    }
    return this.document.startPreviousChapter(chapter, originChapter, originOffset);
  }
}
