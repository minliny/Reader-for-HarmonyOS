import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
const nativeAttributes=require(sdk+'/lib/component_map.js').COMMON_ATTRS;
const hosts=new Set(['ReaderPageScaffold','ReaderStandardPage','MainTabShell']);

/** The focused Builder transform does not run the whole ArkTS type checker.
 * Keep these exact public slot names checked against the installed SDK's
 * native CustomComponent attributes, including its existing overlay method.
 * Other page/business/native overlay APIs are outside this finite contract. */
export function readerPageBuilderSlots(source,name){
 if(!hosts.has(name))return undefined;
 const tree=ts.createSourceFile(name+'.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.deepEqual(tree.parseDiagnostics,[],'actual public page slot declarations parse');
 const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text===name);assert.ok(owner);
 const slots=owner.members.filter(n=>ts.isPropertyDeclaration(n)&&ts.getAllDecorators(n).some(d=>d.getText(tree)==='@BuilderParam'));
 for(const field of slots)assert.equal(nativeAttributes.has(field.name.getText(tree)),false,
  name+': public BuilderParam collides with a native CustomComponent attribute: '+field.name.getText(tree));
 return new Set(slots.map(field=>field.name.getText(tree)));
}
