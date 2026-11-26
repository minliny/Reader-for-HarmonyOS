import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectSourceManagementV9,
  projectSourceV9Check,
  sourceV9AuthenticationDenied,
  sourceV9CheckStepText,
  sourceV9DiagnosticTone,
  sourceV9ReportFill,
  sourceV9ReportTone,
  sourceV9ParentView,
  sourceV9GroupRows,
} from '../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';
import { recordSourceV9Check, runSourceV9Checks } from '../entry/src/main/ets/features/source/presentation/SourceV9CheckRun.ts';

const source = (id, options = {}) => ({
  sourceId: id, name: id, baseUrl: 'https://sources.example/' + id,
  enabled: true, enabledExplore: false, category: 'novel', ...options,
});
const history = (status, level = 'L2', stale = false) => [{
  stale, checkedAtMs: 1,
  report: { version: 2, mode: 'search', traceId: 'real-check', inputDigest: 'digest',
    steps: [{ level, status, durationMs: 9, executed: true, requested: true }] },
}];

test('status counts share the search, membership and supported type scope', () => {
  const rows = [
    source('松针小说', { group: '甲', checkReports: history('fail') }),
    source('松针漫画', { group: '甲', category: 'comic', enabled: false, checkReports: history('pass') }),
    source('松针旧记录', { group: '甲', category: 'music', checkReports: history('fail') }),
    source('松针小说二', { group: '乙', checkReports: history('fail') }),
    source('其他小说', { group: '甲', checkReports: history('fail') }),
    source('松针过期报告', { group: '甲', checkReports: history('fail', 'L5', true) }),
    source('松针传输异常', { group: '甲', checkState: 'failed' }),
  ];
  assert.deepEqual(projectSourceManagementV9(rows, { keyword: '松针', group: '甲', category: 'all',
    status: '异常' }), { rows: [rows[0]], counts: { all: 4, enabled: 3, disabled: 1, abnormal: 1 } });
  assert.deepEqual(projectSourceManagementV9(rows, { keyword: '松针', group: '甲', category: 'comic',
    status: '已停用' }), { rows: [rows[1]], counts: { all: 1, enabled: 0, disabled: 1, abnormal: 0 } });
});

test('detection paint uses the most recent current report and actual failed stage', () => {
  assert.equal(sourceV9ReportTone(source('unverified', { checkState: 'failed' })), 'unverified');
  assert.equal(sourceV9ReportTone(source('failed', { checkReports: history('fail', 'L3') })), 'earlyFailure');
  assert.equal(sourceV9ReportTone(source('late failure', { checkReports: history('not_supported', 'L5') })), 'deepFailure');
  assert.equal(sourceV9ReportTone(source('directory', { checkReports: history('pass', 'L4') })), 'partial');
  assert.equal(sourceV9ReportTone(source('body', { checkReports: history('pass', 'L5') })), 'content');
  for (const [tone, day, night] of [
    ['content', '#247551', '#3FA374'], ['partial', '#7C9C35', '#98BA52'],
    ['deepFailure', '#C97A22', '#E09F46'], ['earlyFailure', '#C24136', '#E0655B'],
  ]) {
    assert.equal(sourceV9ReportFill(tone, 'day'), day);
    assert.equal(sourceV9ReportFill(tone, 'night'), night);
  }
});

test('internal back keeps group detail under its overview', () => {
  assert.equal(sourceV9ParentView('group-detail'), 'groups');
  for (const view of ['import', 'subscriptions', 'groups']) assert.equal(sourceV9ParentView(view), 'list');
  assert.equal(sourceV9ParentView('list'), undefined);
});

test('local group mutations replace the imported group and preserve unsupported library rows', () => {
  const rows = [source('moved', { group: '旧组' }), source('ungrouped', { group: '旧组' }),
    source('historical', { category: 'music', group: '旧组' })];
  const catalog = { version: 1, revision: 3, groups: [{ groupId: 'target', name: '新组' }],
    memberships: [{ sourceId: 'moved', groupId: 'target', locallyAssigned: true },
      { sourceId: 'ungrouped', groupId: '', locallyAssigned: true }] };
  const projected = sourceV9GroupRows(rows, catalog);
  assert.deepEqual(projected.map(row => row.group), ['新组', '', '']);
  assert.equal(rows[1].group, '旧组');
  assert.deepEqual(projectSourceManagementV9(projected, { keyword: '', group: '', status: '全部',
    category: 'all' }).rows.map(row => row.sourceId), ['ungrouped']);
});

test('stop retires in-flight work, preserves completed rows and does not start queued work', async () => {
  const sources = ['first', 'in-flight', 'queued'].map(id => source(id));
  const visited = [], finished = [];
  let live = true;
  let finishPending;
  let entered;
  const pending = new Promise(resolve => { finishPending = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const work = runSourceV9Checks(sources, () => live, async row => {
    visited.push(row.sourceId);
    if (row.sourceId === 'in-flight') {
      entered();
      await pending;
    }
    return { source: row, outcome: { traceId: row.sourceId } };
  }, item => finished.push(item.source.sourceId));
  await started;
  live = false;
  finishPending();
  await work;
  assert.deepEqual(visited, ['first', 'in-flight']);
  assert.deepEqual(finished, ['first']);
});

test('drilldown replaces the exact parent row only with a real new outcome', () => {
  const first = { source: source('first'), outcome: { traceId: 'original' } };
  const other = { source: source('second'), outcome: { traceId: 'unchanged' } };
  const rows = [first, other];
  assert.equal(recordSourceV9Check(rows, { source: first.source, error: 'cancelled' }), rows);
  const retested = { source: first.source, outcome: { traceId: 'retest' } };
  const updated = recordSourceV9Check(rows, retested);
  assert.deepEqual(updated, [retested, other]);
  assert.equal(rows[0], first);
});

test('leaving a drilled report restores the stopped batch and its own check options', async () => {
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const content = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceV9CheckDialog.ets', import.meta.url), 'utf8');
  const { owner } = createReaderBuilderProbe(content, [
    'batchRows', 'close', 'stop', 'consumeBack', 'singleSource',
    'report', 'outcome', 'restoreOptions', 'progress', 'progressLabel', 'batchProgressCounts', 'checkTotal',
  ], { readerAppColor: role => role, sourceV9LatestReport: () => undefined, sourceV9DiagnosticTone, sourceV9ReportFill,
    READER_FONT_NOTO_SANS_SC_UI_REGULAR: 'ReaderNotoSansSCUIRegular' },
  { componentName: 'SourceV9CheckDialog', allowEmptyBranchAdmission: true });
  const first = source('首条书源');
  const pending = source('未检测书源');
  const parentRows = [{ source: first, outcome: { available: true,
    report: { mode: 'search', steps: [{ level: 'L4', requested: true }] } } }];
  Object.assign(owner, {
    scheme: 'day', sources: [first, pending], rows: parentRows,
    mounted: true, inputEnabled: true, batch: true, drillId: '', running: false,
    stopped: true, completed: 1, mode: 'explore', depth: 'L5', keyword: '保留批量词', runError: '',
  });
  owner.batchRows();
  const reportButton = [...owner.nodes.values()].find(node => node.type === 'Button');
  assert.ok(reportButton?.onClick);
  reportButton.onClick();
  assert.equal(owner.drillId, first.sourceId);
  assert.deepEqual([owner.mode, owner.depth, owner.keyword], ['search', 'L4', '']);
  owner.keyword = '只用于单源';
  assert.equal(owner.consumeBack(), true);
  assert.equal(owner.drillId, '');
  assert.equal(owner.stopped, true);
  assert.equal(owner.completed, 1);
  assert.deepEqual([owner.mode, owner.depth, owner.keyword], ['explore', 'L5', '保留批量词']);
  assert.deepEqual(owner.rows, parentRows);
  owner.progress();
  const text = [...owner.nodes.values()].filter(node => node.type === 'Text').map(node => node.create);
  assert.ok(text.includes('已停止检测 · 1/2'));
  assert.ok(text.includes('通过 1 · 失败 0'));

  // Replay only the SDK's ForEach observer so a stable source-only key would
  // retain its old content. Drill back into the replacement to check admission.
  const observer = [...owner.keys.keys()].find(Number.isInteger);
  assert.ok(Number.isInteger(observer));
  const before = owner.nodes.size;
  const retested = { source: first, error: '新的错误摘要', outcome: { available: false, traceId: 'new-trace',
    durationMs: 120, report: { traceId: 'new-report', mode: 'explore',
      steps: [{ level: 'L4', status: 'fail', requested: true, executed: true }] } } };
  owner.rows = recordSourceV9Check(parentRows, retested);
  owner.replayOnly([observer]);
  const replacement = [...owner.nodes.values()].slice(before);
  assert.ok(replacement.some(node => node.type === 'Text' && node.create === '未通过'));
  assert.ok(replacement.some(node => node.type === 'Row' && node.width === 8 && node.backgroundColor === sourceV9ReportFill('deepFailure', 'day')));
  const retestButton = replacement.find(node => node.type === 'Button');
  assert.equal(retestButton.border.width.bottom, 0);
  retestButton.onClick();
  assert.equal(owner.runError, '新的错误摘要');
  assert.equal(owner.mode, 'explore');
});

test('batch and group disable send every supported member through the actual cookie cleanup path', async () => {
  const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
  const members = ['https://a.test', 'https://b.test', 'https://audio.test'];
  const rows = members.map((id, index) => ({ sourceId: id, baseUrl: id, name: id, enabled: true,
    bookSource: { bookSourceType: index === 2 ? 1 : 0 } }));
  const calls = [];
  const runtime = {
    supportsCoreCapability: () => false,
    async request(method, params, options) {
      if (method === 'source.list') return { data: { sources: structuredClone(rows) } };
      assert.equal(method, 'source.update');
      assert.equal(params.enabled, false);
      options?.onDispatch?.();
      const row = rows.find(item => item.sourceId === params.sourceId);
      row.enabled = false;
      calls.push(['disable', row.sourceId]);
      return { data: { source: row } };
    },
    async clearSourceCookieSession(id) { calls.push(['clear', id]); },
  };
  const { SourceHost } = actualSourceManagementTypes({ ReaderRuntimeOwner: { isCurrent: value => value === runtime },
    hilog: { info() {}, warn() {}, error() {} } });
  const host = new SourceHost(() => {}, () => {}, () => {});
  assert.equal(host.bindPresentation(runtime, 'v9-batch', () => true), true);
  host.open('v9-batch');
  await host.orchestrator.operationChain;
  host.toggleSources([...members, members[0]], false, 'v9-batch');
  await host.orchestrator.operationChain;
  assert.deepEqual(calls, [['disable', members[0]], ['clear', members[0]],
    ['disable', members[1]], ['clear', members[1]]]);
  assert.equal(rows[2].enabled, true);
});

test('stopping a check admits an immediate same-source retest and discards the retired result', async () => {
  const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
  const id = 'https://retest.example/';
  const row = { sourceId: id, baseUrl: id, name: '同一书源', enabled: true, enabledExplore: false,
    bookSource: { bookSourceType: 0, bookSourceUrl: id, bookSourceName: '同一书源' } };
  const result = (requestId, available) => ({
    requestId, data: { traceId: `source.check.run:${requestId}:1`, results: [{
      sourceId: id, available, levelsPassed: available ? ['L1', 'L2'] : ['L1'], durationMs: 1,
      ...(available ? {} : { failureReason: 'L2: 旧会话失败' }),
      debugLogs: [{ state: available ? 0 : -1, msg: 'Core result', timestampMs: 1 }],
    }] },
  });
  let notifyStarted, finishFirst;
  const firstStarted = new Promise(resolve => { notifyStarted = resolve; });
  const firstResult = new Promise(resolve => { finishFirst = resolve; });
  const attempts = [];
  const runtime = {
    supportsCoreCapability: capability => capability === 'source.check.mode.v1' ||
      capability === 'source.check.keyword-override.v1',
    takeSourceHttpDiagnostics: () => [],
    async request(method, params, options) {
      if (method === 'source.list') return { data: { sources: [row] } };
      assert.equal(method, 'source.check.run');
      attempts.push({ options, params });
      if (attempts.length === 1) {
        notifyStarted();
        return firstResult;
      }
      return result(12, true);
    },
  };
  const { SourceHost } = actualSourceManagementTypes({ ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
    hilog: { info() {}, warn() {}, error() {} } });
  const projections = [];
  const host = new SourceHost(rows => projections.push(rows[0]), () => {}, () => {});
  assert.equal(host.bindPresentation(runtime, 'same-source-retest', () => true), true);
  host.open('same-source-retest');
  await host.orchestrator.operationChain;

  let firstActive = true;
  const observedStages = [];
  const options = { mode: 'search', levels: ['L1', 'L2'], keyword: '' };
  const first = host.runSourceCheck(id, options, () => firstActive,
    stage => observedStages.push(stage), 'same-source-retest');
  await firstStarted;
  assert.equal(await host.runSourceCheck(id, options, () => true, () => {}, 'same-source-retest'), undefined);
  firstActive = false;
  const retest = host.runSourceCheck(id, options, () => true, () => {}, 'same-source-retest');
  assert.equal(attempts[0].options.shouldCancel(), true);
  attempts[0].options.onSourceCheckStage?.('L2');
  assert.deepEqual(observedStages, []);
  finishFirst(result(11, false));
  assert.equal(await first, undefined);
  assert.equal((await retest)?.traceId, 'source.check.run:12:1');
  assert.equal(attempts.length, 2);
  assert.ok(projections.every(row => row?.checkState !== 'failed'));
  assert.equal(projections.at(-1)?.checkState, 'passed');
});

test('current HTTP authentication denial projects expired, with exact matched stage reason', () => {
  const book = source('auth', { loginUrl: 'https://sources.example/login' });
  const report = history('fail')[0].report;
  report.steps[0].reason = 'network';
  const fail = { sourceId: book.sourceId, traceId: report.traceId, available: false, report, logs: [] };
  const denial = { sourceId: book.sourceId, traceId: report.traceId, step: 'L2', statusCode: 403 };
  assert.equal(sourceV9AuthenticationDenied({ ...fail, logs: [denial] }), true);
  assert.equal(sourceV9AuthenticationDenied({ ...fail, logs: [{ ...denial, traceId: 'retired' }] }), false);
  assert.equal(sourceV9AuthenticationDenied({ ...fail, logs: [{ ...denial, step: 'L1' }] }), false);
  assert.equal(sourceV9AuthenticationDenied({ ...fail, logs: [{ ...denial, statusCode: 500 }] }), false);
  const currentHistory = [{ checkedAtMs: 10, stale: false, report }];
  assert.equal(projectSourceV9Check(book, currentHistory, undefined, 0, true).loginState, 'expired');
  assert.equal(projectSourceV9Check({ ...book, enabled: false }, currentHistory, undefined, 0,
    true).loginState, 'unknown');
  assert.equal(projectSourceV9Check(book, [], undefined, 11).loginState, 'unknown');
  assert.equal(sourceV9CheckStepText(report.steps[0], 'L2: HTTP status 403'), '失败 · HTTP status 403');
  assert.equal(sourceV9CheckStepText(report.steps[0], 'L4: HTTP status 403'), '失败 · network');
});

const firstImportedId = 'https://first-imported.example/';
const secondImportedId = 'https://second-imported.example/';
const importedBatch = { sourceIds: [firstImportedId, secondImportedId] };

function importedSource(id) {
  return { sourceId: id, name: '导入书源', baseUrl: id, enabled: true, enabledExplore: false,
    bookSource: { bookSourceType: 0, bookSourceUrl: id, bookSourceName: '导入书源' } };
}

async function importReadbackFixture() {
  const { actualSourceJourneyTypes } = await import('./lib/source-management-owner-probe.mjs');
  let rows = [];
  let nextList;
  let searchInvocations = 0;
  const requests = [];
  const snapshots = [];
  const runtime = {
    supportsCoreCapability: () => false,
    async request(method, params, options) {
      requests.push(method);
      if (method === 'source.list') {
        const read = nextList;
        nextList = undefined;
        return { data: { sources: read === undefined ? rows : await read() } };
      }
      if (method === 'source.update') {
        options?.onDispatch?.();
        const row = rows.find(source => source.sourceId === params.sourceId);
        assert.ok(row, 'toggle targets a listed source');
        row.enabled = params.enabled;
        return { data: { source: row } };
      }
      if (method === 'source.delete') {
        options?.onDispatch?.();
        const previousCount = rows.length;
        rows = rows.filter(row => !params.sourceIds.includes(row.sourceId));
        return { data: { deleted: previousCount - rows.length } };
      }
      assert.fail(`Unexpected Core request: ${method}`);
    },
    async clearSourceCookieSession() {},
  };
  const { SourceJourneyPresentation } = actualSourceJourneyTypes({ ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
    hilog: { info() {}, warn() {}, error() {} } });
  const journey = new SourceJourneyPresentation();
  const search = () => { searchInvocations += 1; };
  const open = identity => journey.openManagement(runtime, identity, () => true);
  const settled = () => journey.registry.orchestrator.operationChain;
  journey.observe(view => snapshots.push({
    operation: view.operation,
    sourceIds: view.sources.map(row => row.sourceId),
    statusKind: view.statusKind,
    statusMessage: view.statusMessage,
    searchActionLabel: view.searchActionLabel,
    searchActionRevision: view.searchActionRevision,
  }));
  return {
    journey, open, settled, snapshots, requests,
    searchInvocations: () => searchInvocations,
    setSources: (...ids) => { rows = ids.map(importedSource); },
    readNextList: read => { nextList = read; },
    readBack: (identity, imported = importedBatch) => journey.readBackTransfer(identity, [], imported, search),
    async reconcile(identity) {
      journey.registry.reconcile(journey.snapshot().operation.receipt.facts.generation, identity);
      await settled();
    },
    resetTrace() { snapshots.length = 0; requests.length = 0; },
  };
}

function importReceiptTransitions(snapshots) {
  const receipts = new Map();
  for (const { operation } of snapshots) {
    if (operation.action === 'import' && operation.receipt !== undefined) {
      receipts.set(operation.receipt.facts.generation, operation.receipt.receipt.readback);
    }
  }
  return [...receipts.values()];
}

function searchActivationCount(snapshots) {
  return new Set(snapshots.filter(view => view.searchActionLabel === '重新搜索')
    .map(view => view.searchActionRevision)).size;
}

function assertRetiredReadIgnored(snapshots) {
  assert.ok(snapshots.every(view => view.statusKind === 'loading' && view.searchActionLabel === '' &&
    view.sourceIds.length === 0 && view.operation.receipt?.receipt.fact !== 'confirmedCurrent'),
  'only the new opening may publish while waiting for its own list');
}

function assertConfirmedReadbackFailure(fixture, error = '列表中未能核对全部已导入书源') {
  const { operation, statusKind, statusMessage, searchActionLabel } = fixture.journey.snapshot();
  assert.equal(operation.receipt.receipt.confirmation, 'confirmed');
  assert.equal(operation.receipt.receipt.fact, 'confirmedRefreshFailed');
  assert.equal(operation.receipt.facts.canRetry, true);
  assert.equal(operation.receipt.refreshError, error);
  assert.equal(statusKind, 'warning');
  assert.ok(statusMessage.includes(error));
  assert.equal(searchActionLabel, '');
  assert.equal(searchActivationCount(fixture.snapshots), 0);
  assert.ok(fixture.snapshots.every(view => view.operation.action !== 'import' ||
    view.operation.receipt?.receipt.fact !== 'confirmedCurrent'));
  const firstLoading = fixture.snapshots.findIndex(view => view.statusKind === 'loading');
  if (firstLoading !== -1) {
    assert.ok(fixture.snapshots.slice(firstLoading).every(view => view.statusKind !== 'idle'));
  }
}

test('v9 import publishes reading then failure, and same-opening read-only retries activate Search exactly once', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'import-opening';
  fixture.setSources(firstImportedId);
  fixture.open(identity);
  await fixture.settled();
  fixture.resetTrace();

  await fixture.readBack(identity, { sourceIds: [...importedBatch.sourceIds, firstImportedId] });
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'failed']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assertConfirmedReadbackFailure(fixture);
  const { importIdentity, confirmedParts } = fixture.journey.snapshot().operation;
  assert.ok(Number.isInteger(importIdentity));
  assert.equal(confirmedParts, 2);

  fixture.resetTrace();
  await fixture.reconcile(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'failed']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assertConfirmedReadbackFailure(fixture);
  assert.equal(fixture.journey.snapshot().operation.importIdentity, importIdentity);

  fixture.resetTrace();
  fixture.setSources(...importedBatch.sourceIds);
  await fixture.reconcile(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.equal(fixture.journey.snapshot().operation.importIdentity, importIdentity);
  assert.equal(searchActivationCount(fixture.snapshots), 1);
  const revision = fixture.journey.snapshot().searchActionRevision;
  fixture.journey.runSearchAction('stale-opening', revision);
  fixture.journey.runSearchAction(identity, revision - 1);
  assert.equal(fixture.searchInvocations(), 0);
  fixture.journey.runSearchAction(identity, revision);
  fixture.journey.runSearchAction(identity, revision);
  assert.equal(fixture.searchInvocations(), 1);
});

test('v9 import can activate Search on its first exact readback and report-only reads do not publish another success', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'complete-import';
  fixture.open(identity);
  await fixture.settled();
  fixture.resetTrace();
  fixture.setSources(...importedBatch.sourceIds);
  await fixture.readBack(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.equal(searchActivationCount(fixture.snapshots), 1);
  const successfulGeneration = fixture.journey.snapshot().operation.receipt.facts.generation;

  assert.equal(await fixture.journey.registry.acceptTransferredReports([], [], identity), false);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.equal(fixture.journey.snapshot().operation.receipt.facts.generation, successfulGeneration);
  assert.equal(searchActivationCount(fixture.snapshots), 1);
  assert.deepEqual(fixture.requests, ['source.list', 'source.list']);
});

test('v9 report-only refresh and reopening keep missing IDs pending, then a reopened retry cannot activate old Search', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'original-opening';
  const reopened = 'reopened';
  fixture.open(identity);
  await fixture.settled();
  await fixture.readBack(identity);
  const { importIdentity } = fixture.journey.snapshot().operation;
  assert.deepEqual(fixture.journey.snapshot().sources, []);
  fixture.resetTrace();
  await fixture.readBack(identity, { sourceIds: [] });
  assertConfirmedReadbackFailure(fixture);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.equal(fixture.journey.snapshot().operation.importIdentity, importIdentity);

  fixture.journey.retire();
  fixture.resetTrace();
  fixture.open(reopened);
  await fixture.settled();
  assertConfirmedReadbackFailure(fixture);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.equal(fixture.journey.snapshot().operation.importIdentity, importIdentity);

  fixture.resetTrace();
  fixture.setSources(...importedBatch.sourceIds);
  await fixture.reconcile(reopened);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.equal(searchActivationCount(fixture.snapshots), 0);
});

test('v9 import keeps a confirmed batch through a list error and verifies the same IDs after retry', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'failing-list';
  fixture.open(identity);
  await fixture.settled();
  fixture.resetTrace();
  fixture.readNextList(() => { throw new Error('读回异常'); });
  await fixture.readBack(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'failed']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assertConfirmedReadbackFailure(fixture, '读回异常');

  fixture.resetTrace();
  fixture.setSources(firstImportedId);
  await fixture.reconcile(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'failed']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assertConfirmedReadbackFailure(fixture);

  fixture.resetTrace();
  fixture.setSources(...importedBatch.sourceIds);
  await fixture.reconcile(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.equal(searchActivationCount(fixture.snapshots), 1);
});

function delayNextSourceList(fixture) {
  const entered = Promise.withResolvers();
  const result = Promise.withResolvers();
  fixture.readNextList(() => {
    entered.resolve();
    return result.promise;
  });
  return { entered: entered.promise, complete: (...ids) => result.resolve(ids.map(importedSource)) };
}

test('v9 import accepted before leaving still has a batch to check if its queue work starts after reopening', async () => {
  const fixture = await importReadbackFixture();
  const firstRead = delayNextSourceList(fixture);
  fixture.open('first-opening');
  await firstRead.entered;
  const queued = fixture.readBack('first-opening');
  fixture.journey.retire();
  fixture.open('next-opening');
  fixture.resetTrace();
  const newRead = delayNextSourceList(fixture);
  firstRead.complete(...importedBatch.sourceIds);
  await newRead.entered;
  assertRetiredReadIgnored(fixture.snapshots);
  newRead.complete(firstImportedId);
  await queued;
  await fixture.settled();
  assertConfirmedReadbackFailure(fixture);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.ok(fixture.snapshots.every(view => !view.sourceIds.includes(secondImportedId)));
});

test('v9 import discards a retired readback while the next opening verifies the batch on its own list', async () => {
  const fixture = await importReadbackFixture();
  fixture.open('original-opening');
  await fixture.settled();
  const originalReadback = delayNextSourceList(fixture);
  const original = fixture.readBack('original-opening');
  await originalReadback.entered;
  fixture.journey.retire();
  fixture.open('next-opening');
  fixture.resetTrace();
  const currentReadback = delayNextSourceList(fixture);
  originalReadback.complete(...importedBatch.sourceIds);
  await currentReadback.entered;
  assertRetiredReadIgnored(fixture.snapshots);
  currentReadback.complete(firstImportedId);
  await original;
  await fixture.settled();
  assertConfirmedReadbackFailure(fixture);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.ok(fixture.snapshots.every(view => !view.sourceIds.includes(secondImportedId)));
});

test('v9 delete removes its IDs from the pending batch and a later toggle replaces an unrelated import receipt', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'writes-after-import';
  fixture.setSources(firstImportedId);
  fixture.open(identity);
  await fixture.settled();
  await fixture.readBack(identity);
  const { importIdentity } = fixture.journey.snapshot().operation;

  fixture.resetTrace();
  fixture.journey.registry.deleteSources([firstImportedId], identity);
  await fixture.settled();
  assert.deepEqual(fixture.requests, ['source.delete', 'source.list']);
  assert.equal(fixture.journey.snapshot().operation.receipt.receipt.fact, 'confirmedRefreshFailed');
  assert.equal(fixture.journey.snapshot().operation.importIdentity, importIdentity);

  fixture.resetTrace();
  fixture.setSources(secondImportedId);
  await fixture.reconcile(identity);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.deepEqual(fixture.requests, ['source.list'], 'the intentionally deleted ID is no longer required');

  await fixture.readBack(identity, { sourceIds: [firstImportedId] });
  assert.equal(fixture.journey.snapshot().operation.receipt.receipt.fact, 'confirmedRefreshFailed');
  assert.notEqual(fixture.journey.snapshot().operation.importIdentity, importIdentity);
  fixture.resetTrace();
  fixture.journey.registry.toggleSource(secondImportedId, false, identity);
  await fixture.settled();
  await fixture.readBack(identity, { sourceIds: [] });
  assert.deepEqual(fixture.requests, ['source.update', 'source.list', 'source.list']);
  assert.equal(fixture.journey.snapshot().operation.action, 'toggle');
  assert.equal(fixture.journey.snapshot().operation.importIdentity, undefined);
  assert.equal(fixture.journey.snapshot().operation.receipt.receipt.fact, 'confirmedCurrent');
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), []);
});

test('v9 deleting the last pending source clears the readback without arming Search', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'delete-last-pending';
  fixture.setSources(firstImportedId);
  fixture.open(identity);
  await fixture.settled();
  fixture.resetTrace();
  fixture.readNextList(() => { throw new Error('读回异常'); });
  await fixture.readBack(identity, { sourceIds: [firstImportedId] });
  assertConfirmedReadbackFailure(fixture, '读回异常');

  fixture.resetTrace();
  fixture.journey.registry.deleteSources([firstImportedId], identity);
  await fixture.settled();
  assert.deepEqual(fixture.requests, ['source.delete', 'source.list']);
  assert.deepEqual(fixture.journey.snapshot().sources, []);
  assert.equal(fixture.journey.snapshot().operation.importIdentity, undefined);
  assert.equal(searchActivationCount(fixture.snapshots), 0);
});

test('v9 a newer import owns the Search action even while a previously admitted readback finishes', async () => {
  const fixture = await importReadbackFixture();
  const identity = 'overlapping-imports';
  fixture.open(identity);
  await fixture.settled();
  fixture.resetTrace();

  const firstRead = delayNextSourceList(fixture);
  const first = fixture.readBack(identity, { sourceIds: [firstImportedId] });
  await firstRead.entered;
  const olderImport = fixture.snapshots.find(view => view.operation.receipt?.receipt.readback === 'reading')
    ?.operation.importIdentity;
  assert.ok(Number.isInteger(olderImport));
  let newestSearchInvocations = 0;
  const second = fixture.journey.readBackTransfer(identity, [], { sourceIds: [secondImportedId] },
    () => { newestSearchInvocations += 1; });
  firstRead.complete(firstImportedId);
  await first;
  await second;

  assert.deepEqual(fixture.requests, ['source.list', 'source.list']);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded', 'reading', 'failed']);
  assert.ok(fixture.journey.snapshot().operation.importIdentity > olderImport);
  assert.equal(searchActivationCount(fixture.snapshots), 0);
  fixture.resetTrace();
  fixture.setSources(secondImportedId);
  await fixture.reconcile(identity);
  assert.deepEqual(fixture.requests, ['source.list']);
  assert.deepEqual(importReceiptTransitions(fixture.snapshots), ['reading', 'succeeded']);
  assert.equal(searchActivationCount(fixture.snapshots), 1);
  fixture.journey.runSearchAction(identity, fixture.journey.snapshot().searchActionRevision);
  assert.equal(newestSearchInvocations, 1);
  assert.equal(fixture.searchInvocations(), 0);
});

async function sourceV9TransferBuilderProbe(methods, dependencies = {}) {
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { sourceV9DisplayUrl } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
  const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
  const content = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceV9TransferPage.ets', import.meta.url), 'utf8');
  const { owner } = createReaderBuilderProbe(content, [...methods, 'badge', 'color'], {
    readerAppColor: role => role,
    sourceV9DisplayUrl,
    ...fonts,
    ...dependencies,
  });
  Object.assign(owner, { scheme: 'day', editable: () => true, checkbox: () => {} });
  return owner;
}

function transferText(owner) {
  return [...owner.nodes.values()].filter(node => node.type === 'Text');
}

test('transfer import renders the normalized domain, original group and exact existing source badge', async () => {
  const owner = await sourceV9TransferBuilderProbe(['importRow', 'importCaption', 'reportAction']);
  const existing = 'https://Sources.Example/existing?secret=gone';
  owner.state = { knownSourceIds: [existing] };
  owner.inputCurrent = () => true;
  const candidate = {
    supported: true,
    name: '既有书源',
    sourceId: existing,
    bookSource: { bookSourceGroup: '  原始分组  ' },
  };
  owner.importRow({ index: 0, candidate, selected: true, report: { available: true } }, 0);
  owner.importRow({ index: 1, candidate: { ...candidate, sourceId: 'https://sources.example/new', name: '新增书源' },
    selected: true, report: { available: false } }, 1);
  const labels = transferText(owner);
  const byLabel = text => labels.filter(node => node.create === text);
  assert.equal(byLabel('更新').length, 1, 'same-host candidates must not be confused with the existing exact ID');
  assert.equal(byLabel('更新')[0].backgroundColor, 'app.sourceUi.selected');
  assert.equal(byLabel('https://sources.example · 原始分组').length, 2);
  assert.equal(byLabel('通过')[0].fontColor, 'app.status.good');
  assert.equal(byLabel('未通过')[0].fontColor, 'app.sourceUi.danger');
  assert.ok(labels.every(node => !String(node.create).includes('secret')));
});

test('transfer subscription diff renders a single card and distinguishes selected updates from kept conflicts', async () => {
  const owner = await sourceV9TransferBuilderProbe(['reviewList', 'reviewRow', 'reviewCaption', 'changeBadge'], {
    LengthMetrics: { vp: value => value },
  });
  const selection = [];
  owner.checkbox = (checked, enabled, label) => selection.push([label, checked, enabled]);
  owner.action = () => {};
  owner.state = { reviews: [{ subscription: { id: 1, name: '订阅一' }, rows: [
    { key: 'update', name: '更新项', sourceId: 'https://sources.example/private', kind: 'update',
      selected: true, selectable: true },
    { key: 'conflict', name: '冲突项', sourceId: 'https://sources.example/other', kind: 'conflict',
      selected: true, selectable: true, overwrite: false },
  ] }, { subscription: { id: 2, name: '订阅二' }, rows: [] }] };
  owner.reviewList();
  const cards = [...owner.nodes.values()].filter(node => node.backgroundColor === 'TOK_CARD_BG');
  assert.equal(cards.length, 1);
  assert.equal(cards[0].borderRadius, 14);
  const labels = transferText(owner);
  const byLabel = text => labels.find(node => node.create === text);
  assert.equal(byLabel('更新').backgroundColor, 'app.sourceUi.selected');
  assert.equal(byLabel('冲突').backgroundColor, 'app.status.warningSoft');
  assert.ok(byLabel('https://sources.example · 订阅一'));
  assert.ok(byLabel('订阅二 · 没有变更'));
  assert.deepEqual(selection, [['更新项', true, true], ['冲突项', false, false]]);
});

const etsRoot = new URL('../entry/src/main/ets/', import.meta.url);
const sourceUi = name => new URL('features/source/ui/' + name + '.ets', etsRoot);

test('all source toggles supply identity, and the three transfer controls have distinct identities', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts, options } = installedEtsCompiler();
  const directory = new URL('features/source/', etsRoot);
  const transfer = new Map();
  let count = 0;
  for (const path of readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.ets'))) {
    const tree = ts.createSourceFile(path, readFileSync(new URL(path, directory), 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'ReaderToggle') {
        const props = node.arguments[0].properties;
        const identity = props.find(prop => prop.name?.getText(tree) === 'inputIdentity')?.initializer;
        assert.ok(identity && (!ts.isStringLiteral(identity) || identity.text.length > 0), path);
        if (path.endsWith('SourceV9TransferPage.ets')) {
          const label = props.find(prop => prop.name?.getText(tree) === 'accessibilityLabel')?.initializer;
          if (label && ts.isStringLiteral(label)) transfer.set(label.text, identity.text);
        }
        count += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.ok(count >= 7);
  const identities = ['同时保存为书源订阅', '导入前可用性检测', '自动检查更新'].map(label => transfer.get(label));
  assert.ok(identities.every(Boolean));
  assert.equal(new Set(identities).size, 3);
});

test('source more menu closes on every ownership change and rejects disabled or repeat actions', async () => {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const Page = selectedProductionMethods(sourceUi('SourceManagementPage'), 'SourceManagementPage', [
    'moreFocusRevision', 'toggleMoreMenu', 'closeMoreMenu', 'moreActions', 'chooseMoreAction',
    'onToolsFocusContextChanged', 'onV9PaneChanged', 'onV9ListInputChanged', 'toggleGroupSelection',
    'onUngroupedBatch', 'consumeTemporaryBack', 'aboutToDisappear',
  ], { ReaderMenuActionView: class {
    constructor(id, label, enabled, icon) { Object.assign(this, { id, label, enabled, icon }); }
  }, $r: name => name, readerActionIcon: (kind, scheme) => `icon:${kind}:${scheme}` });
  const events = [];
  const owner = new Page();
  Object.assign(owner, {
    mounted: true, v9Pane: 'list', appThemeScheme: 'day', appForeground: true, inputEnabled: true, projectedSourceCount: 0, moreMenuOpen: false,
    temporaryBackIdentity: 'opening', hasReadableSources: false, ungroupedBatchIds: [],
    managementOpeningIsCurrent: () => true, managementInputIsCurrent: () => true, managementBackIsCurrent: () => true,
    toolsFocusId: target => 'focus:' + target, scheduleMoreFocus: id => events.push(['focus', id]),
    hideManagementKeyboard: () => { events.push(['keyboard']); return false; },
    onV9Action: (...args) => events.push(args), visibleIds: () => ['selected'],
    prepareV9ListReturn() {}, cancelToolsReturnFocus() {}, cancelScrollRestore() {},
    scheduleImportStatusReadyObservation() {}, requestGroupClose: () => false, groupOptions: () => [],
    rebuildSourceProjection() {}, retireGroupSelection() {}, onTemporaryBackBridge() {},
    verificationOperationTextRoles: new Set(), measurements: { clear() {} }, editingHost: { unmount() {} }, transientFeedback: { reset() {} },
  });
  owner.toggleMoreMenu();
  assert.deepEqual(events.splice(0), [['keyboard'], ['focus', 'reader-source-v9-open-subscriptions']]);
  assert.deepEqual(owner.moreActions().map(action => action.enabled), [true, true, false, false]);
  assert.deepEqual(owner.moreActions().map(action => action.icon),
    ['app.media.source_v9_cloud', 'icon:folder:day', 'app.media.source_v9_wave', 'app.media.source_v9_upload']);
  owner.chooseMoreAction('detect');
  owner.chooseMoreAction('export');
  assert.equal(owner.moreMenuOpen, true);
  assert.deepEqual(events, []);
  owner.projectedSourceCount = 1;
  owner.hasReadableSources = true;
  owner.chooseMoreAction('detect');
  owner.chooseMoreAction('detect');
  assert.deepEqual(events.splice(0), [['detect', ['selected']]]);

  for (const [close, restore] of [
    [() => owner.consumeTemporaryBack('opening'), true],
    [() => owner.toggleMoreMenu(), true],
    [() => { owner.appForeground = false; owner.onToolsFocusContextChanged(); owner.appForeground = true; }, false],
    [() => { owner.v9Pane = 'groups'; owner.onV9PaneChanged(); owner.v9Pane = 'list'; }, false],
    [() => { owner.inputEnabled = false; owner.onV9ListInputChanged(); owner.inputEnabled = true; }, false],
    [() => owner.toggleGroupSelection(), false],
    [() => { owner.ungroupedBatchIds = ['selected']; owner.onUngroupedBatch(); owner.batchMode = false; }, false],
    [() => owner.aboutToDisappear(), false],
  ]) {
    owner.toggleMoreMenu();
    assert.equal(owner.moreMenuOpen, true);
    events.length = 0;
    close();
    assert.equal(owner.moreMenuOpen, false);
    assert.equal(events.some(event => event[0] === 'focus' && event[1] === 'focus:header'), restore);
  }
});

test('export admits only one picker while pending and releases admission after cancel or failure', async () => {
  const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
  const file = Promise.withResolvers();
  const pickerOpened = Promise.withResolvers();
  const id = 'https://export.example/';
  let exports = 0, pickers = 0;
  const runtime = {
    async request(method) {
      if (method === 'source.list') return { data: { sources: [importedSource(id)] } };
      assert.equal(method, 'source.export');
      exports += 1;
      return { data: { data: '[{}]', count: 1, format: 'json' } };
    },
    async saveBookSourceJson() {
      pickers += 1;
      if (pickers === 1) { pickerOpened.resolve(); return file.promise; }
      if (pickers === 2) throw new Error('测试写入失败');
      return 'picked.json';
    },
  };
  const { SourceHost } = actualSourceManagementTypes({
    ReaderRuntimeOwner: { isCurrent: owner => owner === runtime }, AppStorage: { get: () => true },
    hilog: { info() {}, warn() {}, error() {} },
  });
  const host = new SourceHost(() => {}, () => {}, () => {});
  assert.equal(host.bindPresentation(runtime, 'export-list', () => true), true);
  host.open('export-list');
  await host.orchestrator.operationChain;
  host.exportAll('export-list');
  host.exportAll('export-list');
  await pickerOpened.promise;
  host.exportAll('export-list');
  file.resolve(undefined);
  await host.orchestrator.operationChain;
  assert.deepEqual([exports, pickers], [1, 1]);
  host.exportAll('export-list');
  await host.orchestrator.operationChain;
  host.exportAll('export-list');
  await host.orchestrator.operationChain;
  assert.deepEqual([exports, pickers], [3, 3]);
});

test('login offers Stop while loading, keeps Finish available, and sends clear feedback to the mounted toast', async () => {
  const { readFileSync } = await import('node:fs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const file = new URL('ui/platform/ArkWebExecutionHost.ets', etsRoot);
  const text = readFileSync(file, 'utf8');
  const finish = text.slice(text.indexOf("Text('完成')"), text.indexOf('finishInteractive(surface)'));
  assert.match(finish, /\.enabled\(!this\.clearing\)/);
  assert.doesNotMatch(finish, /pageLoading/);
  assert.match(text, /if \(this\.pageLoading\) \{\s*this\.browserAction\('停止加载', !this\.clearing,[\s\S]+?this\.navigate\(surface, 'stop'\)\);\s*\} else \{\s*this\.browserAction\('刷新', !this\.clearing,/);
  const surface = { id: 11 };
  const Host = selectedProductionMethods(file, 'ArkWebExecutionHost', ['presentationListener', 'showClearFeedback'],
    { ArkWebExecutor: { instance: { isSurfaceCurrent: current => current === surface } } });
  const shown = [];
  const owner = Object.assign(new Host(), {
    mounted: true, currentSurface: surface, interactive: true, feedbackHostSurface: surface,
    onInputCaptureChange() {}, updateAddress() {}, updateHistory() {},
    transientFeedback: { show(_context, feedback, current) { assert.equal(current(), true); shown.push(feedback.message); } },
  });
  const outcome = { report: 'cleared' };
  const event = { surfaceId: surface.id, visible: true, clearOutcome: outcome };
  owner.presentationListener({ ...event, surfaceId: 12 });
  assert.deepEqual(shown, []);
  owner.presentationListener(event);
  owner.presentationListener(event);
  assert.deepEqual(shown, ['已清除登录态和旧检测报告']);
  owner.feedbackHostSurface = undefined;
  owner.presentationListener({ ...event, clearOutcome: { report: 'unsupported' } });
  assert.equal(shown.length, 1);
  owner.feedbackHostSurface = surface;
  owner.showClearFeedback(surface);
  assert.deepEqual(shown, ['已清除登录态和旧检测报告', '已清除登录态，当前 Core 无法清除已保存的检测报告']);
});

test('login opens with the latest host geometry without publishing inactive layout changes', async () => {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const file = new URL('ui/platform/ArkWebExecutionHost.ets', etsRoot);
  const Host = selectedProductionMethods(file, 'ArkWebExecutionHost', [
    'presentationListener', 'recordHostArea', 'publishHostArea',
  ], { readerPageAreaLength: Number, readerMotionAnimateParam: () => ({}) });
  const owner = Object.assign(new Host(), {
    mounted: true, currentSurface: { id: 11 }, interactive: false,
    hostWidth: 320, hostHeight: 640, hostX: 0, hostY: 16,
    getUIContext: () => ({ animateTo: (_motion, update) => update() }),
    onInputCaptureChange() {}, updateAddress() {}, updateHistory() {},
  });
  const geometry = () => [owner.hostWidth, owner.hostHeight, owner.hostX, owner.hostY];
  owner.recordHostArea({ width: 600, height: 320, globalPosition: { x: 12, y: 24 } });
  assert.deepEqual(geometry(), [320, 640, 0, 16]);
  owner.presentationListener({ surfaceId: 11, visible: true, title: 'login' });
  assert.equal(owner.interactive, true);
  assert.deepEqual(geometry(), [600, 320, 12, 24]);
  owner.recordHostArea({ width: 600, height: 180, globalPosition: { x: 12, y: 24 } });
  assert.deepEqual(geometry(), [600, 180, 12, 24]);
});

test('group creation and renaming explain invalid names without blocking a retained name', async () => {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const Page = selectedProductionMethods(sourceUi('SourceV9GroupsPage'), 'SourceV9GroupsPage', ['nameError']);
  const page = Object.assign(new Page(), { groups: [{ id: 'catalog', name: '书单' }, { id: '', name: '未分组' }] });
  for (const [name, error] of [
    ['  ', '请输入分组名称'],
    ['全部分组', '该名称由系统保留'],
    ['未分组', '该名称由系统保留'],
    ['书单 ', '已存在同名分组'],
    ['书'.repeat(33), '分组名称最多 32 个字符'],
  ]) {
    page.name = name;
    assert.equal(page.nameError(), error);
  }
  page.name = ' 书单 ';
  assert.equal(page.nameError('catalog'), '');
  page.name = '书'.repeat(32);
  assert.equal(page.nameError(), '');
});

test('batch delete confirmation retains the original IDs and rejects cancelled or stale generations', async () => {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const Journey = selectedProductionMethods(sourceUi('SourceJourneySurface'), 'SourceJourneySurface', [
    'confirmSourceDeletion', 'moveCatalogDialogVisible', 'listDialogVisible', 'chooseListDialog',
  ]);
  const calls = [];
  const owner = Object.assign(new Journey(), {
    pane: 'list', listDialogGeneration: 0, deleteSourceIds: [], moveSourceIds: [], identity: 'source-opening',
    managementInputIsCurrent: () => true,
    presentation: { management: () => ({ deleteSources: (ids, identity) => calls.push([ids, identity]) }) },
  });
  owner.confirmSourceDeletion(['old']);
  assert.equal(owner.listDialogVisible(), true);
  owner.chooseListDialog(1, 'cancel');
  const current = ['one', 'two'];
  owner.confirmSourceDeletion(current);
  current.length = 0;
  owner.chooseListDialog(1, 'delete');
  assert.deepEqual(calls, []);
  owner.chooseListDialog(2, 'delete');
  owner.chooseListDialog(2, 'delete');
  assert.deepEqual(calls, [[['one', 'two'], 'source-opening']]);
  assert.equal(owner.listDialogVisible(), false);
});

test('the shared source menu renders four tinted icons and clips the card without clipping its pointer', async () => {
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedMembers, readerSurfaceSpecsForProbe } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const shared = readFileSync(new URL('ui/surfaces/ReaderActionMenuSurface.ets', etsRoot), 'utf8');
  const { ReaderMenuActionView } = pureModuleProbe(shared.slice(0, shared.indexOf('@Component')),
    'ReaderMenuActionView.ets', {}, ['ReaderMenuActionView']);
  const specs = readerSurfaceSpecsForProbe();
  const foundation = foundationControls();
  const { owner } = createReaderBuilderProbe(shared, boundedMembers(shared), {
    ...foundation.dependencies, ...specs, ReaderMenuActionView, readerAppColor,
  }, foundation.hooks);
  const icons = ['app.media.source_v9_cloud', 'app.media.reader_action_folder_theme_night',
    'app.media.source_v9_wave', 'app.media.source_v9_upload'];
  const spec = specs.resolvePopupSpec('source-v9-more-menu');
  Object.assign(owner, { specId: 'source-v9-more-menu', scheme: 'night', availableWidth: spec.width,
    viewportHeight: spec.expandedHeight,
    actions: icons.map((icon, index) => new ReaderMenuActionView(String(index), `操作 ${index}`, index < 2, icon)) });
  owner.menuActions();
  const nodes = [...owner.nodes.values()];
  assert.deepEqual(nodes.filter(node => node.type === 'Image')
    .map(node => [node.create, node.width, node.height, node.fillColor]),
  icons.map(icon => [icon, 17, 17, readerAppColor('TOK_INK', 'night')]));
  assert.equal(nodes.filter(node => node.type === 'Button' && node.height >= 44).length, 4);
  assert.equal(nodes.filter(node => node.type === 'Button' && node.opacity === 0.45).length, 2);
  assert.equal(specs.resolvePopupSpec('reader-more-menu').actionIconSize, 0);

  const page = readFileSync(sourceUi('SourceManagementPage'), 'utf8');
  const shell = page.slice(page.indexOf('private sourceMoreMenu()'), page.indexOf('private visibleIds()'));
  assert.match(shell, /ReaderActionMenuSurface\(\{ specId: 'source-v9-more-menu'/);
  assert.match(shell, /\.borderRadius\(resolvePopupSpec\('source-v9-more-menu'\)\.borderRadius\)\.clip\(true\)/);
  assert.match(shell, /\.rotate\(\{ angle: 45 \}\)[\s\S]+\.width\(this\.moreWidth\(\)\)\.clip\(false\)/);
});
