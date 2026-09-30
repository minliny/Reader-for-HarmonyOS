import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file=name=>fileURLToPath(new URL(`../entry/src/main/ets/${name}`,import.meta.url));
const prefetched=[];let runtime={};
const Host=productionMotionMethods(file('pages/Index.ets'),['applyReadingCommit','prefetchReadingWindow','updateRemoteReadableChapterOrder','refreshOneShelfBook'],{
 CATALOG_REFRESH_NEAR_END:3,CATALOG_REFRESH_RETRY_INTERVAL_MS:30000,READING_CACHE_BEFORE:2,READING_CACHE_AFTER:2,
 RemoteReadingFlowGateway,ReaderRuntimeOwner:{current:()=>runtime},hilog:{warn(){}},DOMAIN:0,
 sameRemoteSessionEvidence:(a,b)=>a===b,
 ReadingOfflineGateway:class {async prefetchWindow(session,start,end,current){prefetched.push({session,start,end,current});return{entries:[],failedChapters:0};}},
});
const entries=[0,1,2,3,4,5,6,7,8,9,10].map(index=>({index,title:`entry ${index}`,url:`/${index}`,navigable:[0,3,6].includes(index)}));
const session={identity:{sourceId:'s',bookId:'b'},entries};
function fixture(){const host=Object.assign(new Host(),{remoteReadingSession:session,remoteSessionGeneration:1,readingSessionActive:true,navigationGeneration:1,
 remoteReadableChapterPositions:new Map(),remoteReadableChapterIndexes:[],
 detailBook:{...session.identity},detailToc:[],nearEnd:0,consumeSystemFileOpen(){},
 refreshRemoteCatalogNearEnd(){this.nearEnd++;},mergeDirectoryBookmarks:entries=>entries});host.updateRemoteReadableChapterOrder(session);return host;}
{
 const host=fixture();host.applyReadingCommit({...session.identity,chapterIndex:6});
 await host.readingWindowPrefetchTask;
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
 host.remoteReadingSession=indexed;host.updateRemoteReadableChapterOrder(indexed);scanAllowed=false;
 host.prefetchReadingWindow=async()=>{};
 for(let n=0;n<100;n++){host.applyReadingCommit({...session.identity,chapterIndex:6});host.updateRemoteReadableChapterOrder(indexed);}
 assert.equal(scans,1);assert.equal(host.nearEnd,100);
 host.applyReadingCommit({...session.identity,chapterIndex:10});assert.equal(host.nearEnd,100,'group commit cannot trigger readable-tail work');
 const replacement={...session,entries:[...entries,{index:11,title:'next',url:'/11',navigable:true}]};
 host.updateRemoteReadableChapterOrder(replacement);assert.equal(host.remoteReadableChapterIndexes.at(-1),11);
 host.updateRemoteReadableChapterOrder(undefined);assert.equal(host.remoteReadableChapterIndexes.length,0);
}
{
 prefetched.length=0;const host=fixture();await host.prefetchReadingWindow(session,3);
 const guard=prefetched[0].current;assert.equal(guard(),true);
 host.remoteSessionGeneration++;assert.equal(guard(),false,'same-book replacement revokes stale prefetch owner');
 host.remoteReadingSession={...session};await host.prefetchReadingWindow(session,3);assert.equal(prefetched.length,1);
}
console.log('PASS accepted-session index rebuilt once, constant-time commits, unknown/group boundaries and stale prefetch ownership');

{
 const host=fixture(),originalToc=[{index:100,title:'other visible book'}],calls=[];
 host.detailToc=originalToc;
 const acquired={...session,identity:{sourceId:'other-source',bookId:'other-book'},entries:entries.map(e=>({...e}))};
 runtime={bookAcquisitions:()=>({acquireBook:async(seed,options,priority)=>{
  calls.push({seed,options,priority});return acquired;
 }}),request:async(method,params,options)=>{
  assert.equal(method,'reading.progress.get');assert.equal(params.bookId,'other-book');
  assert.equal(options.shouldCancel(),false);return{data:{found:false,progress:null}};
 }};
 prefetched.length=0;
 await host.refreshOneShelfBook({...acquired.identity,title:'refreshed book',author:'author'},false);
 assert.equal(calls.length,1);assert.equal(calls[0].options.forceRefresh,true);
 assert.equal(prefetched.length,1,'manual shelf refresh keeps its independently acquired prefetch');
 assert.equal(prefetched[0].session,acquired);assert.deepEqual([prefetched[0].start,prefetched[0].end],[0,7]);
 assert.equal(host.remoteReadingSession,session,'refresh cannot replace current reader');
 assert.equal(host.detailToc,originalToc,'different owner cannot publish a directory');
 host.remoteSessionGeneration++;assert.equal(prefetched[0].current(),true,'unrelated reader generation does not own shelf work');
 let shelfAlive=true;await host.prefetchReadingWindow(acquired,3,()=>shelfAlive);
 const guard=prefetched.at(-1).current;shelfAlive=false;assert.equal(guard(),false);
 const count=prefetched.length;await host.refreshOneShelfBook({...acquired.identity,title:'book',author:'author'},true,()=>true);
 assert.equal(prefetched.length,count,'automatic refresh remains catalog only');
}
console.log('PASS actual manual shelf refresh -> acquisition -> independent readable prefetch; visible session and directory are preserved');
