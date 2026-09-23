import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
const source = name => stripTypeScriptTypes(readFileSync(new URL(`../entry/src/main/ets/app/${name}.ts`, import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const root = await fs.mkdtemp(join(tmpdir(), 'reader-epub-reuse-'));
const stats = { archiveReads: 0, decodes: 0, writes: 0 };
let dataUriDecodeCalls = 0;
const handles = new Map();
let readGate, nextReadError, unlinkGate;
const io = {
  OpenMode: { CREATE: 1, READ_WRITE: 2, TRUNC: 4 },
  access: async path => path.endsWith('.source') || await fs.access(path).then(() => true, () => false),
  mkdir: (path, recursive) => fs.mkdir(path, { recursive }), listFile: path => fs.readdir(path),
  stat: path => fs.stat(path), rename: (from, to) => fs.rename(from, to),
  unlink: async path => { if (unlinkGate) await unlinkGate.promise; await fs.unlink(path); },
  open: async path => { stats.writes++; const handle = await fs.open(path, 'w+'); handles.set(handle.fd, handle); return handle; },
  write: async (fd, bytes) => (await handles.get(fd).write(new Uint8Array(bytes))).bytesWritten,
  fsync: async () => { throw new Error('disposable display derivatives must not wait for a durability barrier'); },
  close: async file => { handles.delete(file.fd); await file.close(); },
};
const util = { TextDecoder: { create: () => ({ decodeToString: bytes => new TextDecoder().decode(bytes) }) },
  Base64Helper: class { decodeSync(text) { dataUriDecodeCalls++; return new Uint8Array(Buffer.from(text, 'base64url')); } }, Type: { BASIC_URL_SAFE: 1, MIME: 2 } };
const crypto = { createMd: () => { const hash = createHash('sha256'); return {
  update: async ({ data }) => { hash.update(data); }, digest: async () => ({ data: hash.digest() }),
}; } };
const image = { createImageSource: () => ({
  getImageInfo: async () => ({ size: { width: 120, height: 180 } }),
  createPixelMap: async () => { stats.decodes++; return { getImageInfo: async () => ({ size: { width: 120, height: 180 } }), release() {} }; }, release() {},
}) };
const ImageHost = new Function('image', 'util', 'fs', 'cryptoFramework', `${source('ReadingBodyImageHost')}\nreturn ReadingBodyImageHost;`)(image, util, io, crypto);
const read = async () => { stats.archiveReads++; if (readGate) await readGate.promise; if (nextReadError) { const error=nextReadError;nextReadError=undefined;throw error; }
  return new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]); };
const ResourceHost = new Function('fileIo', 'util', 'readLocalEpubEntryAsync', 'ReadingBodyImageHost', `${source('LocalEpubResourceHost')}\nreturn LocalEpubResourceHost;`)(io, util, read, ImageHost);
const host = new ResourceHost({ filesDir: root });
const display = ImageHost.instance;
ImageHost.setDisplayCacheDir(root);
await new Promise(resolve => setTimeout(resolve, 20));
const locator = path => `reader-local-epub://${Buffer.from('local:'+'a'.repeat(64)).toString('base64url')}/${Buffer.from(path).toString('base64url')}`;
const ref = locator('OPS/Images/one.png');
const deferred = () => { let resolve; const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve}; };
try {
  const first = await host.load(ref);
  const second = await host.load(ref);
  assert.deepEqual(stats, { archiveReads: 1, decodes: 1, writes: 1 }, 'same live EPUB resource must reuse one archive read, decode and display write');
  assert.equal(first.fileUri, second.fileUri);
  display.release(first.fileUri);
  assert.ok(await io.access(second.fileUri.slice(7)), 'one owner release must preserve the other page');
  const third = await host.load(ref);
  assert.equal(stats.decodes,1);
  display.release(second.fileUri); display.release(third.fileUri);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(await fs.access(first.fileUri.slice(7)).then(()=>true,()=>false),false);

  readGate=deferred(); let current=true;
  const cancelled=host.load(ref,()=>current), cancelledResult=assert.rejects(cancelled,/cancelled/);
  const live=host.load(ref,()=>true);current=false;readGate.resolve();readGate=undefined;
  await cancelledResult; const fourth=await live;
  assert.deepEqual(stats,{archiveReads:2,decodes:2,writes:2},'cancelled borrower must not abort a live borrower or duplicate work');
  display.release(fourth.fileUri);
  await new Promise(resolve=>setTimeout(resolve,10));

  nextReadError=new Error('broken archive');
  await assert.rejects(host.load(ref),/broken archive/);
  const retried=await host.load(ref);
  assert.equal(stats.archiveReads,4,'failed acquisition must not poison later reads');

  // Last-owner release can race a new acquisition of the same display path.
  unlinkGate=deferred();display.release(retried.fileUri);
  const reacquire=host.load(ref);await new Promise(resolve=>setTimeout(resolve,10));
  unlinkGate.resolve();unlinkGate=undefined;
  const retained=await reacquire;
  assert.ok(await io.access(retained.fileUri.slice(7)));
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(await io.access(retained.fileUri.slice(7)),'old unlink cannot delete a new display file');
  display.release(retained.fileUri);
  await new Promise(resolve=>setTimeout(resolve,10));

  readGate=deferred();let bothCurrent=true;
  const bothA=host.load(ref,()=>bothCurrent),bothB=host.load(ref,()=>bothCurrent);
  const rejectedA=assert.rejects(bothA,/cancelled/),rejectedB=assert.rejects(bothB,/cancelled/);
  const beforeCancelDecode=stats.decodes;bothCurrent=false;readGate.resolve();readGate=undefined;
  await Promise.all([rejectedA,rejectedB]);
  assert.equal(stats.decodes,beforeCancelDecode,'all cancelled borrowers must stop before native decode');
  assert.equal(display.resourceReads.size,0);

  readGate=deferred();const closing=host.load(ref);const closed=assert.rejects(closing,/cancelled/);
  display.releaseAllDisplayFiles();readGate.resolve();readGate=undefined;await closed;
  assert.equal(display.displayFileReferences.size,0,'teardown cancels outstanding image admission');
  assert.equal(display.resourcePayloads.size,0,'only live session resources may remain');
  const priorLocatorDecodeCalls=dataUriDecodeCalls;
  await assert.rejects(host.load(locator('x'.repeat(1024 * 1024))), /locator exceeds its path limit/);
  assert.equal(dataUriDecodeCalls,priorLocatorDecodeCalls,
    'oversized EPUB image locator must be rejected before synchronous Base64 decode');
  const priorDataUriDecodeCalls=dataUriDecodeCalls;
  await assert.rejects(display.loadDataUri(`data:image/png;base64,${'A'.repeat(23 * 1024 * 1024)}`),
    /data URI exceeds 16777216 byte limit/);
  assert.equal(dataUriDecodeCalls,priorDataUriDecodeCalls,
    'oversized source-controlled data URI must be rejected before synchronous Base64 decode');
  const dataUriPayload=await display.loadDataUri(`data:image/png;base64,${Buffer.from([1,2,3]).toString('base64')}`);
  assert.equal(dataUriDecodeCalls,priorDataUriDecodeCalls+1,'admitted data URI still reaches the image decoder');
  display.release(dataUriPayload.fileUri);
  console.log(JSON.stringify({result:'PASS',stats,checks:7}));
} finally {display.releaseAllDisplayFiles();await new Promise(resolve=>setTimeout(resolve,20));await fs.rm(root,{recursive:true,force:true});}
