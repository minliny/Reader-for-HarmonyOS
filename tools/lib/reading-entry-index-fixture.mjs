import assert from 'node:assert/strict';
import {ProductionHost,compileHost,read,setRuntime,BookAcquisitionCoordinator,ReadingEntryPreparation,ReaderDirectoryHost,
 readingEvidence,content} from './reading-entry-owner-probe.mjs';
export const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
export const tick=()=>new Promise(r=>setTimeout(r,0));
export async function until(predicate){for(let i=0;i<1500;i++){if(predicate())return;await tick();}assert.fail('actual boundary did not settle');}
export const seed=(bookId='book',sourceId='s1')=>({sourceId,bookId,detailUrl:bookId,title:'Book',author:'Writer',sourceVersion:'v1'});
export const book=(bookId='book',sourceId='s1')=>({sourceId,sourceName:'Source',bookId,title:'Book',author:'Writer',addedAt:1,sortIndex:0});
export const session=(bookId='book',sourceId='s1',catalog='c1')=>({identity:{sourceId,bookId},sourceVersion:'v1',catalogVersion:catalog,contextVersion:'x1',
 acquisitionMode:'online',detailUrl:bookId,tocUrl:'/toc',book:{title:'Book',author:'Writer'},continuationVariables:[],hostRequirements:[],
 entries:[0,1,2].map(index=>({index,title:`Chapter ${index}`,level:index===0?2:undefined,url:`https://source/${bookId}/${index}`,variables:[]}))});
const chapterText='清晨的阳光照进房间，书中的故事从这里开始。'.repeat(12);
export function fixture(Host=ProductionHost){
 const calls=[],changes=[],notices=[],diagnostics=[],rows=new Map(),shelves=new Map(),gates=new Map(),bodies=new Map();
 const control={live:true,projection:true,memberGeneration:0,member:false,blocked:false,offline:0,decision:false,decisionGate:undefined,
 bodyVia:'rule',failProjection:false,failSource:false,failStatus:false,forceFailure:false,forceExtraRevision:false,bodyIgnoreCancellation:false};
 const key=(s,b)=>JSON.stringify([s,b]);let coordinator,preparations,appearance=0;
 const execute=async(method,p={},options={})=>{
  calls.push({method,p,options});const bookId=p.bookId??p.book?.bookId??p.bookUrl,identity=key(p.sourceId??p.origin??'local',bookId),gate=gates.get(method+':'+identity);
  if(gate)await gate.promise;
  if(options.shouldCancel?.()&&!(method==='chapter.content'&&control.bodyIgnoreCancellation))throw Error('fixture cancelled');
  if(method==='source.list'){if(control.failSource)throw Error('source read unavailable');return{data:{sources:['s1','s2'].filter(s=>p.sourceId===undefined||s===p.sourceId).map(sourceId=>({
    sourceId,name:sourceId==='s1'?'Named Source':'Fallback Source',baseUrl:'https://source',enabled:true,enabledExplore:true,sourceVersion:'v1'}))}};}
  if(method==='bookshelf.get')return{data:{book:shelves.get(identity)??null}};
  if(method==='bookshelf.list')return{data:{books:[...shelves.values()],total:shelves.size,projectionRevision:'r1',changed:false,
   unfilteredTotal:shelves.size,unfilteredOnlineTotal:[...shelves.values()].filter(b=>b.sourceId!=='local').length}};
  if(method==='search-book.get'){if(control.failProjection)throw Error('projection unavailable');return{data:{book:rows.get(identity)??null}};}
  if(method==='reading.progress.get')return{data:{found:false,progress:null}};
  if(method==='source.switch.pending.list')return{data:{pending:[]}};
  if(method==='local_book.toc')return{data:{sourceId:'local',bookId:p.bookId,toc:[0,1,2].map(index=>({index,title:`Chapter ${index}`,url:`/${index}`,level:2}))}};
  if(method==='local_book.chapter.content')return{data:{sourceId:'local',bookId:p.bookId,chapterIndex:p.chapterIndex,chapterTitle:`Chapter ${p.chapterIndex}`,content:chapterText}};
  if(method==='book.detail'){
   rows.set(identity,{origin:p.sourceId,bookUrl:bookId,name:'Book',author:'Writer',variable:'{}',time:Date.now(),
    acquisition:{schemaVersion:1,sourceVersion:'v1',detailAt:Date.now()}});
   return{data:{sourceId:p.sourceId,book:{bookId,title:'Book',author:'Writer',intro:'Details'},sourceVersion:'v1',tocUrl:'/toc',variables:{}}};
  }
  if(method==='book.toc'){
   const row=rows.get(identity);if(row)row.acquisition={...row.acquisition,catalogAt:Date.now(),catalogVersion:'c1',contextVersion:'x1',catalogCount:3};
   return{data:{sourceId:p.sourceId,bookId:p.bookId,sourceVersion:'v1',catalogAt:Date.now(),catalogVersion:'c1',contextVersion:'x1',catalogInstalled:true,
    continuationVariables:{},toc:[0,1,2].map(index=>({index,title:`Chapter ${index}`,url:`https://source/${p.bookId}/${index}`,level:index===0?2:undefined,variables:{}}))}};
  }
  if(method==='cache.book.status'){
   if(control.failStatus)throw Error('status unavailable');return{data:{sourceId:p.sourceId,bookId:p.bookId,tocAvailable:rows.has(identity),sourceVersion:'v1',
    catalogVersion:'c1',contextVersion:'x1',catalogAt:Date.now(),continuationVariables:{},chapters:[0,1,2].map(chapterIndex=>({chapterIndex,
     title:`Chapter ${chapterIndex}`,url:`https://source/${p.bookId}/${chapterIndex}`,variables:{},state:'completed',cachedBytes:chapterText.length}))}};
  }
  if(method==='bookmark.list')return{data:{bookmarks:[]}};
  if(method==='chapter.content'){
   if(p.forceRefresh&&control.forceFailure)throw Error('forced body unavailable');
   if(p.forceRefresh&&control.forceExtraRevision)coordinator.projectionRevision+=1;
   return{data:{sourceId:p.sourceId,bookId:p.bookId,chapterTitle:`Chapter ${p.chapterIndex}`,content:bodies.get(identity+':'+p.chapterIndex)??chapterText,
     via:p.forceRefresh?'rule':control.bodyVia,bodyVersion:'b1',processingVersion:'p1'}};
  }
  if(method==='search-book.put'){
   const row=rows.get(identity)??{origin:p.origin,bookUrl:p.bookUrl,name:'Book',author:'Writer'};
   row.acquisition={...row.acquisition,...p.acquisition};rows.set(identity,row);return{data:{book:row}};
  }
  if(method==='reading.entry.prepare')return{data:{sourceId:p.sourceId,bookId:p.bookId,kind:'ready',reason:'prepared',chapterIndex:3+p.neighborOffset}};
  if(method==='reader.chinese-conversion.put')return{data:{saved:true}};
  throw Error('unhandled native fixture '+method);
 };
 coordinator=new BookAcquisitionCoordinator(execute,c=>c==='chapter.content.cacheOnly.v1'||c==='reading.entry.prepare.v1');
 const runtime={closed:false,supportsCoreCapability:c=>c==='chapter.content.cacheOnly.v1'||c==='reading.entry.prepare.v1',
  bookAcquisitions:()=>coordinator,request:(...args)=>coordinator.request(...args),captureReadingContentValidity:()=>()=>true,
  setReadingPreparationContext:(...args)=>calls.push({method:'context',p:args}),getAppearanceStore:()=>({load:async()=>{appearance++;}}),
  noteReadingPreparationIntent:(...args)=>calls.push({method:'intent',p:args}),
  readingEntryPreparations:()=>preparations};
 preparations=new ReadingEntryPreparation(runtime);setRuntime(runtime);const host=new Host(runtime);let directory=[],membership=false;
 const lease={isCurrent:()=>control.live,projectionAllowed:()=>control.projection,currentDirectory:()=>directory,offlineGeneration:()=>control.offline,
  membership:()=>({generation:control.memberGeneration,blocked:control.blocked,value:control.member}),changed(snapshot){changes.push(snapshot);directory=snapshot.toc;membership=snapshot.inBookshelf;control.member=membership;},
  cacheDecision:async(error,current)=>{notices.push({decision:error,current});if(control.decisionGate)await control.decisionGate.promise;return control.decision;},
  notice:(title,message)=>notices.push({title,message}),refreshShelf:()=>calls.push({method:'refreshShelf'}),diagnostic:(stage,message)=>diagnostics.push({stage,message})};
 const preparationContext={isCurrent:()=>control.live,foreground:()=>true,shelfVisible:()=>true,readingActive:()=>false,settingsAvailable:()=>true,
  revision:()=> 'r1',diagnostic:message=>diagnostics.push({stage:'preparation',message})};
 return{host,runtime,coordinator,preparations,lease,control,calls,changes,notices,diagnostics,rows,shelves,gates,bodies,key,preparationContext,
  directory:()=>directory,changeDirectory:entries=>{directory=entries;},appearance:()=>appearance,
  close:()=>{control.live=false;host.retire();preparations.close();coordinator.close();runtime.closed=true;},
  settle:async()=>{for(let i=0;i<30;i++)await Promise.resolve();}};
}
