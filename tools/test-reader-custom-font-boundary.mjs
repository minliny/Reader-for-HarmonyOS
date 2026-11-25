import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import * as appearance from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceStore.ts';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import * as publicFixtureScope from '../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts';
const definitions = {
  'font-boundary': { description: 'Full Host bounded import, cleanup, live retirement guard; actual Gateway/Store durable replacement', resources: [] },
  'font-handoff': { description: 'Full Host/Gateway/Store/FontLoadHost: pending A/B/A, actual async file port, checked receipt, cold registration', resources: [] },
};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const drain = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
async function until(predicate, label) { for (let i = 0; i < 300; i++) { if (predicate()) return; await Promise.resolve(); } assert.fail(label); }
function load(path, deps) {
  const { ts } = installedEtsCompiler();
  const source = readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
  const emitted = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.deepEqual(emitted.diagnostics, []);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', emitted.outputText)(id => { assert.ok(Object.hasOwn(deps, id), `explicit dependency ${id}`); return deps[id]; }, module, module.exports);
  return module.exports;
}
function fixture(cached = false) {
  ReaderDocumentPickerActivity.bind(9203); ReaderDocumentPickerActivity.setForeground(true);
  const provider = 'file://provider/test.ttf', bytes = Uint8Array.from([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
  const files = new Map([[provider, bytes]]), directories = new Set(), opened = new Map();
  const state = { statSize: undefined, failLoad: false, openedCount: 0, unlinkGate: undefined, accessGate: undefined, nativeLoads: 0, themeGate: undefined };
  let fd = 0;
  const io = {
    OpenMode: { READ_ONLY: 1, CREATE: 2, READ_WRITE: 4, TRUNC: 8 },
    async stat(path) { assert.ok(files.has(path), 'stat existing'); return { size: path === provider && state.statSize !== undefined ? state.statSize : files.get(path).length }; },
    async access(path) { if (state.accessGate?.path === path) { const gate = state.accessGate; state.accessGate = undefined; gate.wasEntered = true; gate.entered.resolve(); await gate.release.promise; } return files.has(path) || directories.has(path); },
    async mkdir(path) { directories.add(path); },
    async open(path, mode) { state.openedCount++; if (mode !== 1) files.set(path, new Uint8Array()); assert.ok(files.has(path)); const id = ++fd; opened.set(id, { path, offset: 0 }); return { fd: id }; },
    async read(id, buffer) { const f = opened.get(id), data = files.get(f.path), count = Math.min(buffer.byteLength, data.length - f.offset); new Uint8Array(buffer).set(data.subarray(f.offset, f.offset + count)); f.offset += count; return count; },
    async write(id, buffer) { const f = opened.get(id), old = files.get(f.path), bytes = new Uint8Array(buffer), next = new Uint8Array(Math.max(old.length, f.offset + bytes.length)); next.set(old); next.set(bytes, f.offset); files.set(f.path, next); f.offset += bytes.length; return bytes.length; },
    async close(file) { opened.delete(typeof file === 'number' ? file : file.fd); }, async fsync() {},
    async rename(from, to) { assert.ok(files.has(from)); files.set(to, files.get(from)); files.delete(from); },
    async unlink(path) { if (state.unlinkGate?.path === path) { const gate = state.unlinkGate; state.unlinkGate = undefined; gate.wasEntered = true; gate.entered.resolve(); await gate.release.promise; } files.delete(path); },
  };
  const native = async () => { state.nativeLoads++; if (state.failLoad) throw Error('native font rejected'); };
  const fontLoad = cached ? load('ui/platform/ReaderFontLoadHost.ts', { '@ohos.graphics.text': { default: { FontCollection: { getGlobalInstance: () => ({ loadFontWithCheck: native }) } } } }) : { loadReaderFontChecked: native };
  const { ReaderCustomFontHost: Host } = load('app/ReaderCustomFontHost.ts', {
    './diagnostics/ReaderPublicFixtureScope': publicFixtureScope,
    '../platform/ReaderDocumentPickerActivity': { ReaderDocumentPickerActivity }, '../ui/platform/ReaderFontLoadHost': fontLoad,
    '@ohos.file.fs': { default: io }, '@ohos.file.picker': { default: { DocumentSelectOptions: class {}, DocumentViewPicker: class { async select() { return [provider]; } } } },
    '@ohos.file.fileuri': { default: { FileUri: class { constructor(uri) { this.name = uri.split('/').at(-1); } } } },
    '@ohos.security.cryptoFramework': { default: { createMd: () => { const hash = createHash('sha256'); return { async update(input) { hash.update(input.data); }, async digest() { return { data: hash.digest() }; } }; } } },
    '../features/reading/application/ReaderAppearanceState': appearance,
  });
  let currentOwner;
  const { ReaderAppearanceGateway: Gateway } = load('features/reading/application/ReaderAppearanceGateway.ts', {
    '../../../app/ReaderCustomFontHost': { ReaderCustomFontHost: Host },
    '../../../app/ReaderRuntimeOwner': { ReaderRuntimeOwner: { isCurrent: owner => owner === currentOwner } },
    '../../../app/ReaderThemeHost': { ReaderThemeHost: { prepareUserChange: async () => { if(state.themeGate){const gate=state.themeGate;state.themeGate=undefined;gate.wasEntered = true; gate.entered.resolve();await gate.release.promise;} } } },
    './ReaderAppearanceState': appearance, '@kit.PerformanceAnalysisKit': { hilog: { warn() {} } },
  });
  const host = new Host({ filesDir: '/files' });
  const fontPath = data => `/files/reader-fonts/${createHash('sha256').update(data).digest('hex')}.ttf`;
  function gateway(store) { if (!currentOwner) currentOwner = { getAppearanceStore: () => store, getUIAbilityContext: () => ({ filesDir: '/files' }) }; return new Gateway(currentOwner); }
  return { host, Host, Gateway, files, directories, bytes, provider, state, fontPath, gateway, retireOwner: () => { currentOwner = undefined; } };
}
async function boundary() {
  const f = fixture(), path = f.fontPath(f.bytes);
  f.state.statSize = 33 * 1024 * 1024;
  await assert.rejects(f.host.selectAndRegister(undefined), /between 12 bytes and 32 MiB/);
  assert.equal(f.state.openedCount, 0); assert.equal(f.directories.size, 0);
  f.state.statSize = f.bytes.length - 1;
  await assert.rejects(f.host.selectAndRegister(undefined), /changed or exceeded its import limit/);
  assert.equal([...f.files.keys()].filter(p => p.startsWith('/files/')).length, 0);
  f.state.statSize = undefined; f.state.failLoad = true;
  await assert.rejects(f.host.selectAndRegister(undefined), /native font rejected/); assert.equal(f.files.has(path), false);
  f.state.failLoad = false; const a = await f.host.selectAndRegister(undefined);
  f.state.failLoad = true; await assert.rejects(f.host.selectAndRegister(undefined), /native font rejected/);
  assert.equal(f.files.has(path), true, 'failed native reimport preserves preexisting file');
  await f.host.retireUnusedFont(a, () => false); assert.equal(f.files.has(path), true);
  let unused = true; const gate = { path, entered: deferred(), release: deferred() }; f.state.accessGate = gate;
  const retiring = f.host.retireUnusedFont(a, () => unused); await until(() => gate.wasEntered, 'file gate entered'); unused = false; gate.release.resolve(); await retiring;
  assert.equal(f.files.has(path), true, 'guard rechecked after async access');
  const save = deferred(); let persisted = appearance.setReaderAppearanceCustomFont(appearance.createDefaultReaderAppearanceSnapshot(), a);
  const store = new ReaderAppearanceStore({ load: async () => persisted, save: async value => { await save.promise; persisted = value; } });
  await store.load(); const gateway = f.gateway(store);
  const commit = await gateway.update(value => ({ ...value, customFont: undefined }));
  await drain(); assert.equal(f.files.has(path), true, 'replacement must be durable before retirement');
  save.resolve(); await commit.saved; await drain(); assert.equal(f.files.has(path), false); assert.equal(persisted.customFont, undefined);
}
async function handoff() {
  // Both not-yet-submitted and already-submitted unlink: final import decision
  // shares the actual static Host lane across gateway instances.
  for (const phase of ['access', 'unlink']) {
    const f = fixture(true); const a = await f.host.selectAndRegister(undefined), path = a.filePath;
    let persisted = appearance.setReaderAppearanceCustomFont(appearance.createDefaultReaderAppearanceSnapshot(), a);
    const save = deferred(); let writes = 0;
    const store = new ReaderAppearanceStore({ load: async () => persisted, save: async value => { if (++writes === 1) await save.promise; persisted = value; } });
    await store.load(); const gateway = f.gateway(store);
    const bBytes = f.bytes.slice(); bBytes[19]++; f.files.set(f.provider, bBytes);
    const b = await gateway.importCustomFont(undefined); await until(() => writes === 1, 'B write entered');
    assert.equal(persisted.customFont.filePath, path); assert.equal(f.files.has(path), true);
    // A cancelled reimport while B is accepted but not durable cannot delete durable A.
    f.files.set(f.provider, f.bytes); const rejected = await gateway.importCustomFont(undefined, () => false);
    assert.equal(rejected, undefined); assert.equal(f.files.has(path), true);
    const gate = { path, entered: deferred(), release: deferred() };
    f.state[phase === 'access' ? 'accessGate' : 'unlinkGate'] = gate;
    save.resolve(); await b.saved; await until(() => gate.wasEntered, 'file gate entered');
    const secondGateway = f.gateway(store);
    const importingA = secondGateway.importCustomFont(undefined); let admitted = false; importingA.then(() => { admitted = true; });
    await drain(); assert.equal(admitted, false, 'A finalization waits for old cleanup lane');
    gate.release.resolve(); const committedA = await importingA; await committedA.saved; await drain();
    assert.equal(store.current().customFont.filePath, path); assert.equal(persisted.customFont.filePath, path);
    assert.equal(f.files.has(path), true, 'recreated A survives old cleanup');
    assert.equal(f.state.nativeLoads, 2, 'actual FontLoadHost reuses A checked receipt, not file existence');
    const cold = new ReaderAppearanceStore({ load: async () => persisted, save: async () => {} });
    const coldSnapshot = await cold.load(); assert.equal(await new f.Host({ filesDir: '/files' }).registerPersisted(undefined, coldSnapshot.customFont), true);
    f.retireOwner(); const retired = await gateway.update(value => ({ ...value, customFont: undefined }));
    await retired.saved; await drain(); assert.equal(f.files.has(path), true, 'retired Runtime cannot clean current files');
  }
  {
    const f=fixture(true),a=await f.host.selectAndRegister(undefined),path=a.filePath;
    let persisted=appearance.setReaderAppearanceCustomFont(appearance.createDefaultReaderAppearanceSnapshot(),a),writes=0;
    const save=deferred(),store=new ReaderAppearanceStore({load:async()=>persisted,save:async value=>{if(++writes===1)await save.promise;persisted=value;}});
    await store.load();const gateway=f.gateway(store),second=f.gateway(store);
    const bytes=f.bytes.slice();bytes[19]++;f.files.set(f.provider,bytes);
    const b=await gateway.importCustomFont(undefined);await until(()=>writes===1,'B save entered');
    f.files.set(f.provider,f.bytes);
    const gate={entered:deferred(),release:deferred()};f.state.themeGate=gate;
    const importingA=second.importCustomFont(undefined);await until(()=>gate.wasEntered,'A admission gate entered');
    save.resolve();await b.saved;await drain();
    assert.equal(f.files.has(path),true,'file lane includes waiting appearance admission, so old cleanup cannot delete A');
    gate.release.resolve();const commit=await importingA;await commit.saved;await drain();
    assert.equal(f.files.has(path),true);assert.equal(persisted.customFont.filePath,path);
  }

}
for (const id of selectContractCases(definitions)) { let timer; try { await Promise.race([(id === 'font-boundary' ? boundary() : handoff()), new Promise((_, reject) => {timer=setTimeout(()=>reject(Error('font case deadline')),5000);})]); recordContractCasePass(id); } finally {clearTimeout(timer);} }
