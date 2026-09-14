import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const { BookAcquisitionCoordinator } = await import('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const deferred=()=>{let resolve;let reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const until=async p=>{for(let i=0;i<100;i++){if(p())return;await tick();}throw Error('fixture did not settle');};
const seed={sourceId:'s',bookId:'/b',detailUrl:'/b',title:'Book',author:'Author',sourceVersion:'v1'};
function fixture({catalogAt=Date.now()-2*86400000, cache=true, detailGate, searchGate}={}) {
 const calls=[];
 const runtime=new BookAcquisitionCoordinator(async(method,params,options)=>{
  calls.push({method,params,options});
  if(method==='book.search'){await searchGate.promise;return {data:{sourceId:params.sourceId,books:[]}};}
  if(method==='source.list')return {data:{sources:[{sourceId:'s',enabled:true,sourceVersion:'v1'}]}};
  if(method==='search-book.get')return {data:{book:{origin:'s',bookUrl:params.bookUrl,name:'Cached',author:'Author',variable:'{}',acquisition:{sourceVersion:'v1',catalogAt}}}};
  if(method==='cache.book.status')return {data:{sourceId:'s',bookId:params.bookId,tocAvailable:cache,continuationVariables:{},chapters:cache?[{chapterIndex:0,title:'One',url:'/1',variables:{}}]:[]}};
  if(method==='book.detail'){if(detailGate)await detailGate.promise;return {data:{sourceId:'s',sourceVersion:'v1',book:{bookId:params.book.bookId,title:'Fresh',author:'Author'},tocUrl:'/toc',variables:{}}};}
  if(method==='book.toc')return {data:{sourceId:'s',bookId:params.bookId,toc:[{index:0,title:'One',url:'/1',variables:{}}]}};
  throw Error(`unhandled ${method}`);
 });return {calls,runtime};
}
{
 const gate=deferred();const f=fixture({detailGate:gate});
 const first=await f.runtime.acquireBookWithBackgroundRefresh(seed);
 assert.equal(first.session.book.title,'Cached');assert.ok(first.backgroundRefresh);
 await until(()=>f.calls.some(c=>c.method==='book.detail'));
 let secondSettled=false;
 const second=f.runtime.acquireBookWithBackgroundRefresh(seed).then(x=>{secondSettled=true;return x;});
 await tick();await tick();assert.equal(secondSettled,false);
 assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
 gate.resolve();await first.backgroundRefresh;const secondResult=await second;
 assert.equal(secondResult.session.book.title,'Fresh');f.runtime.close();
 console.log('CONFIRMED: second foreground admission waits for running background refresh although first cached session remains usable');
}
{
 const original=Date.now;let now=2000000000000;Date.now=()=>now;
 try {
  const f=fixture({catalogAt:now-23*3600000});
  const first=await f.runtime.acquireBookWithBackgroundRefresh(seed);
  assert.equal(first.backgroundRefresh,undefined);
  now+=23*3600000;
  const next=await f.runtime.acquireBookWithBackgroundRefresh(seed);
  assert.equal(next.session,first.session);assert.equal(next.backgroundRefresh,undefined);
  assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1);
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,0);f.runtime.close();
  console.log('CONFIRMED: 46-hour-old durable catalog is read as same prepared session with refreshRecommended=false, no refresh');
 } finally {Date.now=original;}
}
{
 const gate=deferred();
 const f=fixture({cache:false,searchGate:gate});
 const searches=Array.from({length:5},(_,i)=>f.runtime.request('book.search',{sourceId:`search${i}`,keyword:'q'}));
 f.runtime.beginSearch();f.runtime.prepare([seed]);
 await until(()=>f.runtime.scheduler.queue.some(j=>j.method==='book.detail'));
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,0);
 f.runtime.setPreparationVisible(false);f.runtime.endSearch();
 gate.resolve();await Promise.all(searches);
 await until(()=>f.runtime.preparationActive===0);
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
 assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 f.runtime.close();console.log('CONFIRMED: speculative detail queued before network dispatch still starts and completes TOC after search exit');
}

{
 const gate=deferred();const f=fixture({detailGate:gate});
 const first=await f.runtime.acquireBookWithBackgroundRefresh(seed);
 await until(()=>f.calls.some(c=>c.method==='book.detail'));
 const second=f.runtime.acquireBookWithBackgroundRefresh(seed);
 const checked=assert.rejects(second,/offline probe/);
 await tick();gate.reject(Error('offline probe'));
 await checked;await first.backgroundRefresh.catch(()=>{});
 assert.equal(f.runtime.prepared.size,1);
 f.runtime.close();console.log('CONFIRMED: background detail failure rejects second foreground admission even while prepared cached session still exists');
}
