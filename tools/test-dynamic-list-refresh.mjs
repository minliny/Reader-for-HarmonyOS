import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

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

const Page = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url).pathname, ['bookRowRenderKey']);
const page = new Page();
const classSource=bookshelfPage.slice(bookshelfPage.indexOf('class BookshelfRowDataSource'),bookshelfPage.indexOf('/**',bookshelfPage.indexOf('class BookshelfRowDataSource')));
const DS=new Function('DataOperationType',stripTypeScriptTypes(classSource)+';return BookshelfRowDataSource;')({ADD:'add',DELETE:'delete'});
const notices=[];const ds=new DS(row=>page.bookRowRenderKey(row,0));
ds.registerDataChangeListener({onDataReloaded:()=>notices.push('reload'),onDatasetChange:ops=>notices.push(...ops)});
const book=id=>({sourceId:'s',bookId:id,title:id,author:'author'});
const a=[book('a')],b=[book('b')],c=[book('c')];
ds.replace([a,b]);notices.length=0;
ds.replace([[{...a[0]}],[{...b[0]}]]);assert.deepEqual(notices,[],'equal projection does not invalidate mounted rows');
ds.replace([a,b,c]);assert.deepEqual(notices.map(n=>[n.type,n.index,n.count]),[['add',2,1]]);
notices.length=0;ds.replace([a,b]);assert.deepEqual(notices,[{type:'delete',index:2,count:1}]);
notices.length=0;ds.replace([b,a]);assert.deepEqual(notices,['reload'],'arbitrary permutations belong to native keyed comparison');
assert.equal(page.bookRowRenderKey(a,0),page.bookRowRenderKey(a,16),'row position never changes content identity');
assert.notEqual(page.bookRowRenderKey(a,0),page.bookRowRenderKey([{...a[0],readProgress:0.5}],0));
assert.notEqual(page.bookRowRenderKey([{...a[0],sourceId:'a:b',bookId:'c'}],0),page.bookRowRenderKey([{...a[0],sourceId:'a',bookId:'b:c'}],0));
console.log('PASS bookshelf append/trim native notifications, unchanged projection and position-independent identities');
