export function motionSegment(timeMs: number, startMs: number, durationMs: number,
  curve: (fraction: number) => number): number {
  if (timeMs <= startMs) return 0;
  if (durationMs <= 0 || timeMs >= startMs + durationMs) return 1;
  return curve((timeMs - startMs) / durationMs);
}

/** Authored tracks share one elapsed time; reversing changes the time, not the curve. */
export interface MotionSegmentSpec {
  at: number;
  duration: number;
  curve: (fraction: number) => number;
}

export function sampleMotionSegment(elapsedMs: number, segment: MotionSegmentSpec): number {
  return motionSegment(elapsedMs, segment.at, segment.duration, segment.curve);
}

export function motionTimelineDuration(segments: MotionSegmentSpec[]): number {
  let duration = 0;
  for (const segment of segments) {
    if (Number.isFinite(segment.at) && Number.isFinite(segment.duration)) {
      duration = Math.max(duration, segment.at + Math.max(0, segment.duration));
    }
  }
  return duration;
}

/** A reversible authored timeline. Retargeting changes direction at the same
 * visible sample, without resetting component tracks or queuing an old goal. */
export class ReversibleMotionTimeline {
  private positionMs: number = 0;
  private targetMs: number = 0;
  private startedMs: number = 0;
  private readonly durationMs: number;
  constructor(durationMs: number) { this.durationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0; }
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
  /** Seek freezes at the clamped authored position until the next retarget. */
  seek(positionMs: number, nowMs: number): void {
    this.positionMs = Number.isFinite(positionMs) ? Math.max(0, Math.min(this.durationMs, positionMs)) : 0;
    this.targetMs = this.positionMs;
    this.startedMs = nowMs;
  }
  running(nowMs: number): boolean { return this.sample(nowMs) !== this.targetMs; }
}
