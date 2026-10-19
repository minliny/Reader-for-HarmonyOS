import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"diagnostic-redaction": {"description": "实际错误归类与所选console sink AST正反例", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { diagnosticCodeOf } = await import('../entry/src/main/ets/app/LogPrivacy.ts');
const cases = [
  ['https://user:password@example.test/private?token=secret', 'NETWORK'],
  ['Set-Cookie: sid=private-session-value', 'OPERATION_FAILED'],
  ['Bearer a-private-access-token', 'OPERATION_FAILED'],
  ['ENOSPC while writing /user/private/path', 'NO_SPACE'],
  ['deadline exceeded at https://example.test/?secret=value', 'TIMEOUT'],
  ['parse failed with private body text', 'INVALID_DATA'],
  ['cancelled session=private-session', 'CANCELLED'],
];
for (const [message, expected] of cases) assert.equal(diagnosticCodeOf(message), expected);

const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts,options}=installedEtsCompiler();
function classifiedConsole(source,file){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.ets')?ts.ScriptKind.ETS:ts.ScriptKind.TS,options);assert.deepEqual(tree.parseDiagnostics,[]);
 let count=0;
 const safe=node=>ts.isStringLiteral(node)||ts.isNumericLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||
  ts.isIdentifier(node)&&node.text==='stage'||ts.isCallExpression(node)&&node.expression.getText(tree)==='diagnosticCodeOf'||
  ts.isTemplateExpression(node)&&node.templateSpans.every(span=>safe(span.expression));
 const visit=node=>{if(ts.isCallExpression(node)&&['console.error','console.warn'].includes(node.expression.getText(tree))){count++;assert.ok(node.arguments.length&&[...node.arguments].every(safe),'unclassified public console expression');}ts.forEachChild(node,visit);};visit(tree);return count;
}
for(const name of ['ReadingSessionFlowGateway.ts','ReadingOfflineGateway.ts','ReaderTtsSessionCoordinator.ts']) {
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/'+name,import.meta.url),'utf8');assert.ok(classifiedConsole(source,name)>0,'selected actual gateway owns the audited sinks');
 for(const injection of ["console.warn('failure', error);",'console.error(\n error\n);','console.warn(`failure ${error.message}`);'])assert.throws(()=>classifiedConsole(source+'\n'+injection,name),/unclassified public console/,'quote style, multiline and raw template detail cannot bypass real AST sink check');
}
const ui=readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'utf8');assert.equal(classifiedConsole(ui,'LocalReadingExperience.ets'),0,'selected reading UI has no raw public console sink');

}
