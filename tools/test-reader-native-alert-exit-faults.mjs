import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
let diagnosticFails = false;
const Reader = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['finishExit'], { hilog: { error() { if (diagnosticFails) throw Error('diagnostic unavailable'); }, warn() {} } });
for (const failure of ['none', 'duration-handoff', 'progress-handoff', 'tts']) {
  for (const diagnostics of [false, true]) {
    diagnosticFails = diagnostics;
    const events = [];
    const reader = Object.assign(new Reader(), { mounted: true, lifecycleToken: 1,
      exitRequested: true, exitAttemptGeneration: 1, exitDelivered: false,
      readingRecordHost: { handoff() { events.push('record'); if (failure === 'duration-handoff') throw Error('IO'); } },
      handoffExitProgress() { events.push('progress'); if (failure === 'progress-handoff') throw Error('IO'); },
      ttsCoordinator: { captureCompletedProgress() {}, stop() { events.push('stop'); return failure === 'tts' ? Promise.reject(Error('transport')) : new Promise(() => {}); } },
      retainConfirmedEntryPresentation() {}, onExit() { events.push('exit'); },
      getUIContext() { throw Error('automatic recovery must not create a dialog'); },
    });
    await reader.finishExit(1);
    assert.deepEqual(events, ['record', 'progress', 'stop', 'exit']);
    assert.equal(reader.exitDelivered, true);
    await reader.finishExit(1);
    assert.equal(events.filter(x => x === 'exit').length, 1, 'route delivered once');
  }
}
console.log('PASS nonblocking exit: hung Native/transport tails and diagnostic failures never own navigation or present a modal');
