import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostProbe,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator.ts';
import type { ReaderTtsVoiceOption } from '../features/reading/ReaderTtsPreferencesState';
import { ReaderStartupTrace } from './ReaderStartupTrace.ts';
import type {
  ReaderTtsMediaSessionBridge,
  ReaderTtsPublishedPlaybackState,
} from './HarmonyTtsMediaSession.ts';

export interface ReaderTtsClosableHost extends ReaderTtsHost {
  close(): Promise<void>;
}

export interface ReaderTtsSystemHost extends ReaderTtsClosableHost {
  listVoices(): Promise<ReaderTtsVoiceOption[]>;
}

export interface ReaderTtsBackgroundSessionBridge {
  activate(): Promise<boolean>;
  deactivate(): Promise<void>;
  isActive(): boolean;
  setRevocationListener?(listener: (() => void) | undefined): void;
  close(): Promise<void>;
}

/** Chooses one Host transport from the Core-persisted `tts.config.engine`. */
export class HarmonyTtsHostRouter implements ReaderTtsHost {
  private readonly system: ReaderTtsSystemHost;
  private readonly http: ReaderTtsClosableHost;
  private active: ReaderTtsHost;
  private readonly mediaSession: ReaderTtsMediaSessionBridge;
  private readonly backgroundSession: ReaderTtsBackgroundSessionBridge | undefined;
  private backgroundPlaybackEnabled: boolean = true;
  private foregroundSessionActive: boolean = false;
  private foregroundActivation: Promise<void> | undefined = undefined;
  private mediaActivationAttempted: boolean = false;
  private backgroundActivationAttempted: boolean = false;
  private mediaActivation: Promise<void> | undefined = undefined;
  private backgroundActivation: Promise<void> | undefined = undefined;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private listenerOwner: string | undefined = undefined;
  private closed: boolean = false;
  private audioGeneration: number = 0;
  private selectionGeneration: number = 0;
  private backgroundPreferenceGeneration: number = 0;
  private closeTask: Promise<void> | undefined = undefined;
  private traceOperationId: number | undefined = undefined;
  private traceRequest: { requestId: string; owner: string | undefined;
    source: ReaderTtsHost; selectionGeneration: number; audioGeneration: number } | undefined = undefined;

  constructor(
    system: ReaderTtsSystemHost,
    http: ReaderTtsClosableHost,
    mediaSession: ReaderTtsMediaSessionBridge,
    backgroundSession?: ReaderTtsBackgroundSessionBridge,
    isForeground: () => boolean = (): boolean => true,
  ) {
    this.system = system;
    this.http = http;
    this.active = system;
    this.mediaSession = mediaSession;
    this.backgroundSession = backgroundSession;
    this.backgroundSession?.setRevocationListener?.((): void => {
      if (!this.closed && this.foregroundSessionActive && this.backgroundPlaybackEnabled && !isForeground()) {
        this.markTrace('tts.background-revoke');
        this.listener?.({ type: 'backgroundLeaseRevoked' });
      }
    });
    this.system.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.system, event), 'router');
    this.http.setEventListener((event: ReaderTtsHostEvent): void => this.forward(this.http, event), 'router');
    this.mediaSession.setEventListener((event: ReaderTtsHostEvent): void => {
      if (!this.closed) this.listener?.(event);
    });
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined, owner: string): void {
    if (this.closed) return;
    if (this.listenerOwner !== undefined && this.listenerOwner !== owner) {
      this.markTrace('tts.owner-revoke');
      this.traceRequest = undefined;
      this.traceOperationId = undefined;
    }
    this.listener = listener;
    this.listenerOwner = owner;
  }

  clearEventListener(owner: string): void {
    if (this.listenerOwner !== owner) return;
    this.markTrace('tts.listener-release');
    this.traceRequest = undefined;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }

  async selectEngine(engine?: string): Promise<boolean> {
    this.assertOpen();
    this.traceRequest = undefined;
    const generation = ++this.selectionGeneration;
    const target = engine?.startsWith('http-tts:') ? this.http : this.system;
    // Retire before awaiting engine selection. Releasing one transport cannot
    // release a successor's lease: the shared platform owner serializes ACKs.
    this.audioGeneration += 1;
    this.foregroundSessionActive = false;
    this.foregroundActivation = undefined;
    this.backgroundActivationAttempted = false;
    void this.active.deactivateAudioSession().catch((): void => {});
    void this.backgroundSession?.deactivate().catch((): void => {});
    const selected = await target.selectEngine(engine);
    if (this.closed || generation !== this.selectionGeneration) return false;
    this.active = target;
    return selected;
  }

  isAvailable(): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);
    return this.active.isAvailable();
  }

  probe(): Promise<ReaderTtsHostProbe> {
    if (this.closed) return Promise.resolve({ available: false, reason: '朗读服务已关闭' });
    return this.active.probe();
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    // The selected speech transport is the only mandatory foreground lease.
    // Media controls and background admission are additive platform bridges;
    // a device without either capability must still be able to speak locally.
    const transport = this.active;
    const generation = this.audioGeneration;
    const activation = transport.activateAudioSession(allowMixing);
    this.foregroundActivation = activation;
    try {
      await activation;
      if (this.closed || generation !== this.audioGeneration || transport !== this.active) {
        throw new Error('Reader TTS foreground audio admission retired');
      }
      this.foregroundSessionActive = true;
      this.activateOptionalSessions();
    } finally {
      if (this.foregroundActivation === activation) this.foregroundActivation = undefined;
    }
  }

  setBackgroundPlaybackEnabled(enabled: boolean): void {
    if (this.closed) return;
    if (enabled !== this.backgroundPlaybackEnabled) this.backgroundPreferenceGeneration += 1;
    this.backgroundPlaybackEnabled = enabled;
    if (enabled) {
      this.activateOptionalSessions();
    } else {
      this.backgroundActivationAttempted = false;
      void this.backgroundSession?.deactivate().catch((): void => {});
    }
  }

  async deactivateAudioSession(): Promise<void> {
    const operationId = this.traceOperationId;
    this.traceRequest = undefined;
    this.audioGeneration += 1;
    this.foregroundSessionActive = false;
    this.foregroundActivation = undefined;
    this.backgroundActivationAttempted = false;
    await Promise.all([
      this.active.deactivateAudioSession(),
      this.backgroundSession?.deactivate() ?? Promise.resolve(),
    ]);
    if (operationId !== undefined) ReaderStartupTrace.currentTts()?.markTts('tts.audio-release', operationId, 'ready');
  }

  isBackgroundPlaybackActive(): boolean {
    return !this.closed && this.foregroundSessionActive && this.backgroundPlaybackEnabled &&
      this.backgroundSession?.isActive() === true;
  }

  /** A quick background transition may arrive while the optional lease is
   * still being admitted. Wait only at that transition, with a finite bound. */
  async waitForBackgroundPlaybackAdmission(): Promise<boolean> {
    if (this.closed || !this.backgroundPlaybackEnabled || this.backgroundSession === undefined) return false;
    const generation = this.audioGeneration;
    const preferenceGeneration = this.backgroundPreferenceGeneration;
    if (this.isBackgroundPlaybackActive()) return true;
    let timeout = -1;
    try {
      const admission = async (): Promise<boolean> => {
        if (!this.foregroundSessionActive) {
          const foreground = this.foregroundActivation;
          if (foreground === undefined) return false;
          try { await foreground; } catch (_) { return false; }
        }
        if (this.closed || generation !== this.audioGeneration ||
          preferenceGeneration !== this.backgroundPreferenceGeneration ||
          !this.foregroundSessionActive || !this.backgroundPlaybackEnabled) return false;
        const background = this.backgroundActivation;
        if (background !== undefined) await background;
        return generation === this.audioGeneration &&
          preferenceGeneration === this.backgroundPreferenceGeneration && this.isBackgroundPlaybackActive();
      };
      return await Promise.race([admission(), new Promise<boolean>((resolve): void => {
        timeout = setTimeout((): void => resolve(false), 1500);
      })]);
    } finally {
      if (timeout >= 0) clearTimeout(timeout);
    }
  }

  speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    this.assertOpen();
    const trace = ReaderStartupTrace.currentTts();
    if (trace === undefined || request.traceOperationId === undefined) return this.active.speak(request);
    const operationId = request.traceOperationId;
    this.traceOperationId = operationId;
    this.traceRequest = { requestId: request.requestId, owner: this.listenerOwner, source: this.active,
      selectionGeneration: this.selectionGeneration, audioGeneration: this.audioGeneration };
    trace.markTts('tts.speak-dispatch', operationId);
    try {
      return this.active.speak(request).catch((error: Error): never => {
        trace.markTts('tts.speak-failure', operationId, 'failed');
        throw error;
      });
    } catch (error) {
      trace.markTts('tts.speak-failure', operationId, 'failed');
      throw error;
    }
  }

  prefetchNext(request: ReaderTtsHostSpeakRequest): void {
    if (this.closed) return;
    this.active.prefetchNext?.(request);
  }

  listSystemVoices(): Promise<ReaderTtsVoiceOption[]> {
    this.assertOpen();
    return this.system.listVoices();
  }

  stop(): Promise<void> {
    if (this.closed) return Promise.resolve();
    const trace = ReaderStartupTrace.currentTts();
    const operationId = this.traceOperationId;
    this.traceRequest = undefined;
    if (trace === undefined || operationId === undefined) return this.active.stop();
    trace.markTts('tts.host-stop', operationId);
    try {
      return this.active.stop().then((): void => trace.markTts('tts.host-stop-ack', operationId, 'ready'),
        (error: Error): never => { trace.markTts('tts.host-stop-ack', operationId, 'failed'); throw error; });
    } catch (error) {
      trace.markTts('tts.host-stop-ack', operationId, 'failed');
      throw error;
    }
  }

  publishPlaybackState(state: ReaderTtsPublishedPlaybackState): void {
    if (this.closed) return;
    this.mediaSession.publish(state);
  }

  async close(): Promise<void> {
    if (this.closeTask !== undefined) { await this.closeTask; return; }
    this.closed = true;
    const operationId = this.traceOperationId;
    this.traceRequest = undefined;
    this.audioGeneration += 1;
    this.selectionGeneration += 1;
    this.listener = undefined;
    this.listenerOwner = undefined;
    this.foregroundSessionActive = false;
    this.foregroundActivation = undefined;
    this.backgroundSession?.setRevocationListener?.(undefined);
    this.closeTask = Promise.all([
      this.system.close(),
      this.http.close(),
      this.backgroundSession?.close() ?? Promise.resolve(),
      this.mediaSession.close(),
    ]).then((): void => {});
    await this.closeTask;
    if (operationId !== undefined) ReaderStartupTrace.currentTts()?.markTts('tts.host-release', operationId, 'ready');
  }

  private forward(source: ReaderTtsHost, event: ReaderTtsHostEvent): void {
    if (this.closed || source !== this.active) return;
    const request = this.traceRequest;
    if (request !== undefined && 'requestId' in event && event.requestId === request.requestId &&
      source === request.source && request.owner === this.listenerOwner &&
      request.selectionGeneration === this.selectionGeneration && request.audioGeneration === this.audioGeneration) {
      if (event.type === 'start') this.markTrace('tts.platform-start', 'callback');
      else if (event.type === 'error') this.markTrace('tts.platform-error', 'failed');
      else if (event.type === 'stop') this.markTrace('tts.platform-stop', 'callback');
    }
    this.listener?.(event);
  }

  private markTrace(stage: string, status: string = 'event'): void {
    if (this.traceOperationId !== undefined) {
      ReaderStartupTrace.currentTts()?.markTts(stage, this.traceOperationId, status);
    }
  }

  private activateOptionalSessions(): void {
    if (this.closed || !this.foregroundSessionActive) return;
    // Neither optional platform bridge belongs on the per-slice speech path.
    // A single attempt per foreground lease also avoids repeated native calls
    // when the coordinator asks to keep the same audio focus for each slice.
    if (!this.mediaActivationAttempted) {
      this.mediaActivationAttempted = true;
      this.mediaActivation = this.mediaSession.activate().catch((): void => {});
    }
    if (this.backgroundPlaybackEnabled && this.backgroundSession !== undefined &&
      !this.backgroundActivationAttempted) {
      this.backgroundActivationAttempted = true;
      this.backgroundActivation = this.backgroundSession.activate().then((): void => {}, (): void => {});
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Reader TTS Host router is closed');
  }
}
