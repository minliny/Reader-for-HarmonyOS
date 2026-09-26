import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { coreAdmissionFailureSummary, httpResponseFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';
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
  const owner = Object.assign(new Owner(), { start: async () => {},
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
console.log('Core admission diagnostics: native codes preserved, private data excluded, original rejection retained PASS');
