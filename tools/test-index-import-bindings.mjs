import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const loader = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url);
const ts = require(`${loader}/node_modules/typescript`);
const arkOptions = require(`${loader}/lib/ets_checker.js`).compilerOptions;
const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
const tree = ts.createSourceFile('Index.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, arkOptions);
assert.equal(tree.parseDiagnostics.length, 0, 'the actual entry page must parse');
const imports = tree.statements.filter(ts.isImportDeclaration).map(node => node.getText(tree));

// Bind the production import surface with the installed compiler. Resolving the
// app/ArkUI graph belongs to the real HAP build; missing-module errors here are
// unrelated to duplicate local bindings and are deliberately not interpreted.
function bindingConflicts(statements) {
  const filename = '/reader-entry-imports.ts';
  const content = statements.join('\n');
  const options = { noEmit: true, noResolve: true, noLib: true, target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = name => name === filename
    ? ts.createSourceFile(filename, content, options.target, true) : undefined;
  host.fileExists = name => name === filename;
  host.readFile = name => name === filename ? content : undefined;
  const program = ts.createProgram([filename], options, host);
  return program.getSemanticDiagnostics().filter(d => [2300, 2440].includes(d.code))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

assert.deepEqual(bindingConflicts(imports), [], 'production entry imports must have unique bindings');
const directoryImport = tree.statements.filter(ts.isImportDeclaration)
  .find(node => node.moduleSpecifier.text === '../app/composition/ReaderDirectoryJourney');
assert.ok(directoryImport, 'Index imports the directory navigation owner');
const conflicts = bindingConflicts([...imports, directoryImport.getText(tree)]);
assert.ok(conflicts.some(message => message.includes('ReaderDirectoryJourney')),
  'compiler must reject the repeated directory navigation owner');
console.log('Index import bindings: PASS (installed compiler; duplicate directory-navigation imports rejected)');
