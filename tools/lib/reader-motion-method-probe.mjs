import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;

/** Execute unmodified ordinary production methods, not a rewritten algorithm.
 * This does not simulate ArkUI layout, reactive delivery, or compositor pixels. */
export function productionMotionMethods(file, names, dependencies = {}) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile('/tmp/ReaderMotionProbe.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: ETS parses`);
  const type = tree.statements.find(n => n.members && names.every(name => n.members.some(m => m.name?.getText(tree) === name)));
  assert.ok(type, `production methods: ${names.join(', ')}`);
  const methods = names.flatMap(name => type.members.filter(m => m.name?.getText(tree) === name).map(m => m.getText(tree))).join('\n');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(`class Probe { ${methods} }`)}; return Probe;`)(...Object.values(dependencies));
}
