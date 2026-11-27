import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderMeasurementContinuation } from '../../entry/src/main/ets/features/reading/application/ReaderMeasurementContinuation.ts';

test('canonical pagination continues in bounded frame slices without reentering the measured page', () => {
  let now = 0;
  let measured = 0;
  let inMeasurement = false;
  const frames: (() => void)[] = [];
  const continuation = new ReaderMeasurementContinuation(() => now, callback => frames.push(callback));
  const current = () => true;
  const measure = () => {
    assert.equal(inMeasurement, false);
    inMeasurement = true;
    now += 3;
    measured += 1;
    if (measured < 5) continuation.advance(current, measure);
    inMeasurement = false;
  };
  continuation.advance(current, measure);
  assert.equal(measured, 2);
  assert.equal(frames.length, 1);
  frames.shift()?.();
  assert.equal(measured, 4);
  assert.equal(frames.length, 1);
  frames.shift()?.();
  assert.equal(measured, 5);
  assert.equal(frames.length, 0);
});

test('a suspended measurement cannot advance after its layout lease expires', () => {
  let now = 0;
  let currentEpoch = 1;
  const frames: (() => void)[] = [];
  const continuation = new ReaderMeasurementContinuation(() => now, callback => frames.push(callback));
  continuation.advance(() => true, () => {
    now += 6;
    continuation.advance(() => currentEpoch === 1, () => assert.fail('retired measurement advanced'));
  });
  assert.equal(frames.length, 1);
  currentEpoch += 1;
  frames.shift()?.();
  assert.equal(frames.length, 0);
});
