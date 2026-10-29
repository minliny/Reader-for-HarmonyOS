import {
  ReaderWindowMetricsSnapshot,
  readerVisualSafeTop,
} from './ReaderWindowMetrics';
function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readableScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? Math.max(1, fontScale) : 1;
}

/** Component-side sanitizer for a system font scale read from window metrics. */
export function readerReadableFontScale(fontScale: number): number {
  return readableScale(fontScale);
}

/** Keep an authored control height while adding the line box growth so the
 * label keeps its original vertical padding instead of being clipped. */
export function readerScaledControlHeight(
  baseHeight: number,
  lineHeight: number,
  fontScale: number,
): number {
  return Math.ceil(finiteNonNegative(baseHeight) +
    finiteNonNegative(lineHeight) * Math.max(0, readableScale(fontScale) - 1));
}

/** Fixed bar heights become minimums so enlarged text cannot be clipped. */
export function readerScaledBarHeight(
  baseHeight: number,
  lineHeight: number,
  fontScale: number,
  verticalPadding: number,
): number {
  const contentHeight = finiteNonNegative(lineHeight) * readableScale(fontScale) +
    finiteNonNegative(verticalPadding) * 2;
  return Math.ceil(Math.max(finiteNonNegative(baseHeight), contentHeight));
}

/** Measured page height already reflects platform resize; fall back to the window. */
export function readerAvailableWindowHeight(
  metrics: ReaderWindowMetricsSnapshot,
  pageHeight: number = 0,
): number {
  if (Number.isFinite(pageHeight) && pageHeight > 0) return pageHeight;
  return Math.max(0, metrics.windowRect.height - readerVisualSafeTop(metrics));
}

export function readerSurfaceMaxHeight(
  availableHeight: number,
  reservedHeight: number,
  minimumHeight: number = 0,
): number {
  return Math.max(finiteNonNegative(minimumHeight),
    finiteNonNegative(availableHeight) - finiteNonNegative(reservedHeight));
}

export function readerDynamicSurfaceWidth(
  maxWidth: number,
  availableWidth: number,
  minimumWidth: number = 0,
): number {
  return Math.max(finiteNonNegative(minimumWidth),
    Math.min(finiteNonNegative(maxWidth), finiteNonNegative(availableWidth)));
}
