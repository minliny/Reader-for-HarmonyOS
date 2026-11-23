export interface SourceToolsRowLayoutInput {
  listWidth: number;
  fontScale: number;
  actionWidth: number;
  actionHeight: number;
  infoHeight: number;
  rowPadding: number;
  bottomBorderWidth: number;
  gap: number;
}

export interface SourceToolsRowLayout {
  inline: boolean;
  availableWidth: number;
  textMinWidth: number;
  actionsWidth: number;
  actionColumns: number;
  actionsMinHeight: number;
  rowMinHeight: number;
}

/** The List supplies its measured width after the shared Card has paid its
 * padding and border. Each native action keeps its growing fixed width. */
export function resolveSourceToolsRowLayout(input: SourceToolsRowLayoutInput): SourceToolsRowLayout {
  const availableWidth = Math.max(0, input.listWidth - input.rowPadding * 2);
  const textMinWidth = 120 * input.fontScale;
  const singleLineActions = input.actionWidth * 3 + input.gap * 2;
  const inline = availableWidth >= textMinWidth + input.gap + singleLineActions;
  const actionsWidth = Math.min(availableWidth, singleLineActions);
  const actionColumns = Math.max(1, Math.min(3,
    Math.floor((actionsWidth + input.gap) / (input.actionWidth + input.gap))));
  const actionRows = Math.ceil(3 / actionColumns);
  const actionsMinHeight = actionRows * input.actionHeight + (actionRows - 1) * input.gap;
  const bodyHeight = inline ? Math.max(input.infoHeight, actionsMinHeight) :
    input.infoHeight + input.gap + actionsMinHeight;
  return { inline, availableWidth, textMinWidth, actionsWidth, actionColumns,
    actionsMinHeight, rowMinHeight: Math.ceil(Math.max(58,
      bodyHeight + input.rowPadding * 2 + input.bottomBorderWidth)) };
}
