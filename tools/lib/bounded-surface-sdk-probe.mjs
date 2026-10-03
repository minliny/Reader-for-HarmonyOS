import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
const read=name=>readFileSync(new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url),'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(`${sdk}/node_modules/typescript`);
const compilerOptions=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
export function boundedMembers(source){
  const tree=ts.createSourceFile('/tmp/BoundedConsumer.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,compilerOptions);
  if(tree.parseDiagnostics.length)throw Error('real ETS parse diagnostics');
  return tree.statements.find(n=>n.members&&n.members.some(m=>m.name?.getText(tree)==='build')).members.filter(m=>m.name).map(m=>m.name.getText(tree));
}
const stripped=source=>stripTypeScriptTypes(source).replace(/^export /gm,'');
const tokenSource=read('ReaderTokens'),tokenNames=[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1]);
const tokens=new Function('readerAppColor','readerThemeDefinition',`${stripped(tokenSource).replace(/^import[^;]+;\s*/gm,'')};return{${tokenNames.join(',')}};`)(readerAppColor,readerThemeDefinition);
const specs=new Function('TextAlign',`${stripped(read('ReaderSurfaceSpecs'))};return{resolvePopupSpec,resolveSheetSpec,resolveDialogSpec};`)({Start:'TextAlign.Start',Center:'TextAlign.Center'});
function classOf(source,name,deps){const start=source.indexOf(`export class ${name}`),end=source.indexOf('@Component',start);
  return new Function(...Object.keys(deps),`${stripped(source.slice(start,end))};return ${name};`)(...Object.values(deps));}
/** Test-specific composition: actual SDK emitted children, V1 property classes,
 * shared producer modifiers and mounted slots. Uses the existing compiler helper
 * unchanged. Native scheduling/removal/layout/focus are explicitly outside proof. */
export function boundedSurfaceSdk(options={}){
  const properties=createArkUIPropertyRuntimeProbe();
  const childSources=Object.fromEntries(['ReaderRecoveryAction','ReaderRecoveryNotice','ReaderBoundedSurface','ReaderBoundedSurfaceHeader','ReaderBoundedSurfaceActions'].map(n=>[n,options[n]??read(n)]));
  const deps={...properties.sdk,...specs,...tokens,readerAppColor,
    ReaderBoundedFrameModifier:classOf(childSources.ReaderBoundedSurface,'ReaderBoundedFrameModifier',{...specs,readerAppColor}),
    ReaderBoundedTitleModifier:classOf(childSources.ReaderBoundedSurfaceHeader,'ReaderBoundedTitleModifier',{readerAppColor,...readerTypographyRoles}),
    ReaderBoundedFileActionModifier:classOf(childSources.ReaderBoundedSurfaceActions,'ReaderBoundedFileActionModifier',{}),
  };
  const hooks={...properties.hooks,childSources,mountChildren:true};
  for(const name of Object.keys(childSources))deps[name]=createReaderBuilderProbe(childSources[name],boundedMembers(childSources[name]),deps,hooks).Component;
  const walk=owner=>[owner,...[...owner.children.values()].flatMap(child=>child.nodes?walk(child):[])];
  return {properties,deps,hooks,childSources,walk,nodes:owner=>walk(owner).flatMap(x=>[...x.nodes.values()]),
    consumer(source,names=boundedMembers(source),extra={},initialParams={}){return createReaderBuilderProbe(source,names,{...deps,...extra},{...hooks,initialParams}).owner;}};
}
