import assert from 'node:assert/strict';
import * as state from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import * as policy from '../entry/src/main/ets/features/reading/ReaderControlMotionPolicy.ts';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';

const config = { axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 },
  tapMaxDurationMs: 350, directionSlopVp: 2, settleDurationMs: 1150, showDurationMs: 420,
  dismissDurationMs: 360, coordinatedMotion: true };
const home = state.openReaderControlSession(state.createReaderControlSessionState(), 0);
const quick = module => state.enterReaderControlModule(home, module, 0);
const full = module => state.expandReaderControlSession(quick(module), 0);
const sample = state.sampleReaderControlSession;
const advance = (s, t) => state.advanceReaderControlSession(s, t, s.epoch, x => x);

for (const module of ['directory', 'search', 'settings', 'appearance', 'tts', 'autoPage', 'replace']) {
  const r = new ReaderControlRuntime(config);
  r.start(quick(module));
  r.down(1, 700, 0);
  const tapped = r.up(1, 700, 60).session;
  assert.equal(tapped.transition.durationMs, 320);
  r.start(full(module)); r.down(1, 300, 0);
  assert.equal(r.up(1, 300, 60).session.transition.durationMs, 260);
  const cmd = state.expandReaderControlSession(quick(module), 1150);
  let update = r.command(cmd);
  assert.equal(update.session.transition.durationMs, 320);
  const ticket = r.ticket(); r.frame(0, ticket, x => x);
  update = r.frame(100, ticket, x => x);
  assert.deepEqual(sample(r.command(cmd).session), sample(update.session), 'host echo cannot rewind local progress');
  update = r.command(state.backReaderControlSession(full(module), 1150).state);
  assert.equal(update.session.transition.durationMs, 260);
  update = r.command(state.dismissReaderControlSession(full(module), 360));
  assert.equal(update.session.transition.durationMs, 200);
}
assert.equal(policy.readerControlMotionCommandTiming(state.openReaderControlSession(state.createReaderControlSessionState(), 420)).transition.durationMs, 220);
const instant = state.expandReaderControlSession(quick('tts'), 0);
assert.deepEqual(policy.readerControlMotionCommandTiming(instant), instant, 'reduced motion endpoint unchanged');

for (const module of ['directory', 'search', 'settings', 'appearance', 'tts', 'autoPage', 'replace']) {
const r = new ReaderControlRuntime(config);
r.start(quick(module)); r.down(1, 700, 0);
const moved = r.move(1, 500, 100).session;
assert.equal(sample(moved).expansionProgress, .5, 'finger input is linear in displacement');
const release = r.up(1, 500, 100).session;
assert.deepEqual(sample(release), sample(moved), 'no release jump');
assert.ok(release.transition.durationMs < 160, 'only remaining distance, shortened by measured velocity');
let ticket = r.ticket(); r.frame(100, ticket, x => x);
const beforeHold = r.frame(110, ticket, x => x).session;
const y = 700 - sample(beforeHold).expansionProgress * 400;
assert.deepEqual(sample(r.down(2, y, 120).session), sample(beforeHold));
assert.equal(r.frame(300, ticket, x => x), undefined, 'regrab revokes clock');
const reverse = r.move(2, y + 40, 140).session;
assert.ok(sample(reverse).expansionProgress < sample(beforeHold).expansionProgress);
const reverseRelease = r.up(2, y + 40, 140).session;
assert.deepEqual(sample(reverseRelease), sample(reverse));
ticket = r.ticket(); r.frame(200, ticket, x => x);
assert.equal(r.frame(1000, ticket, x => x).session.location.form, 'quick');

// Holding without movement preserves the exact elapsed clock, not a fresh full duration.
const command = state.expandReaderControlSession(quick(module), 1150);
r.start(command); ticket = r.ticket(); r.frame(0, ticket, x => x);
const halfway = r.frame(160, ticket, x => x).session;
r.down(3, 500, 200);
const resumed = r.up(3, 500, 1000).session;
assert.deepEqual(resumed.transition, halfway.transition);
const closing = advance(state.dismissReaderControlSession(full(module), 200), 100);
assert.equal(policy.readerControlMotionTargetDuration(closing, full(module).location), 220);
}

for (const slope of [0, .2, 1, 2, 3]) {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const value = policy.sampleReaderControlMotionContinuation(i / 1000, slope);
    assert.ok(value >= previous - 1e-8 && value >= 0 && value <= 1 + 1e-8);
    previous = value;
  }
  assert.ok(Math.abs(policy.sampleReaderControlMotionContinuation(1e-6, slope) / 1e-6 - slope) < .00001);
}
console.log('PASS all control modules 320/260/200/220, initial opening 220, remaining-distance release, hold/regrab/reverse, monotone velocity continuation; device acceptance separate');

const { sampleReaderControlMorphProgress: morphProgress } = await import('../entry/src/main/ets/features/reading/ReaderControlMotionPolicy.ts');
assert.equal(morphProgress(0), 0); assert.equal(morphProgress(1), 1);
assert.equal(morphProgress(.5), .5);
assert.ok(morphProgress(.25) > .1 && morphProgress(.75) < .9,
  'automatic morph must retain meaningful travel in the last quarter');
for (let i = 1; i <= 1000; i++) {
  const t = i / 1000;
  assert.ok(morphProgress(t) > morphProgress(t - .001));
  assert.ok(Math.abs(morphProgress(t) + morphProgress(1 - t) - 1) < 1e-9);
}
