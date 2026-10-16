import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { RssPresentationProjection } from '../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import {runtimeOwnerIdentityProbe} from './lib/reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { RssWriteEvidence as ReaderWriteEvidence, RealRssRouteHost as RssRouteOperationHost, pendingRssError } from './lib/rss-operation-fixture.mjs';
import { isReaderCoreTransactionPendingError } from '../entry/vendor/core-harmony/sdk/reader_core.ts';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const source = name => readFileSync(new URL(`../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
// Execute complete production owners and protocol decoders, replacing platform imports only.
const ordinary = text => stripTypeScriptTypes(text.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^export /gm, ''));
const facts = new Function(ordinary(source('app/ReaderOperationFacts.ts')) + ';return {projectOperationFacts,projectCommitReadback};')();
const projectPersistedReceipt = new Function(...Object.keys(facts), ordinary(source('app/ReaderPersistedReceiptProjection.ts')) + ';return projectPersistedReceipt;')(...Object.values(facts));
let currentOwner;
const ReaderRuntimeOwner = runtimeOwnerIdentityProbe(()=>currentOwner);
const RssGateway = new Function('ReaderRuntimeOwner','isReaderCoreTransactionPendingError', ordinary(source('features/rss/RssGateway.ts')) + ';return RssGateway;')(ReaderRuntimeOwner,isReaderCoreTransactionPendingError);
const RssOrchestrator = new Function('RssGateway','ReaderRuntimeOwner','ReaderWriteEvidence','RssRouteOperationHost','hilog','isReaderCoreTransactionPendingError','projectPersistedReceipt','projectOperationFacts',
  ordinary(source('features/rss/RssOrchestrator.ets')) + ';return RssOrchestrator;')(RssGateway,ReaderRuntimeOwner,ReaderWriteEvidence,RssRouteOperationHost,{warn(){},error(){}},isReaderCoreTransactionPendingError,projectPersistedReceipt,facts.projectOperationFacts);
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const pageSource = source('features/rss/RssSubscriptionManagementPage.ets');
syntax.componentCollection.customComponents.add('RssSubscriptionManagementPage');
syntax.propCollection.set('RssSubscriptionManagementPage', new Set([...pageSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
const recoverySource = source('features/common/ReaderRecoveryAction.ets');
syntax.componentCollection.customComponents.add('ReaderRecoveryAction');
syntax.propCollection.set('ReaderRecoveryAction', new Set([...recoverySource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1])));
class ManagementChild {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
}
const sub = id => ({subscriptionId:id,feedUrl:`https://example.test/${id}`,title:id,enabled:true,unreadCount:0});
const clone = value => value===undefined ? undefined : structuredClone(value);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const settle=async orchestrator=>{await orchestrator.mutationChain;};
function rpc(){return {
  subscriptions:[sub('a'),sub('b')],calls:[],readFailures:[],writeFailure:undefined,beforeRequest:undefined,selection:{text:'[]'},
  async selectRssSourceJson(){return this.selection;},async loadOnlineJsonDocument(){return this.selection;},
  async request(method,params,options){
    if(options?.canDispatch?.()===false)throw Error('original presentation retired before dispatch');
    options?.onDispatch?.();
    this.calls.push([method,clone(params)]);if(this.beforeRequest)await this.beforeRequest(method,params);
    if(method==='runtime.status')return {data:{pendingHostOperationCount:0}};
    if(method==='rss-source.list'){
      if(this.readFailures.length)throw this.readFailures.shift();
      return {data:{sources:this.subscriptions.map(s=>({subscription:clone(s),source:{}}))}};
    }
    if(method==='rss.subscription.persist'){
      const s=this.subscriptions.find(s=>s.subscriptionId===params.params.subscriptionId);s.enabled=params.params.enabled;
      if(this.writeFailure){const e=this.writeFailure;this.writeFailure=undefined;throw e;}
      return {data:{operation:'update',data:{subscription:clone(s)}}};
    }
    if(method==='rss.subscription.remove'){
      this.subscriptions=this.subscriptions.filter(s=>s.subscriptionId!==params.subscriptionId);
      return {data:{subscriptionId:params.subscriptionId,deleted:true}};
    }
    if(method==='rss.feed.refresh')return {data:{subscription:clone(this.subscriptions.find(s=>s.subscriptionId===params.subscriptionId)),items:[],count:0,unreadCount:0,newCount:0,fetched:true,notModified:false,evaluatedAt:1}};
    if(method==='rss-source.import'){
      this.subscriptions.push(sub('imported'));if(this.writeFailure){const e=this.writeFailure;this.writeFailure=undefined;throw e;}
      return {data:{imported:1,replaceExisting:params.replaceExisting}};
    }
    throw new Error(`unimplemented RPC ${method}`);
  },count(method){return this.calls.filter(c=>c[0]===method).length;},
};}
let physicalIndexIdentity=0;
function fixture(runtime=rpc()){
  currentOwner=runtime;
  const {owner:index}=createReaderBuilderProbe(source('pages/Index.ets'),['rssSubscriptionManagementContent','rssSubscriptionManagementSurface','isCurrentRuntime','isCurrentRssHostPresentation','isCurrentRssPresentation','isCurrentRoute','getRssOrchestrator','retireRssPresentation','feedPresentation','rssSubscriptions','rssSubscriptionManagementItems'],
    {RssPresentationProjection,RssSubscriptionManagementPage:ManagementChild,ReaderRuntimeOwner,RssOrchestrator,projectOperationFacts:facts.projectOperationFacts,isReaderProductSurfaceEnabled:()=>true,deviceInfo:{deviceType:'phone'}});
  Object.assign(index,{mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,rssInstanceIdentity:++physicalIndexIdentity,rssPresentationIdentity:'',route:'rssSubscriptionManagement',navigationGeneration:1,shelfReceiptRetired:false,rssPresentation:{kind:'feed',subscriptions:[],recentUnread:[]},rssManagementRead:facts.projectOperationFacts({phase:'idle'}),rssManagementFocusSubscriptionId:''});
  const orchestrator=index.getRssOrchestrator();index.rssSubscriptionManagementContent();const child=[...index.children.values()][0];
  const refresh=()=>{index.replay();return child.params;};
  const surfaceSdk=boundedSurfaceSdk();const originalSurfaceSource=source('features/rss/RssOriginalRecoverySurface.ets');surfaceSdk.childSources.RssOriginalRecoverySurface=originalSurfaceSource;
  const OriginalSurface=createReaderBuilderProbe(originalSurfaceSource,boundedMembers(originalSurfaceSource),surfaceSdk.deps,surfaceSdk.hooks).Component;
  const page=()=>{
    const {owner}=createReaderBuilderProbe(pageSource,['operationFeedback','hasOperationFeedback','feedbackMessage','canRetryFeedback','retryFeedback'],{ReaderRecoveryAction:ManagementChild,RssOriginalRecoverySurface:OriginalSurface},{...surfaceSdk.hooks,mountChildren:true});
    Object.assign(owner,refresh(),{operation:clone(child.params.operation),readFacts:clone(child.params.readFacts),appThemeScheme:'day'});
    owner.operationFeedback();
    const recoveryChild=[...owner.children.values()].find(child=>child instanceof ManagementChild);
    if(recoveryChild){const recovery=createReaderBuilderProbe(recoverySource,['build']).owner;Object.assign(recovery,{actionEnabled:true},recoveryChild.params,{appThemeScheme:'day'});recovery.initialRender();
      for(const [id,node] of recovery.nodes)owner.nodes.set(-id,node);}
    return owner;
  };
  return {runtime,index,orchestrator,refresh,page,child};
}
const textNode=page=>[...page.nodes.values()].find(n=>n.type==='Text'&&n.fontSize===10);
const retryNode=page=>[...page.nodes.values()].find(n=>n.type==='Text'&&n.height===36);

// Actual Gateway -> Index -> SDK child Prop update -> actual SDK page recovery closure.
for(const [action,command] of [['toggle','rss.subscription.persist'],['refresh','rss.feed.refresh'],['remove','rss.subscription.remove']]){
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);assert.equal(f.page().feedbackMessage(),'');
  f.runtime.readFailures.push(new Error('list unavailable'));
  if(action==='toggle')f.refresh().onToggle('a',false);
  if(action==='refresh')f.refresh().onRefresh('a');
  if(action==='remove')f.orchestrator.removeSubscription('a');
  await settle(f.orchestrator);
  assert.equal(f.index.rssManagementOperation.action,action);assert.equal(f.index.rssManagementOperation.projection.receipt.fact,'confirmedRefreshFailed');
  assert.equal(f.refresh().items.length,2,'read failure retains prior rows');
  const page=f.page();assert.match(textNode(page).create,/已确认，刷新失败：list unavailable/);assert.equal(retryNode(page).create,'刷新列表');
  retryNode(page).onClick();retryNode(page).onClick();await settle(f.orchestrator);
  assert.equal(f.runtime.count(command),1,'double retry never replays write');assert.equal(f.runtime.count('rss-source.list'),3,'double retry admits one read');
  assert.equal(f.index.rssManagementOperation.projection.receipt.fact,'confirmedCurrent');
  if(action==='toggle')assert.equal(f.refresh().items[0].enabled,false);
  if(action==='remove')assert.equal(f.refresh().items.length,1);
  f.runtime.readFailures.push(new Error('different failure'));f.orchestrator.refreshSubscription('b');await settle(f.orchestrator);
  Object.assign(page,{operation:clone(f.refresh().operation),readFacts:clone(f.refresh().readFacts)});page.replay();
  assert.match(textNode(page).create,/different failure/,'mounted SDK text reads live Props');retryNode(f.page()).onClick();await settle(f.orchestrator);
  assert.equal(f.index.rssManagementOperation.projection.receipt.fact,'confirmedCurrent');
}
{
  const f=fixture();f.runtime.readFailures.push(new Error('first read failed'));f.orchestrator.open();await settle(f.orchestrator);
  assert.equal(f.index.rssManagementRead.fact,'failed');const p=f.page();assert.match(textNode(p).create,/订阅源加载失败/);
  retryNode(p).onClick();retryNode(p).onClick();await settle(f.orchestrator);
  assert.equal(f.runtime.count('rss-source.list'),2);assert.equal(f.index.rssManagementOperation,undefined,'read must not fabricate write');
  f.runtime.readFailures.push(new Error('later read failed'));f.orchestrator.open();await settle(f.orchestrator);
  assert.equal(f.index.rssManagementRead.fact,'refreshFailed');assert.equal(f.refresh().items.length,2);assert.match(textNode(f.page()).create,/保留上次读取结果/);
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);f.runtime.readFailures.push(new Error('import read failed'));
  const completed=[],failed=[];f.orchestrator.importSources(false,v=>completed.push(v),e=>failed.push(e));await settle(f.orchestrator);
  assert.deepEqual(completed,[{imported:1,replaceExisting:false}]);assert.equal(failed.length,0);assert.equal(f.index.rssManagementOperation.projection.receipt.fact,'confirmedRefreshFailed');
  retryNode(f.page()).onClick();await settle(f.orchestrator);assert.equal(f.runtime.count('rss-source.import'),1);assert.equal(f.refresh().items.length,3);
  f.runtime.selection=undefined;const prior=f.index.rssManagementOperation;
  f.orchestrator.importSources(false,v=>completed.push(v),e=>failed.push(e));await settle(f.orchestrator);
  assert.equal(completed.at(-1),undefined);assert.equal(f.index.rssManagementOperation,prior,'picker cancellation dispatches no write');
}
for(const action of ['toggle','import']){
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);f.runtime.writeFailure=new Error('ack lost');
  if(action==='toggle')f.orchestrator.toggleSubscription('a',false);
  else f.orchestrator.importSources(false,()=>assert.fail('lost ack cannot report success'),()=>assert.fail('lost ack cannot report failure'));
  await settle(f.orchestrator);assert.equal(f.index.rssManagementOperation.projection.receipt.confirmation,'unknown');
  retryNode(f.page()).onClick();await settle(f.orchestrator);
  assert.equal(f.index.rssManagementOperation.projection.receipt.fact,'pendingReconciliation','matching state is not a lost ACK');
  assert.equal(f.runtime.count(action==='toggle'?'rss.subscription.persist':'rss-source.import'),1);
  f.orchestrator.toggleSubscription('b',false);f.orchestrator.importSources(true,()=>assert.fail('unknown cannot be replaced'),()=>assert.fail());await settle(f.orchestrator);
  assert.equal(f.runtime.count('rss.subscription.persist'),action==='toggle'?1:0);assert.equal(f.runtime.count('rss-source.import'),action==='import'?1:0);
  assert.equal(f.index.rssManagementOperation.projection.receipt.confirmation,'unknown','subsequent intent cannot overwrite unresolved receipt');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);
  f.runtime.selectRssSourceJson=async()=>{throw new Error('picker denied');};
  const failures=[];f.orchestrator.importSources(false,()=>assert.fail('picker failure cannot import'),e=>failures.push(e.message));await settle(f.orchestrator);
  assert.deepEqual(failures,['picker denied']);assert.equal(f.index.rssManagementOperation,undefined);assert.equal(f.runtime.count('rss-source.import'),0);
}
{
  const f=fixture();f.runtime.readFailures.push(pendingRssError());
  f.orchestrator.open();await settle(f.orchestrator);
  assert.equal(f.index.rssManagementRead.fact,'current');assert.equal(f.runtime.count('runtime.status'),1);assert.equal(f.runtime.count('rss-source.list'),2,'typed read gate waits and retries a read only');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);
  const pause=deferred();let selecting=false;
  f.runtime.selectRssSourceJson=async()=>{selecting=true;await pause.promise;return {text:'[]'};};
  f.orchestrator.importSources(true,()=>assert.fail('closed picker completion ignored'),()=>assert.fail('closed picker failure ignored'));
  while(!selecting)await new Promise(r=>setImmediate(r));
  f.index.route='rss';pause.resolve();await settle(f.orchestrator);
  assert.equal(f.runtime.count('rss-source.import'),0,'closing before late selection cannot dispatch replace import');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);
  const pause=deferred();let waiting=false;
  f.runtime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){waiting=true;await pause.promise;}};
  f.orchestrator.toggleSubscription('a',false);while(!waiting)await new Promise(r=>setImmediate(r));
  const next=fixture(rpc()),newer=next.orchestrator;assert.throws(()=>f.index.getRssOrchestrator(),/退役/);newer.open();await settle(newer);const current=clone(next.index.rssPresentation);
  pause.resolve();await settle(f.orchestrator);assert.deepEqual(next.index.rssPresentation,current,'old owner late ACK cannot publish into new owner');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);const pause=deferred();let waiting=false;
  f.runtime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){waiting=true;await pause.promise;}};
  f.orchestrator.toggleSubscription('a',false);while(!waiting)await new Promise(r=>setImmediate(r));const before=clone(f.index.rssPresentation);
  f.index.route='rss';pause.resolve();await settle(f.orchestrator);assert.deepEqual(f.index.rssPresentation,before,'close rejects late ACK publication');
  const reads=f.runtime.count('rss-source.list');f.orchestrator.reconcileManagementOperation(clone(f.orchestrator.latestOperationProjection()));await settle(f.orchestrator);
  assert.equal(f.runtime.count('rss-source.list'),reads,'closed recovery ignored');
  f.orchestrator.toggleSubscription('b',false);f.orchestrator.importSources(false,()=>assert.fail(),()=>assert.fail());await settle(f.orchestrator);
  assert.equal(f.runtime.count('rss.subscription.persist'),1,'closed page action ignored');assert.equal(f.runtime.count('rss-source.import'),0);
  f.index.route='rssSubscriptionManagement';f.orchestrator.open();await settle(f.orchestrator);assert.equal(f.refresh().items[0].enabled,false);
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);f.runtime.readFailures.push(new Error('failed'));f.orchestrator.toggleSubscription('a',false);await settle(f.orchestrator);
  const stale=clone(f.index.rssManagementOperation);f.orchestrator.open();await settle(f.orchestrator);const reads=f.runtime.count('rss-source.list');
  f.orchestrator.reconcileManagementOperation(stale);await settle(f.orchestrator);assert.equal(f.runtime.count('rss-source.list'),reads,'re-entry invalidates recovery');
  const replacement=rpc(),next=fixture(replacement),newer=next.orchestrator;assert.throws(()=>f.index.getRssOrchestrator(),/退役/);assert.notEqual(newer,f.orchestrator);newer.open();await settle(newer);
  f.orchestrator.toggleSubscription('b',false);await settle(f.orchestrator);assert.equal(f.runtime.count('rss.subscription.persist'),1,'retired owner cannot dispatch');
  const nextReads=replacement.count('rss-source.list');newer.reconcileManagementOperation(stale);await settle(newer);assert.equal(replacement.count('rss-source.list'),nextReads,'owner replacement invalidates recovery');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);const pause=deferred();let waiting=false;
  f.runtime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){waiting=true;await pause.promise;}};
  f.orchestrator.toggleSubscription('a',false);while(!waiting)await new Promise(r=>setImmediate(r));
  f.orchestrator.refreshSubscription('b');f.orchestrator.open();pause.resolve();await settle(f.orchestrator);
  assert.deepEqual(f.runtime.calls.map(c=>c[0]),['rss-source.list','rss.subscription.persist','rss-source.list','rss-source.list'],'unsent retired-session intent is dropped; accepted write and re-entry share one chain');
  assert.equal(f.index.rssManagementOperation.subscriptionId,'a');assert.equal(f.refresh().items[0].enabled,false);
}
// Actual Index factories and SDK child callbacks must consume that retained lane.
{
  const first=fixture();first.orchestrator.open();await settle(first.orchestrator);
  const oldToggle=first.refresh().onToggle,oldRetry=first.refresh().onRetryRead;
  const pause=deferred();let accepted=false;
  first.runtime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){accepted=true;await pause.promise;}};
  oldToggle('a',false);while(!accepted)await new Promise(r=>setImmediate(r));
  const oldValue=clone(first.index.rssPresentation);
  first.index.shelfReceiptRetired=true;
  const next=fixture(first.runtime);assert.equal(next.orchestrator,first.orchestrator,'actual new Index reuses one original mutation lane');
  const liveIdentity=next.index.rssPresentationIdentity;
  first.index.retireRssPresentation();assert.equal(next.orchestrator.presentationIdentity,liveIdentity,'late old Index detach cannot revoke successor');
  assert.throws(()=>first.index.getRssOrchestrator(),/退役/);
  oldToggle('b',false);oldRetry({generation:5});
  pause.resolve();await settle(next.orchestrator);
  assert.equal(first.runtime.count('rss.subscription.persist'),1);
  assert.deepEqual(first.index.rssPresentation,oldValue,'accepted ACK cannot deliver to retired Index');
  assert.equal(next.refresh().items[0].enabled,false,'actual SDK successor receives readback');
  assert.equal(next.refresh().operation.projection.receipt.fact,'confirmedCurrent');
}
{
  const first=fixture();first.orchestrator.open();await settle(first.orchestrator);
  first.runtime.writeFailure=Error('actual lost ACK');first.refresh().onToggle('a',false);await settle(first.orchestrator);
  first.index.shelfReceiptRetired=true;first.index.retireRssPresentation();
  const next=fixture(first.runtime);assert.equal(next.orchestrator,first.orchestrator);
  assert.equal(next.refresh().operation.projection.receipt.confirmation,'unknown','actual Index remount replays unknown DTO from owner');
  next.refresh().onToggle('b',false);retryNode(next.page()).onClick();await settle(next.orchestrator);
  assert.equal(first.runtime.count('rss.subscription.persist'),1,'actual successor action cannot replace unresolved original write');
  assert.equal(next.refresh().operation.projection.receipt.fact,'pendingReconciliation');
}
{
  const f=fixture();f.orchestrator.open();await settle(f.orchestrator);
  const oldRead=clone(f.index.rssManagementRead),oldOperation=clone(f.index.rssManagementOperation);
  f.index.navigationGeneration+=1;f.index.route='rss';
  f.index.getRssOrchestrator();
  assert.equal(f.orchestrator.presentationIdentity,f.index.rssPresentationIdentity,'nonmanagement admitted factory binds current nav');
  assert.deepEqual(f.index.rssManagementRead,oldRead);assert.deepEqual(f.index.rssManagementOperation,oldOperation,'management-only publication cannot leak into another route');
  currentOwner=undefined;assert.throws(()=>f.index.getRssOrchestrator(),/退役/);
}
// The actual complete Gateway/Orchestrator survives same-Runtime physical view
// replacement. Controlled RPC answers are IO fixtures, never Core receipts.
function retainedView(owner, identity, active = () => true) {
  const values=[],operations=[],reads=[];
  assert.equal(owner.attachPresentation(identity,v=>values.push(clone(v)),active,
    o=>operations.push(clone(o)),f=>reads.push(clone(f)),()=>true),true);
  return {values,operations,reads};
}
{
  const runtime=rpc();currentOwner=runtime;
  const owner=RssOrchestrator.forRuntime(runtime), first=retainedView(owner,'first');
  owner.open();await settle(owner);
  const pause=deferred();let waiting=false;
  runtime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){waiting=true;await pause.promise;}};
  owner.toggleSubscription('a',false);while(!waiting)await new Promise(r=>setImmediate(r));
  const before=first.operations.length;
  const same=RssOrchestrator.forRuntime(runtime);assert.equal(same,owner);
  const newer=retainedView(same,'replacement');
  owner.detachPresentation('first');
  assert.equal(owner.attachPresentation('retired-old',()=>assert.fail(),()=>true,
    ()=>assert.fail(),()=>assert.fail(),()=>false),false,'obsolete view cannot replace current delivery');
  assert.equal(owner.attachPresentation('throwing-old',()=>assert.fail(),()=>true,
    ()=>assert.fail(),()=>assert.fail(),()=>{throw Error('retired admission');}),false);
  pause.resolve();await settle(owner);
  assert.equal(runtime.count('rss.subscription.persist'),1);
  assert.equal(first.operations.length,before,'late accepted ACK cannot publish to old view');
  assert.equal(newer.operations.at(-1).projection.receipt.fact,'confirmedCurrent');
  assert.equal(newer.values.at(-1)[0].enabled,false,'replacement receives the same canonical readback');
  assert.equal(newer.reads.at(-1).fact,'current');
}
{
  const runtime=rpc();currentOwner=runtime;
  const owner=RssOrchestrator.forRuntime(runtime);retainedView(owner,'queued-old');
  owner.open();await settle(owner);
  const pause=deferred();owner.mutationChain=pause.promise;
  owner.toggleSubscription('a',false);
  retainedView(owner,'queued-new');pause.resolve();await settle(owner);
  assert.equal(runtime.count('rss.subscription.persist'),0,'old physical queued intent cannot acquire new delivery admission');
}
{
  const runtime=rpc();currentOwner=runtime;
  const owner=RssOrchestrator.forRuntime(runtime);retainedView(owner,'unknown-old');
  owner.open();await settle(owner);runtime.writeFailure=new Error('ACK lost after mutation');
  owner.toggleSubscription('a',false);await settle(owner);
  owner.detachPresentation('unknown-old');
  const same=RssOrchestrator.forRuntime(runtime),next=retainedView(same,'unknown-new');
  assert.equal(next.operations.at(-1).projection.receipt.confirmation,'unknown');
  same.open();await settle(same);same.toggleSubscription('b',false);await settle(same);
  assert.equal(runtime.count('rss.subscription.persist'),1,'warm remount never replays or replaces an unknown mutation');
  assert.equal(next.operations.at(-1).projection.receipt.fact,'pendingReconciliation','matching read is not ACK proof');
}
{
  const oldRuntime=rpc();currentOwner=oldRuntime;
  const old=RssOrchestrator.forRuntime(oldRuntime);retainedView(old,'retired');
  old.open();await settle(old);
  const pause=deferred();let waiting=false;
  oldRuntime.beforeRequest=async method=>{if(method==='rss.subscription.persist'){waiting=true;await pause.promise;}};
  old.toggleSubscription('a',false);while(!waiting)await new Promise(r=>setImmediate(r));
  const newRuntime=rpc();currentOwner=newRuntime;
  const current=RssOrchestrator.forRuntime(newRuntime),next=retainedView(current,'current');
  assert.equal(RssOrchestrator.forRuntime(oldRuntime),undefined,'obsolete factory cannot replace current cached owner');
  assert.equal(RssOrchestrator.forRuntime(newRuntime),current);
  pause.resolve();await settle(old);
  assert.equal(old.latestOperationProjection().projection.receipt.confirmation,'confirmed','original owner retains exact accepted ACK after retirement');
  assert.equal(next.operations.length,0);
  currentOwner=undefined;assert.equal(RssOrchestrator.forRuntime(newRuntime),undefined);
  assert.equal(current.attachPresentation('unavailable',()=>{},()=>true,()=>{},()=>{},()=>true),false);
}
{
  const runtime=rpc();currentOwner=runtime;
  const owner=RssOrchestrator.forRuntime(runtime);
  retainedView(owner,'throwing-admission',()=>{throw Error('native context retired');});
  owner.open();owner.toggleSubscription('a',false);await settle(owner);
  assert.equal(runtime.count('rss.subscription.persist'),0);
}
{
  const ThrowingDiagnosticOwner = new Function('RssGateway','ReaderRuntimeOwner','ReaderWriteEvidence','RssRouteOperationHost','hilog','isReaderCoreTransactionPendingError','projectPersistedReceipt','projectOperationFacts',
    ordinary(source('features/rss/RssOrchestrator.ets')) + ';return RssOrchestrator;')(RssGateway,ReaderRuntimeOwner,ReaderWriteEvidence,RssRouteOperationHost,
      {warn(){throw Error('logger unavailable');},error(){throw Error('logger unavailable');}},isReaderCoreTransactionPendingError,projectPersistedReceipt,facts.projectOperationFacts);
  const runtime=rpc();currentOwner=runtime;
  const owner=new ThrowingDiagnosticOwner(()=>{throw Error('native delivery retired');},()=>true,runtime,
    ()=>{throw Error('native delivery retired');},()=>{throw Error('native delivery retired');});
  owner.open();await settle(owner);owner.toggleSubscription('a',false);await settle(owner);
  assert.equal(owner.latestOperationProjection().projection.receipt.fact,'confirmedCurrent');
  assert.equal(runtime.count('rss.subscription.persist'),1,'throwing diagnostic cannot rewrite accepted ACK');
  await assert.rejects(owner.runSerialized(async()=>{throw Error('independent operation failed');}),/independent operation failed/);
  let ran=false;await owner.runSerialized(async()=>{ran=true;});assert.equal(ran,true,'logger cannot poison the serial tail');
}
console.log('RSS actual Gateway -> Index -> SDK Props/feedback + same-Runtime retained lane: PASS (write/read/unknown/retry/close/re-entry/owner/concurrency).');
