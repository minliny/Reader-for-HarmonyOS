import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'node-protocol':{description:'Direct production Node owner with fake RPC/projection; no journal supplied',resources:[]},
 'sdk-protocol':{description:'Installed SDK-emitted production owner with same fake RPC; no journal or actual Core claim',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const { registerHooks }=await import('node:module');
const resolution=registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if((s.startsWith('./')||s.startsWith('../'))&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
try {
const {ReaderDirectoryHost}=await import(selectedCase==='sdk-protocol' ? './lib/reader-reading-owner-sdk-probe.mjs' : '../entry/src/main/ets/features/reading/application/ReaderDirectoryHost.ts');
const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
const {readingDirectoryRecovery}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const clone=structuredClone, tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const book={sourceId:'local',sourceName:'local',bookId:'book',title:'Book',author:'Author'};
function fixture(){let runtimeCurrent=true,routeCurrent=true;const delivered=[],settled=[];let entries=[{index:0,title:'Chapter',level:2,downloadState:'completed',bookmarks:[]}];
 const rpc={calls:[],rows:[],failList:false,lost:false,pause:undefined,chapterPause:undefined,
  chapterData:{sourceId:'local',bookId:'book',chapterIndex:0,chapterTitle:'Chapter',content:'Core supplied chapter',
    bodyVersion:'core-returned-body',processingVersion:'core-returned-processing'},deleteFailAt:undefined,async request(method,params,options={}){
  this.calls.push({method,params:clone(params),options});
  if(method==='local_book.chapter.content'){if(this.chapterPause)await this.chapterPause.promise;return {data:clone(this.chapterData)};}
  if(method==='bookmark.list'){if(this.failList)throw Error('readback failure');return {data:{bookmarks:clone(this.rows)}};}
  assert.equal(options.shouldCancel,undefined,'accepted bookmark write is not UI cancellation');
  if(this.pause)await this.pause.promise;
  if(method==='bookmark.create'){const row={time:100+this.rows.length,...params,content:'',bookText:params.bookText??''};this.rows.push(row);if(this.lost)throw Error('lost native ACK');return{data:{bookmark:clone(row)}};}
  if(method==='bookmark.delete'){this.rows=this.rows.filter(r=>r.time!==params.time);if(this.deleteFailAt===params.time)throw Error('lost delete ACK');return{data:{time:params.time,deleted:true}};}
  throw Error(method);
 }};
 const host=ReaderDirectoryHost.forRuntime(rpc,()=>runtimeCurrent);
 const binding={book:{...book},current:()=>routeCurrent,currentEntries:()=>entries,emitEntries:v=>entries=v,emitOperation:o=>delivered.push(clone(o)),failed:()=>{},onSettled:v=>settled.push(v)};
 const create=()=>host.createPosition({bookName:book.title,bookAuthor:book.author,chapterIndex:0,chapterOffset:0,chapterTitle:'Chapter'},binding);
 return{rpc,host,binding,create,delivered,settled,entries:()=>entries,setEntries:v=>entries=v,retire:()=>routeCurrent=false,unset:()=>runtimeCurrent=false,restore:()=>{routeCurrent=runtimeCurrent=true;}};
}
{
 const f=fixture();f.rpc.failList=true;await f.create();assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedRefreshFailed');assert.equal(readingDirectoryRecovery('dir',book,f.host.snapshot()).bookmarksKind,'readback');assert.equal(f.host.busy(),false);assert.deepEqual(f.entries()[0].bookmarks,[],'readback failure retains the last usable projection');assert.equal(f.entries()[0].level,2);assert.equal(f.entries()[0].downloadState,'completed');assert.deepEqual(f.settled,[true]);
 f.rpc.failList=false;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.entries()[0].bookmarks.length,1);assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.create').length,1);
}
{
 const f=fixture();f.rpc.lost=true;await f.create();assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.entries()[0].bookmarks.length,1);assert.equal(f.host.snapshot().projection.receipt.fact,'pendingReconciliation');await f.create();assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.create').length,1,'matching read never clears unknown or replays create');
}
{
 const f=fixture();await f.create();await f.create();const times=f.entries()[0].bookmarks.map(b=>b.time);f.rpc.deleteFailAt=times[1];await f.host.deleteBookmarks(times,f.binding);assert.equal(f.host.snapshot().confirmedCount,1);assert.equal(f.host.snapshot().requestedCount,2);assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.delete').length,2);assert.equal(f.entries()[0].bookmarks.length,0);
}
{
 const f=fixture();await f.host.deleteBookmarks([777],f.binding);assert.equal(f.rpc.calls.length,0,'foreign/unprojected primary key rejected before dispatch');f.setEntries([{index:0,title:'Volume',navigable:false,downloadState:'unknown',bookmarks:[]}]);await f.host.createChapterStart(0,f.binding);assert.equal(f.rpc.calls.length,0,'volume heading never owns bookmark mutation');
}
for(const retire of ['retire','unset']){
 const f=fixture(),d=defer();f.rpc.pause=d;const task=f.create();await tick();const delivered=f.delivered.length;f[retire]();d.resolve();await task;assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed','late durable ACK retained by owner');assert.equal(f.host.snapshot().confirmedCount,1);assert.equal(f.host.busy(),false);assert.equal(f.delivered.length,delivered);assert.deepEqual(f.settled,[],'retired reading page callback not published');
 f.restore();f.rpc.pause=undefined;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.create').length,1);
}
{
 const f=fixture();await f.create();await f.create();const times=f.entries()[0].bookmarks.map(b=>b.time),d=defer();f.rpc.pause=d;const task=f.host.deleteBookmarks(times,f.binding);await tick();f.retire();d.resolve();await task;assert.equal(f.host.snapshot().confirmedCount,1,'ACK counted before UI guard');assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.delete').length,1,'retirement stops subsequent dispatch only');assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().requestedCount,2);assert.equal(f.host.snapshot().completion,'partial');assert.equal(readingDirectoryRecovery('dir',book,f.host.snapshot()).bookmarksKind,'result');
}
{
 const f=fixture();f.binding.emitOperation=()=>{throw Error('presentation failed');};await f.create();assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent','presentation exception does not alter mutation receipt');
}
{
 const f=fixture();assert.equal(ReaderDirectoryHost.forRuntime(f.rpc,()=>true),f.host,'same Runtime Index reconstruction retains exact Host');
 f.unset();assert.equal(ReaderDirectoryHost.forRuntime(f.rpc,()=>false),undefined);
 const successor=fixture();assert.notEqual(successor.host,f.host);
 assert.equal(ReaderDirectoryHost.forRuntime(f.rpc,()=>false),undefined,'retired lookup cannot replace successor cached owner');
 assert.equal(ReaderDirectoryHost.forRuntime(successor.rpc,()=>true),successor.host);
}
{
 const f=fixture();await f.host.createChapterStart(0,f.binding);
 const reads=f.rpc.calls.filter(c=>c.method==='local_book.chapter.content'),writes=f.rpc.calls.filter(c=>c.method==='bookmark.create');
 assert.equal(reads.length,1);assert.deepEqual(reads[0].params,{bookId:'book',chapterIndex:0});
 assert.equal(writes.length,1);assert.equal(writes[0].params.chapterPos,0);
 assert.deepEqual(writes[0].params.positionScope,{sourceId:'local',bookId:'book',chapterIndex:0,
  bodyVersion:f.rpc.chapterData.bodyVersion,processingVersion:f.rpc.chapterData.processingVersion},'new local chapter-start uses only the exact Core-returned versions');
 assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.entries()[0].bookmarks.length,1);
 assert.deepEqual(f.settled,[true]);
}
for(const change of [data=>{delete data.bodyVersion;delete data.processingVersion;},data=>{delete data.processingVersion;},
 data=>{data.bookId='another-book';},data=>{data.chapterIndex=1;},data=>{data.chapterTitle='Changed chapter';}]){
 const f=fixture();change(f.rpc.chapterData);await f.host.createChapterStart(0,f.binding);
 assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.create').length,0,'unproved or changed local content never reaches mutation');
 assert.equal(f.host.snapshot().completion,'notDispatched');assert.deepEqual(f.entries()[0].bookmarks,[]);
}
for(const change of [f=>f.retire(),f=>f.unset(),f=>{f.binding.book={...book,bookId:'new-book'};},
 f=>{f.binding.book={...book,sourceId:'another-source'};},f=>{f.binding.book={...book,title:'Renamed book'};},
 f=>{f.binding.book={...book,author:'Changed author'};},
 f=>f.setEntries([{index:0,title:'Changed chapter',navigable:true,downloadState:'completed',bookmarks:[]}]),
 f=>f.setEntries([{index:0,title:'Chapter',navigable:false,downloadState:'completed',bookmarks:[]}])]){
 const f=fixture(),d=defer();f.rpc.chapterPause=d;
 const task=f.host.createChapterStart(0,f.binding);await tick();assert.equal(f.rpc.calls[0].method,'local_book.chapter.content');
 change(f);d.resolve();await task;
 assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.create').length,0,'retirement or changed original book/chapter after read forbids a new write');
 assert.equal(f.host.busy(),false);
}
{
 const f=fixture();f.rpc.lost=true;await f.create();
 const original=f.rpc.calls.find(c=>c.method==='bookmark.create'),bytes=JSON.stringify(original.params),count=f.rpc.calls.length;
 await f.host.createChapterStart(0,f.binding);
 f.binding.book={...book,bookId:'second-book'};await f.host.createChapterStart(0,f.binding);
 assert.equal(f.rpc.calls.length,count,'an existing unknown blocks even a second book before any new version read or dispatch');
 assert.equal(JSON.stringify(original.params),bytes,'existing unknown params are never upgraded with a new local scope');
 assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');
}
{
 const failures=[],publications=[],entries=[{index:0,title:'Chapter',downloadState:'completed',bookmarks:[]}];
 let failIntentRead=true,listReads=0,current=true;
 const gateway={pendingBookmarkOperation:async()=>{if(failIntentRead)throw Error('intent file unavailable');},
  loadBookmarkProjection:async(_title,_author,rows)=>{listReads++;return rows;}};
 const host=new ReaderDirectoryHost({gateway,ownsRuntime:()=>true});
 const binding={book,current:()=>current,currentEntries:()=>entries,emitEntries:()=>{},
  emitOperation:operation=>publications.push(operation),failed:error=>failures.push(error.message)};
 await assert.rejects(host.load(binding),/intent file unavailable/);
 assert.equal(host.snapshot(),undefined,'a failed record read cannot invent a create or an unknown write');
 assert.equal(host.busy(),false);assert.equal(listReads,0);assert.equal(publications.length,0);
 assert.deepEqual(failures,['intent file unavailable']);assert.deepEqual(entries[0].bookmarks,[]);
 failIntentRead=false;await host.load(binding);
 assert.equal(listReads,1);assert.equal(host.snapshot(),undefined,'retry with no stored intent leaves no synthetic recovery notice');
 failIntentRead=true;current=false;await host.load(binding);
 assert.deepEqual(failures,['intent file unavailable'],'a retired binding cannot publish loading failure');
}
{
 const pending={version:1,method:'bookmark.delete',phase:'pending',params:{time:7},
  context:{sourceId:book.sourceId,bookId:book.bookId,title:book.title,author:book.author}};
 const original=JSON.stringify(pending);let failIntentRead=false,pauseIntentRead,intentReads=0;
 const entries=[{index:0,title:'Chapter',downloadState:'completed',bookmarks:[]}],failures=[];
 const gateway={pendingBookmarkOperation:async()=>{intentReads++;if(pauseIntentRead)await pauseIntentRead.promise;if(failIntentRead)throw Error('intent file unavailable');return pending;},
  reconcileBookmarkOperation:async()=>{throw Error('original reply unknown');},
  loadBookmarkProjection:async(_title,_author,rows)=>rows};
 const host=new ReaderDirectoryHost({gateway,ownsRuntime:()=>true});
 const binding={book,current:()=>true,currentEntries:()=>entries,emitEntries:()=>{},failed:error=>failures.push(error.message)};
 await host.load(binding);const before=structuredClone(host.snapshot());
 assert.equal(before.action,'delete');assert.equal(before.projection.receipt.confirmation,'unknown');
 assert.equal(before.canContinueOriginal,true);
 assert.match(readingDirectoryRecovery('reading',book,before).bookmarks.message,/original reply unknown/,
  'successful bookmark-list read retains the original receipt-query failure explanation');
 pauseIntentRead=defer();const checking=host.reconcile(before.generation,binding);
 assert.equal(host.snapshot().projection.receipt.readback,'reading','the recovery query publishes busy before intent IO');
 assert.equal(readingDirectoryRecovery('reading',book,host.snapshot()).bookmarksBusy,true);
 const admittedReads=intentReads;
 await host.reconcile(before.generation,binding);
 assert.equal(intentReads,admittedReads,'a retained physical retry during busy cannot enqueue another query');
 pauseIntentRead.resolve();await checking;pauseIntentRead=undefined;
 assert.equal(intentReads,admittedReads,'finishing the admitted retry does not drain a duplicate retry');
 assert.equal(host.snapshot().projection.receipt.confirmation,'unknown','read-only checking cannot claim the original write was confirmed');
 failIntentRead=true;await host.load(binding);const after=host.snapshot();
 assert.equal(after.generation,before.generation);assert.equal(after.action,'delete');
 assert.equal(after.projection.receipt.confirmation,'unknown','a known accepted write retains its original unknown receipt');
 assert.equal(after.canContinueOriginal,false,'unreadable durable identity cannot admit an original continuation');
 assert.equal(JSON.stringify(pending),original,'loading never edits or clears the original intent');
 failIntentRead=false;
 for(const foreign of [{...book,bookId:'another-book'},{...book,sourceId:'another-source'},
  {...book,title:'another-title'},{...book,author:'another-author'}]){
  const recovery=readingDirectoryRecovery('foreign-opening',foreign,host.snapshot());
  assert.equal(recovery.bookmarks.visible,false,'another book cannot mount the retained original recovery notice');
  assert.equal(recovery.bookmarksKind,'none');assert.equal(recovery.canContinueBookmarks,false);
 }
 const foreign={...binding,book:{...book,bookId:'another-book'}};
 const originalGeneration=host.snapshot().generation;
 const failuresBeforeForeignRead=failures.length;
 await host.load(foreign);
 assert.equal(failures.length,failuresBeforeForeignRead,'a foreign original intent cannot publish a failure for the current book read');
 assert.equal(host.snapshot().book.bookId,book.bookId,'a foreign canonical read retains the original operation owner');
 assert.equal(host.snapshot().generation,originalGeneration);
 assert.equal(host.snapshot().projection.receipt.confirmation,'unknown');
 const readsBeforeForeignWrite=intentReads;
 await host.reconcile(originalGeneration,foreign);
 assert.equal(intentReads,readsBeforeForeignWrite,'the old original generation cannot reconcile against a successor book');
 await host.createPosition({bookName:book.title,bookAuthor:book.author,chapterIndex:0,chapterOffset:0,chapterTitle:'Chapter'},foreign);
 assert.equal(intentReads,readsBeforeForeignWrite,'the original unknown still fences a new bookmark mutation');
 assert.match(failures.at(-1),new RegExp(book.title),'an explicit foreign write failure names the retained original book');
 await host.load(binding);
 const restored=readingDirectoryRecovery('original-book-reopened',book,host.snapshot());
 assert.equal(restored.bookmarks.visible,true);assert.equal(restored.bookmarksKind,'pending');
 assert.equal(host.snapshot().generation,originalGeneration);
 assert.equal(JSON.stringify(pending),original,'visiting and leaving another book cannot clear or modify the original intent');
}
console.log('PASS actual LocalReadingFlowGateway -> ReaderDirectoryHost: qualified ACK/unknown/partial/retirement/runtime-unset/read-only reconciliation/foreign keys/presentation isolation');

}finally{resolution.deregister();}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
