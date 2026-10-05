import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk,boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
const candidate=read('features/source/CandidateRow.ets');
function sourceOwner(input=source,options={}){
  const p=boundedSurfaceSdk(options);p.hooks.childSources.CandidateRow=candidate;
  const o=p.consumer(input,boundedMembers(input),{...horizontal,...metricsApi,
    ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts(){},sourceSwitchSourceCount:c=>c.length,
    sourceSwitchCandidateKey:(a,b)=>`${a}:${b}`},{state:{kind:'discoveryError',message:'source unavailable'}});
  return{p,o};
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
  const frames=p.walk(o).filter(x=>x instanceof p.deps.ReaderBoundedSurface);assert.equal(frames.length,1);
  const texts=p.nodes(o).filter(n=>n.type==='Text');assert.ok(texts.some(n=>n.create==='换源'));assert.ok(texts.some(n=>n.create==='按延迟排序'));
  const message=texts.find(n=>n.create==='source unavailable'),button=texts.find(n=>n.create==='重试');assert.ok(message&&button);button.onClick();assert.equal(retry,1);
  const header=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurfaceHeader);[...header.nodes.values()].find(n=>n.onClick).onClick();assert.equal(closed,1);
  const before=frames[0];o.updateStateVars({state:{kind:'discoveryError',message:'new message'},currentSourceId:''});p.properties.flush();assert.equal(message.create,'new message');assert.ok(p.walk(o).includes(before));
  metrics.windowRect=new metricsApi.ReaderRectVp(0,0,270,320);o.readerWindowMetricsRevision++;p.properties.flush();
  const frameNode=[...before.nodes.values()].find(n=>n.type==='Column');assert.equal(frameNode.width,270);assert.equal(frameNode.height,320);
  const divider=[...header.nodes.values()].find(n=>n.type==='Text'&&n.create==='');assert.equal(divider.width,269);
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
assert.throws(()=>sourceOwner(source.replace('header: (): void => { this.header(); }','header: this.header')).o.initialRender(),/windowWidth|header/);
assert.throws(()=>ttsOwner(tts.replace('body: (): void => { this.boundedContent(); }','body: this.boundedContent')).o.initialRender(),/compactManager|boundedContent/);
// Same implementation propagation and named-family isolation on actual callers.
const frameSource=read('features/common/ReaderBoundedSurface.ets');
const changed=frameSource.replace(".borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius)",".borderRadius(this.id === 'tts-config-picker' ? 14 : spec.borderRadius + 1)");assert.notEqual(changed,frameSource);
for(const open of [sourceOwner,ttsOwner]){const {p,o}=open(open===sourceOwner?source:tts,{ReaderBoundedSurface:changed});o.initialRender();const frame=p.walk(o).find(x=>x instanceof p.deps.ReaderBoundedSurface);const shell=[...frame.nodes.values()].find(n=>n.type==='Column');assert.equal(shell.borderRadius,open===sourceOwner?21:23);}
const picker=ttsOwner(tts,{ReaderBoundedSurface:changed},{manager:false,windowModal:false,title:'语音',choices:[]});picker.o.initialRender();const pickerFrame=picker.p.walk(picker.o).find(x=>x instanceof picker.p.deps.ReaderBoundedSurface);assert.equal([...pickerFrame.nodes.values()].find(n=>n.type==='Column').borderRadius,14);
console.log('bounded Source/TTS composition PASS: real owners→SDK shared Frame/Header/body/actions, lexical slot ownership and negative controls, Prop updates/height, draft/busy/late ACK/close/reopen/keyboard restoration, propagation/variant isolation; native scheduling/focus/layout remains OPEN');
