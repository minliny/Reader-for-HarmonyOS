export type RedirectMethodDecision = {
  method: string;
  keepBody: boolean;
};

export type HttpDeadlineState = 'active' | 'cancelled' | 'expired';

export type HttpResponseHeaders = Record<string, string>;

const CROSS_ORIGIN_SENSITIVE_HEADERS: string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'origin',
];

/** Shared 301/302/303/307/308 method/body policy used by the real Host loop. */
export function redirectMethodDecision(
  status: number,
  method: string,
  hasBody: boolean,
): RedirectMethodDecision {
  const upper = method.toUpperCase();
  const becomesGet = status === 303 && upper !== 'HEAD' ||
    (status === 301 || status === 302) && upper === 'POST';
  return becomesGet ? { method: 'GET', keepBody: false } : { method, keepBody: hasBody };
}

export function allowNextRedirect(
  followRedirects: boolean,
  maxRedirects: number,
  observedHops: number,
): boolean {
  return followRedirects && observedHops < maxRedirects;
}

export function isCrossOriginSensitiveHeader(name: string): boolean {
  return CROSS_ORIGIN_SENSITIVE_HEADERS.indexOf(name.trim().toLowerCase()) >= 0;
}

export function mergeCookieHeader(explicitCookie: string, jarCookie: string): string {
  const parts: string[] = [];
  if (explicitCookie.trim().length > 0) {
    parts.push(explicitCookie.trim());
  }
  if (jarCookie.trim().length > 0) {
    parts.push(jarCookie.trim());
  }
  return parts.join('; ');
}

export function observedCookieNames(setCookie: string[]): string[] {
  const names: string[] = [];
  for (const cookie of setCookie) {
    const separator = cookie.indexOf('=');
    if (separator > 0) {
      names.push(cookie.slice(0, separator).trim());
    }
  }
  return names;
}

/**
 * Maps charset labels the platform TextDecoder rejects onto equivalent
 * supported labels. HarmonyOS supports gbk/gb18030/big5 but not the legacy
 * 'gb2312' label that Chinese book sources declare; gbk is a strict superset
 * of gb2312 and decodes it byte-for-byte identically.
 */
export function normalizeCharsetLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.toLowerCase() === 'gb2312') {
    return 'gbk';
  }
  return trimmed;
}

/** Response header wins; the Core descriptor is the fallback for legacy pages. */
export function resolveResponseCharset(
  headers: HttpResponseHeaders,
  descriptorCharset: string | undefined,
): string {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== 'content-type') {
      continue;
    }
    const match = /charset\s*=\s*([^;\s]+)/i.exec(headers[key]);
    if (match !== null && match[1].trim().length > 0) {
      return normalizeCharsetLabel(match[1].trim());
    }
  }
  if (descriptorCharset !== undefined && descriptorCharset.trim().length > 0) {
    return normalizeCharsetLabel(descriptorCharset.trim());
  }
  return 'utf-8';
}

export function retryBackoffMillis(
  baseMillis: number,
  attempt: number,
  maxMillis: number,
  remainingMillis: number,
): number {
  return Math.min(baseMillis * attempt, maxMillis, remainingMillis);
}

/**
 * SSRF guard (P1-5): the single byte-level judge shared by the source-import
 * gate (SourceGateway) and the per-request execution gate (HttpExecuteHost)
 * so both layers enforce identical rules. Returns true when `hostname` is an
 * IP literal (or a DNS-resolved address) inside loopback, private,
 * link-local, or otherwise non-routable space: 10/8, 172.16/12, 192.168/16,
 * 127/8, 169.254/16, 0.0.0.0/8, ::1, ::, fe80::/10, fc00::/7, and ::ffff:-
 * mapped IPv4 judged by the IPv4 rules. Domain names return false — literal
 * byte rules cannot judge them; callers that need domain coverage must
 * resolve DNS first and re-run this function on every resolved address.
 */
export function isPrivateNetworkTarget(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split('%')[0]
    .trim();
  if (host.length === 0) {
    // Fail closed: a host that cannot be inspected is never admitted.
    return true;
  }
  if (host.indexOf(':') >= 0) {
    return isPrivateIpv6Literal(host);
  }
  if (/^[0-9.]+$/.test(host)) {
    return isPrivateIpv4Literal(host);
  }
  return false;
}

/**
 * Extracts the hostname of an http(s) URL without platform URL APIs, so the
 * import-time gate stays pure and node-executable. Returns undefined for
 * non-http(s) schemes, a missing authority, or a missing hostname.
 */
export function httpUrlHostname(value: string): string | undefined {
  const trimmed = value.trim();
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(trimmed);
  if (schemeMatch === null) {
    return undefined;
  }
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return undefined;
  }
  const authority = trimmed.slice(schemeMatch[0].length).split(/[/?#]/)[0];
  if (authority.length === 0) {
    return undefined;
  }
  const atSign = authority.lastIndexOf('@');
  const hostPort = atSign >= 0 ? authority.slice(atSign + 1) : authority;
  if (hostPort.startsWith('[')) {
    const bracketEnd = hostPort.indexOf(']');
    if (bracketEnd < 0) {
      return undefined;
    }
    return hostPort.slice(1, bracketEnd).toLowerCase();
  }
  const colon = hostPort.indexOf(':');
  const host = colon >= 0 ? hostPort.slice(0, colon) : hostPort;
  return host.length === 0 ? undefined : host.toLowerCase();
}

/** Security-sensitive clients use HTTPS only; parsing stays on the same
 * shared URL gate as the general HTTP transport.
 */
export function httpsUrlHostname(value: string): string | undefined {
  const trimmed = value.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return undefined;
  }
  return httpUrlHostname(trimmed);
}

/** Privacy projection for UI/error evidence. Paths, userinfo, query strings,
 * fragments and ports are intentionally omitted; only the scheme and host
 * classification needed by a user to identify the site remain.
 */
export function redactedHttpUrl(value: string): string {
  const host = httpUrlHostname(value);
  if (host === undefined) {
    return '[invalid-url]';
  }
  const scheme = /^https:\/\//i.test(value.trim()) ? 'https' : 'http';
  const displayHost = host.indexOf(':') >= 0 ? `[${host}]` : host;
  return `${scheme}://${displayHost}/…`;
}

function isPrivateIpv4Literal(host: string): boolean {
  const parts = host.split('.');
  // Non-canonical numeric hosts ('127.1', '2130706433', '010.0.0.1') are
  // re-interpreted by resolvers in surprising ways (short forms, integer
  // forms, octal octets); reject instead of guessing.
  if (parts.length !== 4) {
    return true;
  }
  const first = ipv4OctetValue(parts[0]);
  const second = ipv4OctetValue(parts[1]);
  const third = ipv4OctetValue(parts[2]);
  const fourth = ipv4OctetValue(parts[3]);
  if (first < 0 || second < 0 || third < 0 || fourth < 0) {
    return true;
  }
  return isPrivateIpv4Bytes(first, second, third, fourth);
}

function ipv4OctetValue(part: string): number {
  if (part.length === 0 || part.length > 3 ||
    (part.length > 1 && part.charCodeAt(0) === 0x30)) {
    return -1; // Leading zero: octal ambiguity, fail closed.
  }
  const value = Number(part);
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    return -1;
  }
  return value;
}

function isPrivateIpv4Bytes(first: number, second: number, third: number, fourth: number): boolean {
  // 0.0.0.0/8 "this network" (0.0.0.0 reaches loopback on many stacks),
  // 10/8 private, 127/8 loopback, 169.254/16 link-local, 172.16/12 private,
  // 192.168/16 private.
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224;
}

function isPrivateIpv6Literal(host: string): boolean {
  const groups = parseIpv6Hextets(host);
  if (groups === null) {
    // Fail closed: an unparseable literal (including embedded dotted-quad
    // tails this judge does not fully model) is never admitted.
    return true;
  }
  const allZero = groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
    groups[3] === 0 && groups[4] === 0 && groups[5] === 0 && groups[6] === 0 &&
    groups[7] === 0;
  if (allZero) {
    return true; // :: unspecified address, the IPv6 analogue of 0.0.0.0.
  }
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 &&
    groups[4] === 0 && groups[5] === 0 && groups[6] === 0 && groups[7] === 1) {
    return true; // ::1 loopback.
  }
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 &&
    groups[4] === 0 && groups[5] === 0xffff) {
    // ::ffff:0:0/96 IPv4-mapped — judge the embedded IPv4 bytes.
    return isPrivateIpv4Bytes(
      (groups[6] >> 8) & 0xff,
      groups[6] & 0xff,
      (groups[7] >> 8) & 0xff,
      groups[7] & 0xff,
    );
  }
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 &&
    groups[4] === 0 && groups[5] === 0) {
    return true; // Deprecated IPv4-compatible ::/96; do not delegate its interpretation.
  }
  if (groups[0] === 0x0064 && groups[1] === 0xff9b &&
    (groups[2] === 0 || groups[2] === 1)) {
    return true; // NAT64 translation prefixes can otherwise tunnel a private IPv4 target.
  }
  if (groups[0] === 0x2002 || groups[0] === 0x2001 && groups[1] === 0) {
    return true; // 6to4 and Teredo transition addresses embed another network target.
  }
  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link-local.
  }
  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 unique-local (includes fd00::/8).
  }
  if ((groups[0] & 0xff00) === 0xff00) {
    return true; // ff00::/8 multicast.
  }
  if ((groups[0] & 0xffc0) === 0xfec0) {
    return true; // fec0::/10 deprecated site-local, never a public target.
  }
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) {
    return true; // 2001:db8::/32 documentation range.
  }
  return false;
}

function parseIpv6Hextets(host: string): number[] | null {
  let headParts: string[];
  let tailParts: string[] = [];
  const compression = host.indexOf('::');
  if (compression >= 0) {
    if (host.indexOf('::', compression + 2) >= 0) {
      return null; // More than one '::' compression.
    }
    const headText = host.slice(0, compression);
    const tailText = host.slice(compression + 2);
    headParts = headText.length === 0 ? [] : headText.split(':');
    tailParts = tailText.length === 0 ? [] : tailText.split(':');
  } else {
    headParts = host.split(':');
  }
  if (headParts.length + tailParts.length > 8 ||
    (compression < 0 && headParts.length !== 8)) {
    return null;
  }
  const groups: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < headParts.length; index += 1) {
    const value = parseIpv6Hextet(headParts[index]);
    if (value === null) {
      return null;
    }
    groups[index] = value;
  }
  for (let index = 0; index < tailParts.length; index += 1) {
    const value = parseIpv6Hextet(tailParts[index]);
    if (value === null) {
      return null;
    }
    groups[8 - tailParts.length + index] = value;
  }
  return groups;
}

function parseIpv6Hextet(text: string): number | null {
  if (text.length === 0 || text.length > 4) {
    return null;
  }
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const isDigit = code >= 0x30 && code <= 0x39;
    const isLowerHex = code >= 0x61 && code <= 0x66;
    if (!isDigit && !isLowerHex) {
      return null;
    }
  }
  return parseInt(text, 16);
}

export function httpDeadlineState(
  cancelled: boolean,
  nowMillis: number,
  deadlineAtMillis: number,
): HttpDeadlineState {
  if (cancelled) {
    return 'cancelled';
  }
  return nowMillis >= deadlineAtMillis ? 'expired' : 'active';
}
