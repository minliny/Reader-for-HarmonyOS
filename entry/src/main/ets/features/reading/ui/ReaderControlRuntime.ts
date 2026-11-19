import {
  advanceReaderControlSession, copyReaderControlSessionState, createReaderControlSessionState,
  readerControlSessionStateEquals, type ReaderControlSessionState, type ReaderControlTransition,
  type ReaderControlTransitionKind, type ReaderControlVisualFrame,
  sampleReaderControlSession,
} from './ReaderControlSessionState.ts';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, updateReaderControlGesture,
  readerControlGrabberScreenY,
  type ReaderControlGestureConfig, type ReaderControlGestureResult, type ReaderControlGestureState,
  type ReaderControlMeasuredAxis,
} from './ReaderControlGestureDriver.ts';
import {
  advanceReaderControlLayoutCompensation, createReaderControlLayoutCompensation,
  pauseReaderControlLayoutCompensation, rebaseReaderControlLayout, settleReaderControlLayoutCompensation,
  type ReaderControlLayoutCompensation, type ReaderControlLayoutRebaseReason,
} from './ReaderControlLayoutRebase.ts';
import { readerControlMotionCommandTiming,
  sampleReaderControlMotionContinuation } from './ReaderControlMotionPolicy.ts';

export interface ReaderControlRuntimeUpdate {
  session: ReaderControlSessionState;
  offsetY: number;
  endpoint: ReaderControlSessionState | undefined;
  layoutRebase?: ReaderControlRuntimeRebase;
}

interface ReaderControlRuntimeRebaseSample {
  axis: ReaderControlMeasuredAxis;
  transition: ReaderControlRuntimeRebaseTransition;
  compensation: ReaderControlLayoutCompensation;
  compensatedGrabberScreenY: number;
}

interface ReaderControlRuntimeRebaseTransition {
  kind: ReaderControlTransitionKind;
  progress: number;
  startProgress: number;
  targetProgress: number;
  elapsedMs: number;
  durationMs: number;
  from: ReaderControlVisualFrame;
  to: ReaderControlVisualFrame;
}

export interface ReaderControlRuntimeRebase {
  epoch: number;
  fromTicket: number;
  toTicket: number;
  beforeTickMs: number;
  ticketStartTickMs: number;
  rebaseReason: ReaderControlLayoutRebaseReason;
  anchorPreserved: boolean;
  before: ReaderControlRuntimeRebaseSample;
  after: ReaderControlRuntimeRebaseSample;
}

function rebaseSample(state: ReaderControlSessionState, transition: ReaderControlTransition,
  axis: ReaderControlMeasuredAxis, compensation: ReaderControlLayoutCompensation): ReaderControlRuntimeRebaseSample {
  return {
    axis: { ...axis },
    transition: {
      kind: transition.kind, progress: transition.progress, startProgress: transition.startProgress,
      targetProgress: transition.targetProgress, elapsedMs: transition.elapsedMs, durationMs: transition.durationMs,
      from: { ...transition.from }, to: { ...transition.to },
    },
    compensation: { ...compensation },
    compensatedGrabberScreenY: readerControlGrabberScreenY(sampleReaderControlSession(state), axis) + compensation.offsetY,
  };
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

  configure(config: ReaderControlGestureConfig, observeLayoutRebase: boolean = false): ReaderControlRuntimeUpdate {
    const previous = this.session;
    const previousAxis = this.gesture.config.axis;
    const previousCompensation = this.compensation;
    const fromTicket = this.revision;
    const beforeTickMs = this.previousTimeMs;
    const rebased = rebaseReaderControlLayout(this.session, this.gesture, this.compensation, config.axis);
    this.config = config;
    if (!rebased.accepted) return this.snapshot();
    this.session = rebased.session;
    this.gesture = rebased.gesture;
    // A held pointer keeps its captured physical context. Any new release
    // transition uses the current motion policy rather than the DOWN clock.
    this.gesture.config = { ...this.gesture.config, settleDurationMs: config.settleDurationMs,
      showDurationMs: config.showDurationMs, dismissDurationMs: config.dismissDurationMs,
      coordinatedMotion: config.coordinatedMotion };
    this.compensation = rebased.compensation;
    if (config.settleDurationMs === 0 && this.session.heldPointerId < 0) {
      this.session = advanceReaderControlSession(this.session, Number.MAX_SAFE_INTEGER, this.session.epoch, (p: number): number => p);
      this.compensation = createReaderControlLayoutCompensation();
      this.invalidate();
      return this.snapshot(previous);
    }
    if (rebased.reason !== 'unchanged') this.invalidate();
    const update = this.snapshot();
    const before = previous.transition;
    const after = this.session.transition;
    if (observeLayoutRebase && this.active && this.now !== undefined && this.revision !== fromTicket &&
      this.continuationSlope === undefined && this.session.epoch === previous.epoch &&
      previous.heldPointerId < 0 && this.session.heldPointerId < 0 &&
      before !== undefined && after !== undefined && (before.kind === 'open' || before.kind === 'dismiss') &&
      before.kind === after.kind) {
      update.layoutRebase = {
        epoch: this.session.epoch, fromTicket: fromTicket, toTicket: this.revision,
        beforeTickMs: beforeTickMs, ticketStartTickMs: this.previousTimeMs,
        rebaseReason: rebased.reason, anchorPreserved: rebased.anchorPreserved,
        before: rebaseSample(previous, before, previousAxis, previousCompensation),
        after: rebaseSample(this.session, after, this.gesture.config.axis, this.compensation),
      };
    }
    return update;
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
