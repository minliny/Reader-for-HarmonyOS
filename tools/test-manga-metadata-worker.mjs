import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMangaAtomicPayloadReaderFixture } from './lib/manga-atomic-payload-probe.mjs';

const handles = new Map(), callerReads = [], workerReads = [], admissions = [], lists = [], stats = [];
let executingWorker = false;
const hooks = {
  async beforeExecute(args) { executingWorker = true; },
  async afterExecute() { executingWorker = false; },
  onAdmission(args) { admissions.push(args[0]); },
};
const io = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  access: path => fs.access(path).then(() => true, () => false),
  stat: async path => {
    stats.push(path);
    const value = await fs.stat(path, { bigint: true });
    return { size: Number(value.size), ino: value.ino, mtimeNs: value.mtimeNs, ctimeNs: value.ctimeNs,
      isFile: () => value.isFile(), isDirectory: () => value.isDirectory() };
  },
  mkdir: (path, recursive) => fs.mkdir(path, { recursive }), listFile: path => {lists.push(path);return fs.readdir(path);}, rmdir: path => fs.rmdir(path),
  unlink: path => fs.unlink(path), rename: (a,b) => fs.rename(a,b),
  open: async path => { const handle = await fs.open(path, 'w+'); handles.set(handle.fd, handle); return handle; },
  write: async (fd, bytes) => (await handles.get(fd).write(new Uint8Array(bytes))).bytesWritten,
  fsync: async fd => handles.get(fd).sync(), close: async handle => { handles.delete(handle.fd); await handle.close(); },
  AtomicFile: class {
    constructor(path) { this.path = path; }
    readFully() {
      (executingWorker ? workerReads : callerReads).push(this.path);
      const bytes = readFileSync(this.path); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  },
};
class LRUCache {
  constructor(limit) { this.limit = limit; this.values = new Map(); }
  get(key) { return this.values.get(key); }
  put(key, value) { this.values.delete(key); this.values.set(key,value); if(this.values.size > this.limit)this.values.delete(this.values.keys().next().value); }
  remove(key) { this.values.delete(key); } keys() { return [...this.values.keys()]; } clear() { this.values.clear(); }
}
const util = { LRUCache, TextEncoder: class { encodeInto(text) { return new TextEncoder().encode(text); } },
  TextDecoder: Object.assign(class { decodeWithStream(bytes) { return new TextDecoder().decode(bytes); } },
    { create: (_,options) => ({ decodeToString: bytes => new TextDecoder('utf-8',options).decode(bytes) }) }) };
const cryptoFramework = { createMd: () => { const hash = createHash('sha256'); return {
  update: async ({data}) => { hash.update(data); }, digest: async () => ({data:hash.digest()}) }; } };
const readMangaAtomicPayload = createMangaAtomicPayloadReaderFixture(io,hooks);
function load(name, dependencies) {
  const source = readFileSync(new URL(`../entry/src/main/ets/app/${name}.ts`,import.meta.url),'utf8')
    .replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
  return new Function(...Object.keys(dependencies),`${stripTypeScriptTypes(source)}\nreturn ${name}`)(...Object.values(dependencies));
}
class MaterializationError extends Error { constructor(kind,message) { super(message); this.kind=kind; } }
const Disk = load('ReadingImageDiskCache',{fileIo:io,util,cryptoFramework,readMangaAtomicPayload,
  statfs:{ getFreeSize:async()=>8*1024**3 },canonicalReadingImageBaseUrl:()=>undefined,
  assertReadingOfflineWriteCapacity:()=>{},ReadingOfflineMaterializationError:MaterializationError});
const Retention = load('MangaDisplayRetention',{fs:io,util,readMangaAtomicPayload});
const hash = async bytes => createHash('sha256').update(bytes).digest('hex');
const directory = await fs.mkdtemp(join(tmpdir(),'reader-manga-metadata-worker-'));
try {
  const chapter = {sourceId:'s',bookId:'b',chapterId:'chapter',chapterIndex:0,contentVersion:'v1',mangaDecodeRevision:'identity-v1'};
  const image = {...chapter,imageUrl:'https://image.test/0',resourceRef:`manga:mp1:${'a'.repeat(64)}`};
  const owner = {sourceId:'s',bookId:'b',chapterId:'chapter',contentVersion:'v1'};
  const authority = { classify:async()=> 'download', pending:async()=>[], candidates:async()=>[] };
  const disk = new Disk({filesDir:directory}); disk.setMangaStorageAuthority(authority);
  const bytes = new Uint8Array([1,2,3,4]); await disk.storeResource(image,bytes); await disk.markChapterComplete(chapter,[image]);
  const displayDirectory=join(directory,'display'); await fs.mkdir(displayDirectory);
  const display=new Retention(displayDirectory,hash,()=>false), key=await display.key(owner,'digest');
  const path=join(displayDirectory,`reading-body-manga-${key}-600x800.png`);await fs.writeFile(path,bytes);
  const payload={fileUri:`file://${path}`,width:600,height:800,intrinsicWidth:600,intrinsicHeight:800,revision:'meta'};
  await display.store(key,owner,payload,()=>true);
  callerReads.length=0;workerReads.length=0;
  const coldDisplay=new Retention(displayDirectory,hash,()=>false);
  disk.setMangaExternalStorage({inventory:()=>coldDisplay.inventory(),remove:async()=>false});
  await disk.mangaStorageUsage();assert.equal(await disk.isChapterComplete(chapter),true);assert.deepEqual(await disk.loadResource(image),bytes);
  assert.equal(callerReads.length,0,`manga metadata must not perform caller-thread AtomicFile reads: ${callerReads.map(value=>value.split('/').at(-1))}`);
  assert.ok(workerReads.some(value=>value.endsWith('manga-identity.json')));
  assert.ok(workerReads.some(value=>value.endsWith('manifest.json')));
  assert.ok(workerReads.some(value=>value.endsWith(`manga-display-${key}.json`)));
  console.log('PASS actual original inventory, complete manifest, resource and display sidecars read only through the platform worker');

  workerReads.length=0;await disk.mangaStorageUsage();
  assert.equal(workerReads.some(value=>value.endsWith(`manga-display-${key}.json`)),false,'unchanged display records reuse the existing platform metadata LRU');
  const sidecar=join(displayDirectory,`manga-display-${key}.json`),oldSidecar=await fs.readFile(sidecar);
  await fs.writeFile(sidecar,new Uint8Array(oldSidecar.byteLength));
  assert.ok((await coldDisplay.inventory()).every(file=>file.owners.length===0),'same-size damaged metadata cannot reuse its earlier owned fingerprint');
  await fs.writeFile(sidecar,oldSidecar);await coldDisplay.inventory();
  console.log('PASS repeated inventory reuses unchanged display proof while same-size sidecar damage invalidates ownership');

  const capture=[];
  for(let count=0;count<2;count++) {
    lists.length=0;stats.length=0;workerReads.length=0;
    const reservation=await disk.reserveExternalWrite(owner,1,'foreground','derived');reservation.release();
    capture.push({directoryListings:lists.length,fileStats:stats.length,metadataReads:workerReads.filter(path=>path.endsWith('.json')).length});
  }
  const unknown=join(disk.rootDirectory(),'unowned-history');await fs.mkdir(unknown);
  for(let index=0;index<128;index++)await fs.writeFile(join(unknown,`${index}.bin`),new Uint8Array([index]));
  lists.length=0;stats.length=0;workerReads.length=0;
  const larger=await disk.reserveExternalWrite(owner,1,'foreground','derived');larger.release();
  const grown={directoryListings:lists.length,fileStats:stats.length,metadataReads:workerReads.filter(path=>path.endsWith('.json')).length};
  assert.ok(grown.fileStats>=capture[0].fileStats+128,'quota still uses actual physical inventory; no unmeasured fast path exempts unknown files');
  console.log(JSON.stringify({boundary:'quota still measures actual inventory each admission; metadata move does not remove directory/stat O(n)',actualProductionAdmissions:capture,with128AdditionalUnknownFiles:grown}));

  let entered, release;
  const held = new Promise(resolve=>{release=resolve;}), atRead=new Promise(resolve=>{entered=resolve;});
  hooks.beforeExecute=async args=>{ if(args[0]===path){entered();await held;} executingWorker=true; };
  const reading=readMangaAtomicPayload(path,bytes.byteLength,32*1024**2,()=>true);
  await atRead;
  let timer;
  try {
    await Promise.race([disk.mangaStorageUsage(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('metadata inventory waits behind held foreground payload')),500);})]);
    assert.ok(admissions.some(value=>value.endsWith('manga-identity.json')));
  } finally { clearTimeout(timer);release();await reading; }
  console.log('PASS metadata inventory completes while the independent foreground AtomicFile lane is held');

  await fs.writeFile(sidecar,new Uint8Array(65537));
  const before=admissions.length;
  assert.deepEqual(await new Retention(displayDirectory,hash,()=>false).inventory(),[
    {path:sidecar,owners:[],live:false},{path,owners:[],live:false},
  ].sort((a,b)=>a.path.localeCompare(b.path)));
  assert.equal(admissions.slice(before).includes(sidecar),false,'oversize metadata is rejected before worker allocation');
  console.log('PASS oversized display sidecar remains unowned, counted conservatively, and rejected before native read');
} finally { await fs.rm(directory,{recursive:true,force:true}); }
