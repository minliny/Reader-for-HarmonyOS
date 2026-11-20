import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'timeline-and-rect':{description:'Actual timeline reversal/seek and stale rectangle identity rejection; plain production functions',resources:[]}});
for(const id of selected){
// Explicit, focused regression: shared time reversal/seek and stale geometry receipts.
// No SDK, build, device, or other test suite is invoked.
const { default: assert } = await import('node:assert/strict');
const { motionTimelineDuration, sampleMotionSegment, ReversibleMotionTimeline } = await import('../entry/src/main/ets/features/common/MotionTimeline.ts');
const { readerSurfaceRectInHost } = await import('../entry/src/main/ets/features/common/ReaderSurfaceRect.ts');

const linear = (p) => p;
const segments = [{ at: 0, duration: 320, curve: linear },
  { at: 320, duration: 300, curve: linear }, { at: 620, duration: 160, curve: linear }];
assert.equal(motionTimelineDuration(segments), 780);
for (const segment of segments) {
  let previous = 0;
  for (let t = 0; t <= 780; t++) {
    const value = sampleMotionSegment(t, segment);
    assert.ok(value >= previous && value >= 0 && value <= 1);
    previous = value;
  }
  assert.equal(sampleMotionSegment(segment.at, segment), 0);
  assert.equal(sampleMotionSegment(segment.at + segment.duration, segment), 1);
}
const timeline = new ReversibleMotionTimeline(780);
timeline.retarget(true, 1000);
assert.equal(timeline.sample(1390), 390);
timeline.retarget(false, 1390);
for (let elapsed = 0; elapsed <= 390; elapsed++) {
  const reverseTime = timeline.sample(1390 + elapsed);
  for (const segment of segments) {
    assert.equal(sampleMotionSegment(reverseTime, segment), sampleMotionSegment(390 - elapsed, segment));
  }
}
timeline.seek(900, 2000);
assert.equal(timeline.sample(2500), 780);
assert.equal(timeline.running(2500), false);
timeline.retarget(false, 2500);
assert.equal(timeline.sample(2510), 770);
timeline.seek(-1, 2600);
assert.equal(timeline.sample(2600), 0);

const identity = { route: 'reading', owner: 'page', generation: 4 };
const receipt = { identity, rect: { x: 40, y: 70, width: 300, height: 500 } };
const host = { x: 10, y: 20, width: 400, height: 700 };
assert.deepEqual(readerSurfaceRectInHost(receipt, identity, host), { x: 30, y: 50, width: 300, height: 500 });
for (const stale of [{ ...identity, generation: 5 }, { ...identity, route: 'bookshelf' },
  { ...identity, owner: 'other' }]) assert.equal(readerSurfaceRectInHost(receipt, stale, host), undefined);
assert.equal(readerSurfaceRectInHost({ ...receipt, rect: { ...receipt.rect, width: 0 } }, identity, host), undefined);
assert.equal(readerSurfaceRectInHost(receipt, identity, { ...host, x: NaN }), undefined);
console.log('PASS motion timeline and surface rectangle');

recordContractCasePass(id);
}
