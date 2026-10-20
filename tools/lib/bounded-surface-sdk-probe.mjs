import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import * as readerFonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { SOURCE_SWITCH_VISUAL } from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { ReaderInsetsVp } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const read=name=>readFileSync(new URL(`../../entry/src/main/ets/features/common/${name}.ets`,import.meta.url),'utf8');
const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(`${sdk}/node_modules/typescript`);
const compilerOptions=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
export function boundedMembers(source,componentName){
  const tree=ts.createSourceFile(virtualFilePath('BoundedConsumer.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,compilerOptions);
  if(tree.parseDiagnostics.length)throw Error('real ETS parse diagnostics');
  const components=tree.statements.filter(n=>n.members&&n.name&&n.members.some(m=>m.name?.getText(tree)==='build'));
  const exact=componentName===undefined?undefined:components.find(n=>n.name.getText(tree)===componentName);
  const exported=components.filter(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword));
  const component=exact??(exported.length===1?exported[0]:components.length===1?components[0]:undefined);
  if(component===undefined)throw Error('select explicit componentName for multi-component ETS');
  return component.members.filter(m=>m.name).map(m=>m.name.getText(tree));
}
const stripped=source=>stripTypeScriptTypes(source).replace(/^export /gm,'');
const tokenSource=read('ReaderTokens'),tokenNames=[...tokenSource.matchAll(/^export const (\w+)/gm)].map(m=>m[1]);
const tokens=new Function('readerAppColor','readerThemeDefinition',`${stripped(tokenSource).replace(/^import[^;]+;\s*/gm,'')};return{${tokenNames.join(',')}};`)(readerAppColor,readerThemeDefinition);
const specs=new Function('TextAlign','SOURCE_SWITCH_VISUAL',`${stripped(read('ReaderSurfaceSpecs')).replace(/^import[^;]+;\s*/gm,'')};return{resolvePopupSpec,resolveSheetSpec,resolveDialogSpec,resolveActionSheetSpec,resolveDrawerSpec};`)({Start:'TextAlign.Start',Center:'TextAlign.Center'},SOURCE_SWITCH_VISUAL);
// Finite native color port for the actual per-book SVG stroke actor. Channel
// values come from the registry; this records the native constructor inputs,
// and does not simulate SVG rasterization or claim device pixel acceptance.
const colorRegistry=JSON.parse(readFileSync(new URL('../../../Reader-UI/theme/registry.json',import.meta.url),'utf8'));
const bookIconChannels=new Map(['day','night'].map(scheme=>{
 const c=colorRegistry.appRoles.TOK_DOWNLOAD_GREEN_INK[scheme];
 return[readerAppColor('TOK_DOWNLOAD_GREEN_INK',scheme),{red:c.r,green:c.g,blue:c.b,alpha:Math.round(c.a*255)}];
}));
const boundedColorMetrics={resourceColor:color=>({color,...bookIconChannels.get(color)})};
class BoundedColorFilter {
 constructor(matrix){assert.equal(matrix.length,20);assert.ok(matrix.every(Number.isFinite),'actual SVG color matrix has finite channels');this.matrix=matrix.slice();}
}
function classOf(source,name,deps){const start=source.indexOf(`export class ${name}`),end=source.indexOf('@Component',start);
  return new Function(...Object.keys(deps),`${stripped(source.slice(start,end))};return ${name};`)(...Object.values(deps));}
/** Test-specific composition: actual SDK emitted children, V1 property classes,
 * shared producer modifiers and mounted slots. Uses the existing compiler helper
 * unchanged. Native scheduling/removal/layout/focus are explicitly outside proof. */
export function boundedSurfaceSdk(options={}){
  const properties=options.properties??createArkUIPropertyRuntimeProbe();
  const childSources=Object.fromEntries(['ReaderRecoveryAction','ReaderRecoveryNotice','ReaderPageState','ReaderBoundedSurface','ReaderBoundedSurfaceHeader','ReaderBoundedSurfaceActions','ReaderActionMenuSurface','ReaderActionSheetContent'].map(n=>[n,options[n]??read(n)]));
  const typography = {...readerTypographyRoles,...options.typographyRoles};
  const ReaderMenuActionView=classOf(childSources.ReaderActionMenuSurface,'ReaderMenuActionView',{});
  const nativePan = options.panGesture ?? new Proxy({}, {get:()=>()=>{}});
  const nativeGesture = new Proxy({}, {get:()=>()=>{}});
  const deps={...properties.sdk,...specs,...tokens,...typography,...readerFonts,readerAppColor,ReaderInsetsVp,ReaderMenuActionView,
    ColorMetrics:boundedColorMetrics,ColorFilter:BoundedColorFilter,
    PanGesture:nativePan, PanDirection:{Vertical:'vertical'}, GesturePriority:{Low:'low'},
    globalThis:{Gesture:nativeGesture,PanGesture:nativePan},
    ReaderBoundedFrameModifier:classOf(childSources.ReaderBoundedSurface,'ReaderBoundedFrameModifier',{...specs,readerAppColor,ReaderInsetsVp}),
    ReaderBoundedTitleModifier:classOf(childSources.ReaderBoundedSurfaceHeader,'ReaderBoundedTitleModifier',{readerAppColor,...typography}),
    ReaderBoundedFileActionModifier:classOf(childSources.ReaderBoundedSurfaceActions,'ReaderBoundedFileActionModifier',{}),
    ReaderActionSheetAction:classOf(childSources.ReaderActionSheetContent,'ReaderActionSheetAction',{ReaderMenuActionView}),
  };
  const hooks={...properties.hooks,childSources,mountChildren:true,lifecycleChildren:true,allowEmptyBranchAdmission:options.allowEmptyBranchAdmission===true};
  for(const name of Object.keys(childSources))deps[name]=createReaderBuilderProbe(childSources[name],boundedMembers(childSources[name]),deps,hooks).Component;
  const walk=owner=>[owner,...[...owner.children.values()].flatMap(child=>child.nodes?walk(child):[])];
  return {properties,deps,hooks,childSources,walk,nodes:owner=>walk(owner).flatMap(x=>[...x.nodes.values()]),
    consumer(source,names=boundedMembers(source),extra={},initialParams={},componentName){return createReaderBuilderProbe(source,names,{...deps,...extra},{...hooks,initialParams,componentName}).owner;}};
}
