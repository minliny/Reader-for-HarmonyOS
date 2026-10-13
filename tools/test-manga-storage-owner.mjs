import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { coreAdmissionFailureSummary, httpResponseFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';

// The Owner business methods are extracted unchanged. Native Core/Disk ports
// expose order and exact arguments; the Disk suite owns real physical files,
// retention protection and its internal restore reconciliation regressions.
const sourceFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const productionSource = readFileSync(sourceFile);
const checks = [];
const pass = name => checks.push(name);
const tick = () => new Promise(resolve => setImmediate(resolve));
const identity = { sourceId: 'source', bookId: 'manga', chapterId: 'https://chapter/removed' };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const events = [], coreCalls = [], clears = [], finishes = [], diagnosticLogs = [];
  let core = async (_method, params) => ({ data: { scope: params.scope } });
  let cleanup = async () => {};
  let close = async () => {};
  const Owner = productionMotionMethods(sourceFile, [
    'requestDirect', 'listMangaDownloadChapters', 'listMangaDownloadVersions', 'deleteMangaDownload',
  ], {
    DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000, LOG_DOMAIN: 0,
    coreAdmissionFailureSummary, httpResponseFailureSummary,
    hilog: { warn: (...args) => diagnosticLogs.push(args) },
    MangaChapterPreparationCoordinator: { forRuntime: actual => {
      assert.equal(actual, owner);
      return { close: async () => { events.push('coordinator.close'); await close(); events.push('coordinator.closed'); } };
    } },
  });
  const owner = new Owner();
  owner.state = 'ready';
  owner.preparationIntentEpoch = 0;
  owner.start = async () => { events.push('start'); };
  owner.readingEntryPreparations = () => ({
    beginRequest(method, params) { events.push('preparation.begin'); return true; },
    finishRequest(method, params) { events.push('preparation.finish'); finishes.push({ method, params }); },
  });
  owner.wakeReadingPreparations = () => assert.fail('these storage operations must not wake unrelated preparation');
  owner.mangaImageTail = Promise.resolve();
  owner.runtime = { request: async (method, params, options) => {
    coreCalls.push({ method, params, options }); events.push('core.request');
    const result = await core(method, params, options); events.push('core.result'); return result;
  } };
  owner.readingImageDiskCache = {
    async maintainMangaStorage(reason, scope) { clears.push({ reason, scope }); events.push('disk.clear'); await cleanup(reason, scope); events.push('disk.cleared'); },
    async clearMangaRebuildableCache(scope) { const actualScope = scope === undefined ? undefined : { sourceId: scope.sourceId, bookId: scope.bookId }; clears.push({ reason: 'clear', scope: actualScope }); events.push('disk.clear'); await cleanup('clear', actualScope); events.push('disk.cleared'); return { deletedBytes: 0, deletedFiles: 0 }; },
    async withMangaStorageRestore(restore) {
      events.push('disk.restore.barrier');
      try { return await restore(); }
      finally { events.push('disk.restore.reconcile'); }
    },
    clearBook() { assert.fail('Core cache.clear must use granted ordinary maintenance, not delete a book directly'); },
    deleteMangaVersion() { assert.fail('ordinary clearing must not delete a downloaded version'); },
  };
  return { owner, events, coreCalls, clears, finishes, diagnosticLogs,
    setCore: action => { core = action; }, setCleanup: action => { cleanup = action; }, setClose: action => { close = action; } };
}

{
  const f = fixture(), core = deferred(), host = deferred(); let settled = false;
  const params = { scope: 'book', sourceId: identity.sourceId, bookId: identity.bookId };
  const result = { data: { scope: 'book', cacheEntriesRemoved: 2 } };
  f.setCore(async () => core.promise); f.setCleanup(async () => host.promise);
  const work = f.owner.requestDirect('cache.clear', params).then(value => { settled = true; return value; });
  await tick(); assert.equal(f.coreCalls.length, 1); assert.equal(f.clears.length, 0); assert.equal(f.finishes.length, 0);
  core.resolve(result); await tick();
  assert.deepEqual(f.clears, [{ reason: 'clear', scope: { sourceId: identity.sourceId, bookId: identity.bookId } }]);
  assert.equal(settled, false); assert.equal(f.finishes.length, 0, 'preparation remains owned until Host physical policy finishes');
  host.resolve(); assert.equal(await work, result); assert.equal(f.finishes.length, 1); assert.equal(f.finishes[0].params, params);
  assert.ok(f.events.indexOf('core.result') < f.events.indexOf('disk.clear'));
  assert.ok(f.events.indexOf('disk.cleared') < f.events.indexOf('preparation.finish'));
  assert.equal(f.owner.preparationIntentEpoch, 1);
  pass('Core confirms before ordinary physical policy; Host completion is awaited and preparation finishes exactly once');
}

for (const scope of ['all', 'cache', 'book']) {
  const f = fixture(); const params = { scope, ...(scope === 'book' ? { sourceId: 'exact-source', bookId: 'exact-book' } : {}) };
  const result = { data: { scope } }; f.setCore(async () => result);
  const cancel = () => false, hostRequest = { marker: 'unchanged' }, options = { timeoutMs: 1717, pollMs: 9, shouldCancel: cancel, hostRequest };
  assert.equal(await f.owner.requestDirect('cache.clear', params, options), result);
  assert.deepEqual(f.clears, [{ reason: 'clear', scope: scope === 'book' ? { sourceId: 'exact-source', bookId: 'exact-book' } : undefined }]);
  assert.equal(f.coreCalls[0].params, params); assert.equal(f.coreCalls[0].options, options); assert.equal(f.finishes.length, 1);
}
pass('all/cache clear the ordinary manga policy globally; book uses only its exact source/book scope and preserves request options');

for (const scope of ['all', 'cache', 'book']) {
  for (const failure of ['Core rejection', 'wrong scope', 'Host failure']) {
    const f = fixture(), error = new Error(failure);
    const params = { scope, ...(scope === 'book' ? { sourceId: identity.sourceId, bookId: identity.bookId } : {}) };
    if (failure === 'Core rejection') f.setCore(async () => { throw error; });
    if (failure === 'wrong scope') f.setCore(async () => ({ data: { scope: scope === 'cache' ? 'all' : 'cache' } }));
    if (failure === 'Host failure') f.setCleanup(async () => { throw error; });
    await assert.rejects(f.owner.requestDirect('cache.clear', params), failure === 'wrong scope' ? /did not confirm/ : actual => actual === error);
    assert.equal(f.clears.length, failure === 'Host failure' ? 1 : 0); assert.equal(f.finishes.length, 1);
  }
}
pass('Core failure and mismatched scope never start physical policy; Host failures propagate for every scope and still settle preparation');

{
  const f = fixture(), gate = deferred(); let cancelled = false;
  const failure = new Error('core request cancelled'), params = { scope: 'cache' };
  f.setCore(async (_method, _params, options) => { await gate.promise; assert.equal(options.shouldCancel(), true); throw failure; });
  const work = f.owner.requestDirect('cache.clear', params, { shouldCancel: () => cancelled });
  await tick(); cancelled = true; gate.resolve();
  await assert.rejects(work, error => error === failure); assert.equal(f.clears.length, 0); assert.equal(f.finishes.length, 1);
  pass('request cancellation reaches Core and is never promoted to a successful physical clear');
}

for (const outcome of ['success', 'wrong scope', 'rejected', 'Host failure']) {
  const f = fixture(), gate = deferred(), result = { data: { scope: outcome === 'wrong scope' ? 'cache' : 'book' } };
  const error = new Error('tracked rejection'), params = { scope: 'book', sourceId: identity.sourceId, bookId: identity.bookId };
  if (outcome === 'Host failure') f.setCleanup(async () => { throw error; });
  f.owner.mangaOfflineProbe = {
    mode: 'offline',
    ownsCommand(method, actual) { assert.equal(method, 'cache.clear'); assert.equal(actual, params); return true; },
    assertCapacity() { f.events.push('probe.capacity'); return true; },
    track(id) { assert.equal(id, 51); f.events.push('probe.track'); },
    current(id) { assert.equal(id, 51); return true; },
    settle(id) { assert.equal(id, 51); f.events.push('probe.settle'); },
  };
  f.owner.runtime.send = (method, actual) => { assert.equal(method, 'cache.clear'); assert.equal(actual, params); f.events.push('core.send'); return 51; };
  f.owner.runtime.waitForResult = async (id, options) => {
    assert.equal(id, 51); assert.equal(options.shouldCancel(), false); f.events.push('core.wait'); await gate.promise;
    if (outcome === 'rejected') throw error;
    f.events.push('core.result'); return result;
  };
  const work = f.owner.requestDirect('cache.clear', params); const rejection = outcome === 'success' ? undefined :
    assert.rejects(work, outcome === 'wrong scope' ? /did not confirm/ : actual => actual === error);
  await tick(); assert.equal(f.clears.length, 0); assert.equal(f.finishes.length, 0);
  assert.ok(f.events.indexOf('probe.track') < f.events.indexOf('core.wait'));
  gate.resolve();
  if (outcome === 'success') {
    assert.equal(await work, result); assert.equal(f.clears.length, 1);
    assert.ok(f.events.indexOf('probe.settle') < f.events.indexOf('disk.clear'));
  } else { await rejection; assert.equal(f.clears.length, outcome === 'Host failure' ? 1 : 0); }
  assert.equal(f.finishes.length, 1); assert.equal(f.coreCalls.length, 0, 'tracked dispatch must not dispatch twice');
}
pass('probe-tracked book clear shares scope validation and Host policy after send/track/wait, including its rejection paths');

for (const method of ['runtime.storage.restore', 'runtime.storage.apply']) {
  const f = fixture(), close = deferred(), images = deferred(), core = deferred();
  const params = { opaqueSnapshot: 'current' }, options = { pollMs: 5, shouldCancel: () => false }, result = { data: { restored: true } };
  f.setClose(async () => close.promise); f.owner.mangaImageTail = images.promise.then(() => { f.events.push('images.finished'); });
  f.setCore(async () => core.promise);
  const work = f.owner.requestDirect(method, params, options); await tick();
  assert.deepEqual(f.events, ['preparation.begin', 'start', 'coordinator.close']); assert.equal(f.coreCalls.length, 0);
  close.resolve(); await tick(); assert.equal(f.coreCalls.length, 0); assert.ok(!f.events.includes('disk.restore.barrier'));
  images.resolve(); await tick();
  assert.deepEqual(f.events, ['preparation.begin', 'start', 'coordinator.close', 'coordinator.closed', 'images.finished', 'disk.restore.barrier', 'core.request']);
  assert.equal(f.coreCalls[0].method, method); assert.equal(f.coreCalls[0].params, params);
  assert.deepEqual(f.coreCalls[0].options, { ...options, timeoutMs: 30000 }); assert.equal(f.finishes.length, 0);
  core.resolve(result); assert.equal(await work, result);
  assert.deepEqual(f.events.slice(-3), ['core.result', 'disk.restore.reconcile', 'preparation.finish']);
  assert.equal(f.finishes.length, 1); assert.equal(f.clears.length, 0); assert.equal(f.owner.preparationIntentEpoch, 1);
}
pass('restore/apply close the coordinator, drain image work, enter Disk barrier, request Core, reconcile, then finish preparation');

for (const method of ['runtime.storage.restore', 'runtime.storage.apply']) {
  const f = fixture(), failure = new Error('snapshot rejected'); f.setCore(async () => { throw failure; });
  await assert.rejects(f.owner.requestDirect(method, {}, { timeoutMs: 8123 }), error => error === failure);
  assert.equal(f.coreCalls[0].options.timeoutMs, 8123); assert.ok(f.events.includes('disk.restore.reconcile')); assert.equal(f.finishes.length, 1);
  const interrupted = fixture(), closeError = new Error('close interrupted'); interrupted.setClose(async () => { throw closeError; });
  await assert.rejects(interrupted.owner.requestDirect(method), error => error === closeError);
  assert.equal(interrupted.coreCalls.length, 0); assert.ok(!interrupted.events.includes('disk.restore.barrier')); assert.equal(interrupted.finishes.length, 1);
}
pass('snapshot failures preserve the original error and reconciliation; coordinator failure prevents Core dispatch but settles preparation');

{
  const f = fixture(), chapters = [{ ...identity }], versions = ['old', 'partial-new']; let current = true;
  const guard = () => current, calls = [], failure = new Error('download operation superseded'); let deletion = false;
  f.owner.readingImageDiskCache = {
    async listMangaDownloadChapters(sourceId, bookId, actual) {
      calls.push(['chapters', sourceId, bookId, actual]); assert.equal(actual, guard); if (!actual()) throw failure; return chapters;
    },
    async listMangaDownloadVersions(chapter, actual) {
      calls.push(['versions', chapter, actual]); assert.equal(chapter, identity); assert.equal(actual, guard); if (!actual()) throw failure; return versions;
    },
    async deleteMangaVersion(chapter, actual) {
      calls.push(['delete', chapter, actual]); assert.equal(actual, guard);
      assert.deepEqual(chapter, { ...identity, contentVersion: 'partial-new' }); if (!actual()) throw failure; return deletion;
    },
  };
  assert.equal(await f.owner.listMangaDownloadChapters(identity.sourceId, identity.bookId, guard), chapters);
  assert.equal(await f.owner.listMangaDownloadVersions(identity, guard), versions);
  assert.equal(await f.owner.deleteMangaDownload(identity, 'partial-new', guard), false, 'a busy/failed exact deletion must not become successful');
  deletion = true; assert.equal(await f.owner.deleteMangaDownload(identity, 'partial-new', guard), true);
  current = false;
  for (const call of [() => f.owner.listMangaDownloadChapters(identity.sourceId, identity.bookId, guard),
    () => f.owner.listMangaDownloadVersions(identity, guard), () => f.owner.deleteMangaDownload(identity, 'partial-new', guard)]) {
    await assert.rejects(call(), error => error === failure);
  }
  assert.equal(f.coreCalls.length, 0); assert.equal(f.clears.length, 0); assert.equal(f.finishes.length, 0);
  assert.deepEqual(calls[0].slice(0, 3), ['chapters', identity.sourceId, identity.bookId]);
  assert.equal(Object.hasOwn(identity, 'contentVersion'), false, 'version adaptation must not mutate the caller chapter');
  pass('download Owner APIs preserve exact identities, version and cancellation guards; original failures and false results remain unchanged');
}

{
  const configured = [], requests = [], reserves = [], externalCalls = [];
  const context = { filesDir: '/private/app/files', cacheDir: '/private/app/cache' };
  const chapter = { ...identity, contentVersion: 'exact-version' }, grant = { ...chapter, grantToken: 'exact-grant' };
  const files = [{ path: `${context.filesDir}/reader-manga-display-v1/tile.bin`, owners: [chapter], live: false }];
  const reservation = { release() {} };
  let authority, external, reserve, response = { status: 'download', inUse: true, lastReadAt: 123 }, requestFailure;
  const body = {
    configureMangaDisplayCache(path) { configured.push(path); },
    setMangaDisplayReserve(callback) { reserve = callback; },
    async mangaDisplayInventory() { externalCalls.push(['inventory']); return files; },
    async removeMangaDisplay(actualGrant, actualFiles) { externalCalls.push(['remove', actualGrant, actualFiles]); return false; },
    async removeMangaDerived(actualChapter, actualFiles, current) {
      externalCalls.push(['removeDerived', actualChapter, actualFiles, current]); return await current();
    },
  };
  const Binding = productionMotionMethods(sourceFile, ['bindMangaStorage'], {
    ReadingBodyImageHost: { instance: body,
      setDisplayCacheDir() { assert.fail('manga storage binding must not replace the ordinary novel cache namespace'); } },
  });
  const owner = Object.assign(new Binding(), {
    host: { getContext: () => context },
    readingImageDiskCache: {
      setMangaStorageAuthority(value) { authority = value; },
      setMangaExternalStorage(value) { external = value; },
      async reserveExternalWrite(...args) { reserves.push(args); return reservation; },
    },
    async request(method, params) {
      requests.push({ method, params }); if (requestFailure !== undefined) throw requestFailure; return { data: response };
    },
  });
  owner.bindMangaStorage();
  assert.deepEqual(configured, [context.filesDir], 'actual manga binding uses persistent app filesDir');
  // Constructor execution belongs to native Host startup. Keep its independent
  // legacy namespace anchor visible while executing the real binding above.
  assert.match(productionSource.toString('utf8'), /^\s*ReadingBodyImageHost\.setDisplayCacheDir\(context\.cacheDir\);$/m,
    'the existing novel startup namespace remains context.cacheDir');
  for (const priority of ['foreground', 'chapter', 'download', 'background']) {
    assert.equal(await reserve(chapter, 8192, priority), reservation);
    assert.deepEqual(reserves.at(-1), [chapter, 8192, priority === 'foreground' ? 'foreground' : 'background', 'derived']);
  }
  pass('production manga binding configures filesDir independently of novel cacheDir; every display reserve is derived and maps foreground/chapter/download/background priorities');

  const selector = { chapter: { ...identity }, manifestVersion: chapter.contentVersion };
  assert.equal(await authority.classify(chapter), 'download');
  assert.deepEqual(await authority.policy(chapter), response);
  assert.deepEqual(requests.slice(-2), [{ method: 'manga.cache.classify', params: selector }, { method: 'manga.cache.classify', params: selector }]);
  for (const status of ['cache', 'download', 'protected', 'unknown', 'missing']) for (const inUse of [true, false]) {
    for (const lastReadAt of [null, 0, 1717171717]) {
      response = { status, inUse, lastReadAt }; assert.deepEqual(await authority.policy(chapter), response);
      assert.deepEqual(requests.at(-1), { method: 'manga.cache.classify', params: selector });
    }
  }
  for (const data of [
    { status: 'download', lastReadAt: null }, { status: 'download', inUse: false },
    ...[null, 'false', 0, undefined].map(inUse => ({ status: 'download', inUse, lastReadAt: null })),
    ...['123', false, {}, [], undefined, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
      .map(lastReadAt => ({ status: 'download', inUse: false, lastReadAt })),
  ]) {
    response = data; await assert.rejects(authority.policy(chapter), /MANGA_CACHE_POLICY_UNAVAILABLE/);
  }
  requestFailure = new Error('policy RPC rejected');
  await assert.rejects(authority.policy(chapter), error => error === requestFailure); requestFailure = undefined;
  pass('production authority policy reads the exact classify RPC and preserves independent inUse/read clock facts; missing or mistyped facts and RPC failures reject without defaults');

  response={grant:null};assert.equal(await authority.claim(chapter),undefined);
  assert.deepEqual(requests.at(-1),{method:'manga.cache.eviction.claim',params:selector},'capacity/clear retain the original exact selector');
  const expiry={nowSeconds:1790000000,ttlSeconds:7*24*60*60};assert.equal(await authority.claim(chapter,expiry),undefined);
  assert.deepEqual(requests.at(-1),{method:'manga.cache.eviction.claim',params:{...selector,...expiry}},'expiry passes both immutable Core TTL guard fields');
  pass('production eviction claim forwards atomic expiry time/TTL guard only when supplied; capacity and explicit clear keep their prior exact identity');

  assert.equal(await external.inventory(), files);
  assert.equal(await external.remove(grant, files), false);
  assert.deepEqual(externalCalls.at(-1), ['remove', grant, files]);
  let current = true, checks = 0;
  const guard = async () => { checks++; await tick(); return current; };
  assert.equal(await external.removeDerived(chapter, files, guard), true);
  assert.deepEqual(externalCalls.at(-1), ['removeDerived', chapter, files, guard]);
  current = false; assert.equal(await external.removeDerived(chapter, files, guard), false); assert.equal(checks, 2);
  const failure = new Error('derived policy changed'), failingGuard = async () => { throw failure; };
  await assert.rejects(external.removeDerived(chapter, files, failingGuard), error => error === failure);
  assert.deepEqual(externalCalls.at(-1), ['removeDerived', chapter, files, failingGuard]);
  pass('external download derivative removal forwards exact owner/files and the original async authority guard; false and guard failures are unchanged');
}

{
  const events = [], maintenance = [], foregroundNotifications = [];
  let owner, networkCallback;
  // A foreground transition can leave the network allowance unchanged false.
  // The Host intentionally emits no callback in this fixture: the Owner must
  // explicitly wake the manga scheduler instead of relying on network events.
  class NetworkHost {
    constructor(callback) { networkCallback = callback; }
    allowed() { return false; }
    setForeground(value) { foregroundNotifications.push(value); }
  }
  const Owner = productionMotionMethods(sourceFile, [
    'isMangaPreparationForeground', 'allowOptionalMangaPreparation', 'setReadingPreparationContext',
  ], { ReaderPreparationNetworkHost: NetworkHost, LOG_DOMAIN: 0,
    hilog: { warn: () => assert.fail('maintenance must finish without an injected failure') },
    MangaChapterPreparationCoordinator: { forRuntime(actual) {
      assert.equal(actual, owner); return { networkChanged() { events.push('manga.wake'); } };
    } },
  });
  owner = Object.assign(new Owner(), { state: 'ready', preparationForeground: false, preparationCatalogAllowed: false,
    bookCoordinator: { visibilityChanged() { events.push('novel.visibility'); } },
    wakeReadingPreparations() { events.push('owner.wake'); },
    readingImageDiskCache: { async maintainMangaStorage(...args) { maintenance.push(args); } },
  });
  for (const state of ['ready', 'starting', 'idle', 'failed', 'closing', 'closed']) {
    owner.state = state;
    for (const foreground of [false, true]) for (const allowed of [false, true]) {
      owner.preparationForeground = foreground; owner.preparationNetwork = { allowed: () => allowed };
      assert.equal(owner.isMangaPreparationForeground(), state === 'ready' && foreground,
        'current chapter foreground admission depends on runtime visibility even when optional network is disallowed');
      assert.equal(owner.allowOptionalMangaPreparation(), state === 'ready' && foreground && allowed,
        'optional adjacent work retains its independent network allowance');
    }
  }
  pass('production foreground predicate requires ready and foreground independently of network policy; optional manga remains network-gated');

  owner.state = 'ready'; owner.preparationForeground = false; owner.preparationNetwork = undefined;
  owner.setReadingPreparationContext(false, true);
  assert.ok(owner.preparationNetwork instanceof NetworkHost);
  assert.deepEqual(foregroundNotifications, [false]);
  assert.deepEqual(events.splice(0), ['novel.visibility', 'owner.wake']);
  assert.equal(owner.preparationCatalogAllowed, true); assert.equal(maintenance.length, 0);
  owner.setReadingPreparationContext(true, false);
  assert.deepEqual(events.splice(0), ['manga.wake', 'novel.visibility', 'owner.wake']);
  assert.deepEqual(foregroundNotifications, [false, true]);
  assert.equal(owner.isMangaPreparationForeground(), true); assert.equal(owner.allowOptionalMangaPreparation(), false);
  assert.equal(owner.preparationCatalogAllowed, false); assert.deepEqual(maintenance, [['expiry']]);
  owner.setReadingPreparationContext(true, true);
  assert.deepEqual(events.splice(0), ['novel.visibility', 'owner.wake'], 'unchanged visibility still reaches the existing novel coordinator');
  assert.deepEqual(foregroundNotifications, [false, true]);
  owner.setReadingPreparationContext(false, false);
  assert.deepEqual(events.splice(0), ['manga.wake', 'novel.visibility', 'owner.wake']);
  assert.deepEqual(foregroundNotifications, [false, true, false]);
  assert.equal(owner.isMangaPreparationForeground(), false);
  pass('both foreground transitions explicitly wake manga while network allowance stays false; novel visibility and generic preparation notifications retain their prior behavior');

  networkCallback();
  assert.deepEqual(events.splice(0), ['novel.visibility', 'manga.wake', 'owner.wake'],
    'actual network observer callbacks still notify both chapter coordinators and the shared wake owner');
  pass('production network observer callback continues to notify novel and manga preparation');

  for (const state of ['closing', 'closed']) {
    owner.state = state; owner.preparationForeground = true; owner.preparationCatalogAllowed = true;
    const beforeForeground = foregroundNotifications.length, beforeMaintenance = maintenance.length;
    owner.setReadingPreparationContext(false, false);
    assert.equal(owner.preparationForeground, true); assert.equal(owner.preparationCatalogAllowed, true);
    assert.equal(owner.isMangaPreparationForeground(), false); assert.deepEqual(events, []);
    assert.equal(foregroundNotifications.length, beforeForeground); assert.equal(maintenance.length, beforeMaintenance);
  }
  await tick();
  pass('closing and closed Owners reject foreground context updates without wake, visibility, network or maintenance side effects');
}

assert.deepEqual(readFileSync(sourceFile), productionSource, 'the production Owner must remain unchanged throughout this run');
console.log(JSON.stringify({ status: 'PASS', productionSourceSha256: createHash('sha256').update(productionSource).digest('hex'), checks }, null, 2));
