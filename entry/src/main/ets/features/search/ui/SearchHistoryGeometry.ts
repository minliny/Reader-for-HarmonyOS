import { readerSearchHistoryControlHeight, SEARCH_CONTROL_MIN_TARGET, SEARCH_HISTORY_GAP } from '../../../ui/foundation/ReaderSearchControlGeometry';

/** Resolve the bounded viewport before choosing records. Record count never
 * controls panel height; the projection only admits complete rows. */
export class SearchHistoryGeometry {
  readonly innerInset: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly gap: number = SEARCH_HISTORY_GAP;
  readonly headingGap: number;
  readonly headingHeight: number;
  readonly buttonHeight: number;
  readonly feedbackHeight: number;
  readonly rows: number;
  readonly recordsVisible: boolean;
  readonly contentWidth: number;
  readonly bodyHeight: number;
  readonly headingVisible: boolean;
  readonly feedbackVisible: boolean;
  readonly emptyVisible: boolean;
  readonly emptyHeight: number;

  constructor(panelWidth: number, viewportHeight: number, fontScale: number,
    expandedLayout: boolean, status: string = '', measuredFeedbackHeight: number = 0,
    innerInsetOverride: number | undefined = undefined) {
    const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
    this.innerInset = innerInsetOverride !== undefined && Number.isFinite(innerInsetOverride) ?
      Math.max(0, innerInsetOverride) : expandedLayout ? 20 : 13;
    this.contentWidth = Math.max(0, panelWidth - this.innerInset * 2);
    const heading = Math.ceil(34 + 18 * (scale - 1));
    this.headingVisible = viewportHeight >= 8 + heading + 10 + 12;
    this.topInset = this.headingVisible ? 8 : 0;
    this.bottomInset = this.headingVisible ? 12 : 0;
    this.headingHeight = this.headingVisible ? heading : 0;
    this.headingGap = this.headingVisible ? 10 : 0;
    this.buttonHeight = searchHistoryButtonHeight(scale);
    const afterHeading = Math.max(0, viewportHeight - this.topInset - this.bottomInset - this.headingHeight - this.headingGap);
    const feedback = measuredFeedbackHeight > 0 ? measuredFeedbackHeight :
      status === 'loadFailed' || status === 'clearFailed' ? 96 * scale : status === 'loading' ? 72 * scale : 0;
    this.feedbackVisible = this.headingVisible && feedback > 0 && afterHeading >= feedback;
    this.feedbackHeight = this.feedbackVisible ? feedback : 0;
    this.bodyHeight = Math.max(0, viewportHeight - this.topInset - this.bottomInset -
      this.headingHeight - this.headingGap - this.feedbackHeight);
    const rowPitch = this.buttonHeight + this.gap;
    const rowsInViewport = Math.floor((this.bodyHeight + this.gap) / rowPitch);
    // Keep the width-based admission ceiling for long histories. The chosen
    // rows, rather than this ceiling, determine the height of the panel.
    const fixedHeight = this.topInset + this.headingHeight + this.headingGap + this.bottomInset + this.feedbackHeight;
    const rowLimit = Math.max(1, Math.floor((panelWidth * .64 - fixedHeight + this.gap) / rowPitch));
    this.rows = Math.max(0, Math.min(rowsInViewport, rowLimit));
    this.recordsVisible = this.headingVisible && this.contentWidth >= SEARCH_CONTROL_MIN_TARGET && this.rows > 0 &&
      (feedback === 0 || this.feedbackVisible);
    this.emptyHeight = Math.ceil(18 * scale);
    this.emptyVisible = this.headingVisible && this.bodyHeight >= this.emptyHeight && feedback === 0;
  }

  /** Exact panel height for the rows admitted by projectSearchHistoryRows. */
  contentHeight(rowCount: number, historyCount: number): number {
    const rows = Math.max(0, Math.floor(rowCount));
    const body = rows > 0 ?
      rows * this.buttonHeight + Math.max(0, rows - 1) * this.gap :
      historyCount === 0 && this.emptyVisible ? this.emptyHeight : 0;
    return this.topInset + this.headingHeight + this.headingGap + this.feedbackHeight + body + this.bottomInset;
  }
}

/** Width is resolved from the native label recipe, including control chrome. */
export class SearchHistoryChip {
  readonly keyword: string;
  readonly width: number;
  constructor(keyword: string, width: number) {
    this.keyword = keyword;
    this.width = width;
  }
}
export class SearchHistoryRow {
  readonly chips: SearchHistoryChip[] = [];
  width: number = 0;
}

/** Admit a newest continuous prefix. A newer long title starts the next row;
 * older short titles never jump ahead to fill a hole. Only a title wider than
 * an entire row is clamped, so its native one-line label can ellipsize. */
export function projectSearchHistoryRows(history: string[], geometry: SearchHistoryGeometry,
  measureControlWidth: (keyword: string) => number): SearchHistoryRow[] {
  const result: SearchHistoryRow[] = [];
  if (!geometry.recordsVisible) return result;
  for (const keyword of history) {
    const naturalWidth = measureControlWidth(keyword);
    // An unresolved native measure is not replaced with a character estimate.
    if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) break;
    const width = Math.min(geometry.contentWidth, Math.max(SEARCH_CONTROL_MIN_TARGET, Math.ceil(naturalWidth)));
    let row = result.length > 0 ? result[result.length - 1] : undefined;
    if (row === undefined || row.width + geometry.gap + width > geometry.contentWidth) {
      if (result.length >= geometry.rows) break;
      row = new SearchHistoryRow();
      result.push(row);
    }
    row.width += (row.chips.length > 0 ? geometry.gap : 0) + width;
    row.chips.push(new SearchHistoryChip(keyword, width));
  }
  return result;
}

export function searchHistoryButtonHeight(fontScale: number): number {
  return readerSearchHistoryControlHeight(fontScale);
}

export class SearchHistoryViewport {
  readonly height: number;
  readonly suppressContinueCard: boolean;
  constructor(desiredHeight: number, barBottom: number, availableBottom: number, continueCardBottom: number,
    continueCardTop: number = 0) {
    const available = Math.max(0, availableBottom - barBottom);
    this.height = Math.min(available, Math.max(0, Number.isFinite(desiredHeight) ? desiredHeight : 0));
    // Retire the card's visual and touch region when a compact panel would
    // otherwise leave a partial card exposed at its lower edge.
    const panelBottom = barBottom + this.height;
    this.suppressContinueCard = continueCardTop < panelBottom - .1 && continueCardBottom > panelBottom + .1;
  }
}
