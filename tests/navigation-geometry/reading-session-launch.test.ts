import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch }
  from '../../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts';
import { READER_TTS_WAVEFORM_BAR_COUNT, ReaderTtsWaveformMotion, readerTtsWaveformBarHeight, readerTtsWaveformBarWidth }
  from '../../entry/src/main/ets/features/reading/ui/ReaderTtsWaveformModel.ts';

const linear = (progress: number): number => progress;
const curves = { flight: linear, expand: linear, easeOut: linear };

for (const kind of ['quickTts', 'quickAutoPage'] as const) {
  test(`${kind} launch preserves measured island card bounds and uniformly fits its source into the dot`, () => {
    for (const [width, height] of [[268, 138], [356.5, 84], [256, 296], [512, 84]]) {
      const geometry = buildReaderSessionLaunchGeometry({
        source: { kind, actorId: kind, left: 16, top: 284, width, height, revision: 3,
          visibleLeft: 0, visibleTop: 8, visibleRight: width, visibleBottom: height, cornerRadius: undefined },
        fixedIsland: true,
        targetLeft: 230, targetTop: 770, topBarExitDistance: 64, dockExitDistance: 380,
      });
      assert.ok(geometry);
      const first = sampleReaderSessionLaunch(0, geometry, curves);
      assert.deepEqual([first.proxyLeft, first.proxyTop, first.proxyWidth, first.proxyHeight], [16, 284, width, height]);
      assert.equal(first.sourceClipTop, 8);
      assert.equal(first.sourceRadius, 12);
      assert.equal(first.sourceContentBaseOffset, 0);
      assert.equal(first.sourceContentScale, 1);
      const docked = sampleReaderSessionLaunch(220, geometry, { ...curves, expand: () => 0 });
      assert.ok(Math.abs(Math.max(width, height) * docked.sourceContentScale - 24) < 1e-6);
      assert.equal(width / 2 + docked.sourceContentTranslateX, 12);
      assert.equal(height / 2 + docked.sourceContentTranslateY, 12);
      const settled = sampleReaderSessionLaunch(380, geometry, curves);
      assert.deepEqual([settled.proxyLeft, settled.proxyTop, settled.proxyWidth, settled.proxyHeight],
        [230, 770, kind === 'quickTts' ? 94 : 96, 24]);
    }
  });

  test(`${kind} source content fades independently before the shell and capsule content enter`, () => {
    const geometry = buildReaderSessionLaunchGeometry({
      source: { kind, actorId: kind, left: 16, top: 284, width: 268, height: 138, revision: 3,
        visibleLeft: 0, visibleTop: 0, visibleRight: 268, visibleBottom: 138, cornerRadius: 12 },
      fixedIsland: true,
      targetLeft: 230, targetTop: 770, topBarExitDistance: 64, dockExitDistance: 380,
    });
    assert.ok(geometry);
    let previous = sampleReaderSessionLaunch(0, geometry, curves);
    assert.equal(previous.sharpOpacity, 1);
    assert.ok(sampleReaderSessionLaunch(128, geometry, curves).sharpOpacity < 1);
    assert.equal(sampleReaderSessionLaunch(159, geometry, curves).sourceSurfaceOpacity, 1);
    for (let ms = 1; ms <= 380; ms++) {
      const sample = sampleReaderSessionLaunch(ms, geometry, curves);
      assert.ok(sample.sharpOpacity <= previous.sharpOpacity);
      assert.ok(sample.sourceSurfaceOpacity <= previous.sourceSurfaceOpacity);
      assert.ok(sample.canonicalSurfaceOpacity >= previous.canonicalSurfaceOpacity);
      assert.ok(sample.leadingOpacity >= previous.leadingOpacity);
      assert.ok(sample.pauseOpacity >= previous.pauseOpacity);
      if (sample.sharpOpacity > 0) {
        assert.equal(sample.canonicalSurfaceOpacity, 0);
        assert.equal(sample.leadingOpacity, 0);
        assert.equal(sample.pauseOpacity, 0);
      }
      if (sample.sourceSurfaceOpacity > 0) {
        assert.equal(sample.leadingOpacity, 0);
        assert.equal(sample.pauseOpacity, 0);
      }
      previous = sample;
    }
    const reduced = sampleReaderSessionLaunch(0, geometry, curves, true);
    assert.equal(reduced.sharpOpacity, 0);
    assert.equal(reduced.canonicalSurfaceOpacity, 1);
    assert.equal(reduced.pauseOpacity, 1);
  });
}

test('waveform bars fit a 28 × 12vp island slot and larger legacy slots throughout playback', () => {
  const motion = new ReaderTtsWaveformMotion({ ease: linear, easeInOut: linear });
  assert.equal(readerTtsWaveformBarHeight(4, 1, 26), 4);
  assert.ok(readerTtsWaveformBarHeight(22, 1.15, 12) > readerTtsWaveformBarHeight(4, 1, 12));
  motion.setPlaying(true, 0);
  for (let ms = 0; ms <= 1500; ms += 5) {
    if (ms === 1050) motion.setPlaying(false, ms);
    const sample = motion.sample(ms);
    for (const [width, height] of [[28, 12], [310, 28], [0, 0], [0.5, 3]]) {
      assert.ok(readerTtsWaveformBarWidth(width) * READER_TTS_WAVEFORM_BAR_COUNT <= width);
      for (let index = 0; index < READER_TTS_WAVEFORM_BAR_COUNT; index++) {
        const bar = readerTtsWaveformBarHeight(sample.heights[index], sample.scales[index], height);
        assert.ok(bar >= 0 && bar <= height);
      }
    }
  }
});
