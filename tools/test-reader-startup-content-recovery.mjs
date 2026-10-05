import assert from 'node:assert/strict';
import {ReaderStartupContentOwner} from '../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(admission=Promise.resolve(),deadline=1000) {
  const calls=[],callbacks={};
  const driver={loadMain(done){calls.push('main');callbacks.main=done;},loadRecovery(done){calls.push('recovery');callbacks.recovery=done;},
    ready(){calls.push('ready');},unavailable(){calls.push('unavailable');},async exit(){calls.push('exit');}};
  const owner=new ReaderStartupContentOwner(admission,driver,deadline);owner.start();return {owner,driver,calls,callbacks};
}
{
  const f=fixture();f.owner.start();await tick();assert.deepEqual(f.calls,['main']);
  f.callbacks.main(0);f.callbacks.main(0);assert.deepEqual(f.calls,['main','ready']);assert.equal(f.owner.snapshot().phase,'ready');f.owner.close();
}
{
  const admission=deferred(),f=fixture(admission.promise,8);
  await new Promise(resolve=>setTimeout(resolve,16));assert.deepEqual(f.calls,['recovery']);
  f.callbacks.recovery(0);assert.equal(f.owner.snapshot().canRetry,true);
  admission.resolve();await tick();assert.deepEqual(f.calls,['recovery'],'a late barrier never changes the current recovery page without user retry');
  f.owner.retry();f.owner.retry();await tick();assert.deepEqual(f.calls,['recovery','main'],'retry observes the original task and rejects duplicate intent');
  f.callbacks.main(0);assert.deepEqual(f.calls,['recovery','main','ready']);f.owner.close();
}
{
  const f=fixture();await tick();f.callbacks.main(17);assert.equal(f.owner.snapshot().phase,'recovery-loading');
  f.callbacks.recovery(0);assert.equal(f.owner.snapshot().reason,'main-load-failed');
  f.owner.retry();await tick();f.callbacks.main(0);assert.equal(f.owner.snapshot().phase,'ready');f.owner.close();
}
{
  const f=fixture();await tick();const old=f.callbacks.main;old(17);f.callbacks.recovery(24);
  assert.equal(f.owner.snapshot().phase,'platform-unavailable');f.owner.retry();old(0);
  await tick();assert.deepEqual(f.calls,['main','recovery','unavailable','exit'],'failed native recovery is terminal, with no fake continuation or replay');f.owner.close();
}
{
  const f=fixture();f.driver.loadMain=()=>{throw Error('native dispatch failed');};await tick();
  assert.deepEqual(f.calls,['recovery']);f.callbacks.recovery(0);f.owner.close();
}
{
  const admission=deferred(),f=fixture(admission.promise,8);f.owner.close();admission.resolve();
  await new Promise(resolve=>setTimeout(resolve,16));assert.deepEqual(f.calls,[],'retired stage clears timeout and promise callback');
}
{
  const old=fixture();await tick();const next=fixture();await tick();old.callbacks.main(0);next.callbacks.main(0);
  assert.deepEqual(old.calls,['main']);assert.equal(old.owner.snapshot().phase,'retired');assert.deepEqual(next.calls,['main','ready']);next.owner.close();
}
{
  const f=fixture(Promise.reject(Error('admission failed')));await tick();assert.deepEqual(f.calls,['recovery']);f.callbacks.recovery(0);
  const exit=deferred();let exits=0;f.driver.exit=()=>{exits++;return exit.promise;};
  const first=f.owner.exit();await f.owner.exit();f.owner.retry();assert.equal(exits,1,'exit and retry cannot race');
  exit.reject(Error('platform exit denied'));await first;assert.equal(f.owner.snapshot().reason,'exit-failed');f.owner.close();
}

{
  const f=fixture();let notices=0;f.driver.observerFailed=()=>notices++;
  f.owner.subscribe(()=>{throw Error('UI observer failed');});
  f.driver.ready=()=>{throw Error('diagnostic failed');};await tick();f.callbacks.main(0);
  assert.equal(f.owner.snapshot().phase,'ready','a real native success is not rewritten by projection/diagnostic failure');
  assert.ok(notices>=2);assert.deepEqual(f.calls,['main']);f.owner.close();
}

// Execute the actual Ability native callback. No retired stage may start the
// diagnostic loop or publish a success to its successor.
{
  const Ability=productionMotionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets',import.meta.url),
    ['loadMainContent'],{ReaderStartupTrace:{current:()=>undefined},DOMAIN:0,hilog:{error(){}}});
  let callback,starts=0,receipts=0;
  const ability=Object.assign(new Ability(),{windowStageGeneration:3,coldStartPage:'pages/Index',eventLoopProbe:{start(){starts++;}}});
  ability.loadMainContent({loadContent(_page,done){callback=done;}},()=>receipts++);
  ability.windowStageGeneration=4;callback({code:0});assert.equal(starts,0);assert.equal(receipts,0);
}
console.log('PASS pre-Index recovery: bounded original barrier, explicit retry, native load failure, terminal unavailable fallback, exact WindowStage retirement, no duplicate storage recovery or late EventLoop start');

// An absent native ACK is terminal. A second load would race an OS request
// that has no cancellation receipt, so it must never be used as a timeout.
for (const stage of ['main','recovery']) {
 const f=fixture(Promise.resolve(),8);await tick();
 if(stage==='recovery')f.callbacks.main(17);
 const old=f.callbacks[stage];
 await new Promise(resolve=>setTimeout(resolve,18));await tick();
 assert.equal(f.owner.snapshot().phase,'platform-unavailable');
 assert.equal(f.owner.snapshot().reason,stage==='main'?'main-load-pending':'recovery-load-pending');
 assert.equal(f.owner.snapshot().canRetry,false);
 const calls=[...f.calls];f.owner.retry();old(0);old(24);await tick();
 assert.deepEqual(f.calls,calls,'no late ACK, retry or repeated callback can overlap native loads or revive readiness');
 assert.equal(f.calls.filter(c=>c==='exit').length,1);
 assert.equal(f.calls.filter(c=>c==='main').length,1);
 assert.equal(f.calls.filter(c=>c==='recovery').length,stage==='main'?0:1);f.owner.close();
}
{
 const f=fixture(Promise.resolve(),8);f.driver.exit=async()=>{f.calls.push('exit');throw Error('native exit denied');};
 f.driver.unavailable=()=>{f.calls.push('unavailable');throw Error('logger failed');};
 f.driver.observerFailed=()=>{throw Error('diagnostic failed');};
 f.owner.subscribe(()=>{throw Error('observer failed');});await tick();
 await new Promise(resolve=>setTimeout(resolve,18));await tick();
 assert.equal(f.owner.snapshot().phase,'platform-unavailable');
 assert.deepEqual(f.calls,['main','unavailable','exit'],'diagnostics and terminal exit failure cannot start another load');f.owner.close();
}
{
 const f=fixture(Promise.resolve(),8);await tick();f.owner.close();
 await new Promise(resolve=>setTimeout(resolve,18));assert.deepEqual(f.calls,['main'],'close releases native deadline without terminating the next Ability');
}
console.log('PASS native startup settlement: missing main/recovery callbacks are bounded terminal attempts, no overlapping load, once-only exit, late ACK retirement and non-disruptive diagnostics');

{
 const f=fixture();await tick();
 f.callbacks.main(17);f.callbacks.recovery(24);f.owner.close();await tick();
 assert.deepEqual(f.calls,['main','recovery','unavailable'],'retirement before queued terminal exit cannot end the successor stage');
}
