import {admitBookshelfSdkCarrier} from './lib/bookshelf-projection-owner-probe.mjs';
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { bookshelfCatalogHost, catalogIndexMethods } from './lib/bookshelf-catalog-host-probe.mjs';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedMembers, boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { projectOperationFacts } from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { readerRecoveryView } from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { MangaOfflineNetworkProbe } from '../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { BookAcquisitionCoordinator } = await import('../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const indexFile = process.env.READER_UPDATE_INDEX ?? new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(predicate) { for (let i=0;i<300;i++) { if (predicate()) return; await pause(); } assert.fail('update did not settle'); }
const sourceId = 'source';
const seed = bookId => ({ sourceId, bookId, detailUrl: bookId, title: '目录示例', author: '作者', sourceVersion: 'v1' });
const book = (bookId, extra={}) => ({ ...seed(bookId), addedAt: 1, readProgress: 3210, ...extra });
function fixture(books=[book('/one')]) {
  const projectionAdmissions=[], calls=[], records=new Map(), catalogs=new Map(), modes=new Map(), prefetched=[], log=[];
  let remoteCount=1, cacheGate, tocGate, targetsGate, projectionGate, failProjection=false, installedOwner, active=0, peak=0, projections=0, fullScans=0, enabled=true, diagnosticThrows=false,failTargets=false;
  const runtime = new BookAcquisitionCoordinator(async (method, params, options) => {
    calls.push({method,params});
    const id=params.bookId ?? params.book?.bookId ?? params.bookUrl;
    if (method==='source.list') return {data:{sources:[{sourceId,name:'真实来源',enabled,sourceVersion:'v1'}]}};
    if (method==='source.delete') { enabled=false; return {data:{deleted:1}}; }
    if (method==='search-book.get') return {data:{book:records.get(id) ?? null}};
    if (method==='cache.book.status') {
      const snapshot=catalogs.get(id) ?? [];
      if(cacheGate) await cacheGate.promise;
      return {data:{sourceId,bookId:id,tocAvailable:snapshot.length>0,
        chapters:snapshot.map(e=>({chapterIndex:e.index,title:e.title,url:e.url,variables:{}})),continuationVariables:{}}};
    }
    if (method==='book.detail') {
      active++; peak=Math.max(peak,active); await pause();
      const detail={bookId:id,title:'目录示例',author:'作者'};
      records.set(id,{origin:sourceId,bookUrl:id,name:detail.title,author:detail.author,variable:'{}',
        acquisition:{sourceVersion:'v1',detailAt:Date.now()}});
      return {data:{sourceId,sourceVersion:'v1',book:detail,tocUrl:`${id}/toc`,variables:{token:'detail'}}};
    }
    if (method==='book.toc') {
      if(tocGate)await tocGate.promise;
      await pause(); active--;
      if(modes.get(id)==='error') throw Error('source unavailable');
      const entries=modes.get(id)==='empty' ? [] : Array.from({length:remoteCount},(_,index)=>({index,title:`第${index+1}章`,url:`${id}/${index+1}`,variables:{}}));
      // Fixture models the documented Core preservation contract; the actual
      // Core implementation/test is audited separately, not replaced by this mock.
      if(entries.length) { catalogs.set(id,entries); records.get(id).acquisition.catalogAt=Date.now(); }
      return {data:{sourceId,bookId:id,toc:entries}};
    }
    throw Error(`unexpected command ${method}`);
  });
  const owner={bookAcquisitions:()=>runtime,request:(...args)=>runtime.request(...args)};
  installedOwner=owner;
  class Flow { async load(current){projectionAdmissions.push(current);if(!current())throw Error('retired before Core admission');projections++;if(projectionGate)await projectionGate.promise;if(failProjection)throw Error('read unavailable');return {kind:books.length?'populated':'empty',shelf:{books,total:books.length},continueReading:undefined};} async loadAll(current){fullScans++;if(targetsGate)await targetsGate.promise;await pause();if(failTargets)throw Error('target read unavailable');return current()?{books,total:books.length,projectionRevision:'r'}:undefined;} }
  const Index=productionMotionMethods(indexFile,catalogIndexMethods,{
    ReaderRuntimeOwner:{current:()=>{if(!installedOwner)throw Error('runtime unavailable');return installedOwner;}},RemoteReadingFlowGateway,projectOperationFacts,readerRecoveryView,
    BookshelfFlowGateway:Flow,
    LOCAL_SOURCE_ID:'local',CATALOG_REFRESH_INTERVAL_MS:600000,DOMAIN:0,
    hilog:{info:(...args)=>log.push(args),warn:(...args)=>{if(diagnosticThrows)throw Error('diagnostic unavailable');log.push(args);}}
  });
  const page=Object.assign(new Index(),{mountedRuntimeOwner:owner,detailShelfAdmissionMount:1,rssInstanceIdentity:1,shelfReadingFilter:'all',shelfSourceFilter:'all',shelfContentFilter:'all',bookshelfHost:bookshelfCatalogHost(Flow,()=>installedOwner),shelfReceiptRetired:false,shelfProjectionRevision:'',navigationGeneration:1,bookshelfCatalogEpoch:0,bookshelfBackgroundEpoch:0,route:'bookshelf',shelfBooks:books,settingsSnapshot:{autoCheckUpdate:true},
    applicationSettingsSnapshot:{autoCheckUpdate:true},searchAppForeground:true,readingSessionActive:false,
    bookshelfUpdateRunning:false,bookshelfBackgroundRefreshRunning:false,bookshelfUpdateDone:0,bookshelfUpdateTotal:0,
    bookshelfLoadGeneration:0,prefetchReadingWindow:async session=>prefetched.push(session),invalidateBookshelfProjection(){this.bookshelfLoadGeneration++;},applyBookshelfState(){}});
  return {runtime,owner,page,currentOwner:()=>installedOwner,calls,projectionAdmissions,records,catalogs,modes,prefetched,log,remoteCount:n=>{remoteCount=n;}, diagnosticThrows:v=>{diagnosticThrows=v;},
    cacheGate:g=>{cacheGate=g;},tocGate:g=>{tocGate=g;},targetsGate:g=>{targetsGate=g;}, projectionGate:g=>{projectionGate=g;}, failProjection:v=>{failProjection=v;},failTargets:v=>{failTargets=v;}, setOwner:v=>{installedOwner=v;},peak:()=>peak,projections:()=>projections,fullScans:()=>fullScans};
}
const ets = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const sdkRequire = createRequire(import.meta.url), sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
sdkRequire(sdkRoot + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set('BookshelfShell', new Set(['content']));
sdkRequire(sdkRoot + '/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('bookshelfContent');
function actualRecovery(f) {
 const shellSource=ets('features/bookshelf/BookshelfShell.ets'),composition=boundedSurfaceSdk();
 for(const member of shellSource.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g))sdkRequire(sdkRoot+'/lib/component_map.js').CUSTOM_BUILDER_METHOD.add(member[1]);
 const parent=createReaderBuilderProbe(ets('pages/Index.ets'),['bookshelfShellContent'],{BookshelfShell:Child},
  {childSources:{BookshelfShell:shellSource}}).owner;
 Object.assign(parent,f.page,{isCurrentBookshelfPresentation:f.page.isCurrentBookshelfPresentation.bind(f.page),shelfRecovery:()=>f.page.shelfRecovery(),shelfReadRecovery:()=>f.page.shelfReadRecovery(),isBookshelfVisualAdmitted:true,
  reconcileBookshelfCatalogProjection:token=>f.page.reconcileBookshelfCatalogProjection(token),
  reconcileShelfWrite:()=>assert.fail('catalog notice must not replay a shelf write')});
 admitBookshelfSdkCarrier(parent,f.owner,f.currentOwner);
 // Keep the actual live Index as the navigation/Runtime authority for the
 // retained native callbacks; the SDK carrier only renders its Props.
 parent.isCurrentRuntime=f.page.isCurrentRuntime.bind(f.page);
 parent.isCurrentBookshelfPresentation=f.page.isCurrentBookshelfPresentation.bind(f.page);
 parent.bookshelfShellContent();const props=[...parent.children.values()][0].params;
 composition.childSources.BookshelfMoreMenu=ets('features/bookshelf/BookshelfMoreMenu.ets');
 const shell=composition.consumer(shellSource,['shellContent','content','recoveryNoticeContent'],{BookshelfMoreMenu:Child,READER_FLOATING_TOP_BAR_HEIGHT:58,...metricsApi,ReaderWindowCoordinator:{metrics:metricsApi.createDefaultReaderWindowMetrics}});
 Object.assign(shell,props,{topBar(){},content(){},moreMenuVisible:false});shell.shellContent();
 const notice=composition.walk(shell).find(owner=>owner instanceof composition.deps.ReaderRecoveryNotice);
 assert.ok(notice,'real Shell -> shared RecoveryNotice consumes the catalog facts');
 const action=composition.nodes(shell).find(node=>node.height===36&&node.onClick);
 return {props,notice,action,nodes:composition.nodes(shell)};
}
function reconstructCatalog(f,navigation=f.page.navigationGeneration) {
 const old=f.page;old.retireBookshelfCatalogPresentation();old.shelfReceiptRetired=true;
 const page=Object.assign(new old.constructor(),old,{shelfReceiptRetired:false,navigationGeneration:navigation,rssInstanceIdentity:old.rssInstanceIdentity+1,bookshelfCatalogHost:undefined,bookshelfCatalogBinding:undefined});
 page.bookshelfHost=new old.bookshelfHost.constructor(()=>{},()=>true,()=>f.owner);return page;
}
const results=[];
async function check(name, run) { try {await run();results.push({name,status:'PASS'});} catch(error){results.push({name,status:'FAIL',message:error.stack});} }
await check('manual update bypasses prepared sessions and executes real Gateway detail/TOC',async()=>{
  const f=fixture(); try {
    const prepared=await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    assert.equal(prepared.entries.length,1); f.remoteCount(2); f.calls.length=0;
    f.page.startManualBookshelfUpdate(); await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.calls.filter(c=>c.method==='cache.book.status').length,0);
    assert.equal(f.prefetched.at(-1).entries.length,2);
    assert.equal(f.page.shelfBooks[0].readProgress,3210,'Host never rewrites reading progress');
    assert.equal(f.page.bookshelfUpdateDone,1); assert.equal(f.projections(),1);
  } finally {f.runtime.close();}
});
await check('manual update also bypasses durable catalog cache after prepared eviction',async()=>{
  const f=fixture(); try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true}); f.runtime.prepared.clear();
    f.remoteCount(3);f.calls.length=0;
    f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.prefetched.at(-1).entries.length,3);
  } finally {f.runtime.close();}
});
await check('manual request waits for a cache-only in-flight acquisition then refreshes',async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const cached=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    f.remoteCount(4);f.page.startManualBookshelfUpdate();await pause();gate.resolve();
    const old=await cached;assert.equal(old.entries.length,1);
    await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
    assert.equal(f.prefetched.at(-1).entries.length,4);
  } finally {f.runtime.close();}
});
await check('per-book failure/empty results preserve old records, settle flags and continue bounded batch',async()=>{
  const f=fixture([book('/broken'),book('/empty'),book('/healthy'),book('/local',{sourceId:'local'})]);try {
    for(const id of ['/broken','/empty','/healthy']) await f.runtime.acquireBook(seed(id),{forceRefresh:true});
    const oldBroken=f.catalogs.get('/broken'),oldEmpty=f.catalogs.get('/empty');
    f.modes.set('/broken','error');f.modes.set('/empty','empty');f.remoteCount(2);f.calls.length=0;
    f.page.startManualBookshelfUpdate();f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,3,'duplicate click cannot create another sweep');
    assert.equal(f.catalogs.get('/broken'),oldBroken);assert.equal(f.catalogs.get('/empty'),oldEmpty);
    assert.equal(f.prefetched.length,1);assert.equal(f.prefetched[0].identity.bookId,'/healthy');
    assert.equal(f.page.bookshelfUpdateDone,3);assert.equal(f.page.bookshelfUpdateTotal,3);assert.ok(f.peak()<=2);
    assert.equal(f.page.bookshelfCatalogFacts.fact,'partial');assert.equal(f.page.bookshelfCatalogFacts.value.succeeded,1);assert.equal(f.page.bookshelfCatalogFacts.value.failed,2);
    assert.match(f.page.shelfRecovery().message,/成功 1\/3，失败 2/);assert.equal(f.page.shelfRecovery().canRetry,false);
    assert.equal(f.calls.some(c=>/clear|delete|remove|progress.update/.test(c.method)),false);
  } finally {f.runtime.close();}
});
await check('automatic checks retain 10-minute threshold and disabled/local/active-sweep exclusions',async()=>{
  const fresh=book('/fresh',{lastCheckAt:Date.now()/1000});const due=book('/due',{lastCheckAt:Date.now()/1000-601});
  const f=fixture([fresh,due,book('/local',{sourceId:'local'})]);try {
    await f.runtime.acquireBook(seed('/due'),{forceRefresh:true});f.remoteCount(2);f.calls.length=0;
    f.page.settingsSnapshot.autoCheckUpdate=false;f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);assert.equal(f.calls.length,0);
    f.page.settingsSnapshot.autoCheckUpdate=true;f.page.bookshelfUpdateRunning=true;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);assert.equal(f.calls.length,0);f.page.bookshelfUpdateRunning=false;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.deepEqual(f.calls.filter(c=>c.method==='book.detail').map(c=>c.params.book.bookId),['/due']);
    assert.equal(f.catalogs.get('/due').length,2,'automatic check still gets the new catalog');
    assert.equal(f.prefetched.length,0,'automatic catalogs cannot launch competing body sweeps');
  }finally{f.runtime.close();}
});
await check('cold scoped manga skips only automatic catalog refresh while other and manual checks continue',async()=>{
  const protectedBook=book('/offline',{contentKind:'manga'}),other=book('/other');
  const f=fixture([protectedBook,other]);
  const probe=new MangaOfflineNetworkProbe({sourceId,bookId:'/offline'});
  f.owner.mangaOfflineProbeProtectsAutomaticCatalog=(source,book)=>probe.protectsAutomaticCatalog(source,book);
  try {
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.deepEqual(f.calls.filter(c=>c.method==='book.detail').map(c=>c.params.book.bookId),['/other'],
      'armed exact target must never enter automatic detail acquisition');
    assert.equal(f.calls.some(c=>c.method==='book.toc'&&c.params.bookId==='/offline'),false);
    assert.equal(JSON.parse(probe.snapshot()).coreHttpAttempts,0,'the skip cannot redefine the HTTP attempt counter');
    f.calls.length=0;
    probe.select(sourceId,'/offline',true);
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.equal(f.calls.some(c=>c.method==='book.detail'&&c.params.book.bookId==='/offline'),false,
      'active exact target remains protected before the next automatic dispatch');
    f.calls.length=0;
    f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
    assert.equal(f.calls.some(c=>c.method==='book.detail'&&c.params.book.bookId==='/offline'),true,
      'explicit user update retains the normal catalog path');
    f.calls.length=0;
    probe.release('reader-left');
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.equal(f.calls.some(c=>c.method==='book.detail'&&c.params.book.bookId==='/offline'),true,
      'released debug scope restores ordinary automatic catalog checks');
  } finally {f.runtime.close();}
});
await check('automatic work waits for settings and yields to reading; manual work stays explicit',async()=>{
  const f=fixture([book('/a'),book('/b'),book('/c')]);try {
    f.page.applicationSettingsSnapshot=undefined;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await pause();assert.equal(f.calls.length,0);
    f.page.applicationSettingsSnapshot={autoCheckUpdate:true};
    const priorities=[];const acquire=f.runtime.acquireBook.bind(f.runtime);
    f.runtime.acquireBook=async(seed,options,priority)=>{
      priorities.push(priority);const session=await acquire(seed,options,priority);
      f.page.readingSessionActive=true;f.page.route='reading';return session;
    };
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfCatalogHost.snapshot().automaticRunning);
    assert.ok(priorities.length>0 && priorities.every(p=>p==='background'));
    assert.ok(!f.calls.some(c=>c.params.book?.bookId==='/c'));
    assert.equal(f.projections(),0,'no late shelf read when foreground reading takes over');
    assert.equal(f.prefetched.length,0);
  } finally {f.runtime.close();}
});
await check('paged filtered shelf automatic sweep covers offscreen targets and cancels before network',async()=>{
  const f=fixture([book('/visible',{lastCheckAt:Date.now()/1000}),book('/offscreen')]);try {
    f.page.shelfProjectionRevision='r';f.page.shelfBooks=f.page.shelfBooks.slice(0,1);
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.deepEqual(f.calls.filter(c=>c.method==='book.detail').map(c=>c.params.book.bookId),['/offscreen']);
    f.calls.length=0;
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    f.page.route='reading';f.page.readingSessionActive=true;
    await until(()=>!f.page.bookshelfCatalogHost.snapshot().automaticRunning);
    assert.equal(f.calls.length,0,'cancelled target read cannot start network acquisition');
  }finally{f.runtime.close();}
});
await check('automatic catalog projection does not rescan its own new revision',async()=>{
  const f=fixture([book('/due')]);try {
    f.page.shelfProjectionRevision='r';
    f.page.applyBookshelfState=()=>{ f.page.shelfProjectionRevision='r2'; };
    f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
    await until(()=>!f.page.bookshelfBackgroundRefreshRunning);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1,'the due catalog is checked once');
    assert.equal(f.projections(),1,'the refreshed shelf projection is applied once');
    assert.equal(f.page.shelfProjectionRevision,'r2');
    assert.equal(f.fullScans(),1,'own projection publication must not trigger another full scan');
  }finally{f.runtime.close();}
});
await check('multiple force waiters share one refresh after the nonforce admission settles',async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const old=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    const one=f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    const two=f.runtime.acquireBook(seed('/one'),{forceRefresh:true});
    f.remoteCount(6);gate.resolve();
    const [prior,a,b]=await Promise.all([old,one,two]);
    assert.equal(prior.entries.length,1);assert.equal(a,b);assert.equal(a.entries.length,6);
    assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);
    assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
  }finally{f.runtime.close();}
});
for(const change of ['cancel','close','source-delete']) await check(`force waiting revalidates ${change} before new network work`,async()=>{
  const f=fixture();try {
    await f.runtime.acquireBook(seed('/one'),{forceRefresh:true});f.runtime.prepared.clear();
    const gate=deferred();f.cacheGate(gate);f.calls.length=0;
    const old=f.runtime.acquireBook(seed('/one'));
    await until(()=>f.calls.some(c=>c.method==='cache.book.status'));
    let current=true;
    const force=f.runtime.acquireBook(seed('/one'),{forceRefresh:true,isCurrent:()=>current});
    // Attach rejection handlers before the simulated owner/configuration changes.
    const outcomes=Promise.allSettled([old,force]);
    if(change==='cancel') current=false;
    else if(change==='close') f.runtime.close();
    else await f.runtime.request('source.delete',{sourceIds:[sourceId]});
    gate.resolve();const result=await outcomes;
    assert.equal(result[1].status,'rejected');
    assert.equal(f.calls.some(c=>c.method==='book.detail'||c.method==='book.toc'),false);
    assert.equal(f.catalogs.get('/one').length,1,'cached directory survives every waiting cancellation');
  }finally{f.runtime.close();}
});
await check('accepted catalog ACK + failed shelf read offers readonly retry, never another force write',async()=>{
 const f=fixture();try{f.failProjection(true);f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
  assert.equal(f.page.bookshelfCatalogFacts.fact,'refreshFailed');assert.equal(f.page.bookshelfCatalogFacts.value.succeeded,1);assert.equal(f.page.shelfRecovery().canRetry,true);
  const writes=f.calls.filter(c=>c.method==='book.toc').length;f.failProjection(false);const token=f.page.shelfRecovery().generation;
  await Promise.all([f.page.reconcileBookshelfCatalogProjection(token),f.page.reconcileBookshelfCatalogProjection(token)]);
  assert.equal(f.calls.filter(c=>c.method==='book.toc').length,writes);assert.equal(f.page.bookshelfCatalogFacts.fact,'current');assert.equal(f.projections(),2);
 }finally{f.runtime.close();}
});
for(const automatic of [false,true])for(const retirement of ['runtime-unset','runtime-replaced','navigation','closed'])await check(`${automatic?'auto':'manual'} deferred catalog work cannot acquire/reload/publish another Runtime after ${retirement}`,async()=>{
 const f=fixture([book('/a'),book('/b'),book('/c')]);try{
  let gate=deferred(),accepted=0;const acquire=f.runtime.acquireBook.bind(f.runtime);
  f.runtime.acquireBook=async(...args)=>{accepted++;const session=await acquire(...args);await gate.promise;return session;};
  if(automatic)f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);else f.page.startManualBookshelfUpdate();
  await until(()=>accepted===2);const before=structuredClone({facts:f.page.bookshelfCatalogFacts,done:f.page.bookshelfUpdateDone});
  if(retirement==='runtime-unset')f.setOwner(undefined);if(retirement==='runtime-replaced')f.setOwner({});
  if(retirement==='navigation')f.page.navigationGeneration++;if(retirement==='closed')f.page.shelfReceiptRetired=true;
  // Actual owner absence must be safe while already admitted RPCs finish.
  if(retirement==='closed'&&automatic){f.page.readingSessionActive=true;}
  gate.resolve();await pause();await pause();assert.equal(accepted,2);assert.equal(f.projections(),0);assert.equal(f.prefetched.length,0);
  assert.deepEqual({facts:f.page.bookshelfCatalogFacts,done:f.page.bookshelfUpdateDone},before);
 }finally{f.runtime.close();}
});
await check('body preparation failure preserves catalog success as a separate fact',async()=>{
 const f=fixture();try{f.page.prefetchReadingWindow=async()=>{throw Error('body failure');};f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
  assert.equal(f.page.bookshelfCatalogFacts.value.succeeded,1);assert.equal(f.page.bookshelfCatalogFacts.value.failed,0);assert.equal(f.page.bookshelfCatalogFacts.value.preparationFailed,1);assert.equal(f.page.bookshelfCatalogFacts.fact,'partial');
 }finally{f.runtime.close();}
});
await check('actual Host -> Index -> SDK Shell/Notice/physical retry separates partial and readback failure',async()=>{
 const f=fixture([book('/broken'),book('/good')]);try{
  f.modes.set('/broken','error');f.failProjection(true);f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
  const shown=actualRecovery(f);assert.equal(shown.props.updateProgressDone,2);assert.equal(shown.props.updateProgressTotal,2);
  assert.match(shown.notice.view.message,/成功 1\/2，失败 1/);assert.ok(shown.action);assert.equal(shown.notice.view.canRetry,true);
  const writes=f.calls.filter(call=>call.method==='book.toc').length;f.failProjection(false);
  shown.action.onClick();shown.action.onClick();await until(()=>!f.page.bookshelfCatalogFacts.canRetry&&f.page.bookshelfCatalogFacts.fact==='partial');
  assert.equal(f.calls.filter(call=>call.method==='book.toc').length,writes);assert.equal(f.projections(),2);
  const partial=actualRecovery(f);assert.match(partial.notice.view.message,/成功 1\/2，失败 1/);assert.equal(partial.action,undefined);
  // Real old native recovery callback cannot force a new catalog mutation.
  f.page.navigationGeneration++;const before=f.projections();shown.action.onClick();await pause();assert.equal(f.projections(),before);
 }finally{f.runtime.close();}
});
await check('target-read rejection is the only phase allowed to say catalog checks never started',async()=>{
 const f=fixture();try{f.page.shelfProjectionRevision='r';f.failTargets(true);
 f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
 assert.equal(f.page.bookshelfCatalogFacts.fact,'failed');assert.match(actualRecovery(f).notice.view.message,/未启动检查/);
 assert.equal(f.calls.filter(c=>c.method==='book.toc').length,0);assert.equal(f.projections(),0);
 }finally{f.runtime.close();}
});
await check('progress publication throws do not erase real catalog ACKs or abort remaining books',async()=>{
 const f=fixture([book('/a'),book('/b'),book('/c')]);try{
 f.modes.set('/b','error');Object.defineProperty(f.page,'bookshelfUpdateDone',{get:()=>0,set:value=>{if(value>0)throw Error('progress render unavailable');},configurable:true});
 f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfCatalogHost.snapshot().manualRunning);
 assert.equal(f.page.bookshelfCatalogHost.snapshot().facts.value.succeeded,2);assert.equal(f.page.bookshelfCatalogHost.snapshot().facts.value.failed,1);
 assert.equal(f.calls.filter(c=>c.method==='book.toc').length,3);assert.equal(f.projections(),1);
 Object.defineProperty(f.page,'bookshelfUpdateDone',{value:0,writable:true,configurable:true});f.page.rssInstanceIdentity++;f.page.getBookshelfCatalogOwner();
 assert.match(actualRecovery(f).notice.view.message,/成功 2\/3，失败 1/);assert.doesNotMatch(f.page.shelfRecovery().message,/未启动/);
 assert.ok(f.projectionAdmissions.every(admit=>typeof admit==='function'&&!admit()),'old source presentation is retired after successful exact dispatch; restored current consumer cannot reuse its old IO predicate');
 }finally{f.runtime.close();}
});
await check('executed work and readback diagnostic failures preserve progress and cannot claim no dispatch',async()=>{
 const f=fixture();try{f.failProjection(true);f.diagnosticThrows(true);const host=f.page.getBookshelfCatalogOwner(),batch=host.runBatch.bind(host);
 host.runBatch=async(...args)=>{await batch(...args);throw Error('final publication unavailable');};
 f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
 assert.equal(f.page.bookshelfCatalogFacts.fact,'partial');assert.equal(f.page.bookshelfCatalogFacts.value.succeeded,1);
 assert.match(actualRecovery(f).notice.view.message,/已确认成功 1/);assert.doesNotMatch(f.page.shelfRecovery().message,/未启动/);
 const writes=f.calls.filter(c=>c.method==='book.toc').length;f.failProjection(false);
 await f.page.reconcileBookshelfCatalogProjection(f.page.bookshelfCatalogFacts.generation);
 assert.equal(f.calls.filter(c=>c.method==='book.toc').length,writes);assert.equal(f.page.bookshelfCatalogFacts.fact,'current');
 }finally{f.runtime.close();}
});
await check('finite exact-Runtime catalog owner survives real Host/Index reconstruction with one accepted mutex',async()=>{
 const f=fixture();try {
  const gate=deferred();f.tocGate(gate);f.page.startManualBookshelfUpdate();await until(()=>f.calls.some(call=>call.method==='book.toc'));
  const original=f.page.getBookshelfCatalogOwner(),oldDone=f.page.bookshelfUpdateDone,page=reconstructCatalog(f);
  assert.equal(page.getBookshelfCatalogOwner(),original);assert.equal(page.bookshelfUpdateRunning,true);page.startManualBookshelfUpdate();
  assert.equal(f.calls.filter(call=>call.method==='book.toc').length,1,'actual shared mutex prevents a second force refresh');
  gate.resolve();await until(()=>!original.snapshot().manualRunning);
  assert.equal(page.bookshelfUpdateRunning,false,'same-Runtime successor receives original settlement');assert.equal(f.page.bookshelfUpdateDone,oldDone);
  const before=f.calls.length;f.page.startManualBookshelfUpdate();assert.equal(f.calls.length,before,'old Index cannot replace current binding');
  assert.equal(page.getBookshelfCatalogOwner(),original);
 }finally{f.runtime.close();}
});
await check('warm readback failure retains original fact and readonly recovery after Index reconstruction',async()=>{
 const f=fixture();try{
  f.failProjection(true);f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
  const original=f.page.getBookshelfCatalogOwner(),facts=original.snapshot().facts,oldNotice=actualRecovery(f),page=reconstructCatalog(f);
  assert.equal(page.getBookshelfCatalogOwner(),original);assert.equal(page.bookshelfCatalogFacts,facts);assert.equal(facts.fact,'refreshFailed');f.failProjection(false);
  const before=f.projections();oldNotice.action.onClick();await pause();assert.equal(f.projections(),before,'old physical notice cannot borrow successor Index');
  const current=actualRecovery({...f,page});current.action.onClick();current.action.onClick();await until(()=>original.snapshot().facts.fact==='current');
  assert.equal(f.projections(),before+1,'current physical retry is single pure read');assert.equal(f.calls.filter(call=>call.method==='book.toc').length,1);
 }finally{f.runtime.close();}
});
await check('actual SDK retained Shell nav update rotates only result Notice with immutable old callbacks',async()=>{
 const f=fixture();try{
  f.failProjection(true);f.page.startManualBookshelfUpdate();await until(()=>!f.page.bookshelfUpdateRunning);
  const old=actualRecovery(f),text=ets('features/bookshelf/BookshelfShell.ets'),sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  sdk.childSources.BookshelfMoreMenu=ets('features/bookshelf/BookshelfMoreMenu.ets');
  const shell=sdk.consumer(text,['recovery','readRecovery','populated','reduceMotion','onReconcile','onRetryRead','navigationGeneration','onNavigationGenerationChanged','registerTemporaryBackGeneration','onTemporaryBackBridge','temporaryBackGeneration','temporaryBackIdentity','mounted','moreMenuVisible','dismissMoreMenu','shellContent','content','recoveryNoticeContent'],{BookshelfMoreMenu:Child,bookshelfTemporaryGeneration:0,READER_FLOATING_TOP_BAR_HEIGHT:56},old.props);
  shell.content=()=>{};shell.topBar=()=>{};shell.shellContent();
  const oldAction=sdk.nodes(shell).find(node=>node.height===36&&node.onClick),oldNotice=sdk.walk(shell).find(node=>node instanceof sdk.deps.ReaderRecoveryNotice);
  const oldPhysical=oldAction.onClick,oldHandler=oldNotice.onReconcile,sequence=f.page.bookshelfCatalogFacts.generation;
  f.page.navigationGeneration++;f.page.getBookshelfCatalogOwner();const current=actualRecovery(f);shell.updateStateVars(current.props);sdk.properties.flush();
  const freshNotice=sdk.walk(shell).find(node=>node instanceof sdk.deps.ReaderRecoveryNotice&&node!==oldNotice);assert.ok(freshNotice,'finite result Notice rotates by navigation');
  const freshAction=[...freshNotice.children.values()].flatMap(node=>[...node.nodes.values()]).find(node=>node.height===36&&node.onClick);assert.ok(freshAction);
  f.failProjection(false);const before=f.projections();oldPhysical();oldHandler(sequence);await pause();assert.equal(f.projections(),before,'old gesture/callback retain original nav');
  freshAction.onClick();freshAction.onClick();await until(()=>f.page.bookshelfCatalogFacts.fact==='current');assert.equal(f.projections(),before+1);
  assert.equal(f.calls.filter(call=>call.method==='book.toc').length,1);
 }finally{f.runtime.close();}
});
await check('latest automatic intent keeps its own exact binding across same-Runtime reconstruction',async()=>{
 const f=fixture();try {
  const gate=deferred();f.targetsGate(gate);f.page.shelfProjectionRevision='r';f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  await until(()=>f.fullScans()===1);const owner=f.page.getBookshelfCatalogOwner(),page=reconstructCatalog(f);
  assert.equal(page.getBookshelfCatalogOwner(),owner);page.scheduleBookshelfBackgroundRefresh(page.shelfBooks);
  assert.equal(f.fullScans(),1,'new intent waits for original accepted scan');gate.resolve();await until(()=>!owner.snapshot().automaticRunning);
  assert.equal(f.fullScans(),2,'new same-revision presentation drains exactly its one pending intent');
  assert.equal(f.calls.filter(call=>call.method==='book.toc').length,1,'old retired targets never dispatch catalog IO');
  assert.equal(page.bookshelfBackgroundRefreshRunning,false);
 }finally{f.runtime.close();}
});
for(const r of results) console.log(JSON.stringify(r));
if(results.some(r=>r.status==='FAIL')) process.exitCode=1;
else console.log('PH60 real Index → Gateway → Coordinator manual catalog refresh and bounded failure recovery PASS');
