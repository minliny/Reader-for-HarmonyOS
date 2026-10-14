import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { coreAdmissionFailureSummary, httpResponseFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';
import { ReaderCoreRuntime } from '../entry/vendor/core-harmony/sdk/reader_core.ts';
const message = 'Reader-Core command was not admitted';
for (const code of ['BUSY', 'RESOURCE_EXHAUSTED']) {
  const error = Object.assign(new Error(message), { code, details: { token: 'private-secret' } });
  assert.equal(coreAdmissionFailureSummary(error, 'book.search'), `method=book.search code=${code}`);
  assert.equal(coreAdmissionFailureSummary({ message, code }, 'book.detail'), `method=book.detail code=${code}`);
  assert.equal(coreAdmissionFailureSummary(error, 'book.search\nprivate-secret'), `method=unknown code=${code}`);
  const logs = []; let requests = 0; let finishes = 0;
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
    ['requestDirect'], { coreAdmissionFailureSummary, httpResponseFailureSummary,
      LOG_DOMAIN: 0, DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000,
      hilog: { warn: (...args) => logs.push(args) } });
  // The extracted production method now checks its real Runtime ready state
  // immediately before entering the SDK. This fixture exercises a Core
  // rejection after that boundary, rather than an uninitialized local owner.
  const owner = Object.assign(new Owner(), { state: 'ready', start: async () => {},
    readingEntryPreparations: () => ({ beginRequest: () => true, finishRequest: () => { finishes++; } }),
    runtime: { request: async () => { requests++; throw error; } } });
  await assert.rejects(owner.requestDirect('book.search', { keyword: 'private-secret' }), value => value === error);
  assert.equal(requests, 1, 'admission rejection must not retry or restart an operation');
  assert.equal(finishes, 1, 'failure must still settle preparation ownership');
  assert.deepEqual(logs, [[0, 'Reader', 'Core command not admitted: %{public}s', `method=book.search code=${code}`]]);
  assert.ok(!JSON.stringify(logs).includes('private-secret'));
}
for (const error of [new Error(message), { message, code: 'TIMEOUT' },
  { message: 'other failure', code: 'BUSY' }, { event: { error: { message, code: 'BUSY' } } },
  message, null, { body: { message, code: 'BUSY' } }]) {
  assert.equal(coreAdmissionFailureSummary(error, 'book.search'), undefined);
}

// Use the actual shipped SDK to qualify native lastError, then pass that same
// rejection through the production Owner. An unqualified fake error would
// miss the real diagnostic-suffix mismatch which hid the VM's first failure.
const reasons = [
  'command exceeds the wire byte limit',
  'runtime input byte budget is occupied',
  'runtime result reservation contract failed; drain and recreate',
  'runtime input class byte budget is occupied',
  'runtime request or terminal budget is occupied',
  'runtime lane is occupied',
];
for (const code of ['BUSY', 'RESOURCE_EXHAUSTED']) {
  for (const reason of reasons) {
    const calls = [], logs = [];
    let finishes = 0;
    const error = Object.assign(new Error(message), { code, details: { token: 'private-secret' } });
    const runtime = new ReaderCoreRuntime({
      createRuntime: () => ({}), releaseRuntime: () => { calls.push('release'); },
      enableEventAcknowledgements() {}, acknowledgeEvent: () => { calls.push('ack'); },
      sendCommand: (_handle, command) => { calls.push(['send', command.method]); throw error; },
      lastError: () => { calls.push('lastError'); return { code: code === 'BUSY' ? 9 : 10, message: reason }; },
      readEvent: () => { calls.push('poll'); return null; },
      pendingEventCount: () => 0, cancelRequest: () => { calls.push('cancel'); },
    });
    const Owner = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
      ['requestDirect'], { coreAdmissionFailureSummary, httpResponseFailureSummary,
        LOG_DOMAIN: 0, DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000,
        hilog: { warn: (...args) => logs.push(args) } });
    const owner = Object.assign(new Owner(), { state: 'ready', start: async () => {}, runtime,
      readingEntryPreparations: () => ({ beginRequest: () => true, finishRequest: () => { finishes++; } }) });
    try {
      await assert.rejects(owner.requestDirect('source.list', { privateToken: 'private-secret' }), value => value === error);
      assert.equal(error.message, `${message}: ${reason}`, 'actual SDK qualifies the unchanged Native rejection');
      const summary = `method=source.list code=${code} reason=${reason}`;
      assert.equal(coreAdmissionFailureSummary({ message: error.message, code }, 'source.list'), summary);
      assert.equal(coreAdmissionFailureSummary(error, 'source.list\nprivate-secret'), `method=unknown code=${code} reason=${reason}`);
      assert.deepEqual(logs, [[0, 'Reader', 'Core command not admitted: %{public}s', summary]]);
      assert.ok(!JSON.stringify(logs).includes('private-secret'));
      assert.deepEqual(calls, [['send', 'source.list'], 'lastError'], 'one rejection, no retry, polling, cancellation or ACK');
      assert.equal(finishes, 1, 'diagnostic repair still settles preparation ownership');
      assert.equal(owner.state, 'ready', 'diagnostics must not recreate or replace the Runtime');
    } finally { runtime.close(); }
    assert.equal(calls.filter(call => call === 'release').length, 1);
  }
}
for (const reason of reasons) {
  for (const suffix of [`${reason}\nprivate-secret`, `${reason} private-secret`, `${reason}: private-secret`, ` ${reason}`, `${reason} `]) {
    assert.equal(coreAdmissionFailureSummary({ message: `${message}: ${suffix}`, code: 'BUSY' }, 'source.list'), undefined);
  }
  assert.equal(coreAdmissionFailureSummary({ message: `${message}: ${reason}`, code: 'TIMEOUT' }, 'source.list'), undefined);
  assert.equal(coreAdmissionFailureSummary({ event: { error: { message: `${message}: ${reason}`, code: 'BUSY' } } }, 'source.list'), undefined);
}
for (const invalid of ['', 'capacity: private-secret', 'runtime result reservation contract failed', 'runtime is closed']) {
  assert.equal(coreAdmissionFailureSummary({ message: `${message}: ${invalid}`, code: 'BUSY' }, 'source.list'), undefined);
}
assert.equal(coreAdmissionFailureSummary({ message: `${message}:runtime lane is occupied`, code: 'BUSY' }, 'source.list'), undefined);
console.log('Core admission diagnostics: actual SDK reason + Owner log, fixed whitelist, private data excluded, original rejection and ownership retained PASS');
