import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { RssPresentationProjection } from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';

const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
const code = stripTypeScriptTypes(read('features/source/SourceToolsOrchestrator.ets').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
let live;
const { SourceToolsOrchestrator, EMPTY_SOURCE_TOOLS_SNAPSHOT } = new Function('ReaderRuntimeOwner', 'SourceGateway',
  code + '; return { SourceToolsOrchestrator, EMPTY_SOURCE_TOOLS_SNAPSHOT };')(
  { current: () => live, isCurrent: owner => owner === live }, class Gateway {});
const owner = {}; live = owner; let pageCurrent = true; const emitted = [];
const host = new SourceToolsOrchestrator(snapshot => emitted.push(snapshot), () => pageCurrent, owner);
host.snapshot = { ...EMPTY_SOURCE_TOOLS_SNAPSHOT, sources: [{ sourceId: 'a' }, { sourceId: 'b' }] };
const staleUiSelection = host.snapshot.selectedSourceIds;
host.toggleSelection('a'); host.toggleSelection('a');
assert.deepEqual(staleUiSelection, []); assert.deepEqual(host.snapshot.selectedSourceIds, [],
  'two rapid intents use the actual owner, not a stale page copy');
host.toggleSelection('b'); host.toggleSelection('a'); assert.deepEqual(host.snapshot.selectedSourceIds, ['b', 'a']);
host.selectAll(); assert.deepEqual(host.snapshot.selectedSourceIds, ['a', 'b']);
assert.deepEqual(host.consumeSelection(['b', 'missing', 'a', 'b']), ['b', 'a']);
assert.deepEqual(host.snapshot.selectedSourceIds, []);
host.setSelection(['a']); host.snapshot.busy = true;
host.toggleSelection('b'); assert.deepEqual(host.consumeSelection(['a']), []); assert.deepEqual(host.snapshot.selectedSourceIds, ['a']);
host.snapshot.busy = false; host.pendingOperations = 1; host.selectAll(); assert.deepEqual(host.snapshot.selectedSourceIds, ['a']);
host.pendingOperations = 0; pageCurrent = false; assert.deepEqual(host.consumeSelection(['a']), []);
pageCurrent = true; live = {}; assert.deepEqual(host.consumeSelection(['a']), []);

// Characterized current-UI contract, independent of whether Index still
// contains the previous implementations. Construct the local-time input so
// the existing local date formatting has a stable expected value in each CI
// timezone without changing the user's/system's timezone.
const subscriptions = [{ subscriptionId: 'one', title: '完整订阅', enabled: false, feedUrl: 'https://fixture/feed',
  siteUrl: 'https://fixture/site', sourceGroup: '分组', customOrder: 0, ruleArticles: 'article', lastFetchAt: new Date(2024, 4, 2, 7, 1).getTime() },
  { subscriptionId: 'two', title: '', enabled: true, feedUrl: 'https://fixture/empty', sourceGroup: ' ', ruleArticles: '', lastFetchAt: 0 }];
const unread = [{ id: 'entry', title: '文章' }];
assert.deepEqual(RssPresentationProjection.feed(subscriptions, unread), { kind: 'feed', subscriptions, recentUnread: unread });
for (const presentation of [{ kind: 'feed', subscriptions, recentUnread: unread },
  { kind: 'refreshing', subscriptions, recentUnread: unread }, { kind: 'emptyUnread', subscriptions },
  { kind: 'fatalError', failedSources: [{ name: 'fixture', reason: '网络失败' }] }]) {
  assert.deepEqual(RssPresentationProjection.subscriptions(presentation), presentation.kind === 'fatalError' ? [] : subscriptions);
  assert.deepEqual(RssPresentationProjection.recentUnread(presentation), ['feed', 'refreshing'].includes(presentation.kind) ? unread : []);
  assert.deepEqual(RssPresentationProjection.managementItems(presentation), presentation.kind === 'fatalError' ? [] : [
    { subscriptionId: 'one', title: '完整订阅', enabled: false,
      meta: '分组 · 排序 0 · 规则型 · https://fixture/site · 上次刷新 2024-05-02 07:01 · 已停用' },
    { subscriptionId: 'two', title: '', enabled: true, meta: 'https://fixture/empty' },
  ]);
}
assert.match(RssPresentationProjection.managementMeta(subscriptions[0]), /^分组 · 排序 0 · 规则型 · https:\/\/fixture\/site · 上次刷新 /);
assert.ok(RssPresentationProjection.managementMeta(subscriptions[0]).endsWith(' · 已停用'));
assert.equal(RssPresentationProjection.managementMeta(subscriptions[1]), 'https://fixture/empty');
assert.doesNotMatch(RssPresentationProjection.managementMeta(subscriptions[0]), /健康|正常|已保存|已确认|成功/);
console.log('PASS actual SourceTools canonical selection and RSS full DTO projection: rapid intents/stale UI/busy/owner, normalized scope, four presentation states and current-UI metadata differential. Index/SDK integration is a separate exit.');
