import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e;
} } });
const { readPreparedReadingEntrySnapshot } = await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { readingParagraphBoundaryMode } = await import('../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');

function fixture(text = '原段甲😀乙\n第二段正文。') {
  const count = [...text].length;
  const f = { current: true, contentCurrent: true, calls: [], text };
  f.data = { kind: 'ready', sourceId: 'local', bookId: 'b', chapterIndex: 7, chapterTitle: '第七章',
    content: text, blocks: [{ kind: 'text', text, startScalar: 0, endScalar: count }],
    documentWindow: { startScalar: 0, endScalar: count, totalScalars: count, requestedScalar: 3 },
    positionScope: { sourceId: 'local', bookId: 'b', chapterIndex: 7, bodyVersion: 'body', processingVersion: 'rules' },
    progress: { sourceId: 'local', bookId: 'b', chapterIndex: 7, chapterOffset: 3, chapterProgress: 3 / count,
      updatedAt: 1, bodyVersion: 'body', processingVersion: 'rules' }, progressRevision: 'observation',
    baseUrl: '', contentRefreshRequired: false,
    navigation: { revision: 'catalog', chapterCount: 9, readableChapterCount: 9,
      current: { index: 7, position: 6, readablePosition: 6, title: '第七章', navigable: true }, before: [], after: [] } };
  f.runtime = {
    supportsCoreCapability: () => true, captureReadingContentValidity: () => () => f.contentCurrent,
    readPreparedEntry(p) { f.calls.push(p); return structuredClone(f.data); },
    request() { throw Error('first-build read must not use command queue'); },
    readingEntryPreparations: () => ({ setPaused() {} }),
  };
  f.read = () => readPreparedReadingEntrySnapshot(f.runtime, 'local', 'b', undefined, () => f.current, 'lineSeparated');
  return f;
}
{
  const f = fixture(); const result = f.read();
  assert.ok(result && !(result instanceof Promise));
  assert.equal(result.chapter.content, f.text);
  assert.equal(result.progress.progressRevision, 'observation');
  assert.equal(result.requestedScalar, 3); assert.equal(f.calls.length, 1);
  const gateway = new ReadingSessionFlowGateway('local', 'b', { kind: 'local' }, f.runtime);
  gateway.admitPreparedEntry(result);
  assert.equal(await gateway.loadChapter('b', 7, () => true), result.chapter,
    'ordinary gateway adopts the same chapter without re-reading/acquiring');
}
for (const reason of ['storageUnsupported', 'storageBusy', 'runtimeClosed', 'catalogMissing', 'documentMissing',
  'sourceSwitchPending', 'positionUnresolved', 'resourceLimit', 'corruptDocument']) {
  const f = fixture(); f.data = { kind: 'unavailable', sourceId: 'local', bookId: 'b', reason };
  assert.equal(f.read(), undefined, reason); assert.equal(f.calls.length, 1);
}
for (const mutation of [d => { d.bookId = 'wrong'; }, d => { d.positionScope.processingVersion = 'new'; },
  d => { delete d.progressRevision; }, d => { d.progressRevision = ''; },
  d => { d.blocks[0].text = 'mismatch'; }, d => { d.documentWindow.requestedScalar = 100000; },
  d => { d.blocks[0].endScalar--; }, d => { d.navigation.current.index = 99; }]) {
  const f = fixture(); mutation(f.data); assert.throws(() => f.read());
}
{
  const f = fixture(); f.current = false; assert.equal(f.read(), undefined); assert.equal(f.calls.length, 0);
  f.current = true; f.runtime.readPreparedEntry = () => { f.contentCurrent = false; return f.data; };
  assert.equal(f.read(), undefined, 'mutation during the native read revokes its result');
}
{
  const f = fixture('一段没有边界的中部');
  const size = [...f.text].length;
  f.data.documentWindow = { startScalar: 100, endScalar: 100 + size, totalScalars: 1000, requestedScalar: 104 };
  f.data.blocks[0].startScalar = 100; f.data.blocks[0].endScalar = 100 + size;
  assert.equal(f.read(), undefined, 'partial original paragraph cannot be treated as a full shaping context');
}
{
  const f = fixture('\uFFFC'); f.data.documentWindow.requestedScalar = 0;
  f.data.progress.chapterOffset = 0; f.data.progress.chapterProgress = 0;
  f.data.blocks = [{ kind: 'image', source: 'https://example.invalid/cover', startScalar: 0, endScalar: 1 }];
  assert.throws(() => f.read(), /GEOMETRY_UNAVAILABLE/);
}

// Execute the real initial-admission method with the real synchronous DTO and
// gateway. Native shaping is an explicit fixture; it does NOT model pixels.
let runtime, metrics, fontReady = true, titleFontReady = true;
const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['restorePersistedFirstPresentation'], {
    ReaderRuntimeOwner: { current: () => runtime }, ReaderWindowCoordinator: { metrics: () => metrics },
    readerFontFamilyReady: family => family === 'title-font' ? titleFontReady : fontReady,
    readerAppearanceSnapshotFontFamily: () => 'registered-font', TYPE_READER_CHAPTER_TITLE: { fontFamily: 'title-font' },
    ReadingSessionFlowGateway, readPreparedReadingEntrySnapshot, readingParagraphBoundaryMode,
    LOCAL_READING_SOURCE_ID: 'local', hilog: { info() {} },
  });
function ownerFixture() {
  const f = fixture(); runtime = f.runtime;
  metrics = { ready: true, revision: 1, windowRect: { width: 360, height: 800 } }; fontReady = true; titleFontReady = true;
  const events = [];
  const o = Object.assign(new Owner(), {
    sourceId: 'local', bookId: 'b', bookKind: 'txt', readerSettingsLoaded: true, entryAppearanceReady: true,
    appearanceSnapshot: {}, readerSettingsSnapshot: { screenDirection: 'system' },
    chapterSelectionToken: 1, phase: 'loading', visibleFragments: [],
    hasMeasuredViewport: () => true, isSelectionActive: () => f.current,
    isSessionActive: () => f.current, normalizedRequestedChapter: () => undefined,
    traceInitialReadingPhase: s => events.push(s), onRemoteSessionReady() {},
    admitTocEntries(e) { this.tocEntries = e; },
    chapterWindow: { configure() {}, setCurrent() {} },
    admitChapterContentVersion() {}, retainCurrentChapterWindow() {}, rebuildChapterImageIndexes() {},
    configureRestoredAnchor(ch, map, initial, offset) { this.offset = offset; },
    configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {},
    beginMeasurement() { events.push('measure'); this.visiblePage = { startScalar: this.offset };
      this.visibleFragments = [{ text: this.chapter.content }]; this.phase = 'ready'; },
    fail() { this.phase = 'failed'; },
  });
  return { f, o, events };
}
{
  const { o, f, events } = ownerFixture();
  assert.equal(o.restorePersistedFirstPresentation(1), 'ready');
  assert.equal(o.chapter.content, f.text); assert.equal(o.visiblePage.startScalar, 3);
  assert.equal(o.restoredProgress.progress.progressRevision, undefined, 'revision belongs to progress state, not position');
  assert.equal(o.restoredProgress.progressRevision, 'observation');
  assert.equal(events.at(-1), 'measure');
}
{
  const { o, f, events } = ownerFixture();
  const text = '\uFFFC\n正文😀';
  const localSource = `reader-local-epub://${Buffer.from('local:' + 'a'.repeat(64)).toString('base64url')}/${Buffer.from('OPS/logo.png').toString('base64url')}`;
  Object.assign(f.data, { content: text, blocks: [
    { kind: 'image', source: localSource, startScalar: 0, endScalar: 1,
      imageIntrinsicWidth: 357, imageIntrinsicHeight: 359, imageWidthBasisPoints: 3000 },
    { kind: 'text', text: '\n正文😀', startScalar: 1, endScalar: 5 },
  ], documentWindow: { startScalar: 0, endScalar: 5, totalScalars: 5, requestedScalar: 0 } });
  Object.assign(f.data.progress, { chapterOffset: 0, chapterProgress: 0 });
  assert.equal(o.restorePersistedFirstPresentation(1), 'ready', 'known immutable image geometry reaches the same synchronous first-build measurement');
  assert.equal(o.chapter.images[0].state, 'pending');
  assert.equal(o.chapter.content, text); assert.equal(o.visiblePage.startScalar, 0);
  assert.equal(events.at(-1), 'measure');
}
for (const boundary of ['font', 'title-font', 'appearance', 'settings', 'window', 'rotate', 'transaction', 'capability', 'deep-local-bookmark']) {
  const { o, f } = ownerFixture();
  if (boundary === 'font') fontReady = false;
  if (boundary === 'title-font') titleFontReady = false;
  if (boundary === 'appearance') o.entryAppearanceReady = false;
  if (boundary === 'settings') o.readerSettingsLoaded = false;
  if (boundary === 'window') metrics.ready = false;
  if (boundary === 'rotate') o.readerSettingsSnapshot.screenDirection = 'landscape';
  if (boundary === 'transaction') o.sourceSwitchTransactionId = 'pending';
  if (boundary === 'capability') f.runtime.supportsCoreCapability = () => false;
  if (boundary === 'deep-local-bookmark') o.requestedBookmarkAnchor = { chapterIndex: 7, chapterOffset: 8 };
  assert.equal(o.restorePersistedFirstPresentation(1), 'unavailable', boundary);
  assert.equal(f.calls.length, 0, `${boundary}: no synchronous I/O before geometry/target prerequisites`);
}
for (const outcome of ['deferred', 'failed']) {
  const { o } = ownerFixture(); o.beginMeasurement = () => { o.phase = outcome === 'failed' ? 'failed' : 'measuring'; };
  assert.equal(o.restorePersistedFirstPresentation(1), outcome, 'ownership of pending work does not claim first-build success');
}
{
  const { o, f, events } = ownerFixture();
  o.readerSettingsSnapshot.navigationMode = 'continuous';
  const source = `reader-local-epub://${Buffer.from('local:' + 'a'.repeat(64)).toString('base64')}/${Buffer.from('logo.png').toString('base64')}`;
  Object.assign(f.data, { content: '\uFFFC\n正文', blocks: [
    { kind: 'image', source, startScalar: 0, endScalar: 1 },
    { kind: 'text', text: '\n正文', startScalar: 1, endScalar: 4 },
  ], documentWindow: { startScalar: 0, endScalar: 4, totalScalars: 4, requestedScalar: 0 } });
  Object.assign(f.data.progress, { chapterOffset: 0, chapterProgress: 0 });
  assert.equal(o.restorePersistedFirstPresentation(1), 'unavailable',
    'unknown continuous geometry keeps the existing async path instead of inventing list heights');
  assert.equal(events.includes('measure'), false); assert.equal(o.chapter, undefined);
  assert.equal(o.phase, 'loading'); assert.equal(o.visibleFragments.length, 0);
}
console.log('PASS persisted first build: real synchronous DTO/gateway, Unicode/scope/limits/paragraph guards, resource prerequisites and distinct ready/deferred/failed outcomes');
