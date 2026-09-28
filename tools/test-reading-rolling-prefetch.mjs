import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const baseline=process.argv.includes('--baseline');
const root=new URL(baseline?'../../.reader-isolated/catalog-949-20260925/Reader-for-HarmonyOS/':'../',import.meta.url);
const { ReadingOfflineGateway }=await import(new URL('entry/src/main/ets/features/reading/ReadingOfflineGateway.ts',root));
const { RemoteReadingFlowGateway }=await import(new URL('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts',root));
const { LocalReadingFlowGateway }=await import(new URL('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts',root));
const { sameRemoteSessionEvidence }=await import(new URL('entry/src/main/ets/features/reading/RemoteReadingEvidence.ts',root));
const { BookAcquisitionCoordinator }=await import(new URL('entry/src/main/ets/app/BookAcquisitionCoordinator.ts',root));
const file=new URL('entry/src/main/ets/pages/Index.ets',root),checks=[],warnings=[];
let currentOwner;
const Index=productionMotionMethods(file,['applyReadingCommit','prefetchReadingWindow','mergeDirectoryBookmarks','isRemoteCatalogNearEnd','loadRemoteDirectoryProjection'],{
 ReadingOfflineGateway,RemoteReadingFlowGateway,LocalReadingFlowGateway,sameRemoteSessionEvidence,ReaderRuntimeOwner:{current:()=>currentOwner},READING_CACHE_BEFORE:2,READING_CACHE_AFTER:2,CATALOG_REFRESH_NEAR_END:3,CATALOG_REFRESH_RETRY_INTERVAL_MS:30000,DOMAIN:0,hilog:{warn(...v){warnings.push(v);},error(...v){assert.fail(`unexpected directory failure ${v}`);}},
});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
async function until(predicate){const deadline=Date.now()+10000;while(!predicate()){assert.ok(Date.now()<deadline,'production boundary not reached');await new Promise(r=>setTimeout(r,1));}}
function fixture(count=1370){
 const sourceId='source',bookId='book',calls=[],body='完整的离线小说正文。'.repeat(700);
 const session={identity:{sourceId,bookId},sourceVersion:'v8',catalogVersion:'catalog',contextVersion:'context',acquisitionMode:'online',book:{title:'终宋',author:'作者'},detailUrl:bookId,continuationVariables:[],hostRequirements:[],entries:Array.from({length:count},(_,index)=>({index,title:`章${index}`,url:`https://source.invalid/${index}`,variables:[]}))};
 const state={activeBodies:0,peakBodies:0,activePrefetch:0,peakPrefetch:0,manifest:0,contentRevision:0,beforePrefetch:async()=>{},beforeBody:async()=>{},beforeStatus:async()=>{},missingManifests:new Set(),leases:[],materialized:[],failPrefetch:false,failedChapters:new Set(),reports:[],failReport:new Set()};
 async function execute(method,p={},options={}){
  calls.push({method,p,options});if(options.shouldCancel?.())throw Error('cancelled');
  const identity={sourceId:p.sourceId,bookId:p.bookId};
  if(method==='cache.book.prefetch'){state.activePrefetch++;state.peakPrefetch=Math.max(state.peakPrefetch,state.activePrefetch);try{await state.beforePrefetch(p,options);if(state.failPrefetch)throw Error('fixture HTTP 503');return{data:{...identity,chapterRange:p.chapterRange,materializations:state.leases.filter(i=>i>=p.chapterRange[0]&&i<p.chapterRange[1]).map(chapterIndex=>({chapterIndex,token:`lease-${chapterIndex}`}))}};}finally{state.activePrefetch--;}}
  if(method==='cache.book.status'){await state.beforeStatus(p);return{data:{...identity,chapters:session.entries.map(e=>({chapterIndex:e.index,state:state.failedChapters.has(e.index)?'failed':'completed',cachedBytes:body.length,lastError:state.failedChapters.has(e.index)?'HTTP status 503':undefined}))}};}
  if(method==='chapter.content'){state.activeBodies++;state.peakBodies=Math.max(state.peakBodies,state.activeBodies);try{await state.beforeBody(p,options);return{data:{...identity,chapterTitle:session.entries[p.chapterIndex].title,content:body,via:'cache'}};}finally{state.activeBodies--;}}
  if(method==='reading.progress.get')return{data:{found:false,progress:null,progressRevision:'revision'}};
  if(method==='bookmark.list')return{data:{bookmarks:[{bookName:p.bookName,bookAuthor:p.bookAuthor,time:1,chapterIndex:988,chapterPos:15,chapterName:'第982章',content:'书签',bookText:'正文'}]}};
  if(method==='cache.chapter.materialization.report'){assert.equal(options.shouldCancel,undefined,'terminal reports survive caller cancellation');state.reports.push(p);if(state.failReport.has(p.chapterIndex))throw Error('fixture report failure');return{data:{...identity,chapterIndex:p.chapterIndex,state:p.outcome,retainedCachedBody:true}};}
  throw Error('unexpected '+method);
 }
 const runtime={supportsCoreCapability:c=>c==='chapter.content.cacheOnly.v1',captureReadingContentValidity:()=>{const revision=state.contentRevision;return()=>revision===state.contentRevision;},isOfflineImageChapterComplete:async identity=>{state.manifest++;return !state.missingManifests.has(identity.chapterIndex);},markOfflineImageChapterComplete:async identity=>{state.materialized.push(identity);},request:execute};
 currentOwner=runtime;
 const page=Object.assign(new Index(),{detailBook:{sourceId,bookId},remoteReadingSession:session,readingSessionActive:true,navigationGeneration:1,consumeSystemFileOpen(){},refreshRemoteCatalogNearEnd(){assert.fail('fixture chapter not near tail');}});
 let publications=0,toc=session.entries.map(e=>({index:e.index,title:e.title,navigable:true,downloadState:'completed',bookmarks:[]}));
 Object.defineProperty(page,'detailToc',{get:()=>toc,set:v=>{publications++;toc=v;}});
 const active=[],prefetch=page.prefetchReadingWindow.bind(page);page.prefetchReadingWindow=(...a)=>{const work=prefetch(...a);active.push(work);return work;};
 const commit=(index=988,offset=0)=>page.applyReadingCommit({...page.remoteReadingSession.identity,chapterIndex:index,chapterOffset:offset});
 return{session,state,runtime,page,calls,body,execute,commit,publications:()=>publications,count:m=>calls.filter(c=>c.method===m).length,settle:()=>Promise.all(active),reads:()=>calls.filter(c=>c.method==='chapter.content').map(c=>c.p.chapterIndex)};
}
{
 const f=fixture(),started=performance.now();for(let i=0;i<4;i++)f.commit(988,i*100);await f.settle();
 const result={mode:baseline?'baseline':'regression',chapters:1370,pageCommits:4,prefetchCalls:f.count('cache.book.prefetch'),bodyReads:f.count('chapter.content'),manifestChecks:f.state.manifest,peakBodyRequests:f.state.peakBodies,peakPrefetchCommands:f.state.peakPrefetch,fullTocPublications:f.publications(),materializedBodyChars:f.count('chapter.content')*f.body.length,hostProbeElapsedMs:Number((performance.now()-started).toFixed(2)),indexSha256:createHash('sha256').update(readFileSync(file)).digest('hex')};
 if(baseline){assert.equal(result.bodyReads,1370*4);assert.equal(result.prefetchCalls,4);assert.equal(result.fullTocPublications,4);}else{assert.equal(result.prefetchCalls,1);assert.equal(result.bodyReads,5);assert.equal(result.manifestChecks,5);assert.equal(result.fullTocPublications,0);for(let i=0;i<4;i++){f.commit(988,500+i*100);await f.settle();}assert.equal(f.count('cache.book.prefetch'),1);checks.push('1370 chapters / eight same-chapter commits use one five-chapter window');}
 console.log(JSON.stringify(result,null,2));
}
if(!baseline){
 {
  const f=fixture(),old=f.page.detailToc;old[988].bookmarks=[{id:'kept'}];await f.page.prefetchReadingWindow(f.session,988);f.state.contentRevision++;f.state.missingManifests.add(988);await f.page.prefetchReadingWindow(f.session,988);
  assert.equal(f.count('cache.book.prefetch'),2);assert.equal(f.count('chapter.content'),10);assert.equal(f.publications(),1);assert.equal(f.page.detailToc[988].downloadState,'cached');assert.equal(f.page.detailToc[988].bookmarks,old[988].bookmarks);assert.equal(f.page.detailToc[987],old[987]);assert.equal(f.page.detailToc[100],old[100]);checks.push('content mutation rechecks identities; missing resource patches only its row and preserves bookmarks');
 }
 {
  const f=fixture(),gate=deferred();f.state.beforePrefetch=async p=>{if(p.chapterRange[0]===986)await gate.promise;};const first=f.page.prefetchReadingWindow(f.session,988);await until(()=>f.count('cache.book.prefetch')===1);const middle=f.page.prefetchReadingWindow(f.session,989),latest=f.page.prefetchReadingWindow(f.session,995);gate.resolve();await Promise.all([first,middle,latest]);
  assert.deepEqual(f.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.p.chapterRange),[[986,991],[993,998]]);assert.deepEqual(f.reads().sort((a,b)=>a-b),[993,994,995,996,997]);assert.equal(f.state.peakPrefetch,1);checks.push('pending windows coalesce to latest and old window performs no body work');
 }
 {
  const f=fixture(),gate=deferred();f.state.beforeBody=async p=>{if(p.chapterIndex>=986&&p.chapterIndex<991)await gate.promise;};const first=f.page.prefetchReadingWindow(f.session,988);await until(()=>f.count('chapter.content')===5);f.state.missingManifests.add(988);f.page.navigationGeneration++;const newer={...f.session,identity:{sourceId:'other-source',bookId:'other-book'},contextVersion:'new'};f.page.remoteReadingSession=newer;f.page.detailBook=newer.identity;const next=f.page.prefetchReadingWindow(newer,995);gate.resolve();await Promise.all([first,next]);
  assert.equal(f.page.detailToc[988].downloadState,'completed');assert.equal(f.publications(),0);assert.equal(f.count('cache.book.prefetch'),2);assert.equal(f.state.manifest,5);checks.push('late body results from old source cannot publish after navigation and session switch');
 }
 {
  const f=fixture(),gate=deferred();f.state.beforePrefetch=async()=>gate.promise;const old=f.page.prefetchReadingWindow(f.session,988);await until(()=>f.count('cache.book.prefetch')===1);const replacement=fixture();const next=f.page.prefetchReadingWindow(f.session,988);gate.resolve();await Promise.all([old,next]);assert.equal(f.count('chapter.content'),0);assert.equal(replacement.count('chapter.content'),5);checks.push('runtime replacement executes queued work through its current owner');
 }
 {
  const f=fixture(),before=warnings.length,realNow=Date.now;let now=realNow();Date.now=()=>now;
  try{f.state.failPrefetch=true;await f.page.prefetchReadingWindow(f.session,988);for(let i=0;i<4;i++){f.commit();await f.settle();}assert.equal(f.count('cache.book.prefetch'),1);assert.equal(warnings.length,before+1);assert.equal(f.publications(),0);f.state.failPrefetch=false;now+=30001;await f.page.prefetchReadingWindow(f.session,988);assert.equal(f.count('chapter.content'),5);}finally{Date.now=realNow;}
  checks.push('network failure is retried after short backoff without a per-page storm');
 }
 {
  const f=fixture(),realNow=Date.now;let now=realNow();Date.now=()=>now;
  try{f.state.failedChapters.add(988);await f.page.prefetchReadingWindow(f.session,988);assert.equal(f.page.detailToc[988].downloadState,'cached');await f.page.prefetchReadingWindow(f.session,988);assert.equal(f.count('cache.book.prefetch'),1);f.state.failedChapters.clear();now+=30001;await f.page.prefetchReadingWindow(f.session,988);assert.equal(f.count('cache.book.prefetch'),2);assert.equal(f.page.detailToc[988].downloadState,'completed');}finally{Date.now=realNow;}
  checks.push('Core failed status remains retryable even when its retained body is cached');
 }
 {
  const f=fixture(12);f.state.leases=[4,5,6,7,8];const gateway=new ReadingOfflineGateway(f.runtime),result=await gateway.prefetchWindow(f.session,4,9);assert.deepEqual(result.entries.map(e=>e.index),[4,5,6,7,8]);assert.equal(f.count('chapter.content'),5);assert.equal(f.state.materialized.length,5);assert.equal(f.state.reports.length,5);assert.equal(result.completedChapters,5);const full=await gateway.loadProjection(f.session);assert.equal(full.length,12);assert.equal(f.count('chapter.content'),17);assert.ok(full.every(e=>e.downloadState==='completed'));checks.push('materialized window reuses exact identity once; full explicit projection verifies all chapters');
 }
 {
  const f=fixture(12);f.state.missingManifests.add(5);const full=await new ReadingOfflineGateway(f.runtime).prefetchRange(f.session,4,9);assert.equal(full.length,12);assert.equal(f.count('chapter.content'),12);assert.equal(full[5].downloadState,'cached');checks.push('explicit range retains whole-book completion semantics and missing-resource downgrade');
 }
 {
  const f=fixture(12),other={...f.session,identity:{sourceId:'other',bookId:'other-book'}};await Promise.all([f.page.prefetchReadingWindow(f.session),f.page.prefetchReadingWindow(other)]);assert.equal(f.count('reading.progress.get'),2);assert.equal(f.count('cache.book.prefetch'),2);assert.deepEqual(new Set(f.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.p.bookId)),new Set(['book','other-book']));checks.push('manual shelf update preserves independent work for each book');
 }
 {
  const f=fixture(12),coordinator=new BookAcquisitionCoordinator(f.execute),priorities=[];let manualFence=0;const suspend=coordinator.readingPreparations.suspend.bind(coordinator.readingPreparations);coordinator.readingPreparations.suspend=()=>{manualFence++;suspend();};const request=coordinator.request.bind(coordinator);coordinator.request=(m,p,o,priority)=>{priorities.push(priority);return request(m,p,o,priority);};f.runtime.bookAcquisitions=()=>coordinator;f.runtime.request=(...a)=>coordinator.request(...a);
  try{await new ReadingOfflineGateway(f.runtime).prefetchWindow(f.session,4,9);assert.equal(manualFence,0);assert.ok(priorities.every(p=>p==='background'));await new ReadingOfflineGateway(f.runtime).prefetchRange(f.session,4,9);assert.equal(manualFence,1);}finally{coordinator.close();}checks.push('real coordinator runs window in background; explicit downloads retain foreground fence');
 }
 {
  const f=fixture(12);f.state.leases=[4,5,6,7,8];let current=true;f.state.beforePrefetch=async()=>{current=false;};await assert.rejects(new ReadingOfflineGateway(f.runtime).prefetchWindow(f.session,4,9,()=>current));assert.equal(f.count('chapter.content'),0);assert.deepEqual(f.state.reports.map(r=>r.chapterIndex).sort((a,b)=>a-b),[4,5,6,7,8]);assert.ok(f.state.reports.every(r=>r.outcome==='failed'&&r.errorCode==='cancelled'));checks.push('cancelled prefetch response closes every returned lease without reading bodies');
 }
 {
  const f=fixture(12),gate=deferred();f.state.leases=[4,5,6,7,8];let current=true;f.state.beforeBody=async()=>gate.promise;const work=new ReadingOfflineGateway(f.runtime).prefetchWindow(f.session,4,9,()=>current);await until(()=>f.count('chapter.content')===2);current=false;gate.resolve();await assert.rejects(work);assert.equal(f.count('chapter.content'),2);assert.deepEqual(f.state.reports.map(r=>r.chapterIndex).sort((a,b)=>a-b),[4,5,6,7,8]);assert.ok(f.state.reports.every(r=>r.outcome==='failed'));checks.push('mid-materialization cancellation drains unclaimed leases before rejecting');
 }
 {
  const f=fixture(12);f.state.leases=[4,5,6,7,8];f.state.failReport.add(4);await assert.rejects(new ReadingOfflineGateway(f.runtime).prefetchWindow(f.session,4,9));assert.deepEqual(new Set(f.state.reports.map(r=>r.chapterIndex)),new Set([4,5,6,7,8]));assert.equal(f.state.reports.filter(r=>r.chapterIndex===4).length,3);checks.push('one terminal report failure is surfaced without stranding other leases');
 }
 {
  const f=fixture();const entries=await f.page.loadRemoteDirectoryProjection(new ReadingOfflineGateway(f.runtime),f.runtime,f.session,()=>true);assert.equal(entries.length,1370);assert.ok(entries.every(e=>e.downloadState==='cached'));assert.equal(f.count('cache.book.status'),1);assert.equal(f.count('chapter.content'),0);assert.equal(f.state.manifest,0);assert.equal(f.count('bookmark.list'),1);assert.equal(entries[988].bookmarks[0].content,'书签');checks.push('production Index 1370-entry directory preserves bookmarks with one metadata read and zero body or manifest work');
 }
 {
  const f=fixture(),gate=deferred();f.state.beforeStatus=async()=>gate.promise;const work=new ReadingOfflineGateway(f.runtime).loadDirectoryProjection(f.session);await until(()=>f.count('cache.book.status')===1);f.state.contentRevision++;gate.resolve();await assert.rejects(work);assert.equal(f.count('chapter.content'),0);checks.push('directory metadata projection rejects content mutation during status read');
 }
 console.log(JSON.stringify({checks:checks.length,passed:checks},null,2));
}
