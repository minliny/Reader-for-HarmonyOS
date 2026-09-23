import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {ReadingSurfaceLayoutMap} from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const path=new URL('../entry/src/main/ets/features/reading/ReaderNativeParagraph.ets',import.meta.url).pathname;
const source=readFileSync(path,'utf8'),virtual=path.replace('.ets','SdkProbe.ts');
const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,
 target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{
 '@ohos.*':[`${sdk}/../../api/@ohos.*.d.ts`],'@kit.*':[`${sdk}/../../kits/@kit.*.d.ts`]}};
const host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
host.getSourceFile=(p,...args)=>p===virtual?ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true):read(p,...args);
const program=ts.createProgram([virtual,...readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`)],options,host);
assert.deepEqual(ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error)
 .map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
let measured=0,cleared=0,failed=false;const windows=[];
class Window{constructor(...args){this.args=args;this.closes=0;windows.push(this);} matchesGeometry(){return this.geometryMatches!==false;} prepareWholeParagraph(){this.expands=(this.expands??0)+1;if(this.expansionBlocked)return false;this.whole=true;return true;} lineTopForUtf16(v){return v*7;} lineStartForY(v){return Math.floor(v/7);} coversWholeParagraph(){return this.whole===true;}lineCount(){return 37;}selection(){} configure(...args){this.range=args;if(failed)throw Error('bad geometry');} close(){this.closes++;}frame(){return this;}clipHeightVp(){return 31;}glyphRects(){return [];}}
class Measurement{measure(){measured++;}take(){return {};}clear(){cleared++;}}
class NodeController{rebuild(){this.mounted=this.makeNode({});}}
const js=ts.transpileModule(source.replace(/^import.*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const {Resource,Resources,Controller,prepare}=new Function('NodeController','ReaderNativeTextMeasurement','ReaderNativeTextWindow','TextController','ReadingSurfaceLayoutMap',js+
 ';return {Resource:ReaderNativeParagraphResource,Resources:ReaderNativeParagraphResources,Controller:ReaderNativeParagraphController,prepare:prepareReaderNativeParagraph};')(NodeController,Measurement,Window,class{getLayoutManager(){return {getLineCount:()=>37};}},ReadingSurfaceLayoutMap);
const context={vp2px:v=>v},recipe={key:'a',text:'A😀B',startScalar:0,firstLine:0,lastLine:0,style:{widthVp:100}};
{
 const win=new Window(),pool=new Resources();pool.set('a',win);
 const first=new Controller();first.prepare(context,recipe,0,pool.get('a'));
 assert.equal(measured,0,'transfer does not remeasure');assert.equal(first.makeNode(context),win);
 pool.close();assert.equal(win.closes,0,'outgoing mounted slot survives page-owner release');
 first.close();assert.equal(win.closes,1);first.close();assert.equal(win.closes,1);
}
{
 const pool=new Resources(),old=new Window();pool.set('a',old);
 const c=new Controller();c.prepare(context,recipe,0,pool.get('a'));
 const replacement=new Window();pool.set('a',replacement);assert.equal(old.closes,0);
 c.close();assert.equal(old.closes,1);pool.retain(new Set(['a']));assert.equal(replacement.closes,0);
 pool.close();assert.equal(replacement.closes,1);
}
{
 const win=new Window(),resource=new Resource(win),live=new Controller(),snapshot=new Controller();
 live.prepare(context,recipe,0,resource);snapshot.prepare(context,recipe,0,resource);
 assert.equal(measured,1,'simultaneous independent native parents cannot steal the live Text');
 assert.notEqual(snapshot.makeNode(context),live.makeNode(context));
 snapshot.close();assert.equal(windows.at(-1).closes,1);assert.equal(win.closes,0);
 live.close();resource.release();assert.equal(win.closes,1);
}
{
 const c=new Controller();c.prepare(context,{...recipe,wholeParagraph:true},0);
 assert.equal(windows.at(-1).args[5],36,'continuous text admits the actual complete native paragraph');
 assert.deepEqual(windows.at(-1).range,[0,36,0]);c.close();
}
{
 const win=new Window();win.whole=true;
 const resource=new Resource(win),c=new Controller(),before=measured;
 c.prepare(context,{...recipe,wholeParagraph:true},0,resource);
 assert.equal(measured,before,'continuous first viewport reuses its already-shaped complete paragraph');
 assert.deepEqual(win.range,[0,36,0]);c.close();resource.release();assert.equal(win.closes,1);
}
{
 failed=true;const c=new Controller();assert.throws(()=>c.prepare(context,recipe,0),/geometry/);
 assert.equal(windows.at(-1).closes,1);assert.equal(c.makeNode(context),null);assert.equal(measured,cleared);
}
console.log('PASS native paragraph SDK and ownership: transfer without reshaping, outgoing lease, replacement, independent snapshot parent and failure disposal');

{
 const map={immutable:'paragraph-map'},pool=new Resources();pool.set('map',new Window(),map);
 assert.equal(pool.get('map').layoutMap,map,'resource transfers the same text index with its native paragraph');
 pool.close();assert.equal(pool.get('map'),undefined);
}

// Initial continuous geometry and the real row share a physical node.
{
 failed=false;const pool=new Resources(),window=new Window();pool.set('a',window,new ReadingSurfaceLayoutMap(recipe.text));
 const before=measured,prepared=prepare(context,{...recipe,wholeParagraph:true});
 assert.equal(prepared.resource,pool.get('a'));assert.equal(prepared.owned,false);assert.equal(measured,before);
 assert.equal(window.expands,1,'unmounted partial window expands existing line facts');
 assert.equal(prepared.position.yForScalar(2),21,'scalar to UTF16 conversion uses the same original text index');
 const view=new Controller();view.prepare(context,{...recipe,wholeParagraph:true},0,prepared.resource);
 assert.equal(view.makeNode(context),window);assert.equal(measured,before,'mount does not repeat first-position measurement');
 assert.equal(prepared.resource.prepareWholePosition(context,recipe),undefined,'mounted row cannot be resized by a new initial intent');
 pool.close();assert.equal(window.closes,0);view.close();assert.equal(window.closes,1);
 assert.equal(prepared.position.yForScalar(2),0,'released geometry cannot answer a later chapter');
}
for(const reason of ['mounted','geometry','gap']){
 const pool=new Resources(),window=new Window();pool.set('a',window);let live;
 if(reason==='mounted'){live=new Controller();live.prepare(context,recipe,0,pool.get('a'));}
 if(reason==='geometry')window.geometryMatches=false;if(reason==='gap')window.expansionBlocked=true;
 const before=measured,prepared=prepare(context,{...recipe,wholeParagraph:true});
 assert.equal(prepared.owned,true);assert.equal(measured,before+1);assert.notEqual(prepared.resource,pool.get('a'));
 const view=new Controller();view.prepare(context,{...recipe,wholeParagraph:true},0,prepared.resource);
 assert.equal(measured,before+1,'new actual owner is measured once, then handed to the row');
 assert.notEqual(view.makeNode(context),window);prepared.resource.release();assert.equal(windows.at(-1).closes,0);
 view.close();assert.equal(windows.at(-1).closes,1);live?.close();pool.close();assert.equal(window.closes,1);
}
console.log('PASS initial paragraph preparation: partial native reuse without measuring, geometry/gap/mounted rejection, one actual fallback owner and deferred release');
