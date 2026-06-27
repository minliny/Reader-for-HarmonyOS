// HttpExecuteHandler — handles the 'http.execute' capability.
//
// Core emits host.request with capability='http.execute' and params matching
// HostHttpRequest; this handler delegates to HostTransport, then wraps the
// HostHttpResponse as HostReplySuccess.result (for host.complete).
//
// Mirrors Android bindings/android/.../HttpExecuteHandler.java.
import { CapabilityHandler } from './CapabilityHandler';
import { HostTransport } from './HostTransport';
import { HostHttpRequest, HostHttpResponse } from './HttpRequest';
import { HostReply, hostReplySuccess, hostReplyError } from './HostReply';

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
