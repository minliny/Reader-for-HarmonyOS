import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerRapidPageTurnHasWork, createReaderRapidPageTurnState } from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const events={BOOK_TURN_EVENT_SURFACE_READY:1,BOOK_TURN_EVENT_TEXTURE_READY:2,BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT:3,
  BOOK_TURN_EVENT_ROLLBACK_COMPLETE:4,BOOK_TURN_EVENT_SURFACE_LOST:5,BOOK_TURN_EVENT_RENDER_FAILURE:6,
  BOOK_TURN_EVENT_SLOTS_COMMITTED:7,BOOK_TURN_EVENT_TERMINAL_RELEASED:8,BOOK_TURN_EVENT_FRAME_PRESENTED:9};
class ReaderUIFrameCallback { constructor(fn){this.fn=fn;} onFrame(){this.fn();} }
let now=100;
const Model=productionMotionMethods(file,['startPreparedPageTurnSettlement','performPageTurn','onBookTurnNativeEvent',
  'isAutomaticPageStartCurrent','admitAutomaticPageStart','cancelAutomaticPageStart','animatePageTurnRollback',
  'pauseAutoPage','stopAutoPage','acquirePagePointer','regrabPageTurn'],{
  ...events,BOOK_TURN_PROFILE_MANUAL:0,BOOK_TURN_PROFILE_RAPID:1,BOOK_TURN_PROFILE_AUTOMATIC:2,
  ReaderUIFrameCallback,readerMotionNowMs:()=>++now,readerRapidPageTurnHasWork,
  readerPageTransitionUsesPreparedPages:()=>true,
  beginBookTurnMotion:(generation,direction)=>({generation,direction}),bookTurnInput:m=>m,
  resumeReaderPagePan:(direction,offset)=>({direction,offset}),stopBookTurnMotion:m=>{m.active=false;},
});
function fixture(){
  const frames=[],starts=[],acks=[],rollbacks=[],writes=[],prepared={direction:'next'};
  const auto={status:'running',generation:5,awaitingPageCommit:true};
  const owner=Object.assign(new Model(),{
    mounted:true,appForeground:true,exitRequested:false,lifecycleToken:7,viewportWidth:400,viewportHeight:800,
    activePagePointerId:-1,pagePointerEpoch:0,pendingPointerSegmentReserved:false,
    readerSettingsSnapshot:{navigationMode:'paged'}, rapidPageTurnState:createReaderRapidPageTurnState(),
    pageTurnSettlementGeneration:20,bookTurnSurfaceGeneration:20,pageTurnSettlementActive:false,
    pageTurnPresentationPhase:'idle',pageTurnCommitStarted:false,pageTurnCommitFinished:false,
    pageTurnOffsetX:0,bookTurnSurfaceOpacity:0,controlVisible:()=>false,controlObscured:false,interactionBlocked:false,
    usesBookTurnSimulation:()=>true,usesNoAnimationPageTurnRuntime:()=>false,
    isPreparedPageTurnFresh:()=>true,preparedPageTurn:()=>prepared,canStartReaderPageTurn:()=>true,canTurnPage:()=>true,
    isReaderPageInteractionEnabled:()=>true,readingLayout:()=>({}),beginPageTurnPerf(){},finishPageTurnPerf(){},
    armPageTurnSettlementDeadline(){},cancelPageTurnSettlementDeadline(){},
    automaticReadingState:()=>auto,isTtsFollowLeaseCurrent:()=>true,
    autoPageCoordinator:{retryTurn:g=>{assert.equal(g,5);},pause:()=>{auto.status='paused';},stop:()=>{auto.status='stopped';}},
    getUIContext:()=>({postFrameCallback:f=>frames.push(f)}),
    queuePageTurnPreparation(){},scheduleBookTurnTextureRefresh(){},completeDirectPageTurnGesture(){},
    completeRapidPageTurnTransaction(){},invalidateTtsPageFollow(){},
    bookTurnSession:{startProgrammatic:(g,d,p)=>{starts.push({g,d,p});return true;},
      startAutomaticTimeline:(g,t)=>{acks.push({g,t});return true;},settle:(g,commit)=>{rollbacks.push({g,commit});return true;},
      endGesture:()=>true,regrab:()=>({edgeX:200,edgeY:0,theta:0})},
    beginPreparedPageTurnPersistence:()=>writes.push('persist'),finishPreparedPageTurnSettlement(){},
  });
  return {owner,auto,frames,starts,acks,rollbacks,writes,prepared,
    start:(origin='autoTimer')=>owner.performPageTurn('next',origin,origin==='ttsFollow'?{}:undefined),
    frame:(token=71)=>owner.onBookTurnNativeEvent({event:9,generation:owner.pageTurnSettlementGeneration,detail:token}),
    flush:()=>{for(const f of frames.splice(0))f.onFrame();}};
}
for (const [origin,pendingDelta,profile] of [['manual',0,0],['manual',3,1],['autoTimer',0,2],['ttsFollow',0,2]]) {
 const f=fixture(); f.owner.rapidPageTurnState.pendingDelta=pendingDelta;
 assert.equal(f.start(origin).kind,'started'); assert.equal(f.starts[0].p,profile,origin);
 assert.equal(f.owner.pageTurnSettlementOrigin,origin);
}
{
 const f=fixture(); let ready=false;
 f.owner.preparedPageTurn=()=>ready?f.prepared:undefined;f.owner.knownPageTurnBoundary=()=>undefined;
 assert.equal(f.start().kind,'preparing');ready=true;assert.equal(f.start().kind,'started');
 assert.equal(f.starts[0].p,2,'automatic source survives shared page preparation/retry');
}
{
 const f=fixture();f.start();assert.equal(f.owner.bookTurnSurfaceOpacity,0);assert.equal(f.acks.length,0);
 f.frame(); assert.equal(f.owner.bookTurnSurfaceOpacity,1);assert.equal(f.frames.length,1);assert.equal(f.acks.length,0);
 f.frame(); assert.equal(f.frames.length,1,'duplicate first-buffer events cannot schedule multiple ACKs');
 f.owner.onBookTurnNativeEvent({event:3,generation:21,detail:0});assert.equal(f.writes.length,0,'no durable endpoint before ACK');
 f.flush();assert.deepEqual(f.acks,[{g:21,t:71}]);assert.equal(f.owner.pageTurnAutomaticStart.started,true);
 f.frame();f.flush();assert.equal(f.acks.length,1,'duplicate event cannot restart timeline');
 f.owner.onBookTurnNativeEvent({event:3,generation:21,detail:0});assert.equal(f.writes.length,1);
}
for (const action of ['pause','stop','manualDown','background','overlay','oldLifecycle','oldSurface','ttsStopped']) {
 const f=fixture();f.start(action==='ttsStopped'?'ttsFollow':'autoTimer');f.frame();
 if(action==='pause')f.owner.pauseAutoPage('manual');
 if(action==='stop')f.owner.stopAutoPage();
 if(action==='manualDown')f.owner.acquirePagePointer(3);
 if(action==='background')f.owner.appForeground=false;
 if(action==='overlay')f.owner.interactionBlocked=true;
 if(action==='oldLifecycle')f.owner.lifecycleToken++;
 if(action==='oldSurface')f.owner.bookTurnSurfaceGeneration++;
 if(action==='ttsStopped')f.owner.isTtsFollowLeaseCurrent=()=>false;
 if(['pause','stop','manualDown'].includes(action))assert.equal(f.rollbacks.length,1,`${action}: immediate cancellation, no watchdog wait`);
 f.flush();assert.equal(f.acks.length,0,action);assert.equal(f.writes.length,0,action);
 assert.deepEqual(f.rollbacks,[{g:21,commit:false}],`${action}: rollback retains native owner generation`);
 assert.equal(f.owner.pageTurnAutomaticStart,undefined);
}
{
 const f=fixture();f.start();f.frame();f.owner.bookTurnSession.startAutomaticTimeline=()=>false;f.flush();
 assert.deepEqual(f.rollbacks,[{g:21,commit:false}]);assert.equal(f.writes.length,0);
}
{
 const f=fixture();f.start();f.frame();const old=f.frames.shift();f.owner.pageTurnAutomaticStart=undefined;
 f.owner.pageTurnSettlementActive=false;f.owner.pageTurnSettlingPrepared=undefined;f.start();
 old.onFrame();assert.equal(f.acks.length,0,'old callback cannot ACK replacement transaction');
 assert.equal(f.rollbacks.length,0,'old callback cannot rollback replacement transaction');
}
{
 const f=fixture();f.start();f.frame();f.flush();f.owner.acquirePagePointer(3);
 assert.equal(f.rollbacks.length,0,'already-started automatic gesture keeps existing regrab path');
 const state=f.owner.regrabPageTurn(400,800,200,100,30);assert.equal(state.direction,'next');
 assert.equal(f.owner.bookTurnMotion.generation,22,'manual takeover obtains new native generation');
}
console.log('automatic page start production methods: origin profiles/preparation, ordered single ACK, stale events, no pre-ACK progress, immediate cancellation, same-generation rollback and manual regrab PASS');
{
 const scheduled=[];
 const Deadline=productionMotionMethods(file,['armPageTurnSettlementDeadline'],{
   PAGE_TURN_SETTLEMENT_DEADLINE_MS:2000,setTimeout:(fn,delay)=>{scheduled.push({fn,delay});return 1;},
 });
 const f=fixture();f.start();Deadline.prototype.armPageTurnSettlementDeadline.call(f.owner,21);
 assert.equal(scheduled[0].delay,2000,'existing watchdog duration is unchanged');
 scheduled[0].fn();assert.deepEqual(f.rollbacks,[{g:21,commit:false}]);
 assert.equal(f.writes.length,0,'lost first-buffer/ACK notification cannot force a progress write');
}
{
 const f=fixture();f.start();f.owner.getUIContext=()=>({postFrameCallback(){throw new Error('frame unavailable');}});
 f.frame();assert.deepEqual(f.rollbacks,[{g:21,commit:false}]);assert.equal(f.acks.length,0);
}
console.log('automatic start missing-event/ACK watchdog and rejected frame scheduling converge safely without progress writes PASS');
