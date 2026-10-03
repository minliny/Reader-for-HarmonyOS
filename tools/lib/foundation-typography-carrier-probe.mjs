import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
const req=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
import { labeledIconControls, labeledIconSpecs } from './reader-labeled-icon-action-probe.mjs';
import { foundationControls, foundationSpecs } from './reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { typographyProperties, typographyRoleImports } from './reader-typography-consumer-audit.mjs';
import {DirectoryRuleDraft,readerControlReplaceEndpoint}from'./reader-reading-field-probe.mjs';
import {readerRecoveryView}from'../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import {readerSourceCategoryLabel}from'../../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
const cache=new Map();
const tuple=node=>Object.fromEntries(typographyProperties.filter(p=>Object.hasOwn(node,p)).map(p=>[p,node[p]]));
/** Original actual owner -> real retained SDK component -> real production
 * AttributeModifier -> native tuple. No stand-in component or tuple whitelist. */
export function foundationTypographyCarrier(entry,file,expected,pageSource,targetSource){
 const target=targetSource??readFileSync(new URL('../../'+entry.target.path,import.meta.url),'utf8');
 const key=JSON.stringify([entry,expected,pageSource,target]);if(cache.has(key))return cache.get(key);
 const rolePath=entry.component==='ReaderLabeledIconAction'?'ReaderLabeledIconActionSpecs.ets':'ReaderControlSpecs.ets';
 const specSource=readFileSync(new URL('../../entry/src/main/ets/features/common/'+rolePath,import.meta.url),'utf8');
 const roles=typographyRoleImports(specSource,'ReaderControlSpecs.ets');
 const native=(branch,override={})=>{
  const foundation=foundationControls({specs:foundationSpecs({...readerTypographyRoles,...override}),...(entry.component==='ReaderLabeledIconAction'?{}:{[entry.component==='ReaderButton'?'buttonSource':'fieldSource']:target})});
  const shared=labeledIconControls({foundation,specs:labeledIconSpecs({...readerTypographyRoles,...override}),...(entry.component==='ReaderLabeledIconAction'?{source:target}:{})});
  // SDK field/button source overrides are used by their transform, never just
  // read for a hash. The normal modifier loader also receives actual source.
  const binding=entry.bindingMethod??entry.origin.method;
  const methods=[binding,...(entry.requiredMethods??[])];
  const constants={};
  if(entry.sourceConstants){
   const tree=ts.createSourceFile(file,pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0);
   for(const[name,expectedConstant]of Object.entries(entry.sourceConstants)){
    const declaration=tree.statements.filter(ts.isVariableStatement).flatMap(s=>s.declarationList.declarations).find(d=>d.name.getText(tree)===name);
    assert.ok(declaration&&ts.isNumericLiteral(declaration.initializer),'actual bounded owner constant');assert.equal(declaration.initializer.getText(tree),expectedConstant,'original constant remains bound to actual source');constants[name]=Number(declaration.initializer.text);
   }
  }
  // Each carrier is an independent SDK compilation unit. Preserve the SDK
  // ID registry outside this unit while still rejecting duplicate IDs inside
  // the actual selected production methods; role variants are separate units.
  const ids=req(sdk+'/lib/component_map.js').ID_ATTRS,savedIds=new Map(ids);let owner;
  ids.clear();try{({owner}=createReaderBuilderProbe(pageSource,methods,{...shared.dependencies,...constants,DirectoryRuleDraft,readerControlReplaceEndpoint,readerRecoveryView,readerSourceCategoryLabel,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'}},shared.hooks));}
  finally{ids.clear();for(const[key,value]of savedIds)ids.set(key,value);}
  Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false,facts:{canMutate:true}},...(entry.params??{})});
  if (entry.params?.contentFrameOverride) owner.contentFrame=()=>entry.params.contentFrameOverride;
  if(entry.params?.frameOverride)owner.frame=()=>entry.params.frameOverride;
  if(entry.params?.presentationOverride)owner.presentation=()=>entry.params.presentationOverride;
  if(entry.params?.filterControlWidthOverride!==undefined)owner.filterControlWidth=()=>entry.params.filterControlWidthOverride;
  if(entry.params?.actionBottomInsetOverride!==undefined)owner.actionBottomInset=()=>entry.params.actionBottomInsetOverride;
  const args=(branch.arguments??entry.arguments).map(arg=>arg==='@callback'?()=>{}:arg==='@value'?()=>entry.nativeText:arg);
  if(binding==='build')owner.initialRender();else owner[binding](...args);
  const children=[...owner.children.values()].filter(child=>child instanceof shared.dependencies[entry.component]&&child.specId===(branch.specId??entry.specId)&&(!entry.nativeText||(entry.component==='ReaderFormField'?child.text:child.label)===entry.nativeText));
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
 const result={kind:expected.kind,method:entry.target.method,text:entry.target.text,producerPath:entry.target.path,producerRolePath:'entry/src/main/ets/features/common/'+rolePath,producerProof:'actual owner -> real SDK common control -> production modifier -> native tuple/role propagation',modifiers:Object.fromEntries(Object.entries(expected.changes).map(([p,expression])=>[p,{expression,extra:expected.extra[p]}]))};cache.set(key,result);return result;
}
