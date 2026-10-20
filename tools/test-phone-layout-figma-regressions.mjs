import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"live-width-safe-frame": {"description": "实际detail text/manga安全frame与Shelf Area解析", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const horizontal = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const {MANGA_DIRECTORY_VISUAL: visual} = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');

let metrics={windowRect:{width:390,height:844},left:40,right:7};
const deps={...horizontal,visual,ReaderWindowCoordinator:{metrics:()=>metrics},readerVisualSafeLeft:m=>m.left,readerVisualSafeRight:m=>m.right};
const Detail=selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets',import.meta.url),'LocalBookDetail',['contentFrame','dockFrame','liveWidth','safeLeft','safeRight'],deps);
for(const contentKind of ['text','manga']) {
 const owner=Object.assign(new Detail(),{book:{contentKind},viewportWidth:0,readerWindowMetricsRevision:1});
 for(const width of [0,160,320,390,800]) {metrics={...metrics,windowRect:{width,height:844}};
  for(const method of ['contentFrame','dockFrame']) {const frame=owner[method]();assert.ok(frame.width>=0&&Number.isFinite(frame.width));assert.ok(frame.left+frame.width<=width);assert.ok(frame.right+frame.width<=width);if(width>=metrics.left+metrics.right){assert.ok(frame.left>=metrics.left);assert.ok(frame.right>=metrics.right);}}
 }
 metrics={...metrics,windowRect:{width:800,height:844}};owner.viewportWidth=320;assert.equal(owner.liveWidth(),320,'real measured area wins over old window width');
 owner.viewportWidth=0;owner.readerWindowMetricsRevision=-1;assert.equal(owner.liveWidth(),0,'no invented 390/352 before live metrics');
}
const Shelf=selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url),'BookshelfPage',['numericAreaLength']),shelf=new Shelf();
for(const[value,expected]of[[24,24],['24vp',24],['75.5vp',75.5],[NaN,0],['invalid',0],[{},0]])assert.equal(shelf.numericAreaLength(value),expected);

}
