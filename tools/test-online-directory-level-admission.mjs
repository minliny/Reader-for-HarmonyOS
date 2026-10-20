import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const seed={sourceId:'https://m.qidian.com#ReaderTestBuiltin',bookId:'1001458054',detailUrl:'https://m.qidian.com/book/1001458054',title:'青春',author:'韩寒'};
for(const cached of [false,true]) for(const level of (cached ? [undefined] : [0,1,32,undefined,-1,33,0.5])) {
 const toc=[{index:0,title:'正文卷',url:'',level},{index:1,title:'第一章',url:'/chapter/1',...(cached ? {} : {level:2})}];
 const gateway=new RemoteReadingFlowGateway({request:async(method)=>({data:method==='book.detail'?
  {sourceId:seed.sourceId,book:{bookId:seed.bookId,title:seed.title,author:seed.author},tocUrl:'/catalog'}:
  method==='book.toc'?{sourceId:seed.sourceId,bookId:seed.bookId,toc,readableChapterIndexes:[1]}:
  {sourceId:seed.sourceId,bookId:seed.bookId,tocAvailable:true,chapters:toc.map(e=>({...e,chapterIndex:e.index,navigable:e.index===1}))}})});
 const task=()=>cached?gateway.openCachedSession(seed):gateway.openSession(seed);
 if(level===undefined||Number.isInteger(level)&&level>=1&&level<=32){
  const session=await task();assert.equal(session.entries[0].level,level);assert.equal(session.entries[0].navigable,false);
  assert.equal(session.entries[1].level,cached ? undefined : 2);
  assert.equal(session.entries[1].index,1);assert.equal(session.entries[1].navigable,true);
 }else await assert.rejects(task);
}
console.log('PASS online/cached Core directory legacy levels 1..32 preserved; invalid levels rejected; group readability unchanged');
