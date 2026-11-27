import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookSource } from '../../entry/src/main/ets/features/source/application/SourceGateway.ts';
import { SourceListIndex, SourceListPublication } from
  '../../entry/src/main/ets/features/source/presentation/SourceListPublication.ts';

test('a 1,951-source publication does linear identity work and retains identical rows', () => {
  let identityReads = 0;
  const rows = Array.from({ length: 1951 }, (_, index): BookSource => ({
    get sourceId() { identityReads += 1; return `source-${index}`; },
    name: `Source ${index}`,
    baseUrl: `https://source-${index}.test/`,
    enabled: true,
    enabledExplore: false,
    category: 'novel',
    checkLevels: [],
    checkReports: [],
  }));
  const lookup = new SourceListIndex(rows);
  for (let index = 0; index < rows.length; index += 1) {
    assert.equal(lookup.get(`source-${index}`), rows[index]);
  }
  assert.ok(identityReads <= rows.length * 2, `${identityReads} source identity reads`);

  const publication = new SourceListPublication();
  const first = publication.accept(rows);
  const refreshed = rows.map((row): BookSource => ({ ...row, checkLevels: [], checkReports: [] }));
  assert.equal(publication.accept(refreshed), first);
  refreshed[1403].enabled = false;
  const changed = publication.accept(refreshed);
  assert.notEqual(changed, first);
  assert.equal(changed[1403].enabled, false);
  assert.equal(changed[1402], first[1402]);
  assert.equal(changed[1404], first[1404]);
});

test('source checks in one publication window emit only the newest facts and retirement invalidates them', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const publication = new SourceListPublication();
  const snapshots: string[] = [];
  publication.defer(() => snapshots.push('first'));
  publication.defer(() => snapshots.push('newest'));
  t.mock.timers.tick(99);
  assert.deepEqual(snapshots, []);
  t.mock.timers.tick(1);
  assert.deepEqual(snapshots, ['newest']);
  publication.defer(() => snapshots.push('retired'));
  publication.cancelDeferred();
  t.mock.timers.tick(100);
  assert.deepEqual(snapshots, ['newest']);
});
