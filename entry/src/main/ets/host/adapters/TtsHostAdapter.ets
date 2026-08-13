// TtsHostAdapter — app-owned HarmonyOS adapter for tts.system.start / stop /
// pause / resume.
//
// The Reader's visible playback controls remain inside ArkUI.  Do not use
// the system-reader playback API for normal playback: that API owns a system
// surface and can take the user out of the Reader app. The product has an
// in-app Figma TTS panel, so normal playback deliberately uses the lower-level
// CoreSpeechKit TextToSpeechEngine instead.
//
// TextToSpeechEngine gives us real speak/stop/completion callbacks and a
// programmatic speed parameter.  It does not expose a trustworthy pause or
// character-progress API.  Those capabilities are reported as unavailable;
// we never fake pause/resume by silently restarting a paragraph.
import { textToSpeech } from '@kit.CoreSpeechKit';
import common from '@ohos.app.ability.common';
import {
  HostTtsSystemStartRequest,
  HostTtsSystemStartResponse,
  HostTtsSystemControlResponse,
} from '../types';

type TtsBackendKind = 'textToSpeech' | 'none';

// Kept as a stable host seam.  TextToSpeechEngine has no native percentage
// callback, so production never emits invented values through it.
export type TtsProgressCallback = (articleId: string, currentPercent: number, maxPercent: number,
  progressType: number) => void;
export type TtsCompletionCallback =
  (articleId: string, correlationId: string, generation: number, sliceIndex: number) => void;
export type TtsFailureCallback =
  (articleId: string, correlationId: string, generation: number, sliceIndex: number,
    message: string) => void;

class EngineSpeakListener implements textToSpeech.SpeakListener {
  private readonly completed: (requestId: string) => void;
  private readonly failed: (requestId: string, message: string) => void;

  constructor(completed: (requestId: string) => void,
    failed: (requestId: string, message: string) => void) {
    this.completed = completed;
    this.failed = failed;
  }

  onStart(_requestId: string, _response: textToSpeech.StartResponse): void {}
  onComplete(requestId: string, _response: textToSpeech.CompleteResponse): void {
    this.completed(requestId);
  }
  onStop(_requestId: string, _response: textToSpeech.StopResponse): void {}
  onError(requestId: string, _errorCode: number, errorMessage: string): void {
    this.failed(requestId, errorMessage);
  }
}

export class TtsHostAdapter {
  // Preserve the constructor shape used by CoreRuntime.  The engine itself
  // does not need the ability context and therefore cannot open a system
  // reader page through that context.
  private context: common.BaseContext | null;
  private backend: TtsBackendKind = 'none';
  private initialized: boolean = false;
  private currentArticleId: string = '';
  private currentText: string = '';
  private lastPercent: number = 0;
  private playbackState: string = 'unknown';
  private progressCallback: TtsProgressCallback | null = null;
  private completionCallback: TtsCompletionCallback | null = null;
  private failureCallback: TtsFailureCallback | null = null;
  private currentCorrelationId: string = '';
  private currentGeneration: number = -1;
  private currentSliceIndex: number = -1;
  private completionDeliveredArticleId: string = '';
  private engine: textToSpeech.TextToSpeechEngine | null = null;
  private nextRequestId: number = 1;

  constructor(context?: common.BaseContext) {
    this.context = context ?? null;
  }

  setProgressCallback(callback: TtsProgressCallback | null): void {
    this.progressCallback = callback;
  }

  setCompletionCallback(callback: TtsCompletionCallback | null): void {
    this.completionCallback = callback;
  }

  setFailureCallback(callback: TtsFailureCallback | null): void {
    this.failureCallback = callback;
  }

  /** Start in-app audio only; this must never invoke a system reader UI. */
  async start(request: HostTtsSystemStartRequest): Promise<HostTtsSystemStartResponse> {
    await this.ensureInitialized();
    if (this.backend !== 'textToSpeech') return { started: false };
    return this.startWithEngine(request);
  }

  async stop(): Promise<HostTtsSystemControlResponse> {
    this.currentCorrelationId = '';
    this.currentGeneration = -1;
    this.currentSliceIndex = -1;
    if (this.backend !== 'textToSpeech' || this.engine === null) {
      return { acknowledged: false };
    }
    try {
      this.engine.stop();
      this.playbackState = 'stopped';
      return { acknowledged: true };
    } catch (_error) {
      return { acknowledged: false };
    }
  }

  // The engine does not expose a real pause/resume primitive.  Return false
  // so the reducer/UI can keep this action unavailable rather than lying
  // about the playback position.
  async pause(): Promise<HostTtsSystemControlResponse> {
    return { acknowledged: false };
  }

  async resume(): Promise<HostTtsSystemControlResponse> {
    return { acknowledged: false };
  }

  async shutdown(): Promise<void> {
    if (this.backend === 'textToSpeech' && this.engine !== null) {
      try {
        this.engine.shutdown();
      } catch (_error) {
        // Best effort at ability teardown.
      }
    }
    this.engine = null;
    this.initialized = false;
    this.backend = 'none';
    this.currentArticleId = '';
    this.currentText = '';
    this.lastPercent = 0;
    this.playbackState = 'unknown';
    this.currentCorrelationId = '';
    this.currentGeneration = -1;
    this.currentSliceIndex = -1;
    this.completionDeliveredArticleId = '';
    this.completionCallback = null;
    this.failureCallback = null;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    try {
      const createParams: textToSpeech.CreateEngineParams = {
        language: 'zh-CN',
        person: 0,
        online: 1,
        extraParams: {
          'style': 'interaction-broadcast',
          'locate': 'CN',
          'name': 'ReaderInAppTts',
        },
      };
      this.engine = await textToSpeech.createEngine(createParams);
      this.engine.setListener(new EngineSpeakListener(
        (requestId: string): void => this.deliverCompletion(requestId),
        (requestId: string, message: string): void => this.deliverFailure(requestId, message),
      ));
      this.backend = 'textToSpeech';
      this.initialized = true;
    } catch (_error) {
      this.engine = null;
      this.backend = 'none';
      this.initialized = false;
      this.playbackState = 'error';
    }
  }

  private deliverCompletion(requestId: string): void {
    if (requestId !== this.currentArticleId || this.completionDeliveredArticleId === requestId) return;
    this.playbackState = 'completed';
    this.completionDeliveredArticleId = requestId;
    if (this.currentCorrelationId.length === 0 || this.completionCallback === null) return;
    this.completionCallback(
      requestId, this.currentCorrelationId, this.currentGeneration, this.currentSliceIndex,
    );
  }

  private deliverFailure(requestId: string, message: string): void {
    if (requestId !== this.currentArticleId || this.completionDeliveredArticleId === requestId) return;
    this.playbackState = 'error';
    this.completionDeliveredArticleId = requestId;
    if (this.currentCorrelationId.length === 0 || this.failureCallback === null) return;
    this.failureCallback(
      requestId, this.currentCorrelationId, this.currentGeneration, this.currentSliceIndex,
      message.length > 0 ? message : 'Harmony in-app TTS failed',
    );
  }

  private async startWithEngine(request: HostTtsSystemStartRequest): Promise<HostTtsSystemStartResponse> {
    if (this.engine === null) return { started: false };
    const requestId = request.articleId !== undefined && request.articleId.length > 0
      ? request.articleId : String(this.nextRequestId++);
    const params: textToSpeech.SpeakParams = {
      requestId: requestId,
      extraParams: {
        'queueMode': 0,
        'speed': request.rate ?? 1,
        'pitch': request.pitch ?? 1,
        'languageContext': 'zh-CN',
        'audioType': 'pcm',
        'soundChannel': 3,
        'playType': 1,
      },
    };
    try {
      this.engine.speak(request.text, params);
      this.currentArticleId = requestId;
      this.currentText = request.text;
      this.lastPercent = 0;
      this.currentCorrelationId = request.correlationId ?? '';
      this.currentGeneration = request.generation ?? -1;
      this.currentSliceIndex = request.sliceIndex ?? -1;
      this.completionDeliveredArticleId = '';
      this.playbackState = 'playing';
      return { started: true };
    } catch (_error) {
      this.playbackState = 'error';
      return { started: false };
    }
  }

  /** The engine has real lifecycle callbacks but no native percentage cursor. */
  queryState(): string {
    return this.initialized ? this.playbackState : 'unknown';
  }

  getLastPercent(): number {
    return this.lastPercent;
  }

  getCurrentArticleId(): string {
    return this.currentArticleId;
  }

  getBackendKind(): TtsBackendKind {
    return this.backend;
  }

  supportsProgrammaticRate(): boolean {
    return this.backend === 'textToSpeech';
  }
}
