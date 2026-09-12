import assert from 'node:assert/strict';
import {
  createReaderControlBackdropTouchState, reduceReaderControlBackdropTouch,
} from '../entry/src/main/ets/features/reading/ReaderControlBackdropTouch.ts';

const config = { tapMaxDurationMs: 500, touchSlopVp: 8 };
const context = {
  visible: true, geometryReady: true, heldPointerId: -1, closeRevision: 3,
  excludedRects: [
    { x: 13, y: 450, width: 364, height: 330 }, // actual Dock incl. handle
    { x: 13, y: 19, width: 364, height: 54 }, // actual TopBar
  ],
};
const event = (kind, x = 100, y = 200, timeMs = 0, pointerId = 1) =>
  ({ kind, windowX: x, windowY: y, timeMs, pointerId });
const step = (state, e, c = context, cfg = config) => reduceReaderControlBackdropTouch(state, e, c, cfg);
const down = (x = 100, y = 200, c = context) => step(createReaderControlBackdropTouchState(), event('down', x, y), c);
const up = (pair, x = 100, y = 200, time = 100, id = 1, c = context) =>
  step(pair.state, event('up', x, y, time, id), c);

// A trailing UP has no authority; DOWN fixes its origin, even if the finger
// leaves the actual Dock/TopBar before release or the busy flag clears first.
assert.equal(step(createReaderControlBackdropTouchState(), event('up', 100, 200, 100)).shouldDismiss, false);
for (const [x, y] of [[195, 455], [100, 600], [100, 40], [13, 450], [377, 73]]) {
  let pair = down(x, y);
  assert.equal(pair.state.eligible, false);
  assert.equal(pair.state.pointerId, 1);
  pair = up(pair, x, y);
  assert.equal(pair.shouldDismiss, false);
  assert.equal(pair.state.pointerId, -1);
}

// The matching background tap commits once and returns cleared state first.
let pair = down();
assert.equal(pair.shouldDismiss, false);
assert.equal(pair.state.eligible, true);
pair = up(pair, 108, 208, 499);
assert.equal(pair.shouldDismiss, true);
assert.deepEqual(pair.state, createReaderControlBackdropTouchState());
assert.equal(up(pair, 108, 208, 499).shouldDismiss, false);

// Another finger never steals the first DOWN, including a rejected Dock DOWN.
for (const rejected of [false, true]) {
  pair = down(100, rejected ? 460 : 200);
  const owned = pair.state;
  pair = step(pair.state, event('down', 100, 200, 10, 2));
  assert.strictEqual(pair.state, owned);
  pair = up(pair, 100, 200, 20, 2);
  assert.strictEqual(pair.state, owned);
  assert.equal(pair.shouldDismiss, false);
  pair = up(pair, 100, rejected ? 460 : 200, 100);
  assert.equal(pair.shouldDismiss, !rejected);
}

pair = down();
pair = step(pair.state, event('cancel'));
assert.deepEqual(pair.state, createReaderControlBackdropTouchState());
assert.equal(pair.shouldDismiss, false);
assert.equal(up(pair).shouldDismiss, false);

// Invalidation is sticky while that pointer stays down: returning to its
// original position, or removing the competing busy state, cannot rearm it.
pair = down();
pair = step(pair.state, event('move', 109, 200, 20));
assert.equal(pair.state.eligible, false);
assert.equal(pair.state.pointerId, 1);
pair = step(pair.state, event('move', 100, 200, 40));
assert.equal(up(pair).shouldDismiss, false);
assert.equal(up(down(), 100, 209).shouldDismiss, false, 'UP-only last displacement counts');
for (const time of [500, 501, 1000]) {
  assert.equal(up(down(), 100, 200, time).shouldDismiss, false, 'long hold is not a click');
}
pair = down();
pair = step(pair.state, event('move', 100, 200, 20), { ...context, heldPointerId: 2 });
assert.equal(up(pair).shouldDismiss, false);

// A close followed by reopen must reject the old UP. Animation epoch is not
// part of this API, so automatic continuation alone cannot invalidate a tap.
assert.equal(up(down(), 100, 200, 100, 1, { ...context, closeRevision: 4 }).shouldDismiss, false);
pair = down(100, 200, { ...context, invalidationRevision: 7 });
assert.equal(up(pair, 100, 200, 100, 1, { ...context, invalidationRevision: 8 }).shouldDismiss, false);
pair = down(100, 200, { ...context, invalidationRevision: 7 });
assert.equal(up(pair, 100, 200, 100, 1, { ...context, invalidationRevision: 7 }).shouldDismiss, true);
pair = down(100, 200, { ...context, animationEpoch: 2 });
assert.equal(up(pair, 100, 200, 100, 1, { ...context, animationEpoch: 6 }).shouldDismiss, true);

// Origin is evaluated at DOWN, not inferred from the now-moved Dock at UP.
// A control gesture cannot turn into background ownership by leaving its rect;
// a genuine background tap retains its origin when an automatic morph moves.
pair = down(100, 440);
assert.equal(up(pair, 100, 440, 100, 1, {
  ...context, excludedRects: [{ x: 13, y: 100, width: 364, height: 680 }],
}).shouldDismiss, true);
pair = down(100, 450);
assert.equal(up(pair, 100, 445).shouldDismiss, false);

// Unknown geometry, hidden controls, busy ownership and non-finite inputs must
// fail closed; time reversal cannot be used to turn a hold into a short tap.
for (const c of [
  { ...context, geometryReady: false }, { ...context, visible: false },
  { ...context, heldPointerId: 2 }, { ...context, closeRevision: NaN },
  { ...context, invalidationRevision: NaN },
  { ...context, excludedRects: [{ x: NaN, y: 0, width: 1, height: 1 }] },
]) assert.equal(up(down(100, 200, c), 100, 200, 100, 1, c).shouldDismiss, false);
pair = down();
pair = step(pair.state, event('move', 100, 200, 200));
assert.equal(up(pair, 100, 200, 100).shouldDismiss, false);
assert.equal(up(down(), NaN, 200).shouldDismiss, false);

const frozenState = Object.freeze(down().state);
const frozenEvent = Object.freeze(event('move', 101, 201, 20));
step(frozenState, frozenEvent, Object.freeze(context), Object.freeze(config));
console.log('reader control backdrop DOWN ownership and one-shot raw tap: PASS');
