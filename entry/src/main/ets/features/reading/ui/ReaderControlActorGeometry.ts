/** Shared spatial primitives. These functions have no clock, easing or module
 * state: the control Session supplies the one already-resolved progress.
 * Endpoints stay in each actor's own parent coordinate space. Do not flatten
 * animated parents here or multiply a child's opacity by whole-panel visibility.
 */
export interface ReaderControlActorFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export function readerControlUnit(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
}

export function readerControlLerp(from: number, to: number, progress: number): number {
  return from + (to - from) * readerControlUnit(progress);
}

export function readerControlActor(x: number, y: number, width: number, height: number,
  opacity: number = 1): ReaderControlActorFrame {
  return { x: x, y: y, width: Math.max(0, width), height: Math.max(0, height),
    opacity: readerControlUnit(opacity) };
}

/** Same endpoints + same p always produce the same pose, forwards or backwards.
 * No page-specific timing, transition history or serial visibility windows.
 */
export function sampleReaderControlActor(quick: ReaderControlActorFrame,
  full: ReaderControlActorFrame, progress: number): ReaderControlActorFrame {
  const p = readerControlUnit(progress);
  return readerControlActor(readerControlLerp(quick.x, full.x, p),
    readerControlLerp(quick.y, full.y, p), readerControlLerp(quick.width, full.width, p),
    readerControlLerp(quick.height, full.height, p), readerControlLerp(quick.opacity, full.opacity, p));
}
