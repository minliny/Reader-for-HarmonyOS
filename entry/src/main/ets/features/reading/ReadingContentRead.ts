import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { RemoteReadingGatewayError } from './RemoteReadingContract';

/** Retry a read transaction, never a write or a fragment of an old catalog.
 * The operation must reject when its captured content fence is revoked. */
export async function readWithStableContent<T>(runtime: ReadingGatewayRuntime, sourceId: string, bookId: string,
  isCurrent: () => boolean, read: (current: () => boolean) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', 'reading content read was cancelled');
    const valid = runtime.captureReadingContentValidity?.(sourceId, bookId);
    const current = (): boolean => isCurrent() && valid?.() !== false;
    try {
      if (!current()) throw new RemoteReadingGatewayError('cancelled', 'reading content read was cancelled');
      return await read(current);
    } catch (error) {
      if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', 'reading content read was cancelled',
        undefined, undefined, undefined, error);
      const changed = valid?.() === false ||
        (error instanceof RemoteReadingGatewayError && error.code === 'sourceVersionChanged');
      if (!changed || (error instanceof RemoteReadingGatewayError &&
        (error.code === 'storageFailure' || error.code === 'identityMismatch'))) throw error;
      if (attempt >= 2 || runtime.waitForReadingContentIdle === undefined)
        throw new RemoteReadingGatewayError('sourceVersionChanged', 'reading content read was cancelled after content changed',
          undefined, undefined, undefined, error);
      await runtime.waitForReadingContentIdle(sourceId, bookId);
      // Capture a fresh fence on the next attempt. A retired page cannot read
      // or publish again merely because background work has completed.
    }
  }
}
