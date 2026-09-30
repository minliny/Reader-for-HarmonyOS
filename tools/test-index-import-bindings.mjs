import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sdk = process.env.OHOS_SDK_HOME ?? '/Applications/DevEco-Studio.app/Contents/sdk/default';
const require = createRequire(import.meta.url);
const loader = `${sdk}/openharmony/ets/build-tools/ets-loader`;
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
const directoryImport = imports.find(text => text.includes("from '../features/reading/ReaderDirectoryNavigation'"));
assert.ok(directoryImport);
const conflicts = bindingConflicts([...imports, directoryImport]);
for (const name of ['backfillRetainedReaderDirectoryNavigation', 'readerDirectoryObserveMissingNavigation',
  'readerDirectoryTakeMissingNavigation']) {
  assert.ok(conflicts.some(message => message.includes(name)), `compiler must reject repeated ${name}`);
}
console.log('Index import bindings: PASS (installed compiler; duplicate directory-navigation imports rejected)');
