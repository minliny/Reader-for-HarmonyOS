import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingSessionDocuments,readingSessionDocuments}=await import('../entry/src/main/ets/features/reading/ReadingSessionDocuments.ts');
const {releaseReadingEntryMemory,registerReadingEntryMemoryRelease}=await import('../entry/src/main/ets/features/reading/ReadingEntryHandoff.ts');
const {readingChapterLayoutMap}=await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const body=(index=20)=>({sourceId:'s',bookId:'b',chapterIndex:index,chapterTitle:'正文',chapterUrl:'/c',content:'甲😀乙',contentVersion:'host',bodyVersion:'body',processingVersion:'process',extractionVia:'rule',images:[]});
{
 let valid=true; const owner=new ReadingSessionDocuments(), original=body();
 original.images=[{source:'image',baseUrl:'base',startScalar:0,endScalar:1,state:'ready',pixelMap:{native:'owned by view'},fileUri:'/temporary',intrinsicWidth:20,intrinsicHeight:30,revision:'image'}];
 owner.configure('s','b',[0,10,20,30,40,50,60],()=>valid);owner.admit(original,true);
 for(const index of [0,10,30,40,50,60])owner.admit(body(index),false);
 assert.ok(owner.read('s','b',50));assert.equal(owner.read('s','b',60),undefined);
 const retained=owner.read('s','b',20);assert.equal(retained.images[0].pixelMap,undefined);assert.equal(retained.images[0].fileUri,'');assert.equal(retained.images[0].state,'pending');
 assert.equal(readingChapterLayoutMap(original),readingChapterLayoutMap(retained),'original and remount share text map without retaining images');
 assert.equal(owner.read('s','b',20,{bodyVersion:'other',processingVersion:'process',anchors:[]}),undefined);
 assert.throws(()=>owner.read('s','b',20,{bodyVersion:'body',processingVersion:'process',anchors:[{id:'a',offset:4}]}),/SCOPE/);
 owner.configure('s','b',[10,20,30,40,50,60,70],()=>valid);assert.ok(owner.read('s','b',50),'catalog expansion keeps eligible neighbour bodies');
 valid=false;assert.equal(owner.read('s','b',20),undefined);
 owner.configure('s','other',[20],()=>true);owner.admit(original,true);assert.equal(owner.read('s','other',20),undefined,'late old-book write cannot contaminate another book');
}
{
 const runtime={},owner=readingSessionDocuments(runtime);let otherReleased=false;
 registerReadingEntryMemoryRelease(runtime,()=>{otherReleased=true;});
 owner.configure('s','b',[20],()=>true);owner.admit(body(),true);
 releaseReadingEntryMemory(runtime);assert.equal(owner.read('s','b',20),undefined);assert.equal(otherReleased,true,'release every owner, not only the last registration');
 assert.equal(readingSessionDocuments(runtime),owner);
}
{
 let revision=0;const calls=[];
 const runtime={supportsCoreCapability:c=>c==='reading.entry.snapshot.v1',captureReadingContentValidity:()=>{const captured=revision;return()=>captured===revision;},
  request:async(method,params)=>{calls.push({method,params});assert.equal(method,'reading.entry.snapshot');const i=params.chapterIndex??20;return{data:{kind:'ready',sourceId:'s',bookId:'b',chapterIndex:i,chapterTitle:'正文',content:'甲😀乙',baseUrl:'https://example.org/c',
   positionScope:{sourceId:'s',bookId:'b',chapterIndex:i,bodyVersion:'body',processingVersion:'process'},navigation:{revision:'toc',chapterCount:2,readableChapterCount:2,current:{index:i,position:i===20?0:1,readablePosition:i===20?0:1,title:'正文',navigable:true},before:[],after:i===20?[{index:30,position:1,readablePosition:1,title:'下一章',navigable:true}]:[]}}};}};
 const first=new ReadingSessionFlowGateway('s','b',{kind:'remote'},runtime);
 await first.loadEntrySnapshot(undefined,()=>true);await first.loadChapter('b',20,()=>true);await first.prefetchChapter('b',30,()=>true);
 assert.equal(calls.length,2);
 const next=new ReadingSessionFlowGateway('s','b',{kind:'remote'},runtime);
 assert.equal((await next.loadChapter('b',30,()=>true)).content,'甲😀乙');assert.equal(calls.length,2,'new page reuses process-owned adjacent text without acquisition or RPC');
 await assert.rejects(next.loadChapter('b',20,()=>false),/cancelled/);
 revision++;await next.loadChapter('b',30,()=>true);assert.equal(calls.length,3,'content invalidation requires fresh Core evidence');
 await assert.rejects(next.loadChapter('b',30,()=>true,true),/ACQUISITION/,'forced refresh cannot use the window');
}
console.log('session documents: remounted gateway reuses adjacent body, original shared map, no native image ownership, scope/cancel/force-refresh and multi-owner cleanup PASS');
