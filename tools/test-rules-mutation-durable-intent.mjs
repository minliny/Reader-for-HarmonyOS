import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { fixture,until,deferred,ReaderWriteEvidence,actualRuntimeDirect }=await import("./lib/rules-mutation-durable-probe.mjs");

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;try{
const official=!id.endsWith('-strip-diagnostic');const key=official?id:id.slice(0,-17);
if(key==='sequence'){
{
  const f=await fixture(official);await f.save();assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.owner.snapshot().blocked,false);assert.equal(f.disk(),'');
  const p=f.writes()[0].params;assert.equal(p.sequence,1);assert.ok(p.operationId.endsWith('/1'));assert.equal(p.mutation.method,'dict-rule.put');assert.equal(p.mutation.params.name,'dict');
  await f.gateway.deleteDictRule('dict');assert.equal(f.writes()[1].params.sequence,2);
 }
}
if(key==='lost-ack'){
{
  const f=await fixture(official);f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.save(),e=>e.writeUncertain);const original=JSON.parse(f.disk());
  const cold=await fixture(official,f);const saved=await cold.recover();assert.equal(saved.confirmation,'confirmed');assert.equal(saved.operationId,original.operationId);assert.equal(cold.writes().length,0);assert.equal(cold.disk(),'');
  assert.equal((await cold.command('dict-rule.list')).data.rules.length,1);await cold.gateway.deleteDictRule('dict');assert.equal(cold.writes()[0].params.sequence,2);
 }
}
if(key==='original-continuation'){
{
  const f=await fixture(official);f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.save(),e=>e.writeUncertain);const original=JSON.parse(f.disk());
  const cold=await fixture(official,f);await cold.recover();assert.equal(cold.owner.snapshot().confirmation,'unknown');assert.equal(cold.owner.snapshot().canRetryOriginal,true);assert.equal(cold.writes().length,0,'query null never claims not dispatched');
  await assert.rejects(cold.gateway.deleteDictRule('dict'),e=>e.writeUncertain);assert.equal(cold.writes().length,0);
  await cold.recover(true);assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});assert.equal(cold.disk(),'');
 }
}
if(key==='local-atomic'){
for(const fault of ['beforeLocal','loseFinishAt','loseSyncAt']) {
  const f=await fixture(official);f.options[fault]=fault==='beforeLocal'?true:1;await assert.rejects(f.save(),e=>e.writeUncertain);assert.equal(f.writes().length,0);
  await f.recover();assert.equal(f.owner.snapshot().canRetryOriginal,true);const fixed=f.owner.snapshot().operationId;
  await f.recover(true);assert.equal(f.writes()[0].params.operationId,fixed);assert.equal(f.writes().length,1);assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.disk(),'');
  if(fault==='loseFinishAt')assert.equal(f.io.failWrites,0,'no compensation after actual published rename');
 }
}
if(key==='cleanup-ack'){
{
  const f=await fixture(official);f.options.loseFinishAt=2;await f.save();assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.owner.snapshot().blocked,true,'cleanup ACK is independent from Core ACK');
  await assert.rejects(f.gateway.deleteDictRule('dict'));assert.equal(f.writes().length,1);
  await f.recover();assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.owner.snapshot().blocked,false);await f.gateway.deleteDictRule('dict');assert.equal(f.writes().length,2);
 }
}
if(key==='higher-head'){
{
  const f=await fixture(official);f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.save());const original=f.disk();
  const cold=await fixture(official,f);cold.options.transformMethod='rules.mutation.query';cold.options.transform=data=>({...data,head:{operationId:'12345678-1234-4234-8123-123456789abc/2',sequence:2,payloadFingerprint:'f'.repeat(64)},receipt:null});
  await assert.rejects(cold.recover(),/越过/);assert.equal(cold.owner.snapshot().blocked,true);assert.equal(cold.owner.snapshot().canRetryOriginal,false);assert.equal(cold.disk(),original);await assert.rejects(cold.recover(true));assert.equal(cold.writes().length,0);
 }
}
if(key==='wrong-receipt'){
{
  const f=await fixture(official);f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.save());const original=f.disk();
  const cold=await fixture(official,f);cold.options.transformMethod='rules.mutation.query';cold.options.transform=data=>({...data,receipt:{...data.receipt,binding:{...data.receipt.binding,operationId:'wrong'}}});
  await assert.rejects(cold.recover(),/不匹配/);assert.equal(cold.disk(),original);assert.equal(cold.owner.snapshot().confirmation,'unknown');assert.equal(cold.writes().length,0);
 }
}
if(key==='historical-ack'){
{
  const f=await fixture(official);f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.save());
  await f.command('dict-rule.put',{name:'dict',urlRule:'later',showRule:'',enabled:false,sortNumber:4});const cold=await fixture(official,f);await cold.recover();
  assert.equal((await cold.command('dict-rule.list')).data.rules[0].urlRule,'later','historical exact ACK does not install or rewrite original row');assert.equal(cold.writes().length,0);
 }
}
if(key==='route-before-send'){
{
  const f=await fixture(official);const gate=deferred();f.options.beforeStart='rules.mutation.apply';f.options.gate=gate;let current=true;f.gateway.observeWrites(undefined,()=>current);
  const task=f.save();await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'));current=false;gate.resolve();await assert.rejects(task,e=>!e.writeUncertain);
  assert.equal((await f.command('dict-rule.list')).data.rules.length,0);assert.equal(f.owner.snapshot().confirmation,'undispatched');assert.equal(f.disk(),'');
 }
}
if(key==='late-ack'){
{
  const f=await fixture(official),gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;const old=f.save();await until(()=>f.writes().length===1);
  const original=JSON.parse(f.disk());f.retire();const cold=await fixture(official,f);await cold.recover();await cold.recover(true);gate.resolve();await old;
  assert.equal(cold.writes()[0].params.operationId,original.operationId);assert.equal((await cold.command('dict-rule.list')).data.rules.length,1);assert.equal(cold.disk(),'');assert.equal(f.owner.snapshot().confirmation,'confirmed','late old ACK truth retained independently from retired cleanup');
 }
}
if(key==='unsupported-core'){
{
  const f=await fixture(official);f.options.capability=false;await assert.rejects(f.save(),e=>!e.writeUncertain);assert.equal(f.writes().length,0);assert.equal(f.disk(),'','old native cannot accept new durable rule intent');
 }
}
if(key==='semantic-rejection'){
{
  const f=await fixture(official),evidence=new ReaderWriteEvidence();f.gateway.observeWrites(evidence,()=>true);
  await assert.rejects(f.gateway.deleteReplaceRule(999),e=>!e.writeUncertain);assert.equal(f.owner.snapshot().confirmation,'undispatched');assert.equal(f.disk(),'');assert.equal(evidence.confirmation(),'undispatched');
  const q=(await f.command('rules.mutation.query',{})).data;assert.equal(q.head.sequence,1,'semantic rejection is a terminal original lineage');
  await f.save();assert.equal(f.writes()[1].params.sequence,2);
 }
}
if(key==='runtime-start-fence'){
{
 const f=await fixture(true),gate=deferred(),rpc=f.runtime.request.bind(f.runtime);
 const Direct=actualRuntimeDirect();
 let actualStarting=false;const direct=Object.assign(new Direct(),{state:'ready',preparationIntentEpoch:0,runtime:{request:rpc},
  readingEntryPreparations:()=>({beginRequest:()=>false,finishRequest(){}}),wakeReadingPreparations(){},
  async start(){if(this.method==='rules.mutation.apply'){actualStarting=true;await gate.promise;}}});
 f.runtime.request=(method,params,options)=>{direct.method=method;return direct.requestDirect(method,params,options);};
 let visible=true;f.gateway.observeWrites(undefined,()=>visible);const task=f.save();await until(()=>actualStarting);visible=false;gate.resolve();
 await assert.rejects(task,e=>!e.writeUncertain);assert.equal(f.writes().length,0,'actual Runtime.start boundary refuses retired owner before actual CLI/native send');
 assert.equal(f.disk(),'');assert.equal(f.owner.snapshot().confirmation,'undispatched');
}
}
if(key==='admission-negative'){
{
 const f=await fixture(true);const source=f.actualSource(),marker='this.state.generation === generation && this.state.busy && current()';assert.ok(source.includes(marker));
 const mutant=await fixture(true,undefined,source.replace(marker,'this.state.generation === generation && this.state.busy'));
 const gate=deferred();mutant.options.beforeStart='rules.mutation.apply';mutant.options.gate=gate;let current=true;mutant.gateway.observeWrites(undefined,()=>current);const task=mutant.save();await until(()=>mutant.calls.some(c=>c.method==='rules.mutation.apply'));current=false;gate.resolve();await task;
 assert.throws(()=>assert.equal(mutant.owner.snapshot().confirmation,'undispatched'),'guard removal is caught by the original admission scenario');
}
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"sequence": {"description": "sequence actual production SDK/Core scope", "resources": []}, "lost-ack": {"description": "lost-ack actual production SDK/Core scope", "resources": []}, "original-continuation": {"description": "original-continuation actual production SDK/Core scope", "resources": []}, "local-atomic": {"description": "local-atomic actual production SDK/Core scope", "resources": []}, "cleanup-ack": {"description": "cleanup-ack actual production SDK/Core scope", "resources": []}, "higher-head": {"description": "higher-head actual production SDK/Core scope", "resources": []}, "wrong-receipt": {"description": "wrong-receipt actual production SDK/Core scope", "resources": []}, "historical-ack": {"description": "historical-ack actual production SDK/Core scope", "resources": []}, "route-before-send": {"description": "route-before-send actual production SDK/Core scope", "resources": []}, "late-ack": {"description": "late-ack actual production SDK/Core scope", "resources": []}, "unsupported-core": {"description": "unsupported-core actual production SDK/Core scope", "resources": []}, "semantic-rejection": {"description": "semantic-rejection actual production SDK/Core scope", "resources": []}, "runtime-start-fence": {"description": "runtime-start-fence actual production SDK/Core scope", "resources": []}, "admission-negative": {"description": "admission-negative actual production SDK/Core scope", "resources": []}, "sequence-strip-diagnostic": {"description": "sequence explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "lost-ack-strip-diagnostic": {"description": "lost-ack explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "original-continuation-strip-diagnostic": {"description": "original-continuation explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "local-atomic-strip-diagnostic": {"description": "local-atomic explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "cleanup-ack-strip-diagnostic": {"description": "cleanup-ack explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "higher-head-strip-diagnostic": {"description": "higher-head explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "wrong-receipt-strip-diagnostic": {"description": "wrong-receipt explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "historical-ack-strip-diagnostic": {"description": "historical-ack explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "route-before-send-strip-diagnostic": {"description": "route-before-send explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "late-ack-strip-diagnostic": {"description": "late-ack explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "unsupported-core-strip-diagnostic": {"description": "unsupported-core explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}, "semantic-rejection-strip-diagnostic": {"description": "semantic-rejection explicitly selected Node-strip differential diagnostic; also needs existing CLI/SDK", "resources": []}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
