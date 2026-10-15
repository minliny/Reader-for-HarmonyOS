import assert from 'node:assert/strict';
import {ProductionHost,compileHost,read,setRuntime,readingEvidence,content,BookAcquisitionCoordinator} from './lib/reading-entry-owner-probe.mjs';
import {fixture,deferred,tick,until,seed,book,session} from './lib/reading-entry-index-fixture.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {MangaBookPresentation} from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const checkpoints=[];
function mangaFixture(){
 const f=fixture(),sourceId='s1',bookId='book',chapterId='https://source/book/0',pageId='mp1:'+'1'.repeat(64);
 const manga={...session(),contentKind:'manga'};
 manga.entries=[{index:0,title:'卷一',url:'group',level:0,navigable:false},
  {index:1,title:'第一话',url:chapterId,level:1,navigable:true}];
 const chapter={chapterIndex:1,chapterTitle:'第一话',cached:false,
  manifest:{chapter:{sourceId,bookId,chapterId},sourceRuleVersion:'v1',manifestVersion:'manifest',decodeRevision:'identity-v1',
   pages:[{ordinal:0,pageId,resourceRef:'manga:'+pageId}]},resources:[{resourceRef:'manga:'+pageId,request:{url:'https://images.invalid/first'}}]};
 let imageGate,fail=false;const released=[];
 f.runtime.supportsCoreCapability=c=>c.startsWith('manga.');
 f.runtime.request=async(method,p,options)=>{f.calls.push({method,p,options});assert.equal(method,'manga.chapter.get','manga probe has no chapter.content lane');
  assert.equal(p.chapterIndex,1);assert.equal(p.policy,'cacheFirst');return {data:structuredClone(chapter)};};
 f.runtime.loadReadingImage=async(...args)=>{f.calls.push({method:'image',p:args});if(imageGate)await imageGate.promise;
  if(fail)throw Error('image missing');assert.equal(args[0],sourceId);assert.equal(args[1],bookId);assert.equal(args[2],1);
  assert.equal(args[4],'https://images.invalid/first');assert.equal(args[10],'v1');assert.equal(args[12],'identity-v1');
  return{fileUri:'/sandbox/first',width:600,height:1000,revision:'image-version'};};
 f.runtime.releaseReadingImage=(uri)=>released.push(uri);
 return{...f,manga,chapter,released,setImageGate:g=>imageGate=g,failImage:()=>fail=true};
}


{
 const f=fixture();await f.host.openLocal(book('local-book','local'),f.lease,true);assert.equal(f.calls.length,0,'shelf resume performs no detail IO');
 await f.host.openLocal(book('local-book','local'),f.lease);assert.equal(f.host.snapshot().book.sourceName,'本地书籍');assert.equal(f.host.snapshot().toc[0].level,2);
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1,'Directory owner is the only bookmark read producer');
 assert.equal(f.host.snapshot().toc[0].downloadState,'completed');assert.equal(f.host.snapshot().loadingMessage,'');
 assert.equal(f.host.snapshot().inBookshelf,true);f.close();checkpoints.push('actual-local-TOC-download-only-shared-directory-resume-no-IO');
}
{
 const f=fixture(),cached=await f.coordinator.acquireBook(seed());f.calls.length=0;
 await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:book(),
  validatedSession:cached,resumeImmediately:true},f.lease);
 assert.deepEqual(f.calls.map(call=>call.method),['intent'],'shelf resume keeps the actual Runtime intent without running detail IO');
 assert.deepEqual(f.calls[0].p,['s1','book']);assert.equal(f.host.snapshot().toc.length,3);
 assert.equal(f.host.snapshot().verdict,'verifying','an unprepared catalog is not a fabricated readable body');
 f.close();checkpoints.push('remote-shelf-resume-preserves-real-preparation-intent-no-detail-IO');
}
{
 const f=fixture(),cached=session();
 await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:book(),validatedSession:cached,resumeImmediately:true},f.lease);
 assert.deepEqual(f.calls.map(call=>call.method),['intent'],'a cold unowned catalog still opens the reader immediately without blocking IO');
 assert.equal(f.host.snapshot().toc.length,0,'unknown current source metadata cannot validate a retained review/old catalog');
 assert.equal(f.host.snapshot().session,undefined,'ordinary reader acquisition owns validation after the immediate transition');
 f.close();checkpoints.push('remote-cold-resume-responsive-without-unowned-session-admission');
}
{
 const f=fixture(),authorIdentity={schemaVersion:1,sourceVersion:'v1',field:'search',raw:'@府天',label:'府天',rule:'author-nickname-at-v1'};
 const initial={...seed(),author:'@府天',authorIdentity};
 await f.host.openRemote({seed:initial,sourceName:'Source',resumeImmediately:true},f.lease);
 assert.equal(f.calls.length,0,'publishing source-version proof never delays the immediate reader transition');
 assert.equal(f.host.snapshot().book.author,'@府天');assert.equal(f.host.snapshot().book.authorIdentity,authorIdentity);
 assert.equal(f.host.snapshot().book.sourceVersion,'v1');
 const current={...session(),book:{...session().book,author:'@府天',authorIdentity}};
 assert.equal(f.host.readerSessionReady(current),true);
 assert.equal(f.host.snapshot().book.authorIdentity,authorIdentity);assert.equal(f.host.snapshot().book.sourceVersion,'v1');
 assert.equal(f.host.snapshot().book.author,'@府天','detail/session projections retain raw author and its exact proof without inventing an alias');
 f.close();checkpoints.push('remote-seed-and-admitted-session-preserve-exact-author-proof-source-version');
}
{
 const f=fixture(),cached=await f.coordinator.acquireBook(seed());
 const key=JSON.stringify(['s1','book','v1']);
 const ready=f.coordinator.prepared.get(key);
 // A current Core registry response reveals the retained provider's category.
 const execute=f.coordinator.execute;
 f.coordinator.execute=async(method,p,o)=>method==='source.list'?{data:{sources:[{sourceId:'s1',name:'爱推书君（优）',
  baseUrl:'https://pre-api.tuishujun.com/',enabled:true,sourceVersion:'v1',bookSource:{bookSourceType:0}}]}}:execute(method,p,o);
 await f.coordinator.request('source.list',{sourceId:'s1'});
 assert.equal(f.coordinator.prepared.get(key),ready,'review protection preserves process and durable data');
 f.calls.length=0;
 await f.host.openRemote({seed:seed(),sourceName:'爱推书君（优）',validatedSession:cached},f.lease);
 assert.equal(f.host.snapshot().session,undefined);
 assert.match(f.host.snapshot().loadingMessage,/此书源提供书评或其他非阅读内容/);
 assert.equal(f.calls.some(call=>['book.detail','book.toc','chapter.content','cache.book.status','search-book.put'].includes(call.method)),false,
  'validated-session shortcuts cannot reopen review content or alter user facts');
 f.close();checkpoints.push('remote-validated-review-session-shares-current-source-category-admission');
}
{
 const f=fixture();await f.host.openRemote({seed:seed(),sourceName:'s1'},f.lease);await until(()=>f.host.snapshot().verdict==='readable');await f.settle();
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 assert.equal(f.host.snapshot().book.sourceName,'Named Source');assert.equal(f.host.snapshot().session.preparedChapter.chapter.chapterIndex,0);
 assert.equal(f.host.snapshot().session.preparedChapter.projectionRevision,f.coordinator.readingProjectionRevision());
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);assert.equal(f.host.snapshot().toc[0].downloadState,'cached');
 f.close();checkpoints.push('complete-actual-coordinator-native-catalog-body-name-directory-admission');
}
{
 const f=fixture();for(const index of [0,1,2])f.bodies.set(f.key('s1','book')+':'+index,'章节内容正在加载，请稍候...');
 await f.host.openRemote({seed:seed(),sourceName:'Source',fromSearch:true,fallbackSeeds:[seed('fallback','s2')],fallbackSourceNames:['Fallback']},f.lease);
 await until(()=>f.host.snapshot().verdict==='readable');
 assert.equal(f.calls.find(c=>c.method==='bookshelf.get').p.bookId,'book','exact shelf read precedes actual fallback');
 assert.equal(f.host.snapshot().book.sourceId,'s2');assert.equal(f.host.snapshot().session.preparedChapter.chapter.bookId,'fallback');
 assert.equal(f.host.snapshot().candidateAdmissionActive,false);f.close();checkpoints.push('actual-candidate-group-readability-fallback-after-exact-shelf-absence');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.bodies.set(f.key('s1','book')+':2','章节内容正在加载，请稍候...');
 const scope=f.host.snapshot().scopeId;assert.equal(await f.host.probe(scope,2),undefined);assert.equal(f.host.snapshot().verdict,'contentUnavailable');
 assert.deepEqual(f.calls.filter(c=>c.method==='chapter.content').map(c=>c.p.chapterIndex),[2],'resume does not skip persisted chapter');
 await f.host.probe(scope,999);assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1);f.close();checkpoints.push('actual-probe-resume-exact-chapter-never-skips-or-clamps');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.bodies.set(f.key('s1','book')+':0','章节内容正在加载，请稍候...');
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),1);assert.equal(f.host.snapshot().verdict,'readable');
 assert.deepEqual(f.calls.filter(c=>c.method==='chapter.content').map(c=>c.p.chapterIndex),[0,1]);f.close();checkpoints.push('new-book-only-bounded-leading-blank-skip');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.control.bodyVia='cache';f.bodies.set(f.key('s1','book')+':0','章节内容正在加载，请稍候...');
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),undefined);assert.equal(f.notices.length,1);assert.equal(f.host.snapshot().verdict,'contentUnavailable');
 assert.equal(f.calls.some(c=>c.p.forceRefresh),false);assert.equal(f.host.snapshot().book.bookId,'book');f.close();checkpoints.push('actual-corrupt-cache-kept-choice-no-force-or-progress-replay');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.control.bodyVia='cache';f.control.decision=true;
 f.bodies.set(f.key('s1','book')+':0','章节内容正在加载，请稍候...');
 const decision=f.lease.cacheDecision;f.lease.cacheDecision=async(...args)=>{const result=await decision(...args);f.bodies.delete(f.key('s1','book')+':0');return result;};
 const before=f.coordinator.readingProjectionRevision();assert.equal(await f.host.probe(f.host.snapshot().scopeId),0);
 assert.equal(f.coordinator.readingProjectionRevision(),before+2);assert.equal(f.host.snapshot().verdict,'readable');
 assert.equal(f.calls.filter(c=>c.method==='chapter.content'&&c.p.forceRefresh).length,1);f.close();checkpoints.push('actual-user-cache-refresh-with-two-revision-CAS-handoff');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.control.bodyVia='cache';f.control.decision=true;f.control.decisionGate=deferred();
 f.bodies.set(f.key('s1','book')+':0','章节内容正在加载，请稍候...');const work=f.host.probe(f.host.snapshot().scopeId);await until(()=>f.notices.length===1);
 f.host.bindReader(book('new'),session('new'),[],false,f.lease);const last=f.changes.length;
 f.control.decisionGate.resolve();assert.equal(await work,undefined);assert.equal(f.calls.some(c=>c.p.forceRefresh),false);assert.equal(f.changes.length,last);
 assert.equal(f.host.snapshot().book.bookId,'new');f.close();checkpoints.push('old-native-cache-choice-cannot-borrow-reopened-owner');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);const gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);
 const work=f.host.probe(f.host.snapshot().scopeId);await until(()=>f.calls.some(c=>c.method==='chapter.content'));
 f.host.bindReader(book('new'),session('new'),[],false,f.lease);const last=f.changes.length;gate.resolve();assert.equal(await work,undefined);
 assert.equal(f.changes.length,last);assert.equal(f.host.snapshot().verdict,'verifying');f.close();checkpoints.push('late-native-body-rejects-old-scope-book-session');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);await f.host.probe(f.host.snapshot().scopeId);
 const admitted=f.host.snapshot().session;const rev=f.coordinator.readingProjectionRevision();
 f.host.acceptSession({...admitted,book:{...admitted.book,title:'Renamed'}});assert.equal(f.host.snapshot().session.preparedChapter,admitted.preparedChapter);
 f.coordinator.projectionRevision++;f.host.acceptSession(admitted);assert.equal(f.host.snapshot().session.preparedChapter,undefined);assert.equal(f.host.snapshot().verdict,'verifying');
 const row={origin:'s1',bookUrl:'book',acquisition:{schemaVersion:2,verificationCurrent:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1'}};
 f.host.acceptSession(admitted,rev+1,{...row,bookUrl:'foreign'});assert.equal(f.host.snapshot().verdict,'verifying');
 f.host.acceptSession(admitted,rev+1,row);assert.equal(f.host.snapshot().verdict,'readable');assert.equal(f.host.snapshot().session.preparedChapter,undefined,'Core truth is not an invented reusable body');
 f.close();checkpoints.push('semantic-session-proof-metadata-retention-stale-prepared-removal-exact-Core-verdict');
}
{
 const f=fixture(),cached=session(),refresh=deferred();f.coordinator.acquireBookWithBackgroundRefresh=async()=>({session:cached,backgroundRefresh:refresh.promise});
 await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:book()},f.lease);await until(()=>f.host.snapshot().verdict==='readable');
 const body=f.host.snapshot().session.preparedChapter;refresh.reject(Error('refresh unavailable'));await until(()=>f.host.snapshot().backgroundError!==undefined);
 assert.equal(f.host.snapshot().loadingMessage,'');assert.equal(f.host.snapshot().verdict,'readable');assert.equal(f.host.snapshot().session.preparedChapter,body);
 f.close();checkpoints.push('background-failure-preserves-admitted-catalog-body-and-visible-readiness');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);const gate=deferred();f.gates.set('bookshelf.get:'+f.key('s1','book'),gate);
 const work=f.host.readMembership(session(),f.host.snapshot().scopeId,f.lease);await until(()=>f.calls.some(c=>c.method==='bookshelf.get'));
 f.control.memberGeneration++;f.control.member=true;gate.resolve();await work;assert.equal(f.control.member,true,'late absence cannot overwrite explicit shelf mutation');
 f.close();checkpoints.push('membership-read-scoped-to-explicit-mutation-generation');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);await f.host.probe(f.host.snapshot().scopeId);
 const prepared=f.host.snapshot().session.preparedChapter;
 f.rows.set(f.key('s1','book'),{origin:'s1',bookUrl:'book',name:'Renamed',author:'Writer',acquisition:{schemaVersion:2,verificationCurrent:true,
  sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',catalogAt:1}});
 await f.host.refreshProjection();assert.equal(f.host.snapshot().book.title,'Renamed');assert.equal(f.host.snapshot().verdict,'readable');
 assert.equal(f.host.snapshot().session.preparedChapter,prepared);assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,1);
 f.control.failProjection=true;await f.host.refreshProjection();assert.equal(f.host.snapshot().session.preparedChapter,prepared);
 assert.equal(f.host.snapshot().backgroundError,'projection unavailable');f.close();checkpoints.push('actual-canonical-projection-metadata-no-body-reprobe-failed-read-preserves-detail');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.host.state.candidateAdmissionFailed=true;
 await f.host.refreshProjection();assert.equal(f.calls.some(c=>c.method==='search-book.get'),false,'terminal candidate failure cannot auto-retry on notification');
 f.close();checkpoints.push('candidate-terminal-failure-suppresses-projection-retry');
}
{
 const f=fixture();f.shelves.set(f.key('local','local-book'),book('local-book','local'));
 const shared={runtime:f.runtime,revision:'r1',seeds:Promise.resolve([{sourceId:'local',bookId:'local-book'}])};
 f.host.prepareVisible([book('local-book','local')],f.preparationContext,shared);
 await until(()=>f.calls.some(c=>c.method==='reading.entry.prepare'));await until(()=>f.preparations.persistedTask===undefined);
 assert.equal(f.calls.filter(c=>c.method==='bookshelf.list').length,0,'actual shared full-revision seeds avoid second all-shelf read');
 assert.equal(f.appearance(),1);assert.equal(f.preparations.visibleSeeds[0].bookKind,undefined);
 assert.equal(f.calls.filter(c=>c.method==='reading.entry.prepare').length,7,'actual existing preparation owns neighbor admission');
 f.close();checkpoints.push('actual-Runtime-preparation-shared-revision-seeds-visible-idle-domain-owner');
}
{
 const f=fixture();f.shelves.set(f.key('local','local-book'),book('local-book','local'));let visible=false;
 const supports=f.runtime.supportsCoreCapability;f.runtime.supportsCoreCapability=(capability)=>capability==='bookshelf.pageProjection.v1'||supports(capability);
 f.shelves.set(f.key('s1','manga'),{...book('manga'),contentKind:'manga'});
 const context={...f.preparationContext,shelfVisible:()=>visible};
 f.host.preparationVisibilityChanged(context);assert.equal(f.preparations.paused,true);assert.equal(f.calls.some(c=>c.method==='bookshelf.list'),false);
 visible=true;f.host.preparationVisibilityChanged(context);assert.equal(f.preparations.paused,false);
 await until(()=>f.preparations.persistedCompletedRevision==='r1');
 assert.equal(f.calls.filter(c=>c.method==='bookshelf.list').length,1,'no shared seeds falls back to one actual complete typed shelf projection');
 assert.equal(f.calls.find(c=>c.method==='bookshelf.list').p.membershipOnly,false,'fallback retains Core media facts and the same full-page revision scope');
 assert.equal(f.calls.some(c=>c.method==='reading.entry.prepare'&&c.p.bookId==='manga'),false,'typed fallback cannot admit retained manga to text preparation');
 assert.equal(f.calls.filter(c=>c.method==='reading.entry.prepare').length,7);
 f.close();checkpoints.push('actual-preparation-visibility-pause-resume-complete-shelf-fallback');
}
{
 const f=fixture();const same=ProductionHost.forRuntime(f.runtime);assert.equal(ProductionHost.forRuntime(f.runtime),same);
 f.close();const next=fixture();const newer=ProductionHost.forRuntime(next.runtime);assert.notEqual(newer,same);
 assert.throws(()=>ProductionHost.forRuntime(f.runtime));assert.equal(ProductionHost.forRuntime(next.runtime),newer);next.close();
 checkpoints.push('feature-local-runtime-sharing-old-lookup-cannot-replace-successor');
}
{
 const f=fixture();const gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);f.control.bodyIgnoreCancellation=true;
 f.host.bindReader(book(),session(),[],false,f.lease);const work=f.host.probe(f.host.snapshot().scopeId);
 await until(()=>f.calls.some(c=>c.method==='chapter.content'));f.host.bindReader(book(),session(),[],false,f.lease);const changes=f.changes.length;
 gate.resolve();assert.equal(await work,undefined);assert.equal(f.host.snapshot().verdict,'verifying');assert.equal(f.changes.length,changes);
 f.close();checkpoints.push('same-book-same-catalog-reopen-still-rejects-old-body-generation');
}
{
 const source=read('features/reading/ReadingEntryHost.ts');
 const unsafe=source.replace('generation === this.probeGeneration &&','true &&').replace('scope === this.state.scopeId &&','true &&');
 assert.notEqual(source,unsafe);const f=fixture(compileHost(unsafe)),gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);
 f.control.bodyIgnoreCancellation=true;f.host.bindReader(book(),session(),[],false,f.lease);const work=f.host.probe(f.host.snapshot().scopeId);
 await until(()=>f.calls.some(c=>c.method==='chapter.content'));f.host.bindReader(book(),session(),[],false,f.lease);gate.resolve();await work;
 assert.equal(f.host.snapshot().verdict,'readable','removing actual generation/scope guards reproduces old body crossing re-open');f.close();
}
{
 const source=read('features/reading/ReadingEntryHost.ts');
 const unsafe=source.replace('projection?.origin === session.identity.sourceId && projection.bookUrl === session.identity.bookId &&','true &&');
 assert.notEqual(source,unsafe);const f=fixture(compileHost(unsafe));f.host.bindReader(book(),session(),[],false,f.lease);
 f.host.acceptSession(session(),f.coordinator.readingProjectionRevision(),{origin:'foreign',bookUrl:'foreign',acquisition:{schemaVersion:2,
  verificationCurrent:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1'}});
 assert.equal(f.host.snapshot().verdict,'readable','removing exact projection identity accepts foreign evidence');f.close();
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);const first=f.host.deferredDirectoryProjection();
 f.host.bindReader(book(),session(),[],false,f.lease);first();await f.settle();assert.equal(f.calls.length,0);
 const before=f.host.snapshot().sessionGeneration;const renamed={...session(),book:{title:'Renamed',author:'Writer'}};
 assert.equal(f.host.readerSessionReady(renamed),true);assert.equal(f.host.snapshot().book.title,'Renamed');assert.equal(f.host.snapshot().sessionGeneration,before);
 assert.equal(f.host.readerSessionReady(session('foreign')),false);assert.equal(f.host.snapshot().book.bookId,'book');
 const current=f.host.deferredDirectoryProjection();current();await until(()=>f.calls.some(c=>c.method==='bookmark.list'));
 f.close();checkpoints.push('actual-reader-session-ready-DTO-and-deferred-directory-captured-lifecycle');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);const gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);
 const work=f.host.probe(f.host.snapshot().scopeId);await until(()=>f.calls.some(c=>c.method==='chapter.content'));
 f.control.memberGeneration++;f.control.member=true;gate.resolve();await work;assert.equal(f.host.snapshot().inBookshelf,true);
 assert.equal(f.control.member,true,'body completion cannot overwrite a newer explicitly confirmed shelf addition');f.close();
 checkpoints.push('independent-probe-publication-preserves-newer-explicit-membership');
}
{
 const f=fixture(),gate=deferred();f.gates.set('bookshelf.get:'+f.key('s1','book'),gate);
 const work=f.host.openRemote({seed:seed(),sourceName:'Source',fromSearch:true,fallbackSeeds:[seed('other','s2')]},f.lease);
 await until(()=>f.calls.some(c=>c.method==='bookshelf.get'));f.control.memberGeneration++;f.control.member=true;gate.resolve();await work;
 await until(()=>f.host.snapshot().verdict==='readable');assert.equal(f.host.snapshot().book.sourceId,'s1');assert.equal(f.host.snapshot().inBookshelf,true);
 f.close();checkpoints.push('late-absence-cannot-open-fallback-after-explicit-shelf-join');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);await f.host.probe(f.host.snapshot().scopeId);
 f.rows.set(f.key('s1','book'),{origin:'s1',bookUrl:'book',name:'Book',author:'Writer',variable:'{}',acquisition:{schemaVersion:2,stale:true,
  sourceVersion:'v2',catalogVersion:'c1',contextVersion:'x1',catalogAt:Date.now()}});
 await f.runtime.request('reader.chinese-conversion.put',{});
 const oldScope=f.host.snapshot().scopeId;await f.host.refreshProjection();assert.ok(f.host.snapshot().scopeId>oldScope);
 assert.equal(f.host.snapshot().verdict,'readable');assert.equal(f.host.snapshot().candidateAdmissionActive,false);
 const count=f.calls.filter(c=>c.method==='chapter.content').length;await f.host.refreshProjection();
 assert.equal(f.calls.filter(c=>c.method==='chapter.content').length,count,'validated offline stale readmission is not reopened in a loop');
 f.close();checkpoints.push('actual-stale-Core-readmission-single-body-owner-and-offline-loop-protection');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);await f.host.probe(f.host.snapshot().scopeId);
 const gate=deferred();f.gates.set('search-book.get:'+f.key('s1','book'),gate);
 const a=f.host.refreshProjection(),b=f.host.refreshProjection(),c=f.host.refreshProjection();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='search-book.get').length,1,'one actual projection read active');
 f.coordinator.projectionRevision++;gate.resolve();await Promise.all([a,b,c]);await until(()=>f.calls.filter(call=>call.method==='search-book.get').length===2);
 await f.settle();assert.equal(f.host.snapshot().verdict,'readable');f.close();checkpoints.push('actual-detail-projection-latest-queue-revision-recheck-one-drain');
}
{
 const f=fixture(),cached=session(),refresh=deferred();f.coordinator.acquireBookWithBackgroundRefresh=async()=>({session:cached,backgroundRefresh:refresh.promise});
 await f.host.openRemote({seed:seed(),sourceName:'Source'},f.lease);await until(()=>f.host.snapshot().verdict==='readable');
 f.host.bindReader(book('new'),session('new'),[],false,f.lease);const last=f.changes.length;
 refresh.resolve({...cached,catalogVersion:'old-refresh'});await f.settle();assert.equal(f.changes.length,last);assert.equal(f.host.snapshot().book.bookId,'new');
 f.close();checkpoints.push('late-background-refresh-never-publishes-into-new-entry');
}
{
 const f=fixture();f.host.bindReader(book(),session(),[],false,f.lease);f.control.bodyVia='cache';f.control.decision=true;f.control.forceExtraRevision=true;
 f.bodies.set(f.key('s1','book')+':0','章节内容正在加载，请稍候...');
 f.lease.cacheDecision=async()=>{f.bodies.delete(f.key('s1','book')+':0');return true;};
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),undefined);assert.notEqual(f.host.snapshot().verdict,'readable');
 assert.equal(f.notices.at(-1).title,'正文未更新');f.close();checkpoints.push('concurrent-projection-mutation-rejects-cache-refresh-body-handoff');
}
{
 const f=fixture(),gate=deferred();f.host.preparePersisted(f.preparationContext,{runtime:f.runtime,revision:'r1',seeds:gate.promise});
 await tick();f.host.retire();gate.resolve([{sourceId:'local',bookId:'old'}]);await new Promise(r=>setTimeout(r,270));
 assert.equal(f.calls.some(c=>c.method==='reading.entry.prepare'),false,'retired UI admission cannot dispatch prepared work');
 f.close();checkpoints.push('retired-preparation-admission-keeps-existing-Runtime-owner-no-late-Core-dispatch');
}
for (const contentKind of ['audio']) {
 const f=fixture(), original=f.host.snapshot();
 await f.host.openRemote({seed:{...seed(),contentKind},sourceName:'Source',resumeImmediately:true},f.lease);
 assert.equal(f.calls.length,0,'unsupported media never dispatches preparation intent or body');
 assert.deepEqual(f.host.snapshot(),original,'unsupported entry preserves prior reader owner');
 assert.equal(f.notices.length,1);assert.match(f.notices[0].message,/仍保留/);
 await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:{...book(),contentKind}},f.lease);
 assert.equal(f.calls.length,0,'Core shelf media type overrides untyped legacy seed');f.close();
}
checkpoints.push('actual-media-entry-guard-preserves-owner-and-stored-books-with-no-dispatch');
{
 const f=fixture(), retained=[{...book('manga'),contentKind:'manga'},{...book('audio'),contentKind:'audio'},book('text','local')];
 f.host.prepareVisible(retained,f.preparationContext,{runtime:f.runtime,revision:'r1',seeds:Promise.resolve([])});
 assert.deepEqual(f.preparations.visibleSeeds.map(row=>row.bookId),['text']);
 assert.equal(retained.length,3,'preparation cannot filter the displayed or stored shelf');f.close();
 checkpoints.push('actual-visible-preparation-only-text-retains-display-input');
}
{
 const source=read('features/reading/ReadingEntryHost.ts');
 const unsafe=source.replace("if (seed.contentKind === 'audio') {",'if (false) {');
 assert.notEqual(source,unsafe);const f=fixture(compileHost(unsafe));
 await f.host.openRemote({seed:{...seed(),contentKind:'audio'},sourceName:'Source',shelfSnapshot:book(),resumeImmediately:true},f.lease);
 assert.equal(f.calls.some(call=>call.method==='intent'),true,'deleting actual guard reopens unsupported preparation admission');f.close();
 checkpoints.push('actual-media-entry-guard-deletion-negative');
}
{
 const f=mangaFixture();await f.host.openRemote({seed:{...seed(),contentKind:'manga'},sourceName:'Source',
  shelfSnapshot:{...book(),contentKind:'manga'},resumeImmediately:true},f.lease);
 assert.equal(f.host.snapshot().book.contentKind,'manga');assert.equal(f.host.snapshot().session,undefined);
 assert.equal(f.host.snapshot().toc.length,0,'shelf reader may open directly before a catalog is available');
 assert.equal(f.calls.some(c=>c.method!=='intent'),false,'historical manga entry performs no text/catalog admission');
 f.host.bindReader({...book(),contentKind:'manga'},f.manga,[],true,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),1);assert.equal(f.host.snapshot().verdict,'readable');
 assert.equal(f.host.snapshot().session.preparedChapter,undefined,'a first-image receipt never masquerades as a text body');
 assert.deepEqual(f.released,['/sandbox/first']);assert.equal(f.calls.some(c=>c.method==='chapter.content'),false);
 assert.equal(f.host.readerSessionReady(f.manga),true);assert.equal(f.host.snapshot().toc[0].level,0);
 assert.equal(f.host.snapshot().toc[0].navigable,false);assert.equal(f.host.snapshot().toc[1].level,1);
 assert.equal(f.host.snapshot().book.contentKind,'manga');f.close();
 checkpoints.push('actual-manga-shelf-entry-before-catalog-first-image-readability-type-and-volume-projection');
}
{
 const f=mangaFixture(),gate=deferred();f.setImageGate(gate);
 f.host.bindReader({...book(),contentKind:'manga'},f.manga,[],true,f.lease);
 const old=f.host.probe(f.host.snapshot().scopeId);await until(()=>f.calls.some(c=>c.method==='image'));
 f.host.bindReader(book('new'),session('new'),[],false,f.lease);const changes=f.changes.length;
 gate.resolve();assert.equal(await old,undefined);assert.equal(f.changes.length,changes);
 assert.equal(f.host.snapshot().verdict,'verifying');assert.deepEqual(f.released,['/sandbox/first']);f.close();
 checkpoints.push('late-manga-first-image-cannot-publish-after-reader-type-or-scope-replacement');
}
{
 const f=mangaFixture();f.failImage();f.host.bindReader({...book(),contentKind:'manga'},f.manga,[],true,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),undefined);
 assert.notEqual(f.host.snapshot().verdict,'readable');assert.equal(f.host.snapshot().book.contentKind,'manga');
 assert.equal(f.host.snapshot().session,f.manga,'failed first image preserves admitted catalog/book');f.close();
 checkpoints.push('manga-catalog-only-cannot-fabricate-readability-or-delete-admitted-session');
}
{
 const f=fixture(),typed=[{sourceId:'s1',bookId:'manga',contentKind:'manga'},
  {sourceId:'s1',bookId:'audio',contentKind:'audio'},{sourceId:'local',bookId:'local-book',contentKind:'text'}];
 f.preparations.setVisibleBooks(typed);assert.deepEqual(f.preparations.visibleSeeds.map(row=>row.bookId),['local-book']);
 f.host.prepareVisible([{...book('local-book','local'),contentKind:'text'}],f.preparationContext,
  {runtime:f.runtime,revision:'r1',seeds:Promise.resolve(typed)});
 await until(()=>f.preparations.persistedCompletedRevision==='r1');
 assert.equal(f.calls.filter(c=>c.method==='reading.entry.prepare').length,7);
 assert.ok(f.calls.filter(c=>c.method==='reading.entry.prepare').every(c=>c.p.bookId==='local-book'),
  'shared typed manga/audio identities cannot enter a text cached-chapter warm sweep');
 assert.ok(f.preparations.persistedSeeds.every(row=>row.contentKind==='text'),'cached sweep seeds preserve their finite kind fact');
 f.close();checkpoints.push('actual-shared-typed-seeds-and-direct-preparation-owner-exclude-manga-audio');
}
// The real prepared-pixel shortcut must still reach the actual entry owner
// and cached Gateway. A delayed directory projection neither blocks pixels
// nor borrows an index-only match, and repeated directory intents join it.
{
 const f=mangaFixture(),retained={...session(),contentKind:'manga',requiresContextRefresh:true};
 retained.entries=retained.entries.map((entry,index)=>({...entry,title:`✿·${199+index}回\n`,level:undefined}));
 const cached={sourceId:'s1',bookId:'book',tocAvailable:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',
  continuationVariables:{},chapters:retained.entries.map(entry=>({chapterIndex:entry.index,title:entry.title,url:entry.url,variables:{},
   level:1,navigable:true,proofState:'verified',displayTitle:`${199+entry.index}回`,isVip:true}))};
 const gate=deferred();let cacheReads=0,network=0;
 f.runtime.request=async(method,params)=>{assert.equal(method,'cache.book.status');assert.equal(params.sourceId,'s1');assert.equal(params.bookId,'book');
  cacheReads++;await gate.promise;return{data:cached};};
 f.coordinator.acquireBook=async()=>{network++;throw Error('verified display read cannot acquire online');};
 f.host.bindReader({...book(),contentKind:'manga'},retained,retained.entries.map(entry=>({index:entry.index,title:entry.title,downloadState:'completed',bookmarks:[]})),true,f.lease);
 const pageId=f.chapter.manifest.pages[0].pageId;
 f.chapter.chapterIndex=0;f.chapter.chapterTitle=retained.entries[0].title;f.chapter.manifest.chapter.chapterId=retained.entries[0].url;
 const saved={kind:'manga',chapter:f.chapter.manifest.chapter,manifestVersion:'manifest',pageId,pageOrdinalFallback:0,x:.27,y:.61,progressRevision:2};
 const prepared={chapter:f.chapter,targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:2,revision:2},location:saved}};
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),
  ['open','acquireCatalog','openDirectory'],{MangaSessionGateway:class{async entry(){return prepared;}},MangaBookPresentation,AppStorage:{setOrCreate(){}}});
 const pixels=[],restored=[],controller={chapter:f.chapter,savedLocation:saved,displayedOrdinal:0,recoveryRequired:false,
  async awaitPendingProgress(){},async setPreviewMode(){},async openPrepared(value){assert.equal(value,prepared);pixels.push('open');},pageAt:()=>({pageId})};
 const surface=Object.assign(new Surface(),{sourceId:'s1',bookId:'book',runtime:f.runtime,controller,mounted:true,offline:false,
  remoteSession:retained,remoteBookSeed:{...seed(),contentKind:'manga'},fitPreference:'width',
  publish(){pixels.push('publish');},restore:(...args)=>restored.push(args),configureAdjacentChapter(){},openPanel:async()=>{},
  onRemoteSessionReady:(value,refresh)=>f.host.readerSessionReady(value,refresh)});
 await surface.open(controller);
 assert.equal(surface.opened,true);assert.deepEqual(pixels,['open','publish']);assert.deepEqual(restored,[[0,.61,.27]]);
 assert.equal(cacheReads,1,'the old prepared-session branch reads current display facts after its pixels');
 const pending=f.host.refreshMangaDirectoryDisplay(true);
 assert.equal(f.host.refreshMangaDirectoryDisplay(true),pending,'open/full/quick intents join the finite owner task');
 assert.equal(f.host.snapshot().session,retained,'a pending display read keeps the admitted reading snapshot');
 gate.resolve();await pending;
 const updated=f.host.snapshot();assert.notEqual(updated.session,retained);
 assert.equal(updated.session.entries[0].title,'✿·199回\n');assert.equal(updated.session.entries[0].displayTitle,'199回');
 assert.equal(updated.session.entries[0].level,1);assert.equal(updated.session.entries[0].isVip,true);
 assert.equal(updated.session.requiresContextRefresh,false,'complete current context proof removes the old display gate on a replacement binding');
 assert.equal(updated.toc[0].downloadState,'completed');assert.deepEqual(updated.toc[0].bookmarks,[]);
 assert.equal(controller.chapter,f.chapter);assert.equal(controller.savedLocation,saved);assert.deepEqual(pixels,['open','publish']);assert.equal(network,0);
 assert.equal(retained.entries[0].displayTitle,undefined,'Core presentation never mutates the retained raw snapshot');
 await f.host.refreshMangaDirectoryDisplay();assert.equal(cacheReads,1,'normal session-ready repeats do not re-read after one successful binding');
 surface.remoteSession=updated.session;cached.chapters[0].displayTitle='199回 · 更新';
 await surface.openDirectory();await f.host.refreshMangaDirectoryDisplay();
 assert.equal(cacheReads,2,'explicit Quick directory opening checks current display facts once');
 assert.equal(f.host.snapshot().toc[0].displayTitle,'199回 · 更新');assert.equal(surface.controller,controller);
 f.close();checkpoints.push('actual-prepared-manga-reuse-current-Core-display-readback-dedup-quick-open-keeps-pixels-manifest-xy-downloads');
}

// Real Gateway strict read and normal catalog-recovery boundary, with only
// Core responses/network availability as ports. Equal indices alone never
// admit presentation from a different canonical title, URL or request.
{
 const original={...session(),contentKind:'manga'};
 original.entries=original.entries.map(entry=>({...entry,title:`✿·${99+entry.index}回\n`,level:undefined}));
 const status=()=>({sourceId:'s1',bookId:'book',tocAvailable:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',continuationVariables:{},
  chapters:original.entries.map(entry=>({chapterIndex:entry.index,title:entry.title,url:entry.url,variables:{},proofState:'verified',navigable:true,level:1,displayTitle:`${99+entry.index}回`}))});
 const fresh=()=>({...original,sourceVersion:'v2',catalogVersion:'c2',contextVersion:'x2',
  entries:original.entries.map(entry=>({...entry,level:1,navigable:true,displayTitle:`${99+entry.index}回`}))});
 for(const scenario of ['legacy','legacy-unproven','source-mismatch','title-change','url-change','variables-change','malformed-cached-variables','missing-new-proof','network-failure','offline','offline-version-mismatch','foreign','retired']){
  const retained=structuredClone(original),cached=status(),next=fresh();let active=true,acquisitions=0;
  if(['legacy','legacy-unproven'].includes(scenario)){delete retained.sourceVersion;delete retained.catalogVersion;delete retained.contextVersion;}
  if(scenario==='legacy')retained.acquisitionMode='offline';
  if(['source-mismatch','offline-version-mismatch'].includes(scenario))cached.sourceVersion='v2';
  if(scenario==='legacy-unproven')cached.chapters[0].proofState='legacyUnknown';
  if(['title-change','url-change','variables-change','missing-new-proof','network-failure','offline'].includes(scenario))cached.chapters[0].proofState='legacyUnknown';
  if(scenario==='title-change')next.entries[1].title='另一章';
  if(scenario==='url-change')next.entries[1].url='/different';
  if(scenario==='variables-change')next.entries[1].variables=[{name:'token',value:'changed'}];
  if(scenario==='malformed-cached-variables')cached.chapters[0].variables={token:12};
  if(scenario==='missing-new-proof')delete next.contextVersion;
  if(scenario==='foreign')cached.sourceId='other';
  const runtime={async request(method){assert.equal(method,'cache.book.status');if(scenario==='retired')active=false;return{data:cached};},
   bookAcquisitions:()=>({async acquireBook(value,options,priority){acquisitions++;assert.equal(value.sourceId,'s1');assert.equal(value.bookId,'book');
    assert.equal(options.forceRefresh,true);assert.equal(priority,'background');if(scenario==='network-failure')throw Error('network unavailable');return next;}})};
  const gateway=new RemoteReadingFlowGateway(runtime);
  if(['legacy','legacy-unproven','source-mismatch'].includes(scenario)){
   const rebound=await gateway.refreshMangaDirectoryDisplaySession(retained,()=>active,scenario!=='legacy');
   assert.equal(acquisitions,scenario==='legacy'?0:1);assert.equal(rebound.sourceVersion,scenario==='legacy'?'v1':'v2');assert.equal(rebound.entries[0].displayTitle,'99回');
   assert.equal(rebound.catalogVersion,scenario==='legacy'?'c1':'c2');assert.equal(rebound.contextVersion,scenario==='legacy'?'x1':'x2');
   if(scenario==='legacy')assert.equal(rebound.acquisitionMode,'offline','proved cache refresh preserves the offline reading mode');
   assert.deepEqual(rebound.entries.map(row=>[row.index,row.title,row.url]),retained.entries.map(row=>[row.index,row.title,row.url]));
   assert.equal(retained.sourceVersion,scenario.startsWith('legacy')?undefined:'v1','new source proof belongs to a replacement directory binding');
  } else {
   await assert.rejects(gateway.refreshMangaDirectoryDisplaySession(retained,()=>active,!scenario.startsWith('offline')&&scenario!=='malformed-cached-variables'));
   assert.equal(acquisitions,['offline','offline-version-mismatch','malformed-cached-variables','foreign','retired'].includes(scenario)?0:1,scenario+' uses only its authorized recovery path');
  }
  assert.equal(retained.entries[0].displayTitle,undefined);assert.deepEqual(original.entries.map(row=>row.title),retained.entries.map(row=>row.title));
 }
 checkpoints.push('actual-manga-display-Gateway-full-snapshot-proofs-normal-legacy-recovery-mismatch-offline-network-failure-retired-negative');
}

// The real coordinator must look up the current source version and reach a
// manga detail/TOC transport on forceRefresh. A fake returned session alone
// would miss the legacy text-only catalog admission and stale seed version.
{
 const retained={...session(),contentKind:'manga'},requests=[];
 retained.entries=retained.entries.map(entry=>({...entry,title:`✿·${99+entry.index}回\n`}));
 const currentSource='v2';
 const execute=async(method,params={})=>{
  requests.push({method,params});
  if(method==='cache.book.status')return{data:{sourceId:'s1',bookId:'book',tocAvailable:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',
   continuationVariables:{},chapters:retained.entries.map(entry=>({chapterIndex:entry.index,title:entry.title,url:entry.url,variables:{},proofState:'invalid'}))}};
  if(method==='source.list')return{data:{sources:[{sourceId:'s1',name:'Comic',baseUrl:'https://source',enabled:true,sourceVersion:currentSource}]}};
  if(method==='search-book.get')return{data:{book:null}};
  if(method==='book.detail'){
   assert.equal(params.sourceId,'s1');assert.equal(params.bookUrl,'book');assert.equal(params.book.variables,undefined,'the old seed cannot inject variables under a new source version');
   return{data:{sourceId:'s1',sourceVersion:currentSource,contentKind:'manga',book:{bookId:'book',title:'Book',author:'Writer'},tocUrl:'/toc',variables:{}}};
  }
  if(method==='book.toc')return{data:{sourceId:'s1',bookId:'book',sourceVersion:currentSource,contentKind:'manga',catalogVersion:'c2',contextVersion:'x2',catalogInstalled:true,
   continuationVariables:{},readableChapterIndexes:[0,1,2],toc:retained.entries.map(entry=>({index:entry.index,title:entry.title,url:entry.url,variables:{},level:1,displayTitle:`${99+entry.index}回`}))}};
  throw Error('catalog recovery cannot dispatch '+method);
 };
 const coordinator=new BookAcquisitionCoordinator(execute,()=>false);
 const runtime={request:(...args)=>coordinator.request(...args),bookAcquisitions:()=>coordinator};
 const rebound=await new RemoteReadingFlowGateway(runtime).refreshMangaDirectoryDisplaySession(retained,()=>true,true);
 assert.equal(rebound.contentKind,'manga');assert.equal(rebound.sourceVersion,currentSource);assert.equal(rebound.catalogVersion,'c2');
 assert.equal(rebound.entries[0].displayTitle,'99回');assert.equal(retained.sourceVersion,'v1');assert.equal(retained.entries[0].displayTitle,undefined);
 assert.deepEqual(requests.map(row=>row.method),['cache.book.status','source.list','search-book.get','book.detail','book.toc']);
 assert.equal(requests.some(row=>row.method==='chapter.content'),false,'catalog-only permission never opens a novel body lane');
 coordinator.close();checkpoints.push('actual-coordinator-manga-catalog-recovery-discovers-new-source-version-no-stale-seed-or-text-body');
}

// A delayed old display response cannot publish through a new book/scope.
{
 const f=fixture(),retained={...session(),contentKind:'manga'},gate=deferred();
 f.runtime.request=async(method)=>{assert.equal(method,'cache.book.status');await gate.promise;return{data:{sourceId:'s1',bookId:'book',tocAvailable:true,
  sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',continuationVariables:{},chapters:retained.entries.map(entry=>({chapterIndex:entry.index,
   title:entry.title,url:entry.url,variables:{},proofState:'verified',level:1,navigable:true,displayTitle:'旧投影'}))}};};
 f.host.bindReader({...book(),contentKind:'manga'},retained,[],true,f.lease);f.host.readerSessionReady(retained);
 const pending=f.host.refreshMangaDirectoryDisplay();
 f.host.bindReader(book('new'),session('new'),[],false,f.lease);const before=f.host.snapshot(),changes=f.changes.length;
 gate.resolve();await pending;
 assert.equal(f.changes.length,changes);assert.deepEqual(f.host.snapshot(),before);f.close();
 checkpoints.push('actual-manga-display-old-response-cannot-borrow-new-book-scope-or-generation');
}
console.log(JSON.stringify({status:'PASS',checkpoints,scope:'complete production owner and Gateways through installed SDK emitter + actual coordinator/preparation; controlled native IO; Index/native target proof remains separate'}));

{
 const f=fixture(), canonical={...seed(),coverUrl:''};
 await f.host.openRemote({seed:canonical,sourceName:'Source',displayCoverUrl:' https://cover.invalid/search.png ',resumeImmediately:true},f.lease);
 assert.equal(f.host.snapshot().book.displayCoverUrl,'https://cover.invalid/search.png');
 assert.equal(f.host.snapshot().book.coverUrl,'');assert.equal(f.host.snapshot().seed.coverUrl,'');
 const admitted={...session(),book:{...session().book,coverUrl:''}};
 assert.equal(f.host.readerSessionReady(admitted),true);
 assert.equal(f.host.snapshot().book.displayCoverUrl,'https://cover.invalid/search.png');
 assert.equal(admitted.book.coverUrl,'','display fallback cannot become persisted source metadata');
 await f.host.openRemote({seed:{...canonical,bookId:'different'},sourceName:'Source',resumeImmediately:true},f.lease);
 assert.equal(f.host.snapshot().book.displayCoverUrl,undefined,'a different identity cannot inherit the prior visible cover');
 f.close();
}
console.log('PASS display-only cover survives admitted same-book metadata and never leaks to a different identity');
