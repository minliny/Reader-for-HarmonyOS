import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { virtualFilePath } from './tool-environment.mjs';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { foundationControls, readerFoundationTokens } from './reader-foundation-control-probe.mjs';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const read=name=>readFileSync(new URL('../../entry/src/main/ets/features/common/'+name+'.ets',import.meta.url),'utf8');
const { root: sdk, require, ts, options } = installedEtsCompiler();
export function compileCardSpecs(source=read('ReaderCardSpecs')) {
 const tree=ts.createSourceFile(virtualFilePath('ReaderCardSpecs.ets'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0);
 for(const node of tree.statements.filter(ts.isImportDeclaration).reverse())source=source.slice(0,node.getStart(tree))+source.slice(node.end);
 const js=ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(...Object.keys(readerFoundationTokens),js+';return resolveReaderCardSpec;')(...Object.values(readerFoundationTokens));
}
/** The actual installed SDK emits the complete shipping Card and real body
 * Builders. Only ArkUI native properties/layout and fonts use platform seams. */
export function cardSdk({source=read('ReaderCard'),specSource=read('ReaderCardSpecs'),scheme='day'}={}) {
 const foundation=foundationControls(),properties=foundation.properties;
 const resolveReaderCardSpec=compileCardSpecs(specSource);
 // ArkUI's StorageLink obtains the current application value. Supply only
 // that platform lookup while retaining the installed value/dependency class.
 const ActualSimple=properties.sdk.ObservedPropertySimplePU;
 class StorageLinkedSimple extends ActualSimple {constructor(value,owner,name){super(name==='appThemeScheme'?scheme:value,owner,name);}}
 const deps={...foundation.dependencies,...readerFoundationTokens,readerAppColor,resolveReaderCardSpec,ObservedPropertySimplePU:StorageLinkedSimple};
 require(sdk+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderCard',new Set(['content']));
 const childSources={...foundation.hooks.childSources,ReaderCard:source,ReaderSectionHeading:read('ReaderSectionHeading'),ReaderRecoveryAction:read('ReaderRecoveryAction'),ReaderRecoveryNotice:read('ReaderRecoveryNotice')};
 const hooks={...foundation.hooks,childSources,mountChildren:true,lifecycleChildren:true,
  onChildUpdated(){properties.flush();}};
 const card=createReaderBuilderProbe(source,boundedMembers(source),deps,hooks);
 deps.ReaderCard=card.Component;
 for(const name of ['ReaderRecoveryAction','ReaderRecoveryNotice'])deps[name]=createReaderBuilderProbe(childSources[name],boundedMembers(childSources[name]),deps,hooks).Component;
 deps.ReaderSectionHeading=createReaderBuilderProbe(childSources.ReaderSectionHeading,boundedMembers(childSources.ReaderSectionHeading),deps,hooks).Component;
 const walk=owner=>[owner,...[...owner.children.values()].filter(c=>c.nodes).flatMap(walk)];
 return {card,properties,deps,hooks,source,specSource,resolveReaderCardSpec,walk,nodes:owner=>walk(owner).flatMap(x=>[...x.nodes.values()]),
  consumer(source,names=boundedMembers(source),extra={},initialParams={}){return createReaderBuilderProbe(source,names,{...deps,...extra},{...hooks,initialParams}).owner;},
  cards(owner){return walk(owner).filter(x=>x.constructor===card.Component);},
  outer(owner){return [...owner.nodes.values()].find(node=>node.type==='Column'&&Object.hasOwn(node,'borderRadius'));},
  flush(owner){owner.replay();properties.flush();},
 };
}
