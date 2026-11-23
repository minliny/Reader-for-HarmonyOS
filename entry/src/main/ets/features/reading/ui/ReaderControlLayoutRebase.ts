import {
  readerControlGrabberScreenY, rebaseReaderControlGesture,
} from './ReaderControlGestureDriver.ts';
import type {
  ReaderControlGestureState, ReaderControlMeasuredAxis,
} from './ReaderControlGestureDriver.ts';
import {
  rebaseReaderControlTransitionProgress, sampleReaderControlSession,
} from './ReaderControlSessionState.ts';
import type {
  ReaderControlSessionState,
} from './ReaderControlSessionState.ts';
import { projectReaderControlSpatialPath } from './ReaderControlSpatialPath.ts';

/** Translate the complete control composition, including its input region.
 * This is layout correction, not another expansion/visibility animation owner.
 * The Stage must advance it with the SAME posted frame delta as the session.
 */
export interface ReaderControlLayoutCompensation {
  offsetY: number;
  startOffsetY: number;
  elapsedMs: number;
  durationMs: number;
  running: boolean;
  revision: number;
}

export type ReaderControlLayoutRebaseReason = 'unchanged' | 'stable-layout' | 'projected' |
  'compensated-stable-hold' | 'compensated-outside-segment' | 'compensated-static-segment' |
  'invalid-axis' | 'invalid-pointer' | 'invalid-compensation';

export interface ReaderControlLayoutRebaseResult {
  session: ReaderControlSessionState;
  gesture: ReaderControlGestureState;
  compensation: ReaderControlLayoutCompensation;
  accepted: boolean;
  anchorPreserved: boolean;
  reason: ReaderControlLayoutRebaseReason;
}

function unit(value: number): number { return Math.max(0, Math.min(1, value)); }

function axisIsValid(axis: ReaderControlMeasuredAxis): boolean {
  return Number.isFinite(axis.quickGrabberScreenY) && Number.isFinite(axis.fullGrabberScreenY) &&
    Number.isFinite(axis.hiddenGrabberScreenY) && axis.fullGrabberScreenY <= axis.quickGrabberScreenY &&
    axis.quickGrabberScreenY <= axis.hiddenGrabberScreenY;
}

function sameAxis(a: ReaderControlMeasuredAxis, b: ReaderControlMeasuredAxis): boolean {
  return a.quickGrabberScreenY === b.quickGrabberScreenY &&
    a.fullGrabberScreenY === b.fullGrabberScreenY && a.hiddenGrabberScreenY === b.hiddenGrabberScreenY;
}

function copyCompensation(value: ReaderControlLayoutCompensation): ReaderControlLayoutCompensation {
  return { offsetY: value.offsetY, startOffsetY: value.startOffsetY, elapsedMs: value.elapsedMs,
    durationMs: value.durationMs, running: value.running, revision: value.revision };
}

export function createReaderControlLayoutCompensation(): ReaderControlLayoutCompensation {
  return { offsetY: 0, startOffsetY: 0, elapsedMs: 0, durationMs: 0, running: false, revision: 0 };
}

/** DOWN freezes the currently displayed correction; it never snaps it to zero. */
export function pauseReaderControlLayoutCompensation(
  value: ReaderControlLayoutCompensation): ReaderControlLayoutCompensation {
  if (!value.running) return value;
  return { offsetY: value.offsetY, startOffsetY: value.offsetY, elapsedMs: 0,
    durationMs: 0, running: false, revision: value.revision + 1 };
}

/** Call after UP/CANCEL or an explicit command. A stable long hold has no
 * session transition but still needs this geometry-only return to the new layout.
 * Zero duration is an explicit reduced-motion/immediate settlement policy.
 */
export function settleReaderControlLayoutCompensation(value: ReaderControlLayoutCompensation,
  session: ReaderControlSessionState, fallbackDurationMs: number): ReaderControlLayoutCompensation {
  if (session.heldPointerId >= 0) return pauseReaderControlLayoutCompensation(value);
  if (value.offsetY === 0) return value.running ? createStoppedCompensation(value, 0) : value;
  const requestedDuration = session.transition === undefined ? fallbackDurationMs :
    Math.max(0, session.transition.durationMs - session.transition.elapsedMs);
  if (!Number.isFinite(requestedDuration) || requestedDuration < 0) return value;
  if (requestedDuration === 0) return createStoppedCompensation(value, 0);
  return { offsetY: value.offsetY, startOffsetY: value.offsetY, elapsedMs: 0,
    durationMs: requestedDuration, running: true, revision: value.revision + 1 };
}

function createStoppedCompensation(value: ReaderControlLayoutCompensation,
  offsetY: number): ReaderControlLayoutCompensation {
  return { offsetY: offsetY, startOffsetY: offsetY, elapsedMs: 0, durationMs: 0,
    running: false, revision: value.revision + 1 };
}

/** No timers, no session writes, and no close side effects. */
export function advanceReaderControlLayoutCompensation(value: ReaderControlLayoutCompensation,
  session: ReaderControlSessionState, deltaMs: number, expectedRevision: number,
  clockCurve?: (fraction: number) => number): ReaderControlLayoutCompensation {
  if (!value.running || value.revision !== expectedRevision || session.heldPointerId >= 0 ||
    !Number.isFinite(deltaMs) || deltaMs < 0) return value;
  const next = copyCompensation(value);
  next.elapsedMs += deltaMs;
  const fraction = next.durationMs === 0 ? 1 : unit(next.elapsedMs / next.durationMs);
  const curved = fraction === 1 || clockCurve === undefined ? fraction : clockCurve(fraction);
  if (!Number.isFinite(curved)) return value;
  next.offsetY = fraction === 1 ? 0 : next.startOffsetY * (1 - unit(curved));
  next.running = fraction < 1;
  return next;
}

function result(session: ReaderControlSessionState, gesture: ReaderControlGestureState,
  compensation: ReaderControlLayoutCompensation, accepted: boolean, anchorPreserved: boolean,
  reason: ReaderControlLayoutRebaseReason): ReaderControlLayoutRebaseResult {
  return { session: session, gesture: gesture, compensation: compensation, accepted: accepted,
    anchorPreserved: anchorPreserved, reason: reason };
}

/** Atomically replace session, gesture AND compensation before rendering new
 * bounds. Old axis comes from gesture.config.axis, before the host overwrites it.
 * pointerScreenY is the actual current/last pointer sample, not the handle Y:
 * the user's contact may be offset from the handle center.
 *
 * accepted=false requires the host to retain its last valid bounds. A shared
 * offset must translate every actor and the hit region, not just the handle.
 */
export function rebaseReaderControlLayout(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState, compensation: ReaderControlLayoutCompensation,
  newAxis: ReaderControlMeasuredAxis,
  pointerScreenY: number = gesture.lastPointerScreenY): ReaderControlLayoutRebaseResult {
  const oldAxis = gesture.config.axis;
  if (!axisIsValid(oldAxis) || !axisIsValid(newAxis)) {
    return result(session, gesture, compensation, false, false, 'invalid-axis');
  }
  if (!Number.isFinite(pointerScreenY)) {
    return result(session, gesture, compensation, false, false, 'invalid-pointer');
  }
  if (!Number.isFinite(compensation.offsetY)) {
    return result(session, gesture, compensation, false, false, 'invalid-compensation');
  }
  if (sameAxis(oldAxis, newAxis)) return result(session, gesture, compensation, true, true, 'unchanged');
  const nextGesture = rebaseReaderControlGesture(gesture, newAxis, pointerScreenY);
  const held = session.heldPointerId >= 0;
  if (!held && session.transition === undefined && compensation.offsetY === 0) {
    // Responsive stable layout has no active process or held screen anchor.
    return result(session, nextGesture, compensation, true, false, 'stable-layout');
  }
  const oldY = readerControlGrabberScreenY(sampleReaderControlSession(session), oldAxis) + compensation.offsetY;
  let nextSession = session;
  let reason: ReaderControlLayoutRebaseReason = 'compensated-stable-hold';
  if (session.transition !== undefined) {
    const projected = projectReaderControlSpatialPath(session.transition, newAxis, oldY);
    // An explicit unreachable boundary is useful for MOVE, but resize must not
    // manufacture endpoint arrival: retain progress and translate the group.
    nextSession = rebaseReaderControlTransitionProgress(session,
      projected.reachable ? projected.progress : session.transition.progress, session.epoch);
    reason = projected.spatiallyStatic ? 'compensated-static-segment' : projected.reachable ?
      'projected' : 'compensated-outside-segment';
  }
  const nextY = readerControlGrabberScreenY(sampleReaderControlSession(nextSession), newAxis);
  let nextCompensation = createStoppedCompensation(compensation, oldY - nextY);
  if (!held) {
    const remainingDuration = compensation.running ?
      Math.max(0, compensation.durationMs - compensation.elapsedMs) : 0;
    // A residual remains explicitly represented when no positive return time
    // exists; the host may choose its supplied immediate-settlement policy later.
    const durationMs = nextSession.transition === undefined ? remainingDuration :
      nextSession.transition.durationMs;
    if (durationMs > 0) {
      nextCompensation = settleReaderControlLayoutCompensation(nextCompensation, nextSession, durationMs);
    }
  }
  return result(nextSession, nextGesture, nextCompensation, true, true, reason);
}
