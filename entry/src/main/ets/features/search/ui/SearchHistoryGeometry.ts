import {
  readerSearchHistoryRowHeight,
  SEARCH_CONTROL_MIN_TARGET,
  SEARCH_HISTORY_MAX_ROWS,
} from '../../../ui/foundation/ReaderSearchControlGeometry';

/** Resolve the bounded viewport before admitting history rows. Record count
 * never causes scrolling; at most SEARCH_HISTORY_MAX_ROWS complete rows show. */
export class SearchHistoryGeometry {
  readonly innerInset: number;
  readonly topInset: number;
  readonly bottomInset: number;
  readonly headingGap: number;
  readonly headingHeight: number;
  readonly fontScale: number;
  readonly rowHeight: number;
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
    this.fontScale = scale;
    this.innerInset = innerInsetOverride !== undefined && Number.isFinite(innerInsetOverride) ?
      Math.max(0, innerInsetOverride) : expandedLayout ? 20 : 14;
    this.contentWidth = Math.max(0, panelWidth - this.innerInset * 2);
    const heading = Math.ceil(24 * scale);
    this.headingVisible = viewportHeight >= 12 + heading + 6 + 12;
    this.topInset = this.headingVisible ? 12 : 0;
    this.bottomInset = this.headingVisible ? 12 : 0;
    this.headingHeight = this.headingVisible ? heading : 0;
    this.headingGap = this.headingVisible ? 6 : 0;
    this.rowHeight = readerSearchHistoryRowHeight(scale);
    const afterHeading = Math.max(0, viewportHeight - this.topInset - this.bottomInset - this.headingHeight - this.headingGap);
    const feedback = measuredFeedbackHeight > 0 ? measuredFeedbackHeight :
      status === 'loadFailed' || status === 'clearFailed' ? 96 * scale : status === 'loading' ? 72 * scale : 0;
    this.feedbackVisible = this.headingVisible && feedback > 0 && afterHeading >= feedback;
    this.feedbackHeight = this.feedbackVisible ? feedback : 0;
    this.bodyHeight = Math.max(0, viewportHeight - this.topInset - this.bottomInset -
      this.headingHeight - this.headingGap - this.feedbackHeight);
    const rowsInViewport = this.rowHeight > 0 ? Math.floor(this.bodyHeight / this.rowHeight) : 0;
    this.rows = Math.max(0, Math.min(rowsInViewport, SEARCH_HISTORY_MAX_ROWS));
    this.recordsVisible = this.headingVisible && this.contentWidth >= SEARCH_CONTROL_MIN_TARGET && this.rows > 0 &&
      (feedback === 0 || this.feedbackVisible);
    this.emptyHeight = Math.ceil(22 * scale);
    this.emptyVisible = this.headingVisible && this.bodyHeight >= this.emptyHeight && feedback === 0;
  }

  /** Exact panel height for the vertical rows admitted by projectSearchHistoryPanel. */
  contentHeight(rowCount: number, historyCount: number): number {
    const count = Math.max(0, Math.floor(rowCount));
    const body = count > 0 ? count * this.rowHeight :
      historyCount === 0 && this.emptyVisible ? this.emptyHeight : 0;
    return this.fixedHeight() + body;
  }

  fixedHeight(): number {
    return this.topInset + this.headingHeight + this.headingGap + this.feedbackHeight + this.bottomInset;
  }
}

export class SearchHistoryPanelLayout {
  readonly geometry: SearchHistoryGeometry;
  readonly items: string[];
  readonly height: number;

  constructor(geometry: SearchHistoryGeometry, items: string[], height: number) {
    this.geometry = geometry;
    this.items = items;
    this.height = height;
  }
}

export function projectSearchHistoryPanel(
  history: string[],
  geometry: SearchHistoryGeometry,
  unbounded: boolean = false,
): SearchHistoryPanelLayout {
  const canRenderItems = geometry.headingVisible && geometry.contentWidth >= SEARCH_CONTROL_MIN_TARGET &&
    (geometry.feedbackHeight === 0 || geometry.feedbackVisible);
  const items = unbounded ? (canRenderItems ? history.slice() : []) :
    (geometry.recordsVisible ? history.slice(0, geometry.rows) : []);
  return new SearchHistoryPanelLayout(geometry, items, geometry.contentHeight(items.length, history.length));
}

export function searchHistoryButtonHeight(fontScale: number): number {
  return readerSearchHistoryRowHeight(fontScale);
}

export class SearchHistoryViewport {
  readonly height: number;
  readonly suppressContinueCard: boolean = false;
  constructor(desiredHeight: number, barBottom: number, availableBottom: number, _continueCardBottom: number = 0,
    _continueCardTop: number = 0) {
    const available = Math.max(0, availableBottom - barBottom);
    this.height = Math.min(available, Math.max(0, Number.isFinite(desiredHeight) ? desiredHeight : 0));
  }
}
