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
  return READER_FLOATING_TAB_BAR_HEIGHT + readerFloatingTabBottomInset(metrics) + 16;
}
