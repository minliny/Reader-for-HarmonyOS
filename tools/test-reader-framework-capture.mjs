import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';

const selected = selectContractCases({ 'capture-lifecycle': {
  description: 'DEBUG warm-Want capture admission, finite timers, microphone disabled, late creation/init, failure and exact cleanup', resources: [],
} });
const source = readFileSync(new URL('../entry/src/main/ets/app/diagnostics/ReaderFrameworkCapture.ts', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
const flush = async () => { for (let turn = 0; turn < 16; turn += 1) await Promise.resolve(); };
function fixture({ create, init, existing = false } = {}) {
  const calls = [], timers = new Map(), callbacks = new Map();
  const recorder = {
    on: (event, action) => callbacks.set(event, action),
    init: async config => { calls.push(['init', config]); await init?.(); },
    setMicEnabled: async value => calls.push(['microphone', value]),
    startRecording: async () => { calls.push(['start']); callbacks.get('stateChange')(0); },
    stopRecording: async () => calls.push(['stop']), release: async () => calls.push(['release']),
  };
  const media = { createAVScreenCaptureRecorder: async () => {
    calls.push(['create']); return create ? await create(recorder) : recorder;
  }, AVScreenCaptureStateCode: { SCREENCAPTURE_STATE_STARTED: 0, SCREENCAPTURE_STATE_STOPPED_BY_CALL: 4,
    SCREENCAPTURE_STATE_STOPPED_BY_USER_SWITCHES: 10, SCREENCAPTURE_STATE_MIC_UNMUTED_BY_USER: 7 } };
  const { ReaderFrameworkCapture } = pureModuleProbe(source, 'app/diagnostics/ReaderFrameworkCapture.ts', {
    media, fileIo: { OpenMode: { CREATE: 64, WRITE_ONLY: 1 }, accessSync: () => existing,
      openSync: (path, mode) => { calls.push(['open', path, mode]); return { fd: 23 }; },
      closeSync: file => calls.push(['close', file.fd]) },
    hilog: { info: (_domain, _tag, _format, record) => calls.push(['log', JSON.parse(record)]) },
    setTimeout: (action, delay) => { const id = Symbol(); timers.set(id, { action, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  }, ['ReaderFrameworkCapture']);
  return { owner: new ReaderFrameworkCapture(), calls, timers, callbacks,
    expire: delay => { const timer = [...timers.values()].find(item => item.delay === delay); assert.ok(timer); timer.action(); } };
}
for (const id of selected) {
  assert.match(entry, /onNewWant[\s\S]*?this\.frameworkCapture\.start\(DEBUG, BUILD_MODE_NAME, want\.parameters\?\.readerFrameworkCaptureSeconds, this\.context\.cacheDir\)/);
  assert.match(entry, /onDestroy\(\): void \{\s*this\.frameworkCapture\.close\(\)/);
  for (const [debug, mode, seconds] of [[false, 'debug', 3], [true, 'release', 3], [true, 'debug', undefined],
    [true, 'debug', '3'], [true, 'debug', 0], [true, 'debug', 16], [true, 'debug', 1.5]]) {
    const f = fixture(); f.owner.start(debug, mode, seconds, '/cache'); await flush();
    assert.deepEqual(f.calls, []); assert.equal(f.timers.size, 0);
  }
  const normal = fixture();
  normal.owner.start(true, 'debug', 12, '/cache'); normal.owner.start(true, 'debug', 12, '/cache'); await flush();
  assert.equal(normal.calls.filter(call => call[0] === 'create').length, 1);
  assert.deepEqual(normal.calls.filter(call => call[0] === 'microphone'), [['microphone', false]]);
  assert.deepEqual(normal.calls.find(call => call[0] === 'init')[1],
    { fd: 23, videoBitrate: 6000000, audioSampleRate: 48000, audioChannelCount: 2, audioBitrate: 128000 });
  assert.deepEqual([...normal.timers.values()].map(timer => timer.delay), [12000]);
  normal.expire(12000); await flush(); normal.owner.close();
  assert.deepEqual(normal.calls.filter(call => ['stop', 'release', 'close'].includes(call[0])), [['stop'], ['release'], ['close', 23]]);
  let deliver;
  const late = fixture({ create: recorder => new Promise(resolve => { deliver = () => resolve(recorder); }) });
  late.owner.start(true, 'debug', 3, '/cache'); late.owner.close(); await flush(); deliver(); await flush();
  assert.deepEqual(late.calls.filter(call => ['release', 'open', 'start'].includes(call[0])), [['release']]);
  let finishInit;
  const initialization = fixture({ init: () => new Promise(resolve => { finishInit = resolve; }) });
  initialization.owner.start(true, 'debug', 3, '/cache'); await flush(); initialization.owner.close(); await flush(); finishInit(); await flush();
  assert.equal(initialization.calls.some(call => ['start', 'microphone'].includes(call[0])), false);
  assert.deepEqual(initialization.calls.filter(call => ['release', 'close'].includes(call[0])), [['release'], ['close', 23]]);
  for (const options of [{ create: () => null }, { existing: true }, { init: () => Promise.reject(Error('init denied')) }]) {
    const failure = fixture(options); failure.owner.start(true, 'debug', 3, '/cache'); await flush();
    assert.equal(failure.owner.session, undefined); assert.equal(failure.timers.size, 0);
    assert.equal(failure.calls.some(call => call[0] === 'start'), false);
  }
  const pending = fixture({ create: () => new Promise(() => {}) });
  pending.owner.start(true, 'debug', 3, '/cache'); pending.expire(30000); await flush();
  assert.equal(pending.owner.session, undefined);
  recordContractCasePass(id);
}
