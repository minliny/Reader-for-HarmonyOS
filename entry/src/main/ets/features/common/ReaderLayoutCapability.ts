import { ReaderWindowMetricsSnapshot } from './ReaderWindowMetrics';
import { readerIsExpandedWidth } from './ReaderWidthClass';

/** Layout capabilities come from current window facts; device type never
 * decides layout. Hosts pass the boolean capability down to their surfaces. */
export function readerExpandedLayout(metrics: ReaderWindowMetricsSnapshot): boolean {
  const width = metrics.windowRect.width;
  return Number.isFinite(width) && width > 0 && readerIsExpandedWidth(width);
}
