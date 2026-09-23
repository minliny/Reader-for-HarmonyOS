import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error;
} } });
const { remoteReadingFailureKindOf, RemoteReadingSourceError } = await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const { RemoteChapterCacheRefreshError } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { readerControlHostInputEnabled } = await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const mapSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts', import.meta.url), 'utf8')
  .replace('constructor(private readonly content: string) {', 'constructor(content: string) { this.content = content;');
const { ReadingSurfaceLayoutMap } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i=0;i<8;i++) await new Promise(resolve => setImmediate(resolve)); };
let acquire, gatewayOptions;
const requests = [], gateways = [], timers = new Map(); let nextTimer = 0;
const runtime = { readingEntryPreparations: () => ({ take: () => gatewayOptions.prepared, setPaused() {} }),
 bookAcquisitions: () => ({ acquireBookWithBackgroundRefresh(seed, options) {
  requests.push({seed, options}); return acquire(seed, options);
} }) };
class Gateway {
  constructor(sourceId, bookId, source, owner, transactionId) { Object.assign(this, { sourceId, bookId, source, owner, transactionId }); gateways.push(this); }
  async loadProgress() { return gatewayOptions.progress ?? { kind: 'missing' }; }
  supportsExactContentMetrics() { return false; }
  remoteSession() { return this.source.kind === 'remote' ? this.source.session : undefined; }
}
const OpenGateway = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts', import.meta.url), ['open'], { ReadingSessionFlowGateway: Gateway });
Gateway.open = OpenGateway.open;
const Reader = productionMotionMethods(source, ['ensureReadingSession','restartPreparedReadingEntry','activeGateway',
  'loadInitialReading','loadInitialChapter','openChapter','fail','retryReading','resetForChapterSelection',
  'isSessionActive','isMountedToken','isSelectionCurrent','isSelectionActive',
  'armFirstPageReadyDeadline','cancelFirstPageReadyDeadline','openReaderControl','isReaderPageInteractionEnabled',
  'isControlInputEnabled','loadContentMetricsIfNeeded','onRequestedChapterChanged','onRequestedBookmarkAnchorChanged'], {
  LOCAL_READING_SOURCE_ID:'local', ReaderRuntimeOwner:{current:()=>runtime}, ReadingSessionFlowGateway:Gateway,
  ReadingSurfaceLayoutMap, RemoteReadingSourceError, RemoteChapterCacheRefreshError, remoteReadingFailureKindOf,
  readerControlHostInputEnabled, stopReaderAutoPage:s=>s,
  cancelReaderRapidPageTurn:s=>s, openReaderControlSession:()=>({opened:true}),
  hilog:{error(){},info(){}}, FIRST_PAGE_READY_TIMEOUT_MS:45000,
  setTimeout(callback) { const id=++nextTimer;timers.set(id,callback);return id; }, clearTimeout:id=>timers.delete(id),
});
const session = (id='target') => ({ identity:{sourceId:id,bookId:'book'}, acquisitionMode:'online',
  book:{title:'书',author:'作者'}, entries:[{index:0,title:'第一章',url:'/one',variables:[]}],
  sourceVersion:'version',catalogVersion:'catalog',contextVersion:'context',continuationVariables:[],hostRequirements:['httpExecute'] });
const body = { sourceId:'target',bookId:'book',chapterIndex:0,chapterTitle:'第一章',content:'有真实内容的正文',images:[],contentVersion:'v1' };
function fixture(options={}) {
  requests.length=0;gateways.length=0;timers.clear();gatewayOptions=options;
  acquire=options.acquire ?? (async()=>({session:session()}));
  const published=[], failures=[], measured=[], events=[];
  const owner=Object.assign(new Reader(), {
    sourceId:options.local?'local':'target',bookId:'book',lifecycleToken:1,chapterSelectionToken:1,
    mounted:true,exitRequested:false,phase:'loading',remoteSession:options.session,
    remoteBookSeed:{sourceId:'target',bookId:'book',detailUrl:'/book',title:'书',author:'作者'},
    sourceSwitchTransactionId:options.transactionId, resolveSourceSwitchTransactionId:async()=>options.resolveTransaction?.(),
    measurementGeneration:0,continuousProgressRevision:0,measurementEpoch:0,
    measurementBatch:[],paragraphRanges:[],continuousImageResolutions:new Map(),chapterImageByStartScalar:new Map(),chapterImagePositionByKey:new Map(),
    visibleFragments:[],firstPageReadyDeadlineTimer:-1,firstPageReadyDeadlineGeneration:0,
    onRemoteSessionReady:value=>published.push(value), traceInitialReadingPhase(){},
    loadAppearanceSnapshot:async()=>{events.push('appearance');await options.layout;},
    loadReaderSettingsSnapshot:async()=>{events.push('settings');await options.layout;},
    loadInitialToc:async()=>({entries:options.entries??[{index:0,title:'第一章'}]}),
    admitTocEntries(entries){this.tocEntries=entries;},readingTocEntries(){return this.tocEntries;},onDirectoryProjectionChanged(){options.onDirectory?.();},
    chapterWindow:{configure(){},setCurrent(){}},normalizedRequestedChapter(){return this.requestedChapterIndex;},requireKnownChapter:value=>value??0,
    loadSessionChapter:async(index,current)=>{events.push('body');return options.loadBody?.(current,index)??{...body,chapterIndex:index};},
    ensureCurrentContentMetrics:async(_body,_map,current)=>{await options.metrics?.();return current();}, admitChapterContentVersion(){},retainCurrentChapterWindow(){},
    rebuildChapterImageIndexes(){},configureRestoredAnchor(){},hasMeasuredViewport:()=>true,
    beginMeasurement(){this.phase='measuring';measured.push(this.chapter);},notifyPreservedContentRefresh(){},
    finishPageTurnPerf(){},captureReadingRecordElapsed(keepRunning){assert.equal(keepRunning,false);events.push('record-paused');},
    clearReadingRecordTimer(){events.push('record-timer-cleared');},
    autoPageCoordinator:{ stop(){},cancelPendingTurn(){} },
    clearAutoPageTimer(){},clearAutoPageSessionTimer(){},cancelMeasurementDeadline(){},
    cancelFirstPageCompletionDeadline(){},cancelPageTurnPreparationRetry(){},resetPaginationDraft(){},
    invalidatePageTurnRuntime(){},clearContinuousRenderProjection(){},resetPendingPage(){},
    recoverControlSelectionFailure:()=>false,errorMessage:error=>error.message,
    onReadingFailure:(_source,_book,message,kind)=>failures.push({message,kind}),
    beginExit(){throw Error('recoverable entry must not exit');},
    appForeground:true,windowChromeActive:true,controlObscured:false,interactionBlocked:false,controlOpenRevision:0,
    controlVisible:()=>false,pageTurnOwnsReaderInput:()=>false,invalidateControlBackdrop(){},
    controlTiming:()=>({showDurationMs:0}),refreshReaderBrightness(){},
    clearTtsChapterEndTimer(){},positionContextForScope:()=>undefined,
    selectBookmarkAnchor(){assert.fail('a bookmark cannot use an uninitialized gateway');},
  });
  installReaderMeasurementOwner(owner);
  return {owner,published,failures,measured,events};
}

// A taken preparation may expire at any of these await/callback boundaries.
// Restart its gateway as well as progress, without ever publishing the old body.
for (const boundary of ['transaction', 'directory', 'metrics']) {
  let current=true;
  const pending=deferred();
  const prepared={sourceId:'target',bookId:'book',gateway:{remoteSession:()=>session()},
    toc:{bookId:'book',entries:[{index:0,title:'第一章'}]},progress:{kind:'missing'},
    chapter:{...body,content:'过期的准备正文'},isCurrent:()=>current};
  const f=fixture({prepared,
    resolveTransaction:boundary==='transaction'?()=>pending.promise:undefined,
    onDirectory:boundary==='directory'?()=>{current=false;}:undefined,
    metrics:boundary==='metrics'?()=>{current=false;}:undefined,
  });
  const loading=f.owner.loadInitialReading(1);await settle();
  if(boundary==='transaction'){current=false;pending.resolve(undefined);}
  await loading;
  assert.deepEqual(f.failures,[],boundary);
  assert.equal(f.measured.length,1,boundary);
  assert.equal(f.measured[0].content,body.content,`${boundary}: only fresh body may publish`);
  assert.equal(f.events.filter(e=>e==='body').length,1,`${boundary}: fallback body is read once`);
  assert.equal(gateways.length,2,`${boundary}: obsolete gateway is replaced`);
}

// Cold admission is inside the mounted reader and overlaps independent layout.
{
  const catalog=deferred(),layout=deferred();const f=fixture({acquire:()=>catalog.promise,layout:layout.promise});
  const operation=f.owner.loadInitialReading(1);await settle();
  assert.deepEqual(f.events,['appearance','settings']);assert.equal(requests.length,1);assert.equal(gateways.length,0);
  catalog.resolve({session:session()});await settle();assert.equal(f.published.length,1);assert.equal(gateways.length,1);
  assert.equal(f.events.at(-1),'body');assert.deepEqual(f.measured,[],'body may not publish before font/window layout');
  layout.resolve();await operation;assert.equal(f.measured.length,1);
}
// Existing source-switch session and local sessions never reacquire the catalog.
for(const local of [false,true]) {
  const known=session();const f=fixture({local,session:local?undefined:known,transactionId:'pending'});
  await f.owner.loadInitialReading(1);assert.equal(requests.length,0);assert.equal(gateways.length,1);
  assert.equal(gateways[0].transactionId,'pending');assert.equal(gateways[0].source.kind,local?'local':'remote');
  if(!local) assert.equal(gateways[0].source.session,known);
}
// Acquisition errors retain the reader, typed error, and settings access.
{
  const f=fixture({acquire:async()=>{throw new RemoteReadingSourceError('SOURCE_HTTP_FAILED','目标源超时');}});
  await f.owner.loadInitialReading(1);assert.equal(f.owner.phase,'failed');assert.equal(f.owner.mounted,true);
  assert.equal(f.owner.exitRequested,false);assert.equal(f.failures[0].kind,'SOURCE_HTTP_FAILED');
  assert.equal(f.owner.isReaderPageInteractionEnabled(),true);f.owner.openReaderControl();await settle();
  assert.ok(f.events.includes('record-paused') && f.events.includes('record-timer-cleared'),
    'retaining the error page must not count recovery time as reading');
  assert.equal(f.owner.controlSession.opened,true,'failed before session admission still opens settings without an unhandled metrics rejection');
  assert.equal(f.owner.sessionGateway,undefined);
}
// Exact source+book identities are checked before publishing metadata or creating a gateway.
for(const invalid of ['seed','result','existing']) {
  const f=fixture({session:invalid==='existing'?session('other'):undefined,acquire:async()=>({session:session('other')})});
  if(invalid==='seed')f.owner.remoteBookSeed={...f.owner.remoteBookSeed,bookId:'different'};
  await f.owner.loadInitialReading(1);assert.equal(f.owner.phase,'failed');assert.equal(f.published.length,0);assert.equal(gateways.length,0);
}
// A deadline invalidates both pre-catalog and post-catalog in-flight work.
for(const stage of ['catalog','body','layout']) {
  const pending=deferred();const f=fixture({acquire:stage==='catalog'?()=>pending.promise:undefined,
    loadBody:stage==='body'?()=>pending.promise:undefined,layout:stage==='layout'?pending.promise:undefined});
  f.owner.armFirstPageReadyDeadline(1,1);const deadline=[...timers.values()][0];
  const loading=f.owner.loadInitialReading(1);await settle();deadline();
  assert.equal(f.owner.phase,'failed');const publications=f.published.length;
  pending.resolve(stage==='catalog'?{session:session()}:stage==='body'?body:undefined);await loading;
  assert.equal(f.owner.phase,'failed',`${stage}: a late result cannot revive a timed-out reader`);
  assert.equal(f.published.length,publications);assert.equal(f.measured.length,0);assert.equal(f.failures.length,1);
}
// Retrying twice starts once; an abandoned catalog success/error cannot supersede the retry.
for(const oldReject of [false,true]) {
  const old=deferred(),fresh=deferred();let attempts=0;
  const f=fixture({acquire:()=>++attempts===1?old.promise:fresh.promise});
  const oldLoad=f.owner.loadInitialReading(1);await settle();f.owner.fail(Error('timeout'),1);
  f.owner.retryReading();f.owner.retryReading();await settle();assert.equal(attempts,2);
  if(oldReject)old.reject(Error('late error'));else old.resolve({session:session('obsolete')});
  await oldLoad;assert.equal(f.owner.phase,'loading');assert.equal(f.published.length,0);
  fresh.resolve({session:session()});await settle();assert.equal(f.published.length,1);assert.equal(f.measured.length,1);
  assert.equal(f.failures.length,1,'old failure is not re-published');
}
// Unmount prevents a pending acquisition from publishing back to the host.
{
  const gate=deferred(),f=fixture({acquire:()=>gate.promise});const loading=f.owner.loadInitialReading(1);
  await settle();f.owner.mounted=false;gate.resolve({session:session()});await loading;
  assert.equal(f.published.length,0);assert.equal(gateways.length,0);
}
// Recovered Core transaction identity is awaited before any gateway body/progress work.
for(const abandoned of [false,true]) {
  const gate=deferred(),f=fixture({session:session(),resolveTransaction:()=>gate.promise});
  const loading=f.owner.loadInitialReading(1);await settle();assert.equal(gateways.length,0);
  if(abandoned)f.owner.fail(Error('transaction lookup timeout'),1);
  gate.resolve('recovered-exact-transaction');await loading;
  assert.equal(gateways.length,abandoned?0:1);
  if(!abandoned)assert.equal(gateways[0].transactionId,'recovered-exact-transaction');
}
// A directory/bookmark selected before acquisition or pending-transaction lookup
// completes becomes the only admitted selection; old continuations cannot win.
for(const stage of ['catalog','transaction'])for(const kind of ['chapter','bookmark']) {
  const old=deferred(),fresh=deferred();let attempts=0;const requested=[];
  const f=fixture({session:stage==='transaction'?session():undefined,
    acquire:stage==='catalog'?()=>++attempts===1?old.promise:fresh.promise:undefined,
    resolveTransaction:stage==='transaction'?()=>++attempts===1?old.promise:fresh.promise:undefined,
    entries:[{index:0,title:'第一章'},{index:2,title:'第三章'}],
    loadBody:async(_current,index)=>{requested.push(index);return {...body,chapterIndex:index};}});
  const first=f.owner.loadInitialReading(1);await settle();
  if(kind==='chapter') {f.owner.requestedChapterIndex=2;f.owner.onRequestedChapterChanged();}
  else {f.owner.requestedBookmarkAnchor={requestId:8,chapterIndex:2,chapterOffset:0};f.owner.onRequestedBookmarkAnchorChanged();
    assert.equal(f.owner.consumedBookmarkAnchorRequestId,undefined,'do not consume a bookmark before its actual chapter admission');}
  await settle();assert.equal(attempts,2);assert.deepEqual(requested,[]);
  old.resolve(stage==='catalog'?{session:session()}:undefined);await first;assert.deepEqual(requested,[]);
  fresh.resolve(stage==='catalog'?{session:session()}:'pending-target');await settle();
  assert.deepEqual(requested,[2]);assert.equal(f.failures.length,0);assert.equal(f.measured.length,1);
  if(kind==='bookmark')assert.equal(f.owner.consumedBookmarkAnchorRequestId,8);
}

// SDK-transformed production Builder: render actual actions and invoke their captured callbacks.
for(const local of [false,true])for(const switchFailure of [false,true]) {
  const actions=[];
  const {owner}=createReaderBuilderProbe(readFileSync(source,'utf8'),['readingFailureContent'],{
    LOCAL_READING_SOURCE_ID:'local',readerAppearanceThemeStyle:()=>({ink:'#123456',paperStart:'#eeeeee'})});
  Object.assign(owner,{sourceId:local?'local':'remote',sourceSwitchFailureMessage:switchFailure?'目标源目录失败':'',
    failureCode:'当前正文失败',appearanceSnapshot:{activeTheme:'day'},
    readingLayout:()=>({bodyWidth:()=>300,bodyHeight:()=>600,contentLeft:16,contentTop:50}),
    retryReading:()=>actions.push('retry'),onRetryFailedSourceSwitch:()=>actions.push('switch-retry'),
    openReaderControl:()=>actions.push('settings'),onSwitchSource:()=>actions.push('switch'),onDismissSourceSwitchFailure:()=>actions.push('continue')});
  owner.readingFailureContent();const nodes=[...owner.nodes.values()];
  const buttons=nodes.filter(node=>node.type==='Button');const labels=buttons.map(node=>node.createWithLabel);
  assert.deepEqual(labels,['重试','阅读设置',...(switchFailure?['继续当前书源']:[]),...(local?[]:['切换书源'])]);
  for(const button of buttons)button.onClick();
  assert.deepEqual(actions,[switchFailure?'switch-retry':'retry','settings',...(switchFailure?['continue']:[]),...(local?[]:['switch'])]);
  const scroll=nodes.find(node=>node.type==='Scroll');assert.equal(scroll.width,300);assert.equal(scroll.height,600);
  assert.deepEqual(scroll.position,{x:16,y:50});
}
// Compile the unmodified production arena statement: failed-paper buttons sit
// below this retained node, so its actual child input prop must become inert.
{
  const raw=readFileSync(source,'utf8');
  const start=raw.indexOf('      ReaderPageInteractionLayer({');
  const end=raw.indexOf('      this.bookmarkCornerFeedback();',start);
  assert.ok(start>=0&&end>start);
  const wrapper=`@Component struct ArenaProbe { @Builder private arena() { ${raw.slice(start,end)} } build() { Column() {} } }`;
  const require=createRequire(import.meta.url);
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
  syntax.componentCollection.customComponents.add('ReaderPageInteractionLayer');
  const childSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets',import.meta.url),'utf8');
  syntax.propCollection.set('ReaderPageInteractionLayer',new Set([...childSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  for(const phase of ['loading','measuring','ready','failed'])for(const sourceError of ['', '目标目录失败']) {
    const {owner}=createReaderBuilderProbe(wrapper,['arena'],{ReaderPageInteractionLayer:Child});
    Object.assign(owner,{phase,sourceSwitchFailureMessage:sourceError,readerSettingsSnapshot:{navigationMode:'paged'},
      isReaderPageInteractionEnabled:()=>true,pageTurnTapOnlyInput:()=>false,readerTextSelectionEnabled:()=>false,
      readerSystemGestureLeftInset:()=>0,readerSystemGestureRightInset:()=>0,readerSystemGestureBottomInset:()=>0});
    owner.arena();const child=[...owner.children.values()][0];
    assert.equal(child.params.interactionEnabled,phase!=='failed'&&sourceError==='',
      'retained page touch arena cannot intercept retry/settings/source-error actions');
  }
}
// The real window methods may run after a source remount. A superseded reader
// still disposes its own resources, but cannot repaint the new owner's chrome.
{
  const calls=[];
  const WindowReader=productionMotionMethods(source,['applyWindowChrome','applyWindowPolicyForChromeOwner',
    'applyReaderWindowPolicy','isSessionActive','isMountedToken','aboutToDisappear'],{
    ReaderWindowCoordinator:{requestAppChrome:()=>calls.push('app-chrome'),requestReaderChrome:()=>calls.push('reader-chrome'),
      requestOverlayChrome:()=>calls.push('overlay-chrome'),requestAppWindowPolicy:async()=>{calls.push('app-policy');},
      requestReaderWindowPolicy:async()=>{calls.push('reader-policy');}},
    ReaderWindowChromeStyle:class{},readerAppearanceThemeStyle:()=>({paperStart:'#fff',ink:'#000'}),
    readerAppearanceChromeTone:()=> 'dark',AppStorage:{setOrCreate:()=>calls.push('global-top-info')},
    invalidateReaderAutoPageState:s=>s,
  });
  for(const current of [false,true])for(const chromeActive of [false,true]) {
    const owner=Object.assign(new WindowReader(),{isReaderIdentityCurrent:()=>current,
      windowChromeActive:chromeActive,windowChromeOverlayActive:false,appearanceSnapshot:{activeTheme:'day'},
      mounted:true,lifecycleToken:1,exitRequested:false,controlsPresentedForWindow:()=>false,
      syncVolumeKeyPolicy:()=>calls.push('volume-policy'),windowPolicyFor:()=>({}),readerSettingsSnapshot:{},
      bookTurnSession:{setEventListener:()=>calls.push('dispose-turn')},chapterWindow:{clear:()=>calls.push('dispose-window')},
      quickSearchPublication:{cancel(){}},autoPageCoordinator:{dispose(){}},
      screenAwakeLease:{dispose:()=>calls.push('dispose-screen')},readingSystemEventHost:{dispose:()=>calls.push('dispose-events')},
      onExitRequestHandler:()=>calls.push('unregister'),});
    for(const name of ['finishSessionCapsuleMorph','invalidatePageTurnRuntime','clearDeferredPageTurnWork',
      'restoreInitialWindowBrightness','onControlInputBoundaryChanged','invalidateReplaceMutationOwner','cancelPendingAutoPageStart',
      'clearAutoPageTimer','clearAutoPageSessionTimer','clearPageChromeStatusTimer','clearReadingRecordTimer','releaseAllReadingImages',
      'resetPaginationDraft','cancelMeasurementDeadline','cancelFirstPageReadyDeadline','cancelFirstPageCompletionDeadline',
      'cancelPageTurnPreparationRetry'])owner[name]=()=>{};
    calls.length=0;assert.equal(owner.isSessionActive(1),current);
    owner.applyWindowChrome();assert.deepEqual(calls,current?[chromeActive?'reader-chrome':'app-chrome']:[]);
    calls.length=0;await owner.applyReaderWindowPolicy({});assert.deepEqual(calls,current?['reader-policy']:[]);
    calls.length=0;owner.applyWindowPolicyForChromeOwner();await settle();
    assert.deepEqual(calls,current?['volume-policy','global-top-info',chromeActive?'reader-policy':'app-policy']:[]);
    calls.length=0;owner.aboutToDisappear();await settle();
    assert.equal(owner.mounted,false);assert.equal(owner.lifecycleToken,2);
    assert.ok(calls.includes('dispose-turn')&&calls.includes('dispose-window')&&calls.includes('dispose-screen')&&calls.includes('dispose-events'));
    assert.deepEqual(calls.filter(value=>value==='app-chrome'||value==='app-policy'),
      current?[...(chromeActive?['app-chrome']:[]),'app-policy']:[],
      'an obsolete disappearing reader cannot restore the application bars over the new reader');
  }
}
// Compile the exact retained ForEach from ReaderShell. Callbacks captured by
// an old child must not unregister or publish chapter/catalog state for a new one.
{
  const shellPath=new URL('../entry/src/main/ets/features/shell/ReaderShell.ets',import.meta.url);
  const raw=readFileSync(shellPath,'utf8');
  const start=raw.indexOf('        ForEach([this.readingIdentityKey()]');
  const tail='        }, (identity: string): string => identity);';
  const end=raw.indexOf(tail,start)+tail.length;assert.ok(start>=0&&end>start);
  const wrapper=`@Component struct SourceOwnerProbe { @Builder private readingOwner() { ${raw.slice(start,end)} } build() { Column() {} } }`;
  const require=createRequire(import.meta.url);
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);syntax.componentCollection.customComponents.add('ReadingExperience');
  syntax.propCollection.set('ReadingExperience',new Set([...readFileSync(source,'utf8').matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
  class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const {owner}=createReaderBuilderProbe(wrapper,['readingOwner'],{ReadingExperience:Child});
  const Shell=productionMotionMethods(shellPath,['readingIdentityKey']);
  const calls=[];let bookmarkGuard;
  Object.assign(owner,{sourceId:'source-A',bookId:'book',route:'reading',visible:true,
    readingIdentityKey:Shell.prototype.readingIdentityKey,
    resolveSourceSwitchTransactionId:async()=>{calls.push('resolve');return 'transaction';},
    onLoadControlBookmarks:async(_source,_book,guard)=>{calls.push('bookmarks');bookmarkGuard=guard;}});
  const callbacks=['onExitRequestHandler','onExit','onExitCancelled','onReadingReady','onReadingCommitted','onReadingFailure',
    'onChapterCommitted','onDirectoryProjectionChanged','onRemoteSessionReady','onRetryFailedSourceSwitch',
    'onDismissSourceSwitchFailure','onOpenDirectory','onOpenBookInfo','onSwitchSource','onOpenRulesManagement',
    'onDownloadChapter','onDownloadBook','onDeleteBookmarks','onCreateChapterStartBookmark','onTogglePageBookmark'];
  for(const name of callbacks)owner[name]=()=>calls.push(name);
  owner.readingOwner();const old=[...owner.children.values()][0].params;
  assert.equal(old.isReaderIdentityCurrent(),true);
  for(const name of callbacks)old[name](()=>{});
  assert.deepEqual(calls,callbacks);calls.length=0;
  await old.onLoadControlBookmarks('source-A','book',()=>true);assert.equal(bookmarkGuard(),true);
  assert.equal(await old.resolveSourceSwitchTransactionId('source-A','book'),'transaction');calls.length=0;
  owner.sourceId='source-B';assert.equal(old.isReaderIdentityCurrent(),false);assert.equal(bookmarkGuard(),false);
  for(const name of callbacks)old[name](()=>{});
  await old.onLoadControlBookmarks('source-A','book',()=>true);
  assert.equal(await old.resolveSourceSwitchTransactionId('source-A','book'),undefined);
  assert.deepEqual(calls,[],'old unregister/ready/directory and all side effects are rejected');
  owner.readingOwner();const current=[...owner.children.values()].at(-1).params;
  assert.equal(current.isReaderIdentityCurrent(),true);current.onExitRequestHandler(()=>{});current.onReadingReady(2);
  current.onDirectoryProjectionChanged([{index:2,title:'新目录'}]);
  assert.deepEqual(calls,['onExitRequestHandler','onReadingReady','onDirectoryProjectionChanged']);
}
console.log('PH116 actual reader admission, retained errors, retry generations, late-reply rejection, controls, SDK error actions and source/window ownership PASS');
