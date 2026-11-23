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

export interface ReaderControlResponseAllocation {
  paint: ReaderControlActorFrame;
  slot: ReaderControlActorFrame;
  response: ReaderControlActorFrame;
  requestedSize: number;
  complete: boolean;
  conflict: 'none' | 'host' | 'neighbor' | 'paintOverlap';
}

/** Allocate touch space from this parent's existing blank area. Peer centers
 * partition any contested band, so compact artwork never acquires a second
 * owner's response region or changes its painted dimensions. */
export function readerControlPaidResponses(paints: ReaderControlActorFrame[],
  host: ReaderControlActorFrame, requestedSize: number = 44): ReaderControlResponseAllocation[] {
  const requested = Number.isFinite(requestedSize) ? Math.max(0, requestedSize) : 44;
  const validHost = [host.x, host.y, host.width, host.height].every((value: number): boolean => Number.isFinite(value)) &&
    host.width > 0 && host.height > 0;
  return paints.map((paint: ReaderControlActorFrame, index: number): ReaderControlResponseAllocation => {
    const validPaint = [paint.x, paint.y, paint.width, paint.height].every((value: number): boolean => Number.isFinite(value)) &&
      paint.width > 0 && paint.height > 0;
    if (!validHost || !validPaint || paint.x >= host.x + host.width || paint.y >= host.y + host.height ||
      paint.x + paint.width <= host.x || paint.y + paint.height <= host.y) {
      const empty = readerControlActor(0, 0, 0, 0, 0);
      return { paint: paint, slot: empty, response: empty, requestedSize: requested, complete: false, conflict: 'host' };
    }
    let left = host.x, top = host.y;
    let right = host.x + host.width, bottom = host.y + host.height;
    let constrainedByPeer = false;
    let overlappingPaint = false;
    const cx = paint.x + paint.width / 2, cy = paint.y + paint.height / 2;
    const desiredWidth = Math.max(paint.width, requested), desiredHeight = Math.max(paint.height, requested);
    for (let otherIndex = 0; otherIndex < paints.length; otherIndex++) {
      if (otherIndex === index) continue;
      const other = paints[otherIndex];
      if (![other.x, other.y, other.width, other.height].every((value: number): boolean => Number.isFinite(value)) ||
        other.width <= 0 || other.height <= 0) continue;
      const dx = other.x + other.width / 2 - cx, dy = other.y + other.height / 2 - cy;
      const overlapX = Math.abs(dx) < (desiredWidth + Math.max(other.width, requested)) / 2;
      const overlapY = Math.abs(dy) < (desiredHeight + Math.max(other.height, requested)) / 2;
      if (!overlapX || !overlapY) continue;
      constrainedByPeer = true;
      const separateX = paint.x + paint.width <= other.x || other.x + other.width <= paint.x;
      const separateY = paint.y + paint.height <= other.y || other.y + other.height <= paint.y;
      const horizontal = separateX && (!separateY || Math.abs(dx) >= Math.abs(dy));
      if (horizontal) {
        const gapStart = dx >= 0 ? paint.x + paint.width : other.x + other.width;
        const gapEnd = dx >= 0 ? other.x : paint.x;
        const cut = Math.max(gapStart, Math.min(gapEnd, cx + dx / 2));
        if (dx >= 0) right = Math.min(right, cut); else left = Math.max(left, cut);
      } else if (separateY) {
        const gapStart = dy >= 0 ? paint.y + paint.height : other.y + other.height;
        const gapEnd = dy >= 0 ? other.y : paint.y;
        const cut = Math.max(gapStart, Math.min(gapEnd, cy + dy / 2));
        if (dy >= 0) bottom = Math.min(bottom, cut); else top = Math.max(top, cut);
      } else {
        overlappingPaint = true;
        if (Math.abs(dx) >= Math.abs(dy)) {
          const cut = cx + dx / 2;
          if (dx >= 0) right = Math.min(right, cut); else left = Math.max(left, cut);
        } else {
          const cut = cy + dy / 2;
          if (dy >= 0) bottom = Math.min(bottom, cut); else top = Math.max(top, cut);
        }
      }
    }
    const slot = readerControlActor(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    const x = Math.min(right, Math.max(left, cx - desiredWidth / 2));
    const y = Math.min(bottom, Math.max(top, cy - desiredHeight / 2));
    const response = readerControlActor(x, y, Math.max(0, Math.min(right, cx + desiredWidth / 2) - x),
      Math.max(0, Math.min(bottom, cy + desiredHeight / 2) - y), paint.opacity);
    const paintInHost = paint.x >= host.x && paint.y >= host.y && paint.x + paint.width <= host.x + host.width &&
      paint.y + paint.height <= host.y + host.height;
    const complete = response.width >= requested && response.height >= requested && paintInHost && !overlappingPaint;
    return { paint: paint, slot: slot, response: response, requestedSize: requested, complete: complete,
      conflict: !paintInHost ? 'host' : overlappingPaint ? 'paintOverlap' : complete ? 'none' : constrainedByPeer ? 'neighbor' : 'host' };
  });
}
