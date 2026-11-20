import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import{foundationControls,readerFoundationTokens}from'./reader-foundation-control-probe.mjs';
import{readerTypographyRoles}from'./reader-typography-probe.mjs';
import{readerAppColor}from'../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import{productionReaderPressFeedback}from'./reader-press-feedback-probe.mjs';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';
const { ts, options } = installedEtsCompiler();
export const labeledIconSource=readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderLabeledIconAction.ets',import.meta.url),'utf8'),labeledIconSpecSource=readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderLabeledIconActionSpecs.ets',import.meta.url),'utf8');
function run(source,names,deps,classesOnly=false){
 let text=source;
 if(classesOnly){
  const tree=ts.createSourceFile('LabeledIcon.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[],'actual complete shared icon source parses');
  text=names.map(name=>{const matches=tree.statements.filter(node=>ts.isClassDeclaration(node)&&node.name?.text===name);assert.equal(matches.length,1,'actual icon modifier '+name);return matches[0].getText(tree);}).join('\n');
 }
 return pureModuleProbe(text,'LabeledIcon.ets',deps,names);
}
export function labeledIconSpecs(roles=readerTypographyRoles,source=labeledIconSpecSource){return run(source,['resolveReaderLabeledIconActionSpec'],{...readerFoundationTokens,...roles});}
export function labeledIconControls({specs=labeledIconSpecs(),source=labeledIconSource,foundation=foundationControls(),ColorMetrics}={}){
 const shared=foundation,enums={VerticalAlign:{Center:'VerticalAlign.Center'},FlexAlign:{Center:'FlexAlign.Center'}},ReaderPressFeedback=productionReaderPressFeedback({ColorMetrics});
 const modifiers=run(source,['ReaderLabeledIconLabelModifier','ReaderLabeledIconRowModifier','ReaderLabeledIconHitModifier'],{...shared.dependencies,...readerFoundationTokens,...specs,readerAppColor,ReaderPressFeedback,...enums},true);
 const deps={...shared.dependencies,...specs,...modifiers,...enums},hooks={...shared.hooks,childSources:{...shared.hooks.childSources,ReaderLabeledIconAction:source}};
 const component=createReaderBuilderProbe(source,boundedMembers(source),deps,hooks).Component;deps.ReaderLabeledIconAction=component;
 return{...shared,dependencies:deps,hooks,component};
}
