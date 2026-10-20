import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks }=await import('node:module');registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {readReadingDocumentWindow}=await import('../entry/src/main/ets/features/reading/ReadingDocumentWindow.ts');

const scope={sourceId:'s',bookId:'b',chapterIndex:4,bodyVersion:'body',processingVersion:'processed'};
const answer={kind:'ready',sourceId:'s',bookId:'b',chapterIndex:4,positionScope:scope,startScalar:40,endScalar:44,totalScalars:100,hasMore:true,
 content:'A😀\uFFFCB',baseUrl:'https://example.org/chapter',blocks:[
 {kind:'text',text:'A😀',startScalar:40,endScalar:42},{kind:'image',source:'pic.png',startScalar:42,endScalar:43},{kind:'text',text:'B',startScalar:43,endScalar:44}]};
const {ReadingSurfaceLayoutMap,readingChapterLayoutMap,prepareReadingChapterLayoutMap}=await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const {completeReadingParagraphWindow,prepareReadingParagraphUtf16Ranges,collectReadingParagraphUtf16Ranges}=await import('../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts');
const {readReadingEntrySnapshot,qualifyReadingEntryWindow}=await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const {ReadingSessionDocuments}=await import('../entry/src/main/ets/features/reading/ReadingSessionDocuments.ts');
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const range={startScalar:40,endScalar:44,totalScalars:100};

if(id==='wire-admission'){
let result=answer, valid=true;const calls=[];
const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>valid,request:async(method,params)=>{calls.push({method,params});return{data:result};}};
const window=await readReadingDocumentWindow(runtime,scope,42,4,()=>true);
assert.equal(calls.length,1);assert.equal(calls[0].method,'reading.document.window');
assert.equal(window.layout.scalarForUtf16(3),42);assert.equal(window.layout.utf16ForScalar(42),3);
assert.equal(window.layout.slice(41,42),'😀');assert.throws(()=>window.layout.scalarForUtf16(2),/splits a Unicode scalar/);
assert.equal(window.images[0].startScalar,42,'image anchors remain chapter-absolute');
assert.equal(window.layout.endScalar(),44);
result={...answer,positionScope:{...scope,bodyVersion:'changed'}};
await assert.rejects(readReadingDocumentWindow(runtime,scope,42,4,()=>true),/scope mismatch/);
result={...answer,blocks:[{kind:'text',text:answer.content,startScalar:0,endScalar:4}]};
await assert.rejects(readReadingDocumentWindow(runtime,scope,42,4,()=>true),/contiguous/);
valid=false;assert.equal(window.isCurrent(),false);
await assert.rejects(readReadingDocumentWindow(runtime,scope,42,4,()=>true),/cancelled/);
const chapter={content:'中文😀'};
assert.equal(readingChapterLayoutMap(chapter),readingChapterLayoutMap(chapter),'one boundary map per immutable chapter identity');
assert.notEqual(readingChapterLayoutMap({...chapter}),readingChapterLayoutMap(chapter));

}
if(id==='paragraph-context'){
const map=new ReadingSurfaceLayoutMap('A😀\uFFFCB',range);
assert.equal(map.scalarCount(),100);assert.equal(map.residentStart(),40);assert.equal(map.residentEnd(),44);
assert.equal(map.utf16ForScalar(42),3);assert.equal(map.scalarForUtf16(3),42);
assert.equal(map.sliceByScalar(41,42),'😀');assert.equal(map.isComplete(),false);
assert.throws(()=>map.utf16ForScalar(0),/out of range/);assert.throws(()=>map.sliceByScalar(43,45),/out of range/);
assert.throws(()=>new ReadingSurfaceLayoutMap('A',range),/invalid/);
const ranged={content:'same',documentRange:{startScalar:1,endScalar:5,totalScalars:10}};
const shared={...ranged,textLayoutIdentity:(await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts')).readingChapterTextIdentity(ranged)};
assert.equal(readingChapterLayoutMap(ranged),readingChapterLayoutMap(shared));
assert.notEqual(readingChapterLayoutMap(ranged),readingChapterLayoutMap({...shared,documentRange:{startScalar:2,endScalar:6,totalScalars:10}}));
assert.deepEqual(completeReadingParagraphWindow('tail\r\n完整😀段\r\nnext\r\nhead','lineSeparated',false,false,9),{startUtf16:6,endUtf16:17});
assert.equal(completeReadingParagraphWindow('tail\n正文\nhead','lineSeparated',false,false,2),undefined);
assert.equal(completeReadingParagraphWindow('A'.repeat(32000),'lineSeparated',false,false,16000),undefined,'giant partial paragraph is never reshaped as a complete paragraph');
assert.deepEqual(completeReadingParagraphWindow('完整 é אבג 😀','lineSeparated',true,true,4),{startUtf16:0,endUtf16:12});
// A terminal break is excluded from shaping, but a range ending mid-chapter
// still cannot claim its last semantic paragraph is complete.
for (const newline of ['\n','\r','\r\n']) {
 for (const suffix of ['', ' \t']) {
  const body = '正文😀' + newline + suffix;
  assert.deepEqual(completeReadingParagraphWindow(body,'blankLineSeparated',true,true,body.length),
   {startUtf16:0,endUtf16:4});
  assert.equal(completeReadingParagraphWindow(body,'blankLineSeparated',true,false,2),undefined,
   'a terminal break in a resident window is not proof of the chapter end');
  const middle = 'tail' + newline + newline + body;
  assert.equal(completeReadingParagraphWindow(middle,'blankLineSeparated',false,false,middle.indexOf('正文')),undefined,
   'a partial window cannot publish its trailing paragraph as complete');
 }
}
const structured='tail\nline\n\n完整\nBR\n\nhead';
const projected=completeReadingParagraphWindow(structured,'blankLineSeparated',false,false,13);
assert.equal(structured.slice(projected.startUtf16,projected.endUtf16),'完整\nBR');

}
if(id==='entry-window'){
let response={...answer,documentWindow:{...range,requestedScalar:42},chapterTitle:'章',contentRefreshRequired:false,progress:null,navigation:null};
const entryCalls=[];
const entryRuntime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>true,request:async(m,p)=>{entryCalls.push(p);return{data:response};}};
const partial=await readReadingEntrySnapshot(entryRuntime,'s','b',4,()=>true,undefined,4);
assert.equal(entryCalls[0].windowScalarLimit,4);assert.deepEqual(partial.chapter.documentRange,range);
assert.equal(readingChapterLayoutMap(partial.chapter).scalarForUtf16(3),42);
await assert.rejects(readReadingEntrySnapshot(entryRuntime,'s','b',4,()=>true),/unexpected partial/);
response={...response,documentWindow:{...range,endScalar:45,requestedScalar:42}};
await assert.rejects(readReadingEntrySnapshot(entryRuntime,'s','b',4,()=>true,undefined,4),/resident range/);
const docs=new ReadingSessionDocuments();docs.configure('s','b',[4],()=>true);docs.admit(partial.chapter,true);
assert.equal(docs.read('s','b',4),undefined,'partial range never pollutes the complete chapter cache');

}
if(id==='map-scheduler'){
const {withCooperativeTurns}=await import('./fixtures/flows/cooperative-turns.mjs');await withCooperativeTurns(async clock=>{
{
 const {prepareReadingChapterLayoutMap}=await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
 const content='甲😀é אבג\r\n'.repeat(4000), chapter={content};
 const beforeTurns=clock.turns;
 const prepared=await prepareReadingChapterLayoutMap(chapter,()=>true);
 const expected=new ReadingSurfaceLayoutMap(content);
 assert.ok(clock.turns-beforeTurns>=3,'large map explicitly admits multiple cooperative turns, without a wall-clock claim');
 assert.equal(prepared,readingChapterLayoutMap(chapter),'future foreground consumers reuse the prepared map');
 for(const scalar of [0,1,2,8191,8192,8193,expected.scalarCount()]) {
   assert.equal(prepared.utf16ForScalar(scalar),expected.utf16ForScalar(scalar));
   assert.equal(prepared.scalarForUtf16(prepared.utf16ForScalar(scalar)),scalar);
 }
 let current=true;const cancelled={content};
 setTimeout(()=>{current=false;},0);
 await assert.rejects(prepareReadingChapterLayoutMap(cancelled,()=>current),/cancelled/);
 const recovered=await prepareReadingChapterLayoutMap(cancelled,()=>true);
 assert.equal(recovered.scalarCount(),expected.scalarCount(),'a cancelled partial table never enters shared identity storage');
 const resident=await ReadingSurfaceLayoutMap.prepare('A😀B',{startScalar:40,endScalar:43,totalScalars:100},()=>true);
 assert.equal(resident.utf16ForScalar(42),3);assert.equal(resident.scalarForUtf16(3),42);
}
});
}
if(id==='gateway-expansion'){
const snippet='tail\n目标😀段\n第二段\nhead';
const snippetCount=[...snippet].length;
const fullText='前'.repeat(40)+snippet+'后'.repeat(100-40-snippetCount);
const boundedData={kind:'ready',sourceId:'s',bookId:'b',chapterIndex:4,chapterTitle:'章',baseUrl:'https://example.org/chapter',
 positionScope:scope,content:snippet,blocks:[{kind:'text',text:snippet,startScalar:40,endScalar:40+snippetCount}],
 documentWindow:{startScalar:40,endScalar:40+snippetCount,totalScalars:100,requestedScalar:46},progress:null,navigation:null,contentRefreshRequired:false};
const fullData={...boundedData,content:fullText,blocks:[{kind:'text',text:fullText,startScalar:0,endScalar:100}],documentWindow:null};
let rangeCalls=0, wholeCalls=0, live=true;
const actualRuntime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>live,request:async(method,params)=>{
 assert.equal(method,'reading.entry.snapshot');
 if(params.windowScalarLimit!==undefined){rangeCalls++;return{data:boundedData};}
 wholeCalls++;return{data:fullData};
}};
const gateway=new ReadingSessionFlowGateway('s','b',{kind:'remote',seed:{sourceId:'s',bookId:'b'}},actualRuntime);
const scoped={bodyVersion:'body',processingVersion:'processed',anchors:[{id:'requested',offset:46}]};
const admitted=await gateway.loadEntrySnapshot(4,()=>true,scoped,'lineSeparated');
assert.equal(rangeCalls,1);assert.equal(wholeCalls,0,'entry must not transfer the whole chapter when complete context exists');
assert.equal(admitted.chapter.content,'目标😀段\n第二段');
assert.equal(admitted.chapter.documentRange.startScalar,45);
assert.equal((await gateway.loadChapter('b',4,()=>true,false,scoped)).content,admitted.chapter.content,'one retained entry supplies the initial materialization');
const completed=await gateway.completeEntryChapter(admitted.chapter,()=>true);
assert.equal(wholeCalls,1);assert.equal(completed.content,fullText);
assert.equal(completed.contentVersion,admitted.chapter.contentVersion,'same document identity survives window expansion');
assert.equal(completed.documentRange,undefined);
live=false;
await assert.rejects(gateway.completeEntryChapter(admitted.chapter,()=>false),/cancelled/);
const giant={...admitted,chapter:{...admitted.chapter,content:'文'.repeat(5000),documentRange:{startScalar:20000,endScalar:25000,totalScalars:50000}},requestedScalar:22000};
assert.equal(qualifyReadingEntryWindow(giant,'lineSeparated'),undefined,'truncated giant paragraphs require more context, never guessed boundaries');

}
if(id==='paragraph-scheduler'){
const {withCooperativeTurns}=await import('./fixtures/flows/cooperative-turns.mjs');await withCooperativeTurns(async clock=>{
for (const mode of ['lineSeparated','blankLineSeparated']) {
 const content = ('中文😀\r\n单行<br>\n \t\r\n第二段 é אב\r尾\n').repeat(2000);
 const beforeTurns=clock.turns;
 const prepared=await prepareReadingParagraphUtf16Ranges(content,mode,()=>true);

 assert.deepEqual(prepared,collectReadingParagraphUtf16Ranges(content,mode));
 assert.ok(clock.turns-beforeTurns>=3,'paragraph projection explicitly releases cooperative turns');
 let live=true;setTimeout(()=>{live=false;},0);
 assert.equal(await prepareReadingParagraphUtf16Ranges(content,mode,()=>live),undefined);
}
assert.deepEqual(collectReadingParagraphUtf16Ranges('甲\r\n乙\r丙\n','lineSeparated'),
 [{startUtf16:0,endUtf16:1},{startUtf16:3,endUtf16:4},{startUtf16:5,endUtf16:6}]);
assert.deepEqual(collectReadingParagraphUtf16Ranges('甲\r\n乙\n \t\r\n丙','blankLineSeparated'),
 [{startUtf16:0,endUtf16:4},{startUtf16:9,endUtf16:10}]);

});
}
}
const definitions={"wire-admission": "wire-admission actual production window/paragraph behavior; controlled IO boundary", "paragraph-context": "paragraph-context actual production window/paragraph behavior; controlled IO boundary", "entry-window": "entry-window actual production window/paragraph behavior; controlled IO boundary", "map-scheduler": "map-scheduler actual production window/paragraph behavior; controlled IO boundary", "gateway-expansion": "gateway-expansion actual production window/paragraph behavior; controlled IO boundary", "paragraph-scheduler": "paragraph-scheduler actual production window/paragraph behavior; controlled IO boundary"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
