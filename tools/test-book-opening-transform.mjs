import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'cover-transform':{description:'Production cover transform endpoints, minimal uniform cover, radii and changed target',resources:[]}});
for(const id of selected){
// Focused production geometry invariants; no SDK, build, device or nested gate.
const { default: assert } = await import('node:assert/strict');
const { bookshelfMotionTransformAt } = await import('../entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts');

const origin = { sourceId: 's', bookId: 'b', coverUrl: '', title: '', radius: 8,
  rect: { x: 70, y: 180, width: 90, height: 130 } };
const target = { x: 12, y: 24, width: 390, height: 844 };
const request = { id: 1, direction: 'open', origin, target, paperColor: '#fff', paperInk: '#000' };
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <=
  1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);

assert.deepEqual(bookshelfMotionTransformAt(request, 0, 1).rect, origin.rect);
assert.deepEqual(bookshelfMotionTransformAt(request, 1, 1).rect, target);
assert.deepEqual(bookshelfMotionTransformAt(request, -1, 1).rect, origin.rect);
assert.deepEqual(bookshelfMotionTransformAt(request, 2, 1).rect, target);
assert.deepEqual(bookshelfMotionTransformAt(request, NaN, 1).rect, origin.rect);

// Independent bitmap fixtures describe Contain's actual fixed-target content.
// Net transform must be uniform, fully cover the panel, and touch one edge pair.
for (const fixture of [
  { aspect: 0.1, width: 84.4, height: 844 },
  { aspect: 10, width: 390, height: 39 },
  { aspect: 1, width: 390, height: 390 }
]) {
  for (const carry of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
    const t = bookshelfMotionTransformAt(request, carry, fixture.aspect);
    const netX = t.sx * t.imageScaleX;
    const netY = t.sy * t.imageScaleY;
    near(netX, netY, 'bitmap stays undistorted');
    near(target.width * t.sx, t.rect.width, 'panel width');
    near(target.height * t.sy, t.rect.height, 'panel height');
    const width = fixture.width * netX, height = fixture.height * netY;
    assert.ok(width >= t.rect.width - 1e-8, 'cover leaves no horizontal gap');
    assert.ok(height >= t.rect.height - 1e-8, 'cover leaves no vertical gap');
    assert.ok(Math.abs(width - t.rect.width) < 1e-8 || Math.abs(height - t.rect.height) < 1e-8,
      'cover uses the minimal uniform scale');
    near(t.radiusX * t.sx, origin.radius * (1 - carry), 'horizontal corner radius');
    near(t.radiusY * t.sy, origin.radius * (1 - carry), 'vertical corner radius');
  }
}

for (const invalidAspect of [0, -1, NaN, Infinity, -Infinity]) {
  assert.deepEqual(bookshelfMotionTransformAt(request, 0.4, invalidAspect),
    bookshelfMotionTransformAt(request, 0.4, origin.rect.width / origin.rect.height));
}
const updated = { ...request, target: { x: 35, y: 18, width: 800, height: 260 } };
const updatedEnd = bookshelfMotionTransformAt(updated, 1, 10);
assert.deepEqual(updatedEnd.rect, updated.target);
assert.equal(updatedEnd.sx, 1);
assert.equal(updatedEnd.sy, 1);
const updatedMid = bookshelfMotionTransformAt(updated, 0.5, 10);
assert.deepEqual(updatedMid.rect, { x: 52.5, y: 99, width: 445, height: 195 });
near(updatedMid.sx * updatedMid.imageScaleX, updatedMid.sy * updatedMid.imageScaleY, 'updated target compensation');
assert.ok(800 * updatedMid.sx * updatedMid.imageScaleX >= updatedMid.rect.width);
near(80 * updatedMid.sy * updatedMid.imageScaleY, updatedMid.rect.height, 'updated landscape cover');
console.log('book opening transform: endpoints, portrait/landscape cover, uniform bitmap, radii, fallback and target update PASS');

recordContractCasePass(id);
}
