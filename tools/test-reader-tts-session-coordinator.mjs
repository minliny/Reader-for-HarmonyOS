import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const owned=[];const createCoordinator=(...args)=>{const c=new ReaderTtsSessionCoordinator(...args);owned.push(c);return c;};
const { readFile }=await import("node:fs/promises");
const { ReaderTtsSessionCoordinator }=await import("../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts");
const { chapter, canonicalRemoteContent, plan, FakeGateway, FakeHost }=await import("./lib/reader-tts-fixtures.mjs");
async function startBlockedSession(contentVersion) {
  const blockedGateway = new FakeGateway();
  const blockedHost = new FakeHost();
  const blockedCoordinator = createCoordinator(
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


let blockedContentVersion=4;try{
if(id==='callback-controls'){
const gateway = new FakeGateway();
const host = new FakeHost();
const progress = [];
const coordinator = createCoordinator(
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
assert.equal(coordinator.captureCompletedProgress(), undefined, 'queued or synthesized text has not been heard');

host.emit({ type: 'complete', requestId, completion: 'audio' });
host.emit({ type: 'complete', requestId, completion: 'audio' });
await coordinator.whenSettled();
assert.deepEqual(progress, [13], 'duplicate completion must commit one canonical scalar end');
assert.equal(coordinator.getState().status, 'completed');
const capturedCompletion = coordinator.captureCompletedProgress();
assert.equal(capturedCompletion.charEnd, 13); capturedCompletion.charEnd = 999;
assert.equal(coordinator.captureCompletedProgress().charEnd, 13, 'exit snapshot cannot mutate the audio completion owner');
assert.equal(gateway.calls.filter(call => call === 'next').length, 0);
assert.equal(gateway.calls.filter(call => call.includes(':done:')).length, 2,
  'duplicate audio completion must reach Core correlation twice');

await coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion: 2, scalarPosition: 0 });
assert.equal(coordinator.captureCompletedProgress(), undefined, 'a new TTS session invalidates the previous completed scalar');
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


}
if(id==='immediate-stop'){
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


}
if(id==='transport-intents'){
const immediateTransportIntents = [
  { name: 'pause', invoke: current => current.pause() },
  { name: 'background pause', invoke: current => current.pauseForBackground() },
  { name: 'seek', invoke: current => current.seek(1) },
  { name: 'next', invoke: current => current.next() },
  { name: 'previous', invoke: current => current.previous() },
  { name: 'rate', invoke: current => current.setRate(1.4) },
  { name: 'voice', invoke: current => current.setVoice('en-US', 7) },
];

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


}
if(id==='host-events'){
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


}
if(id==='replacement'){
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


}
if(id==='interruption-stop'){
const stopOnCallGateway = new FakeGateway();
const stopOnCallHost = new FakeHost();
const stopOnCallCoordinator = createCoordinator(stopOnCallGateway, stopOnCallHost);
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


}
if(id==='retention'){
{
  const bounded = createCoordinator(new FakeGateway(), new FakeHost());
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
}
if(id==='same-value-policy'){
{
  const g = new FakeGateway(), h = new FakeHost();
  const c = createCoordinator(g, h, async () => {});
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
}
if(id==='probe-engine-race'){
{
  class DelayedSelectHost extends FakeHost {
    selectCount = 0;
    entered=new Promise(resolve=>{this.notifyEntered=resolve;});
    firstSelectEntered;
    releaseFirstSelect;
    async selectEngine(engine) {
      this.calls.push(`engine:${engine ?? 'system'}`);
      this.selectCount += 1;this.notifyEntered();
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
  const c = createCoordinator(g, h);
  const probeTask = c.probeAvailability();
  await h.entered;
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
}
if(id==='probe-stop-race'){
{
  class DelayedProbeHost extends FakeHost {
    entered=new Promise(resolve=>{this.notifyEntered=resolve;});
    probeEntered;
    releaseProbe;
    async probe() {
      this.probeEntered = new Promise(resolve => { this.releaseProbe = resolve; });this.notifyEntered();
      await this.probeEntered;
      return { available: false, reason: 'synthetic probe failure' };
    }
  }
  const h = new DelayedProbeHost();
  const c = createCoordinator(new FakeGateway(), h);
  const probeTask = c.probeAvailability();
  await h.entered;
  const stopTask = c.stop();
  h.releaseProbe();
  await Promise.all([probeTask, stopTask]);
  assert.equal(c.getState().status, 'idle',
    'a stale probe must not publish unavailable over a newer stop intent');
  await c.dispose();
}
}
if(id==='slow-progress'){
{
  let entered;
  let release;
  const commitEntered = new Promise(resolve => { entered = resolve; });
  const commitBlocked = new Promise(resolve => { release = resolve; });
  const g = new FakeGateway(), h = new FakeHost();
  const prefetches = [];
  h.prefetchNext = request => { prefetches.push(request); };
  const writes = [];
  const c = createCoordinator(g, h, async update => {
    writes.push(`begin:${update.charEnd}`);
    entered();
    await commitBlocked;
    writes.push(`end:${update.charEnd}`);
  });
  await c.start({ chapter, content: canonicalRemoteContent, contentVersion: 110, scalarPosition: 0 });
  const firstId = h.requests[0].requestId;
  h.emit({ type: 'start', requestId: firstId });
  await c.whenSettled();
  assert.equal(prefetches[0].text, '第二句。', 'real onStart admits only the next bounded lookahead');
  h.emit({ type: 'complete', requestId: firstId, completion: 'audio' });
  await commitEntered;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.requests.length, 2, 'next sentence must speak while the prior scalar commit is slow');
  release();
  await c.whenSettled();
  assert.deepEqual(writes, ['begin:4', 'end:4']);
  await c.dispose();
}
}
if(id==='chapter-boundary'){
class AdvancingChapterGateway extends FakeGateway {
  currentChapter = chapter;
  currentPlan;
  async slice(chapterRef, content) {
    this.currentChapter = chapterRef;
    this.currentPlan = {
      chapter: chapterRef, strategy: 'paragraph-then-sentence',
      slices: [{ index: 0, text: content, charStart: 0, charEnd: content.length, paragraphIndex: 0 }],
      sourceCharCount: content.length,
    };
    return this.currentPlan;
  }
  async play(plan, index) {
    this.currentChapter = plan.chapter;
    this.currentPlan = plan;
    this.cursor = index;
    this.queueState = 'playing';
    return this.snapshot('playing');
  }
  async reportCallback(_chapter, _index, status) {
    if (status === 'done') this.queueState = 'completed';
    return { snapshot: this.snapshot(this.queueState), callbackDisposition: 'applied' };
  }
  async chapterPlan(current, next, drainBehavior) {
    return { current, next, drainBehavior };
  }
  snapshot(state) {
    return {
      state, currentSliceIndex: 0, totalSlices: 1,
      completedSlices: state === 'completed' ? 1 : 0,
      chapter: this.currentChapter, sliceStatuses: [], failurePolicy: 'stop',
      consecutiveFailures: 0, failureLimit: 3, drainBehavior: 'advance-to-next',
      restartPolicy: 'reset-on-core-restart',
    };
  }
}

const secondChapter = { ...chapter, chapterIndex: 1, chapterTitle: '第二章' };

{
  let entered;
  let release;
  const commitEntered = new Promise(resolve => { entered = resolve; });
  const commitBlocked = new Promise(resolve => { release = resolve; });
  const writes = [];
  const states = [];
  let admitted = 0;
  const g = new AdvancingChapterGateway(), h = new FakeHost();
  let c;
  c = createCoordinator(g, h, async update => {
    writes.push(`begin:${update.chapter.chapterIndex}`);
    entered();
    await commitBlocked;
    writes.push(`end:${update.chapter.chapterIndex}`);
  }, state => states.push(state.status), async current => {
    if (current.chapterIndex !== 0) return undefined;
    return {
      chapter: secondChapter, content: '第二章首句。', contentVersion: 111,
      onAdmitted: () => {
        admitted += 1;
        assert.equal(c.getState().status, 'preparing',
          'page navigation must retain the active TTS follow lease');
        assert.deepEqual(writes, ['begin:0', 'end:0'],
          'old chapter progress must be durable before its page changes');
      },
    };
  });
  await c.start({ chapter, content: '第一章末句。', contentVersion: 110, scalarPosition: 0 });
  const firstId = h.requests[0].requestId;
  h.emit({ type: 'start', requestId: firstId });
  await c.whenSettled();
  h.emit({ type: 'complete', requestId: firstId, completion: 'audio' });
  await commitEntered;
  assert.equal(c.getState().status, 'preparing');
  assert.equal(admitted, 0, 'navigation must wait for the final old-chapter commit');
  assert.equal(states.includes('completed'), false, 'a chapter boundary is not a session completion');
  release();
  await c.whenSettled();
  assert.equal(admitted, 1);
  assert.equal(c.getState().chapterIndex, 1);
  assert.equal(h.requests.length, 2);
  await c.dispose();
}
}
if(id==='chapter-stop'){
class AdvancingChapterGateway extends FakeGateway {
  currentChapter = chapter;
  currentPlan;
  async slice(chapterRef, content) {
    this.currentChapter = chapterRef;
    this.currentPlan = {
      chapter: chapterRef, strategy: 'paragraph-then-sentence',
      slices: [{ index: 0, text: content, charStart: 0, charEnd: content.length, paragraphIndex: 0 }],
      sourceCharCount: content.length,
    };
    return this.currentPlan;
  }
  async play(plan, index) {
    this.currentChapter = plan.chapter;
    this.currentPlan = plan;
    this.cursor = index;
    this.queueState = 'playing';
    return this.snapshot('playing');
  }
  async reportCallback(_chapter, _index, status) {
    if (status === 'done') this.queueState = 'completed';
    return { snapshot: this.snapshot(this.queueState), callbackDisposition: 'applied' };
  }
  async chapterPlan(current, next, drainBehavior) {
    return { current, next, drainBehavior };
  }
  snapshot(state) {
    return {
      state, currentSliceIndex: 0, totalSlices: 1,
      completedSlices: state === 'completed' ? 1 : 0,
      chapter: this.currentChapter, sliceStatuses: [], failurePolicy: 'stop',
      consecutiveFailures: 0, failureLimit: 3, drainBehavior: 'advance-to-next',
      restartPolicy: 'reset-on-core-restart',
    };
  }
}

const secondChapter = { ...chapter, chapterIndex: 1, chapterTitle: '第二章' };

{
  let entered;
  let release;
  const loaderEntered = new Promise(resolve => { entered = resolve; });
  const loaderBlocked = new Promise(resolve => { release = resolve; });
  const g = new AdvancingChapterGateway(), h = new FakeHost();
  let admitted = 0;
  const c = createCoordinator(g, h, async () => {}, undefined, async () => {
    entered();
    await loaderBlocked;
    return { chapter: secondChapter, content: '第二章。', contentVersion: 112,
      onAdmitted: () => { admitted += 1; } };
  });
  await c.start({ chapter, content: '第一章。', contentVersion: 111, scalarPosition: 0 });
  const firstId = h.requests[0].requestId;
  h.emit({ type: 'start', requestId: firstId });
  await c.whenSettled();
  h.emit({ type: 'complete', requestId: firstId, completion: 'audio' });
  await loaderEntered;
  const stop = c.stop();
  release();
  await stop;
  assert.equal(admitted, 0);
  assert.equal(h.requests.length, 1);
  assert.equal(c.getState().status, 'idle');
  await c.dispose();
}
}
if(id==='chapter-replacement'){
class AdvancingChapterGateway extends FakeGateway {
  currentChapter = chapter;
  currentPlan;
  async slice(chapterRef, content) {
    this.currentChapter = chapterRef;
    this.currentPlan = {
      chapter: chapterRef, strategy: 'paragraph-then-sentence',
      slices: [{ index: 0, text: content, charStart: 0, charEnd: content.length, paragraphIndex: 0 }],
      sourceCharCount: content.length,
    };
    return this.currentPlan;
  }
  async play(plan, index) {
    this.currentChapter = plan.chapter;
    this.currentPlan = plan;
    this.cursor = index;
    this.queueState = 'playing';
    return this.snapshot('playing');
  }
  async reportCallback(_chapter, _index, status) {
    if (status === 'done') this.queueState = 'completed';
    return { snapshot: this.snapshot(this.queueState), callbackDisposition: 'applied' };
  }
  async chapterPlan(current, next, drainBehavior) {
    return { current, next, drainBehavior };
  }
  snapshot(state) {
    return {
      state, currentSliceIndex: 0, totalSlices: 1,
      completedSlices: state === 'completed' ? 1 : 0,
      chapter: this.currentChapter, sliceStatuses: [], failurePolicy: 'stop',
      consecutiveFailures: 0, failureLimit: 3, drainBehavior: 'advance-to-next',
      restartPolicy: 'reset-on-core-restart',
    };
  }
}

const secondChapter = { ...chapter, chapterIndex: 1, chapterTitle: '第二章' };

{
  let entered;
  let release;
  const loaderEntered = new Promise(resolve => { entered = resolve; });
  const loaderBlocked = new Promise(resolve => { release = resolve; });
  const g = new AdvancingChapterGateway(), h = new FakeHost();
  let admitted = 0;
  const c = createCoordinator(g, h, async () => {}, undefined, async () => {
    entered();
    await loaderBlocked;
    return { chapter: secondChapter, content: '旧来源下一章。', contentVersion: 113,
      onAdmitted: () => { admitted += 1; } };
  });
  await c.start({ chapter, content: '旧来源末句。', contentVersion: 112, scalarPosition: 0 });
  const firstId = h.requests[0].requestId;
  h.emit({ type: 'start', requestId: firstId });
  await c.whenSettled();
  h.emit({ type: 'complete', requestId: firstId, completion: 'audio' });
  await loaderEntered;
  const replacement = { ...chapter, sourceId: 'replacement-source' };
  const replaceTask = c.start({ chapter: replacement, content: '新来源正文。',
    contentVersion: 114, scalarPosition: 0 });
  release();
  await replaceTask;
  assert.equal(admitted, 0);
  assert.equal(c.getState().chapterIndex, replacement.chapterIndex);
  assert.equal(h.requests.length, 2);
  await c.dispose();
}
}
}finally{for(const c of owned)await c.dispose();}
}
const definitions={"callback-controls": "callback-controls actual coordinator with controlled boundaries; no regex gate", "immediate-stop": "immediate-stop actual coordinator with controlled boundaries; no regex gate", "transport-intents": "transport-intents actual coordinator with controlled boundaries; no regex gate", "host-events": "host-events actual coordinator with controlled boundaries; no regex gate", "replacement": "replacement actual coordinator with controlled boundaries; no regex gate", "interruption-stop": "interruption-stop actual coordinator with controlled boundaries; no regex gate", "retention": "retention actual coordinator with controlled boundaries; no regex gate", "same-value-policy": "same-value-policy actual coordinator with controlled boundaries; no regex gate", "probe-engine-race": "probe-engine-race actual coordinator with controlled boundaries; no regex gate", "probe-stop-race": "probe-stop-race actual coordinator with controlled boundaries; no regex gate", "slow-progress": "slow-progress actual coordinator with controlled boundaries; no regex gate", "chapter-boundary": "chapter-boundary actual coordinator with controlled boundaries; no regex gate", "chapter-stop": "chapter-stop actual coordinator with controlled boundaries; no regex gate", "chapter-replacement": "chapter-replacement actual coordinator with controlled boundaries; no regex gate"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
