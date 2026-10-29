#!/usr/bin/env node
// Explicit pure-function scenario matrix. Not referenced by builds, CI,
// contract tiers, scopes or other gates; run it only for a stated need.
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./reader-ts-module-loader.mjs', import.meta.url);

const root = '../entry/src/main/ets';
const widthClass = await import(`${root}/features/common/ReaderWidthClass.ts`);
const resolvers = await import(`${root}/features/common/ReaderSurfaceResolvers.ts`);
const layoutCapability = await import(`${root}/features/common/ReaderLayoutCapability.ts`);
const metricsModule = await import(`${root}/features/common/ReaderWindowMetrics.ts`);
const feedback = await import(`${root}/features/common/ReaderTransientFeedback.ts`);
const settlement = await import(`${root}/features/reading/ReaderPageSettlementTimeline.ts`);
const tts = await import(`${root}/features/reading/ReaderTtsWaveformModel.ts`);
const launch = await import(`${root}/features/reading/ReaderSessionLaunchPresentation.ts`);
const launchTimeline = await import(`${root}/features/reading/ReaderSessionLaunchTimeline.ts`);
const controlMotion = await import(`${root}/features/reading/ReaderControlMotionGeometry.ts`);
const scrollLayout = await import(`${root}/features/common/ReaderScrollLayout.ts`);
const frameStyle = await import(`${root}/features/common/ReaderFrameStyle.ts`);

const results = [];
function check(id, fn) {
  try {
    fn();
    results.push({ id, status: 'PASS' });
  } catch (error) {
    results.push({ id, status: 'FAIL', error: error.message });
  }
}
function finite(value) {
  assert.ok(Number.isFinite(value), `expected finite, received ${value}`);
}
function approx(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, received ${actual}`);
}
function finiteFrame(value, prefix = 'frame') {
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number') finite(item);
    else if (item !== null && typeof item === 'object') finiteFrame(item, `${prefix}.${key}`);
  }
}
const metrics = (width, height = 844, safeTop = 32, safeBottom = 20) =>
  new metricsModule.ReaderWindowMetricsSnapshot(
    new metricsModule.ReaderRectVp(0, 0, width, height),
    new metricsModule.ReaderRectVp(0, 0, width, height),
    new metricsModule.ReaderInsetsVp(0, safeTop, 0, safeBottom),
  );
const identity = (p) => p;
const launchCurves = {
  flight: identity, expand: identity, easeIn: identity, easeOut: identity, easeInOut: identity,
};
const launchGeometry = (() => {
  const geometry = launch.buildReaderSessionLaunchGeometry({
    source: {
      kind: 'quickAutoPage', left: 20, top: 300, width: 286, height: 196, revision: 1,
      actorId: 'matrix-source', visibleLeft: 0, visibleTop: 0, visibleRight: 286,
      visibleBottom: 196, cornerRadius: 8,
    },
    targetLeft: 10, targetTop: 20, capsuleWidth: 96,
    topBarExitDistance: 52, dockExitDistance: 348.557,
  });
  assert.ok(geometry, 'launch geometry fixture must resolve');
  return geometry;
})();

check('width-class-600-boundary', () => {
  assert.equal(widthClass.readerWidthClass(0), 'compact');
  assert.equal(widthClass.readerWidthClass(320), 'compact');
  assert.equal(widthClass.readerWidthClass(599), 'compact');
  assert.equal(widthClass.readerWidthClass(600), 'expanded');
  assert.equal(widthClass.readerWidthClass(800), 'expanded');
  assert.equal(widthClass.readerIsExpandedWidth(Number.NaN), false);
});

check('layout-capability-from-window-facts', () => {
  assert.equal(layoutCapability.readerExpandedLayout(metrics(599)), false);
  assert.equal(layoutCapability.readerExpandedLayout(metrics(600)), true);
  assert.equal(layoutCapability.readerExpandedLayout(metrics(1024, 768)), true);
  assert.equal(layoutCapability.readerExpandedLayout(metrics(Number.NaN)), false);
});

check('font-scale-control-and-bar-heights', () => {
  assert.equal(resolvers.readerReadableFontScale(0.8), 1);
  assert.equal(resolvers.readerReadableFontScale(1.5), 1.5);
  assert.equal(resolvers.readerReadableFontScale(Number.NaN), 1);
  assert.equal(resolvers.readerScaledControlHeight(44, 20, 1), 44);
  assert.equal(resolvers.readerScaledControlHeight(44, 20, 1.5), 54);
  assert.equal(resolvers.readerScaledControlHeight(44, 20, 2), 64);
  assert.equal(resolvers.readerScaledControlHeight(44, 20, 0.8), 44);
  assert.equal(resolvers.readerScaledBarHeight(58, 19.5, 2, 6), 58);
  assert.equal(resolvers.readerScaledBarHeight(58, 19.5, 3, 6), 71);
});

check('keyboard-and-safe-area-available-height', () => {
  const phone = metrics(390, 844, 32, 20);
  assert.equal(resolvers.readerAvailableWindowHeight(phone, 0), 812);
  assert.equal(resolvers.readerAvailableWindowHeight(phone, 700), 700, 'keyboard-resized measured page wins');
  assert.equal(resolvers.readerAvailableWindowHeight(phone, -1), 812);
  assert.equal(resolvers.readerAvailableWindowHeight(phone, Number.NaN), 812);
});

check('surface-max-height-and-width', () => {
  assert.equal(resolvers.readerSurfaceMaxHeight(812, 200), 612);
  assert.equal(resolvers.readerSurfaceMaxHeight(812, 200, 700), 700);
  assert.equal(resolvers.readerSurfaceMaxHeight(100, 200), 0);
  assert.equal(resolvers.readerSurfaceMaxHeight(Number.NaN, 20), 0);
  assert.equal(resolvers.readerDynamicSurfaceWidth(640, 390), 390);
  assert.equal(resolvers.readerDynamicSurfaceWidth(640, 800), 640);
  assert.equal(resolvers.readerDynamicSurfaceWidth(640, 200, 320), 320);
  assert.equal(resolvers.readerDynamicSurfaceWidth(Number.NaN, 390), 0);
});

check('scroll-layout-modes', () => {
  const geometry = { content: { startInset: 98, endInset: 66 } };
  const padding = scrollLayout.readerScrollLayout(geometry);
  assert.equal(padding.mode, 'padding');
  assert.equal(padding.startInset, 98);
  assert.equal(padding.endInset, 66);
  assert.equal(scrollLayout.readerScrollTopPadding(padding), 98);
  assert.equal(scrollLayout.readerScrollBottomPadding(padding), 66);
  assert.equal(scrollLayout.readerScrollStartOffset(padding), 0);
  assert.equal(scrollLayout.readerScrollEndOffset(padding), 0);
  const offset = scrollLayout.readerScrollLayout(geometry, { mode: 'contentOffset', extraEndInset: 10 });
  assert.equal(offset.mode, 'contentOffset');
  assert.equal(offset.endInset, 76);
  assert.equal(scrollLayout.readerScrollTopPadding(offset), 0);
  assert.equal(scrollLayout.readerScrollBottomPadding(offset), 0);
  assert.equal(scrollLayout.readerScrollStartOffset(offset), 98);
  assert.equal(scrollLayout.readerScrollEndOffset(offset), 76);
});

check('frame-style-defaults', () => {
  const style = frameStyle.readerFrameStyle({
    backgroundColor: '#fffdf8', headerBackground: '#eee9df', headerTransparent: true,
    footerBackground: '#fffdf8', footerSolid: true,
  });
  assert.equal(style.alignment, 'topStart');
  assert.equal(style.safeArea, 'none');
  assert.equal(style.clip, true);
  assert.equal(style.header.transparent, true);
  assert.equal(style.header.clip, false);
  assert.equal(style.footer.solid, true);
  assert.equal(style.footer.clip, true);
  const reading = frameStyle.readerFrameStyle({
    backgroundColor: '#1c1e1a', clip: false, alignment: 'top', safeArea: 'systemCutoutAll',
    headerBackground: '#1c1e1a', headerTransparent: true, footerBackground: '#1c1e1a',
  });
  assert.equal(reading.clip, false);
  assert.equal(reading.alignment, 'top');
  assert.equal(reading.safeArea, 'systemCutoutAll');
});

check('page-settlement-distance-velocity-clock', () => {
  const normal = new settlement.ReaderPageSettlementTimeline(0, 100, 390, 0, 0);
  assert.ok(normal.durationMs > 80 && normal.durationMs < 320);
  assert.equal(normal.position(0), 0);
  assert.equal(normal.position(normal.durationMs), 100);
  assert.equal(normal.finished(normal.durationMs), true);
  assert.equal(new settlement.ReaderPageSettlementTimeline(0, 0, 390, 0, 0).durationMs, 0);
  assert.equal(new settlement.ReaderPageSettlementTimeline(0, 100, 390, 0, 0, true).durationMs, 30);
  assert.equal(new settlement.ReaderPageSettlementTimeline(0, 1000, 1, 0, 0).durationMs, 320);
});

check('launch-motion-p0-and-p1-endpoints', () => {
  const start = launch.sampleReaderSessionLaunch(0, launchGeometry, launchCurves);
  assert.equal(start.phase, 'initial');
  assert.equal(start.finished, false);
  assert.equal(start.settled, false);
  assert.equal(start.sourceNeeded, true);
  assert.equal(start.controlsPresented, true);
  assert.equal(start.flight, 0);
  assert.equal(start.expansion, 0);
  assert.equal(start.leadingOpacity, 0);
  assert.equal(start.proxyLeft, launchGeometry.sourceLeft);
  assert.equal(start.proxyTop, launchGeometry.sourceTop);
  assert.equal(start.proxyWidth, launchGeometry.sourceWidth);
  assert.equal(start.proxyHeight, launchGeometry.sourceHeight);
  assert.equal(start.sourceSurfaceOpacity, 1);
  finiteFrame(start, 'launch.start');

  const settled = launch.sampleReaderSessionLaunch(2300, launchGeometry, launchCurves);
  assert.equal(settled.phase, 'settled');
  assert.equal(settled.settled, true);
  assert.equal(settled.finished, false);
  assert.equal(settled.flight, 1);
  assert.equal(settled.expansion, 1);

  const end = launch.sampleReaderSessionLaunch(3500, launchGeometry, launchCurves);
  assert.equal(end.phase, 'settled');
  assert.equal(end.finished, true);
  assert.equal(end.settled, true);
  assert.equal(end.sourceNeeded, false);
  assert.equal(end.controlsPresented, false);
  assert.equal(end.flight, 1);
  assert.equal(end.expansion, 1);
  assert.equal(end.leadingOpacity, 1);
  assert.equal(end.proxyWidth, launchGeometry.capsuleWidth);
  assert.equal(end.proxyHeight, launchTimeline.READER_SESSION_LAUNCH_DOT_SIZE_VP);
  assert.equal(end.proxyTop, launchGeometry.targetTop);
  assert.equal(end.footerTranslateX, 0);
  finiteFrame(end, 'launch.end');

  const reduced = launch.sampleReaderSessionLaunch(0, launchGeometry, launchCurves, true);
  assert.equal(reduced.timeMs, launchTimeline.READER_SESSION_LAUNCH_DURATION_MS);
  assert.equal(reduced.finished, true);
  assert.equal(reduced.settled, true);
});

check('control-motion-expand-collapse-endpoints', () => {
  const bounds = { width: 390, fullHeight: 736, quickHeight: 330, bottomGap: 0 };
  const quick = controlMotion.sampleReaderControlMotionComposition(
    { expansionProgress: 0, visibilityProgress: 1 }, bounds);
  const full = controlMotion.sampleReaderControlMotionComposition(
    { expansionProgress: 1, visibilityProgress: 1 }, bounds);
  const half = controlMotion.sampleReaderControlMotionComposition(
    { expansionProgress: 0.5, visibilityProgress: 1 }, bounds);

  assert.equal(quick.shell.y, 406);
  assert.equal(quick.content.height, 190);
  assert.equal(quick.content.width, 312);
  assert.equal(quick.content.y, 435);
  assert.equal(quick.contentSurface.y, 463);
  assert.equal(quick.contentSurface.height, 666);
  assert.equal(quick.navigation.y, 643);
  assert.equal(quick.navigation.opacity, 1);
  approx(quick.brightness.x, 338.44);
  assert.equal(quick.brightness.y, 435);

  assert.equal(full.shell.y, 0);
  assert.equal(full.content.height, 666);
  assert.equal(full.content.width, 364);
  assert.equal(full.content.y, 57);
  assert.equal(full.navigation.y, 663);
  assert.equal(full.navigation.opacity, 0);
  approx(full.brightness.x, 390);
  assert.equal(full.brightness.y, 29, 'brightness rail keeps its fixed full-content top');
  assert.equal(full.brightness.opacity, 0);
  assert.equal(half.content.height, 428);
  assert.ok(half.content.y > full.content.y && half.content.y < quick.content.y);
  finiteFrame(quick, 'control.quick');
  finiteFrame(full, 'control.full');
  finiteFrame(half, 'control.half');

  const hidden = controlMotion.sampleReaderControlMotionComposition(
    { expansionProgress: 0, visibilityProgress: 0 }, bounds);
  assert.equal(hidden.topBar.translateY, -8);
  assert.equal(hidden.dock.translateY, 18);
  assert.equal(hidden.topBar.opacity, 0);
  assert.equal(hidden.dock.opacity, 0);
});

check('waveform-reduce-motion-and-active-tail', () => {
  const motion = new tts.ReaderTtsWaveformMotion({ ease: identity, easeInOut: identity });
  motion.setPlaying(true, 0);
  const start = motion.sample(0);
  assert.equal(start.heights.length, tts.READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.scales.length, tts.READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.opacities.length, tts.READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.scales[0], 0.4);
  const reduced = motion.sample(1500, true);
  assert.equal(reduced.colorProgress, 1);
  assert.equal(reduced.scales.every((value) => value === 1), true);
  assert.equal(reduced.heights.every((value) => Number.isFinite(value)), true);

  const tail = new tts.ReaderTtsWaveformMotion({ ease: identity, easeInOut: identity });
  tail.setPlaying(true, 0);
  tail.setPlaying(false, 100);
  assert.equal(tail.active(300), true);
  assert.equal(tail.active(500), false);
  assert.equal(tail.sample(500).scales.every((value) => value === 1), true);
});

check('message-window-constants', () => {
  assert.equal(feedback.READER_FEEDBACK_BRIEF_MS, 2000);
  assert.equal(feedback.READER_FEEDBACK_EXTENDED_MS, 2200);
  assert.equal(feedback.READER_FEEDBACK_DEDUPE_MS, 2000);
  assert.equal(feedback.createReaderTransientToastState().duration, feedback.READER_FEEDBACK_BRIEF_MS);
});

const failures = results.filter((result) => result.status === 'FAIL');
console.log('UI parameter scenario matrix');
for (const result of results) console.log(`${result.status} ${result.id}${result.error ? `: ${result.error}` : ''}`);
console.log(`RESULT ${failures.length === 0 ? 'PASS' : 'FAIL'} (${results.length} checks)`);
if (failures.length > 0) process.exitCode = 1;
