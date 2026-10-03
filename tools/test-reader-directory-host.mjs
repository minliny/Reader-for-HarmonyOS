import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if((s.startsWith('./')||s.startsWith('../'))&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderDirectoryHost}=await import(process.env.READER_READING_OWNER_SDK === '1' ? './lib/reader-reading-owner-sdk-probe.mjs' : '../entry/src/main/ets/features/reading/ReaderDirectoryHost.ts');
const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const clone=structuredClone, tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const book={sourceId:'local',sourceName:'local',bookId:'book',title:'Book',author:'Author'};
function fixture(){let runtimeCurrent=true,routeCurrent=true;const delivered=[],settled=[];let entries=[{index:0,title:'Chapter',level:2,downloadState:'completed',bookmarks:[]}];
 const rpc={calls:[],rows:[],failList:false,lost:false,pause:undefined,deleteFailAt:undefined,async request(method,params,options={}){
  this.calls.push({method,params:clone(params),options});
  if(method==='bookmark.list'){if(this.failList)throw Error('readback failure');return {data:{bookmarks:clone(this.rows)}};}
  assert.equal(options.shouldCancel,undefined,'accepted bookmark write is not UI cancellation');
  if(this.pause)await this.pause.promise;
  if(method==='bookmark.create'){const row={time:100+this.rows.length,...params,content:'',bookText:params.bookText??''};this.rows.push(row);if(this.lost)throw Error('lost native ACK');return{data:{bookmark:clone(row)}};}
  if(method==='bookmark.delete'){this.rows=this.rows.filter(r=>r.time!==params.time);if(this.deleteFailAt===params.time)throw Error('lost delete ACK');return{data:{time:params.time,deleted:true}};}
  throw Error(method);
 }};
 const host=ReaderDirectoryHost.forRuntime(rpc,()=>runtimeCurrent);
 const binding={book,current:()=>routeCurrent,currentEntries:()=>entries,emitEntries:v=>entries=v,emitOperation:o=>delivered.push(clone(o)),failed:()=>{},onSettled:v=>settled.push(v)};
 const create=()=>host.createPosition({bookName:book.title,bookAuthor:book.author,chapterIndex:0,chapterOffset:0,chapterTitle:'Chapter'},binding);
 return{rpc,host,binding,create,delivered,settled,entries:()=>entries,setEntries:v=>entries=v,retire:()=>routeCurrent=false,unset:()=>runtimeCurrent=false,restore:()=>{routeCurrent=runtimeCurrent=true;}};
}
{
 const f=fixture();f.rpc.failList=true;await f.create();assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedRefreshFailed');assert.equal(f.host.busy(),false);assert.equal(f.entries()[0].bookmarks,undefined);assert.equal(f.entries()[0].level,2);assert.equal(f.entries()[0].downloadState,'completed');assert.deepEqual(f.settled,[true]);
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
 const f=fixture();await f.create();await f.create();const times=f.entries()[0].bookmarks.map(b=>b.time),d=defer();f.rpc.pause=d;const task=f.host.deleteBookmarks(times,f.binding);await tick();f.retire();d.resolve();await task;assert.equal(f.host.snapshot().confirmedCount,1,'ACK counted before UI guard');assert.equal(f.rpc.calls.filter(c=>c.method==='bookmark.delete').length,1,'retirement stops subsequent dispatch only');assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().requestedCount,2);assert.equal(f.host.snapshot().completion,'partial');
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
console.log('PASS actual LocalReadingFlowGateway -> ReaderDirectoryHost: qualified ACK/unknown/partial/retirement/runtime-unset/read-only reconciliation/foreign keys/presentation isolation');
