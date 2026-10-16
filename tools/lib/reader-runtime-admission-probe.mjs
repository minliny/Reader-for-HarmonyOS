import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const source = readFileSync(new URL('../../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'utf8');
const tree = ts.createSourceFile(virtualFilePath('RuntimeIdentity.ts'),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(tree.parseDiagnostics.length,0);
const declaration = tree.statements.find(node => node.name?.text === 'ReaderRuntimeOwner');
const methods = ['current','isCurrent'].map(name => {const method=declaration.members.find(node=>node.name?.text===name);assert.ok(method,`actual Runtime identity contract ${name}`);return method.getText(tree);}).join('\n');
/** Actual production current/isCurrent methods; only installed instance storage
 * is injected. Constructor/platform startup/dispatch are separate contracts. */
export function runtimeOwnerIdentityProbe(readInstance) {
  return new Function('readInstance',stripTypeScriptTypes(`class ReaderRuntimeOwner { static get instance() { return readInstance(); } ${methods} };`) + ';return ReaderRuntimeOwner;')(readInstance);
}
