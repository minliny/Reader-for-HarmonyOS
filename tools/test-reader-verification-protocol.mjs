import assert from 'node:assert/strict';
import { readerVerifyRequest, readerVerifyStoredRequest, readerVerifyObservation,
  READER_VERIFY_SCHEMA } from '../entry/src/main/ets/app/ReaderVerificationProtocol.ts';
import { readerControlVerificationColdStartPage } from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';

const request = readerVerifyRequest(true, 'debug', 'directory-control-expanded', '366', 'run-20261118-01');
assert.deepEqual(request, { schema: READER_VERIFY_SCHEMA, scene: 'directory-control-expanded', widthVp: 366, run: 'run-20261118-01' });
assert.equal(readerVerifyRequest(true, 'debug', 'menu', '320', 'abcdefgh').widthVp, 320);
console.log('PASS exact debug request admission');

for (const [debug, mode] of [[false, 'debug'], [true, 'release'], [true, ''], [true, 'DEBUG']]) {
  assert.equal(readerVerifyRequest(debug, mode, 'menu', '366', 'abcdefgh'), undefined, 'release/non-debug must not admit');
}
console.log('PASS generated debug and exact build mode gate');

for (const scene of [undefined, null, true, 1, '', 'Directory', 'dir_x', 'a'.repeat(33), {}, [], 'directory control']) {
  assert.equal(readerVerifyRequest(true, 'debug', scene, '366', 'abcdefgh'), undefined, `scene ${String(scene)} must be rejected`);
}
for (const width of [undefined, null, 320, 366, true, '200', '366 ']) {
  assert.equal(readerVerifyRequest(true, 'debug', 'menu', width, 'abcdefgh'), undefined, `width ${String(width)} must be rejected`);
}
for (const run of [undefined, null, true, 1, '', 'short', 'bad run', 'a'.repeat(65)]) {
  assert.equal(readerVerifyRequest(true, 'debug', 'menu', '366', run), undefined, `run ${String(run)} must be rejected`);
}
console.log('PASS scene/width/run exact primitive shapes');

assert.equal(readerVerifyRequest(true, 'debug', 'menu', '366', 'abcdefgh', [true]), undefined);
assert.ok(readerVerifyRequest(true, 'debug', 'menu', '366', 'abcdefgh', [undefined, false, 0, '', {}, []]));
console.log('PASS conflicting diagnostic flags fall back');

const stored = readerVerifyStoredRequest(JSON.parse(JSON.stringify(request)));
assert.deepEqual(stored, request);
for (const value of [undefined, null, true, [], {}, { ...request, extra: 1 }, { ...request, schema: 2 },
  { ...request, widthVp: '366' }, { ...request, scene: 'Bad' }, { ...request, run: 'short' }]) {
  assert.equal(readerVerifyStoredRequest(value), undefined, `stored ${JSON.stringify(value)} must be rejected`);
}
console.log('PASS AppStorage request revalidation');

const observation = readerVerifyObservation(request, 'ready', {
  scene: 'directory-control-expanded', requestedWidthVp: 366, actualWidthVp: 366, actualHeightVp: 780,
  systemFontScale: 1.3, densityPixels: 3, contentTopInsetVp: 0,
  font: { status: 'ready', following: true, maxScale: 3.2, scaleVp: 1.3 },
  state: { intentCount: 0, queryLength: 0 },
});
assert.equal(observation.schema, READER_VERIFY_SCHEMA);
assert.equal(observation.kind, 'ready');
assert.equal(observation.run, request.run);
assert.equal(observation.scene, request.scene);
assert.equal(observation.densityPixels, 3);
assert.equal(JSON.parse(JSON.stringify(observation)).font.scaleVp, 1.3);
console.log('PASS observation shape and serialization');

assert.equal(readerControlVerificationColdStartPage(true, 'debug', undefined, undefined, undefined, 'directory-control-expanded'),
  'pages/ReaderPageStructureVerification');
assert.equal(readerControlVerificationColdStartPage(false, 'debug', undefined, undefined, undefined, 'menu'), 'pages/Index');
for (const conflicts of [
  [true, undefined, undefined], [undefined, true, undefined], [undefined, undefined, true]]) {
  assert.equal(readerControlVerificationColdStartPage(true, 'debug', conflicts[0], conflicts[1], conflicts[2], 'menu'),
    'pages/Index', 'verify cannot combine with another diagnostic cold start');
}
for (const invalid of [true, 1, {}, [], '', 'Bad', 'dir_x', 'a'.repeat(33)]) {
  assert.equal(readerControlVerificationColdStartPage(true, 'debug', undefined, undefined, undefined, invalid), 'pages/Index',
    'invalid verify scene must not route');
}
assert.equal(readerControlVerificationColdStartPage(true, 'debug', true), 'pages/ReaderControlMotionVerification');
assert.equal(readerControlVerificationColdStartPage(true, 'debug', undefined, true), 'pages/ReaderRendererPilot');
assert.equal(readerControlVerificationColdStartPage(true, 'debug'), 'pages/Index');
console.log('PASS cold-start route admission and legacy five-argument behavior');

console.log('PASS reader verification protocol');
