import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({
  'cold-field-merge':'Entire Gateway: real stored base, cold-load lane, Theme ordering, cumulative accepted patches, failed reads and actual flush facts.',
  'accepted-field-intents':'Normal LRE callbacks: independent native acceptance, accepted revision vs pending intent, same-field supersession and failed/retired native requests.',
  'late-metadata-consumers':'Actual LRE metadata and entire Coordinator: saved fields arriving after first play, pending user voice, safe next-speech voice, background and catalogue fallback.',
  'speech-awake-owner':'Actual LRE state callback and window policy: acquire/release across playback states, base timeout lease, metadata, no per-character requests and independent save failure.',
  'pending-choice-producer':'Actual TTS configuration commit through normal LRE callbacks: select B then accepted-value A while B is still awaiting native admission.',
  'preference-recovery-interleavings':'Actual retry internal revision and metadata recovery: finite warm retry behind original flush, latest accepted field retirement and successor notice isolation.',
});
if(!cases.length)process.exit(0);
const {state,lreFile,gatewayFile,preferenceGateway,preferenceReader,deferred:makeDeferred,settle}=await import('./lib/reader-tts-preference-probe.mjs');
const {ReaderTtsSessionCoordinator}=await import('../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts');
const {chapter,canonicalRemoteContent,plan,FakeGateway,FakeHost}=await import('./lib/reader-tts-fixtures.mjs');
const base={...state.createDefaultReaderTtsPreferencesSnapshot(),language:'en-US',person:7,pauseOnInterruption:false,
  allowMixing:true,failurePolicy:'skip',followHighlight:false,backgroundPlayback:false,keepScreenOn:true};
const owned=[];
const releases=[];
const deferred=()=>{const gate=makeDeferred();releases.push(gate.resolve);return gate;};
const holdSpeech=f=>{const gate=f.host.blockNextSpeak();releases.push(gate.release);return gate;};
async function coordinator(listener){const core=new FakeGateway(),host=new FakeHost(),c=new ReaderTtsSessionCoordinator(core,host,async()=>{},listener);
  owned.push(c);await c.start({chapter,content:canonicalRemoteContent,contentVersion:1,scalarPosition:0,language:'zh-CN',person:0,
    backgroundPlayback:true,allowMixing:false});host.emit({type:'start',requestId:host.requests.at(-1).requestId});await c.whenSettled();return {c,core,host};}
async function finish(f){f.host.emit({type:'complete',requestId:f.host.requests.at(-1).requestId,completion:'audio'});await f.c.whenSettled();await settle();}

async function coldMerge(source){
  for(const patch of [{voice:{language:'zh-CN',person:0}},{pauseOnInterruption:true},{allowMixing:false},{failurePolicy:'stop'},
    {followHighlight:true},{backgroundPlayback:true},{keepScreenOn:false}]){
    const f=preferenceGateway(base,source);await f.owner.patch(patch);
    assert.deepEqual(f.saved(),state.mergeReaderTtsPreferencesPatch(base,patch),'ordinary patch preserves every untouched stored field');
  }
  const f=preferenceGateway(base,source),read=deferred();f.hangRead(read);
  const loading=f.owner.load(),writing=f.owner.patch({backgroundPlayback:true});await settle();assert.equal(f.puts().length,0);
  read.resolve();assert.deepEqual(await loading,base);await writing;assert.equal(f.saved().language,'en-US');
  assert.equal(f.saved().keepScreenOn,true);assert.equal(f.saved().backgroundPlayback,true);
}
async function coldFieldMerge(){
  await coldMerge();
  const source=readFileSync(gatewayFile,'utf8'),bad=source.replace('const base = ReaderTtsPreferencesGateway.accepted ?? read;',
    'const base = createDefaultReaderTtsPreferencesSnapshot();');assert.notEqual(bad,source);
  await assert.rejects(coldMerge(bad),/ordinary patch preserves/,'defaults-as-base is a failing real Gateway negative');
  {
    const f=preferenceGateway(base),barrier=deferred();let call=0,current=1;
    f.setBarrier(()=>++call===1?barrier.promise:Promise.resolve());
    const old=f.owner.patch({backgroundPlayback:true},()=>current===1);
    current=2;await f.owner.patch({backgroundPlayback:true,pauseOnInterruption:true},()=>current===2);
    barrier.resolve();await assert.rejects(old,/SUPERSEDED/);
    assert.equal(f.puts().length,1);assert.equal(f.saved().pauseOnInterruption,true);assert.equal(f.saved().language,'en-US');
  }
  {
    const f=preferenceGateway(base);f.failRead();await assert.rejects(f.owner.patch({allowMixing:false}),/read failure/);
    assert.equal(f.puts().length,0,'unknown base cannot dispatch a defaults snapshot');
    f.failFlush('after');await assert.rejects(f.owner.patch({allowMixing:false}),/lost ACK/);
    assert.equal(f.owner.writeFacts().pendingReconciliation,true);assert.equal(f.saved().allowMixing,false);
    const warm=f.remount();assert.equal((await warm.load()).allowMixing,false);assert.equal(warm.writeFacts().pendingReconciliation,true);
    await warm.retryAccepted();assert.equal(warm.writeFacts().pendingReconciliation,false);
  }
}

async function acceptedFieldIntents(){
  for(const field of ['voice','mixing'])for(const outcome of ['accepted','rejected','retired']){
    const f=preferenceGateway(base),barrier=deferred(),native=deferred();f.setBarrier(()=>barrier.promise);
    const ui=preferenceReader(f.owner);if(field==='voice')ui.coordinator.setVoice=()=>native.promise;else ui.coordinator.setAllowMixing=()=>native.promise;
    ui.callback(field==='voice'?'onTtsVoiceChange':'onTtsAllowMixingChange')(...(field==='voice'?['en-US',7]:[true]));
    assert.equal(ui.owner.ttsPreferenceMutationGeneration,0,'pending native intent is not an accepted field');
    ui.callback('onTtsBackgroundPlaybackChange')(false);ui.callback('onTtsPauseOnInterruptionChange')(false);
    assert.equal(ui.owner.ttsPreferenceMutationGeneration,2);
    if(outcome==='rejected')native.reject(Error('controlled native failure'));else native.resolve(outcome==='accepted');
    await settle();assert.equal(ui.owner.ttsPreferenceMutationGeneration,outcome==='accepted'?3:2);
    barrier.resolve();await settle();
    assert.equal(f.saved().backgroundPlayback,false);assert.equal(f.saved().pauseOnInterruption,false);
    assert.equal(f.saved().keepScreenOn,true,'unread unrelated field survives a first choice');
    assert.equal(ui.owner.ttsPreferencesRecovery.visible,false);
    if(outcome==='accepted')assert.equal(field==='voice'?f.saved().person:f.saved().allowMixing,field==='voice'?7:true);
    if(outcome==='rejected')assert.ok(ui.events.some(e=>e[0]==='diagnostic'));
  }
  for(const boundary of ['lifecycle','book','coordinator']){
    const f=preferenceGateway(base),native=deferred(),ui=preferenceReader(f.owner);ui.coordinator.setVoice=()=>native.promise;
    ui.callback('onTtsVoiceChange')('en-US',7);
    if(boundary==='lifecycle')ui.owner.lifecycleToken++;if(boundary==='book')ui.owner.bookId='new';if(boundary==='coordinator')ui.owner.ttsCoordinator={};
    native.resolve(true);await settle();assert.equal(f.puts().length,0);assert.equal(ui.owner.ttsLanguage,'zh-CN');
  }
  {
    const f=await coordinator(),disk=preferenceGateway(),ui=preferenceReader(disk.owner,{coordinator:f.c});
    const hold=holdSpeech(f);ui.callback('onTtsVoiceChange')('en-US',7);await hold.entered;
    ui.callback('onTtsBackgroundPlaybackChange')(false);assert.equal(ui.owner.ttsPreferenceMutationGeneration,1);
    const pause=f.c.pause();hold.release();await pause;await settle();
    assert.equal(ui.owner.ttsLanguage,'zh-CN','retired native speak fulfillment is not accepted voice');
    assert.equal(f.c.active.input.language,'zh-CN','tentative voice must not leak into accepted consumer');
    assert.equal(disk.saved().backgroundPlayback,false);assert.equal(disk.saved().language,'zh-CN');
    await f.c.resume();assert.equal(f.host.requests.at(-1).language,'zh-CN');
  }
  {
    const f=await coordinator(),first=holdSpeech(f);const one=f.c.setVoice('en-US',7);await first.entered;
    assert.equal(f.c.setVoice('en-US',7),one,'identical pending metadata shares its actual transaction');
    const two=f.c.setVoice('ja-JP',2);first.release();assert.equal(await one,false);assert.equal(await two,true);
    assert.equal(f.c.active.input.language,'ja-JP');assert.equal(f.host.requests.at(-1).language,'ja-JP');
    const requests=f.host.requests.length;assert.equal(await f.c.setVoice('ja-JP',2),true);assert.equal(f.host.requests.length,requests);
  }
}

async function lateMetadataConsumers(){
  {
    const f=await coordinator(),disk=preferenceGateway(base),read=deferred(),voices=deferred();disk.hangRead(read);
    const ui=preferenceReader(disk.owner,{coordinator:f.c});const metadata=ui.owner.loadTtsPresentationMetadata({getTtsHost:()=>({listSystemVoices:()=>voices.promise})},f.c,1);
    await settle();assert.equal(f.host.requests.length,1,'slow metadata does not withhold original speech');
    voices.resolve(ui.owner.ttsVoiceOptions);ui.callback('onTtsPauseOnInterruptionChange')(true);read.resolve();await metadata;await settle();
    assert.equal(ui.owner.ttsPauseOnInterruption,true);assert.equal(ui.owner.ttsBackgroundPlayback,false);assert.equal(ui.owner.ttsKeepScreenOn,true);
    assert.equal(f.c.active.input.backgroundPlayback,false);assert.equal(f.c.active.input.failurePolicy,'skip');assert.equal(f.c.active.input.pauseOnInterruption,true);
    assert.equal(f.host.requests.length,1,'late metadata must not retire the currently dispatched utterance');
    await finish(f);assert.equal(f.host.requests.at(-1).language,'en-US');assert.equal(f.host.requests.at(-1).person,7);
    assert.ok(f.host.calls.includes('activate:true'));
  }
  {
    const f=await coordinator(),disk=preferenceGateway(),ui=preferenceReader(disk.owner,{coordinator:f.c});
    const hold=holdSpeech(f);ui.callback('onTtsVoiceChange')('en-US',7);await hold.entered;
    ui.owner.admitTtsPreferences(base,ui.owner.ttsVoiceOptions);assert.equal(f.c.active.input.language,'zh-CN','saved voice cannot overwrite a pending explicit transaction');
    hold.release();await f.c.whenSettled();await settle();assert.equal(ui.owner.ttsLanguage,'en-US');assert.equal(f.c.active.input.person,7);
  }
  {
    const f=await coordinator(),disk=preferenceGateway(),ui=preferenceReader(disk.owner,{coordinator:f.c}),hold=deferred(),entered=deferred();
    const original=f.host.activateAudioSession.bind(f.host);let first=true;
    f.host.activateAudioSession=async value=>{if(first){first=false;entered.resolve();await hold.promise;}return original(value);};
    ui.callback('onTtsAllowMixingChange')(true);await entered.promise;
    const before=f.host.calls.filter(c=>c.startsWith('activate:')).length;
    ui.owner.admitTtsPreferences(state.createDefaultReaderTtsPreferencesSnapshot(),ui.owner.ttsVoiceOptions);
    hold.resolve();await f.c.whenSettled();await settle();
    assert.equal(ui.owner.ttsAllowMixing,true,'opposite late metadata cannot retire pending explicit mixing');
    assert.equal(disk.saved().allowMixing,true);assert.equal(f.c.active.input.allowMixing,true);
    assert.deepEqual(f.host.calls.filter(c=>c.startsWith('activate:')).slice(before),['activate:true']);
  }
  for(const control of ['pause','seek']){
    const f=await coordinator(),disk=preferenceGateway(),ui=preferenceReader(disk.owner,{coordinator:f.c});
    const operation=control==='pause'?f.c.pause():f.c.seek(1);ui.owner.admitTtsPreferences(base,ui.owner.ttsVoiceOptions);await operation;
    if(control==='pause'){assert.equal(f.c.getState().status,'paused');await f.c.resume();}
    assert.equal(f.host.requests.at(-1).language,'en-US','saved desired voice survives the accepted control intent');
  }
  {
    const disk=preferenceGateway(base),ui=preferenceReader(disk.owner);ui.owner.ttsVoiceOptions=[{language:'zh-CN',person:0}];
    ui.owner.admitTtsPreferences(base,ui.owner.ttsVoiceOptions);await settle();
    assert.equal(ui.events.filter(e=>e[0]==='voice').length,0,'catalogue fallback has no recursive native voice retry');
    assert.equal(disk.saved().language,'zh-CN');assert.equal(disk.saved().keepScreenOn,true);
  }
}

async function speechAwakeOwner(){
  const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts,options}=installedEtsCompiler();
  const text=readFileSync(lreFile,'utf8'),tree=ts.createSourceFile(String(lreFile),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  let expression;const visit=node=>{if(ts.isNewExpression(node)&&node.expression.getText(tree)==='ReaderTtsSessionCoordinator')expression=node.arguments[3].getText(tree);ts.forEachChild(node,visit);};visit(tree);assert.ok(expression);
  const emitted=ts.transpileModule('const listener = '+expression+';',{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
  const makeBridge=owner=>new Function('isOwnerCurrent','let coordinator;'+emitted+';return {listener,bind(value){coordinator=value;}};').call(owner,()=>owner.isSessionActive(1));
  const disk=preferenceGateway(),ui=preferenceReader(disk.owner);ui.owner.onSessionLaunchTtsState=()=>{};
  const bridge=makeBridge(ui.owner);
  const core=new FakeGateway(),host=new FakeHost(),c=new ReaderTtsSessionCoordinator(core,host,async()=>{},bridge.listener);owned.push(c);bridge.bind(c);ui.owner.ttsCoordinator=c;
  ui.callback('onTtsKeepScreenOnChange')(true);await settle();assert.equal(ui.window.length,0,'idle preference is not an active speech lease');
  await c.start({chapter,content:canonicalRemoteContent,contentVersion:1,scalarPosition:0});assert.equal(ui.window.at(-1).keepScreenOn,true);
  const count=ui.window.length;host.emit({type:'start',requestId:host.requests.at(-1).requestId});await c.whenSettled();
  assert.equal(ui.window.length,count,'preparing to playing does not repeat same desired policy');
  for(let position=1;position<4;position++)bridge.listener({...c.getState(),charStart:position});
  assert.equal(ui.window.length,count,'valid same-status position publications do not repeat window IO');
  await c.pause();assert.equal(ui.window.at(-1).keepScreenOn,false);await c.resume();assert.equal(ui.window.at(-1).keepScreenOn,true);
  await c.stop();assert.equal(ui.window.at(-1).keepScreenOn,false,'actual stop releases only the speech lease');
  ui.owner.screenAwakeKeepScreenOn=true;assert.equal(ui.owner.windowPolicyFor(ui.owner.readerSettingsSnapshot).keepScreenOn,true,'independent timeout lease remains');
  ui.owner.screenAwakeKeepScreenOn=false;
  for(const status of ['interrupted','idle','stopping','completed','error','failed']){ui.state(status);assert.equal(ui.owner.windowPolicyFor(ui.owner.readerSettingsSnapshot).keepScreenOn,false);}
  const refused=preferenceGateway(),other=preferenceReader(refused.owner,{windowFailure:true});other.state('playing');other.callback('onTtsKeepScreenOnChange')(true);await settle();
  assert.equal(refused.saved().keepScreenOn,true,'OS policy refusal cannot cancel accepted preference persistence');assert.ok(other.events.some(e=>e[1]==='window-policy'));
  async function latePlayingMetadata(file=lreFile){
    const storage=preferenceGateway(base),reader=preferenceReader(storage.owner,{file});reader.owner.onSessionLaunchTtsState=()=>{};
    const bridge=makeBridge(reader.owner),host=new FakeHost(),c=new ReaderTtsSessionCoordinator(new FakeGateway(),host,async()=>{},bridge.listener);
    owned.push(c);bridge.bind(c);reader.owner.ttsCoordinator=c;
    await c.start({chapter,content:canonicalRemoteContent,contentVersion:1,scalarPosition:0});
    host.emit({type:'start',requestId:host.requests.at(-1).requestId});await c.whenSettled();assert.equal(reader.owner.ttsState.status,'playing');
    assert.equal(reader.window.length,0);
    await reader.owner.loadTtsPresentationMetadata({getTtsHost:()=>({listSystemVoices:async()=>reader.owner.ttsVoiceOptions})},c,1);await settle();
    assert.equal(reader.window.at(-1)?.keepScreenOn,true,'late saved metadata acquires the already-playing actual speech window lease');
    assert.equal(reader.owner.ttsFollowHighlight,false,'late metadata admits follow preference');
    assert.ok(reader.events.some(e=>e[0]==='invalidate-follow'),'late disabled follow invalidates its actual page-follow consumer');
    reader.owner.changeTtsFollowHighlight(true);assert.ok(reader.events.some(e=>e[0]==='follow'&&e[1]==='playing'));
    await c.stop();assert.equal(reader.window.at(-1).keepScreenOn,false);
  }
  await latePlayingMetadata();
  const scratch=mkdtempSync(join(tmpdir(),'reader-tts-late-awake-negative-'));
  try{
    const start=text.indexOf('  private admitTtsPreferences('),end=text.indexOf('\n  private persistTtsPreferences(',start);
    const segment=text.slice(start,end),changed=segment.replace('    this.reconcileTtsWindowAwake(wasAwake);','');assert.notEqual(changed,segment);
    const file=join(scratch,'LocalReadingExperience.ets');writeFileSync(file,text.slice(0,start)+changed+text.slice(end));
    await assert.rejects(latePlayingMetadata(file),/late saved metadata acquires/,'removing the actual metadata window consumer must fail');
  }finally{rmSync(scratch,{recursive:true,force:true});}
}

async function pendingChoiceProducer(){
  const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  const options=await import('../entry/src/main/ets/features/reading/presentation/ReaderTtsConfigOptions.ts');
  const Content=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets',import.meta.url),
    'ReaderControlTtsContent',['commitConfiguration','configurationChoices'],options);
  for(const field of ['voice','session']){
    const f=await coordinator(),disk=preferenceGateway(),ui=preferenceReader(disk.owner,{coordinator:f.c});
    const content=Object.assign(new Content(),{configField:field,configIdentity:'current',engine:'system',httpEngines:[],
      language:'zh-CN',person:0,allowMixing:false,voiceOptions:ui.owner.ttsVoiceOptions,fullInput:()=>true,onlineServicePage:()=>false,
      onVoiceChange:ui.callback('onTtsVoiceChange'),onAllowMixingChange:ui.callback('onTtsAllowMixingChange')});
    let release,entered;
    if(field==='voice'){const hold=holdSpeech(f);release=hold.release;entered=hold.entered;}
    else {const hold=deferred(),start=deferred(),original=f.host.activateAudioSession.bind(f.host);let first=true;
      f.host.activateAudioSession=async value=>{if(first){first=false;start.resolve();await hold.promise;}return original(value);};
      release=hold.resolve;entered=start.promise;}
    await content.commitConfiguration(field==='voice'?'voice:en-US:7':'mix','current');await entered;
    await content.commitConfiguration(field==='voice'?'voice:zh-CN:0':'exclusive','current');
    release();await f.c.whenSettled();await settle();
    assert.equal(field==='voice'?disk.saved().language:disk.saved().allowMixing,field==='voice'?'zh-CN':false,
      'last valid choice must supersede the pending different native choice even when it equals the still-displayed value');
    assert.equal(field==='voice'?f.c.active.input.language:f.c.active.input.allowMixing,field==='voice'?'zh-CN':false);
  }
}

async function preferenceRecoveryInterleavings(){
  {
    const disk=preferenceGateway(base);disk.failFlush('after');await assert.rejects(disk.owner.update(base));
    const barrier=deferred();let calls=0;disk.setBarrier(()=>++calls===1?barrier.promise:Promise.resolve());
    const retry=disk.owner.retryAccepted(()=>true),rejection=assert.rejects(retry,/SUPERSEDED/);
    await settle();await disk.owner.patch({backgroundPlayback:true});const before=disk.puts().length;
    barrier.resolve();await rejection;assert.equal(disk.puts().length,before,'internal accepted revision rejects old retry even with outer admission true');
    assert.equal(disk.saved().backgroundPlayback,true);
  }
  for(const superseded of [false,true]){
    const disk=preferenceGateway(),original=deferred(),newChoice=deferred();await disk.owner.update(state.createDefaultReaderTtsPreferencesSnapshot());
    disk.hangFlush(original);disk.failFlush('after');const old=disk.owner.update(base),oldFailure=assert.rejects(old,/lost ACK/);
    await settle();const ui=preferenceReader(disk.owner);
    await ui.owner.loadTtsPresentationMetadata({getTtsHost:()=>({listSystemVoices:async()=>ui.owner.ttsVoiceOptions})},ui.coordinator,1);
    assert.equal(disk.puts().length,2,'metadata recovery waits in the actual file lane behind original flush');
    if(superseded){disk.setBarrier(()=>newChoice.promise);ui.owner.changeTtsBackgroundPlayback(true);
      ui.owner.setReaderPreferenceNotice('tts','后续设置保存状态',false);}
    original.resolve();await oldFailure;await settle();
    if(superseded){
      assert.equal(disk.puts().length,2,'new accepted revision retires old automatic retry before its first put');
      assert.equal(ui.owner.ttsPreferencesRecovery.message,'后续设置保存状态','old retry cannot clear or replace successor notice');
      newChoice.resolve();await settle();assert.equal(disk.puts().length,3);assert.equal(disk.saved().backgroundPlayback,true);
    }else{
      assert.equal(disk.puts().length,3,'normal metadata recovery dispatches one finite same-original retry');
      assert.deepEqual(disk.saved(),base);assert.equal(ui.owner.ttsPreferencesRecovery.visible,false);
    }
  }
}
try{for(const id of cases){await ({'cold-field-merge':coldFieldMerge,'accepted-field-intents':acceptedFieldIntents,
  'late-metadata-consumers':lateMetadataConsumers,'speech-awake-owner':speechAwakeOwner,
  'pending-choice-producer':pendingChoiceProducer,'preference-recovery-interleavings':preferenceRecoveryInterleavings})[id]();recordContractCasePass(id);}}
finally{for(const release of releases)release();for(const c of owned)await c.dispose();}
