import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runV9CandidateChecks } from '../../entry/src/main/ets/features/source/application/SourceV9TransferState.ts';

test('stopping a bounded source check prevents dispatch and publication of stale rows', async () => {
  const dispatched: number[] = [];
  const published: number[] = [];
  const settle: (() => void)[] = [];
  let current = true;
  const pending = runV9CandidateChecks([1, 2, 3], () => current, async (row) => {
    dispatched.push(row);
    await new Promise<void>(resolve => settle.push(resolve));
    return row;
  }, () => {}, (_row, result) => published.push(result), assert.fail, 2);
  assert.deepEqual(dispatched, [1, 2]);
  current = false;
  for (const release of settle) release();
  await pending;
  assert.deepEqual(dispatched, [1, 2]);
  assert.deepEqual(published, []);
});
