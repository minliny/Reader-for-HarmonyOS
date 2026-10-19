import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"settings": {"description": "实际Settings leaf Back/appearance lease旧handler拒绝", "resources": []}, "source": {"description": "实际Source leaf collapse finish identity/old callback拒绝", "resources": []}, "shelf": {"description": "实际Shelf More Back与retired menu/trigger拒绝", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const {createTemporaryBackLeafFixtures} = await import('./lib/temporary-back-leaf-fixture.mjs');

const {harness,settingsFixture,sourceFixture,shelfFixture,settingsSource,sourceSource,shelfSource,read,child}=await createTemporaryBackLeafFixtures();
function assertCycle(factory){
  const f=factory(),old=f.events.at(-1);assert.equal(typeof old.handler,'function');assert.equal(old.handler(),true);
  if(factory===sourceFixture){f.p.properties.flush();f.finishes.at(-1)();}
  assert.equal(old.handler(),false,'normal page must fall through to Index route handling');
  f.o.aboutToDisappear();assert.deepEqual(f.events.at(-1),old.generation===undefined?{handler:undefined,identity:old.identity}:{handler:undefined,identity:old.identity,generation:old.generation});assert.equal(old.handler(),false);
  f.o.aboutToAppear();const current=f.events.at(-1);assert.notEqual(current.identity,old.identity,'every appearance gets a new lease');
  if(factory===settingsFixture)f.o.toggleSelection('startup');
  else if(factory===sourceFixture)f.o.toggleGroupSelection();
  else f.o.moreOpenAction(current.identity)();
  assert.equal(old.handler(),false,'old registered handler cannot close a new opening on the same instance');
  assert.equal(current.handler(),true);
  return f;
}
const factoryByCase={settings:settingsFixture,source:sourceFixture,shelf:shelfFixture};assertCycle(factoryByCase[selectedCase]);
if(selectedCase==='source'){
  const f=sourceFixture(),o=f.o,panel=child(f.p,o,'ReaderSelectPanel'),oldId=panel.selectionId,oldCommit=panel.onCommit,oldDismiss=panel.onDismiss;
  const oldMask=[...o.nodes.values()].find(n=>n.onClick).onClick;
  const back=f.events.at(-1).handler;assert.equal(back(),true);assert.equal(o.groupClosing,true);assert.equal(back(),true,'collapse in flight retains modal back priority');
  f.p.properties.flush();assert.equal(panel.closeInFlight,true);assert.equal(f.finishes.length,1);const finish=f.finishes[0];finish();assert.equal(o.groupOpen,false);
  o.toggleGroupSelection();o.replay();f.p.properties.flush();assert.notEqual(panel.selectionId,oldId);
  oldCommit('B',oldId);oldDismiss(oldId);oldMask();finish();assert.equal(o.groupValue,'全部分组');assert.equal(o.groupOpen,true);assert.equal(o.groupClosing,false);
  const row=f.p.walk(o).find(x=>x instanceof f.p.deps.ReaderChoiceRow&&x.label==='A');assert.ok(row);[...row.nodes.values()].find(n=>n.onClick).onClick();assert.equal(o.groupValue,'A');
  assert.equal(o.groupOpen,true,'commit precedes existing collapse completion');f.finishes.at(-1)();assert.equal(o.groupOpen,false);
  o.toggleGroupSelection();o.replay();f.p.properties.flush();panel.onCommit('invalid',panel.selectionId);assert.equal(o.groupValue,'A');
  const queuedId=panel.selectionId;o.aboutToDisappear();panel.onCommit('B',queuedId);panel.onDismiss(queuedId);assert.equal(o.groupValue,'A');assert.equal(o.groupOpen,false);
}
if(selectedCase==='shelf'){
  const f=shelfFixture(),o=f.o;let menu=child(f.p,o,'BookshelfMoreMenu');const oldDismiss=menu.onDismiss,oldImport=menu.onLocalImport,oldUpdate=menu.onCheckUpdates;
  const oldOpen=[...o.children.values()].filter(x=>x instanceof f.p.deps.ReaderIconButton).at(-1).params.onTap;
  const back=f.events.at(-1).handler;assert.equal(back(),true);
  // The helper does not simulate native If removal. Execute actual disappear
  // and a fresh SDK constructor path for the new overlay, retaining old ACKs.
  menu.aboutToDisappear();o.moreOpenAction(f.events.at(-1).identity)();o.shellOverlay();menu=f.p.walk(o).filter(x=>x instanceof f.p.deps.BookshelfMoreMenu).at(-1);f.p.properties.flush();
  oldDismiss();oldImport();oldUpdate();assert.equal(o.moreMenuVisible,true);assert.deepEqual(f.calls,[],'old menu cannot execute business work');
  o.updateRunning=true;f.p.properties.flush();menu.onCheckUpdates();assert.equal(o.moreMenuVisible,true);assert.deepEqual(f.calls,[]);
  o.updateRunning=false;f.p.properties.flush();menu.onCheckUpdates();assert.equal(o.moreMenuVisible,false);assert.deepEqual(f.calls,['update']);
  menu.aboutToDisappear();o.moreOpenAction(f.events.at(-1).identity)();o.shellOverlay();menu=f.p.walk(o).filter(x=>x instanceof f.p.deps.BookshelfMoreMenu).at(-1);f.p.properties.flush();
  const row=f.p.walk(menu).find(x=>x instanceof f.p.deps.ReaderActionMenuSurface);assert.ok(row);[...row.nodes.values()].find(n=>n.accessibilityText==='本地导入').onClick();assert.equal(o.moreMenuVisible,false);assert.deepEqual(f.calls,['update','import']);
  o.aboutToDisappear();o.aboutToAppear();oldOpen();oldDismiss();assert.equal(o.moreMenuVisible,false,'old trigger and dismiss reject a replaced mounting');
}
// Counterexamples exercise the actual production members, not a parallel model.
for(const [factory,source] of [[factoryByCase[selectedCase],{settings:settingsSource,source:sourceSource,shelf:shelfSource}[selectedCase]]]){
  const weakened=source.replace('identity !== this.temporaryBackIdentity || ','');assert.notEqual(weakened,source);
  const f=factory(weakened),old=f.events.at(-1);f.o.aboutToDisappear();f.o.aboutToAppear();
  if(factory===settingsFixture)f.o.toggleSelection('language');else if(factory===sourceFixture)f.o.toggleGroupSelection();else f.o.moreOpenAction(f.events.at(-1).identity)();
  assert.equal(old.handler(),true,'removed epoch admission admits an obsolete handler (negative control)');
}
if(selectedCase==='source'){
  const source=sourceSource.replace('identity === this.groupSelectionId','true'),f=sourceFixture(source),panel=child(f.p,f.o,'ReaderSelectPanel'),oldId=panel.selectionId;
  f.o.dismissGroupSelection(oldId);f.o.toggleGroupSelection();panel.onDismiss(oldId);assert.equal(f.o.groupOpen,false,'removed opening identity lets old ACK close replacement');
}
if(selectedCase==='shelf'){
  const source=shelfSource.replace(' || identity !== this.moreSelectionId',''),f=shelfFixture(source),menu=child(f.p,f.o,'BookshelfMoreMenu'),oldDismiss=menu.onDismiss;
  f.events.at(-1).handler();f.o.moreOpenAction(f.events.at(-1).identity)();oldDismiss();assert.equal(f.o.moreMenuVisible,false,'removed menu admission lets old dismiss close replacement');
}
console.log('temporary back leaves SDK PASS: real settings phone/tablet choice and source collapse, shelf menu actions, live registered handlers, same-instance reentry, late callback/ACK rejection, no route consumption without a temporary layer; Index priority/native scheduling remain separate');

}
