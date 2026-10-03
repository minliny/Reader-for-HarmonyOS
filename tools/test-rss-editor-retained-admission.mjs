import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { rssSource, rssFacts, rssProjection, RssWriteEvidence, RssRuntime, replaceRssRuntime,
  rssRpc, RealRssOrchestrator, deferredRss, settleRss } from './lib/rss-operation-fixture.mjs';
import { isReaderCoreTransactionPendingError } from '../entry/vendor/core-harmony/sdk/reader_core.ts';

const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
const compile=(raw,name,deps)=>new Function(...Object.keys(deps),ts.transpileModule(
  raw.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''),
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+`;return ${name};`)(...Object.values(deps));
const gatewayRaw=rssSource('features/rss/RssGateway.ts'),editorRaw=rssSource('features/rss/RssSubscriptionEditorOrchestrator.ets');
const gatewayDeps={ReaderRuntimeOwner:RssRuntime,isReaderCoreTransactionPendingError};
const Gateway=compile(gatewayRaw,'RssGateway',gatewayDeps);
const editorDeps={RssGateway:Gateway,ReaderRuntimeOwner:RssRuntime,ReaderWriteEvidence:RssWriteEvidence,
  projectPersistedReceipt:rssProjection,projectOperationFacts:rssFacts.projectOperationFacts,hilog:{error(){throw Error('logger unavailable');}}};
const Editor=compile(editorRaw,'RssSubscriptionEditorOrchestrator',editorDeps);
const Direct=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],{
  DEFAULT_CORE_REQUEST_TIMEOUT_MS:15000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}}});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(EditorClass=Editor){
  const native=rssRpc(),runtime=new Direct();
  Object.assign(runtime,{state:'ready',preparationIntentEpoch:0,startup:undefined});
  runtime.readingEntryPreparations=()=>({beginRequest:()=>false,finishRequest(){}});runtime.wakeReadingPreparations=()=>{};
  runtime.start=async()=>{if(runtime.startup)await runtime.startup.promise;};
  runtime.runtime={request:(method,params,options)=>{
    assert.equal(options.onDispatch,undefined,'presentation hooks stop at the real Runtime boundary');
    return native.request(method,params);
  }};
  runtime.request=runtime.requestDirect.bind(runtime);replaceRssRuntime(runtime);
  const lane=RealRssOrchestrator.forRuntime(runtime),editor=EditorClass.forRuntime(runtime,task=>lane.runSerialized(task));
  assert.ok(editor);
  const snapshots=[],saved=[];let identity='first';
  const attach=(id,observer=s=>snapshots.push(structuredClone(s)),onSaved=id=>saved.push(id))=>{
    identity=id;assert.equal(editor.attachPresentation(id,observer,onSaved,()=>identity===id,()=>identity===id),true);
  };
  attach('first');
  const create=()=>{editor.openCreate();editor.updateFeedUrl('https://example.test/new');editor.updateTitle('retained draft');};
  return{native,runtime,lane,editor,attach,create,snapshots,saved,snapshot:()=>snapshots.at(-1),retire:()=>{identity='retired';}};
}
{
  const f=fixture();f.create();f.runtime.startup=deferredRss();f.editor.save();await tick();f.retire();f.runtime.startup.resolve();await settleRss(f.lane);
  assert.equal(f.native.count('rss-source.put'),0,'retirement during actual Runtime.start prevents dispatch');
  f.attach('second');f.editor.openCreate();assert.equal(f.snapshot().operation.receipt.confirmation,'undispatched');
  assert.equal(f.snapshot().title,'retained draft');assert.equal(f.snapshot().canSave,true);
}
{
  const f=fixture();f.create();f.native.lost.add('rss-source.put');f.editor.save();await settleRss(f.lane);
  assert.equal(f.snapshot().operation.receipt.confirmation,'unknown');
  const rebuilt=Editor.forRuntime(f.runtime,()=>assert.fail('retained owner keeps its original serial lane'));
  assert.equal(rebuilt,f.editor);f.attach('rebuilt');f.editor.openCreate();await settleRss(f.lane);
  assert.equal(f.snapshot().title,'retained draft');assert.equal(f.snapshot().canSave,false);
  f.editor.save();await settleRss(f.lane);assert.equal(f.native.count('rss-source.put'),1,'matching list cannot confirm the original lost ACK');
  f.editor.detachPresentation('first');f.editor.updateTitle('new draft');assert.equal(f.snapshot().title,'new draft','old detach cannot retire a new attachment');
  f.editor.detachPresentation('rebuilt');const count=f.snapshots.length;f.editor.updateTitle('stale physical callback');assert.equal(f.snapshots.length,count);
}
for(const lost of [false,true]){
  const f=fixture(),pause=deferredRss();f.create();let arrived=false;
  f.native.before=async method=>{if(method==='rss-source.put'){arrived=true;await pause.promise;}};
  if(lost)f.native.lost.add('rss-source.put');f.editor.save();while(!arrived)await tick();
  f.attach('rebuilt');f.editor.openCreate();f.editor.updateTitle('newer draft');f.editor.save();pause.resolve();await settleRss(f.lane);
  assert.equal(f.native.count('rss-source.put'),1);assert.deepEqual(f.saved,[],'old ACK cannot navigate a new editor');
  assert.equal(f.snapshot().title,'newer draft');assert.equal(f.snapshot().operation.receipt.confirmation,lost?'unknown':'confirmed');
  assert.equal(f.snapshot().canSave,!lost);
}
{
  const f=fixture();f.create();f.attach('observer',()=>{throw Error('view unavailable');},()=>{throw Error('navigation unavailable');});
  f.editor.save();await settleRss(f.lane);assert.equal(f.native.count('rss-source.put'),1);
  assert.equal(f.editor.snapshot.operation.receipt.confirmation,'confirmed','observer and logger rejection cannot poison confirmed task truth');
}
{
  const f=fixture(),evidence=new RssWriteEvidence(),gateway=new Gateway(f.runtime);let active=true,hooks=0;
  gateway.observeWrites(evidence,()=>active);f.runtime.startup=deferredRss();
  const p=gateway.importSourcesDocument('[]',true,()=>hooks++);await tick();active=false;f.runtime.startup.resolve();await assert.rejects(p);
  assert.equal(hooks,0);assert.equal(evidence.confirmation(),'undispatched');assert.equal(f.native.count('rss-source.import'),0);
}
// Production negative controls run the same startup and retained-owner journeys.
{
  const marker='return ReaderRuntimeOwner.isCurrent(this.runtimeOwner) && (admitted === undefined || admitted());';assert.ok(gatewayRaw.includes(marker));
  const BadGateway=compile(gatewayRaw.replace(marker,'return true;'),'RssGateway',gatewayDeps);
  const f=fixture(),evidence=new RssWriteEvidence(),gateway=new BadGateway(f.runtime);let active=true;
  gateway.observeWrites(evidence,()=>active);f.runtime.startup=deferredRss();
  const p=gateway.setEntryRead('s','g',true);await tick();active=false;f.runtime.startup.resolve();await p;
  assert.throws(()=>assert.equal(f.native.count('rss.entry.read'),0),'last-boundary journey detects missing captured admission');
}
{
  const marker='if (retained !== undefined) return retained;';assert.ok(editorRaw.includes(marker));
  const BadEditor=compile(editorRaw.replace(marker,'if (false) return retained;'),'RssSubscriptionEditorOrchestrator',editorDeps);
  const f=fixture(BadEditor);f.create();f.native.lost.add('rss-source.put');f.editor.save();await settleRss(f.lane);
  const rebuilt=BadEditor.forRuntime(f.runtime,task=>f.lane.runSerialized(task));
  assert.throws(()=>assert.equal(rebuilt,f.editor),'rebuild journey detects loss of original owner identity and unknown state');
}
console.log('PASS SDK-emitted full RSS editor/Gateway -> actual Runtime dispatch: warm retained drafts/unknown, original serial lane, precise detach, startup retirement, late ACK and observer failures; two production negative controls. Cold Core receipts and target behavior remain separate.');
