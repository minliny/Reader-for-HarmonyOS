import assert from 'node:assert/strict';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

for (const id of selectContractCases({
  'host-events': {
    description: 'Actual TTS coordinator stops in-flight Host transport on the same turn as a cancelling platform event',
    resources: [],
  },
})) {
  await verifyHostEvents();
  recordContractCasePass(id);
}

async function verifyHostEvents() {
  const { ReaderTtsSessionCoordinator } = await import(
    '../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts'
  );
  const { chapter, canonicalRemoteContent, plan, FakeGateway, FakeHost } = await import('./lib/reader-tts-fixtures.mjs');
  const events = [
    { name: 'media pause', event: { type: 'mediaControl', action: 'pause' } },
    { name: 'media stop', event: { type: 'mediaControl', action: 'stop' } },
    { name: 'media next', event: { type: 'mediaControl', action: 'next' } },
    { name: 'media previous', event: { type: 'mediaControl', action: 'previous' }, scalarPosition: plan.slices[1].charStart },
    { name: 'interruption pause', event: { type: 'interruption', action: 'pause' } },
    { name: 'interruption stop', event: { type: 'interruption', action: 'stop' } },
    { name: 'device stop', event: { type: 'deviceChange', action: 'stop' } },
  ];

  async function checkBlockedSpeech(contentVersion, scalarPosition, check) {
    const host = new FakeHost();
    const coordinator = new ReaderTtsSessionCoordinator(new FakeGateway(), host, async () => {});
    const speak = host.blockNextSpeak();
    const startTask = coordinator.start({ chapter, content: canonicalRemoteContent, contentVersion, scalarPosition });
    try {
      await Promise.race([
        speak.entered,
        startTask.then(() => assert.fail('production start settled before reaching blocked Host speak')),
      ]);
      const stopCount = () => host.calls.filter(call => call === 'stop').length;
      assert.equal(stopCount(), 0, 'the blocked start itself does not cancel transport');
      check(host, stopCount);
    } finally {
      speak.release();
      try {
        await startTask;
        await coordinator.whenSettled();
        await coordinator.whenSettled();
      } finally {
        await coordinator.dispose();
      }
    }
  }

  for (const [index, scenario] of events.entries()) {
    await checkBlockedSpeech(index + 4, scenario.scalarPosition ?? 0, (host, stopCount) => {
      host.emit(scenario.event);
      assert.equal(stopCount(), 1, `${scenario.name} must stop Host transport before the blocked speak settles`);
    });
  }

  await checkBlockedSpeech(11, 0, (host, stopCount) => {
    const requestId = host.requests.at(-1).requestId;
    host.emit({ type: 'complete', requestId, completion: 'synthesis' });
    assert.equal(stopCount(), 0, 'a matching synthesis-only callback cannot cancel transport');
  });
}
