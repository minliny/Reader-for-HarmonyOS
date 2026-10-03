import assert from 'node:assert/strict';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { rssRouteFixture,rssSource,rssFacts,settleRss,deferredRss,replaceRssRuntime,rssRpc,RealRssEditor,RssEmptyEditor } from './lib/rss-operation-fixture.mjs';
class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,id,params:{...params}});}updateStateVars(params){Object.assign(this.params,params);}}
function fixture(){
  const f=rssRouteFixture(),snapshots=[],saved=[];let active=true;
  const editor=new RealRssEditor(s=>snapshots.push(structuredClone(s)),id=>saved.push(id),()=>active,f.runtime,task=>f.owner.runSerialized(task));
  const create=()=>{editor.openCreate();editor.updateFeedUrl('https://example.test/new');editor.updateTitle('draft');};
  return{...f,editor,snapshots,saved,create,snapshot:()=>snapshots.at(-1),close(){active=false;},reopen(){active=true;}};
}
function page(f){
  const shared=foundationControls(),properties=shared.properties;
  const {owner}=createReaderBuilderProbe(rssSource('features/rss/RssSubscriptionEditorPage.ets'),['snapshot','operationRecovery','saveAction','recoveryActionIdentities','recoveryGeneration','dispatchRecovery'],
    {...shared.dependencies,EMPTY_RSS_EDITOR_SNAPSHOT:RssEmptyEditor,ReaderRecoveryAction:Child},{...properties.hooks,...shared.hooks});
  Object.assign(owner,{appThemeScheme:'day',onSave:()=>f.editor.save(),onReconcile:g=>f.editor.reconcile(g),onRetryRead:g=>f.editor.retryLoad(g)});
  owner.updateStateVars({snapshot:f.snapshot()});owner.operationRecovery();owner.saveAction();
  const save=shared.nodes(owner).find(n=>n.type==='Text'&&n.create==='保存');
  const child=[...owner.children.values()].find(child=>child instanceof Child);
  let clickRecovery;
  if(child){const action=createReaderBuilderProbe(rssSource('features/common/ReaderRecoveryAction.ets'),['build']).owner;
    Object.assign(action,{actionEnabled:true,appThemeScheme:'day',variant:'compact'},child.params);action.initialRender();
    clickRecovery=()=>[...action.nodes.values()].find(n=>n.type==='Text'&&n.onClick).onClick();}
  return{owner,save,clickRecovery,properties};
}
for(const mode of ['create','edit']){
  const f=fixture();if(mode==='create')f.create();else{f.editor.openEdit('s');await settleRss(f.owner);f.editor.updateTitle('edited');}
  f.runtime.afterWrite=()=>f.runtime.readFailures.set('rss-source.list',Error('refresh unavailable'));
  f.editor.save();await settleRss(f.owner);
  assert.equal(f.snapshot().operation.receipt.fact,'confirmedRefreshFailed');assert.equal(f.snapshot().title,mode==='create'?'draft':'edited');assert.equal(f.snapshot().canSave,false);assert.deepEqual(f.saved,[]);
  const ui=page(f);assert.equal(ui.save.enabled,false);ui.save.onClick();assert.equal(f.runtime.count('rss-source.put'),1,'SDK disabled save callback also guards direct invocation');
  ui.clickRecovery();await settleRss(f.owner);assert.equal(f.snapshot().operation.receipt.fact,'confirmedCurrent');assert.equal(f.runtime.count('rss-source.put'),1);assert.equal(f.saved.length,1,'real readonly action resolves confirmed receipt');
}
for(const mode of ['create','edit']){
  const f=fixture();if(mode==='create')f.create();else{f.editor.openEdit('s');await settleRss(f.owner);f.editor.updateTitle('edited');}
  f.runtime.lost.add('rss-source.put');f.editor.save();await settleRss(f.owner);
  assert.equal(f.snapshot().operation.receipt.confirmation,'unknown');const ui=page(f);ui.clickRecovery();await settleRss(f.owner);
  assert.equal(f.snapshot().operation.receipt.fact,'pendingReconciliation');assert.equal(f.snapshot().canSave,false);assert.equal(f.saved.length,0);
  f.editor.save();f.close();f.reopen();if(mode==='create')f.editor.openCreate();else f.editor.openEdit('s');await settleRss(f.owner);f.editor.save();
  assert.equal(f.runtime.count('rss-source.put'),1,'unknown receipt/draft survives reentry without duplicate write');assert.equal(f.snapshot().title,mode==='create'?'draft':'edited');
}
for(const invalid of ['feed','integer']){
  const f=fixture();f.create();if(invalid==='feed')f.editor.updateFeedUrl('');else f.editor.updateSourceField('customOrder','1.2');f.editor.save();await settleRss(f.owner);
  assert.equal(f.runtime.count('rss-source.put'),0);assert.equal(f.snapshot().canSave,true);assert.equal(f.snapshot().busy,false);
  if(invalid==='feed')assert.equal(f.snapshot().operation.receipt.confirmation,'undispatched');
}
{
  const f=fixture(),gate=deferredRss();f.create();f.owner.runSerialized(()=>gate.promise);f.editor.save();f.close();gate.resolve();await settleRss(f.owner);
  assert.equal(f.runtime.count('rss-source.put'),0,'queued retired editor cannot dispatch');f.reopen();f.editor.openCreate();assert.equal(f.snapshot().title,'draft');assert.equal(f.snapshot().canSave,true);
}
for(const lost of [false,true]){
  const f=fixture(),gate=deferredRss();f.create();let arrived=false;f.runtime.before=async method=>{if(method==='rss-source.put'){arrived=true;await gate.promise;}};
  if(lost)f.runtime.lost.add('rss-source.put');f.editor.save();while(!arrived)await new Promise(r=>setImmediate(r));
  f.close();f.reopen();f.editor.openEdit('s');f.editor.updateTitle('new editor draft');const emitted=f.snapshots.length;gate.resolve();await settleRss(f.owner);
  assert.equal(f.snapshot().title,'new editor draft');assert.equal(f.saved.length,0,'old save never navigates new editor');
  assert.equal(f.snapshots.slice(emitted).some(s=>s.mode==='create'),false,'old ACK cannot publish old editor');
  f.editor.openCreate();await settleRss(f.owner);assert.equal(f.snapshot().title,'draft');assert.equal(f.snapshot().operation.receipt.confirmation,lost?'unknown':'confirmed');
  if(lost){f.editor.save();assert.equal(f.runtime.count('rss-source.put'),1);}
  else{assert.equal(f.snapshot().mode,'edit');f.editor.updateTitle('explicit revision');f.editor.save();await settleRss(f.owner);assert.equal(f.runtime.subscriptions.length,2,'confirmed create identity is reused on subsequent explicit save');}
}
{
  const f=fixture(),gate=deferredRss();f.create();let arrived=false;f.runtime.before=async method=>{if(method==='rss-source.put'){arrived=true;await gate.promise;}};
  f.editor.save();while(!arrived)await new Promise(r=>setImmediate(r));f.editor.updateTitle('newer unsaved draft');gate.resolve();await settleRss(f.owner);
  assert.equal(f.snapshot().title,'newer unsaved draft');assert.equal(f.saved.length,0);assert.equal(f.snapshot().operation.receipt.fact,'confirmedCurrent');assert.equal(f.snapshot().canSave,true);
  assert.equal(f.snapshot().mode,'edit');
  const ui=page(f);assert.equal(ui.save.enabled,true);ui.owner.updateStateVars({snapshot:{...f.snapshot(),canSave:false}});ui.properties.flush();assert.equal(ui.save.enabled,false);
  ui.save.onClick();assert.equal(f.runtime.count('rss-source.put'),1,'live @Prop replacement updates retained SDK save guard');
}
{
  const f=fixture(),gate=deferredRss();f.create();let arrived=false;f.runtime.before=async method=>{if(method==='rss-source.put'){arrived=true;await gate.promise;}};
  f.editor.save();while(!arrived)await new Promise(r=>setImmediate(r));f.close();f.reopen();f.editor.openCreate();f.editor.save();gate.resolve();await settleRss(f.owner);
  assert.equal(f.runtime.count('rss-source.put'),1,'same-key reentry waits accepted write, no duplicate create');assert.equal(f.saved.length,0,'old generation cannot auto-close reentry');
}
{
  const f=fixture(),gate=deferredRss();f.create();let arrived=false;f.runtime.before=async method=>{if(method==='rss-source.put'){arrived=true;await gate.promise;}};
  f.editor.save();while(!arrived)await new Promise(r=>setImmediate(r));const count=f.snapshots.length;replaceRssRuntime(rssRpc());gate.resolve();await settleRss(f.owner);
  assert.equal(f.snapshots.length,count,'replaced runtime never receives retired save callback');assert.deepEqual(f.saved,[]);
}
// Omission negative control: intentionally remove the production session guard
// in the real class. The same late-ACK observer then detects old navigation.
{
  const f=fixture(),gate=deferredRss();f.create();let arrived=false;f.runtime.before=async method=>{if(method==='rss-source.put'){arrived=true;await gate.promise;}};
  f.editor.save();while(!arrived)await new Promise(r=>setImmediate(r));f.editor.openEdit('s');f.editor.isCurrentSession=()=>true;gate.resolve();await settleRss(f.owner);
  assert.equal(f.saved.length,1,'negative control detects missing session guard; ordinary guarded cases above require zero');
}
console.log('RSS editor recovery PASS: actual gateway/shared lane/SDK props, confirmed save versus refresh failure, unknown readonly/draft retention, predispatch retirement, old ACK and omission negative control');
