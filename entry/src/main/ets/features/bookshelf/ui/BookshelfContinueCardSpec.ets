import { TYPE_SHELF_ACTION, TYPE_SHELF_CONTINUE_AUTHOR, TYPE_SHELF_CONTINUE_TITLE } from '../../../ui/foundation/ReaderTypography';

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

/** Use the shelf's already-inset content frame. At narrow widths the action
 * moves below the book so the native text keeps its system scale. */
export function bookshelfContinueCardFrame(contentWidth: number, fontScale: number = 1): BookshelfContinueCardFrame {
  const width = Number.isFinite(contentWidth) ? Math.max(0, contentWidth) : 0;
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const coverWidth = 56;
  const coverHeight = 78;
  const gap = 14;
  const paddingHorizontal = Math.min(14, width * 0.05);
  const paddingVertical = 14;
  const textGap = 2;
  const titleHeight = (TYPE_SHELF_CONTINUE_TITLE.lineHeightFp as number) * scale;
  const metadataHeight = (TYPE_SHELF_CONTINUE_AUTHOR.lineHeightFp as number) * scale;
  const textMinHeight = titleHeight + metadataHeight * 3 + textGap * 3;
  const actionTextWidth = TYPE_SHELF_ACTION.fontSizeFp * scale * 2;
  const actionWidth = Math.min(Math.max(54, actionTextWidth + 20), Math.max(0, width - paddingHorizontal * 2));
  const actionLines = actionWidth < actionTextWidth ? 2 : 1;
  const actionHeight = Math.max(36, (TYPE_SHELF_ACTION.lineHeightFp as number) * scale * actionLines + 18);
  const textBudget = width - paddingHorizontal * 2 - coverWidth - gap * 2 - actionWidth;
  const actionBelow = textBudget < TYPE_SHELF_CONTINUE_TITLE.fontSizeFp * scale * 5;
  const bodyMinHeight = Math.max(coverHeight, textMinHeight, actionBelow ? 0 : actionHeight);
  return { width, coverWidth, coverHeight, gap, paddingHorizontal, paddingVertical, textGap,
    textMinHeight, bodyMinHeight, actionWidth, actionHeight, actionBelow,
    minHeight: paddingVertical * 2 + bodyMinHeight + (actionBelow ? gap + actionHeight : 0) };
}
