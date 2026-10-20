import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {makeIndex:productionIndex}=await import('./lib/reading-entry-sdk-consumer.mjs');const makeIndex=(f,options={})=>productionIndex(f,{...options,domain:'entry'});const {fixture:productionFixture,seed,book,session,deferred}=await import('./lib/reading-entry-index-fixture.mjs');const {ProductionHost,compileHost,read,setRuntime}=await import('./lib/reading-entry-owner-probe.mjs');const owned=[];const fixture=(...a)=>{const f=productionFixture(...a);owned.push(f);return f;};const tick=()=>new Promise(setImmediate);async function until(p){for(let t=0;t<1500;t++){if(p())return;await tick();}assert.fail('controlled Index boundary not reached');}const checks=[];

try{
if(id==='validated-bookmarks'){
{
 const f=fixture(),cached=await f.coordinator.acquireBook(seed()),x=makeIndex(f,{route:'bookshelf'});
 f.calls.length=0;x.idx.readingOriginRoute='bookshelf';
 x.idx.openRemoteBookDetail(seed(),'Source',book(),true,[],[],undefined,cached);
 assert.equal(x.idx.detailToc.length,3);assert.ok(x.idx.detailToc.every(entry=>entry.bookmarks===undefined));
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,0);
 x.idx.presentPreparedReading(0);await tick();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,1,'validated catalog quick entry also resolves canonical bookmarks on its first visible page');
 assert.ok(x.idx.detailToc.every(entry=>entry.bookmarks!==undefined));
 x.idx.presentPreparedReading(1);await tick();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,1,'preloaded catalog does not reload on every ready page');
 f.close();checks.push('actual-cold-validated-remote-catalog-first-ready-bookmarks-once');
}
}
if(id==='cold-order'){
{
 const failures=[];
 for(const sourceId of ['local','s1'])for(const order of ['catalog-before-ready','ready-before-catalog']){
  const f=fixture(),x=makeIndex(f,{route:'bookshelf'}),bookId=sourceId==='local'?'local-book':'book';
  try{
   x.idx.readingOriginRoute='bookshelf';
   if(sourceId==='local')x.idx.openLocalBookDetail(book(bookId,sourceId),true);
   else x.idx.openRemoteBookDetail(seed(bookId,sourceId),'Source',book(bookId,sourceId),true);
   const scope=x.owner().snapshot().scopeId;
   const entries=[0,1,2].map(index=>({index,title:`Persisted chapter ${index}`,navigable:true,downloadState:'unknown'}));
   assert.equal(x.idx.remoteReadingSession,undefined,'persisted reading does not need remote acquisition');
   assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,0,'first frame is never blocked by bookmark IO');
   if(order==='ready-before-catalog')x.idx.presentPreparedReading(0);
   x.idx.applyReaderDirectoryProjection(entries);
   assert.equal(x.idx.detailToc[0]?.bookmarks,undefined,'unknown is retained until the canonical list returns');
   if(order==='catalog-before-ready'){
    assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,0,'catalog alone cannot delay first presentation');
    x.idx.presentPreparedReading(0);
   }
   await tick();await f.settle();
   assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1,`${sourceId} ${order} reads once without another page or opening controls`);
   assert.deepEqual(x.idx.detailToc.map(entry=>entry.bookmarks),[[],[],[]],'canonical read makes all admitted chapters known');
   assert.equal(x.owner().snapshot().scopeId,scope,'bookmark readiness never remounts the reader');
   x.idx.presentPreparedReading(0);x.idx.presentPreparedReading(1);
   x.idx.applyReaderDirectoryProjection(entries);await tick();await f.settle();
   assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1,'duplicate ready/catalog callbacks cannot read every page');
   if(sourceId!=='local')assert.equal(f.calls.some(c=>['cache.book.status','book.detail','book.toc','chapter.content'].includes(c.method)),false,
    'cached remote bookmark readiness neither starts offline projection nor acquires a network session');
   checks.push(`actual-cold-${sourceId}-${order}-canonical-bookmarks-once`);
  }catch(error){failures.push(`${sourceId} ${order}: ${error.message}`);}
  finally{f.close();}
 }
 assert.deepEqual(failures,[],'cold reader canonical bookmark projection');
}
}
if(id==='late-directory'){
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'}),entries=[{index:0,title:'Persisted chapter',downloadState:'unknown'}];
 x.idx.readingOriginRoute='bookshelf';x.idx.openLocalBookDetail(book('old','local'),true);
 x.idx.applyReaderDirectoryProjection(entries);const old=x.idx.pendingLocalDirectoryProjection;
 assert.equal(typeof old,'function');
 x.idx.openLocalBookDetail(book('successor','local'),true);old();await tick();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,0,'retired ready work cannot borrow the successor book');
 x.idx.presentPreparedReading(0);x.idx.applyReaderDirectoryProjection(entries);await tick();await f.settle();
 assert.equal(x.idx.detailBook.bookId,'successor');assert.deepEqual(x.idx.detailToc[0].bookmarks,[]);
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,1,'successor late catalog still resolves once');
 f.close();checks.push('actual-cold-directory-old-owner-rejected-successor-late-catalog-resolves');
}
}
if(id==='late-session'){
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});
 x.idx.readingOriginRoute='bookshelf';x.idx.openRemoteBookDetail(seed(),'Source',book(),true);
 x.idx.presentPreparedReading(0);x.idx.onRemoteSessionReady(session());await tick();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,1,'session admitted after first presentation resolves its new catalog immediately');
 assert.ok(x.idx.detailToc.every(entry=>entry.bookmarks!==undefined));
 x.idx.presentPreparedReading(1);await tick();await f.settle();
 assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,1);
 f.close();checks.push('actual-remote-session-after-first-ready-canonical-read-without-next-page');
}
}
if(id==='remote-route'){
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.readingOriginRoute='bookshelf';
 x.idx.openRemoteBookDetail(seed(),'Source',book(),true);
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.readingSessionActive,true);assert.equal(x.idx.detailBook.bookId,'book');
 assert.equal(x.idx.remoteReadingSeed.detailUrl,'book');assert.equal(f.calls.filter(c=>!['intent'].includes(c.method)).length,0);
 const scope=x.owner().snapshot().scopeId;assert.equal(x.idx.readingEntryScopeId,scope);
 assert.equal(x.idx.remoteReadingSession,undefined);assert.equal(x.idx.detailToc.length,0);
 x.idx.shelfReceiptRetired=true;x.idx.retireReadingEntryPresentation();f.close();checks.push('actual-Index-remote-shelf-first-reader-route-no-parent-detail-body-IO');
}
}
if(id==='local-route'){
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.readingOriginRoute='bookshelf';
 x.idx.openLocalBookDetail(book('local-book','local'),true);
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.detailBook.sourceName,'本地书籍');assert.equal(f.calls.length,0);
 x.idx.applyReaderDirectoryProjection([{index:0,title:'Native first chapter',navigable:true}]);
 const scope=x.owner().snapshot().scopeId;assert.equal(x.owner().snapshot().toc[0].title,'Native first chapter');
 assert.ok(x.idx.pendingLocalDirectoryProjection);assert.equal(f.calls.length,0,'no IO before actual first-frame readiness');
 x.idx.presentPreparedReading(0);await tick();await f.settle();
 assert.equal(x.owner().snapshot().scopeId,scope,'native TOC refresh never remounts/rebinds reader scope');
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);f.close();checks.push('actual-local-reader-native-TOC-owner-same-scope-postframe-shared-directory');
}
}
if(id==='detail-reading-action'){
{
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source');
 assert.equal(x.idx.route,'detail');assert.equal(x.idx.detailLoadingMessage,'正在获取在线目录…');
 const loadingLeaf=x.render();assert.equal(loadingLeaf.loadingMessage,'正在获取在线目录…');assert.equal(loadingLeaf.readingEnabled,false);
 await until(()=>x.idx.remoteContentVerdict==='readable');await f.settle();
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);
 x.idx.replay();const leaf=loadingLeaf;assert.equal(x.p.walk(x.idx).filter(c=>c instanceof x.leaf).length,1,'same-admission detail remains mounted through async property updates');assert.equal(leaf.loadingMessage,'');assert.equal(leaf.book.bookId,'book');assert.equal(leaf.toc.length,3);assert.equal(leaf.readingEnabled,true);
 assert.equal(leaf.readingBlockedReason,'');leaf.actionArea();
 const action=x.p.nodes(leaf).find(n=>n.type==='Text'&&n.create==='开始阅读');assert.ok(action?.onClick);
 const before=f.calls.length;action.onClick();
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.readingSessionActive,true);assert.equal(f.calls.length,before,'actual native action does not run parent probe again');
 f.close();checks.push('actual-Gateway-Coordinator-Entry-Index-decorated-detail-and-native-reading-action');
}
}
if(id==='late-detail-action'){
{
 const f=fixture(),x=makeIndex(f);const gate=deferred();f.gates.set('book.detail:'+f.key('s1','first'),gate);
 x.idx.openRemoteBookDetail(seed('first'),'First');await until(()=>f.calls.some(c=>c.method==='book.detail'));
 const old=x.render(),oldContinue=old.onContinue,oldBack=old.onBack;
 x.idx.openRemoteBookDetail(seed('second'),'Second');await until(()=>x.idx.remoteContentVerdict==='readable');
 const current=x.render();assert.notEqual(old,current,'different admission owns fresh regular callbacks');
 gate.resolve();await f.settle();await tick();assert.equal(x.idx.detailBook.bookId,'second');
 const nav=x.idx.navigationGeneration;oldContinue();oldBack();assert.equal(x.idx.navigationGeneration,nav);assert.equal(x.idx.route,'detail');
 current.onContinue();assert.equal(x.idx.route,'reading');f.close();checks.push('actual-old-IO-and-retained-native-detail-callback-cannot-read-new-admission');
}
}
if(id==='remount-owner'){
{
 const f=fixture(),first=makeIndex(f);first.idx.openRemoteBookDetail(seed(),'Source');await until(()=>first.idx.remoteContentVerdict==='readable');
 const retained=first.owner();const successor=makeIndex(f,{mount:2});successor.idx.openRemoteBookDetail(seed('successor'),'Source');await until(()=>successor.idx.remoteContentVerdict==='readable');
 const scope=retained.snapshot().scopeId;first.idx.shelfReceiptRetired=true;first.idx.retireReadingEntryPresentation();
 assert.equal(successor.owner(),retained);assert.equal(retained.snapshot().scopeId,scope,'old precise teardown does not retire successor lease');
 assert.equal(successor.idx.detailBook.bookId,'successor');f.close();checks.push('actual-same-Runtime-owner-reuse-old-Index-teardown-cannot-retire-successor');
}
}
if(id==='negative-detail-guard'){
{
 const source=read('pages/Index.ets');
 const start=source.indexOf('  private isCurrentDetailPresentation('),end=source.indexOf('\n  @Builder',start);
 assert.ok(start>=0&&end>start);
 const broken=source.slice(0,start)+'  private isCurrentDetailPresentation(_identity: string, _owner: ReaderRuntimeOwner | undefined): boolean { return true; }\n'+source.slice(end);
 const f=fixture(),x=makeIndex(f,{indexSource:broken});x.idx.openRemoteBookDetail(seed('first'),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');
 const old=x.render();x.idx.openRemoteBookDetail(seed('second'),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');
 old.onContinue();assert.equal(x.idx.route,'reading','negative control proves the old physical handler borrows the new entry if its real admission guard is removed');
 assert.equal(x.idx.detailBook.bookId,'second');f.close();checks.push('negative-removed-admission-guard-exposes-real-native-old-handler-new-owner-borrow');
}
}
if(id==='cache-recovery'){
for(const mode of ['success','decline','leave','runtime-unavailable','rules-changed']){
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source',book(),true);
 x.idx.onRemoteSessionReady(session());const error=new (await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts')).RemoteChapterCacheRefreshError(session(),0,undefined,false);
 const gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);
 assert.equal(await x.idx.refreshCachedChapterFromPrompt(error,()=>!x.idx.shelfReceiptRetired),undefined);
 assert.equal(f.nativeAlert,undefined,'cache proof failure no longer opens a native modal');
 assert.equal(f.calls.some(c=>c.p?.forceRefresh),false,'background probe does not fetch replacement content');
 const notice=x.idx.indexRecoveryNotice.generation;
 if(mode!=='decline')x.idx.runIndexRecoveryAction(notice);
 await tick();
 if(mode==='leave')x.idx.nextNavigationGeneration();
 if(mode==='runtime-unavailable'){f.runtime.closed=true;setRuntime(undefined);}
 if(mode==='rules-changed')f.coordinator.projectionRevision+=1;
 gate.resolve();await f.settle();await tick();
 if(mode==='success'){assert.equal(x.idx.remoteContentVerdict,'readable');assert.equal(x.idx.remoteReadingSession.preparedChapter.chapter.chapterIndex,0);}
 else assert.equal(x.idx.remoteReadingSession?.preparedChapter,undefined);
 if(mode==='decline')assert.equal(f.calls.some(c=>c.p?.forceRefresh),false);
 f.close();checks.push('actual-inline-cache-refresh-owner-exact-revision-'+mode);
}
}
if(id==='visible-preparation'){
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.prepareVisibleReadingBooks([book()]);await f.settle();
 assert.ok(f.calls.some(c=>c.method==='context'));assert.equal(f.preparations.paused,false);
 x.idx.route='detail';x.idx.onSearchVisibilityChanged();assert.equal(f.preparations.paused,true);f.close();
 checks.push('actual-Index-visible-idle-preparation-delegation-context-and-pause');
}
}
if(id==='restored-identity'){
for (const mutated of [false, true]) {
 const baseline=read('pages/Index.ets');
 const broken=baseline.replace(/const admitted = host\.snapshot\(\);\n    if \(admitted\.scopeId !== this\.readingEntryScopeId \|\| admitted\.book\?\.sourceId !== this\.detailBook\.sourceId \|\|\n      admitted\.book\?\.bookId !== this\.detailBook\.bookId\)/,
  'if (host.snapshot().scopeId !== this.readingEntryScopeId)').replace('const previous = this.readingEntryPublishedSnapshot;',
  'const previous = undefined;');
 const f=fixture(),x=makeIndex(f,{indexSource:mutated?broken:baseline});
 x.idx.openRemoteBookDetail(seed(),'Source',book(),true);x.idx.onRemoteSessionReady(session());
 const scope=x.owner().snapshot().scopeId,oldSession=x.idx.remoteReadingSession;
 x.idx.detailBook={...x.idx.detailBook,sourceId:'restored-source',bookId:'restored-book'};x.idx.detailToc=[];
 const before=f.calls.length;x.idx.installRemoteReadingSession(undefined);
 if(mutated) assert.equal(x.idx.detailBook.bookId,'book','negative control removes both independent identity and unchanged-snapshot guards to reproduce the stale same-scope Entry book overwrite');
 else {
  assert.equal(x.idx.detailBook.bookId,'restored-book');assert.equal(x.owner().snapshot().book.bookId,'restored-book');
  assert.notEqual(x.owner().snapshot().scopeId,scope);assert.equal(x.owner().snapshot().session,undefined);
  assert.notEqual(x.owner().snapshot().session,oldSession);assert.equal(x.idx.remoteReadingSession,undefined);assert.equal(x.idx.detailToc.length,0);
 }
 assert.equal(f.calls.length,before,'identity rebinding is admission only, not another acquisition');f.close();
 checks.push(mutated?'negative-identity-plus-snapshot-guards-removed-old-book-overwrite':'same-scope-restored-identity-rebind-without-old-session-or-extra-IO');
}
}
if(id==='body-retention'){
for(const negative of ['none','snapshot-reset','metadata-clone']) {
 const original=read('features/reading/ReadingEntryHost.ts');
 const mutated=original.replace(/const metadataChanged = detail\.title[\s\S]*?detail\.mangaPosition !== book\.mangaPosition;/,'const metadataChanged = true;');
 assert.notEqual(mutated,original,'negative forces the old unchanged-metadata copy behavior');
 const f=fixture(negative==='metadata-clone'?compileHost(mutated):ProductionHost);
 const source=read('pages/Index.ets');
 const x=makeIndex(f,{indexSource:negative==='snapshot-reset'?source.replace('const previous = this.readingEntryPublishedSnapshot;','const previous = undefined;'):source});
 x.idx.openRemoteBookDetail(seed(),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');await f.settle();
 const initialRender=x.leaf.prototype.initialRender;x.leaf.prototype.initialRender=function(){this.introExpanded=true;return initialRender.call(this);};
 const leaf=x.render(),initialBook=x.idx.detailBook,initialToc=x.idx.detailToc,initialSession=x.idx.remoteReadingSession;
 const actors=[x.idx.observers.length,leaf.observers.length],scope=x.idx.readingEntryScopeId,nav=x.idx.navigationGeneration;
 const scroll=[...leaf.nodes.values()].find(node=>node.type==='Scroll');assert.ok(scroll);scroll.nativeOffset={x:0,y:720};
 const copyStart=x.p.properties.copies.length;
 x.idx.detailInBookshelf=true;x.idx.readableAdmissions=[{key:'s1\0book',generation:1,adding:false,cancelling:false,message:'',confirmation:'confirmed'}];
 await x.idx.refreshDetailAcquisitionProjection();x.p.properties.flush();
 const bodyCopies=x.p.properties.copies.slice(copyStart).filter(sample=>sample.object&&['book','toc'].includes(sample.name));
 if(negative==='none') {
  assert.deepEqual(bodyCopies,[],'membership-only projection must not reset actual book/TOC SDK props');
  assert.equal(x.idx.detailBook,initialBook);assert.equal(x.idx.detailToc,initialToc);assert.equal(x.idx.remoteReadingSession,initialSession);
  assert.deepEqual([x.idx.observers.length,leaf.observers.length],actors);assert.equal(x.idx.readingEntryScopeId,scope);assert.equal(x.idx.navigationGeneration,nav);
  assert.deepEqual(scroll.nativeOffset,{x:0,y:720});assert.equal(leaf.introExpanded,true);assert.equal(leaf.inBookshelf,true);
  const before=f.calls.length;x.idx.readableAdmissions=[{key:'s1\0book',generation:2,adding:true,cancelling:false,message:'',confirmation:'none'}];
  await x.idx.refreshDetailAcquisitionProjection();x.p.properties.flush();assert.equal(f.calls.length,before,'an active membership mutation blocks full acquisition projection IO');
  assert.equal(x.idx.detailBook,initialBook);assert.equal(x.idx.detailToc,initialToc);
  x.idx.readableAdmissions=[];
  const row=f.rows.get(f.key('s1','book'));row.intro='确切的新介绍';await x.idx.refreshDetailAcquisitionProjection();x.p.properties.flush();
  assert.equal(leaf.book.intro,'确切的新介绍','the membership optimization must still publish changed metadata');
  assert.equal([...leaf.nodes.values()].find(node=>node.type==='Scroll'),scroll);assert.equal(leaf.introExpanded,true);
 } else assert.ok(bodyCopies.some(sample=>sample.name===(negative==='metadata-clone'?'book':'toc')),
  'negative control independently restores the old full body-property reset');
 f.close();checks.push('actual-detail-membership-body-scroll-metadata-'+negative);
}
}
if(id==='shelf-add'){
for(const result of ['confirmed','unknown','cancelled']) {
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');await f.settle();
 const initialRender=x.leaf.prototype.initialRender;x.leaf.prototype.initialRender=function(){this.introExpanded=true;return initialRender.call(this);};
 const leaf=x.render(),bookBefore=x.idx.detailBook,tocBefore=x.idx.detailToc,nav=x.idx.navigationGeneration,scope=x.idx.readingEntryScopeId;
 const scroll=[...leaf.nodes.values()].find(node=>node.type==='Scroll'),actors=[x.idx.observers.length,leaf.observers.length];scroll.nativeOffset={x:0,y:613};
 const secondary=[...leaf.nodes.values()].find(node=>node.type==='Text'&&node.create==='加入书架');assert.ok(secondary?.onClick);
 const gate=deferred();let adds=0,cancels=0;f.coordinator.addReadableBook=async()=>{adds++;return gate.promise;};
 f.coordinator.cancelReadableBook=async()=>{cancels++;};const copyStart=x.p.properties.copies.length;
 secondary.onClick();secondary.onClick();assert.equal(adds,1,'pending repeated physical clicks cannot submit a second add');x.p.properties.flush();
 assert.equal(secondary.create,'取消加入','the pending operation remains visible on the retained secondary actor');assert.equal(leaf.adding,true);
 if(result==='cancelled') {secondary.onClick();secondary.onClick();await until(()=>!x.idx.detailReadableAdmission(x.idx.detailBook).cancelling);assert.equal(cancels,1);gate.reject(Error('cancelled acquisition'));}
 else if(result==='unknown')gate.reject(Error('lost add ACK'));
 else gate.resolve({data:{sourceId:'s1',bookId:'book',created:true,addedAt:1}});
 await f.settle();await tick();x.p.properties.flush();
 assert.equal(x.idx.route,'detail');assert.equal(x.idx.navigationGeneration,nav);assert.equal(x.idx.readingEntryScopeId,scope);
 assert.equal(x.idx.detailBook,bookBefore);assert.equal(x.idx.detailToc,tocBefore);
 assert.equal(x.idx.observers.length,actors[0]);assert.equal(leaf.observers.length,actors[1],
  'Toast and top recovery projection do not add operation Text into the retained detail body');
 assert.deepEqual(scroll.nativeOffset,{x:0,y:613});assert.equal(leaf.introExpanded,true);
 assert.deepEqual(x.p.properties.copies.slice(copyStart).filter(sample=>sample.object&&['book','toc'].includes(sample.name)),[],
  'add pending/receipt/cancellation must change only membership and operation props');
 if(result==='confirmed'){assert.equal(secondary.create,'移除书架');assert.equal(leaf.inBookshelf,true);}
 if(result==='unknown'){assert.equal(secondary.create,'取消加入');assert.equal(leaf.inBookshelf,false);assert.equal(leaf.shelfMessage,'','unknown original add is not an inline detail message');
  x.idx.detailOperationNoticeContent();const pending=x.p.walk(x.idx).findLast(actor=>actor instanceof x.p.deps.ReaderRecoveryNotice);assert.ok(pending);assert.match(pending.view.message,/加入书架未完成/);}
 if(result==='cancelled'){assert.equal(secondary.create,'加入书架');assert.equal(leaf.inBookshelf,false);assert.equal(leaf.shelfMessage,'已取消加入书架');}
 f.close();checks.push('actual-detail-native-add-retains-body-pending-'+result);
}
}
if(id==='atomic-bind'){
{
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');await f.settle();
 const old=x.owner().snapshot(),rebound=[],apply=x.idx.applyReadingEntrySnapshot.bind(x.idx);
 x.idx.applyReadingEntrySnapshot=snapshot=>{rebound.push(snapshot);apply(snapshot);};x.idx.bindReadingEntryReader();
 // The live Index lease carries the visible TOC into one admission publication.
 assert.equal(x.idx.detailToc.length,old.toc.length);assert.equal(x.owner().snapshot().toc.length,old.toc.length);
 assert.equal(rebound.length,1,'reader binding publishes its complete admission once');
 assert.equal(x.idx.detailLoadingMessage,'');assert.equal(rebound.some(snapshot=>snapshot.toc.length===0),false,'reader binding never publishes an empty intermediate directory');
 f.close();checks.push('actual-detail-bind-atomic-existing-directory-no-empty-intermediate');
}
}
}finally{for(const f of owned)f.close();setRuntime(undefined);}
}
const definitions={"validated-bookmarks": "validated-bookmarks actual production scoped behavior, controlled IO; no native device claim", "cold-order": "cold-order actual production scoped behavior, controlled IO; no native device claim", "late-directory": "late-directory actual production scoped behavior, controlled IO; no native device claim", "late-session": "late-session actual production scoped behavior, controlled IO; no native device claim", "remote-route": "remote-route actual production scoped behavior, controlled IO; no native device claim", "local-route": "local-route actual production scoped behavior, controlled IO; no native device claim", "detail-reading-action": "detail-reading-action actual production scoped behavior, controlled IO; no native device claim", "late-detail-action": "late-detail-action actual production scoped behavior, controlled IO; no native device claim", "remount-owner": "remount-owner actual production scoped behavior, controlled IO; no native device claim", "negative-detail-guard": "negative-detail-guard actual production scoped behavior, controlled IO; no native device claim", "cache-recovery": "cache-recovery actual production scoped behavior, controlled IO; no native device claim", "visible-preparation": "visible-preparation actual production scoped behavior, controlled IO; no native device claim", "restored-identity": "restored-identity actual production scoped behavior, controlled IO; no native device claim", "body-retention": "body-retention actual production scoped behavior, controlled IO; no native device claim", "shelf-add": "shelf-add actual production scoped behavior, controlled IO; no native device claim", "atomic-bind": "atomic-bind actual production scoped behavior, controlled IO; no native device claim"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
