import { copyReaderControlSessionState, sampleReaderControlSession,
  type ReaderControlLocation, type ReaderControlSessionState,
  type ReaderControlVisualFrame } from './ReaderControlSessionState.ts';

import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_COLLAPSE_MS,
  READER_CONTROL_DISMISS_MS, READER_CONTROL_RESTORE_MS } from '../common/ProductMotionTiming.ts';
export { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_COLLAPSE_MS,
  READER_CONTROL_DISMISS_MS, READER_CONTROL_RESTORE_MS } from '../common/ProductMotionTiming.ts';

export function readerControlMotionTargetDuration(state: ReaderControlSessionState,
  target: ReaderControlLocation, visualTarget?: ReaderControlVisualFrame): number | undefined {
  if (target.level === 'hidden') return READER_CONTROL_DISMISS_MS;
  const from = sampleReaderControlSession(state);
  if (target.level === 'home') return from.visibilityProgress < 1 ?
    (state.transition?.kind === 'open' ? READER_CONTROL_OPEN_MS : READER_CONTROL_RESTORE_MS) : undefined;
  const expansion = visualTarget !== undefined ? visualTarget.expansionProgress : target.form === 'full' ? 1 : 0;
  if (expansion !== from.expansionProgress) return expansion > from.expansionProgress ?
    READER_CONTROL_EXPAND_MS : READER_CONTROL_COLLAPSE_MS;
  return from.visibilityProgress < 1 ? READER_CONTROL_RESTORE_MS : undefined;
}

/** Covers external Back/close commands as well as the local collapse button.
 * Never change route, spatial progress, pointer ownership or an existing shorter continuation. */
export function readerControlMotionCommandTiming(state: ReaderControlSessionState): ReaderControlSessionState {
  const transition = state.transition;
  if (transition === undefined || transition.kind === 'navigate') return state;
  if (transition.kind === 'open' && transition.durationMs <= READER_CONTROL_OPEN_MS) return state;
  const target = transition.targetProgress === 0 ? transition.fromLocation : transition.toLocation;
  const end = transition.targetProgress === 0 ? transition.from : transition.to;
  const nominal = readerControlMotionTargetDuration(state, target, end);
  if (nominal === undefined || transition.durationMs === 0) return state;
  const now = sampleReaderControlSession(state);
  const distance = Math.max(Math.abs(end.expansionProgress - now.expansionProgress),
    Math.abs(end.visibilityProgress - now.visibilityProgress));
  const remainingMs = Math.max(0, transition.durationMs - transition.elapsedMs);
  const duration = nominal * distance;
  if (remainingMs <= duration) return state;
  const next = copyReaderControlSessionState(state);
  if (next.transition !== undefined) {
    next.transition.startProgress = next.transition.progress;
    next.transition.elapsedMs = 0;
    next.transition.durationMs = duration;
  }
  return next;
}

/** A monotone release curve with measured initial velocity and zero final velocity.
 * It only drives the existing progress, never a second component animation. */
export function sampleReaderControlMotionContinuation(fraction: number, slope: number): number {
  const t = Math.max(0, Math.min(1, fraction));
  const m = Math.max(0, Math.min(3, slope));
  return ((m - 2) * t + 3 - 2 * m) * t * t + m * t;
}

/** Automatic morphs spend time across the full spatial path instead of
 * reaching almost the endpoint early and then lingering on a long slow tail.
 * Pointer-owned samples and velocity-matched release continuations bypass it. */
export function sampleReaderControlMorphProgress(fraction: number): number {
  const t = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  return t * t * (3 - 2 * t);
}
