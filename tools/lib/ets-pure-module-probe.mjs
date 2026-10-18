import assert from 'node:assert/strict';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { virtualFilePath } from './tool-environment.mjs';

const { root, ts, options } = installedEtsCompiler();
const factories = new Map();
let compiles = 0, hits = 0;
export const pureModuleProbeStats = () => ({ compiles, hits, entries: factories.size });

/** Cache only official compiler output and an unbound factory. Every call
 * executes it with its current dependencies, creating new functions/classes.
 * Exact source, SDK, parsing/emission options and parameter names bind a hit;
 * changed and malformed mutation controls still enter the real SDK frontend. */
export function pureModuleProbe(source, fileName, dependencies, exports,
  compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }) {
  const parameters = Object.keys(dependencies);
  const file = virtualFilePath(fileName);
  const key = JSON.stringify([root, ts.version, options, compilerOptions, file, source, parameters, exports]);
  let factory = factories.get(key);
  if (factory === undefined) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, [], 'actual pure module parses: ' + fileName);
    let text = source;
    for (const declaration of tree.statements.filter(ts.isImportDeclaration).reverse())
      text = text.slice(0, declaration.getStart(tree)) + text.slice(declaration.end);
    const emitted = ts.transpileModule(text.replace(/^export /gm, ''), {
      fileName: file, reportDiagnostics: true, compilerOptions,
    });
    assert.deepEqual(emitted.diagnostics, [], 'actual pure module SDK emit: ' + fileName);
    factory = new Function(...parameters, emitted.outputText + ';return {' + exports.join(',') + '};');
    if (factories.size >= 128) factories.delete(factories.keys().next().value);
    factories.set(key, factory);
    compiles++;
  } else hits++;
  return factory(...Object.values(dependencies));
}
