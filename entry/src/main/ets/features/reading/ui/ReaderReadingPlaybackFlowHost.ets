import type { UIContext } from '@ohos.arkui.UIContext';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import type { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import type { ReadingPaginationKey } from '../application/ReadingPaginationIndex';
import type { ReadingCommit } from '../application/ReadingCommit';
import { ReadingAuxiliaryFlowBridge, type ReadingAutomaticSpeech } from '../application/ReadingAuxiliaryFlowBridge';
import type { ReadingPrefetchActivity } from '../application/ReadingPrefetchHost';
import type { ReaderTtsState } from '../application/ReaderTtsState';
import type { ReaderDeferredChapterSelection } from '../presentation/ReaderChapterSelectionOwner';
import type { ReaderAuxiliarySessionHost } from './ReaderAuxiliarySessionHost';
import { ReaderAutoPageCoordinator } from './ReaderAutoPageCoordinator';
import type { ReaderAutoPageFullConfiguration } from './ReaderAutoPageFullState';
import type { ReaderAutoPagePauseReason, ReaderAutoPageState, ReaderAutoPageStatus } from './ReaderAutoPageState';
import type { ReaderControlVerificationSession } from './ReaderControlVerificationSession';
import type { ReaderMeasuredPagePublication } from './ReaderMeasuredPagePublication';
import type { ReaderPageTurnDirection, ReaderPageTurnOutcome } from './ReaderPageGestureState';
import type { ReaderPageTurnRuntimeHost } from './ReaderPageTurnRuntimeHost';
import type { ReaderReadingSpeechHost } from './ReaderReadingSpeechHost';
import type {
  ReaderReadingSurfaceHost, ReadingPageTurnRenderSnapshot, ReadingSessionRenderSnapshot,
} from './ReaderReadingSurfaceHost';
import type { ReadingSurfacePageFragment } from './ReadingSurface';
import { readerTtsSessionBlocksAutoPageStart } from './ReaderSessionCapsuleModel';
import type { ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { planReaderTtsFollowPage, readerTtsFollowActive, ReaderTtsPageFollow,
  type ReaderTtsFollowLease, type ReaderTtsFollowScope,
  type ReaderTtsFollowTarget, type ReaderTtsPreparedPage } from './ReaderTtsPageFollow';

export interface ReaderPlaybackScene {
  readonly scope: () => ReaderTtsFollowScope;
  readonly session: () => ReadingSessionRenderSnapshot;
  readonly foreground: () => boolean;
  readonly sessionActive: (lifecycle: number) => boolean;
  readonly inputCurrent: () => boolean;
  readonly windowActive: () => boolean;
  readonly windowOverlay: () => boolean;
  readonly controlsBlockTurn: () => boolean;
  readonly interactionBlocked: () => boolean;
  readonly controlsObscured: () => boolean;
  readonly continuous: () => boolean;
  readonly context: () => UIContext;
  readonly advanceAutomaticRevision: () => void;
  readonly speech: () => ReaderReadingSpeechHost;
}

export interface ReaderPlaybackPage {
  readonly projection: () => ReadingPageTurnRenderSnapshot;
  readonly runtime: () => ReaderPageTurnRuntimeHost;
  readonly measured: () => ReaderMeasuredPagePublication;
  readonly surface: () => ReaderReadingSurfaceHost;
  readonly progressInFlight: () => boolean;
  readonly currentPaginationKey: () => ReadingPaginationKey;
  readonly containsChapter: (index: number) => boolean;
  readonly retireUncommittedSpeechChapter: () => void;
  readonly selectSpeechTarget: (target: ReaderTtsFollowTarget) => void;
}

export interface ReaderPlaybackCapsule {
  readonly host: () => ReaderAuxiliarySessionHost;
  readonly launch: () => ReaderSessionLaunchTransaction | undefined;
  readonly verification: () => ReaderControlVerificationSession;
  readonly hideControlForAutomaticCapsule: () => void;
}

export interface ReaderPlaybackPrefetch {
  readonly listening: () => boolean;
  readonly identityCurrent: () => boolean;
  readonly screenLocked: () => boolean;
  readonly committed: () => ReadingCommit | undefined;
  readonly publish: (activity: ReadingPrefetchActivity) => void;
}

export interface ReaderPlaybackLifecycleEffects {
  readonly syncSmartGesture: () => void;
  readonly applyWindowPolicy: () => void;
  readonly retireSourceSwitchOverlay: () => void;
  readonly controlInputBoundaryChanged: () => void;
  readonly retireBookmarkForBackground: () => void;
  readonly screenAwakeForeground: (foreground: boolean) => void;
  readonly retireDurationForBackground: () => void;
  readonly admitRetainedRecency: () => void;
  readonly beginDuration: (lifecycle: number) => void;
  readonly retireRecovery: () => void;
  readonly rearmScreenAwake: () => void;
}

interface ReaderAutomaticCapsulePauseFacts {
  generation: number;
  type: string;
  status: string;
  kind: string;
  reason: ReaderAutoPagePauseReason;
  desiredPlaying: boolean;
}

/** Serializes competing reading playback intents at the mounted surface.
 * Audio transport, automatic deadlines and persistent page settlement keep
 * their existing actors and their own acknowledgement rules. */
export class ReaderReadingPlaybackFlowHost {
  readonly auto: ReaderAutoPageCoordinator;
  private readonly follow: ReaderTtsPageFollow = new ReaderTtsPageFollow();
  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly flows: ReadingAuxiliaryFlowBridge;
  private readonly scene: ReaderPlaybackScene;
  private readonly page: ReaderPlaybackPage;
  private readonly capsule: ReaderPlaybackCapsule;
  private readonly prefetch: ReaderPlaybackPrefetch;
  private readonly lifecycle: ReaderPlaybackLifecycleEffects;

  constructor(transientFeedback: ReaderTransientFeedback, flows: ReadingAuxiliaryFlowBridge, scene: ReaderPlaybackScene,
    page: ReaderPlaybackPage, capsule: ReaderPlaybackCapsule, prefetch: ReaderPlaybackPrefetch,
    lifecycle: ReaderPlaybackLifecycleEffects) {
    this.transientFeedback = transientFeedback;
    this.flows = flows;
    this.scene = scene;
    this.page = page;
    this.capsule = capsule;
    this.prefetch = prefetch;
    this.lifecycle = lifecycle;
    this.auto = new ReaderAutoPageCoordinator({
      now: (): number => readerMotionNowMs(),
      schedule: (callback: () => void, delayMs: number): number => setTimeout(callback, delayMs),
      cancel: (handle: number): void => clearTimeout(handle),
      active: (): boolean => this.scene.session().mounted && this.scene.foreground() && !this.scene.session().exitRequested,
      ready: (): boolean => this.scene.session().phase === 'ready',
      canResumeTurn: (): boolean => {
        const turn = this.page.runtime();
        return !this.page.projection().pageTurnSettlementActive && turn.prepared.prepared === undefined &&
          turn.preparation.pending === undefined && turn.canTurnPage();
      },
      turn: (): ReaderPageTurnOutcome => this.page.runtime().input.perform('next', 'autoTimer'),
      changed: (): void => {
        this.scene.advanceAutomaticRevision();
        const status = this.automaticState().status;
        if (status !== 'running') this.page.runtime().cancelAutomaticPageStart('autoTimer');
        if (status === 'stopped') this.capsule.host().clearStaticCapsuleOrigin('autoPage');
        this.reportPrefetch();
      },
    });
  }

  automaticState(): Readonly<ReaderAutoPageState> { return this.auto.snapshot(this.scene.session().autoPageRevision); }

  automaticConfiguration(): Readonly<ReaderAutoPageFullConfiguration> {
    return this.auto.configurationAt(this.scene.session().autoPageRevision);
  }

  ttsLease(state: ReaderTtsState): ReaderTtsFollowLease { return this.follow.lease(this.scene.scope(), state); }

  holdsTtsLease(lease: ReaderTtsFollowLease): boolean {
    return this.follow.owns(lease, this.scene.scope(), this.scene.session().ttsState);
  }

  isTtsFollowCurrent(lease: ReaderTtsFollowLease): boolean {
    return this.scene.session().mounted && !this.scene.session().exitRequested &&
      readerTtsFollowActive(this.scene.session().ttsState) && this.holdsTtsLease(lease);
  }

  clearTtsPositioning(): void { this.follow.positioning = undefined; }

  ttsFollowFailed(lease: ReaderTtsFollowLease): void { this.follow.failed(lease); }

  scheduleTtsFollow(): void {
    this.follow.scheduleResume((callback: () => void): void => { setTimeout(callback, 0); }, (): (() => void) => {
      const lifecycle = this.scene.scope().lifecycleToken;
      return (): void => {
        if (this.scene.session().mounted && lifecycle === this.scene.scope().lifecycleToken) this.resumeTtsFollow();
      };
    });
  }

  invalidateTtsFollow(): void {
    this.follow.invalidate(this.scene.scope(), this.scene.session().ttsState);
    this.clearTtsPositioning();
    this.page.retireUncommittedSpeechChapter();
    this.discardDeferredSpeechSelections();
    this.page.runtime().cancelAutomaticPageStart('ttsFollow');
  }

  private discardDeferredSpeechSelections(): void {
    this.page.runtime().pageTurn.discardDeferredSelectionIf(
      (selection: ReaderDeferredChapterSelection): boolean => selection.ttsOwner !== undefined);
  }

  offerTts(state: ReaderTtsState): void {
    this.follow.offer(this.scene.scope(), state);
    this.page.retireUncommittedSpeechChapter();
    const turn = this.page.runtime();
    const start = turn.automaticStart;
    if (start?.origin === 'ttsFollow' && start.ttsOwner !== undefined && !this.isTtsFollowCurrent(start.ttsOwner)) {
      turn.cancelAutomaticPageStart('ttsFollow');
    }
    if (!readerTtsFollowActive(state)) {
      this.discardDeferredSpeechSelections();
      turn.cancelAutomaticPageStart('ttsFollow');
      return;
    }
    this.resumeTtsFollow();
  }

  resumeTtsFollow(): void {
    const target = this.follow.pending();
    if (target === undefined || !this.isTtsFollowCurrent(target) || !this.follow.canAttempt() ||
      !this.scene.session().ttsFollowHighlight || !this.scene.foreground() || this.scene.continuous() ||
      this.scene.session().phase !== 'ready') return;
    const measured = this.page.measured();
    const visible = measured.page;
    const chapter = measured.chapter;
    const turn = this.page.runtime();
    if (visible === undefined || chapter === undefined || this.scene.controlsBlockTurn() || turn.input.pointerId >= 0 ||
      turn.pageTurn.deferredPointerReserved || this.page.projection().pageTurnSettlementActive ||
      turn.prepared.prepared !== undefined || turn.preparation.pending !== undefined ||
      this.page.progressInFlight() || turn.pageTurn.hasRapidWork()) return;
    if (this.follow.positioning !== undefined) return;
    if (target.chapterIndex !== chapter.chapterIndex) {
      if (this.page.containsChapter(target.chapterIndex)) this.positionTtsTarget(target);
      return;
    }
    if (target.contentVersion !== measured.materializedContentVersion) return;
    const key = this.page.currentPaginationKey();
    const index = measured.physicalPagination.index;
    const current = index.findContainingPage(key, visible.startScalar);
    const destination = index.findContainingPage(key, target.scalar);
    const plan = planReaderTtsFollowPage(target, visible.startScalar, current, destination,
      (direction: ReaderPageTurnDirection): ReaderTtsPreparedPage | undefined => {
        const prepared = turn.input.prepared(direction);
        return prepared === undefined ? undefined : { chapterIndex: prepared.context.chapter.chapterIndex,
          startScalar: prepared.page.startScalar, endScalar: prepared.page.endScalar };
      });
    switch (plan.action) {
      case 'aligned': this.follow.aligned(target); break;
      case 'position': this.positionTtsTarget(target); break;
      case 'prepare': turn.preparation.enqueue(plan.direction); break;
      case 'turn': turn.input.perform(plan.direction, 'ttsFollow', target); break;
      case 'wait': break;
    }
  }

  private positionTtsTarget(target: ReaderTtsFollowTarget): void {
    if (!this.isTtsFollowCurrent(target)) return;
    this.follow.positioning = target;
    this.page.selectSpeechTarget(target);
  }

  toggleAutoPage(): void {
    this.flows.toggleAutomaticPaging({
      inputAllowed: (): boolean => this.scene.inputCurrent() && !this.scene.windowOverlay(),
      retirePendingStarts: (): void => this.retirePendingStarts(),
      cancelSpeechStart: (): void => this.scene.speech().cancelPending(),
      status: (): ReaderAutoPageStatus => this.automaticState().status,
      pause: (): void => this.pauseAutoPage('manual'),
      canStart: (): boolean => this.scene.session().phase === 'ready' && !this.auto.pendingStart(),
      speech: (): ReadingAutomaticSpeech | undefined => this.scene.speech().automaticSpeech(),
      beginStart: (): number => this.auto.beginStart(),
      speechPauseNeeded: (): boolean => readerTtsSessionBlocksAutoPageStart(this.scene.session().ttsState.status),
      speechPauseCurrent: (speech: ReadingAutomaticSpeech | undefined, start: number): (() => boolean) => {
        const owner = this.scene.scope();
        const speechGeneration = this.scene.session().ttsState.sessionGeneration;
        return (): boolean => {
          if (!this.scene.sessionActive(owner.lifecycleToken)) return false;
          const live = this.scene.scope();
          return live.sourceId === owner.sourceId && live.bookId === owner.bookId &&
            this.scene.speech().automaticSpeechCurrent(speech, speechGeneration) &&
            this.auto.isStartCurrent(start) && this.automaticState().status !== 'stopped';
        };
      },
      pauseFailed: (error: Error, current: () => boolean): void => {
        this.scene.speech().logTtsFailure('pause for auto-page', error);
        this.transientFeedback.show(this.scene.context, { message: '朗读暂停失败，自动翻页已暂停，请重试' },
          (): boolean => current() && this.scene.foreground() && this.scene.windowActive());
      },
      admitStart: (start: number): boolean => this.auto.admitStart(start),
      start: (resuming: boolean): void => this.startAutoPageSession(resuming),
    });
  }

  private startAutoPageSession(resuming: boolean): void {
    if (!this.scene.inputCurrent() || this.scene.windowOverlay() || this.scene.session().phase !== 'ready' ||
      this.automaticState().status !== (resuming ? 'paused' : 'stopped')) return;
    const morphing = this.capsule.host().beginSessionCapsuleMorph('autoPage');
    if (resuming) this.auto.resume();
    else this.auto.start();
    const launch = this.capsule.launch();
    if (launch !== undefined && launch.geometry.type === 'autoPage' && launch.ownership === 'stage') {
      if (!this.capsule.host().acknowledgeAutomatic(launch.generation, (): void => this.pauseAutoPage('manual'))) return;
    }
    if (!morphing && launch === undefined && this.automaticState().status === 'running') {
      this.capsule.hideControlForAutomaticCapsule();
    }
    this.auto.armPageTimer(true);
    this.auto.armSessionTimer(!resuming);
  }

  stopAutoPage(): void {
    this.capsule.host().clearStaticCapsuleOrigin('autoPage');
    if (this.capsule.launch()?.geometry.type === 'autoPage') this.capsule.host().cancel('stop');
    this.auto.stop();
    this.page.runtime().cancelAutomaticPageStart('autoTimer');
  }

  pauseAutoPage(reason: ReaderAutoPagePauseReason): void {
    this.auto.pause(reason);
    const launch = this.capsule.launch();
    if (launch?.geometry.type === 'autoPage') {
      const verification = this.capsule.verification();
      if (verification.observing()) {
        const facts: ReaderAutomaticCapsulePauseFacts = { generation: launch.generation, type: 'autoPage',
          status: this.automaticState().status, kind: launch.geometry.kind, reason, desiredPlaying: launch.desiredPlaying };
        verification.effect('capsule-launch', 'business-paused', facts);
      }
    }
    this.page.runtime().cancelAutomaticPageStart('autoTimer');
  }

  retirePendingStarts(): void {
    const speechPending = this.scene.speech().startPending();
    const automaticPending = this.auto.pendingStart();
    if (speechPending) this.scene.speech().cancelPending();
    if (automaticPending) this.auto.cancelStart();
    const launch = this.capsule.launch();
    if (launch?.ownership === 'stage' && launch.businessStatus === 'preparing' &&
      ((launch.geometry.type === 'tts' && speechPending) || (launch.geometry.type === 'autoPage' && automaticPending))) {
      this.capsule.host().cancel('leave');
    }
  }

  changeAutoPageSpeed(deltaSeconds: number): void { this.setAutoPageSpeed(this.automaticState().speedSeconds + deltaSeconds); }

  setAutoPageSpeed(nextSpeed: number, onDeclined?: () => void): void {
    if (!Number.isFinite(nextSpeed) || !this.scene.session().mounted || !this.scene.foreground() || this.scene.session().exitRequested) {
      onDeclined?.();
      return;
    }
    if (!this.auto.setSpeed(nextSpeed)) onDeclined?.();
  }

  autoPageHighlightFragment(): ReadingSurfacePageFragment | undefined {
    if (!this.automaticConfiguration().followHighlight || this.automaticState().status !== 'running') return undefined;
    const visible = this.scene.continuous() ? this.continuousVisibleFragments() : this.page.projection().visibleFragments;
    return this.auto.highlightVisibleFragment(visible, (fragment: ReadingSurfacePageFragment): boolean => fragment.text.length > 0);
  }

  private continuousVisibleFragments(): ReadingSurfacePageFragment[] {
    const projection = this.page.surface().continuousProjection;
    return projection.fragments.slice(projection.visibleStart, projection.visibleEnd + 1);
  }

  reportPrefetch(interacted: boolean = false, yieldToReading: boolean = false, retiring: boolean = false): void {
    if (!this.prefetch.listening() || this.scene.scope().sourceId === 'local' || !this.prefetch.identityCurrent()) return;
    const chapter = this.page.runtime().preparation.pending?.origin.chapter ?? this.page.measured().chapter;
    if (chapter === undefined) return;
    const active = !retiring && this.scene.session().mounted && !this.scene.session().exitRequested && this.scene.foreground() &&
      this.scene.windowActive() && !this.scene.windowOverlay() && !this.scene.interactionBlocked() && !this.scene.controlsObscured() &&
      !this.prefetch.screenLocked() && this.scene.session().phase === 'ready';
    this.flows.reportPrefetch({
      chapterIndex: chapter.chapterIndex, committed: this.prefetch.committed(), pageStart: this.page.measured().page?.startScalar,
      active, playing: this.scene.session().ttsState.status === 'playing' || this.automaticState().status === 'running',
    }, interacted, yieldToReading, this.prefetch.publish);
  }

  manualInteraction(): void {
    this.reportPrefetch(true, true);
    this.retirePendingStarts();
    this.lifecycle.retireRecovery();
    this.invalidateTtsFollow();
    this.lifecycle.rearmScreenAwake();
    this.pauseAutoPage('touch');
  }

  foregroundChanged(): void {
    this.lifecycle.syncSmartGesture();
    this.lifecycle.applyWindowPolicy();
    if (!this.scene.foreground()) this.lifecycle.retireSourceSwitchOverlay();
    this.lifecycle.controlInputBoundaryChanged();
    if (!this.scene.foreground()) {
      this.page.runtime().cancelAutomaticPageStart();
      this.scene.speech().stopReaderTtsAudition();
      this.scene.speech().clearResumePresentation();
      this.capsule.host().rememberBackgroundCapsuleOrigin();
      this.capsule.host().finish();
      this.lifecycle.retireBookmarkForBackground();
      this.lifecycle.screenAwakeForeground(false);
      this.lifecycle.retireDurationForBackground();
      this.pauseAutoPage('background');
      this.scene.speech().pauseForBackground();
      return;
    }
    this.lifecycle.screenAwakeForeground(true);
    this.resumeTtsFollow();
    this.lifecycle.admitRetainedRecency();
    if (this.scene.session().phase === 'ready') this.lifecycle.beginDuration(this.scene.scope().lifecycleToken);
  }
}
