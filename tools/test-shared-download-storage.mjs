import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const fs=await import('node:fs/promises');
const { readFileSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { dirname, join, resolve }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { createHash }=await import('node:crypto');
const { stripTypeScriptTypes }=await import('node:module');
const { ReaderCoreRequestError, isReaderCoreTransactionPendingError }=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const { ReaderWriteEvidence }=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const { createMangaAtomicPayloadReaderFixture }=await import('./lib/manga-atomic-payload-probe.mjs');

// Full production methods, real temporary files. The sparse quota fixtures
// report their real stat.size without allocating gigabytes of test payload.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(repo, 'entry/src/main/ets/app/ReadingImageDiskCache.ts'), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const handles = new Map();
let rejectUnlink = () => false;
let beforeUnlink = async () => {};
let beforeSync = async () => {};
const io = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  access: path => fs.access(path).then(() => true, () => false),
  stat: async path => { const s = await fs.stat(path), n = await fs.stat(path, { bigint: true }); return {
    size:s.size,ino:n.ino,mtimeNs:n.mtimeNs,ctimeNs:n.ctimeNs,
    isFile:()=>s.isFile(),isDirectory:()=>s.isDirectory(),
  }; },
  mkdir: (path, recursive) => fs.mkdir(path, { recursive }), listFile: path => fs.readdir(path), rmdir: path => fs.rmdir(path),
  unlink: async path => { await beforeUnlink(path); if (rejectUnlink(path)) throw Error('injected unlink failure'); await fs.unlink(path); },
  open: async path => { const h = await fs.open(path, 'w+'); handles.set(h.fd,h); return h; },
  write: async (fd, bytes) => (await handles.get(fd).write(new Uint8Array(bytes))).bytesWritten,
  fsync: async fd => { await beforeSync(); await handles.get(fd).sync(); },
  close: async h => { handles.delete(h.fd); await h.close(); }, rename:(a,b)=>fs.rename(a,b),
  AtomicFile: class { constructor(path){this.path=path;} readFully(){const b=readFileSync(this.path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);} },
};
const {createRequire}=await import('node:module');const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');const sdkLru=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/node_modules/lru-cache');
const util = {
  LRUCache: class {constructor(capacity){this.cache=new sdkLru({max:capacity});}get(k){return this.cache.get(k);}put(k,v){this.cache.set(k,v);}remove(k){this.cache.del(k);}keys(){return this.cache.keys();}clear(){this.cache.reset();}},
  TextEncoder: class { encodeInto(v){return new TextEncoder().encode(v);} },
  TextDecoder:{create:(_,opts)=>({decodeToString:b=>new TextDecoder('utf-8',opts).decode(b)})},
};
const crypto = {createMd:()=>{const h=createHash('sha256');return{update:async({data})=>{h.update(data);},digest:async()=>({data:h.digest()})};}};
class MaterializationError extends Error {constructor(kind,message){super(message);this.kind=kind;this.code=kind;}}
const readMangaAtomicPayload = createMangaAtomicPayloadReaderFixture(io);
const Cache = new Function('fileIo','statfs','cryptoFramework','util','canonicalReadingImageBaseUrl','assertReadingOfflineWriteCapacity','ReadingOfflineMaterializationError','readMangaAtomicPayload', `${executable}\nreturn ReadingImageDiskCache;`)(
  io,{getFreeSize:async()=>8*1024**3},crypto,util,b=>b?.trim().split('#')[0]||undefined,
  (free,bytes,reserve)=>{if(free<bytes+reserve)throw new MaterializationError('storage_full','MANGA_CACHE_STORAGE_FULL');},MaterializationError,readMangaAtomicPayload,
);

const storageSource = readFileSync(join(repo, 'entry/src/main/ets/features/downloads/SharedDownloadStorageGateway.ts'), 'utf8');
const Storage = new Function('SharedDownloadIntentPreferences', 'ReaderCoreRequestError', 'isReaderCoreTransactionPendingError',
  stripTypeScriptTypes(storageSource.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '')) + '\nreturn SharedDownloadStorageGateway;')(class {}, ReaderCoreRequestError, isReaderCoreTransactionPendingError);
const root = await fs.mkdtemp(join(tmpdir(), 'reader-global-storage-'));
const utf8 = value => Buffer.byteLength(value, 'utf8');
const chapterKey = c => JSON.stringify([c.sourceId, c.bookId, c.chapterIndex]);
const identity = (chapterIndex, bookId = 'book') => ({ sourceId: 'source', bookId, chapterIndex });
const resource = c => ({ ...c, contentVersion: 'body-v1', imageUrl: `https://fixture.invalid/image/${c.chapterIndex}` });
let serial = 0;
async function fixture(options = {}) {
  const { legacy = [], bodyCount = 0 } = options;
  const migration = Object.hasOwn(options, 'migration') ? options.migration : [];
  const dir = join(root, `case-${++serial}`); await fs.mkdir(dir);
  const disk = new Cache({ filesDir: dir }, { getFreeBytes: async () => 4 * 1024 ** 3, getTotalBytes: async () => 8 * 1024 ** 3 });
  disk.setMangaStorageAuthority({ classify: async () => 'unknown', candidates: async () => [], pending: async () => [],
    policy: async () => ({ status: 'unknown', inUse: true, lastReadAt: null }) });
  const bodies = new Map(), calls = []; let retained = [], protectedRows = [], revision = 0, completed = false;
  for (let i = 0; i < bodyCount; i++) bodies.set(chapterKey(identity(i)), { ...identity(i), content: `正文${i}` });
  for (const c of legacy) bodies.set(chapterKey(c), { ...c, content: '原明确下载或自动预热来源不明' });
  const saved = { value: migration === undefined ? undefined : structuredClone(migration), writes: 0, failSave: false };
  let textJournal;
  const persistence = { async loadSettingsTextCleanup() { return structuredClone(textJournal); },
    async saveSettingsTextCleanup(value) { textJournal = structuredClone(value); },
    async loadLegacyProtection() { return structuredClone(saved.value); },
    async saveLegacyProtection(rows) { if (saved.failSave) throw Error('PERSISTENCE_FAILED'); saved.value = structuredClone(rows); saved.writes++; } };
  const totals = params => {
    const retainedKeys = new Set((params.retainedChapters ?? []).map(chapterKey));
    const protectedKeys = new Set((params.protectedChapters ?? []).map(chapterKey));
    let totalBytes = 0, retainedBytes = 0, cleanableBytes = 0;
    for (const [key, row] of bodies) { const bytes = utf8(row.content); totalBytes += bytes;
      if (retainedKeys.has(key)) retainedBytes += bytes; else if (!protectedKeys.has(key)) cleanableBytes += bytes; }
    return { totalBytes, retainedBytes, automaticBytes: totalBytes - retainedBytes, cleanableBytes,
      protectedChapters: [...params.protectedChapters ?? []], removedChapters: [], hasMore: false, removedContentBytes: 0,
      completedQueueChapters: [], completedQueueHasMore: false };
  };
  const runtime = { captureDownloadStorageValidity() { const captured = revision; return () => captured === revision; },
    async readDownloadStorageBindings() { return { retainedChapters: retained.slice(), protectedChapters: protectedRows.slice() }; },
    async request(method, params = {}, options = {}) {
      calls.push({ method, params: structuredClone(params), options });
      if (method === 'cache.storage.summary') {
        const data = totals(params), after = params.completedQueueAfter;
        const available = legacy.filter(c => after === undefined || c.chapterIndex > after.chapterIndex);
        return { data: { ...data, completedQueueChapters: available.slice(0, 128), completedQueueHasMore: available.length > 128 } };
      }
      assert.equal(method, 'cache.storage.cleanup');
      assert.equal(options.shouldCancel, undefined, 'already dispatched body deletion retains its Host handoff');
      assert.equal(options.canDispatch(), true); options.onDispatch?.();
      const blocked = new Set([...(params.retainedChapters ?? []), ...(params.protectedChapters ?? [])].map(chapterKey));
      const candidates = new Map([...bodies.values()].map(row => [chapterKey(row), identity(row.chapterIndex, row.bookId)]));
      for (const c of params.hostImageChapters ?? []) candidates.set(chapterKey(c), identity(c.chapterIndex, c.bookId));
      const selected = [...candidates.values()].filter(c => !blocked.has(chapterKey(c))).slice(0, 128);
      let removedContentBytes = 0;
      for (const c of selected) { const b = bodies.get(chapterKey(c)); if (b) removedContentBytes += utf8(b.content); bodies.delete(chapterKey(c)); }
      const data = totals(params);
      if (completed) revision++;
      return { data: { ...data, removedChapters: selected, removedContentBytes,
        hasMore: [...candidates.values()].filter(c => !blocked.has(chapterKey(c))).length > 128 } };
    } };
  const gateway = new Storage(runtime, disk, persistence);
  return { dir, disk, gateway, runtime, bodies, calls, saved, persistence,
    keep: rows => { retained = rows; revision++; }, protect: rows => { protectedRows = rows; revision++; },
    changeAfterDispatch: () => { completed = true; }, bump: () => { revision++; } };
}

try{
if(id==='inventory-ownership'){
{
    const f = await fixture({ bodyCount: 3 }), automatic = identity(0), permanent = identity(1), active = identity(2);
    for (const c of [automatic, permanent, active]) {
      const r = resource(c); await f.disk.storeResource(r, new Uint8Array([1,2,3,4])); await f.disk.markChapterComplete({ ...c, contentVersion: r.contentVersion }, [r]);
    }
    f.keep([permanent]); f.protect([active]);
    const before = await f.disk.captureReadingStorageInventory(), summary = await f.gateway.summary();
    const physicalBytes = [...new Map(before.files.map(file => [file.physicalKey, file.size])).values()].reduce((sum,n) => sum+n,0);
    const bodyBytes = [...f.bodies.values()].reduce((sum,row) => sum + utf8(row.content),0);
    assert.equal(summary.totalBytes, physicalBytes + bodyBytes, 'physical files and logical UTF-8 content are separate actual measurements');
    assert.ok(summary.cleanableBytes > utf8('正文0'));
    const rowIndex = await f.disk.readingStorageBookIndex(before);
    assert.equal(rowIndex.get(JSON.stringify(['source','book'])), physicalBytes);
    const out = await f.gateway.cleanup();
    assert.equal(out.removedContentBytes, utf8('正文0'));
    assert.ok(out.deletedBytes > 4); assert.equal(out.deletedFiles, 3);
    assert.equal(f.bodies.has(chapterKey(permanent)), true); assert.equal(f.bodies.has(chapterKey(active)), true);
    assert.equal(await f.disk.isChapterComplete({ ...permanent, contentVersion: 'body-v1' }), true);
    assert.equal(await f.disk.isChapterComplete({ ...active, contentVersion: 'body-v1' }), true);
    assert.equal(await f.disk.isChapterComplete({ ...automatic, contentVersion: 'body-v1' }), false);
  }
}
if(id==='legacy-migration'){
{
    const legacy = Array.from({length:300},(_,i) => identity(i,'not-on-shelf'));
    const f = await fixture({ legacy, migration: undefined });
    await f.gateway.restoreLegacyProtection();
    assert.equal(f.saved.value.length, 300); assert.equal(f.saved.writes, 1);
    assert.equal(f.calls.filter(c => c.method === 'cache.storage.summary').length, 3);
    const out = await f.gateway.cleanup();
    assert.equal(out.removedContentBytes, 0); assert.equal(out.deletedBytes, 0); assert.equal(f.bodies.size, 300);
    const cleanup = f.calls.find(c => c.method === 'cache.storage.cleanup');
    assert.equal(cleanup.params.protectedChapters.length, 300);
    assert.equal(cleanup.params.retainedChapters.length, 0, 'ambiguous history is protected, not falsely permanent');
    await f.gateway.confirmExplicitDeletion('source','not-on-shelf',[1]);
    assert.equal(f.saved.value.length, 299);
  }
}
if(id==='legacy-flush'){
{
    const f = await fixture({ legacy: [identity(0)], migration: undefined }); f.saved.failSave = true;
    await assert.rejects(f.gateway.restoreLegacyProtection(), /PERSISTENCE_FAILED/);
    await assert.rejects(f.gateway.cleanup(), /PERSISTENCE_FAILED/);
    assert.equal(f.calls.some(c => c.method === 'cache.storage.cleanup'), false);
    assert.equal(f.bodies.size, 1, 'failed migration cannot authorize deleting old explicit downloads');
  }
}
if(id==='bounded-cleanup'){
{
    const f = await fixture({bodyCount:1000}); const out = await f.gateway.cleanup();
    assert.equal(f.calls.filter(c => c.method === 'cache.storage.cleanup').length, 8);
    assert.equal(f.bodies.size, 0); assert.equal(out.deletedFiles, 0); assert.ok(out.removedContentBytes > 0);
    assert.equal(out.deletedBytes, 0, 'Core UTF-8 deletion is never relabelled as physical SQLite bytes freed');
  }
}
if(id==='late-protection'){
{
    const f = await fixture({bodyCount:1000}); f.changeAfterDispatch();
    const out = await f.gateway.cleanup();
    assert.equal(f.calls.filter(c => c.method === 'cache.storage.cleanup').length, 1);
    assert.equal(f.bodies.size, 872); assert.ok(out.removedContentBytes > 0);
  }
}
if(id==='unlink-retry'){
{
    const f = await fixture({bodyCount:1}), r = resource(identity(0)); await f.disk.storeResource(r,new Uint8Array([1,2,3,4]));
    const path = await f.disk.resourcePath(r); rejectUnlink = actual => actual === path;
    const out = await f.gateway.cleanup(); rejectUnlink = () => false;
    assert.match(out.cleanupError,/unlink failure/); assert.equal(out.deletedBytes,0); assert.equal(await io.access(path),true);
    const retry = await f.gateway.cleanup(); assert.ok(retry.deletedBytes > 0); assert.equal(await io.access(path),false);
    assert.equal(retry.removedContentBytes,0,'image-only retry does not count the earlier body transaction twice');
  }
}
if(id==='unknown-alias'){
{
    const f = await fixture(), r = resource(identity(0)); await f.disk.storeResource(r,new Uint8Array([1,2,3,4]));
    const before = await f.disk.captureReadingStorageInventory();
    const path = await f.disk.resourcePath(r), unknown = join(dirname(path),'unknown-alias.bin'); await fs.link(path,unknown);
    const snapshot = await f.disk.captureReadingStorageInventory();
    assert.ok(snapshot.protectedChapters.some(c => chapterKey(c) === chapterKey(identity(0))));
    const summary = await f.disk.readingStorageSummary(snapshot, () => ({retained:false,inUse:false}));
    assert.equal(summary.classificationKnown,false);
    assert.equal(summary.cleanableBytes,0,'unknown physical alias prevents claiming this inode as cleanable');
    const out = await f.gateway.cleanup(); assert.equal(out.deletedBytes,0); assert.equal(await io.access(path),true);
    assert.equal((await f.disk.readingStorageBookIndex(snapshot)).get(JSON.stringify(['source','book'])),undefined);
  }
}
if(id==='settings-text'){
{
    const f = await fixture({ bodyCount: 4 });
    f.keep([identity(0)]); f.protect([identity(1)]);
    const r = resource(identity(2)); await f.disk.storeResource(r, new Uint8Array([7, 8, 9]));
    await f.disk.markChapterComplete({ ...identity(2), contentVersion: r.contentVersion }, [r]);
    let mangaClears = 0;
    f.disk.clearMangaRebuildableCache = async () => { mangaClears++; throw Error('text scope touched manga'); };
    const evidence = new ReaderWriteEvidence();
    const result = await f.gateway.cleanupSettingsText(evidence, () => true);
    assert.equal(evidence.confirmation(), 'confirmed'); assert.equal(mangaClears, 0);
    assert.ok(result.removedContentBytes > 0); assert.ok(result.deletedBytes > 0); assert.ok(result.deletedFiles > 0);
    assert.equal(f.bodies.has(chapterKey(identity(0))), true); assert.equal(f.bodies.has(chapterKey(identity(1))), true);
    assert.ok(f.calls.filter(call => call.method === 'cache.storage.cleanup').every(call => call.params.contentScope === 'text'));
    assert.equal((await f.gateway.readSettingsTextCleanup()).phase, 'confirmed');
    assert.equal((await f.gateway.readSettingsTextCleanup()).result.deletedFiles, result.deletedFiles);
  }
}
if(id==='settings-unknown'){
{
    const f = await fixture({ bodyCount: 1 });
    const request = f.runtime.request;
    f.runtime.request = async (method, params, options) => {
      if (method === 'cache.storage.cleanup') { options.onDispatch(); throw Error('ACK lost PRIVATE_TOKEN'); }
      return request(method, params, options);
    };
    const evidence = new ReaderWriteEvidence();
    await assert.rejects(f.gateway.cleanupSettingsText(evidence, () => true), /UNCONFIRMED/);
    assert.equal(evidence.confirmation(), 'unknown');
    const original = await f.gateway.readSettingsTextCleanup(); assert.equal(original.phase, 'pending');
    let replayCalls = 0;
    f.runtime.request = async (...args) => { replayCalls++; return request(...args); };
    await assert.rejects(f.gateway.cleanupSettingsText(new ReaderWriteEvidence(), () => true), /UNCONFIRMED/);
    assert.equal(replayCalls, 0, 'persistent unknown state blocks a second clear without any replay');
    const cold = new Storage(f.runtime, f.disk, f.persistence);
    assert.equal((await cold.readSettingsTextCleanup()).phase, 'pending');
    await assert.rejects(cold.cleanupSettingsText(new ReaderWriteEvidence(), () => true), /UNCONFIRMED/);
    assert.equal(replayCalls, 0, 'a new owner also refuses to replay the unknown dispatch');
  }
}
if(id==='settings-local-flush'){
{
    const f = await fixture({ bodyCount: 1 });
    let saves = 0;
    const save = f.persistence.saveSettingsTextCleanup;
    f.persistence.saveSettingsTextCleanup = async value => { await save(value); if (++saves === 1) throw Error('LOCAL_FLUSH_ACK_LOST'); };
    const evidence = new ReaderWriteEvidence();
    await assert.rejects(f.gateway.cleanupSettingsText(evidence, () => true), /LOCAL_FLUSH_ACK_LOST/);
    assert.equal(evidence.confirmation(), 'undispatched');
    assert.equal(f.calls.filter(call => call.method === 'cache.storage.cleanup').length, 0);
    assert.equal(await f.gateway.readSettingsTextCleanup(), undefined, 'known local-before-RPC failure clears only its marker');
  }
}
if(id==='settings-nonexecution'){
{
    const f = await fixture({ bodyCount: 1 });
    const request = f.runtime.request;
    f.runtime.request = async (method, params, options) => {
      if (method === 'cache.storage.cleanup') { options.onDispatch(); throw new ReaderCoreRequestError({
        protocolVersion: 1, requestId: 1, type: 'error', error: { code: 'INVALID_PARAMS', message: 'not executed', retryable: false,
          details: { domain: 'storage', nonExecution: true } } }); }
      return request(method, params, options);
    };
    const evidence = new ReaderWriteEvidence();
    await assert.rejects(f.gateway.cleanupSettingsText(evidence, () => true), /NOT_DISPATCHED/);
    assert.equal(evidence.confirmation(), 'undispatched'); assert.equal(await f.gateway.readSettingsTextCleanup(), undefined);
  }
}
if(id==='settings-partial-ack'){
{
    const f = await fixture({ bodyCount: 300 });
    const request = f.runtime.request; let cleanupBatches = 0;
    f.runtime.request = async (method, params, options) => {
      if (method === 'cache.storage.cleanup' && ++cleanupBatches === 2) { options.onDispatch(); throw Error('second ACK lost'); }
      return request(method, params, options);
    };
    const evidence = new ReaderWriteEvidence();
    await assert.rejects(f.gateway.cleanupSettingsText(evidence, () => true), /UNCONFIRMED/);
    assert.equal(evidence.dispatchedCount, 2); assert.equal(evidence.confirmedCount, 1);
    const pending = await f.gateway.readSettingsTextCleanup();
    assert.ok(pending.result.removedContentBytes > 0, 'known first-batch receipt is preserved without falsely confirming the entire operation');
    assert.equal(f.bodies.size, 172);
  }
}
if(id==='automatic-policy'){
{
    const dir = join(root, `case-${++serial}`); await fs.mkdir(dir);
    const volumeBytes = 1024 ** 3 + 123;
    const probe = { getFreeBytes: async () => volumeBytes, getTotalBytes: async () => volumeBytes };
    const disk = new Cache({ filesDir: dir }, probe);
    const measured = await disk.readPolicy();
    assert.notEqual(measured.capacityBytes % (1024 * 1024), 0);
    const saved = await disk.configurePolicy({ ...measured, expiryDays: 19 });
    assert.equal(saved.capacityBytes, measured.capacityBytes); assert.equal(saved.expiryDays, 19);
    assert.equal(JSON.parse(await fs.readFile(join(dir, 'reader-offline/storage-policy.json'), 'utf8')).limitMb, undefined,
      'current automatic limit remains automatic, not silently pinned to the current device bytes');
    const restored = await new Cache({ filesDir: dir }, probe).readPolicy();
    assert.deepEqual(restored, saved);
    await assert.rejects(disk.configurePolicy({ ...saved, capacityBytes: saved.capacityBytes - 1 }), /POLICY_INVALID/);
    disk.close();
  }
}
}finally{rejectUnlink=()=>false;beforeUnlink=async()=>{};beforeSync=async()=>{};for(const handle of handles.values())await handle.close().catch(()=>{});await fs.rm(root,{recursive:true,force:true});}
}
const definitions={"inventory-ownership": "inventory-ownership actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-migration": "legacy-migration actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-flush": "legacy-flush actual scoped owner/gateway/storage path; controlled Core/OS ports", "bounded-cleanup": "bounded-cleanup actual scoped owner/gateway/storage path; controlled Core/OS ports", "late-protection": "late-protection actual scoped owner/gateway/storage path; controlled Core/OS ports", "unlink-retry": "unlink-retry actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown-alias": "unknown-alias actual scoped owner/gateway/storage path; controlled Core/OS ports", "settings-text": "settings-text actual scoped owner/gateway/storage path; controlled Core/OS ports", "settings-unknown": "settings-unknown actual scoped owner/gateway/storage path; controlled Core/OS ports", "settings-local-flush": "settings-local-flush actual scoped owner/gateway/storage path; controlled Core/OS ports", "settings-nonexecution": "settings-nonexecution actual scoped owner/gateway/storage path; controlled Core/OS ports", "settings-partial-ack": "settings-partial-ack actual scoped owner/gateway/storage path; controlled Core/OS ports", "automatic-policy": "automatic-policy actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
