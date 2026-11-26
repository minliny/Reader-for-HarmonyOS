import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReaderPreparedPageSettlement, type ReaderPageTurnProgressTarget,
} from '../../entry/src/main/ets/features/reading/application/ReaderPreparedPageSettlement.ts';
import type { LocalReadingProgress } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';

function deferred<T>() {
  let complete!: (value: T) => void;
  let fail!: (error: Error) => void;
  const result = new Promise<T>((resolve, reject) => { complete = resolve; fail = reject; });
  return { result, complete, fail };
}

function nextTask(): Promise<void> { return new Promise((resolve) => setImmediate(resolve)); }

const target: ReaderPageTurnProgressTarget = { chapterIndex: 2, chapterOffset: 30, bodyVersion: 'body', processingVersion: 'rules' };
const receipt: LocalReadingProgress = {
  ...target, bookId: 'book', chapterProgress: 0.3, updatedAt: 10, locationRevision: 'destination',
};
const origin: LocalReadingProgress = { ...receipt, chapterOffset: 15, updatedAt: 8, locationRevision: 'origin' };

function fixture(observationTimeoutMs?: number) {
  const events: string[] = [];
  let gatewayReceipt: LocalReadingProgress | undefined;
  let current = true;
  let presented = false;
  let nextTimer = 0;
  const timers = new Map<number, () => void>();
  const write = deferred<LocalReadingProgress>();
  const preview = deferred<void>();
  const handoff = deferred<void>();
  const owner = new ReaderPreparedPageSettlement<ReaderPageTurnProgressTarget>({
    current: (prepared, lifecycle, generation) => current && prepared === target && lifecycle === 4 && generation === 9,
    canPresent: () => presented,
    persistPresented: () => { events.push('dispatch presented'); return preview.result; },
    write: (_prepared, currentWrite) => {
      assert.equal(currentWrite(), true);
      events.push('dispatch write');
      return write.result;
    },
    acquireWrite: () => {
      events.push('acquire lease');
      return () => { events.push('release lease'); };
    },
    gateway: () => ({
      runProgressCommitSerial: async (operation) => { events.push('enter serial'); await operation(); },
      loadProgress: async (bookId) => {
        events.push(`read ${bookId}`);
        return gatewayReceipt === undefined ? { kind: 'missing' } : { kind: 'restored', progress: gatewayReceipt };
      },
      handoffPendingProgress: () => { events.push('handoff unknown'); handoff.complete(); },
    }),
    bookId: () => 'book',
    position: (prepared) => prepared,
    origin: () => origin,
    releaseUnknownInput: () => { events.push('release input'); current = false; },
    finish: (generation, independent) => { events.push(`join ${generation} ${independent ?? false}`); },
    reportFailure: (error) => { events.push(`failure ${error.message}`); },
  }, {
    set: (delay, callback) => {
      assert.equal(delay, 2000);
      nextTimer += 1;
      timers.set(nextTimer, callback);
      return nextTimer;
    },
    clear: (id) => { timers.delete(id); },
  }, observationTimeoutMs);
  return {
    owner, events, write, preview, timers, handoff,
    supersede: () => { current = false; },
    allowPresentation: () => { presented = true; },
    readBack: (value: LocalReadingProgress) => { gatewayReceipt = value; },
    begin: () => { owner.stage(target); owner.begin(target, 4, 9); },
  };
}

test('visual endpoint and exact durable receipt join once even if the request is repeated', async () => {
  const run = fixture();
  run.begin();
  run.owner.begin(target, 4, 9);
  assert.deepEqual(run.events, ['acquire lease', 'dispatch write']);
  assert.equal(run.owner.join(true, false, () => true).action, 'wait');
  run.write.complete(receipt);
  await nextTask();
  assert.equal(run.owner.join(false, false, () => true).action, 'wait');
  assert.deepEqual(run.owner.join(true, false, () => true), { action: 'promote', prepared: target, stored: receipt });
  assert.deepEqual(run.events, ['acquire lease', 'dispatch write', 'release lease', 'join 9 false']);
  run.owner.discardDestination();
  assert.equal(run.owner.join(true, false, () => true).action, 'wait');
});

test('ordinary presented persistence dispatches before the visual join without fabricating a receipt', () => {
  const run = fixture();
  run.allowPresentation();
  run.begin();
  assert.deepEqual(run.events, ['dispatch presented', 'join 9 true']);
  assert.equal(run.owner.join(false, true, () => true).action, 'wait');
  assert.deepEqual(run.owner.join(true, true, () => true), { action: 'promote', prepared: target, stored: undefined });
  run.preview.complete();
});

test('a measured cross-chapter page cannot replace the retained frame after its layout is superseded', async () => {
  const run = fixture();
  run.begin();
  run.write.complete(receipt);
  await nextTask();
  assert.equal(run.owner.join(false, false, () => true).action, 'wait');
  assert.equal(run.owner.join(true, false, () => false).action, 'rollback');
  assert.equal(run.owner.prepared, undefined);
  assert.equal(run.owner.join(true, false, () => true).action, 'wait');
});

test('an exact target recovered from the serial read can present while an exact origin rolls back', async () => {
  for (const [stored, outcome] of [[receipt, 'promote'], [origin, 'rollback']] as const) {
    const run = fixture();
    run.readBack(stored);
    run.begin();
    run.write.fail(new Error('write acknowledgement lost'));
    await nextTask();
    assert.deepEqual(run.events, ['acquire lease', 'dispatch write', 'failure write acknowledgement lost',
      'enter serial', 'read book', 'release lease', 'join 9 false']);
    assert.equal(run.owner.join(true, false, () => true).action, outcome);
  }
});

test('another body version or origin revision is handed off without promoting or rolling back a guessed page', async () => {
  for (const unrelated of [{ ...receipt, bodyVersion: 'another' }, { ...origin, locationRevision: 'newer-origin' }]) {
    const run = fixture();
    run.readBack(unrelated);
    run.begin();
    run.write.fail(new Error('lost receipt'));
    await run.handoff.result;
    assert.deepEqual(run.events.slice(-2), ['handoff unknown', 'release input']);
    assert.equal(run.owner.commitFinished, false);
    assert.equal(run.owner.join(true, false, () => true).action, 'wait');
  }
});

test('a UI timeout hands off the unknown write and its late success drains only the original lease', async () => {
  const run = fixture(1);
  run.begin();
  await run.handoff.result;
  assert.deepEqual(run.events, ['acquire lease', 'dispatch write', 'handoff unknown', 'release input']);
  run.write.complete(receipt);
  await nextTask();
  assert.deepEqual(run.events, ['acquire lease', 'dispatch write', 'handoff unknown', 'release input', 'release lease']);
  assert.equal(run.owner.commitFinished, false);
});

test('settlement watchdog reads terminal, slot and phase evidence in the native order', async () => {
  const run = fixture();
  const queries: string[] = [];
  let terminal = true;
  let slots = false;
  let committed = true;
  let phase = 'settling';
  const evidence = {
    terminalReleased: () => { queries.push('terminal'); return terminal; },
    awaitingSlots: () => { queries.push('awaiting'); return slots; },
    slotsCommitted: () => { queries.push('committed'); return committed; },
    phase: () => { queries.push('phase'); return phase; },
  };
  assert.equal(run.owner.deadlineAction(evidence), 'terminal-ack');
  assert.deepEqual(queries.splice(0), ['terminal']);
  terminal = false;
  slots = true;
  assert.equal(run.owner.deadlineAction(evidence), 'slots-ack');
  assert.deepEqual(queries.splice(0), ['terminal', 'awaiting', 'committed']);
  committed = false;
  assert.equal(run.owner.deadlineAction(evidence), 'fallback');
  assert.deepEqual(queries.splice(0), ['terminal', 'awaiting', 'committed']);
  slots = false;
  phase = 'surfaceHidden';
  assert.equal(run.owner.deadlineAction(evidence), 'cleanup-surface');
  assert.deepEqual(queries.splice(0), ['terminal', 'awaiting', 'phase']);
  phase = 'settling';
  run.owner.stage(target);
  assert.equal(run.owner.deadlineAction(evidence), 'rollback');
  run.owner.begin(target, 4, 9);
  assert.equal(run.owner.deadlineAction(evidence), 'handoff-unknown');
  run.write.complete(receipt);
  await nextTask();
  assert.equal(run.owner.deadlineAction(evidence), 'finish-receipt');
  run.owner.discardDestination();
  assert.equal(run.owner.deadlineAction(evidence), 'finish-rollback');
});

test('only the current watchdog timer remains scheduled until settlement cancellation', () => {
  const run = fixture();
  const calls: string[] = [];
  run.owner.armDeadline(() => { calls.push('old'); });
  run.owner.armDeadline(() => { calls.push('latest'); });
  assert.equal(run.timers.size, 1);
  const [handle, callback] = [...run.timers.entries()][0];
  run.timers.delete(handle);
  callback();
  assert.deepEqual(calls, ['latest']);
  run.owner.armDeadline(() => { calls.push('cancelled'); });
  run.owner.cancelDeadline();
  assert.equal(run.timers.size, 0);
});
