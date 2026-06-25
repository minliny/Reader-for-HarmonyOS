// SystemTtsAdapter — clean-room HarmonyOS system TTS platform module.
// Wraps @ohos.tts.textToSpeech into a reusable adapter for book chapter
// read-aloud. No raw audio buffers or credentials are exported; only bounded
// status classes and redacted checksums are surfaced. Device execution
// requires a real TTS engine; headless contexts should treat failure as
// ENV_BLOCKED.

import { textToSpeech } from '@kit.CoreSpeechKit';
import { boundedChecksum } from '../adapters/FeedParserAdapter';

export type SystemTtsState = 'idle' | 'preparing' | 'speaking' | 'paused' | 'stopped' | 'error';

export interface SystemTtsEvidence {
  engineReady: boolean;
  backend: string;
  stateClass: SystemTtsState;
  utteranceChecksum: string;
  errorClass: string;
  rawAudioExported: boolean;
}

export interface SystemTtsSpeakRequest {
  utterance: string;
  language?: string;
  speechRate?: number;   // bounded 0-2
  volume?: number;       // bounded 0-1
}

const TTS_ENGINE_ID = 'reader-harmonyos-system-tts';

// SDK-COMPAT: SpeakListener implementation as a top-level class (ArkTS forbids
// constructor parameter properties and untyped object literals with methods).
class TtsListener implements textToSpeech.SpeakListener {
  private outer: SystemTtsAdapter;
  constructor(outer: SystemTtsAdapter) { this.outer = outer; }
  onStart(requestId: string, response: textToSpeech.StartResponse): void { this.outer.onTtsStart(); }
  onProgress(requestId: string, audio: ArrayBuffer, response: Object): void { /* audio consumed by platform */ }
  onFinish(requestId: string, response: Object): void { this.outer.onTtsFinish(); }
  onComplete(requestId: string, response: Object): void { this.outer.onTtsFinish(); }
  onStop(requestId: string, response: Object): void { this.outer.onTtsFinish(); }
  onError(requestId: string, errorCode: number, errorMessage: string): void { this.outer.onTtsError(); }
}

export class SystemTtsAdapter {
  private ttsEngine: textToSpeech.TextToSpeechEngine | null = null;
  private state: SystemTtsState = 'idle';
  private currentChecksum: string = '';

  /**
   * Lazily create the TTS engine. Device execution requires a real TTS
   * service; in headless contexts this returns false without faking success.
   */
  async ensureEngine(): Promise<boolean> {
    if (this.ttsEngine !== null) { return true; }
    try {
      // SDK-COMPAT: build params via typed records to satisfy arkts-no-untyped-obj-literals.
      const extraParam: Record<string, Object> = {} as Record<string, Object>;
      extraParam['style'] = 'interaction';
      extraParam['locate'] = 'zh-CN';
      extraParam['name'] = TTS_ENGINE_ID;
      // SDK-COMPAT: build via Record then cast to satisfy arkts-no-untyped-obj-literals.
      const initFields: Record<string, Object> = {} as Record<string, Object>;
      initFields['language'] = 'zh-CN';
      initFields['person'] = 0;
      initFields['online'] = 1;
      initFields['extraParams'] = extraParam;
      const initParams: textToSpeech.CreateEngineParams = initFields as Object as textToSpeech.CreateEngineParams;
      this.ttsEngine = await textToSpeech.createEngine(initParams);
      this.state = 'idle';
      return this.ttsEngine !== null;
    } catch (_e) {
      this.state = 'error';
      this.ttsEngine = null;
      return false;
    }
  }

  /** Speak an utterance; returns bounded evidence (no raw audio exported). */
  async speak(request: SystemTtsSpeakRequest): Promise<SystemTtsEvidence> {
    const ready = await this.ensureEngine();
    if (!ready || this.ttsEngine === null) {
      return {
        engineReady: false,
        backend: TTS_ENGINE_ID,
        stateClass: 'error',
        utteranceChecksum: boundedChecksum(`tts:empty`),
        errorClass: 'engine_unavailable',
        rawAudioExported: false
      };
    }
    this.currentChecksum = boundedChecksum(`tts:${request.utterance.length}`);
    this.state = 'preparing';
    try {
      // SDK-COMPAT: build params via typed records to satisfy arkts-no-untyped-obj-literals.
      const speakExtra: Record<string, Object> = {} as Record<string, Object>;
      speakExtra['speed'] = request.speechRate ?? 1;
      speakExtra['volume'] = request.volume ?? 1;
      speakExtra['pitch'] = 1;
      // SDK-COMPAT: build via Record then cast to satisfy arkts-no-untyped-obj-literals.
      const speakFields: Record<string, Object> = {} as Record<string, Object>;
      speakFields['requestId'] = this.boundedRequestId();
      speakFields['extraParams'] = speakExtra;
      const speakParams: textToSpeech.SpeakParams = speakFields as Object as textToSpeech.SpeakParams;
      // SDK-COMPAT: setSpeakListener renamed to setListener; SpeakListener requires onComplete/onStop.
      const listener: textToSpeech.SpeakListener = new TtsListener(this);
      this.ttsEngine.setListener(listener);
      await this.ttsEngine.speak(request.utterance, speakParams);
      return {
        engineReady: true,
        backend: TTS_ENGINE_ID,
        stateClass: this.state,
        utteranceChecksum: this.currentChecksum,
        errorClass: 'none',
        rawAudioExported: false
      };
    } catch (e) {
      this.state = 'error';
      return {
        engineReady: true,
        backend: TTS_ENGINE_ID,
        stateClass: 'error',
        utteranceChecksum: this.currentChecksum,
        errorClass: this.errorClass(e),
        rawAudioExported: false
      };
    }
  }

  /** Stop current utterance. */
  stop(): void {
    if (this.ttsEngine !== null) {
      try {
        this.ttsEngine.stop();
      } catch (_e) {
        // Bounded failure.
      }
    }
    this.state = 'stopped';
  }

  /** Shutdown the engine and release resources. */
  shutdown(): void {
    if (this.ttsEngine !== null) {
      try {
        this.ttsEngine.shutdown();
      } catch (_e) {
        // Bounded failure.
      }
    }
    this.ttsEngine = null;
    this.state = 'idle';
  }

  /** Build redacted evidence for a fixture round-trip (no device TTS required). */
  buildFixtureEvidence(): SystemTtsEvidence {
    const fixtureUtterance = 'reader-fixture-utterance';
    return {
      engineReady: false,
      backend: TTS_ENGINE_ID,
      stateClass: 'idle',
      utteranceChecksum: boundedChecksum(`tts:${fixtureUtterance.length}`),
      errorClass: 'none',
      rawAudioExported: false
    };
  }

  getState(): SystemTtsState {
    return this.state;
  }

  private boundedRequestId(): string {
    return `tts-${boundedChecksum(`req-${Date.now()}`)}`;
  }

  private errorClass(e: Object): string {
    const text = JSON.stringify(e);
    if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) { return 'permission'; }
    if (text.indexOf('unsupported') !== -1) { return 'unsupported'; }
    if (text.length === 0) { return 'unknown'; }
    return 'tts_error';
  }

  // SDK-COMPAT: listener callbacks exposed for the inner TtsListener class.
  onTtsStart(): void { this.state = 'speaking'; }
  onTtsFinish(): void { this.state = 'idle'; }
  onTtsError(): void { this.state = 'error'; }
}
