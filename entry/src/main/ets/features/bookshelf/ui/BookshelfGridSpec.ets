import {
  TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_SELECTION_TITLE, TYPE_SHELF_SELECTION_TITLE_WIDE,
  TYPE_SHELF_SELECTION_AUTHOR, TYPE_SHELF_SELECTION_AUTHOR_WIDE,
} from '../../../ui/foundation/ReaderTypography';
import type { UIContext } from '@ohos.arkui.UIContext';
import { prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';

import {
  BOOKSHELF_LIST_COLUMN_GAP,
  BOOKSHELF_LIST_COVER_WIDTH,
  BOOKSHELF_LIST_COVER_HEIGHT,
  BOOKSHELF_LIST_CARD_PADDING,
  BOOKSHELF_LIST_DETAILS_GAP,
  bookshelfColumnCount,
  bookshelfListCardWidth,
} from './BookshelfListGeometry';

export {
  BOOKSHELF_LIST_COLUMN_GAP,
  BOOKSHELF_LIST_COVER_WIDTH,
  BOOKSHELF_LIST_COVER_HEIGHT,
  BOOKSHELF_LIST_CARD_PADDING,
  BOOKSHELF_LIST_DETAILS_GAP,
  bookshelfColumnCount,
  bookshelfListCardWidth,
};

const MAX_COLUMN_GAP = 30;
const MIN_COLUMN_GAP = TOK_SPACE_XS;
const PHONE_CARD_MAX_WIDTH = 96.656;
const TABLET_CARD_MAX_WIDTH = 186.672;
const COVER_RATIO = 4.1 / 3;
export const BOOKSHELF_LIST_TITLE_LINE_HEIGHT = 20;
export const BOOKSHELF_LIST_AUTHOR_LINE_HEIGHT = 16;
export const BOOKSHELF_LIST_CHAPTER_LINE_HEIGHT = 16;
export const BOOKSHELF_LIST_LATEST_LINE_HEIGHT = 16;
export const BOOKSHELF_LIST_PROGRESS_LINE_HEIGHT = 14;
export const BOOKSHELF_LIST_PROGRESS_STROKE = 4;
const BOOKSHELF_LIST_MIN_ROW_GAP = 1.5;
export const BOOKSHELF_GRID_TEXT_GAP = 6;
/** Runtime title line count. Figma `Library/BookCard` `493:196` exposes
 * TitleLines=1/2; product decision 2026-11-20 enables the two-line variant
 * on the bookshelf grid so long titles stay readable. See
 * docs/issues/bookshelf-cover-and-title-20261120.md. */
export const BOOKSHELF_GRID_TITLE_LINES = 2;
const PHONE_SELECTION_TEXT_MIN_HEIGHT = 191 - 145.44;
const TABLET_SELECTION_TEXT_MIN_HEIGHT = 325.3 - 280;

export interface BookshelfGridTextFrame {
  titleHeight: number;
  authorHeight: number;
  progressHeight: number;
  height: number;
}

export function bookshelfGridTextFrame(fontScale: number = 1, hasProgress: boolean = false,
  titleLines: number = 1): BookshelfGridTextFrame {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const lines = Number.isFinite(titleLines) && titleLines >= 1 ? Math.round(titleLines) : 1;
  const titleHeight = (TYPE_SHELF_LIST_TITLE.lineHeightFp as number) * scale * lines;
  const authorHeight = (TYPE_SHELF_LIST_AUTHOR.lineHeightFp as number) * scale;
  const progressHeight = (TYPE_SHELF_LIST_STATUS.lineHeightFp as number) * scale;
  return { titleHeight, authorHeight, progressHeight,
    height: BOOKSHELF_GRID_TEXT_GAP * 2 + titleHeight + authorHeight +
      (hasProgress ? BOOKSHELF_GRID_TEXT_GAP + progressHeight : 0) };
}

export interface BookshelfGridFrame {
  rowWidth: number;
  cardWidth: number;
  coverHeight: number;
  cardHeight: number;
  columnGap: number;
}

/** The shelf and multi-select share the width class and the cover grid. */
export function bookshelfGridFrame(contentWidth: number, expanded: boolean, fontScale: number = 1,
  hasProgress: boolean = false, titleLines: number = 1): BookshelfGridFrame {
  const usable = Math.max(0, contentWidth);
  const columns = bookshelfColumnCount(expanded);
  const cardMaxWidth = expanded ? TABLET_CARD_MAX_WIDTH : PHONE_CARD_MAX_WIDTH;
  const cardWidth = Math.min(cardMaxWidth,
    Math.max(0, (usable - MIN_COLUMN_GAP * (columns - 1)) / columns));
  const columnGap = Math.min(MAX_COLUMN_GAP,
    Math.max(MIN_COLUMN_GAP, (usable - cardWidth * columns) / (columns - 1)));
  const coverHeight = bookshelfCoverHeight(cardWidth, expanded);
  return {
    rowWidth: cardWidth * columns + columnGap * (columns - 1),
    cardWidth,
    coverHeight,
    cardHeight: coverHeight + bookshelfGridTextFrame(fontScale, hasProgress, titleLines).height,
    columnGap,
  };
}

export function bookshelfCoverHeight(cardWidth: number, _expanded: boolean): number {
  return cardWidth * COVER_RATIO;
}

export interface BookshelfListTextFrame {
  width: number;
  scale: number;
  titleLineHeight: number;
  authorLineHeight: number;
  chapterLineHeight: number;
  latestLineHeight: number;
  progressRowHeight: number;
  height: number;
}

export function bookshelfListTextFrame(fontScale: number = 1,
  textWidth: number = Number.MAX_SAFE_INTEGER): BookshelfListTextFrame {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const width = Number.isFinite(textWidth) ? Math.max(0, textWidth) : Number.MAX_SAFE_INTEGER;
  const titleLineHeight = BOOKSHELF_LIST_TITLE_LINE_HEIGHT * scale;
  const authorLineHeight = BOOKSHELF_LIST_AUTHOR_LINE_HEIGHT * scale;
  const chapterLineHeight = BOOKSHELF_LIST_CHAPTER_LINE_HEIGHT * scale;
  const latestLineHeight = BOOKSHELF_LIST_LATEST_LINE_HEIGHT * scale;
  const progressRowHeight = Math.max(BOOKSHELF_LIST_PROGRESS_STROKE, BOOKSHELF_LIST_PROGRESS_LINE_HEIGHT * scale);
  return {
    width, scale, titleLineHeight, authorLineHeight, chapterLineHeight, latestLineHeight, progressRowHeight,
    height: titleLineHeight + authorLineHeight + chapterLineHeight + latestLineHeight + progressRowHeight +
      4 * BOOKSHELF_LIST_MIN_ROW_GAP,
  };
}

export function bookshelfListTextHeight(fontScale: number = 1): number {
  return bookshelfListTextFrame(fontScale).height;
}

export function prepareBookshelfListTextFonts(): Promise<void> {
  return Promise.all([TYPE_SHELF_LIST_TITLE.fontFamily, TYPE_SHELF_LIST_AUTHOR.fontFamily,
    READER_FONT_NOTO_SANS_SC_UI_MEDIUM]
    .map((family: string): Promise<void> => prepareReaderFontFamily(family))).then((): void => {});
}

/** One active lane per list owner, shared by all rows and animation getters. */
export class BookshelfListTextBudget {
  private frame: BookshelfListTextFrame = bookshelfListTextFrame();
  resolve(_context: UIContext, width: number, scale: number, _fontRevision: number): BookshelfListTextFrame {
    width = Number.isFinite(width) ? Math.max(0, width) : 0;
    scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    if (width !== this.frame.width || scale !== this.frame.scale) {
      this.frame = bookshelfListTextFrame(scale, width);
    }
    return this.frame;
  }
}

export function bookshelfSelectionCardHeight(coverHeight: number, expanded: boolean, fontScale: number = 1): number {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const title = expanded ? TYPE_SHELF_SELECTION_TITLE_WIDE : TYPE_SHELF_SELECTION_TITLE;
  const author = expanded ? TYPE_SHELF_SELECTION_AUTHOR_WIDE : TYPE_SHELF_SELECTION_AUTHOR;
  const minimum = expanded ? TABLET_SELECTION_TEXT_MIN_HEIGHT : PHONE_SELECTION_TEXT_MIN_HEIGHT;
  const textHeight = ((title.lineHeightFp as number) + (author.lineHeightFp as number)) * scale + 6 * 2;
  return coverHeight + Math.max(minimum, textHeight);
}
