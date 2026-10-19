import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {writeFileSync}=await import("node:fs");
const {resolve}=await import("node:path");
const {fixture}=await import("./lib/rules-mutation-durable-probe.mjs");
const sub={id:2,name:'sub',url:'https://example.test/sub',type:0,autoUpdate:false,customOrder:0,update:0};
const plan={items:[{index:0,sourceId:'https://one.test',bookSource:{bookSourceName:'one',bookSourceUrl:'https://one.test'}},{index:1,sourceId:'https://two.test',bookSource:{bookSourceName:'two',bookSourceUrl:'https://two.test'}}],failures:[]};
async function pending(){const f=await fixture(true);let applied=0;const request=f.runtime.request;f.runtime.request=async(m,p,o)=>{const result=await request(m,p,o);if(m==='rules.mutation.apply' && ++applied===2)throw Error('original current ACK lost');return result;};await assert.rejects(f.gateway.refreshSubscription(sub,'original plan',plan,()=>true));const intent=JSON.parse(f.disk());assert.equal(intent.subscription.cursor,1);assert.equal(intent.subscription.facts.length,1);assert.equal(intent.subscription.steps,undefined,'disk current snapshot does not duplicate immutable plan');return{f,intent};}
const mutations=[
 ['prior method',j=>{j.subscription.facts[0].method='rss-source.import';}],
 ['prior outcome',j=>{j.subscription.facts[0].outcome='rejected';}],
 ['prior data',j=>{j.subscription.facts[0].data.name='corrupt';}],
 ['prior binding',j=>{j.subscription.facts[0].receipt.binding.operationId='wrong/1';}],
 ['prior sequence',j=>{j.subscription.facts[0].sequence=8;}],
 ['prior receipt method',j=>{j.subscription.facts[0].receipt.method='rule-sub.put';}],
 ['prior receipt ACK',j=>{j.subscription.facts[0].receipt.ackFingerprint='0'.repeat(64);}],
 ['wrong counters',j=>{j.subscription.settled.applied=9;}],
 ['wrong plan binding',j=>{j.subscription.plan.id='wrong/2';}],
];

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;try{
const key=id;
if(key==='record-damage'){
for(const [name,mutate] of mutations){const{f,intent}=await pending();mutate(intent);writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),JSON.stringify(intent));const cold=await fixture(true,f);await assert.rejects(cold.recover(true));assert.equal(cold.writes().length,0,name);assert.equal(cold.owner.snapshot().blocked,true);assert.equal(cold.owner.snapshot().subscription,undefined,'corrupt facts cannot publish confirmed parts');assert.notEqual(cold.disk(),'');}
}
if(key==='plan-damage'){
for(const mutate of [j=>{j.steps.at(-1).params.update+=1;},j=>{j.steps[1].params.bookSource.bookSourceName='corrupt original';}]){const{f}=await pending();const p=JSON.parse(f.plan());mutate(p);writeFileSync(resolve(f.files,'reader-rule-subscription-plan-v1.json'),JSON.stringify(p));const cold=await fixture(true,f);await assert.rejects(cold.recover(true),/固定完整计划/);assert.equal(cold.writes().length,0);assert.equal(cold.owner.snapshot().subscription,undefined);}
}
if(key==='semantic-rehashed'){
for(const mutate of [j=>{j.subscription.facts[0].receipt.binding.sequence=7;},j=>{j.subscription.facts[0].data.name='changed';j.subscription.facts[0].receipt.data.name='changed';}]){const{f,intent}=await pending();mutate(intent);delete intent.recordFingerprint;intent.recordFingerprint=await f.sha256Hex(JSON.stringify(intent));writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),JSON.stringify(intent));const cold=await fixture(true,f);await assert.rejects(cold.recover(true),/原回执/);assert.equal(cold.writes().length,0);}
}
if(key==='frozen-plan'){
{const{f}=await pending();assert.throws(()=>{f.owner.intents.accepted().subscription.steps.at(-1).params.update+=100;},TypeError,'qualified scalar plan entries are frozen');const count=f.writes().length;await f.recover(true);assert.equal(f.writes().length,count+1,'only original fixed metadata is written');}
}
if(key==='local-atomic'){
for(const loseFinishAt of [1,2,3]){
 const f=await fixture(true);f.options.loseFinishAt=loseFinishAt;await assert.rejects(f.gateway.refreshSubscription(sub,'original plan',plan,()=>true));assert.equal(f.writes().length,0,'dispatch waits for all initial full/plan/current ACKs');assert.ok(f.disk(),'lost local ACK preserves full original ID');const fixed=JSON.parse(f.disk());await f.recover(true);assert.equal(f.writes()[0].params.operationId,fixed.operationId);assert.equal(f.disk(),'');
 const old=await fixture(true);old.options.loseFinishAt=loseFinishAt;await assert.rejects(old.gateway.refreshSubscription(sub,'original plan',plan,()=>true));const original=JSON.parse(old.disk());const cold=await fixture(true,old);await cold.recover();assert.equal(cold.writes().length,0);await cold.recover(true);assert.equal(cold.writes()[0].params.operationId,original.operationId);assert.equal(cold.disk(),'');
}
}
if(key==='legacy-v1'){
{const{f,intent}=await pending();const p=JSON.parse(f.plan());intent.subscription.steps=p.steps;intent.subscription.localFailures=p.localFailures;delete intent.subscription.plan;delete intent.subscription.settled;delete intent.recordFingerprint;const raw=JSON.stringify(intent);writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),raw);const cold=await fixture(true,f);await cold.recover();assert.equal(cold.writes().length,0);assert.equal(cold.disk(),raw,'pure query must not rewrite v1');cold.options.loseFinishAt=2;await assert.rejects(cold.recover(true));assert.equal(cold.writes().length,0,'migration ACK failure forbids next metadata dispatch');await cold.recover(true);assert.equal(cold.writes().length,1);assert.equal(cold.owner.snapshot().subscription.metadataConfirmed,true);}
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"record-damage": {"description": "record-damage actual production SDK/Core scope", "resources": []}, "plan-damage": {"description": "plan-damage actual production SDK/Core scope", "resources": []}, "semantic-rehashed": {"description": "semantic-rehashed actual production SDK/Core scope", "resources": []}, "frozen-plan": {"description": "frozen-plan actual production SDK/Core scope", "resources": []}, "local-atomic": {"description": "local-atomic actual production SDK/Core scope", "resources": []}, "legacy-v1": {"description": "legacy-v1 actual production SDK/Core scope", "resources": []}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
