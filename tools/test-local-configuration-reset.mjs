import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as settings from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import * as tts from '../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts';
import * as selection from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const require=createRequire(import.meta.url);
const ts=require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript');
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
async function fixture(){
 const stores=new Map(),app=new Map(),trace=[];let fail='',pendingGate,mode='list',barrierCalls=0;
 globalThis.AppStorage={get:k=>app.get(k),setOrCreate:(k,v)=>app.set(k,v)};
 function pref(name){if(!stores.has(name))stores.set(name,{memory:new Map(),disk:new Map()});const data=stores.get(name);
 return{get:async(k,d)=>data.memory.has(k)?data.memory.get(k):d,put:async(k,v)=>data.memory.set(k,v),delete:async k=>data.memory.delete(k),
 flush:async()=>{trace.push(name);if(pendingGate?.name===name){const g=pendingGate;pendingGate=undefined;await g.promise;}
 if(fail===name || (fail==='reset-clear' && name==='reader_configuration_reset_v1' && !data.memory.has('pending'))){fail='';throw Error('flush:'+name);}data.disk=new Map(data.memory);}};}
 const preferences={getPreferences:async(_context,name)=>pref(name)};
 const context={};let current;
 const original=appearance.setReaderAppearanceTheme({...appearance.createDefaultReaderAppearanceSnapshot(),fontSize:24},'warmNight','night');
 let appearanceDisk=copy(original);
 const appearanceStore=new ReaderAppearanceStore({load:async()=>copy(appearanceDisk),save:async x=>{trace.push('appearance');if(fail==='appearance'){fail='';throw Error('flush:appearance');}appearanceDisk=copy(x);}});
 const owner={getUIAbilityContext:()=>context,getAppearanceStore:()=>appearanceStore,request(){throw Error('reset must not issue Core commands');}};current=owner;
 const Runtime={ReaderRuntimeOwner:{current:()=>current}};
 const themeModule=compile('app/ReaderThemeHost.ts',{
 './ReaderRuntimeOwner':Runtime,'./ReaderWindowCoordinator':{ReaderWindowCoordinator:{updateAppChromeStyle(){}},ReaderWindowChromeStyle:class{}},
 '../features/reading/ReaderAppearanceStore':{ReaderAppearanceStore},'../features/reading/ReaderAppearanceState':appearance,
 '../features/common/ReaderThemeSelection':selection,'../features/common/ReaderThemeRegistry':registry,
 });
 const {ReaderThemeHost}=themeModule;await ReaderThemeHost.install(owner,'night');
 const settingModule=compile('features/settings/SettingsGateway.ts',{'@ohos.data.preferences':{default:preferences},'../../app/ReaderThemeHost':themeModule});
 const readingModule=compile('features/reading/ReaderSettingsGateway.ts',{'@ohos.data.preferences':{default:preferences},'../../app/ReaderRuntimeOwner':Runtime,'../../app/ReaderThemeHost':themeModule,'./ReaderSettingsState':settings});
 const ttsModule=compile('features/reading/ReaderTtsPreferencesGateway.ts',{'@ohos.data.preferences':{default:preferences},'../../app/ReaderRuntimeOwner':Runtime,'../../app/ReaderThemeHost':themeModule,'./ReaderTtsPreferencesState':tts});
 const credentials={saveBookshelfViewMode:async v=>{trace.push('mode');if(fail==='mode'){fail='';throw Error('flush:mode');}mode=v;}};
 const modules={'@ohos.data.preferences':{default:preferences},'../../app/ReaderRuntimeOwner':Runtime,'../../app/ReaderThemeHost':themeModule,'./SettingsGateway':settingModule,
 '../reading/ReaderSettingsGateway':readingModule,'../reading/ReaderSettingsState':settings,'../reading/ReaderTtsPreferencesGateway':ttsModule,'../reading/ReaderTtsPreferencesState':tts,
 '../sync/WebDavCredentialStore':{WebDavCredentialStore:{instance:credentials}}};
 let Reset=compile('features/settings/LocalConfigurationReset.ts',modules).LocalConfigurationReset;
 ReaderThemeHost.setRecoveryBarrier(async()=>{barrierCalls++;trace.push('sync-recovery');await Reset.recover(owner);});
 const appGateway=new settingModule.SettingsGateway(context);
 await appGateway.update({autoCheckUpdate:false,tapBottomScrollTop:false,reduceMotion:true,crashLog:false},true);
 await new readingModule.ReaderSettingsGateway(owner).update({...settings.createDefaultReaderSettingsSnapshot(),pageTransition:'none'},true);
 await new ttsModule.ReaderTtsPreferencesGateway(owner).update({...tts.createDefaultReaderTtsPreferencesSnapshot(),keepScreenOn:true},true);trace.length=0;
 return{owner,context,trace,stores,app,ReaderThemeHost,appGateway,settingModule,readingModule,ttsModule,
 reset:()=>Reset.request(owner),recover:()=>Reset.recover(owner),raceProbe:()=>{const probe=Reset.runShared(owner,false);const request=Reset.runShared(owner,true);return Promise.all([probe,request]);},restart:()=>{Reset=compile('features/settings/LocalConfigurationReset.ts',modules).LocalConfigurationReset;},
 fail:x=>{fail=x;},gate:name=>{const d=deferred();pendingGate={name,...d};return d;},ownerChanged:()=>{current={};},
 mode:()=>mode,appearance:()=>appearanceDisk,barriers:()=>barrierCalls,
 pending:()=>stores.get('reader_configuration_reset_v1')?.memory.get('pending')??'',
 assertDefaults:async()=>{assert.equal(mode,'cover');assert.deepEqual(await appGateway.load(),settingModule.createDefaultSettingsSnapshot());
 const snap=appearanceStore.current();assert.equal(snap.appThemeMode,'system');assert.equal(snap.activeTheme,'night');assert.equal(snap.dayTheme,'day');assert.equal(snap.nightTheme,'night');assert.equal(snap.fontSize,18);
 assert.equal((await new readingModule.ReaderSettingsGateway(owner).load()).pageTransition,'slide');assert.equal((await new ttsModule.ReaderTtsPreferencesGateway(owner).load()).keepScreenOn,false);},
 };
}
{
 const f=await fixture();assert.equal(await f.recover(),false);assert.equal(f.mode(),'list');
 const gate=f.gate('reader_settings_v1');const resetting=f.reset();assert.equal(f.reset(),resetting,'duplicate reset requests share one operation');await new Promise(r=>setImmediate(r));
 const laterTheme=f.ReaderThemeHost.selectApp('day');let laterDone=false;void laterTheme.then(()=>laterDone=true);
 await new Promise(r=>setImmediate(r));assert.equal(laterDone,false,'new user selection waits for durable reset');gate.resolve();await resetting;await laterTheme;
 assert.equal(f.mode(),'cover');assert.equal(f.appearance().appThemeMode,'day','later explicit theme wins after completed reset');assert.equal(f.pending(),'');
}
for(const failure of ['reader_configuration_reset_v1','reader_settings_v1','reader_reading_settings_v1','reader_tts_preferences_v1','mode','appearance']){
 const f=await fixture();f.fail(failure);await assert.rejects(f.reset(),/flush/);
 if(failure==='reader_configuration_reset_v1'){assert.equal(f.mode(),'list');assert.equal(f.appearance().fontSize,24);assert.equal(f.pending(),'');}
 else{assert.ok(f.pending());f.restart();assert.equal(await f.recover(),true);await f.assertDefaults();assert.equal(f.pending(),'');}
}
{
 const f=await fixture();const gate=f.gate('reader_settings_v1');const reset=f.reset();await new Promise(r=>setImmediate(r));f.ownerChanged();gate.resolve();
 await assert.rejects(reset,/OWNER_CHANGED/);assert.equal(f.mode(),'list');assert.ok(f.pending(),'old ability stops after current write, preserves retry intent');
}
{
 const f=await fixture();const other=new f.settingModule.SettingsGateway(f.context);const gate=f.gate('reader_settings_v1');
 const a=f.appGateway.update({autoCheckUpdate:true,tapBottomScrollTop:false,reduceMotion:false,crashLog:false},true);await new Promise(r=>setImmediate(r));
 let done=false;const b=other.update({autoCheckUpdate:false,tapBottomScrollTop:true,reduceMotion:true,crashLog:true},true).then(()=>done=true);
 await new Promise(r=>setImmediate(r));assert.equal(done,false,'separate settings instances serialize whole flush');gate.resolve();await Promise.all([a,b]);
 f.fail('reader_settings_v1');await assert.rejects(other.update(f.settingModule.createDefaultSettingsSnapshot(),true),/flush/);
 assert.equal((await f.appGateway.load()).reduceMotion,true,'failed preferences write restores acknowledged cache');
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
 await f.appGateway.update({autoCheckUpdate:false,tapBottomScrollTop:false,reduceMotion:true,crashLog:false},false,'autoCheckUpdate');
 const current=await f.appGateway.load();assert.equal(current.autoCheckUpdate,false);assert.equal(current.tapBottomScrollTop,true);assert.equal(current.reduceMotion,false);assert.equal(current.crashLog,true);
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
const Page=productionMotionMethods(new URL('features/settings/SettingsPage.ets',base),['requestRestoreDefaults','performRestoreDefaults']);
let dialog,calls=0;const page=Object.assign(new Page(),{mounted:true,resetRevision:0,resetInFlight:false,appThemeScheme:'day',getUIContext:()=>({showAlertDialog:d=>dialog=d}),onRestoreDefaults:async()=>{calls++;return true;}});
page.requestRestoreDefaults();dialog.primaryButton.action();assert.equal(calls,0);assert.match(dialog.message,/保留书籍、书源、进度、书签/);
dialog.secondaryButton.action();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(page.resetMessage,'已恢复界面与阅读设置');
page.requestRestoreDefaults();page.mounted=false;dialog.secondaryButton.action();await new Promise(r=>setImmediate(r));assert.equal(calls,1,'dismissed page cannot start reset from stale dialog');
console.log('PASS production configuration reset: confirmed scope, durable intent, six failure points, restart continuation, newer user intent ordering, owner replacement, shared queues, failed-cache rollback and stale-dialog guard. No Core data/credential mutation.');
