import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeReaderNavigationPreferences } from '../../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts';
import { createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot,
  setReaderPageTurnStyle, readerPageTurnStyle } from '../../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';

test('navigation defaults reset to default appearance and quality rendering', () => {
  const defaults = { override: 'unset', renderMode: 'quality' };
  assert.deepEqual(normalizeReaderNavigationPreferences(undefined), defaults);
  assert.deepEqual(normalizeReaderNavigationPreferences({}), defaults);
  assert.deepEqual(normalizeReaderNavigationPreferences({ override: 'unified', reduceTransparency: false }), defaults);
});

test('legacy navigation settings migrate to the canonical keys and preserve a modern render mode', () => {
  assert.deepEqual(normalizeReaderNavigationPreferences({ override: 'unified', reduceTransparency: true }),
    { override: 'unset', renderMode: 'performance' });
  assert.deepEqual(normalizeReaderNavigationPreferences({ override: 'systemNative', reduceTransparency: true }),
    { override: 'systemNative', renderMode: 'performance' });
  assert.deepEqual(normalizeReaderNavigationPreferences({ override: 'systemNative', reduceTransparency: true, renderMode: 'quality' }),
    { override: 'systemNative', renderMode: 'quality' });
  assert.deepEqual(normalizeReaderNavigationPreferences({ override: 'systemNative', reduceTransparency: false, renderMode: 'performance' }),
    { override: 'systemNative', renderMode: 'performance' });
});

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
