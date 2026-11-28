import common from '@ohos.app.ability.common';
import deviceInfo from '@ohos.deviceInfo';
import { avSession } from '@kit.AVSessionKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { type ReaderTtsHostEvent } from '../contracts/ReaderTtsHostContract';
import { isReaderTtsSupportedPlaybackRate, readerTtsSupportedPlaybackRates } from '../contracts/ReaderTtsPlaybackRates';

const LOG_DOMAIN = 0x5244;

export type ReaderTtsPublishedPlaybackState =
  'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error';

export interface ReaderTtsMediaSessionBridge {
  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  publish(state: ReaderTtsPublishedPlaybackState, rate?: number): void;
  setBackgroundPlaybackEnabled?(enabled: boolean): void;
  close(): Promise<void>;
}

/** Host-only AVSession bridge for lock-screen, headset, and background controls. */
export class HarmonyTtsMediaSession implements ReaderTtsMediaSessionBridge {
  private readonly context: common.UIAbilityContext;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private session: avSession.AVSession | undefined = undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private closed: boolean = false;
  private initialized: boolean = false;
  private active: boolean = false;
  private backgroundPlaybackEnabled: boolean = false;
  private backgroundModePublished: boolean | undefined = undefined;
  // Retain exact unreleased native identities across a rebuilt runtime.
  // This is AVSession-specific retirement, never a business task/error bus.
  private static retiring: HarmonyTtsMediaSession[] = [];
  private static released: WeakSet<avSession.AVSession> = new WeakSet<avSession.AVSession>();
  private static speedListeners: WeakMap<avSession.AVSession, (speed: number) => void> =
    new WeakMap<avSession.AVSession, (speed: number) => void>();
  private static releaseTail: Promise<void> = Promise.resolve();

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void {
    if (!this.closed) this.listener = listener;
  }

  async activate(): Promise<void> {
    if (this.closed) throw new Error('Reader TTS AVSession is closed');
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.closed) throw new Error('Reader TTS AVSession admission retired');
      if (this.active) return;
      const session = await this.ensureSession();
      if (this.closed) throw new Error('Reader TTS AVSession admission retired');
      await session.activate();
      if (!this.closed && this.session === session) this.active = true;
    });
    this.observe(task);
    await task;
  }

  async deactivate(): Promise<void> {
    if (this.closed) return;
    const task = this.operationTail.then(async (): Promise<void> => {
      const session = this.session;
      if (this.closed || !this.active || session === undefined) return;
      await session.deactivate();
      if (this.session === session) this.active = false;
    });
    this.observe(task);
    await task;
  }

  isActive(): boolean { return this.active && !this.closed; }

  publish(state: ReaderTtsPublishedPlaybackState, rate?: number): void {
    if (this.closed) return;
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.closed) return;
      // Terminal state is sent only to an existing, fully initialized session.
      if (!this.initialized && (state === 'stopped' || state === 'completed' || state === 'error')) return;
      const session = await this.ensureSession();
      if (this.closed) return;
      const playback: avSession.AVPlaybackState = { state: this.toAvState(state) };
      if (HarmonyTtsMediaSession.speedListeners.has(session) &&
        rate !== undefined && isReaderTtsSupportedPlaybackRate(rate)) playback.speed = rate;
      await session.setAVPlaybackState(playback);
    });
    this.observe(task);
  }

  setBackgroundPlaybackEnabled(enabled: boolean): void {
    if (this.closed || this.backgroundPlaybackEnabled === enabled) return;
    this.backgroundPlaybackEnabled = enabled;
    if (this.session === undefined) return;
    const task = this.operationTail.then(async (): Promise<void> => {
      if (!this.closed && this.initialized && this.session !== undefined) await this.publishBackgroundMode(this.session);
    });
    this.observe(task);
  }

  async close(): Promise<void> {
    this.closed = true; this.active = false; this.listener = undefined;
    if (HarmonyTtsMediaSession.retiring.indexOf(this) < 0) HarmonyTtsMediaSession.retiring.push(this);
    const task = this.operationTail.then(async (): Promise<void> => {
      const session = this.session;
      if (session !== undefined) {
        await HarmonyTtsMediaSession.release(session);
        if (this.session === session) { this.session = undefined; this.initialized = false; }
      }
      HarmonyTtsMediaSession.retiring = HarmonyTtsMediaSession.retiring.filter((owned): boolean => owned !== this);
    });
    this.observe(task);
    await task;
  }

  private async ensureSession(): Promise<avSession.AVSession> {
    if (this.closed) throw new Error('Reader TTS AVSession is closed');
    if (this.session !== undefined && this.initialized) return this.session;
    if (this.session !== undefined) {
      await HarmonyTtsMediaSession.release(this.session);
      this.session = undefined;
    }
    // A failed destruction stays owned. A successor retries exact retirement
    // before creating another optional platform session.
    for (const previous of HarmonyTtsMediaSession.retiring.slice()) await previous.close();
    if (this.closed) throw new Error('Reader TTS AVSession admission retired');
    const session = await avSession.createAVSession(this.context, 'ReaderTts', 'audio');
    this.session = session;
    this.backgroundModePublished = undefined;
    if (this.closed) throw new Error('Reader TTS AVSession closed during initialization');
    try {
      // AVSession requires metadata for both the lock screen and headset commands.
      // Use a stable Reader asset without exposing the current book on the lock screen.
      await session.setAVMetadata({ assetId: 'reader-tts', title: 'Reader 朗读' });
      if (this.closed) throw new Error('Reader TTS AVSession closed during initialization');
      session.on('play', (): void => this.emit(session, 'play'));
      session.on('pause', (): void => this.emit(session, 'pause'));
      session.on('stop', (): void => this.emit(session, 'stop'));
      session.on('playNext', (): void => this.emit(session, 'next'));
      session.on('playPrevious', (): void => this.emit(session, 'previous'));
      await this.publishBackgroundMode(session);
      if (!this.closed) await this.registerSpeedControl(session);
      if (this.closed) throw new Error('Reader TTS AVSession closed during initialization');
      this.initialized = true;
      return session;
    } catch (error) {
      try {
        await HarmonyTtsMediaSession.release(session);
        if (this.session === session) this.session = undefined;
      } catch (releaseError) {
        // Keep the uninitialized session for a later release attempt.
        this.logFailure('setup rollback', releaseError as Error);
      }
      throw error;
    }
  }

  private async publishBackgroundMode(session: avSession.AVSession): Promise<void> {
    const enabled = this.backgroundPlaybackEnabled;
    if (this.backgroundModePublished === enabled) return;
    try {
      if (deviceInfo.distributionOSApiVersion >= 60101) {
        await session.setBackgroundPlayMode(enabled ? avSession.BackgroundPlayMode.ENABLE_BACKGROUND_PLAY :
          avSession.BackgroundPlayMode.DISABLE_BACKGROUND_PLAY);
        this.backgroundModePublished = enabled;
      }
    } catch (error) {
      this.logFailure('background playback mode', error as Error);
    }
  }

  private async registerSpeedControl(session: avSession.AVSession): Promise<void> {
    try {
      if (deviceInfo.distributionOSApiVersion >= 260000) {
        if (deviceInfo.apiAvailable('26.0.0')) {
          await session.setSupportedPlaySpeeds(readerTtsSupportedPlaybackRates());
          if (this.closed) return;
          const listener = (rate: number): void => {
            if (this.isActive() && this.session === session && isReaderTtsSupportedPlaybackRate(rate)) {
              this.listener?.({ type: 'mediaRate', rate });
            }
          };
          session.on('setSpeed', listener);
          HarmonyTtsMediaSession.speedListeners.set(session, listener);
          await session.setMediaCenterControlType(['playPrevious', 'playNext', 'setSpeed']);
        }
      }
    } catch (error) {
      this.logFailure('media speed control', error as Error);
    }
  }

  private static release(session: avSession.AVSession): Promise<void> {
    const task = HarmonyTtsMediaSession.releaseTail.then(async (): Promise<void> => {
      if (HarmonyTtsMediaSession.released.has(session)) return;
      try { session.off('play'); } catch (_) {}
      try { session.off('pause'); } catch (_) {}
      try { session.off('stop'); } catch (_) {}
      try { session.off('playNext'); } catch (_) {}
      try { session.off('playPrevious'); } catch (_) {}
      const speedListener = HarmonyTtsMediaSession.speedListeners.get(session);
      if (speedListener !== undefined) {
        try { session.off('setSpeed', speedListener); } catch (_) {}
      }
      try { await session.deactivate(); } catch (_) { /* Destroy supplies the authoritative receipt. */ }
      // The retired owner retains this exact identity until destroy succeeds.
      await session.destroy();
      HarmonyTtsMediaSession.released.add(session);
      HarmonyTtsMediaSession.speedListeners.delete(session);
    });
    HarmonyTtsMediaSession.releaseTail = task.catch((): void => {});
    return task;
  }

  private emit(session: avSession.AVSession, action: 'play' | 'pause' | 'stop' | 'next' | 'previous'): void {
    if (this.isActive() && this.session === session) this.listener?.({ type: 'mediaControl', action });
  }

  private toAvState(state: ReaderTtsPublishedPlaybackState): avSession.PlaybackState {
    if (state === 'preparing') return avSession.PlaybackState.PLAYBACK_STATE_PREPARE;
    if (state === 'playing') return avSession.PlaybackState.PLAYBACK_STATE_PLAY;
    if (state === 'paused') return avSession.PlaybackState.PLAYBACK_STATE_PAUSE;
    if (state === 'completed') return avSession.PlaybackState.PLAYBACK_STATE_COMPLETED;
    if (state === 'error') return avSession.PlaybackState.PLAYBACK_STATE_ERROR;
    return avSession.PlaybackState.PLAYBACK_STATE_STOP;
  }

  private observe(task: Promise<void>): void {
    this.operationTail = task.catch((error: Error): void => this.logFailure('operation', error));
  }

  private logFailure(step: string, error: Error): void {
    try { hilog.error(LOG_DOMAIN, 'Reader', 'TTS AVSession %{public}s failed: %{private}s', step, error.message); }
    catch (_) { /* Keep the operation queue usable when the log sink fails. */ }
  }
}
