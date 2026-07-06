// HostHttpRequest / HostHttpResponse — DTOs mirroring Core's host.request.params
// shape for the http.execute capability.
//
// Fields aligned with:
// - Android bindings/android/.../HttpRequest.java + HttpResponse.java
// - protocol/reader-command.schema.json (host.execute method)
// - Swift Core Sources/ReaderCoreProtocols/NetworkProtocols.swift HTTPRequest/HTTPResponse

import { RedirectHop } from './RedirectChainCollector';

export interface HostHttpRequest {
  url: string;
  method: string;            // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | ...
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  charset?: string;          // hint for response decoding
  // Hint for the transport: whether to follow redirects. NOTE: HarmonyOS
  // @ohos.net.http does NOT honor this flag (platform auto-follows); the
  // transport logs it for observability but cannot disable auto-follow.
  follow_redirects?: boolean;
  max_redirects?: number;
}

export interface HostHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  // After redirects. undefined signals degradation: the transport could not
  // determine the post-redirect URL (e.g. on('headersReceive') did not fire
  // and the request hit the platform redirect cap, error 2300047, with no
  // Location captured). Callers must treat undefined as "unknown finalUrl"
  // rather than falling back to request.url.
  finalUrl: string | undefined;
  charsetHint?: string;
  // Redirect chain reconstructed by the transport (Approach A hybrid). Each
  // hop carries fromUrl/toUrl; absent when no redirects were observed or when
  // the transport cannot reconstruct the chain. Type imported from
  // RedirectChainCollector to avoid duplicate definitions.
  redirects?: RedirectHop[];
}
