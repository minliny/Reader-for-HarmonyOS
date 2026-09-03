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
  for (const metric of metrics.chapters) {
    if (metric.scalarLength > 0 && absoluteScalar >= metric.cumulativeStart &&
      absoluteScalar < metric.cumulativeEnd) {
      return {
        chapterIndex: metric.chapterIndex,
        chapterOffset: absoluteScalar - metric.cumulativeStart,
      };
    }
  }
  return undefined;
}
