import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';

const samples = []; let time = 10;
const trace = ReaderStartupTrace.install(() => time++, sample => samples.push(sample));
const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  ['openReading', 'readingReadyCallback', 'presentPreparedReading'],
  { ReaderStartupTrace, LOCAL_SOURCE_ID: 'local' });
const runtime = {};
const ReadingEntry = actualReadingEntryPresentation();
const entry = Object.assign(new ReadingEntry(), { book: { sourceId: 'local', bookId: 'a' } });
const index = Object.assign(new Index(), { readingEntry: entry, mountedRuntimeOwner: runtime,
  currentReadingRuntime: () => runtime, isCurrentRuntime: owner => owner === runtime,
  navigationOwner: new ReaderNavigation(), navigationGeneration: 0, shelfReadingPreparation: false,
  shelfMotion: { pendingExitId: -1 }, shelfMutations: { snapshot: { removalKey: '' } },
  bindReadingEntryReader() {}, scheduleNavigationBackfillAfterReady() {},
  nextNavigationGeneration() { this.navigationGeneration = this.navigationOwner.advance().generation; },
  navigateTo(route) { this.route = this.navigationOwner.show(route).route; },
});

index.openReading(undefined);
const firstId = trace.currentEntryId(), first = index.readingReadyCallback('local', 'a', entry.readyGeneration);
entry.book = { sourceId: 'local', bookId: 'b' };
index.openReading(undefined);
const secondId = trace.currentEntryId();
first(0);
assert.equal(samples.some(s => s.stage === 'reader.model-ready'), false, 'late ready for the old book cannot complete the new entry');
const second = index.readingReadyCallback('local', 'b', entry.readyGeneration);
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId]);
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId]);

index.openReading(undefined);
const thirdId = trace.currentEntryId();
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId],
  'same-book reentry must reject an earlier mount callback too');
const third = index.readingReadyCallback('local', 'b', entry.readyGeneration);
entry.sessionActive = false; third(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId],
  'exit closes the ready callback boundary');
assert.notEqual(firstId, secondId); assert.notEqual(secondId, thirdId);

const Reading = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
  ['captureStartupEntryTrace', 'traceStartupReadingPhase', 'traceInitialReadingPhase'],
  { ReaderStartupTrace, hilog: { info() {} } });
const reading = Object.assign(new Reading(), { startupTraceEntryId: 0, initialReadingTraceStartedAt: 0,
  initialReadingTraceDelivered: false, initialReadingTraceLifecycle: 1, lifecycleToken: 1 });
reading.captureStartupEntryTrace();
trace.beginEntry();
reading.traceInitialReadingPhase('input-ready', 1);
assert.equal(samples.at(-1).entryId, thirdId, 'mounted reader keeps its own entry identity');
assert.equal(samples.at(-1).stage, 'reader.input-ready');
const before = samples.length;
reading.lifecycleToken = 2; reading.traceInitialReadingPhase('ready-deliver', 1);
assert.equal(samples.length, before, 'old lifecycle remains silent');
assert.ok(samples.every(s => s.evidence === 'application-code'));
assert.equal(JSON.stringify(samples).includes('"bookId"'), false);
console.log('PASS startup-to-entry trace correlation, stale and same-book ready rejection, mounted lifecycle isolation; no pixel claims');
