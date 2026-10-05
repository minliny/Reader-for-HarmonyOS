import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const { MangaAdmissionGateway } = await import('../entry/src/main/ets/features/manga/MangaAdmissionGateway.ts');
const pageId=`mp1:${'a'.repeat(64)}`;
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/chapter'},sourceRuleVersion:'v',manifestVersion:'m',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId,resourceRef:`manga:${pageId}`}]};
const session={contentKind:'manga',sourceVersion:'v',identity:{sourceId:'s',bookId:'b'},entries:[{index:4,url:'/chapter'}]};
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

const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { sameRemoteSessionEvidence } = await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const { captureRemotePositionContext } = await import('../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
for (const fails of [false,true]) {
 const f=fixture();f.runtime.bookAcquisitions=()=>({readingProjectionRevision:()=>1});if(fails)f.failImage();
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['probeRemoteContentVerdict'],
  {MangaAdmissionGateway,sameRemoteSessionEvidence,captureRemotePositionContext,ReaderRuntimeOwner:{current:()=>f.runtime}});
 const owner=Object.assign(new Index(),{remoteReadingSession:session,remoteContentProbeGeneration:0,remoteContentVerdict:'verifying'});
 await owner.probeRemoteContentVerdict({},session,()=>true);
 assert.equal(owner.remoteContentVerdict,fails?'contentUnavailable':'readable');
 assert.equal(f.calls.some(c=>c[0]==='chapter.content'||c[0]==='bookshelf.add'),false);
}
console.log('PASS actual Index manga detail gate follows image success/failure without novel body or shelf writes');
{
 const messages=[];
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['downloadDirectoryChapter','downloadDirectoryBook'],{ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>false})}});
 const owner=Object.assign(new Index(),{remoteReadingSession:session,showOfflineDownloadFeedback:message=>messages.push(message)});
 owner.downloadDirectoryChapter(4);owner.downloadDirectoryBook();
 assert.equal(messages.length,2);assert.ok(messages.every(m=>m.includes('漫画离线下载尚未开放')));
 assert.equal(owner.offlineMutationActiveKey,undefined,'no legacy text queue admission');
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
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
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
 const f=fixture();const opened=[];let imageResolve;
 f.runtime.bookAcquisitions=()=>({acquireBook:async()=>session});
 if(mode==='image-fail')f.failImage();
 if(['cancel','route-away','identity-away','login-cancel'].includes(mode)){
  const load=f.runtime.loadReadingImage;
  f.runtime.loadReadingImage=async(...args)=>{
   await new Promise(resolve=>{imageResolve=resolve;});
   if(mode==='login-cancel')throw Error('MANGA_LOGIN_CANCELLED');
   return load(...args);
  };
 }
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
  ['switchPreviewSource','presentSourceSwitchAcquisitionFailure','clearMangaSourceSwitchSelection','closeSourceSwitch','canCancelMangaSourcePreparation','nextNavigationGeneration'],{
   MangaAdmissionGateway,ReaderRuntimeOwner:{current:()=>f.runtime},
  });
 const original={sourceId:'old',bookId:'old-book',contentKind:'manga'},originalToc=[{index:9,title:'原目录'}];
 const candidate={sourceId:'s',bookUrl:'b',bookName:'Book',author:'Author',category:'comic'};
 const owner=Object.assign(new Index(),{detailBook:original,detailToc:originalToc,detailReturnRoute:'search',
  route:'detail',readingSessionActive:false,sourceSwitchVisible:true,sourceSwitchState:{kind:'switching'},
  navigationGeneration:0,mangaSourceSwitchCommitGeneration:-1,consumeSystemFileOpen:()=>{},
  openRemoteBookDetail:(...args)=>opened.push(args),openReading:()=>assert.fail('failed detail switch must not start reading')});
 let failure;const current=()=>f.current()&&owner.navigationGeneration===0;
 const work=owner.switchPreviewSource(candidate,current).catch(error=>{
  failure=error;
  if(current()&&owner.route==='detail'&&owner.detailBook===original)owner.presentSourceSwitchAcquisitionFailure(original,candidate,error.message);
 });
 if(['cancel','route-away','identity-away','login-cancel'].includes(mode)){
  for(let i=0;i<20&&!imageResolve;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.ok(imageResolve,'wait for the real first-image preparation boundary');
  if(mode==='cancel'){assert.equal(owner.canCancelMangaSourcePreparation(),true);owner.closeSourceSwitch();assert.equal(owner.sourceSwitchVisible,false);}
  if(mode==='route-away')owner.route='bookshelf';
  if(mode==='identity-away')owner.detailBook={...original,bookId:'newer'};
  imageResolve();
 }
 await work;
 assert.equal(opened.length,mode==='success'?1:0);
 assert.equal(f.calls.some(call=>['bookshelf.add','manga.sourceSwitch.commit','reading.progress.update','chapter.content'].includes(call[0])),false);
 assert.equal(owner.detailToc,originalToc);
 if(mode!=='identity-away')assert.equal(owner.detailBook,original);
 if(['image-fail','login-cancel'].includes(mode)){
  assert.ok(failure);assert.equal(owner.route,'detail');assert.equal(owner.readingSessionActive,false);
  assert.equal(owner.sourceSwitchVisible,true);assert.equal(owner.sourceSwitchState.kind,'candidates');
  assert.equal(owner.sourceSwitchState.refreshError,failure.message);
 }
 if(mode==='success'){assert.equal(opened[0][6],'search');assert.equal(opened[0][7],session);
  assert.deepEqual(f.released,['file://first']);}
}
console.log('PASS actual unread manga detail source switch: first-image verification before replacement, exact route/identity/cancel fences, failed/login-cancel keeps old detail and picker, no progress/shelf/text mutation');
