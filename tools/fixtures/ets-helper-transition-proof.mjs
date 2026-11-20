// Explicit version-transition proof, never a default gate or business suite.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { installedEtsCompiler, emitSdkProbe } from '../lib/ets-compiler-runtime.mjs';
import { pureModuleProbe, pureModuleProbeStats } from '../lib/ets-pure-module-probe.mjs';
import * as selected from '../lib/selected-production-methods.mjs';
import { virtualFilePath } from '../lib/tool-environment.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = resolve(root, '../evidence/engineering-consolidation');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const versions = [
  ['ets-compiler-runtime.mjs', 'Reader-for-HarmonyOS/tools/lib/ets-compiler-runtime.mjs', '3d3be1c159621d2aac47bb74c973c47dd53ad829d86a91ac4d9bf080bf343762', '5bf138c49a65f451c8e08e2ce4cf2d8459b60fdbca622c30dff92005ab9ef62a'],
  ['ets-pure-module-probe.mjs', 'sync-cold-layout/ets-pure-module-probe.mjs', '44f75944af7b3a8bd8892e040299f63c531a0b0ca38bfe4eb85e0a39dd658f61', 'c192ec93596150761d48de143b25c71da20a55e4e07f560651358af580b398c6'],
  ['selected-production-methods.mjs', 'selected-production-methods.mjs', '5367cda415c89d4a806daa347bdc95df3de37bb0084a3f970fa7402e12b0142a', '10f02e5bc634664ba68b2a64b8b8aa33e9e552339b0af4ab3d39be1dad5173ae'],
  ['reader-motion-method-probe.mjs', 'reader-motion-method-probe.mjs', '707b1a2d8f1d7418dc06adf25919d5ab7d3cf8276583a44299b6f645c1fb3f61', 'fbb0f8bd7d47fcf3a90b504688991a837b12659dc8739e56ce3c4f69df988b24'],
];
const sources = new Map(versions.map(([name, preimage, before, after]) => {
  const old = readFileSync(join(evidence, 'preimages', preimage), 'utf8');
  const current = readFileSync(join(root, 'tools/lib', name), 'utf8');
  assert.equal(digest(old), before, `${name}: exact captured predecessor`);
  assert.equal(digest(current), after, `${name}: exact reviewed candidate`);
  return [name, { old, current }];
}));
// Existing loader API is byte-identical; emitSdkProbe is only additive.
const loader = sources.get('ets-compiler-runtime.mjs');
assert.equal(loader.current.slice(0, loader.current.indexOf('/** SDK parsing/emission only.')).replace("import assert from 'node:assert/strict';\n", '').trimEnd(), loader.old.trimEnd());
const { ts, options, root: sdkRoot } = installedEtsCompiler();
const legacyLoader = (await import('node:module')).createRequire(join(sdkRoot, 'package.json'));
assert.equal(legacyLoader(join(sdkRoot, 'node_modules/typescript')), ts);
assert.equal(legacyLoader(join(sdkRoot, 'lib/ets_checker.js')).compilerOptions, options);
// No business source, injection, method selection or execution changed in the
// motion helper: only its duplicate SDK acquisition was replaced.
const motion = sources.get('reader-motion-method-probe.mjs');
const restored = motion.current.replace("import { installedEtsCompiler } from './ets-compiler-runtime.mjs';\n", '')
  .replace("import { virtualFilePath }", "import { resolveEtsLoaderRoot, virtualFilePath }")
  .replace("{ stripTypeScriptTypes, registerHooks }", "{ createRequire, stripTypeScriptTypes, registerHooks }")
  .replace("import {bookshelfSourceDisplayName}", "const require = createRequire(import.meta.url);\nimport {bookshelfSourceDisplayName}")
  .replace('const { ts, options } = installedEtsCompiler();', 'const sdk = resolveEtsLoaderRoot();\nconst ts = require(`${sdk}/node_modules/typescript`);\nconst options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;');
assert.equal(restored, motion.old, 'complete motion business assembly unchanged');

const emitted = [];
for (const relative of ['features/settings/SettingsGateway.ts', 'features/reading/ReaderDirectoryHost.ts', 'features/reading/ReadingOfflineHost.ts', 'features/settings/RulesMutationOwner.ts']) {
  const source = readFileSync(join(root, 'entry/src/main/ets', relative), 'utf8');
  const fileName = virtualFilePath('VersionTransition_' + relative.split('/').at(-1));
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  let body = source;
  for (const node of tree.statements.filter(ts.isImportDeclaration).reverse()) body = body.slice(0, node.getStart(tree)) + body.slice(node.end);
  body = body.replace(/^export /gm, '');
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None };
  const before = ts.transpileModule(body, { compilerOptions, reportDiagnostics: true, fileName });
  assert.deepEqual(before.diagnostics, []);
  const after = emitSdkProbe(body, { compilerOptions, fileName, parseSource: source, scriptKind: 'ETS' });
  assert.equal(after, before.outputText);
  emitted.push({ source: relative, sourceSha256: digest(source), javascriptSha256: digest(after) });
}
const temp = mkdtempSync(join(tmpdir(), 'reader-helper-api-proof-'));
try {
  const importLegacy = async name => {
    const code = sources.get(name).old.replaceAll("'./ets-compiler-runtime.mjs'", JSON.stringify(pathToFileURL(join(root, 'tools/lib/ets-compiler-runtime.mjs')).href))
      .replaceAll("'./tool-environment.mjs'", JSON.stringify(pathToFileURL(join(root, 'tools/lib/tool-environment.mjs')).href));
    const file = join(temp, name); writeFileSync(file, code); return import(pathToFileURL(file).href);
  };
  const oldPure = await importLegacy('ets-pure-module-probe.mjs');
  const source = 'import {port} from "explicit-fixture-port";\nexport class Counter { static count = 0; value() { return port.value + Counter.count++; } }';
  const run = (probe, stats) => {
    const start = stats();
    const first = probe(source, 'PortCounter.ets', { port: { value: 11 } }, ['Counter']).Counter;
    const second = probe(source, 'PortCounter.ets', { port: { value: 31 } }, ['Counter']).Counter;
    assert.notEqual(first, second); assert.equal(new first().value(), 11); assert.equal(new first().value(), 12); assert.equal(new second().value(), 31);
    assert.equal(stats().compiles - start.compiles, 1); assert.equal(stats().hits - start.hits, 1);
    const mutated = probe(source.replace('port.value +', 'port.value + 5 +'), 'PortCounter.ets', { port: { value: 11 } }, ['Counter']).Counter;
    assert.equal(new mutated().value(), 16);
    assert.throws(() => probe(source + '\nclass Broken { x(: }', 'PortCounter.ets', { port: {} }, ['Counter']));
  };
  run(oldPure.pureModuleProbe, oldPure.pureModuleProbeStats); run(pureModuleProbe, pureModuleProbeStats);
  const oldSelected = await importLegacy('selected-production-methods.mjs');
  const file = join(temp, 'Selected.ts');
  writeFileSync(file, 'export const VALUE = port.value + 1;\nexport class Selected { method(x: number): number { return port.value + x; } }');
  const observations = module => {
    const C = module.selectedProductionMethods(file, 'Selected', ['method'], { port: { value: 5 } });
    const values = module.selectedProductionValues(file, ['VALUE'], { port: { value: 8 } });
    const classes = module.selectedProductionClasses(file, ['Selected'], { port: { value: 13 } });
    return { methods: new C().method(4), value: values.VALUE, classes: new classes.Selected().method(2), methodBody: C.prototype.method.toString(), classBody: classes.Selected.toString() };
  };
  assert.deepEqual(observations(selected), observations(oldSelected));
  writeFileSync(file, 'export class Selected { @Builder method() {} }');
  for (const module of [oldSelected, selected]) assert.throws(() => module.selectedProductionMethods(file, 'Selected', ['method']), /ordinary methods only/);
  assert.throws(() => emitSdkProbe('const value = 1;', { fileName: 'BrokenOriginal.ts', parseSource: 'class Broken { x(: }', scriptKind: 'TS', compilerOptions: { target: ts.ScriptTarget.ES2021 } }));
} finally { rmSync(temp, { recursive: true, force: true }); }
const result = { status: 'PASS', versions: versions.map(([name, , before, after]) => ({ path: 'tools/lib/' + name, before, after })), emitted,
  observations: ['Same installed compiler/options identity', 'Existing loader API unchanged; additive emitter', 'Complete motion helper unchanged after only SDK acquisition normalization', 'Four actual modules identical SDK JavaScript', 'Old/current pure cache keeps dependencies and static classes isolated; changed/malformed source re-enters compiler', 'All three selected ordinary declaration APIs agree; Builder and malformed-original rejection preserved'],
  boundary: 'Generic API/compiler compatibility only. No business qualification, ArkUI native runtime, App build, Core, HDC or device evidence.' };
writeFileSync(join(evidence, 'helper-version-compatibility-proof.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, helperVersions: versions.length, actualModuleEmissions: emitted.length }));
