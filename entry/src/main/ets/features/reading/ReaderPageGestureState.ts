/** The shared raw-input arena for paged reading. It owns no renderer or page transaction. */
export type ReaderPageTurnDirection = 'previous' | 'next';

export type ReaderPageTapIntent = ReaderPageTurnDirection | 'control';

export type ReaderPageTurnOutcome =
  | { kind: 'started' }
  | { kind: 'busy' }
  | { kind: 'preparing' }
  | { kind: 'boundary'; edge: 'start' | 'end' }
  | { kind: 'blocked'; reason: 'overlay' | 'control' | 'lifecycle' };

export type ReaderPageGesturePhase = 'idle' | 'tracking' | 'dragging' | 'settling';
export type ReaderPageGestureAxis = 'undecided' | 'horizontal' | 'vertical';
export type ReaderPageGestureOwner =
  'undecided' | 'horizontalPage' | 'verticalPrevious' | 'bookmark' | 'longPress';
export type ReaderPageGestureSettleTarget = 'commit' | 'rollback';

export type ReaderPageGestureState = {
  phase: ReaderPageGesturePhase;
  active: boolean;
  consumed: boolean;
  owner: ReaderPageGestureOwner;
  direction: ReaderPageTurnDirection | undefined;
  currentDirection: ReaderPageTurnDirection | undefined;
  axis: ReaderPageGestureAxis;
  verticalPrevious: boolean;
  viewportWidth: number;
  viewportHeight: number;
  currentOffsetX: number;
  currentOffsetY: number;
  lastOffsetX: number;
  lastOffsetY: number;
  velocityX: number;
  velocityY: number;
  startEventTimeMs: number;
  eventTimeMs: number;
  startLocalX: number;
  startLocalY: number;
  currentLocalX: number;
  currentLocalY: number;
  maxDistance2D: number;
  progress: number;
  bookmarkPeakDistance: number;
  bookmarkOffsetY: number;
  bookmarkPreviewChanged: boolean;
  settleTarget: ReaderPageGestureSettleTarget | undefined;
  reversed: boolean;
};

export type ReaderPageGestureDecision = {
  state: ReaderPageGestureState;
  direction: ReaderPageTurnDirection | undefined;
  bookmarkChanged: boolean;
};

export const READER_PAGE_GESTURE_TOUCH_SLOP = 8;
export const READER_PAGE_GESTURE_LONG_PRESS_MS = 500;
export const READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP = 24;
export const READER_PAGE_GESTURE_BOOKMARK_SLOP = 48;

export function readerPagePointerCoordinate(
  coordinate: number,
  touchTargetExtent: number,
  pageStageExtent: number,
): number {
  if (!Number.isFinite(coordinate)) return 0;
  if (!Number.isFinite(touchTargetExtent) || touchTargetExtent <= 0 ||
    !Number.isFinite(pageStageExtent) || pageStageExtent <= 0) {
    return coordinate;
  }
  return coordinate * pageStageExtent / touchTargetExtent;
}

export function createReaderPageGestureState(): ReaderPageGestureState {
  return idleReaderPageGestureState(false);
}

export function beginReaderPageGesture(
  viewportWidth: number,
  localX: number = 0,
  localY: number = 0,
  eventTimeMs: number = 0,
  viewportHeight: number = 0,
): ReaderPageGestureState {
  return trackingReaderPageGestureState(viewportWidth, viewportHeight, localX, localY, eventTimeMs);
}

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
  if (!state.active || state.consumed) return state;
  return applyReaderPageGestureSample(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
}

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
    return { state, direction: undefined, bookmarkChanged: false };
  }
  const sampled = moveReaderPageGesture(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs,
  );
  const direction = committedDirection(sampled);
  const bookmarkChanged = shouldCommitBookmark(sampled);
  return {
    state: settlingReaderPageGestureState(
      sampled,
      direction !== undefined || bookmarkChanged ? 'commit' : 'rollback',
    ),
    direction,
    bookmarkChanged,
  };
}

export function completeReaderPageGestureSettlement(state: ReaderPageGestureState): ReaderPageGestureState {
  return state.phase === 'settling' ? idleReaderPageGestureState(false) : state;
}

export function abandonReaderPageGestureTracking(state: ReaderPageGestureState): ReaderPageGestureState {
  return state.phase === 'tracking' ? idleReaderPageGestureState(false) : state;
}

export function startReaderPagePan(
  viewportWidth: number,
  localX: number = 0,
  localY: number = 0,
  eventTimeMs: number = 0,
  viewportHeight: number = 0,
): ReaderPageGestureState {
  return beginReaderPageGesture(viewportWidth, localX, localY, eventTimeMs, viewportHeight);
}

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

/** Allocation-free live MOVE path. */
export function updateReaderPagePanInPlace(
  state: ReaderPageGestureState,
  offsetX: number,
  offsetY: number = state.currentOffsetY,
  velocityX: number = state.velocityX,
  localX: number = state.startLocalX + offsetX,
  localY: number = state.startLocalY + offsetY,
  velocityY: number = state.velocityY,
  eventTimeMs: number = state.eventTimeMs,
): ReaderPageGestureState {
  if (!state.active || state.consumed) return state;
  return applyReaderPageGestureSample(
    state, offsetX, offsetY, velocityX, localX, localY, velocityY, eventTimeMs, true,
  );
}

export function readerPageTapIntent(localX: number, viewportWidth: number): ReaderPageTapIntent | undefined {
  if (!Number.isFinite(localX) || !Number.isFinite(viewportWidth) || viewportWidth <= 0 ||
    localX < 0 || localX > viewportWidth) {
    return undefined;
  }
  if (localX < viewportWidth / 3) return 'previous';
  if (localX > viewportWidth * 2 / 3) return 'next';
  return 'control';
}

export function readerPageGestureCanTap(state: ReaderPageGestureState, eventTimeMs: number): boolean {
  return state.owner === 'undecided' && state.maxDistance2D < READER_PAGE_GESTURE_TOUCH_SLOP &&
    eventTimeMs - state.startEventTimeMs < READER_PAGE_GESTURE_LONG_PRESS_MS;
}

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

/** System CANCEL can only roll back, including bookmark preview. */
export function cancelReaderPagePan(state: ReaderPageGestureState): ReaderPageGestureState {
  if (!state.active || state.consumed) return state;
  return settlingReaderPageGestureState(state, 'rollback');
}

function committedDirection(state: ReaderPageGestureState): ReaderPageTurnDirection | undefined {
  if (state.owner === 'horizontalPage' && state.direction !== undefined) {
    const signedDistance = directionSign(state.direction) * state.currentOffsetX;
    return signedDistance >= READER_PAGE_GESTURE_TOUCH_SLOP ? state.direction : undefined;
  }
  if (state.owner === 'verticalPrevious' &&
    -state.currentOffsetY >= READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP) {
    return 'previous';
  }
  return undefined;
}

function shouldCommitBookmark(state: ReaderPageGestureState): boolean {
  return state.owner === 'bookmark' && state.bookmarkPreviewChanged;
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
  reuseState: boolean = false,
): ReaderPageGestureState {
  if (!Number.isFinite(offsetX)) return state;
  const y = Number.isFinite(offsetY) ? offsetY : state.currentOffsetY;
  const vx = Number.isFinite(velocityX) ? velocityX : state.velocityX;
  const vy = Number.isFinite(velocityY) ? velocityY : state.velocityY;
  const time = Number.isFinite(eventTimeMs) && eventTimeMs >= 0 ? eventTimeMs : state.eventTimeMs;
  const currentX = Number.isFinite(localX) ? localX : state.currentLocalX;
  const currentY = Number.isFinite(localY) ? localY : state.currentLocalY;
  const distance2D = Math.sqrt(offsetX * offsetX + y * y);
  const maxDistance = Math.max(state.maxDistance2D, distance2D);
  let owner = state.owner;
  let direction = state.direction;
  let axis = state.axis;
  let phase = state.phase;

  // Frozen arbitration order. Absolute horizontal displacement wins even
  // when the same platform sample also crosses a vertical threshold.
  if (owner === 'undecided') {
    if (Math.abs(offsetX) >= READER_PAGE_GESTURE_TOUCH_SLOP) {
      owner = 'horizontalPage';
      direction = directionForOffset(offsetX);
      axis = 'horizontal';
      phase = 'dragging';
    } else if (Math.abs(offsetX) < READER_PAGE_GESTURE_TOUCH_SLOP &&
      -y >= READER_PAGE_GESTURE_VERTICAL_PREVIOUS_SLOP) {
      owner = 'verticalPrevious';
      direction = 'previous';
      axis = 'vertical';
      phase = 'dragging';
    } else if (Math.abs(offsetX) < READER_PAGE_GESTURE_TOUCH_SLOP &&
      y >= READER_PAGE_GESTURE_BOOKMARK_SLOP) {
      owner = 'bookmark';
      axis = 'vertical';
      phase = 'dragging';
    } else if (time - state.startEventTimeMs >= READER_PAGE_GESTURE_LONG_PRESS_MS &&
      maxDistance < READER_PAGE_GESTURE_TOUCH_SLOP) {
      owner = 'longPress';
      axis = 'undecided';
      phase = 'tracking';
    }
  }

  let bookmarkPeak = state.bookmarkPeakDistance;
  let bookmarkOffsetY = state.bookmarkOffsetY;
  let bookmarkPreviewChanged = state.bookmarkPreviewChanged;
  if (owner === 'bookmark') {
    const downward = Math.max(0, y);
    bookmarkPeak = Math.max(bookmarkPeak, downward);
    bookmarkOffsetY = Math.min(state.viewportHeight / 2, downward / 2);
    bookmarkPreviewChanged = bookmarkPeak >= READER_PAGE_GESTURE_BOOKMARK_SLOP &&
      downward >= bookmarkPeak / 2;
  }

  const currentDirection = directionForOffset(offsetX);
  const reversed = direction !== undefined && currentDirection !== undefined && currentDirection !== direction;
  const progress = state.viewportWidth > 0 ? Math.min(1, Math.abs(offsetX) / state.viewportWidth) : 0;
  if (reuseState) {
    const lastX = state.currentOffsetX;
    const lastY = state.currentOffsetY;
    state.phase = phase;
    state.active = phase === 'tracking' || phase === 'dragging';
    state.consumed = false;
    state.owner = owner;
    state.direction = direction;
    state.currentDirection = currentDirection;
    state.axis = axis;
    state.verticalPrevious = owner === 'verticalPrevious';
    state.currentOffsetX = offsetX;
    state.currentOffsetY = y;
    state.lastOffsetX = lastX;
    state.lastOffsetY = lastY;
    state.velocityX = vx;
    state.velocityY = vy;
    state.eventTimeMs = time;
    state.currentLocalX = currentX;
    state.currentLocalY = currentY;
    state.maxDistance2D = maxDistance;
    state.progress = progress;
    state.bookmarkPeakDistance = bookmarkPeak;
    state.bookmarkOffsetY = bookmarkOffsetY;
    state.bookmarkPreviewChanged = bookmarkPreviewChanged;
    state.settleTarget = undefined;
    state.reversed = reversed;
    return state;
  }
  return {
    ...state,
    phase,
    active: phase === 'tracking' || phase === 'dragging',
    consumed: false,
    owner,
    direction,
    currentDirection,
    axis,
    verticalPrevious: owner === 'verticalPrevious',
    currentOffsetX: offsetX,
    currentOffsetY: y,
    lastOffsetX: state.currentOffsetX,
    lastOffsetY: state.currentOffsetY,
    velocityX: vx,
    velocityY: vy,
    eventTimeMs: time,
    currentLocalX: currentX,
    currentLocalY: currentY,
    maxDistance2D: maxDistance,
    progress,
    bookmarkPeakDistance: bookmarkPeak,
    bookmarkOffsetY,
    bookmarkPreviewChanged,
    settleTarget: undefined,
    reversed,
  };
}

function idleReaderPageGestureState(consumed: boolean): ReaderPageGestureState {
  return {
    phase: 'idle', active: false, consumed, owner: 'undecided', direction: undefined,
    currentDirection: undefined, axis: 'undecided', verticalPrevious: false,
    viewportWidth: 0, viewportHeight: 0, currentOffsetX: 0, currentOffsetY: 0,
    lastOffsetX: 0, lastOffsetY: 0, velocityX: 0, velocityY: 0,
    startEventTimeMs: 0, eventTimeMs: 0, startLocalX: 0, startLocalY: 0,
    currentLocalX: 0, currentLocalY: 0, maxDistance2D: 0, progress: 0,
    bookmarkPeakDistance: 0, bookmarkOffsetY: 0, bookmarkPreviewChanged: false,
    settleTarget: undefined, reversed: false,
  };
}

function trackingReaderPageGestureState(
  viewportWidth: number,
  viewportHeight: number,
  localX: number,
  localY: number,
  eventTimeMs: number,
): ReaderPageGestureState {
  const state = idleReaderPageGestureState(false);
  const x = Number.isFinite(localX) ? localX : 0;
  const y = Number.isFinite(localY) ? localY : 0;
  const time = Number.isFinite(eventTimeMs) && eventTimeMs >= 0 ? eventTimeMs : 0;
  return {
    ...state,
    phase: 'tracking', active: true,
    viewportWidth: finitePositive(viewportWidth), viewportHeight: finitePositive(viewportHeight),
    startLocalX: x, startLocalY: y, currentLocalX: x, currentLocalY: y,
    startEventTimeMs: time, eventTimeMs: time,
  };
}

function settlingReaderPageGestureState(
  state: ReaderPageGestureState,
  settleTarget: ReaderPageGestureSettleTarget,
): ReaderPageGestureState {
  return { ...state, phase: 'settling', active: false, consumed: true, settleTarget };
}

function directionForOffset(offsetX: number): ReaderPageTurnDirection | undefined {
  if (offsetX < 0) return 'next';
  if (offsetX > 0) return 'previous';
  return undefined;
}

function directionSign(direction: ReaderPageTurnDirection): number {
  return direction === 'next' ? -1 : 1;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
