import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
const options=createRequire(import.meta.url)(sdk+'/lib/ets_checker.js').compilerOptions;
const file=name=>new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url);
export const buttonSource=readFileSync(file('ReaderButton'),'utf8'),fieldSource=readFileSync(file('ReaderFormField'),'utf8');
function withoutImports(source) {
 const tree=ts.createSourceFile('/tmp/Foundation.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.equal(tree.parseDiagnostics.length,0,'actual foundation source parses');
 for(const n of tree.statements.filter(ts.isImportDeclaration).reverse())source=source.slice(0,n.getStart(tree))+source.slice(n.end);
 return source.replace(/^export /gm,'');
}
function executable(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;}
export function foundationSpecs(roles=readerTypographyRoles,source=readFileSync(file('ReaderControlSpecs'),'utf8')) {
 return new Function(...Object.keys(roles),executable(withoutImports(source))+';return {resolveReaderButtonSpec,resolveReaderFormFieldSpec};')(...Object.values(roles));
}
export function foundationModifiers(specs=foundationSpecs(),ColorMetrics,sourceOverrides={}) {
 const feedback=productionReaderPressFeedback({ColorMetrics});
 const common={...specs,readerAppColor,ReaderPressFeedback:feedback,TOK_BORDER_W:1,TextAlign:{Center:'TextAlign.Center'}};
 const load=(source,names)=>new Function(...Object.keys(common),executable(withoutImports(source.slice(0,source.indexOf('@Component'))))+';return {'+names.join(',')+'};')(...Object.values(common));
 return {...load(sourceOverrides.buttonSource??buttonSource,['ReaderButtonLabelModifier','ReaderButtonFrameModifier','ReaderButtonTextModifier']),...load(sourceOverrides.fieldSource??fieldSource,['ReaderFormFieldModifier'])};
}
export function foundationControls({specs=foundationSpecs(),ColorMetrics,buttonSource:buttonDefinition=buttonSource,fieldSource:fieldDefinition=fieldSource}={}) {
 const properties=createArkUIPropertyRuntimeProbe(),modifiers=foundationModifiers(specs,ColorMetrics,{buttonSource:buttonDefinition,fieldSource:fieldDefinition});
 const deps={...properties.sdk,...specs,...modifiers,InputType:{Password:'InputType.Password'}};
 const button=createReaderBuilderProbe(buttonDefinition,['scheme','specId','label','primary','actionEnabled','layout','onAction','mounted','aboutToAppear','aboutToDisappear','build','commit'],deps,properties.hooks);
 const field=createReaderBuilderProbe(fieldDefinition,['scheme','specId','text','placeholder','isEditable','password','onTextChange','mounted','aboutToAppear','aboutToDisappear','build','change'],deps,properties.hooks);
 const dependencies={...deps,ReaderButton:button.Component,ReaderFormField:field.Component};
 return {button,field,properties,dependencies,hooks:{childSources:{ReaderButton:buttonDefinition,ReaderFormField:fieldDefinition},mountChildren:true,lifecycleChildren:true},
  nodes(owner){return [...(owner.nodes?.values()??[]),...[...(owner.children?.values()??[])].flatMap(child=>this.nodes(child))];},
  flush(owner){owner.replay();properties.flush();}};
}
