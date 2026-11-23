import assert from 'node:assert/strict';
import {fixture,defaults,choice,deferred,tick,settle} from './lib/general-settings-persistence-probe.mjs';
let cases=0;
for(const failure of ['before','after','put']){
 const f=fixture(),events=[];f.gateway.subscribe(s=>events.push(s));await f.gateway.update(defaults);const puts=f.events.filter(e=>e[0]==='put').length;
 if(failure==='put')f.putFail('reduceMotion');else f.fail(failure);const evidence=new f.Write.ReaderWriteEvidence();await assert.rejects(f.gateway.update(choice,false,'reduceMotion',evidence));
 assert.equal(evidence.confirmation(),'unknown');assert.deepEqual(f.gateway.current(),choice);assert.deepEqual(f.gateway.writeFacts().saved,defaults);assert.equal(f.gateway.writeFacts().pendingReconciliation,true);
 assert.ok(f.events.filter(e=>e[0]==='put').slice(puts).every(e=>e[2]===choice[e[1]]),'no old compensation writes');assert.equal(events.length,1,'unconfirmed values do not qualify background subscription');
 const warm=f.remount();assert.deepEqual(await warm.load(),choice);assert.equal(warm.writeFacts().pendingReconciliation,true,'cached load cannot confirm old flush');
 await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);assert.deepEqual(Object.fromEntries(f.disk),choice);cases++;
}
{
 const f=fixture(),gate=deferred();await f.gateway.update(defaults);f.hangFlush(gate);const old=f.gateway.update(choice);await settle();const warm=f.remount();assert.deepEqual(await warm.load(),choice,'reentry need not await old unsettled flush');
 const second={...choice,crashLog:false},next=warm.update(second,false,'crashLog');await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,10,'different contexts share exact file lane');gate.resolve();await old;await next;assert.deepEqual(Object.fromEntries(f.disk),second);cases++;
}
{
 const f=fixture();await f.gateway.update(defaults);f.fail('after');await assert.rejects(f.gateway.update(choice));const gate=deferred();f.barrier(()=>{f.barrier(async()=>{});return gate.promise;});const old=f.gateway.retryAccepted(),rejected=assert.rejects(old,/SUPERSEDED/);await f.gateway.update({...choice,crashLog:false});gate.resolve();await rejected;assert.equal(f.events.filter(e=>e[0]==='flush').length,3,'stale retry cannot borrow new accepted tuple');cases++;
}
for(const boundary of ['barrier','lane','store','read']){
 const f=fixture(),gate=deferred();let prior;if(boundary==='lane'){await f.gateway.update(defaults);f.hangFlush(gate);prior=f.gateway.update(defaults);await settle();}else if(boundary==='barrier')f.barrier(()=>gate.promise);else if(boundary==='store')f.hangStore(gate);else f.hangRead(gate);
 const before=f.events.filter(e=>e[0]==='put').length,runtime=f.current(),write=f.gateway.update(choice,false,undefined,undefined,()=>f.current()===runtime),rejected=assert.rejects(write,/SUPERSEDED/);await settle();f.retire();gate.resolve();if(prior)await prior;await rejected;assert.equal(f.events.filter(e=>e[0]==='put').length,before,`${boundary}: last admission rejects retired owner`);cases++;
}
{
 const f=fixture();await f.gateway.update(defaults);f.Gateway.acceptedRevision=Number.MAX_SAFE_INTEGER;await assert.rejects(f.gateway.update(choice),/EXHAUSTED/);assert.equal(f.events.filter(e=>e[0]==='put').length,5);cases++;
}
for(const failure of ['before','after']){
 const f=fixture(),first=f.host();first.host.open();await settle();f.fail(failure);first.host.toggle('reduceMotion',true);await settle();assert.equal(first.ui.value.reduceMotion,true,'actual Host keeps accepted choice');assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');assert.equal(first.ui.projection.canRetryAccepted,true);
 const puts=f.events.filter(e=>e[0]==='put').length;first.host.reconcile(first.ui.projection.receipt.facts.generation);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'ordinary reconcile is pure read');assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');
 const oldGeneration=first.ui.projection.receipt.facts.generation;first.ui.mounted=false;const rebuilt=f.host();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'unknown','new Host reconstructs file-owned unknown');
 first.host.retryAccepted(oldGeneration);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts,'closed physical callback rejects retry');
 const generation=rebuilt.ui.projection.receipt.facts.generation;rebuilt.host.retryAccepted(generation);rebuilt.host.retryAccepted(generation);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,puts+5,'double click only one finite full snapshot setter');assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'confirmed');assert.equal(rebuilt.ui.projection.canRetryAccepted,false);cases++;
}
for(const failure of ['before','after','put']){
 const f=fixture(),first=f.host();first.host.open();await settle();
 if(failure==='put')f.putFail('developerMode');else f.fail(failure);
 first.host.toggle('developerMode',true);await settle();
 assert.equal(first.ui.value.developerMode,true,'actual developer toggle retains its accepted value after an uncertain write');
 assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');
 assert.equal(f.gateway.writeFacts().saved,undefined,'uncertain developer write is never promoted to confirmed');
 const before=f.events.filter(e=>e[0]==='put').length;
 first.host.reconcile(first.ui.projection.receipt.facts.generation);await settle();
 assert.equal(f.events.filter(e=>e[0]==='put').length,before,'developer reconciliation is a pure read');
 const generation=first.ui.projection.receipt.facts.generation;
 first.host.retryAccepted(generation);first.host.retryAccepted(generation);await settle();
 assert.equal(f.events.filter(e=>e[0]==='put').length,before+5,'developer retry dispatches exactly one full snapshot');
 assert.deepEqual(Object.fromEntries(f.disk),{...defaults,developerMode:true});
 assert.equal((await f.coldGateway().load()).developerMode,true,'confirmed retry survives cold reload');cases++;
}
{
 const f=fixture(),first=f.host();first.host.open();await settle();const gate=deferred();f.hangFlush(gate);first.host.toggle('reduceMotion',true);await settle();first.ui.mounted=false;const rebuilt=f.host();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.canRetryAccepted,false);gate.resolve();await settle();rebuilt.host.open();await settle();assert.equal(rebuilt.ui.value.reduceMotion,true);assert.equal(rebuilt.ui.projection.receipt.receipt.confirmation,'confirmed');cases++;
}
console.log(`General settings actual Gateway/Host + SDK-source confirmation/admission matrix: PASS (${cases} cases).`);
