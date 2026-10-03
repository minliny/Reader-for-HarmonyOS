import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fixture,compile,until,deferred,ReaderWriteEvidence} from './lib/rules-mutation-durable-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
const facts=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const projection=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const recovery=await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=source('pages/Index.ets'),pageSource=source('features/settings/RulesManagementPage.ets');
const require=createRequire(import.meta.url),syntax=require((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/lib/validate_ui_syntax.js');
for(const [name,path]of[['RulesManagementPage','features/settings/RulesManagementPage.ets'],['JsonImportDialog','features/common/JsonImportDialog.ets'],['ReaderToggle','features/common/ReaderToggle.ets'],['PageBackBar','features/common/PageBackBar.ets']]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source(path).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
}

class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const names=['rulesManagementContent','rulesManagementSurface','isCurrentRuntime','isCurrentRulesPresentation','getRulesManagementOrchestrator',
 'jsonImportContent','jsonImportSurface','isCurrentJsonImportPresentation','openJsonImport','dismissJsonImport','executeJsonImport','jsonImportTitle','jsonImportDescription'];
let instances=0,cases=0;
const draft={name:'dict',urlRule:'https://dict.invalid/{{key}}',showRule:'$.definition',enabled:true,sortNumber:0};
function host(f){
 const Source=compile('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:f.Runtime},true);
 return compile('features/settings/RulesManagementOrchestrator.ets','RulesManagementOrchestrator',
  {ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,RulesManagementGateway:f.Gateway,SourceGateway:Source,
   RssGateway:class{observeWrites(){}},...facts,...projection,hilog:{error(){}}},true);
}
function index(f,Host,text=indexSource){
 const i=createReaderBuilderProbe(text,names,{RulesManagementOrchestrator:Host,ReaderRuntimeOwner:f.Runtime,RulesManagementPage:Child,JsonImportDialog:Child,deviceInfo:{deviceType:'phone'}}).owner;
 Object.assign(i,{route:'rulesManagement',mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,navigationGeneration:1,detailShelfAdmissionMount:1,
  rssInstanceIdentity:++instances,rulesPresentationIdentity:'',rulesManagementSnapshot:{replaceRules:[],txtTocRules:[],dictRules:[],subscriptions:[],busy:false,statusMessage:''},
  jsonImportVisible:false,jsonImportGeneration:0,jsonImportContext:'ruleBundle'});
 const owner=i.getRulesManagementOrchestrator();let back=0;i.returnFromRulesManagement=()=>back++;
 const props=()=>{i.rulesManagementContent();return [...i.children.values()].at(-1).params;};
 return{i,owner,props,settle:async()=>{await owner.operationTail;},back:()=>back,
  open:async()=>{owner.open(i.rulesPresentationIdentity);await owner.operationTail;}};
}
function actualPage(props){
 const foundation=foundationControls(),sdk=boundedSurfaceSdk();sdk.hooks.lifecycleChildren=true;Object.assign(sdk.hooks.childSources,foundation.hooks.childSources);
 const page=sdk.consumer(pageSource,boundedMembers(pageSource),{...foundation.dependencies,...recovery,EMPTY_RULES_MANAGEMENT_SNAPSHOT:props.snapshot,
  ReaderToggle:Child,PageBackBar:Child},props);
 Object.assign(page,{dictName:draft.name,dictUrl:draft.urlRule,dictShow:draft.showRule,dictEnabled:true,dictOrder:'0'});
 page.dictCard();page.bundleCard();page.recoveryAction();
 return{sdk,page,save:()=>sdk.nodes(page).find(n=>n.create==='保存字典规则'),retry:()=>sdk.nodes(page).find(n=>n.height===36&&n.onClick)};
}
for(const retirement of ['live','route','nav','mount','runtime','unmounted','replacement']){
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();
 const props=x.props(),page=actualPage(props),save=page.save();assert.ok(save?.onClick,'real SDK dict native save');
 let next;
 if(retirement==='route')x.i.route='settings';if(retirement==='nav')x.i.navigationGeneration++;
 if(retirement==='mount')x.i.detailShelfAdmissionMount++;if(retirement==='runtime')f.retire();
 if(retirement==='unmounted')x.i.shelfReceiptRetired=true;if(retirement==='replacement')next=index(f,Host);
 const before=f.calls.length;save.onClick();props.onBack();props.onImportBundle();await x.settle();
 assert.equal(f.writes().length,retirement==='live'?1:0);
 if(retirement!=='live'){assert.equal(f.calls.length,before);assert.equal(x.back(),0);assert.equal(x.i.jsonImportVisible,false);}
 else {assert.equal(x.back(),1);assert.equal(x.i.jsonImportVisible,true);assert.equal(x.i.rulesManagementSnapshot.receipt.receipt.confirmation,'confirmed');}
 if(next)assert.equal(next.owner,x.owner);cases++;
}
{
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();
 const oldProps=x.props(),old=actualPage(oldProps),oldID=x.i.rulesPresentationIdentity,next=index(f,Host);
 assert.equal(x.owner,next.owner);assert.equal(x.i.getRulesManagementOrchestrator(),x.owner);
 assert.equal(x.owner.isPresentationCurrent(next.i.rulesPresentationIdentity),true,'alive old getter cannot steal latest attach');
 assert.equal(x.owner.isPresentationCurrent(oldID),false);x.owner.detachPresentation(oldID);
 const before=f.calls.length;old.save().onClick();oldProps.onDeleteDict('dict');oldProps.onExportBundle();oldProps.onReconcile(0);oldProps.onBack();oldProps.onImportBundle();
 await x.settle();assert.equal(f.calls.length,before);assert.equal(x.back(),0);assert.equal(x.i.jsonImportVisible,false);
 actualPage(next.props()).save().onClick();await next.settle();assert.equal(f.writes().length,1);cases++;
}
{
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();const gate=deferred();
 f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;f.options.afterMethod='rules.mutation.apply';
 actualPage(x.props()).save().onClick();await until(()=>f.writes().length===1);
 const old=structuredClone(x.i.rulesManagementSnapshot),tail=x.owner.operationTail,next=index(f,Host);
 assert.equal(next.owner.operationTail,tail);assert.equal(next.i.rulesManagementSnapshot.busy,true);
 next.props().onSaveDict({...draft,name:'other'});assert.equal(f.writes().length,1);
 gate.resolve();await next.settle();assert.deepEqual(x.i.rulesManagementSnapshot,old);
 await next.open();assert.equal(f.writes().length,1);assert.equal(next.i.rulesManagementSnapshot.ruleMutation.confirmation,'confirmed');
 assert.equal(next.i.rulesManagementSnapshot.dictRules[0].name,'dict');cases++;
}
{
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();f.options.beforeMethod='dict-rule.list';
 actualPage(x.props()).save().onClick();await x.settle();assert.equal(x.i.rulesManagementSnapshot.receipt.receipt.fact,'confirmedRefreshFailed');
 const p=actualPage(x.props()),retry=p.retry();assert.ok(retry);retry.onClick();await x.settle();
 assert.equal(f.writes().length,1);assert.equal(x.i.rulesManagementSnapshot.receipt.receipt.fact,'confirmedCurrent');cases++;
}
{
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();x.props().onImportBundle();x.i.jsonImportContent();
 const old=[...x.i.children.values()].at(-1).params,oldGeneration=x.i.jsonImportGeneration;
 x.i.dismissJsonImport();x.props().onImportBundle();assert.ok(x.i.jsonImportGeneration>oldGeneration);x.i.jsonImportContent();
 const live=[...x.i.children.values()].at(-1).params,before=f.calls.length;
 old.onDismiss();old.onImportOnline('https://old.invalid');old.onSelectLocal();await x.settle();
 assert.equal(x.i.jsonImportVisible,true,'old modal dismiss cannot close reopened presentation');assert.equal(f.calls.length,before);
 live.onDismiss();assert.equal(x.i.jsonImportVisible,false);cases++;
}
{
 const f=await fixture(true),Host=host(f),x=index(f,Host);await x.open();x.props().onImportBundle();x.i.jsonImportContent();
 const modal=[...x.i.children.values()].at(-1).params,next=index(f,Host),before=f.calls.length;
 modal.onSelectLocal();modal.onImportOnline('https://old.invalid');modal.onDismiss();await x.settle();
 assert.equal(f.calls.length,before);assert.equal(next.owner.isPresentationCurrent(next.i.rulesPresentationIdentity),true);cases++;
}
{
 const mutated=indexSource.replace('if (this.rulesManagementOrchestrator !== host || this.rulesPresentationIdentity !== identity) {','if (true) {');
 assert.notEqual(mutated,indexSource);const f=await fixture(true),Host=host(f),x=index(f,Host,mutated),next=index(f,Host,mutated);
 assert.equal(x.owner.isPresentationCurrent(next.i.rulesPresentationIdentity),true);x.i.getRulesManagementOrchestrator();
 assert.equal(x.owner.isPresentationCurrent(next.i.rulesPresentationIdentity),false,'negative control proves unconditional old getter reattaches');cases++;
}
{
 const begin=indexSource.indexOf('  private isCurrentRulesPresentation('),end=indexSource.indexOf('\n  private getRulesManagementOrchestrator',begin);
 const mutated=indexSource.slice(0,begin)+'  private isCurrentRulesPresentation(): boolean { return true; }\n'+indexSource.slice(end);
 const f=await fixture(true),Host=host(f),x=index(f,Host,mutated);await x.open();const old=x.props();index(f,Host,mutated);
 old.onImportBundle();assert.equal(x.i.jsonImportVisible,true,'negative control proves original back/import presentation admission is necessary');cases++;
}
console.log(`PASS ${cases} actual Rules Core SQLite/AtomicFile→Gateway/shared owner→Index→SDK native callbacks: original attachment IDs, alive getter, partial ACK/readback, accepted tail, pure read recovery, modal close/reopen and negative controls.`);
