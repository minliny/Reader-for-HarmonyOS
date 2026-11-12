import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerAppColor } from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { readerFoundationTokens } from './reader-tokens-probe.mjs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
const read=name=>readFileSync(new URL('../../entry/src/main/ets/ui/controls/'+name+'.ets',import.meta.url),'utf8');
export const toggleSource=read('ReaderToggle'),segmentSource=read('ReaderSegmentedControl');
const controlRecipe=source=>source.slice(source.indexOf('type Reader'),source.indexOf('/** Controlled'));
export const switchSpecSource=controlRecipe(toggleSource)+controlRecipe(segmentSource);
const formRowSource=read('ReaderFormRow');
export function switchSpecs(source=switchSpecSource){return new Function(stripTypeScriptTypes(source).replace(/^export /gm,'')+';return{resolveReaderToggleSpec,resolveReaderSegmentSpec};')();}
export function switchControls({specs=switchSpecs(),toggleDefinition=toggleSource,segmentDefinition=segmentSource,properties=createArkUIPropertyRuntimeProbe(),ColorMetrics}={}){
 const {root,require}=installedEtsCompiler();
 require(root+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderFormRow',new Set(['content']));
 const dependencies={...properties.sdk,...specs,...readerFoundationTokens,...readerTypographyRoles,readerAppColor,
  ReaderPressFeedback:productionReaderPressFeedback({ColorMetrics}),AccessibilityRoleType:{SWITCH:'AccessibilityRoleType.SWITCH',RADIO:'AccessibilityRoleType.RADIO'}};
 const hooks={...properties.hooks,childSources:{ReaderToggle:toggleDefinition,ReaderSegmentedControl:segmentDefinition,ReaderFormRow:formRowSource},mountChildren:true,lifecycleChildren:true,allowEmptyBranchAdmission:true};
 const toggle=createReaderBuilderProbe(toggleDefinition,boundedMembers(toggleDefinition),dependencies,hooks);
 const segment=createReaderBuilderProbe(segmentDefinition,boundedMembers(segmentDefinition),dependencies,hooks);
 const row=createReaderBuilderProbe(formRowSource,boundedMembers(formRowSource),dependencies,hooks);
 Object.assign(dependencies,{ReaderToggle:toggle.Component,ReaderSegmentedControl:segment.Component,ReaderFormRow:row.Component});
 const nodes=owner=>[...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>child.nodes?nodes(child):[])];
 return {toggle,segment,row,dependencies,hooks,properties,nodes,
  consumer(source,members,extra={},params={}){return createReaderBuilderProbe(source,members,{...dependencies,...extra},{...hooks,initialParams:params}).owner;},
  mount(probe,params){Object.assign(probe.owner,params);probe.owner.aboutToAppear();probe.owner.initialRender();return probe.owner;},
  update(owner,params){const current=Object.fromEntries(Object.keys(owner).filter(k=>k.startsWith('__')).map(k=>[k.slice(2),owner[k.slice(2)]]));owner.updateStateVars({...current,...params});properties.flush();},
 };
}
