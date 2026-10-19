import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"cold-before": {"description": "实际Source Core未ACK→cold owner→full Page精确query/continue", "resources": []}, "cold-after": {"description": "实际Source Core已提交→cold owner→full Page仅清理", "resources": []}, "page-eligibility": {"description": "固定当前SourceToolsSnapshot形状→SDK original identity/busy/retired资格", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {compile} = await import('./lib/rules-mutation-durable-probe.mjs');
const {foundationControls} = await import('./lib/reader-foundation-control-probe.mjs');
const {boundedMembers,boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {readerRecoveryView} = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');
const {ReaderWindowMetricsSnapshot,ReaderRectVp,readerVisualSafeLeft,readerVisualSafeRight,readerInteractiveSafeLeft,readerInteractiveSafeRight} = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {READER_FLOATING_TOP_BAR_HEIGHT,readerFloatingBarBottomInset} = await import('./lib/reader-floating-bar-metrics-probe.mjs');

const path='features/source/SourceToolsPage.ets',read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8'),pageSource=read(path),recoverySource=read('features/common/ReaderRecoveryAction.ets'),headerSource=read('features/common/PageBackBar.ets');
const document=JSON.stringify({bookSourceUrl:'https://tools-original.test',bookSourceName:'Original source',enabled:true});
function sdkPage(f,host,snapshot,definition=pageSource){
 const controls=foundationControls(),messages=boundedSurfaceSdk({properties:controls.properties,allowEmptyBranchAdmission:true}),metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,390,844)),geometry=compile('features/common/SurfaceHorizontalGeometry.ts','*',{},true);
 const prefix=pageSource.slice(0,pageSource.indexOf('@Component'))+'\nexport const pageDataSources={SourceToolListDataSource,SourceCheckResultDataSource,SourceDebugLogDataSource};';
 const classes=compile(path,'pageDataSources',{},true,prefix);
 const empty=compile('features/source/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);
 const deps={...messages.deps,...controls.dependencies,...classes,...geometry,EMPTY_SOURCE_TOOLS_SNAPSHOT:empty,readerRecoveryView,ReaderNativeAlertOwner,
  readerVisualSafeLeft,readerVisualSafeRight,readerInteractiveSafeLeft,readerInteractiveSafeRight,READER_FLOATING_TOP_BAR_HEIGHT,readerFloatingBarBottomInset,
  ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts:()=>{},
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
 return{node,controls,walk,update(s){node.updateStateVars({snapshot:s});controls.properties.flush();node.replay();controls.properties.flush();},
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
}
complete=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!complete});if(!complete)console.error(JSON.stringify({kind:'reader-test-retained-fixtures',...cleanup}));}
}
if(selectedCase==='page-eligibility') {
 const empty=compile('features/source/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);const calls=[];
 const host=new Proxy({},{get:(_target,key)=>(...args)=>calls.push([key,...args])});
 const original={generation:7,operationId:'source-original/7',sequence:7,method:'source.setEnabled',confirmation:'unknown',writeStage:'core',busy:false,blocked:true,canRetryOriginal:true,message:'原事项待核对'};
 const source={sourceId:'https://tools-original.test',name:'Original source',enabled:true,enabledExplore:true,bookSource:{bookSourceUrl:'https://tools-original.test',bookSourceName:'Original source'}};
 const snapshot={...empty,sources:[source],selectedSourceIds:[source.sourceId],selectedSourceCount:1,original};const page=sdkPage({},host,snapshot);assert.equal(page.node.canWriteSources(),false);
 const old=page.action('继续');page.update({...snapshot,original:{...original,generation:8,operationId:'replacement/8'}});old.click();assert.deepEqual(calls,[],'old physical actor cannot borrow current original');
 page.update({...snapshot,original:{...original,busy:true}});const busy=page.action('继续');assert.equal(busy.actor.actionEnabled,false);busy.click();assert.deepEqual(calls,[]);
 page.update({...snapshot,original});const current=page.action('继续');current.click();assert.deepEqual(calls,[['continueOriginal',7]],'actual current native actor routes exact generation');
 page.node.aboutToDisappear();current.click();assert.equal(calls.length,1,'unmounted actor cannot continue');
 const raw=page.node.batchControlsRenderKey();page.node.snapshot={...snapshot,original:{...original,busy:false,blocked:false}};assert.notEqual(page.node.batchControlsRenderKey(),raw,'only small batch key tracks actual write admission');
}

}
