import assert from 'node:assert/strict';
import test from 'node:test';
import { ParagraphRange } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { planForwardReadingMeasurement } from '../../entry/src/main/ets/features/reading/application/ReadingChapterMeasurementPreparation.ts';
import { ReadingSurfaceLayoutMap } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';
import type { ReadingSessionChapter, ReadingSessionImage } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import {
  ReaderMeasurementRun, type ReaderMeasurementWindowRecovery,
} from '../../entry/src/main/ets/features/reading/ui/ReaderMeasurementRun.ts';
import {
  planForwardMeasuredImage, planReverseMeasuredImage,
} from '../../entry/src/main/ets/features/reading/ui/ReaderMeasuredPagePipeline.ts';
import { ReaderPhysicalPaginationOwner } from '../../entry/src/main/ets/features/reading/ui/ReaderPhysicalPaginationOwner.ts';

function fixture() {
  const timers = new Map<number, { delay: number; callback: () => void }>();
  let next = 0;
  const owner = new ReaderMeasurementRun({
    set: (delay, callback) => {
      next += 1;
      timers.set(next, { delay, callback });
      return next;
    },
    clear: (id) => { timers.delete(id); },
  });
  const failures: string[] = [];
  const fail = (error: Error): void => { failures.push(error.message); };
  const fire = (delay: number): void => {
    const current = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(current);
    timers.delete(current[0]);
    current[1].callback();
  };
  return { owner, timers, fire, failures, fail };
}

function metric(endIndex: number) {
  return { startIndex: 0, endIndex, height: 23, topHeight: 20, width: 50, baseline: 9 };
}

test('Unicode admission reads metrics only for one line and keeps verified geometry across layout runs', () => {
  const { owner, fail, failures } = fixture();
  const traces: string[] = [];
  const trace = (message: string): void => { traces.push(message); };
  const noLine = (): never => { throw new Error('line read during a zero line observation'); };
  for (let count = 0; count < 4; count += 1) {
    assert.equal(owner.validateUnicode(() => ({ count: 0, readLine: noLine }), fail, trace), false);
  }
  owner.beginNativeLayout();
  for (let count = 0; count < 4; count += 1) {
    assert.equal(owner.validateUnicode(() => ({ count: 0, readLine: noLine }), fail, trace), false);
  }
  assert.deepEqual(failures, []);
  assert.equal(owner.validateUnicode(() => ({ count: 0, readLine: noLine }), fail, trace), false);
  assert.deepEqual(failures, ['PAGINATION_UNICODE_PROBE_NO_LINES']);
  assert.equal(owner.validateUnicode(() => ({ count: 1, readLine: () => metric(4) }), fail, trace), true);
  assert.equal(owner.requiresUnicodeProbe(), false);
  owner.beginNativeLayout();
  assert.equal(owner.validateUnicode(noLine, fail, trace), true);
  assert.equal(traces.length, 1);
});

test('a Unicode line that splits a surrogate retains the specific conversion failure', () => {
  const { owner, fail, failures } = fixture();
  assert.equal(owner.validateUnicode(() => ({ count: 1, readLine: () => metric(2) }), fail, () => {}), false);
  assert.equal(owner.requiresUnicodeProbe(), true);
  assert.equal(failures[0], 'ArkUI line boundary splits a Unicode scalar');
});

test('title and paragraph gates log pending observations and transfer only after a positive count', () => {
  const { owner, fail, failures } = fixture();
  const transferred: number[] = [];
  owner.beginForwardGates();
  assert.equal(owner.captureTitle(() => { throw new Error('unavailable'); }, fail), false);
  assert.match(owner.pendingDiagnostic(true, false, true) ?? '', /attempt=1 .*titleLines=-2/);
  assert.equal(owner.pendingDiagnostic(true, false, true), undefined);
  assert.equal(owner.paragraphHasLayout(2, () => 0), false);
  assert.match(owner.pendingDiagnostic(true, true, false) ?? '', /batchPendingParagraph=2 batchPendingLines=0/);
  for (let count = 0; count < 7; count += 1) {
    assert.equal(owner.captureTitle(() => ({ count: 0, admit: () => { transferred.push(0); } }), fail), false);
  }
  assert.deepEqual(failures, ['PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE']);
  assert.deepEqual(transferred, []);
  assert.equal(owner.captureTitle(() => ({ count: 2, admit: () => { transferred.push(2); } }), fail), true);
  assert.deepEqual(transferred, [2]);
});

test('layout deadline uses the current lease and native retry is selection-bounded', () => {
  const { owner, timers, fire, fail, failures } = fixture();
  let isCurrent = true;
  const busy = new Error('NATIVE_TEXT_LAYOUT_UNAVAILABLE');
  const calls: string[] = [];
  owner.armDeadline(() => isCurrent, fail);
  owner.armDeadline(() => isCurrent, fail);
  assert.equal(timers.size, 1);
  const retry = () => owner.retryLayout(busy, () => true, () => () => isCurrent, () => { calls.push('retry'); });
  assert.equal(retry(), true);
  isCurrent = false;
  fire(16);
  fire(6000);
  assert.deepEqual(calls, []);
  assert.deepEqual(failures, []);
  isCurrent = true;
  assert.equal(retry(), true);
  fire(16);
  assert.deepEqual(calls, ['retry']);
  assert.equal(retry(), false);
  owner.resetSelection();
  assert.equal(retry(), true);
  owner.armDeadline(() => isCurrent, fail);
  fire(6000);
  assert.deepEqual(failures, ['PAGINATION_LAYOUT_METRICS_UNAVAILABLE']);
});

function windowChapter(bodyVersion?: string, processingVersion?: string): ReadingSessionChapter {
  return {
    sourceId: 'source', bookId: 'book', chapterIndex: 4, chapterTitle: 'Title', chapterUrl: undefined,
    content: 'abc', images: [], contentVersion: 'page-version', extractionVia: 'rule', bodyVersion, processingVersion,
  };
}

test('window recovery keeps source version evidence and declines a late selection', async () => {
  const { owner, fail, failures } = fixture();
  const activity: string[] = [];
  const interrupted = { current: true };
  let release = (): void => {};
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const host: ReaderMeasurementWindowRecovery = {
    mayReload: () => true,
    offset: () => 21,
    waitForContentIdle: () => { activity.push('wait'); return waiting; },
    reopen: async (offset, context) => {
      activity.push(`open ${offset}`);
      assert.deepEqual(context, { bodyVersion: 'body', processingVersion: 'rules', anchors: [{ id: 'requested', offset: 21 }] });
    },
    selectionActive: () => interrupted.current,
    fail,
  };
  const original = new Error('version changed');
  const chapter = windowChapter('body', 'rules');
  const delayed = owner.recoverWindow(original, chapter, () => interrupted.current, host);
  assert.deepEqual(activity, ['wait']);
  interrupted.current = false;
  release();
  await delayed;
  assert.deepEqual(activity, ['wait']);
  interrupted.current = true;
  await owner.recoverWindow(original, chapter, () => interrupted.current, host);
  await owner.recoverWindow(original, chapter, () => interrupted.current, host);
  assert.deepEqual(activity, ['wait', 'wait', 'open 21']);
  assert.deepEqual(failures, ['version changed']);
  owner.resetSelection();
  await owner.recoverWindow(original, windowChapter(), () => interrupted.current, host);
  assert.deepEqual(failures, ['version changed', 'version changed']);
  assert.deepEqual(activity, ['wait', 'wait', 'open 21']);
});

test('forward measurement requests missing context and clamps whitespace EOF in absolute scalar space', () => {
  const text = 'A😀B  ';
  const map = new ReadingSurfaceLayoutMap(text, { startScalar: 10, endScalar: 15, totalScalars: 30 });
  const ranges = [new ParagraphRange('only', 0, text.length, 10, 15)];
  assert.equal(planForwardReadingMeasurement(9, text, map, []).expand, 'before');
  assert.equal(planForwardReadingMeasurement(15, text, map, []).expand, 'after');
  assert.deepEqual(planForwardReadingMeasurement(14, text, map, ranges), { expand: undefined, offset: 12, progress: 0.4 });
  assert.throws(() => planForwardReadingMeasurement(13, text, map, [new ParagraphRange('blank', 4, 6, 13, 15)]),
    /READING_CONTENT_EMPTY/);
});

test('forward image defers decode on a full page and reverse capacity is read only for eligible geometry', () => {
  const packed = new ReaderPhysicalPaginationOwner<string>();
  packed.appendFragment('text', 0, 10, 20, true, 0);
  const reads: string[] = [];
  const geometry = {
    capacity: (start: number) => { reads.push(`capacity ${start}`); return 20; },
    lineHeight: () => { reads.push('line'); return 18; },
    paragraphSpacing: () => { reads.push('gap'); return 1; },
    scaledHeight: () => { reads.push('scaled'); return 5; },
  };
  const unknown: ReadingSessionImage = {
    source: 'img', baseUrl: undefined, startScalar: 10, endScalar: 11, state: 'pending',
    pixelMap: undefined, fileUri: '', intrinsicWidth: 0, intrinsicHeight: 0, revision: 'pending',
  };
  assert.equal(planForwardMeasuredImage(unknown, packed, geometry).result, 'page-ready');
  assert.deepEqual(reads, ['capacity 10', 'line', 'gap']);
  reads.length = 0;
  packed.resetPage();
  assert.equal(planForwardMeasuredImage(unknown, packed, geometry).result, 'waiting');
  assert.deepEqual(reads, ['capacity 10', 'line', 'gap']);
  reads.length = 0;
  assert.equal(planReverseMeasuredImage(unknown, 9, packed, geometry).result, 'waiting');
  const ready: ReadingSessionImage = { ...unknown, state: 'ready', intrinsicWidth: 20, intrinsicHeight: 10 };
  assert.equal(planReverseMeasuredImage(ready, 10, packed, geometry).result, 'outside-page');
  assert.deepEqual(reads, []);
  assert.deepEqual(planReverseMeasuredImage(ready, 11, packed, geometry), { result: 'admitted', height: 5 });
  assert.deepEqual(reads, ['capacity 10', 'scaled', 'gap']);
});
