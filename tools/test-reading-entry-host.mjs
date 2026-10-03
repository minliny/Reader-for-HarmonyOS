import assert from 'node:assert/strict';
import {ProductionHost,compileHost,read,setRuntime,readingEvidence,content} from './lib/reading-entry-owner-probe.mjs';
import {fixture,deferred,tick,until,seed,book,session} from './lib/reading-entry-index-fixture.mjs';
const checkpoints=[];

{
 const f=fixture();await f.host.openLocal(book('local-book','local'),f.lease,true);assert.equal(f.calls.length,0,'shelf resume performs no detail IO');
 await f.host.openLocal(book('local-book','local'),f.lease);assert.equal(f.host.snapshot().book.sourceName,'本地书籍');assert.equal(f.host.snapshot().toc[0].level,2);
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1,'Directory owner is the only bookmark read producer');
 assert.equal(f.host.snapshot().toc[0].downloadState,'completed');assert.equal(f.host.snapshot().loadingMessage,'');
 assert.equal(f.host.snapshot().inBookshelf,true);f.close();checkpoints.push('actual-local-TOC-download-only-shared-directory-resume-no-IO');
}
{
 const f=fixture(),cached=session();await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:book(),
  validatedSession:cached,resumeImmediately:true},f.lease);
 assert.deepEqual(f.calls.map(call=>call.method),['intent'],'shelf resume keeps the actual Runtime intent without running detail IO');
 assert.deepEqual(f.calls[0].p,['s1','book']);assert.equal(f.host.snapshot().toc.length,3);
 assert.equal(f.host.snapshot().verdict,'verifying','an unprepared catalog is not a fabricated readable body');
 f.close();checkpoints.push('remote-shelf-resume-preserves-real-preparation-intent-no-detail-IO');
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
 const context={...f.preparationContext,shelfVisible:()=>visible};
 f.host.preparationVisibilityChanged(context);assert.equal(f.preparations.paused,true);assert.equal(f.calls.some(c=>c.method==='bookshelf.list'),false);
 visible=true;f.host.preparationVisibilityChanged(context);assert.equal(f.preparations.paused,false);
 await until(()=>f.preparations.persistedCompletedRevision==='r1');
 assert.equal(f.calls.filter(c=>c.method==='bookshelf.list').length,1,'no shared seeds falls back to one actual complete membership projection');
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
console.log(JSON.stringify({status:'PASS',checkpoints,scope:'complete production owner and Gateways through installed SDK emitter + actual coordinator/preparation; controlled native IO; Index/native target proof remains separate'}));
