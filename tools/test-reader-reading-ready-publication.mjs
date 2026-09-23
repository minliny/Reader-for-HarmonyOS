import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as selection from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
import { readerTextSelectionEnabled } from '../entry/src/main/ets/features/reading/ReaderTextSelectionPolicy.ts';
import { ReadingSessionProgressOwner } from '../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts';

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
const methods=['publishMeasuredFirstPage','resumeSupersededAppearanceMeasurement','completeFirstPage','reconcileFailedControlSelection','promotePreparedPageTurn',
  'isOrdinaryPageMeasurement','canPresentOrdinaryPage','isChapterFirstPageStart',
  'persistOrdinaryFirstPage','isOrdinaryFirstPagePresentationCurrent','awaitOrdinaryFirstPagePersistence','canTurnPage','readerTextSelectionEnabled',
  'notifyReadingPresentationReady', 'notifyControlSelectionReadingReady','completeControlSelectionAfterCommit','selectionDisplayAnchor',
  'admitCommittedProgress','schedulePageTurnPreparation','prefetchNextChapter','requestPageTurnChapter',
  'isStableVisiblePageOwner','isSelectionCurrent','isMountedToken','isSessionActive','isSelectionActive','isMeasurementCurrent','resumeDeferredMeasurement'];
const report=[];
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function settle(){for(let i=0;i<12;i++)await Promise.resolve();}
function fixture({file=sourceFile,mode='paged',storedIndex=0,storedOffset=0}={}){
  const events=[],queued=[],logs=[],loads=[];
  const Owner=productionMotionMethods(file,methods,{...selection,...classes,readerPageTransitionUsesPreparedPages:()=>true,
    readerTextSelectionEnabled,readerRapidPageTurnHasWork:()=>false,readerTtsSessionBlocksAutoPageStart:()=>false,
    setTimeout:(fn,delay)=>{if(delay===0){queueMicrotask(fn);return 0;}queued.push(fn);return queued.length;},hilog:{error:(...args)=>logs.push(args)}});
  const owner=new Owner(),chapter={chapterIndex:0,chapterTitle:'当前章',sourceId:'s',bookId:'b',images:[]},page={startScalar:0,fragments:[{text:'已测量正文'}]};
  const context={chapter,layoutMap:{scalarCount:()=>100},paragraphRanges:[{startScalar:0}]};
  const stored={bookId:'b',chapterIndex:storedIndex,chapterOffset:storedOffset,chapterProgress:storedOffset/100,locationRevision:'r1',updatedAt:1};
  const gate=deferred();let hold=false,rejectWrite=false,writes=0,reads=0;
  const Serial=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts',import.meta.url),['runProgressCommitSerial']);
  const serial=Object.assign(new Serial(),{progressCommitTail:Promise.resolve()});
  const writeOwners=[];
  const runtime={captureReadingContentValidity:()=>()=>true};
  const persistence=new ReadingSessionProgressOwner(runtime,'s','b',operation=>serial.runProgressCommitSerial(operation));
  const gateway={canPersistPresentedProgress:()=>true,runProgressCommitSerial:operation=>persistence.runSerial(operation),resolveAndUpdateProgress:async(...args)=>{
    writeOwners.push(args.at(-1));writes++;if(rejectWrite)throw Error('WRITE_REJECTED');if(hold)await gate.promise;return stored;
  },loadProgress:async()=>{reads++;return{kind:'restored',progress:stored};},
    prefetchChapter:(_book,index,isCurrent)=>{loads.push({index,isCurrent});return new Promise(()=>{});}};
  gateway.persistPresentedProgress=(_book,title,anchor,layout)=>persistence.persistPresented(title,anchor,layout,{
    read:guard=>gateway.loadProgress('b',guard),write:(title,anchor,layout,guard)=>gateway.resolveAndUpdateProgress('b',title,anchor,layout,guard)});
  gateway.awaitPresentedProgressPersistence=()=>persistence.awaitPersistence();
  Object.assign(owner,{mounted:true,exitRequested:false,lifecycleToken:1,sourceId:'s',bookId:'b',chapter,
    chapterSelectionToken:2,materializedChapterSelectionToken:2,visiblePageSelectionToken:2,
    measurementGeneration:3,measurementSelectionToken:2,measurementCompleting:true,phase:'measuring',visibleFragments:[],
    ordinaryPageMeasurementSelection:-1,paragraphRanges:context.paragraphRanges,
    pageTurnGeneration:7,pageTurnRenderRevision:10,pageTurnCurrentSlot:'a',pageTurnChapterLoads:new Set(),
    preferredPageTextureDirection:'next',readerSettingsSnapshot:{navigationMode:mode,longPressSelectText:true},
    controlVisible:()=>false,pageTurnOwnsReaderInput:()=>false,automaticReadingState:()=>({status:'stopped'}),ttsState:{status:'stopped'},
    isKnownControlChapter:()=>true,adjacentChapterIndex:()=>owner.chapter.chapterIndex+1,chapterWindow:{get:()=>undefined},
    isReaderIdentityCurrent:()=>true,
    activeGateway:()=>gateway,sessionGateway:gateway,requireChapter:()=>owner.chapter,requireChapterLayoutMap:()=>context.layoutMap,coreLayout:()=>({}),
    captureMaterializedChapterContext:()=>context,currentPaginationKey:()=>({}),paginationLayoutSignature:()=> 'layout',
    restoreMaterializedChapterContext(next){this.chapter=next.chapter;this.paragraphRanges=next.paragraphRanges;},clearPageTurnProjection(){},
    releaseUnretainedReadingImages(){},beginReadingRecordClock(){},finishPageTurnPerf(){},
    drainPageTurnPreparationQueue(){},cancelFirstPageReadyDeadline(){},cancelFirstPageCompletionDeadline(){},completeRapidPageTurnTransaction(){},
    drainRapidPageTurn(){events.push({type:'rapid'});},onAutoPagePageCommitted(){events.push({type:'auto'});},
    rebuildContinuousFragments(){this.continuousRenderRevision=(this.continuousRenderRevision??0)+1;},setContinuousInitialAnchor(){},
    beginMeasurement(){events.push({type:'remeasure'});this.phase='measuring';this.paginationIndex.beginMeasurement(2);},
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
  installReaderMeasurementOwner(owner);
  return{owner,events,logs,queued,loads,page,chapter,context,stored,ticket,display,gate,gateway,writeOwners,
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
for (const admission of ['current','no-ticket','selection','lifecycle','chapter','layout','control','source-switch','migration','legacy','continuous']) {
  const f=fixture({mode:admission==='continuous'?'continuous':'paged'});
  Object.assign(f.owner,{ordinaryPageMeasurementSelection:2,ordinaryPageMeasurementLifecycle:1,
    ordinaryPageMeasurementChapter:0,ordinaryPageMeasurementLayout:'layout'});
  if(admission==='no-ticket')f.owner.ordinaryPageMeasurementSelection=-1;
  if(admission==='selection')f.owner.ordinaryPageMeasurementSelection=1;
  if(admission==='lifecycle')f.owner.ordinaryPageMeasurementLifecycle=0;
  if(admission==='chapter')f.owner.ordinaryPageMeasurementChapter=1;
  if(admission==='layout')f.owner.ordinaryPageMeasurementLayout='stale';
  if(admission==='control')f.owner.pendingControlSelection=f.ticket;
  if(admission==='source-switch')f.owner.sourceSwitchTransactionId='transaction';
  if(admission==='migration')f.chapter.positionMigration={status:'migrated'};
  if(admission==='legacy')f.gateway.canPersistPresentedProgress=()=>false;
  assert.equal(f.owner.isOrdinaryPageMeasurement(f.chapter,2,1),admission==='current',admission);
  report.push(`ordinary-measurement-admission:${admission}`);
}
{
  const f=fixture();
  assert.equal(f.owner.isChapterFirstPageStart(0),true);
  f.chapter.documentRange={startScalar:40,endScalar:60,totalScalars:100};
  f.owner.paragraphRanges=[{startScalar:40}];
  assert.equal(f.owner.isChapterFirstPageStart(40),false,'first resident paragraph is not chapter start');
  report.push('title:resident-window-is-not-chapter-start');
}
for(const mode of ['paged','continuous']){
  const f=fixture({mode});f.hold();f.owner.remeasurePending=true;
  const pending=f.first();await settle();assert.equal(f.events.filter(e=>e.type==='ready').length,1,'available body admits reading before Core write');
  assert.equal(f.events.filter(e=>e.type==='commitObserver'||e.type==='chapterObserver').length,0,'durable observers still await storage');
  assert.equal(f.owner.visiblePage,f.page,'cold measured body paints before durable progress');
  assert.equal(f.owner.phase,'ready','measured ordinary body is usable before persistence');
  assert.equal(f.owner.isMeasurementCurrent(3,2,1),false,'the finished measurement owner is no longer the write lease');
  assert.equal(f.owner.canTurnPage(),true,'ordinary initial save does not disable page input');
  assert.equal(f.owner.readerTextSelectionEnabled(),true,'ordinary initial save does not disable text selection');
  assert.equal(f.writeOwners[0](),true,'independent persistence ownership remains valid');
  assert.ok(f.owner.pageTurnRenderRevision>10);f.gate.resolve();await pending;
  const ready=expectPublished(f,`first ${mode}`);assert.equal(f.counts().writes,1);
  assert.equal(f.owner.phase,'measuring');assert.equal(f.events.at(-1).type,'remeasure');
  if(mode==='continuous')assert.equal(ready.continuousRevision,1);
  assert.equal(f.loads.length,1);assert.equal(f.loads[0].isCurrent(),true,'prefetch owns final preparation generation');
  f.owner.pageTurnGeneration++;assert.equal(f.loads[0].isCurrent(),true,'texture generations do not invalidate body-only preparation');
  f.owner.visiblePage={startScalar:3};assert.equal(f.loads[0].isCurrent(),false,'replacing the owning page cancels body preparation');
  report.push(`first:${mode}`);
}
for(const blocker of ['visible','control','source-switch']){
  const f=fixture();f.hold();
  const localSource=`reader-local-epub://${Buffer.from('local:'+'a'.repeat(64)).toString('base64url')}/${Buffer.from('OPS/logo.png').toString('base64url')}`;
  const image={source:localSource,state:'pending',startScalar:0,endScalar:1,intrinsicWidth:357,intrinsicHeight:359};
  f.chapter.images=[image];f.page.fragments.unshift({text:'',startScalar:0,endScalar:1,imageHeight:30});
  const pixelRequests=[];
  f.owner.resolveGeometryImagePixels=(chapter,requested)=>pixelRequests.push([chapter,requested]);
  if(blocker==='visible'){f.owner.visiblePage={startScalar:9,fragments:[{text:'retained'}]};f.owner.visibleFragments=f.owner.visiblePage.fragments;}
  if(blocker==='control')f.owner.pendingControlSelection=f.ticket;
  if(blocker==='source-switch')f.owner.sourceSwitchTransactionId='transaction';
  const previous=f.owner.visiblePage,revision=f.owner.pageTurnRenderRevision;
  const pending=f.first();await Promise.resolve();
  assert.equal(f.owner.visiblePage,previous,`${blocker}: uncommitted target cannot publish`);
  assert.equal(f.owner.pageTurnRenderRevision,revision);assert.equal(f.events.length,0);
  assert.equal(pixelRequests.length,0,'uncommitted control target cannot own late pixels');
  f.gate.resolve();await pending;expectPublished(f,`${blocker}: durable publication`);
  assert.equal(pixelRequests.length,1,`${blocker}: committed image page starts pixels through the shared readiness path`);
  assert.equal(pixelRequests[0][1],image);
  report.push(`first-projection-fence:${blocker}`);
}
for(const action of ['origin','target'])for(const mode of ['paged','continuous']){
  const f=fixture({mode});await f.recover(action);expectPublished(f,`recovery ${action}/${mode}`);
  assert.deepEqual(f.counts(),{writes:0,reads:1},'verified recovery must not rewrite Core');
  assert.equal(f.events.some(event=>event.type==='recoveryMessage'),action==='origin');
  report.push(`recovery:${action}/${mode}`);
}
for(const direction of ['next','previous']){
  const f=fixture();const prepared=f.promote(direction);const ready=expectPublished(f,`promotion ${direction}`);await settle();
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
  await pending;assert.equal(f.events.filter(event=>event.type==='ready').length,1);
  assert.equal(f.events.some(event=>event.type==='chapterObserver'),false,'failed or obsolete persistence cannot confirm chapter');
  assert.equal(f.owner.visiblePage,f.page,'readable body survives failed persistence');
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
  assert.equal(f.events.some(event=>event.type==='rapid'||event.type==='auto'),false);
  assert.equal(f.events.some(event=>event.type==='ready'||event.type==='warmup'),path==='first','ordinary readiness precedes durable reentrant callbacks');
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
const firstBad=fixture({file:firstFile});firstBad.owner.visiblePage={startScalar:9,fragments:[]};await firstBad.first();assert.throws(()=>expectPublished(firstBad,'negative first'),/publish revision/);
// The publication counterfactual still fails above; body-only preparation
// intentionally has no dependency on texture generation changes.
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
for(const outcome of ['old-success','old-failure','unmount-success','unmount-failure']){
  const f=fixture();f.hold();const writing=f.first();await settle();
  const newer={startScalar:50,fragments:[{text:'newer page'}]};
  f.owner.visiblePage=newer;f.owner.visibleFragments=newer.fragments;
  f.owner.chapterSelectionToken++;f.owner.visiblePageSelectionToken=f.owner.chapterSelectionToken;
  const commit={chapterIndex:1,chapterOffset:50};f.owner.lastCommittedProgress=commit;
  f.owner.phase='ready';
  if(outcome.startsWith('unmount')){f.owner.mounted=false;f.owner.lifecycleToken++;}
  assert.equal(f.writeOwners[0](),true,'a component lifecycle change cannot cancel an already displayed position save');
  if(outcome.endsWith('failure'))f.gate.reject(Error('late receipt failure'));else f.gate.resolve();
  await writing;
  assert.equal(f.owner.visiblePage,newer);assert.equal(f.owner.phase,'ready');
  assert.equal(f.owner.lastCommittedProgress,commit,'old ACK cannot roll back a newer admitted position');
  assert.equal(f.events.some(event=>event.type==='failure'),false);report.push(`ordinary-owner:${outcome}`);
}
{
  const f=fixture();f.hold();const writing=f.first();await settle();
  let confirmed=false;const exiting=f.owner.awaitOrdinaryFirstPagePersistence().then(()=>{confirmed=true;});
  await settle();assert.equal(confirmed,false,'normal exit/content boundary retains the pending save');
  f.gate.resolve();await Promise.all([writing,exiting]);assert.equal(confirmed,true);
  assert.equal(f.owner.lastCommittedProgress.chapterOffset,0);report.push('ordinary-owner:normal-exit-waits');
}
console.log(JSON.stringify({passed:true,scenarios:report.length,cases:report,
  boundary:'Unmodified ordinary production methods/classes and selection policy with controlled Core/timer boundaries; explicit owner-publication order, not native delivery/paint or VM transient causation.'}));
