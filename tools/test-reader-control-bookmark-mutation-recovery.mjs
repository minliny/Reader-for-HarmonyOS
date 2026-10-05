import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { loadReaderControlBookmarkProjection, mergeReaderControlBookmarkProjection }
  from '../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

const {fixture,bookmarkInput,deferred,until}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeIndex,settled}=await import('./lib/reading-directory-sdk-consumer.mjs');
const book={sourceId:'local',bookId:'book',title:'Book',author:'Author'};
const row=(bookmarks=[],title='Chapter',downloadState='completed')=>({index:0,title,downloadState,bookmarks});
const mark=time=>({time,chapterIndex:0,chapterOffset:12,chapterTitle:'Chapter',content:'saved'});
async function actual(mode){const f=await fixture(true),x=makeIndex(f),h=x.idx;await h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);
 const seed=async(offset)=>{const r=await f.command('bookmark.create',{bookName:book.title,bookAuthor:book.author,chapterIndex:0,chapterPos:offset,chapterName:'Chapter',content:'saved'});return r.data.bookmark.time;};
 const times=mode==='delete'?[await seed(12)]:[];if(times.length)await h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);
 const mutate=()=>{if(mode==='chapter')h.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});else if(mode==='delete')h.deleteDirectoryBookmarks(times);else h.toggleReaderPageBookmark({chapterIndex:0,chapterOffset:12,chapterTitle:'Chapter',bookText:'saved',bookmarkTimes:[]});};
 return{f,x,h,mutate,seed};}
for(const mode of ['chapter','position','delete']){
 const t=await actual(mode),before=structuredClone(t.h.detailToc),native=t.f.runtime.request.bind(t.f.runtime);let reads=0;
 t.f.runtime.request=async(m,p,o)=>{if(m==='bookmark.list'){reads++;throw Error('read failed after committed write');}return native(m,p,o);};
 t.mutate();await settled(t.f);assert.equal(t.f.writes().length,1);assert.equal(reads,1);
 assert.deepEqual(t.h.detailToc,before,'failed reload retains available history and marks it stale instead of inventing empty/unknown rows');
 assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'confirmed');assert.equal(t.h.directoryOperation.projection.facts.stale,true);assert.match(t.h.controlBookmarkProjectionMessage(),/已确认.*刷新失败/);
 t.mutate();await settled(t.f);assert.equal(t.f.writes().length,1,'stale mutation projection cannot admit a second write');
 t.f.runtime.request=native;await t.h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);assert.equal(t.f.writes().length,1);
 assert.equal(t.h.directoryOperation.projection.facts.stale,false);assert.equal(t.h.controlBookmarkProjectionMessage(),'');
 assert.equal(t.h.detailToc[0].bookmarks.length,mode==='delete'?0:1);assert.equal(t.h.detailToc[0].downloadState,'completed');
}
{
 const t=await actual('position'),native=t.f.runtime.request.bind(t.f.runtime);t.f.options.afterMethod='bookmark.create';let allowQuery=false;
 t.f.runtime.request=async(m,p,o)=>{if(m==='bookmark.operation.query'&&!allowQuery)throw Error('original exact query unavailable');return native(m,p,o);};
 // Preserve preparation query, lose only queries after actual dispatch.
 t.f.runtime.request=async(m,p,o)=>{if(m==='bookmark.operation.query'&&!allowQuery&&t.f.writes().length>0)throw Error('original exact query unavailable');return native(m,p,o);};
 t.mutate();await settled(t.f);assert.equal(t.f.writes().length,1);assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'unknown');
 await t.h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'unknown','matching list cannot settle original ACK');
 t.mutate();await settled(t.f);assert.equal(t.f.writes().length,1);allowQuery=true;
 const op=t.h.directoryOperation;t.h.reconcileDirectoryOperation(op.generation,t.h.directoryOperationPresentationId());await settled(t.f);
 assert.equal(t.f.writes().length,1);assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'confirmed');assert.equal(t.h.detailToc[0].bookmarks[0].chapterOffset,12);
}
{
 const t=await actual('delete'),second=await t.seed(24);await t.h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);const times=t.h.detailToc[0].bookmarks.map(b=>b.time),native=t.f.runtime.request.bind(t.f.runtime);let deletes=0,allowQuery=false;
 t.f.runtime.request=async(m,p,o)=>{if(m==='bookmark.delete'&&++deletes===2){t.f.calls.push({method:m,params:p});o.onDispatch?.();throw Error('second reply unknown before observed effect');}if(m==='bookmark.operation.query'&&deletes===2&&!allowQuery)throw Error('second exact query unavailable');return native(m,p,o);};
 t.h.deleteDirectoryBookmarks(times);await settled(t.f);assert.equal(deletes,2);assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'unknown');
 await t.h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);assert.equal(deletes,2);assert.equal(t.h.directoryOperation.projection.receipt.confirmation,'unknown');
 const live=await t.f.command('bookmark.list',{bookName:book.title,bookAuthor:book.author});assert.deepEqual(live.data.bookmarks.map(b=>b.time),[second]);
}
{
 const t=await actual('position'),gate=deferred();t.f.options.pauseMethod='bookmark.create';t.f.options.pauseAfterDispatch=true;t.f.options.gate=gate;t.mutate();
 await until(()=>t.f.writes().length===1);t.h.detailBook={...book,bookId:'successor'};t.h.navigationGeneration++;t.h.detailToc=[row([mark(9)])];gate.reject(Error('late write failure'));await settled(t.f);
 assert.equal(t.h.detailBook.bookId,'successor');assert.equal(t.h.detailToc[0].bookmarks[0].time,9);assert.equal(t.f.directory.snapshot().projection.receipt.confirmation,'unknown');
}
{
 const t=await actual('position'),gate=deferred(),native=t.f.runtime.request.bind(t.f.runtime);t.f.runtime.request=async(m,p,o)=>{if(m==='bookmark.list')await gate.promise;return native(m,p,o);};t.mutate();
 await until(()=>t.f.writes().length===1);t.h.detailToc=[row([],'Converted title','queued')];gate.resolve();await settled(t.f);
 assert.equal(t.h.detailToc[0].title,'Converted title');assert.equal(t.h.detailToc[0].downloadState,'queued');assert.equal(t.h.detailToc[0].bookmarks[0].chapterOffset,12);
}
// Execute real Host watchers/loading, including either ArkUI prop delivery order.
const hostSource = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const hostMethods = hostSource.slice(hostSource.indexOf('  private loadControlBookmarks('),
  hostSource.indexOf('  private async loadAppearanceSnapshot('));
const HostProbe = new Function('readerControlContentLocation', 'hilog',
  `${stripTypeScriptTypes(`class HostProbe { ${hostMethods} }`)}; return HostProbe;`)(
  sessionPolicy.readerControlContentLocation, { warn() {} });
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const messageFirst of [false, true]) {
  const owner = new HostProbe();
  owner.reconcilePageBookmarkFeedback = () => {}; let reads = 0; const notices = [];
  Object.assign(owner, { mounted: true, exitRequested: false, lifecycleToken: 1,
    sourceId: book.sourceId, bookId: book.bookId, controlOpenRevision: 1,
    controlSession: sessionPolicy.enterReaderControlModule(sessionPolicy.openReaderControlSession(
      sessionPolicy.createReaderControlSessionState(), 0), 'directory', 0),
    controlVisible: () => true, isSessionActive: token => token === 1,
    controlBookmarkLoadGeneration: 0, controlBookmarkLoadPending: false, controlBookmarkLoadFailed: false,
    appForeground: true, windowChromeActive: true, controlBookmarkFailureNoticeKey: '',
    getUIContext: () => ({ getPromptAction: () => ({ showToast: notice => notices.push(notice.message) }) }),
    directoryEntries: [row()], bookmarkLoadMessage: '', errorMessage: error => error.message,
    onLoadControlBookmarks: async () => { reads++; throw Error('list failed'); } });
  const deliverMessage = () => { owner.bookmarkLoadMessage = '书签已更新，但列表载入失败，请重新载入核对';
    if (owner.onControlBookmarkFailureChanged) owner.onControlBookmarkFailureChanged(); };
  const deliverRows = () => { owner.directoryEntries = [row(undefined)];
    // row() defaults to [], so explicitly model unknown canonical projection.
    owner.directoryEntries[0].bookmarks = undefined;
    owner.onControlDirectoryDataChanged(); };
  if (messageFirst) { deliverMessage(); deliverRows(); } else { deliverRows(); deliverMessage(); }
  await flush();
  assert.equal(owner.controlBookmarkLoadFailed, true);
  assert.equal(reads, 0, 'mutation failure cannot silently auto-loop, irrespective of prop order');
  assert.equal(owner.controlBookmarkLoadPending, false);
  assert.equal(notices.length, 1, 'mutation failure produces one nonblocking notice even outside bookmark tab');
  assert.match(notices[0], /已更新.*目录.*书签.*重新载入/);
  owner.onControlBookmarkFailureChanged(); owner.onControlDirectoryDataChanged();
  assert.equal(notices.length, 1, 'the same failure/watch or motion-related data delivery never repeats its toast');
  owner.loadControlBookmarks(); await flush();
  assert.equal(reads, 1, 'explicit retry invokes only the canonical list callback');
  assert.equal(owner.controlBookmarkLoadFailed, true);
  owner.directoryEntries = [row([])]; owner.onControlDirectoryDataChanged();
  assert.equal(owner.controlBookmarkLoadFailed, true, 'old confirmed rows cannot erase explicit mutation uncertainty');
  owner.onLoadControlBookmarks = async () => { reads++; owner.directoryEntries = [row([mark(8)])];
    owner.onControlDirectoryDataChanged(); owner.bookmarkLoadMessage = '';
    owner.onControlBookmarkFailureChanged(); };
  owner.loadControlBookmarks(); await flush();
  assert.equal(reads, 2); assert.equal(owner.controlBookmarkLoadFailed, false);
  assert.equal(owner.controlBookmarkLoadPending, false);
  owner.bookmarkLoadMessage = '书签操作结果未确认，请重新载入核对，不要重复操作';
  owner.onControlBookmarkFailureChanged();
  assert.equal(notices.length, 2); assert.match(notices[1], /结果未确认.*不要重复/);
  for (const invalidation of ['mounted', 'appForeground', 'windowChromeActive', 'exitRequested']) {
    owner.bookmarkLoadMessage = `${invalidation}: 旧上下文失败`;
    owner[invalidation] = invalidation === 'exitRequested';
    owner.onControlBookmarkFailureChanged();
    assert.equal(notices.length, 2, 'inactive/exited owner cannot produce a new notice');
    owner[invalidation] = invalidation !== 'exitRequested';
  }
  owner.getUIContext = () => { throw Error('detached context'); };
  owner.bookmarkLoadMessage = '新的已更新但待核实状态';
  assert.doesNotThrow(() => owner.onControlBookmarkFailureChanged(), 'native toast exceptions remain contained');
  assert.equal(owner.controlBookmarkLoadFailed, true, 'toast availability cannot erase actionable error state');
}
console.log('Bookmark mutation recovery: actual Index CRUD/reload and Host error/retry functions PASS; not native acceptance');
