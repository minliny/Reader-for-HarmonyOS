import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleReaderControlMotionComposition } from '../../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import { ReaderPageSettlementTimeline } from '../../entry/src/main/ets/features/reading/ui/ReaderPageSettlementTimeline.ts';
import { buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch }
  from '../../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts';
import { READER_TTS_WAVEFORM_BAR_COUNT, ReaderTtsWaveformMotion }
  from '../../entry/src/main/ets/features/reading/ui/ReaderTtsWaveformModel.ts';
import { createReaderTransientToastState, READER_FEEDBACK_BRIEF_MS, READER_FEEDBACK_DEDUPE_MS, READER_FEEDBACK_EXTENDED_MS }
  from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import { readerAvailableWindowHeight, readerDynamicSurfaceWidth, readerReadableFontScale, readerScaledBarHeight,
  readerScaledControlHeight, readerSurfaceMaxHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts';
import { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot }
  from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerIsExpandedWidth, readerWidthClass } from '../../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import { readerFrameStyle } from '../../entry/src/main/ets/ui/layout/ReaderFrameStyle.ts';
import { readerExpandedLayout } from '../../entry/src/main/ets/ui/layout/ReaderLayoutCapability.ts';
import { ReaderPageGeometry } from '../../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts';
import { readerScrollBottomPadding, readerScrollEndOffset, readerScrollLayout, readerScrollStartOffset, readerScrollTopPadding }
  from '../../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts';

function approx(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) <= 1e-6, `expected ${expected}, received ${actual}`);
}

function expectFiniteFrame(value: object, path: string): void {
  for (const [key, item] of Object.entries(value)) {
    const member = `${path}.${key}`;
    if (typeof item === 'number') assert.ok(Number.isFinite(item), `${member} must be finite`);
    else if (item !== null && typeof item === 'object') expectFiniteFrame(item, member);
  }
}

function windowMetrics(width: number, height: number = 844, safeTop: number = 32, safeBottom: number = 20): ReaderWindowMetricsSnapshot {
  const window = new ReaderRectVp(0, 0, width, height);
  return new ReaderWindowMetricsSnapshot(window, window, new ReaderInsetsVp(0, safeTop, 0, safeBottom));
}

const linear = (progress: number): number => progress;

test('the width class switches at 600vp and treats unknown widths as compact', () => {
  assert.equal(readerWidthClass(0), 'compact');
  assert.equal(readerWidthClass(320), 'compact');
  assert.equal(readerWidthClass(599), 'compact');
  assert.equal(readerWidthClass(600), 'expanded');
  assert.equal(readerWidthClass(800), 'expanded');
  assert.equal(readerIsExpandedWidth(Number.NaN), false);
});

test('window metrics admit the expanded layout at 600vp', () => {
  assert.equal(readerExpandedLayout(windowMetrics(599)), false);
  assert.equal(readerExpandedLayout(windowMetrics(600)), true);
  assert.equal(readerExpandedLayout(windowMetrics(1024, 768)), true);
  assert.equal(readerExpandedLayout(windowMetrics(Number.NaN)), false);
});

test('controls and bars scale up to accommodate readable text', () => {
  assert.equal(readerReadableFontScale(0.8), 1);
  assert.equal(readerReadableFontScale(1.5), 1.5);
  assert.equal(readerReadableFontScale(Number.NaN), 1);
  assert.equal(readerScaledControlHeight(44, 20, 1), 44);
  assert.equal(readerScaledControlHeight(44, 20, 1.5), 54);
  assert.equal(readerScaledControlHeight(44, 20, 2), 64);
  assert.equal(readerScaledControlHeight(44, 20, 0.8), 44);
  assert.equal(readerScaledBarHeight(58, 19.5, 2, 6), 58);
  assert.equal(readerScaledBarHeight(58, 19.5, 3, 6), 71);
});

test('the measured keyboard-resized page takes priority over the safe viewport fallback', () => {
  const phone = windowMetrics(390, 844, 32, 20);
  assert.equal(readerAvailableWindowHeight(phone, 0), 812);
  assert.equal(readerAvailableWindowHeight(phone, 700), 700, 'keyboard-resized measured page wins');
  assert.equal(readerAvailableWindowHeight(phone, -1), 812);
  assert.equal(readerAvailableWindowHeight(phone, Number.NaN), 812);
});

test('the resolved surface stays within its available width and height budgets', () => {
  assert.equal(readerSurfaceMaxHeight(812, 200), 612);
  assert.equal(readerSurfaceMaxHeight(200, 320), 0, 'reserved content cannot expand the available height');
  assert.equal(readerSurfaceMaxHeight(100, 200), 0);
  assert.equal(readerSurfaceMaxHeight(Number.NaN, 20), 0);
  assert.equal(readerDynamicSurfaceWidth(640, 390), 390);
  assert.equal(readerDynamicSurfaceWidth(640, 800), 640);
  assert.equal(readerDynamicSurfaceWidth(640, 200), 200, 'the available width is a hard boundary');
  assert.equal(readerDynamicSurfaceWidth(Number.NaN, 390), 0);
});

test('scroll padding and content offsets consume the same insets without double counting', () => {
  const geometry = new ReaderPageGeometry();
  geometry.content.startInset = 98;
  geometry.content.endInset = 66;
  const padding = readerScrollLayout(geometry);
  assert.equal(padding.mode, 'padding');
  assert.equal(padding.startInset, 98);
  assert.equal(padding.endInset, 66);
  assert.equal(readerScrollTopPadding(padding), 98);
  assert.equal(readerScrollBottomPadding(padding), 66);
  assert.equal(readerScrollStartOffset(padding), 0);
  assert.equal(readerScrollEndOffset(padding), 0);
  const offset = readerScrollLayout(geometry, { mode: 'contentOffset', extraEndInset: 10 });
  assert.equal(offset.mode, 'contentOffset');
  assert.equal(offset.endInset, 76);
  assert.equal(readerScrollTopPadding(offset), 0);
  assert.equal(readerScrollBottomPadding(offset), 0);
  assert.equal(readerScrollStartOffset(offset), 98);
  assert.equal(readerScrollEndOffset(offset), 76);
});

test('frame defaults clip solid footers and preserve explicit reading safe-area settings', () => {
  const style = readerFrameStyle({
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
  const reading = readerFrameStyle({
    backgroundColor: '#1c1e1a', clip: false, alignment: 'top', safeArea: 'systemCutoutAll',
    headerBackground: '#1c1e1a', headerTransparent: true, footerBackground: '#1c1e1a',
  });
  assert.equal(reading.clip, false);
  assert.equal(reading.alignment, 'top');
  assert.equal(reading.safeArea, 'systemCutoutAll');
});

test('page settlement finishes at its destination within its movement duration', () => {
  const normal = new ReaderPageSettlementTimeline(0, 100, 390, 0, 0);
  assert.ok(normal.durationMs > 80 && normal.durationMs < 320);
  assert.equal(normal.position(0), 0);
  assert.equal(normal.position(normal.durationMs), 100);
  assert.equal(normal.finished(normal.durationMs), true);
  assert.equal(new ReaderPageSettlementTimeline(0, 0, 390, 0, 0).durationMs, 0);
  assert.equal(new ReaderPageSettlementTimeline(0, 100, 390, 0, 0, true).durationMs, 30);
  assert.equal(new ReaderPageSettlementTimeline(0, 1000, 1, 0, 0).durationMs, 320);
});

test('the reading session launch releases its controls and source before settling in 380ms', () => {
  const geometry = buildReaderSessionLaunchGeometry({
    source: {
      kind: 'quickAutoPage', left: 20, top: 300, width: 286, height: 196, revision: 1,
      actorId: 'matrix-source', visibleLeft: 0, visibleTop: 0, visibleRight: 286,
      visibleBottom: 196, cornerRadius: 8,
    },
    targetLeft: 10, targetTop: 20, capsuleWidth: 96,
    topBarExitDistance: 52, dockExitDistance: 348.557,
  });
  assert.ok(geometry);
  const curves = { flight: linear, expand: linear, easeOut: linear };
  const sample = (timeMs: number, reducedMotion: boolean = false) => sampleReaderSessionLaunch(timeMs, geometry, curves, reducedMotion);

  const start = sample(0);
  assert.equal(start.phase, 'flight');
  assert.equal(start.finished, false);
  assert.equal(start.settled, false);
  assert.equal(start.sourceNeeded, true);
  assert.equal(start.controlsPresented, true);
  assert.equal(start.flight, 0);
  assert.equal(start.expansion, 0);
  assert.equal(start.leadingOpacity, 0);
  assert.deepEqual([start.proxyLeft, start.proxyTop, start.proxyWidth, start.proxyHeight], [20, 300, 286, 196]);
  assert.equal(start.sourceSurfaceOpacity, 1);
  expectFiniteFrame(start, 'launch.start');

  assert.equal(sample(159).controlsPresented, true);
  const overlap = sample(160);
  assert.equal(overlap.phase, 'overlap');
  assert.equal(overlap.controlsPresented, false);
  assert.equal(overlap.sourceNeeded, true);
  assert.equal(sample(219).sourceNeeded, true);

  const expansion = sample(220);
  assert.equal(expansion.phase, 'expand');
  assert.equal(expansion.sourceNeeded, false);
  assert.equal(expansion.flight, 1);
  assert.equal(expansion.finished, false);
  assert.equal(sample(379).settled, false);

  const end = sample(380);
  assert.equal(end.phase, 'settled');
  assert.equal(end.finished, true);
  assert.equal(end.settled, true);
  assert.equal(end.sourceNeeded, false);
  assert.equal(end.controlsPresented, false);
  assert.equal(end.flight, 1);
  assert.equal(end.expansion, 1);
  assert.equal(end.leadingOpacity, 1);
  assert.deepEqual([end.proxyLeft, end.proxyTop, end.proxyWidth, end.proxyHeight], [10, 20, 96, 24]);
  assert.equal(end.footerTranslateX, 0);
  expectFiniteFrame(end, 'launch.end');

  assert.deepEqual(sample(400), end, 'once settled, the sample stays at the final pose');
  assert.deepEqual(sample(0, true), end, 'reduced motion uses the same final pose immediately');
});

test('control expansion moves the brightness rail offscreen and hides it in full mode', () => {
  const bounds = { width: 390, fullHeight: 736, quickHeight: 330, bottomGap: 0 };
  const quick = sampleReaderControlMotionComposition(
    { expansionProgress: 0, visibilityProgress: 1 }, bounds);
  const full = sampleReaderControlMotionComposition(
    { expansionProgress: 1, visibilityProgress: 1 }, bounds);
  const half = sampleReaderControlMotionComposition(
    { expansionProgress: 0.5, visibilityProgress: 1 }, bounds);

  assert.equal(quick.shell.y, 406);
  assert.equal(quick.content.height, 190);
  assert.equal(quick.content.width, 312);
  assert.equal(quick.content.y, 435);
  assert.equal(quick.contentSurface.y, 463);
  assert.equal(quick.contentSurface.height, 666);
  assert.equal(quick.navigation.y, 643);
  assert.equal(quick.navigation.opacity, 1);
  assert.equal(quick.brightness.width, 46);
  approx(bounds.width - quick.brightness.x - quick.brightness.width, 13.56);
  assert.equal(quick.brightness.y, 435);

  assert.equal(full.shell.y, 0);
  assert.equal(full.content.height, 666);
  assert.equal(full.content.width, 364);
  assert.equal(full.content.y, 57);
  assert.equal(full.navigation.y, 663);
  assert.equal(full.navigation.opacity, 0);
  assert.equal(full.brightness.x, bounds.width);
  assert.equal(full.brightness.y, 29, 'brightness rail keeps its fixed full-content top');
  assert.equal(full.brightness.opacity, 0);
  assert.equal(half.content.height, 428);
  assert.ok(half.content.y > full.content.y && half.content.y < quick.content.y);
  expectFiniteFrame(quick, 'control.quick');
  expectFiniteFrame(full, 'control.full');
  expectFiniteFrame(half, 'control.half');

  const hidden = sampleReaderControlMotionComposition(
    { expansionProgress: 0, visibilityProgress: 0 }, bounds);
  assert.equal(hidden.topBar.translateY, -8);
  assert.equal(hidden.dock.translateY, 18);
  assert.equal(hidden.topBar.opacity, 0);
  assert.equal(hidden.dock.opacity, 0);
});

test('the TTS waveform settles under reduced motion and after its stop tail', () => {
  const motion = new ReaderTtsWaveformMotion({ ease: linear, easeInOut: linear });
  motion.setPlaying(true, 0);
  const start = motion.sample(0);
  assert.equal(start.heights.length, READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.scales.length, READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.opacities.length, READER_TTS_WAVEFORM_BAR_COUNT);
  assert.equal(start.scales[0], 0.4);
  const reduced = motion.sample(1500, true);
  assert.equal(reduced.colorProgress, 1);
  assert.equal(reduced.scales.every((value) => value === 1), true);
  assert.equal(reduced.heights.every((value) => Number.isFinite(value)), true);

  const tail = new ReaderTtsWaveformMotion({ ease: linear, easeInOut: linear });
  tail.setPlaying(true, 0);
  tail.setPlaying(false, 100);
  assert.equal(tail.active(300), true);
  assert.equal(tail.active(500), false);
  assert.equal(tail.sample(500).scales.every((value) => value === 1), true);
});

test('transient feedback uses the brief duration by default and keeps its dedupe window', () => {
  assert.equal(READER_FEEDBACK_BRIEF_MS, 2000);
  assert.equal(READER_FEEDBACK_EXTENDED_MS, 2200);
  assert.equal(READER_FEEDBACK_DEDUPE_MS, 2000);
  assert.equal(createReaderTransientToastState().duration, READER_FEEDBACK_BRIEF_MS);
});
