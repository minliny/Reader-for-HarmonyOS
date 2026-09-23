import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { copyReaderAppearanceSnapshot, createDefaultReaderAppearanceSnapshot } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

// Run the production barriers with independently controlled settings, body,
// progress and commit completion. Logging must not admit a page early.
const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const mapSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts', import.meta.url), 'utf8')
  .replace('constructor(private readonly content: string) {', 'constructor(content: string) { this.content = content;');
const { ReadingSurfaceLayoutMap } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const logs = [];
let failLogging = false;
const hilog = { info(...args) { if (failLogging) throw Error('diagnostic sink unavailable'); logs.push(args); }, error() {} };
class Page { constructor(fragments, startScalar, endScalar, contentHeight, bodyCapacity) { Object.assign(this, { fragments, startScalar, endScalar, contentHeight, bodyCapacity }); } }
class Anchor {}
const Owner = productionMotionMethods(source, ['loadInitialReading', 'traceInitialReadingPhase',
  'loadInitialChapter', 'openChapter', 'loadReaderSettingsSnapshot', 'applyInitialReaderWindowPolicy', 'beginFirstPageCommit',
  'completeFirstPage', 'publishMeasuredFirstPage', 'measuredPageEndLimit', 'retainMeasuredParagraphWindow', 'isOrdinaryPageMeasurement',
  'persistOrdinaryFirstPage', 'isOrdinaryFirstPagePresentationCurrent', 'awaitOrdinaryFirstPagePersistence',
  'notifyReadingPresentationReady', 'notifyControlSelectionReadingReady', 'isVisiblePageCurrent', 'resumeSupersededAppearanceMeasurement'], {
  ReadingSurfaceLayoutMap, hilog, CoreReadingAnchor: Anchor, PhysicalReadingPage: Page,
  LOCAL_READING_SOURCE_ID: 'local',
  copyReaderAppearanceSnapshot,
  RemoteChapterCacheRefreshError: class extends Error {},
});

for (const throwingSink of [false, true]) {
  failLogging = throwingSink;
  logs.length = 0;
  const progress = deferred(), body = deferred(), window = deferred(), commit = deferred();
  const events = [], failures = [];
  const chapter = { chapterIndex: 0, chapterTitle: 'private-title', content: 'private-body', images: [], contentVersion: 'v' };
  const owner = Object.assign(new Owner(), {
    bookId: 'private-book', sourceId: 'private-source', lifecycleToken: 1, chapterSelectionToken: 1,
    materializedChapterSelectionToken: 1, visiblePageSelectionToken: 1,
    mounted: true, visibleFragments: [], readerSettingsMutationGeneration: 0, measurementBatch: [], measurementEpoch: 0,
    readerSettingsSnapshot: { navigationMode: 'paged' }, pendingPageFragments: [{ text: 'private-body' }],
    appearanceSnapshot: createDefaultReaderAppearanceSnapshot(), paginationLayoutSignature: () => 'measured-layout',
    pendingPageStartScalar: 0, pendingPageEndScalar: 3, pendingPageHeight: 10,
    isSessionActive: token => token === 1,
    isMountedToken: token => token === 1,
    isReaderIdentityCurrent: () => true,
    isSelectionCurrent: selection => selection === 1,
    isSelectionActive: (token, selection) => token === 1 && selection === 1,
    ensureReadingSession: async () => {},
    isMeasurementCurrent: (generation, selection, token) => generation === 1 && selection === 1 && token === 1,
    loadAppearanceSnapshot: async () => {}, readerSettingsGateway: { load: async () => ({ navigationMode: 'paged' }) },
    configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {},
    applyReaderWindowPolicy: () => window.promise,
    activeGateway: () => ({ loadProgress: () => progress.promise,
      persistPresentedProgress: () => commit.promise,
      runProgressCommitSerial: operation => operation(), resolveAndUpdateProgress: () => commit.promise }),
    loadInitialToc: async () => ({ entries: [{ index: 0 }] }),
    loadSessionChapter: () => { events.push('body-request'); return body.promise; },
    admitTocEntries(entries) { this.tocEntries = entries; }, readingTocEntries() { return this.tocEntries; }, onDirectoryProjectionChanged() {},
    chapterWindow: { configure() {}, setCurrent() {} }, normalizedRequestedChapter: () => undefined,
    requireKnownChapter: () => 0, ensureCurrentContentMetrics: async () => true,
    admitChapterContentVersion() {}, retainCurrentChapterWindow() {}, rebuildChapterImageIndexes() {},
    configureRestoredAnchor() {}, hasMeasuredViewport: () => true, beginMeasurement: () => events.push('measured'),
    notifyPreservedContentRefresh() {}, fail: error => failures.push(error.message),
    errorMessage: error => error.message,
    observeMeasuredPhysicalPage() {}, pendingPageBodyCapacity: () => 100, cancelMeasurementDeadline() {},
    continueCanonicalModeMeasurement: () => false, armFirstPageCompletionDeadline() {},
    requireChapter() { return this.chapter; }, requireChapterLayoutMap: () => ({ scalarCount: () => 12 }), coreLayout: () => ({}),
    measuringChapter() { return this.chapter; }, requireMeasurementChapter() { return this.chapter; },
    measuringDraft: () => undefined, measurementPaginationKey: () => ({}), measuringRequestedAnchor: () => 0,
    nativeTextMeasurement: { clear() {} },
    releaseUnretainedReadingImages() {}, isChapterFirstPageStart: () => true, beginReadingRecordClock() {}, finishPageTurnPerf() {},
    paginationIndex: { finishMeasurement() {}, findContainingPage: () => undefined },
    cancelFirstPageReadyDeadline() {}, cancelFirstPageCompletionDeadline() {}, schedulePageTurnPreparation() {},
    admitCommittedProgress() {}, completeControlSelectionAfterCommit() {}, isStableVisiblePageOwner: () => true,
    onChapterCommitted: () => events.push('chapter-committed'), onReadingReady: () => events.push('ready'),
    scheduleTtsPresentationWarmup() {}, prefetchNextChapter() {}, completeRapidPageTurnTransaction() {},
    drainRapidPageTurn() {}, onAutoPagePageCommitted() {}, resumeDeferredMeasurement() {},
  });
  const loading = owner.loadInitialReading(1);
  await settle();
  assert.deepEqual(events, [], 'progress remains a chapter-selection barrier');
  progress.resolve({ kind: 'missing' });
  await settle();
  assert.deepEqual(events, ['body-request'], 'body I/O overlaps pending native window policy');
  body.resolve(chapter);
  await settle();
  assert.equal(owner.chapter, chapter, 'available body must not wait for system window callbacks');
  assert.deepEqual(events, ['body-request', 'measured']);
  window.resolve();
  await loading;
  assert.deepEqual(events, ['body-request', 'measured']);
  owner.beginFirstPageCommit(1, 1, 1);
  await settle();
  assert.equal(events.includes('ready'), true, 'readable presentation never waits for progress confirmation');
  assert.equal(events.includes('chapter-committed'), false, 'durable chapter notification still awaits storage');
  assert.equal(owner.visibleFragments[0].text, 'private-body', 'measured body paints while progress confirmation is pending');
  if (!throwingSink) {
    assert.deepEqual(logs.slice(-3).map(args => args[3]), ['presentation-submit', 'input-ready', 'ready-deliver'],
      'submitted model and unlocked input must be distinguishable from pending persistence');
    assert.equal(logs.some(args => args[3] === 'body-presented'), false,
      'model publication cannot claim a compositor-presented frame');
  }
  commit.resolve({ chapterIndex: 0, chapterOffset: 0 });
  await settle();
  assert.deepEqual(events, ['body-request', 'measured', 'ready', 'chapter-committed']);
  assert.deepEqual(failures, [], 'diagnostic exceptions cannot fail first-page preparation');
  if (!throwingSink) {
    const phases = logs.map(args => args[3]);
    assert.deepEqual(phases, ['start', 'settings-read', 'layout-ready', 'initial-progress', 'chapter-ready',
      'settings-window', 'first-layout-ready', 'presentation-submit', 'input-ready', 'ready-deliver', 'first-persist']);
    assert.equal(JSON.stringify(logs).includes('private-'), false, 'milestones contain no reading identity/content');
    owner.traceInitialReadingPhase('first-persist', 1);
    assert.equal(logs.length, phases.length, 'later page commits do not emit entry milestones');
  }
}

failLogging = false;
logs.length = 0;
const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  ['openShelfBook', 'traceShelfEntryPhase', 'openReading', 'presentPreparedReading'], { hilog, DOMAIN: 0x5244, LOCAL_SOURCE_ID: 'local',
    ReaderRuntimeOwner: { current: () => ({ noteReadingPreparationIntent() {} }) } });
const index = Object.assign(new Index(), {
  route: 'bookshelf', currentSourceSwitchTransactionId: () => 'recovering-transaction', navigationGeneration: 4, shelfEntryTraceAttempt: 0, shelfEntryTraceStartedAt: -1,
  bookshelfRemovalActiveKey: '', isKnownDetailChapter: () => true, sourceDisplayName: () => 'private-source-name',
  openRemoteBookDetail() { this.shelfReadingPreparation = true; this.remoteReadingSession = {}; },
  nextNavigationGeneration() { return ++this.navigationGeneration; }, detailBook: { sourceId: 'remote', bookId: 'private-book' },
});
index.openShelfBook({ sourceId: 'remote', bookId: 'private-book', title: 'private-title' });
index.openReading(undefined);
assert.equal(index.route, 'reading', 'mount request immediately opens the normal reader; body-ready remains a separate barrier');
index.presentPreparedReading(0);
assert.equal(index.route, 'reading');
assert.deepEqual(logs.map(args => args[3]), ['tap', 'reader-mount-request']);
assert.equal(new Set(logs.map(args => args[4])).size, 1, 'one anonymous attempt survives the mount navigation generation');
assert.equal(JSON.stringify(logs).includes('private-'), false);
index.traceShelfEntryPhase('present');
assert.equal(logs.length, 2, 'completed entry cannot log again');
console.log('production entry milestones: independent barriers, durable ready delivery, quiet later pages and throwing diagnostic sink PASS');
