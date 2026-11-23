import { ProductionHost, compileHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readingEntryActionFixture } from './lib/reading-entry-action-fixture.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const base=new URL('../entry/src/main/ets/',import.meta.url), path=p=>new URL(p,base);
const evidence=await import(path('features/reading/application/RemoteReadingEvidence.ts'));
const {readingParagraphBoundaryMode}=await import(path('features/reading/application/ReadingParagraphProjection.ts'));
const {ReadingSessionFlowGateway}=await import(path('features/reading/application/ReadingSessionFlowGateway.ts'));
const {RemoteReadingFlowGateway,RemoteChapterCacheRefreshError}=await import(path('features/reading/application/RemoteReadingFlowGateway.ts'));
const mapSource=readFileSync(path('features/reading/application/ReadingSurfaceLayoutMap.ts'),'utf8')
 .replace('constructor(private readonly content: string) {','constructor(content: string) { this.content = content;');
const {ReadingSurfaceLayoutMap}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const initialTocSource=readFileSync(path('features/reading/ui/LocalReadingExperience.ets'),'utf8')
 .match(/class InitialReadingToc implements LocalReadingToc[\s\S]*?\n}/)[0];
const InitialReadingToc=new Function(`${stripTypeScriptTypes(initialTocSource)}; return InitialReadingToc;`)();
const {RemoteReadingSourceError,remoteReadingFailureKindOf}=await import(path('features/reading/application/RemoteContentAdmission.ts'));
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

// The actual entry owners and LRE progress/context construction feed the
// actual two gateways. Only Core RPC replies and native layout are controlled.
function fixture({changedOffset=false,missingProgress=false,legacyProgress=false,holdCatalog=false,
  warmed=false,layout,Host=ProductionHost,cacheDecision}={}){
 const calls=[],errors=[],readers=[],opened=[];let revision=0;let bookmarks=[];
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
 const owner={noteReadingPreparationIntent(){},readingEntryPreparations:()=>preparation,bookAcquisitions:()=>coordinator,
  captureReadingContentValidity:()=>()=>true,waitForReadingContentIdle:async()=>{},
  request:async(method,params,options)=>{
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
  if(method==='bookmark.list')return {data:{bookmarks}};
  throw Error(`unexpected ${method}`);
 }};
 setRuntime(owner);
 const LRE=productionMotionMethods(path('features/reading/ui/LocalReadingExperience.ets'),
  ['loadInitialReading','ensureReadingSession','restartPreparedReadingEntry','activeGateway','loadInitialChapter','tryInitialEntrySnapshot','loadInitialToc','openChapter','loadSessionChapter'],{readingParagraphBoundaryMode,ReadingSurfaceLayoutMap,InitialReadingToc,RemoteChapterCacheRefreshError,
   LOCAL_READING_SOURCE_ID:'local',RemoteReadingSourceError,remoteReadingFailureKindOf,ReadingSessionFlowGateway,ReaderRuntimeOwner:{current:()=>owner}});
 const shelf={sourceId:'source',bookId:'book',title:'书',author:'作者',currentChapterIndex:0};
 let readerMounted = false;
 const x=readingEntryActionFixture({runtime:owner,Host,route:'bookshelf',shelfBooks:[shelf],
  failure:(...args)=>errors.push(args),cacheDecision,
  onReaderMount:({entry,navigation,actions})=>{
   // A controlled native mounting port: same retained reader is not recreated
   // when its real session-ready callback rebinds the current Host lease.
   if(!entry.sessionActive||readerMounted)return;
   readerMounted=true;
   const index=entry.requestedChapterIndex;
   opened.push(index);assert.equal(entry.sessionActive,true);
   const generation=navigation.snapshot().generation;
   const reader=Object.assign(new LRE(),{sourceId:'source',bookId:'book',chapterSelectionToken:1,directoryEntries:entry.toc,remoteSession:entry.session,
    remoteBookSeed:shelf,phase:'loading',loadAppearanceSnapshot:async()=>{await layout;},loadReaderSettingsSnapshot:async()=>{},
    onRemoteSessionReady(session){actions.acceptReaderSession(session);reader.directoryEntries=entry.toc;},
    onDirectoryProjectionChanged:entries=>entry.applyDirectoryProjection(entries,owner),resolveSourceSwitchTransactionId:async()=>undefined,
    requestedChapterIndex:index,chapterWindow:{get:()=>undefined,configure(){}},isSelectionActive:()=>entry.sessionActive&&generation===navigation.snapshot().generation,
    admitTocEntries:entries=>reader.tocEntries=entries,readingTocEntries:()=>reader.tocEntries,
    normalizedRequestedChapter:()=>index,requireKnownChapter:value=>value??entry.toc[0].index,
    ensureCurrentContentMetrics:async()=>false,fail:error=>errors.push(error),
   });
   readers.push(reader.loadInitialReading(1));
  }});

 return {...x,shelf,calls,errors,readers,opened,progress,statusGate,progressGate,catalogGate,
  setBookmarks:rows=>{bookmarks=rows;},holdProgress:()=>{holdProgress=true;},bumpRevision:()=>{revision++;},invalidateWarm:()=>{warmCurrent=false;}};
}

// Completed shelf preparation removes entry I/O, including a book never opened
// in this reader instance. The exact saved chapter/offset belongs to the snapshot.
{
 const f=fixture({warmed:true});f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});
 await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);
 assert.equal(f.calls.some(c=>c.method==='reading.progress.get'||c.method==='chapter.content'),false);
 assert.equal(f.readers.length,1);assert.equal(f.navigation.snapshot().route,'reading');
}
// Rule/content mutations during pending native layout must reload authoritative
// progress AND body, not retain a stale prepared gateway or old offset.
{
 const layout=deferred(),f=fixture({warmed:true,layout:layout.promise});
 f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});await settle();
 assert.equal(f.calls.length,0);f.invalidateWarm();f.progress.chapterOffset=30;
 layout.resolve();await settle();await Promise.all(f.readers);
 assert.deepEqual(f.errors,[]);
 assert.equal(f.calls.filter(c=>c.method==='reading.progress.get').length,1);
 const bodies=f.calls.filter(c=>c.method==='chapter.content');assert.equal(bodies.length,1);
 assert.deepEqual(bodies[0].params.positionContext,context(30));
}

for(const options of [{},{changedOffset:true},{missingProgress:true},{legacyProgress:true}]){
 const f=fixture(options);f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});
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
 f.actions.presentPreparedReading(options.missingProgress?0:1);await settle();
 assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
 f.statusGate.resolve();await settle();assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);
 assert.equal(f.entry.toc[1].downloadState,'cached');
 f.actions.presentPreparedReading(1);await settle();assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
}

// Late optional projection cannot remove a bookmark added after first paint.
{
 const f=fixture();f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});await settle();await Promise.all(f.readers);
 f.actions.presentPreparedReading(1);await settle();
 f.setBookmarks([{time:42,bookName:'书',bookAuthor:'作者',chapterIndex:1,chapterPos:0,chapterName:'第2章',bookText:'刚添加的书签',content:''}]);
 f.entry.toc=f.entry.toc.map(e=>({...e,bookmarks:[{time:42,bookText:'刚添加的书签'}]}));
 f.statusGate.resolve();await settle();assert.equal(f.entry.toc[1].downloadState,'cached');
 assert.equal(f.entry.toc[1].bookmarks[0].time,42);
}
{
 const f=fixture({holdCatalog:true});f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});await settle();
 f.advance();f.catalogGate.resolve();await settle();
 assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
 assert.equal(f.readers.length,1,'the normal reader mounts before acquisition; late results remain cancelled');
}
{
 const f=fixture();f.holdProgress();f.actions.openRemoteDetail({seed:f.shelf,sourceName:'书源',shelfSnapshot:f.shelf,resumeImmediately:true});await settle();
 assert.equal(f.readers.length,1,'mount and font/window work can start before progress returns');
 f.entry.endReading(f.runtime);f.progressGate.resolve();await settle();await Promise.all(f.readers);
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
 let f;
 class RefreshTransport extends RemoteReadingFlowGateway {
   async loadChapter(_session,index,current,force){
     if(!force)throw new RemoteChapterCacheRefreshError(session,index,context(10),false);
     f.bumpRevision();f.bumpRevision();assert.equal(current(),true);return chapter(index);
   }
 }
 f=fixture({Host:compileHost(undefined,{RemoteReadingFlowGateway:RefreshTransport}),
  cacheDecision:async(_error,current)=>{assert.equal(current(),true);return true;}});
 f.navigation.show('detail');
 Object.assign(f.entry,{book:{...f.shelf,sourceName:'书源'},toc:session.entries,session});
 f.bindReader();
 const result=await f.host().probe(f.host().snapshot().scopeId,1,context(10));
 assert.equal(result,1);
}
console.log('PASS actual EntryActions/Presentation→LRE→Core progress/body: one authoritative progress read and body request, current offset wins over stale shelf projection');
console.log('PASS committed-first-page optional projection, late bookmark preservation, cancellation and refresh revision ownership; no native timing claims');
