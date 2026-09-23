import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ReaderTtsPageFollow, readerTtsFollowActive } from '../entry/src/main/ets/features/reading/ReaderTtsPageFollow.ts';
import { createReaderTtsState } from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';
import { readerRapidPageTurnHasWork, createReaderRapidPageTurnState } from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('Reading.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS,
  require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const deferred = tree.statements.find(n => n.name?.getText(tree) === 'ReaderDeferredChapterSelection');
assert.ok(deferred);
const ReaderDeferredChapterSelection = new Function(`${stripTypeScriptTypes(deferred.getText(tree))}; return ReaderDeferredChapterSelection;`)();
const Model = productionMotionMethods(file, ['ttsFollowScope', 'isTtsFollowLeaseCurrent', 'invalidateTtsPageFollow',
  'followTtsPage', 'resumeTtsPageFollow', 'positionTtsFollowTarget', 'selectChapterAnchor', 'stopTts'],
  { readerTtsFollowActive, readerRapidPageTurnHasWork, ReaderDeferredChapterSelection });
function fixture() {
  const calls = [], selections = [], prepares = [];
  const owner = Object.assign(new Model(), {
    sourceId:'source-a', bookId:'book', lifecycleToken:1, mounted:true, appForeground:true, exitRequested:false,
    phase:'ready', ttsPageFollow:new ReaderTtsPageFollow(), ttsFollowHighlight:true,
    ttsFollowPositioning:undefined, ttsState:{...createReaderTtsState(true), status:'playing',
      sessionGeneration:1, utteranceGeneration:1, chapterIndex:1, chapterKey:'chapter-1', contentVersion:'v1', charStart:0},
    readerSettingsSnapshot:{navigationMode:'paged'}, visiblePage:{startScalar:0}, chapter:{chapterIndex:1},
    materializedContentVersion:'v1', chapterSelectionToken:1,
    controlVisible:()=>false, controlObscured:false, interactionBlocked:false,
    activePagePointerId:-1, pendingPointerSegmentReserved:false, pageTurnSettlementActive:false,
    rapidPageTurnState:createReaderRapidPageTurnState(), currentChapterIndex(){return this.chapter?.chapterIndex;},
    currentPaginationKey:()=>({}), paginationIndex:{findContainingPage:(_k,s)=>({pageIndex:Math.floor(s/100)})},
    queuePageTurnPreparation:d=>prepares.push(d), preparedPageTurn:()=>undefined,
    performPageTurn(direction, origin, lease) {calls.push({direction,origin,lease}); this.pageTurnSettlementActive=true; return {kind:'started'};},
    isKnownControlChapter:()=>true, chapterWindow:{get:()=>undefined}, controlShellExitArmed:()=>false,
    resetForChapterSelection(_rapid, preserve) { assert.equal(preserve,true); this.phase='loading'; },
    armFirstPageReadyDeadline(){}, openChapter(...args){selections.push(args);}, cancelAutomaticPageStart(){},
    cancelPendingTtsPlay(){}, logTtsFailure(e){throw e;},
  });
  const publish = (scalar, patch={}) => {
    owner.ttsState={...owner.ttsState, charStart:scalar,...patch}; owner.followTtsPage(owner.ttsState);
  };
  publish(0); // The initial utterance is already visibly aligned.
  return {owner,calls,selections,prepares,publish};
}
{
  const f=fixture(); f.publish(450,{utteranceGeneration:2});
  assert.equal(f.calls.length,0,'far target must not enter rapid/one-page animation');
  assert.equal(f.selections.length,1); assert.equal(f.selections[0][4],450,'one semantic jump to latest position');
  f.publish(460,{utteranceGeneration:3}); assert.equal(f.selections.length,1,'loading coalesces newer speech');
  f.owner.phase='ready'; f.owner.visiblePage={startScalar:400}; f.owner.ttsFollowPositioning=undefined;
  f.owner.resumeTtsPageFollow(); assert.equal(f.owner.ttsPageFollow.pending(),undefined);
}
{
  const f=fixture(); f.publish(150,{utteranceGeneration:2}); assert.equal(f.calls[0].origin,'ttsFollow');
  f.publish(250,{utteranceGeneration:3}); f.publish(450,{utteranceGeneration:4});
  assert.equal(f.calls.length,1); assert.equal(f.owner.ttsPageFollow.pending().scalar,450);
  f.owner.visiblePage={startScalar:100}; f.owner.pageTurnSettlementActive=false; f.owner.resumeTtsPageFollow();
  assert.equal(f.selections.length,1); assert.equal(f.selections[0][4],450);
  assert.equal(f.calls.length,1,'no intermediate-page catch-up animations');
}
{
  const f=fixture(); let blocked=true;
  f.owner.performPageTurn=(direction,origin)=>{f.calls.push({direction,origin});return {kind:blocked?'blocked':'started'};};
  f.publish(150,{utteranceGeneration:2}); assert.equal(f.owner.ttsPageFollow.pending().scalar,150);
  blocked=false; f.owner.resumeTtsPageFollow(); assert.equal(f.calls.length,2,'rejected request retains retryable target');
}
{
  const f=fixture(); f.owner.pageTurnPreparation={}; f.publish(150,{utteranceGeneration:2});
  assert.equal(f.calls.length,0); f.owner.pageTurnPreparation=undefined; f.owner.resumeTtsPageFollow();
  assert.equal(f.calls.length,1,'preparation completion re-evaluates target');
}
{
  const f=fixture(); f.owner.paginationIndex.findContainingPage=(_k,s)=>s===0?{pageIndex:0}:undefined;
  f.owner.preparedPageTurn=()=>({context:{chapter:{chapterIndex:1}},page:{startScalar:100,endScalar:200}});
  f.publish(150,{utteranceGeneration:2}); assert.equal(f.calls.length,1,'prepared neighbour range is authoritative without index entry');
  assert.equal(f.prepares.length,0);
}
{
  const f=fixture(); f.owner.appForeground=false; f.publish(150,{utteranceGeneration:2}); f.publish(450,{utteranceGeneration:4});
  assert.equal(f.calls.length+f.selections.length,0); f.owner.appForeground=true; f.owner.resumeTtsPageFollow();
  assert.equal(f.selections.length,1); assert.equal(f.selections[0][4],450,'foreground converges only latest position');
}
{
  const f=fixture(); f.owner.pageTurnSettlementActive=true; f.publish(150,{utteranceGeneration:2});
  const saved=f.owner.ttsPageFollow.pending();
  for(const patch of [{sessionGeneration:0,utteranceGeneration:9},{positionGeneration:-1,utteranceGeneration:9},
    {utteranceGeneration:1,chapterIndex:0,chapterKey:'old-chapter'},{utteranceGeneration:2}]) {
    f.owner.ttsPageFollow.offer(f.owner.ttsFollowScope(),{...f.owner.ttsState,charStart:0,...patch});
    assert.equal(f.owner.ttsPageFollow.pending(),saved,'late callback must not clear newer pending');
  }
  f.owner.invalidateTtsPageFollow(); f.owner.pageTurnSettlementActive=false;
  f.publish(150); assert.equal(f.calls.length,0,'manual/reflow invalidation rejects current utterance repeats');
  f.publish(170,{utteranceGeneration:3}); assert.equal(f.calls.length,1,'later speech may follow normally');
}
{
  const f=fixture(); f.owner.visiblePage={startScalar:400};
  f.publish(100,{utteranceGeneration:2}); assert.equal(f.selections.length,0,'normal callbacks cannot rewind visible page');
  f.publish(100,{utteranceGeneration:3,positionGeneration:1});
  assert.equal(f.selections.length,1,'explicit seek authorizes one backward semantic jump');
  assert.equal(f.selections[0][4],100);
}
{
  const f=fixture(); const lease=f.owner.ttsPageFollow.lease(f.owner.ttsFollowScope(),f.owner.ttsState);
  f.owner.pageTurnSettlementActive=true;
  f.owner.selectChapterAnchor(2,0,true,false,undefined,-1,false,false,undefined,lease);
  assert.equal(f.owner.pageTurnPendingChapterSelection.ttsOwner,lease,'cross-chapter deferred selection owns TTS lease');
  f.owner.stopTts(); assert.equal(f.owner.pageTurnPendingChapterSelection,undefined);
  f.owner.pageTurnSettlementActive=false;
  f.owner.selectChapterAnchor(2,0,true,false,undefined,-1,false,false,undefined,lease);
  assert.equal(f.selections.length,0,'stopped lease cannot navigate after the barrier');
  f.owner.pageTurnPendingChapterSelection={chapterIndex:3}; f.owner.stopTts();
  assert.equal(f.owner.pageTurnPendingChapterSelection.chapterIndex,3,'stop cannot erase user directory selection');
}
{
  const f=fixture(); const lease=f.owner.ttsPageFollow.lease(f.owner.ttsFollowScope(),f.owner.ttsState);
  f.owner.sourceId='other-source'; assert.equal(f.owner.isTtsFollowLeaseCurrent(lease),false);
  f.owner.sourceId='source-a'; f.owner.lifecycleToken++; assert.equal(f.owner.isTtsFollowLeaseCurrent(lease),false);
}
{
  const f=fixture(); f.owner.pageTurnSettlementActive=true; f.publish(150,{utteranceGeneration:2});
  const target=f.owner.ttsPageFollow.pending();
  for(let i=0;i<3;i++) f.owner.ttsPageFollow.failed(target);
  assert.equal(f.owner.ttsPageFollow.canAttempt(),false,'repeated failure cannot spin an unbounded retry loop');
  f.publish(150); assert.equal(f.owner.ttsPageFollow.canAttempt(),false,'duplicate callback cannot reset failure budget');
  f.publish(160,{utteranceGeneration:3}); assert.equal(f.owner.ttsPageFollow.canAttempt(),true);
}
console.log('TTS follow production methods: all three baseline defects repaired; latest-target, rejection/retry, unknown-index prepared page, explicit seek, stale callbacks, foreground, source and deferred ownership PASS');
