import { installedEtsCompiler, emitSdkProbe } from './ets-compiler-runtime.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderComponentProbe as createReaderBuilderProbe} from './reader-component-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';

const file=name=>new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url);
export const choiceSource=readFileSync(file('ReaderChoiceRow'),'utf8');
const text=readFileSync(file('ReaderChoiceSpecs'),'utf8').replace(/^import[\s\S]*?;\s*/gm,'');
export const {resolveReaderChoiceSpec}=new Function(...Object.keys(readerTypographyRoles),
  stripTypeScriptTypes(text).replace(/^export /gm,'')+';return {resolveReaderChoiceSpec};')(...Object.values(readerTypographyRoles));

export function compileReaderChoiceLabelModifier(resolve=resolveReaderChoiceSpec,source=choiceSource) {
  const { ts, options } = installedEtsCompiler();
  const tree=ts.createSourceFile('ReaderChoiceRow.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const declaration=tree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ReaderChoiceLabelModifier');
  if(!declaration)throw Error('actual ReaderChoiceLabelModifier declaration missing');
  const output=emitSdkProbe(declaration.getText(tree),{fileName:'module.ts',parseSource:source,scriptKind:'ETS',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}});
  return new Function('resolveReaderChoiceSpec','TextAlign','TextOverflow','WordBreak',output+';return ReaderChoiceLabelModifier;')(resolve,{Start:'TextAlign.Start'},{Ellipsis:'TextOverflow.Ellipsis'},{BREAK_WORD:'WordBreak.BREAK_WORD'});
}

export function choiceRowProbe(resolve=resolveReaderChoiceSpec,source=choiceSource,properties=createArkUIPropertyRuntimeProbe()) {
  const modifier=compileReaderChoiceLabelModifier(resolve,source);
  const accessibility=pureModuleProbe(readFileSync(file('ReaderActionAccessibility'),'utf8'),
    'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON'}},['ReaderActionAccessibility','readerActionTouchRegion']);
  const sizing=pureModuleProbe(readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),
    'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
  const probe=createReaderBuilderProbe(source,
    boundedMembers(source),
    {...properties.sdk,...accessibility,...sizing,resolveReaderChoiceSpec:resolve,ReaderChoiceLabelModifier:modifier},properties.hooks);
  return {...probe,properties,dependencies:{ReaderChoiceRow:probe.Component,resolveReaderChoiceSpec:resolve},
    hooks:{childSources:{ReaderChoiceRow:source},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];}};
}
