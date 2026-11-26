import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'manga-graphics': 'Native codec and cleanup failures retain their original owner and free the transform admission lane',
  'local-epub-access': 'A missing canonical archive admits its retained legacy EPUB and permission errors remain visible',
  'share-cache': 'A concurrently evicted copy does not block eviction of other expired share copies',
  'native-text-teardown': 'An invalid native paragraph retires both nodes without masking the operation or blocking later cleanup',
  'capture-listener-teardown': 'Screen capture detaches each owned listener even when setup and native release fail',
  'bundled-ledger-read': 'Transient ledger I/O rejects rather than losing persisted source authority',
  'arkweb-cleanup-precedence': 'Browser teardown preserves the original error and still fences the next job',
  'public-book-cleanup-precedence': 'The isolated fixture retains import failure even when cleanup races with eviction',
  'manga-chapter-cancel': 'Candidate teardown failure still releases its Core lease and admits a new chapter intention',
  'core-copy-optional-paths': 'A missing scratch entry permits creation while operational IO failure remains a probe error',
};

const absent = () => Object.assign(new Error('disappeared'), { code: 13900002 });

function load(path, name, dependencies) {
  const file = new URL(`../entry/src/main/ets/${path}`, import.meta.url);
  const source = readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies),
    stripTypeScriptTypes(source) + `\nreturn ${name};`)(...Object.values(dependencies));
}

async function mangaGraphics() {
  const decodeFailure = Error('frame reader failed');
  const packingFailure = Error('encoder failed');
  const releaseFailure = Error('native release failed');
  const releases = [];
  const info = { mimeType: 'image/png', size: { width: 8, height: 8 }, pixelFormat: 3 };
  let failAt = 'frames';
  let failRelease = 'source';
  const resource = name => ({
    async release() {
      releases.push(name);
      if (failRelease === name) throw releaseFailure;
    },
  });
  const source = {
    ...resource('source'),
    async getImageInfo() { return info; },
    async getFrameCount() { if (failAt === 'frames') throw decodeFailure; return 1; },
    async createPixelMap() {
      return { ...resource('input'), async getImageInfo() { return info; }, getBytesNumberPerRow: () => 32,
        getPixelBytesNumber: () => 256, async readPixels() {} };
    },
  };
  const image = {
    PixelMapFormat: { RGBA_8888: 3, BGRA_8888: 4, RGB_565: 2 },
    DecodingDynamicRange: { SDR: 1 },
    createImageSource: () => source,
    async createPixelMap() {
      return { ...resource('output'), async getImageInfo() { return { ...info, pixelFormat: 2 }; },
        getBytesNumberPerRow: () => 16, getPixelBytesNumber: () => 128 };
    },
    createImagePacker: () => ({ ...resource('packer'), async packToData() {
      if (failAt === 'pack') throw packingFailure;
      return new Uint8Array([1]).buffer;
    } }),
  };
  const validators = await import('../entry/src/main/ets/platform/reading-resources/MangaImageGraphicsPlan.ts');
  const Host = load('platform/reading-resources/MangaImageGraphicsHost.ts', 'MangaImageGraphicsHost', {
    image, validateMangaGraphicsDimensions: validators.validateMangaGraphicsDimensions,
    validateMangaGraphicsPlan: validators.validateMangaGraphicsPlan,
  });
  const host = new Host();
  const events = [];
  host.attachDiagnosticObserver(event => events.push(event), true, 'debug');
  const bytes = new Uint8Array([1, 2, 3]);
  const plan = { __readerMangaGraphicsPlan: true, width: 8, height: 8, format: 'jpeg', quality: 90,
    pixelFormat: 'rgb565', strips: [{ sourceY: 0, targetY: 0, height: 8 }] };
  await assert.rejects(host.inspect(bytes, () => true), error => error === decodeFailure);
  assert.deepEqual(releases.splice(0), ['source']);
  assert.ok(events.some(event => event.event === 'release-error' && event.resource === 'source'));
  failAt = 'pack';
  failRelease = 'packer';
  await assert.rejects(host.transform(bytes, plan, () => true), error => error === packingFailure);
  assert.deepEqual(releases.splice(0), ['input', 'source', 'packer', 'output']);
  assert.equal(host.diagnosticPending(true, 'debug'), 0);
  failAt = '';
  await assert.rejects(host.transform(bytes, plan, () => true), error => error === releaseFailure);
  failRelease = '';
  assert.deepEqual(await host.transform(bytes, plan, () => true), new Uint8Array([1]));
}

async function localEpubAccess() {
  const hash = 'a'.repeat(64);
  const encoded = value => Buffer.from(value).toString('base64url');
  const locator = `reader-local-epub://${encoded('local:' + hash)}/${encoded('images/cover.png')}`;
  const canonical = `/sandbox/reader-import/books/${hash}.source`;
  const legacy = `/sandbox/reader-import/books/${hash}.epub`;
  const attempts = [];
  let files = new Map([[canonical, absent()], [legacy, true]]);
  const permission = Object.assign(new Error('permission denied'), { code: 13900012 });
  const Host = load('platform/reading-resources/LocalEpubResourceHost.ts', 'LocalEpubResourceHost', {
    readerHostFilesDirectory: path => path,
    fileIo: { async access(path) {
      attempts.push(path);
      const entry = files.get(path);
      if (entry instanceof Error) throw entry;
      return entry;
    } },
    util: { TextDecoder: { create: () => ({ decodeToString: value => value.toString('utf8') }) },
      Base64Helper: class { decodeSync(value) { return Buffer.from(value, 'base64url'); } }, Type: {} },
    ReadingBodyImageHost: { instance: { loadResource: (_name, read, current) => read(current) } },
    async readLocalEpubEntryAsync(path, member, limit) {
      assert.equal(member, 'images/cover.png');
      assert.equal(limit, 16 * 1024 * 1024);
      return path;
    },
  });
  const host = new Host({ filesDir: '/sandbox' });
  assert.equal(await host.load(locator, () => true), legacy);
  assert.deepEqual(attempts.splice(0), [canonical, legacy]);
  files = new Map([[canonical, permission], [legacy, true]]);
  await assert.rejects(host.load(locator, () => true), error => error === permission);
  assert.deepEqual(attempts.splice(0), [canonical]);
  files = new Map([[canonical, true], [legacy, true]]);
  assert.equal(await host.load(locator, () => true), canonical);
  assert.deepEqual(attempts, [canonical]);
}

async function shareCache() {
  const hash = 'a'.repeat(64);
  const cache = '/cache/reader-share';
  const old = `${cache}/book-000002`;
  const fresh = `${cache}/book-000003`;
  const copied = [];
  const removed = [];
  const listeners = new Map();
  let cacheCreated = false;
  const now = Date.now() / 1000;
  const stat = { isDirectory: () => true, isFile: () => true };
  const Host = load('platform/share/ReaderSystemShareHost.ts', 'ReaderSystemShareHost', {
    canIUse: () => true, url: {},
    fileIo: { async access(path) {
      assert.equal(path, cache);
      throw absent();
    }, async mkdir(path, recursive) {
      assert.equal(path, cache);
      assert.equal(recursive, true);
      cacheCreated = true;
    }, listFile: async () => ['book-000001', 'book-000002', 'book-000003'],
      async lstat(path) {
        if (path === `${cache}/book-000001`) throw absent();
        return { ...stat, mtime: path === old ? now - 90000 : now };
      },
      mkdtemp: async () => `${cache}/book-000004`,
      copyFile: async (from, to) => { copied.push([from, to]); },
      rmdir: async path => { removed.push(path); } },
    fileUri: { getUriFromPath: path => path },
    uniformTypeDescriptor: { getUniformDataTypeByFilenameExtension: () => 'fixture.txt', UniformDataType: {} },
    systemShare: { SelectionMode: { SINGLE: 1 }, SharedData: class {}, ShareController: class {
      on(event, listener) { listeners.set(event, listener); }
      off(event) { listeners.delete(event); }
      async show() { listeners.get('shareCompleted')({}); }
    } },
  });
  const host = new Host(() => ({ filesDir: '/sandbox', getApplicationContext: () => ({ cacheDir: '/cache' }) }));
  const original = `/sandbox/reader-import/books/${hash}.source`;
  const result = await host.show({ kind: 'file', hash, path: original, title: 'fixture', extension: '.txt' }, () => true);
  assert.equal(result, 'shown');
  assert.equal(cacheCreated, true);
  assert.deepEqual(removed, [old]);
  assert.ok(!removed.includes(fresh));
  assert.deepEqual(copied, [[original, `${cache}/book-000004/fixture.txt`]]);
  assert.equal(listeners.size, 0);
}

function nativeTextTeardown() {
  const layoutFailure = Error('layout unavailable');
  const nativeFailure = Error('retired native node');
  const calls = [];
  const warnings = [];
  const Host = load('features/reading/ui/ReaderNativeTextWindow.ets', 'ReaderNativeTextWindow', {
    readerNativeTextNodeGeometry: () => undefined, readerNativeTextNodeContent: () => undefined,
    hilog: { warn(_domain, _tag, summary) { warnings.push(summary); } },
    FrameNode: class {
      commonAttribute = { width() { return this; }, clip() { return this; } };
      appendChild() { calls.push('append'); }
      removeChild() { calls.push('remove'); throw nativeFailure; }
      dispose() { calls.push('root'); throw nativeFailure; }
    },
  });
  const context = { vp2px: value => value, fp2px: value => value };
  const node = { dispose() { calls.push('node'); throw nativeFailure; } };
  const controller = { getLayoutManager() { return { getLineCount: () => 1, getLineMetrics: () => ({}) }; } };
  assert.throws(() => new Host(context, node, { getLayoutManager() { throw layoutFailure; } }, 30), error => error === layoutFailure);
  assert.deepEqual(calls.splice(0), ['node', 'root']);
  const window = new Host(context, node, controller, 30);
  window.close();
  window.close();
  assert.deepEqual(calls, ['append', 'remove', 'node', 'root']);
  assert.equal(warnings.length, 5);
}

const tick = () => new Promise(resolve => setImmediate(resolve));

async function captureListenerTeardown() {
  const listeners = new Map();
  const logs = [];
  const events = [];
  let allowed = true;
  let shouldFail = true;
  const recorder = {
    on(event, listener) { listeners.set(event, listener); events.push(`on:${event}`); },
    off(event, listener) {
      assert.equal(listener, listeners.get(event));
      listeners.delete(event);
      events.push(`off:${event}`);
    },
    async init() { if (shouldFail) throw Error('media initialization failed'); },
    async release() { events.push('release'); if (shouldFail) throw Error('media release failed'); },
    async setMicEnabled() {}, async startRecording() {},
  };
  const timers = new Set();
  const Host = load('app/diagnostics/ReaderFrameworkCapture.ts', 'ReaderFrameworkCapture', {
    media: { async createAVScreenCaptureRecorder() { events.push('create'); return recorder; } },
    fileIo: { accessSync: () => false, openSync: () => ({ fd: 3 }), closeSync() { events.push('close'); }, OpenMode: {} },
    hilog: { info(_domain, _tag, _format, input) { logs.push(JSON.parse(input)); } },
    canIUse: () => allowed,
    setTimeout(callback) { const handle = { callback }; timers.add(handle); return handle; },
    clearTimeout(handle) { timers.delete(handle); },
  });
  const capture = new Host();
  capture.start(true, 'debug', 2, '/fixture');
  await tick();
  assert.deepEqual(events, ['create', 'on:error', 'on:stateChange', 'off:error', 'off:stateChange', 'release', 'close']);
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  assert.ok(logs.some(row => row.event === 'prepare-failed'));
  assert.ok(logs.some(row => row.event === 'release-failed'));
  allowed = false;
  events.length = 0;
  capture.start(true, 'debug', 2, '/fixture');
  await tick();
  assert.deepEqual(events, []);
  assert.equal(timers.size, 0);
  allowed = true;
  shouldFail = false;
  capture.start(true, 'debug', 2, '/fixture');
  await tick();
  capture.close();
  await tick();
  assert.deepEqual(events, ['create', 'on:error', 'on:stateChange', 'off:error', 'off:stateChange', 'release', 'close']);
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
}

async function bundledLedgerRead() {
  // Node's strip-only loader cannot emit TS parameter properties. Use the SDK
  // reader on this actual class before supplying the filesystem seam.
  const path = 'app/BundledBookSourceSupply.ts';
  const contents = readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const ioFailure = Object.assign(new Error('transient IO'), { code: 13900005 });
  const context = { filesDir: '/fixture' };
  const encoded = JSON.stringify({ schemaVersion: 1,
    installed: [{ builtinId: 'book', sourceId: 'https://book.invalid' }] });
  let data = ioFailure;
  const fileIo = { async access() { return true; }, OpenMode: {}, async open() { throw data; },
    async readText() { if (data instanceof Error) throw data; return data; } };
  const { BundledSourceLedger } = pureModuleProbe(contents, 'BundledBookSourceSupply.ts',
    { fileIo, hilog: { error() {} }, errorMessageOf: error => error.message }, ['BundledSourceLedger']);
  await assert.rejects(BundledSourceLedger.load(context), error => error === ioFailure);
  data = encoded;
  assert.deepEqual((await BundledSourceLedger.load(context)).persistedSourceIds(), ['https://book.invalid']);
  data = absent();
  assert.deepEqual((await BundledSourceLedger.load(context)).persistedSourceIds(), []);
}

async function arkWebCleanupPrecedence() {
  const nativeFailure = Error('cannot load native URL');
  const cleanupFailure = Error('cannot clear native cookies');
  let clearCalls = 0;
  let failLoad = true;
  let failCleanup = true;
  let executor;
  const Http = await import('../entry/src/main/ets/platform/network/HttpTransportPolicy.ts');
  const stops = [];
  const webview = {
    ProxyController: { removeProxyOverride(acknowledge) { acknowledge(); } },
    WebCookieManager: {
      clearAllCookiesSync() {
        clearCalls++;
        if (failCleanup && clearCalls % 2 === 0) throw cleanupFailure;
      },
    },
    WebviewController: class {
      stop() { stops.push(this); }
      loadUrl(address) {
        if (failLoad) throw nativeFailure;
        this.address = address;
        executor.active.pageReadyAt = Date.now() - 1;
      }
      getUrl() { return this.address; }
      getTitle() { return 'ordinary fixture'; }
      async runJavaScript() { return '"ordinary fixture"'; }
    },
  };
  const Executor = load('platform/network/ArkWebExecutor.ts', 'ArkWebExecutor', {
    webview, ...Http, prepareNetworkTarget: async () => ({ route: 'systemProxy' }),
  });
  executor = new Executor();
  let mounted;
  executor.attachSurfaceHost(surface => {
    if (surface === undefined && mounted !== undefined) executor.detachController(mounted);
    mounted = surface;
    if (surface !== undefined) executor.attachController(surface);
  });
  const run = id => executor.execute({
    document: { kind: 'url', url: 'https://source.invalid/book' }, javaScript: 'document.title', timeoutMillis: 1000,
  }, id);
  await assert.rejects(run(1), error => error === nativeFailure);
  assert.equal(mounted, undefined);
  failLoad = false;
  await assert.rejects(run(2), error => error === cleanupFailure);
  failCleanup = false;
  assert.equal((await run(3)).value, 'ordinary fixture');
  assert.equal(clearCalls, 6);
  assert.equal(stops.length, 3);
}

async function publicBookCleanupPrecedence() {
  const operation = Error('fixture staging write denied');
  const closeFailure = Error('fixture descriptor already closed');
  const warnings = [];
  const closed = [];
  const removed = [];
  const root = '/fixture/empty-sources';
  const dir = `${root}/long-book-input-fixed`;
  const context = {
    filesDir: '/fixture',
    resourceManager: { async getRawFileContent(name) {
      return new Uint8Array(readFileSync(new URL(`../entry/src/main/resources/rawfile/${name}`, import.meta.url)));
    } },
  };
  const prepare = load('app/diagnostics/ReaderPublicLongBook.ts', 'prepareReaderPublicLongBook', {
    fileIo: {
      lstat: async () => ({ isDirectory: () => true }), mkdir: async path => assert.equal(path, dir),
      open: async () => ({ fd: 7 }), write: async () => { throw operation; },
      close: async file => { closed.push(file.fd); throw closeFailure; },
      unlink: async () => { throw absent(); }, listFile: async () => [],
      rmdir: async path => { removed.push(path); throw absent(); }, OpenMode: {},
    },
    buildReaderPublicFixtureDirectory: () => root,
    SourceGateway: class { async loadSources() { return []; } },
    ReaderCoreGateway: class { async loadBookshelf() { return { total: 0, books: [] }; } },
    cryptoFramework: { createMd() {
      const hash = createHash('sha256');
      return { async update({ data }) { hash.update(data); }, async digest() { return { data: hash.digest() }; } };
    } },
    util: { generateRandomUUID: () => 'fixed' },
    hilog: { warn(_domain, _tag, summary) { warnings.push(summary); } },
  });
  const owner = { isCurrentPublicFixture: () => true, getUIAbilityContext: () => context,
    async retainedLocalBookSourcePath() { return undefined; } };
  await assert.rejects(prepare(owner, { kind: 'fixture', id: 'empty-sources' }), error => error === operation);
  assert.deepEqual(closed, [7]);
  assert.deepEqual(removed, [dir]);
  assert.equal(warnings.length, 1);
}

async function mangaChapterCancel() {
  const closeFailure = Error('display resource already detached');
  const prepareFailure = Error('candidate decode failed');
  const events = [];
  let failClose = true;
  let failPrepare = false;
  const manifest = { chapter: { bookId: 'a', sourceId: 'b', chapterId: '/1' },
    manifestVersion: 'v1', sourceRuleVersion: 'one', decodeRevision: 'one' };
  const origin = { chapter: { chapterIndex: 1, manifest }, async awaitPendingProgress() {} };
  const target = { chapterIndex: 2, manifest: { ...manifest, chapter: { ...manifest.chapter, chapterId: '/2' } } };
  const Host = load('features/manga/application/MangaChapterTransitionCoordinator.ts', 'MangaChapterTransitionCoordinator', {
    hilog: { warn() {} },
    MangaSessionGateway: class {
      async entry() { return { chapter: target }; }
      async prepareMaterialization() { return 'receipt'; }
      async abortMaterialization(receipt) { events.push(receipt); }
    },
    MangaSessionController: class {
      savedLocation = { pageId: 'one' };
      displayedOrdinal = 0;
      pageGeometry() { return { height: 10, tileHeight: 1 }; }
      async openCandidate() { if (failPrepare) throw prepareFailure; }
      async close() { if (failClose) throw closeFailure; }
    },
  });
  const owner = new Host({});
  const request = { currentController: origin, chapterIndex: 2, chapterUrl: '/2', landing: 'first', isCurrent: () => true };
  const candidate = await owner.prepare(request);
  await assert.rejects(candidate.cancel(), error => error === closeFailure);
  assert.deepEqual(events, ['receipt']);
  assert.equal(owner.pending, false);
  failPrepare = true;
  await assert.rejects(owner.prepare(request), error => error === prepareFailure);
  assert.deepEqual(events, ['receipt', 'receipt']);
  assert.equal(owner.pending, false);
  failPrepare = false;
  failClose = false;
  await (await owner.prepare(request)).cancel();
  assert.deepEqual(events, ['receipt', 'receipt', 'receipt']);
}

async function coreCopyOptionalPaths() {
  const id = 'a'.repeat(32);
  const root = `/fixture/reader-core-copy-probe-${id}`;
  const directories = new Set();
  const records = [];
  const created = [];
  const ioDenied = Object.assign(Error('operation denied'), { code: 13900012 });
  let accessFailure = absent();
  const probe = load('app/diagnostics/ReaderCoreCopyProbe.ts', 'probeReaderCoreCopy', {
    fileIo: {
      accessSync(path) { if (!directories.has(path)) throw accessFailure; return true; },
      mkdirSync(path) { directories.add(path); },
      lstatSync(path) {
        assert.ok(directories.has(path));
        return { isSymbolicLink: () => false, isDirectory: () => true };
      },
    },
    async replaceReaderAtomicSnapshot(...arguments_) { created.push(arguments_); },
  });
  await probe(true, 'debug', true, 'prepare', id, '/fixture', () => true, sample => records.push(sample));
  assert.deepEqual(records, [{ phase: 'prepare', code: 'READY', count: 0 }]);
  assert.deepEqual([...directories], [root, `${root}/data`, `${root}/cache`]);
  assert.deepEqual(created, [[`${root}/marker.txt`, root, `reader-core-copy-probe-v1:${id}\n`]]);
  accessFailure = ioDenied;
  await probe(true, 'debug', true, 'prepare', id, '/fixture', () => true, sample => records.push(sample));
  assert.deepEqual(records.at(-1), { phase: 'prepare', code: 'PROBE_ERROR', count: 0 });
  assert.equal(created.length, 1);
}

const cases = { 'manga-graphics': mangaGraphics, 'local-epub-access': localEpubAccess, 'share-cache': shareCache,
  'native-text-teardown': nativeTextTeardown, 'capture-listener-teardown': captureListenerTeardown,
  'bundled-ledger-read': bundledLedgerRead, 'arkweb-cleanup-precedence': arkWebCleanupPrecedence,
  'public-book-cleanup-precedence': publicBookCleanupPrecedence, 'manga-chapter-cancel': mangaChapterCancel,
  'core-copy-optional-paths': coreCopyOptionalPaths };
for (const id of selectContractCases(definitions)) {
  await cases[id]();
  recordContractCasePass(id);
}
