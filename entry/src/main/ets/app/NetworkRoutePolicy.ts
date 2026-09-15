import connection from '@ohos.net.connection';
import { httpUrlHostname, isPrivateNetworkTarget } from './HttpTransportPolicy';

export type NetworkTarget = {
  host: string;
  addresses: string[];
  route: 'direct' | 'systemProxy' | 'systemSynthetic';
  bypassSystemProxy?: boolean;
};

type NetworkEnvironmentDetails = {
  category: string;
  phase: string;
  operation?: string;
  platformCode?: number;
  platformType?: string;
};

export class NetworkEnvironmentError extends Error {
  readonly code: string = 'NETWORK_ERROR';
  readonly retryable: boolean = true;
  readonly details: NetworkEnvironmentDetails;
  constructor(phase: 'dns' | 'route' | 'transport', message: string, operation?: string) {
    super(message);
    this.name = 'NetworkEnvironmentError';
    this.details = { category: 'NETWORK_ENVIRONMENT', phase };
    if (operation !== undefined) this.details.operation = operation;
  }
  static fromPlatform(phase: 'dns' | 'route' | 'transport', message: string,
    operation: string, cause: unknown): NetworkEnvironmentError {
    const failure = new NetworkEnvironmentError(phase, message, operation);
    // Native messages may contain a PAC URL, proxy endpoint or credentials.
    // Retain only the numeric platform code and a fixed language-level type.
    failure.details.platformType = cause instanceof TypeError ? 'TypeError' :
      cause instanceof RangeError ? 'RangeError' : cause instanceof Error ? 'Error' :
        cause === null ? 'null' : typeof cause;
    if (cause !== null && typeof cause === 'object') {
      const code = (cause as { code?: unknown }).code;
      if (typeof code === 'number' && Number.isSafeInteger(code)) failure.details.platformCode = code;
      // Some native bindings expose BusinessError.code as a decimal string.
      // Accept only a bounded integer, never an arbitrary diagnostic message.
      if (typeof code === 'string' && /^-?\d{1,15}$/.test(code)) {
        failure.details.platformCode = Number(code);
      }
    }
    return failure;
  }
  toJSON(): { code: string; message: string; retryable: boolean; details: NetworkEnvironmentDetails } {
    // Error.message is non-enumerable. The SDK forwards typed Host errors to
    // NAPI through JSON.stringify, so explicitly retain the required message.
    return { code: this.code, message: this.message, retryable: this.retryable, details: this.details };
  }
}

/** OpenHarmony NetStack CommonUtils::IsMatch/ReplaceCharacters adapter.
 * Apache-2.0, pinned 76e2ca18189c86d46203cca227afe6947292ee30.
 * Only the platform's exclusion syntax is translated; RegExp owns matching.
 */
export function isSystemProxyExcluded(host: string, exclusions: string[]): boolean {
  return exclusions.some((entry: string): boolean => entry.split(',').some((item: string): boolean => {
    const pattern = item.trim();
    if (pattern.length === 0) return false;
    if (pattern === '*') return true;
    if (!/^[a-zA-Z0-9\-_.*]+$/.test(pattern)) return pattern === host;
    const expression = pattern.replace(/\*/g, '.*').replace(/\.(?!\*)/g, '\\.');
    return new RegExp(`^(?:${expression})$`).test(host);
  }));
}

function isSyntheticDnsAddress(address: string): boolean {
  // A DNS result is transport metadata here, never a source-authored URL.
  return /^198\.(18|19)\.(\d{1,3})\.(\d{1,3})$/.test(address) &&
    address.split('.').every((part: string): boolean => Number(part) <= 255);
}

/** Whether this selected system interface has a route for this synthetic IPv4 address. */
function ownsSyntheticAddress(route: connection.RouteInfo, address: string): boolean {
  if (route.isExcludedRoute === true || route.interface.length === 0) return false;
  const prefix = route.destination.prefixLength;
  const network = route.destination.address.address.split('.');
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32 || network.length !== 4 ||
    network.some((part: string): boolean => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const size = Math.pow(2, 32 - prefix);
  const target = address.split('.').reduce((value: number, part: string): number => value * 256 + Number(part), 0);
  const base = network.reduce((value: number, part: string): number => value * 256 + Number(part), 0);
  return Math.floor(target / size) === Math.floor(base / size);
}

type SelectedNetwork = { handle: connection.NetHandle; appBound: boolean };

async function selectedNetwork(): Promise<SelectedNetwork> {
  // Never bind the process to a different network or replace the user's DNS.
  const bound = await connection.getAppNet();
  if (bound !== null && bound !== undefined && bound.netId > 0) return { handle: bound, appBound: true };
  const network = await connection.getDefaultNet();
  if (network === null || network === undefined || network.netId <= 0) {
    throw new NetworkEnvironmentError('route', '当前没有可用的系统网络，请检查代理或网络连接后重试');
  }
  return { handle: network, appBound: false };
}

async function hasSyntheticSystemRoute(network: connection.NetHandle, addresses: string[]): Promise<boolean> {
  const properties = await connection.getConnectionProperties(network);
  return addresses.every((address: string): boolean => {
    const excluded = properties.routes.some((route: connection.RouteInfo): boolean =>
      route.interface === properties.interfaceName && route.isExcludedRoute === true &&
        ownsSyntheticAddress({ ...route, isExcludedRoute: false }, address));
    return !excluded && properties.routes.some((route: connection.RouteInfo): boolean =>
      route.interface === properties.interfaceName && ownsSyntheticAddress(route, address));
  });
}

/** System proxy configuration is a user-owned transport trust boundary.
 * Direct DNS addresses are checked and pinned. A selected system proxy owns
 * remote DNS; its endpoint and PAC are never taken from a book/source rule.
 * DNS-only synthetic addresses follow the selected system network's route,
 * including a transparent proxy on a VM host or router without a local VPN.
 * A matching route proves routing delegation, not the proxy's final address.
 * Transports pin this original DNS answer while preserving the URL/Host/TLS.
 */
export async function prepareNetworkTarget(requestUrl: string): Promise<NetworkTarget> {
  const host = httpUrlHostname(requestUrl);
  if (host === undefined || isPrivateNetworkTarget(host)) {
    throw new Error('url targets a private, loopback, link-local or invalid address and is not allowed');
  }
  let bypassSystemProxy = false;
  let operation = 'getDefaultHttpProxy';
  try {
    const proxy = await connection.getDefaultHttpProxy();
    if (proxy === null || typeof proxy !== 'object' || typeof proxy.host !== 'string' ||
      typeof proxy.port !== 'number' || !Number.isInteger(proxy.port) || proxy.port < 0 || proxy.port > 65535 ||
      !Array.isArray(proxy.exclusionList) || proxy.exclusionList.some((item: string): boolean => typeof item !== 'string')) {
      throw new TypeError('Invalid system proxy result type');
    }
    // API 20+ getPacFileUrl reports the script used to enable system PAC and
    // returns '' when none is configured (Phone PAC support starts at API 23).
    // Legacy getPacUrl may throw 2100003 for an absent script; its setter only
    // stores an address and does not enable the system proxy. Do not query it.
    // Keep this read fresh: caching it without a configuration revision could
    // route a PAC DIRECT request through a proxy, bypassing DNS admission.
    operation = 'getPacFileUrl';
    const pacFileUrl = connection.getPacFileUrl();
    if (typeof pacFileUrl !== 'string') throw new TypeError('Invalid PAC file URL result type');
    const pacConfigured = pacFileUrl.length > 0;
    operation = 'proxy.configuration';
    const hasProxy = proxy.host.trim().length > 0 && proxy.port > 0;
    if (pacConfigured && !hasProxy) {
      throw new NetworkEnvironmentError('route', '系统代理配置尚未就绪，请稍后重试', operation);
    }
    bypassSystemProxy = hasProxy;
    if (hasProxy && !isSystemProxyExcluded(host, proxy.exclusionList)) {
      // Reuse the system PAC engine. For DIRECT, the transport must explicitly
      // bypass the local PAC proxy so the validated application DNS pin applies.
      operation = 'findProxyForUrl';
      const pac = pacConfigured ? connection.findProxyForUrl(requestUrl).trim() : '';
      if (pacConfigured && pac.length === 0) {
        throw new NetworkEnvironmentError('route', '系统代理配置尚未就绪，请稍后重试', operation);
      }
      if (!pacConfigured || !/^DIRECT(?:\s*;|$)/i.test(pac)) {
        return { host, addresses: [], route: 'systemProxy' };
      }
    }
  } catch (error) {
    if (error instanceof NetworkEnvironmentError) throw error;
    throw NetworkEnvironmentError.fromPlatform('route', '无法读取系统网络代理配置，请检查网络连接后重试', operation, error);
  }
  if (host.includes(':') || /^[0-9.]+$/.test(host)) return { host, addresses: [host], route: 'direct', bypassSystemProxy };
  let network: SelectedNetwork;
  try { network = await selectedNetwork(); } catch (error) {
    if (error instanceof NetworkEnvironmentError) throw error;
    throw new NetworkEnvironmentError('route', '无法确定当前系统网络，请检查代理或网络连接后重试');
  }
  let addresses: string[];
  try {
    // Only an existing app binding selects an explicit DNS network. The global
    // API preserves the OS's UID/VPN DNS policy when the app has no binding.
    const resolved = network.appBound ? await network.handle.getAddressesByName(host) : await connection.getAddressesByName(host);
    addresses = resolved.map((item: connection.NetAddress): string =>
      item.address.trim().replace(/^\[/, '').replace(/\]$/, '').split('%')[0]);
  } catch (_) {
    throw new NetworkEnvironmentError('dns', '当前网络无法解析书源域名，请检查代理或网络连接后重试');
  }
  if (addresses.length === 0) throw new NetworkEnvironmentError('dns', '当前网络未返回书源地址，请稍后重试');
  const synthetic = addresses.filter((address: string): boolean => isSyntheticDnsAddress(address));
  for (const address of addresses) {
    if (address.length === 0 || (!address.includes(':') && !/^[0-9.]+$/.test(address)) ||
      (isPrivateNetworkTarget(address) && !isSyntheticDnsAddress(address))) {
      throw new Error('url resolves to a private, loopback, link-local or invalid address and is not allowed');
    }
  }
  if (synthetic.length > 0) {
    let ownsRoute = false;
    try { ownsRoute = await hasSyntheticSystemRoute(network.handle, synthetic); } catch (_) {}
    if (!ownsRoute) throw new NetworkEnvironmentError('route', '代理合成地址缺少可用的系统网络路由，请检查代理连接后重试');
  }
  // Do not admit DNS from a network that was replaced while it was resolving.
  try {
    const current = await selectedNetwork();
    if (current.handle.netId !== network.handle.netId || current.appBound !== network.appBound) {
      throw new NetworkEnvironmentError('route', '系统网络已切换，请稍后重试');
    }
  } catch (error) {
    if (error instanceof NetworkEnvironmentError) throw error;
    throw new NetworkEnvironmentError('route', '系统网络状态已变化，请稍后重试');
  }
  return { host, addresses, route: synthetic.length > 0 ? 'systemSynthetic' : 'direct', bypassSystemProxy };
}
