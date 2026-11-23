/** Maps missing/reset native timestamps into one continuous gesture clock. */
export class ReaderPageInputClock {
  private initialized: boolean = false;
  private lastNativeMs: number = -1;
  private lastReceivedMs: number = 0;
  private timeMs: number = 0;
  private nativeOffsetMs: number = 0;
  private rebase: boolean = false;
  resetVelocity: boolean = false;

  sample(timestampNs: number, receivedMs: number): number {
    const valid = Number.isFinite(timestampNs) && timestampNs >= 0;
    const nativeMs = valid ? timestampNs / 1_000_000 : -1;
    const received = Number.isFinite(receivedMs) ? receivedMs : this.lastReceivedMs;
    this.resetVelocity = !valid;
    if (!this.initialized) {
      this.initialized = true;
      this.timeMs = valid ? nativeMs : received;
      this.rebase = !valid;
    } else if (!valid || (this.lastNativeMs >= 0 && nativeMs < this.lastNativeMs)) {
      this.timeMs += Math.max(0, received - this.lastReceivedMs);
      this.rebase = true;
      this.resetVelocity = true;
    } else if (this.rebase) {
      this.timeMs += Math.max(0, received - this.lastReceivedMs);
      this.nativeOffsetMs = this.timeMs - nativeMs;
      this.rebase = false;
      this.resetVelocity = true;
    } else {
      this.timeMs = Math.max(this.timeMs, nativeMs + this.nativeOffsetMs);
    }
    if (valid) this.lastNativeMs = nativeMs;
    this.lastReceivedMs = received;
    return this.timeMs;
  }
}
