import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolveEtsLoaderRoot, resolveOpenHarmonySdkRoot, resolveArkFrontend, resolveArkUIRuntime,
  localFilePath, localFileUrl, virtualFilePath, requireToolPackage, coreCliPath } from './lib/tool-environment.mjs';

async function resolver(){const directory=mkdtempSync(join(tmpdir(),'reader-tools-resolver-'));try{
  const sdk = join(directory, 'SDK with spaces 中文#', 'openharmony');
  const loader = join(sdk, 'ets/build-tools/ets-loader'); mkdirSync(loader, { recursive: true });
  const env = { READER_ETS_LOADER_ROOT: loader };
  assert.equal(resolveEtsLoaderRoot({ env }), loader);
  assert.equal(resolveOpenHarmonySdkRoot({ env }), sdk);
  assert.equal(coreCliPath(directory, { env: {}, platform: 'win32' }), join(directory, 'target/debug/reader-cli.exe'));
  assert.equal(coreCliPath(directory, { env: { CARGO_TARGET_DIR: 'custom target' }, platform: 'linux' }), join(directory, 'custom target/debug/reader-cli'));
  assert.equal(coreCliPath(directory, { env: { READER_CORE_CLI: join(directory, 'explicit cli') } }), join(directory, 'explicit cli'));
  assert.throws(() => resolveEtsLoaderRoot({ env: { READER_ETS_LOADER_ROOT: join(directory, 'missing') } }), /not found|does not exist|unavailable|available|invalid/i);
  assert.equal(localFilePath(pathToFileURL(join(directory, 'space 中文#%.ets'))), join(directory, 'space 中文#%.ets'));
  assert.equal(localFileUrl(join(directory, 'space 中文#%.ets')).href, pathToFileURL(join(directory, 'space 中文#%.ets')).href);
  assert.equal(localFilePath(new URL('file:///C:/SDK%20space/%E4%B8%AD%E6%96%87.ets'), { windows: true }), 'C:\\SDK space\\中文.ets');
  assert.equal(virtualFilePath('Probe.ets'), join(tmpdir(), 'Probe.ets').replaceAll('\\', '/'));
  for (const [platform, host, executable, runtime] of [
    ['darwin', 'mac', 'es2abc', 'libace_compatible.dylib'],
    ['linux', 'linux', 'es2abc', 'libace_compatible.so'],
    ['win32', 'win', 'es2abc.exe', 'libace_compatible.dll'],
  ]) {
    const frontend = join(loader, 'bin/ark', `build-${host}`, 'bin', executable);
    mkdirSync(join(frontend, '..'), { recursive: true }); writeFileSync(frontend, 'probe');
    const library = join(sdk, 'previewer/common/bin', runtime);
    mkdirSync(join(library, '..'), { recursive: true }); writeFileSync(library, 'probe');
    assert.equal(resolveArkFrontend({ env, platform }), frontend);
    assert.equal(resolveArkUIRuntime({ env, platform }), library);
  }
  assert.throws(() => resolveArkFrontend({ env, platform: 'unsupported' }), /does not support/);
  assert.throws(() => resolveArkUIRuntime({ env: { ...env, READER_ARKUI_PREVIEW_RUNTIME: join(directory, 'missing') } }), /unavailable/);
}finally{rmSync(directory,{recursive:true,force:true});}}
async function packageAnchor(){const directory=mkdtempSync(join(tmpdir(),'reader-tools-package-'));try{
  const dependencies = join(directory, 'dependency anchor', 'node_modules/reader-tool-fixture');
  mkdirSync(dependencies, { recursive: true });
  writeFileSync(join(dependencies, 'package.json'), JSON.stringify({ name: 'reader-tool-fixture', main: 'index.cjs' }));
  writeFileSync(join(dependencies, 'index.cjs'), 'module.exports = { actual: true };');
  assert.deepEqual(requireToolPackage('reader-tool-fixture', dependencies), { actual: true });
  assert.throws(() => requireToolPackage('reader-tool-fixture', join(directory, 'missing')), /does not exist/);

}finally{rmSync(directory,{recursive:true,force:true});}}
async function pathPolicy(file) {
 const {readFileSync}=await import('node:fs');const {createRequire}=await import('node:module');
 const ts=createRequire(import.meta.url)(resolveEtsLoaderRoot()+'/node_modules/typescript');
 function violations(source,name) {const tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(tree.parseDiagnostics.length,0);const found=[];const walk=node=>{if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&/(?:\/Users\/|\/private\/tmp\/|\/opt\/homebrew\/|[A-Z]:\\Users\\)/i.test(node.text))found.push(node.text);ts.forEachChild(node,walk);};walk(tree);return found;}
 assert.deepEqual(violations('// historical /Users/author/cache\nconst path=resolve(root,"sdk");','comment.mjs'),[],'comments are not executable path literals');
 assert.equal(violations('const path="/Users/author/cache";','literal.mjs').length,1,'the policy rejects an executable author path');
 const path=new URL(file,import.meta.url);assert.deepEqual(violations(readFileSync(path,'utf8'),path.pathname),[],file+' must use the discovery seam');
}
const cases={resolver,'package-anchor':packageAnchor,'path-resolver':()=>pathPolicy('./lib/tool-environment.mjs'),'path-compiler':()=>pathPolicy('./lib/ets-compiler-runtime.mjs'),'path-builder':()=>pathPolicy('./lib/reader-control-builder-probe.mjs')};
for(const id of selectContractCases({resolver:'Portable tool candidates/overrides and Unicode URL paths','package-anchor':'Package dependency anchor admission','path-resolver':'Explicit maintenance resolver path policy','path-compiler':'Explicit ETS compiler helper path policy','path-builder':'Explicit SDK Builder helper path policy'})){await cases[id]();recordContractCasePass(id);}
