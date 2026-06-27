// HostTransport — interface for platform-owned HTTP transport.
//
// Mirrors Android bindings/android/.../HostTransport.java. Implementations
// execute a HostHttpRequest and return a HostHttpResponse. Core emits
// host.request with capability='http.execute' and params=HostHttpRequest;
// the host-adapter dispatches to HostTransport, wraps the result as
// host.complete.
//
// Per charter §4 / §10.2: Host owns real HTTP/TLS — Core only produces
// request descriptors, never opens sockets. HostTransport is the only HTTP
// execution path in the HarmonyOS host layer.

import { HostHttpRequest, HostHttpResponse } from './HttpRequest';

export interface HostTransport {
  execute(request: HostHttpRequest): Promise<HostHttpResponse>;
}
