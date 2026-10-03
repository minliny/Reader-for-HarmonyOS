import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { foundationControls, foundationSpecs, foundationModifiers } from './lib/reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
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
for(const kind of ['source','rules','sync']){
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
for(const kind of ['source','rules']){
 const p=parent(kind);kind==='source'?p.owner.smallButton('小操作',true,()=>{}):p.owner.smallButton('小操作',()=>{});
 const label=p.nodes().find(n=>n.type==='Text');checkFont(label,readerTypographyRoles[kind==='source'?'TYPE_SOURCE_TOOLS_COMPACT_ACTION':'TYPE_RULES_COMPACT_ACTION']);
 assert.equal(label.height,30);assert.equal(label.borderRadius,7);assert.deepEqual(label.padding,{left:kind==='source'?10:12,right:kind==='source'?10:12});
}
{
 const p=parent('rules'),calls=[];p.owner.input('草稿','输入',(value)=>calls.push(value));
 const child=[...p.owner.children.values()][0];assert.equal(child.constructor,p.shared.field.Component);
 let input=p.nodes().find(n=>n.type==='TextInput');checkFont(input,readerTypographyRoles.TYPE_RULES_MANAGEMENT_INPUT);assert.equal(input.height,40);assert.equal(input.borderRadius,8);
 input.onChange('键盘编辑');assert.deepEqual(calls,['键盘编辑']);
 updateField(child,{text:'父层新草稿',isEditable:false});p.shared.properties.flush();input=p.nodes().find(n=>n.type==='TextInput');assert.equal(input.create.text,'父层新草稿');input.onChange('旧输入');assert.equal(calls.length,1);
 child.aboutToDisappear();input.onChange('迟到输入');assert.equal(calls.length,1);
}
// Both native credential branches retain native kind, exact masking and the
// controlled draft. Secrets remain local inputs and never become Text labels.
for(const password of [false,true]){
 const p=parent('sync'),calls=[];p.owner.webdavInputRow('icon','字段','原草稿','提示',password,v=>calls.push(v));
 const child=[...p.owner.children.values()][0],input=p.nodes().find(n=>n.type==='TextInput');
 assert.equal(child.constructor,p.shared.field.Component);checkFont(input,readerTypographyRoles.TYPE_SYNC_INPUT);
 assert.equal(input.height,36);assert.equal(input.borderRadius,6);assert.deepEqual(input.padding,{left:11,right:11});
 assert.equal(input.nativeInputType,password?'InputType.Password':undefined,'plain input preserves native AUTO input type');
 assert.equal(p.nodes().filter(n=>n.type==='Text').some(n=>n.create==='原草稿'),false,'credentials never paint as label Text');
 input.onChange('键盘新草稿');assert.deepEqual(calls,['键盘新草稿']);
 updateField(child,{text:'父层改草稿',isEditable:false});p.shared.properties.flush();input.onChange('晚键盘');assert.equal(calls.length,1);
 assert.equal(p.nodes().find(n=>n.type==='TextInput').create.text,'父层改草稿');
}
// Production AttributeModifier delegates press/normal/disabled to the existing
// official ColorMetrics seam. The host owns release/cancel state transitions;
// this proves protocol calls and normal endpoint restoration, not pixels.
{
 const platformCalls=[],ColorMetrics={resourceColor(color){platformCalls.push(['resource',color]);return{red:1,green:2,blue:3,blendColor(overlay){platformCalls.push(['blend',overlay]);return{color:'platform-pressed'};}};},rgba(r,g,b,a){platformCalls.push(['rgba',r,g,b,a]);return{r,g,b,a};}};
 const modifiers=foundationModifiers(foundationSpecs(),ColorMetrics),attrs={};
 const native=new Proxy({}, {get(_t,key){return value=>{attrs[key]=value;return native;};}});
 const active=new modifiers.ReaderButtonTextModifier('rules-action',false,true,'equal','day');
 active.applyNormalAttribute(native);const normal=attrs.backgroundColor;
 active.applyPressedAttribute(native);assert.equal(attrs.backgroundColor,'platform-pressed');assert.equal(attrs.fontSize,12);
 active.applyNormalAttribute(native);assert.equal(attrs.backgroundColor,normal,'release/pointer-cancel normal endpoint');
 assert.equal(attrs.height,40);assert.equal(attrs.borderRadius,8);assert.ok(platformCalls.some(c=>c[0]==='rgba'&&c[4]===.12));
 const disabled=new modifiers.ReaderButtonTextModifier('rules-action',false,false,'equal','day');
 const before=platformCalls.length;disabled.applyPressedAttribute(native);assert.equal(platformCalls.length,before);assert.equal(attrs.backgroundColor,normal);assert.equal(attrs.opacity,.62);
}
// Common-role change reaches source+rules; changing one geometry spec reaches
// only that finite variant. The native tuple omissions remain untouched.
{
 const roles={...readerTypographyRoles,TYPE_SOURCE_TOOLS_ACTION:{...readerTypographyRoles.TYPE_SOURCE_TOOLS_ACTION,fontSizeFp:14},TYPE_RULES_MANAGEMENT_ACTION:{...readerTypographyRoles.TYPE_RULES_MANAGEMENT_ACTION,fontSizeFp:14}};
 for(const kind of ['source','rules']){const p=parent(kind,{specs:foundationSpecs(roles)});kind==='source'?p.owner.actionButton('传播',false,true,()=>{}):p.owner.actionButton('传播',false,()=>{});assert.equal(p.nodes().find(n=>n.type==='Text').fontSize,14);}
 const original=foundationSpecs(),specs={...original,resolveReaderButtonSpec:id=>({...original.resolveReaderButtonSpec(id),height:original.resolveReaderButtonSpec(id).height+(id==='source-action'?3:0)})};
 for(const kind of ['source','rules']){const p=parent(kind,{specs});kind==='source'?p.owner.actionButton('变体',false,true,()=>{}):p.owner.actionButton('变体',false,()=>{});assert.equal(p.nodes().find(n=>n.type==='Text').height,kind==='source'?45:40);}
}
console.log('PASS foundation controls: three real page consumers, five bounded buttons/three fields, native AUTO/Props/drafts/disabled/unmount and common/variant propagation');
