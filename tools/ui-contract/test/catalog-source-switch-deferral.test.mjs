import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Harmony resolves extensionless TypeScript imports inside these Host modules.
const resolver = registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.') || specifier.endsWith('.ts')) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
const reading = new URL('../../../entry/src/main/ets/features/reading/', import.meta.url);
const { RemoteReadingFlowGateway } = await import(new URL('application/RemoteReadingFlowGateway.ts', reading));
const { isRemoteSourceFailureKind, remoteReadingFailureKindOf } =
  await import(new URL('application/RemoteContentAdmission.ts', reading));
const { readingFailureHint } = await import(new URL('presentation/ReadingFailurePresentation.ts', reading));
resolver.deregister();

const seed = { sourceId: 'source', bookId: '/book', detailUrl: '/book', title: '公开样书', author: '作者', sourceVersion: 'r1' };
const openingChapter = { index: 0, title: '第一章', url: '/first', variables: {} };
const deferred = { catalogInstalled: false, catalogDeferredReason: 'sourceSwitchPending' };

function openCatalog(toc, fields = {}) {
  const gateway = new RemoteReadingFlowGateway({
    async request(method) {
      if (method === 'book.detail') {
        return { data: {
          sourceId: seed.sourceId, sourceVersion: seed.sourceVersion,
          book: { bookId: seed.bookId, title: seed.title, author: seed.author }, tocUrl: '/catalog',
        } };
      }
      assert.equal(method, 'book.toc');
      return { data: { sourceId: seed.sourceId, bookId: seed.bookId, sourceVersion: seed.sourceVersion, toc, ...fields } };
    },
  });
  return gateway.openSession(seed);
}

test('pending switch defers empty and readable catalogs without offering a source change', async () => {
  for (const chapters of [[], [openingChapter]]) {
    await assert.rejects(openCatalog(chapters, deferred), (error) => {
      assert.equal(error.code, 'sourceSwitchPending');
      assert.equal(error.category, 'SOURCE_SWITCH_PENDING');
      const kind = remoteReadingFailureKindOf(error);
      assert.equal(isRemoteSourceFailureKind(kind), false);
      assert.match(error.message, /换源完成后重试打开目录/);
      assert.equal(readingFailureHint(error.message, kind), error.message);
      return true;
    });
  }
});

test('pending metadata cannot mask identity drift, version drift, or ordinary empty catalogs', async () => {
  await assert.rejects(openCatalog([], { ...deferred, bookId: '/other-book' }), { code: 'identityMismatch' });
  await assert.rejects(openCatalog([], { ...deferred, sourceVersion: 'r2' }), { code: 'sourceVersionChanged' });
  await assert.rejects(openCatalog([], { catalogInstalled: false }), { code: 'emptyToc' });
  await assert.rejects(openCatalog([openingChapter], { catalogInstalled: false }), { code: 'sourceVersionChanged' });
});
