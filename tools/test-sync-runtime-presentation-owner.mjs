import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { syncIndexFixture: f, fullSyncIndexPage }=await import("./lib/sync-index-real-fixture.mjs");
const clone = value => structuredClone(value);
async function until(predicate) {
  for (let n = 0; n < 2000; n++) {
    if (predicate()) return;
    await new Promise(setImmediate);
  }
  throw Error('actual platform boundary did not arrive');
}
function fixture() {
  const real = f.fixture({ createOwner: () => f.Orchestrator.forRuntime(f.ReaderRuntimeOwner.current()) });
  const presentations = new Map();
  const attach = id => {
    const state = { current: true, snapshot: clone(f.DEFAULT_SYNC_SNAPSHOT), emitted: [] };
    presentations.set(id, state);
    assert.equal(real.owner.attachPresentation(id, value => {
      state.snapshot = clone(value); state.emitted.push(clone(value));
    }, () => state.snapshot, () => state.current), true);
    return state;
  };
  return { ...real, attach, presentations };
}

// All methods are complete production Store/Gateway/owner methods. Platform
// AtomicFile uses the existing real-file adapter; the UI is SDK transformed.

try {
if(id==='config-transfer'){
{
  const x = fixture(), a = x.attach('a');
  x.owner.open(); await x.settle();
  assert.equal(a.snapshot.facts.read.fact, 'current');
  assert.equal(f.Orchestrator.forRuntime(x.runtime), x.owner);
  assert.equal(x.owner.isPresentationCurrent('a'), true);
  assert.equal(x.owner.attachPresentation('stale', () => {}, () => a.snapshot, () => false), false);
  assert.equal(x.owner.isPresentationCurrent('a'), true, 'stale attach cannot steal a live lease');
  const gate = f.pause(); f.asset.beforeAdd = () => gate.promise;
  x.owner.saveConfig(f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await until(() => f.asset.calls.includes('add'));
  a.current = false; x.owner.detachPresentation('a');
  const before = a.emitted.length, b = x.attach('b');
  assert.equal(x.owner.isPresentationCurrent('a'), false, 'old live Index cannot borrow replacement attachment');
  assert.equal(x.owner.isPresentationCurrent('b'), true);
  x.owner.open();
  assert.equal(b.snapshot.facts.busy, true, 'replacement observes the one original mutex');
  x.owner.saveConfig('https://new.test', 'new', 'new-pass', '', '/new');
  x.owner.triggerBackup();
  gate.resolve(); await x.settle();
  assert.equal(a.emitted.length, before, 'old Index receives no late publication');
  assert.equal(f.asset.calls.filter(v => v === 'add').length, 1, 'one accepted original durable config');
  assert.equal(x.runtime.count('sync.webdav.transaction.start'), 0, 'replacement cannot create another chain');
  assert.equal(b.snapshot.facts.operation.completed, false);
  assert.equal(b.snapshot.facts.operation.projection.receipt.confirmation, 'unknown',
    'replacement cannot lend its lease to an old config head write');
  assert.equal(b.snapshot.facts.operation.canContinueOriginal, true);
  assert.equal(b.snapshot.facts.busy, false);
  assert.doesNotMatch(JSON.stringify(b.snapshot), /transient-secret|independent-secret|new-pass/);
  const originalId = b.snapshot.facts.operation.operationId;
  x.owner.continueConfigSave(b.snapshot.facts.operation.projection.facts.generation,
    f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await x.settle();
  assert.equal(b.snapshot.facts.operation.operationId, originalId);
  assert.equal(b.snapshot.facts.operation.completed, true);
  assert.equal(b.snapshot.facts.operation.projection.receipt.confirmation, 'confirmed');
  assert.equal(f.asset.calls.filter(v => v === 'add').length, 1);
  x.owner.detachPresentation('a'); // stale cleanup must not detach b
  const beforeRead = b.emitted.length;
  x.owner.open(); await x.settle();
  assert.ok(b.emitted.length > beforeRead);
  const page = fullSyncIndexPage({ snapshot: b.snapshot, onReconcile: generation => x.owner.reconcile(generation) });
  assert.equal(page.snapshot.facts.operation.operationId, b.snapshot.facts.operation.operationId);
}
}
if(id==='restore-transfer'){
{
  const x = fixture(), a = x.attach('restore-a');
  x.owner.open(); await x.settle();
  x.owner.restoreLatest(); await x.settle();
  const gate = f.pause(); x.runtime.beforeApply = () => gate.promise;
  x.owner.resolveRestore(true);
  await until(() => x.runtime.count('runtime.storage.apply') === 1);
  a.current = false; x.owner.detachPresentation('restore-a');
  const before = a.emitted.length, b = x.attach('restore-b');
  x.owner.open(); x.owner.triggerBackup();
  gate.resolve(); await x.settle();
  assert.equal(a.emitted.length, before);
  assert.equal(x.runtime.count('runtime.storage.apply'), 1);
  assert.equal(b.snapshot.facts.operation.coreApplied, true);
  assert.equal(b.snapshot.facts.operation.completed, true);
  assert.equal(b.snapshot.facts.operation.projection.receipt.confirmation, 'confirmed');
}
}
if(id==='unknown-transfer'){
{
  const x = fixture(), a = x.attach('unknown-a');
  x.owner.open(); await x.settle();
  f.asset.failAdd = true;
  x.owner.saveConfig(f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await x.settle();
  const originalId = a.snapshot.facts.operation.operationId;
  assert.equal(a.snapshot.facts.operation.projection.receipt.confirmation, 'unknown');
  x.owner.detachPresentation('unknown-a'); a.current = false;
  const b = x.attach('unknown-b'); x.owner.open(); await x.settle();
  const writes = f.asset.calls.filter(v => v === 'add').length;
  assert.equal(b.snapshot.facts.operation.operationId, originalId);
  assert.equal(b.snapshot.facts.canMutate, false, 'page replacement cannot erase unknown barrier');
  x.owner.saveConfig('https://other.test', '', '', '', '/other'); await x.settle();
  assert.equal(f.asset.calls.filter(v => v === 'add').length, writes);
  x.owner.reconcile(b.snapshot.facts.operation.projection.facts.generation); await x.settle();
  assert.equal(b.snapshot.facts.operation.operationId, originalId);
  assert.equal(f.asset.calls.filter(v => v === 'add').length, writes, 'pure exact read does not dispatch another save');
}
}
if(id==='runtime-retirement'){
{
  const x = fixture(), a = x.attach('retired');
  x.owner.open(); await x.settle();
  const gate = f.pause(); f.asset.beforeAdd = () => gate.promise;
  x.owner.saveConfig(f.config.url, f.config.user, f.config.password, f.config.backupPassword, f.config.directory);
  await until(() => f.asset.calls.includes('add'));
  f.setRuntimeOwner(undefined);
  assert.equal(f.Orchestrator.forRuntime(x.runtime), undefined);
  assert.equal(x.owner.attachPresentation('replacement', () => {}, () => a.snapshot, () => true), false);
  const before = a.emitted.length;
  gate.resolve(); await x.settle();
  assert.equal(a.emitted.length, before);
  assert.equal(f.asset.calls.filter(v => v === 'add').length, 1);
  const y = fixture();
  assert.notEqual(y.owner, x.owner, 'replacement Runtime gets its own finite domain owner');
  assert.equal(y.owner.ownedBy(y.runtime), true);
}
}
}finally{f.cleanup();}
}
const definitions={"config-transfer": "config-transfer; actual production methods with explicit controlled platform ports", "restore-transfer": "restore-transfer; actual production methods with explicit controlled platform ports", "unknown-transfer": "unknown-transfer; actual production methods with explicit controlled platform ports", "runtime-retirement": "runtime-retirement; actual production methods with explicit controlled platform ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
