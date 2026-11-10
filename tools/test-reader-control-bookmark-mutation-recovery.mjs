import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'durable-recovery':{description:'Actual bookmark Index/DirectoryHost exact receipt and committed-write reload recovery via existing Core CLI',resources:[]},
 'host-retry':{description:'Actual bookmark Host/Gateway/Operations and reader list versus unknown-write recovery, input identity and retry without Native',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const book={sourceId:'local',bookId:'book',title:'Book',author:'Author'};
const row=(bookmarks=[],title='Chapter',downloadState='completed')=>({index:0,title,downloadState,bookmarks});
const mark=time=>({time,chapterIndex:0,chapterOffset:12,chapterTitle:'Chapter',content:'saved'});
if(selectedCase==='durable-recovery'){
const {bookmarkFixture:fixture,deferred,until,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeIndex,settledBookmarks:settled}=await import('./lib/reading-directory-sdk-consumer.mjs');
console.log(JSON.stringify({kind:'reader-existing-tool-evidence',...durableFixtureToolEvidence()}));
try {
async function actual(mode){const f=await fixture(true),x=makeIndex(f,{domain:'bookmark'}),h=x.idx;await h.loadControlBookmarks(book.sourceId,book.bookId,()=>true);
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
 const op=t.h.directoryOperation;t.h.reconcileDirectoryOperation(op.generation,t.h.directoryOperations.presentationId(t.h.directoryOperationScene()));await settled(t.f);
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

}finally{await cleanupDurableFixtures();}
}else{
const sessionPolicy=await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
const {readerControlHostInputEnabled}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
const {compile}=await import('./lib/reading-operation-durable-probe.mjs');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const {projectPersistedReceipt}=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const {loadReaderControlBookmarkProjection}=await import('../entry/src/main/ets/features/reading/presentation/ReaderControlBookmarkLoad.ts');
const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
const {actualReaderDirectoryOperations}=await import('./lib/reader-directory-operations-probe.mjs');
const {ReaderTransientFeedback}=await import('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const {readFileSync}=await import('node:fs');
const hostUrl=new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url);
const HostProbe=selectedProductionMethods(hostUrl,'ReadingExperience',[
 'loadControlBookmarks','onControlBookmarkFailureChanged','onControlDirectoryDataChanged',
 'bookmarkRecoveryIdentity','reconcileBookmarkRecovery','isControlInputEnabled','isSessionActive','isMountedToken'],
 {readerControlContentLocation:sessionPolicy.readerControlContentLocation,readerControlHostInputEnabled,hilog:{warn(){}}});
const Directory=compile('features/reading/application/ReaderDirectoryHost.ts','ReaderDirectoryHost',
 {ReaderWriteEvidence,projectPersistedReceipt,loadReaderControlBookmarkProjection},true);
const flush = () => new Promise(resolve => setImmediate(resolve));
function reader(){
 const notices=[],owner=new HostProbe();
 const storage=new Map([['readerAppForeground',true]]);
 globalThis.AppStorage={get:key=>storage.get(key),setOrCreate:(key,value)=>{
  storage.set(key,value);if(key==='readerTransientToast'&&value.visible)notices.push(value.message);
 }};
 Object.assign(owner,{mounted:true,exitRequested:false,lifecycleToken:1,sourceId:book.sourceId,bookId:book.bookId,
  controlOpenRevision:1,controlSession:sessionPolicy.enterReaderControlModule(sessionPolicy.openReaderControlSession(
   sessionPolicy.createReaderControlSessionState(),0),'directory',0),controlVisible:()=>true,
  controlBookmarkLoadGeneration:0,controlBookmarkLoadPending:false,controlBookmarkLoadFailed:false,
  appForeground:true,windowChromeActive:true,interactionBlocked:false,controlObscured:false,
  controlBookmarkFailureNoticeKey:'',bookmarkPresentationRevision:0,controlDirectoryDataRetained:false,
  reconcilePageBookmarkFeedback(){},usesBookTurnSimulation:()=>false,errorMessage:error=>error.message,
  transientFeedback:new ReaderTransientFeedback(),directoryEntries:[{...row(),bookmarks:undefined}],bookmarkLoadMessage:'',
  getUIContext:()=>({getPromptAction:()=>({showToast:notice=>notices.push(notice.message)})})});
 return{owner,notices};
}
// Both Prop orders preserve the read's ticket; an actual failed read remains
// an actionable error, while a successful canonical read can clear it.
for (const messageFirst of [false, true]) {
  const {owner,notices}=reader();let reads=0,release,reject,guard;
  owner.onLoadControlBookmarks=async(_source,_book,current)=>{reads++;guard=current;
   await new Promise((resolve,no)=>{release=resolve;reject=no;});};
  const deliverMessage = () => { owner.bookmarkLoadMessage = '书签已更新，但列表载入失败，请重新载入核对';
    owner.onControlBookmarkFailureChanged(); };
  if(messageFirst)deliverMessage();owner.loadControlBookmarks();await flush();if(!messageFirst)deliverMessage();
  assert.equal(guard(),true,'a recovery/error message cannot retire the pending canonical read');
  assert.equal(owner.controlBookmarkLoadPending,true);
  reject(Error('canonical list failed'));await flush();
  assert.equal(owner.controlBookmarkLoadFailed,true);assert.equal(reads,1);
  assert.equal(owner.controlBookmarkLoadPending,false);assert.equal(notices.length,1);
  assert.match(notices[0], /已更新.*目录.*书签.*重新载入/);
  owner.onControlBookmarkFailureChanged(); owner.onControlDirectoryDataChanged();
  assert.equal(notices.length, 1, 'the same failure/watch or motion-related data delivery never repeats its toast');
  assert.equal(reads,1,'repeated data/error delivery never auto-loops a failed list');
  owner.loadControlBookmarks();await flush();assert.equal(reads,2);
  owner.directoryEntries=[row([mark(8)])];owner.bookmarkLoadMessage='';owner.onControlBookmarkFailureChanged();
  assert.equal(guard(),true);release();await flush();
  assert.equal(owner.controlBookmarkLoadFailed,false);assert.equal(owner.controlBookmarkLoadPending,false);
  for (const invalidation of ['mounted', 'appForeground', 'windowChromeActive', 'exitRequested']) {
    owner.bookmarkLoadMessage = `${invalidation}: 旧上下文失败`;
    owner[invalidation] = invalidation === 'exitRequested';
    owner.onControlBookmarkFailureChanged();
    assert.equal(notices.length, 1, 'inactive/exited owner cannot produce a new notice');
    owner[invalidation] = invalidation !== 'exitRequested';
  }
  owner.getUIContext = () => { throw Error('detached context'); };
  owner.bookmarkLoadMessage = '新的已更新但待核实状态';
  assert.doesNotThrow(() => owner.onControlBookmarkFailureChanged(), 'native toast exceptions remain contained');
  assert.equal(owner.controlBookmarkLoadFailed, true, 'toast availability cannot erase actionable error state');
}

// Real Host and Gateway decode a controlled canonical RPC. Only the existing
// durable-recovery I/O outcome is supplied: its original intent stays unknown.
for(const outcome of ['empty','rows','rpc-failed','malformed']){
 const {owner}=reader(),calls=[],pending=Object.freeze({version:1,method:'bookmark.create',phase:'pending',
  context:Object.freeze({...book,ownerAction:'createChapterStart'}),
  params:Object.freeze({operationId:'original/1',sequence:1,bookName:book.title,bookAuthor:book.author,chapterIndex:0})});
 const original=JSON.stringify(pending);let release,shouldCancel,diagnostics=0;
 const runtime={request:async(method,_params,options)=>{
  calls.push(method);assert.equal(method,'bookmark.list');shouldCancel=options.shouldCancel;
  await new Promise(resolve=>{release=resolve;});
  if(outcome==='rpc-failed')throw Error('canonical list unavailable');
  return{data:{bookmarks:outcome==='malformed'?{}:outcome==='empty'?[]:[{bookName:book.title,bookAuthor:book.author,
   chapterIndex:0,chapterPos:12,chapterName:'Chapter',content:'saved',bookText:'saved',time:8}]}};
 }};
 const listGateway=new LocalReadingFlowGateway(runtime);
 const gateway={pendingBookmarkOperation:async()=>pending,
  reconcileBookmarkOperation:async()=>{calls.push('original-receipt-query');throw Object.assign(Error('原操作结果尚未确认'),{blocked:true});},
  loadBookmarkProjection:listGateway.loadBookmarkProjection.bind(listGateway)};
 const directory=new Directory({gateway,ownsRuntime:()=>true});
 let scene={owner:runtime,retired:false,mount:1,navigation:1,presentation:1,sessionGeneration:1,
  directoryVisible:false,acceptsProjection:true,foreground:true,reading:true,offlineBusy:false,book};
 const Operations=actualReaderDirectoryOperations({ReaderDirectoryHost:{forRuntime:()=>directory}});
 const operations=new Operations({scene:()=>scene,ownsRuntime:runtimeOwner=>runtimeOwner===runtime,
  currentEntries:()=>owner.directoryEntries,replaceEntries:entries=>{owner.directoryEntries=entries;owner.onControlDirectoryDataChanged();},
  publishBookmarks:operation=>{owner.bookmarkRecovery=operations.recovery(operation,undefined);
   const message=operations.bookmarkMessage(operation);if(message!==owner.bookmarkLoadMessage){owner.bookmarkLoadMessage=message;owner.onControlBookmarkFailureChanged();}},
  diagnostic:()=>diagnostics++});
 owner.onLoadControlBookmarks=(source,book,current)=>operations.loadControlBookmarks(source,book,current);
 owner.loadControlBookmarks();await flush();assert.equal(typeof release,'function');
 assert.equal(shouldCancel(),false);assert.equal(owner.controlBookmarkLoadPending,true);
 const ticket=owner.controlBookmarkLoadGeneration;
 owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarks:{...owner.bookmarkRecovery.bookmarks,message:'原写仍需核对，新恢复消息'}};
 assert.equal(shouldCancel(),false,'unknown recovery-message changes do not cancel list admission');
 assert.equal(owner.controlBookmarkLoadGeneration,ticket);release();await flush();
 assert.equal(directory.snapshot().projection.receipt.confirmation,'unknown','list success/failure never confirms the original write');
 assert.equal(owner.bookmarkRecovery.bookmarksKind,'pending');assert.equal(owner.bookmarkRecovery.bookmarks.visible,true);
 assert.equal(owner.bookmarkLoadMessage,'','unknown write is never presented as a canonical list failure');
 const failed=outcome==='rpc-failed'||outcome==='malformed';
 assert.equal(owner.controlBookmarkLoadFailed,failed);assert.equal(owner.controlBookmarkLoadPending,false);
 assert.equal(directory.snapshot().projection.receipt.readback,failed?'failed':'succeeded');
 if(!failed)assert.equal(owner.directoryEntries[0].bookmarks.length,outcome==='rows'?1:0,'canonical list or confirmed empty stays available');
 else assert.equal(owner.directoryEntries[0].bookmarks,undefined,'read failure/corruption never manufactures empty');
 assert.equal(JSON.stringify(pending),original,'read/recovery does not amend the original intent or DTO');
 assert.equal(calls.filter(method=>method==='bookmark.list').length,1);
 assert.equal(calls.filter(method=>method==='original-receipt-query').length,1);
 const before=calls.length;await directory.createChapterStart(0,operations.bookmarkBinding(runtime,book));
 assert.equal(calls.length,before,'unknown original operation still blocks a new mutation');
 if(outcome==='empty'){
  const actions=[];owner.onReconcileBookmarks=(generation,presentation)=>{actions.push(['query',generation,presentation]);operations.reconcileBookmarks(generation,presentation,false);};
  owner.onContinueBookmarks=(generation,presentation)=>actions.push(['continue',generation,presentation]);
  const identity=owner.bookmarkRecoveryIdentity(),generation=owner.bookmarkRecovery.bookmarks.generation,
   presentation=owner.bookmarkRecovery.presentationId;
  for(const key of ['mounted','appForeground','windowChromeActive','exitRequested','interactionBlocked','controlObscured']){
   const old=owner[key];owner[key]=['exitRequested','interactionBlocked','controlObscured'].includes(key);
   owner.reconcileBookmarkRecovery(identity,false);owner[key]=old;
  }
  assert.equal(actions.length,0,'hidden, background, exited and covered readers reject the recovery action');
  owner.lifecycleToken++;owner.reconcileBookmarkRecovery(identity,false);owner.lifecycleToken--;
  owner.bookmarkRecovery={...owner.bookmarkRecovery,presentationId:'new-opening'};owner.reconcileBookmarkRecovery(identity,false);
  owner.bookmarkRecovery={...owner.bookmarkRecovery,presentationId:presentation};
  assert.equal(actions.length,0,'old lifecycle and presentation callbacks stay retired');
  owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarks:{...owner.bookmarkRecovery.bookmarks,generation:generation+1}};
  owner.reconcileBookmarkRecovery(identity,false);
  owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarks:{...owner.bookmarkRecovery.bookmarks,generation},bookmarksBusy:true};
  owner.reconcileBookmarkRecovery(identity,false);owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarksBusy:false};
  owner.isReaderIdentityCurrent=()=>false;owner.reconcileBookmarkRecovery(identity,false);owner.isReaderIdentityCurrent=()=>true;
  assert.equal(actions.length,0,'old operation, busy query and retired reader identity reject the recovery actor');
  owner.reconcileBookmarkRecovery(identity,true);assert.equal(actions.length,0,'blocked original recovery cannot continue');
  scene={...scene,foreground:false};operations.reconcileBookmarks(generation,presentation,false);
  assert.equal(calls.length,before,'feature owner independently rejects background recovery');scene={...scene,foreground:true};
  scene={...scene,reading:false};operations.reconcileBookmarks(generation,presentation,false);
  assert.equal(calls.length,before,'reader recovery requires an active retained session');scene={...scene,reading:true};
  scene={...scene,sessionGeneration:scene.sessionGeneration+1};operations.reconcileBookmarks(generation,presentation,false);
  assert.equal(calls.length,before,'old session presentation cannot query from a successor');scene={...scene,sessionGeneration:scene.sessionGeneration-1};
  owner.reconcileBookmarkRecovery(identity,false);await flush();
  assert.deepEqual(actions,[['query',generation,presentation]]);
  assert.equal(calls.filter(method=>method==='original-receipt-query').length,2,'reader notice reaches the original Host recovery query');
  release();await flush();
  assert.equal(directory.snapshot().projection.receipt.confirmation,'unknown');
  owner.bookmarkRecovery={...owner.bookmarkRecovery,canContinueBookmarks:true};
  owner.reconcileBookmarkRecovery(owner.bookmarkRecoveryIdentity(),true);
  assert.equal(actions.at(-1)[0],'continue','explicit original continuation keeps its separate callback');
 }
}
const source=readFileSync(hostUrl,'utf8'),shell=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderShell.ets',import.meta.url),'utf8');
assert.match(source,/ReaderRecoveryNotice\(\{ view: this\.bookmarkRecovery\.bookmarks/);
assert.match(source,/onReconcile:.*reconcileBookmarkRecovery\(identity, false\)/);
assert.match(source,/onSecondaryAction:.*reconcileBookmarkRecovery\(identity, true\)/);
assert.match(shell,/bookmarkRecovery: this\.directoryRecovery/);
assert.match(shell,/acceptsTextInput\(_identity\)\) this\.onReconcileBookmarks\(generation, presentationId\)/);

}
console.log(`PASS bookmark ${selectedCase}: actual selected production methods; not native acceptance`);
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
