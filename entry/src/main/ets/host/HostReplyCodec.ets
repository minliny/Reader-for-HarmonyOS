// HostReplyCodec — encode HostReply as host.complete / host.error JSON commands.
//
// Mirrors Android bindings/android/.../HostReplyCodec.java. On HarmonyOS the
// NAPI module exposes dedicated functions completeHostRequest / failHostRequest
// that take the result/error object directly (no JSON command string needed),
// so HostBus uses those. These JSON builders are retained for:
// - diagnostics / logging (logging the exact JSON command that the Android
//   sendCommand path would emit)
// - parity with the Android host-adapter surface
// - a future switch to a sendCommand-based reply path if the NAPI drops the
//   dedicated functions.

import { HostReply } from './HostReply';

export function buildHostCompleteJson(requestId: number, operationId: number, result: object): string {
  const cmd: Record<string, Object> = {} as Record<string, Object>;
  cmd['protocolVersion'] = 1;
  cmd['requestId'] = requestId;
  cmd['method'] = 'host.complete';
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['operationId'] = operationId;
  params['result'] = result;
  cmd['params'] = params;
  return JSON.stringify(cmd);
}

export function buildHostErrorJson(requestId: number, operationId: number, code: string, message: string, retryable: boolean): string {
  const cmd: Record<string, Object> = {} as Record<string, Object>;
  cmd['protocolVersion'] = 1;
  cmd['requestId'] = requestId;
  cmd['method'] = 'host.error';
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['operationId'] = operationId;
  const err: Record<string, Object> = {} as Record<string, Object>;
  err['code'] = code;
  err['message'] = message;
  err['retryable'] = retryable;
  params['error'] = err;
  cmd['params'] = params;
  return JSON.stringify(cmd);
}

// Extract the result/error object from a HostReply for the NAPI dedicated
// functions. HostBus calls completeHostRequest(operationId, resultObject) or
// failHostRequest(operationId, errorObject) with these.
export function replyResultObject(reply: HostReply): object {
  return reply.result ?? ({} as Record<string, Object>);
}

export function replyErrorObject(reply: HostReply): object {
  const err: Record<string, Object> = {} as Record<string, Object>;
  err['code'] = reply.code ?? 'INTERNAL';
  err['message'] = reply.message ?? '';
  err['retryable'] = reply.retryable ?? false;
  return err;
}
