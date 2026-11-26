import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MeasuredReadingLine } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { ReadingPaginationPrefix, type ReadingPaginationKey } from '../../entry/src/main/ets/features/reading/application/ReadingPaginationIndex.ts';
import { ReaderPhysicalPaginationOwner } from '../../entry/src/main/ets/features/reading/ui/ReaderPhysicalPaginationOwner.ts';
import { admittedMeasuredPageCapacity, admitForwardMeasuredLines, admitMeasuredPageEnd,
  advanceMeasuredReadingBatch, canonicalMeasuredPageRequest, selectReverseMeasuredLines,
  type ReaderMeasuredPageEndInput } from '../../entry/src/main/ets/features/reading/ui/ReaderMeasuredPagePipeline.ts';

function measuredLine(index: number, startScalar: number, endScalar: number): MeasuredReadingLine {
  return new MeasuredReadingLine(index, startScalar, endScalar, startScalar, endScalar, 10);
}

function paginationKey(): ReadingPaginationKey {
  return { sourceId: 'local', bookId: 'book', chapterIndex: 5, layoutSignature: 'layout', contentVersion: 'version' };
}

test('a complete page stops before touching the native paragraph at a known end', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const batch = [0, 10, 20];
  const calls: string[] = [];
  assert.equal(advanceMeasuredReadingBatch(batch, owner, {
    paragraphStart: value => value,
    knownEnd: () => 10,
    consumeParagraph: value => { calls.push('consume:' + value); return 'continue'; },
    releaseMeasurement: () => assert.fail('early stop does not release'),
    prepareNextBatch: () => assert.fail('early stop does not prepare'),
  }), 'page-ready');
  assert.deepEqual(calls, ['consume:0']);
  assert.deepEqual(batch, [0, 10, 20]);
  assert.equal(owner.endScalar, 10);
});

test('a pending paragraph leaves the original suffix and a complete batch releases before preparing another', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const batch = [0, 10, 20];
  const calls: string[] = [];
  assert.equal(advanceMeasuredReadingBatch(batch, owner, {
    paragraphStart: value => value, knownEnd: () => undefined,
    consumeParagraph: (value, index) => {
      calls.push('consume:' + value);
      if (value !== 10) return 'continue';
      batch.splice(0, index);
      return 'waiting';
    },
    releaseMeasurement: () => assert.fail('waiting does not release'),
    prepareNextBatch: () => assert.fail('waiting does not prepare'),
  }), 'waiting');
  assert.deepEqual(batch, [10, 20]);
  assert.equal(advanceMeasuredReadingBatch(batch, owner, {
    paragraphStart: value => value,
    knownEnd: () => undefined,
    consumeParagraph: value => { calls.push('resume:' + value); return 'continue'; },
    releaseMeasurement: () => { assert.deepEqual(batch, [10, 20]); calls.push('release'); },
    prepareNextBatch: () => { assert.deepEqual(batch, []); calls.push('prepare'); return true; },
  }), 'next-batch');
  assert.deepEqual(calls, ['consume:0', 'consume:10', 'resume:10', 'resume:20', 'release', 'prepare']);
});

test('the forward lane admits span-height differences and never transfers a line beyond capacity', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const lines = [measuredLine(0, 0, 3), measuredLine(1, 3, 6), measuredLine(2, 6, 9)];
  const calls: Array<string> = [];
  assert.equal(admitForwardMeasuredLines(lines, owner, {
    knownEnd: undefined, isParagraphStart: true,
    capacity: () => 23, paragraphSpacing: () => 4,
    spanHeight: (first, last) => { calls.push('measure:' + first + ':' + last); return 10 + last * 12; },
    appendLine: (line, height, paragraphStart, first) => {
      calls.push('append:' + line.lineIndex + ':' + height + ':' + paragraphStart + ':' + first);
      owner.appendFragment(line.lineIndex, line.startScalar, line.endScalar, height, paragraphStart, 4);
    },
  }), 'page-ready');
  assert.deepEqual(calls, ['measure:0:0', 'append:0:10:true:true', 'measure:0:1',
    'append:1:12:false:false', 'measure:0:2']);
  assert.deepEqual(owner.fragments, [0, 1]);
  assert.equal(owner.endScalar, 6);
});

test('the exact end and crossing checks happen before any native line sizing', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const input = {
    knownEnd: 4, isParagraphStart: false,
    capacity: (): number => assert.fail('known end wins'),
    paragraphSpacing: (): number => assert.fail('known end wins'),
    spanHeight: (): number => assert.fail('known end wins'),
    appendLine: (): void => assert.fail('known end wins'),
  };
  assert.equal(admitForwardMeasuredLines([measuredLine(1, 4, 8)], owner, input), 'page-ready');
  assert.equal(owner.endScalar, 4);
  assert.throws(() => admitForwardMeasuredLines([measuredLine(1, 3, 8)], owner, input),
    /PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED/);
  assert.throws(() => admittedMeasuredPageCapacity(Number.POSITIVE_INFINITY), /PAGINATION_SURFACE_HEIGHT_INVALID/);
  assert.throws(() => admittedMeasuredPageCapacity(0), /PAGINATION_SURFACE_HEIGHT_INVALID/);
});

test('the reverse lane sizes candidates in native order, preserves chronological lines, and stops on overflow', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const lines = [measuredLine(4, 12, 15), measuredLine(3, 9, 12), measuredLine(2, 6, 9), measuredLine(1, 3, 6)];
  const calls: string[] = [];
  const result = selectReverseMeasuredLines(lines, owner,
    (first, last) => { calls.push('measure:' + first + ':' + last); return (last - first + 1) * 11; },
    start => { calls.push('capacity:' + start); return 25; }, () => 3);
  assert.equal(result.full, true);
  assert.deepEqual(result.lines.map(line => line.lineIndex), [3, 4]);
  assert.equal(result.height, 22);
  assert.deepEqual(calls, ['measure:4:4', 'capacity:12', 'measure:3:4', 'capacity:9', 'measure:2:4', 'capacity:6']);
});

test('a measured page expands an incomplete tail, admits exact whitespace, and rejects a nonempty gap', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const base: ReaderMeasuredPageEndInput = {
    residentRange: () => ({ startScalar: 0, endScalar: 8, totalScalars: 16 }),
    isReverse: () => false, knownEnd: () => 10,
    gapText: () => assert.fail('unresident gap is not read'),
    lastMeasurable: () => assert.fail('exact end takes precedence'),
  };
  assert.equal(admitMeasuredPageEnd(owner, { ...base, residentRange: () => assert.fail('empty page') }), 'empty');
  owner.appendFragment(1, 0, 6, 10, true, 0);
  assert.equal(admitMeasuredPageEnd(owner, base), 'expand-after');
  assert.equal(owner.endScalar, 6);
  assert.throws(() => admitMeasuredPageEnd(owner, { ...base, residentRange: () => undefined, gapText: () => 'body' }),
    /PAGINATION_KNOWN_PAGE_BOUNDARY_CHANGED/);
  assert.equal(admitMeasuredPageEnd(owner, { ...base, residentRange: () => undefined, gapText: (start, end) => {
    assert.deepEqual([start, end], [6, 10]);
    return ' \r\n';
  } }), 'ready');
  assert.equal(owner.endScalar, 10);
  assert.equal(admitMeasuredPageEnd(owner, { ...base, knownEnd: () => undefined, lastMeasurable: () => 7 }), 'expand-after');
  assert.equal(admitMeasuredPageEnd(owner, { ...base, isReverse: () => true, knownEnd: () => assert.fail('reverse') }), 'ready');
});

test('canonical remeasurement preserves white-space intervals and exact measured or unresolved anchors', () => {
  const owner = new ReaderPhysicalPaginationOwner<number>();
  const key = paginationKey();
  const prefix = new ReadingPaginationPrefix(key, { requestScalar: 0, startScalar: 2, endScalarExclusive: 6 });
  assert.equal(prefix.admit({ requestScalar: 6, startScalar: 8, endScalarExclusive: 12 }), true);
  const start = (): number => 0;
  assert.deepEqual(canonicalMeasuredPageRequest(owner.index, key, () => prefix, start, 7), { offset: 2, unresolvedAnchor: -1 });
  assert.deepEqual(canonicalMeasuredPageRequest(owner.index, key, () => prefix, start, 12), { offset: 12, unresolvedAnchor: 12 });
  assert.deepEqual(canonicalMeasuredPageRequest(owner.index, { ...key, layoutSignature: 'stale' }, () => prefix, start, 8),
    { offset: 0, unresolvedAnchor: 8 });
  owner.index.recordChapter({ key, contentScalarLength: 18, pageStartScalars: [0, 6, 12] });
  assert.deepEqual(canonicalMeasuredPageRequest(owner.index, key, () => undefined, start, 11), { offset: 6, unresolvedAnchor: -1 });
});
