import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {actionMenuProbe,resolvePopupSpec} from './lib/reader-action-menu-probe.mjs';

const source=name=>readFileSync(new URL(`../entry/src/main/ets/features/${name}.ets`,import.meta.url),'utf8');
const spec=(fontDelta=0,variantDelta=0)=>id=>{
  const original=resolvePopupSpec(id);
  return {...original,actionFontSize:original.actionFontSize+fontDelta,
    actionHeight:original.actionHeight+(id==='bookshelf-more-menu'?variantDelta:0)};
};
function render(kind,resolve) {
  const shared=actionMenuProbe(resolve), actions=[];
  const shelf=kind==='bookshelf';
  const names=shelf?['menuContent','menuActions','performMenuAction','surfaceSpec','actionEnabled','actionLabel','actionIcon',
    'menuWidth','visiblePanelHeight','menuTop','commitAction','collapseMenu','finishCollapse']:
    ['readerMoreMenu','readerMoreActions','readerMoreSurfaceSpec','readerMoreActionEnabled','performMoreAction','dismissMoreMenu','setMoreMenuVisible'];
  const {owner}=createReaderBuilderProbe(source(shelf?'bookshelf/BookshelfMoreMenu':'reading/ReaderControlPanel'),names,shared.dependencies,shared.hooks);
  Object.assign(owner,shelf?{appThemeScheme:'day',overlayWidth:393,overlayHeight:650,anchorBottom:60,panelHeight:212,
    closeInFlight:false,mounted:true,generation:0,reduceMotion:true,canCheckUpdates:true,updateRunning:false,backgroundUpdateRunning:false,
    onDismiss(){},onBatchManage:()=>actions.push('batch'),onLocalImport(){},onCheckUpdates(){},onBookshelfSettings(){}}:
    {appScheme:'day',layout:{viewportHeight:844},moreMenuVisible:true,inputEnabled:true,controlObscured:false,
    chapterRefreshEnabled:true,bookDownloadEnabled:true,onTemporaryLayerChange(){},onOpenBookInfo:()=>actions.push('info'),onRefreshChapter(){},onDownloadBook(){}});
  shelf?owner.menuContent():owner.readerMoreMenu();
  const child=[...owner.children.values()][0];
  assert.equal(child.constructor,shared.Component,'real parent constructs the shared production component');
  return {owner,child,actions,nodes:()=>shared.nodes(owner),update(){owner.replay();shared.properties.flush();}};
}

for(const [common,variant] of [[0,0],[2,0],[0,7]]) {
  const shelf=render('bookshelf',spec(common,variant)),reader=render('reader',spec(common,variant));
  assert.deepEqual(shelf.nodes().filter(n=>n.type==='Text').map(n=>n.create),['批量管理','本地导入','检查更新','书架设置']);
  assert.deepEqual(reader.nodes().filter(n=>n.type==='Text').map(n=>n.create),['书籍信息','刷新本章','下载全部章节']);
  for(const [view,height,count] of [[shelf,50+variant,4],[reader,50,3]]) {
    const labels=view.nodes().filter(n=>n.type==='Text');
    assert.ok(labels.every(n=>n.fontSize===15+common&&n.lineHeight===22));
    assert.equal(view.nodes().filter(n=>n.onClick&&n.height===height).length,count);
  }
}

// Retained SDK child receives fresh Props; the same ID reads current state and
// invokes the current parent intent, never its captured initial label/callback.
{
  const shelf=render('bookshelf',spec()),child=shelf.child;
  shelf.owner.updateRunning=true;shelf.owner.updateProgressDone=2;shelf.owner.updateProgressTotal=5;shelf.update();
  assert.equal(shelf.child,child);
  const update=shelf.nodes().find(n=>n.accessibilityText==='检查中 2/5');
  assert.equal(update.enabled,false);update.onClick();assert.deepEqual(shelf.actions,[]);
  shelf.owner.onBatchManage=()=>shelf.actions.push('fresh');shelf.update();
  const batch=shelf.nodes().find(n=>n.accessibilityText==='批量管理');batch.onClick();batch.onClick();
  assert.deepEqual(shelf.actions,['fresh']);
  const reader=render('reader',spec());
  const info=reader.nodes().find(n=>n.accessibilityText==='书籍信息');
  reader.owner.onOpenBookInfo=()=>reader.actions.push('fresh');reader.owner.moreMenuVisible=false;
  info.onClick();assert.deepEqual(reader.actions,[]);
  reader.owner.moreMenuVisible=true;info.onClick();info.onClick();assert.deepEqual(reader.actions,['fresh']);
}
console.log('PASS shared action menu: two real SDK consumers, common/variant propagation, retained Props, live guards and current intents');
