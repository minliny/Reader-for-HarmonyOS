import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"bookshelf": {"description": "管理页当前font-size表达式", "resources": []}, "rules": {"description": "规则页当前font-size表达式", "resources": []}, "sync": {"description": "同步页当前font-size表达式", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {auditTypographyConsumers,typographyExpressionContext,isSharedTypographyExpression} = await import('./lib/reader-typography-consumer-audit.mjs');

const files={bookshelf:'features/bookshelf/BookshelfManagementPage.ets',rules:'features/settings/RulesManagementPage.ets',sync:'features/sync/SyncPage.ets'};
const file='entry/src/main/ets/'+files[selectedCase],source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
function verify(text) {
 const context=typographyExpressionContext(text,file),nodes=auditTypographyConsumers(text,file).filter(n=>n.modifiers.fontSize);
 assert.ok(nodes.length,'selected actual consumer owns typography');
 for(const node of nodes)assert.ok(isSharedTypographyExpression(node.modifiers.fontSize.expression,context,node.owner),'private selected font-size expression: '+node.modifiers.fontSize.expression);
 return nodes;
}
const nodes=verify(source),slot=nodes[0].modifiers.fontSize;
const mutant=source.slice(0,slot.start)+'99'+source.slice(slot.end);assert.notEqual(mutant,source);
assert.throws(()=>verify(mutant),/private selected font-size/,'same-count literal is rejected by actual AST expression proof');

}
