import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';

// Ordinary method adapter only. It copies AST-selected production declarations,
// never a hand-maintained implementation. Callers supply platform I/O explicitly.
// It does not lower ArkUI Builders or imply native/runtime equivalence.
export function selectedProductionMethods(file, className, names, dependencies = {}) {
  const { ts, options } = installedEtsCompiler();
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(String(file), source, ts.ScriptTarget.Latest, true,
    String(file).endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
  assert.deepEqual(tree.parseDiagnostics, [], 'selected production source parses');
  const owner = tree.statements.find(node => node.name?.text === className && node.members);
  assert.ok(owner, `actual production owner ${className}`);
  const members = names.map(name => {
    const matches = owner.members.filter(member => member.name?.getText(tree) === name);
    assert.equal(matches.length, 1, `one actual declaration ${className}.${name}`);
    assert.ok(!ts.getAllDecorators(matches[0]).some(d => d.getText(tree) === '@Builder'), 'ordinary methods only; Builders require the real SDK lowering probe');
    return matches[0].getText(tree);
  });
  const result = ts.transpileModule(`export class ${className} {\n${members.join('\n')}\n}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true, fileName: 'SelectedProductionMethods.ts',
  });
  assert.deepEqual(result.diagnostics, [], 'selected unchanged production declarations emit');
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), result.outputText)(exports, ...Object.values(dependencies));
  return exports[className];
}

export function selectedProductionValues(file, names, dependencies = {}) {
  const { ts, options } = installedEtsCompiler();
  assert.equal(new Set(names).size, names.length, 'explicit unique module value names');
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(String(file), source, ts.ScriptTarget.Latest, true,
    String(file).endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
  assert.deepEqual(tree.parseDiagnostics, [], 'selected production module parses');
  const declarations = tree.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .filter(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text));
  assert.deepEqual(new Set(declarations.map(declaration => declaration.name.text)), new Set(names), 'all selected module definitions exist');
  const result = ts.transpileModule(declarations.map(declaration => `export const ${declaration.getText(tree)};`).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
    fileName: 'SelectedProductionValues.ts',
  });
  assert.deepEqual(result.diagnostics, [], 'selected unchanged module definitions emit');
  const exports = {};
  new Function('exports', ...Object.keys(dependencies), result.outputText)(exports, ...Object.values(dependencies));
  return Object.fromEntries(names.map(name => [name, exports[name]]));
}

/** Exact finite ordinary classes. Class decorators/implements are metadata at
 * this pure layer; callers needing ArkUI Observed/ObjectLink use SDK runtime. */
export function selectedProductionClasses(file,names,dependencies={}) {
  const {ts,options}=installedEtsCompiler(),source=readFileSync(file,'utf8');
  assert.equal(new Set(names).size,names.length,'explicit unique class names');
  const tree=ts.createSourceFile(String(file),source,ts.ScriptTarget.Latest,true,String(file).endsWith('.ets')?ts.ScriptKind.ETS:ts.ScriptKind.TS,options);
  assert.deepEqual(tree.parseDiagnostics,[],'selected production classes parse');
  const declarations=names.map(name=>{const nodes=tree.statements.filter(n=>ts.isClassDeclaration(n)&&n.name?.text===name);assert.equal(nodes.length,1,`one ordinary production class ${name}`);const node=nodes[0];assert.ok(!node.heritageClauses?.some(h=>h.token===ts.SyntaxKind.ExtendsKeyword),'extends requires explicit full runtime loader');assert.ok(!node.members.some(m=>ts.getAllDecorators(m).length),'decorated members require SDK property runtime');return `export class ${name}{\n${node.members.map(m=>m.getText(tree)).join('\n')}\n}`;});
  const result=ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:'SelectedProductionClasses.ts'});assert.deepEqual(result.diagnostics,[],'selected unchanged ordinary class members emit');const exports={};new Function('exports',...Object.keys(dependencies),result.outputText)(exports,...Object.values(dependencies));return Object.fromEntries(names.map(name=>[name,exports[name]]));
}
