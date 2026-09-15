/** One debug cold-start sample. Timer delay measures main-loop availability,
 * not rendered frames. No book, source, URL, or response data is recorded. */
export interface ReaderEventLoopSample {
  elapsedMs: number;
  uptimeMs: number;
  samples: number;
  maxDelayMs: number;
  delayedOver50Ms: number;
  reason: string;
}

export function readerEventLoopProbeEnabled(debug: boolean, mode: string,
  requested: Object | undefined): boolean {
  return debug === true && mode === 'debug' && requested === true;
}

export class ReaderEventLoopProbe {
  private timer: number = -1;
  private started: boolean = false;
  private startedAt: number = 0;
  private previousAt: number = 0;
  private emittedAt: number = 0;
  private samples: number = 0;
  private maxDelayMs: number = 0;
  private delayedOver50Ms: number = 0;
  private readonly now: () => number;
  private readonly record: (sample: ReaderEventLoopSample) => void;

  constructor(now: () => number, record: (sample: ReaderEventLoopSample) => void) {
    this.now = now;
    this.record = record;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    let at: number;
    try { at = this.now(); } catch (_) { return; }
    if (!Number.isFinite(at)) return;
    this.startedAt = at;
    this.previousAt = at;
    this.emittedAt = at;
    this.timer = setInterval((): void => this.tick(), 50);
  }

  stop(reason: string): void {
    this.started = true;
    if (this.timer < 0) return;
    clearInterval(this.timer);
    this.timer = -1;
    this.emit(this.previousAt, reason);
  }

  private tick(): void {
    if (this.timer < 0) return;
    let at: number;
    try { at = this.now(); } catch (_) { this.stop('clock-unavailable'); return; }
    if (!Number.isFinite(at) || at < this.previousAt) {
      this.stop('clock-invalid');
      return;
    }
    const delay = Math.max(0, at - this.previousAt - 50);
    this.previousAt = at;
    this.samples += 1;
    this.maxDelayMs = Math.max(this.maxDelayMs, delay);
    if (delay > 50) this.delayedOver50Ms += 1;
    if (at - this.startedAt >= 120000) {
      this.stop('duration-limit');
    } else if (at - this.emittedAt >= 1000) {
      this.emit(at, 'window');
    }
  }

  private emit(at: number, reason: string): void {
    this.record({ elapsedMs: at - this.startedAt, uptimeMs: at,
      samples: this.samples, maxDelayMs: this.maxDelayMs,
      delayedOver50Ms: this.delayedOver50Ms, reason: reason });
    this.emittedAt = at;
    this.samples = 0;
    this.maxDelayMs = 0;
    this.delayedOver50Ms = 0;
  }
}
