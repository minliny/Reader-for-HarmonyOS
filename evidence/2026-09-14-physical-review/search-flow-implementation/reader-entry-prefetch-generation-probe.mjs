import assert from 'node:assert/strict';
import {productionMotionMethods} from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
const Owner=productionMotionMethods('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets',[
 'prefetchNextChapter','requestPageTurnChapter','schedulePageTurnPreparation'],{
 readerPageTransitionUsesPreparedPages:()=>false,setTimeout:()=>1});
function scenario(order){
 let valid;
 const chapter={chapterIndex:0},page={startScalar:0};
 const owner=Object.assign(new Owner(),{chapter,visiblePage:page,lifecycleToken:1,chapterSelectionToken:1,
 pageTurnGeneration:5,pageTurnRenderRevision:5,preferredPageTextureDirection:'next',pageTurnChapterLoads:new Set(),
 adjacentChapterIndex:()=>1,chapterWindow:{get:()=>undefined},isStableVisiblePageOwner:()=>true,isKnownControlChapter:()=>true,
 activeGateway:()=>({loadChapter:(_book,_chapter,isCurrent)=>{valid=isCurrent;return new Promise(()=>{});}})});
 if(order==='prepare-then-prefetch')owner.schedulePageTurnPreparation();
 owner.prefetchNextChapter(chapter,1,1);
 const validAtStart=valid();
 if(order==='prefetch-then-prepare')owner.schedulePageTurnPreparation();
 return{order,validAtStart,validAfterDispatch:valid(),pageTurnGeneration:owner.pageTurnGeneration};
}
const current=scenario('prefetch-then-prepare'),proposed=scenario('prepare-then-prefetch');
assert.equal(current.validAtStart,true);assert.equal(current.validAfterDispatch,false);
assert.equal(proposed.validAfterDispatch,true);
console.log(JSON.stringify({current,proposed,boundary:'Unchanged production prefetch/request/preparation methods; no network or body callbacks; specific generation-admission proof only.'}));
