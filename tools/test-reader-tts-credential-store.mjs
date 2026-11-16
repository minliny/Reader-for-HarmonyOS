import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { isReaderTtsCredentialAliasForConfig } from '../entry/src/main/ets/features/reading/application/ReaderOnlineTtsProfile.ts';

const definitions = {
  'create-capacity': { description: 'Actual credential Store: official single SECRET byte limit, UTF-8 boundary and unchanged immutable aliases', resources: [] },
  'read-capacity': { description: 'Actual credential Store: bounded UTF-8 decode, existing alias ownership and no destructive read recovery', resources: [] },
};

function fixture() {
  const records = new Map(), calls = [];
  let sequence = 0;
  const asset = {
    Tag: { ALIAS: 'alias', SECRET: 'secret', RETURN_TYPE: 'return', ACCESSIBILITY: 'access', CONFLICT_RESOLUTION: 'conflict' },
    ReturnType: { ALL: 'all' }, Accessibility: { DEVICE_POWERED_ON: 'powered-on' },
    ConflictResolution: { THROW_ERROR: 'throw' }, ErrorCode: { NOT_FOUND: 24000002 },
    async add(attributes) {
      calls.push('add');
      const bytes = attributes.get('secret');
      // Independent platform contract, not the Store's constant:
      // https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/asset-js-add/
      assert.ok(bytes instanceof Uint8Array && bytes.length >= 1 && bytes.length <= 1024);
      assert.equal(attributes.get('access'), 'powered-on');
      assert.equal(attributes.get('conflict'), 'throw');
      const alias = new TextDecoder().decode(attributes.get('alias'));
      assert.equal(records.has(alias), false, 'immutable alias cannot overwrite a saved credential');
      records.set(alias, bytes.slice());
    },
    async query(attributes) {
      calls.push('query');
      assert.equal(attributes.get('return'), 'all');
      const alias = new TextDecoder().decode(attributes.get('alias'));
      return records.has(alias) ? [new Map([['secret', records.get(alias)]])] : [];
    },
    async remove(attributes) {
      calls.push('remove');
      const alias = new TextDecoder().decode(attributes.get('alias'));
      if (!records.delete(alias)) throw { code: 24000002 };
    },
  };
  const util = {
    TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } },
    TextDecoder: { create: (encoding, options) => ({ decodeToString: bytes => new TextDecoder(encoding, options).decode(bytes) }) },
    generateRandomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  };
  const source = readFileSync(new URL('../entry/src/main/ets/platform/tts/ReaderTtsCredentialStore.ts', import.meta.url), 'utf8');
  const { ts } = installedEtsCompiler();
  const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.deepEqual(emitted.diagnostics, []);
  const deps = { '@kit.AssetStoreKit': { asset }, '@kit.ArkTS': { util },
    '../../features/reading/application/ReaderOnlineTtsProfile.ts': { isReaderTtsCredentialAliasForConfig } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', emitted.outputText)(id => {
    assert.ok(Object.hasOwn(deps, id), `explicit finite dependency: ${id}`); return deps[id];
  }, module, module.exports);
  return { store: new module.exports.ReaderTtsCredentialStore(), records, calls };
}

async function createCapacity() {
  const f = fixture();
  const ascii = 'a'.repeat(1024), multibyte = '界'.repeat(341) + 'a';
  assert.equal(new TextEncoder().encode(multibyte).length, 1024);
  const first = await f.store.create(9, ascii), second = await f.store.create(9, multibyte);
  assert.notEqual(first, second);
  assert.equal(isReaderTtsCredentialAliasForConfig(first, 9), true);
  assert.equal(await f.store.read(first, 9), ascii);
  assert.equal(await f.store.read(second, 9), multibyte);
  const before = [...f.calls], saved = new Map(f.records);
  for (const value of ['a'.repeat(1025), '界'.repeat(341) + 'aa', '界'.repeat(1024)]) {
    await assert.rejects(f.store.create(9, value), /格式无效/);
  }
  assert.deepEqual(f.calls, before, 'oversized UTF-8 must be rejected before AssetStore is called');
  assert.deepEqual(f.records, saved, 'invalid replacement preserves every accepted immutable credential');
  await f.store.remove(first, 9);
  assert.equal(f.records.has(first), false);
  assert.equal(await f.store.read(second, 9), multibyte, 'exact old-alias cleanup preserves its replacement');
}

async function readCapacity() {
  const f = fixture(), alias = await f.store.create(7, 'existing-key');
  const callsBeforeWrongOwner = [...f.calls];
  await assert.rejects(f.store.read(alias, 8), /引用无效/);
  assert.deepEqual(f.calls, callsBeforeWrongOwner, 'foreign configuration never queries the platform');
  for (const value of [new Uint8Array(1025).fill(97), Uint8Array.of(0xff), Uint8Array.of(0)]) {
    f.records.set(alias, value);
    await assert.rejects(f.store.read(alias, 7), /无法读取/);
    assert.equal(f.records.has(alias), true, 'failed read cannot delete an unresolved saved credential');
  }
  const multibyte = '界'.repeat(341) + 'a';
  f.records.set(alias, new TextEncoder().encode(multibyte));
  assert.equal(await f.store.read(alias, 7), multibyte);
  assert.equal(f.calls.includes('remove'), false);
}

for (const id of selectContractCases(definitions)) {
  if (id === 'create-capacity') await createCapacity();
  if (id === 'read-capacity') await readCapacity();
  recordContractCasePass(id);
}
