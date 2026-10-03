import common from '@ohos.app.ability.common';
import { avSession } from '@kit.AVSessionKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { type ReaderTtsHostEvent } from '../features/reading/ReaderTtsSessionCoordinator';

const LOG_DOMAIN = 0x5244;

export type ReaderTtsPublishedPlaybackState =
  'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error';

export interface ReaderTtsMediaSessionBridge {
  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void;
  activate(): Promise<void>;
  publish(state: ReaderTtsPublishedPlaybackState): void;
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
  // Retain exact unreleased native identities across a rebuilt runtime.
  // This is AVSession-specific retirement, never a business task/error bus.
  private static retiring: HarmonyTtsMediaSession[] = [];
  private static released: WeakSet<avSession.AVSession> = new WeakSet<avSession.AVSession>();
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
      const session = await this.ensureSession();
      if (this.closed) throw new Error('Reader TTS AVSession admission retired');
      await session.activate();
      if (!this.closed && this.session === session) this.active = true;
    });
    this.observe(task);
    await task;
  }

  isActive(): boolean { return this.active && !this.closed; }

  publish(state: ReaderTtsPublishedPlaybackState): void {
    if (this.closed) return;
    const task = this.operationTail.then(async (): Promise<void> => {
      if (this.closed) return;
      const session = await this.ensureSession();
      if (this.closed) return;
      await session.setAVPlaybackState({ state: this.toAvState(state) });
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
    if (this.closed) throw new Error('Reader TTS AVSession closed during initialization');
    try {
      session.on('play', (): void => this.emit('play'));
      session.on('pause', (): void => this.emit('pause'));
      session.on('stop', (): void => this.emit('stop'));
      session.on('playNext', (): void => this.emit('next'));
      session.on('playPrevious', (): void => this.emit('previous'));
      this.initialized = true;
      return session;
    } catch (error) {
      await HarmonyTtsMediaSession.release(session);
      if (this.session === session) this.session = undefined;
      throw error;
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
      try { await session.deactivate(); } catch (_) { /* Destroy supplies the authoritative receipt. */ }
      try {
        await session.destroy();
        HarmonyTtsMediaSession.released.add(session);
      } catch (error) {
        // The retired owner retains this exact identity until destroy succeeds.
        throw error;
      }
    });
    HarmonyTtsMediaSession.releaseTail = task.catch((): void => {});
    return task;
  }

  private emit(action: 'play' | 'pause' | 'stop' | 'next' | 'previous'): void {
    if (!this.closed) this.listener?.({ type: 'mediaControl', action });
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
    this.operationTail = task.catch((error: Error): void => {
      hilog.error(LOG_DOMAIN, 'Reader', 'TTS AVSession operation failed: %{private}s', error.message);
    });
  }
}
