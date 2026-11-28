import { hilog } from '@kit.PerformanceAnalysisKit';
import type { LocalReadingAnchor, LocalReadingLayout, LocalReadingProgress } from '../application/LocalReadingFlowTypes';
import type { ReaderProgressProducerIntent } from '../application/ReaderProgressProducerHost';
import type { ReaderReadingRecordHost } from '../application/ReaderReadingRecordHost';
import type { ReaderTtsProgressCommit } from '../application/ReaderTtsSessionCoordinator';
import type { ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingCommit } from '../application/ReadingCommit';
import type {
  ReadingContinuousProgressSample, ReadingExitFailure, ReadingExitProgressCoordinator, ReadingExitProgressSample,
  ReadingExitSpeech, ReadingProgressIdentity, ReadingVisibleProgressSample,
} from '../application/ReadingExitProgressCoordinator';
import type { ReadingRecordGateway } from '../application/ReadingRecordGateway';
import type { ReadingSessionCommittedProgress, ReadingSessionFlowGateway } from '../application/ReadingSessionFlowGateway';
import type { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import type { ReaderBookmarkInteractionHost } from './ReaderBookmarkInteractionHost';
import { backReaderControlHostSession, type ReaderControlHostTiming } from './ReaderControlHostSession';
import type { ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import { cancelReaderPagePan } from './ReaderPageGestureState';
import type { ReaderPageTurnInputHost } from './ReaderPageTurnInputHost';
import type { ReaderPageTurnSettlementHost } from './ReaderPageTurnSettlementHost';
import type { ReaderReadingMountHost } from './ReaderReadingMountHost';
import type { ReaderReadingRecoveryHost } from './ReaderReadingRecoveryHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type { ReaderReadingSurfaceHost } from './ReaderReadingSurfaceHost';
import type { PhysicalReadingPage } from './ReadingMeasurementModels';

export interface ReaderReadingProgressOwners {
  readonly progress: ReadingExitProgressCoordinator;
  readonly mount: ReaderReadingMountHost;
  readonly measured: ReaderMeasuredPagePublication;
  readonly surface: ReaderReadingSurfaceHost;
  readonly speech: ReaderReadingSpeechHost;
  readonly turn: ReaderPageTurnSettlementHost;
  readonly turnInput: ReaderPageTurnInputHost;
  readonly bookmark: ReaderBookmarkInteractionHost;
  readonly autoPage: ReaderAutoPageCoordinator;
  readonly auxiliary: ReaderAuxiliarySessionHost;
  readonly record: ReaderReadingRecordHost;
  readonly recordGateway: ReadingRecordGateway;
  readonly recovery: ReaderReadingRecoveryHost;
  readonly controlVerification: ReaderControlVerificationSession;
}

export interface ReaderReadingProgressView {
  readonly identity: () => ReadingProgressIdentity;
  readonly ready: () => boolean;
  readonly currentSelection: () => number;
  readonly continuous: () => boolean;
  readonly layout: () => LocalReadingLayout;
  readonly mayRenewRetainedVisit: () => boolean;
  readonly exitRequested: () => boolean;
  readonly settlementActive: () => boolean;
  readonly publishCommit: (commit: ReadingCommit) => void;
}

export interface ReaderReadingExitEffects {
  readonly markRequested: () => void;
  readonly observePrefetch: () => void;
  readonly rollbackUncommittedTurn: () => boolean;
  readonly releaseTurnRecoveryInput: () => void;
  readonly retireCapsuleOrigin: () => void;
  readonly exit: () => void;
}

/** Back routing still consumes the actual control/keyboard owner callbacks. */
export interface ReaderReadingBackControls {
  readonly visible: () => boolean;
  readonly cancelPendingNavigation: () => boolean;
  readonly invalidateBackdrop: () => void;
  readonly consumeKeyboard: () => boolean;
  readonly consumeTemporaryBack: (report: () => void) => boolean;
  readonly visualSession: () => ReaderControlSessionState;
  readonly timing: () => ReaderControlHostTiming;
  readonly requestBackSession: (session: ReaderControlSessionState) => void;
}

/** Connects accepted reading progress and exit handoff to one mounted reader.
 * A finished audio slice, the continuous sample and a measured page retain
 * their own anchors and are all admitted by the one application coordinator. */
export class ReaderReadingProgressHost {
  private readonly owners: ReaderReadingProgressOwners;
  private readonly view: ReaderReadingProgressView;
  private readonly effects: ReaderReadingExitEffects;
  private readonly back: ReaderReadingBackControls;

  constructor(owners: ReaderReadingProgressOwners, view: ReaderReadingProgressView,
    effects: ReaderReadingExitEffects, back: ReaderReadingBackControls) {
    this.owners = owners;
    this.view = view;
    this.effects = effects;
    this.back = back;
  }

  requestExit(): void {
    const recovery = this.owners.recovery;
    const verification = this.owners.controlVerification;
    if (recovery.requestCurrent() && !this.back.visible()) {
      recovery.retire();
      return;
    }
    if (this.back.cancelPendingNavigation()) {
      verification.backConsumer('pending-navigation', this.back.visualSession());
      return;
    }
    this.back.invalidateBackdrop();
    // Window keyboard insets remain authoritative for the retained text input.
    if (this.back.consumeKeyboard()) {
      verification.backConsumer('keyboard', this.back.visualSession());
      return;
    }
    if (this.back.consumeTemporaryBack((): void => verification.backConsumer('temporary-layer', this.back.visualSession()))) return;
    // Retarget the control clock's visible session, including a drag in flight.
    const result = backReaderControlHostSession(this.back.visualSession(), this.back.timing());
    if (result.consumed) {
      verification.backConsumer('panel-session', this.back.visualSession());
      this.back.requestBackSession(result.state);
      return;
    }
    verification.backConsumer('reading-route', this.back.visualSession());
    this.beginExit();
  }

  beginExit(): void {
    const owners = this.owners;
    const lifecycle = owners.mount.lifecycleToken;
    const turn = owners.turn.pageTurn;
    const prepared = owners.turn.prepared;
    owners.progress.beginExit({
      isActive: (): boolean => owners.mount.isSessionActive(lifecycle) && !this.view.exitRequested(),
      isMounted: (): boolean => owners.mount.isMountedToken(lifecycle),
      cancelRapidInput: (): void => {
        turn.cancelRapid();
        turn.releaseDeferredPointer();
        owners.autoPage.cancelPendingTurn();
      },
      unknownTurnWrite: (): boolean => this.view.settlementActive() && prepared.commitStarted && !prepared.commitFinished,
      handoffTurnWrite: (): void => owners.mount.activeGateway().handoffPendingProgress(),
      deferExit: (pending: boolean): void => turn.deferExit(pending),
      releaseTurnRecoveryInput: (): void => this.effects.releaseTurnRecoveryInput(),
      inputPhase: (): 'idle' | 'tracking' | 'dragging' | 'settling' =>
        turn.phase(this.view.settlementActive(), turn.gesture.phase),
      retireBookmarkGesture: (): boolean => {
        if (turn.gesture.owner !== 'bookmark') return false;
        turn.deferExit(true);
        owners.turnInput.retirePointer();
        return true;
      },
      cancelTracking: (): boolean => {
        const cancelled = cancelReaderPagePan(turn.gesture);
        if (cancelled === turn.gesture) return false;
        owners.turnInput.gestureChanged(cancelled);
        return true;
      },
      rollbackUncommittedTurn: (): boolean => this.effects.rollbackUncommittedTurn(),
      markRequested: (): void => this.effects.markRequested(),
      observePrefetch: (): void => this.effects.observePrefetch(),
      retireInputEffects: (): void => {
        owners.speech.stopReaderTtsAudition();
        owners.record.capture(false);
        this.effects.retireCapsuleOrigin();
        owners.auxiliary.finish();
        owners.record.clearTimer();
        owners.autoPage.dispose();
        owners.autoPage.clearPageTimer(true);
        owners.autoPage.clearSessionTimer(true);
        owners.mount.hydration.cancelReadyDeadline();
      },
      handoffDuration: (): void => owners.record.handoff(),
      speech: (): ReadingExitSpeech | undefined => owners.speech.exitSpeech(),
      handoffProgress: (spoken: ReaderTtsProgressCommit | undefined): void => this.handoffExitProgress(lifecycle, spoken),
      retainEntry: (): void => owners.mount.retainConfirmedEntryPresentation(),
      exit: (): void => this.effects.exit(),
      reportFailure: (phase: ReadingExitFailure, error: Error): void => this.reportExitFailure(phase, error),
    });
  }

  private reportExitFailure(phase: ReadingExitFailure, error: Error): void {
    try {
      if (phase === 'retention') {
        hilog.warn(0x5244, 'Reader', '%{private}s', `Reading entry retention skipped: ${error.message}`);
      } else {
        const label = phase === 'speech' ? 'Reading TTS stop' : `Reading ${phase} handoff`;
        hilog.error(0x5244, 'Reader', '%{private}s', `${label}: ${error.message}`);
      }
    } catch (_) {}
  }

  private handoffExitProgress(lifecycle: number, spoken: ReaderTtsProgressCommit | undefined): void {
    const owners = this.owners;
    const measured = owners.measured;
    const surface = owners.surface;
    owners.progress.handoff(owners.mount.activeGateway(), spoken, (): ReadingExitProgressSample | undefined => {
      const chapter = measured.chapter;
      if (!owners.mount.isMountedToken(lifecycle) || !this.view.ready() || chapter === undefined) return undefined;
      const continuous = this.view.continuous();
      if (continuous) surface.continuousAnchorSampler?.();
      return {
        identity: this.view.identity(), chapter, continuous,
        continuousScalar: (): number => surface.continuousVisibleScalar,
        visibleScalar: (): number | undefined => measured.page?.startScalar,
        visibleCurrent: (): boolean => measured.page !== undefined &&
          this.isVisiblePageCurrent(measured.page, chapter, measured.selection, lifecycle),
        ttsOwnsPosition: (committed: ReadingCommit | undefined): boolean =>
          owners.speech.ttsOwnsPosition(committed, chapter, this.view.currentSelection()),
        scalarCount: (): number => this.chapterScalarCount(),
        layout: (): LocalReadingLayout => this.view.layout(),
      };
    });
  }

  isVisiblePageCurrent(page: PhysicalReadingPage, chapter: ReadingSessionChapter,
    selection: number, lifecycle: number): boolean {
    const measured = this.owners.measured;
    return this.owners.mount.isMountedToken(lifecycle) && this.view.ready() &&
      measured.chapter === chapter && measured.owns(page, selection) &&
      measured.materializedChapterSelectionToken === selection && this.view.currentSelection() === selection;
  }

  private chapterScalarCount(): number {
    const map = this.owners.measured.chapterLayoutMap;
    if (map === undefined) throw new Error('READING_LAYOUT_MAP_NOT_READY');
    return map.scalarCount();
  }

  commitVisiblePage(lifecycle: number): Promise<void> {
    const owners = this.owners;
    const measured = owners.measured;
    return owners.progress.commitVisible({
      ready: (): boolean => owners.mount.isMountedToken(lifecycle) && this.view.ready(),
      mounted: (): boolean => owners.mount.isMountedToken(lifecycle),
      identity: (): ReadingProgressIdentity => this.view.identity(),
      capture: (): ReadingVisibleProgressSample | undefined => {
        const chapter = measured.chapter;
        const page = measured.page;
        const selection = measured.selection;
        if (chapter === undefined || page === undefined) return undefined;
        return {
          chapter, pageStart: page.startScalar, scalarCount: (): number => this.chapterScalarCount(),
          isCurrent: (): boolean => this.isVisiblePageCurrent(page, chapter, selection, lifecycle),
          mayRenewVisit: (): boolean => this.view.mayRenewRetainedVisit(),
          deviceId: (): Promise<string> => owners.recordGateway.currentDeviceId(),
        };
      },
      gateway: (): ReadingSessionFlowGateway => owners.mount.activeGateway(),
      layout: (): LocalReadingLayout => this.view.layout(),
      publish: (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored),
      reportFailure: (error: Error): string => {
        // A persistence failure leaves the already-visible static page valid.
        hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience progress commit failed: ${error.message}`);
        return error.message;
      },
    });
  }

  commitContinuousProgress(lifecycle: number): Promise<void> {
    const owners = this.owners;
    const measured = owners.measured;
    const surface = owners.surface;
    const active = (): boolean => owners.mount.isMountedToken(lifecycle) && this.view.ready() &&
      this.view.continuous() && measured.chapter !== undefined && measured.chapterLayoutMap !== undefined &&
      surface.continuousProjection.fragments.length > 0;
    return owners.progress.commitContinuous({
      active,
      identity: (): ReadingProgressIdentity => this.view.identity(),
      capture: (): ReadingContinuousProgressSample | undefined => {
        const chapter = measured.chapter;
        const map = measured.chapterLayoutMap;
        if (chapter === undefined || map === undefined) return undefined;
        const selection = this.view.currentSelection();
        return {
          chapter, scalarCount: map.scalarCount(), scalar: surface.continuousVisibleScalar,
          revision: surface.continuousProgressRevision,
          ownsSample: (): boolean => active() && measured.chapter === chapter && this.view.currentSelection() === selection &&
            measured.materializedChapterSelectionToken === selection,
        };
      },
      latestSample: (): ReadingSessionChapter | undefined => measured.chapter,
      revision: (): number => surface.continuousProgressRevision,
      visibleScalar: (): number => surface.continuousVisibleScalar,
      gateway: (): ReadingSessionFlowGateway => owners.mount.activeGateway(),
      layout: (): LocalReadingLayout => this.view.layout(),
      publish: (stored: LocalReadingProgress): void => this.admitCommittedProgress(stored),
      completed: (): void => owners.autoPage.pageCommitted(),
      settled: (): void => { owners.turnInput.drain(); },
      failed: (error: Error): void => hilog.error(0x5244, 'Reader', '%{private}s',
        `ReadingExperience continuous progress commit failed: ${error.message}`),
    });
  }

  progressProducerIntent(chapter: ReadingSessionChapter, anchor: LocalReadingAnchor,
    layout: LocalReadingLayout, isOwner: () => boolean, isCurrent: () => boolean,
    publish: (stored: LocalReadingProgress) => void): ReaderProgressProducerIntent {
    return this.owners.progress.intent(chapter, anchor, layout, (): ReadingProgressIdentity => this.view.identity(),
      (): ReadingSessionFlowGateway => this.owners.mount.activeGateway(), isOwner, isCurrent, publish);
  }

  admitCommittedProgress(stored: ReadingSessionCommittedProgress): void {
    this.owners.progress.admitCommitted(this.view.identity(), stored,
      (): void => this.owners.recovery.settle('progress', stored.progressRevision),
      (commit: ReadingCommit): void => {
        try { this.view.publishCommit(commit); }
        catch (error) {
          hilog.error(0x5244, 'Reader', '%{private}s',
            `ReadingExperience committed-progress observer failed: ${(error as Error).message}`);
        }
      });
  }
}
