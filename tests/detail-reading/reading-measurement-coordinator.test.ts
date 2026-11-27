import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReaderWindowMetricsLayoutKey,
  ReadingMeasurementCoordinator,
  readingGestureInset,
  type ReadingMeasurementContent,
  type ReadingMeasurementStartHost,
  type ReadingWindowLayoutFields,
  type ReadingWindowReflowHost,
} from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementCoordinator.ts';
import { ReaderMeasurementRun } from '../../entry/src/main/ets/features/reading/application/ReaderMeasurementRun.ts';
import { ParagraphRange } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { ReadingPaginationPrefix } from '../../entry/src/main/ets/features/reading/application/ReadingPaginationIndex.ts';
import { ReadingSurfaceLayoutMap } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';

function coordinator() {
  return new ReadingMeasurementCoordinator(new ReaderMeasurementRun({ set: () => 1, clear: () => {} }));
}

test('the measuring entry defers a live commit and stays closed to a retired selection', () => {
  const measurement = coordinator();
  const events: string[] = [];
  let active = false;
  let completing = true;
  const host: ReadingMeasurementStartHost = {
    isActive: () => active,
    hasViewport: () => { events.push('viewport'); return true; },
    isCompleting: () => completing,
    defer: () => { events.push('defer'); },
    captureContent: () => { events.push('capture'); return undefined; },
    retry: () => assert.fail('a retired chapter has no measurement error'),
    fail: () => assert.fail('a retired chapter has no measurement error'),
  };
  measurement.begin(host);
  assert.deepEqual(events, []);
  active = true;
  measurement.begin(host);
  assert.deepEqual(events, ['viewport', 'defer']);
  completing = false;
  measurement.begin(host);
  assert.deepEqual(events, ['viewport', 'defer', 'viewport', 'capture']);
});

test('the measurement entry requests original window context before measuring and retains absolute scalar progress', () => {
  const measurement = coordinator();
  const events: string[] = [];
  const text = 'A😀';
  const map = new ReadingSurfaceLayoutMap(text, { startScalar: 8, endScalar: 10, totalScalars: 20 });
  let offset = 4;
  let previous = false;
  const content: ReadingMeasurementContent = {
    prepare: () => { events.push('prepare'); },
    hasParagraphs: () => true,
    hasPreviousPage: () => previous,
    document: () => ({ content: text, map, ranges: [new ParagraphRange('resident', 0, 3, 8, 10)], offset }),
    measurePrevious: () => { events.push('reverse'); },
    expand: direction => { events.push(direction); },
    measureForward: start => { events.push(`paint ${start.offset} ${start.progress}`); },
  };
  const host: ReadingMeasurementStartHost = {
    isActive: () => true, hasViewport: () => true, isCompleting: () => false,
    defer: () => assert.fail('no write in flight'), captureContent: () => content,
    retry: () => false, fail: assert.fail,
  };
  measurement.begin(host);
  offset = 10;
  measurement.begin(host);
  offset = 9;
  measurement.begin(host);
  previous = true;
  measurement.begin(host);
  assert.deepEqual(events, ['prepare', 'before', 'prepare', 'after', 'prepare', 'paint 9 0.45', 'prepare', 'reverse']);
});

test('live Unicode and title facts gate native batch consumption in order', () => {
  const measurement = coordinator();
  const events: string[] = [];
  let current = false;
  let unicodeLines = 0;
  let title = false;
  const host = {
    isCurrent: () => current,
    readUnicode: () => {
      events.push('unicode');
      return { count: unicodeLines, readLine: () => ({ startIndex: 0, endIndex: 4, height: 20,
        topHeight: 18, width: 10, baseline: 12 }) };
    },
    captureTitle: () => { events.push('title'); return title; },
    hasBatch: () => true,
    consumeBatch: () => { events.push('consume'); },
    trace: () => {}, fail: assert.fail,
  };
  measurement.captureLayout(host);
  current = true;
  measurement.captureLayout(host);
  unicodeLines = 1;
  measurement.captureLayout(host);
  title = true;
  measurement.captureLayout(host);
  assert.deepEqual(events, ['unicode', 'unicode', 'title', 'title', 'consume']);
});

test('reverse pagination retains only observations made under the same chapter and layout', () => {
  const measurement = coordinator();
  const map = new ReadingSurfaceLayoutMap('A😀', { startScalar: 8, endScalar: 10, totalScalars: 20 });
  const key = { sourceId: 'source', bookId: 'book', chapterIndex: 9, layoutSignature: 'old', contentVersion: '1' };
  const draft = new ReadingPaginationPrefix(key, { requestScalar: 7, startScalar: 8, endScalarExclusive: 12 });
  const boundary = { endScalar: -1, originalChapterIndex: 9, originalChapterOffset: 8, targetChapterIndex: 9 };
  assert.equal(measurement.reverseEnd(boundary, map, draft, () => key), 7);
  assert.equal(measurement.reverseEnd(boundary, map, draft, () => ({ ...key, layoutSignature: 'new' })), 8);
  assert.equal(measurement.reverseEnd({ ...boundary, targetChapterIndex: 8 }, map, draft, () => key), 20);
  assert.equal(measurement.reverseExpansion(map, 20, -1), 'after');
  assert.equal(measurement.reverseExpansion(map, 8, -1), 'before');
  assert.equal(measurement.reverseExpansion(map, 10, 0), undefined);
});

const measuredWindow: ReadingWindowLayoutFields = {
  widthClass: 'expanded', viewportWidth: 762, viewportHeight: 959, contentTop: 23, contentRight: 31,
  contentBottom: 47, contentLeft: 53, facingChapterWidth: 246, titleTrackHeightVp: 52.5, systemFontScale: 1.25,
};

test('the measurement key preserves canonical layout and window policy field order', () => {
  assert.equal(createReaderWindowMetricsLayoutKey(measuredWindow, true, false),
    'expanded|762|959|23|31|47|53|246|52.5|1.25|true|false');
  assert.equal(createReaderWindowMetricsLayoutKey(measuredWindow, false, true),
    'expanded|762|959|23|31|47|53|246|52.5|1.25|false|true');
});

test('window reflow defers frozen turns and invalidates a changed layout before requesting a page', () => {
  const measurement = coordinator();
  measurement.rememberWindowLayout({ layout: measuredWindow, extendIntoCutout: false, hideNavigationBar: false });
  const events: string[] = [];
  let turning = true;
  let completing = true;
  const layout = { ...measuredWindow, contentTop: 24 };
  let hideNavigationBar = false;
  const host: ReadingWindowReflowHost = {
    hasTurnInFlight: () => turning,
    deferForTurn: () => { events.push('rollback'); },
    windowLayout: () => {
      events.push('key');
      return { layout, extendIntoCutout: false, hideNavigationBar };
    },
    invalidateTurn: () => { events.push('invalidate turn'); },
    invalidatePagination: () => { events.push('invalidate pages'); },
    applyChrome: () => { events.push('chrome'); },
    hasMaterializedChapter: () => true,
    isCompleting: () => completing,
    deferMeasurement: () => { events.push('defer'); },
    beginMeasurement: () => { events.push('measure'); },
  };
  measurement.reflowWindow(host);
  assert.deepEqual(events, ['rollback']);
  turning = false;
  measurement.reflowWindow(host);
  measurement.reflowWindow(host);
  completing = false;
  hideNavigationBar = true;
  measurement.reflowWindow(host);
  assert.deepEqual(events, ['rollback', 'key', 'invalidate turn', 'invalidate pages', 'chrome', 'defer',
    'key', 'chrome', 'key', 'invalidate turn', 'invalidate pages', 'chrome', 'measure']);
});

test('appearance recovery suppresses superseded rejection while only the current measurement resumes', () => {
  const measurement = coordinator();
  let active = false;
  let current = false;
  let resumed = 0;
  const host = {
    isSelectionActive: () => active,
    layoutSignature: () => 'new',
    isMeasurementCurrent: () => current,
    resume: () => { resumed += 1; },
  };
  assert.equal(measurement.restoreAfterAppearanceChange('old', host), false);
  active = true;
  assert.equal(measurement.restoreAfterAppearanceChange('new', host), false);
  assert.equal(measurement.restoreAfterAppearanceChange('old', host), true);
  assert.equal(resumed, 0);
  current = true;
  assert.equal(measurement.restoreAfterAppearanceChange('old', host), true);
  assert.equal(resumed, 1);
  assert.equal(readingGestureInset(16, 15, 38), 38);
  assert.equal(readingGestureInset(24, Number.NaN, -1), 24);
});

test('a discarded measurement request preserves a deferred appearance invalidation until a live reflow', () => {
  const measurement = coordinator();
  const events: string[] = [];
  const invalidate = () => { events.push('invalidate old pagination'); };
  const measure = () => { events.push('measure accepted appearance'); };
  measurement.deferMeasurement(true);
  measurement.clearDeferredRequest();
  assert.equal(measurement.hasDeferredWork(), true);
  measurement.resumeDeferred(true, invalidate, measure);
  assert.deepEqual(events, []);
  measurement.deferMeasurement();
  measurement.resumeDeferred(false, invalidate, measure);
  assert.deepEqual(events, []);
  measurement.resumeDeferred(true, invalidate, measure);
  assert.deepEqual(events, ['invalidate old pagination', 'measure accepted appearance']);
  assert.equal(measurement.hasDeferredWork(), false);
});
