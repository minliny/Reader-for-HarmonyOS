import assert from 'node:assert/strict';
import { ReaderDocumentPickerActivity as Activity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import { ReaderNativeAlertOwner, ReaderNativeAlertWindow as Alerts } from './lib/reader-native-alert-sdk-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { systemFileIndexFixture, systemFileTick as tick } from './lib/system-file-open-index-probe.mjs';

const indexSource = process.argv.includes('--before-index') ?
  new URL('../../.local/ui-window-lifecycle-20261109/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets', import.meta.url) : undefined;
const fixture = () => systemFileIndexFixture({ indexSource });
let windowId = 12000;
function mountWindow() { Alerts.bind(++windowId); Activity.bind(windowId); Activity.setForeground(true); }
function pickerCall() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const Host = selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts', import.meta.url),
    'ReaderHostRegistry', ['selectBoundedJsonDocument'], {
      ReaderDocumentPickerActivity: Activity,
      picker: { DocumentSelectOptions: class {}, DocumentViewPicker: class {
        constructor() { assert.equal(Activity.isPending(), true, 'actual Host reserves before Native construction'); }
        select() { return promise; }
      } },
    });
  const host = Object.assign(new Host(), { context: {} });
  const result = host.selectBoundedJsonDocument('受控JSON');
  return { result, resolve, reject };
}
function alert() {
  let native;
  new ReaderNativeAlertOwner().present(options => { native = options; }, 'notice', {
    primaryButton: { value: '确定', action() {} },
  }, () => true);
  native.onWillAppear(); native.onDidAppear(); return native;
}
const opens = f => f.events.filter(e => e[0] === 'open').length;
const acks = f => f.events.filter(e => e[0] === 'ack').length;
function retire(page) {
  page.shelfReceiptRetired = true; page.nativeAlertWindowUnsubscribe?.();
  page.documentPickerUnsubscribe?.(); page.readingExitActions.dispose();
}
let cases = 0;
for (const resultKind of ['cancel', 'reject']) {
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall();
  await f.enqueue(); assert.ok(f.queue.peek(), 'a pending real Host picker invocation retains external file delivery');
  assert.equal(opens(f), 0); assert.equal(acks(f), 0);
  if (resultKind === 'cancel') { call.resolve([]); assert.equal(await call.result, undefined); }
  else { const error = Error('controlled provider rejection'); call.reject(error); await assert.rejects(call.result, value => value === error); }
  await tick(); assert.equal(Activity.isPending(), false);
  assert.equal(opens(f), 1); assert.equal(acks(f), 1); assert.equal(f.queue.peek(), undefined);
  f.dispose(); cases++;
}
{
  mountWindow(); const f = fixture(); f.mount(); const a = pickerCall(), b = pickerCall();
  await f.enqueue(); a.resolve([]); await a.result; await tick();
  assert.equal(Activity.isPending(), true); assert.equal(opens(f), 0, 'one settled invocation cannot clear another');
  b.resolve([]); await b.result; await tick(); assert.equal(opens(f), 1); assert.equal(acks(f), 1);
  f.dispose(); cases++;
}
{
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall(); await f.enqueue();
  const epoch = Activity.windowEpoch(); Activity.bind(windowId);
  assert.equal(Activity.windowEpoch(), epoch); assert.equal(Activity.isPending(), true);
  retire(f.page); const next = f.make(); next.mountSystemFileOpenNavigation(f.owner);
  assert.equal(opens(f), 0, 'same-window Root replacement preserves the original invocation');
  call.resolve([]); await call.result; await tick();
  assert.equal(opens(f), 1, 'the current Root receives the original invocation settlement');
  assert.equal(acks(f), 1); retire(next); f.dispose(); cases++;
}
{
  mountWindow(); const old = pickerCall(); mountWindow(); const current = pickerCall();
  const f = fixture(); f.mount(); await f.enqueue(); old.resolve([]); await old.result; await tick();
  assert.equal(Activity.isPending(), true); assert.equal(opens(f), 0, 'old-window finally cannot release the current invocation');
  current.resolve([]); await current.result; await tick(); assert.equal(opens(f), 1); assert.equal(acks(f), 1);
  f.dispose(); cases++;
}
{
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall(); await f.enqueue();
  f.page.searchAppForeground = false; Activity.setForeground(false);
  assert.equal(Activity.isPending(), true, 'background preserves already accepted invocation');
  call.resolve([]); await call.result; await tick();
  assert.equal(opens(f), 0); assert.ok(f.queue.peek());
  f.page.searchAppForeground = true; Activity.setForeground(true); await tick();
  assert.equal(opens(f), 1); assert.equal(acks(f), 1); f.dispose(); cases++;
}
for (const invalid of ['runtime', 'unmounted', 'arkweb']) {
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall(); await f.enqueue();
  if (invalid === 'runtime') f.setRuntime({});
  if (invalid === 'unmounted') retire(f.page);
  if (invalid === 'arkweb') f.page.arkWebCapturesInput = true;
  call.resolve([]); await call.result; await tick();
  assert.equal(opens(f), 0, `${invalid}: settled invocation cannot bypass the original current admission`);
  assert.equal(acks(f), 0); assert.ok(f.queue.peek()); f.dispose(); cases++;
}
{
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall(); await f.enqueue();
  Activity.destroy(); Alerts.destroy(); call.resolve([]); await call.result; await tick();
  assert.equal(opens(f), 0); assert.equal(acks(f), 0); assert.ok(f.queue.peek());
  mountWindow(); await tick(); assert.equal(opens(f), 1); assert.equal(acks(f), 1); f.dispose(); cases++;
}
for (const first of ['picker', 'alert']) {
  mountWindow(); const f = fixture(); f.mount(); const call = pickerCall(), native = alert(); await f.enqueue();
  if (first === 'picker') { call.resolve([]); await call.result; } else native.onDidDisappear();
  await tick(); assert.equal(opens(f), 0, 'both distinct system-surface blockers retain their own completion');
  if (first === 'picker') native.onDidDisappear(); else { call.resolve([]); await call.result; }
  await tick(); assert.equal(opens(f), 1); assert.equal(acks(f), 1); f.dispose(); cases++;
}
{
  const storage = new Map([['readerAppForeground', true]]);
  const AppStorage = { get: key => storage.get(key), setOrCreate: (key, value) => storage.set(key, value) };
  const Coordinator = selectedProductionMethods(new URL('../entry/src/main/ets/app/ReaderWindowCoordinator.ts', import.meta.url),
    'ReaderWindowCoordinator', ['install', 'detach', 'destroyWindow', 'installStillCurrent'], {
      ReaderNativeAlertWindow: Alerts, ReaderDocumentPickerActivity: Activity, AppStorage,
      ReaderStatusBarMeasurement: class {}, display: { off() {} },
    });
  Object.assign(Coordinator, { brightnessWriter: { reset() {} }, installEpoch: 0, windowPolicyRevision: 0,
    publishUiConfigurationRevision() {}, registerWindowListeners() {}, refreshMetrics() {}, requestAppChrome() {},
    reapplyChrome() {}, reapplyWindowPolicy() {},
  });
  const Ability = selectedProductionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url),
    'EntryAbility', ['onForeground', 'onBackground', 'onWindowStageDestroy'], {
      AppStorage, ReaderDocumentPickerActivity: Activity, ReaderWindowCoordinator: Coordinator, hilog: { error() {} },
    });
  const id = ++windowId, win = { getWindowProperties: () => ({ id, isKeepScreenOn: false }),
    getPreferredOrientation: () => 0, setWindowLayoutFullScreen: async () => {},
    setWindowSystemBarEnable: async () => {}, off() {},
  };
  assert.equal(await Coordinator.install(win), true);
  const ability = Object.assign(new Ability(), { coreCopyOnly: false, windowStageGeneration: 1,
    runtimeOwner: { setReadingPreparationContext() {}, releaseMangaOfflineProbe() {}, flush: async () => {} },
  });
  const ticket = Activity.begin(); ability.onBackground();
  assert.throws(() => Activity.begin(), /foreground/); assert.equal(Activity.isPending(), true);
  ticket.finish(); ability.onForeground(); const next = Activity.begin();
  assert.equal(await Coordinator.install(win), true); Coordinator.detach();
  assert.equal(Activity.isPending(), true, 'actual same-window reinstall/listener detach retains accepted invocations');
  ability.onWindowStageDestroy(); assert.equal(Activity.hasWindow(), false); assert.equal(Alerts.hasWindow(), false);
  next.finish(); assert.equal(Activity.isPending(), false); cases++;
}
Activity.destroy(); Alerts.destroy();
console.log(`PASS ${cases} actual Host→picker activity→Index/queue handoffs and actual foreground/window-stage methods; Native Promise settlement is controlled invocation evidence, not physical disappearance proof`);
