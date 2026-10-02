import assert from 'node:assert/strict';
import { ReaderControlRuntime } from '../entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import {
  createReaderControlSessionState,
  enterReaderControlModule,
  openReaderControlSession,
  sampleReaderControlSession,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { readerControlGrabberScreenY } from '../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';

// A stable secondary Quick handle must follow every in-range MOVE. This is a
// pure runtime regression for the user-visible Quick -> Full drag path; it
// does not claim to exercise native ArkUI hit testing or rendered pixels.
const axis = {
  quickGrabberScreenY: 504,
  fullGrabberScreenY: 98,
  hiddenGrabberScreenY: 522,
};
const config = {
  axis,
  tapMaxDurationMs: 500,
  directionSlopVp: 8,
  settleDurationMs: 320,
  showDurationMs: 320,
  dismissDurationMs: 320,
  coordinatedMotion: true,
};

let state = openReaderControlSession(createReaderControlSessionState(), 0);
state = enterReaderControlModule(state, 'directory', 0);
assert.equal(state.location.level, 'secondary');
assert.equal(state.location.form, 'quick');
assert.equal(state.transition, undefined, 'the drag starts from a settled Quick endpoint');

const runtime = new ReaderControlRuntime(config);
runtime.start(state);
runtime.down(7, axis.quickGrabberScreenY, 0);
let previousProgress = 0;
const moves = [494, 484, 454, 404, 354, 304, 254, 204, 154, 98];
for (let index = 0; index < moves.length; index += 1) {
  const pointerY = moves[index];
  const update = runtime.move(7, pointerY, (index + 1) * 16);
  const frame = sampleReaderControlSession(update.session);
  assert.ok(frame.expansionProgress > previousProgress,
    `MOVE ${pointerY} must advance Quick -> Full expansion`);
  assert.ok(Math.abs(readerControlGrabberScreenY(frame, axis) - pointerY) < 1e-8,
    `MOVE ${pointerY} must keep the grabber under the finger`);
  previousProgress = frame.expansionProgress;
}
assert.equal(previousProgress, 1, 'the final in-range MOVE reaches Full');

const released = runtime.up(7, axis.fullGrabberScreenY, 200);
assert.equal(released.session.heldPointerId, -1);
assert.equal(released.endpoint?.location.form, 'full', 'UP commits Full after the drag');
console.log('PASS Quick -> Full stable handle: every MOVE updates expansionProgress and follows the pointer');
