import {makeIndex,failureChain} from './lib/source-switch-sdk-consumer.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {fixture,settle as settleOwner,deferred,origin,target,session,Runtime,read,gatewayExports,setCurrentRuntime} from './lib/source-switch-owner-probe.mjs';
const {ProductionHost:ReadingEntryHost,setRuntime:setEntryRuntime}=await import('./lib/reading-entry-owner-probe.mjs');
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const {ReaderNativeAlertOwner}=await import('../entry/src/main/ets/app/ReaderNativeAlertOwner.ts');
const {ReadingOfflineHost}=await import('./lib/reader-reading-owner-sdk-probe.mjs');
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
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
 const panel=x.mount(),row=x.rows().find(r=>r.sourceId==='new');assert.ok(row);
 const originalFrame=x.p.walk(panel).find(c=>c instanceof x.p.deps.ReaderBoundedSurface);
 assert.equal(x.p.nodes(originalFrame).find(n=>n.type==='Column').height,385);
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
 const action=x.p.nodes(rendered).find(n=>n.create==='重试核对');assert.ok(action?.onClick);
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
 const f=fixture({shared:true,open:false}),x=makeIndex(f);delete x.index.cleanupRetiredSourceCache;
 const native=f.runtime.request.bind(f.runtime),cleanup=[];
 f.runtime.request=async(method,params,options)=>{
  if(method!=='cache.clear')return native(method,params,options);
  cleanup.push(['Core',params]);if(outcome==='Core-unknown')throw Error('old cache ACK lost');
  return{data:{scope:'book',cacheEntriesRemoved:1,chapterEntriesRemoved:1,queueEntriesRemoved:0,removedContentBytes:2}};
 };
 f.runtime.clearOfflineBookImages=async(sourceId,bookId)=>{cleanup.push(['images',sourceId,bookId]);if(outcome==='platform-failure')throw Error('old cache images unavailable');};
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const tx=f.host.current().pending.transactionId;f.setPhase('finalized');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined,'resource cleanup cannot undo actual source finalization');
 assert.deepEqual(cleanup[0],['Core',{scope:'book',sourceId:'old',bookId:'book'}]);
 const receipt=x.index.getReadingOfflineHost(f.runtime).snapshot();
 assert.equal(receipt.sourceId,'old');assert.equal(receipt.bookId,'book');
 assert.equal(receipt.projection.receipt.confirmation,outcome==='Core-unknown'?'unknown':'confirmed');
 assert.equal(receipt.materialization,outcome==='confirmed'?'succeeded':'failed');
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2);
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2,'repeated canonical notification cannot repeat old-source cleanup');
 checks.push('actual-Index-OffineHost-Gateway-retired-source-'+outcome);
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
console.log(JSON.stringify({status:'PASS',checks,scope:'actual Host/Gateway/full durable intent + unmodified Index delegates/seam + decorated SDK Window/CandidateRow/bounded frame; controlled runtime/native file boundary. Native layout/removal/focus/device remain separate.'}));
