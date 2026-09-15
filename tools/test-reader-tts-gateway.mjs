import assert from 'node:assert/strict';

import { ReaderTtsGateway } from '../entry/src/main/ets/features/reading/ReaderTtsGateway.ts';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { FakeGateway, FakeHost, chapter as fixtureChapter, canonicalRemoteContent } from './lib/reader-tts-fixtures.mjs';
import { readFileSync } from 'node:fs';

const chapter = { sourceId: 'local', bookId: 'book-1', chapterIndex: 2, chapterTitle: '第三章' };
const plan = {
  chapter,
  strategy: 'paragraph-then-sentence',
  slices: [
    { index: 0, text: '第一句。', charStart: 0, charEnd: 4, paragraphIndex: 0 },
    { index: 1, text: '第二句。', charStart: 4, charEnd: 8, paragraphIndex: 0 },
  ],
  sourceCharCount: 8,
};

const calls = [];
const runtime = {
  async request(method, params = {}) {
    calls.push({ method, params });
    if (method === 'tts.config.get') {
      return { data: { config: { configId: 1, rate: 5, pitch: 0, followSys: false } } };
    }
    if (method === 'tts.slice') return { data: { plan } };
    if (method === 'tts.queue.play') {
      return { data: { snapshot: snapshot('playing', params.startSliceIndex) } };
    }
    if (method === 'tts.queue.report-status') {
      return { data: { snapshot: snapshot('playing', params.sliceIndex) } };
    }
    if (method === 'tts.queue.report-callback') {
      return {
        data: {
          snapshot: snapshot(params.status === 'done' ? 'completed' : 'playing', params.sliceIndex),
          callbackDisposition: 'applied',
        },
      };
    }
    if (method === 'tts.queue.seek') {
      return { data: { snapshot: snapshot('playing', params.sliceIndex) } };
    }
    if (method === 'tts.queue.set-rate') {
      return { data: { rate: params.rate, snapshot: snapshot('playing', 0) } };
    }
    throw new Error(`unexpected ${method}`);
  },
};

const gateway = new ReaderTtsGateway(runtime);
assert.equal((await gateway.getConfig()).rate, 5);
assert.deepEqual(await gateway.slice(chapter, '第一句。第二句。'), plan);
assert.equal((await gateway.play(plan, 1)).currentSliceIndex, 1);
await gateway.reportStatus(chapter, 1, 'speaking');
assert.equal((await gateway.reportCallback(chapter, 1, 'done', 'request-1:done', 'stop')).callbackDisposition, 'applied');
assert.equal((await gateway.seek(chapter, 0)).currentSliceIndex, 0);
assert.equal((await gateway.setRate(chapter, 7)).state, 'playing');
assert.deepEqual(calls.map(call => call.method), [
  'tts.config.get',
  'tts.slice',
  'tts.queue.play',
  'tts.queue.report-status',
  'tts.queue.report-callback',
  'tts.queue.seek',
  'tts.queue.set-rate',
]);

const badRuntime = {
  async request(method) {
    if (method === 'tts.slice') {
      return { data: { plan: { ...plan, slices: [{ ...plan.slices[0], index: 8 }] } } };
    }
    return { data: { snapshot: { ...snapshot('playing', 0), unexpected: true } } };
  },
};
const badGateway = new ReaderTtsGateway(badRuntime);
await assert.rejects(() => badGateway.slice(chapter, '正文'), /inconsistent slice plan/);
await assert.rejects(() => badGateway.play(plan, 0), /unexpected field unexpected/);

function snapshot(state, currentSliceIndex) {
  return {
    state,
    currentSliceIndex,
    totalSlices: 2,
    completedSlices: 0,
    chapter,
    sliceStatuses: ['speaking', 'pending'],
    failurePolicy: 'stop',
    consecutiveFailures: 0,
    failureLimit: 3,
    drainBehavior: 'advance-to-next',
    restartPolicy: 'reset-on-core-restart',
  };
}

console.log('reader TTS strict gateway: PASS');

const precise = new ReaderTtsGateway({async request(method,params){
  assert.equal(method,'tts.config.put'); return {data:{config:{...params,configId:1}}};
}});
for (const ratePercent of [50,75,100,125,195,200]) {
  const result=await precise.putConfig({rate:Math.round(ratePercent/20),ratePercent,pitch:0,followSys:false});
  assert.equal(result.ratePercent,ratePercent);
}
for (const ratePercent of [49,77,201,NaN]) {
  await assert.rejects(() => precise.putConfig({rate:5,ratePercent,pitch:0,followSys:false}));
}
console.log('reader TTS precise rate round trip: PASS');

// Keep the real page's chapter construction in this regression. In PH101 the
// page added local body versions while the protocol still had its five fields;
// unversioned hand-written fixtures never exercised that production boundary.
const wireChapterKeys = Object.keys(JSON.parse(readFileSync(new URL(
  '../../Reader-Core-Native/protocol/reader-command.schema.json', import.meta.url), 'utf8')).$defs.TtsChapterRef.properties);
const Page = productionMotionMethods(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url).pathname,
['ttsChapterRef', 'commitTtsProgress'], {
  CoreReadingAnchor: class { constructor(chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion) {
    Object.assign(this, { chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion });
  } },
});
function versionedFixture(versions) {
  const page = new Page(), commits = [], wireCalls = [], core = new FakeGateway(), host = new FakeHost();
  Object.assign(page, { sourceId: fixtureChapter.sourceId, bookId: fixtureChapter.bookId,
    chapter: { ...fixtureChapter, ...versions, content: canonicalRemoteContent },
    isSessionActive: token => token === 1, requireChapterLayoutMap: () => ({ scalarCount: () => 13 }),
    coreLayout: () => ({}), admitCommittedProgress() {}, logTtsFailure: (_operation, error) => { throw error; },
    activeGateway: () => ({ runProgressCommitSerial: operation => operation(),
      resolveAndUpdateProgress: async (_book, _title, anchor) => { commits.push(anchor); return {}; } }),
  });
  const runtime = { async request(method, params = {}) {
    // The fake Core has the current Core field boundary, not a widened fake
    // that silently accepts Host-only fields. Check every command and plan.
    for (const ref of [params.chapter, params.nextChapter, params.plan?.chapter].filter(Boolean)) {
      assert.ok(Object.keys(ref).every(key => wireChapterKeys.includes(key)), `${method}: Core-only chapter fields`);
    }
    wireCalls.push({ method, params: structuredClone(params) });
    if (method === 'tts.config.get') return { data: { config: await core.getConfig() } };
    if (method === 'tts.slice') return { data: { plan: await core.slice(params.chapter, params.content) } };
    if (method === 'tts.queue.play') return { data: { snapshot: await core.play(params.plan, params.startSliceIndex) } };
    if (method === 'tts.queue.set-rate') return { data: { rate: params.rate, snapshot: await core.setRate(params.chapter, params.rate) } };
    if (method === 'tts.queue.report-callback') return { data: await core.reportCallback(params.chapter,
      params.sliceIndex, params.status, params.callbackId, params.failurePolicy, params.failureLimit) };
    if (method === 'tts.queue.report-status') return { data: { snapshot: await core.reportStatus(params.chapter, params.sliceIndex, params.status) } };
    if (method === 'tts.chapter.plan') return { data: { transition: { current: params.chapter,
      next: params.nextChapter, drainBehavior: params.drainBehavior } } };
    if (method === 'tts.queue.status') return { data: { snapshot: core.snapshot(core.queueState) } };
    const operation = method.split('.').at(-1);
    return { data: { snapshot: await core[operation === 'prev' ? 'previous' : operation](params.chapter, params.sliceIndex) } };
  } };
  return { page, commits, wireCalls, core, host, runtime, gateway: new ReaderTtsGateway(runtime) };
}
for (const versions of [
  { bodyVersion: undefined, processingVersion: undefined },
  { bodyVersion: 'body-v1', processingVersion: 'processing-v1' },
]) {
  const f = versionedFixture(versions), ref = f.page.ttsChapterRef(f.page.chapter);
  const coordinator = new ReaderTtsSessionCoordinator(f.gateway, f.host, progress => f.page.commitTtsProgress(progress, 1));
  await coordinator.start({ chapter: ref, content: canonicalRemoteContent, contentVersion: 'visible-v1', scalarPosition: 0 });
  assert.equal(f.host.requests.length, 1, `page → coordinator → gateway must reach Host speak: ${coordinator.getState().errorMessage}`);
  assert.equal(coordinator.getState().status, 'preparing');
  const requestId = f.host.requests[0].requestId;
  f.host.emit({ type: 'start', requestId }); await coordinator.whenSettled();
  assert.equal(coordinator.getState().status, 'playing');
  f.host.emit({ type: 'complete', requestId, completion: 'audio' }); await coordinator.whenSettled();
  assert.equal(f.commits.length, 1, 'real LRE progress guard must admit the matching local version');
  assert.equal(f.commits[0].bodyVersion, versions.bodyVersion);
  assert.equal(f.commits[0].processingVersion, versions.processingVersion);
  const second = f.host.requests.at(-1).requestId;
  f.page.chapter = { ...f.page.chapter, bodyVersion: 'body-v2', processingVersion: 'processing-v2' };
  await f.page.commitTtsProgress({ chapter: ref, charEnd: 13 }, 1);
  assert.equal(f.commits.length, 1, 'same chapter newer body must reject the old version progress');
  await coordinator.stop('contentChanged');
  f.host.emit({ type: 'complete', requestId: second, completion: 'audio' }); await coordinator.whenSettled();
  assert.equal(f.commits.length, 1, 'late completion after contentChanged must not advance progress');
  assert.equal(f.host.requests.length, 2, 'late completion after contentChanged must not speak an old next slice');
  assert.deepEqual(ref, { ...fixtureChapter, ...versions }, 'wire projection must not mutate the local identity');

  const sliced = await f.gateway.slice(ref, canonicalRemoteContent);
  await f.gateway.play({ ...sliced, chapter: ref }, 0);
  for (const operation of ['pause', 'resume', 'stop', 'next', 'previous', 'status']) await f.gateway[operation](ref);
  await f.gateway.seek(ref, 0); await f.gateway.skip(ref); await f.gateway.setRate(ref, 5);
  await f.gateway.reportStatus(ref, 0, 'speaking');
  await f.gateway.reportCallback(ref, 0, 'speaking', 'wire-boundary', 'stop');
  await f.gateway.chapterPlan(ref, { ...ref, chapterIndex: 1 }, 'advance-to-next');
  await assert.rejects(() => f.gateway.slice({ ...ref, unexpected: true }, canonicalRemoteContent), /unexpected field unexpected/);
  await assert.rejects(() => f.gateway.slice({ ...ref, bodyVersion: 42 }, canonicalRemoteContent), /invalid bodyVersion/);
  const untrusted = new ReaderTtsGateway({ async request() { return { data: { plan: { ...sliced, chapter: ref } } }; } });
  await assert.rejects(() => untrusted.slice(fixtureChapter, canonicalRemoteContent), /unexpected field bodyVersion/,
    'Core responses remain strict; only caller-owned local context is projected');
}
{
  const f = versionedFixture({ bodyVersion: 'body-v1', processingVersion: 'processing-v1' });
  let releaseSlice, enteredSlice;
  const sliceGate = new Promise(resolve => { releaseSlice = resolve; });
  const sliceEntered = new Promise(resolve => { enteredSlice = resolve; });
  const request = f.runtime.request.bind(f.runtime); let firstSlice = true;
  f.runtime.request = async (method, params) => {
    if (method === 'tts.slice' && firstSlice) { firstSlice = false; enteredSlice(); await sliceGate; }
    return request(method, params);
  };
  const coordinator = new ReaderTtsSessionCoordinator(f.gateway, f.host, progress => f.page.commitTtsProgress(progress, 1));
  const start = version => coordinator.start({ chapter: f.page.ttsChapterRef(f.page.chapter),
    content: canonicalRemoteContent, contentVersion: version, scalarPosition: 0 });
  const oldStart = start('visible-v1'); await sliceEntered;
  f.page.chapter = { ...f.page.chapter, bodyVersion: 'body-v2', processingVersion: 'processing-v2' };
  const newStart = start('visible-v2'); releaseSlice(); await Promise.all([oldStart, newStart]);
  assert.equal(f.host.requests.length, 1, 'same-chapter body replacement during slicing must never speak the old session');
  assert.equal(coordinator.getState().contentVersion, 'visible-v2');
  const requestId = f.host.requests[0].requestId;
  f.host.emit({ type: 'start', requestId }); await coordinator.whenSettled();
  f.host.emit({ type: 'complete', requestId, completion: 'audio' }); await coordinator.whenSettled();
  assert.equal(f.commits.length, 1);
  assert.equal(f.commits[0].bodyVersion, 'body-v2');
  assert.equal(f.commits[0].processingVersion, 'processing-v2');
  await coordinator.dispose();
}
console.log('PH101 versioned TTS start PASS: actual page reference/coordinator/gateway; strict Core fields; audio ACK; local version progress; stale-content stop; every queue and chapter command');
