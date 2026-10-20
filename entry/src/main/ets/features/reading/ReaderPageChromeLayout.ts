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
// OpenHarmony SystemUI phone status_bar_padding_start/end. These are content
// paddings, not statusBarRect.height-derived guesses or OEM glyph coordinates.
// applications_systemui d0f84037f1975dd9bf13ccbd279bd2d9b56e8a01,
// features/statusbarcomponent/src/main/resources/phone/element/float.json.
export const READER_SYSTEM_STATUS_CONTENT_INSET = 24;
// Same-page VYG-AL30 captures show a ~12px optical difference for a 57px
// measured AUTO line. Use a proportional correction, not a device pixel
// offset; the complete line remains constrained to the measured status lane.
export const READER_SYSTEM_STATUS_TEXT_SHIFT_RATIO = 0.2;

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
  const metrics = layout.pageChromeStatusMetrics;
  // The authored information row occupies the system status-bar origin. A
  // visible status bar increases the visual safe inset for body content, but
  // must not push the row down a second time; the native bar covers this same
  // lane while controls are presented.
  const informationOrigin = metrics !== undefined && metrics.ready ?
    Math.max(0, metrics.statusBarRect.top) : layout.pageChromeVisualSafeTop;
  const statusHeight = metrics !== undefined && metrics.ready &&
    Number.isFinite(metrics.statusBarRect.height) && metrics.statusBarRect.height > 0 ?
    metrics.statusBarRect.height : 0;
  // The larger information lane reserves body/cutout clearance. Position
  // each label by its measured height relative to the actual status region;
  // neither extra clearance nor a bookmark may shift its vertical centre.
  const top = statusHeight > 0 ? statusContentTop(informationOrigin, statusHeight, measurements.topStartHeight) :
    layout.pageChromeTopRegionHeight > 0 ? informationOrigin +
    Math.max(0, (layout.pageChromeTopRegionHeight - measurements.topStartHeight) / 2) :
    Math.max(READER_PAGE_CHROME_TOP_INSET, informationOrigin + READER_PAGE_CHROME_SAFE_TOP_GAP);
  const bottomInset = measurements.sessionVisible ?
    Math.max(READER_PAGE_CHROME_BOTTOM_INSET, layout.pageChromeInteractiveSafeBottom) :
    Math.max(READER_PAGE_CHROME_BOTTOM_INSET, layout.pageChromeVisualSafeBottom);
  const footerTop = Math.max(top, layout.viewportHeight - bottomInset - READER_PAGE_CHROME_FOOTER_HEIGHT);

  result.topStartX = visualLeft;
  result.topStartY = top;
  result.topEndX = Math.max(visualLeft, visualRight - measurements.topEndWidth);
  result.topEndY = statusHeight > 0 ? statusContentTop(informationOrigin, statusHeight, measurements.topEndHeight) :
    top + Math.max(0, (measurements.topStartHeight - measurements.topEndHeight) / 2);
  result.topStartMaxWidth = Math.max(0,
    result.topEndX - READER_PAGE_CHROME_FOOTER_GAP - visualLeft);
  result.topEndMaxWidth = Math.max(0, visualRight - visualLeft);
  const topTrackHeight = statusHeight > 0 ? statusHeight : layout.pageChromeTopRegionHeight;
  const accessoryHeight = topTrackHeight > 0 ?
    Math.min(measurements.topAccessoryHeight, topTrackHeight) : measurements.topAccessoryHeight;
  const accessoryWidth = Math.min(measurements.topAccessoryWidth, accessoryHeight);
  const measuredRowHeight = Math.max(measurements.topStartHeight, measurements.topEndHeight, accessoryHeight);
  let topLeft = visualLeft;
  let topRight = visualRight;
  let topLeftLimit = visualRight;
  let topRightFloor = visualLeft;
  const fallbackRowTop = layout.pageChromeTopRegionHeight > 0 ? informationOrigin +
    Math.max(0, (layout.pageChromeTopRegionHeight - measuredRowHeight) / 2) : top;
  const accessoryTop = statusHeight > 0 ? informationOrigin + Math.max(0, (statusHeight - accessoryHeight) / 2) :
    fallbackRowTop + Math.max(0, (measuredRowHeight - accessoryHeight) / 2);
  const rowTop = statusHeight > 0 ? Math.min(result.topStartY, result.topEndY,
    accessoryWidth > 0 ? accessoryTop : Number.MAX_SAFE_INTEGER) : fallbackRowTop;
  const rowBottom = statusHeight > 0 ? Math.max(result.topStartY + measurements.topStartHeight,
    result.topEndY + measurements.topEndHeight, accessoryWidth > 0 ? accessoryTop + accessoryHeight : 0) :
    fallbackRowTop + measuredRowHeight;
  const rowHeight = Math.max(0, rowBottom - rowTop);
  if (metrics !== undefined && statusHeight > 0) {
    // Public Window gives a region, not OEM status-glyph baselines. Use the
    // upstream SystemUI content padding independently of the measured height,
    // then clamp it against this window's physical cutout and rounded corners.
    const rect = metrics.statusBarRect;
    // rowTop/rowHeight bound the newly positioned labels and accessory. Use
    // that same interval for physical cutout and corner clearance, including
    // an oversized accessibility line that extends below the status region.
    const left = Math.max(layout.pageChromeVisualSafeLeft, rect.left + READER_SYSTEM_STATUS_CONTENT_INSET,
      cornerEdge(metrics.topLeftCorner, rowTop, true));
    const right = Math.min(layout.viewportWidth - layout.pageChromeVisualSafeRight,
      rect.left + rect.width - READER_SYSTEM_STATUS_CONTENT_INSET,
      cornerEdge(metrics.topRightCorner, rowTop, false));
    const cutout = metrics.statusBarCutoutRect;
    const intersectsCutout = cutout.width > 0 && cutout.height > 0 &&
      rowTop < cutout.top + cutout.height && rowTop + rowHeight > cutout.top;
    const leftLimit = intersectsCutout ? Math.min(right, cutout.left - READER_PAGE_CHROME_FOOTER_GAP) : right;
    const rightFloor = intersectsCutout ? Math.max(left, cutout.left + cutout.width + READER_PAGE_CHROME_FOOTER_GAP) : left;
    topLeft = left;
    topRight = right;
    topLeftLimit = leftLimit;
    topRightFloor = rightFloor;
    result.topStartX = left;
    result.topEndMaxWidth = Math.max(0, right - rightFloor);
    result.topEndX = Math.max(rightFloor, right - Math.min(measurements.topEndWidth, result.topEndMaxWidth));
    result.topStartMaxWidth = Math.max(0, Math.min(leftLimit,
      result.topEndX - READER_PAGE_CHROME_FOOTER_GAP) - left);
  }

  if (accessoryWidth > 0) {
    // Keep the title/clock at their outer edges. Reserve the bookmark on the
    // inside, moving it to the title lane only when the clock-side lane is full.
    const gap = READER_PAGE_CHROME_FOOTER_GAP;
    const fitsWithClock = topRight - topRightFloor >= measurements.topEndWidth + gap + accessoryWidth;
    result.topAccessoryWidth = Math.min(accessoryWidth,
      Math.max(0, fitsWithClock ? topRight - topRightFloor : topLeftLimit - topLeft - gap));
    result.topAccessoryHeight = Math.min(accessoryHeight, result.topAccessoryWidth);
    result.topEndMaxWidth = Math.max(0, topRight - topRightFloor);
    result.topEndX = Math.max(topRightFloor, topRight - Math.min(measurements.topEndWidth, result.topEndMaxWidth));
    result.topAccessoryX = fitsWithClock ? result.topEndX - gap - result.topAccessoryWidth :
      Math.max(topLeft, Math.min(topLeftLimit, result.topEndX - gap) - result.topAccessoryWidth);
    result.topAccessoryY = statusHeight > 0 ?
      informationOrigin + Math.max(0, (statusHeight - result.topAccessoryHeight) / 2) :
      rowTop + Math.max(0, (rowHeight - result.topAccessoryHeight) / 2);
    if (statusHeight === 0) {
      result.topEndY = rowTop + Math.max(0, (rowHeight - measurements.topEndHeight) / 2);
      result.topStartY = rowTop + Math.max(0, (rowHeight - measurements.topStartHeight) / 2);
    }
    result.topStartX = topLeft;
    result.topStartMaxWidth = Math.max(0,
      Math.min(topLeftLimit, result.topAccessoryX - gap) - result.topStartX);
  }

  result.footerRight = Math.max(visualLeft, layout.viewportWidth - interactiveRightInset);
  result.footerTop = footerTop;
  result.bottomStartX = visualLeft;
  result.bottomStartY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.bottomStartHeight) / 2);

  const reservedSession = measurements.sessionVisible ?
    measurements.sessionWidth + READER_PAGE_CHROME_FOOTER_GAP : 0;
  // The right-hand percentage is a required status slot. Reserve it from the
  // right edge first, then let a long chapter title consume only the remaining
  // left width and ellipsize there; a long title must never hide progress.
  const footerEndRight = Math.max(visualLeft, result.footerRight - reservedSession);
  result.bottomEndMaxWidth = Math.max(0, footerEndRight - visualLeft);
  const resolvedBottomEndWidth = Math.min(measurements.bottomEndWidth, result.bottomEndMaxWidth);
  result.sessionX = measurements.sessionVisible ?
    Math.max(visualLeft, result.footerRight - measurements.sessionWidth) : result.footerRight;
  result.sessionY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.sessionHeight) / 2);
  const bottomEndRight = measurements.sessionVisible ?
    result.sessionX - READER_PAGE_CHROME_FOOTER_GAP : result.footerRight;
  result.bottomEndX = Math.max(visualLeft, bottomEndRight - resolvedBottomEndWidth);
  result.bottomEndY = footerTop + Math.max(0,
    (READER_PAGE_CHROME_FOOTER_HEIGHT - measurements.bottomEndHeight) / 2);
  result.bottomStartMaxWidth = Math.max(0,
    result.bottomEndX - READER_PAGE_CHROME_FOOTER_GAP - result.bottomStartX);
  return result;
}

function statusContentTop(origin: number, statusHeight: number, contentHeight: number): number {
  // H * (0.5 - 0.3 * h/H): centre the measured line, then account for the
  // observed system-clock optical track by 20% of that line's height. Clamp
  // short status regions / large text so the correction cannot overflow.
  const available = Math.max(0, statusHeight - contentHeight);
  return origin + Math.min(available, available / 2 + contentHeight * READER_SYSTEM_STATUS_TEXT_SHIFT_RATIO);
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
