import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"layout-matrix":{"description":"Tools actual SDK controls and parent row/list budgets at 320/366/720 x 1/1.3/1.6/2/3.2; no native claim","resources":[]},"entity-admission":{"description":"Actual entity labels and readonly/confirmed/unknown guards retained through Tools actions and fields","resources":[]},"legacy-isolation":{"description":"All old button specs/modifier tuples and ReaderButton a11y bytes unchanged outside two Tools opt-ins","resources":[]},"carrier-propagation": {"description": "当前SourceTools具体标题/计数/书源角色与描述角色变更传播", "resources": []}, "input-selection": {"description": "实际输入回调与实际InlineSelect/trigger/Panel/ChoiceRow选择、旧identity/disabled/retired拒绝", "resources": []}, "guard-admission": {"description": "busy/unknown实际Builder变更按钮拒绝与可用按钮接纳", "resources": []}, "raw-debug": {"description": "原始错误完整多行与独立序号/当前语义色", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { foundationControls, foundationSpecs, foundationModifiers } = await import('./lib/reader-foundation-control-probe.mjs');
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const {ReaderWindowMetricsSnapshot,ReaderRectVp,readerVisualSafeLeft,readerVisualSafeRight}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {readerReadableFontScale,readerScaledControlHeight}=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);


const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets', import.meta.url), 'utf8');
const raisedSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderRaisedSurface.ets', import.meta.url), 'utf8');
const surfaceSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets', import.meta.url), 'utf8');
const raisedSpecEnd = surfaceSource.indexOf('\n', surfaceSource.indexOf('export function readerRaisedSurfaceSpec'));
assert.ok(raisedSpecEnd > 0, 'retain the actual shared raised-surface specification and its declarations');
const { readerRaisedSurfaceSpec } = pureModuleProbe(surfaceSource.slice(0, raisedSpecEnd),
  'ReaderSurfaceSpecs.ets', { readerAppColor }, ['readerRaisedSurfaceSpec']);
const methods = [...source.matchAll(/@Builder\s+private\s+(\w+)\s*\(/g)].map(match => match[1]);
methods.push('recovery', 'batchCheckPercent', 'batchCheckPhaseLabel', 'batchResultLabel', 'confirmExportThen', 'canWriteSources', 'fontScale','toolsInnerWidth','compactActionWidth','actionWidth','sourceActionsWidth','sourceRowStacked','sourceRowMinHeight','resultRowMinHeight','debugRowMinHeight','counterWidth','debugSelectWidth');
const bookSource={name:'测试书源',sourceId:'https://source.example',baseUrl:'https://source.example',lastCheckSummary:'上次检测已完成'};
const nodes=owner=>[...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>nodes(child))];
const awaitInline=await import('./lib/reader-inline-select-sdk-probe.mjs');
const inlineSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderInlineSelect.ets',import.meta.url),'utf8');
const make = (overrides = {}, {width=366,scale=1,scheme='day'}={}) => {
  const metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,width,844));metrics.systemFontScale=scale;
  const controls=foundationControls({specs:foundationSpecs({...readerTypographyRoles,...overrides}),windowMetrics:()=>metrics});
  const messages=boundedSurfaceSdk({properties:controls.properties,allowEmptyBranchAdmission:true});
  controls.hooks.childSources={...messages.childSources,...controls.hooks.childSources};
  // PageBackBar's complete current tree includes a real raised-surface child.
  // Keep that component and its shipping Prop metadata in SDK lowering even
  // though this selected input case never mounts the page header. Canvas is a
  // finite platform recording port here, not shadow/raster acceptance.
  class CanvasContextPort {
    constructor(settings) { this.settings = settings; this.width = 0; this.height = 0; this.calls = []; }
    beginPath(...args) { this.calls.push(['beginPath', ...args]); }
    moveTo(...args) { this.calls.push(['moveTo', ...args]); }
    lineTo(...args) { this.calls.push(['lineTo', ...args]); }
    arcTo(...args) { this.calls.push(['arcTo', ...args]); }
    closePath(...args) { this.calls.push(['closePath', ...args]); }
    fill(...args) { this.calls.push(['fill', ...args]); }
    clearRect(...args) { this.calls.push(['clearRect', ...args]); }
    save(...args) { this.calls.push(['save', ...args]); }
    restore(...args) { this.calls.push(['restore', ...args]); }
  }
  controls.hooks.childSources = {...controls.hooks.childSources, PageBackBar: headerSource, ReaderRaisedSurface: raisedSource};
  controls.dependencies.ReaderRaisedSurface = createReaderBuilderProbe(raisedSource, boundedMembers(raisedSource), {
    ...controls.dependencies, readerRaisedSurfaceSpec,
    CanvasRenderingContext2D: CanvasContextPort,
    RenderingContextSettings: class { constructor(antialias) { this.antialias = antialias; } },
  }, controls.hooks).Component;
  const PageBackBar = createReaderBuilderProbe(headerSource, boundedMembers(headerSource), controls.dependencies, controls.hooks).Component;
  const {inlineSelectSdk}=awaitInline;
  // Finite native measurement replies in px. This case proves actor callbacks,
  // not text shaping or physical trigger geometry.
  const inline=inlineSelectSdk({properties:controls.properties,uiContext:{getFont:()=>({}),getMeasureUtils:()=>({measureText:()=>150,measureTextSize:()=>({width:150,height:60})}),px2vp:x=>x/3,animateTo(_o,action){action();}}});
  controls.hooks.childSources={...controls.hooks.childSources,...inline.hooks.childSources};controls.hooks.lifecycleChildren=true;
  const { owner } = createReaderBuilderProbe(source, methods, {
    // Virtual list painting is outside this typography probe. The actual row
    // Builders run separately below, with their real SDK observer closures.
    LazyForEach: { create() {}, pop() {} }, readerRecoveryView,readerVisualSafeLeft,readerVisualSafeRight,readerReadableFontScale,readerScaledControlHeight, ...messages.deps,...controls.dependencies, PageBackBar, ...inline.dependencies, ...overrides,
  },controls.hooks);
  const replay=owner.replay.bind(owner);owner.replay=()=>{replay();controls.properties.flush();};
  const calls = [];
  Object.assign(owner, {
    appThemeScheme: scheme,readerWindowMetricsRevision:0,cardWidth:width-40,
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


if(selectedCase==='layout-matrix'){
 const samples=[];
 for(const width of [320,366,720])for(const scale of [1,1.3,1.6,2,3.2])for(const summary of [false,true]){
  const {owner}=make({}, {width,scale});owner.snapshot.editorSourceId='';
  const entity={...bookSource,...(!summary?{lastCheckSummary:undefined}:{})};
  owner.sourceRow({source:entity,selected:true,actionsEnabled:true});
  const actual=nodes(owner),buttons=actual.filter(n=>typeof n.onClick==='function'&&['已选','编辑','调试'].includes(n.create));
  assert.equal(buttons.length,3,'three real SDK action carriers');
  for(const b of buttons){assert.ok(b.width>=44);assert.ok(b.constraintSize.minHeight>=44);assert.equal(b.height,undefined,'natural height is not capped');assert.equal(b.responseRegion,undefined,'no overlapping response extension');assert.equal(b.maxFontScale,scale);}
  const texts=actual.filter(n=>[entity.name,entity.baseUrl,entity.lastCheckSummary].filter(Boolean).includes(n.create));
  assert.equal(texts.length,summary?3:2);for(const t of texts)assert.equal(t.maxFontScale,scale);
  const row=actual.find(n=>n.type==='Column'&&n.constraintSize?.minHeight>0);assert.ok(row,'actual parent row budget');assert.equal(row.height,undefined);
  const available=owner.toolsInnerWidth()-16,span=buttons[0].width+8,stacked=owner.sourceRowStacked();
  const columns=Math.max(1,Math.floor(available/span)),actionRows=stacked?Math.ceil(3/columns):1;
  const textHeight=texts.reduce((sum,n)=>sum+n.lineHeight*n.maxFontScale,0)+(summary?6:3);
  const required=16+(stacked?Math.ceil(textHeight)+8+actionRows*(buttons[0].constraintSize.minHeight+8):Math.max(Math.ceil(textHeight),buttons[0].constraintSize.minHeight+8));
  assert.ok(row.constraintSize.minHeight>=required,'actual text lines and action rows fit minimum row');
  assert.ok(buttons[0].width+8<=available,'at least one nonoverlapping action fits');
  if(!stacked)assert.ok(3*span+8+7*readerTypographyRoles.TYPE_SOURCE_TOOLS_ACTION.fontSizeFp*scale<=available,'inline text minimum retained');
  const parent=make({}, {width,scale}).owner;parent.sourceCard();
  const list=nodes(parent).find(n=>n.type==='List');assert.ok(list);assert.equal(list.height,Math.min(420,parent.sourceRowMinHeight(true)),'one-item parent viewport grows with row, within scrolling cap');
  const measured=nodes(parent).find(n=>typeof n.onAreaChange==='function');assert.ok(measured);measured.onAreaChange({}, {width:width-64});assert.equal(parent.toolsInnerWidth(),width-88,'actual card width is layout authority');
  const resultOwner=make({}, {width,scale}).owner;
  resultOwner.batchResultRow({sourceName:'Result source',sourceId:'result-id',message:'Result message',state:'passed'});
  const resultNodes=nodes(resultOwner),resultFrame=resultNodes.find(n=>n.type==='Flex'&&n.constraintSize?.minHeight);
  const resultLines=resultNodes.filter(n=>n.type==='Text');
  assert.ok(resultFrame.constraintSize.minHeight>=Math.ceil(resultLines.reduce((sum,n)=>sum+n.lineHeight*scale,0))+32,'result row accounts for three content lines and separate status line');
  resultOwner.snapshot.batchCheck.results=[{sourceId:'result-id',traceId:'trace',state:'passed'}];resultOwner.batchCheckCard();
  assert.equal(nodes(resultOwner).find(n=>n.type==='List').height,Math.min(320,resultFrame.constraintSize.minHeight),'result List parent uses current minimum extent');
  const logOwner=make({}, {width,scale}).owner;logOwner.snapshot.debugLogs=[{message:'Error details',state:-1}];logOwner.debugCard();
  assert.equal(nodes(logOwner).find(n=>n.type==='List').height,Math.min(360,logOwner.debugRowMinHeight()),'debug parent reserves error/meta/body line budget');
  samples.push({width,scale,summary,form:stacked?'stacked':'inline',rowMinimum:row.constraintSize.minHeight,actionRows,viewport:list.height});
 }
 for(const width of [320,366,720])for(const scale of [1,2,3.2]){
  const {owner}=make({}, {width,scale});owner.batchCard();const actual=nodes(owner);
  assert.ok(actual.filter(n=>n.type==='Flex').length>=2,'both batch action groups can wrap');
  const buttonActors=[...owner.children.values()].filter(n=>n.specId==='source-tools-action');assert.equal(buttonActors.length,7);
  const widths=[...owner.nodes.values()].filter(n=>typeof n.width==='number').map(n=>n.width);
  for(const b of buttonActors){assert.ok(widths.includes(owner.actionWidth(b.label)),'actual custom component owns explicit action width');const target=nodes(b).find(n=>n.onClick);assert.ok(target.constraintSize.minHeight>=44);assert.equal(target.maxFontScale,scale);assert.equal(target.maxLines,undefined,'long actions may wrap');assert.equal(target.textOverflow,undefined);}
  const counters=make({}, {width,scale}).owner;counters.batchCheckCard();
  const cs=nodes(counters).filter(n=>n.type==='Text'&&n.backgroundColor&&n.constraintSize?.minHeight);
  assert.equal(cs.length,4);const avail=counters.toolsInnerWidth(17);for(const n of cs){assert.ok(n.width+8<=avail);assert.equal(n.height,undefined);assert.equal(n.maxFontScale,scale);}
 }
 const {owner:long}=make({}, {width:320,scale:3.2});long.actionButton('Re-read previously saved source with a long label',false,true,()=>{});
 const longTarget=nodes(long).find(n=>n.onClick);assert.ok(longTarget.constraintSize.minHeight>44);assert.equal(longTarget.height,undefined);assert.equal(longTarget.maxLines,undefined);
 console.log(JSON.stringify({rows:samples.length,controls:'actual SDK ReaderButton and parent Builders',forms:[...new Set(samples.map(x=>x.form))],boundary:'SDK attributes and parent inequalities only; no native shaping, pointer or system-setting evidence',samples}));
}
if(selectedCase==='entity-admission'){
 for(const selected of [false,true])for(const state of ['ready','blocked','unknown','confirmed']){
  const {owner,calls}=make();owner.snapshot.editorSourceId=bookSource.sourceId;
  if(state==='blocked')owner.snapshot.original={blocked:true};
  if(state==='unknown')owner.snapshot.editorReadback={confirmation:'unknown'};
  if(state==='confirmed')owner.snapshot.editorReadback={confirmation:'confirmed',fact:'confirmedRefreshFailed'};
  owner.sourceRow({source:bookSource,selected,actionsEnabled:true});owner.editorCard();
  const actual=nodes(owner),selection=actual.find(n=>n.create===(selected?'已选':'选择')&&n.onClick),edit=actual.find(n=>n.create==='编辑'&&n.onClick),debug=actual.find(n=>n.create==='调试'&&n.onClick);
  assert.ok(selection.accessibilityText.includes(bookSource.name));assert.ok(selection.accessibilityText.includes(selected?'已选':'未选'));
  assert.equal(edit.accessibilityText,'编辑书源：'+bookSource.name);assert.equal(debug.accessibilityText,'调试书源：'+bookSource.name);
  selection.onClick();debug.onClick();assert.deepEqual(calls.slice(0,2),['toggle','debugSource'],'readonly selection/debug remain permitted');
  edit.onClick();const input=actual.find(n=>n.type==='TextArea');assert.equal(input.accessibilityText,'书源 JSON：'+bookSource.sourceId);input.onChange('changed');
  const save=actual.find(n=>n.create==='校验并保存'&&n.onClick);save.onClick();
  if(state==='ready')assert.deepEqual(calls.slice(2),['openEditor',['editor','changed'],'save']);else assert.equal(calls.length,2,'blocked/unknown/confirmed UI does not dispatch replacement writes');
 }
 const {owner}=make();owner.debugCard();const input=nodes(owner).find(n=>n.type==='TextInput');assert.ok(input.height>=44);assert.equal(input.accessibilityText,'检测关键词：'+bookSource.sourceId);
}
if(selectedCase==='legacy-isolation'){
 const baseline=new URL('../.reader-artifacts/source-tools-accessibility-20261103/baseline/',import.meta.url);
 const beforeButton=readFileSync(new URL('entry/src/main/ets/features/common/ReaderButton.ets',baseline),'utf8');
 const afterButton=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderButton.ets',import.meta.url),'utf8');
 const successor=afterButton
  .replace(" || this.id === 'source-tools-action' || this.id === 'source-tools-compact'",'')
  .replace("      if (this.id === 'source-tools-action' || this.id === 'source-tools-compact') instance.constraintSize({ minWidth: 44, minHeight: height });\n      else if",'      if')
  .replace("    if (this.id === 'source-management-category') instance.constraintSize({ minWidth: 44 });\n",'');
 assert.equal(successor,beforeButton,'only the registered Tools min-target and Source category 44vp successors differ from the frozen legacy source');
 const beforeSource=readFileSync(new URL('entry/src/main/ets/features/common/ReaderControlSpecs.ets',baseline),'utf8');
 const before=foundationSpecs(readerTypographyRoles,beforeSource),after=foundationSpecs();
 const ids=[...beforeSource.match(/export type ReaderButtonSpecId = ([^;]+);/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const old=foundationModifiers(before,undefined,{buttonSource:beforeButton}),current=foundationModifiers(after);
 function capture(Modifier,id,scale,primary){const values=[];const port=new Proxy({},{get(_target,key){return(...args)=>{values.push([key,...args]);return port;};}});new Modifier(id,primary,true,'intrinsic','day',false,366,scale).applyNormalAttribute(port);return values;}
 for(const id of ids){assert.deepEqual(after.resolveReaderButtonSpec(id),before.resolveReaderButtonSpec(id));for(const scale of [1,2,3.2])for(const primary of [false,true]){
  const actual=capture(current.ReaderButtonTextModifier,id,scale,primary),expected=capture(old.ReaderButtonTextModifier,id,scale,primary);
  if(id==='source-management-category'){assert.deepEqual(actual.filter(value=>value[0]!=='constraintSize'),expected,'Source category retains every legacy modifier outside its approved 44vp minimum');assert.deepEqual(actual.find(value=>value[0]==='constraintSize'),['constraintSize',{minWidth:44}]);}
  else assert.deepEqual(actual,expected,id+' unchanged actual modifier attributes');
 }}
 assert.equal(ids.includes('source-tools-action'),false,'Tools action is a post-baseline finite id');
 assert.equal(ids.includes('source-tools-compact'),false,'Tools compact action is a post-baseline finite id');
 for(const id of ['source-tools-action','source-tools-compact']){const spec=after.resolveReaderButtonSpec(id);assert.equal(spec.height,44);assert.equal(spec.responseOffset,undefined);assert.equal(spec.maxFontScale,undefined);assert.equal(spec.maxLines,0);assert.equal(spec.textEllipsis,false);}
 console.log(JSON.stringify({unchangedOldSpecs:ids.length,modifierContexts:ids.length*6,sourceA11y:'legacy source byte-identical outside registered Tools accessibility/min-target and Source category 44vp successors'}));
}

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
