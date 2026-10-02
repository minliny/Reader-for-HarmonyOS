import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Run the production executor with bounded platform fault models. This tool
// measures Host lifecycle behavior, not ArkWeb/device networking performance.
const app = new URL('../entry/src/main/ets/app/', import.meta.url);
const lower = name => stripTypeScriptTypes(readFileSync(new URL(name, app), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '')).replace(/^export /gm, '');
const policy = lower('HttpTransportPolicy.ts');
const route = lower('NetworkRoutePolicy.ts');
const source = lower('ArkWebExecutor.ts');
const NetworkEnvironmentError = new Function(`${route}\nreturn NetworkEnvironmentError;`)();
const Store = new Function('url', 'util', 'hilog', 'errorMessageOf',
  `${lower('CookieSecurityPolicy.ts')}\n${lower('CookieSessionStore.ts')}\nreturn CookieSessionStore;`)(
  { URL: { parseURL: (value, base) => new URL(value, base) } }, { TextEncoder }, { warn() {}, error() {} },
  error => error instanceof Error ? error.message : String(error));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const bounded = async (promise, label, millis = 250) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} did not settle`)), millis);
    })]);
  } finally { clearTimeout(timer); }
};
async function until(predicate, label) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(`missing production transition: ${label}`);
}

function fixture(realCookieStore = false) {
  const state = { route: 'direct', bypassSystemProxy: true, removeFailures: 0,
    scriptMode: 'normal', cookieMode: 'normal', events: [], loads: [], reconciled: [],
    generation: 0, seeds: [], holdRestoreAck: false, releaseRestore: undefined,
    releaseScript: undefined, releaseCookies: undefined };
  let executor;
  class Controller {
    static setHostIP(host, ip) { state.events.push({ kind: 'pin', host, ip }); }
    static clearHostIP(host) { state.events.push({ kind: 'unpin', host }); }
    stop() { state.events.push({ kind: 'stop' }); }
    loadUrl(url) {
      this.url = url;
      state.loads.push(url);
      state.events.push({ kind: 'load', url });
      executor.active.pageReadyAt = Date.now() - 1;
    }
    loadData(_body, _type, _charset, url) { this.loadUrl(url ?? 'about:blank'); }
    getUrl() { return this.url; }
    getTitle() { return 'ordinary page'; }
    async runJavaScript() {
      state.events.push({ kind: 'script' });
      if (state.scriptMode === 'hung') {
        return new Promise(resolve => { state.releaseScript = resolve; });
      }
      return JSON.stringify('ordinary result');
    }
  }
  const webview = {
    WebviewController: Controller,
    ProxyConfig: class { insertDirectRule() {} },
    ProxyController: {
      applyProxyOverride(_config, callback) { state.events.push({ kind: 'apply' }); callback(); },
      removeProxyOverride(callback) {
        const failed = state.removeFailures > 0;
        state.events.push({ kind: 'removeProxy', failed });
        if (failed) {
          state.removeFailures--;
          throw Object.assign(new Error('simulated transient restoration failure'), { code: 401 });
        }
        if (state.holdRestoreAck) { state.releaseRestore = callback; return; }
        callback();
      },
    },
    WebCookieManager: {
      clearAllCookiesSync() { state.events.push({ kind: 'clearCookies' }); },
      configCookieSync(url) { state.events.push({ kind: 'seed', url }); },
      fetchAllCookies: async () => {
        state.events.push({ kind: 'fetchCookies' });
        if (state.cookieMode === 'hung') return new Promise(resolve => { state.releaseCookies = resolve; });
        return [];
      },
    },
    WebHttpCookieSameSitePolicy: { STRICT: 1, LAX: 2, NONE: 3 },
  };
  const store = realCookieStore ? new Store() : undefined;
  // Session-only records exercise the real jar without touching AssetStore.
  if (store) store.loadPromise = Promise.resolve();
  const cookies = { instance: store ?? {
    sessionGeneration: () => state.generation,
    arkWebSeeds: async () => state.seeds,
    reconcileArkWebCookies: async (...args) => { state.reconciled.push(args); },
  } };
  const target = async url => ({ host: new URL(url).hostname, addresses: ['93.184.216.34'],
    route: state.route, bypassSystemProxy: state.bypassSystemProxy });
  const Executor = new Function('webview', 'CookieSessionStore', 'prepareNetworkTarget', 'NetworkEnvironmentError',
    `${policy}\n${source}\nreturn ArkWebExecutor;`)(webview, cookies, target, NetworkEnvironmentError);
  executor = new Executor();
  executor.attachSurfaceHost(surface => {
    if (surface) executor.attachController(surface);
    else if (executor.surfaceLease) executor.detachController(executor.surfaceLease.surface);
  });
  const execute = (id, params = {}) => executor.execute({
    document: { kind: 'url', url: 'https://source.example/book' }, javaScript: 'document.title',
    timeoutMillis: 2000, ...params,
  }, id);
  return { state, executor, execute, store };
}

const cases = [
  ['transient proxy restoration failure recovers before next job loads', async f => {
    f.state.removeFailures = 1;
    assert.equal((await f.execute(1)).value, 'ordinary result');
    assert.equal(f.executor.proxyLease.phase, 'failed');
    f.state.route = 'systemProxy'; f.state.bypassSystemProxy = false;
    const start = f.state.events.length;
    assert.equal((await f.execute(2)).value, 'ordinary result');
    const next = f.state.events.slice(start);
    assert.ok(next.findIndex(e => e.kind === 'removeProxy' && !e.failed) < next.findIndex(e => e.kind === 'load'));
    assert.equal(f.state.loads.length, 2);
  }],
  ['persistent proxy restoration failure blocks loading and remains retryable', async f => {
    f.state.removeFailures = 1;
    await f.execute(1);
    f.state.removeFailures = Infinity;
    await assert.rejects(f.execute(2), error => error instanceof NetworkEnvironmentError && error.retryable);
    assert.equal(f.state.loads.length, 1);
    f.state.removeFailures = 0;
    assert.equal((await f.execute(3)).value, 'ordinary result');
  }],
  ['missing restore acknowledgement blocks loading until its late native acknowledgement', async f => {
    f.state.holdRestoreAck = true;
    await f.execute(1);
    assert.equal(f.executor.proxyLease.phase, 'removing');
    const second = f.execute(2);
    const rejected = assert.rejects(second, error => error.code === 'CANCELLED');
    await until(() => f.executor.jobs.get(2)?.pendingWaitReject !== undefined, 'restore acknowledgement wait');
    assert.equal(f.state.loads.length, 1, 'cannot load another page under an unacknowledged override');
    f.executor.cancel(2);
    await bounded(rejected, 'restore waiter cancellation');
    f.state.holdRestoreAck = false;
    f.state.releaseRestore();
    assert.equal((await f.execute(3)).value, 'ordinary result');
  }],
  ['cancelled hung JavaScript releases serialized lane for next job', async f => {
    f.state.scriptMode = 'hung';
    const first = f.execute(1);
    const rejected = assert.rejects(first, error => error.code === 'CANCELLED');
    await until(() => f.state.releaseScript !== undefined, 'hung script');
    f.executor.cancel(1);
    await bounded(rejected, 'script cancellation');
    f.state.scriptMode = 'normal';
    assert.equal((await bounded(f.execute(2), 'next job after script cancellation')).value, 'ordinary result');
    f.state.releaseScript(JSON.stringify('late obsolete result'));
    await tick();
  }],
  ['deadline bounds a native JavaScript promise that never settles', async f => {
    f.state.scriptMode = 'hung';
    await bounded(assert.rejects(f.execute(1, { timeoutMillis: 30 }), error => error.code === 'TIMEOUT'), 'script deadline');
    assert.equal(f.executor.active, undefined);
    f.state.scriptMode = 'normal';
    assert.equal((await bounded(f.execute(2), 'next job after script deadline')).value, 'ordinary result');
  }],
  ['cancelled hung cookie capture cannot commit late cookies or block next job', async f => {
    f.state.cookieMode = 'hung';
    const first = f.execute(1, { profileId: 'session' });
    const rejected = assert.rejects(first, error => error.code === 'CANCELLED');
    await until(() => f.state.releaseCookies !== undefined, 'hung cookie capture');
    f.executor.cancel(1);
    await bounded(rejected, 'cookie capture cancellation');
    f.state.cookieMode = 'normal';
    assert.equal((await bounded(f.execute(2), 'next job after cookie capture cancellation')).value, 'ordinary result');
    f.state.releaseCookies([{ name: 'sid', value: 'late', domain: 'source.example', path: '/',
      isSecure: true, isHttpOnly: true, isSessionCookie: true, expiresDate: '', samesitePolicy: 0 }]);
    await tick(); await tick();
    assert.equal(f.state.reconciled.length, 0, 'cancelled browser work must not import delayed credentials');
  }],
  ['cookie reconciliation for one host preserves other hosts in the same session', async f => {
    for (const domain of ['source.example', 'other.example']) {
      await f.store.setCapability({ sessionId: 'session', url: `https://${domain}/`,
        cookie: { name: 'sid', value: domain, path: '/', secure: true } });
    }
    await f.execute(1, { profileId: 'session' });
    assert.deepEqual(f.state.events.filter(e => e.kind === 'seed').map(e => e.url), ['https://source.example/'],
      'the incognito task must only hydrate its exact admitted host');
    assert.equal(await f.store.cookieHeader('session', 'https://source.example/'), '',
      'an actually visited host can delete its absent cookie');
    assert.equal(await f.store.cookieHeader('session', 'https://other.example/'), 'sid=other.example',
      'the real shared jar must retain the unvisited host credential');
  }, true],
];
let failed = 0;
for (const [name, run, realCookieStore] of cases) {
  const f = fixture(realCookieStore);
  try { await run(f); console.log(`PASS: ${name}`); }
  catch (error) { failed++; console.error(`FAIL: ${name}`); console.error(error.stack ?? error); }
}
console.log(`RESULT: ${cases.length - failed}/${cases.length} ArkWeb network recovery scenarios passed`);
if (failed) process.exitCode = 1;
