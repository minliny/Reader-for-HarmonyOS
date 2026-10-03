import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';



registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const geometry=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts'),morph=await import('../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts'),presentation=await import('../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
const stateApi=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const read=p=>readFileSync(new URL(`../entry/src/main/ets/${p}`,import.meta.url),'utf8');
const source=read('features/reading/ReaderControlReplaceContent.ets'),actionsSource=read('features/common/ReaderBoundedSurfaceActions.ets');
const gateway=read('features/reading/ReaderReplaceQuickGateway.ts'),start=gateway.indexOf('export class ReaderReplacePreview'),end=gateway.indexOf('\n/**',start);
const ReaderReplacePreview=new Function(`${stripTypeScriptTypes(gateway.slice(start,end)).replace(/^export /gm,'')};return ReaderReplacePreview;`)();
const state=(session='book:A:1')=>({...stateApi.createReaderControlReplaceState(session,'书A','https://source.test'),status:'ready',rules:[{id:1,name:'原规则',pattern:'原文',replacement:'替换',scope:'本书',scopeTitle:true,scopeContent:true,scopeSource:false,isRegex:false,isEnabled:true}]});
const props=o=>({state:o.state,motionProgress:o.motionProgress,availableWidth:o.availableWidth,availableHeight:o.availableHeight,fullContentHeight:o.fullContentHeight,quickContentHeight:o.quickContentHeight,interactionEnabled:o.interactionEnabled,dismissTemporaryRevision:o.dismissTemporaryRevision});
function mount(options={},input=source,layer='editor'){
  const p=boundedSurfaceSdk(options),o=p.consumer(input,boundedMembers(input),{...stateApi,...geometry,...morph,...presentation,ReaderReplacePreview,
    registerReaderFonts(){},errorMessageOf:e=>e.message,ScrollSource:{SCROLLER:'ScrollSource.SCROLLER'},
    Scroller:class{currentOffset(){return{yOffset:0};}scrollTo(){}},PathShape:class{commands(path){this.path=path;return this;}},uiContext:{vp2px:n=>n*3}},
    {state:state(),motionProgress:1,availableWidth:338,availableHeight:666,fullContentHeight:666,quickContentHeight:190,interactionEnabled:true,dismissTemporaryRevision:0});
  o.aboutToAppear();if(layer==='editor')o.openEditor();else o.layer=layer;o.initialRender();return{p,o};
}
const tick=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
{
  const {p,o}=mount(),frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface),header=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceHeader),footer=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions);
  const shell=[...frame.nodes.values()].find(n=>n.type==='Column');assert.deepEqual([shell.width,shell.height,shell.padding,shell.borderRadius],[338,666,12,12]);assert.deepEqual(shell.create,{space:8});
  const headerTitle=[...header.nodes.values()].find(n=>n.type==='Text');assert.equal(headerTitle.create,'新增替换规则');assert.equal(headerTitle.fontSize,13);assert.equal([...header.nodes.values()].find(n=>n.type==='Row').height,28);
  const save=[...footer.nodes.values()].find(n=>n.create==='保存'),cancel=[...footer.nodes.values()].find(n=>n.create==='取消');assert.equal(save.height,36);assert.equal(save.enabled,true);
  const input=[...o.nodes.values()].find(n=>n.type==='TextInput');assert.ok(input);input.onChange('当前草稿');p.properties.flush();assert.equal(o.draft.name,'当前草稿');assert.equal(input.create.text,'当前草稿');
  let writes=0,reject;const originalDraft=o.draft;o.onSave=()=>{writes++;return new Promise((_yes,no)=>reject=no);};save.onClick();p.properties.flush();assert.equal(writes,1);assert.equal(save.enabled,false);assert.equal(cancel.enabled,false);save.onClick();cancel.onClick();assert.equal(writes,1);assert.equal(o.layer,'editor');
  reject(Error('validation rejected'));await tick();p.properties.flush();assert.equal(o.layer,'editor');assert.equal(o.draft,originalDraft);assert.equal(o.localError,'validation rejected');assert.equal(save.enabled,true);
  o.updateStateVars({...props(o),state:{...o.state,writeUncertain:true}});p.properties.flush();assert.equal(save.enabled,false);save.onClick();assert.equal(writes,1,'uncertain write cannot be blindly replayed');
  o.updateStateVars({...props(o),state:{...o.state,writeUncertain:false},availableWidth:360,availableHeight:520});p.properties.flush();assert.equal(shell.width,360);assert.equal(shell.height,520);assert.ok(p.walk(o).includes(frame));
  o.draft={...o.draft,original:{id:2}};p.properties.flush();assert.equal(headerTitle.create,'编辑替换规则','title follows same parent state/child props chain');
}
{
  const {p,o}=mount();let resolve,writes=0;o.onSave=()=>{writes++;return new Promise(r=>resolve=r);};
  const footer=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions),save=[...footer.nodes.values()].find(n=>n.create==='保存');save.onClick();p.properties.flush();
  o.updateStateVars({...props(o),state:state('book:B:2')});p.properties.flush();o.openEditor();o.draft.name='book B draft';p.properties.flush();resolve();await tick();p.properties.flush();
  assert.equal(writes,1);assert.equal(o.layer,'editor');assert.equal(o.draft.name,'book B draft');assert.equal(o.localError,'');assert.equal(o.localPending,false,'old save cannot finish new editor');
  o.aboutToDisappear();assert.equal(o.layer,'');const reopened=mount();assert.equal(reopened.o.localPending,false);assert.equal(reopened.o.draft.name,'');
}
{
  const {p,o}=mount();const originalNodes=[...o.nodes.values()].filter(n=>n.type==='Text'&&n.create==='原规则');assert.equal(originalNodes.length,1);const ruleName=originalNodes[0],id=ruleName.id;
  for(const progress of [1,.75,.25,0,.25,.75,1]){o.updateStateVars({...props(o),motionProgress:progress,availableWidth:286+52*progress,availableHeight:190+476*progress});p.properties.flush();assert.equal(ruleName.fontSize,12);assert.equal(ruleName.id,id);assert.equal([...o.nodes.values()].filter(n=>n.type==='Text'&&n.create==='原规则').length,1,'temporary form migration never creates a second canonical list');}
  o.updateStateVars({...props(o),state:{...o.state,rules:[{...o.state.rules[0],name:'当前规则'}]}});p.properties.flush();assert.equal(ruleName.create,'当前规则');assert.equal(ruleName.id,id);
}
for(const layer of ['delete','import-confirm','preview']){const {p,o}=mount({},source,layer);assert.equal(p.walk(o).filter(x=>x instanceof p.deps.ReaderBoundedSurface).length,1);assert.equal(p.walk(o).some(x=>x instanceof p.deps.ReaderBoundedSurfaceActions),false,'only editor gets save/cancel footer');assert.ok(p.nodes(o).some(n=>n.create==='取消'));}
// Shared action implementation propagation with finite family isolation.
const changed=actionsSource.replace(".borderRadius(6)",".borderRadius(7)");assert.notEqual(changed,actionsSource);const {p,o}=mount({ReaderBoundedSurfaceActions:changed});const footer=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions);assert.equal([...footer.nodes.values()].find(n=>n.create==='取消').borderRadius,7);
const tts=new p.deps.ReaderBoundedSurfaceActions(undefined,{specId:'tts-manager'});tts.initialRender();assert.equal([...tts.nodes.values()].find(n=>n.create==='取消').borderRadius,12);
assert.throws(()=>mount({},source.replace('header: (): void => { this.temporaryHeader(); }','header: this.temporaryHeader')),/temporaryTitle|header|bind/,'direct business Builder references are a failing negative control');
assert.throws(()=>{const bad=mount({},source.replace('leading: (): void => { this.temporaryLeading(); }','leading: this.temporaryLeading'));assert.ok(bad.p.nodes(bad.o).some(n=>n.create==='返回'&&n.width===38),'bound leading retains original owner Back');},/bound leading/);
assert.doesNotMatch(source,/\.width\(this\.availableWidth\)\.height\(this\.availableHeight\)\.padding\(12\)/,'private temporary frame deleted');
console.log('bounded retained replace composition PASS: full real SDK owner→Frame/Header/body/actions, current draft/guards/error/unknown/late session/close/reopen, stable canonical row morph, all temporary families, shared variant isolation and missing binding negative control; native removal/layout/focus remain OPEN');
