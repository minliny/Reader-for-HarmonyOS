import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const results=[];
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',message:e.message});}}
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await check('actual TextInput uses explicit compact geometry and live app-theme text without repeating label',()=>{
  const {owner}=createReaderBuilderProbe(source,['editorText']);
  Object.assign(owner,{appThemeScheme:'night',state:ready(),fullInput:()=>true,localPending:false});
  let value='';owner.editorText('替换为（可留空）',()=>value,x=>{value=x;});
  const input=[...owner.nodes.values()].find(n=>n.type==='TextInput');
  assert.equal(input.fontColor,readerAppColor('TOK_READ_INK','night'));
  assert.equal(input.placeholderColor,readerAppColor('TOK_READ_MUTED','night'));
  assert.equal(input.create.placeholder,'');assert.equal(input.borderRadius,6);assert.equal(input.fontSize,11);
  input.onChange('新的输入');owner.replay();assert.equal(input.create.text,'新的输入');
  owner.appThemeScheme='day';owner.replay();assert.equal(input.fontColor,readerAppColor('TOK_READ_INK','day'));
});
await check('actual editor has distinct back and fixed bottom save/cancel outside scrolling fields',()=>{
  const members=['temporaryOverlay','textAction','editorFields','editorText','editorFlag','previewContent',
    ...(source.includes('private editorActions(')?['editorActions']:[])];
  const {owner}=createReaderBuilderProbe(source,members);
  Object.assign(owner,{layer:'editor',draft:state.createReaderControlReplaceDraft(),state:ready(),appThemeScheme:'night',
    availableWidth:320,availableHeight:400,localError:'',localPending:false,fullInput:()=>true,quickInput:()=>false,
    readyInput:()=>true,editorFields(){},dismissTemporaryLayer(){},saveEditor(){},cancelTemporaryLayer(){}});
  owner.temporaryOverlay();const labels=[...owner.nodes.values()].filter(n=>n.type==='Text').map(n=>n.create);
  assert.equal(labels.filter(x=>x==='返回').length,1);assert.equal(labels.filter(x=>x==='取消').length,1);
  assert.equal(labels.filter(x=>x==='保存').length,1);
  assert.match(source,/\.layoutWeight\(1\)\.scrollBar\(BarState\.Auto\)\.align\(Alignment\.TopStart\);\s*if \(this\.layer === 'editor'\) \{\s*this\.editorActions\(\);/,
    'actual Scroll ends before editor actions; footer cannot be hidden beneath all fields');
});
await check('actual reading draft uses real book/source defaults and editing/global creation remain independent',()=>{
  const scopeState=ready();assert.equal(scopeState.defaultScope,'当前书名;https://source.example');
  const loaded=state.beginReaderControlReplaceLoad(scopeState);assert.equal(loaded.defaultScope,scopeState.defaultScope);
  const Host=productionMotionMethods(file,['openEditor'],{createReaderControlReplaceDraft:state.createReaderControlReplaceDraft});
  const owner=Object.assign(new Host(),{state:scopeState,fullInput:()=>true,readyInput:()=>true,setLayer(){}});
  owner.openEditor();assert.equal(owner.draft.scope,scopeState.defaultScope);
  const old={...owner.draft,id:4,scope:'原规则范围',group:undefined,excludeScope:undefined};delete old.original;
  owner.openEditor(old);assert.equal(owner.draft.scope,'原规则范围');
  assert.deepEqual(readerControlReplaceDraftParams(owner.draft),{id:4},'opening existing rule cannot overwrite unseen fields');
  assert.equal(state.createReaderControlReplaceState().defaultScope,'');
  assert.equal(state.createReaderControlReplaceDraft().scope,'','standalone/global creation has no reading context');
  assert.equal(state.createReaderControlReplaceState('local:x:1','本地书','local').defaultScope,'本地书');
  assert.equal(state.createReaderControlReplaceState('missing','','').defaultScope,'','unknown identity is not guessed');
});
await check('save failure retains draft, confirmed save closes, cancel performs no write and pending Back cannot dismiss',async()=>{
  const Host=productionMotionMethods(file,['saveEditor','cancelTemporaryLayer','perform','dismissTemporaryLayer'],{errorMessageOf:e=>e.message});
  let writes=0,fail=true,resolve;
  const owner=Object.assign(new Host(),{layer:'editor',state:ready(),draft:state.createReaderControlReplaceDraft(),localPending:false,
    localError:'',interactionEnabled:true,presentationRevision:0,fullInput:()=>true,readyInput:()=>true,
    onTemporaryLayerChange(){},onSave:async()=>{writes++;if(fail)throw Error('validation failed');}});
  const draft=owner.draft;await owner.saveEditor();assert.equal(owner.layer,'editor');assert.equal(owner.draft,draft);assert.equal(owner.localError,'validation failed');
  fail=false;await owner.saveEditor();assert.equal(owner.layer,'');assert.equal(writes,2);
  owner.layer='editor';owner.cancelTemporaryLayer();assert.equal(owner.layer,'');assert.equal(writes,2);
  owner.layer='editor';owner.onSave=()=>new Promise(r=>{resolve=r;});const task=owner.saveEditor();
  owner.cancelTemporaryLayer();assert.equal(owner.layer,'editor');resolve();await task;assert.equal(owner.layer,'');
});
await check('same mounted footer reacts to mutation, uncertain writes and endpoint input guards',()=>{
  const {owner}=createReaderBuilderProbe(source,['editorActions','readyInput','fullInput','quickInput'],{readerControlReplaceEndpoint});
  Object.assign(owner,{state:ready(),appThemeScheme:'night',motionProgress:1,interactionEnabled:true,localPending:false});
  owner.editorActions();const nodes=[...owner.nodes.values()];const save=nodes.find(n=>n.create==='保存'),cancel=nodes.find(n=>n.create==='取消');
  assert.equal(save.enabled,true);assert.equal(cancel.enabled,true);
  for(const key of ['mutationPending','writeUncertain','canonicalReloadRequired']){
    owner.state[key]=true;owner.replay();assert.equal(save.enabled,false,`${key} immediately disables save`);
    assert.equal(cancel.enabled,key!=='mutationPending');owner.state[key]=false;
  }
  owner.localPending=true;owner.replay();assert.equal(save.enabled,false);assert.equal(cancel.enabled,false);
  owner.localPending=false;owner.motionProgress=.5;owner.replay();assert.equal(save.enabled,false);
  owner.motionProgress=1;owner.replay();assert.equal(save.enabled,true);
});
await check('actual standalone settings Add action has no inherited reading scope',()=>{
  const settingsSource=readFileSync(new URL('../entry/src/main/ets/features/settings/RulesManagementPage.ets',import.meta.url),'utf8');
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax=createRequire(import.meta.url)(`${sdk}/lib/validate_ui_syntax.js`);
  const toggleSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderToggle.ets',import.meta.url),'utf8');
  syntax.componentCollection.customComponents.add('ReaderToggle');
  syntax.propCollection.set('ReaderToggle',new Set([...toggleSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
  class NativeChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const {owner}=createReaderBuilderProbe(settingsSource,['replaceCard','heading','input','booleanField','actionButton','entityRow','smallButton','integerOrZero'],{ReaderToggle:NativeChild});
  let saved;
  Object.assign(owner,{appThemeScheme:'day',snapshot:{replaceRules:[],busy:false},replaceId:-1,replaceName:'独立规则',
    replacePattern:'原文',replaceValue:'替换',replaceEnabled:true,replaceRegex:false,replaceOrder:'0',onSaveReplace:draft=>{saved=draft;},
    defaultScope:'不应污染设置页;https://reading.example'});
  owner.replaceCard();const add=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='新增替换规则');
  assert.ok(add);add.onClick();assert.equal(saved.name,'独立规则');assert.equal(Object.hasOwn(saved,'scope'),false);
  assert.equal(Object.hasOwn(saved,'sourceId'),false);assert.equal(Object.hasOwn(saved,'bookId'),false);
});
for(const result of results)console.log(JSON.stringify(result));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;else console.log(`PH52–54 actual SDK editor and business behavior PASS (${results.length} groups); no device evidence.`);
