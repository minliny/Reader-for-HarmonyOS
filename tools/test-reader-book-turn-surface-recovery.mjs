import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {cancelReaderPagePan,completeReaderPageGestureSettlement} from '../entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const source=readFileSync(file,'utf8');
const events=Object.fromEntries(['SURFACE_READY','TEXTURE_READY','VISUAL_COMMIT_ENDPOINT','ROLLBACK_COMPLETE',
  'SURFACE_LOST','RENDER_FAILURE','SLOTS_COMMITTED','TERMINAL_RELEASED','FRAME_PRESENTED']
  .map((name,i)=>[`BOOK_TURN_EVENT_${name}`,i+1]));
const methods=['onBookTurnNativeEvent','failBookTurnRuntime','finishSuccessfulPageTurnPresentation','finishPageTurnRollback', 'requestBookTurn2DFallback', 'completeBookTurn2DFallback'];
if(source.includes('private recoverBookTurnSurfaceIfIdle('))methods.push('recoverBookTurnSurfaceIfIdle');
const Owner=productionMotionMethods(file,methods,{...events,cancelReaderPagePan,completeReaderPageGestureSettlement});
const noop=()=>{};
function owner(){
 const stats={committed:0,rollback:0,refresh:0,native:0};
 const value=Object.assign(new Owner(),{mounted:true,lifecycleToken:1,bookTurnSurfaceRecoveryPending:false,
  bookTurnRuntimeFailed:false,pageTurnSettlementGeneration:7,bookTurnSurfaceGeneration:7,
  pageTurnRenderRevision:9,bookTurnArkUIReadyRevision:9,pageTurnSettlementActive:true,pageTurnPresentationPhase:'settling',bookTurnMotion:{generation:7},
  pageTurnGestureState:{phase:'settling',owner:'horizontalPage',direction:'next'},pageTurnInputOwned:true,
  pageTurnAnimationFinished:true,pageTurnCommitStarted:false,pageTurnCommitFinished:false,pageTurnCommitSucceeded:false,
  bookTurnSurfaceOpacity:1,pageTurnDirection:'next',autoPageState:{status:'stopped'},viewportWidth:390,viewportHeight:780,
  shouldMountBookTurnSurface:()=>true,usesBookTurnSimulation(){return !this.bookTurnRuntimeFailed;},
  automaticReadingState(){return this.autoPageState;},
  bookTurnSession:{configure:noop,releaseTerminalFrame:noop,clearSurface:noop,retainedTerminalGeneration:()=>0,commitSlots(){stats.native++;return false;}},
  clearBookTurnCapturedIdentities:noop,clearPageTurnProjection:noop,cancelPageTurnSettlementDeadline:noop,
  finishPageTurnPerf:kind=>stats[kind]++,flushDeferredPageChromeState:noop,retryRapidPageTurnTransaction:noop,
  completeRapidPageTurnTransaction:noop,resumeDeferredPageTurnWork:noop,drainRapidPageTurn:noop,
  resumePendingAutoPageTurn:noop,drainPageTurnPreparationQueue:noop,isSessionActive:()=>false,
  scheduleBookTurnTextureRefresh:()=>stats.refresh++});return {value,stats};
}
const failures=[];
function scenario(name,action){try{action();}catch(e){failures.push(`${name}: ${e.message}`);}}
scenario('new ready rolls back unwritten old transaction',()=>{
 const {value,stats}=owner();value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_SURFACE_READY});
 assert.equal(stats.rollback,1);assert.equal(value.pageTurnSettlementActive,false);
 assert.equal(value.pageTurnInputOwned,false);assert.equal(value.bookTurnRuntimeFailed,false);
 assert.equal(value.bookTurnSurfaceOpacity,0);assert.equal(value.pageTurnPresentationPhase,'idle');assert.ok(stats.refresh>0);
});
scenario('new ready retains an uncertain write and recovers only after authoritative completion',()=>{
 const {value,stats}=owner();const prepared={id:'original'};
 Object.assign(value,{pageTurnCommitStarted:true,pageTurnSettlingPrepared:prepared});
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_SURFACE_READY});
 assert.equal(value.pageTurnSettlementActive,true);assert.equal(value.pageTurnSettlingPrepared,prepared);
 assert.equal(value.bookTurnRuntimeFailed,true);assert.equal(stats.committed,0);assert.equal(stats.rollback,0);
 assert.equal(stats.native,0);assert.equal(stats.refresh,0);
 Object.assign(value,{pageTurnCommitFinished:true,pageTurnCommitSucceeded:true,pageTurnSettlingPrepared:undefined});
 value.finishSuccessfulPageTurnPresentation(7);assert.equal(stats.committed,1);
 assert.equal(value.bookTurnRuntimeFailed,false);assert.equal(value.pageTurnPresentationPhase,'idle');assert.ok(stats.refresh>0);
});
scenario('a rejected write rolls back before re-enabling the replacement',()=>{
 const {value,stats}=owner();Object.assign(value,{pageTurnCommitStarted:true,pageTurnSettlingPrepared:{id:1}});
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_SURFACE_READY});
 value.pageTurnCommitStarted=false;value.finishPageTurnRollback(7);
 assert.equal(stats.rollback,1);assert.equal(value.bookTurnRuntimeFailed,false);assert.equal(value.pageTurnInputOwned,false);
});
for(const event of [events.BOOK_TURN_EVENT_SURFACE_READY,events.BOOK_TURN_EVENT_SURFACE_LOST,events.BOOK_TURN_EVENT_RENDER_FAILURE]){
 scenario(`already-promoted transaction finishes without lost Native slots (${event})`,()=>{
  const {value,stats}=owner();Object.assign(value,{pageTurnCommitStarted:true,pageTurnCommitFinished:true,
    pageTurnCommitSucceeded:true,pageTurnSettlingPrepared:undefined,bookTurnAwaitingSlotCommit:true});
  value.onBookTurnNativeEvent({event});assert.equal(stats.committed,1);assert.equal(stats.rollback,0);
  assert.equal(value.pageTurnSettlementActive,false);assert.equal(value.bookTurnAwaitingSlotCommit,false);
  assert.equal(value.bookTurnRuntimeFailed,event!==events.BOOK_TURN_EVENT_SURFACE_READY);assert.equal(stats.native,0);
 });
}
scenario('a later render failure cancels a pending capability recovery',()=>{
 const {value,stats}=owner();Object.assign(value,{pageTurnCommitStarted:true,pageTurnSettlingPrepared:{id:1}});
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_SURFACE_READY});
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_RENDER_FAILURE});
 Object.assign(value,{pageTurnCommitFinished:true,pageTurnCommitSucceeded:true,pageTurnSettlingPrepared:undefined});
 value.finishSuccessfulPageTurnPresentation(7);assert.equal(value.bookTurnRuntimeFailed,true);assert.equal(stats.refresh,0);
});
assert.deepEqual(failures,[]);
{
 const {value,stats}=owner();
 Object.assign(value,{pageTurnCommitStarted:true,pageTurnCommitFinished:true,pageTurnCommitSucceeded:true,
   pageTurnSettlingPrepared:undefined,bookTurnAwaitingSlotCommit:true});
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_SURFACE_LOST});
 assert.equal(stats.committed,1);
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_TERMINAL_RELEASED,generation:7});
 assert.equal(stats.committed,1,'late terminal ACK cannot complete an already released 2D transaction twice');
 value.pageTurnSettlementActive=true;value.bookTurnSurfaceGeneration=8;
 value.onBookTurnNativeEvent({event:events.BOOK_TURN_EVENT_ROLLBACK_COMPLETE,generation:7});
 assert.equal(stats.rollback,0,'late rollback of A cannot reset a new tracking surface B');
}
console.log('Production Surface recovery: unwritten rollback, uncertain write retention, promoted completion, late failure PASS (7 scenarios)');
