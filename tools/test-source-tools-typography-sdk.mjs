import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"carrier-propagation": {"description": "当前SourceTools具体标题/计数/书源角色与描述角色变更传播", "resources": []}, "input-selection": {"description": "实际输入回调与实际InlineSelect/trigger/Panel/ChoiceRow选择、旧identity/disabled/retired拒绝", "resources": []}, "guard-admission": {"description": "busy/unknown实际Builder变更按钮拒绝与可用按钮接纳", "resources": []}, "raw-debug": {"description": "原始错误完整多行与独立序号/当前语义色", "resources": []}};
definitions['inline-native-admission']={description:'Actual SourceTools busy -> InlineSelect -> native trigger disabled/expanded, old callback and reentry admission; phone only',resources:[]};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { foundationControls, foundationSpecs, withReaderSectionHeading } = await import('./lib/reader-foundation-control-probe.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
const sourceEditorReadbackPending = bookshelfOperationClass('features/source/application/SourceToolsOrchestrator.ets', 'sourceEditorReadbackPending');


const source = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/ui/chrome/PageBackBar.ets', import.meta.url), 'utf8');
const methods = [...source.matchAll(/@Builder\s+private\s+(\w+)\s*\(/g)].map(match => match[1]);
methods.push('recovery', 'batchCheckPercent', 'batchCheckPhaseLabel', 'batchResultLabel', 'confirmExportThen', 'canWriteSources',
  'editorDraftIsEditable', 'debugOptionsCurrent', 'batchControlsRenderKey', 'batchSelectionAction', 'toolsOpeningIsCurrent',
  'sourceRowAction');
if(selectedCase==='inline-native-admission')methods.push('debugKeyChange','toolsInputIsCurrent');
const bookSource={name:'测试书源',sourceId:'https://source.example',baseUrl:'https://source.example',lastCheckSummary:'上次检测已完成'};
const owners=owner=>[owner,...[...owner.children.values()].flatMap(owners)];
const nodes=owner=>owners(owner).flatMap(actor=>[...actor.nodes.values()]);
const awaitInline=await import('./lib/reader-inline-select-sdk-probe.mjs');
const inlineSource=readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderInlineSelect.ets',import.meta.url),'utf8');
const make = (overrides = {}) => {
  const roles={...readerTypographyRoles,...overrides};
  const controls=withReaderSectionHeading(foundationControls({specs:foundationSpecs(roles)}),roles);
  const messages=selectedCase==='inline-native-admission'?{deps:{},childSources:{}}:
    boundedSurfaceSdk({properties:controls.properties,allowEmptyBranchAdmission:true});
  controls.hooks.childSources={...messages.childSources,...controls.hooks.childSources};
  controls.hooks.childSources = {...controls.hooks.childSources, PageBackBar: headerSource};
  const PageBackBar = selectedCase==='inline-native-admission'?undefined:
    createReaderBuilderProbe(headerSource, boundedMembers(headerSource), controls.dependencies, controls.hooks).Component;
  const {inlineSelectSdk}=awaitInline;
  const inline=inlineSelectSdk({properties:controls.properties,uiContext:{getFont:()=>({}),getMeasureUtils:()=>({measureText:()=>150,measureTextSize:()=>({width:150,height:54})}),px2vp:x=>x/3,animateTo(_o,action){action();}}});
  controls.hooks.childSources={...controls.hooks.childSources,...inline.hooks.childSources};controls.hooks.lifecycleChildren=true;
  const selectedMethods=selectedCase==='inline-native-admission'?
    ['debugCard','debugKeyChange','debugOptionsCurrent','toolsInputIsCurrent','toolsOpeningIsCurrent']:methods;
  const { owner } = createReaderBuilderProbe(source, selectedMethods, {
    // Virtual list painting is outside this typography probe. The actual row
    // Builders run separately below, with their real SDK observer closures.
    LazyForEach: { create() {}, pop() {} }, readerRecoveryView, sourceEditorReadbackPending,
    ...messages.deps,...controls.dependencies, PageBackBar, ...inline.dependencies, AppStorage: {get: () => true}, ...overrides,
  },controls.hooks);
  const replay=owner.replay.bind(owner);owner.replay=()=>{replay();controls.properties.flush();};
  const calls = [];
  Object.assign(owner, {
    appThemeScheme: 'day', mounted: true, temporaryBackIdentity: 'tools:1', debugInputRevision: 0,
    snapshot: {
      busy: false, sources: [bookSource], selectedSourceIds: [bookSource.sourceId], selectedSourceCount: 1,
      sourceListRevision: 1, selectionRevision: 1,
      statusMessage: '最近的操作已经完成', editorSourceId: bookSource.sourceId, editorRevision: 1, editorText: '{}',
      checkMode: 'search', checkDepth: 2,
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
  return { owner, calls, inline, cardType: controls.dependencies.ReaderCard };
};

if(selectedCase==='inline-native-admission'){
 const hosts=f=>owners(f.owner).filter(actor=>actor instanceof f.inline.dependencies.ReaderInlineSelect);
 const trigger=(f,host)=>{const select=f.inline.walk(host).find(actor=>actor instanceof f.inline.dependencies.ReaderSelect);assert.ok(select);const hits=f.inline.nodes(select).filter(node=>typeof node.onClick==='function');assert.equal(hits.length,1);assert.equal(hits[0].type,'Button');return hits[0];};
 const locked=make();locked.owner.snapshot.busy=true;locked.owner.debugCard();
 const disabledHosts=hosts(locked);assert.equal(disabledHosts.length,2);
 for(const host of disabledHosts){assert.equal(host.actionEnabled,false,'actual SourceTools busy reaches the InlineSelect host');const native=trigger(locked,host);assert.equal(native.enabled,false,'SourceTools busy must reach the native trigger');native.onClick();assert.equal(host.open,false);}
 assert.deepEqual(locked.calls,[]);
 const live=make();live.owner.debugCard();const [host]=hosts(live);const native=trigger(live,host),retained=native.onClick;
 assert.equal(native.enabled,true);assert.equal(native.accessibilityDescription,'已收起');
 retained();live.inline.properties.flush();assert.equal(host.open,true);assert.equal(native.accessibilityDescription,'已展开');
 const oldId=host.selectionId,oldDismiss=host.popupOptions(oldId).onStateChange;
 host.reduceMotion=true;host.menu(oldId);live.inline.properties.flush();
 const panel=live.inline.walk(host).find(actor=>actor instanceof live.inline.dependencies.ReaderSelectPanel&&actor.selectionId===oldId);assert.ok(panel);const oldCommit=panel.onCommit;
 // Native choice delivery still belongs to the existing controlled owner.
 host.updateStateVars({value:host.value,options:host.options,selectedIndex:host.selectedIndex,controlWidth:host.controlWidth,
   menuKind:host.menuKind,variant:host.variant,reduceMotion:true,actionEnabled:false});live.inline.properties.flush();
 assert.equal(native.enabled,false);assert.equal(host.open,false,'losing eligibility retires the live popup');assert.equal(native.accessibilityDescription,'已收起');
 retained();oldCommit('发现',oldId);assert.deepEqual(live.calls,[],'disabled retained callbacks do not select or reopen');
 host.updateStateVars({value:host.value,options:host.options,selectedIndex:host.selectedIndex,controlWidth:host.controlWidth,
   menuKind:host.menuKind,variant:host.variant,reduceMotion:true,actionEnabled:true});live.inline.properties.flush();
 retained();live.inline.properties.flush();assert.equal(host.open,true);assert.notEqual(host.selectionId,oldId);
 oldDismiss({isVisible:false});oldCommit('发现',oldId);assert.equal(host.open,true);assert.deepEqual(live.calls,[],'old popup ACK/commit cannot affect replacement');
 retained();live.inline.properties.flush();assert.equal(host.open,false);assert.equal(native.accessibilityDescription,'已收起');
 live.inline.choose(host,'发现');assert.deepEqual(live.calls,[['checkSelection','explore',2]]);
 host.aboutToDisappear();retained();assert.equal(host.open,false);
 host.aboutToAppear();retained();live.inline.properties.flush();assert.equal(host.open,true);assert.notEqual(host.selectionId,oldId);
 oldCommit('发现',oldId);assert.equal(live.calls.length,1);retained();live.inline.properties.flush();assert.equal(host.open,false);
}

if(selectedCase==='carrier-propagation'){
 const assertions=[['exportCard',[],'书源导出','TYPE_SOURCE_TOOLS_HEADING'],['batchCounter',['计数','#status-color'],'计数','TYPE_SOURCE_TOOLS_COMPACT_ACTION'],['sourceRow',[{source:bookSource,sourceListRevision:1,selected:true,actionsEnabled:true}],bookSource.name,'TYPE_SOURCE_TOOLS_ACTION']];
 for(const [method,args,label,roleName]of assertions){const {owner}=make();owner[method](...args);const node=nodes(owner).find(n=>n.create===label),role=readerTypographyRoles[roleName];assert.ok(node,method);assert.equal(node.fontSize,role.fontSizeFp);assert.equal(node.fontFamily,role.fontFamily);if(role.fontWeight!==undefined)assert.equal(node.fontWeight,role.fontWeight);}
 const headingRole=readerTypographyRoles.TYPE_SOURCE_TOOLS_HEADING;
 const sharedHeading=make({TYPE_SOURCE_TOOLS_HEADING:{...headingRole,fontSizeFp:headingRole.fontSizeFp+2}}).owner;
 sharedHeading.exportCard();
 const heading=nodes(sharedHeading).find(node=>node.create==='书源导出');
 assert.equal(heading.fontSize,headingRole.fontSizeFp+2);
 for(const attribute of ['height','lineHeight','padding','maxLines'])assert.equal(Object.hasOwn(heading,attribute),false,attribute);
 const role=readerTypographyRoles.TYPE_SOURCE_TOOLS_DESCRIPTION,changed={...role,fontSizeFp:role.fontSizeFp+3};
 const base=make().owner,mutant=make({TYPE_SOURCE_TOOLS_DESCRIPTION:changed}).owner;base.exportCard();mutant.exportCard();
 const before=nodes(base).filter(n=>n.fontSize===role.fontSizeFp&&n.lineHeight===role.lineHeightFp);assert.ok(before.length>0);
 for(const n of before){const after=nodes(mutant).find(m=>m.create===n.create&&m.type===n.type);assert.ok(after);assert.equal(after.fontSize,n.fontSize+3);assert.equal(after.lineHeight,n.lineHeight);}
}
if(selectedCase==='input-selection'){
 const {owner:editor,calls,inline}=make();editor.editorCard(editor.snapshot.editorRevision);editor.debugCard();const code=nodes(editor).find(n=>n.type==='TextArea'),input=nodes(editor).find(n=>n.type==='TextInput');
 assert.equal(code.fontFamily,'monospace');code.onChange('{"edited":true}');input.onChange('新的关键词');assert.deepEqual(calls.slice(-2),[['editor','{"edited":true}'],['key','新的关键词']]);
 const actors=owners(editor).filter(c=>typeof c.commit==='function'&&typeof c.toggle==='function');assert.equal(actors.length,2,'two actual production InlineSelect hosts');
 inline.choose(actors[0],'发现');inline.choose(actors[1],'正文');assert.deepEqual(calls.slice(-2),[['checkSelection','explore',2],['checkSelection','search',5]]);
 const locked=make();locked.owner.snapshot.busy=true;locked.owner.debugCard();
 const lockedInput=nodes(locked.owner).find(n=>n.type==='TextInput');assert.equal(lockedInput.enabled,false);
 lockedInput.onChange('检测期间的输入');assert.deepEqual(locked.calls,[]);
 editor.isOpeningCurrent=()=>false;const beforeLeaving=calls.length;input.onChange('已离开页面的输入');assert.equal(calls.length,beforeLeaving);editor.isOpeningCurrent=()=>true;
 const a=actors[0],before=calls.length;a.toggle();const stale=a.selectionId;a.toggle();a.toggle();a.commit('搜索',stale);a.commit('不在选项中',a.selectionId);assert.equal(calls.length,before);a.actionEnabled=false;a.commit('搜索',a.selectionId);assert.equal(calls.length,before);a.aboutToDisappear();a.actionEnabled=true;a.commit('搜索',a.selectionId);assert.equal(calls.length,before);
}
if(selectedCase==='guard-admission'){
 const {owner:buttons}=make();let accepted=0;buttons.actionButton('禁用',true,false,()=>accepted++);buttons.actionButton('允许',false,true,()=>accepted++);buttons.smallButton('禁用小操作',false,()=>accepted++);buttons.fullWidthActionButton('导出',true,()=>accepted++);const actions=nodes(buttons).filter(n=>typeof n.onClick==='function');actions.forEach(n=>n.onClick());assert.equal(accepted,2);buttons.snapshot.busy=true;buttons.replay();actions.at(-1).onClick();assert.equal(accepted,2);
 for(const state of ['busy','receiptUnknown','editorUnknown']){const {owner,calls}=make();if(state==='busy')owner.snapshot.busy=true;if(state==='receiptUnknown')owner.snapshot.receipt={receipt:{confirmation:'unknown'}};if(state==='editorUnknown')owner.snapshot.editorReadback={confirmation:'unknown'};owner.batchCard(owner.batchControlsRenderKey());owner.editorCard(owner.snapshot.editorRevision);for(const node of nodes(owner))if(['启用','停用','删除','校验并保存'].includes(node.create))node.onClick();assert.equal(calls.some(c=>['setEnabled','deleteSelected','save'].includes(c)),false,state);}
 const {owner,calls}=make();
 owner.onSetSelectedEnabled=(selection,enabled)=>calls.push({selection,enabled});
 owner.batchCard(owner.batchControlsRenderKey());
 const oldEnable=nodes(owner).find(node=>node.create==='启用').onClick;
 oldEnable();
 assert.deepEqual(calls,[{selection:{sourceIds:[bookSource.sourceId],sourceListRevision:1,selectionRevision:1},enabled:true}]);
 owner.snapshot={...owner.snapshot,selectedSourceIds:['https://next.test'],selectionRevision:2};
 oldEnable();
 assert.equal(calls.length,1,'an old batch control cannot apply a replacement selection');
}
if(selectedCase==='raw-debug'){
 const {owner,cardType}=make(),message='目录读取失败。\n请求：https://example.test/very/long/source-and-chapter-identifier\n原始错误信息';owner.debugLogRow({state:-1,message},123);const actual=nodes(owner),body=actual.find(n=>n.create===message),ordinal=actual.find(n=>n.create==='124');assert.ok(body&&ordinal);assert.equal(body.fontSize,readerTypographyRoles.MESSAGE_BODY.fontSizeFp);assert.equal(body.lineHeight,readerTypographyRoles.MESSAGE_BODY.lineHeightFp);assert.equal(body.maxLines,undefined);assert.equal(body.textOverflow,undefined);assert.equal(body.fontColor,readerAppColor('TOK_MESSAGE_INK','day'));assert.equal(actual.find(n=>n.create==='检测失败').fontColor,readerAppColor('TOK_MESSAGE_DANGER','day'));owner.debugCard();const target=nodes(owner).find(n=>n.create===bookSource.sourceId);assert.equal(target.maxLines,undefined);assert.equal(target.textOverflow,undefined);
 owner.batchCheckCard();
 const cards=owners(owner).filter(actor=>actor instanceof cardType);
 assert.deepEqual(cards.map(card=>card.specId),['task-diagnostics','task-diagnostics']);
 for(const card of cards){
  const frame=[...card.nodes.values()].find(node=>node.type==='Column');
  assert.equal(frame.width,'100%');assert.equal(frame.padding,17);assert.equal(frame.borderRadius,12);
  assert.equal(frame.backgroundColor,readerAppColor('TOK_MESSAGE_SURFACE','day'));
  assert.equal(frame.border.color,readerAppColor('TOK_MESSAGE_BORDER','day'));
 }
}

}
