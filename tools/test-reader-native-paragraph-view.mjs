import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {ReadingSurfaceLayoutMap} from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import {readerSelectedOriginalText} from '../entry/src/main/ets/features/reading/ReaderTextSelectionProjection.ts';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const path=new URL('../entry/src/main/ets/features/reading/ReaderNativeParagraphView.ets',import.meta.url).pathname;
const source=readFileSync(path,'utf8');
const classSource=source.slice(0,source.indexOf('  build() {')).replace('@Component\nexport struct ReaderNativeParagraphView {',
 'class View { getUIContext(): UIContext { return this.context; } context: UIContext;')
 .replace(/@(Prop|State|Watch\('[^']+'\))\s*/g,'')+'\n}';
const typed="import { UIContext } from '@ohos.arkui.UIContext';\n"+classSource;
const virtual=path.replace('.ets','SdkProbe.ts');
const options={noEmit:true,skipLibCheck:true,lib:['lib.es2022.d.ts'],moduleResolution:ts.ModuleResolutionKind.NodeJs,
 target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{
 '@ohos.*':[`${sdk}/../../api/@ohos.*.d.ts`],'@kit.*':[`${sdk}/../../kits/@kit.*.d.ts`]}};
const host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
host.getSourceFile=(p,...args)=>p===virtual?ts.createSourceFile(p,typed,ts.ScriptTarget.Latest,true):read(p,...args);
const program=ts.createProgram([virtual,...readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`)],options,host);
assert.deepEqual(ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error)
 .map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
const measurementSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextMeasurement.ets',import.meta.url),'utf8');
const geometryJs=ts.transpileModule(measurementSource.replace(/^import.*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const geometryKey=new Function(geometryJs+';return readerNativeTextGeometryKey;')();
const style={widthVp:300,fontFamily:'f',fontSize:20,fontWeight:400,lineHeight:30,letterSpacing:0,color:'#111',alignment:0,breakAll:false};
const controllers=[],copied=[];
class Controller {
 constructor(){controllers.push(this);}prepare(_context,recipe){this.recipe=recipe;this.prepares=(this.prepares??0)+1;}
 color(value){this.ink=value;}
 heightVp(){return 30;}close(){this.closed=true;}selection(enabled,_background,callback){this.enabled=enabled;this.copy=callback;}
 visibleStartUtf16(){return 1;}visibleEndUtf16(){return 4;}
 glyphRects(start,end){this.range=[start,end];return [{left:2,right:8,top:4,bottom:12}];}
}
const js=ts.transpileModule(classSource.replace(/^import.*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const View=new Function('ReaderNativeParagraphController','ReadingSurfaceLayoutMap','readerSelectedOriginalText','copyReaderSelection',
 'readerNativeParagraphResource','readerNativeTextGeometryKey',js+';return View;')(Controller,ReadingSurfaceLayoutMap,readerSelectedOriginalText,t=>copied.push(t),()=>undefined,geometryKey);
const view=new View(),pending=[],paint=[];
view.context={px2vp:v=>v/2,vp2px:v=>v*2,fp2px:v=>v*2};view.recipe={key:'a',text:'A😀BC',startScalar:100,firstLine:0,lastLine:0,style};
view.queueHighlightMeasurement=fn=>pending.push(fn);view.onHighlightGeometry=r=>paint.push(r);
view.selectionEnabled=true;view.highlightStart=101;view.highlightEnd=103;view.underline=true;
view.aboutToAppear();const native=controllers[0];native.copy({start:0,end:5});assert.deepEqual(copied,['😀B']);
view.prepare();assert.equal(native.prepares,1,'unchanged reactive delivery cannot reshape or dismiss selection');
view.inkColor='#eeeeee';view.updateInk();assert.equal(native.ink,'#eeeeee');assert.equal(native.prepares,1,'theme changes update ink without reshaping');
assert.equal(view.heightVp,30);pending.shift()();assert.deepEqual(native.range,[1,4]);
assert.deepEqual(paint.at(-1),[{left:1,right:4,top:4.5,bottom:6,color:'#222222',multiply:false}]);
view.updateHighlight();const oldCopy=native.copy;view.aboutToDisappear();pending.shift()();oldCopy({start:0,end:5});
assert.equal(copied.length,1);assert.deepEqual(paint.at(-1),[]);assert.equal(native.closed,true);
console.log('PASS native paragraph view SDK, original visible selection, absolute scalar highlight and unmount rejection');

{
 const shared = new ReadingSurfaceLayoutMap('A😀BC');
 const mounted = new View();mounted.context={px2vp:v=>v,vp2px:v=>v,fp2px:v=>v};
 mounted.recipe={key:'shared',text:'A😀BC',startScalar:100,firstLine:0,lastLine:0,style};
 mounted.resourceProvider=()=>({layoutMap:shared});
 mounted.aboutToAppear();assert.equal(mounted.map,shared,'display reuses the measurement Unicode index');
 mounted.aboutToDisappear();assert.equal(mounted.map,undefined);
 assert.equal(shared.utf16ForScalar(2),3,'unmount does not invalidate another parent sharing the immutable index');
}

{
 const changed=new View();changed.context={vp2px:v=>v,fp2px:v=>v};changed.recipe={key:'stable',text:'正文',startScalar:0,firstLine:0,lastLine:0,style};
 changed.aboutToAppear();const c=controllers.at(-1);assert.equal(c.prepares,1);
 changed.recipe={...changed.recipe,style:{...style,color:'#eee'}};changed.prepare();assert.equal(c.prepares,1);
 changed.recipe={...changed.recipe,style:{...style,fontSize:21}};changed.prepare();assert.equal(c.prepares,2,'same recipe key cannot suppress changed geometry');
 changed.context={vp2px:v=>v,fp2px:v=>v*1.5};changed.prepare();assert.equal(c.prepares,3,'font scale is part of measured identity');changed.aboutToDisappear();
}
