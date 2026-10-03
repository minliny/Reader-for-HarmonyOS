import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { foundationControls, foundationSpecs } from './reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { typographyProperties, typographyRoleImports } from './reader-typography-consumer-audit.mjs';
const cache=new Map();
const tuple=node=>Object.fromEntries(typographyProperties.filter(p=>Object.hasOwn(node,p)).map(p=>[p,node[p]]));
/** Original actual owner -> real retained SDK component -> real production
 * AttributeModifier -> native tuple. No stand-in component or tuple whitelist. */
export function foundationTypographyCarrier(entry,file,expected,pageSource,targetSource){
 const target=targetSource??readFileSync(new URL('../../'+entry.target.path,import.meta.url),'utf8');
 const key=JSON.stringify([entry,expected,pageSource,target]);if(cache.has(key))return cache.get(key);
 const specSource=readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderControlSpecs.ets',import.meta.url),'utf8');
 const roles=typographyRoleImports(specSource,'ReaderControlSpecs.ets');
 const native=(branch,override={})=>{
  const shared=foundationControls({specs:foundationSpecs({...readerTypographyRoles,...override}),[entry.component==='ReaderButton'?'buttonSource':'fieldSource']:target});
  // SDK field/button source overrides are used by their transform, never just
  // read for a hash. The normal modifier loader also receives actual source.
  const binding=entry.bindingMethod??entry.origin.method;
  const methods=[binding,...(entry.requiredMethods??[])];
  const {owner}=createReaderBuilderProbe(pageSource,methods,shared.dependencies,shared.hooks);
  Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false,facts:{canMutate:true}},...(entry.params??{})});
  owner[binding](...(branch.arguments??entry.arguments).map(arg=>arg==='@callback'?()=>{}:arg));
  const children=[...owner.children.values()].filter(child=>child instanceof shared.dependencies[entry.component]&&child.specId===entry.specId);
  assert.equal(children.length,1,entry.id+': actual original owner constructs finite shared class');
  const nodes=shared.nodes(children[0]).filter(node=>node.type===expected.kind);
  assert.equal(nodes.length,1,entry.id+': one actual native carrier');
  return tuple(nodes[0]);
 };
 const original=Object.fromEntries(Object.entries(expected.changes).map(([p,expr])=>[p,new Function(...Object.keys(readerTypographyRoles),'return ('+stripTypeScriptTypes(expr)+');')(...Object.values(readerTypographyRoles))]));
 for(const branch of entry.cases??[{}]){
  const actual=native(branch);assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected.original).sort(),entry.id+': exact AUTO omissions');assert.deepEqual(actual,original,entry.id+': exact immutable original native tuple');
  const role=expected.changes.fontSize.match(/^(TYPE_\w+)\.fontSizeFp$/)?.[1];assert.ok(role&&roles.has(role),entry.id+': actual finite spec role import');
  const changed=native(branch,{[role]:{...readerTypographyRoles[role],fontSizeFp:readerTypographyRoles[role].fontSizeFp+2}});
  assert.deepEqual(changed,{...actual,fontSize:actual.fontSize+2},entry.id+': real role propagation through spec/owner/native');
 }
 const result={kind:expected.kind,method:entry.target.method,text:entry.target.text,producerPath:entry.target.path,producerRolePath:'entry/src/main/ets/features/common/ReaderControlSpecs.ets',producerProof:'actual owner -> real SDK common control -> production modifier -> native tuple/role propagation',modifiers:Object.fromEntries(Object.entries(expected.changes).map(([p,expression])=>[p,{expression,extra:expected.extra[p]}]))};cache.set(key,result);return result;
}
