import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as pinch from '../../entry/src/main/ets/features/manga/ui/MangaViewportPinch.ts';

test('pinch retains the image point beneath an off-center gesture across scale changes', () => {
  const center = { x: 120, y: 150 };
  const origin = { x: 20, y: 50 };
  const size = { x: 200, y: 400 };
  const point = pinch.mangaPinchImagePoint(center, origin, size);
  assert.deepEqual(point, { x: 100, y: 100 });
  const doubledContent = { x: 240, y: 260 };
  const offset = pinch.mangaPinchRestoreOffset(doubledContent, center);
  assert.deepEqual(offset, { x: 120, y: 110 });
  assert.deepEqual({ x: doubledContent.x - offset.x, y: doubledContent.y - offset.y }, center);
  assert.deepEqual(pinch.mangaPinchRestoreOffset({ x: 4, y: 6 }, center), { x: 0, y: -144 });
});

test('pinch hits outside the image clamp to its edge and invalid geometry is ignored', () => {
  assert.deepEqual(pinch.mangaPinchImagePoint({ x: 5, y: 110 }, { x: 15, y: 20 }, { x: 50, y: 80 }),
    { x: 0, y: 80 });
  assert.equal(pinch.mangaPinchImagePoint({ x: NaN, y: 10 }, { x: 10, y: 0 }, { x: 50, y: 80 }), undefined);
});

test('a late native jump must match the focal position with only proven edge clamps', () => {
  const matches = pinch.mangaPinchRestoreMatches;
  const requested = { x: 70, y: 140 };
  assert.equal(matches(requested, { x: 69, y: 141 }, 120, false, false), true);
  assert.equal(matches(requested, { x: 30, y: 140 }, 120, false, false), false);
  assert.equal(matches(requested, { x: 70, y: 172 }, 120, false, false), false);
  assert.equal(matches(requested, { x: 70, y: 100 }, 120, true, false), true);
  assert.equal(matches(requested, { x: 70, y: 170 }, 120, true, false), false);
  assert.equal(matches(requested, { x: 70, y: 170 }, 120, false, true), true);
  assert.equal(matches({ x: 170, y: 140 }, { x: 120, y: 140 }, 120, false, false), true);
});
