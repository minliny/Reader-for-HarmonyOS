import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderDisplayCornerVp } from '../common/ReaderWindowMetrics';

/** Figma `Reader/ImmersiveInfo`/`Reader/ImmersiveFooterStatus` semantic tracks. */
export const READER_PAGE_CHROME_SIDE_INSET = 25;
export const READER_PAGE_CHROME_TOP_INSET = 25;
/** Minimum breathing room after a visible system status/cutout edge. */
export const READER_PAGE_CHROME_SAFE_TOP_GAP = 8;
export const READER_PAGE_CHROME_BOTTOM_INSET = 23;
export const READER_PAGE_CHROME_FOOTER_HEIGHT = 24;
export const READER_PAGE_CHROME_FOOTER_GAP = 5;
// A stable semantic slot keeps the clock still during bookmark drag/ACK.
export const READER_PAGE_CHROME_BOOKMARK_SIZE = 24;

export class ReaderPageChromeMeasurements {
  topStartWidth: number;
  topStartHeight: number;
  topEndWidth: number;
  topEndHeight: number;
  bottomStartWidth: number;
  bottomStartHeight: number;
  bottomEndWidth: number;
  bottomEndHeight: number;
  sessionVisible: boolean;
  sessionWidth: number;
  sessionHeight: number;
  topAccessoryWidth: number;
  topAccessoryHeight: number;

  constructor(
    topStartWidth: number = 0,
    topStartHeight: number = 0,
    topEndWidth: number = 0,
    topEndHeight: number = 0,
    bottomStartWidth: number = 0,
    bottomStartHeight: number = 0,
    bottomEndWidth: number = 0,
    bottomEndHeight: number = 0,
    sessionVisible: boolean = false,
    sessionWidth: number = 0,
    sessionHeight: number = 0,
    topAccessoryWidth: number = 0,
    topAccessoryHeight: number = 0,
  ) {
    this.topStartWidth = finiteLength(topStartWidth);
    this.topStartHeight = finiteLength(topStartHeight);
    this.topEndWidth = finiteLength(topEndWidth);
    this.topEndHeight = finiteLength(topEndHeight);
    this.bottomStartWidth = finiteLength(bottomStartWidth);
    this.bottomStartHeight = finiteLength(bottomStartHeight);
    this.bottomEndWidth = finiteLength(bottomEndWidth);
    this.bottomEndHeight = finiteLength(bottomEndHeight);
    this.sessionVisible = sessionVisible && sessionWidth > 0 && sessionHeight > 0;
    this.sessionWidth = this.sessionVisible ? finiteLength(sessionWidth) : 0;
    this.sessionHeight = this.sessionVisible ? finiteLength(sessionHeight) : 0;
    this.topAccessoryWidth = finiteLength(topAccessoryWidth);
    this.topAccessoryHeight = finiteLength(topAccessoryHeight);
  }
}

export class ReaderPageChromeLayoutSnapshot {
  topStartX: number;
  topStartY: number;
  topStartMaxWidth: number;
  topEndX: number;
  topEndY: number;
  topEndMaxWidth: number;
  topAccessoryX: number;
  topAccessoryY: number;
  topAccessoryWidth: number;
  topAccessoryHeight: number;
  bottomStartX: number;
  bottomStartY: number;
  bottomStartMaxWidth: number;
  bottomEndX: number;
  bottomEndY: number;
  bottomEndMaxWidth: number;
  sessionX: number;
  sessionY: number;
  footerRight: number;
  footerTop: number;

  constructor() {
    this.topStartX = 0;
    this.topStartY = 0;
    this.topStartMaxWidth = 0;
    this.topEndX = 0;
    this.topEndY = 0;
    this.topEndMaxWidth = 0;
    this.topAccessoryX = 0;
    this.topAccessoryY = 0;
    this.topAccessoryWidth = 0;
    this.topAccessoryHeight = 0;
    this.bottomStartX = 0;
    this.bottomStartY = 0;
    this.bottomStartMaxWidth = 0;
    this.bottomEndX = 0;
    this.bottomEndY = 0;
    this.bottomEndMaxWidth = 0;
    this.sessionX = 0;
    this.sessionY = 0;
    this.footerRight = 0;
    this.footerTop = 0;
  }
}

/**
 * Resolves four-corner chrome and the live capsule from content measurements.
 * Figma reference coordinates are reproduced by formula at their reference
 * viewport, while safe areas and longer localized strings remain bounded.
 */
export function resolveReaderPageChromeLayout(
  layout: ReaderReadingLayoutSnapshot,
  measurements: ReaderPageChromeMeasurements,
): ReaderPageChromeLayoutSnapshot {
  const result = new ReaderPageChromeLayoutSnapshot();
  const visualLeft = Math.max(READER_PAGE_CHROME_SIDE_INSET, layout.pageChromeVisualSafeLeft);
  const visualRightInset = Math.max(READER_PAGE_CHROME_SIDE_INSET, layout.pageChromeVisualSafeRight);
  const interactiveRightInset = measurements.sessionVisible ?
    Math.max(visualRightInset, layout.pageChromeInteractiveSafeRight) : visualRightInset;
  const visualRight = Math.max(visualLeft, layout.viewportWidth - visualRightInset);
  // Reuse the measured system-bar-height lane. In extended reading it
  // starts at zero; otherwise the same-height information lane follows it.
  const top = layout.pageChromeTopRegionHeight > 0 ? layout.pageChromeVisualSafeTop +
    Math.max(0, (layout.pageChromeTopRegionHeight - measurements.topStartHeight) / 2) :
    Math.max(READER_PAGE_CHROME_TOP_INSET, layout.pageChromeVisualSafeTop + READER_PAGE_CHROME_SAFE_TOP_GAP);
  const bottomInset = measurements.sessionVisible ?
    Math.max(READER_PAGE_CHROME_BOTTOM_INSET, layout.pageChromeInteractiveSafeBottom) :
    Math.max(READER_PAGE_CHROME_BOTTOM_INSET, layout.pageChromeVisualSafeBottom);
  const footerTop = Math.max(top, layout.viewportHeight - bottomInset - READER_PAGE_CHROME_FOOTER_HEIGHT);

  result.topStartX = visualLeft;
  result.topStartY = top;
  result.topEndX = Math.max(visualLeft, visualRight - measurements.topEndWidth);
  result.topEndY = top + Math.max(0, (measurements.topStartHeight - measurements.topEndHeight) / 2);
  result.topStartMaxWidth = Math.max(0,
    result.topEndX - READER_PAGE_CHROME_FOOTER_GAP - visualLeft);
  result.topEndMaxWidth = Math.max(0, visualRight - visualLeft);
  const accessoryHeight = layout.pageChromeTopRegionHeight > 0 ?
    Math.min(measurements.topAccessoryHeight, layout.pageChromeTopRegionHeight) : measurements.topAccessoryHeight;
  const accessoryWidth = Math.min(measurements.topAccessoryWidth, accessoryHeight);
  const rowHeight = Math.max(measurements.topStartHeight, measurements.topEndHeight, accessoryHeight);
  let topLeft = visualLeft;
  let topRight = visualRight;
  let topLeftLimit = visualRight;
  let topRightFloor = visualLeft;
  let rowTop = layout.pageChromeTopRegionHeight > 0 ? layout.pageChromeVisualSafeTop +
    Math.max(0, (layout.pageChromeTopRegionHeight - rowHeight) / 2) : top;
  const metrics = layout.pageChromeStatusMetrics;
  if (metrics !== undefined && metrics.ready && metrics.statusBarRect.height > 0) {
    // Public Window gives a region, not OEM status-glyph baselines. Centre our
    // measured text in that region and derive its edge clearance from the
    // current lane/rounded corners; never use a phone-model coordinate table.
    const rect = metrics.statusBarRect;
    rowTop = layout.pageChromeVisualSafeTop + Math.max(0, (rect.height - rowHeight) / 2);
    const left = Math.max(layout.pageChromeVisualSafeLeft, rect.left + rect.height / 2,
      cornerEdge(metrics.topLeftCorner, rowTop, true) + rowHeight / 2);
    const right = Math.min(layout.viewportWidth - layout.pageChromeVisualSafeRight,
      rect.left + rect.width - rect.height / 2,
      cornerEdge(metrics.topRightCorner, rowTop, false) - rowHeight / 2);
    const cutout = metrics.statusBarCutoutRect;
    const intersectsCutout = cutout.width > 0 && cutout.height > 0 &&
      rowTop < cutout.top + cutout.height && rowTop + rowHeight > cutout.top;
    const leftLimit = intersectsCutout ? Math.min(right, cutout.left - rowHeight / 2) : right;
    const rightFloor = intersectsCutout ? Math.max(left, cutout.left + cutout.width + rowHeight / 2) : left;
    topLeft = left;
    topRight = right;
    topLeftLimit = leftLimit;
    topRightFloor = rightFloor;
    result.topStartX = left;
    result.topStartY = rowTop + Math.max(0, (rowHeight - measurements.topStartHeight) / 2);
    result.topEndY = rowTop + Math.max(0, (rowHeight - measurements.topEndHeight) / 2);
    result.topEndMaxWidth = Math.max(0, right - rightFloor);
    result.topEndX = Math.max(rightFloor, right - Math.min(measurements.topEndWidth, result.topEndMaxWidth));
    result.topStartMaxWidth = Math.max(0, Math.min(leftLimit,
      result.topEndX - READER_PAGE_CHROME_FOOTER_GAP) - left);
  }

  if (accessoryWidth > 0) {
    // Preserve the complete clock width. A narrow cutout-side lane moves the
    // bookmark to the title lane instead of covering or hiding the clock.
    const gap = READER_PAGE_CHROME_FOOTER_GAP;
    const fitsWithClock = topRight - topRightFloor >= measurements.topEndWidth + gap + accessoryWidth;
    result.topAccessoryWidth = Math.min(accessoryWidth,
      Math.max(0, fitsWithClock ? topRight - topRightFloor : topLeftLimit - topLeft - gap));
    result.topAccessoryHeight = Math.min(accessoryHeight, result.topAccessoryWidth);
    result.topAccessoryX = fitsWithClock ? topRight - result.topAccessoryWidth : topLeft;
    result.topAccessoryY = rowTop + Math.max(0, (rowHeight - result.topAccessoryHeight) / 2);
    const clockRight = fitsWithClock ? result.topAccessoryX - gap : topRight;
    result.topEndMaxWidth = Math.max(0, clockRight - topRightFloor);
    result.topEndX = Math.max(topRightFloor, clockRight - Math.min(measurements.topEndWidth, result.topEndMaxWidth));
    result.topEndY = rowTop + Math.max(0, (rowHeight - measurements.topEndHeight) / 2);
    result.topStartX = fitsWithClock ? topLeft : topLeft + result.topAccessoryWidth + gap;
    result.topStartY = rowTop + Math.max(0, (rowHeight - measurements.topStartHeight) / 2);
    result.topStartMaxWidth = Math.max(0,
      Math.min(topLeftLimit, result.topEndX - gap) - result.topStartX);
  }

  result.footerRight = Math.max(visualLeft, layout.viewportWidth - interactiveRightInset);
  result.footerTop = footerTop;
  result.bottomStartX = visualLeft;
  result.bottomStartY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.bottomStartHeight) / 2);

  const reservedSession = measurements.sessionVisible ?
    measurements.sessionWidth + READER_PAGE_CHROME_FOOTER_GAP : 0;
  const footerLeftFloor = visualLeft + measurements.bottomStartWidth + READER_PAGE_CHROME_FOOTER_GAP;
  result.bottomEndMaxWidth = Math.max(0, result.footerRight - reservedSession - footerLeftFloor);
  const resolvedBottomEndWidth = Math.min(measurements.bottomEndWidth, result.bottomEndMaxWidth);
  result.sessionX = measurements.sessionVisible ?
    Math.max(visualLeft, result.footerRight - measurements.sessionWidth) : result.footerRight;
  result.sessionY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.sessionHeight) / 2);
  const bottomEndRight = measurements.sessionVisible ?
    result.sessionX - READER_PAGE_CHROME_FOOTER_GAP : result.footerRight;
  result.bottomEndX = Math.max(footerLeftFloor, bottomEndRight - resolvedBottomEndWidth);
  result.bottomEndY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.bottomEndHeight) / 2);
  result.bottomStartMaxWidth = Math.max(0,
    result.bottomEndX - READER_PAGE_CHROME_FOOTER_GAP - result.bottomStartX);
  return result;
}

function cornerEdge(corner: ReaderDisplayCornerVp, rowTop: number, left: boolean): number {
  if (corner.radius <= 0 || rowTop >= corner.y) return left ? 0 : Number.MAX_SAFE_INTEGER;
  const vertical = Math.min(corner.radius, Math.max(0, corner.y - rowTop));
  const horizontal = Math.sqrt(Math.max(0, corner.radius * corner.radius - vertical * vertical));
  return left ? corner.x - horizontal : corner.x + horizontal;
}

function finiteLength(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
