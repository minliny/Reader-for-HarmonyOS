import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';

/** Figma `Reader/ImmersiveInfo`/`Reader/ImmersiveFooterStatus` semantic tracks. */
export const READER_PAGE_CHROME_SIDE_INSET = 25;
export const READER_PAGE_CHROME_TOP_INSET = 25;
/** Minimum breathing room after a visible system status/cutout edge. */
export const READER_PAGE_CHROME_SAFE_TOP_GAP = 8;
export const READER_PAGE_CHROME_BOTTOM_INSET = 23;
export const READER_PAGE_CHROME_FOOTER_HEIGHT = 24;
export const READER_PAGE_CHROME_FOOTER_GAP = 5;

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
  }
}

export class ReaderPageChromeLayoutSnapshot {
  topStartX: number;
  topStartY: number;
  topStartMaxWidth: number;
  topEndX: number;
  topEndY: number;
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
  // In edge-to-edge windows the page coordinate origin remains above the
  // visible status-bar boundary. Anchoring exactly at visualSafeTop lets the
  // first glyph/icon row be clipped by the system compositor on real devices.
  // Preserve the authored 25vp position when no top inset exists, otherwise
  // place the row just below the live system/cutout edge. Eight vp still keeps
  // the row clear of the 72vp phone body track on current compact geometry.
  const top = Math.max(
    READER_PAGE_CHROME_TOP_INSET,
    layout.pageChromeVisualSafeTop + READER_PAGE_CHROME_SAFE_TOP_GAP,
  );
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

function finiteLength(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
