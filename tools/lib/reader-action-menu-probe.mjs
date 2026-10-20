import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';

const file=name=>new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url);
export const menuSource=readFileSync(file('ReaderActionMenuSurface'),'utf8');
const specSource=readFileSync(file('ReaderSurfaceSpecs'),'utf8');
export const {resolvePopupSpec,resolveActionSheetSpec}=new Function('TextAlign','SOURCE_SWITCH_VISUAL',stripTypeScriptTypes(specSource)
  .replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'')+';return {resolvePopupSpec,resolveActionSheetSpec};')({Start:'TextAlign.Start',Center:'TextAlign.Center'},SOURCE_SWITCH_VISUAL);
export const ReaderMenuActionView=new Function(stripTypeScriptTypes(menuSource.slice(
  menuSource.indexOf('export class ReaderMenuActionView'),menuSource.indexOf('@Component')))
  .replace('export class','class')+';return ReaderMenuActionView;')();

export function actionMenuProbe(resolve=resolvePopupSpec) {
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(menuSource,
    ['appThemeScheme','variant','specId','scheme','actions','availableWidth','viewportHeight','onAction','mounted','aboutToAppear','aboutToDisappear','build','menuActions','actionRow','actionRows','row','actionSheetSpec','spec','action','dividerWidth','effectiveScheme','color','accessibilityLabel','commitAction'],
    {...properties.sdk,ReaderMenuActionView,resolvePopupSpec:resolve,resolveActionSheetSpec},properties.hooks);
  return {...probe,properties,dependencies:{ReaderActionMenuSurface:probe.Component,ReaderMenuActionView,resolvePopupSpec:resolve,resolveActionSheetSpec},
    hooks:{childSources:{ReaderActionMenuSurface:menuSource},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {
      return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];
    }};
}
