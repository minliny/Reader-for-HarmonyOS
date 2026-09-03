import { batteryInfo } from '@kit.BasicServicesKit';
import { connection } from '@kit.NetworkKit';
import { formatReaderPageClock } from './ReaderPageChromeModel';

/** One low-frequency Host snapshot consumed by page-owned chrome. */
export class ReaderPageSystemStatusSnapshot {
  clockText: string;
  showSignal: boolean;
  showWifi: boolean;
  showBattery: boolean;
  batteryPercent: number;

  constructor(
    clockText: string,
    showSignal: boolean,
    showWifi: boolean,
    showBattery: boolean,
    batteryPercent: number,
  ) {
    this.clockText = clockText;
    this.showSignal = showSignal;
    this.showWifi = showWifi;
    this.showBattery = showBattery;
    this.batteryPercent = Math.max(0, Math.min(100, batteryPercent));
  }
}

/**
 * Reads system facts outside the render component. Network failures fail
 * closed to the last/empty Wi-Fi state; they never block the reading page.
 */
export async function readReaderPageSystemStatus(
  isTablet: boolean,
  epochMillis: number = Date.now(),
): Promise<ReaderPageSystemStatusSnapshot> {
  const batteryPercent = Number.isFinite(batteryInfo.batterySOC) ? batteryInfo.batterySOC : 0;
  let showWifi = false;
  try {
    const net = await connection.getDefaultNet();
    const capabilities = await connection.getNetCapabilities(net);
    showWifi = capabilities.bearerTypes.indexOf(connection.NetBearType.BEARER_WIFI) >= 0;
  } catch (_error) {
    showWifi = false;
  }
  return new ReaderPageSystemStatusSnapshot(
    formatReaderPageClock(epochMillis),
    !isTablet,
    showWifi,
    true,
    batteryPercent,
  );
}
