import assert from 'node:assert/strict';

import {
  projectReaderBookmarkRows,
  readerBookmarkLoadState,
  readerBookmarkRowsFromRecords,
  migrateLegacyBookmarks,
  readerBookmarkIdentityForBook,
  readerBookmarkRecordId,
  readerBookmarkExcerpt,
  readerBookmarkTimeLabel,
  readerBookmarkPositionLabel,
} from '../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';

const bookmarksByChapter = {
  5: [{ time: 500, chapterIndex: 5, chapterOffset: 0, chapterTitle: '第 6 章', content: '章首书签' }],
  10: [
    { time: 1030, chapterIndex: 10, chapterOffset: 980, chapterTitle: '第 11 章', content: '同章第三个书签' },
    { time: 1010, chapterIndex: 10, chapterOffset: 120, chapterTitle: '第 11 章', content: '同章第一个书签' },
    { time: 1020, chapterIndex: 10, chapterOffset: 540, chapterTitle: '第 11 章', content: '同章第二个书签' },
  ],
  20: [
    { time: 2000, chapterIndex: 20, chapterOffset: 64, chapterTitle: '第 21 章', content: '第二十一章书签甲' },
    { time: 2010, chapterIndex: 20, chapterOffset: 640, chapterTitle: '第 21 章', content: '第二十一章书签乙' },
  ],
};

const entries = Array.from({ length: 25 }, (_unused, index) => ({
  index,
  title: `第 ${index + 1} 章`,
  bookmarks: bookmarksByChapter[index] ?? [],
}));

const entriesSnapshot = JSON.parse(JSON.stringify(entries));

// --- Directory -> bookmarks -> directory round trips keep both projections.

const directoryFirst = projectReaderDirectoryEntries(entries, '', true);
assert.equal(directoryFirst.length, 25, 'directory projection must keep every chapter');
assert.deepEqual(directoryFirst.map((entry) => entry.index), entries.map((entry) => entry.index),
  'ascending directory projection must keep Core order');

const bookmarkRows = projectReaderBookmarkRows(entries, '', undefined);
assert.equal(bookmarkRows.length, 6, 'each bookmark must become its own row');
assert.deepEqual(entries, entriesSnapshot, 'projections must not mutate the owner-provided TOC');

const directoryAgain = projectReaderDirectoryEntries(entries, '', true);
assert.deepEqual(directoryAgain, directoryFirst,
  'switching bookmarks -> directory must reproduce the same directory projection');

const bookmarkRowsAgain = projectReaderBookmarkRows(entries, '', undefined);
assert.deepEqual(bookmarkRowsAgain, bookmarkRows,
  'switching directory -> bookmarks must reproduce the same bookmark projection');

assert.equal(readerBookmarkLoadState(entries), 'ready',
  'admitted entries must not report loading');

// --- Same-chapter bookmarks appear as separate ordered rows.

const sameChapter = bookmarkRows.filter((row) => row.chapterIndex === 10);
assert.equal(sameChapter.length, 3, 'three bookmarks in one chapter must render three rows');
assert.deepEqual(sameChapter.map((row) => row.chapterOffset), [120, 540, 980],
  'same-chapter rows must be time-ordered with distinct offsets');
assert.equal(new Set(sameChapter.map((row) => row.bookmarkId)).size, 3,
  'same-chapter rows must carry distinct bookmark identities');

// --- Tap mapping carries the exact Core chapter offset, never just the opening.

const nonZero = bookmarkRows.find((row) => row.chapterOffset === 540);
assert.ok(nonZero, 'mid-chapter bookmark row must exist');
assert.equal(nonZero.chapterIndex, 10);
assert.equal(nonZero.bookmarkId, 'session:10:540:1020',
  'session-scoped ids must stay deterministic');

const withIdentity = projectReaderBookmarkRows(entries, '', {
  libraryBookId: 'lib-1',
  sourceId: 'src-1',
  bookId: 'book-1',
  bookName: '剑来',
  bookAuthor: '烽火戏诸侯',
});
const identityRow = withIdentity.find((row) => row.chapterOffset === 540);
assert.equal(identityRow.bookmarkId, readerBookmarkRecordId('剑来', '烽火戏诸侯', 10, 540, 1020),
  'identity-backed ids must use the full stable tuple');
assert.equal(withIdentity.length, bookmarkRows.length,
  'identity must not change row multiplicity');

// --- Deleting the last bookmark must yield the strict empty preconditions.

const singleBookmarkBook = [
  { index: 0, title: '第一章', bookmarks: [] },
  { index: 1, title: '第二章', bookmarks: [{ time: 9, chapterIndex: 1, chapterOffset: 33,
    chapterTitle: '第二章', content: '全书唯一书签' }] },
  { index: 2, title: '第三章', bookmarks: [] },
];
const afterDelete = singleBookmarkBook.map((entry) => entry.index === 1 ?
  { ...entry, bookmarks: [] } : entry);
const rowsAfterDelete = projectReaderBookmarkRows(afterDelete, '', undefined);
assert.equal(rowsAfterDelete.length, 0, 'deleting the last bookmark must project zero rows');
assert.equal(readerBookmarkLoadState(afterDelete), 'ready',
  'deleted-last must be ready, not loading');
assert.ok(rowsAfterDelete.length === 0 && readerBookmarkLoadState(afterDelete) === 'ready',
  'empty state preconditions: zero rows with an admitted projection');

// --- Loading wins over empty while any entry is unadmitted.

const unadmitted = entries.map((entry) => entry.index === 7 ?
  { ...entry, bookmarks: undefined } : entry);
assert.equal(readerBookmarkLoadState(unadmitted), 'loading',
  'one unadmitted entry must hold the tab in loading');
assert.ok(projectReaderBookmarkRows(unadmitted, '', undefined).length > 0,
  'loading must not be reported as empty content');

// --- Search filters bookmark rows on title and excerpt.

assert.deepEqual(projectReaderBookmarkRows(entries, '书签乙', undefined)
  .map((row) => row.chapterOffset), [640], 'bookmark search must match excerpt content');
assert.deepEqual(projectReaderBookmarkRows(entries, '第 21 章', undefined).length, 2,
  'bookmark search must match chapter title');

// --- Identity migration: legacy data resolves to confirmed or stays pending.

const identity = {
  libraryBookId: 'lib-77',
  sourceId: 'src-9',
  bookId: 'book-42',
  bookName: '剑来',
  bookAuthor: '烽火戏诸侯',
};
const resolver = readerBookmarkIdentityForBook(identity);
assert.equal(resolver('剑来', '烽火戏诸侯'), identity, 'exact name+author must resolve');
assert.equal(resolver('其他书', '烽火戏诸侯'), undefined, 'mismatched name must not resolve');
assert.equal(resolver('剑来', '其他作者'), undefined, 'mismatched author must not resolve');

const legacy = [
  {
    bookName: '剑来', bookAuthor: '烽火戏诸侯',
    time: 111, chapterIndex: 3, chapterOffset: 45, chapterTitle: '第四章', content: '已确认书签',
  },
  {
    bookName: '剑来', bookAuthor: '烽火戏诸侯',
    time: 222, chapterIndex: 3, chapterOffset: 90, chapterTitle: '第四章', content: '同章第二条',
  },
  {
    bookName: '流浪地球', bookAuthor: '刘慈欣',
    time: 333, chapterIndex: 1, chapterOffset: 7, chapterTitle: '第二章', content: '归属不明书签',
  },
];

const migrated = migrateLegacyBookmarks(legacy, resolver);
assert.equal(migrated.length, 3, 'migration must not merge or drop legacy bookmarks');
assert.equal(migrated[0].identityStatus, 'confirmed');
assert.equal(migrated[0].libraryBookId, 'lib-77');
assert.equal(migrated[0].sourceId, 'src-9');
assert.equal(migrated[0].bookId, 'book-42');
assert.equal(migrated[0].bookmarkId, readerBookmarkRecordId('剑来', '烽火戏诸侯', 3, 45, 111));
assert.equal(migrated[1].identityStatus, 'confirmed');
assert.notEqual(migrated[0].bookmarkId, migrated[1].bookmarkId,
  'same-book same-chapter bookmarks must keep distinct ids');
assert.equal(migrated[2].identityStatus, 'pendingConfirmation',
  'unresolvable ownership must be marked pendingConfirmation');
assert.equal(migrated[2].libraryBookId, '');
assert.equal(migrated[2].sourceId, '');
assert.equal(migrated[2].bookId, '');
assert.equal(migrated[2].bookName, '流浪地球',
  'pending records must keep the original ownership pair for later confirmation');
assert.equal(migrated[2].bookAuthor, '刘慈欣');

const pendingRows = readerBookmarkRowsFromRecords(migrated);
assert.equal(pendingRows.length, 3);
assert.equal(pendingRows[2].identityStatus, 'pendingConfirmation',
  'pending markers must survive into row models');
assert.equal(pendingRows[0].identityStatus, 'confirmed');

const unresolvedMigration = migrateLegacyBookmarks(legacy, () => undefined);
assert.ok(unresolvedMigration.every((record) => record.identityStatus === 'pendingConfirmation'),
  'without any resolvable identity every record stays pending');

// --- Deterministic id, excerpt, time and position labels.

assert.equal(readerBookmarkRecordId('书', '作', 1, 2, 3), readerBookmarkRecordId('书', '作', 1, 2, 3));
assert.notEqual(readerBookmarkRecordId('书', '作', 1, 2, 3), readerBookmarkRecordId('书', '作', 1, 2, 4));
assert.equal(readerBookmarkExcerpt('短摘录'), '短摘录');
const long = 'あ'.repeat(50);
assert.equal(readerBookmarkExcerpt(long), 'あ'.repeat(48) + '…');
assert.equal(readerBookmarkExcerpt(long, 4), 'ああああ…');

const sampleTime = new Date(2026, 7, 31, 9, 5).getTime();
assert.equal(readerBookmarkTimeLabel(sampleTime), '08-31 09:05');
for (const value of [0, 1, 2, 500, 1789410740, 999999999999, -1, NaN, Infinity,
  Number.MAX_SAFE_INTEGER + 1, 8640000000000001, sampleTime + 0.5]) {
  assert.equal(readerBookmarkTimeLabel(value), '时间未知',
    'legacy sequence/seconds and invalid dates must not acquire a guessed calendar time');
}
const timestampEntries = [{ index: 0, title: 'chapter', bookmarks: [
  { time: 2, chapterIndex: 0, chapterOffset: 9, chapterTitle: 'chapter', content: 'old note', bookText: 'old text' },
  { time: sampleTime, chapterIndex: 0, chapterOffset: 20, chapterTitle: 'chapter', content: 'new note', bookText: 'new text' },
] }];
const timestampSnapshot = structuredClone(timestampEntries);
const timestampRows = projectReaderBookmarkRows(timestampEntries, '');
assert.deepEqual(timestampRows.map(row => row.timeLabel), ['时间未知', '08-31 09:05']);
assert.deepEqual(timestampRows.map(row => row.bookmarkId), ['session:0:9:2', `session:0:20:${sampleTime}`],
  'display repair preserves exact primary keys and identity');
assert.deepEqual(timestampEntries, timestampSnapshot, 'old keys, notes, text and positions remain untouched');
const timestampRecords = migrateLegacyBookmarks(timestampEntries[0].bookmarks.map(bookmark => ({
  ...bookmark, bookName: identity.bookName, bookAuthor: identity.bookAuthor,
})), resolver);
assert.deepEqual(readerBookmarkRowsFromRecords(timestampRecords).map(row => row.timeLabel),
  ['时间未知', '08-31 09:05'], 'both session and migrated record paths use the same time admission');
assert.equal(readerBookmarkPositionLabel(120, 1200), '10%');
assert.equal(readerBookmarkPositionLabel(120, 0), '');
assert.equal(readerBookmarkPositionLabel(120, undefined), '');
assert.equal(readerBookmarkPositionLabel(5000, 100), '100%', 'percent must clamp at 100');
assert.equal(readerBookmarkPositionLabel(0, 100), '0%');

console.log('reader bookmark projection behavior: PASS');
