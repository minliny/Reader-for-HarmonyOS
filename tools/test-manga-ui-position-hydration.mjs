import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
const file=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
let runtime={},pending=[],writes=[],nullEntryBooks=new Set();
class Gateway {
  constructor(owner){this.owner=owner;}
  entry(sourceId,bookId,_index,current){return new Promise(resolve=>pending.push({owner:this.owner,sourceId,bookId,current,resolve,kind:'entry',entryNull:nullEntryBooks.has(bookId)}));}
  progress(sourceId,bookId,current){return new Promise(resolve=>pending.push({owner:this.owner,sourceId,bookId,current,resolve,kind:'progress'}));}
}
const Host=productionMotionMethods(file,['hydrateMangaPositions','mangaPositionProjectionCurrent','pumpMangaPositionProjections','projectMangaPosition'],{
  ReaderRuntimeOwner:{current:()=>runtime},MangaSessionGateway:Gateway,MangaBookPresentation,
  AppStorage:{setOrCreate:(_key,value)=>writes.push(value)} });
const books=Array.from({length:180},(_,i)=>({sourceId:'source',bookId:`book-${i}`,contentKind:'manga',title:`Book ${i}`,author:'',addedAt:1}));
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const fixture=()=>{
  runtime={};pending=[];writes=[];nullEntryBooks=new Set();
  return Object.assign(new Host(),{route:'bookshelf',readingSessionActive:false,sourceSwitchVisible:false,
    shelfBooks:books,navigationGeneration:1,bookshelfLoadGeneration:1,detailBook:undefined,
    mangaProjectionSignature:'',mangaProjectionGeneration:0,mangaProjectionQueue:[],mangaProjectionWorkers:0});
};
function entry(request,{revision=3,pageOrdinal=7,noProgress=false,epoch=1}={}) {
  const chapterIdentity={sourceId:request.sourceId,bookId:request.bookId,chapterId:'chapter-4'};
  const location=noProgress?null:{kind:'manga',chapter:chapterIdentity,manifestVersion:'m1',pageId:`page-${pageOrdinal}`,pageOrdinalFallback:pageOrdinal,x:0,y:0,progressRevision:revision};
  return {chapter:{chapterIndex:4,chapterTitle:'来源原始卷名',totalPages:24,manifest:{chapter:chapterIdentity,manifestVersion:'m1',pages:[{pageId:`page-${pageOrdinal}`,ordinal:pageOrdinal}]}},
    progress:{token:{epoch,revision},location},targetOrdinal:pageOrdinal};
}
async function drain(){
  let safety=0;
  while(pending.length&&safety++<300){const next=pending.shift();next.resolve(next.kind==='entry' ? (next.entryNull ? null : entry(next)) : entry(next).progress);await tick();}
  assert.ok(safety<300,'bounded queue terminates');
}
{
  const host=fixture();host.hydrateMangaPositions(books.slice(0,30));
  assert.equal(pending.length,2);assert.equal(host.mangaProjectionWorkers,2);assert.equal(host.mangaProjectionQueue.length,22,'one batch retains only the latest 24 visible candidates');
  host.hydrateMangaPositions(books.slice(0,30));assert.equal(pending.length,2,'identical visible callback does not fetch the same batch again');
  const old=pending.splice(0);host.hydrateMangaPositions(books.slice(30,70));
  assert.equal(host.mangaProjectionWorkers,2);assert.equal(pending.length,0,'latest batch waits for the global worker budget');assert.equal(host.mangaProjectionQueue.length,24);
  old.forEach(request=>request.resolve(entry(request)));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'canceled old entry cannot publish');
  assert.equal(pending.length,2,'old completion pumps the latest queue without a skipped-key gap');
  await drain();assert.equal(host.mangaProjectionWorkers,0);assert.equal(host.mangaProjectionQueue.length,0);
  assert.equal(MangaBookPresentation.get('source','book-30').pageOrdinal,7);
}
{
  const host=fixture();host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  host.route='reading';host.readingSessionActive=true;host.navigationGeneration++;
  old.resolve(entry(old));await tick();assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'reader navigation revokes the old shelf projection');
  assert.equal(host.mangaProjectionWorkers,0);
}
{
  const host=fixture();host.route='detail';host.detailBook={...books[0]};host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  host.detailBook={...books[0],sourceId:'source-b'};host.hydrateMangaPositions([{...books[0],sourceId:'source-b'}]);
  old.resolve(entry(old));await tick();assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'equal bookId under a different source does not receive the old detail');
  await drain();assert.equal(host.detailBook.mangaPosition.pageOrdinal,7);
}
{
  const host=fixture();host.route='detail';host.detailBook={...books[0]};host.hydrateMangaPositions([books[0]]);await drain();
  const before=MangaBookPresentation.revision,displayWrites=writes.length;
  host.bookshelfLoadGeneration++;host.hydrateMangaPositions([books[0]]);await drain();
  assert.equal(MangaBookPresentation.revision,before,'unchanged admitted facts do not invalidate rows');assert.equal(writes.length,displayWrites);
  host.bookshelfLoadGeneration++;host.hydrateMangaPositions([books[0]]);const cleared=pending.shift();cleared.resolve(entry(cleared,{noProgress:true,revision:4}));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined);assert.equal(host.detailBook.mangaPosition,undefined,'Core-confirmed absent progress clears the actual mounted detail projection');
  // An obsolete response is valid wire data but cannot resurrect a cleared location.
  assert.equal(MangaBookPresentation.admitEntry('source','book-0',entry(cleared,{revision:3})),false);
}
{
  const host=fixture();host.hydrateMangaPositions([books[0]]);const old=pending.shift();
  runtime={};host.hydrateMangaPositions([books[1]]);old.resolve(entry(old));await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,'new Runtime owner cannot borrow or revive old display facts');await drain();
  // Business retention prunes known facts to the admitted shelf window plus current detail.
  host.shelfBooks=[books[1]];host.hydrateMangaPositions([books[1]]);assert.equal(MangaBookPresentation.get('source','book-30'),undefined);
}
{
  const host=fixture(); nullEntryBooks.add('book-0'); host.hydrateMangaPositions([books[0]]);
  const first=pending.shift(); first.resolve(null); await tick();
  assert.equal(pending.length,1,'missing prepared entry falls back to the existing Core progress read');
  const fallback=pending.shift(); host.sourceSwitchVisible=true;
  fallback.resolve(entry(fallback).progress); await tick();
  assert.equal(MangaBookPresentation.get('source','book-0'),undefined,
    'a source switch cancels a pending fallback progress projection before it reaches the shelf');
  assert.equal(host.mangaProjectionWorkers,0);
}
{
  const host=fixture(); host.sourceSwitchVisible=true; host.hydrateMangaPositions([books[0]]);
  assert.equal(pending.length,0,'source-switch presentation owns the window and does not start shelf manga hydration');
}
console.log('PASS actual Index manga position projection: global 2-worker/latest24 budget, same-batch dedup, route/source/owner fencing, queue replacement, no-progress clearing and idempotent row revision');
