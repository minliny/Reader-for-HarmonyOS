import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const root = new URL('../', import.meta.url);
const { ReadingOfflineGateway } = await import(new URL('entry/src/main/ets/features/reading/ReadingOfflineGateway.ts', root));
const { ReadingOfflineMaterializationError } = await import(new URL('entry/src/main/ets/features/reading/ReadingOfflineContract.ts', root));
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const source = readFileSync(new URL('entry/src/main/ets/app/ReadingImageDiskCache.ts', root), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
// Whole production disk cache; only Harmony platform APIs are adapted to a
// real temporary filesystem, as in test-reading-offline-image-cache-runtime.
const handles = new Map();
const io = { OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 }, access: async p => fs.access(p).then(() => true, () => false),
  stat: p => fs.stat(p), mkdir: (p, recursive) => fs.mkdir(p, { recursive }), listFile: p => fs.readdir(p), rmdir: p => fs.rmdir(p), unlink: p => fs.unlink(p),
  open: async p => { const h = await fs.open(p, 'w+'); handles.set(h.fd, h); return h; },
  write: async (fd, b) => (await handles.get(fd).write(new Uint8Array(b))).bytesWritten,
  fsync: async fd => handles.get(fd).sync(), close: async h => { handles.delete(h.fd); await h.close(); }, rename: (a, b) => fs.rename(a, b),
  AtomicFile: class { constructor(p) { this.path = p; } readFully() { const b = readFileSync(this.path); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } } };
const util = { TextEncoder: class { encodeInto(v) { return new TextEncoder().encode(v); } },
  TextDecoder: { create: (_, options) => ({ decodeToString: b => new TextDecoder('utf-8', options).decode(b) }) } };
const crypto = { createMd: () => { const h = createHash('sha256'); return { update: async ({ data }) => { h.update(data); }, digest: async () => ({ data: h.digest() }) }; } };
const Cache = new Function('fileIo', 'statfs', 'cryptoFramework', 'util', 'canonicalReadingImageBaseUrl',
  'assertReadingOfflineWriteCapacity', 'ReadingOfflineMaterializationError', `${executable};return ReadingImageDiskCache;`)(
  io, { getFreeSize: async () => 1e9 }, crypto, util, value => value?.trim().split('#')[0] || undefined, () => {}, Error);
const Owner = productionMotionMethods(new URL('entry/src/main/ets/app/ReaderRuntimeOwner.ts', root).pathname,
  ['markOfflineImageChapterComplete', 'isOfflineImageChapterComplete']);
const directories = [];
const checks = [];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fixture(count = 45) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'reader-offline-completion-')); directories.push(directory);
  const cache = new Cache({ filesDir: directory });
  const sourceId = 'source', bookId = 'book';
  const session = { acquisitionMode: 'online', identity: { sourceId, bookId }, detailUrl: bookId, tocUrl: '/toc',
    book: { title: 'Book', author: 'Author' }, continuationVariables: [], hostRequirements: [],
    entries: Array.from({ length: count }, (_, index) => ({ index, title: `正文 ${index}`, url: `https://origin.invalid/${index}`, variables: [] })) };
  const states = Array(count).fill('missing'), bytes = Array(count).fill(0), errors = Array(count).fill(undefined), calls = [], storedResources = [];
  const state = { generation: 0, bodySuffix: '', finalUrl: 'https://redirect.invalid/chapter#fragment', capability: true, failBody: false, failManifest: false, afterPrefetch: async () => {}, beforeBody: async () => {} };
  const owner = Object.assign(new Owner(), { readingImageDiskCache: cache,
    captureReadingContentValidity: () => { const generation = state.generation; return () => generation === state.generation; },
    supportsCoreCapability: capability => state.capability && capability === 'chapter.content.cacheOnly.v1',
    prefetchReadingImage: async resource => { storedResources.push(resource); await cache.storeResource(resource, new Uint8Array([1, 2, 3])); },
    request: async (method, params = {}, options = {}) => {
      calls.push({ method, params: structuredClone(params) });
      assert.notEqual(options.shouldCancel?.(), true);
      if (method === 'cache.book.prefetch') {
        const materializations = [];
        for (let index = params.chapterRange[0]; index < params.chapterRange[1]; index++) {
          if (session.entries[index].url.length === 0) continue;
          states[index] = state.failBody ? 'failed' : 'inProgress'; bytes[index] = state.failBody ? 0 : 80;
          errors[index] = state.failBody ? 'chapter.content HTTP status 403 https://private.invalid/secret' : undefined;
          if (!state.failBody) materializations.push({ chapterIndex: index, token: `lease-${index}` });
        }
        await state.afterPrefetch(params.chapterRange);
        return { data: { sourceId, bookId, chapterRange: params.chapterRange, materializations } };
      }
      if (method === 'cache.book.status') return { data: { sourceId, bookId,
        chapters: states.map((status, chapterIndex) => ({ chapterIndex, state: status, cachedBytes: bytes[chapterIndex], lastError: errors[chapterIndex] })) } };
      if (method === 'chapter.content') {
        await state.beforeBody(params);
        const text = `有效正文，当前内容${params.chapterIndex === 0 ? state.bodySuffix : ''}`;
        if (params.chapterIndex !== 0) return { data: { sourceId, bookId, chapterTitle: session.entries[params.chapterIndex].title, content: text, via: 'cache' } };
        const end = [...text].length;
        return { data: { sourceId, bookId, chapterTitle: '图片正文', content: `${text}\uFFFC`, via: 'cache',
          http: { finalUrl: state.finalUrl }, blocks: [
            { kind: 'text', text, startScalar: 0, endScalar: end },
            { kind: 'image', source: 'image.webp', startScalar: end, endScalar: end + 1, imageWidthBasisPoints: 5000, imageIntrinsicWidth: 100, imageIntrinsicHeight: 80 },
          ] } };
      }
      if (method === 'cache.chapter.materialization.report') {
        states[params.chapterIndex] = params.outcome; errors[params.chapterIndex] = params.errorCode;
        return { data: { sourceId, bookId, chapterIndex: params.chapterIndex, state: params.outcome, retainedCachedBody: true } };
      }
      throw Error(`unexpected command ${method}`);
    },
  });
  const mark = owner.markOfflineImageChapterComplete.bind(owner);
  owner.markOfflineImageChapterComplete = async (chapter, resources) => {
    if (state.failManifest) throw new ReadingOfflineMaterializationError('storage_full', 'fixture disk is full');
    return mark(chapter, resources);
  };
  return { owner, cache, session, state, states, bytes, calls, storedResources };
}
async function runIndex(f) {
  const Index = productionMotionMethods(new URL('entry/src/main/ets/pages/Index.ets', root).pathname,
    ['downloadDirectoryBook', 'showOfflineDownloadFeedback'], { ReadingOfflineGateway, ReaderRuntimeOwner: { current: () => f.owner }, hilog: { error() {} }, DOMAIN: 0 });
  const messages = [], failures = [];
  const p = Object.assign(new Index(), { remoteReadingSession: f.session, offlineMutationActiveKey: '', offlineMutationGeneration: 0,
    detailToc: f.session.entries.map(e => ({ index: e.index, title: e.title, navigable: e.url.length > 0, downloadState: 'missing' })),
    mergeDirectoryBookmarks: entries => entries, showReadingFailure: (...error) => failures.push(error),
    getUIContext: () => ({ getPromptAction: () => ({ showToast: ({ message }) => messages.push(message) }) }) });
  p.downloadDirectoryBook();
  const deadline = performance.now() + 10000;
  while (p.offlineMutationActiveKey !== '' && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(p.offlineMutationActiveKey, '');
  return { messages, failures, p };
}
try {
  const f = await fixture(), progress = [];
  const result = await new ReadingOfflineGateway(f.owner).prefetchBook(f.session, () => true, p => progress.push(p));
  assert.ok(result.every(e => e.downloadState === 'completed'));
  assert.deepEqual(progress.map(p => [p.processedChapters, p.completedChapters]), [[20, 20], [40, 40], [45, 45]]);
  assert.equal(f.calls.filter(c => c.method === 'chapter.content').length, 45, 'one materialization read per chapter, no quadratic body rereads');
  assert.equal(f.calls.filter(c => c.params.cacheOnly).length, 0);
  assert.equal(f.storedResources[0].baseUrl, 'https://redirect.invalid/chapter');
  f.calls.length = 0;
  assert.ok((await new ReadingOfflineGateway(f.owner).loadProjection(f.session)).every(e => e.downloadState === 'completed'));
  assert.equal(f.calls.filter(c => c.params.cacheOnly === true).length, 45, 'standalone projection verifies each current local body once');
  assert.equal(f.calls.filter(c => c.method === 'chapter.content' && c.params.cacheOnly !== true).length, 0);
  const ui = await runIndex(f);
  assert.equal(ui.messages.at(-1), '全部 45 章下载完成');
  assert.equal(ui.failures.length, 0);
  checks.push('whole production DiskCache/Owner/Gateway/Index confirms completion, redirects and image geometry; linear body reads');

  for (const finalUrl of ['', '  ']) {
    const blankBase = await fixture(1); blankBase.state.finalUrl = finalUrl;
    await new ReadingOfflineGateway(blankBase.owner).prefetchBook(blankBase.session);
    assert.equal((await new ReadingOfflineGateway(blankBase.owner).loadProjection(blankBase.session))[0].downloadState, 'completed');
    assert.equal(blankBase.storedResources[0].baseUrl, undefined);
  }
  checks.push('empty and whitespace finalUrl match the existing loadChapter identity semantics');

  const changed = await fixture();
  changed.state.afterPrefetch = async range => { if (range[0] === 20) { changed.state.generation++; changed.state.bodySuffix = '已改变'; } };
  const changedResult = await new ReadingOfflineGateway(changed.owner).prefetchBook(changed.session);
  assert.equal(changed.calls.filter(c => c.params.cacheOnly).length, 20, 'invalidated earlier proofs require fresh cacheOnly reads');
  assert.equal(changedResult[0].downloadState, 'cached', 'old exact manifest cannot certify changed body');
  assert.ok(changedResult.slice(1).every(e => e.downloadState === 'completed'));
  checks.push('a body/version invalidation discards existing proof before exact local revalidation');

  const missing = await fixture();
  missing.state.afterPrefetch = async range => { if (range[0] === 20) await fs.unlink(await missing.cache.resourcePath(missing.storedResources[0])); };
  const missingResult = await new ReadingOfflineGateway(missing.owner).prefetchBook(missing.session);
  assert.equal(missing.calls.filter(c => c.params.cacheOnly).length, 0, 'identity proof can remain current');
  assert.equal(missingResult[0].downloadState, 'cached', 'resource loss is checked despite a proof hit');
  checks.push('proof reuse never caches completion: deleted image bytes revoke exact manifest completion');

  const noFence = await fixture(21); delete noFence.owner.captureReadingContentValidity;
  await new ReadingOfflineGateway(noFence.owner).prefetchBook(noFence.session);
  assert.equal(noFence.calls.filter(c => c.params.cacheOnly).length, 41, 'legacy Host cannot reuse across batch without a fence');
  noFence.state.capability = false; noFence.calls.length = 0;
  assert.ok((await new ReadingOfflineGateway(noFence.owner).loadProjection(noFence.session)).every(e => e.downloadState === 'cached'));
  assert.equal(noFence.calls.filter(c => c.method === 'chapter.content').length, 0, 'unsupported cacheOnly never risks transport');
  checks.push('missing lifetime guard disables reuse; unsupported cacheOnly remains cached without body request');

  const early = deferred(), release = deferred();
  const exact = f.owner.isOfflineImageChapterComplete.bind(f.owner);
  f.owner.isOfflineImageChapterComplete = async chapter => {
    if (chapter.chapterIndex === 1) await release.promise;
    const result = await exact(chapter);
    if (chapter.chapterIndex === 0) early.resolve();
    return result;
  };
  const pending = new ReadingOfflineGateway(f.owner).loadProjection(f.session);
  const rejected = assert.rejects(pending, /superseded/);
  await early.promise; f.state.generation++; release.resolve(); await rejected;
  f.owner.isOfflineImageChapterComplete = exact;
  checks.push('mutation after an early worker completes rejects the entire parallel projection');

  const started = deferred(), bodyRelease = deferred();
  f.state.beforeBody = async params => { if (params.cacheOnly && params.chapterIndex === 0) { started.resolve(); await bodyRelease.promise; } };
  const reading = assert.rejects(new ReadingOfflineGateway(f.owner).loadProjection(f.session), /superseded/);
  await started.promise; f.state.generation++; bodyRelease.resolve(); await reading;
  checks.push('proof fence is captured before body read, not minted after a stale response');

  const failed = await fixture(25); failed.state.failBody = true;
  failed.session.entries[0].url = ''; failed.session.entries[0].title = '卷一';
  failed.session.entries[1].title = '真正的第一章';
  const failureProgress = [];
  await new ReadingOfflineGateway(failed.owner).prefetchBook(failed.session, undefined, p => failureProgress.push(p));
  assert.deepEqual(failureProgress.map(p => [p.processedChapters, p.completedChapters, p.failedChapters]), [[19, 0, 19], [24, 0, 24]]);
  assert.equal(failureProgress.at(-1).firstFailure.reason, '书源返回 HTTP 403');
  const failureUi = await runIndex(failed);
  assert.match(failureUi.messages.at(-1), /24 章失败.*真正的第一章：书源返回 HTTP 403/);
  assert.ok(!failureUi.messages.join('').includes('private.invalid'));
  assert.equal(failed.calls.filter(c => c.method === 'cache.book.prefetch').length, 4, 'partial/full failures continue remaining ranges');
  checks.push('processed is separate from completed; failure counts/reason/title survive while secret error text does not');

  const resourceFailure = await fixture(3); resourceFailure.state.failManifest = true;
  const resourceProgress = [];
  const resourceProjection = await new ReadingOfflineGateway(resourceFailure.owner).prefetchBook(resourceFailure.session, undefined, p => resourceProgress.push(p));
  assert.ok(resourceProjection.every(entry => entry.downloadState === 'cached'));
  assert.equal(resourceProgress[0].cachedChapters, 3);
  assert.equal(resourceProgress[0].failedChapters, 3);
  assert.equal(resourceProgress[0].completedChapters, 0);
  const resourceUi = await runIndex(resourceFailure);
  assert.match(resourceUi.messages.at(-1), /另有 3 章正文已缓存，3 章失败.*存储空间不足/);
  assert.ok(resourceFailure.bytes.every(bytes => bytes > 0));
  checks.push('resource failure reports cached body and failed materialization together without hiding durable bytes');

  const realNow = Date.now; let now = 0; const messages = [];
  Date.now = () => now;
  try {
    class ProgressGateway {
      async prefetchBook(_book, _current, progress) {
        for (const [processed, completed] of [[1, 0], [2, 0], [3, 1], [4, 1]]) {
          now += 6000;
          progress({ processedChapters: processed, completedChapters: completed, cachedChapters: 0,
            failedChapters: 0, totalChapters: 45, entries: [] });
        }
        return [{ index: 0, navigable: true, downloadState: 'completed' }];
      }
    }
    const Index = productionMotionMethods(new URL('entry/src/main/ets/pages/Index.ets', root).pathname,
      ['downloadDirectoryBook', 'showOfflineDownloadFeedback'], { ReadingOfflineGateway: ProgressGateway,
        ReaderRuntimeOwner: { current: () => ({}) }, hilog: { error() {} }, DOMAIN: 0 });
    const p = Object.assign(new Index(), { remoteReadingSession: f.session, offlineMutationActiveKey: '', offlineMutationGeneration: 0,
      detailToc: [], mergeDirectoryBookmarks: entries => entries, showReadingFailure: error => { throw error; },
      getUIContext: () => ({ getPromptAction: () => ({ showToast: ({ message }) => messages.push(message) }) }) });
    p.downloadDirectoryBook();
    for (let i = 0; i < 20 && p.offlineMutationActiveKey !== ''; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(messages.filter(message => message.startsWith('正在下载')).length, 1);
    assert.ok(messages.some(message => message.startsWith('正在下载：已完成 1/45')));
  } finally { Date.now = realNow; }
  checks.push('processed-only updates cannot repeatedly toast unchanged zero/completion counts');

  console.log(JSON.stringify({ pass: true, checks }, null, 2));
} finally { for (const directory of directories) await fs.rm(directory, { recursive: true, force: true }); }
