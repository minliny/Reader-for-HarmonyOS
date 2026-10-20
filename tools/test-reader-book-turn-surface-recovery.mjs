import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createBookTurnTextureOwner} from './lib/reader-book-turn-owner-fixture.mjs';
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
  bookTurnTextureCaptureGeneration:0,bookTurnSurfaceCaptureEpoch:0,
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

const ReadyOwner=productionMotionMethods(file,['onBookTurnNativeEvent','recoverBookTurnSurfaceIfIdle',
 'performBookTurnTextureRefresh','captureBookTurnTexture','takeBookTurnPendingSnapshot','canStartReaderPageTurn'],{
 ...events,BOOK_TURN_TEXTURE_CURRENT:1,BOOK_TURN_TEXTURE_NEXT:2,BOOK_TURN_TEXTURE_PREVIOUS:0,
 READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID:'native-current',readerPageTransitionUsesPreparedPages:()=>true,
 BookTurnTextureBuildInput:class {},ComponentContent:class {update() {}},wrapBuilder:value=>value,BookTurnTextureBuilder(){},
});
async function idleReplacementOwner(){
 const stats={uploads:0,snapshotReleases:0,mask:0,refresh:0};
 const bitmap=()=>({release(){stats.snapshotReleases++;}});
 const pages=[{textureIdentity:'previous-page',renderRevision:8,fragments:[]},
  {textureIdentity:'chapter-last-page',renderRevision:8,fragments:[]},
  {textureIdentity:'next-chapter-first-page',renderRevision:8,fragments:[]}];
 const session=createBookTurnTextureOwner(async slot=>{stats.uploads++;stats.mask|=1<<slot;return true;});
 const value=Object.assign(new ReadyOwner(),{
  mounted:true,exitRequested:false,pageTurnSettlementActive:false,bookTurnMotion:undefined,
  bookTurnSurfaceRecoveryPending:false,bookTurnRuntimeFailed:false,bookTurnAwaitingSlotCommit:false,
  bookTurnSurfaceOpacity:0,pageTurnPresentationPhase:'idle',bookTurnTextureCaptureGeneration:3,
  bookTurnSurfaceCaptureEpoch:0,bookTurnArkUIContentRevision:8,pageTurnPreparation:undefined,
  phase:'ready',pageTurnGeneration:1,preferredPageTextureDirection:'next',
  bookTurnSession:Object.assign(session,{configure:()=>true,isReady:()=>true,
   canStart:direction=>(stats.mask&(direction==='next'?6:3))===(direction==='next'?6:3)}),
  usesBookTurnSimulation:()=>true,shouldMountBookTurnSurface:()=>true,sessionLaunchRenderWorkBlocked:()=>false,
  controlVisible:()=>false,pageTurnInputPhase:()=>'idle',currentPageTurnRenderPage:()=>pages[1],
  preparedPageTurnRenderPage:direction=>pages[direction==='next'?2:0],bookTurnCapturedIdentity:slot=>session.capturedIdentity(slot),
  scheduleBookTurnTextureRefresh(){stats.refresh++;},canTurnPage:()=>true,usesNoAnimationPageTurnRuntime:()=>false,
  readerSettingsSnapshot:{},preparedPageTurn:()=>({direction:'next'}),yieldPageTextureFrame:async()=>{},
  bookTurnTextureSnapshotScale:()=>1,readingLayout:()=>({}),
  getUIContext:()=>({getComponentSnapshot:()=>({get:async()=>bitmap()})}),
  captureDecodedBookTurnPage:async()=>bitmap(),
  failBookTurnTextureCapture(_slot,_generation,message){throw new Error(message);},
 });
 session.eventListener=event=>value.onBookTurnNativeEvent(event);
 for(let slot=0;slot<pages.length;slot++) await session.uploadTexture(slot,{},pages[slot].textureIdentity,()=>true);
 stats.uploads=0;
 const replace=()=>{stats.mask=0;session.onNativeEvent(events.BOOK_TURN_EVENT_SURFACE_READY,0,0);};
 return {value,session,stats,pages,bitmap,replace};
}
{
 const {value,session,stats,pages,replace}=await idleReplacementOwner();
 replace();
 assert.equal(value.bookTurnTextureCaptureGeneration,4,'READY invalidates in-flight capture publication');
 assert.equal(value.bookTurnSurfaceCaptureEpoch,1,'READY invalidates retention of old-surface snapshots');
 assert.equal(stats.refresh,1,'an idle READY schedules capture without needing a LOST callback');
 assert.deepEqual([0,1,2].map(slot=>session.capturedIdentity(slot)),['','','']);
 assert.equal(value.canStartReaderPageTurn('next'),false,'an empty replacement ring cannot admit NEXT');
 await value.performBookTurnTextureRefresh(value.bookTurnTextureCaptureGeneration);
 assert.equal(stats.uploads,3,'unchanged logical pages are uploaded again for the replacement surface');
 assert.equal(stats.mask,7);
 assert.deepEqual([0,1,2].map(slot=>session.capturedIdentity(slot)),pages.map(page=>page.textureIdentity));
 assert.equal(value.canStartReaderPageTurn('next'),true,'the next chapter first page is admissible after recapture');
 assert.equal(value.canStartReaderPageTurn('previous'),true);
 assert.equal(value.bookTurnRuntimeFailed,false);
}
for(const slot of [1,2]){
 const {value,session,stats,pages,bitmap,replace}=await idleReplacementOwner();
 pages[slot]={...pages[slot],textureIdentity:`pending-surface-${slot}`};
 let finishSnapshot;
 const snapshot=new Promise(resolve=>{finishSnapshot=resolve;});
 if(slot===1)value.getUIContext=()=>({getComponentSnapshot:()=>({get:()=>snapshot})});
 else value.captureDecodedBookTurnPage=()=>snapshot;
 const pending=value.captureBookTurnTexture(slot,pages[slot],value.bookTurnTextureCaptureGeneration);
 replace();
 finishSnapshot(bitmap());
 assert.equal(await pending,false,'a pre-READY snapshot cannot upload under a new surface epoch');
 assert.equal(stats.uploads,0);
 assert.equal(stats.snapshotReleases,1,'a late old-surface bitmap is released instead of retained');
 assert.equal(session.takePendingSnapshot(pages[slot].textureIdentity,value.pageTurnGeneration),undefined,
  'an unchanged page generation cannot reintroduce the old-surface bitmap');
 assert.equal(session.capturedIdentity(slot),'');
}
console.log('Production READY-only idle recovery: ring recapture, next-chapter admission and late current/adjacent snapshots PASS');
