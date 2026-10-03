import assert from 'node:assert/strict';
import { ReaderNativeAlertOwner } from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const Reading = productionMotionMethods(file('features/reading/LocalReadingExperience.ets'),
  ['requestCachedChapterRefresh', 'showReaderAlert', 'isMountedToken', 'isSelectionCurrent'], { ReaderNativeAlertOwner });
for (const exit of ['primary', 'secondary', 'cancel', 'retired', 'stale', 'native-error']) {
  let shown;
  const reading = Object.assign(new Reading(), { nativeAlertOwner: new ReaderNativeAlertOwner(), mounted: true,
    lifecycleToken: 1, chapterSelectionToken: 2, getUIContext: () => ({ showAlertDialog(o) {
      if (exit === 'native-error') throw Error('native rejected'); shown = o;
    } }) });
  const outcome = reading.requestCachedChapterRefresh({ message: '缓存需要核对' });
  if (exit === 'primary') shown.primaryButton.action();
  if (exit === 'secondary') shown.secondaryButton.action();
  if (exit === 'cancel') shown.cancel();
  if (exit === 'retired') reading.nativeAlertOwner.retire();
  if (exit === 'stale') { reading.chapterSelectionToken++; shown.primaryButton.action(); }
  assert.equal(await outcome, exit === 'primary', `${exit}: real reader Promise settles without replaying content mutation`);
  if (shown) { assert.equal(shown.autoCancel, false); assert.equal(shown.primaryButton.value, '刷新本章'); }
}
const Source = productionMotionMethods(file('features/source/SourceToolsPage.ets'), ['confirmExportThen'], { ReaderNativeAlertOwner });
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
const Settings = productionMotionMethods(file('features/settings/SettingsPage.ets'), ['requestRestoreDefaults'], { ReaderNativeAlertOwner });
for (const stale of [false, true]) {
  let shown, resets = 0;
  const settings = Object.assign(new Settings(), { nativeAlertOwner: new ReaderNativeAlertOwner(), mounted: true,
    resetRevision: 1, resetInFlight: false, appThemeScheme: 'day', performRestoreDefaults() { resets++; },
    getUIContext: () => ({ showAlertDialog(o) { shown = o; } }) });
  settings.requestRestoreDefaults(); if (stale) settings.resetRevision++;
  shown.secondaryButton.action(); shown.secondaryButton.action(); assert.equal(resets, stale ? 0 : 1);
  assert.equal(Object.hasOwn(shown, 'autoCancel'), false, 'original native AUTO policy remains omitted');
}
console.log('PASS actual SDK-parsed reader/source/settings Alert consumers: cache decision retirement/native error, exact export selection/session, reset revision, once-only native callbacks and baseline slots');
