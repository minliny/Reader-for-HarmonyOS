import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as selection from '../entry/src/main/ets/features/common/ReaderThemeSelection.ts';
import * as registry from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const file=name=>new URL('../entry/src/main/ets/'+name,import.meta.url),source=name=>readFileSync(file(name),'utf8');
const compile=(name,className,deps)=>new Function(...Object.keys(deps),stripTypeScriptTypes(source(name).replace(/^import[\s\S]*?;\n/gm,'')).replace('export class','class')+`;return ${className};`)(...Object.values(deps));
const tick=()=>new Promise(done=>setImmediate(done));
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('theme change did not settle');}
function platform(){
 const initial=appearance.createDefaultReaderAppearanceSnapshot(),disk={raw:JSON.stringify(initial),cache:JSON.stringify(initial),events:[],fault:''},storage=new Map();
 const Preferences=compile('app/ReaderAppearancePreferences.ts','ReaderAppearancePreferences',{...appearance,preferences:{async getPreferences(){return{
  get:async()=>disk.cache,put:async(_key,value)=>{disk.events.push(['put',JSON.parse(value).appThemeMode]);
   if(disk.fault==='put-before'){disk.fault='';throw Error('put ACK lost');}disk.cache=value;
   if(disk.fault==='put-after'){disk.fault='';throw Error('put ACK lost');}},
  flush:async()=>{disk.events.push(['flush']);if(disk.fault==='flush-before'){disk.fault='';throw Error('flush ACK lost');}disk.raw=disk.cache;
   if(disk.fault==='flush-after'){disk.fault='';throw Error('flush ACK lost');}}
 };}}});
 const Host=compile('app/ReaderThemeHost.ts','ReaderThemeHost',{...appearance,...selection,...registry,ReaderAppearanceStore,
  AppStorage:{setOrCreate:(key,value)=>storage.set(key,value)},ReaderWindowChromeStyle:class{},ReaderWindowCoordinator:{updateAppChromeStyle(){}}});
 const owner=()=>{const store=new ReaderAppearanceStore(new Preferences({}));return{getAppearanceStore:()=>store,store};};
 return{disk,Host,storage,owner};
}
const sdkRequire=createRequire(import.meta.url),sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
for(const item of source('features/settings/SettingsPage.ets').matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))sdkRequire(sdkRoot+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add(item[1]);
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
function page(f,runtime,identity='settings-back:first'){
 const notices=[],authority={current:()=>runtime,isCurrent:owner=>owner===runtime};
 const Methods=productionMotionMethods(file('features/settings/SettingsPage.ets'),['selectAppTheme','themeIndex'],{ReaderRuntimeOwner:authority,ReaderThemeHost:f.Host,SEG_OPTIONS:['跟随','浅色','深色']});
 const methods=Object.assign(new Methods(),{mounted:true,themeOwner:runtime,temporaryBackIdentity:identity,
  getUIContext:()=>({getPromptAction:()=>({showToast:options=>notices.push(options.message)})})});
 const result=createReaderBuilderProbe(source('features/settings/SettingsPage.ets'),['segmentRow','appThemeControl'],{ReaderSegmentedControl:Child,SEG_OPTIONS:['跟随','浅色','深色'],TOK_SPACE_SM:12,TOK_BORDER_W:1,SELECT_ROW_H:58},
  {childSources:{ReaderSegmentedControl:source('features/common/ReaderSegmentedControl.ets')}});
 Object.assign(result.owner,methods,{labelColumn(){},themeIndex:()=>methods.themeIndex(),selectAppTheme:(...args)=>methods.selectAppTheme(...args),appThemeScheme:'day',temporaryBackIdentity:identity});
 const render=()=>{methods.appThemeMode=f.storage.get('readerAppThemeMode');result.owner.segmentRow('App主题',()=>({}));return [...result.owner.children.values()].at(-1).params;};
 return{methods,notices,render,setRuntime:value=>{authority.isCurrent=owner=>owner===value;},setIdentity:value=>{methods.temporaryBackIdentity=value;result.owner.temporaryBackIdentity=value;}};
}
for(const fault of ['put-before','put-after','flush-before','flush-after']){
 const f=platform(),owner=f.owner();await f.Host.install(owner,'day');f.disk.events.length=0;f.disk.fault=fault;
 const consumer=page(f,owner),control=consumer.render();control.onSelect(2);await until(()=>consumer.notices.length===1);
 assert.equal(consumer.notices[0],'主题保存尚未确认，当前选择已保留，请稍后重试');assert.equal(owner.store.current().appThemeMode,'night');
 assert.equal(owner.store.hasUnsavedChanges(),true);assert.equal(f.storage.get('readerAppThemeMode'),'night');
 assert.deepEqual(f.disk.events.filter(event=>event[0]==='put').map(event=>event[1]),['night'],'no old-theme compensation');
 assert.equal(consumer.render().selectedIndex,2,'real SDK Settings control consumes accepted theme after lost ACK');
 if(fault==='flush-after')assert.equal(JSON.parse(f.disk.raw).appThemeMode,'night');f.Host.detach();
}
{
 const f=platform(),old=f.owner();await f.Host.install(old,'day');const consumer=page(f,old),oldPhysical=consumer.render().onSelect;
 consumer.setIdentity('settings-back:reopened');oldPhysical(2);await tick();assert.equal(old.store.current().appThemeMode,'system');
 const newOwner=f.owner();await f.Host.install(newOwner,'day');consumer.setRuntime(newOwner);
 oldPhysical(2);consumer.render().onSelect(2);await tick();assert.equal(newOwner.store.current().appThemeMode,'system');assert.equal(consumer.notices.length,0);
 assert.equal(f.disk.events.filter(event=>event[0]==='put').length,0,'old page or old native callback cannot write successor owner');f.Host.detach();
}
{
 const f=platform(),owner=f.owner();await f.Host.install(owner,'day');const consumer=page(f,owner);f.disk.fault='put-after';
 consumer.render().onSelect(2);consumer.methods.mounted=false;await tick();await tick();assert.equal(consumer.notices.length,0,'retired page does not show delayed fault toast');
 assert.equal(owner.store.current().appThemeMode,'night');assert.equal(owner.store.hasUnsavedChanges(),true);f.Host.detach();
}
console.log('PASS actual SDK Settings segmented consumer → ThemeHost → AppearanceStore → native Preferences: four lost-ACK stages preserve selected theme, truthful visible notice, no compensation, reopened/retired/Runtime-replaced physical callback isolation.');
