// HttpExecuteHandler — handles the 'http.execute' capability.
//
// Core emits host.request with capability='http.execute' and params matching
// HostHttpRequest; this handler delegates to HostTransport, then wraps the
// HostHttpResponse as HostReplySuccess.result (for host.complete).
//
// Mirrors Android bindings/android/.../HttpExecuteHandler.java. The result
// object carries {status, headers, body, finalUrl, charsetHint, cookies?}.
// cookies is parsed from the Set-Cookie response header (case-insensitive
// lookup) using the same best-effort split as the Android implementation:
// multi-cookie Set-Cookie values are joined with ", " by parseHeaders, so we
// split on ", " and keep the name=value segment of each fragment. This is
// sufficient for the login_cookie lane proof (Core re-parses via its own
// cookie store on the host.complete round-trip).
import { CapabilityHandler } from './CapabilityHandler';
import { HostTransport } from './HostTransport';
import { HostHttpRequest, HostHttpResponse } from './HttpRequest';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

export const HTTP_EXECUTE_CAPABILITY = 'http.execute';

export function makeHttpExecuteHandler(transport: HostTransport): CapabilityHandler {
  const handler: CapabilityHandler = async (params: Record<string, Object>): Promise<HostReply> => {
    const req = parseHttpRequest(params);
    if (req === null) {
      return hostReplyError('INVALID_ARGUMENT', 'http.execute params missing url/method', false);
    }
    try {
      const resp: HostHttpResponse = await transport.execute(req);
      // SDK-COMPAT: build result via typed record to satisfy arkts-no-untyped-obj-literals.
      const result: Record<string, Object> = {} as Record<string, Object>;
      result['status'] = resp.status;
      result['headers'] = resp.headers;
      result['body'] = resp.body;
      result['finalUrl'] = resp.finalUrl;
      result['charsetHint'] = resp.charsetHint ?? '';
      const cookies = extractCookies(resp.headers);
      if (cookies.length > 0) {
        result['cookies'] = cookies;
      }
      return hostReplySuccess(result);
    } catch (e) {
      return hostReplyError('NETWORK_ERROR', `http.execute failed: ${e}`, true);
    }
  };
  return handler;
}

function parseHttpRequest(params: Record<string, Object>): HostHttpRequest | null {
  const urlValue = params['url'];
  const methodValue = params['method'];
  if (typeof urlValue !== 'string' || typeof methodValue !== 'string') {
    return null;
  }
  const req: HostHttpRequest = {
    url: urlValue as string,
    method: (methodValue as string).toUpperCase()
  };
  const headersValue = params['headers'];
  if (headersValue !== null && headersValue !== undefined && typeof headersValue === 'object') {
    req.headers = headersValue as Record<string, string>;
  }
  const bodyValue = params['body'];
  if (typeof bodyValue === 'string') {
    req.body = bodyValue as string;
  }
  const timeoutMsValue = params['timeoutMs'];
  if (typeof timeoutMsValue === 'number') {
    req.timeoutMs = timeoutMsValue as number;
  }
  const charsetValue = params['charset'];
  if (typeof charsetValue === 'string') {
    req.charset = charsetValue as string;
  }
  return req;
}

// Parse Set-Cookie header(s) into {name, value} records. Mirrors Android
// HttpExecuteHandler.extractCookies: case-insensitive header lookup, split on
// ", " (parseHeaders joins multi-value headers this way), keep name=value
// segment of each fragment. expires/max-age/domain/path attributes are
// intentionally dropped — Core's cookie store re-derives them on the
// host.complete round-trip via cookie.set.
function extractCookies(headers: Record<string, string>): Record<string, string>[] {
  const cookies: Record<string, string>[] = [];
  if (headers === null || headers === undefined) {
    return cookies;
  }
  let setCookie = '';
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.toLowerCase() === 'set-cookie') {
      setCookie = headers[k];
      break;
    }
  }
  if (setCookie.length === 0) {
    return cookies;
  }
  const fragments = setCookie.split(', ');
  for (let i = 0; i < fragments.length; i++) {
    const raw = fragments[i];
    const semi = raw.indexOf(';');
    const nameValue = (semi >= 0 ? raw.substring(0, semi) : raw).trim();
    const eq = nameValue.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const name = nameValue.substring(0, eq).trim();
    const value = nameValue.substring(eq + 1).trim();
    if (name.length === 0) {
      continue;
    }
    const cookie: Record<string, string> = {} as Record<string, string>;
    cookie['name'] = name;
    cookie['value'] = value;
    cookies.push(cookie);
  }
  return cookies;
}
