import { TOK_BORDER_W } from './ReaderTokens';
import {
  APP_FLOATING_HEADER_BAR_HEIGHT,
  APP_FLOATING_HEADER_TOP_GAP,
  APP_HEADER_BAR_HEIGHT,
} from './ReaderHeaderMetrics';

// One threshold for raised shelf/detail chrome; consumers only publish a
// material change when content crosses this logical distance.
const RAISED_HEADER_SCROLL_THRESHOLD_VP: number = 4;

/**
 * Bookshelf floating header contract. The bar, its top inset and the gap below
 * the header are one surface: shell, content and route layers read the derived
 * frame/clearance instead of repeating 52/8/14 independently.
 */
export class BookshelfHeaderSpec {
  readonly titleFontSize: number = 19;
  readonly titleLineHeight: number = 28;
  readonly innerInset: number = 9;
  readonly actionExtent: number = 44;
  readonly iconExtent: number = 24;
  readonly panelRadius: number = 18;
  readonly minWindowInset: number = 8;
  readonly barHeight: number;
  readonly topInset: number;
  readonly contentGap: number;
  readonly contentUnderlap: number = 8;
  readonly scrollThreshold: number = RAISED_HEADER_SCROLL_THRESHOLD_VP;
  readonly frameHeight: number;
  readonly contentClearance: number;

  constructor(barHeight: number, topInset: number, contentGap: number) {
    this.barHeight = barHeight;
    this.topInset = topInset;
    this.contentGap = contentGap;
    this.frameHeight = barHeight + topInset;
    this.contentClearance = barHeight + topInset + contentGap;
  }
}

const BOOKSHELF_HEADER_SPEC = new BookshelfHeaderSpec(APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP, 14);

export function bookshelfHeaderSpec(): BookshelfHeaderSpec {
  return BOOKSHELF_HEADER_SPEC;
}

/**
 * Floating book-detail header. The measured bar replaces the fallback height;
 * content starts below the same top gap plus the registered content gap.
 */
export class DetailHeaderSpec {
  readonly topGap: number = APP_FLOATING_HEADER_TOP_GAP;
  readonly barHeight: number = APP_FLOATING_HEADER_BAR_HEIGHT;
  readonly contentGap: number = 16;
  readonly contentUnderlap: number = 8;
  readonly scrollThreshold: number = RAISED_HEADER_SCROLL_THRESHOLD_VP;

  headerTop(topInset: number): number {
    return Math.max(0, topInset) + this.topGap;
  }

  contentStart(topInset: number, measuredBarHeight: number): number {
    return this.headerTop(topInset) + Math.max(0, measuredBarHeight) + this.contentGap;
  }
}

const DETAIL_HEADER_SPEC = new DetailHeaderSpec();

export function detailHeaderSpec(): DetailHeaderSpec {
  return DETAIL_HEADER_SPEC;
}

/** First-layout fallback only; a measured header replaces it after mount. */
export function readerPageInitialHeaderHeight(kind: 'standard' | 'home' | 'bookshelf'): number {
  switch (kind) {
    case 'bookshelf': return BOOKSHELF_HEADER_SPEC.frameHeight;
    case 'standard':
    case 'home': return APP_HEADER_BAR_HEIGHT;
    default: throw new Error('Unknown Reader initial header kind');
  }
}

/**
 * Full-directory floating header. The measured host owns the live bar height;
 * the pre-measurement panel anchor and menu offset derive from the same spec.
 */
export class DirectoryHeaderSpec {
  readonly barHeight: number = 54;
  readonly radius: number = 24;
  readonly topGap: number = 18;
  readonly panelGap: number = 16;
  readonly controlHeight: number = 42;
  readonly menuGap: number = 2;
  readonly menuRowHeight: number = 42;

  fullPanelTop(topInset: number): number {
    return topInset + this.barHeight + this.panelGap;
  }

  menuTop(topInset: number): number {
    return topInset + this.barHeight + this.menuGap;
  }
}

const DIRECTORY_HEADER_SPEC = new DirectoryHeaderSpec();

export function directoryHeaderSpec(): DirectoryHeaderSpec {
  return DIRECTORY_HEADER_SPEC;
}

/**
 * Search header contract. The panel builder and the pre-measurement fallback
 * read the same values, so the first frame matches the natural-height panel.
 */
export class SearchHeaderSpec {
  readonly panelInnerInset: number = 12;
  readonly outerInsetPhone: number = 16;
  readonly outerInsetTablet: number = 20;
  readonly panelRadius: number = 18;
  readonly borderWidth: number = TOK_BORDER_W;
  readonly panelBottomGap: number = 6;
  readonly barPaddingLeft: number = 5;
  readonly barPaddingRight: number = 6;
  readonly barPaddingTop: number = 8;
  readonly barPaddingBottom: number = 8;
  readonly barHeightExtra: number;
  readonly filterMinHeight: number = 44;
  readonly filterLabelLineHeight: number = 17;
  readonly filterVerticalReserve: number = 12;
  readonly filterGroupBottomPadding: number = 8;
  readonly filterMinExpandedHeight: number = 88;
  readonly filterViewportReserve: number = 180;
  readonly unmeasuredViewportHeight: number = 300;
  readonly summaryMinHeight: number = 34;
  readonly summaryLineHeight: number = 21;
  readonly summaryStackedLineHeight: number = 39;
  readonly summaryPaddingTop: number = 4;
  readonly summaryPaddingBottom: number = 4;
  readonly summaryVerticalPadding: number;
  readonly summaryStackedWidth: number = 158;
  readonly statsFallbackHeight: number = 36;
  readonly statsPaddingTop: number = 4;
  readonly statsPaddingBottom: number = 4;
  readonly statsVerticalPadding: number;

  constructor() {
    this.barHeightExtra = this.barPaddingTop + this.barPaddingBottom;
    this.summaryVerticalPadding = this.summaryPaddingTop + this.summaryPaddingBottom;
    this.statsVerticalPadding = this.statsPaddingTop + this.statsPaddingBottom;
  }

  outerInset(expandedLayout: boolean): number {
    return expandedLayout ? this.outerInsetTablet : this.outerInsetPhone;
  }

  barHeight(controlHeight: number): number {
    return controlHeight + this.barHeightExtra;
  }

  filterHeight(fontScale: number): number {
    return Math.max(this.filterMinHeight, this.filterLabelLineHeight * fontScale + this.filterVerticalReserve);
  }
  filterLabelWidth(fontScale: number): number { return 51 * Math.max(1, fontScale); }

  summaryStacked(resultWidth: number, fontScale: number): boolean {
    const width = resultWidth - 24;
    return width > 0 && width < this.summaryStackedWidth * fontScale;
  }

  summaryHeight(stacked: boolean, fontScale: number): number {
    if (stacked) return this.summaryVerticalPadding + this.summaryStackedLineHeight * fontScale;
    return Math.max(this.summaryMinHeight, this.summaryVerticalPadding + this.summaryLineHeight * fontScale);
  }
}

const SEARCH_HEADER_SPEC = new SearchHeaderSpec();

export function searchHeaderSpec(): SearchHeaderSpec {
  return SEARCH_HEADER_SPEC;
}

/**
 * Natural height of the search panel before measurement. Border accounting:
 * the panel's top and bottom edge, plus the stats block's top rule whenever a
 * search session exists.
 */
export function readerSearchHeaderHeight(spec: SearchHeaderSpec, hasSession: boolean,
  filtersExpanded: boolean, barHeight: number, statsHeight: number, filterHeight: number,
  filterMaxHeight: number): number {
  const panel = barHeight + spec.panelBottomGap + 2 * spec.borderWidth;
  if (!hasSession) return panel;
  const filters = filtersExpanded ?
    Math.min(2 * filterHeight + spec.filterGroupBottomPadding, filterMaxHeight) : 0;
  return panel + statsHeight + filters + spec.borderWidth;
}
