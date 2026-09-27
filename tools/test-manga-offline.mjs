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
 const calls=[],stored=new Set(),reports=[];let state='missing',complete=false,valid=true,fail=-1,bytes=0,cancel=false;
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>valid,
 async request(method,params){calls.push(method);if(method==='cache.book.prefetch'){assert.equal(params.contentKind,'manga');state='inProgress';return {data:{sourceId:'s',bookId:'b',chapterRange:[0,1],chapterCount:1,prefetchedCount:1,queuedIndexes:[0],alreadyQueuedIndexes:[],skippedCachedIndexes:[],materializations:[{chapterIndex:0,token:'opaque',manga:structuredClone(fixtureChapter)}]}};}
 if(method==='manga.entry.get'){assert.deepEqual(params,{sourceId:'s',bookId:'b',chapterIndex:0});return {data:{entry:{chapter:{...structuredClone(fixtureChapter),cached:true,resources:[],pageStart:0,totalPages:3},targetOrdinal:0,recoveryRequired:false,progress:{token:{epoch:1,revision:0},location:null}}}};}
 if(method==='cache.chapter.materialization.report'){reports.push(params);assert.deepEqual(params.manga.resourceRefs,manifest.pages.map(p=>p.resourceRef));if(params.outcome==='completed')assert.equal(complete,true);state=params.outcome;return {data:{sourceId:'s',bookId:'b',chapterIndex:0,state,retainedCachedBody:false}};}
 assert.equal(method,'cache.book.status');return {data:{sourceId:'s',bookId:'b',chapters:[{chapterIndex:0,state,cachedBytes:0,mangaManifestVersion:'version'}]}};},
 async prefetchReadingImage(identity,current,version,allowNetwork){assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(version,'rules');assert.equal(current(),true);calls.push(`image:${identity.resourceRef}`);if(stored.has(identity.resourceRef))return;if(stored.size===fail)throw Error('network failed');assert.equal(allowNetwork,true);assert.ok(identity.imageUrl.includes('POST'));stored.add(identity.resourceRef);bytes++;if(cancel)valid=false;},
 async markOfflineImageChapterComplete(identity,resources,current){assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(current(),true);assert.equal(identity.contentVersion,'version');assert.equal(resources.length,3);assert.equal(stored.size,3);calls.push('mark');complete=true;},
 async isOfflineImageChapterComplete(identity,manga,current){assert.equal(identity.mangaDecodeRevision,decodeRevision);assert.equal(manga,true,'both manga projection and seal verification opt into the image lane');assert.notEqual(current?.(),false);assert.equal(identity.contentVersion,'version');calls.push('verify');return complete;}};
 return {gateway:new ReadingOfflineGateway(runtime),runtime,calls,stored,reports,get bytes(){return bytes},setFail:n=>fail=n,cancelAfterImage:()=>cancel=true,damage:()=>complete=false};
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
 assert.equal(f.stored.size,1);assert.equal(f.reports.at(-1).outcome,'failed');assert.equal(f.calls.includes('mark'),false);
 f.setFail(-1);await f.gateway.prefetchChapter(session,0,()=>true);assert.equal(f.bytes,3);
}
{
 const f=fixture();f.cancelAfterImage();await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true));
 assert.equal(f.reports.at(-1).outcome,'failed');assert.equal(f.calls.includes('mark'),false);assert.equal(f.stored.size,1);
}
{
 const f=fixture();f.runtime.supportsCoreCapability=()=>false;await assert.rejects(f.gateway.prefetchChapter(session,0,()=>true),/CORE_REQUIRED/);assert.equal(f.calls.length,0);
}
// Production disk-manifest verifier rejects same-size byte corruption.
{
 const hashes=['a'.repeat(64),'b'.repeat(64)],digest='c'.repeat(64);
 const Cache=productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingImageDiskCache.ts',import.meta.url),['readValidManifest','matchesResourceDigest','resourceFingerprint'],{fileIo:{stat:async()=>({isFile:()=>true,size:2})}});
 const owner=Object.assign(new Cache(),{verifiedDigests:{get:()=>undefined,remove:()=>{},put:()=>assert.fail('coarse stat cannot cache a digest')},readManifestIdentity:async()=>({manga:true,resourceHashes:hashes,resourceDigests:{[hashes[0]]:digest,[hashes[1]]:digest}}),validResourceFile:async()=>true,readResourceBytes:async()=>new Uint8Array([1,2]),sha256Bytes:async()=>digest});
 assert.ok(await owner.readValidManifest('/private',2));owner.sha256Bytes=async()=> 'd'.repeat(64);assert.equal(await owner.readValidManifest('/private',2),undefined);
}
console.log('PASS manga offline: shared queue opt-in, original-resource completeness, atomic manifest before report, interrupted missing-only retry, cancellation, exact version projection, same-size corruption and old-Core refusal');
// Core claims the whole batch first: failure/cancellation must settle unstarted leases too.
for (const cancel of [false,true]) {
 let valid=true,images=0;const reports=[];
 const entries=Array.from({length:3},(_,index)=>({index,title:`C${index}`,url:`/c${index}`}));
 const leases=entries.map(entry=>({chapterIndex:entry.index,token:`lease-${entry.index}`,manga:{...structuredClone(chapter),chapterIndex:entry.index,manifest:{...structuredClone(manifest),chapter:{...manifest.chapter,chapterId:entry.url}}}}));
 const runtime={supportsCoreCapability:()=>true,captureReadingContentValidity:()=>()=>valid,
 async request(method,params){if(method==='cache.book.prefetch')return {data:{sourceId:'s',bookId:'b',chapterRange:[0,3],chapterCount:3,prefetchedCount:3,queuedIndexes:[0,1,2],alreadyQueuedIndexes:[],skippedCachedIndexes:[],materializations:leases}};
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
 assert.deepEqual(f.calls.slice(prior),['cache.book.status','manga.entry.get','verify']);
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
