import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk,boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import {sourceSwitchLiveSdk} from './lib/source-switch-sdk-consumer.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
function sourceOwner(input=source,options={}){
  const p=boundedSurfaceSdk(options),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
  const o=p.consumer(input,boundedMembers(input,'SourceSwitchWindow'),deps,{state:{kind:'discoveryError',message:'source unavailable'}},'SourceSwitchWindow');
  o.__Repeat=deps.SourceSwitchPanel.prototype.__Repeat;o.aboutToAppear();return{p,o};
}
function ttsOwner(input=tts,options={},params={}){
  const p=boundedSurfaceSdk(options),keyboard=[];
  const o=p.consumer(input,boundedMembers(input),{KeyboardAvoidMode:{RESIZE:1},InputType:{Password:'InputType.Password'},
    readerOnlineTtsProfile:()=>({voice:'',format:'mp3'}),uiContext:{getKeyboardAvoidMode:()=>0,setKeyboardAvoidMode:x=>keyboard.push(x)}},
    {manager:true,windowModal:true,title:'在线 TTS',selectionId:'make:1',availableWidth:338,availableHeight:666,...params});
  o.aboutToAppear();return{p,o,keyboard};
}
const currentProps=(owner,source)=>Object.fromEntries([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(m=>[m[1],owner[m[1]]]));
{
  const {p,o}=sourceOwner();let retry=0,closed=0;o.onRetry=()=>retry++;o.onClose=()=>closed++;o.initialRender();
  assert.equal(p.walk(o).filter(x=>x instanceof p.deps.ReaderBoundedSurface).length,0,'approved source live picker has no old bounded popup');
  const root=[...o.nodes.values()].find(n=>n.type==='Stack'&&n.width==='100%'&&n.height==='100%');assert.ok(root);
  const texts=p.nodes(o).filter(n=>n.type==='Text');assert.ok(texts.some(n=>n.create==='更换书源'));
  const message=texts.find(n=>n.create==='source unavailable'),button=p.nodes(o).find(n=>n.type==='Button'&&n.createWithLabel?.[0]==='重试');assert.ok(message&&button);button.onClick();assert.equal(retry,1);
  const close=p.nodes(o).find(n=>n.type==='Button'&&n.width===44&&n.height===44&&n.accessibilityText==='返回'&&n.onClick);assert.ok(close);close.onClick();assert.equal(closed,1);
  o.updateStateVars({state:{kind:'discoveryError',message:'new message'},currentSourceId:''});p.properties.flush();assert.equal(message.create,'new message');
  metrics.windowRect=new metricsApi.ReaderRectVp(0,0,270,320);o.readerWindowMetricsRevision++;p.properties.flush();
  assert.equal([...o.nodes.values()].find(n=>n.type==='Stack'&&n.width==='100%'&&n.height==='100%').id,root.id,'viewport/props keep the same actual source root actor');
  metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
}
{
  const {p,o,keyboard}=ttsOwner();const closed=[],puts=[];let finish;
  o.onClose=id=>closed.push(id);o.onPut=config=>{puts.push(config);return new Promise(resolve=>finish=resolve);};
  o.draftName='draft';o.draftUrl='https://example.test/tts';o.draftApiKey='private draft';o.initialRender();
  const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface),footer=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceActions);
  const save=[...footer.nodes.values()].find(n=>n.create==='保存'),cancel=[...footer.nodes.values()].find(n=>n.create==='取消');assert.equal(save.enabled,true);
  const initialCount=footer.nodes.size;save.onClick();p.properties.flush();assert.equal(puts.length,1);assert.equal(save.enabled,false);assert.equal(cancel.enabled,false);save.onClick();cancel.onClick();assert.equal(puts.length,1);assert.deepEqual(closed,[]);
  assert.equal(o.draftApiKey,'private draft');assert.equal(footer.nodes.size,initialCount);
  o.updateStateVars({...currentProps(o,tts),selectionId:'make:2',title:'下一轮 TTS'});p.properties.flush();finish();for(let n=0;n<8;n++)await Promise.resolve();p.properties.flush();
  assert.deepEqual(closed,[],'late accepted write completion cannot close replacement opening');assert.equal(o.draftName,'draft');
  const header=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceHeader);assert.ok([...header.nodes.values()].some(n=>n.create==='下一轮 TTS'));
  const frameNode=[...frame.nodes.values()].find(n=>n.type==='Column');const oldId=frameNode.id;o.modalUsableHeight=400;p.properties.flush();assert.equal(frameNode.height,368);assert.equal(frameNode.id,oldId);
  const scroll=[...o.nodes.values()].find(n=>n.type==='Scroll');assert.equal(scroll.height,234);assert.equal(footer.nodes.size,initialCount);
  o.aboutToDisappear();assert.deepEqual(keyboard,[1,0]);const reopened=ttsOwner();reopened.o.initialRender();assert.equal(reopened.o.busy,false);
}
{
  const {p,o}=ttsOwner(tts,{},{});o.modalUsableHeight=120;o.initialRender();
  assert.equal(o.compactManager(),true);assert.equal(p.walk(o).filter(x=>x instanceof p.deps.ReaderBoundedSurfaceActions).length,1);
  const scroll=[...o.nodes.values()].find(n=>n.type==='Scroll');assert.equal(scroll.height,o.panelHeight());
}
// The real SDK-generated chain rejects direct method references (the original
// first slice defect), proving this test exercises actual owner binding.
assert.throws(()=>ttsOwner(tts.replace('body: (): void => { this.boundedContent(); }','body: this.boundedContent')).o.initialRender(),/compactManager|boundedContent/);
// Same implementation propagation and named-family isolation on actual callers.
const frameSource=read('features/common/ReaderBoundedSurface.ets');
const changed=frameSource.replace(".borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)",".borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius + 1)");assert.notEqual(changed,frameSource);
const changedTts=ttsOwner(tts,{ReaderBoundedSurface:changed});changedTts.o.initialRender();const changedFrame=changedTts.p.walk(changedTts.o).find(x=>x instanceof changedTts.p.deps.ReaderBoundedSurface);assert.equal([...changedFrame.nodes.values()].find(n=>n.type==='Column').borderRadius,23);
const independentSource=sourceOwner(source,{ReaderBoundedSurface:changed});independentSource.o.initialRender();assert.equal(independentSource.p.walk(independentSource.o).some(x=>x instanceof independentSource.p.deps.ReaderBoundedSurface),false,'retained bounded-spec changes do not alter approved source viewport');
const picker=ttsOwner(tts,{ReaderBoundedSurface:changed},{manager:false,windowModal:false,title:'语音',choices:[]});picker.o.initialRender();const pickerFrame=picker.p.walk(picker.o).find(x=>x instanceof picker.p.deps.ReaderBoundedSurface);assert.equal([...pickerFrame.nodes.values()].find(n=>n.type==='Column').borderRadius,14);
console.log('Source/TTS composition PASS: approved source fullviewport and retained TTS SDK shared Frame/Header/body/actions, lexical slot ownership and negative controls, Prop updates/height, draft/busy/late ACK/close/reopen/keyboard restoration, propagation/variant isolation; native scheduling/focus/layout remains OPEN');
