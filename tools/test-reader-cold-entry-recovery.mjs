import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const file = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);

function timers() {
  let serial = 0; const pending = new Map(), issued = [];
  return { pending, issued,
    setTimeout(fn, delay) { const id = ++serial; const task = { id, fn, delay }; pending.set(id, task); issued.push(task); return id; },
    clearTimeout(id) { pending.delete(id); },
    fire() { const task = pending.values().next().value; assert.ok(task, 'one scheduled callback'); pending.delete(task.id); task.fn(); return task; },
  };
}
async function actual(names, dependencies = {}) {
  const { selectedProductionMethods, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const constants = selectedProductionValues(file, ['FIRST_PAGE_COMPLETION_DEADLINE_MS', 'FIRST_PAGE_COMPLETION_MAX_RETRIES',
    'PAGE_TURN_PREPARATION_RETRY_BASE_MS', 'PAGE_TURN_PREPARATION_RETRY_MAX_MS', 'PAGE_TURN_PREPARATION_RETRY_LIMIT']);
  for (const [name, value] of Object.entries(constants)) assert.ok(Number.isSafeInteger(value) && value > 0, `valid actual policy ${name}`);
  return { Type: selectedProductionMethods(file, 'ReadingExperience', names, { ...constants, ...dependencies }), constants };
}
async function preparationContextCase() {
  class Preparation { constructor(...args) { this.args = args; } }
  class Context { constructor(...args) { this.args = args; } }
  const { Type } = await actual(['beginPageTurnPreparation'], { ReaderPageTurnPreparation: Preparation,
    ReaderMaterializedChapterContext: Context, readingChapterLayoutMap: chapter => chapter.fixtureLayout });
  function fixture() {
    const map = { scalarCount: () => 10 }, chapter = { chapterIndex: 1, content: 'abcdefghij', contentVersion: 'v1' };
    const origin = { layoutMap: map, paragraphRanges: ['retained'], paginationDraft: {} }, page = { startScalar: 2 };
    const measurements = [], versions = [], requests = [];
    const owner = Object.assign(new Type(), { visiblePage: page, chapter, phase: 'ready', pageTurnGeneration: 3, lifecycleToken: 4,
      canTurnPage: () => true, chapterWindow: { get: () => undefined }, captureMaterializedChapterContext: () => origin,
      lastVisibleScalar: () => 9, admitChapterContentVersion: (...args) => versions.push(args),
      requestPageTurnChapter: (...args) => requests.push(args), beginMeasurement: token => measurements.push(token) });
    return { owner, chapter, origin, page, measurements, versions, requests };
  }
  const rejected = fixture();
  assert.equal(rejected.owner.beginPageTurnPreparation('next', { chapterIndex: 1, chapterOffset: 99 }), 'retry');
  assert.equal(rejected.owner.adjacentMeasurementContext, undefined); assert.equal(rejected.owner.pageTurnPreparation, undefined);
  assert.strictEqual(rejected.owner.chapter, rejected.chapter); assert.strictEqual(rejected.owner.visiblePage, rejected.page);
  assert.deepEqual(rejected.measurements, [4], 'tail rejection discards only speculative measurement context');
  const admitted = fixture();
  admitted.owner.beginMeasurement = token => { admitted.measurements.push(token); admitted.owner.phase = 'measuring'; };
  assert.equal(admitted.owner.beginPageTurnPreparation('next', { chapterIndex: 1, chapterOffset: 99 }), 'begun');
  assert.ok(admitted.owner.pageTurnPreparation instanceof Preparation);
  assert.strictEqual(admitted.owner.pageTurnPreparation.args[1], admitted.origin);
  assert.equal(admitted.owner.adjacentMeasurementContext.args[5], 9); assert.equal(admitted.owner.adjacentMeasurementContext.args[6], .9);
  const absent = fixture(); assert.equal(absent.owner.beginPageTurnPreparation('next', { chapterIndex: 2, chapterOffset: 0 }), 'abandon');
  assert.deepEqual(absent.requests, [['next', 2]]); assert.deepEqual(absent.measurements, []);
  for (const mutate of [f => { f.owner.visiblePage = undefined; }, f => { f.owner.chapter = undefined; }, f => { f.owner.canTurnPage = () => false; }]) {
    const f = fixture(); mutate(f); assert.equal(f.owner.beginPageTurnPreparation('next', { chapterIndex: 1, chapterOffset: 0 }), 'retry');
    assert.deepEqual(f.measurements, []); assert.equal(f.owner.pageTurnPreparation, undefined);
  }
}
async function retryQueueCase() {
  const { readerPageTransitionUsesPreparedPages } = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
  async function fixture(outcome = 'retry') {
    const clock = timers(), attempts = [], refreshes = [];
    const { Type, constants } = await actual(['drainPageTurnPreparationQueue', 'cancelPageTurnPreparationRetry'],
      { readerPageTransitionUsesPreparedPages, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
    const owner = Object.assign(new Type(), { sessionLaunchRenderWorkBlocked: () => false,
      pageTurnPreparationQueue: ['next'], pageTurnGestureState: { phase: 'idle' }, readerSettingsSnapshot: { navigationMode: 'paged' },
      canTurnPage: () => true, preparedPageTurn: () => undefined, adjacentPageTurnTarget: () => ({ chapterIndex: 1, chapterOffset: 5 }),
      beginPageTurnPreparation: direction => { attempts.push(direction); return outcome; }, scheduleBookTurnTextureRefresh: () => refreshes.push(true),
      pageTurnPreparationRetryTimer: -1, pageTurnPreparationRetryCount: 0, pageTurnGeneration: 3, chapterSelectionToken: 4 });
    return { owner, clock, attempts, refreshes, constants };
  }
  const f = await fixture(); f.owner.drainPageTurnPreparationQueue();
  assert.deepEqual(f.owner.pageTurnPreparationQueue, ['next']); assert.equal(f.attempts.length, 1); assert.equal(f.clock.pending.size, 1);
  for (let step = 0; f.clock.pending.size && step <= f.constants.PAGE_TURN_PREPARATION_RETRY_LIMIT; step++) f.clock.fire();
  assert.equal(f.clock.pending.size, 0); assert.deepEqual(f.owner.pageTurnPreparationQueue, []); assert.equal(f.owner.pageTurnPreparationRetryCount, 0);
  assert.equal(f.attempts.length, f.constants.PAGE_TURN_PREPARATION_RETRY_LIMIT + 1, 'retry policy terminates without an immediate spin loop');
  assert.ok(f.clock.issued.every(task => task.delay > 0 && task.delay <= f.constants.PAGE_TURN_PREPARATION_RETRY_MAX_MS));
  for (const key of ['pageTurnGeneration', 'chapterSelectionToken']) {
    const stale = await fixture(); stale.owner.drainPageTurnPreparationQueue(); stale.owner[key]++;
    stale.clock.fire(); assert.equal(stale.attempts.length, 1); assert.deepEqual(stale.owner.pageTurnPreparationQueue, []); assert.equal(stale.clock.pending.size, 0);
  }
  const cancelled = await fixture(); cancelled.owner.drainPageTurnPreparationQueue(); cancelled.owner.cancelPageTurnPreparationRetry();
  assert.equal(cancelled.clock.pending.size, 0); assert.equal(cancelled.owner.pageTurnPreparationRetryCount, 0);
  for (const outcome of ['begun', 'abandon']) {
    const ready = await fixture(outcome); ready.owner.drainPageTurnPreparationQueue();
    assert.equal(ready.clock.pending.size, 0); assert.deepEqual(ready.owner.pageTurnPreparationQueue, []);
  }
}
async function completionWatchdogCase() {
  function fixtureFactory(Type, clock) {
    const failures = [], measurements = []; let invalidations = 0;
    const owner = Object.assign(new Type(), { mounted: true, exitRequested: false, phase: 'measuring', measurementCompleting: true,
      batchProcessing: true, firstPageCompletionGeneration: 0, firstPageCompletionDeadlineTimer: -1, firstPageCompletionRetryCount: 0,
      lifecycleToken: 8, physicalPagination: { index: { invalidateMeasurement: () => invalidations++ } },
      beginMeasurement: token => { measurements.push(token); owner.measurementCompleting = true; }, fail: (...args) => failures.push(args) });
    return { owner, failures, measurements, invalidations: () => invalidations };
  }
  const clock = timers();
  const { Type, constants } = await actual(['armFirstPageCompletionDeadline', 'cancelFirstPageCompletionDeadline'],
    { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const f = fixtureFactory(Type, clock); f.owner.armFirstPageCompletionDeadline();
  assert.equal(clock.pending.size, 1); assert.equal(f.measurements.length, 0);
  for (let attempt = 0; attempt <= constants.FIRST_PAGE_COMPLETION_MAX_RETRIES; attempt++) clock.fire();
  assert.equal(f.measurements.length, constants.FIRST_PAGE_COMPLETION_MAX_RETRIES); assert.equal(f.invalidations(), f.measurements.length);
  assert.equal(f.failures.length, 1); assert.match(f.failures[0][0].message, /READING_FIRST_PAGE_COMPLETION_TIMEOUT/); assert.equal(f.failures[0][1], 8);
  assert.equal(clock.pending.size, 0); assert.equal(f.owner.firstPageCompletionRetryCount, 0);
  const staleClock = timers(); const staleType = (await actual(['armFirstPageCompletionDeadline', 'cancelFirstPageCompletionDeadline'],
    { setTimeout: staleClock.setTimeout, clearTimeout: staleClock.clearTimeout })).Type;
  const stale = fixtureFactory(staleType, staleClock); stale.owner.armFirstPageCompletionDeadline(); const retired = staleClock.issued[0].fn;
  stale.owner.cancelFirstPageCompletionDeadline(); retired(); assert.equal(stale.measurements.length, 0); assert.equal(stale.failures.length, 0);
  for (const mutate of [owner => { owner.mounted = false; }, owner => { owner.exitRequested = true; }, owner => { owner.phase = 'ready'; }, owner => { owner.measurementCompleting = false; }]) {
    const localClock = timers(); const Local = (await actual(['armFirstPageCompletionDeadline', 'cancelFirstPageCompletionDeadline'],
      { setTimeout: localClock.setTimeout, clearTimeout: localClock.clearTimeout })).Type;
    const current = fixtureFactory(Local, localClock); current.owner.armFirstPageCompletionDeadline(); mutate(current.owner); localClock.fire();
    assert.equal(current.measurements.length, 0); assert.equal(current.failures.length, 0); assert.equal(localClock.pending.size, 0);
  }
}
const cases = { 'preparation-context': preparationContextCase, 'retry-queue': retryQueueCase, 'completion-watchdog': completionWatchdogCase };
for (const id of selectContractCases({
  'preparation-context': { description: 'Actual preparation admission preserves visible context on rejected/begun/missing target paths', resources: [] },
  'retry-queue': { description: 'Actual bounded retry queue with controlled timer, generation/token cancellation and no spin', resources: [] },
  'completion-watchdog': { description: 'Actual completion watchdog retries/invalidation/failure and stale/cancel/lifecycle predicates', resources: [] },
})) { await cases[id](); recordContractCasePass(id); }
