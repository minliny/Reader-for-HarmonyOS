import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as themeRegistry from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as layoutTokens from '../../entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';

const { ts } = installedEtsCompiler();
const source = readFileSync(new URL('../../entry/src/main/ets/ui/foundation/ReaderTokens.ets', import.meta.url), 'utf8');
const tokenModule = ts.transpileModule(source, {
  fileName: 'ReaderTokens.ets', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
});
assert.deepEqual(tokenModule.diagnostics, [], 'production ReaderTokens emits with its re-exports');
const dependencies = { './ReaderThemeRegistry': themeRegistry, './ReaderLayoutTokens': layoutTokens };
export const readerFoundationTokens = {};
new Function('exports', 'require', tokenModule.outputText)(readerFoundationTokens, name => {
  assert.ok(Object.hasOwn(dependencies, name), `unbound ReaderTokens dependency: ${name}`);
  return dependencies[name];
});
