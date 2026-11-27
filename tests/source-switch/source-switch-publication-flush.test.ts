import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SourceSwitchPublicationFlush } from
  '../../entry/src/main/ets/features/source/application/SourceSwitchPublicationFlush.ts';

test('a flush owner wakes waiters on the next publication or cancellation without waiting for the native read', async () => {
  const owner = new SourceSwitchPublicationFlush();
  const states: string[] = [];
  owner.onCancel(() => states.push('cancel'));
  const active = owner.waitForChange().then(() => states.push('published'));
  owner.changed();
  await active;
  const pending = owner.waitForChange().then(() => states.push('retired'));
  owner.cancel();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(states, ['published', 'cancel', 'retired']);
  await pending;
  await owner.waitForChange();
});
