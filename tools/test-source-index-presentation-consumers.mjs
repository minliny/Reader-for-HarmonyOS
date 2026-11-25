import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"native-current-replacement": {"description": "Preserved original native-current-replacement group; not selected by the current phone slice", "resources": []}, "toggle-readback-recovery": {"description": "Original full read/lost phone consumer group: confirmed/unknown, repeat recovery reads and same-Runtime unknown protection", "resources": []}, "accepted-toggle-retirement": {"description": "Preserved original accepted-toggle-retirement group; not selected by the current phone slice", "resources": []}, "pending-picker-retirement": {"description": "Preserved original pending-picker-retirement group; not selected by the current phone slice", "resources": []}, "retired-native-actions": {"description": "Preserved original retired-native-actions group; not selected by the current phone slice", "resources": []}, "picker-cancel-retry": {"description": "Preserved original picker-cancel-retry group; not selected by the current phone slice", "resources": []}, "attachment-negative-control": {"description": "Preserved original attachment-negative-control group; not selected by the current phone slice", "resources": []}, "inline-import-return": {"description": "Preserved original inline-import-return group; not selected by the current phone slice", "resources": []}, "viewport-measurements": {"description": "Original viewport 960/760 expanded group; wide EXCLUDED from phone execution", "resources": []}, "import-trigger-admission": {"description": "Preserved original import-trigger-admission group; not selected by the current phone slice", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {switchSpecs} = await import('./lib/reader-switch-control-probe.mjs');
const {labeledIconControls} = await import('./lib/reader-labeled-icon-action-probe.mjs');
const {default:assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {stripTypeScriptTypes, registerHooks} = await import('node:module');
registerHooks({ resolve(specifier, context, next) {
 try { return next(specifier, context); }
 catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
  throw error;
 }
} });
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {boundedSurfaceSdk,boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {ReaderNativeAlertOwner} = await import('./lib/reader-native-alert-sdk-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {actualSourceManagementGeometry} = await import('./lib/source-management-owner-probe.mjs');
const { resolveSourceManagementLayout, SOURCE_ROW_ICON_WIDTH, SOURCE_STATUS_CHIP_GAP } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts');
const { readerReadableFontScale, readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const v9 = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
const {sourceManagementRecoveryProbe,sourceRecoveryNativeAction}=await import('./lib/source-management-recovery-probe.mjs');
const {ReaderNavigation} = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
const {JsonImportPresentation} = await import('./lib/json-import-presentation-probe.mjs');
const {createDefaultReaderWindowMetrics} = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const source=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=source('pages/Index.ets'),pageSource=source('features/source/ui/SourceManagementPage.ets'),jsonSource=source('app/composition/JsonImportDialog.ets');
const toolsSource=source('features/source/ui/SourceToolsPage.ets');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { ts: sourceTs, options: sourceOptions } = installedEtsCompiler();
function ordinarySourceMethods(text, name) {
 const tree = sourceTs.createSourceFile(name + '.ets', text, sourceTs.ScriptTarget.Latest, true, sourceTs.ScriptKind.ETS, sourceOptions);
 assert.deepEqual(tree.parseDiagnostics, []);
 const component = tree.statements.find(node => node.name?.text === name);
 assert.ok(component);
 return component.members.filter(node => sourceTs.isMethodDeclaration(node) && node.name.getText(tree) !== 'build' &&
  !sourceTs.getAllDecorators(node).some(decorator => decorator.expression.getText(tree) === 'Builder')).map(node => node.name.getText(tree));
}
const sourcePageMethods = ordinarySourceMethods(pageSource, 'SourceManagementPage');
const jsonMethods = ordinarySourceMethods(jsonSource, 'JsonImportDialog');
const journeySource=source('features/source/ui/SourceJourneySurface.ets'),journeyModel='features/source/presentation/SourceJourneyPresentation.ets';
const ordinary=s=>stripTypeScriptTypes(s.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(p,n,d={})=>new Function(...Object.keys(d),ordinary(source(p))+`;return ${n};`)(...Object.values(d));
const ReaderSourceJourney=load('app/composition/ReaderSourceJourney.ets','ReaderSourceJourney',{
 ReaderUIVerificationProbe:{enabled:()=>false},
});
let installed,sequence=0,cases=0;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const receipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts),ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('platform/network/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/application/ReaderSourceCategory.ts','{classifyReaderSource,readerSourceCategoryLabel}')};
const typed=e=>e.typedAdmission===true;
const Gateway=load('features/source/application/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:Runtime,isReaderCoreTransactionPendingError:typed,...helpers});
const Orchestrator=load('features/source/application/SourceOrchestrator.ets','SourceOrchestrator',{SourceGateway:Gateway,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,isReaderCoreTransactionPendingError:typed,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt:receipt,...facts,...helpers,...v9});
const Host=load('features/source/application/SourceHost.ets','SourceHost',{ReaderRuntimeOwner:Runtime,SourceOrchestrator:Orchestrator,SourceGateway:Gateway});
const {SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}=load(journeyModel,'{SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}',{SourceHost:Host,EMPTY_SOURCE_TOOLS_SNAPSHOT:{}});
const sdk=boundedSurfaceSdk();sdk.hooks.lifecycleChildren=true;
const toggleSource=source('ui/controls/ReaderToggle.ets');
sdk.hooks.childSources.ReaderToggle=toggleSource;
const Toggle=createReaderBuilderProbe(toggleSource,boundedMembers(toggleSource),{...sdk.deps,...switchSpecs(),DEBUG:false,AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH'}},sdk.hooks).Component;
const chromeSource=source('features/source/ui/SourceV9Chrome.ets');
const controls=labeledIconControls();
for(const componentName of ['SourceV9DetectButton','SourceV9TypeSeal','SourceV9CircleCheck']) {
 sdk.hooks.childSources[componentName]=chromeSource;
 sdk.deps[componentName]=createReaderBuilderProbe(chromeSource,boundedMembers(chromeSource,componentName),
  {...sdk.deps,...v9},{...sdk.hooks,componentName}).Component;
}
Object.assign(sdk.deps,{ReaderLabeledIconAction:controls.component,ReaderButton:controls.button.Component,
 resolveReaderLabeledIconActionSpec:controls.dependencies.resolveReaderLabeledIconActionSpec});
Object.assign(sdk.hooks.childSources,controls.hooks.childSources);
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
 Object.assign(i,{route:'source',navigationGeneration:1,sourceOpeningGeneration:1,sourceToolsOpeningGeneration:0,
  detailShelfAdmissionMount:1,mountedRuntimeOwner:r,shelfReceiptRetired:false,rssInstanceIdentity:++sequence,
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
  if(changed&&snapshot.route==='source')i.sourceOpeningGeneration=snapshot.generation;
  if(changed&&snapshot.route==='sourceTools')i.sourceToolsOpeningGeneration=snapshot.generation;
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
   surface=createReaderBuilderProbe(journeySource,boundedMembers(journeySource),{...sdk.deps,...v9,...helpers,SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY,
    SourceManagementPage:Child,SourceToolsPage:Child,SourceV9TransferPage:Child,SourceV9CheckDialog:Child,SourceV9GroupsPage:Child},
    {...sdk.hooks,childSources:{SourceManagementPage:pageSource,SourceToolsPage:toolsSource,
     SourceV9TransferPage:source('features/source/ui/SourceV9TransferPage.ets'),
     SourceV9CheckDialog:source('features/source/ui/SourceV9CheckDialog.ets'),
     SourceV9GroupsPage:source('features/source/ui/SourceV9GroupsPage.ets')}}).owner;
   Object.assign(surface,bridge);
   surface.aboutToAppear();
  }
  surface.managementPage();
  return [...surface.children.values()].findLast(c=>c.params.sources)?.params;
 };
 const page=()=>{
  const params=props(),p=sdk.consumer(pageSource,[...new Set(['appThemeScheme','operation','statusKind','statusMessage','onReconcile','onToggleSource','onDetectSource','onLoginSource','onAddSource','onRetryLoad',
   'onMessageChanged','lastFeedbackIdentity','lastToastMessage','feedbackIdentity','mounted','recovery','sourceRow','sourceRowContent','sourceLeading','sourceInfo','currentSourceInfo','currentSourceRow','sourceActions','fontScale','layoutBudget','footerActionHeight','footerControlHeight','footerContentWidth','footerStacked','sourceBadgeLabel','detectButton','loginButton','sourceSwitch','sourceSwitchValue','sourceSwitchName','sourceToggleBusy','sourceActionEnabled','sourceDetectEnabled','sourceActionLabel','bottomActionBar',
   'sourceRowIsCurrent','sourceRowCommand','sourceRowToggle','sourceRenderKey','managementBackIsCurrent','managementOpeningIsCurrent','inputEnabled','isInputAllowed','isOpeningCurrent','projectedSources','verificationOpening',...sourcePageMethods])],{...actualSourceManagementGeometry(),...foundationSpecs(),...v9,resolveSourceManagementLayout,SOURCE_ROW_ICON_WIDTH,SOURCE_STATUS_CHIP_GAP,readerReadableFontScale,readerScaledControlHeight,...readerTypographyRoles,readerRecoveryView:load('app/ReaderRecoveryProjection.ts','readerRecoveryView'),ReaderToggle:Toggle,readerSourceCategoryLabel:helpers.readerSourceCategoryLabel,httpUrlHostname:helpers.httpUrlHostname,ReaderUIVerificationProbe:{enabled:()=>false},readerLayoutCarrierResponseRegion:()=>({}),EllipsisMode:{END:'EllipsisMode.END'}},params);
  p.sources=params.sources;p.mounted=true;p.appForeground=true;p.groupOpen=false;p.temporaryBackIdentity='source-sdk-visit';p.contentFrame=()=>({width:350});p.actionBottomInset=()=>0;
  const currentSource=()=>{p.projectedSources=read().sources;return p.projectedSources[0];};
  const switchAction=()=>{p.sourceRow(currentSource());const c=[...p.children.values()].findLast(c=>c instanceof Toggle);c.initialRender();const onChange=sdk.nodes(c).find(n=>n.type==='Toggle'&&n.onChange).onChange,next=!c.value;return ()=>onChange(next);};
  const action=(spec,label)=>{const actor=sdk.walk(p).findLast(c=>c.specId===spec&&(!label||c.label===label));assert.ok(actor,'actual '+spec+' component');
   const hit=sdk.nodes(actor).find(n=>typeof n.onClick==='function');assert.ok(hit,'actual '+spec+' native action');return hit.onClick;};
  const login=()=>{p.loginButton(currentSource());return [...p.nodes.values()].findLast(n=>n.onClick&&n.accessibilityText?.includes('登录')).onClick;};
  const detect=()=>{p.detectButton(currentSource());const actor=sdk.walk(p).findLast(child=>child instanceof sdk.deps.SourceV9DetectButton);
   return sdk.nodes(actor).find(n=>n.type==='Button'&&n.onClick).onClick;};
  const add=()=>{p.bottomActionBar();return action('source-management-add','导入书源');};
  const recovery=()=>sourceRecoveryNativeAction(sourceManagementRecoveryProbe(pageSource,params,{sdk})).onClick;
  return{p,params,switchAction,login,detect,add,recovery};
 };
 const json=()=>{i.jsonImportContent();const params=[...i.children.values()].findLast(c=>c.params.onSelectLocal)?.params;
  const p=sdk.consumer(jsonSource,[...new Set(['onSelectLocal','onImportOnline','onDismiss','urlDraft','validationMessage','localButton','submitOnlineImport','mounted','focusRevision','openingId','isInputAllowed','urlInputRevision',...jsonMethods])],{registerReaderFonts() {}},params);p.aboutToAppear();p.localButton();
  return{p,local:sdk.nodes(p).find(n=>n.onClick).onClick,params};};
 const settle=async()=>{await tick();await i.sourceJourney.registry.orchestrator?.operationChain;await tick();};
 return{i,r,props,page,json,read,routes,settle,get surface(){return surface;},open:async()=>{i.sourceNavigation.openPresentation('source');await settle();}};
}

if(selectedCase==='native-current-replacement'){
{
 const r=runtime();installed=r;const a=index(r);await a.open();const old=a.page(),oldToggle=old.switchAction(),oldLogin=old.login(),oldDetect=old.detect(),oldAdd=old.add();
 oldAdd();const oldJson=a.json();const b=index(r);await b.open();const id=b.i.sourceJourney.managementIdentity();
 a.i.sourceNavigation.openPresentation('source');assert.equal(b.i.sourceJourney.isManagementCurrent(id),true,'alive old Index getter cannot steal replacement lease');
 oldToggle();oldLogin();oldDetect();oldAdd();old.params.onRetryLoad();old.params.onBack();old.params.onTemporaryBackBridge(()=>true,'old');oldJson.local();oldJson.params.onDismiss();await b.settle();
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
 const toggle=p.switchAction(),detect=sdk.walk(p.p).findLast(actor=>actor instanceof sdk.deps.SourceV9DetectButton);
 assert.ok(detect,'actual v9 row uses the shared detection button');assert.equal(detect.tone,'unverified');
 const detectFrame=sdk.nodes(detect).find(node=>node.type==='Button'),mark=sdk.nodes(detect).find(node=>node.type==='Image');
 assert.match(detectFrame.accessibilityText,/尚无有效检测报告/);assert.equal(mark.create,'app.media.source_v9_wave');
 assert.equal(sdk.nodes(p.p).find(node=>node.type==='Toggle').enabled,true,'actual source switch remains natively eligible');
 assert.equal(p.params.isInputAllowed(),true,'mounted Source owner admits the toggle gesture');
 assert.equal(p.p.sourceRowIsCurrent(p.p.projectedSources[0],p.p.temporaryBackIdentity),true,'mounted Source row admits its current action');
 toggle();await a.settle();assert.equal(r.count('source.update'),1,a.read().statusMessage);
 assert.equal(a.read().operation.receipt.receipt.confirmation,failure==='read'?'confirmed':'unknown');
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
 const r=runtime();installed=r;const a=index(r);await a.open();const p=a.page(),old=p.switchAction();
 if(retirement==='nav')a.i.nextNavigationGeneration();else if(retirement==='mount')a.i.detailShelfAdmissionMount++;else installed=undefined;
 const navigationsBefore = a.routes.filter(route => typeof route === 'string');
 old();p.params.onRetryLoad();p.params.onBack();await a.settle();
 assert.equal(r.count('source.update'),0);
 assert.deepEqual(a.routes.filter(route => typeof route === 'string'), navigationsBefore,
   'retired source actions cannot navigate; mounting bridge records are independent');
 cases++;
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
 const r=runtime();installed=r;const a=index(r);let returned=0;
 a.i.publishNavigation(a.i.navigationOwner.show('search'));
 a.i.librarySearch.returnFromSourceManagement=keyword=>{assert.equal(keyword,'original');returned++;};
 const importFromSearch=async()=>{
  assert.equal(a.i.route,'search');
  a.i.sourceNavigation.openManagement('search','original');await a.settle();
  a.page().add()();
  assert.equal(a.i.jsonImportPresentation.opening?.context,'bookSource');
  a.json().local();await a.settle();
 };
 const inlineAction=()=>{
  const page=sdk.consumer(pageSource,['appThemeScheme','operation','statusKind','statusMessage','statusActionLabel','statusActionGeneration','onStatusAction','mounted','appForeground','inputEnabled','isInputAllowed','isOpeningCurrent','groupOpen','temporaryBackIdentity',
   'hasPendingSourceRecovery','sourceListInputIsCurrent','managementBackIsCurrent','managementOpeningIsCurrent','statusListAction','observeImportStatusAction','statusAction'],
   {...actualSourceManagementGeometry(),...foundationSpecs(),resolveSourceManagementLayout,readerReadableFontScale,readerScaledControlHeight,...readerTypographyRoles,ReaderUIVerificationProbe:{enabled:()=>false}},
   a.props());
  Object.assign(page,{mounted:true,temporaryBackIdentity:'source-sdk-inline-result'});
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
 const fixture=a.page(),button=fixture.add(),p=fixture.p;
 const action=sdk.walk(p).find(actor=>actor.specId==='source-management-add');
 const glyph=sdk.nodes(action).find(node=>node.type==='Image');assert.ok(glyph?.create,'actual Dock uses a vector add icon');
 const native=sdk.nodes(action).find(node=>node.type==='Button'&&node.onClick);assert.equal(native.height,44);
 button();assert.equal(a.surface.pane,'import');
 a.surface.consumeBack();assert.equal(a.surface.pane,'list');
 p.temporaryBackIdentity='source-add-2';button();assert.equal(a.surface.pane,'list');
 const current=fixture.add();p.mounted=false;current();assert.equal(a.surface.pane,'list');cases++;
}

}

console.log(`PASS Source exact ${selectedCase}: ${cases} original groups; finite current parent/native/Host checks only, no device or unselected viewport claim`);
}
