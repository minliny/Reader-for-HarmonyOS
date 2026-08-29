import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

/** Frozen product constants from BOOK_PAGE_TURN_CONTRACT_V1. */
export const BOOK_TURN_EDGE_BAND_VP = 12;
export const BOOK_TURN_HORIZONTAL_START_VP = 8;
export const BOOK_TURN_VERTICAL_PREVIOUS_START_VP = 24;
export const BOOK_TURN_CATCH_SPEED_VIEWPORTS_PER_SECOND = 5;
export const BOOK_TURN_CATCH_NEAR_MAX_VP = 48;
export const BOOK_TURN_CATCH_NEAR_VIEWPORT_RATIO = 0.12;
export const BOOK_TURN_CATCH_LOCK_VP = 4;

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
  edgeX: number;
  edgeY: number;
  pointerVelocityX: number;
  eventTimeMs: number;
};

/**
 * Presentation-only motion state created after the shared input arena grants
 * page ownership. It neither chooses a page nor owns a business transaction.
 * The live path mutates this one object so MOVE does not allocate.
 */
export type BookTurnMotionState = BookTurnInput & {
  active: boolean;
  sourceX: number;
  edgeOrigin: boolean;
  lastPointerX: number;
  lastEventTimeMs: number;
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
  const edgeOrigin = Math.abs(normalizedStartX - sourceX) <= BOOK_TURN_EDGE_BAND_VP;
  const state: BookTurnMotionState = {
    active: true,
    generation,
    direction,
    verticalPrevious,
    viewportWidth: width,
    viewportHeight: height,
    startX: normalizedStartX,
    startY: normalizedStartY,
    pointerX: normalizedPointerX,
    pointerY: normalizedPointerY,
    edgeX: sourceX,
    edgeY: normalizedPointerY,
    pointerVelocityX: 0,
    eventTimeMs: normalizedTime,
    sourceX,
    edgeOrigin,
    lastPointerX: normalizedStartX,
    lastEventTimeMs: normalizedTime,
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
  const time = finiteTime(eventTimeMs, state.eventTimeMs);
  const elapsedSeconds = Math.max(0, time - state.lastEventTimeMs) / 1000;
  const velocityX = elapsedSeconds > 0 ? (pointerX - state.lastPointerX) / elapsedSeconds : 0;
  const followX = bookTurnFollowX(state, pointerX, pointerY);

  state.pointerX = pointerX;
  state.pointerY = pointerY;
  state.pointerVelocityX = Number.isFinite(velocityX) ? velocityX : 0;
  state.eventTimeMs = time;
  state.edgeY = pointerY;

  const lockedProgress = state.verticalPrevious ?
    Math.max(0, state.startY - pointerY) >= BOOK_TURN_VERTICAL_PREVIOUS_START_VP :
    Math.max(0, directionSign(state.direction) * (pointerX - state.startX)) >=
      BOOK_TURN_HORIZONTAL_START_VP;
  if (state.edgeOrigin && lockedProgress) {
    state.edgeX = followX;
  } else {
    state.edgeX = chaseBookTurnEdge(
      state.edgeX,
      followX,
      state.direction,
      state.pointerVelocityX,
      elapsedSeconds,
      state.viewportWidth,
    );
  }
  state.lastPointerX = pointerX;
  state.lastEventTimeMs = time;
  return state;
}

export function stopBookTurnMotion(state: BookTurnMotionState): BookTurnMotionState {
  state.active = false;
  return state;
}

export function bookTurnInput(state: BookTurnMotionState): BookTurnInput {
  return state;
}

export function bookTurnFollowX(
  state: BookTurnMotionState,
  pointerX: number = state.pointerX,
  pointerY: number = state.pointerY,
): number {
  if (state.verticalPrevious) {
    const upward = Math.max(0, state.startY - pointerY);
    const gate = smoothstep(0, BOOK_TURN_VERTICAL_PREVIOUS_START_VP, upward);
    return clamp(gate * pointerX, 0, state.viewportWidth);
  }
  const displacement = pointerX - state.startX;
  const progress = Math.max(0, directionSign(state.direction) * displacement);
  const gate = smoothstep(0, BOOK_TURN_HORIZONTAL_START_VP, progress);
  return clamp(state.sourceX + gate * (pointerX - state.sourceX), 0, state.viewportWidth);
}

export function bookTurnCatchNearDistance(viewportWidth: number): number {
  return Math.min(BOOK_TURN_CATCH_NEAR_MAX_VP,
    finitePositive(viewportWidth) * BOOK_TURN_CATCH_NEAR_VIEWPORT_RATIO);
}

function chaseBookTurnEdge(
  edgeX: number,
  followX: number,
  direction: ReaderPageTurnDirection,
  pointerVelocityX: number,
  elapsedSeconds: number,
  viewportWidth: number,
): number {
  if (elapsedSeconds <= 0) return edgeX;
  const inwardSign = direction === 'next' ? -1 : 1;
  const edgeProgress = inwardSign * (edgeX - (direction === 'next' ? viewportWidth : 0));
  const targetProgress = inwardSign * (followX - (direction === 'next' ? viewportWidth : 0));
  const gap = targetProgress - edgeProgress;
  const gapMagnitude = Math.abs(gap);
  if (gapMagnitude <= BOOK_TURN_CATCH_LOCK_VP) return followX;

  const near = Math.max(BOOK_TURN_CATCH_LOCK_VP, bookTurnCatchNearDistance(viewportWidth));
  const fast = BOOK_TURN_CATCH_SPEED_VIEWPORTS_PER_SECOND * viewportWidth * Math.sign(gap);
  const fingerInwardVelocity = inwardSign * pointerVelocityX;
  const k = gapMagnitude > near ? 1 : gapMagnitude / near;
  const edgeVelocity = gapMagnitude > near ? fast :
    fingerInwardVelocity + k * (fast - fingerInwardVelocity);
  let step = edgeVelocity * elapsedSeconds;
  if (Math.sign(step) !== Math.sign(gap) && gapMagnitude > BOOK_TURN_CATCH_LOCK_VP) {
    // A reversing finger may request a negative target velocity. It must not
    // create a new lag while the edge is still on the other side of target.
    step = 0;
  }
  if (Math.abs(step) >= gapMagnitude) return followX;
  const nextProgress = edgeProgress + step;
  const source = direction === 'next' ? viewportWidth : 0;
  return clamp(source + inwardSign * nextProgress, 0, viewportWidth);
}

function directionSign(direction: ReaderPageTurnDirection): number {
  return direction === 'next' ? -1 : 1;
}

function smoothstep(low: number, high: number, value: number): number {
  if (high <= low) return value >= high ? 1 : 0;
  const ratio = clamp((value - low) / (high - low), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
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
