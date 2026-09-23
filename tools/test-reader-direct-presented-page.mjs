import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as rapid from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';

// Production presentation and receipt code; RPC completion is explicitly
// controlled. This proves model/input ownership, never compositor timing.
const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const text = readFileSync(source, 'utf8');
const anchorStart = text.indexOf('class CoreReadingAnchor implements');
const anchorEnd = text.indexOf('\nclass ', anchorStart + 1);
const CoreReadingAnchor = new Function(stripTypeScriptTypes(text.slice(anchorStart, anchorEnd)) + ';return CoreReadingAnchor;')();
const methods = ['completeFirstPage', 'publishMeasuredFirstPage', 'persistOrdinaryFirstPage',
  'isOrdinaryFirstPagePresentationCurrent', 'markOrdinaryPageMeasurement', 'isOrdinaryPageMeasurement',
  'canPresentOrdinaryPage', 'canTurnPage', 'measureCommittedPageAt', 'awaitOrdinaryFirstPagePersistence'];
const Owner = productionMotionMethods(source, methods, { CoreReadingAnchor, hilog: { error() {} } });
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
function fixture() {
  const writes = [], commits = [], events = [];
  const chapter = { chapterIndex: 1, chapterTitle: '章', bodyVersion: 'body', processingVersion: 'processing' };
  const gateway = {
    capable: true,
    canPersistPresentedProgress() { return this.capable; },
    persistPresentedProgress(_book, _title, anchor, layout) { const gate = deferred(); writes.push({ anchor, layout, gate }); return gate.promise; },
    runProgressCommitSerial: async fn => { events.push('strong'); await fn(); },
    resolveAndUpdateProgress: async (_book, _title, anchor) => ({ bookId: 'book', ...anchor }),
    awaitPresentedProgressPersistence: async () => undefined,
  };
  const old = { startScalar: 0, endScalar: 10, fragments: [{ text: 'old' }] };
  const o = Object.assign(new Owner(), {
    mounted: true, exitRequested: false, lifecycleToken: 1, chapterSelectionToken: 2,
    materializedChapterSelectionToken: 2, chapter, visiblePage: old, visiblePageSelectionToken: 2,
    visibleFragments: old.fragments, phase: 'ready', bookId: 'book', sourceId: 'source',
    readerSettingsSnapshot: { navigationMode: 'paged' }, signature: 'layout', measurementCompleting: false,
    pageTurnRenderRevision: 0, firstPageCompletionRetryCount: 0, desiredChapterOffset: 0,
    activeGateway: () => gateway, sessionGateway: gateway, requireChapter: () => chapter,
    requireChapterLayoutMap: () => ({ scalarCount: () => 300 }),
    paginationLayoutSignature() { return this.signature; }, coreLayout: () => ({ fontSize: 20 }),
    isMeasurementCurrent(_g, s, l) { return this.phase === 'measuring' && s === this.chapterSelectionToken && l === this.lifecycleToken; },
    isMountedToken(l) { return this.mounted && l === this.lifecycleToken; }, isReaderIdentityCurrent: () => true,
    isSelectionActive(l, s) { return l === this.lifecycleToken && s === this.chapterSelectionToken; },
    paginationIndex: { finishMeasurement() {} }, lastVisibleScalar: () => 299,
    beginMeasurement() { this.phase = 'measuring'; }, controlVisible: () => false,
    releaseUnretainedReadingImages() {}, isChapterFirstPageStart: start => start === 0,
    cancelFirstPageReadyDeadline() {}, cancelFirstPageCompletionDeadline() {}, beginReadingRecordClock() {},
    finishPageTurnPerf() {}, schedulePageTurnPreparation() { events.push('prepare'); },
    notifyReadingPresentationReady: () => true, notifyControlSelectionReadingReady: () => true,
    prefetchNextChapter() {}, completeRapidPageTurnTransaction() { events.push('rapid'); },
    drainRapidPageTurn() {}, onAutoPagePageCommitted() { events.push('auto'); }, resumeDeferredMeasurement() {},
    admitCommittedProgress(p) { commits.push(p); }, completeControlSelectionAfterCommit() {},
    resumeSupersededAppearanceMeasurement: () => false,
    errorMessage: e => e.message, fail(e) { throw e; },
  });
  return { o, chapter, gateway, old, writes, commits, events,
    present(offset) {
      o.measureCommittedPageAt(offset);
      const page = { startScalar: offset, endScalar: offset + 10, fragments: [{ text: `page-${offset}` }] };
      o.measurementCompleting = true;
      return { page, completion: o.completeFirstPage(page, 3, 2, 1) };
    } };
}
{
  const f = fixture();
  const first = f.present(10);
  assert.equal(f.writes.length, 1); assert.equal(f.o.visiblePage, first.page);
  assert.equal(f.o.phase, 'ready'); assert.equal(f.o.canTurnPage(), true, 'native layout completed, input does not await RPC');
  await flush();
  assert.deepEqual(f.events, ['prepare', 'rapid', 'auto']);
  const second = f.present(20);
  assert.equal(f.o.visiblePage, second.page); assert.equal(f.writes.length, 2);
  await flush();
  f.writes[0].gate.resolve({ bookId: 'book', chapterIndex: 1, chapterOffset: 10 });
  await first.completion;
  assert.equal(f.o.visiblePage, second.page); assert.equal(f.commits.length, 0, 'old receipt cannot acknowledge the new display');
  assert.equal(f.events.filter(e => e === 'auto').length, 2, 'late receipt cannot re-arm another automatic turn');
  f.writes[1].gate.resolve({ bookId: 'book', chapterIndex: 1, chapterOffset: 20 });
  await second.completion;
  assert.equal(f.commits.length, 1); assert.equal(f.commits[0].chapterOffset, 20);
  assert.equal(f.o.canTurnPage(), true);
}
{
  const f = fixture(); const pending = f.present(30);
  f.writes[0].gate.reject(new Error('reply unknown')); await pending.completion;
  assert.equal(f.o.visiblePage, pending.page); assert.equal(f.o.canTurnPage(), true);
  assert.equal(f.commits.length, 0, 'a failed receipt never claims durable progress');
  let waited = false; const gate = deferred();
  f.gateway.awaitPresentedProgressPersistence = () => { waited = true; return gate.promise; };
  const barrier = f.o.awaitOrdinaryFirstPagePersistence(); let settled = false; void barrier.then(() => { settled = true; });
  await flush(); assert.equal(waited, true); assert.equal(settled, false, 'exit/content mutation still awaits the owner');
  gate.resolve({ bookId: 'book', chapterIndex: 1, chapterOffset: 30 }); await barrier;
  assert.equal(f.commits.length, 1);
}
{
  const f = fixture();
  const Rapid = productionMotionMethods(source, ['drainRapidPageTurn', 'completeRapidPageTurnTransaction'], {
    ...rapid, readerPageTransitionUsesPreparedPages: () => false,
  });
  f.o.drainRapidPageTurn = Rapid.prototype.drainRapidPageTurn;
  f.o.completeRapidPageTurnTransaction = Rapid.prototype.completeRapidPageTurnTransaction;
  Object.assign(f.o, { activePagePointerId: -1, pageTurnTransactionSerial: 0,
    rapidPageTurnState: rapid.enqueueReaderRapidPageTurn(rapid.createReaderRapidPageTurnState(), 'next'),
    performPageTurn() { f.present(10); return { kind: 'started' }; } });
  assert.equal(f.o.drainRapidPageTurn().kind, 'started');
  assert.equal(f.o.rapidPageTurnState.inFlightDirection, 'next', 'caller records ownership after synchronous native layout returns');
  await flush();
  assert.equal(f.o.rapidPageTurnState.inFlightDirection, undefined, 'same-turn completion runs after caller admission, without awaiting save');
  assert.equal(f.o.rapidPageTurnState.pendingDelta, 0);
  assert.equal(f.o.pageTurnTransactionSerial, 1);
  f.writes[0].gate.resolve({ bookId: 'book', chapterIndex: 1, chapterOffset: 10 }); await flush();
  assert.equal(f.o.pageTurnTransactionSerial, 1, 'receipt cannot synthesize a duplicate transaction');
}
for (const kind of ['no-ticket', 'layout', 'selection', 'lifecycle', 'chapter', 'old-core', 'source-switch', 'control', 'migration', 'continuous']) {
  const f = fixture(); f.o.markOrdinaryPageMeasurement(1);
  if (kind === 'no-ticket') f.o.ordinaryPageMeasurementSelection = -1;
  if (kind === 'layout') f.o.signature = 'different';
  if (kind === 'selection') f.o.ordinaryPageMeasurementSelection = 7;
  if (kind === 'lifecycle') f.o.ordinaryPageMeasurementLifecycle = 7;
  if (kind === 'chapter') f.o.ordinaryPageMeasurementChapter = 7;
  if (kind === 'old-core') f.gateway.capable = false;
  if (kind === 'source-switch') f.o.sourceSwitchTransactionId = 'switch';
  if (kind === 'control') f.o.pendingControlSelection = { selectionToken: 2 };
  if (kind === 'migration') f.chapter.positionMigration = { status: 'committed' };
  if (kind === 'continuous') f.o.readerSettingsSnapshot.navigationMode = 'continuous';
  assert.equal(f.o.isOrdinaryPageMeasurement(f.chapter, 2, 1), false, `${kind} cannot borrow a direct-turn lease`);
}
console.log('PASS production direct-page presentation: exact intent, input before receipt, late/unknown writes, strong boundaries and exit owner barrier');
