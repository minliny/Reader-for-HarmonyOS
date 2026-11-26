import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {selectedProductionMethods} from '../../lib/selected-production-methods.mjs';
import {projectSourceManagementV9, sourceV9Supports} from '../../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';

const source = new URL(
  '../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',
  import.meta.url,
);

test('source projection keeps large arrays out of state and caches group options by source identity', () => {
  const production = readFileSync(source, 'utf8');
  assert.match(production, /private projectedSources: BookSource\[\] = \[\];/u);
  assert.doesNotMatch(production, /@State\s+private\s+projectedSources\b/u);
  assert.match(production, /@State\s+private\s+projectedSourceCount: number = 0;/u);
  assert.match(production, /@State\s+private\s+statusCounts: SourceV9Counts/u);

  const Page = selectedProductionMethods(source, 'SourceManagementPage', [
    'groupOptions',
    'normalizedSourceGroup',
  ], {sourceV9Supports});
  const page = new Page();
  const sources = [
    {group:'Phase1 Group A'},
    {group:' Phase1 Group A '},
    {group:''},
    {group:'全部分组'},
    {group:'Phase1 Group B'},
  ];
  page.sources = sources.map(value => ({...value, category: 'novel'}));
  page.catalogGroupNames = [];
  page.groupOptionsCache = [];
  page.groupOptionsCacheSource = undefined;
  let normalized = 0;
  page.normalizedSourceGroup = value => {
    normalized += 1;
    return value.group?.trim() ?? '';
  };

  assert.deepEqual(page.groupOptions(), ['全部分组', '未分组', 'Phase1 Group A', 'Phase1 Group B']);
  assert.equal(normalized, sources.length);
  assert.deepEqual(page.groupOptions(), ['全部分组', '未分组', 'Phase1 Group A', 'Phase1 Group B']);
  assert.equal(normalized, sources.length, 'the same source array reuses its cached groups');

  page.sources = page.sources.map(item => ({...item}));
  assert.deepEqual(page.groupOptions(), ['全部分组', '未分组', 'Phase1 Group A', 'Phase1 Group B']);
  assert.equal(normalized, sources.length * 2, 'a new source array invalidates the cache');
});

test('source projection coalesces same-frame owner updates into one rebuild', async () => {
  const Page = selectedProductionMethods(source, 'SourceManagementPage', ['onSourcesChanged']);
  const page = new Page();
  page.groupOptionsCacheSource = ['stale'];
  page.projectionRebuildPending = false;
  page.mounted = true;
  let rebuilds = 0;
  let observations = 0;
  page.rebuildSourceProjection = trigger => {
    rebuilds += 1;
    assert.equal(trigger, 'owner-update');
  };
  page.scheduleImportStatusReadyObservation = () => {
    observations += 1;
  };

  page.onSourcesChanged();
  page.onSourcesChanged();
  page.onSourcesChanged();
  assert.equal(page.groupOptionsCacheSource, undefined);
  assert.equal(page.projectionRebuildPending, true);
  assert.equal(observations, 3);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(rebuilds, 1);
  assert.equal(page.projectionRebuildPending, false);
});

test('filtered empty state follows the observable projection count during clear and edit', () => {
  const Page = selectedProductionMethods(source, 'SourceManagementPage', ['hasFilteredEmpty']);
  const page = new Page();
  page.hasReadableSources = true;
  page.sources = [{sourceId:'fixture'}];
  page.projectedSources = [];
  page.sourceListLoading = () => false;
  page.hasPendingSourceRecovery = () => false;

  page.projectedSourceCount = 0;
  assert.equal(page.hasFilteredEmpty(), true);
  page.projectedSourceCount = 1;
  assert.equal(page.hasFilteredEmpty(), false);
  page.projectedSourceCount = 0;
  assert.equal(page.hasFilteredEmpty(), true);
  page.hasPendingSourceRecovery = () => true;
  assert.equal(page.hasFilteredEmpty(), false);
});

test('source status chips observe list reloads, enabled changes and filter scope', () => {
  const Page = selectedProductionMethods(source, 'SourceManagementPage',
    ['rebuildSourceProjection', 'filterProjection', 'statusCount'], {projectSourceManagementV9, sourceV9Supports});
  const page = new Page();
  Object.assign(page, { lastProjectionFilterKey: '', verificationFilterRevision: 0,
    searchQuery: '', categoryValue: 'all', statusValue: '全部', groupValue: '全部分组',
    currentFilterKey: () => page.searchQuery, scheduleSourceAnchorRestore() {}, observeVerificationProjection() {},
  });
  const base = {category:'novel', baseUrl:'https://a.example.test'};
  page.sources = [{...base, sourceId:'a', name:'a', enabled:false}, {...base, sourceId:'b', name:'b', enabled:true}];
  page.sourceDataSource = { replace(rows) {
    assert.equal(rows, page.projectedSources, 'published row order is current before LazyForEach reload');
  } };

  page.rebuildSourceProjection('owner-update');
  assert.deepEqual(['all', 'enabled', 'disabled', 'error'].map(id => page.statusCount(id)), [2, 1, 1, 0]);
  page.sources = page.sources.map(value => ({...value, enabled:true}));
  page.rebuildSourceProjection('owner-update');
  assert.deepEqual(['all', 'enabled', 'disabled', 'error'].map(id => page.statusCount(id)), [2, 2, 0, 0]);
  page.statusValue = '已停用';
  page.rebuildSourceProjection('status');
  assert.equal(page.projectedSourceCount, 0);
  assert.equal(page.statusCount('all'), 2, 'status selection preserves the other chip counts');
  page.searchQuery = 'missing';
  page.rebuildSourceProjection('edit');
  assert.equal(page.statusCount('all'), 0);
});

test('controlled source input ignores the clear echo and retains real edit and submit handling', () => {
  const Page = selectedProductionMethods(source, 'SourceManagementPage', ['applySourceSearchInput']);
  const page = new Page();
  page.appForeground = true;
  page.groupOpen = false;
  page.searchQuery = '';
  page.sourceSearchInputIdentity = () => 'current';
  page.managementOpeningIsCurrent = () => true;
  const edits = [];
  page.cancelToolsReturnFocus = trigger => edits.push(['focus',trigger]);
  page.rebuildSourceProjection = trigger => edits.push(['projection',trigger]);

  page.applySourceSearchInput('current', '');
  page.applySourceSearchInput('expired', 'old');
  assert.deepEqual(edits, []);
  page.applySourceSearchInput('current', 'Phase1');
  assert.equal(page.searchQuery, 'Phase1');
  page.applySourceSearchInput('current', 'Phase1');
  page.applySourceSearchInput('current');
  assert.deepEqual(edits, [['focus','edit'], ['projection','edit'], ['projection','edit']]);
});
