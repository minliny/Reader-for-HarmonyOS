import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture as switchFixture, settle as settleSwitchOwner } from './lib/source-switch-owner-probe.mjs';
import { makeSourceSwitchFixture } from './lib/source-switch-sdk-consumer.mjs';

const settleSwitch=async()=>{await settleSwitchOwner();await new Promise(setImmediate);await settleSwitchOwner();};
const file = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
assert.doesNotMatch(source, /BookshelfReadingPreparation|正在打开/,
  'the rejected opening overlay must not exist in the shelf flow');
// Execute current EntryActions -> EntryPresentation -> actual ReadingEntryHost.
// Observe Host inputs and Core/OS ports rather than replacing entry methods.
const { currentSourceSwitchOwners } = await import('./lib/source-switch-current-owner-probe.mjs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const Dispatch=selectedProductionMethods(file,'Index',['openShelfBook']);
for (const sourceId of ['local', 'online']) for (const previouslyRead of [false, true]) {
  const book = {sourceId,bookId:'book',title:'书籍',author:'作者',currentChapterIndex:previouslyRead?8:undefined};
  const f=switchFixture({shared:true,open:false}),x=currentSourceSwitchOwners(f);
  x.navigation.show('bookshelf');
  const calls=[],prototype=x.entry.host.constructor.prototype,local=prototype.openLocal,remote=prototype.openRemote;
  prototype.openLocal=function(selection,lease,resume){calls.push({shelfSnapshot:selection,resumeImmediately:resume});return local.call(this,selection,lease,resume);};
  prototype.openRemote=function(input,lease){calls.push(input);return remote.call(this,input,lease);};
  let result;
  try {result=Dispatch.prototype.openShelfBook.call({readingEntryActions:x.actions},book);}
  finally {prototype.openLocal=local;prototype.openRemote=remote;}
  assert.equal(result,undefined,'dispatch starts synchronously');
  const host=x.entry.host;
  assert.ok(host,'actual entry Host owns each shelf dispatch');
  assert.equal(calls.length,1,'one real Host entry per shelf dispatch');
  assert.equal(calls[0].shelfSnapshot,book);assert.equal(calls[0].resumeImmediately,true);
  assert.equal(x.preparationIntents.length,sourceId==='local'?0:1,'one actual online shelf preparation intent; local dispatch has none');
  assert.equal(x.entry.book.sourceId,sourceId);assert.equal(x.entry.book.bookId,book.bookId);
  assert.equal(x.entry.sessionActive,true,'read/unread local/remote mounts the retained reader synchronously');
  assert.equal(x.navigation.snapshot().route,'reading');
  assert.equal(x.navigation.returns.snapshot().readingOrigin,'bookshelf');
  assert.equal(f.calls.some(([method])=>method==='chapter.content'),false,'dispatch does not wait for a body probe');
  x.close();f.host.retire();
}
assert.doesNotMatch(source,/BookshelfEntryCoordinator|ReaderEntryPage|entryPreparationOnly|preparedReadingEntry/);
const shelf = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets',import.meta.url),'utf8');
assert.doesNotMatch(shelf,/bookEntryReady|正文准备中|entryReadyKeys/);

const { installedEtsCompiler }=await import('./lib/ets-compiler-runtime.mjs');
const { pureModuleProbe }=await import('./lib/ets-pure-module-probe.mjs');
const { read }=await import('./lib/source-switch-owner-probe.mjs');
const { BookshelfDetailPresentation }=pureModuleProbe(read('features/bookshelf/presentation/BookshelfDetailPresentation.ets'),
 'BookshelfDetailPresentation.ets',{Observed:value=>value,EMPTY_READABLE_ADMISSION:{generation:0,adding:false,cancelling:false,confirmation:'none'}},['BookshelfDetailPresentation']);
// Compile the current Index's exact detail guard, without copying its decision.
const {ts,options}=installedEtsCompiler();
const tree=ts.createSourceFile('Index.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const detailField=tree.statements.find(node=>node.name?.text==='Index').members.find(node=>node.name?.getText(tree)==='detailShelf');
assert.ok(detailField?.initializer);
const detailCode=ts.transpileModule('const result='+detailField.initializer.getText(tree)+';',
 {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const makeDetail=x=>new Function('BookshelfDetailPresentation',detailCode+';return result;').call({
 readingEntry:x.entry,sourceSwitchPresentation:x.source,shelfMutations:{snapshot:{busy:false,removalKey:''},hasUnknownWrite:()=>false},
 route:'detail',mountedRuntimeOwner:x.entry.host.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:1,
 isCurrentRuntime:()=>true,
},BookshelfDetailPresentation);
const back=x=>x.navigation.dispatchBack({bookshelfGroup:()=>false,temporaryOwner:()=>x.entry.host.runtime,
 onTemporaryFailure:error=>{throw error;},shelfPreparation:()=>x.exit.cancelShelfPreparation(),
 destination:()=>assert.fail('a shelf preparation dispatch must use its existing exit owner')});
for(const unknown of [false,true]){
 const f=switchFixture({shared:true,open:false,...(unknown?{loseCommitAck:true,failExactQuery:true}:{})}),x=makeSourceSwitchFixture(f);
 x.switchJourney.openDetail();await settleSwitch();x.mount().onSelectCandidate(f.candidate());await settleSwitch();
 assert.equal(f.host.current().write.confirmation,unknown?'unknown':'confirmed');if(!unknown)assert.ok(f.host.current().pending.transactionId);
 x.navigation.show('bookshelf');x.actions.shelfPreparing=true;
 const generation=x.navigation.snapshot().generation;
 assert.equal(back(x),true);assert.equal(x.navigation.snapshot().generation,generation,'accepted confirmed/unknown cannot be orphaned');
 if(!unknown){
  const retained=x.entry.book,returnToBookshelf=x.exit.ports.returnToBookshelf;
  x.entry.book={sourceId:'local',bookId:'other'};x.entry.sessionActive=false;let left=false;
  x.exit.ports.returnToBookshelf=()=>{left=true;};
  assert.equal(back(x),true);assert.equal(left,true,'the still-bound accepted Host does not block an unrelated book');
  x.entry.book=retained;x.exit.ports.returnToBookshelf=returnToBookshelf;
 }

 x.navigation.show('detail');x.entry.sessionActive=false;x.source.visible=false;x.source.pending=undefined;
 const detail=makeDetail(x);
 assert.equal(detail.mutationEnabled(x.entry.book),false,'Host protects accepted confirmed/unknown even without stale page pending DTO');
 if(!unknown){
  // Retire only this view's host reference; no business receipt is discarded.
  x.source.activeHost=undefined;x.entry.offlineOperationActive=true;
  assert.equal(detail.mutationEnabled(x.entry.book),false,'actual offline busy DTO protects removal');
  x.entry.offlineOperationActive=false;assert.equal(detail.mutationEnabled(x.entry.book),true);
  x.entry.book={sourceId:'local',bookId:'other'};let left=false;
  x.exit.ports.returnToBookshelf=()=>{left=true;};x.navigation.show('bookshelf');
  assert.equal(back(x),true);assert.equal(left,true,'an unrelated inactive book can leave shelf preparation');
 }
 x.close();f.host.retire();
}
console.log('PASS actual shelf entry/Host: unread/read, local/remote, synchronous retained reader; no snapshot prerequisite/loading overlay; confirmed/UNKNOWN Back and removal protection. Device first-frame timing is not measured.');
