import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readerNativeAlertButtonCopy } from '../../entry/src/main/ets/app/ReaderNativeAlertButtonCopy.ts';
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url), ts = require(`${sdk}/node_modules/typescript`);
const path = new URL('../../entry/src/main/ets/app/ReaderNativeAlertOwner.ets', import.meta.url);
const source = readFileSync(path, 'utf8');
const tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
assert.deepEqual(tree.parseDiagnostics, [], 'actual complete native Alert ETS owner parses');
const emitted = ts.transpileModule(source, { fileName: path.pathname, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: true } });
assert.deepEqual(emitted.diagnostics, [], 'actual SDK emits the complete native Alert owner');
const actual = {};
new Function('exports', 'require', emitted.outputText)(actual, name => {
  assert.equal(name, './ReaderNativeAlertButtonCopy', 'only the real finite native button copy adapter is resolved');
  return { readerNativeAlertButtonCopy };
});
export const ReaderNativeAlertOwner = actual.ReaderNativeAlertOwner;
export const ReaderNativeAlertLease = actual.ReaderNativeAlertLease;
