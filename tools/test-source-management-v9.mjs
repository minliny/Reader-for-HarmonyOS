import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectSourceManagementV9,
  projectSourceV9Check,
  sourceV9AuthenticationDenied,
  sourceV9CheckStepText,
  sourceV9Primary,
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
  ], { readerAppColor: role => role, sourceV9Primary, sourceV9LatestReport: () => undefined,
    READER_FONT_NOTO_SANS_SC_UI_REGULAR: 'ReaderNotoSansSCUIRegular' });
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
  assert.equal(projectSourceV9Check(book, currentHistory, undefined, 0, 'verified', true).loginState, 'expired');
  assert.equal(projectSourceV9Check({ ...book, enabled: false }, currentHistory, undefined, 0,
    'verified', true).loginState, 'unknown');
  assert.equal(projectSourceV9Check(book, [], undefined, 11, undefined, false).loginState, 'unknown');
  assert.equal(sourceV9CheckStepText(report.steps[0], 'L2: HTTP status 403'), '失败 · HTTP status 403');
  assert.equal(sourceV9CheckStepText(report.steps[0], 'L4: HTTP status 403'), '失败 · network');
});

test('v9 import arms the original Search action only after exact current list readback', async () => {
  const { actualSourceJourneyTypes } = await import('./lib/source-management-owner-probe.mjs');
  const id = 'https://imported.example/';
  const raw = { sourceId: id, name: '导入书源', baseUrl: id, enabled: true, enabledExplore: false,
    bookSource: { bookSourceType: 0, bookSourceUrl: id, bookSourceName: '导入书源' } };
  let rows = [];
  const runtime = {
    supportsCoreCapability: () => false,
    async request(method) {
      assert.equal(method, 'source.list');
      return { data: { sources: rows } };
    },
  };
  const { SourceJourneyPresentation } = actualSourceJourneyTypes({ ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
    hilog: { info() {}, warn() {}, error() {} } });
  const journey = new SourceJourneyPresentation();
  let used = 0;
  const imported = { sourceIds: [id] };
  const search = () => { used++; };
  journey.openManagement(runtime, 'import-opening', () => true);
  await journey.registry.orchestrator.operationChain;
  await journey.readBackTransfer('import-opening', [], imported, search);
  assert.equal(journey.snapshot().operation.receipt.receipt.confirmation, 'confirmed');
  assert.equal(journey.snapshot().operation.receipt.receipt.readback, 'failed');
  assert.equal(journey.snapshot().searchActionLabel, '');

  rows = [raw];
  await journey.readBackTransfer('import-opening', [], undefined, search);
  assert.equal(journey.snapshot().searchActionLabel, '');
  await journey.readBackTransfer('import-opening', [], imported, search);
  assert.equal(journey.snapshot().operation.action, 'import');
  assert.equal(journey.snapshot().operation.receipt.receipt.readback, 'succeeded');
  assert.equal(journey.snapshot().searchActionLabel, '重新搜索');
  const revision = journey.snapshot().searchActionRevision;
  journey.runSearchAction('stale-opening', revision);
  journey.runSearchAction('import-opening', revision - 1);
  assert.equal(used, 0);
  journey.runSearchAction('import-opening', revision);
  journey.runSearchAction('import-opening', revision);
  assert.equal(used, 1);
});
