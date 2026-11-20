import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({ 'assign-live-without-membership': { description: 'Live source identity, unknown membership, retained Page counts and current owner/receipt admission; fake gateways only', resources: [] } });
for (const id of selected) {
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { selectedProductionClasses, selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
function production(file, names, dependencies = {}) {
  return pureModuleProbe(readFileSync(new URL(file.startsWith('./') ? file : `../entry/src/main/ets/${file}`, import.meta.url), 'utf8'), file.split('/').at(-1), dependencies, names);
}
const types = production('features/source/SourceGroupTypes.ts', ['EMPTY_SOURCE_GROUP_CATALOG']);
const model = production('features/source/SourceGroupManagementModel.ts', ['emptySourceGroupManagement', 'sourceGroupCommand', 'sourceGroupName', 'sourceGroupNameError', 'sourceGroupMemberIds'], types);
const presentation = production('features/source/SourceManagementPresentation.ts', ['filterManagementSources', 'defaultSourceManagementView', 'sourceManagementGroupId', 'sourceManagementGroupName']);
const sources = [{ sourceId: 'live', name: 'Live source', baseUrl: 'https://live.invalid', category: 'novel', enabled: true, checkState: 'unchecked' }];
const catalog = { version: 1, revision: 12, groups: [], memberships: [] };
const state = { ...model.emptySourceGroupManagement(), sources, catalog, read: 'ready', view: 'assign', sourceIds: ['live', 'live'], targetGroupId: '' };
const frozen = structuredClone(state);
assert.deepEqual(model.sourceGroupCommand(state), { expectedRevision: 12, action: 'assign', sourceIds: ['live'], targetGroupId: '' });
assert.deepEqual(state, frozen, 'forming an explicit command does not invent membership or mutate selection');
assert.deepEqual(presentation.filterManagementSources(sources, presentation.defaultSourceManagementView(''), catalog), [], 'unknown group remains distinct from explicit ungrouped');
for (const patch of [{ sourceIds: [] }, { sourceIds: ['ghost'] }, { sourceIds: ['live', 'ghost'] }, { sources: [] },
  { busy: true }, { read: 'loading' }, { original: { blocked: true } }, { targetGroupId: 'deleted' }]) {
  assert.equal(model.sourceGroupCommand({ ...state, ...patch }), undefined);
}
const grouped = { ...catalog, groups: [{ groupId: 'target', name: 'Target' }] };
assert.deepEqual(model.sourceGroupCommand({ ...state, catalog: grouped, view: 'addMembers', targetGroupId: 'target' }),
  { expectedRevision: 12, action: 'assign', sourceIds: ['live'], targetGroupId: 'target' });

// Execute the actual Page's non-UI methods, including both checkbox admission
// and footer validation. Extracted methods keep their complete production body.
const pageFile = new URL('./fixtures/source-workflow/SourceGroupManagementPage.ets', import.meta.url);
const { SourceGroupDisplayRow } = selectedProductionClasses(pageFile, ['SourceGroupDisplayRow']);
const pageMethods = ['busy', 'blocked', 'writable', 'groupExists', 'sourceKnown', 'projectRows', 'blockingReason'];
const PageProbe = selectedProductionMethods(pageFile, 'SourceGroupManagementPage', pageMethods, { ...model, ...presentation, SourceGroupDisplayRow });
function verifyRetainedPage(PageProbe) {
const probe = Object.assign(new PageProbe(), { mounted: true, snapshot: state, rows: { replace: rows => { probe.projectedRows = rows; } } });
assert.equal(probe.sourceKnown('live'), true);
assert.equal(probe.sourceKnown('ghost'), false);
assert.equal(probe.writable(), true);
assert.equal(probe.blockingReason(), '', 'Page allows submit without catalog membership');
probe.snapshot = { ...state, catalog: grouped, view: 'addMembers', targetGroupId: 'target' };
assert.equal(probe.blockingReason(), '');
probe.projectRows();
assert.deepEqual(probe.projectedRows.map(row => row.id), ['live'], 'picker is projected from actual live sources');
assert.match(probe.projectedRows[0].detail, /分组待确认/, 'missing membership is never displayed as ungrouped');
probe.snapshot = { ...probe.snapshot, sourceIds: ['ghost'] };
assert.notEqual(probe.blockingReason(), '');
const orphanCatalog = { ...grouped, memberships: [
  { sourceId: 'live', groupId: 'target', locallyAssigned: true },
  { sourceId: 'deleted', groupId: 'target', locallyAssigned: true },
  { sourceId: 'deleted-ungrouped', groupId: '', locallyAssigned: true }
] };
const originalCatalog = structuredClone(orphanCatalog);
assert.deepEqual(model.sourceGroupMemberIds(orphanCatalog, 'target'), ['live', 'deleted'], 'business default retains orphan facts');
assert.deepEqual(model.sourceGroupMemberIds(orphanCatalog, 'target', sources), ['live']);
probe.snapshot = { ...state, catalog: orphanCatalog, view: 'directory' };
probe.projectRows();
assert.equal(probe.projectedRows.find(row => row.id === 'target').count, 1);
assert.equal(probe.projectedRows.find(row => row.id === '').count, 0);
assert.deepEqual(orphanCatalog, originalCatalog, 'Page projection never deletes catalog facts');

}
verifyRetainedPage(PageProbe);

const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { ts, options } = installedEtsCompiler();
const pageSource = readFileSync(pageFile, 'utf8');
const tree = ts.createSourceFile('RetainedSourceGroups.ets', pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.deepEqual(tree.parseDiagnostics, []);
const pageOwner = tree.statements.find(node => node.name?.text === 'SourceGroupManagementPage');
const known = pageOwner.members.find(node => node.name?.text === 'sourceKnown');
const oldKnown = pageSource.slice(0, known.body.getStart(tree)) + '{ return this.snapshot.catalog.memberships.some(member => member.sourceId === sourceId); }' + pageSource.slice(known.body.end);
const counts = [];
const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(tree) === 'sourceGroupMemberIds' && node.arguments.length === 3) counts.push(node); ts.forEachChild(node, visit); };
visit(pageOwner.members.find(node => node.name?.text === 'projectRows')); assert.equal(counts.length, 2);
let orphanCounts = pageSource;
for (const call of counts.sort((a, b) => b.pos - a.pos)) orphanCounts = orphanCounts.slice(0, call.getStart(tree)) + 'sourceGroupMemberIds(' + call.arguments.slice(0, 2).map(arg => arg.getText(tree)).join(', ') + ')' + orphanCounts.slice(call.end);
const temp = mkdtempSync(join(tmpdir(), 'reader-retained-group-page-'));
try {
  const load = source => { const file = join(temp, 'SourceGroupManagementPage.ets'); writeFileSync(file, source); return selectedProductionMethods(file, 'SourceGroupManagementPage', pageMethods, { ...model, ...presentation, SourceGroupDisplayRow }); };
  verifyRetainedPage(load(pageSource.replace('private sourceKnown(', 'private /* equivalent formatting */ sourceKnown(')));
  assert.throws(() => verifyRetainedPage(load(oldKnown)), assert.AssertionError, 'old membership-only identity fails for a live source');
  assert.throws(() => verifyRetainedPage(load(orphanCounts)), assert.AssertionError, 'old orphan-inclusive display counts fail without deleting catalog facts');
} finally { rmSync(temp, { recursive: true, force: true }); }

const Runtime = { isCurrent: runtime => runtime.alive };
class SourceGateway {
  constructor(runtime) { this.runtime = runtime; }
  async loadSources(_query, _includeDisabled, current) { assert.equal(current(), true); return structuredClone(sources); }
}
class SourceGroupGateway {
  constructor(runtime) { this.runtime = runtime; }
  static catalogSnapshot(runtime) { return runtime.catalog; }
  snapshot() { return { blocked: false }; }
  async loadCatalog(current) { assert.equal(current(), true); return this.runtime.catalog; }
  async mutate(command, _label, current) {
    assert.equal(current(), true); this.runtime.commands.push(structuredClone(command));
    return { version: 1, revision: 13, action: 'assign', groupId: command.targetGroupId, affectedSourceIds: ['live'] };
  }
}
const { SourceGroupsOwner } = production('./fixtures/source-workflow/SourceGroupsOwner.ts', ['SourceGroupsOwner'],
  { ReaderRuntimeOwner: Runtime, SourceGateway, SourceGroupGateway, errorMessageOf: String, ...model });
async function settle(predicate) {
  for (let turn = 0; turn < 100; turn += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('owner did not settle within 100 immediate turns');
}
for (const mode of ['assign', 'addMembers']) {
  const runtime = { alive: true, catalog: mode === 'assign' ? catalog : grouped, commands: [] };
  const owner = SourceGroupsOwner.forRuntime(runtime), identity = `current-${mode}`;
  owner.attachPresentation(identity, () => {}, () => runtime.alive);
  owner.open(identity); await settle(() => owner.current().read === 'ready');
  if (mode === 'assign') {
    owner.beginAssignment(['live', 'live'], identity);
    await settle(() => owner.current().read === 'ready');
  } else {
    owner.dispatch({ type: 'addMembers', groupId: 'target' }, identity);
    owner.dispatch({ type: 'toggleSource', sourceId: 'ghost' }, identity);
    assert.deepEqual(owner.current().sourceIds, [], 'owner admits only current source-list selections');
    owner.dispatch({ type: 'toggleSource', sourceId: 'live' }, identity);
  }
  owner.dispatch({ type: 'submit' }, 'stale-identity');
  assert.equal(runtime.commands.length, 0);
  owner.dispatch({ type: 'submit' }, identity);
  await settle(() => owner.current().receipt !== undefined && !owner.current().busy);
  assert.deepEqual(runtime.commands, [{ expectedRevision: 12, action: 'assign', sourceIds: ['live'], targetGroupId: mode === 'assign' ? '' : 'target' }]);
  assert.deepEqual(runtime.catalog.memberships, [], 'Host dispatch never fabricates membership facts');
  owner.detachPresentation(identity);
  owner.dispatch({ type: 'submit' }, identity);
  assert.equal(runtime.commands.length, 1);
}
console.log('PASS actual model/owner and retained Page methods; current mounted UI/Core/render/device NOT_RUN');
recordContractCasePass(id);
}

