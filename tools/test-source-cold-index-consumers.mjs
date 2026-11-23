import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"original-beforeMethod": {"description": "Actual Source Index/Page original-beforeMethod; precise physical lease/receipt boundary", "resources": []}, "original-afterMethod": {"description": "Actual Source Index/Page original-afterMethod; precise physical lease/receipt boundary", "resources": []}, "retired-nav": {"description": "Actual Source Index/Page retired-nav; precise physical lease/receipt boundary", "resources": []}, "retired-mount": {"description": "Actual Source Index/Page retired-mount; precise physical lease/receipt boundary", "resources": []}, "retired-route": {"description": "Actual Source Index/Page retired-route; precise physical lease/receipt boundary", "resources": []}, "retired-runtime": {"description": "Actual Source Index/Page retired-runtime; precise physical lease/receipt boundary", "resources": []}, "retired-unmount": {"description": "Actual Source Index/Page retired-unmount; precise physical lease/receipt boundary", "resources": []}, "same-runtime-source": {"description": "Actual Source Index/Page same-runtime-source; precise physical lease/receipt boundary", "resources": []}, "pending-ack-remount": {"description": "Actual Source Index/Page pending-ack-remount; precise physical lease/receipt boundary", "resources": []}, "cookie-cleanup": {"description": "Actual Source Index/Page cookie-cleanup; precise physical lease/receipt boundary", "resources": []}, "same-runtime-tools": {"description": "Actual Source Index/Page same-runtime-tools; precise physical lease/receipt boundary", "resources": []}, "foreign-receipt": {"description": "Actual Source Index/Page foreign-receipt; precise physical lease/receipt boundary", "resources": []}, "negative-attachment": {"description": "Actual Source Index/Page negative-attachment; precise physical lease/receipt boundary", "resources": []}, "native-confirmation": {"description": "Actual Source Index/Page native-confirmation; precise physical lease/receipt boundary", "resources": []}};
async function runCase(caseID){
const { resolveEtsLoaderRoot }=await import('./lib/tool-environment.mjs');
const assert=(await import('node:assert/strict')).default;
const {readFileSync}=await import('node:fs');
const {createRequire}=await import('node:module');
const {fixture}=await import('./lib/source-management-durable-probe.mjs');
const {compile,deferred,until}=await import('./lib/rules-mutation-durable-probe.mjs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {boundedMembers,boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {readerRecoveryView}=await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const {ReaderNativeAlertOwner}=await import('./lib/reader-native-alert-sdk-probe.mjs');
const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const {ReaderTransientFeedback}=await import('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts');
const {ReaderMeasurementStore}=await import('../entry/src/main/ets/ui/layout/ReaderMeasurements.ts');
const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const document=JSON.stringify({bookSourceUrl:'https://index-original.test',bookSourceName:'Original',enabled:true});
const id='https://index-original.test';
const loader=resolveEtsLoaderRoot();
const syntax=createRequire(import.meta.url)(loader+'/lib/validate_ui_syntax.js');
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
for(const [name,path] of [['SourceManagementPage','features/source/ui/SourceManagementPage.ets'],['SourceToolsPage','features/source/ui/SourceToolsPage.ets']]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...read(path).matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));
}
// Current composition for the physical recovery cases. The operation owners and
// opening/attachment policies are production classes, not copies of old Index
// wiring. The child stub only transports the actual Surface's Page parameters.
async function journeyIndex(f,kind='source',instance=1,presentationSource=read('features/source/presentation/SourceJourneyPresentation.ets')){
 const {ReaderNavigation}=await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
 const ReaderSourceJourney=compile('app/composition/ReaderSourceJourney.ets','ReaderSourceJourney',{},true);
 const EMPTY_SOURCE_TOOLS_SNAPSHOT=compile('features/source/application/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);
 const {SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}=compile('features/source/presentation/SourceJourneyPresentation.ets','*',
  {SourceHost:f.SourceHost,SourceToolsOrchestrator:f.SourceToolsOrchestrator,EMPTY_SOURCE_TOOLS_SNAPSHOT},true,presentationSource);
 const sdk=boundedSurfaceSdk(),journey=read('features/source/ui/SourceJourneySurface.ets');
 const childSources={...sdk.childSources,SourceManagementPage:read('features/source/ui/SourceManagementPage.ets'),
  SourceToolsPage:read('features/source/ui/SourceToolsPage.ets')};
 const {Component:Index}=createReaderBuilderProbe(read('pages/Index.ets'),['sourceJourneyContent','sourceJourneySurface',
  'sourceNavigationPorts','isCurrentRuntime','currentReadingRuntime','registerTemporaryBackBridge'],
  {...sdk.deps,ReaderRuntimeOwner:f.Runtime,SourceJourneySurface:Child},
  {...sdk.hooks,childSources:{...sdk.childSources,SourceJourneySurface:journey}});
 const {Component:Journey}=createReaderBuilderProbe(journey,boundedMembers(journey),
  {...sdk.deps,SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY,SourceManagementPage:Child,SourceToolsPage:Child,readerAppColor},
  {...sdk.hooks,childSources});
 const i=new Index(undefined,{}),showingTools=kind==='sourceTools';
 Object.assign(i,{route:kind,mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,navigationGeneration:1,
  detailShelfAdmissionMount:1,rssInstanceIdentity:instance,sourceJourney:new SourceJourneyPresentation(),
  navigationOwner:new ReaderNavigation(),searchAppForeground:true,arkWebCapturesInput:false,
  libraryAcquisition:{currentOwner:()=>f.Runtime.isCurrent(f.runtime)?f.runtime:undefined},
  settingsPresentation:{snapshot:{reduceMotion:false}},jsonImportPresentation:{opening:undefined},expandedLayout:()=>false});
 i.navigationOwner.advance();i.navigationOwner.show(kind);
 i.sourceNavigation=new ReaderSourceJourney(i.navigationOwner,i.sourceNavigationPorts());
 let firstProjection;
 i.sourceJourney.observe(view=>{
  const projection=showingTools?view.tools:view.operation;
  if(firstProjection===undefined&&projection.original!==undefined)firstProjection=projection;
 });
 i.sourceNavigation.openPresentation(kind);i.sourceJourneyContent(showingTools);
 const scene=new Journey(undefined,{});
 Object.assign(scene,[...i.children.values()].find(child=>child instanceof Child).params);
 scene.aboutToAppear();scene[showingTools?'toolsPage':'managementPage']();
 const host=showingTools?i.sourceJourney.tools(i.sourceJourney.toolsIdentity()):i.sourceJourney.registry;
 const operationOwner=showingTools?host:f.SourceOrchestrator.forRuntime(f.runtime);
 return{i,host,scene,firstProjection,read:()=>i.sourceJourney.snapshot(),
  identity:()=>showingTools?i.sourceJourney.toolsIdentity():i.sourceJourney.managementIdentity(),
  params(){scene.replay();return [...scene.children.values()].find(child=>child instanceof Child).params;},
  async settled(){if(showingTools)await operationOwner.operationTail;else await operationOwner.operationChain;}};
}
function journeyRecoveryPage(x,kind='source'){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),tools=kind==='sourceTools';
 const names=tools?['recovery','recoveryAction','originalRecoveryActions','originalRecoveryIdentity',
  'isCurrentOriginalRecovery','reconcileOriginal','continueOriginal']:
  ['originalRecovery','originalRecoveryView','originalActionIdentities','originalActionGeneration',
   'originalActionCurrent','managementBackIsCurrent','managementOpeningIsCurrent','aboutToDisappear',
   'retireGroupSelection','cancelGroupFocus','cancelToolsReturnFocus','traceToolsReturnFocus',
   'pendingToolsFocus','toolsFocusReady','toolsFocusScheduled','toolsFocusRevision','toolsFocusAttempt',
   'transientFeedback','measurements','groupFocusRevision','onTemporaryBackBridge'];
 const child=sdk.consumer(read('features/source/ui/'+(tools?'SourceToolsPage':'SourceManagementPage')+'.ets'),names,
  {readerRecoveryView,ReaderTransientFeedback,ReaderMeasurementStore,hilog:{info(){}}});
 // These focused cases exercise retained physical recovery closures. Native
 // initial mounting, focus and unrelated Page setup are outside their evidence
 // scope. The unmount case calls the production Page teardown unchanged.
 Object.assign(child,x.params(),{mounted:true,appForeground:true,appThemeScheme:'day',groupOpen:false,
  temporaryBackIdentity:'source-remount:'+x.identity()});
 const feedback=()=>child[tools?'recoveryAction':'originalRecovery']();feedback();
 return{child,sdk,nodes:()=>sdk.nodes(child),
  update(){Object.assign(child,x.params());sdk.properties.flush();child.replay();feedback();sdk.properties.flush();},
  action(label){
  const currentLabel=({'核对原操作回执':'核对','继续原操作':'继续','继续原清理':'继续清理'})[label]??label;
  const actor=sdk.walk(child).findLast(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label===currentLabel);
  assert.ok(actor,label);
  const hits=sdk.nodes(actor).filter(node=>node.type==='Button'&&typeof node.onClick==='function');
  assert.equal(hits.length,1,label+' has one actual native Button action');
  return{actor,click:hits[0].onClick};
 }};
}
async function pending(moment){const f=await fixture();await f.source.importBookSourceDocument(document,f.current);f.options[moment]='rules.mutation.apply';
 await assert.rejects(f.source.updateSource(id,{enabled:false},f.current));const original=JSON.parse(f.disk());f.retire();return{f:await fixture(f),original};}
async function originalPhysicalRecovery(moment){
 const {f,original}=await pending(moment),x=await journeyIndex(f);await x.settled();const p=journeyRecoveryPage(x);
 assert.equal(x.read().operation.original.blocked,true);assert.equal(f.writes().length,0);
 assert.ok(p.nodes().some(n=>n.type==='Span'&&n.create==='  '+x.read().operation.original.message));
 const label=x.read().operation.original.confirmation==='confirmed'?'继续原清理':'继续原操作';
 const check=p.action('核对原操作回执'),next=p.action(label);
 check.click();await x.settled();assert.equal(f.writes().length,0);
 assert.equal(f.cleanupCalls.length,0,'pure reconciliation never runs cookie cleanup');p.update();
 next.click();await x.settled();assert.equal(f.writes().length,0,'actual retained Page props cannot upgrade prior physical recovery generation');
 p.action(label).click();p.action(label).click();await x.settled();assert.equal(f.writes().length,moment==='beforeMethod'?1:0);
 if(f.writes().length){assert.equal(f.writes()[0].params.operationId,original.operationId);assert.deepEqual(f.writes()[0].params.mutation,original.mutation);}
 assert.deepEqual(f.cleanupCalls,[id]);assert.equal(f.disk(),'');assert.equal(x.read().operation.original.blocked,false);
}
async function retiredPhysicalRecovery(retired){
 const {f}=await pending('beforeMethod'),x=await journeyIndex(f);await x.settled();
 const p=journeyRecoveryPage(x),old=p.action('继续原操作');
 if(retired==='nav')x.i.navigationGeneration=x.i.navigationOwner.advance().generation;
 if(retired==='mount')x.i.detailShelfAdmissionMount++;
 if(retired==='route')x.i.route=x.i.navigationOwner.show('bookshelf').route;
 if(retired==='runtime')f.retire();
 if(retired==='unmount')p.child.aboutToDisappear();
 const count=f.calls.length;old.click();await x.settled();assert.equal(f.calls.length,count);assert.notEqual(f.disk(),'');
}
let groups=0;

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'durable-fixture-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;
try {
const cases={
'original-beforeMethod':async()=>{
 await originalPhysicalRecovery('beforeMethod');groups++;

},
'original-afterMethod':async()=>{
 await originalPhysicalRecovery('afterMethod');groups++;

},
'retired-nav':async()=>{
 await retiredPhysicalRecovery('nav');groups++;

},
'retired-mount':async()=>{
 await retiredPhysicalRecovery('mount');groups++;

},
'retired-route':async()=>{
 await retiredPhysicalRecovery('route');groups++;

},
'retired-runtime':async()=>{
 await retiredPhysicalRecovery('runtime');groups++;

},
'retired-unmount':async()=>{
 await retiredPhysicalRecovery('unmount');groups++;

},
'same-runtime-source':async()=>{
 const {f}=await pending('beforeMethod'),a=await journeyIndex(f,'source',1);await a.settled();
 const pa=journeyRecoveryPage(a,'source'),old=pa.action('继续原操作');
 const b=await journeyIndex(f,'source',2);
 assert.equal(b.firstProjection.original.operationId,a.i.sourceJourney.snapshot().operation.original.operationId,'first synchronous DTO already observes true Host binding');
 assert.equal(b.firstProjection.original.blocked,true);await b.settled();
 const pb=journeyRecoveryPage(b,'source'),count=f.calls.length;
 old.click();await a.settled();assert.equal(f.calls.length,count);
 a.i.sourceNavigation.openPresentation('source');
 assert.equal(a.i.sourceJourney.management(a.identity()),undefined,'alive old opening cannot steal successor exact lease');
 a.i.sourceJourney.retire();assert.equal(b.host.isPresentationCurrent(f.runtime,b.identity()),true,'late old detach does not erase successor');
 pb.action('继续原操作').click();await b.settled();assert.equal(f.writes().length,1);groups++;

},
'pending-ack-remount':async()=>{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);const a=await journeyIndex(f);await a.settled();
 const gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;a.params().onToggleSource(id,false);
 await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'&&c.params.mutation.method==='source.update'));
 const accepted=a.read().operation,b=await journeyIndex(f,'source',2);
 assert.deepEqual(b.firstProjection,accepted,'accepted operation first DTO survives sameRuntime remount before ACK');
 const count=f.writes().length;a.params().onToggleSource(id,true);assert.equal(f.writes().length,count);gate.resolve();await b.settled();
 b.params().onRetryLoad();await b.settled();assert.equal(b.read().sources[0].enabled,false);assert.equal(f.writes().length,count);groups++;

},
'cookie-cleanup':async()=>{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);const x=await journeyIndex(f);await x.settled();f.options.cookieFailure=true;
 x.params().onToggleSource(id,false);await x.settled();const p=journeyRecoveryPage(x),writes=f.writes().length;
 assert.equal(x.read().operation.original.confirmation,'confirmed');assert.equal(x.read().operation.original.writeStage,'cleanup');
 p.action('核对原操作回执').click();await x.settled();assert.equal(f.writes().length,writes);assert.equal(x.read().operation.original.blocked,true);
 p.update();f.options.cookieFailure=false;p.action('继续原清理').click();await x.settled();assert.equal(f.writes().length,writes);assert.equal(f.disk(),'');groups++;

},
'same-runtime-tools':async()=>{
 const {f}=await pending('beforeMethod'),a=await journeyIndex(f,'sourceTools',1);await a.settled();
 const pa=journeyRecoveryPage(a,'sourceTools'),old=pa.action('继续原操作'),original=a.i.sourceJourney.snapshot().tools.original;
 const b=await journeyIndex(f,'sourceTools',2);assert.equal(b.host,a.host);
 assert.equal(b.firstProjection.original.operationId,original.operationId,'Tools successor gets original first DTO');await b.settled();
 const pb=journeyRecoveryPage(b,'sourceTools'),before=f.calls.length;old.click();await a.settled();assert.equal(f.calls.length,before);
 a.i.sourceNavigation.openPresentation('sourceTools');
 assert.equal(a.i.sourceJourney.tools(a.identity()),undefined,'alive old opening cannot reattach the successor Host');
 assert.equal(b.host.isPresentationCurrent(b.identity()),true);
 a.i.sourceJourney.retire();assert.equal(b.host.isPresentationCurrent(b.identity()),true,'late old detach does not erase successor');
 pb.action('继续原操作').click();await b.settled();assert.equal(f.writes().length,1);assert.equal(f.disk(),'');groups++;

},
'foreign-receipt':async()=>{
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.save());f.retire();
 const cold=await fixture(f),x=await journeyIndex(cold);await x.settled();const p=journeyRecoveryPage(x);
 assert.equal(x.read().operation.original.blocked,true);assert.equal(x.read().operation.original.canRetryOriginal,false);
 assert.equal(p.sdk.walk(p.child).some(c=>c instanceof p.sdk.deps.ReaderRecoveryAction&&['继续','继续清理'].includes(c.label)),false,'foreign rule receipt has no Source continuation');
 p.action('核对原操作回执').click();await x.settled();assert.equal(cold.writes().length,0);assert.equal(cold.cleanupCalls.length,0);groups++;

},
'negative-attachment':async()=>{
 const source=read('features/source/presentation/SourceJourneyPresentation.ets');
 const boundary='this.toolsLease === identity && host?.isPresentationCurrent(identity) === true';
 assert.ok(source.includes(boundary),'the current production attachment guard is the mutation target');
 assert.equal(source.indexOf(boundary),source.lastIndexOf(boundary),'mutate only the one tools attachment guard');
 for(const mutant of [false,true]){
  const {f,original}=await pending('beforeMethod');
  const definition=mutant?source.replace(boundary,'this.toolsLease === identity'):source;
  const a=await journeyIndex(f,'sourceTools',1,definition);await a.settled();
  const old=journeyRecoveryPage(a,'sourceTools').action('继续原操作'),oldIdentity=a.identity(),host=a.host;
  const attach=host.attachPresentation;let attachments=0,b;
  // Invoke the retained physical action immediately after the REAL successor
  // attachment publishes its retained DTO. openPresentation continues into
  // the real open() afterwards; neither owner method is skipped or copied.
  host.attachPresentation=function(identity,emit,current){
   const result=attach.call(this,identity,emit,current);
   assert.notEqual(identity,oldIdentity);assert.equal(this.isPresentationCurrent(oldIdentity),false);
   assert.equal(this.isPresentationCurrent(identity),true);attachments++;
   old.click();return result;
  };
  try{b=await journeyIndex(f,'sourceTools',2);}finally{host.attachPresentation=attach;}
  await b.settled();assert.equal(attachments,1,'exactly one real successor attachment was observed');
  assert.equal(f.writes().length,mutant?1:0,mutant?
   'negative control demonstrates old physical action borrows successor without exact attachment guard':
   'the same old physical action is rejected by the actual production attachment guard');
  if(mutant){
   assert.equal(f.writes()[0].params.operationId,original.operationId);
   assert.deepEqual(f.writes()[0].params.mutation,original.mutation);assert.equal(f.disk(),'');
  }else assert.notEqual(f.disk(),'','rejected old action retains the original unresolved receipt');
 }
 groups++;

},
'native-confirmation':async()=>{
 const {ReaderNavigation}=await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
 const ReaderSourceJourney=compile('app/composition/ReaderSourceJourney.ets','ReaderSourceJourney',{},true);
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 const EMPTY_SOURCE_TOOLS_SNAPSHOT=compile('features/source/application/SourceToolsOrchestrator.ets','EMPTY_SOURCE_TOOLS_SNAPSHOT',{},true);
 const {SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY}=compile('features/source/presentation/SourceJourneyPresentation.ets','*',
  {SourceHost:f.SourceHost,SourceToolsOrchestrator:f.SourceToolsOrchestrator,EMPTY_SOURCE_TOOLS_SNAPSHOT},true);
 const sdk=boundedSurfaceSdk(),journey=read('features/source/ui/SourceJourneySurface.ets');
 const {Component:Index}=createReaderBuilderProbe(read('pages/Index.ets'),['sourceJourneyContent','sourceJourneySurface',
  'sourceNavigationPorts','isCurrentRuntime','currentReadingRuntime','showIndexAlert'],
  {...sdk.deps,ReaderRuntimeOwner:f.Runtime,SourceJourneySurface:Child,hilog:{warn(){}},DOMAIN:0},
  {...sdk.hooks,childSources:{...sdk.childSources,SourceJourneySurface:journey}});
 const {Component:Journey}=createReaderBuilderProbe(journey,boundedMembers(journey),
  {...sdk.deps,SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY,SourceToolsPage:Child,readerAppColor},
  {...sdk.hooks,childSources:{...sdk.childSources,SourceToolsPage:read('features/source/ui/SourceToolsPage.ets')}});
 const tools=instance=>{
  const i=new Index(undefined,{}),alerts=[];
  Object.assign(i,{route:'sourceTools',mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,navigationGeneration:1,
   detailShelfAdmissionMount:1,rssInstanceIdentity:instance,sourceJourney:new SourceJourneyPresentation(),
   navigationOwner:new ReaderNavigation(),searchAppForeground:true,arkWebCapturesInput:false,
   libraryAcquisition:{currentOwner:()=>f.Runtime.isCurrent(f.runtime)?f.runtime:undefined},
   settingsPresentation:{snapshot:{reduceMotion:false}},jsonImportPresentation:{opening:undefined},expandedLayout:()=>false,
   nativeAlertOwner:new ReaderNativeAlertOwner(),getUIContext:()=>({showAlertDialog:options=>alerts.push(options)})});
  i.navigationOwner.advance();i.navigationOwner.show('sourceTools');
  i.sourceNavigation=new ReaderSourceJourney(i.navigationOwner,i.sourceNavigationPorts());
  i.sourceNavigation.openPresentation('sourceTools');i.sourceJourneyContent(true);
  const scene=new Journey(undefined,{});
  Object.assign(scene,[...i.children.values()].find(child=>child instanceof Child).params);
  scene.aboutToAppear();scene.toolsPage();
  const params=[...scene.children.values()].find(child=>child instanceof Child).params;
  const host=i.sourceJourney.tools(i.sourceJourney.toolsIdentity());
  const selection=()=>{const current=host.current();return {sourceIds:current.selectedSourceIds,
   sourceListRevision:current.sourceListRevision,selectionRevision:current.selectionRevision};};
  return {i,host,params,alerts,selection,settled:()=>host.operationTail};
 };
 const a=tools(1);await a.settled();a.host.setSelection([id]);const staleSelection=a.selection();
 a.host.setSelection([]);a.host.setSelection([id]);
 a.params.onDeleteSelected(staleSelection);
 assert.deepEqual(a.alerts,[],'selecting the same source again still retires the original selection proof');
 a.params.onDeleteSelected(a.selection());const canceled=a.alerts.at(-1),beforeCancel=f.writes().length;
 assert.ok(canceled?.primaryButton);canceled.primaryButton.action();await a.settled();
 assert.equal(f.writes().length,beforeCancel,'native cancellation performs no deletion');
 a.host.setSelection([id]);a.params.onDeleteSelected(a.selection());const old=a.alerts.at(-1);assert.ok(old?.secondaryButton);
 const b=tools(2),writes=f.writes().length;old.secondaryButton.action();await b.settled();
 assert.equal(f.writes().length,writes,'old native confirmation cannot borrow successor Tools lease at same Runtime/nav');
 b.host.setSelection([id]);b.params.onDeleteSelected(b.selection());const live=b.alerts.at(-1);assert.ok(live?.secondaryButton);live.secondaryButton.action();await b.settled();
 assert.equal(f.writes().length,writes+1);assert.equal(b.host.current().sources.length,0);groups++;

},
};await cases[caseID]();passed=true;
} finally {const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
for(const id of selectContractCases(definitions)){await runCase(id);recordContractCasePass(id);}
