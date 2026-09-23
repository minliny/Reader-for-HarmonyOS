import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error;
} } });
const { RemoteReadingSourceError, remoteReadingFailureKindOf } = await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const { RemoteChapterCacheRefreshError } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const mapSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts', import.meta.url), 'utf8')
  .replace('constructor(private readonly content: string) {', 'constructor(content: string) { this.content = content;');
const { ReadingSurfaceLayoutMap } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['loadInitialChapter', 'openChapter', 'loadSessionChapter', 'readingTocEntries', 'requireKnownChapter', 'normalizedRequestedChapter'],
  { ReadingSurfaceLayoutMap, RemoteReadingSourceError, remoteReadingFailureKindOf, RemoteChapterCacheRefreshError, LOCAL_READING_SOURCE_ID: 'local' });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const empty = () => new RemoteReadingSourceError('SOURCE_CONTENT_EMPTY', 'empty');
const body = index => ({ sourceId: 'source', bookId: 'book', chapterIndex: index, chapterTitle: '章', content: '真实的非空正文', contentVersion: 'v1', images: [] });
const restored = { kind: 'restored', progress: { bookId: 'book', chapterIndex: 1, chapterOffset: 3, chapterProgress: 0.2, updatedAt: 1 } };
function fixture(options = {}) {
  const calls = [], failures = [], publications = [], measures = [];
  let progressReads = 0;
  const entries = options.entries ?? [{ index: 0, title: '卷', url: '' }, ...[1, 2, 3, 4].map(index => ({ index, title: '章', url: `chapter:${index}` }))];
  let indices = [];
  const owner = Object.assign(new Owner(), {
    sourceId: options.local ? 'local' : 'source', bookId: 'book', chapterSelectionToken: 1, mounted: true,
    remoteSession: options.local ? undefined : { entries }, requestedChapterIndex: options.requested,
    requestedBookmarkAnchor: options.bookmark, sourceSwitchTransactionId: options.switchId,
    isSelectionActive(_lifecycle, selection) { return this.mounted && this.chapterSelectionToken === selection; },
    loadInitialToc: async () => ({ entries: entries.map(entry => ({ index: entry.index, title: entry.title, navigable: entry.index !== 0 })) }),
    admitTocEntries(entries) { this.tocEntries = entries; }, positionContextForScope: () => undefined, onDirectoryProjectionChanged() {},
    chapterWindow: { get: () => undefined, configure(_s, _b, values) { indices = values; }, contains: index => indices.includes(index), setCurrent() {} },
    activeGateway: () => ({ loadProgress: async () => { progressReads++; return options.progress ?? { kind: 'missing' }; },
      loadChapter: async (_book, index, current) => { calls.push(index); return options.load?.(index, current) ?? body(index); } }),
    ensureCurrentContentMetrics: async () => true, admitChapterContentVersion() {}, retainCurrentChapterWindow() {},
    rebuildChapterImageIndexes() {}, configureRestoredAnchor() {}, hasMeasuredViewport: () => true,
    beginMeasurement() { measures.push(this.chapter.chapterIndex); }, notifyPreservedContentRefresh() {},
    fail(error) { failures.push(error); }, requestCachedChapterRefresh: async () => false, beginExit() { throw Error('unexpected cache refresh'); },
  });
  Object.defineProperty(owner, 'chapter', { get: () => publications.at(-1), set: chapter => publications.push(chapter) });
  return { owner, calls, failures, publications, measures, progressReads: () => progressReads };
}
{
  const layout = deferred(), f = fixture({ load: index => { if (index === 1) throw empty(); return body(index); } });
  const operation = f.owner.loadInitialChapter(1, layout.promise); await settle();
  assert.deepEqual(f.calls, [1, 2], 'skip a URL-less volume then retry only the empty body');
  assert.equal(f.progressReads(), 1); assert.deepEqual(f.publications, []); assert.deepEqual(f.measures, []);
  layout.resolve([]); await operation;
  assert.deepEqual(f.measures, [2]); assert.deepEqual(f.failures, []);
}
{
  const f = fixture({ load: () => { throw empty(); } });
  await f.owner.loadInitialChapter(1, Promise.resolve([]));
  assert.deepEqual(f.calls, [1, 2, 3]); assert.equal(f.failures.length, 1);
  assert.equal(remoteReadingFailureKindOf(f.failures[0]), 'SOURCE_CONTENT_EMPTY'); assert.deepEqual(f.measures, []);
}
for (const options of [{ progress: restored }, { requested: 2 }, { bookmark: { chapterIndex: 2, chapterOffset: 0, requestId: 1 } }, { switchId: 'transaction' }, { local: true }]) {
  const f = fixture({ ...options, load: () => { throw empty(); } });
  await f.owner.loadInitialChapter(1, Promise.resolve([]));
  assert.equal(f.calls.length, 1, 'resume, bookmark, explicit chapter, source switch and local reading never skip chapters');
  assert.equal(f.calls[0], options.requested ?? options.bookmark?.chapterIndex ?? 1);
  assert.equal(f.failures.length, 1); assert.equal(f.progressReads(), 1);
}
for (const failure of [new RemoteReadingSourceError('SOURCE_HTTP_FAILED', 'network'), new Error('SOURCE_CONTENT_EMPTY')]) {
  const f = fixture({ load: () => { throw failure; } });
  await f.owner.loadInitialChapter(1, Promise.resolve([]));
  assert.deepEqual(f.calls, [1]); assert.equal(f.failures[0], failure, 'untyped messages cannot authorize a chapter skip');
}
for (const cancel of [owner => { owner.mounted = false; }, owner => { owner.chapterSelectionToken++; }]) {
  const gate = deferred(), f = fixture({ load: async () => { await gate.promise; throw empty(); } });
  const pending = f.owner.loadInitialChapter(1, Promise.resolve([])); await settle();
  cancel(f.owner); gate.resolve(); await pending;
  assert.deepEqual(f.calls, [1]); assert.deepEqual(f.failures, []); assert.deepEqual(f.publications, []);
}
{
  const entries = [{ index: 0, title: '卷', url: '' }, ...[1, 2, 3].map(index => ({ index, title: '章', url: `chapter:${index}` }))];
  for (let index = 4; index < 10004; index++) entries.push({ index, title: '后续章', get url() { throw Error('scan must stop after three candidates'); } });
  const f = fixture({ entries, load: () => { throw empty(); } });
  await f.owner.loadInitialChapter(1, Promise.resolve([]));
  assert.deepEqual(f.calls, [1, 2, 3]); assert.equal(remoteReadingFailureKindOf(f.failures[0]), 'SOURCE_CONTENT_EMPTY');
}
console.log('PASS actual unread reader admission: one progress read, first three navigable chapters only, typed empty retry, font/layout barrier, resume/explicit/source-switch preservation and stale cancellation');
