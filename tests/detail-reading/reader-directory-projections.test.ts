import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LocalReadingBookmark, LocalReadingTocEntry } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import type { ReaderDirectoryTargetProof } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryTargetProof.ts';
import { readingChapterWindowOrder } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { createRequestedRemoteReadingPositionContext } from '../../entry/src/main/ets/features/reading/application/RemoteReadingPositionMigration.ts';
import { projectReaderChapterBookmarkExcerpts } from '../../entry/src/main/ets/features/reading/presentation/ReaderBookmarkProjection.ts';
import {
  projectReaderControlDirectoryTitles,
  readableReaderDirectoryEntries,
  readerDirectoryEntryRanks,
  readerDirectoryProgressTarget,
  readerEntryNavigationItem,
  readerUnreadDirectoryCandidates,
} from '../../entry/src/main/ets/features/reading/presentation/ReaderDirectoryProjection.ts';

function chapter(index: number, title: string): LocalReadingTocEntry {
  return { index, title, downloadState: 'unknown' };
}

const positionScope = {
  sourceId: 'book-source', bookId: 'book', chapterIndex: 5, bodyVersion: 'body', processingVersion: 'processing',
};

test('Reader Control retains parent markers, offline state and order when current session titles arrive', () => {
  const heading: LocalReadingTocEntry = { ...chapter(0, 'Volume'), navigable: false };
  const active: LocalReadingTocEntry = { ...chapter(5, 'Old title'), displayTitle: 'Parent label', level: 2,
    downloadState: 'cached', isVip: true, bookmarks: [] };
  const pending: LocalReadingTocEntry = { ...chapter(9, 'Old title 2'), level: 3 };
  const projected = projectReaderControlDirectoryTitles([heading, active, pending],
    [chapter(5, 'Earlier result'), chapter(9, 'New title 2'), { ...chapter(5, 'New title'), level: 4 },
      chapter(13, 'New row')]);
  assert.deepEqual(projected.map((row) => [row.index, row.title, row.level]),
    [[0, 'Volume', undefined], [5, 'New title', 4], [9, 'New title 2', 3]]);
  assert.equal(projected[0], heading);
  assert.equal(projected[1].bookmarks, active.bookmarks);
  assert.equal(projected[1].displayTitle, 'Parent label');
  assert.equal(projected[1].isVip, true);
  assert.equal(projected[1].downloadState, 'cached');
  assert.equal(active.title, 'Old title');
});

test('a resume-only chapter stays in the chapter window and is excluded from readable ranks', () => {
  const entries = [chapter(9, 'First'), { ...chapter(4, 'Heading'), navigable: false },
    { ...chapter(7, 'Historical'), navigable: false }, { ...chapter(2, 'Last'), navigable: true }];
  const readable = readableReaderDirectoryEntries(entries);
  assert.deepEqual(readable, [entries[0], entries[3]]);
  assert.equal(readable[0], entries[0]);
  assert.deepEqual([...readerDirectoryEntryRanks(readable)], [[9, 0], [2, 1]]);
  assert.deepEqual(readingChapterWindowOrder(entries), [9, 2]);
  assert.deepEqual(readingChapterWindowOrder(entries, 7), [9, 7, 2]);
});

test('partial catalog lookup preserves catalog and readable positions independently', () => {
  const before = { ...chapter(2, 'Heading'), position: 5, navigable: false };
  const current = { ...chapter(5, 'Current'), position: 6, readablePosition: 3 };
  const after = { ...chapter(8, 'Next'), position: 7, readablePosition: 4 };
  const window = { revision: 'r', chapterCount: 10, readableChapterCount: 7, current, before: [before], after: [after] };
  assert.equal(readerEntryNavigationItem(window, 2), before);
  assert.equal(readerEntryNavigationItem(window, 2)?.readablePosition, undefined);
  assert.equal(readerEntryNavigationItem(window, 5), current);
  assert.equal(readerEntryNavigationItem(window, 8), after);
  assert.equal(readerEntryNavigationItem(window, 9), undefined);
  assert.equal(readerEntryNavigationItem(undefined, 5), undefined);
});

test('remote unread entry selects only three eligible chapters in session order', () => {
  const readable = [chapter(9, 'Ninth'), chapter(6, 'Sixth'), chapter(7, 'Seventh'), chapter(8, 'Eighth'),
    chapter(3, 'Third')];
  const remote = [chapter(10, 'Not admitted'), chapter(9, 'Blank URL'), chapter(8, 'Eighth'),
    chapter(7, 'Seventh'), chapter(6, 'Sixth'), chapter(3, 'Third')].map((entry) =>
    ({ ...entry, variables: [], url: entry.index === 9 ? '  ' : `https://example.test/${entry.index}` }));
  assert.deepEqual(readerUnreadDirectoryCandidates(readable, remote), [8, 7, 6]);
  assert.deepEqual(readerUnreadDirectoryCandidates([], remote), []);
});

test('catalog progress fallback preserves chapter boundaries and the two percent endpoints', () => {
  assert.equal(readerDirectoryProgressTarget(0, 50), undefined);
  assert.deepEqual(readerDirectoryProgressTarget(4, -20), { position: 0, chapterProgress: 0 });
  assert.deepEqual(readerDirectoryProgressTarget(4, 25), { position: 1, chapterProgress: 0 });
  assert.deepEqual(readerDirectoryProgressTarget(4, 62.5), { position: 2, chapterProgress: 0.5 });
  assert.deepEqual(readerDirectoryProgressTarget(4, 100), { position: 3, chapterProgress: 1 });
  assert.deepEqual(readerDirectoryProgressTarget(4, 150), { position: 3, chapterProgress: 1 });
});

test('bookmark display uses only current resident quotes and leaves admitted notes intact', () => {
  const legacy: LocalReadingBookmark = { time: 1, chapterIndex: 5, chapterOffset: 0,
    chapterTitle: 'Current', content: 'A note', positionScope };
  const existing = { ...legacy, time: 2, bookText: 'Stored quote' };
  const oldScope = { ...positionScope, bodyVersion: 'older body' };
  const stale = { ...existing, time: 3, positionScope: oldScope };
  const unscoped = { ...legacy, time: 4, positionScope: undefined };
  const nonResident = { ...legacy, time: 5, chapterOffset: 1000 };
  const row = { ...chapter(5, 'Current'), bookmarks: [legacy, existing, stale, unscoped, nonResident] };
  const other = chapter(8, 'Other');
  const entries = [row, other];
  const lookups: number[] = [];
  const projected = projectReaderChapterBookmarkExcerpts(entries, 5,
    (mark): boolean => mark.positionScope === positionScope,
    (mark): string | undefined => {
      lookups.push(mark.time);
      return mark === legacy ? 'Current 😀 quote' : undefined;
    });
  const marks = projected[0].bookmarks!;
  assert.deepEqual(lookups, [1, 5]);
  assert.deepEqual(marks[0], { ...legacy, bookText: 'Current 😀 quote' });
  assert.equal(marks[1], existing);
  assert.deepEqual(marks[2], { ...stale, positionScope: undefined });
  assert.equal(marks[3], unscoped);
  assert.equal(marks[4], nonResident);
  assert.equal(projected[1], other);
  assert.equal(row.bookmarks[0].bookText, undefined);
  assert.equal(stale.positionScope, oldScope);
  assert.equal(projectReaderChapterBookmarkExcerpts(entries, 8, () => true, () => undefined), entries);
  const unchanged = [{ ...row, bookmarks: [existing, nonResident] }];
  assert.equal(projectReaderChapterBookmarkExcerpts(unchanged, 5, () => true, () => undefined), unchanged);
});

test('bookmark position context preserves proof-only targets, versions and scope error ordering', () => {
  const proof: ReaderDirectoryTargetProof = {
    sourceId: 'book-source', bookId: 'book', catalogRevision: 'c', structureRevision: 's',
    nodeId: 'node', chapterIndex: 5, url: 'https://example.test/chapter/5',
  };
  assert.equal(createRequestedRemoteReadingPositionContext('book-source', 'book', 5, 12, undefined), undefined);
  assert.deepEqual(createRequestedRemoteReadingPositionContext('book-source', 'book', 5, 12, undefined, proof),
    { anchors: [], directoryTargetProof: proof });
  assert.deepEqual(createRequestedRemoteReadingPositionContext('book-source', 'book', 5, 12, positionScope, proof),
    { bodyVersion: 'body', processingVersion: 'processing', anchors: [{ id: 'requested', offset: 12 }],
      directoryTargetProof: proof });
  assert.throws(() => createRequestedRemoteReadingPositionContext(
    'book-source', 'book', 8, 12, positionScope, { ...proof, bookId: 'other' }), /DIRECTORY_SCOPE_CHANGED/);
  assert.throws(() => createRequestedRemoteReadingPositionContext(
    'book-source', 'book', 8, 12, positionScope, proof), /READING_POSITION_SCOPE_MISMATCH/);
});
