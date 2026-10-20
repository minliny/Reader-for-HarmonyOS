import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { stopBookTurnMotion } from '../entry/src/main/ets/features/reading/BookTurnMotionState.ts';

const root=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
const file=new URL('LocalReadingExperience.ets',root);
const methods=['retirePageTurnForReduceMotion','onSessionLaunchReduceMotionChanged','completeBookTurn2DFallback'];
const Owner=productionMotionMethods(file,methods,{stopBookTurnMotion});
function fixture() {
  const calls=[],owner=new Owner();Object.assign(owner,{mounted:true,reduceMotion:true,lifecycleToken:1,
    pageTurnSettlementActive:true,pageTurnSettlementGeneration:7,bookTurnSurfaceGeneration:7,
    pageTurnSlideTimeline:{},bookTurnMotion:{generation:7,active:true},pageTurnAutomaticStart:{started:false},
    bookTurnTextureCaptureGeneration:0,bookTurnTextureCaptureScheduled:true,bookTurnSurfaceOpacity:1,
    pageTurnAnimationFinished:false,pageTurnCommitStarted:false,pageTurnCommitFinished:false,pageTurnCommitSucceeded:false,
    pageTurnSettlingPrepared:{id:'destination'},pageTurnStoredProgress:undefined,bookTurnAwaitingSlotCommit:false,
    pageTurnRenderRevision:9,bookTurnArkUIReadyRevision:9,bookTurnRuntimeFailed:false,
    clearBookTurnCapturedIdentities:()=>calls.push('clear-identities'),
    bookTurnSession:{releaseTerminalFrame:g=>calls.push(`release:${g}`),clearSurface:g=>calls.push(`clear:${g}`)},
    finishPageTurnRollback(g){calls.push(`rollback:${g}`);owner.pageTurnSettlementActive=false;owner.pageTurnInputOwned=false;},
    finishPreparedPageTurnSettlement:g=>calls.push(`join:${g}`),
    finishSuccessfulPageTurnPresentation(g){calls.push(`complete:${g}`);owner.pageTurnSettlementActive=false;},
    armPageTurnSettlementDeadline:g=>calls.push(`deadline:${g}`)});
  return {owner,calls};
}
{
  const {owner,calls}=fixture();owner.onSessionLaunchReduceMotionChanged();
  assert.ok(calls.includes('rollback:7'));assert.equal(owner.pageTurnSettlingPrepared,undefined);
  assert.equal(owner.pageTurnSettlementActive,false);assert.equal(owner.bookTurnMotion,undefined);
  assert.equal(owner.pageTurnSlideTimeline,undefined);assert.equal(owner.bookTurnSurfaceOpacity,0);
  assert.equal(owner.bookTurnRuntimeFailed,false,'preference retirement is not a capability failure');
}
// A Core write already started at the visual endpoint is never cancelled or
// reissued; its original owner remains until the actual receipt is classified.
{
  const {owner,calls}=fixture(),prepared=owner.pageTurnSettlingPrepared;
  Object.assign(owner,{pageTurnAnimationFinished:true,pageTurnCommitStarted:true});
  owner.onSessionLaunchReduceMotionChanged();assert.equal(owner.pageTurnSettlingPrepared,prepared);
  assert.equal(owner.pageTurnSettlementActive,true);assert.equal(owner.pageTurnCommitFinished,false);
  assert.ok(!calls.some(v=>v.startsWith('rollback:')||v.startsWith('join:')));
  owner.pageTurnCommitFinished=true;owner.pageTurnCommitSucceeded=true;
  owner.retirePageTurnForReduceMotion();assert.ok(calls.includes('join:7'));
}
// A promoted resident page must wait for its own content revision, rather than
// a retired Native SLOTS_COMMITTED/TERMINAL_RELEASED acknowledgement.
{
  const {owner,calls}=fixture();Object.assign(owner,{pageTurnAnimationFinished:true,pageTurnCommitStarted:true,
    pageTurnCommitFinished:true,pageTurnCommitSucceeded:true,pageTurnSettlingPrepared:undefined,bookTurnAwaitingSlotCommit:true});
  owner.onSessionLaunchReduceMotionChanged();assert.equal(owner.bookTurn2DFallbackPending,true);
  assert.equal(owner.bookTurnAwaitingSlotCommit,false);assert.ok(!calls.includes('complete:7'));
  assert.equal(owner.completeBookTurn2DFallback(6),false);
  owner.bookTurnArkUIReadyRevision=owner.pageTurnRenderRevision;
  assert.equal(owner.completeBookTurn2DFallback(7),true);assert.ok(calls.includes('complete:7'));
  assert.equal(owner.bookTurnRuntimeFailed,false);assert.equal(owner.pageTurnPresentationPhase,'idle');
}
{
  const {owner,calls}=fixture();owner.reduceMotion=false;owner.onSessionLaunchReduceMotionChanged();
  assert.deepEqual(calls,[],'enabling motion cannot replay an older page-turn intent');
}

class Frame {constructor(fn){this.fn=fn;}onFrame(){this.fn();}}
const stageFile=new URL('ReaderPageTurnStage.ets',root);
function stageFixture(file=stageFile) {
  const Surface=productionMotionMethods(file,['aboutToAppear','aboutToDisappear','onRenderRevisionChanged'],
    {ReaderPageTurnFrameCallback:Frame});
  const owner=new Surface(),frames=[],content=[],presented=[];
  Object.assign(owner,{mounted:false,lifecycle:0,frameGeneration:0,renderRevision:9,pageIdentity:'A',slotIdentity:'slot-a',
    onContentReady:r=>content.push(r),onPresented:r=>presented.push(r),
    getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});
  return {owner,frames,content,presented};
}
for(const invalidate of [o=>o.aboutToDisappear(),o=>{o.renderRevision++;},o=>{o.pageIdentity='B';},o=>{o.slotIdentity='slot-b';}]) {
  const f=stageFixture();f.owner.aboutToAppear();assert.deepEqual(f.content,[9]);invalidate(f.owner);
  f.frames.shift().onFrame();assert.deepEqual(f.presented,[],'late slot frame cannot acknowledge retired content');
}
{
  const f=stageFixture();f.owner.aboutToAppear();const old=f.frames.shift();f.owner.aboutToDisappear();f.owner.aboutToAppear();
  old.onFrame();assert.deepEqual(f.presented,[],'same revision after reentry has a different lifecycle');
  f.frames.shift().onFrame();assert.deepEqual(f.presented,[9]);
  f.owner.onRenderRevisionChanged();f.owner.onRenderRevisionChanged();
  f.frames.shift().onFrame();assert.deepEqual(f.presented,[9],'superseded frame of the same revision cannot ACK twice');
  f.frames.shift().onFrame();assert.deepEqual(f.presented,[9,9]);
}
const scratch=mkdtempSync(join(tmpdir(),'reader-frame-retirement-'));
try {
  const original=readFileSync(stageFile,'utf8'),mutant=join(scratch,'Stage.ets');
  writeFileSync(mutant,original.replace(/      if \(!this\.mounted \|\| lifecycle !== this\.lifecycle[\s\S]*?slotIdentity !== this\.slotIdentity\) return;\n/,''));
  const f=stageFixture(mutant);f.owner.aboutToAppear();f.owner.aboutToDisappear();f.frames.shift().onFrame();
  assert.throws(()=>assert.deepEqual(f.presented,[]),'omission negative control catches an ACK after unmount');
}finally{rmSync(scratch,{recursive:true,force:true});}
console.log('Reader motion retirement PASS: pre-endpoint rollback; dispatched receipt retained; promoted content revision; mounted/lifecycle/revision/page/slot frame ACK admission; omission negative control');
