import assert from 'node:assert/strict';
import {state,preferenceGateway,preferenceReader,deferred,settle} from './lib/reader-tts-preference-probe.mjs';
const initial=state.createDefaultReaderTtsPreferencesSnapshot(),choice={...initial,allowMixing:true,language:'en-US',person:7};
for(const failure of ['before','after','put']){
  const f=preferenceGateway();await f.owner.update(initial);
  if(failure==='put')f.failPut();else f.failFlush(failure);
  await assert.rejects(f.owner.update(choice));const facts=f.owner.writeFacts();
  assert.equal(facts.pendingReconciliation,true);assert.deepEqual(facts.accepted,choice);assert.deepEqual(facts.saved,initial);
  assert.deepEqual(f.puts(),[initial,choice],'unknown write never compensates an old whole snapshot');
  if(failure==='after')assert.deepEqual(f.saved(),choice,'lost ACK may already be durable');
  const warm=f.remount();assert.deepEqual(await warm.load(),choice);assert.equal(warm.writeFacts().pendingReconciliation,true);
  facts.accepted.allowMixing=false;assert.equal(warm.writeFacts().accepted.allowMixing,true);
  await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);assert.deepEqual(warm.writeFacts().saved,choice);
  assert.deepEqual(f.puts(),[initial,choice,choice],'one finite same-original retry');
}
{
  const f=preferenceGateway(),gate=deferred();await f.owner.update(initial);f.hangFlush(gate);
  const one=f.owner.update(choice);await settle();const warm=f.remount();assert.deepEqual(await warm.load(),choice);
  const two=warm.patch({followHighlight:false});await settle();assert.equal(f.puts().length,2,'one file lane stays held across Runtime retirement');
  gate.resolve();await one;await two;assert.equal(f.saved().followHighlight,false);assert.equal(f.saved().person,7);
}
{
  const f=preferenceGateway();f.failFlush('after');await assert.rejects(f.owner.update(choice));
  const before=f.puts().length;await assert.rejects(f.owner.retryAccepted(()=>false),/SUPERSEDED/);assert.equal(f.puts().length,before);
  f.Gateway.acceptedRevision=Number.MAX_SAFE_INTEGER;await assert.rejects(f.owner.patch({backgroundPlayback:false}),/REVISION_EXHAUSTED/);
  assert.equal(f.puts().length,before);
}
for(const [method,args,field,value] of [['changeTtsAllowMixing',[true],'ttsAllowMixing',true],['changeTtsVoice',['en-US',7],'ttsPerson',7],
  ['changeTtsBackgroundPlayback',[false],'ttsBackgroundPlayback',false],['changeTtsKeepScreenOn',[true],'ttsKeepScreenOn',true],
  ['changeTtsFailurePolicy',['skip'],'ttsFailurePolicy','skip'],['changeTtsFollowHighlight',[false],'ttsFollowHighlight',false],
  ['changeTtsPauseOnInterruption',[false],'ttsPauseOnInterruption',false]]){
  const f=preferenceGateway(),ui=preferenceReader(f.owner);f.failFlush('after');ui.owner[method](...args);await settle();
  assert.equal(ui.owner[field],value);assert.equal(ui.owner.ttsPreferencesRecovery.canRetry,true);assert.match(ui.owner.ttsPreferencesRecovery.message,/尚未确认/);
  const native=ui.events.filter(e=>e[0]==='voice'||e[0]==='mixing');ui.owner.retryPendingTtsPreferences();await settle();
  assert.equal(f.owner.writeFacts().pendingReconciliation,false);assert.equal(ui.owner.ttsPreferencesRecovery.visible,false);
  assert.deepEqual(ui.events.filter(e=>e[0]==='voice'||e[0]==='mixing'),native,'storage reconciliation never rolls native fields back');
}
{
  const f=preferenceGateway(),ui=preferenceReader(f.owner);f.failFlush('after');ui.owner.changeTtsAllowMixing(true);await settle();
  f.setBarrier(async()=>{throw Error('restore unavailable');});ui.owner.changeTtsBackgroundPlayback(false);await settle();
  assert.equal(f.owner.writeFacts().accepted.backgroundPlayback,true,'new field has not dispatched');
  f.setBarrier(async()=>{});ui.owner.retryPendingTtsPreferences();await settle();
  assert.equal(f.saved().backgroundPlayback,false,'retry uses latest cumulative choice instead of older accepted gateway snapshot');
  assert.equal(f.saved().allowMixing,true);
}
{
  const f=preferenceGateway(),ui=preferenceReader(f.owner,{windowFailure:true});ui.state('playing');ui.owner.changeTtsKeepScreenOn(true);await settle();
  assert.equal(f.saved().keepScreenOn,true,'native window refusal does not cancel accepted preference persistence');
  assert.equal(ui.owner.ttsPreferencesRecovery.visible,false);assert.ok(ui.events.some(e=>e[0]==='diagnostic'&&e[1]==='window-policy'));
}
{
  const f=preferenceGateway(),ui=preferenceReader(f.owner);ui.owner.logTtsFailure=()=>{throw Error('diagnostic failure');};
  ui.owner.notifyTtsPreferencePending(Error('lost flush ACK'),()=>true);assert.equal(ui.owner.ttsPreferencesRecovery.canRetry,true);
  assert.equal(f.puts().length,0,'diagnostic failure cannot create a preference write');
}
console.log('PASS actual TTS accepted/saved facts: put/flush loss, warm Runtime, shared lane, finite exact retry, overflow, seven current field producers, latest dirty patch retry and independent window policy.');
