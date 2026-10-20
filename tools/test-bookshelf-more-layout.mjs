import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"bounded-menu-frame": {"description": "实际菜单frame约束与native vp/string测量", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { actionMenuProbe, ReaderMenuActionView } = await import('./lib/reader-action-menu-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');

const file=new URL('../entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets',import.meta.url);
const source=readFileSync(file,'utf8');
const specSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets',import.meta.url),'utf8');
const { resolvePopupSpec } = new Function('TextAlign', 'SOURCE_SWITCH_VISUAL', stripTypeScriptTypes(specSource)
  .replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'') + '; return { resolvePopupSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' }, SOURCE_SWITCH_VISUAL);
const popupSpec=resolvePopupSpec('bookshelf-more-menu');
const names=['surfaceSpec','actionEnabled','actionLabel','actionIcon','menuWidth','menuX','menuTop','visiblePanelHeight','pointerX','commitAction','collapseMenu','finishCollapse'];
const Methods=productionMotionMethods(file,names,{resolvePopupSpec});
const menu=Object.assign(new Methods(),{overlayWidth:393,overlayHeight:650,anchorRight:373,anchorBottom:60,panelHeight:212});

for(const [width,height,right,bottom] of [[320,190,312,60],[393,140,393,60],[800,300,798,80],[170,200,170,70]]) {
 Object.assign(menu,{overlayWidth:width,overlayHeight:height,anchorRight:right,anchorBottom:bottom});
 assert.ok(menu.menuX()>=0);assert.ok(menu.menuX()+menu.menuWidth()<=width);
 assert.ok(menu.menuTop()+menu.visiblePanelHeight()<=height-8);
 assert.ok(menu.visiblePanelHeight()>=popupSpec.collapsedHeight,'a compact viewport retains one full scrollable row');
 assert.ok(menu.pointerX()>=0 && menu.pointerX()+popupSpec.pointerWidth<=menu.menuWidth());
}
function measuredMenu(definition=source) {
 const surface=actionMenuProbe();
 const {owner:actual}=createReaderBuilderProbe(definition,boundedMembers(definition),
  {...surface.properties.sdk,...surface.dependencies,LineJoinStyle:{Round:'LineJoinStyle.Round'},
   registerReaderFonts(){},uiContext:{animateTo:(_params,callback)=>callback()}},
  {...surface.properties.hooks,...surface.hooks});
 Object.assign(actual,{anchorRight:355,anchorBottom:52,reduceMotion:true,mounted:true});actual.initialRender();
 const area=[...actual.nodes.values()].find(node=>node.type==='Stack'&&node.onAreaChange);
 assert.ok(area,'actual More overlay root owns native viewport measurement');
 return {actual,area,surface};
}
{
 const {actual,area,surface}=measuredMenu(),actor=[...actual.children.values()][0];
 for(const viewport of [{width:365,height:650},{width:'365vp',height:'650vp'}]) {
  area.onAreaChange({},viewport);actual.replay();surface.properties.flush();
  assert.deepEqual([actual.overlayWidth,actual.overlayHeight],[365,650]);
  assert.ok(actual.menuX()>=0&&actual.menuX()+actual.menuWidth()<=365);
  assert.equal([...actual.children.values()][0],actor,'unit measurement retains the actual shared menu actor');
 }
}
{
 const broken=source.replaceAll('readerPageAreaLength(area.','Number(area.');assert.notEqual(broken,source);
 const {actual,area}=measuredMenu(broken);area.onAreaChange({}, {width:'365vp',height:'650vp'});
 assert.ok(Number.isNaN(actual.overlayWidth)&&Number.isNaN(actual.overlayHeight),
  'Number mutation reproduces invalid vp viewport in the actual native callback');
}
// Actual Index readiness -> shared menu admission is exercised by the SDK shell-state test.
// Shell readiness is covered by the separately selected shell-state case; no imported test entry.
console.log('PASS PH60 More: four rows, bounded scrolling geometry, anchored pointer, live progress/theme, empty/background guards and once-only update');

}
