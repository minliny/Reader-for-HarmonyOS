import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { fixture as switchFixture, settle as settleSwitchOwner } from './lib/source-switch-owner-probe.mjs';
import { makeIndex as switchIndex } from './lib/source-switch-sdk-consumer.mjs';

const settleSwitch=async()=>{await settleSwitchOwner();await new Promise(setImmediate);await settleSwitchOwner();};
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

const Back = productionMotionMethods(file, ['consumeTemporaryBackBridge','isCurrentRuntime','onBackPress', 'currentSourceSwitchTransactionId','canRemoveDetailBook','isSameDetailBook']);
const f=switchFixture({shared:true,open:false}),x=switchIndex(f);x.index.openDetailSourceSwitch();await settleSwitch();x.mount().onSelectCandidate(f.candidate());await settleSwitch();
assert.equal(f.host.current().write.confirmation,'confirmed');assert.ok(f.host.current().pending.transactionId);
const switching = Object.assign(new Back(),x.index,{hasVisibleImportDialog:()=>false,jsonImportVisible:false,sourceSwitchVisible:false,
  route:'bookshelf',shelfReadingPreparation:true,
  nextNavigationGeneration:()=>assert.fail('Back must not orphan a committed source switch')});
assert.equal(switching.onBackPress(),true);
switching.detailBook={sourceId:'local',bookId:'other'};switching.readingSessionActive=false;
let left=false; switching.nextNavigationGeneration=()=>{}; switching.returnToBookshelf=()=>{left=true;};
assert.equal(switching.onBackPress(),true); assert.equal(left,true,JSON.stringify({book:switching.detailBook,snapshot:f.host.current()}));
for(const unknown of [false,true]){
 const pending=switchFixture({shared:true,open:false,...(unknown?{loseCommitAck:true,failExactQuery:true}:{})}),actual=switchIndex(pending);
 actual.index.openDetailSourceSwitch();await settleSwitch();actual.mount().onSelectCandidate(pending.candidate());await settleSwitch();
 if(unknown)assert.equal(pending.host.current().write.confirmation,'unknown');
 const protectedBack=Object.assign(new Back(),actual.index,{hasVisibleImportDialog:()=>false,jsonImportVisible:false,sourceSwitchVisible:false,
   route:'bookshelf',shelfReadingPreparation:true,nextNavigationGeneration:()=>assert.fail('accepted unknown source-switch intent cannot be orphaned')});
 assert.equal(protectedBack.onBackPress(),true);
 protectedBack.route='detail';protectedBack.readingSessionActive=false;protectedBack.pendingSourceSwitch=undefined;
 protectedBack.offlineOperationActive=false;protectedBack.shelfOperation={removalKey:'',busy:false};protectedBack.hasUnknownShelfWrite=()=>false;
 assert.equal(protectedBack.canRemoveDetailBook(protectedBack.detailBook),false,'source owner protects accepted commit/unknown even without stale page pending DTO');
 if(!unknown){protectedBack.sourceSwitchHost=undefined;protectedBack.offlineOperationActive=true;assert.equal(protectedBack.canRemoveDetailBook(protectedBack.detailBook),false,'actual offline busy DTO protects removal');protectedBack.offlineOperationActive=false;assert.equal(protectedBack.canRemoveDetailBook(protectedBack.detailBook),true);}

}
console.log('PASS original shelf dispatch: unread/read, local/remote; no snapshot prerequisite or loading overlay; source-switch Back protection. Device first-frame timing is not measured by this test.');
