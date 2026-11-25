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

export const SOURCE_ROW_ICON_WIDTH = 29;
export const SOURCE_STATUS_CHIP_GAP = 4;

/** Keep the two text lines together at narrow widths and large font scales. */
export function resolveSourceManagementLayout(input: SourceManagementLayoutInput): SourceManagementLayout {
  const scale = readerReadableFontScale(input.fontScale);
  const width = Math.max(0, input.availableWidth - 8);
  const leadingWidth = SOURCE_ROW_ICON_WIDTH + 8;
  const preferredTextWidth = 96 * scale;
  const trailingPreferredWidth = input.detectWidth + (input.hasLogin ? input.actionWidth + 8 : 0);
  const trailingWidth = Math.min(width, trailingPreferredWidth);
  const inlineTextWidth = width - leadingWidth - 8 - trailingPreferredWidth;
  const rowForm = inlineTextWidth >= preferredTextWidth ? 'inline' :
    width - leadingWidth >= preferredTextWidth ? 'stacked-actions' : 'stacked-leading';
  const textAvailableWidth = rowForm === 'inline' ? inlineTextWidth :
    rowForm === 'stacked-actions' ? width - leadingWidth : width;
  const textMinWidth = Math.min(preferredTextWidth, textAvailableWidth);
  // Detection and switching occupy separate touch rows. Login, when supported,
  // shares the switch row beside it.
  const actionRowCount = 2;
  const actionsHeight = input.actionHeight + (input.hasLogin ? Math.max(44, input.loginHeight) : 44);
  const infoHeight = (input.titleLineHeight + input.metaLineHeight) * scale + 3;
  const bodyHeight = Math.max(32, infoHeight);
  const rowMinHeight = Math.ceil(rowForm === 'inline' ? Math.max(bodyHeight + 16, actionsHeight) :
    bodyHeight + 8 + actionsHeight + (rowForm === 'stacked-leading' ? 40 : 0));
  return { rowForm, textMinWidth, textAvailableWidth, trailingWidth, actionsHeight, actionRowCount, rowMinHeight,
    filterHeight: input.filterHeight, footerHeight: Math.max(48, input.footerHeight),
    statusContentWidth: Math.ceil((2 * 54 + 3 * 66) * scale + 4 * SOURCE_STATUS_CHIP_GAP) };
}
