import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

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
console.log('reader TTS background admission: pending, admitted, denied, foreground return and disabled preference PASS');
