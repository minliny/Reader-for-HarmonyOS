import {RealRssOrchestrator,replaceRssRuntime} from './lib/rss-operation-fixture.mjs';
import { RssPresentationProjection } from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import {bookshelfOperationClass} from './lib/bookshelf-operation-owner-probe.mjs';
import assert from 'node:assert/strict';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {readFileSync} from 'node:fs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {compileHost} from './lib/reading-entry-owner-probe.mjs';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import {actualSourceManagementTypes} from './lib/source-management-owner-probe.mjs';
const file=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
let currentOwner, unavailable=false;
const authority=runtimeOwnerIdentityProbe(()=>unavailable?undefined:currentOwner);
const sourceTypes=actualSourceManagementTypes({ReaderRuntimeOwner:authority});
const ActualTools=bookshelfOperationClass('features/source/SourceToolsOrchestrator.ets','SourceToolsOrchestrator',
 {ReaderRuntimeOwner:authority,SourceGateway:sourceTypes.SourceGateway});
const Entry=compileHost(undefined,{ReaderRuntimeOwner:authority,
 RemoteReadingFlowGateway:class {constructor(owner){this.owner=owner;}async loadChapter(session,index){this.owner.calls.push('chapter.content');this.owner.revision+=2;
 return{sourceId:session.identity.sourceId,bookId:session.identity.bookId,chapterIndex:index,chapterUrl:session.entries[0].url,
 contentVersion:'version',bodyVersion:'body',processingVersion:'processing',content:'正文'.repeat(40),images:[]};}}});
const EMPTY_READABLE_ADMISSION={generation:0,adding:false,cancelling:false,confirmation:'none'};
const Index=productionMotionMethods(file,['showIndexAlert','showSourceImportResult','showSourceImportResultFromSearch',
 'requestSourceDelete','requestRssSubscriptionDelete','requestRssSourceImport','showRssOperationResult',
 'runIndexRecoveryAction','runSourceImportSearchAction','requestClearDirectoryBookOffline','refreshCachedChapterFromPrompt','showReadingFailure','nextNavigationGeneration',
 'aboutToDisappear','isCurrentRssHostPresentation','isCurrentRssPresentation','isCurrentRoute','confirmRssSubscriptionDelete','rssSubscriptions','importRssSources','bindReadingEntryReader','isCurrentSourceToolsPresentation'],{
 ReadingEntryHost:Entry,EMPTY_READABLE_ADMISSION,LOCAL_SOURCE_ID:'local',
 RssPresentationProjection,ReaderNativeAlertOwner,ReaderRuntimeOwner:{current:()=>{if(unavailable)throw Error('runtime unavailable');return currentOwner;}},isReaderProductSurfaceEnabled:()=>true,
 hilog:{warn(){}},DOMAIN:1,verdictForFailureKind:()=> 'networkFailed',remoteReadingFailureKindOf:()=> 'networkFailed',
 withPreparedRemoteChapter:(session,chapter,revision)=>({...session,preparedChapter:{...chapter,projectionRevision:revision}}),
 RemoteReadingFlowGateway:class {constructor(owner){this.owner=owner;}async loadChapter(){this.owner.calls.push('chapter.content');this.owner.revision+=2;return {chapterIndex:0};}}
});
const ActualBookshelfHost=bookshelfOperationClass('features/bookshelf/BookshelfHost.ets','BookshelfHost');
function fixture(route='source'){
 unavailable=false;let shown,fail=false;const calls=[];
 const owner={calls,revision:3,supportsCoreCapability:()=>false,bookAcquisitions(){return{readingProjectionRevision:()=>owner.revision,endSearch(){},setPreparationVisible(){}};},readingEntryPreparations:()=>({setPaused(){}})};currentOwner=owner;
 const host={deleteSelected(ids){calls.push(['deleteSources',ids]);},removeSubscription(id){calls.push(['deleteRss',id]);},importSources(_replace,done,failed){calls.push('rss.confirmed-write');try{done({imported:2});}catch(error){failed(error);}},exportSources(){}};
 const p=Object.assign(new Index(),{bookshelfHost:new ActualBookshelfHost(()=>{},()=>false),nativeAlertOwner:new ReaderNativeAlertOwner(),route,navigationGeneration:1,shelfReceiptRetired:false,
  mountedRuntimeOwner:owner,detailShelfAdmissionMount:1,detailBook:{sourceId:'s',bookId:'b',title:'书',author:'作者'},
  detailToc:[{index:0,title:'章',url:'/0'}],shelfOperation:{generation:0,removalKey:'',busy:false},detailReadableAdmission:()=>EMPTY_READABLE_ADMISSION,
  sourceManagementReturnTarget:'search',sourceManagementSearchKeyword:'abc',sourceToolsSnapshot:{sources:[{sourceId:'s'}],sourceListRevision:3,selectionRevision:4,busy:false},
  sourceToolsPresentationIdentity:'native-tools:1',rssPresentationIdentity:'native-rss:1',rssOrchestrator:host,rssPresentation:{kind:'feed',subscriptions:[{subscriptionId:'rss',title:'源'}]},jsonImportVisible:false,
  remoteSessionGeneration:2,remoteReadingSession:{identity:{sourceId:'s',bookId:'b'},book:{title:'书',author:'作者'},sourceVersion:'v',catalogVersion:'c',contextVersion:'x',
   entries:[{index:0,title:'章',url:'/0',variables:[]}],acquisitionMode:'online',hostRequirements:[],continuationVariables:[]},offlineMutationActiveKey:'',
  getSourceToolsOrchestrator:()=>host,getRssOrchestrator:()=>host,returnFromSourceManagement:()=>calls.push('returnSearch'),
  openJsonImport:context=>{calls.push(context);p.jsonImportVisible=true;},clearDirectoryBookOffline:()=>calls.push('clearOffline'),
  getUIContext:()=>({showAlertDialog(options){if(fail)throw Error('platform unavailable');shown=options;}}),
  shelfWriteGeneration:0,searchHost:{close(){}},dismissBookRemovalDialog(){}});
 // The original test observes native effect dispatch rather than a mutation
 // ACK. Attachment/selection are the actual whole domain class; the new cold
 // consumer gate separately proves the complete Core/Atomic write journey.
 const tools=new ActualTools(()=>{},()=>false,owner);tools.snapshot={...tools.current(),...p.sourceToolsSnapshot,
  selectedSourceIds:['s'],selectedSourceCount:1};p.sourceToolsOrchestrator=tools;
 tools.deleteSelected=ids=>calls.push(['deleteSources',ids]);
 tools.attachPresentation(p.sourceToolsPresentationIdentity,snapshot=>p.sourceToolsSnapshot=snapshot,
  ()=>authority.isCurrent(owner)&&p.route==='sourceTools'&&!p.shelfReceiptRetired);
 replaceRssRuntime(owner);const rss=new RealRssOrchestrator(()=>{},()=>p.route==='rssSubscriptionManagement',owner);p.rssOrchestrator=rss;
 rss.attachPresentation(p.rssPresentationIdentity,()=>{},()=>p.route==='rssSubscriptionManagement',()=>{},()=>{},()=>authority.isCurrent(owner)&&!p.shelfReceiptRetired);
 rss.removeSubscription=id=>calls.push(['deleteRss',id]);
 rss.importSources=(_replace,done,failed)=>{calls.push('rss.confirmed-write');try{done({imported:2});}catch(error){failed(error);}};
 host.detachPresentation=()=>{};
 p.bindReadingEntryReader();
 return{p,calls,host,owner,shown:()=>shown,nativeFail:()=>{fail=true;}};
}
const cases=[
 {name:'sourceDelete',route:'sourceTools',show:f=>f.p.requestSourceDelete(['s']),button:'secondaryButton',value:'删除',effect:'deleteSources',
  stale:[f=>f.p.sourceToolsSnapshot.sourceListRevision++,f=>f.p.sourceToolsSnapshot.selectionRevision++,f=>f.p.sourceToolsSnapshot.busy=true,f=>f.p.sourceToolsSnapshot.sources=[]]},
 {name:'rssDelete',route:'rssSubscriptionManagement',show:f=>f.p.requestRssSubscriptionDelete('rss'),button:'secondaryButton',value:'删除',effect:'deleteRss',
  stale:[f=>f.p.rssPresentation.subscriptions=[],f=>f.p.rssPresentation.subscriptions=[{subscriptionId:'rss',title:'新源'}]]},
 {name:'rssImport',route:'rssSubscriptionManagement',show:f=>f.p.requestRssSourceImport(),button:'secondaryButton',value:'覆盖全部',effect:'rssReplace',
  stale:[f=>f.p.jsonImportVisible=true,f=>f.p.rssOrchestrator={}]},
 {name:'offlineClear',route:'directory',show:f=>f.p.requestClearDirectoryBookOffline(),button:'secondaryButton',value:'清除',effect:'clearOffline',
  stale:[f=>f.p.remoteReadingSession={identity:{sourceId:'s',bookId:'new'}},f=>f.p.remoteSessionGeneration++,f=>f.p.offlineOperationActive=true]},
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
 const f=fixture(route);f.p[method]('title','message');assert.equal(f.shown(),undefined,'automatic feedback never opens native Alert');
 assert.match(route==='source'?f.p.sourceStatusMessage:route==='reading'?f.p.indexRecoveryNotice.message:f.p.rssOperationResultMessage,/title.*message/);
 if(route==='reading')assert.equal(f.p.indexRecoveryNotice.canRetry,false);
 f.nativeFail();assert.doesNotThrow(()=>f.p[method]('confirmed','platform failure'));
}
for(const mutate of [undefined,f=>f.p.navigationGeneration++,f=>f.p.route='settings',f=>currentOwner={},f=>f.p.shelfReceiptRetired=true,
 f=>f.p.sourceManagementSearchKeyword='new',f=>f.p.sourceManagementReturnTarget='settings',f=>f.p.nextNavigationGeneration(),f=>f.p.aboutToDisappear()]){
 const f=fixture('source');f.p.showSourceImportResultFromSearch('title','message');const revision=f.p.sourceImportSearchActionRevision;
 assert.equal(f.shown(),undefined);assert.equal(f.p.sourceImportSearchActionLabel,'重新搜索');assert.equal(f.calls.length,0,'result never auto-searches');
 if(mutate)mutate(f);f.p.runSourceImportSearchAction(revision);f.p.runSourceImportSearchAction(revision);
 assert.equal(f.calls.filter(c=>c==='returnSearch').length,mutate?0:1,'inline action retains original keyword/owner and runs once');
}
{const f=fixture('source');f.p.sourceManagementSearchKeyword='';f.p.showSourceImportResultFromSearch('title','message');assert.equal(f.shown(),undefined);assert.equal(f.p.sourceImportSearchActionLabel,'');}
{const f=fixture('source');f.p.showSourceImportResultFromSearch('first','message');const old=f.p.sourceImportSearchActionRevision;
 f.p.showSourceImportResultFromSearch('second','message');f.p.runSourceImportSearchAction(old);assert.equal(f.calls.length,0,'replaced result action cannot borrow the successor');}
{const f=fixture('rssSubscriptionManagement');f.nativeFail();f.p.importRssSources(false);assert.deepEqual(f.calls,['rss.confirmed-write'],'inline result does not invoke import failure callback');}
for(const exit of ['click','none','navigation','close','owner','session','current','native-error']){
 const f=fixture('reading');let current=true;if(exit==='native-error')f.nativeFail();
 const error={message:'缓存核对',session:f.p.remoteReadingSession,chapterIndex:0,refreshPreserved:false};
 const result=await f.p.refreshCachedChapterFromPrompt(error,()=>current);
 assert.equal(result,undefined,'background recovery ends without waiting for a dialog');assert.equal(f.shown(),undefined);
 assert.equal(f.calls.filter(x=>x==='chapter.content').length,0,'no new body without explicit inline refresh');
 assert.equal(f.p.indexRecoveryNotice.canRetry,true);assert.equal(f.p.indexRecoveryActionLabel,'刷新本章');
 const revision=f.p.indexRecoveryNotice.generation;
 if(exit==='navigation')f.p.nextNavigationGeneration();
 if(exit==='close')f.p.aboutToDisappear();
 if(exit==='owner')currentOwner={};
 if(exit==='session'){f.p.remoteReadingSession={identity:{sourceId:'new',bookId:'new'}};f.p.detailBook={sourceId:'new',bookId:'new',title:'new'};f.p.bindReadingEntryReader();}
 if(exit==='current')current=false;
 if(exit!=='none'){f.p.runIndexRecoveryAction(revision);f.p.runIndexRecoveryAction(revision);}
 await new Promise(resolve=>setImmediate(resolve));
 const accepted=exit==='click'||exit==='native-error';
 assert.equal(f.calls.filter(x=>x==='chapter.content').length,accepted?1:0,'only exact current inline refresh may fetch once');
 assert.equal(f.p.route,'reading','recovery feedback does not navigate');
 if(accepted)assert.equal(f.p.remoteReadingSession.preparedChapter!==undefined,true,'explicit refresh publishes the current chapter in place');
}
{const f=fixture('reading');f.p.showReadingFailure('first','message');const stale=f.p.indexRecoveryNotice.generation;
 let runs=0;f.p.showIndexRecoveryNotice('second','Retry',()=>runs++);f.p.runIndexRecoveryAction(stale);assert.equal(runs,0);}
for(const timing of ['before-show','after-show','retired','confirmed-import']){
 const f=fixture(timing==='confirmed-import'?'rssSubscriptionManagement':'source');
 if(timing==='after-show'){const lease=f.p.showIndexAlert('notice',{title:'x',primaryButton:{value:'x',action:()=>f.calls.push('acted')}});unavailable=true;f.shown().primaryButton.action();assert.equal(await lease.decision,'retired');assert.deepEqual(f.calls,[]);}
 else{if(timing==='confirmed-import')f.p.rssOrchestrator.importSources=(_replace,done,failed)=>{f.calls.push('rss.confirmed-write');unavailable=true;try{done({imported:2});}catch(error){failed(error);}};else unavailable=true;if(timing==='retired')f.p.shelfReceiptRetired=true;assert.doesNotThrow(()=>timing==='confirmed-import'?f.p.importRssSources(false):f.p.showSourceImportResult('confirmed','notice'));assert.deepEqual(f.calls,timing==='confirmed-import'?['rss.confirmed-write']:[]);}
 unavailable=false;
}
const raw=readFileSync(file,'utf8');assert.equal((raw.match(/\.showAlertDialog\(/g)??[]).length,1,'Index has one actual native host implementation');
assert.equal((raw.match(/this\.showIndexAlert\(/g)??[]).length,4,'only four explicit destructive/overwrite choices use native Alert');
{
 const f=fixture('reading'),sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const p=sdk.consumer(raw,['indexRecoveryNoticeContent','showIndexRecoveryNotice','runIndexRecoveryAction','clearIndexRecoveryNotice','isCurrentRuntime'],
  {ReaderRuntimeOwner:{isCurrent:owner=>owner===f.owner}},{});
 Object.assign(p,{route:'reading',navigationGeneration:1,shelfReceiptRetired:false,mountedRuntimeOwner:f.owner,detailShelfAdmissionMount:1,appThemeScheme:'day'});
 let actions=0;p.showIndexRecoveryNotice('后台核对中','重试',()=>actions++);p.indexRecoveryNoticeContent();
 const action=()=>sdk.nodes(p).findLast(n=>n.type==='Text'&&n.create==='重试'&&n.onClick).onClick;
 const old=action(),frame=sdk.nodes(p).find(n=>n.type==='Column'&&n.align==='Alignment.Bottom');
 assert.ok(frame);assert.equal(frame.height,undefined,'feedback frame never owns full screen height');assert.equal(frame.hitTestBehavior,'HitTestMode.Transparent');
 const text=sdk.nodes(p).find(n=>n.type==='Text'&&n.create==='后台核对中');assert.equal(text.hitTestBehavior,'HitTestMode.None');
 p.showIndexRecoveryNotice('下一项核对','重试',()=>actions++);sdk.properties.flush();p.replay();
 old();assert.equal(actions,0,'old physical action cannot borrow successor recovery generation');
 action()();action()();assert.equal(actions,1,'current real shared native action executes once');
}
console.log('PASS Index four explicit Alert confirmations plus five nonmodal feedback consumers: exact identity, once-only inline actions, unblocked cache probe, no silent content refresh/navigation and native failure independent from writes');
