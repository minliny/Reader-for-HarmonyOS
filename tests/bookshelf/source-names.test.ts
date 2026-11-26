import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookshelfSourceDisplayName, bookshelfSourceNameNeedsLookup } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import { readingEntryInputForShelfSnapshot } from '../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import type { RemoteReadingEntryInput } from '../../entry/src/main/ets/features/reading/application/ReadingEntryHost.ts';
import type { BookSource } from '../../entry/src/main/ets/features/source/application/SourceGateway.ts';

const sourceId = 'https://novel-a.reader-journeys.invalid';
const bookId = `${sourceId}/book/ReaderShelfNovel`;
const shelfBook = { sourceId, bookId, title: 'ReaderShelfNovel', author: 'Reader Fixture Author', addedAt: 1, contentKind: 'text' as const };
const entryWithName = (sourceName: string): RemoteReadingEntryInput => ({
  seed: { sourceId, bookId, detailUrl: bookId, title: shelfBook.title, author: shelfBook.author },
  sourceName,
});

test('a durable source name and an explicit removal survive a failed source-list read', () => {
  assert.equal(bookshelfSourceDisplayName('shelf-source', ' 已存书源 ', []), '已存书源');
  assert.equal(bookshelfSourceDisplayName('shelf-source', '书源已移除', [],
    { sourceId: 'shelf-source', sourceName: '旧搜索结果' }), '书源已移除');
});

test('a stale candidate from another source cannot name a bookshelf row', () => {
  assert.equal(bookshelfSourceDisplayName('exact', 'https://source.example.test', [],
    { sourceId: 'other', sourceName: '其他书源' }), '书源名称暂不可用');
  assert.equal(bookshelfSourceDisplayName('local', '', []), '本地书籍');
});

test('a fresh exact shelf snapshot replaces an unavailable name in the reading entry', () => {
  const entry = readingEntryInputForShelfSnapshot(entryWithName('书源名称暂不可用'),
    { ...shelfBook, sourceName: 'ReaderNovelA' });
  assert.equal(entry.sourceName, 'ReaderNovelA');
});

test('a membership row without a usable name keeps the exact search source in the reading entry', () => {
  const entry = readingEntryInputForShelfSnapshot(entryWithName('ReaderNovelA'),
    { ...shelfBook, sourceName: '书源名称暂不可用' });
  assert.equal(entry.sourceName, 'ReaderNovelA');
  assert.equal(readingEntryInputForShelfSnapshot(entryWithName('ReaderNovelA'),
    { ...shelfBook, sourceName: '书源已移除' }).sourceName, '书源已移除');
});

test('missing, unavailable and URL labels can read back a name from the exact registered source', () => {
  const source: BookSource = { sourceId, name: 'ReaderNovelA', baseUrl: sourceId,
    enabled: true, enabledExplore: false, category: 'novel' };
  const other = { ...source, sourceId: 'different-source', name: 'Other source' };
  for (const label of ['', sourceId, '书源名称暂不可用']) {
    assert.equal(bookshelfSourceNameNeedsLookup(sourceId, label), true);
    assert.equal(bookshelfSourceDisplayName(sourceId, label, [[other, source]]), 'ReaderNovelA');
  }
  assert.equal(bookshelfSourceNameNeedsLookup(sourceId, 'ReaderNovelA'), false);
  assert.equal(bookshelfSourceNameNeedsLookup(sourceId, '书源已移除'), false);
  assert.equal(bookshelfSourceNameNeedsLookup('local', ''), false);
});
