import assert from 'node:assert/strict';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';

const file=relative=>new URL('../entry/src/main/ets/'+relative,import.meta.url);
const JsonForm=productionMotionMethods(file('features/common/JsonImportDialog.ets'),['submitOnlineImport']);
const imported=[],form=Object.assign(new JsonForm(),{urlDraft:'  ',validationMessage:'',onImportOnline:value=>imported.push(value)});
form.submitOnlineImport();assert.deepEqual(imported,[]);assert.equal(form.urlDraft,'  ');assert.match(form.validationMessage,/请输入/);
form.urlDraft='example.test/rules.json';form.submitOnlineImport();assert.deepEqual(imported,[]);assert.equal(form.urlDraft,'example.test/rules.json');
form.urlDraft=' https://example.test/rules.json ';form.submitOnlineImport();assert.deepEqual(imported,['https://example.test/rules.json']);assert.equal(form.urlDraft,' https://example.test/rules.json ');

const Feedback=productionMotionMethods(file('features/source/SourceToolsPage.ets'),['feedbackIdentity','showTransientFeedback']);
const notices=[],page=Object.assign(new Feedback(),{mounted:true,lastFeedbackIdentity:'',snapshot:{busy:false,statusMessage:'刷新失败，保留现有列表',sources:[{sourceId:'original'}],readFacts:{fact:'refreshFailed',hasValue:true,generation:8},batchCheck:{phase:'idle'}},getUIContext:()=>({getPromptAction:()=>({showToast:notice=>notices.push(notice)})})});
page.showTransientFeedback();page.showTransientFeedback();assert.equal(notices.length,1);assert.equal(notices[0].duration,2200);
page.snapshot={...page.snapshot,statusMessage:'原操作尚未确认',receipt:{receipt:{confirmation:'unknown'},facts:{generation:9}}};page.showTransientFeedback();assert.equal(notices.length,1,'true pending is retained by its own action surface');
page.snapshot={...page.snapshot,receipt:undefined,statusMessage:'初次读取失败',sources:[],readFacts:{fact:'failed',hasValue:false,generation:10}};page.showTransientFeedback();assert.equal(notices.length,1,'initial read failure belongs to the page state');
page.snapshot={...page.snapshot,statusEvent:'batch',statusMessage:'批量结果已知',sources:[{sourceId:'original'}],readFacts:{fact:'current',hasValue:true,generation:11},batchCheck:{phase:'completed'}};page.showTransientFeedback();assert.equal(notices.length,1,'the actual batch event stays in its result card');
page.snapshot={...page.snapshot,statusEvent:'feedback',statusMessage:'正在导出的项目已完成保存'};page.showTransientFeedback();assert.equal(notices.length,2,'retained completed batch and old progress-like words cannot suppress a distinct real operation event');
page.mounted=false;page.snapshot={...page.snapshot,statusMessage:'late completion'};page.showTransientFeedback();assert.equal(notices.length,2,'retired page cannot emit feedback');

// Real open(seed) -> Gateway source.list failure -> selection event -> the
// actual SDK retry action -> second source.list failure. A prior state event
// must neither hide this result nor supply its old message to the new Toast.
const source=relative=>readFileSync(file(relative),'utf8');
const ordinary=text=>stripTypeScriptTypes(text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(relative,result,deps={})=>new Function(...Object.keys(deps),ordinary(source(relative))+`;return ${result};`)(...Object.values(deps));
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const readerRecoveryView=load('app/ReaderRecoveryProjection.ts','readerRecoveryView');
let currentOwner;const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),
  ...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),
  ...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource}')};
const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{
  ReaderRuntimeOwner,isReaderCoreTransactionPendingError:()=>false,...helpers});
const SourceToolsOrchestrator=load('features/source/SourceToolsOrchestrator.ets','SourceToolsOrchestrator',{
  SourceGateway,ReaderRuntimeOwner,ReaderWriteEvidence,projectPersistedReceipt,...facts,hilog:{warn(){},error(){},info(){}}});
for(const populated of [true,false]){
  const seeds=populated?[{sourceId:'https://retained.example',name:'保留的书源',baseUrl:'https://retained.example',
    enabled:true,enabledExplore:false,category:'novel'}]:[];
  const errors=['first source.list unavailable','second source.list unavailable https://private.example/?token=secret\nprivate trace'];
  const reads=[],toasts=[],snapshots=[];
  const owner={supportsCoreCapability:()=>false,async request(method){reads.push(method);assert.equal(method,'source.list','retry remains a read, never a source write');throw Error(errors[reads.length-1]);}};
  currentOwner=owner;
  const feedback=Object.assign(new Feedback(),{mounted:true,lastFeedbackIdentity:'',
    getUIContext:()=>({getPromptAction:()=>({showToast:notice=>toasts.push(notice)})})});
  const tools=new SourceToolsOrchestrator(snapshot=>{snapshots.push(snapshot);feedback.snapshot=snapshot;feedback.showTransientFeedback();},()=>true,owner);
  tools.open(seeds);await tools.operationTail;
  const first=snapshots.at(-1);assert.equal(first.readFacts.message,errors[0]);assert.equal(first.receipt,undefined);
  assert.deepEqual(first.sources,seeds);assert.equal(toasts.length,populated?1:0);
  tools.setSelection(populated?[seeds[0].sourceId]:[]);
  const selected=snapshots.at(-1);assert.equal(selected.statusEvent,'state');
  const before=toasts.length,previousSources=structuredClone(selected.sources),previousSelection=selected.selectedSourceIds.slice();
  const sdk=boundedSurfaceSdk(),surface=sdk.consumer(source('features/source/SourceToolsPage.ets'),['recoveryAction','recovery'],{readerRecoveryView});
  Object.assign(surface,{appThemeScheme:'day',snapshot:selected,onReconcile:generation=>tools.reconcile(generation)});
  surface.recoveryAction();
  const retry=sdk.walk(surface).find(child=>child instanceof sdk.deps.ReaderRecoveryAction&&child.label==='刷新列表');
  assert.ok(retry,'the current failed read exposes the actual shared read-only retry action');
  [...retry.nodes.values()].find(node=>node.onClick).onClick();await tools.operationTail;
  const latest=snapshots.at(-1);assert.deepEqual(reads,['source.list','source.list'],'one retry adds exactly one read and no write');
  assert.equal(latest.busy,false);assert.equal(latest.receipt,undefined,'a read failure cannot invent a write receipt');
  assert.equal(latest.readFacts.message,errors[1],'the latest failure facts retain the current distinct error');
  assert.equal(latest.statusEvent,'feedback','the actual failed read publishes its own feedback event');
  assert.deepEqual(latest.sources,previousSources,'read failure preserves the existing list');
  assert.deepEqual(latest.selectedSourceIds,previousSelection,'read failure preserves the existing selection');
  assert.equal(toasts.length,before+(populated?1:0),populated?'the retained-list retry emits one current short feedback':'an initial empty read stays with the page state');
  if(populated){assert.equal(toasts.at(-1).message,'书源刷新失败，已保留现有列表');assert.equal(toasts.at(-1).duration,2200);
    assert.doesNotMatch(toasts.at(-1).message,/已选择|first|https?:|token|trace/,'ordinary feedback does not expose diagnostics or replay selection/old errors');}
  else assert.equal(latest.readFacts.hasValue,false,'empty initial failure remains a PageState failure');
  feedback.showTransientFeedback();assert.equal(toasts.length,before+(populated?1:0),'repainting cannot repeat the current read feedback');
}
// Legacy unknown receipts keep their real readback lifecycle separate from
// confirmation: unknown + reading is still pendingReconciliation, so only the
// explicit status kind supplied by SourceOrchestrator may light the spinner.
for(const [reading,canRetry]of [[true,false],[false,true],[false,false]]){
  const sdk=boundedSurfaceSdk(),surface=sdk.consumer(source('features/source/SourceManagementPage.ets'),
    ['pendingOverlay','recovery'],{readerRecoveryView});let reconciles=0;
  Object.assign(surface,{appThemeScheme:'day',operation:{receipt:projectPersistedReceipt({confirmation:'unknown',
    readback:reading?'reading':'failed',canRetry,generation:13})},statusKind:reading?'loading':'warning',
    pageHeaderHeight:64,contentFrame:()=>({left:17,right:17}),onReconcile:()=>reconciles++});
  surface.pendingOverlay();
  const notice=sdk.walk(surface).find(child=>child instanceof sdk.deps.ReaderRecoveryNotice);
  assert.ok(notice);assert.equal(notice.busy,reading,'busy comes from the actual read lifecycle, never from !canRetry');
  const actor=sdk.walk(notice).find(child=>child instanceof sdk.deps.ReaderRecoveryAction&&child.label==='核对');
  if(reading){assert.ok(actor,'the in-flight check keeps its same labeled action');
    const label=sdk.nodes(actor).find(node=>node.type==='Text'&&node.create==='核对');assert.equal(label.opacity,0);
    assert.ok(sdk.nodes(actor).some(node=>node.type==='LoadingProgress'&&node.width===18&&node.height===18));
    const hit=sdk.nodes(actor).find(node=>node.onClick);assert.equal(hit.enabled,false);hit.onClick();assert.equal(reconciles,0,'busy cannot repeat the check');
  }else if(canRetry){assert.ok(actor);sdk.nodes(actor).find(node=>node.onClick).onClick();assert.equal(reconciles,1);}
  else{assert.equal(actor,undefined,'an unavailable action cannot be misclassified as busy');assert.equal(sdk.nodes(notice).some(node=>node.type==='LoadingProgress'),false);}
}
console.log('PASS JSON validation retains drafts; transient reads deduplicate and respect pending/initial-failure/retired boundaries');
console.log('PASS actual SourceTools open/failed read/selection/SDK retry/current failure: one read, no write, current safe feedback, retained list/selection; empty initial read stays PageState');
console.log('PASS actual SourceManagement pending notice: explicit read lifecycle keeps same action/native18 busy, blocks redispatch; unavailable action stays idle');
