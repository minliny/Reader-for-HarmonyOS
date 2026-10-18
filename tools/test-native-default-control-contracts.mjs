import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import {approvedTypographyContract} from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { foundationControls, foundationSpecs } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readFileSync,readdirSync } from 'node:fs';
import { sharedProducerShape } from './lib/architecture-shared-producer-contract.mjs';
import { auditNativeTextElements } from './lib/reader-typography-consumer-audit.mjs';
import { verifyNativeDefaultBranches, nativeDefaultRecoveryBranchContract } from './lib/native-default-control-probe.mjs';
import { boundedSurfaceSdk,boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { DirectoryRuleDraft } from './lib/reader-reading-field-probe.mjs';
import {nativeDefaultHistoricalMethod,proveNativeDefaultLayout} from './lib/native-default-layout-successor.mjs';
import {createDefaultReaderWindowMetrics,readerInteractiveSafeLeft,readerInteractiveSafeRight,readerInteractiveSafeBottom} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {snapshotReaderDirectoryData,sameReaderDirectoryData} from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import {ReaderDirectoryNavigationGateway, readerDirectoryScopeKey, openReaderDirectoryNavigation,
 readerDirectoryNoteMissingNavigation, readerDirectoryToggleCollapsed} from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import {readerDirectoryObserveScrollIntent, readerDirectoryViewportAnchor, readerDirectorySignalScrollIntent} from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';
import {ReaderDirectoryTrace} from '../entry/src/main/ets/features/reading/ReaderDirectoryTrace.ts';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/design/native-default-control-contracts.json',import.meta.url)));
const producers=JSON.parse(readFileSync(new URL('./fixtures/architecture-shared-producers.json',import.meta.url)));
const featureRoot=new URL('../entry/src/main/ets/features/',import.meta.url),normalise=text=>(text??'').replace(/\s+/g,'');
const contracts=new Map(fixture.consumers.map(row=>[JSON.stringify([row.file,row.method,row.kind,normalise(row.argument)]),{...row,count:0}]));
assert.equal(contracts.size,13);
// A real Normal-options constructor owns no native text. Its Text children
// still require their own roles; a label overload or unknown options cannot
// disguise an unregistered native label.
const buttonOptionsProbe = auditNativeTextElements(`@Component struct ButtonOptionsProbe {
 build() {
  Button({ type: ButtonType.Normal }) { Text('child').fontSize(12); }
  Button('label', { type: ButtonType.Normal });
  Button({ label: 'hidden', type: ButtonType.Normal }) { Text('child').fontSize(12); }
 }
}`).filter(node=>node.kind==='Button');
assert.deepEqual(buttonOptionsProbe.map(node=>node.unlabelledNormalButton),[true,false,false]);
let controls=0,paint=0,a11y=0,delegated=0,inherited=0,approvedNative=0;
for(const file of readdirSync(featureRoot,{recursive:true}).filter(file=>file.endsWith('.ets'))){
 const rel='features/'+file,source=readFileSync(new URL(file,featureRoot),'utf8');
 const approved=approvedTypographyContract(source,rel);
 for(const node of auditNativeTextElements(source,rel)){
  if(Object.keys(node.modifiers).length)continue;
  if(node.kind==='Span'&&node.inheritsTextStyle){inherited++;continue;}
  // No visible glyph exists in a blank paint actor or unlabelled event host.
  if(node.kind==='Text'&&["''",'""'].includes(node.text)||node.kind==='Button'&&(node.text===undefined||node.unlabelledNormalButton)){paint++;continue;}
  if(node.kind==='Text'&&node.attributes.width==='1'&&node.attributes.height==='1'&&node.attributes.accessibilityRole==='AccessibilityRoleType.BUTTON'&&
    node.method==='accessibleControlActions'&&['reading/ReaderControlPanel.ets','reading/ReaderControlMotionStage.ets'].includes(file)){a11y++;continue;}
  if(node.kind==='Button'&&file==='common/ReaderDialogSurface.ets'&&node.method==='actionCell'&&node.attributes.attributeModifier==='this.actionModifier(action)'){
   assert.ok(source.includes('TYPE_DIALOG')||source.includes('this.spec()'),'actual shared Dialog family owns its labelled native child');delegated++;continue;
  }
  if(node.kind==='Text'&&file==='common/ReaderBoundedSurfaceHeader.ets'&&node.method==='titleText'&&node.text==='this.title'&&
    normalise(node.attributes.attributeModifier)==='newReaderBoundedTitleModifier(this.specId,this.appThemeScheme)'){
    const actual=producers.producers.find(p=>p.component==='ReaderBoundedSurfaceHeader');assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'actual finite modifier owns title roles and AUTO omissions');delegated++;continue;
  }
  if(node.kind==='Text'&&file==='common/ReaderLabeledIconAction.ets'&&node.method==='labelContents'&&node.text==='this.label'&&
    normalise(node.attributes.attributeModifier)==='newReaderLabeledIconLabelModifier(this.specId,this.isDanger,this.scheme)'){
    const actual=producers.producers.find(p=>p.component==='ReaderLabeledIconAction');assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'exact finite icon label modifier owns the native font tuple');
    assert.ok(source.includes('.onClick((): void => this.commit())'),'actual direct/wrapped native action host remains in the registered producer');
    delegated++;continue;
  }
  if(node.kind==='Text'&&file==='common/ReaderChoiceRow.ets'&&node.method==='normalRow'&&node.text==='this.label'&&
    normalise(node.attributes.attributeModifier)==='newReaderChoiceLabelModifier(this.specId,this.selected)'){
    const actual=producers.producers.find(p=>p.component==='ReaderChoiceRow');assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'exact finite choice modifier owns roles and native AUTO omissions');delegated++;continue;
  }
  if(node.kind==='Text'&&file==='common/ReaderButton.ets'&&node.method==='build'&&node.text==='this.label'&&
    ['newReaderButtonLabelModifier(this.specId,this.primary,this.scheme,this.searchFontScale())','newReaderButtonTextModifier(this.specId,this.primary,this.actionEnabled,this.layout,this.scheme,this.isBusy,this.availableWidth,this.searchFontScale())'].includes(normalise(node.attributes.attributeModifier))||
    ['TextInput','TextArea'].includes(node.kind)&&file==='common/ReaderFormField.ets'&&node.method==='build'&&['{text:this.text,placeholder:this.placeholder}','{text:this.text}','{text:this.text,placeholder:this.placeholder,controller:this.inputController}'].includes(normalise(node.text))&&
    normalise(node.attributes.attributeModifier)===(node.kind==='TextArea'?'newReaderFormAreaModifier(this.specId,this.scheme,this.fieldAccessibilityLabel)':'newReaderFormFieldModifier(this.specId,this.scheme,this.fieldAccessibilityLabel)')){
    const actual=producers.producers.find(p=>p.component===(node.kind==='Text'?'ReaderButton':'ReaderFormField'));assert.ok(actual);
    assert.deepEqual(sharedProducerShape(source,actual.file),actual.shape,'actual finite foundation modifier preserves public roles/AUTO');
    assert.ok(node.attributes[['TextInput','TextArea'].includes(node.kind)?'onChange':'onClick']||node.kind==='Text'&&normalise(node.attributes.attributeModifier)==='newReaderButtonLabelModifier(this.specId,this.primary,this.scheme,this.searchFontScale())', 'real event host or finite stacked label');
    delegated++;continue;
  }
  const contract=contracts.get(JSON.stringify([rel,nativeDefaultHistoricalMethod(source,rel,node),node.kind,normalise(node.text)]));
  if(!contract&&approved.hasNative?.(node)){approvedNative++;continue;}
  assert.ok(contract,`${rel}:${node.line}: a visible native-default element needs a bounded platform-default contract, not a fake TYPE modifier`);
  assert.equal(node.attributes.attributeModifier, undefined, `${contract.id}: do not add an empty modifier to fake a public migration`);
  assert.ok(++contract.count<=(contract.branchInstances?.length??1),`${contract.id}: prevent copied native default exceptions`);
  for(const[property,value]of Object.entries(contract.requiredAttributes))assert.equal(node.attributes[property],value,`${contract.id}: preserve actual native input geometry`);
  assert.ok(node.attributes[['TextInput','TextArea'].includes(node.kind)?'onChange':'onClick'] && node.attributes[['TextInput','TextArea'].includes(node.kind)?'onChange':'onClick'] !== 'undefined',`${contract.id}: actual action/draft callback remains wired`);controls++;
 }
}
// Historical origins remain registered. Only these three exact repeated
// shelf drafts now use a real shared producer with native typography AUTO.
const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
for(const row of contracts.values()){
 if(row.sharedReplacement&&row.id==='NATIVE-DEFAULT-09'){
  assert.equal(row.variant,'nativeDirectoryLevelInput');assert.equal(row.count,0,'old authored native directory level input removed');
  const replacement=row.sharedReplacement,source=readFileSync(new URL('../entry/src/main/ets/'+row.file,import.meta.url),'utf8'),tree=ts.createSourceFile(row.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.equal(tree.parseDiagnostics.length,0);assert.ok(tree.statements.some(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text===replacement.module&&n.importClause.namedBindings.elements.some(e=>e.name.text===replacement.component)));
  const declaration=tree.statements.find(ts.isStructDeclaration),method=declaration.members.find(n=>ts.isMethodDeclaration(n)&&n.name.text==='build');let matches=0;
  const visit=n=>{if((ts.isEtsComponentExpression(n)||ts.isCallExpression(n))&&n.expression.getText(tree)===replacement.component){const props=new Map(n.arguments[0].properties.map(p=>[p.name.text,p.initializer.getText(tree)]));if(props.get('specId')==="'directory-rule-level'"){assert.equal(props.get('text'),'rule.level');assert.equal(props.get('placeholder'),undefined);assert.equal(props.get('onTextChange'),"(value: string): void => { if (this.ownsActor(identity)) this.edit(rule.id, 'level', value); }",'original exact rule edit now has the shipping lexical opening/book admission');matches++;}}ts.forEachChild(n,visit);};visit(method);assert.equal(matches,1,'exact original rule input consumer');
  const spec=foundationSpecs().resolveReaderFormFieldSpec('directory-rule-level');assert.equal(spec.text,undefined);assert.equal(spec.numberInput,false);assert.equal(spec.width,64);assert.equal(spec.height,40);
  const shared=foundationControls(),child=new shared.field.Component(undefined,{specId:'directory-rule-level',text:'2',isEditable:true});child.aboutToAppear();child.initialRender();const native=shared.nodes(child).find(n=>n.type==='TextInput');assert.ok(native);for(const property of row.typographyOmissions)assert.equal(Object.hasOwn(native,property),false,'actual native level AUTO');assert.equal(native.width,64);assert.equal(native.height,40);assert.equal(native.nativeInputType,undefined);assert.deepEqual(native.create,{text:'2'});assert.equal(typeof native.onChange,'function');row.count=1;controls++;
 }else if(row.sharedReplacement){
  assert.equal(row.variant,'nativeShelfGroupInput');assert.equal(row.file,'features/bookshelf/BookshelfManagementPage.ets');assert.equal(row.count,0,'old private native structure really removed');
  const source=readFileSync(new URL('../entry/src/main/ets/'+row.file,import.meta.url),'utf8'),tree=ts.createSourceFile(row.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.equal(tree.parseDiagnostics.length,0);const declaration=tree.statements.find(n=>ts.isStructDeclaration(n)),method=declaration.members.find(n=>ts.isMethodDeclaration(n)&&n.name.text===row.method);
  let matches=0;const replacement=row.sharedReplacement;
  const imports=tree.statements.filter(ts.isImportDeclaration);assert.ok(imports.some(n=>n.moduleSpecifier.text===replacement.module&&n.importClause.namedBindings.elements.some(e=>e.name.text===replacement.component)),'real shared field import');
  const expected=row.id==='NATIVE-DEFAULT-02'?['this.snapshot.groupNameDraft',"'分组名'"]:row.id==='NATIVE-DEFAULT-03'?['this.snapshot.groupOrderDraft',"'顺序整数'"]:['this.snapshot.assignmentGroupDraft',"'分组名；留空清除'"];
  const walk=n=>{if((ts.isEtsComponentExpression(n)||ts.isCallExpression(n))&&n.expression.getText(tree)===replacement.component){const props=new Map(n.arguments[0].properties.map(p=>[p.name.text,p.initializer.getText(tree)]));if(props.get('text')===expected[0]){assert.equal(props.get('placeholder'),expected[1]);assert.equal(props.get('specId'),"'"+replacement.specId+"'");assert.equal(props.get('onTextChange'),replacement.callback);matches++;}}ts.forEachChild(n,walk);};walk(method);assert.equal(matches,1,'each original actual draft has exactly one bounded shared consumer');
  const spec=foundationSpecs().resolveReaderFormFieldSpec(replacement.specId);assert.equal(spec.text,undefined);assert.equal(spec.textRole,undefined);assert.equal(spec.surfaceRole,undefined);assert.equal(spec.placeholderRole,undefined);assert.equal(spec.radius,undefined);assert.equal(spec.allPadding,undefined);assert.equal(spec.horizontalPadding,undefined);assert.equal(spec.hasBorder,false);assert.equal(spec.height,44);assert.equal(spec.numberInput,row.id==='NATIVE-DEFAULT-03');
  const shared=foundationControls(),child=new shared.field.Component(undefined,{specId:replacement.specId,text:'实际草稿',placeholder:expected[1].slice(1,-1)});child.aboutToAppear();child.initialRender();const native=shared.nodes(child).find(n=>n.type==='TextInput');assert.ok(native);for(const property of row.typographyOmissions)assert.equal(Object.hasOwn(native,property),false,'actual native typography AUTO');assert.equal(native.height,44);assert.equal(native.width,'100%');assert.equal(native.nativeInputType,row.id==='NATIVE-DEFAULT-03'?'InputType.Number':undefined);assert.equal(typeof native.onChange,'function');
  row.count=1;controls++;
 }
 assert.equal(row.count,row.branchInstances?.length??1,`${row.id}: native owner/consumer still present; intentional replacement requires a new actual implementation proof`);
 if(row.branchInstances){
  const branchContract=nativeDefaultRecoveryBranchContract(row);
  const source=readFileSync(new URL('../entry/src/main/ets/'+row.file,import.meta.url),'utf8');
  assert.equal(verifyNativeDefaultBranches(source,row.file,branchContract),row.branchInstances.length);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace("Button('重试').onClick((): void => this.retryReading());","Button('重试').onClick((): void => this.retryReading()); Button('重试').onClick((): void => this.retryReading());"),row.file,branchContract),/copied native default actors/);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace('this.onRetryFailedSourceSwitch(scopeId)','this.onRetryFailedSourceSwitch(this.sourceSwitchScopeId)'),row.file,branchContract),/exact actual branch callback/);
  assert.throws(()=>verifyNativeDefaultBranches(source.replace('if (this.sourceSwitchFailureMessage.length > 0) {\n          ForEach','if (true) {\n          ForEach'),row.file,branchContract),/exact finite branch guard/);
  const unguardedFallback=source.replace('if (this.readerRecoveryView.visible && this.readerRecoveryView.canRetry)', 'if (false)');
  assert.notEqual(unguardedFallback,source);
  assert.throws(()=>verifyNativeDefaultBranches(unguardedFallback,row.file,branchContract),/exact finite branch guard|exact finite branch path/, 'native fallback cannot replace the explicit inline recovery CTA');
 }
}
// The one relocated native family is still mounted by the shipping directory
// layout. Compile the actual public frame, header, fallback, and native List;
// unrelated toolbar/rules payloads are explicit child seams. Native lazy-row
// scheduling and the compositor remain outside this SDK closure proof.
async function proveNativeDirectoryFallback(navigationSource) {
 const read=file=>readFileSync(new URL('../entry/src/main/ets/features/'+file,import.meta.url),'utf8');
 const source=read('bookshelf/BookDirectoryPage.ets');proveNativeDefaultLayout(source);
 for(const[before,after]of[
  ['header: (): void => { this.standardHeader(); }','header: (): void => {}'],
  ['this.standardToolbar();','this.standardToolbar(); this.standardToolbar();'],
  ['this.rulesExpanded = !this.rulesExpanded;','this.rulesExpanded = true;'],
 ]){const bad=source.replace(before,after);assert.notEqual(bad,source);assert.throws(()=>proveNativeDefaultLayout(bad),/actual native family|actual shared header|one actual retained|same original/);}
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
 const list=nodes().find(n=>n.type==='List');assert.ok(list,'actual navigation fallback mounts the shared native List');assert.equal(list.create.scroller,scroller);assert.equal(list.contentStartOffset,114);
 const count=nodes().filter(n=>n.type==='List').length;
 const header=nodes().find(n=>n.type==='Column'&&n.zIndex===10&&n.onAreaChange);assert.ok(header);assert.match(header.backgroundColor,/^#FF/,'actual fixed header paints the opaque scrolling mask');
 button.onClick();assert.equal(page.rulesExpanded,true,'the original physical native rules callback toggles the page state');
 header.onAreaChange({}, {height:'157vp'});sdk.properties.flush();
 assert.equal(list.contentStartOffset,162,'real public header measurement reaches the retained native List');
 assert.equal(nodes().filter(n=>n.type==='List').length,count,'header measurement preserves the original physical List actor');
 const navigation=sdk.walk(page).find(owner=>owner!==page&&owner.fallbackBuilder&&owner.chapterEntries);assert.ok(navigation);
 const retainedFlatList=()=>{
  assert.equal(nodes().filter(n=>n.type==='List').length,count,'temporary tree failure/retry retains exactly the mounted native flat List');
  assert.equal(nodes().find(n=>n.type==='List'),list,'temporary tree failure/retry retains the same physical List actor');
  assert.equal(list.create.scroller,scroller,'temporary tree failure/retry preserves the native Scroller identity');
  assert.equal(list.contentStartOffset,162,'temporary tree failure/retry preserves the measured header offset');
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
await proveNativeDirectoryFallback();
const retryableDirectorySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets',import.meta.url),'utf8');
const permanentlyFlatDirectory=retryableDirectorySource.replace("this.settledFlat = unavailableReason === 'unsupported';",'this.settledFlat = true;');
assert.notEqual(permanentlyFlatDirectory,retryableDirectorySource,'negative control reinstates the old permanent-flat unavailable behavior');
await assert.rejects(()=>proveNativeDirectoryFallback(permanentlyFlatDirectory),/temporary missing tree remains retryable/,
 'the actual SDK native fallback contract rejects the old permanent-flat directory error');
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
assert.equal(controls,14);assert.equal(a11y,4);// One additional finite ReaderButton leading-slot Text is now an actual shared
// glyph host; native-default families and all private budgets are unchanged.
assert.equal(delegated,14);
console.log(`PASS native-default contracts: ${contracts.size} finite native families / ${controls} actual actors (retry has exact exclusive source-switch/reading branches); ${paint} no-glyph actors, ${a11y} exact accessibility actors, ${delegated} actual bounded shared glyph hosts, ${inherited} inherited body spans, ${approvedNative} exact approved AUTO carriers; no physical font overrides fabricated`);
