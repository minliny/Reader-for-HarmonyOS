import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { actualProjectionTypes, actualProjectionIndex } from './lib/bookshelf-projection-owner-probe.mjs';
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

const pause=()=>new Promise(r=>setTimeout(r,1));
async function until(p){for(let i=0;i<200;i++){if(p())return;await pause();}assert.fail('actual shelf page did not settle');}
function windowFixture(total=100){let installed,resolvePage,defer=false,mode='append';const requests=[];
 const runtime={supportsCoreCapability:c=>c==='bookshelf.pageProjection.v1',async request(method,params){
  if(method==='source.list')return{data:{sources:[]}};
  assert.equal(method,'bookshelf.list');requests.push(params.offset??0);
  const result={...page(params.offset??0,total,mode==='changed'?'new':'r'),offset:params.offset??0,unfilteredOnlineTotal:total};
  if(mode==='changed'&&(params.offset??0)>0){result.changed=true;result.books=[];}
  if(mode==='duplicate'&&(params.offset??0)>0)result.books=[book(0)];
  result.books=result.books.map(b=>({...b,sourceName:'Source',addedAt:1,sortIndex:Number(b.bookId)}));
  if(defer){defer=false;await new Promise(r=>{resolvePage=r;});}return{data:result};
 }};
 installed=runtime;const types=actualProjectionTypes(()=>installed),actual=actualProjectionIndex(runtime,types,{initial:{kind:'populated',shelf:page(0,total),continueReading:undefined}});
 return{...actual,requests,mode:m=>mode=m,changeOwner:o=>installed=o,pause(){defer=true;},release(){resolvePage();}};
}
for(const outcome of ['append','stale-generation','changed','duplicate','owner']){
 const f=windowFixture(),host=f.idx;let refreshes=0;
 const refresh=f.owner.refresh.bind(f.owner);f.owner.refresh=(...args)=>{refreshes++;return refresh(...args);};
 f.idx.bookshelfProjectionBinding.failed=e=>f.faults.push(e.message);
 f.pause();f.mode(outcome);host.loadNextShelfPage();host.loadNextShelfPage();assert.equal(f.requests.length,1);
 if(outcome==='stale-generation')host.invalidateBookshelfProjection();
 if(outcome==='owner')f.changeOwner({});
 f.release();await until(()=>!f.owner.snapshot().pageLoading);await pause();
 assert.equal(host.shelfBooks.length,outcome==='append'?96:48,outcome+' '+JSON.stringify(f.faults));
 assert.equal(refreshes,outcome==='changed'?1:0,outcome);
}
console.log('PASS actual Flow→ProjectionOwner→Index paging: single request, append, stale generation/runtime rejection, changed revision refresh and duplicate-page rejection');
// Exercise more than twenty native list windows, including an incomplete tail.
{
 const total=1001,f=windowFixture(total),host=f.idx;
 const check=()=>{assert.ok(host.shelfBooks.length<=144);assert.equal(host.shelfWindowOffset%48,0);
 assert.deepEqual(host.shelfBooks.map(b=>Number(b.bookId)),Array.from({length:host.shelfBooks.length},(_,i)=>host.shelfWindowOffset+i));};
 while(host.shelfWindowOffset+host.shelfBooks.length<total){host.loadNextShelfPage();await until(()=>!f.owner.snapshot().pageLoading);check();}
 assert.equal(host.shelfBooks.at(-1).bookId,'1000');
 while(host.shelfWindowOffset>0){host.loadPreviousShelfPage();await until(()=>!f.owner.snapshot().pageLoading);check();}
 assert.equal(host.shelfBooks[0].bookId,'0');assert.ok(f.requests.length>35);
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
