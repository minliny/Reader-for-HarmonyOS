import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${loader}/node_modules/typescript`), checker = require(`${loader}/lib/ets_checker.js`);
const path = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url).pathname;
function tree(name) { return ts.createSourceFile(path(name), readFileSync(path(name), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function declarations(file, names) { return file.statements.filter(node => names.includes(node.name?.text)).map(node => node.getText(file)).join('\n'); }
function members(file, className, names) {
  const owner = file.statements.find(node => node.name?.text === className);
  return names.map(name => {
    const member = owner.members.find(node => node.name?.getText(file) === name);
    assert.ok(member, `${className}.${name} is taken from production`);return member.getText(file);
  }).join('\n');
}
const runtime = tree('app/ReaderRuntimeOwner.ts'), body = tree('app/ReadingBodyImageHost.ts');
const gatewayContract = tree('features/reading/ReadingGatewayRuntime.ts'), disk = tree('app/ReadingImageDiskCache.ts');
const gateway = readFileSync(path('features/manga/MangaResourceGateway.ts'), 'utf8').replace(/^import[^;]+;\n/gm, '');
const runtimeInterface = gatewayContract.statements.find(node => node.name?.text === 'ReadingGatewayRuntime');
const apiNames = ['loadReadingImage','prefetchReadingImage','releaseReadingImage','beginMangaDisplaySession','endMangaDisplaySession','tryAcquireMangaPreparedImage'];
const source = `import image from '@ohos.multimedia.image';
${declarations(gatewayContract, ['ReadingGatewayImage','MangaDisplaySessionScope','ReadingGatewayImageCacheIdentity'])}
interface ReadingGatewayRuntime {
${runtimeInterface.members.filter(node => apiNames.includes(node.name?.getText(gatewayContract))).map(node => node.getText(gatewayContract)).join('\n')}
}
${declarations(body, ['ReadingBodyImagePayload'])}
${declarations(disk, ['MangaStorageChapter','ReadingImageCacheIdentity'])}
${declarations(runtime, ['MangaPreparedDisplayPage','MangaDisplaySession'])}
declare class BodyPorts {
  loadMangaBytes(bytes:Uint8Array, chapter:MangaStorageChapter, current?:()=>boolean, position?:number, preview?:boolean,
    priority?:'foreground'|'chapter'|'background'|'download'):Promise<ReadingBodyImagePayload>;
  release(uri:string, pixel?:image.PixelMap):void;
  pathFromFileUri(uri:string):string|undefined;
}
class PreparedBody extends BodyPorts {
${members(body, 'ReadingBodyImageHost', ['displayFileReferences','prepareMangaDisplay','retainPayload','retainMangaDisplay','assertCurrent'])}
}
declare const ReadingBodyImageHost:{instance:PreparedBody};
class PreparedRuntime {
  private state:'new'|'starting'|'ready'|'closing'|'closed'='ready';
  private readingImageDiskCache:{captureValidity(source:string, book:string, current?:()=>boolean):()=>boolean};
  captureReadingContentValidity(source:string, book:string):()=>boolean {throw Error();}
${members(runtime, 'ReaderRuntimeOwner', ['mangaDisplaySessions','nextMangaDisplaySession','assertReadingImageCurrent',
  'beginMangaDisplaySession','endMangaDisplaySession','tryAcquireMangaPreparedImage','mangaDisplaySessionKey','publishMangaPreparedImage'])}
}
${gateway}
`;
const virtualPath = '/tmp/ReaderMangaDisplaySessionsSdk.ts';
const options = { ...checker.compilerOptions,
  ets: { ...checker.compilerOptions.ets, libs: [`${loader}/declarations/index-full.d.ts`] },
  target: ts.ScriptTarget.ES2021, lib: ['lib.es2021.d.ts'], module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, noEmit: true, skipLibCheck: true,
  strictPropertyInitialization: false, allowNonTsExtensions: true,
  needDoArkTsLinter: true, isCompatibleVersion: false, etsLoaderPath: loader };
function check(candidate) {
  const host = ts.createCompilerHost(options), original = host.getSourceFile, exists = host.fileExists;
  host.fileExists = name => name === virtualPath || exists(name);
  host.getSourceFile = (name, version, ...args) => {
    const result = name === virtualPath ? ts.createSourceFile(name, candidate, version, true, ts.ScriptKind.TS, options) : original(name, version, ...args);
    if (result) result.version = '1';return result;
  };
  host.resolveModuleNames = (names, from) => names.map(name => name === '@ohos.multimedia.image' ?
    {resolvedFileName:`${loader}/../../api/@ohos.multimedia.image.d.ts`,extension:ts.Extension.Dts,isExternalLibraryImport:true} :
    ts.resolveModuleName(name, from, options, host).resolvedModule);
  const builder = ts.createSemanticDiagnosticsBuilderProgram([virtualPath, ...checker.readDeaclareFiles()], options, host);
  const format = item => ({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,' ')});
  const semantic = builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(item => item.file?.fileName === virtualPath).map(format);
  const lint = ts.ArkTSLinter_1_1.runArkTSLinter(builder,undefined,()=>{},'1.1').filter(item => item.file?.fileName === virtualPath).map(format);
  return {semantic,lint};
}
assert.deepEqual(check(source), {semantic:[],lint:[]}, 'actual prepared-session methods, complete Gateway and unchanged production payload/API types pass installed SDK semantics and ArkTS lint');
const invalid = source.replace('page.regions.set(regionY, { ...payload, pixelMap: undefined });', "page.regions.set(regionY, 'wrong display');");
assert.notEqual(invalid, source);
assert.ok(check(invalid).semantic.some(item => item.code === 2345), 'official Map/image types reject an invalid prepared descriptor');
console.log('PASS production Body prepared callback/lease methods, Runtime chapter session API and complete resource Gateway: strict installed SDK semantics and ArkTS lint; incompatible descriptor rejected. No HAP/native Image/compositor claim.');
