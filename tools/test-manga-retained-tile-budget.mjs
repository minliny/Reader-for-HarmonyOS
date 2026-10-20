import assert from 'node:assert/strict';
import { MangaRetainedTileCache } from './lib/manga-retained-tile-cache-probe.mjs';

function tile(ordinal, tileIndex = 0, size = 10) {
  return { ordinal, tileIndex, image: { fileUri: `file://${ordinal}:${tileIndex}`, width: size, height: size, revision: 'test' } };
}

// Per-chapter count is an LRU boundary; touching an entry protects it from the
// next eviction, and the ordinal index follows take/evict/clear operations.
{
  const released = [];
  const cache = new MangaRetainedTileCache(value => released.push(value.image.fileUri), {
    chapterMaxCount: 3, chapterMaxBytes: 100000, globalMaxCount: 20, globalMaxBytes: 1000000,
  });
  cache.keep('0:0', tile(0)); cache.keep('1:0', tile(1)); cache.keep('2:0', tile(2));
  assert.equal(cache.hasPage(0), true); assert.equal(cache.hasPage(1), true);
  assert.equal(cache.get('0:0')?.ordinal, 0, 'get returns and touches a retained lease');
  cache.keep('3:0', tile(3));
  assert.equal(cache.get('1:0'), undefined, 'least recently used lease is evicted first');
  assert.equal(cache.get('0:0')?.ordinal, 0, 'recently touched lease survives');
  assert.equal(cache.hasPage(1), false, 'ordinal index removes evicted page');
  assert.deepEqual(released, ['file://1:0']);
  assert.equal(cache.bytes, 3 * 10 * 10 * 4);
  assert.equal(cache.take('0:0')?.ordinal, 0); assert.equal(cache.hasPage(0), false);
  cache.clear(); cache.clear(); assert.deepEqual(released.sort(), ['file://1:0', 'file://2:0', 'file://3:0']);
}
console.log('PASS retained chapter count boundary, LRU touch, bytes and ordinal index');

// Byte budget evicts complete leases without deleting durable source files.
{
  const released = [];
  const cache = new MangaRetainedTileCache(value => released.push(value.image.fileUri), {
    chapterMaxCount: 20, chapterMaxBytes: 800, globalMaxCount: 20, globalMaxBytes: 1000000,
  });
  cache.keep('0:0', tile(0)); cache.keep('1:0', tile(1)); cache.keep('2:0', tile(2));
  assert.equal(cache.length, 2); assert.equal(cache.bytes, 800);
  assert.deepEqual(released, ['file://0:0']);
  cache.clear(); assert.equal(released.filter(value => value === 'file://1:0').length, 1);
  assert.equal(released.filter(value => value === 'file://2:0').length, 1);
}
console.log('PASS retained decoded-byte budget releases the oldest derived lease once');

// Current/neighbor protection skips a finite set, while an unprotected old
// page remains evictable. Protection never relaxes the hard boundary.
{
  const released = [];
  const cache = new MangaRetainedTileCache(value => released.push(value.image.fileUri), {
    chapterMaxCount: 2, chapterMaxBytes: 100000, globalMaxCount: 20, globalMaxBytes: 1000000,
    isProtected: value => value.ordinal === 0,
  });
  cache.keep('0:0', tile(0)); cache.keep('1:0', tile(1)); cache.keep('2:0', tile(2));
  assert.equal(cache.get('0:0')?.ordinal, 0); assert.equal(cache.get('1:0'), undefined);
  assert.ok(cache.get('2:0')); assert.equal(released.filter(value => value === 'file://1:0').length, 1);
  cache.clear();
}
console.log('PASS protected current/neighbor lease survives while an unprotected LRU is evicted');

// Global count is shared across live chapter caches and chooses the oldest
// unprotected lease regardless of which chapter owns it.
{
  const released = [];
  const options = { chapterMaxCount: 20, chapterMaxBytes: 100000, globalMaxCount: 3, globalMaxBytes: 1000000 };
  const first = new MangaRetainedTileCache(value => released.push(value.image.fileUri), options);
  const second = new MangaRetainedTileCache(value => released.push(value.image.fileUri), options);
  first.keep('0:0', tile(0)); first.keep('1:0', tile(1)); second.keep('2:0', tile(2)); second.keep('3:0', tile(3));
  assert.equal(first.length + second.length, 3);
  assert.deepEqual(released, ['file://0:0']);
  first.clear(); second.clear();
}
console.log('PASS global retained count boundary evicts the oldest lease across chapters');

{
  const released = [];
  const cache = new MangaRetainedTileCache(value => released.push(value.image.fileUri), {
    chapterMaxCount: 1, chapterMaxBytes: 400, globalMaxCount: 1, globalMaxBytes: 400,
    isProtected: () => true,
  });
  const first = tile(0), incoming = tile(1), replacement = tile(0, 0, 11);
  assert.equal(cache.keep('0:0', first), true);
  assert.equal(cache.keep('1:0', incoming), false, 'protected ownership must reject rather than exceed count/bytes');
  assert.equal(cache.keep('0:0', replacement), false, 'oversized replacement keeps the prior lease intact');
  assert.equal(cache.length, 1); assert.equal(cache.bytes, 400);
  assert.equal(cache.get('0:0'), first); assert.equal(cache.hasPage(1), false);
  assert.deepEqual(released, [], 'rejected leases remain caller-owned');
  cache.clear(); cache.clear(); assert.deepEqual(released, ['file://0:0']);
}
console.log('PASS protected and oversized admission rejects without ownership transfer or hard-budget overflow');

{
  const released = [];
  const options = { chapterMaxCount: 20, chapterMaxBytes: 100000, globalMaxCount: 20, globalMaxBytes: 800,
    isProtected: () => true };
  const first = new MangaRetainedTileCache(value => released.push(value), options);
  const second = new MangaRetainedTileCache(value => released.push(value), options);
  const a = tile(0), b = tile(1), c = tile(2);
  assert.equal(first.keep('0:0', a), true); assert.equal(first.keep('1:0', b), true);
  assert.equal(second.keep('2:0', c), false, 'a second protected chapter cannot bypass the shared byte limit');
  assert.equal(first.bytes + second.bytes, 800); assert.equal(second.length, 0);
  const taken = first.take('0:0'); assert.equal(taken, a);
  assert.equal(second.keep('2:0', c), true, 'promotion out of retention makes shared capacity available');
  first.clear(); second.clear(); assert.deepEqual(released, [b, c]);
}
console.log('PASS shared byte budget rejects across chapters and resumes after ownership promotion');
