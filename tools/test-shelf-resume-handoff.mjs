import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const base=new URL('../entry/src/main/ets/',import.meta.url), path=p=>new URL(p,base);
const evidence=await import(path('features/reading/RemoteReadingEvidence.ts'));
const {readingParagraphBoundaryMode}=await import(path('features/reading/ReadingParagraphProjection.ts'));
const {captureRemotePositionContext}=await import(path('features/reading/RemoteReadingPositionMigration.ts'));
const {ReadingSessionFlowGateway}=await import(path('features/reading/ReadingSessionFlowGateway.ts'));
const {RemoteReadingFlowGateway,RemoteChapterCacheRefreshError}=await import(path('features/reading/RemoteReadingFlowGateway.ts'));
const {ReadingOfflineGateway}=await import(path('features/reading/ReadingOfflineGateway.ts'));
const {LocalReadingFlowGateway}=await import(path('features/reading/LocalReadingFlowGateway.ts'));
const mapSource=readFileSync(path('features/reading/ReadingSurfaceLayoutMap.ts'),'utf8')
 .replace('constructor(private readonly content: string) {','constructor(content: string) { this.content = content;');
const {ReadingSurfaceLayoutMap}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const initialTocSource=readFileSync(path('features/reading/LocalReadingExperience.ets'),'utf8')
 .match(/class InitialReadingToc implements LocalReadingToc[\s\S]*?\n}/)[0];
const InitialReadingToc=new Function(`${stripTypeScriptTypes(initialTocSource)}; return InitialReadingToc;`)();
const {RemoteReadingSourceError,remoteReadingFailureKindOf,verdictForFailureKind}=await import(path('features/reading/RemoteContentAdmission.ts'));
const {errorMessageOf}=await import(path('app/ErrorMessage.ts'));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const session={identity:{sourceId:'source',bookId:'book'},sourceVersion:'v1',acquisitionMode:'online',
 catalogVersion:'catalog-1',contextVersion:'context-1',catalogAt:Date.now(),requiresContextRefresh:false,
 book:{title:'书',author:'作者'},detailUrl:'/book',tocUrl:'/toc',continuationVariables:[],hostRequirements:[],
 entries:[0,1].map(index=>({index,title:`第${index+1}章`,url:`/${index}`,variables:[]}))};
const chapter=index=>({sourceId:'source',bookId:'book',chapterIndex:index,chapterTitle:`第${index+1}章`,chapterUrl:`/${index}`,
 content:'清晨的阳光照进房间，书中的故事从这里开始。'.repeat(20),images:[],contentVersion:'host-v1',
 bodyVersion:'body-v1',processingVersion:'processing-v1',extractionVia:'cache'});
const context=offset=>({bodyVersion:'body-v1',processingVersion:'processing-v1',anchors:[{id:'restored',offset}]});

// The actual Index admission and LRE progress/context construction feed the
// actual two gateways. Only Core RPC replies and native layout are controlled.
function fixture({changedOffset=false,missingProgress=false,legacyProgress=false,holdCatalog=false,
  warmed=false,layout}={}){
 const calls=[],errors=[],readers=[],opened=[];let revision=0;
 const statusGate=deferred(),progressGate=deferred(),catalogGate=deferred();let holdProgress=changedOffset;
 const progress={sourceId:'source',bookId:'book',chapterIndex:1,chapterOffset:10,chapterProgress:0.2,updatedAt:100,
  ...(legacyProgress?{}:{bodyVersion:'body-v1',processingVersion:'processing-v1'})};
 let warmCurrent=true;
 let snapshot=warmed?{sourceId:'source',bookId:'book',gateway:{remoteSession:()=>session},
  toc:{bookId:'book',entries:session.entries.map(e=>({index:e.index,title:e.title}))},
  progress:{kind:'restored',progress:{...progress}},chapter:chapter(1),isCurrent:()=>warmCurrent}:undefined;
 const preparation={take(sourceId,bookId){assert.equal(sourceId,'source');assert.equal(bookId,'book');
  const ready=snapshot;snapshot=undefined;return ready;},setPaused(){}};
 const coordinator={readingProjectionRevision:()=>revision,currentSourceVersion:async()=> 'v1',beginAttempt:()=>1,
  reportVerdict:async()=>{},setPreparationVisible(){},acquireBookWithBackgroundRefresh:async()=>{
   if(holdCatalog)await catalogGate.promise;return {session};}};
 const owner={readingEntryPreparations:()=>preparation,bookAcquisitions:()=>coordinator,request:async(method,params,options)=>{
  calls.push({method,params});
  if(method==='reading.progress.get'){
   if(holdProgress)await progressGate.promise;
   return {data:missingProgress?{found:false,progress:null}:{found:true,progress:{...progress}}};
  }
  if(method==='chapter.content')return {data:{sourceId:'source',bookId:'book',chapterTitle:`第${params.chapterIndex+1}章`,
   via:'cache',content:chapter(params.chapterIndex).content,bodyVersion:'body-v1',processingVersion:'processing-v1'}};
  if(method==='cache.book.status'){
   await statusGate.promise;
   if(options?.shouldCancel?.())throw Error('cancelled projection');
   return {data:{sourceId:'source',bookId:'book',chapters:session.entries.map(e=>({chapterIndex:e.index,state:'completed',cachedBytes:20}))}};
  }
  if(method==='bookmark.list')return {data:{bookmarks:[]}};
  throw Error(`unexpected ${method}`);
 }};
 const Index=productionMotionMethods(path('pages/Index.ets'),['openRemoteBookDetail','probeRemoteContentVerdict',
  'installRemoteReadingSession','onRemoteSessionReady','nextNavigationGeneration','openReading','isKnownDetailChapter','presentPreparedReading','loadRemoteDirectoryProjection','mergeDirectoryBookmarks','remoteContentVerdictLabel'],{
  ...evidence,captureRemotePositionContext,ReaderRuntimeOwner:{current:()=>owner},RemoteReadingFlowGateway,RemoteChapterCacheRefreshError,
  ReadingOfflineGateway,LocalReadingFlowGateway,ReaderCoreGateway:class{},RemoteDetailAdmission:class{constructor(session){this.session=session;}},
  remoteReadingFailureKindOf,verdictForFailureKind,errorMessageOf,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){},error(){}},
 });
 const LRE=productionMotionMethods(path('features/reading/LocalReadingExperience.ets'),
  ['loadInitialReading','ensureReadingSession','restartPreparedReadingEntry','activeGateway','loadInitialChapter','tryInitialEntrySnapshot','loadInitialToc','openChapter','loadSessionChapter'],{readingParagraphBoundaryMode,ReadingSurfaceLayoutMap,InitialReadingToc,RemoteChapterCacheRefreshError,
   LOCAL_READING_SOURCE_ID:'local',RemoteReadingSourceError,remoteReadingFailureKindOf,ReadingSessionFlowGateway,ReaderRuntimeOwner:{current:()=>owner}});
 const shelf={sourceId:'source',bookId:'book',title:'书',author:'作者',currentChapterIndex:0};
 const p=Object.assign(new Index(),{route:'bookshelf',readingOriginRoute:'bookshelf',navigationGeneration:0,
  remoteSessionGeneration:0,remoteContentProbeGeneration:0,remoteReadabilityProjectionRevision:-1,detailToc:[],
  shelfBooks:[shelf],searchDetailCandidates:[],remoteCatalogRefreshAt:new Map(),offlineMutationGeneration:0,bookshelfRemovalActiveKey:'',
  directoryBookmarkMutationGeneration:0,directoryBookmarkMutationActiveKey:'',
  readingDetailForRemoteSeed:(seed,sourceName)=>({...seed,sourceName}),
  showReadingFailure:(...a)=>errors.push(a),refreshCachedSearchDetailInBackground(){},
 });
 const openReading=p.openReading.bind(p);
 p.openReading=index=>{
  opened.push(index);openReading(index);assert.equal(p.readingSessionActive,true);
  const generation=p.navigationGeneration;
  const reader=Object.assign(new LRE(),{sourceId:'source',bookId:'book',chapterSelectionToken:1,directoryEntries:p.detailToc,remoteSession:p.remoteReadingSession,
   remoteBookSeed:shelf,phase:'loading',loadAppearanceSnapshot:async()=>{await layout;},loadReaderSettingsSnapshot:async()=>{},
   onRemoteSessionReady(session){p.onRemoteSessionReady(session);reader.directoryEntries=p.detailToc;},
   onDirectoryProjectionChanged(){},resolveSourceSwitchTransactionId:async()=>undefined,
   requestedChapterIndex:index,chapterWindow:{get:()=>undefined,configure(){}},isSelectionActive:()=>p.readingSessionActive&&generation===p.navigationGeneration,
   admitTocEntries:entries=>reader.tocEntries=entries,readingTocEntries:()=>reader.tocEntries,
   normalizedRequestedChapter:()=>index,requireKnownChapter:value=>value??p.detailToc[0].index,
   ensureCurrentContentMetrics:async()=>false,fail:error=>errors.push(error),
  });
  readers.push(reader.loadInitialReading(1));
 };
 return {p,shelf,calls,errors,readers,opened,progress,statusGate,progressGate,catalogGate,
  holdProgress:()=>{holdProgress=true;},bumpRevision:()=>{revision++;},invalidateWarm:()=>{warmCurrent=false;}};
}

// Completed shelf preparation removes entry I/O, including a book never opened
// in this reader instance. The exact saved chapter/offset belongs to the snapshot.
{
 const f=fixture({warmed:true});f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);
 await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);
 assert.equal(f.calls.some(c=>c.method==='reading.progress.get'||c.method==='chapter.content'),false);
 assert.equal(f.readers.length,1);assert.equal(f.p.route,'reading');
}
// Rule/content mutations during pending native layout must reload authoritative
// progress AND body, not retain a stale prepared gateway or old offset.
{
 const layout=deferred(),f=fixture({warmed:true,layout:layout.promise});
 f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);await settle();
 assert.equal(f.calls.length,0);f.invalidateWarm();f.progress.chapterOffset=30;
 layout.resolve();await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);
 assert.equal(f.calls.filter(c=>c.method==='reading.progress.get').length,1);
 const bodies=f.calls.filter(c=>c.method==='chapter.content');assert.equal(bodies.length,1);
 assert.deepEqual(bodies[0].params.positionContext,context(30));
}

for(const options of [{},{changedOffset:true},{missingProgress:true},{legacyProgress:true}]){
 const f=fixture(options);f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);
 if(options.changedOffset){await settle();f.progress.chapterOffset=30;f.progressGate.resolve();}
 await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);assert.equal(f.readers.length,1);
 const bodies=f.calls.filter(c=>c.method==='chapter.content');
 assert.equal(bodies.length,1,'reader loads the body once after reading authoritative progress');
 assert.equal(f.calls.filter(c=>c.method==='reading.progress.get').length,1,'no outer progress read precedes the reader');
 assert.equal(bodies[0].params.chapterIndex,options.missingProgress?0:1,'stale shelf index never overrides Core current progress');
 assert.deepEqual(f.opened,[undefined]);
 if(!options.missingProgress&&!options.legacyProgress)assert.deepEqual(bodies[0].params.positionContext,context(options.changedOffset?30:10));
 assert.equal(f.calls.some(c=>c.method==='cache.book.status'||c.method==='bookmark.list'),false,
  'optional download/bookmark reads must not queue before committed first page');
 f.p.presentPreparedReading(options.missingProgress?0:1);await settle();
 assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
 f.statusGate.resolve();await settle();assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);
 assert.equal(f.p.detailToc[1].downloadState,'cached');
 f.p.presentPreparedReading(1);await settle();assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
}

// Late optional projection cannot remove a bookmark added after first paint.
{
 const f=fixture();f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);await settle();await Promise.all(f.readers);
 f.p.presentPreparedReading(1);await settle();f.p.directoryBookmarkMutationGeneration++;
 f.p.detailToc=f.p.detailToc.map(e=>({...e,bookmarks:[{time:42,bookText:'刚添加的书签'}]}));
 f.statusGate.resolve();await settle();assert.equal(f.p.detailToc[1].downloadState,'cached');
 assert.equal(f.p.detailToc[1].bookmarks[0].time,42);
}
{
 const f=fixture({holdCatalog:true});f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);await settle();
 f.p.navigationGeneration++;f.catalogGate.resolve();await settle();
 assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
 assert.equal(f.readers.length,1,'the normal reader mounts before acquisition; late results remain cancelled');
}
{
 const f=fixture();f.holdProgress();f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);await settle();
 assert.equal(f.readers.length,1,'mount and font/window work can start before progress returns');
 f.p.readingSessionActive=false;f.progressGate.resolve();await settle();await Promise.all(f.readers);
 assert.equal(f.calls.some(c=>c.method==='chapter.content'),false,'an exited reader does not open a late restored chapter');
 assert.deepEqual(f.errors,[]);
}

// Context is a value snapshot, and only evidence previously sent to Core can
// permit a resume handoff. Matching versions without verified anchors is not enough.
{
 const original=context(10);const prepared=evidence.withPreparedRemoteChapter(session,chapter(1),0,original);
 original.anchors[0].offset=999;
 assert.equal(evidence.preparedRemoteChapterPositionMatches(prepared.preparedChapter,context(10)),true);
 for(const other of [undefined,context(11),{...context(10),bodyVersion:'changed'},
  {...context(10),processingVersion:'changed'},{...context(10),anchors:[{id:'bookmark',offset:10}]},
  {...context(10),anchors:[]}])assert.equal(evidence.preparedRemoteChapterPositionMatches(prepared.preparedChapter,other),false);
 const unverified=evidence.withPreparedRemoteChapter(session,chapter(1),0);
 assert.equal(evidence.preparedRemoteChapterPositionMatches(unverified.preparedChapter,context(10)),false);
 assert.throws(()=>evidence.preparedRemoteChapterPositionMatches(prepared.preparedChapter,{...context(10),anchors:[{id:'restored',offset:-1}]}));
}
// A refresh deliberately advances the projection revision; only navigation or
// session/probe ownership may cancel its user-approved recovery continuation.
{
 const f=fixture();f.p.installRemoteReadingSession(session);
 f.p.refreshCachedChapterFromPrompt=async(_error,current)=>{f.bumpRevision();assert.equal(current(),true);return 1;};
 const result=await f.p.probeRemoteContentVerdict({loadChapter:async()=>{throw new RemoteChapterCacheRefreshError(session,1,context(10),false);}},
  session,()=>true,1,context(10));
 assert.equal(result,1);
}
console.log('PASS actual Index→LRE→Core progress/body: one authoritative progress read and body request, current offset wins over stale shelf projection');
console.log('PASS committed-first-page optional projection, late bookmark preservation, cancellation and refresh revision ownership; no native timing claims');
