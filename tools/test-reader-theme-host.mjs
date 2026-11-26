import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as selection from '../entry/src/main/ets/app/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as appearance from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import {ReaderAppearanceStore} from '../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts';
const source=readFileSync(new URL('../entry/src/main/ets/app/ReaderThemeHost.ts',import.meta.url),'utf8');
const storage=new Map(),chrome=[];let currentOwner;
const deps={ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>currentOwner),...selection,...registry,...appearance,ReaderAppearanceStore,AppStorage:{setOrCreate:(k,v)=>storage.set(k,v)},
 ReaderWindowChromeStyle:class{constructor(...values){this.values=values}},ReaderWindowCoordinator:{updateAppChromeStyle:value=>chrome.push(value)}};
const body=stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,''));
const Host=new Function(...Object.keys(deps),body.replace('export class','class')+';return ReaderThemeHost;')(...Object.values(deps));
function owner(initial=appearance.createDefaultReaderAppearanceSnapshot()){
 const disk={value:initial};const store=new ReaderAppearanceStore({load:async()=>disk.value,save:async value=>{disk.value=value}});
 currentOwner={waitForPredecessorClose:async()=>{},getAppearanceStore:()=>store,store,disk};return currentOwner;
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
const first=owner();await Host.install(first,'day');
assert.equal(storage.get('readerAppScheme'),'day');assert.equal(storage.get('readerAppThemeMode'),'system');
assert.equal(chrome.at(-1).values[0],registry.readerAppColor('app.window.background','day'));
assert.equal(chrome.length,1,'startup publishes a single resolved selection');
// Same-scheme reader selection survives restart and retains follow-system.
await (await Host.selectReader('green',()=>true)).saved;
await Host.selectManga('day',()=>true);
assert.equal(Host.backup().reader.id,'green','selecting the already visible manga paper keeps the specific novel paper');
assert.equal(Host.backup().appMode,'system');
await (await Host.selectReaderDefault('green',()=>true)).saved;
await Host.selectManga('night',()=>true);
assert.equal(storage.get('readerAppScheme'),'night');
assert.equal(Host.backup().reader.id,'night');
await Host.selectManga('day',()=>true);
assert.equal(storage.get('readerAppScheme'),'day');
assert.equal(Host.backup().reader.id,'green','cross-scheme manga choice restores the saved matching novel paper');
await (await Host.selectReader('greenNight',()=>true)).saved;
assert.equal(storage.get('readerAppScheme'),'night','novel paper publishes to the same scheme observed by manga');
await Host.selectApp('system');
await Host.install(owner(first.disk.value),'day');assert.equal(Host.backup().reader.id,'green');assert.equal(Host.backup().appMode,'system');
await Host.systemChanged('night');assert.equal(Host.backup().reader.id,'night');assert.equal(Host.backup().appMode,'system');
const pending=deferred();Host.setRecoveryBarrier(()=>pending.promise);
const user=Host.selectApp('day');await Promise.resolve();assert.equal(Host.backup().reader.id,'night','new intent does not write ahead of old restore');
await Host.restore({version:1,appMode:'night',reader:{id:'greenNight',scheme:'night'},defaultDayReaderId:'warm',defaultNightReaderId:'greenNight'});
pending.resolve();await user;assert.equal(Host.backup().reader.id,'warm');assert.equal(Host.backup().appMode,'day','new user choice wins after the approved restore');
Host.setRecoveryBarrier(async()=>{throw Error('restore pending')});const before=Host.backup();
await assert.rejects(Host.selectApp('night'),/restore pending/);assert.deepEqual(Host.backup(),before);
const late=deferred();Host.setRecoveryBarrier(()=>late.promise);const stale=Host.selectApp('night');
const rejection=assert.rejects(stale,/OWNER_CHANGED/);await Host.install(owner(),'day');late.resolve();await rejection;
assert.equal(Host.backup().appMode,'system','old owner cannot modify new runtime theme');
Host.detach();
console.log('PASS production theme host: same-scheme restart, system linkage, app chrome, restore barrier failure/retry ordering and stale owner isolation');
