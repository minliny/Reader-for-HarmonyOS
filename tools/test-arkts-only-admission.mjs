import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"standalone-hook":{"description":"Actual standalone ArkTS guard and instrumented Hvigor hooks; no product build/signing/Native","resources":[]}};
for(const id of selectContractCases(definitions)){await run();recordContractCasePass(id);}
async function run(){
const {default:assert}=await import("node:assert/strict");
const {createRequire}=await import("node:module");
const {readFileSync}=await import("node:fs");
const {installedEtsCompiler}=await import("./lib/ets-compiler-runtime.mjs");
// Explicit hook regression. Runs no Hvigor, compiler, Native or package task.




const guard = createRequire(import.meta.url)('../hvigor/reader-hap-guard.cjs');
for (const name of ['default@CompileArkTS', 'entry:default@CompileArkTS', ':entry:default@CompileArkTS']) {
  assert.equal(guard.isSingleArkTsCompile([name]), true, name);
  assert.equal(guard.needsIdeNativePreflight([name]), false);
}
for (const tasks of [[], ['CompileArkTS'], ['other:default@CompileArkTS'], ['entry:default@CompileArkTS', 'assembleHap'],
  ['entry:default@CompileArkTS', 'entry:default@compileNative'], ['entry:default@CompileArkTS', 'help']]) {
  assert.equal(guard.isSingleArkTsCompile(tasks), false, tasks.join(','));
}
assert.equal(guard.needsIdeNativePreflight(['entry:default@CompileArkTS', 'assembleHap']), true);
assert.equal(guard.needsIdeNativePreflight(['entry:default@compileNative']), true);
for (const name of ['entry:default@compileNative', 'default@ConfigureCmake', 'default@BuildNativeWithCmake',
  'default@BuildNativeWithNinja', 'default@ProcessLibs', 'default@DoNativeStrip', 'default@CacheNativeLibs',
  'default@cleanNative', 'clean', 'assembleHap', 'default@PackageHap', 'default@SignHap']) {
  assert.throws(() => guard.assertArkTsOnlyTaskAllowed(['entry:default@CompileArkTS'], name), /Standalone CompileArkTS/, name);
  assert.doesNotThrow(() => guard.assertArkTsOnlyTaskAllowed(['assembleHap'], name));
}
for (const name of ['default@CompileArkTS', 'default@CompileTS', 'default@CompileJS', 'default@GenerateMetadata']) {
  assert.doesNotThrow(() => guard.assertArkTsOnlyTaskAllowed(['entry:default@CompileArkTS'], name));
}

// Execute the actual registered hvigorfile callbacks with instrumented SDK and
// authority seams; the production classification functions above remain real.
const { ts } = installedEtsCompiler();
const source = readFileSync(new URL('../hvigorfile.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
async function hooks(entries, nested) {
  const callbacks = {}, calls = [], before = [];
  const ide = { pipeline: { preflightIdeNative: env => { assert.equal(env.token, 'lease'); calls.push('native-preflight'); },
    assertIdeSigningUnchanged() {} }, session: {} };
  const task = { getName: () => nested, beforeRun: fn => before.push(fn), afterRun: () => {} };
  const node = { getContext: () => ({}), getAllTasks: () => [task] };
  const hvigor = { afterNodeEvaluate: fn => { callbacks.node = fn; }, taskGraphResolved: fn => { callbacks.graph = fn; },
    buildFinished: fn => { callbacks.finished = fn; }, nodesEvaluated: fn => { callbacks.nodes = fn; },
    getAllNodes: () => [node], getCommandEntryTask: () => entries };
  const shim = { ...guard,
    configureIdeSigning: async () => { calls.push('signing-identity'); return ide; },
    assertReaderHapInvocation: () => { calls.push('package-guard'); },
    beginIdeBuild: async () => { calls.push('lease'); return { token: 'lease' }; },
    finishIdeBuild: () => { calls.push('release'); }, verifyIdeOutput() {} };
  const requires = name => name === '@ohos/hvigor-ohos-plugin' ? { appTasks: {}, OhosPluginId: { OHOS_APP_PLUGIN: 'app' } } :
    name === '@ohos/hvigor' ? { hvigor } : name === './hvigor/reader-hap-guard.cjs' ? shim : (() => { throw Error(name); })();
  new Function('exports', 'require', js)({}, requires);
  await callbacks.graph(); callbacks.nodes();
  try { await before[0](); } catch (error) { calls.push('rejected'); assert.match(error.message, /Standalone CompileArkTS/); }
  callbacks.finished({ getError: () => undefined });
  return calls;
}
const compile = await hooks(['entry:default@CompileArkTS'], 'default@CompileArkTS');
assert.ok(compile.includes('signing-identity')); assert.ok(compile.includes('lease')); assert.ok(compile.includes('release'));
assert.ok(!compile.includes('native-preflight')); assert.ok(!compile.includes('rejected'));
const nested = await hooks(['entry:default@CompileArkTS'], 'default@compileNative');
assert.ok(nested.includes('rejected')); assert.ok(!nested.includes('native-preflight'));
const packaged = await hooks(['assembleHap'], 'default@CompileArkTS');
assert.ok(packaged.includes('signing-identity')); assert.ok(packaged.includes('package-guard'));
assert.ok(packaged.includes('native-preflight')); assert.ok(packaged.includes('lease')); assert.ok(packaged.includes('release'));
console.log('standalone ArkTS hook: signing, shared lease, nested rejection, package preflight PASS');

}
