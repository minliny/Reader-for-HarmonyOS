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
const file=fileURLToPath(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url));
const anchorSource=readFileSync(file,'utf8').match(/class CoreReadingAnchor[\s\S]*?\n}/)[0];
const CoreReadingAnchor=new Function(`${stripTypeScriptTypes(anchorSource)}; return CoreReadingAnchor;`)();
const Reader=productionMotionMethods(file,['openChapter','loadSessionChapter','configureRestoredAnchor','lastVisibleScalar',
  'positionContextForScope','selectBookmarkAnchor','commitTtsProgress','ttsChapterRef','notifyPreservedContentRefresh'],{ReadingSurfaceLayoutMap,CoreReadingAnchor,LOCAL_READING_SOURCE_ID:'local'});
const old={sourceId:'s',bookId:'b',chapterIndex:0,chapterTitle:'章',chapterUrl:'/0',bodyVersion:'old',processingVersion:'old-p',
  contentVersion:'host-old',content:'开头\\r\\n目标文字与之后足够长的正文',images:[],extractionVia:'rule'};
const upgraded={...old,content:'开头\n目标文字与之后足够长的正文',bodyVersion:'new',processingVersion:'new-p',contentVersion:'host-new'};
const receipt=(id)=>({status:'committed',previousBodyVersion:'old',bodyVersion:'new',previousProcessingVersion:'old-p',processingVersion:'new-p',
  anchors:[{id,previousOffset:6,offset:3}]});
function page(load){
  const calls=[];
  const gateway={loadChapter:async(...args)=>{calls.push(args);return load(...args);}};
  const p=Object.assign(new Reader(),{sourceId:'s',bookId:'b',tocEntries:[],chapterWindow:{get:()=>undefined,setCurrent(){}},
    isSelectionActive:()=>true,activeGateway:()=>gateway,ensureCurrentContentMetrics:async()=>true,
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
   status===undefined?{...old,contentRefreshRequired:true}:{...preservedChapter(),positionMigration:{...preservedChapter().positionMigration,status}};
 const {p}=page(async()=>chapter);const notices=[];
 p.getUIContext=()=>({getPromptAction:()=>({showToast:row=>{
   assert.equal(p.chapter,chapter,'notice follows admission of the readable chapter');notices.push(row.message);
 }})});
 await p.openChapter(0,false,1,1,6,undefined,force);
 assert.equal(p.failure,undefined);assert.equal(p.chapter,chapter);
 assert.equal(notices.length,force&&status==='preserved'?1:0,`${status}, force=${force}`);
 if(notices.length){assert.match(notices[0],/本次未更新正文/);assert.match(notices[0],/原正文和阅读位置已保留/);assert.equal(p.desiredChapterOffset,6);}
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
