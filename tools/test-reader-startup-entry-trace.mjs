import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readingEntryActionFixture } from './lib/reading-entry-action-fixture.mjs';
import { fixture } from './lib/reading-entry-index-fixture.mjs';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';

const samples = []; let time = 10;
const trace = ReaderStartupTrace.install(() => time++, sample => samples.push(sample));
const runtimeFixture = fixture();
const { actions, entry, retire } = readingEntryActionFixture({ runtime: runtimeFixture.runtime, route: 'detail' });
const localBook = bookId => ({ sourceId: 'local', bookId, title: 'Local book', author: 'Author' });
entry.book = localBook('a');
entry.verdict = 'readable';

actions.openReading(undefined);
const firstId = trace.currentEntryId(), first = actions.readingReadyCallback('local', 'a', entry.readyGeneration);
assert.ok(firstId > 0, 'reader opening starts an entry trace');
entry.book = localBook('b');
actions.openReading(undefined);
const secondId = trace.currentEntryId();
first(0);
assert.equal(samples.some(s => s.stage === 'reader.model-ready'), false, 'late ready for the old book cannot complete the new entry');
const second = actions.readingReadyCallback('local', 'b', entry.readyGeneration);
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId]);
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId]);

actions.openReading(undefined);
const thirdId = trace.currentEntryId();
second(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId],
  'same-book reentry must reject an earlier mount callback too');
const third = actions.readingReadyCallback('local', 'b', entry.readyGeneration);
entry.finishReading(); third(0);
assert.deepEqual(samples.filter(s => s.stage === 'reader.model-ready').map(s => s.entryId), [secondId],
  'exit closes the ready callback boundary');
assert.notEqual(firstId, secondId); assert.notEqual(secondId, thirdId);
retire();
runtimeFixture.close();

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
