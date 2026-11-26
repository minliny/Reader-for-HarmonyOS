import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveReadingDetailShelfAction } from '../../entry/src/main/ets/features/reading/presentation/ReadingDetailShelfActionPolicy.ts';

const remote = { inBookshelf: false, bookAvailable: true, removalEnabled: true,
  removing: false, adding: false, cancellingAdd: false };

test('static membership determines an enabled add or remove action', () => {
  assert.deepEqual(resolveReadingDetailShelfAction(remote),
    { label: '加入书架', enabled: true, busy: false, tone: 'accent' });
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, inBookshelf: true }),
    { label: '移除书架', enabled: true, busy: false, tone: 'ink' });
});

test('an add can be cancelled until cancellation is in flight', () => {
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, adding: true }),
    { label: '取消加入', enabled: true, busy: false, tone: 'accent' });
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, adding: true, cancellingAdd: true }),
    { label: '取消加入', enabled: false, busy: true, tone: 'accent' });
});

test('removed local books and active writes disable the shelf action', () => {
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, bookAvailable: false }),
    { label: '已移除', enabled: false, busy: false, tone: 'accent' });
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, inBookshelf: true, removing: true }),
    { label: '移除书架', enabled: false, busy: true, tone: 'ink' });
  assert.deepEqual(resolveReadingDetailShelfAction({ ...remote, inBookshelf: true, removalEnabled: false }),
    { label: '移除书架', enabled: false, busy: false, tone: 'ink' });
});
