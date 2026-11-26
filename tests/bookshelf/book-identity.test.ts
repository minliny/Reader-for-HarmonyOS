import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBookshelfBook } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfBookIdentity.ts';
import type { ShelfBook } from '../../entry/src/main/ets/app/ReaderCoreGateway.ts';
import type { SearchBook } from '../../entry/src/main/ets/features/search/application/SearchGateway.ts';

const selected: SearchBook = { sourceId: 'original', bookId: 'a', sourceName: 'A', bookSourceUrl: 'a', detailUrl: 'a',
  searchRequestId: 'q', sourceRuleVersion: 'r', category: 'novel', title: '旅程', author: '作者', variables: [] };
const saved: ShelfBook = { sourceId: 'second', bookId: 'b', title: '另一书名', author: '另一作者', contentKind: 'text', addedAt: 1 };

test('an exact shelf identity has priority over another saved variant', () => {
  const exact = { ...saved, sourceId: 'original', bookId: 'a' };
  const variant = { ...selected, sourceId: 'second', bookId: 'b' };
  assert.deepEqual(resolveBookshelfBook(selected, [variant], [saved, exact]), { kind: 'matched', book: exact });
});

test('remote alias matching keeps same-title manga and local imports separate', () => {
  const differentEditions: ShelfBook[] = [
    { ...saved, title: selected.title, author: selected.author, contentKind: 'manga' },
    { ...saved, title: selected.title, author: selected.author, sourceId: 'local' },
  ];
  assert.deepEqual(resolveBookshelfBook(selected, [], differentEditions), { kind: 'missing' });
});
