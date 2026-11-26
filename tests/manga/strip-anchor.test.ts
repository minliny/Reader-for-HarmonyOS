import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MangaStripProjection } from '../../entry/src/main/ets/features/manga/ui/MangaStripProjection.ts';
import type { MangaManifest } from '../../entry/src/main/ets/features/manga/application/MangaContract.ts';

test('a tall image maps its bottom anchor to its final tile without changing row identity on an equal-size decode', () => {
  const projection = new MangaStripProjection();
  const manifest = { manifestVersion: 'v1', pages: [{ ordinal: 0, pageId: 'real-page' }] } as MangaManifest;
  const size = () => ({ width: 600, height: 2100, tileHeight: 800 });
  assert.equal(projection.publish(manifest, size), true);
  assert.equal(projection.totalCount(), 3);
  assert.equal(projection.index(0, 1), 2);
  assert.deepEqual(projection.row(2), { key: 'real-page:2', ordinal: 0, tileIndex: 2,
    width: 600, height: 500, sourceY: 1600, sourceHeight: 2100, known: true });
  assert.equal(projection.position(2, 250, 300), 1);
  assert.equal(projection.publish(manifest, size), false);
  assert.equal(projection.row(2).key, 'real-page:2');
});

test('an unloaded image cannot claim a viewport-derived progress position', () => {
  const projection = new MangaStripProjection();
  const manifest = { manifestVersion: 'v1', pages: [{ ordinal: 0, pageId: 'remote-page' }] } as MangaManifest;
  projection.publish(manifest, () => undefined);
  assert.equal(projection.row(0).known, false);
  assert.throws(() => projection.position(0, 240, 300), /MANGA_GEOMETRY_REQUIRED/);
});
