import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e}}});
const base=new URL('../entry/src/main/ets/',import.meta.url);
const path=p=>new URL(p,base);
const {BookAcquisitionCoordinator}=await import(path('app/BookAcquisitionCoordinator.ts'));
const {RemoteReadingFlowGateway,RemoteChapterCacheRefreshError}=await import(path('features/reading/RemoteReadingFlowGateway.ts'));
const {RemoteReadingGatewayError,remoteReadingFailureRecord}=await import(path('features/reading/RemoteReadingContract.ts'));
const {remoteReadingFailureKindOf,verdictForFailureKind}=await import(path('features/reading/RemoteContentAdmission.ts'));
const {searchCandidateRank}=await import(path('features/search/SearchCandidatePolicy.ts'));
const {sameRemoteSessionEvidence,preparedRemoteChapterMatches,withPreparedRemoteChapter,copyRemoteReadingSession}=await import(path('features/reading/RemoteReadingEvidence.ts'));
const {errorMessageOf}=await import(path('app/ErrorMessage.ts'));
const {readerSourceCategoryIsText}=await import(path('features/source/ReaderSourceCategory.ts'));
const pause=()=>new Promise(r=>setTimeout(r,0));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
async function until(p){for(let i=0;i<300;i++){if(p())return;await pause()}assert.fail('did not settle')}
const seed=(i,s='s1')=>({sourceId:s,bookId:`/b${i}`,detailUrl:`/b${i}`,title:'鸣龙',author:'关关公子',sourceVersion:'v1'});
const candidate=(i,s='s1',ready=false)=>({seed:seed(i,s),catalogReady:ready,failed:false});
const book=(i,s='s1')=>({...seed(i,s),sourceRuleVersion:'v1',sourceName:`${s}名称`,category:'novel',variables:[{name:'token',value:'search-context'}]});
async function simulatedCoreGate(gate,options){
 let timer;
 try {
  await Promise.race([gate.promise,new Promise((_,reject)=>{
   const poll=()=>{if(options.shouldCancel?.())reject(new RemoteReadingGatewayError('cancelled','Core operation cancelled'));else timer=setTimeout(poll,2)};poll();
  })]);
 } finally {clearTimeout(timer)}
}
function fixture({cooperativeCancellation=false}={}){
 const calls=[],rows=new Map(),catalogs=new Map(),modes=new Map(),gates=new Map(),detailAuthors=new Map(),detailProofs=new Map();let version='v1',enabled=true;
 const key=(s,b)=>JSON.stringify([s,b]);
 const runtime=new BookAcquisitionCoordinator(async(method,params,options)=>{
  calls.push({method,params,options});const sourceId=params.sourceId??params.origin;const bookId=params.bookId??params.book?.bookId??params.bookUrl;const id=key(sourceId,bookId);
  const gate=gates.get(method==='source.list'?'sources':`${method}:${id}`);
  if(gate){if(cooperativeCancellation)await simulatedCoreGate(gate,options);else await gate.promise;}
  if(method==='source.list')return {data:{sources:['s1','s2','s3','s4','s5'].map(sourceId=>({sourceId,name:sourceId,enabled,sourceVersion:version}))}};
  if(method==='source.delete'){enabled=false;return{data:{deleted:1}}}
  if(method==='search-book.get')return {data:{book:rows.get(id)??null}};
  if(method==='cache.book.status'){const toc=catalogs.get(id)??[];return {data:{sourceId,bookId,tocAvailable:toc.length>0,chapters:toc.map(e=>({chapterIndex:e.index,title:e.title,url:e.url,variables:{}})),continuationVariables:{}}}}
  if(method==='reading.progress.get')return {data:{found:false,progress:null}};
  if(method==='book.detail'){
   const mode=modes.get(id);if(mode instanceof Error)throw mode;
   const author=detailAuthors.get(id)??'关关公子';
   const authorIdentity=detailProofs.get(id);
   rows.set(id,{origin:sourceId,bookUrl:bookId,name:'鸣龙',author,variable:'{}',time:Date.now(),acquisition:{sourceVersion:version,detailAt:Date.now(),authorIdentity}});
   return {data:{sourceId,sourceVersion:version,book:{bookId,title:'鸣龙',author,authorIdentity},tocUrl:`${bookId}/toc`,variables:{token:'detail'}}};
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
 return {runtime,owner:{bookAcquisitions:()=>runtime,request:(...a)=>runtime.request(...a)},calls,rows,catalogs,modes,gates,detailAuthors,detailProofs,key,setVersion:v=>version=v};
}
const outcomes=[];
async function check(name,body){try{await body();outcomes.push({name,status:'PASS'})}catch(error){outcomes.push({name,status:'FAIL',error:error.stack})}}
await check('visible groups cap six, concurrency two; speculative work has no progress/body/verdict-success',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);f.gates.set(`book.detail:${f.key('s1','/b1')}`,gate);
 f.runtime.prepareGroups(Array.from({length:2000},(_,i)=>[candidate(i)]));await until(()=>f.calls.filter(c=>c.method==='book.detail').length===2);
 assert.equal(f.runtime.pending.size,4);assert.equal(f.runtime.preparationActive,2);gate.resolve();await until(()=>f.runtime.preparationActive===0);
 assert.equal(f.calls.filter(c=>c.method==='book.toc').length,6);assert.equal(f.calls.some(c=>['chapter.content','reading.progress.get','search-book.put'].includes(c.method)),false);
 }finally{f.runtime.close()}
});
await check('visible failed catalog tries another same-book candidate without body work',async()=>{
 const f=fixture();try{f.modes.set(f.key('s1','/b0'),'empty');f.runtime.prepareGroups([[candidate(0),candidate(0,'s2')]]);await until(()=>f.runtime.preparationActive===0);
 assert.deepEqual(f.calls.filter(c=>c.method==='book.toc').map(c=>c.params.sourceId),['s1','s2']);assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
 }finally{f.runtime.close()}
});
await check('foreground preempts unrelated started preparation, propagates cancellation and resumes it without unhealthy proof',async()=>{
 const f=fixture();try{const background=deferred(),foreground=deferred();
 f.gates.set(`book.detail:${f.key('s1','/b0')}`,background);f.gates.set(`book.detail:${f.key('s2','/b1')}`,foreground);
 f.runtime.prepareGroups([[candidate(0)]]);await until(()=>f.calls.some(c=>c.method==='book.detail'));
 const backgroundCall=f.calls.find(c=>c.method==='book.detail');
 const requested=f.runtime.acquireBook(seed(1,'s2'));
 await until(()=>f.calls.some(c=>c.method==='book.detail'&&c.params.sourceId==='s2'));
 assert.equal(backgroundCall.options.shouldCancel(),true,'actual Core callback receives preemption');background.resolve();
 await until(()=>f.runtime.preparationActive===0);assert.equal(f.calls.filter(c=>c.method==='book.detail'&&c.params.sourceId==='s1').length,1,'no restart while foreground owns chain');
 assert.equal(f.calls.some(c=>c.method==='search-book.put'&&c.params.origin==='s1'),false);
 foreground.resolve();await requested;await until(()=>f.calls.filter(c=>c.method==='book.detail'&&c.params.sourceId==='s1').length===2&&f.runtime.preparationActive===0);
 }finally{f.runtime.close()}
});
await check('foreground joins same prepared book instead of cancelling its only active request',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);
 f.runtime.prepareGroups([[candidate(0)]]);await until(()=>f.calls.some(c=>c.method==='book.detail'));
 const original=f.calls.find(c=>c.method==='book.detail');const joined=f.runtime.acquireBook(seed(0));await pause();
 assert.equal(original.options.shouldCancel(),false);gate.resolve();await joined;await until(()=>f.runtime.preparationActive===0);
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
 }finally{f.runtime.close()}
});
await check('only background rounds cap unknown candidates; foreground fourth source succeeds',async()=>{
 const f=fixture();try{for(const s of ['s1','s2','s3','s4'])f.modes.set(f.key(s,'/b0'),'empty');
 await assert.rejects(f.runtime.acquireCandidateGroup(['s1','s2','s3','s4'].map(s=>candidate(0,s)), {}, 'background'));assert.equal(f.calls.filter(c=>c.method==='book.toc').length,3);
 f.modes.delete(f.key('s4','/b0')); f.calls.length=0;
 const fourth=await f.runtime.acquireCandidateGroup(['s1','s2','s3','s4'].map(s=>candidate(0,s)));
 assert.equal(fourth.session.identity.sourceId,'s4');assert.equal(f.calls.filter(c=>c.method==='book.toc').length,4);
 f.calls.length=0;await f.runtime.acquireBook(seed(0,'s5'));f.calls.length=0;
 const result=await f.runtime.acquireCandidateGroup([...['s1','s2','s3','s4'].map(s=>candidate(0,s)),candidate(0,'s5',true)]);
 assert.equal(result.session.identity.sourceId,'s5');assert.equal(f.calls.length,0,'already-successful candidate is neither blocked nor re-fetched');
 }finally{f.runtime.close()}
});
for(const code of ['cancelled','identityMismatch','sourceVersionChanged','storageFailure']){
 await check(`${code} stops group fallback`,async()=>{const f=fixture();try{f.modes.set(f.key('s1','/b0'),new RemoteReadingGatewayError(code,'blocked','book.detail'));
 await assert.rejects(f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')]),e=>e.code===code);
 assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 }finally{f.runtime.close()}});
}
await check('source-local capability failure tries independent same-book source',async()=>{
 const f=fixture();try{f.modes.set(f.key('s1','/b0'),new RemoteReadingGatewayError('unsupportedHostCapability','blocked','book.detail'));
 const admitted=await f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')]);assert.equal(admitted.session.identity.sourceId,'s2');
 }finally{f.runtime.close()}
});
await check('proxy/DNS environment failure stops source churn without candidate health penalty',async()=>{
 const f=fixture();try{f.modes.set(f.key('s1','/b0'),new RemoteReadingGatewayError('networkEnvironment','代理路由暂不可用','book.detail',undefined,undefined,undefined,'NETWORK_ENVIRONMENT'));
 await assert.rejects(f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')]),e=>e.category==='NETWORK_ENVIRONMENT');
 assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 assert.equal(f.calls.some(c=>c.method==='search-book.put'),false,'environment failure never publishes a bad-source fact');
 }finally{f.runtime.close()}
});
await check('whole foreground deadline includes waiting; process completion cannot publish late catalog',async()=>{
 const f=fixture();try{const gate=deferred(),catalogs=[];f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);
 const start=Date.now();await assert.rejects(f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')],{budgetMs:30,onCatalog:s=>catalogs.push(s)}),e=>e.code==='cancelled'&&/超时/.test(e.message));
 assert.ok(Date.now()-start<500);assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);gate.resolve();await pause();await pause();assert.equal(catalogs.length,0);
 }finally{f.runtime.close()}
});
await check('cancel waiting foreground releases consumer promptly and does not try next source',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);let current=true;
 const admission=f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')],{isCurrent:()=>current});await until(()=>f.calls.some(c=>c.method==='book.detail'));current=false;
 await assert.rejects(admission,e=>e.code==='cancelled');gate.resolve();assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 }finally{f.runtime.close()}
});
for(const reason of ['user','deadline'])await check(`${reason} cancels orphan foreground Core work, frees slots and allows another book`,async()=>{
 const f=fixture({cooperativeCancellation:true});try{
  const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);let current=true;
  const admission=f.runtime.acquireCandidateGroup([candidate(0),candidate(0,'s2')],{
   isCurrent:()=>current,budgetMs:reason==='deadline'?35:1000});
  await until(()=>f.calls.some(c=>c.method==='book.detail'));
  const first=f.calls.find(c=>c.method==='book.detail');if(reason==='user')current=false;
  await assert.rejects(admission,e=>e.code==='cancelled');
  assert.equal(first.options.shouldCancel(),true,'the actual Core request receives cancellation');
  await until(()=>f.runtime.scheduler.active===0&&f.runtime.jobs.size===0&&f.runtime.foregroundRequests===0);
  assert.equal(f.calls.some(c=>c.method==='book.toc'||c.method==='search-book.put'),false,'orphan cannot fetch TOC or publish source health');
  assert.equal(f.runtime.prepared.size,0);assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false,'cancel does not retry the group');
  const next=await f.runtime.acquireBook(seed(1,'s2'));assert.equal(next.identity.bookId,'/b1');
  assert.equal(first.options.shouldCancel(),true,'later foreground work cannot revive the old Core operation');
 }finally{f.runtime.close()}
});
for(const otherPriority of ['foreground','background'])await check(`one cancelled caller preserves a live same-book ${otherPriority} consumer`,async()=>{
 const f=fixture({cooperativeCancellation:true});try{
  const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);let firstCurrent=true;
  const first=f.runtime.acquireBook(seed(0),{isCurrent:()=>firstCurrent});
  await until(()=>f.calls.some(c=>c.method==='book.detail'));
  const second=f.runtime.acquireBook(seed(0),{isCurrent:()=>true},otherPriority);
  firstCurrent=false;
  await assert.rejects(first,e=>e.code==='cancelled');
  const request=f.calls.find(c=>c.method==='book.detail');assert.equal(request.options.shouldCancel(),false);
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
  gate.resolve();const session=await second;assert.equal(session.identity.bookId,'/b0');
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  assert.equal(f.calls.some(c=>c.method==='search-book.put'),false,'a cancelled sibling cannot report source failure');
 }finally{f.runtime.close()}
});
await check('same-book reopen waits for cancelled Core operation and starts a new acquisition',async()=>{
 const f=fixture({cooperativeCancellation:true});try{
  const gate=deferred();f.gates.set(`book.detail:${f.key('s1','/b0')}`,gate);let current=true;
  const old=f.runtime.acquireBook(seed(0),{isCurrent:()=>current});const oldRejected=assert.rejects(old,e=>e.code==='cancelled');
  await until(()=>f.calls.some(c=>c.method==='book.detail'));
  const request=f.calls.find(c=>c.method==='book.detail');current=false;assert.equal(request.options.shouldCancel(),true);
  f.gates.delete(`book.detail:${f.key('s1','/b0')}`);
  const fresh=await f.runtime.acquireBook(seed(0));await oldRejected;
  assert.equal(fresh.identity.bookId,'/b0');assert.equal(request.options.shouldCancel(),true);
  assert.equal(f.calls.filter(c=>c.method==='book.detail').length,2,'reopen never joins an operation already cancelled by Core');
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 }finally{f.runtime.close()}
});
await check('same title with blank or conflicting author cannot authorize automatic source replacement',async()=>{
 for(const author of ['', '其他作者']){const f=fixture();try{const a=candidate(0),b=candidate(0,'s2');a.seed.author=author;f.modes.set(f.key('s1','/b0'),'empty');
 await assert.rejects(f.runtime.acquireCandidateGroup([a,b]));assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 }finally{f.runtime.close()}}
});
await check('author label variants use one identity across search candidate and acquired detail without rewriting raw metadata',async()=>{
 for(const [primaryAuthor,candidateAuthor,detailAuthor] of [
  ['作者：关关公子','关关公子','作者:关关公子'],
  ['关关公子',' 作 者 : 关关公子 ','关关公子'],
  ['浅草茉莉\n进入作者主页 →','浅草茉莉','作者：浅草茉莉\n进入作者主页 →'],
 ]){
  const f=fixture();try{
   const a=candidate(0),b=candidate(0,'s2');a.seed.author=primaryAuthor;b.seed.author=candidateAuthor;
   f.detailAuthors.set(f.key('s1','/b0'),primaryAuthor);f.detailAuthors.set(f.key('s2','/b0'),detailAuthor);
   f.modes.set(f.key('s1','/b0'),'empty');
   const admitted=await f.runtime.acquireCandidateGroup([a,b],{requireReadable:true});
   assert.equal(admitted.session.identity.sourceId,'s2');assert.equal(admitted.session.book.author,detailAuthor);
   assert.equal(f.rows.get(f.key('s2','/b0')).author,detailAuthor);
   assert.equal(a.seed.author,primaryAuthor);assert.equal(b.seed.author,candidateAuthor);
   assert.deepEqual(f.calls.filter(c=>c.method==='book.detail').map(c=>c.params.sourceId),['s1','s2']);
   assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1);
  }finally{f.runtime.close()}
 }
});
const authorProof=(raw,version='v1',field='search')=>({schemaVersion:1,sourceVersion:version,field,raw,label:raw.slice(1),rule:'author-nickname-at-v1'});
await check('source-bound author decoration admits same-book detail and body while preserving raw rules context',async()=>{
 for(const [primaryAuthor,decoratedAuthor] of [['关关公子','@关关公子'],['@真实笔名','@@真实笔名']]){
  const f=fixture();try{
   const a=candidate(0),b=candidate(0,'s2');a.seed.author=primaryAuthor;b.seed.author=decoratedAuthor;b.seed.authorIdentity=authorProof(decoratedAuthor);
   f.detailAuthors.set(f.key('s1','/b0'),primaryAuthor);f.detailAuthors.set(f.key('s2','/b0'),decoratedAuthor);
   f.detailProofs.set(f.key('s2','/b0'),authorProof(decoratedAuthor,'v1','detail'));f.modes.set(f.key('s1','/b0'),'empty');
   const admitted=await f.runtime.acquireCandidateGroup([a,b],{requireReadable:true});
   assert.equal(admitted.session.identity.sourceId,'s2');assert.equal(admitted.session.book.author,decoratedAuthor);
   assert.equal(admitted.session.book.authorIdentity.field,'detail');
   assert.equal(f.calls.find(c=>c.method==='book.detail'&&c.params.sourceId==='s2').params.book.author,decoratedAuthor);
   assert.equal(f.calls.find(c=>c.method==='book.detail'&&c.params.sourceId==='s2').params.book.authorIdentity,undefined,'proof never enters source JS context');
   assert.equal(f.rows.get(f.key('s2','/b0')).author,decoratedAuthor);assert.equal(admitted.session.preparedChapter.chapter.chapterIndex,0);
  }finally{f.runtime.close()}
 }
});
await check('genuine at-author and stale decorated proof cannot authorize another author',async()=>{
 for(const proof of [undefined,authorProof('@关关公子','old'),{...authorProof('@关关公子'),label:'其他作者'}]){
  const f=fixture();try{const a=candidate(0),b=candidate(0,'s2');b.seed.author='@关关公子';b.seed.authorIdentity=proof;f.modes.set(f.key('s1','/b0'),'empty');
   await assert.rejects(f.runtime.acquireCandidateGroup([a,b]));assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
  }finally{f.runtime.close()}
 }
});
await check('a recognized author template with an empty nickname remains unknown and cannot authorize fallback',async()=>{
 const f=fixture();try{const a=candidate(0),b=candidate(0,'s2');a.seed.author='@';a.seed.authorIdentity=authorProof('@');b.seed.author='@';
  f.detailAuthors.set(f.key('s1','/b0'),'@');f.detailProofs.set(f.key('s1','/b0'),authorProof('@','v1','detail'));f.modes.set(f.key('s1','/b0'),'empty');
  await assert.rejects(f.runtime.acquireCandidateGroup([a,b]));assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 }finally{f.runtime.close()}
});
await check('acquired detail must revalidate decorated author against its own current proof',async()=>{
 for(const proof of [undefined,authorProof('@关关公子','old')]){
  const f=fixture();try{const a=candidate(0);f.detailAuthors.set(f.key('s1','/b0'),'@关关公子');f.detailProofs.set(f.key('s1','/b0'),proof);
   await assert.rejects(f.runtime.acquireCandidateGroup([a],{requireReadable:true}));assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
  }finally{f.runtime.close()}
 }
});
await check('bounded author metadata policy cannot authorize a different or missing author',async()=>{
 for(const author of ['作者关关公子','关关公子（笔名）','浅草茉莉','作者：','关关公子 进入作者主页 →']){
  const f=fixture();try{
   const a=candidate(0),b=candidate(0,'s2');b.seed.author=author;
   f.modes.set(f.key('s1','/b0'),'empty');
   await assert.rejects(f.runtime.acquireCandidateGroup([a,b]));
   assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false,author);
  }finally{f.runtime.close()}
 }
});
await check('a matching normalized search author still requires the acquired detail author to match',async()=>{
 const f=fixture();try{
  const a=candidate(0),b=candidate(0,'s2');a.seed.author='作者：关关公子';
  f.detailAuthors.set(f.key('s1','/b0'),'作者：其他作者');
  const admitted=await f.runtime.acquireCandidateGroup([a,b],{requireReadable:true});
  assert.equal(admitted.session.identity.sourceId,'s2');
  assert.equal(f.calls.some(c=>c.method==='chapter.content'&&c.params.sourceId==='s1'),false);
 }finally{f.runtime.close()}
});
await check('hidden source-wait pauses and resumes same visible group once without cancellation',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set('sources',gate);const groups=[[candidate(0)]];f.runtime.prepareGroups(groups);await pause();
 f.runtime.setPreparationVisible(false);gate.resolve();for(let i=0;i<6;i++)await pause();
 assert.equal(f.calls.some(c=>c.method==='book.detail'),false,'hidden work stays paused');
 assert.equal(f.runtime.preparationActive,1,'an admitted preparation keeps ownership while hidden');
 f.runtime.setPreparationVisible(true);await until(()=>f.runtime.preparationActive===0&&f.calls.some(c=>c.method==='book.toc'));
 f.runtime.prepareGroups(groups);await pause();assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
 }finally{f.runtime.close()}
});
await check('query replacement drops old waiting groups; old admitted work cannot enqueue old fallback',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set(`book.toc:${f.key('s1','/b0')}`,gate);f.modes.set(f.key('s1','/b0'),'empty');
 f.runtime.prepareGroups([[candidate(0),candidate(0,'s2')]]);await until(()=>f.calls.some(c=>c.method==='book.toc'));
 f.runtime.beginSearch();f.runtime.prepareGroups([[candidate(1,'s3')]]);gate.resolve();await until(()=>f.runtime.preparationActive===0);
 assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);assert.equal(f.calls.filter(c=>c.method==='book.toc'&&c.params.sourceId==='s3').length,1);
 }finally{f.runtime.close()}
});
await check('fresh prepared reused; stale catalog refresh failure handled and original promise rejects',async()=>{
 const f=fixture();const unhandled=[];const observe=e=>unhandled.push(e);process.on('unhandledRejection',observe);try{
 const first=await f.runtime.acquireBook(seed(0));const fresh=await f.runtime.acquireBookWithBackgroundRefresh(seed(0));assert.equal(fresh.session,first);assert.equal(fresh.backgroundRefresh,undefined);
 f.runtime.prepared.clear();f.rows.get(f.key('s1','/b0')).acquisition.catalogAt=Date.now()-86400001;
 f.modes.set(f.key('s1','/b0'),new RemoteReadingGatewayError('commandFailed','HTTP failed','book.detail'));
 const stale=await f.runtime.acquireBookWithBackgroundRefresh(seed(0));assert.ok(stale.backgroundRefresh);await assert.rejects(stale.backgroundRefresh);await pause();assert.equal(unhandled.length,0);
 }finally{process.removeListener('unhandledRejection',observe);f.runtime.close()}
});
await check('change notification batches actual identities and source mutation resets',async()=>{
 const f=fixture();try{const changes=[];f.runtime.subscribe(c=>changes.push(c));await f.runtime.request('book.search',{sourceId:'s1',keyword:'鸣龙'});
 await f.runtime.acquireBook(seed(0));await until(()=>changes.length>0);const ids=changes.flatMap(c=>c.identities).map(x=>f.key(x.sourceId,x.bookId));assert.ok(ids.includes(f.key('s1','/new')));assert.ok(ids.includes(f.key('s1','/b0')));
 await f.runtime.request('source.delete',{sourceId:'s1'});await until(()=>changes.some(c=>c.reset));
 }finally{f.runtime.close()}
});
// Extract the actual admission wrapper class as well as Index's ordinary methods.
const indexSource=readFileSync(path('pages/Index.ets'),'utf8');
const admissionSource=indexSource.slice(indexSource.indexOf('class RemoteDetailAdmission {'),indexSource.indexOf('class RemoteSessionAttemptOutcome {'));
const RemoteDetailAdmission=new Function(stripTypeScriptTypes(admissionSource)+';return RemoteDetailAdmission;')();
function indexFixture(f){
 const errors=[];const Index=productionMotionMethods(path('pages/Index.ets'),['refreshDetailAcquisitionProjection','installRemoteReadingSession','onSearchResultSelected','searchAcquisitionCandidate','remoteSeedForSearchBook','openRemoteBookDetail','nextNavigationGeneration','readingDetailForRemoteSeed','probeRemoteContentVerdict','remoteContentVerdictLabel'],{
 sameRemoteSessionEvidence,preparedRemoteChapterMatches,withPreparedRemoteChapter,copyRemoteReadingSession,errorMessageOf,ReaderRuntimeOwner:{current:()=>f.owner},RemoteReadingFlowGateway,RemoteChapterCacheRefreshError,RemoteReadingGatewayError,remoteReadingFailureRecord,remoteReadingFailureKindOf,verdictForFailureKind,RemoteDetailAdmission,searchCandidateRank,
 ReadingOfflineGateway:class{},ReaderCoreGateway:class{async loadShelfBook(){return undefined}},LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{warn(){},error(){},info(){}}});
 const page=Object.assign(new Index(),{route:'search',shelfBooks:[],searchDetailCandidates:[],navigationGeneration:0,remoteSessionGeneration:0,remoteContentProbeGeneration:0,remoteCatalogRefreshAt:new Map(),offlineMutationGeneration:0,bookshelfRemovalActiveKey:'',showReadingFailure:(...a)=>errors.push(a),loadRemoteDirectoryProjection:async(_a,_b,s)=>s.entries});return{page,errors};
}
await check('real selected search group primary empty TOC admits second and probes only selected body; no shelf write',async()=>{
 const f=fixture();try{f.modes.set(f.key('s1','/b0'),'empty');const {page,errors}=indexFixture(f);page.onSearchResultSelected(book(0),[book(0),book(0,'s2')]);
 await until(()=>page.remoteContentVerdict==='readable'||errors.length>0);assert.deepEqual(errors,[]);assert.equal(page.detailBook.sourceId,'s2');assert.equal(page.detailBook.sourceName,'s2名称');assert.equal(page.detailReturnRoute,'search');assert.equal(page.detailInBookshelf,false);
 assert.deepEqual(f.calls.filter(c=>c.method==='chapter.content').map(c=>c.params.sourceId),['s2']);assert.equal(f.calls.some(c=>/bookshelf.put|source.switch|progress.update/.test(c.method)),false);
 }finally{f.runtime.close()}
});
await check('real search body failure tries second source and reuses admitted body exactly once',async()=>{
 const f=fixture();try{f.modes.set(`body:${f.key('s1','/b0')}`,new RemoteReadingGatewayError('invalidResponse','bad extraction','chapter.content'));
 const {page,errors}=indexFixture(f);page.onSearchResultSelected(book(0),[book(0),book(0,'s2')]);
 await until(()=>page.remoteContentVerdict==='readable'||errors.length>0);assert.deepEqual(errors,[]);assert.equal(page.detailBook.sourceId,'s2');
 assert.deepEqual(f.calls.filter(c=>c.method==='chapter.content').map(c=>c.params.sourceId),['s1','s2']);
 assert.equal(f.calls.some(c=>/bookshelf.put|source.switch|progress.update/.test(c.method)),false);
 assert.equal(f.rows.get(f.key('s1','/b0')).acquisition.failureStage,undefined,'a chapter failure does not invalidate entire book');
 }finally{f.runtime.close()}
});
await check('real search catalog is visible before delayed body completes',async()=>{
 const f=fixture();try{const gate=deferred();f.gates.set(`chapter.content:${f.key('s1','/b0')}`,gate);const {page,errors}=indexFixture(f);
 page.onSearchResultSelected(book(0),[book(0,'s2')]);await until(()=>f.calls.some(c=>c.method==='chapter.content'));
 assert.equal(page.detailBook.sourceId,'s1');assert.equal(page.detailToc.length,1);assert.equal(page.remoteContentVerdict,'verifying');const calls=f.calls.length;await page.refreshDetailAcquisitionProjection();assert.equal(f.calls.length,calls,'catalog notification cannot duplicate active body probe');gate.resolve();
 await until(()=>page.remoteContentVerdict==='readable'||errors.length>0);assert.deepEqual(errors,[]);
 }finally{f.runtime.close()}
});
await check('real body storage failure stops group and preserves visible admitted catalog',async()=>{
 const f=fixture();try{f.modes.set(`body:${f.key('s1','/b0')}`,new RemoteReadingGatewayError('storageFailure','storage unavailable','chapter.content'));
 const {page,errors}=indexFixture(f);page.onSearchResultSelected(book(0),[book(0,'s2')]);await until(()=>errors.length>0);
 assert.equal(page.detailBook.sourceId,'s1');assert.equal(page.detailToc.length,1);assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);await pause();const calls=f.calls.length;await page.refreshDetailAcquisitionProjection();assert.equal(f.calls.length,calls,'terminal failure does not trigger automatic notification retries');
 }finally{f.runtime.close()}
});
for(const mode of ['shelf','explicit'])await check(`${mode} fixed source never auto-falls back`,async()=>{
 const f=fixture();try{f.modes.set(f.key('s1','/b0'),'empty');const {page,errors}=indexFixture(f);const primary=book(0),other=book(0,'s2');page.searchDetailCandidates=[primary,other];
 if(mode==='explicit')page.route='detail';const shelf=mode==='shelf'?primary:undefined;
 page.openRemoteBookDetail(seed(0),'s1名称',shelf,false,[seed(0,'s2')],['s2名称']);await until(()=>errors.length>0);
 assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);assert.equal(page.detailBook.sourceId,'s1');
 }finally{f.runtime.close()}
});
await check('visible range callback bounds group count, skips unchanged rows and clears stopped view',async()=>{
 const Page=productionMotionMethods(path('features/search/SearchPage.ets'),['publishVisibleGroups']);const calls=[];const page=Object.assign(new Page(),{presentation:{kind:'results'},visibleStart:0,visibleEnd:0,warmupGroups:[],visibleGroups:Array.from({length:2000},(_,i)=>({book:book(i),variants:[book(i)]})),onVisibleGroups:g=>calls.push(g)});
 page.publishVisibleGroups(10,25);assert.equal(calls[0].length,6);assert.equal(calls[0][0][0].bookId,'/b10');page.publishVisibleGroups(10,25);assert.equal(calls.length,1);
 page.presentation={kind:'results',stopped:true};page.publishVisibleGroups();assert.equal(calls.at(-1).length,0);
});
console.log(JSON.stringify({evidenceLayer:'SDK-extracted production methods and actual Coordinator/Gateway; synthetic RPC boundary, no device',outcomes},null,2));
assert.equal(outcomes.filter(x=>x.status==='FAIL').length,0);
