import {
  advanceReaderControlSession, copyReaderControlSessionState, createReaderControlSessionState,
  readerControlSessionStateEquals, type ReaderControlSessionState,
  sampleReaderControlSession,
} from './ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, updateReaderControlGesture,
  readerControlGrabberScreenY,
  type ReaderControlGestureConfig, type ReaderControlGestureResult, type ReaderControlGestureState,
} from './ReaderControlGestureDriver.ts';
import {
  advanceReaderControlLayoutCompensation, createReaderControlLayoutCompensation,
  pauseReaderControlLayoutCompensation, rebaseReaderControlLayout, settleReaderControlLayoutCompensation,
  type ReaderControlLayoutCompensation,
} from './ReaderControlLayoutRebase.ts';
import { readerControlMotionCommandTiming,
  sampleReaderControlMotionContinuation } from './ReaderControlMotionPolicy.ts';

export interface ReaderControlRuntimeUpdate {
  session: ReaderControlSessionState;
  offsetY: number;
  endpoint: ReaderControlSessionState | undefined;
}

/** Production control clock. No UI builders, business data, timers or framework
 * state live here. The owning component renders every actor from one update.
 * A frame ticket is revoked by every command, input and lifecycle boundary.
 */
export class ReaderControlRuntime {
  private session: ReaderControlSessionState = createReaderControlSessionState();
  private semantic: ReaderControlSessionState = createReaderControlSessionState();
  private gesture: ReaderControlGestureState;
  private compensation: ReaderControlLayoutCompensation = createReaderControlLayoutCompensation();
  private config: ReaderControlGestureConfig;
  private active: boolean = false;
  private revision: number = 0;
  private previousTimeMs: number = -1;
  private continuationSlope: number | undefined = undefined;
  private readonly now: (() => number) | undefined;

  constructor(config: ReaderControlGestureConfig, now?: () => number) {
    this.config = config;
    this.now = now;
    this.gesture = createReaderControlGestureState(config);
  }

  start(session: ReaderControlSessionState): ReaderControlRuntimeUpdate {
    this.active = true;
    this.session = copyReaderControlSessionState(this.timedCommand(session));
    this.semantic = copyReaderControlSessionState(session);
    this.gesture = createReaderControlGestureState(this.config);
    this.compensation = createReaderControlLayoutCompensation();
    this.continuationSlope = undefined;
    this.invalidate();
    return this.snapshot();
  }

  stop(): void { this.active = false; this.invalidate(); }

  setEnabled(enabled: boolean): ReaderControlRuntimeUpdate {
    if (this.active === enabled) return this.snapshot();
    const previous = this.session;
    if (!enabled && this.gesture.pointerId >= 0) {
      const result = cancelReaderControlGesture(this.session, this.gesture, this.gesture.pointerId);
      this.session = result.session;
      this.gesture = result.gesture;
    }
    this.active = enabled;
    this.invalidate();
    return this.snapshot(previous);
  }

  /** Re-delivery of an unchanged host command must not rewind local progress. */
  command(next: ReaderControlSessionState): ReaderControlRuntimeUpdate {
    if (readerControlSessionStateEquals(next, this.semantic)) return this.snapshot();
    this.semantic = copyReaderControlSessionState(next);
    this.session = copyReaderControlSessionState(this.timedCommand(next));
    this.continuationSlope = undefined;
    this.gesture = createReaderControlGestureState(this.config);
    this.compensation = settleReaderControlLayoutCompensation(this.compensation,
      this.session, this.config.settleDurationMs);
    this.invalidate();
    return this.snapshot();
  }

  configure(config: ReaderControlGestureConfig): ReaderControlRuntimeUpdate {
    const previous = this.session;
    const rebased = rebaseReaderControlLayout(this.session, this.gesture, this.compensation, config.axis);
    this.config = config;
    if (!rebased.accepted) return this.snapshot();
    this.session = rebased.session;
    this.gesture = rebased.gesture;
    this.compensation = rebased.compensation;
    if (config.settleDurationMs === 0 && this.session.heldPointerId < 0) {
      this.session = advanceReaderControlSession(this.session, Number.MAX_SAFE_INTEGER, this.session.epoch, (p: number): number => p);
      this.compensation = createReaderControlLayoutCompensation();
      this.invalidate();
      return this.snapshot(previous);
    }
    if (rebased.reason !== 'unchanged') this.invalidate();
    return this.snapshot();
  }

  ticket(): number { return this.revision; }
  owner(): number { return this.gesture.pointerId; }
  lastPointerY(): number { return this.gesture.lastPointerScreenY; }
  resetInputVelocity(id: number, timeMs: number): void {
    if (id !== this.gesture.pointerId || !Number.isFinite(timeMs)) return;
    this.gesture.velocityYVpPerSecond = 0;
    this.gesture.velocitySampleIntervalMs = 0;
    this.gesture.lastTimeMs = timeMs;
  }
  needsFrame(): boolean {
    return this.active && this.session.heldPointerId < 0 &&
      (this.session.transition !== undefined || this.compensation.running);
  }

  frame(timeMs: number, ticket: number,
    curve: (fraction: number) => number): ReaderControlRuntimeUpdate | undefined {
    if (ticket !== this.revision || !this.needsFrame() || !Number.isFinite(timeMs)) return undefined;
    const elapsed = this.previousTimeMs < 0 ? 0 : Math.max(0, timeMs - this.previousTimeMs);
    this.previousTimeMs = timeMs;
    const previous = this.session;
    const slope = this.continuationSlope;
    const clock = slope === undefined ? curve : (t: number): number => sampleReaderControlMotionContinuation(t, slope);
    this.compensation = advanceReaderControlLayoutCompensation(this.compensation, previous,
      elapsed, this.compensation.revision, clock);
    this.session = advanceReaderControlSession(previous, elapsed, previous.epoch, clock);
    return this.snapshot(previous);
  }

  down(id: number, y: number, timeMs: number): ReaderControlRuntimeUpdate {
    if (!this.active || this.gesture.pointerId >= 0) return this.snapshot();
    this.gesture = createReaderControlGestureState(this.config);
    return this.accept(beginReaderControlGesture(this.session, this.gesture, id, y, timeMs));
  }

  move(id: number, y: number, timeMs: number): ReaderControlRuntimeUpdate {
    if (!this.active) return this.snapshot();
    return this.accept(updateReaderControlGesture(this.session, this.gesture, id, y, timeMs));
  }

  up(id: number, y: number, timeMs: number): ReaderControlRuntimeUpdate {
    if (!this.active || id !== this.gesture.pointerId) return this.snapshot();
    if (y !== this.gesture.lastPointerScreenY) this.move(id, y, timeMs);
    return this.accept(endReaderControlGesture(this.session, this.gesture, id, timeMs));
  }

  cancel(): ReaderControlRuntimeUpdate {
    if (this.gesture.pointerId < 0) return this.snapshot();
    return this.accept(cancelReaderControlGesture(this.session, this.gesture, this.gesture.pointerId), false);
  }

  private accept(result: ReaderControlGestureResult, released: boolean = true): ReaderControlRuntimeUpdate {
    if (!result.consumed) return this.snapshot();
    const previous = this.session;
    if (result.finishedTouch) {
      const transition = result.session.transition;
      if (released && result.gesture.moved && transition !== undefined && this.config.coordinatedMotion) {
        const from = readerControlGrabberScreenY(sampleReaderControlSession(result.session), this.config.axis);
        const to = readerControlGrabberScreenY(transition.targetProgress === 0 ? transition.from : transition.to, this.config.axis);
        this.continuationSlope = Math.abs(to - from) > Number.EPSILON ?
          Math.max(0, Math.min(3, result.gesture.velocityYVpPerSecond * transition.durationMs / (1000 * (to - from)))) : 0;
      } else if (result.session.epoch !== previous.epoch ||
        transition?.targetProgress !== previous.transition?.targetProgress) this.continuationSlope = undefined;
    }
    this.session = result.session;
    this.gesture = result.gesture;
    if (this.session.heldPointerId >= 0) {
      this.compensation = pauseReaderControlLayoutCompensation(this.compensation);
    } else {
      this.compensation = settleReaderControlLayoutCompensation(this.compensation,
        this.session, this.config.settleDurationMs);
    }
    this.invalidate();
    return this.snapshot(previous);
  }

  private invalidate(): void {
    this.revision += 1;
    // Production injects a monotonic clock; pure replays may use explicit frame time.
    this.previousTimeMs = this.now === undefined ? -1 : this.now();
  }

  private timedCommand(state: ReaderControlSessionState): ReaderControlSessionState {
    return this.config.coordinatedMotion && this.config.settleDurationMs > 0 ? readerControlMotionCommandTiming(state) : state;
  }

  private snapshot(previous?: ReaderControlSessionState): ReaderControlRuntimeUpdate {
    const settled = previous !== undefined && this.session.transition === undefined &&
      this.session.heldPointerId < 0 && (previous.transition !== undefined ||
        previous.location.level !== this.session.location.level ||
        previous.location.module !== this.session.location.module ||
        previous.location.form !== this.session.location.form ||
        previous.closeRevision !== this.session.closeRevision);
    const endpoint = settled ? copyReaderControlSessionState(this.session) : undefined;
    if (endpoint !== undefined) this.semantic = copyReaderControlSessionState(endpoint);
    return { session: copyReaderControlSessionState(this.session), offsetY: this.compensation.offsetY,
      endpoint: endpoint };
  }
}
