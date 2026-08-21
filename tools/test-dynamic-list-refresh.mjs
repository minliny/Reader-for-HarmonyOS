import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const sourcePage = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const bookshelfPage = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');

assert.match(sourcePage,
  /@Prop @Watch\('onSourcesChanged'\) sources: BookSource\[\];/,
  'Core source snapshots must refresh the observable list projection');
assert.match(sourcePage,
  /class SourceListDataSource implements IDataSource[\s\S]*replace\(items: BookSource\[\]\)[\s\S]*listener\.onDataReloaded\(\)/,
  'the lazy source list must explicitly notify ArkUI when its projection is replaced');
assert.match(sourcePage,
  /LazyForEach\(this\.sourceDataSource,[\s\S]*this\.sourceRow\(source\)[\s\S]*this\.sourceRenderKey\(source\)/,
  'the variable-length source list must consume the notified lazy data source');
assert.doesNotMatch(sourcePage, /Repeat\(this\.filteredSources\(\)\)/,
  'a reusable virtual Repeat must not consume a fresh derived array on every render');
assert.match(sourcePage,
  /private rebuildSourceProjection\(\): void \{\s*const projected = this\.filteredSources\(\);\s*this\.sourceDataSource\.replace\(projected\);\s*this\.projectedSources = projected;\s*\}/,
  'filters and Core snapshots must atomically replace the projected source array');
assert.match(sourcePage,
  /private sourceRenderKey\(source: BookSource\): string \{[\s\S]*source\.sourceId[\s\S]*source\.enabled[\s\S]*source\.checkState/,
  'source row identity must change when displayed mutation state changes');

assert.match(bookshelfPage,
  /\(row: ShelfBook\[\], rowIndex: number\): string => this\.bookRowRenderKey\(row, rowIndex\)/,
  'bookshelf row identity must be derived from its current books, not only its row number');
assert.match(bookshelfPage,
  /private bookRowRenderKey\(row: ShelfBook\[\], rowIndex: number\): string \{[\s\S]*book\.sourceId[\s\S]*book\.bookId[\s\S]*book\.unreadCount[\s\S]*book\.readProgress/,
  'bookshelf row identity must cover every mutable card projection');

console.log('dynamic ArkUI list refresh contracts: PASS');
