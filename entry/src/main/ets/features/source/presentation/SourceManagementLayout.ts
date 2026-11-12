import { readerReadableFontScale } from '../../../ui/foundation/ReaderSurfaceResolvers';

export interface SourceManagementLayoutInput {
  availableWidth: number;
  fontScale: number;
  hasLogin: boolean;
  hasSummary: boolean;
  actionWidth: number;
  actionHeight: number;
  filterHeight: number;
  footerHeight: number;
  titleLineHeight: number;
  metaLineHeight: number;
}

export interface SourceManagementLayout {
  rowForm: 'inline' | 'stacked-actions' | 'stacked-leading';
  textMinWidth: number;
  textAvailableWidth: number;
  titleStacked: boolean;
  trailingWidth: number;
  actionsHeight: number;
  actionRowCount: number;
  rowMinHeight: number;
  filterHeight: number;
  footerHeight: number;
  statusContentWidth: number;
}

/** Source's preferred reading width changes the arrangement as fonts grow.
 * The physical safe host bounds that preference. Long names and URLs retain
 * their existing ellipsis behavior. Shared control specs supply the dimensions. */
export function resolveSourceManagementLayout(input: SourceManagementLayoutInput): SourceManagementLayout {
  const scale = readerReadableFontScale(input.fontScale);
  const width = Math.max(0, input.availableWidth - 8);
  const preferredTextWidth = 120 * scale;
  const actionCount = input.hasLogin ? 4 : 3;
  const trailingPreferredWidth = input.actionWidth * (input.hasLogin ? 2 : 1) + 24 + 44 + (actionCount - 1) * 8;
  const trailingWidth = Math.min(width, trailingPreferredWidth);
  const inlineTextWidth = width - 36 - 16 - trailingPreferredWidth;
  const rowForm = inlineTextWidth >= preferredTextWidth ? 'inline' :
    width - 44 >= preferredTextWidth ? 'stacked-actions' : 'stacked-leading';
  const textAvailableWidth = rowForm === 'inline' ? inlineTextWidth : rowForm === 'stacked-actions' ? width - 44 : width;
  const textMinWidth = Math.min(preferredTextWidth, textAvailableWidth);
  const titleStacked = textAvailableWidth < preferredTextWidth;
  const itemWidths = input.hasLogin ? [input.actionWidth, input.actionWidth, 24, 44] : [input.actionWidth, 24, 44];
  const itemHeights = input.hasLogin ? [input.actionHeight, input.actionHeight, 18, 44] : [input.actionHeight, 18, 44];
  let actionRowCount = 1;
  let usedWidth = 0;
  let lineHeight = 0;
  let actionsHeight = 0;
  for (let index = 0; index < itemWidths.length; index += 1) {
    const gap = usedWidth > 0 ? 8 : 0;
    if (usedWidth > 0 && usedWidth + gap + itemWidths[index] > trailingWidth) {
      actionsHeight += lineHeight + 8;
      actionRowCount += 1;
      usedWidth = 0;
      lineHeight = 0;
    }
    usedWidth += (usedWidth > 0 ? 8 : 0) + itemWidths[index];
    lineHeight = Math.max(lineHeight, itemHeights[index]);
  }
  actionsHeight += lineHeight;
  const infoHeight = input.titleLineHeight * scale + input.metaLineHeight * scale * (input.hasSummary ? 2 : 1) + (input.hasSummary ? 16 : 8) + (titleStacked ? input.metaLineHeight * scale + 6 : 0);
  const bodyHeight = rowForm === 'stacked-leading' ? infoHeight : Math.max(40, infoHeight);
  const rowMinHeight = Math.ceil(rowForm === 'inline' ? Math.max(76, bodyHeight + 16, actionsHeight + 16) :
    16 + bodyHeight + 8 + actionsHeight + (rowForm === 'stacked-leading' ? 48 : 0));
  return { rowForm, textMinWidth, textAvailableWidth, titleStacked, trailingWidth, actionsHeight, actionRowCount, rowMinHeight,
    filterHeight: input.filterHeight, footerHeight: Math.max(48, input.footerHeight),
    statusContentWidth: Math.ceil(318 * scale + 32) };
}
