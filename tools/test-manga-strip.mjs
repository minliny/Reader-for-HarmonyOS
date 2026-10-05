import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts',import.meta.url),'utf8').replace(/^import[^;]+;\n/gm,'').replace(/^export /gm,'');
const Projection=new Function(`${stripTypeScriptTypes(source)};return MangaStripProjection`)();
const p=new Projection();const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/c'},manifestVersion:'strip-v1',pages:[{ordinal:0,pageId:'a'},{ordinal:1,pageId:'b'}]};
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
const surfaceURL=new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url);
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`);
const tree=ts.createSourceFile('/tmp/MangaStripAnchorProbe.ets',readFileSync(surfaceURL,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const frame=tree.statements.find(n=>n.name?.getText(tree)==='MangaLayoutFrame');assert.ok(frame);
const MangaLayoutFrame=new Function('FrameCallback',`${stripTypeScriptTypes(frame.getText(tree))};return MangaLayoutFrame`)(class {});
const timers=[],scrolls=[],frames=[],measurements=[];
const Surface=productionMotionMethods(surfaceURL,
  ['effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop','rowDisplayLeft','visibleX','positionIdentity','rememberVisible','resizeViewport','restore','finishLayout','onViewportScroll','measureVisibleWindow'],{setTimeout:callback=>timers.push(callback),ScrollAlign:{START:'start'},
    MangaLayoutFrame});
const surface=Object.assign(new Surface(),{data:{totalCount:()=>p.totalCount(),getData:i=>p.row(i),projection:p},
 first:2,last:2,viewportWidth:500,viewportHeight:900,zoom:1,horizontalScroller:{currentOffset:()=>({xOffset:0}),scrollTo:()=>{}},opened:true,mounted:true,layoutGeneration:0,appliedLayoutGeneration:-1,presentationGeneration:0,
 controller:{chapter:{manifest},pageAt:ordinal=>manifest.pages[ordinal]},
 scroller:{getItemIndex:(x,y)=>{measurements.push([x,y]);return y<1?2:-1;},getItemRect:()=>({y:-237.5,width:500,height:500}),scrollToIndex:(...args)=>scrolls.push(['index',...args]),scrollBy:(...args)=>scrolls.push(['offset',...args])},
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),
 updateViewport:()=>scrolls.push(['update'])});
surface.rememberVisible();assert.deepEqual(surface.visibleAnchor,{ordinal:0,y:0.55,x:0});
surface.scroller.getItemRect=()=>{throw Error('new rectangles unavailable during reflow');};
surface.rememberVisible();assert.equal(surface.visibleAnchor.y,0.55);
surface.resizeViewport(350);surface.resizeViewport(700);
assert.equal(surface.viewportWidth,700);timers.shift()();assert.equal(scrolls.length,0,'superseded resize must not restore');
timers.shift()();assert.deepEqual(scrolls,[['index',2,false,'start'],['offset',0,332.5],['update']]);
assert.equal(frames.length,1,'only the current anchor restore admits a follow-up native frame');
const admitted=frames.shift();assert.ok(admitted instanceof MangaLayoutFrame);admitted.onFrame(0);
assert.deepEqual(measurements,[[0.5,0.5],[0.5,899.5]]);
assert.deepEqual([surface.first,surface.last],[2,2],'real frame keeps the observed range while platform rectangles are unavailable');
assert.equal(scrolls.length,3,'unavailable frame geometry must not add a viewport update');
assert.equal(surface.restoringAnchor,true,'a delivered frame cannot declare unavailable native geometry stable');
surface.resizeViewport(NaN);surface.resizeViewport(0);assert.equal(surface.viewportWidth,700);
assert.equal(surface.visibleAnchor.y,0.55);
console.log('PASS actual manga surface preserves observed original-image anchor across width changes and missing geometry; obsolete resize discarded');
