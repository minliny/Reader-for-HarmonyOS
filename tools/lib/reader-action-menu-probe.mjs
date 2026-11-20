import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { builderComponentMembers } from './ets-builder-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

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
  const surfaceResolvers=pureModuleProbe(readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts',import.meta.url),'utf8'),
    'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
  const accessibility=pureModuleProbe(readFileSync(file('ReaderActionAccessibility'),'utf8'),'ReaderActionAccessibility.ets',
    {AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON'}},['ReaderActionAccessibility','readerActionTouchRegion']);
  const probe=createReaderBuilderProbe(menuSource,
    builderComponentMembers(menuSource,'ReaderActionMenuSurface'),
    {...properties.sdk,...surfaceResolvers,...accessibility,ReaderMenuActionView,resolvePopupSpec:resolve,resolveActionSheetSpec},properties.hooks);
  return {...probe,properties,dependencies:{ReaderActionMenuSurface:probe.Component,ReaderMenuActionView,resolvePopupSpec:resolve,resolveActionSheetSpec},
    hooks:{childSources:{ReaderActionMenuSurface:menuSource},mountChildren:true,lifecycleChildren:true},
    nodes(owner) {
      return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];
    }};
}
