import { ReadingRecordIntent, ReadingRecordRecoveryError, type ReadingRecord } from './ReaderReadingRecordState';

export interface ReaderReadingRecordDriver {
  createIntent(bookName: string, elapsedMillis: number, readAt: number): ReadingRecordIntent;
  accumulate(intent: ReadingRecordIntent): Promise<ReadingRecord>;
}

/** Reading duration producer. A single accepted delta survives unknown ACKs;
 * additional elapsed time remains an unaccepted scalar, not a growing queue.
 * Neither retries nor UI retirement assign the accepted delta a new identity. */
export class ReaderReadingRecordHost {
  activeSinceMs: number = 0;
  pendingMillis: number = 0;
  private timer: number = -1;
  private accepted: ReadingRecordIntent | undefined = undefined;
  private inFlight: Promise<void> | undefined = undefined;
  private readonly driver: ReaderReadingRecordDriver;
  private readonly title: () => string;
  private readonly log: (error: Error) => void;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delay: number) => number;
  private readonly cancel: (timer: number) => void;

  constructor(driver: ReaderReadingRecordDriver, title: () => string, log: (error: Error) => void,
    now: () => number = (): number => Date.now(),
    schedule: (callback: () => void, delay: number) => number = (callback, delay): number => setTimeout(callback, delay),
    cancel: (timer: number) => void = (timer): void => clearTimeout(timer)) {
    this.driver = driver; this.title = title; this.log = log; this.now = now; this.schedule = schedule; this.cancel = cancel;
  }

  begin(isCurrent: () => boolean): void {
    if (!isCurrent()) return;
    if (this.activeSinceMs <= 0) this.activeSinceMs = this.now();
    this.clearTimer();
    this.timer = this.schedule((): void => {
      this.timer = -1;
      if (!isCurrent() || this.activeSinceMs <= 0) return;
      this.capture(true);
      void this.flush().catch((error: Error): void => this.diagnose(error));
      this.begin(isCurrent);
    }, 30000);
  }

  capture(continueClock: boolean): void {
    if (this.activeSinceMs <= 0) return;
    const now = this.now();
    const elapsed = Math.max(0, now - this.activeSinceMs);
    this.activeSinceMs = continueClock ? now : 0;
    const accumulated = this.pendingMillis + elapsed;
    this.pendingMillis = Number.isSafeInteger(accumulated) ? accumulated : Number.MAX_SAFE_INTEGER;
  }

  clearTimer(): void {
    if (this.timer >= 0) { this.cancel(this.timer); this.timer = -1; }
  }

  /** Forced unmount does not start another write. Dispatched/accepted work and
   * its persistent journal keep their identity; only the unaccepted clock clears. */
  retire(): void { this.clearTimer(); this.activeSinceMs = 0; this.pendingMillis = 0; }

  flush(): Promise<void> {
    if (this.inFlight !== undefined) return this.inFlight;
    const work = this.flushAccepted();
    const observed = work.finally((): void => { if (this.inFlight === observed) this.inFlight = undefined; });
    this.inFlight = observed;
    return observed;
  }

  private async flushAccepted(): Promise<void> {
    if (this.accepted !== undefined) {
      await this.driver.accumulate(this.accepted);
      this.accepted = undefined;
    }
    if (this.pendingMillis <= 0) return;
    const elapsed = this.pendingMillis;
    this.accepted = this.driver.createIntent(this.title(), elapsed, this.now());
    this.pendingMillis = 0;
    await this.driver.accumulate(this.accepted);
    this.accepted = undefined;
  }

  /** Presentation deadline only: the actual durable tail is not cancelled or
   * released, and a retry cannot start a competing journal behind a missing ACK. */
  async flushForExit(): Promise<void> {
    let deadline = -1;
    const expiry = new Promise<void>((_resolve, reject): void => {
      deadline = this.schedule((): void => reject(new ReadingRecordRecoveryError('pending',
        '阅读时长核对尚未返回。可重试核对或继续阅读；当前时长保持待核对，不会重复累计。')), 15000);
    });
    try { await Promise.race([this.flush(), expiry]); }
    finally { if (deadline >= 0) this.cancel(deadline); }
  }

  private diagnose(error: Error): void { try { this.log(error); } catch (_diagnosticError) {} }
}
