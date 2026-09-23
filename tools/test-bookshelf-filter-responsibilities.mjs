import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const path = name => new URL(`../entry/src/main/ets/features/bookshelf/${name}.ets`, import.meta.url);
const source = name => readFileSync(path(name), 'utf8');
const books = [
  { sourceId: 'local', bookId: 'a', group: '', readProgress: 0 },
  { sourceId: 'online', bookId: 'b', group: '默认', readProgress: 1 },
  { sourceId: 'local', bookId: 'c', group: '历史', readProgress: 10000 },
  { sourceId: 'online', bookId: 'd', group: '', readProgress: 9900 },
  { sourceId: 'online', bookId: 'e', group: '默认', readProgress: 11000 },
  { sourceId: 'local', bookId: 'f', group: '默认', readProgress: NaN },
].map(Object.freeze);
const ids = rows => rows.map(b => b.bookId).join('');
assert.equal(ids(ShelfBookPresentation.visible(books, '')), 'abcdef');
assert.equal(ids(ShelfBookPresentation.visible(books, '默认', 'reading', 'online')), 'bd');
assert.equal(ids(ShelfBookPresentation.visible(books, '', 'finished', 'all')), 'ce');
assert.equal(ids(ShelfBookPresentation.visible(books, '', 'unread', 'local')), 'af');
assert.equal(ids(ShelfBookPresentation.visible(books, '历史', 'finished', 'local')), 'c');
assert.equal(ids(ShelfBookPresentation.visible(books, '默认', 'finished', 'local')), '');
assert.equal(books[2].group, '历史');

const shelfSource = source('BookshelfPage');
const memberNames = ['isFilterSelected','hasActiveFilters','selectFilter','clearFilters',
  'onShelfFiltersChanged','queueShelfProjection','requestCheckUpdates','isSectionActionActive','sectionActionLabel','sectionActionAsset','canonicalFilterActiveAsset'];
const { owner: shelf } = createReaderBuilderProbe(shelfSource, ['filterRow','filterChip',...memberNames]);
Object.assign(shelf, { appThemeScheme:'day', storedSelectedGroup:'', readingFilter:'all',sourceFilter:'all',
  filterRowVisible:true, viewMode:'list', mounted:true,projectionQueued:false,projectionGeneration:0, rebuildShelfProjection(){this.rebuilds=(this.rebuilds??0)+1;} });
shelf.filterRow();
const texts = owner => [...owner.nodes.values()].filter(n => n.type === 'Text');
const button = label => texts(shelf).find(n => n.create === label);
button('在读').onClick(); shelf.onShelfFiltersChanged(); button('在线').onClick(); shelf.onShelfFiltersChanged(); shelf.replay();
await Promise.resolve();assert.equal(shelf.rebuilds,1,'same gesture/storage notifications publish the final projection only once');
assert.equal(shelf.readingFilter,'reading');assert.equal(shelf.sourceFilter,'online');
assert.equal(button('在读').backgroundColor, readerAppColor('TOK_PRIMARY_SOFT','day'));
assert.equal(button('未读').backgroundColor, readerAppColor('TOK_CARD_BG','day'));
shelf.filterRowVisible=false;
assert.equal(shelf.isSectionActionActive('bookshelf_filter'),true,'closed filter keeps active-condition indication');
assert.match(shelf.sectionActionLabel('bookshelf_filter',true),/已有筛选条件/);
button('清除').onClick(); shelf.onShelfFiltersChanged(); shelf.replay();
await Promise.resolve();assert.equal(shelf.rebuilds,2,'clearing both dimensions is one reload');
assert.equal(shelf.readingFilter,'all');assert.equal(shelf.sourceFilter,'all');
assert.equal(shelf.isSectionActionActive('bookshelf_filter'),false);
// Run the surviving production filter closure after the group entry is removed.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const tree = ts.createSourceFile('BookshelfPage.ets',shelfSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const callbacks = new Map();
const visit = node => { if(ts.isCallExpression(node) && node.expression.getText(tree)==='this.sectionAction') {
  callbacks.set(node.arguments[0].text,node.arguments[1].getText(tree));
} ts.forEachChild(node,visit); }; visit(tree);
const invoke = key => new Function(stripTypeScriptTypes(`const action = ${callbacks.get(key)};`)+'; action();').call(shelf);
assert.deepEqual([...callbacks.keys()],['bookshelf_grid','bookshelf_list','bookshelf_filter']);
invoke('bookshelf_filter'); assert.equal(shelf.filterRowVisible,true);
invoke('bookshelf_filter'); assert.equal(shelf.filterRowVisible,false);
let updates=0; Object.assign(shelf,{hasOnlineBooks:true,updateRunning:false,backgroundUpdateRunning:false,onCheckUpdatesRequested:()=>updates++});
shelf.requestCheckUpdates(); assert.equal(updates,1);
shelf.backgroundUpdateRunning=true;shelf.requestCheckUpdates();assert.equal(updates,1);
shelf.backgroundUpdateRunning=false;shelf.hasOnlineBooks=false;shelf.requestCheckUpdates();assert.equal(updates,1);
assert.ok(!shelfSource.slice(shelfSource.indexOf('private filterRow()'),shelfSource.indexOf('private filterChip(')).includes('onCheckUpdates'));

const Batch = productionMotionMethods(path('BookshelfMultiSelectPage'),['visibleBooks','bookKey','reconcileSelection','removeVisibleSelection','toggleBook','hasBookKey','toggleAll','allSelected'],{ShelfBookPresentation});
let removed=[];
const batch = Object.assign(new Batch(),{books,storedSelectedGroup:'默认',readingFilter:'reading',sourceFilter:'online',selectedKeys:[],busy:false,ready:true,onRemoveSelected:k=>removed.push(k)});
assert.equal(ids(batch.visibleBooks()),'bd');batch.toggleAll();assert.equal(batch.selectedKeys.length,2);
batch.books=books.map(b=>b.bookId==='b'?{...b,readProgress:10000}:b);
batch.removeVisibleSelection();assert.deepEqual(removed,[['online\u0000d']],'a selected book hidden by a new progress value is never removed');
batch.sourceFilter='local';batch.reconcileSelection();assert.equal(batch.selectedKeys.length,0);
batch.toggleBook(books[1]);assert.equal(batch.selectedKeys.length,0,'stale recycled clicks cannot select hidden books');
batch.removeVisibleSelection();assert.equal(removed.length,1);
for(const text of [shelfSource,source('BookshelfMultiSelectPage')]) {
  for(const key of ['readerBookshelfSelectedGroup','readerBookshelfReadingFilter','readerBookshelfSourceFilter'])assert.ok(text.includes(`@StorageLink('${key}')`));
}
console.log('PASS shelf filters: state/type dimensions and live chips survive gear removal; shared order, legacy data and hidden batch-selection safety');
