import { ReaderRectVp, type ReaderWindowMetricsSnapshot } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport, type ReaderOverlayPlacement }
  from '../../../ui/layout/ReaderOverlayGeometry';

export const READER_TTS_CONFIG_BODY_GAP = 6;
export const READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING = 8;
export const READER_TTS_CONFIG_BODY_TOP_PADDING = 4;
export const READER_TTS_CONFIG_BODY_BOTTOM_PADDING = 8;
export const READER_TTS_CONFIG_CHOICE_GAP = 10;
export const READER_TTS_CONFIG_CHOICE_PAD_X = 12;
export const READER_TTS_CONFIG_VOICE_BADGE_WIDTH = 34;

const TTS_CONFIG_TARGET_SIZE_VP = 44;
const TTS_CONFIG_MARGIN_X = 16;
const TTS_CONFIG_MARGIN_Y = 12;
const TTS_CONFIG_ANCHOR_GAP = 4;

/** Window-local work area, with enough room retained for the close target. */
export function readerTtsConfigViewport(metrics: ReaderWindowMetricsSnapshot, preferredWidth: number,
  host?: ReaderRectVp): ReaderRectVp {
  const safe = readerOverlayViewport(metrics, host);
  const footprint = readerOverlayPanel(safe, preferredWidth, 0, 'bottom');
  const rect = host === undefined && metrics.keyboardArea.visible ?
    readerOverlayViewport(metrics, undefined, undefined, footprint) : safe;
  const marginX = Math.min(TTS_CONFIG_MARGIN_X, Math.max(0, (rect.width - TTS_CONFIG_TARGET_SIZE_VP) / 2));
  const marginY = Math.min(TTS_CONFIG_MARGIN_Y, Math.max(0, (rect.height - TTS_CONFIG_TARGET_SIZE_VP) / 2));
  return new ReaderRectVp(rect.left + marginX, rect.top + marginY,
    Math.max(0, rect.width - 2 * marginX), Math.max(0, rect.height - 2 * marginY));
}

export function readerTtsConfigChoiceTextWidth(panelWidth: number, panelBorder: number, voice: boolean,
  previewWidth: number, choiceBorder: number): number {
  const checkWidth = voice ? 16 : 11;
  const voiceChrome = voice ? READER_TTS_CONFIG_VOICE_BADGE_WIDTH + 2 * READER_TTS_CONFIG_CHOICE_GAP + previewWidth : 0;
  return Math.max(1, panelWidth - 2 * (panelBorder + READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING +
    choiceBorder + READER_TTS_CONFIG_CHOICE_PAD_X) - READER_TTS_CONFIG_CHOICE_GAP - checkWidth - voiceChrome);
}

/** Keep four large name glyphs per line before allowing a decorative preview label to consume their width. */
export function readerTtsConfigCompactVoicePreview(panelWidth: number, panelBorder: number,
  fullPreviewWidth: number, choiceBorder: number, nameGlyphWidth: number): boolean {
  return readerTtsConfigChoiceTextWidth(panelWidth, panelBorder, true, fullPreviewWidth, choiceBorder) < 4 * nameGlyphWidth;
}

export function readerTtsConfigChoiceHeight(primaryHeight: number, metaHeight: number, previewHeight: number,
  voice: boolean, borderWidth: number): number {
  return Math.ceil(Math.max(voice ? 54 : 44, primaryHeight + metaHeight + 16, voice ? previewHeight + 8 : 0) +
    2 * borderWidth);
}

export interface ReaderTtsConfigPanelBudget {
  headerHeight: number;
  bodyHeight: number;
  footerHeight: number;
  borderWidth: number;
  panelHeight: number;
}

/** The body is one native Column. Its visible rows, status and actions all share one spacing contract. */
export function readerTtsConfigPanelBudget(headerHeight: number, bodyItemHeights: number[], footerHeight: number,
  borderWidth: number): ReaderTtsConfigPanelBudget {
  const items = bodyItemHeights.filter((height: number): boolean => Number.isFinite(height) && height > 0);
  const frame = readerOverlayListHeight(headerHeight, 0, items.length, READER_TTS_CONFIG_BODY_GAP,
    READER_TTS_CONFIG_BODY_TOP_PADDING, READER_TTS_CONFIG_BODY_BOTTOM_PADDING, borderWidth, footerHeight);
  const bodyHeight = items.reduce((sum: number, height: number): number => sum + height, 0) +
    frame - headerHeight - footerHeight - 2 * borderWidth;
  return { headerHeight, bodyHeight, footerHeight, borderWidth,
    panelHeight: bodyHeight + headerHeight + footerHeight + 2 * borderWidth };
}

export interface ReaderTtsConfigPanelLayout {
  rect: ReaderRectVp;
  headerHeight: number;
  bodyHeight: number;
  compact: boolean;
  scrollRequired: boolean;
}

export function readerTtsConfigPanelLayout(viewport: ReaderRectVp, preferredWidth: number,
  budget: ReaderTtsConfigPanelBudget, placement: ReaderOverlayPlacement, anchor?: ReaderRectVp): ReaderTtsConfigPanelLayout {
  const rect = readerOverlayPanel(viewport, preferredWidth, budget.panelHeight, placement, anchor, TTS_CONFIG_ANCHOR_GAP);
  const interior = Math.max(0, rect.height - 2 * budget.borderWidth);
  const splitBodyHeight = interior - budget.headerHeight - budget.footerHeight;
  const compact = splitBodyHeight < Math.min(TTS_CONFIG_TARGET_SIZE_VP, budget.bodyHeight);
  const bodyHeight = compact ? interior : splitBodyHeight;
  return { rect, headerHeight: budget.headerHeight, bodyHeight, compact, scrollRequired: rect.height < budget.panelHeight };
}
