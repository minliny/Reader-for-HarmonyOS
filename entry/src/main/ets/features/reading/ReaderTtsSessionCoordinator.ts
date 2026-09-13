import { diagnosticCodeOf } from '../../app/LogPrivacy.ts';
import { errorMessageOf } from '../../app/ErrorMessage.ts';
import {
  createReaderTtsState,
  type ReaderTtsContentVersion,
  type ReaderTtsSessionIdentity,
  type ReaderTtsState,
  type ReaderTtsStopReason,
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

const TTS_RATE_MIN = 0.5;
const TTS_RATE_MAX = 2;
const DEFAULT_START_CALLBACK_TIMEOUT_MS = 15000;
// Host engines may deliver a duplicate completion after the coordinator has
// already advanced the Core queue.  Keep a small, bounded correlation window
// for those late callbacks; retaining every completed slice would make a
// long-running book a process-lifetime memory leak.
const MAX_RETAINED_COMPLETED_UTTERANCES = 128;

let READER_TTS_COORDINATOR_SEQ = 0;

export type ReaderTtsCoordinatorOptions = {
  /** Max delay between host.speak() acceptance and the real onStart callback. */
  startCallbackTimeoutMs?: number;
};

type StartWaiter = { generation: number; resolve: (started: boolean) => void };

export type ReaderTtsHostSpeakRequest = {
  requestId: string;
  text: string;
  rate: number;
  pitch: number;
  language: string;
  person: number;
  engine?: string;
};

export type ReaderTtsHostEvent =
  | { type: 'start'; requestId: string }
  | { type: 'complete'; requestId: string; completion: 'audio' | 'synthesis' }
  | { type: 'stop'; requestId: string }
  | { type: 'error'; requestId: string; message: string }
  | { type: 'interruption'; action: 'pause' | 'resume' | 'stop' | 'duck' | 'unduck' }
  | { type: 'deviceChange'; action: 'continue' | 'stop' }
  | { type: 'mediaControl'; action: 'play' | 'pause' | 'stop' | 'next' | 'previous' };

export type ReaderTtsHostProbe = {
  available: boolean;
  /** Specific unavailability cause: capability, voice, or engine init failure. */
  reason?: string;
};

export interface ReaderTtsHost {
  /**
   * Owner-scoped listener registration: a later clearEventListener(owner) must
   * only detach the listener when `owner` is still the registered one, so a
   * torn-down page can never drop a newer page's listener on a shared Host.
   */
  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined, owner: string): void;
  clearEventListener(owner: string): void;
  selectEngine(engine?: string): Promise<boolean>;
  probe(): Promise<ReaderTtsHostProbe>;
  isAvailable(): Promise<boolean>;
  activateAudioSession(allowMixing: boolean): Promise<void>;
  deactivateAudioSession(): Promise<void>;
  speak(request: ReaderTtsHostSpeakRequest): Promise<void>;
  stop(): Promise<void>;
  publishPlaybackState(state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'): void;
  /** Optional policy gate for the platform continuous-task lease. */
  setBackgroundPlaybackEnabled?(enabled: boolean): void;
}

export type ReaderTtsStartInput = {
  chapter: ReaderTtsChapterRef;
  content: string;
  contentVersion: ReaderTtsContentVersion;
  scalarPosition: number;
  rate?: number;
  pitch?: number;
  language?: string;
  person?: number;
  pauseOnInterruption?: boolean;
  allowMixing?: boolean;
  backgroundPlayback?: boolean;
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

export interface ReaderTtsAuditionInput {
  engine?: string;
  language: string;
  person: number;
  rate?: number;
  pitch?: number;
}
interface ReaderTtsAuditionSession {
  requestId: string;
  restoreEngine: string | undefined;
  timer: number;
  resolve: () => void;
  reject: (error: Error) => void;
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
  private probedConfig: ReaderTtsConfig | undefined = undefined;
  private active: ActiveSession | undefined = undefined;
  private disposed: boolean = false;
  private desiredPlaying: boolean = true;
  private audition: ReaderTtsAuditionSession | undefined = undefined;
  private auditionSequence: number = 0;
  private timerHandle: number = -1;
  private timerGeneration: number = 0;
  private readonly utterances: Map<string, CorrelatedUtterance> = new Map();
  private readonly retainedUtteranceOrder: string[] = [];
  private readonly retainedUtteranceIds: Set<string> = new Set();
  private readonly ownerToken: string;
  private readonly startCallbackTimeoutMs: number;
  private readonly startWaiters: StartWaiter[] = [];
  private startConfirmedRequestId: string | undefined = undefined;
  private startWatchdogHandle: number = -1;
  private awaitingStartToken: ReaderTtsUtteranceToken | undefined = undefined;

  constructor(
    gateway: ReaderTtsCoordinatorGateway | ReaderTtsGateway,
    host: ReaderTtsHost,
    progressCommit: (progress: ReaderTtsProgressCommit) => Promise<void> = async (): Promise<void> => {},
    stateListener?: (state: ReaderTtsState) => void,
    chapterAdvance?: (chapter: ReaderTtsChapterRef) => Promise<ReaderTtsChapterAdvanceInput | undefined>,
    options?: ReaderTtsCoordinatorOptions,
  ) {
    this.gateway = gateway;
    this.host = host;
    this.progressCommit = progressCommit;
    this.stateListener = stateListener;
    this.chapterAdvance = chapterAdvance;
    this.ownerToken = `tts-coordinator-${++READER_TTS_COORDINATOR_SEQ}`;
    this.startCallbackTimeoutMs = options?.startCallbackTimeoutMs ?? DEFAULT_START_CALLBACK_TIMEOUT_MS;
    this.host.setEventListener((event: ReaderTtsHostEvent): void => {
      this.routeHostEvent(event);
    }, this.ownerToken);
  }

  private routeHostEvent(event: ReaderTtsHostEvent): void {
    const audition = this.audition;
    if (audition !== undefined) {
      if ('requestId' in event && event.requestId === audition.requestId) {
        if (event.type === 'error') this.voidLogged(this.finishAudition(audition, new Error(event.message)), 'audition.error');
        else if (event.type === 'stop' || (event.type === 'complete' && event.completion === 'audio')) {
          this.voidLogged(this.finishAudition(audition), 'audition.complete');
        }
        return; // Audition callbacks never enter Core's book queue or progress path.
      }
      if (event.type === 'interruption' || event.type === 'deviceChange') {
        this.voidLogged(this.stopAudition(), 'audition.interruption');
      }
    }
    if (event.type === 'mediaControl') {
      if (event.action === 'play') this.voidLogged(this.resume(), 'mediaControl.play');
      else if (event.action === 'pause') this.voidLogged(this.pause(), 'mediaControl.pause');
      else if (event.action === 'stop') this.voidLogged(this.stop('user'), 'mediaControl.stop');
      else if (event.action === 'next') this.voidLogged(this.next(), 'mediaControl.next');
      else this.voidLogged(this.previous(), 'mediaControl.previous');
      return;
    }
    if (event.type === 'interruption') {
      if (event.action === 'pause' || event.action === 'stop') {
        if (this.active?.input.pauseOnInterruption ?? true) {
          this.voidLogged(this.pauseForSystem('systemInterruption'), 'interruption.pause');
        } else {
          this.voidLogged(this.stop('systemInterruption'), 'interruption.stop');
        }
      } else if (event.action === 'resume') {
        this.voidLogged(this.resume(), 'interruption.resume');
      }
      return;
    }
    if (event.type === 'deviceChange') {
      if (event.action === 'stop') {
        this.voidLogged(this.pauseForSystem('deviceChange'), 'deviceChange.stop');
      }
      return;
    }
    this.voidLogged(this.enqueue(async (): Promise<void> => this.handleHostEvent(event)), `callback.${event.type}`);
  }

  auditionVoice(input: ReaderTtsAuditionInput): Promise<void> {
    if (this.disposed || !input.language.trim() || !Number.isSafeInteger(input.person) || input.person < 0 ||
        (input.rate !== undefined && (!Number.isFinite(input.rate) || input.rate < 0.5 || input.rate > 2)) ||
        (input.pitch !== undefined && (!Number.isFinite(input.pitch) || input.pitch < 0.5 || input.pitch > 2))) {
      return Promise.reject(new Error('试听参数无效'));
    }
    const previous = this.stopAudition();
    const pause = this.pause();
    let resolve: () => void = (): void => {};
    let reject: (error: Error) => void = (_error: Error): void => {};
    const completed = new Promise<void>((accept, fail): void => { resolve = accept; reject = fail; });
    const session: ReaderTtsAuditionSession = {
      requestId: `${this.ownerToken}-audition-${++this.auditionSequence}`,
      restoreEngine: this.active?.config?.engine ?? this.probedConfig?.engine,
      timer: -1, resolve, reject,
    };
    this.audition = session;
    session.timer = globalThis.setTimeout((): void => {
      this.voidLogged(this.finishAudition(session, new Error('试听超时，请重试')), 'audition.timeout');
    }, 15000) as number;
    const current = (): boolean => this.audition === session && !this.disposed;
    const prepare = this.enqueue(async (): Promise<void> => {
      try {
        await previous;
        await pause;
        if (!current()) return;
        const selected = await this.host.selectEngine(input.engine ?? session.restoreEngine);
        if (!current()) return;
        if (!selected) throw new Error('当前试听引擎不可用');
        const probe = await this.host.probe();
        if (!current()) return;
        if (!probe.available) throw new Error(probe.reason ?? '当前音色不可用');
        this.host.setBackgroundPlaybackEnabled?.(false);
        await this.host.activateAudioSession(false);
        if (!current()) return;
        // Speaking is an owned transport operation. Its completion is delivered by
        // the existing Host listener; a missing acceptance ACK must not hold
        // the config lane and prevent cancellation/engine restoration.
        void this.host.speak({ requestId: session.requestId,
          text: '这是音色试听。愿你在阅读中，发现更广阔的世界。',
          language: input.language, person: input.person, rate: input.rate ?? 1,
          pitch: input.pitch ?? 1, engine: input.engine ?? session.restoreEngine })
          .catch((error: Error): void => {
            if (current()) void this.finishAudition(session, error).catch((): void => {});
          });
      } catch (error) {
        // Release after this operation returns; awaiting our own queued cleanup would deadlock.
        void this.finishAudition(session, new Error(errorMessageOf(error))).catch((): void => {});
      }
    });
    void prepare.catch((error: Error): void => { void this.finishAudition(session, error).catch((): void => {}); });
    return completed;
  }

  stopAudition(): Promise<void> {
    const session = this.audition;
    return session === undefined ? Promise.resolve() : this.finishAudition(session);
  }

  private finishAudition(session: ReaderTtsAuditionSession, failure?: Error): Promise<void> {
    if (this.audition !== session) return Promise.resolve();
    this.audition = undefined;
    globalThis.clearTimeout(session.timer);
    const stopping = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      let result = failure;
      try {
        const stopError = await stopping;
        if (stopError !== undefined) throw stopError;
        await this.host.deactivateAudioSession();
        if (!await this.host.selectEngine(session.restoreEngine)) throw new Error('试听后恢复朗读引擎失败');
      } catch (error) { result = new Error(errorMessageOf(error)); }
      if (result === undefined) session.resolve();
      else session.reject(result);
    });
  }

  getState(): ReaderTtsState {
    return { ...this.state };
  }

  getTransportState(): HostTtsTransportState {
    return { ...this.transport };
  }

  getProbedConfig(): ReaderTtsConfig | undefined {
    return this.probedConfig;
  }

  /**
   * Engine probing is a transport mutation (selectEngine can replace the
   * active Host implementation), so it must share the same serial tail as
   * playback intents.  Without this boundary a delayed probe can switch the
   * router after a newer session has already started speaking.
   */
  async probeAvailability(): Promise<boolean> {
    let available = false;
    await this.enqueue(async (): Promise<void> => {
      available = await this.probeAvailabilityInternal();
    });
    return available;
  }

  private async probeAvailabilityInternal(): Promise<boolean> {
    // Public stop/start intents update transport state synchronously before
    // entering the operation tail.  Capture the generation here so a probe
    // that is already awaiting a platform call cannot publish idle/unavailable
    // state over that newer intent when its callback resumes.
    const probeGeneration = this.transport.sessionGeneration;
    const isProbeCurrent = (): boolean => !this.disposed &&
      this.transport.sessionGeneration === probeGeneration;
    const hadActiveSession = this.active !== undefined;
    if (!hadActiveSession && isProbeCurrent()) {
      this.setState({ ...this.state, status: 'probing' });
    }
    try {
      const config = await this.gateway.getConfig();
      if (!isProbeCurrent()) return false;
      // A session may have been admitted while getConfig awaited. Do not
      // select another engine in that case: the session's prepare transaction
      // owns the router, and probing the already-selected Host is sufficient.
      if (this.active !== undefined) {
        const probe = await this.host.probe();
        if (!isProbeCurrent()) return false;
        return probe.available;
      }
      this.probedConfig = config;
      await this.host.selectEngine(config?.engine);
      if (!isProbeCurrent()) return false;
      // start() can be called while selectEngine is awaiting a platform
      // response. Its prepare transaction will select the correct engine;
      // avoid publishing the stale probe's engine classification.
      if (this.active !== undefined) {
        const probe = await this.host.probe();
        if (!isProbeCurrent()) return false;
        return probe.available;
      }
      this.transport = {
        ...this.transport,
        engine: config?.engine?.startsWith('http-tts:') ? 'http' : 'system',
      };
      const probe = await this.host.probe();
      if (!isProbeCurrent()) return false;
      if (!probe.available) {
        if (this.active === undefined && isProbeCurrent()) {
          this.setState({
            ...this.state,
            status: 'unavailable',
            stopReason: 'engineUnavailable',
            errorMessage: probe.reason ?? '当前朗读引擎不可用',
          });
        }
        return false;
      }
      if (this.active === undefined && isProbeCurrent()) {
        const wasEngineUnavailable = this.state.stopReason === 'engineUnavailable';
        this.setState({
          ...this.state,
          status: 'idle',
          stopReason: wasEngineUnavailable ? undefined : this.state.stopReason,
          errorMessage: wasEngineUnavailable ? undefined : this.state.errorMessage,
        });
      }
      return true;
    } catch (error) {
      const detail = errorMessageOf(error);
      this.logTtsEvent('probe', detail);
      if (this.active === undefined && isProbeCurrent()) {
        this.setState({
          ...this.state,
          status: 'unavailable',
          stopReason: 'engineUnavailable',
          errorMessage: detail.length > 0 ? detail : '朗读可用性探测失败',
        });
      }
      return false;
    }
  }

  start(input: ReaderTtsStartInput, desiredPlaying: boolean = true): Promise<void> {
    this.assertStartInput(input);
    this.voidLogged(this.stopAudition(), 'audition.formal-start');
    this.desiredPlaying = desiredPlaying;
    const chapterKey = this.chapterKey(input.chapter);
    const rate = input.rate ?? 1;
    this.clearUtteranceCorrelations();
    this.resolveStartWaiters(false);
    this.transport = {
      ...this.transport,
      sessionGeneration: this.nextGeneration(this.transport.sessionGeneration),
      utteranceGeneration: this.nextGeneration(this.transport.utteranceGeneration),
      currentRequestId: undefined,
      interruption: undefined,
    };
    this.startConfirmedRequestId = undefined;
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
      audioStarted: false,
      errorMessage: undefined,
    });
    this.configureTimer(input.timerDurationMs);
    const identity = this.sessionIdentity(input.contentVersion, chapterKey);
    const prior = this.active;
    const hostStopTask = prior === undefined ? undefined : this.stopHostTransportImmediately();
    this.active = { identity, input: { ...input, rate } };
    return this.enqueue(async (): Promise<void> => this.prepareNewSession(identity, prior, hostStopTask));
  }

  /**
   * Resolves once the current session either received its first real onStart
   * callback (true) or terminated without one (false). Call right after
   * start(); the control panel may only hide on `true`.
   */
  whenStarted(): Promise<boolean> {
    if (this.state.audioStarted === true) return Promise.resolve(true);
    if (this.active === undefined) return Promise.resolve(this.state.status === 'playing');
    const generation = this.transport.sessionGeneration;
    return new Promise<boolean>((resolve: (started: boolean) => void): void => {
      this.startWaiters.push({ generation, resolve });
    });
  }

  /** Synchronous launch intent; preparation reads it again before any native speech.
   * Ready/playing callers still use resume()/pause() for the transport transaction. */
  setDesiredPlaying(value: boolean): void {
    this.desiredPlaying = value;
  }

  pause(): Promise<void> {
    return this.pauseForReason('user');
  }

  pauseForBackground(): Promise<void> {
    return this.pauseForReason('routeBackground');
  }

  private pauseForReason(reason: 'user' | 'routeBackground'): Promise<void> {
    this.desiredPlaying = false;
    const active = this.active;
    if (active === undefined || !this.canPause()) return Promise.resolve();
    this.invalidateUtterance(reason === 'user' ? undefined : reason);
    this.setState({
      ...this.state,
      status: reason === 'user' ? 'paused' : 'interrupted',
      requestId: undefined,
      pauseReason: reason,
    });
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      const hostStopError = await hostStopTask;
      if (hostStopError !== undefined) throw hostStopError;
      if (this.isSessionCurrent(active.identity)) {
        const snapshot = await this.gateway.pause(active.input.chapter);
        this.applyCoreSnapshot(snapshot, undefined, reason);
      }
      await this.host.deactivateAudioSession();
      this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
    });
  }

  resume(): Promise<void> {
    this.voidLogged(this.stopAudition(), 'audition.formal-resume');
    this.desiredPlaying = true;
    const active = this.active;
    if ((this.state.status !== 'paused' && this.state.status !== 'interrupted') ||
      active === undefined || active.plan === undefined ||
      this.state.sliceIndex === undefined) return Promise.resolve();
    this.setState({ ...this.state, status: 'preparing', pauseReason: undefined, requestId: undefined });
    const identity = active.identity;
    return this.enqueue(async (): Promise<void> => {
      if (!this.isSessionCurrent(identity)) return;
      const snapshot = await this.gateway.resume(active.input.chapter);
      if (!this.isSessionCurrent(identity)) return;
      this.applyCoreSnapshot(snapshot);
      const index = this.requireSnapshotIndex(snapshot, 'tts.queue.resume');
      await this.speakSlice(active, index, 'preparing');
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
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      const hostStopError = await hostStopTask;
      if (hostStopError !== undefined) throw hostStopError;
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
    if (!Number.isFinite(rate) || rate < TTS_RATE_MIN || rate > TTS_RATE_MAX) {
      return Promise.reject(new Error('Reader TTS rate must be between 0.5 and 2.0'));
    }
    // Re-selecting the current rate must retain the in-flight utterance token.
    if (priorRate === rate) return Promise.resolve();
    if (active === undefined || active.plan === undefined || this.state.sliceIndex === undefined) {
      if (active !== undefined) active.input = { ...active.input, rate };
      this.setState({ ...this.state, rate });
      return Promise.resolve();
    }
    const priorInput = { ...active.input };
    const priorState = { ...this.state };
    const identity = active.identity;
    const index = this.state.sliceIndex;
    this.invalidateUtterance();
    this.setState({ ...this.state, status: 'preparing', rate: priorRate, requestId: undefined,
      errorMessage: undefined });
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      try {
        const hostStopError = await hostStopTask;
        if (hostStopError !== undefined) throw hostStopError;
        if (!this.isSessionCurrent(identity)) return;
        const snapshot = await this.gateway.setRate(active.input.chapter, this.coreRateForMultiplier(rate));
        if (!this.isSessionCurrent(identity)) return;
        const paused = priorState.status === 'paused' || priorState.status === 'interrupted';
        // Commit the candidate only after Core accepted the precise rate.
        active.input = { ...active.input, rate };
        this.setState({ ...this.state, rate });
        this.applyCoreSnapshot(snapshot);
        if (paused || snapshot.state === 'paused') return;
        await this.speakSlice(active, index, 'preparing');
      } catch (error) {
        if (!this.isSessionCurrent(identity)) throw error;
        active.input = priorInput;
        let restored = true;
        // Core may have accepted the mutation before the transport reported
        // an error. Restore the old value before exposing the failure.
        try {
          await this.gateway.setRate(active.input.chapter, this.coreRateForMultiplier(priorRate));
        } catch (_) {
          restored = false;
        }
        if (!restored) {
          await this.terminateToError(`语速切换失败：${errorMessageOf(error)}`, 'utteranceFailed');
        } else if (priorState.status === 'playing' || priorState.status === 'preparing' ||
          priorState.status === 'resuming') {
          this.setState({ ...priorState, errorMessage: `语速切换失败：${errorMessageOf(error)}` });
          try {
            await this.speakSlice(active, index, 'preparing');
          } catch (recoveryError) {
            await this.terminateToError(`语速切换失败：${errorMessageOf(recoveryError)}`, 'utteranceFailed');
          }
        } else {
          this.setState({ ...priorState, errorMessage: `语速切换失败：${errorMessageOf(error)}` });
        }
        throw error;
      }
    });
  }

  setTimer(durationMs: number | undefined): void {
    this.configureTimer(durationMs);
  }

  setAllowMixing(allowMixing: boolean): Promise<void> {
    const active = this.active;
    if (active === undefined) return Promise.resolve();
    const priorInput = { ...active.input };
    const identity = active.identity;
    const candidate = { ...active.input, allowMixing };
    return this.enqueue(async (): Promise<void> => {
      if (!this.isSessionCurrent(identity)) return;
      if (this.transport.audioSession === 'active') {
        await this.host.activateAudioSession(candidate.allowMixing ?? false);
      }
      if (this.isSessionCurrent(identity)) active.input = candidate;
    }).catch((error: Error): never => {
      if (this.isSessionCurrent(identity)) active.input = priorInput;
      throw error;
    });
  }

  setFailurePolicy(failurePolicy: 'skip' | 'stop'): void {
    if (this.active !== undefined) this.active.input = { ...this.active.input, failurePolicy };
  }

  setPauseOnInterruption(pauseOnInterruption: boolean): void {
    if (this.active !== undefined) this.active.input = { ...this.active.input, pauseOnInterruption };
  }

  setVoice(language: string, person: number): Promise<void> {
    this.voidLogged(this.stopAudition(), 'audition.voice-change');
    const normalizedLanguage = language.trim();
    if (normalizedLanguage.length === 0 || !Number.isSafeInteger(person) || person < 0) {
      return Promise.reject(new Error('Reader TTS voice requires a language and non-negative person'));
    }
    const active = this.active;
    if (active === undefined) return Promise.resolve();
    const priorInput = { ...active.input };
    const priorState = { ...this.state };
    const candidate = { ...active.input, language: normalizedLanguage, person };
    if (active.plan === undefined || this.state.sliceIndex === undefined ||
      this.state.status === 'paused' || this.state.status === 'interrupted') {
      return this.enqueue(async (): Promise<void> => {
        if (this.isSessionCurrent(active.identity)) active.input = candidate;
      });
    }
    const identity = active.identity;
    const index = this.state.sliceIndex;
    this.invalidateUtterance();
    this.setState({ ...this.state, status: 'preparing', requestId: undefined, errorMessage: undefined });
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      try {
        const hostStopError = await hostStopTask;
        if (hostStopError !== undefined) throw hostStopError;
        if (!this.isSessionCurrent(identity)) return;
        // The new voice becomes visible only when the replacement utterance
        // has been admitted to the same session transaction.
        active.input = candidate;
        await this.speakSlice(active, index, 'preparing');
      } catch (error) {
        if (!this.isSessionCurrent(identity)) throw error;
        active.input = priorInput;
        this.setState({ ...priorState, errorMessage: `音色切换失败：${errorMessageOf(error)}` });
        try {
          if (priorState.status === 'playing' || priorState.status === 'preparing' ||
            priorState.status === 'resuming') {
            await this.speakSlice(active, index, 'preparing');
          }
        } catch (recoveryError) {
          await this.terminateToError(`音色切换失败：${errorMessageOf(recoveryError)}`, 'utteranceFailed');
        }
        throw error;
      }
    });
  }

  stop(reason: 'user' | 'timer' | 'lifecycle' | 'contentChanged' | 'screenOff' |
    'systemInterruption' = 'user'): Promise<void> {
    this.voidLogged(this.stopAudition(), 'audition.stop');
    const active = this.active;
    this.clearTimer();
    this.clearStartWatchdog();
    this.awaitingStartToken = undefined;
    this.transport = {
      ...this.transport,
      sessionGeneration: this.nextGeneration(this.transport.sessionGeneration),
      utteranceGeneration: this.nextGeneration(this.transport.utteranceGeneration),
      currentRequestId: undefined,
    };
    this.startConfirmedRequestId = undefined;
    this.resolveStartWaiters(false);
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
    this.clearUtteranceCorrelations();
    const hostStopTask = this.stopHostTransportImmediately();
    this.host.publishPlaybackState('stopped');
    return this.enqueue(async (): Promise<void> => {
      const hostStopError = await hostStopTask;
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
          audioStarted: false,
        });
      }
      if (hostStopError !== undefined) throw hostStopError;
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.resolveStartWaiters(false);
    await this.stop('lifecycle');
    this.host.clearEventListener(this.ownerToken);
  }

  whenSettled(): Promise<void> {
    return this.operationTail;
  }

  private async prepareNewSession(
    identity: ReaderTtsSessionIdentity,
    prior: ActiveSession | undefined,
    hostStopTask: Promise<Error | undefined> | undefined,
  ): Promise<void> {
    try {
      if (prior !== undefined) {
        if (hostStopTask === undefined) throw new Error('Reader TTS prior session has no Host stop task');
        const hostStopError = await hostStopTask;
        if (hostStopError !== undefined) throw hostStopError;
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
      const probe = await this.host.probe();
      if (!this.isSessionCurrent(identity)) return;
      if (!probe.available) {
        this.abandonSessionTo('unavailable', 'engineUnavailable', probe.reason ?? '当前朗读引擎不可用');
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
    } catch (error) {
      await this.rollbackFailedStart(identity, error);
    }
  }

  /**
   * Transactional start rollback: any RPC, audio-session, or Host failure
   * releases the transport and lands in a retryable `error` state instead of
   * wedging in `preparing`.
   */
  private async rollbackFailedStart(identity: ReaderTtsSessionIdentity, error: unknown): Promise<void> {
    const detail = errorMessageOf(error);
    this.logTtsEvent('start.failed', detail);
    if (!this.isSessionCurrent(identity)) return;
    await this.terminateToError(`朗读启动失败：${detail}`, 'startFailed');
  }

  /** Releases every transport resource and lands in a retryable `error`. */
  private async terminateToError(message: string, stopReason: ReaderTtsStopReason): Promise<void> {
    this.clearTimer();
    this.clearStartWatchdog();
    this.awaitingStartToken = undefined;
    const active = this.active;
    this.active = undefined;
    this.clearUtteranceCorrelations();
    this.startConfirmedRequestId = undefined;
    this.transport = {
      ...this.transport,
      currentRequestId: undefined,
      audioSession: 'inactive',
      focus: 'none',
    };
    this.setState({
      ...this.state,
      status: 'error',
      chapterKey: undefined,
      chapterIndex: undefined,
      sliceIndex: undefined,
      totalSlices: 0,
      charStart: undefined,
      charEnd: undefined,
      requestId: undefined,
      pauseReason: undefined,
      timerDeadlineMs: undefined,
      audioStarted: false,
      stopReason,
      errorMessage: message,
    });
    try {
      await this.host.stop();
    } catch (error) {
      this.logTtsEvent('error-stop.host', errorMessageOf(error));
    }
    if (active !== undefined) {
      try {
        await this.gateway.stop(active.input.chapter);
      } catch (error) {
        this.logTtsEvent('error-stop.queue', errorMessageOf(error));
      }
    }
    try {
      await this.host.deactivateAudioSession();
    } catch (error) {
      this.logTtsEvent('error-stop.audio', errorMessageOf(error));
    }
    // Waiters unblock only after the transport is fully released, so a
    // `whenStarted(false)` consumer observes the settled error state.
    this.resolveStartWaiters(false);
  }

  /** Leaves the current session without a retryable error (capability gate). */
  private abandonSessionTo(
    status: 'unavailable',
    stopReason: ReaderTtsStopReason,
    message: string,
  ): void {
    this.clearTimer();
    this.clearStartWatchdog();
    this.awaitingStartToken = undefined;
    this.active = undefined;
    this.clearUtteranceCorrelations();
    this.startConfirmedRequestId = undefined;
    this.transport = {
      ...this.transport,
      currentRequestId: undefined,
      audioSession: 'inactive',
      focus: 'none',
    };
    this.setState({
      ...this.state,
      status,
      chapterKey: undefined,
      chapterIndex: undefined,
      sliceIndex: undefined,
      totalSlices: 0,
      charStart: undefined,
      charEnd: undefined,
      requestId: undefined,
      pauseReason: undefined,
      timerDeadlineMs: undefined,
      audioStarted: false,
      stopReason,
      errorMessage: message,
    });
    this.resolveStartWaiters(false);
  }

  private async parkPreparedSession(active: ActiveSession): Promise<boolean> {
    if (!this.isSessionCurrent(active.identity)) return true;
    if (this.desiredPlaying) return false;
    this.invalidateUtterance();
    const paused = await this.gateway.pause(active.input.chapter);
    if (!this.isSessionCurrent(active.identity)) return true;
    this.applyCoreSnapshot(paused, undefined, 'user');
    await this.host.deactivateAudioSession();
    if (!this.isSessionCurrent(active.identity)) return true;
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none' };
    if (!this.desiredPlaying) return true;
    // A second click while the pause acknowledgement was in flight is newer.
    const resumed = await this.gateway.resume(active.input.chapter);
    if (!this.isSessionCurrent(active.identity)) return true;
    this.applyCoreSnapshot(resumed);
    return false;
  }

  private async speakSlice(active: ActiveSession, index: number, status: 'preparing'): Promise<void> {
    if (await this.parkPreparedSession(active)) return;
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
    this.host.publishPlaybackState('preparing');
    const token = this.utteranceToken(active.identity, active.input.chapter, slice.index, requestId);
    this.utterances.set(token.requestId, {
      identity: active.identity,
      chapter: active.input.chapter,
      sliceIndex: token.sliceIndex,
      charEnd: slice.charEnd,
      failurePolicy: active.input.failurePolicy ?? 'stop',
    });
    try {
      this.host.setBackgroundPlaybackEnabled?.(active.input.backgroundPlayback ?? true);
      await this.host.activateAudioSession(active.input.allowMixing ?? false);
    } catch (error) {
      await this.handleSessionUtteranceFailure(active, token,
        `音频会话启动失败：${errorMessageOf(error)}`);
      return;
    }
    this.transport = { ...this.transport, audioSession: 'active', focus: 'held' };
    if (!this.isUtteranceCurrent(token)) return;
    if (!this.desiredPlaying) {
      if (!await this.parkPreparedSession(active) && this.isSessionCurrent(active.identity)) {
        await this.speakSlice(active, index, status);
      }
      return;
    }
    try {
      await this.host.speak({
        requestId: token.requestId,
        text: slice.text,
        rate: active.input.rate ?? 1,
        pitch: active.input.pitch ?? 1,
        language: active.input.language ?? 'zh-CN',
        person: active.input.person ?? 0,
        engine: active.config?.engine,
      });
    } catch (error) {
      await this.handleSessionUtteranceFailure(active, token, errorMessageOf(error));
      return;
    }
    if (!this.isUtteranceCurrent(token)) return;
    this.awaitingStartToken = token;
    this.armStartWatchdog(token);
  }

  /**
   * Before the first real onStart of a session, any speak-path failure is a
   * start-transaction failure and lands in retryable `error`. Afterwards the
   * Core failure policy governs (skip retries the next slice, stop ends it).
   */
  private async handleSessionUtteranceFailure(
    active: ActiveSession,
    token: ReaderTtsUtteranceToken,
    message: string,
  ): Promise<void> {
    if (!this.isUtteranceCurrent(token)) return;
    if (!this.state.audioStarted) {
      await this.terminateToError(message.length > 0 ? message : '朗读启动失败', 'startFailed');
      return;
    }
    await this.handleUtteranceFailure(active, token, message);
  }

  private armStartWatchdog(token: ReaderTtsUtteranceToken): void {
    this.clearStartWatchdog();
    this.startWatchdogHandle = setTimeout((): void => {
      this.startWatchdogHandle = -1;
      if (this.disposed) return;
      if (this.awaitingStartToken !== token || !this.isUtteranceCurrent(token)) return;
      void this.enqueue((): Promise<void> => this.onStartCallbackTimeout(token));
    }, this.startCallbackTimeoutMs);
  }

  private clearStartWatchdog(): void {
    if (this.startWatchdogHandle >= 0) {
      clearTimeout(this.startWatchdogHandle);
      this.startWatchdogHandle = -1;
    }
  }

  /** speak() was accepted but the engine never called onStart: hard error. */
  private async onStartCallbackTimeout(token: ReaderTtsUtteranceToken): Promise<void> {
    if (this.awaitingStartToken !== token) return;
    this.logTtsEvent('startCallbackTimeout', `requestId=${token.requestId}`);
    this.awaitingStartToken = undefined;
    const correlated = this.utterances.get(token.requestId);
    if (correlated !== undefined) {
      this.removeUtteranceCorrelation(token.requestId);
      try {
        await this.reportCorrelatedCallback(correlated, token.requestId, 'error', 'failed');
      } catch (error) {
        this.logTtsEvent('startCallbackTimeout.report', errorMessageOf(error));
      }
    }
    if (!this.isUtteranceCurrent(token)) return;
    await this.terminateToError('语音引擎未在规定时间内开始播放', 'startTimeout');
  }

  private async handleHostEvent(event: ReaderTtsHostEvent): Promise<void> {
    if (event.type === 'mediaControl' || event.type === 'interruption' || event.type === 'deviceChange') {
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
    try {
      if (event.type === 'start') {
        const result = await this.reportCorrelatedCallback(correlated, event.requestId, 'start', 'speaking');
        if (active !== undefined && result.callbackDisposition === 'applied' &&
          this.isUtteranceCurrent(token)) {
          this.clearStartWatchdog();
          this.awaitingStartToken = undefined;
          this.startConfirmedRequestId = event.requestId;
          this.applyCoreSnapshot(result.snapshot);
          this.setState({ ...this.state, status: 'playing', consecutiveFailures: 0, audioStarted: true });
          this.resolveStartWaiters(true);
        }
        return;
      }
      if (event.type === 'complete') {
        if (event.completion !== 'audio') return;
        const result = await this.reportCorrelatedCallback(correlated, event.requestId, 'done', 'done');
        if (active === undefined || result.callbackDisposition !== 'applied' ||
          !this.isCorrelatedSessionCurrent(correlated)) return;
        // Keep only a bounded late-callback window.  The first completion is
        // still present while its progress/next-slice work runs, so a
        // duplicate event queued by the Host can reach Core exactly as before.
        this.retainUtteranceCorrelation(event.requestId);
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
          await this.handleSessionUtteranceFailure(active, token, event.message);
        }
      }
    } catch (error) {
      const detail = errorMessageOf(error);
      this.logTtsEvent(`callback.${event.type}`, detail);
      if (event.type === 'stop') return;
      // A failed callback must never leave a ghost `playing`/`preparing` state:
      // stop the current utterance and land in a retryable error.
      if (this.active !== undefined && this.utterances.has(event.requestId)) {
        await this.terminateToError(
          `朗读回调处理失败：${detail}`,
          this.state.audioStarted ? 'utteranceFailed' : 'startFailed',
        );
      }
      return;
    }
    // `stop` is an acknowledgement only. Pause/skip/stop intents already
    // invalidated this request before asking the engine to stop.
  }

  private async pauseForSystem(reason: 'systemInterruption' | 'deviceChange'): Promise<void> {
    this.desiredPlaying = false;
    const active = this.active;
    if (active === undefined || !this.canPause()) return;
    this.invalidateUtterance(reason);
    this.setState({
      ...this.state,
      status: 'interrupted',
      requestId: undefined,
      pauseReason: reason,
    });
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      const hostStopError = await hostStopTask;
      if (hostStopError !== undefined) throw hostStopError;
      if (this.isSessionCurrent(active.identity) && active.plan !== undefined) {
        const snapshot = await this.gateway.pause(active.input.chapter);
        this.applyCoreSnapshot(snapshot, undefined, reason);
      }
      await this.host.deactivateAudioSession();
      this.transport = { ...this.transport, audioSession: 'inactive', focus: 'interrupted' };
    });
  }

  private async handleUtteranceFailure(
    active: ActiveSession,
    token: ReaderTtsUtteranceToken,
    message: string,
  ): Promise<void> {
    const correlated = this.utterances.get(token.requestId);
    if (correlated === undefined) return;
    const result = await this.reportCorrelatedCallback(correlated, token.requestId, 'error', 'failed');
    if (result.callbackDisposition === 'applied') this.removeUtteranceCorrelation(token.requestId);
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
      const detail = errorMessageOf(error);
      this.logTtsEvent('chapter.advance', detail);
      await this.terminateToError(`章节推进失败：${detail}`, 'utteranceFailed');
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

  private async stopAfterCoreFailure(
    snapshot: ReaderTtsQueueSnapshot,
    message: string,
  ): Promise<void> {
    this.clearTimer();
    this.clearStartWatchdog();
    this.awaitingStartToken = undefined;
    this.active = undefined;
    this.startConfirmedRequestId = undefined;
    await this.host.stop();
    await this.host.deactivateAudioSession();
    this.transport = { ...this.transport, audioSession: 'inactive', focus: 'none', currentRequestId: undefined };
    this.setState({
      ...this.state,
      status: 'error',
      requestId: undefined,
      audioStarted: false,
      consecutiveFailures: snapshot.consecutiveFailures,
      stopReason: snapshot.consecutiveFailures >= snapshot.failureLimit ? 'failureLimit' : 'utteranceFailed',
      errorMessage: message.length > 0 ? message : 'Harmony system TTS failed',
    });
    this.resolveStartWaiters(false);
  }

  private skipToAdjacent(direction: 'next' | 'previous'): Promise<void> {
    const active = this.active;
    if (active === undefined || active.plan === undefined) return Promise.resolve();
    this.invalidateUtterance();
    this.setState({ ...this.state, status: 'preparing', requestId: undefined, errorMessage: undefined });
    const identity = active.identity;
    const hostStopTask = this.stopHostTransportImmediately();
    return this.enqueue(async (): Promise<void> => {
      const hostStopError = await hostStopTask;
      if (hostStopError !== undefined) throw hostStopError;
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

  /** Drop all callback correlation state when a session/lifecycle ends. */
  private clearUtteranceCorrelations(): void {
    this.utterances.clear();
    this.retainedUtteranceIds.clear();
    this.retainedUtteranceOrder.splice(0, this.retainedUtteranceOrder.length);
  }

  /**
   * Retain one retired request long enough for a late/duplicate Host event to
   * be reported to Core, while bounding the process-lifetime footprint for
   * long books.  The oldest retired IDs are evicted first; the current active
   * request is not retired until an intent invalidates it.
   */
  private retainUtteranceCorrelation(requestId: string): void {
    if (!this.utterances.has(requestId)) return;
    if (this.retainedUtteranceIds.has(requestId)) return;
    this.retainedUtteranceIds.add(requestId);
    this.retainedUtteranceOrder.push(requestId);
    while (this.retainedUtteranceOrder.length > MAX_RETAINED_COMPLETED_UTTERANCES) {
      const evicted = this.retainedUtteranceOrder.shift();
      if (evicted === undefined) return;
      this.retainedUtteranceIds.delete(evicted);
      this.utterances.delete(evicted);
    }
  }

  /** Remove one correlation and its recency marker, if present. */
  private removeUtteranceCorrelation(requestId: string): void {
    this.utterances.delete(requestId);
    if (!this.retainedUtteranceIds.delete(requestId)) return;
    const index = this.retainedUtteranceOrder.indexOf(requestId);
    if (index >= 0) this.retainedUtteranceOrder.splice(index, 1);
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
    // Core snapshots may claim `playing` before the engine's real onStart
    // callback arrived; only a confirmed start may surface as `playing`.
    const startConfirmed = this.startConfirmedRequestId !== undefined &&
      this.startConfirmedRequestId === this.transport.currentRequestId;
    const currentRequestStillValid = snapshot.currentSliceIndex === this.state.sliceIndex &&
      snapshot.state === 'playing' && this.transport.currentRequestId === this.state.requestId;
    const status = snapshot.state === 'playing' ?
      (startConfirmed ? 'playing' : 'preparing') :
      snapshot.state === 'paused' && pauseReason !== undefined && pauseReason !== 'user' ? 'interrupted' :
        snapshot.state === 'paused' ? 'paused' :
        snapshot.state === 'completed' ? 'completed' :
          snapshot.state === 'stopped' && errorMessage !== undefined ? 'error' : 'idle';
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
    const published = snapshot.state === 'playing' ? (status === 'playing' ? 'playing' : 'preparing') :
      snapshot.state === 'paused' ? 'paused' :
        snapshot.state === 'completed' ? 'completed' :
          snapshot.state === 'stopped' && errorMessage !== undefined ? 'error' : 'stopped';
    this.host.publishPlaybackState(published);
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
    const currentRequestId = this.transport.currentRequestId;
    if (currentRequestId !== undefined) {
      // A stop/seek/rate/voice intent retires the current request even when
      // its Host callback never arrives.  Keep it in the same bounded late
      // callback window so repeated interruptions cannot grow the map.
      this.retainUtteranceCorrelation(currentRequestId);
    }
    if (currentRequestId === undefined && interruption === undefined) return;
    this.clearStartWatchdog();
    this.awaitingStartToken = undefined;
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
    this.operationTail = task.catch((error: unknown): void => {
      // The tail only logs: every operation owns its own state transitions, so
      // a rejection here must never silently vanish nor fake a playing state.
      this.logTtsEvent('operation.rejected', errorMessageOf(error));
    });
    return task;
  }

  private voidLogged(promise: Promise<void>, stage: string): void {
    void promise.catch((error: unknown): void => {
      this.logTtsEvent(stage, errorMessageOf(error));
    });
  }

  private logTtsEvent(stage: string, detail: string): void {
    console.error(`[ReaderTTS] stage=${stage} code=${diagnosticCodeOf(detail)}`);
  }

  private resolveStartWaiters(started: boolean): void {
    const waiters = this.startWaiters.splice(0, this.startWaiters.length);
    for (const waiter of waiters) {
      waiter.resolve(started);
    }
  }

  private stopHostTransportImmediately(): Promise<Error | undefined> {
    return this.host.stop().then(
      (): Error | undefined => undefined,
      (error: Error): Error => error,
    );
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
    if (input.language !== undefined && input.language.trim().length === 0) {
      throw new Error('Reader TTS start requires a non-blank language');
    }
    if (input.person !== undefined && (!Number.isSafeInteger(input.person) || input.person < 0)) {
      throw new Error('Reader TTS start requires a non-negative voice person');
    }
  }
}
