import { ReadingRecordRecoveryError } from '../entry/src/main/ets/features/reading/ReaderReadingRecordState.ts';
import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

let diagnosticFails = false;
let now = 10000;
const Reader = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['finishExit', 'showReaderBackgroundNotice'], { ReadingRecordRecoveryError, Date: { now: () => now },
    hilog: { error() { if (diagnosticFails) throw Error('diagnostic unavailable'); }, warn() {} } });

function fixture(failureStage = 'record', toastFails = false) {
  const events = [], notices = [], alerts = [];
  const saved = { chapterOffset: 17, confirmation: 'unknown' };
  const owner = Object.assign(new Reader(), {
    mounted: true, lifecycleToken: 1, chapterSelectionToken: 4,
    exitRequested: true, exitAttemptGeneration: 2, exitDelivered: false,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    destination: 'search', lastCommittedProgress: saved,
    lastBackgroundNotice: '', lastBackgroundNoticeAt: 0,
    flushReadingRecordForExit: async () => { if (failureStage === 'record') throw new ReadingRecordRecoveryError('pending', 'record receipt unknown'); },
    awaitOrdinaryFirstPagePersistence: async () => {},
    commitVisiblePage: async () => { if (failureStage === 'progress') throw Error('storage reply unavailable'); },
    retainConfirmedEntryPresentation() {},
    onExitCancelled() { events.push('cancel-destination'); this.destination = undefined; },
    beginReadingRecordClock() { events.push('resume-clock'); },
    onExit() { events.push('exit'); },
    beginExit() { events.push('retry'); },
    getUIContext: () => ({ showAlertDialog(options) { alerts.push(options); },
      getPromptAction: () => ({ showToast(options) { notices.push(options); if (toastFails) throw Error('toast unavailable'); } }) }),
  });
  return { owner, events, notices, alerts, saved };
}

for (const stage of ['record', 'progress']) {
  for (const failedDiagnostic of [false, true]) {
    for (const failedToast of [false, true]) {
      diagnosticFails = failedDiagnostic;
      const f = fixture(stage, failedToast);
      await f.owner.finishExit(1);
      assert.deepEqual(f.events, ['exit'], `${stage}: optional diagnostics and feedback cannot cancel navigation or restart the clock`);
      assert.deepEqual(f.alerts, [], 'background persistence failure never presents a modal');
      assert.deepEqual(f.notices, [{ message: '部分阅读记录保存尚未确认', duration: 2000 }]);
      assert.equal(f.owner.exitRequested, true);
      assert.equal(f.owner.exitDelivered, true);
      assert.equal(f.owner.destination, 'search', 'preserve the originally requested Host destination');
      assert.equal(f.owner.lastCommittedProgress, f.saved, 'navigation does not manufacture a saved receipt');
      assert.deepEqual(f.saved, { chapterOffset: 17, confirmation: 'unknown' });
      await f.owner.finishExit(1);
      assert.deepEqual(f.events, ['exit'], 'exit delivery remains once-only');
      assert.equal(f.notices.length, 1, 'repeated same-message failure is deduplicated');
    }
  }
}
diagnosticFails = false;
for (const retired of ['mount', 'attempt']) {
  const f = fixture(); let reject;
  f.owner.flushReadingRecordForExit = () => new Promise((_resolve, failure) => { reject = failure; });
  const pending = f.owner.finishExit(1);
  if (retired === 'mount') f.owner.mounted = false;
  else f.owner.exitAttemptGeneration++;
  reject(Error('late old save failure'));
  await pending;
  assert.deepEqual(f.events, [], `${retired}: old failure cannot navigate, cancel or resume a newer owner`);
  assert.deepEqual(f.notices, [], `${retired}: stale failure cannot display feedback`);
  assert.deepEqual(f.alerts, []);
  assert.equal(f.owner.exitDelivered, false);
  assert.equal(f.owner.destination, 'search');
}
{
  const f = fixture();
  now = 10000;
  f.owner.showReaderBackgroundNotice('pending');
  now = 14999;
  f.owner.showReaderBackgroundNotice('pending');
  assert.equal(f.notices.length, 1, 'same message stays quiet within five seconds');
  now = 15000;
  f.owner.showReaderBackgroundNotice('pending');
  f.owner.showReaderBackgroundNotice('different pending');
  assert.deepEqual(f.notices.map(notice => notice.message), ['pending', 'pending', 'different pending']);
  assert.ok(f.notices.every(notice => notice.duration === 2000));
  assert.deepEqual(f.events, [], 'helper has no navigation or persistence ownership');
}
{
  const f = fixture('record', true);
  assert.doesNotThrow(() => f.owner.showReaderBackgroundNotice('pending'), 'failed Toast is optional');
  assert.doesNotThrow(() => f.owner.showReaderBackgroundNotice('pending'));
  assert.equal(f.notices.length, 1, 'failed Toast also avoids a repeated notification storm');
  assert.deepEqual(f.events, []);
}
console.log('PASS actual reading exit: no modal, optional deduplicated Toast and diagnostic faults never block the original destination; no fabricated ACK, once-only navigation and stale lifecycle/attempt guards preserved');
