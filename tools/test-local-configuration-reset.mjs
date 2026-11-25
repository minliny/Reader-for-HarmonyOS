import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as appearance from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import * as settings from '../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';
import * as tts from '../entry/src/main/ets/features/reading/application/ReaderTtsPreferencesState.ts';
import * as selection from '../entry/src/main/ets/app/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as facts from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import * as capabilityPolicy from '../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts';
import * as placement from '../entry/src/main/ets/features/reading/ui/ReaderControlPlacement.ts';
import * as bookshelfMode from '../entry/src/main/ets/features/bookshelf/application/BookshelfViewMode.ts';
import { readerHostPreferencesName } from '../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
import { READER_FEEDBACK_EXTENDED_MS } from '../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
const require=createRequire(import.meta.url);
const ts=require(((resolveEtsLoaderRoot()) + '/node_modules/typescript'));
const base=new URL('../entry/src/main/ets/',import.meta.url);
const copy=x=>JSON.parse(JSON.stringify(x));
function compile(file,dependencies){
 const text=readFileSync(new URL(file,base),'utf8');
 const out=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',out)(id=>{if(!(id in dependencies))throw Error(`Missing ${file}: ${id}`);return dependencies[id];},module,module.exports);
 return module.exports;
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}

// A new install and pre-migration profiles use the same local preference owner.
const BookshelfModeStore=productionMotionMethods(new URL('features/sync/application/WebDavCredentialStore.ts',base),
 ['readOrMigrateViewMode','writeLocalViewMode'],{DEFAULT_BOOKSHELF_VIEW:bookshelfMode.DEFAULT_BOOKSHELF_VIEW,
  LOCAL_VIEW_MODE_KEY:'mode',LOCAL_MIGRATION_KEY:'version',LOCAL_CONFIG_VERSION:1});
for(const [local,legacy,expected] of [[undefined,undefined,'list'],[undefined,'cover','cover'],[undefined,'list','list'],['cover','list','cover']]){
 const values=new Map();
 if(local!==undefined){values.set('mode',local);values.set('version',1);}
 const preferences={has:async key=>values.has(key),get:async(key,fallback)=>values.get(key)??fallback,
  put:async(key,value)=>values.set(key,value),delete:async key=>values.delete(key),flush:async()=>{}};
 const store=Object.assign(new BookshelfModeStore(),{ensureLocalPreferences:async()=>preferences,
  load:async()=>legacy===undefined?null:{bookshelfViewMode:legacy}});
 assert.equal(await store.readOrMigrateViewMode(),expected);
 assert.equal(values.get('mode'),expected);
}

async function fixture(){
 const stores=new Map(),app=new Map(),trace=[];let fail='',pendingGate,mode='cover',barrierCalls=0;
 globalThis.AppStorage={get:k=>app.get(k),setOrCreate:(k,v)=>app.set(k,v)};
 function pref(name){if(!stores.has(name))stores.set(name,{memory:new Map(),disk:new Map()});const data=stores.get(name);
 return{get:async(k,d)=>data.memory.has(k)?data.memory.get(k):d,put:async(k,v)=>data.memory.set(k,v),delete:async k=>data.memory.delete(k),
 flush:async()=>{trace.push(name);if(pendingGate?.name===name){const g=pendingGate;pendingGate=undefined;await g.promise;}
 if(fail===name || (fail==='reset-clear' && name==='reader_configuration_reset_v1' && !data.memory.has('pending'))){fail='';throw Error('flush:'+name);}data.disk=new Map(data.memory);}};}
 const preferences={getPreferences:async(_context,name)=>pref(name)};
 const context={filesDir:'/config-reset-fixture'};let current;
 const original=appearance.setReaderAppearanceTheme({...appearance.createDefaultReaderAppearanceSnapshot(),fontSize:24},'warmNight','night');
 let appearanceDisk=copy(original);
 const appearanceStore=new ReaderAppearanceStore({load:async()=>copy(appearanceDisk),save:async x=>{trace.push('appearance');if(fail==='appearance'){fail='';throw Error('flush:appearance');}appearanceDisk=copy(x);}});
 const owner={waitForPredecessorClose:async()=>{},getUIAbilityContext:()=>context,getAppearanceStore:()=>appearanceStore,request(){throw Error('reset must not issue Core commands');}};current=owner;
 const Runtime={ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>current)};
 const themeModule=compile('app/ReaderThemeHost.ts',{
 './ReaderRuntimeOwner':Runtime,'./ReaderWindowCoordinator':{ReaderWindowCoordinator:{updateAppChromeStyle(){}},ReaderWindowChromeStyle:class{}},
 '../features/reading/application/ReaderAppearanceStore':{ReaderAppearanceStore},'../features/reading/application/ReaderAppearanceState':appearance,
 './ReaderThemeSelection':selection,'../ui/foundation/ReaderThemeRegistry':registry,
 });
 const {ReaderThemeHost}=themeModule;await ReaderThemeHost.install(owner,'night');
 const platform={'@ohos.data.preferences':{default:preferences},
  '../../../app/diagnostics/ReaderPublicFixtureScope':{readerHostPreferencesName},
  '../../../app/ReaderRuntimeOwner':Runtime,'../../../app/ReaderThemeHost':themeModule};
 const settingModule=compile('features/settings/application/SettingsGateway.ts',platform);
 const readingModule=compile('features/reading/application/ReaderSettingsGateway.ts',{...platform,'./ReaderSettingsState':settings});
 const ttsModule=compile('features/reading/application/ReaderTtsPreferencesGateway.ts',{...platform,'./ReaderTtsPreferencesState':tts});
 const credentials={bookshelfModeContextGeneration:()=>1,loadBookshelfViewMode:async()=>mode,
  currentBookshelfViewMode:()=>mode,
  saveBookshelfViewMode:async(v,_restore,evidence)=>{trace.push('mode');evidence?.dispatched();
   if(fail==='mode'){fail='';throw Error('flush:mode');}mode=v;evidence?.confirmed();}};
 const evidenceModule=compile('app/ReaderWriteEvidence.ts',{});
 const bookshelf=compile('features/bookshelf/application/BookshelfViewModeHost.ts',{
  ...platform,'../../sync/application/WebDavCredentialStore':{WebDavCredentialStore:{instance:credentials}},
  '../../../app/ReaderWriteEvidence':evidenceModule,'../../../app/ReaderOperationFacts':facts,
  '../../../app/ReaderPersistedReceiptProjection':compile('app/ReaderPersistedReceiptProjection.ts',{'./ReaderOperationFacts':facts}),
  '../../../app/ErrorMessage':{errorMessageOf:error=>error.message}, './BookshelfViewMode.ts':bookshelfMode});
 const navigationAppearance=compile('app/ReaderNavigationAppearancePreferences.ts',{
  ...platform,'./diagnostics/ReaderPublicFixtureScope':{readerHostPreferencesName},'./HarmonyCapabilityPolicy':capabilityPolicy});
 const controlPlacement=compile('app/ReaderControlPlacementPreferences.ts',{
  ...platform,'./diagnostics/ReaderPublicFixtureScope':{readerHostPreferencesName},'../features/reading/ui/ReaderControlPlacement':placement});
 const {ReaderNavigationAppearancePreferences:Appearance}=navigationAppearance;
 const {ReaderControlPlacementPreferences:Placement}=controlPlacement;
 Appearance.attach(context);
 await Appearance.save({override:'systemNative',reduceTransparency:true});
 await Placement.install(context,()=>Runtime.ReaderRuntimeOwner.isCurrent(owner));
 await Placement.select('right',()=>true);
 await bookshelf.BookshelfViewModeHost.instance.load(()=>true);
 app.set('readerBookshelfSelectedGroup','saved-group');
 app.set('readerBookshelfReadingFilter','reading');
 app.set('readerBookshelfSourceFilter','remote');
 app.set('readerBookshelfContentFilter','text');
 const modules={...platform,'../../../app/ReaderWriteEvidence':evidenceModule,'./SettingsGateway':settingModule,
 '../../reading/application/ReaderSettingsGateway':readingModule,'../../reading/application/ReaderSettingsState':settings,'../../reading/application/ReaderTtsPreferencesGateway':ttsModule,'../../reading/application/ReaderTtsPreferencesState':tts,
 '../../bookshelf/application/BookshelfViewModeHost':bookshelf,
 '../../../app/ReaderNavigationAppearancePreferences':navigationAppearance,'../../../app/ReaderControlPlacementPreferences':controlPlacement};
 let Reset=compile('features/settings/application/LocalConfigurationReset.ts',modules).LocalConfigurationReset;
 ReaderThemeHost.setRecoveryBarrier(async()=>{barrierCalls++;trace.push('sync-recovery');await Reset.recover(owner);});
 const appGateway=new settingModule.SettingsGateway(context);
 await appGateway.update({autoCheckUpdate:false,tapBottomScrollTop:false,reduceMotion:true,crashLog:false,developerMode:true,wideNavigationRail:true},true);
 assert.equal((await appGateway.load()).developerMode,true,'fixture starts with developer mode durably enabled');
 assert.equal(stores.get('reader_settings_v1').disk.get('developerMode'),true);
 await new readingModule.ReaderSettingsGateway(owner).update({...settings.createDefaultReaderSettingsSnapshot(),pageTransition:'none'},true);
 await new ttsModule.ReaderTtsPreferencesGateway(owner).update({...tts.createDefaultReaderTtsPreferencesSnapshot(),keepScreenOn:true},true);trace.length=0;
 return{owner,context,trace,stores,app,ReaderThemeHost,appGateway,settingModule,readingModule,ttsModule,
 reset:()=>Reset.request(owner),recover:()=>Reset.recover(owner),raceProbe:()=>{const probe=Reset.runShared(owner,false);const request=Reset.runShared(owner,true);return Promise.all([probe,request]);},restart:()=>{Reset=compile('features/settings/application/LocalConfigurationReset.ts',modules).LocalConfigurationReset;},
 fail:x=>{fail=x;},gate:name=>{const d=deferred();pendingGate={name,...d};return d;},ownerChanged:()=>{current={};},
 mode:()=>mode,appearance:()=>appearanceDisk,barriers:()=>barrierCalls,
 pending:()=>stores.get('reader_configuration_reset_v1')?.memory.get('pending')??'',
 assertDefaults:async()=>{assert.equal(mode,'list');assert.deepEqual(await appGateway.load(),settingModule.createDefaultSettingsSnapshot());
 assert.deepEqual(bookshelf.BookshelfViewModeHost.instance.current(),{canonical:'list'});
 assert.equal(app.get('readerBookshelfViewMode'),'list');
 assert.equal(app.get('readerBookshelfSelectedGroup'),'');
 for(const filter of ['Reading','Source','Content'])assert.equal(app.get('readerBookshelf'+filter+'Filter'),'all');
 const defaults={override:'unset',reduceTransparency:false};
 assert.deepEqual(JSON.parse(stores.get('reader_navigation_appearance_v1').disk.get('snapshot')),defaults);
 assert.deepEqual(app.get('readerNavigationAppearancePreferences'),defaults);
 assert.equal(app.get('readerNavigationAppearanceSavePending'),false);
 assert.equal(stores.get('reader_control_placement_v1').disk.get('alignment'),'center');
 assert.equal(app.get('readerControlAlignment'),'center');
 assert.equal(app.get('readerControlPlacementPendingGeneration'),0);
 assert.equal(stores.get('reader_settings_v1').disk.get('developerMode'),false,'reset durably disables developer boundaries');
 const snap=appearanceStore.current();assert.equal(snap.appThemeMode,'system');assert.equal(snap.activeTheme,'night');assert.equal(snap.dayTheme,'day');assert.equal(snap.nightTheme,'night');assert.equal(snap.fontSize,18);
 assert.equal((await new readingModule.ReaderSettingsGateway(owner).load()).pageTransition,'slide');assert.equal((await new ttsModule.ReaderTtsPreferencesGateway(owner).load()).keepScreenOn,false);},
 };
}
{
 const f=await fixture();assert.equal(await f.recover(),false);assert.equal(f.mode(),'cover');
 const gate=f.gate('reader_settings_v1');const resetting=f.reset();assert.equal(f.reset(),resetting,'duplicate reset requests share one operation');await new Promise(r=>setImmediate(r));
 const laterTheme=f.ReaderThemeHost.selectApp('day');let laterDone=false;void laterTheme.then(()=>laterDone=true);
 await new Promise(r=>setImmediate(r));assert.equal(laterDone,false,'new user selection waits for durable reset');gate.resolve();await resetting;await laterTheme;
 assert.equal(f.mode(),'list');assert.equal(f.appearance().appThemeMode,'day','later explicit theme wins after completed reset');assert.equal(f.pending(),'');
}
for(const failure of ['reader_configuration_reset_v1','reader_settings_v1','reader_reading_settings_v1','reader_tts_preferences_v1','mode','appearance',
 'reader_navigation_appearance_v1','reader_control_placement_v1']){
 const f=await fixture();f.fail(failure);await assert.rejects(f.reset(),/flush|CONTROL_PLACEMENT_RESET_UNCONFIRMED/);
 if(failure==='reader_configuration_reset_v1'){assert.equal(f.mode(),'cover');assert.equal(f.appearance().fontSize,24);assert.equal(f.pending(),'');}
 else{assert.ok(f.pending());f.restart();assert.equal(await f.recover(),true);await f.assertDefaults();assert.equal(f.pending(),'');}
}
{
 const f=await fixture();const gate=f.gate('reader_settings_v1');const reset=f.reset();await new Promise(r=>setImmediate(r));f.ownerChanged();gate.resolve();
 await assert.rejects(reset,/OWNER_CHANGED/);assert.equal(f.mode(),'cover');assert.ok(f.pending(),'old ability stops after current write, preserves retry intent');
}
{
 const f=await fixture();const other=new f.settingModule.SettingsGateway(f.context);const gate=f.gate('reader_settings_v1');
 const a=f.appGateway.update({autoCheckUpdate:true,tapBottomScrollTop:false,reduceMotion:false,crashLog:false,developerMode:false,wideNavigationRail:false},true);await new Promise(r=>setImmediate(r));
 let done=false;const b=other.update({autoCheckUpdate:false,tapBottomScrollTop:true,reduceMotion:true,crashLog:true,developerMode:true,wideNavigationRail:true},true).then(()=>done=true);
 await new Promise(r=>setImmediate(r));assert.equal(done,false,'separate settings instances serialize whole flush');gate.resolve();await Promise.all([a,b]);
 f.fail('reader_settings_v1');await assert.rejects(other.update(f.settingModule.createDefaultSettingsSnapshot(),true),/flush/);
 assert.equal((await f.appGateway.load()).reduceMotion,false,'failed preferences write retains accepted choice without old compensation');
 assert.equal(f.appGateway.writeFacts().pendingReconciliation,true,'cached load cannot settle unknown flush');
}
{
 const f=await fixture();assert.deepEqual(await f.raceProbe(),[false,true],'empty startup probe cannot swallow explicit reset');await f.assertDefaults();
}
{
 const f=await fixture();f.fail('reset-clear');await assert.rejects(f.reset(),/flush/);assert.ok(f.pending());
 f.restart();await f.recover();await f.assertDefaults();assert.equal(f.pending(),'');
}
{
 const f=await fixture();f.fail('mode');await assert.rejects(f.reset(),/flush/);
 await f.appGateway.update({autoCheckUpdate:false,tapBottomScrollTop:false,reduceMotion:true,crashLog:false,developerMode:true,wideNavigationRail:true},false,'autoCheckUpdate');
 const current=await f.appGateway.load();assert.equal(current.autoCheckUpdate,false);assert.equal(current.tapBottomScrollTop,true);assert.equal(current.reduceMotion,false);assert.equal(current.crashLog,true);assert.equal(current.developerMode,false,'post-reset unrelated change cannot revive stale developer mode');
}
// Application consumers observe coherent, confirmed settings across instances.
{
 const f=await fixture(),events=[];
 const unsubscribe=f.appGateway.subscribe(snapshot=>{events.push({...snapshot});snapshot.autoCheckUpdate=true;});
 const other=new f.settingModule.SettingsGateway(f.context);
 assert.equal((await other.load()).autoCheckUpdate,false,'subscriber cannot mutate the read result');
 f.fail('reader_settings_v1');
 await assert.rejects(other.update({...f.settingModule.createDefaultSettingsSnapshot(),autoCheckUpdate:true}),/flush/);
 assert.equal(events.length,1,'failed writes cannot enable background work');
 await other.update(f.settingModule.createDefaultSettingsSnapshot());
 assert.equal(events.at(-1).autoCheckUpdate,true);
 unsubscribe();await other.load();assert.equal(events.length,2,'unmounted consumers release their subscription');
}
// Real page confirmation and callback semantics; the native modal/pixels are not simulated.
const runtime={};
const Page=productionMotionMethods(new URL('features/settings/ui/SettingsPage.ets',base),
 ['requestRestoreDefaults','performRestoreDefaults','generalConfirmationCurrent','settingsNavigationCurrent','settingsInputIsCurrent',
  'chooseResetDialog','closeResetDialog','retireResetDialog','showFeedbackToast'],
 {ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>runtime),READER_FEEDBACK_EXTENDED_MS});
let calls=0,receipt=facts.projectCommitReadback('confirmed','succeeded');
const feedback=[];
const page=Object.assign(new Page(),{mounted:true,activeSection:'general',themeOwner:runtime,temporaryBackIdentity:'settings:1',
 developerPageId:'',resetRevision:0,resetSectionRevision:0,resetInFlight:false,appThemeScheme:'day',
 isOpeningCurrent:()=>true,appForeground:true,openSelect:'',resetDialogSerial:0,resetDialogTicket:0,
 restoreResetFocus(){},getUIContext:()=>({}),
 transientFeedback:{show(_context,value,current){if(current())feedback.push(value);}},
 onRestoreDefaults:async()=>{calls++;return receipt;}});
const choose=action=>{page.requestRestoreDefaults();page.chooseResetDialog(page.resetDialogTicket,page.temporaryBackIdentity,action);page.retireResetDialog();};
choose('cancel');assert.equal(calls,0);
choose('confirm');await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(page.resetMessage,'已恢复界面与阅读设置');
assert.equal(feedback.length,1);assert.equal(feedback[0].message,'已恢复界面与阅读设置');
receipt=facts.projectCommitReadback('confirmed','failed');
choose('confirm');await new Promise(r=>setImmediate(r));
assert.equal(calls,2);assert.equal(page.resetMessage,'');assert.equal(feedback.length,1,'confirmed write with failed readback stays on the owner recovery channel');
page.requestRestoreDefaults();page.mounted=false;page.chooseResetDialog(page.resetDialogTicket,page.temporaryBackIdentity,'confirm');
await new Promise(r=>setImmediate(r));assert.equal(calls,2,'dismissed page cannot start reset from stale dialog');
console.log('PASS configuration reset: eight write failure points, restart continuation, navigation and placement readback, shared bookshelf defaults and filters, and stale confirmation.');
