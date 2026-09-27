import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {createDefaultReaderWindowMetrics,readerInteractiveSafeInsets} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

// The override permits an immutable old-source counterfactual without changing
// the shared worktree. Normal check-local always reads the production Surface.
const source=readFileSync(process.env.READER_MANGA_VIEWPORT_SOURCE??new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile('/tmp/MangaViewportRestoreProbe.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const component=tree.statements.find(n=>n.name?.getText(tree)==='MangaReadingSurface');
const names=component.members.map(n=>n.name?.getText(tree)).filter(Boolean);
const projectionSource=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataText=tree.statements.find(n=>n.name?.getText(tree)==='MangaStripDataSource').getText(tree);
const DataSource=new Function('MangaStripProjection',`${stripTypeScriptTypes(dataText)};return MangaStripDataSource`)(Projection);
const frameNode=tree.statements.find(n=>n.name?.getText(tree)==='MangaLayoutFrame');
const frameDeps=frameNode?{MangaLayoutFrame:new Function('FrameCallback',`${stripTypeScriptTypes(frameNode.getText(tree))};return MangaLayoutFrame`)(class {})}:{};
const boundary=new Proxy({}, {get:()=>()=>{}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({tiles=12,height=750}={}) {
  const timers=[],frames=[],scrolls=[],queries=[],windows=[],notifications=[];
  const properties=createArkUIPropertyRuntimeProbe();
  class ListScroller {
    getItemIndex(x,y){queries.push(['index',x,y]);return this.indexAt(x,y);}
    getItemRect(i){queries.push(['rect',i]);return this.rectAt(i);}
    indexAt(_x,y){return y<1?0:2;}
    rectAt(i){return {x:0,y:i*300,width:300,height:300};}
    scrollToIndex(...args){scrolls.push(['index',...args]);this.duringScroll?.();}
    scrollBy(...args){scrolls.push(['offset',...args]);}
  }
  class Scroller {currentOffset(){return {xOffset:0};}scrollTo(...args){scrolls.push(['horizontal',...args]);}}
  const {owner}=createReaderBuilderProbe(source,names,{
    ...properties.sdk,...frameDeps,MangaStripDataSource:DataSource,ListScroller,Scroller,PhotoViewScaleModel:class {},
    ReaderWindowCoordinator:{metrics:()=>createDefaultReaderWindowMetrics()},readerInteractiveSafeInsets,
    setTimeout:callback=>{timers.push(callback);return timers.length;},
    uiContext:{postFrameCallback:frame=>frames.push(frame)},
    ScrollAlign:{START:'start'},ImageFit:{Fill:0},ScrollDirection:{Horizontal:0},TouchType:{Down:0},
    LazyForEach:boundary,Gesture:boundary,GestureGroup:boundary,PinchGesture:boundary,SwipeGesture:boundary,
    globalThis:{Gesture:boundary,GestureGroup:boundary,PinchGesture:boundary,SwipeGesture:boundary},
    GesturePriority:{Parallel:0},GestureMode:{Exclusive:0},SwipeDirection:{Horizontal:0},
  },properties.hooks);
  owner.initialRender();
  const list=[...owner.nodes.values()].find(n=>n.type==='List');assert.ok(list?.onScrollIndex,'use the real SDK-generated List callback');
  const manifest={manifestVersion:'v1',pages:[{ordinal:0,pageId:'p0'}]};
  const geometry={width:300,height:tiles*300,tileHeight:300};
  owner.controller={
    chapter:{manifest,chapterTitle:'c',chapterIndex:0},totalPages:1,displayedOrdinal:0,
    savedLocation:null,recoveryRequired:false,pageAt:()=>manifest.pages[0],pageGeometry:()=>geometry,
    setVisible:async()=>{},setTileWindow:async rows=>{windows.push(rows.map(row=>row.tileIndex));},
    tile:()=>undefined,visiblePages:()=>[],close(){},
  };
  owner.mounted=true;owner.opened=true;owner.viewportWidth=300;owner.viewportHeight=height;
  owner.publishedManifestVersion='v1';owner.data.projection.publish(manifest,()=>geometry);
  owner.data.registerDataChangeListener({onDataReloaded:()=>notifications.push('reload'),onDataChange:i=>notifications.push(i)});
  return {owner,list,timers,frames,scrolls,queries,windows,notifications,runTimer(){assert.ok(timers.length);timers.shift()();},runFrame(){assert.ok(frames.length,'restore must schedule a native-frame geometry reconciliation');frames.shift().onFrame(0);}};
}

// Same first index often has no new native callback; a callback during restore
// can also be synchronous. Neither may collapse an already visible second tile.
for (const synchronous of [false,true]) {
  const f=fixture();f.list.onScrollIndex(0,1);await tick();
  if(synchronous)f.owner.scroller.duringScroll=()=>f.list.onScrollIndex(0,1);
  f.owner.restore(0,0);f.runTimer();await tick();
  assert.deepEqual([f.owner.first,f.owner.last],[0,1],'restore must preserve the complete same-index visible range');
  assert.deepEqual(f.windows.at(-1),[0,1,2]);
  f.notifications.length=0;f.owner.publish();
  assert.deepEqual(f.notifications,[0,1,2],'publish must notify the exact loaded bounded window, including its next row');
}
console.log('PASS SDK restore preserves same-index 0..1 with/without synchronous callback; actual publish and tile requests include the same next row');

{
  const f=fixture();f.owner.restore(0,0);f.runTimer();await tick();
  f.runFrame();await tick();
  assert.deepEqual([f.owner.first,f.owner.last],[0,2],'actual top/bottom point measurements admit all three visible small tiles');
  assert.deepEqual(f.queries.filter(q=>q[0]==='index'),[['index',0.5,0.5],['index',0.5,749.5]]);
  assert.deepEqual(f.windows.at(-1),[0,1,2,3]);
  f.notifications.length=0;f.owner.publish();assert.deepEqual(f.notifications,[0,1,2,3]);
}
{
  const f=fixture({tiles:3,height:1200});f.owner.scroller.indexAt=(_x,y)=>y<1?0:-1;
  f.owner.restore(0,0);f.runTimer();f.runFrame();await tick();
  assert.deepEqual([f.owner.first,f.owner.last],[0,2],'short content above the bottom probe uses actual visible row rectangles');
  assert.deepEqual(f.windows.at(-1),[0,1,2]);assert.ok(f.queries.filter(q=>q[0]==='rect').length<=8);
}
{
  const f=fixture({tiles:50,height:5000});f.owner.scroller.indexAt=(_x,y)=>y<1?0:-1;
  f.owner.restore(0,0);f.runTimer();f.runFrame();await tick();
  assert.deepEqual(f.windows.at(-1),[0,1,2,3,4,5,6,7],'long short-strip lists never expand a job beyond eight tiles');
  assert.ok(f.queries.filter(q=>q[0]==='rect').length<=8,'fallback measurement does not scan the full chapter');
  assert.ok(f.queries.filter(q=>q[0]==='rect').every(q=>q[1]<8));
  f.notifications.length=0;f.owner.publish();assert.deepEqual(f.notifications,[0,1,2,3,4,5,6,7]);
}
console.log('PASS actual post-frame Scroller samples three visible tiles, short-content rectangles and an eight-tile cap shared with publication');

for (const invalid of [NaN,-1,999,1.5]) {
  const f=fixture();f.list.onScrollIndex(0,1);f.owner.scroller.indexAt=()=>invalid;
  f.owner.restore(0,0);f.runTimer();await tick();const count=f.windows.length;
  f.runFrame();await tick();assert.deepEqual([f.owner.first,f.owner.last],[0,1]);assert.equal(f.windows.length,count);
}
{
  const f=fixture();f.list.onScrollIndex(0,1);f.owner.scroller.indexAt=(_x,y)=>y<1?0:-1;
  f.owner.scroller.rectAt=()=>{throw Error('geometry unavailable');};
  f.owner.restore(0,0);f.runTimer();await tick();const count=f.windows.length;
  f.runFrame();await tick();assert.deepEqual([f.owner.first,f.owner.last],[0,1]);assert.equal(f.windows.length,count);
}
{
  const f=fixture({height:1});f.owner.restore(0,0);f.runTimer();f.runFrame();
  assert.equal(f.queries.length,0,'unmeasured viewport does not issue speculative native point queries');
}
console.log('PASS invalid indices, unavailable rectangles and unmeasured height retain the last valid range');

{
  const f=fixture();f.owner.restore(0,0);
  f.list.onScrollIndex(0,1);assert.equal(f.owner.restoringAnchor,true);
  f.runTimer();await tick();assert.ok(f.scrolls.length,'native layout callback must not cancel its own pending restore');
  assert.deepEqual([f.owner.first,f.owner.last],[0,1]);assert.equal(f.owner.restoringAnchor,false);
}
{
  const f=fixture();f.owner.restore(0,0);f.owner.restore(0,0.5);
  f.runTimer();assert.equal(f.scrolls.length,0);assert.equal(f.owner.restoringAnchor,true,'obsolete restore cannot clear the newer restoration flag');
  f.runTimer();assert.equal(f.owner.first,6);assert.equal(f.owner.restoringAnchor,false);
}
{
  const f=fixture();f.owner.restore(0,0);f.runTimer();await tick();
  f.list.onScrollIndex(4,5);await tick();const queries=f.queries.length;
  f.runFrame();await tick();assert.deepEqual([f.owner.first,f.owner.last],[4,5]);assert.equal(f.queries.length,queries,'old frame cannot query over later user/native scroll state');
}
{
  const f=fixture();f.owner.restore(0,0);assert.ok(f.list.onTouch,'real touch callback fences explicit user input');
  f.list.onTouch({type:0});f.runTimer();assert.equal(f.scrolls.length,0);assert.equal(f.owner.restoringAnchor,false);
}
{
  const f=fixture();f.owner.restore(0,0);f.runTimer();await tick();
  f.owner.aboutToDisappear();f.runFrame();assert.equal(f.queries.length,0,'closed surface cannot query deferred geometry');
}
console.log('PASS native layout events preserve restore; supersession, real touch, later scroll and close fence obsolete timer/frame work');
console.log('Boundary: actual installed ETS-generated methods/callbacks and SDK property runtime; native Scroller geometry/frame delivery are controlled inputs, not platform layout, pixels or device proof.');
