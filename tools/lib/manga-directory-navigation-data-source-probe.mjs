import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as layout from '../../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { readerDirectoryScopeKey } from '../../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';

export const mangaDirectoryNavigationListSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url), 'utf8');
/** Official platform cache is an IO seam; the complete production DataSource,
 * page-window and admission/notification methods are executed unchanged. */
export function productionMangaDirectoryNavigationDataSource(source = mangaDirectoryNavigationListSource) {
  class PlatformLRU {
    constructor(limit) { this.limit = limit; this.values = new Map(); }
    get(key) { const value = this.values.get(key); if (value !== undefined) { this.values.delete(key); this.values.set(key, value); } return value; }
    put(key, value) { this.values.delete(key); this.values.set(key, value); while (this.values.size > this.limit) this.values.delete(this.values.keys().next().value); }
    keys() { return [...this.values.keys()]; }
  }
  const header = source.slice(0, source.indexOf('/** Virtual, Core-paged')).replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '');
  return new Function('util', 'readerDirectoryScopeKey', ...Object.keys(layout),
    `${stripTypeScriptTypes(header)}; return { ReaderDirectoryNavigationDataSource, directoryPages, cacheReaderDirectoryNavigationPage };`)
    ({ LRUCache: PlatformLRU }, readerDirectoryScopeKey, ...Object.values(layout));
}
