import { readingFailureHint } from '../entry/src/main/ets/features/reading/ReadingFailurePresentation.ts';
import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import { installReaderMeasurementOwner } from './lib/reader-measurement-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { readerAppearanceThemeStyle, readerAppearanceChromeTone } from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import { readerVisualSafeTop, readerInteractiveSafeLeft, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { createReaderRapidPageTurnState, cancelReaderRapidPageTurn } from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import * as controlSelection from '../entry/src/main/ets/features/reading/ReaderControlSelectionTransaction.ts';
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
 captureReadingContentValidity: () => () => true, waitForReadingContentIdle: async () => {},
 bookAcquisitions: () => ({ acquireBookWithBackgroundRefresh(seed, options) {
  requests.push({seed, options}); return acquire(seed, options);
} }) };
class Gateway {
  constructor(sourceId, bookId, source, owner, transactionId) { Object.assign(this, { sourceId, bookId, source, owner, transactionId }); gateways.push(this); }
  async loadProgress() { return gatewayOptions.progress ?? { kind: 'missing' }; }
  supportsExactContentMetrics() { return false; }
  hasPendingSourceSwitch() { return this.transactionId !== undefined; }
  remoteSession() { return this.source.kind === 'remote' ? this.source.session : undefined; }
}
const OpenGateway = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts', import.meta.url), ['open'], { ReadingSessionFlowGateway: Gateway });
Gateway.open = OpenGateway.open;
const Reader = productionMotionMethods(source, ['ensureReadingSession','restartPreparedReadingEntry','activeGateway',
  'loadInitialReading','loadInitialChapter','openChapter','fail','retryReading','resetForChapterSelection',
  'isSessionActive','isMountedToken','isSelectionCurrent','isSelectionActive',
  'armFirstPageReadyDeadline','cancelFirstPageReadyDeadline','openReaderControl','isReaderPageInteractionEnabled',
  'isControlInputEnabled','loadContentMetricsIfNeeded','onRequestedChapterChanged','onRequestedBookmarkAnchorChanged',
  'controlSelectionOwner'], {
  LOCAL_READING_SOURCE_ID:'local', ReaderRuntimeOwner:{current:()=>runtime}, ReadingSessionFlowGateway:Gateway,
  ReadingSurfaceLayoutMap, RemoteReadingSourceError, RemoteChapterCacheRefreshError, remoteReadingFailureKindOf,
  readerControlHostInputEnabled, stopReaderAutoPage:s=>s,
  readerControlSelectionOwnsReading:controlSelection.readerControlSelectionOwnsReading,
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
    controlShellExitArmed:()=>false,
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
    failureCode:'private raw error /path?token=secret',failureHint:readingFailureHint('private raw error /path?token=secret'),appearanceSnapshot:{activeTheme:'day'},
    readingLayout:()=>({bodyWidth:()=>300,bodyHeight:()=>600,contentLeft:16,contentTop:50}),
    retryReading:()=>actions.push('retry'),onRetryFailedSourceSwitch:()=>actions.push('switch-retry'),
    openReaderControl:()=>actions.push('settings'),onSwitchSource:()=>actions.push('switch'),onDismissSourceSwitchFailure:()=>actions.push('continue')});
  owner.readingFailureContent();const nodes=[...owner.nodes.values()];
  assert.equal(JSON.stringify(nodes.filter(node=>node.type==='Text')).includes('token=secret'),false,'actual failure Builder never renders raw diagnostics');
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
  const sdk=resolveEtsLoaderRoot();
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
      mounted:true,lifecycleToken:1,exitRequested:false,readingRecordHost:{retire(){}},controlsPresentedForWindow:()=>false,
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
    calls.length=0;await owner.applyReaderWindowPolicy({});assert.deepEqual(calls,current&&chromeActive?['reader-policy']:[]);
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
  const sdk=resolveEtsLoaderRoot();
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
  const deliveries=[];
  // The parent callback remains the same function while a retained Shell
  // moves across books and across entries of the same book.
  owner.onReadingReady=(...args)=>deliveries.push(args);
  owner.readingReadyGeneration=8;
  current.onReadingReady(3);
  assert.deepEqual(deliveries,[], 'old generation cannot report ready for a new entry');
  owner.readingOwner();const reopened=[...owner.children.values()].at(-1).params;
  reopened.onReadingReady(3);
  assert.deepEqual(deliveries,[[3,'source-B','book',8]]);
  owner.bookId='next-book';owner.readingReadyGeneration=9;
  reopened.onReadingReady(0);
  assert.equal(deliveries.length,1);
  owner.readingOwner();[...owner.children.values()].at(-1).params.onReadingReady(0);
  assert.deepEqual(deliveries.at(-1),[0,'source-B','next-book',9]);

}
// Chapter navigation feedback is the actual SDK-emitted production loading
// host/component. Native rasterization and asynchronous IO stay explicit seams.
{
  const raw=readFileSync(source,'utf8'),require=createRequire(import.meta.url);
  const sdk=resolveEtsLoaderRoot();
  const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const tree=ts.createSourceFile(virtualFilePath('RecoverableLoading.ets'),raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const reader=tree.statements.find(node=>node.name?.text==='ReadingExperience');
  const selected=['chapterLoadingContent','shouldShowChapterLoading','loadingChapterTitle',
    'shouldShowSourceSwitchPreparation','beginExit','isSessionActive','isMountedToken','loadingChapterIndex'];
  const members=selected.map(name=>{const node=reader.members.find(member=>member.name?.getText(tree)===name);
    assert.ok(node,`real loading member ${name}`);return node.getText(tree);});
  const call='      this.chapterLoadingContent();';
  assert.equal(raw.split(call).length-1,1,'the reader build owns one loading layer');
  assert.match(raw,/this\.readerStatusBarUnderlay\(\);\s*this\.chapterLoadingContent\(\);\s*if \(this\.phase === 'failed'/,
    'the production loading layer is below the native-status underlay and preserves the failure branch');
  const scene='@Component struct ReadingExperience {\n'+members.join('\n')+'\nbuild(){Stack(){'+call+'}}\n}';
  const loadingSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderChapterLoadingState.ets',import.meta.url),'utf8');
  const paperSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderPaperBackground.ets',import.meta.url),'utf8');
  const metrics={systemInsets:new ReaderInsetsVp(22,0,0,0),cutoutInsets:new ReaderInsetsVp(30,7,0,0),
    gestureInsets:new ReaderInsetsVp(),navigationInsets:new ReaderInsetsVp(),keyboardInsets:new ReaderInsetsVp()};
  function loadingFixture(fields={},definition=scene) {
    const controls=iconButtonControls();
    const enums=Object.fromEntries(['GradientDirection','ImageFit','ImageInterpolation','ImageRepeat'].map(name=>
      [name,new Proxy({},{get:(_target,key)=>`${name}.${key}`})]));
    const deps={...controls.dependencies,readerAppearanceThemeStyle,readerAppearanceChromeTone,
      readerVisualSafeTop,readerInteractiveSafeLeft,cancelReaderRapidPageTurn,...enums};
    const hooks={...controls.hooks,childSources:{...controls.hooks.childSources,
      ReaderPaperBackground:paperSource,ReaderChapterLoadingState:loadingSource}};
    const Paper=createReaderBuilderProbe(paperSource,boundedMembers(paperSource),deps,hooks).Component;
    const Loading=createReaderBuilderProbe(loadingSource,boundedMembers(loadingSource),
      {...deps,ReaderPaperBackground:Paper},hooks).Component;
    const {owner}=createReaderBuilderProbe(definition,['build',...selected],
      {...deps,ReaderPaperBackground:Paper,ReaderChapterLoadingState:Loading},hooks);
    const exit=[];
    Object.assign(owner,{mounted:true,lifecycleToken:1,chapterSelectionToken:1,exitRequested:false,exitAttemptGeneration:0,
      windowChromeActive:true,phase:'loading',sourceSwitchFailureMessage:'',appForeground:true,reduceMotion:false,
      appearanceSnapshot:{activeTheme:'day'},isTablet:false,visibleFragments:[],readerWindowMetricsRevision:1,
      requestedChapterIndex:324,readingTocEntries:()=>[{index:2,title:'第三章'},{index:324,title:'第325章 目标章节'}],
      readerStatusBarMetrics:()=>metrics,isReaderIdentityCurrent:()=>true,controlVisible:()=>false,
      rapidPageTurnState:createReaderRapidPageTurnState(),pageTurnInputPhase:()=> 'idle',
      autoPageCoordinator:{cancelPendingTurn(){},dispose(){}},stopReaderTtsAudition(){},
      captureReadingRecordElapsed(){},finishSessionCapsuleMorph(){},clearReadingRecordTimer(){},
      clearAutoPageTimer(){},clearAutoPageSessionTimer(){},cancelFirstPageReadyDeadline(){},
      finishExit:async token=>exit.push(token),...fields});
    owner.initialRender();controls.properties.flush();
    const walk=value=>[value,...[...(value.children?.values()??[])].flatMap(walk)];
    const loading=()=>walk(owner).filter(child=>child instanceof Loading);
    const nodes=()=>walk(owner).flatMap(child=>[...(child.nodes?.values()??[])]);
    return{owner,loading,nodes,exit,controls};
  }
  for(const theme of ['day','night'])for(const active of [false,true])for(const reduced of [false,true]) {
    const f=loadingFixture({appearanceSnapshot:{activeTheme:theme},appForeground:active,reduceMotion:reduced,isTablet:theme==='night'});
    assert.equal(f.loading().length,1);const layer=f.loading()[0],nodes=f.nodes();
    const spinner=nodes.filter(node=>node.type==='LoadingProgress');assert.equal(spinner.length,1);
    assert.deepEqual([spinner[0].width,spinner[0].height,spinner[0].color,spinner[0].enableLoading],
      [32,32,readerAppearanceThemeStyle(theme).ink,active&&!reduced],'real native spinner owns the pending chapter feedback');
    assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='第325章 目标章节'));
    assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='正在加载章节…'));
    assert.ok([...layer.nodes.values()].some(node=>node.backgroundColor===readerAppearanceThemeStyle(theme).paperStart&&
      node.hitTestBehavior==='HitTestMode.Block'),'the loading state paints opaque paper and owns input');
    const back=nodes.find(node=>node.accessibilityText==='取消加载并返回');assert.ok(back?.onClick);
    const position=[...layer.nodes.values()].find(node=>node.type==='__Common__'&&node.position);
    assert.deepEqual(position.position,{x:readerInteractiveSafeLeft(metrics)+12,y:readerVisualSafeTop(metrics)+8});
    back.onClick();assert.equal(f.owner.exitRequested,true);assert.deepEqual(f.exit,[1],
      'the native icon invokes the real beginExit rather than a label-only back seam');
  }
  const cases=[
    [{phase:'failed'},false,'failed retains its actionable failure content'],
    [{sourceSwitchFailureMessage:'换源失败'},false,'source error retains recovery'],
    [{sourceSwitchTransactionId:'pending'},false,'source-switch preparation has priority'],
    [{sessionGateway:{hasPendingSourceSwitch:()=>true}},false,'admitted gateway source-switch preparation has priority'],
    [{pendingControlSelection:{targetChapterIndex:324,closeOnCommit:false},controlVisible:()=>true},false,'slider preview keeps controls visible'],
    [{phase:'ready',visiblePage:{startScalar:0},visiblePageSelectionToken:0},true,'an old chapter token cannot masquerade as the selected body'],
    [{phase:'measuring',visiblePage:{startScalar:0},visiblePageSelectionToken:1},false,'current page reflow or neighbour measurement retains its visible body'],
    [{phase:'ready',visiblePage:{startScalar:0},visiblePageSelectionToken:1},false,'the current ready page needs no loading wash'],
    [{windowChromeActive:false},false,'a retained inactive reader owns no loading surface'],
  ];
  for(const [fields,expected,description] of cases) assert.equal(loadingFixture(fields).loading().length,expected?1:0,description);
  assert.ok(loadingFixture({requestedChapterIndex:2,loadingChapterIndex:324}).nodes().some(node=>node.type==='Text'&&node.create==='第325章 目标章节'),
    'the pending load target outranks the old requested chapter');
  assert.ok(loadingFixture({loadingChapterIndex:2,pendingControlSelection:{targetChapterIndex:324,closeOnCommit:true}}).nodes()
    .some(node=>node.type==='Text'&&node.create==='第325章 目标章节'),'a controller target is the displayed destination');

  // Reuse the actual cold entry/loading methods with deferred chapter IO. The
  // captured SDK callback uses production beginExit; its flag cancels the late
  // body before publication or measurement without waiting for acquisition.
  const pending=deferred(),cold=fixture({session:session(),entries:[{index:324,title:'第325章 目标章节'}],loadBody:()=>pending.promise});
  const f=loadingFixture();
  for(const name of Object.getOwnPropertyNames(Reader.prototype)) {
    const method=Object.getOwnPropertyDescriptor(Reader.prototype,name)?.value;
    if(name!=='constructor'&&typeof method==='function'&&!(name in f.owner))f.owner[name]=method;
  }
  const sdkBeginExit=f.owner.beginExit;Object.assign(f.owner,cold.owner);f.owner.beginExit=sdkBeginExit;
  f.owner.requestedChapterIndex=324;f.owner.readingTocEntries=()=>f.owner.tocEntries??[{index:324,title:'第325章 目标章节'}];
  f.owner.pageTurnInputPhase=()=> 'idle';f.owner.exitAttemptGeneration=0;f.owner.rapidPageTurnState=createReaderRapidPageTurnState();
  f.owner.autoPageCoordinator={cancelPendingTurn(){},dispose(){}};f.owner.stopReaderTtsAudition=()=>{};
  f.owner.finishSessionCapsuleMorph=()=>{};f.owner.finishExit=async token=>f.exit.push(token);
  const operation=f.owner.loadInitialReading(1);await settle();assert.ok(cold.events.includes('body'));
  assert.deepEqual(cold.measured,[]);assert.equal(f.owner.shouldShowChapterLoading(),true);
  const back=f.nodes().find(node=>node.accessibilityText==='取消加载并返回');back.onClick();
  assert.equal(f.owner.exitRequested,true);assert.deepEqual(f.exit,[1]);
  pending.resolve({...body,chapterIndex:324,chapterTitle:'第325章 目标章节'});await operation;
  assert.equal(f.owner.chapter,undefined,'a deferred body cannot revive the reader after loading back');
  assert.deepEqual(cold.measured,[]);assert.deepEqual(cold.failures,[]);

  // A failed position reconciliation has no remaining load task. Its actual
  // error-page retry must keep the original destination and selection options.
  const deferredType=tree.statements.find(node=>node.name?.text==='ReaderDeferredChapterSelection');
  assert.ok(deferredType);
  const ReaderDeferredChapterSelection=new Function(stripTypeScriptTypes(deferredType.getText(tree))+
    ';return ReaderDeferredChapterSelection;')();
  const Recovery=productionMotionMethods(source,['reconcileFailedControlSelection','selectionDisplayAnchor',
    'recoverRefreshedChapterDisplay','controlSelectionOwner','retryReading'],
    {...controlSelection,ReaderDeferredChapterSelection});
  for(const stored of [undefined,{bookId:'book',chapterIndex:2,chapterOffset:0,chapterProgress:0,updatedAt:1}]) {
    const selected=[],notices=[],target=324;
    const positionContext={bodyVersion:'body-325',processingVersion:'processing',anchors:[{id:'requested',offset:17}]};
    const ticket={sourceId:'target',bookId:'book',lifecycleToken:1,selectionToken:3,controlOpenRevision:6,
      targetChapterIndex:target,closeOnCommit:true};
    const r=Object.assign(new Recovery(),{sourceId:'target',bookId:'book',lifecycleToken:1,chapterSelectionToken:3,
      mounted:true,exitRequested:false,phase:'loading',controlOpenRevision:6,controlVisible:()=>true,controlShellExitArmed:()=>false,
      pendingControlSelection:ticket,pendingControlSelectionOrigin:undefined,pendingControlSelectionCandidate:undefined,
      pendingControlSelectionRetry:new ReaderDeferredChapterSelection(target,17,false,true,.32,6,true,false,positionContext),
      activeGateway:()=>({runProgressCommitSerial:async work=>work(),loadProgress:async()=>stored===undefined?{kind:'missing'}:{kind:'restored',progress:stored}}),
      showControlSelectionFailure:(...args)=>notices.push(args),selectChapterAnchor:(...args)=>selected.push(args),
      loadInitialReading(){assert.fail('selection retry must not return to ordinary entry resume');},
    });
    await r.reconcileFailedControlSelection(ticket,Error('章节加载失败'));
    assert.equal(r.phase,'failed');assert.equal(notices.length,1);
    assert.equal(loadingFixture({phase:r.phase,pendingControlSelection:ticket}).loading().length,0,
      'unresolved reconciliation exposes recovery rather than an indefinite spinner');
    const failure=createReaderBuilderProbe(raw,['readingFailureContent'],{LOCAL_READING_SOURCE_ID:'local',readerAppearanceThemeStyle}).owner;
    Object.assign(failure,{sourceId:'target',sourceSwitchFailureMessage:'',failureCode:'章节加载失败',appearanceSnapshot:{activeTheme:'day'},
      readingLayout:()=>({bodyWidth:()=>300,bodyHeight:()=>600,contentLeft:16,contentTop:30}),
      retryReading:()=>r.retryReading(),openReaderControl(){},onSwitchSource(){}});
    failure.readingFailureContent();
    const retry=[...failure.nodes.values()].find(node=>node.type==='Button'&&node.createWithLabel==='重试');
    assert.ok(retry?.onClick);retry.onClick();
    assert.deepEqual(selected,[[target,17,false,true,.32,6,true,false,positionContext,undefined]],
      'the actual error-page retry preserves chapter325, offset, context and close-on-commit request');
    assert.equal(r.chapterSelectionToken,3,'the new selection transaction alone owns token advancement');
  }
  const omitted=scene.replace(call,'');assert.notEqual(omitted,scene);
  assert.throws(()=>assert.equal(loadingFixture({},omitted).loading().length,1,'cold navigation must paint loading'),
    /cold navigation must paint loading/,'the previous missing production call fails the same SDK composition');
  const wrongMeasuring=scene.replace('!(this.visiblePage !== undefined && this.visiblePageSelectionToken === this.chapterSelectionToken)',
    "!(this.phase === 'ready' && this.visiblePage !== undefined && this.visiblePageSelectionToken === this.chapterSelectionToken)");
  assert.notEqual(wrongMeasuring,scene);
  assert.throws(()=>assert.equal(loadingFixture({phase:'measuring',visiblePage:{},visiblePageSelectionToken:1},wrongMeasuring).loading().length,0,
    'current-page measurement must not be covered'),/current-page measurement must not be covered/);
  console.log('PASS chapter loading: real SDK spinner/title/paper/back across 8 appearance/activity cases, 9 visibility/priority cases, cold deferred chapter325 cancellation, 2 unresolved exact-target retries and two counterfactuals; native pixels remain separate evidence');
}
console.log('PH116 actual reader admission, retained errors, retry generations, late-reply rejection, controls, SDK error actions and source/window ownership PASS');
