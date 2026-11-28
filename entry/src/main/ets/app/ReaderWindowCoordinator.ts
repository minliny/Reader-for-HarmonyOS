import { display, window, KeyboardAvoidMode } from '@kit.ArkUI';
import type { Configuration } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { deviceInfo, type BusinessError } from '@kit.BasicServicesKit';
import { ReaderBrightnessWriter, type ReaderBrightnessWindow } from './ReaderBrightnessWriter';
import { ReaderStatusBarMeasurement } from './ReaderStatusBarMeasurement';
import { ReaderTopSafeAreaMeasurement, type ReaderTopAvoidAreas, type ReaderTopSafeAreaPhase }
  from './ReaderTopSafeAreaMeasurement';
import { ReaderBottomSafeAreaMeasurement, type ReaderBottomAvoidAreas, type ReaderBottomSafeAreaPhase }
  from './ReaderBottomSafeAreaMeasurement';
import { ReaderNativeAlertWindow } from '../ui/platform/ReaderNativeAlertWindow';
import { ReaderDocumentPickerActivity } from '../platform/ReaderDocumentPickerActivity';
import { bindReaderWindowMetricsSource } from '../ui/foundation/ReaderWindowEnvironment';
import { findReaderTheme } from '../ui/foundation/ReaderThemeRegistry';
import {
  ReaderInsetsVp,
  ReaderKeyboardAreaVp,
  ReaderRectVp,
  ReaderDisplayCornerVp,
  ReaderWindowMetricsSnapshot,
  createDefaultReaderWindowMetrics,
} from '../ui/foundation/ReaderWindowMetrics';

export type ReaderWindowChromeOwner = 'app' | 'reader' | 'overlay';
export type ReaderWindowChromeTone = 'light' | 'dark';
export type ReaderWindowOrientationPolicy = 'system' | 'portrait' | 'landscape';
export type ReaderWindowKeyboardAvoidance = 'system' | 'local';

/** One mounted reader's authority; an obsolete callback cannot reclaim a window. */
export class ReaderWindowPolicyOwner {
  private readonly current: () => boolean;
  constructor(current: () => boolean) { this.current = current; }
  accepts(): boolean { try { return this.current(); } catch (_error) { return false; } }
}

class ReaderWindowKeyboardOverride {
  readonly owner: ReaderWindowPolicyOwner;
  readonly win: window.Window;
  readonly installEpoch: number;
  constructor(owner: ReaderWindowPolicyOwner, win: window.Window, installEpoch: number) {
    this.owner = owner; this.win = win; this.installEpoch = installEpoch;
  }
}

/** Semantic reader-owned window behavior; raw Harmony enums stay in this host. */
export class ReaderWindowPolicy {
  orientation: ReaderWindowOrientationPolicy;
  keepScreenOn: boolean;
  hideStatusBar: boolean;
  hideNavigationBar: boolean;
  extendIntoCutout: boolean;
  keyboardAvoidance: ReaderWindowKeyboardAvoidance;

  constructor(
    orientation: ReaderWindowOrientationPolicy = 'system',
    keepScreenOn: boolean = false,
    hideStatusBar: boolean = false,
    hideNavigationBar: boolean = false,
    extendIntoCutout: boolean = false,
    keyboardAvoidance: ReaderWindowKeyboardAvoidance = 'system',
  ) {
    this.orientation = orientation;
    this.keepScreenOn = keepScreenOn;
    this.hideStatusBar = hideStatusBar;
    this.hideNavigationBar = hideNavigationBar;
    this.extendIntoCutout = extendIntoCutout;
    this.keyboardAvoidance = keyboardAvoidance;
  }
}

/** One atomic system-bar visual: the painted underlay and matching foreground. */
export class ReaderWindowChromeStyle {
  underlayColor: string;
  tone: ReaderWindowChromeTone;
  /** Exact opaque foreground from the owning surface's semantic palette. */
  contentColor: string;
  /** Non-empty only when the reader paints the matching full paper below chrome. */
  paperThemeId: string;
  /** Image readers paint through both system bands; their content background stays opaque. */
  transparentSystemBars: boolean;
  /** A bottom sheet may paint a different navigation band from the top scrim. */
  navigationUnderlayColor?: string;
  navigationContentColor?: string;

  constructor(underlayColor: string, tone: ReaderWindowChromeTone, contentColor?: string,
    paperThemeId: string = '', transparentSystemBars: boolean = false) {
    this.underlayColor = underlayColor;
    this.tone = tone;
    // Keep tone as a compatibility fallback while reader-owned chrome passes
    // the active theme's exact ink color.
    this.contentColor = contentColor ?? (tone === 'light' ? '#FFFFFFFF' : '#FF000000');
    this.paperThemeId = findReaderTheme(paperThemeId)?.id ?? '';
    this.transparentSystemBars = transparentSystemBars;
  }
}

class ReaderWindowChromeRequest {
  owner: ReaderWindowChromeOwner;
  style: ReaderWindowChromeStyle;

  constructor(owner: ReaderWindowChromeOwner, style: ReaderWindowChromeStyle) {
    this.owner = owner;
    this.style = style;
  }
}

interface ReaderWindowChromeDiagnostic {
  result: 'applied' | 'write-failed';
  owner: ReaderWindowChromeOwner;
  revision: number;
  currentWindow: boolean;
  expectedStatusBg: string;
  expectedForeground: string;
  underlayColor: string;
  paperThemeId: string;
  nativeReadback: 'known' | 'unavailable' | 'failed' | 'not-read';
  nativeBackground: string;
  nativeForeground: string;
  errorCode: string;
  readbackErrorCode: string;
  metricsRevisionAtRequest: number;
  statusRectAtRequest: ReaderRectVp;
  windowRectAtRequest: ReaderRectVp;
}

interface ReaderWindowPolicyStep {
  name: string;
  write: () => void | Promise<void>;
  supported?: boolean;
}

interface ReaderWindowStepResult {
  applied: boolean;
  failure?: Error;
}

const APP_CHROME_STYLE = new ReaderWindowChromeStyle('#F8F4EC', 'dark', '#FF2B241D');

/**
 * The single HarmonyOS window boundary for Reader.
 *
 * It owns Window callbacks and system-bar writes. UI components consume a vp
 * snapshot and request one semantic underlay/tone style; they never retain Window or
 * inspect px avoid areas themselves.
 */
export class ReaderWindowCoordinator {
  private static appChromeStyle: ReaderWindowChromeStyle = APP_CHROME_STYLE;
  private static mainWindow: window.Window | undefined = undefined;
  private static brightnessWriter: ReaderBrightnessWriter = new ReaderBrightnessWriter(
    (): Promise<ReaderBrightnessWindow> => {
      const win = ReaderWindowCoordinator.mainWindow;
      return win === undefined ? Promise.reject(new Error('Reader main window is unavailable')) :
        Promise.resolve(win);
    });
  private static metricsSnapshot: ReaderWindowMetricsSnapshot = createDefaultReaderWindowMetrics();
  private static configurationFontScale: number | undefined = undefined;
  private static uiConfigurationRevision: number = 0;
  private static statusBarMeasurement: ReaderStatusBarMeasurement = new ReaderStatusBarMeasurement();
  private static statusBarHiddenApplied: boolean = false;
  // A visibility Promise acknowledges the request, not the visible avoid area.
  // Retain this window geometry's measured band until the reveal is observed.
  private static statusBarRevealPending: boolean = false;
  private static readonly topSafeAreaMeasurement: ReaderTopSafeAreaMeasurement = new ReaderTopSafeAreaMeasurement();
  private static topSafeAreaRevealPending: boolean = false;
  private static topSafeAreaAwaitingWrite: boolean = false;
  private static readonly bottomSafeAreaMeasurement: ReaderBottomSafeAreaMeasurement = new ReaderBottomSafeAreaMeasurement();
  private static navigationBarHiddenApplied: boolean = false;
  private static navigationIndicatorHiddenApplied: boolean = false;
  private static bottomSafeAreaRevealPending: boolean = false;
  private static bottomSafeAreaAwaitingWrite: boolean = false;
  private static windowRectListener: ((options: window.RectChangeOptions) => void) | undefined = undefined;
  private static displayChangeListener: ((id: number) => void) | undefined = undefined;
  private static windowSizeListener: ((size: window.Size) => void) | undefined = undefined;
  private static avoidAreaListener: ((options: window.AvoidAreaOptions) => void) | undefined = undefined;
  private static desiredChrome: ReaderWindowChromeRequest =
    new ReaderWindowChromeRequest('app', APP_CHROME_STYLE);
  private static desiredChromeRevision: number = 0;
  private static appliedChromeRevision: number = -1;
  private static limitedChromeRevision: number = -1;
  private static chromeRequestedEpoch: number = -1;
  private static chromeFlushRunning: boolean = false;
  private static appOrientation: window.Orientation = window.Orientation.UNSPECIFIED;
  private static appKeepScreenOn: boolean = false;
  private static windowPolicyRevision: number = 0;
  private static windowPolicyTail: Promise<void> = Promise.resolve();
  private static desiredWindowPolicyOwner: 'app' | 'reader' = 'app';
  private static desiredReaderWindowPolicy: ReaderWindowPolicy = new ReaderWindowPolicy();
  private static desiredReaderWindowOwner: ReaderWindowPolicyOwner | undefined = undefined;
  // Capture lazily: install() precedes loadContent(), when UIContext may not exist.
  private static appKeyboardAvoidMode: KeyboardAvoidMode | undefined = undefined;
  // Exactly one temporary TTS manager override, bound to its reader/window.
  private static keyboardOverride: ReaderWindowKeyboardOverride | undefined = undefined;
  private static appliedPolicyRevision: number = -1;
  // A known unsupported step settles the policy without a complete native ACK.
  private static limitedPolicyRevision: number = -1;
  /**
   * Install/detach race guard. detach() and every install() bump this epoch;
   * each await inside install() re-checks it, so an async install that has been
   * superseded (window destroyed, new window installed, or detach) aborts
   * before registering stale listeners on a dead window or clobbering the new
   * coordinator state.
   */
  private static installEpoch: number = 0;

  static diagnosticWindowId(): number | null {
    try {
      return ReaderWindowCoordinator.mainWindow?.getWindowProperties().id ?? null;
    } catch (_) {
      return null;
    }
  }

  static async install(win: window.Window, configuration?: Configuration, appOrientation?: window.Orientation): Promise<boolean> {
    ReaderWindowCoordinator.detach();
    ReaderWindowCoordinator.installEpoch += 1;
    const epoch = ReaderWindowCoordinator.installEpoch;
    const properties = win.getWindowProperties();
    ReaderWindowCoordinator.mainWindow = win;
    ReaderWindowCoordinator.configurationFontScale = ReaderWindowCoordinator.validConfigurationFontScale(configuration?.fontSizeScale);
    // Listener reinstall can reuse the same live window. Only the Ability's
    // actual destruction path retires its native dialog attachments.
    ReaderNativeAlertWindow.bind(properties.id);
    ReaderDocumentPickerActivity.bind(properties.id);
    ReaderDocumentPickerActivity.setForeground(AppStorage.get<boolean>('readerAppForeground') !== false);
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'app';
    ReaderWindowCoordinator.topSafeAreaRevealPending = true;
    ReaderWindowCoordinator.topSafeAreaAwaitingWrite = true;
    ReaderWindowCoordinator.bottomSafeAreaRevealPending = true;
    ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite = true;
    ReaderWindowCoordinator.appOrientation = appOrientation ?? window.Orientation.UNSPECIFIED;
    ReaderWindowCoordinator.appKeepScreenOn = properties.isKeepScreenOn;
    ReaderWindowCoordinator.registerWindowListeners(win);
    ReaderWindowCoordinator.refreshPolicyMetrics();
    const systemBarsSupported = !ReaderWindowCoordinator.isTwoInOneDevice();
    if (appOrientation === undefined && systemBarsSupported) {
      try { ReaderWindowCoordinator.appOrientation = win.getPreferredOrientation(); }
      catch (error) { ReaderWindowCoordinator.reportWindowStepFailure('initial-orientation-read', error as BusinessError); }
    }
    await ReaderWindowCoordinator.attemptWindowStep('fullscreen', (): Promise<void> => win.setWindowLayoutFullScreen(true));
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) return false;
    await ReaderWindowCoordinator.attemptWindowStep('initial-system-bars',
      (): Promise<void> => win.setWindowSystemBarEnable(['status', 'navigation']), systemBarsSupported);
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) return false;
    ReaderWindowCoordinator.topSafeAreaAwaitingWrite = false;
    ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite = false;
    if (appOrientation !== undefined) {
      try { await ReaderWindowCoordinator.requestAppWindowPolicy(); }
      catch (_) { /* Individual failed writes have been recorded and remain retryable. */ }
      if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) return false;
    }
    ReaderWindowCoordinator.refreshPolicyMetrics();
    ReaderWindowCoordinator.publishUiConfigurationRevision();
    ReaderWindowCoordinator.requestAppChrome();
    return true;
  }

  /**
   * True when `win` is still the installed main window and no newer install
   * or detach claimed the coordinator during an await boundary.
   */
  private static installStillCurrent(epoch: number, win: window.Window): boolean {
    return epoch === ReaderWindowCoordinator.installEpoch &&
      win === ReaderWindowCoordinator.mainWindow;
  }

  static detach(): void {
    ReaderWindowCoordinator.brightnessWriter.reset();
    ReaderWindowCoordinator.statusBarMeasurement = new ReaderStatusBarMeasurement();
    ReaderWindowCoordinator.statusBarHiddenApplied = false;
    ReaderWindowCoordinator.statusBarRevealPending = false;
    ReaderWindowCoordinator.topSafeAreaMeasurement.reset();
    ReaderWindowCoordinator.topSafeAreaRevealPending = false;
    ReaderWindowCoordinator.topSafeAreaAwaitingWrite = false;
    ReaderWindowCoordinator.bottomSafeAreaMeasurement.reset();
    ReaderWindowCoordinator.navigationBarHiddenApplied = false;
    ReaderWindowCoordinator.navigationIndicatorHiddenApplied = false;
    ReaderWindowCoordinator.bottomSafeAreaRevealPending = false;
    ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite = false;
    const win = ReaderWindowCoordinator.mainWindow;
    if (win !== undefined && ReaderWindowCoordinator.appKeyboardAvoidMode !== undefined) {
      try { win.getUIContext().setKeyboardAvoidMode(ReaderWindowCoordinator.appKeyboardAvoidMode); }
      catch (_error) { /* A destroyed window has no surviving keyboard policy. */ }
    }
    ReaderWindowCoordinator.appKeyboardAvoidMode = undefined;
    ReaderWindowCoordinator.keyboardOverride = undefined;
    ReaderWindowCoordinator.desiredReaderWindowOwner = undefined;
    if (win !== undefined && ReaderWindowCoordinator.windowSizeListener !== undefined) {
      try { win.off('windowSizeChange', ReaderWindowCoordinator.windowSizeListener); } catch (_error) {}
    }
    if (win !== undefined && ReaderWindowCoordinator.avoidAreaListener !== undefined) {
      try { win.off('avoidAreaChange', ReaderWindowCoordinator.avoidAreaListener); } catch (_error) {}
    }
    if (win !== undefined && ReaderWindowCoordinator.windowRectListener !== undefined) {
      try { win.off('windowRectChange', ReaderWindowCoordinator.windowRectListener); } catch (_error) {}
      try { win.off('rectChangeInGlobalDisplay', ReaderWindowCoordinator.windowRectListener); } catch (_error) {}
    }
    if (ReaderWindowCoordinator.displayChangeListener !== undefined) {
      try { display.off('change', ReaderWindowCoordinator.displayChangeListener); } catch (_error) {}
    }
    ReaderWindowCoordinator.windowRectListener = undefined;
    ReaderWindowCoordinator.displayChangeListener = undefined;
    ReaderWindowCoordinator.installEpoch += 1;
    ReaderWindowCoordinator.mainWindow = undefined;
    ReaderWindowCoordinator.configurationFontScale = undefined;
    ReaderWindowCoordinator.windowPolicyRevision += 1;
    ReaderWindowCoordinator.windowSizeListener = undefined;
    ReaderWindowCoordinator.avoidAreaListener = undefined;
    ReaderWindowCoordinator.appliedPolicyRevision = -1;
    ReaderWindowCoordinator.limitedPolicyRevision = -1;
    ReaderWindowCoordinator.appliedChromeRevision = -1;
    ReaderWindowCoordinator.limitedChromeRevision = -1;
    if (win !== undefined) ReaderWindowCoordinator.publishUiConfigurationRevision();
  }

  static destroyWindow(): void {
    ReaderNativeAlertWindow.destroy();
    ReaderDocumentPickerActivity.destroy();
    ReaderWindowCoordinator.detach();
  }

  static metrics(): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metricsSnapshot;
  }

  static isTabletDevice(): boolean {
    return deviceInfo.deviceType === 'tablet';
  }

  private static isTwoInOneDevice(): boolean { return deviceInfo.deviceType === '2in1'; }

  static brightness(): ReaderBrightnessWriter {
    return ReaderWindowCoordinator.brightnessWriter;
  }

  static requestAppChrome(): void {
    ReaderWindowCoordinator.requestChrome(new ReaderWindowChromeRequest('app', ReaderWindowCoordinator.appChromeStyle));
  }

  static updateAppChromeStyle(style: ReaderWindowChromeStyle): void {
    ReaderWindowCoordinator.appChromeStyle = style;
    if (ReaderWindowCoordinator.desiredChrome.owner === 'app') ReaderWindowCoordinator.requestAppChrome();
  }

  static requestReaderChrome(style: ReaderWindowChromeStyle): void {
    ReaderWindowCoordinator.requestChrome(new ReaderWindowChromeRequest('reader', style));
  }

  static requestOverlayChrome(inheritedReaderStyle: ReaderWindowChromeStyle): void {
    // Current reader overlays do not paint an independent full system-bar band.
    // They inherit the exact reading underlay/tone pair instead of overriding
    // only the icon tone and disconnecting it from the pixels below the bar.
    ReaderWindowCoordinator.requestChrome(new ReaderWindowChromeRequest('overlay', inheritedReaderStyle));
  }

  /**
   * Serialize orientation, keep-screen and system-bar writes through the
   * Ability-owned main window. A superseded request never starts; an already
   * running request is followed by the newest revision, so the last intent is
   * also the final device state.
   */
  static requestReaderWindowPolicy(policy: ReaderWindowPolicy, owner?: ReaderWindowPolicyOwner): Promise<void> {
    if (owner !== undefined && !owner.accepts()) return Promise.resolve();
    const sameOwner = ReaderWindowCoordinator.desiredReaderWindowOwner === owner;
    // Opening controls can leave both visibility and geometry unchanged.
    // Retry a pending theme write even when the window policy is deduplicated;
    // applied and unsupported styles perform no native write here.
    if (!policy.hideStatusBar) void ReaderWindowCoordinator.flushChrome();
    if (sameOwner && ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.sameWindowPolicy(
        ReaderWindowCoordinator.desiredReaderWindowPolicy, policy) &&
      ReaderWindowCoordinator.currentPolicySettled()) {
      return Promise.resolve();
    }
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'reader';
    ReaderWindowCoordinator.desiredReaderWindowOwner = owner;
    ReaderWindowCoordinator.desiredReaderWindowPolicy = policy;
    ReaderWindowCoordinator.beginTopSafeAreaPolicyChange(policy.hideStatusBar);
    ReaderWindowCoordinator.beginBottomSafeAreaPolicyChange(policy.hideNavigationBar);
    const revision = ReaderWindowCoordinator.nextWindowPolicyRevision();
    AppStorage.setOrCreate<string>('readerWindowOrientation', policy.orientation);
    AppStorage.setOrCreate<boolean>('readerWindowKeepScreenOn', policy.keepScreenOn);
    AppStorage.setOrCreate<boolean>('readerWindowHideStatusBar', policy.hideStatusBar);
    AppStorage.setOrCreate<boolean>('readerWindowHideNavigationBar', policy.hideNavigationBar);
    AppStorage.setOrCreate<boolean>('readerWindowExtendIntoCutout', policy.extendIntoCutout);
    return ReaderWindowCoordinator.enqueueWindowPolicy(revision,
      (win: window.Window): Promise<boolean> => ReaderWindowCoordinator.applyWindowPolicy(win, revision,
        ReaderWindowCoordinator.orientationValue(policy.orientation), policy.keepScreenOn,
        policy.hideStatusBar, policy.hideNavigationBar));
  }

  /** Restore the app policy captured when the Ability installed the window. */
  static requestAppWindowPolicy(owner?: ReaderWindowPolicyOwner): Promise<void> {
    if (owner !== undefined && (ReaderWindowCoordinator.desiredWindowPolicyOwner !== 'reader' ||
      ReaderWindowCoordinator.desiredReaderWindowOwner !== owner)) return Promise.resolve();
    if (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'app' &&
      ReaderWindowCoordinator.currentPolicySettled()) {
      return Promise.resolve();
    }
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'app';
    ReaderWindowCoordinator.desiredReaderWindowOwner = undefined;
    ReaderWindowCoordinator.beginTopSafeAreaPolicyChange(false);
    ReaderWindowCoordinator.beginBottomSafeAreaPolicyChange(false);
    const revision = ReaderWindowCoordinator.nextWindowPolicyRevision();
    AppStorage.setOrCreate<string>('readerWindowOrientation', 'app');
    AppStorage.setOrCreate<boolean>('readerWindowKeepScreenOn', ReaderWindowCoordinator.appKeepScreenOn);
    AppStorage.setOrCreate<boolean>('readerWindowHideStatusBar', false);
    AppStorage.setOrCreate<boolean>('readerWindowHideNavigationBar', false);
    AppStorage.setOrCreate<boolean>('readerWindowExtendIntoCutout', false);
    return ReaderWindowCoordinator.enqueueWindowPolicy(revision,
      (win: window.Window): Promise<boolean> => ReaderWindowCoordinator.applyWindowPolicy(win, revision,
        ReaderWindowCoordinator.appOrientation, ReaderWindowCoordinator.appKeepScreenOn, false, false));
  }

  /** Reapply the latest semantic policy after foreground/window restoration. */
  static reapplyWindowPolicy(): void {
    // Native state may have changed while the Ability was in the background.
    // Revoke only the applied receipt; the ordinary request path still owns
    // serialization and supersedes this restore when a newer intent arrives.
    ReaderWindowCoordinator.appliedPolicyRevision = -1;
    ReaderWindowCoordinator.limitedPolicyRevision = -1;
    const restore = ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' ?
      ReaderWindowCoordinator.requestReaderWindowPolicy(ReaderWindowCoordinator.desiredReaderWindowPolicy,
        ReaderWindowCoordinator.desiredReaderWindowOwner) :
      ReaderWindowCoordinator.requestAppWindowPolicy();
    // Individual steps record the failure. The next explicit admission owns
    // the retry; foreground recovery only consumes the rejection here.
    void restore.catch((_error: Error): void => {});
  }

  /** TTS manager keeps its existing RESIZE behavior without restoring a stale
   * native snapshot over a different reader. Closing the reader makes this
   * override inactive; revealing the same retained owner admits it again. */
  static acquireReaderKeyboardResize(): (() => void) | undefined {
    const win = ReaderWindowCoordinator.mainWindow, owner = ReaderWindowCoordinator.desiredReaderWindowOwner;
    if (win === undefined || owner === undefined || !owner.accepts() ||
      ReaderWindowCoordinator.desiredWindowPolicyOwner !== 'reader') return undefined;
    const request = new ReaderWindowKeyboardOverride(owner, win, ReaderWindowCoordinator.installEpoch);
    ReaderWindowCoordinator.keyboardOverride = request;
    ReaderWindowCoordinator.applyKeyboardAvoidance(win);
    return (): void => {
      if (ReaderWindowCoordinator.keyboardOverride !== request) return;
      ReaderWindowCoordinator.keyboardOverride = undefined;
      if (win !== ReaderWindowCoordinator.mainWindow || request.installEpoch !== ReaderWindowCoordinator.installEpoch ||
        ReaderWindowCoordinator.desiredWindowPolicyOwner !== 'reader' ||
        ReaderWindowCoordinator.desiredReaderWindowOwner !== owner || !owner.accepts()) return;
      ReaderWindowCoordinator.applyKeyboardAvoidance(win);
    };
  }

  private static applyKeyboardAvoidance(win: window.Window): void {
    if (win !== ReaderWindowCoordinator.mainWindow) return;
    const reader = ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader';
    // An App-only foreground/install must not ask for UIContext before content exists.
    if (!reader && ReaderWindowCoordinator.appKeyboardAvoidMode === undefined) return;
    const context = win.getUIContext();
    ReaderWindowCoordinator.appKeyboardAvoidMode ??= context.getKeyboardAvoidMode();
    const owner = ReaderWindowCoordinator.desiredReaderWindowOwner, temporary = ReaderWindowCoordinator.keyboardOverride;
    const resize = reader && owner !== undefined && owner.accepts() && temporary !== undefined && temporary.owner === owner &&
      temporary.win === win && temporary.installEpoch === ReaderWindowCoordinator.installEpoch;
    const mode = resize ? KeyboardAvoidMode.RESIZE : reader &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.keyboardAvoidance === 'local' ? KeyboardAvoidMode.NONE :
      ReaderWindowCoordinator.appKeyboardAvoidMode;
    if (context.getKeyboardAvoidMode() !== mode) context.setKeyboardAvoidMode(mode);
  }

  static reapplyChrome(): void {
    if (ReaderWindowCoordinator.appliedChromeRevision === ReaderWindowCoordinator.desiredChromeRevision) {
      ReaderWindowCoordinator.appliedChromeRevision = -1;
    }
    void ReaderWindowCoordinator.flushChrome();
  }

  /** Ability Configuration owns app font scale; Display owns px/vp density.
   * A configuration receipt must identify the exact currently installed window. */
  static refreshConfiguration(configuration?: Configuration, expectedWindow?: window.Window): void {
    const win = ReaderWindowCoordinator.mainWindow;
    if (win === undefined || (expectedWindow !== undefined && expectedWindow !== win) ||
      (configuration !== undefined && expectedWindow !== win)) return;
    const scale = ReaderWindowCoordinator.validConfigurationFontScale(configuration?.fontSizeScale);
    if (scale !== undefined) ReaderWindowCoordinator.configurationFontScale = scale;
    ReaderWindowCoordinator.refreshPolicyMetrics();
    ReaderWindowCoordinator.publishUiConfigurationRevision();
  }

  private static validConfigurationFontScale(value: number | undefined): number | undefined {
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private static publishUiConfigurationRevision(): void {
    const revision = ReaderWindowCoordinator.uiConfigurationRevision >= Number.MAX_SAFE_INTEGER ?
      1 : ReaderWindowCoordinator.uiConfigurationRevision + 1;
    ReaderWindowCoordinator.uiConfigurationRevision = revision;
    AppStorage.setOrCreate<number>('readerUiConfigurationRevision', revision);
  }

  private static registerWindowListeners(win: window.Window): void {
    const epoch = ReaderWindowCoordinator.installEpoch;
    const refreshCurrent = (): void => {
      if (ReaderWindowCoordinator.mainWindow === win && ReaderWindowCoordinator.installEpoch === epoch) {
        ReaderWindowCoordinator.refreshPolicyMetrics();
      }
    };
    ReaderWindowCoordinator.windowSizeListener = (_size: window.Size): void => {
      refreshCurrent();
    };
    ReaderWindowCoordinator.avoidAreaListener = (_options: window.AvoidAreaOptions): void => {
      refreshCurrent();
    };
    try { win.on('windowSizeChange', ReaderWindowCoordinator.windowSizeListener); }
    catch (error) { ReaderWindowCoordinator.reportWindowStepFailure('window-size-listener', error as BusinessError); }
    try { win.on('avoidAreaChange', ReaderWindowCoordinator.avoidAreaListener); }
    catch (error) { ReaderWindowCoordinator.reportWindowStepFailure('avoid-area-listener', error as BusinessError); }
    ReaderWindowCoordinator.windowRectListener = (_options: window.RectChangeOptions): void => {
      refreshCurrent();
    };
    ReaderWindowCoordinator.displayChangeListener = (_id: number): void => {
      refreshCurrent();
    };
    // Position-only moves and same-size rotation need a refresh too. Snapshot
    // equality below deduplicates overlapping size/rect/avoid notifications.
    try { win.on('windowRectChange', ReaderWindowCoordinator.windowRectListener); } catch (_error) {}
    try { win.on('rectChangeInGlobalDisplay', ReaderWindowCoordinator.windowRectListener); } catch (_error) {}
    try { display.on('change', ReaderWindowCoordinator.displayChangeListener); } catch (_error) {}
  }

  private static nextWindowPolicyRevision(): number {
    ReaderWindowCoordinator.windowPolicyRevision =
      ReaderWindowCoordinator.windowPolicyRevision >= Number.MAX_SAFE_INTEGER ?
        1 : ReaderWindowCoordinator.windowPolicyRevision + 1;
    return ReaderWindowCoordinator.windowPolicyRevision;
  }

  private static currentPolicySettled(): boolean {
    const revision = ReaderWindowCoordinator.windowPolicyRevision;
    return ReaderWindowCoordinator.appliedPolicyRevision === revision ||
      ReaderWindowCoordinator.limitedPolicyRevision === revision;
  }

  private static windowPolicyStillCurrent(win: window.Window, epoch: number, revision: number): boolean {
    const owner = ReaderWindowCoordinator.desiredReaderWindowOwner;
    return ReaderWindowCoordinator.installStillCurrent(epoch, win) &&
      revision === ReaderWindowCoordinator.windowPolicyRevision &&
      (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'app' || owner === undefined || owner.accepts());
  }

  private static enqueueWindowPolicy(
    revision: number,
    apply: (win: window.Window) => Promise<boolean>,
  ): Promise<void> {
    const operation = ReaderWindowCoordinator.windowPolicyTail
      .catch((_error: Error): void => {})
      .then(async (): Promise<void> => {
        const win = ReaderWindowCoordinator.mainWindow;
        const epoch = ReaderWindowCoordinator.installEpoch;
        if (revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
        if (win === undefined) throw new Error('Reader main window is unavailable');
        if (!ReaderWindowCoordinator.windowPolicyStillCurrent(win, epoch, revision)) return;
        try {
          const applied = await apply(win);
          if (!ReaderWindowCoordinator.windowPolicyStillCurrent(win, epoch, revision)) return;
          ReaderWindowCoordinator.appliedPolicyRevision = applied ? revision : -1;
          ReaderWindowCoordinator.limitedPolicyRevision = applied ? -1 : revision;
        } finally {
          // Successful siblings can change the real window even when another
          // write failed. Publish their geometry before rejecting to the caller.
          if (ReaderWindowCoordinator.windowPolicyStillCurrent(win, epoch, revision)) {
            ReaderWindowCoordinator.topSafeAreaAwaitingWrite = false;
            ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite = false;
            ReaderWindowCoordinator.refreshPolicyMetrics();
          }
        }
      });
    ReaderWindowCoordinator.windowPolicyTail = operation.catch((_error: Error): void => {});
    return operation;
  }

  private static async applyWindowPolicy(win: window.Window, revision: number,
    orientation: window.Orientation, keepScreenOn: boolean, hideStatusBar: boolean,
    hideNavigationBar: boolean): Promise<boolean> {
    const epoch = ReaderWindowCoordinator.installEpoch;
    const orientationAndBarsSupported = !ReaderWindowCoordinator.isTwoInOneDevice();
    const steps: ReaderWindowPolicyStep[] = [
      { name: 'keyboard-avoidance', write: (): void => ReaderWindowCoordinator.applyKeyboardAvoidance(win) },
      { name: 'orientation', supported: orientationAndBarsSupported,
        write: (): Promise<void> => win.setPreferredOrientation(orientation) },
      { name: 'status', supported: orientationAndBarsSupported,
        write: (): Promise<void> => ReaderWindowCoordinator.applyStatusBarPolicy(win, epoch, hideStatusBar) },
      { name: 'navigation', supported: orientationAndBarsSupported,
        write: (): Promise<void> => ReaderWindowCoordinator.applyBottomBarPolicy(win, epoch, 'navigation', hideNavigationBar) },
      { name: 'navigation-indicator', supported: orientationAndBarsSupported,
        write: (): Promise<void> => ReaderWindowCoordinator.applyBottomBarPolicy(win, epoch, 'navigationIndicator', hideNavigationBar) },
      { name: 'keep-screen-on', write: (): Promise<void> => win.setWindowKeepScreenOn(keepScreenOn) },
    ];
    let firstFailure: Error | undefined = undefined;
    let applied = true;
    for (const step of steps) {
      if (!ReaderWindowCoordinator.windowPolicyStillCurrent(win, epoch, revision)) return false;
      const result = await ReaderWindowCoordinator.attemptWindowStep(step.name, step.write, step.supported);
      applied = applied && result.applied;
      firstFailure ??= result.failure;
    }
    if (firstFailure !== undefined) throw firstFailure;
    return applied;
  }

  private static async applyStatusBarPolicy(win: window.Window, epoch: number, hidden: boolean): Promise<void> {
    const previousReveal = ReaderWindowCoordinator.statusBarRevealPending;
    ReaderWindowCoordinator.statusBarRevealPending = !hidden &&
      (previousReveal || ReaderWindowCoordinator.statusBarHiddenApplied);
    try {
      await win.setSpecificSystemBarEnabled('status', !hidden, false);
      if (ReaderWindowCoordinator.installStillCurrent(epoch, win)) ReaderWindowCoordinator.statusBarHiddenApplied = hidden;
    } catch (error) {
      if (ReaderWindowCoordinator.installStillCurrent(epoch, win)) ReaderWindowCoordinator.statusBarRevealPending = previousReveal;
      throw error;
    }
  }

  private static beginTopSafeAreaPolicyChange(hidden: boolean): void {
    if (hidden || ReaderWindowCoordinator.statusBarHiddenApplied) {
      ReaderWindowCoordinator.topSafeAreaRevealPending = true;
    }
    ReaderWindowCoordinator.topSafeAreaAwaitingWrite = ReaderWindowCoordinator.topSafeAreaRevealPending;
  }

  private static beginBottomSafeAreaPolicyChange(hidden: boolean): void {
    if (hidden || ReaderWindowCoordinator.navigationBarHiddenApplied || ReaderWindowCoordinator.navigationIndicatorHiddenApplied) {
      ReaderWindowCoordinator.bottomSafeAreaRevealPending = true;
    }
    ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite = ReaderWindowCoordinator.bottomSafeAreaRevealPending;
  }

  private static async applyBottomBarPolicy(win: window.Window, epoch: number,
    bar: 'navigation' | 'navigationIndicator', hidden: boolean): Promise<void> {
    await win.setSpecificSystemBarEnabled(bar, !hidden, false);
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) return;
    // A superseded policy can still change the bars of this same native window.
    if (bar === 'navigation') ReaderWindowCoordinator.navigationBarHiddenApplied = hidden;
    else ReaderWindowCoordinator.navigationIndicatorHiddenApplied = hidden;
  }

  private static topSafeAreaPhase(): ReaderTopSafeAreaPhase {
    const hidden = ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.hideStatusBar;
    if (hidden || ReaderWindowCoordinator.statusBarHiddenApplied ||
      ReaderWindowCoordinator.topSafeAreaAwaitingWrite) return 'hidden';
    return ReaderWindowCoordinator.topSafeAreaRevealPending ? 'revealing' : 'stable';
  }

  private static bottomSafeAreaPhase(): ReaderBottomSafeAreaPhase {
    const hidden = ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.hideNavigationBar;
    if (hidden || ReaderWindowCoordinator.navigationBarHiddenApplied || ReaderWindowCoordinator.navigationIndicatorHiddenApplied ||
      ReaderWindowCoordinator.bottomSafeAreaAwaitingWrite) return 'hidden';
    return ReaderWindowCoordinator.bottomSafeAreaRevealPending ? 'revealing' : 'stable';
  }

  private static async attemptWindowStep(name: string, write: () => void | Promise<void>,
    supported: boolean = true): Promise<ReaderWindowStepResult> {
    if (!supported) {
      ReaderWindowCoordinator.logWindowStep(name, 'unsupported', '2in1');
      return { applied: false };
    }
    try {
      await write();
      return { applied: true };
    } catch (error) {
      const code = ReaderWindowCoordinator.reportWindowStepFailure(name, error as BusinessError);
      if (code === '801') return { applied: false };
      return { applied: false, failure: (error as Error | undefined) ?? new Error('Native window step failed') };
    }
  }

  private static reportWindowStepFailure(name: string, error: BusinessError): string {
    const code = ReaderWindowCoordinator.chromeErrorCode(error);
    ReaderWindowCoordinator.logWindowStep(name, code === '801' ? 'unsupported' : 'failed', code);
    return code;
  }

  private static logWindowStep(name: string, outcome: 'unsupported' | 'failed', code: string): void {
    try { hilog.warn(0x5244, 'Reader', 'Window step %{public}s %{public}s: %{public}s', name, outcome, code); }
    catch (_) { /* A diagnostic sink never owns a native window write. */ }
  }

  private static refreshPolicyMetrics(): void {
    try { ReaderWindowCoordinator.refreshMetrics(); }
    catch (error) { ReaderWindowCoordinator.reportWindowStepFailure('metrics', error as BusinessError); }
  }

  private static orientationValue(policy: ReaderWindowOrientationPolicy): window.Orientation {
    if (policy === 'portrait') {
      return window.Orientation.PORTRAIT;
    }
    if (policy === 'landscape') {
      return window.Orientation.LANDSCAPE;
    }
    return window.Orientation.AUTO_ROTATION_UNSPECIFIED;
  }

  private static refreshMetrics(): void {
    const win = ReaderWindowCoordinator.mainWindow;
    if (win === undefined) {
      return;
    }
    const properties = win.getWindowProperties();
    const displayInfo = ReaderWindowCoordinator.windowDisplay(properties.displayId);
    const density = Number.isFinite(displayInfo.densityPixels) && displayInfo.densityPixels > 0 ?
      displayInfo.densityPixels : 1;
    const scaledDensity = Number.isFinite(displayInfo.scaledDensity) && displayInfo.scaledDensity > 0 ?
      displayInfo.scaledDensity : density;
    const globalRect = properties.globalDisplayRect ?? properties.windowRect;
    const windowRect = ReaderWindowCoordinator.rectVp(properties.windowRect, density);
    const globalRectVp = ReaderWindowCoordinator.rectVp(globalRect, density);
    const systemArea = ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM, density);
    const cutoutArea = ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_CUTOUT, density);
    const gestureArea =
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM_GESTURE, density);
    const navigationArea =
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR, density);
    const systemInsets = systemArea ?? new ReaderInsetsVp();
    const cutoutInsets = cutoutArea ?? new ReaderInsetsVp();
    const gestureInsets = gestureArea ?? new ReaderInsetsVp();
    const navigationInsets = navigationArea ?? new ReaderInsetsVp();
    const keyboardArea = ReaderWindowCoordinator.keyboardAreaVp(density);
    const keyboardInsets = ReaderWindowCoordinator.keyboardInsetsVp(keyboardArea, windowRect);
    const systemFontScale = ReaderWindowCoordinator.configurationFontScale ?? scaledDensity / density;
    const previous = ReaderWindowCoordinator.metricsSnapshot;
    // The status-bar measurement belongs to the physical display/orientation,
    // not to the app window rectangle.  Full-screen/immersive transitions
    // legitimately change window and global coordinates while the system bar
    // is hidden; keeping those values in the key discarded the last measured
    // height and made the reader fall back to its authored top inset.
    const statusMeasurementKey = `${density}:${displayInfo.id}:${displayInfo.rotation}`;
    const measuredStatusBarRect = ReaderWindowCoordinator.statusBarRectVp(density);
    // Some HarmonyOS builds publish a non-zero SYSTEM top inset before the
    // status-bar rectangle API catches up (and briefly publish an empty
    // rectangle during a hide/show transition). Preserve that platform fact
    // as a complete rectangle so downstream reading geometry can reflow from
    // the same revision instead of falling back to a fixed authored top lane.
    const statusBarRectWithInset = measuredStatusBarRect.height > 0 || systemInsets.top <= 0 ?
      measuredStatusBarRect : new ReaderRectVp(0, 0, windowRect.width, systemInsets.top);
    if (measuredStatusBarRect.height > 0 && !ReaderWindowCoordinator.statusBarHiddenApplied &&
      !(ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.hideStatusBar)) {
      ReaderWindowCoordinator.statusBarRevealPending = false;
    }
    const statusBarRect = ReaderWindowCoordinator.statusBarMeasurement.observeRect(statusMeasurementKey,
      windowRect.width > windowRect.height, statusBarRectWithInset,
      ReaderWindowCoordinator.statusBarHiddenApplied || ReaderWindowCoordinator.statusBarRevealPending ||
      (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.hideStatusBar));
    const statusBarHeight = statusBarRect.height;
    const safeAreaKey = ReaderWindowCoordinator.windowSafeAreaKey(win, density, displayInfo, globalRectVp);
    const landscape = displayInfo.width > displayInfo.height;
    const topPhase = ReaderWindowCoordinator.topSafeAreaPhase();
    const topAreas: ReaderTopAvoidAreas = { system: systemArea?.top, cutout: cutoutArea?.top,
      gesture: gestureArea?.top, navigation: navigationArea?.top };
    const stableTop = ReaderWindowCoordinator.topSafeAreaMeasurement.observe(
      safeAreaKey, landscape,
      topAreas, topPhase, topPhase === 'stable' ? undefined : ReaderWindowCoordinator.independentTopAreas(density));
    if (topPhase === 'revealing' && stableTop.restored) ReaderWindowCoordinator.topSafeAreaRevealPending = false;
    const bottomPhase = ReaderWindowCoordinator.bottomSafeAreaPhase();
    const bottomAreas: ReaderBottomAvoidAreas = { system: systemArea?.bottom, cutout: cutoutArea?.bottom,
      gesture: gestureArea?.bottom, navigation: navigationArea?.bottom };
    const stableBottom = ReaderWindowCoordinator.bottomSafeAreaMeasurement.observe(
      safeAreaKey, landscape,
      bottomAreas, bottomPhase, bottomPhase === 'stable' ? undefined : ReaderWindowCoordinator.independentBottomAreas(density));
    if (bottomPhase === 'revealing' && stableBottom.restored) ReaderWindowCoordinator.bottomSafeAreaRevealPending = false;
    const statusBarCutoutRect = ReaderWindowCoordinator.topAvoidRectVp(window.AvoidAreaType.TYPE_CUTOUT, density);
    const corners = ReaderWindowCoordinator.topCornersVp(displayInfo, globalRectVp, density);
    if (previous.ready && previous.statusBarHeight === statusBarHeight && previous.stableSafeBottom === stableBottom.interactive &&
      previous.stableVisualSafeBottom === stableBottom.visual &&
      previous.stableSafeTop === stableTop.interactive &&
      previous.stableVisualSafeTop === stableTop.visual &&
      ReaderWindowCoordinator.sameRectVp(previous.statusBarRect, statusBarRect) &&
      ReaderWindowCoordinator.sameRectVp(previous.statusBarCutoutRect, statusBarCutoutRect) &&
      ReaderWindowCoordinator.sameCornerVp(previous.topLeftCorner, corners[0]) &&
      ReaderWindowCoordinator.sameCornerVp(previous.topRightCorner, corners[1]) &&
      ReaderWindowCoordinator.sameRectVp(previous.windowRect, windowRect) &&
      ReaderWindowCoordinator.sameRectVp(previous.globalRect, globalRectVp) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.systemInsets, systemInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.cutoutInsets, cutoutInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.gestureInsets, gestureInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.navigationInsets, navigationInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.keyboardInsets, keyboardInsets) &&
      ReaderWindowCoordinator.sameKeyboardAreaVp(previous.keyboardArea, keyboardArea) &&
      previous.densityPixels === density &&
      previous.systemFontScale === systemFontScale) {
      // The revision broadcast re-renders every @StorageLink consumer including
      // the Index root; an equal-geometry event must not bump it.
      return;
    }
    const revision = ReaderWindowCoordinator.metricsSnapshot.revision >= Number.MAX_SAFE_INTEGER ?
      1 : ReaderWindowCoordinator.metricsSnapshot.revision + 1;
    ReaderWindowCoordinator.metricsSnapshot = new ReaderWindowMetricsSnapshot(
      windowRect,
      globalRectVp,
      systemInsets,
      cutoutInsets,
      gestureInsets,
      navigationInsets,
      keyboardInsets,
      density,
      systemFontScale,
      revision,
      true,
      statusBarHeight,
      statusBarRect, statusBarCutoutRect, corners[0], corners[1], keyboardArea, stableBottom.interactive, stableBottom.visual,
      stableTop.interactive, stableTop.visual,
    );
    AppStorage.setOrCreate<number>('readerWindowMetricsRevision', revision);
  }

  private static windowDisplay(displayId?: number): display.Display {
    if (displayId !== undefined) {
      try { return display.getDisplayByIdSync(displayId); } catch (_) { /* Display can disconnect before the window moves. */ }
    }
    return display.getDefaultDisplaySync();
  }

  private static windowSafeAreaKey(win: window.Window, density: number, info: display.Display, bounds: ReaderRectVp): string {
    let status = window.WindowStatusType.UNDEFINED;
    try { status = win.getWindowStatus(); } catch (_) { /* Existing window geometry remains available. */ }
    const layout = status === window.WindowStatusType.UNDEFINED ? window.WindowStatusType.FULL_SCREEN : status;
    const displayKey = `${info.id}:${density}:${info.width}:${info.height}:${info.rotation}:${layout}`;
    // Full-screen hide/reveal can change the reported app rect. A floating or
    // split window's position, however, determines whether it reaches the band.
    return status === window.WindowStatusType.FLOATING || status === window.WindowStatusType.SPLIT_SCREEN ?
      `${displayKey}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}` : displayKey;
  }

  private static independentTopAreas(density: number): ReaderTopAvoidAreas {
    return {
      system: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM, density, true)?.top,
      gesture: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM_GESTURE, density, true)?.top,
      navigation: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR, density, true)?.top,
    };
  }

  private static independentBottomAreas(density: number): ReaderBottomAvoidAreas {
    return {
      system: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM, density, true)?.bottom,
      gesture: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM_GESTURE, density, true)?.bottom,
      navigation: ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR, density, true)?.bottom,
    };
  }

  private static sameRectVp(a: ReaderRectVp, b: ReaderRectVp): boolean {
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
  }

  private static sameKeyboardAreaVp(a: ReaderKeyboardAreaVp, b: ReaderKeyboardAreaVp): boolean {
    return a.available === b.available && a.visible === b.visible && a.rects.length === b.rects.length &&
      a.rects.every((rect: ReaderRectVp, index: number): boolean =>
        ReaderWindowCoordinator.sameRectVp(rect, b.rects[index]));
  }

  private static keyboardAreaVp(density: number): ReaderKeyboardAreaVp {
    const win = ReaderWindowCoordinator.mainWindow;
    if (win === undefined) return new ReaderKeyboardAreaVp();
    try {
      const area = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_KEYBOARD);
      const rects = [area.leftRect, area.topRect, area.rightRect, area.bottomRect]
        .filter((rect: window.Rect): boolean => rect.width > 0 && rect.height > 0)
        .map((rect: window.Rect): ReaderRectVp => ReaderWindowCoordinator.rectVp(rect, density));
      return new ReaderKeyboardAreaVp(true, area.visible && rects.length > 0, rects);
    } catch (_error) { return new ReaderKeyboardAreaVp(); }
  }

  private static keyboardInsetsVp(area: ReaderKeyboardAreaVp, viewport: ReaderRectVp): ReaderInsetsVp {
    if (!area.available || !area.visible) return new ReaderInsetsVp();
    const insets = new ReaderInsetsVp();
    for (const rect of area.rects) {
      // A floating rectangle is not a window-edge inset. Its full location
      // remains available to editing hosts through keyboardArea.
      if (rect.top <= 0) insets.top = Math.max(insets.top, rect.height);
      if (rect.left <= 0 && rect.height >= viewport.height) insets.left = Math.max(insets.left, rect.width);
      if (rect.left + rect.width >= viewport.width && rect.height >= viewport.height)
        insets.right = Math.max(insets.right, rect.width);
      if (rect.top + rect.height >= viewport.height) insets.bottom = Math.max(insets.bottom, rect.height);
    }
    return insets;
  }

  private static sameCornerVp(a: ReaderDisplayCornerVp, b: ReaderDisplayCornerVp): boolean {
    return a.x === b.x && a.y === b.y && a.radius === b.radius;
  }

  private static topAvoidRectVp(type: window.AvoidAreaType, density: number): ReaderRectVp {
    try {
      const win = ReaderWindowCoordinator.mainWindow;
      return win === undefined ? new ReaderRectVp() : ReaderWindowCoordinator.rectVp(win.getWindowAvoidArea(type).topRect, density);
    } catch (_error) { return new ReaderRectVp(); }
  }

  private static statusBarRectVp(density: number): ReaderRectVp {
    const win = ReaderWindowCoordinator.mainWindow;
    // API22 is optional at runtime. API21 or an unsupported window keeps the
    // existing visible-area + exact-geometry measured fallback, never a model table.
    if (win !== undefined && typeof win.getWindowAvoidAreaIgnoringVisibility === 'function') {
      try {
        const rect = win.getWindowAvoidAreaIgnoringVisibility(window.AvoidAreaType.TYPE_SYSTEM).topRect;
        if (rect.height > 0) return ReaderWindowCoordinator.rectVp(rect, density);
      } catch (_error) {}
    }
    return ReaderWindowCoordinator.topAvoidRectVp(window.AvoidAreaType.TYPE_SYSTEM, density);
  }

  private static topCornersVp(info: display.Display, globalRect: ReaderRectVp,
    density: number): ReaderDisplayCornerVp[] {
    const result: ReaderDisplayCornerVp[] = [new ReaderDisplayCornerVp(), new ReaderDisplayCornerVp()];
    if (typeof info.getRoundedCorner !== 'function') return result;
    try {
      for (const corner of info.getRoundedCorner()) {
        if (corner.type !== display.CornerType.TOP_LEFT && corner.type !== display.CornerType.TOP_RIGHT) continue;
        const index = corner.type === display.CornerType.TOP_LEFT ? 0 : 1;
        result[index] = new ReaderDisplayCornerVp(
          (corner.position.x + (info.x ?? 0)) / density - globalRect.left,
          (corner.position.y + (info.y ?? 0)) / density - globalRect.top,
          Math.max(0, corner.radius / density));
      }
    } catch (_error) {}
    return result;
  }

  private static sameInsetsVp(a: ReaderInsetsVp, b: ReaderInsetsVp): boolean {
    return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
  }

  private static sameWindowPolicy(a: ReaderWindowPolicy, b: ReaderWindowPolicy): boolean {
    return a.orientation === b.orientation &&
      a.keepScreenOn === b.keepScreenOn &&
      a.hideStatusBar === b.hideStatusBar &&
      a.hideNavigationBar === b.hideNavigationBar &&
      a.extendIntoCutout === b.extendIntoCutout &&
      a.keyboardAvoidance === b.keyboardAvoidance;
  }

  private static avoidInsetsVp(type: window.AvoidAreaType, density: number,
    ignoreVisibility: boolean = false): ReaderInsetsVp | undefined {
    const win = ReaderWindowCoordinator.mainWindow;
    if (win === undefined || (ignoreVisibility && typeof win.getWindowAvoidAreaIgnoringVisibility !== 'function')) return undefined;
    try {
      const area = ignoreVisibility ? win.getWindowAvoidAreaIgnoringVisibility(type) : win.getWindowAvoidArea(type);
      return new ReaderInsetsVp(
        area.leftRect.width / density,
        area.topRect.height / density,
        area.rightRect.width / density,
        area.bottomRect.height / density,
      );
    } catch (_error) { return undefined; }
  }

  private static rectVp(rect: window.Rect, density: number): ReaderRectVp {
    return new ReaderRectVp(
      rect.left / density,
      rect.top / density,
      rect.width / density,
      rect.height / density,
    );
  }

  private static requestChrome(request: ReaderWindowChromeRequest): void {
    const sameStyle = ReaderWindowCoordinator.desiredChrome.owner === request.owner &&
      ReaderWindowCoordinator.desiredChrome.style.underlayColor === request.style.underlayColor &&
      ReaderWindowCoordinator.desiredChrome.style.tone === request.style.tone &&
      ReaderWindowCoordinator.desiredChrome.style.contentColor === request.style.contentColor &&
      (ReaderWindowCoordinator.desiredChrome.style.navigationUnderlayColor ?? ReaderWindowCoordinator.desiredChrome.style.underlayColor) ===
        (request.style.navigationUnderlayColor ?? request.style.underlayColor) &&
      (ReaderWindowCoordinator.desiredChrome.style.navigationContentColor ?? ReaderWindowCoordinator.desiredChrome.style.contentColor) ===
        (request.style.navigationContentColor ?? request.style.contentColor) &&
      ReaderWindowCoordinator.desiredChrome.style.paperThemeId === request.style.paperThemeId &&
      ReaderWindowCoordinator.desiredChrome.style.transparentSystemBars === request.style.transparentSystemBars;
    if (sameStyle && ReaderWindowCoordinator.currentChromeSettled()) return;
    if (!sameStyle) {
      ReaderWindowCoordinator.desiredChrome = request;
      ReaderWindowCoordinator.desiredChromeRevision += 1;
    }
    AppStorage.setOrCreate<string>('readerWindowChromeOwner', request.owner);
    AppStorage.setOrCreate<string>('readerWindowChromeUnderlayColor', request.style.underlayColor);
    AppStorage.setOrCreate<string>('readerWindowChromeTone', request.style.tone);
    AppStorage.setOrCreate<string>('readerWindowChromeThemeId', request.owner === 'app' ? '' : request.style.paperThemeId);
    void ReaderWindowCoordinator.flushChrome();
  }

  private static currentChromeSettled(): boolean {
    const revision = ReaderWindowCoordinator.desiredChromeRevision;
    return ReaderWindowCoordinator.appliedChromeRevision === revision ||
      ReaderWindowCoordinator.limitedChromeRevision === revision;
  }

  private static nativeStatusBarColor(request: ReaderWindowChromeRequest): string {
    if (request.style.transparentSystemBars) return '#00000000';
    // An opaque native bar hides the authored paper texture even when its RGB
    // base matches. Only a validated reader paper owner supplies that backing;
    // application/legacy callers retain their original opaque status color.
    return request.owner !== 'app' && findReaderTheme(request.style.paperThemeId) !== undefined ?
      '#00000000' : request.style.underlayColor;
  }

  private static async flushChrome(): Promise<void> {
    ReaderWindowCoordinator.chromeRequestedEpoch = ReaderWindowCoordinator.installEpoch;
    if (ReaderWindowCoordinator.chromeFlushRunning) {
      return;
    }
    ReaderWindowCoordinator.chromeFlushRunning = true;
    try {
      while (ReaderWindowCoordinator.mainWindow !== undefined &&
        ReaderWindowCoordinator.chromeRequestedEpoch === ReaderWindowCoordinator.installEpoch &&
        !ReaderWindowCoordinator.currentChromeSettled()) {
        const win = ReaderWindowCoordinator.mainWindow;
        const epoch = ReaderWindowCoordinator.installEpoch;
        const revision = ReaderWindowCoordinator.desiredChromeRevision;
        const request = ReaderWindowCoordinator.desiredChrome;
        const metricsAtRequest = ReaderWindowCoordinator.metricsSnapshot;
        // Apply the exact opaque foreground paired with the underlay. Reader
        // chrome supplies its theme ink; legacy callers use the constructor
        // tone fallback above.
        const contentColor = request.style.contentColor;
        try {
          await win.setWindowSystemBarProperties({
            statusBarColor: ReaderWindowCoordinator.nativeStatusBarColor(request),
            navigationBarColor: request.style.transparentSystemBars ? '#00000000' : (request.style.navigationUnderlayColor ?? request.style.underlayColor),
            statusBarContentColor: contentColor,
            navigationBarContentColor: request.style.navigationContentColor ?? contentColor,
          });
        } catch (error) {
          const code = ReaderWindowCoordinator.chromeErrorCode(error as BusinessError);
          ReaderWindowCoordinator.reportChromeWrite(win, epoch, revision, request, metricsAtRequest, false, code);
          if (!ReaderWindowCoordinator.installStillCurrent(epoch, win) ||
            revision !== ReaderWindowCoordinator.desiredChromeRevision) continue;
          // Unsupported settles this style only for this window installation.
          // Other failures remain pending for an explicit retry.
          if (code === '801') ReaderWindowCoordinator.limitedChromeRevision = revision;
          return;
        }
        ReaderWindowCoordinator.reportChromeWrite(win, epoch, revision, request, metricsAtRequest, true);
        if (ReaderWindowCoordinator.installStillCurrent(epoch, win)) ReaderWindowCoordinator.appliedChromeRevision = revision;
      }
    } finally {
      ReaderWindowCoordinator.chromeFlushRunning = false;
    }
  }

  private static chromeErrorCode(error: BusinessError | undefined | null): string {
    // Native messages may contain unrelated runtime details. Record only a
    // finite numeric platform code, never message/stack or arbitrary strings.
    try {
      const code = error?.code;
      return typeof code === 'number' && Number.isFinite(code) ? `${code}` : 'unknown';
    } catch (_error) {
      return 'unknown';
    }
  }

  private static reportChromeWrite(win: window.Window, epoch: number, revision: number,
    request: ReaderWindowChromeRequest, metrics: ReaderWindowMetricsSnapshot,
    succeeded: boolean, errorCode: string = 'none'): void {
    // One record per actual write completion, never per layout/frame. The
    // synchronous API12 readback is a window property, not compositor pixels.
    // A missing API, destroyed window or logging failure cannot affect policy.
    try {
      const diagnostic: ReaderWindowChromeDiagnostic = {
        result: succeeded ? 'applied' : 'write-failed', owner: request.owner, revision: revision,
        currentWindow: ReaderWindowCoordinator.installStillCurrent(epoch, win),
        expectedStatusBg: ReaderWindowCoordinator.nativeStatusBarColor(request),
        expectedForeground: request.style.contentColor, underlayColor: request.style.underlayColor,
        paperThemeId: request.owner === 'app' ? '' : request.style.paperThemeId,
        nativeReadback: succeeded ? 'unavailable' : 'not-read',
        nativeBackground: 'unknown', nativeForeground: 'unknown',
        errorCode: errorCode, readbackErrorCode: 'none',
        metricsRevisionAtRequest: metrics.revision,
        statusRectAtRequest: metrics.statusBarRect, windowRectAtRequest: metrics.windowRect,
      };
      if (succeeded && typeof win.getWindowSystemBarProperties === 'function') {
        try {
          const properties = win.getWindowSystemBarProperties();
          diagnostic.nativeReadback = 'known';
          diagnostic.nativeBackground = properties?.statusBarColor ?? 'unknown';
          diagnostic.nativeForeground = properties?.statusBarContentColor ?? 'unknown';
        } catch (error) {
          diagnostic.nativeReadback = 'failed';
          diagnostic.readbackErrorCode = ReaderWindowCoordinator.chromeErrorCode(error as BusinessError);
        }
      }
      if (succeeded) {
        hilog.info(0x5244, 'Reader', 'READER_WINDOW_CHROME %{public}s', JSON.stringify(diagnostic));
      } else {
        hilog.warn(0x5244, 'Reader', 'READER_WINDOW_CHROME %{public}s', JSON.stringify(diagnostic));
      }
    } catch (_error) {
      // Diagnostics must not prevent the latest requested color from draining.
    }
  }
}

// Bind only a getter. Metrics storage, revision publication and every window
// lifecycle/policy operation remain on this coordinator.
bindReaderWindowMetricsSource((): ReaderWindowMetricsSnapshot => ReaderWindowCoordinator.metrics());
