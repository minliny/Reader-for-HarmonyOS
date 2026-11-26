import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SyncWriteObservation } from '../../entry/src/main/ets/features/sync/application/SyncOperationProjection.ts';
import { RssPresentationProjection } from '../../entry/src/main/ets/features/rss/presentation/RssPresentationProjection.ts';
import type { RssSubscription } from '../../entry/src/main/ets/features/rss/application/RssGateway.ts';

test('a new sync operation owns independent acknowledgement and readback facts', () => {
  const previous = new SyncWriteObservation();
  previous.write.dispatched();
  const current = new SyncWriteObservation();
  assert.equal(previous.write.confirmation(), 'unknown');
  assert.equal(current.write.confirmation(), 'undispatched');
  assert.ok(current.writeGeneration > previous.writeGeneration);
  assert.equal(current.uploadQualified, false);
  assert.equal(current.configReceiptQualified, false);
});

test('RSS management retains disabled subscriptions and falls back to the feed address', () => {
  const subscription = { subscriptionId: 'feed', title: '更新', enabled: false,
    siteUrl: ' ', feedUrl: 'https://feed.example.test/rss', sourceGroup: '待读', customOrder: 3 } as RssSubscription;
  const state = RssPresentationProjection.feed([subscription], []);
  assert.deepEqual(RssPresentationProjection.managementItems(state), [
    { subscriptionId: 'feed', title: '更新', meta: '待读 · 排序 3 · https://feed.example.test/rss · 已停用', enabled: false },
  ]);
});
