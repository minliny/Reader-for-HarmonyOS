import type { ReaderControlCandidateWidths, ReaderControlCandidateMinimum,
  ReaderControlContentMeasurer } from './ReaderLayoutGeometry';

/** A provider may only answer the exact candidate it was asked to measure. */
export function readerControlMinimumReceiptMatches(candidate: ReaderControlCandidateMinimum,
  widths: ReaderControlCandidateWidths, key: string): boolean {
  return candidate.key === key && candidate.widths.panelWidthVp === widths.panelWidthVp &&
    candidate.widths.quickContentWidthVp === widths.quickContentWidthVp &&
    candidate.widths.fullContentWidthVp === widths.fullContentWidthVp;
}

/** Nearest preferred real fit wins; constrained states retain all observations.
 * The host still fences the frame/provider/generation before and after this call. */
export function measureReaderControlMinimumCandidates(widths: ReaderControlCandidateWidths[],
  identity: string, generation: number, measure: ReaderControlContentMeasurer,
  preferred: (candidate: ReaderControlCandidateMinimum) => boolean): ReaderControlCandidateMinimum[] {
  const measured: ReaderControlCandidateMinimum[] = [];
  for (const width of widths) {
    const key = `${identity}|${generation}|${width.panelWidthVp}`;
    const candidate = measure(width, key);
    if (candidate !== undefined && readerControlMinimumReceiptMatches(candidate, width, key)) {
      measured.push(candidate);
      if (preferred(candidate)) break;
    }
  }
  return measured;
}
