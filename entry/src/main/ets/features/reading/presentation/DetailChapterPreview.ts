import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';

const PREVIEW_LIMIT = 6;

/** Keep the current chapter and its neighbours in canonical directory order. */
export function detailChapterPreview(toc: LocalReadingTocEntry[], currentIndex: number,
  requireNavigationProof: boolean): LocalReadingTocEntry[] {
  const readable = toc.filter((entry: LocalReadingTocEntry): boolean =>
    requireNavigationProof ? entry.navigable === true : entry.navigable !== false);
  let cursor = readable.findIndex((entry: LocalReadingTocEntry): boolean => entry.index === currentIndex);
  if (cursor < 0 && currentIndex >= 0) {
    const following = readable.findIndex((entry: LocalReadingTocEntry): boolean => entry.index > currentIndex);
    cursor = following < 0 ? readable.length - 1 : following;
  }
  const start = cursor < PREVIEW_LIMIT ? 0 : Math.min(readable.length - PREVIEW_LIMIT, cursor - 2);
  return readable.slice(start, start + PREVIEW_LIMIT);
}
