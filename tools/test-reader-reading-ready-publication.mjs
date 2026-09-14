import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as selection from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';

const sourceFile=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const source=readFileSync(sourceFile,'utf8');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const tree=ts.createSourceFile('/tmp/ReaderReadyClasses.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const classNames=['ReadingCommit','CoreReadingAnchor','PreparedReaderPageTurn','ReaderControlSelectionCandidate'];
const classes=Object.fromEntries(classNames.map(name=>{
  const node=tree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.getText(tree)===name);assert.ok(node,name);
  return[name,new Function(stripTypeScriptTypes(node.getText(tree)).replace(/^export /,'')+`;return ${name};`)()];
}));
const methods=['completeFirstPage','reconcileFailedControlSelection','promotePreparedPageTurn',
  'notifyControlSelectionReadingReady','completeControlSelectionAfterCommit','selectionDisplayAnchor',
  'admitCommittedProgress','schedulePageTurnPreparation','prefetchNextChapter','requestPageTurnChapter',
  'isStableVisiblePageOwner','isSelectionCurrent','isMountedToken','isSessionActive','isMeasurementCurrent','resumeDeferredMeasurement'];
const report=[];
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture({file=sourceFile,mode='paged',storedIndex=0,storedOffset=0}={}){
  const events=[],queued=[],logs=[],loads=[];
  const Owner=productionMotionMethods(file,methods,{...selection,...classes,readerPageTransitionUsesPreparedPages:()=>true,
    setTimeout:fn=>{queued.push(fn);return queued.length;},hilog:{error:(...args)=>logs.push(args)}});
  const owner=new Owner(),chapter={chapterIndex:0,chapterTitle:'当前章',sourceId:'s',bookId:'b'},page={startScalar:0,fragments:[{text:'已测量正文'}]};
  const context={chapter,layoutMap:{scalarCount:()=>100},paragraphRanges:[{startScalar:0}]};
  const stored={bookId:'b',chapterIndex:storedIndex,chapterOffset:storedOffset,chapterProgress:storedOffset/100,locationRevision:'r1',updatedAt:1};
  const gate=deferred();let hold=false,rejectWrite=false,writes=0,reads=0;
  const gateway={runProgressCommitSerial:operation=>operation(),resolveAndUpdateProgress:async()=>{
    writes++;if(rejectWrite)throw Error('WRITE_REJECTED');if(hold)await gate.promise;return stored;
  },loadProgress:async()=>{reads++;return{kind:'restored',progress:stored};},
    loadChapter:(_book,index,isCurrent)=>{loads.push({index,isCurrent});return new Promise(()=>{});}};
  Object.assign(owner,{mounted:true,exitRequested:false,lifecycleToken:1,sourceId:'s',bookId:'b',chapter,
    chapterSelectionToken:2,materializedChapterSelectionToken:2,visiblePageSelectionToken:2,
    measurementGeneration:3,measurementSelectionToken:2,phase:'measuring',visibleFragments:[],
    pageTurnGeneration:7,pageTurnRenderRevision:10,pageTurnCurrentSlot:'a',pageTurnChapterLoads:new Set(),
    preferredPageTextureDirection:'next',readerSettingsSnapshot:{navigationMode:mode},
    isKnownControlChapter:()=>true,adjacentChapterIndex:()=>owner.chapter.chapterIndex+1,chapterWindow:{get:()=>undefined},
    activeGateway:()=>gateway,requireChapter:()=>owner.chapter,requireChapterLayoutMap:()=>context.layoutMap,coreLayout:()=>({}),
    captureMaterializedChapterContext:()=>context,currentPaginationKey:()=>({}),paginationLayoutSignature:()=> 'layout',
    restoreMaterializedChapterContext(next){this.chapter=next.chapter;},clearPageTurnProjection(){},
    releaseUnretainedReadingImages(){},isChapterFirstPageStart:()=>true,beginReadingRecordClock(){},finishPageTurnPerf(){},
    cancelFirstPageReadyDeadline(){},cancelFirstPageCompletionDeadline(){},completeRapidPageTurnTransaction(){},
    drainRapidPageTurn(){events.push({type:'rapid'});},onAutoPagePageCommitted(){events.push({type:'auto'});},
    rebuildContinuousFragments(){this.continuousRenderRevision=(this.continuousRenderRevision??0)+1;},setContinuousInitialAnchor(){},
    beginMeasurement(){events.push({type:'remeasure'});this.phase='measuring';this.measurementGeneration++;},
    scheduleTtsPresentationWarmup(){events.push({type:'warmup'});},hideControl(){events.push({type:'hide'});},
    showControlSelectionFailure(_ticket,_error,message){events.push({type:'recoveryMessage',message});},
    controlSelectionOwner:()=>({sourceId:'s',bookId:'b',lifecycleToken:owner.lifecycleToken,selectionToken:owner.chapterSelectionToken,
      controlOpenRevision:4,mounted:owner.mounted,exitRequested:owner.exitRequested,controlVisible:true,controlClosing:false}),
    fail(error){events.push({type:'failure',error:error.message});},errorMessage:error=>error.message,
    onReadingCommitted(){events.push({type:'commitObserver',revision:owner.pageTurnRenderRevision});},
    onChapterCommitted(){events.push({type:'chapterObserver',revision:owner.pageTurnRenderRevision,phase:owner.phase});},
    onReadingReady(){events.push({type:'ready',revision:owner.pageTurnRenderRevision,phase:owner.phase,
      fragments:owner.visibleFragments,slot:owner.pageTurnCurrentSlot,generation:owner.pageTurnGeneration,
      previous:owner.preparedPreviousPage,next:owner.preparedNextPage,continuousRevision:owner.continuousRenderRevision});}});
  const ticket={sourceId:'s',bookId:'b',lifecycleToken:1,selectionToken:2,controlOpenRevision:4,targetChapterIndex:0};
  const display={context,page,visibleScalar:0,continuous:mode==='continuous',layoutSignature:'layout'};
  return{owner,events,logs,queued,loads,page,chapter,context,stored,ticket,display,gate,
    counts:()=>({writes,reads}),hold(){hold=true;},reject(){rejectWrite=true;},
    first:()=>owner.completeFirstPage(page,3,2,1),
    recover(action){owner.phase='loading';owner.pendingControlSelection=ticket;
      owner.pendingControlSelectionOrigin=action==='origin'?display:undefined;
      owner.pendingControlSelectionCandidate=action==='target'?display:undefined;
      return owner.reconcileFailedControlSelection(ticket,Error('UNCERTAIN_WRITE'));},
    promote(direction='next'){
      owner.visiblePage={startScalar:5,fragments:[{text:'原页'}]};owner.visibleFragments=owner.visiblePage.fragments;
      const target={...context,chapter:{...chapter,chapterIndex:1,chapterTitle:'新章'}};
      const prepared=new classes.PreparedReaderPageTurn(direction,page,target,{},0,5,owner.pageTurnGeneration);
      stored.chapterIndex=1;owner.promotePreparedPageTurn(prepared,stored);return prepared;
    }};
}
function expectPublished(f,name){
  const ready=f.events.filter(event=>event.type==='ready');assert.equal(ready.length,1,name);
  assert.ok(ready[0].revision>10,`${name}: publish revision precedes ready`);
  assert.equal(ready[0].phase,'ready',`${name}: ready precedes deferred measurement`);
  assert.equal(ready[0].fragments,f.page.fragments);assert.equal(f.events.some(event=>event.type==='failure'),false);
  assert.ok(f.events.filter(event=>event.type==='commitObserver'||event.type==='chapterObserver').every(event=>event.revision>10));
  return ready[0];
}
for(const mode of ['paged','continuous']){
  const f=fixture({mode});f.hold();f.owner.remeasurePending=true;
  const pending=f.first();await Promise.resolve();assert.equal(f.events.length,0,'pending Core write cannot notify or publish');
  assert.equal(f.owner.pageTurnRenderRevision,10);f.gate.resolve();await pending;
  const ready=expectPublished(f,`first ${mode}`);assert.equal(f.counts().writes,1);
  assert.equal(f.owner.phase,'measuring');assert.equal(f.events.at(-1).type,'remeasure');
  if(mode==='continuous')assert.equal(ready.continuousRevision,1);
  assert.equal(f.loads.length,1);assert.equal(f.loads[0].isCurrent(),true,'prefetch owns final preparation generation');
  f.owner.pageTurnGeneration++;assert.equal(f.loads[0].isCurrent(),false,'a later generation still rejects the old prefetch');
  report.push(`first:${mode}`);
}
for(const action of ['origin','target'])for(const mode of ['paged','continuous']){
  const f=fixture({mode});await f.recover(action);expectPublished(f,`recovery ${action}/${mode}`);
  assert.deepEqual(f.counts(),{writes:0,reads:1},'verified recovery must not rewrite Core');
  assert.equal(f.events.some(event=>event.type==='recoveryMessage'),action==='origin');
  report.push(`recovery:${action}/${mode}`);
}
for(const direction of ['next','previous']){
  const f=fixture();const prepared=f.promote(direction);const ready=expectPublished(f,`promotion ${direction}`);
  assert.equal(ready.slot,'b','final physical slot publishes before ready');
  const reverse=direction==='next'?ready.previous:ready.next;
  assert.ok(reverse);assert.equal(reverse.generation,ready.generation);assert.notEqual(reverse.page,prepared.page);
  assert.equal(f.loads.length,1);assert.equal(f.loads[0].isCurrent(),true);assert.equal(f.counts().writes,0);
  report.push(`promotion:${direction}`);
}
for(const scenario of ['write-reject','anchor-mismatch','obsolete-write']){
  const f=fixture({storedOffset:scenario==='anchor-mismatch'?3:0});
  if(scenario==='write-reject')f.reject();
  if(scenario==='obsolete-write')f.hold();
  const pending=f.first();if(scenario==='obsolete-write'){await Promise.resolve();f.owner.chapterSelectionToken++;f.gate.resolve();}
  await pending;assert.equal(f.events.some(event=>event.type==='ready'),false);assert.equal(f.owner.pageTurnRenderRevision,10);
  assert.equal(f.loads.length,0);assert.equal(f.counts().writes,1);report.push(scenario);
}
for(const path of ['first','recover','promote'])for(const hook of ['commit','chapter','ready','warmup']){
  const f=fixture();const key={commit:'onReadingCommitted',chapter:'onChapterCommitted',ready:'onReadingReady',warmup:'scheduleTtsPresentationWarmup'}[hook];
  f.owner[key]=()=>{throw Error(`synthetic ${hook} observer`);};
  if(path==='first')await f.first();else if(path==='recover')await f.recover('target');else f.promote();
  assert.equal(f.events.some(event=>event.type==='failure'),false,`${path}/${hook}: durable page is not failed by observer`);
  assert.ok(f.logs.length>=1);assert.equal(f.owner.visiblePage,f.page);assert.ok(f.owner.pageTurnRenderRevision>10);
  report.push(`observer-throw:${path}/${hook}`);
}
for(const path of ['first','recover','promote'])for(const hook of ['commit','chapter'])for(const action of ['exit','selection','remeasure']){
  const f=fixture();f.owner[hook==='commit'?'onReadingCommitted':'onChapterCommitted']=()=>{
    if(action==='exit')f.owner.exitRequested=true;else if(action==='selection')f.owner.chapterSelectionToken++;else f.owner.phase='measuring';};
  if(path==='first')await f.first();else if(path==='recover')await f.recover('target');else f.promote();
  assert.equal(f.events.some(event=>event.type==='ready'||event.type==='warmup'||event.type==='rapid'||event.type==='auto'),false);
  assert.equal(f.loads.length,0,'reentrant observer cannot launch work for obsolete ready');report.push(`reentrant:${path}/${hook}/${action}`);
}
// Counterfactuals change only the relevant production order in temporary source,
// exercising the same assertions instead of weakening them to follow the implementation.
const firstNeedle='        this.schedulePageTurnPreparation();\n        this.admitCommittedProgress(stored);';
assert.equal(source.split(firstNeedle).length,2);
const firstMutant=source.replace(firstNeedle,'        this.admitCommittedProgress(stored);')
  .replace('        this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);',
    '        this.prefetchNextChapter(chapter, lifecycleToken, selectionToken);\n        this.schedulePageTurnPreparation();');
const firstFile='/private/tmp/reader-ready-before-first-publication.ets';writeFileSync(firstFile,firstMutant);
const firstBad=fixture({file:firstFile});await firstBad.first();assert.throws(()=>expectPublished(firstBad,'negative first'),/publish revision/);
assert.equal(firstBad.loads[0].isCurrent(),false,'the old order also invalidates its own prefetch');
const recoverNeedle="    this.phase = 'ready';\n    this.schedulePageTurnPreparation();\n    this.admitCommittedProgress(stored);";
assert.equal(source.split(recoverNeedle).length,2);
const recoverMutant=source.replace(recoverNeedle,"    this.phase = 'ready';\n    this.admitCommittedProgress(stored);")
  .replace('      display.page, ticket.selectionToken, ticket.lifecycleToken)) return;\n    this.releaseUnretainedReadingImages();',
    '      display.page, ticket.selectionToken, ticket.lifecycleToken)) return;\n    this.schedulePageTurnPreparation();\n    this.releaseUnretainedReadingImages();');
const recoverFile='/private/tmp/reader-ready-before-recovery-publication.ets';writeFileSync(recoverFile,recoverMutant);
const recoverBad=fixture({file:recoverFile});await recoverBad.recover('origin');assert.throws(()=>expectPublished(recoverBad,'negative recovery'),/publish revision/);
const slotLine="    this.pageTurnCurrentSlot = this.pageTurnCurrentSlot === 'a' ? 'b' : 'a';";
assert.equal(source.split(slotLine).length,2);
const promoteMutant=source.replace(slotLine,'')
  .replace('    this.onAutoPagePageCommitted();\n  }\n\n  private requestPageTurn',
    `    this.onAutoPagePageCommitted();\n${slotLine}\n  }\n\n  private requestPageTurn`);
const promoteFile='/private/tmp/reader-ready-before-slot-publication.ets';writeFileSync(promoteFile,promoteMutant);
const promoteBad=fixture({file:promoteFile});promoteBad.promote();
assert.equal(expectPublished(promoteBad,'negative promotion').slot,'a','negative control exposes the original incomplete slot publication');
report.push('negative:first-order','negative:recovery-order','negative:promotion-slot-order');
console.log(JSON.stringify({passed:true,scenarios:report.length,cases:report,
  boundary:'Unmodified ordinary production methods/classes and selection policy with controlled Core/timer boundaries; explicit owner-publication order, not native delivery/paint or VM transient causation.'}));
