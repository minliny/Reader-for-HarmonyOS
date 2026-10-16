import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import { mangaSurfaceSdkDependencies, mountMangaViewportBuilder } from './lib/manga-surface-sdk-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {createDefaultReaderWindowMetrics,readerInteractiveSafeInsets} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {mangaUserError} from '../entry/src/main/ets/features/manga/MangaUserError.ts';

const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const sdk=resolveEtsLoaderRoot();
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile(virtualFilePath('MangaRenderKeyProbe.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const component=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(node=>node.name?.getText(tree)).filter(Boolean);
// Verify the actual production syncLoad argument against the official Image
// declaration as well as executing its SDK-emitted Builder property below.
const imageBuilder=component.members.find(node=>node.name?.getText(tree)==='imageViewport');
const tileImageBuilder=component.members.find(node=>node.name?.getText(tree)==='tileImage');
let delegatesLocalImage=false;
function findTileImage(node){
  if(ts.isCallExpression(node)&&node.expression?.name?.text==='tileImage')delegatesLocalImage=true;
  ts.forEachChild(node,findTileImage);
}
findTileImage(imageBuilder);assert.equal(delegatesLocalImage,true,'viewport delegates its ready lease to the actual tile Image Builder');
const syncArguments=[];
function findSyncLoad(node){
  if(ts.isCallExpression(node)&&node.expression?.name?.text==='syncLoad')syncArguments.push(node.arguments[0].getText(tree));
  ts.forEachChild(node,findSyncLoad);
}
findSyncLoad(tileImageBuilder);assert.deepEqual(syncArguments,['true']);
const officialChecker=require(`${sdk}/lib/ets_checker.js`);
const typePath=virtualFilePath('MangaLocalImageSyncType.ts');
const typeOptions={...officialChecker.compilerOptions,
  ets:{...officialChecker.compilerOptions.ets,libs:[`${sdk}/declarations/index-full.d.ts`]},
  target:ts.ScriptTarget.ES2021,lib:['lib.es2021.d.ts'],module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.NodeJs,
  strict:true,noEmit:true,skipLibCheck:true,allowNonTsExtensions:true};
function imageArgumentDiagnostics(argument){
  const host=ts.createCompilerHost(typeOptions),original=host.getSourceFile,exists=host.fileExists;
  host.fileExists=path=>path===typePath||exists(path);
  host.getSourceFile=(path,version,...rest)=>{
    const file=path===typePath?ts.createSourceFile(path,`Image('file://prepared-display.png').syncLoad(${argument});`,version,true,ts.ScriptKind.TS,typeOptions):original(path,version,...rest);
    if(file)file.version='1';return file;
  };
  const program=ts.createSemanticDiagnosticsBuilderProgram([typePath,`${sdk}/../../component/image.d.ts`,...officialChecker.readDeaclareFiles()],typeOptions,host);
  return program.getSyntacticDiagnostics().concat(program.getSemanticDiagnostics()).filter(item=>item.file?.fileName===typePath)
    .map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,' ')}));
}
assert.deepEqual(imageArgumentDiagnostics(syncArguments[0]),[],'production Image.syncLoad argument passes formal SDK semantics');
assert.ok(imageArgumentDiagnostics("'async'").some(item=>item.code===2345),'the official Image declaration rejects an invalid synchronous-loading argument');
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSourceText=tree.statements.find(node=>node.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const DataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataSourceText)};return MangaStripDataSource`)(Projection);
const properties=createArkUIPropertyRuntimeProbe();
const boundary=new Proxy({}, {get:()=>()=>{}});
class ListScroller {getItemRect(){return {x:0,y:0};}scrollToIndex(){}scrollBy(){}}
class Scroller {currentOffset(){return {xOffset:0};}scrollTo(){}}
let owner,lazy;
// This deliberately models only the documented stable-key retention boundary.
// Actual SDK-emitted item/key callbacks execute unmodified; no native ArkUI
// scheduling, row removal, layout, ImageKit or rendered pixels are claimed.
class RetainedItems {
  constructor(data,item,key){this.data=data;this.item=item;this.key=key;this.visible=[0];this.rows=new Map();this.mounts=0;}
  reconcile(indices=this.visible){
    for(const index of indices){
      const row=this.data.getData(index),key=this.key(row,index),old=this.rows.get(index);
      if(old?.key===key)continue;
      const before=owner.observers.length;
      this.item(row,index);this.mounts++;
      const nodes=[...owner.nodes.values()].filter(node=>node.id>=before);
      const listItem=nodes.find(node=>node.type==='ListItem');
      this.rows.set(index,{key,businessKey:row.key,known:row.known,listItem,nodes});
    }
  }
  onDataReloaded(){this.reconcile();}
  onDataChange(index){if(this.visible.includes(index))this.reconcile([index]);}
}
const built=createReaderBuilderProbe(source,names,{
  ...properties.sdk,...mangaSurfaceSdkDependencies,MangaStripDataSource:DataSource,ListScroller,Scroller,PhotoViewScaleModel:class {},
  ReaderWindowCoordinator:{metrics:()=>createDefaultReaderWindowMetrics()},readerInteractiveSafeInsets,mangaUserError,
  hilog:{warn(){},error(){}},
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},TouchType:{Down:0,Up:1},
  LazyForEach:{create(_id,generatedOwner,data,item,key){assert.equal(generatedOwner,owner);assert.equal(typeof item,'function');assert.equal(typeof key,'function');
    if(lazy===undefined){lazy=new RetainedItems(data,item,key);data.registerDataChangeListener(lazy);}lazy.reconcile();},pop(){}},
  Gesture:boundary,GestureGroup:boundary,PinchGesture:boundary,SwipeGesture:boundary,TapGesture:boundary,
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},properties.hooks);
owner=built.owner;
assert.match(built.output,/LazyForEach\.create/,'execute the compiler-emitted callback registration');
const manifest={manifestVersion:'test-v1',pages:Array.from({length:3},(_,ordinal)=>({ordinal,pageId:`page-${ordinal}`,resourceRef:`manga:page-${ordinal}`}))};
const geometry=new Map(),tiles=new Map(),pages=new Map([[0,{ordinal:0,status:'pending'}]]);
owner.controller={tile:(ordinal,index)=>tiles.get(`${ordinal}:${index}`),visiblePages:()=>[...pages.values()],
  chapter:{manifest,chapterTitle:'Fixture'},totalPages:3,displayedOrdinal:0,recoveryRequired:false,savedLocation:null,
  pageGeometry:ordinal=>geometry.get(ordinal),pageAt:ordinal=>manifest.pages[ordinal]};
owner.viewportWidth=300;owner.viewportHeight=600;
const project=()=>owner.data.projection.publish(manifest,index=>geometry.get(index),undefined,3,index=>manifest.pages[index]);
const notify=()=>owner.data.notify(project(),0,0);
const priorGesture=globalThis.Gesture;globalThis.Gesture=boundary;
try {project();owner.initialRender();mountMangaViewportBuilder(owner);} finally {if(priorGesture===undefined)delete globalThis.Gesture;else globalThis.Gesture=priorGesture;}
assert.ok(lazy);
const frame=()=>lazy.rows.get(0),has=type=>frame().nodes.some(node=>node.type===type);
const originalBusinessKey=frame().businessKey;
assert.equal(frame().known,false);assert.equal(frame().listItem.height,400);assert.ok(has('LoadingProgress'));
const pendingKey=frame().key;
geometry.set(0,{width:600,height:1800,tileHeight:600});pages.set(0,{ordinal:0,status:'ready'});notify();
assert.notEqual(frame().key,pendingKey,'placeholder to real geometry must replace a retained same-key item');
assert.equal(frame().known,true);assert.equal(frame().listItem.height,300,'the actual SDK ListItem uses the new row geometry');
assert.equal(typeof frame().listItem.onAppear,'function','mounted tiles register the native appear admission callback');
assert.ok(has('LoadingProgress'),'geometry can precede its tile lease');
const geometryKey=frame().key;
tiles.set('0:0',{image:{fileUri:'file://lease-a.png',revision:'image-r1'}});notify();
assert.notEqual(frame().key,geometryKey,'ready pixels must replace the former spinner branch');
assert.ok(has('Image'));assert.ok(!has('LoadingProgress'));
assert.equal(frame().nodes.find(node=>node.type==='Image').create,'file://lease-a.png');
assert.equal(frame().nodes.find(node=>node.type==='Image').syncLoad,true,
  'the actual SDK local-display Image must request synchronous loading on a ready lease');
assert.equal(frame().nodes.find(node=>node.type==='Image').draggable,false,
  'the actual SDK Image must explicitly disable system drag-and-drop');
const listNode=[...owner.nodes.values()].find(node=>node.type==='List');
const scrollNode=[...owner.nodes.values()].find(node=>node.type==='Scroll');
assert.equal(listNode.cachedCount,0,'local image sync loading does not preload or retain chapter-wide native nodes');
for(const node of [listNode,scrollNode]){
  assert.ok(node);assert.notEqual(node.enabled,false,'image drag suppression must not disable its scrolling parent');
  assert.notEqual(node.hitTestBehavior,'HitTestMode.None','parent hit testing must remain available');
  assert.equal(typeof node.onScroll,'function','the existing native scroll callback stays registered');
}
assert.equal(typeof listNode.onTouch,'function');
const touchGeneration=owner.layoutGeneration;
listNode.onTouch({type:0});
assert.equal(owner.layoutGeneration,touchGeneration+1,'the actual SDK touch callback still reaches the production Down handler');
listNode.onTouch({type:1});
assert.equal(owner.layoutGeneration,touchGeneration+1,'non-Down touch behavior remains unchanged');
assert.equal(frame().businessKey,originalBusinessKey,'render transitions do not replace logical page/tile identity');
const readyKey=frame().key,readyMounts=lazy.mounts;
notify();assert.equal(frame().key,readyKey);assert.equal(lazy.mounts,readyMounts,'unchanged notifications preserve mounted content');
geometry.set(2,{width:900,height:2700,tileHeight:900});tiles.set('2:0',{image:{fileUri:'file://neighbor',revision:'neighbor-r'}});notify();
assert.equal(frame().key,readyKey);assert.equal(lazy.mounts,readyMounts,'a nonvisible prefetch cannot recreate the visible row');
const anchorBefore=owner.data.projection.index(0,0.4),positionBefore=owner.data.projection.position(anchorBefore,60,300);
tiles.set('0:0',{image:{fileUri:'file://lease-b.png',revision:'image-r1'}});notify();
assert.notEqual(frame().key,readyKey);assert.equal(frame().nodes.find(node=>node.type==='Image').create,'file://lease-b.png');
const uriKey=frame().key;
tiles.set('0:0',{image:{fileUri:'file://lease-b.png',revision:'image-r2'}});notify();assert.notEqual(frame().key,uriKey,'same URI with a new image revision updates the child');
tiles.set('0:0',{error:'READING_IMAGE_HTTP_FAILED'});notify();assert.ok(!has('Image'));assert.ok(has('Text'));assert.ok(has('Button'));assert.ok(!has('LoadingProgress'));
const errorKey=frame().key;
tiles.set('0:0',{});pages.set(0,{ordinal:0,status:'pending'});notify();assert.notEqual(frame().key,errorKey);assert.ok(has('LoadingProgress'),'retry clears the old error branch');
const retryKey=frame().key;
pages.set(0,{ordinal:0,status:'failed',error:'READING_IMAGE_ACCESS_DENIED'});notify();assert.notEqual(frame().key,retryKey);assert.ok(has('Text'));assert.ok(!has('LoadingProgress'),'page-level failures are visible before a tile exists');
pages.set(0,{ordinal:0,status:'ready'});tiles.set('0:0',{image:{fileUri:'file://lease-c.png',revision:'image-r3'}});notify();assert.ok(has('Image'));
assert.equal(frame().businessKey,originalBusinessKey);
assert.equal(owner.data.projection.index(0,0.4),anchorBefore);
assert.equal(owner.data.projection.position(anchorBefore,60,300),positionBefore,'image/error publication cannot change the normalized anchor mapping');
// A restored anchor can temporarily report only row zero while row one is
// already visible. Exercise the real Surface.publish, not a test notification.
// onDataChange(0) must not silently reconcile row one in this boundary model.
owner.mounted=true;owner.first=0;owner.last=0;owner.publishedManifestVersion=manifest.manifestVersion;
lazy.visible=[0,1];lazy.reconcile();
const secondPending=lazy.rows.get(1);
assert.ok(secondPending.nodes.some(node=>node.type==='LoadingProgress'));
tiles.set('0:1',{image:{fileUri:'file://second-visible-tile.png',revision:'tile-1-ready'}});
owner.publish();
const secondReady=lazy.rows.get(1);
assert.notEqual(secondReady.key,secondPending.key,'actual publish must notify the requested next row even when restored last is zero');
assert.equal(secondReady.nodes.find(node=>node.type==='Image')?.create,'file://second-visible-tile.png');
assert.ok(!secondReady.nodes.some(node=>node.type==='LoadingProgress'));
assert.equal(secondReady.businessKey,secondPending.businessKey);
assert.equal(secondReady.nodes.find(node=>node.type==='Image').draggable,false,'newly published tiles keep the explicit drag policy');
assert.equal(secondReady.nodes.find(node=>node.type==='Image').syncLoad,true,'later completed display regions also load synchronously');
// Error ownership is a presentation transition even when each failed tile's
// own error text/geometry are unchanged. Retain old branches strictly by key.
tiles.set('0:0',{error:'READING_IMAGE_HTTP_FAILED'});
tiles.set('0:1',{error:'READING_IMAGE_HTTP_FAILED'});
owner.first=0;owner.last=0;owner.publish();
const firstFailure=lazy.rows.get(0),secondaryFailure=lazy.rows.get(1);
assert.ok(firstFailure.nodes.some(node=>node.type==='Button'),'one current error owns retry');
assert.ok(!secondaryFailure.nodes.some(node=>node.type==='Button'),'neighbor failure initially retains only its measured slot');
owner.first=1;owner.last=1;owner.publish();
const scrolledFailure=lazy.rows.get(1);
assert.notEqual(scrolledFailure.key,secondaryFailure.key,'moving a retained failure into the viewport transfers error ownership');
assert.ok(scrolledFailure.nodes.some(node=>node.type==='Button'),'the scrolled error exposes its actual SDK retry button');
owner.first=0;owner.last=0;owner.publish();
const demotedFailure=lazy.rows.get(1);
assert.ok(!demotedFailure.nodes.some(node=>node.type==='Button'));
tiles.set('0:0',{image:{fileUri:'file://recovered-primary.png',revision:'recovered'}});owner.publish();
const promotedFailure=lazy.rows.get(1);
assert.notEqual(promotedFailure.key,demotedFailure.key,'recovered first image transfers the card without changing the next tile error');
assert.ok(promotedFailure.nodes.some(node=>node.type==='Button'),'the next unresolved tile has a retry after its predecessor recovers');

// Whole-chapter ready facts stay with the Controller. Native virtualization
// can remount a distant row without the Surface rebuilding a pending branch.
// Model row disposal explicitly, then execute the SDK item/key callbacks;
// this checks Builder lowering and business state, not native painted frames.
geometry.set(0,{width:600,height:12000,tileHeight:600});
pages.set(0,{ordinal:0,status:'ready'});
for(let tile=0;tile<20;tile++)tiles.set(`0:${tile}`,{image:{fileUri:`file://chapter-region-${tile}.png`,revision:`region-${tile}`}});
project();
const returnRow=owner.data.getData(0),returnKey=owner.rowRenderKey(returnRow);
for(const index of [0,4,8,12,16,19,12,4,0]){
  owner.first=index;owner.last=index;lazy.visible=[index];lazy.rows.delete(index);
  owner.publish();
  const row=lazy.rows.get(index),image=row?.nodes.find(node=>node.type==='Image');
  assert.ok(image,`ready whole-chapter region ${index} remounts directly as Image`);
  assert.equal(image.create,`file://chapter-region-${index}.png`);assert.equal(image.syncLoad,true);
  assert.ok(!row.nodes.some(node=>node.type==='LoadingProgress'),'returning ready facts cannot become a Surface pending placeholder');
}
assert.equal(owner.rowRenderKey(returnRow),returnKey,'distant remounts preserve the completed row key and original URI/revision');
console.log('PASS actual SDK local display Image syncLoad=true across first/replacement and 20-region whole-chapter backscroll remount; cachedCount remains zero (native first-frame pixels, read/decode and frame time require target validation)');
console.log('PASS actual SDK Image draggable=false on first/replacement tile; scrolling parents retain hit testing, enabled state and real touch/scroll callbacks (native gesture outcome not tested)');
console.log('PASS actual SDK LazyForEach item/key callbacks with strict per-index retention: placeholder geometry, ready image, errors, retry, URI/revision changes, unchanged and nonvisible stability, logical identity and anchor preservation, actual publish to the next requested visible tile (native layout/pixels not tested)');
console.log('PASS actual SDK retained failure rows transfer a visible retry card after viewport scrolling and preceding-image recovery');
