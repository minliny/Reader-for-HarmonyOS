import {
  advanceReaderTtsChapter,
  beginReaderTtsSession,
  beginStoppingReaderTts,
  completeReaderTtsSession,
  createReaderTtsState,
  failReaderTtsUtterance,
  finishStoppingReaderTts,
  invalidateReaderTtsUtterance,
  isReaderTtsSessionCurrent,
  isReaderTtsUtteranceCurrent,
  markReaderTtsStarted,
  pauseReaderTtsSession,
  prepareReaderTtsUtterance,
  readerTtsSessionIdentity,
  readerTtsUtteranceToken,
  resumeReaderTtsSession,
  scheduleReaderTtsTimer,
  setReaderTtsAvailability,
  setReaderTtsRate,
  type ReaderTtsContentVersion,
  type ReaderTtsSessionIdentity,
  type ReaderTtsState,
  type ReaderTtsUtteranceToken,
} from './ReaderTtsState.ts';
import {
  type ReaderTtsChapterRef,
  type ReaderTtsChapterTransition,
  type ReaderTtsConfig,
  type ReaderTtsGateway,
  type ReaderTtsQueueSnapshot,
  type ReaderTtsSlice,
  type ReaderTtsSlicePlan,
} from './ReaderTtsGateway.ts';

export type ReaderTtsHostSpeakRequest = {
  requestId: string;
  text: string;
  rate: number;
  pitch: number;
  language: string;
  engine?: string;
};

export type ReaderTtsHostEvent =
  | { type: 'start'; requestId: string }
  | { type: 'complete'; requestId: string; completion: 'audio' | 'synthesis' }
  | { type: 'stop'; requestId: string }
  | { type: 'error'; requestId: string; message: string }
  | { type: 'interruption'; action: 'pause' | 'resume' | 'stop' | 'duck' | 'unduck' }
  | { type: 'deviceChange'; action: 'continue' | 'stop' };

export interface ReaderTtsHost {
  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void;
  isAvailable(): Promise<boolean>;
  activateAudioSession(allowMixing: boolean): Promise<void>;
  deactivateAudioSession(): Promise<void>;
  speak(request: ReaderTtsHostSpeakRequest): Promise<void>;
  stop(): Promise<void>;
}

export type ReaderTtsStartInput = {
  chapter: ReaderTtsChapterRef;
  content: string;
  contentVersion: ReaderTtsContentVersion;
  scalarPosition: number;
  rate?: number;
  pitch?: number;
  language?: string;
  allowMixing?: boolean;
  failurePolicy?: 'skip' | 'stop';
  timerDurationMs?: number;
};

export type ReaderTtsProgressCommit = {
  chapter: ReaderTtsChapterRef;
  charEnd: number;
};

export type ReaderTtsChapterAdvanceInput = {
  chapter: ReaderTtsChapterRef;
  content: string;
  contentVersion: ReaderTtsContentVersion;
  onAdmitted?: () => void;
};

export interface ReaderTtsCoordinatorGateway {
  getConfig(): Promise<ReaderTtsConfig | undefined>;
  slice(chapter: ReaderTtsChapterRef, content: string, strategy?: 'paragraph-then-sentence'): Promise<ReaderTtsSlicePlan>;
  play(plan: ReaderTtsSlicePlan, startSliceIndex: number): Promise<ReaderTtsQueueSnapshot>;
  pause(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  resume(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  stop(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  next(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  previous(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  skip(chapter: ReaderTtsChapterRef): Promise<ReaderTtsQueueSnapshot>;
  setRate(chapter: ReaderTtsChapterRef, rate: number): Promise<ReaderTtsQueueSnapshot>;
  chapterPlan(
    chapter: ReaderTtsChapterRef,
    nextChapter: ReaderTtsChapterRef | undefined,
    drainBehavior?: 'stop-on-boundary' | 'advance-to-next',
  ): Promise<ReaderTtsChapterTransition>;
  reportStatus(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
  ): Promise<ReaderTtsQueueSnapshot>;
}

type ActiveSession = {
  identity: ReaderTtsSessionIdentity;
  input: ReaderTtsStartInput;
  plan?: ReaderTtsSlicePlan;
  config?: ReaderTtsConfig;
};

const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Serial bridge between Core's queue and the actual Harmony system engine.
 * Every public intent and every Host callback enters one operation tail.
 */
export class ReaderTtsSessionCoordinator {
  private readonly gateway: ReaderTtsCoordinatorGateway;
  private readonly host: ReaderTtsHost;
  private readonly progressCommit: (progress: ReaderTtsProgressCommit) => Promise<void>;
  private readonly stateListener: ((state: ReaderTtsState) => void) | undefined;
  private readonly chapterAdvance:
    ((chapter: ReaderTtsChapterRef) => Promise<ReaderTtsChapterAdvanceInput | undefined>) | undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private state: ReaderTtsState = createReaderTtsState(false);
  private active: ActiveSession | undefined = undefined;
  private disposed: boolean = false;
  private timerHandle: number = -1;
  private timerGeneration: number = 0;

  constructor(
    gateway: ReaderTtsCoordinatorGateway | ReaderTtsGateway,
    host: ReaderTtsHost,
    progressCommit: (progress: ReaderTtsProgressCommit) => Promise<void> = async (): Promise<void> => {},
    stateListener?: (state: ReaderTtsState) => void,
    chapterAdvance?: (chapter: ReaderTtsChapterRef) => Promise<ReaderTtsChapterAdvanceInput | undefined>,
  ) {
    this.gateway = gateway;
    this.host = host;
    this.progressCommit = progressCommit;
    this.stateListener = stateListener;
    this.chapterAdvance = chapterAdvance;
    this.host.setEventListener((event: ReaderTtsHostEvent): void => {
      void this.enqueue(async (): Promise<void> => this.handleHostEvent(event));
    });
  }

  getState(): ReaderTtsState {
    return { ...this.state };
  }

  async probeAvailability(): Promise<boolean> {
    const available = await this.host.isAvailable();
    this.setState(setReaderTtsAvailability(this.state, available));
    return available;
  }

  start(input: ReaderTtsStartInput): Promise<void> {
    this.assertStartInput(input);
    const chapterKey = this.chapterKey(input.chapter);
    const rate = input.rate ?? 1;
    this.setState(beginReaderTtsSession(
      this.state,
      chapterKey,
      input.chapter.chapterIndex,
      input.contentVersion,
      rate,
    ));
    this.configureTimer(input.timerDurationMs);
    const identity = readerTtsSessionIdentity(this.state);
    const prior = this.active;
    this.active = { identity, input: { ...input, rate } };
    return this.enqueue(async (): Promise<void> => this.prepareNewSession(identity, prior));
  }

  pause(): Promise<void> {
    return this.pauseForReason('user');
  }

  pauseForBackground(): Promise<void> {
    return this.pauseForReason('routeBackground');
  }

  private pauseForReason(reason: 'user' | 'routeBackground'): Promise<void> {
    const active = this.active;
    const nextState = pauseReaderTtsSession(this.state, reason);
    if (nextState === this.state || active === undefined) return Promise.resolve();
    this.setState(nextState);
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (isReaderTtsSessionCurrent(this.state, active.identity)) {
        await this.gateway.pause(active.input.chapter);
      }
      await this.host.deactivateAudioSession();
    });
  }

  resume(): Promise<void> {
    const active = this.active;
    const nextState = resumeReaderTtsSession(this.state);
    if (nextState === this.state || active === undefined || active.plan === undefined ||
      this.state.sliceIndex === undefined) return Promise.resolve();
    this.setState(nextState);
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      const snapshot = await this.gateway.resume(active.input.chapter);
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      const index = this.requireSnapshotIndex(snapshot, 'tts.queue.resume');
      await this.speakSlice(active, index, 'resuming');
    });
  }

  next(): Promise<void> {
    return this.skipToAdjacent('next');
  }

  previous(): Promise<void> {
    return this.skipToAdjacent('previous');
  }

  setRate(rate: number): Promise<void> {
    const active = this.active;
    const priorRate = this.state.rate;
    this.setState(setReaderTtsRate(this.state, rate));
    if (active === undefined || active.plan === undefined || this.state.sliceIndex === undefined || priorRate === rate) {
      return Promise.resolve();
    }
    active.input = { ...active.input, rate };
    const identity = active.identity;
    const index = this.state.sliceIndex;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      await this.gateway.setRate(active.input.chapter, this.coreRateForMultiplier(rate));
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      await this.speakSlice(active, index, 'resuming');
    });
  }

  setTimer(durationMs: number | undefined): void {
    this.configureTimer(durationMs);
  }

  setAllowMixing(allowMixing: boolean): void {
    if (this.active !== undefined) this.active.input = { ...this.active.input, allowMixing };
  }

  setFailurePolicy(failurePolicy: 'skip' | 'stop'): void {
    if (this.active !== undefined) this.active.input = { ...this.active.input, failurePolicy };
  }

  stop(reason: 'user' | 'timer' | 'lifecycle' | 'contentChanged' = 'user'): Promise<void> {
    const active = this.active;
    this.clearTimer();
    this.setState(beginStoppingReaderTts(this.state, reason));
    this.active = undefined;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (active !== undefined && active.plan !== undefined) {
        try {
          await this.gateway.stop(active.input.chapter);
        } catch (_) {
          // Core may already be stopped/completed; Host cleanup still wins.
        }
      }
      await this.host.deactivateAudioSession();
      if (this.state.status === 'stopping') {
        this.setState(finishStoppingReaderTts(this.state));
      }
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.stop('lifecycle');
    this.host.setEventListener(undefined);
  }

  whenSettled(): Promise<void> {
    return this.operationTail;
  }

  private async prepareNewSession(identity: ReaderTtsSessionIdentity, prior: ActiveSession | undefined): Promise<void> {
    if (prior !== undefined) {
      await this.host.stop();
      if (prior.plan !== undefined) {
        try {
          await this.gateway.stop(prior.input.chapter);
        } catch (_) {
          // A completed/stopped prior queue is already safe.
        }
      }
      await this.host.deactivateAudioSession();
    }
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    const available = await this.host.isAvailable();
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    if (!available) {
      this.clearTimer();
      this.setState(setReaderTtsAvailability(this.state, false));
      return;
    }
    this.setState(setReaderTtsAvailability(this.state, true));
    const active = this.active;
    if (active === undefined || !isReaderTtsSessionCurrent(this.state, identity)) return;
    active.config = await this.gateway.getConfig();
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    active.plan = await this.gateway.slice(active.input.chapter, active.input.content, 'paragraph-then-sentence');
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    const startIndex = this.firstSliceIndex(active.plan, active.input.scalarPosition);
    const snapshot = await this.gateway.play(active.plan, startIndex);
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    await this.gateway.setRate(active.input.chapter, this.coreRateForMultiplier(active.input.rate ?? 1));
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    const index = this.requireSnapshotIndex(snapshot, 'tts.queue.play');
    await this.speakSlice(active, index, 'preparing');
  }

  private async speakSlice(active: ActiveSession, index: number, status: 'preparing' | 'resuming'): Promise<void> {
    const plan = active.plan;
    if (plan === undefined) throw new Error('Reader TTS has no active slice plan');
    const slice = plan.slices[index];
    if (slice === undefined) throw new Error('Reader TTS Core cursor is outside the slice plan');
    if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
    this.setState(prepareReaderTtsUtterance(
      this.state,
      slice.index,
      plan.slices.length,
      slice.charStart,
      slice.charEnd,
      status,
    ));
    const token = readerTtsUtteranceToken(this.state);
    await this.host.activateAudioSession(active.input.allowMixing ?? false);
    if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
    try {
      await this.host.speak({
        requestId: token.requestId,
        text: slice.text,
        rate: active.input.rate ?? 1,
        pitch: active.input.pitch ?? 1,
        language: active.input.language ?? 'zh-CN',
        engine: active.config?.engine,
      });
    } catch (error) {
      if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
      const message = error instanceof Error ? error.message : `${error}`;
      await this.handleUtteranceFailure(active, token, message);
    }
  }

  private async handleHostEvent(event: ReaderTtsHostEvent): Promise<void> {
    if (event.type === 'interruption') {
      if (event.action === 'pause' || event.action === 'stop') {
        await this.pauseForSystem('systemInterruption');
      } else if (event.action === 'resume') {
        await this.resumeAfterSystemInterruption();
      }
      // TextToSpeechEngine exposes no safe per-session duck control. The
      // audio manager owns duck/unduck hints after focus activation.
      return;
    }
    if (event.type === 'deviceChange') {
      if (event.action === 'stop') await this.pauseForSystem('deviceChange');
      return;
    }
    const active = this.active;
    if (active === undefined || this.state.requestId !== event.requestId) return;
    const token = readerTtsUtteranceToken(this.state);
    if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
    if (event.type === 'start') {
      if (this.state.status !== 'preparing' && this.state.status !== 'resuming') return;
      await this.gateway.reportStatus(active.input.chapter, token.sliceIndex, 'speaking');
      if (isReaderTtsUtteranceCurrent(this.state, token)) {
        this.setState(markReaderTtsStarted(this.state, token));
      }
      return;
    }
    if (event.type === 'complete') {
      if (event.completion !== 'audio') return;
      await this.gateway.reportStatus(active.input.chapter, token.sliceIndex, 'done');
      if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
      const slice = this.requireActiveSlice(active, token.sliceIndex);
      await this.progressCommit({ chapter: active.input.chapter, charEnd: slice.charEnd });
      if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
      const snapshot = await this.gateway.next(active.input.chapter);
      if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
      if (snapshot.state === 'completed') {
        await this.advanceOrComplete(active);
        return;
      }
      await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.next'), 'preparing');
      return;
    }
    if (event.type === 'error') {
      await this.handleUtteranceFailure(active, token, event.message);
    }
    // `stop` is an acknowledgement only. Pause/skip/stop intents already
    // invalidated this request before asking the engine to stop.
  }

  private async pauseForSystem(reason: 'systemInterruption' | 'deviceChange'): Promise<void> {
    const active = this.active;
    if (active === undefined) return;
    const nextState = pauseReaderTtsSession(this.state, reason);
    if (nextState === this.state) return;
    this.setState(nextState);
    await this.host.stop();
    if (isReaderTtsSessionCurrent(this.state, active.identity) && active.plan !== undefined) {
      await this.gateway.pause(active.input.chapter);
    }
    await this.host.deactivateAudioSession();
  }

  private async resumeAfterSystemInterruption(): Promise<void> {
    const active = this.active;
    if (active === undefined || active.plan === undefined || this.state.status !== 'interrupted' ||
      this.state.pauseReason !== 'systemInterruption' || this.state.sliceIndex === undefined) return;
    const nextState = resumeReaderTtsSession(this.state);
    this.setState(nextState);
    const identity = active.identity;
    const snapshot = await this.gateway.resume(active.input.chapter);
    if (!isReaderTtsSessionCurrent(this.state, identity)) return;
    await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.resume'), 'resuming');
  }

  private async handleUtteranceFailure(
    active: ActiveSession,
    token: ReaderTtsUtteranceToken,
    message: string,
  ): Promise<void> {
    await this.gateway.reportStatus(active.input.chapter, token.sliceIndex, 'failed');
    if (!isReaderTtsUtteranceCurrent(this.state, token)) return;
    this.setState(failReaderTtsUtterance(this.state, token, message));
    const failureCount = this.state.consecutiveFailures;
    if ((active.input.failurePolicy ?? 'stop') !== 'skip' || failureCount >= MAX_CONSECUTIVE_FAILURES) {
      await this.stopAfterFailure(active, failureCount >= MAX_CONSECUTIVE_FAILURES ? 'failureLimit' : 'user');
      return;
    }
    const snapshot = await this.gateway.skip(active.input.chapter);
    if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
    if (snapshot.state === 'completed') {
      await this.advanceOrComplete(active);
      return;
    }
    await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.skip'), 'preparing');
  }

  private async advanceOrComplete(active: ActiveSession): Promise<void> {
    const loader = this.chapterAdvance;
    if (loader === undefined) {
      await this.completeSession();
      return;
    }
    try {
      const next = await loader(active.input.chapter);
      if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
      const transition = await this.gateway.chapterPlan(
        active.input.chapter,
        next?.chapter,
        'advance-to-next',
      );
      if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
      if (next === undefined || transition.next === undefined || transition.drainBehavior !== 'advance-to-next') {
        await this.completeSession();
        return;
      }
      next.onAdmitted?.();
      this.setState(advanceReaderTtsChapter(
        this.state,
        this.chapterKey(next.chapter),
        next.chapter.chapterIndex,
        next.contentVersion,
      ));
      active.input = {
        ...active.input,
        chapter: next.chapter,
        content: next.content,
        contentVersion: next.contentVersion,
        scalarPosition: 0,
      };
      active.identity = readerTtsSessionIdentity(this.state);
      active.plan = await this.gateway.slice(next.chapter, next.content, 'paragraph-then-sentence');
      if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
      const snapshot = await this.gateway.play(active.plan, 0);
      if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
      await this.gateway.setRate(next.chapter, this.coreRateForMultiplier(active.input.rate ?? 1));
      if (!isReaderTtsSessionCurrent(this.state, active.identity)) return;
      await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.play'), 'preparing');
    } catch (error) {
      const detail = error instanceof Error ? error.message : `${error}`;
      console.error(`Reader TTS chapter advance failed: ${detail}`);
      await this.stopAfterFailure(active, 'user');
    }
  }

  private async completeSession(): Promise<void> {
    this.clearTimer();
    this.setState(completeReaderTtsSession(this.state));
    this.active = undefined;
    await this.host.deactivateAudioSession();
  }

  private async stopAfterFailure(active: ActiveSession, reason: 'user' | 'failureLimit'): Promise<void> {
    this.clearTimer();
    this.setState(beginStoppingReaderTts(this.state, reason));
    this.active = undefined;
    await this.host.stop();
    try {
      await this.gateway.stop(active.input.chapter);
    } catch (_) {
      // Preserve the original system vocalization failure.
    }
    await this.host.deactivateAudioSession();
    this.setState(finishStoppingReaderTts(this.state));
  }

  private skipToAdjacent(direction: 'next' | 'previous'): Promise<void> {
    const active = this.active;
    if (active === undefined || active.plan === undefined) return Promise.resolve();
    this.setState(invalidateReaderTtsUtterance(this.state));
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      const snapshot = direction === 'next'
        ? await this.gateway.skip(active.input.chapter)
        : await this.gateway.previous(active.input.chapter);
      if (!isReaderTtsSessionCurrent(this.state, identity)) return;
      if (snapshot.state === 'completed') {
        await this.advanceOrComplete(active);
        return;
      }
      await this.speakSlice(active, this.requireSnapshotIndex(snapshot, `tts.queue.${direction}`), 'preparing');
    });
  }

  private requireSnapshotIndex(snapshot: ReaderTtsQueueSnapshot, command: string): number {
    if (snapshot.currentSliceIndex === undefined) {
      throw new Error(`${command} returned no current slice`);
    }
    return snapshot.currentSliceIndex;
  }

  private requireActiveSlice(active: ActiveSession, index: number): ReaderTtsSlice {
    const slice = active.plan?.slices[index];
    if (slice === undefined) throw new Error('Reader TTS active slice is missing');
    return slice;
  }

  private firstSliceIndex(plan: ReaderTtsSlicePlan, scalarPosition: number): number {
    for (const slice of plan.slices) {
      if (scalarPosition >= slice.charStart && scalarPosition < slice.charEnd) return slice.index;
      if (scalarPosition < slice.charStart) return slice.index;
    }
    return plan.slices[plan.slices.length - 1].index;
  }

  private chapterKey(chapter: ReaderTtsChapterRef): string {
    return `${chapter.sourceId}\u0000${chapter.bookId}\u0000${chapter.chapterIndex}`;
  }

  private configureTimer(durationMs: number | undefined): void {
    this.clearTimer();
    this.setState(scheduleReaderTtsTimer(this.state, Date.now(), durationMs));
    if (durationMs === undefined) return;
    const generation = this.timerGeneration;
    this.timerHandle = setTimeout((): void => {
      this.timerHandle = -1;
      if (generation !== this.timerGeneration || this.disposed) return;
      void this.stop('timer');
    }, durationMs);
  }

  private clearTimer(): void {
    if (this.timerHandle >= 0) {
      clearTimeout(this.timerHandle);
      this.timerHandle = -1;
    }
    this.timerGeneration += 1;
    if (this.timerGeneration >= Number.MAX_SAFE_INTEGER) this.timerGeneration = 1;
  }

  private coreRateForMultiplier(rate: number): number {
    return Math.max(1, Math.min(10, Math.round(rate * 5)));
  }

  private setState(state: ReaderTtsState): void {
    this.state = state;
    this.stateListener?.({ ...state });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const task = this.operationTail.then(operation, operation);
    this.operationTail = task.catch((): void => {});
    return task;
  }

  private assertStartInput(input: ReaderTtsStartInput): void {
    if (input.chapter.sourceId.trim().length === 0 || input.chapter.bookId.trim().length === 0 ||
      !Number.isSafeInteger(input.chapter.chapterIndex) || input.chapter.chapterIndex < 0) {
      throw new Error('Reader TTS start requires a valid chapter identity');
    }
    if (input.content.trim().length === 0) throw new Error('Reader TTS start requires non-empty content');
    const contentVersionValid = typeof input.contentVersion === 'string' ?
      input.contentVersion.trim().length > 0 : Number.isSafeInteger(input.contentVersion) && input.contentVersion >= 0;
    if (!contentVersionValid || !Number.isSafeInteger(input.scalarPosition) || input.scalarPosition < 0) {
      throw new Error('Reader TTS start requires safe content version and scalar position');
    }
  }
}
