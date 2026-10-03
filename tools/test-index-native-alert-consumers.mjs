import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const file=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
let currentOwner, unavailable=false;
const Index=productionMotionMethods(file,['showIndexAlert','showSourceImportResult','showSourceImportResultFromSearch',
 'requestSourceDelete','requestRssSubscriptionDelete','requestRssSourceImport','showRssOperationResult',
 'requestClearDirectoryBookOffline','refreshCachedChapterFromPrompt','showReadingFailure','nextNavigationGeneration',
 'aboutToDisappear','confirmRssSubscriptionDelete','rssSubscriptions','importRssSources'],{
 ReaderNativeAlertOwner,ReaderRuntimeOwner:{current:()=>{if(unavailable)throw Error('runtime unavailable');return currentOwner;}},isReaderProductSurfaceEnabled:()=>true,
 hilog:{warn(){}},DOMAIN:1,verdictForFailureKind:()=> 'networkFailed',remoteReadingFailureKindOf:()=> 'networkFailed',
 withPreparedRemoteChapter:(session,chapter,revision)=>({...session,preparedChapter:{...chapter,projectionRevision:revision}}),
 RemoteReadingFlowGateway:class {constructor(owner){this.owner=owner;}async loadChapter(){this.owner.calls.push('chapter.content');this.owner.revision+=2;return {chapterIndex:0};}}
});
const ActualBookshelfHost=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost');
function fixture(route='source'){
 unavailable=false;let shown,fail=false;const calls=[];
 const owner={calls,revision:3,bookAcquisitions(){return{readingProjectionRevision:()=>owner.revision,endSearch(){},};},readingEntryPreparations:()=>({setPaused(){}})};currentOwner=owner;
 const host={deleteSelected(ids){calls.push(['deleteSources',ids]);},removeSubscription(id){calls.push(['deleteRss',id]);},importSources(_replace,done,failed){calls.push('rss.confirmed-write');try{done({imported:2});}catch(error){failed(error);}},exportSources(){}};
 const p=Object.assign(new Index(),{bookshelfHost:new ActualBookshelfHost(()=>{},()=>false),nativeAlertOwner:new ReaderNativeAlertOwner(),route,navigationGeneration:1,shelfReceiptRetired:false,
  sourceManagementReturnTarget:'search',sourceManagementSearchKeyword:'abc',sourceToolsSnapshot:{sources:[{sourceId:'s'}],sourceListRevision:3,selectionRevision:4,busy:false},
  sourceToolsOrchestrator:host,rssOrchestrator:host,rssPresentation:{kind:'feed',subscriptions:[{subscriptionId:'rss',title:'源'}]},jsonImportVisible:false,
  remoteSessionGeneration:2,remoteReadingSession:{identity:{sourceId:'s',bookId:'b'}},offlineMutationActiveKey:'',
  consumeSourceToolsSelection:ids=>{p.sourceToolsSnapshot.selectionRevision++;return ids.filter(id=>p.sourceToolsSnapshot.sources.some(x=>x.sourceId===id));},
  getSourceToolsOrchestrator:()=>host,getRssOrchestrator:()=>host,returnFromSourceManagement:()=>calls.push('returnSearch'),
  openJsonImport:context=>{calls.push(context);p.jsonImportVisible=true;},clearDirectoryBookOffline:()=>calls.push('clearOffline'),
  installRemoteReadingSession:s=>{p.remoteReadingSession=s;},getUIContext:()=>({showAlertDialog(options){if(fail)throw Error('platform unavailable');shown=options;}}),
  shelfWriteGeneration:0,searchHost:{close(){}},dismissBookRemovalDialog(){}});
 return{p,calls,host,owner,shown:()=>shown,nativeFail:()=>{fail=true;}};
}
const cases=[
 {name:'sourceDelete',route:'sourceTools',show:f=>f.p.requestSourceDelete(['s']),button:'secondaryButton',value:'删除',effect:'deleteSources',
  stale:[f=>f.p.sourceToolsSnapshot.sourceListRevision++,f=>f.p.sourceToolsSnapshot.selectionRevision++,f=>f.p.sourceToolsSnapshot.busy=true,f=>f.p.sourceToolsSnapshot.sources=[]]},
 {name:'rssDelete',route:'rssSubscriptionManagement',show:f=>f.p.requestRssSubscriptionDelete('rss'),button:'secondaryButton',value:'删除',effect:'deleteRss',
  stale:[f=>f.p.rssPresentation.subscriptions=[],f=>f.p.rssPresentation.subscriptions=[{subscriptionId:'rss',title:'新源'}]]},
 {name:'rssImport',route:'rssSubscriptionManagement',show:f=>f.p.requestRssSourceImport(),button:'secondaryButton',value:'覆盖全部',effect:'rssReplace',
  stale:[f=>f.p.jsonImportVisible=true,f=>f.p.rssOrchestrator={}]},
 {name:'searchReturn',route:'source',show:f=>f.p.showSourceImportResultFromSearch('title','message'),button:'secondaryButton',value:'用新书源搜索「abc」',effect:'returnSearch',
  stale:[f=>f.p.sourceManagementSearchKeyword='new',f=>f.p.sourceManagementReturnTarget='settings']},
 {name:'offlineClear',route:'directory',show:f=>f.p.requestClearDirectoryBookOffline(),button:'secondaryButton',value:'清除',effect:'clearOffline',
  stale:[f=>f.p.remoteReadingSession={identity:{sourceId:'s',bookId:'new'}},f=>f.p.remoteSessionGeneration++,f=>f.p.offlineMutationActiveKey='new-task']},
];
for(const c of cases){
 const shared=[f=>f.p.navigationGeneration++,f=>f.p.route='settings',f=>currentOwner={},f=>f.p.shelfReceiptRetired=true,
  f=>f.p.nextNavigationGeneration(),f=>f.p.aboutToDisappear()];
 for(const mutate of [undefined,...shared,...c.stale]){
  const f=fixture(c.route);c.show(f);const native=f.shown();assert.ok(native,c.name);assert.equal(native.autoCancel,true);assert.equal(native[c.button].value,c.value);
  const title=native.title,message=native.message;if(mutate)mutate(f);native[c.button].action();native[c.button].action();
  assert.equal(f.calls.filter(x=>(Array.isArray(x)?x[0]:x)===c.effect).length,mutate?0:1,`${c.name}: once-only exact owner/entity/session action`);
  assert.equal(native.title,title);assert.equal(native.message,message);
 }
 const old=fixture(c.route);c.show(old);const native=old.shown();c.show(old);native[c.button].action();assert.equal(old.calls.length,0,`${c.name}: replaced presentation cannot act`);
 const closed=fixture(c.route);c.show(closed);closed.shown().cancel();closed.shown()[c.button].action();assert.equal(closed.calls.length,0,`${c.name}: cancel settles and retires action`);
}
for(const [route,method]of[['source','showSourceImportResult'],['rssSubscriptionManagement','showRssOperationResult'],['reading','showReadingFailure']]){
 const f=fixture(route);f.p[method]('title','message');const shown=f.shown();assert.equal(shown.title,'title');assert.equal(shown.primaryButton.value,'知道了');assert.equal(shown.autoCancel,true);
 f.p.nextNavigationGeneration();shown.primaryButton.action();assert.deepEqual(f.calls,[]);
 f.nativeFail();assert.doesNotThrow(()=>f.p[method]('confirmed','platform failure'));
}
{const f=fixture('source');f.p.sourceManagementSearchKeyword='';f.p.showSourceImportResultFromSearch('title','message');assert.equal(f.shown().secondaryButton,undefined);}
{const f=fixture('rssSubscriptionManagement');f.nativeFail();f.p.importRssSources(false);assert.deepEqual(f.calls,['rss.confirmed-write'],'native result notice failure must not invoke import failure callback');}
for(const exit of ['primary','secondary','cancel','retired','navigation','close','owner','session','current','native-error']){
 const f=fixture('reading');let current=true;if(exit==='native-error')f.nativeFail();
 const work=f.p.refreshCachedChapterFromPrompt({message:'缓存核对',session:f.p.remoteReadingSession,chapterIndex:0,refreshPreserved:false},()=>current);
 if(exit==='primary')f.shown().primaryButton.action();
 if(exit==='secondary')f.shown().secondaryButton.action();
 if(exit==='cancel')f.shown().cancel();
 if(exit==='retired')f.p.nativeAlertOwner.retire();
 if(exit==='navigation')f.p.nextNavigationGeneration();
 if(exit==='close')f.p.aboutToDisappear();
 if(exit==='owner'){currentOwner={};f.shown().primaryButton.action();}
 if(exit==='session'){f.p.remoteReadingSession={identity:{sourceId:'new',bookId:'new'}};f.shown().primaryButton.action();}
 if(exit==='current'){current=false;f.shown().primaryButton.action();}
 const result=await work;assert.equal(result,exit==='primary'?0:undefined,`${exit}: cache decision settles`);
 assert.equal(f.calls.filter(x=>x==='chapter.content').length,exit==='primary'?1:0,'no content dispatch without current primary decision');
 if(f.shown()){assert.equal(f.shown().autoCancel,false);assert.equal(f.shown().primaryButton.value,'刷新本章');assert.equal(f.shown().secondaryButton.value,'保留缓存');}
}
for(const timing of ['before-show','after-show','retired','confirmed-import']){
 const f=fixture(timing==='confirmed-import'?'rssSubscriptionManagement':'source');
 if(timing==='after-show'){const lease=f.p.showIndexAlert('notice',{title:'x',primaryButton:{value:'x',action:()=>f.calls.push('acted')}});unavailable=true;f.shown().primaryButton.action();assert.equal(await lease.decision,'retired');assert.deepEqual(f.calls,[]);}
 else{unavailable=true;if(timing==='retired')f.p.shelfReceiptRetired=true;assert.doesNotThrow(()=>timing==='confirmed-import'?f.p.importRssSources(false):f.p.showSourceImportResult('confirmed','notice'));assert.deepEqual(f.calls,timing==='confirmed-import'?['rss.confirmed-write']:[]);}
 unavailable=false;
}
const raw=readFileSync(file,'utf8');assert.equal((raw.match(/\.showAlertDialog\(/g)??[]).length,1,'Index has one actual native host implementation');
assert.equal((raw.match(/this\.showIndexAlert\(/g)??[]).length,9,'all nine current actual Index consumers use finite host');
console.log('PASS Index all nine real SDK-parsed native Alert consumers: exact identity/lifecycle, once-only actions, replacement/cancel/close/late owner, cache Promise settlement and native failure independent from confirmed writes');
