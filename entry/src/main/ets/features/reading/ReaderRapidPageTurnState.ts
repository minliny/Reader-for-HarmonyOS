import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

/**
 * Pure dynamic target for manual rapid page turns.
 *
 * `pendingDelta` includes the admitted in-flight turn until that turn reaches
 * its visible/persisted completion barrier.  The state therefore stores one
 * integer regardless of how far the user keeps paging; it never allocates an
 * animation or pagination work queue.
 */
export type ReaderRapidPageTurnState = {
  generation: number;
  pendingDelta: number;
  inFlightDirection: ReaderPageTurnDirection | undefined;
  retryCount: number;
  controlRequested: boolean;
};

/** Bounds a broken single-page transaction without limiting the rapid target. */
export const READER_RAPID_PAGE_TURN_RETRY_LIMIT: number = 3;

export function createReaderRapidPageTurnState(): ReaderRapidPageTurnState {
  return {
    generation: 0,
    pendingDelta: 0,
    inFlightDirection: undefined,
    retryCount: 0,
    controlRequested: false,
  };
}

/** Same-direction requests accumulate; opposite requests cancel the net target. */
export function enqueueReaderRapidPageTurn(
  state: ReaderRapidPageTurnState,
  direction: ReaderPageTurnDirection,
): ReaderRapidPageTurnState {
  if (state.controlRequested) return state;
  const step = directionStep(direction);
  const pendingDelta = safeAdd(state.pendingDelta, step);
  if (pendingDelta === state.pendingDelta) return state;
  const oldDirection = readerRapidPageTurnDirection(state);
  const newDirection = directionFromDelta(pendingDelta);
  const retryCount = state.inFlightDirection === undefined && oldDirection !== newDirection ?
    0 : state.retryCount;
  return copyState(state, pendingDelta, state.inFlightDirection, retryCount, false, state.generation);
}

/** Marks the one visual/Core transaction currently consuming the dynamic target. */
export function beginReaderRapidPageTurn(
  state: ReaderRapidPageTurnState,
  direction: ReaderPageTurnDirection,
): ReaderRapidPageTurnState {
  if (state.inFlightDirection !== undefined || readerRapidPageTurnDirection(state) !== direction) {
    return state;
  }
  return copyState(state, state.pendingDelta, direction, state.retryCount,
    state.controlRequested, state.generation);
}

/** Consumes exactly one request only after its page became visible and committed. */
export function completeReaderRapidPageTurn(
  state: ReaderRapidPageTurnState,
  direction: ReaderPageTurnDirection,
): ReaderRapidPageTurnState {
  if (state.inFlightDirection !== direction) return state;
  const pendingDelta = safeAdd(state.pendingDelta, -directionStep(direction));
  return copyState(state, pendingDelta, undefined, 0, state.controlRequested, state.generation);
}

/** A failed transaction changed no page, so retain the target and release only its active owner. */
export function retryReaderRapidPageTurn(
  state: ReaderRapidPageTurnState,
  direction: ReaderPageTurnDirection,
): ReaderRapidPageTurnState {
  if (state.inFlightDirection !== direction) return state;
  return copyState(state, state.pendingDelta, undefined,
    Math.min(READER_RAPID_PAGE_TURN_RETRY_LIMIT, state.retryCount + 1),
    state.controlRequested, state.generation);
}

/** Clears only requests which point through the reached physical book boundary. */
export function reachReaderRapidPageBoundary(
  state: ReaderRapidPageTurnState,
  direction: ReaderPageTurnDirection,
): ReaderRapidPageTurnState {
  const impossible = direction === 'next' ? state.pendingDelta > 0 : state.pendingDelta < 0;
  return copyState(
    state,
    impossible ? 0 : state.pendingDelta,
    state.inFlightDirection === direction ? undefined : state.inFlightDirection,
    state.inFlightDirection === direction ? 0 : state.retryCount,
    state.controlRequested,
    state.generation,
  );
}

/**
 * Centre control wins over unexecuted page requests.  If one non-interruptible
 * turn is already active, retain exactly that unit until its completion so the
 * normal consume step lands on zero rather than creating a reverse request.
 */
export function requestReaderRapidPageControl(
  state: ReaderRapidPageTurnState,
): ReaderRapidPageTurnState {
  const pendingDelta = state.inFlightDirection === undefined ? 0 : directionStep(state.inFlightDirection);
  return copyState(state, pendingDelta, state.inFlightDirection, state.retryCount, true, state.generation);
}

/** Invalidates every delayed callback after lifecycle, layout, source, or explicit navigation change. */
export function cancelReaderRapidPageTurn(state: ReaderRapidPageTurnState): ReaderRapidPageTurnState {
  return copyState(state, 0, undefined, 0, false, nextGeneration(state.generation));
}

export function readerRapidPageTurnDirection(
  state: ReaderRapidPageTurnState,
): ReaderPageTurnDirection | undefined {
  return directionFromDelta(state.pendingDelta);
}

export function readerRapidPageTurnHasWork(state: ReaderRapidPageTurnState): boolean {
  return state.pendingDelta !== 0 || state.inFlightDirection !== undefined || state.controlRequested;
}

export function readerRapidPageTurnRetryExhausted(state: ReaderRapidPageTurnState): boolean {
  return state.retryCount >= READER_RAPID_PAGE_TURN_RETRY_LIMIT;
}

function directionStep(direction: ReaderPageTurnDirection): number {
  return direction === 'next' ? 1 : -1;
}

function directionFromDelta(delta: number): ReaderPageTurnDirection | undefined {
  if (delta > 0) return 'next';
  if (delta < 0) return 'previous';
  return undefined;
}

function safeAdd(value: number, delta: number): number {
  if (delta > 0 && value >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  if (delta < 0 && value <= Number.MIN_SAFE_INTEGER) return Number.MIN_SAFE_INTEGER;
  return value + delta;
}

function nextGeneration(generation: number): number {
  return generation >= Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
}

function copyState(
  state: ReaderRapidPageTurnState,
  pendingDelta: number,
  inFlightDirection: ReaderPageTurnDirection | undefined,
  retryCount: number,
  controlRequested: boolean,
  generation: number,
): ReaderRapidPageTurnState {
  if (pendingDelta === state.pendingDelta && inFlightDirection === state.inFlightDirection &&
    retryCount === state.retryCount && controlRequested === state.controlRequested &&
    generation === state.generation) {
    return state;
  }
  return { generation, pendingDelta, inFlightDirection, retryCount, controlRequested };
}
