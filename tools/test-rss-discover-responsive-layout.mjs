import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context); throw error; }
} });
const definitions={"discover-frame": {"description": "实际Discover当前frame/safe边界和负revision回落", "resources": []}, "rss-frame": {"description": "实际RSS rail/live measured width/Area vp解析及status预算", "resources": []}, "rssFeed": {"description": "实际RSS feed标准child连续宽度/非法Area/Scroll保留", "resources": []}, "rssDetail": {"description": "实际RSS detail标准child连续宽度/非法Area/Scroll保留", "resources": []}, "rssManagement": {"description": "实际RSS management标准child连续宽度/非法Area/Scroll保留", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerVisualSafeLeft, readerVisualSafeRight } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { SurfaceWidthSpec, resolveHorizontalFrame } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');


const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
const {SurfaceHorizontalFrame}=await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const pageGeometry=await import('../entry/src/main/ets/features/common/ReaderPageGeometry.ts');
const pageShell=await import('../entry/src/main/ets/features/common/ReaderPageShell.ts');
const floatingBars=await import('../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts');
const measurements=await import('../entry/src/main/ets/features/common/ReaderMeasurements.ts');
const windowMetrics=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const widthClass=await import('../entry/src/main/ets/features/common/ReaderWidthClass.ts');
const { pureModuleProbe }=await import('./lib/ets-pure-module-probe.mjs');
const policy=actualReaderPageShell();
if(selectedCase==='discover-frame'||selectedCase==='rss-frame'){
 let metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,1280,800));const rss=selectedCase==='rss-frame',path=new URL('../entry/src/main/ets/features/'+(rss?'rss/RssPage.ets':'discover/DiscoverPage.ets'),import.meta.url),name=rss?'RssPage':'DiscoverPage';
 const constants=rss?selectedProductionValues(path,['RSS_FLOATING_HEADER_HEIGHT'],{...pageShell,...readerFoundationTokens}):{};
 const mainNavigation=pureModuleProbe(read('entry/src/main/ets/features/shell/MainNavigationSpec.ts'),'MainNavigationSpec.ts',
   {readerMainTabItemHeight:floatingBars.readerMainTabItemHeight,ReaderWindowCoordinator:{metrics:()=>metrics},isReaderMainTabEnabled:()=>true,
    readerInteractiveSafeBottom:windowMetrics.readerInteractiveSafeBottom,readerInteractiveSafeLeft:windowMetrics.readerInteractiveSafeLeft,
    readerVisualSafeTop:windowMetrics.readerVisualSafeTop,READER_EXPANDED_MIN_WIDTH:widthClass.READER_EXPANDED_MIN_WIDTH,AppStorage:{get:()=>undefined}},
   ['readerMainViewport','readerMainNavigationMode','readerMainRailLeading','readerMainRailBottomInset']);
 const C=selectedProductionMethods(path,name,rss?['contentFrame','pageGeometry','railActive','bottomContentInset','isWideViewport','effectiveViewportWidth','numericAreaLength','refreshMarqueeWidth']:['contentFrame','pageGeometry','railActive','bottomContentInset'],{...readerFoundationTokens,...constants,...pageGeometry,...pageShell,...mainNavigation,...floatingBars,...measurements,...windowMetrics,...widthClass,SurfaceHorizontalFrame,SurfaceWidthSpec,resolveHorizontalFrame,readerVisualSafeLeft,readerVisualSafeRight,ReaderWindowCoordinator:{metrics:()=>metrics}}),o=new C();o.readerWindowMetricsRevision=0;o.measurements=new measurements.ReaderMeasurementStore();o.mainViewportRevision=0;o.wideNavigationRail=false;o.measurementRevision=0;
 for(const width of [280,365,600,1280])for(const [left,right]of[[0,0],[48,24]]){metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,width,800),undefined,new ReaderInsetsVp(left,0,right,0));o.viewportWidth=width;const f=o.contentFrame(),host=width;assert.ok(f.width>=0&&f.left>=0&&f.right>=0);assert.ok(f.width+f.left+f.right<=host+1e-6);if(rss){assert.equal(o.effectiveViewportWidth(),width);assert.ok(o.refreshMarqueeWidth()>=0&&o.refreshMarqueeWidth()<=width);}}
 if(rss){for(const [input,value]of[['365vp',365],[365,365],['invalid',0],[Infinity,0]])assert.equal(o.numericAreaLength(input),value);
  metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,304,800));assert.equal(o.effectiveViewportWidth(),304);
  metrics=new ReaderWindowMetricsSnapshot(new ReaderRectVp(0,0,1280,800));assert.equal(o.effectiveViewportWidth(),metrics.windowRect.width);}
 o.readerWindowMetricsRevision=-1;assert.equal(o.contentFrame().width,0);
}else{
// Execute the production shared host, not a private-page shape stub. Its
// measured width must replace the larger physical window, including vp strings.
const controls = foundationControls();
let metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1280, 800));
const standard = read('entry/src/main/ets/features/common/ReaderStandardPage.ets');
const { Component } = createReaderBuilderProbe(standard, boundedMembers(standard), {
  ...controls.dependencies, ReaderWindowCoordinator: { metrics: () => metrics },
}, controls.hooks);
const allNodes = owner => [...(owner.nodes?.values() ?? []), ...[...(owner.children?.values() ?? [])].flatMap(allNodes)];
for (const variant of ['rssFeed','rssDetail','rssManagement'].filter(v=>v===selectedCase)) {
  const owner = new Component(undefined, { variant, content() {}, header() {}, footer() {}, overlayContent() {} });
  owner.initialRender();
  const viewport = allNodes(owner).find(node => node.type === 'Scroll');
  const body = allNodes(owner).find(node => node.type === 'Column' && node.padding?.left !== undefined && node.padding?.right !== undefined);
  const measuredHost = allNodes(owner).find(node => node.type === '__Common__' && node.onAreaChange);
  assert.ok(viewport && body && measuredHost, `${variant}: actual SDK emits public Scroll/frame measurement`);
  assert.equal(viewport.width, '100%'); assert.equal(viewport.height, '100%');
  assert.equal(viewport.padding?.top, undefined, 'scroll viewport is never narrowed by header clearance');
  for (const [width, left, right] of [[365, 0, 0], [390, 32, 24], [1280, 48, 32]]) {
    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 1280, 800), undefined, new ReaderInsetsVp(left, 0, right, 24));
    measuredHost.onAreaChange({}, { width: `${width}vp` }); owner.replay();
    const expected = policy.readerStandardPageContentFrame(variant,metrics,width);
    assert.equal(body.padding.left, expected.left, `${variant}: measured vp width honors asymmetric safe left`);
    assert.equal(body.padding.right, expected.right, `${variant}: measured vp width honors asymmetric safe right`);
    assert.equal(width - body.padding.left - body.padding.right, expected.width, `${variant}: one continuous 720vp maximum`);
    assert.equal(allNodes(owner).find(node => node.type === 'Scroll'), viewport, 'measurement retains native scroll actor');
    measuredHost.onAreaChange({}, { width: 'invalid' }); owner.replay();
    assert.deepEqual([body.padding.left, body.padding.right], [expected.left, expected.right], 'invalid Area cannot replace the last admitted width');
  }
}


}

}
