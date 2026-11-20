import { installedEtsCompiler, emitSdkProbe } from './ets-compiler-runtime.mjs';
import { localFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerNativeAlertButtonCopy } from '../../entry/src/main/ets/app/ReaderNativeAlertButtonCopy.ts';
const { ts } = installedEtsCompiler();
const path = new URL('../../entry/src/main/ets/app/ReaderNativeAlertOwner.ets', import.meta.url);
const source = readFileSync(path, 'utf8');
const output = emitSdkProbe(source, { fileName: localFilePath(path), scriptKind: 'ETS',
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: true } });
const actual = {};
new Function('exports', 'require', output)(actual, name => {
  assert.equal(name, './ReaderNativeAlertButtonCopy', 'only the real finite native button copy adapter is resolved');
  return { readerNativeAlertButtonCopy };
});
export const ReaderNativeAlertOwner = actual.ReaderNativeAlertOwner;
export const ReaderNativeAlertLease = actual.ReaderNativeAlertLease;
