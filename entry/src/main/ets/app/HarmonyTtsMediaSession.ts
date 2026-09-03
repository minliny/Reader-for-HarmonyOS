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
  private startup: Promise<avSession.AVSession> | undefined = undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private closed: boolean = false;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void {
    this.listener = listener;
  }

  async activate(): Promise<void> {
    const session = await this.ensureSession();
    await session.activate();
  }

  publish(state: ReaderTtsPublishedPlaybackState): void {
    if (this.closed) return;
    this.enqueue(async (): Promise<void> => {
      const session = await this.ensureSession();
      await session.setAVPlaybackState({ state: this.toAvState(state) });
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.listener = undefined;
    try {
      await this.operationTail;
    } catch (_) {
      // The session is still destroyed below after a failed status publish.
    }
    const session = this.session;
    this.session = undefined;
    if (session === undefined) return;
    session.off('play');
    session.off('pause');
    session.off('stop');
    session.off('playNext');
    session.off('playPrevious');
    try {
      await session.deactivate();
    } catch (_) {
      // Destroy is authoritative during process teardown.
    }
    await session.destroy();
  }

  private async ensureSession(): Promise<avSession.AVSession> {
    if (this.closed) throw new Error('Reader TTS AVSession is closed');
    if (this.session !== undefined) return this.session;
    if (this.startup !== undefined) return this.startup;
    this.startup = this.createSession();
    try {
      return await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  private async createSession(): Promise<avSession.AVSession> {
    const session = await avSession.createAVSession(this.context, 'ReaderTts', 'audio');
    session.on('play', (): void => this.emit('play'));
    session.on('pause', (): void => this.emit('pause'));
    session.on('stop', (): void => this.emit('stop'));
    session.on('playNext', (): void => this.emit('next'));
    session.on('playPrevious', (): void => this.emit('previous'));
    if (this.closed) {
      await session.destroy();
      throw new Error('Reader TTS AVSession closed during initialization');
    }
    this.session = session;
    return session;
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

  private enqueue(operation: () => Promise<void>): void {
    const task = this.operationTail.then(operation, operation);
    this.operationTail = task.catch((error: Error): void => {
      hilog.error(LOG_DOMAIN, 'Reader', 'TTS AVSession update failed: %{public}s', error.message);
    });
  }
}
