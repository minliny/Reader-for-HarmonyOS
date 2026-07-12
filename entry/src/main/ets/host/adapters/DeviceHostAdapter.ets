// DeviceHostAdapter — HarmonyOS @ohos.vibrator backed Host adapter for
// device.vibrate.
//
// Source of truth: UI Contract host-request.schema.json — `device.vibrate`
// is a UI-Contract-only capability (NOT in the Core HostCapability closed
// set). Reducer dispatches it directly via CoreRuntime.getDeviceAdapter().
//
// HarmonyOS API mapping:
//   - device.vibrate → vibrator.startVibration(
//       VibrateTime { type: 'time', duration: durationMs },
//       VibrateAttribute { id: 0, usage: 'notification' })
//
// Permission: ohos.permission.VIBRATE must be declared in module.json5.
// The effect is a short device vibration (default 15ms when durationMs is
// omitted). Callers are responsible for honoring user vibration settings
// at the UI layer; this adapter executes the hardware call as requested.
import vibrator from '@ohos.vibrator';
import { HostDeviceVibrateRequest, HostDeviceVibrateResponse } from '../types';

export class DeviceHostAdapter {
  /**
   * device.vibrate — trigger a time-based device vibration.
   * `durationMs` defaults to 15ms when omitted (per UI Contract default).
   * Returns vibrated: true when the vibrator API accepted the call.
   */
  async vibrate(request: HostDeviceVibrateRequest): Promise<HostDeviceVibrateResponse> {
    const duration: number = request.durationMs !== undefined && request.durationMs > 0
      ? request.durationMs
      : 15;
    try {
      await vibrator.startVibration(
        { type: 'time', duration: duration },
        { id: 0, usage: 'notification' },
      );
    } catch (e) {
      throw new Error(`DeviceHostAdapter.vibrate duration=${duration} failed: ${e}`);
    }
    const resp: HostDeviceVibrateResponse = { vibrated: true };
    return resp;
  }

  /** Reader UI 2.5 haptics.* — distinct, real time-based hardware effects. */
  async haptic(style: 'light' | 'medium' | 'heavy'): Promise<boolean> {
    let duration = 10;
    if (style === 'medium') duration = 25;
    if (style === 'heavy') duration = 45;
    const result = await this.vibrate({ durationMs: duration });
    return result.vibrated;
  }
}
