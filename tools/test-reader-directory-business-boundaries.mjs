import { readingPrefetchOwnerProbe } from './lib/reading-prefetch-owner-probe.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {BookshelfCatalogUpdate}=await import('../entry/src/main/ets/features/bookshelf/application/BookshelfCatalogUpdate.ts');
const {sameRemoteSessionEvidence}=await import('../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts');
const {bookshelfOperationClass}=await import('./lib/bookshelf-operation-owner-probe.mjs');

const prefetched=[];let runtime={};
const ReadingOfflineGateway=class {async prefetchWindow(session,start,end,current){prefetched.push({session,start,end,current});return{entries:[],failedChapters:0};}};
const {ReadingPrefetchHost}=readingPrefetchOwnerProbe(()=>runtime,{ReadingOfflineGateway});
const ReadingCommitPresentation=bookshelfOperationClass('features/reading/presentation/ReadingCommitPresentation.ets',
  'ReadingCommitPresentation',{Observed:value=>value,ReadingPrefetchHost,sameRemoteSessionEvidence});
const entries=[0,1,2,3,4,5,6,7,8,9,10].map(index=>({index,title:`entry ${index}`,url:`/${index}`,navigable:[0,3,6].includes(index)}));
const session={identity:{sourceId:'s',bookId:'b'},sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',entries};
let previous;
function fixture() {
  if (previous) previous.retired = true;
  const scene = {owner:runtime,retired:false,mounting:1,navigation:1,active:true};
  previous = scene;
  const entry = {book:{...session.identity},session,sessionGeneration:1,toc:[]};
  const host = ReadingPrefetchHost.forRuntime(runtime);
  const admittedRefreshes = [];
  host.refreshNearEnd = (selected,lease) => {
    assert.equal(lease.isCurrent(),true);
    admittedRefreshes.push(selected);
  };
  const commits = new ReadingCommitPresentation({entry:()=>entry,scene:()=>({...scene}),
    ownsRuntime:owner=>owner===runtime,notifyFileNavigation(){},diagnostic:(_stage,message)=>assert.fail(message)});
  return {entry,host,commits,admittedRefreshes};
}
{
 const {commits,admittedRefreshes}=fixture();commits.accept({...session.identity,chapterIndex:6,chapterOffset:0});
 await commits.prefetch(session,3);
 assert.equal(admittedRefreshes.length,1,'four trailing groups cannot prevent refresh at the final readable chapter');
}
{
 prefetched.length=0;const {commits}=fixture();await commits.prefetch(session,3);
 assert.equal(prefetched.length,1);assert.deepEqual([prefetched[0].start,prefetched[0].end],[0,7],
  'prefetch chooses real readable neighbors then sends their original canonical range');
 await commits.prefetch(session,99);assert.equal(prefetched.length,1,'unknown/partial index must not clamp to an unrelated chapter');
}
console.log('PASS production near-end and prefetch canonical readable boundaries');
{
 const {entry,host,commits,admittedRefreshes}=fixture();let scanAllowed=true,scans=0;
 const indexed={...session,entries:new Proxy(entries,{get(target,key){if(key===Symbol.iterator){assert.equal(scanAllowed,true,'progress must not rescan TOC');scans++;}return Reflect.get(target,key);}})};
 entry.session=indexed;host.nearEnd(indexed,6);scanAllowed=false;
 commits.prefetch=async()=>{};
 for(let n=0;n<100;n++){commits.accept({...session.identity,chapterIndex:6,chapterOffset:0});}
 assert.equal(scans,1);assert.equal(admittedRefreshes.length,100);
 commits.accept({...session.identity,chapterIndex:10,chapterOffset:0});
 assert.equal(admittedRefreshes.length,100,'group commit cannot trigger readable-tail work');
 const replacement={...session,entries:[...entries,{index:11,title:'next',url:'/11',navigable:true}]};
 host.nearEnd(replacement,11);assert.equal(host.indexes.at(-1),11);
 host.retire();assert.equal(host.indexes.length,0);
}
{
 prefetched.length=0;const {commits,entry}=fixture();await commits.prefetch(session,3);
 const guard=prefetched[0].current;assert.equal(guard(),true);
 entry.sessionGeneration++;assert.equal(guard(),false,'same-book replacement revokes stale prefetch owner');
 entry.session={...session,contextVersion:'x2'};await commits.prefetch(session,3);assert.equal(prefetched.length,1);
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
 const {entry,commits}=fixture();entry.toc=originalToc;
 prefetched.length=0;
 const shelfCurrent=()=>true;
 await new BookshelfCatalogUpdate(runtime).run([{...acquired.identity,title:'refreshed book',author:'author'}],false,600000,shelfCurrent,
   (s,live)=>commits.prefetch(s,undefined,live,runtime),()=>{});
 assert.equal(calls.length,1);assert.equal(calls[0].options.forceRefresh,true);
 assert.equal(prefetched.length,1,'manual shelf refresh keeps its independently acquired prefetch');
 assert.equal(prefetched[0].session,acquired);assert.deepEqual([prefetched[0].start,prefetched[0].end],[0,7]);
 assert.equal(entry.session,session,'refresh cannot replace current reader');
 assert.equal(entry.toc,originalToc,'different owner cannot publish a directory');
 entry.sessionGeneration++;assert.equal(prefetched[0].current(),true,'unrelated reader generation does not own shelf work');
 let shelfAlive=true;await commits.prefetch(acquired,3,()=>shelfAlive);
 const guard=prefetched.at(-1).current;shelfAlive=false;assert.equal(guard(),false);
 const count=prefetched.length;await new BookshelfCatalogUpdate(runtime).run([{...acquired.identity,title:'book',author:'author'}],true,600000,()=>true,
   (s,live)=>commits.prefetch(s,undefined,live,runtime),()=>{});
 assert.equal(prefetched.length,count,'automatic refresh remains catalog only');
}
console.log('PASS actual manual shelf refresh -> acquisition -> independent readable prefetch; visible session and directory are preserved');
