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
  justifyText: false,
  alignPageBottom: false,
  volumeKeysTurnPage: false,
  stopTtsOnScreenOff: false,
  longPressSelectText: false,
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
assert.equal(normalized.alignPageBottom, false);
assert.equal(normalized.longPressSelectText, false);

assert.notStrictEqual(copyReaderSettingsSnapshot(initial), initial);
assert.throws(() => setReaderSettingsToggle(initial, 'justifyText', true), /unavailable Reader Host/);
assert.throws(() => setReaderSettingsToggle(initial, 'alignPageBottom', true), /unavailable Reader Host/);
assert.throws(() => setReaderSettingsToggle(initial, 'longPressSelectText', true), /unavailable Reader Host/);
assert.throws(() => setReaderSettingsToggle(initial, 'hideStatusBar', true), /unavailable Reader Host/);
assert.throws(() => setReaderSettingsToggle(initial, 'volumeKeysTurnPage', true), /unavailable Reader Host/);

assert.equal(isReaderScreenDirectionAvailable('system'), true);
assert.equal(isReaderScreenDirectionAvailable('portrait'), false);
assert.equal(isReaderPageTurnStyleAvailable('none'), true);
assert.equal(isReaderPageTurnStyleAvailable('scroll'), false);
assert.equal(isReaderScreenTimeoutAvailable('system'), true);
assert.equal(isReaderScreenTimeoutAvailable('fiveMinutes'), false);
assert.equal(isReaderSettingsToggleAvailable('justifyText'), false);
assert.equal(isReaderSettingsToggleAvailable('alignPageBottom'), false);
assert.equal(isReaderSettingsToggleAvailable('longPressSelectText'), false);
assert.equal(isReaderSettingsToggleAvailable('stopTtsOnScreenOff'), false);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderSettingsModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderSettingsFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderSettingsGateway.ts', readingDir), 'utf8');
const controlPanel = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

assert.match(quickPanel, /Phone `942:70` \/ `924:69`; Tablet `942:72` \/ `926:65`/);
assert.match(quickPanel, /return this\.isTablet \? 262 : 286/);
assert.match(quickPanel, /return this\.isTablet \? 240 : 264/);
assert.match(quickPanel, /\.height\(190\)/);
assert.match(quickPanel, /Text\(this\.groupLabel\(group\)\)/);
assert.match(quickPanel, /isReaderPageTurnStyleAvailable/);
assert.match(quickPanel, /isReaderScreenDirectionAvailable/);
assert.match(quickPanel, /isReaderScreenTimeoutAvailable/);

assert.match(fullPanel, /Phone `942:86` \/ `936:66`; Tablet `942:88` \/ `938:62`/);
assert.match(fullPanel, /@Prop availableWidth: number = 0/);
assert.match(fullPanel, /@Prop availableHeight: number = 0/);
assert.match(fullPanel,
  /const designWidth = this\.isTablet \? READER_FULL_PANEL_MAX_WIDTH_TABLET :[\s\S]*READER_FULL_PANEL_MAX_WIDTH_PHONE;[\s\S]*Math\.min\(designWidth, this\.availableWidth\)/,
  'settings sheet must preserve Figma width as a maximum and shrink to the live viewport');
assert.match(fullPanel,
  /const designHeight = this\.isTablet \? READER_FULL_PANEL_HEIGHT_TABLET : READER_FULL_PANEL_HEIGHT_PHONE;[\s\S]*Math\.min\(designHeight, this\.availableHeight\)/,
  'settings sheet must clamp its own Figma height to the shared live budget');
assert.match(fullPanel, /return Math\.max\(0, this\.sheetHeight\(\) - 70\)/);
assert.equal((fullPanel.match(/return Math\.max\(0, this\.sheetWidth\(\) - 26\)/g) ?? []).length, 2,
  'settings header and viewport must both derive from the actual sheet width');
assert.match(fullPanel, /return Math\.max\(0, this\.viewportWidth\(\) - 30\)/);
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
assert.match(fullPanel, /justifyText: boolean/);
assert.match(fullPanel, /onJustifyTextChange/);
assert.match(fullPanel, /与阅读样式同步/);

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /reader_reading_settings_v1/);
assert.doesNotMatch(gateway, /\.request\(/,
  'Reader Settings must not misuse Reader Core or invent a Host command');

assert.match(controlPanel, /moduleSettings/);
assert.match(controlPanel, /fullSettings/);
assert.match(controlPanel, /ReaderSettingsModulePanel\(\{/);
assert.match(controlPanel, /ReaderSettingsFullPanel\(\{/);
assert.match(controlPanel, /justifyText: this\.appearanceSnapshot\.alignment === 'justify'/,
  'Settings justification must derive from the Appearance single truth');
assert.match(controlPanel, /onAppearanceAlignmentRequest\(this\.appearanceSnapshot\.alignment\)/,
  'Settings justification must reuse the existing Appearance mutation path');
assert.match(experience, /void this\.loadReaderSettingsSnapshot\(lifecycleToken\)/);
assert.match(experience, /this\.readerSettingsGateway\.update\(snapshot\)/);
assert.match(experience, /settingsSnapshot: this\.readerSettingsSnapshot/);

console.log('reader settings pure/static contract: PASS');
