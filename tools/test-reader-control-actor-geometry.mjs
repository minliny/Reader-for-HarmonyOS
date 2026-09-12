import assert from 'node:assert/strict';
import { readerControlActor, readerControlLerp, readerControlUnit, sampleReaderControlActor }
  from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `${actual} != ${expected}`);
const quick = Object.freeze(readerControlActor(17, 48, 252, 32, 1));
const full = Object.freeze(readerControlActor(11, 99, 316, 40, 1));
assert.deepEqual(sampleReaderControlActor(quick, full, 0), quick);
assert.deepEqual(sampleReaderControlActor(quick, full, 1), full);
assert.notEqual(sampleReaderControlActor(quick, full, 0), quick, 'samples do not alias endpoint objects');
assert.deepEqual(sampleReaderControlActor(quick, full, -1), quick);
assert.deepEqual(sampleReaderControlActor(quick, full, 2), full);
assert.deepEqual(sampleReaderControlActor(quick, full, Number.NaN), quick);
for (const p of [Number.NaN, Infinity, -Infinity]) assert.equal(readerControlUnit(p), 0);
assert.equal(readerControlLerp(4, 8, 0.25), 5);
assert.deepEqual(readerControlActor(2, 3, -1, -2, 4),
  { x: 2, y: 3, width: 0, height: 0, opacity: 1 });

// Independent trajectories consume exactly the same spatial progress. No
// chronological playback/hidden source state is required to reverse or re-grab.
const outgoingQuick = Object.freeze(readerControlActor(312.44, 29, 38, 190, 1));
const outgoingFull = Object.freeze(readerControlActor(364, 29, 38, 190, 0));
const incomingQuick = Object.freeze(readerControlActor(1, 61, 336, 52, 0));
const incomingFull = Object.freeze(readerControlActor(1, 43, 336, 52, 1));
const fields = ['x', 'y', 'width', 'height', 'opacity'];
for (let index = 0; index <= 1000; index += 1) {
  const p = index / 1000;
  const forward = sampleReaderControlActor(quick, full, p);
  const reversed = sampleReaderControlActor(full, quick, 1 - p);
  for (const key of fields) near(forward[key], reversed[key]);
  const outgoing = sampleReaderControlActor(outgoingQuick, outgoingFull, p);
  const incoming = sampleReaderControlActor(incomingQuick, incomingFull, p);
  assert.equal(outgoing.height, 190);
  near(outgoing.opacity + incoming.opacity, 1);
  near((outgoing.x - outgoingQuick.x) / (outgoingFull.x - outgoingQuick.x), p);
  near((incoming.y - incomingQuick.y) / (incomingFull.y - incomingQuick.y), p);
  if (p > 0 && p < 1) assert.ok(incoming.opacity > 0 && outgoing.opacity > 0,
    'incoming and outgoing actors move concurrently, never in separate time windows');
}
for (const p of [0.65, 0.25, 0.91, 0.05, 0.65]) {
  const first = sampleReaderControlActor(quick, full, p);
  sampleReaderControlActor(outgoingQuick, outgoingFull, 1 - p);
  assert.deepEqual(sampleReaderControlActor(quick, full, p), first);
}
assert.deepEqual(quick, { x: 17, y: 48, width: 252, height: 32, opacity: 1 });
console.log('Reader control shared actor geometry: production bidirectional/concurrent/pure sampling PASS');
