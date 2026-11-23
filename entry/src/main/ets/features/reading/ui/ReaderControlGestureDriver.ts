import {
  beginReaderControlDragSegment,
  collapseReaderControlSession,
  copyReaderControlLocation,
  expandReaderControlSession,
  holdReaderControlSession,
  readerControlContentLocation,
  readerControlTargetLocation,
  releaseReaderControlSessionHold,
  sampleReaderControlSession,
  resumeReaderControlSessionTarget,
  retargetReaderControlTransition,
  toggleReaderControlSession,
  trackReaderControlTransition,
} from './ReaderControlSessionState.ts';
import type {
  ReaderControlLocation,
  ReaderControlSessionState,
  ReaderControlVisualFrame,
} from './ReaderControlSessionState.ts';
import {
  moveReaderControlSpatialPath,
  readerControlSpatialY,
} from './ReaderControlSpatialPath.ts';
import { readerControlMotionTargetDuration } from './ReaderControlMotionPolicy.ts';

export type ReaderControlDragDirection = 'none' | 'up' | 'down';

/** Screen-space vp anchors; hidden is the Quick composition's hidden anchor.
 * Its difference from Quick is the shared whole-dock show/hide travel.
 */
export interface ReaderControlMeasuredAxis {
  quickGrabberScreenY: number;
  fullGrabberScreenY: number;
  hiddenGrabberScreenY: number;
}

export interface ReaderControlGestureConfig {
  axis: ReaderControlMeasuredAxis;
  tapMaxDurationMs: number;
  directionSlopVp: number;
  settleDurationMs: number;
  showDurationMs?: number;
  dismissDurationMs?: number;
  coordinatedMotion?: boolean;
}

export interface ReaderControlGestureState {
  pointerId: number;
  sessionEpoch: number;
  downTimeMs: number;
  lastTimeMs: number;
  lastPointerScreenY: number;
  directionAnchorScreenY: number;
  recentDirection: ReaderControlDragDirection;
  moved: boolean;
  velocityYVpPerSecond: number;
  velocitySampleIntervalMs: number;
  // Real finger travel outside a bounded visual path. Reversal must consume
  // this residue before the composition moves back inside the path.
  blockedDeltaVp: number;
  wasAnimating: boolean;
  pausedSessionEpoch: number;
  pointerDisplaced: boolean;
  pausedTargetProgress: number;
  pausedTargetLocation: ReaderControlLocation;
  downLocation: ReaderControlLocation;
  config: ReaderControlGestureConfig;
}

export interface ReaderControlGestureResult {
  session: ReaderControlSessionState;
  gesture: ReaderControlGestureState;
  consumed: boolean;
  finishedTouch: boolean;
}

function copyAxis(axis: ReaderControlMeasuredAxis): ReaderControlMeasuredAxis {
  return { quickGrabberScreenY: axis.quickGrabberScreenY,
    fullGrabberScreenY: axis.fullGrabberScreenY, hiddenGrabberScreenY: axis.hiddenGrabberScreenY };
}

function copyConfig(config: ReaderControlGestureConfig): ReaderControlGestureConfig {
  return { axis: copyAxis(config.axis), tapMaxDurationMs: Math.max(0, config.tapMaxDurationMs),
    directionSlopVp: Math.max(0, config.directionSlopVp),
    settleDurationMs: Math.max(0, config.settleDurationMs),
    showDurationMs: config.showDurationMs, dismissDurationMs: config.dismissDurationMs,
    coordinatedMotion: config.coordinatedMotion };
}

function copyGesture(gesture: ReaderControlGestureState): ReaderControlGestureState {
  return {
    pointerId: gesture.pointerId, sessionEpoch: gesture.sessionEpoch,
    downTimeMs: gesture.downTimeMs, lastTimeMs: gesture.lastTimeMs,
    lastPointerScreenY: gesture.lastPointerScreenY,
    directionAnchorScreenY: gesture.directionAnchorScreenY,
    recentDirection: gesture.recentDirection, moved: gesture.moved,
    velocityYVpPerSecond: gesture.velocityYVpPerSecond,
    velocitySampleIntervalMs: gesture.velocitySampleIntervalMs,
    blockedDeltaVp: gesture.blockedDeltaVp,
    wasAnimating: gesture.wasAnimating, pausedTargetProgress: gesture.pausedTargetProgress,
    pausedSessionEpoch: gesture.pausedSessionEpoch, pointerDisplaced: gesture.pointerDisplaced,
    pausedTargetLocation: copyReaderControlLocation(gesture.pausedTargetLocation),
    downLocation: copyReaderControlLocation(gesture.downLocation),
    config: copyConfig(gesture.config),
  };
}

export function createReaderControlGestureState(config: ReaderControlGestureConfig): ReaderControlGestureState {
  return { pointerId: -1, sessionEpoch: -1, downTimeMs: 0, lastTimeMs: 0,
    lastPointerScreenY: 0, directionAnchorScreenY: 0, recentDirection: 'none', moved: false,
    velocityYVpPerSecond: 0, velocitySampleIntervalMs: 0, blockedDeltaVp: 0,
    wasAnimating: false, pausedTargetProgress: 1, pausedSessionEpoch: -1, pointerDisplaced: false,
    pausedTargetLocation: { level: 'hidden', module: 'directory', directoryTab: 'directory', form: 'quick' },
    downLocation: { level: 'hidden', module: 'directory', directoryTab: 'directory', form: 'quick' },
    config: copyConfig(config) };
}

export function readerControlGrabberScreenY(frame: ReaderControlVisualFrame,
  axis: ReaderControlMeasuredAxis): number {
  return readerControlSpatialY(frame, axis);
}

function result(session: ReaderControlSessionState, gesture: ReaderControlGestureState,
  consumed: boolean, finishedTouch: boolean = false): ReaderControlGestureResult {
  return { session: session, gesture: gesture, consumed: consumed, finishedTouch: finishedTouch };
}

function owns(session: ReaderControlSessionState, gesture: ReaderControlGestureState,
  pointerId: number): boolean {
  return pointerId >= 0 && pointerId === gesture.pointerId && pointerId === session.heldPointerId &&
    gesture.sessionEpoch === session.epoch;
}

export function beginReaderControlGesture(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState, pointerId: number, pointerScreenY: number,
  eventTimeMs: number): ReaderControlGestureResult {
  if (!Number.isFinite(pointerScreenY) || !Number.isFinite(eventTimeMs) ||
    gesture.pointerId >= 0 && gesture.sessionEpoch === session.epoch) return result(session, gesture, false);
  const held = holdReaderControlSession(session, pointerId);
  if (held === session) return result(session, gesture, false);
  const next = createReaderControlGestureState(gesture.config);
  next.pointerId = pointerId;
  next.sessionEpoch = held.epoch;
  next.downTimeMs = eventTimeMs;
  next.lastTimeMs = eventTimeMs;
  next.lastPointerScreenY = pointerScreenY;
  next.directionAnchorScreenY = pointerScreenY;
  next.wasAnimating = session.transition !== undefined;
  next.pausedSessionEpoch = held.epoch;
  next.pausedTargetProgress = session.transition === undefined ? 1 : session.transition.targetProgress;
  next.pausedTargetLocation = readerControlTargetLocation(session);
  next.downLocation = readerControlContentLocation(session);
  return result(held, next, true);
}

export function updateReaderControlGesture(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState, pointerId: number, pointerScreenY: number,
  eventTimeMs: number): ReaderControlGestureResult {
  if (!owns(session, gesture, pointerId) || !Number.isFinite(pointerScreenY) ||
    !Number.isFinite(eventTimeMs) || eventTimeMs < gesture.lastTimeMs) return result(session, gesture, false);
  const next = copyGesture(gesture);
  const delta = pointerScreenY - gesture.lastPointerScreenY;
  const deltaMs = eventTimeMs - gesture.lastTimeMs;
  next.velocityYVpPerSecond = deltaMs > 0 ? delta / deltaMs * 1000 : 0;
  next.velocitySampleIntervalMs = deltaMs;
  next.lastPointerScreenY = pointerScreenY;
  next.lastTimeMs = eventTimeMs;
  const intentDelta = pointerScreenY - gesture.directionAnchorScreenY;
  if (Math.abs(intentDelta) > next.config.directionSlopVp) {
    next.recentDirection = intentDelta < 0 ? 'up' : 'down';
    next.directionAnchorScreenY = pointerScreenY;
    next.moved = true;
  }
  if (delta === 0) return result(session, next, true);
  next.pointerDisplaced = true;
  let remainingDelta = delta + gesture.blockedDeltaVp;
  next.blockedDeltaVp = 0;
  if (gesture.blockedDeltaVp !== 0 &&
    Math.sign(remainingDelta) === Math.sign(gesture.blockedDeltaVp)) {
    next.blockedDeltaVp = remainingDelta;
    return result(session, next, true);
  }
  if (remainingDelta === 0) return result(session, next, true);
  let current = beginReaderControlDragSegment(session, remainingDelta < 0 ? 'up' : 'down',
    next.config.settleDurationMs);
  next.sessionEpoch = current.epoch;
  for (let segment = 0; segment < 2; segment += 1) {
    const transition = current.transition;
    if (transition === undefined) break;
    const moved = moveReaderControlSpatialPath(transition, next.config.axis, remainingDelta);
    if (!Number.isFinite(moved.progress) || !Number.isFinite(moved.remainingDelta)) break;
    current = trackReaderControlTransition(current, moved.progress, current.epoch);
    remainingDelta = moved.remainingDelta;
    if (Math.abs(remainingDelta) <= 1e-7 || !moved.atBoundary) break;
    const continued = beginReaderControlDragSegment(current, remainingDelta < 0 ? 'up' : 'down',
      next.config.settleDurationMs);
    if (continued === current) break;
    current = continued;
    next.sessionEpoch = current.epoch;
  }
  if (Number.isFinite(remainingDelta)) next.blockedDeltaVp = remainingDelta;
  return result(current, next, true);
}

/** Direction chooses the destination. This policy only chooses continuation time. */
export function readerControlGestureTargetDuration(session: ReaderControlSessionState,
  config: ReaderControlGestureConfig, target: ReaderControlLocation,
  visualTarget?: ReaderControlVisualFrame): number {
  if (config.coordinatedMotion && config.settleDurationMs > 0) {
    const tts = readerControlMotionTargetDuration(session, target, visualTarget);
    if (tts !== undefined) return tts;
  }
  const frame = sampleReaderControlSession(session);
  const targetExpansion = visualTarget !== undefined ? visualTarget.expansionProgress :
    target.level === 'secondary' && target.form === 'full' ? 1 : 0;
  // A mixed restoration still changes the composition: MR1 show timing cannot
  // compress that morph. Callers retracing a close pass its actual capture
  // frame, which can be mid-morph and need not equal the logical Full endpoint.
  const changesExpansion = target.level !== 'hidden' && frame.expansionProgress !== targetExpansion;
  const override = target.level === 'hidden' ? config.dismissDurationMs :
    !changesExpansion && frame.visibilityProgress < 1 ? config.showDurationMs : undefined;
  return override !== undefined && Number.isFinite(override) && override >= 0 ? override :
    Math.max(0, config.settleDurationMs);
}

export function readerControlGestureToggleDuration(session: ReaderControlSessionState,
  config: ReaderControlGestureConfig): number {
  const transition = session.transition;
  const target = transition === undefined ? copyReaderControlLocation(readerControlTargetLocation(session)) :
    transition.targetProgress === 1 ? transition.fromLocation : transition.toLocation;
  if (transition === undefined && target.level === 'secondary') target.form = target.form === 'full' ? 'quick' : 'full';
  const visualTarget = transition === undefined ? undefined :
    transition.targetProgress === 1 ? transition.from : transition.to;
  return readerControlGestureTargetDuration(session, config, target, visualTarget);
}

function releaseDuration(session: ReaderControlSessionState, gesture: ReaderControlGestureState,
  targetProgress: number): number {
  const transition = session.transition;
  if (transition === undefined) return gesture.config.settleDurationMs;
  const targetLocation = targetProgress === 0 ? transition.fromLocation : transition.toLocation;
  const nominal = readerControlGestureTargetDuration(session, gesture.config, targetLocation,
    targetProgress === 0 ? transition.from : transition.to);
  const remaining = Math.abs(targetProgress - transition.progress);
  const travel = Math.abs(readerControlGrabberScreenY(transition.to, gesture.config.axis) -
    readerControlGrabberScreenY(transition.from, gesture.config.axis));
  const speedFactor = travel > Number.EPSILON ?
    1 + Math.abs(gesture.velocityYVpPerSecond) * nominal / (1000 * travel) : 1;
  return nominal * remaining / speedFactor;
}

function resumePausedGesture(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState): ReaderControlSessionState {
  if (session.epoch === gesture.pausedSessionEpoch) {
    if (!gesture.pointerDisplaced || session.transition === undefined) {
      return releaseReaderControlSessionHold(session);
    }
    // Sub-slop jitter (or CANCEL within the original segment) changed the
    // sample, not the operation. Preserve its source/target and unspent time,
    // restarting only the remaining clock from the actual finger-owned frame.
    return retargetReaderControlTransition(session, gesture.pausedTargetProgress,
      Math.max(0, session.transition.durationMs - session.transition.elapsedMs));
  }
  // Crossing a segment invalidates its local progress identity, not the
  // pre-hold logical goal. Rebuild continuously using the actual goal's path.
  return resumeReaderControlSessionTarget(session, gesture.pausedTargetLocation,
    readerControlGestureTargetDuration(session, gesture.config, gesture.pausedTargetLocation));
}

export function endReaderControlGesture(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState, pointerId: number, eventTimeMs: number): ReaderControlGestureResult {
  if (!owns(session, gesture, pointerId) || !Number.isFinite(eventTimeMs) ||
    eventTimeMs < gesture.lastTimeMs) return result(session, gesture, false);
  const next = copyGesture(gesture);
  next.pointerId = -1;
  // Extend the last measured interval to UP. A normal frame gap retains fling
  // velocity; a long stationary pause decays it without an invented time cutoff.
  const releaseGapMs = eventTimeMs - gesture.lastTimeMs;
  const velocityWindowMs = gesture.velocitySampleIntervalMs + releaseGapMs;
  if (velocityWindowMs > 0) {
    next.velocityYVpPerSecond *= gesture.velocitySampleIntervalMs / velocityWindowMs;
  }
  let current: ReaderControlSessionState;
  if (!gesture.moved) {
    const isTap = eventTimeMs - gesture.downTimeMs < gesture.config.tapMaxDurationMs;
    if (isTap) {
      if (gesture.wasAnimating) {
        current = toggleReaderControlSession(session,
          readerControlGestureToggleDuration(session, gesture.config));
      } else if (gesture.downLocation.level === 'secondary') {
        const duration = readerControlGestureToggleDuration(session, gesture.config);
        current = gesture.downLocation.form === 'full' ?
          collapseReaderControlSession(session, duration) :
          expandReaderControlSession(session, duration);
      } else {
        current = retargetReaderControlTransition(session, 0, gesture.config.settleDurationMs);
      }
      if (current.heldPointerId >= 0) current = retargetReaderControlTransition(current,
        gesture.pausedTargetProgress, gesture.config.settleDurationMs);
    } else {
      current = resumePausedGesture(session, gesture);
    }
  } else {
    let target = gesture.pausedTargetProgress;
    const transition = session.transition;
    if (transition !== undefined && gesture.recentDirection !== 'none') {
      const fromY = readerControlGrabberScreenY(transition.from, gesture.config.axis);
      const toY = readerControlGrabberScreenY(transition.to, gesture.config.axis);
      const towardsTo = gesture.recentDirection === 'up' ? toY < fromY : toY > fromY;
      target = towardsTo ? 1 : 0;
    }
    current = retargetReaderControlTransition(session, target, releaseDuration(session, next, target));
  }
  next.sessionEpoch = current.epoch;
  return result(current, next, true, true);
}

/** CANCEL is neither tap nor fling; resume the pre-hold goal or restore the source. */
export function cancelReaderControlGesture(session: ReaderControlSessionState,
  gesture: ReaderControlGestureState, pointerId: number): ReaderControlGestureResult {
  if (!owns(session, gesture, pointerId)) return result(session, gesture, false);
  const next = copyGesture(gesture);
  next.pointerId = -1;
  const current = resumePausedGesture(session, gesture);
  next.sessionEpoch = current.epoch;
  return result(current, next, true, true);
}

/** Layout owns visual compensation. Rebase input without changing the current sample. */
export function rebaseReaderControlGesture(gesture: ReaderControlGestureState,
  axis: ReaderControlMeasuredAxis, pointerScreenY: number): ReaderControlGestureState {
  const next = copyGesture(gesture);
  next.config.axis = copyAxis(axis);
  next.lastPointerScreenY = pointerScreenY;
  next.directionAnchorScreenY = pointerScreenY;
  next.velocityYVpPerSecond = 0;
  next.velocitySampleIntervalMs = 0;
  return next;
}
