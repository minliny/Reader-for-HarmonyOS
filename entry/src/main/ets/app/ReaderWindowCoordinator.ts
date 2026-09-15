import { display, window } from '@kit.ArkUI';
import { ReaderBrightnessWriter, type ReaderBrightnessWindow } from './ReaderBrightnessWriter';
import { ReaderStatusBarMeasurement } from './ReaderStatusBarMeasurement';
import {
  ReaderInsetsVp,
  ReaderRectVp,
  ReaderDisplayCornerVp,
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
  private static appChromeStyle: ReaderWindowChromeStyle = APP_CHROME_STYLE;
  private static mainWindow: window.Window | undefined = undefined;
  private static brightnessWriter: ReaderBrightnessWriter = new ReaderBrightnessWriter(
    (): Promise<ReaderBrightnessWindow> => {
      const win = ReaderWindowCoordinator.mainWindow;
      return win === undefined ? Promise.reject(new Error('Reader main window is unavailable')) :
        Promise.resolve(win);
    });
  private static metricsSnapshot: ReaderWindowMetricsSnapshot = createDefaultReaderWindowMetrics();
  private static statusBarMeasurement: ReaderStatusBarMeasurement = new ReaderStatusBarMeasurement();
  private static statusBarHiddenApplied: boolean = false;
  private static windowRectListener: ((options: window.RectChangeOptions) => void) | undefined = undefined;
  private static displayChangeListener: ((id: number) => void) | undefined = undefined;
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
    ReaderWindowCoordinator.brightnessWriter.reset();
    ReaderWindowCoordinator.statusBarMeasurement = new ReaderStatusBarMeasurement();
    ReaderWindowCoordinator.statusBarHiddenApplied = false;
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
    ReaderWindowCoordinator.windowPolicyRevision += 1;
    ReaderWindowCoordinator.windowSizeListener = undefined;
    ReaderWindowCoordinator.avoidAreaListener = undefined;
    ReaderWindowCoordinator.appliedPolicyRevision = -1;
    ReaderWindowCoordinator.appliedChromeRevision = -1;
  }

  static metrics(): ReaderWindowMetricsSnapshot {
    return ReaderWindowCoordinator.metricsSnapshot;
  }

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
  static requestReaderWindowPolicy(policy: ReaderWindowPolicy): Promise<void> {
    // Opening controls can leave both visibility and geometry unchanged.
    // Retry a pending theme write even when the window policy is deduplicated;
    // a successfully applied style performs no native write here.
    if (!policy.hideStatusBar) void ReaderWindowCoordinator.flushChrome();
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
      (win: window.Window): Promise<void> => ReaderWindowCoordinator.applyReaderWindowPolicy(win, policy, revision));
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
      (win: window.Window): Promise<void> => ReaderWindowCoordinator.applyAppWindowPolicy(win, revision));
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
    ReaderWindowCoordinator.windowRectListener = (_options: window.RectChangeOptions): void => {
      if (ReaderWindowCoordinator.mainWindow === win) ReaderWindowCoordinator.refreshMetrics();
    };
    ReaderWindowCoordinator.displayChangeListener = (_id: number): void => {
      if (ReaderWindowCoordinator.mainWindow === win) ReaderWindowCoordinator.refreshMetrics();
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
    revision: number,
  ): Promise<void> {
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setPreferredOrientation(ReaderWindowCoordinator.orientationValue(policy.orientation));
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setWindowKeepScreenOn(policy.keepScreenOn);
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setSpecificSystemBarEnabled('status', !policy.hideStatusBar, false);
    if (win === ReaderWindowCoordinator.mainWindow) {
      ReaderWindowCoordinator.statusBarHiddenApplied = policy.hideStatusBar;
    }
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setSpecificSystemBarEnabled('navigation', !policy.hideNavigationBar, false);
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setSpecificSystemBarEnabled('navigationIndicator', !policy.hideNavigationBar, false);
  }

  private static async applyAppWindowPolicy(win: window.Window, revision: number): Promise<void> {
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setPreferredOrientation(ReaderWindowCoordinator.appOrientation);
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setWindowKeepScreenOn(ReaderWindowCoordinator.appKeepScreenOn);
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setSpecificSystemBarEnabled('status', true, false);
    if (win === ReaderWindowCoordinator.mainWindow) ReaderWindowCoordinator.statusBarHiddenApplied = false;
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
    await win.setSpecificSystemBarEnabled('navigation', true, false);
    if (win !== ReaderWindowCoordinator.mainWindow || revision !== ReaderWindowCoordinator.windowPolicyRevision) return;
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
    const statusMeasurementKey = `${windowRect.left}:${windowRect.top}:${windowRect.width}:` +
      `${windowRect.height}:${globalRectVp.left}:${globalRectVp.top}:${density}:${displayInfo.id}:${displayInfo.rotation}`;
    const statusBarRect = ReaderWindowCoordinator.statusBarMeasurement.observeRect(statusMeasurementKey,
      windowRect.width > windowRect.height, ReaderWindowCoordinator.statusBarRectVp(density),
      ReaderWindowCoordinator.statusBarHiddenApplied ||
      (ReaderWindowCoordinator.desiredWindowPolicyOwner === 'reader' &&
      ReaderWindowCoordinator.desiredReaderWindowPolicy.hideStatusBar));
    const statusBarHeight = statusBarRect.height;
    const statusBarCutoutRect = ReaderWindowCoordinator.topAvoidRectVp(window.AvoidAreaType.TYPE_CUTOUT, density);
    const corners = ReaderWindowCoordinator.topCornersVp(displayInfo, globalRectVp, density);
    if (previous.ready && previous.statusBarHeight === statusBarHeight &&
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
      statusBarRect, statusBarCutoutRect, corners[0], corners[1],
    );
    AppStorage.setOrCreate<number>('readerWindowMetricsRevision', revision);
  }

  private static sameRectVp(a: ReaderRectVp, b: ReaderRectVp): boolean {
    return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
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
        const epoch = ReaderWindowCoordinator.installEpoch;
        const revision = ReaderWindowCoordinator.desiredChromeRevision;
        const request = ReaderWindowCoordinator.desiredChrome;
        // Apply the exact opaque foreground paired with the underlay. Reader
        // chrome supplies its theme ink; legacy callers use the constructor
        // tone fallback above.
        const contentColor = request.style.contentColor;
        try {
          await win.setWindowSystemBarProperties({
            statusBarColor: request.style.underlayColor,
            navigationBarColor: request.style.underlayColor,
            statusBarContentColor: contentColor,
            navigationBarContentColor: contentColor,
          });
        } catch (_error) {
          // A failed old write must not swallow a newer queued theme. A
          // failed latest intent remains pending for an explicit retry;
          // never spin on a rejected native operation.
          if (revision !== ReaderWindowCoordinator.desiredChromeRevision) continue;
          return;
        }
        if (win !== ReaderWindowCoordinator.mainWindow || epoch !== ReaderWindowCoordinator.installEpoch) {
          // install() can enqueue its new window style while this old write
          // still owns the drain. Release only if no newer intent arrived.
          if (revision !== ReaderWindowCoordinator.desiredChromeRevision) continue;
          return;
        }
        ReaderWindowCoordinator.appliedChromeRevision = revision;
      }
    } finally {
      ReaderWindowCoordinator.chromeFlushRunning = false;
    }
  }
}
