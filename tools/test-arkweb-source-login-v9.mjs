import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = new URL('../entry/src/main/ets/platform/network/', import.meta.url);
const lower = file => stripTypeScriptTypes(readFileSync(new URL(file, source), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '')).replace(/^export /gm, '');

function fixture() {
  const events = [];
  const shown = [];
  let generation = 1;
  let canForward = false;
  let nativeClearFailures = 0;
  let executor;
  class Controller {
    static setHostIP() {}
    static clearHostIP() {}
    stop() { events.push('stop'); }
    loadUrl(url) {
      this.url = url;
      executor.active.pageReadyAt = Date.now() - 1;
      events.push(['load', url]);
    }
    getUrl() { return this.url; }
    getTitle() { return 'Example login'; }
    accessBackward() { return true; }
    accessForward() { return canForward; }
    backward() { events.push('backward'); }
    forward() { events.push('forward'); }
    refresh() { events.push('refresh'); }
    async runJavaScript() { return JSON.stringify('page'); }
  }
  const webview = {
    WebviewController: Controller,
    ProxyController: { removeProxyOverride(callback) { callback(); } },
    WebCookieManager: {
      clearAllCookiesSync() {
        events.push('clear-native');
        if (nativeClearFailures > 0) {
          nativeClearFailures--;
          throw new Error('incognito cookie clear failed');
        }
      },
      fetchAllCookies: async () => [],
    },
  };
  const cookieStore = {
    sessionGeneration: () => generation,
    arkWebSeeds: async () => [],
    async reconcileArkWebCookies(profile, _seeds, _observed, expectedGeneration) {
      events.push(['capture', profile, expectedGeneration]);
    },
  };
  const Executor = new Function('webview', 'CookieSessionStore', 'prepareNetworkTarget',
    `${lower('HttpTransportPolicy.ts')}\n${lower('ArkWebExecutor.ts')}\nreturn ArkWebExecutor;`)(
    webview, { instance: cookieStore }, async () => ({ route: 'systemProxy' }));
  executor = new Executor();
  executor.attachSurfaceHost(surface => {
    if (surface) executor.attachController(surface);
    else if (executor.surfaceLease) {
      events.push(['detach', executor.surfaceLease.surface.id]);
      executor.detachController(executor.surfaceLease.surface);
    }
  });
  executor.attachPresentation(presentation => {
    if (presentation.visible) shown.push(presentation);
  });
  return { executor, events, shown, advanceGeneration: () => { generation++; },
    addForwardHistory: () => { canForward = true; },
    failNativeClears: count => { nativeClearFailures = count; } };
}

async function until(condition, detail) {
  const deadline = Date.now() + 1500;
  while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(condition(), detail);
}

const loginUrl = 'https://public.example/login';
{
  const f = fixture();
  const completion = f.executor.openInteractive(loginUrl, 'source-1', 'Example', () => true, async () => {
    assert.equal(f.events.some(entry => Array.isArray(entry) && entry[0] === 'detach'), true,
      'old incognito controller is detached before clearing the source profile');
    assert.equal(f.events.some(entry => Array.isArray(entry) && entry[0] === 'capture'), false,
      'obsolete page must never capture its cookies');
    f.events.push('clear-owner');
    f.advanceGeneration();
    return { cookiesCleared: true, report: 'unsupported' };
  });
  await until(() => f.shown.length === 1, 'initial login is visible');
  const old = f.executor.active.surface;
  f.executor.observeDiagnosticPageBegin(loginUrl, old);
  assert.equal(f.executor.active.pageReadyAt, 0);
  f.executor.onSameDocumentNavigation('https://other.example/#not-admitted', old);
  assert.equal(f.executor.active.pageReadyAt, 0, 'foreign callbacks cannot settle the login');
  f.executor.onSameDocumentNavigation(`${loginUrl}#verified`, old);
  assert.ok(f.executor.active.pageReadyAt > 0, 'same-document history can settle without a page-end event');
  assert.equal(f.executor.navigateInteractive(old, 'back'), true);
  assert.equal(f.executor.navigateInteractive(old, 'forward'), false);
  f.addForwardHistory();
  assert.equal(f.executor.navigateInteractive(old, 'forward'), true);
  assert.equal(f.executor.navigateInteractive(old, 'refresh'), true);
  assert.deepEqual(f.events.filter(entry => ['backward', 'forward', 'refresh'].includes(entry)),
    ['backward', 'forward', 'refresh']);
  assert.equal(f.executor.requestInteractiveSessionClear(old), true);
  assert.equal(f.executor.requestInteractiveSessionClear(old), false, 'same gesture may clear only once');
  f.executor.finishInteractive(old);
  await until(() => f.shown.length === 2, 'clear opens a fresh native login');
  const fresh = f.executor.active.surface;
  assert.notEqual(fresh, old);
  assert.equal(f.shown.at(-1).clearOutcome.report, 'unsupported');
  assert.equal(f.executor.navigateInteractive(old, 'refresh'), false, 'retired view cannot navigate');
  assert.equal(f.executor.requestInteractiveSessionClear(old), false, 'retired view cannot clear');
  assert.deepEqual(f.events.filter(event => Array.isArray(event) && event[0] === 'load'),
    [['load', loginUrl], ['load', loginUrl]]);
  f.executor.finishInteractive(fresh);
  await completion;
  assert.deepEqual(f.events.filter(event => Array.isArray(event) && event[0] === 'capture'),
    [['capture', 'source-1', 2]], 'only the explicitly completed fresh view may capture cookies');
}
{
  const f = fixture();
  const completion = f.executor.openInteractive(loginUrl, 'source-2', 'Example', () => true, async () => {
    f.advanceGeneration();
    return { cookiesCleared: false, report: 'cleared' };
  });
  await until(() => f.shown.length === 1, 'initial login is visible');
  f.executor.requestInteractiveSessionClear(f.executor.active.surface);
  await assert.rejects(completion, /SOURCE_LOGIN_COOKIE_CLEAR_FAILED/);
  assert.equal(f.shown.length, 1, 'unconfirmed clearing cannot start a new browser session');
}
{
  const f = fixture();
  const completion = f.executor.openInteractive(loginUrl, 'source-3', 'Example', () => true, async () => {
    f.advanceGeneration();
    f.advanceGeneration();
    return { cookiesCleared: true, report: 'cleared' };
  });
  await until(() => f.shown.length === 1, 'initial login is visible');
  f.executor.requestInteractiveSessionClear(f.executor.active.surface);
  await assert.rejects(completion, /SOURCE_LOGIN_SESSION_RETIRED/);
  assert.equal(f.shown.length, 1, 'concurrent Host revocation must not be undone');
}
for (const failures of [1, 2]) {
  const f = fixture();
  const completion = f.executor.openInteractive(loginUrl, 'source-teardown', 'Example', () => true, async () => {
    assert.ok(f.events.some(event => Array.isArray(event) && event[0] === 'detach'));
    f.events.push('clear-owner-cookies', 'clear-core-report');
    f.advanceGeneration();
    return { cookiesCleared: true, report: 'cleared' };
  });
  const completed = completion.then(() => undefined, error => error);
  await until(() => f.shown.length === 1, 'initial login is visible');
  const old = f.executor.active.surface;
  f.failNativeClears(failures);
  assert.equal(f.executor.requestInteractiveSessionClear(old), true);
  await until(() => f.events.includes('clear-core-report'), 'native teardown failure must not consume accepted Clear');
  if (failures === 1) {
    await until(() => f.shown.length === 2, 'opening may resume after successful native cleanup on replacement');
    f.executor.cancelInteractive(f.executor.active.surface);
    assert.equal((await completed)?.code, 'CANCELLED');
  } else {
    assert.match((await completed)?.message ?? '', /incognito cookie clear failed/);
    assert.equal(f.shown.length, 1);
    assert.equal(f.events.filter(event => Array.isArray(event) && event[0] === 'load').length, 1,
      'replacement must clear native cookies successfully before loading');
  }
  assert.equal(f.events.filter(event => event === 'clear-owner-cookies').length, 1);
  assert.equal(f.events.filter(event => event === 'clear-core-report').length, 1);
  assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'capture'), false);
}
console.log('PASS source-login-v9 (native controller ports, profile fencing and clear/finish lifecycle)');
