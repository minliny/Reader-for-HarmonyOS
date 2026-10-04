import type { JsonObject } from '@reader/core-harmony';
import { ReaderStartupTrace, type ReaderCapacityCounters, type ReaderCapacityObservation } from './ReaderStartupTrace.ts';

export function readerCapacityProbeEnabled(debug: boolean, mode: string, requested: Object | undefined): boolean {
  return debug === true && mode === 'debug' && requested === true;
}

export interface ReaderCapacityQueryOptions {
  timeoutMs: number;
  canDispatch: () => boolean;
  shouldCancel: () => boolean;
}

type CapacityRequest = (method: string, params: JsonObject, options: ReaderCapacityQueryOptions) => Promise<JsonObject>;

/** Explicit cold-debug observation of the SAME production runtime owner.
 * At most ten sequential opt-in queries over thirty seconds. Each wire query
 * has its normal admission/delivery/ACK cost; these are reservations, not RSS.
 * This probe never starts work, owns a business task or exposes a general RPC. */
export class ReaderCapacityProbe {
  private closed: boolean = false;
  private started: boolean = false;
  private samples: number = 0;
  private startedAt: number = -1;
  private lastAt: number = -1;
  private nextTimer: number = -1;
  private deadlineTimer: number = -1;

  private readonly trace: ReaderStartupTrace;
  private readonly request: CapacityRequest;
  private readonly current: () => boolean;

  private constructor(trace: ReaderStartupTrace, request: CapacityRequest, current: () => boolean) {
    this.trace = trace; this.request = request; this.current = current;
  }

  static create(debug: boolean, mode: string, requested: Object | undefined,
    request: CapacityRequest, current: () => boolean): ReaderCapacityProbe | undefined {
    if (!readerCapacityProbeEnabled(debug, mode, requested)) return undefined;
    const trace = ReaderStartupTrace.current();
    return trace === undefined ? undefined : new ReaderCapacityProbe(trace, request, current);
  }

  start(): void {
    if (this.closed || this.started) return;
    this.started = true;
    const at = this.time();
    if (at < 0 || !this.isCurrent()) { this.stop(); return; }
    this.startedAt = at;
    this.deadlineTimer = setTimeout((): void => this.stop(), 30000);
    void this.sample();
  }

  /** Permanent for this cold invocation: late ready/foreground cannot restart. */
  stop(): void {
    this.closed = true;
    if (this.nextTimer >= 0) clearTimeout(this.nextTimer);
    if (this.deadlineTimer >= 0) clearTimeout(this.deadlineTimer);
    this.nextTimer = -1;
    this.deadlineTimer = -1;
  }

  private isCurrent(): boolean {
    if (this.closed) return false;
    try { return this.current(); } catch (_) { return false; }
  }

  private time(): number {
    const at = this.trace.monotonicNowMs();
    if (at < 0 || at < this.lastAt) return -1;
    this.lastAt = at;
    return at;
  }

  private async sample(): Promise<void> {
    this.nextTimer = -1;
    const at = this.time();
    if (!this.isCurrent() || at < 0 || at - this.startedAt >= 30000 || this.samples >= 10) {
      this.stop(); return;
    }
    this.samples += 1;
    try {
      const data = await this.request('runtime.status', { includeCapacity: true }, {
        timeoutMs: 2000, canDispatch: (): boolean => this.isCurrent(),
        shouldCancel: (): boolean => !this.isCurrent(),
      });
      const receivedAt = this.time();
      if (!this.isCurrent() || receivedAt < 0 || receivedAt - this.startedAt >= 30000) { this.stop(); return; }
      const rawCapacity = data['capacity'];
      const capacity = this.decode(rawCapacity as Object | undefined);
      // Missing/malformed capability is unknown, never a zero budget sample.
      this.trace.observeCapacity(capacity === undefined ?
        (rawCapacity === undefined ? 'unobserved.capacity' : 'malformed.capacity') : 'observed', capacity, receivedAt);
      if (capacity === undefined) { this.stop(); return; }
    } catch (_) {
      const failedAt = this.time();
      if (this.isCurrent() && failedAt >= 0 && failedAt - this.startedAt < 30000)
        this.trace.observeCapacity('failed.query', undefined, failedAt);
      this.stop(); return;
    }
    if (this.samples >= 10 || !this.isCurrent()) { this.stop(); return; }
    this.nextTimer = setTimeout((): void => { void this.sample(); }, 3000);
  }

  private decode(value: Object | undefined): ReaderCapacityObservation | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const raw = value as Record<string, Object>;
    const current = this.counters(raw['current']), peak = this.counters(raw['peak']);
    if (current === undefined || peak === undefined) return undefined;
    if (peak.retainedRequestCount < current.retainedRequestCount || peak.queuedCommandCount < current.queuedCommandCount ||
      peak.queuedInputBytes < current.queuedInputBytes || peak.inputReservedBytes < current.inputReservedBytes ||
      peak.resultReservedBytes < current.resultReservedBytes || peak.hostReservedBytes < current.hostReservedBytes ||
      peak.pendingDeliveryCount < current.pendingDeliveryCount || peak.hostOperationCount < current.hostOperationCount) return undefined;
    return { current, peak };
  }

  private counters(value: Object | undefined): ReaderCapacityCounters | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const raw = value as Record<string, number>;
    const fields = ['retainedRequestCount', 'queuedCommandCount', 'queuedInputBytes', 'inputReservedBytes',
      'resultReservedBytes', 'hostReservedBytes', 'pendingDeliveryCount', 'hostOperationCount'];
    for (const field of fields) if (!Number.isSafeInteger(raw[field]) || raw[field] < 0) return undefined;
    // Explicit whitelist drops all unknown fields, including private payloads.
    return { retainedRequestCount: raw['retainedRequestCount'], queuedCommandCount: raw['queuedCommandCount'],
      queuedInputBytes: raw['queuedInputBytes'], inputReservedBytes: raw['inputReservedBytes'],
      resultReservedBytes: raw['resultReservedBytes'], hostReservedBytes: raw['hostReservedBytes'],
      pendingDeliveryCount: raw['pendingDeliveryCount'], hostOperationCount: raw['hostOperationCount'] };
  }
}
