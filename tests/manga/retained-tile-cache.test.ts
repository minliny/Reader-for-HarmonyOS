import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MangaRetainedTileCache } from '../../entry/src/main/ets/features/manga/application/MangaRetainedTileCache.ts';
import type { MangaTile } from '../../entry/src/main/ets/features/manga/application/MangaSessionController.ts';
import { MangaNeighborMemoryAdmission } from '../../entry/src/main/ets/app/ReaderMemoryTrim.ts';

function tile(ordinal: number, width: number = 20, height: number = 30): MangaTile {
  return { ordinal, tileIndex: 0, image: { pixelMap: undefined,
    fileUri: `file:///tile-${ordinal}.png`, width, height, revision: 'test' } };
}

test('memory trimming releases unprotected manga tiles across chapter caches and preserves viewport leases', () => {
  const released: number[] = [];
  const first = new MangaRetainedTileCache(value => { released.push(value.ordinal); }, {
    isProtected: value => value.ordinal === 1,
  });
  const other = new MangaRetainedTileCache(value => { released.push(value.ordinal); });
  try {
    assert.equal(first.keep('1:0', tile(1)), true);
    assert.equal(first.keep('2:0', tile(2)), true);
    assert.equal(other.keep('3:0', tile(3)), true);

    MangaRetainedTileCache.trimUnprotectedAll();

    assert.deepEqual(released.sort(), [2, 3]);
    assert.equal(first.get('1:0')?.ordinal, 1);
    assert.equal(first.hasPage(2), false);
    assert.equal(first.length, 1);
    assert.equal(first.bytes, 2400);
    assert.equal(other.length, 0);

    MangaRetainedTileCache.trimUnprotectedAll();
    assert.deepEqual(released, [2, 3]);
  } finally {
    first.clear();
    other.clear();
  }
});

test('low and critical memory reduce future retention without releasing protected tiles', () => {
  const released: number[] = [];
  const cache = new MangaRetainedTileCache(value => { released.push(value.ordinal); }, {
    chapterMaxCount: 4, isProtected: value => value.ordinal === 1,
  });
  try {
    assert.equal(cache.keep('1:0', tile(1)), true);
    MangaRetainedTileCache.setMemoryBudget('low');
    assert.equal(cache.keep('2:0', tile(2)), true);
    assert.equal(cache.keep('3:0', tile(3)), true);
    assert.deepEqual(released, [2]);

    MangaRetainedTileCache.setMemoryBudget('critical');
    MangaRetainedTileCache.trimUnprotectedAll();
    assert.equal(cache.keep('4:0', tile(4)), false);
    assert.equal(cache.get('1:0')?.ordinal, 1);
    assert.deepEqual(released, [2, 3]);

    MangaRetainedTileCache.setMemoryBudget('normal');
    assert.equal(cache.keep('4:0', tile(4)), true);
  } finally {
    MangaRetainedTileCache.setMemoryBudget('normal');
    cache.clear();
  }
});

test('low memory retires old optional manga work even if pressure recovers before its callback', () => {
  const admission = new MangaNeighborMemoryAdmission();
  const queued = admission.capture(() => true);
  assert.equal(queued(), true);

  admission.update('low');
  assert.equal(queued(), false);
  const denied = admission.capture(() => true);
  admission.update('moderate');
  assert.equal(queued(), false);
  assert.equal(denied(), false);
  assert.equal(admission.capture(() => true)(), true);
});
