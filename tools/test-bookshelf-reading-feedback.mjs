import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
assert.doesNotMatch(source, /BookshelfReadingPreparation|正在打开/,
  'the rejected opening overlay must not exist in the shelf flow');
const Index = productionMotionMethods(file, ['openShelfBook'], {
  LOCAL_SOURCE_ID: 'local',
  ReaderRuntimeOwner: { current: () => ({ noteReadingPreparationIntent() {} }) },
});
for (const sourceId of ['local', 'online']) for (const previouslyRead of [false, true]) {
  const book = {sourceId,bookId:'book',title:'书籍',author:'作者',currentChapterIndex:previouslyRead?8:undefined};
  const calls = [];
  const host = Object.assign(new Index(), {route:'bookshelf',readingSessionActive:false,
    sourceDisplayName:()=> '书源',
    openLocalBookDetail:(selection,resume)=>calls.push({selection,resume}),
    openRemoteBookDetail:(seed,name,selection,resume)=>calls.push({selection,resume,seed,name}),
  });
  const result = host.openShelfBook(book);
  assert.equal(result, undefined, 'dispatch starts synchronously');
  assert.equal(calls.length,1,'every book starts the original reading flow without a prepared-page prerequisite');
  assert.equal(calls[0].selection,book); assert.equal(calls[0].resume,true);
  assert.equal(host.readingOriginRoute,'bookshelf');
}
assert.doesNotMatch(source,/BookshelfEntryCoordinator|ReaderEntryPage|entryPreparationOnly|preparedReadingEntry/);
const shelf = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url),'utf8');
assert.doesNotMatch(shelf,/bookEntryReady|正文准备中|entryReadyKeys/);

const Back = productionMotionMethods(file, ['onBackPress', 'currentSourceSwitchTransactionId']);
const switching = Object.assign(new Back(), {jsonImportVisible:false,sourceSwitchVisible:false,
  route:'bookshelf',shelfReadingPreparation:true,detailBook:{sourceId:'target',bookId:'book'},
  pendingSourceSwitch:{transactionId:'pending',targetSourceId:'target',targetBookId:'book'},
  nextNavigationGeneration:()=>assert.fail('Back must not orphan a committed source switch')});
assert.equal(switching.onBackPress(),true);
switching.detailBook={sourceId:'local',bookId:'other'};
let left=false; switching.nextNavigationGeneration=()=>{}; switching.returnToBookshelf=()=>{left=true;};
assert.equal(switching.onBackPress(),true); assert.equal(left,true);
console.log('PASS original shelf dispatch: unread/read, local/remote; no snapshot prerequisite or loading overlay; source-switch Back protection. Device first-frame timing is not measured by this test.');
