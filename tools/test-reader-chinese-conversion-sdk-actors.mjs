import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'library-identity':{description:'Current shared appearance actor: retained Props, stale row/finish and teardown admission',resources:[]},
 'durable-recovery':{description:'One current SDK actor journey through existing CLI durable original receipt recovery',resources:[]},
 'legacy-full-compatibility':{description:'Explicit legacy FullPanel diagnostic, excluded from current release prerequisite',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {choiceSource,resolveReaderChoiceSpec,compileReaderChoiceLabelModifier}=await import('./lib/reader-choice-row-probe.mjs');
const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const {readerControlAppearanceEndpoint}=await import('../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts');
const {appearanceSelectMenuHeight}=await import('../entry/src/main/ets/features/common/ReaderSelectAppearanceStyle.ts');
const read=name=>readFileSync(new URL(`../entry/src/main/ets/features/${name}.ets`,import.meta.url),'utf8');
const panel=read('common/ReaderSelectPanel');
const library=selectedCase==='legacy-full-compatibility'?'':read('reading/ReaderControlAppearanceContent'),full=selectedCase==='legacy-full-compatibility'?read('reading/ReaderAppearanceFullPanel'):'';
const parents={library:selectedCase==='legacy-full-compatibility'?'':read('reading/ReaderControlPanel'),full:selectedCase==='legacy-full-compatibility'?read('reading/ReaderAppearanceMotionStage'):''};
const common=['chineseConversionIdentity','chineseConversionMode','onChineseConversionChange'];
const libraryNames=[...common,'appThemeScheme','reduceMotion','motionProgress','interactionEnabled','onMotionChanged','onInputChanged',
  'feedbackMounted','transientFeedback',
  'openSelect','selectClosing','selectIdentity','selectGeneration','selectAnchorX','selectAnchorY','onTemporaryLayerChange',
  'aboutToAppear','aboutToDisappear','selectOverlay','selectionActorIdentity','selectionCloseAction','conversionSelectionCommit','commitSelect','applySelect','selectOptions','selectValue','fullInput','dismissTemporaryLayer','requestSelectClose'];
const fullNames=[...common,'appThemeScheme','reduceMotion','interactionEnabled','onInteractionEnabledChanged',
  'openSelect','selectClosing','selectGeneration','selectMounted','selectAnchorX','selectAnchorY','panelOriginX','panelOriginY','fontDragGeneration',
  'selectOverlay','selectionCloseAction','conversionSelectionAction','conversionSelectionDismiss','applySelectValue','selectOptions','selectValue',
  'aboutToAppear','aboutToDisappear','requestCloseSelect'];
function harness(kind,parentSource=parents[kind],dispatch){
  const finishes=[],calls=[];
  const {ReaderTransientFeedback}=transientFeedbackFixture();
  const accessibility=pureModuleProbe(read('common/ReaderActionAccessibility'),'ReaderActionAccessibility.ets',
    {AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON'}},['ReaderActionAccessibility','readerActionTouchRegion']);
  const sizing=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),
    'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
  const p=boundedSurfaceSdk();Object.assign(p.deps,{resolveReaderChoiceSpec,ReaderChoiceLabelModifier:compileReaderChoiceLabelModifier(),registerReaderFonts(){},
    ...accessibility,...sizing,ReaderTransientFeedback,
    APPEARANCE_SELECT_MENU_WIDTH:104,APPEARANCE_SELECT_OPTION_HEIGHT:25,appearanceSelectMenuHeight,readerControlAppearanceEndpoint,
    readerPageTurnStyle:()=> 'slide',motionAnimateParam:(_id,onFinish)=>({onFinish}),
    uiContext:{getFont:()=>({}),animateTo:(param,action)=>{action();if(param.onFinish)finishes.push(param.onFinish);},
      getMeasureUtils:()=>({measureText:()=>90}),px2vp:n=>n}});
  Object.assign(p.deps,selectedProductionValues(new URL('../entry/src/main/ets/features/common/ReaderSelectPanel.ets',import.meta.url),
    ['OPTION_H','SELECT_PAD','CHEVRON_GAP','CHEVRON_W','CHEVRON_H','SELECT_CHROME'],p.deps));
  p.hooks.lifecycleChildren=true;
  for(const [name,source,names] of [['ReaderChoiceRow',choiceSource,boundedMembers(choiceSource)],
    ['ReaderSelectPanel',panel,boundedMembers(panel)],
    [kind==='library'?'ReaderControlAppearanceContent':'ReaderAppearanceFullPanel',kind==='library'?library:full,kind==='library'?libraryNames:fullNames]]){
    p.childSources[name]=source;p.deps[name]=createReaderBuilderProbe(source,names,p.deps,p.hooks).Component;
  }
  const parent=p.consumer(parentSource,[...common,kind==='library'?'appearanceContent':'appearancePanel'],{},
    {chineseConversionIdentity:'reader:1',chineseConversionMode:'none',onChineseConversionChange:(mode,identity)=>{calls.push({mode,identity});dispatch?.(mode,identity);}});
  Object.assign(parent,{isExpanded:()=>false,contentEndpointHeight:()=>666,contentInputEnabled:()=>true,stageHeight:()=>840,contentInteractionEnabled:()=>true,
    availableWidth:390,availableHeight:844,contentMotionWidth:286,contentMotionHeight:666,contentMotionProgress:1,reduceMotion:false,onTemporaryLayerChange(){}});
  kind==='library'?parent.appearanceContent():parent.appearancePanel();
  const leaf=[...parent.children.values()].find(x=>x instanceof p.deps[kind==='library'?'ReaderControlAppearanceContent':'ReaderAppearanceFullPanel']);assert.ok(leaf);
  Object.assign(leaf,{previewLifecycle:0,previewQueue:[],requestedPreviewFamilies:new Set(),syncMorphScroll(){},cancelFontDrag(){},clearFontDragState(){},selectControlWidth:()=>104});
  function open(){leaf.openSelect='language';leaf.selectClosing=false;leaf.selectGeneration++;if(kind==='library')leaf.selectIdentity=`language:${leaf.selectGeneration}`;}
  open();leaf.selectOverlay();
  const selectors=()=>[...leaf.children.values()].filter(x=>x instanceof p.deps.ReaderSelectPanel);
  const row=(selector,label)=>[...selector.children.values()].find(x=>x instanceof p.deps.ReaderChoiceRow&&x.label===label);
  const click=(selector,label)=>{const r=row(selector,label);assert.ok(r,`actual shared row ${label}`);return [...r.nodes.values()].find(n=>n.onClick).onClick;};
  return{p,parent,leaf,calls,finishes,selectors,click,open};
}
function transientFeedbackFixture(){
  const feedbackStorage=new Map();
  const {ReaderTransientFeedback,READER_TRANSIENT_TOAST_STORAGE_KEY}=pureModuleProbe(
    readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTransientFeedback.ts',import.meta.url),'utf8'),
    'ReaderTransientFeedback.ts',{AppStorage:{get:key=>feedbackStorage.get(key),setOrCreate:(key,value)=>feedbackStorage.set(key,value)}},
    ['ReaderTransientFeedback','READER_TRANSIENT_TOAST_STORAGE_KEY']);
  return {ReaderTransientFeedback,publishedFeedback:()=>feedbackStorage.get(READER_TRANSIENT_TOAST_STORAGE_KEY)};
}
let cases=0;
for(const kind of selectedCase==='durable-recovery'?[]:selectedCase==='legacy-full-compatibility'?['full']:['library']){
  const h=harness(kind),old=h.selectors()[0],oldClick=h.click(old,'繁转简');
  const leaf=h.leaf,leafCount=h.parent.children.size,oldFn=leaf.onChineseConversionChange;
  h.parent.updateStateVars({chineseConversionIdentity:'reader:2',chineseConversionMode:'s2t'});h.p.properties.flush();
  assert.equal(h.parent.children.size,leafCount,'retained outer panel is not remounted');assert.equal(leaf.chineseConversionIdentity,'reader:2');
  assert.equal(leaf.chineseConversionMode,'s2t');assert.equal(leaf.onChineseConversionChange,oldFn,'actual SDK retains regular callback; identity Prop carries admission');
  oldClick();if(h.finishes.length)h.finishes.shift()();assert.deepEqual(h.calls,[],'old physical row cannot borrow the new reader identity');
  assert.equal(leaf.openSelect,'language','old choice cannot close the current layer');
  const fresh=h.selectors().at(-1);assert.notEqual(fresh,old,'only finite selection actor is replaced');
  h.click(fresh,'繁转简')();if(h.finishes.length)h.finishes.pop()();
  assert.deepEqual(h.calls,[{mode:'t2s',identity:'reader:2'}],'fresh actual row reaches original parent callback with captured identity');cases++;
  // Retain a physical callback across close/reopen; the outer component stays.
  const retiredClick=h.click(fresh,'原文');h.open();leaf.selectOverlay();
  retiredClick();if(h.finishes.length)h.finishes.shift()();assert.equal(h.calls.length,1);
  h.click(h.selectors().at(-1),'原文')();if(h.finishes.length)h.finishes.pop()();assert.equal(h.calls.length,2);cases++;
}
for(const kind of selectedCase==='durable-recovery'?[]:selectedCase==='legacy-full-compatibility'?['full']:['library']){
  const h=harness(kind),select=h.selectors()[0];h.click(select,'繁转简')();
  // Real legacy compatibility selection is published on native finish. Library
  // commits immediately, but its old finish still cannot close a reopened layer.
  const before=h.calls.length;h.parent.updateStateVars({chineseConversionIdentity:'new-reader',chineseConversionMode:'none'});h.p.properties.flush();
  h.open();h.leaf.selectOverlay();h.finishes.shift()();assert.equal(h.calls.length,before);
  assert.equal(h.leaf.openSelect,'language','late native finish cannot close successor selection');
  select.aboutToDisappear();h.click(select,'简转繁')();assert.equal(h.calls.length,before);cases++;
}
for(const kind of selectedCase==='durable-recovery'?[]:selectedCase==='legacy-full-compatibility'?['full']:['library']){
  const h=harness(kind),select=h.selectors()[0],old=h.click(select,'繁转简');
  h.leaf.aboutToDisappear();old();if(h.finishes.length)h.finishes.shift()();assert.equal(h.calls.length,0,'actual leaf teardown retires old physical intent');
  h.leaf.aboutToAppear();h.open();h.leaf.selectOverlay();old();if(h.finishes.length)h.finishes.shift()();assert.equal(h.calls.length,0,'old leaf callback does not inherit re-entry');
  h.click(h.selectors().at(-1),'繁转简')();if(h.finishes.length)h.finishes.pop()();assert.equal(h.calls.length,1);cases++;
}
// Negative control: the old direct callback value + no live forwarding cannot
// serve a retained child after an actor change. This is why identity is a Prop.
if(selectedCase==='library-identity'){
  const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
  const {ts,options}=installedEtsCompiler(),source=parents.library;
  const tree=ts.createSourceFile('ReaderControlPanel.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[]);
  const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='ReaderControlPanel');
  const method=owner?.members.find(n=>ts.isMethodDeclaration(n)&&n.name?.text==='appearanceContent');
  assert.ok(method?.body);
  const calls=[];
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
      node.expression.expression.kind===ts.SyntaxKind.ThisKeyword&&node.expression.name.text==='onChineseConversionChange')calls.push(node);
    ts.forEachChild(node,visit);
  }
  visit(method.body);
  assert.equal(calls.length,1,'one actual conversion forwarding callback');
  const [call]=calls;
  assert.equal(call.arguments.length,2);
  const prefix=source.slice(0,call.getStart(tree)),tail=source.slice(call.end);
  const target=call.expression.getText(tree),[mode,identity]=call.arguments.map(arg=>arg.getText(tree));
  for(const [args,expected] of [[`${mode}, (\n${identity}\n)`,'reader:2'],[mode,undefined]]){
    const h=harness('library',prefix+`${target}(${args})`+tail);
    h.parent.updateStateVars({chineseConversionIdentity:'reader:2',chineseConversionMode:'none'});
    h.p.properties.flush();
    h.click(h.selectors().at(-1),'繁转简')();
    assert.deepEqual(h.calls,[{mode:'t2s',identity:expected}]);
    cases++;
  }
}
if(selectedCase==='durable-recovery'){
  const {fixture,until,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
  console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));
  let passed=false;
  try {
  const f=await fixture(true);
  const capabilities=new Set((await f.readCoreIdentity()).data.capabilities);
  f.runtime.supportsCoreCapability=capability=>capabilities.has(capability);
  const names=['chineseConversionIdentity','dispatchChineseConversionAction','chineseConversionAction','loadChineseConversionMode','changeChineseConversionMode'];
  const Reader=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'ReadingExperience',names);
  const {ReaderChineseConversionGateway}=pureModuleProbe(
    readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderChineseConversionGateway.ts',import.meta.url),'utf8'),
    'ReaderChineseConversionGateway.ts',{RulesMutationOwner:f.Owner,RulesManagementGateway:f.Gateway,ReaderRuntimeOwner:f.Runtime},['ReaderChineseConversionGateway']);
  const {ReaderTransientFeedback,publishedFeedback}=transientFeedbackFixture();
  const r=new Reader();Object.assign(r,{mounted:true,lifecycleToken:1,sourceId:'source',bookId:'book',chineseConversionOperationId:'',
    chineseConversionMode:'none',chineseConversionLoaded:false,chineseConversionMutationGeneration:0,chineseConversionGateway:new ReaderChineseConversionGateway(f.runtime),
    isSessionActive:t=>r.mounted&&t===r.lifecycleToken,persistBeforeContentMutation:async()=>()=>true,
    quickSearchPublication:{cancel(){}},publishQuickSearchState(){},phase:'ready',chapter:undefined,
    appForeground:true,windowChromeActive:true,transientFeedback:new ReaderTransientFeedback(),getUIContext:()=>({})});
  const h=harness('library',parents.library,(mode,identity)=>r.dispatchChineseConversionAction(mode,identity));
  h.parent.updateStateVars({chineseConversionIdentity:r.chineseConversionIdentity(),chineseConversionMode:r.chineseConversionMode});h.p.properties.flush();
  const original=h.selectors().at(-1),originalClick=h.click(original,'繁转简');f.options.afterMethod='rules.mutation.apply';
  originalClick();await until(()=>publishedFeedback()?.visible===true);
  assert.match(publishedFeedback().message,/原操作尚未确认/);
  const fixed=JSON.parse(f.disk());assert.equal(fixed.mutation.params.mode,'t2s');
  h.parent.updateStateVars({chineseConversionIdentity:r.chineseConversionIdentity(),chineseConversionMode:r.chineseConversionMode});h.p.properties.flush();
  const before=f.writes().length;originalClick();await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,before,'old physical callback cannot replay unknown write');
  h.click(h.selectors().at(-1),'简转繁')();await until(()=>r.chineseConversionLoaded);
  assert.equal(r.chineseConversionMode,'t2s','actual SDK choice recovers original fixed mode, not replacement draft');assert.equal(f.writes().length,1);
  assert.equal(f.disk(),'');cases++;passed=true;
  } finally {
    const cleanup=await cleanupDurableFixtures({retain:!passed});
    if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));
  }
}
console.log(`PASS ${selectedCase}: ${cases} actual SDK parent→retained appearance leaf→shared selector/choice physical callback journeys; lifecycle/identity guards and current Props preserved. Native removal/layout remain separate target evidence.`);

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
