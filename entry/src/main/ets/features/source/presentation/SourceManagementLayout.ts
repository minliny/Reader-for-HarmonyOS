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
  trailingWidth: number;
  rowMinHeight: number;
  filterHeight: number;
  footerHeight: number;
  statusContentWidth: number;
}

/** Source's declared reading budget. 120vp at baseline is a product minimum,
 * not a measurement of arbitrary names. Long names/URLs still ellipsize;
 * font growth changes the arrangement instead of reducing the user's scale.
 * Control dimensions and line boxes come from their actual shared specs. */
export function resolveSourceManagementLayout(input: SourceManagementLayoutInput): SourceManagementLayout {
  const scale = readerReadableFontScale(input.fontScale);
  const width = Math.max(0, input.availableWidth - 8);
  const textMinWidth = 120 * scale;
  const actionCount = input.hasLogin ? 4 : 3;
  const trailingWidth = input.actionWidth * (input.hasLogin ? 2 : 1) + 24 + 44 + (actionCount - 1) * 8;
  const inlineTextWidth = width - 36 - 16 - trailingWidth;
  const rowForm = inlineTextWidth >= textMinWidth ? 'inline' :
    width - 44 >= textMinWidth ? 'stacked-actions' : 'stacked-leading';
  const textAvailableWidth = rowForm === 'inline' ? inlineTextWidth : rowForm === 'stacked-actions' ? width - 44 : width;
  const infoHeight = input.titleLineHeight * scale + input.metaLineHeight * scale * (input.hasSummary ? 2 : 1) + (input.hasSummary ? 16 : 8);
  const bodyHeight = rowForm === 'stacked-leading' ? infoHeight : Math.max(40, infoHeight);
  const rowMinHeight = Math.ceil(rowForm === 'inline' ? Math.max(76, bodyHeight + 16, input.actionHeight + 16) :
    16 + bodyHeight + 8 + input.actionHeight + (rowForm === 'stacked-leading' ? 48 : 0));
  return { rowForm, textMinWidth, textAvailableWidth, trailingWidth, rowMinHeight,
    filterHeight: input.filterHeight, footerHeight: Math.max(48, input.footerHeight),
    statusContentWidth: Math.ceil(318 * scale + 32) };
}
