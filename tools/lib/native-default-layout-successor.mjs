import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {auditNativeTextElements} from './reader-typography-consumer-audit.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const nativeDefaultLayoutSuccessor=JSON.parse(read('tools/fixtures/design/native-default-layout-successor-20261014.json'));
const contract=nativeDefaultLayoutSuccessor,digest=x=>createHash('sha256').update(x).digest('hex'),norm=x=>(x??'').replace(/\s+/g,'');
const previous=JSON.parse(read(contract.previousFixture)).consumers.find(row=>row.id===contract.id);
export function validateNativeDefaultLayoutDefinition(){
assert.equal(contract.schema,1);assert.equal(contract.previousFixture,'tools/fixtures/design/native-default-control-contracts.json');
assert.equal(digest(read(contract.previousFixture)),contract.previousFixtureSha256,'native-default original witness bytes remain immutable');
assert.equal(digest(JSON.stringify(previous)),contract.previousRowSha256,'the exact native family is unchanged');
assert.deepEqual([contract.id,contract.file,contract.previousMethod,contract.currentMethod,contract.host,contract.variant,contract.header,contract.content],
 ['NATIVE-DEFAULT-01','features/bookshelf/BookDirectoryPage.ets','standardPage','standardToolbar','ReaderPageScaffold','directory','standardHeader','standardContent']);
assert.equal(contract.onClick,'(): void => { this.rulesExpanded = !this.rulesExpanded; }','the finite successor retains the original local display-state action');
assert.equal(contract.sdkProof,'tools/test-native-default-control-contracts.mjs');
}
const sdk=resolveEtsLoaderRoot();
const req=createRequire(import.meta.url),ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
export function proveNativeDefaultLayout(source){
 const tree=ts.createSourceFile(contract.file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
 const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='BookDirectoryPage');assert.ok(owner);
 const member=name=>{const m=owner.members.find(m=>m.name?.getText(tree)===name);assert.ok(m,name);return m;};
 const calls=(node,name)=>{const out=[];const walk=n=>{if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)===name)out.push(n);ts.forEachChild(n,walk);};walk(node);return out;};
 const host=calls(member(contract.previousMethod),contract.host);assert.equal(host.length,1,'one exact native family public layout host');
 const props=new Map(host[0].arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));assert.equal(props.get('variant')?.getText(tree),"'directory'");
 for(const slot of['header','content'])assert.equal(calls(props.get(slot),'this.'+contract[slot]).length,1,'actual native family public '+slot+' delegation');
 assert.equal(calls(member(contract.header),'this.'+contract.currentMethod).length,1,'actual shared header mounts the one native toolbar');
 const nodes=auditNativeTextElements(source,contract.file).filter(n=>n.method===contract.currentMethod&&n.kind===previous.kind&&norm(n.text)===norm(previous.argument));
 assert.equal(nodes.length,1,'one actual retained native family, no copied actor');
 assert.deepEqual(nodes[0].modifiers,{},'all original native typography AUTO omissions remain');
 assert.equal(nodes[0].attributes.attributeModifier,undefined);assert.equal(norm(nodes[0].attributes.onClick),norm(contract.onClick),'same original rules display callback');
 return contract.previousMethod;
}
export function nativeDefaultHistoricalMethod(source,file,node){
 if(file!==contract.file||node.method!==contract.currentMethod||node.kind!==previous.kind||norm(node.text)!==norm(previous.argument))return node.method;
 return proveNativeDefaultLayout(source);
}
