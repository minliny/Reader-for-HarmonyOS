import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as metrics from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';

let emitted;

/** A fresh actual read-port module for each fake-window composition. Only
 * compilation is cached; a fixture can never rebind another fixture's owner. */
export function readerWindowEnvironmentForProbe(readMetrics) {
  if (emitted === undefined) {
    const { ts } = installedEtsCompiler();
    const file = new URL('../../entry/src/main/ets/ui/foundation/ReaderWindowEnvironment.ts', import.meta.url);
    const output = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: String(file), reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    });
    assert.deepEqual(output.diagnostics, [], 'actual readonly environment module emits');
    emitted = output.outputText;
  }
  const exports = {};
  new Function('exports', 'require', emitted)(exports, name => {
    assert.equal(name, './ReaderWindowMetrics', 'the read port depends only on normalized metric types/defaults');
    return metrics;
  });
  if (readMetrics !== undefined) exports.bindReaderWindowMetricsSource(readMetrics);
  return exports;
}
