import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ReadingSessionChapter, ReadingSessionImage } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { ReaderContinuousReadingProjection,
  type ReaderContinuousFragmentSpan } from '../../entry/src/main/ets/features/reading/ui/ReaderContinuousReadingProjection.ts';

interface Fragment extends ReaderContinuousFragmentSpan {
  id: string;
  image?: ReadingSessionImage;
}

function range(startUtf16: number, endUtf16: number, startScalar: number, endScalar: number) {
  return { id: `range-${startScalar}`, startUtf16, endUtf16, startScalar, endScalar };
}

function chapter(content: string, documentRange?: ReadingSessionChapter['documentRange']): ReadingSessionChapter {
  return { sourceId: 'local', bookId: 'book', chapterIndex: 2, chapterTitle: 'Title', chapterUrl: undefined,
    content, documentRange, contentVersion: 'content', extractionVia: 'local', images: [] };
}

function fixture() {
  const images = new Map<number, ReadingSessionImage>();
  const lookups: number[] = [];
  const projection = new ReaderContinuousReadingProjection<Fragment>();
  const factory = {
    imageAtScalar(startScalar: number) { lookups.push(startScalar); return images.get(startScalar); },
    image(id: string, image: ReadingSessionImage): Fragment {
      return { id, text: '', startScalar: image.startScalar, endScalar: image.endScalar, image };
    },
    text(id: string, text: string, startScalar: number, endScalar: number): Fragment {
      return { id, text, startScalar, endScalar };
    },
  };
  return { projection, factory, images, lookups };
}

test('continuous projection expands a same-version entry window in canonical coordinates with retained row objects', () => {
  const { projection, factory } = fixture();
  const partial = chapter('𐐷A\nZ', { startScalar: 4, endScalar: 8, totalScalars: 8 });
  const partialRows = projection.project(partial, [range(0, 3, 4, 6), range(4, 5, 7, 8)], false, factory.imageAtScalar, factory.image, factory.text);
  projection.commit(partial, partialRows, 5, () => 'geometry');
  assert.equal(projection.chapterTitle, '');
  assert.equal(projection.chapterIdentity, 'continuous:["local","book",2,"content"]');
  assert.equal(partialRows[0].text, '𐐷A');
  assert.equal(partialRows[0].continuousSpaceBefore, true);
  assert.deepEqual(projection.anchor(6), { index: 1, progress: 0 });
  assert.deepEqual(projection.anchor(8), { index: 1, progress: 1 });

  const expanded = chapter('One\n𐐷A\nZ');
  const ranges = [range(0, 3, 0, 3), range(4, 7, 4, 6), range(8, 9, 7, 8)];
  const rows = projection.project(expanded, ranges, true, factory.imageAtScalar, factory.image, factory.text);
  assert.equal(rows[1], partialRows[0]);
  assert.equal(rows[2], partialRows[1]);
  projection.commit(expanded, rows, 5, () => 'geometry-expanded');
  assert.equal(projection.chapterTitle, 'Title');
  assert.equal(projection.geometryKey, 'geometry-expanded');
  assert.equal(projection.visibleStart, 1);
  assert.equal(projection.visibleEnd, 1);
  assert.deepEqual(projection.anchor(5), { index: 1, progress: 0.5 });
  assert.deepEqual(rows.map(row => row.continuousSpaceBefore), [false, true, true]);

  const altered = projection.project(expanded, [range(4, 6, 4, 5)], true, factory.imageAtScalar, factory.image, factory.text);
  assert.notEqual(altered[0], rows[1]);
  assert.equal(altered[0].text, '𐐷');
});

test('continuous image materialization matches only an exact placeholder span and replaces a resolved row in place', () => {
  const { projection, factory, images, lookups } = fixture();
  const host = chapter('\uFFFC\uFFFCx\uFFFC');
  const pending: ReadingSessionImage = { source: 'image', baseUrl: undefined, state: 'pending',
    startScalar: 0, endScalar: 1, pixelMap: undefined, fileUri: '', intrinsicWidth: 1, intrinsicHeight: 1, revision: 'pending' };
  images.set(0, pending);
  images.set(3, { ...pending, startScalar: 3, endScalar: 5 });
  const rows = projection.project(host, [range(0, 1, 0, 1), range(1, 3, 1, 3), range(3, 4, 3, 4)], false, factory.imageAtScalar, factory.image, factory.text);
  assert.deepEqual(lookups, [0, 3]);
  assert.deepEqual(rows.map(row => row.id), ['continuous:2:image:0-1', 'continuous:2:text:1-3', 'continuous:2:text:3-4']);
  assert.deepEqual(rows.map(row => row.text), ['', '\uFFFCx', '\uFFFC']);
  projection.commit(host, rows, 0, () => 'geometry');
  const scheduled: number[] = [];
  projection.resolveVisibleImages(0, 2, scalar => scheduled.push(scalar));
  assert.deepEqual(scheduled, [0]);

  const originalImage = rows[0];
  assert.equal(projection.replaceResolvedImage(host, pending, factory.image), undefined);
  const ready: ReadingSessionImage = { ...pending, state: 'ready', fileUri: '/image' };
  assert.equal(projection.replaceResolvedImage(undefined, ready, factory.image), undefined);
  assert.equal(projection.replaceResolvedImage(host, { ...ready, startScalar: 9 }, factory.image), undefined);
  assert.equal(projection.replaceResolvedImage(host, ready, factory.image), 0);
  assert.equal(projection.fragments, rows);
  assert.notEqual(projection.fragments[0], originalImage);
  assert.equal(projection.fragments[0].image, ready);
  assert.equal(projection.fragments[0].continuousSpaceBefore, false);
  projection.republishFragments();
  assert.notEqual(projection.fragments, rows);
  assert.equal(projection.fragments[0], rows[0]);
  assert.equal(projection.replaceResolvedImage(host, ready, factory.image), 0);
  projection.clear();
  assert.equal(projection.replaceResolvedImage(host, ready, factory.image), undefined);
  assert.equal(projection.chapterIdentity, 'continuous:empty');
  assert.equal(projection.chapterTitle, '');
  assert.equal(projection.geometryKey, 'geometry');
});

test('continuous viewport reports the nearest canonical scalar inside the first visible row', () => {
  const { projection, factory } = fixture();
  assert.equal(projection.admitVisibleRange(0, 1, 0), undefined);
  const host = chapter('abcdef\nz');
  const rows = projection.project(host, [range(0, 6, 0, 6), range(7, 8, 7, 8)], false, factory.imageAtScalar, factory.image, factory.text);
  projection.commit(host, rows, -20, () => 'geometry');
  assert.deepEqual(projection.admitVisibleRange(-4, 99, 0.28), { startIndex: 0, endIndex: 1, scalar: 2 });
  assert.deepEqual(projection.admitVisibleRange(0, 0, 1), { startIndex: 0, endIndex: 0, scalar: 5 });
  assert.deepEqual(projection.admitVisibleRange(50, -1, 1), { startIndex: 1, endIndex: 1, scalar: 7 });
  assert.equal(projection.visibleStart, 1);
  assert.equal(projection.visibleEnd, 1);
  assert.deepEqual(projection.anchor(9), { index: 1, progress: 1 });
  projection.clear();
  assert.deepEqual(projection.anchor(9), { index: 0, progress: 0 });
});
