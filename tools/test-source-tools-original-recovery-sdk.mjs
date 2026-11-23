import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"cold-before": {"description": "实际Source Core未ACK→cold owner→full Page精确query/continue", "resources": []}, "cold-after": {"description": "实际Source Core已提交→cold owner→full Page仅清理", "resources": []}, "page-eligibility": {"description": "固定当前SourceToolsSnapshot形状→SDK original identity/busy/retired资格", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {compile} = await import('./lib/rules-mutation-durable-probe.mjs');
const {foundationControls,withReaderSectionHeading} = await import('./lib/reader-foundation-control-probe.mjs');
const {boundedMembers,boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {readerRecoveryView} = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');
const {readerEditingSdk} = await import('./lib/reader-editing-sdk-probe.mjs');
const {actualReaderPostLayoutFrame} = await import('./lib/reader-post-layout-frame-probe.mjs');
const {actualReaderPageLayout} = await import('./lib/reader-page-shell-runtime-probe.mjs');
const {resolveSourceToolsRowLayout} = await import('../entry/src/main/ets/features/source/presentation/SourceToolsLayout.ts');
const headerMetrics = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
const {resolveReaderRaisedShape} = await import('../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts');
const {ReaderWindowMetricsSnapshot,ReaderRectVp,readerVisualSafeLeft,readerVisualSafeRight,readerInteractiveSafeLeft,readerInteractiveSafeRight} = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const {READER_FLOATING_TOP_BAR_HEIGHT,readerFloatingBarBottomInset} = await import('./lib/reader-floating-bar-metrics-probe.mjs');

const path='features/source/ui/SourceToolsPage.ets',read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8'),pageSource=read(path),recoverySource=read('ui/feedback/ReaderRecoveryAction.ets'),headerSource=read('ui/chrome/PageBackBar.ets');
const document=JSON.stringify({bookSourceUrl:'https://tools-original.test',bookSourceName:'Original source',enabled:true});
function sdkPage(f,host,snapshot,definition=pageSource){
 const controls=withReaderSectionHeading(foundationControls()),messages=boundedSurfaceSdk({properties:controls.properties,allowEmptyBranchAdmission:true}),metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,390,844)),geometry=compile('ui/layout/SurfaceHorizontalGeometry.ts','*',{},true);
 const prefix=pageSource.slice(0,pageSource.indexOf('@Component'))+'\nexport const pageDataSources={SourceToolListDataSource,SourceToolListRow,SourceCheckResultDataSource,SourceDebugLogDataSource};';
 const classes=compile(path,'pageDataSources',{},true,prefix);
 const empty=compile('features/source/application/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);
 const sourceEditorReadbackPending=compile('features/source/application/SourceToolsOrchestrator.ets','sourceEditorReadbackPending',{},true);
 const frames=[];
 const ReaderPostLayoutFrame=actualReaderPostLayoutFrame();
 const ReaderNativeSlotMeasurement=compile('ui/layout/ReaderNativeSlotMeasurement.ets','ReaderNativeSlotMeasurement',{
  ReaderPostLayoutFrame,readerMeasureSurfaceRect:()=>undefined,
 });
 const deps={...messages.deps,...controls.dependencies,...classes,...geometry,EMPTY_SOURCE_TOOLS_SNAPSHOT:empty,readerRecoveryView,ReaderNativeAlertOwner,sourceEditorReadbackPending,
  ...actualReaderPageLayout(),...readerEditingSdk(),ReaderNativeSlotMeasurement,ReaderPostLayoutFrame,TextInputController:class {},
  TextHeightAdaptivePolicy:{ LAYOUT_CONSTRAINT_FIRST:'layout-constraint-first' },
  nextSourceToolsBackIdentity:0,
  AppStorage:{get:key=>key==='readerAppForeground'?true:undefined},
  resolveSourceToolsRowLayout,resolveReaderRaisedShape,...headerMetrics,
  readerScaledBarHeight:compile('ui/foundation/ReaderSurfaceResolvers.ts','readerScaledBarHeight',{}),
  uiContext:{postFrameCallback:frame=>frames.push(frame),px2vp:value=>value,getMeasureUtils:()=>({
    measureText:input=>input.textContent.length*12,
    measureTextSize:input=>({width:input.constraintWidth,height:44}),
  })},
  readerVisualSafeLeft,readerVisualSafeRight,readerInteractiveSafeLeft,readerInteractiveSafeRight,READER_FLOATING_TOP_BAR_HEIGHT,readerFloatingBarBottomInset,
  ReaderWindowCoordinator:{metrics:()=>metrics},readerWindowMetrics:()=>metrics,registerReaderFonts:()=>{},
  // Native virtual-list painting only; the production data source and row
  // Builder own the data and every action. No domain algorithm is substituted.
  LazyForEach:{create(_id,_owner,data,generator){for(let i=0;i<data.totalCount();i++)generator(data.getData(i));},pop(){}}};
 const hooks={...messages.hooks,...controls.hooks,allowEmptyBranchAdmission:true,childSources:{...messages.childSources,...controls.hooks.childSources,ReaderRecoveryAction:recoverySource,PageBackBar:headerSource}};
 const loader=resolveEtsLoaderRoot(),syntax=createRequire(import.meta.url)(loader+'/lib/validate_ui_syntax.js');
 syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
 deps.PageBackBar=createReaderBuilderProbe(headerSource,boundedMembers(headerSource),deps,hooks).Component;
 const node=createReaderBuilderProbe(definition,boundedMembers(definition),deps,{...hooks,initialParams:{snapshot,
  onReconcile:g=>host.reconcile(g),onContinueOriginal:g=>host.continueOriginal(g),
  onSetSelectedEnabled:(ids,enabled)=>host.setSelectedEnabled(ids,enabled),onDeleteSelected:ids=>host.deleteSelected(ids),
  onOpenEditor:id=>host.openEditor(id),onEditorDraftChanged:text=>host.updateEditorDraft(text),onSaveEditor:()=>host.saveEditor(),onCancelEditor:()=>host.cancelEditor(),
  onSelectAll:()=>host.selectAll(),onClearSelection:()=>host.clearSelection(),onToggleSelection:id=>host.toggleSelection(id),
  onDebugSource:id=>host.debugSource(id),onExportAll:()=>host.exportAll(),onExportSelected:ids=>host.exportSelected(ids),onCheckSelected:ids=>host.checkSelected(ids)}}).owner;
 node.aboutToAppear();node.initialRender();
 const walk=o=>[o,...[...o.children.values()].flatMap(walk)];
 const standard=walk(node).find(owner=>typeof owner.overlayBottom==='function' && typeof owner.recordMeasurement==='function');
 assert.ok(standard,'current SourceTools mounts its shared StandardPage');
 const hostArea=[...standard.nodes.values()].find(actor=>actor.type==='__Common__'&&actor.onAreaChange);
 assert.ok(hostArea,'StandardPage admission comes from its actual outer Area handler');
 hostArea.onAreaChange({}, {width:'390vp',height:'844vp'});
 controls.properties.flush();
 standard.replay();
 controls.properties.flush();
 return{node,controls,walk,frames,update(s){node.updateStateVars({snapshot:s});controls.properties.flush();node.replay();controls.properties.flush();},
  action(label){const actors=walk(node).filter(c=>c instanceof deps.ReaderRecoveryAction&&c.label===label);const actor=actors.at(-1);assert.ok(actor,label+': actual shared recovery actor');return{actor,click:[...actor.nodes.values()].find(n=>n.onClick).onClick};},
  nodes:()=>controls.nodes(node)};
}
let groups=0;
if(selectedCase==='cold-before'||selectedCase==='cold-after') {
const {fixture}=await import('./lib/source-management-durable-probe.mjs');
const {cleanupDurableFixtures}=await import('./lib/rules-mutation-durable-probe.mjs');let complete=false;try{

for(const moment of [selectedCase==='cold-before'?'beforeMethod':'afterMethod']){
 const f=await fixture();console.log(JSON.stringify({kind:'reader-test-tool-evidence',tool:f.toolEvidence(),coreInfo:await f.readCoreIdentity()}));await f.source.importBookSourceDocument(document,f.current);f.options[moment]='rules.mutation.apply';await assert.rejects(f.source.updateSource('https://tools-original.test',{enabled:false},f.current));
 const intent=JSON.parse(f.disk());f.retire();const cold=await fixture(f),host=cold.SourceToolsOrchestrator.forRuntime(cold.runtime);let snapshot,page;
 host.attachPresentation('tools-sdk',s=>{snapshot=s;},()=>true);host.open([]);await host.operationTail;
 assert.equal(snapshot.original.blocked,true);assert.equal(cold.writes().length,0,'cold open only queries original exact receipt');host.selectAll();snapshot=host.current();
 page=sdkPage(cold,host,snapshot);assert.equal(page.node.canWriteSources(),false);assert.ok(page.nodes().some(n=>n.type==='Span'&&String(n.create).includes(snapshot.original.message)));
 const before=cold.calls.length;for(const label of ['启用','停用','删除','编辑'])for(const n of page.nodes().filter(n=>n.type==='Text'&&n.create===label)){assert.equal(n.opacity,.62);n.onClick();}
 assert.equal(cold.calls.length,before,'actual batch/list controls cannot create replacement writes');
 const check=page.nodes().find(n=>n.type==='Text'&&n.create==='检测所选');assert.ok(check&&check.opacity===1,'read-only checking remains available');
 const continueLabel=snapshot.original.confirmation==='confirmed'&&snapshot.original.writeStage==='cleanup'?'继续清理':'继续';const read=page.action('核对'),next=page.action(continueLabel);read.click();await host.operationTail;assert.equal(cold.writes().length,0,'native reconcile is pure query even when Core says absent');
 const afterRead=host.current();assert.equal(afterRead.original.operationId,intent.operationId);
 page.update(afterRead);read.click();next.click();await host.operationTail;
 // A retained physical actor captures its old exact action identity; a new
 // generation/key must not let that actor borrow the new continuation.
 assert.equal(cold.writes().length,0,'old physical callback cannot borrow new recovery generation');
 page.action(continueLabel).click();await host.operationTail;assert.equal(cold.writes().length,moment==='beforeMethod'?1:0);
 if(cold.writes().length)assert.equal(cold.writes()[0].params.operationId,intent.operationId,'explicit continuation retains original full ID');
 assert.equal(host.current().original.blocked,false);assert.equal(cold.disk(),'');const writes=cold.writes().length;page.action(continueLabel).click();await host.operationTail;assert.equal(cold.writes().length,writes,'terminal old physical actor rejected');
 page.node.aboutToDisappear();read.click();next.click();await host.operationTail;assert.equal(cold.writes().length,writes,'unmounted page cannot continue original');groups++;
 if (moment === 'beforeMethod') {
  const sourceId='https://tools-original.test';
  let release;
  cold.options.gate={promise:new Promise(resolve=>{release=resolve;})};
  cold.options.pauseMethod='source.export';
  host.openEditor(sourceId);
  try {
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(cold.options.pauseMethod,undefined,'original source export reached the retained read boundary');
   host.detachPresentation('tools-sdk');
   host.attachPresentation('tools-successor',value=>{snapshot=value;},()=>true);
   host.open(snapshot.sources);
  } finally { release(); }
  await host.operationTail;
  assert.equal(snapshot.editorSourceId,'','the previous opening cannot install its editor in the successor');
  assert.equal(snapshot.busy,false);

  host.openEditor(sourceId);await host.operationTail;
  const revision=snapshot.editorRevision;
  const draft=JSON.stringify({...JSON.parse(snapshot.editorText),bookSourceName:'Revised source'});
  host.updateEditorDraft(draft,revision);
  cold.options.transformMethod='source.list';cold.options.transform=data=>({...data,sources:[]});
  host.saveEditor(revision);await host.operationTail;
  assert.equal(snapshot.editorReadback.fact,'confirmedRefreshFailed','a successful list read missing the exact source is not an editor readback');
  assert.equal(snapshot.editorSourceId,sourceId);assert.equal(snapshot.editorText,draft);
  const saveWrites=cold.writes().length;
  cold.options.transformMethod=undefined;
  host.reconcileEditor(revision);await host.operationTail;
  assert.equal(cold.writes().length,saveWrites,'editor readback retries only the existing source list');
  assert.equal(snapshot.editorSourceId,'');assert.equal(snapshot.editorReadback.fact,'confirmedCurrent');
 }
}
complete=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!complete});if(!complete)console.error(JSON.stringify({kind:'reader-test-retained-fixtures',...cleanup}));}
}
if(selectedCase==='page-eligibility') {
 const empty=compile('features/source/application/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);const calls=[];
 const host=new Proxy({},{get:(_target,key)=>(...args)=>calls.push([key,...args])});
 const original={generation:7,operationId:'source-original/7',sequence:7,method:'source.setEnabled',confirmation:'unknown',writeStage:'core',busy:false,blocked:true,canRetryOriginal:true,message:'原事项待核对'};
 const source={sourceId:'https://tools-original.test',name:'Original source',enabled:true,enabledExplore:true,bookSource:{bookSourceUrl:'https://tools-original.test',bookSourceName:'Original source'}};
 const snapshot={...empty,sources:[source],selectedSourceIds:[source.sourceId],selectedSourceCount:1,original};const page=sdkPage({},host,snapshot);assert.equal(page.node.canWriteSources(),false);
 const old=page.action('继续');
 // Invoke the retained callback before layout can replace its old actor.
 page.node.snapshot={...snapshot,original:{...original,generation:8,operationId:'replacement/8'}};
 old.click();assert.deepEqual(calls,[],'old physical actor cannot borrow current original');
 // The SDK probe cannot model ArkUI removing an already-populated branch.
 const busyPage=sdkPage({},host,{...snapshot,original:{...original,busy:true}});
 const busy=busyPage.action('继续');assert.equal(busy.actor.actionEnabled,false);busy.click();assert.deepEqual(calls,[]);
 const currentPage=sdkPage({},host,snapshot);
 const current=currentPage.action('继续');current.click();assert.deepEqual(calls,[['continueOriginal',7]],'actual current native actor routes exact generation');
 const editor={...snapshot,editorSourceId:source.sourceId,editorRevision:11};
 page.node.snapshot=editor;
 assert.equal(page.node.editorDraftIsEditable(11),false,'an outstanding original write also blocks the native draft');
 page.node.snapshot={...editor,original:undefined,busy:true};
 assert.equal(page.node.editorDraftIsEditable(11),false,'an active save does not accept edits the owner would discard');
 page.node.snapshot={...editor,original:undefined,busy:false};
 assert.equal(page.node.editorDraftIsEditable(11),true);
 assert.equal(page.node.editorDraftIsEditable(10),false,'a retired editor callback cannot edit the current draft');
 currentPage.node.aboutToDisappear();current.click();assert.equal(calls.length,1,'unmounted actor cannot continue');
 page.node.aboutToDisappear();
 assert.equal(page.node.editorDraftIsEditable(11),false);
 for(const frame of page.frames.splice(0)) frame.onIdle(1000000);
 page.node.snapshot=snapshot;
 const raw=page.node.batchControlsRenderKey();page.node.snapshot={...snapshot,original:{...original,busy:false,blocked:false}};assert.notEqual(page.node.batchControlsRenderKey(),raw,'only small batch key tracks actual write admission');
}

}
