import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"consumer-admission": {"description": "实际分组/编辑/底栏callback准入与退役拒绝", "resources": []}, "controlled-fields": {"description": "原生默认字段、numeric键盘、controlled草稿与有限spec负例", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {foundationControls,foundationSpecs,readerFoundationTokens} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');

const {default: assert} = await import('node:assert/strict');
const baseline=JSON.parse(readFileSync(new URL('./fixtures/design/foundation-shelf-field-baseline.json',import.meta.url)));
const properties=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','placeholderColor','backgroundColor','textAlign','maxLines','width','height','layoutWeight','padding','border','borderRadius','opacity','responseRegion','nativeInputType'];
const tuple=n=>Object.fromEntries(properties.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
const callbacks=['onSaveGroup','onClearGroupEditor','onSelectGroup','onToggleGroupShown','onDeleteGroup','onSelectBook','onAssignBook','onGroupNameChanged','onGroupOrderChanged','onAssignmentGroupChanged','onEditorDraftChanged','onCancelEditor','onSaveEditor','onBack','onOpenOriginal'];
// Native Repeat paint adapter only; the production assignment Builder and
// original row methods remain the SDK inputs. No business owner is replaced.
const Repeat=function Repeat(items){return{each(fn){this.generator=fn;return this;},key(){return this;},virtualScroll(){return this;},render(){items.forEach((item,index)=>this.generator({item,index}));}};};
const methods=['actionButton','smallAction','groupRow','assignmentBookRow','groupEditorCard','assignmentCard','editorCard','bottomActions'];
let cases=0;
function fixture(tail,scheme,busy=false,blocked=false){
 const f=baseline.files.find(f=>f.path.endsWith(tail)),shared=foundationControls(),beforeShared=foundationControls(),beforeSource='@Component struct OriginalFiniteControls {\n'+f.methods.join('\n')+'\nbuild(){Column(){}}\n}',afterSource=readFileSync(new URL('../'+f.path,import.meta.url),'utf8');
 const deps={...readerFoundationTokens,RSS_DETAIL_ACTION_AREA_HEIGHT:68,InputType:{Number:"InputType.Number"},ScrollDirection:{Horizontal:"ScrollDirection.Horizontal"},Repeat};
 const before=createReaderBuilderProbe(beforeSource,f.names,{...beforeShared.dependencies,...deps},beforeShared.hooks).owner,after=createReaderBuilderProbe(afterSource,f.names,{...shared.dependencies,...deps},shared.hooks).owner;
 const states={appThemeScheme:scheme,snapshot:{busy,mutationBlocked:blocked,selectedGroupId:3,selectedSourceId:2,selectedBookId:7,groupNameDraft:'原分组',groupOrderDraft:'12',assignmentGroupDraft:'目标分组',data:{books:[],groups:[]},editorSourceId:'source',editorText:'{"bookSourceUrl":"exact"}'},item:{link:'https://original.test'},cardWidth:300};
 Object.assign(before,structuredClone(states));Object.assign(after,structuredClone(states));before.__Repeat=after.__Repeat=items=>Repeat(items);before.contentFrame=after.contentFrame=()=>({width:300,left:18,right:18});const calls={before:[],after:[]};
 for(const name of callbacks){before[name]=(...args)=>calls.before.push([name,...args]);after[name]=(...args)=>calls.after.push([name,...args]);}
 return {f,shared,beforeShared,before,after,calls};
}
if(selectedCase === 'consumer-admission') for(const scheme of ['day','night'])for(const busy of [false,true])for(const blocked of [false,true])for(const method of methods){
 const tail=method==='editorCard'?'SourceToolsPage.ets':method==='bottomActions'?'RssEntryDetailPage.ets':'BookshelfManagementPage.ets',p=fixture(tail,scheme,busy,blocked);
 const group={groupId:5,groupName:'实际组',groupOrder:2,show:true,bookCount:3},book={sourceId:2,bookId:7,title:'实际书',author:'作者',group:'组'};
 const args=method==='actionButton'?['操作',true]:method==='smallAction'?['操作']:method==='groupRow'?[group]:method==='assignmentBookRow'?[book]:[];
 if(['actionButton','smallAction'].includes(method)){
  p.before[method](...args,()=>p.calls.before.push(['actual']));p.after[method](...args,()=>p.calls.after.push(['actual']));
 }else {p.before[method](...args);p.after[method](...args);}
 const old=p.beforeShared.orderedNodes(p.before),current=p.shared.orderedNodes(p.after),labelKinds=['Text','TextInput','TextArea'];
 const oldCarriers=old.filter(n=>labelKinds.includes(n.type)),newCarriers=current.filter(n=>labelKinds.includes(n.type));
 assert.deepEqual(newCarriers.map(n=>[n.type,n.create]),oldCarriers.map(n=>[n.type,n.create]),method+': actual text/input order and exact draft remain');
 // Native .enabled filters platform delivery; an old callback is never used
 // as a claim that disabled controls can dispatch on the actual platform.
 const oldActions=old.filter(n=>n.onClick),newActions=current.filter(n=>n.onClick);assert.equal(oldActions.length,newActions.length);
 oldActions.forEach(n=>{if(n.enabled!==false)n.onClick();});newActions.forEach(n=>n.onClick());assert.deepEqual(p.calls.after,p.calls.before,method+': original business admission and callbacks');
 const oldInputs=old.filter(n=>n.onChange),newInputs=current.filter(n=>n.onChange);assert.equal(newInputs.length,oldInputs.length);
 oldInputs.forEach(n=>n.onChange('键盘新草稿'));newInputs.forEach(n=>n.onChange('键盘新草稿'));assert.deepEqual(p.calls.after,p.calls.before,method+': original controlled draft callback');
 const count=p.calls.after.length;for(const child of p.after.children.values())if(child instanceof p.shared.button.Component||child instanceof p.shared.field.Component)child.aboutToDisappear();
 newActions.filter(n=>current.some(c=>c===n)).forEach(n=>n.onClick());newInputs.forEach(n=>n.onChange('移除后迟到'));
 assert.equal(p.calls.after.length,count,method+': unmounted actual common controls reject late physical delivery');cases++;
}
if(selectedCase === 'controlled-fields') {
// The original Group inputs preserve real platform defaults, with only the
// ordinal field retaining its actual numeric keyboard. Dynamic parent Props
// update the same native actor; typing while mutation is busy stays allowed.
{
 const p=fixture('BookshelfManagementPage.ets','day',true,true);p.after.groupEditorCard();const inputs=p.shared.nodes(p.after).filter(n=>n.type==='TextInput');assert.equal(inputs.length,2);
 for(const n of inputs)for(const key of ['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','placeholderColor','backgroundColor','border','borderRadius','padding'])assert.equal(Object.hasOwn(n,key),false,key+': real ArkUI default is retained');
 assert.equal(inputs[0].nativeInputType,undefined);assert.equal(inputs[1].nativeInputType,'InputType.Number');inputs[0].onChange('忙时仍可编辑原草稿');assert.deepEqual(p.calls.after,[['onGroupNameChanged','忙时仍可编辑原草稿']]);
 const field=[...p.after.children.values()].find(c=>c instanceof p.shared.field.Component&&c.specId==='shelf-native');field.updateStateVars({scheme:'night',specId:'shelf-native',text:'父层新草稿',placeholder:'分组名',isEditable:true,password:false});p.shared.properties.flush();assert.equal(p.shared.nodes(field).find(n=>n.type==='TextInput').create.text,'父层新草稿');
}
{
 const p=fixture('SourceToolsPage.ets','day');p.after.editorCard();const field=[...p.after.children.values()].find(c=>c instanceof p.shared.field.Component),area=p.shared.nodes(field).find(n=>n.type==='TextArea');assert.equal(field.specId,'source-code');assert.equal(area.fontFamily,'monospace');assert.equal(Object.hasOwn(area,'fontWeight'),false);assert.equal(Object.hasOwn(area,'lineHeight'),false);assert.equal(Object.hasOwn(area,'letterSpacing'),false);
 field.updateStateVars({scheme:'night',specId:'source-code',text:'父层新 JSON',placeholder:'BookSource JSON',isEditable:true,password:false});p.shared.properties.flush();assert.equal(p.shared.nodes(field).find(n=>n.type==='TextArea').create.text,'父层新 JSON');
}
// Finite text/geometry propagation reaches two real callers, without touching
// another variant or inventing physical attributes on native-default fields.
{
 const actual=foundationSpecs(),changed={...actual,resolveReaderButtonSpec:id=>({...actual.resolveReaderButtonSpec(id),height:id==='shelf-action'?48:actual.resolveReaderButtonSpec(id).height})};
 const shared=foundationControls({specs:changed});for(const [id,height]of[['shelf-action',48],['rss-detail-bottom',actual.resolveReaderButtonSpec('rss-detail-bottom').height]]){const c=new shared.button.Component(undefined,{specId:id,label:'传播',actionEnabled:true,scheme:'day',layout:'equal',primary:false,isBusy:false});c.aboutToAppear();c.initialRender();assert.equal(shared.nodes(c).find(n=>n.type==='Text').height,height);}
 const f=baseline.files.find(f=>f.path.endsWith('BookshelfManagementPage.ets')),source=readFileSync(new URL('../'+f.path,import.meta.url),'utf8');assert.throws(()=>{const altered=source.replace("specId: 'shelf-native'","specId: 'rules-input'"),bad=createReaderBuilderProbe(altered,['groupEditorCard','heading','actionButton'],shared.dependencies,shared.hooks).owner;Object.assign(bad,{appThemeScheme:'day',snapshot:{selectedGroupId:0,groupNameDraft:'组',groupOrderDraft:'1'}});bad.groupEditorCard();assert.equal(Object.hasOwn(shared.nodes(bad).find(n=>n.type==='TextInput'),'fontSize'),false);},/strictly equal/,'a fake font role cannot impersonate native-default migration');
}
console.log(`PASS actual shelf/field controls: ${cases} immutable SDK/current common comparisons, exact native/default/numeric keyboard and multiline JSON, retained draft/late callback, bounded variant negative control`);

}

}
