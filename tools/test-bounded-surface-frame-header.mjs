import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const frame=read('features/common/ReaderBoundedSurface.ets'),header=read('features/common/ReaderBoundedSurfaceHeader.ets');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
const evaluate=source=>stripTypeScriptTypes(source).replace(/^export /gm,'');
const {resolvePopupSpec,resolveSheetSpec}=new Function('TextAlign',`${evaluate(read('features/common/ReaderSurfaceSpecs.ets'))};return{resolvePopupSpec,resolveSheetSpec};`)({Start:'TextAlign.Start',Center:'TextAlign.Center'});
const modifierSource=frame.slice(frame.indexOf('export class ReaderBoundedFrameModifier'),frame.indexOf('@Component'));
const ReaderBoundedFrameModifier=new Function('readerAppColor','resolvePopupSpec','resolveSheetSpec',`${evaluate(modifierSource)};return ReaderBoundedFrameModifier;`)(readerAppColor,resolvePopupSpec,resolveSheetSpec);
for(const [specId,width,height,radius] of [['source-switch-window',300,385,20],['tts-config-manager','100%',574,22],['tts-config-picker',260,172,14]]){
  const properties=createArkUIPropertyRuntimeProbe(),calls=[];
  const f=createReaderBuilderProbe(frame,['specId','width','height','header','body','actions','emptySlot','build','frameModifier'],{...properties.sdk,ReaderBoundedFrameModifier},properties.hooks).owner;
  f.updateStateVars({specId,width,height});Object.assign(f,{header:()=>calls.push('header'),body:()=>calls.push('body'),actions:()=>calls.push('actions')});f.initialRender();
  assert.deepEqual(calls,['header','body','actions']);const shell=[...f.nodes.values()].find(n=>n.type==='Column');assert.equal(shell.width,width);assert.equal(shell.height,height);assert.equal(shell.borderRadius,radius);
  f.updateStateVars({specId,width,height:height-40});properties.flush();assert.equal(shell.height,height-40,'actual SDK property update keeps the same frame node');
}
for(const specId of ['source-switch-window','tts-config-manager','tts-config-picker']){
  const properties=createArkUIPropertyRuntimeProbe();let close=0;
  const h=createReaderBuilderProbe(header,['specId','title','width','enabled','accessory','onClose','emptySlot','build','headerRow','titleText','closeAction','sheetHeader','sheetSpec'],{...properties.sdk,resolveSheetSpec},properties.hooks).owner;
  h.updateStateVars({specId,title:'original',width:300,enabled:true});Object.assign(h,{accessory:()=>{},onClose:()=>close++});h.initialRender();
  const title=[...h.nodes.values()].find(n=>n.type==='Text'&&n.create==='original');const target=[...h.nodes.values()].find(n=>n.onClick);target.onClick();assert.equal(close,1);
  h.updateStateVars({specId,title:'replacement',width:280,enabled:false});properties.flush();assert.equal(title.create,'replacement');target.onClick();assert.equal(close,1,'retained shared close callback uses live admission');
  assert.equal(target.enabled,false);if(specId==='source-switch-window'){assert.equal(target.width,44);assert.equal(target.height,44);}else{assert.deepEqual(target.responseRegion,{x:-6,y:-6,width:28,height:28});}
}
{
  const properties=createArkUIPropertyRuntimeProbe();
  const f=createReaderBuilderProbe(frame,['specId','width','height','header','body','actions','emptySlot','build','frameModifier'],{...properties.sdk,ReaderBoundedFrameModifier},properties.hooks).owner;
  f.updateStateVars({specId:'bookshelf-book-action',width:99,height:99});Object.assign(f,{header:()=>{},body:()=>{},actions:()=>{}});f.initialRender();
  const shell=[...f.nodes.values()].find(n=>n.type==='Stack');assert.equal(shell.width,'100%');assert.equal(shell.height,270);assert.deepEqual(shell.borderRadius,{topLeft:24,topRight:24,bottomLeft:0,bottomRight:0});
  const h=createReaderBuilderProbe(header,['specId','title','width','enabled','accessory','onClose','emptySlot','build','headerRow','titleText','closeAction','sheetHeader','sheetSpec'],{...properties.sdk,resolveSheetSpec},properties.hooks).owner;
  h.updateStateVars({specId:'bookshelf-book-action',title:'书籍操作',width:99,enabled:true});Object.assign(h,{accessory:()=>{}});h.initialRender();
  const title=[...h.nodes.values()].find(n=>n.type==='Text');assert.equal(title.width,undefined,'sheet title remains AUTO');assert.deepEqual(title.position,{x:14,y:34});assert.equal([...h.nodes.values()].some(n=>n.onClick),false,'sheet header owns no close');
}
assert.match(source,/ReaderBoundedSurface\(\{[^]*header: this\.header, body: this\.windowBody, actions: this\.footer/);
assert.match(tts,/ReaderBoundedSurface\(\{[^]*header: this\.boundedHeader, body: this\.boundedContent, actions: this\.boundedActions/);
assert.match(source,/ReaderBoundedSurfaceHeader/);assert.match(tts,/ReaderBoundedSurfaceHeader/);
assert.doesNotMatch(source,/\.backgroundColor\(readerAppColor\(this\.surfaceSpec\(\)\.surfaceBackgroundRole/);
assert.doesNotMatch(tts,/\.borderRadius\(this\.manager \? this\.managerSurfaceSpec/);
console.log('bounded Frame/Header PASS: three finite baseline frames, actual SDK props/slots/update/close admission and both real consumer migrations');
