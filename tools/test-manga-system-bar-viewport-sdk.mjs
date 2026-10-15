import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {mangaSurfaceSdkDependencies, mountMangaViewportBuilder,mangaSurfaceBoundedControls} from './lib/manga-surface-sdk-probe.mjs';
import {createDefaultReaderWindowMetrics,ReaderInsetsVp,ReaderRectVp,readerInteractiveSafeInsets,readerContentSafeTop} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
const componentMap=require(`${sdk}/lib/component_map.js`);
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../entry/src/main/ets/features/manga/MangaReadingSurface.ets');
const indexSource=read('../entry/src/main/ets/pages/Index.ets');
const shellSource=read('../entry/src/main/ets/features/shell/ReaderShell.ets');
const baseline=read('./fixtures/manga-viewport-r6/MangaReadingSurface.ets');
const indexBaseline=read('./fixtures/manga-viewport-r6/Index.ets');
const sha=text=>createHash('sha256').update(text).digest('hex');
assert.equal(sha(baseline),'f84e5289f30711f31b9c7df2999fdba30dc6af4d175d6100c0e0bfb801ee3448');
assert.equal(sha(indexBaseline),'0e54a722f8bd7da88e50acd021e58f1380cfdd945608b6ea5938ab68962692c5');
function parse(text,name){
 const tree=ts.createSourceFile('/tmp/MangaFullWindowSdk.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(tree.parseDiagnostics,[]);const type=tree.statements.find(n=>n.name?.getText(tree)===name);
 assert.ok(type);return{tree,type,names:type.members.map(n=>n.name?.getText(tree)).filter(Boolean)};
}
const nativeBoundary=new Proxy({}, {get:()=>()=>{}});
const fullExpand=[['SafeAreaType.SYSTEM','SafeAreaType.CUTOUT'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']];
const fullIgnore=[['LayoutSafeAreaType.SYSTEM'],['LayoutSafeAreaEdge.ALL']];
function assertFullWindow(actor,label){
 assert.ok(actor);assert.equal(actor.width,'100%');assert.equal(actor.height,'100%');
 assert.ok(actor.padding===undefined||Object.values(actor.padding).every(value=>value===0),`${label}: image ancestor has no safe-area reservation`);
 assert.deepEqual(actor.expandSafeArea,fullExpand,`${label}: drawing expands through all system/cutout edges`);
 assert.deepEqual(actor.ignoreLayoutSafeArea,fullIgnore,`${label}: layout excludes system safe-area shrinking`);
}
function mangaFixture(text=source,values={}){
 // Each fixture is an independent compilation unit. Use the installed SDK's
 // reset; otherwise its prior unit's literal .id line/column produces a false
 // duplicate warning when the exact baseline has different member positions.
 componentMap.resetComponentMap();
 const {tree,names}=parse(text,'MangaReadingSurface');
 const projection=read('../entry/src/main/ets/features/manga/MangaStripProjection.ts').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
 const Projection=new Function(`${stripTypeScriptTypes(projection)};return MangaStripProjection`)();
 const dataText=tree.statements.find(n=>n.name?.getText(tree)==='MangaStripDataSource').getText(tree);
 const DataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataText)};return MangaStripDataSource`)(Projection);
 const properties=createArkUIPropertyRuntimeProbe(),scrolls=[],areaRequests=[],rows=[];
 const shared=mangaSurfaceBoundedControls(properties);
 let metrics=createDefaultReaderWindowMetrics(),owner,admitted=false;
 metrics.systemInsets=new ReaderInsetsVp(0,48,0,0);metrics.gestureInsets=new ReaderInsetsVp(0,0,0,24);
 metrics.statusBarRect=new ReaderRectVp(0,0,390,48);
 class ListScroller{
  getItemRect(){return{x:0,y:-137,width:585,height:1170};}
  getItemIndex(){return 0;}
  scrollToIndex(...args){scrolls.push(['index',...args]);}scrollBy(...args){scrolls.push(['offset',...args]);}
 }
 class Scroller{currentOffset(){return{xOffset:31,yOffset:0};}scrollTo(...args){scrolls.push(['horizontal',...args]);}}
 const built=createReaderBuilderProbe(text,names,{
  ...properties.sdk,...mangaSurfaceSdkDependencies,...shared.deps,MangaStripDataSource:DataSource,ListScroller,Scroller,PhotoViewScaleModel:class{},
  ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
  ScrollAlign:{START:'start'},ImageFit:{Fill:'fill'},ScrollDirection:{Horizontal:'horizontal'},TouchType:{Down:0},
  LazyForEach:{create(_id,generatedOwner,data,item,key){
   assert.equal(generatedOwner,owner);if(admitted)return;admitted=true;
   const row=data.getData(0),before=owner.observers.length;item(row,0);
   rows.push({row,key:key(row,0),nodes:[...owner.nodes.values()].filter(n=>n.id>=before)});
  },pop(){}},
  Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
  globalThis:{Gesture:nativeBoundary,PanGesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
 // Preserve this probe's existing retained-actor boundary for live controls:
 // native removal of an occupied branch is outside its model. Shared frame,
 // header and action children still mount from their actual production code.
 },{...shared.hooks,allowEmptyBranchAdmission:false});
 owner=built.owner;owner.isReaderIdentityCurrent=()=>false; // Geometry has no native Window owner; order test covers production Window intent.
 const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'c'},manifestVersion:'r7',pages:[{ordinal:0,pageId:'p0'}]};
 owner.controller={chapter:{manifest,chapterIndex:5},tile:()=>({image:{fileUri:'file://r7-ready.png',revision:'pixels'}}),visiblePages:()=>[],
  pageAt:ordinal=>manifest.pages[ordinal],pageGeometry:()=>({width:1000,height:2000,tileHeight:2000})};
 Object.assign(owner,{viewportWidth:390,viewportHeight:844,stageWidth:390,stageHeight:844,zoom:1.5,fitPreference:'width',
  controlsVisible:true,opened:true,title:'当前章',bookTitle:'实际漫画',horizontalPageCount:32,panelFontsReady:true,...values});
 owner.data.projection.publish(manifest,()=>({width:1000,height:2000,tileHeight:2000}));
 owner.visibleAnchor={ordinal:0,y:.11709401709401709,x:.05299145299145299};owner.mounted=true;
 owner.initialRender();mountMangaViewportBuilder(owner);
 const image=rows[0].nodes.find(n=>n.type==='Image'),listItem=rows[0].nodes.find(n=>n.type==='ListItem');
 const scroll=[...owner.nodes.values()].find(n=>n.type==='Scroll');
 const list=[...owner.nodes.values()].find(n=>n.type==='List');
 const stage=[...owner.nodes.values()].find(n=>n.type==='Row'&&typeof n.onAreaChange==='function');
 assert.ok(image&&listItem&&scroll&&list&&stage,'actual emitted LazyForEach callback admits an image and row');
 return{owner,properties,shared,rows,image,listItem,scroll,list,stage,scrolls,areaRequests,output:built.output,
  get metrics(){return metrics;},set metrics(value){metrics=value;},
  flush(){properties.flush();},
  area(){areaRequests.push([390,844]);stage.onAreaChange({}, {width:390,height:844});scroll.onAreaChange({}, {width:390,height:844});properties.flush();}};
}
function verifyManga(text=source){
 const f=mangaFixture(text),root=f.owner.nodes.get(0);assertFullWindow(root,'manga root');
 const nodeIDs=[...f.owner.nodes.keys()],imageID=f.image.id,rowID=f.listItem.id;
 const imageState=()=>({width:f.image.width,height:f.image.height,uri:f.image.create,rowHeight:f.listItem.height,
  viewport:[f.owner.viewportWidth,f.owner.viewportHeight],rowTop:f.owner.rowDisplayTop(f.rows[0].row),
  rowLeft:f.owner.rowDisplayLeft(f.rows[0].row),key:f.owner.rowRenderKey(f.rows[0].row),anchor:{...f.owner.visibleAnchor},
  nativeOffset:f.owner.scroller.getItemRect(),horizontalOffset:f.owner.horizontalScroller.currentOffset()});
 const before=imageState();assert.deepEqual([before.width,before.height,before.rowHeight],[585,1170,1170]);
 function unchanged(){
  f.area();assert.deepEqual(imageState(),before,'bar changes cannot modify the admitted image/row/viewport/anchor/controlled native offset');
  assert.deepEqual(f.scrolls,[],'same full-window Area must not request restore/scroll');
  assert.equal(f.image.id,imageID);assert.equal(f.listItem.id,rowID);assert.deepEqual([...f.owner.nodes.keys()],nodeIDs,'same actors; no image/row remount');
  assertFullWindow(root,'manga root');
 }
 function docks(expected){
  for(const alignment of ['Alignment.Top','Alignment.Bottom']){
   const dock=[...f.owner.nodes.values()].find(n=>n.type==='Stack'&&n.create?.alignContent===alignment);
   assert.deepEqual({...dock.padding},expected,`${alignment}: only interactive overlay consumes current/cached safe bands`);
  }
 }
 docks({left:0,top:48,right:0,bottom:24});unchanged();
 f.owner.toggleControls();f.flush();unchanged(); // delayed native hide area remains positive
 f.metrics.systemInsets=new ReaderInsetsVp();f.metrics.gestureInsets=new ReaderInsetsVp();f.owner.windowMetricsRevision++;f.flush();unchanged();
 f.owner.toggleControls();f.flush();docks({left:0,top:48,right:0,bottom:0});unchanged(); // show ACK precedes positive avoid event
 f.metrics.systemInsets=new ReaderInsetsVp(0,52,0,0);f.metrics.gestureInsets=new ReaderInsetsVp(0,0,0,24);
 f.metrics.statusBarRect=new ReaderRectVp(0,2,390,50);f.owner.windowMetricsRevision++;f.flush();docks({left:0,top:52,right:0,bottom:24});unchanged();
 f.metrics.cutoutInsets=new ReaderInsetsVp(32,0,0,0);f.metrics.navigationInsets=new ReaderInsetsVp(0,0,28,20);
 f.owner.windowMetricsRevision++;f.flush();docks({left:32,top:52,right:28,bottom:24});unchanged();
 f.owner.toggleControls();f.metrics.systemInsets=new ReaderInsetsVp();f.metrics.gestureInsets=new ReaderInsetsVp();f.metrics.navigationInsets=new ReaderInsetsVp();f.metrics.cutoutInsets=new ReaderInsetsVp();
 f.owner.windowMetricsRevision++;f.flush();unchanged();
 return{mangaEmittedSHA:sha(f.output),propertyRuntime:f.properties.source,areaSamples:f.areaRequests.length};
}
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
function indexFixture(text=indexSource){
 componentMap.resetComponentMap();
 const {tree,type,names}=parse(text,'Index'),build=type.members.find(n=>n.name?.getText(tree)==='build');
 const native=new Set(['Stack','Column','Row','Text','Button','Image','Blank','ForEach','If','Scroll','List','ListItem','LoadingProgress','Progress','Flex']);
 const dependencies={};
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text)&&!native.has(node.expression.text)){
  const name=node.expression.text;syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set());dependencies[name]=Child;
 }ts.forEachChild(node,visit);};visit(type);
 const properties=createArkUIPropertyRuntimeProbe(),metrics=createDefaultReaderWindowMetrics();metrics.systemInsets=new ReaderInsetsVp(0,48,0,0);
 const selected=['build','route','readingSessionActive','readingContentKind','directoryReturnTarget','detailBook','readerWindowMetricsRevision',
  'appThemeScheme','readerOwnsWindowEdges','mangaOwnsWindowEdges','appContentTopInset','onSearchVisibilityChanged',
  'applyMangaAdjacentChapter','applyDirectoryChapter',
  ...type.members.filter(n=>ts.getAllDecorators(n).some(d=>d.getText(tree)==='@Builder')).map(n=>n.name.getText(tree))];
 const {owner,output}=createReaderBuilderProbe(text,selected.filter(n=>names.includes(n)),{
  ...properties.sdk,...mangaSurfaceSdkDependencies,...dependencies,ReaderWindowCoordinator:{metrics:()=>metrics},readerContentSafeTop,
  ReaderRuntimeOwner:{current:()=>({setReadingPreparationContext(){},readingEntryPreparations:()=>({setPaused(){}}),bookAcquisitions:()=>({visibilityChanged(){},setPreparationVisible(){}})})},
 },properties.hooks);
 Object.assign(owner,{preparePersistedShelfBooks(){},refreshDetailAcquisitionProjection:async()=>{},consumeSystemFileOpen(){},
  detailBook:undefined,settingsSnapshot:{reduceMotion:false},readingSessionActive:true,readingContentKind:'manga',directoryReturnTarget:'readerControl'});
 owner.route='reading';owner.initialRender();
 return{owner,properties,metrics,root:owner.nodes.get(0),output};
}
function verifyIndex(text=indexSource){
 const f=indexFixture(text),id=f.root.id;assert.equal(f.root.type,'Stack');assert.deepEqual(f.root.padding,{top:0});
 assert.deepEqual(f.root.ignoreLayoutSafeArea,fullIgnore,'Index manga owner must exclude ancestor safe-area shrinking');
 assert.deepEqual(f.root.expandSafeArea,fullExpand);
 for(const top of [0,52,0]){f.metrics.systemInsets=new ReaderInsetsVp(0,top,0,0);f.owner.readerWindowMetricsRevision++;f.properties.flush();
  assert.equal(f.root.id,id);assert.deepEqual(f.root.padding,{top:0});assert.deepEqual(f.root.ignoreLayoutSafeArea,fullIgnore);}
 f.owner.readingContentKind='text';f.properties.flush();assert.deepEqual(f.root.ignoreLayoutSafeArea,[[],[]],'novel retains its own existing layout policy');
 f.owner.readingSessionActive=false;f.metrics.systemInsets=new ReaderInsetsVp(0,48,0,0);f.owner.readerWindowMetricsRevision++;f.properties.flush();
 assert.deepEqual(f.root.padding,{top:48},'ordinary app root still consumes its status band');
 return{indexEmittedSHA:sha(f.output)};
}
function verifyShell(){
 componentMap.resetComponentMap();
 const {tree,type,names}=parse(shellSource,'ReaderShell');
 const native=new Set(['Stack','ForEach','If']);
 const dependencies={};
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text)&&!native.has(node.expression.text)){
  const name=node.expression.text;
  if(!['ReaderPageScaffold','ReaderFixedHeaderHost','ReaderStandardPage'].includes(name)){
   syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set());dependencies[name]=Child;
  }
 }ts.forEachChild(node,visit);};visit(type);
 const properties=createArkUIPropertyRuntimeProbe();
 const {owner,output}=createReaderBuilderProbe(shellSource,names,{
  ...properties.sdk,...mangaSurfaceSdkDependencies,...dependencies,
  ReaderSettingsGateway:class{},ReaderRuntimeOwner:{current:()=>({mangaOfflineProbeFor:()=>false})},
  ReaderWindowCoordinator:{metrics:()=>createDefaultReaderWindowMetrics()},readerWidthClass:()=> 'compact',
 },{...properties.hooks,initialParams:{contentKind:'manga',visible:true,route:'reading'}});
 owner.initialRender();
 const actors=current=>[current,...[...(current.children?.values()??[])].filter(child=>child.nodes).flatMap(actors)];
 const scaffold=actors(owner).find(actor=>actor.params?.variant==='reader');
 assert.ok(scaffold?.nodes,'Shell mounts the actual SDK Scaffold instead of a child seam');
 const root=scaffold.nodes.get(0),id=root.id;assert.equal(root.type,'Stack');assertFullWindow(root,'Shell manga root');
 assert.equal(scaffold.readingContentKind,'manga');assert.equal(root.opacity,1);assert.equal(root.hitTestBehavior,'HitTestMode.Default');
 assert.ok([...owner.children.values()].some(child=>child.params.windowChromeActive===true),'actual Shell Builder admits manga child Props');
 assert.ok(![...owner.nodes.values()].some(node=>node.id==='reader-overlay-status-bar-underlay'),'manga has no second status-paper overlay');
 owner.updateStateVars({contentKind:'text',visible:true,route:'reading'});properties.flush();
 assert.equal(actors(owner).find(actor=>actor.params?.variant==='reader'),scaffold,'kind changes retain the actual native Scaffold owner');
 assert.equal(scaffold.nodes.get(0),root);assert.equal(root.id,id);assert.deepEqual(root.ignoreLayoutSafeArea,[[],[]]);
 assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM']],'novel Shell preserves its previous system-only expansion');
 owner.updateStateVars({contentKind:'manga',visible:true,route:'reading'});properties.flush();assertFullWindow(root,'retained Shell manga root');
 const reader=[...owner.children.values()].find(child=>child.params.windowChromeActive===true);
 owner.updateStateVars({contentKind:'manga',visible:false,route:'reading'});properties.flush();
 assert.equal(scaffold.nodes.get(0),root);assert.equal(root.opacity,0);assert.equal(root.hitTestBehavior,'HitTestMode.Transparent');
 assertFullWindow(root,'hidden retained Shell manga root');
 assert.ok([...owner.children.values()].includes(reader),'hiding cannot remount the reader actor');
 owner.updateStateVars({contentKind:'manga',visible:true,route:'reading'});properties.flush();
 assert.equal(root.opacity,1);assert.equal(root.hitTestBehavior,'HitTestMode.Default');
 assert.equal(scaffold.nodes.get(0),root);assert.ok([...owner.children.values()].includes(reader));
 return{shellEmittedSHA:sha(output)};
}
const mangaEvidence=verifyManga(),indexEvidence=verifyIndex(),shellEvidence=verifyShell();
for(const panel of ['directory','mode','settings','more']){
 const f=mangaFixture(source,{viewportWidth:240,stageWidth:240,viewportHeight:280,stageHeight:280,panel,controlsVisible:false});
 if(panel==='more'){
  const frame=f.shared.walk(f.owner).find(child=>child instanceof f.shared.deps.ReaderBoundedSurface);
  assert.ok(frame,'More mounts the actual shared frame rather than a private Stack');assert.equal(frame.specId,'reader-action-sheet');
  const shell=[...frame.nodes.values()].find(n=>n.type==='Column'&&n.clip===true&&n.width==='100%');
  assert.ok(shell);assert.ok(shell.constraintSize.minHeight<=shell.constraintSize.maxHeight,'short shared phone frame has consistent measured bounds');
  assert.equal(shell.constraintSize.maxHeight,f.owner.panelHeight(),'shared frame ceiling includes its reserved navigation band once');
  assert.equal(shell.constraintSize.minHeight,Math.min(260,f.owner.panelContentHeight())+24);
  assert.deepEqual({...shell.padding},{left:0,top:0,right:0,bottom:24});
  const body=f.shared.nodes(f.owner).find(n=>n.type==='Scroll'&&n.scrollBar==='BarState.Auto');
  assert.ok(body);assert.equal(f.owner.panelContentHeight(),shell.constraintSize.maxHeight-24);
  assert.equal(body.constraintSize.maxHeight,f.owner.panelContentHeight()-70,'action body removes the navigation band and shared phone header once');
 }else{
  const shell=[...f.owner.nodes.values()].find(n=>n.type==='Stack'&&n.clip===true&&n.width==='100%');
  const size=[...f.owner.nodes.values()].find(n=>n.type==='Column'&&n.constraintSize?.maxHeight===f.owner.panelContentHeight());
  assert.ok(shell&&size);assert.ok(size.constraintSize.minHeight<=size.constraintSize.maxHeight,'short phone has consistent measured content bounds');
  assert.equal(size.constraintSize.maxHeight,f.owner.panelHeight()-24);assert.deepEqual({...shell.padding},{left:0,top:0,right:0,bottom:24});
 }
 assertFullWindow(f.owner.nodes.get(0),'short phone image root');
}
{
 const f=mangaFixture(source,{viewportWidth:662,viewportHeight:900,stageWidth:920,stageHeight:900,panel:'directory'});
 f.metrics.cutoutInsets=new ReaderInsetsVp(32,0,0,0);f.owner.windowMetricsRevision++;f.flush();
 const sidebar=[...f.owner.nodes.values()].find(n=>n.type==='Column'&&n.width===258);
 assert.ok(sidebar);assert.equal(sidebar.padding.left,32,'left catalog alone consumes physical left cutout');
 const dock=[...f.owner.nodes.values()].find(n=>n.type==='Stack'&&n.create?.alignContent==='Alignment.Top');
 assert.equal(dock.padding.left,0,'the image/control pane does not re-consume sidebar left cutout');
 const sheet=[...f.owner.nodes.values()].find(n=>n.type==='Stack'&&n.clip===true&&n.width===340);
 assert.ok(sheet);assert.equal(sheet.padding.left,0,'right sheet does not re-consume physical left cutout');
 assert.equal(sheet.padding.top,48);assert.equal(sheet.padding.bottom,24);
 assert.equal(f.owner.panelContentHeight(),900-48-24);assertFullWindow(f.owner.nodes.get(0),'split manga image root');
}
assert.throws(()=>verifyManga(baseline),/image ancestor has no safe-area reservation/,'exact R6 image-padding source fails actual SDK actor assertion');
assert.throws(()=>verifyIndex(indexBaseline),/Index manga owner must exclude ancestor safe-area shrinking/,'exact R6 Index misses actual layout-safe-area ignore request');
console.log(JSON.stringify({sourceSHA:sha(source),indexSHA:sha(indexSource),shellSHA:sha(shellSource),...mangaEvidence,...indexEvidence,...shellEvidence}));
console.log('PASS actual SDK manga root/Index/Shell full-window layout requests, same retained Image/ListItem dimensions and row key/anchor across controls and live avoid/cached-status changes, no restore/scroll request, overlay-only safe padding, short-panel constraints/split-pane projection, novel/app preservation and two exact R6 negative fixtures. Native safe-area expansion, physical bounds/pixels and OS Area delivery remain target acceptance; supplied Area/Scroller inputs are controlled and no layout engine is simulated.');
