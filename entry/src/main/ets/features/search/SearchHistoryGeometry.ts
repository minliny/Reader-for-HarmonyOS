import { readerSearchHistoryControlHeight } from '../common/ReaderSearchControlGeometry';

/** Resolve the bounded viewport before choosing records. Record count never
 * controls panel height; the projection only admits complete rows. */
export class SearchHistoryGeometry {
  readonly innerInset: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly gap: number = 8;
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

  constructor(panelWidth: number, viewportHeight: number, fontScale: number,
    expandedLayout: boolean, status: string = '', measuredFeedbackHeight: number = 0) {
    const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
    this.innerInset = expandedLayout ? 20 : 13;
    this.contentWidth = Math.max(0, panelWidth - this.innerInset * 2);
    const heading = Math.max(32, 20 * scale + 8);
    this.headingVisible = viewportHeight >= 12 + heading + 8 + 16;
    this.topInset = this.headingVisible ? 12 : 0;
    this.bottomInset = this.headingVisible ? 16 : 0;
    this.headingHeight = this.headingVisible ? heading : 0;
    this.headingGap = this.headingVisible ? 8 : 0;
    this.buttonHeight = searchHistoryButtonHeight(scale);
    const afterHeading = Math.max(0, viewportHeight - this.topInset - this.bottomInset - this.headingHeight - this.headingGap);
    const feedback = measuredFeedbackHeight > 0 ? measuredFeedbackHeight :
      status === 'loadFailed' || status === 'clearFailed' ? 96 * scale : status === 'loading' ? 72 * scale : 0;
    this.feedbackVisible = this.headingVisible && feedback > 0 && afterHeading >= feedback;
    this.feedbackHeight = this.feedbackVisible ? feedback : 0;
    this.bodyHeight = Math.max(0, viewportHeight - this.topInset - this.bottomInset -
      this.headingHeight - this.headingGap - this.feedbackHeight);
    this.rows = Math.max(0, Math.floor((this.bodyHeight + this.gap) / (this.buttonHeight + this.gap)));
    this.recordsVisible = this.headingVisible && this.contentWidth > 0 && this.rows > 0 &&
      (feedback === 0 || this.feedbackVisible);
    this.emptyVisible = this.headingVisible && this.bodyHeight >= 18 * scale && feedback === 0;
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
    const width = Math.min(geometry.contentWidth, Math.ceil(naturalWidth));
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
  constructor(panelWidth: number, barBottom: number, availableBottom: number, continueCardBottom: number) {
    const available = Math.max(0, availableBottom - barBottom);
    const cardMinimum = continueCardBottom > barBottom ? continueCardBottom + 16 - barBottom : 0;
    this.height = Math.min(available, Math.max(Math.max(0, panelWidth) * .64, cardMinimum));
    // A very short IME/window retains shelf layout while retiring the obscured
    // card's visual/hit region, rather than exposing half of its outline.
    this.suppressContinueCard = cardMinimum > available + .1;
  }
}
