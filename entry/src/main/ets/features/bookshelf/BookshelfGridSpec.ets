import { TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_STATUS } from '../common/ReaderTypography';
import { TOK_SPACE_XS } from '../common/ReaderTokens';

const GRID_COLUMNS = 3;
const MAX_COLUMN_GAP = 30;
const MIN_COLUMN_GAP = TOK_SPACE_XS;
const PHONE_CARD_MAX_WIDTH = 96.656;
const PHONE_COVER_RATIO = 145.443 / PHONE_CARD_MAX_WIDTH;
const TABLET_CARD_MAX_WIDTH = 186.672;
const TABLET_COVER_RATIO = 280 / TABLET_CARD_MAX_WIDTH;
export const BOOKSHELF_GRID_TEXT_GAP = 6;

export interface BookshelfGridTextFrame {
  titleHeight: number;
  authorHeight: number;
  progressHeight: number;
  height: number;
}

export function bookshelfGridTextFrame(fontScale: number = 1, hasProgress: boolean = false): BookshelfGridTextFrame {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const titleHeight = (TYPE_SHELF_LIST_TITLE.lineHeightFp as number) * scale;
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

/** One geometry owner for the shelf grid and multi-select grid. Both pages
 *  keep three columns; card width is capped by width class and the column gap
 *  absorbs the remaining content width. */
export function bookshelfGridFrame(contentWidth: number, expanded: boolean, fontScale: number = 1,
  hasProgress: boolean = false): BookshelfGridFrame {
  const usable = Math.max(0, contentWidth);
  const cardMaxWidth = expanded ? TABLET_CARD_MAX_WIDTH : PHONE_CARD_MAX_WIDTH;
  const cardWidth = Math.min(cardMaxWidth,
    Math.max(0, (usable - MIN_COLUMN_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS));
  const columnGap = Math.min(MAX_COLUMN_GAP,
    Math.max(MIN_COLUMN_GAP, (usable - cardWidth * GRID_COLUMNS) / (GRID_COLUMNS - 1)));
  const coverHeight = cardWidth * (expanded ? TABLET_COVER_RATIO : PHONE_COVER_RATIO);
  return {
    rowWidth: cardWidth * GRID_COLUMNS + columnGap * (GRID_COLUMNS - 1),
    cardWidth,
    coverHeight,
    cardHeight: coverHeight + bookshelfGridTextFrame(fontScale, hasProgress).height,
    columnGap,
  };
}

export function bookshelfCoverHeight(cardWidth: number, expanded: boolean): number {
  return cardWidth * (expanded ? TABLET_COVER_RATIO : PHONE_COVER_RATIO);
}
