import assert from 'node:assert/strict';
import { ReaderNativeAlertOwner, ReaderNativeAlertLease } from './lib/reader-native-alert-sdk-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const Reading = productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),
  ['requestCachedChapterRefresh', 'showReaderRecovery', 'reconcileReaderRecovery']);
for (const stale of ['none', 'generation', 'unmount', 'exit']) {
  let refreshed = 0, native = 0;
  const reading = Object.assign(new Reading(), { mounted: true, exitRequested: false,
    readerRecoveryView: { generation: 0 }, getUIContext: () => ({ showAlertDialog() { native++; } }) });
  assert.equal(reading.requestCachedChapterRefresh({ message: '缓存需要核对' }, () => refreshed++), undefined,
    'a cache error never leaves a decision Promise holding acquisition');
  const generation = reading.readerRecoveryView.generation;
  assert.equal(native, 0); assert.equal(refreshed, 0, 'recovery never silently reloads the body');
  assert.equal(reading.readerRecoveryActionLabel, '刷新本章');
  if (stale === 'generation') reading.showReaderRecovery('another operation');
  if (stale === 'unmount') reading.mounted = false;
  if (stale === 'exit') reading.exitRequested = true;
  reading.reconcileReaderRecovery(generation); reading.reconcileReaderRecovery(generation);
  assert.equal(refreshed, stale === 'none' ? 1 : 0, 'only the original live inline action can refresh, once');
}
const Source = productionMotionMethods(file('features/source/SourceToolsPage.ets'), ['confirmExportThen'], { ReaderNativeAlertOwner, ReaderNativeAlertLease, hilog: { warn() {} } });
for (const stale of ['none', 'selection', 'sources', 'session', 'busy', 'exit']) {
  let shown, exports = 0;
  const source = Object.assign(new Source(), { nativeAlertOwner: new ReaderNativeAlertOwner(), mounted: true, exportRevision: 1,
    snapshot: { sourceListRevision: 2, selectionRevision: 3, busy: false },
    getUIContext: () => ({ showAlertDialog(o) { shown = o; } }) });
  source.confirmExportThen(() => exports++);
  if (stale === 'selection') source.snapshot.selectionRevision++;
  if (stale === 'sources') source.snapshot.sourceListRevision++;
  if (stale === 'session') source.exportRevision++;
  if (stale === 'busy') source.snapshot.busy = true;
  if (stale === 'exit') source.mounted = false;
  shown.primaryButton.action(); shown.primaryButton.action(); assert.equal(exports, stale === 'none' ? 1 : 0);
  assert.equal(shown.primaryButton.value, '继续导出'); assert.equal(shown.secondaryButton.value, '取消');
}
const Settings = productionMotionMethods(file('features/settings/SettingsPage.ets'), ['requestRestoreDefaults'], { ReaderNativeAlertOwner, ReaderNativeAlertLease, hilog: { warn() {} } });
for (const stale of [false, true]) {
  let shown, resets = 0;
  const settings = Object.assign(new Settings(), { nativeAlertOwner: new ReaderNativeAlertOwner(), mounted: true,
    resetRevision: 1, resetInFlight: false, appThemeScheme: 'day', performRestoreDefaults() { resets++; },
    getUIContext: () => ({ showAlertDialog(o) { shown = o; } }) });
  settings.requestRestoreDefaults(); if (stale) settings.resetRevision++;
  shown.secondaryButton.action(); shown.secondaryButton.action(); assert.equal(resets, stale ? 0 : 1);
  assert.equal(Object.hasOwn(shown, 'autoCancel'), false, 'original native AUTO policy remains omitted');
}
console.log('PASS actual SDK-parsed reader/source/settings Alert consumers: nonmodal cache recovery/retirement, exact export selection/session, reset revision, once-only native callbacks and baseline slots');
