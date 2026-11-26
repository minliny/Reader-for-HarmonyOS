import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readFileSync } from 'node:fs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor } from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerFoundationTokens } from './reader-tokens-probe.mjs';
import * as searchGeometry from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { readerSurfaceSpecsForProbe } from './bounded-surface-sdk-probe.mjs';
import { readerEditingSdk } from './reader-editing-sdk-probe.mjs';
export { readerFoundationTokens };
const { root: sdk, require } = installedEtsCompiler();
const file=name=>new URL('../../entry/src/main/ets/ui/surfaces/'+name+'.ets',import.meta.url);
export const buttonSource=readFileSync(new URL('../../entry/src/main/ets/ui/controls/ReaderButton.ets',import.meta.url),'utf8');
export const fieldSource=readFileSync(new URL('../../entry/src/main/ets/ui/controls/ReaderFormField.ets',import.meta.url),'utf8');
const sectionHeadingSource=readFileSync(new URL('../../entry/src/main/ets/ui/controls/ReaderSectionHeading.ets',import.meta.url),'utf8');
const cardSource=readFileSync(file('ReaderCard'),'utf8');
const specsSource=readFileSync(new URL('../../entry/src/main/ets/ui/controls/ReaderControlSpecs.ets',import.meta.url),'utf8');
export function foundationSpecs(roles=readerTypographyRoles,source=specsSource) {
 const values={...readerFoundationTokens,...searchGeometry,...roles,ReaderTextStyle:readerTypographyRoles.TYPE_SOURCE_TOOLS_ACTION.constructor};
 return {...searchGeometry,...pureModuleProbe(source,'ReaderControlSpecs.ets',values,['resolveReaderButtonSpec','resolveReaderButtonMatrixPaint','resolveReaderButtonMatrixSize','READER_DIALOG_FORM_ACTION_SIZE','resolveReaderFormFieldSpec'])};
}
const surfaceResolverSource=readFileSync(new URL('../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts',import.meta.url),'utf8');
export const surfaceFontResolvers=()=>pureModuleProbe(surfaceResolverSource,'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight','readerScaledBarHeight']);
export function withReaderSectionHeading(controls, roles=readerTypographyRoles) {
 controls.hooks.childSources.ReaderSectionHeading=sectionHeadingSource;
 controls.dependencies.ReaderSectionHeading=createReaderBuilderProbe(sectionHeadingSource,['appThemeScheme','title','variant','build'],
  {...controls.dependencies,...roles,readerAppColor},controls.hooks).Component;
 return controls;
}
export function foundationModifiers(specs=foundationSpecs(),ColorMetrics,sourceOverrides={}) {
 const feedback=productionReaderPressFeedback({ColorMetrics});
 const common={...readerFoundationTokens,...specs,...surfaceFontResolvers(),readerAppColor,ReaderPressFeedback:feedback,Alignment:{Center:'Alignment.Center'},TextAlign:{Center:'TextAlign.Center'},TextOverflow:{Ellipsis:'TextOverflow.Ellipsis'},VerticalAlign:{Center:'VerticalAlign.Center'},AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON',RADIO:'AccessibilityRoleType.RADIO'},Color:{Transparent:'Color.Transparent'}};
 const load=(source,fileName,names)=>pureModuleProbe(source.slice(0,source.indexOf('@Component')),fileName,common,names);
 return {ReaderPressFeedback: feedback, ...load(sourceOverrides.buttonSource??buttonSource,'ReaderButton.ets',['ReaderButtonLabelModifier','ReaderButtonFrameModifier','ReaderButtonTextModifier','ReaderButtonSelectionModifier']),...load(sourceOverrides.fieldSource??fieldSource,'ReaderFormField.ets',['ReaderFormFieldModifier','ReaderFormAreaModifier','ReaderContentSearchNaturalFrame'])};
}
export function foundationControls({specs=foundationSpecs(),ColorMetrics,buttonSource:buttonDefinition=buttonSource,fieldSource:fieldDefinition=fieldSource,windowMetrics=()=>({systemFontScale:1})}={}) {
 const properties=createArkUIPropertyRuntimeProbe(),creationOrder=new WeakMap();let creationSequence=0;
 const beforeObserver=properties.hooks.onObserverEnter;properties.hooks.onObserverEnter=(owner,id)=>{beforeObserver?.(owner,id);let nodes=creationOrder.get(owner);if(!nodes)creationOrder.set(owner,nodes=new Map());if(!nodes.has(id))nodes.set(id,creationSequence++);};
 const modifiers=foundationModifiers(specs,ColorMetrics,{buttonSource:buttonDefinition,fieldSource:fieldDefinition});
 const deps={...properties.sdk,...readerFoundationTokens,...specs,...surfaceFontResolvers(),...modifiers,readerWindowMetrics:windowMetrics,ReaderWindowCoordinator:{metrics:windowMetrics},InputType:{Password:'InputType.Password',Number:'InputType.Number'}};
 require(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderButton',new Set(['leading']));
 require(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderCard',new Set(['content']));
 const button=createReaderBuilderProbe(buttonDefinition,['readerWindowMetricsRevision','reduceMotion','scheme','specId','label','variant','visualSize','primary','actionEnabled','layout','isBusy','availableWidth','controlWidth','controlHeight','actionAccessibilityLabel','selectionSemantic','focusId','preferDefaultFocus','pressPointer','leading','emptyLeading','onAction','onFocused','mounted','aboutToAppear','aboutToDisappear','build','matrixButton','matrixVariant','matrixSize','matrixPaint','matrixLabelStyle','matrixWidth','matrixPadding','matrixOpacity','observePress','resetPress','commit','fontScale'],deps,properties.hooks);
 const editing = readerEditingSdk();
 const field = createReaderBuilderProbe(fieldDefinition, [
   'readerWindowMetricsRevision', 'scheme', 'specId', 'text', 'placeholder', 'isEditable', 'password',
   'inputIdentity', 'fieldAccessibilityLabel', 'naturalInputHeightVp', 'inputController', 'editingHost',
   'editingContext', 'nativeInputController', 'nativeAreaController', 'editingTarget',
   'onEditingChange', 'onTextChange', 'onSubmit', 'mounted', 'aboutToAppear', 'aboutToDisappear',
   'nativeInputId', 'bindEditingTarget', 'editingGeometryChanged', 'textChangeHandler', 'submitHandler',
   'build', 'change', 'editChanged', 'submit', 'fontScale',
 ], { ...deps, ...editing, TextInputController: class {} }, properties.hooks);
 const cardSpecs=pureModuleProbe(readFileSync(file('ReaderCardSpecs'),'utf8'),'ReaderCardSpecs.ets',readerFoundationTokens,['resolveReaderCardSpec']);
 const { readerSurfaceElevation } = readerSurfaceSpecsForProbe();
 const card=createReaderBuilderProbe(cardSource,['appThemeScheme','specId','cardWidth','content','build'],
  {...deps,...cardSpecs,readerAppColor,readerSurfaceElevation},properties.hooks);
 const dependencies={...deps,readerSurfaceElevation,ReaderButton:button.Component,ReaderFormField:field.Component,ReaderCard:card.Component};
 return {button,field,properties,dependencies,hooks:{onObserverEnter:properties.hooks.onObserverEnter,childSources:{ReaderButton:buttonDefinition,ReaderFormField:fieldDefinition,ReaderCard:cardSource},mountChildren:true,lifecycleChildren:true},
  nodes(owner){return [...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(child=>this.nodes(child))];},
  orderedNodes(owner){const collect=current=>[...[...(current.nodes?.values()??[])].map(node=>({node,sequence:creationOrder.get(current)?.get(node.id)??Infinity})),...[...(current.children?.values()??[])].flatMap(collect)];return collect(owner).sort((a,b)=>a.sequence-b.sequence).map(entry=>entry.node);},
  flush(owner){owner.replay();properties.flush();}};
}
