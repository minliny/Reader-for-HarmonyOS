import assert from 'node:assert/strict';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  enterReaderControlModule, expandReaderControlSession, openReaderControlSession,
  resumeReaderControlSessionTarget,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  moveReaderControlSpatialPath, projectReaderControlSpatialPath,
  readerControlSpatialFrameAt, readerControlSpatialY, sampleReaderControlSpatialPath,
} from '../entry/src/main/ets/features/reading/ReaderControlSpatialPath.ts';

// Hidden field is the Quick hidden pose. Every captured composition closes by
// the same independently archived MR1 18vp, not towards one off-screen point.
const axis = { quickGrabberScreenY: 700, fullGrabberScreenY: 300, hiddenGrabberScreenY: 718 };
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
function quick() {
  return enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(), 0), 'directory', 0);
}
function path(from, to, progress = 0.25) {
  return { kind: 'morph', intent: 'forward', fromLocation: quick().location,
    toLocation: { ...quick().location, form: 'full' }, from, to,
    progress, targetProgress: 1, startProgress: 0, elapsedMs: 0, durationMs: 400 };
}

// A normal morph is the same linear path; an ordinary dismissal freezes the
// composition and moves it along visibility, including direction reversal.
for (const transition of [
  path({ expansionProgress: 0, visibilityProgress: 1 }, { expansionProgress: 1, visibilityProgress: 1 }),
  path({ expansionProgress: 1, visibilityProgress: 1 }, { expansionProgress: 1, visibilityProgress: 0 }),
]) {
  const original = structuredClone(transition);
  const currentY = sampleReaderControlSpatialPath(transition, axis, transition.progress);
  for (const delta of [-2, -0.1, 0, 0.1, 2]) {
    const move = moveReaderControlSpatialPath(transition, axis, delta);
    assert.equal(move.reachable, true);
    close(move.screenY, currentY + delta);
    close(move.consumedDelta, delta);
    close(move.remainingDelta, 0);
  }
  assert.deepEqual(transition, original);
}

// Exact boundary consumption retains the remainder needed by the driver's next
// spatial segment instead of losing distance at Quick or Hidden.
let transition = path({ expansionProgress: 0, visibilityProgress: 1 },
  { expansionProgress: 1, visibilityProgress: 1 });
let move = moveReaderControlSpatialPath(transition, axis, 180);
assert.equal(move.reachable, false);
assert.equal(move.atBoundary, true);
assert.equal(move.progress, 0);
close(move.consumedDelta, 100);
close(move.remainingDelta, 80);
move = moveReaderControlSpatialPath(transition, axis, -380);
assert.equal(move.progress, 1);
close(move.consumedDelta, -300);
close(move.remainingDelta, -80);

// Production CANCEL restoration can change expansion AND visibility. Verify
// many small absolute moves against the sampler, not a copied endpoint formula.
let closing = dismissReaderControlSession(expandReaderControlSession(quick(), 0), 400);
closing = advanceReaderControlSession(closing, 100, closing.epoch);
const restoring = resumeReaderControlSessionTarget(closing, quick().location, 400);
transition = { ...restoring.transition, progress: 0.25 };
assert.notEqual(transition.from.expansionProgress, transition.to.expansionProgress);
assert.notEqual(transition.from.visibilityProgress, transition.to.visibilityProgress);
for (const delta of [1, 2, -1, -2, 0.1, -0.1, 10, -10]) {
  const currentY = sampleReaderControlSpatialPath(transition, axis, transition.progress);
  move = moveReaderControlSpatialPath(transition, axis, delta);
  assert.equal(move.reachable, true);
  close(move.screenY, currentY + delta);
  close(move.consumedDelta, delta);
  close(move.remainingDelta, 0);
  transition = { ...transition, progress: move.progress };
}

// For mixed paths, evaluating at a sampled frame and solving back must agree.
// MR1 adds the captured close displacement, so p/v together remain affine.
for (const fromExpansion of [0, 0.2, 0.7, 1]) {
  for (const toExpansion of [0, 0.2, 0.7, 1]) {
    for (const fromVisibility of [0.2, 0.7, 1]) {
      for (const toVisibility of [0.2, 0.7, 1]) {
        transition = path({ expansionProgress: fromExpansion, visibilityProgress: fromVisibility },
          { expansionProgress: toExpansion, visibilityProgress: toVisibility }, 0.45);
        for (const targetProgress of [0, 0.2, 0.45, 0.7, 1]) {
          const desiredY = sampleReaderControlSpatialPath(transition, axis, targetProgress);
          const projected = projectReaderControlSpatialPath(transition, axis, desiredY);
          assert.equal(projected.reachable, true, JSON.stringify({ transition, targetProgress, projected }));
          close(projected.screenY, desiredY);
          close(readerControlSpatialY(readerControlSpatialFrameAt(transition, projected.progress), axis), desiredY);
          assert.ok(projected.progress >= 0 && projected.progress <= 1);
        }
      }
    }
  }
}

// The old off-screen model invented a quadratic turning point for this mixed
// path. MR1 is independently 300+400*p +18*(.5-.5*p) = 309+391*p.
transition = path({ expansionProgress: 1, visibilityProgress: 0.5 },
  { expansionProgress: 0, visibilityProgress: 1 }, 0.2);
move = moveReaderControlSpatialPath(transition, axis, 100);
assert.equal(move.reachable, true);
assert.equal(move.atBoundary, false);
close(move.progress, (78.2 + 100) / 391);
close(move.screenY, 487.2);
close(move.consumedDelta, 100);
close(move.remainingDelta, 0);
close(projectReaderControlSpatialPath(transition, axis, 504.5, 0.2).progress, 0.5);
close(projectReaderControlSpatialPath(transition, axis, 504.5, 0.8).progress, 0.5);

// Full and in-flight compositions have different origins but exactly the
// same 18vp close segment. Raw inverse exposes excess travel for the Driver.
for (const capturedExpansion of [0, 0.25, 0.7, 1]) {
  transition = path({ expansionProgress: capturedExpansion, visibilityProgress: 1 },
    { expansionProgress: capturedExpansion, visibilityProgress: 0 }, 0);
  const originY = 700 - 400 * capturedExpansion;
  close(sampleReaderControlSpatialPath(transition, axis, 1), originY + 18);
  for (const delta of [1, 4.5, 9, 18]) {
    move = moveReaderControlSpatialPath(transition, axis, delta);
    assert.equal(move.reachable, true);
    close(move.progress, delta / 18);
    close(move.consumedDelta, delta);
    close(move.remainingDelta, 0);
  }
  move = moveReaderControlSpatialPath(transition, axis, 25);
  assert.equal(move.reachable, false);
  assert.equal(move.atBoundary, true);
  close(move.consumedDelta, 18);
  close(move.remainingDelta, 7);
}

// A spatially static path reports its inability to consume drag; it doesn't
// manufacture an up/down direction or choose an endpoint.
transition = path({ expansionProgress: 0, visibilityProgress: 1 },
  { expansionProgress: 0, visibilityProgress: 1 }, 0.4);
move = moveReaderControlSpatialPath(transition, axis, 10);
assert.equal(move.spatiallyStatic, true);
assert.equal(move.reachable, false);
assert.equal(move.progress, 0.4);
assert.equal(move.consumedDelta, 0);
assert.equal(move.remainingDelta, 10);
console.log('reader control shared spatial sampler and inverse production behavior: PASS');
