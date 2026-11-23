import assert from 'node:assert/strict';
import { searchAttachmentFixture } from './lib/search-index-action-attachment-probe.mjs';
const candidate = { sourceId: 's', bookId: 'b', sourceName: '来源', title: '测试书籍', author: '作者',
  category: 'novel', detailUrl: 'b', variables: [] };
const intents = page => [() => page.onBack(), () => page.onSearch('原草稿', ['original-source']), () => page.onStop(),
  () => page.onClearHistory(), () => page.onRetryHistory(), () => page.onSelectResult(candidate, []),
  () => page.onVisibleGroups([]), () => page.onRetry(), () => page.onManageSources()];
let cases = 0;
// Current Index -> Results -> Page callbacks and actual shared/native retry.
// Query/search advances its own navigation lease, so each positive intent uses
// a fresh current opening rather than pretending its predecessor stays live.
{
 const f = searchAttachmentFixture(), old = f.physical(f.first);
 f.navigation.show('detail'); const book = f.reading.book;
 old.retry(); for (const act of intents(f.first)) act();
 assert.equal(f.navigation.snapshot().route, 'detail'); assert.equal(f.reading.book, book); assert.deepEqual(f.calls, []); cases++;
 f.navigation.show('search'); f.navigation.advance();
 const current = f.mount(), now = f.physical(current);
 old.retry(); for (const act of intents(f.first)) act(); assert.deepEqual(f.calls, []);
 now.retry(); assert.equal(f.calls.filter(c => c[0] === 'retrySearch').length, 1);
 const names = ['performSearch','stopSearch','clearSearchHistory','retryHistory','onSearchResultSelected',
  'scheduleSearchDetailWarmups','retrySearch','manageSourcesFromSearch'];
 for (const [ordinal, name] of names.entries()) {
  const active = searchAttachmentFixture(); intents(active.first)[ordinal + 1]();
  assert.equal(active.calls.filter(call => call[0] === name).length, 1, name + ': current UI intent accepted once');
  if (name === 'performSearch') assert.deepEqual(active.calls.find(call => call[0] === name),
    ['performSearch', '原草稿', ['original-source']], 'real Journey/Host preserve explicit source scope');
 }
 const back = searchAttachmentFixture(); back.first.taskStatusExpanded = false; back.library.mode = 'idle';
 back.first.onBack();
 assert.equal(back.navigation.snapshot().route, 'bookshelf'); assert.equal(back.reading.book, undefined);
 assert.deepEqual(back.reading.toc, [], 'actual reading owner retires detail projection');
 assert.deepEqual(back.calls.map(c => c[0]), ['closeSearch','nextNavigation','clearRssSelection','endSearch',
  'refreshBookshelf','readbackOnBookshelf']); cases++;
}
// Change one scope fact while retaining the mounted shared/native actor. Each
// mutation deletes only the corresponding real Journey predicate clause.
// Native retry exposes its missing parent admission even when Back has an
// additional destination-route check in the current journey.
const axes = [
 ['route', f => { f.navigation.show('detail'); }, text => text.replace("route.route === 'search' && ", '')],
 ['generation', f => { f.navigation.advance(); }, text => text.replace('generation === route.generation &&', '')],
 ['mount', f => { f.index.detailShelfAdmissionMount++; }, text => text.replace('mounting === scope.mounting &&', '')],
 ['owner', f => { const next = {}; f.index.mountedRuntimeOwner = next; f.setRuntime(next); },
  text => text.replace('this.ports.acquisition().currentOwner() === owner &&', '')],
 ['host', f => { const next = new f.SearchHost(() => {}, () => true); next.orchestrator = f.host.orchestrator; f.library.host = next; },
  text => text.replace('&& this.ports.search().host === host', '')],
];
for (const [name, alter, mutation] of axes) {
 const normal = searchAttachmentFixture(), physical = normal.physical(normal.first); alter(normal);
 physical.retry(); for (const act of intents(normal.first)) act(); assert.deepEqual(normal.calls, [], name + ': all nine old intents reject');
 const broken = searchAttachmentFixture({ mutatePredicate: text => { const changed = mutation(text); assert.notEqual(changed, text); return changed; } });
 const brokenPhysical = broken.physical(broken.first); alter(broken); brokenPhysical.retry();
 assert.equal(broken.calls.filter(call => call[0] === 'retrySearch').length, 1,
  name + ': actual retained native retry dispatches when only this parent guard is deleted'); cases++;
}
{
 const f = searchAttachmentFixture(), old = f.physical(f.first); f.index.shelfReceiptRetired = true;
 old.retry(); for (const act of intents(f.first)) act(); assert.deepEqual(f.calls, []); cases++;
}
{
 const f = searchAttachmentFixture(), old = f.physical(f.first); f.setRuntime(undefined);
 assert.doesNotThrow(() => { old.retry(); for (const act of intents(f.first)) act(); });
 assert.deepEqual(f.calls, [], 'actual unavailable acquisition Runtime identity rejects without hard current() acquisition'); cases++;
}
{
 const f = searchAttachmentFixture(), actor = f.physical(f.first);
 const b = actor.button; b.updateStateVars({ scheme:b.scheme,specId:b.specId,label:b.label,primary:b.primary,actionEnabled:false,layout:b.layout,isBusy:b.isBusy,availableWidth:b.availableWidth,actionAccessibilityLabel:b.actionAccessibilityLabel });
 f.controls.properties.flush(); actor.retry(); assert.deepEqual(f.calls, [], 'actual retained disabled Button blocks physical retry');
 b.aboutToDisappear(); actor.retry(); assert.deepEqual(f.calls, [], 'actual unmounted Button blocks retained physical retry'); cases++;
}
console.log(`PASS Search physical attachment: ${cases} current Index/Results/Journey/Host and actual shared/native retry cases; all 9 old UI intents reject; current positives; five independent predicate-removal counterexamples. Native OS delivery/focus/layout remain NOT_RUN.`);
