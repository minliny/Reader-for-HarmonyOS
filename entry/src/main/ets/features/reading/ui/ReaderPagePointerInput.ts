import {
  READER_PAGE_GESTURE_DIRECTION_CONFIRM_SLOP,
  READER_PAGE_GESTURE_TOUCH_SLOP,
  readerPageGestureIsHorizontal,
  readerPagePointerCoordinate,
  type ReaderPageGestureState,
  type ReaderPageTurnDirection,
} from './ReaderPageGestureState.ts';

const SYSTEM_SIDE_EDGE_VP = 12;
const PALM_EDGE_VP = 32;
const POINTER_GEOMETRY_TOLERANCE_VP = 0.5;

export function readerPageSystemOwnsPointer(x: number, width: number, left: number, right: number): boolean {
  return width > 0 && ((left > 0 && x <= Math.min(left, SYSTEM_SIDE_EDGE_VP)) ||
    (right > 0 && width - x <= Math.min(right, SYSTEM_SIDE_EDGE_VP)));
}

export function readerPagePointerBlocksTap(y: number, height: number, bottom: number): boolean {
  return height > 0 && bottom > 0 && y > height - bottom;
}

export function readerPagePointerLocalCoordinate(coordinate: number, target: number, stage: number): number {
  return readerPagePointerCoordinate(Math.max(0, Math.min(target, coordinate)), target, stage);
}

export function readerPagePointerGeometryValueMatches(frozen: number, current: number): boolean {
  return Math.abs(frozen - current) <= POINTER_GEOMETRY_TOLERANCE_VP;
}

export function readerPagePointerAtPalmEdge(x: number, width: number): boolean {
  return x <= PALM_EDGE_VP || width - x <= PALM_EDGE_VP;
}

export function readerPageCanOfferPalmHandoff(state: ReaderPageGestureState, tapOnly: boolean,
  startX: number, width: number): boolean {
  return !tapOnly && state.phase === 'tracking' && (state.owner === 'undecided' || state.owner === 'longPress') &&
    state.maxDistance2D < READER_PAGE_GESTURE_TOUCH_SLOP && readerPagePointerAtPalmEdge(startX, width);
}

/** The candidate's gesture is allocated only on its own DOWN. */
export class ReaderPagePalmCandidate {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly downReceivedMs: number;
  readonly state: ReaderPageGestureState;

  constructor(pointerId: number, startX: number, startY: number, downReceivedMs: number,
    state: ReaderPageGestureState) {
    this.pointerId = pointerId;
    this.startX = startX;
    this.startY = startY;
    this.downReceivedMs = downReceivedMs;
    this.state = state;
  }

  claimsHorizontal(x: number, y: number, finalSample: boolean = false): boolean {
    const horizontalSlop = finalSample ? READER_PAGE_GESTURE_TOUCH_SLOP : READER_PAGE_GESTURE_DIRECTION_CONFIRM_SLOP;
    return readerPageGestureIsHorizontal(x - this.startX, y - this.startY, horizontalSlop);
  }

  replaceLease(oldPointerId: number, end: (id: number) => void, start: (id: number) => boolean): boolean {
    end(oldPointerId);
    return start(this.pointerId);
  }
}

export type ReaderPageGestureAdmission = 'admitted' | 'preparing' | 'bookmark-unavailable';

/** Both a newly claimed and a held gesture use the same presentation gate. */
export function readerPageGestureAdmission(state: ReaderPageGestureState,
  canStartTurn: (direction: ReaderPageTurnDirection) => boolean,
  canStartBookmark: () => boolean): ReaderPageGestureAdmission {
  if (state.owner === 'horizontalPage' && state.direction !== undefined && !canStartTurn(state.direction)) {
    return 'preparing';
  }
  if (state.owner === 'bookmark' && !canStartBookmark()) return 'bookmark-unavailable';
  return 'admitted';
}
