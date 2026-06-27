// HostHttpRequest / HostHttpResponse — DTOs mirroring Core's host.request.params
// shape for the http.execute capability.
//
// Fields aligned with:
// - Android bindings/android/.../HttpRequest.java + HttpResponse.java
// - protocol/reader-command.schema.json (host.execute method)
// - Swift Core Sources/ReaderCoreProtocols/NetworkProtocols.swift HTTPRequest/HTTPResponse

export interface HostHttpRequest {
  url: string;
  method: string;            // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | ...
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  charset?: string;          // hint for response decoding
}

export interface HostHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;          // after redirects (HarmonyOS @ohos.net.http does not expose this; set to request.url)
  charsetHint?: string;
}
