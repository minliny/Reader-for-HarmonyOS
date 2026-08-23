/**
 * Pure state for one manual page-turn pan.
 *
 * This module deliberately owns no ArkUI gesture, pagination request, Core
 * command, or animation. It only turns a completed horizontal pan into at
 * most one previous/next intent.
 */
export type ReaderPageTurnDirection = 'previous' | 'next';

export type ReaderPageTapIntent = ReaderPageTurnDirection | 'control';

export type ReaderPageTurnOutcome =
  | { kind: 'started' }
  | { kind: 'busy' }
  | { kind: 'boundary'; edge: 'start' | 'end' }
  | { kind: 'blocked'; reason: 'overlay' | 'control' | 'lifecycle' };

export type ReaderPageGestureState = {
  active: boolean;
  consumed: boolean;
  direction: ReaderPageTurnDirection | undefined;
  currentOffsetX: number;
  lastOffsetX: number;
  reversed: boolean;
};

export type ReaderPageGestureDecision = {
  state: ReaderPageGestureState;
  direction: ReaderPageTurnDirection | undefined;
};

export function createReaderPageGestureState(): ReaderPageGestureState {
  return idleReaderPageGestureState(false);
}

export function startReaderPagePan(offsetX: number = 0): ReaderPageGestureState {
  const normalizedOffset = finiteOffset(offsetX);
  return {
    active: true,
    consumed: false,
    direction: directionForOffset(normalizedOffset),
    currentOffsetX: normalizedOffset,
    lastOffsetX: normalizedOffset,
    reversed: false,
  };
}

export function updateReaderPagePan(
  state: ReaderPageGestureState,
  offsetX: number,
): ReaderPageGestureState {
  if (!state.active || state.consumed || !Number.isFinite(offsetX)) {
    return state;
  }
  const direction = state.direction === undefined ? directionForOffset(offsetX) : state.direction;
  let reversed = state.reversed;
  if (offsetX !== state.lastOffsetX) {
    reversed = direction === 'next' ? offsetX > state.lastOffsetX : offsetX < state.lastOffsetX;
  }
  return {
    active: true,
    consumed: false,
    direction,
    currentOffsetX: offsetX,
    lastOffsetX: offsetX,
    reversed,
  };
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

export function finishReaderPagePan(
  state: ReaderPageGestureState,
  offsetX: number,
): ReaderPageGestureDecision {
  if (!state.active || state.consumed) {
    return {
      state,
      direction: undefined,
    };
  }
  const finalState = updateReaderPagePan(state, offsetX);
  const direction = finalState.reversed ? undefined : finalState.direction;
  return {
    state: idleReaderPageGestureState(direction !== undefined),
    direction,
  };
}

export function cancelReaderPagePan(_state: ReaderPageGestureState): ReaderPageGestureState {
  return idleReaderPageGestureState(false);
}

function idleReaderPageGestureState(consumed: boolean): ReaderPageGestureState {
  return {
    active: false,
    consumed,
    direction: undefined,
    currentOffsetX: 0,
    lastOffsetX: 0,
    reversed: false,
  };
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

function finiteOffset(offsetX: number): number {
  return Number.isFinite(offsetX) ? offsetX : 0;
}
