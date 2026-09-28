import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { ReadingChapterWindow } = await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const { canAppendRemoteReadingCatalog, sameRemoteSessionEvidence } = await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const { readingSessionDocuments } = await import('../entry/src/main/ets/features/reading/ReadingSessionDocuments.ts');
const { readReadingCatalog } = await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const file = name => new URL(`../entry/src/main/ets/${name}`,import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
const pause=()=>new Promise(r=>setTimeout(r,1));
async function until(predicate){const end=performance.now()+10000;while(!predicate()&&performance.now()<end)await pause();assert.ok(predicate(),'operation settled');}
const sourceId='source',bookId='book',sourceVersion='rule-v8';
const seed={sourceId,bookId,sourceVersion,detailUrl:'https://source.invalid/book',title:'终宋',author:'作者'};
// Synthetic data with the real incident's indices: seven preceding non-body
// rows place chapter 949 at index 955, chapter 950 at 956; total catalog 1370.
const allEntries=Array.from({length:1370},(_,index)=>({index,title:index<7?`卷 ${index}`:`第${index-6}章`,url:index<7?'':`https://source.invalid/${index}`,variables:[]}));
const projection=entries=>entries.map((e,position)=>({index:e.index,position,readablePosition:e.url?position-7:undefined,title:e.title,navigable:!!e.url,downloadState:'unknown'}));
const identity={sourceId,bookId};
function session(entries,catalogVersion='old'){return{identity,book:{title:seed.title,author:seed.author},sourceVersion,catalogVersion,contextVersion:'context',acquisitionMode:'online',detailUrl:seed.detailUrl,tocUrl:'https://source.invalid/toc',entries,continuationVariables:[],hostRequirements:['httpExecute']};}
function chapter(index=955){return{sourceId,bookId,chapterIndex:index,chapterTitle:allEntries[index].title,chapterUrl:allEntries[index].url,content:'body',images:[],contentVersion:`body-${index}`,bodyVersion:'body',processingVersion:'process',extractionVia:'rule'};}
function fixture(cachedSourceVersion=sourceVersion){
 const calls=[], warnings=[];let catalog=allEntries.slice(0,956),tocGate,fail=false;
 const runtime=new BookAcquisitionCoordinator(async(method,p={},options={})=>{
  calls.push({method,params:p});
  if(options.shouldCancel?.())throw Error('cancelled');
  if(method==='source.list')return{data:{sources:[{sourceId,sourceVersion,enabled:true}]}};
  if(method==='search-book.get')return{data:{book:{origin:sourceId,bookUrl:bookId,name:seed.title,author:seed.author,variable:'{}',acquisition:{sourceVersion:cachedSourceVersion,catalogAt:Date.now(),detailAt:Date.now()}}}};
  if(method==='cache.book.status')return{data:{sourceId,bookId,sourceVersion:cachedSourceVersion,catalogVersion:catalog.length===956?'old':'new',contextVersion:'context',tocAvailable:true,chapters:catalog.map(e=>({chapterIndex:e.index,title:e.title,url:e.url,variables:{}})),continuationVariables:{}}};
  if(method==='book.detail')return{data:{sourceId,sourceVersion,book:{bookId,title:seed.title,author:seed.author},tocUrl:'https://source.invalid/toc',variables:{}}};
  if(method==='book.toc'){
   if(tocGate)await tocGate.promise;if(fail)throw Error('HTTP status 503');catalog=allEntries;
   return{data:{sourceId,bookId,sourceVersion,catalogVersion:'new',contextVersion:'context',toc:catalog.map(e=>({...e,variables:{}}))}};
  }
  if(method==='reading.catalog.page')return{data:{kind:'ready',sourceId,bookId,revision:'old-catalog',offset:p.offset,chapterCount:catalog.length,readableChapterCount:catalog.length-7,entries:projection(catalog).slice(p.offset,p.offset+p.limit)}};
  throw Error(`unexpected ${method}`);
 });
 const owner={bookAcquisitions:()=>runtime,request:(...a)=>runtime.request(...a),supportsCoreCapability:c=>c==='reading.catalog.page.v1',captureReadingContentValidity:()=>()=>true};
 const Index=productionMotionMethods(file('pages/Index.ets'),['refreshRemoteCatalogNearEnd','isRemoteCatalogNearEnd','onRemoteSessionReady'],{
  RemoteReadingFlowGateway,canAppendRemoteReadingCatalog,sameRemoteSessionEvidence,ReaderRuntimeOwner:{current:()=>owner},CATALOG_REFRESH_INTERVAL_MS:600000,CATALOG_REFRESH_RETRY_INTERVAL_MS:30000,CATALOG_REFRESH_NEAR_END:3,DOMAIN:0,hilog:{warn:(...a)=>warnings.push(a)} });
 const page=Object.assign(new Index(),{readingSessionActive:true,navigationGeneration:1,remoteSessionGeneration:1,remoteCatalogRefreshAt:new Map(),remoteCatalogRefreshAttemptAt:new Map(),remoteCatalogRefreshInFlight:new Map(),detailBook:{...seed,sourceName:'佩蒲裴榕'},directoryCurrentChapterIndex:955,
  directoryBookmarkMutationGeneration:0,directoryBookmarkMutationActiveKey:'',offlineMutationGeneration:0,
  installRemoteReadingSession(s){if(!sameRemoteSessionEvidence(this.remoteReadingSession,s))this.remoteSessionGeneration++;this.remoteReadingSession=s;},refreshBookshelf(){} });
 return{runtime,owner,page,calls,warnings,gate:g=>{tocGate=g;},fail:v=>{fail=v;},catalog:()=>catalog};
}
const View=productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),['onRemoteCatalogChanged','prepareRemoteCatalogNearEnd','hydrateEntryCatalog','admitTocEntries','readingTocEntries','adjacentChapterIndex','turnNextPage','queuePageTurnPreparation','drainPageTurnPreparationQueue','completePreparedPageTurn','notifyReadingPresentationReady'],{
 sameRemoteSessionEvidence,LOCAL_READING_SOURCE_ID:'local',readerPageTransitionUsesPreparedPages:()=>true,errorMessageOf:e=>e.message,hilog:{warn(){},error(){}},
 PreparedReaderPageTurn:class{constructor(direction,page,context,key,originChapterIndex,originPageStartScalar,generation){Object.assign(this,{direction,page,context,key,originChapterIndex,originPageStartScalar,generation});}}
});
function reader(gateway,entries=allEntries.slice(0,956),index=955){
 const body=chapter(index),window=new ReadingChapterWindow();window.configure(sourceId,bookId,entries.filter(e=>e.url).map(e=>e.index));window.setCurrent(body);
 const page={startScalar:0,endScalar:4,fragments:[]},progress={chapterIndex:index,chapterOffset:0},opened=[];
 const v=Object.assign(new View(),{mounted:true,sourceId,bookId,phase:'ready',lifecycleToken:1,remoteCatalogAdmissionRevision:0,sessionGateway:gateway,chapter:body,visiblePage:page,lastCommittedProgress:progress,tocEntries:projection(entries),entryCatalogPending:false,chapterWindow:window,
  pageTurnGeneration:7,pageTurnPreparationQueue:[],pageTurnGestureState:{phase:'idle'},readerSettingsSnapshot:{navigationMode:'paged'},
  activeGateway:()=>gateway,isSessionActive(l){return this.mounted&&l===this.lifecycleToken;},releaseUnretainedReadingImages(){},drainRapidPageTurn(){},resumePendingAutoPageTurn(){},
  preparedPageTurn:()=>undefined,sessionLaunchRenderWorkBlocked:()=>false,canTurnPage:()=>true,adjacentPageTurnTarget:()=>undefined,knownPageTurnBoundary:()=>({kind:'boundary'}),scheduleBookTurnTextureRefresh(){},
  schedulePageTurnPreparation(){},onDirectoryProjectionChanged(){},lastVisibleScalar:()=>3,requireChapterLayoutMap:()=>({}),openPageTurnChapter(...a){opened.push(a);return true;},
  isStableVisiblePageOwner:()=>true,onReadingReady(){},scheduleTtsPresentationWarmup(){},scheduleEntryCatalogHydration(){} });
 return{v,body,page,progress,opened};
}
const checks=[];
async function check(name,run){await run();checks.push(name);console.log(`PASS ${name}`);}
await check('near-end force refresh bypasses prepared/durable catalogs, singleflights and appends chapter 950 in same mounted reader',async()=>{
 const f=fixture();try{
  const old=await f.runtime.acquireBook(seed);f.page.remoteReadingSession=old;
  const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',session:old},f.owner),r=reader(gateway);
  const install=f.page.installRemoteReadingSession.bind(f.page);f.page.installRemoteReadingSession=s=>{install(s);r.v.remoteSession=s;r.v.onRemoteCatalogChanged();};
  const gate=deferred();f.gate(gate);f.calls.length=0;
  f.page.refreshRemoteCatalogNearEnd(old);f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.calls.some(c=>c.method==='book.toc'));
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);assert.equal(f.page.remoteCatalogRefreshAt.size,0);
  assert.equal(r.v.turnNextPage().kind,'boundary');gate.resolve();await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
  assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,0);assert.equal(r.v.tocEntries.length,1370);
  assert.equal(gateway.remoteSession().catalogVersion,'new');assert.equal(r.v.chapter,r.body);assert.equal(r.v.visiblePage,r.page);assert.equal(r.v.lastCommittedProgress,r.progress);
  assert.equal(r.v.turnNextPage().kind,'started');assert.equal(r.opened.at(-1)[0],956);assert.equal(f.page.detailToc[956].title,'第950章');
  assert.equal(f.page.remoteCatalogRefreshAt.size,1);
 }finally{f.runtime.close();}
});
await check('actual coordinator re-admits v6 durable catalog under current v8 before safe refresh',async()=>{
 const f=fixture('rule-v6');try{
  const old=await f.runtime.acquireBook({...seed,sourceVersion:'rule-v6'});
  assert.equal(old.sourceVersion,sourceVersion);assert.equal(old.requiresContextRefresh,true);assert.equal(old.entries.length,956);
  f.page.remoteReadingSession=old;f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
  assert.equal(f.page.remoteReadingSession.sourceVersion,sourceVersion);assert.equal(f.page.remoteReadingSession.entries.length,1370);
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 }finally{f.runtime.close();}
});
await check('failed refresh preserves old catalog/page, uses short retry backoff and never marks freshness',async()=>{
 const f=fixture(),realNow=Date.now;let now=1000000;Date.now=()=>now;
 try{const old=await f.runtime.acquireBook(seed);f.page.remoteReadingSession=old;f.fail(true);f.calls.length=0;
  f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
  assert.equal(f.page.remoteReadingSession,old);assert.equal(f.page.remoteCatalogRefreshAt.size,0);assert.equal(f.warnings.length,1);
  f.page.refreshRemoteCatalogNearEnd(old);await pause();assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  now+=30001;f.fail(false);f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
  assert.equal(f.page.remoteReadingSession.entries.length,1370);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,2);
 }finally{Date.now=realNow;f.runtime.close();}
});
await check('late refresh cannot overwrite a same-book reentry or newer catalog evidence',async()=>{
 for(const mutate of ['reentry','catalog']){const f=fixture();try{
  const old=await f.runtime.acquireBook(seed);f.page.remoteReadingSession=old;const gate=deferred();f.gate(gate);
  f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.calls.some(c=>c.method==='book.toc'));
  if(mutate==='reentry')f.page.navigationGeneration++;else f.page.remoteReadingSession={...old,catalogVersion:'newer'};
  const kept=f.page.remoteReadingSession;gate.resolve();await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
  assert.equal(f.page.remoteReadingSession,kept);assert.equal(f.page.remoteCatalogRefreshAt.size,0);
 }finally{f.runtime.close();}}
});
await check('cold cached entry acquires only after full catalog near end, and later cached pages trigger the same path',async()=>{
 for(const index of [955,946]){const f=fixture();try{
  const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',seed,onSessionReady:s=>f.page.onRemoteSessionReady(s)},f.owner);
  const r=reader(gateway,allEntries.slice(0,956),index);r.v.entryCatalogPending=true;f.page.directoryCurrentChapterIndex=index;
  r.v.onReadingReady=value=>{f.page.directoryCurrentChapterIndex=value;};
  const install=f.page.installRemoteReadingSession.bind(f.page);f.page.installRemoteReadingSession=s=>{install(s);r.v.remoteSession=s;r.v.onRemoteCatalogChanged();};
  await r.v.hydrateEntryCatalog();
  if(index===946){assert.equal(gateway.remoteSession(),undefined);assert.ok(f.calls.every(c=>c.method==='reading.catalog.page'));
   r.v.chapter=chapter(953);r.v.chapterWindow.setCurrent(r.v.chapter);r.v.visiblePage={...r.page};
   r.v.notifyReadingPresentationReady(r.v.chapter,r.v.visiblePage,1,1);
  }
  r.v.prepareRemoteCatalogNearEnd();await until(()=>gateway.remoteSession()?.entries.length===1370);
  assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  assert.equal(r.v.adjacentChapterIndex(955,1),956);assert.equal(r.v.lastCommittedProgress,r.progress);
 }finally{f.runtime.close();}}
});
await check('cold first acquisition joins real coordinator refresh1370; same gateway evidence still extends old mounted navigation',async()=>{
 const f=fixture();try{
  const gate=deferred();f.gate(gate);
  const refresh=f.runtime.acquireBook(seed,{forceRefresh:true},'background');
  await until(()=>f.calls.some(c=>c.method==='book.toc'));
  const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',seed,onSessionReady:s=>f.page.onRemoteSessionReady(s)},f.owner);
  const r=reader(gateway),neighbour=chapter(954);r.v.chapterWindow.admitNeighbour(neighbour);r.v.entryCatalogPending=true;
  const install=f.page.installRemoteReadingSession.bind(f.page);f.page.installRemoteReadingSession=s=>{install(s);r.v.remoteSession=s;r.v.onRemoteCatalogChanged();};
  const docs=readingSessionDocuments(f.owner);docs.configure(sourceId,bookId,allEntries.slice(7,956).map(e=>e.index),()=>true);docs.admit(r.body,true);docs.admit(neighbour,false);
  assert.ok(docs.read(sourceId,bookId,954));await r.v.hydrateEntryCatalog();assert.equal(gateway.remoteSession(),undefined);
  gate.resolve();await refresh;await until(()=>r.v.remoteCatalogSessionPreparation===undefined);
  assert.equal(gateway.remoteSession().catalogVersion,'new');assert.equal(r.v.tocEntries.length,1370);assert.equal(r.v.adjacentChapterIndex(955,1),956);
  assert.equal(r.v.chapter,r.body);assert.equal(r.v.visiblePage,r.page);assert.equal(r.v.lastCommittedProgress,r.progress);
  assert.equal(r.v.chapterWindow.get(954),undefined,'unowned cached neighbour does not inherit fresh session variables');
  assert.equal(docs.read(sourceId,bookId,954),undefined,'process body window must independently re-admit future chapters');
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1,'cold acquisition joins the exact in-flight publication');
  assert.equal(r.v.turnNextPage().kind,'started');assert.equal(r.opened.at(-1)[0],956);
 }finally{f.runtime.close();}
});
await check('first-session navigation only evicts its own process bodies and preserves an admitted dragging page',async()=>{
 const fresh=session(allEntries,'new'),runtime={request:async()=>{},captureReadingContentValidity:()=>()=>true};
 const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',session:fresh},runtime),r=reader(gateway);
 const docs=readingSessionDocuments(runtime),other={...chapter(955),bookId:'other-book'};
 docs.configure(sourceId,other.bookId,[955],()=>true);docs.admit(other,true);
 const Gesture=productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),['preparedPageTurn']);
 const candidate=chapter(954),prepared={direction:'previous',context:{chapter:candidate},key:{chapterIndex:954,contentVersion:candidate.contentVersion},generation:7,originPageStartScalar:0,originChapterIndex:955};
 Object.assign(r.v,{activePagePointerId:3,pageTurnAdmittedPrepared:prepared,preparedPreviousPage:prepared,
  pageTurnGestureState:{phase:'dragging'},knownContentVersion:()=>candidate.contentVersion,isPreparedPageTurnFresh:()=>true});
 r.v.preparedPageTurn=Gesture.prototype.preparedPageTurn;
 assert.equal(r.v.preparedPageTurn('previous'),prepared);r.v.remoteSession=fresh;r.v.onRemoteCatalogChanged();
 assert.equal(r.v.preparedPageTurn('previous'),prepared);assert.equal(r.v.pageTurnGeneration,7);assert.equal(r.v.visiblePage,r.page);
 assert.equal(r.v.tocEntries.length,1370);assert.equal(docs.read(sourceId,other.bookId,955)?.contentVersion,other.contentVersion,'another book window is not cleared/reconfigured');
});
await check('cold near-end acquisition failures retain the visible page, singleflight and retry only after backoff',async()=>{
 const gate=deferred();let calls=0,fail=true;const realNow=Date.now;let now=1000000;Date.now=()=>now;
 const runtime={request:async()=>{},bookAcquisitions:()=>({acquireBookWithBackgroundRefresh:async()=>{calls++;if(calls===1)await gate.promise;if(fail)throw Error('unavailable');return{session:session(allEntries.slice(0,956))};}})};
 try{const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',seed},runtime),r=reader(gateway);
  r.v.prepareRemoteCatalogNearEnd();r.v.prepareRemoteCatalogNearEnd();assert.equal(calls,1);gate.resolve();await until(()=>r.v.remoteCatalogSessionPreparation===undefined);
  assert.equal(r.v.visiblePage,r.page);assert.equal(r.v.chapter,r.body);assert.equal(r.v.lastCommittedProgress,r.progress);
  r.v.prepareRemoteCatalogNearEnd();assert.equal(calls,1);now+=30001;fail=false;r.v.prepareRemoteCatalogNearEnd();await until(()=>gateway.remoteSession()!==undefined);assert.equal(calls,2);
 }finally{Date.now=realNow;}
});
await check('a cancelled old flight cannot clear a replacement flight or publish its result',async()=>{
 const f=fixture(),realNow=Date.now;let now=1000000;Date.now=()=>now;
 try{const old=await f.runtime.acquireBook(seed);f.page.remoteReadingSession=old;const jobs=[];
  f.runtime.acquireBook=(_seed,options)=>{const job=deferred();jobs.push({...job,options});return job.promise;};
  f.page.refreshRemoteCatalogNearEnd(old);assert.equal(jobs.length,1);
  f.page.navigationGeneration++;now+=30001;f.page.refreshRemoteCatalogNearEnd(old);assert.equal(jobs.length,2);
  const currentFlight=f.page.remoteCatalogRefreshInFlight.get(`${sourceId}\u0000${bookId}`);
  jobs[0].resolve(session(allEntries,'old-late'));await pause();assert.equal(f.page.remoteReadingSession,old);
  assert.equal(f.page.remoteCatalogRefreshInFlight.get(`${sourceId}\u0000${bookId}`),currentFlight);
  jobs[1].resolve(session(allEntries,'new'));await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);assert.equal(f.page.remoteReadingSession.catalogVersion,'new');
 }finally{Date.now=realNow;f.runtime.close();}
});
await check('parent and mounted gateway both reject incompatible refreshed catalog identities',async()=>{
 for(const mutate of [s=>s.sourceVersion='edited',s=>s.continuationVariables=[{name:'volume',value:'changed'}],s=>s.entries[955]={...s.entries[955],title:'other body'}]){
  const f=fixture();try{const old=await f.runtime.acquireBook(seed);f.page.remoteReadingSession=old;const next=session(allEntries.slice(),'new');mutate(next);
   f.runtime.acquireBook=async()=>next;f.page.refreshRemoteCatalogNearEnd(old);await until(()=>f.page.remoteCatalogRefreshInFlight.size===0);
   assert.equal(f.page.remoteReadingSession,old);assert.equal(f.page.remoteCatalogRefreshAt.size,0);assert.equal(f.warnings.length,1);
  }finally{f.runtime.close();}
 }
});
await check('old catalog hydration cannot shrink a just-admitted append',async()=>{
 const old=session(allEntries.slice(0,956)),runtime={request:async()=>{throw Error('unexpected');},captureReadingContentValidity:()=>()=>true};
 const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',session:old},runtime),r=reader(gateway),gate=deferred();
 gateway.loadToc=()=>gate.promise;r.v.entryCatalogPending=true;const work=r.v.hydrateEntryCatalog();
 r.v.remoteSession=session(allEntries,'new');r.v.onRemoteCatalogChanged();gate.resolve({bookId,entries:projection(old.entries)});await work;
 assert.equal(r.v.tocEntries.length,1370);assert.equal(r.v.entryCatalogPending,false);assert.equal(r.v.adjacentChapterIndex(955,1),956);
});
await check('append and full hydration preserve in-flight page measurement generation; production completion still releases its lane',async()=>{
 for(const mode of ['append','hydrate']){
 const old=session(allEntries.slice(0,956)),runtime={request:async()=>{throw Error('unexpected');}};
 const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',session:old},runtime),r=reader(gateway);
 const target=chapter(954),preparation={origin:{chapter:r.body},direction:'previous',generation:7,originChapterIndex:955,originPageStartScalar:0};
 Object.assign(r.v,{pageTurnPreparation:preparation,chapter:target,measurementCompleting:true,adjacentMeasurementContext:{chapter:target},isMeasurementCurrent:()=>true,captureMeasurementChapterContext:()=>({chapter:target}),measurementPaginationKey:()=>({}),
  finishAdjacentMeasurementContext(){this.adjacentMeasurementContext=undefined;},paginationIndex:{finishMeasurement(){}},resolvePageImagePixels(){},resumePagePreparationAfterTextureFrame(){}});
 if(mode==='append'){r.v.remoteSession=session(allEntries,'new');r.v.onRemoteCatalogChanged();}
 else{r.v.entryCatalogPending=true;gateway.loadToc=async()=>({bookId,entries:projection(allEntries)});await r.v.hydrateEntryCatalog();}
 assert.equal(r.v.pageTurnGeneration,7);assert.equal(r.v.pageTurnPreparation,preparation);assert.equal(r.v.visiblePage,r.page);assert.equal(r.v.lastCommittedProgress,r.progress);assert.deepEqual(r.v.pageTurnPreparationQueue,['next','previous']);
 r.v.completePreparedPageTurn({startScalar:0,endScalar:4,fragments:[]},2,1,1);
 assert.equal(r.v.pageTurnPreparation,undefined);assert.equal(r.v.measurementCompleting,false);assert.equal(r.v.adjacentMeasurementContext,undefined);assert.ok(r.v.preparedPreviousPage);
 }
});
await check('source/book/rule/reordered/retargeted or variable-mutated catalogs cannot reuse the mounted bodies',async()=>{
 for(const mutate of [s=>s.identity={...identity,bookId:'other'},s=>s.sourceVersion='edited',s=>s.entries=s.entries.slice(0,950),s=>s.entries[0]={...s.entries[0],index:1},s=>s.entries[955]={...s.entries[955],url:'/other'},s=>s.entries[954]={...s.entries[954],variables:[{name:'token',value:'new'}]}]){
  const old=session(allEntries.slice(0,956)),gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',session:old},{request:async()=>{}}),r=reader(gateway),next=session(allEntries.slice(),'new');mutate(next);
  r.v.remoteSession=next;r.v.onRemoteCatalogChanged();assert.equal(gateway.remoteSession(),old);assert.equal(r.v.tocEntries.length,956);assert.equal(r.v.chapter,r.body);
 }
});
await check('catalog compatibility uses effective merged variables, protects shared context/title and accepts shadowed/reordered variables',async()=>{
 const old=session(allEntries.slice(0,956));old.continuationVariables=[{name:'token',value:'a'}];
 const next=session(allEntries.slice(),'new');next.continuationVariables=[{name:'token',value:'b'}];
 assert.equal(canAppendRemoteReadingCatalog(old,next),false);
 old.entries=old.entries.map(e=>({...e,variables:[{name:'token',value:'fixed'},{name:'page',value:'1'}]}));
 next.entries=next.entries.map(e=>({...e,variables:[{name:'page',value:'1'},{name:'token',value:'fixed'}]}));next.contextVersion='rotated';
 assert.equal(canAppendRemoteReadingCatalog(old,next),true,'entry variables override shared context and ordering is immaterial');
 next.entries[955]={...next.entries[955],title:'another chapter'};assert.equal(canAppendRemoteReadingCatalog(old,next),false);
});
await check('an older concurrent acquisition cannot downgrade an adopted session',async()=>{
 const a=deferred(),b=deferred();let calls=0;
 const runtime={request:async()=>{},bookAcquisitions:()=>({acquireBookWithBackgroundRefresh:()=>++calls===1?a.promise:b.promise})};
 const gateway=new ReadingSessionFlowGateway(sourceId,bookId,{kind:'remote',seed},runtime);
 const first=gateway.ensureRemoteSession(),second=gateway.ensureRemoteSession();const newer=session(allEntries,'new');
 b.resolve({session:newer});assert.equal(await second,newer);a.resolve({session:session(allEntries.slice(0,956))});assert.equal(await first,newer);assert.equal(gateway.remoteSession(),newer);
});
await check('full catalog pagination crosses 949/950/1000 to 1370 and respects revision changes',async()=>{
 for(const count of [950,1000,1370]){const offsets=[];const runtime={supportsCoreCapability:()=>true,request:async(_m,p)=>{offsets.push(p.offset);return{data:{kind:'ready',sourceId,bookId,revision:'same',chapterCount:count,readableChapterCount:count-7,offset:p.offset,entries:projection(allEntries.slice(0,count)).slice(p.offset,p.offset+p.limit)}};}};
  const result=await readReadingCatalog(runtime,sourceId,bookId,()=>true);assert.equal(result.entries.length,count);assert.equal(offsets.length,Math.ceil(count/256));
 }
});
console.log(JSON.stringify({checks:checks.length,status:'PASS'}));
