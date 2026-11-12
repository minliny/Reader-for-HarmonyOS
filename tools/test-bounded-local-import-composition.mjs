import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"picker-admission": {"description": "真实文件选择busy/current/关闭", "resources": []}, "result-receipts": {"description": "真实result DTO/Watch和late animation归属", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {boundedSurfaceSdk,boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {pureModuleProbe} = await import('./lib/ets-pure-module-probe.mjs');
const {selectedProductionValues} = await import('./lib/selected-production-methods.mjs');
const horizontal = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const {localImportResultLayout} = await import('../entry/src/main/ets/features/bookshelf/ui/LocalImportLayout.ts');

const source=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/LocalImportDialog.ets',import.meta.url),'utf8');
const {LOCAL_IMPORT_FILE_FOCUS_ID}=selectedProductionValues(new URL('../entry/src/main/ets/features/bookshelf/ui/LocalImportDialog.ets',import.meta.url),['LOCAL_IMPORT_FILE_FOCUS_ID']);
const frameSource=readFileSync(new URL('../entry/src/main/ets/ui/surfaces/ReaderBoundedSurface.ets',import.meta.url),'utf8');
const resolverSource=readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',import.meta.url),'utf8');
const {readerSurfaceMaxHeight}=pureModuleProbe(resolverSource,'ReaderSurfaceResolvers.ts',{},['readerSurfaceMaxHeight']);
const feedbackSource=readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts',import.meta.url),'utf8');
const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
const props=o=>({state:o.state,batch:o.batch,reduceMotion:o.reduceMotion,failureMessage:o.failureMessage,originalPending:o.originalPending,recovery:o.recovery,selectionEnabled:o.selectionEnabled,selectionBlockedMessage:o.selectionBlockedMessage});
function mount(params={},options={},input=source,viewportHeight=0){
  const p=boundedSurfaceSdk(options),animations=[],feedback=[];let now=0;
  const storage=new Map();
  const AppStorage={get:key=>storage.get(key),setOrCreate:(key,value)=>{
    storage.set(key,value);
    if(key==='readerTransientToast'&&value.visible)feedback.push(value.message);
  }};
  const feedbackDeps=pureModuleProbe(feedbackSource,'ReaderTransientFeedback.ts',{AppStorage},['ReaderTransientFeedback','READER_FEEDBACK_BRIEF_MS']);
  const o=p.consumer(input,boundedMembers(input),{...horizontal,...metricsApi,...feedbackDeps,localImportResultLayout,readerSurfaceMaxHeight,LOCAL_IMPORT_FILE_FOCUS_ID,
    ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts(){},readerMotionNowMs:()=>now,
    BorderStyle:{Dashed:'BorderStyle.Dashed'},Curve:{Linear:'Curve.Linear'},curves:{cubicBezierCurve:(...values)=>values},
    uiContext:{animateTo:(options,work)=>{animations.push(options);work();}}}, {state:'fileSelection',reduceMotion:true,...params});
  o.viewportHeight=viewportHeight;o.aboutToAppear();o.initialRender();return{p,o,animations,feedback,clock:n=>now=n};
}
if(selectedCase==='picker-admission') {
{
  const {p,o}=mount({failureMessage:'select failed'});let choose=0,close=0;o.onSelectFiles=()=>choose++;o.onClose=()=>close++;
  const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface);
  const chooseActor=p.walk(o).find(x=>x instanceof p.deps.ReaderRecoveryAction&&x.label==='选择文件');
  const cancelActor=p.walk(o).find(x=>x instanceof p.deps.ReaderRecoveryAction&&x.label==='取消');
  const native=[...frame.nodes.values()].find(n=>n.type==='Column');assert.equal(native.width,o.panelFrame().width);
  const chooseAction=[...chooseActor.nodes.values()].find(n=>n.onClick),cancelAction=[...cancelActor.nodes.values()].find(n=>n.onClick);
  assert.equal(chooseAction.constraintSize.minHeight,44);chooseAction.onClick();assert.equal(choose,1);cancelAction.onClick();assert.equal(close,1);
  const label=[...chooseActor.nodes.values()].find(n=>n.create==='选择文件'),message=p.nodes(o).find(n=>n.create==='select failed');assert.ok(label&&message);
  o.updateStateVars({...props(o),state:'pickerOpening',failureMessage:'next selection error'});p.properties.flush();
  assert.equal(label.create,'选择文件','busy preserves the reviewed action label');assert.equal(chooseAction.enabled,false);chooseAction.onClick();assert.equal(choose,1,'retained direct click checks live admission');assert.equal(message.create,'next selection error');assert.ok(p.walk(o).includes(frame));
  o.updateStateVars({...props(o),state:'fileSelection',selectionEnabled:false,selectionBlockedMessage:'上次导入仍在处理中'});p.properties.flush();
  assert.equal(chooseAction.enabled,false);assert.equal(label.create,'选择文件');assert.equal(message.create,'上次导入仍在处理中');
  chooseAction.onClick();assert.equal(choose,1);cancelAction.onClick();assert.equal(close,2,'closing the surface remains available');
  const drop=p.nodes(o).find(n=>n.onClick&&n.border?.style==='BorderStyle.Dashed');assert.ok(drop);
  assert.equal(drop.type,'Button');assert.equal(drop.id,'reader-local-import-file-selection');
  assert.equal(drop.width,'100%');assert.equal(drop.padding,0);assert.equal(drop.border.width,2);assert.equal(drop.borderRadius,14);
  assert.equal(drop.enabled,false);drop.onClick();assert.equal(choose,1);
  const fileLabel=p.nodes(o).find(n=>n.type==='Text'&&n.create==='从系统文件中选择');assert.ok(fileLabel);assert.equal(fileLabel.onClick,undefined);
  o.updateStateVars({...props(o),selectionEnabled:true,selectionBlockedMessage:''});p.properties.flush();chooseAction.onClick();assert.equal(choose,2);
  let admitted;o.onSelectFiles=current=>{choose++;admitted=current;};drop.onClick();assert.equal(choose,3);assert.equal(admitted(),true);
  o.foreground=false;o.onForegroundChanged();drop.onClick();assert.equal(choose,3);assert.equal(admitted(),false,'queued picker lease retires on background');
  o.foreground=true;o.onForegroundChanged();drop.onClick();assert.equal(choose,4);assert.equal(admitted(),true);
  o.viewportWidth=320;p.properties.flush();assert.equal(native.width,o.panelFrame().width);
  o.aboutToDisappear();drop.onClick();assert.equal(choose,4);assert.equal(admitted(),false,'unmount retires file selection lease');
  const reopened=mount();assert.equal(reopened.o.state,'fileSelection');assert.equal(reopened.o.mounted,true);
}

}
if(selectedCase==='result-receipts') {
{
  const recovery={message:'保存结果待确认',visible:true,canRetry:true,generation:7};
  const {p,o}=mount({state:'importing',batch:undefined,recovery,selectionEnabled:false,originalPending:true},{allowEmptyBranchAdmission:true});let close=0,reconcile=[];o.onClose=()=>close++;o.onReconcile=g=>reconcile.push(g);
  const shell=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-progress');
  const shellNative=[...shell.nodes.values()].find(n=>n.type==='Stack');assert.ok(Number.isFinite(shellNative.height));
  assert.equal(p.walk(o).some(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-result-content'),false);
  o.updateStateVars({...props(o),state:'result',batch:{items:[],imported:0}});p.properties.flush();
  const result=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-result-content');
  const footer=p.walk(o).find(x=>x instanceof p.deps.ReaderRecoveryAction&&x.label==='完成');
  assert.ok(shell&&result&&footer);const resultNative=[...result.nodes.values()].find(n=>n.type==='Column');
  assert.equal(resultNative.backgroundColor,undefined,'transparent result does not duplicate persistent shell');assert.equal(resultNative.shadow,undefined);
  assert.equal(o.resultOpacity,1);assert.equal(o.importingOpacity,0);assert.equal(shellNative.height,o.resultPanelHeight());assert.ok(p.walk(o).includes(shell),'late batch admits one result layer while retaining the original opaque shell');
  const resultIdentity=result;o.updateStateVars({...props(o),recovery:{...recovery,message:'saved result visible'}});p.properties.flush();assert.ok(p.walk(o).includes(resultIdentity));
  const measure=p.nodes(o).find(n=>n.type==='Column'&&n.onAreaChange&&String(n.onAreaChange).includes('measuredHeaderHeight')),measureFooter=p.nodes(o).find(n=>n.type==='Column'&&n.onAreaChange&&String(n.onAreaChange).includes('measuredFooterHeight'));
  measure.onAreaChange({}, {height:'73vp'});measureFooter.onAreaChange({}, {height:100});p.properties.flush();assert.equal(o.measuredHeaderHeight,73);assert.equal(o.measuredFooterHeight,100);assert.equal(shellNative.height,o.resultPanelHeight());assert.equal(resultNative.height,o.resultPanelHeight());
  const recoveryAction=p.walk(o).find(x=>x instanceof p.deps.ReaderRecoveryAction&&x.label==='核对导入结果');
  const oldHit=[...recoveryAction.nodes.values()].find(n=>n.onClick);oldHit.onClick();assert.deepEqual(reconcile,[7]);
  o.updateStateVars({...props(o),recovery:{...recovery,generation:8,message:'新的待核对'}});p.properties.flush();
  oldHit.onClick();assert.deepEqual(reconcile,[7],'old physical callback cannot borrow the new generation');
  const currentHit=[...recoveryAction.nodes.values()].filter(n=>n.onClick).at(-1);
  assert.notEqual(currentHit,oldHit,'the new generation has its own real SDK native action');
  o.foreground=false;currentHit.onClick();assert.deepEqual(reconcile,[7],'a hidden import notice cannot start readback');
  o.foreground=true;
  currentHit.onClick();assert.deepEqual(reconcile,[7,8]);
  const complete=[...footer.nodes.values()].find(n=>n.onClick);complete.onClick();assert.equal(close,1);
  const oldGeneration=o.motionGeneration;o.aboutToDisappear();assert.ok(o.motionGeneration>oldGeneration);const currentHeight=o.shellHeight;measure.onAreaChange({}, {height:90});assert.equal(o.shellHeight,currentHeight,'late measurement cannot restart a retired transition');
  currentHit.onClick();assert.deepEqual(reconcile,[7,8],'a retired notice cannot start another readback');
}
{
  const {p,o}=mount({state:'result',batch:{items:[],imported:0}}, {},source,160);
  assert.equal(o.resultLayout().compact,true);
  const scroll=p.nodes(o).find(n=>n.type==='Scroll');assert.equal(scroll.height,Math.max(0,o.resultPanelHeight()-o.measuredFooterHeight));
  const done=p.nodes(o).find(n=>n.onClick&&n.constraintSize?.minHeight===44);assert.ok(done);
}
{
  const {p,o,animations}=mount({state:'importing',reduceMotion:false,batch:{items:[],imported:0}});
  assert.ok(p.nodes(o).some(n=>n.type==='LoadingProgress'&&n.width===32));o.updateStateVars({...props(o),state:'result',batch:{items:[],imported:0}});p.properties.flush();
  const reveals=()=>animations.filter(options=>typeof options.onFinish==='function');
  const finish=reveals()[0]?.onFinish;assert.equal(typeof finish,'function');
  o.updateStateVars({...props(o),batch:{items:[],imported:0}});p.properties.flush();
  assert.equal(reveals().length,1,'a newer receipt does not restart the same result reveal');
  assert.equal(o.resultInputReady,false);
  o.foreground=false;o.onForegroundChanged();p.properties.flush();
  assert.equal(o.resultInputReady,true,'backgrounding settles the interrupted reveal');
  assert.equal(o.resultAcceptsInput(),false);
  o.foreground=true;o.onForegroundChanged();p.properties.flush();
  assert.equal(reveals().length,1,'foregrounding the settled result does not replay the reveal');
  assert.equal(o.resultAcceptsInput(),true);
  o.aboutToDisappear();o.updateStateVars({...props(o),state:'importing'});o.aboutToAppear();
  assert.equal(o.wasImporting,true);finish();assert.equal(o.wasImporting,true,'old animation completion cannot settle a reopened import owner');
  o.updateStateVars({...props(o),reduceMotion:true});p.properties.flush();

  o.foreground=false;o.aboutToDisappear();
}
{
  const first={fileName:'same.txt',state:'failed',failure:{code:'recoveryPending',message:'first ACK unknown'}};
  const {p,o}=mount({state:'result',batch:{items:[first],imported:0}});
  const message=p.nodes(o).find(n=>n.create==='first ACK unknown'),badge=p.nodes(o).find(n=>n.create==='待确认');assert.ok(message&&badge);const messageId=message.id,badgeId=badge.id;
  o.updateStateVars({...props(o),batch:{items:[{...first,failure:{code:'validation',message:'current failure detail'}}],imported:0}});p.properties.flush();
  assert.equal(message.create,'current failure detail','same ForEach key must read latest failure DTO');assert.equal(badge.create,'失败','nested badge must use current primitive projection');assert.equal(message.id,messageId);assert.equal(badge.id,badgeId);
  const success=mount({state:'result',batch:{items:[{fileName:'same.txt',state:'success',disposition:'created'}],imported:1}}),successBadge=success.p.nodes(success.o).find(n=>n.create==='新增成功');
  success.o.updateStateVars({...props(success.o),batch:{items:[{fileName:'same.txt',state:'success',disposition:'existing'}],imported:1}});success.p.properties.flush();assert.equal(successBadge.create,'已在书架');
  const deferredCleanup=mount({state:'result',batch:{items:[{fileName:'same.txt',state:'success',disposition:'created',cleanupDeferred:true}],imported:1}});
  assert.ok(deferredCleanup.p.nodes(deferredCleanup.o).some(node=>node.create==='书籍已保存，导入清理尚未完成'));
  assert.equal(deferredCleanup.o.summaryTitle(),'导入完成');
  assert.equal(deferredCleanup.o.pendingImport(),false,'deferred cleanup never becomes an unconfirmed import');
  assert.throws(()=>{const bad=mount({state:'result',batch:{items:[first],imported:0}}, {},source.replace('this.currentResultItem(item, index)','item'));const text=bad.p.nodes(bad.o).find(n=>n.create==='first ACK unknown');bad.o.updateStateVars({...props(bad.o),batch:{items:[{...first,failure:{code:'validation',message:'new failure'}}],imported:0}});bad.p.properties.flush();assert.equal(text.create,'new failure','current same-key DTO');},/current same-key DTO/);
}
{
  function checkOriginalFactsBeforeFeedback(candidate=source){
    const known='已确认，刷新失败';
    const {p,o,feedback}=mount({state:'result',selectionEnabled:true,originalPending:false,
      recovery:{message:known,visible:true,canRetry:true,generation:11},
      batch:{items:[{fileName:'known.txt',state:'success',disposition:'created'}],imported:1}},
      {allowEmptyBranchAdmission:true},candidate);
    assert.equal(o.pendingImport(),false);assert.deepEqual(feedback,[known]);
    o.updateStateVars({...props(o),selectionEnabled:false,
      recovery:{message:'已确认，正在刷新',visible:true,canRetry:false,generation:11}});p.properties.flush();
    assert.equal(o.pendingImport(),false,'ordinary readback busy must not become an unknown original');
    assert.deepEqual(feedback,[known],'waiting is not a completed/failure Toast');
    o.updateStateVars({...props(o),originalPending:true,
      recovery:{message:'等待核对',visible:true,canRetry:true,generation:12}});p.properties.flush();
    assert.equal(o.pendingImport(),true,'the explicit original fact survives independently of the retained result');
    assert.deepEqual(feedback,[known],'the actual SDK resets explicit original facts before recovery Watch; unknown never Toasts');
    assert.ok(p.walk(o).some(child=>child instanceof p.deps.ReaderRecoveryNotice));
  }
  checkOriginalFactsBeforeFeedback();
  const original='  @Prop originalPending: boolean = false;\n';
  const recovery="  @Prop @Watch('onRecoveryChanged') recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };\n";
  const reversed=source.replace(original+recovery,recovery+original);assert.notEqual(reversed,source);
  assert.throws(()=>checkOriginalFactsBeforeFeedback(reversed),assert.AssertionError,
    'reject mixed old/new Props that would Toast an unknown operation');
}
// The reviewed message visuals change; original task ownership, current DTO
// projection and the persistent measured result shell still execute unchanged.
assert.doesNotMatch(source,/\.shadow\(\{ radius: 50/);assert.doesNotMatch(source,/\.backgroundColor\(readerAppColor\(this\.surfaceSpec\(\)\.backgroundRole/);
assert.throws(()=>mount({}, {},source.replace('body: (): void => { this.selectionDocument(); }','body: this.selectionDocument')),/state|selectionDocument|selectionPanelHeight|bind/,'old unbound slot is detected by composed probe');
const changed=frameSource.replace('.borderRadius(spec.borderRadius).shadow({ radius: 50', '.borderRadius(spec.borderRadius + 2).shadow({ radius: 50');assert.notEqual(changed,frameSource);
for(const state of ['fileSelection','importing']){const {p,o}=mount({state},{ReaderBoundedSurface:changed});const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface);assert.equal([...frame.nodes.values()].find(n=>n.type==='Column'||n.type==='Stack').borderRadius,14);}
console.log('bounded local import composition PASS: real SDK selection/progress/result frame/header/actions/recovery, parent Props/guards/measurement, persistent phases, retire/reopen, shared propagation and binding negative control; native dynamic layout/focus/scheduling remains OPEN');

}

}
