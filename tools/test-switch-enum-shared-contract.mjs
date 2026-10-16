import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {switchControls,switchSpecs,toggleSource,segmentSource} from './lib/reader-switch-control-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {readerFoundationTokens} from './lib/reader-foundation-control-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {createDefaultReaderWindowMetrics} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const oldToggle=read('tools/fixtures/switch-family/ReaderToggle.before.ets'),oldSegment=read('tools/fixtures/switch-family/ReaderSegmentedControl.before.ets');
const specSource=read('entry/src/main/ets/features/common/ReaderSwitchSpecs.ets');
const geometry=n=>Object.fromEntries(['type','create','width','height','position','borderRadius','backgroundColor','responseRegion','padding','border','layoutWeight','fontFamily','fontWeight','fontSize','fontColor','maxLines','alignItems'].filter(k=>k in n).map(k=>[k,n[k]]));
let cases=0;
// Installed SDK emitted native nodes, current day/night colors and original
// physical tuple. Semantic attributes are intentional additions only.
for(const scheme of ['day','night'])for(const value of [false,true]){
 const p=switchControls(),o=p.mount(p.toggle,{inputIdentity:'current',appThemeScheme:scheme,value});
 const before=createReaderBuilderProbe(oldToggle,boundedMembers(oldToggle),p.dependencies,{...p.hooks,initialParams:{value,radius:999}}).owner;
 before.appThemeScheme=scheme;before.initialRender();
 assert.deepEqual(p.nodes(o).filter(n=>n.type!=='ForEach').map(geometry),p.nodes(before).map(geometry));
 assert.equal(p.nodes(o).find(n=>n.type==='Stack').accessibilityChecked,value);cases++;
}
for(const scheme of ['day','night'])for(const selectedIndex of [0,1,2]){
 const p=switchControls(),options=['跟随','浅色','深色'],o=p.mount(p.segment,{inputIdentity:'theme',appThemeScheme:scheme,options,optionIds:['system','day','night'],selectedIndex});
 const before=createReaderBuilderProbe(oldSegment,boundedMembers(oldSegment),{...p.dependencies,SEG_CONTAINER_W:168,SEG_CONTAINER_H:36,SEG_H:30,SEG_PAD:2},{...p.hooks,initialParams:{options,selectedIndex}}).owner;before.appThemeScheme=scheme;before.initialRender();
 assert.deepEqual(p.nodes(o).filter(n=>n.type!=='ForEach').map(geometry),p.nodes(before).filter(n=>n.type!=='ForEach').map(geometry));
 assert.equal(p.nodes(o).filter(n=>n.type==='Stack'&&n.accessibilitySelected).length,1);
 for(const n of p.nodes(o).filter(n=>n.type==='Text'))for(const method of ['lineHeight','letterSpacing'])assert.equal(o.attributeCalls.some(a=>a.id===n.id&&a.property===method),false,'original native AUTO call omission retained');cases++;
}
{
 const p=switchControls(),calls=[],o=p.mount(p.toggle,{inputIdentity:'A',value:false,onToggle:next=>calls.push(next)}),old=p.nodes(o).find(n=>n.onClick).onClick;
 old();assert.deepEqual(calls,[true]);assert.equal(o.value,false,'intent never changes controlled value');
 p.update(o,{value:true});old();assert.deepEqual(calls,[true,false],'same actor reads updated value');
 p.update(o,{value:false});assert.equal(p.nodes(o).find(n=>n.type==='Text').position.x,2,'false→true→false owner projection');
 p.update(o,{actionEnabled:false});old();assert.equal(calls.length,2);
 p.update(o,{actionEnabled:true,isBusy:true});old();assert.equal(calls.length,2);
 p.update(o,{isBusy:false,inputIdentity:'B'});old();assert.equal(calls.length,2,'old physical identity rejected');
 const fresh=p.nodes(o).filter(n=>n.onClick).at(-1);fresh.onClick();assert.equal(calls.length,3);
 o.aboutToDisappear();fresh.onClick();assert.equal(calls.length,3);cases++;
}
{
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
{
 // Shared existing press modifier; release/cancel equals exact original
 // normal endpoint. Disabled/busy never asks the platform for a pressed fill.
 const calls=[],ColorMetrics={resourceColor(c){calls.push(c);return{red:1,green:2,blue:3,blendColor(){return{color:'pressed'};}};},rgba(){return{};}};
 for(const enabled of [true,false]){
  const p=switchControls({ColorMetrics}),o=p.mount(p.toggle,{inputIdentity:'press:'+enabled,actionEnabled:enabled,value:true});
  const modifier=o.attributeCalls.find(a=>a.property==='attributeModifier').args[0],values={},native=new Proxy({}, {get(_t,k){return v=>{values[k]=v;return native;};}});
  modifier.applyNormalAttribute(native);const normal={...values},n=calls.length;modifier.applyPressedAttribute(native);
  assert.equal(values.backgroundColor,enabled?'pressed':normal.backgroundColor);assert.equal(values.borderRadius,enabled?12:999);
  if(!enabled)assert.equal(calls.length,n);
  modifier.applyNormalAttribute(native);assert.deepEqual(values,normal,'cancel/release restores surface and radius');cases++;
 }
}
// Resolve and compile real common spec modifications, not hand-written style
// stubs: Toggle change spreads, enum spec stays isolated and vice versa.
for(const variant of ['toggle','segment']){
 const source=specSource.replace(variant==='toggle'?'width: 44, height: 24':'width: 168, height: 36',variant==='toggle'?'width: 47, height: 24':'width: 171, height: 36'),p=switchControls({specs:switchSpecs(source)});
 const t=p.mount(p.toggle,{inputIdentity:'t'}),s=p.mount(p.segment,{inputIdentity:'s',options:['A'],optionIds:['a']});
 assert.equal(p.nodes(t).find(n=>n.type==='Stack').width,variant==='toggle'?47:44);
 assert.equal(p.nodes(s).find(n=>n.type==='Row').width,variant==='segment'?171:168);cases++;
}
assert.throws(()=>switchSpecs().resolveReaderToggleSpec('private99'),/Unknown/);assert.throws(()=>switchSpecs().resolveReaderSegmentSpec('private99'),/Unknown/);
// These negative source mutations execute the actual SDK closures. They make
// the corresponding guarded contract fail, proving the guards are observed.
for(const guard of ['identity === this.inputIdentity','this.actionEnabled','!this.isBusy','this.mounted']){
 const source=guard==='this.mounted'?toggleSource.replace('return this.mounted &&','return true &&'):toggleSource.replace(guard,'true'),p=switchControls({toggleDefinition:source}),calls=[],o=p.mount(p.toggle,{inputIdentity:'old',onToggle:next=>calls.push(next)}),click=p.nodes(o).find(n=>n.onClick).onClick;
 if(guard.startsWith('identity'))p.update(o,{inputIdentity:'new'});if(guard==='this.actionEnabled')p.update(o,{actionEnabled:false});if(guard==='!this.isBusy')p.update(o,{isBusy:true});if(guard==='this.mounted')o.aboutToDisappear();
 click();assert.equal(calls.length,1,'removed '+guard+' demonstrably admits illegal action');cases++;
}
const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();req(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('CategoryRow',new Set(['content']));
// Original production consumer methods and native shared controls execute in
// one installed SDK property runtime. No business owner algorithm is copied.
function consumer(file,members,params={},extra={}){
 const p=switchControls();Object.assign(p.dependencies,readerFoundationTokens);
 const category=read('entry/src/main/ets/features/settings/CategoryRow.ets');p.hooks.childSources.CategoryRow=category;p.dependencies.CategoryRow=createReaderBuilderProbe(category,boundedMembers(category),p.dependencies,p.hooks).Component;
 const o=p.consumer(read('entry/src/main/ets/features/'+file+'.ets'),members,extra,params);return{p,o};
}
{
 const calls=[],{p,o}=consumer('source/SourceManagementPage',['operation','sourceSwitch','sourceToggleBusy','sourceToggleEnabled'],{operation:{action:'load',sourceId:''}});
 Object.assign(o,{mounted:true,temporaryBackIdentity:'source-visit',onToggleSource:(id,next)=>calls.push([id,next])});o.sourceSwitch(false,next=>o.onToggleSource('source-A',next),'source-A');
 const actor=[...o.children.values()][0],click=p.nodes(actor).find(n=>n.onClick).onClick;click();assert.deepEqual(calls,[['source-A',true]]);
 p.update(actor,{value:true});click();assert.deepEqual(calls.at(-1),['source-A',false]);
 o.operation={action:'toggle',sourceId:'source-A',original:{blocked:true,busy:false}};o.replay();p.properties.flush();click();assert.equal(calls.length,2);cases++;
}
{
 const calls=[],Runtime={isCurrent:owner=>owner===Runtime},members=['snapshot','operation','appThemeScheme','autoCheckUpdateValue','tapBottomScrollTopValue','reduceMotionValue','crashLogValue','temporaryBackIdentity','onSnapshotChanged','syncSnapshotValues','switchRow','toggleSetting','settingValue','settingToggleBusy','settingCanToggle'];
 const {p,o}=consumer('settings/SettingsPage',members,{}, {ReaderRuntimeOwner:Runtime});Object.assign(o,{mounted:true,themeOwner:Runtime,resetInFlight:false,onToggle:(key,next)=>calls.push([key,next])});o.temporaryBackIdentity='visit-A';o.syncSnapshotValues();o.switchRow('减少动态效果',()=>({id:1}),'reduceMotion');
 const category=[...o.children.values()].find(c=>c instanceof p.dependencies.CategoryRow),actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle),click=p.nodes(actor).find(n=>n.onClick).onClick,rowClick=p.nodes(category).find(n=>n.type==='Row').onClick;
 click();assert.equal(o.reduceMotionValue,false,'page does not preflip an unaccepted value');assert.deepEqual(calls,[['reduceMotion',true]]);
 p.update(o,{snapshot:{autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:true,crashLog:true,developerMode:false}});assert.equal(o.reduceMotionValue,true);click();assert.deepEqual(calls.at(-1),['reduceMotion',false]);
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}}}});rowClick();click();assert.equal(calls.length,2,'row and toggle both respect real unknown');
 p.update(o,{operation:{action:'toggle',receipt:{receipt:{confirmation:'confirmed'},facts:{fact:'refreshing'}}}});rowClick();click();assert.equal(calls.length,2,'row and toggle both respect real pending');
 p.update(o,{operation:{action:'load'}});o.temporaryBackIdentity='visit-B';rowClick();click();assert.equal(calls.length,2,'old row opening never borrows a new control');o.mounted=false;rowClick();assert.equal(calls.length,2);cases++;
}
{
 const {p,o}=consumer('settings/RulesManagementPage',['snapshot','booleanField'],{snapshot:{busy:true,ruleMutation:{blocked:true},receipt:{receipt:{confirmation:'unknown'}}}},{EMPTY_RULES_MANAGEMENT_SNAPSHOT:{}});Object.assign(o,{replaceId:1,txtId:2,dictName:'词典',subId:3});let draft=false;
 o.booleanField('启用',draft,next=>draft=next);const actor=[...o.children.values()][0];p.nodes(actor).find(n=>n.onClick).onClick();assert.equal(draft,true,'local draft remains editable; pending write is not a draft mutation');cases++;
}
console.log('PASS '+cases+' F04 actual SDK baseline/native AUTO, controlled projections, stable option identities, disabled/pending/unmounted/old-physical negatives, existing press/cancel and finite-spec propagation; Source/Settings/Rules production consumers. Additional RSS and theme owner regressions remain separately exercised.');
{
 const calls=[],{p,o}=consumer('rss/RssSubscriptionManagementPage',['operation','presentationIdentity','expandedSubscriptionId','isExpanded','subscriptionItem','actionBar','actionTarget'],{operation:undefined,presentationIdentity:'rss-A'});
 Object.assign(o,{onToggle:(id,next)=>calls.push([id,next])});o.subscriptionItem({subscriptionId:'s',title:'订阅',feedUrl:'https://feed.test',enabled:false},0);
 const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderToggle),click=p.nodes(actor).find(n=>n.onClick).onClick;
 click();assert.deepEqual(calls,[['s',true]]);p.update(actor,{value:true});click();assert.deepEqual(calls.at(-1),['s',false],'actual item callback forwards current next value, not captured item enabled');
 p.update(o,{operation:{projection:{receipt:{confirmation:'unknown'},facts:{fact:'pendingReconciliation'}},original:{blocked:true,busy:false}}});click();assert.equal(calls.length,2,'immediate durable RSS write waits for exact receipt');
 p.update(o,{operation:undefined,presentationIdentity:'rss-B'});click();assert.equal(calls.length,2,'retained native actor old presentation rejected');cases++;
}
{
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
{
 const p=switchControls(),runtime={},calls=[];
 const o=p.consumer(read('entry/src/main/ets/features/settings/SettingsPage.ets'),['appThemeMode','temporaryBackIdentity','appThemeControl','themeIndex','selectAppTheme'],{SEG_OPTIONS:['跟随','浅色','深色'],ReaderRuntimeOwner:{isCurrent:owner=>owner===runtime},ReaderThemeHost:{selectApp:mode=>{calls.push(mode);return Promise.resolve();}}});
 Object.assign(o,{mounted:true,themeOwner:runtime,appThemeMode:'system'});o.temporaryBackIdentity='theme-A';o.appThemeControl();const actor=[...o.children.values()].find(c=>c instanceof p.dependencies.ReaderSegmentedControl),click=p.nodes(actor).filter(n=>n.type==='Stack').at(-1).onClick;
 click();assert.deepEqual(calls,['night']);assert.equal(actor.selectedIndex,0,'page waits for original ThemeHost accepted mode');
 o.appThemeMode='night';p.properties.flush();assert.equal(actor.selectedIndex,2,'accepted mode propagates into same native component');
 o.temporaryBackIdentity='theme-B';p.properties.flush();click();assert.equal(calls.length,1);o.mounted=false;click();assert.equal(calls.length,1);cases++;
}
console.log('PASS F04 full seven production declarations: '+cases+' total SDK groups, including actual RSS editor build, RSS management native row and Settings theme shared native surface.');
{
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
 console.log('PASS Root lazy shared switch resolver: actual native child, retained Prop update and old physical callback rejection.');
}
