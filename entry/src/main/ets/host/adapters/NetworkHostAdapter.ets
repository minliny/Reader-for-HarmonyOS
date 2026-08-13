// Reader UI 2.5 network.status backed by @ohos.net.connection.
import connection from '@ohos.net.connection';

export interface ReaderNetworkStatusResponse {
  connected: boolean;
  status: string;
  interface: string;
  isExpensive: boolean;
  isConstrained: boolean;
}

function containsCapability(values: connection.NetCap[] | undefined, target: connection.NetCap): boolean {
  return values !== undefined && values.indexOf(target) >= 0;
}

function bearerName(values: connection.NetBearType[]): string {
  if (values.indexOf(connection.NetBearType.BEARER_WIFI) >= 0) return 'wifi';
  if (values.indexOf(connection.NetBearType.BEARER_CELLULAR) >= 0) return 'cellular';
  if (values.indexOf(connection.NetBearType.BEARER_ETHERNET) >= 0) return 'ethernet';
  if (values.indexOf(connection.NetBearType.BEARER_VPN) >= 0) return 'vpn';
  if (values.indexOf(connection.NetBearType.BEARER_BLUETOOTH) >= 0) return 'bluetooth';
  return 'other';
}

export class NetworkHostAdapter {
  async status(): Promise<ReaderNetworkStatusResponse> {
    try {
      const hasNetwork = await connection.hasDefaultNet();
      if (!hasNetwork) {
        return {
          connected: false,
          status: 'offline',
          interface: 'none',
          isExpensive: false,
          isConstrained: false,
        };
      }
      const handle = await connection.getDefaultNet();
      const capabilities = await connection.getNetCapabilities(handle);
      const hasInternet = containsCapability(
        capabilities.networkCap,
        connection.NetCap.NET_CAPABILITY_INTERNET,
      );
      const validated = containsCapability(
        capabilities.networkCap,
        connection.NetCap.NET_CAPABILITY_VALIDATED,
      );
      const portal = containsCapability(
        capabilities.networkCap,
        connection.NetCap.NET_CAPABILITY_PORTAL,
      );
      const checking = containsCapability(
        capabilities.networkCap,
        connection.NetCap.NET_CAPABILITY_CHECKING_CONNECTIVITY,
      );
      const notMetered = containsCapability(
        capabilities.networkCap,
        connection.NetCap.NET_CAPABILITY_NOT_METERED,
      );
      const connected = hasInternet && validated;
      const status = connected ? 'online' : (hasInternet ? 'limited' : 'offline');
      return {
        connected: connected,
        status: status,
        interface: bearerName(capabilities.bearerTypes),
        isExpensive: !notMetered,
        isConstrained: portal || checking,
      };
    } catch (e) {
      throw new Error(`NetworkHostAdapter.status failed: ${e}`);
    }
  }
}
