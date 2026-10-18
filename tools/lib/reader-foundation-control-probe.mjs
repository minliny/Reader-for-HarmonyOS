import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
const { root: sdk, require } = installedEtsCompiler();
const file=name=>new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url);
export const buttonSource=readFileSync(file('ReaderButton'),'utf8'),fieldSource=readFileSync(file('ReaderFormField'),'utf8');
const tokenSource=readFileSync(file('ReaderTokens'),'utf8'),tokenNames=[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1]);
export const readerFoundationTokens=new Function('readerAppColor','readerThemeDefinition',stripTypeScriptTypes(tokenSource).replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'')+';return{'+tokenNames.join(',')+'};')(readerAppColor,readerThemeDefinition);
export function foundationSpecs(roles=readerTypographyRoles,source=readFileSync(file('ReaderControlSpecs'),'utf8')) {
 const values={...readerFoundationTokens,...roles};
 return pureModuleProbe(source,'ReaderControlSpecs.ets',values,['resolveReaderButtonSpec','resolveReaderFormFieldSpec']);
}
export function foundationModifiers(specs=foundationSpecs(),ColorMetrics,sourceOverrides={}) {
 const feedback=productionReaderPressFeedback({ColorMetrics});
 const common={...readerFoundationTokens,...specs,readerAppColor,ReaderPressFeedback:feedback,TextAlign:{Center:'TextAlign.Center'},TextOverflow:{Ellipsis:'TextOverflow.Ellipsis'},VerticalAlign:{Center:'VerticalAlign.Center'},Color:{Transparent:'Color.Transparent'}};
 const load=(source,fileName,names)=>pureModuleProbe(source.slice(0,source.indexOf('@Component')),fileName,common,names);
 return {...load(sourceOverrides.buttonSource??buttonSource,'ReaderButton.ets',['ReaderButtonLabelModifier','ReaderButtonFrameModifier','ReaderButtonTextModifier']),...load(sourceOverrides.fieldSource??fieldSource,'ReaderFormField.ets',['ReaderFormFieldModifier','ReaderFormAreaModifier'])};
}
export function foundationControls({specs=foundationSpecs(),ColorMetrics,buttonSource:buttonDefinition=buttonSource,fieldSource:fieldDefinition=fieldSource,windowMetrics=()=>({systemFontScale:1})}={}) {
 const properties=createArkUIPropertyRuntimeProbe(),creationOrder=new WeakMap();let creationSequence=0;
 const beforeObserver=properties.hooks.onObserverEnter;properties.hooks.onObserverEnter=(owner,id)=>{beforeObserver?.(owner,id);let nodes=creationOrder.get(owner);if(!nodes)creationOrder.set(owner,nodes=new Map());if(!nodes.has(id))nodes.set(id,creationSequence++);};
 const modifiers=foundationModifiers(specs,ColorMetrics,{buttonSource:buttonDefinition,fieldSource:fieldDefinition});
 const deps={...properties.sdk,...readerFoundationTokens,...specs,...modifiers,ReaderWindowCoordinator:{metrics:windowMetrics},InputType:{Password:'InputType.Password',Number:'InputType.Number'}};
 require(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderButton',new Set(['leading']));
 const button=createReaderBuilderProbe(buttonDefinition,['scheme','specId','label','primary','actionEnabled','layout','isBusy','availableWidth','actionAccessibilityLabel','leading','emptyLeading','onAction','mounted','aboutToAppear','aboutToDisappear','build','commit'],deps,properties.hooks);
 const field=createReaderBuilderProbe(fieldDefinition,['scheme','specId','text','placeholder','isEditable','password','inputIdentity','fieldAccessibilityLabel','inputController','onEditingChange','editChanged','onTextChange','onSubmit','submit','mounted','aboutToAppear','aboutToDisappear','build','change'],deps,properties.hooks);
 const dependencies={...deps,ReaderButton:button.Component,ReaderFormField:field.Component};
 return {button,field,properties,dependencies,hooks:{onObserverEnter:properties.hooks.onObserverEnter,childSources:{ReaderButton:buttonDefinition,ReaderFormField:fieldDefinition},mountChildren:true,lifecycleChildren:true},
  nodes(owner){return [...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(child=>this.nodes(child))];},
  orderedNodes(owner){const collect=current=>[...[...(current.nodes?.values()??[])].map(node=>({node,sequence:creationOrder.get(current)?.get(node.id)??Infinity})),...[...(current.children?.values()??[])].flatMap(collect)];return collect(owner).sort((a,b)=>a.sequence-b.sequence).map(entry=>entry.node);},
  flush(owner){owner.replay();properties.flush();}};
}
