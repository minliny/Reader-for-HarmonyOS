import { display, window } from '@kit.ArkUI';
import {
  ReaderInsetsVp,
  ReaderRectVp,
  ReaderWindowMetricsSnapshot,
  createDefaultReaderWindowMetrics,
} from '../features/common/ReaderWindowMetrics';

export type ReaderWindowChromeOwner = 'app' | 'reader' | 'overlay';
export type ReaderWindowChromeTone = 'light' | 'dark';
export type ReaderWindowOrientationPolicy = 'system' | 'portrait' | 'landscape';

/** Semantic reader-owned window behavior; raw Harmony enums stay in this host. */
export class ReaderWindowPolicy {
  orientation: ReaderWindowOrientationPolicy;
  keepScreenOn: boolean;
  hideStatusBar: boolean;
  hideNavigationBar: boolean;
  extendIntoCutout: boolean;

  constructor(
    orientation: ReaderWindowOrientationPolicy = 'system',
    keepScreenOn: boolean = false,
    hideStatusBar: boolean = false,
    hideNavigationBar: boolean = false,
    extendIntoCutout: boolean = false,
  ) {
    this.orientation = orientation;
    this.keepScreenOn = keepScreenOn;
    this.hideStatusBar = hideStatusBar;
    this.hideNavigationBar = hideNavigationBar;
    this.extendIntoCutout = extendIntoCutout;
  }
}

/** One atomic system-bar visual: the painted underlay and matching foreground. */
export class ReaderWindowChromeStyle {
  underlayColor: string;
  tone: ReaderWindowChromeTone;
  /** Exact opaque foreground from the owning surface's semantic palette. */
  contentColor: string;

  constructor(underlayColor: string, tone: ReaderWindowChromeTone, contentColor?: string) {
    this.underlayColor = underlayColor;
    this.tone = tone;
    // Keep tone as a compatibility fallback while reader-owned chrome passes
    // the active theme's exact ink color.
    this.contentColor = contentColor ?? (tone === 'light' ? '#FFFFFFFF' : '#FF000000');
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

const APP_CHROME_STYLE = new ReaderWindowChromeStyle('#F8F4EC', 'dark', '#FF2B241D');

/**
 * The single HarmonyOS window boundary for Reader.
 *
 * It owns Window callbacks and system-bar writes. UI components consume a vp
 * snapshot and request one semantic underlay/tone style; they never retain Window or
 * inspect px avoid areas themselves.
 */
export class ReaderWindowCoordinator {
  private static mainWindow: window.Window | undefined = undefined;
  private static metricsSnapshot: ReaderWindowMetricsSnapshot = createDefaultReaderWindowMetrics();
  private static windowSizeListener: ((size: window.Size) => void) | undefined = undefined;
  private static avoidAreaListener: ((options: window.AvoidAreaOptions) => void) | undefined = undefined;
  private static desiredChrome: ReaderWindowChromeRequest =
    new ReaderWindowChromeRequest('app', APP_CHROME_STYLE);
  private static desiredChromeRevision: number = 0;
  private static appliedChromeRevision: number = -1;
  private static chromeFlushRunning: boolean = false;
  private static appOrientation: window.Orientation = window.Orientation.UNSPECIFIED;
  private static appKeepScreenOn: boolean = false;
  private static windowPolicyRevision: number = 0;
  private static windowPolicyTail: Promise<void> = Promise.resolve();
  private static desiredWindowPolicyOwner: 'app' | 'reader' = 'app';
  private static desiredReaderWindowPolicy: ReaderWindowPolicy = new ReaderWindowPolicy();
  private static appliedPolicyRevision: number = -1;
  /**
   * Install/detach race guard. detach() and every install() bump this epoch;
   * each await inside install() re-checks it, so an async install that has been
   * superseded (window destroyed, new window installed, or detach) aborts
   * before registering stale listeners on a dead window or clobbering the new
   * coordinator state.
   */
  private static installEpoch: number = 0;

  static async install(win: window.Window): Promise<boolean> {
    ReaderWindowCoordinator.detach();
    ReaderWindowCoordinator.installEpoch += 1;
    const epoch = ReaderWindowCoordinator.installEpoch;
    ReaderWindowCoordinator.mainWindow = win;
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'app';
    ReaderWindowCoordinator.appOrientation = win.getPreferredOrientation();
    ReaderWindowCoordinator.appKeepScreenOn = win.getWindowProperties().isKeepScreenOn;
    await win.setWindowLayoutFullScreen(true);
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) {
      return false;
    }
    await win.setWindowSystemBarEnable(['status', 'navigation']);
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) {
      return false;
    }
    ReaderWindowCoordinator.registerWindowListeners(win);
    if (!ReaderWindowCoordinator.installStillCurrent(epoch, win)) {
      return false;
    }
    ReaderWindowCoordinator.refreshMetrics();
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
    const win = ReaderWindowCoordinator.mainWindow;
    if (win !== undefined) {
      try {
        if (ReaderWindowCoordinator.windowSizeListener !== undefined) {
          win.off('windowSizeChange', ReaderWindowCoordinator.windowSizeListener);
        }
        if (ReaderWindowCoordinator.avoidAreaListener !== undefined) {
          win.off('avoidAreaChange', ReaderWindowCoordinator.avoidAreaListener);
        }
      } catch (_error) {
        // A destroyed Window can reject listener removal. The references still
        // must be cleared so the next stage never reuses stale callbacks.
      }
    }
    ReaderWindowCoordinator.installEpoch += 1;
    ReaderWindowCoordinator.mainWindow = undefined;
    ReaderWindowCoordinator.windowPolicyRevision += 1;
    ReaderWindowCoordinator.windowSizeListener = undefined;
    ReaderWindowCoordinator.avoidAreaListener = undefined;
    ReaderWindowCoordinator.appliedPolicyRevision = -1;
    ReaderWindowCoordinator.appliedChromeRevision = -1;
  }

  static metrics(): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metricsSnapshot;
  }

  static requestAppChrome(): void {
    ReaderWindowCoordinator.requestChrome(new ReaderWindowChromeRequest('app', APP_CHROME_STYLE));
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
  static requestReaderWindowPolicy(policy: ReaderWindowPolicy): Promise<void> {
    if (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.sameWindowPolicy(
        ReaderWindowCoordinator.desiredReaderWindowPolicy, policy) &&
      ReaderWindowCoordinator.appliedPolicyRevision === ReaderWindowCoordinator.windowPolicyRevision) {
      return Promise.resolve();
    }
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'reader';
    ReaderWindowCoordinator.desiredReaderWindowPolicy = policy;
    const revision = ReaderWindowCoordinator.nextWindowPolicyRevision();
    AppStorage.setOrCreate<string>('readerWindowOrientation', policy.orientation);
    AppStorage.setOrCreate<boolean>('readerWindowKeepScreenOn', policy.keepScreenOn);
    AppStorage.setOrCreate<boolean>('readerWindowHideStatusBar', policy.hideStatusBar);
    AppStorage.setOrCreate<boolean>('readerWindowHideNavigationBar', policy.hideNavigationBar);
    AppStorage.setOrCreate<boolean>('readerWindowExtendIntoCutout', policy.extendIntoCutout);
    return ReaderWindowCoordinator.enqueueWindowPolicy(revision,
      (win: window.Window): Promise<void> => ReaderWindowCoordinator.applyReaderWindowPolicy(win, policy));
  }

  /** Restore the app policy captured when the Ability installed the window. */
  static requestAppWindowPolicy(): Promise<void> {
    if (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'app' &&
      ReaderWindowCoordinator.appliedPolicyRevision === ReaderWindowCoordinator.windowPolicyRevision) {
      return Promise.resolve();
    }
    ReaderWindowCoordinator.desiredWindowPolicyOwner = 'app';
    const revision = ReaderWindowCoordinator.nextWindowPolicyRevision();
    AppStorage.setOrCreate<string>('readerWindowOrientation', 'app');
    AppStorage.setOrCreate<boolean>('readerWindowKeepScreenOn', ReaderWindowCoordinator.appKeepScreenOn);
    AppStorage.setOrCreate<boolean>('readerWindowHideStatusBar', false);
    AppStorage.setOrCreate<boolean>('readerWindowHideNavigationBar', false);
    AppStorage.setOrCreate<boolean>('readerWindowExtendIntoCutout', false);
    return ReaderWindowCoordinator.enqueueWindowPolicy(revision,
      (win: window.Window): Promise<void> => ReaderWindowCoordinator.applyAppWindowPolicy(win));
  }

  /** Reapply the latest semantic policy after foreground/window restoration. */
  static reapplyWindowPolicy(): void {
    if (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader') {
      void ReaderWindowCoordinator.requestReaderWindowPolicy(
        ReaderWindowCoordinator.desiredReaderWindowPolicy);
      return;
    }
    void ReaderWindowCoordinator.requestAppWindowPolicy();
  }

  static reapplyChrome(): void {
    ReaderWindowCoordinator.desiredChromeRevision += 1;
    void ReaderWindowCoordinator.flushChrome();
  }

  /** Refresh density/font-scale facts after an Ability configuration change. */
  static refreshConfiguration(): void {
    ReaderWindowCoordinator.refreshMetrics();
  }

  private static registerWindowListeners(win: window.Window): void {
    ReaderWindowCoordinator.windowSizeListener = (_size: window.Size): void => {
      ReaderWindowCoordinator.refreshMetrics();
    };
    ReaderWindowCoordinator.avoidAreaListener = (_options: window.AvoidAreaOptions): void => {
      ReaderWindowCoordinator.refreshMetrics();
    };
    win.on('windowSizeChange', ReaderWindowCoordinator.windowSizeListener);
    win.on('avoidAreaChange', ReaderWindowCoordinator.avoidAreaListener);
  }

  private static nextWindowPolicyRevision(): number {
    ReaderWindowCoordinator.windowPolicyRevision =
      ReaderWindowCoordinator.windowPolicyRevision >= Number.MAX_SAFE_INTEGER ?
        1 : ReaderWindowCoordinator.windowPolicyRevision + 1;
    return ReaderWindowCoordinator.windowPolicyRevision;
  }

  private static enqueueWindowPolicy(
    revision: number,
    apply: (win: window.Window) => Promise<void>,
  ): Promise<void> {
    const operation = ReaderWindowCoordinator.windowPolicyTail
      .catch((_error: Error): void => {})
      .then((): Promise<void> => {
        const win = ReaderWindowCoordinator.mainWindow;
        if (revision !== ReaderWindowCoordinator.windowPolicyRevision) {
          return Promise.resolve();
        }
        if (win === undefined) {
          return Promise.reject(new Error('Reader main window is unavailable'));
        }
        return apply(win)
          .then((): void => {
            if (win === ReaderWindowCoordinator.mainWindow &&
              revision === ReaderWindowCoordinator.windowPolicyRevision) {
              ReaderWindowCoordinator.appliedPolicyRevision = revision;
              ReaderWindowCoordinator.refreshMetrics();
            }
          });
      });
    ReaderWindowCoordinator.windowPolicyTail = operation.catch((_error: Error): void => {});
    return operation;
  }

  private static async applyReaderWindowPolicy(
    win: window.Window,
    policy: ReaderWindowPolicy,
  ): Promise<void> {
    await win.setPreferredOrientation(ReaderWindowCoordinator.orientationValue(policy.orientation));
    await win.setWindowKeepScreenOn(policy.keepScreenOn);
    await win.setSpecificSystemBarEnabled('status', !policy.hideStatusBar, false);
    await win.setSpecificSystemBarEnabled('navigation', !policy.hideNavigationBar, false);
    await win.setSpecificSystemBarEnabled('navigationIndicator', !policy.hideNavigationBar, false);
  }

  private static async applyAppWindowPolicy(win: window.Window): Promise<void> {
    await win.setPreferredOrientation(ReaderWindowCoordinator.appOrientation);
    await win.setWindowKeepScreenOn(ReaderWindowCoordinator.appKeepScreenOn);
    await win.setSpecificSystemBarEnabled('status', true, false);
    await win.setSpecificSystemBarEnabled('navigation', true, false);
    await win.setSpecificSystemBarEnabled('navigationIndicator', true, false);
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
    const displayInfo = display.getDefaultDisplaySync();
    const density = Number.isFinite(displayInfo.densityPixels) && displayInfo.densityPixels > 0 ?
      displayInfo.densityPixels : 1;
    const scaledDensity = Number.isFinite(displayInfo.scaledDensity) && displayInfo.scaledDensity > 0 ?
      displayInfo.scaledDensity : density;
    const properties = win.getWindowProperties();
    const globalRect = properties.globalDisplayRect ?? properties.windowRect;
    const windowRect = ReaderWindowCoordinator.rectVp(properties.windowRect, density);
    const globalRectVp = ReaderWindowCoordinator.rectVp(globalRect, density);
    const systemInsets = ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM, density);
    const cutoutInsets = ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_CUTOUT, density);
    const gestureInsets =
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM_GESTURE, density);
    const navigationInsets =
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR, density);
    const keyboardInsets = ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_KEYBOARD, density);
    const systemFontScale = scaledDensity / density;
    const previous = ReaderWindowCoordinator.metricsSnapshot;
    if (previous.ready &&
      ReaderWindowCoordinator.sameRectVp(previous.windowRect, windowRect) &&
      ReaderWindowCoordinator.sameRectVp(previous.globalRect, globalRectVp) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.systemInsets, systemInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.cutoutInsets, cutoutInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.gestureInsets, gestureInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.navigationInsets, navigationInsets) &&
      ReaderWindowCoordinator.sameInsetsVp(previous.keyboardInsets, keyboardInsets) &&
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
    );
    AppStorage.setOrCreate<number>('readerWindowMetricsRevision', revision);
  }

  private static sameRectVp(a: ReaderRectVp, b: ReaderRectVp): boolean {
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
  }

  private static sameInsetsVp(a: ReaderInsetsVp, b: ReaderInsetsVp): boolean {
    return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
  }

  private static sameWindowPolicy(a: ReaderWindowPolicy, b: ReaderWindowPolicy): boolean {
    return a.orientation === b.orientation &&
      a.keepScreenOn === b.keepScreenOn &&
      a.hideStatusBar === b.hideStatusBar &&
      a.hideNavigationBar === b.hideNavigationBar &&
      a.extendIntoCutout === b.extendIntoCutout;
  }

  private static avoidInsetsVp(type: window.AvoidAreaType, density: number): ReaderInsetsVp {
    const win = ReaderWindowCoordinator.mainWindow;
    if (win === undefined) {
      return new ReaderInsetsVp();
    }
    try {
      const area = win.getWindowAvoidArea(type);
      return new ReaderInsetsVp(
        area.leftRect.width / density,
        area.topRect.height / density,
        area.rightRect.width / density,
        area.bottomRect.height / density,
      );
    } catch (_error) {
      // Some devices do not expose every avoid-area type. Missing facts stay
      // zero while supported types continue to update the same snapshot.
      return new ReaderInsetsVp();
    }
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
    if (ReaderWindowCoordinator.desiredChrome.owner === request.owner &&
      ReaderWindowCoordinator.desiredChrome.style.underlayColor === request.style.underlayColor &&
      ReaderWindowCoordinator.desiredChrome.style.tone === request.style.tone &&
      ReaderWindowCoordinator.desiredChrome.style.contentColor === request.style.contentColor &&
      ReaderWindowCoordinator.appliedChromeRevision === ReaderWindowCoordinator.desiredChromeRevision) {
      return;
    }
    ReaderWindowCoordinator.desiredChrome = request;
    ReaderWindowCoordinator.desiredChromeRevision += 1;
    AppStorage.setOrCreate<string>('readerWindowChromeOwner', request.owner);
    AppStorage.setOrCreate<string>('readerWindowChromeUnderlayColor', request.style.underlayColor);
    AppStorage.setOrCreate<string>('readerWindowChromeTone', request.style.tone);
    void ReaderWindowCoordinator.flushChrome();
  }

  private static async flushChrome(): Promise<void> {
    if (ReaderWindowCoordinator.chromeFlushRunning) {
      return;
    }
    ReaderWindowCoordinator.chromeFlushRunning = true;
    try {
      while (ReaderWindowCoordinator.mainWindow !== undefined &&
        ReaderWindowCoordinator.appliedChromeRevision !== ReaderWindowCoordinator.desiredChromeRevision) {
        const win = ReaderWindowCoordinator.mainWindow;
        const revision = ReaderWindowCoordinator.desiredChromeRevision;
        const request = ReaderWindowCoordinator.desiredChrome;
        // Apply the exact opaque foreground paired with the underlay. Reader
        // chrome supplies its theme ink; legacy callers use the constructor
        // tone fallback above.
        const contentColor = request.style.contentColor;
        await win.setWindowSystemBarProperties({
          statusBarColor: request.style.underlayColor,
          navigationBarColor: request.style.underlayColor,
          statusBarContentColor: contentColor,
          navigationBarContentColor: contentColor,
        });
        if (win !== ReaderWindowCoordinator.mainWindow) {
          return;
        }
        ReaderWindowCoordinator.appliedChromeRevision = revision;
      }
    } catch (_error) {
      // Keep the desired revision pending. A foreground/window event retries
      // the last semantic request without allowing an older request to win.
    } finally {
      ReaderWindowCoordinator.chromeFlushRunning = false;
    }
  }
}
