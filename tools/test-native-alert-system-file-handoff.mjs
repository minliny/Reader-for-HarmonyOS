import assert from 'node:assert/strict';
import { ReaderNativeAlertOwner, ReaderNativeAlertWindow } from './lib/reader-native-alert-sdk-probe.mjs';
import { ReaderDocumentPickerActivity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import { systemFileIndexFixture, systemFileTick as tick } from './lib/system-file-open-index-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

// The before run selects the untouched installed49 Index declarations. Both
// runs use actual current queue/navigation/exit classes and native adapter.
const indexSource = process.argv.includes('--before-index') ?
  new URL('../../.local/ui-semantic-closure-20261109/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets', import.meta.url) : undefined;
const fixture = () => systemFileIndexFixture({ indexSource });
let windowId = 7000;
function windowScope() { ReaderNativeAlertWindow.bind(++windowId); }
function alert({ action = () => {}, onDidDisappear } = {}) {
  const owner = new ReaderNativeAlertOwner(); let native;
  const lease = owner.present(options => { native = options; }, 'confirmation-cancelable', {
    title: '受控确认', primaryButton: { value: '继续', action },
    secondaryButton: { value: '取消', action() {} }, onDidDisappear,
  }, () => true);
  native.onWillAppear(); native.onDidAppear();
  return { owner, lease, native };
}
const opened = f => f.events.filter(e => e[0] === 'open').length;
const acknowledged = f => f.events.filter(e => e[0] === 'ack').length;
let cases = 0;

for (const outcome of ['book', 'failure']) {
  ReaderNativeAlertWindow.destroy();
  const f = fixture(); f.mount(); await f.enqueue(outcome === 'book' ? { book: f.book } : { failure: { code: 'readFailed', message: '读取失败' } });
  assert.ok(f.queue.peek(), 'a destroyed/missing main window retains the external file');
  assert.equal(opened(f), 0);
  windowScope(); await tick();
  assert.equal(opened(f), outcome === 'book' ? 1 : 0, 'the new window automatically wakes the existing consumer');
  assert.equal(f.events.filter(e => e[0] === 'toast').length, outcome === 'failure' ? 1 : 0);
  assert.equal(acknowledged(f), 1); f.dispose(); cases++;
}
{
  windowScope(); const f = fixture(); f.mount(); let writes = 0;
  const a = alert({ action: () => writes++ });
  await f.enqueue(); const pending = f.queue.peek(); assert.ok(pending);
  a.native.primaryButton.action();
  assert.equal(await a.lease.decision, 'primary'); assert.equal(writes, 1);
  await tick(); assert.equal(opened(f), 0, 'business decision does not prove native dismissal');
  a.native.onWillDisappear(); await tick();
  assert.equal(opened(f), 0, 'native closing still blocks cross-page delivery');
  a.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 1); assert.equal(acknowledged(f), 1); assert.equal(f.queue.peek(), undefined);
  a.native.primaryButton.action(); a.native.onDidDisappear(); await tick();
  assert.equal(writes, 1); assert.equal(opened(f), 1); assert.equal(acknowledged(f), 1);
  f.dispose(); cases++;
}
{
  windowScope(); const f = fixture(); f.mount();
  const a = alert(); await f.enqueue(); a.owner.retire();
  assert.equal(await a.lease.decision, 'retired');
  ReaderNativeAlertWindow.bind(windowId); await tick();
  assert.equal(opened(f), 0, 'same-window listener reinstall and logical retirement keep the native gate');
  f.page.shelfReceiptRetired = true; f.page.nativeAlertWindowUnsubscribe?.(); f.page.documentPickerUnsubscribe?.(); f.page.readingExitActions.dispose();
  const next = f.make(); next.mountSystemFileOpenNavigation(f.owner);
  assert.equal(opened(f), 0, 'a replacement Root cannot clear its predecessor native window');
  a.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 1, 'the old physical receipt wakes the current Root in the same window');
  assert.equal(acknowledged(f), 1);
  next.nativeAlertWindowUnsubscribe?.(); next.documentPickerUnsubscribe?.(); next.readingExitActions.dispose(); f.dispose(); cases++;
}
{
  windowScope(); const f = fixture(); f.mount(); const a = alert(), b = alert();
  await f.enqueue(); a.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 0, 'one owner cannot release a second owner native attachment');
  b.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 1); assert.equal(acknowledged(f), 1); f.dispose(); cases++;
}
{
  windowScope(); const f = fixture(); f.mount(); let b;
  const a = alert({ onDidDisappear: () => { b = alert(); } });
  await f.enqueue(); a.native.onDidDisappear(); await tick();
  assert.ok(b); assert.equal(opened(f), 0, 'a synchronous follow-up native window closes the release gap');
  b.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 1); assert.equal(acknowledged(f), 1); f.dispose(); cases++;
}
{
  windowScope(); const a = alert(); windowScope(); const b = alert();
  const f = fixture(); f.mount(); await f.enqueue();
  a.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 0, 'a previous window receipt cannot clear a new window attachment');
  b.native.onDidDisappear(); await tick(); assert.equal(opened(f), 1);
  assert.equal(acknowledged(f), 1); f.dispose(); cases++;
}
for (const retired of ['runtime', 'unmounted', 'background']) {
  windowScope(); const f = fixture(); f.mount(); const a = alert(); await f.enqueue();
  if (retired === 'runtime') f.setRuntime({});
  if (retired === 'unmounted') { f.page.shelfReceiptRetired = true; f.page.nativeAlertWindowUnsubscribe?.(); }
  if (retired === 'background') f.page.searchAppForeground = false;
  a.native.onDidDisappear(); await tick();
  assert.equal(opened(f), 0, `${retired}: physical completion cannot bypass current admission`);
  assert.equal(acknowledged(f), 0); assert.ok(f.queue.peek()); f.dispose(); cases++;
}
{
  const Coordinator = selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url),
    'ReaderWindowCoordinator', ['install', 'detach', 'destroyWindow', 'installStillCurrent'], {
      ReaderNativeAlertWindow, ReaderDocumentPickerActivity, AppStorage: { get: () => true },
      ReaderStatusBarMeasurement: class {}, display: { off() {} },
    });
  Object.assign(Coordinator, { brightnessWriter: { reset() {} }, installEpoch: 0, windowPolicyRevision: 0,
    publishUiConfigurationRevision() {}, registerWindowListeners() {}, refreshMetrics() {}, requestAppChrome() {},
  });
  const id = ++windowId;
  const win = { getWindowProperties: () => ({ id, isKeepScreenOn: false }),
    getPreferredOrientation: () => 0, setWindowLayoutFullScreen: async () => {},
    setWindowSystemBarEnable: async () => {}, off() {},
  };
  assert.equal(await Coordinator.install(win), true);
  const a = alert();
  assert.equal(await Coordinator.install(win), true);
  assert.equal(ReaderNativeAlertWindow.isPresented(), true, 'actual same-window coordinator reinstall keeps the attachment');
  Coordinator.detach();
  assert.equal(ReaderNativeAlertWindow.isPresented(), true, 'listener detach is not physical window destruction');
  Coordinator.destroyWindow();
  assert.equal(ReaderNativeAlertWindow.hasWindow(), false);
  assert.equal(await a.lease.decision, 'retired');
  a.native.onDidDisappear(); assert.equal(ReaderNativeAlertWindow.hasWindow(), false); cases++;
}
ReaderNativeAlertWindow.destroy();
console.log(`PASS ${cases} actual Native-window → Index → queue/navigation handoffs; controlled SDK callbacks only, no native scheduling or OS dismissal claim`);
