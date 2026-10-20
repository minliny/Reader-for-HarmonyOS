import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { localFilePath, resolveEtsLoaderRoot }=await import('./lib/tool-environment.mjs');

const fs=await import('node:fs/promises');
const { readFileSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { join }=await import('node:path');
const { createHash }=await import('node:crypto');
const { createRequire, registerHooks, stripTypeScriptTypes }=await import('node:module');
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
// Platform util.LRUCache is an IO seam in Node; delegate eviction to the
// SDK's installed ISC lru-cache 5.1.1 instead of implementing another cache.
const sdkLru = createRequire(import.meta.url)(`${resolveEtsLoaderRoot()}/node_modules/lru-cache`);
const util = { LRUCache: class {
  constructor(capacity) { this.cache = new sdkLru({max: capacity}); }
  get(key) { return this.cache.get(key); } put(key, value) { this.cache.set(key, value); }
  remove(key) { return this.cache.del(key); } keys() { return this.cache.keys(); } clear() { this.cache.reset(); }
}, TextEncoder: class { encodeInto(v) { return new TextEncoder().encode(v); } },
  TextDecoder: { create: (_, options) => ({ decodeToString: b => new TextDecoder('utf-8', options).decode(b) }) } };
const crypto = { createMd: () => { const h = createHash('sha256'); return { update: async ({ data }) => { h.update(data); }, digest: async () => ({ data: h.digest() }) }; } };
const Cache = new Function('fileIo', 'statfs', 'cryptoFramework', 'util', 'canonicalReadingImageBaseUrl',
  'assertReadingOfflineWriteCapacity', 'ReadingOfflineMaterializationError', `${executable};return ReadingImageDiskCache;`)(
  io, { getFreeSize: async () => 1e9 }, crypto, util, value => value?.trim().split('#')[0] || undefined, () => {}, Error);
const Owner = productionMotionMethods(localFilePath(new URL('entry/src/main/ets/app/ReaderRuntimeOwner.ts', root)),
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
let durableFixture,actualDirectoryIndex,cleanupDurableFixtures;
async function runIndex(f) {
 if(!durableFixture){({directoryFixture:durableFixture,cleanupDurableFixtures}=await import('./lib/reading-operation-durable-probe.mjs'));({makeIndex:actualDirectoryIndex}=await import('./lib/reading-directory-sdk-consumer.mjs'));}
 const a=await durableFixture(true);console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...a.toolEvidence()}));a.install(f.owner);f.owner.getUIAbilityContext=()=>({filesDir:a.files});
 const rows=f.session.entries.map(e=>({index:e.index,title:e.title,navigable:e.url.length>0,downloadState:'missing'}));
 const x=actualDirectoryIndex({...a,runtime:f.owner,entries:()=>rows},{remote:true}),p=x.idx;
 const messages=[],failures=[];p.remoteReadingSession=f.session;
 p.getUIContext=()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})});
 const originalFailure=p.offlineBinding.bind(p);p.offlineBinding=(...args)=>{const b=originalFailure(...args),failed=b.failed;b.failed=e=>{failures.push(e);failed?.(e);};return b;};
 // Retained Host recovery/completion uses the actual Index feedback binding;
 // current directory buttons use the separate persistent download owner.
 void p.getReadingOfflineHost(f.owner).downloadBook(p.offlineBinding(f.owner,f.session));
 for(let turn=0;turn<2000&&(p.offlineOperation===undefined||p.getReadingOfflineHost(f.owner).busy());turn++)await new Promise(setImmediate);
 assert.ok(p.offlineOperation,'actual owner emitted its operation');assert.equal(p.getReadingOfflineHost(f.owner).busy(),false);assert.equal(p.offlineOperationActive,false);
 return{messages,failures,p};
}

let passed=false;try{
if(id==='bounded-completion'){
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

}
if(id==='blank-base'){
  for (const finalUrl of ['', '  ']) {
    const blankBase = await fixture(1); blankBase.state.finalUrl = finalUrl;
    await new ReadingOfflineGateway(blankBase.owner).prefetchBook(blankBase.session);
    assert.equal((await new ReadingOfflineGateway(blankBase.owner).loadProjection(blankBase.session))[0].downloadState, 'completed');
    assert.equal(blankBase.storedResources[0].baseUrl, undefined);
  }
  checks.push('empty and whitespace finalUrl match the existing loadChapter identity semantics');


}
if(id==='body-invalidation'){
  const changed = await fixture();
  changed.state.afterPrefetch = async range => { if (range[0] === 20) { changed.state.generation++; changed.state.bodySuffix = '已改变'; } };
  const changedResult = await new ReadingOfflineGateway(changed.owner).prefetchBook(changed.session);
  assert.equal(changed.calls.filter(c => c.params.cacheOnly).length, 20, 'invalidated earlier proofs require fresh cacheOnly reads');
  assert.equal(changedResult[0].downloadState, 'cached', 'old exact manifest cannot certify changed body');
  assert.ok(changedResult.slice(1).every(e => e.downloadState === 'completed'));
  checks.push('a body/version invalidation discards existing proof before exact local revalidation');


}
if(id==='missing-image'){
  const missing = await fixture();
  missing.state.afterPrefetch = async range => { if (range[0] === 20) await fs.unlink(await missing.cache.resourcePath(missing.storedResources[0])); };
  const missingResult = await new ReadingOfflineGateway(missing.owner).prefetchBook(missing.session);
  assert.equal(missing.calls.filter(c => c.params.cacheOnly).length, 0, 'identity proof can remain current');
  assert.equal(missingResult[0].downloadState, 'cached', 'resource loss is checked despite a proof hit');
  checks.push('proof reuse never caches completion: deleted image bytes revoke exact manifest completion');


}
if(id==='legacy-fence'){
  const noFence = await fixture(21); delete noFence.owner.captureReadingContentValidity;
  await new ReadingOfflineGateway(noFence.owner).prefetchBook(noFence.session);
  assert.equal(noFence.calls.filter(c => c.params.cacheOnly).length, 41, 'legacy Host cannot reuse across batch without a fence');
  noFence.state.capability = false; noFence.calls.length = 0;
  assert.ok((await new ReadingOfflineGateway(noFence.owner).loadProjection(noFence.session)).every(e => e.downloadState === 'cached'));
  assert.equal(noFence.calls.filter(c => c.method === 'chapter.content').length, 0, 'unsupported cacheOnly never risks transport');
  checks.push('missing lifetime guard disables reuse; unsupported cacheOnly remains cached without body request');


}
if(id==='parallel-mutation'){
const f=await fixture(3);await new ReadingOfflineGateway(f.owner).prefetchBook(f.session);
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


}
if(id==='body-fence'){
const f=await fixture(3);await new ReadingOfflineGateway(f.owner).prefetchBook(f.session);
  const started = deferred(), bodyRelease = deferred();
  f.state.beforeBody = async params => { if (params.cacheOnly && params.chapterIndex === 0) { started.resolve(); await bodyRelease.promise; } };
  const reading = assert.rejects(new ReadingOfflineGateway(f.owner).loadProjection(f.session), /superseded/);
  await started.promise; f.state.generation++; bodyRelease.resolve(); await reading;
  checks.push('proof fence is captured before body read, not minted after a stale response');


}
if(id==='failure-counts'){
  const failed = await fixture(25); failed.state.failBody = true;
  failed.session.entries[0].url = ''; failed.session.entries[0].title = '卷一';
  failed.session.entries[1].title = '真正的第一章';
  const failureProgress = [];
  await new ReadingOfflineGateway(failed.owner).prefetchBook(failed.session, undefined, p => failureProgress.push(p));
  assert.deepEqual(failureProgress.map(p => [p.processedChapters, p.completedChapters, p.failedChapters]), [[19, 0, 19], [24, 0, 24]]);
  assert.equal(failureProgress.at(-1).firstFailure.reason, '书源返回 HTTP 403');
  assert.equal(failed.calls.filter(c=>c.method==='cache.book.prefetch').length,2,'both bounded ranges run despite full failure');
  checks.push('processed is separate from completed; failure counts/reason/title survive while secret error text does not');


}
if(id==='resource-failure'){
  const resourceFailure = await fixture(3); resourceFailure.state.failManifest = true;
  const resourceProgress = [];
  const resourceProjection = await new ReadingOfflineGateway(resourceFailure.owner).prefetchBook(resourceFailure.session, undefined, p => resourceProgress.push(p));
  assert.ok(resourceProjection.every(entry => entry.downloadState === 'cached'));
  assert.equal(resourceProgress[0].cachedChapters, 3);
  assert.equal(resourceProgress[0].failedChapters, 3);
  assert.equal(resourceProgress[0].completedChapters, 0);
  assert.ok(resourceFailure.bytes.every(bytes=>bytes>0));
  checks.push('resource failure reports cached body and failed materialization together without hiding durable bytes');


}
if(id==='index-progress'){
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
    ({directoryFixture:durableFixture,cleanupDurableFixtures}=await import('./lib/reading-operation-durable-probe.mjs'));({makeIndex:actualDirectoryIndex}=await import('./lib/reading-directory-sdk-consumer.mjs'));const actual=await durableFixture(true);console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...actual.toolEvidence()})); actual.install(actual.runtime);
    const host=actual.offline;
    // Keep the original controlled progress transport seam; the actual Host,
    // actual Index binding and task-state publication execute unchanged.
    const transport=new ProgressGateway(); transport.pendingClearOperation=async()=>undefined; transport.installClearAuthority=()=>{};
    host.dependencies.gateway=transport;
    const {idx:p}=actualDirectoryIndex(actual,{remote:true});
    p.getUIContext=()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})});
    void host.downloadBook(p.offlineBinding(actual.runtime,p.remoteReadingSession));
    for(let i=0;i<100;i++){await new Promise(resolve=>setImmediate(resolve));if(p.offlineOperation!==undefined&&!host.busy())break;}
    assert.ok(p.offlineOperation,'actual Host published the captured operation');
    assert.equal(host.busy(),false,'controlled progress transport completed');
    assert.equal(messages.filter(message => message.startsWith('正在下载')).length, 0,
      'live task progress belongs to the published operation rather than periodic Toasts');
    assert.equal(p.offlineOperation.progress.completedChapters, 1, 'silent presentation retains live completed counts');
    assert.equal(p.offlineOperation.progress.totalChapters, 45);
    assert.equal(messages.length, 1, 'the current completed operation has one terminal feedback');
    assert.equal(messages[0], '全部 1 章下载完成',
      'terminal feedback retains the existing result formatter for the single returned chapter');
    const retired = p.offlineBinding(actual.runtime, p.remoteReadingSession);
    p.remoteReadingSession = undefined;
    retired.onProgress(p.offlineOperation.progress, true);
    assert.equal(messages.length, 1, 'a retired final callback cannot display over a new page');
  } finally { Date.now = realNow; }
  checks.push('live download counts remain published without periodic Toasts; one current terminal result and no retired final feedback');


}
if(id==='index-feedback'){
const f=await fixture(3);const ui=await runIndex(f);assert.equal(ui.messages.at(-1),'全部 3 章下载完成');assert.equal(ui.failures.length,0);const bad=await fixture(3);bad.state.failBody=true;const failed=await runIndex(bad);assert.match(failed.messages.at(-1),/3 章失败/);assert.ok(!failed.messages.join('').includes('private.invalid'));const resources=await fixture(3);resources.state.failManifest=true;const rf=await runIndex(resources);assert.match(rf.messages.at(-1),/另有 3 章正文已缓存，3 章失败.*存储空间不足/);
}
passed=true;}finally{for(const handle of handles.values())await handle.close().catch(()=>{});for(const directory of directories)await fs.rm(directory,{recursive:true,force:true});const cleanup=await cleanupDurableFixtures?.({retain:!passed});if(cleanup&&!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"bounded-completion": "bounded-completion actual scoped owner/gateway/storage path; controlled Core/OS ports", "blank-base": "blank-base actual scoped owner/gateway/storage path; controlled Core/OS ports", "body-invalidation": "body-invalidation actual scoped owner/gateway/storage path; controlled Core/OS ports", "missing-image": "missing-image actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-fence": "legacy-fence actual scoped owner/gateway/storage path; controlled Core/OS ports", "parallel-mutation": "parallel-mutation actual scoped owner/gateway/storage path; controlled Core/OS ports", "body-fence": "body-fence actual scoped owner/gateway/storage path; controlled Core/OS ports", "failure-counts": "failure-counts actual scoped owner/gateway/storage path; controlled Core/OS ports", "resource-failure": "resource-failure actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-progress": "index-progress actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-feedback": "index-feedback actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
