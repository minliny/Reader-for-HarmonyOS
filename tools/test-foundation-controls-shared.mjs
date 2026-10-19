import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"source": {"description": "实际SourceTools按钮current/retired", "resources": []}, "rules": {"description": "实际Rules按钮与controlled输入", "resources": []}, "sync": {"description": "实际Sync密码/普通native输入", "resources": []}, "rss": {"description": "实际RSS shared child Props与busy", "resources": []}, "json": {"description": "实际JSON表单draft/Enter/local action", "resources": []}, "native-modifier": {"description": "实际ColorMetrics press/disabled协议", "resources": []}, "propagation": {"description": "有限spec/role改变传播和variant隔离", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { foundationControls, foundationSpecs, foundationModifiers } = await import('./lib/reader-foundation-control-probe.mjs');
const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');

const source=file=>readFileSync(new URL('../entry/src/main/ets/features/'+file+'.ets',import.meta.url),'utf8');
function parent(kind,options={}) {
 const shared=foundationControls(options),methods=kind==='source'?['smallButton','actionButton','fullWidthActionButton']:
  kind==='rules'?['input','actionButton','smallButton']:['manualActionButton','webdavInputRow','canMutate','canEdit'];
 const {owner}=createReaderBuilderProbe(source(kind==='source'?'source/SourceToolsPage':kind==='rules'?'settings/RulesManagementPage':'sync/SyncPage'),methods,shared.dependencies,shared.hooks);
 Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false,config:{configured:true},configLoaded:true},busy:false,configSaving:false,operation:{},endpoint:'https://example',username:'name',password:'secret',sourceListRevision:1});
 return {shared,owner,nodes:()=>shared.nodes(owner),flush:()=>shared.flush(owner)};
}
const updateButton=(child,changes)=>child.updateStateVars(Object.assign({scheme:child.scheme,specId:child.specId,label:child.label,primary:child.primary,actionEnabled:child.actionEnabled,layout:child.layout},changes));
const updateField=(child,changes)=>child.updateStateVars(Object.assign({scheme:child.scheme,specId:child.specId,text:child.text,placeholder:child.placeholder,isEditable:child.isEditable,password:child.password},changes));
const checkFont=(node,expected)=>{
 const map={fontFamily:'fontFamily',fontWeight:'fontWeight',fontSize:'fontSizeFp',lineHeight:'lineHeightFp',letterSpacing:'letterSpacingFp'};
 for(const[p,key]of Object.entries(map))if(expected[key]===undefined)assert.equal(Object.hasOwn(node,p),false,p+': AUTO omission');else assert.equal(node[p],expected[key],p);
};
for(const kind of ['source','rules','sync'].filter(kind=>kind===selectedCase)){
 const p=parent(kind);let count=0;
 if(kind==='source')p.owner.actionButton('执行',true,true,()=>count++);
 if(kind==='rules')p.owner.actionButton('执行',true,()=>count++);
 if(kind==='sync')p.owner.manualActionButton('执行',true,()=>count++);
 const child=[...p.owner.children.values()][0];assert.equal(child.constructor,p.shared.button.Component,'actual parent shared Button class');
 const label=p.nodes().find(n=>n.type==='Text'&&n.create==='执行');checkFont(label,readerTypographyRoles[kind==='source'?'TYPE_SOURCE_TOOLS_ACTION':kind==='rules'?'TYPE_RULES_MANAGEMENT_ACTION':'TYPE_APP_COMPACT_PRIMARY_ACTION']);
 const click=p.nodes().find(n=>n.onClick);click.onClick();assert.equal(count,1);
 updateButton(child,{actionEnabled:false,label:'忙态'});p.shared.properties.flush();click.onClick();assert.equal(count,1,'old physical click consumes current disabled Prop');
 updateButton(child,{actionEnabled:true});p.shared.properties.flush();click.onClick();assert.equal(count,2);
 child.aboutToDisappear();click.onClick();assert.equal(count,2,'unmounted action cannot publish');
}
for(const kind of ['source','rules'].filter(kind=>kind===selectedCase)){
 const p=parent(kind);kind==='source'?p.owner.smallButton('小操作',true,()=>{}):p.owner.smallButton('小操作',()=>{});
 const label=p.nodes().find(n=>n.type==='Text');checkFont(label,readerTypographyRoles[kind==='source'?'TYPE_SOURCE_TOOLS_COMPACT_ACTION':'TYPE_RULES_COMPACT_ACTION']);

}
if(selectedCase==='rules') {
 const p=parent('rules'),calls=[];p.owner.input('草稿','输入',(value)=>calls.push(value));
 const child=[...p.owner.children.values()][0];assert.equal(child.constructor,p.shared.field.Component);
 let input=p.nodes().find(n=>n.type==='TextInput');checkFont(input,readerTypographyRoles.TYPE_RULES_MANAGEMENT_INPUT);
 input.onChange('键盘编辑');assert.deepEqual(calls,['键盘编辑']);
 updateField(child,{text:'父层新草稿',isEditable:false});p.shared.properties.flush();input=p.nodes().find(n=>n.type==='TextInput');assert.equal(input.create.text,'父层新草稿');input.onChange('旧输入');assert.equal(calls.length,1);
 child.aboutToDisappear();input.onChange('迟到输入');assert.equal(calls.length,1);
}
// Both native credential branches retain native kind, exact masking and the
// controlled draft. Secrets remain local inputs and never become Text labels.
if(selectedCase==='sync') for(const password of [false,true]){
 const p=parent('sync'),calls=[];p.owner.webdavInputRow('icon','字段','原草稿','提示',password,v=>calls.push(v));
 const child=[...p.owner.children.values()][0],input=p.nodes().find(n=>n.type==='TextInput');
 assert.equal(child.constructor,p.shared.field.Component);checkFont(input,readerTypographyRoles.TYPE_SYNC_INPUT);

 assert.equal(input.nativeInputType,password?'InputType.Password':undefined,'plain input preserves native AUTO input type');
 assert.equal(p.nodes().filter(n=>n.type==='Text').some(n=>n.create==='原草稿'),false,'credentials never paint as label Text');
 input.onChange('键盘新草稿');assert.deepEqual(calls,['键盘新草稿']);
 updateField(child,{text:'父层改草稿',isEditable:false});p.shared.properties.flush();input.onChange('晚键盘');assert.equal(calls.length,1);
 assert.equal(p.nodes().find(n=>n.type==='TextInput').create.text,'父层改草稿');
}
// Production AttributeModifier delegates press/normal/disabled to the existing
// official ColorMetrics seam. The host owns release/cancel state transitions;
// this proves protocol calls and normal endpoint restoration, not pixels.
if(selectedCase==='native-modifier') {
 const platformCalls=[],ColorMetrics={resourceColor(color){platformCalls.push(['resource',color]);return{red:1,green:2,blue:3,blendColor(overlay){platformCalls.push(['blend',overlay]);return{color:'platform-pressed'};}};},rgba(r,g,b,a){platformCalls.push(['rgba',r,g,b,a]);return{r,g,b,a};}};
 const modifiers=foundationModifiers(foundationSpecs(),ColorMetrics),attrs={};
 const native=new Proxy({}, {get(_t,key){return value=>{attrs[key]=value;return native;};}});
 const active=new modifiers.ReaderButtonTextModifier('rules-action',false,true,'equal','day');
 active.applyNormalAttribute(native);const normal=attrs.backgroundColor;
 active.applyPressedAttribute(native);assert.equal(attrs.backgroundColor,'platform-pressed');
 active.applyNormalAttribute(native);assert.equal(attrs.backgroundColor,normal,'release/pointer-cancel normal endpoint');
 assert.ok(platformCalls.some(c=>c[0]==='rgba'&&c[4]===.12));
 const disabled=new modifiers.ReaderButtonTextModifier('rules-action',false,false,'equal','day');
 const before=platformCalls.length;disabled.applyPressedAttribute(native);assert.equal(platformCalls.length,before);assert.equal(attrs.backgroundColor,normal);assert.equal(attrs.opacity,.62);
}
// Common-role change reaches source+rules; changing one geometry spec reaches
// only that finite variant. The native tuple omissions remain untouched.
if(selectedCase==='propagation') {
 const roles={...readerTypographyRoles,TYPE_SOURCE_TOOLS_ACTION:{...readerTypographyRoles.TYPE_SOURCE_TOOLS_ACTION,fontSizeFp:14},TYPE_RULES_MANAGEMENT_ACTION:{...readerTypographyRoles.TYPE_RULES_MANAGEMENT_ACTION,fontSizeFp:14}};
 for(const kind of ['source','rules']){const p=parent(kind,{specs:foundationSpecs(roles)});kind==='source'?p.owner.actionButton('传播',false,true,()=>{}):p.owner.actionButton('传播',false,()=>{});assert.equal(p.nodes().find(n=>n.type==='Text').fontSize,14);}
 const original=foundationSpecs(),specs={...original,resolveReaderButtonSpec:id=>({...original.resolveReaderButtonSpec(id),height:original.resolveReaderButtonSpec(id).height+(id==='source-action'?3:0)})};
 for(const kind of ['source','rules']){const p=parent(kind,{specs});kind==='source'?p.owner.actionButton('变体',false,true,()=>{}):p.owner.actionButton('变体',false,()=>{});assert.equal(p.nodes().find(n=>n.type==='Text').height,original.resolveReaderButtonSpec(kind==='source'?'source-action':'rules-action').height+(kind==='source'?3:0));}
}
// Actual RSS caller deliberately omits foundation dependencies. The common
// SDK resolver must mount real production child and flush its actual @Props.
if(selectedCase==='rss') {
 const properties=createArkUIPropertyRuntimeProbe(),calls=[];
 const probe=createReaderBuilderProbe(source('rss/RssSubscriptionEditorPage'),['snapshot','saveAction'],
  {...properties.sdk,EMPTY_RSS_EDITOR_SNAPSHOT:{busy:false,canSave:true}},properties.hooks);
 Object.assign(probe.owner,{appThemeScheme:'day',onSave:()=>calls.push('save')});
 probe.owner.saveAction();const child=[...probe.owner.children.values()][0];
 assert.equal(typeof child.commit,'function','real production commit exists');assert.equal(typeof child.aboutToDisappear,'function');
 assert.ok(child.nodes instanceof Map,'not an empty stand-in child');
 const label=[...child.nodes.values()].find(n=>n.type==='Text');
 checkFont(label,readerTypographyRoles.TYPE_FORM_LABEL_ACTION);assert.equal(Object.hasOwn(label,'border'),false);
 assert.equal(label.opacity,1);label.onClick();assert.equal(calls.length,1);
 probe.owner.updateStateVars({snapshot:{busy:true,canSave:false}});properties.flush();
 assert.equal(label.enabled,false,'real parent Prop update reaches actual retained Button');assert.equal(label.opacity,.62);
 label.onClick();assert.equal(calls.length,1,'old physical action consumes current busy Prop');
 probe.owner.updateStateVars({snapshot:{busy:false,canSave:true}});properties.flush();label.onClick();assert.equal(calls.length,2);
 child.aboutToDisappear();label.onClick();assert.equal(calls.length,2);
}
// Original JSON and RSS form variants retain native event/placeholder/AUTO
// differences. URL Enter submission is owned by the same live draft owner.
if(selectedCase==='json') {
 const shared=foundationControls(),calls=[];
 const {owner}=createReaderBuilderProbe(source('common/JsonImportDialog'),['formBody','localButton','submitOnlineImport'],shared.dependencies,shared.hooks);
 Object.assign(owner,{appThemeScheme:'day',description:'描述',urlDraft:'https://example.test/a.json',validationMessage:'',onImportOnline:u=>calls.push(u),onSelectLocal:()=>calls.push('local')});
 owner.formBody();const input=shared.nodes(owner).find(n=>n.type==='TextInput'),button=shared.nodes(owner).find(n=>n.type==='Text'&&n.create==='选择本地 JSON 文件');
 checkFont(input,readerTypographyRoles.TYPE_FORM_URL_INPUT);
 assert.equal(input.placeholderColor,readerAppColor('TOK_MUTED','day'));assert.equal(input.backgroundColor,readerAppColor('TOK_SURFACE_FIELD','day'));
 assert.equal(Object.hasOwn(button,'border'),false);assert.equal(Object.hasOwn(button,'opacity'),false,'JSON original opacity AUTO');
 owner.validationMessage='旧错误';input.onChange('  https://example.test/b.json  ');assert.equal(owner.validationMessage,'');input.onSubmit('Enter');assert.deepEqual(calls,['https://example.test/b.json']);
 button.onClick();assert.deepEqual(calls,['https://example.test/b.json','local']);
 const field=[...owner.children.values()].find(c=>c instanceof shared.field.Component);
 updateField(field,{isEditable:false,text:'父层草稿'});shared.properties.flush();input.onChange('旧键盘');input.onSubmit('Enter');assert.equal(calls.length,2);assert.equal(input.create.text,'父层草稿');
 field.aboutToDisappear();input.onSubmit('Enter');assert.equal(calls.length,2);
 const rss=createReaderBuilderProbe(source('rss/RssSubscriptionEditorPage'),['editorField'],shared.dependencies,shared.hooks).owner;
 Object.assign(rss,{appThemeScheme:'day'});rss.editorField('字段','RSS草稿','占位',value=>calls.push(value));
 const plain=shared.nodes(rss).find(n=>n.type==='TextInput');checkFont(plain,readerTypographyRoles.TYPE_FORM_INPUT);
 assert.equal(Object.hasOwn(plain,'onSubmit'),false,'RSS plain field retains native submit AUTO');assert.equal(Object.hasOwn(plain,'placeholderColor'),false,'RSS placeholder AUTO');
 assert.equal(plain.backgroundColor,readerAppColor('TOK_PAPER','day'));plain.onChange('新RSS草稿');assert.equal(calls.at(-1),'新RSS草稿');
 const management=createReaderBuilderProbe(source('rss/RssSubscriptionManagementPage'),['sourceDocumentAction'],shared.dependencies,shared.hooks).owner;
 Object.assign(management,{appThemeScheme:'day'});management.sourceDocumentAction('导入',()=>calls.push('import'));
 const action=shared.nodes(management).find(n=>n.type==='Text');checkFont(action,readerTypographyRoles.TYPE_FORM_COMPACT_ACTION);assert.equal(action.height,36);assert.equal(action.borderRadius,8);assert.equal(action.layoutWeight,1);
 assert.equal(action.backgroundColor,readerAppColor('TOK_PRIMARY_SOFT','day'));assert.equal(Object.hasOwn(action,'border'),false);assert.equal(Object.hasOwn(action,'opacity'),false);action.onClick();assert.equal(calls.at(-1),'import');
}
console.log('PASS foundation controls: three real page consumers, eight bounded buttons/five fields + omitted-dependency actual RSS child, native AUTO/Props/drafts/disabled/unmount and common/variant propagation');

}
