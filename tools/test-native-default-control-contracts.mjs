import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"recovery-cta": {"description": "实际失败Builder→RecoveryAction scope/generation/native回调", "resources": []}, "directory-fallback": {"description": "现用文字目录临时unavailable与retry保原生List和Scroller", "resources": []}, "rules-input": {"description": "实际Rules Gateway→shared native level old opening/Runtime拒绝", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { createRequire } = await import('node:module');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readFileSync } = await import('node:fs');
const { boundedSurfaceSdk,boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { DirectoryRuleDraft } = await import('./lib/reader-reading-field-probe.mjs');
const {ReaderScrollLayout,readerScrollStartOffset,readerScrollEndOffset} = await import('../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts');
const {snapshotReaderDirectoryData,sameReaderDirectoryData} = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts');
const {ReaderDirectoryNavigationGateway, readerDirectoryScopeKey,
 readerDirectoryNoteMissingNavigation} = await import('../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts');
const {openReaderDirectoryNavigation, readerDirectoryToggleCollapsed} = await import('./lib/reader-directory-navigation-session-probe.mjs');
const {readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor, readerDirectorySignalScrollIntent} = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryViewport.ts');
const {ReaderDirectoryTrace} = await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryTrace.ts');
const fontFamilies = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');

const fixture=JSON.parse(readFileSync(new URL('./fixtures/design/native-default-control-contracts.json',import.meta.url)));
const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
const normalise=text=>(text??'').replace(/\s+/g,'');
const contracts=new Map(fixture.consumers.map(row=>[JSON.stringify([row.file,row.method,row.kind,normalise(row.argument)]),row]));
const failureSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url),'utf8');
// Exercise the actual owner Builder and mounted public children, including
// scope capture and the production inline-recovery generation guard.
if(selectedCase==='recovery-cta') {
for(const [switchFailure,local,inline]of [[true,false,false],[false,true,false],[false,false,false],[false,false,true]]){
 const p=boundedSurfaceSdk(),events=[];
 const owner=p.consumer(failureSource,['readingFailureContent','reconcileReaderRecovery','showReaderRecovery','readerRecoveryOwnerKey'],{
  LOCAL_READING_SOURCE_ID:'local',readerAppearanceThemeStyle:()=>({ink:'#000',paperStart:'#fff'})});
 Object.assign(owner,{appThemeScheme:'day',mounted:true,exitRequested:false,lifecycleToken:1,chapterSelectionToken:1,bookId:'book',
  sourceId:local?'local':'remote',sourceSwitchFailureMessage:switchFailure?'换源失败':'',failureHint:'读取失败',sourceSwitchScopeId:7,
  appearanceSnapshot:{activeTheme:'paper'},readerRecoveryView:{visible:inline,canRetry:inline,generation:9},readerRecoveryActionLabel:'核对原事项',
  readerRecoveryAction:()=>events.push('inline'),readingLayout:()=>({bodyWidth:()=>350,bodyHeight:()=>600,contentLeft:0,contentTop:0}),
  onRetryFailedSourceSwitch:scope=>events.push(['retry',scope]),onDismissSourceSwitchFailure:scope=>events.push(['continue',scope]),
  retryReading:()=>events.push('retry'),openReaderControl:()=>events.push('settings'),onSwitchSource:()=>events.push('source')});
 owner.readingFailureContent();const actors=p.walk(owner).filter(c=>c instanceof p.deps.ReaderRecoveryAction);
 assert.deepEqual(actors.map(c=>c.label),[inline?'核对原事项':'重试','阅读设置',...(switchFailure?['继续当前书源']:[]),...(!local?['切换书源']:[])]);
 for(const actor of actors){const label=p.nodes(actor).find(n=>n.type==='Text'),hit=p.nodes(actor).find(n=>n.onClick);
  assert.ok(label&&hit);assert.equal(hit.type,'Stack');
  if(actor.label==='重试'&&switchFailure)owner.sourceSwitchScopeId=99;
  hit.onClick();if(inline&&actor.label==='核对原事项'){hit.onClick();assert.equal(events.filter(e=>e==='inline').length,1,'production inline recovery rejects the retired generation');}
 }
 if(switchFailure){assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='retry'&&e[1]===7));assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='continue'&&e[1]===7),'retained native callbacks keep captured original scope');}
}

}
// Mount the production text directory's chapter-list slot. Viewport inputs
// are fixed here so the case isolates native List retention during readback.
async function proveNativeDirectoryFallback(navigationSource) {
 const read=file=>readFileSync(new URL('../entry/src/main/ets/features/reading/ui/'+file+'.ets',import.meta.url),'utf8');
 const panelSource=read('FullDirectoryPanel');
 const probe=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const navigationRequests=[];
 const runtime={supportsCoreCapability:()=>true,request:async(command,params)=>{
  navigationRequests.push({command,params});
  return {data:{status:'unavailable',reason:'no_navigation'}};
 }};
 Object.assign(probe.deps,{...fontFamilies,ReaderRuntimeOwner:{current:()=>runtime,isCurrent:value=>value===runtime},
  ReaderScrollLayout,readerScrollStartOffset,readerScrollEndOffset,
  ReaderDirectoryNavigationGateway,readerDirectoryScopeKey,openReaderDirectoryNavigation,
  readerDirectoryNoteMissingNavigation,readerDirectoryToggleCollapsed,ReaderDirectoryTrace,
  readerDirectoryObserveScrollIntent,readerDirectoryViewportAnchor,Edge:{Top:'top',Bottom:'bottom'}});
 probe.childSources.ReaderDirectoryNavigationList=read('ReaderDirectoryNavigationList');
 probe.deps.ReaderDirectoryNavigationList=class {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});this.children=new Map();this.nodes=new Map();}
 };
 probe.childSources.ReaderDirectoryNavigationSurface=navigationSource??read('ReaderDirectoryNavigationSurface');
 probe.childSources.ReaderDirectoryList=read('ReaderDirectoryList');
 const syntax=req(sdk+'/lib/validate_ui_syntax.js');
 syntax.builderParamObjectCollection.set('ReaderDirectoryNavigationSurface',new Set(['fallbackBuilder']));
 syntax.builderParamObjectCollection.set('ReaderDirectoryList',new Set(['rowBuilder','emptyBuilder']));
 const listTree=ts.createSourceFile('ReaderDirectoryList.ets',probe.childSources.ReaderDirectoryList,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const data=listTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='DirectoryListDataSource');assert.ok(data);
 const DirectoryListDataSource=new Function('sameReaderDirectoryData','snapshotReaderDirectoryData',ts.transpileModule(data.getText(listTree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return DirectoryListDataSource;')(sameReaderDirectoryData,snapshotReaderDirectoryData);
 Object.assign(probe.deps,{DirectoryListDataSource,ChildrenMainSize:class{constructor(size){this.childDefaultSize=size;}}});
 for(const name of ['ReaderDirectoryList','ReaderDirectoryNavigationSurface']) {
  const source=probe.childSources[name];
  probe.deps[name]=createReaderBuilderProbe(source,boundedMembers(source),probe.deps,probe.hooks).Component;
 }
 const entry={index:17,title:'实际章节',navigable:true,bookmarks:[]};
 const scroller={};
 const panel=probe.consumer(panelSource,['chapterList','flatChapterList'],probe.deps);
 Object.assign(panel,{bookmarkIdentity:{sourceId:'local',bookId:'native-layout-book'},
  admittedEntries:[entry],projectedEntries:[entry],searchQuery:'',ascending:true,currentChapterIndex:17,
  listSessionKey:'native-text-directory',directoryRulesRevision:0,prepareLocalTxt:false,motionActive:false,chapterActionsEnabled:true,
  navigationActive:false,navigationInteracted:false,initialListPositionReady:true,listScroller:scroller,
  chapterDownloadEnabled:false,chapterStartBookmarkCreationEnabled:false,embeddedInControl:false,
  directoryListRowHeight:()=>40,directoryListPaddingX:()=>10,directoryListWidth:()=>360,
  directoryListViewportHeight:()=>620,chapterListHeight:()=>620});
 panel.chapterList();
 const nativeLists=()=>probe.nodes(panel).filter(n=>n.type==='List');
 const [list]=nativeLists();assert.ok(list,'the actual text fallback mounts a native List');
 assert.equal(list.create.scroller,scroller);
 const navigation=probe.walk(panel).find(owner=>owner instanceof probe.deps.ReaderDirectoryNavigationSurface);assert.ok(navigation);
 const retainedFlatList=()=>{
  assert.deepEqual(nativeLists(),[list],'temporary failure and retry preserve one native List');
  assert.equal(nativeLists()[0],list,'the original physical List remains mounted');
  assert.equal(list.create.scroller,scroller,'the same native Scroller remains attached');
 };
 try {
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(navigationRequests.length,1,'the mounted navigation admits one scoped request');
  assert.equal(navigationRequests[0].command,'reading.directory.view.open.v2');
  assert.equal(navigationRequests[0].params.sourceId,'local');assert.equal(navigationRequests[0].params.bookId,'native-layout-book');
  assert.equal(navigation.settledFlat,false,'a temporary missing tree remains retryable');
  assert.equal(navigation.loadPending,false);assert.equal(navigation.loadFailed,true);
  assert.equal(navigation.view,undefined,'a missing index cannot masquerade as a complete directory');
  probe.properties.flush();retainedFlatList();
  navigation.retryOpen();
  assert.equal(navigationRequests.length,2,'retryOpen admits one second directory request');
  assert.deepEqual(navigationRequests[1],navigationRequests[0],'retry preserves the original scoped query');
  assert.equal(navigation.loadPending,true);assert.equal(navigation.loadFailed,false);
  retainedFlatList();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();probe.properties.flush();
  assert.equal(navigationRequests.length,2,'a repeated unavailable response does not create a request loop');
  assert.equal(navigation.settledFlat,false);assert.equal(navigation.loadPending,false);assert.equal(navigation.loadFailed,true);
  retainedFlatList();
 } finally { navigation.aboutToDisappear(); }
 const generation=navigation.generation;
 readerDirectorySignalScrollIntent(readerDirectoryScopeKey('local','native-layout-book'));
 assert.equal(navigation.generation,generation,'disappearance releases the scroll-intent subscription');
}
if(selectedCase==='directory-fallback') {
 await proveNativeDirectoryFallback();
 const retryableDirectorySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationSurface.ets',import.meta.url),'utf8');
 const permanentlyFlatDirectory=retryableDirectorySource.replace(/this\.settledFlat = unavailableReason === 'unsupported'[\s\S]*?;/,'this.settledFlat = true;');
 assert.notEqual(permanentlyFlatDirectory,retryableDirectorySource,'negative control reinstates permanent-flat unavailable behavior');
 await assert.rejects(()=>proveNativeDirectoryFallback(permanentlyFlatDirectory),/temporary missing tree remains retryable/);
}
if(selectedCase==='rules-input') {
// Explicit unsupported-capability flat fallback remains covered by the existing
// directory navigation production-method suite; no transient reason gains it.
// Execute the real directory Builder→shared native level callback as well as
// its exact AST mapping. Neither the opening guard nor canEdit is a test stub.
{
 const file=new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryRules.ets',import.meta.url),source=readFileSync(file,'utf8');
 const gatewaySource=readFileSync(new URL('../entry/src/main/ets/features/reading/application/ReaderDirectoryRulesGateway.ts',import.meta.url),'utf8');
 const gatewayTree=ts.createSourceFile('Gateway.ts',gatewaySource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options),declaration=gatewayTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='ReaderDirectoryRulesGateway');assert.ok(declaration);
 function actual(definition){
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),controls=foundationControls();
  for(const[name,value]of Object.entries(controls.dependencies))if(!(name in sdk.properties.sdk))sdk.deps[name]=value;
  Object.assign(sdk.childSources,controls.hooks.childSources);const enter=sdk.hooks.onObserverEnter;sdk.hooks.onObserverEnter=(...args)=>{enter?.(...args);controls.hooks.onObserverEnter?.(...args);};sdk.hooks.lifecycleChildren=true;
  const owner=sdk.consumer(definition,boundedMembers(definition),{DirectoryRuleDraft},{bookId:'native-book'});
  const runtime={supportsCoreCapability:()=>false,request:async()=>({data:{status:'ready',rules:[{pattern:'^卷',level:2,boundary:'title'}]}})},authority={snapshot:()=>owner.operation,recoverOriginal:async()=>owner.operation};let liveRuntime=runtime;
  const Gateway=new Function('ReaderRuntimeOwner','RulesMutationOwner',ts.transpileModule(declaration.getText(gatewayTree).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return ReaderDirectoryRulesGateway;')({isCurrent:value=>value===liveRuntime},{forRuntime:value=>{assert.equal(value,runtime);return authority;}});
  Object.assign(owner,{gateway:new Gateway(runtime),mounted:true,loaded:true,busy:false,bookId:'native-book',presentationGeneration:1,rules:[new DirectoryRuleDraft(7,'^卷','2')],preview:[],message:'',directoryRefreshFailed:false,operation:{generation:0,busy:false,confirmation:'undispatched',label:'',method:'',message:'',blocked:false,canRetryOriginal:false,writeStage:'intent'}});
  assert.equal(owner.gateway.ownsRuntime(),true,'gateway current runtime fixture');assert.equal(owner.canEdit(),true,'real editor admission before render');owner.initialRender();assert.equal(owner.canEdit(),true,'real editor admission after render');return{owner,controls,level:()=>controls.orderedNodes(owner).filter(n=>n.type==='TextInput').at(-1),retire:()=>{liveRuntime=undefined;}};
 }
 const f=actual(source),native=f.level();native.onChange('31');assert.equal(f.owner.rules[0].level,'31','actual current native level input reaches original rule ID');
 for(const property of contracts.get(JSON.stringify(['features/reading/ui/ReaderDirectoryRules.ets','build','TextInput','{text:rule.level}'])).typographyOmissions)assert.equal(Object.hasOwn(native,property),false,'real parent consumer preserves native AUTO '+property);
 f.owner.bookId='successor-book';f.owner.presentationGeneration++;native.onChange('0');assert.equal(f.owner.rules[0].level,'31','old native input cannot edit a successor entity/opening');
 for(let i=0;i<8;i++)await Promise.resolve();f.owner.rules=[new DirectoryRuleDraft(7,'^卷','31')];f.owner.loaded=true;f.owner.busy=false;
 f.owner.initialRender();const fresh=f.level();fresh.onChange('3');assert.equal(f.owner.rules[0].level,'3','new physical actor uses current identity');
 f.retire();fresh.onChange('4');assert.equal(f.owner.rules[0].level,'3','actual Gateway rejects retired Runtime');
 const bad=source.replace('identity === this.actorIdentity()','true');assert.notEqual(bad,source);const negative=actual(bad),old=negative.level();negative.owner.presentationGeneration++;old.onChange('30');assert.equal(negative.owner.rules[0].level,'30','guard-removal control reproduces unsafe old physical input');
}
}

}
