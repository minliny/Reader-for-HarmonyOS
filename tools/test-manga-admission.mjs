import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const { MangaAdmissionGateway } = await import('../entry/src/main/ets/features/manga/application/MangaAdmissionGateway.ts');
const {readBookAuthorIdentity}=await import('../entry/src/main/ets/app/library/BookAuthorMetadata.ts');
const pageId=`mp1:${'a'.repeat(64)}`;
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/chapter'},sourceRuleVersion:'v',manifestVersion:'m',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId,resourceRef:`manga:${pageId}`}]};
const session={contentKind:'manga',sourceVersion:'v',identity:{sourceId:'s',bookId:'b'},detailUrl:'b',
 book:{title:'Book',author:'Author'},continuationVariables:[],hostRequirements:[],
 entries:[{index:4,title:'Chapter',url:'/chapter',variables:[]}]};
const book={sourceId:'s',bookId:'b',title:'Book',author:'Author'};
function fixture(selectedManifest=manifest){const calls=[],released=[];let current=true,failImage=false,failAdd=false;
 const runtime={supportsCoreCapability:()=>true,async request(method,params,options){calls.push([method,params]);
   if(method==='manga.chapter.get')return {data:{manifest:selectedManifest,chapterIndex:4,chapterTitle:'Chapter',cached:false,resources:[{resourceRef:selectedManifest.pages[0].resourceRef,request:{url:'https://image.test/p'}}]}};
   assert.equal(method,'bookshelf.add');assert.equal(options.shouldCancel(),false);if(failAdd)throw Error('ADD_FAILED');return {data:{created:true,sourceId:'s',bookId:'b'}};},
   async loadReadingImage(...args){calls.push(['image',args]);if(failImage)throw Error('IMAGE_FAILED');return {fileUri:'file://first',width:600,height:800,revision:'pixels'};},
   releaseReadingImage(uri){released.push(uri);}};
 return {calls,released,runtime,gateway:new MangaAdmissionGateway(runtime),current:()=>current,cancel:()=>{current=false;},failImage:()=>{failImage=true;},failAdd:()=>{failAdd=true;}};
}
{const f=fixture();await f.gateway.admit(session,book,7,f.current);assert.deepEqual(f.calls.map(c=>c[0]),['manga.chapter.get','image','bookshelf.add']);
assert.equal(f.calls[0][1].preparationRevision,7);assert.equal(f.calls[1][1][10],'v');assert.equal(f.calls[1][1][12],manifest.decodeRevision,'admission preserves the actual manifest decode fact');const add=f.calls[2][1];assert.equal(add.requireReadable,true);assert.equal(add.preparationRevision,7);assert.equal(add.mangaFirstImage.pageId,pageId);assert.equal(add.mangaFirstImage.manifestVersion,'m');assert.deepEqual(f.released,['file://first']);}
{const f=fixture();f.failImage();await assert.rejects(f.gateway.admit(session,book,7,f.current),/IMAGE_FAILED/);assert.equal(f.calls.some(c=>c[0]==='bookshelf.add'),false);}
{const f=fixture();f.failAdd();await assert.rejects(f.gateway.admit(session,book,7,f.current),/ADD_FAILED/);assert.deepEqual(f.released,['file://first']);}
{const f=fixture();f.cancel();await assert.rejects(f.gateway.admit(session,book,7,f.current),/CANCELLED/);assert.equal(f.calls.length,0);}
{const f=fixture();await assert.rejects(f.gateway.admit({...session,sourceVersion:'changed'},book,7,f.current),/SOURCE_CHANGED/);assert.equal(f.calls.length,1);}
console.log('PASS manga admission: exact intent/manifest/page/source scope, decode-before-add, no admission on failure, lease release and cancellation');
{ const calls=[],released=[];let images=0;
 const runtime={supportsCoreCapability:()=>true,async request(method,params){calls.push([method,params]);
   if(method==='manga.chapter.get')return {data:{manifest,chapterIndex:4,chapterTitle:'Chapter',cached:params.policy==='cacheFirst',resources:params.policy==='cacheFirst'?[]:[{resourceRef:manifest.pages[0].resourceRef,request:{url:'https://image.test/new'}}]}};
   return {data:{created:true}};},async loadReadingImage(){if(images++===0)throw Error('CACHE_MISS');return {fileUri:'file://renewed',width:600,height:800,revision:'pixels'};},releaseReadingImage(uri){released.push(uri);}};
 await new MangaAdmissionGateway(runtime).admit(session,book,7,()=>true);
 assert.deepEqual(calls.map(c=>c[0]),['manga.chapter.get','manga.chapter.get','bookshelf.add']);
 assert.equal(calls[1][1].expectedManifestVersion,'m');assert.equal(calls[1][1].preparationRevision,7);
 assert.deepEqual(released,['file://renewed']);
}
{ const f=fixture();await f.gateway.verify(session,f.current);assert.equal(f.calls.some(c=>c[0]==='bookshelf.add'),false);assert.deepEqual(f.released,['file://first']); }
console.log('PASS manga preview and one bounded cached-resource renewal');

const { ProductionHost: ReadingEntryHost, setRuntime: setEntryRuntime } = await import('./lib/reading-entry-owner-probe.mjs');
const { readingEntryActionFixture } = await import('./lib/reading-entry-action-fixture.mjs');
const { actualReaderDirectoryOperations } = await import('./lib/reader-directory-operations-probe.mjs');
const { mangaCurrentJourney } = await import('./lib/manga-current-journey-probe.mjs');
for (const fails of [false,true]) {
 const f=fixture();f.runtime.bookAcquisitions=()=>({readingProjectionRevision:()=>1,setPreparationVisible(){}});if(fails)f.failImage();
 const x=readingEntryActionFixture({runtime:f.runtime,route:'detail'});
 Object.assign(x.entry,{book:{...book,contentKind:'manga'},session,toc:[],inBookshelf:false});
 x.bindReader();await x.host().probe(x.entry.scopeId);
 assert.equal(x.entry.verdict,fails?'contentUnavailable':'readable');
 assert.equal(f.calls.some(c=>c[0]==='chapter.content'||c[0]==='bookshelf.add'),false);x.retire();
}
console.log('PASS actual ReadingEntryPresentation/Host manga detail gate follows image success/failure without novel body or shelf writes');
{
 const messages=[];
 const runtime={supportsCoreCapability:()=>false,request:()=>assert.fail('unsupported manga must not dispatch any text/download RPC')};
 const Operations=actualReaderDirectoryOperations();
 const scene={owner:runtime,session,book:{...book,contentKind:'manga'},retired:false,mount:1,navigation:1,presentation:1,
  sessionGeneration:1,directoryVisible:true,acceptsProjection:true,foreground:true,reading:false,offlineBusy:false};
 const operations=new Operations({scene:()=>scene,ownsRuntime:owner=>owner===runtime,feedback:message=>messages.push(message)});
 operations.downloadChapter(4);operations.downloadBook();
 assert.equal(messages.length,2);assert.ok(messages.every(m=>m.includes('漫画离线下载尚未开放')));
 assert.equal(operations.offlineOperation,undefined,'no legacy text queue admission');
}
console.log('PASS manga detail rejects legacy text download actions before queue mutation');
{
 const f=fixture();const grouped={...session,entries:[{index:0,title:'Group',url:'/group',navigable:false},...session.entries]};
 await f.gateway.verify(grouped,f.current);assert.equal(f.calls[0][1].chapterIndex,4);
 const empty=fixture();await assert.rejects(empty.gateway.verify({...grouped,entries:grouped.entries.slice(0,1)},empty.current),/CATALOG_REQUIRED/);
 assert.equal(empty.calls.length,0);
}
console.log('PASS manga admission skips non-readable groups even with URLs and refuses group-only catalogs before side effects');

// The real coordinator wrapper is part of admission. A direct Admission mock
// alone would miss an optional tail argument dropped by that wrapper.
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/features/reading/application/BookAcquisitionCoordinator.ts');
for(const decodeRevision of ['identity-v1','bytes-v1']) {
 const selectedManifest={...manifest,decodeRevision},f=fixture(selectedManifest);
 const coordinator=new BookAcquisitionCoordinator((...args)=>f.runtime.request(...args),()=>true,f.runtime);
 try {
  await coordinator.mangaGateway({},'foreground',f.current).admit(session,book,7,f.current);
  const images=f.calls.filter(c=>c[0]==='image');assert.equal(images.length,1);
  assert.equal(images[0][1][12],selectedManifest.decodeRevision,
   'actual coordinator -> Admission -> resource gateway -> Runtime owner preserves manifest decode profile');
  assert.equal(f.calls.find(c=>c[0]==='bookshelf.add')[1].mangaFirstImage.decodeRevision,selectedManifest.decodeRevision);
 } finally {coordinator.close();}
}
console.log('PASS actual BookAcquisitionCoordinator manga admission wrapper preserves both manifest decode revisions to owner argument 13 and admission receipt');

for(const mode of ['success','image-fail','cancel','route-away','identity-away','login-cancel']){
 const f=fixture();let imageResolve;
 f.runtime.bookAcquisitions=()=>({sourceRegistryRevision:()=>1,acquireBook:async()=>session,hasCurrentCatalogProjection:()=>true,
  readingProjectionRevision:()=>1,setPreparationVisible(){}});
 const request=f.runtime.request;f.runtime.request=async(method,params,options)=>{
  if(method==='source.list')return{data:{sources:['old','s'].map(sourceId=>
   ({sourceId,name:sourceId,enabled:true,sourceVersion:session.sourceVersion,bookSource:{bookSourceType:2}}))}};
  return request(method,params,options);
 };
 if(mode==='image-fail')f.failImage();
 if(['cancel','route-away','identity-away','login-cancel'].includes(mode)){
  const load=f.runtime.loadReadingImage;
  f.runtime.loadReadingImage=async(...args)=>{
   await new Promise(resolve=>{imageResolve=resolve;});
   if(mode==='login-cancel')throw Error('MANGA_LOGIN_CANCELLED');
   return load(...args);
  };
 }
 const original={sourceId:'old',bookId:'old-book',title:'Book',author:'Author',contentKind:'manga'},originalToc=[{index:9,title:'原目录'}];
 const candidate={sourceId:'s',bookUrl:'b',bookName:'Book',author:'Author',sourceVersion:session.sourceVersion,category:'comic'};
 const x=mangaCurrentJourney({runtime:f.runtime,book:original,toc:originalToc,candidate,reading:false,inShelf:false});
 const work=x.begin();assert.ok(work,'actual manga candidate callback admitted its captured operation');
 if(['cancel','route-away','identity-away','login-cancel'].includes(mode)){
  for(let i=0;i<20&&!imageResolve;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(imageResolve,'wait for the real first-image preparation boundary');
  if(mode==='cancel'){assert.equal(x.manga.canCancelPreparation(),true);x.manga.close();assert.equal(x.source.visible,false);}
  if(mode==='route-away')x.navigation.show('bookshelf');
  if(mode==='identity-away')x.entry.book={...original,bookId:'newer'};
  imageResolve();
 }
 await work;
 assert.equal(x.opened.length,mode==='success'?1:0);
 assert.equal(f.calls.some(call=>['bookshelf.add','manga.sourceSwitch.commit','reading.progress.update','chapter.content'].includes(call[0])),false);
 if(mode!=='success'){
  assert.equal(x.entry.toc,originalToc);
  if(mode!=='identity-away')assert.equal(x.entry.book,original);
 }
 if(['image-fail','login-cancel'].includes(mode)){
  const failure=x.failures.at(-1);assert.ok(failure);assert.equal(x.navigation.snapshot().route,'detail');assert.equal(x.entry.sessionActive,false);
  assert.equal(x.source.visible,true);assert.equal(x.source.state.kind,'candidates');
  assert.equal(x.source.state.refreshError,failure);
  assert.equal(failure,mode==='image-fail'?'IMAGE_FAILED':'漫画换源失败，请重试');
 }
 if(mode==='success'){
  assert.equal(x.opened[0].retainedParent,'search');assert.equal(x.opened[0].input.validatedSession,session);
  assert.deepEqual(f.released,['file://first']);assert.equal(x.entry.requestedChapterIndex,4);
  assert.equal(x.entry.mangaChapterStartRequestGeneration,x.entry.mangaChapterRequestGeneration);
  assert.equal(x.entry.book.sourceId,'s');assert.equal(x.entry.sessionActive,true);assert.equal(x.navigation.snapshot().route,'reading');
 }
 x.close();
}
console.log('PASS current manga candidate → SourceSwitchHost → Admission → SourceSwitchJourney → EntryActions/Host: first-image before real preview replacement, exact route/identity/cancel fences, failed/login-cancel keeps original detail/picker, no progress or shelf writes');
