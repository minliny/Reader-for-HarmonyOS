import { TOK_SCREEN_INSET } from '../../entry/src/main/ets/features/common/ReaderLayoutTokens.ts';
import assert from 'node:assert/strict';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles, ReaderTextStyle } from './reader-typography-probe.mjs';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import * as searchControlGeometry from '../../entry/src/main/ets/features/common/ReaderSearchControlGeometry.ts';
const { root: sdk, require } = installedEtsCompiler();
const file=name=>new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url);
const { readerReadableFontScale, readerScaledControlHeight }=pureModuleProbe(
 readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),
 'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
export const buttonSource=readFileSync(file('ReaderButton'),'utf8'),fieldSource=readFileSync(file('ReaderFormField'),'utf8');
const tokenSource=readFileSync(file('ReaderTokens'),'utf8'),tokenNames=['TOK_SCREEN_INSET', ...[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1])];
export const readerFoundationTokens=new Function('TOK_SCREEN_INSET','readerAppColor','readerThemeDefinition',stripTypeScriptTypes(tokenSource.replace(/^export \{[^;]+;\s*/gm,'')).replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'')+';return{'+tokenNames.join(',')+'};')(TOK_SCREEN_INSET,readerAppColor,readerThemeDefinition);
function finiteControlSpecs(roles,source,exports) {
 const values={...readerFoundationTokens,...roles,...searchControlGeometry,ReaderTextStyle};
 const {ts,options}=installedEtsCompiler();
 const tree=ts.createSourceFile('ReaderControlSpecs.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(tree.parseDiagnostics,[],'actual finite control specification parses');
 // Re-export syntax creates no local runtime binding. The actual imported
 // geometry is supplied above, independently of quote/line-break spelling.
 let localSource=source;
 for(const declaration of tree.statements.filter(node=>ts.isExportDeclaration(node)&&node.moduleSpecifier).reverse())
  localSource=localSource.slice(0,declaration.getStart(tree))+localSource.slice(declaration.end);
 return pureModuleProbe(localSource,'ReaderControlSpecs.ets',values,exports);
}
export function foundationSpecs(roles=readerTypographyRoles,source=readFileSync(file('ReaderControlSpecs'),'utf8')) {
 return finiteControlSpecs(roles,source,['resolveReaderButtonSpec','resolveReaderFormFieldSpec','readerSearchActionWidth','readerSearchControlHeight','readerSearchHistoryControlHeight']);
}
export function foundationIconSpec(source=readFileSync(file('ReaderControlSpecs'),'utf8')) {
 return finiteControlSpecs(readerTypographyRoles,source,['resolveReaderIconButtonSpec']).resolveReaderIconButtonSpec;
}
export function foundationModifiers(specs=foundationSpecs(),ColorMetrics,sourceOverrides={}) {
 const feedback=productionReaderPressFeedback({ColorMetrics});
 const common={...readerFoundationTokens,...specs,readerAppColor,readerReadableFontScale,readerScaledControlHeight,ReaderPressFeedback:feedback,TextAlign:{Center:'TextAlign.Center'},TextOverflow:{Ellipsis:'TextOverflow.Ellipsis'},VerticalAlign:{Center:'VerticalAlign.Center'},Color:{Transparent:'Color.Transparent'}};
 const load=(source,fileName,names)=>pureModuleProbe(source.slice(0,source.indexOf('@Component')),fileName,common,names);
 return {...load(sourceOverrides.buttonSource??buttonSource,'ReaderButton.ets',['ReaderButtonLabelModifier','ReaderButtonFrameModifier','ReaderButtonTextModifier']),...load(sourceOverrides.fieldSource??fieldSource,'ReaderFormField.ets',['ReaderFormFieldModifier','ReaderFormAreaModifier'])};
}
export function foundationControls({specs=foundationSpecs(),ColorMetrics,buttonSource:buttonDefinition=buttonSource,fieldSource:fieldDefinition=fieldSource,windowMetrics=()=>({systemFontScale:1})}={}) {
 const properties=createArkUIPropertyRuntimeProbe(),creationOrder=new WeakMap();let creationSequence=0;
 const beforeObserver=properties.hooks.onObserverEnter;properties.hooks.onObserverEnter=(owner,id)=>{beforeObserver?.(owner,id);let nodes=creationOrder.get(owner);if(!nodes)creationOrder.set(owner,nodes=new Map());if(!nodes.has(id))nodes.set(id,creationSequence++);};
 const modifiers=foundationModifiers(specs,ColorMetrics,{buttonSource:buttonDefinition,fieldSource:fieldDefinition});
 const deps={...properties.sdk,...readerFoundationTokens,...specs,...modifiers,readerReadableFontScale,readerScaledControlHeight,ReaderWindowCoordinator:{metrics:windowMetrics},InputType:{Password:'InputType.Password',Number:'InputType.Number'}};
 require(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderButton',new Set(['leading']));
 const button=createReaderBuilderProbe(buttonDefinition,['readerWindowMetricsRevision','scheme','specId','label','primary','actionEnabled','layout','isBusy','availableWidth','actionAccessibilityLabel','selectionSemantic','leading','emptyLeading','onAction','mounted','aboutToAppear','aboutToDisappear','build','commit','fontScale'],deps,properties.hooks);
 const field=createReaderBuilderProbe(fieldDefinition,['readerWindowMetricsRevision','scheme','specId','text','placeholder','isEditable','password','inputIdentity','fieldAccessibilityLabel','inputController','onEditingChange','editChanged','onTextChange','onSubmit','submit','mounted','aboutToAppear','aboutToDisappear','build','change','fontScale'],deps,properties.hooks);
 const dependencies={...deps,ReaderButton:button.Component,ReaderFormField:field.Component};
 return {button,field,properties,dependencies,hooks:{onObserverEnter:properties.hooks.onObserverEnter,childSources:{ReaderButton:buttonDefinition,ReaderFormField:fieldDefinition},mountChildren:true,lifecycleChildren:true},
  nodes(owner){return [...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(child=>this.nodes(child))];},
  orderedNodes(owner){const collect=current=>[...[...(current.nodes?.values()??[])].map(node=>({node,sequence:creationOrder.get(current)?.get(node.id)??Infinity})),...[...(current.children?.values()??[])].flatMap(collect)];return collect(owner).sort((a,b)=>a.sequence-b.sequence).map(entry=>entry.node);},
  flush(owner){owner.replay();properties.flush();}};
}
