import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  normalizeReaderSettingsSnapshot,
  setReaderSettingsToggle,
} from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';

const initial = createDefaultReaderSettingsSnapshot();
assert.deepEqual(initial, {
  version: 1,
  screenDirection: 'system',
  pageTurnStyle: 'none',
  screenTimeout: 'system',
  hideStatusBar: false,
  hideNavigationBar: false,
  extendIntoCutout: false,
  justifyText: true,
  alignPageBottom: false,
  volumeKeysTurnPage: false,
  stopTtsOnScreenOff: false,
  longPressSelectText: true,
});

const normalized = normalizeReaderSettingsSnapshot({
  ...initial,
  screenDirection: 'landscape',
  pageTurnStyle: 'cover',
  screenTimeout: 'alwaysOn',
  hideStatusBar: true,
  hideNavigationBar: true,
  extendIntoCutout: true,
  justifyText: false,
  alignPageBottom: true,
  volumeKeysTurnPage: true,
  stopTtsOnScreenOff: true,
  longPressSelectText: false,
});
assert.equal(normalized.screenDirection, 'system');
assert.equal(normalized.pageTurnStyle, 'none');
assert.equal(normalized.screenTimeout, 'system');
assert.equal(normalized.hideStatusBar, false);
assert.equal(normalized.hideNavigationBar, false);
assert.equal(normalized.extendIntoCutout, false);
assert.equal(normalized.volumeKeysTurnPage, false);
assert.equal(normalized.stopTtsOnScreenOff, false);
assert.equal(normalized.justifyText, false);
assert.equal(normalized.alignPageBottom, true);
assert.equal(normalized.longPressSelectText, false);

let next = setReaderSettingsToggle(initial, 'justifyText', false);
next = setReaderSettingsToggle(next, 'alignPageBottom', true);
next = setReaderSettingsToggle(next, 'longPressSelectText', false);
assert.equal(next.justifyText, false);
assert.equal(next.alignPageBottom, true);
assert.equal(next.longPressSelectText, false);
assert.equal(initial.justifyText, true, 'pure transitions must not mutate their input');
assert.notStrictEqual(copyReaderSettingsSnapshot(next), next);
assert.throws(() => setReaderSettingsToggle(initial, 'hideStatusBar', true), /unavailable Reader Host/);
assert.throws(() => setReaderSettingsToggle(initial, 'volumeKeysTurnPage', true), /unavailable Reader Host/);

assert.equal(isReaderScreenDirectionAvailable('system'), true);
assert.equal(isReaderScreenDirectionAvailable('portrait'), false);
assert.equal(isReaderPageTurnStyleAvailable('none'), true);
assert.equal(isReaderPageTurnStyleAvailable('scroll'), false);
assert.equal(isReaderScreenTimeoutAvailable('system'), true);
assert.equal(isReaderScreenTimeoutAvailable('fiveMinutes'), false);
assert.equal(isReaderSettingsToggleAvailable('justifyText'), true);
assert.equal(isReaderSettingsToggleAvailable('alignPageBottom'), true);
assert.equal(isReaderSettingsToggleAvailable('longPressSelectText'), true);
assert.equal(isReaderSettingsToggleAvailable('stopTtsOnScreenOff'), false);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderSettingsModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderSettingsFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderSettingsGateway.ts', readingDir), 'utf8');

assert.match(quickPanel, /Phone `942:70` \/ `924:69`; Tablet `942:72` \/ `926:65`/);
assert.match(quickPanel, /return this\.isTablet \? 262 : 286/);
assert.match(quickPanel, /return this\.isTablet \? 240 : 264/);
assert.match(quickPanel, /\.height\(190\)/);
assert.match(quickPanel, /Text\(this\.groupLabel\(group\)\)/);
assert.match(quickPanel, /isReaderPageTurnStyleAvailable/);
assert.match(quickPanel, /isReaderScreenDirectionAvailable/);
assert.match(quickPanel, /isReaderScreenTimeoutAvailable/);

assert.match(fullPanel, /Phone `942:86` \/ `936:66`; Tablet `942:88` \/ `938:62`/);
assert.match(fullPanel, /return this\.isTablet \? 720 : 364/);
assert.match(fullPanel, /return this\.isTablet \? 852 : 736/);
assert.match(fullPanel, /return this\.isTablet \? 694 : 338/);
assert.match(fullPanel, /return this\.isTablet \? 782 : 666/);
assert.match(fullPanel, /return this\.isTablet \? 664 : 308/);
assert.match(fullPanel, /Image\(\$r\('app\.media\.rc_settings'\)\)[\s\S]*\.fillColor\(TOK_READ_INK\)/,
  'the scaled shared gear glyph must use the Figma full-panel ink color');
assert.match(fullPanel, /this\.sectionTitle\('屏幕样式', false\)/);
assert.match(fullPanel, /this\.sectionTitle\('导航状态栏', true\)/);
assert.match(fullPanel, /this\.sectionTitle\('排版', true\)/);
assert.match(fullPanel, /this\.sectionTitle\('控制', true\)/);
for (const label of ['隐藏状态栏', '隐藏导航栏', '拓展到刘海（灵动岛）', '文字两端对齐',
  '底部对齐', '音量键翻页', '息屏终止朗读', '长按选择文本']) {
  assert.ok(fullPanel.includes(label), `missing Figma settings row: ${label}`);
}
assert.match(fullPanel, /\.enabled\(isReaderSettingsToggleAvailable\(key\)\)/);

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /reader_reading_settings_v1/);
assert.doesNotMatch(gateway, /\.request\(/,
  'Reader Settings must not misuse Reader Core or invent a Host command');

console.log('reader settings pure/static contract: PASS');
