import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderDirectoryBackfill, ReaderDirectoryLocalPreparation } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryBackfill.ts';
import { readerDirectoryNoteMissingNavigation } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts';
import type { ReadingGatewayRuntime } from '../../entry/src/main/ets/features/reading/application/ReadingGatewayRuntime.ts';

test('a missing navigation reported before the first frame shares the armed backfill response', async () => {
  const backfill = new ReaderDirectoryBackfill();
  const frames: Array<() => void> = [];
  const runtime = { supportsCoreCapability: () => false } as unknown as ReadingGatewayRuntime;
  try {
    backfill.arm({ key: 'session-a', bookId: 'backfill-a', format: 'txt', runtime,
      current: () => true, postFrame: action => frames.push(action) });
    const first = readerDirectoryNoteMissingNavigation('backfill-a', 'navigationMissingOrStale');
    const second = readerDirectoryNoteMissingNavigation('backfill-a', 'navigationMissingOrStale');
    assert.ok(first);
    assert.equal(first, second);
    let completed = false;
    void first.then(() => { completed = true; });
    await Promise.resolve();
    assert.equal(completed, false);
    frames[0]();
    assert.deepEqual(await first, { status: 'unavailable' });
  } finally {
    backfill.retire();
  }
});

test('retiring a reading session resolves the pre-frame observation it had admitted', async () => {
  const backfill = new ReaderDirectoryBackfill();
  const runtime = { supportsCoreCapability: () => false } as unknown as ReadingGatewayRuntime;
  backfill.arm({ key: 'session-b', bookId: 'backfill-b', format: 'txt', runtime,
    current: () => true, postFrame: () => {} });
  const pending = readerDirectoryNoteMissingNavigation('backfill-b', 'navigationMissingOrStale');
  backfill.retire();
  assert.ok(pending);
  assert.deepEqual(await pending, { status: 'unavailable' });
});


test('detail TXT preparation is single-flight for one book and display epoch', async () => {
  const owner = new ReaderDirectoryLocalPreparation();
  const readiness = Promise.withResolvers<{ status: 'ready' }>();
  let preparations = 0;
  const prepare = () => { preparations += 1; return readiness.promise; };
  const first = owner.run('local-book', 'open-1', prepare);
  const same = owner.run('local-book', 'open-1', prepare);
  const reopened = owner.run('local-book', 'open-2', prepare);
  assert.equal(first, same);
  assert.notEqual(first, reopened);
  readiness.resolve({ status: 'ready' });
  assert.deepEqual(await Promise.all([first, same, reopened]), [{ status: 'ready' }, { status: 'ready' }, { status: 'ready' }]);
  assert.equal(preparations, 2);
  await owner.run('local-book', 'open-1', prepare);
  assert.equal(preparations, 3);
});
