import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readerControlMotionBounds, readerControlMotionAxis, sampleReaderControlMotion,
  sampleReaderControlMotionComposition, sampleReaderControlWholeVisibility }
  from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import { readerControlGrabberScreenY } from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';

const bounds = readerControlMotionBounds(364, 736, 19);
const sample = (p, v = 1) => sampleReaderControlMotion({ expansionProgress: p, visibilityProgress: v }, bounds);
// Independently transcribed source endpoints: Directory 1689:1616 / 1689:2121.
assert.deepEqual(sample(0).shell, { x: 0, y: 406, width: 364, height: 330, opacity: 1 });
assert.deepEqual(sample(1).shell, { x: 0, y: 0, width: 364, height: 736, opacity: 1 });
assert.deepEqual(sample(0).content, { x: 13, y: 435, width: 286, height: 190, opacity: 1 });
assert.deepEqual(sample(1).content, { x: 13, y: 57, width: 338, height: 666, opacity: 1 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
// Independently archived MR1 sources, never generated from the sampler. This
// optional evidence was intentionally pruned from the working tree; when it
// is present, keep validating it, but do not make local builds depend on a
// deleted historical capture.
const mr1Path = new URL('../evidence/control-bar-development-20260905/SHOW_HIDE_MOTION_RAW.json', import.meta.url);
if (existsSync(mr1Path)) {
  const mr1 = JSON.parse(readFileSync(mr1Path, 'utf8'));
  assert.equal(mr1.showRoot, '1247:28');
  assert.equal(mr1.hideRoot, '1247:489');
  assert.match(mr1.show.nodes.find(node => node.nodeId === '1247:37').codeSnippets.css, /translate: 0px -8px/);
  assert.match(mr1.show.nodes.find(node => node.nodeId === '1247:80').codeSnippets.css, /translate: 0px 18px/);
  assert.match(mr1.hide.nodes.find(node => node.nodeId === '1247:496').codeSnippets.css, /translate: 0px -8px/);
  assert.match(mr1.hide.nodes.find(node => node.nodeId === '1247:523').codeSnippets.css, /translate: 0px 18px/);
  assert.equal(mr1.show.timelineCohorts[0].durationMs, 420);
  assert.equal(mr1.hide.timelineCohorts[0].durationMs, 360);
} else {
  console.log('MR1 archived show/hide capture absent; optional evidence checks skipped');
}
for (const v of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
  const whole = sampleReaderControlWholeVisibility(v);
  near(whole.topBar.translateY, -8 * (1 - v));
  near(whole.dock.translateY, 18 * (1 - v));
  assert.equal(whole.topBar.opacity, v);
  assert.equal(whole.dock.opacity, v);
  assert.deepEqual(sample(0.6, v).topBar, whole.topBar);
  assert.deepEqual(sample(0.6, v).dock, whole.dock);
}
for (const p of [0, 0.25, 0.7, 1]) {
  const visible = sampleReaderControlMotionComposition({ expansionProgress: p, visibilityProgress: 1 }, bounds);
  for (const v of [0, 0.25, 0.5, 0.9, 1]) {
    const input = { expansionProgress: p, visibilityProgress: v };
    const before = structuredClone(input);
    const composition = sampleReaderControlMotionComposition(input, bounds);
    assert.equal(composition.visibility, v);
    assert.equal(composition.dock.opacity, v);
    for (const actor of ['shell', 'grabber', 'header', 'content', 'brightness', 'navigation']) {
      assert.deepEqual(composition[actor], visible[actor], `${actor} must not consume visibility a second time`);
      near(composition[actor].y + composition.dock.translateY, sample(p, v)[actor].y);
      near(composition[actor].opacity * composition.dock.opacity, sample(p, v)[actor].opacity);
      assert.ok(Number.isFinite(composition[actor].opacity), 'hidden composition must never divide by v=0');
    }
    assert.deepEqual(input, before, 'composition sampling has no writes to its input');
  }
}
// Numerical composition contract, not a renderer/pixel test: fading a 0.62
// translucent background and 0.5 foreground separately yields a different
// combined alpha than composing them first and applying the parent once.
const alphaOver = (front, back) => front + back * (1 - front);
const halfShown = sampleReaderControlMotionComposition({ expansionProgress: 0.25, visibilityProgress: 0.5 }, bounds);
const wholeAlpha = alphaOver(0.5 * halfShown.content.opacity, 0.62 * halfShown.shell.opacity) * halfShown.dock.opacity;
const incorrectlySeparateAlpha = alphaOver(0.5 * halfShown.content.opacity * halfShown.dock.opacity,
  0.62 * halfShown.shell.opacity * halfShown.dock.opacity);
near(wholeAlpha, 0.405);
near(incorrectlySeparateAlpha, 0.4825);
assert.notEqual(wholeAlpha, incorrectlySeparateAlpha);
for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 0.333, 0.731]) {
  const f = sample(p);
  near(f.shell.y + f.shell.height, 736);
  near(f.brightness.y - f.shell.y, 29);
  assert.equal(f.brightness.height, 190);
  near(f.brightness.x, 312.44 + 51.56 * p); // M-02: rail clears the right edge.
  near(f.brightness.opacity, 1 - p);
  near(f.navigation.y, 643 + 20 * p);
  assert.equal(f.header.opacity, p); // no delayed revealing phase
  near(f.grabber.y + 108, readerControlGrabberScreenY(
    { expansionProgress: p, visibilityProgress: 1 }, readerControlMotionAxis(bounds, 108)));
  for (const v of [1, 0.75, 0.25, 0]) {
    const closing = sample(p, v);
    assert.equal(closing.shell.height, f.shell.height);
    assert.equal(closing.content.width, f.content.width);
    assert.equal(closing.content.height, f.content.height);
    near(closing.brightness.opacity, (1 - p) * v);
    for (const actor of ['shell', 'grabber', 'header', 'content', 'brightness', 'navigation']) {
      assert.equal(closing[actor].x, f[actor].x, `${actor} x remains in the captured composition`);
      assert.equal(closing[actor].width, f[actor].width, `${actor} width must not morph during close`);
      assert.equal(closing[actor].height, f[actor].height, `${actor} height must not morph during close`);
      near(closing[actor].y - f[actor].y, 18 * (1 - v));
      near(closing[actor].opacity, f[actor].opacity * v);
    }
    near(closing.grabber.y + 108, readerControlGrabberScreenY(
      { expansionProgress: p, visibilityProgress: v }, readerControlMotionAxis(bounds, 108)));
  }
  // Pure spatial sample: traversing in reverse cannot choose a different curve.
  assert.deepEqual(sample(p), sample(p));
}
for (const dimensions of [[280, 500, 24], [720, 852, 33], [364, 250, 0]]) {
  const b = readerControlMotionBounds(...dimensions);
  const measuredAxis = readerControlMotionAxis(b, 108);
  assert.equal(measuredAxis.hiddenGrabberScreenY - measuredAxis.quickGrabberScreenY, 18,
    'safe-area/bottom gaps must never become a new close travel');
  for (const p of [0, 0.5, 1]) {
    const f = sampleReaderControlMotion({ expansionProgress: p, visibilityProgress: 1 }, b);
    near(f.shell.y + f.shell.height, b.fullHeight);
    assert.ok(f.content.width >= 0 && f.content.height >= 0);
    const hidden = sampleReaderControlMotion({ expansionProgress: p, visibilityProgress: 0 }, b);
    near(hidden.grabber.y - f.grabber.y, 18);
    assert.equal(hidden.shell.opacity, 0);
  }
}
console.log('PASS reader control motion geometry (production functions; no runtime/visual claim)');

// Production cache: preserve the exact authored geometry, share an object only
// while all its dependencies remain equal, never accumulate the drag offset.
const { ReaderControlMotionFrameCache } = await import('../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts');
const cache = new ReaderControlMotionFrameCache();
const cached = cache.sample(.7, .4, 364, 736, 8, 330, 12);
for (let i = 0; i < 100; i++) assert.equal(cache.sample(.7, .4, 364, 736, 8, 330, 12), cached);
const inputs = [.7, .4, 364, 736, 8, 330, 12];
for (let i = 0; i < inputs.length; i++) {
  const changed = [...inputs]; changed[i] += i < 2 ? .01 : 1;
  assert.notEqual(cache.sample(...changed), cached);
  const restored = cache.sample(...inputs);
  assert.deepEqual(restored, cached, 'cache invalidation must not mutate a previous frame');
}

for (const [width, height] of [[0, 0], [320, 0], [320, 28], [320, 65]]) {
  const b = readerControlMotionBounds(width, height, 20);
  assert.equal(b.fullHeight, height, 'zero live budget must not resurrect a 736vp sheet');
  const f = sampleReaderControlMotionComposition({ expansionProgress: 1, visibilityProgress: 1 }, b);
  assert.equal(f.shell.height, height);
  assert.ok(f.content.height >= 0);
}
