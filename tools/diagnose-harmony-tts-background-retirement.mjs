import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { resolveOpenHarmonySdkRoot } from './lib/tool-environment.mjs';

const selected = selectContractCases({
  'late-cancel-retirement': { description: 'Actual owner retains exact cancel evidence after failed stop, then admits its successor', resources: [] },
  'retirement-boundaries': { description: 'Unresolved/mismatched task, off failure and unknown ACK cannot bypass retirement', resources: [] },
  'late-ack-retirement': { description: 'A native ACK arriving after close retains exact ownership until its cancellation settles', resources: [] },
  'sdk-exact-task-contract': { description: 'Installed SDK exact-ID stop, cancellation ID and callback-specific subscription declarations', resources: [] },
});
const productionUrl = new URL('../entry/src/main/ets/platform/tts/HarmonyTtsBackgroundSession.ts', import.meta.url);
const source = readFileSync(productionUrl, 'utf8');
const sourceSha256 = createHash('sha256').update(source).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const context = () => ({ abilityInfo: { bundleName: 'io.reader.minliny', name: 'EntryAbility' } });

function fixture() {
  const calls = [], listeners = new Set(), tasks = [];
  let next = 31, failStop = false, failOff = false, missingId = false, failReadback = false;
  const native = {
    on(event, listener) { assert.equal(event, 'continuousTaskCancel'); calls.push(['on']); listeners.add(listener); },
    off(event, listener) {
      assert.equal(event, 'continuousTaskCancel'); calls.push(['off']);
      if (failOff) throw Error('unsubscribe failed');
      listeners.delete(listener);
    },
    async getAllContinuousTasks() {
      if (failReadback) throw Error('readback failed');
      return tasks.map(task => ({ ...task }));
    },
    async startBackgroundRunning() {
      calls.push(['start']); const id = next++;
      tasks.push({ continuousTaskId: id, abilityName: 'EntryAbility', backgroundModes: ['audioPlayback'], isFromWebView: false });
      return { continuousTaskId: missingId ? undefined : id };
    },
    async stopBackgroundRunning(_context, id) {
      assert.ok(Number.isSafeInteger(id), 'retirement never uses context-only stop'); calls.push(['stop', id]);
      if (failStop) throw Error('release failed');
      const at = tasks.findIndex(task => task.continuousTaskId === id);
      // The SDK permits verification failures; it does not promise idempotent
      // success after native cancellation. This port is a failure injection,
      // not a claim about a particular device's absent-ID error mapping.
      if (at < 0) throw Object.assign(Error('continuous task verification failed'), { code: 9800005 });
      tasks.splice(at, 1);
    },
  };
  const want = { OperationType: { START_ABILITY: 1 }, WantAgentFlags: { UPDATE_PRESENT_FLAG: 2 }, async getWantAgent() { return {}; } };
  const Class = new Function('wantAgent', 'backgroundTaskManager', 'hilog', 'canIUse',
    stripTypeScriptTypes(source.replace(/^import[^;]*;\s*/gm, '')).replace(/^export /gm, '') + '; return HarmonyTtsBackgroundSession;')
    (want, native, { warn() {}, error() {} }, () => true);
  const owner = new Class(context());
  return {
    owner, Class, native, calls, listeners, tasks,
    cancel(id) {
      const at = tasks.findIndex(task => task.continuousTaskId === id);
      if (at >= 0) tasks.splice(at, 1);
      for (const listener of [...listeners]) listener({ id, reason: 1 });
    },
    set failStop(value) { failStop = value; }, set failOff(value) { failOff = value; },
    set missingId(value) { missingId = value; }, set failReadback(value) { failReadback = value; },
  };
}

async function lateCancelRetirement() {
  const f = fixture(); assert.equal(await f.owner.activate(), true);
  const id = f.owner.capability().taskId; f.failStop = true;
  await assert.rejects(f.owner.close(), /release failed/, 'the original stop failure remains visible');
  assert.deepEqual(f.owner.capability(), { phase: 'release-failed', taskId: id, reason: 'release failed' });
  const listenersAfterFailedStop = f.listeners.size;
  f.cancel(id); f.failStop = false;
  const successor = new f.Class(context());
  const admitted = await successor.activate();
  console.log(JSON.stringify({ kind: 'reader-tts-retirement-observation', sourceSha256,
    listenersAfterFailedStop, oldTaskSettled: f.owner.capability().taskId === undefined,
    successorAdmitted: admitted, startCount: f.calls.filter(call => call[0] === 'start').length }));
  assert.equal(admitted, true, 'matching late native cancellation must settle the retired ID and unblock the successor');
  assert.equal(listenersAfterFailedStop, 1, 'keep cancellation evidence until exact task settlement');
  assert.equal(f.owner.capability().taskId, undefined);
  assert.deepEqual(f.calls.filter(call => call[0] === 'stop'), [['stop', id]], 'no retry of an already cancelled ID');
  assert.ok(f.calls.findIndex(call => call[0] === 'off') < f.calls.findLastIndex(call => call[0] === 'start'));
  await successor.close(); assert.equal(f.tasks.length, 0); assert.equal(f.listeners.size, 0);
}

async function retirementBoundaries() {
  {
    const f = fixture(); await f.owner.activate(); const id = f.owner.capability().taskId;
    f.failStop = true; await assert.rejects(f.owner.close(), /release failed/);
    f.cancel(id + 1000); assert.equal(f.owner.capability().taskId, id, 'other task cancel cannot settle this ID');
    const successor = new f.Class(context());
    assert.equal(await successor.activate(), false, 'unresolved exact stop still blocks successor');
    assert.equal(f.calls.filter(call => call[0] === 'start').length, 1);
    assert.equal(f.calls.filter(call => call[0] === 'off').length, 0, 'failed stop retains its listener');
    f.cancel(id); f.failStop = false; f.failOff = true;
    assert.equal(await successor.activate(), false, 'listener release failure remains a retirement barrier');
    assert.equal(f.owner.capability().taskId, undefined); assert.equal(f.listeners.size, 1);
    assert.equal(f.owner.capability().phase, 'release-failed');
    f.failOff = false; assert.equal(await successor.activate(), true);
    f.cancel(id); assert.equal(successor.isActive(), true, 'old exact cancellation cannot revoke the successor');
    await successor.close(); assert.equal(f.listeners.size, 0); assert.equal(f.tasks.length, 0);
  }
  {
    const f = fixture(); f.missingId = true; f.failReadback = true;
    assert.equal(await f.owner.activate(), false);
    await assert.rejects(f.owner.close(), /no verified native identity/);
    assert.equal(f.owner.capability().phase, 'unverified');
    assert.equal(f.listeners.size, 0, 'unknown ACK keeps its existing explicit identity barrier, not an unusable exact-ID listener');
    const successor = new f.Class(context()); assert.equal(await successor.activate(), false);
    assert.equal(f.calls.filter(call => call[0] === 'start').length, 1);
    assert.deepEqual(f.calls.filter(call => call[0] === 'stop'), [], 'unknown ownership never dispatches broad cleanup');
  }
}

async function lateAckRetirement() {
  const f = fixture(), ack = deferred(); let revoked = 0;
  f.owner.setRevocationListener(() => revoked++);
  f.native.startBackgroundRunning = async () => {
    f.calls.push(['start']); const result = await ack.promise;
    f.tasks.push({ continuousTaskId: result.continuousTaskId, abilityName: 'EntryAbility', backgroundModes: ['audioPlayback'], isFromWebView: false });
    return result;
  };
  const activation = f.owner.activate(); await tick(); f.failStop = true;
  const close = assert.rejects(f.owner.close(), /release failed/);
  ack.resolve({ continuousTaskId: 71 });
  assert.equal(await activation, false, 'late ACK cannot revive a closed owner'); await close;
  assert.equal(f.owner.capability().taskId, 71); assert.equal(f.listeners.size, 1);
  f.cancel(71); assert.equal(revoked, 0, 'closed owner has no external revocation effect');
  assert.equal(f.owner.isActive(), false); assert.equal(f.owner.capability().taskId, undefined);
  // Restore the regular SDK start port after the one deferred ACK.
  f.native.startBackgroundRunning = async () => {
    f.calls.push(['start']); f.tasks.push({ continuousTaskId: 72 }); return { continuousTaskId: 72 };
  };
  const successor = new f.Class(context()); assert.equal(await successor.activate(), true);
  assert.ok(f.calls.filter(call => call[0] === 'stop').every(call => call[1] === 71));
  f.failStop = false; await successor.close(); assert.equal(f.tasks.length, 0); assert.equal(f.listeners.size, 0);
}

function sdkExactTaskContract() {
  const path = join(resolveOpenHarmonySdkRoot(), 'ets/api/@ohos.resourceschedule.backgroundTaskManager.d.ts');
  const bytes = readFileSync(path), sdk = bytes.toString('utf8');
  const exact = 'function stopBackgroundRunning(context: Context, continuousTaskId: number): Promise<void>;';
  const offset = sdk.indexOf(exact); assert.ok(offset >= 0, 'target SDK must expose exact-ID stop');
  const comment = sdk.slice(sdk.lastIndexOf('/**', offset), offset);
  assert.match(comment, /@since 21/); assert.match(comment, /9800005 - Continuous task verification failed/);
  assert.match(sdk, /interface ContinuousTaskCancelInfo\s*\{[\s\S]*?\n\s*id: number;\s*\n\s*\}/);
  assert.match(sdk, /function on\(type: 'continuousTaskCancel', callback: Callback<ContinuousTaskCancelInfo>\): void;/);
  assert.match(sdk, /function off\(type: 'continuousTaskCancel', callback\?: Callback<ContinuousTaskCancelInfo>\): void;/);
  console.log(JSON.stringify({ kind: 'reader-tts-sdk-contract', path,
    sha256: createHash('sha256').update(bytes).digest('hex'), exactStopLine: sdk.slice(0, offset).split('\n').length,
    absentIdIdempotency: 'NOT_ESTABLISHED_BY_DECLARATION', deviceBehavior: 'NOT_RUN' }));
}

for (const id of selected) {
  if (id === 'late-cancel-retirement') await lateCancelRetirement();
  if (id === 'retirement-boundaries') await retirementBoundaries();
  if (id === 'late-ack-retirement') await lateAckRetirement();
  if (id === 'sdk-exact-task-contract') sdkExactTaskContract();
  recordContractCasePass(id);
}
