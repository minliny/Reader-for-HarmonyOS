import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CookiePersistenceQueue } from '../../entry/src/main/ets/platform/network/CookiePersistenceQueue.ts';

test('a blocked cookie write admits one trailing commit for a burst and waits for its durable clear', async () => {
  const writes: string[] = [];
  const first = Promise.withResolvers<void>();
  const cleared = Promise.withResolvers<void>();
  let jar = 'old';
  const queue = new CookiePersistenceQueue(async () => {
    writes.push(jar);
    if (writes.length === 1) await first.promise;
    else await cleared.promise;
  }, () => {});

  const inFlight = queue.schedule();
  await Promise.resolve();
  const updates = Array.from({ length: 128 }, (_, index) => {
    jar = String(index);
    return queue.schedule();
  });
  jar = '';
  let acknowledged = false;
  const clear = queue.schedule(true).then(() => { acknowledged = true; });
  first.resolve();
  await inFlight;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(acknowledged, false);
  cleared.resolve();
  await Promise.all([...updates, clear]);
  assert.deepEqual(writes, ['old', '']);
  assert.equal(acknowledged, true);
});

test('a failed cookie commit rejects a durable clear and leaves later commits usable', async () => {
  let attempts = 0;
  let failures = 0;
  const queue = new CookiePersistenceQueue(async () => {
    if (++attempts === 1) throw new Error('AssetStore unavailable');
  }, () => { failures += 1; });
  await assert.rejects(queue.schedule(true), /AssetStore unavailable/);
  await queue.schedule(true);
  assert.equal(failures, 1);
  assert.equal(attempts, 2);
});
