import assert from 'node:assert/strict';
import { bookshelfOperationClass } from './lib/bookshelf-operation-owner-probe.mjs';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';
import { classifyReaderSource } from '../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
import { errorMessageOf } from '../entry/src/main/ets/app/ErrorMessage.ts';
import { httpUrlHostname, isPrivateNetworkTarget } from '../entry/src/main/ets/platform/network/HttpTransportPolicy.ts';

const cases = {
  'real-check': { description: 'Host capability negotiation, cancellation, and real check receipts', resources: [] },
  'grouped-import': { description: 'Core catalog revision, valid imports, and exact per-row receipts', resources: [] },
  'clear-reports': { description: 'Durable report-clear receipt and negotiated absence', resources: [] },
};

for (const selected of selectContractCases(cases)) {
  if (selected === 'real-check') await realCheck();
  if (selected === 'grouped-import') await groupedImport();
  if (selected === 'clear-reports') await clearReports();
  recordContractCasePass(selected);
}

function fixture(capabilities, handlers) {
  const commands = [];
  const receipts = [];
  const runtime = {
    supportsCoreCapability: capability => capabilities.includes(capability),
    takeSourceHttpDiagnostics: () => [],
    request(method, params, options) {
      commands.push({ method, params, options });
      assert.ok(handlers[method], method);
      options?.onDispatch?.();
      return Promise.resolve(handlers[method](params));
    },
  };
  const source = bookshelfOperationClass('features/source/application/SourceGateway.ts', 'SourceGateway', {
    ReaderRuntimeOwner: { isCurrent: candidate => candidate === runtime },
    RulesMutationOwner: {
      forRuntime: () => ({
        run: (_label, current, operation) => {
          assert.equal(current(), true);
          return operation(async (method, params) => {
            assert.ok(handlers[method], method);
            receipts.push({ method, params });
            return await handlers[method](params);
          }, () => {});
        },
      }),
    },
    classifyReaderSource, errorMessageOf, httpUrlHostname, isPrivateNetworkTarget,
  });
  return { gateway: new source(runtime), commands, receipts };
}

function checkResult(id, mode, levels, version, budget, failureReason) {
  const traceId = 'real-check-trace';
  const passed = failureReason ? [] : levels;
  const result = {
    sourceId: id, available: failureReason === undefined, levelsPassed: passed, durationMs: 7,
    debugLogs: [{ state: failureReason ? -1 : 1, msg: failureReason ?? '通过', timestampMs: 5 }],
  };
  if (failureReason) result.failureReason = failureReason;
  if (version !== undefined) result.report = {
    version, traceId, mode, inputDigest: 'a'.repeat(64), ruleDigest: failureReason ? undefined : 'b'.repeat(64),
    executionOptions: { timeoutMs: budget }, executionOptionsDigest: 'c'.repeat(64),
    steps: ['L1', 'L2', 'L3', 'L4', 'L5'].map((level, index) => ({
      level, requested: levels.includes(level), executed: failureReason ? index === 0 : levels.includes(level),
      status: failureReason ? (index === 0 ? 'fail' : levels.includes(level) ? 'blocked' : 'not_requested') :
        levels.includes(level) ? 'pass' : 'not_requested',
      durationMs: 0,
    })),
  };
  return { requestId: 71, data: { traceId, results: [result] } };
}

async function realCheck() {
  const id = 'https://novel.test';
  const levels = ['L1', 'L2'];
  const handlers = {
    'source.check.run': p => checkResult(p.sourceIds[0], p.mode, p.levels, p.reportVersion, p.timeoutMs),
    'source.check.ephemeral.run': p => checkResult(
      'ephemeral:1', p.mode, p.levels, p.reportVersion, p.timeoutMs, 'L1: invalid or missing bookSourceUrl'),
  };
  const modern = fixture(['source.check.mode.v1', 'source.check.report.v2', 'source.check.keyword_override.v1',
    'source.check.ephemeral.v1'], handlers);
  let active = true;
  const stages = [];
  const recordStage = stage => stages.push(stage);
  assert.equal((await modern.gateway.checkSource(id, () => active, ' 斗破 ', 'search', levels, 1200, recordStage)).available, true);
  assert.deepEqual(stages, ['L1']);
  modern.commands[0].options.onSourceCheckStage('L2');
  assert.equal(modern.commands[0].params.keyword, '斗破');
  assert.equal(modern.commands[0].params.keywordOverride, true);
  active = false;
  modern.commands[0].options.onSourceCheckStage('L3');
  assert.deepEqual(stages, ['L1', 'L2']);
  assert.equal(modern.commands[0].options.shouldCancel(), true);
  assert.equal(modern.commands[0].options.canContinue(), false);
  await modern.gateway.checkSource(id, () => true, '  ', 'search', levels, 1200);
  assert.equal(modern.commands[1].params.keywordOverride, false);
  assert.equal(Object.hasOwn(modern.commands[1].params, 'keyword'), false);
  await modern.gateway.checkSource(id, () => true, '海贼', 'explore', levels, 1200);
  assert.equal(Object.hasOwn(modern.commands[2].params, 'keyword'), false);
  assert.deepEqual((await modern.gateway.checkEphemeralSources([{}], () => true, '斗破', 'search',
    levels, 1200, recordStage))[0].levelsPassed, []);
  assert.deepEqual(stages, ['L1', 'L2', 'L1']);
  assert.equal(modern.commands[3].params.reportVersion, 2);
  assert.equal(modern.commands[3].params.keywordOverride, true);
  assert.equal(modern.commands[3].options.shouldCancel(), false);
  const malformedUrl = 'https://bad host.test';
  const malformed = (await modern.gateway.checkEphemeralSources([{ bookSourceUrl: malformedUrl }]))[0];
  assert.equal(malformed.sourceId, 'ephemeral:1');
  assert.equal(malformed.failureReason, 'L1: invalid or missing bookSourceUrl');
  const ambiguous = fixture(['source.check.ephemeral.v1'], {
    'source.check.ephemeral.run': p => checkResult('ephemeral:1', p.mode, p.levels, p.reportVersion, p.timeoutMs),
  });
  await assert.rejects(ambiguous.gateway.checkEphemeralSources([{ bookSourceUrl: malformedUrl }]), /书源身份/);
  await assert.rejects(ambiguous.gateway.checkEphemeralSources([{}]), /书源身份/);
  const legacy = fixture(['source.check.mode.v1'], handlers);
  await legacy.gateway.checkSource(id, () => true, '我的');
  assert.equal(legacy.commands[0].params.keyword, '我的');
  assert.equal(Object.hasOwn(legacy.commands[0].params, 'keywordOverride'), false);
  await assert.rejects(legacy.gateway.checkEphemeralSources([{ bookSourceUrl: id }]), /不支持/);
  assert.equal(legacy.commands.length, 1);
}

async function groupedImport() {
  const before = 'https://before.test';
  const added = 'https://added.test';
  const rejected = 'https://rejected.test';
  const catalog = { version: 1, revision: 12, groups: [{ groupId: 'g', name: '已有分组' }],
    memberships: [{ sourceId: before, groupId: 'g', locallyAssigned: false }] };
  const f = fixture(['source.group.metadata.v1', 'rules.mutation.source-groups.v1'], {
    'source.group.catalog': () => ({ data: catalog }),
    'source.import.grouped': p => {
      assert.equal(p.expectedRevision, 12);
      assert.equal(p.strategy, 'fill');
      assert.equal(p.targetGroupId, 'g');
      assert.deepEqual(p.items.map(row => row.sourceId), [before, added, rejected]);
      return { data: { version: 1, revision: 13, importedCount: 2, failedCount: 1, results: [
        { index: 0, sourceId: before, status: 'imported', name: '旧书源', groupId: 'g', locallyAssigned: false },
        { index: 1, sourceId: added, status: 'imported', name: '新书源', groupId: 'g', locallyAssigned: true },
        { index: 2, sourceId: rejected, status: 'failed', error: 'Core 拒绝' },
      ] } };
    },
    'source.group.mutate': p => {
      assert.equal(p.targetGroupId, '', 'deleting a populated group assigns its members to ungrouped');
      return { data: { version: 1, revision: 13, action: 'delete', groupId: 'g', affectedSourceIds: [before] } };
    },
  });
  const preview = f.gateway.prepareGroupedSourceDocument(JSON.stringify([
    { bookSourceName: '旧书源', bookSourceUrl: before },
    { bookSourceName: '有声示例', bookSourceUrl: 'https://listen.test', bookSourceType: 1 },
    { bookSourceName: '新书源', bookSourceUrl: added },
    { bookSourceName: '失败例', bookSourceUrl: rejected },
  ]));
  assert.equal(preview.filteredUnsupportedCount, 1);
  assert.equal(preview.items[1].supported, false);
  const outcome = await f.gateway.importGroupedSources(preview.items, 12, 'fill', { groupId: 'g' });
  assert.deepEqual([outcome.addedCount, outcome.updatedCount, outcome.failedCount], [1, 1, 1]);
  assert.deepEqual(outcome.failures, [{ index: 3, sourceId: rejected, message: 'Core 拒绝' }]);
  await assert.rejects(f.gateway.importGroupedSources(preview.items, 11, 'preserve'), /分组/);
  assert.equal(f.receipts.length, 1);
  const removed = await f.gateway.mutateSourceGroup({ expectedRevision: 12, action: 'delete', groupId: 'g' });
  assert.deepEqual(removed.affectedSourceIds, [before]);
}

async function clearReports() {
  const id = 'https://novel.test';
  const old = fixture([], {});
  assert.equal((await old.gateway.clearSourceCheckReports([id])).supported, false);
  assert.equal(old.commands.length, 0);
  const current = fixture(['source.check.report.clear.v1'], {
    'source.check.report.clear': p => {
      assert.deepEqual(p.sourceIds, [id]);
      return { data: { sourceIds: [id], clearedCount: 3 } };
    },
  });
  assert.deepEqual(await current.gateway.clearSourceCheckReports([id]), { supported: true, sourceIds: [id], clearedCount: 3 });
}
