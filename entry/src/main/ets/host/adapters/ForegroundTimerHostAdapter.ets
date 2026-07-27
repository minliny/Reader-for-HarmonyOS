import { HostForegroundTimerRequest } from '../types';

export type ForegroundTimerFiredCallback =
  (timerId: string, correlationId: string, generation: number) => void;

class ForegroundTimerEntry {
  readonly request: HostForegroundTimerRequest;
  readonly timeoutId: number;

  constructor(request: HostForegroundTimerRequest, timeoutId: number) {
    this.request = request;
    this.timeoutId = timeoutId;
  }
}

/**
 * UI-contract foreground timer. Every arm is a single setTimeout and is keyed
 * by both correlation and generation; repeating intervals and background task
 * APIs are intentionally absent.
 */
export class ForegroundTimerHostAdapter {
  private entries: Map<string, ForegroundTimerEntry> = new Map<string, ForegroundTimerEntry>();

  arm(request: HostForegroundTimerRequest, callback: ForegroundTimerFiredCallback): boolean {
    if (!this.valid(request)) return false;
    this.cancelById(request.timerId);
    let timeoutId: number = 0;
    timeoutId = setTimeout((): void => {
      const current = this.entries.get(request.timerId);
      if (current === undefined || current.timeoutId !== timeoutId ||
        current.request.correlationId !== request.correlationId ||
        current.request.generation !== request.generation) return;
      this.entries.delete(request.timerId);
      callback(request.timerId, request.correlationId, request.generation);
    }, request.delayMs);
    this.entries.set(request.timerId, new ForegroundTimerEntry(request, timeoutId));
    return true;
  }

  cancel(request: HostForegroundTimerRequest): boolean {
    const entry = this.entries.get(request.timerId);
    if (entry === undefined || entry.request.correlationId !== request.correlationId ||
      entry.request.generation !== request.generation) return false;
    clearTimeout(entry.timeoutId);
    this.entries.delete(request.timerId);
    return true;
  }

  cancelAll(): void {
    const entries = Array.from(this.entries.values());
    for (let index = 0; index < entries.length; index += 1) {
      clearTimeout(entries[index].timeoutId);
    }
    this.entries.clear();
  }

  activeCount(): number {
    return this.entries.size;
  }

  private cancelById(timerId: string): void {
    const entry = this.entries.get(timerId);
    if (entry === undefined) return;
    clearTimeout(entry.timeoutId);
    this.entries.delete(timerId);
  }

  private valid(request: HostForegroundTimerRequest): boolean {
    return request.timerId.length > 0 && request.correlationId.length > 0 &&
      request.timerId === request.correlationId && Number.isInteger(request.delayMs) &&
      request.delayMs >= 250 && request.delayMs <= 3600000 &&
      Number.isInteger(request.generation) && request.generation >= 0 &&
      request.oneShot && request.foregroundOnly;
  }
}
