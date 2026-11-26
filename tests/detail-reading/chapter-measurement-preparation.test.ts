import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  completeReadingEntryWindow,
  prepareReadingChapterMeasurement,
  prepareReadingParagraphWindowMeasurement,
  projectRetainedReadingParagraphWindow,
} from '../../entry/src/main/ets/features/reading/application/ReadingChapterMeasurementPreparation.ts';
import type { ReadingSessionChapter, ReadingSessionImage } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { ParagraphRange } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import type { ReadingDocumentRange } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';

function chapter(content: string, documentRange?: ReadingDocumentRange): ReadingSessionChapter {
  return {
    sourceId: 'local', bookId: 'test-book', chapterIndex: 2, chapterTitle: 'Test chapter',
    chapterUrl: undefined, content, documentRange, images: [], contentVersion: 'same-content',
    bodyVersion: 'body', processingVersion: 'processing', extractionVia: 'local',
  };
}

function chapterImage(startScalar: number): ReadingSessionImage {
  return {
    source: 'image-' + startScalar, baseUrl: undefined, startScalar, endScalar: startScalar + 1,
    state: 'ready', pixelMap: undefined, fileUri: 'example.png', intrinsicWidth: 300, intrinsicHeight: 300,
    revision: 'same-image',
  };
}

const current = (): boolean => true;

test('cold preparation retains original paragraph text and both offset units', async () => {
  const source = chapter('A😀\r\n\r\n乙\n丙');
  const projection = await prepareReadingChapterMeasurement(source, () => 'blankLineSeparated', current);
  assert.equal(projection.map.scalarCount(), 9);
  assert.deepEqual(projection.ranges, [
    new ParagraphRange('paragraph-0-0', 0, 3, 0, 2),
    new ParagraphRange('paragraph-1-7', 7, 10, 6, 9),
  ]);
  assert.equal(projection.map.sliceByScalar(6, 9), '乙\n丙');
});

test('cold preparation stops when the selection retires at its first 512-range yield', async () => {
  let ownsSelection = true;
  const source = chapter(Array.from({ length: 600 }, () => 'A').join('\n'));
  const pending = prepareReadingChapterMeasurement(source, () => 'lineSeparated', () => ownsSelection);
  setTimeout(() => { ownsSelection = false; }, 0);
  await assert.rejects(pending, { message: 'READING_CONTENT_PREPARATION_CANCELLED' });
});

test('entry expansion waits for first-page persistence before admitting prepared paragraphs', async () => {
  const retained = chapterImage(2);
  const partial = {
    ...chapter('A\n\uFFFC', { startScalar: 0, endScalar: 3, totalScalars: 5 }),
    images: [retained],
  };
  const expanded = { ...chapter('A\n\uFFFC\n乙'), images: [{ ...retained }] };
  const save = Promise.withResolvers<void>();
  const events: string[] = [];
  const expansion = completeReadingEntryWindow(Promise.resolve(expanded), partial, current, {
    firstPagePersistence: (): Promise<void> => { events.push('save'); return save.promise; },
    boundaryMode: () => { events.push('boundary'); return 'lineSeparated'; },
    admit: (content, ranges): void => {
      events.push('admit');
      assert.equal(content.documentRange, undefined);
      assert.equal(content.images[0], retained);
      assert.deepEqual(ranges, [
        new ParagraphRange('paragraph-0-0', 0, 1, 0, 1),
        new ParagraphRange('paragraph-1-2', 2, 3, 2, 3),
        new ParagraphRange('paragraph-2-4', 4, 5, 4, 5),
      ]);
    },
  });
  await Promise.resolve();
  assert.deepEqual(events, ['save']);
  save.resolve();
  await expansion;
  assert.deepEqual(events, ['save', 'boundary', 'admit']);
});

test('a retired entry observes its pending save without publishing a chapter', async () => {
  let ownsSelection = true;
  const save = Promise.withResolvers<void>();
  const expansion = completeReadingEntryWindow(Promise.resolve(chapter('A\nB')), chapter('A'), () => ownsSelection, {
    firstPagePersistence: (): Promise<void> => save.promise,
    boundaryMode: () => assert.fail('the entry retired while waiting for its first-page save'),
    admit: () => assert.fail('retired entry attempted to publish'),
  });
  await Promise.resolve();
  ownsSelection = false;
  save.resolve();
  await expansion;
});

test('measurement extension preserves absolute offsets and rejects mismatched content', async () => {
  const currentWindow = chapter('😀', { startScalar: 10, endScalar: 11, totalScalars: 30 });
  const expanded = chapter('A\n😀', { startScalar: 8, endScalar: 11, totalScalars: 30 });
  let admitted = false;
  await prepareReadingParagraphWindowMeasurement(expanded, currentWindow, 'lineSeparated', current,
    (result, projected): void => {
      admitted = true;
      assert.equal(result.documentRange, expanded.documentRange);
      assert.equal(projected.map.scalarCount(), 30);
      assert.deepEqual(projected.ranges, [
        new ParagraphRange('paragraph-0-0', 0, 1, 8, 9),
        new ParagraphRange('paragraph-1-2', 2, 4, 10, 11),
      ]);
    });
  assert.equal(admitted, true);
  await assert.rejects(prepareReadingParagraphWindowMeasurement(
    { ...expanded, contentVersion: 'other' }, currentWindow, 'lineSeparated', current,
    () => assert.fail('different content identity was assigned to the active measurement'),
  ), { message: 'entry image ownership scope mismatch' });
});

test('retaining the visible page rebases UTF-16 offsets without changing chapter-relative identities', async () => {
  const image = chapterImage(16);
  const source = { ...chapter('A\nB\n😀\n\uFFFC\nE', { startScalar: 10, endScalar: 19, totalScalars: 30 }),
    images: [chapterImage(10), image] };
  const projection = await prepareReadingChapterMeasurement(source, () => 'lineSeparated', current);
  const retained = projectRetainedReadingParagraphWindow(source, projection.ranges, 14, 15, () => projection.map);
  assert.ok(retained);
  assert.equal(retained.chapter.content, 'B\n😀\n\uFFFC');
  assert.deepEqual(retained.chapter.documentRange, { startScalar: 12, endScalar: 17, totalScalars: 30 });
  assert.equal(retained.chapter.images[0], image);
  assert.equal(retained.chapter.images.length, 1);
  assert.equal(retained.map.scalarCount(), 30);
  assert.deepEqual(retained.ranges, [
    new ParagraphRange('paragraph-1-2', 0, 1, 12, 13),
    new ParagraphRange('paragraph-2-4', 2, 4, 14, 15),
    new ParagraphRange('paragraph-3-7', 5, 6, 16, 17),
  ]);
  assert.equal(projectRetainedReadingParagraphWindow(source, projection.ranges, 10, 19,
    () => assert.fail('an unchanged window should not request the scalar map')), undefined);
  assert.throws(() => projectRetainedReadingParagraphWindow(source, projection.ranges, 19, 25, () => projection.map),
    { message: 'PAGINATION_PAGE_OUTSIDE_PARAGRAPH_WINDOW' });
});

test('a giant measured paragraph bypasses synchronous cropping', async () => {
  const content = 'A\n' + 'B'.repeat(32769) + '\nC\nD';
  const source = chapter(content, { startScalar: 0, endScalar: content.length, totalScalars: content.length + 10 });
  const projection = await prepareReadingChapterMeasurement(source, () => 'lineSeparated', current);
  assert.equal(projectRetainedReadingParagraphWindow(source, projection.ranges, 2, 3, () => projection.map), undefined);
});
