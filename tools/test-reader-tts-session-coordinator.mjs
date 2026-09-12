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
  async setRate(_chapter, rate) { this.calls.push(`rate:${rate}`); return this.snapshot(this.queueState); }
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
  listenerOwner;
  requests = [];
  speakGate;
  setEventListener(listener, owner) { this.listener = listener; this.listenerOwner = owner; }
  clearEventListener(owner) {
    if (this.listenerOwner !== owner) return;
    this.listener = undefined;
    this.listenerOwner = undefined;
  }
  async selectEngine(engine) { this.calls.push(`engine:${engine ?? 'system'}`); return true; }
  async probe() { this.calls.push('available'); return { available: true }; }
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
assert.equal(coordinator.getState().status, 'preparing');

await coordinator.setVoice('en-US', 7);
assert.equal(host.requests.at(-1).language, 'en-US');
assert.equal(host.requests.at(-1).person, 7);

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
await slowStop.coordinator.dispose();

const immediateTransportIntents = [
  { name: 'pause', invoke: current => current.pause() },
  { name: 'background pause', invoke: current => current.pauseForBackground() },
  { name: 'seek', invoke: current => current.seek(1) },
  { name: 'next', invoke: current => current.next() },
  { name: 'previous', invoke: current => current.previous() },
  { name: 'rate', invoke: current => current.setRate(1.4) },
  { name: 'voice', invoke: current => current.setVoice('en-US', 7) },
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
  await blocked.coordinator.dispose();
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
  await blocked.coordinator.dispose();
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
await replacement.coordinator.dispose();

const stopOnCallGateway = new FakeGateway();
const stopOnCallHost = new FakeHost();
const stopOnCallCoordinator = new ReaderTtsSessionCoordinator(stopOnCallGateway, stopOnCallHost);
await stopOnCallCoordinator.start({
  chapter,
  content: canonicalRemoteContent,
  contentVersion: blockedContentVersion + 2,
  scalarPosition: 0,
  pauseOnInterruption: false,
});
stopOnCallHost.emit({ type: 'interruption', action: 'pause' });
await stopOnCallCoordinator.whenSettled();
await stopOnCallCoordinator.whenSettled();
assert.equal(stopOnCallCoordinator.getState().status, 'idle');
assert.equal(stopOnCallCoordinator.getState().stopReason, 'systemInterruption');
assert.ok(stopOnCallGateway.calls.includes('stop'));

const coordinatorSource = await readFile(
  new URL('../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts', import.meta.url),
  'utf8',
);
assert.match(coordinatorSource, /export type HostTtsTransportState/);
assert.match(coordinatorSource, /private stopHostTransportImmediately\(\): Promise<Error \| undefined>/);
assert.match(coordinatorSource, /private routeHostEvent\(event: ReaderTtsHostEvent\): void/);
assert.match(coordinatorSource, /this\.voidLogged\(this\.pauseForSystem\('systemInterruption'\)/,
  'system interruption must enter the immediate transport-cancel path before serialization');
assert.match(coordinatorSource, /terminateToError/,
  'start and callback failures must land in the transactional retryable error state');
assert.match(coordinatorSource, /armStartWatchdog/,
  'a speak accepted without a real onStart callback must be bounded by a watchdog');
assert.match(coordinatorSource, /clearEventListener\(this\.ownerToken\)/,
  'dispose must only clear its own owner-scoped listener');
assert.doesNotMatch(
  coordinatorSource,
  /beginReaderTtsSession|prepareReaderTtsUtterance|advanceReaderTtsChapter|failReaderTtsUtterance/,
  'production coordinator must project Core snapshots instead of running a second queue reducer',
);
assert.doesNotMatch(coordinatorSource, /task\.catch\(\(\): void => \{\}\)/,
  'the operation tail must never swallow rejections silently');
assert.match(coordinatorSource, /MAX_RETAINED_COMPLETED_UTTERANCES = 128/,
  'late callback retention must have a fixed upper bound');
assert.match(coordinatorSource, /this\.retainUtteranceCorrelation\(event\.requestId\)/,
  'successful audio completion must enter the bounded late-callback window');

// Exercise the production retention helper directly with synthetic
// correlations.  This keeps the regression deterministic and avoids needing
// a 129-slice fake speech engine just to prove the memory bound.
{
  const bounded = new ReaderTtsSessionCoordinator(new FakeGateway(), new FakeHost());
  const correlation = {
    identity: { sessionGeneration: 1, contentVersion: 1, chapterKey: 'source-1\\u0000book-1\\u00000' },
    chapter,
    sliceIndex: 0,
    charEnd: 1,
    failurePolicy: 'stop',
  };
  for (let index = 0; index < 160; index += 1) {
    const requestId = `retained-${index}`;
    bounded.utterances.set(requestId, correlation);
    bounded.retainUtteranceCorrelation(requestId);
  }
  assert.equal(bounded.utterances.size, 128,
    'completed/retired callback correlations must remain bounded');
  assert.equal(bounded.utterances.has('retained-0'), false,
    'oldest retained correlation must be evicted first');
  assert.equal(bounded.utterances.has('retained-159'), true,
    'newest retained correlation must remain available for late callbacks');
  bounded.clearUtteranceCorrelations();
  assert.equal(bounded.utterances.size, 0);
  assert.equal(bounded.retainedUtteranceIds.size, 0);
  await bounded.dispose();
}

// A repeated selection must not orphan the audible utterance; paused rate
// changes update Core and preferences without starting audio implicitly.
{
  const g = new FakeGateway(), h = new FakeHost();
  const c = new ReaderTtsSessionCoordinator(g, h, async () => {});
  await c.start({ chapter, content: canonicalRemoteContent, contentVersion: 99, scalarPosition: 0 });
  const id = h.requests.at(-1).requestId;
  h.emit({ type: 'start', requestId: id }); await c.whenSettled();
  const token = c.getTransportState().currentRequestId;
  const count = h.requests.length;
  await c.setRate(c.getState().rate);
  assert.equal(c.getTransportState().currentRequestId, token);
  assert.equal(h.requests.length, count);
  h.emit({ type: 'complete', requestId: id, completion: 'audio' }); await c.whenSettled();
  assert.equal(c.getState().sliceIndex, 1, 'completion still advances after choosing the same rate');
  await c.pause();
  const pausedCount = h.requests.length;
  await c.setRate(1.6);
  assert.equal(c.getState().status, 'paused');
  assert.equal(h.requests.length, pausedCount, 'changing paused rate does not speak');
  assert.ok(g.calls.includes('rate:8'));
  await c.resume();
  assert.equal(h.requests.at(-1).rate, 1.6);
  await c.setAllowMixing(true);
  assert.equal(h.calls.at(-1), 'activate:true', 'active audio session receives the new mixing policy');
  await c.stop(); await c.dispose();
}

// Engine probing is serialized with playback admission.  A delayed probe must
// not switch the Host router back to its stale engine after a newer session has
// already selected and started another engine.
{
  class DelayedSelectHost extends FakeHost {
    selectCount = 0;
    firstSelectEntered;
    releaseFirstSelect;
    async selectEngine(engine) {
      this.calls.push(`engine:${engine ?? 'system'}`);
      this.selectCount += 1;
      if (this.selectCount === 1) {
        this.firstSelectEntered = new Promise(resolve => { this.releaseFirstSelect = resolve; });
        await this.firstSelectEntered;
      }
      return true;
    }
  }
  class ConfigRaceGateway extends FakeGateway {
    configCount = 0;
    async getConfig() {
      this.configCount += 1;
      return { engine: this.configCount === 1 ? 'http-tts:stale' : 'system', rate: 5, pitch: 0, followSys: false };
    }
  }
  const g = new ConfigRaceGateway();
  const h = new DelayedSelectHost();
  const c = new ReaderTtsSessionCoordinator(g, h);
  const probeTask = c.probeAvailability();
  while (h.firstSelectEntered === undefined) await new Promise(resolve => setTimeout(resolve, 0));
  const startTask = c.start({ chapter, content: canonicalRemoteContent, contentVersion: 101, scalarPosition: 0 });
  // The start is admitted synchronously, but its prepare operation waits for
  // the probe's in-flight Host selection. Releasing it lets both transactions
  // settle in their declared order.
  h.releaseFirstSelect();
  await Promise.all([probeTask, startTask]);
  assert.equal(c.getTransportState().engine, 'system',
    'a stale probe must not overwrite the newer session engine selection');
  await c.stop(); await c.dispose();
}

// A stop intent also updates the transport generation synchronously while a
// platform probe may still be awaiting.  The stale probe must not overwrite
// the stopping/settled lifecycle state with `unavailable` when it resumes.
{
  class DelayedProbeHost extends FakeHost {
    probeEntered;
    releaseProbe;
    async probe() {
      this.probeEntered = new Promise(resolve => { this.releaseProbe = resolve; });
      await this.probeEntered;
      return { available: false, reason: 'synthetic probe failure' };
    }
  }
  const h = new DelayedProbeHost();
  const c = new ReaderTtsSessionCoordinator(new FakeGateway(), h);
  const probeTask = c.probeAvailability();
  while (h.probeEntered === undefined) await new Promise(resolve => setTimeout(resolve, 0));
  const stopTask = c.stop();
  h.releaseProbe();
  await Promise.all([probeTask, stopTask]);
  assert.equal(c.getState().status, 'idle',
    'a stale probe must not publish unavailable over a newer stop intent');
  await c.dispose();
}

console.log('reader TTS fake-host coordinator: PASS');
