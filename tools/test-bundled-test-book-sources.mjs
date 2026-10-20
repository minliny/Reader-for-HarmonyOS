import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"supply-record-admission": {"description": "当前供应记录最小格式准入，不将历史verdict当新证据", "resources": []}, "startup-nonblocking-binding": {"description": "当前startRuntime实际AST ready之后不await source seed及两反例", "resources": []}, "packaged-input-binding": {"description": "当前rawfile字节与runtime声明SHA/文件名绑定", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {

const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const rawFile='entry/src/main/resources/rawfile/reader-tested-book-source-collection.json';
if(selectedCase==='supply-record-admission') {
 const {assertSourceLoginDefault}=await import('./source-login-default-policy.mjs');
 const sources=JSON.parse(read(rawFile));assert.ok(Array.isArray(sources));
 const builtinIds=new Set();
 for(const [index,source] of sources.entries()) {
  const label=`declared bundled record ${index}`;assertSourceLoginDefault(source);
  assert.equal(typeof source.bookSourceUrl,'string');assert.ok(source.bookSourceUrl.startsWith('https://'));
  assert.equal(typeof source.bookSourceName,'string');assert.ok(source.bookSourceName.trim());
  assert.equal(typeof source.enabled,'boolean');assert.equal(typeof source.defaultEnabled,'boolean');
  assert.ok(Number.isSafeInteger(source.builtinVersion)&&source.builtinVersion>=1);
  assert.match(source.builtinId,/^reader-builtin-[a-z0-9-]+$/);assert.ok(!builtinIds.has(source.builtinId),label+' duplicate builtinId');builtinIds.add(source.builtinId);
  assert.match(source.ruleFingerprint,/^[0-9a-f]{64}$/);assert.equal(typeof source.provenance?.origin,'string');
 }
 console.log('declared source record format PASS; historical verdict/live source behavior NOT_RUN');
}
if(selectedCase==='startup-nonblocking-binding') {
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
 const {ts}=installedEtsCompiler();
 const owner=read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
function sourceStartsAfterReady(text) {
  const ast = ts.createSourceFile('ReaderRuntimeOwner.ts', text, ts.ScriptTarget.Latest, true);
  assert.equal(ast.parseDiagnostics.length, 0);
  const type = ast.statements.find(node => node.name?.text === 'ReaderRuntimeOwner');
  const start = type.members.find(node => node.name?.getText(ast) === 'startRuntime');
  const assignments = [];
  const sourceCalls = [], waits = [];
  const visit = node => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      assignments.push({ target: node.left.getText(ast), value: node.right.getText(ast), position: node.pos });
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'this.installBundledBookSourceCollection')
      sourceCalls.push(node);
    if (ts.isAwaitExpression(node) && /installBundledBookSourceCollection|sourceSupplyTask/.test(node.expression.getText(ast))) waits.push(node);
    ts.forEachChild(node, visit);
  };
  visit(start.body);
  const runtime = assignments.find(node => node.target === 'this.runtime' && node.value === 'runtime');
  const ready = assignments.find(node => node.target === 'this.state' && node.value === "'ready'");
  assert.ok(runtime && ready && sourceCalls.length === 1);
  assert.ok(runtime.position < ready.position && ready.position < sourceCalls[0].pos,
    'bundled-source seeding follows the exact runtime and ready publication');
  assert.equal(waits.length, 0, 'source seeding must never become an awaited first-page prerequisite');
}
sourceStartsAfterReady(owner);
assert.throws(() => sourceStartsAfterReady(owner.replace("      this.state = 'ready';", '')),
  /false|ready/, 'a runtime without ready publication is rejected');
assert.throws(() => sourceStartsAfterReady(owner.replace('this.sourceSupplyTask = this.installBundledBookSourceCollection(runtime)',
  'this.sourceSupplyTask = await this.installBundledBookSourceCollection(runtime)')),
  /awaited first-page prerequisite/, 'an accidentally awaited source task is rejected');

}
if(selectedCase==='packaged-input-binding') {
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts}=installedEtsCompiler();
 const {createHash}=await import('node:crypto');
 const owner=read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
 function constants(source) {const ast=ts.createSourceFile('ReaderRuntimeOwner.ts',source,ts.ScriptTarget.Latest,true);assert.equal(ast.parseDiagnostics.length,0);const values=new Map();for(const st of ast.statements) if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(ts.isStringLiteral(d.initializer))values.set(d.name.getText(ast),d.initializer.text);return values;}
 const values=constants(owner);assert.equal(values.get('BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE'),rawFile.split('/').at(-1));
 assert.equal(values.get('BUNDLED_RAW_FILE_SHA256'),createHash('sha256').update(read(rawFile)).digest('hex'),'exact current packaged bytes match current runtime declaration');
 const bad=owner.replace(values.get('BUNDLED_RAW_FILE_SHA256'),'0'.repeat(64));assert.notEqual(constants(bad).get('BUNDLED_RAW_FILE_SHA256'),createHash('sha256').update(read(rawFile)).digest('hex'));
 console.log('runtime input declaration binding PASS; HAP content/native import behavior NOT_RUN');
}

}
