import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(source)};return MangaStripProjection`)();
const p=new Projection();const manifest={pages:[{ordinal:0,pageId:'a'},{ordinal:1,pageId:'b'}]};
const sizes=new Map([[0,{width:1000,height:4500,tileHeight:1000}]]);
p.publish(manifest,i=>sizes.get(i));assert.equal(p.totalCount(),6);
assert.equal(p.row(4).height,500);assert.equal(p.row(4).sourceY,4000);
assert.equal(p.index(0,1),4);assert.equal(p.row(5).known,false);
assert.equal(p.position(1,250,500),1/3);
assert.throws(()=>p.position(5,0,500),/GEOMETRY_REQUIRED/);
sizes.set(1,{width:800,height:2000,tileHeight:800});p.publish(manifest,i=>sizes.get(i));
assert.equal(p.totalCount(),8);assert.equal(p.row(p.index(1,0.9)).key,'b:2');
assert.equal(p.row(p.index(0,0.9)).key,'a:4');
assert.throws(()=>p.index(1,NaN),/ANCHOR_INVALID/);
console.log('PASS manga strip: last crop, unknown geometry, original-image position, stable anchors after geometry expansion');
// Execute the actual ArkUI owner's anchor methods against a changing viewport.
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const timers=[],scrolls=[],frames=[];
const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),
  ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','rememberVisible','resizeViewport','restore'],{setTimeout:callback=>timers.push(callback),ScrollAlign:{START:'start'},
    // This anchor probe only records native frame admission. The dedicated SDK
    // viewport test executes the real MangaLayoutFrame and measured callbacks.
    MangaLayoutFrame:class {constructor(action){this.action=action;}}});
const surface=Object.assign(new Surface(),{data:{totalCount:()=>p.totalCount(),getData:i=>p.row(i),projection:p},
 first:2,last:2,viewportWidth:500,viewportHeight:900,zoom:1,horizontalScroller:{currentOffset:()=>({xOffset:0}),scrollTo:()=>{}},opened:true,mounted:true,layoutGeneration:0,
 scroller:{getItemRect:()=>({y:-237.5}),scrollToIndex:(...args)=>scrolls.push(['index',...args]),scrollBy:(...args)=>scrolls.push(['offset',...args])},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),
 updateViewport:()=>scrolls.push(['update'])});
surface.rememberVisible();assert.deepEqual(surface.visibleAnchor,{ordinal:0,y:0.55,x:0});
surface.scroller.getItemRect=()=>{throw Error('new rectangles unavailable during reflow');};
surface.rememberVisible();assert.equal(surface.visibleAnchor.y,0.55);
surface.resizeViewport(350);surface.resizeViewport(700);
assert.equal(surface.viewportWidth,700);timers.shift()();assert.equal(scrolls.length,0,'superseded resize must not restore');
timers.shift()();assert.deepEqual(scrolls,[['index',2,false,'start'],['offset',0,332.5],['update']]);
assert.equal(frames.length,1,'only the current anchor restore admits a follow-up native frame');
surface.resizeViewport(NaN);surface.resizeViewport(0);assert.equal(surface.viewportWidth,700);
assert.equal(surface.visibleAnchor.y,0.55);
console.log('PASS actual manga surface preserves observed original-image anchor across width changes and missing geometry; obsolete resize discarded');
