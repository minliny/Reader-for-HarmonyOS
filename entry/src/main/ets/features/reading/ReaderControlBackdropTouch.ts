/** Raw background-touch ownership. No UI APIs, clocks, or control mutations. */
export type ReaderControlBackdropTouchKind = 'down' | 'move' | 'up' | 'cancel';

export interface ReaderControlBackdropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReaderControlBackdropTouchEvent {
  kind: ReaderControlBackdropTouchKind;
  pointerId: number;
  windowX: number;
  windowY: number;
  timeMs: number;
}

export interface ReaderControlBackdropTouchContext {
  visible: boolean;
  geometryReady: boolean;
  heldPointerId: number;
  closeRevision: number;
  // Actual DOWN-time window-vp input regions: Dock, TopBar and any other
  // control-owned overlay. Include layout compensation in the supplied bounds.
  excludedRects: ReaderControlBackdropRect[];
  // Optional explicit command/lifecycle invalidation. Do NOT pass session.epoch:
  // an automatic continuation can advance that epoch within the same opening.
  invalidationRevision?: number;
}

export interface ReaderControlBackdropTouchConfig {
  tapMaxDurationMs: number;
  touchSlopVp: number;
}

export interface ReaderControlBackdropTouchState {
  pointerId: number;
  eligible: boolean;
  downX: number;
  downY: number;
  downTimeMs: number;
  lastTimeMs: number;
  closeRevision: number;
  invalidationRevision: number;
}

export interface ReaderControlBackdropTouchResult {
  state: ReaderControlBackdropTouchState;
  shouldDismiss: boolean;
}

export function createReaderControlBackdropTouchState(): ReaderControlBackdropTouchState {
  return { pointerId: -1, eligible: false, downX: 0, downY: 0,
    downTimeMs: 0, lastTimeMs: 0, closeRevision: -1, invalidationRevision: 0 };
}

function copyState(state: ReaderControlBackdropTouchState): ReaderControlBackdropTouchState {
  return { pointerId: state.pointerId, eligible: state.eligible,
    downX: state.downX, downY: state.downY, downTimeMs: state.downTimeMs,
    lastTimeMs: state.lastTimeMs, closeRevision: state.closeRevision,
    invalidationRevision: state.invalidationRevision };
}

function revision(value: number | undefined): number {
  return value === undefined ? 0 : value;
}

function validRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validSample(event: ReaderControlBackdropTouchEvent): boolean {
  return Number.isSafeInteger(event.pointerId) && event.pointerId >= 0 &&
    Number.isFinite(event.windowX) && Number.isFinite(event.windowY) &&
    Number.isFinite(event.timeMs) && event.timeMs >= 0;
}

function validConfig(config: ReaderControlBackdropTouchConfig): boolean {
  return Number.isFinite(config.tapMaxDurationMs) && config.tapMaxDurationMs >= 0 &&
    Number.isFinite(config.touchSlopVp) && config.touchSlopVp >= 0;
}

function mayOwnBackground(context: ReaderControlBackdropTouchContext): boolean {
  return context.visible && Number.isSafeInteger(context.heldPointerId) && context.heldPointerId < 0 &&
    validRevision(context.closeRevision) && validRevision(revision(context.invalidationRevision));
}

/** Inclusive edges are control-owned; an unmeasured/non-finite region fails closed. */
function outsideControls(event: ReaderControlBackdropTouchEvent,
  context: ReaderControlBackdropTouchContext): boolean {
  if (!context.geometryReady) return false;
  for (const rect of context.excludedRects) {
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) || rect.width < 0 || rect.height < 0 ||
      !Number.isFinite(rect.x + rect.width) || !Number.isFinite(rect.y + rect.height)) return false;
    if (event.windowX >= rect.x && event.windowX <= rect.x + rect.width &&
      event.windowY >= rect.y && event.windowY <= rect.y + rect.height) return false;
  }
  return true;
}

/**
 * Feed each changed pointer sample, using the same window-vp coordinate space
 * as excludedRects. A raw UP never acquires ownership by itself. Even a rejected
 * DOWN retains its pointer until UP/CANCEL so a second finger cannot replace it.
 *
 * The caller installs result.state BEFORE acting on shouldDismiss. This helper
 * neither stops another component's touch delivery nor calls preventDefault.
 */
export function reduceReaderControlBackdropTouch(state: ReaderControlBackdropTouchState,
  event: ReaderControlBackdropTouchEvent, context: ReaderControlBackdropTouchContext,
  config: ReaderControlBackdropTouchConfig): ReaderControlBackdropTouchResult {
  if (event.kind === 'cancel') {
    return { state: createReaderControlBackdropTouchState(), shouldDismiss: false };
  }
  if (event.kind === 'down') {
    if (state.pointerId >= 0 || !validSample(event)) return { state: state, shouldDismiss: false };
    const next = createReaderControlBackdropTouchState();
    next.pointerId = event.pointerId;
    next.downX = event.windowX;
    next.downY = event.windowY;
    next.downTimeMs = event.timeMs;
    next.lastTimeMs = event.timeMs;
    next.closeRevision = context.closeRevision;
    next.invalidationRevision = revision(context.invalidationRevision);
    next.eligible = validConfig(config) && mayOwnBackground(context) && outsideControls(event, context);
    return { state: next, shouldDismiss: false };
  }
  if (state.pointerId < 0 || state.pointerId !== event.pointerId) {
    return { state: state, shouldDismiss: false };
  }
  const next = copyState(state);
  const valid = validSample(event) && validConfig(config) && mayOwnBackground(context) &&
    context.closeRevision === state.closeRevision &&
    revision(context.invalidationRevision) === state.invalidationRevision &&
    event.timeMs >= state.lastTimeMs && event.timeMs - state.downTimeMs < config.tapMaxDurationMs &&
    Math.abs(event.windowX - state.downX) <= config.touchSlopVp &&
    Math.abs(event.windowY - state.downY) <= config.touchSlopVp;
  // Sticky invalidation: moving away then back is still a drag, not a new tap.
  next.eligible = state.eligible && valid;
  if (validSample(event) && event.timeMs >= state.lastTimeMs) next.lastTimeMs = event.timeMs;
  if (event.kind === 'up') {
    return { state: createReaderControlBackdropTouchState(), shouldDismiss: next.eligible };
  }
  return { state: next, shouldDismiss: false };
}
