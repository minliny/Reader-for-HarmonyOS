import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';import{createRequire}from'node:module';
import{foundationControls,readerFoundationTokens}from'./reader-foundation-control-probe.mjs';
import{readerTypographyRoles}from'./reader-typography-probe.mjs';
import{readerAppColor}from'../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import{productionReaderPressFeedback}from'./reader-press-feedback-probe.mjs';
import{createReaderBuilderProbe}from'./reader-control-builder-probe.mjs';
import{boundedMembers}from'./bounded-surface-sdk-probe.mjs';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',r=createRequire(import.meta.url),ts=r(sdk+'/node_modules/typescript'),options=r(sdk+'/lib/ets_checker.js').compilerOptions;
export const labeledIconSource=readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderLabeledIconAction.ets',import.meta.url),'utf8'),labeledIconSpecSource=readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderLabeledIconActionSpecs.ets',import.meta.url),'utf8');
function run(source,names,deps){const tree=ts.createSourceFile('LabeledIcon.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0,'actual finite shared icon source parses');for(const n of tree.statements.filter(ts.isImportDeclaration).reverse())source=source.slice(0,n.getStart(tree))+source.slice(n.end);const code=ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function(...Object.keys(deps),code+';return {'+names.join(',')+'};')(...Object.values(deps));}
export function labeledIconSpecs(roles=readerTypographyRoles,source=labeledIconSpecSource){return run(source,['resolveReaderLabeledIconActionSpec'],roles);}
export function labeledIconControls({specs=labeledIconSpecs(),source=labeledIconSource}={}){
 const shared=foundationControls(),enums={VerticalAlign:{Center:'VerticalAlign.Center'},FlexAlign:{Center:'FlexAlign.Center'}},ReaderPressFeedback=productionReaderPressFeedback({});
 const modifiers=run(source.slice(0,source.indexOf('@Component')),['ReaderLabeledIconLabelModifier','ReaderLabeledIconRowModifier','ReaderLabeledIconHitModifier'],{...readerFoundationTokens,...specs,readerAppColor,ReaderPressFeedback,...enums});
 const deps={...shared.dependencies,...specs,...modifiers,...enums},hooks={...shared.hooks,childSources:{...shared.hooks.childSources,ReaderLabeledIconAction:source}};
 const component=createReaderBuilderProbe(source,boundedMembers(source),deps,hooks).Component;deps.ReaderLabeledIconAction=component;
 return{...shared,dependencies:deps,hooks,component};
}
