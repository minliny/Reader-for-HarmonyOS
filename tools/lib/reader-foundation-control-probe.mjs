import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
const options=createRequire(import.meta.url)(sdk+'/lib/ets_checker.js').compilerOptions;
const file=name=>new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url);
export const buttonSource=readFileSync(file('ReaderButton'),'utf8'),fieldSource=readFileSync(file('ReaderFormField'),'utf8');
const tokenSource=readFileSync(file('ReaderTokens'),'utf8'),tokenNames=[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1]);
export const readerFoundationTokens=new Function('readerAppColor','readerThemeDefinition',stripTypeScriptTypes(tokenSource).replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'')+';return{'+tokenNames.join(',')+'};')(readerAppColor,readerThemeDefinition);
function withoutImports(source) {
 const tree=ts.createSourceFile('/tmp/Foundation.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.equal(tree.parseDiagnostics.length,0,'actual foundation source parses');
 for(const n of tree.statements.filter(ts.isImportDeclaration).reverse())source=source.slice(0,n.getStart(tree))+source.slice(n.end);
 return source.replace(/^export /gm,'');
}
function executable(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;}
export function foundationSpecs(roles=readerTypographyRoles,source=readFileSync(file('ReaderControlSpecs'),'utf8')) {
 const values={...readerFoundationTokens,...roles};
 return new Function(...Object.keys(values),executable(withoutImports(source))+';return {resolveReaderButtonSpec,resolveReaderFormFieldSpec};')(...Object.values(values));
}
export function foundationModifiers(specs=foundationSpecs(),ColorMetrics,sourceOverrides={}) {
 const feedback=productionReaderPressFeedback({ColorMetrics});
 const common={...readerFoundationTokens,...specs,readerAppColor,ReaderPressFeedback:feedback,TextAlign:{Center:'TextAlign.Center'}};
 const load=(source,names)=>new Function(...Object.keys(common),executable(withoutImports(source.slice(0,source.indexOf('@Component'))))+';return {'+names.join(',')+'};')(...Object.values(common));
 return {...load(sourceOverrides.buttonSource??buttonSource,['ReaderButtonLabelModifier','ReaderButtonFrameModifier','ReaderButtonTextModifier']),...load(sourceOverrides.fieldSource??fieldSource,['ReaderFormFieldModifier','ReaderFormAreaModifier'])};
}
export function foundationControls({specs=foundationSpecs(),ColorMetrics,buttonSource:buttonDefinition=buttonSource,fieldSource:fieldDefinition=fieldSource}={}) {
 const properties=createArkUIPropertyRuntimeProbe(),creationOrder=new WeakMap();let creationSequence=0;
 const beforeObserver=properties.hooks.onObserverEnter;properties.hooks.onObserverEnter=(owner,id)=>{beforeObserver?.(owner,id);let nodes=creationOrder.get(owner);if(!nodes)creationOrder.set(owner,nodes=new Map());if(!nodes.has(id))nodes.set(id,creationSequence++);};
 const modifiers=foundationModifiers(specs,ColorMetrics,{buttonSource:buttonDefinition,fieldSource:fieldDefinition});
 const deps={...properties.sdk,...readerFoundationTokens,...specs,...modifiers,InputType:{Password:'InputType.Password',Number:'InputType.Number'}};
 const button=createReaderBuilderProbe(buttonDefinition,['scheme','specId','label','primary','actionEnabled','layout','isBusy','availableWidth','onAction','mounted','aboutToAppear','aboutToDisappear','build','commit'],deps,properties.hooks);
 const field=createReaderBuilderProbe(fieldDefinition,['scheme','specId','text','placeholder','isEditable','password','onTextChange','onSubmit','submit','mounted','aboutToAppear','aboutToDisappear','build','change'],deps,properties.hooks);
 const dependencies={...deps,ReaderButton:button.Component,ReaderFormField:field.Component};
 return {button,field,properties,dependencies,hooks:{onObserverEnter:properties.hooks.onObserverEnter,childSources:{ReaderButton:buttonDefinition,ReaderFormField:fieldDefinition},mountChildren:true,lifecycleChildren:true},
  nodes(owner){return [...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(child=>this.nodes(child))];},
  orderedNodes(owner){const collect=current=>[...[...(current.nodes?.values()??[])].map(node=>({node,sequence:creationOrder.get(current)?.get(node.id)??Infinity})),...[...(current.children?.values()??[])].flatMap(collect)];return collect(owner).sort((a,b)=>a.sequence-b.sequence).map(entry=>entry.node);},
  flush(owner){owner.replay();properties.flush();}};
}
