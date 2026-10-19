import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"action-admission": "真实菜单父子 current callback、busy、重复点击和退役拒绝"};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase();
  recordContractCasePass(id);
}
async function runSelectedCase() {


const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {actionMenuProbe,resolvePopupSpec,ReaderMenuActionView} = await import('./lib/reader-action-menu-probe.mjs');
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
{
  const oldContract = new ReaderMenuActionView('compat', '兼容', false, 'icon', '读出兼容');
  assert.equal(oldContract.enabled, false); assert.equal(oldContract.icon, 'icon');
  assert.equal(oldContract.accessibilityLabel, '读出兼容');
  assert.equal(oldContract.section, ''); assert.equal(oldContract.secondary, '');
  assert.equal(oldContract.trailing, ''); assert.equal(oldContract.tone, 'default');
  assert.equal(oldContract.showChevron, false, 'old five-argument constructor retains popup behavior');
  const reader = render('reader', spec());
  const info = reader.nodes().find(n => n.accessibilityText === '书籍信息');
  reader.child.aboutToDisappear(); info.onClick();
  assert.deepEqual(reader.actions, [], 'retired shared renderer refuses the old enabled callback');
}


}
