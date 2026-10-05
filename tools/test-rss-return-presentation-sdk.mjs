import assert from 'node:assert/strict';
import {readFileSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,seedEntry,settle} from './lib/rss-management-durable-probe.mjs';
import {deferred,until} from './lib/rules-mutation-durable-probe.mjs';
import {rssRecoverySurfaceSdk} from './lib/rss-recovery-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {actualBookshelfOperationTypes,actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {actualSourceManagementTypes,actualSourceManagementHostField} from './lib/source-management-owner-probe.mjs';
import {actualGeneralSettingsTypes,actualGeneralSettingsHostField} from './lib/general-settings-owner-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {RssPresentationProjection} from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import {isReaderProductSurfaceEnabled} from '../entry/src/main/ets/app/ReaderProductScope.ts';

const read=p=>readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8');
const indexSource=read('pages/Index.ets');
const sourceHash=createHash('sha256').update(indexSource).digest('hex');
const checks=[],roots=new Set();
let instance=0;
const indexMethods=['openRss','loadRss','rssFeedBinding','getRssOrchestrator','retireRssPresentation','retireRssEditorPresentation',
 'nextNavigationGeneration','retireSettingsPresentation','retireSourceManagementPresentation','retireSourceSwitchPresentation',
 'retireReadingEntryPresentation','retireBookshelfCatalogPresentation','isCurrentRuntime','isCurrentRoute','feedPresentation',
 'isCurrentRssPresentation','isCurrentRssHostPresentation','rssPageContent','rssPageSurface','onRssManage',
 'returnToRss','returnFromRssEntryDetail','returnFromRssSourceFeed','returnToRssSourceFeed'];
const pageMembers=['appThemeScheme','presentation','isTablet','activeMode','original','presentationIdentity','readFacts',
 'onReconcileOriginal','onRetryRead','onBack','onRefresh','onManage','onSelectSubscription','onSelectItem','onModeRequested',
 'onSettingsRequested','onDiscoverRequested','managePill'];

function composition(f,enabled=true){
 const sdk=rssRecoverySurfaceSdk(),pageSource=read('features/rss/RssPage.ets');
 sdk.childSources.RssPage=pageSource;
 const Page=createReaderBuilderProbe(pageSource,pageMembers,{...sdk.deps,projectOperationFacts},sdk.hooks).Component;
 const p=sdk.consumer(indexSource,indexMethods,{ReaderRuntimeOwner:f.Runtime,RssOrchestrator:f.Orchestrator,RssPage:Page,
  RssPresentationProjection,projectOperationFacts,isReaderProductSurfaceEnabled:enabled?()=>true:isReaderProductSurfaceEnabled,
  deviceInfo:{deviceType:'phone'} });
 Object.assign(p,{route:'bookshelf',mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,
  navigationGeneration:0,rssInstanceIdentity:++instance,rssPresentationIdentity:'',rssEditorPresentationIdentity:'',
  settingsPresentationIdentity:'',sourcePresentationIdentity:'',rssPresentation:{kind:'feed',subscriptions:[],recentUnread:[]},
  rssFeedRead:projectOperationFacts({phase:'idle'}),selectedRssItems:[],nativeAlertOwner:new ReaderNativeAlertOwner()});
 p.bookshelfHost=actualBookshelfHostField(p,actualBookshelfOperationTypes({ReaderRuntimeOwner:f.Runtime}).Host,{setOrCreate(){}});
 p.settingsHost=actualGeneralSettingsHostField(p,actualGeneralSettingsTypes({ReaderRuntimeOwner:f.Runtime}).SettingsHost);
 p.sourceHost=actualSourceManagementHostField(p,actualSourceManagementTypes({ReaderRuntimeOwner:f.Runtime}).SourceHost);
 let rendered=false;const painted=new WeakSet();
 function paint(){
  if(rendered)p.replay();else{p.rssPageContent();rendered=true;}
  sdk.properties.flush();
  const page=sdk.walk(p).filter(x=>x instanceof Page).at(-1);assert.ok(page,'actual decorated RSS page');
  if(!painted.has(page)){page.managePill();painted.add(page);}
  sdk.properties.flush();
  const action=sdk.walk(page).find(x=>x.specId==='rss-manage');assert.ok(action,'actual shared labeled action');
  const native=[...action.nodes.values()].find(x=>typeof x.onClick==='function');assert.ok(native,'actual emitted native action');
  return{page,click:native.onClick};
 }
 return{p,sdk,paint,settled:()=>settle(f.Orchestrator.forRuntime(f.runtime))};
}
async function actualFixture(){const f=await fixture();roots.add(f.root);await seedEntry(f);return f;}
function assertNoDurableReplay(f,beforeDisk,beforeWrites,beforeIo){
 assert.equal(f.writes().length,beforeWrites,'return/query never replays original apply');
 assert.equal(f.disk(),beforeDisk,'return/query never clears or replaces accepted original intent');
 assert.deepEqual(f.io,beforeIo,'return/query never performs Atomic cleanup');
}

try{
 // The delayed operation is the real RSS Gateway list request; its original
 // binding is retired by the real Index navigation path, not by a fake flag.
 {
  const f=await actualFixture(),x=composition(f),gate=deferred();
  f.options.pauseMethod='rss-source.list';f.options.gate=gate;x.p.openRss();
  await until(()=>f.calls.some(c=>c.method==='rss-source.list'));
  assert.equal(x.p.rssFeedRead.fact,'loading');
  const old=x.paint(),oldIdentity=old.page.presentationIdentity,oldGeneration=x.p.navigationGeneration;
  old.click();assert.equal(x.p.route,'rssSubscriptionManagement');
  x.p.returnToRss();assert.equal(x.p.route,'rss');assert.ok(x.p.navigationGeneration>oldGeneration);
  const returned=x.paint();
  gate.resolve();await x.settled();
  const observations={identity:x.p.rssPresentationIdentity,feedRead:x.p.rssFeedRead,
   hostFeedRead:x.p.rssOrchestrator.feedRead,calls:f.calls.map(c=>c.method)};
  console.log(JSON.stringify({scenario:'actual-old-Feed-load-return',sourceHash,fixture:f.root,observations}));
  assert.notEqual(x.p.rssPresentationIdentity,'','return must attach the new RSS presentation');
  assert.notEqual(returned.page.presentationIdentity,oldIdentity);
  assert.equal(x.p.rssFeedRead.fact,'current','retired old completion cannot leave current Feed loading');
  const before=f.calls.length,nav=x.p.navigationGeneration;old.click();await x.settled();
  assert.equal(x.p.navigationGeneration,nav);assert.equal(f.calls.length,before,'old physical callback cannot borrow reattached owner');
  returned.click();assert.equal(x.p.route,'rssSubscriptionManagement','fresh native callback is admitted');await x.settled();
  assert.equal(f.writes().length,0);
  checks.push('actual-inflight-Feed-retired-binding-fresh-native-admission');
 }
 // All three actual return paths preserve an accepted unknown write and the
 // current data projection. Fresh read/recovery may query its exact receipt.
 for(const failure of ['beforeMethod','afterMethod'])for(const origin of ['management','entry','sourceFeed']){
  const f=await actualFixture();f.options[failure]='rules.mutation.apply';
  await assert.rejects(f.rss.persistFavorite('s','g',10));
  const x=composition(f);x.p.openRss();await x.settled();const old=x.paint();
  const beforeDisk=f.disk(),beforeWrites=f.writes().length,beforeIo={...f.io},beforeValue=structuredClone(x.p.rssPresentation);
  old.click();await x.settled();
  if(origin==='entry'){
   x.p.nextNavigationGeneration();x.p.route='rssEntryDetail';x.p.rssDetailReturnTarget='rss';x.p.returnFromRssEntryDetail();
  }else if(origin==='sourceFeed'){
   x.p.nextNavigationGeneration();x.p.route='rssSourceFeed';x.p.rssSourceFeedReturnTarget='rss';x.p.returnFromRssSourceFeed();
  }else x.p.returnToRss();
  await x.settled();assert.equal(x.p.route,'rss');assert.notEqual(x.p.rssPresentationIdentity,'');
  assert.deepEqual(x.p.rssPresentation,beforeValue);assert.equal(x.p.rssFeedRead.fact,'current');
  assert.equal(x.p.rssFeedOriginal.confirmation,failure==='beforeMethod'?'unknown':'confirmed');
  assert.equal(x.p.rssFeedOriginal.blocked,true,'unknown and confirmed-pending-cleanup remain original-owner blocked');
  assert.equal(x.p.rssFeedOriginal.writeStage,failure==='beforeMethod'?'core':'cleanup');
  assertNoDurableReplay(f,beforeDisk,beforeWrites,beforeIo);
  const fresh=x.paint(),nav=x.p.navigationGeneration,calls=f.calls.length;
  old.click();await x.settled();assert.equal(x.p.navigationGeneration,nav);assert.equal(f.calls.length,calls);
  x.p.detailShelfAdmissionMount++;fresh.click();assert.equal(x.p.route,'rss');assert.equal(f.calls.length,calls);
  x.p.detailShelfAdmissionMount--;f.install(undefined);assert.doesNotThrow(fresh.click);assert.equal(x.p.route,'rss');
  assert.equal(f.calls.length,calls);f.install(f.runtime);
  fresh.click();assert.equal(x.p.route,'rssSubscriptionManagement');await x.settled();
  assertNoDurableReplay(f,beforeDisk,beforeWrites,beforeIo);
  checks.push('actual-'+origin+'-return-'+failure+'-original-preserved-native-current-old-mount-runtime-rejected');
 }
 {
  const f=await actualFixture(),x=composition(f,false),route=x.p.route,nav=x.p.navigationGeneration;
  assert.equal(isReaderProductSurfaceEnabled('rss'),false,'shipping L0 remains closed');
  x.p.openRss();x.p.returnToRss();x.p.returnFromRssEntryDetail();x.p.returnFromRssSourceFeed();
  assert.equal(x.p.route,route);assert.equal(x.p.navigationGeneration,nav);assert.equal(f.calls.length,0);
  checks.push('actual-L0-production-gate-no-op-no-new-entry');
 }
 for(const root of roots)rmSync(root,{recursive:true,force:true});
 console.log(JSON.stringify({status:'PASS',sourceHash,checks,scope:'actual Index retirement/return + real RSS Gateway/Orchestrator/Atomic/Core + SDK emitted RSS native action; native scheduling/device separate'}));
}catch(error){
 console.error(JSON.stringify({status:'FAIL',sourceHash,checks,retainedFixtures:[...roots],error:error.message}));throw error;
}
