import { readerReadableFontScale } from '../../../ui/foundation/ReaderSurfaceResolvers';

export interface SourceManagementLayoutInput {
  availableWidth: number;
  fontScale: number;
  hasLogin: boolean;
  detectWidth: number;
  actionWidth: number;
  actionHeight: number;
  loginHeight: number;
  filterHeight: number;
  footerHeight: number;
  titleLineHeight: number;
  metaLineHeight: number;
}

export interface SourceManagementLayout {
  rowForm: 'inline' | 'stacked-actions' | 'stacked-leading';
  textMinWidth: number;
  textAvailableWidth: number;
  trailingWidth: number;
  actionsHeight: number;
  actionRowCount: number;
  rowMinHeight: number;
  filterHeight: number;
  footerHeight: number;
  statusContentWidth: number;
}

export const SOURCE_ROW_ICON_WIDTH = 34;
export const SOURCE_STATUS_CHIP_GAP = 5;
const SOURCE_ROW_GAP = 8;
const SOURCE_ROW_ACTION_GAP = 6;
const SOURCE_ROW_SWITCH_WIDTH = 44;

/** Keep the two text lines together at narrow widths and large font scales. */
export function resolveSourceManagementLayout(input: SourceManagementLayoutInput): SourceManagementLayout {
  const scale = readerReadableFontScale(input.fontScale);
  const width = Math.max(0, input.availableWidth - SOURCE_ROW_GAP);
  const leadingWidth = SOURCE_ROW_ICON_WIDTH + SOURCE_ROW_GAP;
  const preferredTextWidth = 96 * scale;
  const hasActions = input.detectWidth > 0;
  const trailingPreferredWidth = hasActions ? input.detectWidth + SOURCE_ROW_SWITCH_WIDTH + SOURCE_ROW_ACTION_GAP +
    (input.hasLogin ? input.actionWidth + SOURCE_ROW_ACTION_GAP : 0) : 0;
  const trailingWidth = Math.min(width, trailingPreferredWidth);
  const infoWidth = Math.max(0, width - leadingWidth);
  const inlineTextWidth = infoWidth - (hasActions ? SOURCE_ROW_GAP + trailingPreferredWidth : 0);
  const rowForm = inlineTextWidth >= preferredTextWidth ? 'inline' :
    infoWidth >= preferredTextWidth && hasActions ? 'stacked-actions' : 'stacked-leading';
  const textAvailableWidth = rowForm === 'inline' ? inlineTextWidth :
    rowForm === 'stacked-actions' ? infoWidth : width;
  const textMinWidth = Math.min(preferredTextWidth, textAvailableWidth);
  const actionRowCount = hasActions ? 1 : 0;
  const actionsHeight = hasActions ? Math.max(input.actionHeight, input.hasLogin ? input.loginHeight : 0) : 0;
  const infoHeight = (input.titleLineHeight + input.metaLineHeight) * scale + 3;
  const bodyHeight = rowForm === 'stacked-leading' ? SOURCE_ROW_ICON_WIDTH + SOURCE_ROW_GAP + infoHeight :
    Math.max(SOURCE_ROW_ICON_WIDTH, infoHeight);
  const rowMinHeight = Math.ceil(rowForm === 'inline' ? Math.max(bodyHeight, actionsHeight) + SOURCE_ROW_GAP :
    bodyHeight + (hasActions ? SOURCE_ROW_GAP + actionsHeight : 0));
  return { rowForm, textMinWidth, textAvailableWidth, trailingWidth, actionsHeight, actionRowCount, rowMinHeight,
    filterHeight: input.filterHeight, footerHeight: Math.max(48, input.footerHeight),
    statusContentWidth: input.availableWidth };
}
