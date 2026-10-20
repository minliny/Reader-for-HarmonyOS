import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "input-sdk-feedback": {
    "description": "actual TextInput uses explicit compact geometry and live app-theme text without repeating label; selected actual production members/SDK only",
    "resources": []
  },
  "bounded-editor-actions": {
    "description": "actual editor has distinct back and fixed bottom save/cancel outside scrolling fields; selected actual production members/SDK only",
    "resources": []
  },
  "draft-scope": {
    "description": "actual reading draft uses real book/source defaults and editing/global creation remain independent; selected actual production members/SDK only",
    "resources": []
  },
  "save-cancel": {
    "description": "save failure retains draft, confirmed save closes, cancel performs no write and pending Back cannot dismiss; selected actual production members/SDK only",
    "resources": []
  },
  "retained-footer-admission": {
    "description": "same mounted footer reacts to mutation, uncertain writes and endpoint input guards; selected actual production members/SDK only",
    "resources": []
  },
  "standalone-add-scope": {
    "description": "actual standalone settings Add action has no inherited reading scope; selected actual production members/SDK only",
    "resources": []
  }
};

async function case_input_sdk_feedback() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('actual TextInput uses explicit compact geometry and live app-theme text without repeating label',()=>{
  const shared=foundationControls();
  const {owner}=createReaderBuilderProbe(source,['editorText','fullInput'],{...shared.dependencies,readerControlReplaceEndpoint},shared.hooks);
  Object.assign(owner,{appThemeScheme:'night',state:ready(),motionProgress:1,interactionEnabled:true,localPending:false});
  let value='';owner.editorText('替换为（可留空）',()=>value,x=>{value=x;});
  const input=shared.nodes(owner).find(n=>n.type==='TextInput');
  assert.equal(input.fontColor,readerAppColor('TOK_READ_INK','night'));
  assert.equal(input.placeholderColor,readerAppColor('TOK_READ_MUTED','night'));
  assert.equal(input.create.placeholder,'');assert.ok(input.borderRadius>=0&&input.fontSize>0,'valid current native input style; exact 6/11 requires separate approved spec');
  input.onChange('新的输入');shared.flush(owner);assert.equal(input.create.text,'新的输入');
  owner.appThemeScheme='day';shared.flush(owner);assert.equal(input.fontColor,readerAppColor('TOK_READ_INK','day'));
});

}

async function case_bounded_editor_actions() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('actual editor has distinct back and fixed bottom save/cancel outside scrolling fields',()=>{
  const members=['temporaryOverlay','temporaryTitle','temporaryHeader','temporaryLeading','temporaryAccessory','temporaryActions','temporaryBody','originalRecoveryAction','textAction','editorFields','editorText','editorFlag','previewContent',
    ...(source.includes('private editorActions(')?['editorActions']:[])];
  const composition=boundedSurfaceSdk(),owner=composition.consumer(source,members);
  Object.assign(owner,{layer:'editor',draft:state.createReaderControlReplaceDraft(),state:ready(),appThemeScheme:'night',
    availableWidth:320,availableHeight:400,localError:'',localPending:false,fullInput:()=>true,quickInput:()=>false,
    readyInput:()=>true,editorFields(){},dismissTemporaryLayer(){},saveEditor(){},cancelTemporaryLayer(){}});
  owner.temporaryOverlay();const labels=composition.nodes(owner).filter(n=>n.type==='Text').map(n=>n.create);
  assert.equal(labels.filter(x=>x==='返回').length,1);assert.equal(labels.filter(x=>x==='取消').length,1);
  assert.equal(labels.filter(x=>x==='保存').length,1);
});

}

async function case_draft_scope() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('actual reading draft uses real book/source defaults and editing/global creation remain independent',()=>{
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

}

async function case_save_cancel() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('save failure retains draft, confirmed save closes, cancel performs no write and pending Back cannot dismiss',async()=>{
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

}

async function case_retained_footer_admission() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('same mounted footer reacts to mutation, uncertain writes and endpoint input guards',()=>{
  const composition=boundedSurfaceSdk(),owner=composition.consumer(source,['editorActions','readyInput','fullInput','quickInput'],{readerControlReplaceEndpoint});
  Object.assign(owner,{state:ready(),appThemeScheme:'night',motionProgress:1,interactionEnabled:true,localPending:false});
  owner.editorActions();const nodes=composition.nodes(owner);const save=nodes.find(n=>n.create==='保存'),cancel=nodes.find(n=>n.create==='取消');
  assert.equal(save.enabled,true);assert.equal(cancel.enabled,true);
  for(const key of ['mutationPending','writeUncertain','canonicalReloadRequired']){
    owner.state[key]=true;owner.replay();composition.properties.flush();assert.equal(save.enabled,false,`${key} immediately disables save`);
    assert.equal(cancel.enabled,key!=='mutationPending');owner.state[key]=false;
  }
  owner.localPending=true;owner.replay();composition.properties.flush();assert.equal(save.enabled,false);assert.equal(cancel.enabled,false);
  owner.localPending=false;owner.motionProgress=.5;owner.replay();composition.properties.flush();assert.equal(save.enabled,false);
  owner.motionProgress=1;owner.replay();composition.properties.flush();assert.equal(save.enabled,true);
});

}

async function case_standalone_add_scope() {
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, registerHooks } = await import('node:module');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const state = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const { readerControlReplaceEndpoint } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION } =
  loadReaderTypographyRoles(typographySource);
const rulesTypography = { TYPE_RULES_MANAGEMENT_HEADING, TYPE_RULES_MANAGEMENT_INPUT, TYPE_RULES_MANAGEMENT_ACTION };
const file = new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url);
const source = readFileSync(file,'utf8');
const ready = () => ({...state.createReaderControlReplaceState('s:b:1','当前书名','https://source.example'),status:'ready'});
await (async (_label,fn)=>await fn())('actual standalone settings Add action has no inherited reading scope',()=>{
  const settingsSource=readFileSync(new URL('../entry/src/main/ets/features/settings/RulesManagementPage.ets',import.meta.url),'utf8');
  const sdk=resolveEtsLoaderRoot();
  const syntax=createRequire(import.meta.url)(`${sdk}/lib/validate_ui_syntax.js`);
  const toggleSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderToggle.ets',import.meta.url),'utf8');
  syntax.componentCollection.customComponents.add('ReaderToggle');
  syntax.propCollection.set('ReaderToggle',new Set([...toggleSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
  class NativeChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const foundation=foundationControls();
  const {owner}=createReaderBuilderProbe(settingsSource,['replaceCard','heading','input','booleanField','actionButton','entityRow','smallButton','integerOrZero'],{...foundation.dependencies,ReaderToggle:NativeChild,...rulesTypography},foundation.hooks);
  let saved;
  Object.assign(owner,{appThemeScheme:'day',snapshot:{replaceRules:[],busy:false},replaceId:-1,replaceName:'独立规则',
    replacePattern:'原文',replaceValue:'替换',replaceEnabled:true,replaceRegex:false,replaceOrder:'0',onSaveReplace:draft=>{saved=draft;},
    defaultScope:'不应污染设置页;https://reading.example'});
  owner.replaceCard();const add=foundation.nodes(owner).find(n=>n.type==='Text'&&n.create==='新增替换规则');
  assert.ok(add);add.onClick();assert.equal(saved.name,'独立规则');assert.equal(Object.hasOwn(saved,'scope'),false);
  assert.equal(Object.hasOwn(saved,'sourceId'),false);assert.equal(Object.hasOwn(saved,'bookId'),false);
});

}

const implementations = {'input-sdk-feedback':case_input_sdk_feedback,'bounded-editor-actions':case_bounded_editor_actions,'draft-scope':case_draft_scope,'save-cancel':case_save_cancel,'retained-footer-admission':case_retained_footer_admission,'standalone-add-scope':case_standalone_add_scope};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
