export interface ReaderCapacityCounters {
  retainedRequestCount: number;
  queuedCommandCount: number;
  queuedInputBytes: number;
  inputReservedBytes: number;
  resultReservedBytes: number;
  hostReservedBytes: number;
  pendingDeliveryCount: number;
  hostOperationCount: number;
}

export interface ReaderCapacityObservation {
  current: ReaderCapacityCounters;
  peak: ReaderCapacityCounters;
}

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
  operationId?: number;
  capacity?: ReaderCapacityObservation;
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
  private operationSequence: number = 0;
  private readonly ttsEnabled: boolean;

  private constructor(now: () => number, record: (sample: ReaderStartupSample) => void, enabled: boolean,
    ttsEnabled: boolean) {
    this.now = now;
    this.record = record;
    this.enabled = enabled;
    this.ttsEnabled = enabled && ttsEnabled;
    this.createdAt = enabled ? this.sampleTime() : -1;
    this.processId = `reader-${this.createdAt}`;
  }

  static install(now: () => number, record: (sample: ReaderStartupSample) => void,
    enabled: boolean = true, ttsEnabled: boolean = false): ReaderStartupTrace {
    if (ReaderStartupTrace.instance === undefined) ReaderStartupTrace.instance = new ReaderStartupTrace(now, record, enabled, ttsEnabled);
    return ReaderStartupTrace.instance;
  }

  static current(): ReaderStartupTrace | undefined {
    const trace = ReaderStartupTrace.instance;
    return trace?.enabled === true ? trace : undefined;
  }

  /** Explicit cold-debug opt-in; normal debug and release do no TTS sampling. */
  static currentTts(): ReaderStartupTrace | undefined {
    const trace = ReaderStartupTrace.current();
    return trace?.ttsEnabled === true ? trace : undefined;
  }

  beginTtsOperation(): number {
    if (!this.ttsEnabled) return 0;
    this.operationSequence += 1;
    this.markTts('tts.intent', this.operationSequence);
    return this.operationSequence;
  }

  markTts(stage: string, operationId: number, status: string = 'event'): void {
    if (!this.ttsEnabled || !Number.isSafeInteger(operationId) || operationId <= 0) return;
    this.emit(stage, status, this.currentEntryId(), undefined, this.sampleTime(), operationId);
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

  /** Same process uptime clock and collector, used only by explicit debug probe. */
  monotonicNowMs(): number { return this.sampleTime(); }

  observeCapacity(status: string, capacity?: ReaderCapacityObservation, at?: number): void {
    if (!this.enabled) return;
    this.emit('runtime.capacity', status, 0, undefined, at === undefined ? this.sampleTime() : at, undefined, capacity);
  }

  private sampleTime(): number {
    try {
      const at = this.now();
      return Number.isFinite(at) && at >= 0 ? at : -1;
    } catch (_) { return -1; }
  }

  private emit(stage: string, status: string, entryId: number, durationMs: number | undefined,
    at: number = this.sampleTime(), operationId?: number, capacity?: ReaderCapacityObservation): void {
    if (at < 0 || this.createdAt < 0 || at < this.createdAt) return;
    this.sequence += 1;
    const sample: ReaderStartupSample = { processId: this.processId, sequence: this.sequence, uptimeMs: at,
      sinceCreateMs: at - this.createdAt, stage, status, entryId, evidence: 'application-code' };
    if (durationMs !== undefined) sample.durationMs = durationMs;
    if (operationId !== undefined) sample.operationId = operationId;
    if (capacity !== undefined) sample.capacity = capacity;
    // Diagnostic delivery must never alter startup or entry admission.
    try { this.record(sample); } catch (_) {}
  }
}

export type ReaderShelfEntryPhase = 'tap' | 'reader-mount-request' | 'present';
type ReaderShelfEntryLog = (phase: ReaderShelfEntryPhase, attempt: number, navigation: number, elapsedMs: number) => void;

/** Correlates entry milestones within one mounted application root. */
export class ReaderEntryStartupTrace {
  private entryId: number = 0;
  private shelfAttempt: number = 0;
  private shelfStartedAt: number = -1;
  private readonly logShelfPhase: ReaderShelfEntryLog;

  constructor(logShelfPhase: ReaderShelfEntryLog) {
    this.logShelfPhase = logShelfPhase;
  }

  begin(): void {
    this.shelfStartedAt = -1;
    this.entryId = ReaderStartupTrace.current()?.beginEntry() ?? 0;
  }

  beginShelf(navigation: number): void {
    this.begin();
    this.shelfAttempt += 1;
    this.shelfStartedAt = Date.now();
    this.shelfPhase('tap', navigation);
  }

  shelfPhase(phase: ReaderShelfEntryPhase, navigation: number): void {
    if (this.shelfStartedAt < 0) return;
    try {
      ReaderStartupTrace.current()?.mark(`shelf-entry.${phase}`, 'event', this.entryId);
      this.logShelfPhase(phase, this.shelfAttempt, navigation, Math.max(0, Date.now() - this.shelfStartedAt));
    } catch (_) { /* Diagnostic delivery cannot interrupt reader admission. */ }
  }

  ready(shelfNavigation?: number): void {
    if (shelfNavigation !== undefined) this.shelfPhase('present', shelfNavigation);
    const entryId = this.entryId;
    this.retire();
    if (entryId > 0) ReaderStartupTrace.current()?.mark('reader.model-ready', 'ready', entryId);
  }

  retire(): void {
    this.entryId = 0;
    this.shelfStartedAt = -1;
  }
}
