import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{readerNativeHighlightValues,readerHighlightColor,readerHighlightCanvasColor}from'../entry/src/main/ets/features/reading/ReaderDynamicHighlight.ts';
const rect={left:10,top:20,right:80,bottom:25,color:'#33594632',multiply:true};
const values=readerNativeHighlightValues([rect],100,100);assert.deepEqual(values.slice(0,4),[.1,.2,.8,.25]);assert.equal(values[7],-.2);
assert.equal(readerHighlightCanvasColor('#33594632'),'rgba(89,70,50,0.2)');assert.deepEqual(readerHighlightColor('#FFFFFF'),[1,1,1,1]);
assert.equal(readerNativeHighlightValues([{...rect,multiply:false,color:'#101010'}],100,100)[7],1);
assert.deepEqual(readerNativeHighlightValues([{...rect,left:-10,right:120}],100,100).slice(0,4),[0,.2,1,.25]);
assert.throws(()=>readerNativeHighlightValues(Array(65).fill(rect),100,100),/LIMIT/);assert.throws(()=>readerNativeHighlightValues([{...rect,left:NaN}],100,100),/INVALID/);
const surface=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets',import.meta.url),'utf8');
assert.ok(surface.indexOf('.id(this.staticSnapshotId')<surface.indexOf('Canvas(this.highlightCanvas)'),'live snapshot boundary excludes the dynamic canvas');
assert.match(surface,/getRectsForRange/);assert.match(surface,/if \(this\.separateHighlight\) \{\s*Span\(this\.highlightBody\(\)\);/,'static snapshot text never bakes a dynamic decoration');
const shader=readFileSync(new URL('../entry/src/main/cpp/bookturn/bookturn_renderer.cpp',import.meta.url),'utf8');assert.match(shader,/applyDynamicHighlights\(texture\(uTexture, vUv\)\.rgb\)/);assert.match(shader,/Slot\(slot\)\.identity == dynamicHighlights_\.identity/);
console.log('dynamic highlight geometry/color/identity and static snapshot separation: PASS; pixels require runtime verification');

const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const Overlay=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets',import.meta.url),['dynamicHighlightBlend'],{BlendMode:{SRC_OVER:'over',MULTIPLY:'multiply'}});
const overlay=new Overlay();assert.equal(overlay.dynamicHighlightBlend(),'multiply');overlay.ttsHighlightStart=0;overlay.ttsHighlightEnd=8;assert.equal(overlay.dynamicHighlightBlend(),'over');overlay.ttsHighlightStart=NaN;assert.equal(overlay.dynamicHighlightBlend(),'multiply');
assert.match(readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets',import.meta.url),'utf8'),/\.blendMode\(this.dynamicHighlightBlend\(\), BlendApplyType.FAST\)/,'blend against the underlying page, not transparent canvas');

assert.match(surface, /if \(this\.staticSnapshotId\.length > 0\) \{\s*Canvas\(this\.highlightCanvas\)/,
  'offscreen texture trees must not allocate an unused viewport Canvas');
