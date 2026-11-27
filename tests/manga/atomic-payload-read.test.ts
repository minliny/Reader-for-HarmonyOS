import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { bindMangaAtomicPayloadReader } from '../../entry/src/main/ets/platform/reading-resources/MangaAtomicPayloadPort.ts';

const harmonyPorts = new Map<string, string>([
  ['@ohos.app.ability.common', 'export default {};'],
  ['@ohos.file.fs', `
    import { access, mkdir, open, readdir, rename, stat, unlink } from 'node:fs/promises';
    const filesByFd = new Map();
    export default { access: path => access(path).then(() => true, () => false),
      async stat(path) {
        globalThis.readerAtomicStatCount++;
        await globalThis.readerBeforeAtomicStat?.(path);
        const info = await stat(path, { bigint: true });
        return { ino: info.ino, size: Number(info.size), mtimeNs: info.mtimeNs, ctimeNs: info.ctimeNs,
          isFile: () => info.isFile(), isDirectory: () => info.isDirectory() };
      },
      listFile: path => { globalThis.readerAtomicListCount++; return readdir(path); },
      OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
      mkdir: (path, recursive) => mkdir(path, { recursive }), rename, unlink,
      async open(path) { const handle = await open(path, 'w+'); filesByFd.set(handle.fd, handle); return handle; },
      async write(fd, bytes) { return (await filesByFd.get(fd).write(Buffer.from(bytes))).bytesWritten; },
      async fsync(fd) { await filesByFd.get(fd).sync(); },
      async close(handle) { filesByFd.delete(handle.fd); await handle.close(); },
      AtomicFile: class { readFully() { throw Error('SYNCHRONOUS_ATOMIC_READ'); } } };
  `],
  ['@ohos.file.statvfs', 'export default {};'],
  ['@ohos.security.cryptoFramework', `
    import { createHash } from 'node:crypto';
    export default { createMd: () => {
      const hash = createHash('sha256');
      return { update: ({ data }) => hash.update(data), digest: () => ({ data: hash.digest() }) };
    } };
  `],
  ['@ohos.util', `
    export default { LRUCache: class extends Map { constructor() { super(); } remove(key) { this.delete(key); } put(key, value) { this.set(key, value); } },
      TextEncoder: class { encodeInto(text) { return new TextEncoder().encode(text); } },
      TextDecoder: { create: (encoding, options) => {
        const decoder = new TextDecoder(encoding, options);
        return { decodeToString: bytes => decoder.decode(bytes) };
      } } };
  `],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const port = harmonyPorts.get(specifier);
    return port === undefined ? nextResolve(specifier, context) :
      { url: `data:text/javascript,${encodeURIComponent(port)}`, shortCircuit: true };
  },
});
const { ReadingImageDiskCache } =
  await import('../../entry/src/main/ets/platform/reading-resources/ReadingImageDiskCache.ts');
hooks.deregister();

const counters = globalThis as typeof globalThis & { readerAtomicStatCount: number; readerAtomicListCount: number;
  readerBeforeAtomicStat?: (path: string) => Promise<void> };
counters.readerAtomicStatCount = 0;
counters.readerAtomicListCount = 0;
const workerPaths: string[] = [];
const largeManifestBytes = 32 * 1024 * 1024 + 1;
bindMangaAtomicPayloadReader(async (path, expectedBytes, maximumBytes, current) => {
  assert.equal(current(), true);
  workerPaths.push(path);
  if (expectedBytes === largeManifestBytes) {
    assert.equal(maximumBytes, expectedBytes);
    throw new Error('LARGE_MANIFEST_REACHED_WORKER');
  }
  const bytes = await readFile(path);
  assert.equal(bytes.length, expectedBytes);
  assert.ok(bytes.length <= maximumBytes);
  return bytes;
});

async function withNovelChapter(work: (cache: InstanceType<typeof ReadingImageDiskCache>,
  chapter: { sourceId: string; bookId: string; chapterIndex: number; contentVersion: string },
  imageUrl: string, manifestPath: string, payloadPath: string, expected: Uint8Array) => Promise<void>): Promise<void> {
  workerPaths.length = 0;
  const filesDir = await mkdtemp(join(tmpdir(), 'reader-atomic-test-'));
  const cache = new ReadingImageDiskCache({ filesDir } as ConstructorParameters<typeof ReadingImageDiskCache>[0]);
  try {
    const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 1, contentVersion: 'v1' };
    const imageUrl = 'https://fixture.invalid/example.png';
    const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
    const bookHash = sha256(JSON.stringify([chapter.sourceId, chapter.bookId]));
    const resourceHash = sha256(JSON.stringify([chapter.contentVersion, imageUrl, '']));
    const root = join(filesDir, 'reader-offline', 'images-v2');
    const directory = join(root, bookHash, String(chapter.chapterIndex), sha256(chapter.contentVersion));
    const manifestPath = join(directory, 'manifest.json');
    const payloadPath = join(directory, `${resourceHash}.bin`);
    const expected = Uint8Array.of(29, 7, 85);
    await mkdir(directory, { recursive: true });
    await mkdir(join(root, '.clear'));
    await writeFile(join(root, '.clear', `${bookHash}.pending.legacy-revoked`), 'cleared');
    await writeFile(manifestPath, JSON.stringify({ ...chapter, formatVersion: 2, resourceHashes: [resourceHash] }));
    await writeFile(payloadPath, expected);

    await work(cache, chapter, imageUrl, manifestPath, payloadPath, expected);
  } finally {
    cache.close();
    await rm(filesDir, { recursive: true, force: true });
  }
}

test('novel chapter images and their ownership manifests use the asynchronous AtomicFile port', async () => {
  await withNovelChapter(async (cache, chapter, imageUrl, manifestPath, payloadPath, expected) => {
    assert.equal(await cache.isChapterComplete(chapter), true);
    const loaded = await cache.loadResource({ ...chapter, imageUrl });
    assert.deepEqual(Uint8Array.from(loaded ?? []), expected);
    assert.deepEqual(workerPaths, [manifestPath, manifestPath, payloadPath]);
  });
});

test('existing novel manifests above the image worker budget still reach the worker', async () => {
  await withNovelChapter(async (cache, chapter, imageUrl, manifestPath) => {
    // The stat and admission use the real size. The port stops before reading
    // the sparse fixture so the test allocates no large buffer.
    await truncate(manifestPath, largeManifestBytes);
    await assert.rejects(cache.loadResource({ ...chapter, imageUrl }), /LARGE_MANIFEST_REACHED_WORKER/);
  });
});

test('verified manga payload bytes are read once and returned to the decoder', async () => {
  workerPaths.length = 0;
  const filesDir = await mkdtemp(join(tmpdir(), 'reader-manga-atomic-test-'));
  const cache = new ReadingImageDiskCache({ filesDir } as ConstructorParameters<typeof ReadingImageDiskCache>[0]);
  try {
    const chapter = { sourceId: 'source', bookId: 'book', chapterId: 'chapter', chapterIndex: 0,
      contentVersion: 'v1', mangaDecodeRevision: 'identity-v1' };
    const resourceRef = 'manga:mp1:' + '1'.repeat(64);
    const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
    const bookHash = sha256(JSON.stringify([chapter.sourceId, chapter.bookId]));
    const resourceHash = sha256(JSON.stringify(['manga-resource-v1', chapter.contentVersion, resourceRef]));
    const directory = join(filesDir, 'reader-offline', 'images-v2', bookHash, '.manga',
      sha256(chapter.chapterId), sha256(chapter.contentVersion));
    const payloadPath = join(directory, `${resourceHash}.bin`);
    const expected = Uint8Array.of(29, 7, 85);
    await mkdir(directory, { recursive: true });
    await writeFile(payloadPath, expected);
    await writeFile(`${payloadPath}.sha256`, sha256(expected));

    const load = () => cache.loadResource({ ...chapter, resourceRef, imageUrl: 'https://fixture.invalid/example.png' });
    assert.deepEqual(Uint8Array.from(await load() ?? []), expected);
    assert.deepEqual(workerPaths, [`${payloadPath}.sha256`, payloadPath]);
    await writeFile(payloadPath, Uint8Array.of(37, 7, 85));
    await assert.rejects(load(), /MANGA_CACHE_RESOURCE_CORRUPT/);
  } finally {
    cache.close();
    await rm(filesDir, { recursive: true, force: true });
  }
});

test('the 1,000-file manga capacity ledger applies published files without rescanning until storage restore', async () => {
  const filesDir = await mkdtemp(join(tmpdir(), 'reader-manga-inventory-'));
  counters.readerAtomicStatCount = 0;
  counters.readerAtomicListCount = 0;
  const MiB = 1024 * 1024;
  const cache = new ReadingImageDiskCache({ filesDir } as ConstructorParameters<typeof ReadingImageDiskCache>[0],
    { getFreeBytes: async () => 512 * MiB, getTotalBytes: async () => 512 * MiB });
  try {
    const originals = join(filesDir, 'reader-offline', 'images-v2', 'fixture');
    const displayDir = join(filesDir, 'reader-manga-display-v1');
    await mkdir(originals, { recursive: true });
    await mkdir(displayDir);
    for (let start = 0; start < 1000; start += 20)
      await Promise.all(Array.from({ length: 20 }, (_, index) => writeFile(join(originals, `fixture-${start + index}.bin`), 'sample')));
    const chapter = { sourceId: 'source', bookId: 'book', chapterId: 'chapter', contentVersion: 'v1' };
    const derivedPath = join(displayDir, 'published.png');
    let published = false;
    cache.setMangaExternalStorage({
      tracksPublishedFiles: true,
      inventory: async () => published ? [{ path: derivedPath, owners: [chapter], live: false }] : [],
      remove: async () => assert.fail('this fixture has no authorized eviction'),
    });
    (await cache.reserveExternalWrite(chapter, MiB, 'foreground', 'derived')).release();
    assert.ok(counters.readerAtomicStatCount >= 1000);
    const coldLists = counters.readerAtomicListCount, coldStats = counters.readerAtomicStatCount;

    await writeFile(derivedPath, '');
    await truncate(derivedPath, 8 * MiB);
    published = true;
    await cache.recordMangaDisplayPublication([{ path: derivedPath, owners: [chapter], live: false }]);
    (await cache.reserveExternalWrite(chapter, MiB, 'foreground', 'derived')).release();
    assert.equal(counters.readerAtomicListCount, coldLists);
    assert.ok(counters.readerAtomicStatCount <= coldStats + 2);
    await assert.rejects(cache.reserveExternalWrite(chapter, 333 * MiB, 'foreground', 'derived'), /MANGA_CACHE_STORAGE_FULL/);
    assert.equal(counters.readerAtomicListCount, coldLists);

    await cache.storeResource({ ...chapter, chapterIndex: 0, baseUrl: chapter.chapterId,
      imageUrl: 'https://fixture.invalid/page.png', resourceRef: 'manga:mp1:' + '1'.repeat(64),
      mangaDecodeRevision: 'identity-v1' }, Uint8Array.of(1, 2, 3));
    const afterWriteLists = counters.readerAtomicListCount;
    assert.ok(afterWriteLists <= coldLists + 2, 'original store only checks its pending clear markers');
    (await cache.reserveExternalWrite(chapter, MiB, 'foreground', 'derived')).release();
    assert.equal(counters.readerAtomicListCount, afterWriteLists);

    await cache.withMangaStorageRestore(async () => { await writeFile(join(originals, 'restored.bin'), 'restored'); });
    (await cache.reserveExternalWrite(chapter, MiB, 'foreground', 'derived')).release();
    assert.ok(counters.readerAtomicListCount > coldLists);
    assert.ok(counters.readerAtomicStatCount >= coldStats + 1001);
  } finally {
    cache.close();
    await rm(filesDir, { recursive: true, force: true });
  }
});

function signal(): { wait: Promise<void>; send: () => void } {
  let send = (): void => {};
  const wait = new Promise<void>(resolve => { send = resolve; });
  return { wait, send };
}

test('a pending manga reservation observes files committed during its held classifier read', async () => {
  const filesDir = await mkdtemp(join(tmpdir(), 'reader-manga-publish-race-'));
  const MiB = 1024 * 1024;
  const cache = new ReadingImageDiskCache({ filesDir } as ConstructorParameters<typeof ReadingImageDiskCache>[0],
    { getFreeBytes: async () => 512 * MiB, getTotalBytes: async () => 512 * MiB });
  const statStarted = signal(), classifyStarted = signal(), finishStat = signal(), finishClassifier = signal();
  const chapter = { sourceId: 'source', bookId: 'book', chapterId: 'chapter', contentVersion: 'v1' };
  const derivedPath = join(filesDir, 'published.png');
  let pauseClassification = false;
  let published = false;
  try {
    cache.setMangaStorageAuthority({
      classify: async () => 'cache',
      async classifyBatch(chapters) {
        if (pauseClassification) {
          pauseClassification = false;
          classifyStarted.send();
          await finishClassifier.wait;
        }
        return chapters.map(() => 'cache');
      },
      candidates: async () => [],
      claim: async () => assert.fail('no eviction candidate exists'),
      complete: async () => assert.fail('no eviction grant exists'),
      pending: async () => [],
    });
    const displayFile = { path: derivedPath, owners: [chapter], live: false };
    cache.setMangaExternalStorage({
      tracksPublishedFiles: true,
      inventory: async () => published ? [displayFile] : [],
      remove: async () => assert.fail('no authorized removal'),
    });
    await cache.storeResource({ ...chapter, chapterIndex: 0, baseUrl: chapter.chapterId,
      imageUrl: 'https://fixture.invalid/page.png', resourceRef: 'manga:mp1:' + '2'.repeat(64),
      mangaDecodeRevision: 'identity-v1' }, Uint8Array.of(1, 2, 3));
    const existing = await cache.reserveExternalWrite(chapter, 8 * MiB, 'foreground', 'derived');
    const warmLists = counters.readerAtomicListCount;
    await writeFile(derivedPath, '');
    await truncate(derivedPath, 8 * MiB);
    published = true;
    counters.readerBeforeAtomicStat = async path => {
      if (path !== derivedPath) return;
      statStarted.send();
      await finishStat.wait;
    };

    const publication = cache.recordMangaDisplayPublication([displayFile]);
    await statStarted.wait;
    pauseClassification = true;
    const competing = cache.reserveExternalWrite(chapter, 333 * MiB, 'foreground', 'derived')
      .then(lease => lease.release());
    await classifyStarted.wait;
    finishStat.send();
    await publication;
    existing.release();
    finishClassifier.send();

    await assert.rejects(competing, /MANGA_CACHE_STORAGE_FULL/);
    assert.equal(counters.readerAtomicListCount, warmLists);
  } finally {
    finishStat.send();
    finishClassifier.send();
    counters.readerBeforeAtomicStat = undefined;
    cache.close();
    await rm(filesDir, { recursive: true, force: true });
  }
});
