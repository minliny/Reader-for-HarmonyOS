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
    import { access, readdir, stat } from 'node:fs/promises';
    export default { access: path => access(path).then(() => true, () => false), stat, listFile: readdir,
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
    export default { LRUCache: class extends Map { constructor() { super(); } },
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
