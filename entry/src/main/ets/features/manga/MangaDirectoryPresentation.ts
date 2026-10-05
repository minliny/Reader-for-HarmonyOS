import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';

export interface MangaDirectoryRowPresentation {
  parentTitle?: string;
  readableDescendantCount?: number;
  ancestorGroupIndexes: number[];
  group: boolean;
  countComplete: boolean;
}

export function mangaDirectoryIsGroup(entries: LocalReadingTocEntry[], ordinal: number): boolean {
  const entry = entries[ordinal];
  const level = entry?.level;
  const nextLevel = entries[ordinal + 1]?.level;
  return entry?.navigable === false && level !== undefined && Number.isInteger(level) && level >= 1 &&
    nextLevel !== undefined && Number.isInteger(nextLevel) && nextLevel > level;
}

/** One presentation of Core's explicit flat depth facts for all three manga
 * directories. This does not parse titles, infer missing parents, or create
 * navigable identities; those remain Core facts. */
export function mangaDirectoryPresentation(entries: LocalReadingTocEntry[]): Map<number, MangaDirectoryRowPresentation> {
  const presentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  const ancestors: LocalReadingTocEntry[] = [];
  for (let ordinal = 0; ordinal < entries.length; ordinal += 1) {
    const entry = entries[ordinal];
    const level = entry.level;
    if (level === undefined || !Number.isInteger(level) || level < 1) {
      for (const ancestor of ancestors) {
        const value = presentation.get(ancestor.index);
        if (value !== undefined) value.countComplete = false;
      }
      ancestors.length = 0;
      continue;
    }
    while (ancestors.length > 0 && (ancestors[ancestors.length - 1].level ?? 1) >= level) ancestors.pop();
    const parent = ancestors.length === 0 ? undefined : ancestors[ancestors.length - 1];
    const group = mangaDirectoryIsGroup(entries, ordinal);
    presentation.set(entry.index, { group, countComplete: true,
      ancestorGroupIndexes: ancestors.map((ancestor: LocalReadingTocEntry): number => ancestor.index),
      parentTitle: parent?.title, readableDescendantCount: group ? 0 : undefined });
    for (const ancestor of ancestors) {
      const value = presentation.get(ancestor.index);
      if (value === undefined) continue;
      if (entry.navigable === true) value.readableDescendantCount = (value.readableDescendantCount ?? 0) + 1;
      else if (entry.navigable === undefined) value.countComplete = false;
    }
    if (group) ancestors.push(entry);
  }
  return presentation;
}

export function mangaDirectoryVisibleEntries(entries: LocalReadingTocEntry[],
  presentation: Map<number, MangaDirectoryRowPresentation>, collapsedGroups: number[]): LocalReadingTocEntry[] {
  const collapsed: Set<number> = new Set<number>(collapsedGroups);
  return entries.filter((entry: LocalReadingTocEntry): boolean =>
    !(presentation.get(entry.index)?.ancestorGroupIndexes ?? []).some((index: number): boolean => collapsed.has(index)));
}
