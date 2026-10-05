import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {sourceSwitchLiveSdk} from './lib/source-switch-sdk-consumer.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {fixture,settle,deferred,origin,target,session,rawCandidate,hostSource,Gateway,gatewayExports,read,setCurrentRuntime,ReadingSessionFlowGateway} from './lib/source-switch-owner-probe.mjs';
const checks=[];
const TX='00000000-0000-4000-8000-000000000001/1';
{
  const f=fixture({preview:true,failAcquire:true});await settle();
  const original=f.host.current().scopeId;await f.host.pick(f.candidate(),original);
  assert.equal(f.effects.at(-1).kind,'acquisitionFailed');assert.equal(f.host.current().visible,false);
  const before=f.calls.length;
  assert.equal(f.host.bindReader({...f.context,query:{...f.context.query,bookId:'other'}},f.lease),false);
  assert.equal(f.host.bindReader(f.context,{...f.lease,isCurrent:()=>false}),false);
  assert.equal(f.host.bindReader(f.context,f.lease),true);
  assert.equal(f.calls.length,before,'reader rebind performs no read, acquisition or mutation');
  assert.equal(f.host.current().failureMessage,'body unavailable');
  const rebound=f.host.current().scopeId;assert.notEqual(rebound,original);
  f.host.retryFailed(original);assert.equal(f.calls.length,before,'old failure action cannot borrow the new scope');
  f.options.failAcquire=false;f.host.retryFailed(rebound);await settle();
  assert.equal(f.effects.at(-1).kind,'previewReady','rebound failure keeps the original candidate for explicit retry');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,0);
  const empty=fixture();await settle();assert.equal(empty.host.bindReader(empty.context,empty.lease),false);
  setCurrentRuntime(undefined);assert.equal(f.host.bindReader(f.context,f.lease),false);
  checks.push('failed-acquisition-reader-rebind-exact-identity-scope-no-IO');
}
{
  const f=fixture();await settle();const owner=f.Constructor.forRuntime(f.runtime);
  assert.equal(f.Constructor.forRuntime(f.runtime),owner,'Index remount shares one actual feature owner');
  const successor={...f.runtime};setCurrentRuntime(successor);const next=f.Constructor.forRuntime(successor);
  assert.notEqual(next,owner);assert.throws(()=>f.Constructor.forRuntime(f.runtime),error=>error.kind==='pending');
  assert.equal(f.Constructor.forRuntime(successor),next,'old Runtime must never replace successor cache');
  checks.push('feature-local-exact-Runtime-shared-owner-remount-and-retired-refusal');
}
{
  const f=fixture();await settle();assert.equal(f.host.current().state.kind,'candidates');
  await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.effects.at(-1).chapterIndex,0);
  assert.equal(f.host.currentTransactionId(target),TX);
  assert.equal(JSON.parse(f.disk.durable).operationId,TX,'pending Core lineage keeps full intent across the reader seam');
  const authority=f.intentClasses.SourceSwitchIntentStore.warmIntent;
  await assert.rejects(new f.intentClasses.SourceSwitchIntentStore(f.runtime,new Gateway(f.runtime)).clear(authority),
    error=>error.kind==='blocked','confirmed pending receipt alone cannot clear durable authority');
  assert.equal(JSON.parse(f.disk.durable).operationId,TX);
  assert.equal(f.host.targetCommitted(target,'old-txn'),undefined,'late old transaction cannot clear the current journal');
  f.setPhase('finalized');
  assert.equal(f.host.targetCommitted(target,TX).transactionId,TX);
  assert.equal(f.host.current().pending,undefined);await settle();assert.equal(f.disk.durable,'');
  checks.push('real-discovery-progress-commit-target-seam-and-exact-terminal-release');
}
{
  const gate=deferred(),f=fixture({commitGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.consumeBack(f.host.current().scopeId),true);
  assert.equal(f.host.blocksExit(origin),true);const count=f.effects.length;f.retire();gate.resolve();await work;
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  assert.equal(f.effects.length,count,'late ACK retained by owner without reopening retired reader');checks.push('commit-back-guard-retired-ACK-retained');
}
{
  const gate=deferred(),f=fixture({startGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();f.retire();gate.resolve();await work;
  assert.equal(f.pending().length,0);assert.equal(f.host.current().write.confirmation,'undispatched');checks.push('dispatch-admission-refuses-retired-route');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,0,'matching from/target is not an automatic compensation mandate');
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.blocksExit(origin),true);
  f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'readonly recovery never blindly replays commit');
  f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.effects.at(-1).kind,'targetReady');checks.push('lost-ACK-exact-readonly-confirmation-without-replay-or-compensation');
}
{
  const f=fixture({invalidChapter:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.transactionId,TX);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,0);checks.push('partial-envelope-preserves-opaque-journal-without-false-ACK');
}
{
  const f=fixture({preview:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.effects.at(-1).kind,'previewReady');assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  checks.push('preview-acquisition-keeps-shelf-transaction-unopened');
}
{
  const f=fixture(),scope=f.host.current().scopeId;await settle();const candidate=f.candidate();
  assert.equal(f.host.close(scope),true);assert.equal(f.host.open(f.context,f.lease),true);await settle();
  await f.host.pick(candidate,scope);f.host.refresh(scope);assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  assert.equal(f.host.current().visible,true);assert.equal(f.host.consumeBack(scope),false);checks.push('closed-reopened-scope-rejects-old-callbacks');
}
{
  const gate=deferred(),f=fixture({progressGate:gate});await settle();const work=f.host.pick(f.candidate(),f.host.current().scopeId);
  await settle();f.setIdentity({sourceId:'other',bookId:'book'});gate.resolve();await work;
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);checks.push('book-admission-before-durable-dispatch');
}
{
  const gate=deferred(),f=fixture({relatedGate:gate});await settle();
  f.setRows([{...rawCandidate,bookUrl:'newer'}]);f.publish({reset:false,identities:[{sourceId:'new',bookId:'newer'}]});
  gate.resolve();await settle();assert.equal(f.candidate().bookUrl,'newer');
  f.retire();assert.equal(f.subscriptions.size,0);checks.push('initial-snapshot-dirty-publication-sequence-and-unsubscribe');
}
{
  const f=fixture({throwObserver:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  checks.push('UI-observer-exception-does-not-compensate-confirmed-write');
}
{
  const gate=deferred(),f=fixture();await settle();
  const lane=new ReadingSessionFlowGateway('old','book',{kind:'remote'},f.runtime);
  const preceding=lane.runProgressCommitSerial(async()=>{await gate.promise;});
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  assert.equal(f.calls.some(([method])=>method==='reading.progress.get'),false,'actual per-book producer lane must drain before reading the source anchor');
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  gate.resolve();await preceding;await work;assert.equal(f.host.current().write.confirmation,'confirmed');
  checks.push('same-production-per-book-progress-producer-lane');
}
for(const flag of ['startBeforeEffect','loseLocalSync','loseFinishAck']) {
  const f=fixture({[flag]:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false,'actual local journal ACK must precede Core mutation');
  assert.equal(f.host.current().write.confirmation,'undispatched');assert.equal(f.host.current().write.intentPending,true);
  if(flag==='loseFinishAck')assert.equal(f.disk.failWrites,0,'unknown finish must never call AtomicFile rollback after publication may have occurred');
  const assigned=f.intentClasses.SourceSwitchIntentStore.warmIntent;
  assert.equal(assigned.operationId,TX);assert.equal(assigned.sequence,1);
  f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.deepEqual(f.calls.find(([method])=>method==='source.switch.commit')[1],assigned.params,'retry uses the full originally assigned tuple');
  checks.push(`${flag}-same-fixed-tuple-after-real-journal-ACK`);
}
for(const loseSyncAt of [1,2]) {
  const f=fixture({loseSyncAt});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.intentPending,true);
  const before=f.calls.filter(([method])=>method==='source.switch.commit').length;
  assert.equal(before,loseSyncAt===1?0:1);
  if(loseSyncAt!==1)assert.equal(f.host.current().write.confirmation,'confirmed','ACK/query-confirmed Core result is independent of local confirm/clear lost ACK');
  f.options.loseSyncAt=undefined;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.intentPending,false);assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.equal(JSON.parse(f.disk.durable).phase,'confirmed');checks.push(`local-sync-${loseSyncAt}-lostACK-no-next-sequence-no-Core-duplicate`);
}
{
  const f=fixture({failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.host.current().state.confirmation,'confirmed','saved-but-readback-failed is not rendered as commit failure');
  f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  checks.push('confirmed-write-exact-refresh-failure-independent-facts');
}
{
  const f=fixture({startBeforeEffect:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.options.advanceMissingHead=true;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.intentPending,true);assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  assert.equal(f.intentClasses.SourceSwitchIntentStore.warmIntent.operationId,TX,'head advance cannot reassign an uncertain accepted intent');
  checks.push('advanced-missing-exact-head-is-blocked-with-original-intent');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.retire();const successor={...f.runtime};setCurrentRuntime(successor);f.options.failExactQuery=false;
  const next=new f.Constructor(successor),delivered=[];assert.equal(next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>delivered.push(e)}),true);
  await settle();assert.equal(next.current().write.confirmation,'confirmed');assert.equal(next.current().write.intentPending,false);
  assert.equal(delivered.at(-1).kind,'canonicalReady','a replacement owner reads current canonical shelf rather than activating the old cached session');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('warm-Runtime-handoff-reconciles-fixed-intent-no-old-activation');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const fixed=JSON.parse(f.disk.durable);f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;
  f.disk.published=f.disk.durable;const successor={...f.runtime};setCurrentRuntime(successor);f.options.failExactQuery=false;
  const next=new f.Constructor(successor),effects=[];next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  const exactRead=f.calls.filter(([method,params])=>method==='source.switch.transaction.query'&&params.expected).at(-1);
  assert.deepEqual(exactRead[1].expected,fixed.params,'cold recovery supplies the full original DTO to the Core hash query');
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(effects.at(-1).kind,'canonicalReady');
  assert.equal(JSON.parse(f.disk.durable).params.newToc.length,fixed.params.newToc.length);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('cold-fixed-file-reload-exact-payload-no-replay');
}
{
  const gate=deferred(),f=fixture({syncGate:gate});await settle();
  const oldWork=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  const fixed=f.intentClasses.SourceSwitchIntentStore.warmIntent;assert.ok(fixed);
  f.retire();const successor={...f.runtime};setCurrentRuntime(successor);
  const next=new f.Constructor(successor),effects=[];next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  assert.equal(f.calls.filter(([method,params])=>method==='source.switch.transaction.query'&&params.expected).length,0,'successor cannot read/replace authority while predecessor IO is still unresolved');
  gate.resolve();await oldWork;await settle();assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,0);
  assert.equal(next.current().write.intentPending,true);next.retry(next.current().scopeId);await settle();
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(effects.at(-1).kind,'canonicalReady');
  assert.deepEqual(f.calls.find(([method])=>method==='source.switch.commit')[1],fixed.params);
  checks.push('cross-Runtime-native-IO-tail-retains-same-intent-no-old-dispatch');
}
for(const chapters of [2000,6000]) {
  const longSession={...session,entries:Array.from({length:chapters},(_,index)=>({index,title:index===0?'Chapter 1':`第${index+1}章 长目录原有合法标题`,
    url:`https://target/${index}`,variables:[]}))};
  const f=fixture({targetSession:longSession});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.find(([method])=>method==='source.switch.commit')[1].newToc.length,chapters);
  assert.ok(f.disk.maximumCharacters>8192,'normal complete TOCs exceed the installed SDK Preferences limit');
  assert.equal(JSON.parse(f.disk.durable).params.newToc.length,chapters,'AtomicFile carries complete normal input without a new arbitrary byte cap');
  checks.push(`actual-full-DTO-${chapters}-chapters-retained-through-AtomicFile`);
}
for(const loseSyncAt of [3,4]) {
  const f=fixture({loseSyncAt});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);f.setPhase('finalized');
  f.host.targetCommitted(target,TX);await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.host.current().write.intentPending,true,'terminal confirm/clear lost ACK cannot admit another fixed intent');
  f.options.loseSyncAt=undefined;assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.equal(f.host.current().write.intentPending,false);assert.equal(f.disk.durable,'');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  checks.push(`terminal-sync-${loseSyncAt}-unknown-retains-current-ID-until-exact-clear-ACK`);
}
{
  const f=fixture({readFailure:true});await settle();assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.host.current().write.confirmation,'unknown','unreadable prior authority cannot prove that Core was never sent');
  assert.equal(f.host.current().state.reconcile,true);assert.equal(f.host.close(f.host.current().scopeId),false);
  f.host.retry(f.host.current().scopeId);await settle();assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  checks.push('unreadable-authority-is-not-absent-or-new-write-admission');
}
{
  const f=fixture({loseCommitAck:true,corruptExactIdentity:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.effects.some(e=>e.kind==='targetReady'),false);assert.equal(f.calls.some(([method])=>method==='source.switch.rollback'),false);
  checks.push('another-exact-ID-is-never-confirmation-or-compensation');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);assert.equal(f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease),true);
  f.options.loseRollbackAck=true;await f.host.rollbackPending();await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending,undefined);
  assert.equal(f.effects.at(-1).kind,'rollbackReady');assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1);
  checks.push('reader-seam-rebind-lost-rollback-ACK-exact-phase-no-compensation-replay');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease);
  f.options.loseRollbackAck=true;f.options.failExactQuery=true;await f.host.rollbackPending();await settle();
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().visible,true);
  const fixed=JSON.parse(f.disk.durable);assert.equal(fixed.operationId,TX);assert.equal(fixed.phase,'confirmed');
  f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;const successor={...f.runtime};setCurrentRuntime(successor);
  f.options.failExactQuery=false;const next=new f.Constructor(successor),effects=[];
  next.open({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(next.current().write.action,'rollback');
  assert.equal(effects.at(-1).kind,'rollbackReady');assert.equal(effects.at(-1).book.sourceId,'old');assert.equal(f.disk.durable,'');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1,'cold exact terminal query does not replay rollback');
  checks.push('cold-Runtime-lost-rollback-ACK-retains-original-full-intent');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease);
  const restored=await f.host.prepareNextChoice(f.host.generation);
  assert.equal(restored.sourceId,'old');assert.equal(f.disk.durable,'');assert.equal(f.host.current().pending,undefined);
  assert.equal(f.host.open(f.context,f.lease),true);await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const commits=f.calls.filter(([method])=>method==='source.switch.commit');assert.equal(commits.length,2);
  assert.equal(commits[1][1].sequence,2);assert.notEqual(commits[1][1].operationId,TX);
  const rollbackPosition=f.calls.findIndex(([method])=>method==='source.switch.rollback');
  assert.ok(rollbackPosition<f.calls.findIndex(([method,params])=>method==='source.switch.commit'&&params.sequence===2));
  checks.push('next-choice-actual-old-rollback-exact-terminal-clear-before-next-sequence');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setPhase('rolledBack');f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().write.action,'rollback');
  assert.equal(f.effects.at(-1).kind,'closed','actual startup rollback proof preserves the current original reader');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('startup-rollback-phase-does-not-activate-historical-committed-book');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const source=read('features/source/SourceSwitchWindow.ets'),p=boundedSurfaceSdk();

  const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
  const scope=f.host.current().scopeId;
  const deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
  const owner=p.consumer(source,boundedMembers(source,'SourceSwitchWindow'),deps,{state:f.host.current().state},'SourceSwitchWindow');
  owner.__Repeat=deps.SourceSwitchPanel.prototype.__Repeat;
  owner.onRetry=()=>f.host.retry(scope);owner.onClose=()=>f.host.close(scope);
  f.lease.changed=snapshot=>{owner.updateStateVars({state:snapshot.state,currentSourceId:'old'});p.properties.flush();};
  owner.aboutToAppear();owner.initialRender();const nodes=p.nodes(owner);
  assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='换源结果未确认'));
  assert.equal(nodes.some(node=>node.type==='Text'&&node.create==='换源失败'),false,'unknown Core must not render a failed-commit title');
  const retry=nodes.find(node=>node.type==='Button'&&node.createWithLabel?.[0]==='重试核对');assert.ok(retry?.onClick);
  const originalFrame=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width==='100%'&&node.height==='100%');
  assert.ok(originalFrame,'the approved live picker retains one full-viewport owner');
  assert.equal(p.walk(owner).some(child=>child instanceof p.deps.ReaderBoundedSurface),false,'the full-screen design does not restore the retired 385vp popup');
  const oldRetry=owner.onRetry;f.options.failExactQuery=false;retry.onClick();await settle();p.properties.flush();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.equal([...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width==='100%'&&node.height==='100%').id,originalFrame.id,'actual property updates retain the full-viewport frame');
  assert.equal(f.host.open(f.context,f.lease),true);await settle();oldRetry();await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'old SDK-consumer callback cannot dispatch in the reopened scope');
  checks.push('actual-SDK-Host-to-live-picker-honest-state-recovery-and-old-callback');
}
// Installed SDK parses the full new production owner. Native rendering and
// scheduler/SDK-send proof are separate tiers; this probe does not claim them.
const require=createRequire(import.meta.url),etsRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${etsRoot}/node_modules/typescript`),opts=require(`${etsRoot}/lib/ets_checker.js`).compilerOptions;
for(const name of ['SourceSwitchHost','SourceSwitchGateway','SourceSwitchIntentStore']) {
  const tree=ts.createSourceFile(`/tmp/${name}.ts`,read(`features/source/${name}.ts`),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,opts);
  assert.equal(tree.parseDiagnostics.length,0,`${name} actual installed SDK syntax`);
}
const unsafe=hostSource.replace('if (!current()) return;\n    this.snapshot = { ...this.snapshot, write:',
  'if (!current()) return;\n    if (observed.length === 1) await this.gateway.rollbackSwitch(observed[0].transactionId, current, new ReaderWriteEvidence());\n    this.snapshot = { ...this.snapshot, write:');
assert.notEqual(unsafe,hostSource);
{
  const f=fixture({loseCommitAck:true,failExactQuery:true},unsafe);await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  await f.host.reconcileUnknown(f.host.current().write.generation,{sourceId:'new',bookUrl:'target'});
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1,
    'negative control reproduces the old identity-only automatic rollback on actual Gateway calls');
}
{
  const unsafeScopes=hostSource.replace('scopeId === this.snapshot.scopeId && this.currentLease()', 'this.currentLease()');
  const f=fixture({},unsafeScopes),scope=f.host.current().scopeId;await settle();const candidate=f.candidate();
  f.host.close(scope);f.host.open(f.context,f.lease);await settle();await f.host.pick(candidate,scope);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,
    'negative control proves an old closure can mutate the reopened scope without the actual generation admission');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual full SourceSwitchHost/Gateway/IntentStore + actual progress lane/gateway; installed SDK exported full-viewport picker and actual live-row V1 state/closure propagation; runtime and AtomicFile IO are controlled fixtures; actual OS atomic/fsync, focus and layout remain unverified'}));
