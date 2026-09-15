import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const base=new URL('../entry/src/main/ets/',import.meta.url), path=p=>new URL(p,base);
const evidence=await import(path('features/reading/RemoteReadingEvidence.ts'));
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
const {remoteReadingFailureKindOf,verdictForFailureKind}=await import(path('features/reading/RemoteContentAdmission.ts'));
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
function fixture({changedOffset=false,missingProgress=false,legacyProgress=false}={}){
 const calls=[],errors=[],readers=[],opened=[];let revision=0,progressReads=0;
 const statusGate=deferred(),progressGate=deferred();let holdProgress=false;
 const progress={sourceId:'source',bookId:'book',chapterIndex:1,chapterOffset:10,chapterProgress:0.2,updatedAt:100,
  ...(legacyProgress?{}:{bodyVersion:'body-v1',processingVersion:'processing-v1'})};
 const coordinator={readingProjectionRevision:()=>revision,currentSourceVersion:async()=> 'v1',beginAttempt:()=>1,
  reportVerdict:async()=>{},setPreparationVisible(){},acquireBookWithBackgroundRefresh:async()=>({session})};
 const owner={bookAcquisitions:()=>coordinator,request:async(method,params,options)=>{
  calls.push({method,params});
  if(method==='reading.progress.get'){
   if(holdProgress)await progressGate.promise;
   progressReads++;if(changedOffset&&progressReads===2)progress.chapterOffset=30;
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
  'installRemoteReadingSession','nextNavigationGeneration','openReading','isKnownDetailChapter','presentPreparedReading','loadRemoteDirectoryProjection','mergeDirectoryBookmarks','remoteContentVerdictLabel'],{
  ...evidence,captureRemotePositionContext,ReaderRuntimeOwner:{current:()=>owner},RemoteReadingFlowGateway,RemoteChapterCacheRefreshError,
  ReadingOfflineGateway,LocalReadingFlowGateway,ReaderCoreGateway:class{},RemoteDetailAdmission:class{constructor(session){this.session=session;}},
  remoteReadingFailureKindOf,verdictForFailureKind,errorMessageOf,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){},error(){}},
 });
 const LRE=productionMotionMethods(path('features/reading/LocalReadingExperience.ets'),
  ['loadInitialChapter','loadInitialToc','openChapter','loadSessionChapter'],{ReadingSurfaceLayoutMap,InitialReadingToc,RemoteChapterCacheRefreshError});
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
  const gateway=new ReadingSessionFlowGateway('source','book',{kind:'remote',session:p.remoteReadingSession},owner);
  const reader=Object.assign(new LRE(),{sourceId:'source',bookId:'book',chapterSelectionToken:1,directoryEntries:p.detailToc,
   requestedChapterIndex:index,chapterWindow:{get:()=>undefined,configure(){}},isSelectionActive:()=>p.readingSessionActive,
   activeGateway:()=>gateway,admitTocEntries:entries=>reader.tocEntries=entries,readingTocEntries:()=>reader.tocEntries,
   normalizedRequestedChapter:()=>index,requireKnownChapter:value=>value??p.detailToc[0].index,
   ensureCurrentContentMetrics:async()=>false,fail:error=>errors.push(error),
  });
  readers.push(reader.loadInitialChapter(1,Promise.resolve([])));
 };
 return {p,shelf,calls,errors,readers,opened,progress,statusGate,progressGate,
  holdProgress:()=>{holdProgress=true;},bumpRevision:()=>{revision++;}};
}

for(const options of [{},{changedOffset:true},{missingProgress:true},{legacyProgress:true}]){
 const f=fixture(options);f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);
 await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);assert.equal(f.readers.length,1);
 const bodies=f.calls.filter(c=>c.method==='chapter.content');
 assert.equal(bodies.length,options.changedOffset?2:1,'only changed authority requires another body validation');
 assert.equal(f.calls.filter(c=>c.method==='reading.progress.get').length,2,'reader still reloads authoritative progress');
 assert.equal(bodies[0].params.chapterIndex,options.missingProgress?0:1,'stale shelf index never overrides Core current progress');
 assert.deepEqual(f.opened,[options.missingProgress?0:undefined]);
 if(!options.missingProgress&&!options.legacyProgress)assert.deepEqual(bodies[0].params.positionContext,context(10));
 if(options.changedOffset)assert.deepEqual(bodies[1].params.positionContext,context(30));
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
for(const invalidate of [f=>f.p.navigationGeneration++,f=>f.p.remoteSessionGeneration++]){
 const f=fixture();f.holdProgress();f.p.openRemoteBookDetail(f.shelf,'书源',f.shelf,true);await settle();
 invalidate(f);if(f.p.remoteSessionGeneration>0)f.p.remoteReadingSession=undefined;
 f.progressGate.resolve();await settle();assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
 assert.equal(f.readers.length,0);
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
console.log('PASS actual Index→Core progress→body probe→LRE authoritative progress→prepared chapter: one body when exact, reread changed anchor');
console.log('PASS committed-first-page optional projection, late bookmark preservation, cancellation and refresh revision ownership; no native timing claims');
