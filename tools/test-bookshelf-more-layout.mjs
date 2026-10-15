import { actionMenuProbe, ReaderMenuActionView } from './lib/reader-action-menu-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
const file=new URL('../entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets',import.meta.url);
const source=readFileSync(file,'utf8');
const specSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets',import.meta.url),'utf8');
const { resolvePopupSpec } = new Function('TextAlign', 'SOURCE_SWITCH_VISUAL', stripTypeScriptTypes(specSource)
  .replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'') + '; return { resolvePopupSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' }, SOURCE_SWITCH_VISUAL);
const popupSpec=resolvePopupSpec('bookshelf-more-menu');
const names=['surfaceSpec','actionEnabled','actionLabel','actionIcon','menuWidth','menuX','menuTop','visiblePanelHeight','pointerX','commitAction','collapseMenu','finishCollapse'];
const Methods=productionMotionMethods(file,names,{resolvePopupSpec});
const menu=Object.assign(new Methods(),{overlayWidth:393,overlayHeight:650,anchorRight:373,anchorBottom:60,panelHeight:212});
assert.equal(menu.menuWidth(),176);assert.equal(menu.menuTop(),55);assert.equal(menu.visiblePanelHeight(),212);assert.equal(menu.pointerX(),131);
for(const [width,height,right,bottom] of [[320,190,312,60],[393,140,393,60],[800,300,798,80],[170,200,170,70]]) {
 Object.assign(menu,{overlayWidth:width,overlayHeight:height,anchorRight:right,anchorBottom:bottom});
 assert.ok(menu.menuX()>=0);assert.ok(menu.menuX()+menu.menuWidth()<=width);
 assert.ok(menu.menuTop()+menu.visiblePanelHeight()<=height-8);
 assert.ok(menu.visiblePanelHeight()>=popupSpec.collapsedHeight,'a compact viewport retains one full scrollable row');
 assert.ok(menu.pointerX()>=0 && menu.pointerX()+popupSpec.pointerWidth<=menu.menuWidth());
}
assert.match(source,/ReaderActionMenuSurface\(\{/);
assert.match(source,/viewportHeight: Math.max\(0, this.visiblePanelHeight\(\) - this\.surfaceSpec\(\)\.pointerHeight\)/);
assert.match(source,/resolvePopupSpec\('bookshelf-more-menu'\)/,'menu consumes the shared popup surface registry');
assert.doesNotMatch(source,/const (MENU_WIDTH|POINTER_HEIGHT|ACTION_HEIGHT|ACTION_COUNT|ACTIONS_HEIGHT|MENU_COLLAPSED_HEIGHT)\s*=/,'menu geometry is owned by the shared surface contract');
const shared=actionMenuProbe();
const {owner}=createReaderBuilderProbe(source,['menuContent','menuActions','performMenuAction',...names],shared.dependencies,shared.hooks);
let calls=0;Object.assign(owner,{appThemeScheme:'day',overlayWidth:393,overlayHeight:650,panelHeight:212,canCheckUpdates:false,updateRunning:false,backgroundUpdateRunning:false,
 closeInFlight:false,mounted:true,generation:0,reduceMotion:true,onDismiss(){},onCheckUpdates(){calls++;},getUIContext:()=>({animateTo:(_p,cb)=>cb()})});
owner.menuContent();
const nodes=()=>shared.nodes(owner);
const text=()=>nodes().find(n=>n.type==='Text'&&String(n.create).includes('检查'));
const target=()=>nodes().find(n=>String(n.accessibilityText).startsWith('检查更新'));
const replay=()=>{owner.replay();shared.properties.flush();};
assert.equal(nodes().filter(n=>n.type==='Text').length,4);
assert.equal(target().enabled,false);target().onClick();assert.equal(calls,0);
const updateRow=target();
owner.canCheckUpdates=true;replay();assert.equal(updateRow.enabled,true);
owner.updateRunning=true;owner.updateProgressDone=4;owner.updateProgressTotal=9;replay();
assert.equal(text().create,'检查中 4/9');assert.equal(updateRow.enabled,false);updateRow.onClick();assert.equal(calls,0);
owner.updateRunning=false;owner.backgroundUpdateRunning=true;replay();
assert.equal(nodes().find(n=>n.type==='Text'&&n.create==='正在自动检查').create,'正在自动检查');assert.equal(updateRow.enabled,false);
owner.backgroundUpdateRunning=false;owner.appThemeScheme='night';replay();assert.equal(text().create,'检查更新');
const icon=nodes().find(n=>n.type==='Image'&&String(n.create).includes('settings_gen_refresh'));assert.equal(icon.create,'app.media.settings_gen_refresh_theme_night');
updateRow.onClick();updateRow.onClick();assert.equal(calls,1,'exactly once dispatch before the menu closes');
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
await import('./test-bookshelf-shell-states.mjs');
console.log('PASS PH60 More: four rows, bounded scrolling geometry, anchored pointer, live progress/theme, empty/background guards and once-only update');
