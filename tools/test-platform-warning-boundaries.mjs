import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { resolveOpenHarmonySdkRoot } from './lib/tool-environment.mjs';

const selected = selectContractCases({
  'background-capability': { description: 'Actual background owner capability loss before dispatch and during exact-ID/listener release', resources: [] },
  'arkweb-port': { description: 'Actual TS diagnostic uses an ETS-owned response factory and retains bounded fixture admission/cleanup', resources: [] },
  'deprecated-api-compat': { description: 'Exact touched API families: SDK declarations, UTF8 port arguments, expiry classifier and observer hooks', resources: [] },
  'diagnostic-failure-boundary': { description: 'Actual diagnostic preserves original failure reporting when secondary private error-file IO fails', resources: [] },
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const executable = file => stripTypeScriptTypes(read(file).replace(/^import[^;]*;\s*/gm, '')).replace(/^export /gm, '');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const quietLog = { info() {}, warn() {}, error() {} };

function backgroundFixture() {
  const calls = [], listeners = new Set(), tasks = [];
  const caps = { core: true, continuous: true };
  const allowed = () => caps.core && caps.continuous;
  const check = op => { calls.push(op); assert.ok(allowed(), `unsupported native call: ${op}`); };
  let next = 41;
  const native = {
    on(_event, fn) { check('on'); listeners.add(fn); },
    off(_event, fn) { check('off'); listeners.delete(fn); },
    async getAllContinuousTasks() { check('read'); return tasks.map(task => ({ ...task })); },
    async startBackgroundRunning() {
      check('start'); const id = next++;
      tasks.push({ continuousTaskId: id, abilityName: 'EntryAbility', backgroundModes: ['audioPlayback'], isFromWebView: false });
      return { continuousTaskId: id };
    },
    async stopBackgroundRunning(_context, id) {
      check(`stop:${id}`); assert.ok(Number.isSafeInteger(id));
      const index = tasks.findIndex(task => task.continuousTaskId === id); if (index >= 0) tasks.splice(index, 1);
    },
  };
  const want = { OperationType: { START_ABILITY: 1 }, WantAgentFlags: { UPDATE_PRESENT_FLAG: 2 }, async getWantAgent() { return {}; } };
  const Class = new Function('wantAgent', 'backgroundTaskManager', 'hilog', 'canIUse',
    executable('platform/tts/HarmonyTtsBackgroundSession.ts') + '; return HarmonyTtsBackgroundSession;')
    (want, native, quietLog, name => name.endsWith('.Core') ? caps.core : caps.continuous);
  const owner = new Class({ abilityInfo: { bundleName: 'io.reader.minliny', name: 'EntryAbility' } });
  return { owner, native, want, calls, tasks, listeners, caps };
}

async function backgroundCapability() {
  for (const capability of ['core', 'continuous']) {
    const f = backgroundFixture(); f.caps[capability] = false;
    assert.equal(await f.owner.activate(), false); assert.equal(f.owner.capability().phase, 'unavailable');
    await f.owner.close(); assert.deepEqual(f.calls, []);
  }
  {
    const f = backgroundFixture(), wait = deferred(); f.want.getWantAgent = () => wait.promise;
    const activation = f.owner.activate(); await tick(); f.caps.core = false; wait.resolve({});
    assert.equal(await activation, false); assert.ok(!f.calls.includes('start'));
    await assert.rejects(f.owner.close(), /listener release capability/);
    assert.equal(f.listeners.size, 1, 'failed unsubscribe stays owned');
    assert.equal(f.calls.filter(call => call === 'off').length, 0, 'unsupported off must not be attempted');
    f.caps.core = true; await f.owner.close(); assert.equal(f.listeners.size, 0);
  }
  for (const capability of ['core', 'continuous']) {
    const f = backgroundFixture(); assert.equal(await f.owner.activate(), true);
    const id = f.owner.capability().taskId; f.caps[capability] = false;
    await assert.rejects(f.owner.deactivate(), /release capability/);
    assert.equal(f.owner.capability().phase, 'release-failed'); assert.equal(f.owner.capability().taskId, id);
    assert.equal(f.calls.filter(call => call.startsWith('stop:')).length, 0);
    await assert.rejects(f.owner.close()); assert.equal(f.listeners.size, 1);
    assert.equal(f.calls.filter(call => call === 'off').length, 0, 'unsupported unsubscribe is guarded before native dispatch');
    f.caps[capability] = true; await f.owner.close();
    assert.equal(f.owner.capability().taskId, undefined); assert.equal(f.listeners.size, 0);
    assert.deepEqual(f.calls.filter(call => call.startsWith('stop:')), [`stop:${id}`]);
  }
  {
    const f = backgroundFixture(), wait = deferred(); f.native.startBackgroundRunning = () => { f.calls.push('start'); return wait.promise; };
    const activation = f.owner.activate(); await tick(); f.caps.core = false; wait.resolve({ continuousTaskId: 71 });
    assert.equal(await activation, false); assert.equal(f.owner.capability().taskId, 71);
    assert.equal(f.owner.capability().phase, 'release-failed');
    f.caps.core = true; await f.owner.close(); assert.ok(f.calls.includes('stop:71'));
  }
  {
    const f = backgroundFixture(); f.native.startBackgroundRunning = async () => ({ continuousTaskId: 1.5 });
    assert.equal(await f.owner.activate(), false); assert.equal(f.owner.capability().phase, 'unverified');
    await assert.rejects(f.owner.close(), /no verified native identity/);
    assert.ok(!f.calls.some(call => call.startsWith('stop:')), 'invalid identity never triggers broad cleanup');
  }
}

class Response {
  code = 0; ready = true; data = '';
  setResponseCode(value) { this.code = value; }
  setReasonMessage(value) { this.reason = value; }
  setResponseMimeType(value) { this.mime = value; }
  setResponseData(value) { this.data = value; }
  setResponseIsReady(value) { this.ready = value; }
}
const util = {
  TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } },
  Base64Helper: class { encodeToStringSync(value) { return Buffer.from(value).toString('base64'); } },
};

async function arkwebPort() {
  const logs = [], timers = new Map(), responses = []; let next = 1, observer, diagnostic;
  const executor = {
    attachDiagnosticObserver(fn) { observer = fn; }, detachDiagnosticObserver(fn) { if (observer === fn) observer = undefined; }, cancel() {},
    async execute(params, id) {
      const prefix = params.document.baseUrl.slice(0, -4), body = params.document.body;
      observer({ kind: 'start', requestId: id, at: 1 });
      assert.equal(diagnostic.provide(params.document.baseUrl).data, body);
      assert.equal(diagnostic.provide('data:text/html,' + body), null);
      assert.equal(diagnostic.provide('data:text/html;base64,' + Buffer.from(body).toString('base64')), null);
      assert.equal(diagnostic.provide('data:text/html,' + body + 'tampered').code, 403);
      assert.equal(diagnostic.provide('https://private.invalid/SECRET_URL').code, 403);
      assert.equal(diagnostic.provide(prefix + 'early.css').code, 200);
      const delayed = diagnostic.provide(prefix + 'hold.js'); assert.equal(delayed.ready, false);
      for (const [index, kind] of ['resource', 'matcherStart', 'matched'].entries()) observer({ kind, requestId: id, url: prefix + 'early.css', at: 2 + index });
      return { resourceUrl: prefix + 'early.css' };
    },
  };
  const Class = new Function('hilog', 'ArkWebExecutor', 'util', 'setTimeout', 'clearTimeout',
    executable('app/ArkWebResourceDiagnostic.ts') + '; return ArkWebResourceDiagnostic;')
    ({ info(_d, _t, _f, value) { logs.push(JSON.parse(value)); } }, { instance: executor }, util,
      fn => { const id = next++; timers.set(id, fn); return id; }, id => timers.delete(id));
  diagnostic = new Class(() => { const response = new Response(); responses.push(response); return response; });
  assert.equal(diagnostic.provide('about:blank'), null);
  assert.equal(diagnostic.provide('https://private.invalid/SECRET_URL').code, 403);
  await diagnostic.run('early');
  assert.equal(logs[0].pass, true); assert.equal(observer, undefined); assert.equal(timers.size, 0);
  assert.ok(responses.every(response => response.ready), 'teardown releases only created delayed responses');
  assert.ok(!JSON.stringify(logs).includes('SECRET_URL') && !JSON.stringify(logs).includes('<html>'));
  diagnostic.dispose(); assert.equal(diagnostic.provide('data:text/html,old').code, 403);
  const pilot = read('pages/ReaderRendererPilot.ets');
  assert.match(pilot, /ArkWebResourceDiagnostic<WebResourceResponse>/);
  assert.equal((pilot.match(/new ArkWebResourceDiagnostic\(\(\): WebResourceResponse => new WebResourceResponse\(\)\)/g) || []).length, 2);
  assert.doesNotMatch(read('app/ArkWebResourceDiagnostic.ts'), /new WebResourceResponse\(/);
}

async function deprecatedApiCompat() {
  for (const file of ['platform/network/CookieSessionStore.ts', 'features/sync/application/WebDavCredentialStore.ts']) {
    const body = read(file).match(/private utf8\(value: string\): Uint8Array \{([\s\S]*?)\n  \}/)?.[1];
    assert.ok(body); const encode = new Function('util', 'value', body);
    for (const value of ['', 'reader', '中文 café 😀', '\ud800', 'a\u0000b']) assert.deepEqual(encode(util, value), new TextEncoder().encode(value));
  }
  const xmlState = { entries: [['Code', 'ExpiredToken']], fail: false };
  const xml = { XmlPullParser: class { parseXml(options) {
    assert.equal(options.supportDoctype, false); assert.equal(options.ignoreNameSpace, false);
    if (xmlState.fail) throw Error('invalid XML');
    for (const [name, value] of xmlState.entries) if (!options.tagValueCallbackFunction(name, value)) break;
  } } };
  const url = { URL: { parseURL(value) { return { params: new URL(value).searchParams }; } } };
  const classify = new Function('xml', 'url', executable('platform/reading-resources/ReadingImageHttpError.ts') + '; return readingImageHttpError;')(xml, url);
  const signed = 'https://image.invalid/x?X-Amz-Signature=s&X-Amz-Credential=c';
  const bytes = new Uint8Array([1]);
  assert.equal(classify(403, { 'x-amz-error-code': 'ExpiredToken' }, bytes, signed).message, 'READING_IMAGE_SIGNATURE_EXPIRED');
  assert.equal(classify(403, { 'x-amz-error-code': 'ExpiredToken' }, bytes, signed.replace('&X-Amz-Credential=c', '')).message, 'READING_IMAGE_ACCESS_DENIED');
  assert.equal(classify(403, { 'content-type': 'application/xml' }, bytes, signed).message, 'READING_IMAGE_SIGNATURE_EXPIRED');
  xmlState.entries = [['Code', 'ExpiredToken'], ['Code', 'ExpiredToken']];
  assert.equal(classify(403, { 'content-type': 'application/xml' }, bytes, signed).message, 'READING_IMAGE_ACCESS_DENIED');
  xmlState.fail = true;
  assert.equal(classify(403, { 'content-type': 'application/xml' }, bytes, signed).message, 'READING_IMAGE_ACCESS_DENIED');
  assert.equal(classify(403, {}, bytes, 'not a URL').message, 'READING_IMAGE_ACCESS_DENIED');
  assert.match(read('platform/reading-resources/MangaImageGraphicsHost.ts'), /packer\.packToData\(output, \{ format: 'image\/jpeg', quality: 90, bufferSize: MAX_BYTES \}\)/);
  assert.match(read('app/ReaderMangaPlatformDiagnostic.ts'), /decodeToString\(new Uint8Array\(bytes, 0, count\), \{ stream: true \}\)/);
  for (const file of ['features/search/ui/SearchPage.ets', 'features/bookshelf/ui/BookshelfPage.ets', 'features/manga/ui/MangaReadingSurface.ets', 'features/reading/ui/LocalBookDetail.ets', 'features/reading/ui/ReaderDirectoryNavigationList.ets']) {
    assert.match(read(file), /\.onDidScroll\(/); assert.doesNotMatch(read(file), /\.onScroll\(/);
  }
  const sdk = resolveOpenHarmonySdkRoot();
  for (const [file, signature] of [
    ['api/@ohos.util.d.ts', /encodeInto\(input\?: string\): Uint8Array/],
    ['api/@ohos.util.d.ts', /decodeToString\(input: Uint8Array, options\?: DecodeToStringOptions\): string/],
    ['api/@ohos.url.d.ts', /readonly params: URLParams/],
    ['api/@ohos.xml.d.ts', /parseXml\(option: ParseOptions\): void/],
    ['api/@ohos.multimedia.image.d.ts', /packToData\(source: PixelMap, options: PackingOption\): Promise<ArrayBuffer>/],
    ['component/lazy_for_each.d.ts', /onDataChange\(index: number\): void/],
    ['component/scroll.d.ts', /onDidScroll\(handler: ScrollOnScrollCallback\): ScrollAttribute/],
  ]) assert.match(readFileSync(join(sdk, 'ets', file), 'utf8'), signature, file);
}

async function diagnosticFailureBoundary() {
  const fixture = source => {
    const events = []; let stats = 0;
    const fs = {
      lstatSync() { if (++stats > 1) throw Error('original scratch validation failure'); return { isSymbolicLink: () => false, isDirectory: () => true }; },
      accessSync() { throw Error('secondary diagnostic IO failure'); },
    };
    const probe = new Function('fileIo', 'replaceReaderAtomicSnapshot', 'ReaderCoreRequestError', 'createReaderCoreRuntimeAsync',
      source + '; return probeReaderCoreCopy;')(fs, async () => { assert.fail('no diagnostic write after failing access'); }, class extends Error {},
        async () => { assert.fail('no native runtime may open'); });
    return { events, run: () => probe(true, 'debug', true, 'query', '1'.repeat(32), '/FAKE_FILES', () => true, sample => events.push(sample)) };
  };
  const source = executable('app/diagnostics/ReaderCoreCopyProbe.ts');
  const current = fixture(source); await current.run();
  assert.deepEqual(current.events, [{ phase: 'query', code: 'PROBE_ERROR', count: 0 }]);
  const mutant = source.replace("if (mode !== 'prepare' && safeScratch && current()) {", "if (mode !== 'prepare' && safeScratch && current() && !fileIo.accessSync(`${scratch}/query-error.json`)) {");
  assert.notEqual(mutant, source); await assert.rejects(fixture(mutant).run(), /secondary diagnostic IO/);
}

for (const name of selected) {
  if (name === 'background-capability') await backgroundCapability();
  if (name === 'arkweb-port') await arkwebPort();
  if (name === 'deprecated-api-compat') await deprecatedApiCompat();
  if (name === 'diagnostic-failure-boundary') await diagnosticFailureBoundary();
  recordContractCasePass(name);
}
