import { audio } from '@kit.AudioKit';
import { media } from '@kit.MediaKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from './ErrorMessage.ts';
import http from '@ohos.net.http';
import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator';
import {
  ReaderHttpTtsGateway,
  type ReaderHttpTtsRuntime,
} from '../features/reading/ReaderHttpTtsGateway';

const LOG_DOMAIN = 0x5244;
const HTTP_TTS_ENGINE_PREFIX = 'http-tts:';
const HTTP_TTS_CONNECT_TIMEOUT_MS = 15000;
const HTTP_TTS_READ_TIMEOUT_MS = 30000;
const HTTP_TTS_MAX_REDIRECTS = 10;
const HTTP_TTS_MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/** Host-only network/audio transport for a Core-owned HttpTTS descriptor. */
export class HarmonyHttpTtsHost implements ReaderTtsHost {
  private readonly gateway: ReaderHttpTtsGateway;
  private readonly audioSessionManager: audio.AudioSessionManager;
  private readonly audioSessionDeactivatedCallback: (event: audio.AudioSessionDeactivatedEvent) => void;
  private readonly audioSessionStateChangedCallback: (event: audio.AudioSessionStateChangedEvent) => void;
  private readonly outputDeviceChangedCallback: (event: audio.CurrentOutputDeviceChangedEvent) => void;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private player: media.AVPlayer | undefined = undefined;
  private activeRequest: http.HttpRequest | null = null;
  private rejectActiveRequest: ((reason?: Error) => void) | undefined = undefined;
  private configId: number | undefined = undefined;
  private currentRequestId: string | undefined = undefined;
  private audioBytes: Uint8Array | undefined = undefined;
  private speakGeneration: number = 0;
  private startReported: boolean = false;
  private audioListenersInstalled: boolean = false;
  private audioSessionActive: boolean = false;
  private closed: boolean = false;

  constructor(runtime: ReaderHttpTtsRuntime) {
    this.gateway = new ReaderHttpTtsGateway(runtime);
    this.audioSessionManager = audio.getAudioManager().getSessionManager();
    this.audioSessionDeactivatedCallback = (_event: audio.AudioSessionDeactivatedEvent): void => {
      this.emit({ type: 'interruption', action: 'stop' });
    };
    this.audioSessionStateChangedCallback = (event: audio.AudioSessionStateChangedEvent): void => {
      this.handleAudioStateHint(event.stateChangeHint);
    };
    this.outputDeviceChangedCallback = (event: audio.CurrentOutputDeviceChangedEvent): void => {
      const action = event.recommendedAction ===
        audio.OutputDeviceChangeRecommendedAction.DEVICE_CHANGE_RECOMMEND_TO_STOP ? 'stop' : 'continue';
      this.emit({ type: 'deviceChange', action });
    };
  }

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined): void {
    this.listener = listener;
  }

  async selectEngine(engine?: string): Promise<boolean> {
    if (engine === undefined || !engine.startsWith(HTTP_TTS_ENGINE_PREFIX)) return false;
    const idText = engine.slice(HTTP_TTS_ENGINE_PREFIX.length);
    const id = Number(idText);
    if (!Number.isSafeInteger(id) || id < 0 || `${id}` !== idText) {
      this.configId = undefined;
      return false;
    }
    this.configId = id;
    return true;
  }

  async isAvailable(): Promise<boolean> {
    if (this.closed || this.configId === undefined) return false;
    try {
      return await this.gateway.get(this.configId) !== undefined;
    } catch (error) {
      this.logError('HttpTTS config probe failed', error);
      return false;
    }
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    this.installAudioListeners();
    if (this.audioSessionActive) return;
    this.audioSessionManager.setAudioSessionScene(audio.AudioSessionScene.AUDIO_SESSION_SCENE_MEDIA);
    const concurrencyMode = allowMixing
      ? audio.AudioConcurrencyMode.CONCURRENCY_MIX_WITH_OTHERS
      : audio.AudioConcurrencyMode.CONCURRENCY_PAUSE_OTHERS;
    await this.audioSessionManager.activateAudioSession({ concurrencyMode });
    this.audioSessionActive = true;
  }

  async deactivateAudioSession(): Promise<void> {
    if (!this.audioSessionActive) return;
    try {
      await this.audioSessionManager.deactivateAudioSession();
    } finally {
      this.audioSessionActive = false;
    }
  }

  async speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    this.assertOpen();
    const generation = ++this.speakGeneration;
    this.cancelActiveRequest('Reader HttpTTS audio request superseded');
    const configId = this.configId;
    if (configId === undefined) throw new Error('Reader HttpTTS has no selected Core config');
    if (request.requestId.trim().length === 0 || request.text.trim().length === 0) {
      throw new Error('Reader HttpTTS requires requestId and text');
    }
    const descriptor = await this.gateway.buildRequest(configId, request.text);
    if (this.closed || generation !== this.speakGeneration) return;
    if (descriptor.body !== undefined) {
      throw new Error('Reader HttpTTS Host does not accept a body for a GET descriptor');
    }
    const bytes = await this.fetchAudio(descriptor.url, descriptor.headers);
    if (this.closed || generation !== this.speakGeneration) return;
    await this.releasePlayer();
    if (this.closed || generation !== this.speakGeneration) return;
    const player = await media.createAVPlayer();
    this.player = player;
    this.currentRequestId = request.requestId;
    this.startReported = false;
    player.on('stateChange', (state: media.AVPlayerState): void => {
      this.handlePlayerState(player, request.requestId, state);
    });
    player.on('error', (error: Error): void => {
      if (this.player !== player || this.currentRequestId !== request.requestId) return;
      this.emit({ type: 'error', requestId: request.requestId, message: error.message });
    });
    try {
      this.audioBytes = bytes;
      player.dataSrc = this.createDataSource(bytes);
      if (this.player !== player || this.currentRequestId !== request.requestId ||
        generation !== this.speakGeneration) return;
      player.audioRendererInfo = {
        usage: audio.StreamUsage.STREAM_USAGE_AUDIOBOOK,
        rendererFlags: 0,
      };
      await player.prepare();
      if (this.player !== player || this.currentRequestId !== request.requestId) return;
      await player.play();
    } catch (error) {
      if (this.player === player && this.currentRequestId === request.requestId) {
        await this.releasePlayer();
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.speakGeneration += 1;
    this.cancelActiveRequest('Reader HttpTTS audio request stopped');
    this.currentRequestId = undefined;
    this.startReported = false;
    await this.releasePlayer();
  }

  publishPlaybackState(_state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'): void {}

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.speakGeneration += 1;
    this.cancelActiveRequest('Reader HttpTTS audio request closed');
    this.listener = undefined;
    this.currentRequestId = undefined;
    await this.releasePlayer();
    try {
      await this.deactivateAudioSession();
    } catch (error) {
      this.logError('HttpTTS audio session teardown failed', error);
    }
    this.removeAudioListeners();
  }

  private handlePlayerState(player: media.AVPlayer, requestId: string, state: media.AVPlayerState): void {
    if (this.player !== player || this.currentRequestId !== requestId) return;
    if (state === 'playing' && !this.startReported) {
      this.startReported = true;
      this.emit({ type: 'start', requestId });
    } else if (state === 'completed') {
      this.emit({ type: 'complete', requestId, completion: 'audio' });
    } else if (state === 'error') {
      this.emit({ type: 'error', requestId, message: 'Reader HttpTTS AVPlayer entered error state' });
    }
  }

  private async releasePlayer(): Promise<void> {
    const player = this.player;
    this.player = undefined;
    if (player === undefined) {
      this.audioBytes = undefined;
      return;
    }
    try {
      if (player.state === 'playing' || player.state === 'paused' || player.state === 'prepared' ||
        player.state === 'completed') {
        await player.stop();
      }
    } catch (_) {
      // Release remains mandatory even when the state changed concurrently.
    }
    try {
      await player.release();
    } catch (error) {
      this.logError('HttpTTS AVPlayer release failed', error);
    } finally {
      this.audioBytes = undefined;
    }
  }

  private async fetchAudio(url: string, headers: Record<string, string>): Promise<Uint8Array> {
    const request = http.createHttp();
    let rejectCancellation: (reason?: Error) => void = (): void => undefined;
    const cancellation = new Promise<http.HttpResponse>((
      _resolve: (value: http.HttpResponse) => void,
      reject: (reason?: Error) => void,
    ): void => {
      rejectCancellation = reject;
    });
    this.activeRequest = request;
    this.rejectActiveRequest = rejectCancellation;
    try {
      const response = await Promise.race([
        request.request(url, {
          method: http.RequestMethod.GET,
          header: headers,
          expectDataType: http.HttpDataType.ARRAY_BUFFER,
          usingCache: false,
          connectTimeout: HTTP_TTS_CONNECT_TIMEOUT_MS,
          readTimeout: HTTP_TTS_READ_TIMEOUT_MS,
          maxRedirects: HTTP_TTS_MAX_REDIRECTS,
        }),
        cancellation,
      ]);
      if (response.responseCode < 200 || response.responseCode >= 300) {
        throw new Error(`Reader HttpTTS audio request failed with HTTP ${response.responseCode}`);
      }
      if (!(response.result instanceof ArrayBuffer)) {
        throw new Error('Reader HttpTTS audio response must be binary');
      }
      const bytes = new Uint8Array(response.result);
      if (bytes.length === 0 || bytes.length > HTTP_TTS_MAX_AUDIO_BYTES) {
        throw new Error(`Reader HttpTTS audio response size ${bytes.length} is outside the allowed range`);
      }
      return bytes;
    } finally {
      if (this.activeRequest === request) {
        this.activeRequest = null;
        this.rejectActiveRequest = undefined;
      }
      try {
        request.destroy();
      } catch (_) {
        // stop() may already be destroying this request; generation remains authoritative.
      }
    }
  }

  private cancelActiveRequest(message: string): void {
    const request = this.activeRequest;
    const reject = this.rejectActiveRequest;
    this.activeRequest = null;
    this.rejectActiveRequest = undefined;
    if (request !== null) {
      try {
        request.destroy();
      } catch (_) {
        // A concurrent fetch cleanup may already own destroy().
      }
    }
    if (reject !== undefined) reject(new Error(message));
  }

  private createDataSource(bytes: Uint8Array): media.AVDataSrcDescriptor {
    let sequentialPosition = 0;
    return {
      fileSize: bytes.length,
      callback: (buffer: ArrayBuffer, length: number, pos?: number): number => {
        const start = pos === undefined ? sequentialPosition : pos;
        if (!Number.isSafeInteger(start) || start < 0) return -2;
        if (start >= bytes.length) return -1;
        const target = new Uint8Array(buffer);
        const count = Math.min(length, target.length, bytes.length - start);
        if (count <= 0) return -2;
        target.set(bytes.subarray(start, start + count), 0);
        sequentialPosition = start + count;
        return count;
      },
    };
  }

  private emit(event: ReaderTtsHostEvent): void {
    if (!this.closed) this.listener?.(event);
  }

  private installAudioListeners(): void {
    if (this.audioListenersInstalled) return;
    this.audioSessionManager.on('audioSessionDeactivated', this.audioSessionDeactivatedCallback);
    this.audioSessionManager.on('audioSessionStateChanged', this.audioSessionStateChangedCallback);
    this.audioSessionManager.on('currentOutputDeviceChanged', this.outputDeviceChangedCallback);
    this.audioListenersInstalled = true;
  }

  private removeAudioListeners(): void {
    if (!this.audioListenersInstalled) return;
    this.audioSessionManager.off('audioSessionDeactivated', this.audioSessionDeactivatedCallback);
    this.audioSessionManager.off('audioSessionStateChanged', this.audioSessionStateChangedCallback);
    this.audioSessionManager.off('currentOutputDeviceChanged', this.outputDeviceChangedCallback);
    this.audioListenersInstalled = false;
  }

  private handleAudioStateHint(hint: audio.AudioSessionStateChangeHint): void {
    if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_RESUME) {
      this.emit({ type: 'interruption', action: 'resume' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_PAUSE) {
      this.emit({ type: 'interruption', action: 'pause' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_STOP ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_TIME_OUT_STOP) {
      this.emit({ type: 'interruption', action: 'stop' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_DUCK ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_MUTE_SUGGESTION) {
      this.emit({ type: 'interruption', action: 'duck' });
    } else if (hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_UNDUCK ||
      hint === audio.AudioSessionStateChangeHint.AUDIO_SESSION_STATE_CHANGE_HINT_UNMUTE_SUGGESTION) {
      this.emit({ type: 'interruption', action: 'unduck' });
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Reader HttpTTS Host is closed');
  }

  private logError(message: string, error: Object): void {
    const detail = errorMessageOf(error);
    hilog.error(LOG_DOMAIN, 'Reader', '%{public}s: %{public}s', message, detail);
  }
}
