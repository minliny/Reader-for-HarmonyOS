/**
 * Pure state for one automatic-page-turn session.
 *
 * This file deliberately owns no timer, ArkUI component, Reader Core command,
 * or Host capability. The reading surface supplies elapsed time and reports a
 * committed page turn; this state only makes those transitions deterministic.
 */
export type ReaderAutoPageStatus = 'stopped' | 'running' | 'paused';

export type ReaderAutoPagePauseReason = 'manual' | 'background' | 'touch';

export type ReaderAutoPageStopReason = 'manual' | 'bookEnd' | 'lifecycle' | 'catalogUnavailable';

export type ReaderAutoPageState = {
  status: ReaderAutoPageStatus;
  speedSeconds: number;
  remainingSeconds: number;
  generation: number;
  awaitingPageCommit: boolean;
  pauseReason: ReaderAutoPagePauseReason | undefined;
  stopReason: ReaderAutoPageStopReason | undefined;
};

export function createReaderAutoPageState(speedSeconds: number): ReaderAutoPageState {
  const speed = requirePositiveSeconds(speedSeconds, 'speedSeconds');
  return {
    status: 'stopped',
    speedSeconds: speed,
    remainingSeconds: speed,
    generation: 0,
    awaitingPageCommit: false,
    pauseReason: undefined,
    stopReason: undefined,
  };
}

export function startReaderAutoPage(state: ReaderAutoPageState): ReaderAutoPageState {
  if (state.status === 'running') {
    return state;
  }
  if (state.status === 'paused') {
    return resumeReaderAutoPage(state);
  }
  return {
    status: 'running',
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.speedSeconds,
    generation: nextGeneration(state.generation),
    awaitingPageCommit: false,
    pauseReason: undefined,
    stopReason: undefined,
  };
}

export function pauseReaderAutoPage(
  state: ReaderAutoPageState,
  reason: ReaderAutoPagePauseReason,
): ReaderAutoPageState {
  if (state.status !== 'running') {
    return state;
  }
  return {
    status: 'paused',
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.remainingSeconds,
    // A page commit already in flight must still be admitted. No countdown
    // timer remains live in that phase, so retaining its generation is safe.
    generation: state.awaitingPageCommit ? state.generation : nextGeneration(state.generation),
    awaitingPageCommit: state.awaitingPageCommit,
    pauseReason: reason,
    stopReason: undefined,
  };
}

export function resumeReaderAutoPage(state: ReaderAutoPageState): ReaderAutoPageState {
  if (state.status !== 'paused') {
    return state;
  }
  return {
    status: 'running',
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.remainingSeconds,
    // As above, preserve the token of an in-flight page commit. Otherwise a
    // fresh generation prevents a delayed pre-pause countdown from firing.
    generation: state.awaitingPageCommit ? state.generation : nextGeneration(state.generation),
    awaitingPageCommit: state.awaitingPageCommit,
    pauseReason: undefined,
    stopReason: undefined,
  };
}

export function stopReaderAutoPage(
  state: ReaderAutoPageState,
  reason: ReaderAutoPageStopReason = 'manual',
): ReaderAutoPageState {
  if (state.status === 'stopped' && state.stopReason === reason) {
    return state;
  }
  return stoppedState(state, reason);
}

export function setReaderAutoPageSpeed(
  state: ReaderAutoPageState,
  speedSeconds: number,
): ReaderAutoPageState {
  const speed = requirePositiveSeconds(speedSeconds, 'speedSeconds');
  if (speed === state.speedSeconds) {
    return state;
  }
  return {
    status: state.status,
    speedSeconds: speed,
    // A new speed defines the next complete interval. While a page commit is
    // pending, the new interval begins only after that commit is admitted.
    remainingSeconds: state.awaitingPageCommit ? state.remainingSeconds : speed,
    generation: state.awaitingPageCommit ? state.generation : nextGeneration(state.generation),
    awaitingPageCommit: state.awaitingPageCommit,
    pauseReason: state.pauseReason,
    stopReason: state.stopReason,
  };
}

export function tickReaderAutoPage(
  state: ReaderAutoPageState,
  generation: number,
  elapsedSeconds: number = 1,
): ReaderAutoPageState {
  const elapsed = requirePositiveSeconds(elapsedSeconds, 'elapsedSeconds');
  if (generation !== state.generation || state.status !== 'running' || state.awaitingPageCommit) {
    return state;
  }
  const remaining = Math.max(0, state.remainingSeconds - elapsed);
  if (remaining === state.remainingSeconds) {
    return state;
  }
  return {
    status: state.status,
    speedSeconds: state.speedSeconds,
    remainingSeconds: remaining,
    generation: state.generation,
    awaitingPageCommit: remaining === 0,
    pauseReason: undefined,
    stopReason: undefined,
  };
}

export function isReaderAutoPageTurnDue(state: ReaderAutoPageState): boolean {
  return state.status === 'running' && state.awaitingPageCommit && state.remainingSeconds === 0;
}

/**
 * Admits the page commit associated with `generation` and starts a fresh
 * interval. A stale asynchronous commit cannot revive or mutate a newer
 * session generation.
 */
export function commitReaderAutoPageTurn(
  state: ReaderAutoPageState,
  generation: number,
): ReaderAutoPageState {
  if (generation !== state.generation || !state.awaitingPageCommit || state.status === 'stopped') {
    return state;
  }
  return {
    status: state.status,
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.speedSeconds,
    generation: nextGeneration(state.generation),
    awaitingPageCommit: false,
    pauseReason: state.pauseReason,
    stopReason: undefined,
  };
}

/**
 * Rejects a prepared page turn which failed to commit and starts a complete
 * countdown interval. Only the admitted generation may recover the session;
 * a stale asynchronous failure cannot reset a newer timer.
 */
export function retryReaderAutoPageTurn(
  state: ReaderAutoPageState,
  generation: number,
): ReaderAutoPageState {
  if (generation !== state.generation || !state.awaitingPageCommit || state.status === 'stopped') {
    return state;
  }
  return {
    status: state.status,
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.speedSeconds,
    generation: nextGeneration(state.generation),
    awaitingPageCommit: false,
    pauseReason: state.pauseReason,
    stopReason: undefined,
  };
}

/** Stops only the current generation when the reading surface reaches EOF. */
export function endReaderAutoPageAtBookEnd(
  state: ReaderAutoPageState,
  generation: number,
): ReaderAutoPageState {
  if (generation !== state.generation || state.status === 'stopped') {
    return state;
  }
  return stoppedState(state, 'bookEnd');
}

/**
 * Invalidates every outstanding timer/commit token when the owning reading
 * component leaves its lifecycle. This is intentionally a stopped state, not
 * a hidden running session.
 */
export function invalidateReaderAutoPageState(state: ReaderAutoPageState): ReaderAutoPageState {
  return stoppedState(state, 'lifecycle');
}

function stoppedState(
  state: ReaderAutoPageState,
  reason: ReaderAutoPageStopReason,
): ReaderAutoPageState {
  return {
    status: 'stopped',
    speedSeconds: state.speedSeconds,
    remainingSeconds: state.speedSeconds,
    generation: nextGeneration(state.generation),
    awaitingPageCommit: false,
    pauseReason: undefined,
    stopReason: reason,
  };
}

function nextGeneration(generation: number): number {
  return generation >= Number.MAX_SAFE_INTEGER ? 1 : generation + 1;
}

function requirePositiveSeconds(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer`);
  }
  return value;
}
