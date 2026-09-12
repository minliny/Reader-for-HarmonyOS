import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ReaderControlGeometry,
  READER_CONTROL_BRIGHTNESS_MAX,
  READER_CONTROL_BRIGHTNESS_MIN,
  READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT,
  READER_CONTROL_CONTENT_SLOT_HEIGHT,
  READER_CONTROL_FULL_TTS_BOTTOM_GAP,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT,
  READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP,
  READER_CONTROL_HOME_TOP_ROW_HEIGHT,
  READER_CONTROL_PROGRESS_MAX,
  READER_CONTROL_PROGRESS_MIN,
  READER_CONTROL_PROGRESS_STEP,
  READER_CONTROL_REGULAR_DOCK_HEIGHT,
} from '../entry/src/main/ets/features/reading/ReaderControlGeometry.ts';
import {
  READER_FULL_PANEL_TOP,
  resolveReaderControlLayout,
} from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import {
  createDefaultReaderWindowMetrics,
} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {
  readerDirectoryContentHeight,
  readerDirectoryIsScrollable,
  readerDirectoryScrollY,
  READER_DIRECTORY_EDGE_FADE_HEIGHT,
  READER_DIRECTORY_LIST_PADDING_Y,
  READER_DIRECTORY_ROW_HEIGHT,
  READER_DIRECTORY_VIEWPORT_HEIGHT,
} from '../entry/src/main/ets/features/reading/ReaderDirectoryScrollGeometry.ts';
import {
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
} from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';

const phoneLayout = resolveReaderControlLayout(390, 844, false, createDefaultReaderWindowMetrics());
const tabletLayout = resolveReaderControlLayout(760, 960, true, createDefaultReaderWindowMetrics());
assert.equal(phoneLayout.topBarTop, 19);
assert.equal(READER_FULL_PANEL_TOP, 88);
assert.equal(phoneLayout.fullPanelTop, READER_FULL_PANEL_TOP);
assert.equal(READER_CONTROL_REGULAR_DOCK_HEIGHT, 330);
assert.equal(READER_CONTROL_CONTENT_SLOT_HEIGHT, 196);
assert.equal(READER_CONTROL_HOME_TOP_ROW_HEIGHT, 190);
assert.equal(READER_CONTROL_BRIGHTNESS_RAIL_HEIGHT, READER_CONTROL_HOME_TOP_ROW_HEIGHT,
  'home quick controls and brightness rail share the parent-owned height constraint');
assert.equal(READER_CONTROL_HOME_QUICK_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP +
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, 190.001,
  'the named Figma rounding adjustment must preserve the current exported child heights');
assert.equal(READER_CONTROL_FULL_TTS_BOTTOM_GAP, 19,
  'Full TTS keeps its own semantic anchor even while its value equals the Phone dock gap');

const phone = new ReaderControlGeometry(false);
const tablet = new ReaderControlGeometry(true);
assert.deepEqual({ ...phone }, {
  sheetH: 330,
  sheetRadiusBottom: 24,
  moduleNavH: 80,
  moduleNavBottomGap: 14,
  moduleNavRadiusTop: 12,
});
assert.deepEqual({ ...tablet }, {
  sheetH: 252,
  sheetRadiusBottom: 0,
  moduleNavH: 79,
  moduleNavBottomGap: 0,
  moduleNavRadiusTop: 0,
});

assert.equal(READER_CONTROL_PROGRESS_MIN, 0);
assert.equal(READER_CONTROL_PROGRESS_MAX, 100);
assert.equal(READER_CONTROL_PROGRESS_STEP, 0.1);
assert.equal(READER_CONTROL_BRIGHTNESS_MIN, 1);
assert.equal(READER_CONTROL_BRIGHTNESS_MAX, 100);
assert.equal(READER_TTS_RATE_MIN, 0.5);
assert.equal(READER_TTS_RATE_MAX, 2);
assert.equal(READER_TTS_RATE_STEP, 0.05);
assert.equal(READER_TTS_RATE_STEP_SCALE, 20);
assert.equal(READER_TTS_TIMER_MIN, 0);
assert.equal(READER_TTS_TIMER_MAX_MINUTES, 180);
assert.equal(READER_TTS_TIMER_MAX_SECONDS, 59);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const directory = await readFile(new URL('ReaderDirectoryModulePanel.ets', readingDir), 'utf8');
assert.equal(READER_DIRECTORY_VIEWPORT_HEIGHT, 142);
assert.equal(READER_DIRECTORY_ROW_HEIGHT, 29);
assert.equal(READER_DIRECTORY_LIST_PADDING_Y, 3);
assert.equal(READER_DIRECTORY_EDGE_FADE_HEIGHT, 18);
assert.equal(readerDirectoryContentHeight(0), 6);
assert.equal(readerDirectoryContentHeight(2), 64);
assert.equal(readerDirectoryContentHeight(4), 122);
assert.equal(readerDirectoryContentHeight(5), 151);
assert.equal(readerDirectoryIsScrollable(4), false,
  'short directory content must not paint scroll affordance fades');
assert.equal(readerDirectoryIsScrollable(5), true,
  'overflowing directory content must paint both edge fades');
assert.equal(readerDirectoryScrollY(0, 0), 0);
assert.equal(readerDirectoryScrollY(4, 2), 0,
  'short directory content must remain top-aligned instead of being centered');
assert.equal(readerDirectoryScrollY(5, 2), 1.5,
  'middle rows center while content still has room in both directions');
assert.equal(readerDirectoryScrollY(10, 9), 154,
  'the last row must clamp to contentHeight - viewportHeight');
assert.equal(readerDirectoryScrollY(10, -1), 0);
assert.equal(readerDirectoryScrollY(10, 10), 0);
const directoryList = await readFile(new URL('ReaderDirectoryList.ets', readingDir), 'utf8');
// The 142vp min-height lock moved from the in-panel List to the module panel's
// fixed-height Stack; the shared ReaderDirectoryList fills it at 100%.
assert.match(directory, /\.height\(READER_DIRECTORY_VIEWPORT_HEIGHT\)\s*\.clip\(true\)/);
assert.match(directoryList, /\.height\('100%'\)/);
assert.match(directory, /return readerDirectoryScrollY\(entries\.length, currentIndex\)/);
assert.match(directory, /DIRECTORY_EDGE_FADE_COLOR = '#D9FFFCF8'/);
assert.match(directory, /DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR = '#00FFFCF8'/);
assert.match(directory, /return readerDirectoryIsScrollable\(this\.projectedEntries\.length\)/);
assert.match(directory, /direction: GradientDirection\.Bottom,[\s\S]*colors: \[\[DIRECTORY_EDGE_FADE_COLOR, 0\], \[DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR, 1\]\]/);
assert.match(directory, /direction: GradientDirection\.Top,[\s\S]*colors: \[\[DIRECTORY_EDGE_FADE_COLOR, 0\], \[DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR, 1\]\]/);
assert.equal((directory.match(/\.height\(READER_DIRECTORY_EDGE_FADE_HEIGHT\)/g) ?? []).length, 2,
  'the directory viewport must own one 18vp fade at each edge');
assert.match(directory, /\.height\(READER_DIRECTORY_VIEWPORT_HEIGHT\)[\s\S]*\.hitTestBehavior\(HitTestMode\.Transparent\)/);
assert.doesNotMatch(directory, /currentIndex \* 29 - 67 \+ 14\.5/);

const controlPanel = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
assert.match(controlPanel, /this\.moduleNavBar\(\)/,
  'navigation shares the production render owner');
assert.match(controlPanel, /@Prop @Watch\('onLayoutChanged'\) layout: ReaderControlLayoutSnapshot/,
  'all reader-control states must consume one owner-resolved layout snapshot');
assert.match(controlPanel, /readerControlMotionBounds\(this\.layout\.fullPanelWidth/);
assert.match(controlPanel,
  /private dockTop\(\): number\s*\{\s*return this\.layout\.viewportHeight\s*-\s*this\.layout\.dockBottomGap\s*-\s*this\.layout\.fullPanelHeight/);
assert.match(controlPanel, /this\.layout\.fullPanelRightGap/);
assert.doesNotMatch(controlPanel, /READER_CONTROL_MODULE_NAV_MAX_WIDTH/);

const search = await readFile(new URL('ReaderQuickSearchPanel.ets', readingDir), 'utf8');
assert.match(search, /QUICK_SEARCH_RESULTS_HEIGHT_PHONE = 141/);
assert.match(search, /QUICK_SEARCH_RESULTS_HEIGHT_TABLET = 134/);
assert.match(search, /return this\.isTablet \? QUICK_SEARCH_RESULTS_HEIGHT_TABLET : QUICK_SEARCH_RESULTS_HEIGHT_PHONE/);

const autoQuick = await readFile(new URL('ReaderAutoPagePanel.ets', readingDir), 'utf8');
assert.match(autoQuick, /QUICK_AUTO_PAGE_PANEL_HEIGHT_PHONE = QUICK_AUTO_PAGE_PANEL_PADDING_Y \* 2 \+[\s\S]*QUICK_AUTO_PAGE_SPEED_HEIGHT_PHONE/);
assert.match(autoQuick, /QUICK_AUTO_PAGE_PANEL_HEIGHT_TABLET = QUICK_AUTO_PAGE_PANEL_PADDING_Y \* 2 \+[\s\S]*QUICK_AUTO_PAGE_SPEED_HEIGHT_TABLET/);

const ttsModule = await readFile(new URL('ReaderTtsModulePanel.ets', readingDir), 'utf8');
assert.match(ttsModule, /TTS_MODULE_PANEL_HEIGHT_PHONE = 196/);
assert.match(ttsModule, /TTS_MODULE_PANEL_HEIGHT_TABLET = 190/);
assert.match(ttsModule, /min: READER_TTS_RATE_MIN/);
assert.match(ttsModule, /max: READER_TTS_RATE_MAX/);

const ttsFull = await readFile(new URL('ReaderTtsFullPanel.ets', readingDir), 'utf8');
assert.match(ttsFull, /return \(this\.panelWidth\(\) - TTS_FULL_GRABBER_WIDTH\) \/ 2/);
assert.match(ttsFull, /return this\.panelHeight\(\) - TTS_FULL_SCROLL_TOP - bottomInset/);
assert.match(ttsFull, /Math\.min\(designHeight, this\.availableHeight\)/,
  'full TTS must clamp its Figma height to the live panel budget');
assert.match(ttsFull, /READER_TTS_TIMER_MAX_MINUTES/);
assert.match(ttsFull, /READER_TTS_TIMER_MAX_SECONDS/);

console.log('reader control geometry parameter contract: PASS');
