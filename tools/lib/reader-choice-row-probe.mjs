import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';
import {boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {surfaceFontResolvers} from './reader-foundation-control-probe.mjs';

export const choiceSource=readFileSync(new URL('../../entry/src/main/ets/ui/controls/ReaderChoiceRow.ets',import.meta.url),'utf8');
const text=choiceSource.slice(choiceSource.indexOf('type ReaderChoiceSpecId'),choiceSource.indexOf('/** The finite row spec'));
export const {resolveReaderChoiceSpec}=new Function(...Object.keys(readerTypographyRoles),
  stripTypeScriptTypes(text).replace(/^export /gm,'')+';return {resolveReaderChoiceSpec};')(...Object.values(readerTypographyRoles));

export function compileReaderChoiceLabelModifier(resolve=resolveReaderChoiceSpec,source=choiceSource) {
  const { ts } = installedEtsCompiler();
  const modifierSource=source.slice(source.indexOf('class ReaderChoiceLabelModifier'),source.indexOf('/** Controlled option'));
  return new Function('resolveReaderChoiceSpec','TextAlign','TextOverflow','WordBreak',
    ts.transpileModule(modifierSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return ReaderChoiceLabelModifier;')(
    resolve,{Start:'TextAlign.Start'},{Ellipsis:'TextOverflow.Ellipsis'},{BREAK_WORD:'WordBreak.BREAK_WORD'});
}

export function choiceRowProbe(resolve=resolveReaderChoiceSpec,source=choiceSource,properties=createArkUIPropertyRuntimeProbe()) {
  const modifier=compileReaderChoiceLabelModifier(resolve,source);
  const probe=createReaderBuilderProbe(source,boundedMembers(source),
    {...properties.sdk,...surfaceFontResolvers(),ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1})},
      resolveReaderChoiceSpec:resolve,ReaderChoiceLabelModifier:modifier},properties.hooks);
  return {...probe,properties,dependencies:{ReaderChoiceRow:probe.Component,resolveReaderChoiceSpec:resolve},
    hooks:{childSources:{ReaderChoiceRow:source},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];}};
}
