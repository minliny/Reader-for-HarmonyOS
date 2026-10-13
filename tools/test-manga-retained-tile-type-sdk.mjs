import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Check the complete production lease adapter against the installed official
// platform Map/payload declarations. This is a focused boundary, not a HAP build.
const require = createRequire(import.meta.url);
const loaderRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${loaderRoot}/node_modules/typescript`);
const officialChecker = require(`${loaderRoot}/lib/ets_checker.js`);
const ownerPath = fileURLToPath(new URL('../entry/src/main/ets/features/manga/MangaRetainedTileCache.ts', import.meta.url));
const controllerPath = fileURLToPath(new URL('../entry/src/main/ets/features/manga/MangaSessionController.ts', import.meta.url));
const imagePath = fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReadingGatewayRuntime.ts', import.meta.url));
function declaration(path, name) {
  const tree = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return tree.statements.find(node => node.name?.text === name).getText(tree);
}
const tile = declaration(controllerPath, 'MangaTile');
const image = declaration(imagePath, 'ReadingGatewayImage');
const contractPath = '/tmp/ReaderMangaTileTypeContract.d.ts';
const contract = `import type image from '@ohos.multimedia.image';\n${image}\n${tile}\n`;
const options = { ...officialChecker.compilerOptions,
  ets: { ...officialChecker.compilerOptions.ets, libs: [`${loaderRoot}/declarations/index-full.d.ts`] },
  target: ts.ScriptTarget.ES2021, lib: ['lib.es2021.d.ts'], module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, noEmit: true, skipLibCheck: true,
  allowNonTsExtensions: true, needDoArkTsLinter: true, isCompatibleVersion: false, etsLoaderPath: loaderRoot };
function check(source) {
  const virtual = new Map([[ownerPath, source], [contractPath, contract]]);
  const host = ts.createCompilerHost(options), original = host.getSourceFile, exists = host.fileExists;
  host.fileExists = path => virtual.has(path) || exists(path);
  host.getSourceFile = (path, version, ...rest) => {
    const file = virtual.has(path) ? ts.createSourceFile(path, virtual.get(path), version, true, ts.ScriptKind.TS, options) : original(path, version, ...rest);
    if (file) file.version = '1';
    return file;
  };
  host.resolveModuleNames = (names, from) => names.map(name => {
    if (name === './MangaSessionController') return { resolvedFileName: contractPath, extension: ts.Extension.Dts };
    if (name === '@ohos.util' || name === '@ohos.multimedia.image')
      return { resolvedFileName: `${loaderRoot}/../../api/${name}.d.ts`, extension: ts.Extension.Dts, isExternalLibraryImport: true };
    return ts.resolveModuleName(name, from, options, host).resolvedModule;
  });
  const builder = ts.createSemanticDiagnosticsBuilderProgram([ownerPath, contractPath, ...officialChecker.readDeaclareFiles()], options, host);
  const inputs = new Set([ownerPath, contractPath]);
  const format = item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, ' ') });
  const semantic = builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(item => inputs.has(item.file?.fileName)).map(format);
  const lint = ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, () => {}, '1.1').filter(item => inputs.has(item.file?.fileName)).map(format);
  return { semantic, lint };
}
const production = readFileSync(ownerPath, 'utf8');
assert.deepEqual(check(production), { semantic: [], lint: [] }, 'the actual adapter and unchanged production payload types pass formal SDK types and ArkTS lint');
const invalidLease = production.replace('this.completed.set(key, tile);', "this.completed.set(key, 'wrong payload');");
assert.notEqual(invalidLease, production);
assert.ok(check(invalidLease).semantic.some(item => item.code === 2345), 'the official Map rejects a non-payload chapter lease');
console.log('PASS complete production chapter display owner: official Map/payload types, strict semantic check and ArkTS lint; incompatible lease rejected. No package/native memory/device claim.');
