import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderTtsCredentialStore } from '../../../platform/tts/ReaderTtsCredentialStore';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import type { LocalReadingLayout, LocalReadingProgress } from '../application/LocalReadingFlowGateway';
import type { ReadingAutomaticSpeech } from '../application/ReadingAuxiliaryFlowBridge';
import type { ReadingChapterWindow, ReadingSessionChapter } from '../application/ReadingChapterWindow';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { ReadingExitSpeech } from '../application/ReadingExitProgressCoordinator';
import { CoreReadingAnchor } from '../application/ReadingMeasurementFacts';
import type { ReaderProgressProducerIntent } from '../application/ReaderProgressProducerHost';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import { admitReaderTtsRate, ReaderTtsPreparation, type ReaderTtsPreparationIntent,
  type ReaderTtsWarmupOwner } from '../application/ReaderTtsConfigAdmission';
import { ReaderTtsConfigurationHost, type ReaderTtsConfigurationDraft,
  type ReaderTtsConfigurationSnapshot } from '../application/ReaderTtsConfigurationHost';
import type { ReaderTtsChapterRef, ReaderTtsConfig } from '../application/ReaderTtsGateway';
import { ReaderTtsPlaybackOwner, type ReaderControlPlaybackPresentation, type ReaderTtsPlaybackCoordinator,
  type ReaderTtsPlaybackPresentation, type ReaderTtsPlaybackScope, type ReaderTtsStartPage } from '../application/ReaderTtsPlaybackOwner';
import { ReaderTtsPreferenceHost, type ReaderTtsPreferenceAdmission } from '../application/ReaderTtsPreferenceHost';
import { ReaderTtsPreferencesGateway } from '../application/ReaderTtsPreferencesGateway';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import type {
  HostTtsTransportState, ReaderTtsChapterAdvanceInput, ReaderTtsChapterAdvanceRange,
  ReaderTtsAuditionReceipt, ReaderTtsProgressCommit, ReaderTtsSessionCoordinator, ReaderTtsStartInput,
} from '../application/ReaderTtsSessionCoordinator';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import {
  createReaderTtsState, readerTtsCoreRateForMultiplier, readerTtsRatePercentForMultiplier,
  READER_TTS_RATE_MAX, READER_TTS_RATE_MIN, READER_TTS_RATE_STEP_SCALE, READER_TTS_TIMER_DEFAULT_MINUTES,
  READER_TTS_TIMER_MAX_MINUTES, READER_TTS_TIMER_MAX_SECONDS, READER_TTS_TIMER_MIN,
  type ReaderTtsState, type ReaderTtsTimerMode,
} from '../application/ReaderTtsState';
import { loadNextReaderTtsChapter, ReaderTtsTransportOwner, type ReaderTtsChapterAdvanceLease }
  from '../application/ReaderTtsTransportOwner';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

export interface ReaderReadingSpeechPresentation {
  readonly ttsState: ReaderTtsState;
  readonly ttsTimerMode: ReaderTtsTimerMode;
  readonly ttsTimerMinutes: number;
  readonly ttsTimerSeconds: number;
  readonly ttsFollowHighlight: boolean;
  readonly ttsPauseOnInterruption: boolean;
  readonly ttsAllowMixing: boolean;
  readonly ttsBackgroundPlayback: boolean;
  readonly ttsKeepScreenOn: boolean;
  readonly ttsFailurePolicy: 'skip' | 'stop';
  readonly ttsEngine: string;
  readonly ttsHttpEngines: ReaderHttpTtsConfig[];
  readonly ttsVoiceOptions: ReaderTtsVoiceOption[];
  readonly ttsLanguage: string;
  readonly ttsPerson: number;
  readonly ttsPreferencesRecovery: ReaderRecoveryView;
  readonly ttsPreferencesRecoveryBusy: boolean;
  readonly ttsConfigurationLoading: boolean;
  readonly ttsConfigurationLoadFailed: boolean;
  readonly ttsConfigurationRecovery: ReaderRecoveryView;
}

export interface ReaderReadingSpeechSession {
  readonly scope: () => ReaderTtsPlaybackScope;
  readonly uiContext: () => UIContext;
  readonly mounted: () => boolean;
  readonly mountedToken: (lifecycle: number) => boolean;
  readonly active: (lifecycle: number) => boolean;
  readonly ready: () => boolean;
  readonly foreground: () => boolean;
  readonly progressAllowed: (lifecycle: number) => boolean;
}

export interface ReaderReadingSpeechView {
  readonly publish: (presentation: ReaderReadingSpeechPresentation) => void;
  readonly applyWindowPolicy: () => Promise<void>;
  readonly observePrefetch: () => void;
  readonly followPage: (state: ReaderTtsState) => void;
  readonly retirePageFollow: () => void;
}

export interface ReaderReadingSpeechProgress {
  readonly chapter: () => ReadingSessionChapter | undefined;
  readonly scalarCount: () => number;
  readonly layout: () => LocalReadingLayout;
  readonly intent: (chapter: ReadingSessionChapter, anchor: CoreReadingAnchor, layout: LocalReadingLayout, current: () => boolean, publish: (stored: LocalReadingProgress) => void) => ReaderProgressProducerIntent;
  readonly commit: (intent: ReaderProgressProducerIntent) => Promise<void>;
  readonly admit: (stored: LocalReadingProgress) => void;
  readonly accepted: () => ReadingCommit | undefined;
}

export interface ReaderReadingSpeechAdvanceSelection {
  readonly sessionGeneration: number;
  readonly positionGeneration: number;
  readonly isCurrent: () => boolean;
  readonly select: (chapterIndex: number, offset: number) => void;
}

export interface ReaderReadingSpeechChapter {
  readonly startPage: () => ReaderTtsStartPage | undefined;
  readonly materializedContentVersion: () => string;
  readonly hydrateEntry: (chapter: ReadingSessionChapter) => Promise<void>;
  readonly window: () => ReadingChapterWindow;
  readonly captureAdvanceSelection: (state: ReaderTtsState) => ReaderReadingSpeechAdvanceSelection;
  readonly continuous: () => boolean;
  readonly hydrateCatalogForNext: (chapterIndex: number) => Promise<void> | undefined;
  readonly nextChapterIndex: (chapterIndex: number) => number | undefined;
  readonly load: (chapterIndex: number, current: () => boolean) => Promise<ReadingSessionChapter>;
  readonly admitContentVersion: (chapter: ReadingSessionChapter) => void;
}

export interface ReaderReadingSpeechControls {
  readonly capsule: ReaderTtsPlaybackPresentation;
  readonly inputAllowed: () => boolean;
  readonly controlVisible: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly chromeOverlayActive: () => boolean;
  readonly preferenceModule: () => string;
  readonly openTtsConfiguration: () => void;
  readonly onSpeechState: (state: ReaderTtsState) => void;
  readonly retireBlockedStarts: () => void;
  readonly retireSpeechCapsule: () => void;
  readonly autoPageActive: () => boolean;
  readonly cancelAutoPageStart: () => void;
  readonly pauseAutoPage: () => void;
  readonly stopAutoPage: () => void;
}

/** Owns one mounted reader's native speech actor, its accepted settings and
 * the exact audible receipt. The page still owns layout, position and gestures. */
export class ReaderReadingSpeechHost {
  private readonly ttsTransport: ReaderTtsTransportOwner = new ReaderTtsTransportOwner();
  private readonly ttsPreparation: ReaderTtsPreparation = new ReaderTtsPreparation();
  private readonly ttsPreferences: ReaderTtsPreferenceHost;
  private readonly ttsPlayback: ReaderTtsPlaybackOwner;
  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly session: ReaderReadingSpeechSession;
  private readonly view: ReaderReadingSpeechView;
  private readonly progress: ReaderReadingSpeechProgress;
  private readonly chapter: ReaderReadingSpeechChapter;
  private readonly controls: ReaderReadingSpeechControls;

  private ttsState: ReaderTtsState = createReaderTtsState(false);
  private ttsTimerMode: ReaderTtsTimerMode = 'duration';
  private ttsTimerMinutes: number = READER_TTS_TIMER_DEFAULT_MINUTES;
  private ttsTimerSeconds: number = 0;
  private ttsFollowHighlight: boolean = true;
  private ttsPauseOnInterruption: boolean = true;
  private ttsAllowMixing: boolean = false;
  private ttsBackgroundPlayback: boolean = true;
  private ttsKeepScreenOn: boolean = false;
  private ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  private ttsEngine: string = 'system';
  private ttsHttpEngines: ReaderHttpTtsConfig[] = [];
  private ttsVoiceOptions: ReaderTtsVoiceOption[] = [];
  private ttsLanguage: string = 'zh-CN';
  private ttsPerson: number = 0;
  private ttsPreferencesRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  private ttsPreferencesRecoveryBusy: boolean = false;
  private ttsConfigurationLoading: boolean = false;
  private ttsConfigurationLoadFailed: boolean = false;
  private ttsConfigurationMetadataFailed: boolean = false;
  private ttsConfigurationRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  private ttsConfig: ReaderTtsConfig | undefined = undefined;
  private ttsConfigurationHost: ReaderTtsConfigurationHost | undefined = undefined;
  private ttsConfigurationNotice: string | undefined = undefined;
  /** Exact durable TTS receipt. A later page or manual commit replaces ownership. */
  private lastTtsCommittedProgress: ReadingCommit | undefined = undefined;
  private lastTtsCommittedChapter: ReadingSessionChapter | undefined = undefined;
  private lastTtsCommittedSelectionToken: number = -1;

  constructor(transientFeedback: ReaderTransientFeedback, session: ReaderReadingSpeechSession,
    view: ReaderReadingSpeechView, progress: ReaderReadingSpeechProgress,
    chapter: ReaderReadingSpeechChapter, controls: ReaderReadingSpeechControls) {
    this.transientFeedback = transientFeedback;
    this.session = session;
    this.view = view;
    this.progress = progress;
    this.chapter = chapter;
    this.controls = controls;
    this.ttsPreferences = new ReaderTtsPreferenceHost(new ReaderTtsPreferencesGateway(ReaderRuntimeOwner.current()), {
      captureOwner: (): (() => boolean) => this.captureTtsPreferenceOwner(),
      voices: (): ReaderTtsVoiceOption[] => this.ttsVoiceOptions,
      publishVoices: (voices: ReaderTtsVoiceOption[]): void => {
        this.ttsVoiceOptions = voices;
        this.publishPresentation();
      },
      admit: (input: ReaderTtsPreferenceAdmission, current: () => boolean): void => this.admitTtsPreferences(input, current),
      notice: (message: string, canRetry: boolean, busy?: boolean): void => this.setPreferenceNotice(message, canRetry, busy),
      log: (stage: string, error: Error): void => this.logTtsFailure(stage, error),
    });
    this.ttsPlayback = new ReaderTtsPlaybackOwner({
      scope: (): ReaderTtsPlaybackScope => this.session.scope(),
      scopeCurrent: (scope: ReaderTtsPlaybackScope): boolean => {
        if (!this.session.active(scope.lifecycleToken)) return false;
        const current = this.session.scope();
        return scope.selectionToken === current.selectionToken &&
          scope.sourceId === current.sourceId && scope.bookId === current.bookId;
      },
      state: (): ReaderTtsState => this.ttsState,
      coordinator: (): ReaderTtsPlaybackCoordinator | undefined => this.ttsTransport.coordinator,
      inputAllowed: (): boolean => this.controls.inputAllowed(),
      retireBlockedStarts: (): void => this.controls.retireBlockedStarts(),
      cancelAutoPageStart: (): void => this.controls.cancelAutoPageStart(),
      stopAutoPage: (): void => this.controls.stopAutoPage(),
      initialize: (lifecycle: number, retry: boolean): Promise<boolean> => this.initializeTtsSession(lifecycle, retry),
      startPage: (): ReaderTtsStartPage | undefined => this.chapter.startPage(),
      hydrateEntry: (chapter: ReadingSessionChapter): Promise<void> => this.chapter.hydrateEntry(chapter),
      startInput: (page: ReaderTtsStartPage): ReaderTtsStartInput => this.ttsStartInput(page),
      logFailure: (operation: string, error: Error): void => this.logTtsFailure(operation, error),
    }, this.controls.capsule, this.ttsPreparation);
  }

  presentation(): ReaderReadingSpeechPresentation {
    return {
      ttsState: this.ttsState,
      ttsTimerMode: this.ttsTimerMode,
      ttsTimerMinutes: this.ttsTimerMinutes,
      ttsTimerSeconds: this.ttsTimerSeconds,
      ttsFollowHighlight: this.ttsFollowHighlight,
      ttsPauseOnInterruption: this.ttsPauseOnInterruption,
      ttsAllowMixing: this.ttsAllowMixing,
      ttsBackgroundPlayback: this.ttsBackgroundPlayback,
      ttsKeepScreenOn: this.ttsKeepScreenOn,
      ttsFailurePolicy: this.ttsFailurePolicy,
      ttsEngine: this.ttsEngine,
      ttsHttpEngines: this.ttsHttpEngines,
      ttsVoiceOptions: this.ttsVoiceOptions,
      ttsLanguage: this.ttsLanguage,
      ttsPerson: this.ttsPerson,
      ttsPreferencesRecovery: this.ttsPreferencesRecovery,
      ttsPreferencesRecoveryBusy: this.ttsPreferencesRecoveryBusy,
      ttsConfigurationLoading: this.ttsConfigurationLoading,
      ttsConfigurationLoadFailed: this.ttsConfigurationLoadFailed,
      ttsConfigurationRecovery: this.ttsConfigurationRecovery,
    };
  }

  private publishPresentation(): void {
    this.view.publish(this.presentation());
  }

  /** Run in the original aboutToAppear slots. The preparation queue resets
   * after chapter presentation and independently from the speech projection. */
  beginMount(): void {
    this.ttsPreferences.retireChoiceObservations();
    this.ttsState = createReaderTtsState(false);
    this.publishPresentation();
  }

  resetPreparation(): void {
    this.ttsPreparation.reset();
  }

  /** Revoke the native publishing session before other reader resources retire.
   * The caller invokes disposal at its original point in teardown. */
  detach(): (() => void) | undefined {
    const coordinator = this.ttsTransport.coordinator;
    this.ttsConfigurationHost?.retire();
    this.ttsConfigurationHost = undefined;
    this.ttsConfigurationNotice = undefined;
    this.ttsTransport.detach();
    this.ttsPreparation.reset();
    return coordinator === undefined ? undefined : (): void => { void coordinator.dispose(); };
  }

  isAttached(): boolean { return this.ttsTransport.coordinator !== undefined; }
  isPrepared(): boolean { return this.ttsPreparation.resolved(); }
  startPending(): boolean { return this.ttsPlayback.startPending(); }
  cancelPending(): void { this.ttsPlayback.cancelPending(); }
  clearResumePresentation(): void { this.ttsPlayback.clearResumePresentation(); }

  acknowledgeResume(state: ReaderTtsState, capsuleAbsent: () => boolean): ReaderControlPlaybackPresentation | undefined {
    return this.ttsPlayback.acknowledgeResume(state, capsuleAbsent);
  }

  setDesiredPlaying(desired: boolean): void { this.ttsTransport.coordinator?.setDesiredPlaying(desired); }

  transportState(): HostTtsTransportState | undefined { return this.ttsTransport.coordinator?.getTransportState(); }

  automaticSpeech(): ReadingAutomaticSpeech | undefined { return this.ttsTransport.coordinator; }

  automaticSpeechCurrent(speech: ReadingAutomaticSpeech | undefined, speechGeneration: number): boolean {
    return this.ttsTransport.coordinator === speech && this.ttsState.sessionGeneration === speechGeneration;
  }

  interruptForContentChange(stopTts: boolean): void {
    const coordinator = this.ttsTransport.coordinator;
    if (stopTts && coordinator !== undefined) {
      void coordinator.stop('contentChanged').catch((error: Error): void => this.logTtsFailure('content stop', error));
    }
  }

  exitSpeech(): ReadingExitSpeech | undefined {
    const speech = this.ttsTransport.coordinator;
    return speech === undefined ? undefined : {
      capture: (): ReaderTtsProgressCommit | undefined => speech.captureCompletedProgress(),
      stop: (): Promise<void> => speech.stop('lifecycle'),
    };
  }

  ttsOwnsPosition(committed: ReadingCommit | undefined, chapter: ReadingSessionChapter, selectionToken: number): boolean {
    return this.lastTtsCommittedProgress !== undefined && this.lastTtsCommittedProgress === committed &&
      this.lastTtsCommittedChapter === chapter && this.lastTtsCommittedSelectionToken === selectionToken;
  }

  pauseForBackground(current: () => boolean): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) return;
    const pause = (): void => {
      if (!current() || !this.session.mounted() || this.session.foreground() || this.ttsTransport.coordinator !== coordinator) return;
      void coordinator.pauseForBackground().catch((error: Error): void => this.logTtsFailure('background pause', error));
    };
    const host = ReaderRuntimeOwner.current().getTtsHost();
    if (!this.ttsBackgroundPlayback) pause();
    else if (!host.isBackgroundPlaybackActive()) {
      // Optional platform admission is off the speech-critical path. A
      // quick lock-screen transition must observe its bounded result.
      void host.waitForBackgroundPlaybackAdmission().then((admitted: boolean): void => {
        if (!this.ttsBackgroundPlayback || !admitted) pause();
      }).catch((error: Error): void => {
        this.logTtsFailure('background admission', error);
        pause();
      });
    }
  }

  retryPreferences(generation: number): void {
    const view = this.ttsPreferencesRecovery;
    if (!view.canRetry || view.generation !== generation || !this.session.active(this.session.scope().lifecycleToken)) return;
    this.setPreferenceNotice('正在核对并保存朗读设置…', false, true);
    this.ttsPreferences.retryPending();
  }

  private setPreferenceNotice(message: string, canRetry: boolean, busy: boolean = false): void {
    this.ttsPreferencesRecovery = {
      message, visible: message.length > 0, canRetry, generation: this.ttsPreferencesRecovery.generation + 1,
    };
    this.ttsPreferencesRecoveryBusy = busy;
    this.publishPresentation();
  }

  scheduleTtsPresentationWarmup(): void {
    if (!this.session.active(this.session.scope().lifecycleToken) || !this.session.ready()) return;
    this.ttsPreparation.scheduleWarmup(this.ttsTransport.coordinator !== undefined, (): ReaderTtsWarmupOwner => {
      const scope = this.session.scope();
      return {
        postFrame: (callback: () => void): void => this.session.uiContext().postFrameCallback(new ReaderUIFrameCallback(callback)),
        isMounted: (): boolean => this.session.mountedToken(scope.lifecycleToken) && this.sameBook(scope),
        isReady: (): boolean => this.session.active(scope.lifecycleToken) && this.session.ready(),
        initialize: (): Promise<boolean> => this.initializeTtsSession(scope.lifecycleToken),
      };
    });
  }

  initializeTtsSession(lifecycleToken: number, retry: boolean = false): Promise<boolean> {
    return this.ttsPreparation.initialize(retry, (): boolean => this.session.active(lifecycleToken),
      (): ReaderTtsPreparationIntent => this.bindTtsPreparation(lifecycleToken));
  }

  private bindTtsPreparation(lifecycleToken: number): ReaderTtsPreparationIntent {
    const scope = this.session.scope();
    const isOwnerCurrent = (): boolean => this.session.active(lifecycleToken) &&
      this.sameBook(scope);
    const owner = ReaderRuntimeOwner.current();
    const coordinator = this.ttsTransport.attach(owner, {
      current: isOwnerCurrent,
      commitProgress: async (progress: ReaderTtsProgressCommit): Promise<void> => this.commitTtsProgress(progress, lifecycleToken),
      publishState: (state: ReaderTtsState): void => this.publishTtsState(state),
      advanceChapter: async (chapter: ReaderTtsChapterRef): Promise<ReaderTtsChapterAdvanceInput | undefined> =>
        this.loadNextTtsChapter(chapter, lifecycleToken),
      changeRate: (rate: number): void => this.changeTtsRate(rate),
      autoPageActive: (): boolean => this.controls.autoPageActive(),
      userPaused: (): boolean => this.ttsState.pauseReason === 'user',
      stopAutoPage: (): void => this.controls.stopAutoPage(),
    });
    this.requireTtsConfigurationHost();
    return {
      probe: coordinator,
      isCurrent: (): boolean => isOwnerCurrent() && this.ttsTransport.coordinator === coordinator,
      loadMetadata: (): Promise<void> => this.loadTtsPresentationMetadata(owner, coordinator, lifecycleToken),
      admitConfig: (config: ReaderTtsConfig | undefined): void => {
        this.ttsConfig = config;
        this.ttsEngine = config?.engine ?? 'system';
        this.publishPresentation();
        this.ttsConfigurationHost?.admitInitialConfig(config);
      },
      reportFailure: (stage: 'initial-rate' | 'initialization', error: Error): void => this.logTtsFailure(stage, error),
    };
  }

  private publishTtsState(state: ReaderTtsState): void {
    const wasAwake = this.ttsWindowAwakeRequested();
    this.ttsState = state;
    this.publishPresentation();
    this.view.observePrefetch();
    this.reconcileTtsWindowAwake(wasAwake);
    this.view.followPage(state);
    this.controls.onSpeechState(state);
  }

  private loadTtsPresentationMetadata(owner: ReaderRuntimeOwner, coordinator: ReaderTtsSessionCoordinator,
    lifecycleToken: number): Promise<void> {
    const scope = this.session.scope();
    const isCurrent = (): boolean => this.session.active(lifecycleToken) && this.ttsTransport.coordinator === coordinator &&
      this.sameBook(scope);
    return this.ttsPreferences.refreshMetadata(isCurrent,
      (): Promise<void> => this.requireTtsConfigurationHost().refreshMetadata(),
      (): Promise<ReaderTtsVoiceOption[]> => owner.getTtsHost().listSystemVoices(),
      (message: string): void => hilog.error(0x5244, 'Reader', '%{private}s', message));
  }

  private admitTtsPreferences(input: ReaderTtsPreferenceAdmission, current: () => boolean): void {
    const preferences = input.preferences;
    const wasAwake = this.ttsWindowAwakeRequested();
    const followedHighlight = this.ttsFollowHighlight;
    const language = input.language;
    const person = input.person;
    this.ttsVoiceOptions = input.voices;
    if (!this.ttsPreferences.voiceChangePending()) {
      this.ttsLanguage = language;
      this.ttsPerson = person;
    }
    this.ttsPauseOnInterruption = preferences.pauseOnInterruption;
    if (!this.ttsPreferences.mixingChangePending()) this.ttsAllowMixing = preferences.allowMixing;
    this.ttsBackgroundPlayback = preferences.backgroundPlayback;
    this.ttsKeepScreenOn = preferences.keepScreenOn;
    this.ttsFailurePolicy = preferences.failurePolicy;
    this.ttsFollowHighlight = preferences.followHighlight;
    this.publishPresentation();
    if (followedHighlight !== preferences.followHighlight) {
      if (!preferences.followHighlight) this.view.retirePageFollow();
      else this.view.followPage(this.ttsState);
    }
    this.ttsTransport.coordinator?.setPauseOnInterruption(preferences.pauseOnInterruption);
    this.ttsTransport.coordinator?.setBackgroundPlayback(preferences.backgroundPlayback);
    if (!preferences.backgroundPlayback && !this.session.foreground()) void this.ttsTransport.coordinator?.pauseForBackground()
      .catch((error: Error): void => { if (current()) this.logTtsFailure('background pause', error); });
    if (!this.ttsPreferences.mixingChangePending()) void this.ttsTransport.coordinator?.setAllowMixing(preferences.allowMixing)
      .catch((error: Error): void => { if (current()) this.logTtsFailure('audio-session', error); });
    this.ttsTransport.coordinator?.setFailurePolicy(preferences.failurePolicy);
    if (!this.ttsPreferences.voiceChangePending()) {
      this.ttsTransport.coordinator?.setVoiceForNextSpeech(language, person,
        (): boolean => current() && this.ttsLanguage === language && this.ttsPerson === person);
      if (input.repairedVoice) this.ttsPreferences.accept({ voice: { language, person } });
    }
    this.reconcileTtsWindowAwake(wasAwake);
  }

  private captureTtsPreferenceOwner(): () => boolean {
    const scope = this.session.scope();
    const coordinator = this.ttsTransport.coordinator;
    return (): boolean => this.session.active(scope.lifecycleToken) && this.sameBook(scope) &&
      coordinator === this.ttsTransport.coordinator;
  }

  private sameBook(scope: ReaderTtsPlaybackScope): boolean {
    const live = this.session.scope();
    return scope.sourceId === live.sourceId && scope.bookId === live.bookId;
  }

  toggleTts(): void { this.ttsPlayback.toggle(); }

  private ttsStartInput(page: ReaderTtsStartPage): ReaderTtsStartInput {
    return {
      chapter: this.ttsChapterRef(page.chapter),
      content: page.chapter.content,
      contentVersion: this.chapter.materializedContentVersion(),
      scalarPosition: page.startScalar,
      rate: this.ttsState.rate,
      pitch: 1,
      language: this.ttsLanguage,
      person: this.ttsPerson,
      pauseOnInterruption: this.ttsPauseOnInterruption,
      allowMixing: this.ttsAllowMixing,
      backgroundPlayback: this.ttsBackgroundPlayback,
      failurePolicy: this.ttsFailurePolicy,
      timerDurationMs: this.ttsTimerDurationMs(),
    };
  }

  async auditionReaderTtsVoice(language: string, person: number): Promise<void> {
    const coordinator = this.ttsTransport.coordinator;
    const lifecycle = this.session.scope().lifecycleToken;
    if (!this.session.active(lifecycle) || !this.controls.controlVisible() ||
      !this.controls.controlInputEnabled() || this.controls.chromeOverlayActive()) {
      throw new Error('当前阅读界面无法试听，请返回朗读配置后重试。');
    }
    if (coordinator === undefined) throw new Error('朗读服务尚未就绪，请重试。');
    const observe = READER_LAYOUT_DEBUG_BUILD && AppStorage.get<boolean>('readerLayoutInvariantAutomation') === true ?
      (receipt: ReaderTtsAuditionReceipt): void => {
        hilog.info(0x5244, 'Reader', 'READER_VM_TTS_AUDITION %{public}s', JSON.stringify(receipt));
      } : undefined;
    this.controls.pauseAutoPage();
    await coordinator.auditionVoice({ engine: this.ttsEngine, language, person, rate: this.ttsState.rate, pitch: 1, observe });
    if (!this.session.active(lifecycle) && this.ttsTransport.coordinator === coordinator) await coordinator.stopAudition();
  }

  stopReaderTtsAudition(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) return;
    void coordinator.stopAudition().catch((error: Error): void => {
      hilog.warn(0x0000, 'ReaderTtsAudition', 'stop audition failed: %{private}s', error.message);
    });
  }

  stopTts(): void {
    this.view.retirePageFollow();
    this.controls.retireSpeechCapsule();
    this.ttsPlayback.cancelPending();
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.stop('user').catch((error: Error): void => this.logTtsFailure('stop', error));
    }
  }

  /** Manual navigation invalidates the chapter-bound one-shot stop target. */
  clearTtsChapterEndTimer(): void {
    if (this.ttsTimerMode !== 'chapterEnd') return;
    this.ttsTimerMode = 'off';
    this.ttsTimerMinutes = 0;
    this.ttsTimerSeconds = 0;
    this.publishPresentation();
    if (this.ttsState.chapterKey !== undefined) this.ttsTransport.coordinator?.setTimer(undefined);
  }

  previousTtsUtterance(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.previous().catch((error: Error): void => this.logTtsFailure('previous', error));
    }
  }

  nextTtsUtterance(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.next().catch((error: Error): void => this.logTtsFailure('next', error));
    }
  }

  seekTtsUtterance(sliceIndex: number): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator !== undefined) {
      void coordinator.seek(sliceIndex).catch((error: Error): void => this.logTtsFailure('seek', error));
    }
  }

  changeTtsRate(rate: number, onDeclined?: () => void): void {
    const normalized = Math.max(READER_TTS_RATE_MIN, Math.min(READER_TTS_RATE_MAX,
      Math.round(rate * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE));
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) { onDeclined?.(); return; }
    const isConfigCurrent = this.ttsPreparation.beginConfiguration();
    const scope = this.session.scope();
    const current = (): boolean => this.session.active(scope.lifecycleToken) && this.sameBook(scope) &&
      this.ttsTransport.coordinator === coordinator &&
      isConfigCurrent();
    void admitReaderTtsRate((rate: number): Promise<void> => coordinator.setRate(rate), normalized, this.ttsState.rate, {
      isCurrent: current,
      persistRate: (rate: number): Promise<void> => this.persistTtsConfig(rate),
      presentPendingReconciliation: (): boolean => {
        if (this.ttsConfigurationHost?.snapshot().selection.receipt.fact !== 'pendingReconciliation') return false;
        // A missing config reply may have committed. Retain the live rate
        // while the configuration owner reconciles the durable receipt.
        const snapshot = this.ttsConfigurationHost?.snapshot();
        if (snapshot !== undefined) this.projectTtsConfigurationRecovery(snapshot);
        return true;
      },
      declineRate: (): void => {
        onDeclined?.();
        this.notifyTtsConfigurationFailure('语速未能保存，请重试');
      },
      reportFailure: (error: Error): void => this.logTtsFailure('rate', error),
    });
  }

  changeTtsTimer(minutes: number, seconds: number, mode: ReaderTtsTimerMode = 'duration'): void {
    const safeMode: ReaderTtsTimerMode = mode === 'off' || mode === 'chapterEnd' ? mode : 'duration';
    if (safeMode === 'off' || safeMode === 'chapterEnd') {
      this.ttsTimerMode = safeMode;
      this.ttsTimerMinutes = 0;
      this.ttsTimerSeconds = 0;
    } else {
      const normalizedMinutes = Math.max(READER_TTS_TIMER_MIN,
        Math.min(READER_TTS_TIMER_MAX_MINUTES, Number.isFinite(minutes) ? Math.trunc(minutes) : 0));
      const normalizedSeconds = Math.max(READER_TTS_TIMER_MIN,
        Math.min(READER_TTS_TIMER_MAX_SECONDS, Number.isFinite(seconds) ? Math.trunc(seconds) : 0));
      this.ttsTimerMinutes = normalizedMinutes;
      this.ttsTimerSeconds = normalizedSeconds;
      this.ttsTimerMode = normalizedMinutes === 0 && normalizedSeconds === 0 ? 'off' : 'duration';
    }
    this.publishPresentation();
    if (this.ttsState.chapterKey !== undefined) {
      this.ttsTransport.coordinator?.setTimer(this.ttsTimerDurationMs());
    }
  }

  changeTtsAllowMixing(enabled: boolean): void {
    this.ttsPreferences.changeMixing(enabled, (accepted: boolean): Promise<boolean> => {
      const coordinator = this.ttsTransport.coordinator;
      return coordinator === undefined ? Promise.resolve(true) : coordinator.setAllowMixing(accepted);
    }, (accepted: boolean): void => {
      this.ttsAllowMixing = accepted;
      this.publishPresentation();
    });
  }

  changeTtsBackgroundPlayback(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    this.ttsBackgroundPlayback = enabled;
    this.publishPresentation();
    this.ttsTransport.coordinator?.setBackgroundPlayback(enabled);
    this.ttsPreferences.accept({ backgroundPlayback: enabled });
  }

  changeTtsKeepScreenOn(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const wasAwake = this.ttsWindowAwakeRequested();
    this.ttsKeepScreenOn = enabled;
    this.publishPresentation();
    this.ttsPreferences.accept({ keepScreenOn: enabled });
    this.reconcileTtsWindowAwake(wasAwake);
  }

  changeTtsFailurePolicy(policy: 'skip' | 'stop'): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const coordinator = this.ttsTransport.coordinator;
    this.ttsFailurePolicy = policy;
    this.publishPresentation();
    coordinator?.setFailurePolicy(policy);
    this.ttsPreferences.accept({ failurePolicy: policy });
  }

  changeTtsFollowHighlight(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    this.ttsFollowHighlight = enabled;
    this.publishPresentation();
    if (!enabled) this.view.retirePageFollow();
    else this.view.followPage(this.ttsState);
    this.ttsPreferences.accept({ followHighlight: enabled });
  }

  changeTtsPauseOnInterruption(enabled: boolean): void {
    if (!this.captureTtsPreferenceOwner()()) return;
    const coordinator = this.ttsTransport.coordinator;
    this.ttsPauseOnInterruption = enabled;
    this.publishPresentation();
    coordinator?.setPauseOnInterruption(enabled);
    this.ttsPreferences.accept({ pauseOnInterruption: enabled });
  }

  changeTtsVoice(language: string, person: number): void {
    this.ttsPreferences.changeVoice(language, person, (option: ReaderTtsVoiceOption): Promise<boolean> => {
      const coordinator = this.ttsTransport.coordinator;
      return coordinator === undefined ? Promise.resolve(true) : coordinator.setVoice(option.language, option.person);
    }, (option: ReaderTtsVoiceOption): void => {
      this.ttsLanguage = option.language;
      this.ttsPerson = option.person;
      this.publishPresentation();
    });
  }

  private requireTtsConfigurationHost(): ReaderTtsConfigurationHost {
    if (this.ttsConfigurationHost !== undefined) return this.ttsConfigurationHost;
    const http = this.ttsTransport.httpGateway;
    const config = this.ttsTransport.gateway;
    const coordinator = this.ttsTransport.coordinator;
    if (http === undefined || config === undefined || coordinator === undefined) {
      throw new Error('朗读服务正在初始化，请稍后重试');
    }
    const scope = this.session.scope();
    const current = (): boolean => this.session.active(scope.lifecycleToken) && this.sameBook(scope) &&
      this.ttsTransport.coordinator === coordinator;
    const host = new ReaderTtsConfigurationHost({
      http, config, credentials: ReaderTtsCredentialStore.instance,
      coordinator: {
        stop: (reason: 'user'): Promise<void> => coordinator.stop(reason),
        probeAvailability: (isAdmitted: () => boolean): Promise<boolean> =>
          coordinator.probeConfigurationAvailability(isAdmitted),
      },
      isCurrent: current,
      fallbackConfig: (): ReaderTtsConfig => ({ engine: this.ttsEngine,
        rate: readerTtsCoreRateForMultiplier(this.ttsState.rate),
        ratePercent: readerTtsRatePercentForMultiplier(this.ttsState.rate),
        pitch: this.ttsConfig?.pitch ?? 0, followSys: this.ttsConfig?.followSys ?? false }),
      publish: (snapshot: ReaderTtsConfigurationSnapshot): void => {
        if (!current() || this.ttsConfigurationHost !== host) return;
        this.ttsConfig = snapshot.config;
        this.ttsEngine = snapshot.config?.engine ?? 'system';
        this.ttsHttpEngines = snapshot.engines;
        // Configuration receipts are independent from formal speech state.
        this.projectTtsConfigurationRecovery(snapshot);
      },
      log: (message: string): void => hilog.error(0x5244, 'Reader', '%{private}s', message),
    }, this.ttsConfig, this.ttsHttpEngines);
    this.ttsConfigurationHost = host;
    return host;
  }

  retryTtsConfigurationMetadataOnOpen(): void {
    const host = this.ttsConfigurationHost;
    if (host === undefined) return;
    const metadata = host.snapshot().metadata;
    if (metadata.canRetry && (metadata.fact === 'failed' || metadata.fact === 'refreshFailed')) {
      // Reopening the existing configuration layer retries only its read.
      // It never replays a durable save or restarts formal playback.
      void host.refreshMetadata();
    }
  }

  private projectTtsConfigurationRecovery(snapshot: ReaderTtsConfigurationSnapshot): void {
    const lifecycleToken = this.session.scope().lifecycleToken;
    const feedbackCurrent = (): boolean => this.session.active(lifecycleToken) && this.controls.controlInputEnabled();
    const metadataFailed = snapshot.metadata.fact === 'failed' || snapshot.metadata.fact === 'refreshFailed';
    this.ttsConfigurationLoading = !snapshot.metadata.hasValue && snapshot.metadata.fact === 'loading';
    this.ttsConfigurationLoadFailed = !snapshot.metadata.hasValue && metadataFailed;
    this.publishPresentation();
    if (metadataFailed && snapshot.metadata.hasValue && !this.ttsConfigurationMetadataFailed &&
      snapshot.notice === undefined && snapshot.durable.receipt.fact !== 'pendingReconciliation' &&
      snapshot.selection.receipt.fact !== 'pendingReconciliation' && this.controls.preferenceModule() === 'tts') {
      this.transientFeedback.show(() => this.session.uiContext(), { message: '朗读配置刷新失败，当前配置已保留' },
        feedbackCurrent);
    }
    this.ttsConfigurationMetadataFailed = metadataFailed;
    const pending = snapshot.durable.receipt.fact === 'pendingReconciliation' ||
      snapshot.selection.receipt.fact === 'pendingReconciliation';
    const message = pending ? '配置操作结果尚未确认，请核对当前配置；确认前不会重复提交。' : '';
    if (message !== this.ttsConfigurationRecovery.message) {
      this.ttsConfigurationRecovery = { message, visible: pending, canRetry: pending,
        generation: this.ttsConfigurationRecovery.generation + 1 };
      this.publishPresentation();
    }
    if (!pending && snapshot.notice !== undefined && snapshot.notice !== this.ttsConfigurationNotice) {
      const message = snapshot.durable.receipt.fact === 'confirmedRefreshFailed' ?
        (snapshot.durable.value?.kind === 'http-delete' ? '配置已删除，列表刷新失败，请重新打开设置刷新列表' :
          '配置已保存，列表刷新失败，请重新打开设置刷新列表') : '配置已保存，当前引擎暂不可用，请检查朗读设置';
      this.transientFeedback.show(() => this.session.uiContext(), { message }, feedbackCurrent);
    }
    this.ttsConfigurationNotice = snapshot.notice;
  }

  openTtsConfigurationRecovery(generation: number): void {
    if (!this.session.active(this.session.scope().lifecycleToken) || !this.controls.controlInputEnabled() ||
      generation !== this.ttsConfigurationRecovery.generation || !this.ttsConfigurationRecovery.visible) return;
    this.controls.openTtsConfiguration();
    // Viewing the original configuration never repeats or confirms its write.
  }

  private notifyTtsConfigurationFailure(message: string): void {
    const lifecycleToken = this.session.scope().lifecycleToken;
    const snapshot = this.ttsConfigurationHost?.snapshot();
    if (snapshot !== undefined) {
      this.projectTtsConfigurationRecovery(snapshot);
      if (this.ttsConfigurationRecovery.visible || snapshot.notice !== undefined) return;
    }
    this.transientFeedback.show(() => this.session.uiContext(), { message, tone: 'error' }, (): boolean =>
      this.session.active(lifecycleToken) && this.controls.controlInputEnabled());
  }

  changeTtsEngine(engine: string): Promise<void> {
    const lifecycle = this.session.scope().lifecycleToken;
    return this.ttsPreparation.configure(engine,
      (value: string): Promise<void> => this.requireTtsConfigurationHost().changeEngine(value),
      (): boolean => this.session.active(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('朗读引擎未能切换，请检查配置后重试'));
  }

  saveHttpTtsEngine(config: ReaderTtsConfigurationDraft): Promise<void> {
    const lifecycle = this.session.scope().lifecycleToken;
    return this.ttsPreparation.configure(config,
      (value: ReaderTtsConfigurationDraft): Promise<void> => this.requireTtsConfigurationHost().save(value),
      (): boolean => this.session.active(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('在线朗读配置未能保存，请检查输入后重试'));
  }

  deleteHttpTtsEngine(id: number): Promise<void> {
    const lifecycle = this.session.scope().lifecycleToken;
    return this.ttsPreparation.configure(id,
      (value: number): Promise<void> => this.requireTtsConfigurationHost().delete(value),
      (): boolean => this.session.active(lifecycle),
      (): void => this.notifyTtsConfigurationFailure('在线朗读配置未能删除，请重试'));
  }

  private async persistTtsConfig(rate: number): Promise<void> {
    await this.requireTtsConfigurationHost().persistRate(
      readerTtsCoreRateForMultiplier(rate), readerTtsRatePercentForMultiplier(rate));
  }

  private async commitTtsProgress(progress: ReaderTtsProgressCommit, lifecycleToken: number): Promise<void> {
    const chapter = this.progress.chapter();
    const selectionToken = this.session.scope().selectionToken;
    const isCurrent = (): boolean => {
      if (!this.session.progressAllowed(lifecycleToken)) return false;
      const scope = this.session.scope();
      return scope.sourceId === progress.chapter.sourceId && scope.bookId === progress.chapter.bookId &&
        this.progress.chapter() === chapter && scope.selectionToken === selectionToken;
    };
    if (chapter === undefined || !isCurrent() ||
      progress.chapter.chapterIndex !== chapter.chapterIndex || progress.chapter.bodyVersion !== chapter.bodyVersion ||
      progress.chapter.processingVersion !== chapter.processingVersion) return;
    const scalarCount = this.progress.scalarCount();
    const offset = Math.max(0, Math.min(scalarCount, progress.charEnd));
    const intent = this.progress.intent(chapter,
      new CoreReadingAnchor(chapter.chapterIndex, offset, scalarCount === 0 ? 0 : offset / scalarCount,
        chapter.bodyVersion, chapter.processingVersion), this.progress.layout(),
      isCurrent, (stored: LocalReadingProgress): void => {
        this.progress.admit(stored);
        if (!isCurrent()) return;
        this.lastTtsCommittedProgress = this.progress.accepted();
        this.lastTtsCommittedChapter = chapter;
        this.lastTtsCommittedSelectionToken = selectionToken;
      });
    try {
      await this.progress.commit(intent);
    } catch (error) {
      if (!isCurrent()) return;
      this.logTtsFailure('progress', error as Error);
    }
  }

  private loadNextTtsChapter(
    current: ReaderTtsChapterRef,
    lifecycleToken: number,
  ): Promise<ReaderTtsChapterAdvanceInput | undefined> {
    if (!this.session.active(lifecycleToken)) return Promise.resolve(undefined);
    const scope = this.session.scope();
    if (current.sourceId !== scope.sourceId || current.bookId !== scope.bookId ||
      current.chapterIndex !== this.ttsState.chapterIndex) return Promise.resolve(undefined);
    if (this.ttsTimerMode === 'chapterEnd') return Promise.resolve(undefined);
    return loadNextReaderTtsChapter(this.chapter.window(), {
      capture: (): ReaderTtsChapterAdvanceLease => {
        const owner = this.chapter.captureAdvanceSelection(this.ttsState);
        return {
          current: (): boolean => {
            if (!this.session.active(lifecycleToken)) return false;
            const live = this.session.scope();
            return current.sourceId === live.sourceId && current.bookId === live.bookId &&
              owner.sessionGeneration === this.ttsState.sessionGeneration &&
              owner.positionGeneration === (this.ttsState.positionGeneration ?? 0) && current.chapterIndex === this.ttsState.chapterIndex;
          },
          select: (target: number, firstRange?: ReaderTtsChapterAdvanceRange): boolean => {
            if (!owner.isCurrent()) return false;
            const alignContinuous = firstRange !== undefined && this.ttsFollowHighlight && this.chapter.continuous();
            const offset = alignContinuous ? firstRange?.charStart ?? 0 : 0;
            owner.select(target, offset);
            return alignContinuous;
          },
        };
      },
      hydrateCatalogIfNeeded: (): Promise<void> | undefined => this.chapter.hydrateCatalogForNext(current.chapterIndex),
      nextChapterIndex: (): number | undefined => this.chapter.nextChapterIndex(current.chapterIndex),
      load: (target: number, isCurrent: () => boolean): Promise<ReadingSessionChapter> => this.chapter.load(target, isCurrent),
      admit: (chapter: ReadingSessionChapter): void => this.chapter.admitContentVersion(chapter),
      chapterRef: (chapter: ReadingSessionChapter): ReaderTtsChapterRef => this.ttsChapterRef(chapter),
    });
  }

  private ttsChapterRef(chapter: ReadingSessionChapter): ReaderTtsChapterRef {
    return {
      sourceId: this.session.scope().sourceId,
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.chapterTitle,
      bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion,
    };
  }

  private ttsTimerDurationMs(): number | undefined {
    if (this.ttsTimerMode !== 'duration') return undefined;
    const seconds = this.ttsTimerMinutes * 60 + this.ttsTimerSeconds;
    return seconds > 0 ? seconds * 1000 : undefined;
  }

  logTtsFailure(operation: string, error: Error): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `Reader TTS ${operation} failed: ${error.message}`);
    const current = this.ttsState;
    this.ttsState = {
      status: current.status,
      sessionGeneration: current.sessionGeneration,
      utteranceGeneration: current.utteranceGeneration,
      positionGeneration: current.positionGeneration,
      audioStarted: current.audioStarted,
      contentVersion: current.contentVersion,
      chapterKey: current.chapterKey,
      chapterIndex: current.chapterIndex,
      sliceIndex: current.sliceIndex,
      totalSlices: current.totalSlices,
      charStart: current.charStart,
      charEnd: current.charEnd,
      requestId: current.requestId,
      rate: current.rate,
      consecutiveFailures: current.consecutiveFailures,
      timerDeadlineMs: current.timerDeadlineMs,
      pauseReason: current.pauseReason,
      stopReason: current.stopReason,
      errorMessage: error.message.length > 0 ? error.message : `TTS ${operation} failed`,
    };
    this.publishPresentation();
  }

  stopTtsOnScreenOff(): void {
    const coordinator = this.ttsTransport.coordinator;
    if (coordinator === undefined) {
      return;
    }
    void coordinator.stop('screenOff')
      .catch((error: Error): void => this.logTtsFailure('screen-off stop', error));
  }

  ttsWindowAwakeRequested(): boolean {
    return this.ttsKeepScreenOn && (this.ttsState.status === 'preparing' ||
      this.ttsState.status === 'playing' || this.ttsState.status === 'resuming');
  }

  private reconcileTtsWindowAwake(previous: boolean): void {
    if (previous === this.ttsWindowAwakeRequested()) return;
    const current = this.captureTtsPreferenceOwner();
    void this.view.applyWindowPolicy()
      .catch((error: Error): void => { if (current()) this.logTtsFailure('window-policy', error); });
  }
}
