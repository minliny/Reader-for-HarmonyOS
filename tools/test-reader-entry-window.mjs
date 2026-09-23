import assert from 'node:assert/strict';
import { readingParagraphBoundaryMode, prepareReadingParagraphUtf16Ranges } from '../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const Entry = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['tryInitialEntrySnapshot', 'selectChapterAnchor'], { readingParagraphBoundaryMode, LOCAL_READING_SOURCE_ID:'local', hilog:{warn(){}}, errorMessageOf:e=>e.message });
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function fixture(){
 const opened=[], requests=[];
 const navigation={revision:'r',chapterCount:100,readableChapterCount:100,current:{index:40,position:40,readablePosition:40,title:'正文'},before:[],after:[]};
 const snapshot={navigation,chapter:{chapterIndex:40,images:[]},progress:{kind:'missing'},isCurrent:()=>true};
 const owner=Object.assign(new Entry(),{mounted:true,sourceId:'s',bookId:'b',lifecycleToken:1,chapterSelectionToken:1,entryCatalogSeekRevision:0,
  activeGateway:()=>({hasPendingSourceSwitch:()=>false,loadEntrySnapshot:async(...args)=>{requests.push(args);return snapshot;}}),
  isSelectionActive(l,s){return this.mounted&&l===this.lifecycleToken&&s===this.chapterSelectionToken;},normalizedRequestedChapter:()=>undefined,
  admitTocEntries(entries){this.tocEntries=entries;},readingTocEntries(){return this.tocEntries;},chapterWindow:{configure(){},get(){}},
  openChapter:async(...args)=>opened.push(args),isKnownControlChapter:()=>false, controlVisible:()=>false,
 });return{owner,snapshot,requests,opened};
}
{
 const f=fixture();assert.equal(await f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([])),true);
 assert.equal(f.requests.length,1);assert.equal(f.opened[0][0],40);assert.equal(f.owner.tocEntries.length,1);
 assert.equal(f.owner.entryCatalogNavigation.chapterCount,100,'partial window retains global chapter count');
}
{
 const f=fixture(), pending=deferred();f.owner.activeGateway=()=>({hasPendingSourceSwitch:()=>false,loadEntrySnapshot:()=>pending.promise});
 const result=f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([]));f.owner.chapterSelectionToken++;pending.resolve(f.snapshot);
 assert.equal(await result,true);assert.equal(f.opened.length,0);assert.equal(f.owner.tocEntries,undefined);
}
for(const cancel of [false,true]){
 const f=fixture(), pending=deferred(), selected=[];f.owner.entryCatalogNavigation=f.snapshot.navigation;f.owner.entryCatalogPending=true;
 f.owner.hydrateEntryCatalog=()=>pending.promise;
 f.owner.selectChapterAnchor(88,123,false);
 assert.equal(f.opened.length,0);f.owner.selectChapterAnchor=(...args)=>selected.push(args);
 f.owner.entryCatalogNavigation=undefined;f.owner.entryCatalogPending=false;if(cancel)f.owner.chapterSelectionToken++;
 pending.resolve();await new Promise(r=>setImmediate(r));
 assert.equal(selected.length,cancel?0:1);if(!cancel)assert.deepEqual(selected[0].slice(0,3),[88,123,false]);
}
{
 const f=fixture(),pending=deferred(),selected=[];f.owner.entryCatalogNavigation=f.snapshot.navigation;f.owner.entryCatalogPending=true;f.owner.hydrateEntryCatalog=()=>pending.promise;
 f.owner.selectChapterAnchor(88,1,false);f.owner.selectChapterAnchor(99,2,false);
 f.owner.selectChapterAnchor=(...args)=>selected.push(args);f.owner.entryCatalogNavigation=undefined;f.owner.entryCatalogPending=false;pending.resolve();await new Promise(r=>setImmediate(r));
 assert.equal(selected.length,1);assert.equal(selected[0][0],99,'newest explicit selection owns hydration completion');
}
{
 const f=fixture();delete f.snapshot.navigation;f.snapshot.chapter.chapterTitle='可独立读取的正文';
 assert.equal(await f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([])),true);
 assert.equal(f.opened[0][0],40);assert.equal(f.owner.entryCatalogPending,true);
 assert.equal(f.owner.entryCatalogNavigation,undefined);
 assert.deepEqual(f.owner.tocEntries,[{index:40,title:'可独立读取的正文',downloadState:'unknown',navigable:true}]);
}
console.log('entry window: narrow first chapter, global count, stale entry and deferred last-intent selection PASS');

const Edges = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
 ['isUnknownCatalogEdge','knownPageTurnBoundary','turnNextPage','performContinuousPageTurn','hydrateEntryCatalog'],
 {hilog:{warn(){}},errorMessageOf:e=>e.message});
function edgeFixture(){
 let requests=0;
 const chapter={chapterIndex:40,content:'body',images:[]}, page={startScalar:0,endScalar:4,fragments:[]};
 const owner=Object.assign(new Edges(),{mounted:true,phase:'ready',chapter,visiblePage:page,entryCatalogPending:true,
  sourceId:'s',bookId:'b',lifecycleToken:1,entryCatalogNavigation:{readableChapterCount:100,current:{index:40,readablePosition:40},before:[],after:[]},
  adjacentChapterIndex:()=>undefined,canTurnPage:()=>true,requireChapterLayoutMap:()=>({}),lastVisibleScalar:()=>3,
  currentPaginationKey:()=>({}),paginationIndex:{findContainingPage:()=>({pageIndex:0})},paragraphRanges:[{startScalar:0}],
  requestCatalogForTurn(){requests++;},controlVisible:()=>false,continuousScroller:{},continuousFragments:[{}],
  isContinuousScrollerAtStart:()=>true,isContinuousScrollerAtEnd:()=>true});
 return{owner,requests:()=>requests};
}
for(const direction of ['next','previous']){
 const f=edgeFixture();assert.equal(f.owner.knownPageTurnBoundary(direction),undefined,'partial catalog edge is not a book boundary');
 assert.equal(f.owner.performContinuousPageTurn(direction).kind,'preparing');assert.equal(f.requests(),1);
 f.owner.entryCatalogPending=false;
 assert.equal(f.owner.knownPageTurnBoundary(direction).kind,'boundary');
}
{
 const f=edgeFixture();assert.equal(f.owner.turnNextPage().kind,'preparing');assert.equal(f.requests(),1);
 f.owner.entryCatalogNavigation.current.readablePosition=99;
 assert.equal(f.owner.turnNextPage().kind,'boundary','last global chapter is a proven edge even before full catalog');
 f.owner.entryCatalogNavigation=undefined;assert.equal(f.owner.turnNextPage().kind,'preparing','body-only entry has unknown book extent');
}
for(const stale of [false,true]){
 const f=edgeFixture(),pending=deferred(),events=[];
 Object.assign(f.owner,{isSessionActive:()=>!stale,activeGateway:()=>({loadToc:()=>pending.promise}),
  chapterWindow:{retainedChapterIndexes:()=>[],configure(){events.push('configure');},setCurrent(){}},
  admitTocEntries(entries){this.tocEntries=entries;},readingTocEntries(){return this.tocEntries;},
  releaseUnretainedReadingImages(){},onDirectoryProjectionChanged(){events.push('directory');},
  schedulePageTurnPreparation(){events.push('prepare');},drainRapidPageTurn(){events.push('rapid');},resumePendingAutoPageTurn(){events.push('auto');}});
 const work=f.owner.hydrateEntryCatalog();pending.resolve({entries:[{index:40},{index:50}]});await work;
 assert.equal(f.owner.entryCatalogPending,stale);assert.equal(f.owner.entryCatalogHydration,undefined);
 assert.deepEqual(events,stale?[]:['configure','directory','prepare','rapid','auto']);
}
console.log('partial catalog: body-only entry, true/unknown edges and deferred manual/auto resume with stale owner rejection PASS');

const Steps = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
 ['stepControlChapter'], {hilog:{warn(){}},errorMessageOf:e=>e.message});
for (const change of ['none','selection','lifecycle','control','chapter','newest','failure','boundary']) {
 const pending=deferred(), selected=[];
 const owner=Object.assign(new Steps(),{mounted:true,entryCatalogPending:true,entryCatalogSeekRevision:0,
  lifecycleToken:1,chapterSelectionToken:1,controlOpenRevision:1,index:40,
  currentChapterIndex(){return this.index;},
  adjacentChapterIndex(index,delta){return this.entryCatalogPending||change==='boundary'?undefined:index+delta;},
  isSelectionActive(l,s){return this.mounted&&l===this.lifecycleToken&&s===this.chapterSelectionToken;},
  hydrateEntryCatalog:()=>change==='failure'?Promise.reject(new Error('offline')):pending.promise,
  clearTtsChapterEndTimer(){},selectChapterAnchor:(...args)=>selected.push(args)});
 owner.stepControlChapter(1);
 if(change==='selection')owner.chapterSelectionToken++;
 if(change==='lifecycle')owner.mounted=false;
 if(change==='control')owner.controlOpenRevision++;
 if(change==='chapter')owner.index=50;
 if(change==='newest')owner.stepControlChapter(-1);
 owner.entryCatalogPending=false;pending.resolve();await new Promise(r=>setImmediate(r));
 assert.deepEqual(selected,change==='none'?[[41,0,true]]:change==='newest'?[[39,0,true]]:[],change);
}
console.log('chapter controls: pending catalog resumes newest step only; stale ownership, errors and real boundaries do not select PASS');

for (const hasNewIntent of [false,true]) {
 const f=fixture();f.owner.preparedReadingEntry={...f.snapshot,catalogPending:true};
 const gateway=f.owner.activeGateway();
 if(hasNewIntent)gateway.pendingPresentedProgress=()=>({kind:'restored',progress:{chapterIndex:40,chapterOffset:12}});
 f.owner.activeGateway=()=>gateway;
 assert.equal(await f.owner.tryInitialEntrySnapshot(1,1,Promise.resolve([])),true);
 assert.equal(f.requests.length,hasNewIntent?1:0,'hot narrow entry avoids duplicate Core read; newer intent still wins');
 assert.equal(f.owner.preparedReadingEntry!==undefined,!hasNewIntent);
 assert.equal(f.owner.entryCatalogPending,true);
}
console.log('PASS narrow prepared entry handoff and latest in-memory progress precedence');

const Presentation=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['notifyReadingPresentationReady'],{hilog:{error(){}}});
{
 const chapter={chapterIndex:4,images:[],documentRange:{startScalar:40,endScalar:60,totalScalars:100}},page={startScalar:40,endScalar:50,fragments:[]};
 const events=[];
 const owner=Object.assign(new Presentation(),{phase:'ready',isStableVisiblePageOwner:()=>true,
  scheduleEntryWindowHydration(){throw Error('presenting a paged window must not initiate full chapter hydration');},
  scheduleEntryCatalogHydration(){events.push('catalog');},onReadingReady(index){events.push(index);},
  scheduleTtsPresentationWarmup(){events.push('tts-warmup');}});
 assert.equal(owner.notifyReadingPresentationReady(chapter,page,1,1),true);
 assert.equal(owner.notifyReadingPresentationReady(chapter,page,1,1),true);
 assert.deepEqual(events,['catalog',4,'tts-warmup'],'one ready notification does not duplicate optional work');
}
console.log('PASS presented paged entry schedules no automatic full chapter read');

const {readingChapterLayoutMap}=await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const {retainReadingEntryImageHandles}=await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const WindowOwner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['hydrateEntryWindow','hasPartialEntryWindow','scheduleEntryWindowHydration','lastVisibleScalar','isChapterFirstPageStart'],
 {readingChapterLayoutMap,retainReadingEntryImageHandles,readingParagraphBoundaryMode,prepareReadingParagraphUtf16Ranges,ParagraphRange:class{constructor(id,startUtf16,endUtf16,startScalar,endScalar){Object.assign(this,{id,startUtf16,endUtf16,startScalar,endScalar});}},ReaderUIFrameCallback:class{constructor(callback){this.callback=callback;}},hilog:{warn(){}},errorMessageOf:e=>e.message});
function rangeOwner(){
 const chapter={sourceId:'s',bookId:'b',chapterIndex:4,content:'目标\n',images:[],contentVersion:'v',documentRange:{startScalar:40,endScalar:43,totalScalars:100}};
 const full={...chapter,content:'前'.repeat(40)+'目标\n'+'后'.repeat(57),documentRange:undefined};
 const response=deferred(),save=deferred(),events=[],frames=[];let requests=0;
 const owner=Object.assign(new WindowOwner(),{chapter,lifecycleToken:1,chapterSelectionToken:1,measurementEpoch:2,mounted:true,
   contentCurrent:true,phase:'ready',readerSettingsSnapshot:{navigationMode:'paged'},paragraphRanges:[],visiblePage:{id:'original',fragments:[]},visibleFragments:[{id:'native'}],
   ordinaryFirstPagePersistence:save.promise,isSelectionActive(l,s){return this.mounted&&this.lifecycleToken===l&&this.chapterSelectionToken===s;},
   activeGateway:()=>({captureEntryContentValidity:()=>()=>owner.contentCurrent,completeEntryChapter:async()=>{requests++;return response.promise;}}),
   chapterWindow:{setCurrent(c){events.push(['current',c]);}},rebuildChapterImageIndexes(){},collectParagraphRanges(){events.push('ranges');},
   retainCurrentChapterWindow(){},schedulePageTurnPreparation(){events.push('prepare');},prefetchNextChapter(){events.push('neighbors');},
   drainRapidPageTurn(){events.push('manual');},resumePendingAutoPageTurn(){events.push('auto');},getUIContext:()=>({postFrameCallback:f=>frames.push(f.callback)})});
 return{owner,chapter,full,response,save,events,frames,requests:()=>requests};
}
{
 const f=rangeOwner(),page=f.owner.visiblePage,fragments=f.owner.visibleFragments;
 f.owner.scheduleEntryWindowHydration();f.owner.scheduleEntryWindowHydration();
 assert.equal(f.requests(),0,'explicit complete-text consumer waits until a presented-frame callback');assert.equal(f.frames.length,1);
 f.frames[0]();f.response.resolve(f.full);await new Promise(r=>setImmediate(r));
 assert.equal(f.owner.chapter,f.chapter,'in-flight first-page save retains immutable owner');
 f.save.resolve();await f.owner.entryWindowHydration;
 assert.equal(f.owner.chapter.content,f.full.content);assert.equal(f.owner.chapter.documentRange,undefined);
 assert.equal(f.owner.visiblePage,page);assert.equal(f.owner.visibleFragments,fragments,'expansion must not clear or recreate visible native fragments');
 assert.ok(f.events.includes('manual'));assert.ok(f.events.includes('auto'));assert.ok(f.events.includes('neighbors'));
}
for(const stale of ['selection','measurement','content','unmount']){
 const f=rangeOwner();const task=f.owner.hydrateEntryWindow();
 if(stale==='selection')f.owner.chapterSelectionToken++;else if(stale==='measurement')f.owner.measurementEpoch++;else if(stale==='content')f.owner.contentCurrent=false;else f.owner.mounted=false;
 f.response.resolve(f.full);f.save.resolve();await task;
 assert.equal(f.owner.chapter,f.chapter,`${stale} fences late expansion`);assert.equal(f.events.length,0);
}
{
 const f=rangeOwner(),map=readingChapterLayoutMap(f.chapter);
 assert.equal(f.owner.lastVisibleScalar(f.chapter.content,map),99,'resident end is never global chapter end');
 f.owner.paragraphRanges=[{startScalar:40}];assert.equal(f.owner.isChapterFirstPageStart(40),false,'range start is not chapter-title location');
}
console.log('explicit complete-text consumer: post-frame expansion, in-flight save ownership, native page retention, queued turn resume, stale lifecycle/layout rejection and no false EOF/title PASS');

const TurnWindow=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['performPageTurn','knownPageTurnBoundary','toggleTts'],{readerPageTransitionUsesPreparedPages:()=>true});
for (const prepared of [undefined, { id:'measured-adjacent-page' }]) {
 let wholeReads=0,textureRequests=0,settlements=0;const queued=[];
 const chapter={chapterIndex:4,content:'文'.repeat(20),images:[],documentRange:{startScalar:40,endScalar:60,totalScalars:100}};
 const map=readingChapterLayoutMap(chapter);
 const owner=Object.assign(new TurnWindow(),{mounted:true,activePagePointerId:-1,readerSettingsSnapshot:{navigationMode:'paged'},
  canTurnPage:()=>true,usesBookTurnSimulation:()=>true,preparedPageTurn:()=>prepared,canStartReaderPageTurn:()=>true,
  queuePageTurnPreparation:direction=>queued.push(direction),scheduleBookTurnTextureRefresh(){textureRequests++;},
  startPreparedPageTurnSettlement(){settlements++;return true;},
  scheduleEntryWindowHydration(){wholeReads++;},visiblePage:{startScalar:40,endScalar:50,fragments:[]},chapter,chapterLayoutMap:map,
  requireChapterLayoutMap:()=>map});
 assert.deepEqual(owner.performPageTurn('next'),{kind:prepared===undefined?'preparing':'started'});
 assert.equal(wholeReads,0,'partial resident is not a whole-chapter hydration gate');
 assert.deepEqual(queued,prepared===undefined?['next']:[]);
 assert.equal(textureRequests,prepared===undefined?1:0);
 assert.equal(settlements,prepared===undefined?0:1,'measured adjacent page starts without acquiring the remainder of the chapter');
 assert.equal(owner.knownPageTurnBoundary('previous'),undefined);
 assert.equal(owner.knownPageTurnBoundary('next'),undefined);
}
for(const cancelled of [false,true]){
 const hydration=deferred(),starts=[];let live=true;
 const owner=Object.assign(new TurnWindow(),{mounted:true,phase:'ready',ttsAvailabilityResolved:true,ttsState:{status:'idle',rate:1},
  chapter:{content:'partial',images:[],documentRange:{startScalar:40,endScalar:60,totalScalars:100}},visiblePage:{startScalar:46,fragments:[]},materializedContentVersion:'v',
  isTtsPlayIntentCurrent:()=>live,cancelPendingAutoPageStart(){},hydrateEntryWindow:()=>hydration.promise,stopAutoPage(){},
  ttsCoordinator:{setDesiredPlaying(){},start(input){starts.push(input);return Promise.resolve();}},
  ttsChapterRef:()=>({chapterIndex:4}),ttsTimerDurationMs:()=>0,onSessionLaunchTtsState(){},logTtsFailure(){},cancelSessionLaunch(){}});
 owner.toggleTts({generation:1});assert.equal(starts.length,0,'TTS never receives partial chapter text with absolute offsets');
 owner.chapter={content:'complete chapter',images:[]};if(cancelled)live=false;hydration.resolve();await new Promise(r=>setImmediate(r));
 assert.equal(starts.length,cancelled?0:1);
 if(!cancelled){assert.equal(starts[0].content,'complete chapter');assert.equal(starts[0].scalarPosition,46);}
}
console.log('entry range interaction: paged turns prepare/use adjacent facts without full hydration; TTS explicitly awaits complete text and respects cancelled play intent PASS');

{
 const f=rangeOwner(); f.full.content=('甲😀\n乙\n').repeat(20000);
 f.full.textLayoutIdentity=undefined;
 const originalRanges=f.owner.paragraphRanges;
 const operation=f.owner.hydrateEntryWindow();
 f.response.resolve(f.full); f.save.resolve();
 setTimeout(()=>{f.owner.chapterSelectionToken++;},0);
 await operation;
 assert.equal(f.owner.chapter,f.chapter,'cancel during index preparation leaves the visible chapter untouched');
 assert.equal(f.owner.paragraphRanges,originalRanges,'no partial paragraph table is published');
 assert.equal(f.events.length,0);
}
{
 const f=rangeOwner();
 const fullMap=readingChapterLayoutMap(f.full);
 assert.equal(readingChapterLayoutMap(retainReadingEntryImageHandles(f.full,f.chapter)),fullMap,
   'retaining native image handles also retains the prepared Unicode map identity');
}
console.log('PASS expansion atomic admission and cancellation during cooperative indexing');

{
 const f=rangeOwner();f.owner.readerSettingsSnapshot.navigationMode='continuous';
 f.owner.continuousEntryPositionReady=false;
 f.owner.scheduleEntryWindowHydration();assert.equal(f.frames.length,0,'continuous expansion waits for the initial native row restore');
 f.owner.continuousEntryPositionReady=true;
 f.owner.scheduleEntryWindowHydration();assert.equal(f.frames.length,1);
}
const ContinuousEdges=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),
 ['onContinuousReachStart','onContinuousReachEnd','onContinuousBoundaryDrag']);
{
 let requests=0;const owner=Object.assign(new ContinuousEdges(),{chapter:{images:[],documentRange:{startScalar:40}},scheduleEntryWindowHydration(){requests++;},
  adjacentChapterIndex(){throw Error('resident edge is not a chapter edge');}});
 owner.onContinuousReachStart();owner.onContinuousReachEnd();owner.onContinuousBoundaryDrag('next');assert.equal(requests,3);
}
console.log('PASS continuous window initial-restore fence and no false chapter-boundary navigation');
