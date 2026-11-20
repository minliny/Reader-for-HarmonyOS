import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const cases = selectContractCases({
  'content-read': 'Actual preparation fences and snapshot/catalog reads: refresh, cancellation, bounded recovery and storage errors',
  'reader-entry': 'Actual reader entry fallback preserves invalid identity/position failures',
  'window-recovery': 'Actual window expansion restarts versioned chapter opening and rejects retired callbacks',
  'title-layout': 'Actual title capacity and bounded native layout retry, including retired timer',
  'failure-kinds': 'Actual error adapter, classification and public hints for known failures',
});
if (cases.length) {
const productionRoot = new URL('../entry/src/main/ets/', import.meta.url).href;
const resolver = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(productionRoot) && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
    return next(specifier + '.ts', context);
  return next(specifier, context);
} });
try {
const base = '../entry/src/main/ets/features/reading/';
const { ReadingEntryPreparation } = await import(base + 'ReadingEntryPreparation.ts');
const { readReadingEntrySnapshot, readReadingCatalog } = await import(base + 'ReadingEntrySnapshot.ts');
const { RemoteReadingGatewayError: GatewayError, classifyRemoteReadingCommandFailure: classify } = await import(base + 'RemoteReadingContract.ts');
const { remoteReadingFailureKindOf: kind } = await import(base + 'RemoteContentAdmission.ts');
const { readingFailureHint: hint } = await import(base + 'ReadingFailurePresentation.ts');
const file = new URL(base + 'LocalReadingExperience.ets', import.meta.url);
const body = () => ({ kind: 'ready', sourceId: 's', bookId: 'b', chapterIndex: 0, chapterTitle: 'Chapter',
  content: 'ABCDE', blocks: [{ kind: 'text', startScalar: 0, endScalar: 5, text: 'ABCDE' }],
  positionScope: { sourceId: 's', bookId: 'b', chapterIndex: 0, bodyVersion: 'body', processingVersion: 'process' },
  progress: null, baseUrl: 'https://example.invalid/chapter', navigation: null });
function fixture() {
  let calls = 0;
  const runtime = { supportsCoreCapability: () => true,
    request: async () => { calls++; return { data: body() }; } };
  const preparation = new ReadingEntryPreparation(runtime, false); preparation.setPaused(true);
  runtime.captureReadingContentValidity = (s, b) => preparation.captureContentValidity(s, b);
  runtime.waitForReadingContentIdle = (s, b) => preparation.waitForContentIdle(s, b);
  return { runtime, preparation, calls: () => calls };
}
for (const id of cases) {
if (id === 'content-read') {
  for (const method of ['book.detail', 'book.toc']) {
    const f = fixture(); const params = { sourceId: 's', bookId: 'b' };
    f.preparation.beginRequest(method, params);
    const reading = readReadingEntrySnapshot(f.runtime, 's', 'b', undefined, () => true);
    assert.equal(f.calls(), 0, 'wait before reading an invalid epoch');
    f.preparation.finishRequest(method, params);
    assert.equal((await reading).chapter.content, 'ABCDE'); assert.equal(f.calls(), 1);
  }
  {
    const f = fixture(); let calls = 0;
    f.runtime.request = async () => {
      if (++calls === 1) { f.preparation.beginRequest('book.toc', { sourceId: 's', bookId: 'b' });
        f.preparation.finishRequest('book.toc', { sourceId: 's', bookId: 'b' }); }
      return { data: body() };
    };
    assert.equal((await readReadingEntrySnapshot(f.runtime, 's', 'b', undefined, () => true)).chapter.content, 'ABCDE');
    assert.equal(calls, 2, 'refresh during a read retries the whole snapshot');
  }
  {
    const f = fixture(); let current = true;
    f.preparation.beginRequest('book.detail', { sourceId: 's', bookId: 'b' });
    const reading = readReadingEntrySnapshot(f.runtime, 's', 'b', undefined, () => current);
    current = false; f.preparation.finishRequest('book.detail', { sourceId: 's', bookId: 'b' });
    await assert.rejects(reading, e => e.code === 'cancelled'); assert.equal(f.calls(), 0);
  }
  {
    const f = fixture(); let calls = 0;
    f.runtime.request = async () => { calls++; f.preparation.beginRequest('book.toc', { sourceId: 's', bookId: 'b' });
      f.preparation.finishRequest('book.toc', { sourceId: 's', bookId: 'b' }); return { data: body() }; };
    await assert.rejects(readReadingEntrySnapshot(f.runtime, 's', 'b', undefined, () => true), e => e.code === 'sourceVersionChanged');
    assert.equal(calls, 3, 'persistent mutation cannot create an infinite retry');
  }
  {
    const f = fixture(); const raw = Object.assign(new Error('disk'), { code: 'STORAGE_FAILURE' });
    f.runtime.request = async () => { throw raw; };
    await assert.rejects(readReadingEntrySnapshot(f.runtime, 's', 'b', undefined, () => true), e => kind(e) === 'STORAGE_FAILED' && e.causeValue === raw);
  }
  {
    const f = fixture(); let calls = 0;
    f.runtime.request = async (_method, p) => { calls++; assert.equal(p.offset, 0);
      return { data: calls === 1 ? { sourceId: 's', bookId: 'b', kind: 'changed' } : {
        sourceId: 's', bookId: 'b', kind: 'ready', revision: 'new', chapterCount: 1, offset: 0,
        entries: [{ index: 0, position: 0, readablePosition: 0, title: 'Chapter', navigable: true }] } }; };
    assert.equal((await readReadingCatalog(f.runtime, 's', 'b', () => true)).revision, 'new'); assert.equal(calls, 2);
  }
}
if (id === 'reader-entry') {
  const Reader = selectedProductionMethods(file, 'ReadingExperience', ['loadInitialChapter', 'tryInitialEntrySnapshot'], {
    LOCAL_READING_SOURCE_ID: 'local', RemoteReadingGatewayError: GatewayError, readingParagraphBoundaryMode: () => 'lineSeparated',
  });
  for (const error of [undefined, new GatewayError('cacheDerivedCorrupt', 'broken derivative'),
    new GatewayError('identityMismatch', 'wrong book'), new GatewayError('positionContextStale', 'stale anchor'),
    new GatewayError('storageFailure', 'disk')]) {
    let fallback = 0, opened = 0; const failures = [];
    const gateway = { hasPendingSourceSwitch: () => false, loadEntrySnapshot: async () => { if (error) throw error; },
      loadProgress: async () => ({ kind: 'missing' }) };
    const owner = Object.assign(new Reader(), { sourceId: 's', bookId: 'b', chapterSelectionToken: 1,
      isSelectionActive: () => true, activeGateway: () => gateway, normalizedRequestedChapter: () => undefined,
      loadInitialToc: async () => { fallback++; return { entries: [{ index: 0, title: 'Chapter' }] }; },
      traceInitialReadingPhase() {}, admitTocEntries() {}, onDirectoryProjectionChanged() {}, configureReadingChapterWindow() {},
      requireKnownChapter: () => 0, openChapter: async () => { opened++; }, fail: error => failures.push(error) });
    await owner.loadInitialChapter(1, Promise.resolve([]));
    if (!error || error.code === 'cacheDerivedCorrupt') { assert.equal(fallback, 1); assert.equal(opened, 1); assert.deepEqual(failures, []); }
    else { assert.equal(fallback, 0); assert.equal(opened, 0); assert.equal(failures[0], error); }
  }
}
if (id === 'window-recovery') {
  for (const retired of [false, true]) {
    let current = true, resolveIdle, opened;
    const runtime = { captureReadingContentValidity: () => () => false,
      waitForReadingContentIdle: () => new Promise(resolve => { resolveIdle = resolve; }) };
    const Reader = selectedProductionMethods(file, 'ReadingExperience', ['expandMeasurementParagraphWindow'], {
      ReaderRuntimeOwner: { current: () => runtime }, readingParagraphBoundaryMode: () => 'lineSeparated',
    });
    const chapter = { chapterIndex: 0, bodyVersion: 'body', processingVersion: 'process', documentRange: { startScalar: 0, endScalar: 5 } };
    const failures = [];
    const owner = Object.assign(new Reader(), { sourceId: 's', bookId: 'b', paragraphWindowRecoveryAttempts: 0,
      requireMeasurementChapter: () => chapter, measuringChapter: () => chapter, measuringOffset: () => 3,
      isMeasurementCurrent: () => current, isSelectionActive: () => current,
      cancelMeasurementDeadline() {}, nativeTextMeasurement: { clear() {} }, paragraphLayout: { batch: [] }, chapterWindow: { clear() {} },
      activeGateway: () => ({ loadParagraphWindow: async () => { throw new Error('reading paragraph window was cancelled'); } }),
      openChapter: async (...args) => { opened = args; }, fail: e => failures.push(e) });
    owner.expandMeasurementParagraphWindow('after', 1, 1, 1);
    await new Promise(resolve => setImmediate(resolve)); assert.ok(resolveIdle);
    current = !retired; resolveIdle(); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(failures, []);
    if (retired) assert.equal(opened, undefined);
    else { assert.equal(opened[4], 3); assert.deepEqual(opened[7], { bodyVersion: 'body', processingVersion: 'process', anchors: [{ id: 'requested', offset: 3 }] }); }
  }
}
if (id === 'title-layout') {
  const callbacks = [];
  const Reader = selectedProductionMethods(file, 'ReadingExperience', ['pendingPageBodyCapacity', 'measurementIncludesChapterTitle',
    'captureChapterTitleMeasurementAfterLayout', 'isMeasurementChapterFirstPageStart', 'retryNativeTextLayout'], {
    setTimeout: cb => callbacks.push(cb),
  });
  const owner = Object.assign(new Reader(), { measuringChapter: () => ({ chapterTitle: '', content: 'ABCDE' }),
    measuringRanges: () => [{ startScalar: 0, endScalar: 5 }], measuringRequestedAnchor: () => 0,
    physicalPagination: { startScalar: 0 }, readingLayout: () => ({ bodyHeightAfterTitle: n => 600 - n }) });
  assert.equal(owner.captureChapterTitleMeasurementAfterLayout(1), true); assert.equal(owner.pendingPageBodyCapacity(), 600);
  owner.measuringChapter = () => ({ chapterTitle: 'Title' });
  assert.throws(() => owner.pendingPageBodyCapacity(), /TITLE_MEASUREMENT_INVALID/);
  owner.measuredChapterTitleHeightVp = 40; assert.equal(owner.pendingPageBodyCapacity(), 560);
  let active = true, measured = 0;
  Object.assign(owner, { nativeTextLayoutRetryCount: 0, isSessionActive: () => active, currentMeasurementGeneration: () => 1,
    currentMeasurementSelection: () => 1, isMeasurementCurrent: () => active, beginMeasurement: () => measured++ });
  const error = new Error('NATIVE_TEXT_LAYOUT_UNAVAILABLE');
  assert.equal(owner.retryNativeTextLayout(error, 1), true); callbacks.shift()(); assert.equal(measured, 1);
  assert.equal(owner.retryNativeTextLayout(error, 1), true); active = false; callbacks.shift()(); assert.equal(measured, 1);
  active = true; assert.equal(owner.retryNativeTextLayout(error, 1), false);
  owner.nativeTextLayoutRetryCount = 0; assert.equal(owner.retryNativeTextLayout(new Error('NATIVE_TEXT_WIDTH_INVALID'), 1), false);
}
if (id === 'failure-kinds') {
  const { LocalReadingFlowGateway } = await import(base + 'LocalReadingFlowGateway.ts');
  const { readReadingDocumentWindow } = await import(base + 'ReadingDocumentWindow.ts');
  for (const [error, expected] of [[new Error('READING_POSITION_CONTEXT_STALE'), 'POSITION_CONTEXT_STALE'],
    [new Error('READING_CONTENT_EMPTY'), 'SOURCE_CONTENT_EMPTY'], [new Error('LOCAL_TOC_EMPTY'), 'SOURCE_TOC_EMPTY'],
    [new Error('PAGINATION_FIRST_PAGE_READY_TIMEOUT'), 'CONTENT_LOAD_FAILED'],
    [new Error('NATIVE_TEXT_LAYOUT_UNAVAILABLE'), 'LAYOUT_FAILED'],
    [new GatewayError('unsupportedHostCapability', 'unsupported'), 'HOST_CAPABILITY_UNSUPPORTED']]) {
    assert.equal(kind(error), expected);
    if (expected !== 'LAYOUT_FAILED') assert.ok(!hint(error.message, kind(error)).includes('调整阅读设置'));
  }
  for (const command of ['reading.entry.snapshot', 'reading.document.window', 'local_book.chapter.content']) {
    const raw = Object.assign(new Error('storage'), { event: { error: { code: 'STORAGE_FAILURE' } } });
    assert.equal(kind(classify(command, raw)), 'STORAGE_FAILED');
    assert.equal(classify(command, raw).causeValue, raw);
  }
  const raw = Object.assign(new Error('disk'), { code: 'STORAGE_FAILURE' });
  const runtime = { supportsCoreCapability: () => true, request: async () => { throw raw; } };
  const local = new LocalReadingFlowGateway(runtime);
  for (const read of [() => local.loadToc('b'), () => local.loadChapter('b', 0),
    () => local.loadContentMetrics('b'), () => local.loadProgress('b'),
    () => readReadingDocumentWindow(runtime, body().positionScope, 0, 100, () => true)]) {
    await assert.rejects(read(), e => kind(e) === 'STORAGE_FAILED' && e.causeValue === raw);
  }
}
recordContractCasePass(id);
}
} finally { resolver.deregister(); }
}
