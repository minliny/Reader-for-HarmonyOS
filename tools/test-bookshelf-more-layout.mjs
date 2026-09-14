import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file=new URL('../entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets',import.meta.url);
const source=readFileSync(file,'utf8');
const constants=Object.fromEntries([...source.matchAll(/const (\w+) = (\d+);/g)].map(m=>[m[1],Number(m[2])]));
Object.assign(constants,{MENU_HEIGHT:212,MENU_COLLAPSED_HEIGHT:62,ACTIONS_HEIGHT:200});
const names=['actionEnabled','actionLabel','actionIcon','menuWidth','menuX','menuTop','visiblePanelHeight','pointerX','commitAction','collapseMenu'];
const Methods=productionMotionMethods(file,names,constants);
const menu=Object.assign(new Methods(),{overlayWidth:393,overlayHeight:650,anchorRight:373,anchorBottom:60,panelHeight:212});
assert.equal(menu.menuWidth(),176);assert.equal(menu.menuTop(),55);assert.equal(menu.visiblePanelHeight(),212);assert.equal(menu.pointerX(),131);
for(const [width,height,right,bottom] of [[320,190,312,60],[393,140,393,60],[800,300,798,80],[170,200,170,70]]) {
 Object.assign(menu,{overlayWidth:width,overlayHeight:height,anchorRight:right,anchorBottom:bottom});
 assert.ok(menu.menuX()>=0);assert.ok(menu.menuX()+menu.menuWidth()<=width);
 assert.ok(menu.menuTop()+menu.visiblePanelHeight()<=height-8);
 assert.ok(menu.visiblePanelHeight()>=62,'a compact viewport retains one full scrollable row');
 assert.ok(menu.pointerX()>=0 && menu.pointerX()+24<=menu.menuWidth());
}
assert.match(source,/Scroll\(\)[\s\S]*?\.height\(ACTIONS_HEIGHT\)/);
assert.match(source,/\.height\(Math.max\(0, this.visiblePanelHeight\(\) - POINTER_HEIGHT\)\)/);
assert.equal((source.match(/this.action\(/g)??[]).length,4);
const {owner}=createReaderBuilderProbe(source,['action',...names],constants);
let calls=0;Object.assign(owner,{appThemeScheme:'day',overlayWidth:393,overlayHeight:650,canCheckUpdates:false,updateRunning:false,backgroundUpdateRunning:false,
 closeInFlight:false,mounted:true,generation:0,reduceMotion:true,onDismiss(){},getUIContext:()=>({animateTo:(_p,cb)=>cb()})});
owner.action('update',false,()=>calls++);
const text=()=>[...owner.nodes.values()].find(n=>n.type==='Text');
const target=()=>[...owner.nodes.values()].find(n=>n.onClick);
assert.equal(target().enabled,false);target().onClick();assert.equal(calls,0);
owner.canCheckUpdates=true;owner.replay();assert.equal(target().enabled,true);
owner.updateRunning=true;owner.updateProgressDone=4;owner.updateProgressTotal=9;owner.replay();
assert.equal(text().create,'检查中 4/9');assert.equal(target().enabled,false);target().onClick();assert.equal(calls,0);
owner.updateRunning=false;owner.backgroundUpdateRunning=true;owner.replay();assert.equal(text().create,'正在自动检查');assert.equal(target().enabled,false);
owner.backgroundUpdateRunning=false;owner.appThemeScheme='night';owner.replay();assert.equal(text().create,'检查更新');
const icon=[...owner.nodes.values()].find(n=>n.type==='Image');assert.equal(icon.create,'app.media.settings_gen_refresh_theme_night');
target().onClick();target().onClick();assert.equal(calls,1,'exactly once dispatch before the menu closes');
const empty=readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookshelfEmptyPage.ets',import.meta.url),'utf8');assert.match(empty,/canCheckUpdates: false/);
console.log('PASS PH60 More: four rows, bounded scrolling geometry, anchored pointer, live progress/theme, empty/background guards and once-only update');
