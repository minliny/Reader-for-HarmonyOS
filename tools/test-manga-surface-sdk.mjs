import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {createDefaultReaderWindowMetrics, ReaderInsetsVp, readerInteractiveSafeInsets} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const require=createRequire(import.meta.url);
const sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const tree=ts.createSourceFile('/tmp/MangaReadingSurface.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const component=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(node=>node.name?.getText(tree)).filter(Boolean);
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const MangaStripProjection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSource=tree.statements.find(node=>node.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const MangaStripDataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataSource)};return MangaStripDataSource`)(MangaStripProjection);
const runtime=createArkUIPropertyRuntimeProbe();
const scrolls=[];
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
  const probe=createReaderBuilderProbe(candidate,['imageViewport','toggleControls'],{
    TapGesture:tap,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,
    globalThis:{Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:tap},
    LazyForEach:nativeBoundary,ScrollDirection:{Horizontal:0},GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
  });
  Object.assign(probe.owner,{viewportWidth:390,zoom:1,panel:'',chapterEnd:false,controlsVisible:false});
  probe.owner.imageViewport();
  assert.equal(taps.length,1,'the actual viewport registers one native tap recognizer');
  assert.deepEqual(taps[0].options,{count:1,distanceThreshold:6},'the SDK-emitted full-screen tap must bound movement to 6vp');
  assert.equal(typeof taps[0].callback,'function');
  taps[0].callback();assert.equal(probe.owner.controlsVisible,true,'a recognized normal tap still opens controls');
  taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'a second recognized normal tap still closes controls');
  probe.owner.panel='directory';taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'a presented panel retains its existing tap fence');
  probe.owner.panel='';probe.owner.chapterEnd=true;taps[0].callback();assert.equal(probe.owner.controlsVisible,false,'chapter-end presentation retains its existing tap fence');
}
const gestureDeclarations=ts.createSourceFile('gesture.d.ts',readFileSync(`${sdk}/../../component/gesture.d.ts`,'utf8'),ts.ScriptTarget.Latest,true);
const tapParameters=gestureDeclarations.statements.find(node=>node.name?.getText(gestureDeclarations)==='TapGestureParameters');
assert.ok(tapParameters.members.some(node=>node.name?.getText(gestureDeclarations)==='distanceThreshold'),
  'the installed official SDK declares the native movement threshold');
checkViewportTap();
const unrestrictedTap=source.replace('TapGesture({ count: 1, distanceThreshold: 6 })','TapGesture({ count: 1 })');
assert.notEqual(unrestrictedTap,source);
assert.throws(()=>checkViewportTap(unrestrictedTap),/full-screen tap must bound movement/,
  'the old unrestricted native constructor is rejected without modeling touch recognition');
console.log('PASS actual SDK viewport Tap constructor distanceThreshold=6vp, normal toggle callback and existing panel/end fences; unrestricted constructor counterfactual rejected. Native swipe/tap arbitration requires VM evidence.');
const {owner,output}=createReaderBuilderProbe(source,names,{
  ...runtime.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,
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
owner.initialRender();
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
console.log('PASS actual SDK full-window image root and overlay-only safe padding with live window revision: portrait status/gesture, asymmetric landscape and cleared insets (native layout not tested)');
owner.mounted=true;owner.opened=true;owner.viewportWidth=500;
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/c'},manifestVersion:'sdk-v1',pages:[{ordinal:0,pageId:'a'}]};
owner.data.projection.publish(manifest,()=>({width:1000,height:4000,tileHeight:1000}));
let resolve;let saved;
owner.controller={chapter:{manifest},pageAt:ordinal=>manifest.pages[ordinal],savePosition:async(...args)=>{saved=args;await new Promise(r=>resolve=r);}};
let completed=false;const saving=owner.saveVisible().then(()=>{completed=true;});
await new Promise(r=>setImmediate(r));assert.equal(completed,false);assert.deepEqual(saved,[0,0,0.05]);
resolve();await saving;assert.equal(completed,true);
owner.restore(0,0.75);owner.aboutToDisappear=()=>{owner.mounted=false;owner.layoutGeneration++;};owner.aboutToDisappear();
await new Promise(r=>setTimeout(r,5));assert.equal(scrolls.length,0);
console.log('PASS actual ArkUI SDK surface lowering; save waits for CAS; disposed layout cannot scroll (native paint not tested)');

const tabletRuntime=createArkUIPropertyRuntimeProbe();
const tablet=createReaderBuilderProbe(source,names,{
  ...tabletRuntime.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,
  ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
  LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
  PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
  globalThis:{PanGesture:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},tabletRuntime.hooks).owner;
tablet.stageWidth=1180;tablet.stageHeight=820;tablet.viewportWidth=860;tablet.viewportHeight=820;
tablet.panelFontsReady=true;tablet.bookTitle='山海纪行';tablet.directoryQuery='第5';
tablet.initialRender();
const directoryChild=[...tablet.children.values()].find(child=>child.params.mangaDisplay===true);
assert.ok(directoryChild,'the real SDK mounts the shared native directory outside control visibility');
assert.equal(directoryChild.params.currentChapterIndex,-1);
assert.equal(directoryChild.params.chapterStartBookmarkCreationEnabled,false);
assert.equal(directoryChild.params.query,'','persistent catalog ignores the popup search');
assert.equal(directoryChild.params.mangaCatalogDisplay,true);assert.equal(directoryChild.params.mangaCatalogNarrow,false);
assert.equal(directoryChild.params.mangaCurrentOpenInset,50);assert.equal(directoryChild.params.listPaddingY,0);
const catalogHeader=[...tablet.nodes.values()].find(node=>node.type==='Column'&&node.constraintSize?.minHeight===80);
assert.ok(catalogHeader);assert.deepEqual(catalogHeader.constraintSize,{minHeight:80});
assert.equal(catalogHeader.height,undefined,'persistent header preserves its80vp minimum while allowing scaled text to grow');
assert.deepEqual(catalogHeader.padding,{top:20,left:19,right:19,bottom:16});
const bookHeading=[...tablet.nodes.values()].find(node=>node.type==='Text'&&node.create==='山海纪行');
assert.equal(bookHeading.fontFamily,'ReaderNotoSerifSCBold');assert.equal(bookHeading.fontSize,18);assert.equal(bookHeading.lineHeight,26);assert.equal(bookHeading.fontWeight,700);
assert.ok([...tablet.nodes.values()].some(node=>node.type==='Text'&&node.create==='章节目录'&&node.fontSize===10&&node.lineHeight===17&&node.fontFamily==='ReaderNotoSansSCUIRegular'));
assert.equal([...tablet.nodes.values()].some(node=>node.type==='TextInput'),false,'persistent catalog has no search/tools');
assert.ok([...tablet.nodes.values()].some(node=>node.type==='Column'&&node.width===258&&node.height==='100%'),
  'persistent directory owns a bounded left column');
assert.ok([...tablet.nodes.values()].some(node=>node.type==='Stack'&&node.layoutWeight===1&&node.height==='100%'),
  'image/control stage owns the remaining width');
assert.equal(tablet.widePanel(),true);assert.equal(tablet.panelWidth(),340);
assert.equal(tablet.panelHeight(),820);
console.log('PASS actual SDK tablet directory mounts while controls are hidden, bounded left column and independent right-panel geometry (native paint not tested)');

function overlayFixture(values, candidate=source) {
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(candidate,names,{
    ...properties.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,
    ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
    ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
    LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
    PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
    globalThis:{PanGesture:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
    GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
  },properties.hooks);
  Object.assign(probe.owner,{opened:true,showPageNumbers:true,controlsVisible:false,horizontalPageCount:36,
    panelFontsReady:true,bookTitle:'山海纪行',title:'当前第5话',directoryQuery:'第5',
    viewportWidth:390,viewportHeight:844,stageWidth:390,stageHeight:844,...values});
  probe.owner.initialRender();
  const nodes=[...probe.owner.nodes.values()];
  Object.defineProperty(nodes,'owner',{value:probe.owner});
  return nodes;
}
for(const chapterEnd of [false,true]) {
  const nodes=overlayFixture({chapterEnd});
  const badgeDock=nodes.find(node=>node.type==='Stack'&&node.create?.alignContent==='Alignment.BottomEnd');
  assert.ok(badgeDock,'collapsed and chapter-end page badges have a real bottom-right placement owner');
  assert.equal(badgeDock.width,'100%');assert.equal(badgeDock.height,'100%');
  assert.equal(badgeDock.hitTestBehavior,'HitTestMode.None','badge placement cannot block any image or end-card interaction');
  const badge=nodes.find(node=>node.type==='Text'&&node.create==='1 / 36');
  assert.ok(badge);assert.equal(badge.align,undefined,'self-content alignment cannot position a badge in its parent');
  assert.deepEqual(badge.margin,chapterEnd?{right:12,bottom:12}:12,'approved edge spacing remains unchanged');
  if(chapterEnd){
    assert.ok(nodes.some(node=>node.type==='Stack'&&node.create?.alignContent==='Alignment.Bottom'&&node.height==='100%'));
    assert.ok(nodes.some(node=>node.type==='Column'&&node.height==='100%'&&node.padding?.bottom===48),'end card retains its full-height Column and existing bottom clearance');
  }
}
for(const panel of ['directory','mode','settings','more']) for(const backgroundPreference of ['paper','ink']) for(const landscape of [false,true]) {
  const nodes=overlayFixture({panel,backgroundPreference,viewportWidth:landscape?844:390,viewportHeight:landscape?390:844,
    stageWidth:landscape?844:390,stageHeight:landscape?390:844});
  const panelDock=nodes.find(node=>node.type==='Stack'&&node.create?.alignContent===(landscape?'Alignment.End':'Alignment.Bottom'));
  assert.ok(panelDock,'existing panel alignment remains an explicit Stack child placement');
  assert.equal(panelDock.width,'100%');assert.equal(panelDock.height,'100%');
  const sheet=nodes.find(node=>node.type==='Stack'&&node.width===(landscape?320:'100%')&&node.clip===true);
  assert.ok(sheet,'bounded side panel / full-width phone sheet owns clipping');
  assert.deepEqual(sheet.borderRadius,{topLeft:landscape?0:22,topRight:landscape?0:22,bottomLeft:0,bottomRight:0});
  assert.deepEqual(sheet.border,landscape?{width:{left:1},color:backgroundPreference==='ink'?'#3B4036':'#E7E0D5'}:undefined,
    'wide panel has the demo separating line and phone sheet has no frame');
  assert.equal(sheet.backgroundColor,backgroundPreference==='ink'?'#282C25':'#FFFCF8');
  const sizeOwner=nodes.find(node=>node.type==='Column'&&node.constraintSize?.minHeight===(landscape?0:260));
  assert.equal(sizeOwner.height,landscape?390:undefined,'phone height is measured from actual content');
  assert.equal(sizeOwner.constraintSize.maxHeight,landscape?390:Math.round(844*(panel==='directory'?.78:panel==='more'?.5:.67)));
  assert.equal(nodes.some(node=>node.type==='Column'&&node.width===42&&node.height===5),!landscape,'only phone has the demo grabber');
  assert.ok(nodes.some(node=>node.type==='Row'&&node.width===(landscape?34:36)&&node.height===(landscape?34:36)&&
    node.accessibilityText===(landscape?'关闭宽屏面板':'关闭面板')),'close cross has an explicit touch target');
  if(landscape){
    const header=nodes.find(node=>node.type==='Row'&&(panel==='directory'?node.constraintSize?.minHeight===66:node.height===66));
    assert.ok(header);assert.deepEqual(header.padding,{top:panel==='directory'?12:0,bottom:panel==='directory'?12:0},
      'directory title grows with vertical padding while its line remains inside the horizontal inset wrapper');
    if(panel==='directory') { assert.equal(header.height,undefined);assert.deepEqual(header.constraintSize,{minHeight:66}); }
    const headerInset=nodes.find(node=>node.type==='Column'&&node.padding?.left===20&&node.margin?.bottom===17);
    assert.ok(headerInset);assert.deepEqual(headerInset.padding,{left:20,right:20});assert.deepEqual(headerInset.margin,{bottom:17});
    assert.equal(headerInset.height,panel==='directory'?undefined:66);
    const title=nodes.slice(nodes.indexOf(sheet)+1).find(node=>node.type==='Text'&&node.create===({directory:'章节目录',mode:'阅读方式',settings:'漫画阅读设置',more:'更多'}[panel]));
    assert.equal(title.fontSize,15);assert.equal(title.lineHeight,24);assert.equal(title.fontWeight,600);
    assert.equal(title.fontFamily,'ReaderMangaSans600');
  }
  assert.ok(nodes.some(node=>node.type==='Column'&&node.width==='100%'&&node.height==='100%'&&
    node.backgroundColor===(landscape?'Color.Transparent':'#57000000')&&typeof node.onClick==='function'),
    'phone dim / wide transparent outside dismissal');
  if(panel==='directory'){
    assert.ok(!nodes.some(node=>node.type==='TextInput'),'quick directory follows the nearby-chapter demo toolbar');
    assert.equal(nodes.filter(node=>['上一章节','完整目录','下一章节'].includes(node.accessibilityText)).length,3,
      'phone and wide quick panels both expose chapter and full-directory navigation');
    const child=[...nodes.owner.children.values()].find(child=>child.params.mangaDisplay===true&&!child.params.mangaCatalogDisplay);
    assert.ok(child);assert.equal(child.params.mangaRowMinHeight,58);assert.equal(child.params.mangaQuickDisplay,true);
    assert.equal(child.params.mangaCurrentOpenInset,landscape?7:50);
    const body=nodes.find(node=>node.type==='Column'&&node.padding?.bottom===(landscape?22:24)&&node.padding?.left===(landscape?12:18));
    assert.ok(body,'directory respects adaptive negative margins');
    const footer=[...nodes.owner.children.values()].find(child=>typeof child.params?.onHeightChanged==='function'&&Object.hasOwn(child.params,'pagePosition'));
    assert.ok(footer,'the SDK registers and constructs the real imported footer contract at the child boundary');
    assert.equal(footer.params.title,'当前第5话');assert.equal(footer.params.pagePosition,'');
    assert.equal(footer.params.scheme,backgroundPreference==='ink'?'night':'day');
    assert.equal(footer.params.availableWidth,landscape?296:354,'footer receives the actual quick body width');
    footer.params.onHeightChanged(79);assert.equal(nodes.owner.quickFooterMeasured,79,
      'the imported child boundary delivers its actual measured-height callback to the parent state');
  }
  if(panel==='mode') {
    assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='横向分页'));
    assert.equal(nodes.filter(node=>node.type==='Row'&&node.height===43&&node.layoutWeight===1&&node.borderRadius===12).length,2);
    assert.equal(nodes.filter(node=>node.type==='Row'&&node.height===46&&node.border?.width?.bottom===1).length,3);
    assert.ok(!nodes.some(node=>node.type==='Button'&&['−','+'].includes(node.create?.label??node.create)),'demo mode sheet does not add zoom buttons');
  }
}
console.log('PASS actual SDK four demo sheets: paper/ink, natural phone height + per-panel caps, landscape bounds, grabber/close, paired mode choices and separated fit rows (native layout not tested)');

// The side panel is sized against the whole reader, not the split image canvas.
function verifyStageWidths(candidate=source) {
 for(const [stageWidth,viewportWidth,columnWidth,panelWidth,inset] of [[1180,922,258,340,20],[920,662,258,340,20],[800,542,258,340,20],[650,482,168,320,16]]) {
  const nodes=overlayFixture({panel:'directory',stageWidth,stageHeight:900,viewportWidth,viewportHeight:900},candidate);
  assert.equal(nodes.owner.persistentDirectory(),true);assert.equal(nodes.owner.widePanel(),true,'persistent catalog always uses a side panel');
  assert.equal(nodes.owner.panelWidth(),panelWidth,'panel width uses the complete stage');
  assert.ok(nodes.some(node=>node.type==='Column'&&node.width===columnWidth&&node.height==='100%'));
  const header=nodes.find(node=>node.type==='Row'&&node.constraintSize?.minHeight===66);
  assert.ok(header);assert.equal(header.height,undefined,'wide directory title grows naturally beyond its66vp minimum');
  assert.deepEqual(header.padding,{top:12,bottom:12},'line spans the full horizontal inset content width');
  const headerInset=nodes.find(node=>node.type==='Column'&&node.padding?.left===inset&&node.margin?.bottom===17);
  assert.deepEqual(headerInset.padding,{left:inset,right:inset});
  assert.equal(headerInset.height,undefined);
  assert.ok(!nodes.some(node=>node.type==='Column'&&node.width===42&&node.height===5));
  assert.ok(!nodes.some(node=>node.type==='TextInput'),'wide directory has no phone search/tools');
  const child=[...nodes.owner.children.values()].find(child=>child.params.mangaCatalogDisplay===true);
  assert.equal(child.params.query,'');assert.equal(child.params.mangaCatalogNarrow,stageWidth<=700);
  child.params.fallbackBuilder();
  const fallback=[...nodes.owner.children.values()].find(child=>child.params.mangaCatalogDisplay===true&&child.params.entries);
  assert.ok(fallback);assert.equal(fallback.params.query,'');assert.equal(fallback.params.mangaCatalogNarrow,stageWidth<=700);assert.equal(fallback.params.currentOpenInset,50);
  const heading=nodes.find(node=>node.type==='Text'&&node.create==='山海纪行');
  assert.equal(heading.fontSize,stageWidth<=700?16:18);
 }
}
verifyStageWidths();
const shortPanel=overlayFixture({panel:'mode',stageWidth:844,stageHeight:230,viewportWidth:844,viewportHeight:230});
assert.ok(shortPanel.some(node=>node.type==='Column'&&node.height===230&&node.constraintSize?.minHeight===0&&node.constraintSize?.maxHeight===230),
 'short landscape never combines min260 with max230');
function changeMember(name, mutate) {
 const member=component.members.find(node=>node.name?.getText(tree)===name);
 const before=member.getText(tree),after=mutate(before);assert.notEqual(after,before);
 return source.slice(0,member.getStart(tree))+after+source.slice(member.end);
}
assert.throws(()=>verifyStageWidths(changeMember('panelWidth',text=>text.replaceAll('this.stageWidth','this.viewportWidth'))),/panel width uses the complete stage/,
 'split-canvas percentage is rejected by real stage/main-size fixtures');
assert.throws(()=>verifyStageWidths(changeMember('widePanel',text=>text.replace('this.persistentDirectory() || ',''))),/persistent catalog always uses a side panel/,
 'a narrow split canvas cannot turn a persistent tablet into a phone sheet');
assert.throws(()=>verifyStageWidths(changeMember('directoryBody',text=>text.replace("catalog ? '' : this.directoryQuery",'this.directoryQuery'))),/strictly equal/,
 'persistent catalog cannot inherit popup search');
// Theme requests keep the existing progress range and seek owner.
for(const backgroundPreference of ['paper','ink','white']) {
  const nodes=overlayFixture({controlsVisible:true,backgroundPreference});
  const progress=nodes.find(node=>node.type==='Slider'&&node.create.min===1);
  assert.ok(progress);assert.equal(progress.create.max,36);
  assert.equal(progress.selectedColor,backgroundPreference==='ink'?'#ABC39E':'#1F3528');
  assert.equal(progress.blockColor,progress.selectedColor);
  assert.equal(progress.trackColor,backgroundPreference==='ink'?'#3B4036':'#E7E0D5');
}
console.log('PASS actual SDK responsive catalog/header/search admission, stage 1180/922,920/662,800/542,650/482, wide negative margins and day/night progress accent (native layout/paint not tested)');
