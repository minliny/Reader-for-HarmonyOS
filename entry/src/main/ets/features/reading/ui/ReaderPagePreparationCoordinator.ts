import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export type ReaderPagePreparationAttempt = 'begun' | 'retry' | 'abandon' | 'wait';

export interface ReaderPagePreparationPort {
  renderWorkBlocked: () => boolean;
  laneBlocked: () => boolean;
  ready: (direction: ReaderPageTurnDirection) => boolean;
  prepare: (direction: ReaderPageTurnDirection) => ReaderPagePreparationAttempt;
  idle: () => void;
  captureCurrent: () => (() => boolean);
}

const RETRY_BASE_MS = 250;
const RETRY_MAX_MS = 2000;
const RETRY_LIMIT = 16;

/** Orders speculative page preparation. The view supplies measurement and
 * texture work, and owns the selection and generation of every real page. */
export class ReaderPagePreparationQueue {
  private directions: ReaderPageTurnDirection[] = [];
  private retryTimer: number = -1;
  private retryCount: number = 0;
  private readonly schedule: (run: () => void, delayMs: number) => number;
  private readonly cancel: (timer: number) => void;

  constructor(schedule: (run: () => void, delayMs: number) => number = setTimeout,
    cancel: (timer: number) => void = clearTimeout) {
    this.schedule = schedule;
    this.cancel = cancel;
  }

  reset(first?: ReaderPageTurnDirection): void {
    this.directions = first === undefined ? [] : [first, first === 'next' ? 'previous' : 'next'];
  }

  contains(direction: ReaderPageTurnDirection): boolean {
    return this.directions.indexOf(direction) >= 0;
  }

  hasQueued(): boolean {
    return this.directions.length > 0;
  }

  append(direction: ReaderPageTurnDirection): void {
    this.directions.push(direction);
  }

  restoreFront(direction: ReaderPageTurnDirection): void {
    if (!this.contains(direction)) this.directions.unshift(direction);
  }

  prioritize(direction: ReaderPageTurnDirection): void {
    this.remove(direction);
    this.directions.unshift(direction);
  }

  promoteQueued(direction: ReaderPageTurnDirection): void {
    if (this.directions.indexOf(direction) > 0) this.prioritize(direction);
  }

  remove(direction: ReaderPageTurnDirection): void {
    this.directions = this.directions.filter((entry: ReaderPageTurnDirection): boolean => entry !== direction);
  }

  drain(port: ReaderPagePreparationPort): void {
    if (port.renderWorkBlocked()) return;
    for (;;) {
      if (port.laneBlocked()) return;
      const direction = this.directions.shift();
      if (direction === undefined) { port.idle(); return; }
      if (port.ready(direction)) continue;
      const outcome = port.prepare(direction);
      if (outcome === 'wait') return;
      if (outcome === 'abandon') continue;
      if (outcome === 'begun') { this.cancelRetry(); return; }
      this.retry(direction, port);
      return;
    }
  }

  private retry(direction: ReaderPageTurnDirection, port: ReaderPagePreparationPort): void {
    // Cold entry can pop a direction while initial restore still owns the
    // measurement lane. Retain the original request through bounded backoff.
    this.directions.unshift(direction);
    if (this.retryTimer >= 0) return;
    const count = this.retryCount;
    if (count >= RETRY_LIMIT) {
      this.reset();
      this.retryCount = 0;
      return;
    }
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, count));
    this.retryCount = count + 1;
    const isCurrent = port.captureCurrent();
    this.retryTimer = this.schedule((): void => {
      this.retryTimer = -1;
      if (!isCurrent()) {
        this.reset();
        this.retryCount = 0;
        return;
      }
      this.drain(port);
    }, delay);
  }

  cancelRetry(): void {
    if (this.retryTimer < 0) return;
    this.cancel(this.retryTimer);
    this.retryTimer = -1;
    this.retryCount = 0;
  }
}
