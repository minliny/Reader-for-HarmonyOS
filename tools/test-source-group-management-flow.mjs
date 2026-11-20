import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({
  "invalid-group-identity": "Retained group identity filter stays empty for deleted ID and follows rename without reviving old identity.",
  "category-membership": "Retained category aggregate preserves actual categories and distinguishes unknown from explicit ungrouped.",
  "tools-scope-projection": "Actual retained current/all/query projection only; removed private Tools selection consumer is not synthesized.",
  "delete-plan": "Actual model binds delete/move target and catalog revision and refuses invalid/blocked plans.",
  "group-name": "Actual group name policy counts32Unicode codepoints and rejects reserved/duplicate names.",
  "assignment-plan": "Actual assignment model deduplicates frozen IDs and refuses unknown live entities.",
  "canonical-refresh": "Actual retained owner/gateway qualify ACK and refresh canonical catalog revision; fake mutation transport only.",
  "receipt-scope": "Actual group receipt qualifier refuses incomplete affected IDs without confirmation.",
  "delete-confirmation": "Actual owner permits delete only for the exact confirmed command/target/revision.",
  "recovery-identity": "Actual retained owner/gateway route exact generation/operation identity through qualifier; fake recovery transport, no durable journal.",
  "accepted-detach": "Actual retained owner keeps accepted write after view detach and rejects retired identity dispatch; fake RPC only."
});
if(!selected.length)process.exit(0);
const resolution=registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){const file=new URL(specifier+'.ts',context.parentURL);if(existsSync(file))return next(file.href,context);}return next(specifier,context);}});
try{
const {bookshelfOperationClass}=await import('./lib/bookshelf-operation-owner-probe.mjs');
const {selectedProductionClasses}=await import('./lib/selected-production-methods.mjs');
const {isReaderCoreTransactionPendingError}=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const production=(file,names,dependencies={})=>bookshelfOperationClass(file,'({'+names.join(',')+'})',dependencies);
const model=await import('../entry/src/main/ets/features/source/SourceGroupManagementModel.ts');
const presentation=await import('../entry/src/main/ets/features/source/SourceManagementPresentation.ts');
// Retained, currently unmounted group capability. SDK ordinary production
// classes run with explicit RPC/RulesMutation transport ports, not Core IO.
const clone = value => structuredClone(value);
const source = (sourceId, name, category, groupId) => ({ sourceId, name, category, groupId,
  baseUrl: `https://${sourceId}.invalid`, enabled: true, enabledExplore: false, checkState: 'unchecked' });
const sources = [source('a', 'Alpha', 'novel', 'ga'), source('b', 'Beta', 'comic', 'ga'),
  source('c', 'Gamma', 'music', 'gb'), source('d', 'Delta', 'download', ''),
  source('e', 'Epsilon', 'external', 'gb'), source('f', 'Zeta', 'other', undefined)];
const catalog = { version: 1, revision: 17, groups: [{ groupId: 'ga', name: '常用' }, { groupId: 'gb', name: '收藏' }],
  memberships: sources.filter(item => item.groupId !== undefined).map(item => ({ sourceId: item.sourceId, groupId: item.groupId, locallyAssigned: true })) };
let installedRuntime;
const Runtime = { current: () => installedRuntime, isCurrent: value => value === installedRuntime && value.alive };
const ports = new WeakMap();
const RulesMutationOwner = { forRuntime: runtime => ports.get(runtime) };
const gatewayTypes = production('features/source/SourceGroupGateway.ts',
  ['SourceGroupGateway', 'decodeSourceGroupCatalog', 'qualifySourceGroupReceipt', 'qualifySourceGroupedImport'], { ReaderRuntimeOwner: Runtime, RulesMutationOwner });
const helpers = { ...production('app/ErrorMessage.ts', ['errorMessageOf']),
  ...production('app/HttpTransportPolicy.ts', ['httpUrlHostname', 'isPrivateNetworkTarget']),
  ...production('features/source/ReaderSourceCategory.ts', ['classifyReaderSource']) };
const { SourceGateway } = production('features/source/SourceGateway.ts', ['SourceGateway'],
  { ReaderRuntimeOwner: Runtime, RulesMutationOwner, isReaderCoreTransactionPendingError, ...gatewayTypes, ...helpers });
const { SourceGroupsOwner } = selectedProductionClasses(new URL('./fixtures/source-workflow/SourceGroupsOwner.ts',import.meta.url), ['SourceGroupsOwner'],
  { ReaderRuntimeOwner: Runtime, SourceGateway, ...gatewayTypes, ...helpers, ...model });
const rawSources = sources.map(item => ({ sourceId: item.sourceId, name: item.name, baseUrl: item.baseUrl, enabled: true, enabledExplore: false,
  bookSource: { bookSourceName: item.name, bookSourceUrl: item.sourceId, bookSourceType: { novel: 0, comic: 2, music: 1, download: 3, external: 4, other: 5 }[item.category] } }));
async function settle(predicate, label) {
  for (let turn = 0; turn < 100; turn += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(`Did not settle: ${label}`);
}
function fixture() {
  const f = { catalog: clone(catalog), rawSources: clone(rawSources), commands: [], reads: [], recoveries: [], publications: [], confirmed: 0,
    original: { generation: 1, busy: false, confirmation: 'undispatched', blocked: false, canRetryOriginal: false, writeStage: 'intent', label: '', method: '', message: '' },
    next: undefined, recovery: undefined };
  f.runtime = { alive: true, supportsCoreCapability: capability => ['source.group.metadata.v1', 'rules.mutation.source-groups.v1'].includes(capability),
    async request(method, params, options = {}) {
      assert.notEqual(options.canDispatch?.(), false); assert.notEqual(options.canContinue?.(), false);
      f.reads.push(method);
      if (method === 'source.list') return { data: { sources: clone(f.rawSources) } };
      if (method === 'source.group.catalog') return { data: clone(f.catalog) };
      assert.fail(`Unexpected read ${method}`);
    } };
  ports.set(f.runtime, {
    snapshot: () => clone(f.original),
    // Only the mutation transport port is controlled. The real gateway still
    // freezes params, qualifies the receipt, and invokes confirmed itself.
    async run(_label, current, operation) {
      assert.equal(current(), true);
      return operation(async (method, params) => {
        f.commands.push({ method, params: clone(params) });
        assert.ok(f.next, 'test must provide an exact RPC fixture');
        if (f.next.gate) await f.next.gate;
        if (f.next.catalog) f.catalog = clone(f.next.catalog);
        if (f.next.error) throw f.next.error;
        return { data: clone(f.next.data) };
      }, () => { f.confirmed += 1; });
    },
    async recoverOriginal(current, qualify, retryOriginal, consumer, _expectedMethod, expectedOperationId, admitsMethod) {
      f.recoveries.push({ retryOriginal, consumer, expectedOperationId });
      assert.equal(current(), true);
      assert.equal(admitsMethod(f.recovery.method), true);
      qualify(f.recovery.method, clone(f.recovery.params), clone(f.recovery.data));
      if (f.recovery.catalog) f.catalog = clone(f.recovery.catalog);
      f.original = { ...f.original, confirmation: 'confirmed', blocked: false, canRetryOriginal: false };
      return clone(f.original);
    },
  });
  installedRuntime = f.runtime;
  f.owner = SourceGroupsOwner.forRuntime(f.runtime);
  f.identity = 'group-presentation';
  f.owner.attachPresentation(f.identity, value => f.publications.push(clone(value)), () => Runtime.isCurrent(f.runtime));
  f.open = async () => { f.owner.open(f.identity); await settle(() => f.owner.current().read === 'ready', 'initial group/source read'); };
  f.dispatch = intent => f.owner.dispatch(intent, f.identity);
  return f;
}

for(const id of selected){
if(id==="invalid-group-identity"){
  const view = presentation.defaultSourceManagementView('deleted');
  const renamed = clone(catalog); renamed.groups.push({ groupId: 'new-id', name: '已删组同名' });
  assert.deepEqual(presentation.filterManagementSources(sources, view, renamed), []);
  assert.equal(view.groupId, 'deleted');
  const before = presentation.defaultSourceManagementView('ga');
  renamed.groups[0].name = '新名称';
  assert.deepEqual(presentation.filterManagementSources(sources, before, renamed).map(item => item.sourceId), ['a', 'b']);
  assert.equal(presentation.sourceManagementGroupName('ga', renamed), '新名称');
}
if(id==="category-membership"){
  const original = clone(sources);
  const view = presentation.patchSourceManagementView(presentation.defaultSourceManagementView(), { kind: 'other-sources' });
  assert.deepEqual(presentation.filterManagementSources(sources, view, catalog).map(item => item.sourceId), ['c', 'd', 'e', 'f']);
  assert.deepEqual(sources, original);
  assert.deepEqual(presentation.filterManagementSources(sources, presentation.defaultSourceManagementView(''), catalog).map(item => item.sourceId), ['d']);
  assert.equal(presentation.sourceManagementFilterCount({ ...view, query: 'kept', groupId: 'ga' }, 'ga'), 1);
}
if(id==="tools-scope-projection"){
 const before=clone(sources);
 let view={...presentation.defaultSourceToolsPresentation(),scope:presentation.defaultSourceManagementView('ga'),scopeMode:'current'};
 assert.deepEqual(presentation.sourceToolsVisibleSources(sources,view,catalog).map(row=>row.sourceId),['a','b']);
 view=presentation.patchSourceToolsPresentation(view,{query:'beta'});
 assert.deepEqual(presentation.sourceToolsVisibleSources(sources,view,catalog).map(row=>row.sourceId),['b']);
 view=presentation.patchSourceToolsPresentation(view,{scopeMode:'all',query:'gamma'});
 assert.deepEqual(presentation.sourceToolsVisibleSources(sources,view,catalog).map(row=>row.sourceId),['c']);
 view=presentation.patchSourceToolsPresentation(view,{scopeMode:'current',query:'',scope:presentation.defaultSourceManagementView('missing')});
 assert.deepEqual(presentation.sourceToolsVisibleSources(sources,view,catalog),[]);
 assert.deepEqual(sources,before,'retained projection does not rewrite source facts');
}
if(id==="delete-plan"){
  const state = { ...model.emptySourceGroupManagement(), catalog, sources, read: 'ready', view: 'delete', groupId: 'ga', targetGroupId: 'gb' };
  assert.deepEqual(model.sourceGroupCommand(state), { action: 'delete', groupId: 'ga', targetGroupId: 'gb', expectedRevision: 17 });
  assert.equal(model.sourceGroupCommand({ ...state, targetGroupId: 'ga' }), undefined);
  assert.equal(model.sourceGroupCommand({ ...state, targetGroupId: 'missing' }), undefined);
  assert.equal(model.sourceGroupCommand({ ...state, groupId: '' }), undefined);
  assert.equal(model.sourceGroupCommand({ ...state, original: { blocked: true } }), undefined);
  assert.equal(model.sourceGroupCommand({ ...state, targetGroupId: '' }).targetGroupId, '');
}
if(id==="group-name"){
  assert.equal(model.sourceGroupNameError(catalog, '😀'.repeat(32)), '');
  assert.match(model.sourceGroupNameError(catalog, '😀'.repeat(33)), /32/);
  assert.match(model.sourceGroupNameError(catalog, '  常用  '), /同名/);
  assert.equal(model.sourceGroupNameError(catalog, ' 常用 ', 'ga'), '');
  for (const name of ['全部分组', '未分组', '   ']) assert.notEqual(model.sourceGroupNameError(catalog, name), '');
}
if(id==="assignment-plan"){
  const ids = ['a', 'a', 'c'];
  const state = { ...model.emptySourceGroupManagement(), catalog, sources, read: 'ready', view: 'assign', sourceIds: ids, targetGroupId: '' };
  assert.deepEqual(model.sourceGroupCommand(state).sourceIds, ['a', 'c']);
  assert.deepEqual(ids, ['a', 'a', 'c']);
  assert.equal(model.sourceGroupCommand({ ...state, sourceIds: ['a', 'unknown'] }), undefined);
}
if(id==="canonical-refresh"){
  const f = fixture(); await f.open();
  assert.deepEqual(f.reads, ['source.list', 'source.group.catalog']);
  assert.equal(f.owner.current().sources.find(item => item.sourceId === 'a').groupId, 'ga');
  const after = clone(catalog); after.revision = 18; after.groups.push({ groupId: 'new-group', name: '新组' });
  f.next = { data: { version: 1, revision: 18, action: 'create', groupId: 'new-group', affectedSourceIds: [] }, catalog: after };
  f.dispatch({ type: 'create' }); f.dispatch({ type: 'name', value: '新组' }); f.dispatch({ type: 'submit' });
  await settle(() => f.owner.current().receipt?.groupId === 'new-group' && f.owner.current().read === 'ready' && f.owner.current().catalog.revision === 18, 'create and canonical refresh');
  assert.equal(f.confirmed, 1);
  assert.equal(f.commands.length, 1);
  assert.equal(f.owner.current().catalog.groups.some(item => item.groupId === 'new-group'), true);
}
if(id==="receipt-scope"){
  const f = fixture(); await f.open();
  f.owner.beginAssignment(['a', 'c'], f.identity);
  await settle(() => f.owner.current().read === 'ready', 'assignment read');
  f.dispatch({ type: 'target', groupId: 'gb' });
  f.next = { data: { version: 1, revision: 18, action: 'assign', groupId: 'gb', affectedSourceIds: ['a'] } };
  f.dispatch({ type: 'submit' });
  await settle(() => f.owner.current().view === 'result' && !f.owner.current().busy, 'rejected receipt');
  assert.equal(f.owner.current().receipt, undefined);
  assert.match(f.owner.current().error, /回执/);
  assert.equal(f.confirmed, 0);
  assert.equal(f.commands.length, 1);
}
if(id==="delete-confirmation"){
  const f = fixture(); await f.open();
  f.dispatch({ type: 'delete', groupId: 'ga' }); f.dispatch({ type: 'target', groupId: 'gb' });
  f.dispatch({ type: 'submit' });
  assert.equal(f.commands.length, 0);
  f.dispatch({ type: 'deleteConfirmed', groupId: 'ga', targetGroupId: '', expectedRevision: 17 });
  f.dispatch({ type: 'deleteConfirmed', groupId: 'ga', targetGroupId: 'gb', expectedRevision: 16 });
  assert.equal(f.commands.length, 0);
  f.next = { data: { version: 1, revision: 18, action: 'delete', groupId: 'ga', affectedSourceIds: ['a', 'b'] } };
  f.dispatch({ type: 'deleteConfirmed', groupId: 'ga', targetGroupId: 'gb', expectedRevision: 17 });
  await settle(() => f.owner.current().receipt?.action === 'delete', 'confirmed delete');
  assert.equal(f.commands.length, 1);
  assert.equal(f.commands[0].params.targetGroupId, 'gb');
}
if(id==="recovery-identity"){
  const f = fixture();
  f.original = { ...f.original, generation: 9, confirmation: 'unknown', blocked: true, operationId: 'exact-operation', method: 'source.group.mutate', message: '等待核对' };
  f.owner.attachPresentation(f.identity, value => f.publications.push(clone(value)), () => Runtime.isCurrent(f.runtime));
  await f.open();
  f.recovery = { method: 'source.group.mutate', params: { action: 'assign', expectedRevision: 17, sourceIds: ['a'], targetGroupId: 'gb' },
    data: { version: 1, revision: 18, action: 'assign', groupId: 'gb', affectedSourceIds: ['a'] } };
  f.dispatch({ type: 'reconcile', generation: 8, continueOriginal: false });
  assert.equal(f.recoveries.length, 0);
  f.dispatch({ type: 'reconcile', generation: 9, continueOriginal: false });
  await settle(() => f.owner.current().receipt?.action === 'assign' && !f.owner.current().busy, 'exact recovered receipt');
  assert.deepEqual(f.recoveries, [{ retryOriginal: false, consumer: 'source-management', expectedOperationId: 'exact-operation' }]);
  assert.deepEqual(f.owner.current().receipt.affectedSourceIds, ['a']);
  assert.equal(f.commands.length, 0, 'reconciliation never replays the UI submit');
}
if(id==="accepted-detach"){
  const f = fixture(); await f.open();
  let release; const gate = new Promise(resolve => { release = resolve; });
  f.next = { gate, data: { version: 1, revision: 18, action: 'create', groupId: 'late', affectedSourceIds: [] } };
  f.dispatch({ type: 'create' }); f.dispatch({ type: 'name', value: '延迟组' }); f.dispatch({ type: 'submit' });
  await settle(() => f.commands.length === 1, 'accepted request');
  const published = f.publications.length;
  f.owner.detachPresentation(f.identity);
  f.dispatch({ type: 'create' });
  release();
  await settle(() => f.owner.current().receipt?.groupId === 'late' && !f.owner.current().busy, 'accepted request survives detach');
  assert.equal(f.publications.length, published);
  assert.equal(f.commands.length, 1);
}
recordContractCasePass(id);
}
}finally{resolution.deregister();}
