import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const sourcePath=new URL('../entry/src/main/ets/pages/ReaderTextNodeDiagnostic.ets',import.meta.url).pathname;
const source=readFileSync(sourcePath,'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const prefix=source.slice(0,source.indexOf('@Component'));
const component=source.slice(source.indexOf('@Component'),source.indexOf('  build() {'))
 .replace('@Component\nexport struct ReaderTextNodeDiagnostic {','class Page { constructor(private context: UIContext) {}')
 .replaceAll('@State ','').replaceAll('this.getUIContext()','this.context')+'\n}';
const virtual=sourcePath.replace('.ets','SdkProbe.ts');
const options={noEmit:true,skipLibCheck:true,moduleResolution:ts.ModuleResolutionKind.NodeJs,
 target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,types:[],baseUrl:'/',paths:{
 '@ohos.*':[`${sdk}/../../api/@ohos.*.d.ts`],'@kit.*':[`${sdk}/../../kits/@kit.*.d.ts`]}};
const host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
host.getSourceFile=(path,...args)=>path===virtual?ts.createSourceFile(path,prefix+component,ts.ScriptTarget.Latest,true):read(path,...args);
const program=ts.createProgram([virtual,...readdirSync(`${sdk}/declarations`).filter(n=>n.endsWith('.d.ts')).map(n=>`${sdk}/declarations/${n}`)],options,host);
assert.deepEqual(ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error)
 .map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],'real SDK API qualification');
const nodes=[],logs=[];let count=3;
const metrics=[0,1,2].map(i=>({startIndex:i*4,endIndex:i*4+4,topHeight:i*31,height:31,width:100,baseline:i*31+25}));
class Controller{rebuild(){this.rebuilds=(this.rebuilds??0)+1;}}
class Frame{
 constructor(){this.children=[];this.props={};this.disposed=0;this.commonAttribute={};
  for(const name of ['width','height','clip','translate'])this.commonAttribute[name]=v=>{this.props[name]=v;return this.commonAttribute;};}
 appendChild(n){this.children.push(n);}
 removeChild(n){assert.ok(this.children.includes(n));this.children=this.children.filter(c=>c!==n);}
 dispose(){this.disposed++;}
}
const dependencies={FrameNode:Frame,NodeController:Controller,
 TextController:class{getLayoutManager(){return {getLineCount:()=>count,getLineMetrics:i=>metrics[i],getRectsForRange:()=>[]};}},
 typeNode:{createNode(){const n=new Frame();n.inputs=[];n.initialize=(...args)=>n.inputs.push(args);n.attribute={};
  for(const key of ['lineSpacing','copyOption','editMenuOptions','fontWeight','width','fontFamily','fontSize','lineHeight','fontColor','letterSpacing','textIndent','textAlign','direction'])
   n.attribute[key]=v=>{n.props[key]=v;return n.attribute;};
  n.measure=v=>{n.constraint=v;};n.layout=v=>{n.position=v;};nodes.push(n);return n;}},
 FontWeight:{Regular:400},CopyOptions:{InApp:1},WordBreak:{BREAK_ALL:1},TextAlign:{JUSTIFY:'justify',Start:'start'},Direction:{Rtl:'rtl',Ltr:'ltr'},
 hilog:{info(_d,_t,_f,v){logs.push(JSON.parse(v));}}};
const adapterSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextMeasurement.ets',import.meta.url),'utf8');
const adapterJs=ts.transpileModule(adapterSource.replace(/^import.*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const nativeAdapter=new Function('typeNode','WordBreak','LengthMetrics',adapterJs+';return {ReaderNativeTextMeasurement,readerNativeTextGeometryKey,readerNativeTextNodeGeometry,readerNativeTextNodeContent};')(dependencies.typeNode,dependencies.WordBreak,{vp:v=>v});
dependencies.ReaderNativeTextMeasurement=nativeAdapter.ReaderNativeTextMeasurement;
const windowSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextWindow.ets',import.meta.url),'utf8');
const windowJs=ts.transpileModule(windowSource.replace(/^import.*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
dependencies.ReaderNativeTextWindow=new Function('FrameNode','LengthMetrics','graphicsText','readerNativeTextGeometryKey','readerNativeTextNodeGeometry','readerNativeTextNodeContent',windowJs+';return ReaderNativeTextWindow;')(Frame,{vp:v=>v},{RectWidthStyle:{TIGHT:0},RectHeightStyle:{TIGHT:0}},nativeAdapter.readerNativeTextGeometryKey,nativeAdapter.readerNativeTextNodeGeometry,nativeAdapter.readerNativeTextNodeContent);
const js=ts.transpileModule(prefix.replace(/^import[\s\S]*?;$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {Probe,samples}=new Function(...Object.keys(dependencies),js+';return {Probe:TextNodeDiagnosticController,samples:TEXT_NODE_SAMPLES};')(...Object.values(dependencies));
const probe=new Probe(),context={vp2px:v=>v*3.5,px2vp:v=>v/3.5,fp2px:v=>v*3.5};
probe.prepare(context,1,true,333.75);
const first=nodes[0],root=probe.makeNode(context);
assert.equal(first.inputs.length,1);assert.equal(first.inputs[0][0],samples[1]);
assert.equal(first.props.textIndent,37.25/3.5);assert.equal(first.constraint.maxSize.width,333.75);
assert.equal(root.children[0],first,'mount the exact measured native Text');
assert.equal(root.props.height,'62px');assert.deepEqual(first.props.translate,{y:'-31px'});
probe.record('mounted');assert.equal(first.inputs.length,1,'post-mount inspection must not replace source text');
assert.equal(logs.filter(l=>l.phase==='mounted').length,3);
probe.prepare(context,2,false,333.75);assert.equal(first.disposed,1);assert.equal(root.disposed,1);
count=0;assert.throws(()=>probe.prepare(context,0,false,333.75),/LAYOUT_UNAVAILABLE/);
assert.equal(nodes.at(-1).disposed,1);assert.equal(probe.makeNode(context),null);
probe.close();probe.prepare(context,0,false,333.75);assert.equal(nodes.length,3);
const pendingFonts=[];
dependencies.text={FontCollection:{getGlobalInstance(){return {loadFontWithCheck(name,path){
 assert.equal(name,'ReaderTextNodeDiagnosticNoto');assert.deepEqual(path,{rawfile:'NotoSerifSC-Regular.ttf'});
 return new Promise(resolve=>pendingFonts.push(resolve));
}};}}};
dependencies.$rawfile=value=>({rawfile:value});
const pageCode=ts.transpileModule((prefix+component).replace(/^import[\s\S]*?;$/gm,''),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const Page=new Function(...Object.keys(dependencies),pageCode+';return Page;')(...Object.values(dependencies));
const stale=new Page(context);stale.widthPx=333.75;stale.aboutToAppear();
assert.equal(nodes.length,3,'no native Text may be measured before the checked font receipt');
stale.aboutToDisappear();pendingFonts.shift()();await Promise.resolve();await Promise.resolve();
assert.equal(nodes.length,3,'late font completion cannot resurrect an unmounted page');
count=1;
const current=new Page(context);current.widthPx=333.75;current.aboutToAppear();
assert.equal(nodes.length,3);pendingFonts.shift()();await Promise.resolve();await Promise.resolve();
assert.equal(nodes.length,4);assert.equal(current.fontReady,true);current.aboutToDisappear();
assert.equal(nodes.at(-1).disposed,1);
console.log('Text node diagnostic: installed SDK, exact measured-node reuse, native indent, clipping inputs and failure/disposal PASS; controlled metrics, no platform paint claim');

// Baseline-aware clipping uses the final native geometry without redefining
// paragraph text or throwing away original first/last line ink allowances.
{
 const base=[{startIndex:0,endIndex:4,topHeight:0,height:31,width:100,baseline:25},
 {startIndex:4,endIndex:8,topHeight:31,height:34,width:100,baseline:59},
 {startIndex:8,endIndex:12,topHeight:65,height:33,width:100,baseline:92}];
 let ink=[];let final=base;const n=dependencies.typeNode.createNode();const ctrl={getLayoutManager:()=>({getLineCount:()=>final.length,getLineMetrics:i=>final[i],getRectsForRange:()=>ink})};
 const win=new dependencies.ReaderNativeTextWindow(context,n,ctrl,100);
 win.configure(1,2);assert.equal(win.clipTopPx(),31);assert.equal(win.clipHeightPx(),67);
 assert.equal(win.lineTopForUtf16(6),0);
 assert.equal(win.lineTopForUtf16(8),context.px2vp(34));
 assert.equal(win.lineStartForY(context.px2vp(35)),8);
 final=base.map((m,i)=>({...m,topHeight:m.topHeight+i*21+5,height:m.height+21,baseline:m.baseline+i*21+2}));
 win.configure(1,2,6);
 assert.equal(win.clipTopPx(),54);assert.equal(win.clipHeightPx(),88);
 assert.equal(final[1].baseline-win.clipTopPx(),base[1].baseline-base[1].topHeight,'first visible glyph baseline stays in the original ink box');
 assert.equal(n.inputs.length,0,'viewport never initializes or replaces text');
 ink=[{rect:{top:50,bottom:149}}];win.configure(1,2,6);
 assert.equal(win.clipTopPx(),50);assert.equal(win.clipHeightPx(),99,'fallback ink must not be cropped by the primary font line box');
 ink=[{rect:{left:-5,right:130,top:45,bottom:160}}];
 assert.deepEqual(win.glyphRects(0,100),[{left:0,right:100,top:0,bottom:99}]);
 assert.equal(win.visibleStartUtf16(),4);assert.equal(win.visibleEndUtf16(),12);
 assert.deepEqual(win.glyphRects(0,4),[]);assert.deepEqual(win.glyphRects(12,99),[]);
 ink=[];
 const frame=win.frame();win.close();win.close();assert.equal(n.disposed,1);assert.equal(frame.disposed,1);
 assert.throws(()=>win.configure(0,0),/CLOSED/);assert.deepEqual(win.glyphRects(4,8),[]);
 const changed=dependencies.typeNode.createNode();final=base;
 const invalid=new dependencies.ReaderNativeTextWindow(context,changed,ctrl,100);
 final=base.map(m=>({...m,endIndex:m.endIndex+1}));
 assert.throws(()=>invalid.configure(0,1,6),/REFLOWED/);invalid.close();assert.equal(changed.disposed,1);
}
console.log('PASS native paragraph window baseline compensation, unchanged shaping and exact ownership');

{
 let reads=0;
 const n=dependencies.typeNode.createNode();
 const ctrl={getLayoutManager:()=>({getLineCount:()=>10000,getLineMetrics:i=>{reads++;return {
  startIndex:i,endIndex:i+1,topHeight:i*20,height:20,width:100,baseline:i*20+16};},getRectsForRange:()=>[]})};
 const win=new dependencies.ReaderNativeTextWindow(context,n,ctrl,100,9000,9005);
 win.configure(9000,9004);
 assert.equal(win.visibleStartUtf16(),9000);assert.equal(win.visibleEndUtf16(),9005);
 assert.ok(reads<20,'native ownership and clipping retain only the admitted line window');
 assert.throws(()=>win.configure(8999,9000),/RANGE_INVALID/,'a window cannot expose uncaptured layout');
 win.close();assert.equal(n.disposed,1);
}
console.log('PASS native resource acquisition and configure have bounded visible metric reads on a 10000-line paragraph');

{
 count=3;const measurement=new nativeAdapter.ReaderNativeTextMeasurement(),controller=new dependencies.TextController();
 const style={widthVp:100,fontFamily:'ReaderFont',fontSize:20,fontWeight:400,lineHeight:31,letterSpacing:0,color:'#111',alignment:'start',breakAll:false,indentVp:36};
 measurement.measure(context,'A😀BCDEF',controller,style);const node=measurement.take(controller);
 let remeasured=0;node.measure=()=>remeasured++;
 const window=new dependencies.ReaderNativeTextWindow(context,node,controller,350,1,1);
 assert.equal(window.matchesGeometry(context,style,'A😀BCDEF'),true);
 assert.equal(window.matchesGeometry(context,{...style,color:'#fff'},'A😀BCDEF'),true);
 for(const [field,value] of Object.entries({widthVp:101,fontFamily:'Other',fontSize:21,fontWeight:500,lineHeight:32,letterSpacing:1,alignment:'justify',breakAll:true,indentVp:18,direction:'rtl',extraLineSpacingVp:2}))
  assert.equal(window.matchesGeometry(context,{...style,[field]:value},'A😀BCDEF'),false,field);
 assert.equal(window.matchesGeometry(context,style,'other original text'),false);
 assert.equal(window.matchesGeometry({...context,fp2px:v=>v*4},style,'A😀BCDEF'),false);
 assert.equal(window.matchesGeometry({...context,vp2px:v=>v*4},style,'A😀BCDEF'),false);
 assert.equal(window.coversWholeParagraph(),false);assert.equal(window.prepareWholeParagraph(),true);
 assert.equal(window.coversWholeParagraph(),true);assert.equal(remeasured,0,'expansion reads existing native facts without reshaping');
 assert.equal(window.frame().children[0],node);assert.equal(window.visibleStartUtf16(),0);assert.equal(window.visibleEndUtf16(),12);
 window.configure(0,2,2);const before=remeasured;assert.equal(window.prepareWholeParagraph(),false);
 assert.equal(remeasured,before,'nonzero native line-spacing cannot silently mutate a previous presentation');
 measurement.clear();window.close();assert.equal(node.disposed,1);assert.equal(window.prepareWholeParagraph(),false);
}
console.log('PASS complete initial geometry identity, exact native-node reuse, zero-measure expansion and incompatible-layout rejection');
