import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({ 'critical-focus-frame': {
  description: 'Actual13 focus callback classes execute their owner action in the next frame and keep optional idle delivery free of duplicate critical work', resources: [],
} });
const producers = [
  ['ui/controls/ReaderToggle.ets', 'ReaderToggleFocusFrame'],
  ['ui/controls/ReaderSearchField.ets', 'ReaderSearchFocusFrame'],
  ['app/composition/JsonImportDialog.ets', 'JsonImportFocusFrame'],
  ['features/reading/ui/ReaderControlReplaceContent.ets', 'ReaderReplaceEditorFocusFrame'],
  ['features/reading/ui/LocalBookDetail.ets', 'DetailDirectoryFocusFrame'],
  ['features/reading/ui/ReaderFullDirectory.ets', 'DirectoryRulesFocusFrame'],
  ['features/reading/ui/ReaderControlTtsContent.ets', 'ReaderTtsConfigurationFocusFrame'],
  ['features/bookshelf/ui/BookshelfGroupDialog.ets', 'BookshelfGroupFocusFrame'],
  ['features/bookshelf/ui/BookshelfImportScene.ets', 'BookshelfImportFocusFrame'],
  ['features/bookshelf/ui/BookshelfPage.ets', 'BookshelfBookActionFocusFrame'],
  ['features/bookshelf/ui/LocalImportDialog.ets', 'LocalImportSelectionFocusFrame'],
  ['features/search/ui/ReaderLibrarySearchSurface.ets', 'LibrarySearchFocusFrame'],
  ['pages/Index.ets', 'ReaderSourceFocusFrame'],
];
const { ts, options } = installedEtsCompiler();
for (const id of selected) {
  const failures = [];
  for (const [file, name] of producers) {
    const source = readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const declaration = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, 'actual class exists: ' + name);
    const definition = source.slice(declaration.getStart(tree), declaration.end);
    const actual = pureModuleProbe(definition, 'critical-focus/' + name + '.ts', { FrameCallback: class {} }, [name])[name];
    let calls = 0;
    const callback = new actual(() => { calls += 1; });
    callback.onIdle(2000000);
    const idleCalls = calls;
    callback.onFrame(1000000000);
    const frameCalls = calls - idleCalls;
    const result = { file, name, idleCalls, frameCalls, status: idleCalls === 0 && frameCalls === 1 ? 'PASS' : 'FAIL',
      sourceSha256: createHash('sha256').update(source).digest('hex') };
    console.log(JSON.stringify(result));
    if (result.status === 'FAIL') failures.push(name);
  }
  assert.deepEqual(failures, [], 'critical focus cannot wait for the optional greater-than1ms idle window');
  recordContractCasePass(id);
}
