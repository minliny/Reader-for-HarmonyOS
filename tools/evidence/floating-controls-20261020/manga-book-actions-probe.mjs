// Issue-local actual SDK/method evidence. No default gate, build or device.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
    throw error;
  }
} });
const { pureModuleProbe } = await import('../../lib/ets-pure-module-probe.mjs');
const { boundedSurfaceSdk, boundedMembers } = await import('../../lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('../../lib/reader-control-builder-probe.mjs');
const root = new URL('../../../', import.meta.url);
const path = 'entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts';
const read = path => readFileSync(new URL(path, root), 'utf8');
const source = read(path);
const { MangaDownloadActionsGateway: Gateway } = pureModuleProbe(source, 'MangaDownloadActionsGateway.ts', {}, ['MangaDownloadActionsGateway']);
const baseline = execFileSync('git', ['show', '8a8328822d9002a8f6fb044ed508a7cc6b000bac:' + path], { cwd: root, encoding: 'utf8' });
const { MangaDownloadActionsGateway: Baseline } = pureModuleProbe(baseline, 'MangaDownloadActionsGatewayBaseline.ts', {}, ['MangaDownloadActionsGateway']);
const identity = { sourceId: 'source', bookId: 'book' };
const chapter = index => ({ ...identity, chapterId: '/chapter/' + index });
const row = (index, state, maxAttempts = 3) => ({ chapterIndex: index, chapter: chapter(index), state, attempts: 0, maxAttempts });
const snapshot = (rows, extra = {}) => ({ chapters: rows, retentions: [], downloadChapters: [], directoryComplete: true, ...extra });
const gateway = new Gateway({}), old = new Baseline({});
const primary = result => result.filter(action => ['downloadBook', 'cancel', 'pause', 'resume'].includes(action.id));
for (const [name, rows, busy, expected] of [
  ['missing', [row(0, 'missing', 0)], false, ['downloadBook', '下载全部章节', true]],
  ['active', [row(0, 'completed'), row(1, 'inProgress')], false, ['cancel', '取消下载', undefined]],
  ['queued', [row(0, 'queued')], false, ['cancel', '取消下载', undefined]],
  ['paused', [row(0, 'paused'), row(1, 'missing', 0)], false, ['cancel', '取消下载', undefined]],
  ['failed', [row(0, 'failed')], false, ['cancel', '取消下载', undefined]],
  ['mixed', [row(0, 'paused'), row(1, 'inProgress'), row(2, 'completed')], true, ['cancel', '取消下载', undefined]],
  ['complete', [row(0, 'completed'), row(1, 'completed')], false, ['downloadBook', '已下载', false]],
  ['cached', [row(0, 'cached', 0)], false, ['downloadBook', '下载全部章节', true]],
  ['cancelled', [row(0, 'cancelled')], false, ['downloadBook', '下载全部章节', true]],
  ['busy', [row(0, 'missing', 0)], true, ['downloadBook', '下载全部章节', false]],
]) {
  const actions = primary(gateway.actions(snapshot(rows), undefined, busy));
  assert.equal(actions.length, 1, name + ' has exactly one existing task row');
  assert.deepEqual([actions[0].id, actions[0].label, actions[0].enabled], expected, name);
}
for (const rows of [[], [row(0, 'completed')], [row(0, 'queued')]]) {
  const actions = primary(gateway.actions(snapshot(rows, { directoryComplete: false })));
  assert.deepEqual(actions, [{ id: 'downloadBook', label: '下载全部章节', enabled: false }]);
}
assert.deepEqual(primary(gateway.actions(snapshot([]))), [{ id: 'downloadBook', label: '下载全部章节', enabled: false }],
  'an externally inconsistent empty+complete snapshot cannot become completed');
const retained = { retentions: [{ chapter: chapter(0), manifestVersion: 'v1', retainedAt: 1 }], downloadChapters: [chapter(0)] };
assert.deepEqual(gateway.actions(snapshot([row(0, 'inProgress')], retained)).slice(1).map(action => action.id),
  ['releaseRetention', 'deleteDownloads', 'clearCache'], 'existing storage actions are retained');
for (const state of ['missing', 'queued', 'paused', 'inProgress', 'cached', 'completed', 'failed', 'cancelled']) {
  for (const busy of [false, true]) for (const maxAttempts of [0, 3]) for (const storage of [{}, retained]) {
    const current = snapshot([row(0, state, maxAttempts), row(1, 'paused')], storage);
    assert.deepEqual(gateway.actions(current, 0, busy), old.actions(current, 0, busy),
      `actual baseline chapter actions unchanged: ${state}/${busy}/${maxAttempts}`);
  }
}
const session = { contentKind: 'manga', identity, entries: [
  { index: 0, url: '/chapter/0', navigable: true },
  { index: 1, url: '/chapter/1', navigable: true },
  { index: 2, url: '/group', navigable: false },
] };
const statusRows = () => [0, 1].map(index => ({ chapterIndex: index, url: '/chapter/' + index, navigable: true,
  state: 'completed', attempts: 1, maxAttempts: 3 }));
let rows = statusRows(), writes = 0;
const runtime = {
  supportsCoreCapability: () => true,
  async request(method) {
    if (method === 'cache.book.status') return { data: { ...identity, chapters: rows } };
    if (method === 'manga.retention.list') return { data: { retentions: [] } };
    writes++; throw Error('unexpected mutation ' + method);
  },
  async listMangaDownloadChapters() { return []; },
};
const actual = new Gateway(runtime);
assert.equal((await actual.snapshot(session)).directoryComplete, true);
for (const invalid of [[], [statusRows()[0]], [...statusRows(), { ...statusRows()[1], chapterIndex: 3 }],
  statusRows().map((row, index) => index === 1 ? { ...row, url: '/another' } : row)]) {
  rows = invalid;
  const facts = await actual.snapshot(session);
  assert.equal(facts.directoryComplete, false, 'empty, subset, extra and changed canonical identity are unknown');
  assert.equal(primary(actual.actions(facts))[0].enabled, false);
  assert.notEqual(primary(actual.actions(facts))[0].label, '已下载');
}
rows = statusRows();
assert.equal((await actual.snapshot({ ...session, entries: [session.entries[0], session.entries[0]] })).directoryComplete, false);
const hostSource = read('entry/src/main/ets/features/reading/ReadingOfflineHost.ts');
const { ReadingOfflineHost } = pureModuleProbe(hostSource, 'ReadingOfflineHost.ts', { MangaDownloadActionsGateway: Gateway }, ['ReadingOfflineHost']);
let projected = session.entries.filter(entry => entry.navigable).map(entry => ({ ...entry, downloadState: 'completed' }));
const host = new ReadingOfflineHost({ mangaActions: actual, ownsRuntime: () => true,
  gateway: { async loadProjection() { return projected; } } });
const binding = { session, current: () => true, currentEntries: () => projected, emitEntries() {} };
assert.deepEqual(primary(await host.loadMangaActions(undefined, binding)), [{ id: 'downloadBook', label: '已下载', enabled: false }]);
rows = [statusRows()[0]];
assert.equal(primary(await host.loadMangaActions(undefined, binding))[0].enabled, false, 'Host carries incomplete directory fact');
rows = statusRows(); projected = projected.map(entry => ({ ...entry, downloadState: 'cached' }));
assert.equal(primary(await host.loadMangaActions(undefined, binding))[0].label, '下载全部章节', 'physical cached is not completed');
projected = [];
await assert.rejects(host.loadMangaActions(undefined, binding), /需要重新读取/);
assert.equal(writes, 0, 'read-only state projection never mutates queue/storage');

const panelSource = read('entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets');
const { readerActionIcon } = pureModuleProbe(read('entry/src/main/ets/features/common/ReaderActionIconResources.ets'),
  'ReaderActionIconResources.ets', { $r: id => id }, ['readerActionIcon']);
const ui = boundedSurfaceSdk();
const calls = [];
const owner = createReaderBuilderProbe(panelSource, boundedMembers(panelSource), { ...ui.deps, readerActionIcon },
  { ...ui.hooks, initialParams: { actions: [{ id: 'downloadBook', label: '已下载', enabled: false }], onAction: id => calls.push(id) } }).owner;
owner.initialRender();
const rendered = ui.nodes(owner).find(node => node.type === 'Row' && node.accessibilityText?.startsWith('已下载'));
assert.ok(rendered, 'actual existing ActionSheet row is mounted');
assert.equal(rendered.enabled, false, 'actual SDK row receives disabled');
rendered.onClick(); owner.performAction('downloadBook');
assert.deepEqual(calls, [], 'both native row and Panel reject disabled dispatch');
owner.actions = [{ id: 'downloadBook', label: '下载全部章节', enabled: true }];
owner.performAction('downloadBook');
assert.deepEqual(calls, ['downloadBook']);
owner.actions = [{ id: 'downloadBook', label: '已下载', enabled: false }];
owner.performAction('downloadBook');
assert.deepEqual(calls, ['downloadBook'], 'captured callback rechecks currently disabled action');
const stale = createReaderBuilderProbe(panelSource, boundedMembers(panelSource), { ...ui.deps, readerActionIcon },
  { ...ui.hooks, initialParams: { actions: [{ id: 'downloadBook', label: '下载全部章节' }], onAction: id => calls.push(id) } }).owner;
stale.initialRender();
const captured = ui.nodes(stale).find(node => node.type === 'Row' && node.accessibilityText?.startsWith('下载全部章节'));
assert.ok(captured);
stale.actions = [{ id: 'downloadBook', label: '已下载', enabled: false }];
captured.onClick();
assert.deepEqual(calls, ['downloadBook'], 'an old enabled native callback cannot dispatch the now disabled Panel action');
console.log('PASS manga book actions: exact snapshot coverage, single task slot, unchanged chapter actions, physical facts, actual SDK disabled row and dispatch');
