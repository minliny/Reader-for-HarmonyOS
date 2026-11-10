import type { BookSource } from '../../source/application/SourceGateway';
import type { SearchSource } from '../../search/application/SearchGateway';
export type BookshelfNamedSource = BookSource | SearchSource;

export interface BookshelfSourceNameCandidate {
  readonly sourceId: string;
  readonly sourceName?: string;
}

/** One exact-source metadata policy shared by shelf and reading projections. */
export function readableBookshelfSourceName(sourceId: string, name: string): boolean {
  return name.length > 0 && name !== sourceId.trim() && name !== '书源名称暂不可用' &&
    name !== '书源已移除' && !/^[a-z][a-z0-9+.-]*:/i.test(name) && !/^www\./i.test(name);
}
export function bookshelfSourceDisplayName(sourceId: string, persistedName: string,
  sources: BookshelfNamedSource[][], candidate?: BookshelfSourceNameCandidate): string {
  if (sourceId === 'local') return '本地书籍';
  const saved = persistedName.trim();
  if (saved === '书源已移除' || readableBookshelfSourceName(sourceId, saved)) return saved;
  if (candidate?.sourceId === sourceId) {
    const name = candidate.sourceName?.trim() ?? '';
    if (readableBookshelfSourceName(sourceId, name)) return name;
  }
  for (const group of sources) for (const source of group) {
    const name = source.name.trim();
    if (source.sourceId === sourceId && readableBookshelfSourceName(sourceId, name)) return name;
  }
  return '书源名称暂不可用';
}
