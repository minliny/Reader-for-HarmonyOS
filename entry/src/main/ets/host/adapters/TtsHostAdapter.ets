// TtsHostAdapter — HarmonyOS Host adapter for tts.system.start / stop / pause /
// resume, backed by @kit.SpeechKit TextReader (primary) with
// @kit.CoreSpeechKit textToSpeech as fallback.
//
// Source of truth: UI Contract host-request.schema.json — `tts.system.*` are
// UI-Contract-only capabilities (NOT in the Core HostCapability closed set).
// Reducer dispatches these directly.
//
// Why TextReader is the primary:
//   TextToSpeechEngine (@kit.CoreSpeechKit) only exposes speak/stop/isBusy/
//   shutdown — it has NO pause() or resume() and NO progress callback. Using
//   it to fake pause/resume (stop + re-speak from offset) is incorrect: the
//   engine gives no cursor, so resume restarts from the beginning of the text.
//
//   TextReader (@kit.SpeechKit) is a higher-level reader component that exposes:
//     init / start / stop / pause / resume / release / queryReadState
//     on('readProgress', Callback<ReadProgress>) — gives currentPercent
//     StartParams.startPercent — resume from a specific percent
//
//   This is a true 1:1 native mapping for all four tts.system.* capabilities,
//   not a workaround. TextToSpeechEngine is kept ONLY as a fallback for the
//   case where TextReader.init fails (e.g. device without TextReader HSP); in
//   that fallback mode, pause/resume return acknowledged: false — they are
//   NOT faked.
//
// Permission: ohos.permission.KEEP_BACKGROUND_RUNNING (declared in module.json5)
// is required by TextReader.init for background playback.
//
// API version notes:
//   - TextReader: 5.0.0(12)+; StartParams.startPercent and
//     ReadProgress.currentPercent are 6.0.1(21)+. On earlier versions,
//     startPercent is undefined and resume restarts from 0%.
//   - TextReader is a global singleton — init does NOT return an engine
//     instance. All methods are called on the TextReader namespace directly.
//   - pause() and resume() are synchronous (return void); start/stop/init/
//     release are Promise<void>.
import { TextReader } from '@kit.SpeechKit';
import { textToSpeech } from '@kit.CoreSpeechKit';
import common from '@ohos.app.ability.common';
import {
  HostTtsSystemStartRequest,
  HostTtsSystemStartResponse,
  HostTtsSystemControlResponse,
} from '../types';

// TextReader enum values inlined as numbers because the SDK exports them from
// a namespace and ArkTS may not resolve `TextReader.ReadProgressType` in all
// build configurations. Values are stable per @hms.ai.textReader.d.ets.
const READ_PROGRESS_TYPE_PROGRESS: number = 1;
const READ_PROGRESS_TYPE_PAUSE: number = 2;
const READ_PROGRESS_TYPE_STOP: number = 3;
const READ_PROGRESS_TYPE_COMPLETED: number = 4;

const READ_STATE_PLAYING: number = 1;
const READ_STATE_PAUSED: number = 2;
const READ_STATE_COMPLETED: number = 3;
const READ_STATE_WAITING: number = 4;

type TtsBackendKind = 'textReader' | 'textToSpeechFallback' | 'none';

// Progress callback type — Reducer registers to receive currentPercent updates.
export type TtsProgressCallback = (articleId: string, currentPercent: number, maxPercent: number,
  progressType: number) => void;
export type TtsCompletionCallback =
  (articleId: string, correlationId: string, generation: number, sliceIndex: number) => void;
export type TtsFailureCallback =
  (articleId: string, correlationId: string, generation: number, sliceIndex: number,
    message: string) => void;

class FallbackSpeakListener implements textToSpeech.SpeakListener {
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
  private context: common.BaseContext | null;
  private backend: TtsBackendKind = 'none';
  private initialized: boolean = false;
  private currentArticleId: string = '';
  private currentText: string = '';
  private lastPercent: number = 0;
  private progressCallback: TtsProgressCallback | null = null;
  private completionCallback: TtsCompletionCallback | null = null;
  private failureCallback: TtsFailureCallback | null = null;
  private currentCorrelationId: string = '';
  private currentGeneration: number = -1;
  private currentSliceIndex: number = -1;
  private completionDeliveredArticleId: string = '';
  // Fallback engine (only used when TextReader.init fails).
  private fallbackEngine: textToSpeech.TextToSpeechEngine | null = null;
  private fallbackNextRequestId: number = 1;

  constructor(context?: common.BaseContext) {
    this.context = context ?? null;
  }

  /**
   * Register a progress callback. Reducer uses this to receive currentPercent
   * updates from TextReader, so it can persist reading position and pass it
   * back as StartParams.startPercent on resume.
   */
  setProgressCallback(callback: TtsProgressCallback | null): void {
    this.progressCallback = callback;
  }

  setCompletionCallback(callback: TtsCompletionCallback | null): void {
    this.completionCallback = callback;
  }

  setFailureCallback(callback: TtsFailureCallback | null): void {
    this.failureCallback = callback;
  }

  /**
   * tts.system.start — initialize TextReader (lazy, first call) and start
   * reading the text. Maps the request text to a single ReadInfo article.
   *
   * If TextReader.init fails, falls back to TextToSpeechEngine.speak. In
   * fallback mode, pause/resume are NOT supported (return acknowledged: false).
   */
  async start(request: HostTtsSystemStartRequest): Promise<HostTtsSystemStartResponse> {
    await this.ensureInitialized();
    if (this.backend === 'textReader') {
      return this.startWithTextReader(request);
    }
    if (this.backend === 'textToSpeechFallback') {
      return this.startWithFallback(request);
    }
    return { started: false };
  }

  /**
   * tts.system.stop — stop playback and clear state.
   */
  async stop(): Promise<HostTtsSystemControlResponse> {
    // Invalidate callbacks before asking the platform to stop. TextReader may
    // emit a final progress event while stop() is resolving.
    this.currentCorrelationId = '';
    this.currentGeneration = -1;
    this.currentSliceIndex = -1;
    if (this.backend === 'textReader' && this.initialized) {
      try {
        await TextReader.stop();
        return { acknowledged: true };
      } catch (e) {
        return { acknowledged: false };
      }
    }
    if (this.backend === 'textToSpeechFallback' && this.fallbackEngine !== null) {
      try {
        this.fallbackEngine.stop();
        return { acknowledged: true };
      } catch (e) {
        return { acknowledged: false };
      }
    }
    return { acknowledged: false };
  }

  /**
   * tts.system.pause — pause playback.
   *
   * TextReader: native pause() (synchronous void).
   * Fallback: NOT SUPPORTED — returns acknowledged: false. Reducer should
   * hide the pause button when in fallback mode.
   */
  async pause(): Promise<HostTtsSystemControlResponse> {
    if (this.backend === 'textReader' && this.initialized) {
      try {
        TextReader.pause();
        return { acknowledged: true };
      } catch (e) {
        return { acknowledged: false };
      }
    }
    // Fallback has no pause — explicitly NOT faked.
    return { acknowledged: false };
  }

  /**
   * tts.system.resume — resume playback from paused position.
   *
   * TextReader: native resume() (synchronous void). The reader internally
   * remembers the paused position; no need to re-supply startPercent.
   *
   * Fallback: NOT SUPPORTED — returns acknowledged: false.
   */
  async resume(): Promise<HostTtsSystemControlResponse> {
    if (this.backend === 'textReader' && this.initialized) {
      try {
        TextReader.resume();
        return { acknowledged: true };
      } catch (e) {
        return { acknowledged: false };
      }
    }
    return { acknowledged: false };
  }

  /**
   * Release all resources. Call on adapter disposal / app shutdown.
   */
  async shutdown(): Promise<void> {
    if (this.backend === 'textReader' && this.initialized) {
      try {
        TextReader.off('readProgress');
        TextReader.off('stateChange');
        await TextReader.release();
      } catch (e) {
        // Best-effort.
      }
    }
    if (this.backend === 'textToSpeechFallback' && this.fallbackEngine !== null) {
      try {
        this.fallbackEngine.shutdown();
      } catch (e) {
        // Best-effort.
      }
      this.fallbackEngine = null;
    }
    this.initialized = false;
    this.backend = 'none';
    this.currentArticleId = '';
    this.currentText = '';
    this.lastPercent = 0;
    this.currentCorrelationId = '';
    this.currentGeneration = -1;
    this.currentSliceIndex = -1;
    this.completionDeliveredArticleId = '';
    this.completionCallback = null;
    this.failureCallback = null;
  }

  // ── internal: initialization ──

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.context === null) {
      // No context — cannot init TextReader. Try fallback without context.
      await this.initFallback();
      return;
    }
    // Try TextReader first.
    try {
      const readerParam: TextReader.ReaderParam = {
        isVoiceBrandVisible: false,
        keepBackgroundRunning: true,
        online: 1,
        isMinibarNeeded: false,
        reportProgressPeriod: 1000,
      };
      await TextReader.init(this.context, readerParam);
      this.registerTextReaderListeners();
      this.backend = 'textReader';
      this.initialized = true;
      return;
    } catch (e) {
      // TextReader init failed — fall through to TextToSpeechEngine.
    }
    await this.initFallback();
  }

  private async initFallback(): Promise<void> {
    try {
      const createParams: textToSpeech.CreateEngineParams = {
        language: 'zh-CN',
        person: 0,
        online: 1,
        extraParams: {
          'style': 'interaction-broadcast',
          'locate': 'CN',
          'name': 'EngineName',
        },
      };
      this.fallbackEngine = await textToSpeech.createEngine(createParams);
      this.fallbackEngine.setListener(new FallbackSpeakListener(
        (requestId: string): void => this.deliverFallbackCompletion(requestId),
        (requestId: string, message: string): void => this.deliverFallbackFailure(requestId, message),
      ));
      this.backend = 'textToSpeechFallback';
      this.initialized = true;
    } catch (e) {
      this.backend = 'none';
      this.initialized = false;
    }
  }

  private registerTextReaderListeners(): void {
    TextReader.on('readProgress', (progress: TextReader.ReadProgress) => {
      // currentPercent is 6.0.1(21)+; on earlier versions it may be undefined.
      const current = typeof progress.currentPercent === 'number' ? progress.currentPercent : 0;
      this.lastPercent = current;
      if (this.progressCallback !== null) {
        this.progressCallback(progress.id, current, progress.maxPercent, progress.readProgressType as number);
      }
      if (progress.readProgressType as number === READ_PROGRESS_TYPE_COMPLETED &&
        progress.id === this.currentArticleId && this.currentCorrelationId.length > 0 &&
        this.completionCallback !== null && this.completionDeliveredArticleId !== progress.id) {
        this.completionDeliveredArticleId = progress.id;
        this.completionCallback(
          progress.id, this.currentCorrelationId, this.currentGeneration, this.currentSliceIndex,
        );
      }
    });
    TextReader.on('stateChange', (state: TextReader.ReadState) => {
      // State transitions are tracked but not exposed to Reducer yet; Reducer
      // polls via queryReadState if needed. This is here so we can extend
      // without changing the contract.
    });
  }

  private deliverFallbackCompletion(requestId: string): void {
    if (requestId !== this.currentArticleId || this.currentCorrelationId.length === 0 ||
      this.completionCallback === null || this.completionDeliveredArticleId === requestId) return;
    this.completionDeliveredArticleId = requestId;
    this.completionCallback(
      requestId, this.currentCorrelationId, this.currentGeneration, this.currentSliceIndex,
    );
  }

  private deliverFallbackFailure(requestId: string, message: string): void {
    if (requestId !== this.currentArticleId || this.currentCorrelationId.length === 0 ||
      this.failureCallback === null || this.completionDeliveredArticleId === requestId) return;
    this.completionDeliveredArticleId = requestId;
    this.failureCallback(
      requestId, this.currentCorrelationId, this.currentGeneration, this.currentSliceIndex,
      message.length > 0 ? message : 'Harmony TTS fallback failed',
    );
  }

  // ── internal: TextReader start ──

  private async startWithTextReader(request: HostTtsSystemStartRequest): Promise<HostTtsSystemStartResponse> {
    // Build a single-article ReadInfo list. bodyInfo is limited to 10000 chars;
    // longer text should be chunked by Reducer before calling start.
    // TextReader exposes its own player-panel speed control but no documented
    // application-side speed setter in the installed SDK.  Do not pretend
    // `request.rate` was applied here; Reader UI keeps rate disabled until a
    // Host API can make that setting observable and effective.
    const articleId = request.articleId !== undefined && request.articleId.length > 0
      ? request.articleId : 'tts-' + Date.now();
    const titleInfo: TextReader.TextInfo = {
      text: '朗读',
      isClickable: false,
    };
    const readInfo: TextReader.ReadInfo = {
      id: articleId,
      title: titleInfo,
      bodyInfo: request.text,
    };
    this.currentArticleId = articleId;
    this.currentText = request.text;
    this.lastPercent = 0;
    this.currentCorrelationId = request.correlationId ?? '';
    this.currentGeneration = request.generation ?? -1;
    this.currentSliceIndex = request.sliceIndex ?? -1;
    this.completionDeliveredArticleId = '';

    const readInfoList: TextReader.ReadInfo[] = [readInfo];
    const startParams: TextReader.StartParams = {
      isMinibarHidden: true,
      callbackParam: '',
      startPercent: 0,
    };

    try {
      await TextReader.start(readInfoList, articleId, startParams);
      return { started: true };
    } catch (e) {
      return { started: false };
    }
  }

  // ── internal: fallback start (TextToSpeechEngine) ──

  private async startWithFallback(request: HostTtsSystemStartRequest): Promise<HostTtsSystemStartResponse> {
    if (this.fallbackEngine === null) {
      return { started: false };
    }
    const requestId = request.articleId !== undefined && request.articleId.length > 0
      ? request.articleId : String(this.fallbackNextRequestId++);
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
      this.fallbackEngine.speak(request.text, params);
      this.currentArticleId = requestId;
      this.currentText = request.text;
      this.currentCorrelationId = request.correlationId ?? '';
      this.currentGeneration = request.generation ?? -1;
      this.currentSliceIndex = request.sliceIndex ?? -1;
      this.completionDeliveredArticleId = '';
      return { started: true };
    } catch (e) {
      return { started: false };
    }
  }

  // ── internal: query state (exposed for Reducer to poll if needed) ──

  /**
   * Query the current playback state. Returns one of:
   *   'playing' | 'paused' | 'completed' | 'waiting' | 'unknown'
   *
   * Only meaningful when backend is 'textReader'. Fallback returns 'unknown'.
   */
  queryState(): string {
    if (this.backend !== 'textReader' || !this.initialized) {
      return 'unknown';
    }
    try {
      const state = TextReader.queryReadState(this.currentArticleId);
      switch (state.state) {
        case READ_STATE_PLAYING: return 'playing';
        case READ_STATE_PAUSED: return 'paused';
        case READ_STATE_COMPLETED: return 'completed';
        case READ_STATE_WAITING: return 'waiting';
        default: return 'unknown';
      }
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Get the last known playback percent (0-100). Updated by readProgress
   * callback. Reducer can persist this and pass it back via startPercent on
   * a future start() call to resume from the same position.
   */
  getLastPercent(): number {
    return this.lastPercent;
  }

  getCurrentArticleId(): string {
    return this.currentArticleId;
  }

  /**
   * Get the current backend kind. Reducer uses this to decide whether to
   * show/hide pause and resume controls.
   *   'textReader' — full pause/resume support
   *   'textToSpeechFallback' — only start/stop; pause/resume return false
   *   'none' — TTS unavailable
   */
  getBackendKind(): TtsBackendKind {
    return this.backend;
  }

  /**
   * Only the TextToSpeech fallback accepts `SpeakParams.extraParams.speed`.
   * The primary TextReader path deliberately returns false because its SDK
   * offers no programmatic rate setter; callers must not advertise a rate
   * selector just because the Core queue stores a rate value.
   */
  supportsProgrammaticRate(): boolean {
    return this.backend === 'textToSpeechFallback';
  }
}
