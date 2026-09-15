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
 const kit={window:{Orientation:{UNSPECIFIED:0,PORTRAIT:1,LANDSCAPE:2,AUTO_ROTATION_UNSPECIFIED:3},
   AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
   display:{getDefaultDisplaySync:()=>({id:0,rotation:0,densityPixels:1,scaledDensity:1}),on(){},off(){}}};
 const deps={'@kit.ArkUI':kit,'./ReaderBrightnessWriter':{ReaderBrightnessWriter},'./ReaderStatusBarMeasurement':{ReaderStatusBarMeasurement},
   '../features/common/ReaderWindowMetrics':metrics};
 const source=readFileSync(new URL('app/ReaderWindowCoordinator.ts',base),'utf8');
 const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',out)(id=>{assert.ok(id in deps,id);return deps[id];},module,module.exports);
 const {ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P}=module.exports;
 const E=productionMotionMethods(new URL('features/reading/LocalReadingExperience.ets',base),['applyWindowChrome'],{
   ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,readerAppearanceThemeStyle,readerAppearanceChromeTone});
 function windowPort(){
   const zero={left:0,top:0,width:0,height:0};
   const win={calls:[],properties:{},barEnabled:{status:true,navigation:true,navigationIndicator:true},nextColor:undefined,
     getPreferredOrientation:()=>0,getWindowProperties:()=>({isKeepScreenOn:false,brightness:-1,windowRect:{left:0,top:0,width:390,height:844}}),
     getWindowAvoidArea:type=>({topRect:type===0&&win.barEnabled.status?{left:0,top:0,width:390,height:48}:zero,
       bottomRect:zero,leftRect:zero,rightRect:zero}),on(){},off(){},
     setWindowLayoutFullScreen:async()=>{},setWindowSystemBarEnable:async()=>{},setPreferredOrientation:async()=>{},setWindowKeepScreenOn:async()=>{},
     async setSpecificSystemBarEnabled(bar,enabled){win.calls.push(['visible',bar,enabled]);win.barEnabled[bar]=enabled;},
     async setWindowSystemBarProperties(props){win.calls.push(['color',{...props}]);const pending=win.nextColor;win.nextColor=undefined;
       if(pending)await pending.promise;win.properties={...win.properties,...props};},
   };return win;
 }
 function theme(id,overlay=true){const e=Object.assign(new E(),{windowChromeActive:true,windowChromeOverlayActive:overlay,appearanceSnapshot:{activeTheme:id}});e.applyWindowChrome();}
 const colors=w=>w.calls.filter(x=>x[0]==='color');
 return{C,S,P,windowPort,theme,colors};
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
for(const result of cases)console.log(JSON.stringify(result));
assert.equal(cases.filter(x=>x.status==='FAIL').length,0,'production window chrome scenarios');
console.log('PASS actual Coordinator + LRE palette requests; controlled Window promise completions only, no device pixel or failure-frequency claim.');
