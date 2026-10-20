import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import * as state from '../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const dir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const source = readFileSync(new URL('ReaderTtsPreferencesGateway.ts', dir), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const settle = async () => { for(let i=0;i<8;i++) await new Promise(done=>setImmediate(done)); };
function fixture(productionSource = source) {
  const events=[], cache=new Map(), durable=new Map(); let failure, putFailure=false, flushGate, readGate, barrier=async()=>{};
  const runtime={getUIAbilityContext:()=>({})};let active=runtime;
  const store={async get(key,fallback) {events.push(['get']);if(readGate){const gate=readGate;readGate=undefined;await gate.promise;}return cache.get(key)??fallback;},
    async put(key,value) {events.push(['put',JSON.parse(value)]);if(putFailure){putFailure=false;throw Error('put rejected before effect');}cache.set(key,value);},
    async flush() {events.push(['flush']);if(flushGate){const gate=flushGate;flushGate=undefined;await gate.promise;}
      if(failure==='before'){failure=undefined;throw Error('flush failed before durable effect');}
      for(const [key,value] of cache)durable.set(key,value);
      if(failure==='after'){failure=undefined;throw Error('durable flush lost ACK');}}
  };
  // Full production gateway; only real SDK Preferences delivery and Runtime
  // identity are controlled. No copied preference state machine or IO queue.
  const Gateway=new Function(...Object.keys(state),'ReaderThemeHost','ReaderRuntimeOwner','preferences',
    `${stripTypeScriptTypes(productionSource.slice(productionSource.indexOf('const READER_TTS_PREFERENCES_NAME'))).replace('export class ','class ')};return ReaderTtsPreferencesGateway;`)
    (...Object.values(state),{prepareUserChange:()=>barrier()},{isCurrent:owner=>owner===active},{getPreferences:async()=>store});
  const owner=new Gateway(runtime);
  return {owner,Gateway,runtime,store,events,cache,durable,failFlush:when=>{failure=when;},failPut:()=>{putFailure=true;},
    hangFlush:gate=>{flushGate=gate;},hangRead:gate=>{readGate=gate;},setBarrier:value=>{barrier=value;},
    remount() {active={...runtime};return new Gateway(active);},retire(){active=undefined;}};
}
const initial=state.createDefaultReaderTtsPreferencesSnapshot(), choice={...initial,allowMixing:true,language:'en-US',person:7};
for(const failure of ['before','after','put']) {
  const f=fixture();await f.owner.update(initial);const before=f.events.length;
  if(failure==='put')f.failPut();else f.failFlush(failure);
  await assert.rejects(f.owner.update(choice));
  const facts=f.owner.writeFacts();assert.equal(facts.pendingReconciliation,true);assert.deepEqual(facts.accepted,choice);assert.deepEqual(facts.saved,initial);
  assert.deepEqual(f.events.slice(before).filter(e=>e[0]==='put').map(e=>e[1]),[choice],
    'unknown put/flush never compensates the previous snapshot');
  if(failure==='after')assert.deepEqual(JSON.parse(f.durable.get('snapshot')),choice,'lost ACK can already be durable');
  const warm=f.remount();assert.deepEqual(await warm.load(),choice,'warm Runtime consumes accepted choice without declaring it saved');
  assert.equal(warm.writeFacts().pendingReconciliation,true,'matching cached get/load is not a flush receipt');
  facts.accepted.allowMixing=false;assert.equal(warm.writeFacts().accepted.allowMixing,true,'fact snapshots do not leak mutable owner state');
  await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);assert.deepEqual(warm.writeFacts().saved,choice);
  assert.deepEqual(f.events.slice(before).filter(e=>e[0]==='put').map(e=>e[1]),[choice,choice],
    'finite retry dispatches only the same idempotent whole snapshot');
}
{
  const f=fixture(), gate=deferred();await f.owner.update(initial);f.hangFlush(gate);
  const one=f.owner.update(choice);await settle();const warm=f.remount();assert.deepEqual(await warm.load(),choice);
  const newer={...choice,followHighlight:false},two=warm.update(newer);await settle();
  assert.deepEqual(f.events.filter(e=>e[0]==='put').map(e=>e[1]),[initial,choice],
    'same Preferences file IO lane remains held across Runtime retirement until actual flush settles');
  gate.resolve();await one;await two;assert.deepEqual(warm.writeFacts().accepted,newer);assert.deepEqual(warm.writeFacts().saved,newer);
  assert.equal(warm.writeFacts().pendingReconciliation,false);
}
{
  const f=fixture(), gate=deferred();await f.owner.update(initial);f.failFlush('after');await assert.rejects(f.owner.update(choice));
  f.setBarrier(()=>{f.setBarrier(async()=>{});return gate.promise;});
  const retry=f.owner.retryAccepted(), rejected=assert.rejects(retry,/SUPERSEDED/);
  const newer={...choice,followHighlight:false};await f.owner.update(newer);gate.resolve();await rejected;
  assert.deepEqual(f.owner.writeFacts().accepted,newer,'queued old retry cannot overwrite a newer accepted choice');
  assert.deepEqual(f.events.filter(e=>e[0]==='put').map(e=>e[1]),[initial,choice,newer]);
}
{
  const f=fixture(), gate=deferred();await f.owner.update(initial);f.hangRead(gate);
  const update=f.owner.update(choice), rejected=assert.rejects(update,/SUPERSEDED/);await settle();f.remount();gate.resolve();await rejected;
  assert.deepEqual(f.owner.writeFacts().accepted,initial);assert.equal(f.owner.writeFacts().pendingReconciliation,false);
  assert.equal(f.events.filter(e=>e[0]==='put').length,1,'retired predispatch owner never becomes accepted or writes');
  f.Gateway.acceptedRevision=Number.MAX_SAFE_INTEGER;
  const next=f.remount();await assert.rejects(next.update(choice),/REVISION_EXHAUSTED/);
  assert.equal(f.events.filter(e=>e[0]==='put').length,1,'revision exhaustion cannot reset and dispatch');
}

const mutations=[['changeTtsAllowMixing',[true],'ttsAllowMixing',true],['changeTtsBackgroundPlayback',[false],'ttsBackgroundPlayback',false],
  ['changeTtsKeepScreenOn',[true],'ttsKeepScreenOn',true],['changeTtsFailurePolicy',['skip'],'ttsFailurePolicy','skip'],
  ['changeTtsFollowHighlight',[false],'ttsFollowHighlight',false],['changeTtsPauseOnInterruption',[false],'ttsPauseOnInterruption',false],
  ['changeTtsVoice',['en-US',7],'ttsLanguage','en-US']];
function reader(f,file=new URL('LocalReadingExperience.ets',dir)) {
  const events=[];
  const coordinator={setAllowMixing:async value=>events.push(['mixing',value]),setVoice:async(...value)=>events.push(['voice',...value]),
    setFailurePolicy:value=>events.push(['failure',value]),setPauseOnInterruption:value=>events.push(['pause',value])};
  const Reader=productionMotionMethods(file,['nextTtsPreferenceMutationGeneration','captureTtsPreferenceAdmission','isSessionActive',
    'ttsPreferencesSnapshot','copyTtsPreferencesSnapshot','persistTtsPreferencesSnapshot','persistTtsPreferences','notifyTtsPreferencePending',
    'retryPendingTtsPreferences','loadTtsPresentationMetadata','admitTtsPreferences',
    ...mutations.map(e=>e[0])],{hilog:{error(){}},ReaderRuntimeOwner:{current:()=>({getTtsHost:()=>({setBackgroundPlaybackEnabled:value=>events.push(['background',value])})})}});
  const owner=Object.assign(new Reader(),{mounted:true,lifecycleToken:1,sourceId:'source',bookId:'book',exitRequested:false,
    ttsPreferenceMutationGeneration:0,ttsCoordinator:coordinator,ttsPreferencesGateway:f.owner,
    ttsLanguage:'zh-CN',ttsPerson:0,ttsPauseOnInterruption:true,ttsAllowMixing:false,ttsFailurePolicy:'stop',ttsFollowHighlight:true,
    ttsBackgroundPlayback:true,ttsKeepScreenOn:false,ttsVoiceOptions:[{language:'en-US',person:7}],
    readerSettingsSnapshot:{},controlsPresentedForWindow:()=>false,applyReaderWindowPolicy:async()=>events.push(['window']),
    requireTtsConfigurationHost:()=>({refreshMetadata:async()=>{}}),
    getUIContext:()=>({getPromptAction:()=>({showToast:spec=>events.push(['notice',spec.message])})}),
    logTtsFailure:(...args)=>events.push(['diagnostic',...args])});
  return {owner,events};
}
async function runUiCases(file) {
  for(const [method,args,field,value] of mutations) {
    const f=fixture();await f.owner.update(initial);f.failFlush('after');const ui=reader(f,file);ui.owner[method](...args);await settle();
    assert.equal(ui.owner[field],value,`${method}: unknown preference flush keeps the current accepted choice`);
    assert.equal(f.owner.writeFacts().pendingReconciliation,true);assert.equal(f.owner.writeFacts().savedRevision,1);
    assert.equal(ui.events.filter(e=>e[0]==='notice').length,0,'unconfirmed durable preferences use a persistent notice');
    assert.equal(ui.owner.ttsPreferencesRecovery.visible,true);assert.equal(ui.owner.ttsPreferencesRecovery.canRetry,true);
    assert.match(ui.owner.ttsPreferencesRecovery.message,/尚未确认/);
    if(method==='changeTtsAllowMixing')assert.deepEqual(ui.events.filter(e=>e[0]==='mixing'),[['mixing',true]],'unknown preference failure does not roll back active audio mixing');
    if(method==='changeTtsVoice')assert.deepEqual(ui.events.filter(e=>e[0]==='voice'),[['voice','en-US',7]],'unknown preference failure does not reactivate an old voice');
    if(method==='changeTtsBackgroundPlayback')assert.deepEqual(ui.events.filter(e=>e[0]==='background'),[['background',false]],'unknown preference failure does not regrant a background choice');
    ui.owner.retryPendingTtsPreferences();await settle();assert.equal(f.owner.writeFacts().pendingReconciliation,false);
    assert.equal(ui.owner.ttsPreferencesRecovery.visible,false,'matching actual flush confirmation settles the persistent notice');
  }
}
await runUiCases();
for (const retired of [false,true]) {
  const f=fixture(),gate=deferred();await f.owner.update(initial);f.hangFlush(gate);const old=f.owner.update(choice);await settle();
  const warm=f.remount(),ui=reader({...f,owner:warm});
  await ui.owner.loadTtsPresentationMetadata({getTtsHost:()=>({listSystemVoices:async()=>[]})},ui.owner.ttsCoordinator,1);
  assert.equal(ui.owner.ttsAllowMixing,true,'real warm metadata load projects accepted choice while old flush is unreturned');
  assert.equal(warm.writeFacts().pendingReconciliation,true,'metadata does not infer durable from the loaded value');
  assert.equal(f.events.filter(e=>e[0]==='put').length,2,'metadata recovery does not bypass the still-held file IO lane');
  if(retired){ui.owner.ttsPreferenceMutationGeneration++;ui.owner.ttsAllowMixing=false;
    ui.owner.setReaderPreferenceNotice('tts','后续设置保存状态',false);}
  gate.resolve();await old;await settle();
  assert.equal(f.events.filter(e=>e[0]==='put').length,retired?2:3,
    'existing metadata entry dispatches one finite same-snapshot retry; retired generation cannot dispatch it');
  assert.equal(ui.events.filter(e=>e[0]==='notice').length,0,'retired retry does not publish a stale failure into new presentation');
  if(retired)assert.equal(ui.owner.ttsPreferencesRecovery.message,'后续设置保存状态','old confirmation cannot clear a successor notice');
  else assert.equal(ui.owner.ttsPreferencesRecovery.visible,false,'current finite retry settles the original notice');
}
{
  const f=fixture(),ui=reader(f);ui.owner.applyReaderWindowPolicy=async()=>{throw Error('native window policy refused');};
  ui.owner.changeTtsKeepScreenOn(true);await settle();assert.equal(f.events.filter(e=>e[0]==='put').length,0);
  assert.equal(ui.events.filter(e=>e[0]==='notice').length,0,'native window refusal does not masquerade as a dispatched preference flush');
  assert.notEqual(ui.owner.ttsPreferencesRecovery?.visible,true,'window refusal cannot publish a preference write failure');
  assert.equal(ui.events.find(e=>e[0]==='diagnostic')[1],'window-policy');
}
{
  const f=fixture(),ui=reader(f);ui.owner.getUIContext=()=>{throw Error('UI retired');};ui.owner.logTtsFailure=()=>{throw Error('diagnostic failed');};
  ui.owner.notifyTtsPreferencePending(Error('lost flush ACK'),()=>true);
  assert.equal(ui.owner.ttsPreferencesRecovery.visible,true,'diagnostic failure does not discard the persistent recovery');
  assert.equal(f.events.length,0,'notice/diagnostic failure cannot mutate preference or playback state');
}
const scratch=mkdtempSync(join(tmpdir(),'reader-tts-write-facts-'));
try {
  const file=join(scratch,'LocalReadingExperience.ets'),lre=readFileSync(new URL('LocalReadingExperience.ets',dir),'utf8');
  const start=lre.indexOf('  private changeTtsAllowMixing('),end=lre.indexOf('  private changeTtsBackgroundPlayback(',start);
  const old=lre.slice(start,end).replace('this.notifyTtsPreferencePending(error as Error, current);',
    'if (current()) { this.ttsAllowMixing = previous.allowMixing; await coordinator?.setAllowMixing(previous.allowMixing); }');
  writeFileSync(file,lre.slice(0,start)+old+lre.slice(end));
  await assert.rejects(runUiCases(file),/keeps the current accepted choice/,'old real LRE rollback is the required negative control');
} finally {rmSync(scratch,{recursive:true,force:true});}
console.log('PASS actual TTS Preferences full Gateway→seven real LRE mutations: accepted/saved facts, put-before-effect and flush-lost-ACK, no old compensation or playback rollback, warm Runtime, one file IO lane, exact finite retry, stale retry rejection, overflow and native policy separation; OS durability/target remains separate.');
