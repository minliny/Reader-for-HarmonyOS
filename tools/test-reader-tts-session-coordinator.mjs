import assert from 'node:assert/strict';

import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';

const chapter = { sourceId: 'local', bookId: 'book-1', chapterIndex: 0, chapterTitle: '第一章' };
const plan = {
  chapter,
  strategy: 'paragraph-then-sentence',
  slices: [
    { index: 0, text: '第一句。', charStart: 0, charEnd: 4, paragraphIndex: 0 },
    { index: 1, text: '第二句。', charStart: 4, charEnd: 8, paragraphIndex: 0 },
  ],
  sourceCharCount: 8,
};

class FakeGateway {
  calls = [];
  cursor = 0;

  async getConfig() { this.calls.push('config'); return { rate: 5, pitch: 0, followSys: false }; }
  async slice() { this.calls.push('slice'); return plan; }
  async play(_plan, index) { this.calls.push(`play:${index}`); this.cursor = index; return this.snapshot('playing'); }
  async pause() { this.calls.push('pause'); return this.snapshot('paused'); }
  async resume() { this.calls.push('resume'); return this.snapshot('playing'); }
  async stop() { this.calls.push('stop'); return this.snapshot('stopped'); }
  async setRate(_chapter, rate) { this.calls.push(`rate:${rate}`); return this.snapshot('playing'); }
  async previous() { this.calls.push('previous'); this.cursor = Math.max(0, this.cursor - 1); return this.snapshot('playing'); }
  async skip() { this.calls.push('skip'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async next() { this.calls.push('next'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async reportStatus(_chapter, index, status) { this.calls.push(`report:${index}:${status}`); return this.snapshot('playing'); }
  snapshot(state) {
    return {
      state,
      currentSliceIndex: state === 'completed' ? 1 : this.cursor,
      totalSlices: 2,
      completedSlices: state === 'completed' ? 2 : this.cursor,
      chapter,
      sliceStatuses: [],
    };
  }
}

class FakeHost {
  calls = [];
  listener;
  requests = [];
  setEventListener(listener) { this.listener = listener; }
  async isAvailable() { this.calls.push('available'); return true; }
  async activateAudioSession(mix) { this.calls.push(`activate:${mix}`); }
  async deactivateAudioSession() { this.calls.push('deactivate'); }
  async speak(request) { this.calls.push(`speak:${request.requestId}`); this.requests.push(request); }
  async stop() { this.calls.push('stop'); }
  emit(event) { this.listener?.(event); }
}

const gateway = new FakeGateway();
const host = new FakeHost();
const progress = [];
const coordinator = new ReaderTtsSessionCoordinator(
  gateway,
  host,
  async update => { progress.push(update.charEnd); },
);

await coordinator.start({ chapter, content: '第一句。第二句。', contentVersion: 1, scalarPosition: 4 });
assert.equal(coordinator.getState().status, 'preparing', 'speak() return is not audible start');
assert.equal(host.requests[0].text, '第二句。');
assert.ok(gateway.calls.includes('rate:5'));
const requestId = host.requests[0].requestId;

host.emit({ type: 'start', requestId });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'playing');
assert.ok(gateway.calls.includes('report:1:speaking'));

host.emit({ type: 'complete', requestId, completion: 'synthesis' });
await coordinator.whenSettled();
assert.equal(progress.length, 0, 'synthesis completion cannot advance');

host.emit({ type: 'complete', requestId, completion: 'audio' });
host.emit({ type: 'complete', requestId, completion: 'audio' });
await coordinator.whenSettled();
assert.deepEqual(progress, [8], 'duplicate completion must commit once');
assert.equal(coordinator.getState().status, 'completed');
assert.equal(gateway.calls.filter(call => call === 'next').length, 1);

await coordinator.start({ chapter, content: '第一句。第二句。', contentVersion: 2, scalarPosition: 0 });
const staleRequestId = host.requests.at(-1).requestId;
await coordinator.pause();
host.emit({ type: 'start', requestId: staleRequestId });
host.emit({ type: 'complete', requestId: staleRequestId, completion: 'audio' });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'paused');
assert.equal(gateway.calls.filter(call => call === 'next').length, 1, 'late paused callback cannot advance');

await coordinator.resume();
const resumedRequestId = host.requests.at(-1).requestId;
assert.notEqual(resumedRequestId, staleRequestId);
host.emit({ type: 'start', requestId: resumedRequestId });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'playing');

host.emit({ type: 'interruption', action: 'pause' });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'interrupted');
host.emit({ type: 'interruption', action: 'resume' });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'resuming');

await coordinator.setRate(1.4);
assert.ok(gateway.calls.includes('rate:7'));

await coordinator.stop();
assert.equal(coordinator.getState().status, 'idle');
await coordinator.dispose();

console.log('reader TTS fake-host coordinator: PASS');
