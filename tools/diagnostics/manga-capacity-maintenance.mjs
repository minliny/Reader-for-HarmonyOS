import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';

// Manual diagnostic only: selection precedes all production reads and SDK loads.
const cases = ['capacity-maintenance', 'capacity-sdk'];
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === '--list')) {
  console.log(JSON.stringify({ kind: 'reader-manga-capacity-maintenance', status: 'NOT_RUN', cases }));
  process.exit(0);
}
if (args.length !== 2 || args[0] !== '--case' || !cases.includes(args[1])) {
  console.error(JSON.stringify({ kind: 'reader-manga-capacity-maintenance', status: 'FAIL_INVALID_CASE_SELECTION', cases }));
  process.exit(2);
}
const caseId = args[1];
const sourceRoot = new URL('../../entry/src/main/ets/', import.meta.url);
const diskUrl = new URL('platform/reading-resources/ReadingImageDiskCache.ts', sourceRoot);
const gatewayUrl = new URL('features/downloads/application/SharedDownloadStorageGateway.ts', sourceRoot);
const rawDisk = readFileSync(diskUrl, 'utf8');
const rawGateway = readFileSync(gatewayUrl, 'utf8');
const sha256 = source => createHash('sha256').update(source).digest('hex');
const sourceHashes = { disk: sha256(rawDisk), gateway: sha256(rawGateway) };
const observations = [];
let currentGroup;
async function group(name, run) {
  currentGroup = name;
  let timer;
  try {
    await Promise.race([run(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('actual production policy/book lane did not settle')), 2500);
    })]);
    observations.push({ group: name, status: 'PASS' });
  } finally { clearTimeout(timer); }
}

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
const key = chapter => JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterId, chapter.contentVersion]);
const chapter = id => ({ sourceId: 'SOURCE_FIXTURE', bookId: 'BOOK_FIXTURE', chapterId: 'chapter:' + id, contentVersion: 'VERSION_FIXTURE' });
const stripped = source => stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
let serial = 0;
function fixture({ source = rawDisk, free = 8 * GiB, total, limit = 128 * MiB } = {}) {
  const prefix = '/VIRTUAL_CAPACITY_ONLY/' + ++serial;
  const nodes = new Map(), classes = new Map(), owners = new Map(), policies = new Map(), pending = new Map();
  const attempts = [], claims = [], completed = [], unlinked = [], derivedRemoved = [], runtimeCalls = [];
  const state = { free, total, beforeClaim: async () => {}, beforeCapacityRead: async () => {} };
  // Synthetic file inventory/I/O ports only. No fs/SQLite/HTTP/device operation.
  const io = {
    access: async path => nodes.has(path),
    unlink: async path => {
      const file = nodes.get(path); assert.ok(file, 'unlink owns an existing synthetic path');
      nodes.delete(path); state.free += file.size; unlinked.push(path);
    },
  };
  // Digest cache is unused by these methods except removal after unlink.
  const util = { LRUCache: class { remove() {} clear() {} },
    TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } } };
  const crypto = { createMd: () => {
    const digest = createHash('sha256');
    return { update: async ({ data }) => { digest.update(data); }, digest: async () => ({ data: digest.digest() }) };
  } };
  class MaterializationError extends Error { constructor(kind, message) { super(message); this.kind = kind; } }
  const Cache = new Function('fileIo', 'statfs', 'cryptoFramework', 'util', 'canonicalReadingImageBaseUrl',
    'assertReadingOfflineWriteCapacity', 'ReadingOfflineMaterializationError', 'readMangaAtomicPayload',
    stripped(source) + '\nreturn ReadingImageDiskCache;')(
    io, {}, crypto, util, () => assert.fail('unused locator port'), () => assert.fail('unused text-write port'),
    MaterializationError, () => assert.fail('unused AtomicFile worker port'));
  const cache = new Cache({ filesDir: prefix }, {
    getFreeBytes: async () => { await state.beforeCapacityRead(); return state.free; },
    ...(total === undefined ? {} : { getTotalBytes: async () => state.total }),
  });
  cache.configuredCacheLimitBytes = limit;
  // Inventory is the sole substituted production method. All budget/classify,
  // policy/book lanes, exact-grant removal and reservations remain actual.
  cache.mangaInventory = async () => [...nodes.values()].map(file => ({ ...file, owners: file.owners.map(owner => ({ ...owner })) }));
  const authority = {
    async classify(c) { return classes.get(key(c)) ?? 'unknown'; },
    async classifyBatch(chapters) { return Promise.all(chapters.map(c => this.classify(c))); },
    async policy(c) { return { status: await this.classify(c), inUse: false, lastReadAt: Math.floor(Date.now() / 1000) - 30, ...policies.get(key(c)) }; },
    async policyBatch(chapters) { return Promise.all(chapters.map(c => this.policy(c))); },
    async candidates(reason, scope) {
      return [...owners.values()].filter(c => !scope || (c.sourceId === scope.sourceId && c.bookId === scope.bookId));
    },
    async claim(c, expiry) {
      attempts.push({ ...c, expiry }); await state.beforeClaim(c, expiry);
      const policy = await this.policy(c);
      if (policy.status !== 'cache' || policy.inUse || (expiry && policy.lastReadAt !== null &&
        policy.lastReadAt >= expiry.nowSeconds - expiry.ttlSeconds)) return undefined;
      const grant = { ...c, grantToken: 'grant:' + (claims.length + 1) };
      claims.push(grant); pending.set(grant.grantToken, grant); return grant;
    },
    async complete(grant, removed) {
      completed.push({ grant, removed });
      if (removed) { pending.delete(grant.grantToken); classes.set(key(grant), 'missing'); }
    },
    async pending() { return [...pending.values()]; },
  };
  cache.setMangaStorageAuthority(authority);
  cache.setMangaExternalStorage({
    inventory: async () => [...nodes.values()].filter(file => file.external),
    remove: async (grant, files) => {
      for (const file of files) await io.unlink(file.path);
      return true;
    },
    removeDerived: async (c, files, current) => {
      if (!(await current())) return false;
      derivedRemoved.push(c.chapterId);
      for (const file of files) { if (!(await current())) return false; await io.unlink(file.path); }
      return true;
    },
  });
  const zero = { totalBytes: 0, retainedBytes: 0, automaticBytes: 0, cleanableBytes: 0,
    protectedChapters: [], removedChapters: [], hasMore: false, removedContentBytes: 0,
    completedQueueChapters: [], completedQueueHasMore: false };
  class CoreRequestError extends Error {}
  const Storage = new Function('SharedDownloadIntentPreferences', 'ReaderCoreRequestError', 'isReaderCoreTransactionPendingError',
    stripped(rawGateway) + '\nreturn SharedDownloadStorageGateway;')(
    class { constructor() { assert.fail('fixture supplies explicit persistence'); } }, CoreRequestError, () => false);
  const storage = new Storage({
    captureDownloadStorageValidity: () => () => true,
    readDownloadStorageBindings: async () => ({ retainedChapters: [], protectedChapters: [] }),
    request: async (method, params) => {
      assert.ok(['cache.storage.summary', 'cache.storage.cleanup'].includes(method), 'only expected synthetic text metadata request');
      runtimeCalls.push({ method, reason: params?.reason }); return { data: { ...zero } };
    },
  }, cache, { loadLegacyProtection: async () => [], saveLegacyProtection: async () => {} });
  function register(id, classification = 'cache', policy = {}) {
    const c = chapter(id); owners.set(key(c), c); classes.set(key(c), classification); policies.set(key(c), policy); return c;
  }
  function add(id, size, classification = 'cache', { external = false, live = false, policy = {} } = {}) {
    const c = register(id, classification, policy);
    const path = prefix + '/' + id + (external ? '.display' : '.original');
    nodes.set(path, { path, size, owners: [c], physicalKey: 'virtual-inode:' + path, external, live }); return c;
  }
  const exists = c => [...nodes.values()].some(file => file.owners.some(owner => key(owner) === key(c)));
  const receipt = () => ({ attempts: attempts.map(c => c.chapterId), claims: claims.map(c => c.chapterId),
    unlinked: unlinked.length, derivedRemoved: derivedRemoved.slice(), pending: pending.size });
  return { cache, storage, authority, state, nodes, classes, policies, pending, attempts, claims, completed,
    derivedRemoved, runtimeCalls, add, register, exists, receipt };
}

async function underBudget(source = rawDisk) {
  const f = fixture({ source }); const first = f.add('recent-a', 2 * MiB), second = f.add('recent-b', 2 * MiB);
  await f.storage.maintainAutomaticStorage();
  assert.deepEqual(f.attempts, [], 'ordinary startup capacity must not request a grant while budget and free space suffice');
  assert.ok(f.exists(first) && f.exists(second), 'fresh readable ordinary cache survives startup');
  assert.deepEqual(f.runtimeCalls.filter(c => c.method === 'cache.storage.cleanup').map(c => c.reason), ['expiry', 'capacity']);
  return f.receipt();
}
async function pressureStop(source = rawDisk) {
  const f = fixture({ source }); const first = f.add('ordered-a', 64 * MiB), second = f.add('ordered-b', 64 * MiB), third = f.add('ordered-c', 64 * MiB);
  await f.cache.maintainMangaStorage('capacity');
  assert.deepEqual(f.claims.map(c => c.chapterId), [first.chapterId], 'capacity stops once actual remaining ordinary bytes fit the existing 128MiB budget');
  assert.ok(!f.exists(first) && f.exists(second) && f.exists(third));
  return f.receipt();
}

async function behaviorCase() {
  await group('normal-startup-recent-under-budget', () => underBudget());
  await group('direct-capacity-no-enough-under-budget', async () => {
    const f = fixture(); const c = f.add('direct-recent', 4 * MiB);
    await f.cache.maintainMangaStorage('capacity'); assert.deepEqual(f.attempts, []); assert.ok(f.exists(c));
  });
  await group('pressure-only-ordered-stop', () => pressureStop());
  await group('low-space-stop', async () => {
    const f = fixture({ free: 511 * MiB }); const a = f.add('space-a', MiB), b = f.add('space-b', MiB);
    await f.cache.maintainMangaStorage('capacity');
    assert.deepEqual(f.claims.map(c => c.chapterId), [a.chapterId]); assert.ok(!f.exists(a) && f.exists(b));
    assert.equal(f.state.free, 512 * MiB);
  });
  await group('current-reservations-in-maintenance-pressure', async () => {
    const f = fixture(); const a = f.add('reserved-a', 32 * MiB); f.add('reserved-b', 32 * MiB);
    const writing = f.register('active-write');
    const lease = await f.cache.reserveExternalWrite(writing, 40 * MiB);
    const c = f.add('reserved-c', 32 * MiB);
    try {
      await f.cache.maintainMangaStorage('capacity');
      assert.deepEqual(f.claims.map(row => row.chapterId), [a.chapterId]); assert.ok(f.exists(c));
      assert.equal(f.cache.mangaOrdinaryReservedBytes, 40 * MiB);
    } finally { lease.release(); }
    assert.equal(f.cache.mangaReservedBytes, 0);
  });
  await group('request-specific-enough-preserved', async () => {
    const f = fixture(); const a = f.add('request-a', 32 * MiB); f.add('request-b', 32 * MiB); f.add('request-c', 32 * MiB);
    const writing = f.register('request-owner');
    const lease = await f.cache.reserveExternalWrite(writing, 1 * MiB, 'background');
    assert.deepEqual(f.claims.map(c => c.chapterId), [a.chapterId], 'caller bytes and 32MiB background headroom must remain in its supplied predicate');
    lease.release(); assert.equal(f.cache.mangaReservedBytes, 0);
  });
  await group('all-reservations-count-toward-physical-reserve', async () => {
    const f = fixture({ free: 540 * MiB }); const a = f.add('reserve-space-a', 16 * MiB), b = f.add('reserve-space-b', 16 * MiB);
    const writing = f.register('download-write', 'download');
    const lease = await f.cache.reserveExternalWrite(writing, 20 * MiB);
    f.state.free = 525 * MiB;
    try {
      await f.cache.maintainMangaStorage('capacity');
      assert.deepEqual(f.claims.map(c => c.chapterId), [a.chapterId]); assert.ok(f.exists(b));
      assert.equal(f.cache.mangaOrdinaryReservedBytes, 0, 'permanent write is outside ordinary quota');
      assert.equal(f.cache.mangaReservedBytes, 20 * MiB, 'permanent write still reserves actual physical space');
    } finally { lease.release(); }
  });
  await group('derived-cache-pressure-preserves-download-original', async () => {
    const f = fixture(); const original = f.add('permanent', 64 * MiB, 'download');
    const a = f.add('derived-a', 48 * MiB, 'download', { external: true });
    const b = f.add('derived-b', 48 * MiB, 'download', { external: true });
    const c = f.add('derived-c', 48 * MiB, 'download', { external: true });
    await f.cache.maintainMangaStorage('capacity');
    assert.deepEqual(f.claims, []); assert.deepEqual(f.derivedRemoved, [a.chapterId]);
    assert.ok(f.exists(original) && !f.exists(a) && f.exists(b) && f.exists(c));
  });
  await group('derived-partition-alone-does-not-authorize-automatic-original-eviction', async () => {
    const f = fixture({ total: 512 * MiB, free: 256 * MiB });
    const original = f.add('partition-original', 10 * MiB);
    const display = f.add('partition-display', 100 * MiB, 'download', { external: true });
    const capacity = await f.cache.mangaStorageCapacity();
    assert.ok(100 * MiB > capacity.derivedBudgetBytes, 'derived-only write partition is over its limit');
    assert.ok(110 * MiB < capacity.cacheBudgetBytes, 'public automatic total budget still has room');
    await f.cache.maintainMangaStorage('capacity');
    assert.deepEqual(f.attempts, []); assert.deepEqual(f.derivedRemoved, []);
    assert.ok(f.exists(original) && f.exists(display));
  });
  await group('ownership-and-session-protection', async () => {
    const f = fixture({ free: 511 * MiB }); const kept = [];
    for (const [name, classification] of [['download', 'download'], ['session', 'protected'], ['paused', 'protected'], ['live-lease', 'protected'], ['unknown', 'unknown'], ['missing', 'missing']])
      kept.push(f.add(name, MiB, classification));
    const pinned = f.add('host-pin', MiB); kept.push(pinned); const release = f.cache.pinMangaChapter(pinned);
    const removable = f.add('ordinary', 2 * MiB);
    try { await f.cache.maintainMangaStorage('capacity'); }
    finally { release(); }
    assert.deepEqual(f.attempts.map(c => c.chapterId), [removable.chapterId]);
    assert.ok(kept.every(f.exists)); assert.ok(!f.exists(removable));
  });
  await group('late-core-denial-remains-authoritative', async () => {
    const f = fixture({ free: 511 * MiB }); const c = f.add('late-retention', 2 * MiB);
    f.state.beforeClaim = async candidate => f.classes.set(key(candidate), 'download');
    await f.cache.maintainMangaStorage('capacity'); assert.equal(f.attempts.length, 1);
    assert.deepEqual(f.claims, []); assert.ok(f.exists(c));
  });
  await group('explicit-clear-still-clears-under-budget', async () => {
    const f = fixture(); const a = f.add('clear-a', 2 * MiB), b = f.add('clear-b', 2 * MiB), keep = f.add('clear-download', MiB, 'download');
    await f.cache.maintainMangaStorage('clear');
    assert.deepEqual(f.claims.map(c => c.chapterId), [a.chapterId, b.chapterId]); assert.ok(f.exists(keep));
  });
  await group('expiry-still-uses-read-clock-not-capacity', async () => {
    const f = fixture(); const recent = f.add('fresh', MiB);
    const old = f.add('old', MiB, 'cache', { policy: { lastReadAt: 1 } });
    const unread = f.add('unread', MiB, 'cache', { policy: { lastReadAt: null } });
    await f.cache.maintainMangaStorage('expiry');
    assert.deepEqual(f.claims.map(c => c.chapterId), [old.chapterId, unread.chapterId]); assert.ok(f.exists(recent));
    assert.ok(f.attempts.every(c => c.expiry?.ttlSeconds === 7 * 86400));
  });
  await group('pending-grant-handoff-precedes-no-pressure-return', async () => {
    const f = fixture(); const old = f.add('pending', 2 * MiB, 'missing'), fresh = f.add('after-pending', 2 * MiB);
    const grant = { ...old, grantToken: 'previous-exact-grant' }; f.pending.set(grant.grantToken, grant);
    await f.cache.maintainMangaStorage('capacity');
    assert.deepEqual(f.attempts, []); assert.ok(!f.exists(old) && f.exists(fresh));
    assert.equal(f.pending.size, 0); assert.equal(f.completed[0].removed, true);
  });
  await group('capacity-probe-fails-closed-before-new-claim', async () => {
    const f = fixture(); const c = f.add('probe-error', MiB);
    f.state.beforeCapacityRead = async () => { throw Error('controlled capacity observation failure'); };
    await assert.rejects(f.cache.maintainMangaStorage('capacity'), /controlled capacity observation failure/);
    assert.deepEqual(f.attempts, []); assert.ok(f.exists(c));
  });
  // Exact production-source controls. No disk source is changed by a mutant.
  await group('original-unconditional-drain-mutant-rejected', async () => {
    const marker = 'const hasCapacity = enough ?? (reason === \'capacity\' ?\n      (): Promise<boolean> => this.mangaMaintenanceHasCapacity() : undefined);';
    assert.equal(rawDisk.split(marker).length, 2, 'one actual capacity fallback definition');
    const mutant = rawDisk.replace(marker, 'const hasCapacity = enough;');
    await assert.rejects(underBudget(mutant), /ordinary startup capacity must not request a grant/);
  });
  await group('no-eviction-under-pressure-mutant-rejected', async () => {
    const marker = '(): Promise<boolean> => this.mangaMaintenanceHasCapacity()';
    assert.equal(rawDisk.split(marker).length, 2, 'one production pressure callback');
    const mutant = rawDisk.replace(marker, 'async (): Promise<boolean> => true');
    await assert.rejects(pressureStop(mutant), /capacity stops once actual remaining ordinary bytes fit/);
  });
}

async function sdkCase() {
  const { installedEtsCompiler } = await import('../lib/ets-compiler-runtime.mjs');
  const { resolveArkFrontend, localFilePath } = await import('../lib/tool-environment.mjs');
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { ts, options } = installedEtsCompiler();
  await group('installed-sdk-actual-disk-parse-and-emit', async () => {
    const tree = ts.createSourceFile(localFilePath(diskUrl), rawDisk, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const emitted = ts.transpileModule(rawDisk, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ESNext },
      reportDiagnostics: true, fileName: localFilePath(diskUrl) });
    assert.deepEqual(emitted.diagnostics, []);
  });
  await group('installed-ark-frontend-actual-disk-and-invalid-control', async () => {
    const frontend = resolveArkFrontend();
    const run = file => spawnSync(frontend, ['--target-api-version', '23', '--module', '--parse-only', file], { encoding: 'utf8' });
    const actual = run(localFilePath(diskUrl)); assert.equal(actual.status, 0, actual.stderr || actual.stdout || String(actual.error));
    const temp = mkdtempSync(join(tmpdir(), 'reader-capacity-sdk-'));
    try {
      const invalid = join(temp, 'invalid.ts'); writeFileSync(invalid, 'export const invalid = (;\n');
      assert.notEqual(run(invalid).status, 0, 'official frontend rejects invalid syntax');
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
}

try {
  if (caseId === 'capacity-maintenance') await behaviorCase();
  else await sdkCase();
  console.log(JSON.stringify({ kind: 'reader-manga-capacity-maintenance', case: caseId, status: 'PASS', sourceHashes,
    groups: observations.length, observations, scope: caseId === 'capacity-maintenance' ?
      'actual Host methods with virtual inventory/metadata ports; no application-file IO, Core/SQL/HAP/device or historical-owner claim' :
      'installed SDK parse/emit and frontend subprocess with disposable invalid-source fixture; no application-file IO, Core/SQL/HAP/device or historical-owner claim' }));
} catch (error) {
  console.error(JSON.stringify({ kind: 'reader-manga-capacity-maintenance', case: caseId, status: 'FAIL', sourceHashes,
    groups: observations.length, observations, failedGroup: currentGroup, error: error.message, stack: error.stack }));
  process.exitCode = 1;
}
