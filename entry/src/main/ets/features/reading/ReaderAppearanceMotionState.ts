import {
  READER_APPEARANCE_SETTLE_FULL_DISTANCE_MS,
  READER_APPEARANCE_FULL_HEIGHT,
  readerAppearanceGrabberScreenYFromMasterProgress,
  readerAppearanceMasterProgressFromScreenY,
  readerAppearanceMeasuredTravelVp,
  sampleReaderAppearanceMasterProgress,
  type ReaderAppearanceMeasuredAxis,
  type ReaderAppearanceMotionFrame,
} from './ReaderAppearanceMotionGeometry.ts';

export type ReaderAppearanceMotionEndpoint = 'quick' | 'full';
export type ReaderAppearanceMotionPhase =
  'idleQuick' |
  'tracking' |
  'settling' |
  'idleFull';
export type ReaderAppearanceMotionSettleMode = 'none' | 'programmatic' | 'gesture';

export interface ReaderAppearanceMotionState {
  phase: ReaderAppearanceMotionPhase;
  target: ReaderAppearanceMotionEndpoint;
  sourceEndpoint: ReaderAppearanceMotionEndpoint;
  stableEndpoint: ReaderAppearanceMotionEndpoint;
  epoch: number;
  completionRevision: number;

  /** The only spatial coordinate consumed by shell, grabber and all actors. */
  masterProgress: number;
  velocityProgressPerSecond: number;

  /** Current measured screen-space axis. It changes scale, never visual p. */
  measuredAxis: ReaderAppearanceMeasuredAxis;
  trackingPointerStartScreenY: number;
  trackingGrabberStartScreenY: number;
  lastPointerScreenY: number;
  lastSampleTimeMs: number;

  reduceMotion: boolean;
  timeScale: number;
  settleMode: ReaderAppearanceMotionSettleMode;
  settleStartProgress: number;
  settleEndProgress: number;
  settleStartVelocity: number;
  settleElapsedMs: number;
  settleDurationMs: number;
}

export interface ReaderAppearanceMotionAdvanceResult {
  state: ReaderAppearanceMotionState;
  shouldContinue: boolean;
  completedEndpoint: ReaderAppearanceMotionEndpoint | undefined;
}

const RELEASE_PROJECTION_SECONDS = 0.12;
const FLING_VELOCITY_VP_PER_SECOND = 400;
const MAX_PROGRESS_VELOCITY_PER_SECOND = 3.2;
const SETTLE_MIN_MS = 90;
const ENDPOINT_EPSILON = 0.000001;
const DEFAULT_AXIS: ReaderAppearanceMeasuredAxis = {
  quickGrabberScreenY: 1,
  fullGrabberScreenY: 0,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampVelocity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(
    -MAX_PROGRESS_VELOCITY_PER_SECOND,
    Math.min(MAX_PROGRESS_VELOCITY_PER_SECOND, value),
  );
}

function safeTimeScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(0.25, Math.min(4, value));
}

function safeTime(value: number, fallback: number = 0): number {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function finiteScreenY(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function validAxisOr(axis: ReaderAppearanceMeasuredAxis, fallback: ReaderAppearanceMeasuredAxis): ReaderAppearanceMeasuredAxis {
  return readerAppearanceMeasuredTravelVp(axis) > Number.EPSILON ? {
    quickGrabberScreenY: axis.quickGrabberScreenY,
    fullGrabberScreenY: axis.fullGrabberScreenY,
  } : {
    quickGrabberScreenY: fallback.quickGrabberScreenY,
    fullGrabberScreenY: fallback.fullGrabberScreenY,
  };
}

function endpointProgress(endpoint: ReaderAppearanceMotionEndpoint): number {
  return endpoint === 'full' ? 1 : 0;
}

function endpointPhase(endpoint: ReaderAppearanceMotionEndpoint): ReaderAppearanceMotionPhase {
  return endpoint === 'full' ? 'idleFull' : 'idleQuick';
}

function copyState(state: ReaderAppearanceMotionState): ReaderAppearanceMotionState {
  return {
    phase: state.phase,
    target: state.target,
    sourceEndpoint: state.sourceEndpoint,
    stableEndpoint: state.stableEndpoint,
    epoch: state.epoch,
    completionRevision: state.completionRevision,
    masterProgress: state.masterProgress,
    velocityProgressPerSecond: state.velocityProgressPerSecond,
    measuredAxis: {
      quickGrabberScreenY: state.measuredAxis.quickGrabberScreenY,
      fullGrabberScreenY: state.measuredAxis.fullGrabberScreenY,
    },
    trackingPointerStartScreenY: state.trackingPointerStartScreenY,
    trackingGrabberStartScreenY: state.trackingGrabberStartScreenY,
    lastPointerScreenY: state.lastPointerScreenY,
    lastSampleTimeMs: state.lastSampleTimeMs,
    reduceMotion: state.reduceMotion,
    timeScale: state.timeScale,
    settleMode: state.settleMode,
    settleStartProgress: state.settleStartProgress,
    settleEndProgress: state.settleEndProgress,
    settleStartVelocity: state.settleStartVelocity,
    settleElapsedMs: state.settleElapsedMs,
    settleDurationMs: state.settleDurationMs,
  };
}

function stateAtEndpoint(
  state: ReaderAppearanceMotionState,
  endpoint: ReaderAppearanceMotionEndpoint,
  incrementCompletion: boolean,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const progress = endpointProgress(endpoint);
  next.phase = endpointPhase(endpoint);
  next.target = endpoint;
  next.sourceEndpoint = endpoint;
  next.stableEndpoint = endpoint;
  next.masterProgress = progress;
  next.velocityProgressPerSecond = 0;
  next.settleMode = 'none';
  next.settleStartProgress = progress;
  next.settleEndProgress = progress;
  next.settleStartVelocity = 0;
  next.settleElapsedMs = 0;
  next.settleDurationMs = 0;
  if (incrementCompletion) {
    next.completionRevision += 1;
  }
  return next;
}

export function createReaderAppearanceMotionState(
  initialEndpoint: ReaderAppearanceMotionEndpoint = 'quick',
  reduceMotion: boolean = false,
  timeScale: number = 1,
): ReaderAppearanceMotionState {
  const progress = endpointProgress(initialEndpoint);
  return {
    phase: endpointPhase(initialEndpoint),
    target: initialEndpoint,
    sourceEndpoint: initialEndpoint,
    stableEndpoint: initialEndpoint,
    epoch: 0,
    completionRevision: 0,
    masterProgress: progress,
    velocityProgressPerSecond: 0,
    measuredAxis: { ...DEFAULT_AXIS },
    trackingPointerStartScreenY: 0,
    trackingGrabberStartScreenY: 0,
    lastPointerScreenY: 0,
    lastSampleTimeMs: 0,
    reduceMotion,
    timeScale: safeTimeScale(timeScale),
    settleMode: 'none',
    settleStartProgress: progress,
    settleEndProgress: progress,
    settleStartVelocity: 0,
    settleElapsedMs: 0,
    settleDurationMs: 0,
  };
}

/** Refresh measured endpoints without moving the current visual frame. */
export function setReaderAppearanceMeasuredAxis(
  state: ReaderAppearanceMotionState,
  axis: ReaderAppearanceMeasuredAxis,
): ReaderAppearanceMotionState {
  const nextAxis = validAxisOr(axis, state.measuredAxis);
  if (nextAxis.quickGrabberScreenY === state.measuredAxis.quickGrabberScreenY &&
    nextAxis.fullGrabberScreenY === state.measuredAxis.fullGrabberScreenY) {
    return state;
  }
  const next = copyState(state);
  next.measuredAxis = nextAxis;
  if (state.phase === 'tracking' || state.phase === 'settling') {
    // Preserve the current visual p while rebasing the direct-manipulation
    // anchor onto the new measured screen axis. The next MOVE is therefore a
    // delta from the last delivered pointer, not from stale pre-resize Y data.
    next.trackingPointerStartScreenY = state.lastPointerScreenY;
    next.trackingGrabberStartScreenY = readerAppearanceGrabberScreenYFromMasterProgress(
      state.masterProgress,
      nextAxis,
    );
    next.velocityProgressPerSecond = 0;
  }
  next.epoch += 1;
  return next;
}

/** Change clock rate without changing the currently rendered p. */
export function setReaderAppearanceMotionTimeScale(
  state: ReaderAppearanceMotionState,
  timeScale: number,
): ReaderAppearanceMotionState {
  const nextScale = safeTimeScale(timeScale);
  if (Math.abs(nextScale - state.timeScale) <= Number.EPSILON) {
    return state;
  }
  const next = copyState(state);
  const ratio = nextScale / state.timeScale;
  next.timeScale = nextScale;
  next.epoch += 1;
  if (state.phase === 'settling') {
    next.settleElapsedMs = state.settleElapsedMs * ratio;
    next.settleDurationMs = state.settleDurationMs * ratio;
    next.settleStartVelocity = state.settleStartVelocity / ratio;
    next.velocityProgressPerSecond = state.velocityProgressPerSecond / ratio;
  }
  return next;
}

function beginSettle(
  state: ReaderAppearanceMotionState,
  target: ReaderAppearanceMotionEndpoint,
  mode: ReaderAppearanceMotionSettleMode,
  startVelocity: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const end = endpointProgress(target);
  const distance = Math.abs(end - state.masterProgress);
  next.epoch += 1;
  next.target = target;
  next.velocityProgressPerSecond = clampVelocity(startVelocity);
  if (next.reduceMotion || distance <= ENDPOINT_EPSILON) {
    return stateAtEndpoint(next, target, target !== state.stableEndpoint);
  }
  const velocityFactor = mode === 'gesture' ?
    1 + 0.28 * Math.abs(next.velocityProgressPerSecond) : 1;
  const unscaledDuration = READER_APPEARANCE_SETTLE_FULL_DISTANCE_MS * distance / velocityFactor;
  next.phase = 'settling';
  next.settleMode = mode;
  next.settleStartProgress = state.masterProgress;
  next.settleEndProgress = end;
  const direction = end >= state.masterProgress ? 1 : -1;
  next.settleStartVelocity = next.velocityProgressPerSecond * direction > 0 ?
    next.velocityProgressPerSecond : 0;
  next.settleElapsedMs = 0;
  next.settleDurationMs = Math.max(
    SETTLE_MIN_MS,
    Math.min(READER_APPEARANCE_SETTLE_FULL_DISTANCE_MS, unscaledDuration),
  ) * next.timeScale;
  return next;
}

/** Start or redirect a click settlement from the current p. */
export function startReaderAppearanceProgrammatic(
  state: ReaderAppearanceMotionState,
  target: ReaderAppearanceMotionEndpoint,
): ReaderAppearanceMotionState {
  if (target === state.stableEndpoint &&
    (state.phase === 'idleQuick' || state.phase === 'idleFull')) {
    return state;
  }
  const next = copyState(state);
  next.sourceEndpoint = state.stableEndpoint;
  return beginSettle(next, target, 'programmatic', 0);
}

/**
 * Begin or re-grab direct manipulation. DOWN never changes p; the measured
 * screen-space travel only converts subsequent one-to-one pointer movement.
 */
export function beginReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  pointerScreenY: number,
  grabberScreenY: number,
  axis: ReaderAppearanceMeasuredAxis,
  eventTimeMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const nextAxis = validAxisOr(axis, state.measuredAxis);
  const safePointerY = finiteScreenY(pointerScreenY, 0);
  next.phase = 'tracking';
  next.epoch += 1;
  next.target = state.stableEndpoint;
  next.sourceEndpoint = state.stableEndpoint;
  next.measuredAxis = nextAxis;
  next.trackingPointerStartScreenY = safePointerY;
  next.trackingGrabberStartScreenY = finiteScreenY(grabberScreenY, safePointerY);
  next.lastPointerScreenY = safePointerY;
  next.lastSampleTimeMs = safeTime(eventTimeMs, state.lastSampleTimeMs);
  next.velocityProgressPerSecond = 0;
  next.settleMode = 'none';
  next.settleElapsedMs = 0;
  next.settleDurationMs = 0;
  return next;
}

/** Track pointer screenY over the current measured axis. Upward movement expands. */
export function updateReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  pointerScreenY: number,
  eventTimeMs: number,
  velocityYVpPerSecond: number = Number.NaN,
): ReaderAppearanceMotionState {
  if (state.phase !== 'tracking' || !Number.isFinite(pointerScreenY)) {
    return state;
  }
  const signedTravel = state.measuredAxis.quickGrabberScreenY -
    state.measuredAxis.fullGrabberScreenY;
  if (!Number.isFinite(signedTravel) || Math.abs(signedTravel) <= Number.EPSILON) {
    return state;
  }
  const next = copyState(state);
  const sampleTime = safeTime(eventTimeMs, state.lastSampleTimeMs);
  const pointerDeltaY = pointerScreenY - state.trackingPointerStartScreenY;
  const currentGrabberScreenY = state.trackingGrabberStartScreenY + pointerDeltaY;
  next.masterProgress = readerAppearanceMasterProgressFromScreenY(
    currentGrabberScreenY,
    state.measuredAxis,
  );

  let velocity = state.velocityProgressPerSecond;
  if (Number.isFinite(velocityYVpPerSecond)) {
    velocity = -velocityYVpPerSecond / signedTravel;
  } else {
    const deltaMs = sampleTime - state.lastSampleTimeMs;
    if (deltaMs > 0) {
      velocity = -(pointerScreenY - state.lastPointerScreenY) / signedTravel /
        (deltaMs / 1000);
    }
  }
  next.velocityProgressPerSecond = clampVelocity(velocity);
  next.lastPointerScreenY = pointerScreenY;
  next.lastSampleTimeMs = sampleTime;
  return next;
}

function releaseTarget(
  progress: number,
  progressVelocity: number,
  measuredTravel: number,
): ReaderAppearanceMotionEndpoint {
  const velocityY = -progressVelocity * measuredTravel;
  if (Math.abs(velocityY) >= FLING_VELOCITY_VP_PER_SECOND) {
    return progressVelocity >= 0 ? 'full' : 'quick';
  }
  const projected = clamp01(progress + progressVelocity * RELEASE_PROJECTION_SECONDS);
  return projected >= 0.5 ? 'full' : 'quick';
}

export function releaseReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  velocityYVpPerSecond: number,
  eventTimeMs: number,
): ReaderAppearanceMotionState {
  if (state.phase !== 'tracking') {
    return state;
  }
  const signedTravel = state.measuredAxis.quickGrabberScreenY -
    state.measuredAxis.fullGrabberScreenY;
  const explicitVelocity = Number.isFinite(velocityYVpPerSecond) &&
    Math.abs(signedTravel) > Number.EPSILON ?
    -velocityYVpPerSecond / signedTravel : state.velocityProgressPerSecond;
  const velocity = clampVelocity(explicitVelocity);
  const target = releaseTarget(
    state.masterProgress,
    velocity,
    readerAppearanceMeasuredTravelVp(state.measuredAxis),
  );
  const next = copyState(state);
  next.lastSampleTimeMs = safeTime(eventTimeMs, state.lastSampleTimeMs);
  return beginSettle(next, target, 'gesture', velocity);
}

function monotoneHermite(
  start: number,
  end: number,
  startVelocity: number,
  durationMs: number,
  progress: number,
): number {
  const t = clamp01(progress);
  const distance = end - start;
  if (Math.abs(distance) <= ENDPOINT_EPSILON) {
    return end;
  }
  const t2 = t * t;
  const t3 = t2 * t;
  const rawTangent = startVelocity * durationMs / 1000;
  const direction = distance >= 0 ? 1 : -1;
  const tangentMagnitude = rawTangent * direction > 0 ?
    Math.min(Math.abs(rawTangent), 3 * Math.abs(distance)) : 0;
  const startTangent = tangentMagnitude * direction;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const value = h00 * start + h10 * startTangent + h01 * end;
  return Math.max(Math.min(start, end), Math.min(Math.max(start, end), value));
}

function symmetricSettleProgress(progress: number): number {
  const t = clamp01(progress);
  return t * t * (3 - 2 * t);
}

function advanceSettlement(
  state: ReaderAppearanceMotionState,
  elapsedMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const progress = state.settleDurationMs <= 0 ? 1 :
    clamp01(elapsedMs / state.settleDurationMs);
  next.settleElapsedMs = elapsedMs;
  if (state.settleMode === 'gesture') {
    next.masterProgress = clamp01(monotoneHermite(
      state.settleStartProgress,
      state.settleEndProgress,
      state.settleStartVelocity,
      state.settleDurationMs,
      progress,
    ));
  } else {
    const clock = symmetricSettleProgress(progress);
    next.masterProgress = state.settleStartProgress +
      (state.settleEndProgress - state.settleStartProgress) * clock;
  }
  return next;
}

/** Advance only the caller's captured epoch; stale callbacks are inert. */
export function advanceReaderAppearanceMotion(
  state: ReaderAppearanceMotionState,
  deltaMs: number,
  expectedEpoch: number,
): ReaderAppearanceMotionAdvanceResult {
  if (expectedEpoch !== state.epoch) {
    return { state, shouldContinue: false, completedEndpoint: undefined };
  }
  if (state.phase !== 'settling') {
    return { state, shouldContinue: false, completedEndpoint: undefined };
  }
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  const elapsed = Math.min(state.settleDurationMs, state.settleElapsedMs + safeDelta);
  const next = advanceSettlement(state, elapsed);
  if (elapsed < state.settleDurationMs) {
    return { state: next, shouldContinue: true, completedEndpoint: undefined };
  }
  const changedEndpoint = state.target !== state.stableEndpoint;
  const settled = stateAtEndpoint(next, state.target, changedEndpoint);
  settled.epoch = state.epoch;
  return { state: settled, shouldContinue: false, completedEndpoint: state.target };
}

/** CANCEL settles continuously from the current p back to the interaction source. */
export function cancelReaderAppearanceMotion(
  state: ReaderAppearanceMotionState,
): ReaderAppearanceMotionState {
  if (state.phase === 'idleQuick' || state.phase === 'idleFull') {
    return state;
  }
  return beginSettle(state, state.sourceEndpoint, 'programmatic', 0);
}

export function readerAppearanceMotionIsActive(state: ReaderAppearanceMotionState): boolean {
  return state.phase === 'tracking' || state.phase === 'settling';
}

/** Every visual field is sampled from the same masterProgress. */
export function sampleReaderAppearanceMotionState(
  state: ReaderAppearanceMotionState,
  fullHeight: number = READER_APPEARANCE_FULL_HEIGHT,
): ReaderAppearanceMotionFrame {
  return sampleReaderAppearanceMasterProgress(state.masterProgress, fullHeight);
}
