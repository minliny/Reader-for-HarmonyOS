import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const indexFile = process.env.READER_UPDATE_INDEX ?? new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(predicate) { for (let i=0;i<300;i++) { if (predicate()) return; await pause(); } assert.fail('update did not settle'); }
const sourceId = 'source';
const seed = bookId => ({ sourceId, bookId, detailUrl: bookId, title: '目录示例', author: '作者', sourceVersion: 'v1' });
const book = (bookId, extra={}) => ({ ...seed(bookId), addedAt: 1, readProgress: 3210, ...extra });
function fixture(books=[book('/one')]) {
  const calls=[], records=new Map(), catalogs=new Map(), modes=new Map(), prefetched=[], log=[];
  let remoteCount=1, cacheGate, active=0, peak=0, projections=0, enabled=true;
  const runtime = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push({method,params});
    const id=params.bookId ?? params.book?.bookId ?? params.bookUrl;
    if (method==='source.list') return {data:{sources:[{sourceId,name:'真实来源',enabled,sourceVersion:'v1'}]}};
    if (method==='source.delete') { enabled=false; return {data:{deleted:1}}; }
    if (method==='search-book.get') return {data:{book:records.get(id) ?? null}};
    if (method==='cache.book.status') {
      const snapshot=catalogs.get(id) ?? [];
      if(cacheGate) await cacheGate.promise;
      return {data:{sourceId,bookId:id,tocAvailable:snapshot.length>0,
        chapters:snapshot.map(e=>({chapterIndex:e.index,title:e.title,url:e.url,variables:{}})),continuationVariables:{}}};
    }
    if (method==='book.detail') {
      active++; peak=Math.max(peak,active); await pause();
      const detail={bookId:id,title:'目录示例',author:'作者'};
      records.set(id,{origin:sourceId,bookUrl:id,name:detail.title,author:detail.author,variable:'{}',
        acquisition:{sourceVersion:'v1',detailAt:Date.now()}});
      return {data:{sourceId,sourceVersion:'v1',book:detail,tocUrl:`${id}/toc`,variables:{token:'detail'}}};
    }
    if (method==='book.toc') {
      await pause(); active--;
      if(modes.get(id)==='error') throw Error('source unavailable');
      const entries=modes.get(id)==='empty' ? [] : Array.from({length:remoteCount},(_,index)=>({index,title:`第${index+1}章`,url:`${id}/${index+1}`,variables:{}}));
      // Fixture models the documented Core preservation contract; the actual
      // Core implementation/test is audited separately, not replaced by this mock.
      if(entries.length) { catalogs.set(id,entries); records.get(id).acquisition.catalogAt=Date.now(); }
      return {data:{sourceId,bookId:id,toc:entries}};
    }
    throw Error(`unexpected command ${method}`);
  });
  const owner={bookAcquisitions:()=>runtime,request:(...args)=>runtime.request(...args)};
  const Index=productionMotionMethods(indexFile,['scheduleBookshelfBackgroundRefresh','refreshBookshelfCatalogBatch','startManualBookshelfUpdate','refreshOneShelfBook'],{
    ReaderRuntimeOwner:{current:()=>owner},RemoteReadingFlowGateway,
    BookshelfFlowGateway:class { async load(){projections++;return {books,continueReading:undefined};} },
    LOCAL_SOURCE_ID:'local',CATALOG_REFRESH_INTERVAL_MS:600000,DOMAIN:0,
    hilog:{info:(...args)=>log.push(args),warn:(...args)=>log.push(args)}
  });
  const page=Object.assign(new Index(),{route:'bookshelf',shelfBooks:books,settingsSnapshot:{autoCheckUpdate:true},
    bookshelfUpdateRunning:false,bookshelfBackgroundRefreshRunning:false,bookshelfUpdateDone:0,bookshelfUpdateTotal:0,
    bookshelfLoadGeneration:0,prefetchReadingWindow:async session=>prefetched.push(session),applyBookshelfState(){}});
  return {runtime,owner,page,calls,records,catalogs,modes,prefetched,log,remoteCount:n=>{remoteCount=n;},
    cacheGate:g=>{cacheGate=g;},peak:()=>peak,projections:()=>projections};
}
const results=[];
async function check(name, run) { try {await run();results.push({name,status:'PASS'});} catch(error){results.push({name,status:'FAIL',message:error.stack});} }
await check('manual update bypasses prepared sessions and executes real Gateway detail/TOC',async()=>{
  const f=fixture(); try {
    const prepared=await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    assert.equal(prepared.entries.length,1); f.remoteCount(2); f.calls.length=0;
    f.page.startManualBookshelfUpdate(); await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,0);
    assert.equal(f.prefetched.at(-1).entries.length,2);
    assert.equal(f.page.shelfBooks[0].readProgress,3210,'Host never rewrites reading progress');
    assert.equal(f.page.bookshelfUpdateDone,1); assert.equal(f.projections(),1);
  } finally {f.runtime.close();}
});
await check('manual update also bypasses durable catalog cache after prepared eviction',async()=>{
  const f=fixture(); try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true}); f.runtime.prepared.clear();
    f.remoteCount(3);f.calls.length=0;
    f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.prefetched.at(-1).entries.length,3);
  } finally {f.runtime.close();}
});
await check('manual request waits for a cache-only in-flight acquisition then refreshes',async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const cached=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    f.remoteCount(4);f.page.startManualBookshelfUpdate();await pause();gate.resolve();
    const old=await cached;assert.equal(old.entries.length,1);
    await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.prefetched.at(-1).entries.length,4);
  } finally {f.runtime.close();}
});
await check('per-book failure/empty results preserve old records, settle flags and continue bounded batch',async()=>{
  const f=fixture([book('/broken'),book('/empty'),book('/healthy'),book('/local',{sourceId:'local'})]);try {
    for(const id of ['/broken','/empty','/healthy']) await f.runtime.acquireBook(seed(id),{forceRefresh:true});
    const oldBroken=f.catalogs.get('/broken'),oldEmpty=f.catalogs.get('/empty');
    f.modes.set('/broken','error');f.modes.set('/empty','empty');f.remoteCount(2);f.calls.length=0;
    f.page.startManualBookshelfUpdate();f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,3,'duplicate click cannot create another sweep');
    assert.equal(f.catalogs.get('/broken'),oldBroken);assert.equal(f.catalogs.get('/empty'),oldEmpty);
    assert.equal(f.prefetched.length,1);assert.equal(f.prefetched[0].identity.bookId,'/healthy');
    assert.equal(f.page.bookshelfUpdateDone,3);assert.equal(f.page.bookshelfUpdateTotal,3);assert.ok(f.peak()<=2);
    assert.equal(f.calls.some(c=>/clear|delete|remove|progress.update/.test(c.method)),false);
  } finally {f.runtime.close();}
});
await check('automatic checks retain 10-minute threshold and disabled/local/active-sweep exclusions',async()=>{
  const fresh=book('/fresh',{lastCheckAt:Date.now()/1000});const due=book('/due',{lastCheckAt:Date.now()/1000-601});
  const f=fixture([fresh,due,book('/local',{sourceId:'local'})]);try {
    await f.runtime.acquireBook(seed('/due'),{forceRefresh:true});f.remoteCount(2);f.calls.length=0;
    f.page.settingsSnapshot.autoCheckUpdate=false;f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);assert.equal(f.calls.length,0);
    f.page.settingsSnapshot.autoCheckUpdate=true;f.page.bookshelfUpdateRunning=true;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);assert.equal(f.calls.length,0);f.page.bookshelfUpdateRunning=false;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.deepEqual(f.calls.filter(c=>c.method==='book.detail').map(c=>c.params.book.bookId),['/due']);
    assert.equal(f.prefetched.at(-1).entries.length,2,'an already-due automatic check must get a new catalog too');
  }finally{f.runtime.close();}
});
await check('multiple force waiters share one refresh after the nonforce admission settles',async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const old=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    const one=f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    const two=f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    f.remoteCount(6);gate.resolve();
    const [prior,a,b]=await Promise.all([old,one,two]);
    assert.equal(prior.entries.length,1);assert.equal(a,b);assert.equal(a.entries.length,6);
    assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  }finally{f.runtime.close();}
});
for(const change of ['cancel','close','source-delete']) await check(`force waiting revalidates ${change} before new network work`,async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const old=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    let current=true;
    const force=f.runtime.acquireBook(seed('/one'),{forceRefresh:true,isCurrent:()=>current});
    // Attach rejection handlers before the simulated owner/configuration changes.
    const outcomes=Promise.allSettled([old,force]);
    if(change==='cancel') current=false;
    else if(change==='close') f.runtime.close();
    else await f.runtime.request('source.delete',{sourceIds:[sourceId]});
    gate.resolve();const result=await outcomes;
    assert.equal(result[1].status,'rejected');
    assert.equal(f.calls.some(c=>c.method==='book.detail'||c.method==='book.toc'),false);
    assert.equal(f.catalogs.get('/one').length,1,'cached directory survives every waiting cancellation');
  }finally{f.runtime.close();}
});
for(const r of results) console.log(JSON.stringify(r));
if(results.some(r=>r.status==='FAIL')) process.exitCode=1;
else console.log('PH60 real Index → Gateway → Coordinator manual catalog refresh and bounded failure recovery PASS');
