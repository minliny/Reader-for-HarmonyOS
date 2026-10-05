import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {ReaderAppearanceStore} from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as selection from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
const file=name=>new URL('../entry/src/main/ets/'+name,import.meta.url);
const compile=(name,type,deps)=>new Function(...Object.keys(deps),stripTypeScriptTypes(readFileSync(file(name),'utf8')
 .replace(/^import[\s\S]*?;\n/gm,'')).replace('export class','class')+`;return ${type};`)(...Object.values(deps));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};};
const tick=()=>new Promise(done=>setImmediate(done));
function fixture(){
 let current;const storage=new Map(),events=[];
 const disk={cache:JSON.stringify(appearance.createDefaultReaderAppearanceSnapshot()),raw:'',failFlush:false};disk.raw=disk.cache;
 const Preferences=compile('app/ReaderAppearancePreferences.ts','ReaderAppearancePreferences',{...appearance,
  preferences:{async getPreferences(){return{get:async()=>disk.cache,put:async(_key,value)=>{events.push(['put',JSON.parse(value).activeTheme]);disk.cache=value;},
   flush:async()=>{disk.raw=disk.cache;if(disk.failFlush){disk.failFlush=false;throw Error('flush ACK lost');}}};}}});
 const authority=runtimeOwnerIdentityProbe(()=>current);
 const Owner=productionMotionMethods(file('app/ReaderRuntimeOwner.ts'),['getAppearanceStore','close','closeRuntime','waitForPredecessorClose'],
  {ReaderRuntimeOwner:authority,ReaderAppearanceStore,ReaderAppearancePreferences:Preferences,LOG_DOMAIN:0,
   ReadingBodyImageHost:{instance:{releaseAllDisplayFiles(){events.push(['release']);}}},hilog:{warn(){}}});
 const Host=compile('app/ReaderThemeHost.ts','ReaderThemeHost',{...appearance,...selection,...registry,ReaderAppearanceStore,ReaderRuntimeOwner:authority,
  AppStorage:{setOrCreate:(key,value)=>storage.set(key,value)},ReaderWindowChromeStyle:class{},ReaderWindowCoordinator:{updateAppChromeStyle(){}}});
 function owner(predecessorClose=Promise.resolve()){
  current=Object.assign(new Owner(),{state:'new',predecessorClose,preparationWakeTimer:-1,readingImageDiskCache:{close(){}},
   host:{getContext:()=>({})},ttsHost:{async close(){}},sourceSupplyTask:Promise.resolve(),importFinalizeTask:Promise.resolve(),flushTail:Promise.resolve()});return current;
 }
 return{Host,owner,disk,events,storage};
}
{
 const f=fixture(),old=f.owner();await f.Host.install(old,'day');f.disk.failFlush=true;
 const change=await old.getAppearanceStore().change(snapshot=>appearance.setReaderAppearanceTheme(snapshot,'warm','day'));
 await assert.rejects(change.saved,/ACK lost/);assert.equal(old.appearanceStore.hasUnsavedChanges(),true);
 const supply=deferred();old.sourceSupplyTask=supply.promise;const closing=old.close();
 const next=f.owner(closing),installed=f.Host.install(next,'day');f.Host.setRecoveryBarrier(()=>installed);
 const selecting=f.Host.selectApp('night');await tick();
 assert.equal(next.appearanceStore,undefined,'successor does not load or subscribe ahead of the old final flush');
 assert.deepEqual(f.events.filter(e=>e[0]==='put').map(e=>e[1]),['warm']);
 supply.resolve();await Promise.all([closing,installed,selecting]);
 assert.deepEqual(f.events.filter(e=>e[0]==='put').map(e=>e[1]),['warm','warm','night']);
 assert.equal(JSON.parse(f.disk.raw).activeTheme,'night');assert.equal(next.appearanceStore.current().activeTheme,'night');
 assert.equal(next.appearanceStore.hasUnsavedChanges(),false);assert.equal(f.storage.get('readerAppThemeMode'),'night');
 f.Host.detach();
}
{
 const f=fixture(),old=f.owner();await f.Host.install(old,'day');const close=deferred(),next=f.owner(close.promise);
 const installing=f.Host.install(next,'night');const failed=assert.rejects(installing,/native close unknown/);
 close.reject(Error('native close unknown'));await failed;assert.equal(next.appearanceStore,undefined,'failed platform close never admits successor preference IO');f.Host.detach();
}
{
 const f=fixture(),close=deferred(),stale=f.owner(close.promise);const installing=f.Host.install(stale,'day');
 const live=f.owner(close.promise),latest=f.Host.install(live,'night');close.resolve();await Promise.all([installing,latest]);
 assert.equal(stale.appearanceStore,undefined,'superseded installer cannot acquire or publish a store');
 assert.equal(f.storage.get('readerAppScheme'),'night');assert.equal(live.appearanceStore.current().activeTheme,'night');f.Host.detach();
}
console.log('PASS actual Preferences → AppearanceStore → Runtime.close → ThemeHost.install: lost ACK old final flush cannot overwrite successor, synchronous recovery barrier preserved, rejected predecessor blocks IO, superseded installer never publishes.');
