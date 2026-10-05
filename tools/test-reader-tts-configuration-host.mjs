import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderHttpTtsGateway } from '../entry/src/main/ets/features/reading/ReaderHttpTtsGateway.ts';
import { ReaderTtsGateway } from '../entry/src/main/ets/features/reading/ReaderTtsGateway.ts';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { FakeGateway, FakeHost } from './lib/reader-tts-fixtures.mjs';
import { ReaderTtsConfigurationHost, configurationSource, loadConfigurationHost } from './lib/reader-tts-configuration-fixture.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject}; };
const drain = async () => { for (let i=0;i<40;i++) await Promise.resolve(); };
const baseConfig = { engine:'system', rate:5, ratePercent:100, pitch:0, followSys:false };
const row = (id, extra={}) => ({id,name:`Service ${id}`,url:'https://example.com/tts',lastUpdateTime:1,...extra});
const draft = row(12,{voice:'voice',format:'mp3',apiKey:'private-test-key'});

function fixture(Host=ReaderTtsConfigurationHost, engines=[]) {
  const calls=[], publications=[], removed=[], secrets=[], logs=[], records=new Map(engines.map(v=>[v.id,v]));
  const hooks={}; let config={...baseConfig}, current=true;
  const runtime={async request(method, params={}) {
    calls.push({method,params}); if(hooks[method]) return hooks[method](params);
    if(method==='http-tts.put') {records.set(params.id,params);return {data:{tts:params}};}
    if(method==='http-tts.get') return {data:{tts:records.get(params.id)}};
    if(method==='http-tts.list') return {data:{items:[...records.values()]}};
    if(method==='http-tts.delete') return {data:{id:params.id,deleted:records.delete(params.id)}};
    if(method==='tts.config.put') {config={...params};return {data:{config}};}
    if(method==='tts.config.get') return {data:{config}};
    throw new Error(method);
  }};
  const coordinator={async stop(){calls.push({method:'stop'});if(hooks.stop)await hooks.stop();},
    async probeAvailability(isAdmitted){calls.push({method:'probe'});if(hooks.probe)return hooks.probe(isAdmitted);return isAdmitted();}};
  const credentials={async create(id,secret){secrets.push(secret);calls.push({method:'credential-create'});
    if(hooks.create)return hooks.create(id,secret);return `reader.tts.${id}.new`;},
    async remove(alias){removed.push(alias);if(hooks.remove)await hooks.remove(alias);}};
  const host=new Host({http:new ReaderHttpTtsGateway(runtime),config:new ReaderTtsGateway(runtime),coordinator,credentials,
    isCurrent:()=>current,fallbackConfig:()=>({...baseConfig}),publish:s=>publications.push(s),log:s=>logs.push(s)},config,engines);
  return {host,hooks,calls,publications,removed,secrets,logs,records,credentials,coordinator,runtime,
    retireIdentity(){current=false;},methods:()=>calls.map(v=>v.method)};
}

// First discovery without a known value is a first-load failure. Retrying the
// read admits the actual empty list without fabricating a successful write.
{
  const f=fixture();f.hooks['http-tts.list']=async()=>{throw new Error('offline');};
  await f.host.refreshMetadata();assert.equal(f.host.snapshot().metadata.fact,'failed');
  assert.equal(f.host.snapshot().metadata.hasValue,false);delete f.hooks['http-tts.list'];
  await f.host.refreshMetadata();assert.equal(f.host.snapshot().metadata.fact,'current');
  assert.deepEqual(f.host.snapshot().engines,[]);assert.ok(!f.methods().includes('http-tts.put'));
}

// Real gateways validate explicit payloads, preserve legacy fields, and never
// receive the ephemeral API key. Three facts remain independently visible.
{
  const existing=row(12,{contentType:'audio/mpeg',concurrentRate:'1',loginUrl:'https://example.com/login',
    loginUi:'legacy',header:'legacy',jsLib:'legacy',enabledCookieJar:true,loginCheckJs:'legacy',
    readerProfile:JSON.stringify({version:1,voice:'old',format:'wav',credentialRef:'reader.tts.12.old',model:'model',protocol:'openai-speech'})});
  const f=fixture(undefined,[existing]);await f.host.save(draft);const s=f.host.snapshot();
  assert.equal(s.durable.receipt.fact,'confirmedCurrent');assert.equal(s.selection.receipt.fact,'confirmedCurrent');
  assert.equal(s.metadata.fact,'current');assert.equal(s.activation.fact,'current');assert.equal(s.config.engine,'http-tts:12');
  const payload=f.calls.find(v=>v.method==='http-tts.put').params;
  for(const field of ['contentType','concurrentRate','loginUrl','loginUi','header','jsLib','enabledCookieJar','loginCheckJs'])
    assert.equal(payload[field],existing[field]);
  assert.equal(JSON.parse(payload.readerProfile).model,'model');assert.equal(JSON.parse(payload.readerProfile).credentialRef,'reader.tts.12.new');
  assert.ok(!JSON.stringify(payload).includes('private-test-key'));assert.equal(payload.apiKey,undefined);
  assert.deepEqual(f.removed,['reader.tts.12.old']);
}
// Confirmed HTTP save plus failed refresh retains the acknowledged row and
// does not reject the save as though its write failed.
{
  const f=fixture();f.hooks['http-tts.list']=async()=>{throw new Error('list offline');};
  await f.host.save(draft);const s=f.host.snapshot();
  assert.equal(s.durable.receipt.fact,'confirmedRefreshFailed');assert.equal(s.metadata.fact,'refreshFailed');
  assert.equal(s.engines[0].id,12);assert.equal(s.activation.fact,'current');assert.match(s.notice,/列表刷新失败/);
}
// Config put/probe are independent of the already-confirmed HTTP receipt.
for(const mode of ['probe-error','unavailable','config-write-error']) {
  const f=fixture();if(mode==='probe-error')f.hooks.probe=async()=>{throw new Error('platform probe failed');};
  if(mode==='unavailable')f.hooks.probe=async()=>false;
  if(mode==='config-write-error')f.hooks['tts.config.put']=async()=>{throw new Error('config reply lost');};
  await f.host.save(draft);const s=f.host.snapshot();assert.equal(s.durable.receipt.fact,'confirmedCurrent');
  assert.equal(s.engines[0].id,12);assert.ok(['failed','blocked'].includes(s.activation.fact));
  if(mode==='config-write-error')assert.equal(s.selection.receipt.fact,'pendingReconciliation');
  assert.match(s.notice,/已保存/);
}
// Timeout/missing row/read failure remain uncertain; the key is never deleted
// merely because an early read has not seen a delayed durable write.
for(const mode of ['present','missing','read-error']) {
  const f=fixture();f.hooks['http-tts.put']=async params=>{if(mode==='present')f.records.set(params.id,params);throw new Error('reply lost');};
  if(mode==='read-error')f.hooks['http-tts.get']=async()=>{throw new Error('read offline');};
  await assert.rejects(f.host.save(draft),/回执未确认/);assert.equal(f.host.snapshot().durable.receipt.fact,'pendingReconciliation');
  assert.equal(f.host.snapshot().durable.facts.canCancel,false);assert.deepEqual(f.removed,[]);
  await assert.rejects(f.host.save(draft),/回执未确认/);
  assert.equal(f.methods().filter(v=>v==='http-tts.put').length,1,'retry only reconciles; never blindly replays a write');
  assert.equal(f.secrets.length,1,'retry cannot allocate duplicate credentials');assert.ok(!f.methods().includes('probe'));
}

// Production gateway validation precedes its dispatch marker. The new alias
// is removed only in this provably unsent case; no read-back is invented.
{
  const f=fixture();await assert.rejects(f.host.save({...draft,url:'http://127.0.0.1/tts'}),/HTTPS/);
  assert.equal(f.host.snapshot().durable.receipt.fact,'notDispatched');
  assert.deepEqual(f.removed,['reader.tts.12.new']);assert.ok(!f.methods().includes('http-tts.put'));
  assert.ok(!f.methods().includes('http-tts.get'));
  await assert.rejects(f.host.persistRate(5,101),/步长/);
  assert.equal(f.host.snapshot().selection.receipt.fact,'notDispatched');assert.ok(!f.methods().includes('tts.config.put'));
  await assert.rejects(f.host.delete(-1),/non-negative/);
  assert.equal(f.host.snapshot().durable.receipt.fact,'notDispatched');assert.ok(!f.methods().includes('http-tts.delete'));
}

async function retiredDurableSave(Host=ReaderTtsConfigurationHost, identity=false, rejection=false) {
  const f=fixture(Host), gate=deferred();f.hooks['http-tts.put']=async params=>{await gate.promise;f.records.set(params.id,params);return {data:{tts:params}};};
  const pending=f.host.save(draft);await drain();assert.ok(f.methods().includes('http-tts.put'));
  const before=f.publications.length;if(identity)f.retireIdentity();else f.host.retire();
  if(rejection)gate.reject(new Error('late unknown'));else gate.resolve();
  if(rejection)await assert.rejects(pending,/回执未确认/);else await pending;
  assert.equal(f.publications.length,before,'retired owner cannot publish');
  assert.ok(!f.methods().includes('stop'),'retired owner cannot activate a saved engine');
  assert.ok(!f.methods().includes('probe'));assert.deepEqual(f.removed,[],'dispatched write retains its secret');
  if(rejection)assert.ok(f.methods().includes('http-tts.get'),'retired unknown write still reconciles safely');
}
await retiredDurableSave();await retiredDurableSave(undefined,true);await retiredDurableSave(undefined,false,true);
// Allocation was dispatched but the Core write was not: cancellation can
// clean that new alias without claiming a durable write was cancelled.
{
  const f=fixture(),gate=deferred();f.hooks.create=()=>gate.promise;
  const pending=f.host.save(draft);await drain();f.host.retire();gate.resolve('reader.tts.12.new');
  await assert.rejects(pending,/过期/);assert.ok(!f.methods().includes('http-tts.put'));assert.deepEqual(f.removed,['reader.tts.12.new']);
}
// A newer intent stops an older operation from dispatching its second stage;
// its acknowledged row is still available to the serialized latest intent.
{
  const f=fixture(),gate=deferred();f.hooks['http-tts.put']=async params=>{await gate.promise;f.records.set(params.id,params);return {data:{tts:params}};};
  const first=f.host.save(draft);await drain();const second=f.host.changeEngine('system');gate.resolve();
  await Promise.all([first,second]);assert.equal(f.host.snapshot().engines[0].id,12);
  assert.ok(!f.methods().includes('probe'));assert.equal(f.host.snapshot().config.engine,'system');
}
// Retirement after stop but before config dispatch cannot persist a new engine.
{
  const f=fixture(undefined,[row(12)]),gate=deferred();f.hooks.stop=()=>gate.promise;
  const pending=f.host.changeEngine('http-tts:12');await drain();f.host.retire();gate.resolve();
  await assert.rejects(pending,/过期/);assert.ok(!f.methods().includes('tts.config.put'));
}
// A config write dispatched before retirement still has its acknowledged or
// unknown receipt. Its late completion cannot probe or publish playback.
for(const failure of [false,true]) {
  const f=fixture(undefined,[row(12)]),gate=deferred();
  f.hooks['tts.config.put']=async params=>{await gate.promise;return {data:{config:params}};};
  const pending=f.host.changeEngine('http-tts:12');await drain();f.host.retire();
  if(failure)gate.reject(new Error('config reply lost'));else gate.resolve();
  if(failure)await assert.rejects(pending,/回执未确认/);else await pending;
  assert.ok(!f.methods().includes('probe'));
  assert.equal(f.host.snapshot().selection.receipt.fact,failure?'pendingReconciliation':'confirmedCurrent');
  if(failure)assert.ok(f.methods().includes('tts.config.get'));
}
// A real delete is retained despite a failed list; unknown delete and failed
// list never make credential deletion safe. Shared aliases survive cleanup.
for(const mode of ['refresh-error','unknown','shared']) {
  const profile=JSON.stringify({version:1,voice:'',format:'mp3',credentialRef:'reader.tts.12.old'});
  const f=fixture(undefined,[row(12,{readerProfile:profile}),...(mode==='shared'?[row(13,{readerProfile:profile})]:[])]);
  if(mode!=='shared')f.hooks['http-tts.list']=async()=>{throw new Error('list unavailable');};
  if(mode==='unknown')f.hooks['http-tts.delete']=async()=>{throw new Error('reply lost');};
  if(mode==='unknown')await assert.rejects(f.host.delete(12),/回执未确认/);else await f.host.delete(12);
  assert.deepEqual(f.removed,[]);if(mode==='refresh-error')assert.equal(f.host.snapshot().durable.receipt.fact,'confirmedRefreshFailed');
}
// Late initial reads/metadata cannot overwrite a newer mutation generation.
{
  const f=fixture(),gate=deferred();f.hooks['http-tts.list']=()=>gate.promise;
  const read=f.host.refreshMetadata();await drain();await f.host.persistRate(8,150);
  f.host.admitInitialConfig({...baseConfig,ratePercent:75});gate.resolve({data:{items:[row(99)]}});await read;
  assert.equal(f.host.snapshot().config.ratePercent,150);assert.deepEqual(f.host.snapshot().engines,[]);
}
// Coordinator uses its real serialized probe but configuration inspection
// cannot overwrite formal playback state or emit a config error into it.
for(const mode of ['error','unavailable','retired']) {
  const gateway=new FakeGateway(),transport=new FakeHost(),states=[];
  const coordinator=new ReaderTtsSessionCoordinator(gateway,transport,undefined,s=>states.push(s));
  const initial=coordinator.getState();let current=true;const gate=deferred();
  if(mode==='error')gateway.getConfig=async()=>{throw new Error('offline');};
  if(mode==='unavailable')transport.probe=async()=>({available:false,reason:'not installed'});
  if(mode==='retired')gateway.getConfig=()=>gate.promise;
  const pending=coordinator.probeConfigurationAvailability(()=>current);
  if(mode==='error')await assert.rejects(pending,/offline/);
  else if(mode==='retired'){await drain();current=false;gate.resolve(baseConfig);assert.equal(await pending,false);assert.deepEqual(transport.calls,[]);}
  else assert.equal(await pending,false);
  assert.deepEqual(coordinator.getState(),initial);assert.deepEqual(states,[]);await coordinator.dispose();
}
{
  const gateway=new FakeGateway(),transport=new FakeHost(),gate=deferred();let current=true;
  const coordinator=new ReaderTtsSessionCoordinator(gateway,transport);
  transport.selectEngine=async()=>{transport.calls.push('select');await gate.promise;return true;};
  const initial=coordinator.getState(),pending=coordinator.probeConfigurationAvailability(()=>current);
  await drain();current=false;gate.resolve();assert.equal(await pending,false);
  assert.deepEqual(transport.calls,['select'],'a retired selection ACK cannot dispatch the next platform probe');
  assert.deepEqual(coordinator.getState(),initial);await coordinator.dispose();
}
// Actual SDK-parsed LRE methods prove real delegation and lifecycle/book/
// coordinator admission. No rendering geometry or native timing is simulated.
{
  const lre=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
  const f=fixture();let owner;const notices=[];
  const Owner=productionMotionMethods(lre,['requireTtsConfigurationHost','changeTtsEngine','saveHttpTtsEngine',
    'deleteHttpTtsEngine','persistTtsConfig','onControlTemporaryLayerChange'],
    {ReaderTtsConfigurationHost,ReaderTtsCredentialStore:{instance:f.credentials},hilog:{error(){}}});
  owner=new Owner();Object.assign(owner,{lifecycleToken:1,sourceId:'source',bookId:'book',ttsEngine:'system',
    ttsState:{rate:1,status:'stopped',errorMessage:'existing speech error'},ttsConfig:{...baseConfig},ttsConfigMutationGeneration:0,
    ttsHttpEngines:[],ttsHttpGateway:new ReaderHttpTtsGateway(f.runtime),ttsGateway:new ReaderTtsGateway(f.runtime),
    ttsCoordinator:{stop:f.coordinator.stop,probeConfigurationAvailability:f.coordinator.probeAvailability},
    isSessionActive:token=>token===owner.lifecycleToken,coreRateForMultiplier:()=>5,ratePercentForMultiplier:()=>100,
    getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>notices.push(message)})})});
  f.hooks['http-tts.list']=async()=>{throw new Error('offline');};f.hooks.probe=async()=>{throw new Error('probe failure');};
  const playback=JSON.stringify(owner.ttsState);await owner.saveHttpTtsEngine(draft);
  assert.equal(owner.ttsEngine,'http-tts:12');assert.equal(owner.ttsHttpEngines[0].id,12);
  assert.equal(JSON.stringify(owner.ttsState),playback,'production callback never writes a configuration error into playback');
  assert.ok(notices.some(v=>/已保存/.test(v)));
  const writes=f.methods().filter(v=>v==='http-tts.put').length;
  delete f.hooks['http-tts.list'];owner.onControlTemporaryLayerChange(true);await drain();
  assert.equal(owner.ttsConfigurationHost.snapshot().metadata.fact,'current');
  assert.equal(f.methods().filter(v=>v==='http-tts.put').length,writes,'reopening recovery retries only the metadata read');
  const gate=deferred();f.hooks['http-tts.put']=async params=>{await gate.promise;return {data:{tts:params}};};
  const before=JSON.stringify(owner.ttsHttpEngines),save=owner.saveHttpTtsEngine(row(15));await drain();
  owner.bookId='next';gate.resolve();await save;assert.equal(JSON.stringify(owner.ttsHttpEngines),before);
}
// Omission negative control must fail the same late-write retirement checks.
const Mutant=await loadConfigurationHost(configurationSource.replace(
  'return !this.retired && generation === this.generation && this.deps.isCurrent();','return true;'));
await assert.rejects(retiredDurableSave(Mutant),/retired owner cannot publish|retired owner cannot activate/);
assert.match(readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'utf8'),
  /this\.ttsConfigurationHost\?\.retire\(\)/,'unmount retires the real Host');
console.log('TTS configuration Host PASS: real gateways; durable/metadata/activation facts; lost replies; secret safety; serialized generations; retired writes; SDK LRE wiring; coordinator playback isolation; omission negative control');
