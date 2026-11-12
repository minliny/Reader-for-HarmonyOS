import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"native-current-replacement": {"description": "Preserved original native-current-replacement group; not selected by the current phone slice", "resources": []}, "toggle-readback-recovery": {"description": "Original full read/lost phone consumer group: confirmed/unknown, repeat recovery reads and same-Runtime unknown protection", "resources": []}, "accepted-toggle-retirement": {"description": "Preserved original accepted-toggle-retirement group; not selected by the current phone slice", "resources": []}, "pending-picker-retirement": {"description": "Preserved original pending-picker-retirement group; not selected by the current phone slice", "resources": []}, "retired-native-actions": {"description": "Preserved original retired-native-actions group; not selected by the current phone slice", "resources": []}, "picker-cancel-retry": {"description": "Preserved original picker-cancel-retry group; not selected by the current phone slice", "resources": []}, "attachment-negative-control": {"description": "Preserved original attachment-negative-control group; not selected by the current phone slice", "resources": []}, "inline-import-return": {"description": "Preserved original inline-import-return group; not selected by the current phone slice", "resources": []}, "viewport-measurements": {"description": "Original viewport 960/760 expanded group; wide EXCLUDED from phone execution", "resources": []}, "import-trigger-admission": {"description": "Preserved original import-trigger-admission group; not selected by the current phone slice", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {switchSpecs} = await import('./lib/reader-switch-control-probe.mjs');
const {iconButtonControls} = await import('./lib/reader-icon-button-probe.mjs');
const {default:assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {stripTypeScriptTypes} = await import('node:module');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {boundedSurfaceSdk,boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {actualSourceManagementGeometry} = await import('./lib/source-management-owner-probe.mjs');
const {sourceManagementRecoveryProbe,sourceRecoveryNativeAction}=await import('./lib/source-management-recovery-probe.mjs');
const {ReaderNavigation} = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
const {JsonImportPresentation} = await import('./lib/json-import-presentation-probe.mjs');
const {createDefaultReaderWindowMetrics} = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=source('pages/Index.ets'),pageSource=source('features/source/ui/SourceManagementPage.ets'),jsonSource=source('app/composition/JsonImportDialog.ets');
const toolsSource=source('features/source/ui/SourceToolsPage.ets');
const journeySource=source('features/source/ui/SourceJourneySurface.ets'),journeyModel='features/source/presentation/SourceJourneyPresentation.ets';
const ordinary=s=>stripTypeScriptTypes(s.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,d={})=>new Function(...Object.keys(d),ordinary(source(p))+`;return ${n};`)(...Object.values(d));
const ReaderSourceJourney=load('app/composition/ReaderSourceJourney.ets','ReaderSourceJourney');
let installed,sequence=0,cases=0;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const receipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts),ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('platform/network/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/application/ReaderSourceCategory.ts','{classifyReaderSource,readerSourceCategoryLabel}')};
const typed=e=>e.typedAdmission===true;
const Gateway=load('features/source/application/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:Runtime,isReaderCoreTransactionPendingError:typed,...helpers});
const Orchestrator=load('features/source/application/SourceOrchestrator.ets','SourceOrchestrator',{SourceGateway:Gateway,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,isReaderCoreTransactionPendingError:typed,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt:receipt,...facts,...helpers});
const Host=load('features/source/application/SourceHost.ets','SourceHost',{ReaderRuntimeOwner:Runtime,SourceOrchestrator:Orchestrator,SourceGateway:Gateway});
const {SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}=load(journeyModel,'{SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}',{SourceHost:Host,EMPTY_SOURCE_TOOLS_SNAPSHOT:{}});
const sdk=boundedSurfaceSdk();sdk.hooks.lifecycleChildren=true;
const toggleSource=source('ui/controls/ReaderToggle.ets');
sdk.hooks.childSources.ReaderToggle=toggleSource;
const Toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),{...sdk.deps,...switchSpecs(),AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH'}},sdk.hooks).Component;
const badgeSource=source('ui/controls/StatusBadge.ets');sdk.hooks.childSources.StatusBadge=badgeSource;
const Badge=createReaderBuilderProbe(badgeSource,boundedMembers(badgeSource),{...sdk.deps,
 LineJoinStyle:{Round:'LineJoinStyle.Round'},uiContext:{vp2px:value=>value}},sdk.hooks).Component;
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const names=['sourceJourneyContent','sourceJourneySurface','sourceNavigationPorts','isCurrentRoute','isCurrentRuntime','currentReadingRuntime',
 'jsonImportContent','dismissJsonImport'];
const row=()=>({sourceId:'a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,category:'text',loginUrl:'https://a.test/login',bookSource:{bookSourceType:0,loginUrl:'https://a.test/login'}});
const clone=v=>v===undefined?undefined:structuredClone(v),tick=()=>new Promise(r=>setImmediate(r)),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{resolve,promise};};
const until=async p=>{for(let n=0;n<300&&!p();n++)await tick();assert.ok(p(),'actual accepted boundary reached');};
function runtime(){return{rows:[row()],calls:[],lost:false,readFail:0,pause:undefined,pickerPause:undefined,pickerCancelled:false,pickers:0,logins:0,
 supportsCoreCapability:c=>c==='source.check.mode.v1',takeSourceHttpDiagnostics:()=>[],async clearSourceCookieSession(){},
 async openSourceLogin(_id,url){this.logins++;this.lastLoginUrl=url;},async selectBookSourceJson(){this.pickers++;await this.pickerPause?.promise;if(this.pickerCancelled)return undefined;return{fileName:'sources.json',text:JSON.stringify([{bookSourceUrl:'https://a.test',bookSourceName:'A'}])};},
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
function index(r,Presentation=SourceJourneyPresentation){
 const i=createReaderBuilderProbe(indexSource,names,{...sdk.deps,ReaderRuntimeOwner:Runtime,SourceJourneySurface:Child,JsonImportDialog:Child,deviceInfo:{deviceType:'phone'}},
  {...sdk.hooks,childSources:{SourceJourneySurface:journeySource,JsonImportDialog:jsonSource}}).owner;
 Object.assign(i,{route:'source',navigationGeneration:1,detailShelfAdmissionMount:1,mountedRuntimeOwner:r,shelfReceiptRetired:false,rssInstanceIdentity:++sequence,
  libraryAcquisition:{currentOwner:()=>Runtime.isCurrent(r)?r:undefined,beginSearch:()=>Runtime.isCurrent(r)},
  searchAppForeground:true,arkWebCapturesInput:false,
  sourceJourney:new Presentation(),navigationOwner:new ReaderNavigation(),settingsPresentation:{snapshot:{reduceMotion:false}},rssJourney:{rssPresentationIdentity:''},rulesPresentation:{identity:''},expandedLayout:()=>false,
  jsonImportPresentation:new JsonImportPresentation(),rulesPresentationIdentity:'',
  readingEntry:{endReading(){}},librarySearch:{returnFromSourceManagement(){}},
  settingsNavigation:{openPresentation(){}},refreshSearchShelfMembership(){}});
 i.navigationOwner.advance();
 i.navigationOwner.show('source');
 const routes=[];
 i.publishNavigation=snapshot=>{
  const changed=snapshot.route!==i.route;
  i.navigationGeneration=snapshot.generation;i.route=snapshot.route;
  if(changed&&snapshot.route==='sourceTools')routes.push('tools');
  if(changed&&snapshot.route==='search')routes.push('search');
  if(changed&&snapshot.route==='settings')routes.push('back');
 };
 i.nextNavigationGeneration=()=>{
  i.sourceJourney.retire();
  const next=i.navigationOwner.advance();i.publishNavigation(next);return next.generation;
 };
 i.sourceNavigation=new ReaderSourceJourney(i.navigationOwner,i.sourceNavigationPorts());
 i.onBackPress=()=>{i.sourceNavigation.returnFromManagement();return true;};
 i.registerTemporaryBackBridge=(...args)=>routes.push(args);
 const read=()=>i.sourceJourney.snapshot();
 let surface;
 const props=()=>{
  const identity=i.sourceNavigation.identity(i.navigationGeneration,i.detailShelfAdmissionMount,'source');
  if(surface===undefined||surface.identity!==identity){
   surface?.aboutToDisappear();
   i.sourceJourneyContent(false);
   const bridge=[...i.children.values()].findLast(c=>c.params.presentation===i.sourceJourney).params;
   surface=createReaderBuilderProbe(journeySource,boundedMembers(journeySource),{...sdk.deps,SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY,SourceManagementPage:Child,SourceToolsPage:Child},
    {...sdk.hooks,childSources:{SourceManagementPage:pageSource,SourceToolsPage:toolsSource}}).owner;
   Object.assign(surface,bridge);
   surface.aboutToAppear();
  }
  surface.managementPage();
  return [...surface.children.values()].findLast(c=>c.params.sources)?.params;
 };
 const page=()=>{
  const params=props(),p=sdk.consumer(pageSource,['appThemeScheme','operation','statusKind','statusMessage','onReconcile','onToggleSource','onDetectSource','onLoginSource','onAddSource','onOpenTools','onRetryLoad',
   'onMessageChanged','lastFeedbackIdentity','lastToastMessage','feedbackIdentity','mounted','recovery','sourceRow','sourceBadgeStatus','sourceBadgeLabel','statusBadge','detectButton','loginButton','sourceSwitch','sourceToggleBusy','sourceToggleEnabled','bottomActionBar',
   'sourceRowIsCurrent','sourceRowCommand','sourceRowToggle','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent'],{readerRecoveryView:load('app/ReaderRecoveryProjection.ts','readerRecoveryView'),ReaderToggle:Toggle,StatusBadge:Badge,readerSourceCategoryLabel:helpers.readerSourceCategoryLabel},params);
  p.sources=params.sources;p.mounted=true;p.appForeground=true;p.groupOpen=false;p.temporaryBackIdentity='source-sdk-visit';p.contentFrame=()=>({width:350});p.actionBottomInset=()=>0;
  const currentSource=()=>{p.projectedSources=read().sources;return p.projectedSources[0];};
  const switchAction=()=>{p.sourceRow(currentSource());const c=[...p.children.values()].findLast(c=>c instanceof Toggle);c.initialRender();const onChange=sdk.nodes(c).find(n=>n.type==='Toggle'&&n.onChange).onChange,next=!c.value;return ()=>onChange(next);};
  const action=(spec,label)=>{const actor=sdk.walk(p).findLast(c=>c.specId===spec&&(!label||c.label===label));assert.ok(actor,'actual '+spec+' component');
   const hit=sdk.nodes(actor).find(n=>typeof n.onClick==='function');assert.ok(hit,'actual '+spec+' native action');return hit.onClick;};
  const login=()=>{p.loginButton(currentSource());return action('source-management-login','登录');};
  const detect=()=>{p.detectButton(currentSource());return action('source-management-detect','检测');};
  const add=()=>{p.bottomActionBar();return action('source-management-add','新增书源');};
  const recovery=()=>sourceRecoveryNativeAction(sourceManagementRecoveryProbe(pageSource,params,{sdk})).onClick;
  return{p,params,switchAction,login,detect,add,recovery};
 };
 const json=()=>{i.jsonImportContent();const params=[...i.children.values()].findLast(c=>c.params.onSelectLocal)?.params;
  const p=sdk.consumer(jsonSource,['onSelectLocal','onImportOnline','onDismiss','urlDraft','validationMessage','localButton','submitOnlineImport'],{},params);p.localButton();
  return{p,local:sdk.nodes(p).find(n=>n.onClick).onClick,params};};
 const settle=async()=>{await tick();await i.sourceJourney.registry.orchestrator.operationChain;await tick();};
 return{i,r,props,page,json,read,routes,settle,open:async()=>{i.sourceNavigation.openPresentation('source');await settle();}};
}

if(selectedCase==='native-current-replacement'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();const old=a.page(),oldToggle=old.switchAction(),oldLogin=old.login(),oldDetect=old.detect(),oldAdd=old.add();
 oldAdd();const oldJson=a.json();const b=index(r);await b.open();const id=b.i.sourceJourney.managementIdentity();
 a.i.sourceNavigation.openPresentation('source');assert.equal(b.i.sourceJourney.isManagementCurrent(id),true,'alive old Index getter cannot steal replacement lease');
 oldToggle();oldLogin();oldDetect();oldAdd();old.params.onRetryLoad();old.params.onBack();old.params.onOpenTools();old.params.onTemporaryBackBridge(()=>true,'old');oldJson.local();oldJson.params.onDismiss();await b.settle();
 assert.equal(r.count('source.update'),0);assert.equal(r.count('source.check.run'),0);assert.equal(r.logins,0);assert.equal(r.pickers,0);assert.equal(a.routes.length,0);
 const live=b.page();live.switchAction()();await b.settle();assert.equal(r.count('source.update'),1);assert.equal(b.read().operation.receipt.receipt.confirmation,'confirmed');
 const staleLogin=live.login();r.rows[0].bookSource.loginUrl='https://a.test/new-login';live.params.onRetryLoad();await b.settle();
 staleLogin();await b.settle();assert.equal(r.logins,0,'owner rejects a stale URL even before the retained row receives the fresh projection');
 live.login()();await b.settle();assert.equal(r.logins,1);assert.equal(r.lastLoginUrl,'https://a.test/new-login');assert.equal(r.count('source.check.run'),1);
 live.detect()();await b.settle();assert.equal(r.count('source.check.run'),2);
 live.add()();const actual=b.json();actual.local();await b.settle();assert.equal(r.pickers,1);assert.equal(r.count('source.import'),1);assert.match(b.read().statusMessage,/书源导入完成/);cases++;
}
}

if(selectedCase==='toggle-readback-recovery'){
for(const failure of['read','lost']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page();if(failure==='read')r.readFail=1;else r.lost=true;
 const toggle=p.switchAction(),badge=sdk.walk(p.p).findLast(actor=>actor instanceof Badge);
 assert.ok(badge,'actual Source row keeps the current semantic StatusBadge actor');assert.deepEqual([badge.status,badge.label],['neutral','未检查']);
 const badgeFrame=sdk.nodes(badge).find(node=>node.type==='Stack'),mark=sdk.nodes(badge).find(node=>node.type==='Path');
 assert.equal(badgeFrame.accessibilityText,'未检查');assert.ok(mark.commands.length>0,'actual source badge retains its non-color native graphic');
 assert.equal(sdk.nodes(p.p).find(node=>node.type==='Toggle').enabled,true,'actual source switch remains natively eligible');
 toggle();await a.settle();assert.equal(a.read().operation.receipt.receipt.confirmation,failure==='read'?'confirmed':'unknown');
 const read=a.page().recovery();read();read();await a.settle();assert.equal(r.count('source.update'),1,'actual page native recovery only reads');
 if(failure==='lost'){const b=index(r);await b.open();b.page().switchAction()();await b.settle();assert.equal(r.count('source.update'),1,'same Runtime replacement cannot clear unknown by matching list');}
 cases++;
}
}

if(selectedCase==='accepted-toggle-retirement'){
for(const stage of['before','after']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page(),gate=defer();r.pause={method:'source.update',stage,...gate};p.switchAction()();
 await tick();const prior=clone(a.read().operation);const b=index(r);gate.resolve();await b.open();assert.deepEqual(a.read().operation,prior);
 assert.equal(r.count('source.update'),stage==='after'?1:1,'already accepted toggle retains original grant/Runtime across presentation switch');
 assert.equal(b.read().sources[0].enabled,false);assert.equal(b.read().operation.receipt.receipt.confirmation,'confirmed');cases++;
}
}

if(selectedCase==='pending-picker-retirement'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();a.page().add()();const old=a.json(),gate=defer();r.pickerPause=gate;old.local();await until(()=>r.pickers===1);
 a.i.nextNavigationGeneration();const b=index(r),opening=b.open();gate.resolve();await opening;await b.settle();assert.equal(r.count('source.import'),0);assert.doesNotMatch(a.read().statusMessage,/书源导入完成/);assert.doesNotMatch(b.read().statusMessage,/书源导入完成/);
 old.local();old.params.onDismiss();assert.equal(r.pickers,1);cases++;
}
}

if(selectedCase==='retired-native-actions'){
for(const retirement of['nav','mount','unset']){
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page(),old=p.switchAction();if(retirement==='nav')a.i.nextNavigationGeneration();else if(retirement==='mount')a.i.detailShelfAdmissionMount++;else installed=undefined;
 old();p.params.onRetryLoad();p.params.onBack();await a.settle();assert.equal(r.count('source.update'),0);assert.equal(a.routes.length,0);cases++;
}
}

if(selectedCase==='picker-cancel-retry'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();r.pickerCancelled=true;
 a.page().add()();a.json().local();await a.settle();
 assert.equal(r.pickers,1);assert.equal(r.count('source.import'),0);
 assert.deepEqual([a.read().statusKind,a.read().statusMessage],['idle','']);
 r.pickerCancelled=false;a.page().add()();a.json().local();await a.settle();
 assert.equal(r.pickers,2);assert.equal(r.count('source.import'),1);cases++;
}
}

if(selectedCase==='attachment-negative-control'){
{
 const oldModel=source(journeyModel),mutant=oldModel.replace('this.registry.isPresentationCurrent(owner, identity);','true;');
 assert.notEqual(mutant,oldModel);
 const Mutant=new Function('SourceHost','EMPTY_SOURCE_TOOLS_SNAPSHOT',ordinary(mutant)+';return SourceJourneyPresentation;')(Host,{});
 const r=runtime();installed=r;const a=index(r,Mutant);await a.open();const old=a.page().add();const b=index(r);await b.open();old();assert.notEqual(a.i.jsonImportPresentation.opening,undefined,'negative control: removing current owner attachment lets alive old physical action alter old UI');cases++;
}
}

if(selectedCase==='inline-import-return'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();let returned=0;
 a.i.librarySearch.returnFromSourceManagement=keyword=>{assert.equal(keyword,'original');returned++;};
 const importFromSearch=async()=>{
  if(a.i.route==='search'){a.i.sourceNavigation.openManagement('search','original');await a.settle();}
  a.i.navigationOwner.returns.setSourceOrigin('settings');
  a.props().onAddSource();
  a.i.navigationOwner.returns.setSourceOrigin('search','original');
  a.json().params.onSelectLocal();await a.settle();
 };
 const inlineAction=()=>{
  const page=sdk.consumer(pageSource,['appThemeScheme','operation','statusKind','statusMessage','statusActionLabel','statusActionGeneration','onStatusAction','onMessageChanged','feedbackIdentity','lastFeedbackIdentity','lastToastMessage','mounted','recovery','statusAction'],
   {readerRecoveryView:load('app/ReaderRecoveryProjection.ts','readerRecoveryView')},
   a.props());
  page.statusAction();
  const button=sdk.walk(page).findLast(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label==='重新搜索');
  assert.ok(button,'actual inline source result action');return sdk.nodes(button).find(n=>n.onClick).onClick;
 };
 await importFromSearch();const first=inlineAction();first();first();assert.equal(returned,1);
 await importFromSearch();const old=inlineAction();
 const b=index(r);await b.open();old();assert.equal(returned,1,'actual inline result rejects retired Source lease after alive Index replacement');cases++;
}

}

if(selectedCase==='viewport-measurements'){
{
 const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=960;metrics.windowRect.height=900;
 const geometry=actualSourceManagementGeometry(metrics);
 const p=sdk.consumer(pageSource,['recordViewport','onGeometryInputsChanged','recordMeasurement','refreshGeometry',
  'footerFallbackHeight','actionBottomInset','scrollLayout','contentFrame','numericAreaLength'],geometry);
 Object.assign(p,{mounted:true,viewportWidth:0,viewportHeight:0,measurementKey:0,measurementRevision:0,
  readerWindowMetricsRevision:0,measurements:new geometry.ReaderMeasurementStore()});
 p.onGeometryInputsChanged();p.recordViewport({width:390,height:810,globalPosition:{x:7,y:13}});
 const key=p.measurementKey;
 p.recordMeasurement('source:header',54,key);p.recordMeasurement('source:footer',82,key);
 assert.equal(p.geometry.footer.top,728,'footer uses the actual local viewport height');
 assert.equal(p.contentFrame(),p.geometry.content.frame,'footer and rows read the same frame as the scaffold');
 assert.deepEqual(p.scrollLayout(),new geometry.ReaderScrollLayout(54,82,'contentOffset'));
 p.recordViewport({width:'760vp',height:'360vp',globalPosition:{x:'8vp',y:'14vp'}});
 const resized=p.geometry;
 assert.equal(p.measurementKey,key+1);assert.equal(resized.widthClass,'expanded');
 assert.deepEqual([p.originX,p.originY],[8,14],'overlay origin stays in logical pixels');
 assert.equal(resized.footer.height,p.footerFallbackHeight());
 p.recordMeasurement('source:header',99,key);p.recordMeasurement('source:footer',99,key);
 assert.equal(p.geometry,resized,'resize rejects both stale native receipts');
 p.recordMeasurement('source:footer',90,p.measurementKey);
 assert.equal(p.geometry.footer.top,270);assert.equal(p.scrollLayout().endInset,90);
 const current=p.geometry;p.recordViewport({width:'bad',height:0,globalPosition:{x:8,y:14}});
 assert.equal(p.geometry,current);p.mounted=false;p.recordMeasurement('source:footer',99,p.measurementKey);
 assert.equal(p.geometry,current,'retired page rejects callbacks');
 assert.match(pageSource,/geometry: this\.geometry,/);cases++;
}
}

if(selectedCase==='import-trigger-admission'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();
 const icons=iconButtonControls({properties:sdk.properties});
 const p=icons.consumer(pageSource,['importAction','mounted','temporaryBackIdentity','onAddSource'],{},a.props());
 p.mounted=true;p.temporaryBackIdentity='source-add-1';p.importAction(p.temporaryBackIdentity);
 const icon=icons.walk(p).find(child=>child instanceof icons.icon.Component);assert.equal(icon?.specId,'form-primary-icon');
 const button=icons.nodes(icon).find(n=>n.type==='Button'&&n.accessibilityText==='导入书源');assert.ok(button);
 const glyph=icons.nodes(icon).find(n=>n.type==='Image');assert.deepEqual([glyph.width,glyph.height],[18,18]);
 assert.deepEqual([button.width,button.height,button.borderRadius,button.focusable],[40,40,12,true]);
 assert.deepEqual(button.responseRegion,{x:-2,y:-2,width:44,height:44});
 button.onClick();assert.notEqual(a.i.jsonImportPresentation.opening,undefined);
 a.i.dismissJsonImport();p.temporaryBackIdentity='source-add-2';button.onClick();assert.equal(a.i.jsonImportPresentation.opening,undefined);
 p.importAction(p.temporaryBackIdentity);
 const current=icons.nodes(p).findLast(n=>n.type==='Button'&&n.accessibilityText==='导入书源');
 p.mounted=false;current.onClick();assert.equal(a.i.jsonImportPresentation.opening,undefined);cases++;
}

}

console.log(`PASS Source exact ${selectedCase}: ${cases} original groups; finite current parent/native/Host checks only, no device or unselected viewport claim`);
}
