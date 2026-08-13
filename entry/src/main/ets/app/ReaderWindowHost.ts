import common from '@ohos.app.ability.common';
import { window } from '@kit.ArkUI';
import type {
  ReaderScreenDirection,
  ReaderScreenTimeout,
  ReaderSettingsSnapshot,
} from '../features/reading/ReaderSettingsState';

const READER_STATUS_BAR_COLOR = '#FFF8F4EC';
const READER_NAVIGATION_BAR_COLOR = '#00000000';

/**
 * Host-only window side effects for the immersive Reader.
 *
 * The persisted snapshot is user intent. This adapter owns only platform
 * orientation, system bars and the keep-screen-on lease. A finite Reader
 * timeout never shortens the user's system timeout: it holds the display for
 * the requested interval after interaction, then releases the lease.
 */
export class ReaderWindowHost {
  private readonly context: common.UIAbilityContext;
  private interactionGeneration: number = 0;
  private keepScreenTimer: number = -1;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async apply(snapshot: ReaderSettingsSnapshot): Promise<void> {
    const readerWindow = await window.getLastWindow(this.context);
    await readerWindow.setPreferredOrientation(this.orientation(snapshot.screenDirection));
    await readerWindow.setWindowLayoutFullScreen(snapshot.extendIntoCutout);
    const bars: Array<'status' | 'navigation'> = [];
    if (!snapshot.hideStatusBar) bars.push('status');
    if (!snapshot.hideNavigationBar) bars.push('navigation');
    await readerWindow.setWindowSystemBarEnable(bars);
    await readerWindow.setWindowSystemBarProperties({
      statusBarColor: READER_STATUS_BAR_COLOR,
      navigationBarColor: READER_NAVIGATION_BAR_COLOR,
      statusBarContentColor: '#99000000',
      navigationBarContentColor: '#99000000',
    });
    await this.armScreenTimeout(readerWindow, snapshot.screenTimeout);
  }

  async noteInteraction(timeout: ReaderScreenTimeout): Promise<void> {
    const readerWindow = await window.getLastWindow(this.context);
    await this.armScreenTimeout(readerWindow, timeout);
  }

  async release(): Promise<void> {
    this.invalidateTimer();
    const readerWindow = await window.getLastWindow(this.context);
    await readerWindow.setWindowKeepScreenOn(false);
    await readerWindow.setPreferredOrientation(window.Orientation.UNSPECIFIED);
    await readerWindow.setWindowLayoutFullScreen(true);
    await readerWindow.setWindowSystemBarEnable(['status', 'navigation']);
    await readerWindow.setWindowSystemBarProperties({
      statusBarColor: READER_STATUS_BAR_COLOR,
      navigationBarColor: READER_NAVIGATION_BAR_COLOR,
      statusBarContentColor: '#99000000',
      navigationBarContentColor: '#99000000',
    });
  }

  private async armScreenTimeout(readerWindow: window.Window, timeout: ReaderScreenTimeout): Promise<void> {
    const generation = this.invalidateTimer();
    if (timeout === 'system') {
      await readerWindow.setWindowKeepScreenOn(false);
      return;
    }
    await readerWindow.setWindowKeepScreenOn(true);
    if (timeout === 'alwaysOn') return;
    const durationMs = this.timeoutMilliseconds(timeout);
    this.keepScreenTimer = setTimeout((): void => {
      if (generation !== this.interactionGeneration) return;
      this.keepScreenTimer = -1;
      void readerWindow.setWindowKeepScreenOn(false);
    }, durationMs);
  }

  private invalidateTimer(): number {
    this.interactionGeneration = this.interactionGeneration >= Number.MAX_SAFE_INTEGER ?
      1 : this.interactionGeneration + 1;
    if (this.keepScreenTimer >= 0) {
      clearTimeout(this.keepScreenTimer);
      this.keepScreenTimer = -1;
    }
    return this.interactionGeneration;
  }

  private timeoutMilliseconds(timeout: ReaderScreenTimeout): number {
    if (timeout === 'oneMinute') return 60_000;
    if (timeout === 'fiveMinutes') return 300_000;
    if (timeout === 'tenMinutes') return 600_000;
    throw new RangeError(`Reader finite timeout required, received ${timeout}`);
  }

  private orientation(direction: ReaderScreenDirection): window.Orientation {
    if (direction === 'portrait') return window.Orientation.PORTRAIT;
    if (direction === 'landscape') return window.Orientation.LANDSCAPE;
    return window.Orientation.UNSPECIFIED;
  }
}
