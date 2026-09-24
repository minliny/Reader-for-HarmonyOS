import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';

const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderCustomFontHost.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

const provider = 'file://provider/test.ttf';
const fontBytes = Uint8Array.from([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
const fingerprint = createHash('sha256').update(fontBytes).digest('hex');
const finalPath = `/files/reader-fonts/${fingerprint}.ttf`;
const files = new Map([[provider, fontBytes]]);
const directories = new Set();
const opened = new Map();
let nextFd = 1;
let providerStatSize;
let failNativeLoad = false;
let openedCount = 0;
let retiredCount = 0;

const fileIo = {
  OpenMode: { READ_ONLY: 1, CREATE: 2, READ_WRITE: 4, TRUNC: 8 },
  async stat(path) {
    if (!files.has(path)) throw Error(`missing ${path}`);
    return { size: path === provider && providerStatSize !== undefined ? providerStatSize : files.get(path).length };
  },
  async access(path) { return files.has(path) || directories.has(path); },
  async mkdir(path) { directories.add(path); },
  async open(path, mode) {
    openedCount++;
    if (mode !== 1) files.set(path, new Uint8Array());
    if (!files.has(path)) throw Error(`missing ${path}`);
    const fd = nextFd++;
    opened.set(fd, { path, offset: 0 });
    return { fd };
  },
  async read(fd, buffer) {
    const file = opened.get(fd);
    const data = files.get(file.path);
    const length = Math.min(buffer.byteLength, data.length - file.offset);
    new Uint8Array(buffer).set(data.subarray(file.offset, file.offset + length));
    file.offset += length;
    return length;
  },
  async write(fd, buffer) {
    const file = opened.get(fd);
    const old = files.get(file.path);
    const bytes = new Uint8Array(buffer);
    const next = new Uint8Array(Math.max(old.length, file.offset + bytes.length));
    next.set(old); next.set(bytes, file.offset);
    files.set(file.path, next);
    file.offset += bytes.length;
    return bytes.length;
  },
  async close(file) { opened.delete(typeof file === 'number' ? file : file.fd); },
  async fsync() {},
  async rename(from, to) { files.set(to, files.get(from)); files.delete(from); },
  async unlink(path) { files.delete(path); retiredCount++; },
};
const deps = {
  './ReaderFontLoadHost': { loadReaderFontChecked: async () => {
    if (failNativeLoad) throw Error('native font rejected');
  } },
  '@ohos.file.fs': { default: fileIo },
  '@ohos.file.picker': { default: {
    DocumentSelectOptions: class {},
    DocumentViewPicker: class { async select() { return [provider]; } },
  } },
  '@ohos.file.fileuri': { default: { FileUri: class { constructor(uri) { this.name = uri.split('/').at(-1); } } } },
  '@ohos.security.cryptoFramework': { default: { createMd: () => {
    const hash = createHash('sha256');
    return { async update(input) { hash.update(input.data); }, async digest() { return { data: hash.digest() }; } };
  } } },
  '../features/reading/ReaderAppearanceState': appearance,
};
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(id => deps[id] ?? {}, module, module.exports);
const host = new module.exports.ReaderCustomFontHost({ filesDir: '/files' });

providerStatSize = 33 * 1024 * 1024;
await assert.rejects(host.selectAndRegister(undefined), /between 12 bytes and 32 MiB/);
assert.equal(openedCount, 0, 'oversized provider is rejected before any private copy');
assert.equal(directories.size, 0, 'oversized provider does not create private font storage');

providerStatSize = fontBytes.length - 1;
await assert.rejects(host.selectAndRegister(undefined), /changed or exceeded its import limit/);
assert.equal([...files.keys()].filter(path => path.startsWith('/files/')).length, 0,
  'a provider that grows after stat leaves no staged file');

providerStatSize = undefined;
failNativeLoad = true;
await assert.rejects(host.selectAndRegister(undefined), /native font rejected/);
assert.equal(files.has(finalPath), false, 'failed native load removes only the newly imported hash');

failNativeLoad = false;
const descriptor = await host.selectAndRegister(undefined);
assert.equal(descriptor.filePath, finalPath);
assert.equal(files.has(finalPath), true);

failNativeLoad = true;
await assert.rejects(host.selectAndRegister(undefined), /native font rejected/);
assert.equal(files.has(finalPath), true, 'failed reimport preserves a pre-existing active hash');

await host.retireUnusedFont(descriptor, descriptor);
assert.equal(files.has(finalPath), true, 'active persisted font cannot be retired');
await host.retireUnusedFont(descriptor, undefined);
assert.equal(files.has(finalPath), false, 'a replaced, owned font can be removed after durable admission');
assert.ok(retiredCount >= 3);

const gatewaySource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderAppearanceGateway.ts', import.meta.url), 'utf8');
const gatewayCompiled = ts.transpileModule(gatewaySource, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;
let releaseSave;
const oldFont = new appearance.ReaderCustomFontDescriptor('旧字体', `ReaderCustom_${fingerprint.slice(0, 16)}`,
  finalPath, fingerprint);
const replacementHash = 'b'.repeat(64);
const replacement = new appearance.ReaderCustomFontDescriptor('新字体', `ReaderCustom_${replacementHash.slice(0, 16)}`,
  `/files/reader-fonts/${replacementHash}.ttf`, replacementHash);
const initial = appearance.setReaderAppearanceCustomFont(appearance.createDefaultReaderAppearanceSnapshot(), oldFont);
const store = new ReaderAppearanceStore({
  async load() { return initial; },
  async save() { await new Promise(resolve => { releaseSave = resolve; }); },
});
await store.load();
const retirements = [];
const gatewayDeps = {
  '../../app/ReaderCustomFontHost': { ReaderCustomFontHost: class {
    async retireUnusedFont(old, active) { retirements.push({ old, active }); }
  } },
  '@kit.PerformanceAnalysisKit': { hilog: { warn() {} } },
};
const gatewayModule = { exports: {} };
new Function('require', 'module', 'exports', gatewayCompiled)(id => gatewayDeps[id] ?? {},
  gatewayModule, gatewayModule.exports);
const gateway = new gatewayModule.exports.ReaderAppearanceGateway({
  getAppearanceStore: () => store, getUIAbilityContext: () => ({}),
});
const commit = await gateway.update(current => ({ ...current, customFont: replacement }));
assert.equal(retirements.length, 0, 'old font is retained while new preference write is pending');
while (releaseSave === undefined) await new Promise(resolve => setImmediate(resolve));
releaseSave();
await commit.saved;
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(retirements.map(value => [value.old.filePath, value.active.filePath]),
  [[oldFont.filePath, replacement.filePath]], 'only the durably retired descriptor is handed to cleanup');
console.log('custom font boundary: pre-copy and changing-provider limits, failed-load cleanup, active-font preservation PASS');
