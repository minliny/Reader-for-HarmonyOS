import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function frameMapping() {
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const read=name=>readFileSync(new URL('../entry/src/main/ets/'+name,import.meta.url),'utf8');
 const overlay=read('features/reading/ReaderTtsConfigOverlay.ets'),frame=read('features/common/ReaderBoundedSurface.ets');
 for(const mutated of [false,true]) {
  const sdk=boundedSurfaceSdk(),canonical=sdk.deps.resolvePopupSpec('tts-config-manager');
  const spec=mutated?{...canonical,width:canonical.width+9,borderWidth:canonical.borderWidth+.25,borderRadius:canonical.borderRadius+3,shadowRadius:canonical.shadowRadius+5,shadowOffsetY:canonical.shadowOffsetY+2}:canonical;
  const resolvePopupSpec=id=>{assert.equal(id,'tts-config-manager');return spec;};
  const definition=frame.slice(frame.indexOf('export class ReaderBoundedFrameModifier'),frame.indexOf('@Component')).replace('export class ','class ');
  sdk.deps.ReaderBoundedFrameModifier=new Function('resolvePopupSpec','resolveSheetSpec','resolveDialogSpec','resolveDrawerSpec','readerAppColor','ReaderInsetsVp',stripTypeScriptTypes(definition)+';return ReaderBoundedFrameModifier;')(resolvePopupSpec,sdk.deps.resolveSheetSpec,sdk.deps.resolveDialogSpec,sdk.deps.resolveDrawerSpec,readerAppColor,sdk.deps.ReaderInsetsVp);
  sdk.deps.ReaderBoundedSurface=createReaderBuilderProbe(frame,boundedMembers(frame),sdk.deps,sdk.hooks).Component;
  const owner=sdk.consumer(overlay,['build','panelWidth','managerSurfaceSpec','managerOuterPadding','panelHeight','panelY','boundedSpecId'],{resolvePopupSpec});
  Object.assign(owner,{manager:true,voicePicker:false,windowModal:true,availableWidth:390,availableHeight:844,modalUsableHeight:700,appThemeScheme:'day',choices:[],message:'',errorText:'',boundedHeader(){},boundedContent(){},boundedActions(){}});owner.initialRender();
  assert.equal(owner.panelWidth(),spec.width,'actual overlay width consumes the current resolver');
  const child=sdk.walk(owner).find(x=>x instanceof sdk.deps.ReaderBoundedSurface);assert.ok(child);
  const node=sdk.nodes(child).find(n=>n.type==='Column'&&n.borderRadius!==undefined);assert.ok(node,'actual shared frame modifier mounted');
  assert.equal(node.borderRadius,spec.borderRadius);assert.equal(node.border.width,spec.borderWidth);assert.equal(node.constraintSize.maxWidth,spec.width);assert.equal(node.shadow.radius,spec.shadowRadius);assert.equal(node.shadow.offsetY,spec.shadowOffsetY);assert.equal(node.backgroundColor,readerAppColor(spec.surfaceBackgroundRole,'day'));
 }
}
for(const id of selectContractCases({'frame-mapping':'Actual Overlay→BoundedSurface spec/modifier propagation with changed resolver values; no unproven fixed design tuple'})){await frameMapping();recordContractCasePass(id);}
