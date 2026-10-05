import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
const host=process.argv[2]??'/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913/Reader-for-HarmonyOS';
assert.ok(host.startsWith('/'),'workspace argument must be an absolute Host path');
const load=p=>readFileSync(`${host}/${p}`,'utf8'),sha=v=>createHash('sha256').update(v).digest('hex');
const {createReaderBuilderProbe}=await import(pathToFileURL(`${host}/tools/lib/reader-control-builder-probe.mjs`));
const {createArkUIPropertyRuntimeProbe}=await import(pathToFileURL(`${host}/tools/lib/arkui-property-runtime-probe.mjs`));
const {mangaSurfaceSdkDependencies}=await import(pathToFileURL(`${host}/tools/lib/manga-surface-sdk-probe.mjs`));
const {createDefaultReaderWindowMetrics,ReaderInsetsVp,ReaderRectVp}=await import(pathToFileURL(`${host}/entry/src/main/ets/features/common/ReaderWindowMetrics.ts`));
const require=createRequire(import.meta.url),sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const componentMap=require(`${sdk}/lib/component_map.js`);
const source=load('entry/src/main/ets/features/manga/MangaReadingSurface.ets');
assert.equal(sha(source),'4e8cda54f879494a574de75ab2c85821d02edd96b70bdbf8e3e1085150461676','frozen R7 production source');
const enumPath='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/enums.d.ts';
const enumSource=readFileSync(enumPath,'utf8'),enumTree=ts.createSourceFile(enumPath,enumSource,ts.ScriptTarget.Latest,true);
const declaration=enumTree.statements.find(n=>ts.isEnumDeclaration(n)&&n.name.text==='ImageFit');
assert.ok(declaration);
const enumOutput=ts.transpileModule(declaration.getText(enumTree).replace(/^declare /,''),{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
const ImageFit=new Function(`${enumOutput};return ImageFit`)();
const projectionSource=load('entry/src/main/ets/features/manga/MangaStripProjection.ts');
const Projection=new Function(`${stripTypeScriptTypes(projectionSource.replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,''))};return MangaStripProjection`)();
const parse=text=>ts.createSourceFile('/tmp/MangaOriginSdk.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
const nativeBoundary=new Proxy({}, {get:()=>()=>{}});
const sourceShape={width:1600,height:2667,tileHeight:655}; // controlled geometry; not claimed extracted source dimensions
function fixture(text,fit){
 componentMap.resetComponentMap();
 const tree=parse(text);assert.deepEqual(tree.parseDiagnostics,[]);
 const component=tree.statements.find(n=>n.name?.getText(tree)==='MangaReadingSurface');
 const names=component.members.map(n=>n.name?.getText(tree)).filter(Boolean);
 const data=tree.statements.find(n=>n.name?.getText(tree)==='MangaStripDataSource');
 const Data=new Function('MangaStripProjection',`${stripTypeScriptTypes(data.getText(tree))};return MangaStripDataSource`)(Projection);
 const properties=createArkUIPropertyRuntimeProbe(),scrollRequests=[];let owner,admitted=false,row;
 let metrics=createDefaultReaderWindowMetrics();metrics.systemInsets=new ReaderInsetsVp(0,48,0,0);metrics.statusBarRect=new ReaderRectVp(0,0,390,48);
 class ListScroller{getItemRect(){return{x:0,y:0,width:390,height:390*655/1600};}getItemIndex(){return 0;}scrollToIndex(...a){scrollRequests.push(a);}scrollBy(...a){scrollRequests.push(a);}}
 class Scroller{currentOffset(){return{xOffset:0,yOffset:0};}scrollTo(...a){scrollRequests.push(a);}}
 const probe=createReaderBuilderProbe(text,names,{
  ...properties.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource:Data,ListScroller,Scroller,PhotoViewScaleModel:class{},ImageFit,
  ReaderWindowCoordinator:{metrics:()=>metrics},ScrollAlign:{START:'start'},ScrollDirection:{Horizontal:'horizontal'},TouchType:{Down:0},
  LazyForEach:{create(_id,generatedOwner,data,render,key){assert.equal(generatedOwner,owner);if(admitted)return;admitted=true;row=data.getData(0);assert.ok(key(row,0));render(row,0);},pop(){}},
  Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary,
  globalThis:{Gesture:nativeBoundary,PanGesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,TapGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
 },properties.hooks);
 owner=probe.owner;owner.isReaderIdentityCurrent=()=>false;
 const manifest={manifestVersion:'controlled-origin-v1',chapter:{sourceId:'s',bookId:'b',chapterId:'c'},displayHints:{fit:'width'},pages:[{ordinal:0,pageId:'p0'}]};
 owner.controller={chapter:{manifest,chapterIndex:0},tile:()=>({image:{fileUri:'file://controlled-exact-region-0.png',revision:'controlled-tile'}}),visiblePages:()=>[],pageAt:()=>manifest.pages[0],pageGeometry:()=>sourceShape};
 Object.assign(owner,{viewportWidth:390,viewportHeight:844,stageWidth:390,stageHeight:844,zoom:1,fitPreference:fit,opened:true,controlsVisible:true,title:'实际生产链',horizontalPageCount:1});
 owner.data.projection.publish(manifest,()=>sourceShape);owner.visibleAnchor={ordinal:0,y:0,x:0};owner.mounted=true;owner.initialRender();
 const nodes=[...owner.nodes.values()],root=nodes[0],stage=nodes.find(n=>n.type==='Row'&&n.onAreaChange),canvas=nodes.find(n=>n.type==='Stack'&&n.create?.alignContent==='Alignment.Center'),scroll=nodes.find(n=>n.type==='Scroll'),list=nodes.find(n=>n.type==='List'),item=nodes.find(n=>n.type==='ListItem'),image=nodes.find(n=>n.type==='Image'&&n.create==='file://controlled-exact-region-0.png');
 assert.ok(root&&stage&&canvas&&scroll&&list&&item&&image);
 return{owner,properties,root,stage,canvas,scroll,list,item,image,row,scrollRequests,output:probe.output,
  updateAvoid(top,bottom){metrics.systemInsets=new ReaderInsetsVp(0,top,0,0);metrics.gestureInsets=new ReaderInsetsVp(0,0,0,bottom);owner.windowMetricsRevision++;properties.flush();},
  flush(){properties.flush();}};
}
function noOffset(actor){
 for(const property of ['padding','margin','translate','offset','position','transform','renderFit','aspectRatio','objectPosition'])
  assert.equal(actor[property],undefined,`${actor.type}: no artificial ${property}`);
}
function verify(text,fit){
 const f=fixture(text,fit);
 for(const actor of [f.root,f.stage,f.canvas,f.scroll,f.list,f.item,f.image])noOffset(actor);
 assert.equal(f.image.objectFit,ImageFit.Fill,'actual SDK Image uses platform Fill, without contain/letterbox');
 assert.equal(f.image.draggable,false);assert.equal(f.list.create.space,0);
 assert.equal(f.row.ordinal,0);assert.equal(f.row.tileIndex,0);assert.equal(f.row.sourceY,0,'actual production Projection selects normalized source origin');
 assert.equal(f.owner.effectiveFit(),'width');assert.equal(f.owner.rowDisplayTop(f.row),0,'first row has no centering band');
 assert.equal(f.owner.rowDisplayLeft(f.row),0);
 assert.equal(f.image.width,f.owner.rowDisplayWidth(f.row));assert.equal(f.image.height,f.owner.rowDisplayHeight(f.row));
 assert.equal(f.item.height,f.image.height,'row and Image have identical heights');
 const before={actors:[f.image.id,f.item.id,f.scroll.id,f.list.id],uri:f.image.create,width:f.image.width,height:f.image.height,itemHeight:f.item.height,
  top:f.owner.rowDisplayTop(f.row),left:f.owner.rowDisplayLeft(f.row),sourceY:f.row.sourceY,viewport:[f.owner.viewportWidth,f.owner.viewportHeight],key:f.owner.rowRenderKey(f.row),anchor:{...f.owner.visibleAnchor}};
 for(const [top,bottom,controls]of [[48,24,false],[0,0,false],[0,0,true],[52,24,true],[0,0,false]]){
  if(f.owner.controlsVisible!==controls)f.owner.toggleControls();f.flush();f.updateAvoid(top,bottom);
  // Native Area/Scroller inputs are controlled full-window values. This tests
  // production callbacks/requests, never substitutes a physical layout engine.
  f.stage.onAreaChange({}, {width:390,height:844});f.scroll.onAreaChange({}, {width:390,height:844});f.flush();
  for(const actor of [f.root,f.stage,f.canvas,f.scroll,f.list,f.item,f.image])noOffset(actor);
  assert.equal(f.image.objectFit,ImageFit.Fill);
  assert.deepEqual({actors:[f.image.id,f.item.id,f.scroll.id,f.list.id],uri:f.image.create,width:f.image.width,height:f.image.height,itemHeight:f.item.height,
   top:f.owner.rowDisplayTop(f.row),left:f.owner.rowDisplayLeft(f.row),sourceY:f.row.sourceY,viewport:[f.owner.viewportWidth,f.owner.viewportHeight],key:f.owner.rowRenderKey(f.row),anchor:{...f.owner.visibleAnchor}},before,'control/avoid changes preserve the exact admitted row/image requests');
  assert.deepEqual(f.scrollRequests,[],'no restore/reflow scroll request');
 }
 return{fit,firstRow:before,emittedSHA256:sha(f.output),propertyRuntime:f.properties.source};
}
const cases=['source','width'].map(fit=>verify(source,fit));
const target='.objectFit(ImageFit.Fill)';assert.equal(source.split(target).length,2,'narrow mutation has one real Image target');
const margin=source.replace(target,'.margin({ top: 24 }).objectFit(ImageFit.Fill)');
assert.throws(()=>verify(margin,'width'),/Image: no artificial margin/,'actual SDK lowering kills introduced Image top margin');
const contain=source.replace(target,'.objectFit(ImageFit.Contain)');
assert.throws(()=>verify(contain,'source'),/platform Fill/,'actual SDK lowering kills changed native fit request');
console.log(JSON.stringify({sourceSHA256:sha(source),projectionSHA256:sha(projectionSource),sdkEnums:{path:enumPath,sha256:sha(enumSource),ImageFit},
 cases,negativeControls:[{mutation:'actual Image margin.top=24',result:'rejected by emitted native actor'},{mutation:'actual Image objectFit Contain',result:'rejected by emitted native actor'}],
 boundary:'Actual SDK compiler and property classes execute production Builders/geometry/Projection. Native Area/Scroller controlled. Origin is a production mapping request, not native paint/pixel proof. No extracted source/tile bytes have been associated yet.'},null,2));
console.log('PASS actual SDK Image-origin request: source/width first tile sourceY/top/left=0, Fill, no padding/margin/offset/translate on seven image-path actors, same admitted actors/geometry/URI across controls/avoid facts; two narrow real-source negative controls rejected.');
