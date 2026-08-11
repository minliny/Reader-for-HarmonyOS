import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// ArkTS uses extensionless relative imports. Let this Node-only test resolve
// those imports to their real TypeScript files without changing production
// module specifiers or adding a bundler.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) &&
        !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  RemoteReadingFlowGateway,
} = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const {
  ReadingSessionFlowGateway,
} = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {
  ReadingChapterWindow,
} = await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const {
  ReadingPaginationIndex,
} = await import('../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts');

const SOURCE_ID = 'source-1';
const BOOK_ID = '/book/42';
const calls = [];
const PIXEL_MAP = { fixture: 'pixel-map' };

class FakeRemoteReadingRuntime {
  async loadReadingImage(
    sourceId,
    bookId,
    chapterIndex,
    contentVersion,
    imageUrl,
    baseUrl,
    allowNetwork,
    shouldStayCurrent,
  ) {
    assert.equal(sourceId, SOURCE_ID);
    assert.equal(bookId, BOOK_ID);
    assert.equal(chapterIndex, 0);
    assert.equal(contentVersion, previousChapter.contentVersion);
    assert.equal(baseUrl, '/chapter/1');
    assert.equal(allowNetwork, true);
    if (shouldStayCurrent !== undefined && !shouldStayCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
    if (imageUrl === 'failed.png') {
      throw new Error('fixture image failure');
    }
    return {
      pixelMap: PIXEL_MAP,
      fileUri: 'file:///fixture/body.png',
      width: 320,
      height: 180,
      revision: 'image-r1',
    };
  }

  async request(method, params = {}, options = {}) {
    calls.push({ method, params, options });
    assert.equal(options.shouldCancel?.(), false,
      `${method} must retain the current route/request guard`);
    switch (method) {
      case 'book.detail':
        assert.equal(params.sourceId, SOURCE_ID);
        assert.equal(params.bookUrl, BOOK_ID);
        assert.deepEqual(params.book.variables, { searchOnly: 's', token: 'search' });
        return { data: {
          sourceId: SOURCE_ID,
          book: {
            bookId: BOOK_ID,
            title: 'Remote Book',
            author: 'Author',
            coverUrl: 'https://example.invalid/cover.jpg',
          },
          tocUrl: '/book/42/toc',
          variables: { detailOnly: 'd', token: 'detail' },
        } };
      case 'book.toc':
        assert.deepEqual(params.variables, {
          detailOnly: 'd',
          searchOnly: 's',
          token: 'detail',
        });
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          toc: [
            { index: 0, title: 'Chapter 1', url: '/chapter/1', variables: { token: 'chapter' } },
            { index: 1, title: 'Chapter 2', url: '/chapter/2', variables: { chapterOnly: 'c' } },
          ],
        } };
      case 'chapter.content':
        if (params.chapterIndex === 1) {
          assert.equal(params.chapterUrl, '/chapter/2');
          assert.deepEqual(params.variables, {
            chapterOnly: 'c',
            detailOnly: 'd',
            searchOnly: 's',
            token: 'detail',
          });
          return { data: {
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            chapterTitle: 'Chapter 2',
            content: 'Second remote chapter body.',
            via: 'rule',
          } };
        }
        assert.equal(params.chapterIndex, 0);
        assert.equal(params.chapterUrl, '/chapter/1');
        assert.deepEqual(params.variables, {
          detailOnly: 'd',
          searchOnly: 's',
          token: 'chapter',
        });
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          chapterTitle: 'Chapter 1',
          content: 'First remote chapter body has enough text for two test pages.',
          via: 'rule',
        } };
      case 'search.content':
        assert.equal(params.sourceId, SOURCE_ID);
        assert.equal(params.bookId, BOOK_ID);
        assert.equal(params.keyword, 'remote');
        assert.equal(params.maxResults, 50);
        return { data: {
          results: [{
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            bookName: 'Remote Book',
            chapterIndex: 0,
            chapterOffset: 6,
            matchLength: 6,
            snippetStart: 0,
            chapterTitle: 'Chapter 1',
            snippet: 'First remote chapter body.',
          }],
        } };
      case 'reading.progress.get':
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          found: true,
          progress: {
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            chapterIndex: 0,
            chapterOffset: 6,
            chapterProgress: 0.25,
            updatedAt: 100,
            locationRevision: 'revision-old',
          },
        } };
      case 'reader.location.resolve':
        assert.deepEqual(params.anchor, { chapterOffset: 12, chapterProgress: 0.5 });
        assert.deepEqual(params.layout, {
          viewportWidth: 390,
          viewportHeight: 844,
          fontScale: 1,
          lineHeight: 35.28,
        });
        return { data: {
          resolved: true,
          canonicalLocation: {
            bookId: BOOK_ID,
            chapterIndex: 0,
            chapterOffset: 12,
            // Core canonical progress is authoritative. The primary scalar
            // anchor is still exact even if an f64 JSON round trip changes
            // the final decimal digit.
            chapterProgress: 0.5000000000000001,
            locationRevision: 'revision-new',
          },
          resolverVersion: 'reader.location.resolve.v1.reflow',
          reflow: {
            strategy: 'offsetAnchor',
            primaryAnchor: 'chapterOffset',
            fallbackAnchor: 'chapterProgress',
            layoutIndependent: true,
          },
        } };
      case 'reading.progress.update':
        assert.equal(params.locationRevision, 'revision-new');
        assert.equal(params.chapterProgress, 0.5000000000000001);
        return { data: {
          stored: true,
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          chapterIndex: 0,
          chapterOffset: 12,
          chapterProgress: 0.5000000000000001,
          updatedAt: 101,
          locationRevision: 'revision-new',
        } };
      default:
        throw new Error(`unexpected command: ${method}`);
    }
  }
}

const runtime = new FakeRemoteReadingRuntime();
const gateway = new RemoteReadingFlowGateway(runtime);
const isCurrent = () => true;
const session = await gateway.openSession({
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  detailUrl: BOOK_ID,
  title: 'Search title',
  author: 'Search author',
  searchVariables: [
    { name: 'token', value: 'search' },
    { name: 'searchOnly', value: 's' },
  ],
}, { isCurrent });
assert.equal(session.entries.length, 2);
assert.deepEqual(session.continuationVariables, [
  { name: 'detailOnly', value: 'd' },
  { name: 'searchOnly', value: 's' },
  { name: 'token', value: 'detail' },
]);

const readingSessionGateway = new ReadingSessionFlowGateway(
  SOURCE_ID,
  BOOK_ID,
  { kind: 'remote', session },
  runtime,
);
assert.equal(readingSessionGateway.supportsContentSearch(), true);
const matches = await readingSessionGateway.searchContent(BOOK_ID, 'remote', 50, isCurrent);
assert.equal(matches.length, 1);
assert.equal(matches[0].sourceId, SOURCE_ID);
assert.equal(matches[0].chapterOffset, 6);

const currentChapter = await readingSessionGateway.loadChapter(BOOK_ID, 1, isCurrent);
const previousChapter = await readingSessionGateway.loadChapter(BOOK_ID, 0, isCurrent);
assert.equal(previousChapter.sourceId, SOURCE_ID);
assert.equal(previousChapter.bookId, BOOK_ID);
assert.equal(previousChapter.extractionVia, 'rule');
assert.match(previousChapter.contentVersion, /^reader-content-v1:/);
assert.equal(
  Array.from(previousChapter.content)
    .slice(matches[0].chapterOffset, matches[0].chapterOffset + matches[0].matchLength)
    .join(''),
  'remote',
  'an online search result must select the exact scalar range rendered by the shared ReadingDocument',
);

const pendingImage = {
  source: 'body.png',
  baseUrl: '/chapter/1',
  startScalar: 4,
  endScalar: 5,
  state: 'pending',
  pixelMap: undefined,
  fileUri: '',
  intrinsicWidth: 0,
  intrinsicHeight: 0,
  revision: 'pending',
};
const readyImage = await readingSessionGateway.resolveReadingImage(previousChapter, pendingImage, isCurrent);
assert.equal(readyImage.state, 'ready');
assert.equal(readyImage.pixelMap, PIXEL_MAP);
assert.equal(readyImage.intrinsicWidth, 320);
assert.equal(readyImage.revision, 'image-r1');
const failedImage = await readingSessionGateway.resolveReadingImage(previousChapter, {
  ...pendingImage,
  source: 'failed.png',
}, isCurrent);
assert.equal(failedImage.state, 'failed', 'one failed image must not reject its chapter');
assert.equal(failedImage.pixelMap, undefined);
await assert.rejects(
  readingSessionGateway.resolveReadingImage(previousChapter, pendingImage, () => false),
  /cancelled/,
  'a stale image request must cancel instead of publishing a failed placeholder',
);

let imageStillCurrent = true;
let stalePixelReleaseCount = 0;
const stalePixel = { fixture: 'stale-pixel-map' };
const staleImageGateway = new ReadingSessionFlowGateway(
  SOURCE_ID,
  BOOK_ID,
  { kind: 'remote', session },
  {
    async request() {
      throw new Error('request is not used by the stale image test');
    },
    async loadReadingImage() {
      imageStillCurrent = false;
      return {
        pixelMap: stalePixel,
        fileUri: 'file:///fixture/stale.png',
        width: 10,
        height: 10,
        revision: 'stale-r1',
      };
    },
    releaseReadingImage(fileUri, pixelMap) {
      assert.equal(fileUri, 'file:///fixture/stale.png');
      assert.equal(pixelMap, stalePixel);
      stalePixelReleaseCount += 1;
    },
  },
);
await assert.rejects(
  staleImageGateway.resolveReadingImage(previousChapter, pendingImage, () => imageStillCurrent),
  /cancelled/,
  'an image that becomes stale after decode must not publish its native handle',
);
assert.equal(stalePixelReleaseCount, 1,
  'a decoded PixelMap that loses ownership before admission must be released exactly once');

const chapterWindow = new ReadingChapterWindow();
chapterWindow.configure(SOURCE_ID, BOOK_ID, [0, 1]);
chapterWindow.setCurrent(currentChapter);
assert.equal(chapterWindow.admitNeighbour(previousChapter), true);
assert.equal(chapterWindow.previous()?.chapterIndex, 0,
  'the online reading session must retain its real TOC predecessor');
const imageWindow = new ReadingChapterWindow();
imageWindow.configure(SOURCE_ID, BOOK_ID, [0]);
imageWindow.setCurrent({ ...previousChapter, images: [readyImage] });
assert.equal(imageWindow.retainedImages()[0].pixelMap, PIXEL_MAP,
  'the bounded window must expose the native handles that remain live');

const pagination = new ReadingPaginationIndex();
const layoutSignature = 'runtime-test-layout-v1';
const currentKey = {
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  chapterIndex: currentChapter.chapterIndex,
  contentVersion: currentChapter.contentVersion,
  layoutSignature,
};
const previousKey = {
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  chapterIndex: previousChapter.chapterIndex,
  contentVersion: previousChapter.contentVersion,
  layoutSignature,
};
pagination.recordChapter({
  key: currentKey,
  contentScalarLength: Array.from(currentChapter.content).length,
  pageStartScalars: [0],
});
assert.deepEqual(pagination.findPreviousPage(currentKey, 0, previousKey), {
  kind: 'manifestRequired',
  key: previousKey,
}, 'a cold chapter-boundary turn must wait for a real predecessor manifest');
pagination.recordChapter({
  key: previousKey,
  contentScalarLength: Array.from(previousChapter.content).length,
  pageStartScalars: [0, 30],
});
const crossChapterPrevious = pagination.findPreviousPage(currentKey, 0, previousKey);
assert.equal(crossChapterPrevious.kind, 'page');
assert.equal(crossChapterPrevious.page.key.chapterIndex, 0);
assert.equal(crossChapterPrevious.page.startScalar, 30,
  'the measured predecessor must enter at its actual final physical page');

const progress = await gateway.loadProgress(session.identity, isCurrent);
assert.equal(progress.kind, 'restored');
assert.equal(progress.progress.locationRevision, 'revision-old');

const resolved = await gateway.resolveLocation(
  session.identity,
  previousChapter.chapterTitle,
  { chapterIndex: 0, chapterOffset: 12, chapterProgress: 0.5 },
  { viewportWidth: 390, viewportHeight: 844, fontScale: 1, lineHeight: 35.28 },
  isCurrent,
);
assert.equal(resolved.locationRevision, 'revision-new');
assert.equal(resolved.chapterProgress, 0.5000000000000001,
  'the gateway must persist Core canonical progress while guarding the exact scalar anchor');
const stored = await gateway.updateProgress(session.identity, {
  chapterIndex: resolved.chapterIndex,
  chapterOffset: resolved.chapterOffset,
  chapterProgress: resolved.chapterProgress,
  locationRevision: resolved.locationRevision,
}, isCurrent);
assert.equal(stored.locationRevision, 'revision-new');

assert.deepEqual(calls.map((call) => call.method), [
  'book.detail',
  'book.toc',
  'search.content',
  'chapter.content',
  'chapter.content',
  'reading.progress.get',
  'reader.location.resolve',
  'reading.progress.update',
]);

let staleRequestCount = 0;
const staleGateway = new RemoteReadingFlowGateway({
  async request(method, _params, options) {
    staleRequestCount += 1;
    assert.equal(method, 'book.detail');
    assert.equal(options.shouldCancel(), true,
      'a stale route must reach Core through shouldCancel rather than a UI-only flag');
    throw new Error('request cancelled');
  },
});
await assert.rejects(
  staleGateway.openSession({
    sourceId: SOURCE_ID,
    bookId: BOOK_ID,
    detailUrl: BOOK_ID,
    title: 'Stale book',
    author: '',
  }, { isCurrent: () => false }),
  (error) => error.code === 'commandFailed' && error.command === 'book.detail',
);
assert.equal(staleRequestCount, 1,
  'a cancelled detail request must not continue into TOC or chapter work');

let staleChapterRequestCount = 0;
const staleChapterGateway = new RemoteReadingFlowGateway({
  async request(method, _params, options) {
    staleChapterRequestCount += 1;
    assert.equal(method, 'chapter.content');
    assert.equal(options.shouldCancel(), true,
      'a superseded predecessor measurement must cancel at the Core request boundary');
    throw new Error('request cancelled');
  },
});
await assert.rejects(
  staleChapterGateway.loadChapter(session, 0, () => false),
  (error) => error.code === 'commandFailed' && error.command === 'chapter.content',
);
assert.equal(staleChapterRequestCount, 1);

let mismatchRequestCount = 0;
const mismatchGateway = new RemoteReadingFlowGateway({
  async request(method) {
    mismatchRequestCount += 1;
    assert.equal(method, 'book.detail');
    return { data: {
      sourceId: 'different-source',
      book: {
        bookId: BOOK_ID,
        title: 'Wrong source response',
        author: '',
      },
      tocUrl: '/must-not-be-used',
    } };
  },
});
await assert.rejects(
  mismatchGateway.openSession({
    sourceId: SOURCE_ID,
    bookId: BOOK_ID,
    detailUrl: BOOK_ID,
    title: 'Identity guarded book',
    author: '',
  }),
  (error) => error.code === 'identityMismatch' && error.command === 'book.detail',
);
assert.equal(mismatchRequestCount, 1,
  'a mismatched detail identity must stop before TOC acquisition');

const serialOrder = [];
let releaseFirstCommit = () => {};
let markFirstCommitStarted = () => {};
const firstCommitGate = new Promise((resolve) => {
  releaseFirstCommit = resolve;
});
const firstCommitStarted = new Promise((resolve) => {
  markFirstCommitStarted = resolve;
});
const firstCommit = gateway.runProgressCommitSerial(async () => {
  serialOrder.push('first:start');
  markFirstCommitStarted();
  await firstCommitGate;
  serialOrder.push('first:end');
});
const secondCommit = gateway.runProgressCommitSerial(async () => {
  serialOrder.push('second:start');
  serialOrder.push('second:end');
});
await firstCommitStarted;
assert.deepEqual(serialOrder, ['first:start'],
  'a later progress write must wait for the active write');
releaseFirstCommit();
await Promise.all([firstCommit, secondCommit]);
assert.deepEqual(serialOrder, [
  'first:start',
  'first:end',
  'second:start',
  'second:end',
]);

console.log('remote reading flow deterministic runtime: PASS');
