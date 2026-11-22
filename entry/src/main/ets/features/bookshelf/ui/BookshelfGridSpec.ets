import {
  TYPE_SHELF_LIST_TITLE, TYPE_SHELF_LIST_AUTHOR, TYPE_SHELF_LIST_STATUS,
  TYPE_SHELF_LIST_CHAPTER, TYPE_SHELF_METADATA_TAG,
  TYPE_SHELF_SELECTION_TITLE, TYPE_SHELF_SELECTION_TITLE_WIDE,
  TYPE_SHELF_SELECTION_AUTHOR, TYPE_SHELF_SELECTION_AUTHOR_WIDE,
} from '../../../ui/foundation/ReaderTypography';
import type { UIContext } from '@ohos.arkui.UIContext';
import { prepareReaderFontFamily, readerFontFamilyReady } from '../../../ui/foundation/ReaderFonts';
import { TOK_SPACE_XS } from '../../../ui/foundation/ReaderTokens';

const GRID_COLUMNS = 3;
const MAX_COLUMN_GAP = 30;
const MIN_COLUMN_GAP = TOK_SPACE_XS;
const PHONE_CARD_MAX_WIDTH = 96.656;
const PHONE_COVER_RATIO = 145.443 / PHONE_CARD_MAX_WIDTH;
const TABLET_CARD_MAX_WIDTH = 186.672;
const TABLET_COVER_RATIO = 280 / TABLET_CARD_MAX_WIDTH;
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

/** One geometry owner for the shelf grid and multi-select grid. Both pages
 *  keep three columns; card width is capped by width class and the column gap
 *  absorbs the remaining content width. */
export function bookshelfGridFrame(contentWidth: number, expanded: boolean, fontScale: number = 1,
  hasProgress: boolean = false, titleLines: number = 1): BookshelfGridFrame {
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
    cardHeight: coverHeight + bookshelfGridTextFrame(fontScale, hasProgress, titleLines).height,
    columnGap,
  };
}

export function bookshelfCoverHeight(cardWidth: number, expanded: boolean): number {
  return cardWidth * (expanded ? TABLET_COVER_RATIO : PHONE_COVER_RATIO);
}

export interface BookshelfListTextFrame {
  width: number;
  scale: number;
  stackTitle: boolean;
  stackStatus: boolean;
  metadataColumns: number;
  metadataWidth: number;
  metadataHeight: number;
  titleHeight: number;
  tagHeight: number;
  titleGroupHeight: number;
  statusHeight: number;
  readingGroupHeight: number;
  height: number;
}

interface BookshelfListTextMetrics {
  titleMinimumWidth: number;
  tagWidth: number;
  tagHeight: number;
  latestMinimumWidth: number;
  statusWidth: number;
  statusHeight: number;
}

const LIST_PROGRESS_LABELS: string[] = ['未读', '已读 <1%', '已读 100%', '*%'];
const LIST_TAG_LABELS: string[] = ['小说', '漫画', '有声', '本地', '在线'];

function bookshelfListFallbackMetrics(scale: number, width: number = Number.MAX_SAFE_INTEGER): BookshelfListTextMetrics {
  return { titleMinimumWidth: TYPE_SHELF_LIST_TITLE.fontSizeFp * scale,
    tagWidth: Math.max(30, TYPE_SHELF_METADATA_TAG.fontSizeFp * 2 * scale + 9),
    tagHeight: (TYPE_SHELF_METADATA_TAG.lineHeightFp as number) * scale *
      (Math.max(30, TYPE_SHELF_METADATA_TAG.fontSizeFp * 2 * scale + 9) > width ? 2 : 1) + 1,
    latestMinimumWidth: TYPE_SHELF_LIST_CHAPTER.fontSizeFp * scale,
    statusWidth: TYPE_SHELF_LIST_STATUS.fontSizeFp * 7 * scale,
    statusHeight: (TYPE_SHELF_LIST_STATUS.lineHeightFp as number) * scale *
      (TYPE_SHELF_LIST_STATUS.fontSizeFp * 7 * scale > width ? 7 : 1) };
}

/** Finite shelf labels use the same checked faces as their actual Text actors. */
function measureBookshelfListText(context: UIContext, width: number, scale: number): BookshelfListTextMetrics {
  const fallback = bookshelfListFallbackMetrics(scale, width);
  try {
    const utils = context.getMeasureUtils();
    const measure = (label: string, family: string, size: number, weight: number): number => {
      const measured = context.px2vp(utils.measureText({ textContent: label,
        fontFamily: family, fontSize: `${size * scale}vp`, fontWeight: weight }));
      if (!Number.isFinite(measured) || measured <= 0) throw new Error('shelf text width unavailable');
      return measured;
    };
    const tag = TYPE_SHELF_METADATA_TAG, status = TYPE_SHELF_LIST_STATUS;
    const tagWidth = Math.max(30, ...LIST_TAG_LABELS.map((label: string): number =>
      measure(label, tag.fontFamily, tag.fontSizeFp, tag.fontWeight) + 9));
    const statusWidth = Math.max(...LIST_PROGRESS_LABELS.map((label: string): number =>
      measure(label, status.fontFamily, status.fontSizeFp, status.fontWeight)));
    const wrappedHeight = (labels: string[], family: string, size: number, weight: number,
      line: number, padding: number): number => {
      const heights = labels.map((label: string): number => {
        const measured = context.px2vp(Number(utils.measureTextSize({ textContent: label,
          fontFamily: family, fontSize: `${size * scale}vp`, fontWeight: weight,
          lineHeight: `${line * scale}vp`, constraintWidth: `${Math.max(1, width - padding)}vp`,
          wordBreak: WordBreak.BREAK_WORD }).height));
        return Number.isFinite(measured) && measured > 0 ? measured : line * scale * label.length;
      });
      return Math.max(line * scale, ...heights);
    };
    return {
      titleMinimumWidth: Math.max(fallback.titleMinimumWidth,
        measure('…', TYPE_SHELF_LIST_TITLE.fontFamily, TYPE_SHELF_LIST_TITLE.fontSizeFp, TYPE_SHELF_LIST_TITLE.fontWeight)),
      tagWidth,
      tagHeight: tagWidth > width ? wrappedHeight(LIST_TAG_LABELS, tag.fontFamily, tag.fontSizeFp,
        tag.fontWeight, tag.lineHeightFp as number, 9) + 1 : (tag.lineHeightFp as number) * scale + 1,
      latestMinimumWidth: Math.max(fallback.latestMinimumWidth,
        measure('…', TYPE_SHELF_LIST_CHAPTER.fontFamily, TYPE_SHELF_LIST_CHAPTER.fontSizeFp, TYPE_SHELF_LIST_CHAPTER.fontWeight)),
      statusWidth,
      statusHeight: statusWidth > width ? wrappedHeight(LIST_PROGRESS_LABELS, status.fontFamily,
        status.fontSizeFp, status.fontWeight, status.lineHeightFp as number, 0) : (status.lineHeightFp as number) * scale,
    };
  } catch (_unavailableMeasurement) {
    return fallback;
  }
}

export function bookshelfListTextFrame(fontScale: number = 1, textWidth: number = Number.MAX_SAFE_INTEGER,
  metrics?: BookshelfListTextMetrics): BookshelfListTextFrame {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const width = Number.isFinite(textWidth) ? Math.max(0, textWidth) : Number.MAX_SAFE_INTEGER;
  const facts = metrics ?? bookshelfListFallbackMetrics(scale, width);
  const titleHeight = (TYPE_SHELF_LIST_TITLE.lineHeightFp as number) * scale;
  const metadataColumns = facts.tagWidth * 2 + 6 <= width ? 2 : 1;
  const metadataHeight = facts.tagHeight * (metadataColumns === 2 ? 1 : 2) + (metadataColumns === 2 ? 0 : 2);
  const stackTitle = width < facts.tagWidth * 2 + 12 + facts.titleMinimumWidth;
  const stackStatus = width < facts.statusWidth + 8 + facts.latestMinimumWidth;
  const titleGroupHeight = stackTitle ? titleHeight + 2 + metadataHeight : Math.max(titleHeight, metadataHeight);
  const chapterHeight = (TYPE_SHELF_LIST_CHAPTER.lineHeightFp as number) * scale;
  const readingGroupHeight = stackStatus ? chapterHeight + 2 + facts.statusHeight : Math.max(chapterHeight, facts.statusHeight);
  return { width, scale, stackTitle, stackStatus, metadataColumns,
    metadataWidth: Math.min(width, facts.tagWidth * metadataColumns + (metadataColumns === 2 ? 6 : 0)),
    metadataHeight, titleHeight, tagHeight: facts.tagHeight,
    titleGroupHeight, statusHeight: facts.statusHeight, readingGroupHeight,
    height: Math.max(72, titleGroupHeight + (TYPE_SHELF_LIST_AUTHOR.lineHeightFp as number) * scale +
      chapterHeight + readingGroupHeight + 2 * 4 + 3) };
}

/** Legacy callers retain the same inline minimum until they supply their lane. */
export function bookshelfListTextHeight(fontScale: number = 1): number {
  return bookshelfListTextFrame(fontScale).height;
}

export function prepareBookshelfListTextFonts(): Promise<void> {
  return Promise.all([TYPE_SHELF_LIST_TITLE.fontFamily, TYPE_SHELF_METADATA_TAG.fontFamily]
    .map((family: string): Promise<void> => prepareReaderFontFamily(family))).then((): void => {});
}

/** One active lane per list owner, shared by all rows and animation getters. */
export class BookshelfListTextBudget {
  private key: string = '';
  private frame: BookshelfListTextFrame = bookshelfListTextFrame();
  resolve(context: UIContext, width: number, scale: number, fontRevision: number): BookshelfListTextFrame {
    width = Number.isFinite(width) ? Math.max(0, width) : 0;
    scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const ready = readerFontFamilyReady(TYPE_SHELF_LIST_TITLE.fontFamily) &&
      readerFontFamilyReady(TYPE_SHELF_METADATA_TAG.fontFamily);
    const key = JSON.stringify([width, scale, fontRevision, ready]);
    if (key !== this.key) {
      const metrics = ready ? measureBookshelfListText(context, width, scale) : bookshelfListFallbackMetrics(scale, width);
      this.frame = bookshelfListTextFrame(scale, width, metrics);
      this.key = key;
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
