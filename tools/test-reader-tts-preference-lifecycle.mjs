import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {state,lreFile,preferenceGateway,preferenceReader,deferred,settle} from './lib/reader-tts-preference-probe.mjs';

// Explicit domain check, never imported by the build or another contract.
for(const boundary of ['restore','store','read','serialization']){
  const f=preferenceGateway(),gate=deferred();let first,live=true;
  if(boundary==='restore')f.setBarrier(()=>gate.promise);
  if(boundary==='store')f.hangStore(gate);
  if(boundary==='read')f.hangRead(gate);
  if(boundary==='serialization'){f.hangFlush(gate);first=f.owner.update(state.createDefaultReaderTtsPreferencesSnapshot());await settle();}
  const task=f.owner.patch({allowMixing:true},()=>live),failure=assert.rejects(task,/SUPERSEDED/);
  await settle();const before=f.puts().length;live=false;gate.resolve();await failure;await first;
  assert.equal(f.puts().length,before,`${boundary}: retirement before actual put blocks first dispatch`);
}
{
  const f=preferenceGateway(),gate=deferred();f.hangPut(gate);
  const task=f.owner.patch({allowMixing:true});await settle();assert.equal(f.puts().length,1);
  f.retire();gate.resolve();await task;assert.equal(f.saved().allowMixing,true,'already dispatched put still owns its flush');
}
{
  const f=preferenceGateway();f.setBarrier(()=>assert.fail('reset-owned skips Theme user-change barrier'));
  await f.owner.update(state.createDefaultReaderTtsPreferencesSnapshot(),true);assert.equal(f.puts().length,1);
}
const mutations=[['changeTtsAllowMixing',[true],'ttsAllowMixing',true,'mixing'],
  ['changeTtsBackgroundPlayback',[false],'ttsBackgroundPlayback',false],['changeTtsKeepScreenOn',[true],'ttsKeepScreenOn',true],
  ['changeTtsFailurePolicy',['skip'],'ttsFailurePolicy','skip'],['changeTtsFollowHighlight',[false],'ttsFollowHighlight',false],
  ['changeTtsPauseOnInterruption',[false],'ttsPauseOnInterruption',false],['changeTtsVoice',['en-US',7],'ttsLanguage','en-US','voice']];
function retire(ui,boundary){if(boundary==='lifecycle')ui.owner.lifecycleToken++;if(boundary==='book')ui.owner.bookId='new-book';
  if(boundary==='coordinator')ui.owner.ttsCoordinator={};}
for(const [method,args,field,value,native] of mutations){
  for(const boundary of ['lifecycle','book','coordinator']){
    const f=preferenceGateway(),gate=deferred(),ui=preferenceReader(f.owner);f.setBarrier(()=>gate.promise);
    let nativeGate;if(native){nativeGate=deferred();ui.coordinator[native==='voice'?'setVoice':'setAllowMixing']=()=>nativeGate.promise;}
    ui.owner[method](...args);await settle();retire(ui,boundary);ui.owner[field]='successor-value';
    nativeGate?.resolve(true);gate.resolve();await settle();
    assert.equal(f.puts().length,0,`${method}/${boundary}: old pending work cannot first dispatch`);
    assert.equal(ui.owner[field],'successor-value','old native ACK cannot replace successor presentation');
    assert.equal(ui.events.filter(e=>e[0]==='diagnostic').length,0);
  }
  for(const afterDispatch of [false,true]){
    const f=preferenceGateway(),gate=deferred(),ui=preferenceReader(f.owner);
    if(afterDispatch){f.hangFlush(gate);f.failFlush('after');}else f.setBarrier(()=>gate.promise.then(()=>{throw Error('controlled restore failure');}));
    ui.owner[method](...args);await settle();assert.equal(ui.owner[field],value);
    assert.equal(ui.owner.ttsPreferencesRecovery.visible,false,'ordinary pending write is quiet');
    gate.resolve();await settle();assert.equal(ui.owner[field],value,'save failure keeps the accepted own field');
    assert.equal(ui.owner.ttsPreferencesRecovery.canRetry,true);
    assert.match(ui.owner.ttsPreferencesRecovery.message,afterDispatch?/尚未确认/:/未能保存/);
  }
}
// Pending voice/mixing cannot be retired by acceptance of another field.
for(const native of ['voice','mixing']){
  const f=preferenceGateway(),gate=deferred(),ui=preferenceReader(f.owner);
  ui.coordinator[native==='voice'?'setVoice':'setAllowMixing']=()=>gate.promise;
  ui.owner[native==='voice'?'changeTtsVoice':'changeTtsAllowMixing'](...(native==='voice'?['en-US',7]:[true]));
  ui.owner.changeTtsBackgroundPlayback(false);await settle();gate.resolve(true);await settle();
  assert.equal(native==='voice'?f.saved().person:f.saved().allowMixing,native==='voice'?7:true);
  assert.equal(f.saved().backgroundPlayback,false);
}
const scratch=mkdtempSync(join(tmpdir(),'reader-tts-owner-negative-'));
try{
  const original=readFileSync(lreFile,'utf8'),start=original.indexOf('  private captureTtsPreferenceOwner('),end=original.indexOf('\n  private ttsPreferencesSnapshot(',start);
  assert.ok(start>=0&&end>start);const path=join(scratch,'LocalReadingExperience.ets');
  writeFileSync(path,original.slice(0,start)+'  private captureTtsPreferenceOwner(): () => boolean { return (): boolean => true; }\n'+original.slice(end));
  const f=preferenceGateway(),gate=deferred(),ui=preferenceReader(f.owner,{file:path});ui.coordinator.setVoice=()=>gate.promise;
  ui.owner.changeTtsVoice('en-US',7);retire(ui,'lifecycle');gate.resolve(true);await settle();
  assert.equal(f.puts().length,1,'removing actual owner guard is a behavioral negative, not a text-count assertion');
}finally{rmSync(scratch,{recursive:true,force:true});}
console.log('PASS actual TTS preference lifecycle: pre-put boundaries, dispatched completion, reset-owned barrier, seven field producers, owner retirement, native independence, retained failure and owner-guard negative.');
