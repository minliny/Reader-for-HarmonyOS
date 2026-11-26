import { readReaderExperienceFixture } from './lib/reader-experience-fixture-source.mjs';
import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks, stripTypeScriptTypes }=await import('node:module');
const {readFileSync}=await import('node:fs');
const { fileURLToPath }=await import('node:url');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const { compileHost, ReaderDirectoryHost }=await import('./lib/reading-entry-owner-probe.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
// The shared production map uses a TypeScript constructor parameter property;
// expand that one syntax node for Node's strip-only loader, preserving methods.
const mapSource=readReaderExperienceFixture(new URL('../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts',import.meta.url),'utf8')
  .replace('constructor(private readonly content: string) {','constructor(content: string) { this.content = content;');
const {ReadingSurfaceLayoutMap}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts');
const file=fileURLToPath(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url));
const anchorSource=readReaderExperienceFixture(file,'utf8').match(/class CoreReadingAnchor[\s\S]*?\n}/)[0];
const CoreReadingAnchor=new Function(`${stripTypeScriptTypes(anchorSource)}; return CoreReadingAnchor;`)();
let captureContentEpoch=()=>()=>true;
let waitContentIdle=async()=>{};
const Reader=productionMotionMethods(file,['openChapter','loadSessionChapter','configureRestoredAnchor','lastVisibleScalar',
  'positionContextForScope','selectBookmarkAnchor','commitTtsProgress','progressProducerIntent','ttsChapterRef','notifyPreservedContentRefresh','reloadBookmarksAfterContentRefresh','requestCachedChapterRefresh','reconcileReaderRecovery'],{ReadingSurfaceLayoutMap,CoreReadingAnchor,RemoteChapterCacheRefreshError,LOCAL_READING_SOURCE_ID:'local',
  ReaderRuntimeOwner:{current:()=>({captureReadingContentValidity:(...args)=>captureContentEpoch(...args),
    waitForReadingContentIdle:(...args)=>waitContentIdle(...args)})}});
const old={sourceId:'s',bookId:'b',chapterIndex:0,chapterTitle:'章',chapterUrl:'/0',bodyVersion:'old',processingVersion:'old-p',
  contentVersion:'host-old',content:'开头\\r\\n目标文字与之后足够长的正文',images:[],extractionVia:'rule'};
const upgraded={...old,content:'开头\n目标文字与之后足够长的正文',bodyVersion:'new',processingVersion:'new-p',contentVersion:'host-new'};
const receipt=(id)=>({status:'committed',previousBodyVersion:'old',bodyVersion:'new',previousProcessingVersion:'old-p',processingVersion:'new-p',
  anchors:[{id,previousOffset:6,offset:3}]});
function page(load){
  const calls=[];
  const gateway={loadChapter:async(...args)=>{calls.push(args);return load(...args);}};
  const p=Object.assign(new Reader(),{mounted:true,lifecycleToken:1,chapterSelectionToken:1,sourceId:'s',bookId:'b',tocEntries:[],chapterWindow:{get:()=>undefined,setCurrent(){},clear(){}},
    controlBookmarkLoadGeneration:0,onLoadControlBookmarks:async()=>{},isSelectionActive:()=>true,activeGateway:()=>gateway,ensureCurrentContentMetrics:async()=>true,
    admitChapterContentVersion(){},retainCurrentChapterWindow(){},rebuildChapterImageIndexes(){},hasMeasuredViewport:()=>false,
    fail(error){this.failure=error;}});
  return {p,calls,gateway};
}
// A cache/rule mutation during an ordinary body read must retire the first
// result and wait for the replacement before publishing the chapter.
const preservedChapter=()=>({...old,positionMigration:{...receipt('requested'),status:'preserved',reason:'text_anchor_missing_or_ambiguous',
 bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',previousOffset:6,offset:6}]}});

const feedbackSource = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts', import.meta.url), 'utf8');
function installFeedback(p, notices, { unavailable, onPublished } = {}) {
 const storage = new Map();
 let now = 0, failed = 0;
 const failAt = stage => {
  if (stage === unavailable) { failed++; throw Error(stage + ' unavailable'); }
 };
 const { ReaderTransientFeedback, READER_FEEDBACK_DEDUPE_MS } = pureModuleProbe(feedbackSource, 'ReaderTransientFeedback.ts', {
  Date: { now: () => now },
  AppStorage: {
   get(key) { failAt('storage-read'); return storage.get(key); },
   setOrCreate(key, value) {
    failAt('storage-write');
    storage.set(key, value);
    if (value.visible) { onPublished?.(); notices.push(value.message); }
   },
  },
 }, ['ReaderTransientFeedback', 'READER_FEEDBACK_DEDUPE_MS']);
 Object.assign(p, {
  appForeground: true, windowChromeActive: true,
  isSessionActive: token => p.isSelectionActive(token, p.chapterSelectionToken),
  getUIContext() { failAt('context'); return {}; },
  transientFeedback: new ReaderTransientFeedback(),
 });
 return { advance: () => { now += READER_FEEDBACK_DEDUPE_MS; }, failed: () => failed };
}

async function directoryFixture(runtime, host, active) {
 const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
 const { actualReaderDirectoryOperations } = await import('./lib/reader-directory-operations-probe.mjs');
 const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
 const { ReaderNavigation } = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
 const root = new URL('../entry/src/main/ets/', import.meta.url);
 const emit = (path, names, bindings) => pureModuleProbe(readFileSync(new URL(path, root), 'utf8'), path, bindings, names);
 const Index = selectedProductionMethods(new URL('pages/Index.ets', root), 'Index',
  ['isCurrentRuntime', 'directoryJourneyPorts', 'directoryNavigationPorts'], { ReaderRuntimeOwner: { isCurrent: owner => owner === runtime } });
 const ReaderDirectoryOperations = actualReaderDirectoryOperations({
  ReaderDirectoryHost: { forRuntime(owner, current) {
   assert.equal(owner, runtime); assert.equal(current(), true);
   return host;
  } },
  // These cases only read, or refuse navigation before any operation.
  BookmarkOperationIntentStore: class {},
 });
 const { ReaderDirectoryJourney } = emit('app/composition/ReaderDirectoryJourney.ets', ['ReaderDirectoryJourney'],
  { ReaderDirectoryOperations, hilog: { warn() {}, error() {} } });
 const { readerDirectoryActions } = emit('features/reading/presentation/ReaderDirectoryActions.ets', ['readerDirectoryActions'], {});
 const navigation = new ReaderNavigation();
 navigation.show('directory');
 const entry = new (actualReadingEntryPresentation())();
 Object.assign(entry, {
  book: { sourceId: 's', bookId: 'b', title: '书', author: '作者' },
  toc: [{ index: 0, title: '章', navigable: true, bookmarks: [] }],
  sessionActive: active,
 });
 const notices = [];
 const index = Object.assign(new Index(), {
  mountedRuntimeOwner: runtime, detailShelfAdmissionMount: 1, searchAppForeground: true,
  shelfReceiptRetired: false, arkWebCapturesInput: false, mangaSourceSwitch: { selectionVisible: false },
  sourceSwitchPresentation: { isSurfacePresented: () => false },
  readingEntry: entry, currentReadingRuntime: () => runtime,
  openReading: assert.fail, publishNavigation: assert.fail,
  transientFeedback: { show(_context, feedback, current) { if (current()) notices.push(feedback.message); } },
 });
 index.directoryJourney = new ReaderDirectoryJourney(navigation, index.directoryJourneyPorts());
 const actions = readerDirectoryActions(() => entry, () => index.directoryNavigationPorts(), () => index.directoryJourney.operations);
 return { entry, navigation, operations: index.directoryJourney.operations, actions, notices };
}

try{
if(id==='content-epoch'){
{
 let revision=0, release, reads=0, idleCalls=0;
 const gate=new Promise(resolve=>release=resolve);
 captureContentEpoch=()=>{const captured=revision;return()=>captured===revision;};
 waitContentIdle=async()=>{idleCalls++;};
 const {p}=page(async()=>{reads++;return reads===1?gate:upgraded;});
 const pending=p.openChapter(0,false,1,1);
 await Promise.resolve();
 revision++;
 release(old);
 await pending;
 assert.equal(reads,2);
 assert.equal(idleCalls,1);
 assert.equal(p.chapter,upgraded,'a stale body may not reach the visible chapter');
 assert.equal(p.failure,undefined);
 captureContentEpoch=()=>()=>true;
 waitContentIdle=async()=>{};
}
}
if(id==='restored-anchor'){
{
 const {p,calls}=page(async()=>({...upgraded,positionMigration:receipt('restored')}));
 p.restoredProgress={kind:'restored',progress:{bookId:'b',chapterIndex:0,chapterOffset:6,chapterProgress:.3,updatedAt:1,bodyVersion:'old',processingVersion:'old-p'}};
 await p.openChapter(0,true,1,1);
 assert.equal(p.failure,undefined);assert.equal(p.desiredChapterOffset,3);assert.equal(p.restoredProgress.progress.updatedAt,1);
 assert.deepEqual(calls[0][4],{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'restored',offset:6}]});
}
}
if(id==='explicit-anchor'){
{
 const {p}=page(async()=>({...upgraded,positionMigration:receipt('requested')}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.equal(p.failure,undefined);assert.equal(p.desiredChapterOffset,3,'explicit bookmark must land on the same text after migration');
}
}
if(id==='preserved-anchor'){
{
 const {p}=page(async()=>({...old,positionMigration:{...receipt('requested'),status:'preserved',bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',previousOffset:6,offset:6}]}}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.equal(p.desiredChapterOffset,6);assert.equal(p.chapter.bodyVersion,'old','preserved transaction keeps old body and anchor');
}
}
if(id==='reject-migration'){
for(const bad of ['body','anchor']){
 const migration=receipt('requested');if(bad==='body')migration.previousBodyVersion='foreign';else migration.anchors=[];
 const {p}=page(async()=>({...upgraded,positionMigration:migration}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.match(p.failure.message,/MIGRATION/);assert.equal(p.chapter,undefined);
}
}
if(id==='late-selection'){
{
 let release;const gate=new Promise(resolve=>release=resolve);let active=true;
 const {p}=page(async()=>gate);p.isSelectionActive=()=>active;
 const pending=p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 active=false;release({...upgraded,positionMigration:receipt('requested')});await pending;
 assert.equal(p.chapter,undefined);assert.equal(p.restoredProgress,undefined);assert.equal(p.failure,undefined);
}
}
if(id==='window-proof'){
{
 const {p,calls}=page(async()=>upgraded);p.chapterWindow.get=()=>old;
 await p.loadSessionChapter(0,()=>true,false,{bodyVersion:'new',processingVersion:'new-p',anchors:[]});assert.equal(calls.length,1);
 assert.equal(await p.loadSessionChapter(0,()=>true,false,{bodyVersion:'old',processingVersion:'old-p',anchors:[]}),old);
 assert.equal(calls.length,1,'exact retained window evidence may be reused');
}
}
if(id==='tts-position'){
{
 const {p,gateway}=page(async()=>old);p.chapter=upgraded;p.isSessionActive=()=>true;p.requireChapterLayoutMap=()=>new ReadingSurfaceLayoutMap(upgraded.content);
 p.coreLayout=()=>({});p.admitCommittedProgress=()=>{};p.logTtsFailure=(_label,error)=>{throw error;};
 let saved;gateway.runProgressCommitSerial=async work=>work();gateway.persistPresentedProgress=async(bookId,_title,anchor,_layout,admitted)=>{assert.equal(admitted(),true);saved=anchor;return {bookId,...anchor,updatedAt:1};};
 await p.commitTtsProgress({chapter:p.ttsChapterRef(old),charEnd:6},1);assert.equal(saved,undefined,'old TTS callback cannot bind offsets to a new chapter body');
 await p.commitTtsProgress({chapter:p.ttsChapterRef(upgraded),charEnd:3},1);
 assert.equal(saved.bodyVersion,'new');assert.equal(saved.processingVersion,'new-p');assert.equal(saved.chapterOffset,3);
}
}
if(id==='bookmark-proof'){
{
 const {p}=page(async()=>old); const selections=[]; const notices=[];
 p.selectChapterAnchor=(...args)=>selections.push(args);p.clearTtsChapterEndTimer=()=>{};
 installFeedback(p, notices);
 p.selectBookmarkAnchor(0,6);assert.equal(selections.length,0);assert.equal(notices.length,1);
 p.selectBookmarkAnchor(0,6,{sourceId:'foreign',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'});
 assert.equal(selections.length,0);
 p.selectBookmarkAnchor(0,6,{sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'});
 assert.deepEqual(selections[0][8],{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 p.sourceId='local';p.selectBookmarkAnchor(0,6);assert.equal(selections.length,2);
}
}
if(id==='refresh-feedback'){
for(const status of [undefined,'committed','unchanged','preserved'])for(const force of [false,true]){
 const chapter=status==='committed'?{...upgraded,positionMigration:receipt('requested')}:
   status===undefined?{...old,cacheRefreshRequired:true}:{...preservedChapter(),positionMigration:{...preservedChapter().positionMigration,status}};
 const {p}=page(async()=>chapter);const notices=[];
 installFeedback(p, notices, { onPublished: () => assert.equal(p.chapter, chapter, 'notice follows chapter admission') });
 await p.openChapter(0,false,1,1,6,undefined,force);
 assert.equal(p.failure,undefined);assert.equal(p.chapter,chapter);
 assert.equal(notices.length,(force&&status!==undefined)||status===undefined?1:0,`${status}, force=${force}`);
 if(status===undefined)assert.match(notices[0],/旧版缓存.*待验证/);
 if(notices.length&&status==='preserved'){assert.match(notices[0],/本次未更新正文/);assert.match(notices[0],/原正文和阅读位置已保留/);assert.equal(p.desiredChapterOffset,6);}
 
}
}
if(id==='feedback-unavailable'){
for(const failure of ['context','storage-read','storage-write']){
 const chapter=preservedChapter();const {p}=page(async()=>chapter);const notices=[];
 const feedback = installFeedback(p, notices, { unavailable: failure });
 await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(p.failure,undefined,failure);assert.equal(p.chapter,chapter);assert.equal(p.desiredChapterOffset,6);
 assert.equal(feedback.failed(), 1);
 assert.deepEqual(notices, []);
 
}
}
if(id==='late-feedback'){
for(const stage of ['load','metrics']){
 let release;const gate=new Promise(resolve=>release=resolve);let active=true;const notices=[];
 const {p}=page(async()=>stage==='load'?gate:preservedChapter());p.isSelectionActive=()=>active;
 installFeedback(p, notices);
 if(stage==='metrics')p.ensureCurrentContentMetrics=async()=>gate;
 const pending=p.openChapter(0,false,1,1,6,undefined,true);
 await Promise.resolve();await Promise.resolve();active=false;
 release(stage==='load'?preservedChapter():true);await pending;
 assert.equal(notices.length,0,stage);assert.equal(p.failure,undefined);
 
}
}
if(id==='metrics-unavailable'){
{
 const {p}=page(async()=>preservedChapter());const notices=[];
 p.ensureCurrentContentMetrics=async()=>false;
 installFeedback(p, notices);
 await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(notices.length,0);assert.equal(p.chapter,undefined);assert.equal(p.failure,undefined);
 
}
}
if(id==='old-cache-once'){
{
 const cached={...old,cacheRefreshRequired:true}; const {p,calls}=page(async()=>cached);const notices=[];
 installFeedback(p, notices);
 await p.openChapter(0,false,1,1);await p.openChapter(0,false,1,1);
 assert.equal(p.failure,undefined);assert.equal(p.chapter,cached);assert.equal(notices.length,1);
 assert.ok(calls.every(call=>call[3]===false));assert.match(notices[0],/旧版缓存.*待验证/);
}
}
if(id==='inline-cache-recovery'){
for(const scenario of ['refresh','decline','stale','late','preserved','already-refresh','failure']){
 const context={bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]};
 const session={identity:{sourceId:'s',bookId:'b'}};let dialogs=0,active=true,release;
 const gate=new Promise(resolve=>release=resolve);
 const rejected=new RemoteChapterCacheRefreshError(session,0,context,scenario==='preserved');
 const {p,calls}=page(async(...args)=>{
   if(!args[3]||scenario==='already-refresh')throw rejected;
   assert.deepEqual(args[4],context,'explicit refresh carries only the original protected position context');
   if(scenario==='failure')throw Error('synthetic refresh failed');
   if(scenario==='late')return gate;
   return {...upgraded,positionMigration:receipt('requested')};
 });
 p.isSelectionActive=(lifecycle,selection)=>active&&lifecycle===p.lifecycleToken&&selection===p.chapterSelectionToken;
 p.beginExit=()=>assert.fail('cache recovery must not force reader exit');
 // Pagination/timeout scheduling is the existing fixture seam. The production
 // openChapter/recovery admission and native action callbacks remain real.
 p.resetForChapterSelection=()=>{p.failure=undefined;};p.armFirstPageReadyDeadline=()=>{};
 p.getUIContext=()=>({showAlertDialog(){dialogs++;assert.fail('automatic cache failure must not open a modal');},
   getPromptAction:()=>({showToast(){}})});
 await p.openChapter(0,false,1,1,6,undefined,scenario==='already-refresh');
 assert.equal(dialogs,0);assert.equal(calls.length,1,'initial failure completes without waiting for UI');
 assert.equal(p.failure,rejected);assert.equal(p.chapter,undefined);
 if(scenario==='preserved'||scenario==='already-refresh'){
   assert.equal(p.readerRecoveryView?.canRetry===true,false,'a preserved/already-refresh failure cannot recursively propose another replacement');
   continue;
 }
 assert.equal(p.readerRecoveryView.visible,true);assert.equal(p.readerRecoveryView.canRetry,true);assert.equal(p.readerRecoveryActionLabel,'刷新本章');
 const presentation=p.readerRecoveryView.generation;
 if(scenario==='stale')active=false;
 if(scenario!=='decline'){p.reconcileReaderRecovery(presentation);p.reconcileReaderRecovery(presentation);}
 if(scenario==='late'){
   for(let n=0;n<20&&calls.length<2;n++)await new Promise(resolve=>setImmediate(resolve));
   assert.equal(calls.length,2,'late cancellation happens after the actual refresh dispatch');
   active=false;p.chapterSelectionToken++;release({...upgraded,positionMigration:receipt('requested')});
 }
 for(let n=0;n<4;n++)await new Promise(resolve=>setImmediate(resolve));
 const refreshed=['refresh','late','failure'].includes(scenario);
 assert.equal(calls.length,refreshed?2:1,'only one current explicit inline action may refresh');assert.equal(dialogs,0);
 if(refreshed){assert.equal(calls[1][3],true);assert.deepEqual(calls[1][4],context);}
 if(scenario==='refresh'){assert.equal(p.failure,undefined);assert.equal(p.desiredChapterOffset,3);assert.equal(p.chapter.bodyVersion,'new');}
 else if(scenario==='failure'){assert.match(p.failure.message,/synthetic refresh failed/);assert.equal(p.chapter,undefined);}
 else assert.equal(p.chapter,undefined,'declined/stale/late recovery cannot publish replacement body');
}
}
if(id==='index-cache-recovery'){
{
 const { currentCachedChapterFeedbackOwners } = await import('./lib/reader-download-feedback-current-owner-probe.mjs');
 const session={identity:{sourceId:'s',bookId:'b'},sourceVersion:'v',acquisitionMode:'online',
   detailUrl:'/b',tocUrl:'/toc',book:{title:'书',author:'作者'},entries:[{index:0,title:'章',url:'/0',variables:[]}],
   continuationVariables:[],hostRequirements:[]};
 const position={bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]};
 for(const scenario of ['refresh','decline','stale','late','preserved','failure']){
   let active=true,revision=0,release;const calls=[],dialogs=[],failures=[];
   const gate=new Promise(resolve=>release=resolve);
   const error=new RemoteChapterCacheRefreshError(session,0,position,scenario==='preserved');
   const runtime={bookAcquisitions:()=>({readingProjectionRevision:()=>revision,setPreparationVisible(){}})};
   const NativeGateway=class{async loadChapter(...args){calls.push(args);revision+=2;
     if(scenario==='failure')throw Error('synthetic refresh failed');if(scenario==='late')return gate;return upgraded;}};
   const Entry=compileHost(undefined,{ReaderRuntimeOwner:{current:()=>runtime,isCurrent:owner=>owner===runtime},RemoteReadingFlowGateway:NativeGateway});
   const host = Entry.forRuntime(runtime);
   const { entry, receiver } = currentCachedChapterFeedbackOwners(runtime, host, { get live() { return active; } }, [], []);
   Object.assign(entry, { book: { ...session.identity, ...session.book, sourceName: '书源' }, session, toc: session.entries });
   receiver.route = 'reading';
   receiver.getUIContext = () => ({ showAlertDialog(row) {
     dialogs.push(row); assert.fail('entry recovery must not create a native dialog');
   } });
   entry.bindReader(runtime, { current: () => active, projectionVisible: () => true,
     membership: () => ({ generation: 0, blocked: false, value: false }), refreshShelf() {},
     notice: (...args) => failures.push(args), cacheDecision: receiver.chooseCachedChapterRefresh });
   assert.equal(await host.recoverCachedChapter(entry.scopeId,error,()=>active),undefined,'background probe completes without waiting for a notice decision');
   assert.equal(calls.length,0,'background failure never silently fetches another body');assert.equal(dialogs.length,0);
   let dispatched;
   const recover = host.recoverCachedChapter.bind(host);
   host.recoverCachedChapter = (...args) => { dispatched = recover(...args); return dispatched; };
   if(scenario!=='preserved'){
     assert.equal(entry.recoveryNotice.canRetry,true);assert.equal(entry.recoveryActionLabel,'刷新本章');
     const presentation=entry.recoveryNotice.generation;
     if(scenario==='stale')active=false;
     if(scenario!=='decline'){entry.retryRecoveryNotice(presentation);entry.retryRecoveryNotice(presentation);}
     if(scenario==='late'){
       for(let n=0;n<20&&calls.length<1;n++)await new Promise(resolve=>setImmediate(resolve));
       assert.equal(calls.length,1,'late entry cancellation follows actual dispatch');active=false;release(upgraded);
     }
   }
   await dispatched;
   assert.equal(calls.length,['refresh','failure','late'].includes(scenario)?1:0,scenario);
   if(calls.length){assert.equal(calls[0][0],session);assert.equal(calls[0][1],0);
     assert.equal(calls[0][3],true);assert.deepEqual(calls[0][4],position);}
   if(scenario==='refresh'){
     assert.equal(entry.verdict,'readable');assert.deepEqual(entry.session.identity,session.identity);
     assert.equal(entry.session.preparedChapter.projectionRevision,revision);
   } else assert.equal(entry.session.preparedChapter,undefined);
   assert.equal(failures.length,scenario==='preserved'||scenario==='failure'?1:0,scenario);
   assert.equal(dialogs.length,0);assert.equal(receiver.route,'reading','feedback never changes the active route');
 }
}
}
if(id==='fallback-anchor'){
{
 const current={...upgraded,content:'全新的本章正文，旧版文字已被替换。',positionMigration:{...receipt('requested'),
   reason:'positions_partially_restored',anchors:[{id:'requested',previousOffset:6,offset:0}]}};
 const {p}=page(async()=>current);const notices=[],reads=[];
 installFeedback(p, notices);
 p.onLoadControlBookmarks=async(...args)=>{reads.push(args);};
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(p.failure,undefined);assert.equal(p.chapter.content,current.content);assert.equal(p.desiredChapterOffset,0);
 assert.equal(reads.length,1);assert.deepEqual(reads[0].slice(0,2),['s','b']);assert.equal(reads[0][2](),true);
 assert.match(notices[0],/正文已更新.*章首.*书签和划线记录仍保留/);
 p.chapter={...current,bodyVersion:'newer'};assert.equal(reads[0][2](),false,'older list cannot commit after a newer body');
}
}
if(id==='refresh-results'){
for(const status of ['committed','unchanged']){
 const chapter=status==='committed'?{...upgraded,positionMigration:receipt('requested')}:
   {...old,positionMigration:{...preservedChapter().positionMigration,status:'unchanged'}};
 const {p}=page(async()=>chapter);const notices=[];
 const feedback = installFeedback(p, notices);
 await p.openChapter(0,false,1,1,6,undefined,true);
 feedback.advance();
 await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(notices.length,2,'each explicit refresh has its own result');
 assert.match(notices[0],status==='unchanged'?/正文没有变化/:/正文已更新/);
}
}
if(id==='bookmark-reload'){
{
 const {p}=page(async()=>upgraded);let release;const gate=new Promise(resolve=>release=resolve),reads=[];
 p.chapter=upgraded;p.onLoadControlBookmarks=async(...args)=>{reads.push(args);return gate;};
 p.reloadBookmarksAfterContentRefresh(upgraded,1,1);await Promise.resolve();
 const newer={...upgraded,contentVersion:'host-newer'};p.chapter=newer;
 p.reloadBookmarksAfterContentRefresh(newer,1,2);await Promise.resolve();
 assert.equal(reads[0][2](),false);assert.equal(reads[1][2](),true);
 release();await new Promise(resolve=>setImmediate(resolve));assert.equal(p.controlBookmarkLoadPending,false);
 p.onLoadControlBookmarks=async()=>{throw Error('projection unavailable');};
 p.reloadBookmarksAfterContentRefresh(newer,1,2);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(p.controlBookmarkLoadFailed,true);assert.equal(p.chapter,newer,'failed mark read never rolls body back');
}
}
if(id==='page-mark-scope'){
const Marks=productionMotionMethods(file,['bookmarkMatchesCurrentChapter','controlDirectoryEntries','currentPageBookmarkStatus',
 'toggleCurrentPageBookmark','pageBookmarkFeedbackAnchor','pageBookmarkFeedbackFilled','reconcilePageBookmarkFeedback','bookmarkFeedbackOwnerKey',
 'currentBookmarkViewport','currentPageBookmarkText'],
 {LOCAL_READING_SOURCE_ID:'local'});
{
 const scope={sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'};
 const mark={time:1,chapterIndex:0,chapterOffset:6,chapterTitle:'章',content:'个人备注',bookText:'原摘录',positionScope:scope};
 let entries=[{index:0,title:'章',bookmarks:[mark,{...mark,time:2,bookText:'',positionScope:undefined}]}];
 const requests=[];
 const p=Object.assign(new Marks(),{sourceId:'s',bookId:'b',mounted:true,chapter:old,
  chapterLayoutMap:new ReadingSurfaceLayoutMap(old.content),visiblePage:{startScalar:0,endScalar:12},
  readerSettingsSnapshot:{navigationMode:'paged'},bookmarkWriteEnabled:()=>true,bookmarkGestureAnchor:'',
  bookmarkExcerptCache:new Map(),bookmarkMutationGeneration:0,bookmarkPendingTarget:'',bookmarkPreviewChanged:false,
  currentChapterIndex:()=>0,controlDirectorySourceEntries:()=>entries,
  onTogglePageBookmark:r=>requests.push(r)});
 assert.equal(p.currentPageBookmarkStatus(),'bookmarked');
 // The same page numbers and parent array survive a refresh. Its previous
 // scope must no longer light the new page or participate in deletion.
 p.chapter=upgraded;p.chapterLayoutMap=new ReadingSurfaceLayoutMap(upgraded.content);
 assert.equal(p.currentPageBookmarkStatus(),'empty');
 const rows=p.controlDirectoryEntries()[0].bookmarks;
 assert.equal(rows[0].positionScope,undefined);assert.equal(rows[0].bookText,'原摘录');assert.equal(rows[0].content,'个人备注');
 assert.equal(rows[1].bookText,'','no quote fabricated from an unproven old offset');
 assert.equal(entries[0].bookmarks[0].positionScope,scope,'original parent facts untouched');
 p.toggleCurrentPageBookmark();assert.deepEqual(requests[0].bookmarkTimes,[],'unresolved original marks cannot be deleted by current-page gesture');
 assert.equal(requests[0].positionScope.bodyVersion,'new');
 p.chapter={...upgraded,processingVersion:'next-processing'};
 requests[0].onSettled(true);assert.equal(p.pageBookmarkFeedbackFilled(),false,'same rendered text with a new processing version cannot accept the old mark ACK');
 // A valid fresh scope is retained through excerpt hydration and allows the
 // existing mark to be removed deliberately from its actual page.
 const freshScope={...scope,bodyVersion:'new',processingVersion:'new-p'};
 entries=[{index:0,title:'章',bookmarks:[{...mark,positionScope:freshScope,bookText:''}]}];
 p.chapter=upgraded;p.bookmarkPendingTarget='';
 const valid=p.controlDirectoryEntries()[0].bookmarks[0];
 assert.deepEqual(valid.positionScope,freshScope);assert.ok(valid.bookText.length>0);assert.equal(valid.content,'个人备注');
 assert.equal(p.currentPageBookmarkStatus(),'bookmarked');
 p.toggleCurrentPageBookmark();assert.deepEqual(requests.at(-1).bookmarkTimes,[1]);
}
}
if(id==='cold-bookmark'){
{
 for(const active of [false,true]){
  const { entry, navigation, actions, notices } = await directoryFixture({}, undefined, active);
  actions.selectBookmark('unresolved',0,6);
  assert.equal(notices.length,1);assert.match(notices[0],/原摘录和备注仍保留/);
  assert.equal(navigation.snapshot().route,'directory');
  assert.equal(entry.requestedBookmarkAnchor,undefined);assert.equal(entry.sessionActive,active);
 }
}
}
if(id==='index-bookmark-failure'){
{
 const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts');
 for(const scenario of ['read-failed','new-mutation','new-navigation']){
  let reject;
  const gate=new Promise((_resolve,no)=>reject=no);
  let started=false;
  const runtime={request(method){assert.equal(method,'bookmark.list');started=true;return gate;}};
  const host=new ReaderDirectoryHost({gateway:new LocalReadingFlowGateway(runtime),ownsRuntime:()=>true});
  const fresh=[{index:0,title:'章',bookmarks:[{time:2,chapterOffset:0}]}];
  const { entry, navigation, operations } = await directoryFixture(runtime, host, true);
  const promise=operations.loadControlBookmarks('s','b',()=>true);
  const settlement = scenario==='read-failed' ? assert.rejects(promise,/bookmark read failed/) : promise;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(started,true,'the failing read is pending on the actual Core gateway');
  if(scenario==='new-mutation'){host.generation++;entry.toc=fresh;}
  if(scenario==='new-navigation')navigation.advance();
  reject(Error('bookmark read failed'));
  await settlement;
  if(scenario==='new-mutation')assert.equal(entry.toc,fresh,'obsolete read cannot overwrite or fail a new CRUD projection');
 }
}
}
if(id==='directory-proof'){
{
 const {p}=page(async()=>old);const selections=[];
 p.selectChapterAnchor=(...args)=>selections.push(args);p.clearTtsChapterEndTimer=()=>{};
 p.getUIContext=()=>({getPromptAction:()=>({showToast(){}})});
 const proof={sourceId:'s',bookId:'b',catalogRevision:'c',structureRevision:'n',nodeId:'leaf',url:'/0'};
 p.selectBookmarkAnchor(0,0,undefined,proof);
 assert.deepEqual(selections.at(-1)[8],{anchors:[],directoryTargetProof:proof},'chapterStart has independent directory authority and no fabricated body version');
 const scope={sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'};
 p.selectBookmarkAnchor(0,0,scope,proof);
 assert.deepEqual(selections.at(-1)[8],{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:0}],directoryTargetProof:proof},'exact zero preserves both original body proof and directory authority');
 const before=selections.length;p.selectBookmarkAnchor(0,0,undefined,{...proof,sourceId:'other'});
 assert.equal(selections.length,before,'foreign source proof cannot start a selection');
}
}
}finally{}
}
const definitions={"content-epoch": "content-epoch actual scoped owner/gateway/storage path; controlled Core/OS ports", "restored-anchor": "restored-anchor actual scoped owner/gateway/storage path; controlled Core/OS ports", "explicit-anchor": "explicit-anchor actual scoped owner/gateway/storage path; controlled Core/OS ports", "preserved-anchor": "preserved-anchor actual scoped owner/gateway/storage path; controlled Core/OS ports", "reject-migration": "reject-migration actual scoped owner/gateway/storage path; controlled Core/OS ports", "late-selection": "late-selection actual scoped owner/gateway/storage path; controlled Core/OS ports", "window-proof": "window-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "tts-position": "tts-position actual scoped owner/gateway/storage path; controlled Core/OS ports", "bookmark-proof": "bookmark-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "refresh-feedback": "refresh-feedback actual scoped owner/gateway/storage path; controlled Core/OS ports", "feedback-unavailable": "feedback-unavailable actual scoped owner/gateway/storage path; controlled Core/OS ports", "late-feedback": "late-feedback actual scoped owner/gateway/storage path; controlled Core/OS ports", "metrics-unavailable": "metrics-unavailable actual scoped owner/gateway/storage path; controlled Core/OS ports", "old-cache-once": "old-cache-once actual scoped owner/gateway/storage path; controlled Core/OS ports", "inline-cache-recovery": "inline-cache-recovery actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-cache-recovery": "index-cache-recovery actual scoped owner/gateway/storage path; controlled Core/OS ports", "fallback-anchor": "fallback-anchor actual scoped owner/gateway/storage path; controlled Core/OS ports", "refresh-results": "refresh-results actual scoped owner/gateway/storage path; controlled Core/OS ports", "bookmark-reload": "bookmark-reload actual scoped owner/gateway/storage path; controlled Core/OS ports", "page-mark-scope": "page-mark-scope actual scoped owner/gateway/storage path; controlled Core/OS ports", "cold-bookmark": "cold-bookmark actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-bookmark-failure": "index-bookmark-failure actual scoped owner/gateway/storage path; controlled Core/OS ports", "directory-proof": "directory-proof actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
