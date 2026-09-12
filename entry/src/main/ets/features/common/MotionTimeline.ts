export function motionSegment(timeMs: number, startMs: number, durationMs: number,
  curve: (fraction: number) => number): number {
  if (timeMs <= startMs) return 0;
  if (durationMs <= 0 || timeMs >= startMs + durationMs) return 1;
  return curve((timeMs - startMs) / durationMs);
}

/** A reversible authored timeline. Retargeting changes direction at the same
 * visible sample, without resetting component tracks or queuing an old goal. */
export class ReversibleMotionTimeline {
  private positionMs: number = 0;
  private targetMs: number = 0;
  private startedMs: number = 0;
  private readonly durationMs: number;
  constructor(durationMs: number) { this.durationMs = durationMs; }
  sample(nowMs: number): number {
    const distance = this.targetMs - this.positionMs;
    const travel = Math.min(Math.abs(distance), Math.max(0, nowMs - this.startedMs));
    return this.positionMs + Math.sign(distance) * travel;
  }
  retarget(end: boolean, nowMs: number): void {
    this.positionMs = this.sample(nowMs);
    this.startedMs = nowMs;
    this.targetMs = end ? this.durationMs : 0;
  }
  running(nowMs: number): boolean { return this.sample(nowMs) !== this.targetMs; }
}
