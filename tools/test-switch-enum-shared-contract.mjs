import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"toggle": {"description": "实际受控Toggle接纳、identity/disabled/busy/retired与四guard负例", "resources": []}, "segment": {"description": "实际enum稳定optionID重排/删除/重复及受控选择", "resources": []}, "press": {"description": "当前共享按压/取消恢复与禁用不请求pressed fill", "resources": []}, "spec-propagation": {"description": "当前有限spec宽度+3传播与另一族隔离/private拒绝", "resources": []}, "source": {"description": "SourceManagement当前Toggle控制与blocked原操作", "resources": []}, "settings": {"description": "Settings受控回执/unknown/pending/旧页面拒绝", "resources": []}, "rules": {"description": "Rules本地boolean草稿在未决保存期间可编辑", "resources": []}, "rss-management": {"description": "RSS当前立即写回执与旧presentation拒绝", "resources": []}, "rss-editor": {"description": "RSS实际build两个本地草稿Toggle与旧editor拒绝", "resources": []}, "theme": {"description": "Settings实际ThemeHost接受后shared enum更新", "resources": []}, "lazy-theme": {"description": "Root按需真实shared enum解析与保留child更新", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire} = await import('node:module');
const {switchControls,switchSpecs,toggleSource,segmentSource} = await import('./lib/reader-switch-control-probe.mjs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {boundedMembers} = await import('./lib/bounded-surface-sdk-probe.mjs');
const {readerFoundationTokens} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerAppColor} = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const {createDefaultReaderWindowMetrics} = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const specSource=read('entry/src/main/ets/features/common/ReaderSwitchSpecs.ets');
let cases=0;
if(selectedCase==='toggle'){
 const p=switchControls(),calls=[],o=p.mount(p.toggle,{inputIdentity:'A',value:false,onToggle:next=>calls.push(next)}),old=p.nodes(o).find(n=>n.onClick).onClick;
 old();assert.deepEqual(calls,[true]);assert.equal(o.value,false,'intent never changes controlled value');
 p.update(o,{value:true});old();assert.deepEqual(calls,[true,false],'same actor reads updated value');
 p.update(o,{value:false});assert.equal(p.nodes(o).find(n=>n.type==='Stack').accessibilityChecked,false,'controlled checked state follows owner');
 p.update(o,{actionEnabled:false});old();assert.equal(calls.length,2);
 p.update(o,{actionEnabled:true,isBusy:true});old();assert.equal(calls.length,2);
 p.update(o,{isBusy:false,inputIdentity:'B'});old();assert.equal(calls.length,2,'old physical identity rejected');
 const fresh=p.nodes(o).filter(n=>n.onClick).at(-1);fresh.onClick();assert.equal(calls.length,3);
 o.aboutToDisappear();fresh.onClick();assert.equal(calls.length,3);cases++;
}
if(selectedCase==='segment'){
 const p=switchControls(),calls=[],o=p.mount(p.segment,{inputIdentity:'A',options:['跟随','浅色','深色'],optionIds:['system','day','night'],selectedIndex:0,onSelect:i=>calls.push(i)});
 const night=p.nodes(o).filter(n=>n.type==='Stack').at(-1).onClick;night();assert.deepEqual(calls,[2]);assert.equal(o.selectedIndex,0);
 p.update(o,{selectedIndex:2});assert.equal(p.nodes(o).filter(n=>n.type==='Stack').at(-1).accessibilitySelected,true);
 p.update(o,{optionIds:['night','system','day'],options:['深色','跟随','浅色'],selectedIndex:0});night();assert.deepEqual(calls,[2,0],'stable ID follows current index after reorder');
 p.update(o,{actionEnabled:false});night();p.update(o,{actionEnabled:true,isBusy:true});night();assert.equal(calls.length,2);
 p.update(o,{isBusy:false,optionIds:['system','day'],options:['跟随','浅色']});night();assert.equal(calls.length,2,'removed option cannot borrow replacement index');
 p.update(o,{optionIds:['day','day']});p.nodes(o).find(n=>n.onClick).onClick();assert.equal(calls.length,2,'duplicate IDs fail admission');
 p.update(o,{optionIds:['system','day'],inputIdentity:'B'});night();assert.equal(calls.length,2);
 const fresh=p.nodes(o).filter(n=>n.type==='Stack'&&n.onClick).at(-1);fresh.onClick();assert.equal(calls.length,3);o.aboutToDisappear();fresh.onClick();assert.equal(calls.length,3);cases++;
}
if(selectedCase==='press'){
 // Shared existing press modifier; release/cancel equals exact original
 // normal endpoint. Disabled/busy never asks the platform for a pressed fill.
 const calls=[],ColorMetrics={resourceColor(c){calls.push(c);return{red:1,green:2,blue:3,blendColor(){return{color:'pressed'};}};},rgba(){return{};}};
 for(const enabled of [true,false]){
  const p=switchControls({ColorMetrics}),o=p.mount(p.toggle,{inputIdentity:'press:'+enabled,actionEnabled:enabled,value:true});
  const modifier=o.attributeCalls.find(a=>a.property==='attributeModifier').args[0],values={},native=new Proxy({}, {get(_t,k){return v=>{values[k]=v;return native;};}});
  modifier.applyNormalAttribute(native);const normal={...values},n=calls.length;modifier.applyPressedAttribute(native);
  assert.equal(values.backgroundColor,enabled?'pressed':normal.backgroundColor);
  if(!enabled)assert.equal(calls.length,n);
  modifier.applyNormalAttribute(native);assert.deepEqual(values,normal,'cancel/release restores surface and radius');cases++;
 }
}
if(selectedCase==='spec-propagation'){
 const baseline=switchSpecs();for(const variant of ['toggle','segment']){const resolve=variant==='toggle'?baseline.resolveReaderToggleSpec:baseline.resolveReaderSegmentSpec,normal=resolve(variant==='toggle'?'standard-toggle':'app-theme-segment');
 const expression=new RegExp('width: '+normal.width+'(?=, height:)');assert.ok(expression.test(specSource),'selected finite current spec width initializer');const changed=specSource.replace(expression,'width: '+(normal.width+3)),p=switchControls({specs:switchSpecs(changed)}),t=p.mount(p.toggle,{inputIdentity:'t'}),s=p.mount(p.segment,{inputIdentity:'s',options:['A'],optionIds:['a']});
 assert.equal(p.nodes(t).find(n=>n.type==='Stack').width,baseline.resolveReaderToggleSpec('standard-toggle').width+(variant==='toggle'?3:0));assert.equal(p.nodes(s).find(n=>n.type==='Row').width,baseline.resolveReaderSegmentSpec('app-theme-segment').width+(variant==='segment'?3:0));}
 assert.throws(()=>switchSpecs().resolveReaderToggleSpec('private99'),/Unknown/);assert.throws(()=>switchSpecs().resolveReaderSegmentSpec('private99'),/Unknown/);
}
if(selectedCase==='toggle')for(const guard of ['identity === this.inputIdentity','this.actionEnabled','!this.isBusy','this.mounted']){const source=guard==='this.mounted'?toggleSource.replace('return this.mounted &&','return true &&'):toggleSource.replace(guard,'true');assert.notEqual(source,toggleSource);const p=switchControls({toggleDefinition:source}),calls=[],o=p.mount(p.toggle,{inputIdentity:'old',onToggle:next=>calls.push(next)}),click=p.nodes(o).find(n=>n.onClick).onClick;if(guard.startsWith('identity'))p.update(o,{inputIdentity:'new'});if(guard==='this.actionEnabled')p.update(o,{actionEnabled:false});if(guard==='!this.isBusy')p.update(o,{isBusy:true});if(guard==='this.mounted')o.aboutToDisappear();click();assert.equal(calls.length,1,'removed '+guard+' admits illegal action');}
const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();if(['source','settings','rules','rss-management','rss-editor'].includes(selectedCase))req(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('CategoryRow',new Set(['content']));
// Original production consumer methods and native shared controls execute in
// one installed SDK property runtime. No business owner algorithm is copied.
function consumer(file,members,params={},extra={}){
 const p=switchControls();Object.assign(p.dependencies,readerFoundationTokens);
 const category=read('entry/src/main/ets/features/settings/CategoryRow.ets');p.hooks.childSources.CategoryRow=category;p.dependencies.CategoryRow=createReaderBuilderProbe(category,boundedMembers(category),p.dependencies,p.hooks).Component;
 const o=p.consumer(read('entry/src/main/ets/features/'+file+'.ets'),members,extra,params);return{p,o};
}
if(selectedCase==='source'){
 const calls=[],{p,o}=consumer('source/SourceManagementPage',['operation','sourceSwitch','sourceToggleBusy','sourceToggleEnabled'],{operation:{action:'load',sourceId:''}});
 Object.assign(o,{mounted:true,temporaryBackIdentity:'source-visit',onToggleSource:(id,next)=>calls.push([id,next])});o.sourceSwitch(false,next=>o.onToggleSource('source-A',next),'source-A');
 const actor=[...o.children.values()][0],click=p.nodes(actor).find(n=>n.onClick).onClick;click();assert.deepEqual(calls,[['source-A',true]]);
 p.update(actor,{value:true});click();assert.deepEqual(calls.at(-1),['source-A',false]);
 o.operation={action:'toggle',sourceId:'source-A',original:{blocked:true,busy:false}};o.replay();p.properties.flush();click();assert.equal(calls.length,2);cases++;
}
if(selectedCase==='settings'){
 const calls=[],Runtime={isCurrent:owner=>owner===Runtime},members=['snapshot','operation','appThemeScheme','autoCheckUpdateValue','tapBottomScrollTopValue','reduceMotionValue','crashLogValue','temporaryBackIdentity','onSnapshotChanged','syncSnapshotValues','switchRow','toggleSetting','settingValue','settingToggleBusy','settingCanToggle'];
 const {p,o}=consumer('settings/SettingsPage',members,{}, {ReaderRuntimeOwner:Runtime});Object.assign(o,{mounted:true,themeOwner:Runtime,resetInFlight:false,onToggle:(key,next)=>calls.push([key,next])});o.temporaryBackIdentity='visit-A';o.syncSnapshotValues();o.switchRow('减少动态效果',()=>({id:1}),'reduceMotion');
 const category=[...o.children.values()].find(c=>c instanceof p.dependencies.CategoryRow),actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle),click=p.nodes(actor).find(n=>n.onClick).onClick,rowClick=p.nodes(category).find(n=>n.type==='Row').onClick;
 click();assert.equal(o.reduceMotionValue,false,'page does not preflip an unaccepted value');assert.deepEqual(calls,[['reduceMotion',true]]);
 p.update(o,{snapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:true,crashLog:true,developerMode:false}});assert.equal(o.reduceMotionValue,true);click();assert.deepEqual(calls.at(-1),['reduceMotion',false]);
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}}}});rowClick();click();assert.equal(calls.length,2,'row and toggle both respect real unknown');
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'confirmed'},facts:{fact:'refreshing'}}}});rowClick();click();assert.equal(calls.length,2,'row and toggle both respect real pending');
 p.update(o,{operation:{action:'load'}});o.temporaryBackIdentity='visit-B';rowClick();click();assert.equal(calls.length,2,'old row opening never borrows a new control');o.mounted=false;rowClick();assert.equal(calls.length,2);cases++;
}
if(selectedCase==='rules'){
 const {p,o}=consumer('settings/RulesManagementPage',['snapshot','booleanField'],{snapshot:{busy:true,ruleMutation:{blocked:true},receipt:{receipt:{confirmation:'unknown'}}}},{EMPTY_RULES_MANAGEMENT_SNAPSHOT:{}});Object.assign(o,{replaceId:1,txtId:2,dictName:'词典',subId:3});let draft=false;
 o.booleanField('启用',draft,next=>draft=next);const actor=[...o.children.values()][0];p.nodes(actor).find(n=>n.onClick).onClick();assert.equal(draft,true,'local draft remains editable; pending write is not a draft mutation');cases++;
}

if(selectedCase==='rss-management'){
 const calls=[],{p,o}=consumer('rss/RssSubscriptionManagementPage',['operation','presentationIdentity','expandedSubscriptionId','isExpanded','subscriptionItem','actionBar','actionTarget'],{operation:undefined,presentationIdentity:'rss-A'});
 Object.assign(o,{onToggle:(id,next)=>calls.push([id,next])});o.subscriptionItem({subscriptionId:'s',title:'订阅',feedUrl:'https://feed.test',enabled:false},0);
 const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle),click=p.nodes(actor).find(n=>n.onClick).onClick;
 click();assert.deepEqual(calls,[['s',true]]);p.update(actor,{value:true});click();assert.deepEqual(calls.at(-1),['s',false],'actual item callback forwards current next value, not captured item enabled');
 p.update(o,{operation:{projection:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}},original:{blocked:true,busy:false}}});click();assert.equal(calls.length,2,'immediate durable RSS write waits for exact receipt');
 p.update(o,{operation:undefined,presentationIdentity:'rss-B'});click();assert.equal(calls.length,2,'retained native actor old presentation rejected');cases++;
}
if(selectedCase==='rss-editor'){
 const p=switchControls();Object.assign(p.dependencies,readerFoundationTokens);
 const t=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
 const editor=read('entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets'),ownerSource=read('entry/src/main/ets/features/rss/RssSubscriptionEditorOrchestrator.ets');
 const tree=t.createSourceFile(virtualFilePath('RssEditor.ets'),ownerSource,t.ScriptTarget.Latest,true,t.ScriptKind.ETS,options);
 const declaration=tree.statements.find(n=>t.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(tree)==='EMPTY_RSS_EDITOR_SNAPSHOT')).declarationList.declarations[0];
 const {projectOperationFacts}=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
 const {stripTypeScriptTypes}=await import('node:module');
 const empty=new Function('projectOperationFacts',stripTypeScriptTypes('const empty = '+declaration.initializer.getText(tree)+';')+'return empty;')(projectOperationFacts);
 const recovery=(await import('./lib/bounded-surface-sdk-probe.mjs')).boundedSurfaceSdk();
 for(const name of ['ReaderRecoveryNotice','ReaderRecoveryAction'])p.dependencies[name]=recovery.deps[name];
 const shared=read('entry/src/main/ets/features/rss/RssOriginalRecoverySurface.ets');p.hooks.childSources.RssOriginalRecoverySurface=shared;
 p.dependencies.RssOriginalRecoverySurface=createReaderBuilderProbe(shared,boundedMembers(shared),p.dependencies,p.hooks).Component;
 const back=read('entry/src/main/ets/features/common/PageBackBar.ets');p.hooks.childSources.PageBackBar=back;req(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
 Object.assign(p.dependencies,{ReaderWindowCoordinator:{metrics:createDefaultReaderWindowMetrics},readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0});
 p.dependencies.PageBackBar=createReaderBuilderProbe(back,boundedMembers(back),p.dependencies,p.hooks).Component;
 const o=p.consumer(editor,['snapshot','presentationIdentity','build','editorField','sectionTitle','saveAction','operationRecovery','recoveryActionIdentities','recoveryGeneration','dispatchRecovery'],{EMPTY_RSS_EDITOR_SNAPSHOT:empty,READER_FLOATING_TOP_BAR_HEIGHT:58}, {snapshot:empty,presentationIdentity:'editor-A'});
 const calls=[];Object.assign(o,{readerWindowMetricsRevision:0,contentFrame:()=>({left:16,right:16}),bottomContentInset:()=>24,onEnabledChanged:next=>calls.push(['enabled',next]),onEnabledCookieJarChanged:next=>calls.push(['cookie',next])});o.initialRender();
 const actors=[...o.children.values()].filter(c=>c instanceof p.dependencies.ReaderToggle);assert.equal(actors.length,2,'both original full build declarations mount real SDK shared Toggle');
 const physical=actors.map(a=>p.nodes(a).find(n=>n.onClick).onClick);physical.forEach(click=>click());assert.deepEqual(calls,[['enabled',!empty.enabled],['cookie',!empty.enabledCookieJar]]);
 p.update(o,{snapshot:{...empty,enabled:!empty.enabled,enabledCookieJar:!empty.enabledCookieJar,busy:true,canSave:false,operation:{receipt:{confirmation:'unknown'},facts:{canRetry:false}},original:undefined}});
 physical.forEach(click=>click());assert.deepEqual(calls.slice(-2),[['enabled',empty.enabled],['cookie',empty.enabledCookieJar]],'actual native drafts remain editable while original save unresolved');
 p.update(o,{presentationIdentity:'editor-B'});physical.forEach(click=>click());assert.equal(calls.length,4,'old physical editor action cannot borrow replacement presentation');
 actors.forEach(a=>a.aboutToDisappear());physical.forEach(click=>click());assert.equal(calls.length,4);cases+=2;
}
if(selectedCase==='theme'){
 const p=switchControls(),runtime={},calls=[];
 const o=p.consumer(read('entry/src/main/ets/features/settings/SettingsPage.ets'),['appThemeMode','temporaryBackIdentity','appThemeControl','themeIndex','selectAppTheme'],{SEG_OPTIONS:['跟随','浅色','深色'],ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime},ReaderThemeHost:{selectApp:mode=>{calls.push(mode);return Promise.resolve();}}});
 Object.assign(o,{mounted:true,themeOwner:runtime,appThemeMode:'system'});o.temporaryBackIdentity='theme-A';o.appThemeControl();const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderSegmentedControl),click=p.nodes(actor).filter(n=>n.type==='Stack').at(-1).onClick;
 click();assert.deepEqual(calls,['night']);assert.equal(actor.selectedIndex,0,'page waits for original ThemeHost accepted mode');
 o.appThemeMode='night';p.properties.flush();assert.equal(actor.selectedIndex,2,'accepted mode propagates into same native component');
 o.temporaryBackIdentity='theme-B';p.properties.flush();click();assert.equal(calls.length,1);o.mounted=false;click();assert.equal(calls.length,1);cases++;
}

if(selectedCase==='lazy-theme'){
 // Root's bounded lazy dependency resolver must mount the same real control
 // when a parent omits explicit common-child dependencies. Prop delivery is
 // exercised through its retained child, never a dummy capturing component.
 const runtime={},calls=[];
 const probe=createReaderBuilderProbe(read('entry/src/main/ets/features/settings/SettingsPage.ets'),['appThemeMode','temporaryBackIdentity','appThemeControl','themeIndex','selectAppTheme'],{
  SEG_OPTIONS:['跟随','浅色','深色'],ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime},
  ReaderThemeHost:{selectApp:mode=>{calls.push(mode);return Promise.resolve();}},
 });
 const o=probe.owner;Object.assign(o,{mounted:true,themeOwner:runtime,appThemeMode:'system'});o.temporaryBackIdentity='lazy-theme';o.appThemeControl();
 const actor=[...o.children.values()].find(c=>c.nodes&&[...c.nodes.values()].some(n=>n.type==='Stack'&&n.accessibilityRole==='AccessibilityRoleType.RADIO'));
 assert.ok(actor,'omitted dependency resolved to actual ReaderSegmentedControl native radio nodes');
 const night=[...actor.nodes.values()].filter(n=>n.type==='Stack').at(-1).onClick;night();assert.deepEqual(calls,['night']);
 o.appThemeMode='night';o.replay();assert.equal([...o.children.values()].includes(actor),true,'lazy real child remains retained');
 assert.equal([...actor.nodes.values()].filter(n=>n.type==='Stack').at(-1).accessibilitySelected,true,'Root hook flushes actual retained child Prop update');
 o.temporaryBackIdentity='lazy-retired';night();assert.equal(calls.length,1,'lazy child never bypasses original physical identity admission');
 
}

}
