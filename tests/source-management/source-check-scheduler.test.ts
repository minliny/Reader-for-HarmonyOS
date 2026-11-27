import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import type { ReaderCoreResultEvent } from '@reader/core-harmony';
import type { BookRequestOptions } from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import { BookAcquisitionCoordinator } from '../../entry/src/main/ets/features/reading/application/BookAcquisitionCoordinator.ts';

test('source checks share the background limit and retain separate terminal and stage ownership', async () => {
  const admitted: { method: string; options: BookRequestOptions; finish: () => void }[] = [];
  const coordinator = new BookAcquisitionCoordinator((method, _params, options) =>
    new Promise<ReaderCoreResultEvent>((resolve) => {
      const requestId = admitted.length + 1;
      admitted.push({ method, options, finish: () => resolve({ protocolVersion: 1, requestId, type: 'result', data: {} }) });
    }));
  const stages: string[] = [];
  const firstOptions: BookRequestOptions = { onSourceCheckStage: stage => stages.push('first:' + stage) };
  const secondOptions: BookRequestOptions = { onSourceCheckStage: stage => stages.push('second:' + stage) };
  const source = { sourceIds: ['source-a'] };

  try {
    const preparation = coordinator.request('reading.entry.snapshot', {}, {}, 'background');
    const first = coordinator.request('source.check.run', source, firstOptions);
    const second = coordinator.request('source.check.run', source, secondOptions);
    const ephemeral = coordinator.request('source.check.ephemeral.run', {}, {});
    assert.deepEqual(admitted.map(item => item.method), ['reading.entry.snapshot', 'source.check.run']);

    const foreground = coordinator.request('book.search', {}, {}, 'foreground');
    assert.equal(admitted.at(-1)?.method, 'book.search');
    admitted[1].options.onSourceCheckStage?.('L2');
    admitted[1].finish();
    await first;
    await setImmediate();
    assert.equal(admitted[3]?.method, 'source.check.run');
    admitted[3].options.onSourceCheckStage?.('L3');
    assert.deepEqual(stages, ['first:L2', 'second:L3']);

    admitted[0].finish();
    await preparation;
    await setImmediate();
    assert.equal(admitted[4]?.method, 'source.check.ephemeral.run');
    admitted[2].finish();
    admitted[3].finish();
    admitted[4].finish();
    const results = await Promise.all([first, second, ephemeral, foreground]);
    assert.deepEqual(results.map(result => result.requestId), [2, 4, 5, 3]);
  } finally {
    for (const request of admitted) request.finish();
    coordinator.close();
  }
});
