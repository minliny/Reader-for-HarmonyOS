import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({preparation:{description:'Actual drag/tap missing-preparation queue, dedup and idle drain',resources:[]},readiness:{description:'Actual readiness handoff retains held DOWN displacement without another MOVE',resources:[]}});
async function run(id){
 const {default:assert}=await import('node:assert/strict');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const base=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
 if(id==='preparation'){
  const names=['onReaderPageGestureStateChanged','updateBookTurnGesturePresentation','queuePageTurnPreparation','drainPageTurnPreparationQueue','drainRapidPageTurn'];
  const Owner=selectedProductionMethods(new URL('LocalReadingExperience.ets',base),'ReadingExperience',names,{
   readerPageTransitionUsesPreparedPages:()=>true,readerRapidPageTurnDirection:()=> 'next',hilog:{info(){}}});
  for(const bookTurn of [false,true]){
   const begun=[];
   const owner=Object.assign(new Owner(),{pageTurnGestureState:{phase:'idle'},pageTurnFrozenRevision:1,pageTurnRenderRevision:1,pageTurnSessionCapsuleFrozen:true,
    pageTurnPreparationQueue:[],readerSettingsSnapshot:{navigationMode:'paged'},pageTurnInputOwned:false,
    pageTurnSettlementActive:false,pageTurnSettlingPrepared:undefined,pageTurnPreparation:undefined,
    usesBookTurnSimulation:()=>bookTurn,usesNoAnimationPageTurnRuntime:()=>false,preparedPageTurn:()=>undefined,
    beginPageTurnPerf(){},clearPageTurnProjection(){},flushDeferredPageChromeState(){},
    sessionLaunchRenderWorkBlocked:()=>false,canTurnPage:()=>true,adjacentPageTurnTarget:()=>({chapter:0,page:1}),
    beginPageTurnPreparation(direction,target){begun.push([direction,target]);this.pageTurnPreparation={direction};return 'begun';},cancelPageTurnPreparationRetry(){},
    bookTurnTextureCaptureGeneration:0,bookTurnTextureCaptureScheduled:false,
   });
   const dragging={phase:'dragging',direction:'next',owner:'horizontalPage',currentOffsetX:-80};
   owner.onReaderPageGestureStateChanged(dragging);owner.onReaderPageGestureStateChanged(dragging);
   assert.deepEqual(owner.pageTurnPreparationQueue,['next'],'same held drag queues missing direction once');
   assert.equal(begun.length,0,'actual drain refuses measurement while gesture is active');
   owner.onReaderPageGestureStateChanged({phase:'idle',owner:'horizontalPage'});
   assert.equal(begun.length,1,'return to idle drains original request without a new gesture');
   assert.equal(begun[0][0],'next');assert.deepEqual(owner.pageTurnPreparationQueue,[]);
   Object.assign(owner,{mounted:true,exitRequested:false,controlVisible:()=>false,controlObscured:false,interactionBlocked:false,
    activePagePointerId:-1,pendingPointerSegmentReserved:false,rapidPageTurnState:{},pageTurnPreparation:undefined,
    commitInFlight:false,progressProducers:{continuousInFlight:false}});
   assert.deepEqual(owner.drainRapidPageTurn(),{kind:'preparing'},'tap path keeps same preparation fallback');
   assert.equal(begun.length,2);
  }
 }else{
  const {startReaderPagePan,updateReaderPagePanInPlace}=await import('../entry/src/main/ets/features/reading/ReaderPageGestureState.ts');
  const Layer=selectedProductionMethods(new URL('ReaderPageInteractionLayer.ets',base),'ReaderPageInteractionLayer',['onReadinessChanged'],{updateReaderPagePanInPlace});
  const delivered=[];const state=startReaderPagePan(390,300,100,1,844);
  updateReaderPagePanInPlace(state,-80,0,0,220,100,0,10);
  const owner=Object.assign(new Layer(),{gestureState:state,activePointerId:1,pointerRejected:true,tapOnlyPointer:false,interactionEnabled:true,
   canStartTurn:()=>false,lastLocalX:220,lastLocalY:100,lastSampleTimeMs:10,lastInputX:220,lastInputY:100,pointerInputStartX:300,pointerInputStartY:100,
   velocityX:99,velocityY:99,onGestureStateChange:s=>delivered.push({...s})});
  owner.onReadinessChanged();assert.equal(delivered.length,0);assert.equal(owner.pointerRejected,true);
  owner.canStartTurn=()=>true;owner.onReadinessChanged();
  assert.equal(delivered.length,1);assert.equal(owner.pointerRejected,false);assert.equal(owner.gestureState,state);
  assert.equal(state.startLocalX,300);assert.equal(state.currentOffsetX,-80);assert.equal(state.currentLocalX,220);
  assert.equal(state.velocityX,0);assert.equal(owner.velocityX,0);
  owner.onReadinessChanged();assert.equal(delivered.length,1,'already handed-off sample cannot replay twice');
 }
}
for(const id of selected){await run(id);recordContractCasePass(id);}
