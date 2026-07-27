// ScreenHostAdapter — HarmonyOS @ohos.window backed Host adapter for
// device.screen.keep-on / device.screen.release.
//
// Source of truth: UI Contract host-request.schema.json — `device.screen.keep-on`
// and `device.screen.release` are UI-Contract-only capabilities (NOT in the Core
// HostCapability closed set). Reducer dispatches these directly.
//
// HarmonyOS API mapping:
//   - device.screen.keep-on   → window.getLastWindow(context) +
//                                win.setWindowKeepScreenOn(true)
//   - device.screen.release   → window.getLastWindow(context) +
//                                win.setWindowKeepScreenOn(false)
//
// Permission: none required.
//
// Note: HarmonyOS recommends resetting to false when leaving the page that
// needed keep-on. The system may force-reset to auto-off if keep-on is used
// outside recommended scenarios (navigation, video, reading).
import window from '@ohos.window';
import common from '@ohos.app.ability.common';
import {
  HostDeviceScreenKeepOnRequest,
  HostDeviceScreenKeepOnResponse,
  HostDeviceScreenReleaseResponse,
} from '../types';

export class ScreenHostAdapter {
  private context: common.Context;

  constructor(context: common.Context) {
    this.context = context;
  }

  /**
   * device.screen.keep-on — set the main window's keep-screen-on flag.
   * `enabled: true` keeps the screen on; `enabled: false` releases it.
   */
  async keepOn(request: HostDeviceScreenKeepOnRequest): Promise<HostDeviceScreenKeepOnResponse> {
    try {
      const win = await window.getLastWindow(this.context);
      await win.setWindowKeepScreenOn(request.enabled);
      return { enabled: request.enabled };
    } catch (e) {
      throw new Error(`ScreenHostAdapter.keepOn enabled=${request.enabled} failed: ${e}`);
    }
  }

  /**
   * device.screen.release — release the keep-screen-on flag.
   * Equivalent to keepOn({ enabled: false }), but exposed as a separate
   * method because the UI Contract treats it as a distinct capability.
   */
  async release(): Promise<HostDeviceScreenReleaseResponse> {
    try {
      const win = await window.getLastWindow(this.context);
      await win.setWindowKeepScreenOn(false);
      return { released: true };
    } catch (e) {
      throw new Error(`ScreenHostAdapter.release failed: ${e}`);
    }
  }

  /** Reader UI 2.5 brightness.set — apply and read back window brightness. */
  async setBrightness(value: number): Promise<number> {
    try {
      const win = await window.getLastWindow(this.context);
      await win.setWindowBrightness(value);
      return win.getWindowProperties().brightness;
    } catch (e) {
      throw new Error(`ScreenHostAdapter.setBrightness value=${value} failed: ${e}`);
    }
  }

  /** Reader UI 2.5 brightness.get — read the active window's real value. */
  async getBrightness(): Promise<number> {
    try {
      const win = await window.getLastWindow(this.context);
      return win.getWindowProperties().brightness;
    } catch (e) {
      throw new Error(`ScreenHostAdapter.getBrightness failed: ${e}`);
    }
  }
}
