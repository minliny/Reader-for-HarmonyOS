import {
  createReaderTtsState,
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  type ReaderTtsContentVersion,
  type ReaderTtsSessionIdentity,
  type ReaderTtsState,
  type ReaderTtsUtteranceToken,
} from './ReaderTtsState.ts';
import {
  type ReaderTtsChapterRef,
  type ReaderTtsChapterTransition,
  type ReaderTtsCallbackResult,
  type ReaderTtsConfig,
  type ReaderTtsGateway,
  type ReaderTtsQueueSnapshot,
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
  selectEngine(engine?: string): Promise<boolean>;
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
  seek(chapter: ReaderTtsChapterRef, sliceIndex: number): Promise<ReaderTtsQueueSnapshot>;
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
  reportCallback(
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    status: 'speaking' | 'done' | 'failed',
    callbackId: string,
    failurePolicy: 'skip' | 'stop',
    failureLimit?: number,
  ): Promise<ReaderTtsCallbackResult>;
}

type ActiveSession = {
  identity: ReaderTtsSessionIdentity;
  input: ReaderTtsStartInput;
  plan?: ReaderTtsSlicePlan;
  config?: ReaderTtsConfig;
};

type CorrelatedUtterance = {
  identity: ReaderTtsSessionIdentity;
  chapter: ReaderTtsChapterRef;
  sliceIndex: number;
  charEnd: number;
  failurePolicy: 'skip' | 'stop';
};

export type HostTtsTransportState = {
  engine: 'system' | 'http';
  audioSession: 'inactive' | 'active';
  focus: 'none' | 'held' | 'interrupted';
  sessionGeneration: number;
  utteranceGeneration: number;
  currentRequestId?: string;
  interruption?: 'systemInterruption' | 'routeBackground' | 'deviceChange';
  timerDeadlineMs?: number;
};

function createHostTtsTransportState(): HostTtsTransportState {
  return {
    engine: 'system',
    audioSession: 'inactive',
    focus: 'none',
    sessionGeneration: 0,
    utteranceGeneration: 0,
  };
}

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
  private transport: HostTtsTransportState = createHostTtsTransportState();
  private coreSnapshot: ReaderTtsQueueSnapshot | undefined = undefined;
  private active: ActiveSession | undefined = undefined;
  private disposed: boolean = false;
  private timerHandle: number = -1;
  private timerGeneration: number = 0;
  private readonly utterances: Map<string, CorrelatedUtterance> = new Map();

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

  getTransportState(): HostTtsTransportState {
    return { ...this.transport };
  }

  async probeAvailability(): Promise<boolean> {
    const available = await this.host.isAvailable();
    this.setState({
      ...this.state,
      status: available ? (this.active === undefined ? 'idle' : this.state.status) : 'unavailable',
      stopReason: available ? undefined : 'engineUnavailable',
      errorMessage: undefined,
    });
    return available;
  }

  start(input: ReaderTtsStartInput): Promise<void> {
    this.assertStartInput(input);
    const chapterKey = this.chapterKey(input.chapter);
    const rate = input.rate ?? 1;
    this.utterances.clear();
    this.transport = {
      ...this.transport,
      sessionGeneration: this.nextGeneration(this.transport.sessionGeneration),
      utteranceGeneration: this.nextGeneration(this.transport.utteranceGeneration),
      currentRequestId: undefined,
      interruption: undefined,
    };
    this.coreSnapshot = undefined;
    this.setState({
      status: 'preparing',
      sessionGeneration: this.transport.sessionGeneration,
      utteranceGeneration: this.transport.utteranceGeneration,
      contentVersion: input.contentVersion,
      chapterKey,
      chapterIndex: input.chapter.chapterIndex,
      totalSlices: 0,
      rate,
      consecutiveFailures: 0,
      timerDeadlineMs: this.transport.timerDeadlineMs,
    });
    this.configureTimer(input.timerDurationMs);
    const identity = this.sessionIdentity(input.contentVersion, chapterKey);
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
    if (active === undefined || !this.canPause()) return Promise.resolve();
    this.invalidateUtterance(reason === 'user' ? undefined : reason);
    this.setState({
      ...this.state,
      status: reason === 'user' ? 'paused' : 'interrupted',
      requestId: undefined,
      pauseReason: reason,
    });
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (this.isSessionCurrent(active.identity)) {
        const snapshot = await this.gateway.pause(active.input.chapter);
        this.applyCoreSnapshot(snapshot, undefined, reason);
      }
      await this.host.deactivateAudioSession();
      this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
    });
  }

  resume(): Promise<void> {
    const active = this.active;
    if ((this.state.status !== 'paused' && this.state.status !== 'interrupted') ||
      active === undefined || active.plan === undefined ||
      this.state.sliceIndex === undefined) return Promise.resolve();
    this.setState({ ...this.state, status: 'resuming', pauseReason: undefined, requestId: undefined });
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      if (!this.isSessionCurrent(identity)) return;
      const snapshot = await this.gateway.resume(active.input.chapter);
      if (!this.isSessionCurrent(identity)) return;
      this.applyCoreSnapshot(snapshot);
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

  seek(sliceIndex: number): Promise<void> {
    if (!Number.isSafeInteger(sliceIndex) || sliceIndex < 0) {
      return Promise.reject(new Error('Reader TTS seek requires a non-negative safe slice index'));
    }
    const active = this.active;
    if (active === undefined || active.plan === undefined) return Promise.resolve();
    const wasPaused = this.state.status === 'paused' || this.state.status === 'interrupted';
    this.invalidateUtterance();
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (!this.isSessionCurrent(identity)) return;
      const snapshot = await this.gateway.seek(active.input.chapter, sliceIndex);
      if (!this.isSessionCurrent(identity)) return;
      this.applyCoreSnapshot(snapshot);
      if (wasPaused || snapshot.state === 'paused') return;
      await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.seek'), 'preparing');
    });
  }

  setRate(rate: number): Promise<void> {
    const active = this.active;
    const priorRate = this.state.rate;
    if (!Number.isFinite(rate) || rate < READER_TTS_RATE_MIN || rate > READER_TTS_RATE_MAX) {
      return Promise.reject(new Error('Reader TTS rate must be between 0.5 and 2.0'));
    }
    this.invalidateUtterance();
    this.setState({ ...this.state, rate, requestId: undefined });
    if (active === undefined || active.plan === undefined || this.state.sliceIndex === undefined || priorRate === rate) {
      return Promise.resolve();
    }
    active.input = { ...active.input, rate };
    const identity = active.identity;
    const index = this.state.sliceIndex;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (!this.isSessionCurrent(identity)) return;
      const snapshot = await this.gateway.setRate(active.input.chapter, this.coreRateForMultiplier(rate));
      if (!this.isSessionCurrent(identity)) return;
      this.applyCoreSnapshot(snapshot);
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
    this.transport = {
      ...this.transport,
      sessionGeneration: this.nextGeneration(this.transport.sessionGeneration),
      utteranceGeneration: this.nextGeneration(this.transport.utteranceGeneration),
      currentRequestId: undefined,
    };
    this.setState({
      ...this.state,
      status: 'stopping',
      sessionGeneration: this.transport.sessionGeneration,
      utteranceGeneration: this.transport.utteranceGeneration,
      requestId: undefined,
      timerDeadlineMs: undefined,
      stopReason: reason,
    });
    this.active = undefined;
    this.utterances.clear();
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
      this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
      if (this.state.status === 'stopping') {
        this.coreSnapshot = undefined;
        this.setState({
          ...this.state,
          status: 'idle',
          chapterKey: undefined,
          chapterIndex: undefined,
          sliceIndex: undefined,
          totalSlices: 0,
          charStart: undefined,
          charEnd: undefined,
          requestId: undefined,
          pauseReason: undefined,
          errorMessage: undefined,
        });
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
    if (!this.isSessionCurrent(identity)) return;
    const active = this.active;
    if (active === undefined || !this.isSessionCurrent(identity)) return;
    active.config = await this.gateway.getConfig();
    if (!this.isSessionCurrent(identity)) return;
    await this.host.selectEngine(active.config?.engine);
    if (!this.isSessionCurrent(identity)) return;
    this.transport = {
      ...this.transport,
      engine: active.config?.engine?.startsWith('http-tts:') ? 'http' : 'system',
    };
    const available = await this.host.isAvailable();
    if (!this.isSessionCurrent(identity)) return;
    if (!available) {
      this.clearTimer();
      this.setState({
        ...this.state,
        status: 'unavailable',
        requestId: undefined,
        stopReason: 'engineUnavailable',
      });
      return;
    }
    this.setState({ ...this.state, stopReason: undefined, errorMessage: undefined });
    active.plan = await this.gateway.slice(active.input.chapter, active.input.content, 'paragraph-then-sentence');
    if (!this.isSessionCurrent(identity)) return;
    const startIndex = this.firstSliceIndex(active.plan, active.input.scalarPosition);
    const snapshot = await this.gateway.play(active.plan, startIndex);
    if (!this.isSessionCurrent(identity)) return;
    const ratedSnapshot = await this.gateway.setRate(
      active.input.chapter,
      this.coreRateForMultiplier(active.input.rate ?? 1),
    );
    if (!this.isSessionCurrent(identity)) return;
    this.applyCoreSnapshot(ratedSnapshot);
    const index = this.requireSnapshotIndex(snapshot, 'tts.queue.play');
    await this.speakSlice(active, index, 'preparing');
  }

  private async speakSlice(active: ActiveSession, index: number, status: 'preparing' | 'resuming'): Promise<void> {
    const plan = active.plan;
    if (plan === undefined) throw new Error('Reader TTS has no active slice plan');
    const slice = plan.slices[index];
    if (slice === undefined) throw new Error('Reader TTS Core cursor is outside the slice plan');
    if (!this.isSessionCurrent(active.identity)) return;
    const utteranceGeneration = this.nextGeneration(this.transport.utteranceGeneration);
    const requestId = `tts-s${this.transport.sessionGeneration}-u${utteranceGeneration}` +
      `-c${active.input.chapter.chapterIndex}-i${slice.index}`;
    this.transport = {
      ...this.transport,
      utteranceGeneration,
      currentRequestId: requestId,
      interruption: undefined,
    };
    this.setState({
      ...this.state,
      status,
      utteranceGeneration,
      sliceIndex: slice.index,
      totalSlices: plan.slices.length,
      charStart: slice.charStart,
      charEnd: slice.charEnd,
      requestId,
      pauseReason: undefined,
      stopReason: undefined,
      errorMessage: undefined,
    });
    const token = this.utteranceToken(active.identity, active.input.chapter, slice.index, requestId);
    this.utterances.set(token.requestId, {
      identity: active.identity,
      chapter: active.input.chapter,
      sliceIndex: token.sliceIndex,
      charEnd: slice.charEnd,
      failurePolicy: active.input.failurePolicy ?? 'stop',
    });
    await this.host.activateAudioSession(active.input.allowMixing ?? false);
    this.transport = { ...this.transport, audioSession: 'active', focus: 'held' };
    if (!this.isUtteranceCurrent(token)) return;
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
      if (!this.isUtteranceCurrent(token)) return;
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
    const correlated = this.utterances.get(event.requestId);
    if (correlated === undefined) return;
    const token: ReaderTtsUtteranceToken = {
      ...correlated.identity,
      utteranceGeneration: this.state.requestId === event.requestId ? this.state.utteranceGeneration : -1,
      requestId: event.requestId,
      chapterIndex: correlated.chapter.chapterIndex,
      sliceIndex: correlated.sliceIndex,
    };
    if (event.type === 'start') {
      const result = await this.reportCorrelatedCallback(correlated, event.requestId, 'start', 'speaking');
      if (active !== undefined && result.callbackDisposition === 'applied' &&
        this.isUtteranceCurrent(token)) {
        this.applyCoreSnapshot(result.snapshot);
        this.setState({ ...this.state, status: 'playing', consecutiveFailures: 0 });
      }
      return;
    }
    if (event.type === 'complete') {
      if (event.completion !== 'audio') return;
      const result = await this.reportCorrelatedCallback(correlated, event.requestId, 'done', 'done');
      if (active === undefined || result.callbackDisposition !== 'applied' ||
        !this.isCorrelatedSessionCurrent(correlated)) return;
      this.applyCoreSnapshot(result.snapshot);
      await this.progressCommit({ chapter: correlated.chapter, charEnd: correlated.charEnd });
      if (!this.isCorrelatedSessionCurrent(correlated)) return;
      if (result.snapshot.state === 'completed') {
        await this.advanceOrComplete(active, result.snapshot);
        return;
      }
      await this.speakSlice(
        active,
        this.requireSnapshotIndex(result.snapshot, 'tts.queue.report-callback'),
        'preparing',
      );
      return;
    }
    if (event.type === 'error') {
      if (active === undefined) {
        await this.reportCorrelatedCallback(correlated, event.requestId, 'error', 'failed');
      } else {
        await this.handleUtteranceFailure(active, token, event.message);
      }
    }
    // `stop` is an acknowledgement only. Pause/skip/stop intents already
    // invalidated this request before asking the engine to stop.
  }

  private async pauseForSystem(reason: 'systemInterruption' | 'deviceChange'): Promise<void> {
    const active = this.active;
    if (active === undefined || !this.canPause()) return;
    this.invalidateUtterance(reason);
    this.setState({
      ...this.state,
      status: 'interrupted',
      requestId: undefined,
      pauseReason: reason,
    });
    await this.host.stop();
    if (this.isSessionCurrent(active.identity) && active.plan !== undefined) {
      const snapshot = await this.gateway.pause(active.input.chapter);
      this.applyCoreSnapshot(snapshot, undefined, reason);
    }
    await this.host.deactivateAudioSession();
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'interrupted' };
  }

  private async resumeAfterSystemInterruption(): Promise<void> {
    const active = this.active;
    if (active === undefined || active.plan === undefined || this.state.status !== 'interrupted' ||
      this.state.pauseReason !== 'systemInterruption' || this.state.sliceIndex === undefined) return;
    this.setState({ ...this.state, status: 'resuming', pauseReason: undefined, requestId: undefined });
    const identity = active.identity;
    const snapshot = await this.gateway.resume(active.input.chapter);
    if (!this.isSessionCurrent(identity)) return;
    this.applyCoreSnapshot(snapshot);
    await this.speakSlice(active, this.requireSnapshotIndex(snapshot, 'tts.queue.resume'), 'resuming');
  }

  private async handleUtteranceFailure(
    active: ActiveSession,
    token: ReaderTtsUtteranceToken,
    message: string,
  ): Promise<void> {
    const correlated = this.utterances.get(token.requestId);
    if (correlated === undefined) return;
    const result = await this.reportCorrelatedCallback(correlated, token.requestId, 'error', 'failed');
    if (result.callbackDisposition !== 'applied' || !this.isCorrelatedSessionCurrent(correlated)) return;
    this.applyCoreSnapshot(result.snapshot, message);
    if (result.failureAction === 'stop' || result.snapshot.state === 'stopped') {
      await this.stopAfterCoreFailure(result.snapshot, message);
      return;
    }
    if (result.snapshot.state === 'completed') {
      await this.advanceOrComplete(active, result.snapshot);
      return;
    }
    await this.speakSlice(
      active,
      this.requireSnapshotIndex(result.snapshot, 'tts.queue.report-callback'),
      'preparing',
    );
  }

  private async advanceOrComplete(active: ActiveSession, snapshot: ReaderTtsQueueSnapshot): Promise<void> {
    const loader = this.chapterAdvance;
    if (loader === undefined) {
      await this.completeSession();
      return;
    }
    try {
      const next = await loader(active.input.chapter);
      if (!this.isSessionCurrent(active.identity)) return;
      const transition = await this.gateway.chapterPlan(
        active.input.chapter,
        next?.chapter,
        snapshot.drainBehavior,
      );
      if (!this.isSessionCurrent(active.identity)) return;
      if (next === undefined || transition.next === undefined || transition.drainBehavior !== 'advance-to-next') {
        await this.completeSession();
        return;
      }
      next.onAdmitted?.();
      const nextChapterKey = this.chapterKey(next.chapter);
      this.setState({
        ...this.state,
        status: 'preparing',
        contentVersion: next.contentVersion,
        chapterKey: nextChapterKey,
        chapterIndex: next.chapter.chapterIndex,
        sliceIndex: undefined,
        totalSlices: 0,
        charStart: undefined,
        charEnd: undefined,
        requestId: undefined,
        consecutiveFailures: 0,
        pauseReason: undefined,
        stopReason: undefined,
        errorMessage: undefined,
      });
      active.input = {
        ...active.input,
        chapter: next.chapter,
        content: next.content,
        contentVersion: next.contentVersion,
        scalarPosition: 0,
      };
      active.identity = this.sessionIdentity(next.contentVersion, nextChapterKey);
      active.plan = await this.gateway.slice(next.chapter, next.content, 'paragraph-then-sentence');
      if (!this.isSessionCurrent(active.identity)) return;
      const nextSnapshot = await this.gateway.play(active.plan, 0);
      if (!this.isSessionCurrent(active.identity)) return;
      const ratedSnapshot = await this.gateway.setRate(
        next.chapter,
        this.coreRateForMultiplier(active.input.rate ?? 1),
      );
      if (!this.isSessionCurrent(active.identity)) return;
      this.applyCoreSnapshot(ratedSnapshot);
      await this.speakSlice(active, this.requireSnapshotIndex(nextSnapshot, 'tts.queue.play'), 'preparing');
    } catch (error) {
      const detail = error instanceof Error ? error.message : `${error}`;
      console.error(`Reader TTS chapter advance failed: ${detail}`);
      await this.stopAfterFailure(active, 'user');
    }
  }

  private async completeSession(): Promise<void> {
    this.clearTimer();
    this.invalidateUtterance();
    this.setState({
      ...this.state,
      status: 'completed',
      requestId: undefined,
      timerDeadlineMs: undefined,
      stopReason: 'completed',
    });
    this.active = undefined;
    await this.host.deactivateAudioSession();
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
  }

  private async stopAfterFailure(active: ActiveSession, reason: 'user' | 'failureLimit'): Promise<void> {
    this.clearTimer();
    this.invalidateUtterance();
    this.setState({
      ...this.state,
      status: 'stopping',
      requestId: undefined,
      timerDeadlineMs: undefined,
      stopReason: reason,
    });
    this.active = undefined;
    await this.host.stop();
    try {
      await this.gateway.stop(active.input.chapter);
    } catch (_) {
      // Preserve the original system vocalization failure.
    }
    await this.host.deactivateAudioSession();
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
    this.setState({
      ...this.state,
      status: 'idle',
      chapterKey: undefined,
      chapterIndex: undefined,
      sliceIndex: undefined,
      totalSlices: 0,
      charStart: undefined,
      charEnd: undefined,
      requestId: undefined,
      pauseReason: undefined,
      errorMessage: undefined,
    });
  }

  private async stopAfterCoreFailure(
    snapshot: ReaderTtsQueueSnapshot,
    message: string,
  ): Promise<void> {
    this.clearTimer();
    this.active = undefined;
    await this.host.stop();
    await this.host.deactivateAudioSession();
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none', currentRequestId: undefined };
    this.setState({
      ...this.state,
      status: 'failed',
      requestId: undefined,
      consecutiveFailures: snapshot.consecutiveFailures,
      stopReason: snapshot.consecutiveFailures >= snapshot.failureLimit ? 'failureLimit' : 'user',
      errorMessage: message.length > 0 ? message : 'Harmony system TTS failed',
    });
  }

  private skipToAdjacent(direction: 'next' | 'previous'): Promise<void> {
    const active = this.active;
    if (active === undefined || active.plan === undefined) return Promise.resolve();
    this.invalidateUtterance();
    this.setState({ ...this.state, status: 'preparing', requestId: undefined, errorMessage: undefined });
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      await this.host.stop();
      if (!this.isSessionCurrent(identity)) return;
      const snapshot = direction === 'next'
        ? await this.gateway.skip(active.input.chapter)
        : await this.gateway.previous(active.input.chapter);
      if (!this.isSessionCurrent(identity)) return;
      this.applyCoreSnapshot(snapshot);
      if (snapshot.state === 'completed') {
        await this.advanceOrComplete(active, snapshot);
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

  private reportCorrelatedCallback(
    correlated: CorrelatedUtterance,
    requestId: string,
    phase: 'start' | 'done' | 'error',
    status: 'speaking' | 'done' | 'failed',
  ): Promise<ReaderTtsCallbackResult> {
    return this.gateway.reportCallback(
      correlated.chapter,
      correlated.sliceIndex,
      status,
      `${requestId}:${phase}`,
      correlated.failurePolicy,
      3,
    );
  }

  private isCorrelatedSessionCurrent(correlated: CorrelatedUtterance): boolean {
    return this.active !== undefined && this.isSessionCurrent(correlated.identity);
  }

  private applyCoreSnapshot(
    snapshot: ReaderTtsQueueSnapshot,
    errorMessage?: string,
    pauseReason?: 'user' | 'systemInterruption' | 'routeBackground' | 'deviceChange',
  ): void {
    this.coreSnapshot = snapshot;
    const active = this.active;
    const currentSlice = active?.plan?.slices[snapshot.currentSliceIndex ?? -1];
    const currentRequestStillValid = snapshot.currentSliceIndex === this.state.sliceIndex &&
      snapshot.state === 'playing' && this.transport.currentRequestId === this.state.requestId;
    const status = snapshot.state === 'playing' ? 'playing' :
      snapshot.state === 'paused' && pauseReason !== undefined && pauseReason !== 'user' ? 'interrupted' :
        snapshot.state === 'paused' ? 'paused' :
        snapshot.state === 'completed' ? 'completed' :
          snapshot.state === 'stopped' && errorMessage !== undefined ? 'failed' : 'idle';
    this.setState({
      ...this.state,
      status,
      chapterKey: this.chapterKey(snapshot.chapter),
      chapterIndex: snapshot.chapter.chapterIndex,
      sliceIndex: snapshot.currentSliceIndex,
      totalSlices: snapshot.totalSlices,
      charStart: currentSlice?.charStart,
      charEnd: currentSlice?.charEnd,
      requestId: currentRequestStillValid ? this.transport.currentRequestId : undefined,
      consecutiveFailures: snapshot.consecutiveFailures,
      pauseReason: snapshot.state === 'paused' ? pauseReason ?? this.state.pauseReason : undefined,
      errorMessage,
    });
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

  private canPause(): boolean {
    return this.state.status === 'playing' || this.state.status === 'preparing' ||
      this.state.status === 'resuming' || this.state.status === 'interrupted';
  }

  private invalidateUtterance(
    interruption?: 'systemInterruption' | 'routeBackground' | 'deviceChange',
  ): void {
    if (this.transport.currentRequestId === undefined && interruption === undefined) return;
    this.transport = {
      ...this.transport,
      utteranceGeneration: this.nextGeneration(this.transport.utteranceGeneration),
      currentRequestId: undefined,
      interruption,
    };
  }

  private sessionIdentity(
    contentVersion: ReaderTtsContentVersion,
    chapterKey: string,
  ): ReaderTtsSessionIdentity {
    return {
      sessionGeneration: this.transport.sessionGeneration,
      contentVersion,
      chapterKey,
    };
  }

  private utteranceToken(
    identity: ReaderTtsSessionIdentity,
    chapter: ReaderTtsChapterRef,
    sliceIndex: number,
    requestId: string,
  ): ReaderTtsUtteranceToken {
    return {
      ...identity,
      utteranceGeneration: this.transport.utteranceGeneration,
      requestId,
      chapterIndex: chapter.chapterIndex,
      sliceIndex,
    };
  }

  private isSessionCurrent(identity: ReaderTtsSessionIdentity): boolean {
    return this.transport.sessionGeneration === identity.sessionGeneration &&
      this.state.contentVersion === identity.contentVersion &&
      this.state.chapterKey === identity.chapterKey;
  }

  private isUtteranceCurrent(token: ReaderTtsUtteranceToken): boolean {
    return this.isSessionCurrent(token) &&
      this.transport.utteranceGeneration === token.utteranceGeneration &&
      this.transport.currentRequestId === token.requestId &&
      this.state.chapterIndex === token.chapterIndex &&
      this.state.sliceIndex === token.sliceIndex;
  }

  private nextGeneration(generation: number): number {
    return generation >= Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
  }

  private configureTimer(durationMs: number | undefined): void {
    this.clearTimer();
    if (durationMs === undefined) {
      this.transport = { ...this.transport, timerDeadlineMs: undefined };
      this.setState({ ...this.state, timerDeadlineMs: undefined });
      return;
    }
    if (!Number.isSafeInteger(durationMs) || durationMs <= 0) {
      throw new Error('Reader TTS timer duration must be a positive safe integer');
    }
    const deadline = Date.now() + durationMs;
    if (!Number.isSafeInteger(deadline)) throw new Error('Reader TTS timer deadline exceeds the safe integer range');
    this.transport = { ...this.transport, timerDeadlineMs: deadline };
    this.setState({ ...this.state, timerDeadlineMs: deadline });
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
    this.transport = { ...this.transport, timerDeadlineMs: undefined };
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
