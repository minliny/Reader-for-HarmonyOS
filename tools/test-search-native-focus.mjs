import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function fieldClip(){
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p+'.ets',import.meta.url),'utf8');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');const style=readerTypographyRoles.TYPE_SEARCH_BOOK_INPUT;
for (const name of ['fixedLineHeightField', 'autoLineHeightField']) {
  const { owner } = createReaderBuilderProbe(read('ui/controls/ReaderSearchField'), [name], {
    TYPE_SEARCH_BOOK_INPUT: style,
  });
  Object.assign(owner, { appThemeScheme: 'day', text: '', placeholder: '搜索', clearable: false,
    iconGap: () => 5, searchIcon: () => 'search', iconSize: () => 16, inputHeight: () => 36,
    textStyle: () => style, inputColor: () => 'ink', caretColor: () => 'ink', placeholderColor: () => 'muted',
    fieldHeight: () => 44, horizontalPadding: () => 12, fieldBackgroundColor: () => 'surface',
    fieldBorderWidth: () => 1, fieldBorderColor: () => 'border', cornerRadius: () => 999,
    resolvedAccessibilityLabel: () => '搜索',
  });
  owner[name]();
  const nodes = [...owner.nodes.values()];
  assert.equal(nodes.find(n => n.type === 'TextInput').borderRadius, 0,
    'native start caret cannot be clipped by an inherited TextInput round rect');
  assert.equal(nodes.find(n => n.type === 'Row').borderRadius, 999,
    'outer authored search field retains its shape');
}
}
async function webFocus(){
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p+'.ets',import.meta.url),'utf8');
const Executor=selectedProductionMethods(new URL('../entry/src/main/ets/platform/network/ArkWebExecutor.ts',import.meta.url),
  'ArkWebExecutor',['isSurfaceCurrent','cancelInteractive','finishInteractive','cancel','hostFailure','rejectResourceCapture','emitDiagnostic']);
const executor=new Executor();executor.jobs=new Map();
let stops=0;
const surface={id:1,requestId:11,controller:{stop(){stops++;}}};
const job={requestId:11,surface,interactive:true,cancelled:false,userFinished:false};
executor.active=job;executor.jobs.set(11,job);executor.surfaceLease={surface,retired:false};
const mount=current=>{
  const probe=createReaderBuilderProbe(read('ui/platform/ArkWebExecutionHost'),['build','surfacesForRender'],
    {ArkWebExecutor:{instance:executor}},{allowEmptyBranchAdmission:true});
  Object.assign(probe.owner,{interactive:false,appThemeScheme:'day',surfaceId:current.id,currentSurface:current,title:'',currentUrl:''});
  return probe.owner;
};
const owner=mount(surface);
owner.initialRender();
const web = [...owner.nodes.values()].find(n => n.type === 'Web');
assert.ok(web);
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
owner.interactive = true; owner.replay();
assert.equal(web.focusable, true); assert.equal(web.focusOnTouch, true,
  'visible source login/captcha remains keyboard-capable');
const buttons=()=>[...owner.nodes.values()].filter(n=>n.type==='Button'&&n.onClick);
const cancel=buttons().find(n=>n.accessibilityText==='取消登录'),finish=buttons().find(n=>n.accessibilityText==='完成登录');
assert.ok(cancel&&finish);assert.equal(cancel.defaultFocus,true);
for(const button of [cancel,finish]){
  assert.equal(button.padding,0);assert.deepEqual(button.constraintSize,{minWidth:0,minHeight:0});
  assert.equal(button.height,undefined,'toolbar action keeps authored natural height');assert.equal(button.borderRadius,0);
}
const toolbar=[...owner.nodes.values()].find(n=>n.type==='Row'&&n.height===56);
assert.ok(toolbar);assert.deepEqual(toolbar.padding,{left:18,right:18});
for(const label of [...owner.nodes.values()].filter(n=>n.type==='Text'&&['取消','完成'].includes(n.create))){
  assert.equal(label.onClick,undefined);assert.equal(label.fontSize,14);assert.equal(label.fontWeight,'FontWeight.Bold');
}
cancel.onClick();cancel.onClick();assert.equal(job.cancelled,true);assert.equal(stops,1,'actual Executor cancels the current surface once');
const next={id:2,requestId:12,controller:{stop(){stops++;}}};
const nextJob={requestId:12,surface:next,interactive:true,cancelled:false,userFinished:false};
executor.active=nextJob;executor.jobs.set(12,nextJob);executor.surfaceLease={surface:next,retired:false};
cancel.onClick();finish.onClick();
assert.equal(nextJob.cancelled,false);assert.equal(nextJob.userFinished,false,'retired toolbar cannot finish the new login');
const current=mount(next);current.interactive=true;current.initialRender();
const live=[...current.nodes.values()].filter(n=>n.type==='Button'&&n.onClick);
live.find(n=>n.accessibilityText==='完成登录').onClick();assert.equal(nextJob.userFinished,true);
live.find(n=>n.accessibilityText==='取消登录').onClick();assert.equal(nextJob.cancelled,false,'finish is not reinterpreted as cancel');
// Replay the retained Web's actual observer only: this SDK fixture records
// attributes, while native toolbar subtree removal remains device evidence.
owner.interactive = false;
owner.replayOnly([[...owner.nodes].find(([,node])=>node===web)[0]]);
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
}
const cases={'field-clip':fieldClip,'web-focus':webFocus};
for(const id of selectContractCases({'field-clip':'Actual search input caret clip with current public role','web-focus':'Actual hidden/visible ArkWeb keyboard focus lifecycle'})){await cases[id]();recordContractCasePass(id);}
