import assert from 'node:assert/strict';
import { READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {reduceReaderThemeSelection as reduce, effectiveAppScheme, encodeReaderThemeSelection, restoreReaderThemeSelection, migrateLegacyReaderThemeSelection} from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import { createDefaultReaderAppearanceSnapshot, normalizeReaderAppearanceSnapshot, setReaderAppearanceTheme, appearanceThemeSelection } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
for(const system of ['day','night'])for(const mode of ['system','day','night'])for(const theme of READER_THEME_DEFINITIONS){
 const base={appThemeMode:mode,readerThemeId:'paper',defaultDayReaderThemeId:'warm',defaultNightReaderThemeId:'greenNight'};
 const before=structuredClone(base);const selected=reduce(base,'reader',theme.id,system);
 assert.equal(selected.readerThemeId,theme.id);assert.equal(selected.appThemeMode,theme.scheme===effectiveAppScheme(base,system)?mode:theme.scheme);
 assert.deepEqual(base,before);
 for(const target of ['day','night','system']){
  const changed=reduce(selected,'app',target,system);
  assert.equal(changed.appThemeMode,target);assert.equal(changed.readerThemeId,(target==='system'?system:target)==='day'?'warm':'greenNight');
 }
 const systemChanged=reduce(selected,'system','',system==='day'?'night':'day');
 if(selected.appThemeMode!=='system')assert.deepEqual(systemChanged,selected);
 const defaulted=reduce(selected,'default','ignored',system);
 assert.equal(defaulted.readerThemeId,theme.id);assert.equal(defaulted[theme.scheme==='day'?'defaultDayReaderThemeId':'defaultNightReaderThemeId'],theme.id);
 const round=restoreReaderThemeSelection(encodeReaderThemeSelection(selected),system);
 assert.deepEqual(round.selection,selected);
}
const fresh=createDefaultReaderAppearanceSnapshot();assert.equal(fresh.version,4);assert.equal(fresh.activeTheme,'day');assert.equal(fresh.dayTheme,'day');assert.equal(fresh.nightTheme,'night');
const legacy=normalizeReaderAppearanceSnapshot({...fresh,version:3,activeTheme:'paperNight',dayTheme:'paper',nightTheme:'paperNight',fontSize:23});
assert.equal(legacy.activeTheme,'paperNight');assert.equal(legacy.dayTheme,'paper');assert.equal(legacy.appThemeMode,'night');assert.equal(legacy.fontSize,23);
const forged=encodeReaderThemeSelection(appearanceThemeSelection(fresh));forged.reader.scheme='night';assert.throws(()=>restoreReaderThemeSelection(forged,'day'),/SCHEME_MISMATCH/);
const unknown={version:1,appMode:'night',reader:{id:'deleted-theme',scheme:'night'},defaultDayReaderId:'paper',defaultNightReaderId:'greenNight'};
assert.equal(restoreReaderThemeSelection(unknown,'day').selection.readerThemeId,'greenNight');
for (const system of ['day', 'night']) {
 const old={appThemeMode:'system',readerThemeId:'paperNight',defaultDayReaderThemeId:'warm',defaultNightReaderThemeId:'greenNight'};
 assert.equal(migrateLegacyReaderThemeSelection(old,system,'day').backup.reader.scheme,'night','legacy known ID uses historical classification');
 assert.equal(restoreReaderThemeSelection(old,system).selection.readerThemeId,'paperNight');
 const deleted={...old,readerThemeId:'removed-do-not-infer-night-from-name'};
 assert.equal(migrateLegacyReaderThemeSelection(deleted,system,'day').backup.reader.scheme,system);
 assert.equal(migrateLegacyReaderThemeSelection({...deleted,appThemeMode:'night'},'day','day').backup.reader.scheme,'night');
 assert.equal(migrateLegacyReaderThemeSelection(deleted,undefined,'night').backup.reader.scheme,'night');
 assert.match(migrateLegacyReaderThemeSelection(deleted,undefined,'night').fallbackReason,/current:night/);
 assert.throws(()=>migrateLegacyReaderThemeSelection(deleted),/SCHEME_UNAVAILABLE/);
 assert.throws(()=>migrateLegacyReaderThemeSelection({...old,readerThemeId:''},system),/INVALID/);
 assert.equal(migrateLegacyReaderThemeSelection({...deleted,readerThemeId:'__proto__'},system).backup.reader.scheme,system);
 const encoded=encodeReaderThemeSelection(restoreReaderThemeSelection(deleted,system).selection);
 assert.deepEqual(Object.keys(encoded).sort(),['appMode','defaultDayReaderId','defaultNightReaderId','reader','version']);
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
const disk={value:fresh};let nextFailure=false;const pending=[];
const store=new ReaderAppearanceStore({load:async()=>disk.value,save:async snapshot=>{const d=deferred();pending.push({d,snapshot});await d.promise;disk.value=snapshot;}});
await store.load();const frames=[];store.subscribe(s=>frames.push(s));
const one=await store.change(s=>setReaderAppearanceTheme(s,'night','day'));void one.saved.catch(()=>{});
const two=await store.change(s=>setReaderAppearanceTheme(s,'greenNight','day'));void two.saved.catch(()=>{});
pending[0].d.reject(Error('old-write-failed'));await one.saved.catch(()=>{});await new Promise(r=>setImmediate(r));
assert.equal(store.current().activeTheme,'greenNight');assert.equal(store.current().appThemeMode,'night');
pending[1].d.resolve();await two.saved;
const three=await store.change(s=>setReaderAppearanceTheme(s,'warm','day'));void three.saved.catch(()=>{});await new Promise(r=>setImmediate(r));
pending[2].d.reject(Error('current-write-failed'));await three.saved.catch(()=>{});await new Promise(r=>setImmediate(r));
assert.equal(store.current().activeTheme,'greenNight');assert.equal(store.current().appThemeMode,'night');
assert.equal(pending[3].snapshot.activeTheme,'greenNight');pending[3].d.resolve();await store.flush();
assert.equal(store.hasUnsavedChanges(),false);assert.equal(disk.value.activeTheme,'greenNight');
for(const frame of frames)assert.equal(appearanceThemeSelection(frame).appThemeMode==='system'?'day':frame.appThemeMode,READER_THEME_DEFINITIONS.find(t=>t.id===frame.activeTheme).scheme);
console.log('PASS theme truth table, migrations, sync fallback, atomic publication, old failure isolation and current failure durable rollback');
const removedNight=normalizeReaderAppearanceSnapshot({...fresh,appThemeMode:'night',activeTheme:'deleted-night',nightTheme:'greenNight'});
assert.equal(removedNight.activeTheme,'greenNight');assert.equal(removedNight.appThemeMode,'night');
const removedDay=normalizeReaderAppearanceSnapshot({...fresh,appThemeMode:'day',activeTheme:'deleted-day',dayTheme:'warm'});
assert.equal(removedDay.activeTheme,'warm');assert.equal(removedDay.appThemeMode,'day');
console.log('PASS removed local theme falls back to matching configured day/night default');
