import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderTtsSessionCoordinator, type ReaderTtsCoordinatorGateway } from
  '../../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts';
import type { ReaderTtsHost, ReaderTtsHostSpeakRequest } from
  '../../entry/src/main/ets/features/reading/application/ReaderTtsHostContract.ts';
import type { ReaderTtsQueueSnapshot } from '../../entry/src/main/ets/features/reading/application/ReaderTtsGateway.ts';

test('explicit voice replacement requires the chosen voice while startup keeps ordinary fallback', async () => {
  const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 0 };
  const playing: ReaderTtsQueueSnapshot = {
    state: 'playing', currentSliceIndex: 0, totalSlices: 1, completedSlices: 0, chapter,
    sliceStatuses: ['pending'], failurePolicy: 'stop', consecutiveFailures: 0, failureLimit: 1,
    drainBehavior: 'stop-on-boundary', restartPolicy: 'reset-on-core-restart',
  };
  const ack = async (): Promise<ReaderTtsQueueSnapshot> => playing;
  const gateway: ReaderTtsCoordinatorGateway = {
    getConfig: async () => undefined,
    slice: async () => ({ chapter, strategy: 'paragraph-then-sentence', sourceCharCount: 4,
      slices: [{ index: 0, text: 'read', charStart: 0, charEnd: 4, paragraphIndex: 0 }] }),
    play: ack, pause: ack, resume: ack, stop: ack, next: ack, previous: ack, seek: ack, skip: ack, setRate: ack,
    chapterPlan: async () => ({ current: chapter, drainBehavior: 'stop-on-boundary' }),
    reportStatus: ack,
    reportCallback: async () => ({ snapshot: playing, callbackDisposition: 'applied' }),
  };
  const requests: ReaderTtsHostSpeakRequest[] = [];
  const host: ReaderTtsHost = {
    setEventListener() {}, clearEventListener() {},
    isAvailable: async () => true, selectEngine: async () => true, probe: async () => ({ available: true }),
    activateAudioSession: async () => {}, deactivateAudioSession: async () => {}, stop: async () => {},
    publishPlaybackState() {},
    speak: async (request) => {
      requests.push(request);
      if (request.person === 13 && request.exactVoice === true) throw new Error('selected voice unavailable');
    },
  };
  const coordinator = new ReaderTtsSessionCoordinator(gateway, host);
  try {
    await coordinator.start({ chapter, content: 'read', contentVersion: 'v1', scalarPosition: 0 }, true);
    assert.equal(requests[0].exactVoice, undefined);
    await assert.rejects(coordinator.setVoice('zh-CN', 13), /selected voice unavailable/);
    assert.equal(requests[1].exactVoice, true);
    assert.equal(requests[2]?.person, 0);
    assert.equal(requests[2]?.exactVoice, undefined);
  } finally {
    await coordinator.dispose();
  }
});
