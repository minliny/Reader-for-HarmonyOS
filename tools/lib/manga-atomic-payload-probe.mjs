import assert from 'node:assert/strict';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const path = new URL('../../entry/src/main/ets/app/MangaAtomicPayloadReader.ets', import.meta.url).pathname;
const ts = require(`${sdk}/node_modules/typescript`);
const ui = require(`${sdk}/lib/process_ui_syntax.js`);
const main = require(`${sdk}/main.js`);
const sdkOptions = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const portPath = new URL('../../entry/src/main/ets/app/MangaAtomicPayloadPort.ts', import.meta.url).pathname;

// The official ETS pass supplies the concurrent directive. Removing a
// decorator ourselves would conceal the native taskpool admission contract.
process.env.compileTool = 'rollup';
main.projectConfig.compileMode = 'esmodule';
main.projectConfig.projectPath = new URL('../../entry/src/main/ets/', import.meta.url).pathname;
main.projectConfig.processTs = false;
const source = readFileSync(path, 'utf8');
const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, sdkOptions);
assert.deepEqual(file.parseDiagnostics, [], 'actual Concurrent ETS source parses with the installed SDK');
const transformed = ts.transform(file, [ui.processUISyntax(null, true)], sdkOptions);
export const mangaAtomicPayloadSdkSource = ts.createPrinter().printFile(transformed.transformed[0]);
transformed.dispose();
assert.deepEqual(ui.transformLog.errors, [], 'official Concurrent transform has no diagnostics');
assert.match(mangaAtomicPayloadSdkSource, /function readMangaAtomicPayloadOwned\([^]*?\{\s*"use concurrent";/,
  'official SDK must mark the unchanged AtomicFile worker as concurrent');

export function checkMangaAtomicPayloadSdk() {
  const root = `${sdk}/../..`, virtualPath = path.replace('.ets', 'SdkCheck.ts');
  const options = { noEmit:true, skipLibCheck:true, moduleResolution:ts.ModuleResolutionKind.NodeJs,
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext, types:[], baseUrl:'/',
    paths:{ '@ohos.*': [`${root}/api/@ohos.*.d.ts`] } };
  const roots = readdirSync(`${sdk}/declarations`).filter(name => name.endsWith('.d.ts')).map(name => `${sdk}/declarations/${name}`);
  const errors = text => {
    const host = ts.createCompilerHost(options), get = host.getSourceFile.bind(host);
    host.getSourceFile = (name, ...args) => name === virtualPath ? ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true) : get(name, ...args);
    return ts.getPreEmitDiagnostics(ts.createProgram([virtualPath, ...roots], options, host))
      .filter(value => value.category === ts.DiagnosticCategory.Error).map(value => ts.flattenDiagnosticMessageText(value.messageText, '\n'));
  };
  assert.deepEqual(errors(mangaAtomicPayloadSdkSource), [], 'actual SDK file/taskpool calls type-check');
  assert.ok(errors(mangaAtomicPayloadSdkSource.replace('readFully()', 'readFully(1)')).length > 0,
    'SDK rejects invalid AtomicFile arguments');
  // Preserve actual module names/extensions and ask the installed SDK's own
  // semantic resolver for the real TS-to-ETS prohibition (28017 / Hvigor
  // 10605999). Flattened worker syntax checks cannot establish this boundary.
  const moduleOptions = { ...sdkOptions, ...options, incremental:false,
    needDoArkTsLinter:true, isCompatibleVersion:false, tsImportSendableEnable:false, etsLoaderPath:sdk };
  const clients = ['ReadingImageDiskCache.ts', 'MangaDisplayRetention.ts'].map(name => new URL(`../../entry/src/main/ets/app/${name}`, import.meta.url).pathname);
  const directionErrors = mutate => {
    const host = ts.createCompilerHost(moduleOptions), get = host.getSourceFile.bind(host);
    if (mutate) host.getSourceFile = (name, ...args) => clients.includes(name) ?
      ts.createSourceFile(name, readFileSync(name, 'utf8').replace("from './MangaAtomicPayloadPort'", "from './MangaAtomicPayloadReader'"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS, moduleOptions) : get(name, ...args);
    const resolved = ts.resolveModuleName('./MangaAtomicPayloadReader', clients[0], moduleOptions, host).resolvedModule;
    assert.equal(resolved?.resolvedFileName, path); assert.equal(resolved?.extension, '.ets', 'official SDK resolves the real worker extension');
    return ts.getPreEmitDiagnostics(ts.createProgram([...clients, path, portPath, ...roots], moduleOptions, host)).filter(value => value.code === 28017);
  };
  assert.deepEqual(directionErrors(false), [], 'actual TS consumers/ETS worker/TS port have legal dependency directions');
  const forbidden = directionErrors(true);
  assert.equal(forbidden.length, 2, 'replaying both former imports must reproduce the exact SDK compile error');
  assert.deepEqual(new Set(forbidden.map(value => value.file.fileName)), new Set(clients));
  const directory = mkdtempSync(join(tmpdir(), 'reader-manga-atomic-sdk-'));
  try {
    const emitted = join(directory, 'actual.ts'), invalid = join(directory, 'invalid.ts');
    writeFileSync(emitted, mangaAtomicPayloadSdkSource); writeFileSync(invalid, 'export const invalid = (;\n');
    const frontend = `${sdk}/bin/ark/build-mac/bin/es2abc`;
    const parse = name => spawnSync(frontend, ['--target-api-version','23','--module','--parse-only',name], { encoding:'utf8' });
    const actual = parse(emitted);
    assert.equal(actual.status, 0, actual.stderr || actual.stdout || String(actual.error));
    assert.notEqual(parse(invalid).status, 0, 'official bytecode frontend rejects invalid syntax');
    for (const name of ['ReadingImageDiskCache.ts', 'MangaDisplayRetention.ts', 'MangaAtomicPayloadPort.ts']) {
      const result = parse(new URL(`../../entry/src/main/ets/app/${name}`, import.meta.url).pathname);
      assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
    }
  } finally { rmSync(directory, { recursive:true, force:true }); }
  console.log('PASS official Concurrent transform, SDK types, real cross-module TS/ETS direction (28017 RED control), and es2abc frontend; no taskpool runtime/HAP/device claim');
}

/** Controlled taskpool dispatch port. The worker and Host envelope are the
 * actual SDK-emitted functions; this adapter proves waits/pins/cancellation,
 * not Harmony scheduling, native AtomicFile recovery or reading performance. */
export function createMangaAtomicPayloadBindingFixture(io, hooks = {}) {
  const fs = { ...io, statSync:io.statSync ?? (name => {
    const value = statSync(name, { bigint:true });
    return { size:Number(value.size), ino:Number(value.ino), mtimeNs:value.mtimeNs, ctimeNs:value.ctimeNs,
      isFile:() => value.isFile() };
  }) };
  const taskpool = { Priority:{ HIGH:1 }, Task:class {
    constructor(worker, ...args) { this.worker = worker; this.args = args; }
  }, SequenceRunner:class {
    tail = Promise.resolve();
    execute(task) {
      const work = this.tail.catch(() => {}).then(async () => {
        await hooks.beforeExecute?.(task.args);
        const result = await Promise.resolve().then(() => task.worker(...task.args));
        const replacement = await hooks.afterExecute?.(task.args, result);
        return replacement === undefined ? result : replacement;
      });
      this.tail = work.then(() => {}, () => {});
      return work;
    }
  } };
  const executable = stripTypeScriptTypes(mangaAtomicPayloadSdkSource.replace(/^import .*?;\n/gm, '').replace(/^export /gm, ''));
  const port = stripTypeScriptTypes(readFileSync(portPath, 'utf8').replace(/^export /gm, ''));
  return new Function('fs', 'taskpool', `${port}\n${executable}\nreturn { readMangaAtomicPayload, installMangaAtomicPayloadReader, bindMangaAtomicPayloadReader };`)(fs, taskpool);
}

export function createMangaAtomicPayloadReaderFixture(io, hooks = {}) {
  const binding = createMangaAtomicPayloadBindingFixture(io, hooks);
  binding.installMangaAtomicPayloadReader();
  return (...args) => { hooks.onAdmission?.(args); return binding.readMangaAtomicPayload(...args); };
}

/** Entry fixtures invoke the unchanged production installer/TS registration,
 * without allocating or reading a payload during Ability initialization. */
export function createMangaAtomicPayloadInstallerFixture(io) {
  return createMangaAtomicPayloadBindingFixture(io).installMangaAtomicPayloadReader;
}
