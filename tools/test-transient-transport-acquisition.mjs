import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e}}});
const base=new URL('../entry/src/main/ets/',import.meta.url);
const path=p=>new URL(p,base);
const {BookAcquisitionCoordinator}=await import(path('app/BookAcquisitionCoordinator.ts'));
const {RemoteReadingGatewayError}=await import(path('features/reading/RemoteReadingContract.ts'));
const {acquisitionCandidateRank}=await import(path('features/common/BookAcquisitionPresentation.ts'));
const seed=(i,s='s1')=>({sourceId:s,bookId:`/b${i}`,detailUrl:`/b${i}`,title:'鸣龙',author:'关关公子',sourceVersion:'v1'});
const candidate=(i,s='s1',ready=false)=>({seed:seed(i,s),catalogReady:ready,failed:false});
function fixture(){
 const calls=[],rows=new Map(),catalogs=new Map(),modes=new Map();const version='v1';
 const key=(s,b)=>JSON.stringify([s,b]);
 const runtime=new BookAcquisitionCoordinator(async(method,params,options)=>{
  calls.push({method,params,options});const sourceId=params.sourceId??params.origin;const bookId=params.bookId??params.book?.bookId??params.bookUrl;const id=key(sourceId,bookId);
  if(method==='source.list')return {data:{sources:['s1','s2'].map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:version}))}};
  if(method==='search-book.get')return {data:{book:rows.get(id)??null}};
  if(method==='cache.book.status'){const toc=catalogs.get(id)??[];return {data:{sourceId,bookId,tocAvailable:toc.length>0,chapters:toc.map(e=>({chapterIndex:e.index,title:e.title,url:e.url,variables:{}})),continuationVariables:{}}}}
  if(method==='reading.progress.get')return {data:{found:false,progress:null}};
  if(method==='book.detail'){
   const mode=modes.get(id);if(mode instanceof Error)throw mode;
   const author='关关公子';
   rows.set(id,{origin:sourceId,bookUrl:bookId,name:'鸣龙',author,variable:'{}',time:Date.now(),acquisition:{sourceVersion:version,detailAt:Date.now()}});
   return {data:{sourceId,sourceVersion:version,book:{bookId,title:'鸣龙',author},tocUrl:`${bookId}/toc`,variables:{token:'detail'}}};
  }
  if(method==='book.toc'){
   const toc=modes.get(id)==='empty'?[]:[{index:0,title:'第一章',url:`${bookId}/1`,variables:{}}];
   if(toc.length){catalogs.set(id,toc);Object.assign(rows.get(id).acquisition,{catalogAt:Date.now(),catalogCount:1});}
   return {data:{sourceId,bookId,toc}};
  }
  if(method==='chapter.content'){
   const failure=modes.get(`body:${id}`);if(failure instanceof Error)throw failure;
   return {data:{sourceId,bookId,chapterTitle:'第一章',via:'rule',content:failure==='empty'?'':'清晨的阳光照进房间，书中的故事从这里开始。'.repeat(12)}};
  }
  if(method==='search-book.put'){const row=rows.get(id);if(row)row.acquisition={...row.acquisition,...params.acquisition};return{data:{book:row}}}
  if(method==='book.search')return{data:{sourceId,books:[{bookId:'/new'}]}};
  throw Error(`unexpected ${method}`);
 });
 return {runtime,calls,rows,catalogs,modes,key};
}

const {classifyRemoteReadingCommandFailure}=await import(path('features/reading/RemoteReadingContract.ts'));
const sdk=readFileSync(new URL('../entry/vendor/core-harmony/sdk/reader_core.ts',import.meta.url),'utf8');
const fragment=sdk.slice(sdk.indexOf('function normalizeHostError('),sdk.indexOf('function readTransactionPendingDetails('));
const normalize=new Function(stripTypeScriptTypes(fragment)+";function isJsonObject(v){return typeof v==='object'&&v!==null&&!Array.isArray(v)};return normalizeHostError;")();
const hostError=Object.assign(new Error('Internal error'),{code:'INTERNAL',retryable:true,
 details:{category:'SOURCE_HTTP_FAILED',phase:'transport',transient:true,platformCode:2300999}});
const normalized=normalize(normalize(hostError));
assert.equal(normalized.code,'INTERNAL');assert.equal(normalized.retryable,true);
assert.equal(normalized.details.platformCode,2300999);
// Actual Core preserves this category and puts the original Host details in cause.
const propagated={event:{requestId:123,error:{...normalized,details:{category:'SOURCE_HTTP_FAILED',cause:normalized.details,
 host:{operationId:1,requestId:123,capability:'http.execute'}}}}};
const classified=classifyRemoteReadingCommandFailure('book.detail',propagated);
assert.equal(classified.category,'SOURCE_HTTP_FAILED');assert.equal(classified.transientTransport,true);
const f=fixture();
try{
 const prior={schemaVersion:2,sourceVersion:'v1',catalogAt:1,catalogCount:1,readableAt:1,bodyVersion:'prior'};
 f.rows.set(f.key('s1','/b0'),{origin:'s1',bookUrl:'/b0',name:'鸣龙',author:'关关公子',acquisition:structuredClone(prior)});
 f.modes.set(f.key('s1','/b0'),classified);
 for(let n=0;n<2;n++)await assert.rejects(f.runtime.acquireBook(seed(0)),e=>e.transientTransport===true);
 assert.equal(f.calls.filter(c=>c.method==='search-book.put').length,0,'unknown transport must not persist failed acquisition');
 assert.deepEqual(f.rows.get(f.key('s1','/b0')).acquisition,prior,'prior successful evidence remains untouched');
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,2,'a new request attempts the source again');
 const admitted=await f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')]);
 assert.equal(admitted.session.identity.sourceId,'s2','transient per-source failure continues to another same-book candidate');
 assert.equal(f.calls.filter(c=>c.method==='search-book.put'&&c.params.origin==='s1').length,0);
 assert.ok(f.runtime.recentFailures().some(row=>row.category==='SOURCE_HTTP_FAILED'),'failure remains visible in bounded attempt evidence');
 f.modes.set(f.key('s1','/b0'),new RemoteReadingGatewayError('invalidResponse','bad selector','book.detail',undefined,undefined,undefined,'SOURCE_RULE_FAILED'));
 await assert.rejects(f.runtime.acquireBook(seed(0)));
 assert.equal(f.calls.filter(c=>c.method==='search-book.put'&&c.params.acquisition.stage==='failed').length,1,'confirmed rule errors still persist failure');
 for(const message of ['HTTP 400','HTTP 404','HTTP 503','request timed out','connection interrupted']){
  const known=classifyRemoteReadingCommandFailure('book.detail',{event:{error:{code:'INTERNAL',message,retryable:false,details:{category:'SOURCE_HTTP_FAILED'}}}});
  assert.equal(known.transientTransport,false,'HTTP status errors are not silently relabeled transient');
  f.modes.set(f.key('s1','/b0'),known);
  await assert.rejects(f.runtime.acquireBook(seed(0)));
 }
 assert.equal(f.calls.filter(c=>c.method==='search-book.put'&&c.params.acquisition.stage==='failed').length,1,'HTTP, timeout and connection failures do not create parser verdicts');
 assert.equal(f.calls.find(c=>c.method==='search-book.put'&&c.params.acquisition.stage==='failed').params.acquisition.failureCategory,'SOURCE_RULE_FAILED');
 console.log('PASS actual SDK normalization/classifier/Coordinator: unknown HTTP remains transient, fallback/retry continues, no failed writer or prior-evidence loss; known rule and HTTP status errors stay distinct');
}finally{f.runtime.close()}

const body=fixture();
try{
 body.modes.set(`body:${body.key('s1','/b1')}`,classifyRemoteReadingCommandFailure('chapter.content',propagated));
 const admitted=await body.runtime.acquireCandidateGroup([candidate(1),candidate(1,'s2')],{requireReadable:true});
 assert.equal(admitted.session.identity.sourceId,'s2','body transport failure continues to another readable candidate');
 assert.equal(body.calls.filter(c=>c.method==='search-book.put'&&c.params.acquisition.stage==='failed').length,0);
 assert.equal(body.rows.get(body.key('s1','/b1')).acquisition.catalogCount,1,'a failed body request retains the successful catalog');
 console.log('PASS actual readable-candidate verification: transient body failure preserves catalog and does not create a failed body verdict');
}finally{body.runtime.close()}

// Feed old and new Core projection shapes through the real ranking and visible
// preparation queue. The queue's existing per-search attempt bound still holds.
for(const cause of ['legacy','confirmed','transport']) {
 const h=fixture(),now=Date.now();
 const facts={schemaVersion:2,sourceVersion:'v1',failureCurrent:true,failureConfirmed:cause==='confirmed',
  failure:{schemaVersion:2,sourceVersion:'v1',stage:'failed',failureStage:'catalog',checkedAt:now,
   ...(cause==='legacy'?{}:{failureCategory:cause==='confirmed'?'SOURCE_RULE_FAILED':'SOURCE_HTTP_FAILED'})}};
 const raw=structuredClone(facts);h.rows.set(h.key('s1','/b2'),{origin:'s1',bookUrl:'/b2',name:'鸣龙',author:'关关公子',acquisition:facts});
 h.modes.set(h.key('s1','/b2'),classified);
 const rank=acquisitionCandidateRank(facts,'v1',now),groups=[[{seed:seed(2),catalogReady:rank<2,failed:rank===3}]];
 const settle=async()=>{for(let n=0;n<300;n++){if(h.runtime.preparationActive===0)return;await new Promise(resolve=>setTimeout(resolve,0));}assert.fail('preparation did not settle');};
 try{
  h.runtime.prepareGroups(groups);await settle();h.runtime.prepareGroups(groups);await settle();
  assert.equal(h.calls.filter(call=>call.method==='book.detail').length,cause==='confirmed'?0:1,`${cause}: legacy and transport retry once; confirmed parser failure retains prior skip`);
  assert.deepEqual(h.rows.get(h.key('s1','/b2')).acquisition,raw,'failed retry does not rewrite raw historical facts');
  assert.equal(h.calls.filter(call=>call.method==='search-book.put').length,0);
 }finally{h.runtime.close();}
}
const rowSource=readFileSync(path('features/source/CandidateRow.ets'),'utf8');
const chapterMethod=rowSource.slice(rowSource.indexOf('  private chapterText():'),rowSource.indexOf('  private chapterColor():'));
const row=new (new Function(stripTypeScriptTypes(`class RowProbe {${chapterMethod}};`)+'return RowProbe;')())();
row.acquisitionState='attemptFailed';assert.equal(row.chapterText(),'上次读取失败 · 可重试');
row.acquisitionState='failed';assert.equal(row.chapterText(),'解析失败 · 可重试');
console.log('PASS legacy/confirmed/HTTP acquisition: raw facts unchanged, only causal parser failures downgrade; unknown attempts get one visible preparation retry and generic previous-failure copy');
