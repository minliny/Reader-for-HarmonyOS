import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'decision-and-native-receipts': 'Actual Native owner decisions stay separate from reserved/appeared/closing/disappeared window attachments',
  'retired-scope-and-replacement': 'Actual old owner/window receipts, same-window reuse, destruction and no-window refusal',
  'failure-and-callback-finally': 'Actual show failures before/after appearance and throwing Native callbacks cannot strand physical cleanup',
  'button-copy-preserved': 'Original six Native specs preserve every original button property and exact action/guard decisions',
  'official-window-types': 'Fixed API23 strict semantic/ArkTS lint includes complete Window/Attachment/Owner/copy and four actual Native lifecycle slots',
};
for (const id of selectContractCases(definitions)) {
  if (id === 'official-window-types') await officialWindowTypes();
  else await lifecycle(id);
  recordContractCasePass(id);
}

async function lifecycle(id) {
  const { ReaderNativeAlertOwner: Owner, ReaderNativeAlertWindow: Window } = await import('./lib/reader-native-alert-sdk-probe.mjs');
  Window.destroy(); Window.bind(8101);
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  const plain = () => ({ primaryButton: { value: '原按钮', action() {} } });
  if (id === 'decision-and-native-receipts') {
    const calls = [], phases = [], observed = [];
    const unsubscribe = Window.subscribe(() => observed.push(Window.isPresented()));
    const owner = new Owner(); let native;
    const lease = owner.present(options => { native = options; }, 'notice', {
      primaryButton: { value: '原按钮', action: () => calls.push('action') },
      onWillAppear: () => phases.push('willAppear'), onDidAppear: () => phases.push('didAppear'),
      onWillDisappear: () => phases.push('willDisappear'), onDidDisappear: () => phases.push('didDisappear'),
    }, () => true);
    assert.equal(Window.isPresented(), true, 'the actual show reservation blocks before any Native appearance callback');
    native.onWillAppear(); native.onDidAppear();
    native.primaryButton.action(); assert.equal(await lease.decision, 'primary');
    assert.deepEqual(calls, ['action']); assert.equal(Window.isPresented(), true, 'a logical button decision is not physical disappearance');
    owner.retire(); assert.equal(Window.isPresented(), true, 'owner retirement cannot close a physical Native window');
    native.onWillDisappear(); assert.equal(Window.isPresented(), true, 'Native close animation remains blocking');
    native.onDidDisappear(); assert.equal(Window.isPresented(), false);
    native.onDidDisappear(); native.primaryButton.action();
    assert.deepEqual(phases, ['willAppear', 'didAppear', 'willDisappear', 'didDisappear']);
    assert.deepEqual(calls, ['action']); await settle(); assert.equal(observed.at(-1), false);
    unsubscribe();
  }
  if (id === 'retired-scope-and-replacement') {
    const owner = new Owner(), shown = [];
    const old = owner.present(options => shown.push(options), 'notice', plain(), () => true);
    shown[0].onWillAppear(); owner.retire(); assert.equal(await old.decision, 'retired');
    Window.bind(8101); assert.equal(Window.isPresented(), true, 'rebinding the same actual window retains old physical attachments');
    const next = owner.present(options => shown.push(options), 'notice', plain(), () => true);
    shown[1].onDidAppear(); shown[0].onDidDisappear(); assert.equal(Window.isPresented(), true, 'old completion cannot release a second attachment');
    Window.bind(8102); assert.equal(await next.decision, 'retired'); assert.equal(Window.hasWindow(), true); assert.equal(Window.isPresented(), false);
    const replacement = owner.present(options => shown.push(options), 'notice', plain(), () => true);
    shown[2].onWillAppear(); shown[1].onDidDisappear(); assert.equal(Window.isPresented(), true, 'old window callback cannot clear a new scope');
    Window.destroy(); assert.equal(await replacement.decision, 'retired');
    assert.equal(Window.hasWindow(), false); assert.equal(Window.isPresented(), false);
    let nativeShows = 0;
    const rejected = owner.present(() => nativeShows++, 'notice', plain(), () => true);
    assert.equal(nativeShows, 0); assert.equal(await rejected.decision, 'native-failure', 'a Native presentation needs a real current window');
    shown[2].onWillAppear(); shown[2].onDidDisappear(); assert.equal(Window.hasWindow(), false);
  }
  if (id === 'failure-and-callback-finally') {
    const owner = new Owner(), failure = { exact: 'original foreign thrown value' };
    let caught;
    try { owner.present(() => { throw failure; }, 'notice', plain(), () => true); } catch (error) { caught = error; }
    assert.equal(caught, failure); assert.equal(Window.isPresented(), false, 'unobserved rejected show withdraws only its reservation');
    let appeared;
    try { owner.present(options => { appeared = options; options.onWillAppear(); throw failure; }, 'notice', plain(), () => true); } catch (error) { caught = error; }
    assert.equal(caught, failure); assert.equal(Window.isPresented(), true, 'observed Native appearance survives a later show exception');
    appeared.onWillDisappear(); assert.equal(Window.isPresented(), true); appeared.onDidDisappear(); assert.equal(Window.isPresented(), false);
    let native;
    const lease = owner.present(options => { native = options; }, 'notice', {
      ...plain(), onDidDisappear() { throw failure; },
    }, () => true);
    native.onDidAppear();
    assert.throws(() => native.onDidDisappear(), error => error === failure);
    assert.equal(Window.isPresented(), false, 'throwing user lifecycle callbacks cannot strand physical retirement');
    assert.equal(await lease.decision, 'retired', 'physical disappearance without a button is not a fabricated business decision');
    const denied = owner.present(() => assert.fail('retired input must not show'), 'notice', plain(), () => false);
    assert.equal(await denied.decision, 'retired'); assert.equal(Window.isPresented(), false);
    await settle();
  }
  if (id === 'button-copy-preserved') {
    for (const [spec, slots] of [
      ['notice', ['primaryButton']], ['confirmation', ['primaryButton', 'secondaryButton']],
      ['confirmation-cancelable', ['primaryButton', 'secondaryButton']],
      ['choice-blocking', ['primaryButton', 'secondaryButton']], ['retry-blocking', ['primaryButton']],
      ['preview', ['confirm']],
    ]) {
      const owner = new Owner(), action = () => {}, input = {};
      for (const slot of slots) input[slot] = { value: '原按钮', action, fontColor: '#123456',
        backgroundColor: '#654321', enabled: false, defaultFocus: true, style: 1 };
      let native;
      owner.present(options => { native = options; }, spec, input, () => true);
      for (const slot of slots) {
        assert.notEqual(native[slot], input[slot], 'native guarded button remains a separate copy');
        assert.equal(input[slot].action, action, 'caller button callback is untouched');
        assert.notEqual(native[slot].action, action);
        const { action: originalAction, ...before } = input[slot];
        const { action: nativeAction, ...after } = native[slot];
        assert.deepEqual(after, before, 'all enumerable original SDK fields are preserved');
      }
      native.onDidDisappear();
    }
  }
  Window.destroy(); await settle();
}

async function officialWindowTypes() {
  const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const loader = resolveEtsLoaderRoot(), sdk = resolve(loader, '../..');
  assert.equal(JSON.parse(readFileSync(resolve(sdk, 'oh-uni-package.json'), 'utf8')).apiVersion, '23', 'explicit fixed API23 declarations are required');
  const require = createRequire(import.meta.url), ts = require(loader + '/node_modules/typescript');
  const official = require(loader + '/lib/ets_checker.js');
  const owner = fileURLToPath(new URL('../entry/src/main/ets/ui/platform/ReaderNativeAlertOwner.ets', import.meta.url));
  const copy = fileURLToPath(new URL('../entry/src/main/ets/ui/platform/ReaderNativeAlertButtonCopy.ts', import.meta.url));
  const window = fileURLToPath(new URL('../entry/src/main/ets/ui/platform/ReaderNativeAlertWindow.ts', import.meta.url));
  const consumer = virtualFilePath('NativeAlertWindowLifecycleConsumer.ets');
  const options = { ...official.compilerOptions, ets: { ...official.compilerOptions.ets, libs: [loader + '/declarations/index-full.d.ts'] },
    target: ts.ScriptTarget.ES2021, lib: ['lib.es2021.d.ts'], module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs, strict: true, noEmit: true, skipLibCheck: true,
    allowNonTsExtensions: true, needDoArkTsLinter: true, isCompatibleVersion: false, etsLoaderPath: loader };
  const paths = new Map([[owner.replace(/\.ets$/, '').replaceAll('\\', '/'), owner], [window.replace(/\.ts$/, '').replaceAll('\\', '/'), window]]);
  const callbacks = ['onWillAppear', 'onDidAppear', 'onWillDisappear', 'onDidDisappear'];
  function check(invalid) {
    const input = `import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from ${JSON.stringify([...paths.keys()][0])};
import { ReaderNativeAlertWindow } from ${JSON.stringify([...paths.keys()][1])};
declare let context: UIContext;
ReaderNativeAlertWindow.bind(7);
const owner = new ReaderNativeAlertOwner();
owner.present((native: ReaderNativeAlertOptions): void => context.showAlertDialog(native), 'notice', {
message: '原生窗口生命周期',
primaryButton: { value: '原按钮', action: (): void => {} },
${callbacks.map(name => `${name}: ${name === invalid ? '7' : '(): void => {}'}`).join(',\n')}
}, (): boolean => true);`;
    const host = ts.createCompilerHost(options), original = host.getSourceFile, exists = host.fileExists;
    host.fileExists = path => path === consumer || exists(path);
    host.getSourceFile = (path, version, ...rest) => {
      const source = path === consumer ? ts.createSourceFile(path, input, version, true, ts.ScriptKind.ETS, options) : original(path, version, ...rest);
      if (source) source.version = '1'; return source;
    };
    host.resolveModuleNames = (names, from) => names.map(name => name === '@ohos.arkui.UIContext'
      ? { resolvedFileName: resolve(sdk, 'api/@ohos.arkui.UIContext.d.ts'), extension: ts.Extension.Dts, isExternalLibraryImport: true }
      : paths.has(name) ? { resolvedFileName: paths.get(name), extension: paths.get(name).endsWith('.ets') ? ts.Extension.Ets : ts.Extension.Ts }
        : ts.resolveModuleName(name, from, options, host).resolvedModule);
    const inputs = new Set([consumer, owner, copy, window]);
    const builder = ts.createSemanticDiagnosticsBuilderProgram([...inputs, ...official.readDeaclareFiles()], options, host);
    const diagnostics = builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(item => inputs.has(item.file?.fileName));
    const lint = ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, () => {}, '1.1').filter(item => inputs.has(item.file?.fileName));
    const checker = builder.getProgram().getTypeChecker(), ownerFile = builder.getProgram().getSourceFile(owner);
    const declaration = ownerFile.statements.find(node => ts.isInterfaceDeclaration(node) && node.name.text === 'ReaderNativeAlertOptions');
    const nativeType = checker.getTypeAtLocation(declaration);
    for (const name of callbacks) {
      const symbol = nativeType.getProperty(name); assert.ok(symbol, 'official Native lifecycle exists: ' + name);
      const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, declaration));
      assert.equal(Boolean(type.flags & ts.TypeFlags.Any), false, 'official Native lifecycle is not any: ' + name);
      assert.equal(checker.getSignaturesOfType(type, ts.SignatureKind.Call).length, 1);
    }
    const convert = item => ({ path: item.file.fileName, code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, ' ') });
    return { semantic: diagnostics.map(convert), lint: lint.map(convert) };
  }
  const valid = check(undefined), rejected = {};
  assert.deepEqual(valid, { semantic: [], lint: [] }, 'complete actual Window/Attachment/Owner/copy sources pass fixed API23 strict checking');
  for (const name of callbacks) {
    const invalid = check(name);
    assert.ok(invalid.semantic.some(item => item.code === 2322 || item.code === 2345), 'official API23 rejects a non-callback ' + name);
    rejected[name] = invalid.semantic.map(item => item.code);
  }
  console.log(JSON.stringify({ kind: 'reader-native-alert-window-type-receipt', loader,
    sdk: JSON.parse(readFileSync(resolve(sdk, 'oh-uni-package.json'), 'utf8')),
    completeInputs: [owner, copy, window, consumer], valid, rejected }));
}
