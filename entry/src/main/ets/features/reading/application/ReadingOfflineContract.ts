export type ReadingOfflineMaterializationErrorCode =
  'storage_full' | 'cancelled' | 'host_materialization_failed';

/** Stable Host-to-Core failure identity for the offline resource phase. */
export class ReadingOfflineMaterializationError extends Error {
  readonly code: ReadingOfflineMaterializationErrorCode;

  constructor(code: ReadingOfflineMaterializationErrorCode, message: string) {
    super(message);
    this.name = 'ReadingOfflineMaterializationError';
    this.code = code;
  }
}

export function normalizeReadingOfflineMaterializationError(
  error: Error,
): ReadingOfflineMaterializationError {
  if (error instanceof ReadingOfflineMaterializationError) {
    return error;
  }
  if (error.message === 'reading offline request was superseded') {
    return new ReadingOfflineMaterializationError('cancelled', error.message);
  }
  return new ReadingOfflineMaterializationError('host_materialization_failed', error.message);
}

export function assertReadingOfflineWriteCapacity(
  freeBytes: number,
  writeBytes: number,
  reserveBytes: number,
): void {
  if (!Number.isSafeInteger(freeBytes) || freeBytes < 0 ||
    !Number.isSafeInteger(writeBytes) || writeBytes < 0 ||
    !Number.isSafeInteger(reserveBytes) || reserveBytes < 0) {
    throw new Error('offline reading image capacity values must be non-negative safe integers');
  }
  if (freeBytes < writeBytes + reserveBytes) {
    throw new ReadingOfflineMaterializationError(
      'storage_full',
      'offline reading image storage does not have enough free space',
    );
  }
}
