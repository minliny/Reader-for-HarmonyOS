import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import { RssPresentationProjection } from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderNativeAlertOwner} from './lib/reader-native-alert-sdk-probe.mjs';
import {rssSource, rssFacts, rssRecoveryView, RssRuntime,replaceRssRuntime,RealRssOrchestrator,RealRssEditor,RssEmptyEditor,rssRpc,settleRss,deferredRss} from './lib/rss-operation-fixture.mjs';
const source=rssSource,file=p=>new URL('../entry/src/main/ets/'+p,import.meta.url),clone=v=>v===undefined?undefined:structuredClone(v);
const methods=['isCurrentRssPresentation','isCurrentRssHostPresentation','rssFeedBinding','reconcileRssFeedOriginal','rssSubscriptionManagementItems','getRssOrchestrator','retireRssPresentation','getRssEditorOrchestrator','retireRssEditorPresentation','isCurrentRssEditorPresentation','loadRss','feedPresentation','rssSubscriptions','rssSourceBinding','rssEntryBinding','isCurrentRoute',
 'loadRssSourceItems','refreshRssSourceFeed','isCurrentRssSourceFeed','applyRssSourceSnapshot','openRssEntryDetail','onRssEntryFavoriteRequested',
 'isCurrentRssEntryDetail','applyRssEntrySnapshot','failRssEntryOperation','nextNavigationGeneration','onRssSubscriptionSelected',
 'onRssSubscriptionAddRequested','onRssSubscriptionEditRequested','finishRssSubscriptionEdit','returnToRssSubscriptionManagement'];
const deps={RssPresentationProjection,ReaderRuntimeOwner:RssRuntime,RssOrchestrator:RealRssOrchestrator,RssSubscriptionEditorOrchestrator:RealRssEditor,
 projectOperationFacts:rssFacts.projectOperationFacts,isReaderProductSurfaceEnabled:()=>true,hilog:{warn(){},error(){}},DOMAIN:1,deviceInfo:{deviceType:'phone'}};
const Index=productionMotionMethods(file('pages/Index.ets'),methods,deps);
const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
const syntax=require(sdk+'/lib/validate_ui_syntax.js');
for(const [name,path]of[['RssSubscriptionManagementPage','rss'],['RssPage','rss'],['RssSourceFeedPage','rss'],['RssEntryDetailPage','rss'],['RssSubscriptionEditorPage','rss'],['ReaderRecoveryNotice','common'],['ReaderRecoveryAction','common']]){
 syntax.componentCollection.customComponents.add(name);syntax.propCollection.set(name,new Set([...source('features/'+path+'/'+name+'.ets').matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
}
class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
let physicalIndexIdentity=0;
function fixture(route='rssSourceFeed',runtime=rssRpc()){
 replaceRssRuntime(runtime);
 const p=Object.assign(new Index(),{mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,rssInstanceIdentity:++physicalIndexIdentity,rssPresentationIdentity:'',rssEditorPresentationIdentity:'',nativeAlertOwner:new ReaderNativeAlertOwner(),route,navigationGeneration:1,shelfReceiptRetired:false,
  rssPresentation:{kind:'feed',subscriptions:clone(runtime.subscriptions),recentUnread:[]},selectedRssSubscription:clone(runtime.subscriptions[0]),selectedRssItems:clone(runtime.items),selectedRssItem:clone(runtime.items[0]),
  selectedRssFavoriteState:'notFavorited',rssFeedRead:rssFacts.projectOperationFacts({phase:'idle'}),rssSourceRead:rssFacts.projectOperationFacts({phase:'idle'}),rssEntryRead:rssFacts.projectOperationFacts({phase:'idle'}),
  rssManagementRead:rssFacts.projectOperationFacts({phase:'idle'}),rssEditorSnapshot:clone(RssEmptyEditor),rssEditorNavigationGeneration:1,rssManagementFocusSubscriptionId:''});
 p.getRssOrchestrator();
 let lastBuilder;
 const renderProps=(builder,childName)=>{
  const b=createReaderBuilderProbe(source('pages/Index.ets'),[builder,builder.replace('Content','Surface')],{...deps,[childName]:Child},{allowEmptyBranchAdmission:true}).owner;
  Object.assign(b,p);for(const name of methods)b[name]=p[name].bind(p);b[builder]();lastBuilder=b;return [...b.children.values()].at(-1).params;
 };
 const shared=(params)=>{
  const n=createReaderBuilderProbe(source('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;
  Object.assign(n,{appThemeScheme:'day'},params);n.initialRender();const c=[...n.children.values()].at(-1);if(!c)return{notice:n};
  const a=createReaderBuilderProbe(source('features/common/ReaderRecoveryAction.ets'),['build']).owner;Object.assign(a,{appThemeScheme:'day',actionEnabled:true},c.params);a.initialRender();return{notice:n,action:[...a.nodes.values()].find(x=>x.type==='Text'&&x.height===36)};
 };
 const render=(kind)=>{
  const names={main:['rssPageContent','RssPage','readFeedback'],source:['rssSourceFeedContent','RssSourceFeedPage','operationFeedback','retryFeedback'],
   entry:['rssEntryDetailContent','RssEntryDetailPage','operationFeedback','retryFeedback'],editor:['rssEditorContent','RssSubscriptionEditorPage','operationRecovery','recoveryActionIdentities','recoveryGeneration','dispatchRecovery']};
  const [builder,child,...members]=names[kind],props=renderProps(builder,child);
  const originalSdk=boundedSurfaceSdk(),originalSource=source('features/rss/RssOriginalRecoverySurface.ets');originalSdk.childSources.RssOriginalRecoverySurface=originalSource;
  const Original=createReaderBuilderProbe(originalSource,boundedMembers(originalSource),originalSdk.deps,originalSdk.hooks).Component;
  const b=createReaderBuilderProbe(source('features/rss/'+child+'.ets'),members,{readerRecoveryView:rssRecoveryView,ReaderRecoveryNotice:Child,ReaderRecoveryAction:Child,RssOriginalRecoverySurface:Original},{...originalSdk.hooks,mountChildren:true}).owner;
  Object.assign(b,{appThemeScheme:'day'},clone(Object.fromEntries(Object.entries(props).filter(([,v])=>typeof v!=='function'))),Object.fromEntries(Object.entries(props).filter(([,v])=>typeof v==='function')));
  b[members[0]]();
  const actual=[...b.children.values()].find(x=>x.params?.view?.visible);
  if(kind==='editor'){const c=[...b.children.values()].filter(c=>c instanceof Child).at(-1);if(c){const a=createReaderBuilderProbe(source('features/common/ReaderRecoveryAction.ets'),['build']).owner;Object.assign(a,{appThemeScheme:'day',actionEnabled:true},c.params);a.initialRender();return{props,page:b,action:[...a.nodes.values()].find(x=>x.type==='Text'&&x.height===36)};}}
  return{props,page:b,...(actual?shared(actual.params):{})};
 };
 const settle=()=>settleRss(p.getRssOrchestrator());
 const retry=async rendered=>{assert.ok(rendered.action,'actual SDK common action');rendered.action.onClick();rendered.action.onClick();await settle();};
 return{runtime,p,render,renderProps,settle,retry,builder:()=>lastBuilder};
}
{const f=fixture('rss');f.runtime.readFailures.set('rss-source.list',Error('first list failure'));f.p.loadRss(1);await f.settle();assert.equal(f.p.rssFeedRead.canRetry,true);await f.retry(f.render('main'));assert.equal(f.runtime.count('rss-source.list'),2);assert.equal(f.p.rssPresentation.recentUnread.length,0);assert.equal(f.runtime.count('rss.entries.query'),0);}
{const f=fixture();f.p.loadRssSourceItems(1,'s');await f.settle();const previous=clone(f.p.selectedRssItems);f.runtime.afterWrite=()=>f.runtime.readFailures.set('rss.subscription.items',Error('items read fail'));f.p.refreshRssSourceFeed();await f.settle();assert.equal(f.p.rssSourceOperation.projection.receipt.fact,'confirmedRefreshFailed');assert.deepEqual(f.p.selectedRssItems,previous);await f.retry(f.render('source'));assert.equal(f.runtime.count('rss.feed.refresh'),1);assert.equal(f.p.rssSourceOperation.projection.receipt.fact,'confirmedCurrent');}
{const f=fixture();f.runtime.lost.add('rss.feed.refresh');f.p.refreshRssSourceFeed();await f.settle();assert.equal(f.p.rssSourceOperation.projection.receipt.confirmation,'unknown');await f.retry(f.render('source'));assert.equal(f.runtime.count('rss.feed.refresh'),1);assert.equal(f.p.rssSourceOperation.projection.receipt.confirmation,'unknown');}
{const f=fixture();f.runtime.readFailures.set('rss.subscription.items',Error('first source failure'));f.p.loadRssSourceItems(1,'s');await f.settle();await f.retry(f.render('source'));assert.equal(f.runtime.count('rss.feed.refresh'),0);}
{const f=fixture();f.runtime.afterWrite=method=>{if(method==='rss.entry.read')f.runtime.readFailures.set('rss.subscription.items',Error('entry readback failed'));};f.p.openRssEntryDetail(f.runtime.items[0],'rssSourceFeed');await f.settle();assert.equal(f.p.rssEntryOperation.projection.receipt.fact,'confirmedRefreshFailed');await f.retry(f.render('entry'));assert.equal(f.runtime.count('rss.entry.read'),1);assert.equal(f.p.selectedRssFavoriteState,'notFavorited');f.runtime.afterWrite=method=>{if(method==='rss.favorite.persist')f.runtime.readFailures.set('rss.favorite.list',Error('membership refresh failed'));};f.p.onRssEntryFavoriteRequested(true);assert.equal(f.p.selectedRssFavoriteState,'notFavorited','favorite intent cannot fabricate or erase the current known membership');await f.settle();assert.equal(f.p.rssEntryOperation.projection.receipt.fact,'confirmedRefreshFailed');await f.retry(f.render('entry'));assert.equal(f.runtime.count('rss.favorite.persist'),1);assert.equal(f.p.selectedRssFavoriteState,'favorited');}
{const f=fixture();f.runtime.lost.add('rss.entry.read');f.p.openRssEntryDetail(f.runtime.items[0],'rss');await f.settle();await f.retry(f.render('entry'));assert.equal(f.p.rssEntryOperation.projection.receipt.confirmation,'unknown');assert.equal(f.runtime.count('rss.entry.read'),1);f.p.onRssEntryFavoriteRequested(true);await f.settle();assert.equal(f.runtime.count('rss.favorite.persist'),0,'unknown entry write cannot be overwritten by favorite intent');}
for(const kind of['source','entry']){
 const f=fixture(kind==='source'?'rssSourceFeed':'rssEntryDetail');const gate=deferredRss();f.runtime.before=async method=>{if(method==='rss-source.list')await gate.promise;};
 if(kind==='source')f.p.loadRssSourceItems(1,'s');else f.p.openRssEntryDetail(f.runtime.items[0],'rss');
 await new Promise(r=>setImmediate(r));const field=kind==='source'?'rssSourceOperation':'rssEntryOperation',atClose=clone(f.p[field]);f.p.nextNavigationGeneration();f.p.route='settings';gate.resolve();await f.settle();assert.deepEqual(f.p[field],atClose,'closed route rejects late operation publication');
}
for(const kind of['source','entry','main','editor']){
 const f=fixture({source:'rssSourceFeed',entry:'rssEntryDetail',main:'rss',editor:'rssSubscriptionEditor',management:'rssSubscriptionManagement'}[kind]);
 const builder={source:['rssSourceFeedContent','RssSourceFeedPage'],entry:['rssEntryDetailContent','RssEntryDetailPage'],main:['rssPageContent','RssPage'],editor:['rssEditorContent','RssSubscriptionEditorPage']}[kind];
 const props=f.renderProps(...builder);f.p.nextNavigationGeneration();f.p.route='settings';const before=f.runtime.calls.length;
 if(kind==='source')props.onRefresh();if(kind==='entry')props.onFavoriteRequested(true);if(kind==='main')props.onRetryRead({generation:99,canRetry:true});if(kind==='editor'){props.onTitleChanged('old draft');props.onSave();}
 await f.settle();assert.equal(f.runtime.calls.length,before,'stale actual Index SDK callback cannot operate a new route');
}
{const f=fixture('rssSubscriptionEditor');const editor=f.p.getRssEditorOrchestrator();editor.openCreate();await f.settle();editor.updateFeedUrl('https://example.test/new');f.runtime.afterWrite=()=>f.runtime.readFailures.set('rss-source.list',Error('editor canonical readback failed'));editor.save();await f.settle();assert.equal(f.p.rssEditorSnapshot.operation.receipt.confirmation,'confirmed');const rendered=f.render('editor');await f.retry(rendered);assert.equal(f.runtime.count('rss-source.put'),1);assert.equal(f.p.rssEditorSnapshot.operation.receipt.fact,'confirmedCurrent');}
{const f=fixture('rssSubscriptionEditor'),old=f.p.getRssEditorOrchestrator();const replacement=rssRpc();replaceRssRuntime(replacement);assert.throws(()=>f.p.getRssEditorOrchestrator(),/退役/);const successor=fixture('rssSubscriptionEditor',replacement),next=successor.p.getRssEditorOrchestrator();assert.notEqual(old,next,'new mounted Index acquires editor in replacement Runtime');assert.equal(next.owns(replacement),true);}

// SDK rerender of the same route keys the temporary child by navigation identity.
{const f=fixture();const old=f.renderProps('rssSourceFeedContent','RssSourceFeedPage');const b=f.builder(),oldChild=[...b.children.values()].at(-1);f.p.navigationGeneration=2;f.p.getRssOrchestrator();Object.assign(b,{navigationGeneration:2,rssOrchestrator:f.p.rssOrchestrator,rssPresentationIdentity:f.p.rssPresentationIdentity});b.replay();const fresh=[...b.children.values()].at(-1);assert.notEqual(fresh.id,oldChild.id,'new identity creates a new V1 callback owner');const before=f.runtime.calls.length;old.onRefresh();await f.settle();assert.equal(f.runtime.calls.length,before);fresh.params.onRefresh();await f.settle();assert.equal(f.runtime.count('rss.feed.refresh'),1);}
for(const kind of ['main','source','entry','editor','management']){const f=fixture({main:'rss',source:'rssSourceFeed',entry:'rssEntryDetail',editor:'rssSubscriptionEditor',management:'rssSubscriptionManagement'}[kind]);const [builder,child]={main:['rssPageContent','RssPage'],source:['rssSourceFeedContent','RssSourceFeedPage'],entry:['rssEntryDetailContent','RssEntryDetailPage'],editor:['rssEditorContent','RssSubscriptionEditorPage'],management:['rssSubscriptionManagementContent','RssSubscriptionManagementPage']}[kind],props=f.renderProps(builder,child);replaceRssRuntime(undefined);const priorCurrent=RssRuntime.current;RssRuntime.current=()=>{throw Error('ReaderRuntimeOwner unavailable');};assert.doesNotThrow(()=>{if(kind==='main')props.onRetryRead({generation:1});if(kind==='source')props.onRefresh();if(kind==='entry')props.onFavoriteRequested(true);if(kind==='editor')props.onSave();if(kind==='management'){props.onToggle('s',false);props.onReconcile({});props.onBack();}});assert.equal(f.runtime.calls.length,0,'retired runtime SDK callback has no admission');RssRuntime.current=priorCurrent;}
{const f=fixture();const binding=f.p.rssSourceBinding(1,'s');replaceRssRuntime(undefined);const priorCurrent=RssRuntime.current;RssRuntime.current=()=>{throw Error('ReaderRuntimeOwner unavailable');};assert.equal(binding.current(),false);assert.doesNotThrow(()=>binding.emitRead({generation:22}));assert.equal(f.p.rssSourceRead.generation,0);RssRuntime.current=priorCurrent;}
console.log('PASS RSS full actual gateway→Index→four SDK page consumers→shared recovery: main readonly list, source/entry/favorite/editor ACK-readback, unknown barriers, real data membership, captured route/entity/runtime and stale/closed callbacks; hidden aggregate/query unchanged');
