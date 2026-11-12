import { motionSegment } from './MotionTimeline.ts';
export interface MotionPoint { x: number; y: number; }
/** A small presentation track: callers capture the current sample before retargeting. */
export class MotionPointTrack {
  private from: MotionPoint;
  private to: MotionPoint;
  private startedMs: number;
  private durationMs: number;
  constructor(from: MotionPoint, to: MotionPoint, startedMs: number, durationMs: number) {
    this.from = { x: from.x, y: from.y };
    this.to = { x: to.x, y: to.y };
    this.startedMs = startedMs;
    this.durationMs = durationMs;
  }
  sample(now: number, curve: (p: number) => number): MotionPoint {
    const p = this.durationMs <= 0 ? 1 : motionSegment(now, this.startedMs, this.durationMs, curve);
    return { x: this.from.x + (this.to.x - this.from.x) * p,
      y: this.from.y + (this.to.y - this.from.y) * p };
  }
  running(now: number): boolean { return now < this.startedMs + this.durationMs; }
}
