import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { ReadingOfflineGateway } = await import(
  '../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts'
);
const { RemoteReadingFlowGateway } = await import(
  '../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts'
);

const SOURCE_ID = 'offline-source';
const BOOK_ID = '/offline-book';
const calls = [];
const persistedImages = [];
const completedManifests = new Set();
let failImage = false;

const session = {
  acquisitionMode: 'online',
  identity: { sourceId: SOURCE_ID, bookId: BOOK_ID },
  detailUrl: BOOK_ID,
  tocUrl: '/toc',
  book: { title: 'Offline Book', author: 'Author' },
  continuationVariables: [],
  entries: [
    { index: 0, title: 'Chapter 0', url: '/chapter/0', variables: [] },
    { index: 1, title: 'Chapter 1', url: '/chapter/1', variables: [] },
  ],
  hostRequirements: [],
};

class FakeRuntime {
  async request(method, params = {}, options = {}) {
    calls.push({ method, params, options });
    assert.equal(options.shouldCancel?.(), false);
    if (method === 'cache.book.prefetch') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterRange: params.chapterRange,
        chapterCount: 2,
        prefetchedCount: 2,
      } };
    }
    if (method === 'chapter.content') {
      if (params.chapterIndex === 0) {
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          chapterTitle: 'Chapter 0',
          content: `before\uFFFCafter`,
          blocks: [
            { kind: 'text', text: 'before', startScalar: 0, endScalar: 6 },
            { kind: 'image', source: 'images/a.webp', startScalar: 6, endScalar: 7 },
            { kind: 'text', text: 'after', startScalar: 7, endScalar: 12 },
          ],
          via: 'cache',
          http: { finalUrl: 'https://fixture.invalid/chapter/0' },
        } };
      }
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterTitle: 'Chapter 1',
        content: 'text only',
        via: 'cache',
      } };
    }
    if (method === 'cache.book.status') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        tocAvailable: true,
        chapters: [
          { chapterIndex: 0, title: 'Chapter 0', url: '/chapter/0', state: 'completed' },
          { chapterIndex: 1, title: 'Chapter 1', url: '/chapter/1', state: 'completed' },
        ],
      } };
    }
    if (method === 'cache.clear') {
      assert.deepEqual(params, { scope: 'book', sourceId: SOURCE_ID, bookId: BOOK_ID });
      return { data: { scope: 'book' } };
    }
    throw new Error(`unexpected command: ${method}`);
  }

  async prefetchReadingImage(identity, shouldCancel) {
    assert.equal(shouldCancel?.(), false);
    if (failImage) {
      throw new Error('fixture image unavailable');
    }
    persistedImages.push(identity);
  }

  async markOfflineImageChapterComplete(chapter, resources) {
    assert.equal(resources.length, chapter.chapterIndex === 0 ? 1 : 0);
    completedManifests.add(chapter.chapterIndex);
  }

  async isOfflineImageChapterMaterialized(_sourceId, _bookId, chapterIndex) {
    return completedManifests.has(chapterIndex);
  }

  async clearOfflineBookImages(sourceId, bookId) {
    assert.equal(sourceId, SOURCE_ID);
    assert.equal(bookId, BOOK_ID);
    completedManifests.clear();
  }
}

const runtime = new FakeRuntime();
const gateway = new ReadingOfflineGateway(runtime);
const projection = await gateway.prefetchRange(session, 0, 2, () => true);
assert.deepEqual(projection.map((entry) => entry.downloadState), ['completed', 'completed']);
assert.equal(persistedImages.length, 1);
assert.equal(persistedImages[0].imageUrl, 'images/a.webp');
assert.equal(persistedImages[0].baseUrl, 'https://fixture.invalid/chapter/0');
assert.deepEqual(calls.find((call) => call.method === 'cache.book.prefetch').params.chapterRange, [0, 2]);

completedManifests.clear();
failImage = true;
await assert.rejects(() => gateway.prefetchRange(session, 0, 1, () => true), /fixture image unavailable/);
assert.equal(completedManifests.has(0), false, 'a failed image must not publish chapter completion');
failImage = false;
const retryProjection = await gateway.prefetchRange(session, 0, 1, () => true);
assert.equal(retryProjection[0].downloadState, 'completed');

await gateway.clearBook(session, () => true);
assert.equal(completedManifests.size, 0);

let offlineChapterRequests = 0;
const cachedRuntime = {
  async request(method) {
    if (method === 'cache.book.status') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        tocAvailable: true,
        chapters: [
          { chapterIndex: 0, title: 'Chapter 0', url: '/chapter/0', state: 'missing' },
        ],
      } };
    }
    if (method === 'chapter.content') {
      offlineChapterRequests += 1;
    }
    throw new Error(`unexpected command: ${method}`);
  },
};
const remote = new RemoteReadingFlowGateway(cachedRuntime);
const cachedSession = await remote.openCachedSession({
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  detailUrl: BOOK_ID,
  title: 'Offline Book',
  author: 'Author',
});
assert.equal(cachedSession.acquisitionMode, 'offline');
await assert.rejects(() => remote.loadChapter(cachedSession, 0), /REMOTE_CHAPTER_NOT_DOWNLOADED/);
assert.equal(offlineChapterRequests, 0, 'offline missing body must fail before chapter.content and Host HTTP');

console.log('reading offline gateway deterministic runtime: PASS');
