import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"carrier-propagation": {"description": "当前SourceTools具体标题/计数/书源角色与描述角色变更传播", "resources": []}, "input-selection": {"description": "实际输入回调与实际InlineSelect/trigger/Panel/ChoiceRow选择、旧identity/disabled/retired拒绝", "resources": []}, "guard-admission": {"description": "busy/unknown实际Builder变更按钮拒绝与可用按钮接纳", "resources": []}, "raw-debug": {"description": "原始错误完整多行与独立序号/当前语义色", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { foundationControls, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');


const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets', import.meta.url), 'utf8');
const methods = [...source.matchAll(/@Builder\s+private\s+(\w+)\s*\(/g)].map(match => match[1]);
methods.push('recovery', 'batchCheckPercent', 'batchCheckPhaseLabel', 'batchResultLabel', 'confirmExportThen', 'canWriteSources');
const bookSource={name:'测试书源',sourceId:'https://source.example',baseUrl:'https://source.example',lastCheckSummary:'上次检测已完成'};
const nodes=owner=>[...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>nodes(child))];
const awaitInline=await import('./lib/reader-inline-select-sdk-probe.mjs');
const inlineSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderInlineSelect.ets',import.meta.url),'utf8');
const make = (overrides = {}) => {
  const controls=foundationControls({specs:foundationSpecs({...readerTypographyRoles,...overrides})});
  const messages=boundedSurfaceSdk({properties:controls.properties,allowEmptyBranchAdmission:true});
  controls.hooks.childSources={...messages.childSources,...controls.hooks.childSources};
  controls.hooks.childSources = {...controls.hooks.childSources, PageBackBar: headerSource};
  const PageBackBar = createReaderBuilderProbe(headerSource, boundedMembers(headerSource), controls.dependencies, controls.hooks).Component;
  const {inlineSelectSdk}=awaitInline;
  const inline=inlineSelectSdk({properties:controls.properties,uiContext:{getFont:()=>({}),getMeasureUtils:()=>({measureText:()=>150}),px2vp:x=>x/3,animateTo(_o,action){action();}}});
  controls.hooks.childSources={...controls.hooks.childSources,...inline.hooks.childSources};controls.hooks.lifecycleChildren=true;
  const { owner } = createReaderBuilderProbe(source, methods, {
    // Virtual list painting is outside this typography probe. The actual row
    // Builders run separately below, with their real SDK observer closures.
    LazyForEach: { create() {}, pop() {} }, readerRecoveryView, ...messages.deps,...controls.dependencies, PageBackBar, ...inline.dependencies, ...overrides,
  },controls.hooks);
  const replay=owner.replay.bind(owner);owner.replay=()=>{replay();controls.properties.flush();};
  const calls = [];
  Object.assign(owner, {
    appThemeScheme: 'day',
    snapshot: {
      busy: false, sources: [bookSource], selectedSourceIds: [bookSource.sourceId], selectedSourceCount: 1,
      statusMessage: '最近的操作已经完成', editorSourceId: bookSource.sourceId, editorText: '{}',
      editorReadback: { fact: 'confirmedRefreshFailed' }, checkMode: 'search', checkDepth: 2,
      debugSourceId: bookSource.sourceId, debugKey: '关键词', debugLogs: [],
      batchCheck: { phase: 'running', completed: 1, total: 2, currentSourceName: '测试书源', currentIndex: 2,
        passed: 1, failed: 0, errors: 0, results: [] },
    },
    sourceDataSource: {}, batchResultDataSource: {}, debugLogDataSource: {},
    onSelectAll: () => calls.push('selectAll'), onClearSelection: () => calls.push('clearSelection'),
    onStopCheck: () => calls.push('stopCheck'), onCheckSelected: () => calls.push('checkSelected'),
    onExportSelected: () => calls.push('exportSelected'), onExportAll: () => calls.push('exportAll'),
    onSetSelectedEnabled: () => calls.push('setEnabled'), onDeleteSelected: () => calls.push('deleteSelected'),
    onToggleSelection: () => calls.push('toggle'), onOpenEditor: () => calls.push('openEditor'),
    onDebugSource: () => calls.push('debugSource'), onEditorDraftChanged: value => calls.push(['editor', value]),
    onCancelEditor: () => calls.push('cancel'), onSaveEditor: () => calls.push('save'),
    onReconcileEditor: () => calls.push('reconcile'), onDebugKeyChanged: value => calls.push(['key', value]),
    onCheckSelectionChanged: (...values) => calls.push(['checkSelection', ...values]),
  });
  return { owner, calls, inline };
};

if(selectedCase==='carrier-propagation'){
 const assertions=[['heading',['工具标题'],'工具标题','TYPE_SOURCE_TOOLS_HEADING'],['batchCounter',['计数','#status-color'],'计数','TYPE_SOURCE_TOOLS_COMPACT_ACTION'],['sourceRow',[{source:bookSource,selected:true,actionsEnabled:true}],bookSource.name,'TYPE_SOURCE_TOOLS_ACTION']];
 for(const [method,args,label,roleName]of assertions){const {owner}=make();owner[method](...args);const node=nodes(owner).find(n=>n.create===label),role=readerTypographyRoles[roleName];assert.ok(node,method);assert.equal(node.fontSize,role.fontSizeFp);assert.equal(node.fontFamily,role.fontFamily);if(role.fontWeight!==undefined)assert.equal(node.fontWeight,role.fontWeight);}
 const role=readerTypographyRoles.TYPE_SOURCE_TOOLS_DESCRIPTION,changed={...role,fontSizeFp:role.fontSizeFp+3};
 const base=make().owner,mutant=make({TYPE_SOURCE_TOOLS_DESCRIPTION:changed}).owner;base.exportCard();mutant.exportCard();
 const before=nodes(base).filter(n=>n.fontSize===role.fontSizeFp&&n.lineHeight===role.lineHeightFp);assert.ok(before.length>0);
 for(const n of before){const after=nodes(mutant).find(m=>m.create===n.create&&m.type===n.type);assert.ok(after);assert.equal(after.fontSize,n.fontSize+3);assert.equal(after.lineHeight,n.lineHeight);}
}
if(selectedCase==='input-selection'){
 const {owner:editor,calls,inline}=make();editor.editorCard();editor.debugCard();const code=nodes(editor).find(n=>n.type==='TextArea'),input=nodes(editor).find(n=>n.type==='TextInput');
 assert.equal(code.fontFamily,'monospace');code.onChange('{"edited":true}');input.onChange('新的关键词');assert.deepEqual(calls.slice(-2),[['editor','{"edited":true}'],['key','新的关键词']]);
 const actors=[...editor.children.values()].filter(c=>typeof c.commit==='function'&&typeof c.toggle==='function');assert.equal(actors.length,2,'two actual production InlineSelect hosts');
 inline.choose(actors[0],'发现');inline.choose(actors[1],'正文');assert.deepEqual(calls.slice(-2),[['checkSelection','explore',2],['checkSelection','search',5]]);
 const a=actors[0],before=calls.length;a.toggle();const stale=a.selectionId;a.toggle();a.toggle();a.commit('搜索',stale);a.commit('不在选项中',a.selectionId);assert.equal(calls.length,before);a.actionEnabled=false;a.commit('搜索',a.selectionId);assert.equal(calls.length,before);a.aboutToDisappear();a.actionEnabled=true;a.commit('搜索',a.selectionId);assert.equal(calls.length,before);
}
if(selectedCase==='guard-admission'){
 const {owner:buttons}=make();let accepted=0;buttons.actionButton('禁用',true,false,()=>accepted++);buttons.actionButton('允许',false,true,()=>accepted++);buttons.smallButton('禁用小操作',false,()=>accepted++);buttons.fullWidthActionButton('导出',true,()=>accepted++);const actions=nodes(buttons).filter(n=>typeof n.onClick==='function');actions.forEach(n=>n.onClick());assert.equal(accepted,2);buttons.snapshot.busy=true;buttons.replay();actions.at(-1).onClick();assert.equal(accepted,2);
 for(const state of ['busy','receiptUnknown','editorUnknown']){const {owner,calls}=make();if(state==='busy')owner.snapshot.busy=true;if(state==='receiptUnknown')owner.snapshot.receipt={receipt:{confirmation:'unknown'}};if(state==='editorUnknown')owner.snapshot.editorReadback={confirmation:'unknown'};owner.batchCard();owner.editorCard();for(const node of nodes(owner))if(['启用','停用','删除','校验并保存'].includes(node.create))node.onClick();assert.equal(calls.some(c=>['setEnabled','deleteSelected','save'].includes(c)),false,state);}
}
if(selectedCase==='raw-debug'){
 const {owner}=make(),message='目录读取失败。\n请求：https://example.test/very/long/source-and-chapter-identifier\n原始错误信息';owner.debugLogRow({state:-1,message},123);const actual=nodes(owner),body=actual.find(n=>n.create===message),ordinal=actual.find(n=>n.create==='124');assert.ok(body&&ordinal);assert.equal(body.fontSize,readerTypographyRoles.MESSAGE_BODY.fontSizeFp);assert.equal(body.lineHeight,readerTypographyRoles.MESSAGE_BODY.lineHeightFp);assert.equal(body.maxLines,undefined);assert.equal(body.textOverflow,undefined);assert.equal(body.fontColor,readerAppColor('TOK_MESSAGE_INK','day'));assert.equal(actual.find(n=>n.create==='检测失败').fontColor,readerAppColor('TOK_MESSAGE_DANGER','day'));owner.debugCard();const target=nodes(owner).find(n=>n.create===bookSource.sourceId);assert.equal(target.maxLines,undefined);assert.equal(target.textOverflow,undefined);
}

}
