import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as selection from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const sourceRoot=process.env.READER_PREDECESSOR_PROBE_ROOT===undefined?new URL('../',import.meta.url):
  pathToFileURL(`${resolve(process.env.READER_PREDECESSOR_PROBE_ROOT)}/`);
const file=name=>new URL(`entry/src/main/ets/${name}`,sourceRoot),read=name=>readFileSync(file(name),'utf8');
const themeSource=read('app/ReaderThemeHost.ts'),runtimeSource=read('app/ReaderRuntimeOwner.ts');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const tree=(text,name)=>ts.createSourceFile(`/tmp/${name}.ts`,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
const runtimeTree=tree(runtimeSource,'RuntimeThemeOperation'),runtime=runtimeTree.statements.find(node=>node.name?.getText(runtimeTree)==='ReaderRuntimeOwner');
const runtimeMethod=name=>{const method=runtime.members.find(node=>node.name?.getText(runtimeTree)===name);assert.ok(method,name);return method.getText(runtimeTree);};
const compile=(source,name,deps)=>new Function(...Object.keys(deps),stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,''))
  .replaceAll('export class','class')+`;return ${name};`)(...Object.values(deps));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(done=>setImmediate(done));};
const until=async predicate=>{for(let i=0;i<50;i++){if(predicate())return;await new Promise(done=>setImmediate(done));}assert.fail('real preference boundary did not arrive');};
function fixture(productionThemeSource=themeSource) {
  const events=[],storage=new Map(),initial=JSON.stringify(appearance.createDefaultReaderAppearanceSnapshot());
  const disk={cache:initial,raw:initial,loadGate:undefined,flushGate:undefined};
  const Store=compile(read('features/reading/ReaderAppearanceStore.ts'),'ReaderAppearanceStore',appearance);
  const Preferences=compile(read('app/ReaderAppearancePreferences.ts'),'ReaderAppearancePreferences',{...appearance,preferences:{
    async getPreferences(context){return{
      async get(){events.push(['get',context.id]);if(disk.loadGate){const gate=disk.loadGate;disk.loadGate=undefined;await gate.promise;}return disk.cache;},
      async put(_key,value){events.push(['put',context.id,JSON.parse(value).appThemeMode]);disk.cache=value;},
      async flush(){events.push(['flush']);if(disk.flushGate){const gate=disk.flushGate;disk.flushGate=undefined;await gate.promise;}disk.raw=disk.cache;}
    };}
  }});
  // Exact production identity/getStore methods. Ability ownership installation
  // and the previously tested close barrier are the controlled seams here;
  // the full ThemeHost, Store and Preferences code runs without rewriting.
  const Runtime=new Function('ReaderAppearanceStore','ReaderAppearancePreferences',stripTypeScriptTypes(`class ReaderRuntimeOwner {
    static instance; host; appearanceStore; ${runtimeMethod('isCurrent')} ${runtimeMethod('getAppearanceStore')}
  }`)+`;return ReaderRuntimeOwner;`)(Store,Preferences);
  const Host=compile(productionThemeSource,'ReaderThemeHost',{...appearance,...selection,...registry,ReaderAppearanceStore:Store,
    ReaderRuntimeOwner:Runtime,AppStorage:{setOrCreate:(key,value)=>storage.set(key,value)},
    ReaderWindowChromeStyle:class{},ReaderWindowCoordinator:{updateAppChromeStyle(){}}});
  function owner(id){const owner=Object.assign(new Runtime(),{host:{getContext:()=>({id})},waitForPredecessorClose:async()=>{}});Runtime.instance=owner;return owner;}
  return{Host,owner,disk,events,storage};
}
async function microtaskRetirement(productionSource=themeSource) {
  const f=fixture(productionSource),old=f.owner('old');await f.Host.install(old,'day');
  const selecting=f.Host.selectApp('night'),rejected=assert.rejects(selecting,/THEME_OWNER_CHANGED/,
    'retirement between real prepareUserChange final check and caller continuation belongs to the old generation');
  // The prepare await resumes first. This microtask then detaches before its
  // caller continuation. No wrapper or replacement prepare method is used.
  queueMicrotask(()=>f.Host.detach());await rejected;
  const next=f.owner('next');await f.Host.install(next,'day');
  assert.equal(f.events.filter(event=>event[0]==='put').length,0);assert.equal(next.getAppearanceStore().current().appThemeMode,'system');
  f.Host.detach();
}
async function deferredAdmission(operation,productionSource=themeSource) {
  const f=fixture(productionSource),gate=deferred(),old=f.owner('old');f.disk.loadGate=gate;
  const installing=f.Host.install(old,'day');await until(()=>f.events.some(event=>event[0]==='get'));
  const pending=operation==='select'?f.Host.selectApp('night'):f.Host.restore({version:1,appMode:'night',
    reader:{id:'greenNight',scheme:'night'},defaultDayReaderId:'warm',defaultNightReaderId:'greenNight'});
  const rejected=assert.rejects(pending,/THEME_OWNER_CHANGED/,'retired real Store load cannot admit an old theme operation');
  const observed=rejected.catch(()=>{});await settle();f.Host.detach();const next=f.owner('next'),latest=f.Host.install(next,'day');
  try{
    gate.resolve();await installing;await latest;await rejected;
    assert.equal(old.getAppearanceStore().current().appThemeMode,'system','retired intent was not accepted into the old store');
    assert.equal(next.getAppearanceStore().current().appThemeMode,'system','retired intent did not write into the successor');
    assert.equal(f.events.filter(event=>event[0]==='put').length,0,'the actual native Preferences received no retired setter');
  }finally{gate.resolve();await Promise.allSettled([installing,pending,latest,observed]);f.Host.detach();}
}
await microtaskRetirement();await deferredAdmission('select');await deferredAdmission('restore');
{
  const f=fixture(),owner=f.owner('active');await f.Host.install(owner,'day');await f.Host.selectApp('night');
  assert.equal(owner.getAppearanceStore().current().appThemeMode,'night');
  const reason=await f.Host.restore({version:1,appMode:'day',reader:{id:'warm',scheme:'day'},defaultDayReaderId:'warm',defaultNightReaderId:'greenNight'});
  assert.equal(reason,'');assert.equal(owner.getAppearanceStore().current().appThemeMode,'day');
  assert.equal(owner.getAppearanceStore().current().activeTheme,'warm');assert.equal(owner.getAppearanceStore().hasUnsavedChanges(),false);
  assert.equal(JSON.parse(f.disk.raw).activeTheme,'warm');f.Host.detach();
}
for(const operation of ['select','restore']) {
  const f=fixture(),old=f.owner('old'),gate=deferred();await f.Host.install(old,'day');f.disk.flushGate=gate;
  const accepted=operation==='select'?f.Host.selectApp('night'):f.Host.restore({version:1,appMode:'night',
    reader:{id:'greenNight',scheme:'night'},defaultDayReaderId:'warm',defaultNightReaderId:'greenNight'});
  await until(()=>f.events.some(event=>event[0]==='put'));f.Host.detach();const next=f.owner('next'),installing=f.Host.install(next,'day');
  gate.resolve();await accepted;await installing;
  assert.equal(old.getAppearanceStore().hasUnsavedChanges(),false,'retirement does not cancel an already accepted dispatched whole snapshot');
  assert.equal(next.getAppearanceStore().current().appThemeMode,'night');
  await f.Host.selectApp('day');assert.equal(JSON.parse(f.disk.raw).appThemeMode,'day','new intent follows actual old ACK in the same IO lane');f.Host.detach();
}
function replaceMethod(source,name,replacement) {
  const parsed=tree(source,'ThemeOperationMutation'),declaration=parsed.statements.find(node=>node.name?.getText(parsed)==='ReaderThemeHost'),
    method=declaration.members.find(node=>node.name?.getText(parsed)===name);assert.ok(method,name);
  return source.slice(0,method.getStart(parsed))+replacement+source.slice(method.end);
}
const oldSelect=replaceMethod(themeSource,'selectApp',`static async selectApp(mode: ReaderAppThemeMode): Promise<void> {
  await ReaderThemeHost.prepareUserChange();const store=ReaderThemeHost.store;if(store===undefined)throw new Error('THEME_NOT_READY');
  const commit=await store.change((current:ReaderAppearanceSnapshot):ReaderAppearanceSnapshot=>
    changeAppearanceThemeSelection(current,'app',mode,ReaderThemeHost.systemScheme));await commit?.saved;
}`);
await assert.rejects(microtaskRetirement(oldSelect),error=>error instanceof assert.AssertionError&&error.actual?.message==='THEME_NOT_READY',
  'old exact prepare/caller gap is a microtask negative control');
await assert.rejects(deferredAdmission('select',oldSelect),/Missing expected rejection/,'old exact unguarded select admits a retired load');
const oldRestore=replaceMethod(themeSource,'restore',`static async restore(backup:ReaderThemeSelectionBackup):Promise<string> {
  const store=ReaderThemeHost.store;if(store===undefined)throw new Error('THEME_NOT_READY');
  const restored=restoreReaderThemeSelection(backup,ReaderThemeHost.systemScheme);
  const commit=await store.change((current:ReaderAppearanceSnapshot):ReaderAppearanceSnapshot=>applyAppearanceThemeSelection(current,restored.selection));
  await commit?.saved;return restored.fallbackReason;
}`);
await assert.rejects(deferredAdmission('restore',oldRestore),/Missing expected rejection/,'old exact unguarded restore admits a retired load');
console.log('PASS actual ThemeHost → AppearanceStore → Preferences: real prepare/caller microtask retirement, deferred native load select/restore admission, explicit undefined-commit rejection, active operation and admitted durable completion, exact old-method negative controls; owner install/close barrier has separate real Runtime tests.');
