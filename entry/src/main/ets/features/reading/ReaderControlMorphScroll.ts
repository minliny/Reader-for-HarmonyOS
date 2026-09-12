/** Runtime scroll adaptation, separate from the authored actor geometry/clock.
 * S freezes the real Full position when input hands over to the morph; N is
 * the actual native offset. Shared actors draw at authoredY-S*p, Full-only
 * actors at authoredY-S. A completed, untouched Quick discards S. Reaching
 * p=0 while held does not: the same gesture can still reverse continuously.
 */
export interface ReaderControlMorphScrollState {
  fullScrollOffset: number;
  nativeScrollOffset: number;
  fullScrollActive: boolean;
  resettingFullScroll: boolean;
}

export interface ReaderControlMorphScrollUpdate {
  state: ReaderControlMorphScrollState;
  targetOffset?: number;
}

/** Row-based lists may also scroll in Quick. A new expansion converges from
 * its current Quick row to Full top; a collapse converges from current Full
 * row to Quick top. Keep this immutable path until an untouched endpoint. */
export interface ReaderControlMorphScrollPath { quickOffset: number; fullOffset: number; }
export function readerControlMorphScrollPath(start: number, currentOffset: number): ReaderControlMorphScrollPath {
  const value = offset(currentOffset, 0);
  return { quickOffset: start === 0 ? value : 0, fullOffset: start === 1 ? value : 0 };
}
export function sampleReaderControlMorphScrollPath(path: ReaderControlMorphScrollPath, progress: number): number {
  return path.quickOffset + (path.fullOffset - path.quickOffset) * Math.max(0, Math.min(1, progress));
}

function offset(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

export function createReaderControlMorphScroll(): ReaderControlMorphScrollState {
  return { fullScrollOffset: 0, nativeScrollOffset: 0, fullScrollActive: false, resettingFullScroll: false };
}

export function observeReaderControlMorphScroll(state: ReaderControlMorphScrollState,
  nativeOffset: number, fullInput: boolean): ReaderControlMorphScrollState {
  const native = offset(nativeOffset, state.nativeScrollOffset);
  const anchor = fullInput && !state.resettingFullScroll ? native : state.fullScrollOffset;
  const resetting = state.resettingFullScroll && native !== 0;
  if (native === state.nativeScrollOffset && anchor === state.fullScrollOffset &&
    resetting === state.resettingFullScroll) return state;
  return { fullScrollOffset: anchor, nativeScrollOffset: native,
    fullScrollActive: state.fullScrollActive, resettingFullScroll: resetting };
}

export function advanceReaderControlMorphScroll(state: ReaderControlMorphScrollState,
  progress: number, inputEnabled: boolean, nativeOffset: number): ReaderControlMorphScrollUpdate {
  const full = progress === 1 && inputEnabled;
  const measured = observeReaderControlMorphScroll(state, nativeOffset, full || state.fullScrollActive);
  let anchor = measured.fullScrollOffset;
  let resetting = measured.resettingFullScroll;
  let target: number | undefined = undefined;
  // Same-position, non-animated handoff cancels inertia, not a rewind.
  if (state.fullScrollActive && !full) target = measured.nativeScrollOffset;
  if (progress === 0 && inputEnabled && anchor > 0) {
    anchor = 0;
    resetting = measured.nativeScrollOffset !== 0;
    target = 0;
  }
  if (anchor === state.fullScrollOffset && measured.nativeScrollOffset === state.nativeScrollOffset &&
    full === state.fullScrollActive && resetting === state.resettingFullScroll) return { state: state, targetOffset: target };
  return { state: { fullScrollOffset: anchor, nativeScrollOffset: measured.nativeScrollOffset,
    fullScrollActive: full, resettingFullScroll: resetting }, targetOffset: target };
}

export function readerControlMorphScrollTranslation(state: ReaderControlMorphScrollState,
  progress: number, role: 'shared' | 'fullOnly' | 'quickOnly' = 'shared'): number {
  return state.nativeScrollOffset - state.fullScrollOffset *
    (role === 'fullOnly' ? 1 : role === 'quickOnly' ? 0 : progress);
}

export function readerControlMorphScrollExtent(state: ReaderControlMorphScrollState): number {
  return Math.max(state.fullScrollOffset, state.nativeScrollOffset);
}

export function readerControlMorphScrollAllowsNative(state: ReaderControlMorphScrollState,
  fullInput: boolean, programmatic: boolean): boolean {
  return fullInput || (state.resettingFullScroll && programmatic);
}
