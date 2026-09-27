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
const {owner,output}=createReaderBuilderProbe(source,names,{
  ...runtime.sdk,MangaStripDataSource,ListScroller,Scroller,PhotoViewScaleModel,
  ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeInsets,
  ScrollAlign:{START:0},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},
  LazyForEach:nativeBoundary,Gesture:nativeBoundary,GestureGroup:nativeBoundary,
  PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary,
  globalThis:{Gesture:nativeBoundary,GestureGroup:nativeBoundary,PinchGesture:nativeBoundary,SwipeGesture:nativeBoundary},
  GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
},runtime.hooks);
assert.match(output,/LazyForEach/);
assert.match(output,/onScrollStop/);
owner.title='fixture chapter';
owner.initialRender();
const root=owner.nodes.get(0);
assert.equal(root.type,'Column');
assert.deepEqual({...root.padding},{left:0,top:137/3.5,right:0,bottom:24},
  'edge-to-edge manga controls must clear the measured status and gesture bands');
assert.equal(root.width,'100%');assert.equal(root.height,'100%');
assert.equal(root.backgroundColor,owner.mangaBackgroundColor,'safe content keeps the full-window theme background');
assert.ok([...owner.nodes.values()].some(node=>node.type==='Text'&&node.create==='fixture chapter'),
  'the existing chapter title remains inside the safe root');
const nodeIds=[...owner.nodes.keys()];
metrics=createDefaultReaderWindowMetrics();
metrics.cutoutInsets=new ReaderInsetsVp(32,0,0,0);
metrics.gestureInsets=new ReaderInsetsVp(10,0,18,12);
metrics.navigationInsets=new ReaderInsetsVp(0,0,28,20);
owner.windowMetricsRevision=1;runtime.flush();
assert.deepEqual({...root.padding},{left:32,top:0,right:28,bottom:20},
  'live landscape metrics independently preserve asymmetric interactive edges');
metrics=createDefaultReaderWindowMetrics();
owner.windowMetricsRevision=2;runtime.flush();
assert.deepEqual({...root.padding},{left:0,top:0,right:0,bottom:0},
  'cleared system bars do not retain or double-apply old safe padding');
assert.deepEqual([...owner.nodes.keys()],nodeIds,'metrics changes update the mounted owner without remounting');
console.log('PASS actual SDK root padding + live window revision: portrait status/gesture, asymmetric landscape and cleared insets (native layout not tested)');
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
