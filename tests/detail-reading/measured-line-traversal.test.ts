import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectForwardMeasuredLines,
  collectReverseMeasuredLines,
  type ReadingForwardMeasuredLinePort,
} from '../../entry/src/main/ets/features/reading/application/ReadingMeasuredLineTraversal.ts';
import { ReadingSurfaceLayoutMap, type ReadingSurfaceLineMetric } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';

function metric(startIndex: number, endIndex: number, height = 10): ReadingSurfaceLineMetric {
  return { startIndex, endIndex, height, topHeight: 0, width: 10, baseline: 1 };
}

function port(metrics: ReadingSurfaceLineMetric[], events: string[], stopAt?: number): ReadingForwardMeasuredLinePort {
  return {
    lineEndUtf16: (index): number => { events.push(`end:${index}`); return metrics[index].endIndex; },
    readLine: (index): ReadingSurfaceLineMetric => { events.push(`line:${index}`); return metrics[index]; },
    exceedsCapacity: (first, last): boolean => {
      events.push(`height:${first}–${last}`);
      return first === stopAt || last === stopAt;
    },
    reportOverlap: (index, value, previousEnd): void => {
      events.push(`overlap:${index}:${value.startIndex}:${value.endIndex}:${previousEnd}`);
    },
    reportEmpty: (first): void => { events.push(`empty:${first}`); },
  };
}

test('forward traversal reads only binary-search tails and the first overflowing actual line', () => {
  const events: string[] = [];
  const metrics = [metric(0, 1), metric(1, 3), metric(3, 4), metric(4, 5), metric(5, 6)];
  const projected = collectForwardMeasuredLines(new ReadingSurfaceLayoutMap('a😀bcd'), 10, metrics.length,
    1, port(metrics, events, 2));
  assert.deepEqual(events, ['end:2', 'end:1', 'end:0', 'line:1', 'height:1–1', 'line:2', 'height:1–2']);
  assert.deepEqual(projected.map(line => [line.lineIndex, line.startUtf16, line.endUtf16, line.startScalar, line.endScalar]),
    [[1, 1, 3, 11, 12], [2, 3, 4, 12, 13]]);
});

test('reverse traversal allows a zero-height line and does not read past proved overflow', () => {
  const events: string[] = [];
  const metrics = [metric(0, 1), metric(1, 3), metric(3, 4, 0), metric(4, 5), metric(5, 6)];
  const projected = collectReverseMeasuredLines(new ReadingSurfaceLayoutMap('a😀bcd'), 10, metrics.length,
    4, port(metrics, events, 1));
  assert.deepEqual(events, ['end:2', 'end:4', 'end:3', 'line:2', 'height:2–2', 'line:1', 'height:1–2']);
  assert.deepEqual(projected.map(line => [line.lineIndex, line.height]), [[2, 0], [1, 10]]);
  assert.deepEqual(collectReverseMeasuredLines(new ReadingSurfaceLayoutMap('x'), 0, 1, 0,
    port([metric(0, 1)], [])), []);
});

test('a skipped forward line retains the overlap guard, before any height sample', () => {
  const events: string[] = [];
  const metrics = [metric(0, 3, 0), metric(1, 4)];
  assert.throws(() => collectForwardMeasuredLines(new ReadingSurfaceLayoutMap('a😀b'), 0, metrics.length,
    0, port(metrics, events)), { message: 'PAGINATION_LINE_GEOMETRY_INVALID' });
  assert.deepEqual(events, ['end:1', 'end:0', 'line:0', 'line:1', 'overlap:1:1:4:3']);
});

test('forward empty input and split scalars fail via their existing distinct paths', () => {
  const events: string[] = [];
  assert.throws(() => collectForwardMeasuredLines(new ReadingSurfaceLayoutMap('a'), 0, 1, 0,
    port([metric(0, 1, 0)], events)), { message: 'PAGINATION_LINE_GEOMETRY_INVALID' });
  assert.deepEqual(events, ['end:0', 'line:0', 'empty:0']);
  const invalid: string[] = [];
  assert.throws(() => collectForwardMeasuredLines(new ReadingSurfaceLayoutMap('😀'), 0, 1, 0,
    port([metric(0, 1)], invalid)), { message: 'ArkUI line boundary splits a Unicode scalar' });
  assert.deepEqual(invalid, ['end:0', 'line:0']);
});
