import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

/**
 * Raw gesture sample handed to the native bookturn host (contract V2 §5.3).
 * The chased edge lives in native state and advances on VSync frame
 * callbacks, so ArkTS carries no edge/velocity semantics anymore.
 */
export type BookTurnInput = {
  generation: number;
  direction: ReaderPageTurnDirection;
  verticalPrevious: boolean;
  viewportWidth: number;
  viewportHeight: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
  eventTimeMs: number;
};

/**
 * Presentation-only mailbox record created after the shared input arena
 * grants page ownership. It neither chooses a page nor owns a business
 * transaction. The live path mutates this one object so MOVE does not
 * allocate; only the newest sample is kept.
 */
export type BookTurnMotionState = BookTurnInput & {
  active: boolean;
};

export function beginBookTurnMotion(
  generation: number,
  direction: ReaderPageTurnDirection,
  verticalPrevious: boolean,
  viewportWidth: number,
  viewportHeight: number,
  startX: number,
  startY: number,
  pointerX: number,
  pointerY: number,
  eventTimeMs: number,
): BookTurnMotionState {
  const width = finitePositive(viewportWidth);
  const height = finitePositive(viewportHeight);
  const sourceX = direction === 'next' ? width : 0;
  const normalizedStartX = finiteCoordinate(startX, sourceX);
  const normalizedStartY = finiteCoordinate(startY, 0);
  const normalizedPointerX = finiteCoordinate(pointerX, normalizedStartX);
  const normalizedPointerY = finiteCoordinate(pointerY, normalizedStartY);
  const normalizedTime = finiteTime(eventTimeMs);
  const state: BookTurnMotionState = {
    active: true,
    generation,
    direction,
    verticalPrevious,
    viewportWidth: width,
    viewportHeight: height,
    startX: normalizedStartX,
    startY: normalizedStartY,
    pointerX: 0,
    pointerY: 0,
    eventTimeMs: 0,
  };
  return updateBookTurnMotionInPlace(state, normalizedPointerX, normalizedPointerY, normalizedTime);
}

/** Consume the newest physical sample directly; no EMA, spring, or replay queue. */
export function updateBookTurnMotionInPlace(
  state: BookTurnMotionState,
  pointerX: number,
  pointerY: number,
  eventTimeMs: number,
): BookTurnMotionState {
  if (!state.active || state.viewportWidth <= 0 || state.viewportHeight <= 0 ||
    !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return state;
  }
  state.pointerX = pointerX;
  state.pointerY = pointerY;
  state.eventTimeMs = finiteTime(eventTimeMs, state.eventTimeMs);
  return state;
}

export function stopBookTurnMotion(state: BookTurnMotionState): BookTurnMotionState {
  state.active = false;
  return state;
}

export function bookTurnInput(state: BookTurnMotionState): BookTurnInput {
  return state;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function finiteCoordinate(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function finiteTime(value: number, fallback: number = 0): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
