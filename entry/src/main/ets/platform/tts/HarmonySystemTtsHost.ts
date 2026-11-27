import { harmonyTtsAudioSessionLease } from './HarmonyTtsAudioSessionLease';
import { HarmonyTtsAudioListenerRegistry } from './HarmonyTtsAudioListenerRegistry';
import lazy { textToSpeech } from '@kit.CoreSpeechKit';
import { audio } from '@kit.AudioKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../app/ErrorMessage.ts';
import {
  type ReaderTtsHost,
  type ReaderTtsHostEvent,
  type ReaderTtsHostProbe,
  type ReaderTtsHostSpeakRequest,
  type ReaderTtsNativeSpeakPoint,
} from '../../features/reading/application/ReaderTtsHostContract';
import {
  isReaderTtsVoiceInstalled,
  type ReaderTtsVoiceOption,
} from '../../features/reading/application/ReaderTtsPreferencesState';

const LOG_DOMAIN = 0x5244;
const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_PERSON = 0;
// Core Speech Kit supports both 0 and 13 for the Mandarin Ling Xiaoshan voice.
const LING_XIAOSHAN_PERSON = 13;
const OFFLINE_ENGINE = 1;
const SYNTHESIS_COMPLETE = 0;
const SPEECH_COMPLETE = 1;

interface SystemTtsVoiceIdentity { language: string; person: number }

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
  private static readonly retiringEngines: Set<textToSpeech.TextToSpeechEngine> =
    new Set<textToSpeech.TextToSpeechEngine>();
  private audioListeners: HarmonyTtsAudioListenerRegistry | undefined = undefined;
  private readonly audioSessionDeactivatedCallback: (event: audio.AudioSessionDeactivatedEvent) => void;
  private readonly audioSessionStateChangedCallback: (event: audio.AudioSessionStateChangedEvent) => void;
  private readonly outputDeviceChangedCallback: (event: audio.CurrentOutputDeviceChangedEvent) => void;
  private engine: textToSpeech.TextToSpeechEngine | undefined = undefined;
  private engineRequestedLanguage: string | undefined = undefined;
  private engineRequestedPerson: number | undefined = undefined;
  private engineLanguage: string | undefined = undefined;
  private enginePerson: number | undefined = undefined;
  private acceptedVoice: SystemTtsVoiceIdentity | undefined = undefined;
  private listener: ((event: ReaderTtsHostEvent) => void) | undefined = undefined;
  private listenerOwner: string | undefined = undefined;
  private currentRequestId: string | undefined = undefined;
  private readonly audioSessionLease = harmonyTtsAudioSessionLease;
  private readonly audioSessionOwner: string = this.audioSessionLease.createOwner('system');
  private closed: boolean = false;
  private speakGeneration: number = 0;
  private engineGeneration: number = 0;

  constructor() {
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
  async probe(language?: string, person?: number, exactVoice?: boolean): Promise<ReaderTtsHostProbe> {
    if (this.closed) return { available: false, reason: '朗读服务已关闭' };
    if (!canIUse('SystemCapability.AI.TextToSpeech')) {
      return { available: false, reason: '当前系统不支持系统朗读，可配置在线 TTS。' };
    }
    try {
      const requestedLanguage = language ?? this.acceptedVoice?.language ?? DEFAULT_LANGUAGE;
      const requestedPerson = person ?? this.acceptedVoice?.person ?? DEFAULT_PERSON;
      const engine = await this.ensureEngine(requestedLanguage, requestedPerson, undefined, exactVoice);
      if (!this.closed && this.engine === engine && exactVoice !== true) {
        this.acceptedVoice = { language: requestedLanguage, person: requestedPerson };
      }
      return { available: true };
    } catch (error) {
      this.logError('system TTS engine probe failed', error);
      const detail = errorMessageOf(error);
      if (/not\s*support|unsupported|不支持/i.test(detail)) {
        return { available: false, reason: '当前系统不支持此音色，可选择其他音色或配置在线 TTS。' };
      }
      return { available: false, reason: '系统音色未安装或无法启动，请安装或启用语音服务，也可以配置在线 TTS。' };
    }
  }

  async activateAudioSession(allowMixing: boolean): Promise<void> {
    this.assertOpen();
    this.installAudioListeners();
    await this.audioSessionLease.activate(this.audioSessionOwner, allowMixing);
    this.assertOpen();
  }

  async deactivateAudioSession(): Promise<void> {
    await this.audioSessionLease.deactivate(this.audioSessionOwner);
  }

  async speak(request: ReaderTtsHostSpeakRequest): Promise<void> {
    this.assertSpeakRequest(request);
    const generation = ++this.speakGeneration;
    const previous = this.engine;
    const engine = await this.ensureEngine(request.language, request.person, request.traceNativeSpeak, request.exactVoice);
    if (this.closed || generation !== this.speakGeneration) return;
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
      request.traceNativeSpeak?.('enter');
      engine.speak(request.text, params);
      if (generation === this.speakGeneration && this.engine === engine) {
        this.acceptedVoice = { language: request.language, person: request.person };
      }
    } catch (error) {
      if (this.currentRequestId === request.requestId) this.currentRequestId = undefined;
      if (request.exactVoice === true && engine !== previous && this.engine === engine) {
        this.engine = undefined;
        this.retireEngine(engine);
      }
      throw error;
    } finally {
      request.traceNativeSpeak?.('return');
    }
  }

  async listVoices(): Promise<ReaderTtsVoiceOption[]> {
    this.assertOpen();
    if (!canIUse('SystemCapability.AI.TextToSpeech')) return [];
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
    return options;
  }

  async stop(): Promise<void> {
    this.speakGeneration += 1;
    this.engineGeneration += 1;
    const engine = this.engine;
    this.currentRequestId = undefined;
    if (engine === undefined) return;
    try {
      engine.stop();
    } catch (error) {
      this.logError('system TTS stop failed', error);
      throw new Error('Reader system TTS transport did not stop');
    }
  }

  publishPlaybackState(_state: 'preparing' | 'playing' | 'paused' | 'completed' | 'stopped' | 'error'): void {}

  async close(): Promise<void> {
    const alreadyClosed = this.closed;
    this.closed = true;
    this.audioListeners?.close();
    if (alreadyClosed) return;
    this.speakGeneration += 1;
    this.engineGeneration += 1;
    this.currentRequestId = undefined;
    this.listener = undefined;
    const engine = this.engine;
    this.engine = undefined;
    this.engineRequestedLanguage = undefined;
    this.engineRequestedPerson = undefined;
    this.engineLanguage = undefined;
    this.enginePerson = undefined;
    this.acceptedVoice = undefined;
    if (engine !== undefined) {
      try {
        engine.stop();
      } catch (_) {
        // Best effort: shutdown below still releases the platform object.
      }
      this.retireEngine(engine);
    }
    try {
      await this.deactivateAudioSession();
    } catch (error) {
      this.logError('audio session deactivation failed during teardown', error);
    }
  }

  private async ensureEngine(language: string, person: number,
    trace?: (point: ReaderTtsNativeSpeakPoint) => void, exactVoice: boolean = false): Promise<textToSpeech.TextToSpeechEngine> {
    this.assertOpen();
    if (!canIUse('SystemCapability.AI.TextToSpeech')) throw new Error('System TTS is unsupported');
    for (const retired of HarmonySystemTtsHost.retiringEngines) {
      if (!this.retireEngine(retired)) throw new Error('Reader system TTS could not release its previous engine');
    }
    if (this.engine !== undefined && this.engineRequestedLanguage === language) {
      const cached = this.engineRequestedPerson;
      if (cached === person && (!exactVoice || (this.engineLanguage === language && this.enginePerson === person))) {
        trace?.('engine-cache-hit');
        return this.engine;
      }
      if (!exactVoice && language === DEFAULT_LANGUAGE &&
        ((cached === DEFAULT_PERSON && person === LING_XIAOSHAN_PERSON) ||
          (cached === LING_XIAOSHAN_PERSON && person === DEFAULT_PERSON))) {
        trace?.('engine-cache-alias-hit');
        return this.engine;
      }
    }
    trace?.('engine-cache-miss');
    const generation = ++this.engineGeneration;
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
      if (!this.retireEngine(previous)) throw new Error('Reader system TTS could not release its previous engine');
    }
    let effectiveLanguage = language;
    let effectivePerson = person;
    let engine: textToSpeech.TextToSpeechEngine;
    try {
      engine = await this.createEngine(language, person);
    } catch (error) {
      if (this.closed || generation !== this.engineGeneration) {
        throw new Error('Reader system TTS engine initialization retired');
      }
      if (exactVoice || (language === DEFAULT_LANGUAGE && person === DEFAULT_PERSON)) throw error;
      this.logError('requested system TTS voice failed; falling back to default', error);
      effectiveLanguage = DEFAULT_LANGUAGE;
      effectivePerson = DEFAULT_PERSON;
      engine = await this.createEngine(effectiveLanguage, effectivePerson);
    }
    // A stopped/retired creation must never replace or orphan a successor's
    // active platform object. Shut down only the object this creation owns.
    if (this.closed || generation !== this.engineGeneration) {
      this.retireEngine(engine);
      throw new Error('Reader system TTS engine initialization retired');
    }
    try {
      engine.setListener(new EngineSpeakListener((event: ReaderTtsHostEvent): void => {
        if (this.engine === engine) this.emit(event);
      }));
    } catch (error) {
      this.retireEngine(engine);
      throw error;
    }
    this.engine = engine;
    this.engineRequestedLanguage = language;
    this.engineRequestedPerson = person;
    this.engineLanguage = effectiveLanguage;
    this.enginePerson = effectivePerson;
    return engine;
  }

  private retireEngine(engine: textToSpeech.TextToSpeechEngine): boolean {
    try {
      engine.shutdown();
      HarmonySystemTtsHost.retiringEngines.delete(engine);
      return true;
    } catch (error) {
      HarmonySystemTtsHost.retiringEngines.add(engine);
      this.logError('system TTS engine shutdown failed', error);
      return false;
    }
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
    this.audioListeners ??= new HarmonyTtsAudioListenerRegistry(audio.getAudioManager().getSessionManager(),
      this.audioSessionDeactivatedCallback, this.audioSessionStateChangedCallback, this.outputDeviceChangedCallback);
    this.audioListeners.install();
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
    try { hilog.error(LOG_DOMAIN, 'Reader', '%{private}s: %{private}s', message, errorMessageOf(error)); }
    catch (_) { /* Diagnostics must not reject transport teardown. */ }
  }
}
