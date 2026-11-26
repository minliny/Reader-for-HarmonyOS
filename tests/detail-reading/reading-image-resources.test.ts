import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  ReaderReadingImageResources, type ReaderGeometryImageResolution,
} from '../../entry/src/main/ets/features/reading/application/ReaderReadingImageResources.ts';
import type { ReadingSessionChapter, ReadingSessionImage } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';

function requested(startScalar: number, knownGeometry = true): ReadingSessionImage {
  return { source: knownGeometry ? `reader-local-epub://bG9jYWw6${'a'.repeat(86)}/Zm9v` : 'https://example.test/image',
    startScalar, endScalar: startScalar + 1, baseUrl: undefined, state: 'pending', pixelMap: undefined, fileUri: '',
    intrinsicWidth: knownGeometry ? 300 : 0, intrinsicHeight: knownGeometry ? 200 : 0, revision: 'pending' };
}

function ready(image: ReadingSessionImage, resource: string): ReadingSessionImage {
  return { ...image, state: 'ready', fileUri: resource, revision: 'ready' };
}

function chapter(images: ReadingSessionImage[], facts: Partial<ReadingSessionChapter> = {}): ReadingSessionChapter {
  return { sourceId: 'local', bookId: 'book', chapterIndex: 1, chapterTitle: 'Chapter', chapterUrl: undefined,
    content: 'Text', contentVersion: 'content', extractionVia: 'local', images, ...facts };
}

function resources(released: string[]): ReaderReadingImageResources {
  return new ReaderReadingImageResources({ releaseReadingImage: resource => { released.push(resource); } });
}

test('geometry request coalesces and publishes one acquired handle to matching held bodies at flush', async () => {
  const released: string[] = [];
  const images = resources(released);
  const pending = requested(2);
  const display = chapter([pending]);
  const neighbour = chapter([{ ...pending }]);
  const differentVersion = chapter([pending], { contentVersion: 'other' });
  const candidates = () => [display, neighbour, display, undefined, differentVersion];
  const load = Promise.withResolvers<ReadingSessionImage>();
  const finished = Promise.withResolvers<void>();
  let initiated = 0;
  const host: ReaderGeometryImageResolution = {
    captureCurrent: () => () => true,
    ownerCandidates: candidates,
    load: (_chapter, _image, current) => { assert.equal(current(), true); initiated += 1; return load.promise; },
    ready: () => finished.resolve(),
    fail: error => assert.fail(error.message),
  };
  images.resolveGeometry(display, pending, host);
  images.resolveGeometry(display, pending, host);
  assert.equal(initiated, 1);
  const resolved = ready(pending, 'one-image-lease');
  load.resolve(resolved);
  await finished.promise;
  assert.equal(display.images[0], pending);
  assert.equal(images.length, 0);
  assert.equal(images.flushGeometry(candidates, (origin, owners, result) => {
    assert.equal(origin, display);
    assert.deepEqual(owners, [display, neighbour]);
    assert.equal(display.images[0], resolved);
    assert.equal(neighbour.images[0], resolved);
    assert.equal(differentVersion.images[0], pending);
    assert.equal(result, resolved);
    return true;
  }), true);
  assert.equal(images.length, 1);
  images.close();
  assert.deepEqual(released, ['one-image-lease']);
});

test('stale geometry after resize or selection retirement releases the acquired handle without publication', async () => {
  for (const stale of ['resize', 'selection']) {
    const released: string[] = [];
    const images = resources(released);
    const image = requested(2);
    const display = chapter([image]);
    const read = Promise.withResolvers<ReadingSessionImage>();
    let current = true;
    images.resolveGeometry(display, image, {
      captureCurrent: () => () => current,
      ownerCandidates: () => [display],
      load: () => read.promise,
      ready: () => assert.fail('stale pixels queued for visible publication'),
      fail: error => assert.fail(error.message),
    });
    if (stale === 'resize') display.images[0] = { ...image, intrinsicWidth: 500 };
    else current = false;
    read.resolve(ready(image, stale));
    await setImmediate();
    assert.deepEqual(released, [stale]);
    assert.equal(images.flushGeometry(() => [display], () => assert.fail()), false);
    assert.equal(images.length, 0);
  }
});

test('geometry deferred across a frame is rechecked and never publishes into a retired owner', async () => {
  const released: string[] = [];
  const owner = resources(released);
  const image = requested(1);
  const display = chapter([image]);
  const finished = Promise.withResolvers<void>();
  let current = true;
  owner.resolveGeometry(display, image, { captureCurrent: () => () => current, ownerCandidates: () => [display],
    load: async () => ready(image, 'deferred'), ready: () => finished.resolve(), fail: error => assert.fail(error.message) });
  await finished.promise;
  current = false;
  assert.equal(owner.flushGeometry(() => [display], () => assert.fail('retired delayed image published')), false);
  assert.equal(display.images[0], image);
  owner.close();
  assert.deepEqual(released, ['deferred']);
});

test('close releases completed geometry ahead of existing leases and rejects an unfinished result', async () => {
  const released: string[] = [];
  const owner = resources(released);
  const first = requested(1), second = requested(2);
  const display = chapter([first, second]);
  owner.adopt(ready(first, 'previously displayed'));
  const firstReady = Promise.withResolvers<void>();
  const secondRead = Promise.withResolvers<ReadingSessionImage>();
  owner.resolveGeometry(display, first, {
    captureCurrent: () => () => true, ownerCandidates: () => [display], load: async () => ready(first, 'waiting frame'),
    ready: () => firstReady.resolve(), fail: error => assert.fail(error.message),
  });
  owner.resolveGeometry(display, second, {
    captureCurrent: () => () => true, ownerCandidates: () => [display], load: () => secondRead.promise,
    ready: () => assert.fail('closed owner published late request'), fail: error => assert.fail(error.message),
  });
  await firstReady.promise;
  owner.close();
  assert.deepEqual(released, ['waiting frame', 'previously displayed']);
  secondRead.resolve(ready(second, 'finished after close'));
  await setImmediate();
  owner.close();
  assert.deepEqual(released, ['waiting frame', 'previously displayed', 'finished after close']);
});

test('continuous unknown image requests deduplicate, update chapter indexes and reset on selection', async () => {
  const released: string[] = [];
  const owner = resources(released);
  const image = requested(2, false);
  const display = chapter([image]);
  owner.indexChapter(display);
  assert.equal(owner.atScalar(2), image);
  const read = Promise.withResolvers<ReadingSessionImage>();
  const expected = ready(image, 'continuous');
  let loads = 0;
  const host = { captureCurrent: () => () => true, resolveGeometry: () => assert.fail('image has unknown geometry'),
    load: () => { loads += 1; return read.promise; },
    admit: (requested: ReadingSessionImage, resolved: ReadingSessionImage): void => {
      assert.equal(owner.length, 1);
      assert.equal(owner.replacePending(display, true, requested, resolved), true);
    },
    fail: (error: Error): void => assert.fail(error.message),
  };
  owner.resolveContinuous(display, 2, host);
  owner.resolveContinuous(display, 2, host);
  assert.equal(loads, 1);
  read.resolve(expected);
  await setImmediate();
  assert.equal(owner.atScalar(2), expected);
  assert.equal(display.images[0], expected);
  owner.resetChapter();
  assert.equal(owner.atScalar(2), undefined);
  owner.close();
  assert.deepEqual(released, ['continuous']);
});

test('measurement request discards a stale unknown image before host deadline and publication hooks', async () => {
  const released: string[] = [];
  const owner = resources(released);
  const image = requested(2, false);
  const display = chapter([image]);
  const pending = Promise.withResolvers<ReadingSessionImage>();
  let current = true;
  const operation = owner.resolvePending(display, image, () => current, {
    load: () => pending.promise,
    admit: () => assert.fail('a retired measurement resumed'),
    fail: error => assert.fail(error.message),
  });
  current = false;
  pending.resolve(ready(image, 'late measurement'));
  await operation;
  assert.equal(owner.length, 0);
  assert.deepEqual(released, ['late measurement']);
});
