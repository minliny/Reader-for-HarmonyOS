import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderTtsAudioSessionLease } from '../entry/src/main/ets/app/ReaderTtsAudioSessionLease.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const ending of ['stop','close','successor']) {
  const ack=deferred(), calls=[];
  let active=false, first=true;
  const lease=new ReaderTtsAudioSessionLease({
    async activate(mix) {calls.push(['activate',mix]); if(first){first=false;await ack.promise;} active=true;},
    async deactivate() {calls.push(['release']);active=false;},
  });
  const old=lease.createOwner('system'), next=lease.createOwner('http');
  const pending=lease.activate(old,false);
  const retired=assert.rejects(pending,/admission retired/);
  await tick();
  const cleanup=lease.deactivate(old);
  const successor=ending==='successor'?lease.activate(next,true):undefined;
  ack.resolve();
  await retired; await cleanup; await successor;
  assert.equal(active,ending==='successor');
  assert.deepEqual(calls,ending==='successor'?[['activate',false],['release'],['activate',true]]:[['activate',false],['release']]);
  if(successor) {
    await lease.deactivate(old);
    assert.equal(active,true,'old transport teardown cannot release the new transport');
    await lease.deactivate(next);assert.equal(active,false);
  }
}

// Cancel before native dispatch; duplicate per-slice admissions coalesce and
// changing policy on the same transport does not inject a stop interruption.
{
  const calls=[],ack=deferred();
  const lease=new ReaderTtsAudioSessionLease({async activate(mix){calls.push(mix);await ack.promise;},async deactivate(){calls.push('release');}});
  const owner=lease.createOwner('system');
  const pending=lease.activate(owner,false), retired=assert.rejects(pending,/retired/);
  const cleanup=lease.deactivate(owner);await retired;await cleanup;assert.deepEqual(calls,[]);
  const first=lease.activate(owner,false),same=lease.activate(owner,false);assert.equal(first,same);
  ack.resolve();await first;await same;await lease.activate(owner,false);assert.deepEqual(calls,[false]);
  await lease.activate(owner,true);assert.deepEqual(calls,[false,true]);
}

// Native release failure is not a release receipt; a successor retries cleanup
// before activation and cannot overlap an unknown resource owner.
{
  const calls=[];let fail=true;
  const lease=new ReaderTtsAudioSessionLease({async activate(mix){calls.push(['activate',mix]);},async deactivate(){calls.push(['release']);if(fail)throw new Error('native release denied');}});
  const old=lease.createOwner('system'),next=lease.createOwner('http');
  await lease.activate(old,false);
  await assert.rejects(lease.deactivate(old),/release denied/);
  await assert.rejects(lease.activate(next,true),/release denied/);
  assert.deepEqual(calls,[['activate',false],['release'],['release']]);
  fail=false;await lease.activate(next,true);
  assert.deepEqual(calls.slice(-2),[['release'],['activate',true]]);
}

// Exercise the exact production Harmony adapter with a deferred AudioKit
// driver. This is code-side native-call ordering, not device audio acceptance.
{
  const source=readFileSync(new URL('../entry/src/main/ets/app/HarmonyTtsAudioSessionLease.ts',import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'').replace('export const harmonyTtsAudioSessionLease','const harmonyTtsAudioSessionLease');
  const calls=[];
  const manager={setAudioSessionScene:value=>calls.push(['scene',value]),async activateAudioSession(value){calls.push(['native',value.concurrencyMode]);},async deactivateAudioSession(){calls.push(['release']);}};
  const audio={AudioSessionScene:{AUDIO_SESSION_SCENE_MEDIA:10},AudioConcurrencyMode:{CONCURRENCY_MIX_WITH_OTHERS:20,CONCURRENCY_PAUSE_OTHERS:30},getAudioManager:()=>({getSessionManager:()=>manager})};
  const lease=new Function('audio','ReaderTtsAudioSessionLease',stripTypeScriptTypes(source)+';return harmonyTtsAudioSessionLease;')(audio,ReaderTtsAudioSessionLease);
  assert.deepEqual(calls,[],'runtime construction must not acquire platform focus');
  const owner=lease.createOwner('system');await lease.activate(owner,false);await lease.activate(owner,false);await lease.activate(owner,true);await lease.deactivate(owner);
  assert.deepEqual(calls,[['scene',10],['native',30],['scene',10],['native',20],['release']]);
}
console.log('PASS TTS audio lease: deferred retirement, shared native ownership, policy changes, reentry and failed-release recovery');
