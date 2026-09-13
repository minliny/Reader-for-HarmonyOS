import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as presentation from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as tts from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';
import { createReaderBuilderProbe, readerBuilderSdkAvailable } from './lib/reader-control-builder-probe.mjs';

const sample = presentation.sampleReaderControlMotionPresentation;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
for (const p of [0, 1]) {
  near(sample(p).contentOpacity, 1); near(sample(p).contentBlur, 0);
}
for (let i = 0; i <= 1000; i++) {
  const p = i / 1000, f = sample(p);
  assert.ok(f.contentOpacity >= .35 && f.contentOpacity <= 1, 'fading must never erase shared content');
  assert.ok(f.contentBlur >= 0 && f.contentBlur <= 2, 'retain perceptible content instead of a featureless blur');
  assert.ok(!(f.quickClarity > 0 && f.fullClarity > 0), 'endpoint contents never crossfade over one another');
  near(f.contentOpacity, sample(1 - p).contentOpacity);
  if (p === .5) near(f.contentOpacity, .35, 'midpoint still retains softened real content');
  if (i > 0 && i <= 500) assert.ok(f.contentOpacity < sample(p - .001).contentOpacity,
    'every forward sample continues changing before the midpoint; no 20%-80% paint plateau');
  if (i > 500) assert.ok(f.contentOpacity > sample(p - .001).contentOpacity,
    'every forward sample continues changing after the midpoint');
  const full = geometry.sampleReaderControlTts(p, 286 + 52 * p, 1 / 3, false);
  for (const kind of ['detail', 'config']) {
    const alpha = full[kind].opacity * f.contentOpacity;
    if (p === 0) near(alpha, 0, 'Full-only details remain absent at the Quick endpoint');
    if (p > 0) assert.ok(alpha > 0, 'visible Full content must not be replaced by an empty sheet during collapse');
  }
  if (i > 0) assert.ok(Math.abs(f.contentOpacity - sample(p - .001).contentOpacity) < .008, 'no visibility step');
}
const outline = presentation.readerControlMotionOutlineOpacity;
// Offscreen actors are clipped to their Quick slot, including actual contents.
for (const offset of [0, 300, 523, 565, 3300]) {
  for (const p of [0, .05, .1, .3, .5, .9, 1, .9, .3, .05, 0]) {
    const f = geometry.sampleReaderControlTts(1, 338);
    const q = geometry.sampleReaderControlTts(0, 286 + 52 * p);
    const current = geometry.sampleReaderControlTts(p, 286 + 52 * p);
    for (const kind of ['playback', 'timer', 'speed']) {
      const [source, target] = presentation.readerControlMotionClipRects(p, f[kind], current[kind], q[kind], 666, offset);
      assert.ok(source.height >= 0 && source.height <= current[kind].height);
      if (offset >= f[kind].y + f[kind].height) near(source.height, 0);
      if (target.height > 0) {
        const paintedTop = current[kind].y - offset * p + target.y;
        assert.ok(paintedTop >= q[kind].y - 1e-8);
        assert.ok(paintedTop + target.height <= q[kind].y + q[kind].height + 1e-8);
      }
      if (p === 0) { near(target.height, current[kind].height); near(target.width, current[kind].width); }
    }
  }
}
assert.equal(presentation.readerControlMotionClipPath([{ x: 1, y: 2, width: 3, height: 4 }], 2), 'M2 4h6v8h-6Z ',
  'SVG clip path uses pixels, not vp');
for (const p of [.2, .4, .6, .8]) {
  near(outline(p, 459, 105, 666, 565), 0, 'fully offscreen Speed does not fly through details');
  near(outline(p, 459, 105, 666, 0), 1);
}
near(outline(0, 459, 105, 666, 565), 1, 'Quick outline is restored');
for (const offset of [0, 300, 523, 564, 565, 3300]) {
  for (const p of [1, .9, .7, .3, 0, .3, .7, .9, 1]) {
    assert.deepEqual(sample(p), sample(p), 'reverse sampling has no direction-dependent clock');
    const a = outline(p, 459, 105, 666, offset);
    assert.ok(a >= 0 && a <= 1);
    assert.ok(Math.abs(a - outline(p, 459, 105, 666, offset + .001)) < .00002,
      'partial/offscreen boundary is continuous, not a visible-percent threshold');
  }
}

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlTtsContent.ets', import.meta.url), 'utf8');
assert.equal((source.match(/\.opacity\(this\.presentation\(\)\.contentOpacity\)\.blur\(this\.presentation\(\)\.contentBlur\)/g) ?? []).length, 3,
  'all three shared module content wrappers use one paint curve');
for (const kind of ['detail', 'config']) assert.ok(source.includes(`this.frame().${kind}.opacity * this.presentation().contentOpacity`));
assert.doesNotMatch(source, /\.opacity\([^\n]*this\.presentation\(\)\.fullClarity/,
  'Full-only content must use the nonzero fade envelope, not the endpoint-only clarity gate');
assert.doesNotMatch(source, /setTimeout|setInterval|animateTo|componentSnapshot|\.visibility\(/,
  'no additional clock, screenshot handoff or compositor detach');

if (readerBuilderSdkAvailable) {
  // Exercise the real SDK-generated Speed wrapper on one mount; replay every
  // paint observer across progress/reversal and real scroll anchors.
  const methods = ['onlineServicePage', 'isHttpEngineSelected', 'speed', 'p', 'frame', 'effectiveRate', 'moduleHeader', 'quickLabel',
    'sectionSurface', 'surfaceY', 'sectionActor', 'fullInput', 'ratePresets', 'ratePresetWidth', 'ratePreset', 'chooseRatePreset',
    'quickLabelActor', 'headerActor', 'headerMeta', 'timerSummary', 'twoDigits',
    'statusText', 'playbackLabel', 'presentation', 'outlineOpacity', 'sharedClip', 'sharedScrollTranslation', 'sharedInput'];
  const noopNative = new Proxy({}, { get: (_, key) => key === 'name' ? 'Slider' : () => {} });
  const enums = new Proxy({}, { get: (_, key) => String(key) });
  const { owner } = createReaderBuilderProbe(source, methods, { ...presentation, ...geometry, ...actors, ...scroll, ...tts,
    Slider: noopNative, SliderStyle: enums, SliderChangeMode: enums, Axis: enums, TOK_BORDER_W: 1,
    PathShape: class { commands(value) { this.path = value; return this; } } });
  Object.assign(owner, { pathCache: new presentation.ReaderControlMotionPathCache(path => ({ path })), motionProgress: 0, availableWidth: 286, fullViewportHeight: 666,
    cachedProgress: -1, cachedWidth: -1, ratePreview: -1, interactionEnabled: true, serviceTab: '', engine: 'system',
    scrollMotion: scroll.createReaderControlMorphScroll(), state: { status: 'idle', rate: 1, totalSlices: 0 },
    getUIContext: () => ({ vp2px: x => x * 3 }) });
  owner.speed();
  for (const offset of [0, 523, 565, 3300]) {
    for (const p of [0, .1, .2, .5, .8, .9, 1, .9, .5, .1, 0]) {
      owner.motionProgress = p; owner.availableWidth = 286 + 52 * p;
      owner.scrollMotion.fullScrollOffset = offset;
      owner.scrollMotion.nativeScrollOffset = offset;
      owner.replay();
      const wrappers = [...owner.nodes.values()].filter(n => n.blur !== undefined);
      assert.equal(wrappers.length, 1, 'content-only blur, not whole module/root');
      near(wrappers[0].opacity, sample(p).contentOpacity);
      near(wrappers[0].blur, sample(p).contentBlur);
      const root = owner.nodes.get(0);
      assert.equal(root.blur, undefined); assert.equal(root.opacity, undefined, 'outline is not hidden with content');
      const surface = owner.nodes.get(1);
      near(surface.border.width, .5);
      near(surface.opacity, owner.outlineOpacity('speed'));
      near(surface.position.y, 26 * p);
      near(surface.height, owner.frame().speed.height - 26 * p);
      assert.equal(root.clipShape.path, owner.sharedClip('speed').path, 'mounted outer actor clips content and border');
      assert.deepEqual(root.position, { x: owner.frame().speed.x, y: owner.frame().speed.y }, 'authored geometry retained');
    }
  }
} else throw new Error('SDK Builder probe required for this local trial');
console.log('PASS TTS softened-content trial: nonzero middle fade, reversible content-only blur, Full details retain their original reveal, offscreen outlines, actual mounted SDK paint observers; NOT device visual acceptance');
