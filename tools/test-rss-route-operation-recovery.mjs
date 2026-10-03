import assert from 'node:assert/strict';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';
import { rssRouteFixture,rssSource,rssRecoveryView,rssFacts,settleRss,deferredRss,replaceRssRuntime,rssRpc,RealRssGateway,RssWriteEvidence } from './lib/rss-operation-fixture.mjs';

class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,id,params:{...params}});}updateStateVars(params){Object.assign(this.params,params);}}
function recovery(f,pageName,operation=f.operations.at(-1),read=f.reads.at(-1)){
  const source=rssSource(`features/rss/${pageName}.ets`);
  const properties=createArkUIPropertyRuntimeProbe();
  const {owner}=createReaderBuilderProbe(source,['operation','readFacts','operationFeedback','retryFeedback'],{...properties.sdk,ReaderRecoveryNotice:Child,readerRecoveryView:rssRecoveryView,projectOperationFacts:rssFacts.projectOperationFacts});
  Object.assign(owner,{operation,readFacts:read,onReconcile:o=>pageName==='RssSourceFeedPage'?f.owner.reconcileSourceOperation(o,f.binding()):f.owner.reconcileEntryOperation(o,f.binding()),onRetryRead:()=>assert.fail('receipt retry must use receipt generation')});
  owner.operationFeedback();const notice=[...owner.children.values()][0];
  const n=createReaderBuilderProbe(rssSource('features/common/ReaderRecoveryNotice.ets'),['build'],{ReaderRecoveryAction:Child}).owner;
  Object.assign(n,notice.params,{appThemeScheme:'day'});n.initialRender();const child=[...n.children.values()][0];
  const action=createReaderBuilderProbe(rssSource('features/common/ReaderRecoveryAction.ets'),['build']).owner;
  Object.assign(action,{actionEnabled:true,appThemeScheme:'day',variant:'compact'},child.params);action.initialRender();
  return{page:owner,notice:notice.params,click:()=>[...action.nodes.values()].find(node=>node.type==='Text'&&node.onClick).onClick()};
}
for(const method of ['refreshSourceFeed','openEntry','setEntryFavorite']){
  const f=rssRouteFixture();f.invoke('loadSourceFeed','s');await settleRss(f.owner);
  f.runtime.afterWrite=()=>f.runtime.readFailures.set('rss-source.list',Error('list read unavailable'));
  if(method==='refreshSourceFeed')f.invoke(method,'s');else if(method==='openEntry')f.invoke(method,'s','g');else f.invoke(method,'s','g',true);
  await settleRss(f.owner);
  const operation=f.operations.at(-1);assert.equal(operation.projection.receipt.fact,'confirmedRefreshFailed',method);assert.deepEqual(f.failures,[]);
  const command=method==='refreshSourceFeed'?'rss.feed.refresh':method==='openEntry'?'rss.entry.read':'rss.favorite.persist';assert.equal(f.runtime.count(command),1);
  const stale=structuredClone(operation),ui=recovery(f,method==='refreshSourceFeed'?'RssSourceFeedPage':'RssEntryDetailPage');assert.equal(ui.notice.view.canRetry,true);
  ui.click();await settleRss(f.owner);assert.equal(f.operations.at(-1).projection.receipt.fact,'confirmedCurrent');assert.equal(f.runtime.count(command),1,'actual SDK recovery is read-only');
  const reads=f.runtime.count('rss-source.list');
  if(method==='refreshSourceFeed')f.owner.reconcileSourceOperation(stale,f.binding());else f.owner.reconcileEntryOperation(stale,f.binding());
  await settleRss(f.owner);assert.equal(f.runtime.count('rss-source.list'),reads,'stale clone generation cannot reconcile twice');
}
for(const method of ['refreshSourceFeed','openEntry','setEntryFavorite']){
  const f=rssRouteFixture();const command=method==='refreshSourceFeed'?'rss.feed.refresh':method==='openEntry'?'rss.entry.read':'rss.favorite.persist';f.runtime.lost.add(command);
  if(method==='refreshSourceFeed')f.invoke(method,'s');else if(method==='openEntry')f.invoke(method,'s','g');else f.invoke(method,'s','g',true);
  await settleRss(f.owner);assert.equal(f.operations.at(-1).projection.receipt.confirmation,'unknown');
  recovery(f,method==='refreshSourceFeed'?'RssSourceFeedPage':'RssEntryDetailPage').click();await settleRss(f.owner);
  assert.equal(f.operations.at(-1).projection.receipt.fact,'pendingReconciliation','matching read never synthesizes an ACK');
  if(method==='refreshSourceFeed')f.invoke(method,'s');else if(method==='openEntry')f.invoke(method,'s','g');else f.invoke(method,'s','g',false);
  await settleRss(f.owner);assert.equal(f.runtime.count(command),1,'a retained unknown cannot be blindly replayed or overwritten');
}
{
  const f=rssRouteFixture(),gate=deferredRss();let arrived=false;f.runtime.before=async method=>{if(method==='rss.favorite.list'){arrived=true;await gate.promise;}};
  f.invoke('setEntryFavorite','s','g',true);while(!arrived)await new Promise(r=>setImmediate(r));f.retire();gate.resolve();await settleRss(f.owner);
  assert.equal(f.runtime.count('rss.favorite.persist'),0,'route retirement after membership read blocks the actual write');
}
for(const lost of [false,true]){
  const f=rssRouteFixture(),gate=deferredRss();let arrived=false;f.runtime.before=async method=>{if(method==='rss.favorite.persist'){arrived=true;await gate.promise;}};if(lost)f.runtime.lost.add('rss.favorite.persist');
  f.invoke('setEntryFavorite','s','g',true);while(!arrived)await new Promise(r=>setImmediate(r));f.retire();const count=f.operations.length;gate.resolve();await settleRss(f.owner);
  assert.equal(f.operations.length,count,'a retired binding cannot publish its late ACK into a new view');
  f.reenter();f.runtime.before=undefined;f.invoke('openEntry','s','g');await settleRss(f.owner);
  assert.equal(f.runtime.favorites.length,1);assert.equal(f.runtime.count('rss.favorite.persist'),1);
  if(lost)assert.equal(f.operations.at(-1).projection.receipt.confirmation,'unknown','retired unknown is retained by the entity owner');
}
{
  const f=rssRouteFixture(),gate=deferredRss();f.owner.runSerialized(()=>gate.promise);f.invoke('refreshSourceFeed','s');f.retire();gate.resolve();await settleRss(f.owner);
  assert.equal(f.runtime.count('rss.feed.refresh'),0,'queued retired route cannot dispatch');
}
{
  const f=rssRouteFixture();f.runtime.refused.add('rss.feed.refresh');f.invoke('refreshSourceFeed','s');await settleRss(f.owner);
  assert.equal(f.operations.at(-1).projection.receipt.confirmation,'confirmed');assert.equal(f.runtime.count('runtime.status'),1,'only typed nonexecution admission may retry');
}
{
  const f=rssRouteFixture(),values=[],reads=[];f.owner.loadFeed(v=>values.push(v),r=>reads.push(r),()=>true);await settleRss(f.owner);
  f.runtime.readFailures.set('rss-source.list',Error('offline'));f.owner.loadFeed(v=>values.push(v),r=>reads.push(r),()=>true);await settleRss(f.owner);
  assert.equal(reads.at(-1).fact,'refreshFailed');assert.equal(reads.at(-1).value.length,1);assert.equal(values.length,1);
  const properties=createArkUIPropertyRuntimeProbe();
  const ui=createReaderBuilderProbe(rssSource('features/rss/RssPage.ets'),['readFacts','readFeedback'],{...properties.sdk,ReaderRecoveryNotice:Child,readerRecoveryView:rssRecoveryView,projectOperationFacts:rssFacts.projectOperationFacts},properties.hooks).owner;
  const failed=reads.at(-1);Object.assign(ui,{onRetryRead:expected=>f.owner.loadFeed(v=>values.push(v),r=>reads.push(r),()=>true,expected.generation)});ui.updateStateVars({readFacts:failed});ui.readFeedback();
  const notice=[...ui.children.values()][0];notice.params.onReconcile(failed.generation);await settleRss(f.owner);assert.equal(reads.at(-1).fact,'current');
  ui.updateStateVars({readFacts:reads.at(-1)});properties.flush();const count=f.runtime.count('rss-source.list');notice.params.onReconcile(failed.generation);await settleRss(f.owner);assert.equal(f.runtime.count('rss-source.list'),count,'mounted main recovery rejects retired generation');
}
{
  const runtime=rssRpc();replaceRssRuntime(runtime);const gateway=new RealRssGateway(runtime),evidence=new RssWriteEvidence();gateway.observeWrites(evidence);
  await assert.rejects(gateway.persistFavorite('', 'g',1));assert.equal(evidence.confirmation(),'undispatched');assert.equal(runtime.count('rss.favorite.persist'),0);
  runtime.lost.add('rss.favorite.persist');await assert.rejects(gateway.persistFavorite('s','g',1));assert.equal(evidence.confirmation(),'unknown');
  const refused=new RssWriteEvidence();gateway.observeWrites(refused);runtime.refused.add('rss.favorite.remove');await assert.rejects(gateway.removeFavorite('s','g'));assert.equal(refused.confirmation(),'undispatched','typed no-execution response is not an unknown write');
  const malformed=new RssWriteEvidence();gateway.observeWrites(malformed);const request=runtime.request.bind(runtime);runtime.request=async(method,params,options)=>{const result=await request(method,params,options);if(method==='rss.entry.read')result.data.guid='foreign';return result;};
  await assert.rejects(gateway.setEntryRead('s','g',true));assert.equal(malformed.confirmation(),'unknown','invalid echoed ACK never claims confirmation');
}
{
  const f=rssRouteFixture(),gate=deferredRss();let arrived=false;f.runtime.before=async method=>{if(method==='rss.entry.read'){arrived=true;await gate.promise;}};
  f.invoke('openEntry','s','g');while(!arrived)await new Promise(r=>setImmediate(r));const before=f.values.length;replaceRssRuntime(rssRpc());gate.resolve();await settleRss(f.owner);
  assert.equal(f.values.length,before,'old runtime ACK cannot publish through the replacement owner');
}

// Real decorated fields plus actual SDK observable property classes: callbacks
// retained from the mounted native action must consult replacement props.
for(const pageName of ['RssSourceFeedPage','RssEntryDetailPage']){
  const shared=pageName==='RssSourceFeedPage'?labeledIconControls():undefined,properties=shared?.properties??createArkUIPropertyRuntimeProbe(),f=rssRouteFixture();let clicked=0;
  const members=pageName==='RssSourceFeedPage'?['operation','readFacts','canRefresh','sourceActions','actionTarget']:
    ['operation','readFacts','favoriteState','canRequestFavorite','favoriteAction'];
  const {owner}=createReaderBuilderProbe(rssSource(`features/rss/${pageName}.ets`),members,{...(shared?.dependencies??properties.sdk),projectOperationFacts:rssFacts.projectOperationFacts},shared?.hooks??properties.hooks);
  Object.assign(owner,{appThemeScheme:'day',onRefresh:()=>clicked++,onEditSource:()=>{},onFavoriteRequested:()=>clicked++});
  owner.updateStateVars({readFacts:rssFacts.projectOperationFacts({phase:'succeeded',value:{}}),favoriteState:'notFavorited'});
  if(pageName==='RssSourceFeedPage')owner.sourceActions();else owner.favoriteAction();
  const native=(shared?shared.orderedNodes(owner):[...owner.nodes.values()]).find(node=>node.type==='Stack'&&node.onClick);
  native.onClick();assert.equal(clicked,1);
  owner.updateStateVars({readFacts:rssFacts.projectOperationFacts({phase:'succeeded',value:{}}),favoriteState:'notFavorited',operation:{projection:{receipt:{confirmation:'unknown',readback:'failed',fact:'pendingReconciliation'}}}});properties.flush();
  native.onClick();assert.equal(clicked,1,'retained SDK callback must reject a newly unknown write');
  if(pageName==='RssEntryDetailPage')assert.equal(native.enabled,false);
}
// Retained full snapshots are bounded; unresolved ACK identities survive
// eviction and still reject a replay when their entity is revisited.
{
  const f=rssRouteFixture();f.runtime.lost.add('rss.entry.read');f.invoke('openEntry','s','g');await settleRss(f.owner);
  for(let n=0;n<15;n++){const guid=`g${n}`;f.runtime.items.push({subscriptionId:'s',guid,title:guid,read:false,firstSeenAt:1});f.runtime.subscriptions[0].unreadCount++;
    f.invoke('openEntry','s',guid);await settleRss(f.owner);}
  const retained=[...f.owner.routeOperations.entries.values()];assert.ok(retained.filter(state=>state.value!==undefined).length<=8);
  f.invoke('setEntryFavorite','s','g',true);await settleRss(f.owner);assert.equal(f.runtime.count('rss.favorite.persist'),0);assert.equal(f.operations.at(-1).projection.receipt.confirmation,'unknown');
}
// Omission negative control uses the real Host but removes its route gate.
{
  const f=rssRouteFixture(),gate=deferredRss();let arrived=false;f.runtime.before=async method=>{if(method==='rss.entry.read'){arrived=true;await gate.promise;}};
  f.invoke('openEntry','s','g');while(!arrived)await new Promise(r=>setImmediate(r));f.retire();const before=f.operations.length;
  f.owner.routeOperations.admitted=()=>true;gate.resolve();await settleRss(f.owner);
  assert.ok(f.operations.length>before,'negative control detects omitted route gate');
}
// Consumer callback exceptions are delivery failures, not read/write failures.
{
  const f=rssRouteFixture(),b=f.binding();b.emit=()=>{throw Error('detached UI');};b.emitRead=()=>{throw Error('detached UI');};b.emitOperation=()=>{throw Error('detached UI');};
  f.owner.refreshSourceFeed('s',b.emit,b.failed,b.current,b.emitOperation,b.emitRead);await settleRss(f.owner);
  assert.equal(f.owner.routeOperations.sources.get('s').operation.projection.receipt.fact,'confirmedCurrent');assert.equal(f.runtime.count('rss.feed.refresh'),1);
}
console.log('RSS route recovery PASS: actual gateway/serial owner, write ACK versus read failure, unknown read-only, route/runtime guards, main retained read, actual SDK recovery callbacks');
