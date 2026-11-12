import assert from 'node:assert/strict';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { ReaderNativeAlertOwner, ReaderNativeAlertWindow } from './lib/reader-native-alert-sdk-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const before = process.argv.includes('--before-index');
const selected = selectContractCases({ 'root-input-admission': {
  description: 'Actual Index native alert factory/decision rechecks current foreground and covered input; accepted work stays independent', resources: [],
} }, { argv: process.argv.slice(2).filter(value => value !== '--before-index') });
for (const id of selected) {
  const path = before ? new URL('../../.local/ui-picker-handoff-20261109/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets', import.meta.url) :
    new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
  let installed; let windowId = 16000;
  const Runtime = runtimeOwnerIdentityProbe(() => installed);
  const Index = selectedProductionMethods(path, 'Index', ['showIndexAlert'], {
    ReaderRuntimeOwner: Runtime, hilog: { warn() {} }, DOMAIN: 1, errorMessageOf: error => String(error),
  });
  function fixture() {
    ReaderNativeAlertWindow.bind(++windowId);
    const owner = installed = {}, shown = [], effects = [];
    const page = Object.assign(new Index(), { shelfReceiptRetired: false, searchAppForeground: true,
      arkWebCapturesInput: false, navigationGeneration: 1, route: 'sourceTools',
      nativeAlertOwner: new ReaderNativeAlertOwner(), isCurrentRuntime: value => installed === value && owner === value,
      getUIContext: () => ({ showAlertDialog: options => shown.push(options) }),
    });
    let current = true;
    const show = (action = () => effects.push('accepted')) => page.showIndexAlert('confirmation-cancelable', {
      title: '原确认', message: '原消息', primaryButton: { value: '取消', action() {} },
      secondaryButton: { value: '执行', action },
    }, () => current);
    return { page, show, shown, effects, stale: () => { current = false; } };
  }
  let cases = 0;
  for (const invalid of ['background', 'covered', 'retired', 'runtime', 'predicate']) {
    const f = fixture();
    if (invalid === 'background') f.page.searchAppForeground = false;
    if (invalid === 'covered') f.page.arkWebCapturesInput = true;
    if (invalid === 'retired') f.page.shelfReceiptRetired = true;
    if (invalid === 'runtime') installed = undefined;
    if (invalid === 'predicate') f.stale();
    f.show(); assert.equal(f.shown.length, 0, `${invalid}: invalid current input cannot create a new native alert`);
    assert.equal(ReaderNativeAlertWindow.isPresented(), false); cases++;
  }
  for (const invalid of ['background', 'covered', 'retired', 'runtime', 'predicate', 'route', 'generation']) {
    const f = fixture(), lease = f.show(), native = f.shown[0];
    assert.ok(native); native.onWillAppear(); native.onDidAppear();
    if (invalid === 'background') f.page.searchAppForeground = false;
    if (invalid === 'covered') f.page.arkWebCapturesInput = true;
    if (invalid === 'retired') f.page.shelfReceiptRetired = true;
    if (invalid === 'runtime') installed = {};
    if (invalid === 'predicate') f.stale();
    if (invalid === 'route') f.page.route = 'settings';
    if (invalid === 'generation') f.page.navigationGeneration++;
    native.secondaryButton.action(); native.secondaryButton.action();
    assert.equal(f.effects.length, 0, `${invalid}: a stale native decision cannot dispatch business work`);
    assert.equal(await lease.decision, 'retired');
    assert.equal(ReaderNativeAlertWindow.isPresented(), true, 'logical retirement cannot release a physical native attachment');
    native.onDidDisappear(); assert.equal(ReaderNativeAlertWindow.isPresented(), false); cases++;
  }
  {
    const f = fixture(), lease = f.show(), native = f.shown[0];
    native.secondaryButton.action(); native.secondaryButton.action(); native.cancel();
    assert.deepEqual(f.effects, ['accepted']); assert.equal(await lease.decision, 'secondary');
    assert.equal(native.title, '原确认'); assert.equal(native.message, '原消息');
    assert.equal(native.primaryButton.value, '取消'); assert.equal(native.secondaryButton.value, '执行');
    native.onDidDisappear(); cases++;
  }
  for (const invalid of ['background', 'covered']) {
    const f = fixture(), first = f.show(), original = f.shown[0];
    if (invalid === 'background') f.page.searchAppForeground = false; else f.page.arkWebCapturesInput = true;
    f.show(); assert.equal(f.shown.length, 1, 'a rejected new presentation does not replace the existing native window');
    f.page.searchAppForeground = true; f.page.arkWebCapturesInput = false;
    original.secondaryButton.action(); assert.deepEqual(f.effects, ['accepted']); assert.equal(await first.decision, 'secondary');
    original.onDidDisappear(); cases++;
  }
  {
    const f = fixture(); let complete;
    const work = new Promise(resolve => { complete = resolve; });
    const lease = f.show(() => { void work.then(() => f.effects.push('finished')); });
    const native = f.shown[0]; native.secondaryButton.action();
    f.page.searchAppForeground = false; f.page.arkWebCapturesInput = true; f.page.shelfReceiptRetired = true;
    native.onDidDisappear(); complete(); await work; await Promise.resolve();
    assert.equal(await lease.decision, 'secondary'); assert.deepEqual(f.effects, ['finished'], 'already accepted business work survives later UI retirement'); cases++;
  }
  ReaderNativeAlertWindow.destroy();
  console.log(`PASS ${cases} actual Index input admission cases; native UI and business I/O ports are controlled`);
  recordContractCasePass(id);
}
