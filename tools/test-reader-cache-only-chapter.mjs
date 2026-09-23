import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const identity = { sourceId: 'source', bookId: 'book' };
const session = { identity, acquisitionMode: 'offline', detailUrl: '/book', tocUrl: '/toc',
  book: { title: 'Book', author: 'Author' }, continuationVariables: [], hostRequirements: [],
  entries: [{ index: 4, title: 'Chapter', url: '/chapter/4', variables: [] }] };
const content = { ...identity, chapterTitle: 'Chapter', content: 'This is the cached chapter body.',
  via: 'cache', bodyVersion: 'body-v1', processingVersion: 'processing-v1' };
const calls = [];
let missing = false;
let capability = true;
const runtime = {
  supportsCoreCapability: name => capability && name === 'chapter.content.cacheOnly.v1',
  async request(method, params, options) {
    calls.push({ method, params });
    assert.equal(options.shouldCancel?.(), false);
    if (method === 'cache.book.status') return { data: { ...identity, chapters: [{ chapterIndex: 4, state: 'cached' }] } };
    assert.equal(method, 'chapter.content');
    if (missing) throw { message: 'not cached', details: { category: 'CACHE_MISSING' } };
    return { data: content };
  },
};
const gateway = new RemoteReadingFlowGateway(runtime);
const read = (value = session, force = false) => gateway.loadChapter(value, 4, () => true, force);
const chapter = await read();
assert.equal(chapter.content, content.content);
assert.equal(chapter.bodyVersion, content.bodyVersion);
assert.deepEqual(calls.map(c => c.method), ['chapter.content']);
assert.equal(calls[0].params.cacheOnly, true);
assert.equal(calls[0].params.chapterIndex, 4);

calls.length = 0; missing = true;
await assert.rejects(read(), error => error.code === 'chapterNotDownloaded' && error.category === 'CACHE_MISSING');
assert.deepEqual(calls.map(c => c.method), ['chapter.content'], 'miss cannot silently fall through to a source read');

calls.length = 0; missing = false;
await read(session, true);
assert.equal(calls[0].params.forceRefresh, true);
assert.equal('cacheOnly' in calls[0].params, false, 'explicit refresh preserves its own acquisition contract');

calls.length = 0; capability = false;
await read();
assert.deepEqual(calls.map(c => c.method), ['cache.book.status', 'chapter.content']);
assert.equal('cacheOnly' in calls[1].params, false, 'an older Core must not receive an unknown field');

calls.length = 0; capability = true;
await read({ ...session, acquisitionMode: 'online' });
assert.equal('cacheOnly' in calls[0].params, false, 'ordinary online cache-first reads still may acquire a missing chapter');

calls.length = 0; missing = true;
let refreshes = 0;
gateway.openSession = async () => { refreshes++; missing = false; return { ...session, acquisitionMode: 'online' }; };
await read({ ...session, requiresContextRefresh: true });
assert.equal(refreshes, 1);
assert.deepEqual(calls.map(c => c.params.cacheOnly), [true, undefined], 'only the existing context-refresh transition may reacquire');

calls.length = 0;
await assert.rejects(gateway.loadChapter(session, 4, () => false), error => error.code === 'cancelled');
assert.equal(calls.length, 0);
console.log('PASS atomic cache-only gateway: hit, miss, explicit refresh, old Core, online read, context recovery, cancellation');
