/** User-approved outline presentation, shared across all control modules.
 * Sample the existing morph progress: no timer, direction switch or remount.
 * Fade/soften content without erasing it; the shell keeps its original path.
 */
export interface ReaderControlMotionPresentation {
  quickClarity: number;
  fullClarity: number;
  contentOpacity: number;
  contentBlur: number;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
function smooth(value: number): number {
  const t = unit(value);
  return t * t * (3 - 2 * t);
}

export function sampleReaderControlMotionPresentation(progress: number): ReaderControlMotionPresentation {
  const p = unit(progress);
  const quickClarity = smooth(1 - p / 0.2);
  const fullClarity = smooth((p - 0.8) / 0.2);
  // Keep endpoint-only outline gates, but let the real content change through
  // the entire path. A flat 20%-80% paint envelope looks stationary mid-morph.
  const clarity = smooth(Math.abs(2 * p - 1));
  // User correction: fading must retain a visible impression of real content,
  // not create an empty panel throughout the middle of the morph.
  const contentOpacity = 0.35 + 0.65 * clarity;
  return { quickClarity, fullClarity, contentOpacity, contentBlur: 2 * (1 - clarity) };
}

/** Offscreen source outlines must not fly across the visible Full details.
 * Weight partial visibility continuously, then reveal missing outlines only
 * with their Quick destination. Keep source bounds/scroll anchor for reversal.
 * This affects paint only, never the authored actor bounds or business state.
 */
export function readerControlMotionOutlineOpacity(progress: number, fullTop: number,
  fullHeight: number, fullViewportHeight: number, fullScrollOffset: number): number {
  const height = Math.max(1, fullHeight);
  const top = fullTop - Math.max(0, fullScrollOffset);
  const visibleHeight = Math.max(0, Math.min(top + height, fullViewportHeight) - Math.max(0, top));
  const sourceVisibility = unit(visibleHeight / height);
  const quickClarity = sampleReaderControlMotionPresentation(progress).quickClarity;
  return sourceVisibility + (1 - sourceVisibility) * quickClarity;
}

export interface ReaderControlMotionClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bound a destination to its real list window; rows outside Quick are not
 * imaginary destinations and must not paint while passing through the window. */
export function readerControlMotionVisibleRect(rect: ReaderControlMotionClipRect,
  viewportHeight: number): ReaderControlMotionClipRect {
  const top = Math.max(0, rect.y);
  return { x: rect.x, y: top, width: rect.width,
    height: Math.max(0, Math.min(viewportHeight, rect.y + rect.height) - top) };
}

/** Paint only the source's visible slice and the part entering its Quick slot.
 * Both rectangles are actor-local. Their union clips contents AND outlines;
 * offscreen controls cannot sweep across unrelated Full settings. Geometry,
 * scroll anchor and one progress remain untouched, including on reversal. */
export function readerControlMotionClipRects(progress: number, full: ReaderControlMotionClipRect,
  current: ReaderControlMotionClipRect, quick: ReaderControlMotionClipRect,
  viewportHeight: number, scrollOffset: number): ReaderControlMotionClipRect[] {
  const p = unit(progress);
  const offset = Math.max(0, scrollOffset);
  const sourceStart = unit((offset - full.y) / Math.max(1, full.height));
  const sourceEnd = unit((offset + viewportHeight - full.y) / Math.max(1, full.height));
  const source: ReaderControlMotionClipRect = { x: 0, y: sourceStart * current.height,
    width: current.width, height: Math.max(0, sourceEnd - sourceStart) * current.height };
  const currentTop = current.y - offset * p;
  const left = Math.max(0, quick.x - current.x);
  const top = Math.max(0, quick.y - currentTop);
  const right = Math.min(current.width, quick.x + quick.width - current.x);
  const bottom = Math.min(current.height, quick.y + quick.height - currentTop);
  const destination: ReaderControlMotionClipRect = { x: left, y: top,
    width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  return [source, destination];
}

export function readerControlMotionClipPath(rects: ReaderControlMotionClipRect[], pixelsPerVp: number = 1): string {
  let path = '';
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    path += `M${rect.x * pixelsPerVp} ${rect.y * pixelsPerVp}h${rect.width * pixelsPerVp}` +
      `v${rect.height * pixelsPerVp}h${-rect.width * pixelsPerVp}Z `;
  }
  return path.length > 0 ? path : 'M0 0Z';
}
