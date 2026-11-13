import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'durable-recovery':{description:'Actual bookmark Index/DirectoryHost exact receipt and committed-write reload recovery via existing Core CLI',resources:[]},
 'host-retry':{description:'Actual bookmark Host/Gateway/Operations and reader list versus unknown-write recovery, input identity and retry without Native',resources:[]},
 'global-write-admission':{description:'Actual global AtomicIntent/Host/Gateway admission and first-page Journey/Entry projection with finite controlled RPC outcomes; no Core CLI or native execution',resources:[]},
 'recovery-surface-sdk':{description:'SDK-emitted reading recovery Scroll touch boundary and actual retry actors with current, busy and successor identities',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {default:assert}=await import('node:assert/strict');
const book={sourceId:'local',bookId:'book',title:'Book',author:'Author'};
const row=(bookmarks=[],title='Chapter',downloadState='completed')=>({index:0,title,downloadState,bookmarks});
const mark=time=>({time,chapterIndex:0,chapterOffset:12,chapterTitle:'Chapter',content:'saved'});
if(selectedCase==='global-write-admission'){
 const {writeFile}=await import('node:fs/promises');
 const {join}=await import('node:path');
 const {bookmarkFixture:platformFixture,deferred,until,cleanupDurableFixtures}=await import('./lib/reading-operation-durable-probe.mjs');
 const {createHash}=await import('node:crypto');
 const {actualReaderDirectoryJourney}=await import('./lib/reader-directory-operations-probe.mjs');
 const {actualReadingEntryPresentation}=await import('./lib/reading-entry-presentation-probe.mjs');
 const {compileHost,setRuntime}=await import('./lib/reading-entry-owner-probe.mjs');
 const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
 const {EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
 console.log(JSON.stringify({kind:'reader-controlled-rpc-proof',layer:'SDK-emitted actual owners and atomic file IO with finite RPC responses',coreCli:false,build:false,native:false}));
 function finiteTransport(){
  let binding=null,receipt=null,params,bookmarks=[],time=1;
  const calls=[];
  return {calls,async command(method,input){
   calls.push({method,params:structuredClone(input)});
   if(method==='bookmark.list')return {data:{bookmarks:bookmarks.filter(mark=>mark.bookName===input.bookName&&mark.bookAuthor===input.bookAuthor)}};
   if(method==='bookmark.create'){
    params=structuredClone(input);
    binding={operationId:input.operationId,sequence:input.sequence,
     payloadFingerprint:createHash('sha256').update(JSON.stringify(input)).digest('hex')};
    const bookmark={bookName:input.bookName,bookAuthor:input.bookAuthor,chapterIndex:input.chapterIndex,
     chapterPos:input.chapterPos,chapterName:input.chapterName,bookText:input.bookText,content:input.bookText,time:time++};
    bookmarks.push(bookmark);receipt={binding,phase:'committed',outcome:{action:'create',result:{bookmark}}};
    return {data:{bookmark}};
   }
   if(method==='bookmark.operation.query'){
    if(input.operationId!==undefined){
     if(receipt===null)return {data:{head:binding,receipt:null}};
     assert.equal(input.operationId,binding.operationId,'controlled exact query carries the original ID');
     assert.deepEqual(input.expected,{action:'create',params},'real intent owner supplies its frozen original DTO');
    }
    return {data:{head:binding,receipt:input.operationId===undefined?null:receipt}};
   }
   assert.equal(method,'bookmark.operation.settle','finite transport never performs unrelated RPC');
   assert.deepEqual(input,binding,'settlement uses the original qualified binding');
   receipt={...receipt,phase:'settled'};return {data:{binding,phase:'settled'}};
  }};
 }
 const fixtures=[];
 async function bookmarkFixture(official=true,existing){
  const transport=existing?.transport??finiteTransport();
  const f=await platformFixture(official,existing,transport.command.bind(transport));
  fixtures.push(f);return Object.assign(f,{transport});
 }
 function consumer(f, currentBook=book){
  const Entry=actualReadingEntryPresentation(),entry=new Entry();
  Object.assign(entry,{book:{...currentBook},toc:[row([])],sessionActive:true,sessionGeneration:1});
  const route={route:'reading',generation:1};
  const scope={owner:f.runtime,mount:1,retired:false,foreground:true,covered:false};
  const Journey=actualReaderDirectoryJourney({ReaderDirectoryHost:f.Directory,...f.types});
  const journey=new Journey({snapshot:()=>route},{scope:()=>scope,ownsRuntime:owner=>f.Runtime.isCurrent(owner),
   runtime:()=>undefined,entry:()=>entry,shelfBooks:()=>[],diagnostic:()=>{}});
  const operations=journey.operations;
  const recovery=()=>operations.recovery(entry.directoryOperation,entry.offlineOperation);
  const load=()=>operations.loadControlBookmarks(entry.book.sourceId,entry.book.bookId,()=>true);
  return {entry,route,scope,operations,recovery,load};
 }
 async function settled(f){await until(()=>!f.directory.busy());await new Promise(resolve=>setImmediate(resolve));}
 function create(c){c.operations.togglePageBookmark({chapterIndex:0,chapterOffset:12,
  chapterTitle:'Chapter',bookText:'saved',bookmarkTimes:[]});}
 function admission(f,c,expected,label){
  assert.equal(f.directory.bookmarkWriteEnabled(),expected,label+' Host');
  assert.equal(c.entry.bookmarkWriteEnabled,expected,label+' Observed Entry');
  assert.equal(c.recovery().bookmarkWriteEnabled,expected,label+' Recovery DTO');
 }
 function readerReady(f,currentBook){
  setRuntime(f.runtime);
  f.runtime.bookAcquisitions=()=>({setPreparationVisible(){},readingProjectionRevision:()=>0});
  const Host=compileHost(undefined,{ReaderDirectoryHost:f.Directory,...f.types}),host=Host.forRuntime(f.runtime);
  const diagnostics=[];
  const Entry=actualReadingEntryPresentation({ReadingEntryHost:Host,
   hilog:{warn:(...args)=>diagnostics.push(args)}}),entry=new Entry();
  Object.assign(entry,{book:{...currentBook},toc:[row([])],sessionActive:true});
  let live=true;
  const ports={current:()=>live,projectionVisible:()=>false,membership:()=>({generation:0,blocked:false,value:true}),
   cacheDecision:async()=>false,notice(){},refreshShelf(){}};
  entry.bindReader(f.runtime,ports);
  const frames=[],tasks=[],project=host.projectDirectory.bind(host);
  host.projectDirectory=scope=>{const task=project(scope);tasks.push(task);return task;};
  const ready=()=>entry.presentPreparedPage(0,false,()=>({runtime:()=>f.runtime,current:()=>live,afterOpening:action=>frames.push(action)}));
  return {host,entry,ports,frames,tasks,ready,diagnostics,retire(){live=false;entry.retire();}};
 }
 try {
  assert.equal(EMPTY_READING_DIRECTORY_RECOVERY.bookmarkWriteEnabled,false);
  {
   const f=await bookmarkFixture(),c=consumer(f);
   admission(f,c,false,'unread startup');
   await c.load();admission(f,c,true,'empty intent admits');
   const gateway=f.directory.dependencies.gateway,nativePending=gateway.pendingBookmarkOperation.bind(gateway);
   let pendingReads=0;gateway.pendingBookmarkOperation=async()=>{pendingReads++;return nativePending();};
   for(let i=0;i<3;i++){f.directory.bookmarkWriteEnabled();c.recovery();}
   assert.equal(pendingReads,0,'admission getters never read disk or RPC');
   const gate=deferred();f.options.pauseMethod='bookmark.create';f.options.pauseAfterDispatch=true;f.options.gate=gate;
   create(c);
   await until(()=>f.writes().length===1);admission(f,c,false,'accepted write busy');
   assert.equal(c.recovery().bookmarks.visible,false,'busy admission is independent from notice visibility');
   gate.resolve();await settled(f);admission(f,c,true,'qualified settle and cleanup reopens');
   assert.equal(f.writes().length,1);assert.equal(f.disk('bookmark'),'');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed');
   const nativeRequest=f.runtime.request.bind(f.runtime);
   f.runtime.request=async(method,params,options)=>{if(method==='bookmark.list')throw Error('canonical projection unavailable');return nativeRequest(method,params,options);};
   await assert.rejects(c.load(),/canonical projection unavailable/);
   admission(f,c,false,'stale projection blocks');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed','a read failure preserves the write receipt');
   f.runtime.request=nativeRequest;await c.load();admission(f,c,true,'fresh projection reopens');
   assert.equal(f.writes().length,1,'pure reload never repeats the write');
   c.entry.retire();assert.equal(c.entry.bookmarkWriteEnabled,false,'retired Entry clears projected admission');
  }
  {
   const f=await bookmarkFixture(),c=consumer(f),native=f.runtime.request.bind(f.runtime);
   await c.load();f.options.beforeMethod='bookmark.create';
   f.runtime.request=async(method,params,options)=>{
    if(method==='bookmark.operation.query'&&f.writes().length>0)throw Error('original exact query unavailable');
    return native(method,params,options);
   };
   create(c);await settled(f);
   admission(f,c,false,'same-book unknown write');
   assert.equal(c.recovery().bookmarksKind,'pending');
   const original=JSON.parse(f.disk('bookmark'));
   await c.load();admission(f,c,false,'matching list never settles original unknown');
   assert.equal(c.entry.toc[0].bookmarks.length,0);
   assert.deepEqual(JSON.parse(f.disk('bookmark')),original);
   c.entry.book={...book,bookId:'other',title:'Other'};c.route.generation++;
   await c.load();admission(f,c,false,'foreign pending after independent list read');
   assert.equal(c.recovery().bookmarks.visible,false,'foreign recovery notice stays hidden');
   assert.equal(c.recovery().bookmarksBusy,false,'foreign operation is not borrowed as current busy state');
   assert.equal(f.writes().length,1);
   const cold=await bookmarkFixture(true,{root:f.root,transport:f.transport}),b=consumer(cold,{...book,bookId:'other',title:'Other'});
   admission(cold,b,false,'cold B before any intent read');
   assert.equal(cold.directory.snapshot(),undefined,'cold B has no in-memory same-book receipt');
   await b.load();admission(cold,b,false,'cold B learns foreign durable pending');
   assert.equal(cold.directory.snapshot(),undefined);
   assert.equal(b.recovery().bookmarks.visible,false);
   assert.equal(b.entry.toc[0].bookmarks.length,0,'foreign pending permits the canonical B read');
   assert.equal(cold.calls.filter(call=>call.method==='bookmark.list').length,1);
   assert.equal(cold.calls.filter(call=>call.method==='bookmark.operation.query').length,0,'B never reconciles a foreign original');
   assert.equal(cold.writes().length,0);
   assert.deepEqual(JSON.parse(cold.disk('bookmark')),original);
   const initial=readerReady(cold,{...book,sourceId:'other-source',bookId:'reader-b',title:'Reader B'});
   assert.equal(initial.entry.bookmarkWriteEnabled,false,'known directory rows do not qualify unread initial admission');
   const before=cold.calls.length;initial.ready();
   assert.equal(initial.frames.length,1,'actual first-page ready schedules the existing deferred directory projection');
   assert.equal(cold.calls.length,before,'first-page scheduling performs no eager read');
   initial.frames.shift()();assert.equal(initial.tasks.length,1);await initial.tasks[0];
   assert.equal(initial.entry.bookmarkWriteEnabled,false,'first-page initial read observes foreign pending without requiring controls');
   assert.equal(cold.directory.snapshot(),undefined);
   assert.equal(initial.entry.toc[0].bookmarks.length,0);
   initial.ready();assert.equal(initial.frames.length,0,'same first-page presentation does not repeat blocked reads');
   assert.deepEqual(JSON.parse(cold.disk('bookmark')),original);
   const runtime={...cold.runtime};cold.install(runtime);
   const current=()=>cold.Runtime.isCurrent(runtime);
   const without=cold.Directory.forRuntime(runtime,current);
   const beforeInstall=without.dependencies.gateway;
   assert.equal(beforeInstall.bookmarkAuthorityAvailable(),false);
   let entries=[row([])];const enabled=[];
   const binding={book:b.entry.book,current,currentEntries:()=>entries,emitEntries:value=>entries=value,
    emitWriteAdmission:value=>enabled.push(value)};
   await without.load(binding);
   assert.equal(entries[0].bookmarks.length,0,'no-authority canonical read stays available');
   assert.equal(without.bookmarkWriteEnabled(),false,'optional missing authority never counts as known-clear intent');
   assert.ok(enabled.length>0&&enabled.every(value=>value===false));
   const installed=cold.Directory.forRuntime(runtime,current,undefined,new cold.types.BookmarkOperationIntentStore(runtime,current));
   assert.equal(installed,without,'retained Host receives the existing authority');
   assert.equal(beforeInstall.bookmarkAuthorityAvailable(),true);
   assert.equal(installed.bookmarkWriteEnabled(),false,'authority installation cannot reuse no-authority empty evidence');
   await installed.load(binding);
   assert.equal(installed.bookmarkWriteEnabled(),false,'installed authority reads foreign pending before granting');
   assert.ok(enabled.every(value=>value===false));
   assert.deepEqual(JSON.parse(cold.disk('bookmark')),original);
   const racingRuntime={...runtime};cold.install(racingRuntime);
   const racingCurrent=()=>cold.Runtime.isCurrent(racingRuntime);
   const racingHost=cold.Directory.forRuntime(racingRuntime,racingCurrent);
   const raced=[];
   const loading=racingHost.load({...binding,current:racingCurrent,emitWriteAdmission:value=>raced.push(value)});
   assert.equal(cold.Directory.forRuntime(racingRuntime,racingCurrent,undefined,
    new cold.types.BookmarkOperationIntentStore(racingRuntime,racingCurrent)),racingHost);
   await loading;
   assert.equal(racingHost.bookmarkWriteEnabled(),false,'authority arriving during an old no-authority read cannot qualify that result');
   assert.ok(raced.length>0&&raced.every(value=>value===false));
   await racingHost.load({...binding,current:racingCurrent});
   assert.equal(racingHost.bookmarkWriteEnabled(),false,'the new actual-authority read observes foreign pending');
  }
  {
   const f=await bookmarkFixture(),initial=readerReady(f,{...book,sourceId:'source',contentKind:'text'});
   assert.equal(initial.entry.bookmarkWriteEnabled,false);
   initial.ready();assert.equal(initial.frames.length,1);initial.frames.shift()();await initial.tasks[0];
   assert.equal(initial.entry.bookmarkWriteEnabled,true,'actual first-page read qualifies an empty global intent');
   const reads=f.calls.filter(call=>call.method==='bookmark.list').length;
   initial.entry.bindReader(f.runtime,initial.ports);
   assert.equal(initial.entry.bookmarkWriteEnabled,true,'retained known owner admission survives the new reader lease');
   initial.ready();assert.equal(initial.frames.length,0,'known retained rows and owner use no fallback read');
   assert.equal(f.calls.filter(call=>call.method==='bookmark.list').length,reads);
   initial.entry.bookmarkWriteEnabled=false;
   initial.entry.presentedScopeId=-1;initial.ready();assert.equal(initial.frames.length,1);
   initial.retire();initial.frames.shift()();assert.equal(initial.tasks.length,1,'old first-page callback cannot enter a successor scope');
   assert.equal(initial.entry.bookmarkWriteEnabled,false);
   initial.entry.bookmarkWriteEnabled=true;
   const replacement={...f.runtime};setRuntime(replacement);
   initial.entry.currentHost(replacement);
   assert.equal(initial.entry.bookmarkWriteEnabled,false,'a replacement Runtime cannot inherit an old Host admission');
  }
  {
   const f=await bookmarkFixture();
   const corrupt='{preserved-invalid-intent';
   await writeFile(join(f.files,'reader-bookmark-intent-v1.json'),corrupt);
   const initial=readerReady(f,{...book,sourceId:'source',contentKind:'text'}),toc=initial.entry.toc;
   const failures=[];const onUnhandled=error=>failures.push(error);
   process.on('unhandledRejection',onUnhandled);
   try {
    initial.ready();assert.equal(initial.frames.length,1);initial.frames.shift()();
    await assert.doesNotReject(initial.tasks[0],'already diagnosed first-page intent failure is contained');
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(failures,[]);
    assert.equal(initial.entry.bookmarkWriteEnabled,false);
    assert.equal(initial.entry.sessionActive,true,'bookmark projection failure keeps the readable session active');
    assert.equal(initial.entry.toc,toc,'initial failure never clears the existing directory');
    assert.equal(f.disk('bookmark'),corrupt,'corrupt original record is retained for recovery');
    assert.ok(initial.diagnostics.some(args=>args.includes('directory-bookmarks')),'existing diagnostic receives the exact read failure');
    const programmerError=Error('unhandled projection programming error');
    const nativeLoad=f.directory.load.bind(f.directory);f.directory.load=async()=>{throw programmerError;};
    await assert.rejects(initial.host.projectDirectory(initial.entry.scopeId),error=>error===programmerError,
     'a failure never reported by the existing read path remains rejected');
    f.directory.load=nativeLoad;
   } finally {process.off('unhandledRejection',onUnhandled);}
  }
  {
   const f=await bookmarkFixture(),corrupt='{preserved-retired-intent';
   await writeFile(join(f.files,'reader-bookmark-intent-v1.json'),corrupt);
   const initial=readerReady(f,{...book,sourceId:'source',contentKind:'text'}),toc=initial.entry.toc;
   const gateway=f.directory.dependencies.gateway,pending=gateway.pendingBookmarkOperation.bind(gateway),gate=deferred();
   let entered=false;
   gateway.pendingBookmarkOperation=async()=>{
    const outcome=pending().then(value=>({value}),error=>({error}));
    entered=true;await gate.promise;
    const result=await outcome;if(result.error!==undefined)throw result.error;return result.value;
   };
   const failures=[];const onUnhandled=error=>failures.push(error);process.on('unhandledRejection',onUnhandled);
   try {
    initial.ready();initial.frames.shift()();await until(()=>entered);
    initial.retire();gate.resolve();
    await assert.doesNotReject(initial.tasks[0],'entered initial read rejection retires with its stale lease');
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(failures,[]);
    assert.equal(initial.entry.bookmarkWriteEnabled,false);
    assert.equal(initial.entry.toc,toc,'stale read never replaces successor directory data');
    assert.equal(initial.diagnostics.length,0,'retired first-page read cannot publish to the old Entry');
    assert.equal(f.disk('bookmark'),corrupt,'retiring a read cannot clear the original intent');
   } finally {process.off('unhandledRejection',onUnhandled);}
  }
  {
   const f=await bookmarkFixture(),c=consumer(f);await c.load();
   f.options.loseFinishAt=f.io.finishes+3;
   create(c);await settled(f);
   admission(f,c,false,'confirmed write with cleanup ACK failure');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed');
   assert.equal((await f.bookmarkStore.pending()).phase,'confirmed','exact confirmed intent remains owned until cleanup ACK');
   f.options.loseFinishAt=f.io.finishes+2;
   await c.load();admission(f,c,false,'successful canonical read cannot bypass failed intent cleanup');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed');
   assert.equal(c.entry.directoryOperation.projection.receipt.readback,'succeeded');
   assert.equal(c.entry.directoryOperation.projection.facts.stale,false,'list freshness and global write admission are independent');
   f.options.loseFinishAt=undefined;
   await c.load();admission(f,c,true,'actual same-intent cleanup qualifies new writes');
   assert.equal(await f.bookmarkStore.pending(),undefined);assert.equal(f.writes().length,1);
  }
  {
   const f=await bookmarkFixture(),c=consumer(f);await c.load();
   f.options.transformMethod='bookmark.operation.query';
   f.options.transform=data=>data.receipt===null?data:{...data,receipt:{...data.receipt,
    binding:{...data.receipt.binding,sequence:data.receipt.binding.sequence+1}}};
   create(c);await settled(f);
   admission(f,c,false,'invalid exact receipt cannot qualify cleanup');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed','the original ACK remains confirmed');
   assert.match(c.entry.directoryOperation.projection.refreshError,/持久head与精确回执不符/);
   assert.notEqual(await f.bookmarkStore.pending(),undefined);
   assert.equal(f.calls.filter(call=>call.method==='bookmark.operation.settle').length,0,'invalid binding never reaches settlement');
   f.options.transformMethod=undefined;await c.load();admission(f,c,true,'actual qualifier accepts restored exact original receipt');
   assert.equal(f.writes().length,1,'receipt retry never allocates a replacement mutation');
  }
  {
   const f=await bookmarkFixture(),c=consumer(f);
   await writeFile(join(f.files,'reader-bookmark-intent-v1.json'),'{unreadable');
   await assert.rejects(c.load(),/原操作记录格式无效/);admission(f,c,false,'unreadable startup intent');
   assert.equal(f.directory.snapshot(),undefined,'unreadable file never invents a book operation');
   await writeFile(join(f.files,'reader-bookmark-intent-v1.json'),'');
   await c.load();admission(f,c,true,'real retry reads clear intent and fresh list');
   const gateway=f.directory.dependencies.gateway,nativePending=gateway.pendingBookmarkOperation.bind(gateway);
   gateway.pendingBookmarkOperation=async()=>{throw Error('post-write intent read unavailable');};
   create(c);await settled(f);
   admission(f,c,false,'post-write qualification read failure');
   assert.equal(c.entry.directoryOperation.projection.receipt.confirmation,'confirmed','qualification read cannot downgrade exact confirmed receipt');
   assert.equal(c.entry.directoryOperation.projection.receipt.readback,'succeeded');
   gateway.pendingBookmarkOperation=nativePending;await c.load();admission(f,c,true,'qualification retry');
  }
  {
   const f=await bookmarkFixture(),c=consumer(f);await c.load();
   const old=c.operations.bookmarkBinding(f.runtime,c.entry.book),gate=deferred();
   f.options.pauseMethod='bookmark.create';f.options.pauseAfterDispatch=true;f.options.gate=gate;
   create(c);
   await until(()=>f.writes().length===1);admission(f,c,false,'old owner active');
   c.entry.book={...book,bookId:'successor',title:'Successor'};c.route.generation++;
   c.entry.bookmarkWriteEnabled=false;
   assert.equal(old.current(),false,'actual Binding retires old navigation and book');
   gate.resolve();await settled(f);
   assert.equal(f.directory.bookmarkWriteEnabled(),true,'accepted original settles in Host');
   assert.equal(c.entry.bookmarkWriteEnabled,false,'old completion cannot enable successor Entry');
   assert.equal(c.recovery().bookmarkWriteEnabled,false,'successor keeps unqualified DTO');
   await c.load();admission(f,c,true,'successor own load qualifies admission');
   assert.equal(f.writes().length,1);
  }
  console.log(JSON.stringify({kind:'bookmark-admission-method-evidence',fixtures:fixtures.map((f,index)=>({index,
   methods:f.calls.map(call=>call.method).filter(Boolean),
   originalWrites:f.writes().map(call=>({method:call.method,operationId:call.params.operationId,sequence:call.params.sequence})),
   exactQueries:f.calls.filter(call=>call.method==='bookmark.operation.query'&&call.params.operationId!==undefined).map(call=>call.params.operationId),
   settlements:f.calls.filter(call=>call.method==='bookmark.operation.settle').map(call=>call.params)}))}));
 } finally {await cleanupDurableFixtures();}
 console.log('PASS global bookmark admission: 9 actual owner scenarios plus first-page and retained initial projection, cold/foreign/same/settled/cleanup/stale/busy/unreadable/old binding/invalid receipt and current/retired first-page rejection ownership');
}else if(selectedCase==='recovery-surface-sdk'){
 const {registerHooks}=await import('node:module');
 registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);
  throw error;
 }}});
 const {readFileSync}=await import('node:fs');
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
 const backdrop=await import('../entry/src/main/ets/features/reading/ui/ReaderControlBackdropTouch.ts');
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url),'utf8');
 const sdk=boundedSurfaceSdk(),calls=[],TouchType={Down:0,Up:1,Move:2,Cancel:3};
 const recoverySource=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryRecoverySurface.ets',import.meta.url),'utf8');
 sdk.hooks.childSources.ReaderDirectoryRecoverySurface=recoverySource;
 sdk.deps.ReaderDirectoryRecoverySurface=createReaderBuilderProbe(recoverySource,boundedMembers(recoverySource),
  {...sdk.deps,EMPTY_READING_DIRECTORY_RECOVERY},sdk.hooks).Component;
 let timeMs=1000,outsideDismissals=0;
 const owner=sdk.consumer(source,['readerRecoveryContent','readerRecoveryInputCurrent','hasReaderRecoveryContent','bookmarkRecoveryIdentity','reconcileBookmarkRecovery','onControlBackdropTouch'],
  {...backdrop,TouchType,EMPTY_READING_DIRECTORY_RECOVERY,readerMotionNowMs:()=>timeMs});
 const empty={visible:false,canRetry:false,generation:0,message:''};
 Object.assign(owner,{mounted:false,lifecycleToken:1,sourceId:book.sourceId,bookId:book.bookId,
  sourceSwitchPresentationVisible:false,readerRecoveryView:empty,readerSettingsRecovery:empty,
  ttsPreferencesRecovery:empty,ttsConfigurationRecovery:empty,replaceRecovery:empty,
  bookmarkRecovery:{presentationId:'opening-1',bookmarks:{visible:true,canRetry:true,generation:8,
   message:'原操作结果尚未确认，可核对同一原操作'},bookmarksBusy:false,canContinueBookmarks:true},
  viewportWidth:366,readerWindowMetricsRevision:0,controlLayout:()=>({topBarWidth:334}),
  readerRecoveryViewportHeight:()=>180,readerRecoveryTop:()=>100,
  readerRecoveryOverlayId:()=> 'recovery-test',
  isSessionActive:()=>true,isControlInputEnabled:()=>true,
  controlBackdropState:backdrop.createReaderControlBackdropTouchState(),controlBackdropGeometryReady:true,
  controlInputRevision:0,controlMotionVisible:()=>true,
  controlMotionSession:()=>({heldPointerId:-1,closeRevision:0}),
  controlBackdropRegions:[{x:16,y:40,width:334,height:54},{x:16,y:400,width:334,height:300}],
  hideControl:()=>outsideDismissals++,
  onReconcileBookmarks:(generation,presentation)=>calls.push(['query',generation,presentation]),
  onContinueBookmarks:(generation,presentation)=>calls.push(['continue',generation,presentation])});
 owner.mounted=true;
 owner.readerRecoveryContent();sdk.properties.flush();
 const scroll=[...owner.nodes.values()].find(node=>node.type==='Scroll');
 assert.ok(scroll.onTouch,'the actual recovery viewport owns its touch propagation');
 const touch=type=>{let stopped=false;const point={id:1,windowX:200,windowY:130};return {
  type,touches:[point],changedTouches:[point],stopPropagation(){stopped=true;},isStopped:()=>stopped};};
 // The old boundary lets these same native-shaped samples reach the actual
 // parent handler and its production outside-control policy.
 owner.onControlBackdropTouch(touch(TouchType.Down));timeMs+=40;
 owner.onControlBackdropTouch(touch(TouchType.Up));
 assert.equal(outsideDismissals,1,'uncaptured notice touch reaches the real parent dismissal request');
 outsideDismissals=0;owner.controlBackdropState=backdrop.createReaderControlBackdropTouchState();
 for(const type of [TouchType.Down,TouchType.Up]){
  timeMs+=40;const event=touch(type);scroll.onTouch(event);
  if(!event.isStopped())owner.onControlBackdropTouch(event);
  assert.equal(event.isStopped(),true);
 }
 assert.equal(outsideDismissals,0,'the recovery boundary prevents the actual parent dismissal request');
 assert.equal(owner.controlBackdropState.pointerId,-1,'the parent cannot acquire a notice pointer');
 const action=sdk.walk(owner).find(child=>child instanceof sdk.deps.ReaderRecoveryAction&&child.label==='重新载入核对书签');
 assert.ok(action);const physical=[...action.nodes.values()].find(node=>node.type==='Button'&&node.onClick);
 assert.equal(physical.enabled,true);assert.equal(physical.constraintSize.minHeight,44);
 assert.equal(scroll.opacity,0);assert.equal(scroll.enabled,false);
 assert.equal(scroll.accessibilityLevel,'no-hide-descendants');assert.equal(scroll.hitTestBehavior,'HitTestMode.None');
 physical.onClick();assert.deepEqual(calls,[],'hidden floating notice retained callback cannot dispatch under controls');
 owner.controlMotionVisible=()=>false;owner.replay();sdk.properties.flush();
 assert.equal(scroll.opacity,1);assert.equal(scroll.enabled,true);assert.equal(scroll.accessibilityLevel,'auto');
 assert.equal(scroll.onAreaChange,undefined,'floating notice does not feed a page geometry owner');
 assert.equal(scroll.onAppear,undefined);
 physical.onClick();assert.deepEqual(calls,[['query',8,'opening-1']],'touch boundary preserves the real retry callback');
 owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarksBusy:true};physical.onClick();
 assert.equal(calls.length,1,'a retained pre-busy actor cannot dispatch duplicate recovery');
 owner.bookmarkRecovery={...owner.bookmarkRecovery,bookmarksBusy:false,presentationId:'opening-2'};physical.onClick();
 assert.equal(calls.length,1,'a previous presentation cannot invoke a successor recovery');
 owner.bookmarkRecovery={...owner.bookmarkRecovery,presentationId:'opening-1',bookmarks:{...owner.bookmarkRecovery.bookmarks,generation:9}};physical.onClick();
 assert.equal(calls.length,1,'an old physical generation cannot invoke a successor operation');
 console.log('PASS actual SDK reading recovery touch boundary, retry actor, busy and successor guards');
}else if(selectedCase==='durable-recovery'){
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
assert.match(source,/ReaderRecoveryNotice\(\{[^\n]*view: this\.bookmarkRecovery\.bookmarks/);
assert.match(source,/onReconcile:.*reconcileBookmarkRecovery\(identity, false\)/);
assert.match(source,/onSecondaryAction:.*reconcileBookmarkRecovery\(identity, true\)/);
assert.match(shell,/bookmarkRecovery: this\.directoryRecovery/);
assert.match(shell,/acceptsTextInput\(_identity\)\) this\.onReconcileBookmarks\(generation, presentationId\)/);

}
console.log(`PASS bookmark ${selectedCase}: actual selected production methods; not native acceptance`);
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
