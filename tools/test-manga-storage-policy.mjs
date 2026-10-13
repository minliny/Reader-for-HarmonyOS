import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { createMangaAtomicPayloadReaderFixture } from './lib/manga-atomic-payload-probe.mjs';

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
const util = {
  LRUCache: class { constructor(capacity){this.capacity=capacity;this.items=new Map();} get(k){return this.items.get(k);} put(k,v){this.items.delete(k);this.items.set(k,v);if(this.items.size>this.capacity)this.items.delete(this.items.keys().next().value);} remove(k){this.items.delete(k);} keys(){return [...this.items.keys()];} clear(){this.items.clear();} },
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
const root = await fs.mkdtemp(join(tmpdir(),'reader-manga-storage-policy-'));
const checks=[];const pass=name=>checks.push(name);
const key=c=>JSON.stringify([c.sourceId,c.bookId,c.chapterId,c.contentVersion]);
const owner=c=>({sourceId:c.sourceId,bookId:c.bookId,chapterId:c.chapterId,contentVersion:c.contentVersion});
const chapter=(id,book='manga',version='v1')=>({sourceId:'source',bookId:book,chapterId:`https://chapter/${id}`,chapterIndex:1,contentVersion:version,mangaDecodeRevision:'identity-v1'});
const image=c=>({...c,imageUrl:'https://cdn/temporary-token',resourceRef:`manga:mp1:${createHash('sha256').update(c.chapterId).digest('hex')}`});
const bytes=new Uint8Array([1,2,3,4]);
function authority(defaultClass='cache') {
  const classes=new Map(),chapters=new Map(),pending=new Map(),claims=[],completed=[];let serial=0;let beforeClaim=async()=>{};
  return {classes,chapters,pendingGrants:pending,claims,completed,setBeforeClaim(fn){beforeClaim=fn;},
    register(c,classification=defaultClass){classes.set(key(c),classification);chapters.set(key(c),owner(c));},
    async classify(c){return classes.get(key(c))??defaultClass;},
    async candidates(reason,scope){return [...chapters.values()].filter(c=>!scope||(c.sourceId===scope.sourceId&&c.bookId===scope.bookId));},
    async claim(c){await beforeClaim(c);if(await this.classify(c)!=='cache')return undefined;const grant={...owner(c),grantToken:`g${++serial}`};pending.set(grant.grantToken,grant);claims.push(grant);return grant;},
    async complete(grant,removed){completed.push({grant,removed});if(removed){pending.delete(grant.grantToken);classes.set(key(grant),'missing');chapters.delete(key(grant));}},
    async pending(){return [...pending.values()];},
  };
}
async function fixture(name,freeBytes=8*1024**3,totalBytes=undefined) {const dir=join(root,name);await fs.mkdir(dir);const a=authority();let free=freeBytes;
  const probe={getFreeBytes:async()=>free};if(totalBytes!==undefined)probe.getTotalBytes=async()=>totalBytes;
  const cache=new Cache({filesDir:dir},probe);cache.setMangaStorageAuthority(a);return{dir,a,cache,setFree:value=>{free=value;},setTotal:value=>{totalBytes=value;}};
}
async function seed(cache,a,c,classification='cache'){a.register(c,classification);const i=image(c);await cache.storeResource(i,bytes);await cache.markChapterComplete(c,[i]);return i;}
async function exists(path){return fs.access(path).then(()=>true,()=>false);}
async function sparse(path,size){await fs.mkdir(dirname(path),{recursive:true});const h=await fs.open(path,'w');try{await h.truncate(size);}finally{await h.close();}}
async function deadline(work){let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('policy deadlock')),2000);})]);}finally{clearTimeout(timer);}}
function policies(a,facts=new Map()) {a.policy=async c=>({status:await a.classify(c),inUse:false,lastReadAt:null,...facts.get(key(c))});return facts;}
async function derivedFile(dir,c,name,size=4){const path=join(dir,'display',name);await sparse(path,size);return{path,owners:[owner(c)],live:false};}
function derivedStorage(cache,files,events=[],beforeRemove=async()=>{}) {
  cache.setMangaExternalStorage({inventory:async()=>files,remove:async()=>{throw Error('download trim must not use an original eviction grant');},
    removeDerived:async(c,selected,current)=>{events.push(c.chapterId);await beforeRemove(c,selected,current);
      for(const f of selected){if(!(await current())||f.live)return false;if(await exists(f.path))await io.unlink(f.path);}return true;}});
}
try {
  {
    const {dir,a,cache}=await fixture('identity');const c=chapter('A');const i=await seed(cache,a,c);
    const shifted={...c,chapterIndex:87}, shiftedImage={...i,chapterIndex:87,imageUrl:'manga:opaque'};
    assert.equal(await cache.chapterDirectory(shifted),await cache.chapterDirectory(c));
    assert.equal(await cache.isChapterComplete(shifted),true);assert.deepEqual(await cache.loadResource(shiftedImage),bytes);
    const cold=new Cache({filesDir:dir});cold.setMangaStorageAuthority(a);
    assert.equal(await cold.isChapterComplete(shifted),true);assert.deepEqual(await cold.loadResource(shiftedImage),bytes);
    const path=await cache.resourcePath(i);await fs.writeFile(path,new Uint8Array([8,2,3,4]));
    await assert.rejects(cold.loadResource(i),/MANGA_CACHE_RESOURCE_CORRUPT/);assert.equal(await cold.isChapterComplete(c),false);
    await cache.storeResource(i,bytes);assert.equal(await cache.isChapterComplete(c),true);
    assert.equal(await cache.loadResource({...i,contentVersion:'another-version'}),undefined);
    pass('stable chapter ID survives ordinal movement and cold entry; exact version and same-size digest corruption remain isolated');
  }
  {
    const {a,cache}=await fixture('migration');const c=chapter('legacy'),i=image(c);a.register(c);
    const old={...i,chapterId:undefined};await cache.storeResource(old,bytes);await cache.markChapterComplete(old,[old]);
    assert.equal(await cache.isChapterComplete(c),true);assert.deepEqual(await deadline(cache.loadResource(i)),bytes);
    assert.equal(await exists(await cache.resourcePath(i)),true);assert.notEqual(await cache.resourcePath(i),await cache.resourcePath(old));
    const wrong={...c,chapterId:'other-stable-id',chapterIndex:2};assert.equal(await cache.loadResource(image(wrong)),undefined);
    assert.equal(await cache.loadResource({...i,contentVersion:'v2'}),undefined);
    const unknownBytes=await cache.resourcePath(old);await cache.clearBook(c.sourceId,c.bookId,true);
    assert.equal(await exists(unknownBytes),true,'unknown old ordinal content is not deleted using the new candidate');
    pass('old ordinal migration requires the exact version, manifest and resource hash; unknown history remains protected');
  }
  {
    const {a,cache}=await fixture('retention');const images=new Map();
    for(const classification of ['cache','download','protected','unknown','missing']){
      const c=chapter(classification);images.set(classification,await seed(cache,a,c,classification));
    }
    const retained=images.get('cache'),release=cache.pinMangaChapter(owner(retained));
    await cache.clearBook('source','manga',true);assert.equal(a.claims.length,0);release();
    await cache.clearBook('source','manga',true);assert.equal(a.claims.length,1);assert.equal(await exists(await cache.resourcePath(retained)),false);
    for(const classification of ['download','protected','unknown','missing'])assert.deepEqual(await cache.loadResource(images.get(classification)),bytes);
    const novel={sourceId:'source',bookId:'novel',chapterIndex:1,contentVersion:'v1',imageUrl:'https://novel/image'};
    await cache.storeResource(novel,bytes);await cache.markChapterComplete(novel,[novel]);await cache.clearBook('source','novel');
    assert.equal(await cache.loadResource(novel),undefined);
    pass('ordinary clear preserves download, session, unknown, missing and live chapters; novel clear still removes its own data');
  }
  {
    const {a,cache}=await fixture('grants');const c=chapter('A'),i=await seed(cache,a,c);const path=await cache.resourcePath(i);
    let pinRejected=false,writeRejected=false;
    a.setBeforeClaim(async candidate=>{assert.equal(key(candidate),key(c));assert.throws(()=>cache.pinMangaChapter(candidate),/MANGA_CACHE_EVICTING/);pinRejected=true;});
    rejectUnlink=p=>p===path;await cache.maintainMangaStorage('clear');rejectUnlink=()=>false;
    assert.equal(a.pendingGrants.size,1);assert.equal(await exists(path),true);
    assert.equal(await exists(join(await cache.chapterDirectory(c),'manga-identity.json')),true,'a failed delete preserves identity for retry');
    await assert.rejects(cache.storeResource(i,bytes),/MANGA_CACHE_EVICTING/);writeRejected=true;
    assert.ok(pinRejected&&writeRejected);await cache.maintainMangaStorage('clear');
    assert.equal(a.pendingGrants.size,0);assert.equal(await exists(path),false);
    assert.deepEqual(a.completed.map(c=>c.removed),[false,true]);
    pass('claim blocks new pins/writes, physical failure remains pending, and retry removes exact bytes before acknowledgement');
  }
  {
    const {dir,a,cache}=await fixture('inventory');const c=chapter('derived'),i=await seed(cache,a,c);
    const path=join(dir,'derived','page.bin'),alias=join(dir,'derived','alias.bin');await fs.mkdir(dirname(path));await fs.writeFile(path,new Uint8Array(123));await fs.link(path,alias);
    const external=[{path,owners:[owner(c)],live:false},{path:alias,owners:[owner(c)],live:false}];
    cache.setMangaExternalStorage({inventory:async()=>external,remove:async(_,files)=>{for(const f of files)if(await exists(f.path))await fs.unlink(f.path);return true;}});
    const internal=await cache.mangaInventory();const expected=new Map();for(const f of internal)expected.set(f.physicalKey,f.size);
    assert.equal((await cache.mangaStorageUsage()).ordinaryBytes,[...expected.values()].reduce((a,b)=>a+b,0));
    assert.equal(internal.filter(f=>f.external).length,2);assert.equal(expected.get(internal.find(f=>f.path===path).physicalKey),123);
    const temp=`${await cache.resourcePath(i)}.tmp-crash`;await fs.writeFile(temp,new Uint8Array(29));
    assert.equal((await cache.mangaStorageUsage()).ordinaryBytes,[...expected.values()].reduce((a,b)=>a+b,0)+29);
    const download=chapter('download-alias');a.register(download,'download');external[1].owners=[owner(download)];
    const before=await cache.mangaStorageUsage();assert.equal(before.ordinaryBytes,[...expected.values()].reduce((a,b)=>a+b,0)+29,'a downloaded display consumer does not exempt derived cache bytes');
    await cache.maintainMangaStorage('clear');assert.equal(await exists(path),true);assert.equal(await exists(await cache.resourcePath(i)),true,'a physical file with a retained second consumer protects the whole exact chapter transaction');
    external[1].owners=[owner(c)];await cache.maintainMangaStorage('clear');assert.equal(await exists(path),false);assert.equal(await exists(temp),false);
    pass('original, derived, manifest and crash-temp bytes are counted; one physical inode is counted once and retained consumers prevent deletion');
  }
  {
    const {dir,a,cache,setFree}=await fixture('download-derived-quota');const c=chapter('permanent');const i=await seed(cache,a,c,'download');
    assert.equal((await cache.mangaStorageUsage()).ordinaryBytes,0,'permanent originals and their manifest are outside ordinary cache');
    const originalExtra=join(await cache.chapterDirectory(c),'permanent-content.bin');await sparse(originalExtra,10*1024**3+1);
    const derived=join(dir,'display','downloaded-derived.bin');await sparse(derived,10*1024**3-32*1024**2);
    cache.setMangaExternalStorage({inventory:async()=>[{path:derived,owners:[owner(c)],live:false}],remove:async()=>{throw Error('download originals cannot grant ordinary eviction');}});
    assert.equal((await cache.mangaStorageUsage()).ordinaryBytes,10*1024**3-32*1024**2);
    await assert.rejects(cache.reserveExternalWrite(owner(c),1,'background','derived'),/MANGA_CACHE_STORAGE_FULL/);
    const original=await cache.reserveExternalWrite(owner(c),2*1024**2,'foreground');
    const foreground=await cache.reserveExternalWrite(owner(c),32*1024**2,'foreground','derived');
    await assert.rejects(cache.reserveExternalWrite(owner(c),1,'foreground','derived'),/MANGA_CACHE_STORAGE_FULL/);
    assert.equal((await cache.mangaStorageUsage()).reservedBytes,34*1024**2);foreground.release();original.release();
    await assert.rejects(cache.reserveExternalWrite(owner(c),32*1024**2+1,'foreground','derived'),/MANGA_CACHE_STORAGE_FULL/);
    const saved=await cache.reserveExternalWrite(owner(c),32*1024**2+1,'foreground','original');saved.release();
    assert.equal(a.claims.length,0,'derived pressure cannot evict downloaded originals');
    setFree(512*1024**2+2*1024**2);const free=await cache.reserveExternalWrite(owner(c),2*1024**2,'foreground','original');
    await assert.rejects(cache.reserveExternalWrite(owner(c),1,'foreground','original'),/MANGA_CACHE_STORAGE_FULL/);free.release();
    setFree(512*1024**2);await assert.rejects(cache.reserveExternalWrite(owner(c),1,'foreground','original'),/MANGA_CACHE_STORAGE_FULL/);
    assert.equal(await exists(await cache.resourcePath(i)),true);assert.equal(await exists(originalExtra),true);
    pass('download originals remain permanent outside ordinary quota but obey 512MiB free space; all downloaded derivatives obey 10GiB, foreground reserve and concurrent budgets');
  }
  {
    const {dir,a,cache}=await fixture('original-derived-shared-inode');const c=chapter('permanent'),i=await seed(cache,a,c,'download');
    const alias=join(dir,'display','original-alias.bin'),derived=join(dir,'display','derived.bin');await fs.mkdir(dirname(alias),{recursive:true});
    await fs.link(await cache.resourcePath(i),alias);await fs.writeFile(derived,new Uint8Array(123));
    cache.setMangaExternalStorage({inventory:async()=>[{path:alias,owners:[owner(c)],live:false},{path:derived,owners:[owner(c)],live:false}],remove:async()=>false});
    assert.equal((await cache.mangaStorageUsage()).ordinaryBytes,123,'one physical file shared with an actual permanent original is excluded once; independent derived bytes count');
    pass('actual original/derived inode sharing honors permanent original ownership without exempting independent display files');
  }
  {
    const {dir,a,cache}=await fixture('unused-derived-classification');const c=chapter('derived-only');a.register(c,'download');
    const file=await derivedFile(dir,c,'page.bin',123);derivedStorage(cache,[file]);
    const requests=[],classify=a.classify;a.classify=async selected=>{requests.push(key(selected));return classify.call(a,selected);};
    const reservation=await cache.reserveExternalWrite(owner(c),128,'foreground','derived');
    const derivedReservation=requests.splice(0);
    const usage=await cache.mangaStorageUsage(),derivedInventory=requests.splice(0);
    assert.deepEqual(usage,{ordinaryBytes:123,reservedBytes:128},'derived-only bytes and concurrent reservation remain ordinary despite download ownership');
    reservation.release();
    const original=await cache.reserveExternalWrite(owner(c),25,'foreground','original');
    const originalReservation=requests.splice(0);original.release();

    const mixed=await fixture('mixed-original-derived-classification');const permanent=chapter('permanent'),ordinary=chapter('ordinary'),externalOnly=chapter('external-only');
    const permanentImage=await seed(mixed.cache,mixed.a,permanent,'download');await seed(mixed.cache,mixed.a,ordinary);
    const before=(await mixed.cache.mangaStorageUsage()).ordinaryBytes;mixed.a.register(externalOnly,'download');
    const alias=join(mixed.dir,'display','original-alias.bin');await fs.mkdir(dirname(alias),{recursive:true});await fs.link(await mixed.cache.resourcePath(permanentImage),alias);
    const independent=await derivedFile(mixed.dir,permanent,'independent.bin',123),external=await derivedFile(mixed.dir,externalOnly,'external-only.bin',71);
    derivedStorage(mixed.cache,[{path:alias,owners:[owner(permanent)],live:false},independent,external]);
    const mixedRequests=[],mixedClassify=mixed.a.classify;mixed.a.classify=async selected=>{mixedRequests.push(key(selected));return mixedClassify.call(mixed.a,selected);};
    assert.equal((await mixed.cache.mangaStorageUsage()).ordinaryBytes,before+194,'permanent original inode alias stays exempt, cached originals and independent derivatives count');
    assert.deepEqual({derivedReservation,derivedInventory,originalReservation,mixedInventory:mixedRequests.sort()},
      {derivedReservation:[],derivedInventory:[],originalReservation:[key(c)],mixedInventory:[key(permanent),key(ordinary)].sort()},
      'budget RPCs classify original consumers once per inventory; derived reservation and derived-only consumers need no unused authority read');
    assert.equal((await cache.mangaStorageUsage()).reservedBytes,0);
    pass('derived budget admission skips unused classify RPCs while mixed original ownership and physical inode accounting remain exact');
  }
  {
    const {dir,a,cache}=await fixture('quota');const c=chapter('new');a.register(c);
    const historical=join(dir,'external','unknown-history.bin');await sparse(historical,10*1024**3-32*1024**2);
    cache.setMangaExternalStorage({inventory:async()=>[{path:historical,owners:[],live:false}],remove:async()=>{throw Error('unknown file must not be removed');}});
    await assert.rejects(cache.reserveExternalWrite(owner(c),1,'background'),/MANGA_CACHE_STORAGE_FULL/);
    const foreground=await cache.reserveExternalWrite(owner(c),32*1024**2,'foreground');
    assert.equal((await cache.mangaStorageUsage()).reservedBytes,32*1024**2);
    await assert.rejects(cache.reserveExternalWrite(owner(chapter('parallel')),1,'foreground'),/MANGA_CACHE_STORAGE_FULL/);
    foreground.release();foreground.release();assert.equal((await cache.mangaStorageUsage()).reservedBytes,0);
    await assert.rejects(cache.reserveExternalWrite(owner(c),32*1024**2+1,'foreground'),/MANGA_CACHE_STORAGE_FULL/);
    assert.equal(await exists(historical),true);
    pass('real 10GiB byte quota includes derived files and concurrent reservations; background leaves 32MiB for foreground');
  }
  {
    // A total-size aware probe derives a small-VM budget and keeps the two
    // ordinary buckets separate.  The explicit cleanup entry can reclaim only
    // rebuildable display bytes; the permanent original remains untouched.
    const total=512*1024**2,free=total-8*1024**2;const {dir,a,cache}=await fixture('dynamic-capacity',free,total);
    const capacity=await cache.mangaStorageCapacity();
    assert.equal(capacity.totalBytes,total);assert.equal(capacity.systemReserveBytes,64*1024**2);
    assert.equal(capacity.cacheBudgetBytes,total-capacity.systemReserveBytes);
    assert.equal(capacity.originalBudgetBytes+capacity.derivedBudgetBytes,capacity.cacheBudgetBytes);
    assert.ok(capacity.cacheBudgetBytes<10*1024**3);assert.ok(capacity.derivedBudgetBytes>capacity.originalBudgetBytes);
    const c=chapter('dynamic-derived');a.register(c,'download');policies(a);
    const file=await derivedFile(dir,c,'large.bin',capacity.derivedBudgetBytes-1024);const files=[file];const events=[];derivedStorage(cache,files,events);
    let full;try{await cache.reserveExternalWrite(owner(c),2048,'foreground','derived');}catch(error){full=error;}
    assert.equal(full?.code,'storage_full');assert.equal(full?.message,'MANGA_CACHE_STORAGE_FULL');
    const original=await seed(cache,a,chapter('permanent-dynamic'),'download');
    await cache.clearMangaDerivedCache();assert.deepEqual(events,[c.chapterId]);assert.equal(await exists(file.path),false);
    assert.equal(await exists(await cache.resourcePath(original)),true,'derived cleanup never removes permanent original bytes');
    const retry=await cache.reserveExternalWrite(owner(c),2048,'foreground','derived');retry.release();
    pass('total-size probe derives small-VM original/derived budgets; storage_full/MANGA_CACHE_STORAGE_FULL is observable and derived-only cleanup restores admission without touching downloads');
  }
  {
    const {a,cache,setFree}=await fixture('free',512*1024**2+48*1024**2);const c=chapter('A');a.register(c);
    await assert.rejects(cache.reserveExternalWrite(owner(c),32*1024**2,'background'),/MANGA_CACHE_STORAGE_FULL/);
    const first=await cache.reserveExternalWrite(owner(c),32*1024**2,'foreground');
    await assert.rejects(cache.reserveExternalWrite(owner(chapter('B')),32*1024**2,'foreground'),/MANGA_CACHE_STORAGE_FULL/);
    first.release();const after=await cache.reserveExternalWrite(owner(chapter('B')),32*1024**2,'foreground');after.release();
    setFree(32*1024**2);const novel={sourceId:'source',bookId:'novel',chapterIndex:1,contentVersion:'v1',imageUrl:'https://novel/image'};
    await cache.storeResource(novel,bytes);assert.deepEqual(await cache.loadResource(novel),bytes);
    await assert.rejects(cache.storeResource(image(c),bytes),/MANGA_CACHE_STORAGE_FULL/);
    pass('512MiB free reserve subtracts in-flight admission and foreground headroom; novel retains its existing 16MiB rule');
  }
  {
    const {a,cache}=await fixture('liveness');const c=chapter('writing'),old=chapter('old'),i=image(c);a.register(c);await seed(cache,a,old);
    let entered,release;const reached=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});let once=true;
    beforeSync=async()=>{if(once){once=false;entered();await gate;}};
    const writing=cache.storeResource(i,bytes);await reached;
    await deadline(cache.maintainMangaStorage('clear'));assert.equal(a.claims.some(g=>key(g)===key(c)),false);
    release();await writing;beforeSync=async()=>{};assert.deepEqual(await cache.loadResource(i),bytes);
    const retained=cache.pinMangaChapter(owner(c));await deadline(cache.maintainMangaStorage('clear'));retained();
    assert.deepEqual(await cache.loadResource(i),bytes);assert.equal(await cache.isChapterComplete(c),false,'a partial resource never becomes a completion receipt');
    pass('write admission and book mutation do not deadlock maintenance; inflight and live partial chapters remain intact');
  }
  {
    const {dir,a,cache}=await fixture('pending-restart');const c=chapter('pending'),i=await seed(cache,a,c);
    const grant={...owner(c),grantToken:'restart-grant'};a.pendingGrants.set(grant.grantToken,grant);
    const cold=new Cache({filesDir:dir});cold.setMangaStorageAuthority(a);
    await assert.rejects(cold.reserveExternalWrite(owner(c),1),/MANGA_CACHE_EVICTING/);
    await assert.rejects(cold.loadResource(i),/MANGA_CACHE_EVICTING/);
    await cold.maintainMangaStorage('clear');assert.equal(a.pendingGrants.size,0);assert.equal(await exists(await cache.resourcePath(i)),false);
    pass('cold pending intent blocks reads/writes before admission and survives until physical cleanup acknowledgement');
  }
  {
    const {dir,a,cache}=await fixture('pressure-order');const first=chapter('first'),second=chapter('second'),next=chapter('next');
    await seed(cache,a,first);const kept=await seed(cache,a,second);a.register(next);
    const large=join(dir,'derived','large.bin');await sparse(large,10*1024**3-1024);
    cache.setMangaExternalStorage({inventory:async()=>[{path:large,owners:[owner(first)],live:false}],remove:async(_,files)=>{for(const f of files)await fs.unlink(f.path);return true;}});
    const reservation=await deadline(cache.reserveExternalWrite(owner(next),1,'background'));reservation.release();
    assert.deepEqual(a.claims.map(c=>c.chapterId),[first.chapterId]);assert.equal(await exists(large),false);assert.deepEqual(await cache.loadResource(kept),bytes);
    pass('capacity uses Core candidate order and stops when actual released bytes suffice; it never sorts or evicts the active write owner');
  }
  {
    const {a,cache}=await fixture('restore-tombstones');const c=chapter('retained'),i=await seed(cache,a,c),other=chapter('new-pending');const second=await seed(cache,a,other);
    a.chapters.delete(key(other));const stale=cache.captureValidity(c.sourceId,c.bookId);
    const path=await cache.resourcePath(i);rejectUnlink=p=>p===path;await cache.maintainMangaStorage('clear');rejectUnlink=()=>false;
    assert.equal(a.pendingGrants.size,1);await assert.rejects(cache.loadResource(i),/MANGA_CACHE_EVICTING/);
    const grant={...owner(other),grantToken:'new-restore-token'};
    const answer=await cache.withMangaStorageRestore(async()=>{a.pendingGrants.clear();a.classes.set(key(c),'download');a.pendingGrants.set(grant.grantToken,grant);return 73;});
    assert.equal(answer,73);assert.equal(stale(),false);assert.deepEqual(await cache.loadResource(i),bytes);
    await assert.rejects(cache.storeResource(i,new Uint8Array([9,9,9,9]),stale),/superseded/);assert.deepEqual(await cache.loadResource(i),bytes);
    await assert.rejects(cache.loadResource(second),/MANGA_CACHE_EVICTING/);assert.equal(cache.mangaEvicting.get(key(other)).grantToken,grant.grantToken);
    await cache.maintainMangaStorage('clear');assert.equal(await exists(await cache.resourcePath(second)),false);assert.deepEqual(await cache.loadResource(i),bytes);
    pass('same-owner restore withdraws old failed tombstones, preserves new authoritative pending tokens, and fences pre-restore callbacks');
  }
  {
    const {a,cache}=await fixture('restore-barrier');const c=chapter('A'),i=await seed(cache,a,c),path=await cache.resourcePath(i),directory=await cache.chapterDirectory(c);
    const snapshot=new Map();for(const name of await fs.readdir(directory))snapshot.set(name,await fs.readFile(join(directory,name)));
    let entered,release;const reached=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});const events=[];let held=false;
    beforeUnlink=async p=>{if(p===path&&!held){held=true;events.push('delete-entered');entered();await gate;events.push('delete-resumed');}};
    const deleting=cache.maintainMangaStorage('clear');await reached;
    let restored=false;const restoring=cache.withMangaStorageRestore(async()=>{events.push('restore');restored=true;a.pendingGrants.clear();a.classes.set(key(c),'download');
      await fs.mkdir(directory,{recursive:true});for(const[name,payload]of snapshot)await fs.writeFile(join(directory,name),payload);});
    await new Promise(r=>setImmediate(r));assert.equal(restored,false);
    await assert.rejects(cache.reserveExternalWrite(owner(c),1),/MANGA_CACHE_STORAGE_RESTORING/);assert.throws(()=>cache.pinMangaChapter(owner(c)),/MANGA_CACHE_STORAGE_RESTORING/);
    release();await deleting;await restoring;beforeUnlink=async()=>{};
    assert.deepEqual(events,['delete-entered','delete-resumed','restore']);assert.deepEqual(await cache.loadResource(i),bytes);assert.equal(await cache.isChapterComplete(c),true);
    await assert.rejects(cache.withMangaStorageRestore(async()=>{throw Error('restore rejected');}),/restore rejected/);assert.deepEqual(await cache.loadResource(i),bytes);
    pass('restore serializes behind a held physical delete, blocks admission, and reconciles authority even when its callback fails');
  }
  {
    const {dir,a,cache}=await fixture('download-version-actions');
    const completed=chapter('selected','manga','v1'),partial=chapter('selected','manga','v2'),ordinary=chapter('selected','manga','v3');
    const otherBook=chapter('selected','other-book','v1'),otherChapter=chapter('another','manga','v1');
    const kept=await seed(cache,a,completed,'download');a.register(partial,'download');const partialImage=image(partial);await cache.storeResource(partialImage,bytes);
    const ordinaryImage=await seed(cache,a,ordinary);await seed(cache,a,otherBook,'download');await seed(cache,a,otherChapter,'download');
    const derivedOnly=chapter('selected','manga','derived-only');a.register(derivedOnly,'download');const derivedPath=join(dir,'derived','selected.bin');await fs.mkdir(dirname(derivedPath),{recursive:true});await fs.writeFile(derivedPath,bytes);
    let live=false;cache.setMangaExternalStorage({inventory:async()=>[{path:derivedPath,owners:[owner(derivedOnly)],live}],remove:async(_,files)=>{for(const f of files)await fs.unlink(f.path);return true;}});
    assert.deepEqual(new Set(await cache.listMangaDownloadVersions(completed)),new Set(['v1','v2','derived-only']));
    assert.equal(await cache.isChapterComplete(partial),false,'a listed partial download is not certified complete');
    assert.equal(await cache.deleteMangaVersion(owner(completed)),false,'deletion does not implicitly release a download');
    const release=cache.pinMangaChapter(owner(ordinary));assert.equal(await cache.deleteMangaVersion(owner(ordinary)),false);release();
    assert.equal(await cache.deleteMangaVersion(owner(ordinary)),true);assert.equal(await exists(await cache.resourcePath(ordinaryImage)),false);
    a.classes.set(key(derivedOnly),'cache');live=true;assert.equal(await cache.deleteMangaVersion(owner(derivedOnly)),false);assert.equal(await exists(derivedPath),true);live=false;
    a.classes.set(key(partial),'cache');rejectUnlink=p=>p===cacheTestPath;const cacheTestPath=await cache.resourcePath(partialImage);
    assert.equal(await cache.deleteMangaVersion(owner(partial)),false);assert.equal(a.pendingGrants.size,1);assert.equal(await exists(cacheTestPath),true);rejectUnlink=()=>false;
    assert.equal(await cache.deleteMangaVersion(owner(partial)),true);assert.equal(a.pendingGrants.size,0);assert.equal(await exists(cacheTestPath),false);
    assert.deepEqual(await cache.loadResource(kept),bytes);assert.equal(await cache.deleteMangaVersion(owner(derivedOnly)),true);assert.equal(await exists(derivedPath),false);
    await assert.rejects(cache.listMangaDownloadVersions(completed,()=>false),/superseded/);
    pass('download actions list exact completed, partial and derived versions; release is separate; live files refuse deletion and failed grants retry');
  }
  {
    const {dir,a,cache}=await fixture('download-chapter-inventory');const kept=chapter('present'),partial=chapter('removed-from-catalog'),partialNew={...partial,contentVersion:'v2'};
    await seed(cache,a,kept,'download');for(const item of [partial,partialNew]){a.register(item,'download');await cache.storeResource(image(item),bytes);}
    for(const classification of ['cache','protected','unknown','missing'])await seed(cache,a,chapter(classification),classification);
    await seed(cache,a,chapter('another-book','other-book'),'download');await seed(cache,a,{...chapter('another-source'),sourceId:'elsewhere'},'download');
    const legacy={...chapter('unknown-legacy'),chapterIndex:99,chapterId:undefined};a.register(chapter('unknown-legacy'),'download');
    const oldImage={...image(chapter('unknown-legacy')),...legacy};await cache.storeResource(oldImage,bytes);await cache.markChapterComplete(legacy,[oldImage]);
    a.register(chapter('no-local-files'),'download');const derived=chapter('derived-only');a.register(derived,'download');const path=join(dir,'display','historical.bin');await fs.mkdir(dirname(path),{recursive:true});await fs.writeFile(path,bytes);
    cache.setMangaExternalStorage({inventory:async()=>[{path,owners:[owner(derived)],live:false}],remove:async()=>false});
    a.candidates=async()=>{throw Error('download inventory must not use the current catalog or eviction candidates');};
    const result=await cache.listMangaDownloadChapters('source','manga');const expected=[kept,partial,derived].map(({sourceId,bookId,chapterId})=>({sourceId,bookId,chapterId}));
    assert.deepEqual(new Set(result.map(JSON.stringify)),new Set(expected.map(JSON.stringify)));assert.equal(result.length,3,'multiple versions/resources are one exact chapter');
    assert.equal(await cache.isChapterComplete(partial),false);assert.equal(await cache.isChapterComplete(partialNew),false);
    await assert.rejects(cache.listMangaDownloadChapters('source','manga',()=>false),/superseded/);
    a.classes.set(key(partial),'cache');a.classes.set(key(partialNew),'cache');assert.equal((await cache.listMangaDownloadChapters('source','manga')).some(c=>c.chapterId===partial.chapterId),false);
    pass('book download inventory includes partial, new-version, removed-catalog and derived-only chapters; exact identities deduplicate and unknown history is excluded');
  }
  {
    const {a,cache}=await fixture('delete-admission-fence');const c=chapter('selected'),i=await seed(cache,a,c);let current=true;
    a.setBeforeClaim(async candidate=>{assert.throws(()=>cache.pinMangaChapter(candidate),/MANGA_CACHE_EVICTING/);current=false;});
    assert.equal(await cache.deleteMangaVersion(owner(c),()=>current),false);assert.equal(a.pendingGrants.size,1);assert.equal(await exists(await cache.resourcePath(i)),true);
    current=true;assert.equal(await cache.deleteMangaVersion(owner(c),()=>current),true);assert.equal(await exists(await cache.resourcePath(i)),false);
    for(const classification of ['protected','unknown','missing']){const item=chapter(classification);const picture=await seed(cache,a,item,classification);assert.equal(await cache.deleteMangaVersion(owner(item)),false);assert.equal(await exists(await cache.resourcePath(picture)),true);}
    pass('explicit deletion fences new admission during claim, preserves a cancelled pending grant, and rejects protected or unknown identities');
  }
  {
    const {dir,a,cache}=await fixture('download-derived-idle');const facts=policies(a);const now=Math.floor(Date.now()/1000),ttl=7*24*60*60;
    const idle=chapter('idle'),never=chapter('never'),recent=chapter('recent'),session=chapter('session'),partial=chapter('partial'),host=chapter('host'),live=chapter('live'),shared=chapter('shared'),other=chapter('other','another-book'),unknown=chapter('unknown');
    const originals=[];for(const c of [idle,never,recent,session,host,live,shared,other])originals.push(await seed(cache,a,c,'download'));
    a.register(partial,'download');originals.push(image(partial));await cache.storeResource(image(partial),bytes);a.register(unknown,'unknown');
    facts.set(key(idle),{lastReadAt:now-ttl-60});facts.set(key(recent),{lastReadAt:now});facts.set(key(session),{inUse:true,lastReadAt:now-ttl-60});facts.set(key(partial),{inUse:true});
    const files=[];for(const c of [idle,never,recent,session,partial,host,live,other,unknown])files.push(await derivedFile(dir,c,`${c.chapterId.split('/').at(-1)}.bin`));
    files.find(f=>key(f.owners[0])===key(live)).live=true;
    const alias=join(dir,'display','original-alias.bin');await fs.link(await cache.resourcePath(image(shared)),alias);files.push({path:alias,owners:[owner(shared)],live:false});
    const events=[];derivedStorage(cache,files,events);const unpin=cache.pinMangaChapter(owner(host));
    await cache.maintainMangaStorage('expiry',{sourceId:'source',bookId:'manga'});
    assert.deepEqual(new Set(events),new Set([idle.chapterId,never.chapterId]));
    for(const c of [recent,session,partial,host,live,other,unknown])assert.equal(await exists(files.find(f=>key(f.owners[0])===key(c)).path),true);
    assert.equal(await exists(alias),true);assert.equal(await cache.isChapterComplete(partial),false);assert.equal(a.claims.length,0);assert.equal(a.completed.length,0);
    for(const i of originals)assert.deepEqual(await cache.loadResource(i),bytes);unpin();
    await cache.maintainMangaStorage('clear',{sourceId:'source',bookId:'manga'});
    assert.equal(await exists(files.find(f=>key(f.owners[0])===key(recent)).path),false);assert.equal(await exists(files.find(f=>key(f.owners[0])===key(host)).path),false);
    for(const c of [session,partial,live,other,unknown])assert.equal(await exists(files.find(f=>key(f.owners[0])===key(c)).path),true);
    assert.equal(await exists(alias),true);for(const i of originals)assert.deepEqual(await cache.loadResource(i),bytes);
    pass('idle download trim uses the actual seven-day read clock and book scope; active sessions, partial leases, Host pins/live files, unknown history and original inode aliases remain protected');
  }
  {
    const {dir,a,cache}=await fixture('download-derived-fence');const c=chapter('selected');const original=await seed(cache,a,c,'download');const file=await derivedFile(dir,c,'page.bin');let calls=0;
    a.policy=async selected=>{assert.equal(key(selected),key(c));calls++;assert.throws(()=>cache.pinMangaChapter(selected),/MANGA_CACHE_EVICTING/);return{status:'download',inUse:calls>1,lastReadAt:null};};
    let removed=0;derivedStorage(cache,[file],[],async()=>{removed++;});await cache.maintainMangaStorage('clear');
    assert.equal(removed,0);assert.equal(await exists(file.path),true);assert.equal(cache.mangaClaiming.size,0);assert.equal(cache.mangaEvicting.size,0);
    const unpin=cache.pinMangaChapter(owner(c));unpin();assert.deepEqual(await cache.loadResource(original),bytes);
    let reads=0;a.policy=async()=>({status:'download',inUse:false,lastReadAt:++reads===1?0:Math.floor(Date.now()/1000)});
    await cache.maintainMangaStorage('expiry');assert.equal(removed,0);assert.equal(await exists(file.path),true);
    pass('derived trim fences new admission and rechecks newly acquired Core protection or renewed reading clocks before physical removal');
  }
  {
    const {dir,a,cache}=await fixture('download-derived-restore');const c=chapter('selected'),original=await seed(cache,a,c,'download'),file=await derivedFile(dir,c,'page.bin');policies(a);
    let entered,release;const reached=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});let restored=false;
    derivedStorage(cache,[file],[],async(_chapter,_files,current)=>{assert.equal(await current(),true);entered();await gate;});
    const trimming=cache.maintainMangaStorage('clear');await reached;
    const restore=cache.withMangaStorageRestore(async()=>{restored=true;});await new Promise(r=>setImmediate(r));assert.equal(restored,false);
    release();await trimming;await restore;assert.equal(await exists(file.path),true);assert.deepEqual(await cache.loadResource(original),bytes);
    assert.equal(cache.mangaClaiming.size,0);assert.equal(a.claims.length,0);
    pass('same-owner restore cancels a waiting derived removal guard before Core replacement, without an original tombstone or permanent admission block');
  }
  {
    const {dir,a,cache}=await fixture('download-derived-retry');const c=chapter('selected'),original=await seed(cache,a,c,'download');policies(a);
    const first=await derivedFile(dir,c,'first.bin'),second=await derivedFile(dir,c,'second.bin'),metadata=await derivedFile(dir,c,'owner.json');const events=[];
    derivedStorage(cache,[first,second,metadata],events);rejectUnlink=p=>p===second.path;await cache.maintainMangaStorage('clear');rejectUnlink=()=>false;
    assert.equal(await exists(first.path),false);assert.equal(await exists(second.path),true);assert.equal(await exists(metadata.path),true);assert.equal(cache.mangaEvicting.size,0);
    await cache.maintainMangaStorage('clear');assert.equal(await exists(second.path),false);assert.equal(await exists(metadata.path),false);assert.equal(events.length,2);
    assert.deepEqual(await cache.loadResource(original),bytes);assert.equal(a.claims.length,0);assert.equal(a.completed.length,0);
    pass('partial derived I/O failure retains ownership sidecars for retry, preserves original bytes and sends no Core eviction completion');
  }
  {
    const {dir,a,cache,setFree}=await fixture('download-derived-pressure');const ordinary=chapter('ordinary'),first=chapter('first'),second=chapter('second'),next=chapter('next');
    await seed(cache,a,ordinary);const originals=[await seed(cache,a,first,'download'),await seed(cache,a,second,'download')];a.register(next,'download');policies(a);
    const files=[await derivedFile(dir,first,'first.bin',5*1024**3+64),await derivedFile(dir,second,'second.bin',5*1024**3+64)];const events=[];let free=512*1024**2;setFree(free);
    beforeUnlink=async path=>{if(await exists(path)){free+=(await fs.stat(path)).size;setFree(free);events.push(path.startsWith(join(dir,'display'))?'derived':'ordinary');}};
    const selected=[];derivedStorage(cache,files,selected);const reservation=await deadline(cache.reserveExternalWrite(owner(next),1,'foreground','derived'));reservation.release();beforeUnlink=async()=>{};
    assert.deepEqual(a.claims.map(c=>c.chapterId),[ordinary.chapterId]);assert.deepEqual(selected,[first.chapterId]);assert.equal(await exists(files[0].path),false);assert.equal(await exists(files[1].path),true);
    assert.ok(events.indexOf('ordinary')<events.indexOf('derived'));for(const i of originals)assert.deepEqual(await cache.loadResource(i),bytes);
    assert.equal((await cache.mangaStorageUsage()).reservedBytes,0);
    pass('capacity and low-space pressure first use Core ordinary LRU, then idle download derivatives, stopping immediately once actual released bytes suffice');
  }
  {
    const {a,cache}=await fixture('expiry-foreground-interleave');const old=chapter('expired'),next=chapter('opening');const image=await seed(cache,a,old);a.register(next);
    let entered,release,calls=0;const atCandidates=new Promise(resolve=>{entered=resolve;}),held=new Promise(resolve=>{release=resolve;});
    a.candidates=async()=>{calls++;entered();await held;return[owner(old)];};
    const claim=a.claim;let expiryGuard;a.claim=async(c,expiry)=>{expiryGuard=expiry;return claim.call(a,c);};
    const maintenance=cache.maintainMangaStorage('expiry');await atCandidates;
    const joined=cache.maintainMangaStorage('expiry');let timer,reservation;
    try {
      reservation=await Promise.race([cache.reserveExternalWrite(owner(next),128,'foreground'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('foreground admission waits behind whole expiry enumeration')),500);})]);
      reservation.release();assert.equal(calls,1,'simultaneous idle checks join one expiry task');
    } finally {clearTimeout(timer);release();await Promise.allSettled([maintenance,joined]);}
    assert.equal(await exists(await cache.resourcePath(image)),false);
    assert.equal(expiryGuard.ttlSeconds,7*24*60*60);assert.ok(Number.isSafeInteger(expiryGuard.nowSeconds));
    pass('idle expiry candidate enumeration releases the global mutation lane; foreground budget admission proceeds and simultaneous expiry checks coalesce');
  }
  {
    const {a,cache}=await fixture('expiry-read-clock-recheck');const c=chapter('recently-read'),image=await seed(cache,a,c);
    let entered,release;const atCandidates=new Promise(resolve=>{entered=resolve;}),held=new Promise(resolve=>{release=resolve;});
    a.candidates=async()=>{entered();await held;return[owner(c)];};
    const facts=policies(a,new Map([[key(c),{lastReadAt:0}]]));
    const maintenance=cache.maintainMangaStorage('expiry');await atCandidates;
    facts.set(key(c),{lastReadAt:Math.floor(Date.now()/1000)});release();await maintenance;
    assert.equal(a.claims.length,0,'queued old candidate is not claimed after actual read renewal');
    assert.deepEqual(await cache.loadResource(image),bytes);
    pass('expiry rechecks current read time and in-use policy after enumeration before the exact eviction claim');
  }
  {
    const {a,cache}=await fixture('foreground');const c=chapter('expired');await seed(cache,a,c);
    let calls=0;const original=a.candidates;a.candidates=async(...args)=>{calls++;return original.call(a,...args);};
    await cache.maintainMangaStorage();await cache.maintainMangaStorage();assert.equal(calls,1);
    await cache.maintainMangaStorage('clear');assert.equal(calls,2);
    assert.equal(handles.size,0);pass('foreground expiry is checked once per 24h; explicit clear bypasses cadence and descriptors close');
  }
  {
    // Core caps classifyBatch/policyBatch requests at 256 entries. Exercise
    // every production batch path with a 300-chapter shelf so a future caller
    // cannot accidentally pass the complete candidate array in one RPC.
    const {dir,a,cache}=await fixture('authority-batch-bounds');
    const chapters=Array.from({length:300},(_,index)=>chapter(`batch-${index}`));
    chapters.forEach(c=>a.register(c,'protected'));
    const classifySizes=[],policySizes=[];
    a.classifyBatch=async batch=>{classifySizes.push(batch.length);return batch.map(()=> 'protected');};
    a.policyBatch=async batch=>{policySizes.push(batch.length);return batch.map(()=>({status:'protected',inUse:false,lastReadAt:null}));};
    await cache.maintainMangaStorage('clear');
    assert.deepEqual(classifySizes,[128,128,44], 'clear maintenance slices classifyBatch requests');
    await cache.maintainMangaStorage('expiry');
    assert.deepEqual(policySizes,[128,128,44], 'expiry maintenance slices policyBatch requests');
    const files=[];
    for(const c of chapters){const path=join(dir,'display',`${c.chapterId.split('/').at(-1)}.bin`);await fs.mkdir(dirname(path),{recursive:true});await fs.writeFile(path,new Uint8Array([1]));files.push({path,owners:[owner(c)],live:false});}
    a.policy=async()=>({status:'download',inUse:false,lastReadAt:null});
    a.policyBatch=async batch=>{policySizes.push(batch.length);return batch.map(()=>({status:'download',inUse:false,lastReadAt:null}));};
    cache.setMangaExternalStorage({inventory:async()=>files,remove:async()=>false});
    await cache.mangaStorageSummary();
    assert.deepEqual(policySizes.slice(-3),[128,128,44], 'storage summary slices cleanable policy requests');
    assert.ok(Math.max(...classifySizes,...policySizes)<=128, 'no authority batch exceeds the Host safety ceiling');
    pass('300-chapter classify, expiry policy and cleanable-summary paths stay within bounded Core requests');
  }
  console.log(JSON.stringify({status:'PASS',productionSourceSha256:createHash('sha256').update(source).digest('hex'),checks},null,2));
} finally {beforeSync=async()=>{};beforeUnlink=async()=>{};rejectUnlink=()=>false;await fs.rm(root,{recursive:true,force:true});}
