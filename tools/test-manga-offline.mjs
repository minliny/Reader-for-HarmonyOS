import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const {ReadingOfflineGateway}=await import('../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:'/c'},sourceRuleVersion:'rules',manifestVersion:'version',decodeRevision:'identity-v1',pages:Array.from({length:3},(_,ordinal)=>{const pageId=`mp1:${String(ordinal).padStart(64,'0')}`;return {ordinal,pageId,resourceRef:`manga:${pageId}`};})};
const chapter={manifest,chapterIndex:0,chapterTitle:'C',cached:false,resources:manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:'https://images.test/repeated',requestRule:'https://images.test/repeated,{"method":"POST","body":"page"}'}}))};
const session={contentKind:'manga',sourceVersion:'rules',identity:{sourceId:'s',bookId:'b'},entries:[{index:0,title:'C',url:'/c'}]};
function fixture(decodeRevision='identity-v1'){
 const fixtureChapter=structuredClone(chapter);fixtureChapter.manifest.decodeRevision=decodeRevision;
 const calls=[],stored=new Set(),reports=[],preparationLeases=new Map();let state='missing',complete=false,retained=false,valid=true,fail=-1,bytes=0,cancel=false,nextPreparation=1,cachedBytes=0;
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>valid,
 async request(method,params){calls.push(method);if(method==='cache.book.prefetch'){assert.equal(params.contentKind,'manga');state='inProgress';return {data:{sourceId:'s',bookId:'b',chapterRange:[0,1],chapterCount:1,prefetchedCount:1,queuedIndexes:[0],alreadyQueuedIndexes:[],skippedCachedIndexes:[],materializations:[{chapterIndex:0,token:'opaque',manga:structuredClone(fixtureChapter)}]}};}
 if(method==='manga.cache.materialization.prepare'){
 assert.equal(params.intent,'download');assert.deepEqual(params.chapter,manifest.chapter);assert.equal(params.manifestVersion,'version');
 const data={token:`preparation-${nextPreparation++}`,chapter:params.chapter,manifestVersion:params.manifestVersion,intent:params.intent};preparationLeases.set(data.token,data);return {data};}
 if(method==='manga.cache.materialization.complete'){
 assert.ok(preparationLeases.has(params.token));assert.deepEqual(params.resourceRefs,manifest.pages.map(p=>p.resourceRef));assert.equal(complete,true,'Host completeness precedes new Core publication');
 preparationLeases.delete(params.token);retained=true;return {data:{completed:true,manifestVersion:'version'}};}
 if(method==='manga.cache.materialization.abort')return {data:{aborted:preparationLeases.delete(params.token)}};
 if(method==='manga.pages.window'){
 assert.equal(params.chapterId,'/c');assert.equal(params.manifestVersion,'version');const data=structuredClone(fixtureChapter);data.manifest.pages=data.manifest.pages.slice(params.start,params.start+params.limit);
 const refs=new Set(data.manifest.pages.map(p=>p.resourceRef));data.resources=data.resources.filter(resource=>refs.has(resource.resourceRef));return {data:{...data,pageStart:params.start,totalPages:3}};}
 if(method==='manga.entry.get'){assert.deepEqual(params,{sourceId:'s',bookId:'b',chapterIndex:0});return {data:{entry:{chapter:{...structuredClone(fixtureChapter),cached:true,resources:[],pageStart:0,totalPages:3},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:1,revision:0},location:null}}}};}
 if(method==='cache.chapter.materialization.report'){reports.push(params);assert.deepEqual(params.manga.resourceRefs,manifest.pages.map(p=>p.resourceRef));if(params.outcome==='completed')assert.equal(complete,true);state=params.outcome;return {data:{sourceId:'s',bookId:'b',chapterIndex:0,state,retainedCachedBody:false}};}
 if(method==='manga.retention.list'){assert.deepEqual(params,{sourceId:'s',bookId:'b'});return {data:{retentions:retained?[{chapter:manifest.chapter,manifestVersion:'version',retainedAt:1}]:[]}};}
 assert.equal(method,'cache.book.status');return {data:{sourceId:'s',bookId:'b',chapters:[{chapterIndex:0,state,cachedBytes,mangaManifestVersion:'version'}]}};},
 async prefetchReadingImage(identity,current,version,allowNetwork,priority){assert.equal(priority,'download');assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(version,'rules');assert.equal(current(),true);calls.push(`image:${identity.resourceRef}`);if(stored.has(identity.resourceRef))return;if(stored.size===fail)throw Error('network failed');assert.equal(allowNetwork,true);assert.ok(identity.imageUrl.includes('POST'));stored.add(identity.resourceRef);bytes++;if(cancel)valid=false;},
 async markOfflineImageChapterComplete(identity,resources,current){assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(current(),true);assert.equal(identity.contentVersion,'version');assert.equal(resources.length,3);assert.equal(stored.size,3);calls.push('mark');complete=true;},
 async isOfflineImageChapterComplete(identity,manga,current){assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(manga,true,'both manga projection and seal verification opt into the image lane');assert.notEqual(current?.(),false);assert.equal(identity.contentVersion,'version');calls.push('verify');return complete;}};
 return {gateway:new ReadingOfflineGateway(runtime),runtime,calls,stored,reports,preparationLeases,get bytes(){return bytes},setFail:n=>fail=n,cancelAfterImage:()=>cancel=true,damage:()=>complete=false,release:()=>retained=false,setState:(value,bodyBytes=0)=>{state=value;cachedBytes=bodyBytes;}};
}
{
 const f=fixture();const result=await f.gateway.prefetchChapter(session,0,()=>true);
 assert.equal(result[0].downloadState,'completed');assert.equal(f.bytes,3);
 assert.ok(f.calls.indexOf('mark')<f.calls.indexOf('cache.chapter.materialization.report'));
 await f.gateway.prefetchChapter(session,0,()=>true);assert.equal(f.bytes,3,'resume validates cached bytes without downloading them again');
 f.damage();assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'cached','Core completion cannot conceal missing Host bytes');
}
{
 const f=fixture();f.setFail(1);await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true));
 assert.equal(f.stored.size,1);assert.equal(f.preparationLeases.size,0,'failed work releases its Core preparation lease');assert.equal(f.reports.at(-1).outcome,'failed');assert.equal(f.calls.includes('mark'),false);
 f.setFail(-1);await f.gateway.prefetchChapter(session,0,()=>true);assert.equal(f.bytes,3);
}
{
 const f=fixture();f.cancelAfterImage();await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true));
 assert.equal(f.reports.at(-1).outcome,'failed');assert.equal(f.preparationLeases.size,0,'cancelled work releases its preparation lease without deleting partial bytes');assert.equal(f.calls.includes('mark'),false);assert.equal(f.stored.size,1);
}
{
 const f=fixture();f.runtime.supportsCoreCapability=()=>false;await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true),/CORE_REQUIRED/);assert.equal(f.calls.length,0);
}
// Production disk-manifest verifier rejects same-size byte corruption.
{
 const hashes=['a'.repeat(64),'b'.repeat(64)],digest='c'.repeat(64);
 const Cache=productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingImageDiskCache.ts',import.meta.url),['readValidManifest','matchesResourceDigest','resourceFingerprint','assertCurrent'],{fileIo:{stat:async()=>({isFile:()=>true,size:2})}});
 const owner=Object.assign(new Cache(),{verifiedDigests:{get:()=>undefined,remove:()=>{},put:()=>assert.fail('coarse stat cannot cache a digest')},readManifestIdentity:async()=>({manga:true,resourceHashes:hashes,resourceDigests:{[hashes[0]]:digest,[hashes[1]]:digest}}),validResourceFile:async()=>true,readResourceBytes:async()=>new Uint8Array([1,2]),sha256Bytes:async()=>digest});
 assert.ok(await owner.readValidManifest('/private',2,undefined,()=>true,true));owner.sha256Bytes=async()=> 'd'.repeat(64);assert.equal(await owner.readValidManifest('/private',2,undefined,()=>true,true),undefined);
}
console.log('PASS manga offline: shared queue opt-in, original-resource completeness, atomic manifest before report, interrupted missing-only retry, cancellation, exact version projection, same-size corruption and old-Core refusal');
// Core claims the whole batch first: failure/cancellation must settle unstarted leases too.
for (const cancel of [false,true]) {
 let valid=true,images=0;const reports=[];
 const entries=Array.from({length:3},(_,index)=>({index,title:`C${index}`,url:`/c${index}`}));
 const leases=entries.map(entry=>({chapterIndex:entry.index,token:`lease-${entry.index}`,manga:{...structuredClone(chapter),chapterIndex:entry.index,manifest:{...structuredClone(manifest),chapter:{...manifest.chapter,chapterId:entry.url}}}}));
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>valid,
 async request(method,params){if(method==='cache.book.prefetch')return {data:{sourceId:'s',bookId:'b',chapterRange:[0,3],chapterCount:3,prefetchedCount:3,queuedIndexes:[0,1,2],alreadyQueuedIndexes:[],skippedCachedIndexes:[],materializations:leases}};
 if(method==='manga.cache.materialization.prepare')return {data:{...params,token:`preparation-${params.chapter.chapterId}`}};
 if(method==='manga.cache.materialization.abort')return {data:{aborted:true}};
 assert.equal(method,'cache.chapter.materialization.report');reports.push(params);return {data:{sourceId:'s',bookId:'b',chapterIndex:params.chapterIndex,state:params.outcome,retainedCachedBody:false}};},
 async prefetchReadingImage(){images++;if(cancel)valid=false;else throw Error('first chapter failed');},
 async markOfflineImageChapterComplete(){assert.fail('failed batch cannot complete a chapter');},async isOfflineImageChapterComplete(){return false;}};
 await assert.rejects(new ReadingOfflineGateway(runtime).prefetchBook({...session,entries},()=>true));
 assert.equal(images,1,'no image work starts for later claimed chapters');
 assert.deepEqual(reports.map(report=>[report.chapterIndex,report.token,report.outcome]),[[0,'lease-0','failed'],[1,'lease-1','failed'],[2,'lease-2','failed']]);
}
console.log('PASS three-chapter claimed batch settles every lease after first failure and cancellation');
// Explicit manga downloads refresh changed source context once through the
// existing acquisition path, before any queue lease can be claimed.
{
 const f=fixture();let refreshed=0;
 f.runtime.bookAcquisitions=()=>({currentSourceVersion:async()=> 'new-rules'});
 f.gateway.remote.openSession=async(seed,options)=>{refreshed++;assert.equal(seed.contentKind,'manga');assert.equal(options.forceRefresh,true);assert.equal(options.isCurrent(),true);assert.equal(f.calls.includes('cache.book.prefetch'),false);return {...session,sourceVersion:'new-rules'};};
 await f.gateway.prefetchChapter(session,0,()=>true);
 await f.gateway.prefetchChapter(session,0,()=>true);
 assert.equal(refreshed,1,'subsequent chunks reuse the refreshed source context');
}
{
 const f=fixture();f.runtime.bookAcquisitions=()=>({currentSourceVersion:async()=> 'new-rules'});
 f.gateway.remote.openSession=async()=>({...session,sourceVersion:'new-rules',entries:[{index:0,title:'Other',url:'/other'}]});
 await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true),/CATALOG_CHANGED_REOPEN_REQUIRED/);
 await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true),/CATALOG_CHANGED_REOPEN_REQUIRED/);
 assert.equal(f.calls.includes('cache.book.prefetch'),false,'changed chapter identity never claims the old range');
}
{
 const f=fixture();let current=true;f.runtime.bookAcquisitions=()=>({currentSourceVersion:async()=> 'new-rules'});
 f.gateway.remote.openSession=async()=>{current=false;return {...session,sourceVersion:'new-rules'};};
 await assert.rejects(f.gateway.prefetchChapter(session,0,()=>current));assert.equal(f.calls.length,0);
}
console.log('PASS changed manga source refreshes acquisition once, fences cancellation and rejects changed requested chapter identities before queue claims');
{
 const f=fixture();f.runtime.bookAcquisitions=()=>({currentSourceVersion:async()=> 'new-rules'});
 f.gateway.remote.openSession=async()=>({...session,sourceVersion:'new-rules',entries:[{...session.entries[0],navigable:false}]});
 await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true),/CATALOG_CHANGED_REOPEN_REQUIRED/);
 assert.equal(f.calls.includes('cache.book.prefetch'),false,'readable chapter reclassified as group cannot claim old range');
}
{
 const f=fixture();const grouped={...session,entries:[session.entries[0],{index:1,title:'Group',url:'/group',navigable:false}]};
 const request=f.runtime.request;
 f.runtime.request=async(method,params)=>{if(method==='cache.book.prefetch') {
  assert.deepEqual(params.chapterRange,[0,2]);const value=await request(method,params);value.data.chapterRange=[0,2];return value;
 }return request(method,params);};
 const projection=await f.gateway.prefetchBook(grouped,()=>true);
 assert.equal(f.reports.length,1);assert.equal(f.reports[0].chapterIndex,0);
 assert.equal(projection[1].navigable,false);
 const groups=fixture();await groups.gateway.prefetchBook({...session,entries:[{...session.entries[0],navigable:false}]},()=>true);
 assert.equal(groups.calls.includes('cache.book.prefetch'),false);
}
console.log('PASS mixed manga offline range materializes only readable chapters; groups are projected and readable-to-group refresh rejects before claim');

// Completion must obtain the actual stored decode fact without transport URLs,
// changing manifest/page identities or touching progress.
{
 const f=fixture('bytes-v1');await f.gateway.prefetchChapter(session,0,()=>true);
 const prior=f.calls.length;assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'completed');
 assert.deepEqual(f.calls.slice(prior),['cache.book.status','manga.retention.list','manga.entry.get','verify']);
 const request=f.runtime.request;f.runtime.request=async(method,params)=>{const value=await request(method,params);if(method==='manga.entry.get')value.data.entry.chapter.manifest.manifestVersion='superseded';return value;};
 assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'cached','current Core version is checked before Host completion');
 f.runtime.request=async(method,params)=>{const value=await request(method,params);if(method==='manga.entry.get')delete value.data.entry.chapter.manifest.decodeRevision;return value;};
 assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'cached','missing revision cannot default to identity-v1 or abort unrelated rows');
 f.runtime.request=async(method,params)=>{const value=await request(method,params);if(method==='manga.entry.get')value.data.entry.chapter.manifest.decodeRevision='future-v2';return value;};
 const beforeUnknown=f.calls.filter(c=>c==='verify').length;
 assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'cached','unknown nonempty revision is rejected inside the per-chapter entry boundary');
 assert.equal(f.calls.filter(c=>c==='verify').length,beforeUnknown,'unknown profile never reaches Host completion');
}
console.log('PASS offline projection reads the bounded cold manifest decode fact, passes scripted profile, rejects missing revision and downgrades changed versions without any online/progress command');

{
 const f=fixture();await f.gateway.prefetchChapter(session,0,()=>true);
 const request=f.runtime.request;
 f.runtime.request=async(method,params)=>{
   if(method==='manga.entry.get' && params.chapterIndex===1)throw Error('missing chapter entry');
   const result=await request(method,params);
   if(method==='cache.book.status')result.data.chapters.push({chapterIndex:1,state:'completed',cachedBytes:0,mangaManifestVersion:'missing'});
   return result;
 };
 const entries=await f.gateway.loadProjection({...session,entries:[...session.entries,{index:1,title:'Missing',url:'/missing'}]});
 assert.deepEqual(entries.map(e=>e.downloadState),['completed','cached']);
 let current=true;
 f.runtime.request=async(method,params)=>{if(method==='manga.entry.get'){current=false;throw Error('late entry');}return request(method,params);};
 await assert.rejects(f.gateway.loadProjection(session,()=>current),/superseded/);
}
console.log('PASS a missing cold entry downgrades only its chapter; cancellation is not swallowed by per-chapter completion recovery');

{
 const f=fixture();await f.gateway.prefetchChapter(session,0,()=>true);
 f.release();const before=f.calls.length;
 assert.equal((await f.gateway.loadProjection(session))[0].downloadState,'cached','release keeps complete reusable bytes while no longer claiming a permanent download');
 assert.equal(f.bytes,3);assert.equal(f.calls.slice(before).includes('verify'),false,'a stale completed queue row cannot reassert retention');
 for(const contentKind of ['manga','text']) {
   const q=fixture();q.setState('paused',99);
   assert.equal((await q.gateway.loadProjection({...session,contentKind}))[0].downloadState,'paused','durable body bytes cannot override explicit pause');
   assert.equal(q.calls.includes('cache.book.prefetch'),false,'projection never resumes a paused task');
 }
 const n=fixture();n.setState('failed',99);
 assert.equal((await n.gateway.loadProjection({...session,contentKind:'text'}))[0].downloadState,'cached','novel durable body fallback remains intact');
}
console.log('PASS retention release preserves reusable cache, completed queue cannot recreate ownership, explicit pause is authoritative for manga and novels, novel body fallback remains');

{
 const f=fixture(), request=f.runtime.request;
 f.runtime.request=async(method,params)=>{
   if(method==='manga.chapter.get') { f.calls.push(method);assert.equal(params.policy,'refresh');return {data:{...structuredClone(chapter),pageStart:0,totalPages:3}}; }
   return request(method,params);
 };
 await f.gateway.updateMangaChapter(session,0,()=>true);
 assert.ok(f.calls.indexOf('manga.chapter.get')<f.calls.indexOf('cache.book.prefetch'),'explicit update acquires new head before shared download preparation');
 assert.equal(f.reports.at(-1).outcome,'completed');
 const paused=fixture();paused.setState('paused');
 await assert.rejects(paused.gateway.updateMangaChapter(session,0,()=>true),/PAUSED_RESUME_REQUIRED/);
 assert.equal(paused.calls.includes('manga.chapter.get'),false,'updating cannot bypass the explicit resume action');
 assert.equal(paused.calls.includes('cache.book.prefetch'),false);
 await assert.rejects(f.gateway.updateMangaChapter({...session,contentKind:'text'},0,()=>true),/REQUIRES_MANGA/);
 await assert.rejects(f.gateway.updateMangaChapter({...session,entries:[{...session.entries[0],navigable:false}]},0,()=>true),/READABLE_CHAPTER/);
}
console.log('PASS explicit chapter update uses shared acquisition/completion without bypassing pause, novel scope or group navigation');

// Use the production queue/materialization path, with Core lease fencing and
// disk publication mocked only at the native/platform boundary.
const scopeDeferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const scopeTick=async()=>{await new Promise(done=>setImmediate(done));};
function scopeFixture(count=3){
 const entries=Array.from({length:count},(_,index)=>({index,title:`C${index}`,url:`/scope-${index}`}));
 const admitted={...session,entries},states=entries.map(()=> 'queued'),images=[],claims=[],reports=[],stored=new Set(),complete=new Set(),retained=new Set();
 const claimHold=scopeDeferred(),imageHold=scopeDeferred(),preparationIntents=new Map(),aborts=[];let holdClaim=false,holdImage=-1,nextToken=1;
 const dataFor=index=>({chapterIndex:index,chapterTitle:entries[index].title,cached:false,manifest:{...structuredClone(manifest),chapter:{...manifest.chapter,chapterId:entries[index].url},pages:[structuredClone(manifest.pages[0])]},resources:[structuredClone(chapter.resources[0])]});
 const indexFor=id=>entries.findIndex(entry=>entry.url===id);
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>true,
 async request(method,params){
  if(method==='cache.book.prefetch'){
   claims.push([...params.chapterRange]);const [start,end]=params.chapterRange;
   const materializations=entries.slice(start,end).filter(entry=>!['paused','completed','inProgress'].includes(states[entry.index])).map(entry=>{states[entry.index]='inProgress';return {chapterIndex:entry.index,token:`scope-lease-${entry.index}`,manga:dataFor(entry.index)};});
   if(holdClaim){holdClaim=false;await claimHold.promise;}
   return {data:{...admitted.identity,chapterRange:[start,end],chapterCount:end-start,prefetchedCount:materializations.length,queuedIndexes:materializations.map(lease=>lease.chapterIndex),alreadyQueuedIndexes:[],skippedCachedIndexes:[],materializations}};
  }
  if(method==='manga.session.runtime')return {data:{runtimeEpoch:1}};
  if(method==='manga.session.replace')return {data:{protected:params.chapters.length,runtimeEpoch:1}};
  if(method==='manga.session.release')return {data:{released:true}};
  if(method==='manga.cache.recordRead')return {data:{recorded:true}};
  if(method==='manga.pages.window'){const index=indexFor(params.chapterId);return {data:{...dataFor(index),pageStart:0,totalPages:1}};}
  if(method==='manga.cache.materialization.prepare'){const token=`scope-preparation-${nextToken++}`;preparationIntents.set(token,params.intent);return {data:{...params,token}};}
  if(method==='manga.cache.materialization.abort'){aborts.push([params.token,preparationIntents.get(params.token)]);return {data:{aborted:preparationIntents.delete(params.token)}};}
  if(method==='manga.cache.materialization.complete'){const index=indexFor(params.chapter.chapterId);assert.ok(complete.has(index));if(preparationIntents.get(params.token)==='download')retained.add(index);preparationIntents.delete(params.token);return {data:{completed:true,manifestVersion:'version'}};}
  if(method==='cache.chapter.materialization.report'){
   reports.push([params.chapterIndex,params.outcome]);if(['paused','cancelled'].includes(states[params.chapterIndex]))throw Error('Storage invalidSnapshot: obsolete lease');
   states[params.chapterIndex]=params.outcome;return {data:{...admitted.identity,chapterIndex:params.chapterIndex,state:params.outcome,retainedCachedBody:false}};
  }
  if(method==='cache.book.status')return {data:{...admitted.identity,chapters:states.map((state,chapterIndex)=>({chapterIndex,state,cachedBytes:0,mangaManifestVersion:'version'}))}};
  if(method==='manga.retention.list')return {data:{retentions:[...retained].map(index=>({chapter:dataFor(index).manifest.chapter,manifestVersion:'version',retainedAt:1}))}};
  if(method==='manga.entry.get')return {data:{entry:{chapter:{...dataFor(params.chapterIndex),resources:[],cached:true,pageStart:0,totalPages:1},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:1,revision:0},location:null}}}};
  throw Error(`unexpected scope RPC ${method}`);
 },async prefetchReadingImage(identity,current){const index=indexFor(identity.chapterId);images.push(index);if(index===holdImage){holdImage=-1;await imageHold.promise;}if(!current())throw Error('cancelled');stored.add(index);},
 async markOfflineImageChapterComplete(identity,_resources,current){assert.ok(current());assert.ok(stored.has(identity.chapterIndex));complete.add(identity.chapterIndex);},
 async isOfflineImageChapterComplete(identity){return complete.has(identity.chapterIndex);}};
 return {gateway:new ReadingOfflineGateway(runtime),runtime,dataFor,complete,aborts,preparationIntents,admitted,states,images,claims,reports,stored,holdClaim:()=>{holdClaim=true;},holdImage:index=>{holdImage=index;},claimHold,imageHold};
}
{
 const f=scopeFixture(),excluded=new Set();f.holdImage(0);
 const book=f.gateway.prefetchBook(f.admitted,()=>true,undefined,index=>!excluded.has(index));await scopeTick();
 excluded.add(0);f.states[0]='paused';f.imageHold.resolve();
 const projection=await book;
 assert.deepEqual(projection.map(row=>row.downloadState),['paused','completed','completed']);
 assert.deepEqual([...f.stored],[1,2],'chapter cancellation settles only its lease; other claimed chapters still materialize');
 assert.equal(f.reports.some(([index,outcome])=>index===0&&outcome==='completed'),false);
}
console.log('PASS actual manga offline per-chapter pause fences its lease without failing the remaining whole-book batch');
{
 const f=scopeFixture(),excluded=new Set();f.holdClaim();f.holdImage(0);
 const book=f.gateway.prefetchBook(f.admitted,()=>true,undefined,index=>!excluded.has(index));let finished=false;book.then(()=>finished=true);
 await scopeTick();assert.deepEqual(f.claims,[[0,3]]);
 excluded.add(2);f.states[2]='paused';let drained=false;
 const drain=f.gateway.waitForMangaChapter(2).then(()=>drained=true);await scopeTick();assert.equal(drained,false,'claim await gap is included in the target drain');
 f.claimHold.resolve();await drain;
 assert.equal(finished,false,'unstarted target settles while another chapter still loads');assert.deepEqual(f.images,[0]);
 assert.equal(f.reports.some(([index,outcome])=>index===2&&outcome==='failed'),true);
 f.imageHold.resolve();const result=await book;
 assert.deepEqual(result.map(row=>row.downloadState),['completed','completed','paused']);assert.deepEqual(f.images,[0,1]);
}
console.log('PASS actual inflight Core claim is drained through lease registration; excluded unstarted chapter settles without waiting for a sibling image');
{
 const f=scopeFixture(25),excluded=new Set();f.holdImage(0);
 const book=f.gateway.prefetchBook(f.admitted,()=>true,undefined,index=>!excluded.has(index));await scopeTick();
 excluded.add(22);f.states[22]='cancelled';await f.gateway.waitForMangaChapter(22);
 f.imageHold.resolve();const result=await book;
 assert.deepEqual(f.claims,[[0,20],[20,22],[23,25]],'future Core claims use exact contiguous intervals around the exclusion');
 assert.equal(f.images.includes(22),false,'the cancelled chapter is never reclaimed in a later book chunk');
 assert.equal(result[22].downloadState,'cancelled');assert.equal(result.filter(row=>row.downloadState==='completed').length,24);
}
console.log('PASS actual 25-chapter download splits future contiguous chunks around cancellation without reclaiming excluded chapters or skipping siblings');
{
 const {MangaChapterPreparationCoordinator}=await import('../entry/src/main/ets/features/manga/MangaChapterPreparationCoordinator.ts');
 const f=scopeFixture(),excluded=new Set(),coordinator=MangaChapterPreparationCoordinator.forRuntime(f.runtime);f.holdImage(0);
 const old=f.dataFor(0);await coordinator.activate(old,1,()=>true,true,()=>true);coordinator.startCurrent(old);await scopeTick();
 assert.deepEqual(f.images,[0]);assert.ok([...f.preparationIntents.values()].includes('cache'));
 const book=f.gateway.prefetchBook(f.admitted,()=>true,undefined,index=>!excluded.has(index));await scopeTick();
 assert.ok([...f.preparationIntents.values()].includes('download'),'explicit consumer joins the held reading preparation');
 excluded.add(0);f.states[0]='paused';
 const within=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('target chapter drain waited for independent cache image')),500);})]);}finally{clearTimeout(timer);}};
 try {
  await within(f.gateway.waitForMangaChapter(0));const projection=await within(book);
  assert.deepEqual(projection.map(row=>row.downloadState),['paused','completed','completed']);
  assert.deepEqual([...f.stored],[1,2],'sibling book leases complete before the independent reading cache unblocks');
  assert.ok(f.aborts.some(([_token,intent])=>intent==='download'));assert.equal(f.aborts.some(([_token,intent])=>intent==='cache'),false);
  f.imageHold.resolve();for(let attempt=0;attempt<20&&!f.complete.has(0);attempt++)await scopeTick();
  assert.equal(f.complete.has(0),true,'shared reading preparation still completes after the download consumer detached');
 } finally {f.imageHold.resolve();await book.catch(()=>{});await coordinator.close();}
}
console.log('PASS actual manga pause detaches only the download consumer from a held same-chapter read/cache task; other whole-book leases complete before shared cache unblocks');
