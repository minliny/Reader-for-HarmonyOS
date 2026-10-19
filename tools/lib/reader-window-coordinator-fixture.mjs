import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {ReaderBrightnessWriter} from '../../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
import * as metrics from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {findReaderTheme} from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';
const base=new URL('../../entry/src/main/ets/',import.meta.url);
export async function createWindowCoordinatorFixture(){
 const extensionHook=registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
 const {ReaderStatusBarMeasurement}=await import('../../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
 const {ts}=installedEtsCompiler();
 const app=new Map(),appWrites=[],priorStorage=globalThis.AppStorage;globalThis.AppStorage={setOrCreate:(k,v)=>{app.set(k,v);appWrites.push([k,v]);}};
 const warnings=[];
 const displayInfo={id:0,rotation:0,densityPixels:1,scaledDensity:1};
 const kit={window:{Orientation:{UNSPECIFIED:0,PORTRAIT:1,LANDSCAPE:2,AUTO_ROTATION_UNSPECIFIED:3},
   AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
   display:{getDefaultDisplaySync:()=>displayInfo,on(){},off(){}}};
 const deps={'@kit.ArkUI':kit,'@kit.PerformanceAnalysisKit':{hilog:{info(){},warn(...args){warnings.push(args);}}},
   '../features/common/ReaderThemeRegistry':{findReaderTheme},
   './ReaderBrightnessWriter':{ReaderBrightnessWriter},'./ReaderStatusBarMeasurement':{ReaderStatusBarMeasurement},
   '../features/common/ReaderWindowMetrics':metrics};
 const source=readFileSync(new URL('app/ReaderWindowCoordinator.ts',base),'utf8');
 const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',out)(id=>{assert.ok(id in deps,id);return deps[id];},module,module.exports);
 const {ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P}=module.exports;
 function windowPort(options={}){
   const zero={left:0,top:0,width:0,height:0};
   const win={calls:[],properties:{},barEnabled:{status:true,navigation:true,navigationIndicator:true},nextColor:undefined,
     avoidTop:undefined,nextStatus:undefined,rect:{left:0,top:0,width:390,height:844},events:new Map(),
     orientation:options.orientation??0,keepScreenOn:options.keepScreenOn??false,
     getPreferredOrientation:()=>win.orientation,getWindowProperties:()=>({isKeepScreenOn:win.keepScreenOn,brightness:-1,windowRect:win.rect}),
     getWindowAvoidArea:type=>({topRect:type===0?(win.avoidTop??(win.barEnabled.status?{left:0,top:0,width:390,height:48}:zero)):zero,
       bottomRect:zero,leftRect:zero,rightRect:zero}),on(n,fn){win.events.set(n,fn);},off(n){win.events.delete(n);},
     setWindowLayoutFullScreen:async()=>{},setWindowSystemBarEnable:async()=>{},
     async setPreferredOrientation(value){win.calls.push(['orientation',value]);win.orientation=value;},
     async setWindowKeepScreenOn(value){win.calls.push(['awake',value]);win.keepScreenOn=value;},
     async setSpecificSystemBarEnabled(bar,enabled,enableAnimation){win.calls.push(['visible',bar,enabled,enableAnimation]);
       if(bar==='status'){const gate=win.nextStatus;win.nextStatus=undefined;if(gate)await gate.promise;}
       win.barEnabled[bar]=enabled;},
     async setWindowSystemBarProperties(props){win.calls.push(['color',{...props}]);const pending=win.nextColor;win.nextColor=undefined;
       if(pending)await pending.promise;win.properties={...win.properties,...props};},
   };return win;
 }

 const colors=w=>w.calls.filter(x=>x[0]==='color');
 return{C,S,P,windowPort,colors,displayInfo,app,appWrites,warnings,cleanup(){C.detach();extensionHook.deregister();if(priorStorage===undefined)delete globalThis.AppStorage;else globalThis.AppStorage=priorStorage;}};
}
