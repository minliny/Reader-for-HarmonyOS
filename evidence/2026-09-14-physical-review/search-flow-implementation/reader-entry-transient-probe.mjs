import assert from 'node:assert/strict';
import { productionMotionMethods } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
const root='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/';
const queued=[];
const Lre=productionMotionMethods(root+'features/reading/LocalReadingExperience.ets',[
  'completeFirstPage','notifyControlSelectionReadingReady','schedulePageTurnPreparation',
  'completeControlSelectionAfterCommit','admitCommittedProgress'],{
  CoreReadingAnchor:class{constructor(chapterIndex,chapterOffset,chapterProgress){Object.assign(this,{chapterIndex,chapterOffset,chapterProgress});}},
  ReadingCommit:class{constructor(sourceId,bookId,chapterIndex,chapterOffset,chapterProgress){Object.assign(this,{sourceId,bookId,chapterIndex,chapterOffset,chapterProgress});}},
  readerPageTransitionUsesPreparedPages:()=>false,setTimeout:fn=>{queued.push(fn);return queued.length;},
});
const Stage=productionMotionMethods(root+'features/reading/ReaderPageTurnStage.ets',[
  'refreshRenderPages','currentRenderPage']);
const Index=productionMotionMethods(root+'pages/Index.ets',['openReading','presentPreparedReading'],{LOCAL_SOURCE_ID:'local'});
const index=Object.assign(new Index(),{detailBook:{bookId:'book',sourceId:'local'},route:'detail',bookshelfRemovalActiveKey:'',
  isKnownDetailChapter:()=>true,nextNavigationGeneration(){}});
index.openReading(undefined);assert.equal(index.route,'detail');assert.equal(index.readingSessionActive,true);
const lre=Object.assign(new Lre(),{bookId:'book',sourceId:'local',pageTurnRenderRevision:5,pageTurnGeneration:0,
  visibleFragments:[],phase:'measuring',readerSettingsSnapshot:{navigationMode:'paged'},
  preferredPageTextureDirection:'next',isMeasurementCurrent:()=>true,
  requireChapter:()=>({chapterIndex:0,chapterTitle:'第一章'}),requireChapterLayoutMap:()=>({scalarCount:()=>50}),coreLayout:()=>({}),
  releaseUnretainedReadingImages(){},isChapterFirstPageStart:()=>true,beginReadingRecordClock(){},finishPageTurnPerf(){},
  cancelFirstPageReadyDeadline(){},cancelFirstPageCompletionDeadline(){},prefetchNextChapter(){},
  completeRapidPageTurnTransaction(){},drainRapidPageTurn(){},onAutoPagePageCommitted(){},resumeDeferredMeasurement(){},
  scheduleTtsPresentationWarmup(){},onChapterCommitted(){},onReadingCommitted(){},
  fail(error){throw error;}});
let writes=0,ready;
lre.activeGateway=()=>({runProgressCommitSerial:task=>task(),resolveAndUpdateProgress:async()=>{
 writes++;return{chapterIndex:0,chapterOffset:0,chapterProgress:0,locationRevision:1,updatedAt:1};}});
const stage=Object.assign(new Stage(),{contentRevision:5,renderPagesRevision:-1,
  currentPageProvider:()=>({fragments:lre.visibleFragments,renderRevision:lre.pageTurnRenderRevision}),
  previousPageProvider:()=>undefined,nextPageProvider:()=>undefined});
assert.equal(stage.currentRenderPage().fragments.length,0);
lre.onReadingReady=chapterIndex=>{
 index.presentPreparedReading(chapterIndex);
 ready={route:index.route,writes,phase:lre.phase,ownerFragments:lre.visibleFragments.length,
  ownerRevision:lre.pageTurnRenderRevision,stageCachedFragments:stage.currentRenderPage().fragments.length,
  stageRevision:stage.contentRevision};
};
await lre.completeFirstPage({startScalar:0,fragments:[{text:'真实测量后的正文'}]},1,0,1);
assert.deepEqual(ready,{route:'reading',writes:1,phase:'ready',ownerFragments:1,ownerRevision:5,stageCachedFragments:0,stageRevision:5});
assert.equal(lre.pageTurnRenderRevision,6,'same task advances revision after notifying the route');
stage.contentRevision=lre.pageTurnRenderRevision;
assert.equal(stage.currentRenderPage().fragments.length,1,'delivery of final revision admits body without a new Core read');
console.log(JSON.stringify({ready,afterFunction:{ownerRevision:lre.pageTurnRenderRevision,stageFragmentsAfterScalarDelivery:stage.currentRenderPage().fragments.length,queuedPreparationTasks:queued.length},
 boundary:'Unchanged ordinary production methods with mocked persistence and explicit scalar delivery; confirms call order only, not native reactive/frame interleaving or capture duration.'}));
