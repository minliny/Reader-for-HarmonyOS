import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function sourceSelection() {
 const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsOrchestrator.ets',import.meta.url),'utf8');
 let owner={};const runtime=owner,emitted=[];let pageCurrent=true;
 class SelectionGateway {originalMutationSnapshot(){return undefined;}}
 const body=source.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
 const Orchestrator=new Function('ReaderRuntimeOwner','SourceGateway',stripTypeScriptTypes(body)+';return SourceToolsOrchestrator;')({isCurrent:value=>value===owner,current:()=>owner},SelectionGateway);
 const host=new Orchestrator(value=>emitted.push(value),()=>pageCurrent,runtime);host.snapshot={...host.snapshot,sources:[{sourceId:'a'},{sourceId:'b'}]};
 const oldSelection=host.snapshot.selectedSourceIds;host.toggleSelection('a');host.toggleSelection('a');assert.deepEqual(oldSelection,[]);assert.deepEqual(host.snapshot.selectedSourceIds,[]);
 host.toggleSelection('b');host.toggleSelection('a');assert.deepEqual(host.snapshot.selectedSourceIds,['b','a']);host.selectAll();assert.deepEqual(host.snapshot.selectedSourceIds,['a','b']);
 assert.deepEqual(host.consumeSelection(['b','missing','a','b']),['b','a']);assert.deepEqual(host.snapshot.selectedSourceIds,[]);
 host.setSelection(['a']);host.snapshot.busy=true;host.toggleSelection('b');assert.deepEqual(host.consumeSelection(['a']),[]);assert.deepEqual(host.snapshot.selectedSourceIds,['a']);
 host.snapshot.busy=false;host.pendingOperations=1;host.selectAll();assert.deepEqual(host.snapshot.selectedSourceIds,['a']);host.pendingOperations=0;
 pageCurrent=false;assert.deepEqual(host.consumeSelection(['a']),[]);pageCurrent=true;owner={};assert.deepEqual(host.consumeSelection(['a']),[]);
 assert.ok(emitted.length>0,'production publish/deliver runs, not a copied selection algorithm');
}
async function rssProjection(){const {RssPresentationProjection}=await import('../entry/src/main/ets/features/rss/RssPresentationProjection.ts');
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
}
const cases={'source-selection':sourceSelection,'rss-projection':rssProjection};
for(const id of selectContractCases({'source-selection':'Actual canonical selection owner with no durable fixture/SDK/CLI','rss-projection':'Pure RSS DTO and honest management metadata projection'})){await cases[id]();recordContractCasePass(id);}
