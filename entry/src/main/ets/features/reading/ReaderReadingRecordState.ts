export type ReadingRecord = { deviceId: string; bookName: string; readTime: number; lastRead: number };
export type ReadingRecordReceipt = { operationId: string; sequence: number; deviceId: string; bookName: string;
  author: string; elapsedMillis: number; readAt: number; record: ReadingRecord };
/** Fixed UI-accepted delta. Native identity is assigned once, after the current
 * Core watermark is observed; it is never reassigned after native dispatch. */
export class ReadingRecordIntent {
  readonly acceptanceId: string;
  readonly bookName: string;
  readonly elapsedMillis: number;
  readonly readAt: number;
  operationId: string | undefined = undefined;
  sequence: number | undefined = undefined;
  constructor(acceptanceId: string, bookName: string, elapsedMillis: number, readAt: number) {
    this.acceptanceId = acceptanceId; this.bookName = bookName;
    this.elapsedMillis = elapsedMillis; this.readAt = readAt;
  }
}
export class ReadingRecordRecoveryError extends Error {
  readonly kind: 'pending' | 'blocked';
  constructor(kind: 'pending' | 'blocked', message: string) { super(message); this.kind = kind; }
}
