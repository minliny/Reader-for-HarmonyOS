import assert from 'node:assert/strict';

import { ReaderTtsGateway } from '../entry/src/main/ets/features/reading/ReaderTtsGateway.ts';

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
