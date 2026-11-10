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
const {createTemporaryBackLeafFixtures} = await import('./lib/temporary-back-leaf-fixture.mjs');
const source=name=>readFileSync(new URL(`../entry/src/main/ets/features/${name}.ets`,import.meta.url),'utf8');
function renderReader() {
  const shared=actionMenuProbe(resolvePopupSpec), actions=[];
  const names=['readerMoreMenu','readerMoreActions','readerMoreSurfaceSpec','readerMoreActionEnabled','performMoreAction','dismissMoreMenu','setMoreMenuVisible'];
  const {owner}=createReaderBuilderProbe(source('reading/ReaderControlPanel'),names,shared.dependencies,shared.hooks);
  Object.assign(owner,{appScheme:'day',layout:{viewportHeight:844},moreMenuVisible:true,inputEnabled:true,controlObscured:false,
    chapterRefreshEnabled:true,bookDownloadEnabled:true,onTemporaryLayerChange(){},onOpenBookInfo:()=>actions.push('info'),onRefreshChapter(){},onDownloadBook(){}});
  owner.readerMoreMenu();
  const child=[...owner.children.values()][0];
  assert.equal(child.constructor,shared.Component,'real parent constructs the shared production component');
  return {owner,child,actions,nodes:()=>shared.nodes(owner),update(){owner.replay();shared.properties.flush();}};
}

// Retained SDK child receives fresh Props; the same ID reads current state and
// invokes the current parent intent, never its captured initial label/callback.
{
  const {shelfFixture}=await createTemporaryBackLeafFixtures(),shelf=shelfFixture(),child=shelf.sheet().sheet;
  const update=shelf.sheet().row('检查更新');
  shelf.o.updateRunning=true;
  const busy=shelf.sheet();assert.equal(busy.sheet,child);
  assert.equal(child.actionItems().find(action=>action.id.endsWith('::update')).enabled,false);
  update.onClick();assert.deepEqual(shelf.calls,[],'a retained update actor rechecks live busy admission');
  shelf.o.onBatchManageRequested=()=>shelf.calls.push('fresh');
  const batch=busy.row('批量管理');batch.onClick();batch.onClick();
  assert.deepEqual(shelf.calls,['fresh']);
  const reader=renderReader();
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
  const reader = renderReader();
  const info = reader.nodes().find(n => n.accessibilityText === '书籍信息');
  reader.child.aboutToDisappear(); info.onClick();
  assert.deepEqual(reader.actions, [], 'retired shared renderer refuses the old enabled callback');
}


}
