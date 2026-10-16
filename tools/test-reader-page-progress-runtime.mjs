// This fixture controls persistence/read outcomes to test recovery UI only.
// The real shared owner and physical late-write boundary are tested separately.
import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {reconcileReaderControlSelectionProgress} from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
import {readerPageRecoveryDependencies,readerPageRecoveryPorts} from './lib/reader-page-recovery-fixture.mjs';
const Owner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['persistPreparedPageTurn','reconcilePreparedPageTurn','admitPageTurnPersistenceOutcome','isPreparedPageTurnCommitCurrent','invalidatePageTurnRuntime'],{...readerPageRecoveryDependencies,reconcileReaderControlSelectionProgress,CoreReadingAnchor:class{constructor(chapterIndex,chapterOffset,chapterProgress){Object.assign(this,{chapterIndex,chapterOffset,chapterProgress});}},hilog:{error(){}}});
for(const outcome of ['written-lost-reply','origin','unavailable','foreign']){
 const prepared={context:{chapter:{chapterIndex:2,chapterTitle:'two'},layoutMap:{scalarCount:()=>100}},page:{startScalar:40}};let writes=0,reads=0,dialog,finished=0,handoffs=0;
 const origin={startScalar:10};
 const owner=readerPageRecoveryPorts(Object.assign(new Owner(),{bookId:'b',mounted:true,lifecycleToken:1,phase:'ready',
  pageTurnSettlementGeneration:5,bookTurnSurfaceGeneration:5,pageTurnRenderRevision:1,pageTurnSettlingPrepared:prepared,
  pageTurnInputOwned:true,pageTurnSettlementActive:true,visiblePage:origin,
  cancelPageTurnSettlementDeadline(){},lastCommittedProgress:{chapterIndex:1,chapterOffset:10,updatedAt:1},isPreparedPageTurnFresh:()=>true,isMountedToken:()=>true,coreLayout:()=>({}),errorMessage:e=>e.message,finishPreparedPageTurnSettlement(){finished++;},getUIContext:()=>({showAlertDialog:d=>{dialog=d;}}),activeGateway:()=>({handoffPendingProgress(){handoffs++;},hasPendingSourceSwitch:()=>false,runProgressCommitSerial:fn=>fn(),persistPresentedProgress:async()=>{writes++;throw Error('reply lost');},loadProgress:async()=>{reads++;if(outcome==='unavailable')throw Error('offline');return {kind:'restored',progress:{bookId:'b',chapterIndex:outcome==='written-lost-reply'?2:1,chapterOffset:outcome==='written-lost-reply'?40:outcome==='foreign'?77:10,chapterProgress:.4,updatedAt:1}};}})}));
 const result=await owner.persistPreparedPageTurn(prepared,1,5);assert.equal(result,outcome==='written-lost-reply'?true:outcome==='origin'?false:undefined);assert.equal(writes,1);assert.equal(reads,1);
 owner.admitPageTurnPersistenceOutcome(prepared,1,5,result);
 if(result===undefined){
  assert.equal(finished,0);assert.equal(dialog,undefined);assert.equal(handoffs,1);
  assert.equal(owner.readerRecoveryView.visible,true);assert.equal(owner.readerRecoveryView.canRetry,false);
  assert.equal(owner.pageTurnInputOwned,false);assert.equal(owner.pageTurnSettlementActive,false);
  assert.equal(owner.visiblePage,origin,'unknown persistence cannot promote a candidate or erase the materialized origin');
  assert.equal(owner.pageTurnPersistenceState,'idle');
  owner.admitPageTurnPersistenceOutcome(prepared,1,5,true);
  assert.equal(finished,0,'a stale ACK cannot promote the retired candidate');
  assert.equal(writes,1,'background handoff never dispatches a replacement mutation');assert.equal(reads,1);
 }else assert.equal(finished,1);
}
console.log('production prepared-page recovery UI branches with controlled persistence/read seams: PASS; actual shared-owner unknown/CAS proof is test-reader-strong-progress-owner.mjs');
