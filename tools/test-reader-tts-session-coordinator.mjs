import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';

const chapter = { sourceId: 'source-1', bookId: 'book-1', chapterIndex: 0, chapterTitle: '第一章' };
const canonicalRemoteContent = '第一句。\n\n\uFFFC\n\n第二句。';
const plan = {
  chapter,
  strategy: 'paragraph-then-sentence',
  slices: [
    { index: 0, text: '第一句。', charStart: 0, charEnd: 4, paragraphIndex: 0 },
    { index: 1, text: '第二句。', charStart: 9, charEnd: 13, paragraphIndex: 1 },
  ],
  sourceCharCount: 13,
};

class FakeGateway {
  calls = [];
  cursor = 0;
  callbacks = new Set();
  queueState = 'idle';

  async getConfig() { this.calls.push('config'); return { rate: 5, pitch: 0, followSys: false }; }
  async slice() { this.calls.push('slice'); return plan; }
  async play(_plan, index) { this.calls.push(`play:${index}`); this.cursor = index; this.queueState = 'playing'; return this.snapshot('playing'); }
  async pause() { this.calls.push('pause'); this.queueState = 'paused'; return this.snapshot('paused'); }
  async resume() { this.calls.push('resume'); this.queueState = 'playing'; return this.snapshot('playing'); }
  async stop() { this.calls.push('stop'); this.queueState = 'stopped'; return this.snapshot('stopped'); }
  async setRate(_chapter, rate) { this.calls.push(`rate:${rate}`); return this.snapshot('playing'); }
  async previous() { this.calls.push('previous'); this.cursor = Math.max(0, this.cursor - 1); return this.snapshot('playing'); }
  async seek(_chapter, index) { this.calls.push(`seek:${index}`); this.cursor = index; return this.snapshot(this.queueState); }
  async skip() { this.calls.push('skip'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async next() { this.calls.push('next'); this.cursor += 1; return this.cursor >= 2 ? this.snapshot('completed') : this.snapshot('playing'); }
  async reportStatus(_chapter, index, status) { this.calls.push(`report:${index}:${status}`); return this.snapshot('playing'); }
  async reportCallback(_chapter, index, status, callbackId, failurePolicy, failureLimit) {
    this.calls.push(`callback:${index}:${status}:${callbackId}`);
    if (this.callbacks.has(callbackId)) {
      return { snapshot: this.snapshot(this.cursor >= 2 ? 'completed' : 'playing'), callbackDisposition: 'duplicate' };
    }
    this.callbacks.add(callbackId);
    if (this.queueState !== 'playing') {
      return { snapshot: this.snapshot(this.queueState), callbackDisposition: 'stale' };
    }
    if (status === 'done') this.cursor += 1;
    if (this.cursor >= 2) this.queueState = 'completed';
    return {
      snapshot: this.snapshot(this.queueState, failurePolicy, failureLimit),
      callbackDisposition: 'applied',
    };
  }
  snapshot(state, failurePolicy = 'stop', failureLimit = 3) {
    return {
      state,
      currentSliceIndex: state === 'completed' ? 1 : this.cursor,
      totalSlices: 2,
      completedSlices: state === 'completed' ? 2 : this.cursor,
      chapter,
      sliceStatuses: [],
      failurePolicy,
      consecutiveFailures: 0,
      failureLimit,
      drainBehavior: 'advance-to-next',
      restartPolicy: 'reset-on-core-restart',
    };
  }
}

class FakeHost {
  calls = [];
  listener;
  requests = [];
  speakGate;
  setEventListener(listener) { this.listener = listener; }
  async selectEngine(engine) { this.calls.push(`engine:${engine ?? 'system'}`); return true; }
  async isAvailable() { this.calls.push('available'); return true; }
  async activateAudioSession(mix) { this.calls.push(`activate:${mix}`); }
  async deactivateAudioSession() { this.calls.push('deactivate'); }
  async speak(request) {
    this.calls.push(`speak:${request.requestId}`);
    this.requests.push(request);
    const gate = this.speakGate;
    if (gate !== undefined) {
      this.speakGate = undefined;
      gate.markEntered();
      await gate.blocked;
    }
  }
  async stop() { this.calls.push('stop'); }
  publishPlaybackState(state) { this.calls.push(`media:${state}`); }
  emit(event) { this.listener?.(event); }
  blockNextSpeak() {
    let markEntered = () => {};
    let release = () => {};
    const entered = new Promise(resolve => { markEntered = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    this.speakGate = { blocked, markEntered };
    return { entered, release };
  }
}

async function startBlockedSession(contentVersion) {
  const blockedGateway = new FakeGateway();
  const blockedHost = new FakeHost();
  const blockedCoordinator = new ReaderTtsSessionCoordinator(
    blockedGateway,
    blockedHost,
    async () => {},
  );
  const speak = blockedHost.blockNextSpeak();
  const startTask = blockedCoordinator.start({
    chapter,
    content: canonicalRemoteContent,
    contentVersion,
    scalarPosition: 0,
  });
  await speak.entered;
  return { coordinator: blockedCoordinator, gateway: blockedGateway, host: blockedHost, speak, startTask };
}

const gateway = new FakeGateway();
const host = new FakeHost();
const progress = [];
const coordinator = new ReaderTtsSessionCoordinator(
  gateway,
  host,
  async update => { progress.push(update.charEnd); },
);

await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 1, scalarPosition: 6 });
assert.equal(coordinator.getState().status, 'preparing', 'speak() return is not audible start');
assert.equal(coordinator.getTransportState().audioSession, 'active');
assert.equal(host.requests[0].text, '第二句。');
assert.ok(gateway.calls.includes('rate:5'));
const requestId = host.requests[0].requestId;

host.emit({ type: 'start', requestId });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'playing');
assert.ok(gateway.calls.some(call => call.includes('callback:1:speaking:')));

host.emit({ type: 'complete', requestId, completion: 'synthesis' });
await coordinator.whenSettled();
assert.equal(progress.length, 0, 'synthesis completion cannot advance');

host.emit({ type: 'complete', requestId, completion: 'audio' });
host.emit({ type: 'complete', requestId, completion: 'audio' });
await coordinator.whenSettled();
assert.deepEqual(progress, [13], 'duplicate completion must commit one canonical scalar end');
assert.equal(coordinator.getState().status, 'completed');
assert.equal(gateway.calls.filter(call => call === 'next').length, 0);
assert.equal(gateway.calls.filter(call => call.includes(':done:')).length, 2,
  'duplicate audio completion must reach Core correlation twice');

await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 2, scalarPosition: 0 });
const staleRequestId = host.requests.at(-1).requestId;
await coordinator.pause();
host.emit({ type: 'start', requestId: staleRequestId });
host.emit({ type: 'complete', requestId: staleRequestId, completion: 'audio' });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'paused');
assert.equal(gateway.calls.filter(call => call === 'next').length, 0, 'late paused callback cannot advance');

await coordinator.resume();
const resumedRequestId = host.requests.at(-1).requestId;
assert.notEqual(resumedRequestId, staleRequestId);
host.emit({ type: 'start', requestId: resumedRequestId });
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'playing');

await coordinator.pause();
await coordinator.seek(1);
assert.ok(gateway.calls.includes('seek:1'));
assert.equal(coordinator.getState().status, 'paused', 'seek in a paused queue must not restart Host playback');
await coordinator.resume();

host.emit({ type: 'mediaControl', action: 'pause' });
await coordinator.whenSettled();
await coordinator.whenSettled();
assert.equal(coordinator.getState().status, 'paused');
host.emit({ type: 'mediaControl', action: 'play' });
await coordinator.whenSettled();
await coordinator.whenSettled();

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
assert.ok(host.calls.includes('media:stopped'), 'ordinary stop must publish AVSession stopped');
await coordinator.dispose();

const slowStop = await startBlockedSession(3);
const slowStopTask = slowStop.coordinator.stop();
assert.equal(slowStop.coordinator.getState().status, 'stopping');
assert.equal(
  slowStop.host.calls.filter(call => call === 'stop').length,
  1,
  'Host stop must run immediately instead of waiting behind an in-flight speak',
);
assert.equal(slowStop.host.calls.at(-1), 'media:stopped');
slowStop.speak.release();
await slowStop.startTask;
await slowStopTask;
assert.equal(slowStop.coordinator.getState().status, 'idle');

const immediateTransportIntents = [
  { name: 'pause', invoke: current => current.pause() },
  { name: 'background pause', invoke: current => current.pauseForBackground() },
  { name: 'seek', invoke: current => current.seek(1) },
  { name: 'next', invoke: current => current.next() },
  { name: 'previous', invoke: current => current.previous() },
  { name: 'rate', invoke: current => current.setRate(1.4) },
];
let blockedContentVersion = 4;
for (const scenario of immediateTransportIntents) {
  const blocked = await startBlockedSession(blockedContentVersion);
  blockedContentVersion += 1;
  const intentTask = scenario.invoke(blocked.coordinator);
  assert.equal(
    blocked.host.calls.filter(call => call === 'stop').length,
    1,
    `${scenario.name} must stop Host transport before the blocked speak settles`,
  );
  blocked.speak.release();
  await blocked.startTask;
  await intentTask;
}

const immediateHostEvents = [
  { name: 'media pause', event: { type: 'mediaControl', action: 'pause' } },
  { name: 'media stop', event: { type: 'mediaControl', action: 'stop' } },
  { name: 'media next', event: { type: 'mediaControl', action: 'next' } },
  { name: 'media previous', event: { type: 'mediaControl', action: 'previous' } },
  { name: 'interruption pause', event: { type: 'interruption', action: 'pause' } },
  { name: 'interruption stop', event: { type: 'interruption', action: 'stop' } },
  { name: 'device stop', event: { type: 'deviceChange', action: 'stop' } },
];
for (const scenario of immediateHostEvents) {
  const blocked = await startBlockedSession(blockedContentVersion);
  blockedContentVersion += 1;
  blocked.host.emit(scenario.event);
  assert.equal(
    blocked.host.calls.filter(call => call === 'stop').length,
    1,
    `${scenario.name} must stop Host transport before the blocked speak settles`,
  );
  blocked.speak.release();
  await blocked.startTask;
  await blocked.coordinator.whenSettled();
  await blocked.coordinator.whenSettled();
}

const replacement = await startBlockedSession(blockedContentVersion);
const replacementTask = replacement.coordinator.start({
  chapter,
  content: canonicalRemoteContent,
  contentVersion: blockedContentVersion + 1,
  scalarPosition: 0,
});
assert.equal(
  replacement.host.calls.filter(call => call === 'stop').length,
  1,
  'a replacement start must stop the prior Host transport before its speak settles',
);
replacement.speak.release();
await replacement.startTask;
await replacementTask;
assert.equal(replacement.host.requests.length, 2);

const coordinatorSource = await readFile(
  new URL('../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts', import.meta.url),
  'utf8',
);
assert.match(coordinatorSource, /export type HostTtsTransportState/);
assert.match(coordinatorSource, /private stopHostTransportImmediately\(\): Promise<Error \| undefined>/);
assert.match(coordinatorSource, /private routeHostEvent\(event: ReaderTtsHostEvent\): void/);
assert.match(coordinatorSource, /void this\.pauseForSystem\('systemInterruption'\)/,
  'system interruption must enter the immediate transport-cancel path before serialization');
assert.doesNotMatch(
  coordinatorSource,
  /beginReaderTtsSession|prepareReaderTtsUtterance|advanceReaderTtsChapter|failReaderTtsUtterance/,
  'production coordinator must project Core snapshots instead of running a second queue reducer',
);

console.log('reader TTS fake-host coordinator: PASS');
