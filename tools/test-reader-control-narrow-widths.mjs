import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_CONTENT_PADDING_LEFT,
  READER_CONTROL_CONTENT_PADDING_RIGHT,
  READER_CONTROL_TOP_COMPONENT_GAP,
} from '../entry/src/main/ets/features/reading/ReaderControlGeometry.ts';
import {
  resolveReaderControlLayout,
} from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import {
  createDefaultReaderWindowMetrics,
} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const read = (name) => readFileSync(
  new URL(`../entry/src/main/ets/features/reading/${name}`, import.meta.url),
  'utf8',
);
const WIDTHS = [320, 360, 365.71, 390, 500, 599, 600, 720, 760, 840];
const EPSILON = 0.000001;

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: ${actual} !== ${expected}`);
}

function regularContentSlotWidth(dockWidth) {
  return Math.max(0, dockWidth - READER_CONTROL_CONTENT_PADDING_LEFT -
    READER_CONTROL_CONTENT_PADDING_RIGHT - READER_CONTROL_TOP_COMPONENT_GAP -
    READER_CONTROL_BRIGHTNESS_RAIL_WIDTH);
}

for (const viewportWidth of WIDTHS) {
  const layout = resolveReaderControlLayout(
    viewportWidth,
    960,
    viewportWidth >= 600,
    createDefaultReaderWindowMetrics(),
  );
  const expanded = layout.widthClass === 'expanded';
  const slotWidth = regularContentSlotWidth(layout.dockWidth);
  const moduleDesignWidth = expanded ? 262 : 286;
  const moduleWidth = Math.min(moduleDesignWidth, slotWidth);
  assert.ok(moduleWidth <= slotWidth + EPSILON, `module root overflows at ${viewportWidth}`);

  const moduleInnerWidth = Math.max(0, moduleWidth - 22);
  const autoChapterWidth = expanded ? 56 : 62;
  const autoRunningWidth = expanded ? 74 : 82;
  const autoActorGap = expanded ? 18.25 : 20.25;
  const autoActorBudget = Math.max(0, moduleInnerWidth - 7.75 - 9.75 - autoActorGap * 2);
  const autoActorScale = Math.min(
    1,
    autoActorBudget / (autoChapterWidth * 2 + autoRunningWidth),
  );
  const autoNextWidth = autoChapterWidth * autoActorScale;
  const autoNextX = 7.75 + autoNextWidth + autoActorGap +
    autoRunningWidth * autoActorScale + autoActorGap;
  assert.ok(autoNextX + autoNextWidth <= moduleInnerWidth + EPSILON,
    `Quick Auto next actor overflows at ${viewportWidth}`);
  const autoStopX = Math.max(0, moduleInnerWidth - 24) * 2 / 3;
  assert.ok(autoStopX + 24 <= moduleInnerWidth + EPSILON,
    `Quick Auto stop actor overflows at ${viewportWidth}`);

  const ttsPlaybackInnerWidth = Math.max(0, moduleWidth - 44);
  const ttsControlWidth = Math.min(128, ttsPlaybackInnerWidth);
  const ttsLabelWidth = Math.min(106, Math.max(0, ttsPlaybackInnerWidth - ttsControlWidth));
  assert.ok(ttsLabelWidth + ttsControlWidth <= ttsPlaybackInnerWidth + EPSILON,
    `TTS module playback overflows at ${viewportWidth}`);

  const rateValueWidth = expanded ? 30 : 54;
  const rateSliderWidth = Math.min(
    116,
    Math.max(0, ttsPlaybackInnerWidth - 72 - rateValueWidth),
  );
  assert.ok(72 + rateSliderWidth + rateValueWidth <= ttsPlaybackInnerWidth + EPSILON,
    `TTS module rate row overflows at ${viewportWidth}`);

  const appearanceLeft = expanded ? 12 : 11;
  const appearanceRight = expanded ? 12 : 13;
  const appearanceSectionWidth = Math.max(0, moduleWidth - appearanceLeft - appearanceRight);
  const appearanceCellWidth = Math.min(
    expanded ? 56.5 : 62.5,
    Math.max(0, (appearanceSectionWidth - 12) / 4),
  );
  assert.ok(appearanceCellWidth * 4 + 12 <= appearanceSectionWidth + EPSILON,
    `appearance grid overflows at ${viewportWidth}`);

  const autoPanelWidth = Math.min(364, layout.dockWidth);
  const autoContentWidth = Math.min(314, Math.max(0, autoPanelWidth - 58));
  const autoSectionWidth = Math.max(0, autoContentWidth - 8);
  const fullAutoNextX = Math.min(224.25, Math.max(0, autoSectionWidth - 72 - 9.75));
  assert.ok(fullAutoNextX + 72 <= autoSectionWidth + EPSILON,
    `Full Auto next actor overflows at ${viewportWidth}`);
  assert.ok(Math.min(306, autoSectionWidth) <= autoSectionWidth + EPSILON,
    `Full Auto speed section overflows at ${viewportWidth}`);

  const fullTtsPanelWidth = layout.fullPanelWidth;
  const fullTtsScrollWidth = Math.max(0, fullTtsPanelWidth - 28);
  const fullTtsPadding = expanded ? 12 : 11;
  const fullTtsTimerWidth = Math.max(0, fullTtsScrollWidth - fullTtsPadding * 2 - 8);
  const fullTtsWheelsWidth = Math.min(278, fullTtsTimerWidth);
  const fullTtsWheelWidth = Math.min(122, Math.max(0, (fullTtsWheelsWidth - 32) / 2));
  assert.ok(fullTtsWheelsWidth <= fullTtsTimerWidth + EPSILON,
    `Full TTS wheel row overflows at ${viewportWidth}`);
  assert.ok(fullTtsWheelWidth * 2 + 32 <= fullTtsWheelsWidth + EPSILON,
    `Full TTS wheel children overflow at ${viewportWidth}`);
}

const phone = resolveReaderControlLayout(390, 844, false, createDefaultReaderWindowMetrics());
const phoneSlot = regularContentSlotWidth(phone.dockWidth);
close(phoneSlot, 286, 'phone reference module width');
close(phoneSlot - 22 - 9.75 - 62, 192.25, 'phone Quick Auto next reference x');
close(Math.min(224.25, Math.max(0, 306 - 72 - 9.75)), 224.25,
  'phone Full Auto next reference x');

const tablet = resolveReaderControlLayout(760, 960, true, createDefaultReaderWindowMetrics());
const tabletSlot = regularContentSlotWidth(tablet.dockWidth);
close(tabletSlot, 262, 'tablet reference module width');
close(tabletSlot - 22 - 9.75 - 56, 174.25, 'tablet Quick Auto next reference x');

const replace = read('ReaderReplaceQuickPanel.ets');
const appearance = read('ReaderAppearanceModulePanel.ets');
const settings = read('ReaderSettingsModulePanel.ets');
const ttsModule = read('ReaderTtsModulePanel.ets');
const autoQuick = read('ReaderAutoPagePanel.ets');
const autoFull = read('ReaderAutoPageFullPanel.ets');
const ttsFull = read('ReaderTtsFullPanel.ets');

for (const [name, source] of [
  ['Replace', replace],
  ['Appearance', appearance],
  ['Settings', settings],
  ['TTS module', ttsModule],
  ['Quick Auto', autoQuick],
]) {
  assert.match(source, /\.width\('100%'\)\s*\.constraintSize\(\{ maxWidth: this\.panelWidth\(\) \}\)/,
    `${name} root must fill a narrow slot and cap at its Figma width`);
}

assert.match(replace, /private ruleRow[\s\S]*\.layoutWeight\(1\)[\s\S]*maxWidth: this\.ruleTextWidth\(\)/);
assert.match(replace, /\.layoutWeight\(kind === 'management' \? 1 : 0\)/,
  'Replace management action must consume only the footer remainder');

assert.match(appearance, /private themeGridRow[\s\S]*Row\(\{ space: 4 \}\)[\s\S]*\.layoutWeight\(1\)/);
assert.match(appearance, /private fontGridRow[\s\S]*Row\(\{ space: 4 \}\)[\s\S]*\.layoutWeight\(1\)/);
assert.doesNotMatch(appearance, /position\(\{ x: \(index % 4\)/,
  'Appearance cells must not retain absolute four-column positions');

assert.match(settings, /padding\(\{ left: 11, right: 11, top: 13, bottom: 17 \}\)/);
assert.match(settings, /private segmentRow[\s\S]*\.width\('100%'\)/);

assert.match(autoQuick, /private primaryControls\(\)[\s\S]*Row\(\{ space: this\.primaryActorGap\(\) \}\)/);
assert.match(autoQuick, /right: this\.chapterRightGap\(\)/);
assert.match(autoQuick, /private stopTrack\(\)[\s\S]*Blank\(\)\.layoutWeight\(this\.stopLeftWeight\(\)\)/);
assert.doesNotMatch(autoQuick, /x: previous \? QUICK_AUTO_PAGE_PREVIOUS_X/,
  'Quick Auto next must not retain an absolute x');

assert.match(ttsModule,
  /maxWidth: TTS_MODULE_PLAYBACK_LABEL_WIDTH[\s\S]*\.width\(TTS_MODULE_PLAYBACK_CONTROL_WIDTH\)/,
  'TTS playback label must yield to the fixed control actor');
assert.match(ttsModule,
  /maxWidth: TTS_MODULE_RATE_SLIDER_WIDTH[\s\S]*\.width\(this\.rateValueWidth\(\)\)/,
  'TTS rate slider must consume only the remaining row width');

assert.match(autoFull, /position\(\{ x: this\.persistentChapterX\(previous\), y: 5 \}\)/);
assert.match(autoFull,
  /private persistentChapterX\(previous: boolean\): number \{[\s\S]*Math\.min\([\s\S]*designX,[\s\S]*this\.sectionInnerWidth\(\) - this\.persistentChapterWidth\(\) - rightGap/,
  'Full Auto next actor must preserve its motion endpoint only while it fits');
assert.match(autoFull, /return Math\.min\(designWidth, this\.sectionInnerWidth\(\)\)/,
  'Full Auto persistent speed section must clamp to the live section');

assert.doesNotMatch(ttsFull, /\.width\(278\)/,
  'Full TTS must not retain the overflowing wheel-row width');
assert.match(ttsFull, /\.width\(this\.timerWheelsWidth\(\)\)/);
assert.equal((ttsFull.match(/\.width\(this\.timerWheelWidth\(\)\)/g) ?? []).length, 5,
  'both wheel containers and all wheel text tracks must share the clamp');

console.log(`reader control narrow-width contract: PASS (${WIDTHS.length} viewport widths)`);
