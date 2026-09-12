/** Presentation-only clock. The last published position remains available
 * for a new pointer; no implicit animation target is mistaken for a frame. */
export class ReaderPageSettlementTimeline {
  readonly from: number;
  readonly target: number;
  readonly startedAtMs: number;
  readonly durationMs: number;
  constructor(from: number, target: number, width: number, velocity: number, nowMs: number, rapid: boolean = false) {
    this.from = from; this.target = target; this.startedAtMs = nowMs;
    const distance = Math.abs(target - from);
    const directionalSpeed = (target - from) * velocity > 0 && Number.isFinite(velocity) ? Math.abs(velocity) : 0;
    // Completed taps already have a net destination. A backlog needs only a
    // short visual cue; the physical release keeps its 80..320 ms velocity
    // continuation. Persistence and presentation gates are unchanged.
    this.durationMs = distance < .01 ? 0 : rapid ? 30 :
      Math.max(80, Math.min(320, distance / Math.max(Math.max(1, width) * 2.5, directionalSpeed) * 1000));
  }
  finished(nowMs: number): boolean { return nowMs - this.startedAtMs >= this.durationMs; }
  position(nowMs: number): number {
    const ratio = this.durationMs <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - this.startedAtMs) / this.durationMs));
    const remaining = 1 - ratio;
    return this.from + (this.target - this.from) * (1 - remaining * remaining * remaining);
  }
}
