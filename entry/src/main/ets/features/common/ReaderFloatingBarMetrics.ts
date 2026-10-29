import { MAIN_TAB_LABEL_LINE_HEIGHT } from './ReaderLayoutTokens';
import { readerScaledControlHeight } from './ReaderSurfaceResolvers';
import { ReaderWindowMetricsSnapshot } from './ReaderWindowMetrics';
import { readerInteractiveSafeBottom } from './ReaderWindowMetrics';

// These are content clearances, not viewport padding. Scrolling surfaces keep
// their full size and carry the clearance inside their scrollable content.
export const READER_FLOATING_TOP_BAR_HEIGHT: number = 58;
export const READER_FLOATING_TAB_BAR_HEIGHT: number = 68;

export function readerFloatingBarBottomInset(metrics: ReaderWindowMetricsSnapshot, minimum: number): number {
  return Math.max(minimum, readerInteractiveSafeBottom(metrics));
}

export function readerFloatingTabBottomInset(metrics: ReaderWindowMetricsSnapshot): number {
  return Math.max(15, readerInteractiveSafeBottom(metrics));
}

export function readerFloatingTabContentInset(metrics: ReaderWindowMetricsSnapshot): number {
  return readerFloatingTabBarHeight(metrics.systemFontScale) + readerFloatingTabBottomInset(metrics) + 16;
}

/** Single size owner for the label growth in both navigation orientations. */
export function readerMainTabItemHeight(fontScale: number, vertical: boolean = false): number {
  return readerScaledControlHeight(vertical ? 58 : 50, MAIN_TAB_LABEL_LINE_HEIGHT, fontScale);
}

export function readerFloatingTabBarHeight(fontScale: number): number {
  return readerScaledControlHeight(READER_FLOATING_TAB_BAR_HEIGHT, MAIN_TAB_LABEL_LINE_HEIGHT, fontScale);
}
