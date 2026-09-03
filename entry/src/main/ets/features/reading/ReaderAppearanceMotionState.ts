import {
  READER_APPEARANCE_COLLAPSE_DURATION_MS,
  READER_APPEARANCE_EXPAND_DURATION_MS,
  READER_APPEARANCE_FULL_HEIGHT,
  READER_APPEARANCE_QUICK_HEIGHT,
  READER_APPEARANCE_SHELL_TRAVEL_VP,
  READER_APPEARANCE_STAGE_WIDTH,
  readerAppearanceExpansionFromTrajectory,
  sampleReaderAppearanceExpansion,
  type ReaderAppearanceMotionFrame,
  type ReaderAppearanceMotionProfile,
} from './ReaderAppearanceMotionGeometry.ts';

export type ReaderAppearanceMotionEndpoint = 'quick' | 'full';
export type ReaderAppearanceMotionPhase =
  'idleQuick' |
  'tracking' |
  'settling' |
  'elastic' |
  'idleFull';
export type ReaderAppearanceMotionSettleMode = 'none' | 'programmatic' | 'gesture';

export interface ReaderAppearanceMotionState {
  phase: ReaderAppearanceMotionPhase;
  /** Direction-specific clock only. It never selects a different visual tree. */
  profile: ReaderAppearanceMotionProfile;
  target: ReaderAppearanceMotionEndpoint;
  sourceEndpoint: ReaderAppearanceMotionEndpoint;
  stableEndpoint: ReaderAppearanceMotionEndpoint;
  epoch: number;
  completionRevision: number;

  /** The sole clamped progress consumed by every non-elastic visual actor. */
  expansionProgress: number;
  /** Physical shell progress; it may exceed [0,1] by at most four vp. */
  rawExpansionProgress: number;
  velocityExpansionPerSecond: number;
  elasticOffsetVp: number;
  trackingExpansionOffset: number;

  reduceMotion: boolean;
  timeScale: number;
  settleMode: ReaderAppearanceMotionSettleMode;
  settleStartExpansion: number;
  settleStartRawExpansion: number;
  settleEndExpansion: number;
  settleStartVelocity: number;
  settleElapsedMs: number;
  settleDurationMs: number;
  elasticElapsedMs: number;
  elasticDurationMs: number;
  elasticAmplitudeVp: number;
  lastSampleTimeMs: number;
  lastSampleRawExpansion: number;
}

export interface ReaderAppearanceMotionAdvanceResult {
  state: ReaderAppearanceMotionState;
  shouldContinue: boolean;
  completedEndpoint: ReaderAppearanceMotionEndpoint | undefined;
}

const READER_APPEARANCE_RELEASE_PROJECTION_SECONDS = 0.12;
const READER_APPEARANCE_FLING_VELOCITY_VP_PER_SECOND = 400;
const READER_APPEARANCE_MAX_EXPANSION_VELOCITY_PER_SECOND = 3.2;
const READER_APPEARANCE_SETTLE_MIN_MS = 90;
const READER_APPEARANCE_ELASTIC_DURATION_MS = 180;
const READER_APPEARANCE_ELASTIC_MAX_VP = 4;
const READER_APPEARANCE_ENDPOINT_EPSILON = 0.000001;
const READER_APPEARANCE_MAX_RAW_OVERFLOW =
  READER_APPEARANCE_ELASTIC_MAX_VP / READER_APPEARANCE_SHELL_TRAVEL_VP;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampRawExpansion(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(
    -READER_APPEARANCE_MAX_RAW_OVERFLOW,
    Math.min(1 + READER_APPEARANCE_MAX_RAW_OVERFLOW, value),
  );
}

function clampVelocity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(
    -READER_APPEARANCE_MAX_EXPANSION_VELOCITY_PER_SECOND,
    Math.min(READER_APPEARANCE_MAX_EXPANSION_VELOCITY_PER_SECOND, value),
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

function endpointExpansion(endpoint: ReaderAppearanceMotionEndpoint): number {
  return endpoint === 'full' ? 1 : 0;
}

function endpointPhase(endpoint: ReaderAppearanceMotionEndpoint): ReaderAppearanceMotionPhase {
  return endpoint === 'full' ? 'idleFull' : 'idleQuick';
}

/** The resting endpoint selects only the direction of its next click. */
function profileAtEndpoint(endpoint: ReaderAppearanceMotionEndpoint): ReaderAppearanceMotionProfile {
  return endpoint === 'full' ? 'collapseO' : 'expandN';
}

function profileForTarget(target: ReaderAppearanceMotionEndpoint): ReaderAppearanceMotionProfile {
  return target === 'full' ? 'expandN' : 'collapseO';
}

function profileDuration(profile: ReaderAppearanceMotionProfile): number {
  return profile === 'collapseO' ?
    READER_APPEARANCE_COLLAPSE_DURATION_MS : READER_APPEARANCE_EXPAND_DURATION_MS;
}

function copyState(state: ReaderAppearanceMotionState): ReaderAppearanceMotionState {
  return {
    phase: state.phase,
    profile: state.profile,
    target: state.target,
    sourceEndpoint: state.sourceEndpoint,
    stableEndpoint: state.stableEndpoint,
    epoch: state.epoch,
    completionRevision: state.completionRevision,
    expansionProgress: state.expansionProgress,
    rawExpansionProgress: state.rawExpansionProgress,
    velocityExpansionPerSecond: state.velocityExpansionPerSecond,
    elasticOffsetVp: state.elasticOffsetVp,
    trackingExpansionOffset: state.trackingExpansionOffset,
    reduceMotion: state.reduceMotion,
    timeScale: state.timeScale,
    settleMode: state.settleMode,
    settleStartExpansion: state.settleStartExpansion,
    settleStartRawExpansion: state.settleStartRawExpansion,
    settleEndExpansion: state.settleEndExpansion,
    settleStartVelocity: state.settleStartVelocity,
    settleElapsedMs: state.settleElapsedMs,
    settleDurationMs: state.settleDurationMs,
    elasticElapsedMs: state.elasticElapsedMs,
    elasticDurationMs: state.elasticDurationMs,
    elasticAmplitudeVp: state.elasticAmplitudeVp,
    lastSampleTimeMs: state.lastSampleTimeMs,
    lastSampleRawExpansion: state.lastSampleRawExpansion,
  };
}

function stateAtEndpoint(
  state: ReaderAppearanceMotionState,
  endpoint: ReaderAppearanceMotionEndpoint,
  incrementCompletion: boolean,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const expansion = endpointExpansion(endpoint);
  next.phase = endpointPhase(endpoint);
  next.profile = profileAtEndpoint(endpoint);
  next.target = endpoint;
  next.sourceEndpoint = endpoint;
  next.stableEndpoint = endpoint;
  next.expansionProgress = expansion;
  next.rawExpansionProgress = expansion;
  next.velocityExpansionPerSecond = 0;
  next.elasticOffsetVp = 0;
  next.trackingExpansionOffset = 0;
  next.settleMode = 'none';
  next.settleStartExpansion = expansion;
  next.settleStartRawExpansion = expansion;
  next.settleEndExpansion = expansion;
  next.settleStartVelocity = 0;
  next.settleElapsedMs = 0;
  next.settleDurationMs = 0;
  next.elasticElapsedMs = 0;
  next.elasticDurationMs = 0;
  next.elasticAmplitudeVp = 0;
  next.lastSampleRawExpansion = expansion;
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
  const expansion = endpointExpansion(initialEndpoint);
  return {
    phase: endpointPhase(initialEndpoint),
    profile: profileAtEndpoint(initialEndpoint),
    target: initialEndpoint,
    sourceEndpoint: initialEndpoint,
    stableEndpoint: initialEndpoint,
    epoch: 0,
    completionRevision: 0,
    expansionProgress: expansion,
    rawExpansionProgress: expansion,
    velocityExpansionPerSecond: 0,
    elasticOffsetVp: 0,
    trackingExpansionOffset: 0,
    reduceMotion,
    timeScale: safeTimeScale(timeScale),
    settleMode: 'none',
    settleStartExpansion: expansion,
    settleStartRawExpansion: expansion,
    settleEndExpansion: expansion,
    settleStartVelocity: 0,
    settleElapsedMs: 0,
    settleDurationMs: 0,
    elasticElapsedMs: 0,
    elasticDurationMs: 0,
    elasticAmplitudeVp: 0,
    lastSampleTimeMs: 0,
    lastSampleRawExpansion: expansion,
  };
}

/** Change clock rate without changing the currently rendered frame. */
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
    next.elasticDurationMs = state.elasticDurationMs * ratio;
    if (state.settleMode === 'gesture') {
      next.settleStartVelocity = state.settleStartVelocity / ratio;
      next.velocityExpansionPerSecond = state.velocityExpansionPerSecond / ratio;
    }
  } else if (state.phase === 'elastic') {
    next.elasticElapsedMs = state.elasticElapsedMs * ratio;
    next.elasticDurationMs = state.elasticDurationMs * ratio;
  }
  return next;
}

function renderedRawExpansion(state: ReaderAppearanceMotionState): number {
  return clampRawExpansion(
    state.rawExpansionProgress - state.elasticOffsetVp / READER_APPEARANCE_SHELL_TRAVEL_VP,
  );
}

/**
 * Start or redirect a click settlement from the current physical frame.
 * Remaining distance, not the last stable endpoint, determines remaining time.
 */
export function startReaderAppearanceProgrammatic(
  state: ReaderAppearanceMotionState,
  target: ReaderAppearanceMotionEndpoint,
): ReaderAppearanceMotionState {
  if (target === state.stableEndpoint &&
    (state.phase === 'idleQuick' || state.phase === 'idleFull')) {
    return state;
  }
  const next = copyState(state);
  const targetExpansion = endpointExpansion(target);
  const rawStart = renderedRawExpansion(state);
  const remainingDistance = Math.max(
    Math.abs(targetExpansion - state.expansionProgress),
    Math.abs(targetExpansion - rawStart),
  );
  next.epoch += 1;
  next.profile = profileForTarget(target);
  next.target = target;
  next.sourceEndpoint = state.stableEndpoint;
  next.rawExpansionProgress = rawStart;
  next.elasticOffsetVp = 0;
  next.trackingExpansionOffset = 0;
  if (next.reduceMotion || remainingDistance <= READER_APPEARANCE_ENDPOINT_EPSILON) {
    return stateAtEndpoint(next, target, target !== state.stableEndpoint);
  }
  next.phase = 'settling';
  next.settleMode = 'programmatic';
  next.settleStartExpansion = state.expansionProgress;
  next.settleStartRawExpansion = rawStart;
  next.settleEndExpansion = targetExpansion;
  next.settleStartVelocity = 0;
  next.settleElapsedMs = 0;
  next.settleDurationMs = profileDuration(next.profile) * remainingDistance * next.timeScale;
  next.elasticElapsedMs = 0;
  next.elasticDurationMs = 0;
  next.elasticAmplitudeVp = 0;
  next.velocityExpansionPerSecond = 0;
  return next;
}

/** Begin or re-grab direct manipulation without changing the rendered frame. */
export function beginReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  eventTimeMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const rawStart = renderedRawExpansion(state);
  next.phase = 'tracking';
  next.epoch += 1;
  next.target = state.stableEndpoint;
  next.sourceEndpoint = state.stableEndpoint;
  next.rawExpansionProgress = rawStart;
  // During an elastic re-grab the shell and content intentionally have a tiny
  // offset. Keep it while tracking so DOWN preserves both images, not just the
  // shell top; subsequent MOVE changes both one-to-one.
  next.trackingExpansionOffset = state.expansionProgress - rawStart;
  next.velocityExpansionPerSecond = 0;
  next.elasticOffsetVp = 0;
  next.settleMode = 'none';
  next.settleElapsedMs = 0;
  next.settleDurationMs = 0;
  next.elasticElapsedMs = 0;
  next.elasticDurationMs = 0;
  next.elasticAmplitudeVp = 0;
  next.lastSampleTimeMs = safeTime(eventTimeMs, state.lastSampleTimeMs);
  next.lastSampleRawExpansion = rawStart;
  return next;
}

/** Track an absolute physical shell expansion. Upward velocity expands. */
export function updateReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  rawExpansionProgress: number,
  eventTimeMs: number,
  velocityYVpPerSecond: number = Number.NaN,
): ReaderAppearanceMotionState {
  if (state.phase !== 'tracking' || !Number.isFinite(rawExpansionProgress)) {
    return state;
  }
  const next = copyState(state);
  const sampleTime = safeTime(eventTimeMs, state.lastSampleTimeMs);
  const raw = clampRawExpansion(rawExpansionProgress);
  let velocity = state.velocityExpansionPerSecond;
  if (Number.isFinite(velocityYVpPerSecond)) {
    velocity = -velocityYVpPerSecond / READER_APPEARANCE_SHELL_TRAVEL_VP;
  } else {
    const deltaMs = sampleTime - state.lastSampleTimeMs;
    if (deltaMs > 0) {
      velocity = (raw - state.lastSampleRawExpansion) / (deltaMs / 1000);
    }
  }
  next.rawExpansionProgress = raw;
  next.expansionProgress = clamp01(raw + state.trackingExpansionOffset);
  next.velocityExpansionPerSecond = clampVelocity(velocity);
  next.lastSampleTimeMs = sampleTime;
  next.lastSampleRawExpansion = raw;
  return next;
}

function releaseTarget(
  expansion: number,
  expansionVelocity: number,
): ReaderAppearanceMotionEndpoint {
  const velocityY = -expansionVelocity * READER_APPEARANCE_SHELL_TRAVEL_VP;
  if (Math.abs(velocityY) >= READER_APPEARANCE_FLING_VELOCITY_VP_PER_SECOND) {
    return expansionVelocity >= 0 ? 'full' : 'quick';
  }
  const projected = clamp01(
    expansion + expansionVelocity * READER_APPEARANCE_RELEASE_PROJECTION_SECONDS,
  );
  return projected >= 0.5 ? 'full' : 'quick';
}

function gestureSettleDurationMs(
  profile: ReaderAppearanceMotionProfile,
  remainingDistance: number,
  velocityExpansionPerSecond: number,
  timeScale: number,
): number {
  const baseRemainingMs = profileDuration(profile) * clamp01(remainingDistance);
  const velocityFactor = 1 + 0.28 * Math.abs(velocityExpansionPerSecond);
  const unscaled = baseRemainingMs / velocityFactor;
  return Math.max(READER_APPEARANCE_SETTLE_MIN_MS, Math.min(profileDuration(profile), unscaled)) *
    timeScale;
}

function elasticAmplitudeVp(
  target: ReaderAppearanceMotionEndpoint,
  velocityYVpPerSecond: number,
): number {
  const magnitude = Math.min(
    READER_APPEARANCE_ELASTIC_MAX_VP,
    Math.abs(velocityYVpPerSecond) / 800 * READER_APPEARANCE_ELASTIC_MAX_VP,
  );
  return target === 'full' ? -magnitude : magnitude;
}

export function releaseReaderAppearanceTracking(
  state: ReaderAppearanceMotionState,
  velocityYVpPerSecond: number,
  eventTimeMs: number,
): ReaderAppearanceMotionState {
  if (state.phase !== 'tracking') {
    return state;
  }
  const explicitVelocity = Number.isFinite(velocityYVpPerSecond) ?
    -velocityYVpPerSecond / READER_APPEARANCE_SHELL_TRAVEL_VP :
    state.velocityExpansionPerSecond;
  const velocity = clampVelocity(explicitVelocity);
  const target = releaseTarget(state.expansionProgress, velocity);
  const targetExpansion = endpointExpansion(target);
  const remaining = Math.max(
    Math.abs(targetExpansion - state.expansionProgress),
    Math.abs(targetExpansion - state.rawExpansionProgress),
  );
  const next = copyState(state);
  next.epoch += 1;
  // A gesture release reverses the current authored trajectory; it does not
  // switch trees. N and O remain direction-specific clocks, not spatial keys.
  next.profile = state.profile;
  next.target = target;
  next.velocityExpansionPerSecond = velocity;
  next.lastSampleTimeMs = safeTime(eventTimeMs, state.lastSampleTimeMs);
  next.elasticOffsetVp = 0;
  next.trackingExpansionOffset = 0;
  if (next.reduceMotion) {
    return stateAtEndpoint(next, target, true);
  }
  if (remaining <= READER_APPEARANCE_ENDPOINT_EPSILON) {
    const amplitude = elasticAmplitudeVp(target, velocityYVpPerSecond);
    if (Math.abs(amplitude) <= 0.001) {
      return stateAtEndpoint(next, target, true);
    }
    next.phase = 'elastic';
    next.stableEndpoint = target;
    next.sourceEndpoint = target;
    next.expansionProgress = targetExpansion;
    next.rawExpansionProgress = targetExpansion;
    next.elasticElapsedMs = 0;
    next.elasticDurationMs = READER_APPEARANCE_ELASTIC_DURATION_MS * next.timeScale;
    next.elasticAmplitudeVp = amplitude;
    next.completionRevision += 1;
    return next;
  }
  const direction = targetExpansion >= state.expansionProgress ? 1 : -1;
  const towardTargetVelocity = velocity * direction > 0 ? velocity : 0;
  next.phase = 'settling';
  next.settleMode = 'gesture';
  next.settleStartExpansion = state.expansionProgress;
  next.settleStartRawExpansion = state.rawExpansionProgress;
  next.settleEndExpansion = targetExpansion;
  next.settleStartVelocity = towardTargetVelocity;
  next.settleElapsedMs = 0;
  next.settleDurationMs = gestureSettleDurationMs(
    next.profile,
    remaining,
    towardTargetVelocity,
    next.timeScale,
  );
  next.elasticElapsedMs = 0;
  next.elasticDurationMs = READER_APPEARANCE_ELASTIC_DURATION_MS * next.timeScale;
  next.elasticAmplitudeVp = elasticAmplitudeVp(target, velocityYVpPerSecond);
  return next;
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
  if (Math.abs(distance) <= READER_APPEARANCE_ENDPOINT_EPSILON) {
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

function programmaticClock(profile: ReaderAppearanceMotionProfile, progress: number): number {
  if (profile === 'collapseO') {
    return 1 - readerAppearanceExpansionFromTrajectory('collapseO', progress);
  }
  return readerAppearanceExpansionFromTrajectory('expandN', progress);
}

function advanceProgrammatic(
  state: ReaderAppearanceMotionState,
  elapsedMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const progress = state.settleDurationMs <= 0 ? 1 : clamp01(elapsedMs / state.settleDurationMs);
  const clock = programmaticClock(state.profile, progress);
  next.settleElapsedMs = elapsedMs;
  next.expansionProgress = state.settleStartExpansion +
    (state.settleEndExpansion - state.settleStartExpansion) * clock;
  next.rawExpansionProgress = state.settleStartRawExpansion +
    (state.settleEndExpansion - state.settleStartRawExpansion) * clock;
  return next;
}

function advanceGesture(
  state: ReaderAppearanceMotionState,
  elapsedMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const progress = state.settleDurationMs <= 0 ? 1 : clamp01(elapsedMs / state.settleDurationMs);
  next.settleElapsedMs = elapsedMs;
  next.expansionProgress = clamp01(monotoneHermite(
    state.settleStartExpansion,
    state.settleEndExpansion,
    state.settleStartVelocity,
    state.settleDurationMs,
    progress,
  ));
  next.rawExpansionProgress = clampRawExpansion(monotoneHermite(
    state.settleStartRawExpansion,
    state.settleEndExpansion,
    state.settleStartVelocity,
    state.settleDurationMs,
    progress,
  ));
  return next;
}

function enterElastic(
  state: ReaderAppearanceMotionState,
  endpoint: ReaderAppearanceMotionEndpoint,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const expansion = endpointExpansion(endpoint);
  next.phase = 'elastic';
  next.profile = profileAtEndpoint(endpoint);
  next.stableEndpoint = endpoint;
  next.sourceEndpoint = endpoint;
  next.expansionProgress = expansion;
  next.rawExpansionProgress = expansion;
  next.velocityExpansionPerSecond = 0;
  next.settleMode = 'none';
  next.elasticElapsedMs = 0;
  next.elasticOffsetVp = 0;
  next.completionRevision += 1;
  return next;
}

function advanceElastic(
  state: ReaderAppearanceMotionState,
  deltaMs: number,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  const elapsed = Math.min(state.elasticDurationMs, state.elasticElapsedMs + deltaMs);
  const progress = state.elasticDurationMs <= 0 ? 1 : clamp01(elapsed / state.elasticDurationMs);
  next.elasticElapsedMs = elapsed;
  next.elasticOffsetVp = state.elasticAmplitudeVp * Math.exp(-3 * progress) *
    Math.sin(2 * Math.PI * progress);
  if (progress >= 1) {
    const settled = stateAtEndpoint(next, state.target, false);
    settled.epoch = state.epoch;
    return settled;
  }
  return next;
}

/** Advance only the caller's captured epoch; stale VSync callbacks are inert. */
export function advanceReaderAppearanceMotion(
  state: ReaderAppearanceMotionState,
  deltaMs: number,
  expectedEpoch: number,
): ReaderAppearanceMotionAdvanceResult {
  if (expectedEpoch !== state.epoch) {
    return { state, shouldContinue: false, completedEndpoint: undefined };
  }
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  if (state.phase === 'elastic') {
    const nextElastic = advanceElastic(state, safeDelta);
    return {
      state: nextElastic,
      shouldContinue: nextElastic.phase === 'elastic',
      completedEndpoint: undefined,
    };
  }
  if (state.phase !== 'settling') {
    return { state, shouldContinue: false, completedEndpoint: undefined };
  }
  const elapsed = Math.min(state.settleDurationMs, state.settleElapsedMs + safeDelta);
  const next = state.settleMode === 'programmatic' ?
    advanceProgrammatic(state, elapsed) : advanceGesture(state, elapsed);
  if (elapsed < state.settleDurationMs) {
    return { state: next, shouldContinue: true, completedEndpoint: undefined };
  }
  if (state.settleMode === 'gesture' && Math.abs(state.elasticAmplitudeVp) > 0.001 &&
    state.elasticDurationMs > 0) {
    const elastic = enterElastic(next, state.target);
    return { state: elastic, shouldContinue: true, completedEndpoint: state.target };
  }
  const settled = stateAtEndpoint(next, state.target, true);
  settled.epoch = state.epoch;
  return { state: settled, shouldContinue: false, completedEndpoint: state.target };
}

/** CANCEL returns to the stable interaction source and never commits a route. */
export function cancelReaderAppearanceMotion(
  state: ReaderAppearanceMotionState,
): ReaderAppearanceMotionState {
  const next = copyState(state);
  next.epoch += 1;
  const cancelled = stateAtEndpoint(next, state.sourceEndpoint, false);
  cancelled.epoch = next.epoch;
  return cancelled;
}

export function readerAppearanceMotionIsActive(state: ReaderAppearanceMotionState): boolean {
  return state.phase === 'tracking' || state.phase === 'settling' || state.phase === 'elastic';
}

/**
 * Sample one visual tree. Raw overflow/rebound changes only the outer shell;
 * every child actor reads the same clamped `expansionProgress`.
 */
export function sampleReaderAppearanceMotionState(
  state: ReaderAppearanceMotionState,
): ReaderAppearanceMotionFrame {
  const frame = sampleReaderAppearanceExpansion(state.expansionProgress);
  const physicalHeight = READER_APPEARANCE_QUICK_HEIGHT +
    state.rawExpansionProgress * READER_APPEARANCE_SHELL_TRAVEL_VP - state.elasticOffsetVp;
  const shellHeight = Math.max(
    READER_APPEARANCE_QUICK_HEIGHT - READER_APPEARANCE_ELASTIC_MAX_VP,
    Math.min(READER_APPEARANCE_FULL_HEIGHT + READER_APPEARANCE_ELASTIC_MAX_VP, physicalHeight),
  );
  const shellTranslateY = READER_APPEARANCE_FULL_HEIGHT - shellHeight;
  frame.shellHeight = shellHeight;
  frame.shellTranslateY = shellTranslateY;
  frame.morphStage.x = 0;
  frame.morphStage.y = shellTranslateY;
  frame.morphStage.width = READER_APPEARANCE_STAGE_WIDTH;
  frame.morphStage.height = shellHeight;
  frame.morphStage.translateX = 0;
  frame.morphStage.translateY = 0;
  return frame;
}
