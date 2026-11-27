import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as display from '../../entry/src/main/ets/app/MangaDisplayLeaseCache.ts';
import { MangaRetainedTileCache } from '../../entry/src/main/ets/features/manga/application/MangaRetainedTileCache.ts';
import type { ReadingBodyImagePayload } from '../../entry/src/main/ets/platform/reading-resources/ReadingBodyImageHost.ts';

function payload(fileUri: string): ReadingBodyImagePayload {
  return { fileUri, width: 120, height: 180, intrinsicWidth: 120, intrinsicHeight: 180,
    regionY: 0, pixelMap: undefined, revision: 'test' };
}

test('prepared manga aliases are LRU-bounded while the visible tile retains its own file lease', () => {
  const files = new Map<string, number>();
  const retain = (image: ReadingBodyImagePayload): ReadingBodyImagePayload => {
    files.set(image.fileUri, (files.get(image.fileUri) ?? 0) + 1);
    return image;
  };
  const release = (fileUri: string): void => {
    const count = files.get(fileUri) ?? 0;
    assert.ok(count > 0, 'release owns a file lease');
    if (count === 1) files.delete(fileUri);
    else files.set(fileUri, count - 1);
  };
  const cache = new display.MangaDisplayLeaseCache(retain, release, 2);
  const viewport = new MangaRetainedTileCache(tile => { if (tile.image) release(tile.image.fileUri); });
  cache.publish('current', payload('file:///visible.png'));
  cache.publish('other', payload('file:///recent.png'));
  const image = cache.acquire('current', 0, false);
  assert.ok(image);
  assert.equal(viewport.keep('0:0', { ordinal: 0, tileIndex: 0, image }), true);
  const mounted = viewport.take('0:0');
  assert.equal(mounted?.image?.fileUri, 'file:///visible.png');

  cache.publish('prefetch', payload('file:///prefetch.png'));
  assert.equal(files.has('file:///recent.png'), false);
  cache.publish('future', payload('file:///future.png'));
  assert.equal(cache.acquire('current', 0, false), undefined);
  assert.equal(files.get('file:///visible.png'), 1);

  cache.close();
  assert.deepEqual([...files], [['file:///visible.png', 1]]);
  release(mounted!.image!.fileUri);
  assert.equal(files.size, 0);
});
