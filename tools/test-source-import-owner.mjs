import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'model-preview-retry':'Retained pure policy plus actual parser: preserve/fill/all, current overwrite scope, partial receipt/retry, private raw DTO and duplicate rejection.',
 'detached-original-ack':'Actual retained import owner keeps accepted write lease through view detach, publishes exact receipt once to runtime observer and rejects old page callback; fake qualified Gateway.',
 'unknown-original-recovery':'Actual retained owner/model never retire unknown rows from readback alone; original qualified recovery receipt applies once without resubmission; fake Gateway.',
 'subscription-once':'Retained one-shot acquisition/preview/fixed import with HTTP scheme admission and preserved raw groups; fake read/write ports, no live subscription scheduler.',
 'rejection-refresh':'Actual retained owner requires a fresh catalog/overwrite scope after qualified rejection and refuses old/unconfirmed resubmission; fake qualified Gateway.',
 'page-data-source':'Actual ordinary DataSource and1777-row model/parser stay complete; full ETS syntax only, no Builder/native UI.',
};
const selected=selectContractCases(definitions);
if(!selected.length)process.exit(0);
const resolution=registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){const file=new URL(specifier+'.ts',context.parentURL);if(existsSync(file))return next(file.href,context);}return next(specifier,context);}});
try{
const {selectedProductionClasses}=await import('./lib/selected-production-methods.mjs');
const {bookshelfOperationClass:production}=await import('./lib/bookshelf-operation-owner-probe.mjs');
const {SourceImportModel,sourceImportGroupLabel}=await import('../entry/src/main/ets/features/source/SourceImportModel.ts');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const policy=await import('../entry/src/main/ets/app/HttpTransportPolicy.ts');
const {errorMessageOf}=await import('../entry/src/main/ets/app/ErrorMessage.ts');
// The real parser module carries its own limit/helpers. No copied numeric
// policy or private helper-name list; its explicit inert owner does no IO.
const PreparedGateway=production('features/source/SourceGateway.ts','SourceGateway',{
 ReaderRuntimeOwner:{current(){throw Error('Parser fixture requires an explicit inert owner');}},
 errorMessageOf,httpUrlHostname:policy.httpUrlHostname,isPrivateNetworkTarget:policy.isPrivateNetworkTarget,
});
const parser=new PreparedGateway({});
const ids = ['https://old.example.com', 'https://empty.example.com', 'https://document.example.com', 'https://new.example.com'];
const catalog = { version: 1, revision: 1, groups: [{ groupId: 'g-local', name: '本地组' }, { groupId: 'g-target', name: '目标组' }],
  memberships: [{ sourceId: ids[0], groupId: 'g-local', locallyAssigned: true }, { sourceId: ids[1], groupId: '', locallyAssigned: true }] };
const raw = ids.map((id, index) => ({ bookSourceUrl: id, bookSourceName: `书源${index}`, ...(index === 3 ? {} : { bookSourceGroup: '文件分组' }) }));
const text = JSON.stringify([...raw, { bookSourceName: '无地址项' }]);
const prepared = parser.prepareSubscriptionDocument(text);
// The real ordinary owner class runs against platform/Core adapters. No real
// file/network/Core mutation is performed by this focused lifecycle scenario.
const initialOriginal = () => ({ generation: 0, busy: false, confirmation: 'undispatched', label: '', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' });
class GatewayAdapter {
  constructor(runtime) { this.control = runtime.control; }
  static catalogSnapshot(runtime) { return runtime.control.catalog; }
  snapshot() { return structuredClone(this.control.original); }
  async loadCatalog(current) { assert.equal(current(), true); return this.control.catalog; }
  async importGrouped(params, current, evidence) {
    const control = this.control; assert.equal(current(), true); evidence.dispatched();
    control.fixed = structuredClone(params); control.imports++;
    control.original = { ...initialOriginal(), generation: 1, operationId: 'op-original', method: 'source.import.grouped',
      confirmation: 'unknown', blocked: true, original: { method: 'source.import.grouped', params: structuredClone(params) } };
    if (control.mode === 'knownReject') {
      evidence.rejectedBeforeExecution();
      control.original = { ...control.original, confirmation: 'undispatched', blocked: false, writeStage: 'cleanup' };
      control.catalog = { ...control.catalog, revision: control.catalog.revision + 1,
        memberships: control.catalog.memberships.map(member => member.sourceId === ids[0] ? { ...member, groupId: 'g-target' } : member) };
      throw new Error('source group revision changed; refresh preview');
    }
    if (control.mode === 'unknown') throw new Error('lost original ACK');
    const receipt = await new Promise(resolve => { control.complete = resolve; });
    assert.equal(current(), true, 'accepted business lease survives page detachment');
    evidence.confirmed(); control.original = { ...control.original, confirmation: 'confirmed', blocked: false };
    return receipt;
  }
  async recover(current, retry, operationId, onReceipt) {
    assert.equal(current(), true); assert.equal(operationId, 'op-original'); this.control.reconciles++;
    if (this.control.recoveryReceipt) { onReceipt(this.control.recoveryReceipt); this.control.original = { ...this.control.original, confirmation: 'confirmed', blocked: false }; }
    return this.snapshot();
  }
}
let Owner;
function ownerForRuntime(runtime){
 if(Owner===undefined){
const { SourceImportOwner: Type } = selectedProductionClasses(new URL('./fixtures/source-workflow/SourceImportOwner.ts', import.meta.url), ['SourceImportOwner'], {
  ReaderRuntimeOwner: { isCurrent: runtime => runtime.alive }, SourceGateway: PreparedGateway, SourceGroupGateway: GatewayAdapter, SourceImportModel, ReaderWriteEvidence,
});
 Owner=Type;
 }
 return Owner.forRuntime(runtime);
}
const receiptFor = params => ({ version: 1, revision: 2, importedCount: params.items.length, failedCount: 0,
  results: params.items.map((item, index) => ({ index, sourceId: item.sourceId, status: 'imported', name: item.bookSource.bookSourceName, groupId: '', locallyAssigned: true })) });
const makeRuntime = mode => ({ alive: true, control: { catalog, original: initialOriginal(), mode, imports: 0, reconciles: 0 },
  async selectBookSourceJson() { return { fileName: 'chosen.json', text }; },
  async loadOnlineJsonDocument(url) { this.control.readUrl = url; return { fileName: 'online.json', text }; } });
const flush = () => new Promise(resolve => setImmediate(resolve));

for(const id of selected){
if(id==="model-preview-retry"){
const historicalLabelCatalog = { ...catalog, groups: [...catalog.groups, { groupId: 'legacy-reserved', name: '未分组' }] };
assert.equal(sourceImportGroupLabel(historicalLabelCatalog, ''), '未分组');
assert.equal(sourceImportGroupLabel(historicalLabelCatalog, 'legacy-reserved'), '未分组（同名分组）');
assert.equal(prepared.items.length, 4); assert.equal(prepared.failures.length, 1);
const model = new SourceImportModel(); model.setCatalog(catalog); model.acceptDocument('真实解析夹具.json', text, prepared);
assert.deepEqual(model.snapshot().rows.slice(0, 4).map(row => row.finalGroup), ['本地组', '未分组', '文件分组', '未分组']);
model.setStrategy('fill'); model.setTarget('existing', 'g-target', '');
assert.deepEqual(model.snapshot().rows.slice(0, 4).map(row => row.finalGroup), ['本地组', '未分组', '文件分组', '目标组']);
model.setStrategy('all');
assert.equal(model.snapshot().confirmationRequired, true); assert.equal(model.snapshot().canSubmit, false);
const allScope = model.snapshot().confirmationScope; model.confirm(allScope, true);
const allPlan = model.plan(allScope); assert.ok(allPlan); assert.equal(allPlan.params.items.length, 4);
assert.equal(allPlan.params.items[0].bookSource.bookSourceGroup, '文件分组', 'Host does not rewrite raw JSON to impersonate a Core group ACK');
assert.equal(allPlan.params.strategy, 'all'); assert.equal(allPlan.params.targetGroupId, 'g-target');
model.select(1, false); assert.equal(model.snapshot().overwriteConfirmed, false);
model.confirm(allScope, true); assert.equal(model.snapshot().overwriteConfirmed, false, 'old selection scope cannot confirm a new set');
model.setTarget('new', '', '全部分组'); assert.match(model.snapshot().blockingMessage, /默认选项|冲突/);
model.setTarget('new', '', '😀'.repeat(33)); assert.match(model.snapshot().blockingMessage, /32/);
model.setTarget('new', '', '😀'.repeat(32));
assert.equal(model.snapshot().blockingMessage.includes('32'), false, 'name length follows codepoints');
model.setTarget('existing', 'g-target', '');
model.confirm(model.snapshot().confirmationScope, true);
model.setCatalog({ ...catalog, revision: 2, memberships: catalog.memberships.map(member => member.sourceId === ids[0] ? { ...member, groupId: 'g-target' } : member) });
assert.equal(model.snapshot().overwriteConfirmed, false, 'catalog/member revision retires confirmation');
model.setStrategy('preserve'); model.selectAll(false); model.select(0, true); model.select(3, true);
const partialPlan = model.plan(model.snapshot().confirmationScope);
assert.deepEqual(partialPlan.documentIndexes, [0, 3]);
model.applyReceipt({ version: 1, revision: 3, importedCount: 1, failedCount: 1, results: [
  { index: 0, sourceId: ids[0], status: 'imported', name: '书源0', groupId: 'g-target', locallyAssigned: true },
  { index: 1, sourceId: ids[3], status: 'failed', error: 'bad source' },
] }, partialPlan);
assert.equal(model.snapshot().rows[0].status, 'imported'); assert.equal(model.snapshot().rows[0].selected, false);
assert.equal(model.snapshot().rows[3].status, 'failed'); assert.equal(model.snapshot().confirmedImported, 1);
model.retryFailed(); assert.deepEqual(model.snapshot().rows.filter(row => row.selected).map(row => row.sourceId), [ids[3]]);
assert.equal(model.snapshot().canSubmit, false, 'retry needs a catalog at the acknowledged revision');
model.setCatalog({ ...catalog, revision: 3 }); assert.equal(model.snapshot().canSubmit, true);
const retryPlan = model.plan(model.snapshot().confirmationScope);
assert.deepEqual(retryPlan.params.items.map(item => item.sourceId), [ids[3]], 'retry cannot resubmit a retired success');
const exposed = model.snapshot(); exposed.rows[3].name = 'changed UI projection';
assert.equal(model.plan(model.snapshot().confirmationScope).params.items[0].bookSource.bookSourceName, '书源3', 'UI metadata cannot mutate the private DTO');
const duplicate = parser.prepareSubscriptionDocument(JSON.stringify([raw[0], raw[0], raw[3]]));
const duplicateModel = new SourceImportModel(); duplicateModel.setCatalog(catalog); duplicateModel.acceptDocument('duplicate.json', '', duplicate);
assert.equal(duplicateModel.snapshot().selectedCount, 1, 'duplicate identities are explicit invalid rows, not silent last-wins imports');


}
if(id==="detached-original-ack"){
const runtime = makeRuntime('deferred'); const owner = ownerForRuntime(runtime); let shown = true; const publications = [];
const runtimeReceipts = []; const unsubscribe = owner.subscribeReceipt(snapshot => runtimeReceipts.push(snapshot));
owner.attachPresentation('page-1', snapshot => publications.push(snapshot), () => shown); owner.setCatalog(catalog);
owner.dispatch({ kind: 'method', value: 'url' }, 'page-1'); owner.dispatch({ kind: 'url', value: 'https://example.com/books.json' }, 'page-1');
owner.dispatch({ kind: 'acquire' }, 'page-1'); await flush();
assert.equal(runtime.control.readUrl, 'https://example.com/books.json'); assert.equal(owner.current().stage, 'preview');
owner.dispatch({ kind: 'submit', scope: owner.current().confirmationScope }, 'page-1');
assert.equal(runtime.control.imports, 1); assert.equal(owner.current().stage, 'submitting');
shown = false; owner.detachPresentation('page-1'); const before = publications.length;
runtime.control.complete(receiptFor(runtime.control.fixed)); await flush();
assert.equal(owner.current().confirmedImported, 4); assert.equal(publications.length, before, 'detached UI receives no late publication');
assert.equal(runtimeReceipts.length, 1, 'exact ACK notifies runtime observer after presentation detach');
assert.equal(runtimeReceipts[0].confirmedImported, 4); assert.equal(runtimeReceipts[0].original.confirmation, 'confirmed');
unsubscribe(); owner.setCatalog({ ...catalog, revision: 2 }); assert.equal(runtimeReceipts.length, 1, 'catalog changes are not receipts');
shown = true; owner.attachPresentation('page-2', snapshot => publications.push(snapshot), () => shown);
assert.equal(publications.at(-1).confirmedImported, 4, 'new presentation receives the accepted receipt');
owner.dispatch({ kind: 'newDocument' }, 'page-1'); assert.equal(owner.current().stage, 'results', 'retired route callback cannot reset the new page');


}
if(id==="unknown-original-recovery"){
const uncertainRuntime = makeRuntime('unknown'); const uncertain = ownerForRuntime(uncertainRuntime);
const recoveredReceipts = []; uncertain.subscribeReceipt(snapshot => recoveredReceipts.push(snapshot));
uncertain.attachPresentation('uncertain', () => {}, () => true); uncertain.setCatalog(catalog);
uncertain.dispatch({ kind: 'acquire' }, 'uncertain'); await flush();
uncertain.dispatch({ kind: 'submit', scope: uncertain.current().confirmationScope }, 'uncertain'); await flush();
assert.equal(uncertain.current().original.confirmation, 'unknown'); assert.equal(uncertain.current().confirmedImported, 0);
assert.equal(uncertain.current().rows.filter(row => row.status === 'unknown').length, 4);
uncertain.dispatch({ kind: 'reconcile' }, 'uncertain'); await flush();
assert.equal(uncertain.current().confirmedImported, 0, 'readback without original ACK cannot retire current rows');
assert.equal(recoveredReceipts.length, 0, 'unknown/readback does not notify a completed receipt');
uncertainRuntime.control.recoveryReceipt = receiptFor(uncertainRuntime.control.fixed);
uncertain.dispatch({ kind: 'reconcile' }, 'uncertain'); await flush();
assert.equal(uncertain.current().confirmedImported, 4); const receiptGeneration = uncertain.current().receiptGeneration;
uncertain.dispatch({ kind: 'reconcile' }, 'uncertain'); await flush();
assert.equal(uncertain.current().receiptGeneration, receiptGeneration, 'retired original action cannot duplicate a completion');
assert.equal(recoveredReceipts.length, 1, 'original recovery notifies exactly once');
assert.equal(uncertainRuntime.control.imports, 1, 'reconcile uses the existing original, never current input resubmission');


}
if(id==="subscription-once"){
// Subscription acquisition is one real HTTP document read followed by the
// same preview/receipt journey; it does not create a subscription or schedule.
const subscriptionRuntime = makeRuntime('deferred'); const subscription = ownerForRuntime(subscriptionRuntime);
subscription.attachPresentation('subscription-once', () => {}, () => true); subscription.setCatalog(catalog);
subscription.dispatch({ kind: 'method', value: 'subscription' }, 'subscription-once');
subscription.dispatch({ kind: 'url', value: 'file:///not-a-subscription.json' }, 'subscription-once');
subscription.dispatch({ kind: 'acquire' }, 'subscription-once'); await flush();
assert.equal(subscriptionRuntime.control.readUrl, undefined, 'subscription URL shares HTTP/HTTPS admission');
subscription.dispatch({ kind: 'url', value: 'https://example.com/subscriptions/books.json' }, 'subscription-once');
subscription.dispatch({ kind: 'acquire' }, 'subscription-once'); await flush();
assert.equal(subscriptionRuntime.control.readUrl, 'https://example.com/subscriptions/books.json');
assert.equal(subscription.current().method, 'subscription'); assert.equal(subscription.current().stage, 'preview');
assert.equal(subscription.current().strategy, 'preserve'); assert.equal(subscriptionRuntime.control.imports, 0, 'reading a subscription URL is not an accepted import');
assert.deepEqual(subscription.current().rows.slice(0, 4).map(row => row.finalGroup), ['本地组', '未分组', '文件分组', '未分组'], 'one-shot preview keeps existing local assignments and explicit ungrouped membership');
subscription.dispatch({ kind: 'submit', scope: subscription.current().confirmationScope }, 'subscription-once');
assert.equal(subscriptionRuntime.control.fixed.strategy, 'preserve');
assert.equal(subscriptionRuntime.control.fixed.items[0].bookSource.bookSourceGroup, '文件分组', 'one-shot acquisition does not rewrite raw document groups');
const subscriptionReceipt = receiptFor(subscriptionRuntime.control.fixed);
subscriptionReceipt.results[0].groupId = 'g-local'; subscriptionReceipt.results[2].groupId = 'g-file';
subscriptionRuntime.control.complete(subscriptionReceipt); await flush();
assert.equal(subscription.current().confirmedImported, 4); assert.equal(subscriptionRuntime.control.imports, 1, 'one-shot import has one fixed mutation after preview approval');


}
if(id==="rejection-refresh"){
// A qualified rejection is a fresh-preview boundary, not an opportunity to
// resend the same stale CAS revision with an old overwrite checkbox.
const rejectedRuntime = makeRuntime('knownReject'); const rejected = ownerForRuntime(rejectedRuntime);
const rejectedReceipts = []; rejected.subscribeReceipt(snapshot => rejectedReceipts.push(snapshot));
rejected.attachPresentation('known-reject', () => {}, () => true); rejected.setCatalog(catalog);
rejected.dispatch({ kind: 'acquire' }, 'known-reject'); await flush();
rejected.dispatch({ kind: 'strategy', value: 'all' }, 'known-reject');
rejected.dispatch({ kind: 'target', targetKind: 'existing', groupId: 'g-target', name: '' }, 'known-reject');
const rejectedScope = rejected.current().confirmationScope;
rejected.dispatch({ kind: 'confirm', scope: rejectedScope, checked: true }, 'known-reject');
assert.equal(rejected.current().canSubmit, true);
rejected.dispatch({ kind: 'submit', scope: rejectedScope }, 'known-reject'); await flush();
assert.equal(rejected.current().original.confirmation, 'undispatched');
assert.equal(rejected.current().catalogState, 'error'); assert.equal(rejected.current().canSubmit, false);
assert.equal(rejected.current().confirmedImported, 0); assert.equal(rejectedReceipts.length, 0);
rejected.dispatch({ kind: 'submit', scope: rejectedScope }, 'known-reject'); await flush();
assert.equal(rejectedRuntime.control.imports, 1, 'known rejection cannot automatically resend its stale fixed revision');
rejected.dispatch({ kind: 'refresh' }, 'known-reject'); await flush();
assert.equal(rejected.current().catalogState, 'ready'); assert.equal(rejected.current().catalog.revision, 2);
assert.notEqual(rejected.current().confirmationScope, rejectedScope);
assert.equal(rejected.current().overwriteConfirmed, false, 'fresh catalog/member facts retire the former overwrite scope');
rejected.dispatch({ kind: 'confirm', scope: rejectedScope, checked: true }, 'known-reject');
assert.equal(rejected.current().overwriteConfirmed, false, 'an old native checkbox callback cannot re-confirm after refresh');
rejected.dispatch({ kind: 'submit', scope: rejectedScope }, 'known-reject');
rejected.dispatch({ kind: 'submit', scope: rejected.current().confirmationScope }, 'known-reject'); await flush();
assert.equal(rejected.current().canSubmit, false, 'current overwrite scope still requires a new explicit checkbox action');
assert.equal(rejectedRuntime.control.imports, 1, 'neither stale scope nor unconfirmed new scope dispatches a second write');


}
if(id==="page-data-source"){
// Actual ordinary data source; its selection also parses the complete ETS
// page. No unused method-presence assertion or Builder/native rendering claim.
const { SourceImportPageDataSource } = selectedProductionClasses(new URL('./fixtures/source-workflow/SourceImportPage.ets', import.meta.url), ['SourceImportPageDataSource']);
const largeModel = new SourceImportModel(); largeModel.setCatalog(catalog);
const largeText = JSON.stringify(Array.from({ length: 1777 }, (_, index) => ({ bookSourceUrl: `https://books.example.com/${index}`, bookSourceName: `书源${index}` })));
largeModel.acceptDocument('1777-sources.json', largeText, parser.prepareSubscriptionDocument(largeText));
const nativeRows = new SourceImportPageDataSource(); nativeRows.replace(largeModel.snapshot().rows);
assert.equal(nativeRows.totalCount(), 1777); assert.equal(nativeRows.getData(1776).sourceId, 'https://books.example.com/1776');
assert.equal(largeModel.plan(largeModel.snapshot().confirmationScope).params.items.length, 1777, 'large document has no pagination truncation');

}
recordContractCasePass(id);
}
}finally{resolution.deregister();}
