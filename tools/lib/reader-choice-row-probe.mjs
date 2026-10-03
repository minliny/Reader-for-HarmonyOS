import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './arkui-property-runtime-probe.mjs';
import {readerTypographyRoles} from './reader-typography-probe.mjs';

const file=name=>new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url);
export const choiceSource=readFileSync(file('ReaderChoiceRow'),'utf8');
const text=readFileSync(file('ReaderChoiceSpecs'),'utf8').replace(/^import[\s\S]*?;\s*/gm,'');
export const {resolveReaderChoiceSpec}=new Function(...Object.keys(readerTypographyRoles),
  stripTypeScriptTypes(text).replace(/^export /gm,'')+';return {resolveReaderChoiceSpec};')(...Object.values(readerTypographyRoles));

export function choiceRowProbe(resolve=resolveReaderChoiceSpec) {
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(choiceSource,
    ['specId','label','selected','showDivider','scheme','availableWidth','chevronAngle','enabled','onChoose',
      'mounted','aboutToAppear','aboutToDisappear','build','normalRow','positionedRow','spec','textStyle','rowHeight','textColor','rowBackground','hasIcon','icon','accessibilityLabel','choose'],
    {...properties.sdk,resolveReaderChoiceSpec:resolve},properties.hooks);
  return {...probe,properties,dependencies:{ReaderChoiceRow:probe.Component,resolveReaderChoiceSpec:resolve},
    hooks:{childSources:{ReaderChoiceRow:choiceSource},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];}};
}
