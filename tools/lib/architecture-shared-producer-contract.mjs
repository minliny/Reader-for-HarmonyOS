import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript'),options=createRequire(import.meta.url)(sdk+'/lib/ets_checker.js').compilerOptions;
const physical=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','backgroundColor','borderRadius','border','shadow','linearGradient','padding','margin','width','height','constraintSize','opacity','clip','responseRegion']);
const appearance=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','backgroundColor','borderRadius','border','shadow','linearGradient','padding','margin']);
const print=(node,file)=>ts.createPrinter().printNode(ts.EmitHint.Unspecified,node,file);
export function sharedProducerShape(source,file){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0,file+' SDK AST');
 const types=[],declarations=[],styles=[];
 for(const node of tree.statements){
  if(ts.isTypeAliasDeclaration(node))types.push({name:node.name.text,type:print(node.type,tree)});
  if(ts.isStructDeclaration(node)||ts.isClassDeclaration(node))declarations.push({name:node.name.text,
    publicFields:node.members.filter(n=>ts.isPropertyDeclaration(n)&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword)).map(n=>({name:n.name.getText(tree),type:n.type?print(n.type,tree):'',decorators:ts.getAllDecorators(n).map(d=>print(d,tree))}))});
 }
 const walk=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&physical.has(node.expression.name.text)){
  let method=node.parent;while(method&&!ts.isMethodDeclaration(method))method=method.parent;
  let owner=node.parent;while(owner&&!ts.isStructDeclaration(owner)&&!ts.isClassDeclaration(owner))owner=owner.parent;
  styles.push({owner:owner?.name.text??'@module',method:method?.name.getText(tree)??'@module',property:node.expression.name.text,args:node.arguments.map(n=>print(n,tree))});
 }ts.forEachChild(node,walk);};walk(tree);
 // Keep alias resolution and AUTO branch ownership verifiable too. Counting
 // type.fontSizeFp alone cannot prove that `type` still selects public roles.
 const implementation=ts.createPrinter({removeComments:true}).printFile(tree);
 return{types,declarations,styles,implementation};
}
const fontProperties=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing']);
const argumentKey=(method,property,expression)=>JSON.stringify([method,property,expression]);
function canonicalArgument(expression){
 const tree=ts.createSourceFile('/tmp/SharedTypographyArgument.ts','const value = '+expression+';',ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.equal(tree.parseDiagnostics.length,0,'actual producer Typography argument');
 return print(tree.statements[0].declarationList.declarations[0].initializer,tree);
}
/** Aliases are accepted only inside a registered, exact finite producer.
 * Neither a local name `type` nor a common-directory location is a contract. */
export function registeredProducerTypographySlots(source,file,contract){
 const producer=contract.producers.find(p=>p.file===file);
 if(!producer)return{has:()=>false,size:0};
 const shape=sharedProducerShape(source,file);
 assert.deepEqual(shape,producer.shape,'finite shared physical inputs/role bindings changed: '+file);
 const slots=new Set(shape.styles.filter(s=>fontProperties.has(s.property)&&s.args.length)
   .map(s=>argumentKey(s.method,s.property,s.args[0])));
 return{size:slots.size,has:(method,property,expression)=>slots.has(argumentKey(method,property,canonicalArgument(expression)))};
}
const relative=file=>file.replace(/^entry\/src\/main\/ets\//,'');
function edge(element,row){
 const tree=ts.createSourceFile('/tmp/SharedConsumer.ts','const props = '+(element.args[0]??'{}')+';',ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const obj=tree.statements[0]?.declarationList?.declarations[0]?.initializer;
 assert.ok(ts.isObjectLiteralExpression(obj),'actual shared props object: '+row.file+':'+element.line);
 const keys=obj.properties.map(p=>p.name?.getText(tree)??'spread');
 const spec=obj.properties.find(p=>p.name?.getText(tree)==='specId');
 return{file:row.file,method:element.method,component:element.kind,specId:spec?.initializer?print(spec.initializer,tree):null,keys};
}
export function producerConsumerEdges(inventory,name){return inventory.rows.flatMap(row=>row.elements.filter(e=>e.kind===name&&e.customTarget?.endsWith('#'+name+'#build')).map(e=>edge(e,row)));}
/** Exact inputs to existing shared controls from one approved recovery slot.
 * The business owner implementation is not a shared producer/style exemption. */
export function retainedSharedConsumerInputs(inventory,name,file){
 return inventory.rows.filter(row=>row.file===relative(file)).flatMap(row=>row.elements
  .filter(e=>e.kind===name&&e.customTarget?.endsWith('#'+name+'#build'))
  .map(e=>({...edge(e,row),input:canonicalArgument(e.args[0]??'{}')})));
}
export function verifyArchitectureRegistration(inventory,baseline,contract,root,readSource=file=>readFileSync(path.join(root,file),'utf8')){
 assert.equal(createHash('sha256').update(JSON.stringify(baseline.rows)).digest('hex'),contract.legacyBusinessRowsSha256,'legacy100 private budgets cannot be silently raised');
 const producerFiles=new Set(contract.producers.map(p=>p.file));
 const legacyOwners=baseline.sharedOwners.filter(r=>!producerFiles.has(r.file));
 assert.equal(createHash('sha256').update(JSON.stringify(legacyOwners)).digest('hex'),contract.legacySharedOwnersSha256,'shared owner must be an exact legacy owner or a finite producer contract');
 const registry=[...baseline.rows,...(baseline.sharedOwners??[]),...(baseline.uiPolicies??[])];
 assert.equal(new Set(registry.map(r=>r.file)).size,registry.length,'one bounded policy per file');
 for(const row of registry)assert.ok(!row.file.includes('*')&&row.file.startsWith('entry/src/main/ets/'),'no wildcard/source-external exemption');
 const registered=new Set(registry.map(r=>relative(r.file)));
 for(const row of inventory.rows.filter(r=>r.elements.length))assert.ok(registered.has(row.file),'unregistered actual UI file: '+row.file);
 for(const row of baseline.uiPolicies??[]){assert.ok(row.reason?.length>20&&row.owner?.length>0&&row.kind?.length>0,'outside100 needs actual owner/reason');assert.ok(inventory.rows.some(r=>r.file===relative(row.file)&&r.elements.length),'orphan UI policy '+row.file);}
 for(const producer of contract.producers){
  if(producer.registrationKind==='legacy-business-budget'){
    // These three named existing controls retain their immutable historical
    // business rows. This finite map is not a common-directory exemption.
    const exactLegacy = {
      ReaderCard: { backgroundColor: 1 },
      ReaderToggle: { backgroundColor: 1 },
      ReaderSegmentedControl: { fontSize: 1, backgroundColor: 2 },
    };
    assert.ok(Object.hasOwn(exactLegacy, producer.component), 'only the exact existing Card budget or two F04 budgets can bind a producer');
    assert.equal(producer.file, 'entry/src/main/ets/features/common/' + producer.component + '.ets', 'exact existing finite legacy control path');
    assert.equal(producer.id, 'shared-' + producer.component);
    assert.deepEqual(baseline.rows.filter(r=>r.file===producer.file), [{file:producer.file, counts:exactLegacy[producer.component]}], 'exact unchanged finite legacy budget row required');
    assert.equal(baseline.sharedOwners.some(r=>r.file===producer.file), false, 'finite control keeps one policy; no duplicate shared exemption');
  }else{
    assert.equal(producer.registrationKind??'shared-owner','shared-owner','unknown producer registration mode');
    const registration=baseline.sharedOwners.find(r=>r.file===producer.file);assert.equal(registration?.contractId,producer.id,'shared owner must bind exact approved contract');
  }
  assert.ok(producer.specPolicy&&producer.removalProofs.length&&producer.sdkProofs.length,'spec→delete→SDK chain required');
  for(const proof of [...producer.removalProofs,...producer.sdkProofs])assert.ok(readSource(proof).length>0,'actual existing proof: '+proof);
  const shape=sharedProducerShape(readSource(producer.file),producer.file);assert.deepEqual(shape,producer.shape,'finite shared physical inputs/interface changed: '+producer.file);
  for(const spec of producer.specSources??[])assert.deepEqual(sharedProducerShape(readSource(spec.file),spec.file),spec.shape,'finite shared spec source/role bindings changed: '+spec.file);
  const declaration=shape.declarations.find(d=>d.name===producer.component);assert.ok(declaration,'actual shared struct');
  const publicFields=new Set(declaration.publicFields.map(f=>f.name));
  const edges=producerConsumerEdges(inventory,producer.component);assert.ok(edges.length>0,'shared producer must be consumed');
  assert.deepEqual(edges.map(({keys,...e})=>e),producer.consumers.map(({keys,...e})=>e),'actual producer/consumer/spec edges changed: '+producer.id);
  for(const e of edges)for(const key of e.keys)assert.ok(publicFields.has(key),'illegal shared input '+producer.id+':'+key);
  for(const row of inventory.rows)for(const e of row.elements.filter(e=>e.kind===producer.component))assert.equal(e.modifiers.some(m=>(['ReaderCard','ReaderToggle','ReaderSegmentedControl','ReaderIconButton'].includes(producer.component)?physical:appearance).has(m.property)),false,'caller privately overrides shared appearance '+row.file+':'+e.line);
  // A finite domain wrapper must also prove its actual child delegation;
  // registering five incoming callers alone cannot prove shared rendering.
  for(const delegate of producer.delegates??[]){
    assert.equal(delegate.file,'entry/src/main/ets/features/common/'+delegate.component+'.ets','exact shared primitive target');
    const childShape=sharedProducerShape(readSource(delegate.file),delegate.file);
    assert.deepEqual(childShape,delegate.shape,'actual shared delegate implementation changed: '+delegate.component);
    const child=childShape.declarations.find(d=>d.name===delegate.component);assert.ok(child,'actual delegate struct');
    const fields=new Set(child.publicFields.map(field=>field.name));
    const outgoing=producerConsumerEdges(inventory,delegate.component).filter(edge=>edge.file===relative(producer.file));
    assert.deepEqual(outgoing,delegate.consumers,'actual shared delegate edges changed: '+producer.component+'→'+delegate.component);
    assert.ok(outgoing.length>0,'real child consumer required');
    for(const edge of outgoing)for(const key of edge.keys)assert.ok(fields.has(key),'illegal shared delegate input '+key);
  }

 }
 assert.ok((contract.retainedConsumerSlots??[]).length<=1,'one exact existing directory recovery slot, no broad alias exemption');
 for(const slot of contract.retainedConsumerSlots??[]){
  assert.equal(slot.id,'directory-rules-recovery','only the exact approved recovery slot is qualified');
  assert.equal(slot.file,'entry/src/main/ets/features/reading/ReaderDirectoryRules.ets','no UI-path wildcard or new producer exemption');
  assert.ok(baseline.rows.some(row=>row.file===slot.file),'recovery consumer retains its original business budget');
  assert.ok(slot.sdkProofs.length>0,'actual recovery consumer SDK proof required');
  for(const proof of slot.sdkProofs)assert.ok(readSource(proof).length>0,'actual recovery SDK proof');
  assert.deepEqual(slot.components.map(c=>c.component).sort(),['ReaderRecoveryAction','ReaderRecoveryNotice'],'exact existing common controls only');
  for(const child of slot.components){
    assert.equal(child.file,'entry/src/main/ets/features/common/'+child.component+'.ets','exact shared recovery implementation');
    assert.ok(baseline.sharedOwners.some(row=>row.file===child.file),'existing bounded shared owner, no new exemption');
    const shape=sharedProducerShape(readSource(child.file),child.file);assert.deepEqual(shape,child.shape,'retained shared child interface/implementation changed');
    const declaration=shape.declarations.find(d=>d.name===child.component);assert.ok(declaration,'actual shared recovery struct');
    const fields=new Set(declaration.publicFields.map(field=>field.name));
    const inputs=retainedSharedConsumerInputs(inventory,child.component,slot.file);
    for(const input of inputs)for(const key of input.keys)assert.ok(fields.has(key),'illegal retained shared input '+child.component+':'+key);
    assert.deepEqual(inputs,child.consumers,'actual retained recovery input/identity/callback bindings changed');
    assert.equal(inputs.length,child.component==='ReaderRecoveryNotice'?1:4,'all five actual recovery sites required');
    const row=inventory.rows.find(row=>row.file===relative(slot.file));
    for(const element of row.elements.filter(e=>e.kind===child.component))assert.equal(element.modifiers.some(m=>appearance.has(m.property)),false,'recovery caller cannot override common appearance');
  }
 }
 return{budgetRows:baseline.rows.length,sharedOwners:baseline.sharedOwners.length,outsideBudgetPolicies:baseline.uiPolicies.length,uiFiles:inventory.rows.filter(r=>r.elements.length).length,producers:contract.producers.length};
}
