import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {localImportResultLayout} from '../entry/src/main/ets/features/bookshelf/LocalImportLayout.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/LocalImportDialog.ets',import.meta.url),'utf8');
const frameSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderBoundedSurface.ets',import.meta.url),'utf8');
const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
const props=o=>({state:o.state,batch:o.batch,reduceMotion:o.reduceMotion,failureMessage:o.failureMessage,recovery:o.recovery});
function mount(params={},options={},input=source,viewportHeight=0){
  const p=boundedSurfaceSdk(options),animations=[];let now=0;
  const o=p.consumer(input,boundedMembers(input),{...horizontal,...metricsApi,localImportResultLayout,
    ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts(){},readerMotionNowMs:()=>now,
    BorderStyle:{Dashed:'BorderStyle.Dashed'},Curve:{Linear:'Curve.Linear'},curves:{cubicBezierCurve:(...values)=>values},
    uiContext:{animateTo:(options,work)=>{animations.push(options);work();}}}, {state:'fileSelection',reduceMotion:true,...params});
  o.viewportHeight=viewportHeight;o.aboutToAppear();o.initialRender();return{p,o,animations,clock:n=>now=n};
}
{
  const {p,o}=mount({failureMessage:'select failed'});let choose=0,close=0;o.onSelectFiles=()=>choose++;o.onClose=()=>close++;
  const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface),actions=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions);
  const native=[...frame.nodes.values()].find(n=>n.type==='Column');assert.equal(native.width,350);assert.equal(native.height,399.75);assert.equal(native.borderRadius,20);
  const chooseAction=[...actions.nodes.values()].find(n=>n.onClick&&n.layoutWeight===1),cancelAction=[...actions.nodes.values()].find(n=>n.onClick&&n.border);
  assert.equal(chooseAction.height,44);chooseAction.onClick();assert.equal(choose,1);cancelAction.onClick();assert.equal(close,1);
  const label=[...actions.nodes.values()].find(n=>n.create==='选择文件'),message=p.nodes(o).find(n=>n.create==='select failed');assert.ok(label&&message);
  o.updateStateVars({...props(o),state:'pickerOpening',failureMessage:'next selection error'});p.properties.flush();
  assert.equal(label.create,'正在选择…');assert.equal(chooseAction.enabled,false);chooseAction.onClick();assert.equal(choose,1,'retained direct click checks live admission');assert.equal(message.create,'next selection error');assert.ok(p.walk(o).includes(frame));
  o.viewportWidth=320;p.properties.flush();assert.equal(native.width,280);
  o.aboutToDisappear();const reopened=mount();assert.equal(reopened.o.state,'fileSelection');assert.equal(reopened.o.mounted,true);
}
{
  const recovery={message:'保存结果待确认',visible:true,canRetry:true,generation:7};
  const {p,o}=mount({state:'importing',batch:undefined,recovery},{allowEmptyBranchAdmission:true});let close=0,reconcile=[];o.onClose=()=>close++;o.onReconcile=g=>reconcile.push(g);
  const shell=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-progress');
  const shellNative=[...shell.nodes.values()].find(n=>n.type==='Stack');assert.equal(shellNative.height,228);
  assert.equal(p.walk(o).some(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-result-content'),false);
  o.updateStateVars({...props(o),state:'result',batch:{items:[],imported:0}});p.properties.flush();
  const result=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface&&x.specId==='local-import-result-content');
  const header=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceHeader&&x.specId==='local-import-result-content');
  const footer=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions);
  assert.ok(shell&&result&&header&&footer);const resultNative=[...result.nodes.values()].find(n=>n.type==='Column');
  assert.equal(resultNative.backgroundColor,undefined,'transparent result does not duplicate persistent shell');assert.equal(resultNative.shadow,undefined);
  assert.equal(o.resultOpacity,1);assert.equal(o.importingOpacity,0);assert.equal(shellNative.height,o.resultPanelHeight());assert.ok(p.walk(o).includes(shell),'late batch admits one result layer while retaining the original opaque shell');
  const resultIdentity=result;o.updateStateVars({...props(o),recovery:{...recovery,message:'saved result visible'}});p.properties.flush();assert.ok(p.walk(o).includes(resultIdentity));
  const measure=[...header.nodes.values()].find(n=>n.onAreaChange),measureFooter=[...footer.nodes.values()].find(n=>n.onAreaChange);
  measure.onAreaChange({}, {height:'73vp'});measureFooter.onAreaChange({}, {height:100});p.properties.flush();assert.equal(o.measuredHeaderHeight,73);assert.equal(o.measuredFooterHeight,100);assert.equal(shellNative.height,o.resultPanelHeight());assert.equal(resultNative.height,o.resultPanelHeight());
  const recoveryAction=p.walk(o).find(x=>x instanceof p.deps.ReaderRecoveryAction);[...recoveryAction.nodes.values()].find(n=>n.onClick).onClick();assert.deepEqual(reconcile,[7]);
  o.updateStateVars({...props(o),recovery:{...recovery,generation:8,message:'新的待核对'}});p.properties.flush();[...recoveryAction.nodes.values()].find(n=>n.onClick).onClick();assert.deepEqual(reconcile,[7,8]);
  const complete=[...footer.nodes.values()].find(n=>n.onClick);complete.onClick();assert.equal(close,1);
  const oldGeneration=o.motionGeneration;o.aboutToDisappear();assert.ok(o.motionGeneration>oldGeneration);const currentHeight=o.shellHeight;measure.onAreaChange({}, {height:90});assert.equal(o.shellHeight,currentHeight,'late measurement cannot restart a retired transition');
}
{
  const {p,o}=mount({state:'result',batch:{items:[],imported:0}}, {},source,160);
  assert.equal(o.resultLayout().compact,true);
  const scroll=p.nodes(o).find(n=>n.type==='Scroll');assert.equal(scroll.height,Math.max(0,o.resultPanelHeight()-o.measuredFooterHeight));
  const done=p.nodes(o).find(n=>n.onClick&&n.height===40);assert.ok(done);
}
{
  const {p,o,animations}=mount({state:'importing',reduceMotion:false,batch:{items:[],imported:0}});
  assert.equal(o.spinnerRunning,true);o.updateStateVars({...props(o),state:'result',batch:{items:[],imported:0}});p.properties.flush();
  const finish=animations.find(options=>options.onFinish)?.onFinish;assert.equal(typeof finish,'function');
  o.aboutToDisappear();assert.equal(o.spinnerRunning,false);o.updateStateVars({...props(o),state:'importing'});o.aboutToAppear();
  assert.equal(o.wasImporting,true);finish();assert.equal(o.wasImporting,true,'old animation completion cannot settle a reopened import owner');
  o.updateStateVars({...props(o),reduceMotion:true});p.properties.flush();assert.equal(o.spinnerRunning,false);
  o.foreground=false;assert.equal(o.spinnerRunning,false);o.aboutToDisappear();
}
// Original business lifecycle methods remain byte-identical; the real SDK
// structures now consume them instead of privately repainting their frame.
assert.doesNotMatch(source,/\.shadow\(\{ radius: 50/);assert.doesNotMatch(source,/\.backgroundColor\(readerAppColor\(this\.surfaceSpec\(\)\.backgroundRole/);
assert.throws(()=>mount({}, {},source.replace('body: (): void => { this.fileSelectionBody(); }','body: this.fileSelectionBody')),/state|fileSelectionBody|bind/,'old unbound slot is detected by composed probe');
const changed=frameSource.replace('.borderRadius(spec.borderRadius).shadow({ radius: 50', '.borderRadius(spec.borderRadius + 2).shadow({ radius: 50');assert.notEqual(changed,frameSource);
for(const state of ['fileSelection','importing']){const {p,o}=mount({state},{ReaderBoundedSurface:changed});const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface);assert.equal([...frame.nodes.values()].find(n=>n.type==='Column'||n.type==='Stack').borderRadius,22);}
console.log('bounded local import composition PASS: real SDK selection/progress/result frame/header/actions/recovery, parent Props/guards/measurement, persistent phases, retire/reopen, shared propagation and binding negative control; native dynamic layout/focus/scheduling remains OPEN');
