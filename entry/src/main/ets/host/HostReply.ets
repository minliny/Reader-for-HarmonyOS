// HostReply — wraps the result or error that the host sends back to Core
// via host.complete (success) or host.error (failure).
//
// Mirrors Android bindings/android/.../HostReply.java. ArkTS-safe: uses a
// single interface with a boolean discriminator + optional fields rather
// than a discriminated union (arkts-no-union-types rejects object unions).

export interface HostReply {
  ok: boolean;
  // Present when ok === true: the result object sent as host.complete.params.result.
  result?: object;
  // Present when ok === false: error code / message / retryability sent as host.error.params.error.
  code?: string;
  message?: string;
  retryable?: boolean;
}

export function hostReplySuccess(result: object): HostReply {
  return { ok: true, result: result } as HostReply;
}

export function hostReplyError(code: string, message: string, retryable: boolean = false): HostReply {
  return { ok: false, code: code, message: message, retryable: retryable } as HostReply;
}
