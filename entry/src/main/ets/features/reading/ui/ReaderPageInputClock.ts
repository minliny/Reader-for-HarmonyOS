/** Maps missing, reset and stalled native timestamps into one gesture clock. */
export class ReaderPageInputClock {
  private initialized: boolean = false;
  private lastNativeMs: number = -1;
  private lastReceivedMs: number = 0;
  private nativeReceivedMs: number = 0;
  private timeMs: number = 0;
  private nativeOffsetMs: number = 0;
  private rebase: boolean = false;
  resetVelocity: boolean = false;

  sample(timestampNs: number, receivedMs: number): number {
    const valid = Number.isFinite(timestampNs) && timestampNs >= 0;
    const nativeMs = valid ? timestampNs / 1_000_000 : -1;
    const received = !Number.isFinite(receivedMs) ? this.lastReceivedMs :
      this.initialized ? Math.max(receivedMs, this.lastReceivedMs) : receivedMs;
    const receiveDelta = received - this.lastReceivedMs;
    const repeated = valid && nativeMs === this.lastNativeMs;
    const repeatAge = received - this.nativeReceivedMs;
    // Coalesced samples within a frame can legitimately share a timestamp.
    const stalled = repeated && (this.rebase || repeatAge >= 16 || (nativeMs === 0 && receiveDelta > 0));
    this.resetVelocity = !valid;
    if (!this.initialized) {
      this.initialized = true;
      this.timeMs = valid ? nativeMs : received;
      this.rebase = !valid;
    } else if (!valid || (this.lastNativeMs >= 0 && nativeMs < this.lastNativeMs) || stalled) {
      this.timeMs += stalled && !this.rebase ? repeatAge : receiveDelta;
      this.rebase = true;
      this.resetVelocity = true;
    } else if (this.rebase) {
      this.timeMs += receiveDelta;
      this.nativeOffsetMs = this.timeMs - nativeMs;
      this.rebase = false;
      this.resetVelocity = true;
    } else {
      this.timeMs = Math.max(this.timeMs, nativeMs + this.nativeOffsetMs);
    }
    if (valid && !repeated) {
      this.lastNativeMs = nativeMs;
      this.nativeReceivedMs = received;
    }
    this.lastReceivedMs = received;
    return this.timeMs;
  }
}
