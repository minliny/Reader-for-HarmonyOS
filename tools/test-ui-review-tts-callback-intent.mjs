import assert from 'node:assert/strict';
import {writeFileSync,rmSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
  'callback-intents':'Actual coordinator: held Core done/failed/rejected ACKs preserve heard facts and latest seek/previous/next/pause/rate/voice against strict Core state ports.',
  'background-preference':'Actual LRE normal Panel callback updates Coordinator and Host; next slice retains latest background preference in both directions.',
  'advance-intents':'Actual coordinator: progress/loader/plan/play/rate awaits retain initiating control; normal handoff and voice while no slice remain coherent.',
};
const selected=selectContractCases(definitions);if(!selected.length)process.exit(0);
const sourceFile=new URL('../entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts',import.meta.url);
const {ReaderTtsSessionCoordinator}=await import(sourceFile.href);
const {chapter,canonicalRemoteContent,plan,FakeGateway,FakeHost}=await import('./lib/reader-tts-fixtures.mjs');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const gate=()=>({entered:defer(),blocked:defer()});
const owned=[],pending=[];
async function wait(g){await Promise.race([g.entered.promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('finite port not entered')),3000);timer.unref();})]);}
class StrictGateway extends FakeGateway{
  currentChapter=chapter;
  reportHold;reportMode;portHold;portName;
  async port(name){if(this.portName!==name)return;const g=this.portHold;this.portName=undefined;g.entered.resolve();await g.blocked.promise;}
  block(name){const g=gate();this.portName=name;this.portHold=g;pending.push(g);return g;}
  holdReport(mode){const g=gate();this.reportHold=g;this.reportMode=mode;pending.push(g);return g;}
  snapshot(state,policy='stop',limit=3){return{...super.snapshot(state,policy,limit),chapter:this.currentChapter,currentSliceIndex:state==='completed'?1:this.cursor};}
  async slice(ref){this.calls.push('slice');await this.port(ref.chapterIndex===0?'slice':'slice-next');return{...plan,chapter:ref};}
  async play(p,index){assert.ok(!['playing','paused'].includes(this.queueState),'real Core play rejects an active queue');this.currentChapter=p.chapter;this.callbacks.clear();const result=await super.play(p,index);await this.port(p.chapter.chapterIndex===0?'play':'play-next');return result;}
  async pause(){assert.equal(this.queueState,'playing','real Core pause requires Playing');return super.pause();}
  async resume(){assert.equal(this.queueState,'paused','real Core resume requires Paused');return super.resume();}
  async seek(ref,index){assert.ok(['playing','paused'].includes(this.queueState),'real Core seek rejects terminal queues');assert.ok(index>=0&&index<2);assert.deepEqual(ref,this.currentChapter);return super.seek(ref,index);}
  async previous(ref){assert.ok(['playing','paused'].includes(this.queueState));assert.ok(this.cursor>0);return this.seek(ref,this.cursor-1);}
  async skip(){assert.ok(['playing','paused'].includes(this.queueState),'real Core skip rejects terminal queues');this.calls.push('skip');if(this.cursor===1)this.queueState='completed';else this.cursor++;const result=this.snapshot(this.queueState);await this.port('skip');return result;}
  async setRate(ref,rate){assert.notEqual(this.queueState,'idle');assert.deepEqual(ref,this.currentChapter);const result=await super.setRate(ref,rate);await this.port(ref.chapterIndex===0?'rate':'rate-next');return result;}
  async chapterPlan(current,next,drainBehavior){await this.port('chapter-plan');return{current,next,drainBehavior};}
  async reportCallback(ref,index,status,id,policy,limit){
    if(status==='speaking')return super.reportCallback(ref,index,status,id,policy,limit);
    const hold=this.reportHold,mode=this.reportMode;this.reportHold=undefined;
    this.calls.push(`callback:${index}:${status}:${id}`);
    let result;
    if(this.callbacks.has(id))result={snapshot:this.snapshot(this.queueState),callbackDisposition:'duplicate'};
    else if(this.queueState!=='playing'||this.cursor!==index)result={snapshot:this.snapshot(this.queueState),callbackDisposition:'stale'};
    else{
      this.callbacks.add(id);
      if(mode!=='reject'){
        this.queueState=status==='failed'&&policy==='stop'?'stopped':index===1?'completed':'playing';
        if(this.queueState==='playing')this.cursor=index+1;
      }
      result={snapshot:this.snapshot(this.queueState,policy,limit),callbackDisposition:'applied',...(status==='failed'?{failureAction:policy}:{})};
    }
    if(hold){hold.entered.resolve();await hold.blocked.promise;}
    if(mode==='reject')throw Error('controlled original callback rejection');
    return result;
  }
}
async function fixture(Type=ReaderTtsSessionCoordinator,{index=1,policy='stop',commit=async()=>{},loader,started=true,backgroundPlayback=true}={}){
  const g=new StrictGateway(),h=new FakeHost(),progress=[],admissions=[],background=[];
  h.setBackgroundPlaybackEnabled=value=>background.push(value);
  const c=new Type(g,h,async update=>{progress.push(update);await commit(update);},undefined,loader??(async current=>{
    admissions.push(['loader',current.chapterIndex]);return{chapter:{...chapter,chapterIndex:current.chapterIndex+1},content:canonicalRemoteContent,
      contentVersion:100+current.chapterIndex,onAdmitted:()=>admissions.push(['admitted',current.chapterIndex+1])};
  }),{startCallbackTimeoutMs:started?15000:5});owned.push(c);
  await c.start({chapter,content:canonicalRemoteContent,contentVersion:1,scalarPosition:plan.slices[index].charStart,failurePolicy:policy,backgroundPlayback});
  const request=h.requests.at(-1).requestId;
  if(started){h.emit({type:'start',requestId:request});await c.whenSettled();assert.equal(c.getState().status,'playing');}
  return{c,g,h,request,progress,admissions,background};
}
function emit(f,kind='done'){f.h.emit(kind==='failed'?{type:'error',requestId:f.request,message:'controlled audible error'}:{type:'complete',requestId:f.request,completion:'audio'});}
async function settle(f){await f.c.whenSettled();await f.c.whenSettled();}
async function originalCompleteSeek(Type){
  const f=await fixture(Type),hold=f.g.holdReport('done');emit(f);await wait(hold);
  const command=f.c.seek(0);hold.blocked.resolve();await command;await settle(f);
  assert.equal(f.c.getState().chapterIndex,0,'old callback cannot take the new seek into another chapter');
  assert.equal(f.c.getState().sliceIndex,0);assert.equal(f.h.requests.at(-1).text,plan.slices[0].text);
  assert.deepEqual(f.progress.map(x=>[x.chapter.chapterIndex,x.charEnd]),[[0,13]],'the old real heard completion remains durable exactly once');
  assert.deepEqual(f.admissions,[],'the old callback cannot start the new position loader');
  const reports=f.g.calls.filter(x=>x.includes(':done:')).length;
  emit(f);await settle(f);assert.equal(f.g.calls.filter(x=>x.includes(':done:')).length,reports,'old correlation must not enter a replayed Core queue whose dedup IDs reset');
}
async function callbackIntents(){
  await originalCompleteSeek(ReaderTtsSessionCoordinator);
  for(const kind of ['done','failed','reject'])for(const policy of kind==='failed'?['skip','stop']:['stop']){
    for(const intent of ['seek','previous','next','pause','rate','voice']){
      const index=intent==='next'?0:1,f=await fixture(undefined,{index,policy});
      const hold=f.g.holdReport(kind);emit(f,kind==='failed'?'failed':'done');await wait(hold);
      const command=intent==='seek'?f.c.seek(0):intent==='rate'?f.c.setRate(1.4):intent==='voice'?f.c.setVoice('en-US',7):f.c[intent]();
      hold.blocked.resolve();await command;await settle(f);
      assert.equal(f.c.getState().chapterIndex,0,`${kind}/${intent} keeps its admitted chapter`);
      assert.notEqual(f.c.getState().status,'error',`${kind}/${intent} cannot terminate the new intent`);
      assert.deepEqual(f.admissions,[]);
      if(intent==='previous'||intent==='seek')assert.equal(f.c.getState().sliceIndex,0);
      if(intent==='next')assert.equal(f.c.getState().sliceIndex,1,'next uses the input cursor, not the cursor already advanced by the old ACK');
      if(intent==='pause')assert.equal(f.c.getState().status,'paused');
      if(intent==='rate'){assert.equal(f.c.getState().rate,1.4);assert.equal(f.h.requests.at(-1).rate,1.4);}
      if(intent==='voice'){assert.equal(f.h.requests.at(-1).language,'en-US');assert.equal(f.h.requests.at(-1).person,7);}
      assert.equal(f.progress.length,kind==='done'?1:0,'failure or rejected ACK cannot invent heard progress');
      if(intent!=='pause'){const latest=f.h.requests.at(-1).requestId;f.h.emit({type:'start',requestId:latest});await settle(f);assert.equal(f.c.getState().status,'playing','restored queue accepts the actual new audible start');}
    }
  }
  for(const policy of ['skip','stop']){
    const f=await fixture(undefined,{policy});emit(f,'failed');await settle(f);
    assert.equal(f.progress.length,0,'a normal failure is not heard progress');
    if(policy==='stop')assert.equal(f.c.getState().status,'error','current failure still stops');
    else assert.equal(f.c.getState().chapterIndex,1,'current failure skip still advances');
  }
  // The third advance caller must retire even if its prior invalidate already
  // cleared currentRequestId, so a later rate intent cannot share its ticket.
  {
    const f=await fixture(),hold=f.g.block('skip');const skipping=f.c.next();await wait(hold);
    const rate=f.c.setRate(1.4);hold.blocked.resolve();await skipping;await rate;await settle(f);
    assert.deepEqual(f.admissions,[]);assert.equal(f.c.getState().chapterIndex,0);assert.equal(f.c.getState().rate,1.4);
    assert.equal(f.h.requests.at(-1).rate,1.4);assert.equal(f.progress.length,0,'explicit skip is not heard progress');
  }
  // Actual watchdog report can stop Core even though its UI token retires.
  {
    const f=await fixture(undefined,{started:false}),hold=f.g.holdReport('failed');await wait(hold);
    const seek=f.c.seek(0);hold.blocked.resolve();await seek;await settle(f);
    assert.equal(f.c.getState().sliceIndex,0);assert.notEqual(f.c.getState().status,'error');
    assert.equal(f.g.queueState,'playing');assert.equal(f.progress.length,0);
  }
  // Two immediately queued pause/resume commands still perform the ordered
  // real Core Playing -> Paused -> Playing transition.
  {
    const f=await fixture();const pause=f.c.pause(),resume=f.c.resume();await pause;await resume;await settle(f);assert.equal(f.g.queueState,'playing');
  }
  // Restore only the R22 pre-repair source as an ordinary real class. The
  // unchanged behavior oracle must reproduce the swallowed seek, not merely
  // inspect a guard's spelling or invocation count.
  const {execFileSync}=await import('node:child_process');
  const prior=execFileSync('git',['show','e5c88a7e9c6b3220a561b60b885ef4679b0dc609:entry/src/main/ets/features/reading/application/ReaderTtsSessionCoordinator.ts'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  const temporary=new URL(`../entry/src/main/ets/features/reading/application/.reader-tts-r22-negative-${process.pid}.ts`,import.meta.url);
  try{writeFileSync(temporary,prior);const {ReaderTtsSessionCoordinator:Legacy}=await import(temporary.href);await assert.rejects(originalCompleteSeek(Legacy),/old callback cannot take the new seek/);}
  finally{rmSync(temporary,{force:true});}
}
async function backgroundPreference(){
  const {selectedProductionMethods,selectedProductionComponentCallback}=await import('./lib/selected-production-methods.mjs');
  const file=new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url);
  const {readFileSync,mkdtempSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
  async function verify(methodFile=file){
    for(const initial of [false,true]){
      const f=await fixture(undefined,{index:0,backgroundPlayback:initial}),writes=[];
      const {preferenceReader}=await import('./lib/reader-tts-preference-probe.mjs');
      const ui=preferenceReader({patch:async(patch,current)=>{assert.equal(current(),true);writes.push(patch);},
        writeFacts:()=>({pendingReconciliation:false})},{coordinator:f.c,nativeHost:f.h,file:methodFile});
      const owner=ui.owner;owner.ttsBackgroundPlayback=initial;
      const callback=selectedProductionComponentCallback(file,'ReaderControlPanel','onTtsBackgroundPlaybackChange',owner);
      callback(!initial);await settle(f);assert.equal(writes.length,1);assert.equal(writes[0].backgroundPlayback,!initial);
      emit(f);await settle(f);
      assert.equal(f.c.getState().sliceIndex,1);assert.equal(f.h.requests.length,2);
      assert.equal(f.background.at(-1),!initial,'next actual slice must retain the accepted current background preference');
      assert.equal(f.c.active.input.backgroundPlayback,!initial);
    }
  }
  await verify();
  for(const kind of ['voice','rate'])for(const fail of [false,true]){
    const f=await fixture(undefined,{backgroundPlayback:false}),hold=gate();pending.push(hold);
    const base=f.h.stop.bind(f.h);f.h.stop=async()=>{hold.entered.resolve();await hold.blocked.promise;if(fail)throw Error('controlled original control stop rejection');return base();};
    const result=(kind==='voice'?f.c.setVoice('en-US',7):f.c.setRate(1.4)).then(()=>true,error=>{assert.match(error.message,/controlled original control stop rejection/);return false;});
    await wait(hold);f.c.setBackgroundPlayback(true);f.c.setFailurePolicy('skip');f.c.setPauseOnInterruption(false);
    hold.blocked.resolve();assert.equal(await result,!fail);f.h.stop=base;await settle(f);
    assert.equal(f.c.active.input.backgroundPlayback,true,'old whole-input success/rollback cannot erase the latest background choice');
    assert.equal(f.c.active.input.failurePolicy,'skip');assert.equal(f.c.active.input.pauseOnInterruption,false);
    assert.equal(f.background.at(-1),true);
  }
  const original=readFileSync(file,'utf8'),prior=original.replace('    this.ttsCoordinator?.setBackgroundPlayback(enabled);',
    '    const host = this.ttsCoordinator === undefined ? undefined : ReaderRuntimeOwner.current().getTtsHost();\n    host?.setBackgroundPlaybackEnabled?.(enabled);');
  assert.notEqual(prior,original);const temporary=mkdtempSync(join(tmpdir(),'reader-tts-background-negative-'));
  try{const path=join(temporary,'LocalReadingExperience.ets');writeFileSync(path,prior);await assert.rejects(verify(pathToFileURL(path)),/next actual slice must retain/);}
  finally{rmSync(temporary,{recursive:true,force:true});}
}
async function advanceIntents(){
  for(const boundary of ['progress','loader','chapter-plan','slice-next','play-next','rate-next']){
    const hold=gate();pending.push(hold);let f;
    if(boundary==='progress')f=await fixture(undefined,{commit:async()=>{hold.entered.resolve();await hold.blocked.promise;}});
    else if(boundary==='loader')f=await fixture(undefined,{loader:async()=>{hold.entered.resolve();await hold.blocked.promise;return{chapter:{...chapter,chapterIndex:1},content:canonicalRemoteContent,contentVersion:2};}});
    else{f=await fixture();f.g.portName=boundary;f.g.portHold=hold;}
    emit(f);await wait(hold);const acceptedChapter=f.c.getState().chapterIndex;
    const seek=f.c.seek(0);hold.blocked.resolve();await seek;await settle(f);
    assert.equal(f.c.getState().chapterIndex,acceptedChapter,`${boundary}: later seek keeps its admitted chapter`);
    assert.equal(f.c.getState().sliceIndex,0);assert.equal(f.progress.length,1);
    const latest=f.h.requests.at(-1).requestId;f.h.emit({type:'start',requestId:latest});await settle(f);
    assert.equal(f.c.getState().status,'playing',`${boundary}: the new queue actually accepts start`);
  }
  for(const boundary of ['play-next','rate-next']){
    const f=await fixture(),hold=f.g.block(boundary);emit(f);await wait(hold);
    assert.equal(f.c.getState().chapterIndex,1);assert.equal(f.c.getState().sliceIndex,0,'new chapter already owns its own first-slice cursor');
    const next=f.c.next();hold.blocked.resolve();await next;await settle(f);
    assert.equal(f.c.getState().chapterIndex,1);assert.equal(f.c.getState().sliceIndex,1,'slow next-chapter ACK cannot reuse the old chapter last index');
    assert.equal(f.h.requests.at(-1).text,plan.slices[1].text);assert.equal(f.progress.length,1);
  }
  {
    const hold=gate();pending.push(hold);
    const f=await fixture(undefined,{loader:async()=>{hold.entered.resolve();await hold.blocked.promise;throw Error('retired loader failure');}});
    emit(f);await wait(hold);const seek=f.c.seek(0);hold.blocked.resolve();await seek;await settle(f);
    assert.notEqual(f.c.getState().status,'error','late loader catch cannot terminate the new position');
  }
  {
    const hold=gate();pending.push(hold);const f=await fixture();f.g.portName='slice-next';f.g.portHold=hold;
    emit(f);await wait(hold);assert.equal(f.c.getState().sliceIndex,undefined);
    const voice=f.c.setVoice('en-US',9);hold.blocked.resolve();await voice;await settle(f);
    assert.equal(f.c.getState().chapterIndex,1,'normal handoff still reaches next chapter');assert.equal(f.h.requests.at(-1).language,'en-US','voice intent during plan preparation affects the first admitted speech');
    assert.equal(f.c.active.input.chapter.chapterIndex,1,'queued voice cannot copy an old chapter back into the new plan');
    await f.c.seek(0);await settle(f);assert.equal(f.c.active.input.chapter.chapterIndex,1);assert.equal(f.g.currentChapter.chapterIndex,1);
    assert.equal(f.h.requests.at(-1).language,'en-US');assert.equal(f.progress.length,1);
  }
  for(const fail of [false,true]){
    const f=await fixture(),hold=f.g.block('slice-next');emit(f);await wait(hold);
    if(fail){const base=f.h.activateAudioSession.bind(f.h);f.h.activateAudioSession=async value=>{if(value)throw Error('controlled native mixing rejection');return base(value);};}
    const mixing=f.c.setAllowMixing(true);hold.blocked.resolve();
    if(fail)await assert.rejects(mixing,/controlled native mixing rejection/);else await mixing;
    await settle(f);assert.equal(f.c.active.input.chapter.chapterIndex,1,'mixing cannot restore a preceding chapter input');
    assert.equal(f.c.active.input.allowMixing===true,!fail,'current session mixing survives automatic chapter identity changes');
    if(!fail)assert.ok(f.h.calls.includes('activate:true'),'accepted mixing reaches the actual Host port');
  }
  {
    const f=await fixture();emit(f);await settle(f);
    assert.equal(f.c.getState().chapterIndex,1);assert.deepEqual(f.admissions,[['loader',0],['admitted',1]]);
    assert.equal(f.h.requests.length,2,'uninterrupted completion advances once');assert.equal(f.progress.length,1);
  }
}
try{
  for(const id of selected){await (id==='callback-intents'?callbackIntents:id==='background-preference'?backgroundPreference:advanceIntents)();console.log(JSON.stringify({kind:'tts-callback-intent',case:id,layer:'actual Coordinator with strict finite Core state/Host ports; no platform audio, durable database or native UI proof'}));recordContractCasePass(id);}
}finally{for(const g of pending)g.blocked.resolve();for(const c of owned)await c.dispose();}
