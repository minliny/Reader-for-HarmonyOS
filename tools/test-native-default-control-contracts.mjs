import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"recovery-cta": {"description": "实际失败Builder→RecoveryAction scope/generation/native回调", "resources": []}, "directory-fallback": {"description": "实际临时unavailable两次retry保List/Scroller/area delta", "resources": []}, "rules-input": {"description": "实际Rules Gateway→shared native level old opening/Runtime拒绝", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { createRequire } = await import('node:module');
const { foundationControls, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readFileSync,readdirSync } = await import('node:fs');
const { auditNativeTextElements } = await import('./lib/reader-typography-consumer-audit.mjs');
const { boundedSurfaceSdk,boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { DirectoryRuleDraft } = await import('./lib/reader-reading-field-probe.mjs');
const {createDefaultReaderWindowMetrics,readerInteractiveSafeLeft,readerInteractiveSafeRight,readerInteractiveSafeBottom} = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {snapshotReaderDirectoryData,sameReaderDirectoryData} = await import('../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts');
const {ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, openReaderDirectoryNavigation,
 readerDirectoryNoteMissingNavigation, readerDirectoryToggleCollapsed} = await import('../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts');
const {readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor, readerDirectorySignalScrollIntent} = await import('../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts');
const {ReaderDirectoryTrace} = await import('../entry/src/main/ets/features/reading/ReaderDirectoryTrace.ts');
const fontFamilies = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');

const fixture=JSON.parse(readFileSync(new URL('./fixtures/design/native-default-control-contracts.json',import.meta.url)));
const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
const normalise=text=>(text??'').replace(/\s+/g,'');
const contracts=new Map(fixture.consumers.map(row=>[JSON.stringify([row.file,row.method,row.kind,normalise(row.argument)]),row]));
const failureSource=readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'utf8');
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
// The one relocated native family is still mounted by the shipping directory
// layout. Compile the actual public frame, header, fallback, and native List;
// unrelated toolbar/rules payloads are explicit child seams. Native lazy-row
// scheduling and the compositor remain outside this SDK closure proof.
async function proveNativeDirectoryFallback(navigationSource) {
 const read=file=>readFileSync(new URL('../entry/src/main/ets/features/'+file,import.meta.url),'utf8');
 const source=read('bookshelf/BookDirectoryPage.ets');
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=390;metrics.windowRect.height=844;metrics.systemInsets.bottom=34;
 const navigationRequests=[];
 const runtime={supportsCoreCapability:()=>true,request:async(command,params)=>{
  navigationRequests.push({command,params});
  return {data:{status:'unavailable',reason:'no_navigation'}};
 }};
 Object.assign(sdk.deps,{...fontFamilies,ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeLeft,readerInteractiveSafeRight,readerInteractiveSafeBottom,
  TOK_CONTENT_MAX_W_TABLET:720,ReaderRuntimeOwner:{current:()=>runtime},
  ReaderDirectoryNavigationGateway,readerDirectoryScopeKey,openReaderDirectoryNavigation,
  readerDirectoryNoteMissingNavigation,readerDirectoryToggleCollapsed,ReaderDirectoryTrace,
  readerDirectoryObserveScrollIntent,readerDirectoryViewportAnchor,
  EMPTY_READING_DIRECTORY_RECOVERY:{bookmarks:{visible:false},offline:{visible:false}},Edge:{Top:'top',Bottom:'bottom'}});
 class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});this.children=new Map();this.nodes=new Map();}}
 for(const[name,file]of Object.entries({ReaderDirectoryToolbar:'reading/ReaderDirectoryToolbar.ets',ReaderDirectoryRules:'reading/ReaderDirectoryRules.ets',ReaderDirectoryRecoverySurface:'reading/ReaderDirectoryRecoverySurface.ets',ReaderDirectoryNavigationList:'reading/ReaderDirectoryNavigationList.ets'})){
  sdk.childSources[name]=read(file);sdk.deps[name]=Child;
 }
 for(const[name,file]of Object.entries({PageBackBar:'common/PageBackBar.ets',ReaderDirectoryNavigationSurface:'reading/ReaderDirectoryNavigationSurface.ets',ReaderDirectoryList:'reading/ReaderDirectoryList.ets'}))sdk.childSources[name]=name==='ReaderDirectoryNavigationSurface'&&navigationSource!==undefined?navigationSource:read(file);
 const syntax=req(sdkRoot()+'/lib/validate_ui_syntax.js');
 syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
 syntax.builderParamObjectCollection.set('ReaderDirectoryNavigationSurface',new Set(['fallbackBuilder']));
 syntax.builderParamObjectCollection.set('ReaderDirectoryList',new Set(['rowBuilder','emptyBuilder']));
 const listTree=ts.createSourceFile('ReaderDirectoryList.ets',sdk.childSources.ReaderDirectoryList,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const data=listTree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='DirectoryListDataSource');assert.ok(data);
 const DirectoryListDataSource=new Function('sameReaderDirectoryData','snapshotReaderDirectoryData',ts.transpileModule(data.getText(listTree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return DirectoryListDataSource;')(sameReaderDirectoryData,snapshotReaderDirectoryData);
 // Native extent/Scroller constructor identity is the platform seam, not a
 // reconstructed layout or row-virtualization algorithm.
 Object.assign(sdk.deps,{DirectoryListDataSource,ChildrenMainSize:class{constructor(size){this.childDefaultSize=size;}}});
 for(const name of['ReaderDirectoryList','ReaderDirectoryNavigationSurface','PageBackBar'])sdk.deps[name]=createReaderBuilderProbe(sdk.childSources[name],boundedMembers(sdk.childSources[name]),sdk.deps,sdk.hooks).Component;
 const selected=[];
 const page=sdk.consumer(source,['standardPage','standardContent','standardHeader','standardToolbar','flatList','recoveryContent','supportsDirectoryRules','supportsCurrentDirectoryView','contentFrame','bottomInset','identity','rulesExpanded','rulesRevision'],sdk.deps);
 const scroller={};const entry={index:17,title:'实际章节',navigable:true,bookmarks:[]};
 Object.assign(page,{sourceId:'local',bookId:'native-layout-book',bookKind:'txt',contentKind:'text',viewportWidth:390,readerWindowMetricsRevision:0,appThemeScheme:'day',
  admittedIdentity:'local\u0000native-layout-book',admittedEntries:[entry],projectedEntries:[entry],searchDraft:'',searchQuery:'',ascending:true,currentChapterIndex:17,
  navigationActive:false,navigationInteracted:false,mounted:true,chapterStartBookmarkCreationEnabled:false,listScroller:scroller,
  directoryRecovery:{bookmarks:{visible:false},offline:{visible:false}},onBack(){},onSelectNavigationTarget:index=>selected.push(index)});
 page.standardPage();
 const nodes=()=>sdk.nodes(page),button=nodes().find(n=>n.type==='Button'&&n.createWithLabel==='本书目录层级规则');assert.ok(button,'actual original native label is mounted through the public header slot');
 for(const omission of fixture.consumers.find(row=>row.id==='NATIVE-DEFAULT-01').typographyOmissions)assert.equal(Object.hasOwn(button,omission),false,'original native typography AUTO '+omission);
 const list=nodes().find(n=>n.type==='List');assert.ok(list,'actual navigation fallback mounts the shared native List');assert.equal(list.create.scroller,scroller);const initialStart=list.contentStartOffset;assert.ok(initialStart>0);
 const count=nodes().filter(n=>n.type==='List').length;
 const header=nodes().find(n=>n.type==='Column'&&n.zIndex===10&&n.onAreaChange);assert.ok(header);assert.match(header.backgroundColor,/^#FF/,'actual fixed header paints the opaque scrolling mask');
 button.onClick();assert.equal(page.rulesExpanded,true,'the original physical native rules callback toggles the page state');
 header.onAreaChange({}, {height:'157vp'});sdk.properties.flush();
 const firstMeasuredStart=list.contentStartOffset;header.onAreaChange({}, {height:'204vp'});sdk.properties.flush();assert.equal(list.contentStartOffset-firstMeasuredStart,204-157,'actual header delta reaches retained List');const retainedMeasuredStart=list.contentStartOffset;
 assert.equal(nodes().filter(n=>n.type==='List').length,count,'header measurement preserves the original physical List actor');
 const navigation=sdk.walk(page).find(owner=>owner!==page&&owner.fallbackBuilder&&owner.chapterEntries);assert.ok(navigation);
 const retainedFlatList=()=>{
  assert.equal(nodes().filter(n=>n.type==='List').length,count,'temporary tree failure/retry retains exactly the mounted native flat List');
  assert.equal(nodes().find(n=>n.type==='List'),list,'temporary tree failure/retry retains the same physical List actor');
  assert.equal(list.create.scroller,scroller,'temporary tree failure/retry preserves the native Scroller identity');
  assert.equal(list.contentStartOffset,retainedMeasuredStart,'temporary tree failure/retry preserves measured header offset');
 };
 try {
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(navigationRequests.length,1,'the actual mounted navigation lifecycle admits one scoped request');
 assert.equal(navigationRequests[0].command,'reading.directory.view.open.v2');
 assert.equal(navigationRequests[0].params.sourceId,'local');assert.equal(navigationRequests[0].params.bookId,'native-layout-book');
 assert.equal(navigation.settledFlat,false,'a temporary missing tree remains retryable instead of permanently settling the flat fallback');
 assert.equal(navigation.loadPending,false,'the first unavailable response releases pending state');
 assert.equal(navigation.loadFailed,true,'a missing navigation index exposes an explicit recoverable failure');
 assert.equal(navigation.view,undefined,'a missing index cannot masquerade as a complete directory');
 sdk.properties.flush();retainedFlatList();
 navigation.retryOpen();
 assert.equal(navigationRequests.length,2,'actual SDK retryOpen admits exactly one second directory request');
 assert.equal(navigationRequests[1].command,'reading.directory.view.open.v2');
 assert.deepEqual(navigationRequests[1].params,navigationRequests[0].params,'retry preserves the original scoped directory query');
 assert.equal(navigation.loadPending,true,'retry owns an explicit pending state');
 assert.equal(navigation.loadFailed,false,'retry clears the previous failure presentation');
 // The SDK seam does not model native Retry-CTA removal. Verify the retained
 // List during pending, then replay dependency delivery at the next error state;
 // loading/error actors and the physical retry callback have their own SDK cases.
 retainedFlatList();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();sdk.properties.flush();
 assert.equal(navigationRequests.length,2,'a repeated unavailable response does not create an automatic request loop');
 assert.equal(navigation.settledFlat,false,'a repeated temporary unavailable response stays retryable');
 assert.equal(navigation.loadPending,false);assert.equal(navigation.loadFailed,true);
 retainedFlatList();
 navigation.onSelectTarget(17,0);assert.deepEqual(selected,[17]);page.bookId='successor-book';navigation.onSelectTarget(17,0);assert.deepEqual(selected,[17],'retained old directory actor cannot target a successor book');
 } finally { navigation.aboutToDisappear(); }
 const generation=navigation.generation;
 readerDirectorySignalScrollIntent(readerDirectoryScopeKey('local','native-layout-book'));
 assert.equal(navigation.generation,generation,'the real scroll-intent subscription is released on disappearance');
 function sdkRoot(){return resolveEtsLoaderRoot();}
}
if(selectedCase==='directory-fallback') {
await proveNativeDirectoryFallback();
const retryableDirectorySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets',import.meta.url),'utf8');
const permanentlyFlatDirectory=retryableDirectorySource.replace("this.settledFlat = unavailableReason === 'unsupported';",'this.settledFlat = true;');
assert.notEqual(permanentlyFlatDirectory,retryableDirectorySource,'negative control reinstates the old permanent-flat unavailable behavior');
await assert.rejects(()=>proveNativeDirectoryFallback(permanentlyFlatDirectory),/temporary missing tree remains retryable/,
 'the actual SDK native fallback contract rejects the old permanent-flat directory error');
}
if(selectedCase==='rules-input') {
// Explicit unsupported-capability flat fallback remains covered by the existing
// directory navigation production-method suite; no transient reason gains it.
// Execute the real directory Builder→shared native level callback as well as
// its exact AST mapping. Neither the opening guard nor canEdit is a test stub.
{
 const file=new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets',import.meta.url),source=readFileSync(file,'utf8');
 const gatewaySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRulesGateway.ts',import.meta.url),'utf8');
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
 for(const property of contracts.get(JSON.stringify(['features/reading/ReaderDirectoryRules.ets','build','TextInput','{text:rule.level}'])).typographyOmissions)assert.equal(Object.hasOwn(native,property),false,'real parent consumer preserves native AUTO '+property);
 f.owner.bookId='successor-book';f.owner.presentationGeneration++;native.onChange('0');assert.equal(f.owner.rules[0].level,'31','old native input cannot edit a successor entity/opening');
 for(let i=0;i<8;i++)await Promise.resolve();f.owner.rules=[new DirectoryRuleDraft(7,'^卷','31')];f.owner.loaded=true;f.owner.busy=false;
 f.owner.initialRender();const fresh=f.level();fresh.onChange('3');assert.equal(f.owner.rules[0].level,'3','new physical actor uses current identity');
 f.retire();fresh.onChange('4');assert.equal(f.owner.rules[0].level,'3','actual Gateway rejects retired Runtime');
 const bad=source.replace('identity === this.actorIdentity()','true');assert.notEqual(bad,source);const negative=actual(bad),old=negative.level();negative.owner.presentationGeneration++;old.onChange('30');assert.equal(negative.owner.rules[0].level,'30','guard-removal control reproduces unsafe old physical input');
}
}

}
