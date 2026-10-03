// This fixture controls persistence/read outcomes to test recovery UI only.
// The real shared owner and physical late-write boundary are tested separately.
import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {reconcileReaderControlSelectionProgress} from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
const Owner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['persistPreparedPageTurn','reconcilePreparedPageTurn','admitPageTurnPersistenceOutcome'],{reconcileReaderControlSelectionProgress,CoreReadingAnchor:class{constructor(chapterIndex,chapterOffset,chapterProgress){Object.assign(this,{chapterIndex,chapterOffset,chapterProgress});}},hilog:{error(){}}});
for(const outcome of ['written-lost-reply','origin','unavailable','foreign']){
 const prepared={context:{chapter:{chapterIndex:2,chapterTitle:'two'},layoutMap:{scalarCount:()=>100}},page:{startScalar:40}};let writes=0,reads=0,dialog,finished=0;
 const owner=Object.assign(new Owner(),{bookId:'b',cancelPageTurnSettlementDeadline(){},lastCommittedProgress:{chapterIndex:1,chapterOffset:10,updatedAt:1},isPreparedPageTurnCommitCurrent:()=>true,isMountedToken:()=>true,coreLayout:()=>({}),errorMessage:e=>e.message,finishPreparedPageTurnSettlement(){finished++;},getUIContext:()=>({showAlertDialog:d=>{dialog=d;}}),activeGateway:()=>({hasPendingSourceSwitch:()=>false,runProgressCommitSerial:fn=>fn(),persistPresentedProgress:async()=>{writes++;throw Error('reply lost');},loadProgress:async()=>{reads++;if(outcome==='unavailable')throw Error('offline');return {kind:'restored',progress:{bookId:'b',chapterIndex:outcome==='written-lost-reply'?2:1,chapterOffset:outcome==='written-lost-reply'?40:outcome==='foreign'?77:10,chapterProgress:.4,updatedAt:1}};}})});
 const result=await owner.persistPreparedPageTurn(prepared,1,5);assert.equal(result,outcome==='written-lost-reply'?true:outcome==='origin'?false:undefined);assert.equal(writes,1);assert.equal(reads,1);
 owner.admitPageTurnPersistenceOutcome(prepared,1,5,result);
 if(result===undefined){assert.equal(finished,0);assert.ok(dialog);dialog.primaryButton.action();await new Promise(r=>setImmediate(r));assert.equal(writes,1,'retry only reconciles; it never repeats an unknown write');assert.equal(reads,2);}else assert.equal(finished,1);
}
console.log('production prepared-page recovery UI branches with controlled persistence/read seams: PASS; actual shared-owner unknown/CAS proof is test-reader-strong-progress-owner.mjs');
