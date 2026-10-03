import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture,compile,deferred,until,ReaderWriteEvidence } from './lib/rules-mutation-durable-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
const facts=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const projection=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const state=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
let cases=0;
for(const official of [false,true]) {
 {
  const f=await fixture(official);await f.command('replace-rule.create',{id:1,name:'original',pattern:'old',replacement:'new',scopeContent:true,isEnabled:true,isRegex:false});
  const quick=new f.Quick(f.runtime),full=new f.Full(f.runtime);f.options.afterMethod='rules.mutation.apply';
  await assert.rejects(quick.setRuleEnabled(1,false),e=>e.writeUncertain);assert.equal(f.owner.snapshot().confirmation,'unknown');
  await full.loadRules();assert.equal(f.owner.snapshot().confirmation,'unknown','successful matching current rows do not settle original write');
  await assert.rejects(full.deleteRule(1),e=>e.writeUncertain);await assert.rejects(f.gateway.deleteReplaceRule(1),e=>e.writeUncertain);assert.equal(f.writes().length,1);
  await f.recover();assert.equal(f.owner.snapshot().confirmation,'confirmed');await full.deleteRule(1);assert.equal(f.writes().length,2);assert.equal((await f.command('replace-rule.list')).data.rules.length,0);cases++;
 }
 {
  const f=await fixture(official);await f.command('replace-rule.create',{id:1,name:'original',pattern:'old',replacement:'new',scopeContent:true,isEnabled:true,isRegex:false});
  const gate=deferred(),quick=new f.Quick(f.runtime);f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;
  let visible=true;const task=quick.setRuleEnabled(1,false,()=>visible);await until(()=>f.writes().length===1);visible=false;
  await assert.rejects(f.gateway.deleteReplaceRule(1),/正在执行/);gate.resolve();assert.equal((await task).isEnabled,false);assert.equal(f.owner.snapshot().confirmation,'confirmed');cases++;
 }
 {
  const f=await fixture(official),evidence=new ReaderWriteEvidence();f.gateway.observeWrites(evidence,()=>true);
  f.options.transformMethod='rules.mutation.apply';f.options.transform=data=>({...data,data:{...data.data,rule:{...data.data.rule,name:'wrong'}}});
  await assert.rejects(f.save(),e=>e.writeUncertain);assert.equal(f.owner.snapshot().confirmation,'unknown');assert.equal(evidence.confirmation(),'unknown');assert.notEqual(f.disk(),'');
  await f.recover();assert.equal(f.owner.snapshot().confirmation,'confirmed','exact query + original semantic qualification resolves corrupted delivery');assert.equal(f.writes().length,1);cases++;
 }
 {
  const f=await fixture(official);f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.save());
  const snapshots=[];
  const Orchestrator=compile('features/settings/RulesManagementOrchestrator.ets','RulesManagementOrchestrator',{
   ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,RulesManagementGateway:f.Gateway,
   SourceGateway:class{observeWrites(){}},RssGateway:class{observeWrites(){}},...facts,...projection,hilog:{error(){}}},true);
  const host=new Orchestrator(s=>snapshots.push(s),()=>true,f.runtime);host.open();await host.operationTail;
  assert.equal(snapshots.at(-1).ruleMutation.confirmation,'confirmed');assert.equal(snapshots.at(-1).receipt.receipt.confirmation,'confirmed');assert.equal(snapshots.at(-1).dictRules[0].name,'dict');assert.equal(f.writes().length,1,'warm new Orchestrator pure exact recovery does not replay');
  f.options.beforeMethod='dict-rule.list';host.deleteDictRule('dict');await host.operationTail;
  assert.equal(snapshots.at(-1).receipt.receipt.confirmation,'confirmed');assert.equal(snapshots.at(-1).receipt.receipt.fact,'confirmedRefreshFailed','saved-but-refresh-failed remains independent');cases++;
 }
 {
  const f=await fixture(official),snapshots=[];
  f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.save());
  const Orchestrator=compile('features/settings/RulesManagementOrchestrator.ets','RulesManagementOrchestrator',{
   ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,RulesManagementGateway:f.Gateway,SourceGateway:class{observeWrites(){}},RssGateway:class{observeWrites(){}},...facts,...projection,hilog:{error(){}}},true);
  const host=new Orchestrator(s=>snapshots.push(s),()=>true,f.runtime);host.open();await host.operationTail;
  const pending=snapshots.at(-1);assert.equal(pending.ruleMutation.canRetryOriginal,true);
  host.reconcile(pending.receipt.facts.generation+1);await host.operationTail;assert.equal(f.writes().length,1,'stale recovery callback cannot start another attempt');
  host.reconcile(pending.receipt.facts.generation);await host.operationTail;assert.equal(f.writes().length,2);assert.equal(snapshots.at(-1).receipt.receipt.confirmation,'confirmed');cases++;
 }
}
{
 const sdk=boundedSurfaceSdk(),page=sdk.consumer(readFileSync(new URL('../entry/src/main/ets/features/settings/RulesManagementPage.ets',import.meta.url),'utf8'),['actionButton','smallButton','recoveryAction','recovery','statusCard']);
 let writes=0,reads=0,edits=0;
 page.snapshot={busy:false,receipt:{receipt:{confirmation:'unknown'}},ruleMutation:{blocked:true}};
 page.actionButton('save',true,()=>writes++);page.actionButton('read',false,()=>reads++,false);page.smallButton('edit',()=>edits++,false);
 for(const n of sdk.nodes(page))n.onClick?.();assert.equal(writes,0);assert.equal(reads,1);assert.equal(edits,1,'retain drafts, read and export while write blocked');
 const save=sdk.nodes(page).find(n=>n.create==='save');assert.equal(save.opacity,0.62);
 page.snapshot={busy:false,receipt:{receipt:{confirmation:'confirmed'}},ruleMutation:{blocked:false}};page.replay();save.onClick();assert.equal(writes,1);assert.equal(save.opacity,1);
}
console.log(`PASS ${cases} actual CLI/SDK full-quick-settings owner and actual Orchestrator consumers: shared lock, independent ACK/read, exact cold recovery, stale callback and page draft/read admission.`);
