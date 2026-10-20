import assert from 'node:assert/strict';
import { searchAttachmentFixture } from './lib/search-index-action-attachment-probe.mjs';
const intents = page => [() => page.onBack(), () => page.onSearch('原草稿', ['original-source']), () => page.onStop(),
  () => page.onClearHistory(), () => page.onRetryHistory(), () => page.onSelectResult({ sourceId: 's', bookId: 'b' }, []),
  () => page.onVisibleGroups([]), () => page.onRetry(), () => page.onManageSources()];
let cases = 0;
// Real whole SearchPage → real Icon/Button native click → actual Index Builder
// callbacks. Back executes the entire production navigation method.
{
 const f = searchAttachmentFixture(), old = f.physical(f.first);
 f.index.route = 'detail'; const book = f.index.detailBook;
 old.back(); old.search(); for (const act of intents(f.first)) act();
 assert.equal(f.index.route, 'detail'); assert.equal(f.index.detailBook, book); assert.deepEqual(f.calls, []); cases++;
 f.index.route = 'search'; f.index.navigationGeneration++;
 const current = f.mount(), now = f.physical(current);
 old.back(); old.search(); for (const act of intents(f.first)) act(); assert.deepEqual(f.calls, []);
 now.search(); assert.deepEqual(f.calls.pop(), ['performSearch', '原草稿', undefined]);
 for (const action of intents(current).slice(1)) action();
 assert.equal(f.calls.filter(c => c[0] === 'performSearch').length, 1);
 assert.equal(f.calls.filter(c => c[0] === 'retryHistory').length, 1);
 assert.equal(f.calls.length, 8, 'all eight current non-Back UI intents accepted once');
 f.calls.length = 0; now.back(); assert.equal(f.index.route, 'bookshelf'); assert.equal(f.index.detailBook, undefined);
 assert.deepEqual(f.calls.map(c => c[0]), ['closeSearch','nextNavigation','installSession','endSearch','refreshBookshelf']); cases++;
}
// One changed scope fact at a time. Old physical actors remain mounted so
// common-control mounted admission cannot hide a missing parent guard.
const axes = [
 ['route', f => { f.index.route = 'detail'; }, text => text.replace("this.route === 'search' &&", '')],
 ['generation', f => { f.index.navigationGeneration++; }, text => text.replace('generation === this.navigationGeneration &&', '')],
 ['mount', f => { f.index.detailShelfAdmissionMount++; }, text => text.replace('mounting === this.detailShelfAdmissionMount &&', '')],
 ['owner', f => { const next = { bookAcquisitions: f.native.bookAcquisitions }; f.index.mountedRuntimeOwner = next; f.setRuntime(next); }, text => text.replace('this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&', '')],
 ['host', f => { f.index.searchHost = new f.SearchHost(() => {}, () => true); }, text => text.replace('&& this.searchHost === host', '')],
];
for (const [name, alter, mutation] of axes) {
 const normal = searchAttachmentFixture(), physical = normal.physical(normal.first); alter(normal);
 physical.back(); physical.search(); for (const act of intents(normal.first)) act(); assert.deepEqual(normal.calls, [], name + ': all nine old intents reject');
 const broken = searchAttachmentFixture({ mutatePredicate: text => { const changed = mutation(text); assert.notEqual(changed, text); return changed; } });
 const brokenPhysical = broken.physical(broken.first); alter(broken); brokenPhysical.back();
 assert.equal(broken.index.route, 'bookshelf', name + ': actual native old Back reproduces wrong navigation when only this guard is deleted');
 assert.ok(broken.calls.some(c => c[0] === 'refreshBookshelf')); cases++;
}
{
 const f = searchAttachmentFixture(), old = f.physical(f.first); f.index.shelfReceiptRetired = true;
 old.back(); old.search(); for (const act of intents(f.first)) act(); assert.deepEqual(f.calls, []); cases++;
}
{
 const f = searchAttachmentFixture(), old = f.physical(f.first); f.setRuntime(undefined);
 assert.doesNotThrow(() => { old.back(); old.search(); for (const act of intents(f.first)) act(); });
 assert.deepEqual(f.calls, [], 'actual unavailable Runtime identity rejects without hard current() acquisition'); cases++;
}
{
 const f = searchAttachmentFixture(), actor = f.physical(f.first);
 const b = actor.button; b.updateStateVars({ scheme:b.scheme,specId:b.specId,label:b.label,primary:b.primary,actionEnabled:false,layout:b.layout,isBusy:b.isBusy,availableWidth:b.availableWidth,actionAccessibilityLabel:b.actionAccessibilityLabel });
 f.controls.properties.flush(); actor.search(); assert.deepEqual(f.calls, [], 'actual retained disabled Button blocks physical search');
 b.aboutToDisappear(); actor.search(); assert.deepEqual(f.calls, [], 'actual unmounted Button blocks retained physical search'); cases++;
}
console.log(`PASS Search physical attachment: ${cases} complete SearchPage/actual Icon+Button/Index Builder cases; all 9 old UI intents reject; current positive; five independent guard-removal native Back counterexamples. Native OS delivery/focus/layout remain NOT_RUN.`);
