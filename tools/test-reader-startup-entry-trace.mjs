import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';

const samples = []; let time = 10;
const trace = ReaderStartupTrace.install(() => time++, sample => samples.push(sample));
const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  ['beginReadingStartupTrace', 'traceStartupStage', 'readingReadyCallback', 'presentPreparedReading'],
  { ReaderStartupTrace, LOCAL_SOURCE_ID: 'local' });
const index = Object.assign(new Index(), { readingReadyGeneration: 0, startupEntryId: 0,
  readingSessionActive: true, detailBook: { sourceId: 'local', bookId: 'a' },
  route: 'reading', preparedReaderRoute: 'reading', shelfReadingPreparation: false,
  shelfEntryTraceStartedAt: 0 });

index.beginReadingStartupTrace();
const firstId = index.startupEntryId, first = index.readingReadyCallback('local', 'a', index.readingReadyGeneration);
index.detailBook = { sourceId: 'local', bookId: 'b' };
index.beginReadingStartupTrace();
const secondId = index.startupEntryId;
first(0);
assert.equal(index.startupEntryId, secondId, 'late ready for the old book cannot mark the new entry complete');
assert.equal(samples.some(s => s.stage === 'reader.model-ready'), false);
const second = index.readingReadyCallback('local', 'b', index.readingReadyGeneration);
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId]);
assert.equal(index.startupEntryId, 0);

index.beginReadingStartupTrace();
const thirdId = index.startupEntryId;
second(0);
assert.equal(index.startupEntryId, thirdId, 'same-book reentry must reject an earlier mount callback too');
const third = index.readingReadyCallback('local', 'b', index.readingReadyGeneration);
index.readingSessionActive = false; third(0);
assert.equal(index.startupEntryId, thirdId, 'exit closes the ready callback boundary');
assert.notEqual(firstId, secondId); assert.notEqual(secondId, thirdId);

const Reading = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
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
