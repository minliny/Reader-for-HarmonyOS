import assert from 'node:assert/strict';
import { productionMotionMethods } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
import * as gesture from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
import { mergeReaderControlBookmarkProjection } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
const file=new URL('file:///Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const names=['onReaderBookmarkGestureStateChanged','onReaderBookmarkGestureReleased','finishBookmarkRollback','toggleCurrentPageBookmark','currentPageBookmarkStatus','pageBookmarkFeedbackAnchor','pageBookmarkFeedbackFilled','reconcilePageBookmarkFeedback','controlDirectorySourceEntries','controlDirectoryEntries','canStartReaderBookmarkGesture'];
// Timers/Host replies are controlled. All gesture, admission, cache, target and reconciliation methods execute unchanged.
const H=productionMotionMethods(file,names,{...gesture,motionAnimateParam:(_key,onFinish)=>({onFinish})});
const orders=[['ack','projection','rollback'],['ack','rollback','projection'],['projection','ack','rollback'],['projection','rollback','ack'],['rollback','ack','projection'],['rollback','projection','ack']];
for(const order of orders){
 let request,finish;
 const h=Object.assign(new H(),{mounted:true,sourceId:'local',bookId:'b',chapter:undefined,visiblePage:{startScalar:50,endScalar:100},directoryEntries:[{index:16,title:'chapter17',bookmarks:[]}],tocEntries:[],currentChapterIndex:()=>16,currentPageBookmarkText:()=> 'text',canTurnPage:()=>true,bookmarkPendingTarget:'',bookmarkPreviewChanged:false,bookmarkRollbackGeneration:0,bookmarkMutationGeneration:0,reduceMotion:false,appForeground:false,flushDeferredPageChromeState(){},onTogglePageBookmark:r=>{request=r;},getUIContext:()=>({animateTo:(options,closure)=>{finish=options.onFinish;closure();}})});
 const outcomes=[];
 for(const [operation,desired] of [['create',true],['delete',false]]){
  assert.equal(h.canStartReaderBookmarkGesture(),true);
  let state=gesture.beginReaderPageGesture(390,200,300,0,844);
  state=gesture.moveReaderPageGesture(state,0,80);
  const decision=gesture.settleReaderPageGesture(state,0,80);
  h.pageTurnGestureState=decision.state;h.onReaderBookmarkGestureStateChanged(decision.state);h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
  assert.equal(h.pageBookmarkFeedbackFilled(),desired);
  assert.equal(h.canStartReaderBookmarkGesture(),false,'pending mutation gates another gesture');
  for(const step of order){
   if(step==='ack')request.onSettled(true);
   if(step==='projection'){
    h.directoryEntries=mergeReaderControlBookmarkProjection(h.directoryEntries,[{index:16,title:'chapter17',bookmarks:desired?[{time:10,chapterOffset:50}]:[]}]);
    h.reconcilePageBookmarkFeedback();
   }
   if(step==='rollback')finish();
   outcomes.push({operation,step,filled:h.pageBookmarkFeedbackFilled(),preview:h.bookmarkPreviewChanged,pending:h.bookmarkPendingTarget});
  }
  assert.equal(h.pageBookmarkFeedbackFilled(),desired,'stable state agrees with confirmed canonical projection');
  assert.equal(h.canStartReaderBookmarkGesture(),true);
 }
 console.log(JSON.stringify({status:'PASS',order,outcomes}));
}
console.log(JSON.stringify({summary:'6 ordering permutations; 12 normal-motion create/delete lifecycles; production cache and merge used. No ArkUI observer scheduling/native paint or real Core ACK simulated.'}));
