import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {selectedProductionMethods} from '../../lib/selected-production-methods.mjs';

const source = new URL(
  '../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',
  import.meta.url,
);

test('source projection keeps large arrays out of state and caches group options by source identity', () => {
  const production = readFileSync(source, 'utf8');
  assert.match(production, /private projectedSources: BookSource\[\] = \[\];/u);
  assert.doesNotMatch(production, /@State\s+private\s+projectedSources\b/u);
  assert.match(production, /@State\s+private\s+projectedSourceCount: number = 0;/u);
  assert.match(production, /@State\s+private\s+projectedEnabledSourceCount: number = 0;/u);

  const Page = selectedProductionMethods(source, 'SourceManagementPage', [
    'groupOptions',
    'normalizedSourceGroup',
  ]);
  const page = new Page();
  const sources = [
    {group:'Phase1 Group A'},
    {group:' Phase1 Group A '},
    {group:''},
    {group:'全部分组'},
    {group:'Phase1 Group B'},
  ];
  page.sources = sources;
  page.groupOptionsCache = [];
  page.groupOptionsCacheSource = undefined;
  let normalized = 0;
  page.normalizedSourceGroup = value => {
    normalized += 1;
    return value.group?.trim() ?? '';
  };

  assert.deepEqual(page.groupOptions(), ['全部分组', 'Phase1 Group A', 'Phase1 Group B']);
  assert.equal(normalized, sources.length);
  assert.deepEqual(page.groupOptions(), ['全部分组', 'Phase1 Group A', 'Phase1 Group B']);
  assert.equal(normalized, sources.length, 'the same source array reuses its cached groups');

  page.sources = sources.map(item => ({...item}));
  assert.deepEqual(page.groupOptions(), ['全部分组', 'Phase1 Group A', 'Phase1 Group B']);
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

test('source statistics observe list reloads and enabled changes without observing rows', () => {
  const Page = selectedProductionMethods(source, 'SourceManagementPage', ['rebuildSourceProjection', 'statsText']);
  const page = new Page();
  page.lastProjectionFilterKey = '';
  page.verificationFilterRevision = 0;
  page.currentFilterKey = () => 'test';
  page.sources = [{enabled:false}, {enabled:true}];
  let projected = page.sources;
  page.filteredSources = () => projected;
  page.scheduleSourceAnchorRestore = () => {};
  page.observeVerificationProjection = () => {};
  page.sourceDataSource = { replace(rows) { assert.equal(rows, projected); } };
  Object.defineProperty(page, 'projectedSources', {
    set(rows) { assert.equal(rows, projected); },
    get() { assert.fail('Statistics must subscribe to observable counts'); },
  });

  page.rebuildSourceProjection('owner-update');
  assert.equal(page.statsText(), '2 个书源 · 1 个启用');
  projected = [{enabled:true}, {enabled:true}];
  page.rebuildSourceProjection('owner-update');
  assert.equal(page.statsText(), '2 个书源 · 2 个启用');
  projected = [];
  page.rebuildSourceProjection('edit');
  assert.equal(page.statsText(), '显示 0/2 个书源 · 0 个启用');
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
