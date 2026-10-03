import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';

const file=name=>new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url);
export const menuSource=readFileSync(file('ReaderActionMenuSurface'),'utf8');
const specSource=readFileSync(file('ReaderSurfaceSpecs'),'utf8');
export const {resolvePopupSpec}=new Function('TextAlign',stripTypeScriptTypes(specSource)
  .replace(/^export /gm,'')+';return {resolvePopupSpec};')({Start:'TextAlign.Start',Center:'TextAlign.Center'});
export const ReaderMenuActionView=new Function(stripTypeScriptTypes(menuSource.slice(
  menuSource.indexOf('export class ReaderMenuActionView'),menuSource.indexOf('/** Shared content')))
  .replace('export class','class')+';return ReaderMenuActionView;')();

export function actionMenuProbe(resolve=resolvePopupSpec) {
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(menuSource,
    ['specId','scheme','actions','availableWidth','viewportHeight','onAction','build','actionRow','spec','action','dividerWidth','commitAction'],
    {...properties.sdk,ReaderMenuActionView,resolvePopupSpec:resolve},properties.hooks);
  return {...probe,properties,dependencies:{ReaderActionMenuSurface:probe.Component,ReaderMenuActionView,resolvePopupSpec:resolve},
    hooks:{childSources:{ReaderActionMenuSurface:menuSource},mountChildren:true},
    nodes(owner) {
      return [...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>this.nodes(child))];
    }};
}
