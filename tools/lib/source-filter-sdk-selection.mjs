import assert from 'node:assert/strict';
import {installedEtsCompiler} from './ets-compiler-runtime.mjs';

/** Source fixture boundary: selected page slots plus their actual @Builder
 * references. Ordinary business methods remain explicit caller ports. This
 * selects declarations only; SDK lowering/property execution happens elsewhere. */
export function sourceFilterBuilderMembers(source,{roots=['statusFilter','categoryFilter'],fields=['statusValue','categoryValue']}={}) {
 const {ts,options}=installedEtsCompiler();
 const tree=ts.createSourceFile('SourceManagementPage.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 assert.equal(tree.parseDiagnostics.length,0,'actual whole Source page parses');
 const owner=tree.statements.find(node=>node.name?.text==='SourceManagementPage'&&node.members);
 assert.ok(owner,'actual Source owner');
 const names=new Set([...fields,...roots]),pending=roots.slice();
 const walk=node=>{
  if(ts.isPropertyAccessExpression(node)&&node.expression.kind===ts.SyntaxKind.ThisKeyword){
   const target=owner.members.find(member=>member.name?.getText(tree)===node.name.text);
   if(target&&!names.has(node.name.text)&&ts.getAllDecorators(target).some(d=>d.getText(tree)==='@Builder')){
    names.add(node.name.text);pending.push(node.name.text);
   }
  }
  ts.forEachChild(node,walk);
 };
 while(pending.length){
  const name=pending.pop(),member=owner.members.find(node=>node.name?.getText(tree)===name);
  assert.ok(member,'actual selected filter Builder');walk(member);
 }
 return [...names];
}
