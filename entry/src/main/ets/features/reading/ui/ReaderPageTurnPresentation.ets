import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { BOOK_TURN_EVENT_SLOTS_COMMITTED, BOOK_TURN_EVENT_TERMINAL_RELEASED,
  BookTurnNativeEvent, BookTurnPresentationSession } from './BookTurnPresentationSession';
import type { BookTurnMotionState } from './BookTurnMotionState';
import { readerPageTurnNativeEvent, type ReaderPageTurnNativeHost } from './ReaderPageTurnNativeHost';
import { cancelReaderPagePan, type ReaderPageGestureState } from './ReaderPageGestureState';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';
import type { ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import type { ReaderPageTurnFrameEvidence, ReaderPageTurnNativeEvidence, ReaderPageTurnNativeEvent,
  ReaderPageTurnPresentationPhase } from '../application/ReadingPageTurnCoordinator';
import type { ReaderPreparedPageSettlement } from '../application/ReaderPreparedPageSettlement';
import type { ReadingPageTurnRenderSnapshot, ReadingPageTurnRenderUpdate } from './ReaderReadingSurfaceHost';

interface ReaderPageTurnNativePolicy {
  generation: number;
  animationFinished: boolean;
  gesture: ReaderPageGestureState;
  nativeEvent(event: ReaderPageTurnNativeEvent, generation: number, evidence: ReaderPageTurnNativeEvidence): ReaderPageTurnNativeEvent | undefined;
  confirmFrame(generation: number, evidence: ReaderPageTurnFrameEvidence): boolean;
  canScheduleFrame(generation: number, evidence: ReaderPageTurnFrameEvidence): boolean;
  recordVisualEndpoint(generation: number, lifecycle: number): void;
}

export interface ReaderPageTurnPresentationView {
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly lifecycle: () => number;
  readonly surfaceMounted: () => boolean;
  readonly simulation: () => boolean;
  readonly inputPhase: () => 'idle' | 'tracking' | 'dragging' | 'settling';
  readonly viewportWidth: () => number;
  readonly viewportHeight: () => number;
  readonly reduceMotion: () => boolean;
  readonly textureIdentity: () => string;
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly publish: (update: ReadingPageTurnRenderUpdate) => void;
  readonly context: () => UIContext;
  readonly errorMessage: (error: Error) => string;
}

export interface ReaderPageTurnPresentationEffects {
  readonly textureReady: () => void;
  readonly framePresented: (event: BookTurnNativeEvent) => void;
  readonly finishCommit: (generation: number) => void;
  readonly finishRollback: (generation: number) => void;
  readonly finishSuccessfulPresentation: (generation: number) => void;
  readonly automaticStartPending: () => boolean;
  readonly clearAutomaticStart: () => void;
  readonly cancelAutomaticStart: () => void;
  readonly animateRollback: () => void;
  readonly onPresentationReady: () => void;
  readonly handoffPendingProgress: () => void;
  readonly releaseRecoveryInput: () => void;
}

/** Owns the resident ArkUI/native slot admission, fallback and terminal
 * release. Native generations and ArkUI ready/scheduled revisions each keep
 * a separate lease; a durable commit alone cannot release a display slot. */
export class ReaderPageTurnPresentation<TPrepared> {
  readonly session: BookTurnPresentationSession;
  readonly texture: ReaderPageTurnNativeHost;
  motion: BookTurnMotionState | undefined = undefined;
  phase: ReaderPageTurnPresentationPhase = 'idle';
  surfaceGeneration: number = 0;
  scheduledRevision: number = -1;
  readyRevision: number = -1;
  staticFallbackPending: boolean = false;
  surfaceRecoveryPending: boolean = false;
  awaitingSlots: boolean = false;
  private readonly policy: ReaderPageTurnNativePolicy;
  private readonly prepared: ReaderPreparedPageSettlement<TPrepared>;
  private readonly view: ReaderPageTurnPresentationView;
  private readonly effects: ReaderPageTurnPresentationEffects;
  private readonly nativeTurnEvidence: ReaderPageTurnNativeEvidence;

  constructor(componentId: string, policy: ReaderPageTurnNativePolicy, prepared: ReaderPreparedPageSettlement<TPrepared>,
    texture: (session: BookTurnPresentationSession) => ReaderPageTurnNativeHost,
    view: ReaderPageTurnPresentationView, effects: ReaderPageTurnPresentationEffects) {
    this.policy = policy;
    this.prepared = prepared;
    this.view = view;
    this.effects = effects;
    this.session = new BookTurnPresentationSession(componentId);
    this.texture = texture(this.session);
    this.nativeTurnEvidence = {
      mounted: (): boolean => this.view.mounted(),
      surfaceMounted: (): boolean => this.view.surfaceMounted(),
      simulation: (): boolean => this.view.simulation(),
      active: (): boolean => this.view.projection().pageTurnSettlementActive,
      surfaceGeneration: (): number => this.surfaceGeneration,
      automaticStartPending: (): boolean => this.effects.automaticStartPending(),
      awaitingSlots: (): boolean => this.awaitingSlots,
      phase: (): ReaderPageTurnPresentationPhase => this.phase,
    };
  }

  updateHighlights(identity: string, rects: ReaderDynamicHighlightRect[]): void {
    if (!this.view.mounted() || !this.view.simulation() || identity !== this.view.textureIdentity()) return;
    try {
      this.texture.updateHighlights(identity, rects);
    } catch (error) {
      hilog.error(0x5244, 'Reader', '%{private}s', this.view.errorMessage(error as Error));
      this.fail();
    }
  }

  surfaceLoaded(): void {
    if (!this.view.mounted() || !this.view.simulation()) return;
    this.session.configure(this.view.viewportWidth(), this.view.viewportHeight());
    this.texture.schedule();
  }

  onNativeEvent(event: BookTurnNativeEvent): void {
    const kind = readerPageTurnNativeEvent(event.event);
    if (kind === undefined) return;
    switch (this.policy.nativeEvent(kind, event.generation, this.nativeTurnEvidence)) {
      case 'surfaceReady':
        this.texture.replaceSurface();
        this.surfaceRecoveryPending = true;
        // READY can replace a generation whose old LOST was discarded at the JS queue boundary.
        if (this.view.projection().pageTurnSettlementActive || this.motion !== undefined) this.fail(true);
        this.recoverIfIdle();
        return;
      case 'textureReady':
        this.texture.replayHighlights();
        this.view.publish({ pageTurnReadinessRevision: this.view.projection().pageTurnReadinessRevision + 1 });
        this.effects.textureReady();
        return;
      case 'framePresented':
        // Hide the previous EGL buffer until the accepted generation draws.
        this.view.publish({ bookTurnSurfaceOpacity: 1 });
        this.effects.framePresented(event);
        return;
      case 'commitEndpoint':
        this.policy.recordVisualEndpoint(event.generation, this.view.lifecycle());
        this.effects.finishCommit(event.generation);
        return;
      case 'rollbackComplete':
        this.effects.finishRollback(event.generation);
        return;
      case 'slotsCommitted':
        this.awaitingSlots = false;
        // Re-announce the logical owner after the native barrier. Its earlier watch may have
        // arrived while slots were still pending. The scheduled frame is not a display fence.
        this.view.publish({ pageTurnRenderRevision: this.view.projection().pageTurnRenderRevision + 1 });
        this.scheduleSurfaceRelease(event.generation);
        return;
      case 'terminalReleased':
        this.phase = 'released';
        if (this.prepared.commitSucceeded) this.effects.finishSuccessfulPresentation(event.generation);
        else this.effects.finishRollback(event.generation);
        this.phase = 'idle';
        this.texture.schedule();
        return;
      case 'surfaceFailed':
        // A deliberate simulation teardown was discarded at event admission.
        this.fail();
        return;
    }
  }

  recoverIfIdle(): void {
    if (!this.surfaceRecoveryPending || !this.view.mounted() || this.view.exiting() ||
      !this.view.surfaceMounted() || this.view.projection().pageTurnSettlementActive || this.motion !== undefined) return;
    this.surfaceRecoveryPending = false;
    this.view.publish({ bookTurnRuntimeFailed: false });
    this.awaitingSlots = false;
    this.view.publish({ bookTurnSurfaceOpacity: 0 });
    this.phase = 'idle';
    this.session.configure(this.view.viewportWidth(), this.view.viewportHeight());
    this.texture.schedule();
  }

  fail(recoverWhenIdle: boolean = false): void {
    this.effects.clearAutomaticStart();
    this.surfaceRecoveryPending = recoverWhenIdle;
    this.view.publish({ bookTurnRuntimeFailed: true });
    this.view.publish({ bookTurnSurfaceOpacity: 0 });
    this.session.clearCapturedTextures();
    // Once the visual endpoint has been reported, the Core transaction owns
    // the result. Keep that atomic decision and reveal the static admitted
    // page when it finishes; before the endpoint no progress write has begun.
    if (this.policy.animationFinished && this.prepared.commitStarted) {
      // Once the authoritative page is promoted, lost Native slots have no
      // remaining decision to make. Do not retry their old generation forever.
      if (this.prepared.commitFinished && this.prepared.commitSucceeded && this.prepared.prepared === undefined) {
        this.requestStaticFallback(this.policy.generation);
      }
      return;
    }
    this.prepared.discardDestination();
    this.prepared.releaseCommit();
    this.prepared.clearResult();
    if (!this.view.projection().pageTurnSettlementActive && this.motion === undefined &&
      this.policy.gesture.phase !== 'dragging' && this.policy.gesture.phase !== 'settling') return;
    const generation = this.motion?.generation ?? this.policy.generation;
    this.policy.generation = generation;
    if (this.policy.gesture.phase === 'tracking' || this.policy.gesture.phase === 'dragging') {
      this.policy.gesture = cancelReaderPagePan(this.policy.gesture);
    }
    this.effects.finishRollback(generation);
  }

  armDeadline(generation: number): void {
    this.prepared.armDeadline((): void => this.recoverDeadline(generation));
  }

  private recoverDeadline(generation: number): void {
    if (!this.view.projection().pageTurnSettlementActive || this.policy.generation !== generation) return;
    if (this.effects.automaticStartPending()) {
      this.effects.cancelAutomaticStart();
      return;
    }
    hilog.warn(0x5244, 'Reader', 'Page turn settlement deadline fired; converging generation %{public}d', generation);
    const action = this.prepared.deadlineAction({
      terminalReleased: (): boolean => this.session.completedTerminalGeneration() === generation,
      awaitingSlots: (): boolean => this.awaitingSlots,
      slotsCommitted: (): boolean => this.session.committedSlotsGeneration() === generation,
      phase: (): string => this.phase,
    });
    switch (action) {
      case 'terminal-ack':
        this.onNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_TERMINAL_RELEASED, generation, 0));
        return;
      case 'slots-ack':
        this.onNativeEvent(new BookTurnNativeEvent(BOOK_TURN_EVENT_SLOTS_COMMITTED, generation, 0));
        this.armDeadline(generation);
        return;
      case 'cleanup-surface':
        this.session.releaseTerminalFrame(generation);
        this.session.clearSurface(generation);
        this.requestStaticFallback(generation);
        return;
      case 'fallback':
        this.requestStaticFallback(generation);
        return;
      case 'handoff-unknown': {
        const prepared = this.prepared.prepared;
        if (prepared !== undefined) this.prepared.handoffUnknown(prepared, this.view.lifecycle(), generation);
        return;
      }
      case 'finish-receipt':
        this.policy.animationFinished = true;
        this.effects.finishCommit(generation);
        return;
      case 'rollback':
        this.prepared.discardDestination();
        this.prepared.releaseCommit();
        this.effects.animateRollback();
        return;
      case 'finish-rollback':
        this.effects.finishRollback(generation);
        return;
    }
  }

  private frameEvidence(): ReaderPageTurnFrameEvidence {
    return {
      active: this.view.mounted() && !this.view.exiting(), simulation: this.view.simulation(),
      surfaceGeneration: this.surfaceGeneration, awaitingSlots: this.awaitingSlots,
      expectedRevision: this.view.projection().pageTurnRenderRevision, readyRevision: this.readyRevision,
      scheduledRevision: this.scheduledRevision, phase: this.phase,
    };
  }

  private confirmPresented(settlementGeneration: number): void {
    if (!this.policy.confirmFrame(settlementGeneration, this.frameEvidence())) return;
    this.phase = 'arkuiPresented';
    // Hide through opacity without rebuilding the XComponent or submitting
    // a transparent Native buffer. Release follows a scheduled frame callback;
    // an actual display acknowledgement is not available here.
    this.view.publish({ bookTurnSurfaceOpacity: 0 });
    this.phase = 'surfaceHidden';
    const generation = this.surfaceGeneration;
    this.view.context().postFrameCallback(new ReaderUIFrameCallback((): void => {
      if (!this.view.mounted() || this.view.exiting() || generation !== this.surfaceGeneration ||
        this.view.projection().bookTurnSurfaceOpacity !== 0) return;
      // Queue release and clear together; the native render thread processes
      // them in order, and its generation gate accepts clear while release is
      // still queued. No visible transparent swap is submitted.
      if (this.session.releaseTerminalFrame(settlementGeneration)) {
        this.session.clearSurface(settlementGeneration);
      }
    }));
  }

  onFrameScheduled(revision: number): void {
    if (!this.view.mounted() || this.view.exiting() || !this.view.simulation() ||
      revision !== this.view.projection().pageTurnRenderRevision) return;
    if (this.scheduledRevision !== revision) {
      this.scheduledRevision = revision;
      if (this.view.inputPhase() === 'idle') this.texture.schedule();
    }
    if (this.awaitingSlots || (this.phase !== 'logicalPromoted' &&
      this.phase !== 'rollback')) return;
    this.confirmPresented(this.policy.generation);
  }

  scheduleSurfaceRelease(settlementGeneration: number): void {
    if (!this.policy.canScheduleFrame(settlementGeneration, this.frameEvidence())) return;
    // The resident target's exact revision and its scheduling acknowledgement
    // are both required. Elapsed frames never stand in for content admission.
    this.view.context().postFrameCallback(new ReaderUIFrameCallback((): void => {
      this.confirmPresented(settlementGeneration);
    }));
  }

  onContentReady(revision: number): void {
    if (!this.view.mounted() || this.view.exiting() || revision !== this.view.projection().pageTurnRenderRevision) return;
    this.readyRevision = revision;
    const lifecycle = this.view.lifecycle();
    void Promise.resolve().then((): void => {
      if (!this.view.mounted() || this.view.exiting() || lifecycle !== this.view.lifecycle() || revision !== this.view.projection().pageTurnRenderRevision) return;
      this.effects.onPresentationReady();
      if (this.staticFallbackPending) this.completeStaticFallback(this.policy.generation);
    });
  }

  requestStaticFallback(generation: number): void {
    if (!this.view.mounted() || this.view.exiting() || !this.view.projection().pageTurnSettlementActive ||
      generation !== this.policy.generation) return;
    this.staticFallbackPending = true;
    if (this.completeStaticFallback(generation)) return;
    // Rebuild the existing admitted page using the ordinary 2D stage. An
    // absent native/ArkUI callback must not retain the whole input owner.
    this.effects.handoffPendingProgress();
    this.effects.releaseRecoveryInput();
  }

  completeStaticFallback(generation: number): boolean {
    if (!this.view.mounted() || this.view.exiting() || !this.view.projection().pageTurnSettlementActive || !this.staticFallbackPending ||
      generation !== this.policy.generation ||
      generation !== this.surfaceGeneration ||
      this.readyRevision !== this.view.projection().pageTurnRenderRevision ||
      this.prepared.prepared !== undefined) return false;
    this.staticFallbackPending = false;
    if (!this.view.reduceMotion()) this.view.publish({ bookTurnRuntimeFailed: true });
    this.view.publish({ bookTurnSurfaceOpacity: 0 });
    this.awaitingSlots = false;
    this.session.clearCapturedTextures();
    // No transparent swap. Best-effort cleanup remains generation/epoch gated;
    // UI ownership no longer depends on a lost native completion notification.
    this.session.releaseTerminalFrame(generation);
    this.session.clearSurface(generation);
    this.phase = 'released';
    if (this.prepared.commitSucceeded) this.effects.finishSuccessfulPresentation(generation);
    else this.effects.finishRollback(generation);
    this.phase = 'idle';
    return true;
  }
}
