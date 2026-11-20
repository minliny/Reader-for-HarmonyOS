import { createRequire } from 'node:module';
import path from 'node:path';
import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';

/** One installed SDK loader for probes. Dialect, target, module format and
 * injected business dependencies remain explicit at each call site. Node's
 * module cache is keyed by the resolved SDK path, never by the first host. */
export function installedEtsCompiler(root = resolveEtsLoaderRoot()) {
  const require = createRequire(path.join(root, 'package.json'));
  return {
    root,
    require,
    ts: require(path.join(root, 'node_modules/typescript')),
    get options() { return require(path.join(root, 'lib/ets_checker.js')).compilerOptions; },
  };
}

/** SDK parsing/emission only. Callers retain module execution and business fakes. */
export function emitSdkProbe(source, { fileName, parseSource = source, scriptKind = 'TS', compilerOptions,
  compiler = installedEtsCompiler() }) {
  const { ts, options } = compiler;
  assert.ok(['TS', 'ETS'].includes(scriptKind), 'select the actual probe language');
  const tree = ts.createSourceFile(fileName, parseSource, ts.ScriptTarget.Latest, true,
    ts.ScriptKind[scriptKind], ...(scriptKind === 'ETS' ? [options] : []));
  assert.deepEqual(tree.parseDiagnostics, [], `${fileName}: installed SDK syntax`);
  const emitted = ts.transpileModule(source, { compilerOptions, reportDiagnostics: true, fileName });
  assert.deepEqual(emitted.diagnostics, [], `${fileName}: installed SDK emitter diagnostics`);
  return emitted.outputText;
}
