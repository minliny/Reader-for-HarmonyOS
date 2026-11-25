import assert from 'node:assert/strict';
import test from 'node:test';
import { readingPrefetchOwnerProbe } from './lib/reading-prefetch-owner-probe.mjs';

const { ReadingOfflineGateway } = await import('../entry/src/main/ets/features/reading/application/ReadingOfflineGateway.ts');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(options = {}) {
  let now = 1_000;
  let timerId = 0;
  let revision = 0;
  let navigation = 0;
  let foregroundBusy = false;
  let networkAllowed = options.networkAllowed ?? true;
  let storageAllowed = options.storageAllowed ?? true;
  let manualBusy = false;
  const timers = new Map();
  const foreground = new Set();
  const network = new Set();
  const requests = [];
  const cached = new Set(options.cached ?? [7]);
  const failures = new Map();
  const guards = [];
  let statusReads = 0;
  let block;
  const entries = Array.from({ length: 24 }, (_, index) => ({
    index, url: `https://reader.invalid/${index}`, title: `章 ${index}`, variables: [],
  }));
  const session = {
    contentKind: options.contentKind ?? 'text', acquisitionMode: 'online',
    identity: { sourceId: options.sourceId ?? 'source', bookId: 'book' },
    sourceVersion: 'version', catalogVersion: 'catalog', contextVersion: 'context',
    continuationVariables: [], hostRequirements: [], entries,
  };
  let displayed = session;
  let directory = entries.map(entry => ({ ...entry, downloadState: 'missing' }));
  const body = '这一段正文将由供试读使用的书源返回。'.repeat(90);
  const runtime = {
    captureReadingContentValidity() {
      const captured = revision;
      return () => revision === captured;
    },
    observeDeepReadingPrefetchNetwork(listener) {
      network.add(listener);
      return () => network.delete(listener);
    },
    deepReadingPrefetchNetworkAllowed: () => networkAllowed,
    canDeepReadingPrefetchWrite: async () => storageAllowed,
    bookAcquisitions() { return coordinator; },
    async request(method, params) {
      if (method !== 'cache.book.status') throw new Error(`Unexpected ${method}`);
      statusReads++;
      return { data: { ...session.identity, chapters: [...cached].map(chapterIndex => ({
        chapterIndex, cachedBytes: body.length, state: 'completed',
      })) } };
    },
  };
  const coordinator = {
    hasForegroundReadingWork: () => foregroundBusy,
    observeForegroundReadingWork(listener) {
      foreground.add(listener);
      return () => foreground.delete(listener);
    },
    async currentSourceVersion() { return 'version'; },
    async request(method, params, requestOptions, priority) {
      const { chapterIndex } = params;
      assert.equal(method, 'chapter.content');
      assert.equal(priority, 'background');
      requests.push({ kind: 'deep', chapterIndex });
      guards.push(() => requestOptions.shouldCancel?.() === true);
      if (block !== undefined) await block.promise;
      if (requestOptions.shouldCancel?.()) throw new Error('cancelled');
      if (failures.has(chapterIndex)) throw new Error(failures.get(chapterIndex));
      cached.add(chapterIndex);
      return { data: { ...session.identity, chapterTitle: entries[chapterIndex].title, content: body, via: 'rule' } };
    },
  };
  class TestOfflineGateway extends ReadingOfflineGateway {
    async prefetchWindow(_session, startInclusive, endExclusive) {
      requests.push({ kind: 'high', startInclusive, endExclusive });
      for (let index = startInclusive; index < endExclusive; index++) cached.add(index);
      return { entries: [], failedChapters: 0 };
    }
  }
  const { ReadingPrefetchHost } = readingPrefetchOwnerProbe(() => runtime, {
    ReadingOfflineGateway: TestOfflineGateway,
    Date: { now: () => now },
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, at: now + delay });
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  const host = new ReadingPrefetchHost(runtime);
  const activity = (chapterIndex = 2, active = true, yieldToReading = false) => {
    const captured = navigation;
    host.observeReading(session, { chapterIndex, chapterOffset: 0, active, playing: false, yieldToReading }, {
      isCurrent: () => navigation === captured,
      displayedSession: () => displayed,
      directory: () => directory,
      projected: next => { directory = next; },
      refreshed: () => {},
      diagnostic: () => {},
      manualBusy: () => manualBusy,
    }, () => options.onShelf ?? true);
  };
  const flush = () => new Promise(setImmediate);
  const advance = async elapsed => {
    const target = now + elapsed;
    await flush();
    for (;;) {
      const due = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (due === undefined || due[1].at > target) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].callback();
      await flush();
    }
    now = target;
  };
  return {
    host, activity, advance, flush, requests, cached, failures, guards, statusReads: () => statusReads,
    setForegroundBusy(busy) { foregroundBusy = busy; foreground.forEach(listener => listener()); },
    setManualBusy(busy) { manualBusy = busy; activity(); },
    setNetworkAllowed(allowed) { networkAllowed = allowed; network.forEach(listener => listener()); },
    setStorageAllowed(allowed) { storageAllowed = allowed; },
    blockChapter() { block = deferred(); return block.resolve; },
    replaceCatalog() { displayed = { ...session, catalogVersion: 'successor' }; },
    replaceBook() { displayed = { ...session, identity: { ...session.identity, bookId: 'successor' } }; },
    replaceSource() { displayed = { ...session, identity: { ...session.identity, sourceId: 'successor' } }; },
    invalidateContent() { revision++; },
    exit() { navigation++; host.retireDeepReading(); },
    deep: () => requests.filter(request => request.kind === 'deep').map(request => request.chapterIndex),
  };
}

test('foreground and manual work preempt one serial chapter and the refill resumes behind high priority', async () => {
  const f = fixture();
  const release = f.blockChapter();
  f.activity();
  await f.advance(800);
  assert.deepEqual(f.requests.slice(0, 2), [
    { kind: 'high', startInclusive: 0, endExclusive: 5 },
    { kind: 'deep', chapterIndex: 5 },
  ]);
  f.setForegroundBusy(true);
  assert.equal(f.guards[0](), true);
  release();
  await f.advance(4_000);
  assert.deepEqual(f.deep(), [5]);
  f.setForegroundBusy(false);
  f.setManualBusy(true);
  await f.advance(2_000);
  assert.deepEqual(f.deep(), [5]);
  f.setManualBusy(false);
  await f.advance(799);
  assert.deepEqual(f.deep(), [5, 5]);
  await f.advance(8_001);
  assert.deepEqual(f.deep(), [5, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  await f.advance(800);
  const reads = f.statusReads();
  f.activity(3);
  await f.advance(800);
  assert.equal(f.statusReads(), reads, 'an adjacent turn above low water does not start a depth task');
});

test('nine continuous cached chapters start a refill after high priority, while ten do not', async () => {
  for (const count of [9, 10]) {
    const f = fixture({ cached: Array.from({ length: count }, (_, index) => index + 3) });
    f.activity();
    await f.advance(800);
    assert.deepEqual(f.deep(), count === 9 ? [12] : []);
  }
});

test('retired route, background, new book/source/catalog, content epoch and network cancel outstanding work', async () => {
  for (const retire of [
    f => f.exit(), f => f.activity(2, false), f => f.replaceBook(), f => f.replaceSource(),
    f => f.replaceCatalog(), f => f.invalidateContent(), f => f.setNetworkAllowed(false),
  ]) {
    const f = fixture();
    const release = f.blockChapter();
    f.activity();
    await f.advance(800);
    assert.deepEqual(f.deep(), [5]);
    retire(f);
    assert.equal(f.guards[0](), true);
    release();
    await f.advance(2_000);
    assert.deepEqual(f.deep(), [5]);
    assert.equal(f.cached.has(5), false);
  }
});

test('ineligible content, network and storage cannot start the depth window', async () => {
  for (const options of [
    { contentKind: 'manga' }, { sourceId: 'local' }, { networkAllowed: false }, { storageAllowed: false },
  ]) {
    const f = fixture(options);
    f.activity();
    await f.advance(10_000);
    assert.deepEqual(f.deep(), []);
  }
});

test('three successive chapter failures and any rate limit cool the source without retrying mid-window', async () => {
  const f = fixture();
  for (const index of [5, 6, 8]) f.failures.set(index, 'network timeout');
  f.activity();
  await f.advance(3 * 800);
  assert.deepEqual(f.deep(), [5, 6, 8]);
  await f.advance(599_999);
  assert.deepEqual(f.deep(), [5, 6, 8]);
  f.failures.clear();
  await f.advance(1);
  assert.deepEqual(f.deep(), [5, 6, 8, 5]);
  const throttled = fixture();
  throttled.failures.set(5, 'HTTP status 429');
  throttled.activity();
  await throttled.advance(10000);
  assert.deepEqual(throttled.deep(), [5]);
});
