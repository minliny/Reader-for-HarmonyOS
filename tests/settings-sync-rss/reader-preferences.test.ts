import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot,
  setReaderPageTurnStyle, readerPageTurnStyle } from '../../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';

test('legacy status-bar preference migrates without overwriting an explicit cutout value', () => {
  const old = { ...createDefaultReaderSettingsSnapshot(), version: 4 as const, hideStatusBar: true, extendIntoCutout: false };
  assert.equal(normalizeReaderSettingsSnapshot(old).extendIntoCutout, false);
  assert.equal(normalizeReaderSettingsSnapshot({ ...old, extendIntoCutout: undefined }).extendIntoCutout, true);
  assert.equal(normalizeReaderSettingsSnapshot(old).hideStatusBar, true);
});

test('switching page-turn style preserves other reader preferences', () => {
  const initial = { ...createDefaultReaderSettingsSnapshot(), hideNavigationBar: true };
  const scrolling = setReaderPageTurnStyle(initial, 'scroll');
  assert.equal(scrolling.navigationMode, 'continuous');
  assert.equal(readerPageTurnStyle(scrolling), 'scroll');
  assert.equal(scrolling.hideNavigationBar, true);
});
