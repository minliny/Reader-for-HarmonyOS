import assert from 'node:assert/strict';
import { ReaderStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// A distinct module models a release process: the launch decision is immutable
// across Ability recreation and cannot be turned on by a later warm caller.
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderStartupTrace.ts', import.meta.url), 'utf8');
const { ReaderStartupTrace: ReleaseTrace } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
let releaseClockCalls = 0, releaseLogs = 0;
const release = ReleaseTrace.install(() => { releaseClockCalls++; return 100; }, () => { releaseLogs++; }, false);
assert.equal(ReleaseTrace.current(), undefined);
release.mark('ability.create'); release.end('startup.core', release.begin('startup.core'));
assert.equal(release.beginEntry(), 0); assert.equal(release.currentEntryId(), 0);
const originalPromise = Promise.resolve(73);
assert.equal(release.measure('startup.core', () => originalPromise), originalPromise,
  'release instance keeps exact promise identity and scheduling');
assert.equal(ReleaseTrace.measure('startup.core', () => originalPromise), originalPromise);
assert.equal(ReleaseTrace.install(() => 999, () => assert.fail('warm enable'), true), release);
assert.equal(ReleaseTrace.current(), undefined);
const releaseFailure = Error('release operation failed');
assert.throws(() => release.measure('sync-failure', () => { throw releaseFailure; }), error => error === releaseFailure);
await assert.rejects(release.measure('async-failure', () => Promise.reject(releaseFailure)), error => error === releaseFailure);
assert.equal(releaseClockCalls, 0); assert.equal(releaseLogs, 0);

let now = 500, deliveryFails = false;
const rows = [];
const trace = ReaderStartupTrace.install(() => now, row => {
  if (deliveryFails) throw Error('logger unavailable');
  rows.push(row);
});
assert.equal(ReaderStartupTrace.install(() => 900, () => assert.fail('new process recorder')), trace,
  'Ability recreation shares the original process timeline');
trace.mark('ability.create');
now = 510;
const started = trace.begin('startup.native-open');
now = 550;
trace.end('startup.native-open', started);
assert.deepEqual(rows.map(r => [r.stage, r.status, r.sinceCreateMs, r.durationMs]), [
  ['ability.create', 'event', 0, undefined], ['startup.native-open', 'start', 10, undefined],
  ['startup.native-open', 'ready', 50, 40],
]);
let unblock;
const operation = ReaderStartupTrace.measure('startup.theme', () => new Promise(resolve => { unblock = resolve; }));
assert.equal(rows.at(-1).status, 'start');
now = 580; unblock('unchanged result');
assert.equal(await operation, 'unchanged result');
assert.equal(rows.at(-1).durationMs, 30);
const failure = Error('disk failure');
await assert.rejects(ReaderStartupTrace.measure('startup.settings', async () => { throw failure; }), e => e === failure);
assert.equal(rows.at(-1).status, 'failed');
await assert.rejects(ReaderStartupTrace.measure('startup.sync-throw', () => { throw failure; }), e => e === failure);
assert.equal(rows.at(-1).status, 'failed');

const firstEntry = trace.beginEntry(), secondEntry = trace.beginEntry();
assert.equal(firstEntry, 1); assert.equal(secondEntry, 2); assert.equal(trace.currentEntryId(), 2);
trace.mark('reader.model-ready', 'ready', firstEntry);
assert.equal(rows.at(-1).entryId, 1, 'a late model uses its captured entry id');
assert.deepEqual(new Set(rows.map(r => r.processId)), new Set(['reader-500']));
assert.ok(rows.every((r, i) => r.sequence === i + 1 && r.evidence === 'application-code'));
assert.ok(rows.every(r => !('pixelReady' in r) && !('sourceId' in r) && !('bookId' in r)));
const beforeInvalid = rows.length;
now = NaN; trace.mark('invalid-clock'); now = 400; trace.end('regressed-clock', started);
assert.equal(rows.length, beforeInvalid, 'invalid clock samples do not become zero-duration success');
now = 600; deliveryFails = true;
assert.equal(await trace.measure('logger-failure', async () => 42), 42, 'diagnostics cannot change admission');
await assert.rejects(trace.measure('logger-and-operation-failure', async () => { throw failure; }), e => e === failure);
deliveryFails = false;
// Execute the actual Ability callback boundary. A returned model cannot
// manufacture a compositor receipt, and failed load preserves the error path.
const errors = [];
const Ability = productionMotionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url),
  ['loadMainContent'], { ReaderStartupTrace, DOMAIN: 0, hilog: { error: (...args) => errors.push(args) } });
for (const code of [0, 17]) {
  let callback, probeStarts = 0;
  const ability = Object.assign(new Ability(), { coldStartPage: 'pages/Index', eventLoopProbe: { start() { probeStarts++; } } });
  ability.loadMainContent({ loadContent(page, ready) { assert.equal(page, 'pages/Index'); callback = ready; } });
  assert.equal(rows.at(-1).stage, 'startup.admission-settled');
  assert.equal(probeStarts, 0);
  now += 10; callback({ code });
  assert.equal(rows.at(-1).stage, 'startup.load-content');
  assert.equal(rows.at(-1).status, code ? 'failed' : 'callback');
  assert.equal(rows.at(-1).durationMs, 10);
  assert.equal(rows.at(-1).evidence, 'application-code');
  assert.equal(probeStarts, code ? 0 : 1);
}
assert.equal(errors.length, 1);
console.log('startup trace: release zero-sample/zero-log direct promises, immutable launch decision; debug monotonic process correlation, measured segments, original result/failure preservation, entry ownership and explicit code-only evidence PASS');
