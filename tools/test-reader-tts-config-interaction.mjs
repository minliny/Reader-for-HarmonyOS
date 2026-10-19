import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { readFileSync }=await import("node:fs");
const { productionMotionMethods }=await import("./lib/reader-motion-method-probe.mjs");
const { createReaderBuilderProbe }=await import("./lib/reader-control-builder-probe.mjs");
const { ReaderTtsAudioSessionLease }=await import("../entry/src/main/ets/app/ReaderTtsAudioSessionLease.ts");
const choices=await import("../entry/src/main/ets/features/reading/ReaderTtsConfigOptions.ts");
const state=await import("../entry/src/main/ets/features/reading/ReaderTtsState.ts");
const { readerControlUnit }=await import("../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts");
const file = name => new URL(`../entry/src/main/ets/features/${name}`, import.meta.url);
const ttsFile = file('reading/ReaderControlTtsContent.ets');
const SliderChangeMode = { Begin: 0, Moving: 1, End: 2, Click: 3 };
const methods = ['p','fullInput','sharedInput','openConfiguration','dismissConfiguration','configurationChoices',
  'configurationSelectedId','configurationMessage','commitConfiguration','fieldLabel','fieldValue','fieldWidth',
  'hasActiveQueue','isHttpEngineSelected','onlineServicePage','onEngineChanged','onlineEngineId','onlineServiceDescription','isTtsServiceTabSelected','systemEngineDisplay','currentEngineLabel','currentVoiceLabel','selectTtsServiceType',
  'changeRateSlider','changeSeekSlider'];
const deps = { ...choices, ...state, readerControlUnit, SliderChangeMode };
const Content = productionMotionMethods(ttsFile, methods, deps);
function setup(owner = new Content()) {
  return Object.assign(owner, { motionProgress:1, interactionEnabled:true, configField:'', configIdentity:'', configGeneration:0,
    state:{status:'idle',rate:1}, onStop(){}, engine:'system', serviceTab:'', serviceBusy:false, serviceGeneration:0, serviceError:'', httpEngines:[], language:'zh-CN', person:0, allowMixing:false, failurePolicy:'stop',
    voiceOptions:[{language:'zh-CN',person:0,label:'中文女声'},{language:'zh-CN',person:1,label:'中文男声'},
      {language:'en-US',person:7,label:'English'}],
    frame:()=>({config:{width:316}}), onTemporaryLayerChange(){},
    async onEngineChange(id){ this.engine=id; }, onVoiceChange(language,person){ this.language=language; this.person=person; },
    onAllowMixingChange(enabled){ this.allowMixing=enabled; }, onFailurePolicyChange(policy){ this.failurePolicy=policy; },
  });
}

const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
if(id==='configuration'){
assert.equal(choices.readerTtsLanguageLabel('zh_CN'), '普通话');
assert.equal(choices.readerTtsLanguageLabel('en-US'), '英语（美国）');
assert.equal(choices.readerTtsConfigChoices('language', 'system', [],
  [{ language: 'zh_CN', person: 0, label: '中文' }])[0].id, 'zh_CN',
  'language labels must retain the actual installed voice identity');
const c=setup();
for(const [field,id,expected] of [['voice','voice:zh-CN:1','中文男声'],['language','en-US','English'],
  ['session','mix','混音播放'],['failure','skip','跳过不可用内容']]) {
  c.openConfiguration(field); const identity=c.configIdentity;
  await c.commitConfiguration(id,identity);
  assert.equal(c.configurationSelectedId(),id);
  assert.ok((field==='voice'||field==='language'?c.currentVoiceLabel():c.fieldValue(field)).includes(expected));
  c.dismissConfiguration(); c.openConfiguration(field);
  assert.equal(c.configurationSelectedId(),id,'reopening reads the actual callback-owned projection (persistence is a separate layer)');
  await c.commitConfiguration('system',identity);
  assert.equal(c.configurationSelectedId(),id,'old menu callback cannot target a new opening');
}
c.configField=''; c.selectTtsServiceType(true);
assert.equal(c.configField,'','Online selects a tab before a separate configuration entry');
assert.equal(c.onlineServicePage(),true); assert.equal(c.engine,'system','empty Online never fabricates a native engine');
c.openConfiguration('manage'); assert.equal(c.configField,'manage');
c.httpEngines=[{id:12,name:'测试服务'}]; c.openConfiguration('engine');
await c.commitConfiguration('http-tts:12',c.configIdentity);
assert.equal(c.engine,'http-tts:12');
c.openConfiguration('voice'); assert.deepEqual(c.configurationChoices(),[]);
assert.equal(c.currentVoiceLabel(),'由在线服务提供'); assert.ok(c.configurationMessage().includes('在线服务'));
c.engine='system'; c.serviceTab='system'; c.voiceOptions=[]; c.openConfiguration('voice');
assert.ok(c.configurationMessage().includes('没有可用'));
c.motionProgress=.5; c.configField=''; c.openConfiguration('engine'); assert.equal(c.configField,'');
}
if(id==='fields'){
const probe=createReaderBuilderProbe(readFileSync(ttsFile,'utf8'), [...methods,'ttsSelectValueField'],deps);
setup(probe.owner);
for(const field of ['voice','engine','language','session','failure']) probe.owner.ttsSelectValueField(field);
const triggers=[...probe.owner.nodes.values()].filter(n=>n.onClick);
assert.equal(triggers.length,5);
for(const [index,field] of ['voice','engine','language','session','failure'].entries()) {
  triggers[index].onClick(); assert.equal(probe.owner.configField,field);
}
probe.owner.motionProgress=.4; probe.owner.configField=''; probe.owner.replay();
for(const trigger of triggers) { assert.equal(trigger.enabled,false); trigger.onClick(); }
assert.equal(probe.owner.configField,'');
}
if(id==='sliders'){
const slider=setup(), rateCalls=[], seekCalls=[];
slider.onRateChange=v=>rateCalls.push(v); slider.onSeek=v=>seekCalls.push(v);
for(const mode of [0,3,2]) { slider.changeRateSlider(1.4,mode); slider.changeSeekSlider(1,mode); }
assert.deepEqual(rateCalls,[1.4]); assert.deepEqual(seekCalls,[1]);
for(const mode of [0,1,2]) slider.changeRateSlider(1.6,mode);
assert.deepEqual(rateCalls,[1.4,1.6]);
slider.interactionEnabled=false; slider.changeRateSlider(2,3); assert.equal(rateCalls.length,2);
}
if(id==='service-tabs'){
const tabs=setup();
tabs.selectTtsServiceType(true);
assert.equal(tabs.isTtsServiceTabSelected(true),true); assert.equal(tabs.configField,'');
tabs.httpEngines=[{id:31,name:'Stored service'}];
let finishSwitch; const engineChanges=[];
tabs.onEngineChange=id=>{engineChanges.push(id);return new Promise(resolve=>finishSwitch=()=>{tabs.engine=id;resolve();});};
tabs.selectTtsServiceType(true); assert.equal(tabs.serviceBusy,true);
tabs.selectTtsServiceType(false); assert.deepEqual(engineChanges,['http-tts:31'],'busy tab cannot start a second engine transaction');
assert.equal(tabs.configField,''); finishSwitch(); await tick();
assert.equal(tabs.serviceBusy,false); assert.equal(tabs.engine,'http-tts:31');
tabs.onEngineChange=async()=>{throw new Error('Switch failed');};
tabs.selectTtsServiceType(false); await tick();
assert.equal(tabs.onlineServicePage(),true); assert.equal(tabs.serviceError,'Switch failed');
tabs.onEngineChange=async id=>{tabs.engine=id;}; tabs.selectTtsServiceType(false); await tick();
assert.equal(tabs.onlineServicePage(),false); assert.equal(tabs.engine,'system'); assert.equal(tabs.configField,'');
}
if(id==='manager-drafts'){
const KeyboardAvoidMode={OFFSET:0,RESIZE:1,NONE:4};
const Manager=productionMotionMethods(file('reading/ReaderTtsConfigOverlay.ets'),
  ['stopPreview','aboutToAppear','aboutToDisappear','current','setBusy','beginEdit','canSubmit','submit','selectEngine','deleteEngine','clearDraft','resetDraft'],{KeyboardAvoidMode});
const manager=Object.assign(new Manager(),{mounted:false,generation:0,previewGeneration:0,onPreviewStop(){},busy:false,draftId:-1,draftName:'服务',draftUrl:'https://example.invalid/?text={{text}}',
  draftApiKey:'',draftVoice:'',draftFormat:'mp3',draftClearApiKey:false,
  errorText:'',onBusyChange(){},onClose(){}}); manager.aboutToAppear();
let resolveSave; manager.onPut=()=>new Promise(resolve=>resolveSave=resolve);
manager.submit(); assert.equal(manager.busy,true);
manager.beginEdit({id:2,name:'其他',url:'else'}); manager.clearDraft();
assert.equal(manager.draftName,'服务'); resolveSave(); await tick();
assert.equal(manager.busy,false); assert.equal(manager.draftName,'');
manager.draftName='失败草稿'; manager.draftUrl='https://example.invalid';
manager.onPut=async()=>{throw new Error('保存失败');}; manager.submit(); await tick();
assert.equal(manager.draftName,'失败草稿'); assert.equal(manager.errorText,'保存失败');
manager.onPut=()=>new Promise(resolve=>resolveSave=resolve); manager.submit(); manager.aboutToDisappear();
resolveSave(); await tick(); assert.equal(manager.draftName,'失败草稿','late result cannot clear an unmounted form');
}
if(id==='keyboard'){
const KeyboardAvoidMode={OFFSET:0,RESIZE:1,NONE:4};
const Manager=productionMotionMethods(file('reading/ReaderTtsConfigOverlay.ets'),
  ['stopPreview','aboutToAppear','aboutToDisappear','current','setBusy','beginEdit','canSubmit','submit','selectEngine','deleteEngine','clearDraft','resetDraft'],{KeyboardAvoidMode});
const keyboardWrites=[];
const modal=Object.assign(new Manager(),{windowModal:true,manager:false,generation:0,previewGeneration:0,onPreviewStop(){},onBusyChange(){},
  getUIContext:()=>({getKeyboardAvoidMode:()=>KeyboardAvoidMode.NONE,
    setKeyboardAvoidMode:mode=>keyboardWrites.push(mode)})});
modal.aboutToAppear(); modal.aboutToDisappear(); modal.aboutToDisappear();
assert.deepEqual(keyboardWrites,[KeyboardAvoidMode.RESIZE,KeyboardAvoidMode.NONE]);
const menu=Object.assign(new Manager(),{windowModal:false,manager:false,generation:0,previewGeneration:0,onPreviewStop(){},onBusyChange(){},
  getUIContext:()=>{throw new Error('an anchored choice menu must not change keyboard policy');}});
menu.aboutToAppear(); menu.aboutToDisappear();
}
if(id==='overlay'){
const Overlay=productionMotionMethods(file('reading/ReaderTtsConfigOverlay.ets'),
  ['stopPreview','choose','aboutToDisappear','onIdentityChanged']);
let complete, closed=[];
const busyChanges=[];
const overlay=Object.assign(new Overlay(),{mounted:true,generation:0,previewGeneration:0,onPreviewStop(){},busy:false,selectionId:'engine:1',choices:[{id:'system',label:'系统'}],
  onChoose:()=>new Promise(resolve=>complete=resolve),onBusyChange:busy=>busyChanges.push(busy),onClose:id=>closed.push(id)});
overlay.choose('system'); overlay.choose('system'); overlay.selectionId='voice:2'; overlay.onIdentityChanged();
assert.deepEqual(busyChanges,[false],'replaced selection releases the parent content-cover gate');
complete(); await tick(); assert.deepEqual(closed,[],'old completion cannot close a newer menu');
overlay.onChoose=async()=>{throw new Error('切换失败');}; overlay.choose('system'); await tick();
assert.equal(overlay.errorText,'切换失败'); assert.equal(overlay.busy,false);
assert.deepEqual(busyChanges,[false],'choice transaction does not own the manager content-cover callback');
}
if(id==='audio-adapter'){
for(const name of ['HarmonySystemTtsHost','HarmonyHttpTtsHost']) {
  const Host=productionMotionMethods(new URL(`../entry/src/main/ets/app/${name}.ts`,import.meta.url),['activateAudioSession']);
  const calls=[];
  const lease=new ReaderTtsAudioSessionLease({async activate(mix){calls.push(mix);},async deactivate(){}});
  const host=Object.assign(new Host(),{assertOpen(){},installAudioListeners(){},audioSessionLease:lease,
    audioSessionOwner:lease.createOwner(name)});
  await host.activateAudioSession(false); await host.activateAudioSession(false); await host.activateAudioSession(true);
  assert.deepEqual(calls,[false,true]);
}
}
}
const definitions={"configuration": "configuration actual selected production methods; callback ports do not prove Preferences/device", "fields": "fields actual selected production methods; callback ports do not prove Preferences/device", "sliders": "sliders actual selected production methods; callback ports do not prove Preferences/device", "service-tabs": "service-tabs actual selected production methods; callback ports do not prove Preferences/device", "manager-drafts": "manager-drafts actual selected production methods; callback ports do not prove Preferences/device", "keyboard": "keyboard actual selected production methods; callback ports do not prove Preferences/device", "overlay": "overlay actual selected production methods; callback ports do not prove Preferences/device", "audio-adapter": "audio-adapter actual selected production methods; callback ports do not prove Preferences/device"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
