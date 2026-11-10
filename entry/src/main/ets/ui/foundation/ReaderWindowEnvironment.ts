import { createDefaultReaderWindowMetrics, ReaderWindowMetricsSnapshot } from './ReaderWindowMetrics';

/** A read port, not another metrics store. The app retains the sole snapshot
 * and revision publisher; UI never receives the window or policy writer. */
export type ReaderWindowMetricsSource = () => ReaderWindowMetricsSnapshot;

let metricsSource: ReaderWindowMetricsSource | undefined = undefined;

/** Read the owner's current snapshot without copying, caching or publishing. */
export function readerWindowMetrics(): ReaderWindowMetricsSnapshot {
  return metricsSource === undefined ? createDefaultReaderWindowMetrics() : metricsSource();
}

/** Composition-only binding. A second owner cannot replace a live source.
 * Window install/detach continues inside the original coordinator, so this
 * process-lifetime read port requires no independent window lifecycle. */
export function bindReaderWindowMetricsSource(source: ReaderWindowMetricsSource): void {
  if (metricsSource !== undefined && metricsSource !== source) {
    throw new Error('Reader window metrics already has an owner');
  }
  metricsSource = source;
}
