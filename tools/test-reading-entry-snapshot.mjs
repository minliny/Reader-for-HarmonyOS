import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {readReadingEntrySnapshot}=await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
function fixture(){
 const calls=[];let current=true,contentCurrent=true,answer;
 const body={kind:'ready',sourceId:'s',bookId:'b',chapterIndex:40,chapterTitle:'第四章',content:'正文甲乙丙',blocks:[{kind:'text',startScalar:0,endScalar:5,text:'正文甲乙丙'}],
  positionScope:{sourceId:'s',bookId:'b',chapterIndex:40,bodyVersion:'body',processingVersion:'process'},
  progress:{sourceId:'s',bookId:'b',chapterIndex:40,chapterOffset:2,chapterProgress:.4,updatedAt:1,bodyVersion:'body',processingVersion:'process'},
  baseUrl:'https://example.org/40',contentRefreshRequired:false,
  navigation:{revision:'toc',chapterCount:10,readableChapterCount:10,current:{index:40,position:4,readablePosition:4,title:'第四章',level:2,navigable:true},before:[],after:[{index:50,position:5,readablePosition:5,title:'第五章',level:3,navigable:true}]}};
 answer=structuredClone(body);
 const runtime={supportsCoreCapability:c=>c==='reading.entry.snapshot.v1',captureReadingContentValidity:()=>()=>contentCurrent,
  request:async(method,params)=>{calls.push({method,params});assert.equal(method,'reading.entry.snapshot');return{data:structuredClone(answer)};},
  bookAcquisitions:()=>({acquireBookWithBackgroundRefresh:async()=>{throw Error('must not acquire before cached body');}})};
 const intent={sourceId:'s',bookId:'b',remoteBookSeed:{sourceId:'s',bookId:'b',detailUrl:'b',title:'书名',author:'作者'},isCurrent:()=>current,
  resolveSourceSwitchTransactionId:async()=>undefined,onRemoteSessionReady:()=>{throw Error('must not fabricate a full session');}};
 return {calls,body,runtime,intent,set:value=>{answer=value;},invalidate:()=>{contentCurrent=false;},stop:()=>{current=false;}};
}
{
 const f=fixture();const gateway=await ReadingSessionFlowGateway.open(f.intent,f.runtime);
 assert.equal(f.calls.length,0);assert.equal(gateway.remoteSession(),undefined);
 const snapshot=await gateway.loadEntrySnapshot(undefined,f.intent.isCurrent);assert.equal(snapshot.chapter.content,'正文甲乙丙');
 assert.equal(snapshot.navigation.current.level,2,'bounded entry navigation preserves EPUB nesting');
 const chapter=await gateway.loadChapter('b',40,f.intent.isCurrent,false,{bodyVersion:'body',processingVersion:'process',anchors:[{id:'resume',offset:2}]});
 assert.equal(chapter,snapshot.chapter);assert.equal(f.calls.length,1,'entry progress/body processing has one Core request');
 f.invalidate();assert.equal(snapshot.isCurrent(),false);
}
{
 const f=fixture();f.set({...f.body,bookId:'other'});await assert.rejects(readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),/identity/);
 f.set({...f.body,progress:{...f.body.progress,bodyVersion:'stale'}});await assert.rejects(readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),/scope/);
 f.set({...f.body,navigation:{...f.body.navigation,after:[{index:40,position:5,title:'duplicate',navigable:true}]}});await assert.rejects(readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),/order/);
 f.set({...f.body,navigation:{...f.body.navigation,current:{...f.body.navigation.current,level:0}}});await assert.rejects(readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),/level/);
}
{
 const f=fixture();f.set({kind:'missing',sourceId:'s',bookId:'b',reason:'contentMissing'});
 assert.equal(await readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),undefined);
 f.set({...f.body,contentRefreshRequired:true});const snapshot=await readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true);
 assert.equal(snapshot.chapter.cacheRefreshRequired,true,'valid old offline bytes remain readable without forced network');
}
{
 const f=fixture();let release;f.runtime.request=async()=>{await new Promise(r=>release=r);return{data:f.body};};
 const read=readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true);f.invalidate();release();await assert.rejects(read,/cancelled/);
}
console.log('reading entry snapshot: no acquisition/full TOC/progress prerequisite, one request + retained body, strict identity/scope/navigation, old offline body and cancellation PASS');
{
 const f=fixture();
 const old=await readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true);
 f.set({...f.body,imagePresentationVersion:'chapter-layout-1'});
 const upgraded=await readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true);
 assert.equal(upgraded.chapter.content,old.chapter.content);
 assert.equal(upgraded.chapter.bodyVersion,old.chapter.bodyVersion);
 assert.equal(upgraded.chapter.processingVersion,old.chapter.processingVersion);
 assert.notEqual(upgraded.chapter.contentVersion,old.chapter.contentVersion,'geometry invalidates pagination without changing position scope');
 // A later text-only resident fragment still carries the whole chapter's geometry identity.
 f.set({...f.body,content:'甲乙丙',blocks:[{kind:'text',startScalar:2,endScalar:5,text:'甲乙丙'}],
   imagePresentationVersion:'chapter-layout-1',documentWindow:{startScalar:2,endScalar:5,totalScalars:5,requestedScalar:2}});
 f.runtime.supportsCoreCapability=()=>true;
 const window=await readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true,undefined,64);
 assert.equal(window.chapter.contentVersion,upgraded.chapter.contentVersion);
 for(const value of ['',12,'x'.repeat(257)]){
  f.set({...f.body,imagePresentationVersion:value});
  await assert.rejects(readReadingEntrySnapshot(f.runtime,'s','b',undefined,()=>true),/image presentation version/);
 }
 console.log('PASS separate chapter image layout identity: stable across windows, unchanged position scope, malformed metadata rejected');
}
{
 const {readReadingCatalog}=await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
 const calls=[];let changed=false,cancel=false;
 const runtime={supportsCoreCapability:()=>true,request:async(method,p)=>{
   assert.equal(method,'reading.catalog.page');calls.push(p);
   if(changed&&p.offset>0)return{data:{kind:'changed',sourceId:'s',bookId:'b',revision:'other'}};
   return{data:{kind:'ready',sourceId:'s',bookId:'b',revision:'r',chapterCount:300,readableChapterCount:300,offset:p.offset,
    entries:Array.from({length:Math.min(256,300-p.offset)},(_,i)=>({index:(i+p.offset)*10,position:i+p.offset,readablePosition:i+p.offset,title:'章',level:i%2+1,navigable:true}))}};
 }};
 const catalog=await readReadingCatalog(runtime,'s','b',()=>!cancel);
 assert.equal(catalog.entries.length,300);assert.equal(calls.length,2);assert.equal(calls[1].revision,'r');
 assert.deepEqual(catalog.entries.slice(0,3).map(entry=>entry.level),[1,2,1]);
 changed=true;await assert.rejects(readReadingCatalog(runtime,'s','b',()=>true),/REVISION_CHANGED/);
 cancel=true;await assert.rejects(readReadingCatalog(runtime,'s','b',()=>!cancel),/cancelled/);
 console.log('bounded catalog: 256-row pages, pinned revision, reject changed and cancelled projections PASS');
}
{
 const f=fixture(), admissions=[];
 f.runtime.bookAcquisitions=()=>({acquireBookWithBackgroundRefresh:(_seed,options,priority)=>new Promise(resolve=>admissions.push({resolve,options,priority}))});
 const gateway=await ReadingSessionFlowGateway.open(f.intent,f.runtime);
 let backgroundAlive=true, old=0, current=0;
 const disposeOld=gateway.observeRemoteSession(()=>old++);
 gateway.observeRemoteSession(()=>current++);disposeOld();
 const background=gateway.ensureRemoteSession(()=>backgroundAlive,'background');
 const foreground=gateway.ensureRemoteSession(()=>true,'foreground');
 for(let turn=0;turn<10;turn++)await Promise.resolve();
 assert.equal(admissions.length,2,'each caller registers with existing shared acquisition owner');
 assert.deepEqual(admissions.map(a=>a.priority),['background','foreground']);
 backgroundAlive=false;
 const session={identity:{sourceId:'s',bookId:'b'},entries:[]};
 admissions[0].resolve({session});admissions[1].resolve({session});
 await assert.rejects(background,/cancelled/);assert.equal(await foreground,session);
 assert.equal(old,0);assert.equal(current,1,'old mount disposer cannot remove the replacement observer');
 console.log('lazy session: independent foreground/background consumers, priority and rebound observer ownership PASS');
}
