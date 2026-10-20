import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Execute the production route policy and Host methods. The fake connection
// models application-scoped custom DNS rules as consulted by the resolver,
// rather than merely counting add/remove calls. It is a local fault model;
// this regression does not claim a measured device or user-acceptance result.
const app = new URL('../entry/src/main/ets/app/', import.meta.url);
const lower = name => stripTypeScriptTypes(readFileSync(new URL(name, app), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '')).replace(/^export /gm, '');
const transportSource = lower('HttpTransportPolicy.ts');
const routeSource = lower('NetworkRoutePolicy.ts');
const hostSource = lower('HttpExecuteHost.ts');
const errorSource = lower('ErrorMessage.ts');
const hostname = 'source.example';
const requestUrl = `https://${hostname}/book`;
const fakeIp = '198.18.1.2';
const publicIp = '93.184.216.34';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const response = () => ({ responseCode: 200, header: {}, result: new ArrayBuffer(0) });

function fixture() {
  const state = {
    vpn: false,
    proxy: { host: '', port: 0, exclusionList: [] },
    systemDns: [publicIp],
    rules: new Map(),
    addFailures: 0,
    removeFailures: 0,
    dnsBehavior: undefined,
    proxyBehavior: undefined,
    onCreateHttp: undefined,
    events: [],
    requests: [],
    requestBehavior: undefined,
  };
  const currentDns = host => state.rules.get(host) ?? (state.vpn ? [fakeIp] : state.systemDns);
  const resolve = async (host, netId) => {
    const addresses = [...currentDns(host)];
    state.events.push({ kind: 'dns', host, netId, addresses });
    if (state.dnsBehavior) return state.dnsBehavior(host, netId);
    return addresses.map(address => ({ address }));
  };
  const netHandle = netId => ({ netId, getAddressesByName: host => resolve(host, netId) });
  const connection = {
    getDefaultHttpProxy: async () => state.proxyBehavior ? state.proxyBehavior() :
      ({ ...state.proxy, exclusionList: [...state.proxy.exclusionList] }),
    getPacFileUrl: () => '',
    findProxyForUrl: () => assert.fail('no PAC is configured in this fault model'),
    getAddressesByName: host => resolve(host, 'system'),
    getAppNet: async () => null,
    getDefaultNet: async () => netHandle(7),
    getConnectionProperties: async () => ({
      interfaceName: state.vpn ? 'tun0' : 'eth0',
      routes: [{
        interface: state.vpn ? 'tun0' : 'eth0',
        destination: { address: { address: '0.0.0.0' }, prefixLength: 0 },
        gateway: { address: '10.0.2.2' },
        hasGateway: true,
        isDefaultRoute: true,
        isExcludedRoute: false,
      }],
    }),
    addCustomDnsRule: async (host, addresses) => {
      const failed = state.addFailures > 0;
      state.events.push({ kind: 'add', host, addresses: [...addresses], failed });
      if (failed) {
        state.addFailures--;
        throw Object.assign(new Error('simulated pin failure'), { code: 2100002 });
      }
      state.rules.set(host, [...addresses]);
    },
    removeCustomDnsRule: async host => {
      // NetManager does not make removal of an absent rule idempotent. A
      // production caller must track its ownership, not blindly clear every
      // domain before DNS resolution.
      const absent = !state.rules.has(host);
      const failed = absent || state.removeFailures > 0;
      state.events.push({ kind: 'remove', host, failed });
      if (failed) {
        if (!absent) state.removeFailures--;
        throw Object.assign(new Error('simulated cleanup failure'), { code: 2100002 });
      }
      state.rules.delete(host);
    },
  };
  const http = {
    InterceptorType: { REDIRECTION: 1 },
    HttpInterceptorChain: class { addChain() { return true; } apply() { return true; } },
    HttpDataType: { ARRAY_BUFFER: 1 },
    createHttp: () => {
      state.onCreateHttp?.();
      return {
      request: async (url, options) => {
        const host = new URL(url).hostname;
        const selectedProxy = options.usingProxy === true ? state.proxy : options.usingProxy;
        const usingProxy = selectedProxy !== false && selectedProxy?.host?.length > 0 && selectedProxy.port > 0;
        const record = { kind: 'dispatch', host, usingProxy,
          proxy: usingProxy ? { host: selectedProxy.host, port: selectedProxy.port } : undefined,
          addresses: usingProxy ? [] : [...currentDns(host)] };
        state.events.push(record);
        state.requests.push(record);
        if (!usingProxy && !state.vpn && record.addresses.includes(fakeIp)) {
          throw Object.assign(new Error('VPN fake IP is unreachable after VPN shutdown'), { code: 2300007 });
        }
        if (state.requestBehavior) return state.requestBehavior(record);
        return response();
      },
      destroy() { state.events.push({ kind: 'destroy' }); },
      };
    },
  };
  const { prepareNetworkTarget, NetworkEnvironmentError } = new Function('connection',
    `${transportSource}\n${routeSource}\nreturn { prepareNetworkTarget, NetworkEnvironmentError };`)(connection);
  const { errorMessageOf, isNetworkEnvironmentFailure } = new Function(
    `${errorSource}\nreturn { errorMessageOf, isNetworkEnvironmentFailure };`)();
  const Host = new Function('connection', 'http', 'url', 'prepareNetworkTarget', 'NetworkEnvironmentError',
    'hilog', 'errorMessageOf', `${transportSource}\n${hostSource}\nreturn HttpExecuteHost;`)(
    connection, http, { URL: { parseURL: (value, base) => new URL(value, base) } },
    prepareNetworkTarget, NetworkEnvironmentError, { warn() {}, error() {} }, errorMessageOf);
  const host = new Host();
  const deadline = () => ({ deadlineAt: Date.now() + 10000, cancelled: false, expired: new Promise(() => {}) });
  const hop = (url = requestUrl, instance = host, requestDeadline = deadline()) => instance.singleHop(url,
    { wireMethod: 'GET', enumMethod: 'GET' }, {}, { kind: 'none' }, undefined, requestDeadline);
  return { state, Host, host, hop, isNetworkEnvironmentFailure };
}

async function until(predicate, label) {
  for (let i = 0; i < 300; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(`production transition did not complete: ${label}`);
}

// A successful native transport may be reported as success or as a structured
// cleanup error. Either is acceptable here: a residual must remain tracked and
// must be removed before the next admission can trust system DNS again.
async function firstHopWithCleanupFailure(f) {
  f.state.vpn = true;
  f.state.removeFailures = 1;
  try { assert.equal((await f.hop()).status, 200); }
  catch (error) { assert.ok(f.isNetworkEnvironmentFailure(error), 'cleanup may only become a structured network failure'); }
  assert.equal(f.state.requests.length, 1, 'first VPN request reached the real production transport method');
  assert.deepEqual(f.state.requests[0].addresses, [fakeIp]);
  assert.deepEqual(f.state.rules.get(hostname), [fakeIp], 'failed native removal leaves an actual application DNS override');
}

const cases = [
  ['ordinary success pins one fresh public answer and removes it', async f => {
    assert.equal((await f.hop()).status, 200);
    assert.deepEqual(f.state.events.filter(e => e.kind === 'dns').map(e => e.addresses), [[publicIp]]);
    assert.deepEqual(f.state.events.filter(e => e.kind === 'add').map(e => e.addresses), [[publicIp]]);
    assert.equal(f.state.rules.has(hostname), false);
    assert.deepEqual(f.state.requests[0].addresses, [publicIp]);
  }],
  ['cleanup failure then VPN shutdown restores own rule before resolving fresh DNS', async f => {
    await firstHopWithCleanupFailure(f);
    f.state.vpn = false;
    const start = f.state.events.length;
    assert.equal((await f.hop()).status, 200, 'next request must recover after VPN is disabled');
    const next = f.state.events.slice(start);
    const removed = next.findIndex(e => e.kind === 'remove' && e.host === hostname && !e.failed);
    const resolved = next.findIndex(e => e.kind === 'dns');
    assert.ok(removed >= 0 && resolved > removed, 'recover the app override before fresh DNS admission');
    assert.deepEqual(next.filter(e => e.kind === 'dns').map(e => e.addresses), [[publicIp]]);
    assert.deepEqual(next.filter(e => e.kind === 'add').map(e => e.addresses), [[publicIp]]);
    assert.deepEqual(f.state.requests.at(-1).addresses, [publicIp]);
    assert.equal(f.state.rules.has(hostname), false);
  }],
  ['persistent cleanup failure is NETWORK_ENVIRONMENT and cannot dispatch', async f => {
    await firstHopWithCleanupFailure(f);
    f.state.vpn = false;
    f.state.removeFailures = Number.POSITIVE_INFINITY;
    const before = f.state.requests.length;
    await assert.rejects(f.hop(), error => f.isNetworkEnvironmentFailure(error) &&
      error.details?.phase === 'dns' && error.details?.operation === 'removeCustomDnsRule',
    'the cleanup operation must be reported as a structured recoverable network failure');
    assert.equal(f.state.requests.length, before, 'a poisoned DNS rule must never reach request.dispatch');
    assert.deepEqual(f.state.rules.get(hostname), [fakeIp]);
  }],
  ['failed DNS pin add does not fabricate ownership or remove an absent rule', async f => {
    f.state.vpn = true;
    f.state.addFailures = 1;
    await assert.rejects(f.hop(), error => f.isNetworkEnvironmentFailure(error) &&
      error.retryable && error.details.operation === 'addCustomDnsRule' &&
      error.details.platformCode === 2100002,
    'a system DNS installation failure is recoverable environment evidence, not a source rule failure');
    assert.equal(f.state.requests.length, 0, 'failed pin admission cannot dispatch');
    assert.equal(f.state.rules.has(hostname), false);
    assert.equal(f.state.events.some(e => e.kind === 'remove'), false);
    f.state.vpn = false;
    const start = f.state.events.length;
    assert.equal((await f.hop()).status, 200);
    const next = f.state.events.slice(start);
    assert.equal(next[0].kind, 'dns', 'later request must resolve normally instead of clearing fictitious ownership');
    assert.deepEqual(f.state.requests[0].addresses, [publicIp]);
    assert.equal(next.filter(e => e.kind === 'remove').length, 1, 'only the successfully added new pin is removed');
    assert.equal(f.state.rules.has(hostname), false);
  }],
  ['retry after another cleanup failure retains ownership and eventually recovers', async f => {
    await firstHopWithCleanupFailure(f);
    f.state.vpn = false;
    f.state.removeFailures = 1;
    const before = f.state.requests.length;
    await assert.rejects(f.hop(), error => f.isNetworkEnvironmentFailure(error) &&
      error.details?.operation === 'removeCustomDnsRule');
    assert.equal(f.state.requests.length, before);
    assert.deepEqual(f.state.rules.get(hostname), [fakeIp]);
    const start = f.state.events.length;
    assert.equal((await f.hop(requestUrl, new f.Host())).status, 200);
    const next = f.state.events.slice(start);
    assert.equal(next[0].kind, 'remove', 'ownership survives repeated cleanup errors across Host instances');
    assert.equal(next[0].failed, false);
    assert.equal(next[1].kind, 'dns');
    assert.deepEqual(next[1].addresses, [publicIp]);
    assert.deepEqual(f.state.requests.at(-1).addresses, [publicIp]);
    assert.equal(f.state.rules.has(hostname), false);
  }],
  ['same-host requests serialize across Host instances without deleting a live pin', async f => {
    let releaseFirst;
    const held = new Promise(resolve => { releaseFirst = resolve; });
    f.state.requestBehavior = async () => {
      if (f.state.requests.length === 1) await held;
      return response();
    };
    const first = f.hop();
    await until(() => f.state.requests.length === 1, 'first held dispatch');
    const second = f.hop(requestUrl, new f.Host());
    try {
      for (let i = 0; i < 5; i++) await tick();
      assert.equal(f.state.requests.length, 1);
      assert.equal(f.state.events.filter(e => e.kind === 'dns').length, 1,
        'queued admission must not resolve through its predecessor application DNS pin');
      assert.deepEqual(f.state.rules.get(hostname), [publicIp]);
      assert.equal(f.state.events.filter(e => e.kind === 'remove').length, 0,
        'queued admission cannot remove its predecessor DNS pin');
      releaseFirst();
      assert.equal((await first).status, 200);
      assert.equal((await second).status, 200);
      assert.equal(f.state.requests.length, 2);
      assert.equal(f.state.rules.has(hostname), false);
    } finally { releaseFirst(); await Promise.allSettled([first, second]); }
  }],
  ['different domains dispatch independently while the first host lease is held', async f => {
    let releaseFirst;
    const held = new Promise(resolve => { releaseFirst = resolve; });
    f.state.requestBehavior = async record => {
      if (record.host === hostname) await held;
      return response();
    };
    const first = f.hop();
    await until(() => f.state.requests.length === 1, 'first host held dispatch');
    const second = f.hop('https://other.example/book', new f.Host());
    try {
      await until(() => f.state.requests.length === 2, 'other host independent dispatch');
      assert.equal((await second).status, 200);
      assert.deepEqual(f.state.rules.get(hostname), [publicIp], 'other domain cannot remove the held first pin');
      assert.equal(f.state.rules.has('other.example'), false, 'other domain cleans its own finished pin');
      assert.deepEqual(f.state.events.filter(e => e.kind === 'dns').map(e => e.host), [hostname, 'other.example']);
      releaseFirst();
      assert.equal((await first).status, 200);
      assert.equal(f.state.rules.size, 0);
    } finally { releaseFirst(); await Promise.allSettled([first, second]); }
  }],
  ['queued request after VPN shutdown and failed cleanup uses new DNS', async f => {
    f.state.vpn = true;
    f.state.removeFailures = 1;
    let releaseFirst;
    const held = new Promise(resolve => { releaseFirst = resolve; });
    f.state.requestBehavior = async () => {
      if (f.state.requests.length === 1) await held;
      return response();
    };
    const first = f.hop();
    await until(() => f.state.requests.length === 1, 'VPN held dispatch');
    const second = f.hop(requestUrl, new f.Host());
    try {
      for (let i = 0; i < 5; i++) await tick();
      assert.equal(f.state.requests.length, 1);
      f.state.vpn = false;
      releaseFirst();
      try { assert.equal((await first).status, 200); }
      catch (error) { assert.ok(f.isNetworkEnvironmentFailure(error)); }
      assert.equal((await second).status, 200);
      assert.deepEqual(f.state.requests[1].addresses, [publicIp]);
      assert.deepEqual(f.state.events.filter(e => e.kind === 'add').map(e => e.addresses), [[fakeIp], [publicIp]]);
      assert.equal(f.state.rules.has(hostname), false);
    } finally { releaseFirst(); await Promise.allSettled([first, second]); }
  }],
  ['private DNS answers remain blocked after residual recovery', async f => {
    await firstHopWithCleanupFailure(f);
    f.state.vpn = false;
    f.state.systemDns = ['192.168.1.7'];
    const before = f.state.requests.length;
    await assert.rejects(f.hop(), /private, loopback, link-local or invalid address/);
    assert.equal(f.state.requests.length, before);
    assert.equal(f.state.rules.has(hostname), false, 'own residue was recovered before the private answer was rejected');
  }],
  ['proxy switch does not pin, resolve source DNS or remove another domain rule', async f => {
    f.state.rules.set('unrelated.example', ['93.184.216.35']);
    assert.equal((await f.hop()).status, 200);
    f.state.proxy = { host: 'system-proxy', port: 8080, exclusionList: [] };
    const start = f.state.events.length;
    assert.equal((await f.hop()).status, 200);
    const next = f.state.events.slice(start);
    assert.equal(next.some(e => e.kind === 'dns' || e.kind === 'add' || e.kind === 'remove'), false);
    assert.equal(f.state.requests.at(-1).usingProxy, true);
    assert.deepEqual(f.state.rules.get('unrelated.example'), ['93.184.216.35']);
  }],
  ['proxy switch recovers only its tracked residual without adding a new DNS pin', async f => {
    f.state.rules.set('unrelated.example', ['93.184.216.35']);
    await firstHopWithCleanupFailure(f);
    f.state.vpn = false;
    f.state.proxy = { host: 'system-proxy', port: 8080, exclusionList: [] };
    const start = f.state.events.length;
    assert.equal((await f.hop()).status, 200);
    const next = f.state.events.slice(start);
    assert.deepEqual(next.filter(e => e.kind === 'remove').map(e => e.host), [hostname]);
    assert.equal(next.some(e => e.kind === 'dns' || e.kind === 'add'), false);
    assert.equal(f.state.rules.has(hostname), false);
    assert.deepEqual(f.state.rules.get('unrelated.example'), ['93.184.216.35']);
    assert.equal(f.state.requests.at(-1).usingProxy, true);
  }],
];

async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('cancelled DNS admission retained the host lease')), 200);
    })]);
  } finally { clearTimeout(timer); }
}

for (const operation of ['dns', 'proxy']) {
  cases.push([`cancelled ${operation} admission releases its host lease and rejects late addresses`, async f => {
    let releaseRead, started = false;
    const held = new Promise(resolve => { releaseRead = resolve; });
    const behavior = () => { started = true; return held; };
    f.state.vpn = true;
    f.state[operation === 'dns' ? 'dnsBehavior' : 'proxyBehavior'] = behavior;
    const deadline = f.host.createDeadline(2000);
    const first = f.hop(requestUrl, f.host, deadline);
    try {
      await until(() => started, `${operation} admission started`);
      f.host.cancelDeadline(deadline, 'cancel network admission');
      await assert.rejects(bounded(first), /cancel network admission/);
      f.state.vpn = false;
      f.state.dnsBehavior = undefined;
      f.state.proxyBehavior = undefined;
      assert.equal((await bounded(f.hop())).status, 200, 'restored network request cannot join a hung read');
      releaseRead(operation === 'dns' ? [{ address: fakeIp }] : { host: '', port: 0, exclusionList: [] });
      await tick(); await tick();
      assert.deepEqual(f.state.events.filter(e => e.kind === 'add').map(e => e.addresses), [[publicIp]],
        'a cancelled late admission cannot install the old VPN address');
    } finally {
      releaseRead(operation === 'dns' ? [{ address: fakeIp }] : { host: '', port: 0, exclusionList: [] });
      f.host.disposeDeadline(deadline);
      await first.catch(() => {});
    }
  }]);
}

cases.push(['DNS admission timeout releases the same-host queue', async f => {
  f.state.dnsBehavior = () => new Promise(() => {});
  const deadline = f.host.createDeadline(20);
  const first = f.hop(requestUrl, f.host, deadline);
  try {
    await assert.rejects(bounded(first), /exceeded total deadline/);
    f.state.dnsBehavior = undefined;
    assert.equal((await bounded(f.hop())).status, 200);
  } finally { f.host.disposeDeadline(deadline); }
}]);

cases.push(['disabling the system proxy after admission cannot create an unvalidated direct hop', async f => {
  f.state.proxy = { host: 'selected-system-proxy', port: 8080, exclusionList: [] };
  f.state.systemDns = ['127.0.0.1'];
  f.state.onCreateHttp = () => { f.state.proxy = { host: '', port: 0, exclusionList: [] }; };
  assert.equal((await f.hop()).status, 200);
  assert.equal(f.state.requests[0].usingProxy, true,
    'the admitted system proxy must be fixed for this hop instead of falling back to unvalidated local DNS');
  assert.deepEqual(f.state.requests[0].proxy, { host: 'selected-system-proxy', port: 8080 });
  assert.equal(f.state.events.filter(e => e.kind === 'dns').length, 0);
  await assert.rejects(f.hop(), /private, loopback, link-local or invalid address/,
    'the next request observes disabled proxy and enforces the fresh direct DNS gate');
  assert.equal(f.state.requests.length, 1);
}]);

let failed = 0;
for (const [name, run] of cases) {
  const f = fixture();
  try {
    await run(f);
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error);
    console.error(`EVENTS: ${JSON.stringify(f.state.events)}`);
  }
}
console.log(`RESULT: ${cases.length - failed}/${cases.length} production HTTP VPN/DNS recovery scenarios passed`);
if (failed > 0) process.exitCode = 1;
