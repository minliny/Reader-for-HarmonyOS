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
  /** Direction locked when horizontal motion first wins the touch slop. */
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
  /** Absolute horizontal drag progress in the range 0...1. */
  progress: number;
  settleTarget: ReaderPageGestureSettleTarget | undefined;
  /** Compatibility field; derived from total displacement, never the last delta. */
  reversed: boolean;
};

export type ReaderPageGestureDecision = {
  state: ReaderPageGestureState;
  direction: ReaderPageTurnDirection | undefined;
};

export const READER_PAGE_GESTURE_TOUCH_SLOP = 12;
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
): ReaderPageGestureState {
  const state = trackingReaderPageGestureState(viewportWidth);
  return applyReaderPageGestureSample(state, offsetX, offsetY, 0);
}

/** Apply one pointer sample without making a page-turn decision. */
export function moveReaderPageGesture(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
): ReaderPageGestureState {
  if (!state.active || state.consumed) {
    return state;
  }
  return applyReaderPageGestureSample(state, offsetX, offsetY, velocityX);
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
): ReaderPageGestureDecision {
  if (!state.active || state.consumed) {
    return {
      state,
      direction: undefined,
    };
  }

  const sampled = moveReaderPageGesture(state, offsetX, offsetY, velocityX);
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
 * Compatibility wrapper for the existing InteractionLayer call shape.
 * New code should pass the measured viewport width as the second argument or
 * call beginReaderPageGesture directly.
 */
export function startReaderPagePan(
  offsetX: number = 0,
  viewportWidth: number = LEGACY_READER_PAGE_VIEWPORT_WIDTH,
  offsetY: number = 0,
): ReaderPageGestureState {
  return beginReaderPageGesture(viewportWidth, offsetX, offsetY);
}

/** Compatibility wrapper; supports vertical displacement and release speed. */
export function updateReaderPagePan(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
): ReaderPageGestureState {
  return moveReaderPageGesture(state, offsetX, offsetY, velocityX);
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
): ReaderPageGestureDecision {
  return settleReaderPageGesture(state, offsetX, offsetY, velocityX);
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
): ReaderPageGestureState {
  if (!Number.isFinite(offsetX)) {
    return state;
  }

  const normalizedOffsetY = Number.isFinite(offsetY) ? offsetY : state.currentOffsetY;
  const normalizedVelocityX = Number.isFinite(velocityX) ? velocityX : state.velocityX;
  let phase = state.phase;
  let axis = state.axis;
  let direction = state.direction;
  const absoluteX = Math.abs(offsetX);
  const absoluteY = Math.abs(normalizedOffsetY);

  if (axis === 'undecided' && Math.max(absoluteX, absoluteY) >= READER_PAGE_GESTURE_TOUCH_SLOP) {
    if (absoluteX > absoluteY) {
      axis = 'horizontal';
      direction = directionForOffset(offsetX);
      phase = direction === undefined ? 'tracking' : 'dragging';
    } else {
      axis = 'vertical';
      phase = 'tracking';
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
    progress: 0,
    settleTarget: undefined,
    reversed: false,
  };
}

function trackingReaderPageGestureState(viewportWidth: number): ReaderPageGestureState {
  const state = idleReaderPageGestureState(false);
  return {
    ...state,
    phase: 'tracking',
    active: true,
    viewportWidth: finitePositive(viewportWidth),
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
  return Math.min(1, Math.abs(offsetX) / viewportWidth);
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

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
