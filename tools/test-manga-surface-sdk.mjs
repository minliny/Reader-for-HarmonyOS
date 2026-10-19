import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"tap-constructor": {"description": "实际Tap构造配置/API字段与toggle/panel/end fences", "resources": []}, "safe-area": {"description": "实际全窗image与overlay单safe owner/retained revision", "resources": []}, "save-and-frame": {"description": "实际save等待CAS与受控retirement下postFrame拒绝", "resources": []}, "persistent-directory": {"description": "实际persistent目录当前Props/无popup query与独立stage", "resources": []}, "viewport-overlays": {"description": "实际noninteractive badge/current progress range与偏好保留", "resources": []}, "sheet-frame": {"description": "实际各panel bounded frame/current width/quick目录footer回执", "resources": []}, "action-safe-frame": {"description": "实际More/download shared safe-area单owner", "resources": []}, "stage-width": {"description": "实际stage与split canvas独立参数/跨三宽度反例", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const { mangaSurfaceSdkDependencies, mountMangaViewportBuilder, mangaSurfaceBoundedControls } = await import('./lib/manga-surface-sdk-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createRequire,stripTypeScriptTypes} = await import('node:module');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {createArkUIPropertyRuntimeProbe} = await import('./lib/arkui-property-runtime-probe.mjs');
const {createDefaultReaderWindowMetrics, ReaderInsetsVp, readerInteractiveSafeInsets} = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const ts=require(`${sdk}/node_modules/typescript`);
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const tree=ts.createSourceFile(virtualFilePath('MangaReadingSurface.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const component=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(node=>node.name?.getText(tree)).filter(Boolean);
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const MangaStripProjection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSource=tree.statements.find(node=>node.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const MangaStripDataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataSource)};return MangaStripDataSource`)(MangaStripProjection);
const frame=tree.statements.find(node=>node.name?.getText(tree)==='MangaLayoutFrame');
assert.ok(frame,'restore uses the actual post-render callback class');
const MangaLayoutFrame=new Function('FrameCallback',`${stripTypeScriptTypes(frame.getText(tree))};return MangaLayoutFrame`)(class {});
const runtime=createArkUIPropertyRuntimeProbe();
const scrolls=[],frames=[];
class ListScroller {getItemRect(){return {x:0,y:-100,width:500,height:500};}scrollToIndex(...args){scrolls.push(args);}scrollBy(...args){scrolls.push(args);}}
class Scroller {currentOffset(){return {xOffset:0};}scrollTo(){}}
class PhotoViewScaleModel {}
let metrics=createDefaultReaderWindowMetrics();
metrics.systemInsets=new ReaderInsetsVp(0,137/3.5,0,0);
metrics.gestureInsets=new ReaderInsetsVp(0,0,0,24);
// Native gesture/list mounting is outside this geometry/property test. The real
// SDK still emits and executes the parent Column and its live padding observer.
const nativeBoundary=new Proxy({}, {get:()=>()=>{}});
// Capture the SDK-emitted constructor and callback registration only. Native
// touch arbitration remains outside this probe; do not simulate recognizers.
function checkViewportTap(candidate=source) {
  const taps=[];
  const tap={create:options=>taps.push({options}),onAction:callback=>{taps.at(-1).callback=callback;},pop(){}};
  const probe=createReaderBuilderProbe(candidate,['imageViewport','tileImage','toggleControls'],{
    TapGesture:tap,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,
    globalThis:{Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:tap},
    LazyForEach:nativeBoundary,ScrollDirection:{Horizontal:0},GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
  });
  Object.assign(probe.owner,{viewportWidth:390,zoom:1,panel:'',chapterEnd:false,controlsVisible:false});
  probe.owner.imageViewport();
  assert.equal(taps.length,1,'the actual viewport registers one native tap recognizer');
  assert.equal(taps[0].options.count,1);assert.ok(Number.isFinite(taps[0].options.distanceThreshold)&&taps[0].options.distanceThreshold>0,'actual current tap supplies a bounded movement configuration');
  assert.equal(typeof taps[0].callback,'function');
  taps[0].callback();assert.equal(probe.owner.controlsVisible,true,'a recognized normal tap still opens controls');
  taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'a second recognized normal tap still closes controls');
  probe.owner.panel='directory';taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'a presented panel retains its existing tap fence');
  probe.owner.panel='';probe.owner.chapterEnd=true;taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'chapter-end presentation retains its existing tap fence');
}
if(selectedCase==='tap-constructor') {
const gestureDeclarations=ts.createSourceFile('gesture.d.ts',readFileSync(`${sdk}/../../component/gesture.d.ts`,'utf8'),ts.ScriptTarget.Latest,true);
const tapParameters=gestureDeclarations.statements.find(node=>node.name?.getText(gestureDeclarations)==='TapGestureParameters');
assert.ok(tapParameters.members.some(node=>node.name?.getText(gestureDeclarations)==='distanceThreshold'),
  'the installed official SDK declares the native movement threshold');
checkViewportTap();
const unrestrictedTap=source.replace('TapGesture({ count: 1, distanceThreshold: 6 })','TapGesture({ count: 1 })');
assert.notEqual(unrestrictedTap,source);
assert.throws(()=>checkViewportTap(unrestrictedTap),/full-screen tap must bound movement/,
  'the old unrestricted native constructor is rejected without modeling touch recognition');

}
if(selectedCase==='safe-area'||selectedCase==='save-and-frame') {
const {owner,output}=createReaderBuilderProbe(source,names,{
  ...runtime.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource,MangaLayoutFrame,ListScroller,Scroller,PhotoViewScaleModel,
  uiContext:{postFrameCallback:frame=>frames.push(frame)},
  ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
  LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
  PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
  globalThis:{PanGesture:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},runtime.hooks);
assert.match(output,/LazyForEach/);
assert.match(output,/onScrollStop/);
owner.title='fixture chapter';owner.controlsVisible=true;
owner.initialRender();mountMangaViewportBuilder(owner);
if(selectedCase==='safe-area'){
const root=owner.nodes.get(0);
assert.equal(root.type,'Column');
assert.equal(root.padding,undefined,'the image root does not reserve system/gesture bands');
assert.deepEqual(root.ignoreLayoutSafeArea,[['LayoutSafeAreaType.SYSTEM'],['LayoutSafeAreaEdge.ALL']]);
assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM','SafeAreaType.CUTOUT'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']]);
assert.equal(root.width,'100%');assert.equal(root.height,'100%');
assert.equal(root.backgroundColor,owner.paperColor(),'safe content keeps the chosen manga paper behind image pixels');
assert.ok([...owner.nodes.values()].some(node=>node.type==='Text'&&node.create==='fixture chapter'),
  'the existing chapter title remains inside the safe root');
for(const alignment of ['Alignment.Top','Alignment.Bottom']) {
  const dock=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.create?.alignContent===alignment);
  assert.ok(dock,`${alignment}: floating bar is placed by a real SDK Stack constructor`);
  assert.equal(dock.width,'100%');assert.equal(dock.height,'100%');
  assert.deepEqual({...dock.padding},{left:0,top:137/3.5,right:0,bottom:24},'only control overlay clears physical system/gesture bands');
  assert.equal(dock.hitTestBehavior,'HitTestMode.Transparent','full-size bar placement leaves empty viewport space available to image gestures');
}
assert.equal([...owner.nodes.values()].some(node=>node.align==='Alignment.Top'||node.align==='Alignment.Bottom'),false,
  'bar placement must not depend on content-only component align()');
const nodeIds=[...owner.nodes.keys()];
metrics=createDefaultReaderWindowMetrics();
metrics.cutoutInsets=new ReaderInsetsVp(32,0,0,0);
metrics.gestureInsets=new ReaderInsetsVp(10,0,18,12);
metrics.navigationInsets=new ReaderInsetsVp(0,0,28,20);
owner.windowMetricsRevision=1;runtime.flush();
assert.equal(root.padding,undefined,'live asymmetric avoids do not resize the image root');
for(const alignment of ['Alignment.Top','Alignment.Bottom'])assert.deepEqual({...([...owner.nodes.values()].find(n=>n.type==='Stack'&&n.create?.alignContent===alignment).padding)},
  {left:32,top:0,right:28,bottom:20},'control overlay independently preserves asymmetric interactive edges');
metrics=createDefaultReaderWindowMetrics();
owner.windowMetricsRevision=2;runtime.flush();
assert.equal(root.padding,undefined,'cleared system bars keep the same full-window image root');
for(const alignment of ['Alignment.Top','Alignment.Bottom'])assert.deepEqual({...([...owner.nodes.values()].find(n=>n.type==='Stack'&&n.create?.alignContent===alignment).padding)},
  {left:0,top:0,right:0,bottom:0},'cleared control safe padding has one owner');
assert.deepEqual([...owner.nodes.keys()],nodeIds,'metrics changes update the mounted owner without remounting');

}
if(selectedCase==='save-and-frame'){
owner.mounted=true;owner.opened=true;owner.viewportWidth=500;
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/c'},manifestVersion:'sdk-v1',pages:[{ordinal:0,pageId:'a'}]};
owner.data.projection.publish(manifest,()=>({width:1000,height:4000,tileHeight:1000}));
let resolve;let saved;
owner.controller={chapter:{manifest},pageAt:ordinal=>manifest.pages[ordinal],savePosition:async(...args)=>{saved=args;await new Promise(r=>resolve=r);}};
let completed=false;const saving=owner.saveVisible().then(()=>{completed=true;});
await new Promise(r=>setImmediate(r));assert.equal(completed,false);assert.deepEqual(saved,[0,0,0.05]);
resolve();await saving;assert.equal(completed,true);
owner.restore(0,0.75);owner.aboutToDisappear=()=>{owner.mounted=false;owner.layoutGeneration++;};owner.aboutToDisappear();
assert.equal(frames.length,1,'restore queued a real rendered-frame callback');
const disposedFrame=frames.shift();disposedFrame.onFrame(0);runtime.flush();disposedFrame.onIdle(2_000_000);
await new Promise(r=>setImmediate(r));assert.equal(scrolls.length,0);

}
}
if(selectedCase==='persistent-directory'){
const tabletRuntime=createArkUIPropertyRuntimeProbe();
const tablet=createReaderBuilderProbe(source,names,{
  ...tabletRuntime.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource,MangaLayoutFrame,ListScroller,Scroller,PhotoViewScaleModel,
  uiContext:{postFrameCallback:frame=>frames.push(frame)},
  ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
  LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
  PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
  globalThis:{PanGesture:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},tabletRuntime.hooks).owner;
tablet.stageWidth=1180;tablet.stageHeight=820;tablet.viewportWidth=860;tablet.viewportHeight=820;
tablet.panelFontsReady=true;tablet.bookTitle='山海纪行';tablet.directoryQuery='第5';
tablet.initialRender();mountMangaViewportBuilder(tablet);
const directoryChild=[...tablet.children.values()].find(child=>child.params.mangaDisplay===true);
assert.ok(directoryChild,'the real SDK mounts the shared native directory outside control visibility');
assert.equal(directoryChild.params.currentChapterIndex,-1);
assert.equal(directoryChild.params.chapterStartBookmarkCreationEnabled,false);
assert.equal(directoryChild.params.query,'','persistent catalog ignores the popup search');
assert.equal(directoryChild.params.mangaCatalogDisplay,true);assert.equal(directoryChild.params.mangaCatalogNarrow,false);
assert.ok(Number.isFinite(directoryChild.params.mangaCurrentOpenInset));
assert.ok([...tablet.nodes.values()].some(node=>node.type==='Text'&&node.create===tablet.bookTitle),'actual persistent book title mounts');
assert.equal([...tablet.nodes.values()].some(node=>node.type==='TextInput'),false,'persistent catalog has no search/tools');
assert.ok(tablet.directoryColumnWidth()>0 && tablet.directoryColumnWidth()<tablet.stageWidth);assert.equal(tablet.widePanel(),true);assert.ok(tablet.panelWidth()>0 && tablet.panelWidth()<tablet.stageWidth);
}
function overlayFixture(values, candidate=source) {
  const properties=createArkUIPropertyRuntimeProbe();
  const shared=mangaSurfaceBoundedControls(properties);
  const probe=createReaderBuilderProbe(candidate,names,{
    ...properties.sdk,...mangaSurfaceSdkDependencies,...shared.deps,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,
    ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
    ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
    LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
    PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
    globalThis:{PanGesture:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
    GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
  },shared.hooks);
  Object.assign(probe.owner,{opened:true,showPageNumbers:true,controlsVisible:false,horizontalPageCount:36,
    panelFontsReady:true,bookTitle:'山海纪行',title:'当前第5话',directoryQuery:'第5',
    viewportWidth:390,viewportHeight:844,stageWidth:390,stageHeight:844,...values});
  probe.owner.initialRender();mountMangaViewportBuilder(probe.owner);
  const nodes=shared.nodes(probe.owner);
  Object.defineProperty(nodes,'owner',{value:probe.owner});
  return nodes;
}
if(selectedCase==='viewport-overlays') {
 for(const chapterEnd of [false,true]) {const nodes=overlayFixture({chapterEnd});const dock=nodes.find(n=>n.type==='Stack'&&n.create?.alignContent==='Alignment.BottomEnd');assert.ok(dock);assert.equal(dock.width,'100%');assert.equal(dock.height,'100%');assert.equal(dock.hitTestBehavior,'HitTestMode.None');assert.ok(nodes.some(n=>n.type==='Text'&&n.create==='1 / 36'));}
 for(const backgroundPreference of ['paper','ink','white']) {const nodes=overlayFixture({controlsVisible:true,backgroundPreference});const progress=nodes.find(n=>n.type==='Slider'&&n.create.min===1);assert.ok(progress);assert.equal(progress.create.max,36);assert.equal(progress.selectedColor,progress.blockColor);assert.equal(nodes.owner.backgroundPreference,backgroundPreference,'rendering cannot rewrite prior preference');}
}
if(selectedCase==='sheet-frame') for(const panel of ['directory','mode','settings','more'])for(const landscape of [false,true]) {
 const nodes=overlayFixture({panel,panelPhase:'open',stageWidth:landscape?844:390,stageHeight:landscape?390:844,viewportWidth:landscape?844:390,viewportHeight:landscape?390:844});const owner=nodes.owner;
 const dock=nodes.find(n=>n.type==='Stack'&&n.create?.alignContent===(owner.widePanel()?'Alignment.End':'Alignment.Bottom'));assert.ok(dock);assert.equal(dock.width,'100%');assert.equal(dock.height,'100%');
 const width=owner.widePanel()?owner.panelWidth():'100%';assert.ok(nodes.some(n=>n.clip===true&&n.width===width),'actual bounded sheet receives its current public width');
 assert.ok(nodes.some(n=>n.type==='Column'&&n.height==='100%'&&typeof n.onClick==='function'),'actual outside dismissal callback remains');
 if(panel==='directory'){const child=[...owner.children.values()].find(c=>c.params?.mangaDisplay===true&&!c.params?.mangaCatalogDisplay);assert.ok(child);assert.equal(child.params.mangaQuickDisplay,true);const footer=[...owner.children.values()].find(c=>typeof c.params?.onHeightChanged==='function'&&Object.hasOwn(c.params,'pagePosition'));assert.ok(footer);footer.params.onHeightChanged(79);assert.equal(owner.quickFooterMeasured,79);assert.ok(!nodes.some(n=>n.type==='TextInput'));}
}
if(selectedCase==='action-safe-frame') for(const panel of ['more','downloads'])for(const landscape of [false,true]) {
 metrics=createDefaultReaderWindowMetrics();metrics.systemInsets=new ReaderInsetsVp(0,38,0,0);metrics.cutoutInsets=new ReaderInsetsVp(32,0,0,0);metrics.gestureInsets=new ReaderInsetsVp(10,0,18,12);metrics.navigationInsets=new ReaderInsetsVp(0,0,28,32);
 const nodes=overlayFixture({panel,panelPhase:'open',stageWidth:landscape?844:390,stageHeight:landscape?390:844,viewportWidth:landscape?844:390,viewportHeight:landscape?390:844});const frame=nodes.find(n=>n.type==='Column'&&n.clip===true&&n.constraintSize?.maxHeight);assert.ok(frame);assert.deepEqual(frame.padding,{left:landscape?0:32,right:28,top:landscape?38:0,bottom:32},'only public right/phone frame consumes explicit physical safe edges');assert.equal(nodes.filter(n=>n.type==='Column'&&n.padding?.bottom===32).length,1);assert.ok(frame.constraintSize.maxHeight<=nodes.owner.stageHeight);assert.equal(nodes.filter(n=>n.type==='Column'&&n.height==='100%'&&typeof n.onClick==='function').length,1,'one outside dismiss layer');
}
function verifyStageWidths(candidate=source) {
 for(const stageWidth of [650,920,1180]) {const widths=[];for(const viewportWidth of [stageWidth-258,200]) {const nodes=overlayFixture({panel:'directory',stageWidth,stageHeight:900,viewportWidth,viewportHeight:900},candidate);const owner=nodes.owner;assert.equal(owner.persistentDirectory(),true);assert.equal(owner.widePanel(),true,'persistent catalog always uses a side panel');widths.push(owner.panelWidth());assert.ok(widths.at(-1)>0&&widths.at(-1)<stageWidth);const child=[...owner.children.values()].find(c=>c.params?.mangaCatalogDisplay===true);assert.ok(child);assert.equal(child.params.query,'','persistent catalog ignores popup search');child.params.fallbackBuilder();const fallback=[...owner.children.values()].find(c=>c.params?.mangaCatalogDisplay===true&&c.params.entries);assert.ok(fallback);assert.equal(fallback.params.query,'');}assert.equal(widths[0],widths[1],'panel width uses complete stage independent of split canvas');}
}
if(selectedCase==='stage-width') {
 verifyStageWidths();function changeMember(name,mutate){const member=component.members.find(n=>n.name?.getText(tree)===name),before=member.getText(tree),after=mutate(before);assert.notEqual(after,before);return source.slice(0,member.getStart(tree))+after+source.slice(member.end);}
 assert.throws(()=>verifyStageWidths(changeMember('panelWidth',t=>t.replaceAll('this.stageWidth','this.viewportWidth'))),/panel width uses complete stage/);
 assert.throws(()=>verifyStageWidths(changeMember('widePanel',t=>t.replace('this.persistentDirectory() || ',''))),/persistent catalog always uses a side panel/);
 assert.throws(()=>verifyStageWidths(changeMember('directoryBody',t=>t.replace("catalog ? '' : this.directoryQuery",'this.directoryQuery'))),/persistent catalog ignores popup search/);
}

}
