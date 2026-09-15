import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import {readFileSync} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
// The shared production map uses a TypeScript constructor parameter property;
// expand that one syntax node for Node's strip-only loader, preserving methods.
const mapSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts',import.meta.url),'utf8')
  .replace('constructor(private readonly content: string) {','constructor(content: string) { this.content = content;');
const {ReadingSurfaceLayoutMap}=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mapSource)).toString('base64')}`);
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const file=fileURLToPath(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url));
const anchorSource=readFileSync(file,'utf8').match(/class CoreReadingAnchor[\s\S]*?\n}/)[0];
const CoreReadingAnchor=new Function(`${stripTypeScriptTypes(anchorSource)}; return CoreReadingAnchor;`)();
const Reader=productionMotionMethods(file,['openChapter','loadSessionChapter','configureRestoredAnchor','lastVisibleScalar',
  'positionContextForScope','selectBookmarkAnchor','commitTtsProgress','ttsChapterRef','notifyPreservedContentRefresh','reloadBookmarksAfterContentRefresh','requestCachedChapterRefresh'],{ReadingSurfaceLayoutMap,CoreReadingAnchor,RemoteChapterCacheRefreshError,LOCAL_READING_SOURCE_ID:'local'});
const old={sourceId:'s',bookId:'b',chapterIndex:0,chapterTitle:'章',chapterUrl:'/0',bodyVersion:'old',processingVersion:'old-p',
  contentVersion:'host-old',content:'开头\\r\\n目标文字与之后足够长的正文',images:[],extractionVia:'rule'};
const upgraded={...old,content:'开头\n目标文字与之后足够长的正文',bodyVersion:'new',processingVersion:'new-p',contentVersion:'host-new'};
const receipt=(id)=>({status:'committed',previousBodyVersion:'old',bodyVersion:'new',previousProcessingVersion:'old-p',processingVersion:'new-p',
  anchors:[{id,previousOffset:6,offset:3}]});
function page(load){
  const calls=[];
  const gateway={loadChapter:async(...args)=>{calls.push(args);return load(...args);}};
  const p=Object.assign(new Reader(),{sourceId:'s',bookId:'b',tocEntries:[],chapterWindow:{get:()=>undefined,setCurrent(){}},
    controlBookmarkLoadGeneration:0,onLoadControlBookmarks:async()=>{},isSelectionActive:()=>true,activeGateway:()=>gateway,ensureCurrentContentMetrics:async()=>true,
    admitChapterContentVersion(){},retainCurrentChapterWindow(){},rebuildChapterImageIndexes(){},hasMeasuredViewport:()=>false,
    fail(error){this.failure=error;}});
  return {p,calls,gateway};
}
{
 const {p,calls}=page(async()=>({...upgraded,positionMigration:receipt('restored')}));
 p.restoredProgress={kind:'restored',progress:{bookId:'b',chapterIndex:0,chapterOffset:6,chapterProgress:.3,updatedAt:1,bodyVersion:'old',processingVersion:'old-p'}};
 await p.openChapter(0,true,1,1);
 assert.equal(p.failure,undefined);assert.equal(p.desiredChapterOffset,3);assert.equal(p.restoredProgress.progress.updatedAt,1);
 assert.deepEqual(calls[0][4],{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'restored',offset:6}]});
}
{
 const {p}=page(async()=>({...upgraded,positionMigration:receipt('requested')}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.equal(p.failure,undefined);assert.equal(p.desiredChapterOffset,3,'explicit bookmark must land on the same text after migration');
}
{
 const {p}=page(async()=>({...old,positionMigration:{...receipt('requested'),status:'preserved',bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',previousOffset:6,offset:6}]}}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.equal(p.desiredChapterOffset,6);assert.equal(p.chapter.bodyVersion,'old','preserved transaction keeps old body and anchor');
}
for(const bad of ['body','anchor']){
 const migration=receipt('requested');if(bad==='body')migration.previousBodyVersion='foreign';else migration.anchors=[];
 const {p}=page(async()=>({...upgraded,positionMigration:migration}));
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 assert.match(p.failure.message,/MIGRATION/);assert.equal(p.chapter,undefined);
}
{
 let release;const gate=new Promise(resolve=>release=resolve);let active=true;
 const {p}=page(async()=>gate);p.isSelectionActive=()=>active;
 const pending=p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 active=false;release({...upgraded,positionMigration:receipt('requested')});await pending;
 assert.equal(p.chapter,undefined);assert.equal(p.restoredProgress,undefined);assert.equal(p.failure,undefined);
}
{
 const {p,calls}=page(async()=>upgraded);p.chapterWindow.get=()=>old;
 await p.loadSessionChapter(0,()=>true,false,{bodyVersion:'new',processingVersion:'new-p',anchors:[]});assert.equal(calls.length,1);
 assert.equal(await p.loadSessionChapter(0,()=>true,false,{bodyVersion:'old',processingVersion:'old-p',anchors:[]}),old);
 assert.equal(calls.length,1,'exact retained window evidence may be reused');
}
{
 const {p,gateway}=page(async()=>old);p.chapter=upgraded;p.isSessionActive=()=>true;p.requireChapterLayoutMap=()=>new ReadingSurfaceLayoutMap(upgraded.content);
 p.coreLayout=()=>({});p.admitCommittedProgress=()=>{};p.logTtsFailure=()=>{};
 let saved;gateway.runProgressCommitSerial=async work=>work();gateway.resolveAndUpdateProgress=async(_book,_title,anchor)=>{saved=anchor;return anchor;};
 await p.commitTtsProgress({chapter:p.ttsChapterRef(old),charEnd:6},1);assert.equal(saved,undefined,'old TTS callback cannot bind offsets to a new chapter body');
 await p.commitTtsProgress({chapter:p.ttsChapterRef(upgraded),charEnd:3},1);
 assert.equal(saved.bodyVersion,'new');assert.equal(saved.processingVersion,'new-p');assert.equal(saved.chapterOffset,3);
}
console.log('PH75 actual reader restore, explicit anchor, preservation, late selection, window proof and TTS write ownership PASS');

{
 const {p}=page(async()=>old); const selections=[]; const notices=[];
 p.selectChapterAnchor=(...args)=>selections.push(args);p.clearTtsChapterEndTimer=()=>{};
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row)})});
 p.selectBookmarkAnchor(0,6);assert.equal(selections.length,0);assert.equal(notices.length,1);
 p.selectBookmarkAnchor(0,6,{sourceId:'foreign',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'});
 assert.equal(selections.length,0);
 p.selectBookmarkAnchor(0,6,{sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'});
 assert.deepEqual(selections[0][8],{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 p.sourceId='local';p.selectBookmarkAnchor(0,6);assert.equal(selections.length,2);
}
console.log('PH75 unproven persistent offset never borrows current body proof PASS');

const preservedChapter=()=>({...old,positionMigration:{...receipt('requested'),status:'preserved',reason:'text_anchor_missing_or_ambiguous',
 bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',previousOffset:6,offset:6}]}});
let feedbackScenarios=0;
// Execute the actual LRE open/load/admit path. No notice is emitted until the
// returned chapter has been admitted, and only an explicit preserved refresh
// is a failed replacement (a cache version hint alone is not a refresh).
for(const status of [undefined,'committed','unchanged','preserved'])for(const force of [false,true]){
 const chapter=status==='committed'?{...upgraded,positionMigration:receipt('requested')}:
   status===undefined?{...old,cacheRefreshRequired:true}:{...preservedChapter(),positionMigration:{...preservedChapter().positionMigration,status}};
 const {p}=page(async()=>chapter);const notices=[];
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>{
   assert.equal(p.chapter,chapter,'notice follows admission of the readable chapter');notices.push(row.message);
 }})});
 await p.openChapter(0,false,1,1,6,undefined,force);
 assert.equal(p.failure,undefined);assert.equal(p.chapter,chapter);
 assert.equal(notices.length,(force&&status!==undefined)||status===undefined?1:0,`${status}, force=${force}`);
 if(status===undefined)assert.match(notices[0],/旧版缓存.*待验证/);
 if(notices.length&&status==='preserved'){assert.match(notices[0],/本次未更新正文/);assert.match(notices[0],/原正文和阅读位置已保留/);assert.equal(p.desiredChapterOffset,6);}
 feedbackScenarios++;
}
// All synchronous PromptAction failure sites are non-fatal. The platform's
// showToast API returns void, so no promise, timer or retry loop is introduced.
for(const failure of ['context','prompt','toast']){
 const chapter=preservedChapter();const {p}=page(async()=>chapter);
 p.getUIContext=()=>{
   if(failure==='context')throw Error('context detached');
   return{getPromptAction:()=>{if(failure==='prompt')throw Error('prompt unavailable');
     return{showToast(){throw Error('toast unavailable');}};}};
 };
 await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(p.failure,undefined,failure);assert.equal(p.chapter,chapter);assert.equal(p.desiredChapterOffset,6);
 feedbackScenarios++;
}
// A late fetch or a selection invalidated by metrics work cannot notify the
// next reading generation. Test both asynchronous boundaries in openChapter.
for(const stage of ['load','metrics']){
 let release;const gate=new Promise(resolve=>release=resolve);let active=true;const notices=[];
 const {p}=page(async()=>stage==='load'?gate:preservedChapter());p.isSelectionActive=()=>active;
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row)})});
 if(stage==='metrics')p.ensureCurrentContentMetrics=async()=>gate;
 const pending=p.openChapter(0,false,1,1,6,undefined,true);
 await Promise.resolve();await Promise.resolve();active=false;
 release(stage==='load'?preservedChapter():true);await pending;
 assert.equal(notices.length,0,stage);assert.equal(p.failure,undefined);
 feedbackScenarios++;
}
{
 const {p}=page(async()=>preservedChapter());const notices=[];
 p.ensureCurrentContentMetrics=async()=>false;
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row)})});
 await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(notices.length,0);assert.equal(p.chapter,undefined);assert.equal(p.failure,undefined);
 feedbackScenarios++;
}
assert.equal(feedbackScenarios,14);
console.log(`PH85 actual LRE preserved-refresh notice: ${feedbackScenarios} admission, intent, status, generation and presentation-failure scenarios PASS`);

// A normal old cache remains readable offline and is announced once per reader session.
{
 const cached={...old,cacheRefreshRequired:true}; const {p,calls}=page(async()=>cached);const notices=[];
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row.message)})});
 await p.openChapter(0,false,1,1);await p.openChapter(0,false,1,1);
 assert.equal(p.failure,undefined);assert.equal(p.chapter,cached);assert.equal(notices.length,1);
 assert.ok(calls.every(call=>call[3]===false));assert.match(notices[0],/旧版缓存.*待验证/);
}
// Only a rejected cache asks for explicit, per-chapter protected refresh.
for(const accept of [false,true]){
 const context={bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]};
 const session={identity:{sourceId:'s',bookId:'b'}};let dialogs=0;
 const {p,calls}=page(async(...args)=>{
   if(!args[3])throw new RemoteChapterCacheRefreshError(session,0,context,false);
   assert.deepEqual(args[4],context);return {...upgraded,positionMigration:receipt('requested')};
 });
 p.beginExit=()=>{p.exited=true;};p.getUIContext=()=>({showAlertDialog(row){dialogs++;row[accept?'primaryButton':'secondaryButton'].action();},
   getPromptAction:()=>({showToast(){}})});
 await p.openChapter(0,false,1,1,6);
 assert.equal(dialogs,1);assert.equal(p.failure,undefined);assert.equal(calls.length,accept?2:1);
 if(accept){assert.equal(p.desiredChapterOffset,3);assert.equal(p.chapter.bodyVersion,'new');}
 else{assert.equal(p.exited,true);assert.equal(p.chapter,undefined);}
}
console.log('ML cache: offline readable old body, one-session notice, explicit protected refresh and decline without write PASS');

// Execute the actual Index confirmation/recovery method; the RPC boundary is
// controlled, and neither declining nor leaving the book dispatches a refresh.
{
 const admission=await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
 const {withPreparedRemoteChapter}=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
 const session={identity:{sourceId:'s',bookId:'b'},sourceVersion:'v',acquisitionMode:'online',
   detailUrl:'/b',tocUrl:'/toc',book:{title:'书',author:'作者'},entries:[{index:0,title:'章',url:'/0',variables:[]}],
   continuationVariables:[],hostRequirements:[]};
 const position={bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]};
 for(const scenario of ['refresh','decline','stale','preserved','failure']){
   let active=true;const calls=[],dialogs=[],failures=[];
   const ErrorKind=RemoteChapterCacheRefreshError;
   const error=new ErrorKind(session,0,position,scenario==='preserved');
   const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
     ['refreshCachedChapterFromPrompt'],{...admission,withPreparedRemoteChapter,errorMessageOf:e=>e.message,
       ReaderRuntimeOwner:{current:()=>({bookAcquisitions:()=>({readingProjectionRevision:()=>0})})},
       RemoteReadingFlowGateway:class{async loadChapter(...args){calls.push(args);
         if(scenario==='failure')throw Error('synthetic refresh failed');return upgraded;}}});
   const page=Object.assign(new Index(),{navigationGeneration:7,showReadingFailure:(...args)=>failures.push(args),
     installRemoteReadingSession(value){this.remoteReadingSession=value;},getUIContext:()=>({showAlertDialog(row){
       dialogs.push(row);if(scenario==='stale')active=false;
       row[scenario==='decline'?'secondaryButton':'primaryButton'].action();}})});
   const result=await page.refreshCachedChapterFromPrompt(error,()=>active);
   assert.equal(calls.length,scenario==='refresh'||scenario==='failure'?1:0,scenario);
   if(calls.length){assert.equal(calls[0][0],session);assert.equal(calls[0][1],0);
     assert.equal(calls[0][3],true);assert.deepEqual(calls[0][4],position);}
   if(scenario==='refresh'){assert.equal(result,0);assert.equal(page.remoteContentVerdict,'readable');
     assert.equal(page.remoteReadingSession.identity,session.identity);}
   else assert.equal(result,undefined);
   assert.equal(failures.length,scenario==='preserved'||scenario==='failure'?1:0,scenario);
   assert.equal(dialogs.length,scenario==='preserved'?0:1);
 }
}
console.log('ML actual Index cache recovery: explicit refresh, decline, stale route, preserved positions and failure feedback PASS');

// PH93: the real reader admits the committed fresh body and the Core's explicit
// fallback anchor, retires older bookmark reads and gives accurate feedback.
{
 const current={...upgraded,content:'全新的本章正文，旧版文字已被替换。',positionMigration:{...receipt('requested'),
   reason:'positions_partially_restored',anchors:[{id:'requested',previousOffset:6,offset:0}]}};
 const {p}=page(async()=>current);const notices=[],reads=[];
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row.message)})});
 p.onLoadControlBookmarks=async(...args)=>{reads.push(args);};
 await p.openChapter(0,false,1,1,6,undefined,true,{bodyVersion:'old',processingVersion:'old-p',anchors:[{id:'requested',offset:6}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(p.failure,undefined);assert.equal(p.chapter.content,current.content);assert.equal(p.desiredChapterOffset,0);
 assert.equal(reads.length,1);assert.deepEqual(reads[0].slice(0,2),['s','b']);assert.equal(reads[0][2](),true);
 assert.match(notices[0],/正文已更新.*章首.*书签和划线记录仍保留/);
 p.chapter={...current,bodyVersion:'newer'};assert.equal(reads[0][2](),false,'older list cannot commit after a newer body');
}
for(const status of ['committed','unchanged']){
 const chapter=status==='committed'?{...upgraded,positionMigration:receipt('requested')}:
   {...old,positionMigration:{...preservedChapter().positionMigration,status:'unchanged'}};
 const {p}=page(async()=>chapter);const notices=[];
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>notices.push(row.message)})});
 await p.openChapter(0,false,1,1,6,undefined,true);await p.openChapter(0,false,1,1,6,undefined,true);
 assert.equal(notices.length,2,'each explicit refresh has its own result');
 assert.match(notices[0],status==='unchanged'?/正文没有变化/:/正文已更新/);
}
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

const Marks=productionMotionMethods(file,['bookmarkMatchesCurrentChapter','controlDirectoryEntries','currentPageBookmarkStatus',
 'toggleCurrentPageBookmark','pageBookmarkFeedbackAnchor','pageBookmarkFeedbackFilled','reconcilePageBookmarkFeedback'],
 {LOCAL_READING_SOURCE_ID:'local'});
{
 const scope={sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'old',processingVersion:'old-p'};
 const mark={time:1,chapterIndex:0,chapterOffset:6,chapterTitle:'章',content:'个人备注',bookText:'原摘录',positionScope:scope};
 let entries=[{index:0,title:'章',bookmarks:[mark,{...mark,time:2,bookText:'',positionScope:undefined}]}];
 const requests=[];
 const p=Object.assign(new Marks(),{sourceId:'s',bookId:'b',mounted:true,chapter:old,
  chapterLayoutMap:new ReadingSurfaceLayoutMap(old.content),visiblePage:{startScalar:0,endScalar:20},
  bookmarkExcerptCache:new Map(),bookmarkMutationGeneration:0,bookmarkPendingTarget:'',bookmarkPreviewChanged:false,
  currentChapterIndex:()=>0,controlDirectorySourceEntries:()=>entries,currentPageBookmarkText:()=> '当前页正文',
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
{
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
   ['onReaderBookmarkSelected'],{LOCAL_SOURCE_ID:'local',ReaderBookmarkAnchorRequest:class{constructor(...args){this.args=args;}}});
 for(const active of [false,true]){
  const notices=[];const p=Object.assign(new Index(),{detailBook:{sourceId:'s',bookId:'b'},readingSessionActive:active,
   route:'directory',bookmarkAnchorRequestId:0,isKnownDetailChapter:()=>true,openReading(){throw Error('must not open');},
   getUIContext:()=>({getPromptAction:()=>({showToast:row=>notices.push(row.message)})})});
  p.onReaderBookmarkSelected('unresolved',0,6);assert.equal(notices.length,1);assert.equal(p.route,'directory');
  assert.equal(p.requestedBookmarkAnchor,undefined);assert.equal(p.readingSessionActive,active);
 }
}
console.log('PH93 actual reader fresh-body/fallback admission, refresh results, mark reload races, quote/proof retention, page-mark deletion and cold-open safety PASS');
{
 const {loadReaderControlBookmarkProjection}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts');
 for(const scenario of ['read-failed','new-mutation','new-navigation']){
  let reject;const gate=new Promise((_resolve,no)=>reject=no);
  const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
   ['loadControlBookmarks'],{loadReaderControlBookmarkProjection,ReaderRuntimeOwner:{current:()=>({})},
    LocalReadingFlowGateway:class{async loadBookmarkProjection(){return gate;}}});
  const fresh=[{index:0,title:'章',bookmarks:[{time:2,chapterOffset:0}]}];
  const p=Object.assign(new Index(),{detailBook:{sourceId:'s',bookId:'b',title:'书',author:'作者'},readingSessionActive:true,
   navigationGeneration:1,directoryBookmarkMutationGeneration:1,directoryBookmarkMutationActiveKey:'',
   detailToc:[{index:0,title:'章',bookmarks:[]}],directoryBookmarkMutationKey:()=> 'book-key',
   clearDirectoryBookmarkProjectionFailure(){}});
  const promise=p.loadControlBookmarks('s','b',()=>true);
  if(scenario==='new-mutation'){p.directoryBookmarkMutationGeneration++;p.detailToc=fresh;}
  if(scenario==='new-navigation')p.navigationGeneration++;
  reject(Error('bookmark read failed'));
  if(scenario==='read-failed')await assert.rejects(promise,/bookmark read failed/);
  else await promise;
  if(scenario==='new-mutation')assert.equal(p.detailToc,fresh,'obsolete read cannot overwrite or fail a new CRUD projection');
 }
}
console.log('PH93 actual Index: superseded mark read is retired; current IO failure remains retryable and visible PASS');
