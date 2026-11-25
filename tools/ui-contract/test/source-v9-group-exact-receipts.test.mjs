import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { actualSourceManagementTypes } from '../../lib/source-management-owner-probe.mjs';
import { fixture } from '../../lib/source-management-durable-probe.mjs';
import { cleanupDurableFixtures } from '../../lib/rules-mutation-durable-probe.mjs';
import { SourceInitialMembershipUnconfirmed } from '../../../entry/src/main/ets/features/source/application/SourceInitialMembershipUnconfirmed.ts';

const sourceId = 'https://group-recovery.example/';
const groupName = '回执恢复组';

after(async () => { await cleanupDurableFixtures(); });

async function openedSourceManagement() {
  const core = await fixture();
  await core.command('source.import', { sourceId, bookSource: {
    bookSourceUrl: sourceId, bookSourceName: '回执测试书源', bookSourceType: 0,
  } });
  const { SourceHost } = actualSourceManagementTypes({
    SourceInitialMembershipUnconfirmed, ReaderRuntimeOwner: core.Runtime, RulesMutationOwner: core.Owner,
    hilog: { info() {}, warn() {}, error() {} },
  });
  const host = new SourceHost(() => {}, () => {}, () => {});
  const identity = 'source-v9-group-recovery';
  assert.equal(host.bindPresentation(core.runtime, identity, core.current), true);
  host.open(identity);
  await host.orchestrator.operationChain;
  const { revision } = await host.loadGroups(identity);
  core.calls.length = 0;
  return { core, host, identity, revision };
}

function loseGroupReceipt(core, action, fault) {
  const request = core.runtime.request.bind(core.runtime);
  core.runtime.request = async (method, params, options) => {
    if (method === 'rules.mutation.apply' && params.mutation.method === 'source.group.mutate' &&
      params.mutation.params.action === action) {
      core.options[fault === 'missing' ? 'beforeMethod' : 'afterMethod'] = method;
    }
    const event = await request(method, params, options);
    if (fault !== 'wrong ID' || method !== 'rules.mutation.query' || params.operationId === undefined) return event;
    assert.ok(event.data.receipt, 'the wrong ID test must replace an actual Core receipt');
    return { ...event, data: { ...event.data, receipt: { ...event.data.receipt,
      binding: { ...event.data.receipt.binding, operationId: 'foreign-operation' },
    } } };
  };
}

function groupWritesAndExactQueries(core) {
  return core.calls.filter(({ method, params }) =>
    method === 'rules.mutation.apply' || (method === 'rules.mutation.query' && params.operationId !== undefined));
}

function assertExactQuery(query, write) {
  assert.equal(query.method, 'rules.mutation.query');
  assert.deepEqual(query.params, { operationId: write.params.operationId, expected: write.params });
  assert.notEqual(query.options.canDispatch, undefined);
}

for (const action of ['create', 'assign']) {
  test(`lost ${action} ACK queries the exact receipt and reads committed group membership`, async () => {
    const { core, host, identity, revision } = await openedSourceManagement();
    loseGroupReceipt(core, action, 'exact');

    const catalog = await host.mutateGroup({ action: 'create', expectedRevision: revision,
      name: groupName, sourceIds: [sourceId] }, identity);

    const trace = groupWritesAndExactQueries(core);
    const [create, assign] = core.writes();
    const queryIndex = action === 'create' ? 1 : 2;
    assert.equal(trace.length, 3);
    assert.equal(trace[0], create);
    assert.equal(trace[action === 'create' ? 2 : 1], assign);
    assertExactQuery(trace[queryIndex], action === 'create' ? create : assign);
    assert.deepEqual(create.params.mutation.params, { expectedRevision: revision, action: 'create', name: groupName });
    const [group] = catalog.groups;
    assert.equal(group.name, groupName);
    assert.deepEqual(assign.params.mutation.params, { expectedRevision: revision + 1, action: 'assign',
      targetGroupId: group.groupId, sourceIds: [sourceId] });
    assert.deepEqual(catalog.memberships, [{ sourceId, groupId: group.groupId, locallyAssigned: true }]);
    assert.equal(catalog.revision, revision + 2);
    assert.equal(core.disk(), '');
  });
}

for (const fault of ['missing', 'wrong ID']) {
  test(`${fault} create receipt keeps the original blocked and dispatches no assignment or replay`, async () => {
    const { core, host, identity, revision } = await openedSourceManagement();
    loseGroupReceipt(core, 'create', fault);

    const create = { action: 'create', expectedRevision: revision, name: groupName, sourceIds: [sourceId] };
    await assert.rejects(host.mutateGroup(create, identity));
    await assert.rejects(host.mutateGroup(create, identity), /书源操作暂不可用/);

    const [write, query] = groupWritesAndExactQueries(core);
    assert.equal(groupWritesAndExactQueries(core).length, 2);
    assertExactQuery(query, write);
    assert.equal(core.owner.snapshot().blocked, true);
    assert.equal(JSON.parse(core.disk()).operationId, write.params.operationId);
    const catalog = await host.loadGroups(identity);
    assert.equal(catalog.groups.length, fault === 'wrong ID' ? 1 : 0);
    assert.deepEqual(catalog.memberships, [{ sourceId, groupId: '', locallyAssigned: false }]);
  });
}

test('lost ACK on creating an empty group confirms the original create without dispatching assign', async () => {
  const { core, host, identity, revision } = await openedSourceManagement();
  loseGroupReceipt(core, 'create', 'exact');

  const catalog = await host.mutateGroup({ action: 'create', expectedRevision: revision, name: groupName }, identity);

  const trace = groupWritesAndExactQueries(core);
  assert.equal(trace.length, 2);
  assertExactQuery(trace[1], trace[0]);
  assert.equal(catalog.groups.length, 1);
  assert.equal(catalog.groups[0].name, groupName);
  assert.deepEqual(catalog.memberships, [{ sourceId, groupId: '', locallyAssigned: false }]);
  assert.equal(core.disk(), '');
});

test('missing assign ACK preserves the pending membership write and identifies the confirmed group', async () => {
  const { core, host, identity, revision } = await openedSourceManagement();
  loseGroupReceipt(core, 'assign', 'missing');

  let confirmedGroupId;
  await assert.rejects(host.mutateGroup({ action: 'create', expectedRevision: revision,
    name: groupName, sourceIds: [sourceId] }, identity), error => {
    assert.ok(error instanceof SourceInitialMembershipUnconfirmed);
    confirmedGroupId = error.groupId;
    return true;
  });

  const trace = groupWritesAndExactQueries(core);
  assert.equal(trace.length, 3);
  assertExactQuery(trace[2], trace[1]);
  assert.equal(core.owner.snapshot().blocked, true);
  assert.equal(JSON.parse(core.disk()).operationId, trace[1].params.operationId);
  const catalog = await host.loadGroups(identity);
  assert.deepEqual(catalog.groups, [{ groupId: confirmedGroupId, name: groupName }]);
  assert.deepEqual(catalog.memberships, [{ sourceId, groupId: '', locallyAssigned: false }]);
});
