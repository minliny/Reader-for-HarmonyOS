import assert from 'node:assert/strict';
import test from 'node:test';
import { journeys } from '../../scripts/lib/vm-journey-cases.mjs';
import { affectedHostDomains, suggestedVmJourneys } from '../../scripts/test-host.mjs';

const featurePath = (feature: string) => `entry/src/main/ets/features/${feature}/Example.ts`;
const featureImpact: [string, string[], string[]][] = [
  ['bookshelf', ['bookshelf', 'contracts', 'detail-reading', 'downloads', 'search'], ['J1', 'J2', 'J3']],
  ['discover', ['bookshelf', 'search'], ['J7', 'J8']],
  ['downloads', ['downloads', 'manga', 'navigation-geometry'], ['J5']],
  ['manga', ['detail-reading', 'downloads', 'manga', 'navigation-geometry', 'source-switch'], ['J6']],
  ['reading', ['bookshelf', 'detail-reading', 'downloads', 'manga', 'navigation-geometry', 'settings-sync-rss', 'source-switch'],
    ['J2', 'J4', 'J6', 'J8']],
  ['rss', ['navigation-geometry', 'settings-sync-rss'], ['J7', 'J8']],
  ['search', ['bookshelf', 'contracts', 'detail-reading', 'navigation-geometry', 'search', 'source-switch'], ['J2', 'J3', 'J6', 'J8']],
  ['settings', ['navigation-geometry', 'settings-sync-rss'], ['J7', 'J8']],
  ['source', ['bookshelf', 'contracts', 'search', 'source-management', 'source-switch'], ['J2', 'J6', 'J7']],
  ['sync', ['settings-sync-rss'], ['J7', 'J8']],
];

test('feature paths select their Host domains and recommend existing VM journeys', () => {
  const mappedJourneys = new Set<string>();
  for (const [feature, domains, expectedJourneys] of featureImpact) {
    const paths = [featurePath(feature)];
    assert.deepEqual(affectedHostDomains(paths), domains, feature);
    const suggested = suggestedVmJourneys(paths);
    assert.deepEqual(suggested, expectedJourneys, feature);
    for (const journey of suggested) mappedJourneys.add(journey);
  }
  assert.deepEqual([...mappedJourneys].sort(), Object.keys(journeys).sort());
});

test('documentation is ignored and test changes select their Host domain without VM journeys', () => {
  const docs = ['README.md', 'docs/example.json', '.reader-artifacts/result.json'];
  const tests = ['tests/delivery/verification-impact.test.ts', 'tests/search/search.test.ts'];
  assert.deepEqual(affectedHostDomains(docs), []);
  assert.deepEqual(affectedHostDomains([...docs, ...tests]), ['delivery', 'search']);
  assert.deepEqual(suggestedVmJourneys([...docs, ...tests, 'tests/new-domain/helper.ts']), []);
  assert.deepEqual(suggestedVmJourneys([]), []);
});

test('combined feature and test changes keep recommendations sorted and deduplicated', () => {
  const paths = [featurePath('reading'), 'tests/delivery/verification-impact.test.ts',
    featurePath('downloads'), featurePath('reading'), 'README.md'];
  assert.deepEqual(affectedHostDomains(paths), [
    'bookshelf', 'delivery', 'detail-reading', 'downloads', 'manga', 'navigation-geometry', 'settings-sync-rss', 'source-switch',
  ]);
  assert.deepEqual(suggestedVmJourneys(paths), ['J2', 'J4', 'J5', 'J6', 'J8']);
});

test('shared or unfamiliar paths select all Host domains and journeys from the VM catalog', () => {
  const allDomains = ['bookshelf', 'contracts', 'delivery', 'detail-reading', 'downloads', 'manga', 'navigation-geometry',
    'search', 'settings-sync-rss', 'source-management', 'source-switch'];
  const sharedPaths = ['entry/src/main/ets/ui/layout/LayoutInvariantEvaluator.ts', 'entry/src/main/ets/app/ReaderApp.ets',
    'entry/src/main/ets/pages/Index.ets', 'build-profile.json5', 'scripts/test-host.mjs', featurePath('unfamiliar')];
  for (const path of sharedPaths) {
    const paths = [featurePath('downloads'), path, 'README.md'];
    assert.deepEqual(affectedHostDomains(paths), allDomains, path);
    assert.deepEqual(suggestedVmJourneys(paths), Object.keys(journeys), path);
  }
});
