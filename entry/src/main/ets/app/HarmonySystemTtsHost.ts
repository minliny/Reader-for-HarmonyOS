import { textToSpeech } from '@kit.CoreSpeechKit';
import { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from './ErrorMessage.ts';
import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostProbe,
  type ReaderTtsHostSpeakRequest,
} from '../features/reading/ReaderTtsSessionCoordinator';
import {
  isReaderTtsVoiceInstalled,
  type ReaderTtsVoiceOption,
} from '../features/reading/ReaderTtsPreferencesState';

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
  private engineRequestedLanguage: string | undefined = undefined;
  private engineRequestedPerson: number | undefined = undefined;
  private engineLanguage: string | undefined = undefined;
  private enginePerson: number | undefined = undefined;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private listenerOwner: string | undefined = undefined;
  private currentRequestId: string | undefined = undefined;
  private audioListenersInstalled: boolean = false;
  private audioSessionActive: boolean = false;
  private audioSessionAllowMixing: boolean | undefined = undefined;
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

  setEventListener(listener: ((event: ReaderTtsHostEvent) => void) | undefined, owner: string): void {
    this.listener = listener;
    this.listenerOwner = owner;
  }

  clearEventListener(owner: string): void {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }

  async selectEngine(engine?: string): Promise<boolean> {
    return engine === undefined || !engine.startsWith('http-tts:');
  }

  async isAvailable(): Promise<boolean> {
    return (await this.probe()).available;
  }

  /**
   * Capability + language + voice check. The reason text is preserved for the
   * coordinator so an unavailable engine never reports without a cause.
   */
  async probe(): Promise<ReaderTtsHostProbe> {
    if (this.closed) return { available: false, reason: '朗读服务已关闭' };
    try {
      await this.ensureEngine(DEFAULT_LANGUAGE, DEFAULT_PERSON);
      return { available: true };
    } catch (error) {
      this.logError('system TTS engine probe failed', error);
      const detail = errorMessageOf(error);
      if (/not\s*support|unsupported|不支持/i.test(detail)) {
        return { available: false, reason: `系统不支持朗读：${detail}` };
      }
      return { available: false, reason: `中文离线音色未安装或音色创建失败：${detail}` };
    }
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    this.installAudioListeners();
    if (!this.audioSessionActive || this.audioSessionAllowMixing !== allowMixing) {
      this.audioSessionManager.setAudioSessionScene(audio.AudioSessionScene.AUDIO_SESSION_SCENE_MEDIA);
      const concurrencyMode = allowMixing
        ? audio.AudioConcurrencyMode.CONCURRENCY_MIX_WITH_OTHERS
        : audio.AudioConcurrencyMode.CONCURRENCY_PAUSE_OTHERS;
      await this.audioSessionManager.activateAudioSession({ concurrencyMode });
      this.audioSessionActive = true;
      this.audioSessionAllowMixing = allowMixing;
    }
  }

  async deactivateAudioSession(): Promise<void> {
    if (!this.audioSessionActive) return;
    try {
      await this.audioSessionManager.deactivateAudioSession();
    } finally {
      this.audioSessionActive = false;
      this.audioSessionAllowMixing = undefined;
    }
  }

  async speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    this.assertSpeakRequest(request);
    const engine = await this.ensureEngine(request.language, request.person);
    this.currentRequestId = request.requestId;
    const params: textToSpeech.SpeakParams = {
      requestId: request.requestId,
      extraParams: {
        'queueMode': 0,
        'speed': request.rate,
        'pitch': request.pitch,
        'languageContext': this.engineLanguage ?? request.language,
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

  async listVoices(): Promise<ReaderTtsVoiceOption[]> {
    this.assertOpen();
    const voices = await textToSpeech.listVoices({
      requestId: `reader-list-voices-${Date.now()}`,
      online: OFFLINE_ENGINE,
      extraParams: {
        'locate': 'CN',
        'name': 'ReaderInAppTts',
      },
    });
    const options: ReaderTtsVoiceOption[] = [];
    for (const voice of voices) {
      if (!isReaderTtsVoiceInstalled(voice.status)) continue;
      if (voice.language.trim().length === 0 || !Number.isSafeInteger(voice.person) || voice.person < 0) continue;
      if (options.some((option: ReaderTtsVoiceOption): boolean =>
        option.language === voice.language && option.person === voice.person)) continue;
      const description = voice.description.trim();
      const style = voice.style.trim();
      const label = description.length > 0 ? description :
        (style.length > 0 ? `${voice.language} · ${style}` : `${voice.language} · 音色 ${voice.person}`);
      options.push({ language: voice.language, person: voice.person, label });
    }
    options.sort((left: ReaderTtsVoiceOption, right: ReaderTtsVoiceOption): number => {
      const languageOrder = left.language.localeCompare(right.language);
      return languageOrder !== 0 ? languageOrder : left.person - right.person;
    });
    if (options.length === 0) {
      options.push({ language: DEFAULT_LANGUAGE, person: DEFAULT_PERSON, label: '系统默认' });
    }
    return options;
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

  publishPlaybackState(_state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'): void {}

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.currentRequestId = undefined;
    this.listener = undefined;
    const engine = this.engine;
    this.engine = undefined;
    this.engineRequestedLanguage = undefined;
    this.engineRequestedPerson = undefined;
    this.engineLanguage = undefined;
    this.enginePerson = undefined;
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

  private async ensureEngine(language: string, person: number): Promise<textToSpeech.TextToSpeechEngine> {
    this.assertOpen();
    if (this.engine !== undefined && this.engineRequestedLanguage === language &&
      this.engineRequestedPerson === person) {
      return this.engine;
    }
    const previous = this.engine;
    this.engine = undefined;
    this.engineRequestedLanguage = undefined;
    this.engineRequestedPerson = undefined;
    this.engineLanguage = undefined;
    this.enginePerson = undefined;
    this.currentRequestId = undefined;
    if (previous !== undefined) {
      try {
        previous.stop();
      } catch (_) {
        // Replacing the engine is still safe when stop has already completed.
      }
      try {
        previous.shutdown();
      } catch (error) {
        this.logError('system TTS engine shutdown during replacement failed', error);
      }
    }
    let effectiveLanguage = language;
    let effectivePerson = person;
    let engine: textToSpeech.TextToSpeechEngine;
    try {
      engine = await this.createEngine(language, person);
    } catch (error) {
      if (language === DEFAULT_LANGUAGE && person === DEFAULT_PERSON) throw error;
      this.logError('requested system TTS voice failed; falling back to default', error);
      effectiveLanguage = DEFAULT_LANGUAGE;
      effectivePerson = DEFAULT_PERSON;
      engine = await this.createEngine(effectiveLanguage, effectivePerson);
    }
    engine.setListener(new EngineSpeakListener((event: ReaderTtsHostEvent): void => this.emit(event)));
    if (this.closed) {
      engine.shutdown();
      throw new Error('Reader system TTS Host closed during engine initialization');
    }
    this.engine = engine;
    this.engineRequestedLanguage = language;
    this.engineRequestedPerson = person;
    this.engineLanguage = effectiveLanguage;
    this.enginePerson = effectivePerson;
    return engine;
  }

  private createEngine(language: string, person: number): Promise<textToSpeech.TextToSpeechEngine> {
    return textToSpeech.createEngine({
      language,
      person,
      online: OFFLINE_ENGINE,
      extraParams: {
        'style': 'interaction-broadcast',
        'locate': 'CN',
        'name': 'ReaderInAppTts',
      },
    });
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
    if (!Number.isSafeInteger(request.person) || request.person < 0) {
      throw new Error('Reader system TTS requires a non-negative voice person');
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Reader system TTS Host is closed');
  }

  private logError(message: string, error: Object): void {
    const detail = errorMessageOf(error);
    hilog.error(LOG_DOMAIN, 'Reader', '%{private}s: %{private}s', message, detail);
  }
}
