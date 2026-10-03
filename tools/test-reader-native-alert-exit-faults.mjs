import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const Reader = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['finishExit'], { hilog: { warn() {} } });

function fixture() {
  let failed = true;
  const events = [];
  const owner = Object.assign(new Reader(), {
    mounted: true, lifecycleToken: 1, chapterSelectionToken: 4,
    exitRequested: true, exitAttemptGeneration: 2, exitDelivered: false,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    destination: 'search',
    flushReadingRecordForExit: async () => { if (failed) throw Error('storage reply unavailable'); },
    awaitOrdinaryFirstPagePersistence: async () => {}, commitVisiblePage: async () => {},
    retainConfirmedEntryPresentation() {},
    onExitCancelled() { events.push('cancel-destination'); this.destination = undefined; },
    beginReadingRecordClock(token) { assert.equal(token, 1); events.push('resume-clock'); },
    onExit() { events.push('exit'); },
    beginExit() { events.push('retry'); },
  });
  return { owner, events, recover() { failed = false; } };
}

{
  const f = fixture();
  f.owner.getUIContext = () => ({ showAlertDialog() { throw Error('native UI unavailable'); } });
  await f.owner.finishExit(1);
  assert.deepEqual(f.events, ['cancel-destination', 'resume-clock']);
  assert.equal(f.owner.exitRequested, false);
  assert.equal(f.owner.exitDelivered, false);
  assert.equal(f.owner.destination, undefined, 'failed native notice cannot retain a prior Host exit destination');
  f.recover(); f.owner.exitAttemptGeneration++; f.owner.exitRequested = true;
  await f.owner.finishExit(1);
  assert.deepEqual(f.events, ['cancel-destination', 'resume-clock', 'exit']);
}
for (const decision of ['primary', 'secondary', 'cancel']) {
  const f = fixture(); let native;
  f.owner.getUIContext = () => ({ showAlertDialog(options) { native = options; } });
  await f.owner.finishExit(1);
  assert.deepEqual(f.events, [], 'successful native presentation does not pre-empt the user decision');
  const act = decision === 'cancel' ? native.cancel : native[`${decision}Button`].action;
  act(); act(); native.cancel(); await Promise.resolve();
  assert.deepEqual(f.events, decision === 'primary' ? ['retry'] : ['cancel-destination', 'resume-clock']);
}
for (const retired of ['mount', 'attempt']) {
  const f = fixture();
  f.owner.getUIContext = () => ({ showAlertDialog() {
    if (retired === 'mount') f.owner.mounted = false;
    else f.owner.exitAttemptGeneration++;
    throw Error('old native host');
  } });
  await f.owner.finishExit(1);
  assert.deepEqual(f.events, [], `${retired}: old failure cannot cancel or resume a newer owner`);
}
console.log('PASS actual reading exit: native notice failure cancels only the old Host destination, resumes the current clock, permits later durable exit, and preserves once-only/retired decisions; native visible fallback remains a target gate');
