import { MAIN_TAB_LABEL_LINE_HEIGHT } from '../foundation/ReaderLayoutTokens';
import { readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { ReaderWindowMetricsSnapshot } from '../foundation/ReaderWindowMetrics';
import { readerInteractiveSafeBottom } from '../foundation/ReaderWindowMetrics';

// These are content clearances, not viewport padding. Scrolling surfaces keep
// their full size and carry the clearance inside their scrollable content.
export const READER_FLOATING_TAB_BAR_HEIGHT: number = 68;

export function readerFloatingBarBottomInset(metrics: ReaderWindowMetricsSnapshot, minimum: number): number {
  return Math.max(minimum, readerInteractiveSafeBottom(metrics));
}

export function readerFloatingTabBottomInset(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(15, readerInteractiveSafeBottom(metrics));
}

/** The measured footer slot already contains the navigation's bottom margin.
 * Keep the authored size only until that occupied extent is available. */
export function readerFloatingTabContentInset(metrics: ReaderWindowMetricsSnapshot, occupiedFooterHeight: number = 0): number {
  const occupied = Number.isFinite(occupiedFooterHeight) && occupiedFooterHeight > 0 ? occupiedFooterHeight :
    readerFloatingTabBarHeight(metrics.systemFontScale) + readerFloatingTabBottomInset(metrics);
  return occupied + 16;
}

/** Single size owner for the label growth in both navigation orientations. */
export function readerMainTabItemHeight(fontScale: number, vertical: boolean = false): number {
  return readerScaledControlHeight(vertical ? 58 : 50, MAIN_TAB_LABEL_LINE_HEIGHT, fontScale);
}

export function readerFloatingTabBarHeight(fontScale: number): number {
  return readerScaledControlHeight(READER_FLOATING_TAB_BAR_HEIGHT, MAIN_TAB_LABEL_LINE_HEIGHT, fontScale);
}
