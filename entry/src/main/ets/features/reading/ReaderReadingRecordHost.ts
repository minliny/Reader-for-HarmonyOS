import { ReadingRecordIntent } from './ReaderReadingRecordState';

export interface ReaderReadingRecordDriver {
  createIntent(bookName: string, elapsedMillis: number, readAt: number): ReadingRecordIntent;
  handoff(intent: ReadingRecordIntent): void;
}

/** Component clock only. The application-owned driver accepts elapsed time
 * synchronously and persists/reconciles it independently of UI lifetime. */
export class ReaderReadingRecordHost {
  activeSinceMs: number = 0;
  pendingMillis: number = 0;
  private timer: number = -1;
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
      this.handoff();
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

  retire(): void { this.clearTimer(); this.capture(false); this.handoff(); }

  /** Ownership transfer has no disk/native await. Clear the scalar only after
   * the Runtime driver has accepted it; a synchronous validation failure keeps
   * the original elapsed time and diagnostic rather than claiming success. */
  handoff(): void {
    if (this.pendingMillis <= 0) return;
    try {
      const intent = this.driver.createIntent(this.title(), this.pendingMillis, this.now());
      this.driver.handoff(intent);
      this.pendingMillis = 0;
    } catch (error) { this.diagnose(error as Error); }
  }

  flush(): Promise<void> { this.handoff(); return Promise.resolve(); }
  flushForExit(): Promise<void> { return this.flush(); }

  private diagnose(error: Error): void { try { this.log(error); } catch (_diagnosticError) {} }
}
