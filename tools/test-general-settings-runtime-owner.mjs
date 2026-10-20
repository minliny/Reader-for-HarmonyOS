import assert from 'node:assert/strict';
import {fixture,defaults,deferred,settle} from './lib/general-settings-persistence-probe.mjs';
let cases=0;
const puts=f=>f.events.filter(e=>e[0]==='put').length;
function binding(f,name){const x=f.host(),runtime=f.current();assert.equal(x.host.bindPresentation(runtime,name,()=>x.ui.mounted),true);return{...x,runtime,name,open:()=>x.host.open(name),toggle:(key,value)=>x.host.toggle(key,value,name)};}
{
 const f=fixture(),first=binding(f,'first');first.open();await settle();const gate=deferred();f.hangFlush(gate);
 first.toggle('reduceMotion',true);await settle();const before=puts(f);first.host.detachPresentation(first.name);first.ui.mounted=false;
 const second=binding(f,'second');second.open();await settle();assert.equal(first.host.orchestrator,second.host.orchestrator,'one actual business owner per Runtime');
 assert.equal(second.ui.value.reduceMotion,true);assert.equal(second.ui.projection.canRetryAccepted,false,'reentry cannot replay an unsettled flush');
 first.host.toggle('crashLog',false,first.name);first.host.open(first.name);await settle();assert.equal(puts(f),before,'retired physical intent/getter cannot reattach old lease');
 gate.resolve();await settle();assert.equal(second.ui.projection.receipt.receipt.confirmation,'confirmed','original ACK retained for new queued projection');
 assert.equal(second.ui.value.reduceMotion,true);assert.equal(first.ui.projection.receipt,undefined,'late business completion never writes retired presentation');cases++;
}
{
 const f=fixture(),first=binding(f,'lost');first.open();await settle();f.fail('after');first.toggle('reduceMotion',true);await settle();
 assert.equal(first.ui.projection.receipt.receipt.confirmation,'unknown');const oldGeneration=first.ui.projection.receipt.facts.generation;
 first.host.detachPresentation(first.name);first.ui.mounted=false;const second=binding(f,'new');second.open();await settle();
 const before=puts(f);assert.equal(second.ui.projection.receipt.receipt.confirmation,'unknown');
 first.host.retryAccepted(oldGeneration,first.name);second.host.reconcile(second.ui.projection.receipt.facts.generation,second.name);await settle();
 assert.equal(puts(f),before,'old gesture and current pure read cannot write');assert.equal(second.ui.projection.receipt.receipt.confirmation,'unknown');
 const generation=second.ui.projection.receipt.facts.generation;second.host.retryAccepted(generation,second.name);second.host.retryAccepted(generation,second.name);await settle();
 assert.equal(puts(f),before+5);assert.equal(second.ui.projection.receipt.receipt.confirmation,'confirmed');cases++;
}
{
 const f=fixture(),x=binding(f,'queue');x.open();await settle();const gate=deferred();f.barrier(()=>gate.promise);
 x.toggle('autoCheckUpdate',false);x.toggle('reduceMotion',true);await settle();assert.equal(puts(f),0,'pending platform preparation is not dispatch');
 x.host.detachPresentation(x.name);x.ui.mounted=false;const next=binding(f,'queue-next');next.open();gate.resolve();await settle();
 assert.equal(puts(f),10,'both distinct admitted choices retain one original business lane');
 assert.deepEqual(Object.fromEntries(f.disk),{...defaults,autoCheckUpdate:false,reduceMotion:true});
 assert.deepEqual(next.ui.value,Object.fromEntries(f.disk),'fresh initial UI cannot replace admitted domain facts');cases++;
}
{
 const f=fixture(),x=binding(f,'runtime');x.open();await settle();const gate=deferred();f.barrier(()=>gate.promise);
 x.toggle('reduceMotion',true);await settle();f.retire();gate.resolve();await settle();assert.equal(puts(f),0,'Runtime retirement before actual first put rejects dispatch');
 assert.doesNotThrow(()=>x.host.open(x.name));assert.doesNotThrow(()=>x.host.toggle('crashLog',false,x.name));assert.equal(puts(f),0);cases++;
}
{
 const f=fixture(),x=binding(f,'throwing');x.open();await settle();x.host.orchestrator.emit=()=>{throw Error('native projection unavailable');};
 x.toggle('reduceMotion',true);await settle();assert.equal(Object.fromEntries(f.disk).reduceMotion,true);
 assert.equal(x.host.orchestrator.latestOperation.receipt.receipt.confirmation,'confirmed','publisher exception is not a persistence failure');cases++;
}
{
 const f=fixture(),x=binding(f,'exact');x.open();await settle();x.host.toggle('reduceMotion',true);x.host.toggle('reduceMotion',true,'foreign');await settle();
 assert.equal(puts(f),0,'explicitly bound host requires the exact presentation identity');
 x.toggle('reduceMotion',true);await settle();assert.equal(puts(f),5);cases++;
}
{
 const f=fixture(),first=binding(f,'developer');first.open();await settle();
 first.toggle('developerMode',true);await settle();
 assert.equal(first.ui.value.developerMode,true,'actual Host accepts the developer toggle');
 assert.equal(first.ui.projection.receipt.receipt.confirmation,'confirmed');
 assert.deepEqual(Object.fromEntries(f.disk),{...defaults,developerMode:true},'developer choice saves a complete snapshot without changing other settings');
 first.host.detachPresentation(first.name);first.ui.mounted=false;
 const returned=binding(f,'developer-return');returned.open();await settle();
 assert.equal(returned.ui.value.developerMode,true,'a fresh presentation restores the confirmed developer choice');
 assert.equal((await f.coldGateway().load()).developerMode,true,'cold Gateway restores developer mode from durable Preferences after static/cache reset');
 const before=puts(f);first.toggle('developerMode',false);await settle();assert.equal(puts(f),before,'retired developer gesture cannot disable a later visit');
 returned.toggle('developerMode',false);await settle();
 assert.equal((await f.coldGateway().load()).developerMode,false,'disabled developer mode is also durable');cases++;
}
{
 const f=fixture();f.disk.delete('developerMode');
 assert.deepEqual(await f.coldGateway().load(),defaults,'pre-existing four-field Preferences migrate to developerMode=false');
 f.disk.set('developerMode','invalid');
 await assert.rejects(f.coldGateway().load(),/设置持久化数据格式异常/,'invalid persisted developer values remain rejected');cases++;
}
console.log(`General settings actual shared Runtime owner + complete Preferences IO: PASS (${cases} groups; queued choices, exact lease, retained ACK/unknown, explicit retry, pure read, retirement and publisher failure).`);
