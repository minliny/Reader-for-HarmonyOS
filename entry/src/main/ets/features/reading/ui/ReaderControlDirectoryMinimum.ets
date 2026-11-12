import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderInheritedTextStyle, TYPE_READER_DIRECTORY_TAB_COMPACT, TYPE_READER_DIRECTORY_TITLE,
  TYPE_SEARCH_DIRECTORY_INPUT, TYPE_READER_DIRECTORY_CURRENT_TITLE, TYPE_READER_DIRECTORY_POSITION,
  TYPE_READER_BOOKMARK_CHAPTER, TYPE_READER_BOOKMARK_EXCERPT, TYPE_READER_BOOKMARK_META } from '../../../ui/foundation/ReaderTypography';
import { MESSAGE_BODY, MESSAGE_TITLE, MESSAGE_ACTION } from '../../../ui/foundation/ReaderMessageStyle';
import { TOK_SPACE_CONTROL_INLINE, TOK_SPACE_SM } from '../../../ui/foundation/ReaderTokens';
import type { ReaderControlCandidateWidths, ReaderControlFormMinimum } from './ReaderLayoutGeometry';
import type { ReaderControlBookmarkNaturalSize } from './ReaderControlBookmarkGeometry';
import { measureReaderControlText } from './ReaderControlTextMeasurement';

export interface ReaderDirectoryMinimumFacts {
  tab: string;
  title: string;
  excerpt: string;
  currentTitle: string;
  currentPosition: string;
  hasRows: boolean;
  loading: boolean;
  message: string;
  action: string;
  bookmarkError: boolean;
  catalogStatus: string;
  catalogAction: string;
}
export interface ReaderDirectoryFormProfile {
  minimum: ReaderControlFormMinimum;
  tabHeightVp: number;
  rowHeightVp: number;
  listTopVp: number;
  footerHeightVp: number;
  fieldHeightVp: number;
  inputHeightVp: number;
  toolbarHeightVp: number;
  statusHeightVp: number;
  bookmark: ReaderControlBookmarkNaturalSize;
}
export interface ReaderDirectoryMinimumProfile {
  quick: ReaderDirectoryFormProfile;
  full: ReaderDirectoryFormProfile;
}

/** One row is sufficient. The bookmark profile is a typography upper bound:
 * one declared title line and two declared excerpt lines, never all bookmarks. */
function form(context: UIContext, width: number, full: boolean,
  facts: ReaderDirectoryMinimumFacts): ReaderDirectoryFormProfile | undefined {
  if (!Number.isFinite(width) || width <= 0) return undefined;
  const tab = measureReaderControlText(context, '章节', TYPE_READER_DIRECTORY_TAB_COMPACT,
    Math.max(1, (width - (full ? 18 : 32)) / 2 - 20));
  const bookmarkTab = measureReaderControlText(context, '书签', TYPE_READER_DIRECTORY_TAB_COMPACT,
    Math.max(1, (width - (full ? 18 : 32)) / 2 - 20));
  const title = measureReaderControlText(context, facts.title, TYPE_READER_DIRECTORY_TITLE,
    Math.max(1, width - (full ? 22 : 34) - 86));
  const fieldWidth = width - 2 - TOK_SPACE_CONTROL_INLINE * 2 - (facts.tab === 'directory' ? 148 : 37);
  const field = measureReaderControlText(context, facts.tab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称',
    TYPE_SEARCH_DIRECTORY_INPUT, Math.max(1, fieldWidth - 39));
  const fieldGlyph = measureReaderControlText(context, '字', TYPE_SEARCH_DIRECTORY_INPUT, Math.max(1, fieldWidth - 39));
  const bookmarkTitle = measureReaderControlText(context, facts.title, TYPE_READER_BOOKMARK_CHAPTER, Math.max(1, width - 180));
  const bookmarkLine = measureReaderControlText(context, facts.excerpt, TYPE_READER_BOOKMARK_EXCERPT, Math.max(1, width - 62));
  const metaStyle = new ReaderInheritedTextStyle(TYPE_READER_BOOKMARK_META.fontFamily,
    undefined, TYPE_READER_BOOKMARK_META.fontSizeFp, undefined, undefined, 'system', 'appBaseline');
  const meta = measureReaderControlText(context, facts.currentPosition, metaStyle, Math.max(1, width - 40));
  const pending = measureReaderControlText(context, '待确认',
    new ReaderInheritedTextStyle(undefined, undefined, 8, undefined, undefined, 'system', 'appBaseline'), Math.max(1, width - 40));
  const positionStyle = new ReaderInheritedTextStyle(TYPE_READER_DIRECTORY_POSITION.fontFamily,
    undefined, TYPE_READER_DIRECTORY_POSITION.fontSizeFp, undefined, undefined, 'system', 'appBaseline');
  const footerLabel = measureReaderControlText(context, '当前章节', positionStyle, Math.max(1, width - 32));
  const footerPosition = measureReaderControlText(context, facts.currentPosition, positionStyle, Math.max(1, width - 32));
  const footerTitle = measureReaderControlText(context, facts.currentTitle,
    new ReaderInheritedTextStyle(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontFamily, TYPE_READER_DIRECTORY_CURRENT_TITLE.fontWeight,
      TYPE_READER_DIRECTORY_CURRENT_TITLE.fontSizeFp, undefined, undefined, 'system', 'appBaseline'), Math.max(1, width - 80));
  if (tab === undefined || bookmarkTab === undefined || title === undefined || field === undefined || fieldGlyph === undefined || bookmarkTitle === undefined ||
    bookmarkLine === undefined || meta === undefined || pending === undefined || footerLabel === undefined || footerPosition === undefined || footerTitle === undefined)
    return undefined;
  const tabBase = full ? 36 : 31;
  const tabHeight = Math.max(tabBase, tab.heightVp, bookmarkTab.heightVp, 15);
  const inputHeight = Math.max(24, field.heightVp);
  const fieldHeight = inputHeight + 8;
  const toolbarHeight = Math.max(52, fieldHeight + 20);
  const bookmark: ReaderControlBookmarkNaturalSize = {
    titleHeightVp: Math.max(14, bookmarkTitle.heightVp, meta.heightVp, pending.heightVp),
    excerptHeightVp: bookmarkLine.heightVp * 2,
  };
  const bookmarkHeight = Math.max(full ? 74 : 54, (full ? 9 : 7) + bookmark.titleHeightVp +
    (full ? 9 : 2) + bookmark.excerptHeightVp + (full ? 14 : 7));
  const rowHeight = facts.tab === 'bookmarks' ? bookmarkHeight : Math.max(full ? 40 : 32, title.heightVp, 32);
  const listTop = (full ? 99 : facts.tab === 'bookmarks' ? 47 : 48) + tabHeight - tabBase +
    (full ? toolbarHeight - 52 : 0);
  const footerHeight = facts.tab === 'directory' ? Math.max(48,
    2 + Math.max(footerLabel.heightVp, footerPosition.heightVp, footerTitle.heightVp)) : 0;
  let viewport = rowHeight;
  let statusHeight = 0;
  if (!facts.hasRows) {
    const message = measureReaderControlText(context, facts.message, MESSAGE_BODY, Math.max(1, width - (facts.tab === 'bookmarks' ? 40 : 4)), 'wrap');
    const action = measureReaderControlText(context, facts.action, MESSAGE_ACTION, Math.max(1, width - 36), 'wrap');
    const heading = measureReaderControlText(context, facts.bookmarkError ? '书签载入失败' : '暂无书签', MESSAGE_TITLE,
      Math.max(1, width - 40), 'wrap');
    if (message === undefined || action === undefined || heading === undefined) return undefined;
    if (facts.tab === 'bookmarks' && !facts.loading && !facts.bookmarkError) {
      // The original empty surface Scroll can expose the real return action.
      viewport = Math.max(44, action.heightVp);
    } else {
      viewport = message.heightVp + (facts.loading ? 44 : facts.action.length > 0 ? Math.max(44, action.heightVp) + 12 : 0);
      if (facts.bookmarkError) viewport += heading.heightVp + 72;
    }
  } else if (facts.catalogStatus.length > 0) {
    const action = measureReaderControlText(context, facts.catalogAction, MESSAGE_ACTION, Math.max(1, width - 36));
    if (action === undefined) return undefined;
    const actionWidth = facts.catalogAction.length > 0 ? action.singleLineWidthVp + 32 : 0;
    const status = measureReaderControlText(context, facts.catalogStatus, MESSAGE_BODY,
      Math.max(1, width - 22 - actionWidth), 'wrap');
    if (status === undefined) return undefined;
    statusHeight = Math.max(status.heightVp, facts.catalogAction.length > 0 ? Math.max(44, action.heightVp) : 0) + 4;
    viewport += statusHeight;
  }
  const minWidth = Math.max((Math.max(tab.singleLineWidthVp, bookmarkTab.singleLineWidthVp) + 20) * 2 + (full ? 18 : 32),
    full ? TOK_SPACE_CONTROL_INLINE * 2 + (facts.tab === 'directory' ? 148 : 37) + 39 + fieldGlyph.singleLineWidthVp : 0,
    full && facts.tab === 'directory' ? TOK_SPACE_SM * 2 + 20 + footerLabel.singleLineWidthVp + footerPosition.singleLineWidthVp + 16 : 0);
  return { minimum: { heightVp: listTop + viewport + 1 + (full ? footerHeight : 0), minWidthVp: minWidth,
    fits: width + .1 >= minWidth }, tabHeightVp: tabHeight, rowHeightVp: rowHeight, listTopVp: listTop,
    footerHeightVp: footerHeight, fieldHeightVp: fieldHeight, inputHeightVp: inputHeight,
    toolbarHeightVp: toolbarHeight, statusHeightVp: statusHeight, bookmark };
}

export function measureReaderDirectoryMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  facts: ReaderDirectoryMinimumFacts): ReaderDirectoryMinimumProfile | undefined {
  const quick = form(context, widths.quickContentWidthVp, false, facts);
  const full = form(context, widths.fullContentWidthVp, true, facts);
  return quick === undefined || full === undefined ? undefined : { quick, full };
}
