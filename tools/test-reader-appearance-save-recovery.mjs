import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

// No implicit suite: no arguments and --list report definitions as NOT_RUN.
// Production imports occur only after an explicit --case selection.
const selected = selectContractCases({
  'observer-isolation': 'Actual Store snapshot and SaveState observers cannot reject accepted changes, skip persistence, or block later observers.',
  'latest-ack': 'Accepted complete snapshots survive an original failed save and an older retry ACK; only the latest revision ACK clears recovery.',
  'retry-admission': 'Stale, duplicate and busy retries do not dispatch; failed retry remains recoverable and newer ordinary changes keep their own complete snapshot.',
  'warm-unconfirmed': 'A warm unconfirmed load retains recovery without a write or invented durable ACK; explicit current retry persists the complete snapshot.',
});

if (selected.length > 0) {
  const { ReaderAppearanceStore } = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts');
  const { createDefaultReaderAppearanceSnapshot, copyReaderAppearanceSnapshot,
    normalizeReaderAppearanceSnapshot } = await import('../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts');

  const boundary = 'Actual Store/State pure methods through normal load/change/commit.saved/retrySave; controlled finite Persistence ACKs. No Preferences, file durability, UI projection, platform SDK or native acceptance is exercised.';

  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }

  // Attach both outcomes before rejecting any finite persistence ACK.
  function observe(promise) {
    let settled = false;
    const result = Promise.resolve(promise).then(
      value => { settled = true; return { status: 'fulfilled', value }; },
      error => { settled = true; return { status: 'rejected', error }; },
    );
    return { result, settled: () => settled };
  }

  async function until(predicate, label) {
    // Bounded microtasks only: a missing dispatch fails instead of waiting on IO.
    for (let turn = 0; turn < 100; turn++) {
      if (predicate()) return;
      await Promise.resolve();
    }
    assert.fail(label);
  }

  async function fulfilled(receipt, label) {
    await until(receipt.settled, `${label}: expected receipt did not settle`);
    const result = await receipt.result;
    assert.equal(result.status, 'fulfilled', label);
    return result.value;
  }

  async function rejected(receipt, expected, label) {
    await until(receipt.settled, `${label}: expected rejection did not settle`);
    const result = await receipt.result;
    assert.equal(result.status, 'rejected', label);
    assert.equal(result.error, expected, 'the original persistence rejection is preserved');
  }

  function fixture({ initial = createDefaultReaderAppearanceSnapshot(), warm = false } = {}) {
    const loaded = normalizeReaderAppearanceSnapshot(initial);
    const writes = [];
    let loads = 0;
    const persistence = {
      async load() { loads += 1; return copyReaderAppearanceSnapshot(loaded); },
      hasUnconfirmedSave() { return warm; },
      save(snapshot) {
        const ack = deferred();
        writes.push({ snapshot: copyReaderAppearanceSnapshot(snapshot), ack });
        return ack.promise;
      },
    };
    const store = new ReaderAppearanceStore(persistence);
    return { store, writes, loads: () => loads, loaded };
  }

  async function writeAt(f, index, expected) {
    await until(() => f.writes.length > index, `missing persistence write ${index + 1}`);
    assert.deepEqual(f.writes[index].snapshot, expected, 'persistence receives the accepted complete snapshot');
    return f.writes[index];
  }

  async function changeTo(f, snapshot) {
    const commit = await f.store.change(() => copyReaderAppearanceSnapshot(snapshot));
    assert.ok(commit, 'normal unguarded selection is accepted');
    return { commit, receipt: observe(commit.saved) };
  }

  async function observerIsolation() {
    const f = fixture();
    const snapshots = [];
    const states = [];
    const observerError = new Error('finite presentation observer failure');
    f.store.subscribe(() => { throw observerError; });
    f.store.subscribe((snapshot, revision) => snapshots.push({ snapshot, revision }));
    assert.doesNotThrow(() => f.store.subscribeSaveState(() => { throw observerError; }));
    f.store.subscribeSaveState(state => states.push(state));

    assert.deepEqual(await f.store.load(), f.loaded, 'observer failure cannot reject the original load');
    assert.deepEqual(snapshots.at(-1), { snapshot: f.loaded, revision: 0 }, 'a later snapshot observer receives load publication');
    assert.equal(f.writes.length, 0, 'load does not dispatch persistence');
    assert.doesNotThrow(() => f.store.subscribe(() => { throw observerError; }), 'immediate loaded snapshot delivery is isolated');

    const first = normalizeReaderAppearanceSnapshot({ ...f.loaded, fontSize: 20 });
    const accepted = await changeTo(f, first);
    const firstWrite = await writeAt(f, 0, first);
    assert.deepEqual(f.store.current(), first);
    assert.deepEqual(snapshots.at(-1), { snapshot: first, revision: accepted.commit.revision });
    assert.ok(states.some(state => state.revision === accepted.commit.revision && state.saving && !state.retrying),
      'later SaveState observer receives the ordinary pending write');
    assert.equal(accepted.receipt.settled(), false, 'observer exceptions cannot manufacture a durable ACK');
    firstWrite.ack.resolve();
    await fulfilled(accepted.receipt, 'original native success remains success');
    assert.equal(f.store.hasUnsavedChanges(), false);

    const second = normalizeReaderAppearanceSnapshot({ ...first, fontSize: 21 });
    const failed = await changeTo(f, second);
    const secondWrite = await writeAt(f, 1, second);
    const nativeError = new Error('finite original flush rejection');
    secondWrite.ack.reject(nativeError);
    await rejected(failed.receipt, nativeError, 'observer isolation does not swallow a real write rejection');
    assert.deepEqual(f.store.current(), second, 'failed durability does not revert accepted intent');
    assert.equal(f.store.saveState().unconfirmed, true);
    assert.equal(states.at(-1).unconfirmed, true, 'later observer receives the persistent unconfirmed fact');
    assert.deepEqual(snapshots.at(-1).snapshot, second);
    assert.equal(f.writes.length, 2, 'each accepted distinct change dispatches exactly once');
    return { originalWrites: 2, snapshotObserversContinued: true, saveObserversContinued: true };
  }

  async function latestAck() {
    const f = fixture();
    await f.store.load();
    const first = normalizeReaderAppearanceSnapshot({ ...f.loaded, fontSize: 22 });
    const failed = await changeTo(f, first);
    const firstWrite = await writeAt(f, 0, first);
    const originalError = new Error('finite first save failure');
    firstWrite.ack.reject(originalError);
    await rejected(failed.receipt, originalError, 'first save is unconfirmed');
    assert.deepEqual(f.store.current(), first);
    assert.equal(f.store.saveState().unconfirmed, true);

    const retry = observe(f.store.retrySave(failed.commit.revision));
    const olderRetryWrite = await writeAt(f, 1, first);
    const latest = normalizeReaderAppearanceSnapshot({ ...first, fontSize: 24, letterSpacing: 1,
      fontOrder: first.fontOrder.slice().reverse() });
    const newer = await changeTo(f, latest);
    assert.ok(newer.commit.revision > failed.commit.revision);
    assert.equal(f.writes.length, 2, 'newer complete snapshot waits behind the original retry write');
    assert.deepEqual(f.store.current(), latest, 'pending older ACK cannot replace newer accepted intent');
    assert.equal(f.store.saveState().unconfirmed, true);

    olderRetryWrite.ack.resolve();
    const latestWrite = await writeAt(f, 2, latest);
    assert.equal(newer.receipt.settled(), false);
    assert.deepEqual(f.store.current(), latest);
    assert.equal(f.store.saveState().revision, newer.commit.revision);
    assert.equal(f.store.saveState().unconfirmed, true, 'an older revision ACK cannot clear latest recovery');
    latestWrite.ack.resolve();
    await fulfilled(newer.receipt, 'latest original write receives its own ACK');
    await fulfilled(retry, 'retry flush joins the ordered newer accepted write');
    assert.equal(f.store.saveState().unconfirmed, false);
    assert.equal(f.store.hasUnsavedChanges(), false);
    assert.deepEqual(f.store.current(), latest);
    assert.equal(f.writes.length, 3, 'no compensation or extra stale retry is dispatched');
    return { orderedWrites: 3, olderAckDidNotClearRecovery: true, acceptedIntentPreserved: true };
  }

  async function retryAdmission() {
    const f = fixture();
    await f.store.load();
    const first = normalizeReaderAppearanceSnapshot({ ...f.loaded, fontSize: 23 });
    const initial = await changeTo(f, first);
    const initialWrite = await writeAt(f, 0, first);
    assert.equal(f.store.saveState().saving, true);
    assert.equal(f.store.saveState().retrying, false, 'ordinary save is not retry busy');
    const firstError = new Error('finite initial save failure');
    initialWrite.ack.reject(firstError);
    await rejected(initial.receipt, firstError, 'initial save fails');

    await f.store.retrySave(initial.commit.revision - 1);
    assert.equal(f.writes.length, 1, 'stale retry dispatches nothing');
    const retry = observe(f.store.retrySave(initial.commit.revision));
    assert.equal(f.store.saveState().retrying, true, 'actual explicit retry owns retry busy');
    await f.store.retrySave(initial.commit.revision);
    const retryWrite = await writeAt(f, 1, first);
    assert.equal(f.writes.length, 2, 'duplicate retry cannot dispatch another write');
    const retryError = new Error('finite retry save failure');
    retryWrite.ack.reject(retryError);
    await rejected(retry, retryError, 'failed retry keeps the original rejection');
    assert.equal(f.store.saveState().retrying, false);
    assert.equal(f.store.saveState().unconfirmed, true);
    assert.equal(f.store.saveState().canRetry, true, 'failed retry retires busy and permits another current attempt');

    const latest = normalizeReaderAppearanceSnapshot({ ...first, fontSize: 26, paragraphSpacing: 12 });
    const newer = await changeTo(f, latest);
    const newerWrite = await writeAt(f, 2, latest);
    assert.equal(f.store.saveState().saving, true);
    assert.equal(f.store.saveState().retrying, false, 'a newer ordinary save does not inherit retry busy');
    await f.store.retrySave(initial.commit.revision);
    await f.store.retrySave(newer.commit.revision);
    assert.equal(f.writes.length, 3, 'stale and busy retries do not dispatch beside the newer original write');
    const newerError = new Error('finite newer save failure');
    newerWrite.ack.reject(newerError);
    await rejected(newer.receipt, newerError, 'newer original save is unconfirmed');
    assert.deepEqual(f.store.current(), latest);

    const currentRetry = observe(f.store.retrySave(newer.commit.revision));
    const currentWrite = await writeAt(f, 3, latest);
    await f.store.retrySave(newer.commit.revision);
    assert.equal(f.writes.length, 4, 'current retry is single flight');
    currentWrite.ack.resolve();
    await fulfilled(currentRetry, 'current complete-snapshot retry succeeds');
    assert.equal(f.store.saveState().unconfirmed, false);
    assert.equal(f.store.saveState().retrying, false);
    assert.equal(f.store.saveState().canRetry, false);
    assert.deepEqual(f.store.current(), latest, 'no earlier accepted snapshot was restored');
    assert.equal(f.writes.length, 4);
    return { persistenceWrites: 4, staleAndDuplicateDispatches: 0, newerSnapshotRetained: true };
  }

  async function warmUnconfirmed() {
    const initial = normalizeReaderAppearanceSnapshot({ ...createDefaultReaderAppearanceSnapshot(),
      fontSize: 27, paragraphSpacing: 12, letterSpacing: 1 });
    const f = fixture({ initial, warm: true });
    const states = [];
    f.store.subscribeSaveState(state => states.push(state));
    assert.deepEqual(await f.store.load(), initial);
    const revision = f.store.currentRevision();
    assert.ok(revision > 0);
    assert.equal(f.store.hasUnsavedChanges(), true);
    assert.equal(f.store.saveState().unconfirmed, true, 'warm cache is not durable confirmation');
    assert.equal(f.store.saveState().canRetry, true);
    assert.equal(f.writes.length, 0, 'loading the warm snapshot does not automatically write');
    assert.equal(states.at(-1).unconfirmed, true, 'warm recovery is published to current observers');
    await f.store.retrySave(revision - 1);
    assert.equal(f.writes.length, 0);

    const retry = observe(f.store.retrySave(revision));
    const write = await writeAt(f, 0, initial);
    assert.equal(retry.settled(), false);
    assert.equal(f.store.saveState().unconfirmed, true);
    assert.equal(f.store.saveState().retrying, true);
    write.ack.resolve();
    await fulfilled(retry, 'warm accepted snapshot receives an actual save ACK');
    assert.equal(f.store.saveState().unconfirmed, false);
    assert.equal(f.store.hasUnsavedChanges(), false);
    assert.equal(f.store.currentRevision(), revision, 'retry does not create another user intent');
    assert.deepEqual(f.store.current(), initial);
    assert.equal(f.loads(), 1);
    assert.equal(f.writes.length, 1);
    return { warmLoadWrites: 0, explicitRetryWrites: 1, durableAckRequired: true };
  }

  const cases = {
    'observer-isolation': observerIsolation,
    'latest-ack': latestAck,
    'retry-admission': retryAdmission,
    'warm-unconfirmed': warmUnconfirmed,
  };
  for (const id of selected) {
    const result = await cases[id]();
    console.log(JSON.stringify({ case: id, result, boundary }));
    recordContractCasePass(id);
  }
}
