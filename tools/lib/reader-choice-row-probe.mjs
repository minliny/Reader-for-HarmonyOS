import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';

const file=name=>new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url);
export const choiceSource=readFileSync(file('ReaderChoiceRow'),'utf8');
const text=readFileSync(file('ReaderChoiceSpecs'),'utf8').replace(/^import[\s\S]*?;\s*/gm,'');
export const {resolveReaderChoiceSpec}=new Function(...Object.keys(readerTypographyRoles),
  stripTypeScriptTypes(text).replace(/^export /gm,'')+';return {resolveReaderChoiceSpec};')(...Object.values(readerTypographyRoles));

export function choiceRowProbe(resolve=resolveReaderChoiceSpec,source=choiceSource) {
  const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
  const modifierSource=source.slice(source.indexOf('class ReaderChoiceLabelModifier'),source.indexOf('/** Controlled option'));
  const modifier=new Function('resolveReaderChoiceSpec','TextAlign','TextOverflow',ts.transpileModule(modifierSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText+';return ReaderChoiceLabelModifier;')(resolve,{Start:'TextAlign.Start'},{Ellipsis:'TextOverflow.Ellipsis'});
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(source,
    ['specId','label','selected','showDivider','scheme','availableWidth','chevronAngle','actionEnabled','onChoose',
      'mounted','aboutToAppear','aboutToDisappear','build','normalRow','positionedRow','spec','textStyle','rowHeight','textColor','rowBackground','hasIcon','icon','accessibilityLabel','choose'],
    {...properties.sdk,resolveReaderChoiceSpec:resolve,ReaderChoiceLabelModifier:modifier},properties.hooks);
  return {...probe,properties,dependencies:{ReaderChoiceRow:probe.Component,resolveReaderChoiceSpec:resolve},
    hooks:{childSources:{ReaderChoiceRow:source},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];}};
}
