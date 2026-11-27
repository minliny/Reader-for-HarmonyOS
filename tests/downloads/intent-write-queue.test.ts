import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SharedDownloadIntentWriteQueue } from
  '../../entry/src/main/ets/features/downloads/application/SharedDownloadIntentWriteQueue.ts';

function signal(): { wait: Promise<void>; send: () => void } {
  let send = (): void => {};
  const wait = new Promise<void>(resolve => { send = resolve; });
  return { wait, send };
}

test('download intent bursts flush one latest snapshot and keep admissions pending until it is durable', async () => {
  let state = 'first';
  const stored: string[] = [];
  const writing = signal(), complete = signal();
  const queue = new SharedDownloadIntentWriteQueue(() => state, async snapshot => {
    stored.push(snapshot);
    writing.send();
    await complete.wait;
  }, 0);
  let acknowledged = 0;
  const first = queue.request().then(() => { acknowledged++; });
  state = 'combined';
  const next = queue.request().then(() => { acknowledged++; });
  try {
    await writing.wait;
    assert.deepEqual(stored, ['combined']);
    assert.equal(acknowledged, 0);
  } finally {
    complete.send();
    await Promise.all([first, next]);
  }
  assert.equal(acknowledged, 2);
});

test('a failed download snapshot does not acknowledge its batch or block the successor', async () => {
  let state = 'first';
  const attempts: string[] = [];
  const writing = signal(), failFirst = signal();
  const queue = new SharedDownloadIntentWriteQueue(() => state, async snapshot => {
    attempts.push(snapshot);
    if (snapshot === 'first') { writing.send(); await failFirst.wait; throw new Error('disk failure'); }
  }, 0);
  const first = queue.request();
  await writing.wait;
  state = 'stale';
  const second = queue.request();
  state = 'latest';
  const third = queue.request();
  failFirst.send();
  await assert.rejects(first, /disk failure/);
  await Promise.all([second, third]);
  assert.deepEqual(attempts, ['first', 'latest']);
});

test('a delayed download batch persists the snapshot requested before unconfirmed edits to another book', async () => {
  const books = { first: ['accepted'], second: ['retained'] };
  const stored: string[][][] = [];
  const holding = signal(), release = signal();
  const queue = new SharedDownloadIntentWriteQueue(
    () => [books.first.slice(), books.second.slice()],
    async snapshot => {
      stored.push(snapshot);
      if (stored.length === 1) { holding.send(); await release.wait; }
    }, 0);
  const first = queue.request();
  await holding.wait;
  books.first.push('next');
  const next = queue.request();
  books.second.push('unconfirmed-resume');
  release.send();
  await Promise.all([first, next]);
  assert.deepEqual(stored, [[['accepted'], ['retained']], [['accepted', 'next'], ['retained']]]);
});
