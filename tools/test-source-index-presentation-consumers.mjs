import {switchSpecs} from './lib/reader-switch-control-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=source('pages/Index.ets'),pageSource=source('features/source/SourceManagementPage.ets'),jsonSource=source('features/common/JsonImportDialog.ets');
const ordinary=s=>stripTypeScriptTypes(s.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,d={})=>new Function(...Object.keys(d),ordinary(source(p))+`;return ${n};`)(...Object.values(d));
let installed,sequence=0,cases=0;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const receipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts),ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource,readerSourceCategoryLabel}')};
const typed=e=>e.typedAdmission===true;
const Gateway=load('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:Runtime,isReaderCoreTransactionPendingError:typed,...helpers});
const Orchestrator=load('features/source/SourceOrchestrator.ets','SourceOrchestrator',{SourceGateway:Gateway,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,isReaderCoreTransactionPendingError:typed,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt:receipt,...facts,...helpers});
const Host=load('features/source/SourceHost.ets','SourceHost',{ReaderRuntimeOwner:Runtime,SourceOrchestrator:Orchestrator,SourceGateway:Gateway});
const sdk=boundedSurfaceSdk();sdk.hooks.lifecycleChildren=true;
const toggleSource=source('features/common/ReaderToggle.ets');
sdk.hooks.childSources.ReaderToggle=toggleSource;
const Toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),{...sdk.deps,...switchSpecs(),AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH'}},sdk.hooks).Component;
const badgeSource=source('features/common/StatusBadge.ets');sdk.hooks.childSources.StatusBadge=badgeSource;
const Badge=createReaderBuilderProbe(badgeSource,boundedMembers(badgeSource),sdk.deps,sdk.hooks).Component;
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const names=['sourceManagementContent','sourceManagementSurface','bindSourceManagement','isCurrentSourceManagement','retireSourceManagementPresentation','isCurrentRuntime',
 'onSourceToggled','onSourceDetectionRequested','onSourceLoginRequested','jsonImportContent','jsonImportSurface','isCurrentJsonImportPresentation','openJsonImport','dismissJsonImport','executeJsonImport','jsonImportTitle','jsonImportDescription'];
const row=()=>({sourceId:'a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,category:'text',loginUrl:'https://a.test/login',bookSource:{bookSourceType:0,loginUrl:'https://a.test/login'}});
const clone=v=>v===undefined?undefined:structuredClone(v),tick=()=>new Promise(r=>setImmediate(r)),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const until=async p=>{for(let n=0;n<300&&!p();n++)await tick();assert.ok(p(),'actual accepted boundary reached');};
function runtime(){return{rows:[row()],calls:[],lost:false,readFail:0,pause:undefined,pickerPause:undefined,pickers:0,logins:0,
 supportsCoreCapability:c=>c==='source.check.mode.v1',takeSourceHttpDiagnostics:()=>[],async clearSourceCookieSession(){},
 async openSourceLogin(){this.logins++;},async selectBookSourceJson(){this.pickers++;await this.pickerPause?.promise;return{fileName:'sources.json',text:JSON.stringify([{bookSourceUrl:'https://a.test',bookSourceName:'A'}])};},
 async request(method,params={},options={}){
  if(this.pause?.method===method&&this.pause.stage==='before')await this.pause.promise;
  if(options.canDispatch?.()===false||options.canContinue?.()===false)throw Error('last dispatch refused');options.onDispatch?.();this.calls.push({method,params:clone(params)});
  if(this.pause?.method===method&&this.pause.stage==='after')await this.pause.promise;
  if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
  if(method==='source.list'){if(this.readFail){this.readFail--;throw Error('read failed');}return{data:{sources:clone(this.rows)}};}
  if(method==='source.update'){this.rows[0].enabled=params.enabled;if(this.lost){this.lost=false;throw Error('lost ACK');}return{data:{source:clone(this.rows[0])}};}
  if(method==='source.check.run')return{requestId:'check',data:{traceId:'trace',results:[{sourceId:'a',available:true,levelsPassed:['L1','L2'],durationMs:1}]}};
  if(method==='source.import')return{data:{imported:true,sourceId:params.sourceId,name:params.bookSource.bookSourceName}};
  throw Error(method);
 },count(m){return this.calls.filter(c=>c.method===m).length;}};}
function index(r,text=indexSource){
 const i=createReaderBuilderProbe(text,names,{...sdk.deps,ReaderRuntimeOwner:Runtime,SourceManagementPage:Child,JsonImportDialog:Child,deviceInfo:{deviceType:'phone'}},
  {...sdk.hooks,childSources:{SourceManagementPage:pageSource,JsonImportDialog:jsonSource}}).owner;
 Object.assign(i,{route:'source',navigationGeneration:1,detailShelfAdmissionMount:1,mountedRuntimeOwner:r,shelfReceiptRetired:false,rssInstanceIdentity:++sequence,
  sourceSources:[],sourceOperation:{action:'load',sourceId:''},sourceStatusKind:'idle',sourceStatusMessage:'',sourcePresentationIdentity:'',settingsSnapshot:{reduceMotion:false},
  jsonImportVisible:false,jsonImportGeneration:0,jsonImportContext:'bookSource',rulesPresentationIdentity:''});
 // The actual Index SourceHost initializer, including all guarded State emitters.
 const a=text.indexOf('  private sourceHost:'),b=text.indexOf('\n  );',a)+6,expression=text.slice(a,b).split('=').slice(1).join('=').trim().replace(/;$/,'');
 i.sourceHost=new Function('SourceHost',stripTypeScriptTypes('const value='+expression+';')+'return value;').call(i,Host);
 const notices=[],routes=[];i.showSourceImportResult=(t,m)=>notices.push({t,m});i.showSourceImportResultFromSearch=(t,m)=>notices.push({t,m,search:true});
 i.returnFromSourceManagement=()=>routes.push('back');i.openSourceTools=()=>routes.push('tools');i.registerTemporaryBackBridge=(...args)=>routes.push(args);
 assert.equal(i.bindSourceManagement(),true);
 const props=()=>{i.sourceManagementContent();return [...i.children.values()].findLast(c=>c.params.sources)?.params;};
 const page=()=>{
  const params=props(),p=sdk.consumer(pageSource,['appThemeScheme','operation','statusKind','statusMessage','onReconcile','onToggleSource','onDetectSource','onLoginSource','onAddSource','onOpenTools','onRetryLoad',
   'onMessageChanged','lastFeedbackIdentity','lastToastMessage','feedbackIdentity','mounted','recovery','statusBanner','sourceRow','statusBadgeBackground','statusBadgeDot','statusBadge','detectButton','loginButton','sourceSwitch','sourceToggleBusy','sourceToggleEnabled','bottomActionBar'],{readerRecoveryView:load('app/ReaderRecoveryProjection.ts','readerRecoveryView'),ReaderToggle:Toggle,StatusBadge:Badge,readerSourceCategoryLabel:helpers.readerSourceCategoryLabel},params);
  p.sources=params.sources;p.mounted=true;p.temporaryBackIdentity='source-sdk-visit';p.contentFrame=()=>({width:350});p.actionBottomInset=()=>0;
  const switchAction=()=>{p.sourceRow(i.sourceSources[0]);const c=[...p.children.values()].findLast(c=>c instanceof Toggle);c.initialRender();return sdk.nodes(c).find(n=>n.onClick).onClick;};
  const action=(spec,label)=>{const actor=sdk.walk(p).findLast(c=>c.specId===spec&&(!label||c.label===label));assert.ok(actor,'actual '+spec+' component');
   const hit=sdk.nodes(actor).find(n=>typeof n.onClick==='function');assert.ok(hit,'actual '+spec+' native action');return hit.onClick;};
  const login=()=>{p.loginButton(r.rows[0]);return action('source-management-login','登录');};
  const detect=()=>{p.detectButton(r.rows[0]);return action('source-management-detect','检测');};
  const add=()=>{p.bottomActionBar();return action('source-management-add','新增书源');};
  const recovery=()=>{p.statusBanner();return action('source-management-retry','重试');};
  return{p,params,switchAction,login,detect,add,recovery};
 };
 const json=()=>{i.jsonImportContent();const params=[...i.children.values()].findLast(c=>c.params.onSelectLocal)?.params;
  const p=sdk.consumer(jsonSource,['onSelectLocal','onImportOnline','onDismiss','urlDraft','validationMessage','localButton','submitOnlineImport'],{},params);p.localButton();
  return{p,local:sdk.nodes(p).find(n=>n.onClick).onClick,params};};
 const settle=async()=>{await tick();await i.sourceHost.orchestrator.operationChain;await tick();};
 return{i,r,props,page,json,notices,routes,settle,open:async()=>{i.sourceHost.open(i.sourcePresentationIdentity);await settle();}};
}
{
 const r=runtime();installed=r;const a=index(r);await a.open();const old=a.page(),oldToggle=old.switchAction(),oldLogin=old.login(),oldDetect=old.detect(),oldAdd=old.add();
 oldAdd();const oldJson=a.json();const b=index(r);await b.open();const id=b.i.sourcePresentationIdentity;
 a.i.bindSourceManagement();assert.equal(b.i.sourceHost.isPresentationCurrent(r,id),true,'alive old Index getter cannot steal replacement lease');
 oldToggle();oldLogin();oldDetect();oldAdd();old.params.onRetryLoad();old.params.onBack();old.params.onOpenTools();old.params.onTemporaryBackBridge(()=>true,'old');oldJson.local();oldJson.params.onDismiss();await b.settle();
 assert.equal(r.count('source.update'),0);assert.equal(r.count('source.check.run'),0);assert.equal(r.logins,0);assert.equal(r.pickers,0);assert.equal(a.routes.length,0);
 const live=b.page();live.switchAction()();await b.settle();assert.equal(r.count('source.update'),1);assert.equal(b.i.sourceOperation.receipt.receipt.confirmation,'confirmed');
 live.login()();await b.settle();assert.equal(r.logins,1);assert.equal(r.count('source.check.run'),1);
 live.detect()();await b.settle();assert.equal(r.count('source.check.run'),2);
 live.add()();const actual=b.json();actual.local();await b.settle();assert.equal(r.pickers,1);assert.equal(r.count('source.import'),1);assert.equal(b.notices.length,1);cases++;
}
for(const failure of['read','lost']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page();if(failure==='read')r.readFail=1;else r.lost=true;
 p.switchAction()();await a.settle();assert.equal(a.i.sourceOperation.receipt.receipt.confirmation,failure==='read'?'confirmed':'unknown');
 const read=a.page().recovery();read();read();await a.settle();assert.equal(r.count('source.update'),1,'actual page native recovery only reads');
 if(failure==='lost'){const b=index(r);await b.open();b.page().switchAction()();await b.settle();assert.equal(r.count('source.update'),1,'same Runtime replacement cannot clear unknown by matching list');}
 cases++;
}
for(const stage of['before','after']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page(),gate=defer();r.pause={method:'source.update',stage,...gate};p.switchAction()();
 await tick();const prior=clone(a.i.sourceOperation);const b=index(r);gate.resolve();await b.open();assert.deepEqual(a.i.sourceOperation,prior);
 assert.equal(r.count('source.update'),stage==='after'?1:1,'already accepted toggle retains original grant/Runtime across presentation switch');
 assert.equal(b.i.sourceSources[0].enabled,false);assert.equal(b.i.sourceOperation.receipt.receipt.confirmation,'confirmed');cases++;
}
{
 const r=runtime();installed=r;const a=index(r);await a.open();a.page().add()();const old=a.json(),gate=defer();r.pickerPause=gate;old.local();await until(()=>r.pickers===1);
 a.i.retireSourceManagementPresentation();a.i.navigationGeneration++;const b=index(r),opening=b.open();gate.resolve();await opening;await b.settle();assert.equal(r.count('source.import'),0);assert.equal(a.notices.length,0);assert.equal(b.notices.length,0);
 old.local();old.params.onDismiss();assert.equal(r.pickers,1);cases++;
}
for(const retirement of['nav','mount','unset']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page(),old=p.switchAction();if(retirement==='nav')a.i.navigationGeneration++;else if(retirement==='mount')a.i.detailShelfAdmissionMount++;else installed=undefined;
 old();p.params.onRetryLoad();p.params.onBack();await a.settle();assert.equal(r.count('source.update'),0);assert.equal(a.routes.length,0);cases++;
}
{
 const mutant=indexSource.replace("(!attached || (identity.length > 0 && identity === this.sourcePresentationIdentity && host.isPresentationCurrent(owner, identity)))",'true');
 assert.notEqual(mutant,indexSource);const r=runtime();installed=r;const a=index(r,mutant);await a.open();const old=a.page().add();const b=index(r);await b.open();old();assert.equal(a.i.jsonImportVisible,true,'negative control: removing current owner attachment lets alive old physical action alter old UI');cases++;
}
{
 const r=runtime();installed=r;const a=index(r);await a.open();let shown,returned=0;
 const p=createReaderBuilderProbe(indexSource,['showSourceImportResult','showSourceImportResultFromSearch','runSourceImportSearchAction','isCurrentRuntime'],
  {...sdk.deps,ReaderRuntimeOwner:Runtime},sdk.hooks).owner;
 Object.assign(p,{route:'source',navigationGeneration:1,shelfReceiptRetired:false,mountedRuntimeOwner:r,detailShelfAdmissionMount:1,
  sourceManagementSearchKeyword:'original',sourceManagementReturnTarget:'search',returnFromSourceManagement:()=>returned++,
  getUIContext:()=>({showAlertDialog:options=>{shown=options;}})});
 const id=a.i.sourcePresentationIdentity,current=()=>a.i.isCurrentSourceManagement(1,r,1,a.i.sourceHost,id);
 const inlineAction=()=>{
  const page=sdk.consumer(pageSource,['appThemeScheme','operation','statusKind','statusMessage','statusActionLabel','statusActionGeneration','onStatusAction','onMessageChanged','feedbackIdentity','lastFeedbackIdentity','lastToastMessage','mounted','recovery','statusAction'],
   {readerRecoveryView:load('app/ReaderRecoveryProjection.ts','readerRecoveryView')},
   {operation:{action:'load',sourceId:''},statusKind:p.sourceStatusKind,statusMessage:p.sourceStatusMessage,
    statusActionLabel:p.sourceImportSearchActionLabel,statusActionGeneration:p.sourceImportSearchActionRevision,
    onStatusAction:revision=>p.runSourceImportSearchAction(revision)});
  page.statusAction();
  const button=sdk.walk(page).findLast(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label==='重新搜索');
  assert.ok(button,'actual inline source result action');return sdk.nodes(button).find(n=>n.onClick).onClick;
 };
 p.showSourceImportResultFromSearch('书源导入完成','Core 已导入 1 个书源。',current);
 assert.equal(shown,undefined);const first=inlineAction();first();first();assert.equal(returned,1);
 p.showSourceImportResultFromSearch('书源导入完成','Core 已导入 1 个书源。',current);const old=inlineAction();
 const b=index(r);await b.open();old();assert.equal(returned,1,'actual inline result rejects retired Source lease after alive Index replacement');cases++;
}

console.log(`PASS ${cases} actual Source Host/Gateway/shared runtime→Index scoped Builder→SDK page/ReaderToggle/JSON-local native actions: current/old physical/actual field payload/ACK/read/unknown/remount/getter/late picker/retirement/negative. Cold Core source receipts remain separately required.`);
