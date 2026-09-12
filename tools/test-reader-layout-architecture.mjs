import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ReaderInsetsVp,
  ReaderRectVp,
  ReaderWindowMetricsSnapshot,
} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {
  READER_FULL_PANEL_HEIGHT_PHONE,
  READER_FULL_PANEL_MAX_WIDTH_PHONE,
  resolveReaderControlLayout,
  resolveReaderReadingLayout,
} from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';

function metrics({
  systemTop = 0,
  cutoutLeft = 0,
  gestureBottom = 0,
  navigationBottom = 0,
  keyboardBottom = 0,
  systemFontScale = 1,
} = {}) {
  return new ReaderWindowMetricsSnapshot(
    new ReaderRectVp(0, 0, 390, 844),
    new ReaderRectVp(0, 0, 390, 844),
    new ReaderInsetsVp(0, systemTop, 0, 0),
    new ReaderInsetsVp(cutoutLeft, 0, 0, 0),
    new ReaderInsetsVp(0, 0, 0, gestureBottom),
    new ReaderInsetsVp(0, 0, 0, navigationBottom),
    new ReaderInsetsVp(0, 0, 0, keyboardBottom),
    3,
    systemFontScale,
    1,
    true,
  );
}

const phoneReading = resolveReaderReadingLayout(390, 844, false, metrics({ systemTop: 48 }));
assert.equal(phoneReading.widthClass, 'compact');
assert.equal(phoneReading.contentTop, 72, 'Figma top remains the minimum screen-origin anchor');
assert.equal(phoneReading.contentLeft, 32);
assert.equal(phoneReading.contentRight, 32);
assert.equal(phoneReading.bodyWidth(), 326);

const scaledTitle = resolveReaderReadingLayout(390, 844, false, metrics({ systemFontScale: 1.2 }));
assert.equal(scaledTitle.titleTrackHeightVp, 28.75 * 1.2 + 18);
assert.equal(scaledTitle.bodyHeight(true), 844 - 72 - 47.99 - scaledTitle.titleTrackHeightVp);
const twoLineTitleHeight = 28.75 * 1.2 * 2;
assert.equal(
  scaledTitle.bodyHeightAfterTitle(twoLineTitleHeight),
  844 - 72 - 47.99 - twoLineTitleHeight - 18,
  'a wrapped title must consume every measured title line before body pagination',
);
assert.equal(
  scaledTitle.bodyHeightAfterTitle(0),
  844 - 72 - 47.99,
  'non-title pages must retain the full body track',
);

const cutoutReading = resolveReaderReadingLayout(390, 844, false, metrics({ cutoutLeft: 40 }));
assert.equal(cutoutReading.contentLeft, 40);
assert.equal(cutoutReading.contentRight, 40,
  'a one-sided cutout must preserve a centred text track with equal optical margins');
assert.equal(cutoutReading.bodyWidth(), 310,
  'pagination and rendering must consume the same symmetrically narrowed body width');
const extendedCutoutReading = resolveReaderReadingLayout(390, 844, false,
  metrics({ cutoutLeft: 40 }), true);
assert.equal(extendedCutoutReading.contentLeft, 32,
  'extend-into-cutout removes only the cutout constraint while preserving the authored content inset');

const phoneControl = resolveReaderControlLayout(
  390,
  844,
  false,
  metrics({ systemTop: 48, gestureBottom: 24 }),
);
assert.equal(phoneControl.topBarTop, 56, 'top bar clears the visible system/cutout edge by 8vp');
assert.equal(phoneControl.topBarWidth, 360);
assert.equal(phoneControl.dockBottomGap, 24);
assert.equal(phoneControl.dockWidth, READER_FULL_PANEL_MAX_WIDTH_PHONE);
assert.equal(phoneControl.fullPanelHeight, 844 - 88 - 24,
  'full panel height is capped by the live viewport and interactive bottom inset');
assert.ok(phoneControl.fullPanelHeight < READER_FULL_PANEL_HEIGHT_PHONE);

const narrowControl = resolveReaderControlLayout(320, 700, false, metrics());
assert.equal(narrowControl.topBarWidth, 290);
assert.equal(narrowControl.dockWidth, 294);
assert.equal(narrowControl.fullPanelWidth, 294);

const splitTablet = resolveReaderControlLayout(540, 700, true, metrics());
assert.equal(splitTablet.widthClass, 'compact', 'window size, not physical device type, owns layout class');

const tabletControl = resolveReaderControlLayout(760, 960, true, metrics({ navigationBottom: 20 }));
assert.equal(tabletControl.widthClass, 'expanded');
assert.equal(tabletControl.topBarWidth, 702);
assert.equal(tabletControl.dockWidth, 340);
assert.equal(tabletControl.fullPanelWidth, 720);
assert.equal(tabletControl.fullPanelHeight, 852);

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const ability = read('entry/src/main/ets/entryability/EntryAbility.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const shell = read('entry/src/main/ets/features/shell/ReaderShell.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const pageTurnStage = read('entry/src/main/ets/features/reading/ReaderPageTurnStage.ets');
const surface = read('entry/src/main/ets/features/reading/ReadingSurface.ets');
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');

assert.match(ability, /ReaderWindowCoordinator\.install\(win\)/,
  'the Ability must delegate all window setup to the single coordinator');
assert.match(ability, /ReaderWindowCoordinator\.reapplyWindowPolicy\(\)/,
  'foreground restoration must reapply the active reader/app window policy');
assert.doesNotMatch(ability, /statusBarHeightPx|setWindowSystemBarProperties/,
  'the Ability must not retain a second status-bar snapshot or style writer');
assert.match(coordinator, /windowSizeChange/);
assert.match(coordinator, /avoidAreaChange/);
for (const type of ['TYPE_SYSTEM', 'TYPE_CUTOUT', 'TYPE_SYSTEM_GESTURE',
  'TYPE_NAVIGATION_INDICATOR', 'TYPE_KEYBOARD']) {
  assert.ok(coordinator.includes(type), `window metrics must include ${type}`);
}
assert.match(coordinator,
  /statusBarColor: request\.style\.underlayColor,[\s\S]*navigationBarColor: request\.style\.underlayColor,[\s\S]*statusBarContentColor: contentColor/,
  'system-bar underlay and semantic content tone must change atomically from one style');
assert.match(coordinator, /while \(ReaderWindowCoordinator\.mainWindow !== undefined[\s\S]*desiredChromeRevision/,
  'asynchronous chrome writes must use a last-write-wins revision loop');

assert.doesNotMatch(index, /statusBarHeightPx/);
assert.match(index, /readerContentSafeTop\(ReaderWindowCoordinator\.metrics\(\)\)/,
  'non-reader content must use the same live safe-top source');
assert.doesNotMatch(shell, /\.padding\(\{ top:/,
  'ReaderShell must not add a second status-bar offset');
assert.match(shell,
  /expandSafeArea\(\[SafeAreaType\.SYSTEM\], \[SafeAreaEdge\.TOP, SafeAreaEdge\.BOTTOM\]\)/,
  'the themed reader background must paint continuously behind both system bars');
assert.match(shell, /windowChromeOverlayActive:[\s\S]*this\.route === 'directory'[\s\S]*this\.sourceSwitchVisible/,
  'fixed-light reader overlays must explicitly own a dark system-content tone');

assert.match(experience, /ReaderPageTurnStage\(\{[\s\S]*layout: this\.readingLayout\(\)/,
  'the reading owner must pass its single layout snapshot into the page-turn stage');
assert.match(pageTurnStage, /ReadingSurface\(\{[\s\S]*layout: this\.layout/,
  'the page-turn stage must forward that same layout snapshot to every physical page');
assert.match(experience,
  /ReaderControlPanel\(\{[\s\S]*layout: this\.controlLayout\(this\.readerWindowMetricsRevision\)/,
  'control geometry must observe metrics revisions even when IME-only changes leave the reading layout key unchanged');
assert.match(experience, /@StorageLink\('readerWindowMetricsRevision'\)/);
assert.match(experience, /reflowAfterWindowGeometryChange\(\)/);
assert.match(surface, /@Prop @Watch\('onHighlightContentChanged'\) layout: ReaderReadingLayoutSnapshot/);
assert.match(surface, /\.padding\(this\.contentInsets\(\)\)/);
assert.match(control, /@Prop @Watch\('onLayoutChanged'\) layout: ReaderControlLayoutSnapshot/);
assert.doesNotMatch(control, /@Prop availableWidth|@Prop isTablet/,
  'control composition must not receive redundant raw width and physical-form parameters');

console.log('reader layout architecture contract: PASS');
