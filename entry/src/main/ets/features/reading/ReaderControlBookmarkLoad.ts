import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';

export interface ReaderControlBookmarkProjectionHost {
  isCurrent: () => boolean;
  currentEntries: () => LocalReadingTocEntry[];
  read: (entries: LocalReadingTocEntry[], isCurrent: () => boolean) => Promise<LocalReadingTocEntry[]>;
  commit: (entries: LocalReadingTocEntry[]) => void;
}

/** Only bookmarks belong to this read. Titles and offline facts have other owners. */
export function mergeReaderControlBookmarkProjection(
  current: LocalReadingTocEntry[], projected: LocalReadingTocEntry[],
): LocalReadingTocEntry[] {
  const byChapter = new Map<number, LocalReadingTocEntry>();
  for (const entry of projected) {
    if (byChapter.has(entry.index)) throw new Error('Bookmark projection duplicate chapter');
    if (entry.bookmarks === undefined) throw new Error('Bookmark projection incomplete');
    byChapter.set(entry.index, entry);
  }
  const next: LocalReadingTocEntry[] = [];
  for (const entry of current) {
    const source = byChapter.get(entry.index);
    next.push({ index: entry.index, title: entry.title, level: entry.level, downloadState: entry.downloadState,
      ...(entry.navigable === undefined ? {} : { navigable: entry.navigable }),
      bookmarks: source === undefined ? entry.bookmarks : source.bookmarks });
  }
  return next;
}

/**
 * Read-only admission: the caller guards book/session/read/mutation identity.
 * Re-check after the await, and merge into the latest TOC, never the old input.
 * A rejected or superseded read leaves unknown facts unknown and is retryable.
 */
export async function loadReaderControlBookmarkProjection(
  host: ReaderControlBookmarkProjectionHost,
): Promise<void> {
  if (!host.isCurrent()) throw new Error('Bookmark projection superseded');
  const entries = await host.read(host.currentEntries(), host.isCurrent);
  if (!host.isCurrent()) throw new Error('Bookmark projection superseded');
  const merged = mergeReaderControlBookmarkProjection(host.currentEntries(), entries);
  for (const entry of merged) {
    // A catalog may grow during the read. Keep that new chapter unknown, and
    // expose retry rather than accepting an incomplete snapshot as ready.
    if (entry.bookmarks === undefined) throw new Error('Bookmark projection incomplete after directory change');
  }
  host.commit(merged);
}
