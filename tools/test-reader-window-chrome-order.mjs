import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, registerHooks} from 'node:module';
import {ReaderBrightnessWriter} from '../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
import * as metrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {READER_THEME_DEFINITIONS, readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerAppearanceThemeStyle, readerAppearanceChromeTone} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const require=createRequire(import.meta.url);
const ts=require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript');
const base=new URL('../entry/src/main/ets/',import.meta.url);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<8;i++)await tick();}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const app=new Map();globalThis.AppStorage={setOrCreate:(k,v)=>app.set(k,v)};
 const displayInfo={id:0,rotation:0,densityPixels:1,scaledDensity:1};
 const kit={window:{Orientation:{UNSPECIFIED:0,PORTRAIT:1,LANDSCAPE:2,AUTO_ROTATION_UNSPECIFIED:3},
   AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
   display:{getDefaultDisplaySync:()=>displayInfo,on(){},off(){}}};
 const deps={'@kit.ArkUI':kit,'./ReaderBrightnessWriter':{ReaderBrightnessWriter},'./ReaderStatusBarMeasurement':{ReaderStatusBarMeasurement},
   '../features/common/ReaderWindowMetrics':metrics};
 const source=readFileSync(new URL('app/ReaderWindowCoordinator.ts',base),'utf8');
 const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',out)(id=>{assert.ok(id in deps,id);return deps[id];},module,module.exports);
 const {ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P}=module.exports;
 const E=productionMotionMethods(new URL('features/reading/LocalReadingExperience.ets',base),
   ['applyWindowChrome','commitReaderWindowSettings','applyReaderWindowPolicy','windowPolicyFor'],{
   ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P,readerAppearanceThemeStyle,readerAppearanceChromeTone});
 function windowPort(){
   const zero={left:0,top:0,width:0,height:0};
   const win={calls:[],properties:{},barEnabled:{status:true,navigation:true,navigationIndicator:true},nextColor:undefined,
     avoidTop:undefined,nextStatus:undefined,rect:{left:0,top:0,width:390,height:844},events:new Map(),
     getPreferredOrientation:()=>0,getWindowProperties:()=>({isKeepScreenOn:false,brightness:-1,windowRect:win.rect}),
     getWindowAvoidArea:type=>({topRect:type===0?(win.avoidTop??(win.barEnabled.status?{left:0,top:0,width:390,height:48}:zero)):zero,
       bottomRect:zero,leftRect:zero,rightRect:zero}),on(n,fn){win.events.set(n,fn);},off(n){win.events.delete(n);},
     setWindowLayoutFullScreen:async()=>{},setWindowSystemBarEnable:async()=>{},setPreferredOrientation:async()=>{},setWindowKeepScreenOn:async()=>{},
     async setSpecificSystemBarEnabled(bar,enabled){win.calls.push(['visible',bar,enabled]);
       if(bar==='status'){const gate=win.nextStatus;win.nextStatus=undefined;if(gate)await gate.promise;}
       win.barEnabled[bar]=enabled;},
     async setWindowSystemBarProperties(props){win.calls.push(['color',{...props}]);const pending=win.nextColor;win.nextColor=undefined;
       if(pending)await pending.promise;win.properties={...win.properties,...props};},
   };return win;
 }
 function theme(id,overlay=true){const e=Object.assign(new E(),{windowChromeActive:true,windowChromeOverlayActive:overlay,appearanceSnapshot:{activeTheme:id}});e.applyWindowChrome();}
 const colors=w=>w.calls.filter(x=>x[0]==='color');
 return{C,S,P,E,windowPort,theme,colors,displayInfo};
}
const cases=[];
async function check(name,run){try{await run();cases.push({name,status:'PASS'});}catch(e){cases.push({name,status:'FAIL',error:e.stack});}}
await check('eight real reading palettes survive hide/show and same/cross-scheme changes through actual Coordinator',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 for(const t of READER_THEME_DEFINITIONS){
   const scheme=t.scheme;f.C.updateAppChromeStyle(new f.S(readerAppColor('app.window.background',scheme),scheme==='night'?'light':'dark',readerAppColor('app.window.foreground',scheme)));
   f.theme(t.id,false);await settle();
   await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
   f.theme(t.id,true);await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,true));await settle();
   assert.equal(w.barEnabled.status,true);assert.equal(w.properties.statusBarColor,t.statusBackground,t.id);
   assert.equal(w.properties.statusBarContentColor,t.statusForeground,t.id);
   const count=f.colors(w).length;f.theme(t.id,true);await settle();assert.equal(f.colors(w).length,count,'settled same theme is deduplicated');
 }
 f.C.requestAppChrome();await settle();assert.equal(w.properties.statusBarColor,readerAppColor('app.window.background','night'));f.C.detach();
});
await check('new theme is drained after the previous native color write rejects',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const gate=deferred();w.nextColor=gate;f.theme('warm');await tick();f.theme('green');gate.reject(Error('1300003 simulated old request failure'));await settle();
 assert.equal(w.properties.statusBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='green').paperStart,'newest theme must not be lost with old failure');f.C.detach();
});
for(const failed of [false,true])await check(`old window ${failed?'reject':'success'} cannot strand new window chrome`,async()=>{
 const f=fixture(),a=f.windowPort();await f.C.install(a);await settle();
 const gate=deferred();a.nextColor=gate;f.theme('paperNight');await tick();
 const b=f.windowPort();await f.C.install(b);f.theme('greenNight');
 if(failed)gate.reject(Error('1300002 simulated destroyed window'));else gate.resolve();await settle();
 assert.equal(b.properties.statusBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='greenNight').paperStart,'replacement must receive newest color');f.C.detach();
});
await check('failed latest request stays pending without an automatic retry loop and explicit reapply recovers',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const count=f.colors(w).length,gate=deferred();w.nextColor=gate;f.theme('warmNight');await tick();gate.reject(Error('1300003 simulated latest failure'));await settle();
 assert.equal(f.colors(w).length,count+1,'same failed intent must not spin');f.C.reapplyChrome();await settle();
 assert.equal(w.properties.statusBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='warmNight').paperStart);f.C.detach();
});
await check('showing controls retries a failed color even when visible-bar policy and geometry are unchanged',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const visible=new f.P('system',false,false,false,false);await f.C.requestReaderWindowPolicy(visible);
 const gate=deferred();w.nextColor=gate;f.theme('paper');await tick();gate.reject(Error('1300003 simulated theme failure'));await settle();
 const before=w.calls.length;await f.C.requestReaderWindowPolicy(visible);await settle();
 assert.equal(w.properties.statusBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='paper').paperStart,'visible controls must not keep stale app color');
 assert.equal(w.calls.slice(before).filter(c=>c[0]==='visible').length,0,'unchanged visibility remains deduplicated');f.C.detach();
});
await check('actual cutout setting true to false preserves measured band across delayed show area and all eight themes',async()=>{
 for(const t of READER_THEME_DEFINITIONS)for(const initiallyOpen of [false,true]){
   const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
   let controls=initiallyOpen;const saved=[];
   const e=Object.assign(new f.E(),{windowChromeActive:true,windowChromeOverlayActive:false,appearanceSnapshot:{activeTheme:t.id},
     readerSettingsSnapshot:{extendIntoCutout:true,hideNavigationBar:false,screenDirection:'system'},readerSettingsMutationGeneration:0,
     lifecycleToken:1,screenAwakeKeepScreenOn:false,ttsKeepScreenOn:false,controlsPresentedForWindow:()=>controls,
     configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},isSessionActive:()=>true,
     readerSettingsGateway:{update:async s=>{saved.push(s);}},reflowAfterWindowGeometryChange(){this.applyWindowChrome();},
     showReaderSettingsFailure(){assert.fail('unexpected settings failure');}});
   e.applyWindowChrome();await e.applyReaderWindowPolicy(e.readerSettingsSnapshot);await settle();
   assert.equal(f.C.metrics().statusBarHeight,48);
   if(!initiallyOpen)w.avoidTop={left:0,top:0,width:0,height:0}; // API ACK precedes visible-area event.
   e.commitReaderWindowSettings({...e.readerSettingsSnapshot,extendIntoCutout:false});await settle();
   assert.equal(saved.at(-1).extendIntoCutout,false);assert.equal(w.barEnabled.status,true);
   assert.equal(f.C.metrics().statusBarHeight,48,`${t.id}: show ACK must not erase measured band`);
   if(!initiallyOpen){
     w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,48,'intermediate zero event during reveal');
     w.avoidTop={left:2,top:1,width:386,height:50};w.events.get('avoidAreaChange')({});
     assert.deepEqual(f.C.metrics().statusBarRect,new metrics.ReaderRectVp(2,1,386,50));
   }
   controls=false;await e.applyReaderWindowPolicy(e.readerSettingsSnapshot);
   assert.equal(w.barEnabled.status,true,'closing controls with cutout off keeps status visible');
   assert.equal(w.properties.statusBarColor,t.statusBackground);assert.equal(w.properties.statusBarContentColor,t.statusForeground);
   w.avoidTop={left:0,top:0,width:0,height:0};w.events.get('avoidAreaChange')({});
   assert.equal(f.C.metrics().statusBarHeight,0,'after positive reveal, a later authoritative zero can clear the band');
   f.C.detach();
 }
});
await check('pending status reveal never borrows another window geometry or replacement window measurement',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 w.avoidTop={left:0,top:0,width:0,height:0};await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));
 w.rect={left:0,top:0,width:844,height:390};w.events.get('windowSizeChange')(w.rect);
 assert.equal(f.C.metrics().statusBarHeight,0,'no invented landscape height');
 const b=f.windowPort();b.avoidTop={left:0,top:0,width:0,height:0};await f.C.install(b);await settle();
 assert.equal(f.C.metrics().statusBarHeight,0,'replacement with no measurement cannot reuse previous window band');f.C.detach();
});
await check('early positive event cannot end pending reveal before ACK; repeated show and app ownership preserve it',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 const gate=deferred();w.nextStatus=gate;
 const reveal=f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));await settle();
 w.avoidTop={left:0,top:0,width:390,height:48};w.events.get('avoidAreaChange')({});
 w.avoidTop={left:0,top:0,width:0,height:0};gate.resolve();await reveal;
 assert.equal(f.C.metrics().statusBarHeight,48,'pre-ACK event must not clear reveal retention');
 await f.C.requestReaderWindowPolicy(new f.P('system',true,false,false,false));
 assert.equal(f.C.metrics().statusBarHeight,48,'same reveal with changed keep-awake policy');
 await f.C.requestAppWindowPolicy();assert.equal(f.C.metrics().statusBarHeight,48);
 w.avoidTop={left:0,top:0,width:390,height:46};w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,46);
 w.avoidTop={left:0,top:0,width:0,height:0};w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,0);
 f.C.detach();
});
await check('show superseded by hide converges and same-size rotation does not reuse the pending band',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 const gate=deferred();w.nextStatus=gate;w.avoidTop={left:0,top:0,width:0,height:0};
 const reveal=f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));await settle();
 const hide=f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));gate.resolve();await Promise.all([reveal,hide]);
 assert.equal(w.barEnabled.status,false);assert.equal(f.C.metrics().statusBarHeight,48);
 await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));
 f.displayInfo.rotation=2;w.events.get('windowRectChange')({});assert.equal(f.C.metrics().statusBarHeight,0,'180-degree rotation has no measured band yet');
 f.C.detach();
});
for(const result of cases)console.log(JSON.stringify(result));
assert.equal(cases.filter(x=>x.status==='FAIL').length,0,'production window chrome scenarios');
console.log('PASS actual Coordinator + LRE palette requests; controlled Window promise completions only, no device pixel or failure-frequency claim.');
