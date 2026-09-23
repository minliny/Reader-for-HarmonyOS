import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = new URL('../entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts', import.meta.url);
const Flow=productionMotionMethods(file,['load','loadPage','loadAll','loadAnchor','extendPage','classify'],{BOOKSHELF_PAGE_SIZE:48});
const book=i=>({sourceId:'s',bookId:String(i),title:String(i),author:'a'});
const page=(offset,total=100,revision='r')=>({books:Array.from({length:Math.min(48,total-offset)},(_,i)=>book(i+offset)),total,unfilteredTotal:total,projectionRevision:revision,changed:false});
function fixture(read){
 const requests=[];let continues=0;
 const owner=Object.assign(new Flow(),{filter:{readingState:'reading',sourceKind:'online'},bookshelf:{
  supportsShelfPages:()=>true,loadBookshelf:async params=>{requests.push(params);return read(params);},
  loadContinueReading:async()=>{continues++;return book(999);}}});
 return {owner,requests,continues:()=>continues};
}
{
 const f=fixture(p=>page(p.offset));const data=await f.owner.load();
 assert.equal(data.shelf.books.length,48);assert.equal(data.continueReading.bookId,'999');assert.equal(f.continues(),1);
 assert.deepEqual(f.requests.map(p=>[p.offset,p.limit,p.readingState,p.sourceKind]),[[0,48,'reading','online']]);
}
{
 const f=fixture(()=>({...page(0,0),unfilteredTotal:100}));const data=await f.owner.load();
 assert.equal(data.kind,'populated','no filter matches is not an empty Core shelf');
}
{
 const f=fixture(p=>page(p.offset));const all=await f.owner.loadAll(()=>true,true);
 assert.equal(all.books.length,100);assert.deepEqual(f.requests.map(p=>p.offset),[0,48,96]);
 assert.ok(f.requests.every(p=>p.membershipOnly&&p.readingState==='all'&&p.sourceKind==='all'));
 assert.equal(f.requests[1].projectionRevision,'r');
}
{
 let changed=false;
 const f=fixture(p=>{if(p.offset===48&&!changed){changed=true;return {...page(0),books:[],changed:true,projectionRevision:'new'};}return page(p.offset,100,changed?'new':'r');});
 const all=await f.owner.loadAll(()=>true);assert.equal(all.projectionRevision,'new');assert.equal(all.books.length,100);
 assert.deepEqual(f.requests.map(p=>p.offset),[0,48,0,48,96]);
}
{
 let active=true;const f=fixture(p=>{active=false;return page(p.offset);});
 assert.equal(await f.owner.loadAll(()=>active),undefined);assert.equal(f.requests.length,1);
}
{
 const f=fixture(p=>page(p.offset));const extended=await f.owner.extendPage(page(0),90,()=>true);
 assert.equal(extended.books.length,96);assert.equal(f.requests.length,1);
 const duplicate=fixture(p=>({...page(p.offset),books:[book(0)]}));
 await assert.rejects(duplicate.owner.extendPage(page(0),90,()=>true),/DUPLICATE/);
}
console.log('PASS shelf pages: bounded first read, independent continue summary, filtered-empty distinction, complete membership, stale revision restart, cancellation and anchor extension');

let resolvePage;
const pendingPage=()=>new Promise(resolve=>{resolvePage=resolve;});
let currentOwner={};let loads=0;
class Gateway {loadPage(){loads++;return pendingPage();}}
const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['loadNextShelfPage','loadPreviousShelfPage','loadShelfWindowPage'],{
 ReaderRuntimeOwner:{current:()=>currentOwner},BookshelfFlowGateway:Gateway,hilog:{warn(){}},DOMAIN:0});
for(const outcome of ['append','stale-generation','changed','duplicate','owner']){
 const first=page(0), host=Object.assign(new Index(),{route:'bookshelf',shelfBooks:first.books,shelfMatchedTotal:100,shelfWindowOffset:0,
  shelfProjectionRevision:'r',shelfPageLoading:false,bookshelfLoadGeneration:1,shelfReadingFilter:'all',shelfSourceFilter:'all',
  shelfBookKey:b=>JSON.stringify([b.sourceId,b.bookId]),refreshes:0,refreshBookshelf(){this.refreshes++;this.bookshelfLoadGeneration++;this.shelfPageLoading=false;}});
 loads=0;host.loadNextShelfPage();host.loadNextShelfPage();assert.equal(loads,1);
 if(outcome==='stale-generation')host.bookshelfLoadGeneration++;
 if(outcome==='owner')currentOwner={};
 const next=page(48);if(outcome==='changed'){next.changed=true;next.books=[];next.projectionRevision='new';}
 if(outcome==='duplicate')next.books=[book(0)];
 resolvePage(next);await new Promise(r=>setImmediate(r));
 assert.equal(host.shelfBooks.length,outcome==='append'?96:48,outcome);
 assert.equal(host.refreshes,outcome==='changed'?1:0,outcome);
}
console.log('PASS shelf page UI ownership: single request, append, stale generation/runtime rejection, changed revision refresh and duplicate-page rejection');

// Exercise more than twenty native list windows, including an incomplete tail.
{
 const total=1001;let requests=[];
 class WindowGateway {async loadPage(offset,revision){requests.push(offset);return {...page(offset,total,revision),offset};}}
 const WindowIndex=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
 ['loadNextShelfPage','loadPreviousShelfPage','loadShelfWindowPage'],{
 ReaderRuntimeOwner:{current:()=>currentOwner},BookshelfFlowGateway:WindowGateway,hilog:{warn(){throw new Error('unexpected window error');}},DOMAIN:0});
 const host=Object.assign(new WindowIndex(),{route:'bookshelf',shelfBooks:page(0,total).books,shelfMatchedTotal:total,
 shelfWindowOffset:0,shelfProjectionRevision:'r',shelfPageLoading:false,bookshelfLoadGeneration:1,
 shelfBookKey:b=>JSON.stringify([b.sourceId,b.bookId]),shelfFilter:()=>({readingState:'all',sourceKind:'all'})});
 const check=()=>{assert.ok(host.shelfBooks.length<=144);assert.equal(host.shelfWindowOffset%48,0);
 assert.deepEqual(host.shelfBooks.map(b=>Number(b.bookId)),Array.from({length:host.shelfBooks.length},(_,i)=>host.shelfWindowOffset+i));};
 while(host.shelfWindowOffset+host.shelfBooks.length<total){host.loadNextShelfPage();await new Promise(r=>setImmediate(r));check();}
 assert.equal(host.shelfBooks.at(-1).bookId,'1000');
 while(host.shelfWindowOffset>0){host.loadPreviousShelfPage();await new Promise(r=>setImmediate(r));check();}
 assert.equal(host.shelfBooks[0].bookId,'0');assert.ok(requests.length>35);
}
{
 const f=fixture(p=>({...page(960,1001),offset:960,anchorFound:true}));
 f.owner.bookshelf.supportsShelfAnchorPages=()=>true;
 const result=await f.owner.loadAnchor({sourceId:'s',bookId:'999'},900,()=>true);
 assert.equal(result.offset,960);assert.equal(f.requests.length,1);
 assert.deepEqual(f.requests[0].anchor,{sourceId:'s',bookId:'999'});
 assert.equal(f.requests[0].limit,48);
 assert.equal(await f.owner.loadAnchor({sourceId:'s',bookId:'999'},900,()=>false),undefined);
 assert.equal(f.requests.length,1);
}
console.log('PASS 1001-book forward/backward bounded windows, partial-tail alignment and one-query deep anchor');

{
 const Page=productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets',import.meta.url),['rebuildShelfProjection']);
 const state={anchorKey:JSON.stringify(['s','70']),anchorItemY:-7};let restored=false;
 const owner=Object.assign(new Page(),{books:page(48,1001).books,serverFiltered:true,unfilteredOnlineBooks:true,
  mounted:true,viewportRestored:true,viewState:state,
  rowDataSource:{totalCount:()=>16,getData:()=>[book(0)],replace(){
    if(owner.viewportRestored)state.anchorKey='wrong synchronous index';
  }},restoreShelfViewport(){restored=true;assert.equal(state.anchorKey,JSON.stringify(['s','70']));assert.equal(state.anchorItemY,-7);},
  publishVisibleReadingBooks(){throw Error('publish before anchor restoration');}});
 owner.rebuildShelfProjection();assert.equal(restored,true);
}
console.log('PASS synchronous native reload cannot overwrite the old visible-book anchor');
