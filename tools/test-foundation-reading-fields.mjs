import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createRequire}from'node:module';
const sdkRequire=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
function compile(source,names,deps,hooks){sdkRequire(sdk+'/lib/component_map.js').ID_ATTRS.clear();return createReaderBuilderProbe(source,names,deps,hooks);}
import{createReaderBuilderProbe}from'./lib/reader-control-builder-probe.mjs';
import{foundationControls,foundationSpecs,readerFoundationTokens}from'./lib/reader-foundation-control-probe.mjs';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/design/foundation-reading-fields-baseline.json',import.meta.url)));
const properties=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','placeholderColor','placeholderFont','backgroundColor','caretColor','textAlign','maxLines','width','height','layoutWeight','padding','border','borderRadius','nativeInputType','accessibilityText','enableKeyboardOnFocus','enterKeyType'];
const tuple=n=>Object.fromEntries(properties.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
// Shared render dependencies are actual common components/modifiers. Native
// rule/model constructor and outer geometry functions are platform/domain IO
// seams: the original/full current Builder and original draft methods compile.
import{DirectoryRuleDraft,readerControlReplaceEndpoint}from'./lib/reader-reading-field-probe.mjs';
function setup(tail,scheme,busy){
 const f=baseline.files.find(f=>f.path.endsWith(tail)),shared=foundationControls(),oldShared=foundationControls();
 const deps={...readerFoundationTokens,DirectoryRuleDraft,readerControlReplaceEndpoint};
 const old=compile('@Component struct OriginalReadingFields {\n'+f.methods.join('\n')+(f.names.includes('build')?'':'\nbuild(){Column(){}}')+'\n}',f.names,{...oldShared.dependencies,...deps},oldShared.hooks).owner;
 const current=compile(readFileSync(new URL('../'+f.path,import.meta.url),'utf8'),f.names,{...shared.dependencies,...deps},shared.hooks).owner;
 const states={appThemeScheme:scheme,scheme,busy,localPending:busy,interactionEnabled:true,motionProgress:1,state:{kind:'ready',mutationPending:busy,writeBlocked:false,writeUncertain:false},query:'原正文关键词',queryInputId:'persistent-reading-input',draftName:'原服务',draftUrl:'https://original.invalid/tts',draftApiKey:'private-fixture-only',draftVoice:'原音色',draftFormat:'mp3',draftClearApiKey:true,errorText:'',rules:[new DirectoryRuleDraft(7,'^卷','2','title')],loaded:true,previewReady:false,preview:[],message:'原提示',generation:3};
 const calls={old:[],current:[]},controller={stopEditing(){}};
 for(const[side,owner]of[['old',old],['current',current]]){
  Object.assign(owner,structuredClone(states));owner.inputController=controller;
  owner.frame=()=>({field:{width:260,height:32,x:18,y:10}});owner.presentation=()=>({contentOpacity:.82,contentBlur:0});owner.focusQueryField=()=>calls[side].push(['focus']);
  owner.onQueryChange=value=>calls[side].push(['query',value]);owner.onTemporaryLayerChange=value=>calls[side].push(['edit',value]);owner.onSearch=()=>calls[side].push(['submit']);
 }
 return{f,shared,oldShared,old,current,calls,controller};
}
let cases=0;
for(const tail of['ReaderControlReplaceContent.ets','ReaderControlSearchContent.ets','ReaderDirectoryRules.ets','ReaderTtsConfigOverlay.ets'])for(const scheme of['day','night'])for(const busy of[false,true]){
 const p=setup(tail,scheme,busy),method=p.f.names[0];
 for(const[side,owner]of[['old',p.old],['current',p.current]]){
  const args=method==='editorText'?['替换内容',()=> '原草稿',value=>p.calls[side].push(['draft',value])]:[];(method==='build'?owner.initialRender.bind(owner):owner[method].bind(owner))(...args);
 }
 const old=p.oldShared.orderedNodes(p.old).filter(n=>n.type==='TextInput'),current=p.shared.orderedNodes(p.current).filter(n=>n.type==='TextInput');assert.equal(current.length,old.length,tail+': no input removed/added');
 for(let i=0;i<old.length;i++){
  assert.deepEqual(tuple(current[i]),tuple(old[i]),tail+': exact physical tuple, AUTO, geometry, password and keyboard');
  assert.deepEqual(current[i].create,old[i].create,tail+': exact constructor draft/placeholder/controller');
  if(old[i].enabled!==false)old[i].onChange('修改草稿');current[i].onChange('修改草稿');
  if(old[i].onEditChange){old[i].onEditChange(true);current[i].onEditChange(true);}
  if(old[i].onSubmit){old[i].onSubmit('EnterKeyType.Search');current[i].onSubmit('EnterKeyType.Search');}
 }
 assert.deepEqual(p.calls.current,p.calls.old,tail+': actual callback semantics retained');
 if(method==='managerForm')for(const key of['draftName','draftUrl','draftApiKey','draftVoice','draftClearApiKey'])assert.equal(p.current[key],p.old[key],key+': original draft/clear-secret transition');
 if(method==='build')assert.deepEqual(p.current.rules,p.old.rules,'actual edit method preserves rule id/field and generation invalidation');
 const child=[...p.current.children.values()].find(c=>c instanceof p.shared.field.Component);assert.ok(child);
 const originalActor=p.shared.nodes(child).find(n=>n.type==='TextInput'),id=originalActor.id;
 child.updateStateVars({scheme,specId:child.specId,text:'父状态新草稿',placeholder:child.placeholder,isEditable:true,password:child.password,inputIdentity:child.inputIdentity,fieldAccessibilityLabel:child.fieldAccessibilityLabel});p.shared.properties.flush();
 const updated=p.shared.nodes(child).find(n=>n.type==='TextInput');assert.equal(updated.create.text,'父状态新草稿');assert.equal(updated.id,id,'same retained native actor, no page remount');
 const count=p.calls.current.length;for(const c of p.current.children.values())if(c instanceof p.shared.field.Component)c.aboutToDisappear();
 for(const n of current){n.onChange('移除后旧物理事件');n.onEditChange?.(false);n.onSubmit?.('EnterKeyType.Search');}assert.equal(p.calls.current.length,count,'late physical input/keyboard handlers reject removed actor');cases++;
}
// Both real directory consumers share finite input geometry, while the level
// field still omits all native fonts/placeholder/keyboard. A named variant
// change reaches the actual caller and cannot leak to the other variant.
{
 const real=foundationSpecs(),changed={...real,resolveReaderFormFieldSpec:id=>({...real.resolveReaderFormFieldSpec(id),height:id==='directory-rule-pattern'?46:real.resolveReaderFormFieldSpec(id).height})};
 const p=setup('ReaderDirectoryRules.ets','day',false),source=readFileSync(new URL('../'+p.f.path,import.meta.url),'utf8'),shared=foundationControls({specs:changed}),probe=compile(source,p.f.names,{...shared.dependencies,DirectoryRuleDraft},shared.hooks).owner;
 Object.assign(probe,{...p.current,rules:[new DirectoryRuleDraft(7,'^卷','2')]});probe.initialRender();const inputs=shared.nodes(probe).filter(n=>n.type==='TextInput');assert.deepEqual(inputs.map(n=>n.height),[46,40]);
 for(const key of['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','nativeInputType'])assert.equal(Object.hasOwn(inputs[1],key),false,'directory level native AUTO '+key);
 assert.throws(()=>{const invalid=foundationControls({specs:{...real,resolveReaderFormFieldSpec:id=>id==='directory-rule-level'?real.resolveReaderFormFieldSpec('rules-input'):real.resolveReaderFormFieldSpec(id)}});const child=new invalid.field.Component(undefined,{specId:'directory-rule-level',text:'2'});child.aboutToAppear();child.initialRender();assert.equal(Object.hasOwn(invalid.nodes(child).find(n=>n.type==='TextInput'),'fontSize'),false);},/strictly equal/,'wrong finite font variant cannot fake native default');
}
console.log(`PASS reading fields: ${cases} full immutable/current SDK family comparisons; eight declarations, actual controller/IME/password/AUTO, retained draft/property actor, original callback/admission, unmounted late delivery, finite propagation and wrong-variant negative`);
