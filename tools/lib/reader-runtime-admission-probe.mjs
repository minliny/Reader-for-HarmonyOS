import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const source = readFileSync(new URL('../../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),'utf8');
const tree = ts.createSourceFile('/tmp/RuntimeIdentity.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(tree.parseDiagnostics.length,0);
const declaration = tree.statements.find(node => node.name?.text === 'ReaderRuntimeOwner');
const methods = ['current','isCurrent'].map(name => {const method=declaration.members.find(node=>node.name?.text===name);assert.ok(method,`actual Runtime identity contract ${name}`);return method.getText(tree);}).join('\n');
/** Actual production current/isCurrent methods; only installed instance storage
 * is injected. Constructor/platform startup/dispatch are separate contracts. */
export function runtimeOwnerIdentityProbe(readInstance) {
  return new Function('readInstance',stripTypeScriptTypes(`class ReaderRuntimeOwner { static get instance() { return readInstance(); } ${methods} };`) + ';return ReaderRuntimeOwner;')(readInstance);
}
