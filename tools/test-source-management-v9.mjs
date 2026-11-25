import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectSourceManagementV9,
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
