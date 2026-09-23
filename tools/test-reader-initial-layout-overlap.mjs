import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const baseline = process.argv.includes('--baseline');
const source = new URL(baseline ? '../evidence/2026-09-14-physical-review/bookshelf-open-ph111/baseline/LocalReadingExperience.ets' :
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const mapSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts', import.meta.url), 'utf8')
  .replace('constructor(private readonly content: string) {', 'constructor(content: string) { this.content = content;');
const { ReadingSurfaceLayoutMap } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
class RemoteChapterCacheRefreshError extends Error { refreshPreserved = false; }
const Initial = productionMotionMethods(source, ['loadInitialChapter', 'openChapter', 'loadSessionChapter'], {
  ReadingSurfaceLayoutMap, RemoteChapterCacheRefreshError, LOCAL_READING_SOURCE_ID: 'local',
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let turn = 0; turn < 6; turn++) await new Promise(resolve => setImmediate(resolve)); };
const sample = { chapterIndex: 0, content: '这是用于首屏并行验证的正文。', contentVersion: 'version-1', images: [] };
function fixture(options = {}) {
  const calls = [], failures = [], layouts = [], publications = [];
  const owner = Object.assign(new Initial(), {
    bookId: 'book', sourceId: 'local', chapterSelectionToken: 1, mounted: true,
    chapterWindow: { get: () => undefined, configure() {}, setCurrent() {} },
    isSelectionActive(_lifecycle, selection) { return this.mounted && selection === this.chapterSelectionToken; },
    activeGateway: () => ({
      loadProgress: () => options.progress?.promise ?? Promise.resolve({ kind: 'missing' }),
      loadChapter: (...args) => { calls.push(args); return options.loadChapter?.(...args) ?? options.body?.promise ?? Promise.resolve(sample); },
    }),
    loadInitialToc: async () => ({ entries: [{ index: 0, title: '首章' }] }),
    onDirectoryProjectionChanged() {}, admitTocEntries(entries) { this.tocEntries = entries; }, readingTocEntries() { return this.tocEntries; },
    normalizedRequestedChapter: () => undefined, requireKnownChapter: () => 0,
    ensureCurrentContentMetrics: async () => true, admitChapterContentVersion() {}, retainCurrentChapterWindow() {},
    rebuildChapterImageIndexes() {}, configureRestoredAnchor() {}, hasMeasuredViewport: () => true,
    beginMeasurement: () => layouts.push('measured'), notifyPreservedContentRefresh() {},
    requestCachedChapterRefresh: async () => true, fail: error => failures.push(error.message),
  });
  Object.defineProperty(owner, 'chapter', { get: () => publications.at(-1), set: value => publications.push(value) });
  return { owner, calls, failures, layouts, publications };
}
const report = { source: baseline ? 'pre-PH111 source' : 'current source', cases: [] };
{
  const layout = deferred(), f = fixture();
  const pending = f.owner.loadInitialChapter(1, layout.promise);
  await settle();
  assert.equal(f.calls.length, baseline ? 0 : 1, 'body acquisition overlaps the unresolved layout gate');
  assert.equal(f.publications.length, 0); assert.equal(f.layouts.length, 0);
  report.cases.push({ case: 'layout blocked', chapterReadsBeforeLayout: f.calls.length, publishedBeforeLayout: 0, measuredBeforeLayout: 0 });
  layout.resolve([]); await pending;
  assert.equal(f.publications.length, 1); assert.equal(f.layouts.length, 1); assert.deepEqual(f.failures, []);
}
if (!baseline) {
  {
    const body = deferred(), layout = deferred(), f = fixture({ body });
    const pending = f.owner.loadInitialChapter(1, layout.promise); await settle();
    layout.resolve([]); await settle(); assert.equal(f.publications.length, 0);
    body.resolve(sample); await pending; assert.equal(f.layouts.length, 1);
    report.cases.push({ case: 'body blocked after layout', publishedBeforeBody: 0, finalMeasurements: 1 });
  }
  for (const invalidate of [f => { f.owner.mounted = false; }, f => { f.owner.chapterSelectionToken++; }]) {
    const layout = deferred(), f = fixture(); const pending = f.owner.loadInitialChapter(1, layout.promise);
    await settle(); assert.equal(f.calls.length, 1); invalidate(f); layout.resolve([]); await pending;
    assert.equal(f.publications.length, 0); assert.equal(f.layouts.length, 0); assert.deepEqual(f.failures, []);
    report.cases.push({ case: 'unmount or newer selection during layout', stalePublications: 0 });
  }
  {
    let attempts = 0; const layout = deferred();
    const f = fixture({ loadChapter: () => ++attempts === 1 ? Promise.reject(new RemoteChapterCacheRefreshError('refresh')) : Promise.resolve(sample) });
    const pending = f.owner.loadInitialChapter(1, layout.promise); await settle();
    assert.equal(f.calls.length, 2); assert.equal(f.calls[1][3], true);
    assert.equal(f.publications.length, 0); assert.equal(f.layouts.length, 0);
    layout.resolve([]); await pending; assert.equal(f.layouts.length, 1); assert.deepEqual(f.failures, []);
    report.cases.push({ case: 'accepted cache refresh', refreshedBeforeLayout: true, publicationsBeforeLayout: 0, finalMeasurements: 1 });
  }
  const unhandled = [];
  const observe = reason => unhandled.push(reason);
  process.on('unhandledRejection', observe);
  try {
    for (const stale of [false, true]) {
      const progress = deferred(), layout = deferred(), f = fixture({ progress });
      const pending = f.owner.loadInitialChapter(1, layout.promise);
      layout.reject(new Error('layout failed')); await settle(); assert.deepEqual(unhandled, []);
      if (stale) f.owner.chapterSelectionToken++;
      progress.resolve({ kind: 'missing' }); await pending; await settle();
      assert.deepEqual(f.failures, stale ? [] : ['layout failed']); assert.equal(f.publications.length, 0);
      report.cases.push({ case: `layout rejects before progress${stale ? ' with newer selection' : ''}`, unhandledRejections: 0, failures: f.failures });
    }
    {
      const body = deferred(), layout = deferred(), f = fixture({ body });
      const pending = f.owner.loadInitialChapter(1, layout.promise); await settle();
      layout.reject(new Error('layout failed')); await pending;
      body.reject(new Error('late body failed')); await settle();
      assert.deepEqual(unhandled, []); assert.deepEqual(f.failures, ['layout failed']);
      report.cases.push({ case: 'both joined promises reject', unhandledRejections: 0, failures: f.failures });
    }
  } finally { process.removeListener('unhandledRejection', observe); }
}
const evidenceIndex = process.argv.indexOf('--evidence');
if (evidenceIndex >= 0) writeFileSync(process.argv[evidenceIndex + 1], JSON.stringify(report, null, 2) + '\n');
console.log(baseline ? 'BASELINE CONFIRMED: initial body waits until layout completes' :
  'PASS actual initial chapter acquisition overlaps layout; publication/measurement, stale selection, refresh and rejection barriers remain intact');
