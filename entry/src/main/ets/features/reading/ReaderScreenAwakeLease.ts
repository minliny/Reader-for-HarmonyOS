import type { ReaderScreenTimeout } from './ReaderSettingsState';

export interface ReaderScreenAwakeLeaseScheduler {
  set(delayMs: number, task: () => void): number;
  clear(handle: number): void;
}

class DefaultReaderScreenAwakeLeaseScheduler implements ReaderScreenAwakeLeaseScheduler {
  set(delayMs: number, task: () => void): number {
    return setTimeout(task, delayMs);
  }

  clear(handle: number): void {
    clearTimeout(handle);
  }
}

/**
 * Session-local keep-screen-on lease.
 *
 * Finite choices never mutate the device's global screen timeout. They hold
 * the Reader window awake for the selected interval after each interaction,
 * then release it back to the system policy.
 */
export class ReaderScreenAwakeLease {
  private readonly onKeepScreenOnChanged: (keepScreenOn: boolean) => void;
  private readonly scheduler: ReaderScreenAwakeLeaseScheduler;
  private timeout: ReaderScreenTimeout = 'system';
  private foreground: boolean = true;
  private keepScreenOn: boolean = false;
  private timer: number = -1;
  private generation: number = 0;
  private disposed: boolean = false;

  constructor(
    onKeepScreenOnChanged: (keepScreenOn: boolean) => void,
    scheduler: ReaderScreenAwakeLeaseScheduler = new DefaultReaderScreenAwakeLeaseScheduler(),
  ) {
    this.onKeepScreenOnChanged = onKeepScreenOnChanged;
    this.scheduler = scheduler;
  }

  configure(timeout: ReaderScreenTimeout, foreground: boolean): void {
    if (this.disposed) {
      return;
    }
    this.timeout = timeout;
    this.foreground = foreground;
    this.rearm();
  }

  setForeground(foreground: boolean): void {
    if (this.disposed || this.foreground === foreground) {
      return;
    }
    this.foreground = foreground;
    this.rearm();
  }

  rearm(): void {
    if (this.disposed) {
      return;
    }
    this.invalidateTimer();
    if (!this.foreground || this.timeout === 'system') {
      this.publish(false);
      return;
    }
    this.publish(true);
    const durationMs = readerScreenAwakeLeaseDurationMs(this.timeout);
    if (durationMs <= 0) {
      return;
    }
    const generation = this.generation;
    this.timer = this.scheduler.set(durationMs, (): void => {
      this.timer = -1;
      if (this.disposed || generation !== this.generation || !this.foreground ||
        readerScreenAwakeLeaseDurationMs(this.timeout) <= 0) {
        return;
      }
      this.publish(false);
    });
  }

  currentKeepScreenOn(): boolean {
    return this.keepScreenOn;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.invalidateTimer();
    this.keepScreenOn = false;
    this.disposed = true;
  }

  private invalidateTimer(): void {
    this.generation = this.generation >= Number.MAX_SAFE_INTEGER ? 1 : this.generation + 1;
    if (this.timer >= 0) {
      this.scheduler.clear(this.timer);
      this.timer = -1;
    }
  }

  private publish(keepScreenOn: boolean): void {
    if (this.keepScreenOn === keepScreenOn) {
      return;
    }
    this.keepScreenOn = keepScreenOn;
    this.onKeepScreenOnChanged(keepScreenOn);
  }
}

export function readerScreenAwakeLeaseDurationMs(timeout: ReaderScreenTimeout): number {
  if (timeout === 'oneMinute') {
    return 60 * 1000;
  }
  if (timeout === 'fiveMinutes') {
    return 5 * 60 * 1000;
  }
  if (timeout === 'tenMinutes') {
    return 10 * 60 * 1000;
  }
  return 0;
}
