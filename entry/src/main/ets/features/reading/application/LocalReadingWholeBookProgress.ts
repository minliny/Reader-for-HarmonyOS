import type {
  LocalReadingChapterContentMetric,
  LocalReadingContentMetrics,
  LocalReadingTocEntry,
} from './LocalReadingFlowGateway';

export type LocalReadingWholeBookAnchor = {
  chapterIndex: number;
  chapterOffset: number;
};

/**
 * Ensures Core's cumulative scalar index describes the exact TOC order the
 * reader will navigate. No chapter-count or equal-weight fallback is allowed.
 */
export function validateContentMetricsAgainstToc(
  metrics: LocalReadingContentMetrics,
  toc: LocalReadingTocEntry[],
): void {
  if (metrics.chapters.length !== toc.length) {
    throw new Error('local_book.content.metrics chapter count does not match local_book.toc');
  }
  for (let index = 0; index < toc.length; index += 1) {
    if (metrics.chapters[index].chapterIndex !== toc[index].index) {
      throw new Error('local_book.content.metrics order does not match local_book.toc');
    }
  }
}

export function contentMetricForChapter(
  metrics: LocalReadingContentMetrics,
  chapterIndex: number,
): LocalReadingChapterContentMetric | undefined {
  for (const metric of metrics.chapters) {
    if (metric.chapterIndex === chapterIndex) {
      return metric;
    }
  }
  return undefined;
}

/** Exact processed-scalar whole-book percentage for the current anchor. */
export function wholeBookProgressPercent(
  metrics: LocalReadingContentMetrics,
  chapterIndex: number,
  chapterOffset: number,
): number {
  if (metrics.totalScalarLength <= 0) {
    return 0;
  }
  const metric = contentMetricForChapter(metrics, chapterIndex);
  if (metric === undefined) {
    return 0;
  }
  const safeOffset = Number.isSafeInteger(chapterOffset) ? chapterOffset : 0;
  const boundedOffset = Math.max(0, Math.min(metric.scalarLength, safeOffset));
  return Math.max(0, Math.min(
    100,
    ((metric.cumulativeStart + boundedOffset) / metrics.totalScalarLength) * 100,
  ));
}

/**
 * Resolves a slider percentage to one exact scalar anchor. The 100% endpoint
 * maps to the final real scalar rather than an imaginary EOF position.
 */
export function wholeBookAnchorForPercent(
  metrics: LocalReadingContentMetrics,
  percent: number,
): LocalReadingWholeBookAnchor | undefined {
  if (metrics.totalScalarLength <= 0 || !Number.isFinite(percent)) {
    return undefined;
  }
  const normalized = Math.max(0, Math.min(1, percent / 100));
  const absoluteScalar = normalized >= 1 ? metrics.totalScalarLength - 1 :
    Math.floor(normalized * metrics.totalScalarLength);
  let low = 0;
  let high = metrics.chapters.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (metrics.chapters[middle].cumulativeEnd <= absoluteScalar) low = middle + 1;
    else high = middle;
  }
  const metric = metrics.chapters[low];
  if (metric !== undefined && metric.scalarLength > 0 && absoluteScalar >= metric.cumulativeStart) {
    return { chapterIndex: metric.chapterIndex, chapterOffset: absoluteScalar - metric.cumulativeStart };
  }
  return undefined;
}

/** The Host admits a new Core metrics snapshot atomically. Its chapter array
 * is immutable until replacement; this bounded index belongs to that owner. */
export class LocalReadingContentMetricIndex {
  private source: LocalReadingContentMetrics | undefined = undefined;
  private byChapter: Map<number, LocalReadingChapterContentMetric> = new Map();
  forChapter(metrics: LocalReadingContentMetrics, chapterIndex: number): LocalReadingChapterContentMetric | undefined {
    if (metrics !== this.source) {
      this.byChapter.clear();
      for (const metric of metrics.chapters) this.byChapter.set(metric.chapterIndex, metric);
      this.source = metrics;
    }
    return this.byChapter.get(chapterIndex);
  }
  percent(metrics: LocalReadingContentMetrics, chapterIndex: number, chapterOffset: number): number {
    const metric = this.forChapter(metrics, chapterIndex);
    if (metric === undefined || metrics.totalScalarLength <= 0) return 0;
    const safeOffset = Number.isSafeInteger(chapterOffset) ? chapterOffset : 0;
    const bounded = Math.max(0, Math.min(metric.scalarLength, safeOffset));
    return Math.max(0, Math.min(100, (metric.cumulativeStart + bounded) / metrics.totalScalarLength * 100));
  }
}
