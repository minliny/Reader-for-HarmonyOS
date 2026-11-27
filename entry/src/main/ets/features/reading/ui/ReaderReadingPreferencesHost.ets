import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderReadingSystemEventHost } from '../../../app/ReaderReadingSystemEventHost';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderThemeHost } from '../../../app/ReaderThemeHost';
import {
  ReaderWindowChromeStyle, ReaderWindowCoordinator, ReaderWindowPolicy, ReaderWindowPolicyOwner,
} from '../../../app/ReaderWindowCoordinator';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import { readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderAppearanceGateway } from '../application/ReaderAppearanceGateway';
import {
  sameReaderAppearanceFont, setReaderAppearanceAlignment, setReaderAppearanceFont, setReaderAppearanceFontOrder,
  setReaderAppearanceIndent, stepReaderAppearanceMetric, type ReaderAppearanceAlignment, type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot, type ReaderAppearanceIndent, type ReaderAppearanceMetric, type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection, type ReaderAppearanceTheme,
} from '../application/ReaderAppearanceState';
import type { ReaderAppearanceChange, ReaderAppearanceCommit, ReaderAppearanceSaveState } from '../application/ReaderAppearanceStore';
import { ReaderSettingsGateway } from '../application/ReaderSettingsGateway';
import {
  readerPageTransitionUsesPreparedPages, readerPageTurnStyle, safeReaderWindowSettingsFallback, setReaderPageTurnStyle,
  setReaderScreenDirection, setReaderScreenTimeout, setReaderSettingsToggle, setReaderWidePageLayout,
  type ReaderNavigationMode, type ReaderPageTurnStyle, type ReaderScreenDirection, type ReaderScreenTimeout,
  type ReaderSettingsSnapshot, type ReaderSettingsToggleKey, type ReaderWidePageLayout,
} from '../application/ReaderSettingsState';
import { completeReaderWindowSettingsCommit } from '../application/ReaderWindowSettingsCommit';
import { commitReadingAppearance, loadReadingAppearance } from '../application/ReadingAppearanceAdmission';
import { readerAppearanceChromeTone, readerAppearanceSnapshotFontFamily, readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';
import { ReaderScreenAwakeLease } from './ReaderScreenAwakeLease';

export interface ReaderReadingPreferenceScope {
  readonly lifecycleToken: number;
  readonly sourceId: string;
  readonly bookId: string;
  readonly chapterSelectionToken: number;
}

export interface ReaderReadingPreferencesLifetime {
  readonly scope: () => ReaderReadingPreferenceScope;
  readonly mounted: () => boolean;
  readonly mountedToken: (lifecycle: number) => boolean;
  readonly sessionActive: (lifecycle: number) => boolean;
  readonly readerIdentityCurrent: () => boolean;
  readonly trace: (phase: 'settings-read' | 'settings-window', lifecycle: number) => void;
}

export interface ReaderReadingPreferencesView {
  readonly settings: () => ReaderSettingsSnapshot;
  readonly appearance: () => ReaderAppearanceSnapshot;
  readonly publishSettings: (snapshot: ReaderSettingsSnapshot) => void;
  readonly publishEntryAppearance: (snapshot: ReaderAppearanceSnapshot) => void;
  readonly admitAppearance: (snapshot: ReaderAppearanceSnapshot) => void;
  readonly settingsRecovery: () => ReaderRecoveryView;
  readonly publishSettingsRecovery: (recovery: ReaderRecoveryView, busy: boolean) => void;
  readonly appearanceRecovery: () => ReaderRecoveryView;
  readonly publishAppearanceRecovery: (recovery: ReaderRecoveryView) => void;
  readonly publishAppearanceRecoveryBusy: (busy: boolean) => void;
  readonly recoveryInputCurrent: () => boolean;
  readonly appearanceRecoveryChanged: () => void;
}

export interface ReaderReadingPreferencesWindow {
  readonly uiContext: () => UIContext;
  readonly foreground: () => boolean;
  readonly chromeActive: () => boolean;
  readonly overlayActive: () => boolean;
  readonly expanded: () => boolean;
  readonly controlsPresented: () => boolean;
  readonly capsuleStageFlying: () => boolean;
  readonly controlInputEnabled: () => boolean;
  readonly publishControlsPresented: (presented: boolean) => void;
  readonly publishPolicyPending: (pending: boolean) => void;
  readonly ttsWindowAwakeRequested: () => boolean;
  readonly stopTtsOnScreenOff: () => void;
  readonly volumePageTurn: (direction: ReaderPageTurnDirection) => void;
}

export interface ReaderReadingPreferencesPage {
  readonly expandedLayout: () => boolean;
  readonly inputCurrent: () => boolean;
  readonly inputIdle: () => boolean;
  readonly deferWindowSettings: (snapshot: ReaderSettingsSnapshot) => void;
  readonly visibleContinuousScalar: () => number;
  readonly restoreFromContinuousScalar: (scalar: number) => void;
  readonly reflowWindow: () => void;
  readonly renderChanged: () => void;
  readonly resumePendingAutoPageTurn: () => void;
  readonly sampleAndCommitContinuous: (lifecycle: number) => Promise<void>;
  readonly invalidatePageTurnRuntime: () => void;
  readonly resetBookTurnFailure: () => void;
  readonly publishNavigationModeChange: (mode: ReaderNavigationMode) => void;
  readonly preparePageTurnIfReady: () => void;
}

/** Owns native window policy and accepted preference operations for one reader.
 * Render snapshots belong to the mounted view; stale loads and saves cannot admit a newer generation. */
export class ReaderReadingPreferencesHost {
  private readonly runtime: ReaderRuntimeOwner;
  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly lifetime: ReaderReadingPreferencesLifetime;
  private readonly view: ReaderReadingPreferencesView;
  private readonly window: ReaderReadingPreferencesWindow;
  private readonly page: ReaderReadingPreferencesPage;
  private readonly appearanceGateway: ReaderAppearanceGateway;
  private readonly readerSettingsGateway: ReaderSettingsGateway;
  private appearanceSaveRecoveryIdentity: string = '';
  private appearanceSaveRevision: number = 0;
  private appearanceSaveUnsubscribe: (() => void) | undefined = undefined;
  private appearanceGeneration: number = 0;
  private readerSettingsMutationGeneration: number = 0;
  private readerWindowPolicyGeneration: number = 0;
  private pageStyleChangeGeneration: number = 0;
  private hasEntryAppearance: boolean = false;
  private hasLoadedAppearance: boolean = false;
  private hasLoadedReaderSettings: boolean = false;
  private windowPolicyOwner: ReaderWindowPolicyOwner | undefined = undefined;
  private screenAwakeLease: ReaderScreenAwakeLease | undefined = undefined;
  private screenAwakeKeepScreenOn: boolean = false;
  private readingSystemEventHost: ReaderReadingSystemEventHost | undefined = undefined;

  constructor(runtime: ReaderRuntimeOwner, transientFeedback: ReaderTransientFeedback,
    lifetime: ReaderReadingPreferencesLifetime, view: ReaderReadingPreferencesView,
    window: ReaderReadingPreferencesWindow, page: ReaderReadingPreferencesPage) {
    this.runtime = runtime;
    this.transientFeedback = transientFeedback;
    this.lifetime = lifetime;
    this.view = view;
    this.window = window;
    this.page = page;
    this.appearanceGateway = new ReaderAppearanceGateway(runtime);
    this.readerSettingsGateway = new ReaderSettingsGateway(runtime);
  }

  get appearanceMutationGeneration(): number { return this.appearanceGeneration; }
  get entryAppearanceReady(): boolean { return this.hasEntryAppearance; }
  get appearanceLoaded(): boolean { return this.hasLoadedAppearance; }
  get readerSettingsLoaded(): boolean { return this.hasLoadedReaderSettings; }

  restoreEntryPresentation(): void {
    // ThemeHost restores this store before Index is mounted. Avoid flashing default paper.
    this.hasEntryAppearance = false;
    try {
      this.view.publishEntryAppearance(this.appearanceGateway.current());
      this.hasEntryAppearance = true;
    } catch (_) {}
    const settings = this.readerSettingsGateway.current();
    this.hasLoadedReaderSettings = settings !== undefined;
    if (settings !== undefined) this.view.publishSettings(settings);
  }

  markAppearanceLoaded(): void { this.hasLoadedAppearance = true; }

  appearanceFontOrder(): ReaderAppearanceFontSlot[] {
    return this.appearanceGateway.current().fontOrder;
  }

  commitAppearanceFontOrder(order: ReaderAppearanceFontSlot[]): Promise<ReaderAppearanceSnapshot | undefined> {
    return this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      setReaderAppearanceFontOrder(current, order));
  }

  beginWindowPolicyOwnership(lifecycle: number): void {
    this.windowPolicyOwner = new ReaderWindowPolicyOwner((): boolean => this.lifetime.mountedToken(lifecycle) &&
      this.lifetime.readerIdentityCurrent() && this.window.chromeActive() && this.window.foreground());
  }

  attachSystemEvents(): void {
    this.screenAwakeKeepScreenOn = false;
    this.screenAwakeLease = new ReaderScreenAwakeLease((keepScreenOn: boolean): void =>
      this.onScreenAwakeKeepScreenOnChanged(keepScreenOn));
    this.readingSystemEventHost = new ReaderReadingSystemEventHost();
  }

  setScreenLockObserver(onLock: (locked: boolean) => void): void {
    this.readingSystemEventHost?.setScreenLockHandler(onLock);
  }

  rearmScreenAwake(): void { this.screenAwakeLease?.rearm(); }
  setScreenAwakeForeground(foreground: boolean): void { this.screenAwakeLease?.setForeground(foreground); }

  retireSystemEvents(): void {
    this.screenAwakeLease?.dispose();
    this.screenAwakeLease = undefined;
    this.screenAwakeKeepScreenOn = false;
    this.readingSystemEventHost?.dispose();
    this.readingSystemEventHost = undefined;
  }

  releaseWindowPolicyOwnership(): void {
    if (this.windowPolicyOwner === undefined) return;
    void ReaderWindowCoordinator.requestAppWindowPolicy(this.windowPolicyOwner).catch((_error: Error): void => {});
    this.windowPolicyOwner = undefined;
  }

  applyLoadedSystemPreferences(): void {
    this.configureReaderScreenAwakeLease(this.view.settings());
    this.applyReaderSystemEventPolicy(this.view.settings());
  }

  retireAppearanceSaveRecovery(): void {
    this.appearanceSaveUnsubscribe?.();
    this.appearanceSaveUnsubscribe = undefined;
    this.appearanceSaveRecoveryIdentity = '';
    this.view.publishAppearanceRecovery({ message: '', visible: false, canRetry: false,
      generation: this.view.appearanceRecovery().generation + 1 });
    this.view.publishAppearanceRecoveryBusy(false);
  }

  bindAppearanceSaveRecovery(lifecycleToken: number): void {
    this.appearanceSaveUnsubscribe?.();
    this.appearanceSaveRecoveryIdentity = '';
    this.appearanceSaveUnsubscribe = this.appearanceGateway.subscribeSaveState((state: ReaderAppearanceSaveState): void => {
      this.updateAppearanceSaveRecovery(state, lifecycleToken);
    });
  }

  refreshAppearanceSaveRecovery(lifecycleToken: number): void {
    if (!this.lifetime.sessionActive(lifecycleToken)) return;
    this.updateAppearanceSaveRecovery(this.appearanceGateway.saveState(), lifecycleToken);
  }

  private updateAppearanceSaveRecovery(state: ReaderAppearanceSaveState, lifecycleToken: number): void {
    if (!this.lifetime.sessionActive(lifecycleToken) || !ReaderRuntimeOwner.isCurrent(this.runtime)) return;
    const scope = this.lifetime.scope();
    const identity = JSON.stringify([lifecycleToken, scope.sourceId, scope.bookId, scope.chapterSelectionToken, state.revision]);
    const generation = this.appearanceSaveRecoveryIdentity === identity ? this.view.appearanceRecovery().generation :
      this.view.appearanceRecovery().generation + 1;
    this.appearanceSaveRecoveryIdentity = identity;
    this.appearanceSaveRevision = state.revision;
    this.view.publishAppearanceRecoveryBusy(state.retrying);
    this.view.publishAppearanceRecovery({ visible: state.unconfirmed,
      message: state.unconfirmed ? '外观设置保存尚未确认，当前选择已保留。' : '',
      canRetry: state.canRetry, generation });
    this.view.appearanceRecoveryChanged();
  }

  retryAppearanceSaveRecovery(generation: number): void {
    if (!this.view.recoveryInputCurrent() || generation !== this.view.appearanceRecovery().generation ||
      !this.view.appearanceRecovery().visible) return;
    const state = this.appearanceGateway.saveState();
    const scope = this.lifetime.scope();
    if (!state.canRetry || state.revision !== this.appearanceSaveRevision || this.appearanceSaveRecoveryIdentity !==
      JSON.stringify([scope.lifecycleToken, scope.sourceId, scope.bookId, scope.chapterSelectionToken, state.revision])) return;
    void this.appearanceGateway.retrySave(state.revision).catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', '%{private}s', `Appearance save retry pending: ${error.message}`);
    });
  }

  private setReaderSettingsRecovery(message: string, canRetry: boolean, busy: boolean = false): void {
    const previous = this.view.settingsRecovery();
    this.view.publishSettingsRecovery({ message, visible: message.length > 0, canRetry,
      generation: (previous?.generation ?? 0) + 1 }, busy);
  }

  private settleReaderSettingsRecovery(current: () => boolean): void {
    if (!current()) return;
    const pending = this.readerSettingsGateway.writeFacts().pendingReconciliation;
    this.setReaderSettingsRecovery(pending ? '阅读设置保存尚未确认，当前效果已保留。' : '', pending);
  }

  retryReaderSettingsRecovery(generation: number): void {
    const view = this.view.settingsRecovery();
    if (!view.canRetry || view.generation !== generation || !this.lifetime.sessionActive(this.lifetime.scope().lifecycleToken)) return;
    this.setReaderSettingsRecovery('正在核对并保存阅读设置…', false, true);
    const current = this.captureReaderSettingsAdmission(this.lifetime.scope().lifecycleToken, this.readerSettingsMutationGeneration);
    if (this.readerSettingsGateway.writeFacts().pendingReconciliation) this.retryPendingReaderSettings(current);
    else void this.persistReaderSettingsSnapshot(this.view.settings(), current)
      .catch((error: Error): void => this.notifyReaderSettingsSavePending(error, current));
  }

  applyWindowPolicyForChromeOwner(): void {
    if (!this.lifetime.mounted() || !this.lifetime.readerIdentityCurrent()) return;
    // Take one semantic chrome snapshot at the ownership edge.  The control
    // panel reports its visual session and the native Window policy is
    // asynchronous; reading the session again after assigning @State could
    // otherwise let the painted band, top-info suppression and native bar
    // policy observe different frames during the first open/close frame.
    const controlsPresented = this.window.controlsPresented();
    this.window.publishControlsPresented(controlsPresented);
    this.syncVolumeKeyPolicy();
    AppStorage.setOrCreate<boolean>('readerTopInfoSuppressed',
      this.window.chromeActive() && controlsPresented);
    if (this.window.chromeActive() && this.window.foreground()) {
      // The control surface is an explicit system-chrome affordance. Keep the
      // user's hide-status-bar preference persisted, but expose the status bar
      // while controls are open so the top bar has a live safe-top boundary.
      // Keep native safe-area inputs stable through the flight. Control paint
      // still leaves on its authored cue; the system bar follows settlement.
      const stageFlying = this.window.capsuleStageFlying();
      void this.applyReaderWindowPolicy(this.view.settings(), controlsPresented || stageFlying)
        .catch((_error: Error): void => {});
      return;
    }
    if (this.windowPolicyOwner !== undefined) void ReaderWindowCoordinator.requestAppWindowPolicy(this.windowPolicyOwner)
      .catch((_error: Error): void => {});
  }

  applyWindowChrome(): void {
    if (!this.lifetime.readerIdentityCurrent()) return;
    if (!this.window.chromeActive()) {
      ReaderWindowCoordinator.requestAppChrome();
      return;
    }
    const themeStyle = readerAppearanceThemeStyle(this.view.appearance().activeTheme);
    const chromeStyle = new ReaderWindowChromeStyle(
      themeStyle.paperStart,
      readerAppearanceChromeTone(this.view.appearance().activeTheme),
      themeStyle.ink,
      this.view.appearance().activeTheme,
    );
    if (this.window.overlayActive()) {
      ReaderWindowCoordinator.requestOverlayChrome(chromeStyle);
      return;
    }
    ReaderWindowCoordinator.requestReaderChrome(chromeStyle);
  }

  loadAppearanceSnapshot(lifecycleToken: number): Promise<void> {
    const generation = this.appearanceGeneration;
    return loadReadingAppearance(this.appearanceGateway, (): void => this.refreshAppearanceSaveRecovery(lifecycleToken), {
      current: (): boolean => this.lifetime.sessionActive(lifecycleToken) && generation === this.appearanceGeneration,
      prepareFont: (snapshot: ReaderAppearanceSnapshot): Promise<void> =>
        prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot)),
      registerCustomFont: (snapshot: ReaderAppearanceSnapshot): Promise<boolean> =>
        this.appearanceGateway.registerCustomFont(this.window.uiContext().getFont(), snapshot),
      admit: (snapshot: ReaderAppearanceSnapshot): void => {
        this.view.admitAppearance(snapshot);
        this.hasLoadedAppearance = true;
      },
      observeSave: (saved: Promise<void>): void => this.observeAppearanceSave(saved, lifecycleToken),
      loadFailed: (error: Error): void => {
        this.showAppearanceFailure('外观设置读取失败，请重新打开阅读页', error);
        // Keep a readable chapter available with the bundled system font.
        if (!this.hasLoadedAppearance) {
          this.view.admitAppearance(setReaderAppearanceFont(this.view.appearance(), 'serif'));
          this.hasLoadedAppearance = true;
          hilog.warn(0x5244, 'Reader', '%{private}s',
            'ReadingExperience appearance fallback admitted: ' + errorMessageOf(error));
        }
      },
    });
  }

  async loadReaderSettingsSnapshot(lifecycleToken: number): Promise<void> {
    if (this.hasLoadedReaderSettings) {
      this.configureReaderScreenAwakeLease(this.view.settings());
      this.applyReaderSystemEventPolicy(this.view.settings());
      this.applyInitialReaderWindowPolicy(this.view.settings(), lifecycleToken, this.readerSettingsMutationGeneration);
      this.retryPendingReaderSettings(this.captureReaderSettingsAdmission(lifecycleToken, this.readerSettingsMutationGeneration));
      return;
    }
    const mutationGeneration = this.readerSettingsMutationGeneration;
    let loadedSnapshot = this.view.settings();
    try {
      loadedSnapshot = await this.readerSettingsGateway.load();
      if (!this.lifetime.sessionActive(lifecycleToken) ||
        mutationGeneration !== this.readerSettingsMutationGeneration) {
        return;
      }
      this.lifetime.trace('settings-read', lifecycleToken);
      this.publishLoadedReaderSettings(loadedSnapshot);
      this.applyInitialReaderWindowPolicy(loadedSnapshot, lifecycleToken, mutationGeneration);
      this.retryPendingReaderSettings(this.captureReaderSettingsAdmission(lifecycleToken, mutationGeneration));
    } catch (_error) {
      // Keep locally-rendered behavior coherent with a failed Host request:
      // supported page-turn state survives, window-backed fields fail closed.
      if (!this.lifetime.sessionActive(lifecycleToken) || mutationGeneration !== this.readerSettingsMutationGeneration) return;
      this.view.publishSettings(safeReaderWindowSettingsFallback(loadedSnapshot));
      this.hasLoadedReaderSettings = true;
      this.configureReaderScreenAwakeLease(this.view.settings());
      this.applyReaderSystemEventPolicy(this.view.settings());
      void this.applyReaderWindowPolicy(this.view.settings()).catch((): void => {});
    }
  }

  private applyInitialReaderWindowPolicy(snapshot: ReaderSettingsSnapshot,
    lifecycleToken: number, mutationGeneration: number): void {
    // Native bar/orientation calls must not withhold an already available
    // chapter. Real window geometry changes use the existing reflow path.
    void this.applyReaderWindowPolicy(snapshot).then((): void => {
      if (this.lifetime.sessionActive(lifecycleToken) && mutationGeneration === this.readerSettingsMutationGeneration)
        this.lifetime.trace('settings-window', lifecycleToken);
    }).catch((_error: Error): void => {
      if (!this.lifetime.sessionActive(lifecycleToken) || mutationGeneration !== this.readerSettingsMutationGeneration) return;
      this.view.publishSettings(safeReaderWindowSettingsFallback(snapshot));
      this.configureReaderScreenAwakeLease(this.view.settings());
      this.applyReaderSystemEventPolicy(this.view.settings());
      this.page.reflowWindow();
      void this.applyReaderWindowPolicy(this.view.settings()).catch((): void => {});
    });
  }

  changeReaderSetting(key: ReaderSettingsToggleKey, value: boolean): void {
    const snapshot = setReaderSettingsToggle(this.view.settings(), key, value);
    if (key === 'hideStatusBar' || key === 'hideNavigationBar' || key === 'extendIntoCutout') {
      this.commitReaderWindowSettings(snapshot);
      return;
    }
    this.commitReaderSessionSettings(snapshot);
  }

  changeReaderScreenDirection(direction: ReaderScreenDirection): void {
    this.commitReaderWindowSettings(setReaderScreenDirection(this.view.settings(), direction));
  }

  changeWidePageLayout(value: ReaderWidePageLayout): void {
    if (!this.page.expandedLayout() || !this.page.inputCurrent() ||
      !this.page.inputIdle() || value === (this.view.settings().widePageLayout ?? 'spread')) return;
    if (this.view.settings().navigationMode === 'continuous' && this.page.visibleContinuousScalar() >= 0) {
      // Reflow keeps the current chapter/scalar from the existing List owner.
      this.page.restoreFromContinuousScalar(this.page.visibleContinuousScalar());
    }
    this.commitReaderSessionSettings(setReaderWidePageLayout(this.view.settings(), value));
    this.page.reflowWindow();
  }

  changeReaderScreenTimeout(timeout: ReaderScreenTimeout): void {
    this.commitReaderWindowSettings(setReaderScreenTimeout(this.view.settings(), timeout));
  }

  private commitReaderSessionSettings(snapshot: ReaderSettingsSnapshot): void {
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifetime.scope().lifecycleToken;
    this.publishLoadedReaderSettings(snapshot);
    this.page.renderChanged();
    const current = this.captureReaderSettingsAdmission(lifecycleToken, generation);
    void this.persistReaderSettingsSnapshot(snapshot, current).catch((error: Error): void =>
      this.notifyReaderSettingsSavePending(error, current));
  }

  commitReaderWindowSettings(snapshot: ReaderSettingsSnapshot): void {
    // Keep the old geometry and top-row ownership through drag/rebound. The
    // deferred-work join applies the latest choice after the sheet is idle.
    if (!this.page.inputIdle()) {
      this.page.deferWindowSettings(snapshot);
      return;
    }
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    const generation = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifetime.scope().lifecycleToken;
    const current = this.captureReaderSettingsAdmission(lifecycleToken, generation);
    const previous = this.view.settings();
    const bodyLayoutChanged = previous.extendIntoCutout !== snapshot.extendIntoCutout ||
      previous.hideStatusBar !== snapshot.hideStatusBar || previous.hideNavigationBar !== snapshot.hideNavigationBar;
    this.readerWindowPolicyGeneration = generation;
    this.window.publishPolicyPending(true);
    this.publishLoadedReaderSettings(snapshot);
    void completeReaderWindowSettingsCommit(previous, snapshot, {
      current,
      applyPolicy: (settings: ReaderSettingsSnapshot): Promise<void> =>
        this.applyReaderWindowPolicy(settings, this.window.controlsPresented()),
      acceptAppliedPolicy: (): void => {
        this.refreshReaderWindowLayout(bodyLayoutChanged, previous, snapshot);
        this.window.publishPolicyPending(false);
        this.page.resumePendingAutoPageTurn();
      },
      restorePreviousSettings: (): void => {
        this.view.publishSettings(previous);
        this.configureReaderScreenAwakeLease(previous);
        this.applyReaderSystemEventPolicy(previous);
        // Without a Window geometry callback, this restores the old body budget.
        this.refreshReaderWindowLayout(bodyLayoutChanged, previous, snapshot);
      },
      save: (settings: ReaderSettingsSnapshot): Promise<void> => this.persistReaderSettingsSnapshot(settings, current),
      notifySavePending: (error: Error): void => this.notifyReaderSettingsSavePending(error, current),
      notifyPolicyRestored: (error: Error): void =>
        this.showReaderSettingsFailure('窗口设置未能应用，已恢复当前窗口设置', error),
      finishPolicyRequest: (): void => {
        // Another preference can retire the settings admission while this
        // native request is pending. Only a newer window request owns the lock.
        if (this.readerWindowPolicyGeneration === generation) {
          this.window.publishPolicyPending(false);
          if (this.lifetime.sessionActive(lifecycleToken)) this.page.resumePendingAutoPageTurn();
        }
      },
    });
  }

  private publishLoadedReaderSettings(snapshot: ReaderSettingsSnapshot): void {
    this.view.publishSettings(snapshot);
    this.hasLoadedReaderSettings = true;
    this.configureReaderScreenAwakeLease(snapshot);
    this.applyReaderSystemEventPolicy(snapshot);
  }

  private refreshReaderWindowLayout(bodyLayoutChanged: boolean, before: ReaderSettingsSnapshot,
    requested: ReaderSettingsSnapshot): void {
    if (bodyLayoutChanged) this.page.reflowWindow();
    // Native turn textures include the page-owned information row.
    if (before.hideStatusBar !== requested.hideStatusBar) this.page.renderChanged();
  }

  private showReaderSettingsFailure(message: string, error: Error): void {
    try { hilog.warn(0x5244, 'Reader', '%{private}s', `Reader settings operation: ${error.message}`); } catch (_) {}
    try {
      this.transientFeedback.show(() => this.window.uiContext(), { message },
        (): boolean => this.currentFeedbackOwner());
    } catch (_) {
      // A retired notice/diagnostic cannot change accepted settings or policy.
    }
  }

  private captureReaderSettingsAdmission(lifecycle: number, generation: number): () => boolean {
    const captured = this.lifetime.scope();
    return (): boolean => {
      if (!this.lifetime.sessionActive(lifecycle) || generation !== this.readerSettingsMutationGeneration) return false;
      const current = this.lifetime.scope();
      return captured.sourceId === current.sourceId && captured.bookId === current.bookId;
    };
  }

  private notifyReaderSettingsSavePending(error: Error, current: () => boolean): void {
    if (!current() || error.message === 'READER_SETTINGS_OWNER_SUPERSEDED') return;
    this.setReaderSettingsRecovery(this.readerSettingsGateway.writeFacts().pendingReconciliation ?
      '阅读设置保存尚未确认，当前效果已保留。' : '阅读设置未能保存，当前效果已保留，请重试保存。', true);
    try { hilog.warn(0x5244, 'Reader', '%{private}s', error.message); } catch (_) {}
  }

  private async persistReaderSettingsSnapshot(snapshot: ReaderSettingsSnapshot, current: () => boolean): Promise<void> {
    if (!current()) return;
    await this.readerSettingsGateway.update(snapshot, false, current);
    this.settleReaderSettingsRecovery(current);
  }

  private retryPendingReaderSettings(current: () => boolean): void {
    if (!current()) return;
    if (!this.readerSettingsGateway.writeFacts().pendingReconciliation) {
      this.setReaderSettingsRecovery('', false);
      return;
    }
    this.setReaderSettingsRecovery('正在核对并保存阅读设置…', false, true);
    void this.readerSettingsGateway.retryAccepted(current)
      .then((): void => this.settleReaderSettingsRecovery(current))
      .catch((error: Error): void => this.notifyReaderSettingsSavePending(error, current));
  }

  applyReaderWindowPolicy(snapshot: ReaderSettingsSnapshot,
    forceStatusBarVisible: boolean = this.window.controlsPresented()): Promise<void> {
    if (!this.lifetime.mounted() || !this.window.foreground() || !this.lifetime.readerIdentityCurrent()) return Promise.resolve();
    // Settings/awake callbacks may settle while this retained reader is hidden.
    // They cannot replace either the App or another visible reader's policy;
    // the explicit visibility transition owns restoration of the App policy.
    if (!this.window.chromeActive()) return Promise.resolve();
    AppStorage.setOrCreate<boolean>('readerTopInfoSuppressed',
      forceStatusBarVisible);
    return ReaderWindowCoordinator.requestReaderWindowPolicy(this.windowPolicyFor(snapshot, forceStatusBarVisible),
      this.windowPolicyOwner);
  }

  private configureReaderScreenAwakeLease(snapshot: ReaderSettingsSnapshot): void {
    this.screenAwakeLease?.configure(snapshot.screenTimeout, this.window.foreground());
    this.screenAwakeKeepScreenOn = this.screenAwakeLease?.currentKeepScreenOn() ?? false;
  }

  private onScreenAwakeKeepScreenOnChanged(keepScreenOn: boolean): void {
    this.screenAwakeKeepScreenOn = keepScreenOn;
    if (!this.lifetime.mounted()) {
      return;
    }
    void this.applyReaderWindowPolicy(this.view.settings(), this.window.controlsPresented())
      .catch((_error: Error): void => {
        // A later foreground/settings application retries the same semantic
        // lease state through the serialized Window coordinator.
      });
  }

  private applyReaderSystemEventPolicy(snapshot: ReaderSettingsSnapshot): void {
    this.syncVolumeKeyPolicy(snapshot);
    this.readingSystemEventHost?.setScreenOffHandler(snapshot.stopTtsOnScreenOff ?
      (): void => this.window.stopTtsOnScreenOff() : undefined);
  }

  syncVolumeKeyPolicy(snapshot: ReaderSettingsSnapshot = this.view.settings()): void {
    // inputConsumer consumes the event before the callback; a no-op callback
    // cannot return it to system volume. Release the native subscription.
    this.readingSystemEventHost?.setVolumeKeyHandler(snapshot.volumeKeysTurnPage &&
      this.window.controlInputEnabled() && !this.window.controlsPresented() && !this.window.overlayActive() ?
      (direction: ReaderPageTurnDirection): void => this.onVolumeKeyPageTurn(direction) : undefined);
  }

  private onVolumeKeyPageTurn(direction: ReaderPageTurnDirection): void {
    if (!this.window.controlInputEnabled() || this.window.controlsPresented() || this.window.overlayActive()) return;
    this.window.volumePageTurn(direction);
  }

  private windowPolicyFor(snapshot: ReaderSettingsSnapshot,
    forceStatusBarVisible: boolean = false): ReaderWindowPolicy {
    return new ReaderWindowPolicy(
      snapshot.screenDirection,
      this.screenAwakeKeepScreenOn || this.window.ttsWindowAwakeRequested(),
      // Only the explicit status preference enables immersive hiding.
      // Controls always expose system chrome; cutout owns content geometry.
      snapshot.hideStatusBar === true && !forceStatusBarVisible,
      snapshot.hideNavigationBar,
      snapshot.extendIntoCutout,
      // Phone controls own an independent editing viewport;
      // keep the reading viewport stable instead of offsetting/resizing the root.
      !this.window.expanded() && !ReaderWindowCoordinator.isTabletDevice() ? 'local' : 'system',
    );
  }

  changeReaderPageTurnStyle(style: ReaderPageTurnStyle, continuousSaved: boolean = false): void {
    const changeGeneration = ++this.pageStyleChangeGeneration;
    if (!continuousSaved && this.view.settings().navigationMode === 'continuous' && style !== 'scroll') {
      const lifecycle = this.lifetime.scope().lifecycleToken;
      void this.page.sampleAndCommitContinuous(lifecycle).then((): void => {
        if (changeGeneration !== this.pageStyleChangeGeneration || !this.lifetime.sessionActive(lifecycle)) return;
        this.changeReaderPageTurnStyle(style, true);
      }).catch((): void => {
        if (changeGeneration !== this.pageStyleChangeGeneration || !this.lifetime.sessionActive(lifecycle)) return;
        this.transientFeedback.show(() => this.window.uiContext(), {
          message: '进度保存失败，请重试切换翻页效果',
        }, (): boolean => changeGeneration === this.pageStyleChangeGeneration &&
          this.lifetime.sessionActive(lifecycle) && this.window.foreground() && this.window.chromeActive());
      });
      return;
    }
    const previous = this.view.settings();
    const snapshot = setReaderPageTurnStyle(this.view.settings(), style);
    const changed = readerPageTurnStyle(snapshot) !== readerPageTurnStyle(previous);
    const navigationChanged = snapshot.navigationMode !== previous.navigationMode;
    if (changed) {
      this.page.invalidatePageTurnRuntime();
    }
    if (changed && style === 'simulation') {
      // A deliberate settings re-entry performs a fresh native capability
      // probe; an in-flight failed stream never changes renderer mid-gesture.
      this.page.resetBookTurnFailure();
    }
    this.readerSettingsMutationGeneration = this.readerSettingsMutationGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.readerSettingsMutationGeneration + 1;
    this.view.publishSettings(snapshot);
    this.hasLoadedReaderSettings = true;
    if (navigationChanged) this.page.publishNavigationModeChange(snapshot.navigationMode);
    if (changed && readerPageTransitionUsesPreparedPages(snapshot)) this.page.preparePageTurnIfReady();
    const mutationGeneration = this.readerSettingsMutationGeneration;
    const lifecycleToken = this.lifetime.scope().lifecycleToken;
    const admission = this.captureReaderSettingsAdmission(lifecycleToken, mutationGeneration);
    const current = (): boolean => admission() && changeGeneration === this.pageStyleChangeGeneration;
    void this.persistReaderSettingsSnapshot(snapshot, current).catch((error: Error): void =>
      this.notifyReaderSettingsSavePending(error, current));
  }

  changeAppearanceTheme(theme: ReaderAppearanceTheme): void {
    void this.commitAppearanceMutation((current: () => boolean): Promise<ReaderAppearanceCommit> =>
      ReaderThemeHost.selectReader(theme, current));
  }

  changeAppearanceDayTheme(theme: ReaderAppearanceTheme): void {
    if (readerThemeDefinition(theme).scheme === 'day') this.changeAppearanceDefaultTheme(theme);
  }

  changeAppearanceNightTheme(theme: ReaderAppearanceTheme): void {
    if (readerThemeDefinition(theme).scheme === 'night') this.changeAppearanceDefaultTheme(theme);
  }

  private changeAppearanceDefaultTheme(theme: ReaderAppearanceTheme): void {
    void this.commitAppearanceMutation((current: () => boolean): Promise<ReaderAppearanceCommit> =>
      ReaderThemeHost.selectReaderDefault(theme, current));
  }

  changeAppearanceFont(font: ReaderAppearanceFont): void {
    if (font === 'custom') {
      const lifecycle = this.lifetime.scope().lifecycleToken;
      const generation = ++this.appearanceGeneration;
      const snapshot = this.appearanceGateway.current();
      void this.appearanceGateway.registerCustomFont(this.window.uiContext().getFont(), snapshot)
        .then((registered: boolean): void => {
          if (!this.lifetime.sessionActive(lifecycle) || generation !== this.appearanceGeneration) return;
          if (!registered || snapshot.customFont === undefined) {
            this.showAppearanceFailure('字体文件不可用，请重新导入', new Error('CUSTOM_FONT_UNAVAILABLE'));
            return;
          }
          this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
            setReaderAppearanceFont(current, 'custom'));
        }).catch((error: Error): void => {
          if (this.lifetime.sessionActive(lifecycle) && generation === this.appearanceGeneration) {
            this.showAppearanceFailure('字体加载失败，请重新导入', error);
          }
        });
      return;
    }
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceFont(current, font));
  }

  importReaderCustomFont(): void {
    const lifecycleToken = this.lifetime.scope().lifecycleToken;
    const generation = this.appearanceGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceGeneration + 1;
    this.appearanceGeneration = generation;
    void this.appearanceGateway.importCustomFont(this.window.uiContext().getFont(), (): boolean =>
      this.lifetime.sessionActive(lifecycleToken) && generation === this.appearanceGeneration)
      .then(async (commit: ReaderAppearanceCommit | undefined): Promise<void> => {
        if (commit === undefined) return;
        this.observeAppearanceSave(commit.saved, lifecycleToken);
        const snapshot = this.appearanceGateway.current();
        await prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot));
        if (this.lifetime.sessionActive(lifecycleToken) && generation === this.appearanceGeneration) {
          const latest = this.appearanceGateway.current();
          if (sameReaderAppearanceFont(snapshot, latest)) this.view.admitAppearance(latest);
        }
      })
      .catch((error: Error): void => {
        if (this.lifetime.sessionActive(lifecycleToken) && generation === this.appearanceGeneration) {
          this.showAppearanceFailure('字体导入失败，请选择有效的 TTF 或 OTF 字体文件', error);
        }
      });
  }

  changeAppearanceIndent(indent: ReaderAppearanceIndent): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot => setReaderAppearanceIndent(current, indent));
  }

  toggleAppearanceAlignment(current: ReaderAppearanceAlignment): void {
    this.commitAppearanceChange((latest: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      setReaderAppearanceAlignment(latest, latest.alignment === 'start' ? 'justify' : 'start'));
  }

  stepAppearanceMetric(
    metric: ReaderAppearanceMetric,
    direction: ReaderAppearanceStepDirection,
  ): void {
    this.commitAppearanceChange((current: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot =>
      stepReaderAppearanceMetric(current, metric, direction));
  }

  private async commitAppearanceChange(change: ReaderAppearanceChange): Promise<ReaderAppearanceSnapshot | undefined> {
    return this.commitAppearanceMutation(async (current: () => boolean): Promise<ReaderAppearanceCommit | undefined> => {
      await ReaderThemeHost.prepareUserChange();
      return current() ? this.appearanceGateway.update(change, current) : undefined;
    });
  }

  private commitAppearanceMutation(
    commitChange: (current: () => boolean) => Promise<ReaderAppearanceCommit | undefined>,
  ): Promise<ReaderAppearanceSnapshot | undefined> {
    this.appearanceGeneration = this.appearanceGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.appearanceGeneration + 1;
    const generation = this.appearanceGeneration;
    const lifecycleToken = this.lifetime.scope().lifecycleToken;
    return commitReadingAppearance(this.appearanceGateway, commitChange, {
      sessionCurrent: (): boolean => this.lifetime.sessionActive(lifecycleToken),
      mutationCurrent: (): boolean => this.lifetime.sessionActive(lifecycleToken) && generation === this.appearanceGeneration,
      prepareFont: (snapshot: ReaderAppearanceSnapshot): Promise<void> =>
        prepareReaderFontFamily(readerAppearanceSnapshotFontFamily(snapshot)),
      admit: (snapshot: ReaderAppearanceSnapshot): void => this.view.admitAppearance(snapshot),
      observeSave: (saved: Promise<void>): void => this.observeAppearanceSave(saved, lifecycleToken),
      mutationFailed: (error: Error): void => this.showAppearanceFailure('外观设置暂时无法修改，请重试', error),
    });
  }

  private observeAppearanceSave(saved: Promise<void>, lifecycleToken: number): void {
    void saved.catch((error: Error): void => {
      // The original Store publishes persistent recovery facts, including when this view retires.
      this.refreshAppearanceSaveRecovery(lifecycleToken);
      hilog.warn(0x5244, 'Reader', '%{private}s', `Appearance save pending: ${error.message}`);
    });
  }

  private showAppearanceFailure(message: string, error: Error): void {
    hilog.warn(0x5244, 'Reader', '%{private}s', `ReadingExperience appearance failed: ${error.message}`);
    try {
      this.transientFeedback.show(() => this.window.uiContext(), { message },
        (): boolean => this.currentFeedbackOwner());
    } catch (_) {
      // A missing presentation context must not discard accepted settings.
    }
  }

  private currentFeedbackOwner(): boolean {
    return this.lifetime.sessionActive(this.lifetime.scope().lifecycleToken) &&
      this.window.foreground() && this.window.chromeActive();
  }
}
