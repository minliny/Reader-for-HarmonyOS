import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const cases = {
  core: { description: 'Core N-API package declares the vendored SDK type and exactly the paired Core native exports.', resources: [] },
  bookturn: { description: 'Book-turn N-API package declares exactly the native exports and the runtime binds that module name.', resources: [] },
};

function nativeExports(file, name) {
  const source = read(file);
  assert.match(source, new RegExp(`NAPI_MODULE\\(${name},`));
  const descriptors = source.match(/napi_property_descriptor\s+\w+\[\]\s*=\s*\{([\s\S]+?)\n\s*\};/)?.[1];
  assert.ok(descriptors, `${name} has a native descriptor table`);
  return [...descriptors.matchAll(/\{\s*"(\w+)"/g)].map(match => match[1]).sort();
}

for (const id of selectContractCases(cases)) {
  const name = id === 'core' ? 'reader_core_napi' : 'reader_bookturn_napi';
  const binding = `entry/src/main/cpp/types/lib${name}`;
  const packageFile = JSON.parse(read(`${binding}/oh-package.json5`));
  assert.equal(packageFile.name, `lib${name}.so`);
  assert.equal(packageFile.types, './Index.d.ts');
  const declaration = read(`${binding}/Index.d.ts`);

  if (id === 'core') {
    const typeImport = declaration.match(/import type \{ NativeReaderCoreModule \} from '([^']+)';/)?.[1];
    assert.ok(typeImport, 'Core .so imports the already vendored SDK contract');
    const sdk = new URL(`${typeImport}.ts`, new URL(`${binding}/`, root));
    assert.equal(sdk.href, new URL('entry/vendor/core-harmony/sdk/reader_core.ts', root).href);
    assert.match(declaration, /declare const readerCore: NativeReaderCoreModule;\s*export default readerCore;/);
    const type = readFileSync(sdk, 'utf8').match(/export type NativeReaderCoreModule = \{([\s\S]+?)\n\};/)?.[1];
    assert.ok(type, 'the SDK declares the native module contract');
    const methods = [...type.matchAll(/^\s{2}(\w+)\??\(/gm)].map(match => match[1]).sort();
    assert.deepEqual(methods, nativeExports('../Reader-Core/bindings/harmony/native/reader_napi.cpp', name));
    assert.match(read('entry/vendor/core-harmony/Index.ts'), /from 'libreader_core_napi\.so'/);
  } else {
    const methods = [...declaration.matchAll(/^export const (\w+):/gm)].map(match => match[1]).sort();
    assert.deepEqual(methods, nativeExports('entry/src/main/cpp/bookturn/bookturn_napi.cpp', name));
    assert.match(read('entry/src/main/ets/features/reading/ui/BookTurnPresentationSession.ets'), /from 'libreader_bookturn_napi\.so'/);
  }
  recordContractCasePass(id);
}
