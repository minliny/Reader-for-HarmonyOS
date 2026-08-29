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
