import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'entry-route':{description:'Actual EntryActions/Presentation/Navigation route, failure and independent directory admission',resources:[]},'source-compensation':{description:'Actual SourceSwitch transaction compensation, original anchor and stale owner protections',resources:[]}});
async function run(selectedCase){
const {default:assert}=await import('node:assert/strict');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const {fixture:sourceFixture,origin,target,session:defaultSession,settle:ownerSettled,deferred,ReaderCoreRequestError}=await import('./lib/source-switch-owner-probe.mjs');
const {directEntryCurrentOwnerFixture}=await import('./lib/direct-entry-current-owner-probe.mjs');
const {compileHost,setRuntime}=await import('./lib/reading-entry-owner-probe.mjs');
const {RemoteReadingGatewayError}=await import('../entry/src/main/ets/features/reading/application/RemoteReadingContract.ts');
const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts');
const settle=async()=>{await ownerSettled();await new Promise(setImmediate);await ownerSettled();};
const checks=[];
const book=origin;
const session={...defaultSession,entries:[{index:17,title:'第十一章',url:'https://target/0',variables:[]}]};
let canonicalShelf,localConstructions=0;
// The emitted production classes do not depend on an individual case. Compile
// them once, while keeping every Runtime, owner, property instance and fixture
// callback fresh. Current owner declaration factories are shared across the
// same original 27 journeys; no retired Index or unrelated UI graph is rebuilt.
const reading=compileHost(undefined,{LocalReadingFlowGateway:class extends LocalReadingFlowGateway{constructor(...args){super(...args);localConstructions++;}async loadToc(){return{entries:[{index:0,title:'本地第一章',url:'/0'}]};}},
  RemoteReadingFlowGateway:class extends RemoteReadingFlowGateway{async loadChapter(s,n){return{sourceId:s.identity.sourceId,bookId:s.identity.bookId,chapterIndex:n,chapterUrl:s.entries.find(e=>e.index===n)?.url,content:'正文',contentVersion:'v',images:[]};}},
  ReaderCoreGateway:class{async loadShelfBook(){return canonicalShelf;}},ReadingOfflineGateway:class{async loadDirectoryProjection(s){return s.entries;}}});
const ownerFixtures=[];
function fixture(options={}){
 const f=sourceFixture({shared:true,open:false,targetSession:session,matchedChapterIndex:17,...options});
 const requests=f.runtime.request.bind(f.runtime);
 setRuntime(f.runtime);
 f.runtime.noteReadingPreparationIntent=()=>{};
 f.runtime.request=async(m,p,o)=>{
  if(m==='bookmark.list')return{data:{bookmarks:[]}};
  if(m==='reading.progress.get'){
   f.calls.push([m,p,o]);
   if(options.progressFailure)throw options.progressFailure;
   if(options.progressMissing)return{data:{found:false,progress:null,progressRevision:'r1'}};
   return{data:{found:true,progressRevision:'r1',progress:{sourceId:p.sourceId,bookId:p.bookId,chapterIndex:options.progressIndex??11,chapterOffset:52,chapterProgress:0,updatedAt:1}}};
  }
  if(m==='bookshelf.get'&&(options.shelfOverride||p.sourceId==='local'))return{data:{book:canonicalShelf??null}};
  return requests(m,p,o);
 };
 const acquire=f.runtime.bookAcquisitions;f.runtime.bookAcquisitions=()=>({...acquire(),readingProjectionRevision:()=>0,setPreparationVisible(){},endSearch(){}});
 const x=directEntryCurrentOwnerFixture(f,reading,book,async()=>canonicalShelf);ownerFixtures.push(x);
 const open=async()=>{x.switchJourney.openDetail();await settle();assert.equal(x.source.state.kind,'candidates');};
 const pick=async()=>{await open();x.source.pickText(f.candidate(),x.source.scopeId);await settle();};
 return{...f,...x,open,pick,bind:x.bindSource,options};

}
async function check(name,run){
 const sourceCase=/^(durable-anchor|missing-and-invalid-anchor|startup-original|pending-choice|late-compensation|uncertain-compensation|exact-target|failed-target|canonical-book|coarse-anchor)/.test(name);
 if(sourceCase!==(selectedCase==='source-compensation'))return;
 let timer;try{await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('journey did not settle')),2000);})]);checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.message});}finally{clearTimeout(timer);}}
for(const sourceId of ['local','online'])await check('network-free-reading-route-'+sourceId,async()=>{
 const t=fixture(),h=t;h.entry.book={...book,sourceId};h.actions.openReading(undefined);
 assert.equal(h.navigation.snapshot().route,'reading');assert.equal(h.entry.sessionActive,true);assert.equal(h.entry.session,undefined);assert.deepEqual(h.entry.toc,[]);
 const n=h.navigation.snapshot().generation;h.actions.openReading(999);assert.equal(h.navigation.snapshot().generation,n);
});
await check('shelf-immediate-local-and-remote-owner-admission',async()=>{
 const t=fixture(),h=t;h.navigation.show('bookshelf');h.navigation.returns.rememberBookshelfReaderOrigin();
 h.actions.openRemoteDetail({seed:{...book,detailUrl:book.bookId},sourceName:'Old',shelfSnapshot:book,resumeImmediately:true});
 assert.equal(h.navigation.snapshot().route,'reading');assert.equal(h.entry.seed.detailUrl,book.bookId);assert.equal(h.entry.inBookshelf,true);
 assert.equal(h.entry.session,undefined,'first route does not invent a prepared session');
 const l=fixture();l.navigation.show('bookshelf');l.navigation.returns.rememberBookshelfReaderOrigin();const before=localConstructions;l.actions.openLocalDetail({...book,sourceId:'local'},true);
 assert.equal(localConstructions,before,'first shelf route does not await TOC');assert.equal(l.navigation.snapshot().route,'reading');assert.equal(l.entry.sessionActive,true);
});
await check('body-failure-and-late-session-stay-on-original-reader',async()=>{
 const t=fixture(),h=t;h.actions.openReading(undefined);h.actions.acceptReaderSession(session);assert.equal(h.entry.session,undefined);
 const current={...session,identity:{sourceId:book.sourceId,bookId:book.bookId}};h.actions.acceptReaderSession(current);assert.equal(h.entry.session,current);assert.equal(h.entry.toc[0].index,17);
 const pending={transactionId:'pending'};h.source.pending=pending;h.entry.projectReaderFailure(book.sourceId,book.bookId,'正文处理设置已改变','POSITION_CONFLICT');
 assert.equal(h.navigation.snapshot().route,'reading');assert.equal(h.source.pending,pending);assert.equal(h.entry.loadingMessage,'正文处理设置已改变');
 h.entry.projectReaderFailure('other','other','stale');assert.equal(h.entry.loadingMessage,'正文处理设置已改变');
});
await check('empty-independent-directory-route',async()=>{
 const t=fixture(),h=t;h.bindReader();h.directory.open('detail');
 assert.equal(h.navigation.snapshot().route,'directory');assert.equal(h.entry.sessionActive,false);assert.equal(h.navigation.snapshot().directoryReturnTarget,'detail');
 await settle();const reads=t.calls.filter(([method])=>method==='reading.progress.get');
 assert.equal(reads.length,1);assert.deepEqual(reads[0][1],{sourceId:book.sourceId,bookId:book.bookId});
 assert.equal(h.entry.directoryCurrentChapterIndex,11,'empty TOC retains only the original Host/Gateway canonical display anchor');
 assert.equal(h.entry.requestedChapterIndex,undefined);assert.equal(h.entry.sessionActive,false);
 assert.equal(t.calls.some(([method])=>['reading.progress.update','book.detail','book.toc','chapter.content'].includes(method)),false,'directory display cannot acquire body/catalog or save progress');
});
for(const toc of [[],[{index:2,title:'可见章节',navigable:true}]])await check('durable-anchor-with-paged-or-empty-toc-'+toc.length,async()=>{
 const t=fixture();t.entry.toc=toc;t.controls.shelfBooks=[];await t.pick();const p=t.calls.find(([m])=>m==='source.switch.commit')[1];
 assert.equal(p.from.sourceId,book.sourceId);assert.equal(p.currentChapterIndex,11);assert.equal(p.currentChapterTitle,'');
 assert.equal(t.entry.session.entries,session.entries);assert.equal(t.entry.requestedChapterIndex,17);
});
await check('missing-and-invalid-anchor-refused-by-original-owner',async()=>{
 const t=fixture();t.bind();assert.throws(()=>t.host.resolveAnchor({kind:'missing'}),/没有可核对/);assert.throws(()=>t.host.resolveAnchor({kind:'restored',progress:{chapterIndex:-1}}),/没有可核对/);
});
const oldPending=()=>({fromSourceId:'original-source',fromBookId:'original-book',targetSourceId:book.sourceId,targetBookId:book.bookId,targetChapterIndex:11,transactionId:'pending-1'});
const originalBook={...book,sourceId:'original-source',bookId:'original-book',currentChapterIndex:11,currentChapterTitle:'第十一章'};
await check('startup-original-pending-selection-does-not-compensate',async()=>{
 const t=fixture(),h=t;h.entry.sessionActive=true;h.navigation.show('reading');let reads=0;
 t.host.gateway.listPendingSwitches=async()=>{reads++;return[oldPending(),{...oldPending(),transactionId:'unrelated',targetSourceId:'another'}];};
 t.host.gateway.rollbackSwitch=async()=>assert.fail('startup cannot undo source');await h.source.inspectPending(()=>h.switchJourney.scene(),()=>{},()=>{},()=>{});assert.equal(h.source.pending,undefined);
 assert.equal(await h.source.resolveReaderTransaction({sourceId:book.sourceId,bookId:book.bookId},h.switchJourney.workflow()),'pending-1');assert.equal(h.source.pending.targetChapterIndex,-1);
 assert.equal(await h.source.resolveReaderTransaction({sourceId:book.sourceId,bookId:book.bookId},h.switchJourney.workflow()),'pending-1');assert.equal(reads,2);assert.equal(await h.source.resolveReaderTransaction({sourceId:'stale',bookId:'stale'},h.switchJourney.workflow()),undefined);
});
await check('pending-choice-restores-original-before-next-acquisition',async()=>{
 const t=fixture(),h=t,calls=[];
 t.host.gateway.listPendingSwitches=async()=>[oldPending()];
 t.host.gateway.rollbackSwitch=async(id,_current,e)=>{calls.push('rollback');assert.equal(id,'pending-1');e.dispatched();e.confirmed();return{restoredBook:originalBook};};
 const fetch=t.host.gateway.fetchTargetToc.bind(t.host.gateway);t.host.gateway.fetchTargetToc=async(...args)=>{calls.push('fetch');return fetch(...args);};
 const native=t.runtime.request.bind(t.runtime);t.runtime.request=async(m,p,o)=>{if(m==='source.switch.commit'){calls.push('commit');assert.equal(p.from.sourceId,originalBook.sourceId);assert.equal(p.currentChapterIndex,11);}return native(m,p,o);};
 await t.pick();assert.deepEqual(calls,['rollback','fetch','commit'],JSON.stringify(t.host.current()));assert.equal(h.navigation.snapshot().route,'reading');assert.equal(h.entry.session.entries,session.entries);
 assert.equal(t.host.current().pending.fromSourceId,originalBook.sourceId);assert.notEqual(t.host.current().pending.transactionId,'pending-1');
});
await check('late-compensation-cannot-replace-successor-book',async()=>{
 const t=fixture(),gate=deferred();t.bind();t.host.snapshot={...t.host.snapshot,pending:oldPending()};t.host.gateway.rollbackSwitch=()=>gate.promise;
 const p=t.host.prepareNextChoice(t.host.generation);t.navigation.advance();const newer={...book,bookId:'newer'};t.entry.book=newer;gate.resolve({restoredBook:originalBook});
 await assert.rejects(p,/aborted/);assert.equal(t.entry.book,newer);assert.equal(t.host.current().pending.transactionId,'pending-1');
});
for(const mode of ['finalized','generic-error','still-pending','missing-target','list-failed'])await check('uncertain-compensation-'+mode,async()=>{
 const t=fixture();t.navigation.show('reading');t.entry.sessionActive=true;t.bind();t.host.snapshot={...t.host.snapshot,pending:oldPending()};canonicalShelf=mode==='missing-target'?undefined:{...book};
 const error=new ReaderCoreRequestError({error:{code:'INVALID_PARAMS',message:'finalized',details:{reason:'already_finalized',transactionId:'pending-1'}}});
 t.host.gateway.rollbackSwitch=async()=>{throw mode==='generic-error'?Error('already_finalized'):error;};
 t.host.gateway.listPendingSwitches=async()=>{if(mode==='list-failed')throw Error('list failure');return mode==='still-pending'?[oldPending()]:[];};
 t.host.shelf.loadShelfBook=async()=>canonicalShelf;
 if(mode==='finalized'){assert.equal((await t.host.prepareNextChoice(t.host.generation)).sourceId,book.sourceId);assert.equal(t.host.current().pending,undefined);assert.equal(t.navigation.snapshot().route,'reading');}
 else{await assert.rejects(t.host.prepareNextChoice(t.host.generation));assert.equal(t.host.current().pending.transactionId,'pending-1');}
});
await check('exact-target-session-and-body-failure-keep-durable-transaction',async()=>{
 const t=fixture();t.entry.toc=[{index:11,title:'第十一章',navigable:true}];await t.pick();
 const commits=t.calls.filter(([m])=>m==='source.switch.commit');assert.equal(commits.length,1);assert.equal(commits[0][1].currentChapterIndex,11);assert.equal(commits[0][1].currentChapterTitle,'第十一章');
 assert.equal(t.calls.filter(([m])=>m==='reading.progress.get').length,1);
 assert.equal(t.entry.session.entries,session.entries);assert.equal(t.navigation.snapshot().route,'reading');const tx=t.source.pending.transactionId;
 t.entry.projectReaderFailure(target.sourceId,target.bookId,'解析失败','SOURCE_CONTENT_EMPTY');assert.equal(t.source.pending.transactionId,tx);assert.equal(t.navigation.snapshot().route,'reading');
});
await check('failed-target-acquisition-retry-is-scoped',async()=>{
 const t=fixture({failAcquire:true});await t.pick();assert.equal(t.navigation.snapshot().route,'reading');assert.equal(t.entry.book.sourceId,book.sourceId);assert.equal(t.source.visible,false);
 assert.equal(t.calls.filter(([m])=>m==='source.switch.commit').length,0);const before=t.calls.filter(([m])=>m==='acquire').length;t.source.retryTextFailure(t.source.scopeId);await settle();
 assert.equal(t.calls.filter(([m])=>m==='acquire').length,before+1);t.entry.book={...book,bookId:'different'};t.source.retryTextFailure(t.source.scopeId);await settle();assert.equal(t.calls.filter(([m])=>m==='acquire').length,before+1);
});
await check('canonical-book-retains-target-body-and-requires-exact-finalization',async()=>{
 const t=fixture();t.entry.sessionActive=true;const stale={...session,book:{title:'旧别名',author:'旧作者'},contextVersion:'ctx',catalogVersion:'catalog',continuationVariables:[{name:'token',value:'kept'}]};
 const canonical={...book,...session.identity,title:'Core规范书名',author:'Core规范作者'};t.switchJourney.commit(canonical,stale,17);
 assert.equal(t.entry.book.title,canonical.title);assert.equal(t.entry.book.author,canonical.author);assert.equal(t.entry.session.entries,stale.entries);assert.equal(t.entry.session.continuationVariables,stale.continuationVariables);assert.equal(t.entry.session.contextVersion,'ctx');assert.equal(stale.book.title,'旧别名');
 // The earlier identity-only finalization expectation was unsafe: an exact
 // source transaction is now required. Prove both rejection and the real ACK.
 const n=fixture();await n.pick();const tx=n.host.current().pending.transactionId;n.entry.session=undefined;n.commits.accept({...target,chapterIndex:22,chapterOffset:61});assert.equal(n.host.current().pending.transactionId,tx);
 n.setPhase('finalized');n.commits.accept({...target,chapterIndex:22,chapterOffset:61,sourceSwitchTransactionId:tx});await settle();assert.equal(n.host.current().pending,undefined);assert.equal(n.cleanup.length,1);
});
for(const mode of ['toc-title','no-title','other-error','missing-index','stale'])await check('coarse-anchor-fallback-'+mode,async()=>{
 const failure=new RemoteReadingGatewayError(mode==='other-error'?'commandFailed':'positionContextStale','precise position unavailable');
 const t=fixture({progressFailure:failure,shelfOverride:true});canonicalShelf={...book,currentChapterIndex:mode==='missing-index'?undefined:11,currentChapterTitle:'可能错位的书架标题'};
 t.entry.toc=mode==='toc-title'?[{index:11,title:'真实第十一章'}]:[];await t.open();t.source.pickText(t.candidate(),t.source.scopeId);if(mode==='stale')t.navigation.advance();await settle();
 const commits=t.calls.filter(([m])=>m==='source.switch.commit');assert.equal(commits.length,mode==='toc-title'||mode==='no-title'?1:0);
 if(commits.length){assert.equal(commits[0][1].currentChapterIndex,11);assert.equal(commits[0][1].currentChapterTitle,mode==='toc-title'?'真实第十一章':'');}
 if(mode==='other-error'||mode==='missing-index'){
  assert.equal(t.source.failureMessage,mode==='other-error'?'当前网络无法获取书籍，请检查网络连接后重试。':'换源暂时未完成，请重试或选择其他书源。');
  assert.equal(t.host.lastFailure,failure,'original typed diagnostic remains with the actual source-switch owner');
  assert.equal(t.host.lastFailure.message,'precise position unavailable');
  assert.equal(t.source.failureMessage.includes(failure.message),false,'raw acquisition diagnostic never enters the public failure presentation');
 }
});
await check('reader-identity-retained-across-appearance',async()=>{
 const Shell=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderShell.ets',import.meta.url),['readingIdentityKey']);
 const s=Object.assign(new Shell(),{sourceId:'source',bookId:'book',fontSize:18}),key=s.readingIdentityKey();s.fontSize=24;assert.equal(s.readingIdentityKey(),key);s.sourceId='another';assert.notEqual(s.readingIdentityKey(),key);
});
await check('local-sparse-search-membership-loads-real-owner-record',async()=>{
 const t=fixture(),h=t;h.navigation.show('search');h.controls.shelfBooks=[];const result={sourceId:'local',sourceName:'本地',bookId:'import-real-id',title:'真实搜索书名',author:'作者',kind:'epub'};
 canonicalShelf={...result,addedAt:10,sortIndex:0,intro:'完整本地简介'};h.journey.selectResult(result, []);assert.equal(h.navigation.snapshot().route,'search');await settle();assert.equal(h.navigation.snapshot().route,'detail');assert.equal(h.entry.book.bookId,result.bookId);assert.equal(h.entry.book.title,result.title);assert.equal(h.entry.inBookshelf,true);assert.equal(h.entry.book.intro,'完整本地简介');assert.equal(h.navigation.returns.snapshot().detailParent,'search');assert.equal(h.entry.seed,undefined);await settle();assert.equal(h.entry.toc[0].title,'本地第一章');h.actions.openReading(undefined);assert.equal(h.navigation.snapshot().route,'reading');
});
await check('directory-honest-empty-error-copy',async()=>{
 const Directory=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/FullDirectoryPanel.ets',import.meta.url),['catalogEmptyMessage']),d=Object.assign(new Directory(),{entries:[],catalogMessage:'目录解析失败'});
 assert.equal(d.catalogEmptyMessage(),'目录解析失败');d.catalogMessage='';assert.match(d.catalogEmptyMessage(),/暂无可用章节/);d.entries=[{index:3,title:'已有章'}];assert.equal(d.catalogEmptyMessage(),'没有匹配的章节');
});
console.log(JSON.stringify({checks,evidenceLayer:'actual current navigation/entry/source/directory/commit owners; controlled gateway/OS seams, no device acceptance'}));

assert.equal(checks.length,selectedCase==='source-compensation'?19:8,'all original 27 journeys remain selected by their original two case IDs');
assert.equal(new Set(checks.map(x=>x.name)).size,checks.length,'each original journey is recorded exactly once');
assert.equal(checks.filter(c=>c.status==='FAIL').length,0,'original direct-entry recovery journeys must pass');
assert.equal(new Set(ownerFixtures.map(x=>x.actions.constructor)).size,1,'current action owner declaration factory is shared, not re-emitted per journey');
assert.equal(new Set(ownerFixtures.map(x=>x.entry)).size,ownerFixtures.length,'presentation states remain separate per journey');
assert.equal(new Set(ownerFixtures.map(x=>x.source)).size,ownerFixtures.length,'source states remain separate per journey');
assert.equal(new Set(ownerFixtures.map(x=>x.navigation)).size,ownerFixtures.length,'navigation states remain separate per journey');
assert.equal(new Set(ownerFixtures.map(x=>x.library.host.viewState)).size,ownerFixtures.length,'query view states remain separate per journey');
}
for(const id of selected){await run(id);recordContractCasePass(id);}
