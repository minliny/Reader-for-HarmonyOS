// R8 playback executor. TTS and auto-page are Pilot; page remains Shadow.
// ReaderUIRuntime remains the sole
// semantic state machine; this file binds typed Core chapter data, executes
// each emitted effect exactly once, and rejects stale platform callbacks.
import {
  ReaderUIEffect,
  ReaderUIJSONPayload,
  ReaderUIJSONResult,
  ReaderUIPageLayout,
  ReaderUIPlaybackTransition,
  ReaderUIState,
  ReaderUITransition,
} from 'reader_ui_runtime';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import type { JsonObject } from '../../bridge/core/sdk/reader_core';
import {
  ForegroundTimerFiredCallback,
} from '../../host/adapters/ForegroundTimerHostAdapter';
import type { TtsCompletionCallback, TtsFailureCallback } from '../../host/adapters/TtsHostAdapter';
import {
  HostForegroundTimerRequest,
  HostTtsSystemStartRequest,
} from '../../host/types';
import {
  ReaderPlaybackChapterContext,
  ReaderPlaybackDomainMapper,
  ReaderPlaybackProgressUpdate,
  ReaderPlaybackQueueSnapshot,
  ReaderPlaybackTtsPlan,
} from './ReaderPlaybackDomainMapper';
import {
  CoreReaderCanonicalLocation,
  ReaderUiState,
} from './ReaderUiState';

export type ReaderPlaybackPilotKind = 'page' | 'tts' | 'auto-page';

export interface ReaderPlaybackCommandHandle {
  readonly requestId: number;
  readonly result: Promise<JsonObject>;
  cancel(): boolean;
}

export interface ReaderPlaybackCoreGateway {
  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number, sourceId?: string, chapterTitle?: string): ReaderPlaybackCommandHandle;
  updateReaderProgress(progress: ReaderPlaybackProgressUpdate): Promise<JsonObject>;
  beginTtsSlice(chapter: JsonObject, content: string, strategy?: string): ReaderPlaybackCommandHandle;
  beginTtsPlay(plan: JsonObject, startSliceIndex?: number): ReaderPlaybackCommandHandle;
  beginTtsStop(chapter: JsonObject): ReaderPlaybackCommandHandle;
  beginTtsNext(chapter: JsonObject): ReaderPlaybackCommandHandle;
  beginTtsReportStatus(chapter: JsonObject, sliceIndex: number,
    status: string): ReaderPlaybackCommandHandle;
}

export class CoreRuntimeReaderPlaybackGateway implements ReaderPlaybackCoreGateway {
  beginReaderLocationResolve(bookId: string, chapterIndex: number, chapterOffset: number,
    chapterProgress: number, viewportWidth: number, viewportHeight: number,
    fontScale: number, sourceId: string = '', chapterTitle: string = ''): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginReaderLocationResolve(
      bookId, chapterIndex, chapterOffset, chapterProgress, viewportWidth, viewportHeight,
      fontScale, sourceId, chapterTitle,
    );
  }

  updateReaderProgress(progress: ReaderPlaybackProgressUpdate): Promise<JsonObject> {
    return CoreRuntime.get().readingProgressUpdate(
      progress.bookId, progress.sourceId, progress.chapterIndex, progress.chapterOffset,
      progress.chapterProgress, progress.locationRevision,
    );
  }

  beginTtsSlice(chapter: JsonObject, content: string,
    strategy: string = 'paragraph-then-sentence'): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginTtsSlice(chapter, content, strategy);
  }

  beginTtsPlay(plan: JsonObject, startSliceIndex: number = 0): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginTtsPlay(plan, startSliceIndex);
  }

  beginTtsStop(chapter: JsonObject): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginTtsStop(chapter);
  }

  beginTtsNext(chapter: JsonObject): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginTtsNext(chapter);
  }

  beginTtsReportStatus(chapter: JsonObject, sliceIndex: number,
    status: string): ReaderPlaybackCommandHandle {
    return CoreRuntime.get().beginTtsReportStatus(chapter, sliceIndex, status);
  }
}

export interface ReaderPlaybackRuntimeGateway {
  currentState(): ReaderUIState;
  providePageLayout(correlationId: string, layout: ReaderUIPageLayout): ReaderUIPlaybackTransition;
  acceptPageLocationResult(correlationId: string, canonicalLocation?: string,
    pageIndex?: number, error?: string): ReaderUIPlaybackTransition;
  acceptPageLocationJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition;
  acceptPageProgressResult(correlationId: string, stored?: boolean,
    error?: string): ReaderUIPlaybackTransition;
  acceptPageProgressJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition;
  cancelPageStep(correlationId: string): ReaderUIPlaybackTransition;
  acceptTTSCoreResult(coreType: string, correlationId: string,
    error?: string): ReaderUIPlaybackTransition;
  acceptTTSCoreJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition;
  acceptTTSSystemStart(correlationId: string, error?: string): ReaderUIPlaybackTransition;
  acceptTTSSystemStartJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition;
  stopTTS(correlationId?: string): ReaderUIPlaybackTransition;
  acceptAutoPageTimerFired(correlationId: string, generation: number): ReaderUIPlaybackTransition;
  stopAutoPage(correlationId?: string): ReaderUIPlaybackTransition;
  suspendAutoPageForBackground(correlationId?: string): ReaderUIPlaybackTransition;
  completeAsync(error?: string): ReaderUIState;
}

export interface ReaderPlaybackPilotHost {
  nativeState(): ReaderUiState;
  applyRuntimeState(runtimeState: ReaderUIState): void;
  commitCanonicalLocation(location: CoreReaderCanonicalLocation, pageIndex: number): void;
  applyQueueSnapshot(snapshot: ReaderPlaybackQueueSnapshot): void;
}

export interface ReaderPlaybackPlatformGateway {
  startSpeech(request: HostTtsSystemStartRequest, callback: TtsCompletionCallback,
    failureCallback: TtsFailureCallback): Promise<boolean>;
  stopSpeech(): Promise<boolean>;
  armTimer(request: HostForegroundTimerRequest, callback: ForegroundTimerFiredCallback): boolean;
  cancelTimer(request: HostForegroundTimerRequest): boolean;
  cancelAllTimers(): void;
}

export class HarmonyReaderPlaybackPlatformGateway implements ReaderPlaybackPlatformGateway {
  startSpeech(request: HostTtsSystemStartRequest, callback: TtsCompletionCallback,
    failureCallback: TtsFailureCallback): Promise<boolean> {
    const adapter = CoreRuntime.get().getTtsAdapter();
    adapter.setCompletionCallback(callback);
    adapter.setFailureCallback(failureCallback);
    return adapter.start(request).then((response): boolean => response.started);
  }

  stopSpeech(): Promise<boolean> {
    if (!CoreRuntime.isInitialized()) return Promise.resolve(true);
    const adapter = CoreRuntime.get().getTtsAdapter();
    // Completion callbacks are invalidated before the asynchronous platform
    // stop so a final TextReader event cannot advance a replacement queue.
    adapter.setCompletionCallback(null);
    adapter.setFailureCallback(null);
    return adapter.stop().then((response): boolean => response.acknowledged);
  }

  armTimer(request: HostForegroundTimerRequest, callback: ForegroundTimerFiredCallback): boolean {
    return CoreRuntime.get().getForegroundTimerAdapter().arm(request, callback);
  }

  cancelTimer(request: HostForegroundTimerRequest): boolean {
    return CoreRuntime.get().getForegroundTimerAdapter().cancel(request);
  }

  cancelAllTimers(): void {
    if (CoreRuntime.isInitialized()) CoreRuntime.get().getForegroundTimerAdapter().cancelAll();
  }
}

class ReaderPlaybackPilotContext {
  readonly correlationId: string;
  readonly kind: ReaderPlaybackPilotKind;
  readonly chapter: ReaderPlaybackChapterContext;
  cancelled: boolean = false;
  inFlight?: ReaderPlaybackCommandHandle;
  currentEffect: string = '';
  pageLayout?: ReaderUIPageLayout;
  pendingCanonicalLocation?: CoreReaderCanonicalLocation;
  progressCommitPending: boolean = false;
  plan?: ReaderPlaybackTtsPlan;
  queue?: ReaderPlaybackQueueSnapshot;
  speechGeneration: number = 0;
  articleId: string = '';
  readonly sessionCorrelationId: string;

  constructor(correlationId: string, kind: ReaderPlaybackPilotKind,
    chapter: ReaderPlaybackChapterContext, sessionCorrelationId: string = '') {
    this.correlationId = correlationId;
    this.kind = kind;
    this.chapter = chapter;
    this.sessionCorrelationId = sessionCorrelationId;
  }
}

export interface ReaderPlaybackPilotSnapshot {
  activePageCorrelationId: string;
  activeTtsCorrelationId: string;
  activeAutoPageCorrelationId: string;
  activeRequestId: number;
  executedEffects: number;
  ignoredLateCallbacks: number;
  cancelledCommands: number;
  timerArms: number;
  timerCancels: number;
  speechStarts: number;
}

export class ReaderPlaybackEffectExecutor {
  private readonly runtime: ReaderPlaybackRuntimeGateway;
  private readonly host: ReaderPlaybackPilotHost;
  private readonly core: ReaderPlaybackCoreGateway;
  private readonly platform: ReaderPlaybackPlatformGateway;
  private contexts: Map<string, ReaderPlaybackPilotContext> = new Map<string, ReaderPlaybackPilotContext>();
  private serial: Promise<void> = Promise.resolve();
  private executedEffects: number = 0;
  private ignoredLateCallbacks: number = 0;
  private cancelledCommands: number = 0;
  private timerArms: number = 0;
  private timerCancels: number = 0;
  private speechStarts: number = 0;

  constructor(runtime: ReaderPlaybackRuntimeGateway, host: ReaderPlaybackPilotHost,
    core: ReaderPlaybackCoreGateway = new CoreRuntimeReaderPlaybackGateway(),
    platform: ReaderPlaybackPlatformGateway = new HarmonyReaderPlaybackPlatformGateway()) {
    this.runtime = runtime;
    this.host = host;
    this.core = core;
    this.platform = platform;
  }

  bind(correlationId: string, kind: ReaderPlaybackPilotKind,
    nativeState: ReaderUiState): void {
    if (correlationId.length === 0 || this.contexts.has(correlationId)) {
      throw new Error(`Reader playback Pilot duplicate correlation ${correlationId}`);
    }
    const chapter = ReaderPlaybackDomainMapper.bindChapter(nativeState);
    this.contexts.set(correlationId, new ReaderPlaybackPilotContext(correlationId, kind, chapter));
  }

  discard(correlationId: string): void {
    const context = this.contexts.get(correlationId);
    if (context === undefined) return;
    if (context.inFlight !== undefined && context.inFlight.cancel()) this.cancelledCommands += 1;
    this.contexts.delete(correlationId);
  }

  consume(transition: ReaderUIPlaybackTransition): Promise<void> {
    this.applyTransitionState(transition);
    const effects = transition.effects.slice();
    this.cleanupCancelledWithoutEffects(transition.cancelledCorrelationIds, effects);
    this.serial = this.serial.then((): Promise<void> => this.executeEffects(effects))
      .catch((error: Error): void => {
        console.info(`[ReaderPlaybackPilot] serialized effect failure: ${error.message}`);
      });
    return this.serial;
  }

  consumeDispatch(transition: ReaderUITransition): Promise<void> {
    this.applyRuntimeTransition(transition.state, transition.cancelledCorrelationIds);
    const effects = transition.effects.slice();
    this.cleanupCancelledWithoutEffects(transition.cancelledCorrelationIds, effects);
    this.serial = this.serial.then((): Promise<void> => this.executeEffects(effects))
      .catch((error: Error): void => {
        console.info(`[ReaderPlaybackPilot] serialized dispatch failure: ${error.message}`);
      });
    return this.serial;
  }

  provideMeasuredPageLayout(correlationId: string, layout: ReaderUIPageLayout): boolean {
    const context = this.contexts.get(correlationId);
    if (context === undefined || context.cancelled || context.kind !== 'page' ||
      context.inFlight !== undefined || layout.chapterIndex !== context.chapter.chapterIndex ||
      layout.anchor.length === 0) return false;
    const currentIndex = this.host.nativeState().readerPageIndex;
    const transaction = this.runtime.currentState().pageTransaction;
    if (transaction === undefined || transaction.correlationId !== correlationId) return false;
    const expectedTarget = transaction.direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (layout.targetPageIndex !== expectedTarget || expectedTarget < 0) return false;
    context.pageLayout = layout;
    let transition: ReaderUIPlaybackTransition;
    try {
      transition = this.runtime.providePageLayout(correlationId, layout);
    } catch (error) {
      return false;
    }
    if (!transition.accepted) return false;
    this.consume(transition);
    return true;
  }

  rejectPageProposal(correlationId: string, message: string): boolean {
    const context = this.contexts.get(correlationId);
    if (context === undefined || context.cancelled || context.kind !== 'page') return false;
    const cancelled = this.runtime.cancelPageStep(correlationId);
    if (!cancelled.accepted) return false;
    this.applyTransitionState(cancelled);
    this.contexts.delete(correlationId);
    if (context.sessionCorrelationId.length > 0) {
      const stopped = this.runtime.stopAutoPage(context.sessionCorrelationId);
      if (stopped.accepted) this.consume(stopped);
    }
    this.host.applyRuntimeState(this.runtime.completeAsync(message));
    return true;
  }

  suspendAutoPageForBackground(): Promise<void> {
    const correlationId = this.activeCorrelation('auto-page');
    if (correlationId.length === 0) {
      this.platform.cancelAllTimers();
      return Promise.resolve();
    }
    const transition = this.runtime.suspendAutoPageForBackground(correlationId);
    this.platform.cancelAllTimers();
    return transition.accepted ? this.consume(transition) : Promise.resolve();
  }

  teardownForDestroy(): Promise<void> {
    // A dispatched reader.progress.update is the durable commit boundary and
    // cannot be cancelled or made stale. Wait for the serialized terminal
    // callback before invalidating any remaining TTS/timer/page contexts.
    const pending = this.serial;
    return pending.then((): Promise<void> => this.teardownContexts())
      .catch((): Promise<void> => this.teardownContexts());
  }

  private teardownContexts(): Promise<void> {
    this.platform.cancelAllTimers();
    const ids = Array.from(this.contexts.keys());
    let hasTtsContext = false;
    this.contexts.forEach((context: ReaderPlaybackPilotContext): void => {
      if (context.kind === 'tts') hasTtsContext = true;
    });
    for (let index = 0; index < ids.length; index += 1) this.invalidate(ids[index]);
    if (!hasTtsContext) return Promise.resolve();
    return this.platform.stopSpeech().then((): void => {}).catch((): void => {});
  }

  whenIdle(): Promise<void> {
    return this.serial;
  }

  snapshot(): ReaderPlaybackPilotSnapshot {
    let activeRequestId = 0;
    this.contexts.forEach((context: ReaderPlaybackPilotContext): void => {
      if (context.inFlight !== undefined) activeRequestId = context.inFlight.requestId;
    });
    return {
      activePageCorrelationId: this.activeCorrelation('page'),
      activeTtsCorrelationId: this.activeCorrelation('tts'),
      activeAutoPageCorrelationId: this.activeCorrelation('auto-page'),
      activeRequestId: activeRequestId,
      executedEffects: this.executedEffects,
      ignoredLateCallbacks: this.ignoredLateCallbacks,
      cancelledCommands: this.cancelledCommands,
      timerArms: this.timerArms,
      timerCancels: this.timerCancels,
      speechStarts: this.speechStarts,
    };
  }

  private applyTransitionState(transition: ReaderUIPlaybackTransition): void {
    this.applyRuntimeTransition(transition.state, transition.cancelledCorrelationIds);
  }

  private applyRuntimeTransition(state: ReaderUIState, cancelledCorrelationIds: string[]): void {
    for (let index = 0; index < cancelledCorrelationIds.length; index += 1) {
      this.invalidate(cancelledCorrelationIds[index]);
    }
    this.host.applyRuntimeState(state);
  }

  private invalidate(correlationId: string): void {
    const context = this.contexts.get(correlationId);
    if (context === undefined) return;
    context.cancelled = true;
    context.speechGeneration += 1;
    context.articleId = '';
    if (context.inFlight !== undefined && context.inFlight.cancel()) this.cancelledCommands += 1;
    context.inFlight = undefined;
    // Page cancellation has no teardown effect. TTS/auto-page contexts retain
    // typed chapter/generation data until their emitted stop/cancel effects run.
    if (context.kind === 'page') this.contexts.delete(correlationId);
  }

  private cleanupCancelledWithoutEffects(cancelledCorrelationIds: string[],
    effects: ReaderUIEffect[]): void {
    for (let cancelledIndex = 0; cancelledIndex < cancelledCorrelationIds.length; cancelledIndex += 1) {
      const correlationId = cancelledCorrelationIds[cancelledIndex];
      const context = this.contexts.get(correlationId);
      if (context === undefined || !context.cancelled) continue;
      let hasTeardown = false;
      for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
        if ((effects[effectIndex].correlationId ?? '') === correlationId) {
          hasTeardown = true;
          break;
        }
      }
      if (!hasTeardown) this.contexts.delete(correlationId);
    }
  }

  private async executeEffects(effects: ReaderUIEffect[]): Promise<void> {
    for (let index = 0; index < effects.length; index += 1) {
      await this.executeEffect(effects[index]);
    }
  }

  private async executeEffect(effect: ReaderUIEffect): Promise<void> {
    const correlationId = effect.correlationId ?? '';
    const context = this.contexts.get(correlationId);
    if (context === undefined) {
      this.ignoredLateCallbacks += 1;
      return;
    }
    this.executedEffects += 1;
    context.currentEffect = effect.type;
    switch (effect.type) {
      case 'reader.location.resolve':
        await this.executeLocation(context);
        return;
      case 'reader.progress.update':
        await this.executeProgress(context, effect);
        return;
      case 'tts.queue.plan':
        await this.executeTtsPlan(context);
        return;
      case 'tts.queue.start':
        await this.executeTtsPlay(context);
        return;
      case 'tts.system.start':
        await this.executeSpeechStart(context, true);
        return;
      case 'tts.system.stop':
        await this.executeSpeechStop(context);
        return;
      case 'tts.queue.stop':
        await this.executeTtsStop(context);
        return;
      case 'timer.foreground.arm':
        this.executeTimerArm(context, effect);
        return;
      case 'timer.foreground.cancel':
        this.executeTimerCancel(context, effect);
        return;
      default:
        await this.failEffect(context, effect.type, `unsupported playback effect ${effect.type}`);
    }
  }

  private async executeLocation(context: ReaderPlaybackPilotContext): Promise<void> {
    const layout = context.pageLayout;
    if (layout === undefined || context.cancelled) return;
    const handle = this.core.beginReaderLocationResolve(
      context.chapter.bookId, context.chapter.chapterIndex, layout.chapterOffset,
      layout.chapterProgress, layout.viewportWidth, layout.viewportHeight, layout.fontScale,
      context.chapter.sourceId, context.chapter.chapterTitle,
    );
    context.inFlight = handle;
    let data: JsonObject;
    try {
      data = await handle.result;
    } catch (error) {
      if (!this.liveContext(context)) return;
      context.inFlight = undefined;
      const transition = this.runtime.acceptPageLocationJSONResult(
        context.correlationId, { 'error': this.errorMessage(error) },
      );
      this.contexts.delete(context.correlationId);
      if (transition.accepted) {
        this.applyTransitionState(transition);
        await this.executeEffects(transition.effects);
      }
      if (context.sessionCorrelationId.length > 0 &&
        this.runtime.currentState().autoPageTransaction === undefined) {
        this.contexts.delete(context.sessionCorrelationId);
      }
      return;
    }
    if (!this.live(context, handle)) return;
    context.inFlight = undefined;
    try {
      const location = ReaderPlaybackDomainMapper.mapLocation(data, context.chapter, layout.chapterOffset);
      const transition = this.runtime.acceptPageLocationJSONResult(context.correlationId, {
        'canonicalLocation': location.locationRevision,
        'pageIndex': layout.targetPageIndex,
      });
      if (!transition.accepted) {
        this.ignoredLateCallbacks += 1;
        return;
      }
      context.pendingCanonicalLocation = location;
      this.applyTransitionState(transition);
      await this.executeEffects(transition.effects);
    } catch (error) {
      if (!this.liveContext(context)) return;
      const transition = this.runtime.acceptPageLocationJSONResult(
        context.correlationId, { 'error': this.errorMessage(error) },
      );
      this.contexts.delete(context.correlationId);
      if (transition.accepted) this.applyTransitionState(transition);
      if (context.sessionCorrelationId.length > 0 &&
        this.runtime.currentState().autoPageTransaction === undefined) {
        this.contexts.delete(context.sessionCorrelationId);
      }
    }
  }

  private async executeProgress(context: ReaderPlaybackPilotContext,
    effect: ReaderUIEffect): Promise<void> {
    if (context.cancelled || context.progressCommitPending) {
      this.ignoredLateCallbacks += 1;
      return;
    }
    const layout = context.pageLayout;
    const location = context.pendingCanonicalLocation;
    context.progressCommitPending = true;
    try {
      if (layout === undefined || location === undefined) {
        throw new Error('reader.progress.update requires pending page layout and canonical location');
      }
      const progress = ReaderPlaybackDomainMapper.bindProgressUpdate(
        effect.jsonPayload ?? {}, context.chapter, layout, location,
      );
      const data = await this.core.updateReaderProgress(progress);
      if (!this.liveContext(context)) {
        this.ignoredLateCallbacks += 1;
        return;
      }
      const result = ReaderPlaybackDomainMapper.mapProgressResult(data, progress);
      const transition = this.runtime.acceptPageProgressJSONResult(context.correlationId, result);
      if (!transition.accepted) {
        this.ignoredLateCallbacks += 1;
        this.contexts.delete(context.correlationId);
        return;
      }
      context.progressCommitPending = false;
      this.applyTransitionState(transition);
      this.host.commitCanonicalLocation(location, layout.targetPageIndex);
      this.contexts.delete(context.correlationId);
      await this.executeEffects(transition.effects);
    } catch (error) {
      if (!this.liveContext(context)) return;
      context.progressCommitPending = false;
      const transition = this.runtime.acceptPageProgressJSONResult(
        context.correlationId, { 'error': this.errorMessage(error) },
      );
      this.contexts.delete(context.correlationId);
      if (transition.accepted) {
        this.applyTransitionState(transition);
        await this.executeEffects(transition.effects);
      }
      if (context.sessionCorrelationId.length > 0 &&
        this.runtime.currentState().autoPageTransaction === undefined) {
        this.contexts.delete(context.sessionCorrelationId);
      }
    }
  }

  private async executeTtsPlan(context: ReaderPlaybackPilotContext): Promise<void> {
    if (context.cancelled) return;
    const handle = this.core.beginTtsSlice(context.chapter.chapter, context.chapter.content);
    context.inFlight = handle;
    try {
      const data = await handle.result;
      if (!this.live(context, handle)) return;
      context.inFlight = undefined;
      context.plan = ReaderPlaybackDomainMapper.mapTtsPlan(data, context.chapter);
      const transition = this.runtime.acceptTTSCoreJSONResult(
        'tts.queue.plan', context.correlationId, {},
      );
      if (!transition.accepted) return;
      this.applyTransitionState(transition);
      await this.executeEffects(transition.effects);
    } catch (error) {
      await this.failTtsStage(context, 'tts.queue.plan', error);
    }
  }

  private async executeTtsPlay(context: ReaderPlaybackPilotContext): Promise<void> {
    if (context.cancelled || context.plan === undefined) return;
    const handle = this.core.beginTtsPlay(context.plan.raw, 0);
    context.inFlight = handle;
    try {
      const data = await handle.result;
      if (!this.live(context, handle)) return;
      context.inFlight = undefined;
      context.queue = ReaderPlaybackDomainMapper.mapQueueSnapshot(data, context.plan.slices.length);
      this.host.applyQueueSnapshot(context.queue);
      const transition = this.runtime.acceptTTSCoreJSONResult(
        'tts.queue.start', context.correlationId, {},
      );
      if (!transition.accepted) return;
      this.applyTransitionState(transition);
      await this.executeEffects(transition.effects);
    } catch (error) {
      await this.failTtsStage(context, 'tts.queue.start', error);
    }
  }

  private async executeSpeechStart(context: ReaderPlaybackPilotContext,
    notifyRuntime: boolean): Promise<void> {
    if (context.cancelled || context.plan === undefined || context.queue === undefined) return;
    const sliceIndex = context.queue.currentSliceIndex;
    if (sliceIndex < 0 || sliceIndex >= context.plan.slices.length) {
      await this.failTtsSystemStart(context, 'Core TTS queue cursor is outside the plan');
      return;
    }
    context.speechGeneration += 1;
    const generation = context.speechGeneration;
    const articleId = `${context.correlationId}:g${generation}:s${sliceIndex}`;
    context.articleId = articleId;
    const request: HostTtsSystemStartRequest = {
      text: context.plan.slices[sliceIndex].text,
      rate: this.host.nativeState().ttsSession.rate,
      voice: this.host.nativeState().ttsSession.voice,
      articleId: articleId,
      correlationId: context.correlationId,
      generation: generation,
      sliceIndex: sliceIndex,
    };
    const callback: TtsCompletionCallback =
      (completedArticleId: string, correlationId: string, completedGeneration: number,
        completedSliceIndex: number): void => {
        this.onSpeechCompleted(
          completedArticleId, correlationId, completedGeneration, completedSliceIndex,
        );
      };
    const failureCallback: TtsFailureCallback =
      (failedArticleId: string, correlationId: string, failedGeneration: number,
        failedSliceIndex: number, message: string): void => {
        this.onSpeechFailed(
          failedArticleId, correlationId, failedGeneration, failedSliceIndex, message,
        );
      };
    try {
      const started = await this.platform.startSpeech(request, callback, failureCallback);
      if (!this.liveContext(context) || context.speechGeneration !== generation ||
        context.articleId !== articleId) return;
      if (!started) {
        await this.failTtsSystemStart(context, 'Harmony TTS Host did not start the slice');
        return;
      }
      this.speechStarts += 1;
      if (notifyRuntime) {
        const transition = this.runtime.acceptTTSSystemStartJSONResult(
          context.correlationId, { 'started': true },
        );
        if (transition.accepted) this.applyTransitionState(transition);
      }
    } catch (error) {
      await this.failTtsSystemStart(context, this.errorMessage(error));
    }
  }

  private async executeSpeechStop(context: ReaderPlaybackPilotContext): Promise<void> {
    context.speechGeneration += 1;
    context.articleId = '';
    try {
      await this.platform.stopSpeech();
    } catch (error) {
      // Teardown is terminal and best-effort. Core stop still runs next.
    }
  }

  private async executeTtsStop(context: ReaderPlaybackPilotContext): Promise<void> {
    const handle = this.core.beginTtsStop(context.chapter.chapter);
    context.inFlight = handle;
    try {
      const data = await handle.result;
      context.inFlight = undefined;
      if (context.plan !== undefined) {
        context.queue = ReaderPlaybackDomainMapper.mapQueueSnapshot(data, context.plan.slices.length);
        this.host.applyQueueSnapshot(context.queue);
      }
    } catch (error) {
      context.inFlight = undefined;
    }
    this.contexts.delete(context.correlationId);
  }

  private executeTimerArm(context: ReaderPlaybackPilotContext, effect: ReaderUIEffect): void {
    if (context.cancelled) return;
    const request = this.timerRequest(effect);
    const callback: ForegroundTimerFiredCallback =
      (_timerId: string, correlationId: string, generation: number): void => {
        this.onTimerFired(correlationId, generation);
      };
    if (!this.platform.armTimer(request, callback)) {
      const transition = this.runtime.stopAutoPage(context.correlationId);
      if (transition.accepted) this.consume(transition);
      return;
    }
    this.timerArms += 1;
  }

  private executeTimerCancel(context: ReaderPlaybackPilotContext, effect: ReaderUIEffect): void {
    const request = this.timerRequest(effect);
    this.platform.cancelTimer(request);
    this.timerCancels += 1;
    this.contexts.delete(context.correlationId);
  }

  private onTimerFired(correlationId: string, generation: number): void {
    const autoContext = this.contexts.get(correlationId);
    if (autoContext === undefined || autoContext.cancelled || autoContext.kind !== 'auto-page') {
      this.ignoredLateCallbacks += 1;
      return;
    }
    const transition = this.runtime.acceptAutoPageTimerFired(correlationId, generation);
    if (!transition.accepted || transition.state.pageTransaction === undefined) {
      this.ignoredLateCallbacks += 1;
      return;
    }
    const pageCorrelation = transition.state.pageTransaction.correlationId;
    this.contexts.set(
      pageCorrelation,
      new ReaderPlaybackPilotContext(pageCorrelation, 'page', autoContext.chapter, correlationId),
    );
    this.consume(transition);
  }

  private onSpeechCompleted(articleId: string, correlationId: string,
    generation: number, sliceIndex: number): void {
    const context = this.contexts.get(correlationId);
    if (context === undefined || context.cancelled || context.kind !== 'tts' ||
      context.articleId !== articleId || context.speechGeneration !== generation ||
      context.queue === undefined || context.queue.currentSliceIndex !== sliceIndex) {
      this.ignoredLateCallbacks += 1;
      return;
    }
    // Invalidate this article before queueing work; duplicate platform done
    // callbacks cannot enqueue a second report-status/next chain.
    context.articleId = '';
    this.serial = this.serial.then((): Promise<void> => this.advanceAfterSpeech(context, generation, sliceIndex))
      .catch((error: Error): void => {
        console.info(`[ReaderPlaybackPilot] speech completion failure: ${error.message}`);
      });
  }

  private onSpeechFailed(articleId: string, correlationId: string,
    generation: number, sliceIndex: number, message: string): void {
    const context = this.contexts.get(correlationId);
    if (context === undefined || context.cancelled || context.kind !== 'tts' ||
      context.articleId !== articleId || context.speechGeneration !== generation ||
      context.queue === undefined || context.queue.currentSliceIndex !== sliceIndex) {
      this.ignoredLateCallbacks += 1;
      return;
    }
    context.articleId = '';
    this.serial = this.serial.then(
      (): Promise<void> => this.failAfterSpeech(context, generation, sliceIndex, message),
    ).catch((error: Error): void => {
      console.info(`[ReaderPlaybackPilot] speech failure cleanup error: ${error.message}`);
    });
  }

  private async failAfterSpeech(context: ReaderPlaybackPilotContext,
    generation: number, sliceIndex: number, message: string): Promise<void> {
    if (!this.liveContext(context) || context.speechGeneration !== generation) return;
    const report = this.core.beginTtsReportStatus(context.chapter.chapter, sliceIndex, 'failed');
    context.inFlight = report;
    try {
      await report.result;
    } catch (error) {
      // A failed status report must not prevent terminal Host/Core teardown.
    }
    if (!this.live(context, report)) return;
    context.inFlight = undefined;
    const stopped = this.runtime.stopTTS(context.correlationId);
    if (stopped.accepted) {
      this.applyTransitionState(stopped);
      await this.executeEffects(stopped.effects);
    }
    this.host.applyRuntimeState(this.runtime.completeAsync(
      message.length > 0 ? message : 'Harmony TTS speech failed',
    ));
  }

  private async advanceAfterSpeech(context: ReaderPlaybackPilotContext,
    generation: number, sliceIndex: number): Promise<void> {
    if (!this.liveContext(context) || context.speechGeneration !== generation || context.plan === undefined) return;
    let handle = this.core.beginTtsReportStatus(context.chapter.chapter, sliceIndex, 'done');
    context.inFlight = handle;
    try {
      await handle.result;
      if (!this.live(context, handle)) return;
      context.inFlight = undefined;
      handle = this.core.beginTtsNext(context.chapter.chapter);
      context.inFlight = handle;
      const nextData = await handle.result;
      if (!this.live(context, handle)) return;
      context.inFlight = undefined;
      context.queue = ReaderPlaybackDomainMapper.mapQueueSnapshot(nextData, context.plan.slices.length);
      this.host.applyQueueSnapshot(context.queue);
      if (context.queue.state === 'completed') {
        // Core next must reach Completed even for the final slice; only then do
        // shared-runtime teardown effects stop platform speech and Core queue.
        const stop = this.runtime.stopTTS(context.correlationId);
        if (stop.accepted) {
          this.applyTransitionState(stop);
          await this.executeEffects(stop.effects);
        }
        return;
      }
      if (context.queue.state !== 'playing') {
        throw new Error(`Core TTS next returned ${context.queue.state}`);
      }
      await this.executeSpeechStart(context, false);
    } catch (error) {
      context.inFlight = undefined;
      await this.failTtsSystemStart(context, this.errorMessage(error));
    }
  }

  private async failTtsStage(context: ReaderPlaybackPilotContext,
    coreType: string, error: Object): Promise<void> {
    if (!this.liveContext(context)) return;
    context.inFlight = undefined;
    const transition = this.runtime.acceptTTSCoreJSONResult(
      coreType, context.correlationId, { 'error': this.errorMessage(error) },
    );
    if (transition.accepted) {
      this.applyTransitionState(transition);
      await this.executeEffects(transition.effects);
      if (transition.effects.length === 0) this.contexts.delete(context.correlationId);
    }
  }

  private async failTtsSystemStart(context: ReaderPlaybackPilotContext,
    message: string): Promise<void> {
    if (!this.liveContext(context)) return;
    const transition = this.runtime.acceptTTSSystemStartJSONResult(
      context.correlationId, { 'error': message },
    );
    if (transition.accepted) {
      this.applyTransitionState(transition);
      await this.executeEffects(transition.effects);
      if (transition.effects.length === 0) this.contexts.delete(context.correlationId);
    }
  }

  private async failEffect(context: ReaderPlaybackPilotContext,
    type: string, message: string): Promise<void> {
    if (type === 'reader.location.resolve') {
      const transition = this.runtime.acceptPageLocationJSONResult(
        context.correlationId, { 'error': message },
      );
      this.contexts.delete(context.correlationId);
      if (transition.accepted) this.applyTransitionState(transition);
      if (context.sessionCorrelationId.length > 0 &&
        this.runtime.currentState().autoPageTransaction === undefined) {
        this.contexts.delete(context.sessionCorrelationId);
      }
      return;
    }
    if (type === 'reader.progress.update') {
      const transition = this.runtime.acceptPageProgressJSONResult(
        context.correlationId, { 'error': message },
      );
      this.contexts.delete(context.correlationId);
      if (transition.accepted) this.applyTransitionState(transition);
      if (context.sessionCorrelationId.length > 0 &&
        this.runtime.currentState().autoPageTransaction === undefined) {
        this.contexts.delete(context.sessionCorrelationId);
      }
      return;
    }
    await this.failTtsSystemStart(context, message);
  }

  private timerRequest(effect: ReaderUIEffect): HostForegroundTimerRequest {
    const payload: ReaderUIJSONPayload = effect.jsonPayload ?? {};
    const timerIdValue = payload['timerId'];
    const correlationIdValue = payload['correlationId'];
    const delayMsValue = payload['delayMs'];
    const generationValue = payload['generation'];
    const oneShotValue = payload['oneShot'];
    const foregroundOnlyValue = payload['foregroundOnly'];
    return {
      timerId: typeof timerIdValue === 'string' ? timerIdValue : '',
      correlationId: typeof correlationIdValue === 'string' ? correlationIdValue : '',
      delayMs: typeof delayMsValue === 'number' ? delayMsValue : Number.NaN,
      generation: typeof generationValue === 'number' ? generationValue : Number.NaN,
      oneShot: oneShotValue === true,
      foregroundOnly: foregroundOnlyValue === true,
    };
  }

  private live(context: ReaderPlaybackPilotContext,
    handle: ReaderPlaybackCommandHandle): boolean {
    return this.liveContext(context) && context.inFlight === handle;
  }

  private liveContext(context: ReaderPlaybackPilotContext): boolean {
    return !context.cancelled && this.contexts.get(context.correlationId) === context;
  }

  private activeCorrelation(kind: ReaderPlaybackPilotKind): string {
    let result = '';
    this.contexts.forEach((context: ReaderPlaybackPilotContext): void => {
      if (!context.cancelled && context.kind === kind) result = context.correlationId;
    });
    return result;
  }

  private errorMessage(error: Object): string {
    if (error instanceof Error && error.message.length > 0) return error.message;
    return String(error);
  }
}
