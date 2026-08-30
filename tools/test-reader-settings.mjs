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
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
} from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';

const initial = createDefaultReaderSettingsSnapshot();
assert.deepEqual(initial, {
  version: 3,
  screenDirection: 'system',
  navigationMode: 'paged',
  pageTransition: 'slide',
  screenTimeout: 'system',
  hideStatusBar: true,
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
  navigationMode: 'paged',
  pageTransition: 'cover',
  screenTimeout: 'alwaysOn',
  hideStatusBar: false,
  hideNavigationBar: true,
  extendIntoCutout: true,
  justifyText: false,
  alignPageBottom: true,
  volumeKeysTurnPage: true,
  stopTtsOnScreenOff: true,
  longPressSelectText: false,
});
assert.equal(normalized.screenDirection, 'landscape');
assert.equal(readerPageTurnStyle(normalized), 'cover');
assert.equal(normalized.screenTimeout, 'alwaysOn');
assert.equal(normalized.hideStatusBar, false, 'V3 must preserve the explicit user choice');
assert.equal(normalized.hideNavigationBar, true);
assert.equal(normalized.extendIntoCutout, true);
assert.equal(normalized.volumeKeysTurnPage, true);
assert.equal(normalized.stopTtsOnScreenOff, true);
assert.equal(normalized.justifyText, false);
assert.equal(normalized.alignPageBottom, true);
assert.equal(normalized.longPressSelectText, false);

const migratedV1 = normalizeReaderSettingsSnapshot({
  version: 1,
  screenDirection: 'portrait',
  pageTurnStyle: 'scroll',
  screenTimeout: 'fiveMinutes',
  hideStatusBar: true,
  hideNavigationBar: false,
  extendIntoCutout: false,
  justifyText: true,
  alignPageBottom: true,
  volumeKeysTurnPage: true,
  stopTtsOnScreenOff: true,
  longPressSelectText: true,
});
assert.equal(migratedV1.version, 3);
assert.equal(migratedV1.navigationMode, 'continuous');
assert.equal(migratedV1.pageTransition, 'slide');
assert.equal(readerPageTurnStyle(migratedV1), 'scroll');
assert.equal(migratedV1.justifyText, false, 'Appearance remains the only justification owner');
assert.equal(migratedV1.hideStatusBar, true, 'legacy settings migrate to the immersive default');

const migratedV2 = normalizeReaderSettingsSnapshot({
  version: 2,
  screenDirection: 'system',
  navigationMode: 'paged',
  pageTransition: 'slide',
  screenTimeout: 'system',
  hideStatusBar: false,
  hideNavigationBar: true,
  extendIntoCutout: false,
  justifyText: false,
  alignPageBottom: false,
  volumeKeysTurnPage: false,
  stopTtsOnScreenOff: false,
  longPressSelectText: false,
});
assert.equal(migratedV2.version, 3);
assert.equal(migratedV2.hideStatusBar, true,
  'V2 false was the old product default and must migrate once rather than override V3');
assert.equal(migratedV2.hideNavigationBar, true, 'unrelated legacy choices must survive migration');

assert.notStrictEqual(copyReaderSettingsSnapshot(initial), initial);
const noAnimation = setReaderPageTurnStyle(initial, 'none');
assert.equal(readerPageTurnStyle(noAnimation), 'none');
assert.notStrictEqual(noAnimation, initial);
for (const style of ['cover', 'slide', 'scroll', 'none']) {
  const changed = setReaderPageTurnStyle(initial, style);
  assert.equal(readerPageTurnStyle(changed), style);
}
assert.equal(setReaderPageTurnStyle(initial, 'scroll').navigationMode, 'continuous');
assert.equal(setReaderPageTurnStyle(initial, 'cover').pageTransition, 'cover');
assert.equal(readerPageTransitionUsesPreparedPages(setReaderPageTurnStyle(initial, 'cover')), true);
assert.equal(readerPageTransitionUsesPreparedPages(setReaderPageTurnStyle(initial, 'scroll')), false);
assert.throws(() => setReaderSettingsToggle(initial, 'justifyText', true), /unavailable Reader Host/);
assert.equal(setReaderSettingsToggle(initial, 'alignPageBottom', true).alignPageBottom, true);
assert.equal(setReaderSettingsToggle(initial, 'longPressSelectText', true).longPressSelectText, true);
assert.equal(setReaderSettingsToggle(initial, 'volumeKeysTurnPage', true).volumeKeysTurnPage, true);
assert.equal(setReaderSettingsToggle(initial, 'stopTtsOnScreenOff', true).stopTtsOnScreenOff, true);
assert.equal(setReaderSettingsToggle(initial, 'hideStatusBar', false).hideStatusBar, false);
assert.equal(setReaderSettingsToggle(initial, 'hideNavigationBar', true).hideNavigationBar, true);
assert.equal(setReaderSettingsToggle(initial, 'extendIntoCutout', true).extendIntoCutout, true);
assert.equal(setReaderScreenDirection(initial, 'portrait').screenDirection, 'portrait');
assert.equal(setReaderScreenDirection(initial, 'landscape').screenDirection, 'landscape');
assert.equal(setReaderScreenTimeout(initial, 'alwaysOn').screenTimeout, 'alwaysOn');
assert.equal(setReaderScreenTimeout(initial, 'fiveMinutes').screenTimeout, 'fiveMinutes');

assert.equal(isReaderScreenDirectionAvailable('system'), true);
assert.equal(isReaderScreenDirectionAvailable('portrait'), true);
assert.equal(isReaderScreenDirectionAvailable('landscape'), true);
assert.equal(isReaderPageTurnStyleAvailable('slide'), true);
assert.equal(isReaderPageTurnStyleAvailable('none'), true);
assert.equal(isReaderPageTurnStyleAvailable('cover'), true);
assert.equal(isReaderPageTurnStyleAvailable('scroll'), true);
assert.equal(isReaderScreenTimeoutAvailable('system'), true);
assert.equal(isReaderScreenTimeoutAvailable('alwaysOn'), true);
assert.equal(isReaderScreenTimeoutAvailable('fiveMinutes'), true);
assert.equal(isReaderSettingsToggleAvailable('hideStatusBar'), true);
assert.equal(isReaderSettingsToggleAvailable('hideNavigationBar'), true);
assert.equal(isReaderSettingsToggleAvailable('extendIntoCutout'), true);
assert.equal(isReaderSettingsToggleAvailable('justifyText'), false);
assert.equal(isReaderSettingsToggleAvailable('alignPageBottom'), true);
assert.equal(isReaderSettingsToggleAvailable('longPressSelectText'), true);
assert.equal(isReaderSettingsToggleAvailable('stopTtsOnScreenOff'), true);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderSettingsModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderSettingsFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderSettingsGateway.ts', readingDir), 'utf8');
const controlPanel = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const coordinator = await readFile(new URL('../../app/ReaderWindowCoordinator.ts', readingDir), 'utf8');

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
assert.match(fullPanel, /Image\(\$r\('app\.media\.rc_settings'\)\)[\s\S]*\.fillColor\(this\.palette\(\)\.ink\)/,
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
assert.match(gateway, /decoded\.version !== 3[\s\S]*?store\.put\(READER_SETTINGS_SNAPSHOT_KEY, JSON\.stringify\(normalized\)\)/,
  'legacy settings migration must be persisted so V3 owns subsequent explicit choices');
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
assert.match(controlPanel, /onScreenDirectionChange/);
assert.match(controlPanel, /onScreenTimeoutChange/);
assert.match(experience, /ReaderWindowCoordinator\.requestReaderWindowPolicy/);
assert.match(experience, /ReaderWindowCoordinator\.requestAppWindowPolicy/);
assert.match(experience,
  /aboutToAppear\(\): void \{[\s\S]*?this\.applyWindowChrome\(\);[\s\S]*?this\.applyWindowPolicyForChromeOwner\(\)/,
  'mounting must resolve policy through visible window ownership');
assert.match(experience,
  /private onWindowChromeActiveChanged\(\): void \{[\s\S]*?this\.applyWindowChrome\(\);[\s\S]*?this\.applyWindowPolicyForChromeOwner\(\)/,
  'the visible-reader transition must apply chrome and system-bar policy together');
assert.match(experience,
  /private applyWindowPolicyForChromeOwner\(\): void \{[\s\S]*?if \(this\.windowChromeActive\)[\s\S]*?this\.applyReaderWindowPolicy\(this\.readerSettingsSnapshot\)[\s\S]*?ReaderWindowCoordinator\.requestAppWindowPolicy\(\)/,
  'a hidden warm reader must preserve the app policy until it owns the screen');
assert.match(experience,
  /safeWindowSettingsFallback\([\s\S]*?version: 3[\s\S]*?hideStatusBar: true/,
  'a Host failure must keep the requested immersive status-bar default');
assert.match(experience, /ReaderScreenAwakeLease/);
assert.match(experience, /this\.screenAwakeLease\?\.configure\(snapshot\.screenTimeout, this\.appForeground\)/);
assert.match(experience, /this\.screenAwakeLease\?\.rearm\(\)/);
assert.match(coordinator, /setPreferredOrientation/);
assert.match(coordinator, /setWindowKeepScreenOn/);
assert.equal((coordinator.match(/setSpecificSystemBarEnabled/g) ?? []).length, 6,
  'reader/app policies must each own status, navigation and navigation-indicator restoration');
assert.match(coordinator, /AUTO_ROTATION_UNSPECIFIED/,
  'follow-system orientation must respect the user rotation-lock policy');

console.log('reader settings pure/static contract: PASS');
