import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks }=await import('node:module');
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if((s.startsWith('./')||s.startsWith('../'))&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingOfflineHost}=await import(id.startsWith('sdk-') ? './lib/reader-reading-owner-sdk-probe.mjs' : '../entry/src/main/ets/features/reading/ReadingOfflineHost.ts');
const {readingDirectoryRecovery}=await import('../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
const {ReadingOfflineGateway}=await import('../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const {ReadingOfflineMaterializationError}=await import('../entry/src/main/ets/features/reading/ReadingOfflineContract.ts');
const clone=structuredClone,tick=()=>new Promise(r=>setImmediate(r));
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
function fixture(){let route=true,owner=true,entries=[{index:0,title:'Chapter',level:2,downloadState:'missing',bookmarks:[{time:4}]}];const delivered=[];
 const session={acquisitionMode:'online',identity:{sourceId:'source',bookId:'book'},detailUrl:'/detail',tocUrl:'/toc',book:{title:'Book',author:'Author'},continuationVariables:[],entries:[{index:0,title:'Chapter',url:'/chapter',variables:[]}],hostRequirements:[]};
 const rpc={calls:[],state:'missing',bytes:0,lastError:undefined,pause:undefined,lost:false,cleanupFail:false,readFail:false,manifest:false,async request(method,p,options={}){
  this.calls.push({method,p:clone(p),options});
  if(method==='cache.book.status'){if(this.readFail)throw Error('status unavailable');return{data:{sourceId:'source',bookId:'book',tocAvailable:true,chapters:[{chapterIndex:0,title:'Chapter',url:'/chapter',state:this.state,cachedBytes:this.bytes,lastError:this.lastError}]}};}
  if(method==='cache.book.prefetch'){assert.equal(options.shouldCancel,undefined,'manual queue ACK cannot be cancelled by route after dispatch');if(this.pause)await this.pause.promise;this.state='inProgress';this.bytes=4;if(this.lost)throw Error('lost queue ACK');return{data:{sourceId:'source',bookId:'book',chapterRange:p.chapterRange,chapterCount:1,prefetchedCount:1,materializations:[{chapterIndex:0,token:'token'}]}};}
  if(method==='chapter.content')return{data:{sourceId:'source',bookId:'book',chapterTitle:'Chapter',content:'text only',via:'cache'}};
  if(method==='cache.chapter.materialization.report'){assert.equal(options.shouldCancel,undefined);this.state=p.outcome;this.lastError=p.errorCode;return{data:{sourceId:'source',bookId:'book',chapterIndex:0,state:p.outcome,retainedCachedBody:true}};}
  if(method==='cache.clear'){assert.equal(options.shouldCancel,undefined);if(this.pause)await this.pause.promise;this.state='missing';this.bytes=0;if(this.lost)throw Error('lost clear ACK');return{data:{scope:'book'}};}
  throw Error(method);
 },supportsCoreCapability:c=>c==='chapter.content.cacheOnly.v1',async markOfflineImageChapterComplete(){this.manifest=true;},async isOfflineImageChapterComplete(){return this.manifest;},async clearOfflineBookImages(){this.calls.push({method:'host.clearImages'});if(this.cleanupFail)throw Error('image cleanup failed');this.manifest=false;}};
 const host=ReadingOfflineHost.forRuntime(rpc,()=>owner);
 const binding={session,current:()=>route,currentEntries:()=>entries,emitEntries:e=>entries=e,emitOperation:o=>delivered.push(clone(o)),failed:()=>{},onProgress:()=>{}};
 return {rpc,host,binding,delivered,entries:()=>entries,retire:()=>route=false,unset:()=>owner=false,restore:()=>route=owner=true};
}
async function until(predicate){for(let n=0;n<1000;n++){if(predicate())return;await tick();}assert.fail('manga owner boundary did not settle');}
function mangaFixture(count=3){
 let live=true,entries=Array.from({length:count},(_,index)=>({index,title:`话${index}`,level:1,navigable:true,downloadState:'missing',bookmarks:[{time:index}]}));
 const sourceId='manga-source',bookId='manga-book',session={contentKind:'manga',sourceVersion:'rules',identity:{sourceId,bookId},
 book:{title:'漫画',author:'作者'},detailUrl:'/manga',entries:entries.map(e=>({...e,url:`/c${e.index}`}))};
 const state=Array.from({length:count},()=> 'missing'),versions=Array.from({length:count},()=>0),retained=new Map(),files=new Set(),leases=new Map(),preparations=new Map(),calls=[],errors=[];
 const imageGates=new Map();let claimGate,nextToken=0;
 const version=index=>`version-${index}-${versions[index]}`,key=(index,v=version(index))=>`${index}:${v}`;
 function chapter(index,cached=false){const pageId='mp1:'+String(index+1).padStart(64,'0');return {chapterIndex:index,chapterTitle:`话${index}`,cached,
  manifest:{chapter:{sourceId,bookId,chapterId:`/c${index}`},sourceRuleVersion:'rules',manifestVersion:version(index),decodeRevision:'identity-v1',
   pages:[{ordinal:0,pageId,resourceRef:'manga:'+pageId}]},resources:cached?[]:[{resourceRef:'manga:'+pageId,request:{url:`https://image.invalid/${index}`}}]};}
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>live,
  async request(method,p={},options={}){
   calls.push({method,p:clone(p),options});
   if(method==='cache.book.status')return{data:{sourceId,bookId,chapters:session.entries.map(e=>({chapterIndex:e.index,url:e.url,navigable:true,
    state:state[e.index],cachedBytes:0,attempts:0,maxAttempts:3,mangaManifestVersion:version(e.index)}))}};
   if(method==='cache.book.prefetch'){
    assert.equal(p.contentKind,'manga');assert.equal(options.shouldCancel,undefined,'accepted manual manga queue cannot inherit a route cancellation');
    const materializations=[];
    for(let index=p.chapterRange[0];index<p.chapterRange[1];index++)if(!['completed','paused','inProgress'].includes(state[index])){
     state[index]='inProgress';const token=`queue-${++nextToken}`;leases.set(token,index);materializations.push({chapterIndex:index,token,manga:chapter(index)});
    }
    if(claimGate){const gate=claimGate;claimGate=undefined;await gate.promise;}
    return{data:{sourceId,bookId,chapterRange:p.chapterRange,materializations}};
   }
   if(method==='manga.cache.materialization.prepare'){const token=`preparation-${++nextToken}`;preparations.set(token,p);return{data:{...p,token}};}
   if(method==='manga.cache.materialization.complete'){
    const intent=preparations.get(p.token);assert.ok(intent);assert.equal(intent.intent,'download');
    const index=Number(intent.chapter.chapterId.slice(2));assert.equal(files.has(key(index,intent.manifestVersion)),true);
    retained.set(index,intent.manifestVersion);preparations.delete(p.token);return{data:{completed:true,manifestVersion:intent.manifestVersion}};
   }
   if(method==='manga.cache.materialization.abort')return{data:{aborted:preparations.delete(p.token)}};
   if(method==='cache.chapter.materialization.report'){
    assert.equal(options.shouldCancel,undefined,'opaque terminal reports outlive presentation/stop');
    const index=leases.get(p.token);assert.equal(index,p.chapterIndex);leases.delete(p.token);
    if(!['paused','cancelled'].includes(state[index]))state[index]=p.outcome;
    return{data:{sourceId,bookId,chapterIndex:index,state:p.outcome,retainedCachedBody:false}};
   }
   if(method.startsWith('cache.download.')){
    const action=method.split('.').at(-1),index=p.chapterIndex;
    state[index]=action==='resume'?'queued':action==='pause'?'paused':'cancelled';
    return{data:{sourceId,bookId,chapterIndex:index,status:action==='resume'?'pending':state[index],attempts:0,maxAttempts:3}};
   }
   if(method==='manga.retention.list')return{data:{retentions:[...retained].map(([index,manifestVersion])=>({chapter:{sourceId,bookId,chapterId:`/c${index}`},manifestVersion,retainedAt:1}))}};
   if(method==='manga.retention.set'){const index=Number(p.chapter.chapterId.slice(2));assert.equal(p.retain,false);retained.delete(index);return{data:{retention:null}};}
   if(method==='manga.entry.get')return{data:{entry:{chapter:{...chapter(p.chapterIndex,true),pageStart:0,totalPages:1},targetOrdinal:0,recoveryRequired:false,
    progress:{token:{epoch:1,revision:0},location:null}}}};
   if(method==='manga.chapter.get'){assert.equal(p.policy,'refresh');versions[p.chapterIndex]++;state[p.chapterIndex]='cached';return{data:chapter(p.chapterIndex)};}
   if(method==='cache.clear'){assert.equal(leases.size,0,'old Host reports settle before a destructive clear');
    for(let i=0;i<count;i++)if(!retained.has(i))state[i]='missing';return{data:{scope:'book'}};}
   throw Error('unexpected manga native command '+method);
  },
  async prefetchReadingImage(identity,current){calls.push({method:'image',p:clone(identity)});const gate=imageGates.get(identity.chapterIndex);if(gate)await gate.promise;
   if(!current())throw Error('cancelled');},
  async markOfflineImageChapterComplete(identity,_resources,current){assert.equal(current(),true);files.add(key(identity.chapterIndex,identity.contentVersion));},
  async isOfflineImageChapterComplete(identity){return files.has(key(identity.chapterIndex,identity.contentVersion));},
  async clearOfflineBookImages(_s,_b,manga){assert.equal(manga,true);calls.push({method:'host.clearImages'});},
  async listMangaDownloadChapters(){return[...new Set([...retained.keys(),...[...files].map(k=>Number(k.split(':')[0]))])].map(index=>({sourceId,bookId,chapterId:`/c${index}`}));},
  async listMangaDownloadVersions(ch){return[...files].filter(k=>k.startsWith(ch.chapterId.slice(2)+':')).map(k=>k.slice(k.indexOf(':')+1));},
  async deleteMangaDownload(ch,v){const index=Number(ch.chapterId.slice(2));assert.equal([...leases.values()].includes(index),false,'old target consumer settles before deletion');calls.push({method:'host.delete',p:{index,v}});return files.delete(key(index,v));},
 };
 const host=ReadingOfflineHost.forRuntime(runtime,()=>live),binding={session,current:()=>live,currentEntries:()=>entries,
 emitEntries:e=>entries=e,emitOperation(){},onProgress(){},failed:e=>errors.push(e)};
 return{host,binding,runtime,session,state,calls,errors,retained,files,leases,preparations,imageGates,
 claimGate:g=>claimGate=g,entries:()=>entries,seedRetained(index){state[index]='completed';retained.set(index,version(index));files.add(key(index));},close:()=>live=false};
}

try{
if(id==='download'){
{
 const f=fixture();await f.host.downloadBook(f.binding);assert.equal(f.host.busy(),false);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.host.snapshot().materialization,'succeeded');assert.equal(f.entries()[0].downloadState,'completed');assert.equal(f.entries()[0].level,2);assert.equal(f.entries()[0].bookmarks[0].time,4);assert.equal(f.host.snapshot().progress.completedChapters,1);
}
}
if(id==='clear-cleanup'){
{
 const f=fixture();f.rpc.cleanupFail=true;await f.host.clearBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().materialization,'failed','Core clear is distinct from Host cleanup');assert.equal(f.entries()[0].downloadState,'missing');const count=f.rpc.calls.filter(c=>c.method==='cache.clear').length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.clear').length,count);assert.equal(f.rpc.calls.filter(c=>c.method==='host.clearImages').length,1,'pure read recovery does not replay Host cleanup');
}
}
if(id==='unknown-clear'){
{
 const f=fixture();f.rpc.lost=true;await f.host.clearBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');assert.equal(f.host.snapshot().materialization,'failed');assert.equal(f.entries()[0].downloadState,'missing','readback current value separate from old unknown ACK');await f.host.reconcile(f.host.snapshot().generation,f.binding);await f.host.downloadChapter(0,f.binding);await f.host.clearBook(f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.clear').length,1);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length,0,'unknown clear cannot erase/overlap a new download');assert.equal(f.host.snapshot().projection.receipt.fact,'pendingReconciliation');
}
}
if(id==='unknown-download'){
{
 const f=fixture();f.rpc.lost=true;await f.host.downloadBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'unknown');assert.equal(f.entries()[0].downloadState,'cached','partial durable body survives queue ACK loss');const count=f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch').length,count,'recovery issues no download');assert.equal(f.host.snapshot().projection.receipt.fact,'pendingReconciliation');
}
}
if(id==='retirement'){
for(const action of ['downloadChapter','clearBook'])for(const retire of ['retire','unset']){
 const f=fixture(),d=defer();f.rpc.pause=d;const task=action==='downloadChapter'?f.host.downloadChapter(0,f.binding):f.host.clearBook(f.binding);await tick();const count=f.delivered.length;await f.host.downloadBook(f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1,'one finite mutex');f[retire]();d.resolve();await task;assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().materialization,'retired');assert.equal(f.host.busy(),false);assert.equal(f.delivered.length,count);
 if(action==='downloadChapter')assert.equal(f.rpc.calls.filter(c=>c.method==='cache.chapter.materialization.report').length,1,'retired granted lease still terminally reported');else assert.equal(f.rpc.calls.filter(c=>c.method==='host.clearImages').length,0,'old owner never clears successor images after retirement');
 f.restore();await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1);
}
}
if(id==='readback'){
{
 const f=fixture();f.rpc.readFail=true;await f.host.downloadBook(f.binding);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedRefreshFailed');assert.equal(readingDirectoryRecovery('dir',{sourceId:'source',bookId:'book',title:'Book',author:'Author'},undefined,f.host.snapshot()).offlineReadbackFailed,true);assert.notEqual(readingDirectoryRecovery('dir',{sourceId:'source',bookId:'book',title:'Book',author:'Author'},undefined,f.host.snapshot()).offlineKind,'pending');f.rpc.readFail=false;const count=f.rpc.calls.length;await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.ok(f.rpc.calls.slice(count).every(c=>c.method==='cache.book.status'),'recovery only canonical status');
}
}
if(id==='runtime-owner'){
{
 const f=fixture();assert.equal(ReadingOfflineHost.forRuntime(f.rpc,()=>true),f.host,'same Runtime Index reconstruction retains exact Host');
 f.unset();assert.equal(ReadingOfflineHost.forRuntime(f.rpc,()=>false),undefined);
 const successor=fixture();assert.notEqual(successor.host,f.host);
 assert.equal(ReadingOfflineHost.forRuntime(f.rpc,()=>false),undefined,'retired lookup cannot replace successor cached owner');
 assert.equal(ReadingOfflineHost.forRuntime(successor.rpc,()=>true),successor.host);
}
}
if(id==='resource-failure'){
{
 const f=fixture();f.rpc.markOfflineImageChapterComplete=async()=>{throw new ReadingOfflineMaterializationError('storage_full','存储空间不足');};
 await f.host.downloadBook(f.binding);
 assert.equal(f.entries()[0].downloadState,'cached','readable durable body survives its failed materialization');
 assert.equal(f.host.snapshot().progress.completedChapters,0);assert.equal(f.host.snapshot().progress.cachedChapters,1);
 assert.equal(f.host.snapshot().progress.failedChapters,1,'final availability merge retains same-operation failures');
 assert.match(f.host.snapshot().progress.firstFailure.reason,/存储空间不足/);
}
}
if(id==='manga-supplement'){
{
 const f=mangaFixture(),gate=defer();f.imageGates.set(0,gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='image'));const generation=f.host.snapshot().generation;
 await f.host.operateManga('pause',1,f.binding);
 assert.equal(f.state[1],'paused');assert.equal(f.leases.size,2,'target unstarted lease settles without waiting for another image');
 assert.equal(f.calls.some(c=>c.method==='image'&&c.p.chapterIndex===1),false);assert.equal(f.host.busy(),true);
 await f.host.operateManga('resume',1,f.binding);await until(()=>f.retained.has(1));
 assert.equal(f.host.snapshot().generation,generation,'supplemental resume retains the original finite operation');
 assert.deepEqual(f.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.p.chapterRange),[[0,3],[1,2]]);
 gate.resolve();await work;assert.deepEqual(f.state,['completed','completed','completed']);assert.equal(f.host.busy(),false);
 assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.leases.size,0);assert.equal(f.preparations.size,0);
 assert.ok(f.entries().every(e=>e.bookmarks[0].time===e.index),'download projection preserves newer bookmark rows');
}
}
if(id==='manga-future-cancel'){
{
 const f=mangaFixture(41),gate=defer();f.state[25]='paused';f.imageGates.set(0,gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='image'));await f.host.operateManga('cancel',25,f.binding);gate.resolve();await work;
 assert.equal(f.state[25],'cancelled');assert.equal(f.calls.some(c=>c.method==='image'&&c.p.chapterIndex===25),false);
 assert.ok(f.calls.filter(c=>c.method==='cache.book.prefetch').every(c=>!(c.p.chapterRange[0]<=25&&c.p.chapterRange[1]>25)),
  'later whole-book slices cannot reclaim a cancelled chapter');assert.equal(f.retained.size,40);
}
}
if(id==='manga-pending-claim'){
{
 const f=mangaFixture(),gate=defer();f.claimGate(gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='cache.book.prefetch'));
 let stopped=false;const stop=f.host.operateManga('pause',undefined,f.binding).then(()=>stopped=true);
 await until(()=>f.state.every(s=>s==='paused'));assert.equal(stopped,false,'stop waits for an accepted claim still absent from Host results');
 gate.resolve();await Promise.all([work,stop]);assert.equal(f.calls.some(c=>c.method==='image'),false);
 assert.equal(f.leases.size,0);assert.equal(f.host.busy(),false);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');
}
}
if(id==='manga-clear-drain'){
{
 const f=mangaFixture(),gate=defer();f.seedRetained(1);f.imageGates.set(0,gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='image'));const clear=f.host.clearBook(f.binding);await tick();
 assert.equal(f.calls.some(c=>c.method==='cache.clear'),false,'clear cannot race the old explicit download consumer');
 gate.resolve();await Promise.all([work,clear]);assert.equal(f.calls.filter(c=>c.method==='cache.clear').length,1);
 assert.equal(f.retained.has(1),true);assert.equal(f.entries()[1].downloadState,'completed','ordinary clear preserves permanent downloads');
 assert.ok(f.calls.findIndex(c=>c.method==='cache.clear')>f.calls.findLastIndex(c=>c.method==='cache.chapter.materialization.report'));
}
}
if(id==='manga-replacement'){
{
 const f=mangaFixture(),gate=defer();f.seedRetained(1);f.imageGates.set(1,gate);
 const update=f.host.operateManga('updateChapter',1,f.binding);await until(()=>f.calls.some(c=>c.method==='image'));
 assert.equal(f.retained.get(1),'version-1-0','old selected download remains owned while replacement files are incomplete');
 assert.ok(f.calls.findIndex(c=>c.method==='manga.chapter.get')<f.calls.findIndex(c=>c.method==='cache.book.prefetch'));
 gate.resolve();await update;await until(()=>!f.host.busy());
 assert.equal(f.retained.get(1),'version-1-1');assert.equal(f.entries()[1].downloadState,'completed');
}
}
if(id==='manga-delete'){
{
 const f=mangaFixture(),gate=defer();f.imageGates.set(0,gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='image'));await f.host.operateManga('cancel',1,f.binding);
 gate.resolve();await work;assert.equal(f.state[1],'cancelled');assert.equal(f.retained.has(1),false);
 const before=f.calls.filter(c=>c.method==='cache.book.prefetch').length;await f.host.operateManga('resume',undefined,f.binding);
 assert.equal(f.calls.filter(c=>c.method==='cache.book.prefetch').length,before,'resume never restarts cancelled chapters or a new whole-book scope');
 const outcome=await f.host.operateManga('deleteDownloads',0,f.binding);assert.equal(outcome.removedVersions,1);
 assert.equal(f.retained.has(0),false);assert.equal(f.files.has('0:version-0-0'),false);
}
}
if(id==='manga-directory'){
{
 const f=mangaFixture(1);await f.host.downloadBook(f.binding);
 const gateway=new ReadingOfflineGateway(f.runtime);
 assert.equal((await gateway.loadDirectoryProjection(f.session))[0].downloadState,'completed',
  'a directory preserves verified permanent manga completion');
 f.files.clear();assert.equal((await gateway.loadDirectoryProjection(f.session))[0].downloadState,'cached',
  'damaged permanent chapter bytes cannot be published completed');
 f.seedRetained(0);f.retained.clear();const before=f.calls.length;
 assert.equal((await gateway.loadDirectoryProjection(f.session))[0].downloadState,'cached',
  'released permanent ownership is reusable cache, not a completed download');
 assert.equal(f.calls.slice(before).some(c=>c.method==='manga.entry.get'),false,
  'released retention downgrades before exact-file verification without new cache state');
}
}
if(id==='sdk-download'){
{
 const f=fixture();await f.host.downloadBook(f.binding);assert.equal(f.host.busy(),false);assert.equal(f.host.snapshot().projection.receipt.fact,'confirmedCurrent');assert.equal(f.host.snapshot().materialization,'succeeded');assert.equal(f.entries()[0].downloadState,'completed');assert.equal(f.entries()[0].level,2);assert.equal(f.entries()[0].bookmarks[0].time,4);assert.equal(f.host.snapshot().progress.completedChapters,1);
}
}
if(id==='sdk-retirement'){
for(const action of ['downloadChapter','clearBook'])for(const retire of ['retire','unset']){
 const f=fixture(),d=defer();f.rpc.pause=d;const task=action==='downloadChapter'?f.host.downloadChapter(0,f.binding):f.host.clearBook(f.binding);await tick();const count=f.delivered.length;await f.host.downloadBook(f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1,'one finite mutex');f[retire]();d.resolve();await task;assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');assert.equal(f.host.snapshot().materialization,'retired');assert.equal(f.host.busy(),false);assert.equal(f.delivered.length,count);
 if(action==='downloadChapter')assert.equal(f.rpc.calls.filter(c=>c.method==='cache.chapter.materialization.report').length,1,'retired granted lease still terminally reported');else assert.equal(f.rpc.calls.filter(c=>c.method==='host.clearImages').length,0,'old owner never clears successor images after retirement');
 f.restore();await f.host.reconcile(f.host.snapshot().generation,f.binding);assert.equal(f.rpc.calls.filter(c=>c.method==='cache.book.prefetch'||c.method==='cache.clear').length,1);
}
}
if(id==='sdk-manga-pending-claim'){
{
 const f=mangaFixture(),gate=defer();f.claimGate(gate);const work=f.host.downloadBook(f.binding);
 await until(()=>f.calls.some(c=>c.method==='cache.book.prefetch'));
 let stopped=false;const stop=f.host.operateManga('pause',undefined,f.binding).then(()=>stopped=true);
 await until(()=>f.state.every(s=>s==='paused'));assert.equal(stopped,false,'stop waits for an accepted claim still absent from Host results');
 gate.resolve();await Promise.all([work,stop]);assert.equal(f.calls.some(c=>c.method==='image'),false);
 assert.equal(f.leases.size,0);assert.equal(f.host.busy(),false);assert.equal(f.host.snapshot().projection.receipt.confirmation,'confirmed');
}
}
}finally{}
}
const definitions={"download": "download actual scoped owner/gateway/storage path; controlled Core/OS ports", "clear-cleanup": "clear-cleanup actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown-clear": "unknown-clear actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown-download": "unknown-download actual scoped owner/gateway/storage path; controlled Core/OS ports", "retirement": "retirement actual scoped owner/gateway/storage path; controlled Core/OS ports", "readback": "readback actual scoped owner/gateway/storage path; controlled Core/OS ports", "runtime-owner": "runtime-owner actual scoped owner/gateway/storage path; controlled Core/OS ports", "resource-failure": "resource-failure actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-supplement": "manga-supplement actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-future-cancel": "manga-future-cancel actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-pending-claim": "manga-pending-claim actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-clear-drain": "manga-clear-drain actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-replacement": "manga-replacement actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-delete": "manga-delete actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-directory": "manga-directory actual scoped owner/gateway/storage path; controlled Core/OS ports", "sdk-download": "sdk-download actual scoped owner/gateway/storage path; controlled Core/OS ports", "sdk-retirement": "sdk-retirement actual scoped owner/gateway/storage path; controlled Core/OS ports", "sdk-manga-pending-claim": "sdk-manga-pending-claim actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
