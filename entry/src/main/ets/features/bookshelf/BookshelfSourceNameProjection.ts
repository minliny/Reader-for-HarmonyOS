import type { BookSource } from '../source/SourceGateway';
import type { SearchSource } from '../search/SearchGateway';
export type BookshelfNamedSource = BookSource | SearchSource;

/** One exact-source metadata policy shared by shelf and reading projections. */
export function readableBookshelfSourceName(sourceId: string, name: string): boolean {
  return name.length > 0 && name !== sourceId.trim() && name !== '书源名称暂不可用' &&
    name !== '书源已移除' && !/^[a-z][a-z0-9+.-]*:/i.test(name) && !/^www\./i.test(name);
}
export function bookshelfSourceDisplayName(sourceId: string, persistedName: string,
  sources: BookshelfNamedSource[][]): string {
  if (sourceId === 'local') return '本地书籍';
  const saved = persistedName.trim();
  if (saved === '书源已移除' || readableBookshelfSourceName(sourceId, saved)) return saved;
  for (const group of sources) for (const source of group) {
    const name = source.name.trim();
    if (source.sourceId === sourceId && readableBookshelfSourceName(sourceId, name)) return name;
  }
  return '书源名称暂不可用';
}
