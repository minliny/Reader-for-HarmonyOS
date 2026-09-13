import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { RemoteReadingGatewayError, classifyRemoteReadingCommandFailure, remoteReadingFailureRecord } = await import('../entry/src/main/ets/features/reading/RemoteReadingContract.ts');
const key = (s,b) => JSON.stringify([s,b]);
const seed = (sourceId='s1', bookId='/book') => ({ sourceId, bookId, detailUrl:bookId, title:'Book', author:'Author', sourceVersion:'v2' });
function fixture({ facts, variable='{}', enabled=true, cacheError, cacheIdentity, volumes=false, missingBody=false, networkError, miss=false, cachedVariables={token:'old'},onlineToc,onlineHttp }={}) {
  const calls=[]; const cached=[...(volumes?[{chapterIndex:0,title:'Volume',url:'',variables:{}}]:[]),
    {chapterIndex:volumes?1:0,title:'Chapter',url:'/chapter',variables:{token:'old'},state:'cached',cachedBytes:100}];
  const runtime=new BookAcquisitionCoordinator(async (method,params={},options={})=>{
    calls.push({method,params});
    if (options.shouldCancel?.()) throw {code:'CANCELLED',message:'cancelled'};
    if (method==='source.list') return {data:{sources:enabled?[{sourceId:'s1',enabled:true,sourceVersion:'v2'},{sourceId:'s2',enabled:true,sourceVersion:'v2'}]:[]}};
    if (method==='search-book.get') return {data:{book:{origin:params.origin,bookUrl:params.bookUrl,name:'Stored',author:'Author',variable,acquisition:facts}}};
    if (method==='cache.book.status') {
      if(cacheError) throw cacheError;
      return {data:{sourceId:cacheIdentity??params.sourceId,bookId:params.bookId,tocAvailable:!miss,chapters:missingBody?cached.map(c=>({...c,state:'missing',cachedBytes:0})):cached,continuationVariables:cachedVariables}};
    }
    if (method==='book.detail' && networkError) throw networkError;
    if (method==='book.detail') return {data:{sourceId:params.sourceId,sourceVersion:'v2',book:{bookId:params.book.bookId,title:'Fresh',author:'Author'},tocUrl:'/toc',variables:{token:'fresh'}}};
    if (method==='book.toc') return {requestId:72,data:{sourceId:params.sourceId,bookId:params.bookId,toc:onlineToc??[{index:0,title:'Chapter',url:'/chapter',variables:{}}],http:onlineHttp}};
    if (method==='chapter.content') return {data:{sourceId:params.sourceId,bookId:params.bookId,chapterTitle:'Chapter',content:'A readable sentence with enough real text to render. '.repeat(20),via:'cache'}};
    if (method==='reading.progress.get') return {data:{found:false}};
    if (method==='search-book.put') return {data:{}};
    throw new Error('Unexpected command '+method);
  });
  return {runtime,calls,cached};
}
for (const facts of [undefined, {}, {sourceVersion:'v1',catalogAt:Date.now()}, {sourceVersion:'v2',catalogAt:1}, {sourceVersion:'v2',catalogAt:Date.now()}]) {
  const f=fixture({facts}); const session=await f.runtime.acquireBook(seed());
  assert.equal(session.entries.length,1);
  assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,1,'durable catalog must precede network for every acquisition generation');
  assert.equal(f.calls.filter(c=>['book.detail','book.toc'].includes(c.method)).length,0,'stale metadata must not force online admission');
  f.runtime.close();
}
{
  const f=fixture({enabled:false});const session=await f.runtime.acquireBook(seed());
  assert.equal(session.acquisitionMode,'offline','deleted sources retain downloaded books');
  const gateway=new RemoteReadingFlowGateway({request:(...a)=>f.runtime.request(...a),bookAcquisitions:()=>f.runtime});
  await gateway.loadChapter(session,0);
  assert.equal(f.calls.filter(c=>['book.detail','book.toc'].includes(c.method)).length,0);
  f.runtime.close();
}
{
  const f=fixture({cacheIdentity:'s2'});
  await assert.rejects(f.runtime.acquireBook(seed()),error=>error.code==='identityMismatch');
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,0,'identity error cannot become a cache miss');
  f.runtime.close();
}
for (const cacheError of [{code:'CANCELLED',message:'cancelled'}, {code:'INTERNAL',message:'storage unavailable',details:{category:'STORAGE_FAILURE'}}]) {
  const f=fixture({cacheError});
  await assert.rejects(f.runtime.acquireBook(seed()));
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,0,'non-recoverable cache error cannot trigger network');
  f.runtime.close();
}
{
  const f=fixture({facts:{sourceVersion:'v1',catalogAt:1}});
  const a=await f.runtime.acquireBook(seed()); const b=await f.runtime.acquireBook(seed('s2'));
  assert.notEqual(a,b); assert.equal(a.identity.sourceId,'s1');assert.equal(b.identity.sourceId,'s2');
  const forced=await f.runtime.acquireBook({...seed(),sourceVersion:'v1',searchVariables:[{name:'unsafe',value:'old'}]},{forceRefresh:true});
  assert.equal(forced.sourceVersion,'v2');
  const detail=f.calls.find(c=>c.method==='book.detail');
  assert.equal(detail.params.book.variables,undefined,'old source continuation must not enter current detail');
  f.runtime.close();
}
{
  const f=fixture({volumes:true}); const session=await f.runtime.acquireBook(seed());
  assert.equal(session.entries.length,2);assert.equal(session.entries[1].index,1,'volume index must not be removed or renumbered');
  const gateway=new RemoteReadingFlowGateway({request:(...a)=>f.runtime.request(...a)});
  await assert.rejects(gateway.loadChapter(session,0),error=>error.code==='chapterNotFound');
  f.runtime.close();
}
// A legacy continuation remains readable offline, but a missing body must
// refresh current detail/TOC without carrying variables from the old rule.
{
  const f=fixture({facts:{sourceVersion:'v1',catalogAt:1},missingBody:true});
  const session=await f.runtime.acquireBook(seed());
  const gateway=new RemoteReadingFlowGateway({request:(...a)=>f.runtime.request(...a),bookAcquisitions:()=>f.runtime});
  await gateway.loadChapter(session,0);
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
  assert.equal(f.calls.find(c=>c.method==='book.detail').params.book.variables,undefined);
  assert.equal(f.calls.find(c=>c.method==='chapter.content').params.variables.token,'fresh');
  f.runtime.close();
}
{
  const f=fixture({enabled:false,missingBody:true});
  const session=await f.runtime.acquireBook(seed());
  const gateway=new RemoteReadingFlowGateway({request:(...a)=>f.runtime.request(...a),bookAcquisitions:()=>f.runtime});
  await assert.rejects(gateway.loadChapter(session,0),e=>e.code==='chapterNotDownloaded');
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,0);
  f.runtime.close();
}
for (const cacheError of [undefined,{event:{requestId:50,error:{code:'INTERNAL',message:'invalid',details:{category:'CACHE_DERIVED_CORRUPT'}}}}]) {
  const f=fixture({miss:!cacheError,cacheError,networkError:{event:{requestId:51,error:{code:'INTERNAL',message:'private token https://private/?cookie=secret',details:{category:'SOURCE_RULE_FAILED',responseBytes:900}}}}});
  await assert.rejects(f.runtime.acquireBook(seed()),e=>e.category==='SOURCE_RULE_FAILED'&&e.causeValue instanceof RemoteReadingGatewayError);
  const records=f.runtime.recentFailures();
  assert.equal(records.length,2);assert.equal(records[0].attemptId,records[1].attemptId);
  assert.equal(records[1].requestId,51);assert.equal(records[1].responseBytes,900);
  assert.equal(records[1].previousCategory,cacheError?'CACHE_DERIVED_CORRUPT':'CACHE_MISSING');
  assert.ok(records[1].identityRef>0);assert.ok(records[1].elapsedMs>=0);
  assert.ok(!JSON.stringify(records).includes('private')&&!JSON.stringify(records).includes('secret'));
  f.runtime.close();
}
for (const category of ['STORAGE_FAILURE','CANCELLED','SOURCE_VERSION_CHANGED']) {
  const error=classifyRemoteReadingCommandFailure('cache.book.status',{event:{requestId:7,error:{code:category==='CANCELLED'?'CANCELLED':'INTERNAL',message:'fixture',details:{category}}}});
  assert.equal(error.category,category);assert.equal(remoteReadingFailureRecord(error,1).requestId,7);
}
{
  const hash='a'.repeat(64);
  const f=fixture({miss:true,onlineToc:[{index:0,title:'Volume',url:'',variables:{}}],onlineHttp:{status:200,responseBytes:0,responseDigest:hash,firstResponseBytes:200,firstResponseDigest:hash,finalUrlDigest:hash,headers:{Cookie:'secret'},finalUrl:'https://private/?token=secret'}});
  await assert.rejects(f.runtime.acquireBook(seed()),e=>e.code==='emptyToc'&&e.diagnostic.readableEntryCount===0&&e.diagnostic.returnedEntryCount===1);
  const record=f.runtime.recentFailures().at(-1);
  assert.equal(record.requestId,72);assert.equal(record.responseBytes,0);assert.equal(record.firstResponseBytes,200);
  assert.equal(record.responseDigest,hash);assert.equal(record.finalUrlDigest,hash);assert.equal(record.httpStatus,200);
  assert.ok(!JSON.stringify(record).includes('secret')&&!JSON.stringify(record).includes('private'));
  f.runtime.close();
}
// A session opened under the old rule must keep cached bodies readable after
// a later source edit, and refresh context before the first missing body.
{
  const f=fixture({facts:{sourceVersion:'v2',catalogAt:Date.now()},missingBody:true});
  const session=await f.runtime.acquireBook(seed());
  session.sourceVersion='old-rule';session.acquisitionMode='online';
  const gateway=new RemoteReadingFlowGateway({request:(...a)=>f.runtime.request(...a),bookAcquisitions:()=>f.runtime});
  await gateway.loadChapter(session,0);
  assert.equal(f.calls.find(c=>c.method==='chapter.content').params.variables.token,'fresh');
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
  f.runtime.close();
}
console.log('durable catalog admission, source isolation and protected failures: PASS');
