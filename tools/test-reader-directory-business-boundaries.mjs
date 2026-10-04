import { readingPrefetchOwnerProbe } from './lib/reading-prefetch-owner-probe.mjs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {bookshelfOperationClass}=await import('./lib/bookshelf-operation-owner-probe.mjs');
const BookshelfCatalogUpdate=bookshelfOperationClass('features/bookshelf/BookshelfCatalogUpdate.ts','BookshelfCatalogUpdate');
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file=name=>fileURLToPath(new URL(`../entry/src/main/ets/${name}`,import.meta.url));
const prefetched=[];let runtime={};
const ReadingOfflineGateway=class {async prefetchWindow(session,start,end,current){prefetched.push({session,start,end,current});return{entries:[],failedChapters:0};}};
const ownerProbe=readingPrefetchOwnerProbe(()=>runtime,{ReadingOfflineGateway});
const Host=productionMotionMethods(file('pages/Index.ets'),['applyReadingCommit','prefetchReadingWindow','readingPrefetchLease','isRemoteCatalogNearEnd'],{
 CATALOG_REFRESH_NEAR_END:3,CATALOG_REFRESH_RETRY_INTERVAL_MS:30000,READING_CACHE_BEFORE:2,READING_CACHE_AFTER:2,
 ...ownerProbe,RemoteReadingFlowGateway,hilog:{warn(){}},DOMAIN:0,
 sameRemoteSessionEvidence:(a,b)=>a===b,
 ReadingOfflineGateway,
});
const entries=[0,1,2,3,4,5,6,7,8,9,10].map(index=>({index,title:`entry ${index}`,url:`/${index}`,navigable:[0,3,6].includes(index)}));
const session={identity:{sourceId:'s',bookId:'b'},entries};
let previous;
function fixture(){if(previous)previous.shelfReceiptRetired=true;const host=Object.assign(new Host(),{mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,shelfReceiptRetired:false,remoteReadingSession:session,remoteSessionGeneration:1,readingSessionActive:true,navigationGeneration:1,
 remoteReadableChapterPositions:new Map(),remoteReadableChapterIndexes:[],
 detailBook:{...session.identity},detailToc:[],nearEnd:0,consumeSystemFileOpen(){},
 refreshRemoteCatalogNearEnd(){this.nearEnd++;},mergeDirectoryBookmarks:entries=>entries});previous=host;return host;}
{
 const host=fixture();host.applyReadingCommit({...session.identity,chapterIndex:6});
 await host.prefetchReadingWindow(session,3);
 assert.equal(host.nearEnd,1,'four trailing groups cannot prevent refresh at the final readable chapter');
}
{
 prefetched.length=0;const host=fixture();await host.prefetchReadingWindow(session,3);
 assert.equal(prefetched.length,1);assert.deepEqual([prefetched[0].start,prefetched[0].end],[0,7],
  'prefetch chooses real readable neighbors then sends their original canonical range');
 await host.prefetchReadingWindow(session,99);assert.equal(prefetched.length,1,'unknown/partial index must not clamp to an unrelated chapter');
}
console.log('PASS production near-end and prefetch canonical readable boundaries');
{
 const host=fixture();let scanAllowed=true,scans=0;
 const indexed={...session,entries:new Proxy(entries,{get(target,key){if(key===Symbol.iterator){assert.equal(scanAllowed,true,'progress must not rescan TOC');scans++;}return Reflect.get(target,key);}})};
 host.remoteReadingSession=indexed;const actual=ownerProbe.ReadingPrefetchHost.forRuntime(runtime);actual.nearEnd(indexed,6);scanAllowed=false;
 host.prefetchReadingWindow=async()=>{};
 for(let n=0;n<100;n++){host.applyReadingCommit({...session.identity,chapterIndex:6});}
 assert.equal(scans,1);assert.equal(host.nearEnd,100);
 host.applyReadingCommit({...session.identity,chapterIndex:10});assert.equal(host.nearEnd,100,'group commit cannot trigger readable-tail work');
 const replacement={...session,entries:[...entries,{index:11,title:'next',url:'/11',navigable:true}]};
 actual.nearEnd(replacement,11);assert.equal(actual.indexes.at(-1),11);
 actual.retire();assert.equal(actual.indexes.length,0);
}
{
 prefetched.length=0;const host=fixture();await host.prefetchReadingWindow(session,3);
 const guard=prefetched[0].current;assert.equal(guard(),true);
 host.remoteSessionGeneration++;assert.equal(guard(),false,'same-book replacement revokes stale prefetch owner');
 host.remoteReadingSession={...session};await host.prefetchReadingWindow(session,3);assert.equal(prefetched.length,1);
}
console.log('PASS accepted-session index rebuilt once, constant-time commits, unknown/group boundaries and stale prefetch ownership');

{
 const originalToc=[{index:100,title:'other visible book'}],calls=[];
 const acquired={...session,identity:{sourceId:'other-source',bookId:'other-book'},entries:entries.map(e=>({...e}))};
 runtime={bookAcquisitions:()=>({acquireBook:async(seed,options,priority)=>{
  calls.push({seed,options,priority});return acquired;
 }}),request:async(method,params,options)=>{
  assert.equal(method,'reading.progress.get');assert.equal(params.bookId,'other-book');
  assert.equal(options.shouldCancel(),false);return{data:{found:false,progress:null}};
 }};
 const host=fixture();host.detailToc=originalToc;
 prefetched.length=0;
 const shelfCurrent=()=>true;
 await new BookshelfCatalogUpdate(runtime).run([{...acquired.identity,title:'refreshed book',author:'author'}],false,600000,shelfCurrent,
   (s,live)=>host.prefetchReadingWindow(s,undefined,live,runtime),()=>{});
 assert.equal(calls.length,1);assert.equal(calls[0].options.forceRefresh,true);
 assert.equal(prefetched.length,1,'manual shelf refresh keeps its independently acquired prefetch');
 assert.equal(prefetched[0].session,acquired);assert.deepEqual([prefetched[0].start,prefetched[0].end],[0,7]);
 assert.equal(host.remoteReadingSession,session,'refresh cannot replace current reader');
 assert.equal(host.detailToc,originalToc,'different owner cannot publish a directory');
 host.remoteSessionGeneration++;assert.equal(prefetched[0].current(),true,'unrelated reader generation does not own shelf work');
 let shelfAlive=true;await host.prefetchReadingWindow(acquired,3,()=>shelfAlive);
 const guard=prefetched.at(-1).current;shelfAlive=false;assert.equal(guard(),false);
 const count=prefetched.length;await new BookshelfCatalogUpdate(runtime).run([{...acquired.identity,title:'book',author:'author'}],true,600000,()=>true,
   (s,live)=>host.prefetchReadingWindow(s,undefined,live,runtime),()=>{});
 assert.equal(prefetched.length,count,'automatic refresh remains catalog only');
}
console.log('PASS actual manual shelf refresh -> acquisition -> independent readable prefetch; visible session and directory are preserved');

{
 const calls=[], manga={...session,contentKind:'manga',identity:{sourceId:'manga-source',bookId:'manga-book'}};
 runtime={bookAcquisitions:()=>({acquireBook:async(seed,options,priority)=>{
  calls.push({seed,options,priority});assert.equal(seed.contentKind,'manga');assert.equal(options.isCurrent(),true);return manga;
 }}),request:async()=>{assert.fail('manga catalog update must not read text progress/body');}};
 const host=fixture(), originalSession=host.remoteReadingSession, originalDirectory=[{index:100,title:'visible other book'}];
 host.detailToc=originalDirectory;prefetched.length=0;
 const targets=[{...manga.identity,contentKind:'manga',title:'manga',author:'author'}];
 const result=await new BookshelfCatalogUpdate(runtime).run(targets,false,600000,()=>true,
  (acquired,current)=>host.prefetchReadingWindow(acquired,undefined,current,runtime),()=>{});
 assert.equal(result.succeeded,1);assert.equal(result.preparationFailed,0);assert.equal(calls.length,1);
 assert.deepEqual(calls[0].seed,{contentKind:'manga',...manga.identity,detailUrl:'manga-book',title:'manga',author:'author',coverUrl:undefined,intro:undefined,lastChapter:undefined});
 assert.equal(calls[0].options.forceRefresh,true);assert.equal(calls[0].priority,'foreground');
 assert.equal(prefetched.length,0,'manual manga catalog acquisition stays outside the text prefetch owner');
 assert.equal(host.remoteReadingSession,originalSession);assert.equal(host.detailToc,originalDirectory);
 const automatic=await new BookshelfCatalogUpdate(runtime).run(targets,true,600000,()=>true,
  ()=>assert.fail('automatic catalog must not prefetch'),()=>{});
 assert.equal(automatic.succeeded,1);assert.equal(calls[1].seed.contentKind,'manga');assert.equal(calls[1].priority,'background');
 const before=calls.length;const retired=await new BookshelfCatalogUpdate(runtime).run(targets,false,600000,()=>false,
  ()=>assert.fail('retired owner must not prefetch'),()=>{});
 assert.equal(retired.cancelled,true);assert.equal(calls.length,before);
}
console.log('PASS real manual/automatic catalog update carries manga type and excludes text preparation without replacing reader ownership');
