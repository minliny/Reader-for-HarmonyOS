import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeReaderFirstPage, persistReaderMeasuredProgress, ReaderOrdinaryFirstPagePersistence,
  type ReaderFirstPageMeasurementLease, type ReaderFirstPagePlan, type ReaderMeasuredProgressGateway,
  type ReaderOrdinaryFirstPageReceipt } from '../../entry/src/main/ets/features/reading/application/ReaderFirstPageAdmission.ts';
import { CoreReadingAnchor, createCoreReadingLayout } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { ReaderProgressProducerHost, type ReaderProgressProducerIntent } from '../../entry/src/main/ets/features/reading/application/ReaderProgressProducerHost.ts';
import type { ReadingSessionCommittedProgress } from '../../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts';

const anchor = new CoreReadingAnchor(7, 25, 0.25, 'body', 'processing');
const layout = createCoreReadingLayout(400, 800, 1.5, 36);
const stored: ReadingSessionCommittedProgress = {
  ...anchor, bookId: 'book', updatedAt: 100, sourceSwitchTransactionId: 'switch',
};

function measuredPage() {
  const calls: string[] = [];
  const write = Promise.withResolvers<ReadingSessionCommittedProgress>();
  const state = { measurement: true, selection: true, candidate: false, layoutSignature: 'measured' };
  let admission: (() => boolean) | undefined;
  const lease: ReaderFirstPageMeasurementLease = {
    isCurrent: () => state.measurement,
    liveLayoutSignature: () => state.layoutSignature,
    resumeSuperseded: signature => {
      if (!state.selection || signature === state.layoutSignature) return false;
      if (state.measurement) calls.push('remeasure');
      return true;
    },
    hasCurrentControlCandidate: () => state.selection && state.candidate,
    fail: error => { calls.push('fail:' + error.message); },
  };
  const plan = (signature: string): ReaderFirstPagePlan => {
    assert.equal(signature, 'measured');
    calls.push('capture');
    return {
      kind: 'durable',
      persist: check => { admission = check; calls.push('write'); return write.promise; },
      matchesAnchor: result => {
        calls.push('anchor');
        return result.chapterIndex === anchor.chapterIndex && result.chapterOffset === anchor.chapterOffset;
      },
      admitSavedProgress: result => { assert.equal(result, stored); calls.push('admit'); },
      present: result => { assert.equal(result, stored); calls.push('present'); },
    };
  };
  return { calls, write, state, lease, plan, isAdmitted: () => admission?.() };
}

test('a retired measurement reaches neither chapter capture nor presentation', async () => {
  const fixture = measuredPage();
  fixture.state.measurement = false;
  await completeReaderFirstPage(fixture.lease, fixture.plan);
  assert.deepEqual(fixture.calls, []);
});

test('ordinary publication is synchronous while its save is pending', async () => {
  const fixture = measuredPage();
  const persistence = Promise.withResolvers<void>();
  const completion = completeReaderFirstPage(fixture.lease, signature => {
    assert.equal(signature, 'measured');
    return { kind: 'ordinary', present: () => { fixture.calls.push('input-ready'); return persistence.promise; } };
  });
  assert.deepEqual(fixture.calls, ['input-ready']);
  persistence.resolve();
  await completion;
  assert.deepEqual(fixture.calls, ['input-ready']);
});

test('a canonical page waits for the exact durable receipt', async () => {
  const fixture = measuredPage();
  const completion = completeReaderFirstPage(fixture.lease, fixture.plan);
  assert.deepEqual(fixture.calls, ['capture', 'write']);
  assert.equal(fixture.isAdmitted(), true);
  fixture.write.resolve(stored);
  await completion;
  assert.deepEqual(fixture.calls, ['capture', 'write', 'anchor', 'present']);
});

test('a layout change before dispatch restarts measurement without writing', async () => {
  const fixture = measuredPage();
  await completeReaderFirstPage(fixture.lease, signature => {
    fixture.state.layoutSignature = 'next';
    return fixture.plan(signature);
  });
  assert.deepEqual(fixture.calls, ['capture', 'remeasure']);
});

test('an exact receipt after reflow admits only saved progress and restarts measurement', async () => {
  const fixture = measuredPage();
  const completion = completeReaderFirstPage(fixture.lease, fixture.plan);
  fixture.state.layoutSignature = 'next';
  assert.equal(fixture.isAdmitted(), false);
  fixture.write.resolve(stored);
  await completion;
  assert.deepEqual(fixture.calls, ['capture', 'write', 'anchor', 'admit', 'remeasure']);
});

test('a wrong canonical anchor is still an integrity failure during reflow', async () => {
  const fixture = measuredPage();
  const completion = completeReaderFirstPage(fixture.lease, fixture.plan);
  fixture.state.layoutSignature = 'next';
  fixture.write.resolve({ ...stored, chapterOffset: 26 });
  await completion;
  assert.deepEqual(fixture.calls, ['capture', 'write', 'anchor', 'fail:READING_INITIAL_PROGRESS_ANCHOR_MISMATCH']);
});

test('a newer measurement suppresses a settled old receipt and changed-layout rejection', async () => {
  for (const result of ['receipt', 'rejection']) {
    const fixture = measuredPage();
    const completion = completeReaderFirstPage(fixture.lease, fixture.plan);
    fixture.state.measurement = false;
    fixture.state.layoutSignature = 'next';
    fixture.state.candidate = true;
    assert.equal(fixture.isAdmitted(), false);
    if (result === 'receipt') fixture.write.resolve(stored);
    else fixture.write.reject(new Error('WRITE_FAILED'));
    await completion;
    assert.deepEqual(fixture.calls, ['capture', 'write']);
  }
});

test('only a still-selected pending control candidate can fail after its measurement is retired', async () => {
  for (const selection of [true, false]) {
    const fixture = measuredPage();
    const completion = completeReaderFirstPage(fixture.lease, fixture.plan);
    fixture.state.measurement = false;
    fixture.state.candidate = true;
    fixture.state.selection = selection;
    fixture.write.reject(new Error('WRITE_FAILED'));
    await completion;
    assert.deepEqual(fixture.calls, selection ? ['capture', 'write', 'fail:WRITE_FAILED'] : ['capture', 'write']);
  }
});

test('the measured progress route passes the unchanged receipt and guard to the existing durable owner', async () => {
  const calls: string[] = [];
  const isAdmitted = () => true;
  let pendingSwitch = false;
  const args = ['book', 'title', anchor, layout, isAdmitted];
  const gateway: ReaderMeasuredProgressGateway = {
    hasPendingSourceSwitch: () => pendingSwitch,
    persistPresentedProgress: async (...actual) => { assert.deepEqual(actual, args); calls.push('presented'); return stored; },
    persistCanonicalProgress: async (...actual) => { assert.deepEqual(actual, args); calls.push('canonical'); return stored; },
  };
  assert.equal(await persistReaderMeasuredProgress(() => gateway, 'book', 'title', anchor, layout, isAdmitted), stored);
  pendingSwitch = true;
  assert.equal(await persistReaderMeasuredProgress(() => gateway, 'book', 'title', anchor, layout, isAdmitted), stored);
  assert.deepEqual(calls, ['presented', 'canonical']);
});

function ordinaryPage() {
  const calls: string[] = [];
  const write = Promise.withResolvers<ReadingSessionCommittedProgress>();
  const state = { mounted: true, positionCurrent: true, layoutCurrent: true, producerCurrent: true };
  const owner = new ReaderOrdinaryFirstPagePersistence();
  const producer = new ReaderProgressProducerHost();
  const intent: ReaderProgressProducerIntent = {
    sourceId: 'source', bookId: 'book', title: 'title', anchor, layout,
    gateway: {
      runProgressCommitSerial: () => assert.fail('first-page producer uses the Gateway write owner'),
      persistPresentedProgress: (...args) => {
        assert.deepEqual(args, ['book', 'title', anchor, layout]);
        calls.push('dispatch');
        return write.promise;
      },
      loadProgress: () => assert.fail('receipt observation cannot read or retry progress'),
    },
    isOwner: () => state.producerCurrent,
    isCurrent: () => state.producerCurrent,
    committed: () => undefined,
    publish: result => { assert.equal(result, stored); calls.push('admit'); },
  };
  const receipt: ReaderOrdinaryFirstPageReceipt = {
    traceIfReaderCurrent: () => {
      if (!state.mounted) return false;
      calls.push('trace');
      return true;
    },
    isPresentationCurrent: () => { calls.push('visible-guard'); return state.positionCurrent; },
    layoutIsCurrent: () => state.layoutCurrent,
    requestRemeasurement: () => { calls.push('remeasure'); },
    ready: () => { calls.push('ready'); },
    failed: error => { calls.push('log:' + error.message); },
  };
  return { calls, write, state, owner, run: (presentedTurn = false) => owner.persist(producer, () => intent, presentedTurn, receipt) };
}

test('the ordinary first paint observes the producer receipt using the separate visible-page guard', async () => {
  const fixture = ordinaryPage();
  fixture.state.producerCurrent = false;
  const observed = fixture.run();
  assert.ok(fixture.owner.pending());
  assert.deepEqual(fixture.calls, ['dispatch']);
  fixture.write.resolve(stored);
  await observed;
  assert.deepEqual(fixture.calls, ['dispatch', 'trace', 'visible-guard', 'visible-guard', 'ready']);
  fixture.owner.release();
  assert.equal(fixture.owner.pending(), undefined);
});

test('a normal turn never releases first-paint callbacks, and a first-paint reflow only requests measurement', async () => {
  for (const presentedTurn of [true, false]) {
    const fixture = ordinaryPage();
    fixture.state.layoutCurrent = false;
    const observed = fixture.run(presentedTurn);
    fixture.write.resolve(stored);
    await observed;
    const common = ['dispatch', 'admit', 'trace', 'visible-guard', 'visible-guard'];
    assert.deepEqual(fixture.calls, presentedTurn ? common : [...common, 'remeasure']);
  }
});

test('ordinary save failure remains observable to mutation even while UI only logs it', async () => {
  const fixture = ordinaryPage();
  const observed = fixture.run();
  const pending = fixture.owner.pending();
  assert.ok(pending);
  const rejected = assert.rejects(pending, /READING_INITIAL_PROGRESS_ANCHOR_MISMATCH/);
  fixture.write.resolve({ ...stored, bodyVersion: 'other-body' });
  await rejected;
  await observed;
  assert.equal(fixture.owner.pending(), pending);
  assert.deepEqual(fixture.calls, ['dispatch', 'log:READING_INITIAL_PROGRESS_ANCHOR_MISMATCH']);
});

test('an ordinary receipt leaves unmounted and replaced presentations alone', async () => {
  for (const mounted of [true, false]) {
    const fixture = ordinaryPage();
    const observed = fixture.run();
    fixture.state.mounted = mounted;
    fixture.state.positionCurrent = false;
    fixture.state.producerCurrent = false;
    fixture.state.layoutCurrent = false;
    fixture.write.resolve(stored);
    await observed;
    assert.deepEqual(fixture.calls, mounted ? ['dispatch', 'trace', 'visible-guard'] : ['dispatch']);
  }
});
