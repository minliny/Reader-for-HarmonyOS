import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {BookRequestNotDispatchedError}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const {MangaSourceSwitchGateway,MangaSwitchChapterSelectionRequired}=await import('../entry/src/main/ets/features/manga/application/MangaSourceSwitchGateway.ts');
const pages=[0,1].map((ordinal)=>({ordinal,pageId:`mp1:${String(ordinal).repeat(64)}`,resourceRef:`manga:mp1:${String(ordinal).repeat(64)}`}));
const chapter={sourceId:'target',bookId:'b',chapterId:'/chapter'};
const manifest={chapter,manifestVersion:'v',sourceRuleVersion:'s',decodeRevision:'identity-v1',pages};
const oldLocation={kind:'manga',chapter:{sourceId:'old',bookId:'a',chapterId:'/old'},manifestVersion:'oldv',pageId:pages[1].pageId,pageOrdinalFallback:1,x:0,y:.5,progressRevision:1};
function fixture(){const calls=[],releases=[];let fail=false,current=true;
 const runtime={supportsCoreCapability:()=>true,async request(method,p){calls.push([method,p]);if(method==='reading.progress.get')return {data:{token:{epoch:2,revision:p.sourceId==='old'?1:0},location:p.sourceId==='old'?oldLocation:null}};
 if(method==='manga.chapter.get')return {data:{manifest,chapterIndex:3,chapterTitle:'C',cached:false,resources:pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://image.test/${page.ordinal}`}}))}};
 assert.equal(method,'manga.sourceSwitch.commit');return {data:{mapping:'approximate',progress:{token:{epoch:2,revision:1},location:{...oldLocation,chapter:p.firstImage.chapter,manifestVersion:p.firstImage.manifestVersion,pageId:p.firstImage.pageId,pageOrdinalFallback:p.targetPageOrdinal,x:0,y:0}}}};},
 async loadReadingImage(...args){assert.equal(args[12],manifest.decodeRevision,'source switch carries target decode fact');calls.push(['image']);if(fail)throw Error('image failed');return {fileUri:'file://img',width:600,height:800,revision:'pixels'};},releaseReadingImage(uri){releases.push(uri);}};
 return {gateway:new MangaSourceSwitchGateway(runtime),calls,releases,current:()=>current,cancel:()=>current=false,fail:()=>fail=true};}
const target={contentKind:'manga',sourceVersion:'s',identity:{sourceId:'target',bookId:'b'},
 book:{title:'Target Manga',author:'Target Author'},entries:[{index:3,title:'C',url:'/chapter'}]};
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',5,f.current);assert.equal(p.mapping,'approximate');assert.equal(p.targetPageOrdinal,0);assert.equal(f.releases.length,1);assert.equal(f.calls.filter(c=>c[0]==='image').length,1);await assert.rejects(f.gateway.commit(p,false,f.current),/SELECTION/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);await f.gateway.commit(p,true,f.current);assert.equal(f.calls.at(-1)[1].expectedFrom.revision,1);}
{const f=fixture();f.fail();await assert.rejects(f.gateway.prepare('old','a',target,'C',3,f.current),/image failed/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);}
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',3,f.current);f.cancel();await assert.rejects(f.gateway.commit(p,true,f.current),/CANCELLED/);}
console.log('PASS manga switch directly selects after saved-position and chapter-first-image validation, retains old shelf on failed image, fences cancellation');
const {mangaCurrentJourney}=await import('./lib/manga-current-journey-probe.mjs');
{
 const f=fixture();const grouped={...target,entries:[{index:5,title:'C',url:'/group',navigable:false},...target.entries]};
 const proposal=await f.gateway.prepare('old','a',grouped,'C',5,f.current);
 assert.equal(proposal.firstImage.chapterIndex,3,'non-readable group does not make unique readable title ambiguous');
 const empty=fixture();await assert.rejects(empty.gateway.prepare('old','a',{...grouped,entries:grouped.entries.slice(0,1)},'C',5,empty.current),error=>error instanceof MangaSwitchChapterSelectionRequired && error.reason==='missing');
 assert.deepEqual(empty.calls.map(c=>c[0]),['reading.progress.get'],'group-only target cannot fetch or commit a chapter');
}
console.log('PASS manga source switching matches only unique readable titles and refuses URL-bearing groups');


// An old index or page ordinal is never evidence across source catalogs.
for (const [label,entries,title,index,reason] of [
 ['missing title with same index',[{index:5,title:'Other chapter',url:'/other'}],'C',5,'missing'],
 ['duplicate title with same index',[{index:3,title:'C',url:'/chapter'},{index:5,title:'C',url:'/duplicate'}],'C',5,'ambiguous'],
 ['blank title',[{index:5,title:'',url:'/empty'}],'',5,'missing'],
 ['duplicate surrounding whitespace',[{index:3,title:' C ',url:'/chapter'},{index:5,title:'C',url:'/duplicate'}],'C',5,'ambiguous'],
]) {
 const f=fixture(), acquired={...target,entries};
 let selection;
 await assert.rejects(f.gateway.prepare('old','a',acquired,title,index,f.current),error=>{
  selection=error;return error instanceof MangaSwitchChapterSelectionRequired;
 });
 assert.equal(selection.code,'MANGA_SWITCH_CHAPTER_SELECTION_REQUIRED');
 assert.equal(selection.targetSession,acquired,'retain the acquired target catalog for the existing directory');
 assert.equal(selection.reason,reason,label);assert.deepEqual(selection.expectedFrom,{epoch:2,revision:1});
 assert.equal(selection.fromSourceId,'old');assert.equal(selection.fromBookId,'a');
 assert.deepEqual(f.calls.map(call=>call[0]),['reading.progress.get'],`${label}: no index fallback/image/shelf/progress mutation`);
}
console.log('PASS unmatched, duplicate and blank titles request typed chapter selection with retained target session and old CAS; same index never overrides ambiguity');

{
 const f=fixture();const acquired={...target,entries:[{index:3,title:'Different chapter chosen by user',url:'/chapter'}]};
 let selection;
 try {await f.gateway.prepare('old','a',acquired,'Old unmatched chapter',3,f.current);} catch(error){selection=error;}
 assert.ok(selection instanceof MangaSwitchChapterSelectionRequired);
 const proof={sourceId:'target',bookId:'b',catalogRevision:'catalog-v1',structureRevision:'structure-v1',nodeId:'chapter-3',chapterIndex:3,url:'/chapter'};
 const selected=await f.gateway.prepareSelected('old','a',selection.targetSession,3,f.current,selection.expectedFrom,proof);
 assert.equal(selected.targetPageOrdinal,0);assert.equal(selected.chapterTitle,'Different chapter chosen by user');
 assert.deepEqual(f.calls.find(call=>call[0]==='manga.chapter.get')[1].directoryTargetProof,proof);
 assert.equal(f.calls.filter(call=>call[0]==='image').length,1);assert.equal(f.calls.some(call=>call[0]==='manga.sourceSwitch.commit'),false);
 const progress=await f.gateway.commitPrepared(selected,f.current);
 assert.equal(progress.location.pageOrdinalFallback,0);assert.equal(progress.location.pageId,pages[0].pageId);
 assert.equal(progress.location.x,0);assert.equal(progress.location.y,0);
 assert.deepEqual(f.calls.at(-1)[1].expectedFrom,{epoch:2,revision:1});assert.deepEqual(f.calls.at(-1)[1].expectedTarget,{epoch:2,revision:0});
 assert.equal(f.calls.at(-1)[1].acceptApproximate,true,'legacy Core wire consent is supplied by explicit user selection, with no second UI prompt');
}
console.log('PASS explicit directory selection is authoritative, verifies one first image, carries existing directory proof and commits at chapter start with dual CAS');

for (const index of [-1,99,Number.NaN]) {
 const f=fixture();await assert.rejects(f.gateway.prepareSelected('old','a',target,index,f.current),/SELECTED_CHAPTER_INVALID/);
 assert.equal(f.calls.length,0,'invalid/group selection cannot acquire pixels or mutate progress');
}
{
 const f=fixture(), grouped={...target,entries:[{index:7,title:'Volume',url:'/group',navigable:false},...target.entries]};
 await assert.rejects(f.gateway.prepareSelected('old','a',grouped,7,f.current),/SELECTED_CHAPTER_INVALID/);assert.equal(f.calls.length,0);
 await assert.rejects(f.gateway.prepareSelected('old','a',target,3,f.current,{epoch:2,revision:2}),/PROGRESS_CHANGED/);
 assert.deepEqual(f.calls.map(call=>call[0]),['reading.progress.get']);
}
console.log('PASS manual selection rejects invalid/group targets and stale original progress before any target image or mutation');

{
 const f=fixture();const runtime=f.gateway.runtime, request=runtime.request;
 runtime.request=async(method,params,options={})=>{
  const result=await request(method,params);
  if(method==='manga.chapter.get')result.data={...result.data,manifest:{...result.data.manifest,chapter:{...chapter,chapterId:'/different-url'}}};
  return result;
 };
 await assert.rejects(f.gateway.prepareSelected('old','a',target,3,f.current),/CATALOG_CHANGED/);
 assert.equal(f.calls.some(call=>call[0]==='image'),false);assert.equal(f.calls.some(call=>call[0]==='manga.sourceSwitch.commit'),false);
}
for (const corrupt of ['chapterId','manifestVersion','pageId','offset','revision']) {
 const f=fixture(), proposal=await f.gateway.prepare('old','a',target,'C',500,f.current);
 const runtime=f.gateway.runtime, request=runtime.request;
 runtime.request=async(method,params,options={})=>{
  const result=await request(method,params);
  if(method==='manga.sourceSwitch.commit'){
   const progress=result.data.progress,location=progress.location;
   if(corrupt==='chapterId')location.chapter={...location.chapter,chapterId:'/wrong'};
   if(corrupt==='manifestVersion')location.manifestVersion='wrong';
   if(corrupt==='pageId')location.pageId=pages[1].pageId;
   if(corrupt==='offset')location.y=.5;
   if(corrupt==='revision')progress.token.revision=9;
  }
  return result;
 };
 await assert.rejects(f.gateway.commitPrepared(proposal,f.current),/RECEIPT_INVALID/,corrupt);
}
{
 const f=fixture(), proposal=await f.gateway.prepare('old','a',target,'C',3,f.current);
 await assert.rejects(f.gateway.commitPrepared({...proposal,targetPageOrdinal:1},f.current),/LANDING_INVALID/);
 assert.equal(f.calls.some(call=>call[0]==='manga.sourceSwitch.commit'),false);
}
console.log('PASS changed catalog or malformed commit receipt is rejected; old ordinal cannot be reintroduced through a stale proposal');

// Execute current MangaSourceSwitchPresentation, ReaderSourceSwitchJourney and entry owners.
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};}
const selectionTarget={...target,book:{title:'Target Manga',author:'Target Author',kind:'comic'},entries:[
 {index:2,title:'Volume One',url:'/volume',navigable:false,level:1},
 {index:3,title:'User-selected chapter',url:'/chapter',navigable:true,level:2},
 {index:7,title:'Not readable',url:'',navigable:false,level:1},
]};
function selectionFixture(mode='success',catalog=selectionTarget){
 const f=fixture(),runtime=f.gateway.runtime,request=runtime.request,load=runtime.loadReadingImage;
 let committed=false,revision=1,registryRevision=1,oldReads=0,refresh=0,readbackFailed=false;
 const imageGate=deferred(),commitGate=deferred(),imageStarted=deferred(),commitStarted=deferred();
 runtime.request=async(method,params,options={})=>{
  if(method==='source.list'){
   f.calls.push([method,params]);return{data:{sources:['old','target'].map(sourceId=>
    ({sourceId,name:sourceId,enabled:true,sourceVersion:'s',bookSource:{bookSourceType:2}}))}};
  }
  if(method==='bookshelf.get'){
   if(mode==='readback-failed'&&committed&&!readbackFailed){readbackFailed=true;throw Error('private shelf read failed');}
   const row=await new Shelf().loadShelfBook(params.sourceId);
   return {data:{book:row===undefined?null:{...row,addedAt:1,sortIndex:0}}};
  }
  if(method==='reading.progress.get'&&params.sourceId==='old'){
   oldReads++;const result=await request(method,params);
   result.data.token.revision=mode==='preparation-progress-race'&&oldReads>1?2:revision;
   result.data.location={...oldLocation,progressRevision:result.data.token.revision};return result;
  }
  if(method==='manga.sourceSwitch.commit'){
   assert.equal(options.canDispatch(),true);options.onDispatch?.();
   commitStarted.resolve();
   if(mode==='commit-pending')await commitGate.promise;
   if(mode==='commit-rejected')throw Error('Core CAS rejected');
   const result=await request(method,params);committed=true;
   if(mode==='navigation-away'){x.navigation.advance();x.navigation.show('bookshelf');}
   if(mode==='lost-response')throw Error('response lost');
   if(mode==='invalid-ack')result.data.progress.location.pageId='wrong-page';
   return result;
  }
  return request(method,params);
 };
 runtime.loadReadingImage=async(...args)=>{
  imageStarted.resolve();
  if(mode==='image-pending')await imageGate.promise;
  return load(...args);
 };
 const original={sourceId:'old',bookId:'a',title:'Target Manga',author:'Target Author',contentKind:'manga',
  mangaPosition:{chapterIndex:8,chapterTitle:'Saved Chapter',pageOrdinal:1,totalPages:2},sourceName:'Original source'};
 const originalSession={contentKind:'manga',identity:{sourceId:'old',bookId:'a'},book:{title:original.title,author:original.author},entries:[{index:8,title:'Saved Chapter',url:'/old'}]};
 const originalToc=[{index:8,title:'Saved Chapter',downloadState:'unknown'}];
 const candidate={sourceId:'target',bookUrl:'b',bookName:'Target Manga',author:'Target Author',sourceVersion:'s',category:'comic',sourceName:'Target source'};
 const fetches=[],messages=[];
 class Shelf {async loadShelfBook(source){return source==='old'?(committed?undefined:original):
  (committed?{sourceId:'target',bookId:'b',title:'Target Manga',author:'Target Author',contentKind:'manga'}:undefined);}}
 runtime.getUIAbilityContext=()=>({filesDir:'/private-files'});
 runtime.supportsCoreCapability=capability=>capability!=='manga.sourceSwitch.receipt.v1';
 catalog.continuationVariables??=[];catalog.entries.forEach(row=>row.variables??=[]);
 runtime.bookAcquisitions=()=>({sourceRegistryRevision:()=>registryRevision,readingProjectionRevision:()=>1,setPreparationVisible(){},
  hasCurrentCatalogProjection:()=>true,async acquireBook(seed,admission){
  assert.deepEqual([seed.sourceId,seed.bookId],['target','b']);assert.equal(admission.isCurrent(),true);return catalog;
 }});
 const x=mangaCurrentJourney({runtime,book:original,session:originalSession,toc:originalToc,candidate,messages,onRefresh:()=>refresh++});
 const preparation=x.host.mangaPreparationGateway(),fetch=preparation.fetchTargetToc.bind(preparation);
 preparation.fetchTargetToc=async(...args)=>{fetches.push(args);return fetch(...args);};
 return {...x,f,original,originalSession,originalToc,candidate,catalog,fetches,messages,
  setRevision:value=>revision=value,setRegistryRevision:value=>registryRevision=value,committed:()=>committed,refresh:()=>refresh,
  imageGate,commitGate,imageStarted,commitStarted};
}
function assertOriginal(s){
 assert.equal(s.entry.book,s.original);assert.equal(s.entry.session,s.originalSession);
 assert.equal(s.entry.toc,s.originalToc);assert.equal(s.navigation.snapshot().route,'reading');
 assert.deepEqual(s.original.mangaPosition,{chapterIndex:8,chapterTitle:'Saved Chapter',pageOrdinal:1,totalPages:2});
 assert.equal(s.entry.sessionActive,true);
}
for(const mode of ['success','cancel','image-fail','lost-response','navigation-away']) {
 const matching={...selectionTarget,entries:[{index:3,title:'Saved Chapter',url:'/chapter',navigable:true}]};
 const s=selectionFixture(mode,matching);
 if(mode==='image-fail')s.f.fail();
 const work=s.begin();if(mode==='cancel')s.switchActions.close(s.source.scopeId);await work;
 assert.equal(s.committed(),!['cancel','image-fail'].includes(mode));
 assert.equal(s.installed.length,mode==='success'?1:0);
 if(s.committed())assert.ok(s.refresh()>0);
 if(mode==='lost-response'){
  assert.equal(s.entry.book,s.original);assert.equal(s.entry.inBookshelf,true);
  await assert.rejects(s.host.assertMangaSwitchAvailable(s.original,{sourceId:'target',bookId:'b'}));
 }
 s.close();
}
console.log('PASS current manga owners reliable match: saved chapter/first image, cancelled/failed preparation, unknown lost response and navigation fence without target promotion');
for(const inShelf of [false,true]) {
 const wrong={...selectionTarget,book:{...selectionTarget.book,title:'另一部漫画'}};
 const s=selectionFixture('success',wrong);s.entry.inBookshelf=inShelf;
 await s.begin();assertOriginal(s);
 assert.equal(s.fetches.length,1,'same URL is acquired once before resolved metadata can be verified');
 assert.equal(s.installed.length,0);assert.equal(s.committed(),false);
 assert.equal(s.manga.selectionVisible,false);
 assert.match(s.source.failureMessage,/书名或作者.*不一致/);
 assert.equal(s.f.calls.some(call=>['manga.chapter.get','manga.sourceSwitch.commit','reading.progress.update','bookshelf.add'].includes(call[0])),false,
  'same-URL detail mismatch stops before image admission, directory selection or a durable mutation');
}
for(const reason of ['off-pane','old-version','old-scope','polluted-title','polluted-author']) {
 const s=selectionFixture(),before=s.source.state,generation=s.manga.preparationGeneration;
 let candidate=s.candidate,scope=s.source.scopeId;
 if(reason==='off-pane')candidate={...candidate,bookUrl:'another-url'};
 if(reason==='old-version')candidate={...candidate,sourceVersion:'old-rule'};
 if(reason==='old-scope')scope-=1;
 if(reason==='polluted-title'||reason==='polluted-author'){
  candidate={...candidate,...(reason==='polluted-title'?{bookName:'另一部漫画'}:{author:'其他作者'})};
  s.source.state={kind:'candidates',candidates:[candidate]};
 }
 const pane=s.source.state;
 s.switchActions.select(candidate,scope);
 if(reason==='polluted-title'||reason==='polluted-author'){
  assert.equal(s.source.state.kind,'switching','metadata qualification gives immediate feedback');
  await s.latest();assert.match(s.source.failureMessage,/书籍身份已变更/);
  assert.equal(s.f.calls.every(call=>call[0]==='source.list'),true,'only current registry qualification runs');
 }else{
  assert.equal(s.latest(),undefined,`${reason}: rejected callback cannot start preparation`);
  assert.equal(s.f.calls.length,0);assert.equal(s.source.state,pane);
  assert.equal(s.manga.preparationGeneration,generation);assert.equal(pane,before);
 }
 assert.equal(s.fetches.length,0);assert.equal(s.committed(),false);
 assertOriginal(s);
}
console.log('PASS actual current owners manga same-URL detail mismatch blocks trial/shelf before mutation; off-pane, stale scope/version and polluted current-row metadata cannot start acquisition');
for(const catalog of [selectionTarget,{...selectionTarget,entries:[
 {index:3,title:'Saved Chapter',url:'/chapter',navigable:true},
 {index:8,title:'Saved Chapter',url:'/duplicate',navigable:true},
]}]){
 const s=selectionFixture('success',catalog);await s.begin();assertOriginal(s);
 assert.equal(s.manga.selectionVisible,true,'missing or ambiguous match opens a target directory immediately');
 assert.equal(s.installed.length,0);assert.equal(s.committed(),false);
 assert.deepEqual(s.f.calls.map(call=>call[0]),['source.list','reading.progress.get','reading.progress.get']);
 const pending=s.manga.selection;
 assert.equal(pending.target,catalog);assert.equal(pending.candidate,s.candidate);
 assert.deepEqual(pending.expectedFrom,{epoch:2,revision:1});assert.equal(pending.entries.length,catalog.entries.length);
 if(catalog===selectionTarget){assert.equal(pending.entries[0].navigable,false);assert.equal(pending.entries[0].level,1);
  assert.equal(pending.entries[1].level,2);assert.equal(pending.entries[2].navigable,false);}
 assert.equal(s.callbacks.readerOwnsWindowEdges(),true);assert.equal(s.callbacks.mangaOwnsWindowEdges(),true);
 const proof={sourceId:'target',bookId:'b',catalogRevision:'catalog-v1',structureRevision:'structure-v1',nodeId:'chapter-3',chapterIndex:3,url:'/chapter'};
 await s.manga.selectMangaSourceSwitchChapter(3,proof);
 assert.equal(s.committed(),true);assert.equal(s.installed.length,1);assert.equal(s.entry.book.sourceId,'target');
 assert.equal(s.entry.requestedChapterIndex,3);assert.equal(s.manga.selectionVisible,false);
 assert.equal(s.source.visible,false);assert.ok(s.refresh()>0);
 assert.deepEqual(s.f.calls.find(call=>call[0]==='manga.chapter.get')[1].directoryTargetProof,proof);
 const commit=s.f.calls.find(call=>call[0]==='manga.sourceSwitch.commit')[1];
 assert.equal(commit.targetPageOrdinal,0);assert.deepEqual(commit.expectedFrom,{epoch:2,revision:1});
 assert.deepEqual(commit.expectedTarget,{epoch:2,revision:0});assert.equal(s.f.calls.filter(call=>call[0]==='image').length,1);
}
console.log('PASS actual current owners missing/ambiguous signal opens an independent Core-derived target catalog; one user choice commits its first page and only then installs the target reader');

{
 const s=selectionFixture();await s.begin();const pending=s.manga.selection;
 assert.equal(s.callbacks.onBackPress(),true);assertOriginal(s);assert.equal(s.committed(),false);
 assert.equal(s.manga.selectionVisible,false);assert.equal(s.manga.selection,undefined);
 assert.equal(s.source.visible,true,'Back closes the catalog choice, retaining the original source panel');
 assert.equal(s.source.state.kind,'candidates');assert.equal(s.source.state.candidates[0],s.candidate);
 assert.equal(s.manga.isMangaSourceSwitchSelectionCurrent(pending),false);
 assert.equal(s.f.calls.some(call=>call[0]==='manga.chapter.get'||call[0]==='image'||call[0]==='manga.sourceSwitch.commit'),false);
}
{
 const s=selectionFixture('image-pending');await s.begin();const selection=s.manga.selectMangaSourceSwitchChapter(3);
 await s.imageStarted.promise;await s.manga.selectMangaSourceSwitchChapter(3);
 assert.equal(s.callbacks.onBackPress(),true);assertOriginal(s);assert.equal(s.manga.selectionVisible,false);
 s.imageGate.resolve();await selection;assert.equal(s.committed(),false);assert.equal(s.installed.length,0);
 assert.equal(s.source.failureMessage,'','late cancelled first-image preparation cannot replace original context with an error');
 assert.equal(s.f.calls.filter(call=>call[0]==='manga.chapter.get').length,1,'double taps cannot issue duplicate preparation');
}
console.log('PASS actual current owners Back cancels only target catalog selection; late first-image loads and repeated taps cannot commit or disturb the original reader');

for(const phase of ['before-selection','during-image','before-dispatch']){
 const s=selectionFixture(phase==='during-image'?'image-pending':'success');await s.begin();
 if(phase==='before-selection')s.setRegistryRevision(2);
 if(phase==='before-dispatch'){
  const request=s.f.gateway.runtime.request;
  s.f.gateway.runtime.request=async(method,params,options)=>{
   if(method==='manga.sourceSwitch.commit'){
    // Controlled native scheduler boundary: registry changes after proposal
    // validation and before the actual Core send, so shouldCancel must fence it.
    s.setRegistryRevision(2);assert.equal(options.shouldCancel(),true);
    assert.equal(options.canDispatch(),false);assert.equal(options.canContinue(),false);
    throw new BookRequestNotDispatchedError('native dispatch cancelled');
   }
   return request(method,params,options);
  };
 }
 const task=s.manga.selectMangaSourceSwitchChapter(3);
 if(phase==='during-image'){await s.imageStarted.promise;s.setRegistryRevision(2);s.imageGate.resolve();}
 await task;assertOriginal(s);assert.equal(s.committed(),false);assert.equal(s.installed.length,0);
 assert.match(s.source.failureMessage,/书源配置已变更/);
 await assert.doesNotReject(s.host.assertMangaSwitchAvailable(s.original,{sourceId:s.candidate.sourceId,bookId:s.candidate.bookUrl}),'typed nondispatch never seals this book as unknown');
 assert.equal(s.manga.selectionVisible,false);assert.equal(s.manga.selectionBusy,false);
 assert.equal(s.manga.commitGeneration,-1);
 assert.equal(s.f.calls.some(call=>call[0]==='manga.sourceSwitch.commit'),false,'no Core progress transaction can dispatch under stale qualification');
 if(phase==='before-selection')assert.equal(s.f.calls.some(call=>call[0]==='manga.chapter.get'),false);
 if(phase==='during-image')assert.equal(s.f.releases.length,1,'cancelled first-image lease is released exactly once');
}
console.log('PASS actual current owners manual manga qualification remains fenced while the directory is open, during first-image IO and at native commit dispatch; errors recover without silent switching or progress mutation');

for(const mode of ['success','lost-response','invalid-ack','commit-rejected','image-failed','progress-changed']){
 const s=selectionFixture(mode);await s.begin();
 if(mode==='image-failed')s.f.fail();if(mode==='progress-changed')s.setRevision(2);
 await s.manga.selectMangaSourceSwitchChapter(3);
 if(mode==='success'){
  assert.equal(s.committed(),true);assert.equal(s.installed.length,1);assert.equal(s.entry.requestedChapterIndex,3);
 }else if(['lost-response','invalid-ack','commit-rejected'].includes(mode)){
  assertOriginal(s);assert.equal(s.installed.length,0);assert.ok(s.recoveries.at(-1),JSON.stringify({mode,calls:s.f.calls.map(([m])=>m),failures:s.failures,source:s.source.state,recoveryErrors:s.recoveryErrors}));assert.match(s.recoveries.at(-1).message,/尚未确认/);
  assert.equal(s.recoveries.at(-1).label,'核对原操作');assert.equal(s.source.visible,false);
  await assert.rejects(s.host.assertMangaSwitchAvailable(s.original,{sourceId:s.candidate.sourceId,bookId:s.candidate.bookUrl}),/原操作|核对|确认|待/);
  const writes=s.f.calls.filter(([method])=>method==='manga.sourceSwitch.commit').length;
  s.recoveries.at(-1).action();
  for(let turn=0;turn<20;turn++)await new Promise(resolve=>setImmediate(resolve));
  assert.match(s.recoveries.at(-1).message,/无法核对.*原记录已保留/);assert.equal(s.recoveries.at(-1).label,'核对原操作');assert.equal(s.installed.length,0);
  const records=await s.host.inspectMangaRecovery();assert.equal(records.length,1);assert.equal(records[0].fact,'unsupported');
  assert.equal(s.f.calls.filter(([method])=>method==='manga.sourceSwitch.commit').length,writes,'read-only recovery cannot replay write');
  await s.manga.commitMangaSourceSwitch(s.original,s.candidate,s.catalog,{firstImage:{chapterIndex:3}},()=>true);
  assert.equal(s.f.calls.filter(([method])=>method==='manga.sourceSwitch.commit').length,writes,'same Runtime prevents a new commit while the original outcome is unknown');
 }else{
  assertOriginal(s);assert.equal(s.committed(),false);assert.equal(s.installed.length,0);
  assert.equal(s.manga.failure.candidate,s.candidate);assert.equal(s.manga.failure.opening.book,s.original);
  assert.equal(s.manga.selectionVisible,false);assert.equal(s.source.visible,false);
  assert.ok(s.source.failureMessage.length>0);
  if(mode==='progress-changed'){
   assert.equal(s.f.calls.some(call=>call[0]==='image'),false);
   assert.equal(s.source.failureMessage,'阅读位置已变化，请重新选择书源');
  }
 }
}
{
 const s=selectionFixture('readback-failed');await s.begin();await s.manga.selectMangaSourceSwitchChapter(3);
 assert.equal(s.committed(),true);assert.equal(s.installed.length,0);assert.equal(s.recoveries.at(-1).label,'刷新书架');assert.match(s.recoveries.at(-1).message,/换源已保存.*读取失败/);assertOriginal(s);
 await assert.doesNotReject(s.host.assertMangaSwitchAvailable(s.original,{sourceId:s.candidate.sourceId,bookId:s.candidate.bookUrl}));
 const currentBook=await s.host.readMangaShelf('target','b',()=>true);
 assert.equal(currentBook.sourceId,'target');assert.equal(s.installed.length,0,'ordinary shelf read retains current saved progress and does not install the stale proposal');
 assert.equal(s.f.calls.filter(([method])=>method==='manga.sourceSwitch.commit').length,1);
}
{
 const s=selectionFixture('progress-changed');await s.begin();s.setRevision(2);await s.manga.selectMangaSourceSwitchChapter(3);
 s.setRevision(1);s.manga.retryFailure();await s.latest();assertOriginal(s);
 assert.equal(s.manga.selectionVisible,true);assert.equal(s.manga.selection.candidate,s.candidate);
 assert.equal(s.fetches.length,2);assert.equal(s.fetches[1][3],s.candidate,'failure retry keeps the original source candidate and request context');
}
{
 const s=selectionFixture('preparation-progress-race');await s.begin();assertOriginal(s);
 assert.equal(s.manga.selectionVisible,false);assert.equal(s.installed.length,0);
 assert.match(s.source.failureMessage,/阅读位置已变化/);
}
{
 const s=selectionFixture('commit-pending');await s.begin();const task=s.manga.selectMangaSourceSwitchChapter(3);
 await s.commitStarted.promise;assertOriginal(s);assert.equal(s.callbacks.onBackPress(),true);
 assert.equal(s.manga.selectionVisible,true,'the existing durable-commit close gate prevents falsely cancelling a possible shelf move');
 s.commitGate.resolve();await task;assert.equal(s.installed.length,1);assert.equal(s.manga.selectionVisible,false);
}
console.log('PASS actual current owners manual first-image/CAS failures preserve the old reader and retry candidate; lost responses retain the original uncertain operation without shelf inference; progress drift and in-flight durable commits are fenced');
{
 const s=selectionFixture();
 for(const code of ['MANGA_SWITCH_PROGRESS_CHANGED','MANGA_SWITCH_SELECTED_CHAPTER_INVALID',
  'MANGA_SWITCH_SOURCE_CHANGED','MANGA_SWITCH_CATALOG_CHANGED','MANGA_SWITCH_RECEIPT_INVALID',
  'MANGA_SWITCH_LANDING_INVALID','MANGA_SWITCH_INVALID','MANGA_PROGRESS_IDENTITY_MISMATCH']){
  const message=s.manga.mangaSourceSwitchFailureMessage(Error(code));
  assert.ok(message.length>0);assert.equal(message.includes('MANGA_'),false,'internal manga codes do not reach the existing product failure layer');
 }
 assert.equal(s.manga.mangaSourceSwitchFailureMessage(Error('网络请求失败')),'网络请求失败');
 const source=readFileSync(new URL('../entry/src/main/ets/app/composition/RetainedReaderScene.ets',import.meta.url),'utf8');
 assert.match(source,/sourceSwitchVisible: this\.source\.visible, sourceSwitchCovered: this\.manga\.selectionVisible/,'the admitted reader stays interaction-blocked beneath the full-screen target directory');
 assert.doesNotMatch(source,/sourceSwitchVisible: this\.source\.visible && !this\.manga\.selectionVisible/);
}
console.log('PASS internal switch errors use product messages while the original reader remains blocked beneath the target directory');

// Run the actual SDK-emitted directory Builder and its real callback closures.
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('BookDirectoryPage');
syntax.componentCollection.customComponents.add('SourceSwitchPanel');
syntax.propCollection.set('BookDirectoryPage',new Set(['sourceId','bookId','bookTitle',
 'currentChapterIndex','currentPageOrdinal','currentPageTotal','entries','catalogMessage']));
class DirectoryChild{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
{
 const s=selectionFixture('image-pending');await s.begin();
 const surfaces=new URL('../entry/src/main/ets/app/composition/ReaderSourceSwitchSurfaces.ets',import.meta.url);
 const {owner,output}=createReaderBuilderProbe(readFileSync(surfaces,'utf8'),['build'],{BookDirectoryPage:DirectoryChild});
 Object.assign(owner,{manga:s.manga,reading:s.entry,source:s.source,interactive:true});
 let selected;const tasks=[],select=s.manga.selectMangaSourceSwitchChapter.bind(s.manga);
 s.manga.selectMangaSourceSwitchChapter=(index,proof)=>{selected=[index,proof];const task=select(index,proof);tasks.push(task);return task;};
 owner.initialRender();assert.equal(owner.children.size,1);const props=[...owner.children.values()][0].params;
 assert.equal(props.sourceId,'target');assert.equal(props.bookId,'b');assert.equal(props.bookTitle,'Target Manga');
 assert.equal(props.entries,s.manga.selection.entries);
 assert.equal(props.currentChapterIndex,-1);assert.equal(props.currentPageOrdinal,-1);assert.equal(props.currentPageTotal,-1);
 assert.equal(props.onCreateChapterStartBookmark,undefined);assert.equal(props.onDownloadChapter,undefined);
 const proof={sourceId:'target',bookId:'b',catalogRevision:'catalog-v1',structureRevision:'structure-v1',nodeId:'chapter-3',chapterIndex:3,url:'/chapter'};
 props.onSelectNavigationTarget(3,987,{sourceId:'target',bookId:'b'},proof);assert.deepEqual(selected,[3,proof]);
 props.onSelectChapter(3);assert.deepEqual(selected,[3,undefined]);
 const oldSelection=s.manga.selection;
 s.manga.selection={...oldSelection,target:{...selectionTarget,identity:{sourceId:'newer',bookId:'book'}}};selected=undefined;
 props.onSelectChapter(3);props.onSelectNavigationTarget(3,0,undefined,proof);props.onBack();
 assert.equal(selected,undefined,'stale flat and Core directory callbacks cannot act on a different selection owner');
 assert.equal(s.manga.selectionVisible,true,'stale Back cannot cancel a newer target catalog');
 s.manga.selection=oldSelection;props.onBack();assertOriginal(s);assert.equal(s.manga.selectionVisible,false);
 s.imageGate.resolve();await Promise.all(tasks);assert.equal(s.committed(),false);
 assert.doesNotMatch(output,/new ReaderShell|new MangaReadingSurface|onDirectoryNavigationTargetSelected|onDirectoryChapterSelected/);
}
console.log('PASS SDK-produced target catalog uses separate source/book/title/volume props and target proof callbacks; original reader directory navigation and old page offsets are never used');
console.log('Boundary: production method and SDK Builder callback execution; no HAP, native layout, VM or device acceptance claim.');

// Trial reading uses the exact same real preparation and manual directory,
// transferring only a one-entry first-page intent. Neither book's persistent
// progress nor shelf membership can be changed before native visibility.
for (const matched of [false, true]) {
 const catalog=matched?{...selectionTarget,entries:[{index:3,title:'Saved Chapter',url:'/chapter',navigable:true}]}:selectionTarget;
 const s=selectionFixture('success',catalog),opened=s.opened;
 Object.assign(s.entry,{inBookshelf:false,mangaChapterRequestGeneration:0,mangaChapterStartRequestGeneration:-1});
 await s.begin();
 if(!matched){assertOriginal(s);assert.equal(s.manga.selectionVisible,true);
  await s.manga.selectMangaSourceSwitchChapter(3);}
 assert.equal(opened.length,1);assert.equal(opened[0].input.resumeImmediately,true);assert.equal(opened[0].retainedParent,'search');
 assert.equal(opened[0].input.validatedSession,catalog);assert.equal(s.entry.requestedChapterIndex,3);
 assert.equal(s.entry.mangaChapterStartRequestGeneration,s.entry.mangaChapterRequestGeneration);
 assert.ok(s.entry.mangaChapterStartRequestGeneration>0);
 assert.equal(s.entry.inBookshelf,false);
 assert.equal(s.committed(),false);assert.equal(s.installed.length,0);
 assert.equal(s.f.calls.some(call=>['manga.sourceSwitch.commit','bookshelf.add','reading.progress.update'].includes(call[0])),false);
 assert.deepEqual(s.original.mangaPosition,{chapterIndex:8,chapterTitle:'Saved Chapter',pageOrdinal:1,totalPages:2});
}
for(const mode of ['image-fail','image-pending']){
 const s=selectionFixture(mode),opened=s.opened;
 if(mode==='image-fail')s.f.fail();
 Object.assign(s.entry,{inBookshelf:false,mangaChapterRequestGeneration:0,mangaChapterStartRequestGeneration:-1});
 await s.begin();
 const work=s.manga.selectMangaSourceSwitchChapter(3);
 if(mode==='image-pending'){await s.imageStarted.promise;s.manga.cancelSelection();s.imageGate.resolve();}
 await work;assertOriginal(s);assert.deepEqual(opened,[]);assert.equal(s.committed(),false);
 assert.equal(s.entry.mangaChapterStartRequestGeneration,-1);
 assert.equal(s.f.calls.some(call=>['manga.sourceSwitch.commit','bookshelf.add','reading.progress.update'].includes(call[0])),false);
}
console.log('PASS actual trial manga switch: shared match/manual preparation, retained original on image failure/cancel, exact first-page generation, no pre-visibility progress/shelf mutation');

const matchedCatalog={...selectionTarget,entries:[{index:3,title:'Saved Chapter',url:'/chapter',navigable:true}]};
for(const inShelf of [false,true]){
 const s=selectionFixture('image-pending',matchedCatalog);s.entry.inBookshelf=inShelf;
 const opened=s.opened;
 const task=s.begin();await s.imageStarted.promise;
 assert.equal(s.manga.canCancelPreparation(),true);
 assert.equal(s.callbacks.onBackPress(),true);assert.equal(s.source.visible,false);
 s.imageGate.resolve();await task;assertOriginal(s);assert.equal(opened.length,0);assert.equal(s.committed(),false);
 assert.equal(s.f.calls.some(call=>['manga.sourceSwitch.commit','bookshelf.add','reading.progress.update'].includes(call[0])),false);
}
{
 const s=selectionFixture('commit-pending',matchedCatalog);const task=s.begin();await s.commitStarted.promise;
 assert.equal(s.manga.canCancelPreparation(),false);
 assert.equal(s.callbacks.onBackPress(),true);assert.equal(s.source.visible,true);
 s.commitGate.resolve();await task;assert.equal(s.installed.length,1);assert.equal(s.manga.commitGeneration,-1);
}
{
 const s=selectionFixture();s.entry.book={...s.original,contentKind:'text'};
 s.source.state={kind:'switching'};s.manga.close();assert.equal(s.source.visible,true);
}
console.log('PASS actual current owners reliable-match preparation Back cancels both trial/shelf with no late replacement; durable Core commit remains locked through settlement; novel transaction gate unchanged');
