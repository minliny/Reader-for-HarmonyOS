import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { FakeGateway, FakeHost, chapter, canonicalRemoteContent } from './lib/reader-tts-fixtures.mjs';

const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
let active = false, admission;
const host = { isBackgroundPlaybackActive: () => active,
  waitForBackgroundPlaybackAdmission: () => admission.promise };
const Reader = productionMotionMethods(source, ['onAppForegroundChanged'], {
  ReaderRuntimeOwner: { current: () => ({ getTtsHost: () => host }) },
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(enabled = true) {
  let pauses = 0;
  const coordinator = { pauseForBackground: async () => { pauses++; } };
  const reader = Object.assign(new Reader(), {
    mounted: true, appForeground: false, ttsBackgroundPlayback: enabled, ttsCoordinator: coordinator,
    bookmarkRollbackGeneration: 0, onControlInputBoundaryChanged() {}, cancelAutomaticPageStart() {},
    stopReaderTtsAudition() {}, finishSessionCapsuleMorph() {}, finishBookmarkRollback() {},
    captureReadingRecordElapsed() {}, clearReadingRecordTimer() {}, flushReadingRecord: async () => {},
    pauseAutoPage() {}, logTtsFailure() {},
  });
  return { reader, coordinator, pauses: () => pauses };
}

admission = deferred();
{
  const f = fixture();
  f.reader.onAppForegroundChanged();
  assert.equal(f.pauses(), 0);
  active = true;
  admission.resolve(true);
  await tick();
  assert.equal(f.pauses(), 0, 'successful in-flight background lease preserves playback');
}
active = false;
admission = deferred();
{
  const f = fixture();
  f.reader.onAppForegroundChanged();
  admission.resolve(false);
  await tick();
  assert.equal(f.pauses(), 1, 'denied background lease pauses playback');
}
admission = deferred();
{
  const f = fixture();
  f.reader.onAppForegroundChanged();
  f.reader.appForeground = true;
  admission.resolve(false);
  await tick();
  assert.equal(f.pauses(), 0, 'returning to foreground retires the late background decision');
}
{
  const f = fixture(false);
  f.reader.onAppForegroundChanged();
  await tick();
  assert.equal(f.pauses(), 1, 'disabled preference pauses immediately despite a pending lease');
}
{
  const gateway=new FakeGateway(),transport=new FakeHost(),commits=[];
  const coordinator=new ReaderTtsSessionCoordinator(gateway,transport,async value=>commits.push(value));
  await coordinator.start({chapter,content:canonicalRemoteContent,contentVersion:1,scalarPosition:0,pauseOnInterruption:false});
  const requestId=transport.requests.at(-1).requestId;
  transport.emit({type:'backgroundLeaseRevoked'});await coordinator.whenSettled();
  assert.equal(coordinator.getState().status,'interrupted');assert.equal(coordinator.getState().pauseReason,'routeBackground');
  assert.ok(transport.calls.includes('deactivate'),'mandatory background revoke releases audio despite optional pause preference');
  const cursor=gateway.cursor;transport.emit({type:'complete',requestId,completion:'audio'});await coordinator.whenSettled();
  assert.equal(gateway.cursor,cursor,'old speech callback cannot advance a revoked background queue');
  assert.deepEqual(commits,[]);
  const preview=coordinator.auditionVoice({language:'zh-CN',person:0});await coordinator.whenSettled();
  transport.emit({type:'backgroundLeaseRevoked'});await preview;await coordinator.whenSettled();
  assert.ok(['paused','interrupted'].includes(coordinator.getState().status),'revocation never resumes an already paused formal queue after cancelling audition');await coordinator.dispose();
}
console.log('reader TTS background admission: pending/admitted/denied/foreground/disabled preference; real coordinator mandatory lease revoke/audition retirement/stale speech callback PASS');
