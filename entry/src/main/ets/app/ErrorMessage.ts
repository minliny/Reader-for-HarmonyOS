/**
 * Extracts a human-readable message from an unknown thrown value.
 *
 * Catch sites historically used `error instanceof Error ? error.message : \`${error}\``.
 * When a host (NAPI RPC envelope, ArkTS runtime, HTTP stack) throws a plain
 * object, template interpolation collapses it to "[object Object]" and every
 * downstream diagnostic — hilog lines, orchestrator failure records, UI error
 * text — loses the actual cause. This helper keeps the real content: the
 * object's own `message` field when present, else its JSON form (truncated),
 * else the interpolated string.
 */
export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    const envelope = error as Record<string, Object>;
    const message = envelope['message'];
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    try {
      const json = JSON.stringify(error);
      if (typeof json === 'string' && json.length > 0 && json !== '{}' && json !== '[]') {
        return json.length > 500 ? `${json.substring(0, 497)}...` : json;
      }
    } catch (serializationFailure) {
      // Cyclic or otherwise non-serializable object: fall through to String().
      void serializationFailure;
    }
  }
  return `${error}`;
}

/** Safe association for an observed native HTTP rejection, never response data. */
export type HttpTransportFailureSummary = {
  category: 'SOURCE_HTTP_FAILED';
  phase: 'transport';
  stage: 'request.dispatch';
  requestId?: number;
  operationId?: number;
  platformCode?: number;
  elapsedMs?: number;
  transient?: boolean;
};

/** Read the SDK/Core error envelopes already used by feature error handling. */
export function httpTransportFailureSummary(error: unknown): HttpTransportFailureSummary | undefined {
  const raw = errorObject(error);
  const event = errorObject(raw?.['event']);
  const failure = errorObject(event?.['error']) ?? errorObject(raw?.['error']) ?? raw;
  if (failure?.['code'] === 'CANCELLED' || failure?.['code'] === 'TIMEOUT') return undefined;
  const details = errorObject(failure?.['details']);
  // Do not recover stale nested Host evidence from a later independent rule
  // error. Core must have retained the category on the current failure itself.
  if (details?.['category'] !== 'SOURCE_HTTP_FAILED') return undefined;
  const host = errorObject(details['host']);
  const diagnostics = errorObject(host?.['diagnostics']);
  const evidence = errorObject(details['cause']) ?? errorObject(diagnostics?.['details']) ?? details;
  if (evidence['category'] !== 'SOURCE_HTTP_FAILED' || evidence['phase'] !== 'transport' ||
    evidence['stage'] !== 'request.dispatch') return undefined;
  const summary: HttpTransportFailureSummary = {
    category: 'SOURCE_HTTP_FAILED', phase: 'transport', stage: 'request.dispatch',
  };
  const requestId = evidence['requestId'] ?? host?.['requestId'] ?? event?.['requestId'];
  const operationId = host?.['operationId'];
  if (typeof requestId === 'number' && Number.isSafeInteger(requestId) && requestId > 0) summary.requestId = requestId;
  if (typeof operationId === 'number' && Number.isSafeInteger(operationId) && operationId > 0) summary.operationId = operationId;
  const platformCode = evidence['platformCode'];
  if (typeof platformCode === 'number' && Number.isSafeInteger(platformCode)) summary.platformCode = platformCode;
  const elapsedMs = evidence['elapsedMs'];
  if (typeof elapsedMs === 'number' && Number.isSafeInteger(elapsedMs) && elapsedMs >= 0) summary.elapsedMs = elapsedMs;
  const transient = evidence['transient'];
  if (typeof transient === 'boolean') summary.transient = transient;
  return summary;
}

function errorObject(value: unknown): Record<string, Object> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Object> : undefined;
}

/** Recognize only structured transport evidence, never words in a source's response. */
export function isNetworkEnvironmentFailure(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const raw = error as Record<string, Object>;
  if (raw['category'] === 'NETWORK_ENVIRONMENT') return true;
  // These are the SDK error, Core Host diagnostics and gateway cause envelopes.
  // Limit traversal to those fields; arbitrary response bodies are not evidence.
  return networkEnvironmentEnvelope(raw, 0);
}

function networkEnvironmentEnvelope(value: Object, depth: number): boolean {
  if (depth > 6 || value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, Object>;
  if (raw['category'] === 'NETWORK_ENVIRONMENT') return true;
  for (const key of ['details', 'host', 'diagnostics', 'event', 'error', 'causeValue']) {
    const nested = raw[key];
    if (nested !== undefined && networkEnvironmentEnvelope(nested, depth + 1)) return true;
  }
  return false;
}
