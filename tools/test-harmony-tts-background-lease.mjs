import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {HarmonyTtsHostRouter} from '../entry/src/main/ets/app/HarmonyTtsHostRouter.ts';

const source=readFileSync(new URL('../entry/src/main/ets/app/HarmonyTtsBackgroundSession.ts',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture() {
  const calls=[],listeners=new Set();let next=20,available=true,failStop=false,missingId=false,failReadback=false;
  const tasks=[];
  const native={
    on(name,listener){assert.equal(name,'continuousTaskCancel');listeners.add(listener);},
    off(name,listener){assert.equal(name,'continuousTaskCancel');listeners.delete(listener);},
    async getAllContinuousTasks(){if(failReadback)throw Error('readback failed');return tasks.map(task=>({...task}));},
    async startBackgroundRunning(context,modes,agent){calls.push(['start',context,modes,agent]);
      const id=next++;tasks.push({continuousTaskId:id,abilityName:'EntryAbility',backgroundModes:['audioPlayback'],isFromWebView:false});
      return {notificationId:100,continuousTaskId:missingId?undefined:id};},
    async stopBackgroundRunning(context,id){calls.push(['stop',id]);assert.equal(typeof id,'number','no broad context-only cleanup');
      if(failStop)throw Error('release failed');const at=tasks.findIndex(task=>task.continuousTaskId===id);if(at>=0)tasks.splice(at,1);},
  };
  const want={OperationType:{START_ABILITY:1},WantAgentFlags:{UPDATE_PRESENT_FLAG:2},async getWantAgent(){calls.push(['want']);return {agent:true};}};
  const Class=new Function('wantAgent','backgroundTaskManager','hilog','canIUse',
    stripTypeScriptTypes(source.replace(/^import[^;]*;\s*/gm,'')).replace(/^export /gm,'')+';return HarmonyTtsBackgroundSession;')
    (want,native,{warn(){},error(){}},()=>available);
  const owner=new Class({abilityInfo:{bundleName:'io.reader.minliny',name:'EntryAbility'}});
  return {owner,native,want,calls,tasks,listeners,cancel(id,reason=1){for(const listener of listeners)listener({id,reason});},
    set available(value){available=value;},set failStop(value){failStop=value;},set missingId(value){missingId=value;},
    set failReadback(value){failReadback=value;}};
}

{
  const f=fixture();let revocations=0;f.owner.setRevocationListener(()=>revocations++);
  assert.equal(await f.owner.activate(),true);const id=f.owner.capability().taskId;
  await f.owner.activate();assert.equal(f.calls.filter(call=>call[0]==='start').length,1,'same admitted lease is reused');
  f.cancel(id+1);assert.equal(f.owner.isActive(),true,'other task revoke never pauses this owner');
  f.cancel(id,2);assert.equal(f.owner.isActive(),false);assert.equal(f.owner.capability().phase,'revoked');assert.equal(revocations,1);
  f.cancel(id,2);assert.equal(revocations,1);await f.owner.close();assert.equal(f.listeners.size,0);
}
{
  const f=fixture(),wait=deferred();f.want.getWantAgent=()=>wait.promise;
  const admission=f.owner.activate();await tick();const close=f.owner.close();wait.resolve({});
  assert.equal(await admission,false);await close;assert.equal(f.calls.filter(call=>call[0]==='start').length,0,'retirement before native dispatch prevents resource acquisition');
}
{
  const f=fixture(),wait=deferred();f.native.startBackgroundRunning=()=>wait.promise;
  const admission=f.owner.activate();await tick();const close=f.owner.close();wait.resolve({continuousTaskId:51});
  assert.equal(await admission,false);await close;
  assert.deepEqual(f.calls.filter(call=>call[0]==='stop'),[['stop',51]],'late ACK retires its exact native task');
  assert.equal(f.owner.isActive(),false);
}
{
  const f=fixture(),wait=deferred();f.native.startBackgroundRunning=()=>wait.promise;
  const admission=f.owner.activate();await tick();f.cancel(53);wait.resolve({continuousTaskId:53});
  assert.equal(await admission,false);assert.equal(f.owner.capability().phase,'revoked');
  assert.equal(f.calls.filter(call=>call[0]==='stop').length,0,'cancel-before-ACK is native release evidence');await f.owner.close();
}
{
  const f=fixture();await f.owner.activate();const id=f.owner.capability().taskId;f.failStop=true;
  await assert.rejects(f.owner.deactivate(),/release failed/);assert.equal(f.owner.isActive(),false);
  assert.deepEqual(f.owner.capability(),{phase:'release-failed',taskId:id,reason:'release failed'});
  assert.equal(await f.owner.activate(),false,'failed prior release cannot create a duplicate successor');
  assert.equal(f.calls.filter(call=>call[0]==='start').length,1);
  f.failStop=false;assert.equal(await f.owner.activate(),true);await f.owner.close();
  assert.equal(f.owner.capability().phase,'released');assert.equal(f.owner.capability().taskId,undefined);
}
{
  const f=fixture();f.missingId=true;assert.equal(await f.owner.activate(),true,'exact before/after native readback resolves a missing ID');
  assert.equal(f.owner.capability().taskId,20);await f.owner.close();
}
{
  const f=fixture();f.missingId=true;f.failReadback=true;
  assert.equal(await f.owner.activate(),false);assert.equal(f.owner.capability().phase,'unverified');
  assert.equal(await f.owner.activate(),false,'unknown native ownership cannot be replayed');
  await assert.rejects(f.owner.close(),/no verified native identity/);
  assert.equal(f.calls.filter(call=>call[0]==='stop').length,0,'unknown ownership never uses broad cleanup');
  assert.equal(f.listeners.size,0);
}
{
  const f=fixture();f.available=false;assert.equal(await f.owner.activate(),false);assert.equal(f.owner.capability().phase,'unavailable');await f.owner.close();
}
{
  const f=fixture();f.native.on=()=>{throw Error('observer denied');};
  assert.equal(await f.owner.activate(),false);assert.equal(f.owner.capability().phase,'denied');
  assert.equal(f.calls.filter(call=>call[0]==='start').length,0,'a task without revocation observation is never declared admitted');await f.owner.close();
}

// The actual router distinguishes foreground capability loss from mandatory
// background suspension, and retires its event subscription on close.
{
  const f=fixture(),events=[];let foreground=true;
  const speech={setEventListener(){},async activateAudioSession(){},async deactivateAudioSession(){},async close(){}};
  const media={setEventListener(){},async activate(){},async close(){}};
  const router=new HarmonyTtsHostRouter(speech,speech,media,f.owner,()=>foreground);
  router.setEventListener(event=>events.push(event),'test');await router.activateAudioSession(false);await tick();
  f.cancel(f.owner.capability().taskId);assert.deepEqual(events,[],'foreground speech remains available without background permission');
  await router.deactivateAudioSession();await router.activateAudioSession(false);await tick();foreground=false;
  f.cancel(f.owner.capability().taskId);assert.deepEqual(events,[{type:'backgroundLeaseRevoked'}]);
  await router.close();assert.equal(f.listeners.size,0);
}
console.log('PASS native background owner: exact task identity, deferred Want/start retirement, revoke-before-ACK, release failure/retry, missing-ID readback, no broad cleanup, real router foreground/background gates');
