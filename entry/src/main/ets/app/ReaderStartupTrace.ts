/** Code milestones only. Neither a ready model nor loadContent's callback
 * proves that a frame reached the display. Native/visual evidence stays separate. */
export interface ReaderStartupSample {
  processId: string;
  sequence: number;
  uptimeMs: number;
  sinceCreateMs: number;
  stage: string;
  status: string;
  entryId: number;
  evidence: string;
  durationMs?: number;
}

/** Small process-local log adapter; uses the existing platform uptime clock.
 * No timers, disk reads, retained samples, book titles or source URLs. */
export class ReaderStartupTrace {
  private static instance: ReaderStartupTrace | undefined = undefined;
  private readonly now: () => number;
  private readonly record: (sample: ReaderStartupSample) => void;
  private readonly enabled: boolean;
  private readonly createdAt: number;
  private readonly processId: string;
  private sequence: number = 0;
  private entrySequence: number = 0;

  private constructor(now: () => number, record: (sample: ReaderStartupSample) => void, enabled: boolean) {
    this.now = now;
    this.record = record;
    this.enabled = enabled;
    this.createdAt = enabled ? this.sampleTime() : -1;
    this.processId = `reader-${this.createdAt}`;
  }

  static install(now: () => number, record: (sample: ReaderStartupSample) => void,
    enabled: boolean = true): ReaderStartupTrace {
    if (ReaderStartupTrace.instance === undefined) ReaderStartupTrace.instance = new ReaderStartupTrace(now, record, enabled);
    return ReaderStartupTrace.instance;
  }

  static current(): ReaderStartupTrace | undefined {
    const trace = ReaderStartupTrace.instance;
    return trace?.enabled === true ? trace : undefined;
  }

  static measure<T>(stage: string, task: () => Promise<T>): Promise<T> {
    const trace = ReaderStartupTrace.current();
    return trace === undefined ? task() : trace.measure(stage, task);
  }

  beginEntry(): number {
    if (!this.enabled) return 0;
    this.entrySequence += 1;
    this.mark('reader.open', 'event', this.entrySequence);
    return this.entrySequence;
  }

  currentEntryId(): number { return this.entrySequence; }

  mark(stage: string, status: string = 'event', entryId: number = 0): void {
    if (!this.enabled) return;
    this.emit(stage, status, entryId, undefined);
  }

  begin(stage: string, entryId: number = 0): number {
    if (!this.enabled) return -1;
    const startedAt = this.sampleTime();
    this.emit(stage, 'start', entryId, undefined, startedAt);
    return startedAt;
  }

  end(stage: string, startedAt: number, status: string = 'ready', entryId: number = 0): void {
    if (!this.enabled) return;
    const at = this.sampleTime();
    this.emit(stage, status, entryId, startedAt >= 0 && at >= startedAt ? at - startedAt : undefined, at);
  }

  measure<T>(stage: string, task: () => Promise<T>, entryId: number = 0): Promise<T> {
    // Release keeps the original promise and scheduling: no clock sample,
    // log object, serialization, or extra async continuation on its cold path.
    return this.enabled ? this.measureEnabled(stage, task, entryId) : task();
  }

  private async measureEnabled<T>(stage: string, task: () => Promise<T>, entryId: number): Promise<T> {
    const startedAt = this.begin(stage, entryId);
    try {
      const value = await task();
      this.end(stage, startedAt, 'ready', entryId);
      return value;
    } catch (error) {
      this.end(stage, startedAt, 'failed', entryId);
      throw error;
    }
  }

  private sampleTime(): number {
    try {
      const at = this.now();
      return Number.isFinite(at) && at >= 0 ? at : -1;
    } catch (_) { return -1; }
  }

  private emit(stage: string, status: string, entryId: number, durationMs: number | undefined,
    at: number = this.sampleTime()): void {
    if (at < 0 || this.createdAt < 0 || at < this.createdAt) return;
    this.sequence += 1;
    const sample: ReaderStartupSample = { processId: this.processId, sequence: this.sequence, uptimeMs: at,
      sinceCreateMs: at - this.createdAt, stage, status, entryId, evidence: 'application-code' };
    if (durationMs !== undefined) sample.durationMs = durationMs;
    // Diagnostic delivery must never alter startup or entry admission.
    try { this.record(sample); } catch (_) {}
  }
}
