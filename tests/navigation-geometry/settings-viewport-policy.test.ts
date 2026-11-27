import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerRebaseSettingsViewport, readerSettingsPresentationPlan } from
  '../../entry/src/main/ets/app/navigation/ReaderSettingsPresentationPolicy.ts';

test('a settings-owned secondary route keeps Settings as its root when its wide pane collapses', () => {
  const wide = readerSettingsPresentationPlan('sourceTools', true, true, false, true);
  const narrow = readerSettingsPresentationPlan('sourceTools', true, false, false, true);
  assert.equal(wide.lane, 'settings');
  assert.equal(narrow.lane, 'sourceTools');
  assert.equal(narrow.settingsRoot, 'settings');
  assert.equal(readerRebaseSettingsViewport(true, false, true), true);
  assert.equal(readerRebaseSettingsViewport(true, false, false), false);
  assert.equal(readerRebaseSettingsViewport(false, false, true), false);
});

test('wide Settings reserves the global bottom footer only in the bottom-navigation mode', () => {
  const rail = readerSettingsPresentationPlan('settings', true, true, true, false);
  const bottom = readerSettingsPresentationPlan('settings', true, true, true, true);
  assert.equal(rail.primaryFooter, false);
  assert.equal(rail.reserveSharedFooter, false);
  assert.equal(bottom.primaryFooter, true);
  assert.equal(bottom.reserveSharedFooter, true);
  assert.equal(readerSettingsPresentationPlan('settings', true, false, false, true).primaryFooter, false);
});
