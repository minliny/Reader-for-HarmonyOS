import { display, window } from '@kit.ArkUI';
import {
  ReaderInsetsVp,
  ReaderRectVp,
  ReaderWindowMetricsSnapshot,
  createDefaultReaderWindowMetrics,
} from '../features/common/ReaderWindowMetrics';

export type ReaderWindowChromeOwner = 'app' | 'reader' | 'overlay';
export type ReaderWindowChromeTone = 'light' | 'dark';

/** One atomic system-bar visual: the painted underlay and its matching icon tone. */
export class ReaderWindowChromeStyle {
  underlayColor: string;
  tone: ReaderWindowChromeTone;

  constructor(underlayColor: string, tone: ReaderWindowChromeTone) {
    this.underlayColor = underlayColor;
    this.tone = tone;
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

const APP_CHROME_STYLE = new ReaderWindowChromeStyle('#F8F4EC', 'dark');

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

  static async install(win: window.Window): Promise<void> {
    ReaderWindowCoordinator.detach();
    ReaderWindowCoordinator.mainWindow = win;
    await win.setWindowLayoutFullScreen(true);
    await win.setWindowSystemBarEnable(['status', 'navigation']);
    ReaderWindowCoordinator.registerWindowListeners(win);
    ReaderWindowCoordinator.refreshMetrics();
    ReaderWindowCoordinator.requestAppChrome();
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
    ReaderWindowCoordinator.mainWindow = undefined;
    ReaderWindowCoordinator.windowSizeListener = undefined;
    ReaderWindowCoordinator.avoidAreaListener = undefined;
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
    const revision = ReaderWindowCoordinator.metricsSnapshot.revision >= Number.MAX_SAFE_INTEGER ?
      1 : ReaderWindowCoordinator.metricsSnapshot.revision + 1;
    ReaderWindowCoordinator.metricsSnapshot = new ReaderWindowMetricsSnapshot(
      ReaderWindowCoordinator.rectVp(properties.windowRect, density),
      ReaderWindowCoordinator.rectVp(globalRect, density),
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM, density),
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_CUTOUT, density),
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_SYSTEM_GESTURE, density),
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_NAVIGATION_INDICATOR, density),
      ReaderWindowCoordinator.avoidInsetsVp(window.AvoidAreaType.TYPE_KEYBOARD, density),
      density,
      scaledDensity / density,
      revision,
      true,
    );
    AppStorage.setOrCreate<number>('readerWindowMetricsRevision', revision);
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
        const contentColor = request.style.tone === 'light' ? '#FFFFFFFF' : '#99000000';
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
