import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if((s.startsWith('./')||s.startsWith('../'))&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingOfflineHost}=await import(process.env.READER_READING_OWNER_SDK === '1' ? './lib/reader-reading-owner-sdk-probe.mjs' : '../entry/src/main/ets/features/reading/ReadingOfflineHost.ts');
const {ReadingOfflineGateway}=await import('../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const clone=structuredClone,tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
function fixture(){let route=true,owner=true,entries=[{index:0,title:'Chapter',level:2,downloadState:'missing',bookmarks:[{time:4}]}];const delivered=[];
 const session={acquisitionMode:'online',identity:{sourceId:'source',bookId:'book'},detailUrl:'/detail',tocUrl:'/toc',book:{title:'Book',author:'Author'},continuationVariables:[],entries:[{index:0,title:'Chapter',url:'/chapter',variables:[]}],hostRequirements:[]};
 const rpc={calls:[],state:'missing',bytes:0,pause:undefined,lost:false,cleanupFail:false,readFail:false,manifest:false,async request(method,p,options={}){
  this.calls.push({method,p:clone(p),options});
  if(method==='cache.book.status'){if(this.readFail)throw Error('status unavailable');return{data:{sourceId:'source',bookId:'book',tocAvailable:true,chapters:[{chapterIndex:0,title:'Chapter',url:'/chapter',state:this.state,cachedBytes:this.bytes}]}};}
  if(method==='cache.book.prefetch'){assert.equal(options.shouldCancel,undefined,'manual queue ACK cannot be cancelled by route after dispatch');if(this.pause)await this.pause.promise;this.state='inProgress';this.bytes=4;if(this.lost)throw Error('lost queue ACK');return{data:{sourceId:'source',bookId:'book',chapterRange:p.chapterRange,chapterCount:1,prefetchedCount:1,materializations:[{chapterIndex:0,token:'token'}]}};}
  if(method==='chapter.content')return{data:{sourceId:'source',bookId:'book',chapterTitle:'Chapter',content:'text only',via:'cache'}};
  if(method==='cache.chapter.materialization.report'){assert.equal(options.shouldCancel,undefined);this.state=p.outcome;return{data:{sourceId:'source',bookId:'book',chapterIndex:0,state:p.outcome,retainedCachedBody:true}};}
  if(method==='cache.clear'){assert.equal(options.shouldCancel,undefined);if(this.pause)await this.pause.promise;this.state='missing';this.bytes=0;if(this.lost)throw Error('lost clear ACK');return{data:{scope:'book'}};}
  throw Error(method);
 },supportsCoreCapability:c=>c==='chapter.content.cacheOnly.v1',async markOfflineImageChapterComplete(){this.manifest=true;},async isOfflineImageChapterComplete(){return this.manifest;},async clearOfflineBookImages(){this.calls.push({method:'host.clearImages'});if(this.cleanupFail)throw Error('image cleanup failed');this.manifest=false;}};
 const host=new ReadingOfflineHost({gateway:new ReadingOfflineGateway(rpc),ownsRuntime:()=>owner});
 const binding={session,current:()=>route,currentEntries:()=>entries,emitEntries:e=>entries=e,emitOperation:o=>delivered.push(clone(o)),failed:()=>{},onProgress:()=>{}};
 return {rpc,host,binding,delivered,entries:()=>entries,retire:()=>route=false,unset:()=>owner=false,restore:()=>route=owner=true};
}
{
 const f=fixture();await f.host.downloadBook(f.binding);assert.equal(f.host.busy(),false);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.host.snapshot().materialization,'succeeded');assert.equal(f.entries()[0].downloadState,'completed');assert.equal(f.entries()[0].level,2);assert.equal(f.entries()[0].bookmarks[0].time,4);assert.equal(f.host.snapshot().progress.completedChapters,1);
}
{
 const f=fixture();f.rpc.cleanupFail=true;await f.host.clearBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().materialization,'failed','Core clear is distinct from Host cleanup');assert.equal(f.entries()[0].downloadState,'missing');const count=f.rpc.calls.filter(c=>c.method==='cache.clear').length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.clear').length,count);assert.equal(f.rpc.calls.filter(c=>c.method==='host.clearImages').length,1,'pure read recovery does not replay Host cleanup');
}
{
 const f=fixture();f.rpc.lost=true;await f.host.clearBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');assert.equal(f.host.snapshot().materialization,'failed');assert.equal(f.entries()[0].downloadState,'missing','readback current value separate from old unknown ACK');await f.host.reconcile(f.host.snapshot().generation,f.binding);await f.host.downloadChapter(0,f.binding);await f.host.clearBook(f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.clear').length,1);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length,0,'unknown clear cannot erase/overlap a new download');assert.equal(f.host.snapshot().projection.receipt.fact,'pendingReconciliation');
}
{
 const f=fixture();f.rpc.lost=true;await f.host.downloadBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');assert.equal(f.entries()[0].downloadState,'cached','partial durable body survives queue ACK loss');const count=f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length,count,'recovery issues no download');assert.equal(f.host.snapshot().projection.receipt.fact,'pendingReconciliation');
}
for(const action of ['downloadChapter','clearBook'])for(const retire of ['retire','unset']){
 const f=fixture(),d=defer();f.rpc.pause=d;const task=action==='downloadChapter'?f.host.downloadChapter(0,f.binding):f.host.clearBook(f.binding);await tick();const count=f.delivered.length;await f.host.downloadBook(f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1,'one finite mutex');f[retire]();d.resolve();await task;assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().materialization,'retired');assert.equal(f.host.busy(),false);assert.equal(f.delivered.length,count);
 if(action==='downloadChapter')assert.equal(f.rpc.calls.filter(c=>c.method==='cache.chapter.materialization.report').length,1,'retired granted lease still terminally reported');else assert.equal(f.rpc.calls.filter(c=>c.method==='host.clearImages').length,0,'old owner never clears successor images after retirement');
 f.restore();await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1);
}
{
 const f=fixture();f.rpc.readFail=true;await f.host.downloadBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedRefreshFailed');f.rpc.readFail=false;const count=f.rpc.calls.length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.ok(f.rpc.calls.slice(count).every(c=>c.method==='cache.book.status'),'recovery only canonical status');
}
console.log('PASS actual ReadingOfflineGateway -> ReadingOfflineHost: queue ACK/materialization/cleanup separation, cached partials, unknown pure reads, mutex, session retirement, terminal lease report and runtime-unset');
