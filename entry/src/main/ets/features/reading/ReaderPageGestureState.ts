/**
 * Pure state for one manual page-turn gesture.
 *
 * This module deliberately owns no ArkUI gesture, page preparation, Core
 * command, or animation. It turns pointer samples into a drag/settle state and
 * emits at most one previous/next decision for each gesture generation.
 */
export type ReaderPageTurnDirection = 'previous' | 'next';

export type ReaderPageTapIntent = ReaderPageTurnDirection | 'control';

export type ReaderPageTurnOutcome =
  | { kind: 'started' }
  | { kind: 'busy' }
  | { kind: 'boundary'; edge: 'start' | 'end' }
  | { kind: 'blocked'; reason: 'overlay' | 'control' | 'lifecycle' };

export type ReaderPageGesturePhase = 'idle' | 'tracking' | 'dragging' | 'settling';

export type ReaderPageGestureAxis = 'undecided' | 'horizontal' | 'vertical';

export type ReaderPageGestureSettleTarget = 'commit' | 'rollback';

export type ReaderPageGestureState = {
  phase: ReaderPageGesturePhase;
  /** Compatibility view for callers which predate the explicit phase. */
  active: boolean;
  /** True after commit/rollback has been decided, preventing a second decision. */
  consumed: boolean;
  /** Direction locked when this pointer stream first becomes a page drag. */
  direction: ReaderPageTurnDirection | undefined;
  /** Direction represented by the latest total horizontal displacement. */
  currentDirection: ReaderPageTurnDirection | undefined;
  axis: ReaderPageGestureAxis;
  viewportWidth: number;
  currentOffsetX: number;
  currentOffsetY: number;
  lastOffsetX: number;
  lastOffsetY: number;
  velocityX: number;
  velocityY: number;
  /** Platform touch-event clock for the latest physical sample, in milliseconds. */
  eventTimeMs: number;
  /** Physical pointer origin/current position in the page-local vp space. */
  startLocalX: number;
  startLocalY: number;
  currentLocalX: number;
  currentLocalY: number;
  /** Visible sheet-transfer progress while the finger is down, capped at 0...0.75. */
  progress: number;
  settleTarget: ReaderPageGestureSettleTarget | undefined;
  /** Compatibility field; derived from total displacement, never the last delta. */
  reversed: boolean;
};

export type ReaderPageGestureDecision = {
  state: ReaderPageGestureState;
  direction: ReaderPageTurnDirection | undefined;
};

/**
 * Native page-curl coordinates derived from one raw pointer stream.
 *
 * DOWN and MOVE remain physical pointer samples. Native derives a stable
 * free-edge grip at the DOWN height and applies the exact physical
 * DOWN-to-MOVE displacement to that grip; commit distance remains physical.
 */
export type ReaderPageCurlGestureProjection = {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
};

/** Admit an intentional horizontal drag before it can feel detached on device. */
export const READER_PAGE_GESTURE_TOUCH_SLOP = 8;
/**
 * A paged reading surface has no competing vertical scroll. Give a slightly
 * diagonal finger path horizontal priority instead of permanently rejecting
 * it on the first noisy MOVE sample.
 */
export const READER_PAGE_GESTURE_HORIZONTAL_BIAS = 0.9;
/** The final quarter belongs to release settlement, never to raw finger drag. */
export const READER_PAGE_GESTURE_MAX_DRAG_RATIO = 0.75;
export const READER_PAGE_GESTURE_COMMIT_RATIO = 0.28;
export const READER_PAGE_GESTURE_FLICK_MIN_RATIO = 0.08;
export const READER_PAGE_GESTURE_FLICK_VELOCITY = 900;

const LEGACY_READER_PAGE_VIEWPORT_WIDTH =
  READER_PAGE_GESTURE_TOUCH_SLOP / READER_PAGE_GESTURE_COMMIT_RATIO;

export function createReaderPageGestureState(): ReaderPageGestureState {
  return idleReaderPageGestureState(false);
}

/** Begin a gesture using the measured live viewport width. */
export function beginReaderPageGesture(
  viewportWidth: number,
  offsetX: number = 0,
  offsetY: number = 0,
  localX: number = 0,
  localY: number = 0,
  eventTimeMs: number = 0,
): ReaderPageGestureState {
  const state = trackingReaderPageGestureState(viewportWidth, localX, localY, eventTimeMs);
  return applyReaderPageGestureSample(state, offsetX, offsetY, 0, localX, localY, 0, eventTimeMs);
}

/** Apply one pointer sample without making a page-turn decision. */
export function moveReaderPageGesture(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
  localX: number = state.startLocalX + offsetX,
  localY: number = state.startLocalY + offsetY,
  velocityY: number = state.velocityY,
  eventTimeMs: number = state.eventTimeMs,
): ReaderPageGestureState {
  if (!state.active || state.consumed) {
    return state;
  }
  return applyReaderPageGestureSample(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
}

/**
 * Decide whether the drag settles to the adjacent page or rolls back.
 * Distance and velocity are both based on the total displacement from DOWN.
 */
export function settleReaderPageGesture(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
  localX: number = state.startLocalX + offsetX,
  localY: number = state.startLocalY + offsetY,
  velocityY: number = state.velocityY,
  eventTimeMs: number = state.eventTimeMs,
): ReaderPageGestureDecision {
  if (!state.active || state.consumed) {
    return {
      state,
      direction: undefined,
    };
  }

  const sampled = moveReaderPageGesture(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
  const direction = shouldCommitReaderPageGesture(sampled) ? sampled.direction : undefined;
  return {
    state: settlingReaderPageGestureState(sampled, direction === undefined ? 'rollback' : 'commit'),
    direction,
  };
}

/** Finish the visual settle and make the reducer ready for a new gesture. */
export function completeReaderPageGestureSettlement(
  state: ReaderPageGestureState,
): ReaderPageGestureState {
  if (state.phase !== 'settling') {
    return state;
  }
  return idleReaderPageGestureState(false);
}

/**
 * Replace the Host's preliminary release decision with the Native curl
 * engine's authoritative commit/rollback result. Keeping this reducer in the
 * pure state module avoids ArkTS object spreading inside the UI component.
 */
export function retargetReaderPageGestureSettlement(
  state: ReaderPageGestureState,
  target: ReaderPageGestureSettleTarget,
): ReaderPageGestureState {
  return settlingReaderPageGestureState(state, target);
}

/** A tap, long press, or vertical gesture leaves page-turn tracking directly. */
export function abandonReaderPageGestureTracking(
  state: ReaderPageGestureState,
): ReaderPageGestureState {
  if (state.phase !== 'tracking') {
    return state;
  }
  return idleReaderPageGestureState(false);
}

export function projectReaderPageCurlGesture(
  state: ReaderPageGestureState,
  viewportHeight: number,
): ReaderPageCurlGestureProjection | undefined {
  if (state.direction === undefined || state.viewportWidth <= 0 ||
    !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return undefined;
  }
  const originX = clampReaderPageCoordinate(state.startLocalX / state.viewportWidth, 0, 1);
  const originY = clampReaderPageCoordinate(state.startLocalY / viewportHeight, 0, 1);
  return {
    originX,
    originY,
    currentX: clampReaderPageCoordinate(
      state.currentLocalX / state.viewportWidth,
      -0.25,
      1.25,
    ),
    currentY: clampReaderPageCoordinate(
      state.currentLocalY / viewportHeight,
      -0.15,
      1.15,
    ),
  };
}

/**
 * Compatibility wrapper for the existing InteractionLayer call shape.
 * New code should pass the measured viewport width as the second argument or
 * call beginReaderPageGesture directly.
 */
export function startReaderPagePan(
  offsetX: number = 0,
  viewportWidth: number = LEGACY_READER_PAGE_VIEWPORT_WIDTH,
  offsetY: number = 0,
  localX: number = 0,
  localY: number = 0,
  eventTimeMs: number = 0,
): ReaderPageGestureState {
  return beginReaderPageGesture(viewportWidth, offsetX, offsetY, localX, localY, eventTimeMs);
}

/** Compatibility wrapper; supports vertical displacement and release speed. */
export function updateReaderPagePan(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
  localX: number = state.startLocalX + offsetX,
  localY: number = state.startLocalY + offsetY,
  velocityY: number = state.velocityY,
  eventTimeMs: number = state.eventTimeMs,
): ReaderPageGestureState {
  return moveReaderPageGesture(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
}

export function readerPageTapIntent(
  localX: number,
  viewportWidth: number,
): ReaderPageTapIntent | undefined {
  if (!Number.isFinite(localX) || !Number.isFinite(viewportWidth) || viewportWidth <= 0 ||
    localX < 0 || localX > viewportWidth) {
    return undefined;
  }
  if (localX < viewportWidth / 3) {
    return 'previous';
  }
  if (localX > viewportWidth * 2 / 3) {
    return 'next';
  }
  return 'control';
}

/** Compatibility wrapper for settleReaderPageGesture. */
export function finishReaderPagePan(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
  localX: number = state.startLocalX + offsetX,
  localY: number = state.startLocalY + offsetY,
  velocityY: number = state.velocityY,
  eventTimeMs: number = state.eventTimeMs,
): ReaderPageGestureDecision {
  return settleReaderPageGesture(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
}

/** A system cancellation may visually roll back, but can never commit. */
export function cancelReaderPagePan(state: ReaderPageGestureState): ReaderPageGestureState {
  if (!state.active || state.consumed) {
    return state;
  }
  return settlingReaderPageGestureState(state, 'rollback');
}

function shouldCommitReaderPageGesture(state: ReaderPageGestureState): boolean {
  if (state.phase !== 'dragging' || state.axis !== 'horizontal' ||
    state.direction === undefined || state.currentDirection !== state.direction ||
    state.viewportWidth <= 0) {
    return false;
  }

  const distance = Math.abs(state.currentOffsetX);
  const distanceCommit = readerPageGestureMeetsRatio(
    distance,
    state.viewportWidth,
    READER_PAGE_GESTURE_COMMIT_RATIO,
  );
  const velocityDirection = directionForOffset(state.velocityX);
  const flickCommit = readerPageGestureMeetsRatio(
    distance,
    state.viewportWidth,
    READER_PAGE_GESTURE_FLICK_MIN_RATIO,
  ) &&
    Math.abs(state.velocityX) >= READER_PAGE_GESTURE_FLICK_VELOCITY &&
    velocityDirection === state.direction;
  return distanceCommit || flickCommit;
}

function applyReaderPageGestureSample(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number,
  velocityX: number,
  localX: number,
  localY: number,
  velocityY: number,
  eventTimeMs: number,
): ReaderPageGestureState {
  if (!Number.isFinite(offsetX)) {
    return state;
  }

  const normalizedOffsetY = Number.isFinite(offsetY) ? offsetY : state.currentOffsetY;
  const normalizedVelocityX = Number.isFinite(velocityX) ? velocityX : state.velocityX;
  const normalizedVelocityY = Number.isFinite(velocityY) ? velocityY : state.velocityY;
  const normalizedEventTimeMs = Number.isFinite(eventTimeMs) && eventTimeMs >= 0 ?
    eventTimeMs : state.eventTimeMs;
  let phase = state.phase;
  let axis = state.axis;
  let direction = state.direction;
  const absoluteX = Math.abs(offsetX);
  const absoluteY = Math.abs(normalizedOffsetY);

  if (axis === 'undecided') {
    const horizontalIntent = absoluteX >= READER_PAGE_GESTURE_TOUCH_SLOP &&
      absoluteX >= absoluteY * READER_PAGE_GESTURE_HORIZONTAL_BIAS;
    if (horizontalIntent) {
      axis = 'horizontal';
      direction = directionForOffset(offsetX);
      phase = direction === undefined ? 'tracking' : 'dragging';
    } else if (absoluteY >= READER_PAGE_GESTURE_TOUCH_SLOP) {
      // A vertical-first pickup in the left/right page zones is a valid paper
      // lift. It selects the sheet from the DOWN position, while a centre
      // vertical gesture remains outside page-turn ownership.
      const sideDirection = readerPageSideDragDirection(state.startLocalX, state.viewportWidth);
      if (sideDirection !== undefined) {
        axis = 'horizontal';
        direction = sideDirection;
        phase = 'dragging';
      } else {
        axis = 'vertical';
        phase = 'tracking';
      }
    }
  }

  const currentDirection = directionForOffset(offsetX);
  const reversed = direction !== undefined && currentDirection !== undefined &&
    currentDirection !== direction;
  return {
    phase,
    active: phase === 'tracking' || phase === 'dragging',
    consumed: false,
    direction,
    currentDirection,
    axis,
    viewportWidth: state.viewportWidth,
    currentOffsetX: offsetX,
    currentOffsetY: normalizedOffsetY,
    lastOffsetX: state.currentOffsetX,
    lastOffsetY: state.currentOffsetY,
    velocityX: normalizedVelocityX,
    velocityY: normalizedVelocityY,
    eventTimeMs: normalizedEventTimeMs,
    startLocalX: state.startLocalX,
    startLocalY: state.startLocalY,
    currentLocalX: Number.isFinite(localX) ? localX : state.currentLocalX,
    currentLocalY: Number.isFinite(localY) ? localY : state.currentLocalY,
    progress: readerPageGestureProgress(offsetX, state.viewportWidth),
    settleTarget: undefined,
    reversed,
  };
}

function idleReaderPageGestureState(consumed: boolean): ReaderPageGestureState {
  return {
    phase: 'idle',
    active: false,
    consumed,
    direction: undefined,
    currentDirection: undefined,
    axis: 'undecided',
    viewportWidth: 0,
    currentOffsetX: 0,
    currentOffsetY: 0,
    lastOffsetX: 0,
    lastOffsetY: 0,
    velocityX: 0,
    velocityY: 0,
    eventTimeMs: 0,
    startLocalX: 0,
    startLocalY: 0,
    currentLocalX: 0,
    currentLocalY: 0,
    progress: 0,
    settleTarget: undefined,
    reversed: false,
  };
}

function trackingReaderPageGestureState(
  viewportWidth: number,
  localX: number,
  localY: number,
  eventTimeMs: number,
): ReaderPageGestureState {
  const state = idleReaderPageGestureState(false);
  return {
    ...state,
    phase: 'tracking',
    active: true,
    viewportWidth: finitePositive(viewportWidth),
    startLocalX: Number.isFinite(localX) ? localX : 0,
    startLocalY: Number.isFinite(localY) ? localY : 0,
    currentLocalX: Number.isFinite(localX) ? localX : 0,
    currentLocalY: Number.isFinite(localY) ? localY : 0,
    eventTimeMs: Number.isFinite(eventTimeMs) && eventTimeMs >= 0 ? eventTimeMs : 0,
  };
}

function settlingReaderPageGestureState(
  state: ReaderPageGestureState,
  settleTarget: ReaderPageGestureSettleTarget,
): ReaderPageGestureState {
  return {
    ...state,
    phase: 'settling',
    active: false,
    consumed: true,
    settleTarget,
  };
}

function readerPageGestureProgress(offsetX: number, viewportWidth: number): number {
  if (viewportWidth <= 0) {
    return 0;
  }
  return Math.min(READER_PAGE_GESTURE_MAX_DRAG_RATIO, Math.abs(offsetX) / viewportWidth);
}

function readerPageGestureMeetsRatio(distance: number, viewportWidth: number, ratio: number): boolean {
  return distance / viewportWidth + 0.000001 >= ratio;
}

function directionForOffset(offsetX: number): ReaderPageTurnDirection | undefined {
  if (offsetX < 0) {
    return 'next';
  }
  if (offsetX > 0) {
    return 'previous';
  }
  return undefined;
}

function readerPageSideDragDirection(
  localX: number,
  viewportWidth: number,
): ReaderPageTurnDirection | undefined {
  const intent = readerPageTapIntent(localX, viewportWidth);
  return intent === 'previous' || intent === 'next' ? intent : undefined;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampReaderPageCoordinate(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return (minimum + maximum) / 2;
  }
  return Math.max(minimum, Math.min(maximum, value));
}
