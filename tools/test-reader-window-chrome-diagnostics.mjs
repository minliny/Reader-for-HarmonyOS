import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { ReaderBrightnessWriter } from '../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
import * as metrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { findReaderTheme, READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReaderStatusBarMeasurement } = await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const require = createRequire(import.meta.url);
const ts = require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript');
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() { for (let index = 0; index < 8; index++) await tick(); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function fixture() {
  const storage = new Map();
  globalThis.AppStorage = { setOrCreate: (key, value) => storage.set(key, value) };
  const records = [];
  const logPort = { throws: false };
  function log(level, domain, tag, format, serialized) {
    if (logPort.throws) throw new Error('diagnostic sink unavailable');
    assert.equal(domain, 0x5244);
    assert.equal(tag, 'Reader');
    assert.equal(format, 'READER_WINDOW_CHROME %{public}s');
    records.push({ level, ...JSON.parse(serialized) });
  }
  const dependencies = {
    '@kit.ArkUI': {
      window: {
        Orientation: { UNSPECIFIED: 0, PORTRAIT: 1, LANDSCAPE: 2, AUTO_ROTATION_UNSPECIFIED: 3 },
        AvoidAreaType: { TYPE_SYSTEM: 0, TYPE_CUTOUT: 1, TYPE_SYSTEM_GESTURE: 2, TYPE_NAVIGATION_INDICATOR: 3, TYPE_KEYBOARD: 4 },
      },
      display: { getDefaultDisplaySync: () => ({ id: 0, rotation: 0, densityPixels: 2, scaledDensity: 2 }), on() {}, off() {} },
    },
    '@kit.PerformanceAnalysisKit': { hilog: { info: (...args) => log('info', ...args), warn: (...args) => log('warn', ...args) } },
    './ReaderBrightnessWriter': { ReaderBrightnessWriter },
    './ReaderStatusBarMeasurement': { ReaderStatusBarMeasurement },
    '../features/common/ReaderWindowMetrics': metrics,
    '../features/common/ReaderThemeRegistry': { findReaderTheme },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    assert.ok(id in dependencies, id);
    return dependencies[id];
  }, module, module.exports);
  const { ReaderWindowCoordinator: C, ReaderWindowChromeStyle: Style } = module.exports;
  function windowPort() {
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    const win = {
      calls: [], native: {}, events: new Map(), readback: undefined, readbackError: undefined,
      nextWrite: undefined, reads: 0,
      getPreferredOrientation: () => 0,
      getWindowProperties: () => ({ isKeepScreenOn: false, brightness: -1, windowRect: { left: 0, top: 0, width: 780, height: 1688 } }),
      getWindowAvoidArea: type => ({ topRect: type === 0 ? { left: 0, top: 0, width: 780, height: 96 } : zero,
        leftRect: zero, bottomRect: zero, rightRect: zero }),
      on(name, listener) { win.events.set(name, listener); },
      off(name) { win.events.delete(name); },
      setWindowLayoutFullScreen: async () => {}, setWindowSystemBarEnable: async () => {},
      setPreferredOrientation: async () => {}, setWindowKeepScreenOn: async () => {},
      setSpecificSystemBarEnabled: async () => {},
      async setWindowSystemBarProperties(properties) {
        win.calls.push({ ...properties });
        const gate = win.nextWrite;
        win.nextWrite = undefined;
        if (gate !== undefined) await gate.promise;
        win.native = { ...win.native, ...properties };
      },
      getWindowSystemBarProperties() {
        win.reads++;
        if (win.readbackError !== undefined) throw win.readbackError;
        return win.readback ?? win.native;
      },
    };
    return win;
  }
  return { C, Style, windowPort, records, logPort, storage };
}

async function ready() {
  const fixtureValue = fixture();
  const win = fixtureValue.windowPort();
  await fixtureValue.C.install(win);
  await settle();
  assert.equal(fixtureValue.records.length, 1, 'install performs one actual write');
  fixtureValue.records.length = 0;
  return { ...fixtureValue, win };
}
const cases = [];
async function check(name, run) {
  try { await run(); cases.push({ name, status: 'PASS' }); }
  catch (error) { cases.push({ name, status: 'FAIL', error: error.stack }); }
}

await check('actual success records native readback separately from expected style and VP request geometry', async () => {
  const f = await ready();
  f.win.readback = { statusBarColor: '#FF123456', statusBarContentColor: '#FFFEDCBA' };
  f.C.requestReaderChrome(new f.Style('#FF223344', 'light', '#FFEEDDCC'));
  await settle();
  assert.equal(f.records.length, 1);
  const record = f.records[0];
  assert.equal(record.level, 'info');
  assert.equal(record.result, 'applied');
  assert.equal(record.owner, 'reader');
  assert.equal(record.currentWindow, true);
  assert.equal(record.expectedStatusBg, '#FF223344');
  assert.equal(record.underlayColor, '#FF223344');
  assert.equal(record.expectedForeground, '#FFEEDDCC');
  assert.equal(record.nativeReadback, 'known');
  assert.equal(record.nativeBackground, '#FF123456');
  assert.equal(record.nativeForeground, '#FFFEDCBA');
  assert.deepEqual(record.statusRectAtRequest, { left: 0, top: 0, width: 390, height: 48 });
  assert.deepEqual(record.windowRectAtRequest, { left: 0, top: 0, width: 390, height: 844 });
  assert.ok(record.metricsRevisionAtRequest > 0);
  const count = f.win.calls.length;
  f.C.requestReaderChrome(new f.Style('#FF223344', 'light', '#FFEEDDCC'));
  for (let index = 0; index < 5; index++) f.win.events.get('avoidAreaChange')({});
  await settle();
  assert.equal(f.win.calls.length, count, 'readback mismatch is diagnostic only, no retry or strategy change');
  assert.equal(f.records.length, 1, 'deduplicated requests/layouts do not log');
  f.C.detach();
});

for (const scenario of ['missing-api', 'readback-throws', 'partial-response']) {
  await check(`${scenario} retains successful write and reports unavailable fields explicitly`, async () => {
    const f = await ready();
    if (scenario === 'missing-api') delete f.win.getWindowSystemBarProperties;
    if (scenario === 'readback-throws') f.win.readbackError = { code: 1300003, message: 'PRIVATE_READBACK_DATA' };
    if (scenario === 'partial-response') f.win.readback = { statusBarColor: '#FF102030' };
    f.C.requestReaderChrome(new f.Style('#FF102030', 'light', '#FFF0E0D0'));
    await settle();
    assert.equal(f.records.length, 1);
    assert.equal(f.records[0].result, 'applied');
    assert.equal(f.records[0].nativeReadback, scenario === 'missing-api' ? 'unavailable' : scenario === 'readback-throws' ? 'failed' : 'known');
    assert.equal(f.records[0].nativeForeground, 'unknown');
    assert.equal(f.records[0].readbackErrorCode, scenario === 'readback-throws' ? '1300003' : 'none');
    assert.ok(!JSON.stringify(f.records).includes('PRIVATE_READBACK_DATA'));
    const writes = f.win.calls.length;
    f.C.requestReaderChrome(new f.Style('#FF102030', 'light', '#FFF0E0D0'));
    await settle();
    assert.equal(f.win.calls.length, writes);
    assert.equal(f.win.native.statusBarColor, '#FF102030');
    f.C.detach();
  });
}

await check('latest write failure logs numeric code only, remains pending, and explicit reapply recovers', async () => {
  const f = await ready();
  const gate = deferred(); f.win.nextWrite = gate;
  const reads = f.win.reads;
  f.C.requestReaderChrome(new f.Style('#FF554433', 'light', '#FFF0E0D0'));
  gate.reject({ code: 1300003, message: 'https://private.invalid/book', stack: 'PRIVATE_STACK' });
  await settle();
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].result, 'write-failed');
  assert.equal(f.records[0].level, 'warn');
  assert.equal(f.records[0].errorCode, '1300003');
  assert.equal(f.records[0].nativeReadback, 'not-read');
  assert.equal(f.win.reads, reads, 'a failed write does not start an additional native read');
  assert.ok(!JSON.stringify(f.records).includes('private.invalid'));
  assert.ok(!JSON.stringify(f.records).includes('PRIVATE_STACK'));
  const writes = f.win.calls.length;
  await settle(); assert.equal(f.win.calls.length, writes, 'no automatic retry loop');
  f.C.reapplyChrome(); await settle();
  assert.equal(f.win.native.statusBarColor, '#FF554433');
  assert.equal(f.records.at(-1).result, 'applied');
  f.C.detach();
});

await check('old failure and logger exceptions cannot strand the latest intent or change applied deduplication', async () => {
  const f = await ready();
  const gate = deferred(); f.win.nextWrite = gate;
  f.C.requestReaderChrome(new f.Style('#FF332211', 'light'));
  f.C.requestOverlayChrome(new f.Style('#FF665544', 'light'));
  gate.reject({ get code() { throw new Error('code getter unavailable'); } });
  await settle();
  assert.equal(f.records[0].errorCode, 'unknown');
  assert.equal(f.records[1].owner, 'overlay');
  assert.equal(f.win.native.statusBarColor, '#FF665544');
  f.logPort.throws = true;
  f.C.requestReaderChrome(new f.Style('#FF998877', 'dark'));
  await settle();
  assert.equal(f.win.native.statusBarColor, '#FF998877');
  const writes = f.win.calls.length;
  f.C.requestReaderChrome(new f.Style('#FF998877', 'dark'));
  await settle(); assert.equal(f.win.calls.length, writes, 'a throwing logger does not mark a successful write failed');
  f.C.detach();
});

await check('old window completion is identified and does not borrow replacement geometry or strand its write', async () => {
  const f = await ready();
  const gate = deferred(); f.win.nextWrite = gate;
  f.C.requestReaderChrome(new f.Style('#FF111222', 'light'));
  const replacement = f.windowPort();
  await f.C.install(replacement);
  f.C.requestReaderChrome(new f.Style('#FF333444', 'light'));
  gate.resolve(); await settle();
  assert.equal(f.records[0].currentWindow, false);
  assert.equal(f.records[0].expectedStatusBg, '#FF111222');
  assert.equal(f.records.at(-1).currentWindow, true);
  assert.equal(f.records.at(-1).expectedStatusBg, '#FF333444');
  assert.equal(replacement.native.statusBarColor, '#FF333444');
  f.C.detach();
});

await check('all registered paper owners expose the actual shared background and retain exact foreground/navigation colors', async () => {
  const f = await ready();
  for (const theme of READER_THEME_DEFINITIONS) for (const owner of ['reader', 'overlay']) {
    const style = new f.Style(theme.paperStart, theme.scheme === 'night' ? 'light' : 'dark', theme.ink, theme.id);
    if (owner === 'reader') f.C.requestReaderChrome(style); else f.C.requestOverlayChrome(style);
    await settle();
    assert.equal(f.win.native.statusBarColor, '#00000000', `${theme.id}/${owner}: native color must not cover the paper`);
    assert.equal(f.win.native.navigationBarColor, theme.paperStart);
    assert.equal(f.win.native.statusBarContentColor, theme.ink);
    assert.equal(f.storage.get('readerWindowChromeThemeId'), theme.id);
    assert.equal(f.storage.get('readerWindowChromeUnderlayColor'), theme.paperStart);
    const diagnostic = f.records.at(-1);
    assert.equal(diagnostic.expectedStatusBg, '#00000000');
    assert.equal(diagnostic.nativeBackground, '#00000000');
    assert.equal(diagnostic.underlayColor, theme.paperStart);
    assert.equal(diagnostic.paperThemeId, theme.id);
  }
  f.C.detach();
});

await check('missing or invalid paper backing preserves opaque legacy chrome and application ownership is always opaque', async () => {
  const f = await ready();
  for (const paperThemeId of ['', 'removed-theme']) {
    const style = new f.Style('#FF334455', 'light', '#FFFEDCBA', paperThemeId);
    assert.equal(style.paperThemeId, '');
    for (const owner of ['reader', 'overlay']) {
      if (owner === 'reader') f.C.requestReaderChrome(style); else f.C.requestOverlayChrome(style);
      await settle();
      assert.equal(f.win.native.statusBarColor, '#FF334455');
      assert.equal(f.storage.get('readerWindowChromeThemeId'), '');
      assert.equal(f.records.at(-1).expectedStatusBg, '#FF334455');
    }
  }
  f.C.updateAppChromeStyle(new f.Style('#FF112233', 'dark', '#FF090807', 'paper'));
  f.C.requestAppChrome(); await settle();
  assert.equal(f.win.native.statusBarColor, '#FF112233');
  assert.equal(f.win.native.statusBarContentColor, '#FF090807');
  assert.equal(f.storage.get('readerWindowChromeThemeId'), '');
  assert.equal(f.records.at(-1).paperThemeId, '');
  f.C.detach();
});

await check('a different paper ID republishes even with equal colors while identical paper requests stay deduplicated', async () => {
  const f = await ready();
  f.C.requestReaderChrome(new f.Style('#FFEEEEEE', 'dark', '#FF111111', 'paper'));
  await settle();
  const firstRevision = f.records.at(-1).revision;
  const firstWrites = f.win.calls.length;
  f.C.requestReaderChrome(new f.Style('#FFEEEEEE', 'dark', '#FF111111', 'paperNight'));
  await settle();
  assert.equal(f.win.calls.length, firstWrites + 1);
  assert.equal(f.storage.get('readerWindowChromeThemeId'), 'paperNight');
  assert.ok(f.records.at(-1).revision > firstRevision);
  f.C.requestReaderChrome(new f.Style('#FFEEEEEE', 'dark', '#FF111111', 'paperNight'));
  await settle(); assert.equal(f.win.calls.length, firstWrites + 1);
  f.C.detach();
});

for (const result of cases) console.log(JSON.stringify(result));
assert.equal(cases.filter(result => result.status === 'FAIL').length, 0, 'actual Coordinator diagnostics scenarios');
console.log('PASS bounded actual Coordinator diagnostics; Window readback is controlled and is not device compositor evidence.');
