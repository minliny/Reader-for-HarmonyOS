import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'library-identity':{description:'Current shared appearance actor: retained Props, stale row/finish and teardown admission',resources:[]},
 'durable-recovery':{description:'One current SDK actor journey through existing CLI durable original receipt recovery',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {choiceSource,resolveReaderChoiceSpec,compileReaderChoiceLabelModifier}=await import('./lib/reader-choice-row-probe.mjs');
const {readerControlAppearanceEndpoint}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceGeometry.ts');
const {appearanceSelectMenuHeight}=await import('../entry/src/main/ets/ui/controls/ReaderSelectAppearanceStyle.ts');
const read=name=>readFileSync(new URL(`../entry/src/main/ets/features/${name}.ets`,import.meta.url),'utf8');
const panel=read('../ui/controls/ReaderSelectPanel');
const library=read('reading/ReaderControlAppearanceContent');
const libraryParent=read('reading/ReaderControlPanel');
const common=['chineseConversionIdentity','chineseConversionMode','onChineseConversionChange'];
const libraryNames=[...common,'appThemeScheme','reduceMotion','motionProgress','interactionEnabled','onMotionChanged','onInputChanged',
  'openSelect','selectClosing','selectIdentity','selectGeneration','selectAnchorX','selectAnchorY','onTemporaryLayerChange',
  'aboutToAppear','aboutToDisappear','selectOverlay','selectionActorIdentity','selectionCloseAction','conversionSelectionCommit','commitSelect','applySelect','selectOptions','selectValue','fullInput','dismissTemporaryLayer','requestSelectClose'];
function harness(parentSource=libraryParent,dispatch){
  const finishes=[],calls=[];
  const p=boundedSurfaceSdk();Object.assign(p.deps,{resolveReaderChoiceSpec,ReaderChoiceLabelModifier:compileReaderChoiceLabelModifier(),registerReaderFonts(){},
    OPTION_H:36,SELECT_PAD:10,CHEVRON_GAP:8,CHEVRON_W:12,CHEVRON_H:8,SELECT_CHROME:40,
    APPEARANCE_SELECT_MENU_WIDTH:104,APPEARANCE_SELECT_OPTION_HEIGHT:25,appearanceSelectMenuHeight,readerControlAppearanceEndpoint,
    readerPageTurnStyle:()=> 'slide',motionAnimateParam:(_id,onFinish)=>({onFinish}),
    uiContext:{getFont:()=>({}),animateTo:(param,action)=>{action();if(param.onFinish)finishes.push(param.onFinish);},
      getMeasureUtils:()=>({measureText:()=>90}),px2vp:n=>n}});
  p.hooks.lifecycleChildren=true;
  for(const [name,source,names] of [['ReaderChoiceRow',choiceSource,boundedMembers(choiceSource)],
    ['ReaderSelectPanel',panel,boundedMembers(panel)],
    ['ReaderControlAppearanceContent',library,libraryNames]]){
    p.childSources[name]=source;p.deps[name]=createReaderBuilderProbe(source,names,p.deps,p.hooks).Component;
  }
  const parent=p.consumer(parentSource,[...common,'appearanceContent'],{},
    {chineseConversionIdentity:'reader:1',chineseConversionMode:'none',onChineseConversionChange:(mode,identity)=>{calls.push({mode,identity});dispatch?.(mode,identity);}});
  Object.assign(parent,{isExpanded:()=>false,contentEndpointHeight:()=>666,contentInputEnabled:()=>true,
    availableWidth:390,availableHeight:844,contentMotionWidth:286,contentMotionHeight:666,contentMotionProgress:1,reduceMotion:false,onTemporaryLayerChange(){}});
  parent.appearanceContent();
  const leaf=[...parent.children.values()].find(x=>x instanceof p.deps.ReaderControlAppearanceContent);assert.ok(leaf);
  Object.assign(leaf,{previewLifecycle:0,previewQueue:[],requestedPreviewFamilies:new Set(),syncMorphScroll(){},cancelFontDrag(){},clearFontDragState(){},selectControlWidth:()=>104});
  function open(){leaf.openSelect='language';leaf.selectClosing=false;leaf.selectGeneration++;leaf.selectIdentity=`language:${leaf.selectGeneration}`;}
  open();leaf.selectOverlay();
  const selectors=()=>[...leaf.children.values()].filter(x=>x instanceof p.deps.ReaderSelectPanel);
  const row=(selector,label)=>[...selector.children.values()].find(x=>x instanceof p.deps.ReaderChoiceRow&&x.label===label);
  const click=(selector,label)=>{const r=row(selector,label);assert.ok(r,`actual shared row ${label}`);return [...r.nodes.values()].find(n=>n.onClick).onClick;};
  return{p,parent,leaf,calls,finishes,selectors,click,open};
}
let cases=0;
if(selectedCase==='library-identity'){
  const h=harness(),old=h.selectors()[0],oldClick=h.click(old,'繁转简');
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
if(selectedCase==='library-identity'){
  const h=harness(),select=h.selectors()[0];h.click(select,'繁转简')();
  // Selection commits immediately. An old native finish cannot close a reopened layer.
  const before=h.calls.length;h.parent.updateStateVars({chineseConversionIdentity:'new-reader',chineseConversionMode:'none'});h.p.properties.flush();
  h.open();h.leaf.selectOverlay();h.finishes.shift()();assert.equal(h.calls.length,before);
  assert.equal(h.leaf.openSelect,'language','late native finish cannot close successor selection');
  select.aboutToDisappear();h.click(select,'简转繁')();assert.equal(h.calls.length,before);cases++;
}
if(selectedCase==='library-identity'){
  const h=harness(),select=h.selectors()[0],old=h.click(select,'繁转简');
  h.leaf.aboutToDisappear();old();if(h.finishes.length)h.finishes.shift()();assert.equal(h.calls.length,0,'actual leaf teardown retires old physical intent');
  h.leaf.aboutToAppear();h.open();h.leaf.selectOverlay();old();if(h.finishes.length)h.finishes.shift()();assert.equal(h.calls.length,0,'old leaf callback does not inherit re-entry');
  h.click(h.selectors().at(-1),'繁转简')();if(h.finishes.length)h.finishes.pop()();assert.equal(h.calls.length,1);cases++;
}
// Negative control: the old direct callback value + no live forwarding cannot
// serve a retained child after an actor change. This is why identity is a Prop.
if(selectedCase==='library-identity'){
  const broken=libraryParent.replace('this.onChineseConversionChange(mode, identity)','this.onChineseConversionChange(mode)');
  const h=harness(broken);h.parent.updateStateVars({chineseConversionIdentity:'reader:2',chineseConversionMode:'none'});h.p.properties.flush();
  h.click(h.selectors().at(-1),'繁转简')();assert.equal(h.calls[0].identity,undefined);cases++;
}
if(selectedCase==='durable-recovery'){
  const {fixture,compile,until,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
  const {createRequire}=await import('node:module');
  const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
  console.log(JSON.stringify({kind:'reader-existing-tool-evidence',...durableFixtureToolEvidence()}));
  try {
  const f=await fixture(true),require=createRequire(import.meta.url);
  const sdkPath=resolveEtsLoaderRoot();
  const ts=require(`${sdkPath}/node_modules/typescript`),options=require(`${sdkPath}/lib/ets_checker.js`).compilerOptions;
  const source=read('reading/LocalReadingExperience'),tree=ts.createSourceFile('LRE.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=['chineseConversionIdentity','dispatchChineseConversionAction','chineseConversionAction','loadChineseConversionMode','changeChineseConversionMode'];
  const klass=tree.statements.find(n=>n.members&&names.every(name=>n.members.some(m=>m.name?.getText(tree)===name)));
  const body=names.map(name=>klass.members.find(m=>m.name?.getText(tree)===name).getText(tree)).join('\n');
  const Reader=compile('features/reading/ui/LocalReadingExperience.ets','Reader',{},true,`export class Reader{${body}}`);
  const Gateway=compile('features/reading/application/ReaderChineseConversionGateway.ts','ReaderChineseConversionGateway',
    {RulesMutationOwner:f.Owner,RulesManagementGateway:f.Gateway,ReaderRuntimeOwner:f.Runtime},true);
  const r=new Reader();Object.assign(r,{mounted:true,lifecycleToken:1,sourceId:'source',bookId:'book',chineseConversionOperationId:'',
    chineseConversionMode:'none',chineseConversionLoaded:false,chineseConversionMutationGeneration:0,chineseConversionGateway:new Gateway(f.runtime),
    isSessionActive:t=>r.mounted&&t===r.lifecycleToken,persistBeforeContentMutation:async()=>()=>true,
    quickSearchPublication:{cancel(){}},publishQuickSearchState(){},phase:'ready',chapter:undefined,notices:[],
    getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>r.notices.push(message)})})});
  const h=harness(libraryParent,(mode,identity)=>r.dispatchChineseConversionAction(mode,identity));
  h.parent.updateStateVars({chineseConversionIdentity:r.chineseConversionIdentity(),chineseConversionMode:r.chineseConversionMode});h.p.properties.flush();
  const original=h.selectors().at(-1),originalClick=h.click(original,'繁转简');f.options.afterMethod='rules.mutation.apply';
  originalClick();await until(()=>r.notices.length===1);const fixed=JSON.parse(f.disk());assert.equal(fixed.mutation.params.mode,'t2s');
  h.parent.updateStateVars({chineseConversionIdentity:r.chineseConversionIdentity(),chineseConversionMode:r.chineseConversionMode});h.p.properties.flush();
  const before=f.writes().length;originalClick();await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,before,'old physical callback cannot replay unknown write');
  h.click(h.selectors().at(-1),'简转繁')();await until(()=>r.chineseConversionLoaded);
  assert.equal(r.chineseConversionMode,'t2s','actual SDK choice recovers original fixed mode, not replacement draft');assert.equal(f.writes().length,1);
  assert.equal(f.disk(),'');cases++;
  } finally { await cleanupDurableFixtures(); }
}
console.log(`PASS ${selectedCase}: ${cases} actual SDK parent→retained appearance leaf→shared selector/choice physical callback journeys; lifecycle/identity guards and current Props preserved. Native removal/layout remain separate target evidence.`);

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
