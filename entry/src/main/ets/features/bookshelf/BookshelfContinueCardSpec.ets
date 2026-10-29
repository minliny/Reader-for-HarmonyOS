import { TYPE_SHELF_ACTION, TYPE_SHELF_CONTINUE_AUTHOR, TYPE_SHELF_CONTINUE_TITLE } from '../common/ReaderTypography';

export interface BookshelfContinueCardFrame {
  width: number;
  coverWidth: number;
  coverHeight: number;
  gap: number;
  paddingHorizontal: number;
  paddingVertical: number;
  textGap: number;
  textMinHeight: number;
  bodyMinHeight: number;
  actionWidth: number;
  actionHeight: number;
  actionBelow: boolean;
  minHeight: number;
}

/** The recent book is inset independently of the shelf's section/list frame.
 * Typography remains at system scale; a narrow text budget moves the action
 * below the book instead of shrinking or clipping the native text. */
export function bookshelfContinueCardFrame(contentWidth: number, expanded: boolean,
  fontScale: number = 1): BookshelfContinueCardFrame {
  const usable = Number.isFinite(contentWidth) ? Math.max(0, contentWidth) : 0;
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const inset = Math.min(expanded ? 20 : 12, usable * 0.04);
  const width = Math.max(0, usable - inset * 2);
  const coverWidth = 48;
  const coverHeight = coverWidth * 1.5;
  const gap = 12;
  const paddingHorizontal = Math.min(12, width * 0.05);
  const paddingVertical = 14;
  const textGap = 2;
  const titleHeight = (TYPE_SHELF_CONTINUE_TITLE.lineHeightFp as number) * scale;
  const metadataHeight = (TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number) * scale;
  const textMinHeight = titleHeight + metadataHeight * 2 + textGap * 2;
  const actionTextWidth = TYPE_SHELF_ACTION.fontSizeFp * scale * 2;
  const actionWidth = Math.min(Math.max(54, actionTextWidth + 20), Math.max(0, width - paddingHorizontal * 2));
  const actionLines = actionWidth < actionTextWidth ? 2 : 1;
  const actionHeight = Math.max(40, (TYPE_SHELF_ACTION.lineHeightFp as number) * scale * actionLines + 24);
  const textBudget = width - paddingHorizontal * 2 - coverWidth - gap * 2 - actionWidth;
  const actionBelow = textBudget < TYPE_SHELF_CONTINUE_TITLE.fontSizeFp * scale * 5;
  const bodyMinHeight = Math.max(coverHeight, textMinHeight, actionBelow ? 0 : actionHeight);
  return { width, coverWidth, coverHeight, gap, paddingHorizontal, paddingVertical, textGap,
    textMinHeight, bodyMinHeight, actionWidth, actionHeight, actionBelow,
    minHeight: paddingVertical * 2 + bodyMinHeight + (actionBelow ? gap + actionHeight : 0) };
}
