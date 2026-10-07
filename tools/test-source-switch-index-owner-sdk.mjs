import {makeIndex,failureChain,sourceSwitchLiveSdk} from './lib/source-switch-sdk-consumer.mjs';
import {actualCacheAuthorityFixture} from './lib/reading-directory-sdk-consumer.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {fixture,settle as settleOwner,deferred,origin,target,session,Runtime,read,gatewayExports,setCurrentRuntime} from './lib/source-switch-owner-probe.mjs';
const {ProductionHost:ReadingEntryHost,setRuntime:setEntryRuntime}=await import('./lib/reading-entry-owner-probe.mjs');
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const {ReaderNativeAlertOwner}=await import('./lib/reader-native-alert-sdk-probe.mjs');
const {ReadingOfflineHost}=await import('./lib/reader-reading-owner-sdk-probe.mjs');
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
async function waitForRetiredSourceCleanup(host,identity,previousGeneration,outcome){
 const deadline=performance.now()+15_000;
 for(;;){
  const operation=host.snapshot();
  // Idle before admission and a receipt from earlier work are not completion.
  // The mutex remains active through the exact Core receipt and platform step.
  if(operation?.action==='clear'&&operation.sourceId===identity.sourceId&&operation.bookId===identity.bookId&&
    operation.generation>previousGeneration&&['succeeded','failed','retired'].includes(operation.materialization)&&!host.busy())return operation;
  const remaining=deadline-performance.now();
  assert.ok(remaining>0,`retired source cleanup ${outcome} did not reach its terminal operation: ${JSON.stringify({busy:host.busy(),operation})}`);
  await new Promise(resolve=>setTimeout(resolve,Math.min(5,remaining)));
 }
}
const methods=['getSourceSwitchHost','sourceSwitchContext','sourceSwitchLease','applySourceSwitchSnapshot','retireRssPresentation','retireSourceSwitchPresentation',
 'bindSourceSwitchReader','applySourceSwitchEffect','openSourceSwitch','openDetailSourceSwitch','retrySourceSwitch','refreshSourceSwitch',
 'sourceSwitchProbeQuery','knownSearchSourceCandidates','onPickSource','retryFailedSourceSwitch','dismissSourceSwitchFailure','onRollbackSourceSwitch',
 'closeSourceSwitch','performSourceSwitchSeam','resolveReaderSourceSwitchTransaction','reconcilePendingSourceSwitches','currentSourceSwitchTransactionId',
 'nextNavigationGeneration','isCurrentRuntime','openReading','onRemoteSessionReady','installRemoteReadingSession',
 'getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'detailReadableAdmission','detailBookKey','chooseCachedChapterRefresh','showReadingFailure','showIndexAlert',
 'applyReadingCommit','getReadingOfflineHost','cleanupRetiredSourceCache','sourceSwitchOverlayContent'];
const states=['sourceSwitchVisible','sourceSwitchState','sourceSwitchFailureMessage','sourceSwitchScopeId'];
const checks=[];
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 assert.equal(x.index.sourceSwitchState.kind,'candidates');assert.equal(x.index.sourceSwitchScopeId,f.host.current().scopeId);
 const panel=x.mount(),row=x.rows().find(r=>r.candidate.sourceId==='new');assert.ok(row);
 const selectedName=row.candidate.sourceName;
 const originalFrame=[...panel.nodes.values()].find(n=>n.type==='Stack'&&n.width==='100%'&&n.height==='100%');
 assert.ok(originalFrame,'the actual picker follows the confirmed full-viewport layout');
 row.onSelect();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(x.index.route,'reading');assert.equal(x.index.requestedChapterIndex,0);
 assert.equal(x.index.remoteReadingSession.identity.sourceId,'new');assert.equal(x.index.currentSourceSwitchTransactionId(),f.host.current().pending.transactionId);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,1);
 const tx=f.host.current().pending.transactionId;
 for(const bad of [undefined,'old-transaction']){
  x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:bad});
  assert.equal(f.host.current().pending.transactionId,tx);assert.equal(x.index.cleanup.length,0);
 }
 x.index.applyReadingCommit({...origin,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(f.host.current().pending.transactionId,tx);
 f.setPhase('finalized');x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined);assert.equal(x.index.cleanup.length,1);assert.equal(x.index.cleanup[0].fromSourceId,'old');
 assert.equal(x.index.sourceSwitchNamedCandidate.sourceId,'new');
 assert.equal(x.index.sourceSwitchCompletion.sourceName,selectedName,'actual selected source metadata must supply the novel completion name');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(x.index.cleanup.length,1);
 checks.push('actual-Index-Host-Gateway-SDK-candidate-reader-seam-and-exact-finalization');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();const old=x.mount(),scope=x.index.sourceSwitchScopeId;
 old.onClose();assert.equal(f.host.current().visible,false);x.index.openDetailSourceSwitch();await settle();const current=x.mount();
 assert.notEqual(x.index.sourceSwitchScopeId,scope);old.onClose();old.onRetry();old.onRefresh();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().visible,true);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 current.onClose();assert.equal(f.host.current().visible,false);
 checks.push('actual-SDK-detail-overlay-reopen-old-physical-actions-rejected');
}
{
 const f=fixture({shared:true,open:false,loseCommitAck:true,failExactQuery:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(x.index.sourceSwitchState.confirmation,'unknown');
 const rendered=x.mount();assert.ok(x.p.nodes(rendered).some(n=>n.create==='换源结果未确认'));
 const action=x.p.nodes(rendered).find(n=>n.type==='Button'&&n.createWithLabel?.[0]==='重试核对');assert.ok(action?.onClick);
 panel.onClose();assert.equal(f.host.current().visible,true);
 f.options.failExactQuery=false;action.onClick();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.rollback').length,0);
 checks.push('actual-unknown-title-reads-exact-recovery-without-second-commit');
}
{
 const gate=deferred(),f=fixture({shared:true,open:false,commitGate:gate}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.consumeBack(x.index.sourceSwitchScopeId),true);assert.equal(f.host.current().visible,true);
 x.index.nextNavigationGeneration();x.index.detailBook={sourceId:'other',bookId:'other'};gate.resolve();await settle();
 assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.targetSourceId,'new');
 assert.equal(x.index.detailBook.sourceId,'other');assert.equal(x.index.sourceSwitchVisible,false);
 checks.push('retired-navigation-keeps-accepted-ACK-without-late-reader-navigation');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const old=x.mount();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(x.index.route,'reading');assert.equal(x.index.readingSessionActive,true);assert.equal(x.index.sourceSwitchFailureMessage,'body unavailable');
 const oldScope=old.owner.sourceSwitchScopeId;const scope=x.index.sourceSwitchScopeId;
 assert.equal(f.host.current().scopeId,scope);const calls=f.calls.length;x.index.retryFailedSourceSwitch(oldScope-1);assert.equal(f.calls.length,calls);
 f.options.failAcquire=false;x.index.retryFailedSourceSwitch(scope);await settle();assert.ok(x.index.effects.some(e=>e.validated));
 checks.push('detail-acquisition-failure-mounts-reader-with-live-explicit-recovery-scope');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 const originalScope=x.index.sourceSwitchScopeId;const old=x.mount();
 x.index.retireSourceSwitchPresentation();const successor=makeIndex(f,{navigation:5});successor.index.openDetailSourceSwitch();await settle();
 const scope=successor.index.sourceSwitchScopeId;assert.notEqual(scope,originalScope);
 x.index.retireSourceSwitchPresentation();assert.equal(f.host.current().visible,true,'old detach must not retire a successor presentation');
 old.onClose();assert.equal(f.host.current().visible,true);
 setCurrentRuntime(undefined);successor.index.openSourceSwitch();successor.index.onPickSource(f.candidate(),scope);await settle();
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('same-Runtime-successor-lease-old-detach-and-runtime-unavailable');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const chain=failureChain(x),old=chain.render(),oldScope=x.index.sourceSwitchScopeId;
 x.index.nextNavigationGeneration();x.index.bindSourceSwitchReader(f.host);assert.notEqual(x.index.sourceSwitchScopeId,oldScope);
 chain.o.updateStateVars({sourceSwitchScopeId:x.index.sourceSwitchScopeId,sourceSwitchFailureMessage:x.index.sourceSwitchFailureMessage});
 const count=f.calls.length;old.retry();old.dismiss();await settle();assert.equal(f.calls.length,count);assert.equal(f.host.current().failureMessage,'body unavailable');
 f.options.failAcquire=false;chain.render().retry();await settle();assert.ok(x.index.effects.some(e=>e.validated));
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,2);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-Index-ReaderShell-retained-ReadingExperience-failure-lexical-scope-recovery');
}
for(const outcome of ['confirmed','platform-failure','Core-unknown']){
 const f=fixture({shared:true,open:false}),cacheAuthority=await actualCacheAuthorityFixture(true),x=makeIndex(f,{cacheAuthority});delete x.index.cleanupRetiredSourceCache;
 // Real isolated sandbox IO and actual cold Core receipts replace the obsolete
 // bare cache.clear stub; SourceSwitch keeps its existing controlled RPC seam.
 f.runtime.getUIAbilityContext=()=>({filesDir:cacheAuthority.files});
 const native=f.runtime.request.bind(f.runtime),cleanup=[];
 const admission=outcome==='confirmed'?{entered:deferred(),gate:deferred()}:undefined;
 if(admission){cacheAuthority.options.pauseMethod='cache.clear.operation.query';cacheAuthority.options.gate=admission.gate;}
 if(outcome==='Core-unknown')cacheAuthority.options.beforeMethod='cache.clear';
 f.runtime.request=async(method,params,options)=>{
  if(!method.startsWith('cache.clear'))return native(method,params,options);
  if(method==='cache.clear')cleanup.push(['Core',params]);
  const request=cacheAuthority.runtime.request(method,params,options);
  if(method==='cache.clear.operation.query'&&Object.keys(params).length===0)admission?.entered.resolve();
  return request;
 };
 f.runtime.clearOfflineBookImages=async(sourceId,bookId)=>{cleanup.push(['images',sourceId,bookId]);if(outcome==='platform-failure')throw Error('old cache images unavailable');};
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());
 for(let i=0;i<200&&x.index.detailBook.sourceId!=='new';i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(x.index.detailBook.sourceId,'new','actual accepted source seam completes before visible reading commit');
 assert.equal(f.host.current().write.confirmation,'confirmed');
 const tx=f.host.current().pending.transactionId;f.setPhase('finalized');
 const offline=x.index.getReadingOfflineHost(f.runtime),previousGeneration=offline.snapshot()?.generation??0;
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});
 let completed=false;
 const completion=waitForRetiredSourceCleanup(offline,origin,previousGeneration,outcome).then(receipt=>{completed=true;return receipt;});
 if(admission){
  try{
   await Promise.race([admission.entered.promise,completion]);
   assert.equal(offline.busy(),true,'actual cleanup owns its mutex before cold Core admission completes');
   assert.equal(offline.snapshot().materialization,'running');
   assert.equal(cleanup.length,0,'the actual head query precedes the durable cache.clear dispatch');
   await settle();
   assert.equal(completed,false,'a pending admission cannot satisfy the terminal cleanup wait');
  }finally{admission.gate.resolve();}
 }
 const receipt=await completion;
 assert.equal(f.host.current().pending,undefined,'resource cleanup cannot undo actual source finalization');
 assert.equal(cleanup[0][0],'Core');assert.equal(cleanup[0][1].scope,'book');assert.equal(cleanup[0][1].sourceId,'old');assert.equal(cleanup[0][1].bookId,'book');
 assert.match(cleanup[0][1].operationId,/\/1$/);assert.equal(cleanup[0][1].sequence,1,'actual mandatory authority supplies one exact bounded original identity');
 assert.equal(receipt.sourceId,'old');assert.equal(receipt.bookId,'book');
 assert.equal(receipt.projection.receipt.confirmation,outcome==='Core-unknown'?'unknown':'confirmed');
 assert.equal(receipt.materialization,outcome==='confirmed'?'succeeded':'failed');
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2);
 if(outcome!=='Core-unknown')assert.ok(cacheAuthority.calls.some(c=>c.method==='cache.clear.operation.query'),'actual qualified receipt read precedes platform cleanup');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2,'repeated canonical notification cannot repeat old-source cleanup');
 checks.push('actual-Index-OffineHost-atomic-store-cold-Core-retired-source-'+outcome);
}
// The retained reading identity includes readyGeneration, while only the small
// temporary source overlay is keyed by the source owner scope.
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f,{reading:true});x.index.openSourceSwitch();await settle();
 const s=x.p.consumer(read('features/shell/ReaderShell.ets'),['sourceSwitchScopeId','sourceSwitchOverlayContent'],x.leafDeps,{sourceSwitchScopeId:x.index.sourceSwitchScopeId});
 Object.assign(s,{sourceId:'old',sourceSwitchState:x.index.sourceSwitchState,onCloseSourceSwitch:id=>x.index.closeSourceSwitch(id),
   onRetrySourceSwitch:id=>x.index.retrySourceSwitch(id),onRefreshSourceSwitch:id=>x.index.refreshSourceSwitch(id),
   onPickSource:(c,id)=>x.index.onPickSource(c,id),onRollbackSourceSwitch:id=>x.index.onRollbackSourceSwitch(id)});
 s.sourceSwitchOverlayContent();const old=x.p.walk(s).find(c=>c instanceof x.leafDeps.SourceSwitchPanel);old.onClose();
 x.index.openSourceSwitch();await settle();s.sourceSwitchScopeId=x.index.sourceSwitchScopeId;s.sourceSwitchState=x.index.sourceSwitchState;
 s.sourceSwitchOverlayContent();old.onClose();old.onSelectCandidate(f.candidate());await settle();assert.equal(f.host.current().visible,true);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-ReaderShell-overlay-oldscope-preserved-without-reader-tree-remount');
}
// A target source commit still needs the real reader's body, selected physical
// page and canonical progress admission. The UI must follow these facts, and
// must relinquish its surface to the existing reader error on any failure.
{
 const source=read('features/reading/LocalReadingExperience.ets');
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const make=fields=>{
  const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
  const o=p.consumer(source,['sourceSwitchTransactionId','phase','visibleFragments','sourceSwitchFailureMessage','reduceMotion','onSessionLaunchReduceMotionChanged',
    'shouldShowSourceSwitchPreparation','sourceSwitchPreparationContent',
    'sourceSwitchCompletion','readingReadyGeneration','sourceSwitchCompletionVisible','sourceSwitchRevealOpacity','sourceSwitchToastText',
    'sourceSwitchCompletionEpoch','sourceSwitchRevealAnimator','sourceSwitchToastTimer','consumedSourceSwitchCompletions',
    'sourceSwitchPendingCompletionKey','sourceSwitchPendingCompletionSelectionToken','sourceSwitchPendingCompletionLifecycleToken',
    'sourceSwitchPresentedRevision','sourceSwitchPresentedSelectionToken','sourceSwitchPresentedContinuous',
    'sourceSwitchCanonicalPageCurrent','onSourceSwitchPagePresented','hasContinuousRenderContent',
    'sourceSwitchCompletionKey','sourceSwitchCompletionCurrent','finishSourceSwitchReveal','cancelSourceSwitchCompletion',
    'sourceSwitchCompletionVisibleChanged','sourceSwitchCompletionChanged'],deps);
  Object.assign(o,{sourceSwitchTransactionId:'tx',phase:'loading',visibleFragments:[],visiblePage:undefined,
    sourceSwitchFailureMessage:'',visiblePageSelectionToken:-1,chapterSelectionToken:2,sessionGateway:undefined,
    isReaderIdentityCurrent:()=>true,sourceName:'新书源',chapterTitle:'第 20 章',chapter:undefined,reduceMotion:false,
    sourceId:'new',bookId:'target',mounted:true,exitRequested:false,appForeground:true,readingReadyGeneration:1,lifecycleToken:1,
    sourceSwitchCompletionVisible:true,materializedChapterSelectionToken:-1,pageTurnRenderRevision:2,
    continuousRenderRevision:4,continuousFragments:[],readerSettingsSnapshot:{navigationMode:'paged'},
    windowChromeActive:true,readerWindowMetricsRevision:1,readerStatusBarMetrics:()=>metrics,...fields});
  return{p,o,deps};
 };
 for(const fields of [{},
  {phase:'measuring',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:1,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sourceSwitchTransactionId:undefined,sessionGateway:{hasPendingSourceSwitch:()=>true}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),true,'real preparation retains the surface before the current physical page');
 for(const fields of [{sourceSwitchTransactionId:undefined},
  {phase:'failed'}, {sourceSwitchFailureMessage:'目录读取失败'}, {isReaderIdentityCurrent:()=>false},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:2,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sessionGateway:{hasPendingSourceSwitch:()=>false}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),false,'failure, retired owner, ready selected page and canonical completion relinquish preparation');
 const x=make({chapter:{chapterTitle:'准确章节 第 20 章'}});x.o.sourceSwitchPreparationContent();
 const progress=x.p.walk(x.o).find(c=>c instanceof x.deps.SourceSwitchProgress);assert.ok(progress);
 assert.equal(progress.sourceName,'新书源');assert.equal(progress.chapterTitle,'准确章节 第 20 章');
 assert.equal(progress.statusText,'正在载入章节…');assert.ok(x.p.nodes(progress).some(n=>n.create==='正在切换书源'));
 const spinner=x.p.walk(progress).find(c=>c instanceof x.deps.SourceSwitchSpinner);assert.ok(spinner);
 const ring=x.p.nodes(spinner).find(n=>n.type==='Shape');assert.equal(ring.width,36);assert.equal(spinner.shouldAnimate(),true);
 assert.equal(spinner.durationMs,1800);assert.equal(x.p.nodes(spinner).filter(n=>n.type==='Path').length,2);
 spinner.foreground=false;x.p.properties.flush();assert.equal(spinner.shouldAnimate(),false,'background pauses the actual SVG animator');assert.equal(ring.rotate.angle,0);
 spinner.foreground=true;spinner.reduceMotion=true;x.p.properties.flush();assert.equal(spinner.shouldAnimate(),false,'reduced motion keeps the real loading surface static');assert.equal(ring.rotate.angle,0);
 const ready=make({phase:'ready',chapter:{sourceId:'new',bookId:'target',chapterIndex:19,chapterTitle:'第 20 章',content:'当前章节真实正文'},
   visiblePage:{startScalar:0},visibleFragments:[{text:'当前章节真实正文',imageHeight:0}],visiblePageSelectionToken:2,
   materializedChapterSelectionToken:2});
 ready.o.sourceSwitchCompletion=new ready.deps.SourceSwitchCompletionPresentation('tx','new','target',1,'新书源',19,0);
 ready.p.properties.flush();
 assert.equal(ready.o.sourceSwitchToastText,'','phase ready without the resident revision cannot announce success');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision-1);
 assert.equal(ready.o.sourceSwitchToastText,'','the prior native page revision cannot announce this chapter');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision);
 assert.equal(ready.o.sourceSwitchToastText,'已切换至 新书源','real production canonical and current-revision guards admit completion');
 ready.o.cancelSourceSwitchCompletion();
 checks.push('actual-target-reader-prepare-current-selection-ready-failure-stale-prop-foreground-reduced-motion');
}
// Exercise the metadata and overlay host on the actual SDK-emitted builders.
// Controlled child ports capture their real payloads; they do not imitate the
// source transaction, native sheet layout or its transition scheduling.
{
 class ChildPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
 }
 const panelSource=read('features/reading/SourceSwitchPanel.ets'),shellSource=read('features/shell/ReaderShell.ets');
 const windowSource=read('features/source/SourceSwitchWindow.ets'),indexSource=read('pages/Index.ets');
 const capture=(source,names,childName,childSource,fields)=>{
  const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metricsApi.createDefaultReaderWindowMetrics()}});p.hooks.childSources[childName]=childSource;
  const o=p.consumer(source,names,{...deps,[childName]:ChildPort});Object.assign(o,fields);
  return{p,o,child:()=>[...o.children.values()].find(c=>c instanceof ChildPort)};
 };
 const book={sourceId:'old',bookId:'book',title:'书名',author:'作者',sourceName:'当前书源',coverUrl:'cover',lastChapter:'最新章节 第 120 章'};
 const expectedCurve={kind:'cubic-bezier',values:[0.2,0.7,0.2,1]};
 const assertScrim=(probe,contentKind,scheme,reduceMotion)=>{
  const nodes=probe.p.nodes(probe.o).filter(n=>n.type==='Stack'&&typeof n.onClick==='function');
  assert.equal(nodes.length,1,'the real overlay has one dismissing scrim');
  const scrim=nodes[0];
  const expectedColor=contentKind==='manga'?(scheme==='day'?'#40FFFFFF':'#402C2824'):
    (scheme==='day'?'#731F1B17':'#52000000');
  assert.equal(scrim.backgroundColor,expectedColor,'detail and retained reader share the selected novel scrim palette; manga preserves its palette');
  assert.equal(scrim.width,'100%');assert.equal(scrim.height,'100%');
  if(contentKind==='manga'||reduceMotion){
   assert.equal(scrim.transition.kind,'identity','manga and reduced motion preserve a static scrim');
  }else{
   assert.equal(scrim.transition.kind,'asymmetric');
   for(const [phase,duration] of [['appear',320],['disappear',280]]){
    const effect=scrim.transition.parameters[phase];
    assert.equal(effect.kind,'opacity');
    assert.equal(effect.options.duration,duration,'the scrim uses the selected drawer transition duration');
    assert.deepEqual(effect.options.curve,expectedCurve,'both hosts use the selected shared cubic curve');
   }
  }
 };
 for(const contentKind of ['text','manga'])for(const scheme of ['day','night'])for(const reduceMotion of [false,true]){
  const i=capture(indexSource,['sourceSwitchOverlayContent'],'SourceSwitchPanel',panelSource,{
   detailBook:{...book,contentKind},directoryChapterTitle:'正在阅读 第 20 章',sourceSwitchScopeId:7,
   sourceSwitchState:{kind:'candidates',candidates:[]},appThemeScheme:scheme,settingsSnapshot:{reduceMotion},
   canCancelMangaSourcePreparation:()=>false,readerOwnsWindowEdges:()=>false,
  });
  i.o.sourceSwitchOverlayContent();assert.equal(i.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(i.child().params.currentChapterTitle,'正在阅读 第 20 章','the current reading chapter never replaces latest metadata');
  const expectedAlignment=contentKind==='manga'?'Alignment.Center':'Alignment.Bottom';
  assert.ok(i.p.nodes(i.o).some(n=>n.type==='Stack'&&n.create?.alignContent===expectedAlignment));
  assertScrim(i,contentKind,scheme,reduceMotion);
  const s=capture(shellSource,['sourceSwitchOverlayContent'],'SourceSwitchPanel',panelSource,{
   contentKind,bookTitle:book.title,bookAuthor:book.author,bookCoverUrl:book.coverUrl,sourceName:book.sourceName,
   sourceId:book.sourceId,latestChapterTitle:book.lastChapter,directoryChapterTitle:'正在阅读 第 20 章',
   sourceSwitchScopeId:7,sourceSwitchState:i.o.sourceSwitchState,appThemeScheme:scheme,reduceMotion,
  });
  s.o.sourceSwitchOverlayContent();assert.equal(s.child().params.latestChapterTitle,book.lastChapter);
  assert.ok(s.p.nodes(s.o).some(n=>n.type==='Stack'&&n.create?.alignContent===expectedAlignment));
  assertScrim(s,contentKind,scheme,reduceMotion);
  assert.equal(i.child().params.reduceMotion,reduceMotion);assert.equal(s.child().params.reduceMotion,reduceMotion);
  const panel=capture(panelSource,boundedMembers(panelSource),'SourceSwitchWindow',windowSource,s.child().params);
  panel.o.initialRender();assert.equal(panel.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(panel.child().params.currentChapterTitle,'正在阅读 第 20 章');
 }
 // Select the exact Index -> retained ReaderShell payload rather than a test
 // copy, to catch mistakes between the book field and the shell property.
 const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
 const ts=require(sdk+'/node_modules/typescript'),tree=ts.createSourceFile('/tmp/SourceSwitchMetadataBridge.ets',indexSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
 let call;const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(tree)==='ReaderShell')call=n;ts.forEachChild(n,visit);};visit(tree);
 const names=new Set(['latestChapterTitle','bookTitle','bookAuthor','bookCoverUrl','sourceName','sourceId','contentKind']);
 const fields=call.arguments[0].properties.filter(f=>names.has(f.name?.getText(tree))).map(f=>f.getText(tree));assert.equal(fields.length,names.size);
 const carrier=capture('@Component struct SourceMetadataPayload {@Builder payload(){ReaderShell({'+fields.join(',')+'});}build(){Column(){}}}',
  ['payload'],'ReaderShell',shellSource,{detailBook:book,readingContentKind:'text'});
 carrier.o.payload();assert.equal(carrier.child().params.latestChapterTitle,book.lastChapter);
 carrier.o.detailBook={...book,lastChapter:undefined};carrier.o.replay();assert.equal(carrier.child().params.latestChapterTitle,'','missing latest metadata stays empty');
 checks.push('actual-Index-ReaderShell-Panel-latest-chapter-payload-and-novel-drawer-manga-host-isolation');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual Host/Gateway/full durable intent + Index delegates/seam + SDK Window/LiveRow and metadata/drawer host builders; controlled runtime/native file boundary. Native layout/removal/focus/device remain separate.'}));
