import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const {registerHooks,stripTypeScriptTypes}=await import('node:module');
const {readFileSync}=await import('node:fs');
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {ReadingOfflineGateway}=await import('../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const {errorMessageOf}=await import('../entry/src/main/ets/app/ErrorMessage.ts');
let currentOwner;const ownedHosts=[];
const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingPrefetchHost.ts',import.meta.url),'utf8');
const compile=source=>new Function('ReaderRuntimeOwner','ReadingOfflineGateway','RemoteReadingFlowGateway','sameRemoteSessionEvidence','canAppendRemoteReadingCatalog','errorMessageOf',
 stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'')).replace(/\bexport /g,'')+';return ReadingPrefetchHost;')(
 {current:()=>currentOwner,isCurrent:owner=>currentOwner===owner},ReadingOfflineGateway,RemoteReadingFlowGateway,evidence.sameRemoteSessionEvidence,evidence.canAppendRemoteReadingCatalog,errorMessageOf);
const ProductionHost=compile(source),checks=[],warnings=[];
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function until(predicate){for(let turn=0;turn<1000;turn++){if(predicate())return;await new Promise(setImmediate);}assert.fail('controlled production boundary not reached');}
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
 currentOwner=runtime;const host=new ProductionHost(runtime);ownedHosts.push(host);
 const page={detailBook:{sourceId,bookId},remoteReadingSession:session,readingSessionActive:true,navigationGeneration:1};
 let publications=0,toc=session.entries.map(e=>({index:e.index,title:e.title,navigable:true,downloadState:'completed',bookmarks:[]}));
 Object.defineProperty(page,'detailToc',{get:()=>toc,set:v=>{publications++;toc=v;}});
 const active=[];page.prefetchReadingWindow=(intended,chapterIndex)=>{
   const navigation=page.navigationGeneration;
   const lease={isCurrent:()=>navigation===page.navigationGeneration&&currentOwner===runtime&&page.readingSessionActive,
     displayedSession:()=>page.remoteReadingSession,directory:()=>page.detailToc,projected:entries=>{page.detailToc=entries;},refreshed:next=>{page.remoteReadingSession=next;},diagnostic:(stage,message)=>warnings.push({stage,message})};
   const work=host.prefetch(intended,chapterIndex,lease,chapterIndex===undefined?'opportunistic':'reader');active.push(work);return work;
 };
 const commit=(index=988)=>page.prefetchReadingWindow(page.remoteReadingSession,index);
 return{host,session,state,runtime,page,calls,body,execute,commit,publications:()=>publications,count:m=>calls.filter(c=>c.method===m).length,settle:()=>Promise.all(active),reads:()=>calls.filter(c=>c.method==='chapter.content').map(c=>c.p.chapterIndex)};
}

try{
if(id==='window-coalescing'){
{
 const f=fixture();for(let i=0;i<8;i++)f.commit(988);await f.settle();
 assert.equal(f.count('cache.book.prefetch'),1);assert.equal(f.count('chapter.content'),5);assert.equal(f.publications(),0);
 assert.equal(f.state.peakPrefetch,1);checks.push('actual1370catalog-eightcommits-one-fivechapter-window');
}
}
if(id==='latest-window'){
{
 const f=fixture(),gate=deferred();f.state.beforePrefetch=async p=>{if(p.chapterRange[0]===986)await gate.promise;};
 const first=f.commit(988);await until(()=>f.count('cache.book.prefetch')===1);const middle=f.commit(989),latest=f.commit(995);gate.resolve();
 await Promise.all([first,middle,latest]);assert.deepEqual(f.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.p.chapterRange),[[986,991],[993,998]]);
 assert.deepEqual(f.reads().sort((a,b)=>a-b),[993,994,995,996,997]);assert.equal(f.state.peakPrefetch,1);
 checks.push('actual-latest-window-coalescing-no-obsolete-body-work');
}
}
if(id==='lease-drain'){
{
 const f=fixture(),gate=deferred();f.state.leases=[986,987,988,989,990];f.state.beforeBody=async()=>gate.promise;
 const work=f.commit(988);await until(()=>f.count('chapter.content')===2);f.host.retire();gate.resolve();await work;
 assert.equal(f.publications(),0);assert.deepEqual(new Set(f.state.reports.map(r=>r.chapterIndex)),new Set(f.state.leases));
 assert.ok(f.state.reports.every(r=>r.outcome==='failed'));checks.push('retired-owner-drains-real-Gateway-materialization-leases-no-late-publication');
}
}
if(id==='content-revision'){
{
 const f=fixture(),old=f.page.detailToc;old[988].bookmarks=[{id:'kept'}];await f.commit();f.state.contentRevision++;f.state.missingManifests.add(988);
 await f.commit();assert.equal(f.count('cache.book.prefetch'),2);assert.equal(f.publications(),1);assert.equal(f.page.detailToc[988].downloadState,'cached');
 assert.equal(f.page.detailToc[988].bookmarks,old[988].bookmarks);assert.equal(f.page.detailToc[987],old[987]);
 checks.push('content-revision-rechecks-window-immutable-row-patch-preserves-bookmarks');
}
}
if(id==='failure-backoff'){
{
 const f=fixture(),realNow=Date.now;let now=realNow();Date.now=()=>now;
 try {f.state.failedChapters.add(988);await f.commit();for(let i=0;i<4;i++)await f.commit();assert.equal(f.count('cache.book.prefetch'),1);
   f.state.failedChapters.clear();now+=30001;await f.commit();assert.equal(f.count('cache.book.prefetch'),2);
   assert.equal(f.page.detailToc[988].downloadState,'completed');}finally{Date.now=realNow;}
 checks.push('actual-failed-window-30second-retry-budget');
}
}
if(id==='independent-books'){
{
 const f=fixture(12),other={...f.session,identity:{sourceId:'other',bookId:'other-book'}};
 await Promise.all([f.page.prefetchReadingWindow(f.session),f.page.prefetchReadingWindow(other)]);
 assert.equal(f.count('reading.progress.get'),2);assert.equal(f.count('cache.book.prefetch'),2);
 assert.deepEqual(new Set(f.calls.filter(c=>c.method==='cache.book.prefetch').map(c=>c.p.bookId)),new Set(['book','other-book']));
 checks.push('explicit-perbook-shelf-work-is-not-reader-queue-coalesced');
}
}
if(id==='exact-navigation'){
{
 const f=fixture(12),unknown=1000000;await f.commit(unknown);assert.equal(f.count('cache.book.prefetch'),0);
 assert.equal(f.host.nearEnd(f.session,unknown),false);assert.equal(f.host.nearEnd(f.session,8),true);
 checks.push('unknown-navigation-index-not-clamped-to-another-row');
}
}
if(id==='refresh-join'){
{
 const f=fixture(12),gate=deferred(),session=f.session;let requests=0,published=0;const diagnostics=[];
 f.runtime.bookAcquisitions=()=>({async acquireBook(seed,options){requests++;assert.equal(options.forceRefresh,true);assert.equal(seed.sourceId,session.identity.sourceId);await gate.promise;return{...session,catalogVersion:'catalog2',entries:[...session.entries,{index:12,title:'new',url:'https://source.invalid/12',variables:[]}]};}});
 const lease={isCurrent:()=>true,displayedSession:()=>session,directory:()=>f.page.detailToc,projected(){},refreshed(){published++;throw Error('UI failed');},diagnostic:(_,message)=>diagnostics.push(message)};
 const first=f.host.refreshNearEnd(session,lease);await Promise.resolve();const same=f.host.refreshNearEnd(session,lease);gate.resolve();await Promise.all([first,same]);
 assert.equal(requests,1);assert.equal(published,1);assert.deepEqual(diagnostics,[]);
 await f.host.refreshNearEnd(session,lease);assert.equal(requests,1,'observer throw cannot erase actual refresh cooldown');
 checks.push('actual-refresh-inflight-dedup-append-eligibility-observer-isolation');
}
}
if(id==='catalog-reopen'){
{
 const f=fixture(12),session=f.session,realNow=Date.now;let now=realNow(),requests=0;Date.now=()=>now;
 f.runtime.bookAcquisitions=()=>({async acquireBook(){requests++;return{...session,catalogVersion:'changed',entries:session.entries.slice(1)};}});
 const errors=[],lease={isCurrent:()=>true,displayedSession:()=>session,directory:()=>f.page.detailToc,projected(){},refreshed(){assert.fail('cannot replace a retained tree with changed prior chapters');},diagnostic:(_,message)=>{errors.push(message);throw Error('diagnostic unavailable');}};
 try {f.host.noteCatalogRefresh(session.identity,now/1000);await f.host.refreshNearEnd(session,lease);assert.equal(requests,0);
  now+=600001;await f.host.refreshNearEnd(session,lease);assert.equal(requests,1);assert.deepEqual(errors,['READING_CATALOG_REFRESH_REQUIRES_REOPEN']);
  await f.host.refreshNearEnd(session,lease);assert.equal(requests,1);now+=30001;await f.host.refreshNearEnd(session,lease);assert.equal(requests,2);
 }finally{Date.now=realNow;}
 checks.push('persisted-lastCheck-cooldown-changed-catalog-requires-reopen-short-retry');
}
}
if(id==='refresh-retirement'){
{
 const f=fixture(12),gate=deferred(),session=f.session;f.runtime.bookAcquisitions=()=>({async acquireBook(){await gate.promise;return{...session,catalogVersion:'catalog2'};}});
 const lease={isCurrent:()=>true,displayedSession:()=>session,directory:()=>f.page.detailToc,projected(){},refreshed(){assert.fail('retired refresh cannot replace reader');},diagnostic(){assert.fail('retired refresh cannot publish failure');}};
 const work=f.host.refreshNearEnd(session,lease);f.host.retire();gate.resolve();await work;
 checks.push('late-refreshed-catalog-rejects-retired-lifecycle');
}
}
if(id==='lifecycle-negative'){
{
 const unsafe=source.replaceAll('lifecycle === this.lifecycle &&','true &&');assert.notEqual(unsafe,source);
 const f=fixture(12),BadHost=compile(unsafe),host=new BadHost(f.runtime),gate=deferred();let published=0;
 f.runtime.bookAcquisitions=()=>({async acquireBook(){await gate.promise;return{...f.session,catalogVersion:'catalog2'};}});
 const lease={isCurrent:()=>true,displayedSession:()=>f.session,directory:()=>f.page.detailToc,projected(){},refreshed(){published++;},diagnostic(){}};
 const work=host.refreshNearEnd(f.session,lease);host.retire();gate.resolve();await work;
 assert.equal(published,1,'negative control reproduces retired catalog delivery when own lifecycle admission is removed');
}
}
if(id==='deadline-retention'){
{
 const f=fixture(12),realNow=Date.now;let now=realNow();Date.now=()=>now;
 const gate=deferred(),session=f.session;let refreshes=0;f.runtime.bookAcquisitions=()=>({async acquireBook(){refreshes++;await gate.promise;return{...session,catalogVersion:'catalog2'};}});
 const lease={isCurrent:()=>true,displayedSession:()=>session,directory:()=>f.page.detailToc,projected(){},refreshed(){},diagnostic(){}};
 try {
  const past={sourceId:'past',bookId:'settled'},future={sourceId:'future',bookId:'clock'};
  f.host.noteCatalogRefresh(past,(now-600001)/1000);f.host.noteCatalogRefresh(future,(now+600000)/1000);
  assert.equal(f.host.refreshAt.has('past\u0000settled'),false);assert.equal(f.host.refreshAt.has('future\u0000clock'),true);
  const work=f.host.refreshNearEnd(session,lease);now+=3600000;f.host.retire();
  f.host.noteCatalogRefresh({sourceId:'another',bookId:'book'},now/1000);
  assert.equal(f.host.refreshInFlight.has('source\u0000book'),true,'retired native work still settling cannot be TTL-evicted');
  assert.equal(f.host.attemptAt.has('source\u0000book'),true);
  await f.host.refreshNearEnd(session,lease);assert.equal(refreshes,1,'a new live presentation cannot replace the old unsettled native refresh');
  gate.resolve();await work;f.host.noteCatalogRefresh({sourceId:'latest',bookId:'book'},now/1000);
  assert.equal(f.host.attemptAt.has('source\u0000book'),false,'actual settlement plus existing expiry permits cleanup');
 } finally {Date.now=realNow;}
 checks.push('expired-settled-deadlines-only-future-clock-and-inflight-retained');
}
}
if(id==='manga-excluded'){
{
 const f=fixture(12),manga={...f.session,contentKind:'manga'};
 for(const mode of ['reader','shelf','opportunistic'])await f.host.prefetch(manga,8,{isCurrent:()=>true,displayedSession:()=>manga,
 directory:()=>f.page.detailToc,projected:()=>assert.fail('manga text projection'),refreshed:()=>assert.fail('manga text refresh'),diagnostic:()=>{}},mode);
 assert.equal(f.host.nearEnd(manga,11),false);
 await f.host.refreshNearEnd(manga,{isCurrent:()=>true,displayedSession:()=>manga,directory:()=>[],projected(){},refreshed(){},diagnostic(){}});
 assert.equal(f.calls.length,0,'no text body/progress/prefetch or catalog IO may run for a manga session');
 checks.push('manga-excluded-from-optional-text-prefetch-and-catalog-refresh');
}
}
}finally{for(const host of ownedHosts)host.retire();currentOwner=undefined;}
}
const definitions={"window-coalescing": "window-coalescing actual scoped catalog/prefetch ownership; controlled Core/manifest port", "latest-window": "latest-window actual scoped catalog/prefetch ownership; controlled Core/manifest port", "lease-drain": "lease-drain actual scoped catalog/prefetch ownership; controlled Core/manifest port", "content-revision": "content-revision actual scoped catalog/prefetch ownership; controlled Core/manifest port", "failure-backoff": "failure-backoff actual scoped catalog/prefetch ownership; controlled Core/manifest port", "independent-books": "independent-books actual scoped catalog/prefetch ownership; controlled Core/manifest port", "exact-navigation": "exact-navigation actual scoped catalog/prefetch ownership; controlled Core/manifest port", "refresh-join": "refresh-join actual scoped catalog/prefetch ownership; controlled Core/manifest port", "catalog-reopen": "catalog-reopen actual scoped catalog/prefetch ownership; controlled Core/manifest port", "refresh-retirement": "refresh-retirement actual scoped catalog/prefetch ownership; controlled Core/manifest port", "lifecycle-negative": "lifecycle-negative actual scoped catalog/prefetch ownership; controlled Core/manifest port", "deadline-retention": "deadline-retention actual scoped catalog/prefetch ownership; controlled Core/manifest port", "manga-excluded": "manga-excluded actual scoped catalog/prefetch ownership; controlled Core/manifest port"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
