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
const {
  assertReadingOfflineWriteCapacity,
  ReadingOfflineMaterializationError,
} = await import(
  '../entry/src/main/ets/features/reading/ReadingOfflineContract.ts'
);

const SOURCE_ID = 'offline-source';
const BOOK_ID = '/offline-book';
const calls = [];
const persistedImages = [];
const completedManifests = new Set();
const coreStates = ['missing', 'missing'];
const coreCachedBytes = [0, 0];
const materializationReports = [];
let materializationGeneration = 0;
let failImage = false;
let dropNextReportResult = false;
let supersedeAfterImage = false;
let requestCurrent = true;

assert.doesNotThrow(() => assertReadingOfflineWriteCapacity(48, 16, 32));
assert.throws(
  () => assertReadingOfflineWriteCapacity(47, 16, 32),
  (error) => error instanceof ReadingOfflineMaterializationError && error.code === 'storage_full',
);

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
    if (method !== 'cache.chapter.materialization.report') {
      assert.equal(options.shouldCancel?.(), false);
    }
    if (method === 'cache.book.prefetch') {
      const materializations = [];
      for (let chapterIndex = params.chapterRange[0]; chapterIndex < params.chapterRange[1]; chapterIndex += 1) {
        coreStates[chapterIndex] = 'inProgress';
        coreCachedBytes[chapterIndex] = chapterIndex === 0 ? 12 : 9;
        materializationGeneration += 1;
        materializations.push({
          chapterIndex,
          token: `token-${chapterIndex}-${materializationGeneration}`,
        });
      }
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterRange: params.chapterRange,
        chapterCount: 2,
        prefetchedCount: 2,
        materializations,
      } };
    }
    if (method === 'cache.chapter.materialization.report') {
      assert.equal(options.shouldCancel, undefined,
        'terminal materialization reports must outlive a stale route guard');
      materializationReports.push(params);
      coreStates[params.chapterIndex] = params.outcome;
      if (dropNextReportResult) {
        dropNextReportResult = false;
        throw new Error('fixture lost terminal report result');
      }
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterIndex: params.chapterIndex,
        state: params.outcome,
        retainedCachedBody: true,
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
          { chapterIndex: 0, title: 'Chapter 0', url: '/chapter/0', state: coreStates[0], cachedBytes: coreCachedBytes[0] },
          { chapterIndex: 1, title: 'Chapter 1', url: '/chapter/1', state: coreStates[1], cachedBytes: coreCachedBytes[1] },
        ],
      } };
    }
    if (method === 'cache.clear') {
      assert.deepEqual(params, { scope: 'book', sourceId: SOURCE_ID, bookId: BOOK_ID });
      return { data: { scope: 'book' } };
    }
    throw new Error(`unexpected command: ${method}`);
  }

  async prefetchReadingImage(identity, isCurrent) {
    assert.equal(isCurrent?.(), true);
    if (failImage) {
      throw new ReadingOfflineMaterializationError('storage_full', 'fixture disk is full');
    }
    persistedImages.push(identity);
    if (supersedeAfterImage) {
      requestCurrent = false;
    }
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
assert.deepEqual(materializationReports.map((report) => report.outcome), ['completed', 'completed']);
assert.ok(materializationReports.every((report) => report.errorCode === undefined));

completedManifests.clear();
failImage = true;
dropNextReportResult = true;
const storageFullProjection = await gateway.prefetchRange(session, 0, 1, () => true);
assert.equal(storageFullProjection[0].downloadState, 'cached',
  'an image storage failure must retain the already cached text body');
assert.equal(completedManifests.has(0), false, 'a failed image must not publish chapter completion');
assert.equal(coreStates[0], 'failed');
const storageFullReport = materializationReports.at(-1);
assert.equal(storageFullReport.outcome, 'failed');
assert.equal(storageFullReport.errorCode, 'storage_full');
assert.equal(materializationReports.at(-2).token, storageFullReport.token,
  'a lost terminal result must retry the exact idempotent token');
failImage = false;
const retryProjection = await gateway.prefetchRange(session, 0, 1, () => true);
assert.equal(retryProjection[0].downloadState, 'completed');
assert.equal(materializationReports.at(-1).outcome, 'completed');

completedManifests.clear();
requestCurrent = true;
supersedeAfterImage = true;
await assert.rejects(
  () => gateway.prefetchRange(session, 0, 1, () => requestCurrent),
  (error) => error instanceof ReadingOfflineMaterializationError && error.code === 'cancelled',
);
supersedeAfterImage = false;
requestCurrent = true;
assert.equal(completedManifests.has(0), false);
assert.equal(materializationReports.at(-1).outcome, 'failed');
assert.equal(materializationReports.at(-1).errorCode, 'cancelled');

coreStates[0] = 'cached';
coreStates[1] = 'completed';
completedManifests.add(0);
completedManifests.add(1);
const authoritativeProjection = await gateway.loadProjection(session, () => true);
assert.deepEqual(authoritativeProjection.map((entry) => entry.downloadState), ['cached', 'completed'],
  'an orphan Host manifest must not promote a Core body-only cache to completed');
completedManifests.delete(1);
const missingManifestProjection = await gateway.loadProjection(session, () => true);
assert.deepEqual(missingManifestProjection.map((entry) => entry.downloadState), ['cached', 'cached'],
  'Core completion without a Host manifest must remain cached');

let textOnlyState = 'missing';
let textOnlyBytes = 0;
const textOnlyRuntime = {
  async request(method, params = {}) {
    if (method === 'cache.book.prefetch') {
      textOnlyState = 'inProgress';
      textOnlyBytes = 9;
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterRange: params.chapterRange,
        materializations: [{ chapterIndex: 1, token: 'text-only-token' }],
      } };
    }
    if (method === 'chapter.content') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterTitle: 'Chapter 1',
        content: 'text only',
        via: 'cache',
      } };
    }
    if (method === 'cache.chapter.materialization.report') {
      textOnlyState = params.outcome;
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterIndex: 1,
        state: params.outcome,
        retainedCachedBody: true,
      } };
    }
    if (method === 'cache.book.status') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapters: [{ chapterIndex: 1, state: textOnlyState, cachedBytes: textOnlyBytes }],
      } };
    }
    throw new Error(`unexpected text-only command: ${method}`);
  },
};
const textOnlyGateway = new ReadingOfflineGateway(textOnlyRuntime);
const textOnlyProjection = await textOnlyGateway.prefetchRange(session, 1, 2, () => true);
assert.equal(textOnlyProjection[1].downloadState, 'cached',
  'a text-only chapter must prefetch without any image persistence callbacks');

await gateway.clearBook(session, () => true);
assert.equal(completedManifests.size, 0);

const wholeBookChapterCount = 45;
const wholeBookRanges = [];
const wholeBookProgress = [];
const wholeBookSession = {
  ...session,
  entries: Array.from({ length: wholeBookChapterCount }, (_value, index) => ({
    index,
    title: `Chapter ${index}`,
    url: `/chapter/${index}`,
    variables: [],
  })),
};
const wholeBookRuntime = {
  async request(method, params = {}) {
    if (method === 'cache.book.prefetch') {
      wholeBookRanges.push(params.chapterRange);
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapterRange: params.chapterRange,
        materializations: [],
      } };
    }
    if (method === 'cache.book.status') {
      return { data: {
        sourceId: SOURCE_ID,
        bookId: BOOK_ID,
        chapters: wholeBookSession.entries.map((entry) => ({
          chapterIndex: entry.index,
          state: 'cached',
          cachedBytes: 1,
        })),
      } };
    }
    throw new Error(`unexpected whole-book command: ${method}`);
  },
};
const wholeBookProjection = await new ReadingOfflineGateway(wholeBookRuntime).prefetchBook(
  wholeBookSession,
  () => true,
  progress => wholeBookProgress.push([progress.completedChapters, progress.totalChapters]),
);
assert.deepEqual(wholeBookRanges, [[0, 20], [20, 40], [40, 45]],
  'whole-book download must reuse the bounded Core range command');
assert.deepEqual(wholeBookProgress, [[20, 45], [40, 45], [45, 45]]);
assert.equal(wholeBookProjection.length, wholeBookChapterCount);
assert.ok(wholeBookProjection.every(entry => entry.downloadState === 'cached'));

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

// Volume headings retain canonical positions but never become download actors,
// manifest requests, progress totals or chapter materialization work.
{
  const volumeSession = { ...session, entries: [
    { index: 0, title: 'volume', url: '', variables: [] },
    { index: 1, title: 'chapter', url: '/one', variables: [] },
    { index: 2, title: 'volume 2', url: '', variables: [] },
  ] };
  const requests = [], progress = [];
  let maliciousLease = false;
  const runtime = { request: async (method, params) => {
    requests.push({ method, params });
    if (method === 'cache.book.status') return { data: { sourceId: SOURCE_ID, bookId: BOOK_ID,
      chapters: [{ chapterIndex: 0, state: 'completed', cachedBytes: 0 }] } };
    if (method === 'cache.book.prefetch') return { data: { sourceId: SOURCE_ID, bookId: BOOK_ID,
      chapterRange: params.chapterRange, materializations: maliciousLease ? [{ chapterIndex: 0, token: 'invalid-volume' }] : [] } };
    throw Error('unexpected materialization');
  }, isOfflineImageChapterMaterialized: async () => { throw Error('volume must not request a manifest'); } };
  const gateway = new ReadingOfflineGateway(runtime);
  const projection = await gateway.loadProjection(volumeSession);
  assert.deepEqual(projection.map(e => [e.index, e.navigable, e.downloadState]), [[0, false, 'unknown'], [1, true, 'missing'], [2, false, 'unknown']]);
  await gateway.prefetchRange(volumeSession, 0, 1);
  assert.equal(requests.filter(r => r.method === 'cache.book.prefetch').length, 0);
  await gateway.prefetchBook(volumeSession, undefined, p => progress.push([p.completedChapters, p.totalChapters]));
  assert.deepEqual(progress, [[1, 1]]);
  maliciousLease = true;
  await assert.rejects(gateway.prefetchRange(volumeSession, 0, 3), /invalid materialization lease/);
}
console.log('offline canonical volume projection, range guard, readable totals and lease rejection: PASS');
