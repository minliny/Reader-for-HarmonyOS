import assert from 'node:assert/strict';
import {createRequire,registerHooks,stripTypeScriptTypes} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {MangaDownloadActionsGateway}=await import('../entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts');
const {ReadingOfflineHost}=await import('../entry/src/main/ets/features/reading/ReadingOfflineHost.ts');
const {runtimeOwnerIdentityProbe}=await import('./lib/reader-runtime-admission-probe.mjs');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const {EMPTY_READING_DIRECTORY_RECOVERY,readingDirectoryRecovery}=await import('../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
const session={contentKind:'manga',identity:{sourceId:'source',bookId:'book'},entries:[]};
const chapter=id=>({sourceId:'source',bookId:'book',chapterId:id});
function fixture(){
 const calls=[],deleted=[],released=[];
 const rows=[{chapterIndex:2,url:'/volume',navigable:false,state:'queued',attempts:0,maxAttempts:3},
  {chapterIndex:3,url:'/active',navigable:true,state:'inProgress',attempts:1,maxAttempts:3},
  {chapterIndex:4,url:'/paused',navigable:true,state:'paused',attempts:0,maxAttempts:3},
  {chapterIndex:5,url:'/done',navigable:true,state:'completed',attempts:1,maxAttempts:3},
  {chapterIndex:6,url:'/read-cache',navigable:true,state:'cached',attempts:0,maxAttempts:0},
  {chapterIndex:7,url:'/failed',navigable:true,state:'failed',attempts:1,maxAttempts:3}];
 let retentions=[{chapter:chapter('/active'),manifestVersion:'selected-old',retainedAt:Date.now()},
  {chapter:chapter('/gone-selected'),manifestVersion:'selected-no-host-files',retainedAt:Date.now()}];
 const runtime={supportsCoreCapability:()=>true,async request(method,params){
  calls.push([method,params]);
  if(method==='cache.book.status')return {data:{...session.identity,chapters:rows.map(row=>({...row}))}};
  if(method==='manga.retention.list')return {data:{retentions:retentions.map(row=>({...row,chapter:{...row.chapter}}))}};
  if(method==='manga.retention.set'){
   assert.equal(params.retain,false);released.push(params.chapter.chapterId);
   retentions=retentions.filter(row=>row.chapter.chapterId!==params.chapter.chapterId);return {data:{retention:null}};
  }
  const operation=method.slice('cache.download.'.length);assert.ok(['pause','resume','cancel'].includes(operation));
  const row=rows.find(row=>row.chapterIndex===params.chapterIndex);assert.ok(row);
  row.state=operation==='pause'?'paused':operation==='resume'?'queued':'cancelled';
  return {data:{...session.identity,chapterIndex:row.chapterIndex,status:row.state==='queued'?'pending':row.state,
   attempts:row.attempts,maxAttempts:row.maxAttempts}};
 },async listMangaDownloadChapters(){return [chapter('/active'),chapter('/gone-partial'),chapter('/active')];},
 async listMangaDownloadVersions(c){assert.equal(released.length,0,'download inventory is read before release changes Core classification');
  return c.chapterId==='/active'?['new-partial','new-partial']:c.chapterId==='/gone-partial'?['partial-no-selected']:[];},
 async deleteMangaDownload(c,version){deleted.push([c.chapterId,version]);return version!=='new-partial';}};
 return {gateway:new MangaDownloadActionsGateway(runtime),runtime,calls,rows,deleted,released};
}
{
 const f=fixture(),snapshot=await f.gateway.snapshot(session);assert.equal(snapshot.chapters.length,5);
 assert.equal(snapshot.chapters.find(row=>row.chapterIndex===4).state,'paused');
 assert.ok(snapshot.retentions[0].retainedAt>4294967295,'valid retained millisecond timestamps are not truncated to queue u32');
 assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false,'read-only projection never resumes a paused task');
 assert.equal(f.calls.some(call=>call[0]==='manga.cache.recordRead'),false,'management does not renew read TTL');
}
{
 const f=fixture();await f.gateway.operate(session,'pause');
 assert.deepEqual(f.calls.filter(call=>call[0]==='cache.download.pause').map(call=>call[1].chapterIndex),[3,7]);
 assert.equal(f.rows.find(row=>row.chapterIndex===6).state,'cached');assert.equal(f.deleted.length,0);assert.equal(f.released.length,0);
}
{
 const f=fixture();await f.gateway.operate(session,'resume',4);
 assert.deepEqual(f.calls.filter(call=>call[0]==='cache.download.resume').map(call=>call[1].chapterIndex),[4]);
 assert.equal(f.rows.find(row=>row.chapterIndex===3).state,'inProgress');
}
{
 const f=fixture();await f.gateway.operate(session,'cancel');
 assert.deepEqual(f.calls.filter(call=>call[0]==='cache.download.cancel').map(call=>call[1].chapterIndex),[3,4,7]);
 assert.equal(f.rows.find(row=>row.chapterIndex===5).state,'completed');assert.equal(f.deleted.length,0);assert.equal(f.released.length,0);
}
console.log('PASS queue pause/resume/cancel operate on exact Core task identities, preserve group/cache/completed rows and never change retention or bytes');
{
 const f=fixture();await f.gateway.releaseRetention(session);
 assert.deepEqual(f.released,['/active','/gone-partial','/gone-selected'],'releasing book retention includes obsolete partial chapters and selected versions without Host files');
 assert.equal(f.deleted.length,0);assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false);
 assert.equal(f.calls.some(call=>call[0]==='cache.clear'),false);
}
{
 const f=fixture();await f.gateway.releaseRetention(session,3);assert.deepEqual(f.released,['/active']);assert.equal(f.deleted.length,0);
}
{
 const f=fixture(),outcome=await f.gateway.deleteDownloads(session);
 assert.deepEqual(f.deleted,[['/active','new-partial'],['/active','selected-old'],['/gone-partial','partial-no-selected'],['/gone-selected','selected-no-host-files']]);
 assert.deepEqual(outcome,{removedVersions:3,protectedVersions:1},'protected/active version returns false, never falsely reported deleted');
 assert.deepEqual(f.released,['/active','/gone-partial','/gone-selected']);assert.equal(f.calls.some(call=>call[0]==='cache.clear'),false);
}
console.log('PASS release retains bytes; exact deletion covers new partial/old selected/obsolete chapter/selected-without-files versions and keeps protected failures explicit');
{
 const f=fixture();let current=true;const request=f.runtime.request;
 f.runtime.request=async(method,params)=>{const result=await request(method,params);if(method==='cache.download.pause')current=false;return result;};
 await assert.rejects(f.gateway.operate(session,'pause',undefined,()=>current),/CANCELLED/);
 assert.equal(f.calls.filter(call=>call[0]==='cache.download.pause').length,1,'cancelled management cannot mutate more chapter tasks');
}
for(const corruption of ['book','index','status','attempts']){
 const f=fixture(),request=f.runtime.request;
 f.runtime.request=async(method,params)=>{const result=await request(method,params);if(method==='cache.download.resume'){
  if(corruption==='book')result.data.bookId='wrong';if(corruption==='index')result.data.chapterIndex=99;
  if(corruption==='status')result.data.status='unknown';if(corruption==='attempts')result.data.attempts=-1;
 }return result;};
 await assert.rejects(f.gateway.operate(session,'resume',4),/操作结果|下载状态/);
}
{
 const f=fixture();f.runtime.listMangaDownloadChapters=async()=>[chapter('/active'),{...chapter('/wrong'),bookId:'another'}];
 await assert.rejects(f.gateway.deleteDownloads(session),/归属/);assert.equal(f.deleted.length,0);
}
{
 const f=fixture();f.runtime.listMangaDownloadChapters=undefined;
 await assert.rejects(f.gateway.deleteDownloads(session),/全部下载/);assert.equal(f.deleted.length,0);
}
{
 const f=fixture();await assert.rejects(f.gateway.operate(session,'resume',2),/目标章节不可用/);
 assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false);
 await assert.rejects(f.gateway.snapshot({...session,contentKind:'text'}),/暂不可用/);
}
console.log('PASS malformed queue receipts, foreign inventories, absent full-book inventory, stale callers and disabled/group selections fail before unsafe mutation');

const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const windows=[],progressReads=[];
const runtime={};
const PrefetchOffline=class{async prefetchWindow(...args){windows.push(args.slice(0,3));return {entries:[{index:1,title:'one',downloadState:'cached'}],failedChapters:0};}};
const PrefetchRemote=class{async loadProgress(...args){progressReads.push(args);return {kind:'restored',progress:{chapterIndex:1}};}};
const prefetchSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingPrefetchHost.ts',import.meta.url),'utf8');
const ReadingPrefetchHost=new Function('ReaderRuntimeOwner','ReadingOfflineGateway','RemoteReadingFlowGateway','sameRemoteSessionEvidence','canAppendRemoteReadingCatalog','errorMessageOf',
 stripTypeScriptTypes(prefetchSource.replace(/^import[\s\S]*?;\n/gm,'')).replace(/\bexport /g,'')+';return ReadingPrefetchHost;')(
 runtimeOwnerIdentityProbe(()=>runtime),PrefetchOffline,PrefetchRemote,(a,b)=>a===b,()=>false,error=>error.message);
const Probe=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
 ['prefetchReadingWindow'],{ReadingPrefetchHost,ReaderRuntimeOwner:{current:()=>runtime},sameRemoteSessionEvidence:(a,b)=>a===b});
{
 const entries=[0,1,2].map(index=>({index,title:String(index),url:`/${index}`,navigable:true}));
 const manga={...session,entries},text={...manga,contentKind:'text'};
 const host=Object.assign(new Probe(),{mountedRuntimeOwner:runtime,shelfReceiptRetired:false,navigationGeneration:0,detailShelfAdmissionMount:0,
  readingSessionActive:true,detailBook:text.identity,remoteSessionGeneration:1,remoteReadingSession:text,detailToc:entries.map(entry=>({...entry,bookmarks:[]}))});
 await host.prefetchReadingWindow(manga,undefined,()=>true);await host.prefetchReadingWindow(manga,1);
 assert.equal(windows.length,0);assert.equal(progressReads.length,0,'manual manga shelf update cannot enter the explicit download prewarm path');
 await host.prefetchReadingWindow(text,1);assert.deepEqual(windows[0],[text,0,3]);
 assert.equal(host.detailToc.find(entry=>entry.index===1).downloadState,'cached');assert.equal(progressReads.length,0);
 await host.prefetchReadingWindow(text,undefined,()=>true);assert.equal(windows.length,2);assert.equal(progressReads.length,1,'text manual prewarm keeps its original progress/window behavior');
}
console.log('PASS actual Index manga manual shelf-update prewarm returns before progress/download RPC; text chapter window and projection behavior remain intact');

// Run the actual Index operation lifecycle with Core receipts and exact Host
// ownership at the I/O boundary. A paused read consumer is never resumed here.
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const tick=async()=>{await new Promise(resolve=>setImmediate(resolve));};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function indexFixture(){
 const f=fixture(),events=[],feedback=[],gateways=[],chapterHolds=new Map();let failUpdate=false,bookHold;
 const entries=f.rows.filter(row=>row.navigable).map(row=>({index:row.chapterIndex,title:`chapter ${row.chapterIndex}`,
  url:row.url,navigable:true,downloadState:row.state,bookmarks:[]}));
 const admitted={...session,entries};
 class Offline{
  chapterWork=new Map();
  constructor(){gateways.push(this);}
  async waitForMangaChapter(index){events.push(['chapter-drain',index]);await this.chapterWork.get(index)?.catch(()=>{});}
  async loadProjection(_session,current){assert.ok(current?.()??true);events.push('projection');return entries.map(row=>({...row,downloadState:f.rows.find(status=>status.chapterIndex===row.index).state}));}
  async prefetchChapter(s,index,current,evidence){assert.deepEqual(s.identity,admitted.identity);evidence?.dispatched();evidence?.confirmed();assert.ok(current());events.push(['download',index]);const work=(async()=>{await chapterHolds.get(index);if(!current())throw Error('cancelled');return this.loadProjection(s,current);})();this.chapterWork.set(index,work);try{return await work;}finally{this.chapterWork.delete(index);}}
  async updateMangaChapter(s,index,current,evidence){assert.deepEqual(s.identity,admitted.identity);evidence?.dispatched();evidence?.confirmed();assert.ok(current());events.push(['update',index]);if(failUpdate)throw Error('low space');return this.loadProjection(s,current);}
  async prefetchBook(s,current,progress,evidence,chapterCurrent){evidence?.dispatched();evidence?.confirmed();events.push('book');events.push(['book-guard',chapterCurrent]);await bookHold;if(!current())throw Error('cancelled');const result=await this.loadProjection(s,current);progress?.({entries:result,totalChapters:result.length,completedChapters:1});return result;}
  async clearBook(_s,_c,evidence){evidence?.dispatched();evidence?.confirmed();events.push('clear');}
 }
 const request=f.runtime.request;f.runtime.request=async(method,params)=>{events.push(method);return request(method,params);};
 const list=f.runtime.listMangaDownloadVersions;f.runtime.listMangaDownloadVersions=async(...args)=>{events.push(['versions',args[0].chapterId]);return list(...args);};
 const del=f.runtime.deleteMangaDownload;f.runtime.deleteMangaDownload=async(...args)=>{events.push(['delete',...args.slice(0,2)]);return del(...args);};
 const offlineGateway=new Offline();
 offlineGateway.pendingClearOperation=async()=>undefined;
 offlineGateway.loadDirectoryProjection=(...args)=>offlineGateway.loadProjection(...args);
 const offline=new ReadingOfflineHost({gateway:offlineGateway,mangaActions:f.gateway,ownsRuntime:()=>true});
 const Index=productionMotionMethods(indexFile,['performMangaDownloadAction','loadMangaDownloadActions',
  'downloadDirectoryChapter','downloadDirectoryBook','clearDirectoryBookOffline','requestClearDirectoryBookOffline',
  'offlineBinding','directoryOperationBindingId','isCurrentDirectoryOperationBinding','applyOwnedDirectoryEntries',
  'requestReaderBookInfo','cancelReaderExitDestination','onReaderExited','currentReaderPresentationIdentity'],{
  ReaderRuntimeOwner:{current:()=>f.runtime},hilog:{warn(){},error(){}},DOMAIN:0,errorMessageOf:e=>e.message});
 const owner=Object.assign(new Index(),{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,route:'detail',
  navigationGeneration:0,detailShelfAdmissionMount:0,remoteSessionGeneration:0,readingReadyGeneration:0,
  remoteReadingSession:admitted,detailBook:{...admitted.identity,contentKind:'manga'},detailToc:entries,
  mangaDownloadActionGeneration:0,mangaDownloadActionActiveKey:'',offlineOperationActive:false,
  readingSessionActive:false,systemFileOpenExitId:0,openRulesManagementAfterReaderExit:false,exitToDetailOriginAfterReader:false,
  getReadingOfflineHost:()=>offline,getReadingEntryHost:()=>undefined,
  mergeDirectoryBookmarks:(rows,previous)=>rows.map(row=>({...row,bookmarks:previous.find(old=>old.index===row.index)?.bookmarks??[]})),
  isKnownDetailChapter:index=>entries.some(row=>row.index===index),showOfflineDownloadFeedback:message=>feedback.push(message),
  offlineDownloadFeedback:()=> 'download progress',showChapterDownloadFailure:()=>feedback.push('download failed'),showReadingFailure:()=>feedback.push('text failure'),
  updateDirectoryChapterDownloadState:()=>{throw Error('manga must publish durable projection, never optimistic queued/failed');},
  returnToReadingOrigin(){events.push('exit-finished');this.readingSessionActive=false;},getUIContext:()=>({showAlertDialog:dialog=>owner.dialog=dialog})});
 const binding=owner.offlineBinding.bind(owner);
 owner.offlineBinding=(...args)=>({...binding(...args),failed:()=>feedback.push('download failed')});

 return {...f,admitted,owner,offline,offlineGateway,events,feedback,gateways,failUpdate:()=>{failUpdate=true;},holdBook:value=>{bookHold=value;},holdChapter:(index,value)=>chapterHolds.set(index,value),makeIntent:(chapterIndex,settled)=>{offlineGateway.waitForMangaChapter=async index=>{events.push(['chapter-drain',index]);await settled;};return {session:admitted,valid:true,generation:offline.generation,settled,excludedChapters:new Set(),continuations:new Set(),evidence:new ReaderWriteEvidence()};}};
}
{
 const f=indexFixture(),pending=deferred();
 const intent=f.makeIntent(3,pending.promise);f.offline.mangaIntent=intent;
 const pause=f.owner.performMangaDownloadAction('pause',3);await tick();
 assert.equal(intent.valid,true,'chapter pause preserves sibling consumers');assert.deepEqual([...intent.excludedChapters],[3],'only target validity is revoked after Core pause');
 assert.equal(f.events.includes('projection'),false,'do not publish/finish before old explicit intent settles');
 f.rows.find(row=>row.chapterIndex===3).state='queued';pending.resolve();await pause;
 assert.equal(f.calls.filter(call=>call[0]==='cache.download.pause').length,2,'a final admitted slice is fenced after old intent settles');
 assert.equal(f.rows.find(row=>row.chapterIndex===3).state,'paused');
 assert.equal(f.owner.detailToc.find(row=>row.index===3).downloadState,'paused');
 assert.equal(f.calls.some(call=>call[0]==='cache.download.resume'),false);assert.equal(f.deleted.length,0);
 await f.owner.loadMangaDownloadActions(3);assert.equal(f.calls.some(call=>call[0]==='cache.download.resume'),false);
 await f.owner.performMangaDownloadAction('resume',3);await tick();
 assert.deepEqual(f.events.filter(event=>Array.isArray(event)&&event[0]==='download'),[['download',3]],'only explicit resume relaunches the Host download');
}
{
 const f=indexFixture(),pending=deferred(),intent={session:f.admitted,valid:true,settled:pending.promise};
 f.offline.mangaIntent=intent;const release=f.owner.performMangaDownloadAction('releaseRetention');await tick();
 assert.equal(intent.valid,false);assert.equal(f.released.length,0,'wait for any pending download report before releasing permanent claims');
 pending.resolve();await release;assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false);
 assert.equal(f.deleted.length,0);assert.ok(f.released.includes('/gone-partial'));
}
{
 const f=indexFixture(),pending=deferred(),intent={session:f.admitted,chapterIndex:3,valid:true,settled:pending.promise};
 f.offline.mangaIntent=intent;const deletion=f.owner.performMangaDownloadAction('deleteDownloads');await tick();
 assert.equal(f.deleted.length,0);assert.equal(f.released.length,0);assert.equal(intent.valid,false);
 pending.resolve();await deletion;
 assert.deepEqual(f.deleted.map(row=>row[1]),['new-partial','selected-old','partial-no-selected','selected-no-host-files']);
 assert.match(f.feedback.at(-1),/部分内容仍在使用/);assert.equal(f.owner.detailToc.find(row=>row.index===5).downloadState,'completed');
 const versionPositions=f.events.flatMap((event,i)=>Array.isArray(event)&&event[0]==='versions'?[i]:[]);
 assert.ok(Math.max(...versionPositions)<f.events.indexOf('manga.retention.set'),'all inventories precede any release');
}
for(const cancelled of [false,true]){
 const f=indexFixture();f.owner.readingSessionActive=true;f.owner.readingExitRequest=reason=>f.events.push(['exit-request',reason]);
 await f.owner.performMangaDownloadAction('deleteDownloads',3);
 assert.deepEqual(f.events,[['exit-request','navigation']]);assert.equal(f.calls.length,0,'reading deletion only asks the established serialized exit');
 if(cancelled){f.owner.cancelReaderExitDestination(f.owner.currentReaderPresentationIdentity());f.owner.onReaderExited(f.owner.currentReaderPresentationIdentity());await tick();assert.equal(f.calls.length,0,'cancelled exit cannot delete files');}
 else{f.events.push('reader-close-released');f.owner.onReaderExited(f.owner.currentReaderPresentationIdentity());await tick();
  assert.ok(f.deleted.length>0);assert.ok(f.events.indexOf('reader-close-released')<f.events.indexOf('manga.retention.set'));
  assert.equal(f.owner.readingSessionActive,false);assert.equal(f.owner.mangaDownloadDeleteAfterExit,undefined);}
}
console.log('PASS actual Index pause fences Core before Host stop and again after settle; explicit resume only; retention release preserves bytes; deletion waits for intent and serialized reading exit, cancellation preserves content');
{
 const f=indexFixture(),chapter=deferred(),whole=deferred();
 const intent={session:f.admitted,valid:true,settled:whole.promise,excludedChapters:new Set(),continuations:new Set()};
 f.offlineGateway.waitForMangaChapter=async index=>{f.events.push(['chapter-drain',index]);await chapter.promise;};
 f.offline.mangaIntent=intent;const pause=f.owner.performMangaDownloadAction('pause',3);await tick();
 assert.equal(intent.valid,true,'pausing one chapter cannot invalidate the ongoing whole-book consumer');
 assert.deepEqual([...intent.excludedChapters],[3]);assert.equal(f.events.some(event=>Array.isArray(event)&&event[0]==='chapter-drain'),true);
 assert.equal(f.rows.find(row=>row.chapterIndex===7).state,'failed','another chapter queue fact is unaffected');
 chapter.resolve();await pause;assert.equal(intent.valid,true);assert.equal(f.offline.mangaIntent,intent);
 whole.resolve();
}
console.log('PASS actual Index chapter pause excludes and drains only its chapter while preserving the whole-book download consumer');
{
 const f=indexFixture(),pending=deferred(),intent=f.makeIntent(undefined,pending.promise);
 f.offline.mangaIntent=intent;const updating=f.owner.performMangaDownloadAction('updateChapter',3);await tick();
 assert.equal(intent.valid,true);assert.deepEqual([...intent.excludedChapters],[3]);assert.equal(f.events.some(event=>Array.isArray(event)&&event[0]==='update'),false);
 pending.resolve();await updating;await tick();
 assert.deepEqual(f.events.filter(event=>Array.isArray(event)&&event[0]==='update'),[['update',3]]);
 assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false,'explicit updater owns its own Core preparation; UI does not guess queue leases');
 const g=indexFixture();g.failUpdate();g.rows.find(row=>row.chapterIndex===5).state='completed';
 await g.owner.performMangaDownloadAction('updateChapter',5);await tick();
 assert.equal(g.owner.detailToc.find(row=>row.index===5).downloadState,'completed','failed update preserves authority for prior retained download');
 assert.ok(g.feedback.includes('download failed'));
 const invalid=indexFixture();await invalid.owner.performMangaDownloadAction('updateChapter');
 assert.equal(invalid.events.some(event=>Array.isArray(event)&&event[0]==='update'),false,'book scope never silently updates all chapters');
}
{
 const f=indexFixture();f.owner.requestClearDirectoryBookOffline();assert.match(f.owner.dialog.title,/普通阅读缓存/);
 assert.match(f.owner.dialog.message,/永久保留的下载及正在使用/);f.owner.dialog.secondaryButton.action();await tick();
 assert.equal(f.owner.detailToc.find(row=>row.index===4).downloadState,'paused');
 assert.equal(f.owner.detailToc.find(row=>row.index===5).downloadState,'completed');
 assert.deepEqual(f.events,['clear','projection'],'clear recomputes actual manga projection instead of marking all content missing');
}
{
 const f=fixture(),snapshot=await f.gateway.snapshot(session);const ids=(index,active=false)=>f.gateway.actions(snapshot,index,active).map(row=>row.id);
 assert.equal(f.gateway.actions(snapshot).find(row=>row.id==='resume').label,'继续已暂停章节');assert.equal(f.gateway.actions(snapshot,4).find(row=>row.id==='resume').label,'继续下载');
 assert.ok(ids(3).includes('updateChapter'));assert.equal(ids().includes('updateChapter'),false);
 assert.equal(ids(4).includes('downloadChapter'),false);assert.equal(ids(4).includes('updateChapter'),false,'paused tasks must explicitly continue');
 assert.ok(ids(4).includes('resume'));assert.equal(ids(3,true).includes('updateChapter'),false);
 assert.ok(ids(3,true).includes('pause'),'busy downloads retain pause');assert.ok(ids(3,true).includes('cancel'),'busy downloads retain cancel');assert.ok(ids(4,true).includes('resume'),'only explicit continue remains available while siblings download');assert.ok(ids(undefined,true).includes('pause'));assert.ok(ids(undefined,true).includes('cancel'));
 assert.equal(ids(5).includes('downloadChapter'),false);assert.ok(ids(6).includes('downloadChapter'));
}
console.log('PASS explicit chapter update waits for old intent, never updates a book implicitly and failed update preserves completed authority; normal cache clear retains paused/downloaded status; menu distinguishes cache, pause and permanent ownership');

const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const fonts=await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const {mangaDirectoryPresentation}=await import('../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts');
const {sameReaderDirectoryData}=await import('../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts');
const {readerDirectoryAccessibilityText}=await import('../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
function component(name,relative){const source=readFileSync(new URL(relative,import.meta.url),'utf8');syntax.componentCollection.customComponents.add(name);
 syntax.propCollection.set(name,new Set([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>m[1])));return source;}
const panelSource=component('MangaDownloadOperationsPanel','../entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets');
{
 const ts=require(`${sdk}/node_modules/typescript`);
 const common=ts.createSourceFile('common.d.ts',readFileSync(`${sdk}/declarations/common.d.ts`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const methods=common.statements.find(node=>node.name?.getText(common)==='CommonMethod');
 assert.ok(methods,'official SDK CommonMethod declarations are available');
 const reserved=new Set(methods.members.map(node=>node.name?.getText(common)).filter(Boolean));
 assert.ok(reserved.has('foregroundColor')&&reserved.has('backgroundColor'));
 for(const name of syntax.propCollection.get('MangaDownloadOperationsPanel'))
  assert.equal(reserved.has(name),false,`download business Prop ${name} cannot shadow an inherited official SDK component method`);
}

const navListSource=component('ReaderDirectoryNavigationList','../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets');
const navSurfaceSource=component('ReaderDirectoryNavigationSurface','../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets');
const bookSource=component('BookDirectoryPage','../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets');
const fallbackSource=component('MangaReadingDirectoryFallback','../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets');
const readingSource=component('MangaReadingSurface','../entry/src/main/ets/features/manga/MangaReadingSurface.ets');
{
 const ts=require(`${sdk}/node_modules/typescript`);
 const common=ts.createSourceFile('common.d.ts',readFileSync(`${sdk}/declarations/common.d.ts`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const click=common.statements.find(node=>node.name?.getText(common)==='ClickEvent');
 const popup=common.statements.find(node=>node.name?.getText(common)==='CustomPopupOptions');
 assert.ok(click&&popup,'installed official event/popup declarations are present');
 assert.equal(click.members.some(node=>node.name?.getText(common)==='stopPropagation'),false);
 assert.equal(popup.members.some(node=>node.name?.getText(common)==='enableArrow'),true);
 assert.equal(popup.members.some(node=>node.name?.getText(common)==='showArrow'),false);
 for(const source of [navListSource,bookSource,fallbackSource])assert.doesNotMatch(source,/event\.stopPropagation\(\)|monopolizeEvents\(/,
  'directory action isolation uses sibling click regions, not a missing ClickEvent API or exclusive parent gesture capture');
}
{
 const called=[],{owner}=createReaderBuilderProbe(panelSource,['build','ink','paper'],fonts);
 Object.assign(owner,{actions:[{id:'pause',label:'暂停下载'},{id:'updateChapter',label:'更新本话'}],loading:false,failureMessage:'',
  appThemeScheme:'day',panelInkColor:'#ink',panelPaperColor:'#paper',onAction:id=>called.push(id)});
 owner.initialRender();const buttons=[...owner.nodes.values()].filter(row=>row.type==='Button');assert.equal(buttons.length,2);
 for(const button of buttons){assert.equal(button.height,48);assert.equal(button.fontSize,13);assert.equal(button.borderRadius,14);
  assert.equal(button.fontColor,'#ink');assert.equal(button.backgroundColor,'#paper');button.onClick();}
 assert.deepEqual(called,['pause','updateChapter']);
 const retry=createReaderBuilderProbe(panelSource,['build','ink','paper'],fonts).owner;let retried=0;
 Object.assign(retry,{actions:[],loading:false,failureMessage:'读取失败',appThemeScheme:'day',panelInkColor:'',panelPaperColor:'',onRetry:()=>retried++});
 retry.initialRender();[...retry.nodes.values()].find(row=>row.type==='Button').onClick();assert.equal(retried,1);
}
{
 const ts=require(`${sdk}/node_modules/typescript`);
 const tree=ts.createSourceFile('MangaReadingSurface.ets',readingSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdk}/lib/ets_checker.js`).compilerOptions);
 const surface=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
 // Mirror the SDK's declaration prepass for inactive sibling sheet builders;
 // execute the unchanged download branch and keep all transform diagnostics.
 for(const member of surface.members) if(member.getText(tree).includes('@Builder'))
  require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(member.name.getText(tree));
 const {mangaSurfaceSdkDependencies}=await import('./lib/manga-surface-sdk-probe.mjs');
 const called=[],{owner}=createReaderBuilderProbe(readingSource,['panelOverlay'],{...fonts,...mangaSurfaceSdkDependencies,MangaDownloadOperationsPanel:Child});
 const actions=[{id:'pause',label:'暂停下载'}];
 Object.assign(owner,{panel:'downloads',panelOffset:0,panelScrimOpacity:1,downloadActions:actions,
  downloadActionsLoading:false,downloadActionsFailure:'',downloadActionsChapterIndex:7,backgroundPreference:'paper',
  widePanel:()=>false,panelTitle:()=> '下载管理',panelContentInset:()=>18,panelContentHeight:()=>600,panelWidth:()=>400,
  panelInsets:()=>({left:0,right:0,top:0,bottom:0}),inkColor:()=> '#ink',paperColor:()=> '#paper',surfaceColor:()=> '#surface',
  performDownloadAction:id=>called.push(['action',id]),openDownloadActions:index=>called.push(['retry',index])});
 owner.panelOverlay();const props=[...owner.children.values()].find(child=>child.params?.actions===actions)?.params;
 assert.ok(props,'the actual reading sheet renders its download child');
 assert.equal(props.panelInkColor,'#ink');assert.equal(props.panelPaperColor,'#paper');
 assert.equal(props.loading,false);assert.equal(props.failureMessage,'');
 props.onAction('pause');props.onRetry();assert.deepEqual(called,[['action','pause'],['retry',7]]);
}
const downloadMethods=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets',import.meta.url),['canDownloadTarget','downloadTarget']);
const targetNode={nodeId:'target',kind:'target',title:'Chapter',depth:1,chapterIndex:7,hasChildren:false,expanded:false};
const mangaRowNames=['mangaRow','selectMangaRow','mangaColor','displayLevel','mangaGroupNode','mangaGroupSpacing','mangaRowIndex','mangaRowPaddingLeft','isCurrentMangaNode'];
for(const state of ['missing','cached','queued','paused','inProgress','completed','failed','cancelled','unknown']){
 const calls=[],owner=createReaderBuilderProbe(navListSource,mangaRowNames,fonts).owner;
 Object.assign(owner,{view:{viewId:'view'},mangaScheme:'day',appThemeScheme:'day',mangaSearchActive:false,mangaCatalogDisplay:false,
  mangaCatalogNarrow:false,mangaRowMinHeight:58,currentChapterIndex:-1,interactionEnabled:true,mangaPresentationRevision:0,
  chapterDownloadEnabled:true,chapterDownloadActionsEnabled:true,chapterByIndex:new Map([[7,{index:7,navigable:true,downloadState:state}]]),
  dataSource:{currentView:()=>owner.view,loadedItemById:()=>({node:targetNode,index:0})},selectTarget:()=>calls.push('read'),
  canDownloadTarget:downloadMethods.prototype.canDownloadTarget.bind(owner),downloadTarget:node=>calls.push(node.chapterIndex)});
 owner.mangaRow({node:targetNode,index:0,key:'target'});
 const button=[...owner.nodes.values()].find(row=>row.accessibilityText==='管理本章下载');
 if(state==='unknown'){assert.equal(button,undefined);continue;}
 assert.equal(button.enabled,true,`${state} can open chapter management`);
 const container=[...owner.nodes.values()].find(row=>row.type==='Row');assert.equal(container.onClick,undefined,'action has no chapter-selecting Row ancestor');
 button.onClick();assert.deepEqual(calls,[7],'management marker does not also select chapter');
 const body=[...owner.nodes.values()].find(row=>row.type==='Column'&&row.onClick);assert.ok(body);
 body.onClick();assert.deepEqual(calls,[7,'read'],'the sibling title still selects the chapter');
 const arrow=[...owner.nodes.values()].find(row=>row.type==='Image'&&String(row.create).includes('chevron_right'));assert.ok(arrow);
 arrow.onClick();assert.deepEqual(calls,[7,'read','read'],'the sibling right arrow still selects the chapter');
 owner.interactionEnabled=false;body.onClick();arrow.onClick();assert.deepEqual(calls,[7,'read','read'],'disabled directory interaction cannot select through either moved callback');
 owner.interactionEnabled=true;
 const image=[...owner.nodes.values()].find(row=>row.type==='Image'&&String(row.create).includes('marker'));
 assert.equal(image.create,`app.media.reader_directory_marker_${state==='completed'?'check':'download'}`);
 assert.deepEqual([image.width,image.height],[15,15]);
 const standard=createReaderBuilderProbe(navListSource,['row','displayLevel']).owner;
 Object.assign(standard,{appThemeScheme:'day',rowHeight:40,view:{viewId:'view'},isCurrentNode:()=>false,interactionEnabled:true,
  chapterDownloadEnabled:true,chapterDownloadActionsEnabled:false,chapterByIndex:owner.chapterByIndex,
  canDownloadTarget:downloadMethods.prototype.canDownloadTarget.bind(standard),toggleNode(){},selectTarget(){},downloadTarget:()=>calls.push('text')});
 standard.row({node:targetNode,index:0,key:'target'});const oldMarker=[...standard.nodes.values()].find(row=>row.accessibilityText==='下载章节'||row.accessibilityText==='已下载');
 assert.equal(oldMarker.enabled,['missing','cached','failed','cancelled'].includes(state),'novel default action availability stays unchanged');
}
{
 const resolves=[],downloads=[],owner=Object.assign(new downloadMethods(),{view:{viewId:'view'},sourceId:'source',bookId:'book',mounted:true,generation:0,
  interactionEnabled:true,chapterDownloadEnabled:true,chapterDownloadActionsEnabled:true,chapterByIndex:new Map([[7,{downloadState:'paused',navigable:true}]]),
  gateway:{resolveTarget:(...args)=>{resolves.push(args);return Promise.resolve({chapterIndex:7});}},onDownloadChapter:index=>downloads.push(index),onInvalidated(){}});
 owner.downloadTarget(targetNode);await tick();assert.deepEqual(downloads,[7]);assert.deepEqual(resolves[0].slice(0,3),['book','view','target']);
 owner.downloadTarget({...targetNode,kind:'group'});assert.equal(resolves.length,1);
}
{
 const owner=createReaderBuilderProbe(navSurfaceSource,['build','fallbackBuilder'],{ReaderDirectoryNavigationList:Child}).owner;
 let selected;Object.assign(owner,{view:{visibleTotal:1},chapterDownloadEnabled:true,chapterDownloadActionsEnabled:true,
  onDownloadChapter:index=>selected=index});owner.initialRender();const child=[...owner.children.values()][0];
 assert.equal(child.params.chapterDownloadEnabled,true);assert.equal(child.params.chapterDownloadActionsEnabled,true);
 child.params.onDownloadChapter(7);assert.equal(selected,7);
}
console.log('PASS actual SDK operation buttons reuse 48/13/theme geometry; manga queued/paused/completed markers open management without chapter taps, preserve Core target proof and novel marker rules');

const BookActions=productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets',import.meta.url),
 ['openDownloadActions','performDownloadAction','identity','onIdentityChanged']);
{
 const pending=deferred(),calls=[],owner=Object.assign(new BookActions(),{mounted:true,mangaDownloadEnabled:true,contentKind:'manga',sourceId:'source',bookId:'book',
  downloadMenuGeneration:0,downloadMenuIdentity:'',onLoadDownloadActions:()=>pending.promise,onDownloadAction:async(...args)=>calls.push(args),onEntriesChanged(){}});
 const opening=owner.openDownloadActions(7);owner.bookId='changed';owner.onIdentityChanged();pending.resolve([{id:'pause',label:'暂停下载'}]);await opening;
 assert.equal(owner.downloadMenuVisible,false);assert.deepEqual(owner.downloadActions,[]);owner.performDownloadAction('pause');assert.deepEqual(calls,[]);
 owner.onLoadDownloadActions=async()=>[{id:'pause',label:'暂停下载'}];await owner.openDownloadActions(11);owner.performDownloadAction('pause');await tick();
 assert.deepEqual(calls,[['pause',11]]);assert.equal(owner.downloadMenuVisible,false);
}
for(const source of [bookSource,fallbackSource]){
 const isBook=source===bookSource,methods=isBook?['mangaFlatRow','selectMangaEntry']:['row','mangaColor','rowFontFamily'];
 const owner=createReaderBuilderProbe(source,methods,{...fonts,readerDirectoryAccessibilityText,sameReaderDirectoryData}).owner;
 const entry={index:7,title:'Chapter',level:1,navigable:true,downloadState:'paused'},calls=[],read=[];
 Object.assign(owner,{appThemeScheme:'day',mangaScheme:'day',searchQuery:'',query:'',currentChapterIndex:-1,
  mangaDownloadEnabled:true,chapterDownloadEnabled:true,rowHeight:58,mangaCatalogDisplay:false,mangaCatalogNarrow:false,
  admittedIdentity:'source\0book',mounted:true,entries:[entry],admittedEntries:[entry],projectedEntries:[entry],identity:()=>owner.admittedIdentity,
  mangaGroupFor:()=>undefined,mangaIsGroup:()=>false,rowPresentation:()=>undefined,groupSpacing:()=>0,groupExpanded:()=>false,mangaCollapsedGroups:[],
  openDownloadActions:index=>{calls.push(index);return Promise.resolve();},onDownloadChapter:index=>calls.push(index),selectEntry:()=>read.push(7),
  rowIsCurrent:()=>true,onSelectChapter:index=>read.push(index)});
 if(isBook)owner.mangaFlatRow(entry,owner.admittedIdentity);else owner.row(entry,owner.admittedIdentity);
 const marker=[...owner.nodes.values()].find(row=>row.accessibilityText==='管理本章下载');assert.ok(marker);
 const container=[...owner.nodes.values()].find(row=>row.type==='Row');assert.equal(container.onClick,undefined,'flat action has no chapter-selecting Row ancestor');
 marker.onClick();assert.deepEqual(calls,[7]);assert.deepEqual(read,[]);
 const body=[...owner.nodes.values()].find(row=>row.type==='Column'&&row.onClick);assert.ok(body);body.onClick();assert.deepEqual(read,[7]);
 owner.entries=[{...entry,title:'Different chapter'}];marker.onClick();assert.deepEqual(calls,[7],'stale catalog facts lose download action authority');
}
{
 const owner=createReaderBuilderProbe(bookSource,['mangaFlatRow','selectMangaEntry','mangaIsGroup'],{sameReaderDirectoryData}).owner;
 const group={index:2,title:'Volume',navigable:false,level:1};
 Object.assign(owner,{appThemeScheme:'day',searchQuery:'',currentChapterIndex:-1,mangaDownloadEnabled:true,
  admittedIdentity:'source\0book',mounted:true,entries:[group],admittedEntries:[group],identity:()=>owner.admittedIdentity,
  mangaGroupFor:()=>undefined,mangaPresentation:mangaDirectoryPresentation([group,{index:3,title:'Chapter',navigable:true,level:2}]),mangaCollapsedGroups:[],onSelectChapter(){throw new Error('a volume is not a chapter');}});
 owner.mangaFlatRow(group,owner.admittedIdentity);
 const body=[...owner.nodes.values()].find(row=>row.type==='Column'&&row.onClick);
 const disclosure=[...owner.nodes.values()].find(row=>row.type==='Text'&&row.width===24);
 assert.ok(body);assert.ok(disclosure);assert.equal([...owner.nodes.values()].find(row=>row.type==='Row').onClick,undefined);
 body.onClick();assert.deepEqual(owner.mangaCollapsedGroups,[2],'volume title still folds');
 disclosure.onClick();assert.deepEqual(owner.mangaCollapsedGroups,[],'volume indicator still unfolds');
 owner.entries=[{...group,title:'Different volume'}];disclosure.onClick();assert.deepEqual(owner.mangaCollapsedGroups,[],'stale volume callbacks cannot fold a new catalog');
}
{
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {READER_MANGA_DOWNLOAD_POPUP}=await import('../entry/src/main/ets/features/common/ReaderMangaDownloadPopupSpec.ts');
 const popupSource=component('ReaderMangaDownloadPopup','../entry/src/main/ets/features/common/ReaderMangaDownloadPopup.ets'),p=boundedSurfaceSdk();
 Object.assign(p.deps,fonts,{READER_MANGA_DOWNLOAD_POPUP,Placement:{BottomLeft:'bottom-left'}});
 p.hooks.childSources.MangaDownloadOperationsPanel=panelSource;p.hooks.childSources.ReaderMangaDownloadPopup=popupSource;
 p.deps.MangaDownloadOperationsPanel=createReaderBuilderProbe(panelSource,boundedMembers(panelSource),p.deps,p.hooks).Component;
 p.deps.ReaderMangaDownloadPopup=createReaderBuilderProbe(popupSource,boundedMembers(popupSource),p.deps,p.hooks).Component;
 const owner=createReaderBuilderProbe(bookSource,['mangaDownloadMenuButton','identity'],p.deps,p.hooks).owner;
 let opened=0;Object.assign(owner,{mounted:true,sourceId:'source',bookId:'book',mangaDownloadEnabled:true,appThemeScheme:'day',
  downloadMenuVisible:false,downloadMenuGeneration:2,downloadActions:[],downloadActionsLoading:false,downloadActionsFailure:'',
  contentFrame:()=>({width:180}),openDownloadActions:async()=>opened++});
 owner.mangaDownloadMenuButton();const marker=p.nodes(owner).find(row=>row.accessibilityText==='漫画下载管理');assert.ok(marker);
 marker.onClick();await tick();assert.equal(opened,1);assert.equal(marker.bindPopup[1].enableArrow,false);assert.equal(marker.bindPopup[1].showArrow,undefined);
 owner.downloadMenuVisible=true;owner.downloadMenuGeneration++;marker.bindPopup[1].onStateChange({isVisible:false});
 assert.equal(owner.downloadMenuVisible,true,'old native closing generation cannot close the newer opening');
 owner.bookId='successor';marker.onClick();await tick();assert.equal(opened,1,'old anchor captures the original parent book identity');
 owner.bookId='book';owner.mounted=false;marker.onClick();await tick();assert.equal(opened,1,'unmounted parent cannot reopen the native popup');
}
console.log('PASS actual detail/fallback SDK chapter markers and book menu route to exact scoped management; stale catalog/identity, cancelled loads and failed promises cannot change a newer page');

const shellSource=readFileSync(new URL('../entry/src/main/ets/features/shell/ReaderShell.ets',import.meta.url),'utf8');
{
 const calls=[],{owner}=createReaderBuilderProbe(shellSource,['mangaSurface','mangaIdentityKey'],
  {MangaReadingSurface:Child,ReaderRuntimeOwner:{current:()=>({})}});
 const projection=[{index:7,title:'Chapter',downloadState:'paused'}];
 Object.assign(owner,{contentKind:'manga',sourceId:'source',bookId:'book',readingReadyGeneration:1,mangaChapterRequestGeneration:0,
  requestedChapterIndex:undefined,visible:true,tocEntries:projection,mangaDownloadEnabled:true,directoryCurrentChapterIndex:7,
  keepsMangaReadingSession:()=>true,onLoadMangaDownloadActions:async index=>{calls.push(['load',index]);return [];},
  onMangaDownloadAction:async(...args)=>calls.push(['action',...args]),onDownloadChapter:index=>calls.push(['chapter',index]),
  onDownloadBook:()=>calls.push(['book'])});
 owner.mangaSurface();const props=[...owner.children.values()][0].params;
 assert.equal(props.downloadEnabled,true);assert.equal(props.directoryProjection,projection);
 await props.onLoadDownloadActions(7);await props.onDownloadAction('pause',7);props.onDownloadChapter();props.onDownloadBook();
 assert.deepEqual(calls,[['load',7],['action','pause',7],['chapter',7],['book']]);
 owner.requestedChapterIndex=11;await props.onLoadDownloadActions(7);await props.onDownloadAction('cancel',7);props.onDownloadChapter();props.onDownloadBook();
 assert.equal(calls.length,4,'all retained download callbacks reject a replaced reader key');
}
{
 const deps=await import('./lib/manga-surface-sdk-probe.mjs');
 const calls=[],owner=createReaderBuilderProbe(readingSource,['directoryBody','directoryFallback','directoryEntries'],deps.mangaSurfaceSdkDependencies).owner;
 const entries=[{index:2,title:'Volume',navigable:false,level:1},{index:7,title:'Chapter',navigable:true,level:2},{index:9,title:'Renamed chapter',navigable:true,level:2}];
 Object.assign(owner,{sourceId:'source',bookId:'book',remoteSession:{entries},downloadEnabled:true,
  directoryProjection:[{index:7,title:'Chapter',downloadState:'paused'},{index:9,title:'Other title',downloadState:'completed'}],
  directoryQuery:'',directoryAscending:true,directoryRevision:0,directoryOpenRevision:0,publishedManifestVersion:'version',
  backgroundPreference:'paper',widePanel:()=>false,panelPhase:'open',stageWidth:500,panelContentHeight:()=>700,
  openDownloadActions:async index=>calls.push(index)});
 owner.directoryBody(false);owner.directoryFallback(false);
 const [tree,flat]=[...owner.children.values()].map(row=>row.params);
 assert.equal(tree.chapterDownloadEnabled,true);assert.equal(tree.chapterDownloadActionsEnabled,true);
 assert.equal(flat.chapterDownloadEnabled,true);assert.equal(tree.chapterEntries[0].navigable,false);assert.equal(tree.chapterEntries[1].level,2);
 assert.equal(tree.chapterEntries[1].downloadState,'paused');assert.equal(tree.chapterEntries[2].downloadState,'unknown','same ordinal with different title is not a download fact');
 tree.onDownloadChapter(7);flat.onDownloadChapter(9);await tick();assert.deepEqual(calls,[7,9]);
}
{
 const owner=createReaderBuilderProbe(readFileSync(indexFile,'utf8'),['externalDirectory','directoryRecovery'],
  {BookDirectoryPage:Child,EMPTY_READING_DIRECTORY_RECOVERY,readingDirectoryRecovery,
    ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>true})}}).owner;
 const calls=[];Object.assign(owner,{detailBook:{sourceId:'source',bookId:'book',title:'Title',contentKind:'manga'},detailToc:[],
  directoryOperationPresentationId:()=>'',directoryOperation:undefined,offlineOperation:undefined,
  loadMangaDownloadActions:async index=>{calls.push(['load',index]);return [];},performMangaDownloadAction:async(...args)=>calls.push(['action',...args])});
 owner.externalDirectory();const props=[...owner.children.values()][0].params;
 assert.equal(props.mangaDownloadEnabled,true);await props.onLoadDownloadActions(7);await props.onDownloadAction('pause',7);
 assert.deepEqual(calls,[['load',7],['action','pause',7]]);
}
console.log('PASS actual SDK Index→Shell→manga surface/catalog ports preserve projected Core download states, chapter scope and old-reader callback identity fences');
{
 const calls=[],owner=createReaderBuilderProbe(readingSource,['morePanel','option'],fonts).owner;
 Object.assign(owner,{downloadEnabled:true,title:'Chapter',opened:true,offline:false,inBookshelf:true,inkColor:()=> '#ink',paperColor:()=> '#paper',
  performPanelAction:async action=>{await action();return true;},onDownloadChapter:()=>calls.push('chapter'),
  onDownloadBook:()=>calls.push('book'),openDownloadActions:async()=>calls.push('manage')});
 owner.morePanel();const label=button=>Array.isArray(button.createWithLabel)?button.createWithLabel[0]:button.createWithLabel;
 const buttons=[...owner.nodes.values()].filter(row=>row.type==='Button');
 for(const text of ['下载本话','下载全部章节','下载管理']){
  const button=buttons.find(row=>label(row)===text);assert.ok(button,`${text} has a real product entry`);
  assert.deepEqual([button.height,button.fontSize,button.borderRadius],[48,13,14]);button.onClick();
 }
 await tick();assert.deepEqual(calls,['chapter','book','manage']);
}
console.log('PASS actual manga more-sheet download chapter/book/management entries keep existing option geometry and dispatch each production port');

{
 const f=indexFixture();f.rows.find(row=>row.chapterIndex===3).state='completed';
 f.owner.detailToc.find(row=>row.index===3).downloadState='completed';
 const original=f.owner.mergeDirectoryBookmarks;
 f.owner.mergeDirectoryBookmarks=(rows,previous)=>original(rows,previous);
 const actions=await f.owner.loadMangaDownloadActions(3);
 assert.equal(actions.some(action=>action.id==='downloadChapter'),false,'selected and usable completion offers no redundant download');
 // Core queue receipt stays completed, while the existing Host projection
 // rejects a damaged/missing byte set. Run the real method with only I/O altered.
 const physicalProjection=f.offlineGateway.loadProjection.bind(f.offlineGateway);
 f.offlineGateway.loadProjection=async(...args)=>(await physicalProjection(...args)).map(row=>row.index===3?{...row,downloadState:'cached'}:row);
 const owner=f.owner;
 const repaired=await owner.loadMangaDownloadActions(3);
 assert.ok(repaired.some(action=>action.id==='downloadChapter'),'raw completed plus Host damage allows explicit repair');
 assert.equal(owner.detailToc.find(row=>row.index===3).downloadState,'cached');
 assert.equal(f.rows.find(row=>row.chapterIndex===3).state,'completed','presentation never rewrites the shared Core queue');
 assert.equal(f.calls.some(call=>call[0].startsWith('cache.download.')),false);
}
console.log('PASS actual Index management consumes existing exact Host projection for completed/released/damaged facts without mutating queue or adding image validation');
console.log('Boundary: current production methods and SDK-emitted Builder callbacks; native layout/HAP/VM/user acceptance remain separate.');

// Actual Index starts and finishes the explicit consumer. The gateway remains
// only the I/O boundary, exposing a held chapter for the production drain.
{
 const f=indexFixture(),main=deferred(),resumed=deferred();f.holdBook(main.promise);
 f.owner.downloadDirectoryBook();await tick();const intent=f.offline.mangaIntent;
 await f.owner.performMangaDownloadAction('pause',3);
 assert.equal(intent.valid,true);assert.deepEqual([...intent.excludedChapters],[3]);
 f.holdChapter(3,resumed.promise);await f.owner.performMangaDownloadAction('resume',3);
 assert.equal(intent.continuations.size,1,'explicit continued chapter stays in the original intent lifecycle');
 assert.equal(intent.excludedChapters.has(3),false);assert.equal(f.events.filter(event=>Array.isArray(event)&&event[0]==='download').length,1);
 main.resolve();await tick();assert.equal(f.offline.mangaIntent,intent,'primary book completion waits for its continued chapter');
 assert.equal(f.offline.busy(),true);
 const pausing=f.owner.performMangaDownloadAction('pause',3);await tick();
 assert.equal(intent.valid,true);assert.equal(intent.excludedChapters.has(3),true);assert.notEqual(f.owner.mangaDownloadActionActiveKey,'');
 assert.equal(f.owner.detailToc.find(row=>row.index===3).downloadState,'queued','no success projection before resumed Host consumer drains');
 resumed.resolve();await pausing;await intent.settled;
 assert.equal(f.offline.mangaIntent,undefined);assert.equal(f.offline.busy(),false);
 assert.equal(f.calls.filter(call=>call[0]==='cache.download.resume').length,1,'pause cannot resume itself');
}
{
 const f=indexFixture(),main=deferred(),resumed=deferred();f.holdBook(main.promise);f.holdChapter(4,resumed.promise);
 f.owner.downloadDirectoryBook();await tick();const intent=f.offline.mangaIntent;
 await f.owner.performMangaDownloadAction('resume',4);main.resolve();await tick();
 let settled=false;const cancelling=f.owner.performMangaDownloadAction('cancel').then(()=>settled=true);await tick();
 assert.equal(intent.valid,false,'book cancellation invalidates every explicit consumer');assert.equal(settled,false,'whole-book cancellation drains the supplemental caller too');
 resumed.resolve();await cancelling;await intent.settled;
 assert.equal(f.offline.mangaIntent,undefined);assert.equal(f.offline.busy(),false);
}
console.log('PASS actual Index continue joins the existing whole-book intent; chapter pause drains only its supplemental caller and whole-book cancel drains all continuations');
{
 const f=indexFixture(),primary=deferred(),other=deferred();f.holdChapter(3,primary.promise);f.holdChapter(4,other.promise);
 f.owner.downloadDirectoryChapter(3);await tick();const intent=f.offline.mangaIntent;
 await f.owner.performMangaDownloadAction('resume',4);
 const pause=f.owner.performMangaDownloadAction('pause',3);await tick();
 assert.equal(intent.valid,true);assert.deepEqual([...intent.excludedChapters],[3]);assert.equal(intent.continuations.size,1);
 primary.resolve();await pause;await tick();assert.equal(f.offline.mangaIntent,intent,'a separate continued chapter remains live after primary pause');
 other.resolve();await intent.settled;assert.equal(f.offline.mangaIntent,undefined);
 const g=indexFixture(),held=deferred();g.holdChapter(3,held.promise);g.owner.downloadDirectoryChapter(3);await tick();const original=g.offline.mangaIntent;
 await g.owner.performMangaDownloadAction('cancel',7);assert.equal(original.valid,true);assert.deepEqual([...original.excludedChapters],[7]);
 assert.equal(g.events.filter(event=>Array.isArray(event)&&event[0]==='download').length,1,'cancelling another chapter cannot restart or stop the independent caller');
 const foreign={...g.admitted,identity:{sourceId:'other-source',bookId:'other-book'}};
 await g.offline.prepareMangaMutation({...g.owner.offlineBinding(g.runtime,g.admitted),session:foreign});assert.equal(original.valid,true);assert.deepEqual([...original.excludedChapters],[7]);
 held.resolve();await original.settled;
}
console.log('PASS actual Index target cancellation leaves an independent chapter and foreign-book intent intact; cancelling primary preserves another continued chapter');
{
 const f=indexFixture(),main=deferred(),resumed=deferred();f.holdBook(main.promise);f.holdChapter(4,resumed.promise);
 f.owner.downloadDirectoryBook();await tick();const intent=f.offline.mangaIntent;
 await f.owner.performMangaDownloadAction('resume',4);main.resolve();await tick();
 const oldProjection=f.owner.detailToc;
 f.owner.remoteSessionGeneration++;
 f.owner.remoteReadingSession=undefined;f.owner.remoteReadingSession=f.admitted;
 resumed.resolve();await intent.settled;
 assert.equal(f.owner.detailToc,oldProjection,'same-book round trip cannot republish an old supplemental caller');
 assert.equal(f.feedback.includes('download failed'),false,'old generation failure cannot reach the new detail route');
}
console.log('PASS actual Index continued chapter captures the original admission generation; same-book round trip fences old network/publication without incrementing it for chapter scope');
{
 const f=indexFixture(),main=deferred();f.holdBook(main.promise);f.owner.downloadDirectoryBook();await tick();const intent=f.offline.mangaIntent;
 const busy=await f.owner.loadMangaDownloadActions(3);assert.ok(busy.some(action=>action.id==='pause'));assert.ok(busy.some(action=>action.id==='cancel'));
 await f.owner.performMangaDownloadAction('cancel',3);assert.equal(intent.valid,true);assert.equal(intent.excludedChapters.has(3),true);
 const guard=f.events.find(event=>Array.isArray(event)&&event[0]==='book-guard')[1];assert.equal(guard(3),false);assert.equal(guard(4),true);
 assert.equal(f.calls.some(call=>call[0]==='cache.download.resume'),false);main.resolve();await intent.settled;
 const g=indexFixture(),held=deferred();g.holdBook(held.promise);g.owner.downloadDirectoryBook();await tick();const releaseIntent=g.offline.mangaIntent;
 await g.owner.performMangaDownloadAction('releaseRetention',3);assert.equal(releaseIntent.valid,true);assert.deepEqual([...releaseIntent.excludedChapters],[3]);
 const releaseGuard=g.events.find(event=>Array.isArray(event)&&event[0]==='book-guard')[1];assert.equal(releaseGuard(3),false);assert.equal(releaseGuard(4),true);
 assert.deepEqual(g.released,['/active']);assert.equal(g.calls.some(call=>call[0].startsWith('cache.download.')),false);
 held.resolve();await releaseIntent.settled;
}
{
 const f=indexFixture(),held=deferred();f.rows.find(row=>row.chapterIndex===7).state='cancelled';f.holdBook(held.promise);
 await f.owner.performMangaDownloadAction('resume');await tick();const intent=f.offline.mangaIntent;
 const guard=f.events.find(event=>Array.isArray(event)&&event[0]==='book-guard')[1];
 assert.equal(guard(4),true);assert.equal(guard(7),false,'new resume fallback cannot turn cancelled chapters into fresh download claims');
 assert.equal(guard(5),false,'resume cannot reclaim unrelated completed/released bytes');
 assert.equal(guard(6),false,'resume cannot promote unrelated reading cache to permanent download');
 assert.deepEqual(f.calls.filter(call=>call[0]==='cache.download.resume').map(call=>call[1].chapterIndex),[4]);
 held.resolve();await intent.settled;
}
console.log('PASS actual Index busy controls stay enabled; single cancel/release remain excluded from ongoing book; new book resume admits only explicitly resumed paused chapters');
{
 const f=indexFixture(),receipt=deferred(),request=f.runtime.request;
 f.runtime.request=async(method,params)=>{const value=await request(method,params);if(method==='cache.download.pause')await receipt.promise;return value;};
 const pausing=f.owner.performMangaDownloadAction('pause',3);await tick();
 const old=f.owner.detailToc;f.owner.remoteSessionGeneration++;f.owner.remoteReadingSession=undefined;f.owner.remoteReadingSession=f.admitted;
 receipt.resolve();await pausing;
 assert.equal(f.owner.detailToc,old,'same-book re-admission fences old management projection');
 assert.equal(f.calls.filter(call=>call[0]==='cache.download.pause').length,1,'the stale operation cannot fence a new chapter lease in its second pass');
 assert.equal(f.feedback.length,0,'stale operation feedback cannot follow a new same-book route');
}
console.log('PASS actual Index management keeps its original admission generation across a late Core receipt and same-book return');
