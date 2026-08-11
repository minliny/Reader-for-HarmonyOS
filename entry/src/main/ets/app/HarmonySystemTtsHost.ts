import { textToSpeech } from '@kit.CoreSpeechKit';
import { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator';

const LOG_DOMAIN = 0x5244;
const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_PERSON = 0;
const OFFLINE_ENGINE = 1;
const SYNTHESIS_COMPLETE = 0;
const SPEECH_COMPLETE = 1;

class EngineSpeakListener implements textToSpeech.SpeakListener {
  private readonly deliver: (event: ReaderTtsHostEvent) => void;

  constructor(deliver: (event: ReaderTtsHostEvent) => void) {
    this.deliver = deliver;
  }

  onStart(requestId: string, _response: textToSpeech.StartResponse): void {
    this.deliver({ type: 'start', requestId });
  }

  onComplete(requestId: string, response: textToSpeech.CompleteResponse): void {
    if (response.type === SPEECH_COMPLETE) {
      this.deliver({ type: 'complete', requestId, completion: 'audio' });
      return;
    }
    if (response.type === SYNTHESIS_COMPLETE) {
      this.deliver({ type: 'complete', requestId, completion: 'synthesis' });
    }
  }

  onStop(requestId: string, _response: textToSpeech.StopResponse): void {
    this.deliver({ type: 'stop', requestId });
  }

  onError(requestId: string, errorCode: number, errorMessage: string): void {
    const detail = errorMessage.trim().length > 0 ? errorMessage : `system TTS error ${errorCode}`;
    this.deliver({ type: 'error', requestId, message: detail });
  }
}

/**
 * Process-owned bridge to Harmony's in-app TextToSpeechEngine.
 *
 * This deliberately does not implement a Core Host capability: Core remains
 * the slice/queue source of truth while this adapter only owns platform audio.
 */
export class HarmonySystemTtsHost implements ReaderTtsHost {
  private readonly audioSessionManager: audio.AudioSessionManager;
  private readonly audioSessionDeactivatedCallback: (event: audio.AudioSessionDeactivatedEvent) => void;
  private readonly audioSessionStateChangedCallback: (event: audio.AudioSessionStateChangedEvent) => void;
  private readonly outputDeviceChangedCallback: (event: audio.CurrentOutputDeviceChangedEvent) => void;
  private engine: textToSpeech.TextToSpeechEngine | undefined = undefined;
  private engineLanguage: string | undefined = undefined;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private currentRequestId: string | undefined = undefined;
  private audioListenersInstalled: boolean = false;
  private audioSessionActive: boolean = false;
  private closed: boolean = false;

  constructor() {
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
    return engine === undefined || !engine.startsWith('http-tts:');
  }

  async isAvailable(): Promise<boolean> {
    if (this.closed) return false;
    try {
      await this.ensureEngine(DEFAULT_LANGUAGE);
      return true;
    } catch (error) {
      this.logError('system TTS engine unavailable', error);
      return false;
    }
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    this.installAudioListeners();
    if (!this.audioSessionActive) {
      this.audioSessionManager.setAudioSessionScene(audio.AudioSessionScene.AUDIO_SESSION_SCENE_MEDIA);
      const concurrencyMode = allowMixing
        ? audio.AudioConcurrencyMode.CONCURRENCY_MIX_WITH_OTHERS
        : audio.AudioConcurrencyMode.CONCURRENCY_PAUSE_OTHERS;
      await this.audioSessionManager.activateAudioSession({ concurrencyMode });
      this.audioSessionActive = true;
    }
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
    this.assertSpeakRequest(request);
    const engine = await this.ensureEngine(request.language);
    this.currentRequestId = request.requestId;
    const params: textToSpeech.SpeakParams = {
      requestId: request.requestId,
      extraParams: {
        'queueMode': 0,
        'speed': request.rate,
        'pitch': request.pitch,
        'languageContext': request.language,
        'audioType': 'pcm',
        'soundChannel': 3,
        'playType': 1,
      },
    };
    try {
      engine.speak(request.text, params);
    } catch (error) {
      if (this.currentRequestId === request.requestId) this.currentRequestId = undefined;
      throw error;
    }
  }

  async stop(): Promise<void> {
    const engine = this.engine;
    this.currentRequestId = undefined;
    if (engine === undefined) return;
    try {
      engine.stop();
    } catch (error) {
      this.logError('system TTS stop failed', error);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.currentRequestId = undefined;
    this.listener = undefined;
    const engine = this.engine;
    this.engine = undefined;
    this.engineLanguage = undefined;
    if (engine !== undefined) {
      try {
        engine.stop();
      } catch (_) {
        // Best effort: shutdown below still releases the platform object.
      }
      try {
        engine.shutdown();
      } catch (error) {
        this.logError('system TTS shutdown failed', error);
      }
    }
    try {
      await this.deactivateAudioSession();
    } catch (error) {
      this.logError('audio session deactivation failed during teardown', error);
    }
    this.removeAudioListeners();
  }

  private async ensureEngine(language: string): Promise<textToSpeech.TextToSpeechEngine> {
    this.assertOpen();
    if (this.engine !== undefined && this.engineLanguage === language) return this.engine;
    const previous = this.engine;
    this.engine = undefined;
    this.engineLanguage = undefined;
    this.currentRequestId = undefined;
    if (previous !== undefined) {
      try {
        previous.stop();
      } catch (_) {
        // Replacing the engine is still safe when stop has already completed.
      }
      previous.shutdown();
    }
    const engine = await textToSpeech.createEngine({
      language,
      person: DEFAULT_PERSON,
      online: OFFLINE_ENGINE,
      extraParams: {
        'style': 'interaction-broadcast',
        'locate': 'CN',
        'name': 'ReaderInAppTts',
      },
    });
    engine.setListener(new EngineSpeakListener((event: ReaderTtsHostEvent): void => this.emit(event)));
    if (this.closed) {
      engine.shutdown();
      throw new Error('Reader system TTS Host closed during engine initialization');
    }
    this.engine = engine;
    this.engineLanguage = language;
    return engine;
  }

  private emit(event: ReaderTtsHostEvent): void {
    if (this.closed) return;
    if ((event.type === 'start' || event.type === 'complete' || event.type === 'stop' || event.type === 'error') &&
      event.requestId !== this.currentRequestId) return;
    this.listener?.(event);
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

  private assertSpeakRequest(request: ReaderTtsHostSpeakRequest): void {
    this.assertOpen();
    if (request.requestId.trim().length === 0 || request.text.trim().length === 0 ||
      request.language.trim().length === 0) {
      throw new Error('Reader system TTS requires requestId, text, and language');
    }
    if (!Number.isFinite(request.rate) || request.rate <= 0 ||
      !Number.isFinite(request.pitch) || request.pitch <= 0) {
      throw new Error('Reader system TTS requires positive finite rate and pitch');
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Reader system TTS Host is closed');
  }

  private logError(message: string, error: Object): void {
    const detail = error instanceof Error ? error.message : `${error}`;
    hilog.error(LOG_DOMAIN, 'Reader', '%{public}s: %{public}s', message, detail);
  }
}
