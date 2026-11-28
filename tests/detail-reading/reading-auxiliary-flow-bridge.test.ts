import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadingAuxiliaryCapsuleMeasurements, ReadingAuxiliaryFlowBridge, type ReadingAutomaticPageHost,
  type ReadingCapsuleMeasurement } from '../../entry/src/main/ets/features/reading/application/ReadingAuxiliaryFlowBridge.ts';
import { ReadingCommit } from '../../entry/src/main/ets/features/reading/application/ReadingCommit.ts';
import { ReaderAutoPageCoordinator } from '../../entry/src/main/ets/features/reading/ui/ReaderAutoPageCoordinator.ts';
import type { ReadingPrefetchActivity } from '../../entry/src/main/ets/features/reading/application/ReadingPrefetchHost.ts';

function receipt(offset: number, chapter: number = 8): ReadingCommit {
  return new ReadingCommit('source', 'book', chapter, offset, offset / 100, 'location', 280);
}

test('automatic paging dispatches speech pause before starting and drops failures from retired actors', async () => {
  const pause = Promise.withResolvers<void>();
  const calls: string[] = [];
  const automaticPage = new ReaderAutoPageCoordinator({
    now: () => 0, schedule: () => 1, cancel: () => {}, active: () => true, ready: () => true,
    canResumeTurn: () => true, turn: () => ({ kind: 'busy' }), changed: () => {},
  });
  let liveSpeech = {
    pause: () => { calls.push('speech-pause'); return pause.promise; },
  };
  const host: ReadingAutomaticPageHost = {
    inputAllowed: () => true, retirePendingStarts: assert.fail,
    cancelSpeechStart: () => calls.push('cancel-speech-start'),
    status: () => automaticPage.snapshot(0).status,
    pause: () => { calls.push('manual-pause'); automaticPage.pause('manual'); },
    canStart: () => !automaticPage.pendingStart(),
    speech: () => liveSpeech, beginStart: () => automaticPage.beginStart(), speechPauseNeeded: () => true,
    speechPauseCurrent: (speech, generation) => () => liveSpeech === speech && automaticPage.isStartCurrent(generation),
    pauseFailed: () => calls.push('show-pause-failure'),
    admitStart: generation => automaticPage.admitStart(generation),
    start: resuming => { assert.equal(resuming, false); calls.push('start'); automaticPage.start(); },
  };
  const bridge = new ReadingAuxiliaryFlowBridge();
  bridge.toggleAutomaticPaging(host);
  assert.deepEqual(calls, ['cancel-speech-start', 'speech-pause', 'start']);
  assert.equal(automaticPage.snapshot(0).status, 'running');
  liveSpeech = { pause: async () => {} };
  pause.reject(new Error('replaced transport'));
  await Promise.resolve();
  assert.deepEqual(calls, ['cancel-speech-start', 'speech-pause', 'start']);
  bridge.toggleAutomaticPaging(host);
  assert.equal(automaticPage.snapshot(0).status, 'paused');
  assert.deepEqual(calls.slice(3), ['cancel-speech-start', 'manual-pause']);
});

test('prefetch projects a confirmed scalar of the visible chapter and preserves retire and yield facts', () => {
  const bridge = new ReadingAuxiliaryFlowBridge();
  const events: ReadingPrefetchActivity[] = [];
  bridge.reportPrefetch({ chapterIndex: 8, committed: receipt(45), pageStart: 60, active: true, playing: true },
    false, false, event => events.push(event));
  bridge.reportPrefetch({ chapterIndex: 8, committed: receipt(45, 9), pageStart: 60, active: false, playing: true },
    true, true, event => events.push(event));
  assert.deepEqual(events, [
    { chapterIndex: 8, chapterOffset: 45, active: true, playing: true, interacted: false, yieldToReading: false },
    { chapterIndex: 8, chapterOffset: 60, active: false, playing: true, interacted: true, yieldToReading: true },
  ]);
});

test('a mutated book position must still match the rendered scalar after first-page and serialized writes', async () => {
  const bridge = new ReadingAuxiliaryFlowBridge();
  const first = Promise.withResolvers<void>();
  const serial = Promise.withResolvers<void>();
  const write = Promise.withResolvers<void>();
  const calls: string[] = [];
  let current = true;
  const gateway = {
    hasPendingSourceSwitch: () => false,
    runProgressCommitSerial: async (task: () => Promise<void>) => {
      calls.push('serial');
      await serial.promise;
      await task();
    },
  };
  const host = {
    firstPagePersistence: () => { calls.push('first-page'); return first.promise; },
    gateway: () => { calls.push('gateway'); return gateway; },
    capture: (owner: typeof gateway) => {
      assert.equal(owner, gateway);
      calls.push('capture');
      return { sourceId: 'source', bookId: 'book', chapterIndex: 8, offset: 45,
        current: () => current, persist: () => { calls.push('write'); return write.promise; } };
    },
    committed: () => receipt(45),
  };
  const completion = bridge.confirmPositionForMutation(host);
  assert.deepEqual(calls, ['first-page']);
  first.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['first-page', 'gateway', 'serial']);
  serial.resolve();
  write.resolve();
  assert.equal((await completion)(), true);
  assert.deepEqual(calls, ['first-page', 'gateway', 'serial', 'capture', 'write']);
  current = false;
  await assert.rejects(bridge.confirmPositionForMutation(host), /READING_CONTENT_POSITION_NOT_CONFIRMED/);
  current = true;
  await assert.rejects(bridge.confirmPositionForMutation({ ...host, committed: () => receipt(46) }),
    /READING_CONTENT_POSITION_NOT_CONFIRMED/);
});

test('replacement clears the search receipt before deferring or reopening the mapped anchor', () => {
  const bridge = new ReadingAuxiliaryFlowBridge();
  const calls: string[] = [];
  let active = false;
  let settling = true;
  const host = {
    active: () => active,
    retireSearchPublication: () => calls.push('search'),
    deferDuringSettlement: () => { calls.push('settlement'); return settling; },
    invalidateProcessedContent: () => calls.push('invalidate'),
    reopenMappedPosition: () => calls.push('reopen'),
  };
  bridge.reloadAfterReplacement(host);
  assert.deepEqual(calls, []);
  active = true;
  bridge.reloadAfterReplacement(host);
  assert.deepEqual(calls, ['search', 'settlement']);
  settling = false;
  bridge.reloadAfterReplacement(host);
  assert.deepEqual(calls.slice(2), ['search', 'settlement', 'invalidate', 'reopen']);
});

test('capsule geometry retains the latest frozen sample but validates its identity again before application', () => {
  const measurements = new ReadingAuxiliaryCapsuleMeasurements();
  let measured: ReadingCapsuleMeasurement | undefined;
  let liveIdentity = 'paged';
  let frozen = false;
  const current = (identity: string, kind: 'tts' | 'autoPage') => kind === 'tts' && identity === liveIdentity;
  const committed = () => measured;
  const observe = (identity: string, width: number) =>
    measurements.observe('tts', identity, width, 44, current, () => frozen, committed);
  measured = observe('paged', 105);
  assert.equal(measured?.width, 105);
  assert.equal(observe('paged', 105.005), undefined);
  frozen = true;
  assert.equal(observe('paged', 120), undefined);
  assert.equal(observe('paged', 140), undefined);
  assert.equal(observe('paged', Infinity), undefined);
  liveIdentity = 'reflow';
  assert.equal(measurements.flush(current, committed), undefined);
  assert.equal(observe('reflow', 150), undefined);
  assert.equal(observe('reflow', 152), undefined);
  assert.equal(measurements.flush(current, committed)?.width, 152);
  assert.equal(measurements.flush(current, committed), undefined);
});
